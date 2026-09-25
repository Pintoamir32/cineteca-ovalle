// Punto de entrada que usa Hostinger (Archivo de entrada: server.js). El servidor está en server/.
// Hostinger (LiteSpeed) carga este archivo con require(), que no admite «await» de nivel superior;
// por eso el servidor se carga con import() dinámico.
import('./server/index.js').catch(err=>{
  console.error('[cineteca] no se pudo iniciar el servidor',err);
  process.exit(1);
});
