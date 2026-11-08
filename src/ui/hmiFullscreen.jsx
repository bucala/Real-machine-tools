import { TerminalDeck } from './terminalDeck';
import { WorkAreaButton } from './workAreaWindow';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { L } from '../core/i18n';
import { SoundToggle } from './common';
import { useTouchScreen } from './touchScreen';
import { cncScreenLabel } from '../machines/cnc/cncScreen';
import {
  HMI_CONTROL_LAYOUT as layout,
  HMI_MONITOR_LAYOUT as monitor,
  drawHmiBrand,
  hmiKeyLayout,
} from '../machines/cnc/hmiPanel';

const position = ({ x, z }) => ({ left: `${(x / layout.width + 0.5) * 100}%`, top: `${(z / layout.depth) * 100}%` });
function Override({ label, value, min, max, onChange }) {
  const [draft, setDraft] = useState(String(value)),
    [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);
  const set = (raw) => {
    const v = Number(raw);
    if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, Math.round(v))));
  };
  return (
    <div className="hmi-override">
      <span>
        {label}
        <output>{value} %</output>
      </span>
      <span className="hmi-dial-row">
        <i
          className="hmi-dial"
          aria-hidden="true"
          style={{ transform: `rotate(${-130 + ((value - min) / (max - min)) * 260}deg)` }}
        />
        <input
          type="range"
          aria-label={label}
          min={min}
          max={max}
          step="1"
          value={value}
          onChange={(e) => set(e.target.value)}
        />
        <input
          type="number"
          aria-label={`${label} (%)`}
          min={min}
          max={max}
          value={editing ? draft : String(value)}
          onFocus={() => {
            setDraft(String(value));
            setEditing(true);
          }}
          onChange={(e) => {
            setDraft(e.target.value);
            const n = Number(e.target.value);
            if (e.target.value !== '' && n >= min && n <= max) onChange(n);
          }}
          onBlur={() => {
            if (draft !== '') set(draft);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
      </span>
    </div>
  );
}

function Brand({ brand }) {
  const ref = useRef(null);
  useEffect(() => {
    const g = ref.current.getContext('2d');
    g.clearRect(0, 0, 380, 80);
    drawHmiBrand(g, 190, 40, 380, 80, brand);
  }, [brand]);
  return (
    <canvas
      ref={ref}
      width="380"
      height="80"
      className="hmi-deck-brand"
      style={{
        ...position(layout.brand),
        width: `${(layout.brand.width / layout.width) * 100}%`,
        height: `${(layout.brand.height / layout.depth) * 100}%`,
      }}
      aria-hidden="true"
    />
  );
}
function Dial({ id, value, onChange, children }) {
  const [open, setOpen] = useState(false),
    p = layout.dials[id],
    label = id === 'feed' ? L('Korekcia posuvu', 'Feed override') : L('Korekcia rýchloposuvu', 'Rapid override');
  return (
    <div
      className="hmi-override-position"
      style={{
        ...position(p),
        width: `${((p.r * 2) / layout.width) * 100}%`,
        height: `${((p.r * 2) / layout.depth) * 100}%`,
      }}
    >
      <button
        type="button"
        className="hmi-physical-dial"
        aria-label={label}
        aria-expanded={open}
        title={`${label}: ${value} %`}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(e.key)) {
            e.preventDefault();
            onChange(value + (['ArrowUp', 'ArrowRight'].includes(e.key) ? 1 : -1));
          }
        }}
      >
        <i style={{ transform: `rotate(${((value - 100) * Math.PI) / (id === 'feed' ? 75 : 50)}rad)` }} />
      </button>
      {open && (
        <div className="hmi-dial-popover">
          {children}
          <button type="button" className="hmi-adjust-close" onClick={() => setOpen(false)}>
            {L('Hotovo', 'Done')}
          </button>
        </div>
      )}
    </div>
  );
}

