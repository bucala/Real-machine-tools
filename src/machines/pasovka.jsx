import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { L, LL } from '../core/i18n';
import { angleScaleTex } from '../core/detail';
import { TAU, approach, clamp } from '../core/util';
import { ExportSection, TaskSection } from '../ui/tools';
import { SectionInfo } from '../ui/sectionInfo';
import { CutDrawing } from '../ui/sketch2';
import {
  HelpFooter,
  PanelHeader,
  PartsSection,
  SceneView,
  SegRow,
  Slider,
  Toggle,
  ViewSection,
  mkParts,
  useMachine,
  useTele,
} from '../ui/common';
import { createClassicScene, mainSwitch, panelButton } from './classic/scaffold';
import { ARG, argChecks, argTask, cutWidth, piecesInfo, qMax } from './pasovkaMath';

// =====================================================================
// PÁSOVÁ PÍLA PILOUS ARG 200 PLUS – delenie tyčí, otočné rameno pre šikmé rezy
// =====================================================================
const D = ARG.D,
  TB = 8.6, // spodok tyče = lôžko zveráka
  HY = TB + 0.9, // os závesu ramena
  HZ = -2.3,
  BLY = -0.95, // pílový pás v súradniciach ramena
  BAR0 = 1000;

const argParts = () =>
  mkParts([
    [
      'stojan',
      'Stojan',
      'Base',
      'Stojan s vaňou chladiva',
      'Base with coolant tank',
      'Plechový stojan nesie otočný stôl, zverák a vaňu s čerpadlom chladiva. Predloha: Pilous ARG 200 PLUS (Česko) – kruh do Ø200 mm, pás 2 085 × 20 × 0,9 mm, šikmé rezy 60° vpravo a 45° vľavo.',
      'The sheet-metal base carries the swivel table, the vise and the coolant tank with its pump. Model: Pilous ARG 200 PLUS (Czech) – round bar up to Ø200 mm, blade 2,085 × 20 × 0.9 mm, mitre cuts 60° right and 45° left.',
    ],
    [
      'rameno',
      'Rameno',
      'Saw arm',
      'Rameno s pílovým pásom',
      'Saw arm with the band',
      'Rameno so zotrvačníkmi pásu sa otáča okolo závesu vzadu. Pri reze klesá vlastnou váhou, rýchlosť klesania tlmí hydraulický valec.',
      'The arm with the band wheels pivots about the rear hinge. It drops under its own weight while cutting; the hydraulic cylinder damps the feed.',
    ],
    [
      'zverak',
      'Zverák',
      'Vise',
      'Zverák s ručným kolesom',
      'Vise with handwheel',
      'Zverák drží tyč vľavo od pásu. Kus vpravo po dorezaní odpadne.',
      'The vise holds the bar left of the band. The piece on the right drops off when cut through.',
    ],
    [
      'doraz',
      'Doraz',
      'Length stop',
      'Dĺžkový doraz so stupnicou',
      'Length stop with scale',
      'Doraz na tyči so stupnicou meria dĺžku kusa od pravej strany pásu.',
      'The stop on a rod with a scale sets the piece length from the right side of the band.',
    ],
    [
      'tyc',
      'Tyč',
      'Bar',
      'Kruhová tyč Ø40, oceľ 11 523',
      'Round bar Ø40, steel S355',
      'Tyč 1 m z valčekového stojana sa posúva cez zverák až k dorazu.',
      'The 1 m bar is pushed from the roller stand through the vise up to the stop.',
    ],
    [
      'ovladanie',
      'Ovládanie',
      'Controls',
      'Ovládací panel',
      'Control panel',
      'Hlavný vypínač, štart, stop, prepínač rýchlosti pásu, chladenie, ventil a škrtenie hydrauliky.',
      'Main switch, start, stop, band speed switch, coolant, hydraulic valve and feed throttle.',
    ],
  ]);

const ARG_TASKS = [
  {
    id: 'kusy',
    title: () => L('Tri kusy 250 mm', 'Three pieces 250 mm'),
    desc: () =>
      L(
        'Z tyče Ø40 nareži 3 kusy dĺžky 250 ±1 mm kolmým rezom. Najprv zarovnaj nerovné čelo tyče, potom vždy: tyč k dorazu, upnúť zverák, štart, otvoriť ventil. Pre oceľ zvoľ nižšiu rýchlosť pásu a chladenie, posuv ramena drž tak, aby pás nepreťažil.',
        'Cut 3 pieces 250 ±1 mm from the Ø40 bar with square cuts. First square the rough bar end, then each time: bar to the stop, clamp the vise, start, open the valve. Use the lower band speed and coolant for steel, keep the arm feed low enough not to overload the band.',
      ),
    setup: {},
    drawing: () => <CutDrawing l={250} n={3} a={0} prof="Ø40" />,
  },
  {
    id: 'uhol',
    title: () => L('Dva kusy 150 mm pod 45°', 'Two pieces 150 mm at 45°'),
    desc: () =>
      L(
        'Uvoľni zaistenie ramena, natoč ho na 45° a zaisti. Zarovnaj čelo tyče pod 45° a nareži 2 kusy 150 ±1 mm (meraných v osi) s oboma koncami pod 45° ±0,5°.',
        'Release the arm lock, swivel it to 45° and lock it. Square the bar end at 45° and cut 2 pieces 150 ±1 mm (measured on the axis) with both ends at 45° ±0.5°.',
      ),
    setup: {},
    drawing: () => <CutDrawing l={150} n={2} a={45} prof="Ø40" />,
  },
].map((t) => {
  const [l, a, n] = argTask(t.id);
  const labels = {
    count: () => `${n} ${L('dobré kusy', 'good pieces')}`,
    len: () => `${L('Dĺžka', 'Length')} ${l} ±1 mm`,
    angle: () => `${L('Uhol koncov', 'End angle')} ${a}° ±0,5°`,
    blade: () => L('Pás nepreťažený', 'Band not overloaded'),
  };
  return { ...t, checks: (m) => argChecks[t.id](m).map((c) => ({ ...c, label: labels[c.key]() })) };
});

