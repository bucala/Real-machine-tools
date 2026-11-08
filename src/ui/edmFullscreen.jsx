import { TerminalDeck } from './terminalDeck';
import { WorkAreaButton } from './workAreaWindow';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { L } from '../core/i18n';
import { SoundToggle } from './common';

// HMI EX 500 cez celé okno: živý displej je dotykový (stránky menu, rýchlosť simulácie v stavovom riadku,
// prúd generátora) a pod ním terminál s klávesmi stroja.
export function EdmFullscreen({ apiRef, ui, tele, onClose }) {
  const canvas = useRef(null),
    root = useRef(null),
    close = useRef(null),
    drag = useRef(null);
  const paint = () => {
    const source = apiRef.current.getHmiCanvas?.();
    if (source && canvas.current) canvas.current.getContext('2d').drawImage(source, 0, 0, 1040, 650);
  };
  // poloha ukazovateľa → súradnice obrazovky 1040 × 650 (plátno je vpísané s object-fit: contain)
  const point = (e) => {
    const r = canvas.current.getBoundingClientRect(),
      s = Math.min(r.width / 1040, r.height / 650);
    return [(e.clientX - r.left - (r.width - 1040 * s) / 2) / s, (e.clientY - r.top - (r.height - 650 * s) / 2) / s];
  };
  const down = (e) => {
    const hit = apiRef.current.hmiPoint?.(...point(e));
    if (hit?.drag) {
      drag.current = hit.drag;
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    if (hit) {
      e.preventDefault();
      paint();
    }
  };
  const move = (e) => {
    if (drag.current) {
      apiRef.current.hmiPoint?.(...point(e), drag.current);
      paint();
    } else e.currentTarget.style.cursor = apiRef.current.hmiHover?.(...point(e)) ? 'pointer' : '';
  };
  const up = () => {
    drag.current = null;
  };
  const keyOnScreen = (e) => {
    if (apiRef.current.hmiKey?.(e.key)) {
      e.preventDefault();
      paint();
    }
  };
  useEffect(() => {
    const previous = document.activeElement;
    close.current.focus({ preventScroll: true });
    const key = (e) => {
      if (document.querySelector('.work-area-dialog[open]')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
      }
      if (e.key === 'Tab') {
        const nodes = [...root.current.querySelectorAll('button,input,canvas[tabindex]')].filter((o) => !o.disabled),
          first = nodes[0],
          last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', key, true);
    let raf,
      t0 = 0;
    paint();
    const draw = (t) => {
      raf = requestAnimationFrame(draw);
      if (t - t0 < 100) return;
      t0 = t;
      paint();
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', key, true);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <div
      className="hmi-fullscreen edm-fullscreen"
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-label="OSCARMAX EX 500 HMI"
      onKeyDown={(e) => e.stopPropagation()}
    >
      <header className="hmi-full-toolbar">
        <strong>
          OSCARMAX EX 500 <span>EDM</span>
        </strong>
        <span role="status">{tele.alarm || tele.phase}</span>
        <WorkAreaButton apiRef={apiRef} />
        <SoundToggle className="scene-btn" />
        <button
          className="scene-btn hmi-exit"
          ref={close}
          onClick={onClose}
          aria-label={L('Späť k stroju', 'Back to machine')}
          title={L('Späť k stroju', 'Back to machine')}
        >
          ×
        </button>
      </header>
      <section className="hmi-live-display">
        <div className="hmi-screen-bezel">
          <canvas
            ref={canvas}
            width="1040"
            height="650"
            tabIndex={0}
            className="edm-touch-screen"
            aria-label={L(
              'Živý dotykový displej EX 500: záložky menu, posuvník rýchlosti simulácie v stavovom riadku. Klávesy 1 – 6 stránky, šípky vľavo a vpravo rýchlosť, hore a dole prúd.',
              'Live EX 500 touch display: menu tabs, simulation speed slider in the status bar. Keys 1 – 6 pages, left and right arrows speed, up and down current.',
            )}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            onKeyDown={keyOnScreen}
          />
        </div>
      </section>
      <section className="edm-full-controls">
        <TerminalDeck apiRef={apiRef} ui={ui} />
      </section>
    </div>,
    document.body,
  );
}
