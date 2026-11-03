// Hlavné menu, výber stroja a smerovanie podľa URL (#sustruh, #freza, …).
import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { L, PREFS, PrefsCtx } from './core/i18n';
import { setSoundOn } from './core/sound';
import { BandSawArt, DrillArt, FolderArt, GrinderArt, LatheArt, MigArt, MillArt, WelderArt } from './ui/art';
import { PrefBar } from './ui/common';

// každý stroj je samostatný súbor – načíta sa až pri otvorení, menu sa tak zobrazí bez three.js
const LatheSimulator = lazy(() => import('./machines/lathe'));
const MillSimulator = lazy(() => import('./machines/mill'));
const DrillSimulator = lazy(() => import('./machines/drill'));
const FolderSimulator = lazy(() => import('./machines/folder'));
const GrinderSimulator = lazy(() => import('./machines/grinder'));
const BandSawSimulator = lazy(() => import('./machines/saw'));
const WeldingSimulator = lazy(() => import('./machines/weld'));
const MigSimulator = lazy(() => import('./machines/weld').then((m) => ({ default: m.MigSimulator })));

function SimLoading() {
  return (
    <div className="boot" role="status"><i aria-hidden="true" /><b>Real machine tools</b><span>{L('Načítava sa simulátor…', 'Loading the simulator…')}</span></div>
  );
}

