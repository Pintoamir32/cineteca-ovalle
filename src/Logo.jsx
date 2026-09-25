// Logo de la Cineteca en dos capas (public/logo-cineteca-*.png, tinta sobre fondo transparente) usadas
// como máscaras: ornamentos en el acento del tema y nombre en currentColor, para fondos claros u oscuros.
export function LogoMark({className='',title='Cineteca de Ovalle, desde 1968'}){
  return <span className={`logo-mark ${className}`} role="img" aria-label={title}/>;
}
