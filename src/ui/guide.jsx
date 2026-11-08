// Sprievodca „krok za krokom“ pre začiatočníkov: jeden krok naraz, zvýraznený diel v scéne a ovládací prvok
// v paneli; krok sa splní sám, keď to stav stroja potvrdí (done), informačný krok potvrdí žiak tlačidlom „Ďalej“.
// Krok: { title, text, part?: kľúč dielu, param?: popis ovládača (data-param), button?: text tlačidla,
//         done?: (ui, tele, start) => bool – start = { ui, tele } pri začiatku kroku }
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { L } from '../core/i18n';

function target(step) {
  const panel = document.querySelector('.machine-app .panel');
  if (!panel || !step) return null;
  if (step.param) return panel.querySelector(`[data-param="${CSS.escape(step.param)}"]`);
  if (step.button)
    return [...panel.querySelectorAll('button')].find((b) => b.textContent.replace(/\s+/g, ' ').includes(step.button));
  return null;
}

export function Guide({ steps, ui, tele, apiRef }) {
  const [i, setI] = useState(-1),
    list = steps(),
    step = list[i];
  const latest = useRef({ ui, tele }),
    start = useRef({ ui, tele });
  latest.current = { ui, tele };
  const go = (n) => {
    start.current = { ui: { ...latest.current.ui }, tele: { ...latest.current.tele } };
    setI(n);
  };
  let ok = false;
  try {
    ok = !!step?.done?.(ui, tele, start.current);
  } catch {
    ok = false;
  }
  // splnený krok: krátko ukáž ✓ a pokračuj
  useEffect(() => {
    if (!ok) return undefined;
    const h = setTimeout(() => go(i + 1), 900);
    return () => clearTimeout(h);
  }, [ok, i]);
  // zvýraznenie dielu v scéne a ovládača v paneli
  useEffect(() => {
    if (!step) return undefined;
    if (step.part) apiRef.current.onPick?.(step.part);
    const el = target(step);
    if (el) {
      const det = el.closest('details');
      if (det && !det.open) det.open = true;
      el.classList.add('guide-target');
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    return () => {
      el?.classList.remove('guide-target');
      if (step.part) apiRef.current.onPick?.(null);
    };
  }, [i]);
  const launcher = (
    <div className="sec guide">
      <h2 className="sec-title mb-2">{L('Sprievodca', 'Guide')}</h2>
      {i < 0 ? (
        <button type="button" className="btn w-full" onClick={() => go(0)}>
          ▶ {L('Sprievodca krok za krokom', 'Step-by-step guide')}
        </button>
      ) : (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span>
            {i >= list.length
              ? L('Sprievodca je dokončený.', 'The guide is finished.')
              : `${L('Sprievodca beží – krok', 'Guide running – step')} ${i + 1} / ${list.length}`}
          </span>
          <button type="button" className="btn" onClick={() => setI(-1)}>
            {L('Ukončiť', 'Close')}
          </button>
        </div>
      )}
    </div>
  );
  if (i < 0) return launcher;
  const finished = i >= list.length;
  // samostatné navigačné okno nad scénou (pri každom kroku sa znova objaví)
  const win = (
    <div
      key={i}
      className="guide-window"
      role="dialog"
      aria-modal="false"
      aria-label={L('Sprievodca krok za krokom', 'Step-by-step guide')}
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-2">
        <b className="sec-title">{finished ? L('Hotovo', 'Done') : `${L('Krok', 'Step')} ${i + 1} / ${list.length}`}</b>
        <button
          type="button"
          className="help-x"
          onClick={() => setI(-1)}
          aria-label={L('Ukončiť sprievodcu', 'Close the guide')}
        >
          ×
        </button>
      </div>
      <div className="guide-bar" aria-hidden="true">
        <i style={{ width: `${(Math.min(i, list.length) / list.length) * 100}%` }} />
      </div>
      {finished ? (
        <>
          <p>
            {L(
              'Prešiel si všetky kroky. Teraz skús úlohu podľa výkresu v časti Úloha.',
              'You have completed all steps. Now try a drawing task in the Task section.',
            )}
          </p>
          <button type="button" className="btn" onClick={() => go(0)}>
            ↺ {L('Znova od začiatku', 'Start again')}
          </button>
        </>
      ) : (
        <>
          <p className="guide-title">
            {ok ? '✓ ' : ''}
            {step.title}
          </p>
          <p className="text-sm">{step.text}</p>
          <div className="flex gap-2 flex-wrap mt-2">
            {i > 0 && (
              <button type="button" className="btn" onClick={() => go(i - 1)}>
                ← {L('Späť', 'Back')}
              </button>
            )}
            <button type="button" className={`btn ${step.done ? '' : 'active'}`} onClick={() => go(i + 1)}>
              {step.done ? L('Preskočiť', 'Skip') : L('Ďalej', 'Next')} →
            </button>
          </div>
        </>
      )}
    </div>
  );
  return (
    <>
      {launcher}
      {createPortal(win, document.body)}
    </>
  );
}
