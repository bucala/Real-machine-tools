import { useEffect,useRef } from 'react';
import { L } from '../core/i18n';
import { drawTerminalKeyboard } from '../machines/precision/terminalKeyboard';
export function TerminalDeck({apiRef,ui,rms=false}){
  const keyboard=useRef(null);useEffect(()=>{drawTerminalKeyboard(keyboard.current.getContext('2d'),1024,420);},[]);
  const act=id=>apiRef.current.hmiAction?.(id);
  const buttons=[['reset','↺',L('Reset','Reset')],['light','☼',L('Svetlo','Light')],['emergency','STOP',ui.estop?L('Uvoľniť STOP','Release STOP'):L('Núdzový STOP','Emergency STOP')],['hold','■',L('Stop posuvu','Feed hold')],['start','▶',L('Štart cyklu','Cycle start')],['coolant','≈',L('Výplach / chladenie','Flushing / coolant')],...(rms?[['single','1',L('Blok po bloku','Single block')]]:[])];
  const renderButton=([id,icon,label])=><button key={id} title={label} aria-label={label} className={`reference-key ${id}`} aria-pressed={id==='emergency'?ui.estop:id==='single'?ui.single:undefined} onClick={()=>act(id)}>{icon}</button>;
  return <div className={`reference-terminal-deck ${rms?'rms':'ex'}`}><div className="reference-deck-controls">
    {rms&&['fo','ro'].map((key,i)=><label className="reference-override" key={key} style={{'--override-angle':`${(ui[key]-100)*1.5}deg`}}><span>{i?L('Rýchloposuv','Rapid'):L('Posuv','Feed')} {ui[key]} %</span><i aria-hidden="true"><b/></i><input type="range" min={i?5:0} max={i?100:150} value={ui[key]} onChange={e=>apiRef.current.setHmiOverride(key,Number(e.target.value))}/></label>)}
    {buttons.filter(([id])=>rms||id==='emergency').map(renderButton)}
  </div><div className="reference-keyboard-row"><canvas ref={keyboard} width="1024" height="420" aria-label={L('PC klávesnica terminálu','Terminal PC keyboard')}/><div className="reference-mouse" aria-hidden="true"><i/></div></div><div className="reference-terminal-front"><span>{rms?'röders TEC':'OSCARMAX · EX 500'}</span>{!rms&&buttons.filter(([id])=>id!=='emergency').map(renderButton)}</div></div>;
}