const MACHINES = [
  { id: 'sustruh', Art: LatheArt, Comp: LatheSimulator, t: () => ({
    meta: L('Sústruh', 'Lathe'), name: L('Konvenčný hrotový sústruh', 'Conventional centre lathe'), model: 'TOS SN / VDF',
    desc: L('Sústruženie tyčí rôznych priemerov a tvarov: štvorpolohová nožová hlava s 8 typmi nožov, mikroposuv horných saní, koník so zaistením.', 'Turning bars of various sizes and shapes: four-way tool post with 8 tool types, top-slide fine feed, lockable tailstock.'),
    specs: [L('12 otáčok 40 – 1800 ot/min', '12 speeds 40 – 1800 rpm'), L('Posuv 0,05 – 1 mm/ot', 'Feed 0.05 – 1 mm/rev'), L('DRO na ramene', 'Arm-mounted DRO')] }) },
  { id: 'freza', Art: MillArt, Comp: MillSimulator, t: () => ({
    meta: L('Fréza', 'Milling machine'), name: L('Univerzálna konzolová fréza', 'Universal knee-type milling machine'), model: 'TOS FA 3 B',
    desc: L('Konzolová fréza so sklopnou vertikálnou hlavou: frézovanie hranola alebo tyče vo zveráku stopkovými, guľovými a čelnými frézami.', 'Knee-type mill with a swivelling vertical head: milling a block or a bar in the vise with end, ball-nose and face mills.'),
    specs: [L('18 otáčok 40 – 2000 ot/min', '18 speeds 40 – 2000 rpm'), L('Posuv 19 – 950 mm/min', 'Feed 19 – 950 mm/min'), L('Zdvihy X 800 · Y 300 · Z 420 mm', 'Travel X 800 · Y 300 · Z 420 mm')] }) },
  { id: 'vrtacka', Art: DrillArt, Comp: DrillSimulator, t: () => ({
    meta: L('Vŕtačka', 'Drill'), name: L('Stĺpová vŕtačka', 'Pillar drill'), model: 'TOS SV16',
    desc: L('Vŕtanie dier Ø3 – Ø16 mm do oceľovej dosky na podložkách: priečna kľuka pinoly, zdvíhací stôl, otvory naslepo aj naskrz.', 'Drilling Ø3 – Ø16 mm holes into a steel plate on parallels: capstan quill feed, rising table, blind and through holes.'),
    specs: [L('8 otáčok 125 – 1400 ot/min', '8 speeds 125 – 1400 rpm'), L('Zdvih pinoly 100 mm', 'Quill stroke 100 mm'), L('Vŕtanie do Ø16 mm', 'Drilling up to Ø16 mm')] }) },
  { id: 'ohybacka', Art: FolderArt, Comp: FolderSimulator, t: () => ({
    meta: L('Ohýbačka', 'Folder'), name: L('Výkyvná ohýbačka plechu', 'Manual swing-beam folder'), model: 'FASTI 204-10-2',
    desc: L('Ručné ohýbanie plechu: upnutie kolesom cez dve skrutky, vykývnutie ohýbacej lišty a odpruženie plechu podľa hrúbky.', 'Manual sheet folding: clamping by handwheel through two screws, swinging the folding beam and springback according to thickness.'),
    specs: [L('Dĺžka ohybu 1 040 mm', 'Bending length 1,040 mm'), L('Plech do 2 mm', 'Sheet up to 2 mm'), L('Uhol ohybu do 130°', 'Bend angle up to 130°')] }) },
  { id: 'bruska', Art: GrinderArt, Comp: GrinderSimulator, t: () => ({
    meta: L('Brúska', 'Grinder'), name: L('Rovinná brúska', 'Surface grinder'), model: 'BPH 300',
    desc: L('Rovinné brúsenie na magnetickej doske: hydraulický pohyb stola tam a späť, priečny posuv na konci zdvihu, prísuv po stotinách mm, chladenie emulziou.', 'Surface grinding on a magnetic chuck: hydraulic table reciprocation, cross feed at the stroke end, infeed in hundredths of a mm, emulsion cooling.'),
    specs: [L('Kotúč Ø300 × 40 mm', 'Wheel Ø300 × 40 mm'), L('Stôl 1 – 25 m/min', 'Table 1 – 25 m/min'), L('Prísuv 0,005 mm', 'Infeed 0.005 mm')] }) },
  { id: 'pila', Art: BandSawArt, Comp: BandSawSimulator, t: () => ({
    meta: L('Píla', 'Saw'), name: L('Strojná pásová píla', 'Vertical band saw'), model: 'TOS PPN',
    desc: L('Rezanie dreva, hliníka a ocele pásom: napínanie pásu, nastavenie horného vodidla, voľba rýchlosti pásu podľa materiálu.', 'Cutting wood, aluminium and steel with a band: blade tensioning, upper guide setting, blade speed chosen by material.'),
    specs: [L('Kolesá Ø720 mm', 'Wheels Ø720 mm'), L('Pás 3 / 10 / 25 m/s', 'Blade 3 / 10 / 25 m/s'), L('Rez do 150 mm', 'Cut up to 150 mm')] }) },
  { id: 'zvaranie', Art: WelderArt, Comp: WeldingSimulator, t: () => ({
    meta: L('Zváranie', 'Welding'), name: L('Oblúková zváračka', 'Arc welder'), model: 'Elektrokov JS 90FN',
    desc: L('Ručné zváranie obalenou elektródou: 10 druhov zvarov so zvarovou prípravou, 4 polohy, kukla proti zábleskom a hodnotenie húsenice.', 'Manual metal arc welding: 10 joint types with edge preparation, 4 positions, a helmet against the flash and bead assessment.'),
    specs: [L('Prúd 55 – 155 A', 'Current 55 – 155 A'), L('380 / 220 V', '380 / 220 V'), L('Elektródy Ø2 – Ø4 mm', 'Electrodes Ø2 – Ø4 mm')],
    note: L('Obsahuje svetelné záblesky. Blikanie sa dá vypnúť v paneli (Efekty záblesku).', 'Contains light flashes. Flicker can be turned off in the panel (Flash effects).') }) },
  { id: 'mag', Art: MigArt, Comp: MigSimulator, t: () => ({
    meta: L('Zváranie MIG/MAG', 'MIG/MAG welding'), name: L('Zváranie v ochrannom plyne', 'Gas metal arc welder'), model: 'Fronius TransPuls Synergic TPS 450',
    desc: L('Poloautomatické zváranie drôtom v ochrannom plyne: synergický program podľa drôtu a plynu, štandardný aj impulzný oblúk, 2T / 4T, plynová fľaša a výlet drôtu.', 'Semi-automatic welding with wire under shielding gas: synergic program by wire and gas, standard and pulsed arc, 2-step / 4-step, gas cylinder and stick-out.'),
    specs: [L('Prúd 3 – 450 A', 'Current 3 – 450 A'), L('Drôt Ø0,8 – 1,2 mm', 'Wire Ø0.8 – 1.2 mm'), L('Ar + CO₂ / CO₂', 'Ar + CO₂ / CO₂')],
    note: L('Obsahuje svetelné záblesky. Blikanie sa dá vypnúť v paneli (Efekty záblesku).', 'Contains light flashes. Flicker can be turned off in the panel (Flash effects).') }) },
];
const SOON = [];

