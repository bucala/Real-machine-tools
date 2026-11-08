// Meranie výkonu na skutočnom počítači: živé FPS, vykreslenia a trojuholníky posledného snímku a test,
// ktorý 12 s otáča kamerou (rovnako ako ťahanie myšou) a zhrnie výsledok na skopírovanie.
// Zapína sa parametrom ?perf alebo v Pomocníkovi scény. Údaje scény číta z globalThis.__rmtStage (core/stage.js).
import { useEffect, useRef, useState } from 'react';
import { L } from '../core/i18n';

const stage = () => globalThis.__rmtStage || null;

function gpuName() {
  try {
    const gl = stage()?.renderer.getContext();
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    return (ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) || (gl && gl.getParameter(gl.RENDERER)) || '?';
  } catch {
    return '?';
  }
}
const pct = (arr, p) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};

// syntetické ťahanie po plátne – orbit kamery reaguje rovnako ako na myš
function drag(dom, phase, x, y) {
  const r = dom.getBoundingClientRect();
  const ev = new PointerEvent(phase, {
    bubbles: true,
    cancelable: true,
    pointerId: 77,
    pointerType: 'mouse',
    button: 0,
    buttons: phase === 'pointerup' ? 0 : 1,
    clientX: r.left + r.width / 2 + x,
    clientY: r.top + r.height / 2 + y,
  });
  dom.dispatchEvent(ev);
}

export function PerfOverlay({ onClose }) {
  const [live, setLive] = useState(null),
    [result, setResult] = useState(null),
    [running, setRunning] = useState(false),
    [note, setNote] = useState('');
  const frames = useRef([]);
  // živé meranie: intervaly medzi snímkami prehliadača (ťažká scéna ich predlžuje)
  useEffect(() => {
    let raf,
      prev = performance.now(),
      shown = prev;
    const loop = (t) => {
      raf = requestAnimationFrame(loop);
      frames.current.push(t - prev);
      if (frames.current.length > 240) frames.current.shift();
      prev = t;
      if (t - shown > 500) {
        shown = t;
        const f = frames.current.slice(-60),
          avg = f.reduce((a, b) => a + b, 0) / Math.max(1, f.length),
          st = stage()?.stats();
        setLive({
          fps: 1000 / avg,
          ms: avg,
          calls: st?.calls || 0,
          triangles: st?.triangles || 0,
          quality: st?.quality || 0,
        });
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const run = () => {
    const s = stage();
    if (!s || running) return;
    setRunning(true);
    setResult(null);
    const dom = s.dom,
      dts = [],
      calls = [],
      tris = [],
      t0 = performance.now(),
      dur = 12000;
    let prev = t0,
      x = 0;
    drag(dom, 'pointerdown', 0, 0);
    const step = (t) => {
      dts.push(t - prev);
      prev = t;
      const st = s.stats();
      calls.push(st.calls);
      tris.push(st.triangles);
      x += 6; // ~ celý obeh kamery za test
      drag(dom, 'pointermove', (x % 400) - 200, Math.sin((t - t0) / 1500) * 40);
      if (t - t0 < dur) requestAnimationFrame(step);
      else {
        drag(dom, 'pointerup', 0, 0);
        const avg = dts.reduce((a, b) => a + b, 0) / dts.length;
        setResult({
          fps: 1000 / avg,
          p95: pct(dts, 0.95),
          minFps: 1000 / Math.max(...dts),
          calls: Math.round(calls.reduce((a, b) => a + b, 0) / calls.length),
          tris: Math.round(tris.reduce((a, b) => a + b, 0) / tris.length),
          quality: s.stats().quality,
          frames: dts.length,
        });
        setRunning(false);
      }
    };
    requestAnimationFrame(step);
  };

  const text = () => {
    const r = result,
      c = stage()?.renderer.domElement;
    return [
      `Real machine tools – test výkonu (${new Date().toLocaleString()})`,
      `Stroj: ${window.location.hash.replace('#', '') || 'menu'}${/[?&]noopt\b/.test(window.location.search) ? ' (bez optimalizácie)' : ''}`,
      `GPU: ${gpuName()}`,
      `Prehliadač: ${navigator.userAgent}`,
      `Plátno: ${c ? `${c.width} × ${c.height}` : '?'} px, devicePixelRatio ${window.devicePixelRatio}`,
      r
        ? `FPS priemer ${r.fps.toFixed(1)} · min ${r.minFps.toFixed(1)} · 95 % snímok do ${r.p95.toFixed(1)} ms · ${r.frames} snímok`
        : '',
      r ? `Vykreslenia (draw calls) ${r.calls} · trojuholníky ${r.tris} · úroveň zníženia kvality ${r.quality}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text());
      setNote(L('Skopírované do schránky.', 'Copied to clipboard.'));
    } catch {
      setNote(L('Kopírovanie nie je povolené – označ text nižšie.', 'Copying is blocked – select the text below.'));
    }
  };
  const verdict = result
    ? result.fps >= 45
      ? L('plynulé', 'smooth')
      : result.fps >= 25
        ? L('použiteľné', 'usable')
        : L(
            'trhané – zatvor ostatné karty a programy, zmenši okno prehliadača alebo zapni hardvérovú akceleráciu',
            'choppy – close other tabs and programs, make the browser window smaller or enable hardware acceleration',
          )
    : '';
  return (
    <div
      className="perf-overlay pointer-events-auto"
      role="region"
      aria-label={L('Meranie výkonu', 'Performance test')}
    >
      <div className="flex items-center justify-between gap-2">
        <b>{L('Výkon', 'Performance')}</b>
        <button
          type="button"
          className="help-x"
          onClick={onClose}
          aria-label={L('Zavrieť meranie výkonu', 'Close performance test')}
        >
          ×
        </button>
      </div>
      {live && (
        <p className="tnum">
          {live.fps.toFixed(0)} FPS · {live.ms.toFixed(1)} ms · {live.calls} {L('vykreslení', 'draw calls')} ·{' '}
          {(live.triangles / 1000).toFixed(0)}k {L('trojuh.', 'tris')}
          {live.quality ? ` · ${L('kvalita', 'quality')} −${live.quality}` : ''}
        </p>
      )}
      <button type="button" className="btn mt-1" disabled={running} onClick={run}>
        {running
          ? L('Meriam… (12 s, kamera sa otáča)', 'Measuring… (12 s, camera orbits)')
          : L('Spustiť test (12 s)', 'Run test (12 s)')}
      </button>
      {result && (
        <>
          <p className="tnum mt-1">
            <b>{result.fps.toFixed(1)} FPS</b> ({verdict}) · min {result.minFps.toFixed(0)} · p95{' '}
            {result.p95.toFixed(0)} ms · {result.calls} {L('vykreslení', 'draw calls')}
          </p>
          <button type="button" className="btn mt-1" onClick={copy}>
            {L('Kopírovať výsledok', 'Copy result')}
          </button>
          {note && <p className="muted">{note}</p>}
          <textarea
            className="perf-text mt-1"
            readOnly
            rows={6}
            value={text()}
            aria-label={L('Výsledok testu', 'Test result')}
          />
        </>
      )}
    </div>
  );
}
