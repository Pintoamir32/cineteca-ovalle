/* Cuentas del gestor: viven en el servidor (base de datos).
   La contraseña nunca se guarda en el navegador; la sesión es una cookie segura
   que el navegador no puede leer. */

async function call(url,body,method=body?'POST':'GET'){
  const res=await fetch(url,{method,credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(data.error||'No se pudo conectar con el servidor. Revisa tu conexión.');
  return data;
}

export const passwordProblem=pw=>String(pw).length<8?'La contraseña debe tener al menos 8 caracteres.':null;

// ¿Hay cuentas creadas? ¿Hay una sesión abierta?
export const authStatus=()=>call('/api/auth/status');
export const setupAccount=({name,user,password,remember})=>call('/api/auth/setup',{name,user,password,remember}).then(r=>r.user);
export const login=(user,password,remember)=>call('/api/auth/login',{user,password,remember}).then(r=>r.user);
export const logout=()=>call('/api/auth/logout',{}).catch(()=>{});
export const changePassword=(current,next)=>call('/api/auth/password',{current,next});
export const listUsers=()=>call('/api/users').then(r=>r.users);
export const createUser=({name,user,password})=>call('/api/users',{name,user,password}).then(r=>r.user);
