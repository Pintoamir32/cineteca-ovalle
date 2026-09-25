/* Servidor de la Cineteca: entrega el sitio y la API del gestor (cuentas, contenido e imágenes).
   En desarrollo (npm run dev) monta Vite para recargar al instante; en producción sirve dist/. */
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import express from 'express';
import { openStore } from './db.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// Producción por defecto (Hostinger ejecuta este archivo tal cual); «npm run dev» agrega --dev
const PROD=!process.argv.includes('--dev');
const PORT=Number(process.env.PORT||(PROD?3000:5173));
const COOKIE='cdo_sesion', LONG_SESSION=30*24*3600e3, SHORT_SESSION=12*3600e3;
const scrypt=promisify(crypto.scrypt);

const db=await openStore();
console.log(`[cineteca] almacenamiento: ${db.kind}`);

/* ---------- Contraseñas y sesiones ---------- */

const hashPassword=async(password,salt)=>(await scrypt(String(password),salt,64)).toString('hex');
const passwordProblem=pw=>String(pw||'').length<8?'La contraseña debe tener al menos 8 caracteres.':null;
const normUser=u=>String(u||'').trim().toLowerCase();
const publicUser=u=>u&&{id:u.id,name:u.name,user:u.username};

function readCookie(req,name){
  for(const part of String(req.headers.cookie||'').split(';')){
    const [k,...v]=part.trim().split('=');
    if(k===name)return decodeURIComponent(v.join('='));
  }
  return null;
}
function setSessionCookie(req,res,token,remember){
  const secure=req.secure||req.headers['x-forwarded-proto']==='https';
  res.setHeader('Set-Cookie',[`${COOKIE}=${token}`,'Path=/','HttpOnly','SameSite=Lax',...(secure?['Secure']:[]),...(remember?[`Max-Age=${LONG_SESSION/1000}`]:[])].join('; '));
}
const clearSessionCookie=res=>res.setHeader('Set-Cookie',`${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);

async function startSession(req,res,user,remember){
  const token=crypto.randomBytes(32).toString('hex');
  await db.createSession(token,user.id,new Date(Date.now()+(remember?LONG_SESSION:SHORT_SESSION)));
  setSessionCookie(req,res,token,remember);
  return token;
}

// Deja en req.user a quien inició sesión (o null)
async function sessionUser(req){
  const token=readCookie(req,COOKIE);
  if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
  const s=await db.session(token);
  if(!s)return null;
  const user=await db.userById(s.user_id);
  if(user)req.sessionToken=token;
  return user;
}
const needUser=async(req,res,next)=>{
  try{req.user=await sessionUser(req)}catch(err){return next(err)}
  if(!req.user)return res.status(401).json({error:'Tu sesión terminó. Vuelve a iniciar sesión.'});
  next();
};

// Intentos fallidos por dirección: frena a quien prueba contraseñas
const fails=new Map();
const tooMany=ip=>{const f=fails.get(ip);return f&&f.n>=8&&Date.now()-f.at<15*60e3};
const fail=ip=>{const f=fails.get(ip);fails.set(ip,{n:(f&&Date.now()-f.at<15*60e3?f.n:0)+1,at:Date.now()})};

/* ---------- API ---------- */

const app=express();
app.set('trust proxy',true);
app.disable('x-powered-by');
const api=express.Router();
api.use(express.json({limit:'25mb'}));
// Nada de la API se guarda en caché
api.use((req,res,next)=>{res.setHeader('Cache-Control','no-store');next()});

api.get('/auth/status',async(req,res)=>{
  const user=await sessionUser(req);
  res.json({hasUsers:(await db.countUsers())>0,user:publicUser(user)});
});

// La primera cuenta solo se puede crear mientras no exista ninguna
api.post('/auth/setup',async(req,res)=>{
  if((await db.countUsers())>0)return res.status(409).json({error:'Ya existe una cuenta. Inicia sesión.'});
  const user=await newUser(req.body);
  if(user.error)return res.status(400).json(user);
  await startSession(req,res,user,!!req.body.remember);
  res.json({user:publicUser(user)});
});

api.post('/auth/login',async(req,res)=>{
  const ip=req.ip;
  if(tooMany(ip))return res.status(429).json({error:'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'});
  const user=await db.userByName(normUser(req.body.user));
  // Se calcula igual aunque el usuario no exista, para no delatar cuáles existen
  const hash=await hashPassword(req.body.password,user?.salt||'sin-cuenta');
  if(!user||!crypto.timingSafeEqual(Buffer.from(hash,'hex'),Buffer.from(user.hash,'hex'))){
    fail(ip);return res.status(401).json({error:'Usuario o contraseña incorrectos.'});
  }
  fails.delete(ip);
  await startSession(req,res,user,!!req.body.remember);
  res.json({user:publicUser(user)});
});

api.post('/auth/logout',async(req,res)=>{
  const token=readCookie(req,COOKIE);
  if(token)await db.deleteSession(token);
  clearSessionCookie(res);res.json({ok:true});
});

api.post('/auth/password',needUser,async(req,res)=>{
  const {current,next}=req.body;
  if(await hashPassword(current,req.user.salt)!==req.user.hash)return res.status(400).json({error:'La contraseña actual no es correcta.'});
  const problem=passwordProblem(next);if(problem)return res.status(400).json({error:problem});
  const salt=crypto.randomBytes(16).toString('hex');
  await db.setPassword(req.user.id,salt,await hashPassword(next,salt));
  // Las demás sesiones abiertas de esta cuenta se cierran
  await db.deleteUserSessions(req.user.id,req.sessionToken);
  res.json({ok:true});
});

api.get('/users',needUser,async(req,res)=>res.json({users:(await db.listUsers()).map(u=>({id:u.id,name:u.name,user:u.username}))}));
api.post('/users',needUser,async(req,res)=>{
  const user=await newUser(req.body);
  if(user.error)return res.status(400).json(user);
  res.json({user:publicUser(user)});
});

async function newUser({name,user,password}){
  const username=normUser(user);
  if(!String(name||'').trim())return {error:'Escribe el nombre.'};
  if(!/^[a-z0-9._@-]{3,}$/.test(username))return {error:'El usuario debe tener al menos 3 caracteres, sin espacios.'};
  const problem=passwordProblem(password);if(problem)return {error:problem};
  if(await db.userByName(username))return {error:'Ya existe una cuenta con ese usuario.'};
  const salt=crypto.randomBytes(16).toString('hex');
  const u={id:crypto.randomBytes(8).toString('hex'),name:String(name).trim().slice(0,120),username,salt,hash:await hashPassword(password,salt)};
  await db.insertUser(u);
  return u;
}

/* Contenido: un solo documento con todo lo editable del sitio.
   Quien no inició sesión no recibe las fichas en borrador. */
api.get('/content',async(req,res)=>{
  const saved=await db.content();
  if(!saved)return res.json({data:null,version:0});
  const user=await sessionUser(req);
  let data=saved.data;
  if(!user&&Array.isArray(data.records)){
    const hidden=new Set(data.records.filter(r=>r.draft).map(r=>String(r.id)));
    data={...data,records:data.records.filter(r=>!r.draft),recordExtras:Object.fromEntries(Object.entries(data.recordExtras||{}).filter(([id])=>!hidden.has(id)))};
  }
  res.json({data,version:saved.version,updatedAt:saved.updatedAt});
});

api.put('/content',needUser,async(req,res)=>{
  const {data,baseVersion}=req.body||{};
  if(!data||typeof data!=='object'||!Array.isArray(data.records))return res.status(400).json({error:'Contenido no válido.'});
  const version=await db.saveContent(data,Number(baseVersion)||0,req.user.id);
  if(!version)return res.status(409).json({error:'Otra persona guardó cambios mientras editabas.'});
  res.json({version,updatedAt:new Date().toISOString()});
});

// Imágenes, audios, videos y documentos subidos desde el gestor
const MEDIA_TYPES=/^(image\/(jpeg|png|webp|gif|svg\+xml)|audio\/[a-z0-9.+-]+|video\/[a-z0-9.+-]+|application\/pdf)$/;
api.post('/media',needUser,express.raw({type:()=>true,limit:'40mb'}),async(req,res)=>{
  const mime=String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase();
  if(!MEDIA_TYPES.test(mime))return res.status(415).json({error:'Tipo de archivo no permitido.'});
  if(!req.body?.length)return res.status(400).json({error:'Archivo vacío.'});
  const id=crypto.createHash('sha256').update(req.body).digest('hex').slice(0,32);
  if(!await db.media(id))await db.putMedia(id,mime,req.body);
  res.json({url:`/api/media/${id}`});
});
app.get('/api/media/:id',async(req,res,next)=>{
  try{
    if(!/^[a-f0-9]{32}$/.test(req.params.id))return res.sendStatus(404);
    const m=await db.media(req.params.id);
    if(!m)return res.sendStatus(404);
    // El nombre es la huella del archivo: nunca cambia, se puede guardar en caché para siempre
    res.setHeader('Content-Type',m.mime);res.setHeader('Cache-Control','public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options','nosniff');
    // Un SVG subido no puede ejecutar código aunque se abra directo
    res.setHeader('Content-Security-Policy',"default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox");
    res.send(m.data);
  }catch(err){next(err)}
});

app.use('/api',api);
app.use('/api',(req,res)=>res.status(404).json({error:'No existe.'}));
app.use('/api',(err,req,res,next)=>{// eslint-disable-line no-unused-vars
  console.error('[cineteca] error en la API',err);
  res.status(err.status||500).json({error:err.type==='entity.too.large'?'El archivo es demasiado grande.':'Error en el servidor. Inténtalo de nuevo.'});
});

/* ---------- Sitio ---------- */

if(PROD){
  const dist=path.join(ROOT,'dist');
  // Un archivo de assets/ que no existe es un 404 (no la página), para que el navegador no lo guarde por error
  app.use('/assets',express.static(path.join(dist,'assets'),{immutable:true,maxAge:'1y',fallthrough:false}));
  app.use(express.static(dist,{index:false,maxAge:0}));
  // La app maneja sus propias rutas (/peliculas, /ficha/12, /admin…)
  app.get('/{*ruta}',(req,res)=>{res.setHeader('Cache-Control','no-cache');res.sendFile(path.join(dist,'index.html'))});
}else{
  const {createServer}=await import('vite');
  const vite=await createServer({root:ROOT,server:{middlewareMode:true},appType:'spa'});
  app.use(vite.middlewares);
}

app.listen(PORT,()=>console.log(`[cineteca] listo en http://localhost:${PORT}`));
setInterval(()=>db.purgeSessions().catch(()=>{}),6*3600e3).unref();
