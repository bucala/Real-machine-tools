// Spoločné nástroje panelu: kalkulačka rezných podmienok, úlohy s kontrolou, kontrola BOZP, uloženie a export obrobku.
import { useEffect, useRef, useState } from 'react';
import { L, RPM } from '../core/i18n';
import { logNear } from '../core/util';
import { Seg, SegRow } from './common';

const fmt = (v, d = 1) => L(v.toFixed(d).replace('.', ','), v.toFixed(d));

// ---------- rezné podmienky ----------
// odporúčaná rezná rýchlosť vc v m/min podľa obrábaného materiálu a materiálu nástroja (orientačné hodnoty pre výučbu)
const VC = {
  steel: { hss: [20, 30], sk: [120, 180] },
  brass: { hss: [50, 80], sk: [150, 250] },
  alu: { hss: [100, 200], sk: [250, 450] },
  wood: { hss: [600, 1500], sk: [600, 1500] },
};
const MAT_NAMES = () => ({ steel: L('oceľ', 'steel'), brass: L('mosadz', 'brass'), alu: L('hliník', 'aluminium'), wood: L('drevo', 'wood') });
const nFromVc = (vc, d) => (1000 * vc) / (Math.PI * d);
const vcFromN = (n, d) => (Math.PI * d * n) / 1000;

// D = priemer obrobku (sústruh) alebo nástroja (fréza, vŕtačka) v mm; speeds = stupne prevodovky
function CutCalc({ D, mat, speeds, rpm, locked, onApply, what }) {
  const [tool, setTool] = useState('hss');
  if (!(D > 0.5)) return null;
  const [lo, hi] = (VC[mat] || VC.steel)[tool];
  const nLo = nFromVc(lo, D), nHi = nFromVc(hi, D), nMid = Math.sqrt(nLo * nHi);
  const inRange = speeds.filter((n) => n >= nLo && n <= nHi);
  const best = inRange.length ? inRange[logNear(inRange, nMid)] : speeds[logNear(speeds, nMid)];
  const vcNow = vcFromN(rpm, D), ok = vcNow >= lo * 0.9 && vcNow <= hi * 1.1;
  return (
    <div className="desc" style={{ marginTop: 6 }}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <b className="text-sm">{L('Rezné podmienky', 'Cutting data')}</b>
        <Seg label={L('Materiál nástroja', 'Tool material')} value={tool} options={[['hss', 'HSS'], ['sk', L('SK', 'Carbide')]]} onChange={setTool} />
      </div>
      <div className="text-xs" style={{ lineHeight: 1.55 }}>
        <div>{what || L('Priemer', 'Diameter')} <b>Ø{fmt(D)}</b> · {MAT_NAMES()[mat] || mat} · vc {lo} – {hi} m/min</div>
        <div>n = 1000 · vc / (π · D) = <b>{Math.round(nLo)} – {Math.round(nHi)} {RPM()}</b></div>
        <div>{L('Najbližší stupeň prevodovky', 'Nearest gearbox step')}: <b>{best} {RPM()}</b> (vc {fmt(vcFromN(best, D), 0)} m/min)</div>
        <div style={{ color: ok ? 'var(--accent)' : 'var(--warn)' }}>
          {L('Nastavené', 'Set')} {rpm} {RPM()} → vc {fmt(vcNow, 0)} m/min{ok ? ' ✓' : vcNow < lo ? L(' – nízka rýchlosť', ' – too slow') : L(' – príliš vysoká rýchlosť', ' – too fast')}
        </div>
      </div>
      <button type="button" className="btn w-full mt-2" disabled={locked || best === rpm} onClick={() => onApply(best)}>
        {L(`Nastaviť ${best} ${RPM()}`, `Set ${best} ${RPM()}`)}
      </button>
      {locked && <p className="text-xs mt-1" style={{ color: 'var(--warn)' }}>{L('Otáčky sa preraďujú len pri stojacom vretene.', 'Speeds can only be changed with the spindle stopped.')}</p>}
    </div>
  );
}

