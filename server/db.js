/* Almacenamiento del gestor.
   En Hostinger usa MySQL (variables DB_HOST, DB_USER, DB_PASSWORD, DB_NAME).
   Sin esas variables —por ejemplo, en el computador de desarrollo— guarda en archivos JSON
   dentro de server/.data, con las mismas operaciones. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

// Los archivos grandes se guardan en trozos: MySQL rechaza paquetes mayores que max_allowed_packet
const CHUNK=512*1024;
// Una cuenta eliminada guarda su usuario como «usuario~eliminada~id»
const originalUsername=u=>String(u).replace(/~eliminada~[a-f0-9]+$/,'');
const recordCount=json=>{try{return (JSON.parse(json).records||[]).length}catch{return null}};

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
  `CREATE TABLE IF NOT EXISTS cms_tutorials(
    user_id VARCHAR(32) NOT NULL, screen VARCHAR(40) NOT NULL, seen_at DATETIME NOT NULL, PRIMARY KEY(user_id,screen)
  ) CHARACTER SET utf8mb4`,
  `CREATE TABLE IF NOT EXISTS cms_media(
    id CHAR(32) PRIMARY KEY, mime VARCHAR(80) NOT NULL, size INT NOT NULL, data LONGBLOB NOT NULL, created_at DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS cms_media_chunks(
    id CHAR(32) NOT NULL, n INT NOT NULL, data MEDIUMBLOB NOT NULL, PRIMARY KEY(id,n)
  )`,
  // Cada versión del contenido que se reemplaza queda guardada aquí (comprimida): nada se pierde
  `CREATE TABLE IF NOT EXISTS cms_content_history(
    version INT PRIMARY KEY, data LONGBLOB NOT NULL, records INT, saved_at DATETIME NOT NULL, saved_by VARCHAR(32)
  ) CHARACTER SET utf8mb4`,
  // Obras inscritas desde el sitio («Inscribe tu obra»); se revisan en el gestor
  `CREATE TABLE IF NOT EXISTS cms_submissions(
    id CHAR(24) PRIMARY KEY, data TEXT NOT NULL, status VARCHAR(20) NOT NULL, created_at DATETIME NOT NULL, INDEX(created_at)
  ) CHARACTER SET utf8mb4`
];

async function mysqlStore(){
  const mysql=(await import('mysql2/promise')).default;
  const pool=mysql.createPool({
    host:process.env.DB_HOST||'localhost', port:Number(process.env.DB_PORT||3306),
    user:process.env.DB_USER, password:process.env.DB_PASSWORD, database:process.env.DB_NAME,
    connectionLimit:5, charset:'utf8mb4', dateStrings:false
  });
  for(const sql of TABLES)await pool.query(sql);
  // Las cuentas eliminadas no se borran: quedan marcadas con la fecha en que se eliminaron
  await pool.query('ALTER TABLE cms_users ADD COLUMN deleted_at DATETIME NULL').catch(err=>{if(err.code!=='ER_DUP_FIELDNAME')throw err});
  const one=async(sql,args)=>(await pool.query(sql,args))[0][0]||null;
  return {
    kind:'mysql',
    countUsers:async()=>(await one('SELECT COUNT(*) AS n FROM cms_users WHERE deleted_at IS NULL')).n,
    listUsers:async()=>(await pool.query('SELECT id,name,username,created_at AS createdAt FROM cms_users WHERE deleted_at IS NULL ORDER BY created_at'))[0],
    userByName:username=>one('SELECT * FROM cms_users WHERE username=? AND deleted_at IS NULL',[username]),
    userById:id=>one('SELECT * FROM cms_users WHERE id=? AND deleted_at IS NULL',[id]),
    insertUser:u=>pool.query('INSERT INTO cms_users(id,name,username,salt,hash,created_at) VALUES(?,?,?,?,?,?)',[u.id,u.name,u.username,u.salt,u.hash,new Date()]),
    setPassword:(id,salt,hash)=>pool.query('UPDATE cms_users SET salt=?,hash=? WHERE id=?',[salt,hash,id]),
    updateUser:(id,name,username)=>pool.query('UPDATE cms_users SET name=?,username=? WHERE id=?',[name,username,id]),
    deleteUser:async id=>{await pool.query('DELETE FROM cms_sessions WHERE user_id=?',[id]);
      // El usuario queda libre para una cuenta nueva; la eliminada conserva el original en su nombre de usuario
      await pool.query("UPDATE cms_users SET deleted_at=?,username=CONCAT(LEFT(username,90),'~eliminada~',id) WHERE id=?",[new Date(),id])},
    deletedUsers:async()=>(await pool.query('SELECT id,name,username,deleted_at AS deletedAt FROM cms_users WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC'))[0].map(u=>({...u,username:originalUsername(u.username),deletedAt:new Date(u.deletedAt).toISOString()})),
    deletedUserById:async id=>{const u=await one('SELECT * FROM cms_users WHERE id=? AND deleted_at IS NOT NULL',[id]);return u&&{...u,username:originalUsername(u.username)}},
    restoreUser:(id,username)=>pool.query('UPDATE cms_users SET deleted_at=NULL,username=? WHERE id=?',[username,id]),
    tutorials:async userId=>(await pool.query('SELECT screen FROM cms_tutorials WHERE user_id=?',[userId]))[0].map(r=>r.screen),
    markTutorial:(userId,view)=>pool.query('INSERT IGNORE INTO cms_tutorials(user_id,screen,seen_at) VALUES(?,?,?)',[userId,view,new Date()]),
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
      const prev=await one('SELECT data,version,updated_at,updated_by FROM cms_content WHERE id=1 AND version=?',[baseVersion]);
      if(!prev)return null;
      // Antes de reemplazarla, la versión actual pasa al historial
      await pool.query('INSERT IGNORE INTO cms_content_history(version,data,records,saved_at,saved_by) VALUES(?,?,?,?,?)',
        [prev.version,zlib.gzipSync(prev.data),recordCount(prev.data),prev.updated_at,prev.updated_by]);
      const [r]=await pool.query('UPDATE cms_content SET data=?,version=version+1,updated_at=?,updated_by=? WHERE id=1 AND version=?',[json,now,userId,baseVersion]);
      return r.affectedRows?baseVersion+1:null;
    },
    history:async()=>(await pool.query('SELECT h.version,h.records,h.saved_at AS savedAt,u.name AS savedBy FROM cms_content_history h LEFT JOIN cms_users u ON u.id=h.saved_by ORDER BY h.version DESC LIMIT 1000'))[0]
      .map(r=>({...r,savedAt:new Date(r.savedAt).toISOString()})),
    historyVersion:async version=>{const r=await one('SELECT data FROM cms_content_history WHERE version=?',[version]);return r&&JSON.parse(zlib.gunzipSync(r.data).toString('utf8'))},
    // Los trozos van primero: la fila de cms_media aparece solo cuando el archivo está completo
    putMedia:async(id,mime,buf)=>{
      if(buf.length<=CHUNK)return pool.query('INSERT IGNORE INTO cms_media(id,mime,size,data,created_at) VALUES(?,?,?,?,?)',[id,mime,buf.length,buf,new Date()]);
      for(let n=0;n*CHUNK<buf.length;n++)await pool.query('REPLACE INTO cms_media_chunks(id,n,data) VALUES(?,?,?)',[id,n,buf.subarray(n*CHUNK,(n+1)*CHUNK)]);
      await pool.query('INSERT IGNORE INTO cms_media(id,mime,size,data,created_at) VALUES(?,?,?,?,?)',[id,mime,buf.length,Buffer.alloc(0),new Date()]);
    },
    hasMedia:async id=>!!await one('SELECT 1 AS ok FROM cms_media WHERE id=?',[id]),
    media:async id=>{
      const m=await one('SELECT mime,size,data FROM cms_media WHERE id=?',[id]);
      if(!m)return null;
      if(m.data.length||!m.size)return {mime:m.mime,data:m.data};
      const [rows]=await pool.query('SELECT data FROM cms_media_chunks WHERE id=? ORDER BY n',[id]);
      return {mime:m.mime,data:Buffer.concat(rows.map(r=>r.data))};
    },
    addSubmission:(id,data)=>pool.query('INSERT INTO cms_submissions(id,data,status,created_at) VALUES(?,?,?,?)',[id,JSON.stringify(data),'nueva',new Date()]),
    submissions:async()=>(await pool.query(`SELECT id,data,status,created_at AS createdAt FROM cms_submissions WHERE status<>'eliminada' ORDER BY created_at DESC`))[0].map(r=>({id:r.id,status:r.status,createdAt:new Date(r.createdAt).toISOString(),...JSON.parse(r.data)})),
    deletedSubmissions:async()=>(await pool.query(`SELECT id,data,status,created_at AS createdAt FROM cms_submissions WHERE status='eliminada' ORDER BY created_at DESC`))[0].map(r=>({id:r.id,status:r.status,createdAt:new Date(r.createdAt).toISOString(),...JSON.parse(r.data)})),
    setSubmissionStatus:(id,status)=>pool.query('UPDATE cms_submissions SET status=? WHERE id=?',[status,id]),
    // Una inscripción eliminada desaparece del gestor pero sigue en la base de datos
    deleteSubmission:id=>pool.query("UPDATE cms_submissions SET status='eliminada' WHERE id=?",[id])
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
    countUsers:async()=>(await read('users',[])).filter(u=>!u.deletedAt).length,
    listUsers:async()=>(await read('users',[])).filter(u=>!u.deletedAt).map(({id,name,username,createdAt})=>({id,name,username,createdAt})),
    userByName:async username=>(await read('users',[])).find(u=>u.username===username&&!u.deletedAt)||null,
    userById:async id=>(await read('users',[])).find(u=>u.id===id&&!u.deletedAt)||null,
    insertUser:async u=>write('users',[...await read('users',[]),{...u,createdAt:new Date().toISOString()}]),
    setPassword:async(id,salt,hash)=>write('users',(await read('users',[])).map(u=>u.id===id?{...u,salt,hash}:u)),
    updateUser:async(id,name,username)=>write('users',(await read('users',[])).map(u=>u.id===id?{...u,name,username}:u)),
    deleteUser:async id=>{await write('sessions',(await read('sessions',[])).filter(x=>x.user_id!==id));await write('users',(await read('users',[])).map(u=>u.id===id?{...u,deletedAt:new Date().toISOString(),username:`${u.username.slice(0,90)}~eliminada~${u.id}`}:u))},
    deletedUsers:async()=>(await read('users',[])).filter(u=>u.deletedAt).map(({id,name,username,deletedAt})=>({id,name,username:originalUsername(username),deletedAt})),
    deletedUserById:async id=>{const u=(await read('users',[])).find(u=>u.id===id&&u.deletedAt);return u&&{...u,username:originalUsername(u.username)}},
    restoreUser:async(id,username)=>write('users',(await read('users',[])).map(u=>{if(u.id!==id)return u;const {deletedAt,...rest}=u;return {...rest,username}})),
    tutorials:async userId=>(await read('tutorials',{}))[userId]||[],
    markTutorial:async(userId,view)=>{const t=await read('tutorials',{}), seen=t[userId]||[];if(!seen.includes(view))await write('tutorials',{...t,[userId]:[...seen,view]})},
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
      if(cur){await fs.mkdir(path.join(dir,'history'),{recursive:true});await fs.writeFile(path.join(dir,'history',`${cur.version}.json`),JSON.stringify(cur))}
      await write('content',{data,version,updatedAt:new Date().toISOString(),updatedBy:userId});
      return version;
    },
    history:async()=>{
      const files=await fs.readdir(path.join(dir,'history')).catch(()=>[]), users=await read('users',[]), list=[];
      for(const f of files){const h=JSON.parse(await fs.readFile(path.join(dir,'history',f),'utf8'));list.push({version:h.version,records:(h.data.records||[]).length,savedAt:h.updatedAt,savedBy:users.find(u=>u.id===h.updatedBy)?.name||null})}
      return list.sort((a,b)=>b.version-a.version);
    },
    historyVersion:async version=>{try{return JSON.parse(await fs.readFile(path.join(dir,'history',`${Number(version)}.json`),'utf8')).data}catch{return null}},
    putMedia:async(id,mime,buf)=>{await fs.writeFile(path.join(dir,'media',id),buf);await write(`media-${id}`,{mime})},
    hasMedia:async id=>{try{await fs.access(path.join(dir,'media',id));return true}catch{return false}},
    media:async id=>{try{const {mime}=await read(`media-${id}`,{});return {mime,data:await fs.readFile(path.join(dir,'media',id))}}catch{return null}},
    addSubmission:async(id,data)=>write('submissions',[{id,status:'nueva',createdAt:new Date().toISOString(),...data},...await read('submissions',[])]),
    submissions:async()=>(await read('submissions',[])).filter(x=>x.status!=='eliminada'),
    deletedSubmissions:async()=>(await read('submissions',[])).filter(x=>x.status==='eliminada'),
    setSubmissionStatus:async(id,status)=>write('submissions',(await read('submissions',[])).map(x=>x.id===id?{...x,status}:x)),
    deleteSubmission:async id=>write('submissions',(await read('submissions',[])).map(x=>x.id===id?{...x,status:'eliminada'}:x))
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
