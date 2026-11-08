// Spoločné prvky rozhrania simulátorov.
import React, { useEffect, useRef, useState } from 'react';
import { L, PrefsCtx } from '../core/i18n';
import { logNear } from '../core/util';
import { MachineDownload } from './machineDownload';
import { SectionInfo } from './sectionInfo';

// ---------- spoločné prvky rozhrania ----------
// telemetria pre panel: nový stav sa nastaví len pri skutočnej zmene – stojaci stroj panel neprekresľuje
const same = (a, b, deep = true) => {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-4;
  if (!deep || !a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) || Array.isArray(b))
    return false;
  for (const k in a) if (!same(a[k], b[k], false)) return false;
  for (const k in b) if (!(k in a)) return false;
  return true;
};
function useTele(init) {
  const [tele, setRaw] = useState(init);
  const set = useRef((next) => setRaw((prev) => (same(prev, next) ? prev : next))).current;
  return [tele, set];
}

function useMachine(init) {
  const ctl = useRef({ labels: false, unclamped: false, ...init, highlight: null });
  const [ui, setUi] = useState({ labels: false, unclamped: false, ...init });
  const [selected, setSelected] = useState(null);
  const apiRef = useRef({});
  const set = (k, v) => {
    ctl.current[k] = v;
    setUi((u) => ({ ...u, [k]: v }));
  };
  const selectPart = (k) => {
    const next = ctl.current.highlight === k ? null : k;
    ctl.current.highlight = next;
    setSelected(next);
  };
  apiRef.current.onPick = (k) => {
    ctl.current.highlight = k;
    setSelected(k);
  };
  // M = prepnutie kamera / ručné ovládanie, Esc = späť na kameru
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target && e.target.tagName;
      if (
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        (tag === 'INPUT' && e.target.type !== 'range')
      )
        return;
      if (ctl.current.unclamped) return;
      if (e.key === 'm' || e.key === 'M') set('manual', !ctl.current.manual);
      else if (e.key === 'Escape' && ctl.current.manual) set('manual', false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return { ctl, ui, setUi, set, selected, selectPart, apiRef };
}

const pl = (v) => (typeof v === 'string' || typeof v === 'number' ? String(v) : undefined); // popis pre protokol
function Slider({ id, label, value, min, max, step, unit, onChange, actual, disabled, digits = 0 }) {
  return (
    <div className="mb-3" data-param={pl(label)} data-val={`${Number(value).toFixed(digits)} ${unit || ''}`.trim()}>
      <label htmlFor={id} className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold">{label}</span>
        <span className="tnum muted text-xs">
          {actual != null && (
            <span>
              {L('skut.', 'act.')} {actual.toFixed(digits)} ·{' '}
            </span>
          )}
          <span className="ink font-semibold text-sm">
            {Number(value).toFixed(digits)} {unit}
          </span>
        </span>
      </label>
      <input
        id={id}
        className="range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}

// výber z odstupňovaných hodnôt prevodovky (otáčky, posuvy); locked = preradenie nie je dovolené (vreteno sa točí)
function StepSelect({ id, label, values, value, unit, onChange, locked, lockNote, fmt = (v) => String(v) }) {
  const cur = values[logNear(values, value)];
  return (
    <div className="mb-3" data-param={pl(label)} data-val={`${fmt(cur)} ${unit || ''}`.trim()}>
      <label htmlFor={id} className="flex items-baseline justify-between gap-2 text-sm mb-1">
        <span className="font-semibold">{label}</span>
        <span className="ink font-semibold text-sm tnum">
          {fmt(cur)} {unit}
        </span>
      </label>
      <select id={id} className="sel" value={cur} disabled={locked} onChange={(e) => onChange(Number(e.target.value))}>
        {values.map((v) => (
          <option key={v} value={v}>
            {fmt(v)} {unit}
          </option>
        ))}
      </select>
      {locked && lockNote && (
        <p className="text-xs mt-1" style={{ color: 'var(--warn)' }}>
          {lockNote}
        </p>
      )}
    </div>
  );
}
const GEAR_LOCK = () =>
  L(
    'Otáčky sa preraďujú len pri stojacom vretene – najprv ho zastav.',
    'Speeds can only be changed with the spindle stopped – stop it first.',
  );

function Toggle({ on, onClick, label, noParam }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-between w-full text-sm py-1 gap-3 text-left"
      aria-pressed={on}
      data-param={noParam ? undefined : pl(label)}
      data-val={on ? L('áno', 'yes') : L('nie', 'no')}
    >
      <span className="font-semibold">{label}</span>
      <span className={`sw ${on ? 'on' : ''}`}>
        <i />
      </span>
    </button>
  );
}

function Seg({ value, options, onChange, label }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([v, l]) => (
        <button
          key={String(v)}
          type="button"
          className={value === v ? 'on' : ''}
          aria-pressed={value === v}
          onClick={() => onChange(v)}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function SoundToggle({ className = 'btn' }) {
  const { prefs, setPref } = React.useContext(PrefsCtx);
  return (
    <button
      type="button"
      className={`${className} ${prefs.sound ? 'active' : ''}`}
      style={{ padding: '3px 8px', minHeight: 26 }}
      aria-pressed={!!prefs.sound}
      title={prefs.sound ? L('Vypnúť zvuk', 'Mute') : L('Zapnúť zvuk strojov', 'Turn machine sound on')}
      aria-label={L('Zvuk strojov', 'Machine sound')}
      onClick={() => setPref('sound', !prefs.sound)}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ display: 'block' }}
      >
        <path d="M4 9h4l5-4v14l-5-4H4z" />
        {prefs.sound ? <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /> : <path d="M17 9l5 6M22 9l-5 6" />}
      </svg>
    </button>
  );
}

// prepínač vzhľadu (skin) a jazyka
function PrefBar({ sound = true }) {
  const { prefs, setPref } = React.useContext(PrefsCtx);
  const skins = [
    ['green', '#4f7f3b', L('Zelený', 'Green')],
    ['dark', '#2b3138', L('Tmavý', 'Dark')],
    ['light', '#e9ece5', L('Svetlý', 'Light')],
  ];
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5" role="group" aria-label={L('Vzhľad', 'Skin')}>
        {skins.map(([k, col, name]) => (
          <button
            key={k}
            type="button"
            className={`swatch ${prefs.skin === k ? 'on' : ''}`}
            style={{ background: col }}
            aria-pressed={prefs.skin === k}
            aria-label={name}
            title={name}
            onClick={() => setPref('skin', k)}
          />
        ))}
      </div>
      <Seg
        label={L('Jazyk', 'Language')}
        value={prefs.lang}
        options={[
          ['sk', 'SK'],
          ['en', 'EN'],
        ]}
        onChange={(v) => setPref('lang', v)}
      />
      {sound && <SoundToggle />}
    </div>
  );
}

// pomocník v scéne: ovládanie kamery, ručné ovládanie, polotovar a tipy – otvára sa ikonou „i“ pri štítkoch stavu
const splitHint = (h) => (typeof h === 'string' ? h.split(' · ') : null);
const HELP_CAMERA = () => [
  [L('Ťahanie', 'Drag'), L('otáčanie pohľadu', 'orbit the view')],
  [L('Koliesko', 'Wheel'), L('priblíženie a vzdialenie', 'zoom in and out')],
  [L('Pravé tlačidlo / Shift', 'Right button / Shift'), L('posun pohľadu', 'pan the view')],
  [
    L('Klik na časť', 'Click a part'),
    L('zvýrazní ju a zobrazí popis v paneli', 'highlights it and shows its description in the panel'),
  ],
  [L('Dotyk', 'Touch'), L('1 prst otáča, 2 prsty približujú a posúvajú', '1 finger orbits, 2 fingers zoom and pan')],
  ['M', L('prepne na ručné ovládanie prvkov stroja', 'switches to manual control of the machine')],
];
const HELP_MANUAL = () => [
  [L('Ťahanie', 'Drag'), L('ručné kolesá, kľuky a páky', 'handwheels, cranks and levers')],
  [L('Klik', 'Click'), L('tlačidlá, vypínače a pedále', 'buttons, switches and pedals')],
  [
    L('Koliesko', 'Wheel'),
    L('točí prvkom pod kurzorom (nahor = pridať)', 'turns the element under the cursor (up = increase)'),
  ],
  [L('Kurzor nad prvkom', 'Hover'), L('zobrazí jeho názov a nastavenú hodnotu', 'shows its name and current value')],
  [
    'M / Esc',
    L('pohľad je zamknutý – kameru vráti M alebo Esc', 'the view is locked – M or Esc returns to the camera'),
  ],
];
const HELP_TIPS = () => [
  L(
    'Úlohu vyber v paneli – zadanie, výkres a kontrola požiadaviek sa priebežne vyhodnocujú; „Vyexportovať protokol“ stiahne protokol s nastavením stroja, nameranými hodnotami, odchýlkami a hodnotením.',
    'Pick a task in the panel – the brief, drawing and requirement checks are evaluated live; “Export report” downloads a report with the machine settings, measured values, deviations and assessment.',
  ),
  L(
    'Pri stojacom stroji sa nástroj do materiálu nezareže – reže sa len za chodu.',
    'With the machine stopped the tool does not cut into the material – it cuts only while running.',
  ),
  L(
    'Pohľady v paneli (Celok, Detail …) vrátia kameru do pripravenej polohy.',
    'The views in the panel (Overview, Detail …) return the camera to a preset position.',
  ),
  L(
    'Obrobok sa dá uložiť v prehliadači a neskôr znova upnúť, alebo stiahnuť ako STL.',
    'The workpiece can be saved in the browser and clamped again later, or downloaded as STL.',
  ),
];
function HelpRows({ rows }) {
  return (
    <dl className="help-rows">
      {rows.map(([k, v]) => (
        <React.Fragment key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}
function SceneHelp({ onClose, hint, manualLabel, manualHint, tips, canUnclamp, workLabels }) {
  useEffect(() => {
    const key = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);
  const cam = splitHint(hint);
  return (
    <div className="scene-help pointer-events-auto" role="dialog" aria-label={L('Pomocník', 'Help')}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <b className="sec-title">{L('Pomocník', 'Help')}</b>
        <button type="button" className="help-x" onClick={onClose} aria-label={L('Zavrieť', 'Close')}>
          ×
        </button>
      </div>
      <h3>{L('Ovládanie kamery', 'Camera control')}</h3>
      {cam ? (
        <ul>
          {cam.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      ) : (
        <HelpRows rows={HELP_CAMERA()} />
      )}
      <h3>{manualLabel || L('Ručné ovládanie', 'Manual control')}</h3>
      {manualHint ? <p>{manualHint}</p> : <HelpRows rows={HELP_MANUAL()} />}
      {canUnclamp && (
        <>
          <h3>{L('Polotovar', 'Workpiece')}</h3>
          <p>
            {L(
              `Tlačidlo „${workLabels ? workLabels[0] : 'Pozrieť obrobok'}“ vyberie obrobok zo stroja – ťahaním ho otáčaš, kolieskom približuješ, „${workLabels ? workLabels[1] : 'Upnúť späť'}“ ho vráti na miesto.`,
              `“${workLabels ? workLabels[0] : 'Inspect workpiece'}” takes the work out of the machine – drag to rotate it, scroll to zoom, “${workLabels ? workLabels[1] : 'Clamp back'}” puts it back.`,
            )}
          </p>
        </>
      )}
      <h3>{L('Tipy', 'Tips')}</h3>
      <ul>
        {[...(tips || []), ...HELP_TIPS()].map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </div>
  );
}

function SceneView({
  mountRef,
  layerRef,
  tipRef,
  ui,
  set,
  parts,
  selected,
  selectPart,
  chips,
  onBack,
  apiRef,
  canUnclamp = true,
  workLabels,
  workBelowModes = false,
  overlay,
  hint,
  manualLabel,
  manualHint,
  tools,
  tips,
}) {
  const inspect = ui.unclamped;
  const [help, setHelp] = useState(false);
  // úzka scéna (mobil, úzke rozdelenie obrazovky): štítky stavu len ako kontrolky, ďalšie tlačidlá pod „⋯“,
  // aby tlačidlá nezakrývali väčšinu 3D scény
  const wrapRef = useRef(null);
  const [narrow, setNarrow] = useState(false);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setNarrow(el.clientWidth < 560));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (!narrow) setMore(false);
  }, [narrow]);
  const closeHelp = React.useCallback(() => setHelp(false), []);
  const workButton = canUnclamp && (
    <button
      type="button"
      className={`scene-btn ${inspect ? 'on' : ''}`}
      aria-pressed={inspect}
      onClick={() => apiRef.current.toggleWork && apiRef.current.toggleWork()}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 7h16v10H4zM8 7V4h8v3" />
      </svg>
      {workLabels
        ? workLabels[inspect ? 1 : 0]
        : inspect
          ? L('Upnúť späť', 'Clamp back')
          : L('Pozrieť obrobok', 'Inspect workpiece')}
    </button>
  );
  return (
    <div ref={wrapRef} className={`scene-wrap relative flex-1 overflow-hidden ${narrow ? 'scene-narrow' : ''}`}>
      <div ref={mountRef} className="absolute inset-0" />
      <div
        ref={layerRef}
        className={`absolute inset-0 pointer-events-none overflow-hidden ${ui.labels && !ui.manual && !inspect ? '' : 'hidden'}`}
      >
        {parts.map((p) => (
          <button
            key={p.key}
            type="button"
            data-part={p.key}
            onClick={() => selectPart(p.key)}
            className={`part-label ${selected === p.key ? 'is-active' : ''}`}
          >
            {p.short}
          </button>
        ))}
      </div>
      {overlay}
      {ui.manual && <div className="manual-frame" />}
      <div ref={tipRef} className="ctl-tip" />
      <div className="absolute left-3 top-3 right-3 flex items-start justify-between gap-2 pointer-events-none">
        <div className="flex flex-col items-start gap-2" style={{ minWidth: 0 }}>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="scene-btn"
              onClick={onBack}
              aria-label={L('Späť na výber stroja', 'Back to machine selection')}
            >
              ← {L('Menu', 'Menu')}
            </button>
            {chips.map((ch) =>
              narrow ? (
                <span key={ch.text} className="chip chip-compact" role="img" aria-label={ch.text} title={ch.text}>
                  <span className="lamp" style={{ color: ch.color }} />
                </span>
              ) : (
                <span key={ch.text} className="chip">
                  <span className="lamp" style={{ color: ch.color }} />
                  {ch.text}
                </span>
              ),
            )}
            <button
              type="button"
              className={`scene-btn help-btn ${help ? 'on' : ''}`}
              aria-pressed={help}
              aria-label={L('Pomocník: ovládanie a tipy', 'Help: controls and tips')}
              title={L('Ovládanie a tipy', 'Controls and tips')}
              onClick={() => setHelp((v) => !v)}
            >
              i
            </button>
            <SoundToggle className="scene-btn" />
          </div>
          {help && (
            <SceneHelp
              onClose={closeHelp}
              hint={hint}
              manualLabel={manualLabel}
              manualHint={manualHint}
              tips={tips}
              canUnclamp={canUnclamp}
              workLabels={workLabels}
            />
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap justify-end items-center gap-2">
            <div
              className="mode-seg pointer-events-auto"
              role="group"
              aria-label={L('Režim ovládania', 'Control mode')}
            >
              <button
                type="button"
                className={ui.manual ? '' : 'on'}
                aria-pressed={!ui.manual}
                onClick={() => set('manual', false)}
                aria-label={L('Ovládanie kamery', 'Camera control')}
                title={L('Ovládanie kamery (M)', 'Camera control (M)')}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 8h4l2-3h6l2 3h4v11H3z" />
                  <circle cx="12" cy="13" r="3.5" />
                </svg>
                <span className="hidden lg:inline">{L('Ovládanie kamery', 'Camera control')}</span>
                <span className="lg:hidden">{L('Kamera', 'Camera')}</span>
              </button>
              <button
                type="button"
                className={ui.manual ? 'on' : ''}
                aria-pressed={ui.manual}
                disabled={inspect}
                onClick={() => set('manual', true)}
                aria-label={manualLabel || L('Ručné ovládanie', 'Manual control')}
                title={L('Ručné ovládanie prvkov stroja (M)', 'Manual control of machine elements (M)')}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11V4a1.5 1.5 0 0 1 3 0v8M14 11.5V6a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7h-.5A6.5 6.5 0 0 1 4 15.5L3 12a1.5 1.5 0 0 1 2.7-1.2L8 14" />
                </svg>
                <span className="hidden lg:inline">{manualLabel || L('Ručné ovládanie', 'Manual control')}</span>
                <span className="lg:hidden">{manualLabel || L('Ručne', 'Manual')}</span>
              </button>
            </div>
            {!narrow && !workBelowModes && workButton}
            {narrow && (workButton || tools) && (
              <button
                type="button"
                className={`scene-btn more-btn ${more ? 'on' : ''}`}
                aria-expanded={more}
                aria-label={L('Ďalšie tlačidlá scény', 'More scene buttons')}
                title={L('Ďalšie tlačidlá', 'More buttons')}
                onClick={() => setMore((v) => !v)}
              >
                ⋯
              </button>
            )}
          </div>
          {/* ďalšie tlačidlá v scéne pod hlavným riadkom – pri zalomení sa posunú nadol, neprekrývajú sa */}
          {(!narrow || more) && (
            <div
              className={`flex justify-end gap-2 ${narrow ? 'flex-col items-end' : 'flex-wrap'}`}
              style={{ zIndex: 6 }}
            >
              {(narrow || workBelowModes) && workButton}
              {tools}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// chod tam a späť (vzad / stop / vpred) v rovnakom štýle ako hlavné tlačidlo Štart / Stop
function DirRun({ value, onChange, labels }) {
  const [lb, ls, lf] = labels || [L('Vzad', 'Reverse'), L('Stop', 'Stop'), L('Vpred', 'Forward')];
  return (
    <div className="run-row" role="group" aria-label={L('Smer chodu', 'Drive direction')}>
      <button
        type="button"
        className={`btn-run start ${value === -1 ? 'is-on' : ''}`}
        aria-pressed={value === -1}
        onClick={() => onChange(value === -1 ? 0 : -1)}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true" className="shrink-0">
          <path d="M10 1 2 6l8 5z" />
        </svg>
        {lb}
      </button>
      <button
        type="button"
        className={`btn-run stop ${value === 0 ? 'is-on' : ''}`}
        aria-pressed={value === 0}
        onClick={() => onChange(0)}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true" className="shrink-0">
          <rect x="1" y="1" width="10" height="10" />
        </svg>
        {ls}
      </button>
      <button
        type="button"
        className={`btn-run start ${value === 1 ? 'is-on' : ''}`}
        aria-pressed={value === 1}
        onClick={() => onChange(value === 1 ? 0 : 1)}
      >
        {lf}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true" className="shrink-0">
          <path d="m2 1 8 5-8 5z" />
        </svg>
      </button>
    </div>
  );
}

function PartLabelsButton({ ui, set }) {
  return (
    <button
      type="button"
      className={`btn part-labels-toggle ${ui.labels ? 'active' : ''}`}
      aria-pressed={!!ui.labels}
      title={L('Názvy častí stroja', 'Machine part names')}
      onClick={() => {
        if (!ui.labels && ui.manual) set('manual', false);
        set('labels', !ui.labels);
      }}
    >
      {L('Názvy častí', 'Part names')}
    </button>
  );
}

function PanelHeader({ kicker, title, sub, rows, foot, status, ui, set }) {
  return (
    <div className="sec">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="sec-title" style={{ letterSpacing: '.12em' }}>
          {kicker}
        </p>
        <PrefBar sound={false} />
      </div>
      <div className="section-heading mt-3">
        <h1 className="app-title" tabIndex={-1}>
          {title}
        </h1>
        <PartLabelsButton ui={ui} set={set} />
        <SectionInfo title={title}>
          <p>{sub}</p>
        </SectionInfo>
      </div>
      <div className="dro mt-3 tnum">
        {rows.map(([l, v]) => (
          <div key={l} className="dro-row">
            <span>{l}</span>
            <b>{v}</b>
          </div>
        ))}
        <div className="dro-sub">
          {foot.map((s) => (
            <span key={s}>{s}</span>
          ))}
        </div>
      </div>
      <div
        className={`msg msg-${status.kind}`}
        role="status"
        aria-live={status.kind === 'run' || status.kind === 'idle' ? 'off' : 'polite'}
      >
        <span className="lamp" />
        {status.text}
      </div>
    </div>
  );
}

function ViewSection({ views, apiRef }) {
  return (
    <div className="sec">
      <h2 className="sec-title mb-2">{L('Pohľad', 'View')}</h2>
      <div className="flex flex-wrap gap-2">
        {views.map(([k, l]) => (
          <button key={k} type="button" className="btn" onClick={() => apiRef.current.view && apiRef.current.view(k)}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function PartsSection({ parts, selected, selectPart }) {
  const sel = parts.find((p) => p.key === selected);
  return (
    <div className="sec">
      <div className="flex items-center justify-between mb-2">
        <div className="section-heading">
          <h2 className="sec-title">{L('Časti stroja', 'Machine parts')}</h2>
          <SectionInfo title={L('Časti stroja', 'Machine parts')}>
            <p>
              {L(
                'Vyber časť zo zoznamu alebo klikni na ňu v modeli – zvýrazní sa a zobrazí sa jej popis.',
                'Pick a part from the list or click it in the model – it is highlighted and its description is shown.',
              )}
            </p>
          </SectionInfo>
        </div>
        {selected && (
          <button type="button" className="text-xs muted underline" onClick={() => selectPart(selected)}>
            {L('Zrušiť výber', 'Clear selection')}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {parts.map((p) => (
          <button
            key={p.key}
            type="button"
            className={`part-btn ${selected === p.key ? 'active' : ''}`}
            onClick={() => selectPart(p.key)}
          >
            {p.short}
          </button>
        ))}
      </div>
      {sel && (
        <div className="desc">
          <div className="font-semibold mb-1">{sel.name}</div>
          <div>{sel.desc}</div>
        </div>
      )}
    </div>
  );
}

// časti stroja: [kľúč, krátky SK, krátky EN, názov SK, názov EN, popis SK, popis EN]
const mkParts = (rows) =>
  rows.map(([key, ss, se, ns, ne, ds, de]) => ({ key, short: L(ss, se), name: L(ns, ne), desc: L(ds, de) }));

// sekcia polotovaru: voľby rozmeru a tvaru + tlačidlo na upnutie nového kusu
function BlankSection({ title, children, onApply, applyLabel, note }) {
  return (
    <div className="sec">
      <div className="section-heading">
        <h2 className="sec-title">{title || L('Polotovar', 'Workpiece')}</h2>
        {note && (
          <SectionInfo title={title || L('Polotovar', 'Workpiece')}>
            <p>{note}</p>
          </SectionInfo>
        )}
      </div>
      {children}
      <button type="button" className="btn mt-1 w-full" onClick={onApply}>
        {applyLabel || L('Upnúť nový polotovar', 'Clamp a new workpiece')}
      </button>
    </div>
  );
}

function SegRow({ label, value, options, onChange, noParam }) {
  const cur = options.find(([v]) => v === value);
  return (
    <div
      className="flex items-center justify-between text-sm gap-2 mb-3"
      data-param={noParam ? undefined : pl(label)}
      data-val={cur ? pl(cur[1]) : undefined}
    >
      <span className="font-semibold">{label}</span>
      <Seg label={label} value={value} options={options} onChange={onChange} />
    </div>
  );
}

function HelpFooter({ apiRef, ui }) {
  return (
    <div className="sec machine-download-footer" style={{ borderBottom: 0 }}>
      <MachineDownload apiRef={apiRef} disabled={ui.unclamped} className="btn" />
    </div>
  );
}

export {
  PartLabelsButton,
  BlankSection,
  DirRun,
  GEAR_LOCK,
  HelpFooter,
  PanelHeader,
  PartsSection,
  PrefBar,
  SceneView,
  Seg,
  SegRow,
  Slider,
  SoundToggle,
  StepSelect,
  Toggle,
  ViewSection,
  mkParts,
  useMachine,
  useTele,
};
