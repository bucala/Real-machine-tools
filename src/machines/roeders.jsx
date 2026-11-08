import { useState } from 'react';
import { CncCore } from './cnc/CncCore';
import { createRoedersModel } from './precision/roedersModel';
import { defaultTools } from './cnc/tooling';
import { RXU, RXU_PROGRAM } from './precision/profiles';
export default function RoedersSimulator({onBack,params}){
  const [text,setText]=useState(RXU_PROGRAM),[progId,setProgId]=useState('rxu');
  const [tools,setTools]=useState(()=>defaultTools().filter(t=>t.d<=RXU.maxToolDiameter));
  return <CncCore model={RXU.id} createModel={createRoedersModel} {...{onBack,params,text,setText,progId,setProgId,tools,setTools}}/>;
}
