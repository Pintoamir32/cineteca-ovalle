import React, { useEffect, useState } from 'react';
import { KeyRound, Pencil, Plus, Search, Trash2, UserPlus, X } from 'lucide-react';
import { PageHead } from './AdminApp';
import { createUser, deleteUser, listUsers, passwordProblem, resetUserPassword, updateUser } from './auth';
import { Modal, useUi } from './fields';
import { PasswordField } from './Login';

const initials=name=>String(name||'?').split(/\s+/).filter(Boolean).map(w=>w[0]).slice(0,2).join('').toUpperCase();
const fmtDate=d=>d?new Date(d).toLocaleDateString('es-CL',{day:'numeric',month:'short',year:'numeric'}):'—';

/* ---------- Mantenedor de usuarios del gestor ---------- */

export function UsersPage({session}){
  const {toast,confirm}=useUi();
  const [users,setUsers]=useState(null), [error,setError]=useState(''), [q,setQ]=useState('');
  const [dialog,setDialog]=useState(null);// {mode:'new'|'edit'|'password', user}
  const load=()=>listUsers().then(setUsers).catch(err=>setError(err.message));
  useEffect(()=>{load()},[]);

  const remove=async u=>{
    if(!await confirm({title:`¿Eliminar la cuenta de ${u.name}?`,text:`«${u.user}» ya no podrá entrar al gestor y se cerrarán sus sesiones abiertas. El contenido que editó se mantiene.`,ok:'Eliminar cuenta',danger:true}))return;
    try{await deleteUser(u.id);toast(`Cuenta de ${u.name} eliminada.`);load()}catch(err){toast(err.message,'error')}
  };
  const fold=s=>String(s).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
  const shown=(users||[]).filter(u=>fold(`${u.name} ${u.user}`).includes(fold(q)));

  return <div className="cms-page">
    <PageHead eyebrow="SISTEMA" title="Usuarios" desc="Las personas que pueden entrar al gestor y editar el sitio.">
      <button type="button" className="cms-btn is-primary" onClick={()=>setDialog({mode:'new'})}><UserPlus/> Nuevo usuario</button>
    </PageHead>
    {error&&<p className="login-error">{error}</p>}
    {users&&<>
      <div className="cms-toolbar">
        <label className="cms-search"><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar por nombre o usuario…"/>{q&&<button type="button" onClick={()=>setQ('')} aria-label="Limpiar"><X/></button>}</label>
        <span className="cms-users-count">{users.length} {users.length===1?'cuenta':'cuentas'}</span>
      </div>
      <div className="cms-table-wrap">
        <table className="cms-table">
          <thead><tr><th>Persona</th><th>Usuario</th><th>Creada</th><th className="is-actions">Acciones</th></tr></thead>
          <tbody>{shown.map(u=><tr key={u.id}>
            <td><span className="cms-user-cell"><span className="cms-avatar">{initials(u.name)}</span><strong>{u.name}</strong>{u.id===session.id&&<em className="cms-you">Tú</em>}</span></td>
            <td className="is-mono">{u.user}</td>
            <td>{fmtDate(u.createdAt)}</td>
            <td className="is-actions">
              <button type="button" className="cms-icon-btn" onClick={()=>setDialog({mode:'edit',user:u})} title="Editar nombre y usuario" aria-label={`Editar ${u.name}`}><Pencil/></button>
              <button type="button" className="cms-icon-btn" onClick={()=>setDialog({mode:'password',user:u})} title="Restablecer contraseña" aria-label={`Restablecer contraseña de ${u.name}`}><KeyRound/></button>
              <button type="button" className="cms-icon-btn is-danger-text" disabled={u.id===session.id||users.length<=1} onClick={()=>remove(u)} title={u.id===session.id?'No puedes eliminar tu propia cuenta':'Eliminar cuenta'} aria-label={`Eliminar ${u.name}`}><Trash2/></button>
            </td>
          </tr>)}</tbody>
        </table>
        {!shown.length&&<p className="cms-empty">No hay cuentas que coincidan.</p>}
      </div>
      <p className="cms-help">Para cambiar tu propia contraseña usa «Mi cuenta», abajo en el menú. Cada persona ve su propio tutorial la primera vez que entra.</p>
    </>}
    {!users&&!error&&<p className="cms-help">Cargando…</p>}
    {dialog&&<UserDialog {...dialog} onClose={()=>setDialog(null)} onDone={msg=>{setDialog(null);toast(msg);load()}}/>}
  </div>;
}

// Crear, editar o restablecer contraseña
function UserDialog({mode,user,onClose,onDone}){
  const [name,setName]=useState(user?.name||''), [login,setLogin]=useState(user?.user||'');
  const [pass,setPass]=useState(''), [pass2,setPass2]=useState('');
  const [error,setError]=useState(''), [busy,setBusy]=useState(false);
  const title={new:'Nuevo usuario',edit:`Editar a ${user?.name}`,password:`Nueva contraseña para ${user?.name}`}[mode];
  const submit=async e=>{
    e.preventDefault();setError('');setBusy(true);
    try{
      if(mode!=='edit'){
        if(pass!==pass2)throw new Error('Las contraseñas no coinciden.');
        const p=passwordProblem(pass);if(p)throw new Error(p);
      }
      if(mode==='new'){const u=await createUser({name,user:login,password:pass});onDone(`Cuenta creada para ${u.name}. Ya puede entrar con el usuario «${u.user}».`)}
      if(mode==='edit'){await updateUser(user.id,{name,user:login});onDone('Cambios guardados.')}
      if(mode==='password'){await resetUserPassword(user.id,pass);onDone(`Contraseña de ${user.name} cambiada. Sus sesiones abiertas se cerraron.`)}
    }catch(err){setError(err.message);setBusy(false)}
  };
  return <Modal title={title} onClose={onClose} className="cms-account">
    <form className="cms-account-form" onSubmit={submit} noValidate>
      {mode!=='password'&&<>
        <label className="login-field"><span>Nombre</span><input value={name} onChange={e=>setName(e.target.value)} autoFocus required/></label>
        <label className="login-field"><span>Usuario</span><input value={login} onChange={e=>setLogin(e.target.value)} autoCapitalize="none" spellCheck={false} required/><small>Sin espacios. Con esto inicia sesión.</small></label>
      </>}
      {mode!=='edit'&&<>
        {mode==='password'&&<p className="cms-help">Escribe una contraseña nueva y dásela a {user.name}. Después podrá cambiarla desde «Mi cuenta».</p>}
        <PasswordField label={mode==='new'?'Contraseña inicial':'Contraseña nueva'} value={pass} onChange={setPass} autoComplete="new-password" autoFocus={mode==='password'} hint="Al menos 8 caracteres."/>
        <PasswordField label="Repite la contraseña" value={pass2} onChange={setPass2} autoComplete="new-password"/>
      </>}
      {error&&<p className="login-error" role="alert">{error}</p>}
      <div className="cms-modal-actions">
        <button type="button" className="cms-btn" onClick={onClose}>Cancelar</button>
        <button type="submit" className="cms-btn is-primary" disabled={busy}>{mode==='new'?<><Plus/> Crear cuenta</>:mode==='edit'?'Guardar':'Cambiar contraseña'}</button>
      </div>
    </form>
  </Modal>;
}
