import { useId, useRef } from 'react';
import { L } from '../core/i18n';
import './sectionInfo.css';

export function SectionInfo({ title, children }) {
  const dialog=useRef(null), id=useId();
  return <>
    <button type="button" className="section-info-button" aria-label={`${L('Informácie','Information')}: ${title}`} aria-haspopup="dialog" onClick={()=>dialog.current.showModal()}>i</button>
    <dialog ref={dialog} className="section-info-dialog" aria-labelledby={id} onKeyDown={e=>e.stopPropagation()} onClick={e=>{if(e.target===dialog.current){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.current.close();}}}>
      <div className="section-info-heading"><h2 id={id}>{title}</h2><button type="button" className="btn" autoFocus onClick={()=>dialog.current.close()} aria-label={L('Zavrieť informácie','Close information')}>×</button></div>
      <div className="section-info-content">{children}</div>
    </dialog>
  </>;
}
