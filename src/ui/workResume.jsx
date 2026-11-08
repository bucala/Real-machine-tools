// Lišta „Rozpracovaná práca“ pre moderné stroje a automatické ukladanie.
// Stroj dodá cez apiRef: workSig() – lacný podpis stavu, workSave() – údaje na uloženie, workRestore(data).
// Ukladá sa pri skrytí karty, zatvorení stránky, návrate do menu a každých 20 s – ale len ak sa stav od
// otvorenia stroja zmenil, aby otvorenie a zatvorenie neprepísalo staršiu rozpracovanú prácu.
import { useEffect, useRef, useState } from 'react';
import { L } from '../core/i18n';
import { clearWork, loadWork, saveWork } from '../core/workSession';

export function WorkResume({ machine, apiRef, skip = false }) {
  const [saved, setSaved] = useState(null),
    [note, setNote] = useState('');
  const base = useRef(undefined);
  useEffect(() => {
    let alive = true;
    if (!skip)
      loadWork(machine).then((r) => {
        if (alive && r) setSaved(r);
      });
    const sig = () => {
      try {
        return apiRef.current.workSig?.() ?? null;
      } catch {
        return null;
      }
    };
    // východiskový stav = prvý podpis po postavení scény
    const probe = setInterval(() => {
      const s = sig();
      if (s != null) {
        base.current = s;
        clearInterval(probe);
      }
    }, 400);
    const save = () => {
      const s = sig();
      if (s == null || base.current === undefined || s === base.current) return;
      const data = apiRef.current.workSave?.();
      if (!data) return;
      base.current = s;
      saveWork(machine, data);
      if (alive) setSaved(null); // nová práca nahradila staršiu
    };
    const vis = () => document.visibilityState === 'hidden' && save();
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('pagehide', save);
    const timer = setInterval(save, 20000);
    return () => {
      save();
      alive = false;
      clearInterval(probe);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('pagehide', save);
    };
  }, []);
  if (!saved)
    return note ? (
      <p className="work-resume-note text-xs muted" role="status">
        {note}
      </p>
    ) : null;
  const when = new Date(saved.savedAt).toLocaleString(L('sk-SK', 'en-GB'), {
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const resume = () => {
    const ok = apiRef.current.workRestore?.(saved);
    setSaved(null);
    setNote(
      ok
        ? L(
            'Rozpracovaná práca je obnovená. Program začína od začiatku, obrobok je v stave pri uložení.',
            'Your work is restored. The program starts from the beginning, the workpiece is as it was saved.',
          )
        : L('Rozpracovanú prácu sa nepodarilo obnoviť.', 'The saved work could not be restored.'),
    );
  };
  const discard = () => {
    clearWork(machine);
    setSaved(null);
  };
  return (
    <div className="work-resume" role="region" aria-label={L('Rozpracovaná práca', 'Work in progress')}>
      <p>
        <b>{L('Rozpracovaná práca', 'Work in progress')}</b> · {when}
        {saved.label ? ` · ${saved.label}` : ''}
      </p>
      <div className="flex gap-2 flex-wrap">
        <button type="button" className="btn active" onClick={resume}>
          {L('Pokračovať', 'Continue')}
        </button>
        <button type="button" className="btn" onClick={discard}>
          {L('Začať odznova', 'Start over')}
        </button>
      </div>
    </div>
  );
}
