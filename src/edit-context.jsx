import { createContext, useContext } from 'react';

/* Las páginas del sitio se usan también como vista previa en el gestor. Dentro del gestor, este
   contexto vuelve editables sus textos y agrega los botones para cambiar imágenes y archivos.
   Fuera del gestor vale null y la página se muestra tal cual.
   - text(clave, opciones): campo editable con clic
   - slot(nombre): controles propios del gestor en ese punto de la página */
export const EditContext=createContext(null);

export function useEdit(){
  const edit=useContext(EditContext);
  return {
    edit,
    f:(key,value,opts)=>edit?edit.text(key,opts):value,
    slot:name=>edit?.slot?.(name)??null
  };
}
