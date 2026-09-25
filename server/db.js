/* Almacenamiento del gestor.
   En Hostinger usa MySQL (variables DB_HOST, DB_USER, DB_PASSWORD, DB_NAME).
   Sin esas variables —por ejemplo, en el computador de desarrollo— guarda en archivos JSON
   dentro de server/.data, con las mismas operaciones. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TABLES=[
  `CREATE TABLE IF NOT EXISTS cms_users(
    id VARCHAR(32) PRIMARY KEY, name VARCHAR(120) NOT NULL, username VARCHAR(120) NOT NULL UNIQUE,
    salt VARCHAR(64) NOT NULL, hash VARCHAR(256) NOT NULL, created_at DATETIME NOT NULL
  ) CHARACTER SET utf8mb4`,
  `CREATE TABLE IF NOT EXISTS cms_sessions(
    token CHAR(64) PRIMARY KEY, user_id VARCHAR(32) NOT NULL, expires_at DATETIME NOT NULL, INDEX(user_id)
  ) CHARACTER SET utf8mb4`,
  `CREATE TABLE IF NOT EXISTS cms_content(
    id TINYINT PRIMARY KEY, data LONGTEXT NOT NULL, version INT NOT NULL, updated_at DATETIME NOT NULL, updated_by VARCHAR(32)
  ) CHARACTER SET utf8mb4`,
  `CREATE TABLE IF NOT EXISTS cms_media(
    id CHAR(32) PRIMARY KEY, mime VARCHAR(80) NOT NULL, size INT NOT NULL, data LONGBLOB NOT NULL, created_at DATETIME NOT NULL
  )`
];

async function mysqlStore(){
  const mysql=(await import('mysql2/promise')).default;
  const pool=mysql.createPool({
    host:process.env.DB_HOST||'localhost', port:Number(process.env.DB_PORT||3306),
    user:process.env.DB_USER, password:process.env.DB_PASSWORD, database:process.env.DB_NAME,
    connectionLimit:5, charset:'utf8mb4', dateStrings:false
  });
  for(const sql of TABLES)await pool.query(sql);
  const one=async(sql,args)=>(await pool.query(sql,args))[0][0]||null;
  return {
    kind:'mysql',
    countUsers:async()=>(await one('SELECT COUNT(*) AS n FROM cms_users')).n,
    listUsers:async()=>(await pool.query('SELECT id,name,username,created_at AS createdAt FROM cms_users ORDER BY created_at'))[0],
    userByName:username=>one('SELECT * FROM cms_users WHERE username=?',[username]),
    userById:id=>one('SELECT * FROM cms_users WHERE id=?',[id]),
    insertUser:u=>pool.query('INSERT INTO cms_users(id,name,username,salt,hash,created_at) VALUES(?,?,?,?,?,?)',[u.id,u.name,u.username,u.salt,u.hash,new Date()]),
    setPassword:(id,salt,hash)=>pool.query('UPDATE cms_users SET salt=?,hash=? WHERE id=?',[salt,hash,id]),
    createSession:(token,userId,expires)=>pool.query('INSERT INTO cms_sessions(token,user_id,expires_at) VALUES(?,?,?)',[token,userId,expires]),
    session:token=>one('SELECT * FROM cms_sessions WHERE token=? AND expires_at>NOW()',[token]),
    deleteSession:token=>pool.query('DELETE FROM cms_sessions WHERE token=?',[token]),
    deleteUserSessions:(userId,except)=>pool.query('DELETE FROM cms_sessions WHERE user_id=? AND token<>?',[userId,except||'']),
    purgeSessions:()=>pool.query('DELETE FROM cms_sessions WHERE expires_at<NOW()'),
    content:async()=>{const r=await one('SELECT data,version,updated_at AS updatedAt FROM cms_content WHERE id=1');return r&&{data:JSON.parse(r.data),version:r.version,updatedAt:new Date(r.updatedAt).toISOString()}},
    // Solo guarda si nadie más guardó desde la versión que tenía quien edita
    saveContent:async(data,baseVersion,userId)=>{
      const json=JSON.stringify(data), now=new Date();
      if(!baseVersion){
        const [r]=await pool.query('INSERT IGNORE INTO cms_content(id,data,version,updated_at,updated_by) VALUES(1,?,1,?,?)',[json,now,userId]);
        return r.affectedRows?1:null;
      }
      const [r]=await pool.query('UPDATE cms_content SET data=?,version=version+1,updated_at=?,updated_by=? WHERE id=1 AND version=?',[json,now,userId,baseVersion]);
      return r.affectedRows?baseVersion+1:null;
    },
    putMedia:(id,mime,buf)=>pool.query('INSERT INTO cms_media(id,mime,size,data,created_at) VALUES(?,?,?,?,?)',[id,mime,buf.length,buf,new Date()]),
    media:id=>one('SELECT mime,data FROM cms_media WHERE id=?',[id])
  };
}

async function fileStore(){
  const dir=path.join(path.dirname(fileURLToPath(import.meta.url)),'.data');
  await fs.mkdir(path.join(dir,'media'),{recursive:true});
  const file=name=>path.join(dir,`${name}.json`);
  const read=async(name,fallback)=>{try{return JSON.parse(await fs.readFile(file(name),'utf8'))}catch{return fallback}};
  const write=(name,value)=>fs.writeFile(file(name),JSON.stringify(value,null,1));
  const alive=s=>new Date(s.expiresAt)>new Date();
  return {
    kind:'archivos locales',
    countUsers:async()=>(await read('users',[])).length,
    listUsers:async()=>(await read('users',[])).map(({id,name,username,createdAt})=>({id,name,username,createdAt})),
    userByName:async username=>(await read('users',[])).find(u=>u.username===username)||null,
    userById:async id=>(await read('users',[])).find(u=>u.id===id)||null,
    insertUser:async u=>write('users',[...await read('users',[]),{...u,createdAt:new Date().toISOString()}]),
    setPassword:async(id,salt,hash)=>write('users',(await read('users',[])).map(u=>u.id===id?{...u,salt,hash}:u)),
    createSession:async(token,userId,expires)=>write('sessions',[...(await read('sessions',[])).filter(alive),{token,user_id:userId,expiresAt:expires.toISOString()}]),
    session:async token=>(await read('sessions',[])).find(s=>s.token===token&&alive(s))||null,
    deleteSession:async token=>write('sessions',(await read('sessions',[])).filter(s=>s.token!==token)),
    deleteUserSessions:async(userId,except)=>write('sessions',(await read('sessions',[])).filter(s=>s.user_id!==userId||s.token===except)),
    purgeSessions:async()=>write('sessions',(await read('sessions',[])).filter(alive)),
    content:()=>read('content',null),
    saveContent:async(data,baseVersion,userId)=>{
      const cur=await read('content',null);
      if((cur?.version||0)!==(baseVersion||0))return null;
      const version=(cur?.version||0)+1;
      await write('content',{data,version,updatedAt:new Date().toISOString(),updatedBy:userId});
      return version;
    },
    putMedia:async(id,mime,buf)=>{await fs.writeFile(path.join(dir,'media',id),buf);await write(`media-${id}`,{mime})},
    media:async id=>{try{const {mime}=await read(`media-${id}`,{});return {mime,data:await fs.readFile(path.join(dir,'media',id))}}catch{return null}}
  };
}

// Si MySQL no responde (por ejemplo, falta DB_PASSWORD), el sitio sigue en pie con el contenido
// original y el gestor avisa; se vuelve a intentar la conexión cada 30 segundos.
function retryingStore(){
  let store=null, lastTry=0, lastError=null;
  const connect=async()=>{
    if(store)return store;
    if(Date.now()-lastTry<30e3)throw unavailable(lastError);
    lastTry=Date.now();
    try{store=await mysqlStore();console.log('[cineteca] conectado a MySQL');return store}
    catch(err){lastError=err;console.error('[cineteca] MySQL no disponible:',err.code||err.message);throw unavailable(err)}
  };
  const unavailable=err=>Object.assign(new Error(`La base de datos no está disponible${err?.code?` (${err.code})`:''}. Revisa las variables DB_ en Hostinger.`),{status:503});
  return new Proxy({kind:'mysql'},{get:(target,name)=>{
    if(name==='kind')return 'mysql';
    if(name==='then')return undefined;
    // Sin base de datos, el sitio público se muestra con su contenido original
    if(name==='content')return async()=>{try{return await (await connect()).content()}catch{return null}};
    return async(...args)=>(await connect())[name](...args);
  }});
}

export async function openStore(){
  if(process.env.DB_NAME&&process.env.DB_USER){
    const store=retryingStore();
    await store.countUsers().catch(()=>{});// primer intento al arrancar
    return store;
  }
  return fileStore();
}