// ---------- kontrola BOZP pred spustením ----------
function SafetyGate({ active, ui, set, runKey, items, onConfirm }) {
  const [open, setOpen] = useState(false), [ticks, setTicks] = useState({}), confirmed = useRef(false);
  useEffect(() => { confirmed.current = false; setTicks({}); }, [active]);
  useEffect(() => {
    if (!active || confirmed.current || !ui[runKey]) return;
    set(runKey, false); setOpen(true);                 // stroj sa nespustí, kým sa nepotvrdí kontrolný zoznam
  }, [active, ui[runKey]]);
  if (!open) return null;
  const all = items.every((_, i) => ticks[i]);
  return (
    <div role="dialog" aria-modal="true" aria-label={L('Kontrola BOZP', 'Safety check')}
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="desc" style={{ maxWidth: 440, width: '100%', background: 'var(--panel)', padding: 18 }}>
        <h2 className="app-title" style={{ fontSize: 22 }}>{L('Kontrola BOZP pred spustením', 'Safety check before starting')}</h2>
        <p className="text-sm muted mt-1 mb-3">{L('Potvrď každý bod – až potom sa stroj spustí.', 'Confirm every item – only then will the machine start.')}</p>
        {items.map((t, i) => (
          <label key={i} className="flex items-start gap-2 text-sm mb-2" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={!!ticks[i]} onChange={(e) => setTicks((s) => ({ ...s, [i]: e.target.checked }))} style={{ marginTop: 3, accentColor: 'var(--accent)' }} />
            <span>{t}</span>
          </label>
        ))}
        <div className="flex gap-2 mt-3">
          <button type="button" className="btn" onClick={() => setOpen(false)}>{L('Zrušiť', 'Cancel')}</button>
          <button type="button" className="btn active" disabled={!all} style={{ flex: 1 }}
            onClick={() => { confirmed.current = true; setOpen(false); set(runKey, true); if (onConfirm) onConfirm(); }}>{L('Potvrdiť a spustiť', 'Confirm and start')}</button>
        </div>
      </div>
    </div>
  );
}

