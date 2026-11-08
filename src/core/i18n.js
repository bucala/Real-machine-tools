// Jazyk (SK / EN), vzhľad a systémové predvoľby.
import React from 'react';

// ---------- jazyk a vzhľad (skin) ----------
const PREFS = { lang: 'sk', skin: 'green', sound: false };
try {
  const s = JSON.parse(localStorage.getItem('rmt-prefs') || '{}');
  if (s.lang === 'sk' || s.lang === 'en') PREFS.lang = s.lang;
  if (['green', 'dark', 'light'].includes(s.skin)) PREFS.skin = s.skin;
  // Every new application session starts muted, including previously saved sound=true.
} catch (err) { /* bez uložených nastavení */ }
try { document.documentElement.dataset.skin = PREFS.skin; document.documentElement.lang = PREFS.lang; } catch (err) { /* ignorované */ }
const L = (sk, en) => (PREFS.lang === 'en' ? en : sk);
// text vyhodnotený až pri zobrazení – pre popisy ovládacích prvkov vytvorené raz pri stavbe scény
const LL = (sk, en) => ({ toString: () => L(sk, en) });
const RPM = () => L('ot/min', 'rpm');
// používateľ si v systéme vyžiadal obmedzenie pohybu – bez blikania a zábleskov
const REDUCED_MOTION = (() => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (err) { return false; } })();
const PrefsCtx = React.createContext({ prefs: PREFS, setPref: () => {} });

export { L, LL, PREFS, PrefsCtx, REDUCED_MOTION, RPM };
