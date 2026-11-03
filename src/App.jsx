// Hlavné menu, výber stroja a smerovanie podľa URL (#sustruh, #freza, …).
import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { L, PREFS, PrefsCtx } from './core/i18n';
import { setSoundOn } from './core/sound';
import { BandSawArt, BenderArt, CylGrinderArt, DrillArt, FolderArt, GrinderArt, HobberArt, HorizArt, LatheArt, MigArt, MillArt, PlateRollArt, RadialArt, ShaperArt, SlotterArt, WelderArt } from './ui/art';
import { PrefBar } from './ui/common';

// každý stroj je samostatný súbor – načíta sa až pri otvorení, menu sa tak zobrazí bez three.js
const LatheSimulator = lazy(() => import('./machines/lathe'));
const MillSimulator = lazy(() => import('./machines/mill'));
const DrillSimulator = lazy(() => import('./machines/drill'));
const RadialSimulator = lazy(() => import('./machines/radial'));
const HorizSimulator = lazy(() => import('./machines/horiz'));
const HobberSimulator = lazy(() => import('./machines/hob'));
const FolderSimulator = lazy(() => import('./machines/folder'));
const BenderSimulator = lazy(() => import('./machines/bender'));
const PlateRollSimulator = lazy(() => import('./machines/plate'));
const GrinderSimulator = lazy(() => import('./machines/grinder'));
const CylGrinderSimulator = lazy(() => import('./machines/cylgrind'));
const ShaperSimulator = lazy(() => import('./machines/shaper'));
const SlotterSimulator = lazy(() => import('./machines/slotter'));
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
  { id: 'odvalovacka', Art: HobberArt, Comp: HobberSimulator, t: () => ({
    meta: L('Odvalovacia frézka', 'Gear hobber'), name: L('Odvalovacia frézka na ozubenie', 'Gear hobbing machine'), model: 'TOS Čelákovice',
    desc: L('Výroba čelných ozubených kolies odvalovaním: výmenné kolesá delenia i = 24 / z, sklon frézy na stúpací uhol, radiálny prísuv na hĺbku 2,25 · m, zvislý posuv a kontrola rozmeru cez zuby Wk.', 'Generating spur gears by hobbing: index change gears i = 24 / z, hob swivel to the lead angle, radial infeed to 2.25 · m, vertical feed and span-over-teeth Wk check.'),
    specs: [L('Modul 2, z 20 – 40', 'Module 2, z 20 – 40'), L('Fréza Ø70 jednochodá', 'Single-start Ø70 hob'), L('Kontrola Wk ±0,05', 'Wk check ±0.05')] }) },
  { id: 'radialka', Art: RadialArt, Comp: RadialSimulator, t: () => ({
    meta: L('Radiálna vŕtačka', 'Radial drill'), name: L('Radiálna vŕtačka', 'Radial drilling machine'), model: 'TOS VR / VO',
    desc: L('Vŕtanie veľkých dosiek a prírub bez posúvania obrobku: rameno sa otáča okolo stĺpa a zdvíha motorom, vreteník jazdí po ramene, upínanie stĺpa a vreteníka, automatický posuv s hĺbkovým dorazom.', 'Drilling large plates and flanges without moving the work: the arm swings around the column and is raised by a motor, the head travels along the arm, column and head clamps, power feed with a depth stop.'),
    specs: [L('Vŕtanie do Ø40 mm', 'Drilling up to Ø40 mm'), L('Vyloženie 320 – 1240 mm', 'Reach 320 – 1240 mm'), L('12 otáčok 32 – 1400 ot/min', '12 speeds 32 – 1400 rpm')] }) },
  { id: 'horizontalka', Art: HorizArt, Comp: HorizSimulator, t: () => ({
    meta: L('Horizontálka', 'Horizontal borer'), name: L('Horizontálna vŕtačka a frézka', 'Horizontal boring mill'), model: 'TOS Varnsdorf W',
    desc: L('Vyvrtávanie otvorov v skriňových odliatkoch: vreteník na stojane, vysúvacie vreteno W, krížový stôl a otočný stôl s aretáciou po 90°, mikrometrická vyvrtávacia hlava a priehyb tyče podľa vyloženia.', 'Boring holes in box castings: headstock on the column, extending W spindle, compound table and a rotary table locking every 90°, micrometer boring head and bar deflection by overhang.'),
    specs: [L('Vreteno W 500 mm', 'Spindle W 500 mm'), L('Otočný stôl B', 'Rotary table B'), L('Otvor Ø80 H7', 'Hole Ø80 H7')] }) },
  { id: 'ohybacka', Art: FolderArt, Comp: FolderSimulator, t: () => ({
    meta: L('Ohýbačka', 'Folder'), name: L('Výkyvná ohýbačka plechu', 'Manual swing-beam folder'), model: 'FASTI 204-10-2',
    desc: L('Ručné ohýbanie plechu: upnutie kolesom cez dve skrutky, vykývnutie ohýbacej lišty a odpruženie plechu podľa hrúbky.', 'Manual sheet folding: clamping by handwheel through two screws, swinging the folding beam and springback according to thickness.'),
    specs: [L('Dĺžka ohybu 1 040 mm', 'Bending length 1,040 mm'), L('Plech do 2 mm', 'Sheet up to 2 mm'), L('Uhol ohybu do 130°', 'Bend angle up to 130°')] }) },
  { id: 'profilova', Art: BenderArt, Comp: BenderSimulator, t: () => ({
    meta: L('Profilová ohýbačka', 'Section bender'), name: L('Zakružovačka profilov', 'Section and profile bender'), model: 'COMAC 3025 HV',
    desc: L('Zakružovanie plochých tyčí, rúr, jäklov a uholníkov tromi poháňanými valcami: prísuv stredného valca, odpruženie po ohybe, tvarové valce, bočné vodiace kladky a pracovná poloha vodorovná aj zvislá.', 'Rolling flat bars, tubes, square tubes and angles with three driven rolls: centre-roll feed, springback after bending, forming rolls, side guide rollers and horizontal or vertical working position.'),
    specs: [L('3 poháňané valce v pyramíde', '3 driven rolls in a pyramid'), L('Pracovná poloha H aj V', 'Working position H and V'), L('Rýchlosť 3 / 5 / 8 m/min', 'Speed 3 / 5 / 8 m/min')] }) },
  { id: 'zakruzovacka', Art: PlateRollArt, Comp: PlateRollSimulator, t: () => ({
    meta: L('Zakružovačka plechu', 'Plate rolls'), name: L('Zakružovačka plechu', 'Plate bending rolls'), model: L('3 valce so zovretím', '3-roll initial pinch'),
    desc: L('Zakružovanie plechov na plášte a oblúky: zovretie horným a spodným valcom, zdvih zadného valca, odpruženie podľa hrúbky a predohnutie začiatku otočením plechu.', 'Rolling sheets into shells and arcs: pinching between the top and bottom rolls, rear roll rise, springback by thickness and pre-bending the start by turning the sheet round.'),
    specs: [L('Plech do 1 000 × 6 mm', 'Sheet up to 1,000 × 6 mm'), L('Valce Ø150 mm', 'Rolls Ø150 mm'), L('Plášť Ø500 z 3 mm', 'Shell Ø500 from 3 mm')] }) },
  { id: 'bruska', Art: GrinderArt, Comp: GrinderSimulator, t: () => ({
    meta: L('Brúska', 'Grinder'), name: L('Rovinná brúska', 'Surface grinder'), model: 'BPH 300',
    desc: L('Rovinné brúsenie na magnetickej doske: hydraulický pohyb stola tam a späť, priečny posuv na konci zdvihu, prísuv po stotinách mm, chladenie emulziou.', 'Surface grinding on a magnetic chuck: hydraulic table reciprocation, cross feed at the stroke end, infeed in hundredths of a mm, emulsion cooling.'),
    specs: [L('Kotúč Ø300 × 40 mm', 'Wheel Ø300 × 40 mm'), L('Stôl 1 – 25 m/min', 'Table 1 – 25 m/min'), L('Prísuv 0,005 mm', 'Infeed 0.005 mm')] }) },
  { id: 'gulato', Art: CylGrinderArt, Comp: CylGrinderSimulator, t: () => ({
    meta: L('Brúska na guľato', 'Cylindrical grinder'), name: L('Hrotová brúska na guľato', 'Cylindrical grinder'), model: 'TOS BUA',
    desc: L('Brúsenie hriadeľov medzi hrotmi na mikróny: hydraulický stôl s dorazmi, prísuv kotúča po 0,005 mm, automatický prísuv na obrate, vyiskrovanie, prepal pri veľkom zábere a meranie mikrometrom.', 'Grinding shafts between centres to microns: hydraulic table with dogs, 0.005 mm wheel infeed, automatic infeed at reversal, spark-out, burning at too large an infeed and micrometer measurement.'),
    specs: [L('Kotúč Ø400 × 40 mm', 'Wheel Ø400 × 40 mm'), L('Prísuv 0,005 mm', 'Infeed 0.005 mm'), L('Tolerancia h5 / h6', 'Tolerance h5 / h6')] }) },
  // priečna obrážačka: v menu skrytá, simulátor zostáva dostupný cez #obrazacka
  { id: 'obrazacka', hidden: true, Art: ShaperArt, Comp: ShaperSimulator, t: () => ({
    meta: L('Obrážačka', 'Shaper'), name: L('Priečna obrážačka', 'Shaping machine'), model: 'TOS',
    desc: L('Historický stroj školských dielní: kulisa poháňa smykadlo tam a späť s rýchlym spätným chodom, nôž v sklopnej doske reže len pri pracovnom zdvihu, stôl sa posúva západkou.', 'A classic of school workshops: the slotted link drives the ram back and forth with a quick return, the tool in the clapper box cuts only on the cutting stroke, the table is fed by a ratchet.'),
    specs: [L('Zdvih 20 – 500 mm', 'Stroke 20 – 500 mm'), L('10 – 56 zdvihov/min', '10 – 56 strokes/min'), L('Posuv 0,2 – 4 mm/zdvih', 'Feed 0.2 – 4 mm/stroke')] }) },
  { id: 'zobrazacka', Art: SlotterArt, Comp: SlotterSimulator, t: () => ({
    meta: L('Zvislá obrážačka', 'Slotting machine'), name: L('Zvislá obrážačka (drážkovačka)', 'Vertical slotter'), model: 'TOS ST 350',
    desc: L('Obrážanie drážok pre perá a tvarových otvorov v nábojoch: zvislé smykadlo s kulisovým pohonom, krížový stôl so západkovým posuvom a otočný stôl s delením.', 'Slotting keyways and shaped holes in hubs: vertical ram with a slotted-link drive, compound table with ratchet feed and an indexing rotary table.'),
    specs: [L('Zdvih 20 – 350 mm', 'Stroke 20 – 350 mm'), L('12 – 71 zdvihov/min', '12 – 71 strokes/min'), L('Otočný stôl, delenie 2 – 8', 'Rotary table, indexing 2 – 8')] }) },
  { id: 'pila', Art: BandSawArt, Comp: BandSawSimulator, t: () => ({
    meta: L('Píla', 'Saw'), name: L('Strojná pásová píla', 'Vertical band saw'), model: 'TOS PPN',
    desc: L('Rezanie dreva, hliníka a ocele pásom: napínanie pásu, nastavenie horného vodidla, voľba rýchlosti pásu podľa materiálu.', 'Cutting wood, aluminium and steel with a band: blade tensioning, upper guide setting, blade speed chosen by material.'),
    specs: [L('Kolesá Ø720 mm', 'Wheels Ø720 mm'), L('Pás 3 / 10 / 25 m/s', 'Blade 3 / 10 / 25 m/s'), L('Rez do 150 mm', 'Cut up to 150 mm')] }) },
  { id: 'zvaranie', Art: WelderArt, Comp: WeldingSimulator, t: () => ({
    meta: L('Zváranie', 'Welding'), name: L('Oblúková zváračka', 'Arc welder'), model: 'Elektrokov JS 90FN',
    desc: L('Ručné zváranie obalenou elektródou: plechy v rovine aj kolmo, rúry a tvarové diely, polohy PA – PG aj rúrové, výmena elektródy, kukla proti zábleskom a hodnotenie húsenice.', 'Manual metal arc welding: flat and perpendicular plates, pipes and shaped parts, positions PA – PG and pipe positions, electrode change, a helmet against the flash and bead assessment.'),
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
          {MACHINES.filter((m) => !m.hidden).map((m) => {
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
