// Colores libres elegidos en el gestor: el texto encima pasa a blanco si el fondo es oscuro
export const isHex=v=>/^#[0-9a-f]{6}$/i.test(String(v||''));

export function luminance(hex){
  if(!isHex(hex))return 1;
  const [r,g,b]=[1,3,5].map(i=>{const c=parseInt(hex.slice(i,i+2),16)/255;return c<=.03928?c/12.92:((c+.055)/1.055)**2.4});
  return .2126*r+.7152*g+.0722*b;
}

// Blanco solo cuando contrasta más que el negro (fondo con luminancia bajo ~0,18)
export const inkOn=bg=>luminance(bg)<.179?'#ffffff':undefined;

export const tagStyle=bg=>({background:bg,color:inkOn(bg)});
