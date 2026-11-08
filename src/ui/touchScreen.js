// Dotykový displej HMI na plátne: poloha ukazovateľa → súradnice obrazovky stroja, klik, ťahanie posuvníkov
// a klávesnica. Stroj dodá cez apiRef: hmiPoint(x, y, drag) → zásah { id, drag? } alebo null,
// hmiHover(x, y) → bool, hmiKey(key) → zásah alebo null.
import { useRef } from 'react';

// plátno môže byť vpísané (object-fit: contain) alebo roztiahnuté (fill) – prepočet podľa skutočného zobrazenia
export function screenPoint(canvas, e) {
  const r = canvas.getBoundingClientRect(),
    W = canvas.width,
    H = canvas.height;
  if (getComputedStyle(canvas).objectFit === 'contain') {
    const s = Math.min(r.width / W, r.height / H);
    return [(e.clientX - r.left - (r.width - W * s) / 2) / s, (e.clientY - r.top - (r.height - H * s) / 2) / s];
  }
  return [((e.clientX - r.left) * W) / r.width, ((e.clientY - r.top) * H) / r.height];
}

export function useTouchScreen(apiRef, paint = () => {}) {
  const drag = useRef(null);
  const down = (e) => {
    const hit = apiRef.current.hmiPoint?.(...screenPoint(e.currentTarget, e));
    if (!hit) return;
    e.preventDefault();
    if (hit.drag) {
      drag.current = hit.drag;
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    paint();
  };
  const move = (e) => {
    const p = screenPoint(e.currentTarget, e);
    if (drag.current) {
      apiRef.current.hmiPoint?.(...p, drag.current);
      paint();
    } else e.currentTarget.style.cursor = apiRef.current.hmiHover?.(...p) ? 'pointer' : '';
  };
  const up = () => {
    drag.current = null;
  };
  const key = (e) => {
    if (apiRef.current.hmiKey?.(e.key)) {
      e.preventDefault();
      paint();
    }
  };
  return {
    tabIndex: 0,
    className: 'hmi-touch-screen',
    onPointerDown: down,
    onPointerMove: move,
    onPointerUp: up,
    onPointerCancel: up,
    onKeyDown: key,
  };
}