// podpora WebGL – bez nej sa 3D scéna nedá vytvoriť
let webglOk = null;
const hasWebGL = () => {
  if (webglOk !== null) return webglOk;
  try {
    const cv = document.createElement('canvas'), gl = window.WebGLRenderingContext && (cv.getContext('webgl2') || cv.getContext('webgl'));
    webglOk = !!gl;
    if (gl) { const ext = gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); }   // skúšobný kontext hneď uvoľniť
  } catch (err) { webglOk = false; }
  return webglOk;
};

// návod pri chýbajúcom WebGL: ako zapnúť akceleráciu grafiky alebo kde stiahnuť aktuálny prehliadač
const BROWSERS = [['Chrome', 'https://www.google.com/chrome/'], ['Firefox', 'https://www.mozilla.org/firefox/new/'], ['Edge', 'https://www.microsoft.com/edge/download']];
function WebGLHelp() {
  return (
    <div className="text-sm" style={{ lineHeight: 1.5 }}>
      <ul className="ctl-list" style={{ marginTop: 6 }}>
        <li><b>Chrome / Edge:</b> {L('Nastavenia → Systém → zapni „Použiť grafickú akceleráciu, keď je k dispozícii“ a reštartuj prehliadač.', 'Settings → System → turn on “Use graphics acceleration when available” and restart the browser.')}</li>
        <li><b>Firefox:</b> {L('Nastavenia → Všeobecné → Výkon → zruš „Použiť odporúčané nastavenia výkonu“ a zapni „Použiť hardvérovú akceleráciu, ak je dostupná“.', 'Settings → General → Performance → untick “Use recommended performance settings” and tick “Use hardware acceleration when available”.')}</li>
        <li><b>Safari:</b> {L('WebGL je zapnuté v aktuálnej verzii macOS / iOS – aktualizuj systém.', 'WebGL is on in current macOS / iOS – update the system.')}</li>
        <li>{L('Pomôcť môže aj aktualizácia ovládača grafickej karty.', 'Updating the graphics driver can also help.')}</li>
      </ul>
      <p className="mt-2">{L('Alebo stiahni aktuálny prehliadač:', 'Or download a current browser:')}{' '}
        {BROWSERS.map(([n, u], i) => <span key={n}>{i ? ' · ' : ''}<a href={u} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'underline' }}>{n}</a></span>)}
      </p>
    </div>
  );
}

