import { useState } from 'react';
import { CncCore } from './cnc/CncCore';
import { createRoedersModel } from './precision/roedersModel';
import { defaultTools } from './cnc/tooling';
import { RXU } from './precision/profiles';
import { progMold } from './cnc/complexPrograms';
export default function RoedersSimulator({ onBack, params }) {
  // predvolená je forma s voľnou plochou (HSC rastre, 4 nástroje); kruhová kapsa je v zozname ukážok
  const [text, setText] = useState(progMold),
    [progId, setProgId] = useState('rxm');
  const [tools, setTools] = useState(() => defaultTools().filter((t) => t.d <= RXU.maxToolDiameter));
  return (
    <CncCore
      model={RXU.id}
      createModel={createRoedersModel}
      {...{ onBack, params, text, setText, progId, setProgId, tools, setTools }}
    />
  );
}