const ARG_SAFETY = () => [
  L(
    'Tyč je upnutá vo zveráku a podopretá valčekovým stojanom.',
    'The bar is clamped in the vise and supported by the roller stand.',
  ),
  L('Kryt pásu je zatvorený, ruky mimo dráhy ramena.', 'The band cover is closed, hands out of the arm path.'),
  L('Odrezané kusy beriem až po zastavení pásu.', 'I take the cut pieces only after the band stops.'),
];

// valec tyče pozdĺž osi x s koncami zrezanými pod uhlami aL / aR (rovina x = tg α · z)
function barGeom(len, aL, aR) {
  const r = D / 200,
    h = len / 100,
    g = new THREE.CylinderGeometry(r, r, h, 36, 1);
  g.rotateZ(-Math.PI / 2);
  const p = g.attributes.position,
    tl = Math.tan((aL * Math.PI) / 180),
    tr = Math.tan((aR * Math.PI) / 180);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      z = p.getZ(i);
    p.setX(i, x > 0 ? h / 2 + tr * z : -h / 2 + tl * z);
  }
  g.computeVertexNormals();
  return g;
}

function PasovkaSimulator({ onBack, params }) {
  const mountRef = useRef(null),
    layerRef = useRef(null),
    tipRef = useRef(null);
  const init = {
    power: true,
    running: false,
    sp: 0,
    cool: true,
    feed: 1,
    valve: false,
    lock: true,
    a: 0,
    g: 70,
    stopL: 100,
    xe: 12,
    yb: 140,
    light: true,
    manual: false,
    timeScale: 3,
  };
  const { ctl, ui, setUi, set, selected, selectPart, apiRef } = useMachine(init);
  const [tele, setTele] = useTele({
    on: 0,
    yb: 140,
    q: 0,
    qMax: 70,
    n: 0,
    ok: 0,
    last: null,
    cutting: false,
    blade: false,
    msg: null,
  });
  useEffect(() => {
    const c = ctl.current;
    return createClassicScene({
      mount: mountRef.current,
      layer: layerRef.current,
      tipEl: tipRef.current,
      c,
      apiRef,
      set,
      setUi,
      setTele,
      colors: [0x2f6db0, 0x245a93, 0x1b456f],
      mats: { bar: [0xb7bcc0, 0.35, 0.85], cover: [0xd9dcd8, 0.55, 0.1], blade: [0x9aa3a8, 0.25, 0.9] },
      name: L('Pásová píla Pilous ARG 200 PLUS', 'Pilous ARG 200 PLUS band saw'),
      sound: 'mill',
      debugKey: '__pasovka',
      build: (x) => buildArg(x),
    });
  }, []);
  const parts = argParts();
  const act = (k, v) => apiRef.current.act?.[k]?.(v);
  const statusMsg = tele.msg
    ? tele.msg
    : !ui.power
      ? { kind: 'warn', text: L('Hlavný vypínač je vypnutý.', 'The main switch is off.') }
      : tele.cutting
        ? {
            kind: 'run',
            text: `${L('Rez', 'Cutting')} – ${L('úber', 'removal')} ${tele.q.toFixed(0)} / ${tele.qMax.toFixed(0)} mm²/s`,
          }
        : tele.on > 1
          ? {
              kind: 'run',
              text: L(
                'Pás beží. Otvor ventil – rameno začne klesať.',
                'The band runs. Open the valve – the arm starts to drop.',
              ),
            }
          : {
              kind: 'idle',
              text: L(
                'Posuň tyč k dorazu, upni ju a spusti pílu.',
                'Push the bar to the stop, clamp it and start the saw.',
              ),
            };
  const chips = [
    {
      color: tele.on > 1 ? '#3ee06c' : '#8b8f89',
      text: tele.on > 1 ? `${ARG.speeds[ui.sp]} m/min` : L('Stojí', 'Stopped'),
    },
    {
      color: ui.g <= D + 0.05 ? '#7fb6ff' : '#ff8a1f',
      text: ui.g <= D + 0.05 ? L('upnuté', 'clamped') : L('voľné', 'loose'),
    },
    tele.blade ? { color: '#ff5b4f', text: L('pás poškodený', 'band damaged') } : null,
  ].filter(Boolean);
  return (
    <div className="machine-app w-full flex flex-col md:flex-row">
      <SceneView
        mountRef={mountRef}
        layerRef={layerRef}
        tipRef={tipRef}
        ui={ui}
        set={set}
        parts={parts}
        selected={selected}
        selectPart={selectPart}
        chips={chips}
        onBack={onBack}
        apiRef={apiRef}
        tips={[
          L(
            'Tyč posúvaš ťahaním za tyč, rameno zdvíhaš za rukoväť vpredu.',
            'Drag the bar to push it, lift the arm by the front handle.',
          ),
        ]}
      />
      <aside className="panel">
        <fieldset className="machine-settings" disabled={ui.unclamped}>
          <PanelHeader
            ui={ui}
            set={set}
            kicker={L('Simulátor · delenie materiálu', 'Simulator · cutting off')}
            title={L('Pásová píla', 'Band saw')}
            sub={L(
              'Predloha: Pilous ARG 200 PLUS – kruh do Ø200, pás 20 × 0,9 mm, 40 / 80 m/min, šikmé rezy 60° vpravo, 45° vľavo. Mierka 1 : 100 mm.',
              'Modelled after the Pilous ARG 200 PLUS – round up to Ø200, band 20 × 0.9 mm, 40 / 80 m/min, mitre 60° right, 45° left. Scale 1 : 100 mm.',
            )}
            rows={[
              [L('Rameno', 'Arm'), `${Math.max(0, tele.yb).toFixed(0)}`],
              [L('Uhol', 'Angle'), `${ui.a.toFixed(1)}°`],
              [L('Kusy', 'Pieces'), `${tele.ok} / ${tele.n}`],
            ]}
            foot={[
              `${L('doraz', 'stop')} ${ui.stopL.toFixed(1)} mm`,
              tele.last ? `${L('posledný', 'last')} ${tele.last.l.toFixed(1)} mm` : '—',
            ]}
            status={statusMsg}
          />
          <TaskSection
            machine="pasovka"
            tasks={ARG_TASKS}
            apiRef={apiRef}
            params={params}
            status={statusMsg}
            onSetup={() => apiRef.current.newBlank?.()}
            safety={{ ui, set, runKey: 'running', items: ARG_SAFETY() }}
          />
          <div className="sec">
            <h2 className="sec-title mb-2">{L('Chod', 'Run')}</h2>
            <button type="button" className="btn-run w-full" onClick={() => apiRef.current.toggleRun?.()}>
              {ui.running ? L('■ Stop', '■ Stop') : L('▶ Štart', '▶ Start')}
            </button>
            <Toggle on={ui.power} label={L('Hlavný vypínač', 'Main switch')} onClick={() => set('power', !ui.power)} />
            <SegRow
              label={L('Rýchlosť pásu m/min', 'Band speed m/min')}
              value={ui.sp}
              options={ARG.speeds.map((v, i) => [i, String(v)])}
              onChange={(i) => set('sp', i)}
            />
            <Toggle on={ui.cool} label={L('Chladenie', 'Coolant')} onClick={() => set('cool', !ui.cool)} />
            <Toggle
              on={ui.valve}
              label={L('Ventil hydrauliky otvorený (rameno klesá)', 'Hydraulic valve open (arm drops)')}
              onClick={() => set('valve', !ui.valve)}
            />
            <Slider
              id="agf"
              label={L('Rýchlosť klesania ramena', 'Arm feed rate')}
              unit="mm/s"
              min={0}
              max={ARG.feedMax}
              step={0.1}
              value={ui.feed}
              digits={1}
              onChange={(v) => set('feed', v)}
            />
            <Slider
              id="agy"
              label={L('Výška pásu nad spodkom tyče', 'Band height above bar bottom')}
              unit="mm"
              min={-5}
              max={160}
              step={1}
              value={ui.yb}
              actual={tele.yb}
              digits={0}
              onChange={(v) => act('arm', v)}
            />
          </div>
          <div className="sec">
            <div className="section-heading">
              <h2 className="sec-title mb-2">{L('Nastavenie', 'Setup')}</h2>
              <SectionInfo title={L('Rez', 'The cut')}>
                <p className="text-xs muted">
                  {L(
                    'Dĺžka kusa sa meria od pravej strany pásu (rez 0,9 mm) k dorazu v osi tyče. Pri šikmom reze sa rameno natáča okolo osi tyče.',
                    'The piece length is measured from the right side of the band (0.9 mm kerf) to the stop on the bar axis. For a mitre the arm swivels about the bar axis.',
                  )}
                </p>
              </SectionInfo>
            </div>
            <Slider
              id="agg"
              label={L('Zverák – otvorenie', 'Vise opening')}
              unit="mm"
              min={D}
              max={100}
              step={0.5}
              value={ui.g}
              digits={1}
              onChange={(v) => act('gap', v)}
            />
            <Slider
              id="agx"
              label={L('Koniec tyče za pásom', 'Bar end past the band')}
              unit="mm"
              min={-300}
              max={460}
              step={0.5}
              value={ui.xe}
              digits={1}
              onChange={(v) => act('bar', v)}
            />
            <Slider
              id="ags"
              label={L('Doraz', 'Length stop')}
              unit="mm"
              min={20}
              max={450}
              step={0.5}
              value={ui.stopL}
              digits={1}
              onChange={(v) => act('stop', v)}
            />
            <Toggle
              on={!ui.lock}
              label={L('Zaistenie ramena uvoľnené', 'Arm lock released')}
              onClick={() => act('lock', !ui.lock)}
            />
            <Slider
              id="aga"
              label={L('Uhol rezu', 'Mitre angle')}
              unit="°"
              min={ARG.swing[0]}
              max={ARG.swing[1]}
              step={0.5}
              value={ui.a}
              digits={1}
              onChange={(v) => act('angle', v)}
            />
            <button type="button" className="btn w-full mt-2" onClick={() => apiRef.current.newBlade?.()}>
              {L('Vymeniť pílový pás', 'Replace the band')}
            </button>
          </div>
          <ExportSection machine="pasovka" apiRef={apiRef} canSave={false} />
          <ViewSection
            apiRef={apiRef}
            views={[
              ['celok', L('Celok', 'Overview')],
              ['rez', L('Detail rezu', 'Cut detail')],
              ['zhora', L('Zhora', 'Top')],
            ]}
          />
          <PartsSection parts={parts} selected={selected} selectPart={selectPart} />
          <HelpFooter apiRef={apiRef} ui={ui} />
        </fieldset>
      </aside>
    </div>
  );
}