// zachytí chybu pri stavbe alebo behu simulátora – namiesto prázdnej stránky zobrazí hlášku a cestu späť
class SimBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err) { try { console.error(err); } catch (e) { /* ignorované */ } }
  render() {
    if (!this.state.err) return this.props.children;
    const gl = hasWebGL();
    const msg = String((this.state.err && this.state.err.message) || this.state.err);
    const net = /dynamically imported module|Importing a module script failed|Failed to fetch|error loading/i.test(msg);
    return (
      <main className="menu">
        <div className="menu-inner">
          <p className="menu-kicker">Real machine tools</p>
          <h1 className="menu-title" tabIndex={-1}>{L('Simulátor sa nepodarilo spustiť', 'The simulator could not start')}</h1>
          <p className="menu-lead">{net
            ? L('Súbor simulátora sa nepodarilo stiahnuť – skontroluj pripojenie na internet a stránku načítaj znova.', 'The simulator file could not be downloaded – check your internet connection and reload the page.')
            : gl
            ? L('Pri stavbe 3D scény nastala chyba. Skús stránku načítať znova; ak sa chyba opakuje, skús iný prehliadač.', 'An error occurred while building the 3D scene. Try reloading the page; if it happens again, try another browser.')
            : L('Prehliadač nepodporuje WebGL alebo je v ňom vypnutá hardvérová akcelerácia grafiky. Zapni ju alebo použi aktuálny prehliadač:', 'The browser does not support WebGL or hardware graphics acceleration is turned off. Turn it on or use a current browser:')}</p>
          {!net && !gl && <div className="desc" style={{ maxWidth: '62ch' }}><WebGLHelp /></div>}
          <p className="text-xs muted mt-3" style={{ fontFamily: 'var(--f-mono)' }}>{msg}</p>
          <div className="flex gap-2 mt-6 flex-wrap">
            <button type="button" className="btn" onClick={this.props.onBack}>← {L('Späť do menu', 'Back to menu')}</button>
            <button type="button" className="btn" onClick={() => window.location.reload()}>{L('Načítať znova', 'Reload')}</button>
          </div>
        </div>
      </main>
    );
  }
}

