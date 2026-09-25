import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, LogIn, UserPlus } from 'lucide-react';
import { login, passwordProblem, setupAccount } from './auth';
import { LogoMark } from '../Logo';

// Campo de contraseña con botón para mostrarla
export function PasswordField({label,value,onChange,autoComplete,autoFocus,hint}){
  const [show,setShow]=useState(false);
  return <label className="login-field"><span>{label}</span>
    <div className="login-pass">
      <input type={show?'text':'password'} value={value} onChange={e=>onChange(e.target.value)} autoComplete={autoComplete} autoFocus={autoFocus} required/>
      <button type="button" onClick={()=>setShow(!show)} aria-label={show?'Ocultar contraseña':'Mostrar contraseña'} title={show?'Ocultar':'Mostrar'}>{show?<EyeOff/>:<Eye/>}</button>
    </div>
    {hint&&<small>{hint}</small>}
  </label>;
}

/* Sin cuentas: se crea la de administración. Con cuentas: inicio de sesión. */
// setup: todavía no hay cuentas en el servidor
export function LoginScreen({setup,expired,onLogin}){
  const [name,setName]=useState(''), [user,setUser]=useState(''), [pass,setPass]=useState(''), [pass2,setPass2]=useState('');
  const [remember,setRemember]=useState(false), [error,setError]=useState(''), [busy,setBusy]=useState(false);
  useEffect(()=>{document.title=setup?'Crear cuenta · Gestión':'Iniciar sesión · Gestión'},[setup]);

  const submit=async e=>{
    e.preventDefault();if(busy)return;
    setError('');setBusy(true);
    try{
      if(setup){
        if(pass!==pass2)throw new Error('Las contraseñas no coinciden.');
        onLogin(await setupAccount({name,user,password:pass,remember}));
      }else{
        onLogin(await login(user,pass,remember));
      }
    }catch(err){setError(err.message);setBusy(false)}
  };

  return <div className="login">
    <div className="login-card">
      <div className="login-brand"><LogoMark/><small>Gestión</small></div>
      <h1>{setup?'Crea tu cuenta':'Iniciar sesión'}</h1>
      {expired&&<p className="login-error" role="status">Tu sesión terminó. Vuelve a iniciar sesión para seguir editando.</p>}
      <p className="login-lead">{setup?'Todavía no hay cuentas. Crea la cuenta de administración: con ella podrás crear otras para quienes editen el sitio.':'Entra para editar el contenido del sitio.'}</p>
      <form onSubmit={submit} noValidate>
        {setup&&<label className="login-field"><span>Tu nombre</span><input value={name} onChange={e=>setName(e.target.value)} autoComplete="name" autoFocus required/></label>}
        <label className="login-field"><span>Usuario</span><input value={user} onChange={e=>setUser(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus={!setup} required/>{setup&&<small>Sin espacios. Por ejemplo: archivo o tu correo.</small>}</label>
        <PasswordField label="Contraseña" value={pass} onChange={setPass} autoComplete={setup?'new-password':'current-password'} hint={setup?(passwordProblem(pass)&&pass?passwordProblem(pass):'Al menos 8 caracteres.'):undefined}/>
        {setup&&<PasswordField label="Repite la contraseña" value={pass2} onChange={setPass2} autoComplete="new-password"/>}
        <label className="login-check"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/><span>Mantener la sesión iniciada en este computador</span></label>
        {error&&<p className="login-error" role="alert">{error}</p>}
        <button type="submit" className="login-submit" disabled={busy}>{setup?<><UserPlus/> {busy?'Creando…':'Crear cuenta y entrar'}</>:<><LogIn/> {busy?'Entrando…':'Entrar'}</>}</button>
      </form>
      <p className="login-note">{setup?'Guarda bien tu contraseña. Si otra persona olvida la suya, puedes crearle una cuenta nueva desde «Mi cuenta».':'¿Olvidaste la contraseña? Pide a otra persona con cuenta que te cree una nueva desde «Mi cuenta».'}</p>
    </div>
    <a className="login-site" href="/">← Volver al sitio</a>
  </div>;
}