// ---------- úlohy s kontrolou ----------
// task = { id, title(), desc(), drawing?(), setup?, checks(m) → [{ label, ok, actual }] }; measure() vráti údaje stroja
const grade = (pct) => (pct >= 90 ? 1 : pct >= 75 ? 2 : pct >= 50 ? 3 : pct >= 30 ? 4 : 5);
function TaskSection({ machine, tasks, apiRef, params, status, onSetup, safety }) {
  const first = params && params.uloha && tasks.find((t) => t.id === params.uloha) ? params.uloha : '';
  const [id, setId] = useState(first), [t0, setT0] = useState(() => (first ? Date.now() : 0)), [now, setNow] = useState(0);
  const [m, setM] = useState(null), [result, setResult] = useState(null), [warns, setWarns] = useState(0), [copied, setCopied] = useState('');
  const [bozp, setBozp] = useState(!!first);
  const task = tasks.find((t) => t.id === id);
  // živé meranie a čas
  useEffect(() => {
    if (!task) return undefined;
    const tick = () => { setNow(Date.now()); try { setM(apiRef.current.measure ? apiRef.current.measure() : null); } catch (err) { /* ignorované */ } };
    tick(); const h = setInterval(tick, 500); return () => clearInterval(h);
  }, [id]);
  // počítanie varovaní a kolízií počas úlohy
  const lastMsg = useRef('');
  useEffect(() => {
    if (!task || !status) return;
    if ((status.kind === 'danger' || status.kind === 'warn') && status.text !== lastMsg.current) setWarns((w) => w + 1);
    lastMsg.current = status.text;
  }, [status && status.text]);
  const start = (nid) => { setId(nid); setT0(nid ? Date.now() : 0); setResult(null); setWarns(0); setBozp(!!nid); };
  const checks = task && m ? task.checks(m) : [];
  const okN = checks.filter((c) => c.ok).length;
  const secs = t0 ? Math.max(0, Math.round(((result ? result.at : now) - t0) / 1000)) : 0;
  const evaluate = () => {
    const pct = checks.length ? Math.max(0, (okN / checks.length) * 100 - Math.min(20, warns * 2)) : 0;
    setResult({ at: Date.now(), pct, grade: grade(pct), ok: okN, total: checks.length, warns });
  };
  const share = () => {
    const url = `${window.location.origin}${window.location.pathname}#${machine}/uloha=${id}`;
    const done = () => { setCopied(url); setTimeout(() => setCopied(''), 6000); };
    try { navigator.clipboard.writeText(url).then(done, done); } catch (err) { done(); }
  };
  return (
    <div className="sec">
      <h2 className="sec-title mb-2">{L('Úlohy', 'Exercises')}</h2>
      <label className="sr-only" htmlFor={`task-${machine}`}>{L('Úloha', 'Exercise')}</label>
      <select id={`task-${machine}`} className="sel mb-2" value={id} onChange={(e) => start(e.target.value)}>
        <option value="">{L('Voľná práca bez úlohy', 'Free work, no exercise')}</option>
        {tasks.map((t) => <option key={t.id} value={t.id}>{t.title()}</option>)}
      </select>
      {task && (<>
        <div className="desc" style={{ marginTop: 4 }}>
          <div className="text-sm" style={{ lineHeight: 1.45 }}>{task.desc()}</div>
          {task.drawing && <div style={{ marginTop: 8, color: 'var(--text)' }}>{task.drawing()}</div>}
        </div>
        {task.setup && onSetup && <button type="button" className="btn w-full mt-2" onClick={() => onSetup(task)}>{L('Pripraviť predpísaný polotovar a nástroj', 'Prepare the specified blank and tool')}</button>}
        <ul className="text-sm mt-3" style={{ lineHeight: 1.5, listStyle: 'none', padding: 0 }}>
          {checks.map((c, i) => (
            <li key={i} className="flex justify-between gap-2" style={{ color: c.ok ? 'var(--accent)' : 'var(--muted)' }}>
              <span>{c.ok ? '✓' : '○'} {c.label}</span><span className="tnum">{c.actual}</span>
            </li>
          ))}
        </ul>
        <div className="text-xs muted mt-2 tnum">{L('Čas', 'Time')} {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')} · {L('varovania a kolízie', 'warnings and collisions')}: {warns}</div>
        {safety && <div className="mt-2"><SegRow label={L('Kontrola BOZP pred spustením', 'Safety check before start')} value={bozp} options={[[true, L('Áno', 'Yes')], [false, L('Nie', 'No')]]} onChange={setBozp} /></div>}
        <div className="flex gap-2 mt-1">
          <button type="button" className="btn active" style={{ flex: 1 }} onClick={evaluate}>{L('Vyhodnotiť', 'Evaluate')}</button>
          <button type="button" className="btn" onClick={share} title={L('Skopíruje odkaz, ktorý otvorí túto úlohu', 'Copies a link that opens this exercise')}>{L('Odkaz pre žiakov', 'Link for students')}</button>
        </div>
        {copied && <p className="text-xs mt-1 muted" style={{ wordBreak: 'break-all' }}>{L('Skopírované:', 'Copied:')} {copied}</p>}
        {result && (
          <div className={`msg ${result.grade <= 2 ? 'msg-run' : result.grade <= 3 ? 'msg-warn' : 'msg-danger'}`} role="status">
            <span className="lamp" />
            {L(`Splnené ${result.ok} z ${result.total} požiadaviek, ${result.warns} varovaní, čas ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} – ${Math.round(result.pct)} %, známka ${result.grade}.`,
              `${result.ok} of ${result.total} requirements met, ${result.warns} warnings, time ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} – ${Math.round(result.pct)} %, grade ${result.grade}.`)}
          </div>
        )}
        {safety && <SafetyGate active={bozp} {...safety} />}
      </>)}
    </div>
  );
}

// ---------- uloženie a export obrobku ----------
function download(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
const SAVE_KEY = (m) => `rmt-save-${m}`;
function ExportSection({ machine, apiRef, canSave = true, canStl = true }) {
  const [note, setNote] = useState(''), [has, setHas] = useState(() => { try { return !!localStorage.getItem(SAVE_KEY(machine)); } catch (err) { return false; } });
  const say = (t) => { setNote(t); setTimeout(() => setNote(''), 5000); };
  const api = () => apiRef.current;
  const save = () => {
    const r = api().save && api().save(); if (!r) return;
    try { localStorage.setItem(SAVE_KEY(machine), JSON.stringify(r)); setHas(true); say(L('Obrobok je uložený v tomto prehliadači.', 'The workpiece is saved in this browser.')); }
    catch (err) { say(L('Uloženie sa nepodarilo – prehliadač nemá voľné miesto alebo ukladanie zakázal.', 'Saving failed – the browser has no space or blocks storage.')); }
  };
  const load = () => {
    try { const r = JSON.parse(localStorage.getItem(SAVE_KEY(machine)) || 'null'); if (r && api().load && api().load(r)) say(L('Uložený obrobok je upnutý.', 'The saved workpiece is clamped.')); }
    catch (err) { say(L('Uložený obrobok sa nepodarilo načítať.', 'The saved workpiece could not be loaded.')); }
  };
  const stl = () => { const b = api().exportStl && api().exportStl(); if (b) { download(b, `${machine}-obrobok.stl`); say(L('STL model obrobku (mm) sa sťahuje.', 'The workpiece STL model (mm) is downloading.')); } };
  const png = () => { if (api().snapshot) api().snapshot((b) => { if (b) download(b, `${machine}.png`); }); };
  return (
    <div className="sec">
      <h2 className="sec-title mb-2">{L('Uloženie a export', 'Save and export')}</h2>
      <div className="grid grid-cols-2 gap-2">
        {canSave && <button type="button" className="btn" onClick={save}>{L('Uložiť obrobok', 'Save workpiece')}</button>}
        {canSave && <button type="button" className="btn" onClick={load} disabled={!has}>{L('Načítať uložený', 'Load saved')}</button>}
        {canStl && <button type="button" className="btn" onClick={stl}>{L('Stiahnuť STL', 'Download STL')}</button>}
        <button type="button" className="btn" onClick={png}>{L('Snímka PNG', 'PNG snapshot')}</button>
      </div>
      {note && <p className="text-xs mt-2 muted" role="status">{note}</p>}
    </div>
  );
}

// pole Float32 / Uint8 ↔ base64 (kompaktné uloženie do localStorage)
const toB64 = (arr) => { const u = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
const fromB64 = (b64, Type) => { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new Type(u.buffer); };

export { CutCalc, ExportSection, SafetyGate, TaskSection, VC, fromB64, nFromVc, toB64, vcFromN };
