import React from 'react';
import { Link } from 'react-router-dom';
import { useSiteText } from './site-text';

// Aviso legal: derechos sobre el archivo, uso de los contenidos y privacidad del sitio
export function LegalPage(){
  const email=useSiteText().content.footerEmail;
  return <main className="legal-page">
    <section className="legal-hero">
      <span>INFORMACIÓN LEGAL</span>
      <h1>Aviso legal</h1>
      <p>Condiciones de uso del sitio y del archivo digital de la Cineteca de Ovalle.</p>
    </section>
    <article className="legal-body">
      <section>
        <h2>1. Titularidad del sitio</h2>
        <p>Este sitio es el archivo digital de la Cineteca de Ovalle (Ovalle, Región de Coquimbo, Chile). Para cualquier consulta puedes escribir a <a href={`mailto:${email}`}>{email}</a>.</p>
      </section>
      <section>
        <h2>2. Derechos sobre los contenidos</h2>
        <p>Las películas, fotografías, documentos de prensa, entrevistas y textos del archivo pertenecen a sus autoras, autores o titulares de derechos, y se publican con fines de preservación, investigación y difusión del patrimonio audiovisual. El diseño, los textos propios y la organización del sitio pertenecen a la Cineteca de Ovalle.</p>
        <p>Salvo que una ficha indique otra cosa, los contenidos no pueden reproducirse, distribuirse ni usarse con fines comerciales sin autorización de sus titulares.</p>
      </section>
      <section>
        <h2>3. Uso permitido</h2>
        <p>Puedes consultar el archivo libremente y citar sus contenidos con fines educativos, de investigación o periodísticos, indicando la fuente: «Archivo digital de la Cineteca de Ovalle» y el enlace a la ficha correspondiente.</p>
        <p>Si eres titular de derechos sobre algún material y quieres que se corrija, se complete su información o se retire, escríbenos y lo revisaremos a la brevedad.</p>
      </section>
      <section>
        <h2>4. Privacidad</h2>
        <p>El sitio público no pide datos personales, no usa cookies propias ni herramientas de analítica o publicidad. La única cookie del sitio es la de inicio de sesión del gestor, que solo usa el equipo de la Cineteca.</p>
        <p>Algunas páginas cargan servicios de terceros que pueden registrar tu visita según sus propias políticas: las tipografías de Google Fonts, los mapas de OpenStreetMap y los videos insertados de YouTube (en su modo de privacidad mejorada) o Vimeo.</p>
      </section>
      <section>
        <h2>5. Responsabilidad</h2>
        <p>La información del archivo se revisa con cuidado, pero puede contener errores u omisiones. Si encuentras alguno, agradecemos que nos lo informes. La Cineteca de Ovalle no se hace responsable del contenido de sitios externos enlazados.</p>
      </section>
      <p className="legal-back"><Link to="/">← Volver al inicio</Link></p>
    </article>
  </main>;
}
