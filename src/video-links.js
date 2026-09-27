/* Enlaces de películas: convierte lo que se pega en el gestor (YouTube, Vimeo, Google Drive, OneDrive,
   Dropbox, Internet Archive o un enlace directo) en algo que se pueda reproducir dentro de la ficha.
   Devuelve {kind:'iframe'|'video'|'link', src, provider} o null si no hay enlace. */

// «1h2m3s», «90s» o «90» → segundos
function seconds(t){
  if(!t)return 0;
  if(/^\d+$/.test(t))return Number(t);
  const m=String(t).match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
  return m?(Number(m[1]||0)*3600+Number(m[2]||0)*60+Number(m[3]||0)):0;
}

// Enlace para compartir de OneDrive → dirección del archivo (API pública de OneDrive)
const oneDriveFile=url=>`https://api.onedrive.com/v1.0/shares/u!${btoa(unescape(encodeURIComponent(url))).replace(/=+$/,'').replace(/\//g,'_').replace(/\+/g,'-')}/root/content`;

export function videoSource(raw){
  const s=String(raw||'').trim();
  if(!s)return null;
  // Archivos subidos al propio sitio
  if(s.startsWith('data:')||s.startsWith('/'))return {kind:'video',src:s,provider:'Archivo del sitio'};
  let u;
  try{u=new URL(s)}catch{return null}
  if(!/^https?:$/.test(u.protocol))return null;
  const host=u.hostname.replace(/^(www|m)\./,'');

  // YouTube: watch?v=, youtu.be/, shorts/, live/, embed/
  let yt=null;
  if(host==='youtu.be')yt=u.pathname.slice(1).split('/')[0];
  else if(/(^|\.)youtube(-nocookie)?\.com$/.test(host))yt=u.searchParams.get('v')||(u.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{6,})/)||[])[1];
  if(yt){
    const start=seconds(u.searchParams.get('t')||u.searchParams.get('start'));
    return {kind:'iframe',provider:'YouTube',src:`https://www.youtube-nocookie.com/embed/${yt}?rel=0${start?`&start=${start}`:''}`};
  }

  // Vimeo, incluidos los videos privados con clave (vimeo.com/123/abc o ?h=abc)
  if(host==='vimeo.com'||host==='player.vimeo.com'){
    const m=u.pathname.match(/^(?:\/video)?\/(\d+)(?:\/([\da-f]+))?/);
    if(m){const h=m[2]||u.searchParams.get('h');return {kind:'iframe',provider:'Vimeo',src:`https://player.vimeo.com/video/${m[1]}${h?`?h=${h}`:''}`}}
  }

  // Google Drive: /file/d/ID/… o ?id=ID (el archivo debe estar compartido con «cualquier persona con el enlace»)
  if(host==='drive.google.com'){
    const id=(u.pathname.match(/\/file\/d\/([\w-]+)/)||[])[1]||u.searchParams.get('id');
    if(id)return {kind:'iframe',provider:'Google Drive',src:`https://drive.google.com/file/d/${id}/preview`};
  }

  // OneDrive: el código «Insertar» se usa tal cual; un enlace para compartir se reproduce como archivo
  if(host==='onedrive.live.com'&&u.pathname.startsWith('/embed'))return {kind:'iframe',provider:'OneDrive',src:s};
  if(host==='1drv.ms'||host==='onedrive.live.com')return {kind:'video',provider:'OneDrive',src:oneDriveFile(s)};
  if(host.endsWith('sharepoint.com')){u.searchParams.set('download','1');return {kind:'video',provider:'OneDrive',src:u.toString()}}

  // Dropbox: ?raw=1 entrega el archivo en vez de la página
  if(host==='dropbox.com'||host==='dl.dropboxusercontent.com'){u.searchParams.delete('dl');u.searchParams.set('raw','1');return {kind:'video',provider:'Dropbox',src:u.toString()}}

  // Dailymotion
  if(host==='dailymotion.com'||host==='dai.ly'){const id=host==='dai.ly'?u.pathname.slice(1):(u.pathname.match(/\/video\/([\w]+)/)||[])[1];if(id)return {kind:'iframe',provider:'Dailymotion',src:`https://www.dailymotion.com/embed/video/${id}`}}

  // Internet Archive
  if(host==='archive.org'){const m=u.pathname.match(/^\/(?:details|embed)\/([^/?#]+)/);if(m)return {kind:'iframe',provider:'Internet Archive',src:`https://archive.org/embed/${m[1]}`}}

  // Enlace directo a un archivo de video
  if(/\.(mp4|webm|ogv|mov|m4v)$/i.test(u.pathname))return {kind:'video',provider:'Enlace directo',src:s};

  // Cualquier otra página: se ofrece abrirla en otra pestaña
  return {kind:'link',provider:host,src:s};
}

export const VIDEO_SERVICES='YouTube, Vimeo, Google Drive, OneDrive, Dropbox, Internet Archive o un enlace directo a un .mp4';