function Menu({ onOpen }) {
  const [gl] = useState(hasWebGL);
  const [hideGl, setHideGl] = useState(false);
  return (
    <main className="menu">
      <div className="menu-inner">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="menu-kicker">Real machine tools</p>
          <PrefBar />
        </div>
        <h1 className="menu-title" tabIndex={-1}>{L('Simulátory konvenčných obrábacích strojov', 'Conventional machine tool simulators')}</h1>
        <p className="menu-lead">{L('Vyber stroj. Každý model je zostavený v 3D, dá sa otáčať, rezať v ňom a v režime ručného ovládania sa obsluhuje kolesami, pákami a tlačidlami ako skutočný stroj.', 'Choose a machine. Every model is built in 3D; you can orbit it, cut with it and, in manual mode, operate it with handwheels, levers and buttons like the real thing.')}</p>
        {!gl && !hideGl && (
          <div className="msg-warn" role="note" style={{ maxWidth: '68ch', marginTop: 14, padding: '10px 14px', borderRadius: 9, border: '1px solid var(--border)' }}>
            <div className="flex items-start justify-between gap-3">
              <b>{L('Upozornenie: prehliadač nehlási podporu WebGL', 'Notice: the browser reports no WebGL support')}</b>
              <button type="button" className="btn" style={{ padding: '2px 8px' }} onClick={() => setHideGl(true)} aria-label={L('Skryť upozornenie', 'Hide notice')}>✕</button>
            </div>
            <p className="text-sm mt-1" style={{ color: 'var(--text)' }}>{L('3D simulátory ho potrebujú. Skús stroj aj tak otvoriť – ak sa nespustí, zapni hardvérovú akceleráciu alebo použi iný prehliadač.', 'The 3D simulators need it. Try opening a machine anyway – if it does not start, turn on hardware acceleration or use another browser.')}</p>
            <div style={{ color: 'var(--text)' }}><WebGLHelp /></div>
          </div>
        )}
        <div className="grid gap-5 mt-8 md:grid-cols-2 xl:grid-cols-3">
          {MACHINES.map((m) => {
            const tx = m.t();
            return (
              <button key={m.id} type="button" className="card" onClick={() => onOpen(m.id)}>
                <div className="card-art"><m.Art /></div>
                <div className="card-body">
                  <span className="card-meta">{tx.meta}</span>
                  <span className="card-name">{tx.name}</span>
                  <span className="text-sm muted" style={{ lineHeight: 1.45 }}>{tx.desc}</span>
                  <span className="text-sm"><span className="muted">{L('Predloha', 'Modelled after')}:</span> <b>{tx.model}</b></span>
                  <span className="spec">{tx.specs.map((s) => <span key={s}>{s}</span>)}</span>
                  {tx.note && <span className="text-xs" style={{ color: 'var(--warn)' }}>⚠ {tx.note}</span>}
                  <span className="card-cta">{L('Spustiť simulátor →', 'Open simulator →')}</span>
                </div>
              </button>
            );
          })}
        </div>
        {SOON.length > 0 && <h2 className="sec-title mb-4" style={{ fontSize: 15, marginTop: 40 }}>{L('Pripravujeme', 'Coming soon')}</h2>}
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {SOON.map((m) => {
            const tx = m.t();
            return (
              <div key={m.id} className="card soon" aria-disabled="true">
                <div className="card-art"><m.Art /></div>
                <div className="card-body">
                  <span className="card-meta">{tx.meta}</span>
                  <span className="card-name">{tx.name}</span>
                  <span className="text-sm muted" style={{ lineHeight: 1.45 }}>{tx.desc}</span>
                  <span className="mt-auto pt-2"><span className="badge">{L('Pripravujeme', 'Coming soon')}</span></span>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs muted mt-8">{L('Mierka modelov 1 : 100 mm · ovládanie myšou alebo dotykom · kláves M prepína na ručné ovládanie prvkov stroja · po prvej návšteve fungujú simulátory aj bez internetu a dajú sa nainštalovať ako aplikácia.', 'Model scale 1 : 100 mm · mouse or touch control · the M key switches to manual control of the machine elements · after the first visit the simulators also work offline and can be installed as an app.')}</p>
      </div>
    </main>
  );
}

function App() {
  const readRoute = () => { try { return (window.location.hash || '').replace('#', ''); } catch (err) { return ''; } };
  const [route, setRoute] = useState(readRoute);
  const [prefs, setPrefs] = useState({ ...PREFS });
  const moved = useRef(false);
  const setPref = (k, v) => {
    PREFS[k] = v; const n = { ...PREFS }; setPrefs(n);
    try { localStorage.setItem('rmt-prefs', JSON.stringify(n)); } catch (err) { /* bez uloženia */ }
    try { document.documentElement.dataset.skin = n.skin; document.documentElement.lang = n.lang; } catch (err) { /* ignorované */ }
    if (k === 'sound') setSoundOn(v);
  };
  useEffect(() => {
    const sync = () => { moved.current = true; setRoute(readRoute()); };
    window.addEventListener('hashchange', sync); window.addEventListener('popstate', sync);
    return () => { window.removeEventListener('hashchange', sync); window.removeEventListener('popstate', sync); };
  }, []);
  useEffect(() => { document.title = L('Simulátory obrábacích strojov', 'Machine tool simulators'); }, [prefs.lang]);
  // po prechode menu ↔ stroj presunie fokus na hlavný nadpis (čítačky obrazovky, klávesnica)
  useEffect(() => {
    if (!moved.current) return undefined;
    // simulátor sa načítava postupne – počká sa, kým sa nadpis objaví (najviac ~5 s)
    let n = 0, raf = 0;
    const tryFocus = () => {
      const h = document.querySelector('.app-title, .menu-title');
      if (h) { try { h.focus({ preventScroll: true }); } catch (err) { /* ignorované */ } }
      else if (n++ < 300) raf = requestAnimationFrame(tryFocus);
    };
    tryFocus();
    return () => cancelAnimationFrame(raf);
  }, [route]);
  const go = (id) => {
    moved.current = true;
    setRoute(id);
    try {
      if (id) window.location.hash = id;
      else window.history.pushState('', document.title, window.location.pathname + window.location.search);
    } catch (err) { /* ignorované */ }
    window.scrollTo(0, 0);
  };
  // #stroj alebo #stroj/uloha=… (odkaz učiteľa na konkrétnu úlohu)
  const [mid, query = ''] = route.split('/');
  const m = MACHINES.find((x) => x.id === mid);
  const params = Object.fromEntries(new URLSearchParams(query));
  return (
    <PrefsCtx.Provider value={{ prefs, setPref }}>
      {m ? <SimBoundary key={m.id} onBack={() => go('')}><Suspense fallback={<SimLoading />}><m.Comp lang={prefs.lang} params={params} onBack={() => go('')} /></Suspense></SimBoundary> : <Menu onOpen={go} />}
    </PrefsCtx.Provider>
  );
}

export default App;
