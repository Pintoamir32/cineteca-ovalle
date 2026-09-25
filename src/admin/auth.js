/* Cuentas del gestor.
   Sin servidor todavía: las cuentas viven en este navegador y la contraseña se guarda
   solo como huella (PBKDF2 + sal), nunca en texto. Evita el acceso casual al gestor;
   la protección real llegará cuando el contenido se guarde en un servidor. */

const USERS_KEY='cms-cuentas', SESSION_KEY='cms-sesion';
const ITERATIONS=150000;

const store={
  get:(area,key)=>{try{return JSON.parse(area.getItem(key)||'null')}catch{return null}},
  set:(area,key,value)=>{try{area.setItem(key,JSON.stringify(value));return true}catch{return false}},
  del:(area,key)=>{try{area.removeItem(key)}catch{/* nada que borrar */}}
};
const hex=buf=>[...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
const normUser=u=>String(u||'').trim().toLowerCase();

async function derive(password,salt){
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode(salt),iterations:ITERATIONS},key,256);
  return hex(bits);
}

export const getUsers=()=>store.get(localStorage,USERS_KEY)||[];
export const hasUsers=()=>getUsers().length>0;
const publicUser=u=>u&&{id:u.id,name:u.name,user:u.user};

export function passwordProblem(pw){
  if(String(pw).length<8)return 'La contraseña debe tener al menos 8 caracteres.';
  return null;
}

export async function createUser({name,user,password}){
  const users=getUsers(), u=normUser(user);
  if(!String(name).trim())throw new Error('Escribe tu nombre.');
  if(!/^[a-z0-9._@-]{3,}$/.test(u))throw new Error('El usuario debe tener al menos 3 caracteres, sin espacios.');
  if(users.some(x=>x.user===u))throw new Error('Ya existe una cuenta con ese usuario.');
  const problem=passwordProblem(password);if(problem)throw new Error(problem);
  const salt=hex(crypto.getRandomValues(new Uint8Array(16)));
  const account={id:hex(crypto.getRandomValues(new Uint8Array(8))),name:String(name).trim(),user:u,salt,hash:await derive(password,salt),createdAt:new Date().toISOString()};
  if(!store.set(localStorage,USERS_KEY,[...users,account]))throw new Error('No se pudo guardar la cuenta en este navegador.');
  return publicUser(account);
}

export async function checkPassword(user,password){
  const account=getUsers().find(x=>x.user===normUser(user));
  // Se calcula igual aunque el usuario no exista, para no delatar cuáles existen
  const hash=await derive(password,account?.salt||'sin-cuenta');
  return account&&hash===account.hash?account:null;
}

export async function changePassword(id,current,next){
  const users=getUsers(), account=users.find(x=>x.id===id);
  if(!account||await derive(current,account.salt)!==account.hash)throw new Error('La contraseña actual no es correcta.');
  const problem=passwordProblem(next);if(problem)throw new Error(problem);
  const salt=hex(crypto.getRandomValues(new Uint8Array(16)));
  const updated={...account,salt,hash:await derive(next,salt)};
  store.set(localStorage,USERS_KEY,users.map(x=>x.id===id?updated:x));
}

/* ---------- Sesión ---------- */

// «Mantener la sesión iniciada» la guarda en este navegador; si no, dura hasta cerrar la pestaña
export function startSession(account,remember){
  const session={...publicUser(account),since:new Date().toISOString()};
  store.del(localStorage,SESSION_KEY);store.del(sessionStorage,SESSION_KEY);
  store.set(remember?localStorage:sessionStorage,SESSION_KEY,session);
  return session;
}

export function currentSession(){
  const s=store.get(sessionStorage,SESSION_KEY)||store.get(localStorage,SESSION_KEY);
  // La cuenta pudo borrarse: la sesión deja de valer
  return s&&getUsers().some(u=>u.id===s.id)?s:null;
}

export function endSession(){
  store.del(localStorage,SESSION_KEY);store.del(sessionStorage,SESSION_KEY);
}