function buildArg(x) {
  const { kit, det, M, grp, v3, c, st, ctrl, push, say, sayOnce, needPower, anchors, views, apiRef } = x;
  const { add, box, cylX, cylY, cylZ, ball, handwheel } = kit;
  const { rbox, nameplate, cable, plane } = det;
  // ---------- stojan ----------
  const base = grp('stojan');
  rbox(base, -3.2, 3.2, 0, 7.8, -2.8, 2.8, M.green, 0.1);
  rbox(base, -3.5, 3.5, 7.8, 8.2, -3.1, 3.1, M.greenDark, 0.06);
  box(base, -3.2, 3.2, 7.2, 7.8, 2.8, 2.84, M.greenDeep); // vaňa chladiva
  rbox(base, -3.2, -2.2, 0, 0.3, -2.9, 2.9, M.black, 0.04);
  rbox(base, 2.2, 3.2, 0, 0.3, -2.9, 2.9, M.black, 0.04);
  nameplate(base, -1.9, 5.6, 2.81, 0, 'PILOUS', 'ARG 200 PLUS', 1.1);
  // valčekový stojan vľavo
  rbox(base, -8.6, -8.0, 0, 0.2, -1.0, 1.0, M.steelDark, 0.04);
  rbox(base, -8.4, -8.2, 0.2, TB - 0.2, -0.1, 0.1, M.steelDark, 0.03);
  cylZ(base, 0.18, 0.18, -0.6, 0.6, -8.3, TB - 0.18, M.steel, 20);
  cylZ(base, 0.18, 0.18, -0.6, 0.6, -4.6, TB - 0.18, M.steel, 20);
  rbox(base, -4.7, -4.5, 7.8, TB - 0.3, -0.7, 0.7, M.greenDark, 0.03);
  // ---------- otočný stôl a rameno ----------
  const swivel = new THREE.Group();
  swivel.position.set(0, 8.2, 0);
  base.add(swivel);
  const arm = grp('rameno', swivel);
  cylY(arm, 1.55, 1.55, 0, 0.18, 0, 0, M.steelDark, 64);
  const tx = angleScaleTex(60, 1, { numR: 0.8, step: 15, len: 0.1 });
  if (tx) {
    const sc = add(
      base,
      new THREE.RingGeometry(1.58, 1.95, 96, 1, Math.PI / 2 - Math.PI / 3, (Math.PI * 7) / 12),
      new THREE.MeshStandardMaterial({ map: tx, roughness: 0.4, metalness: 0.3 }),
      0,
      8.205,
      0,
    );
    sc.rotation.x = -Math.PI / 2;
    sc.userData.noMerge = true;
    sc.castShadow = false;
  }
  box(arm, -0.03, 0.03, 0.18, 0.22, 1.5, 1.95, M.red); // ryska uhla
  rbox(arm, 0.3, 1.1, 0.18, HY - 8.2 + 0.25, HZ - 0.5, HZ + 0.4, M.green, 0.06); // konzola závesu
  const hinge = new THREE.Group();
  hinge.position.set(0, HY - 8.2, HZ);
  arm.add(hinge);
  cylX(hinge, 0.16, 0.16, -0.1, 1.15, 0, 0, M.steel, 20);
  // rameno v súradniciach závesu (+z dopredu)
  const beam = new THREE.Group();
  hinge.add(beam);
  rbox(beam, -0.05, 0.45, 0.55, 1.3, -0.4, 8.0, M.green, 0.1);
  [-0.1, 7.6].forEach((z) => {
    cylX(beam, 1.2, 1.2, -0.02, 0.5, 0.1, z, M.green, 48);
    cylX(beam, 0.25, 0.25, 0.5, 0.58, 0.1, z, M.steelDark, 20);
  });
  rbox(beam, 0.5, 1.6, -0.45, 0.6, -0.9, 0.3, M.greenDark, 0.08); // prevodovka
  cylX(beam, 0.42, 0.42, 1.6, 2.6, 0.1, -0.3, M.greenDeep, 28); // motor
  for (let k = 0; k < 6; k++) cylX(beam, 0.44, 0.44, 1.7 + k * 0.15, 1.74 + k * 0.15, 0.1, -0.3, M.greenDark, 28);
  [1.0, 3.6].forEach((z) => {
    rbox(beam, -0.14, 0.14, BLY + 0.02, 0.6, z - 0.15, z + 0.15, M.steelDark, 0.03); // vodítka pásu
  });
  const blade = box(beam, -0.006, 0.006, BLY, BLY + 0.2, 0.85, 3.75, M.blade);
  box(beam, -0.04, 0.04, BLY + 0.2, BLY + 0.24, 0.85, 3.75, M.steel);
  box(beam, 0.08, 0.5, -0.4, 0.55, 3.75, 6.8, M.cover); // kryt pásu vpredu
  box(beam, 0.08, 0.5, -0.4, 0.55, 0.2, 0.85, M.cover);
  // rukoväť vpredu
  const handle = new THREE.Group();
  handle.position.set(0.2, 1.0, 8.1);
  beam.add(handle);
  cylX(handle, 0.07, 0.07, -0.55, 0.55, 0, 0.25, M.black, 14);
  box(handle, -0.5, -0.4, -0.05, 0.05, 0, 0.25, M.steelDark);
  box(handle, 0.4, 0.5, -0.05, 0.05, 0, 0.25, M.steelDark);
  kit.hitProxy(handle, 0.45, 0, 0, 0.25);
  // hydraulický tlmiaci valec (body sa prepočítavajú pri pohybe ramena)
  const hyBody = kit.rod(arm, v3(0, 0, 0), v3(0, 1, 0), 0.12, M.black, 16),
    hyRod = kit.rod(arm, v3(0, 0, 0), v3(0, 1, 0), 0.05, M.steel, 12);
  const hyA = v3(0.75, 0.2, 0.9),
    hyLocal = v3(0.3, 0.0, 3.0);
  // chladivo – hadička k vodítku
  const coolJet = add(
    beam,
    new THREE.CylinderGeometry(0.03, 0.05, 0.5, 8),
    new THREE.MeshStandardMaterial({ color: 0x9cd3ea, transparent: true, opacity: 0.55 }),
    0.15,
    BLY + 0.5,
    3.4,
  );
  coolJet.userData.noMerge = true;
  cable(
    beam,
    [
      [0.3, 0.9, 3.5],
      [0.6, 1.4, 2.5],
      [0.5, 1.1, 0.2],
    ],
    0.035,
    M.blue,
  );
  // ---------- zverák ----------
  const vise = grp('zverak', base);
  rbox(vise, -2.2, 1.2, 8.2, TB, -1.0, 1.2, M.steelDark, 0.04);
  rbox(vise, -2.0, -0.12, TB, TB + 0.55, -0.6, -0.2, M.steel, 0.03);
  const jaw = new THREE.Group();
  vise.add(jaw);
  rbox(jaw, -2.0, -0.12, TB, TB + 0.55, 0, 0.35, M.steel, 0.03);
  const screw = cylZ(vise, 0.07, 0.07, 0, 1, -1.0, TB + 0.25, M.ways, 16);
  rbox(vise, -1.4, -0.6, 8.2, TB + 0.1, 2.85, 3.15, M.steelDark, 0.04);
  const wV = handwheel(vise, 0.4, -1.0, TB + 0.25, 3.35, 'z', 0.24);
  // ---------- doraz ----------
  const stopG = grp('doraz', base);
  rbox(stopG, 1.2, 1.5, 7.9, TB + 0.35, -1.25, -0.85, M.greenDark, 0.04);
  cylX(stopG, 0.06, 0.06, 1.2, 5.2, TB + 0.2, -1.05, M.ways, 16);
  rbox(stopG, 5.0, 5.3, 6.0, TB + 0.35, -1.25, -0.85, M.greenDark, 0.04);
  plane(
    stopG,
    3.6,
    0.18,
    (() => {
      const cv = typeof document !== 'undefined' ? document.createElement('canvas') : null;
      if (!cv) return null;
      cv.width = 1440;
      cv.height = 72;
      const g = cv.getContext('2d');
      if (!g) return null;
      g.fillStyle = '#e9e6da';
      g.fillRect(0, 0, 1440, 72);
      g.fillStyle = '#1b1d1f';
      g.strokeStyle = '#1b1d1f';
      g.font = 'bold 26px Arial';
      g.textAlign = 'center';
      for (let mm = 0; mm <= 360; mm += 5) {
        const px = (mm / 360) * 1430 + 5;
        g.lineWidth = mm % 50 ? 2 : 3;
        g.beginPath();
        g.moveTo(px, 0);
        g.lineTo(px, mm % 50 ? (mm % 10 ? 14 : 24) : 34);
        g.stroke();
        if (mm % 50 === 0) g.fillText(String(mm + 90), px, 64);
      }
      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })(),
    1.35 + 1.8 + 0.45,
    TB + 0.04,
    -0.84,
  );
  const stopCar = new THREE.Group();
  stopG.add(stopCar);
  rbox(stopCar, -0.15, 0.15, TB + 0.05, TB + 0.38, -1.2, -0.9, M.yellow, 0.03);
  cylZ(stopCar, 0.03, 0.03, -0.9, 0, 0.12, TB + 0.2, M.steel, 10);
  cylX(stopCar, 0.04, 0.04, 0.0, 0.12, TB + 0.2, 0, M.steel, 10);
  kit.hitProxy(stopCar, 0.3, 0, TB + 0.25, -1.05);
  // ---------- tyč ----------
  const barG = grp('tyc', base);
  const barMesh = new THREE.Mesh(barGeom(BAR0, 0, 0), M.bar);
  barMesh.castShadow = true;
  barMesh.userData.part = 'tyc';
  barMesh.userData.noMerge = true;
  barG.add(barMesh);
  const kerf = add(barG, new THREE.BoxGeometry(0.012, 1, D / 100 + 0.004), M.black);
  kerf.userData.noMerge = true;
  const crate = new THREE.Group();
  base.add(crate);
  rbox(crate, 0.8, 3.2, 0, 1.6, 3.2, 4.6, M.greenDeep, 0.05);
  box(crate, 0.9, 3.1, 1.55, 1.6, 3.3, 4.5, M.black);
  const pieceMeshes = [];
  // ---------- panel ----------
  const pan = grp('ovladanie', base);
  rbox(pan, 0.9, 3.0, 4.6, 7.5, 2.8, 2.86, M.panel, 0.02);
  const face = new THREE.Group();
  face.position.set(0, 0, 2.86);
  pan.add(face);
  const mSw = mainSwitch(kit, M, face, 2.45, 6.9, 0.01);
  const bStart = panelButton(kit, M, face, 1.3, 6.95, 0.01, M.btnGreen),
    bStop = panelButton(kit, M, face, 1.8, 6.95, 0.01, M.red);
  const lampRun = M.lamp.clone();
  ball(face, 0.06, 1.55, 7.3, 0.02, lampRun);
  const levSp = kit.pivotLever(face, 1.3, 5.9, 0.03, 0.42, 0);
  const levCool = kit.pivotLever(face, 2.0, 5.9, 0.03, 0.42, 0);
  const levValve = kit.pivotLever(face, 1.3, 5.0, 0.03, 0.42, 0);
  const knobFeed = handwheel(face, 0.2, 2.15, 5.05, 0.08, 'z', 0.0);
  const levLock = kit.pivotLever(base, -0.9, 8.3, 1.75, 0.5, 0.4);
  const swH = new THREE.Group();
  arm.add(swH);
  cylY(swH, 0.06, 0.06, 0.18, 0.75, 0, 1.75, M.steel, 12);
  ball(swH, 0.12, 0, 0.8, 1.75, M.black);
  kit.hitProxy(swH, 0.3, 0, 0.6, 1.75);
  // ---------- stav ----------
  Object.assign(st, {
    on: 0,
    yb: c.yb,
    cutY: D,
    endA: 0,
    rough: true,
    lenBar: BAR0,
    pieces: [],
    blade: false,
    over: 0,
    q: 0,
    loose: false,
    cutT: -9,
    drops: [],
  });
  const clamped = () => c.g <= D + 0.05;
  const stopped = () => !c.running && st.on < 1;
  const barCross = () => c.xe > 0.5; // tyč prechádza rovinou pásu
  const rebuildBar = () => {
    barMesh.geometry.dispose();
    barMesh.geometry = barGeom(st.lenBar, 0, st.endA);
  };
  rebuildBar();
  const armAngle = (yb) => {
    // bod pásu nad osou tyče (z = 0) v súradniciach závesu: (−HZ, BLY); výška nad spodkom tyče = HY − TB + y'
    const R = Math.hypot(-HZ, BLY),
      phi0 = Math.atan2(-BLY, -HZ),
      s = clamp((yb / 100 - (HY - TB)) / R, -1, 1);
    return Math.asin(s) + phi0;
  };
  const place = () => {
    swivel.rotation.y = (-c.a * Math.PI) / 180;
    beam.rotation.x = -armAngle(st.yb);
    jaw.position.z = 0.2 + (c.g - D) / 100;
    screw.scale.z = 1;
    screw.position.z = 0.2 + (c.g - D) / 100 + 1.4;
    screw.scale.set(1, 1, (3.2 - (0.55 + (c.g - D) / 100)) / 1);
    stopCar.position.x = (c.stopL + ARG.kerf / 2) / 100;
    barMesh.position.set((c.xe - st.lenBar / 2) / 100, TB + D / 200, 0);
    kerf.visible = st.cutY < D - 0.1 && barCross();
    if (kerf.visible) {
      kerf.scale.y = (D - st.cutY) / 100;
      kerf.position.set(0, TB + (D + st.cutY) / 200, 0);
      kerf.rotation.y = (-c.a * Math.PI) / 180;
    }
    // hydraulický valec
    beam.updateMatrix();
    hinge.updateMatrix();
    const pB = hyLocal.clone().applyMatrix4(beam.matrix).applyMatrix4(hinge.matrix),
      mid = hyA.clone().lerp(pB, 0.55);
    kit.orient(hyBody, hyA, mid);
    kit.orient(hyRod, mid, pB);
  };
  // ovládače aj posuvníky idú cez tieto funkcie s rovnakými obmedzeniami
  const act = {
    gap: (v) => {
      if (!stopped() && v > c.g) return say(L('Zverák neuvoľňuj počas chodu.', 'Do not open the vise while running.'));
      push('g', clamp(Math.round(v * 2) / 2, D, 100));
    },
    bar: (v) => {
      if (clamped()) return say(L('Tyč je upnutá – najprv povoľ zverák.', 'The bar is clamped – open the vise first.'));
      if (st.yb < D + 2)
        return say(L('Pás leží na tyči – najprv zdvihni rameno.', 'The band rests on the bar – lift the arm first.'));
      const lim = c.stopL + ARG.kerf / 2;
      let nv = clamp(Math.round(v * 2) / 2, -300, 460);
      if (nv > lim) {
        nv = lim;
        sayOnce('stop', true, L('Tyč dosadla na doraz.', 'The bar is against the stop.'), 'info');
      }
      push('xe', nv);
    },
    stop: (v) => {
      let nv = clamp(Math.round(v * 2) / 2, 20, 450);
      if (nv + ARG.kerf / 2 < c.xe) nv = Math.ceil((c.xe - ARG.kerf / 2) * 2) / 2;
      push('stopL', nv);
    },
    arm: (v) => {
      const nv = clamp(Math.round(v), -5, 160);
      if (nv < st.yb && !c.valve)
        return say(
          L(
            'Ventil hydrauliky je zatvorený – rameno drží hore.',
            'The hydraulic valve is closed – the arm is held up.',
          ),
        );
      push('yb', nv);
    },
    lock: (v) => {
      if (!stopped()) return say(L('Najprv zastav pílu.', 'Stop the saw first.'));
      push('lock', v);
    },
    angle: (v) => {
      if (c.lock)
        return say(L('Rameno je zaistené – uvoľni páku zaistenia.', 'The arm is locked – release the lock lever.'));
      if (!stopped()) return say(L('Najprv zastav pílu.', 'Stop the saw first.'));
      if (st.yb < D + 5 && barCross()) return say(L('Zdvihni rameno nad tyč.', 'Lift the arm above the bar.'));
      if (st.cutY < D)
        return say(L('Rozrezaný rez dokonči pod rovnakým uhlom.', 'Finish the started cut at the same angle.'));
      push('a', clamp(Math.round(v * 2) / 2, ARG.swing[0], ARG.swing[1]));
    },
  };
  apiRef.current.act = act;
  place();
  Object.assign(anchors, {
    stojan: () => v3(-3.2, 7.0, 2.8),
    rameno: () => v3(0.3, HY + 1.6, 3.5),
    zverak: () => v3(-1.0, TB + 0.55, 0.3),
    doraz: () => v3((c.stopL + 0.45) / 100, TB + 0.38, -1.05),
    tyc: () => v3(-3, TB + 0.4, 0),
    ovladanie: () => v3(2.0, 7.5, 2.86),
  });
  Object.assign(views, {
    celok: () => [
      [9, 14, 15],
      [0, 7.5, 0],
    ],
    rez: () => [[2.2, TB + 2.4, 3.4], [0.4, TB + 0.2, 0], true],
    zhora: () => [[0.2, TB + 7.5, 0.6], [0.2, TB, 0], true],
  });
  const start = needPower(() => {
    if (st.blade) return say(L('Pás má vylomené zuby – vymeň ho.', 'The band has broken teeth – replace it.'));
    if (!apiRef.current.safetyGate || apiRef.current.safetyGate.ok()) push('running', true);
    else apiRef.current.safetyGate.request();
  });
  apiRef.current.toggleRun = () => (c.running ? push('running', false) : start());
  apiRef.current.newBlade = () => {
    if (!stopped()) return say(L('Pás sa mení pri stojacom stroji.', 'The band is changed with the machine stopped.'));
    st.blade = false;
    st.over = 0;
    say(L('Nový pílový pás je nasadený a napnutý.', 'A new band is fitted and tensioned.'), 'info');
  };
  apiRef.current.newBlank = () => {
    if (!stopped())
      return (say(L('Tyč sa mení pri stojacom stroji.', 'The bar is changed with the machine stopped.')), false);
    st.lenBar = BAR0;
    st.endA = 0;
    st.rough = true;
    st.cutY = D;
    st.pieces = [];
    st.loose = false;
    pieceMeshes.forEach((m) => {
      crate.remove(m);
      m.geometry.dispose();
    });
    pieceMeshes.length = 0;
    push('g', 70);
    push('xe', 12);
    push('yb', 140);
    st.yb = 140;
    rebuildBar();
    return true;
  };
  const lever2 = (o, label, hint, key, read, angles = [0.5, -0.5], guard) =>
    ctrl.reg(
      {
        type: 'lever',
        angles,
        minR: 0.15,
        label,
        hint,
        getIdx: () => (c[key] ? 1 : 0),
        onSet: (i) => (guard ? guard(i) : push(key, i === 1)),
        read,
      },
      o,
    );
  ctrl.reg(
    {
      type: 'lever',
      angles: [0, -Math.PI / 2],
      minR: 0.2,
      label: LL('Hlavný vypínač', 'Main switch'),
      hint: LL('0 = vypnuté, I = zapnuté.', '0 = off, I = on.'),
      getIdx: () => (c.power ? 1 : 0),
      onSet: (i) => {
        push('power', i === 1);
        if (!i) push('running', false);
      },
      read: () => (c.power ? 'I' : '0'),
    },
    mSw,
  );
  ctrl.reg(
    {
      type: 'button',
      label: LL('ŠTART', 'START'),
      hint: LL('Spustí pílový pás a čerpadlo chladiva.', 'Starts the band and the coolant pump.'),
      action: start,
    },
    bStart,
  );
  ctrl.reg(
    {
      type: 'button',
      label: LL('STOP', 'STOP'),
      hint: LL('Zastaví pás.', 'Stops the band.'),
      action: () => push('running', false),
    },
    bStop,
  );
  ctrl.reg(
    {
      type: 'lever',
      angles: [0.5, -0.5],
      minR: 0.15,
      label: LL('Rýchlosť pásu', 'Band speed'),
      hint: LL(
        'I = 40 m/min (oceľ), II = 80 m/min (hliník, mosadz).',
        'I = 40 m/min (steel), II = 80 m/min (aluminium, brass).',
      ),
      getIdx: () => c.sp,
      onSet: (i) => push('sp', i),
      read: () => `${ARG.speeds[c.sp]} m/min`,
    },
    levSp,
  );
  lever2(
    levCool,
    LL('Chladenie', 'Coolant'),
    LL('Kohút chladiacej emulzie k vodítku pásu.', 'Coolant tap at the band guide.'),
    'cool',
    () => (c.cool ? L('zapnuté', 'on') : L('vypnuté', 'off')),
  );
  lever2(
    levValve,
    LL('Ventil hydrauliky', 'Hydraulic valve'),
    LL(
      'Otvorený ventil pustí rameno klesať rýchlosťou nastavenou škrtiacim kolieskom.',
      'An open valve lets the arm drop at the rate set by the throttle knob.',
    ),
    'valve',
    () => (c.valve ? L('otvorený', 'open') : L('zatvorený', 'closed')),
  );
  lever2(
    levLock,
    LL('Zaistenie ramena', 'Arm lock'),
    LL('Uvoľni pred natáčaním ramena, pred rezom zaisti.', 'Release before swivelling the arm, lock before cutting.'),
    'lock',
    () => (c.lock ? L('zaistené', 'locked') : L('uvoľnené', 'released')),
    [-0.6, 0.6],
    (i) => act.lock(i === 0),
  );
  ctrl.reg(
    {
      type: 'wheel',
      minR: 0.1,
      inc: 1,
      label: LL('Škrtenie hydrauliky', 'Hydraulic throttle'),
      hint: LL('Rýchlosť klesania ramena. 1 otáčka = 0,5 mm/s.', 'Arm feed rate. 1 turn = 0.5 mm/s.'),
      turn: (d) => push('feed', clamp(Math.round((c.feed + (d / TAU) * 0.5) * 10) / 10, 0, ARG.feedMax)),
      read: () => `${c.feed.toFixed(1)} mm/s`,
    },
    knobFeed,
  );
  ctrl.reg(
    {
      type: 'wheel',
      minR: 0.2,
      inc: 1,
      label: LL('Koleso zveráka', 'Vise handwheel'),
      hint: LL('V smere hodín upína. 1 otáčka = 4 mm.', 'Clockwise clamps. 1 turn = 4 mm.'),
      turn: (d) => act.gap(c.g - (d / TAU) * 4),
      read: () => (clamped() ? L('upnuté', 'clamped') : `${c.g.toFixed(1)} mm`),
    },
    wV,
  );
  let y0 = 0,
    x0 = 0,
    s0 = 0,
    a0 = 0;
  ctrl.reg(
    {
      type: 'slide',
      axis: 'y',
      label: LL('Rukoväť ramena', 'Arm handle'),
      hint: LL(
        'Ťahaj nahor – zdvihneš rameno. Nadol ide len pri otvorenom ventile.',
        'Drag up to lift the arm. It goes down only with the valve open.',
      ),
      read: () => `${Math.max(0, st.yb).toFixed(0)} mm`,
      start: () => (y0 = c.yb),
      slide: (dy) => act.arm(y0 + dy * 40),
      nudge: (d) => act.arm(c.yb + d * 5),
    },
    handle,
  );
  ctrl.reg(
    {
      type: 'slide',
      axis: 'x',
      label: LL('Tyč', 'Bar'),
      hint: LL(
        'Ťahaj tyč doprava k dorazu (zverák musí byť povolený, rameno hore).',
        'Drag the bar right to the stop (vise open, arm up).',
      ),
      read: () => `${c.xe.toFixed(1)} mm`,
      start: () => (x0 = c.xe),
      slide: (dx) => act.bar(x0 + dx * 100),
      nudge: (d) => act.bar(c.xe + d * 0.5),
    },
    barMesh,
  );
  ctrl.reg(
    {
      type: 'slide',
      axis: 'x',
      label: LL('Doraz', 'Length stop'),
      hint: LL(
        'Posuň doraz na dĺžku kusa – čítaj na stupnici.',
        'Slide the stop to the piece length – read the scale.',
      ),
      read: () => `${c.stopL.toFixed(1)} mm`,
      start: () => (s0 = c.stopL),
      slide: (dx) => act.stop(s0 + dx * 100),
      nudge: (d) => act.stop(c.stopL + d * 0.5),
    },
    stopCar,
  );
  ctrl.reg(
    {
      type: 'slide',
      axis: 'x',
      label: LL('Natočenie ramena', 'Arm swivel'),
      hint: LL(
        'Pri uvoľnenom zaistení natoč rameno – uhol čítaj na stupnici stola.',
        'With the lock released swivel the arm – read the angle on the table scale.',
      ),
      read: () => `${c.a.toFixed(1)}°`,
      start: () => (a0 = c.a),
      slide: (dx) => act.angle(a0 + (Math.atan2(dx, 1.75) * 180) / Math.PI),
      nudge: (d) => act.angle(c.a + d * 0.5),
    },
    swH,
  );
  // ---------- slučka ----------
  const update = (dt, t) => {
    if (!c.power && c.running) push('running', false);
    st.on = approach(st.on, c.running && c.power ? 1 : 0, 3 * dt);
    const running = st.on > 0.9,
      dts = dt * c.timeScale;
    // rameno: ventil + chod = klesanie posuvom, inak drží; bez chodu pás leží na tyči alebo v začatom reze
    if (c.valve && c.yb > -5) {
      const nv = Math.max(-5, c.yb - c.feed * dts);
      push('yb', nv);
    }
    const floor = !barCross() ? -5 : running ? -5 : Math.min(D, st.cutY);
    if (c.yb < floor) push('yb', floor);
    const prevY = st.yb;
    st.yb = approach(st.yb, c.yb, 60 * dts);
    const vDown = Math.max(0, prevY - st.yb) / Math.max(1e-6, dts);
    st.q = 0;
    if (running && barCross() && st.yb < D && st.yb < st.cutY) {
      // rez
      const w = cutWidth(D, Math.max(0, st.yb), c.a);
      st.q = vDown * w;
      st.cutY = st.yb;
      st.cutT = t;
      const qm = qMax(c.sp, c.cool);
      if (st.q > qm) st.over += dt;
      else st.over = Math.max(0, st.over - dt);
      if (st.over > 0.6 && !st.blade) {
        st.blade = true;
        push('running', false);
        say(
          L(
            'Pás sa preťažil a vylomil zuby – príliš rýchly posuv ramena! Vymeň pás a uber posuv.',
            'The band was overloaded and broke teeth – the arm feed was too fast! Replace the band and reduce the feed.',
          ),
          'danger',
        );
      }
      if (!clamped() || !c.lock) st.loose = true;
      sayOnce(
        'loose',
        !clamped(),
        L(
          'Tyč nie je upnutá – pri reze sa krúti a rez bude krivý!',
          'The bar is not clamped – it turns in the cut and the cut will be crooked!',
        ),
        'danger',
      );
      sayOnce(
        'lockw',
        !c.lock,
        L('Rameno nie je zaistené – uhol rezu uteká!', 'The arm is not locked – the cut angle drifts!'),
        'danger',
      );
      sayOnce(
        'sp',
        c.sp === 1,
        L(
          '80 m/min je na hliník – oceľ pás pri nej prehrieva a otupí.',
          '80 m/min is for aluminium – on steel it overheats and dulls the band.',
        ),
        'warn',
      );
      sayOnce(
        'cool',
        !c.cool,
        L(
          'Bez chladenia sa pás prehrieva – zníž posuv alebo zapni chladenie.',
          'Without coolant the band overheats – reduce the feed or switch on the coolant.',
        ),
        'warn',
      );
      if (st.yb <= 0) {
        // dorezané – kus odpadne
        const l = c.xe - ARG.kerf / 2;
        const p = { l, aL: c.a, aR: st.endA, rough: st.rough, loose: st.loose, bad: st.blade || c.sp === 1 };
        st.pieces.push(p);
        const pm = new THREE.Mesh(barGeom(Math.max(1, l), c.a, st.endA), M.bar);
        pm.castShadow = true;
        pm.position.copy(barMesh.position);
        pm.position.x = (ARG.kerf / 2 + l / 2) / 100;
        pm.position.y -= 8.2;
        crate.add(pm);
        pieceMeshes.push(pm);
        st.drops.push({ m: pm, k: pieceMeshes.length - 1, t: 0 });
        if (pieceMeshes.length > 8) {
          const o = pieceMeshes.shift();
          crate.remove(o);
          o.geometry.dispose();
        }
        st.lenBar -= l + ARG.kerf;
        push('xe', -ARG.kerf / 2);
        st.endA = c.a;
        st.rough = false;
        st.loose = false;
        st.cutY = D;
        rebuildBar();
        if (l < 30) say(L('Čelo tyče je zarovnané.', 'The bar end is squared.'), 'info');
        else say(`${L('Kus', 'Piece')} ${l.toFixed(1)} mm`, 'info');
      }
    }
    if (st.yb <= -4 && c.running) {
      push('running', false);
      push('valve', false);
      sayOnce(
        'end',
        true,
        L(
          'Koncový spínač vypol pás v dolnej polohe ramena.',
          'The limit switch stopped the band at the bottom of the arm stroke.',
        ),
        'info',
      );
    } else sayOnce('end', false);
    // padajúce kusy do debny
    st.drops = st.drops.filter((d) => {
      d.t += dt;
      const k = Math.min(1, d.t / 0.7),
        tx2 = 1.4 + (d.k % 4) * 0.45,
        tz = 3.6 + Math.floor(d.k / 4) * 0.45;
      d.m.position.set(
        d.m.position.x + (tx2 - d.m.position.x) * k,
        8.6 - 7.0 * k * k,
        d.m.position.z + (tz - d.m.position.z) * k,
      );
      d.m.rotation.y = (k * Math.PI) / 2;
      return k < 1;
    });
    place();
    blade.visible = true;
    coolJet.visible = running && c.cool;
    lampRun.emissive.setHex(running ? 0x22dd55 : 0);
    levSp.rotation.z = c.sp ? -0.5 : 0.5;
    levCool.rotation.z = c.cool ? -0.5 : 0.5;
    levValve.rotation.z = c.valve ? -0.5 : 0.5;
    levLock.rotation.z = c.lock ? -0.6 : 0.6;
    knobFeed.rotation.z = (c.feed / 0.5) * TAU;
    wV.rotation.z = (-c.g / 4) * TAU;
    mSw.rotation.z = c.power ? -Math.PI / 2 : 0;
  };
  const info = () => piecesInfo(st.pieces, ...(apiRef.current.taskId === 'uhol' ? [150, 45] : [250, 0]));
  return {
    update,
    tele: () => {
      const i = info();
      return {
        on: st.on,
        yb: st.yb,
        q: st.q,
        qMax: qMax(c.sp, c.cool),
        n: i.n,
        ok: i.ok,
        last: i.last,
        cutting: x.time() - st.cutT < 0.3,
        blade: st.blade,
      };
    },
    measure: () => ({ pieces: st.pieces.map((p) => ({ ...p })), blade: st.blade }),
    sound: () => ({ motor: st.on * (c.sp ? 0.7 : 0.45), cut: x.time() - st.cutT < 0.3 ? 0.5 : 0 }),
  };
}

export { PasovkaSimulator };
export default PasovkaSimulator;