export function HmiFullscreen({
  apiRef,
  ui,
  tele,
  model,
  onClose,
  brand = 'HERMLE',
  controller = 'HEIDENHAIN · TNC 640',
  compactOnly = false,
}) {
  const rootRef = useRef(null),
    closeRef = useRef(null),
    canvasRef = useRef(null);
  const paint = () => {
    const source = apiRef.current.getHmiCanvas?.(),
      canvas = canvasRef.current;
    if (source && canvas) canvas.getContext('2d').drawImage(source, 0, 0);
  };
  const touch = useTouchScreen(apiRef, paint);
  useEffect(() => {
    const previous = document.activeElement,
      overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus({ preventScroll: true });
    const keydown = (e) => {
      if (document.querySelector('.work-area-dialog[open]')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const els = [...rootRef.current.querySelectorAll('button,input,[tabindex="0"]')].filter(
        (el) => !el.disabled && el.getClientRects().length,
      );
      const first = els[0],
        last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', keydown, true);
    let raf,
      last = -1;
    const draw = (now) => {
      raf = requestAnimationFrame(draw);
      if (now - last < 65) return;
      last = now;
      const source = apiRef.current.getHmiCanvas?.(),
        canvas = canvasRef.current;
      if (source && canvas) {
        if (canvas.width !== source.width) canvas.width = source.width;
        if (canvas.height !== source.height) canvas.height = source.height;
        canvas.getContext('2d').drawImage(source, 0, 0);
      }
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', keydown, true);
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  const names = {
    start: L('Štart cyklu', 'Cycle start'),
    hold: L('Stop posuvu', 'Feed hold'),
    emergency: ui.estop ? L('Uvoľniť núdzový STOP', 'Release Emergency STOP') : L('Núdzový STOP', 'Emergency STOP'),
    reset: 'Reset',
    light: L('Pracovné osvetlenie', 'Work light'),
    single: L('Blok po bloku', 'Single block'),
    coolant: L('Chladenie', 'Coolant'),
  };
  const active = { emergency: ui.estop, light: ui.light, single: ui.single, coolant: !!tele.cool };
  const act = (id) => apiRef.current.hmiAction?.(id);
  const override = (id, key, min, max) => (
    <Override
      label={id === 'feed' ? L('Korekcia posuvu', 'Feed override') : L('Korekcia rýchloposuvu', 'Rapid override')}
      value={ui[key]}
      min={min}
      max={max}
      onChange={(v) => apiRef.current.setHmiOverride?.(key, v)}
    />
  );
  const mainButton = (id) => (
    <button
      type="button"
      className={`hmi-machine-button hmi-${id}`}
      aria-label={names[id]}
      title={names[id]}
      aria-pressed={id === 'emergency' ? ui.estop : undefined}
      onClick={() => act(id)}
    >
      {id === 'start' ? '▶' : id === 'hold' ? '■' : 'STOP'}
    </button>
  );
  const message =
    tele.alarm?.text ||
    tele.msg ||
    (ui.door || tele.serviceDoorOpen
      ? L('Dvere otvorené', 'Doors open')
      : tele.run
        ? L('Chod programu', 'Program running')
        : L('Pripravený', 'Ready'));
  return createPortal(
    <div
      ref={rootRef}
      className={`hmi-fullscreen ${compactOnly ? 'rms-fullscreen' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="hmi-full-title"
      onKeyDown={(e) => e.stopPropagation()}
    >
      <header className="hmi-full-toolbar">
        <strong id="hmi-full-title">
          {brand} {model} <span>{controller}</span>
        </strong>
        <span className={`hmi-full-message ${tele.alarm ? 'alarm' : ''}`} role="status">
          {message}
        </span>
        <WorkAreaButton apiRef={apiRef} />
        <SoundToggle className="scene-btn" />
        <button
          ref={closeRef}
          type="button"
          className="scene-btn hmi-exit"
          onClick={onClose}
          aria-label={L('Späť k stroju', 'Back to machine')}
          title={L('Späť k stroju', 'Back to machine')}
        >
          ×
        </button>
      </header>
      <section className="hmi-live-display" aria-label={L('Displej HMI', 'HMI display')}>
        <div className={`hmi-screen-bezel ${compactOnly ? 'rms-reference-bezel' : 'hermle-screen-bezel'}`}>
          {!compactOnly &&
            monitor.keys.map((k, i) => (
              <span
                key={i}
                className="hmi-monitor-key"
                style={{
                  left: `${(k.x / monitor.width + 0.5) * 100}%`,
                  top: `${(1 - k.y / monitor.height) * 100}%`,
                  width: `${(k.width / monitor.width) * 100}%`,
                  height: `${(k.height / monitor.height) * 100}%`,
                }}
                aria-hidden="true"
              />
            ))}
          <canvas ref={canvasRef} width="640" height="460" {...touch} aria-label={cncScreenLabel()} />
        </div>
        {compactOnly && (
          <aside className="rms-reference-pendant" aria-label={L('Ručný panel Röders', 'Röders hand pendant')}>
            <button
              className="reference-key emergency"
              aria-label={names.emergency}
              aria-pressed={ui.estop}
              onClick={() => act('emergency')}
            >
              STOP
            </button>
            <strong>
              röders<small>TEC</small>
            </strong>
            <div>
              <button aria-label={names.start} onClick={() => act('start')}>
                ▶
              </button>
              <button aria-label={names.hold} onClick={() => act('hold')}>
                ■
              </button>
              <button aria-label={names.reset} onClick={() => act('reset')}>
                ↺
              </button>
              <button aria-label={names.light} onClick={() => act('light')}>
                ☼
              </button>
            </div>
            <i aria-hidden="true" />
          </aside>
        )}
      </section>
      {compactOnly ? (
        <section className="rms-reference-controls">
          <TerminalDeck apiRef={apiRef} ui={ui} rms />
        </section>
      ) : (
        <section
          className={`hmi-full-controls ${compactOnly ? 'rms-controls' : ''}`}
          aria-label={L('Ovládacie prvky HMI', 'HMI controls')}
        >
          <div className="hmi-console-deck">
            {hmiKeyLayout().map((k, i) => {
              const style = {
                ...position(k),
                width: `${(k.w / layout.width) * 100}%`,
                height: `${(k.d / layout.depth) * 100}%`,
              };
              return k.control ? (
                <button
                  key={i}
                  type="button"
                  className={`hmi-key hmi-key-${k.mat}`}
                  style={style}
                  title={names[k.control]}
                  aria-label={names[k.control]}
                  aria-pressed={active[k.control]}
                  onClick={() => act(k.control)}
                >
                  {k.label}
                </button>
              ) : (
                <span key={i} className={`hmi-key hmi-key-${k.mat} hmi-key-static`} style={style} aria-hidden="true">
                  {k.label}
                </span>
              );
            })}
            <Brand brand={brand} />
            {Object.entries(layout.buttons).map(([id, p]) => (
              <div
                key={id}
                className="hmi-control-position"
                style={{
                  ...position(p),
                  width: `${((p.r * 2) / layout.width) * 100}%`,
                  height: `${((p.r * 2) / layout.depth) * 100}%`,
                }}
              >
                {mainButton(id)}
              </div>
            ))}
            {Object.keys(layout.dials).map((id) => (
              <Dial
                key={id}
                id={id}
                value={ui[id === 'feed' ? 'fo' : 'ro']}
                onChange={(v) => apiRef.current.setHmiOverride?.(id === 'feed' ? 'fo' : 'ro', v)}
              >
                {override(id, id === 'feed' ? 'fo' : 'ro', id === 'feed' ? 0 : 5, id === 'feed' ? 150 : 100)}
              </Dial>
            ))}
            {['selector', 'keySwitch', 'blank', 'trackball'].map((id) => {
              const p = layout[id];
              return (
                <span
                  key={id}
                  className={`hmi-decoration hmi-${id}`}
                  style={{
                    ...position(p),
                    width: `${((p.r * 2) / layout.width) * 100}%`,
                    height: `${((p.r * 2) / layout.depth) * 100}%`,
                  }}
                  aria-hidden="true"
                />
              );
            })}
          </div>
          <div className="hmi-compact-controls">
            <div className="hmi-compact-buttons">
              {['start', 'hold', 'emergency'].map((id) => (
                <span key={id}>{mainButton(id)}</span>
              ))}
              {['reset', 'light', 'single', 'coolant'].map((id) => (
                <button
                  key={id}
                  type="button"
                  className="hmi-key"
                  aria-label={names[id]}
                  aria-pressed={active[id]}
                  onClick={() => act(id)}
                  title={names[id]}
                >
                  {{ reset: '↺', light: '☼', single: '1', coolant: '≈' }[id]}
                </button>
              ))}
            </div>
            {override('feed', 'fo', 0, 150)}
            {override('rapid', 'ro', 5, 100)}
          </div>
        </section>
      )}
    </div>,
    document.body,
  );
}
