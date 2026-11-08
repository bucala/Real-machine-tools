// =====================================================================
// 5-OSÉ OBRÁBACIE CENTRÁ HERMLE C 32 U / C 42 U – výber modelu; simulácia je v cnc/CncCore.jsx
// =====================================================================
import { useState } from 'react';
import { CncCore } from './cnc/CncCore';
import { MODELS } from './cnc/kin';
import { SAMPLES } from './cnc/programs';
import { defaultTools } from './cnc/tooling';
import { createHermleModel } from './cnc/hermleModel';

const MODEL_KEY = 'rmt-hermle-model';
function HermleSimulator({ onBack, params }) {
  const [model, setModelS] = useState(() => {
    try {
      const m = localStorage.getItem(MODEL_KEY);
      return MODELS[m] ? m : 'c32';
    } catch (err) {
      return 'c32';
    }
  });
  const setModel = (m) => {
    try {
      localStorage.setItem(MODEL_KEY, m);
    } catch (err) {
      /* ignorované */
    }
    setModelS(m);
  };
  // predvolený je zložitý diel (príruba s kupolou, 8 nástrojov, 5-osé); jednoduchšie ukážky sú v zozname
  const [progId, setProgId] = useState('cx5');
  const [text, setText] = useState(() => SAMPLES().find((s) => s.id === 'cx5').text);
  const [tools, setTools] = useState(defaultTools);
  return (
    <CncCore
      key={model}
      createModel={createHermleModel}
      {...{ onBack, params, model, setModel, text, setText, tools, setTools, progId, setProgId }}
    />
  );
}

export { HermleSimulator };
export default HermleSimulator;
