import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { L, LL } from '../core/i18n';
import { TAU, approach, clamp } from '../core/util';
import { ExportSection, TaskSection } from '../ui/tools';
import { SectionInfo } from '../ui/sectionInfo';
import { GearDrawing } from '../ui/sketch';
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
import { OHA, createRing, cutAt, ohaChecks, ringInfo, tipInt } from './ohaMath';

// =====================================================================
// OBRÁŽAČKA OZUBENIA TOS ČELÁKOVICE OHA 32 A (Fellows) – vnútorné ozubenie nožovým kolesom z0 = 25, m 3
// =====================================================================
const TT = 3.2, // horná plocha stola
  ZT = 60,
  B = 30,
  RI = tipInt(OHA.m, ZT) / 200,
  RO = 1.18,
  R0 = (OHA.m * (OHA.z0 + 2)) / 200,
  TOUCH = 0.05; // prísuv (mm), od ktorého nôž odoberá triesku

const ohaParts = () =>
  mkParts([
    [
      'stojan',
      'Stojan',
      'Column',
      'Stojan s vreteníkom',
      'Column with cutter head',
      'Na stojane je vreteník s nožovým kolesom, ktorý kmitá zvisle (zdvihy). Predloha: TOS Čelákovice OHA 32 A – modul do 6, vonkajšie Ø400, vnútorné Ø370, šírka do 70 mm.',
      'The column carries the cutter head with the shaper cutter reciprocating vertically. Model: TOS Čelákovice OHA 32 A – module up to 6, external Ø400, internal Ø370, face width up to 70 mm.',
    ],
    [
      'noz',
      'Nožové koleso',
      'Shaper cutter',
      'Nožové koleso z0 = 25, m 3',
      'Shaper cutter z0 = 25, m 3',
      'Koleso s reznými zubami – pri každom zdvihu odoberie triesku a otočí sa spolu s obrobkom v pomere z0 / z (odvaľovanie).',
      'A gear with cutting teeth – each stroke takes a chip and it turns together with the work in the ratio z0 / z (generating).',
    ],
    [
      'kolesa',
      'Výmenné kolesá',
      'Change gears',
      'Skriňa výmenných kolies delenia',
      'Index change-gear box',
      'Kolesá určujú pomer otáčania noža a obrobku – teda počet zubov. Menia sa pri stojacom stroji a otvorených dvierkach.',
      'The gears set the ratio of cutter and work rotation – the tooth count. They are changed with the machine stopped and the door open.',
    ],
    [
      'stol',
      'Stôl',
      'Table',
      'Otočný stôl s radiálnym prísuvom',
      'Rotary table with radial infeed',
      'Stôl s obrobkom sa otáča a prisúva k nožu do hĺbky zuba 2,25 · m.',
      'The table with the work rotates and is fed to the cutter to the tooth depth 2.25 · m.',
    ],
    [
      'obrobok',
      'Obrobok',
      'Workpiece',
      'Prstenec pre vnútorné koleso z 60',
      'Ring for an internal gear z 60',
      'Prstenec Ø230 / Ø174 × 30 mm – vnútorné ozubenie z 60, m 3.',
      'Ring Ø230 / Ø174 × 30 mm – internal gear z 60, m 3.',
    ],
    [
      'ovladanie',
      'Ovládanie',
      'Controls',
      'Ovládací panel',
      'Control panel',
      'Hlavný vypínač, štart a stop.',
      'Main switch, start and stop.',
    ],
  ]);

const OHA_TASKS = [
  {
    id: 'vnutorne',
    title: () => L('Vnútorné koleso z 60, m 3', 'Internal gear z 60, m 3'),
    desc: () =>
      L(
        'Nastav výmenné kolesá na z 60, dĺžku a polohu zdvihu tak, aby nôž prešiel celou šírkou 30 mm s nábehom a výbehom (nie do stola), spusti stroj a radiálne prisuň do plnej hĺbky 6,75 ±0,1 mm. Nechaj obrobok urobiť aspoň jednu celú otáčku v plnej hĺbke.',
        'Set the change gears to z 60, the stroke length and position so the cutter passes the whole 30 mm face width with run-in and run-out (not into the table), start the machine and feed radially to the full depth 6.75 ±0.1 mm. Let the work make at least one full turn at full depth.',
      ),
    setup: {},
    drawing: () => <GearDrawing z={60} da={174} />,
    labels: {
      z: () => L('60 medzier (zubov)', '60 spaces (teeth)'),
      depth: () => L('Hĺbka 6,75 ±0,1 mm', 'Depth 6.75 ±0.1 mm'),
      cover: () => L('Zdvih cez celú šírku 30 mm', 'Stroke over the whole 30 mm width'),
      crash: () => L('Bez nárazu do stola', 'No crash into the table'),
    },
  },
].map((t) => ({ ...t, checks: (m) => ohaChecks[t.id](m).map((c) => ({ ...c, label: t.labels[c.key]() })) }));

const OHA_SAFETY = () => [
  L(
    'Kryt výmenných kolies je zatvorený, obrobok je upnutý v upínači.',
    'The change-gear cover is closed and the work is clamped in the fixture.',
  ),
  L(
    'Dĺžku a polohu zdvihu som skontroloval pri stojacom stroji – nôž nenarazí do stola.',
    'I checked the stroke length and position with the machine stopped – the cutter will not hit the table.',
  ),
  L('Triesky neodstraňujem rukou počas chodu.', 'I do not remove chips by hand while running.'),
];

function OhaSimulator({ onBack, params }) {
  const mountRef = useRef(null),
    layerRef = useRef(null),
    tipRef = useRef(null);
  const init = {
    power: true,
    running: false,
    sn: 1,
    rf: 1,
    zSel: 48,
    door: false,
    L: 20,
    top: 50,
    d: 0,
    light: true,
    manual: false,
    timeScale: 3,
  };
  const { ctl, ui, setUi, set, selected, selectPart, apiRef } = useMachine(init);
  const [tele, setTele] = useTele({
    spm: 0,
    d: 0,
    L: 20,
    top: 50,
    info: { spaces: 0, dMin: 0, dMax: 0, cover: 0 },
    cutting: false,
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
      colors: [0x7f8f9a, 0x6a7a86, 0x4c5964],
      mats: {
        gear: [0xc9ced2, 0.32, 0.85, { flatShading: true }],
        cutter: [0xb9a46a, 0.3, 0.85, { flatShading: true }],
      },
      name: L('Obrážačka ozubenia TOS Čelákovice OHA 32 A', 'TOS Čelákovice OHA 32 A gear shaper'),
      sound: 'mill',
      debugKey: '__oha',
      build: (x) => buildOha(x),
    });
  }, []);
  const parts = ohaParts();
  const statusMsg = tele.msg
    ? tele.msg
    : !ui.power
      ? { kind: 'warn', text: L('Hlavný vypínač je vypnutý.', 'The main switch is off.') }
      : tele.cutting
        ? {
            kind: 'run',
            text: `${L('Obrážanie', 'Shaping')} – ${L('hĺbka', 'depth')} ${tele.d.toFixed(2)} mm, ${tele.info.spaces} ${L('medzier', 'spaces')}`,
          }
        : tele.spm > 1
          ? {
              kind: 'run',
              text: L('Nôž kmitá. Radiálne prisúvaj do hĺbky.', 'The cutter reciprocates. Feed radially into depth.'),
            }
          : {
              kind: 'idle',
              text: L(
                'Nastav výmenné kolesá a zdvih, zatvor dvierka a spusti stroj.',
                'Set the change gears and the stroke, close the door and start.',
              ),
            };
  const chips = [
    {
      color: tele.spm > 1 ? '#3ee06c' : '#8b8f89',
      text: tele.spm > 1 ? `${OHA.strokes[ui.sn]} ${L('zdvihov/min', 'strokes/min')}` : L('Stojí', 'Stopped'),
    },
    { color: ui.zSel === ZT ? '#7fb6ff' : '#ff8a1f', text: `${L('delenie', 'index')} z ${ui.zSel}` },
  ];
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
            'Pri vnútornom ozubení je nôž vnútri prstenca a pri prísuve sa vzďaľuje od osi obrobku.',
            'For an internal gear the cutter is inside the ring and moves away from the work axis when fed.',
          ),
        ]}
      />
      <aside className="panel">
        <fieldset className="machine-settings" disabled={ui.unclamped}>
          <PanelHeader
            ui={ui}
            set={set}
            kicker={L('Simulátor · ozubenie', 'Simulator · gears')}
            title={L('Obrážačka ozubenia', 'Gear shaper')}
            sub={L(
              'Predloha: TOS Čelákovice OHA 32 A – modul do 6, vonkajšie ozubenie do Ø400, vnútorné do Ø370, šírka do 70 mm, ≈ 6,2 t. Mierka 1 : 100 mm.',
              'Modelled after the TOS Čelákovice OHA 32 A – module up to 6, external up to Ø400, internal up to Ø370, face width up to 70 mm, ≈ 6.2 t. Scale 1 : 100 mm.',
            )}
            rows={[
              [L('Hĺbka', 'Depth'), tele.d.toFixed(2)],
              [L('Zdvih', 'Stroke'), `${tele.L.toFixed(0)}`],
              [L('Medzery', 'Spaces'), String(tele.info.spaces)],
            ]}
            foot={[`z ${ui.zSel}`, `${OHA.rotFeed[ui.rf]} mm/${L('zdvih', 'stroke')}`]}
            status={statusMsg}
          />
          <TaskSection
            machine="oha"
            tasks={OHA_TASKS}
            apiRef={apiRef}
            params={params}
            status={statusMsg}
            onSetup={() => apiRef.current.newBlank?.()}
            safety={{ ui, set, runKey: 'running', items: OHA_SAFETY() }}
          />
          <div className="sec">
            <h2 className="sec-title mb-2">{L('Chod', 'Run')}</h2>
            <button type="button" className="btn-run w-full" onClick={() => apiRef.current.toggleRun?.()}>
              {ui.running ? L('■ Stop', '■ Stop') : L('▶ Štart', '▶ Start')}
            </button>
            <Toggle on={ui.power} label={L('Hlavný vypínač', 'Main switch')} onClick={() => set('power', !ui.power)} />
            <SegRow
              label={L('Zdvihy/min', 'Strokes/min')}
              value={ui.sn}
              options={OHA.strokes.map((n, i) => [i, String(n)])}
              onChange={(i) => !ui.running && set('sn', i)}
            />
            <SegRow
              label={L('Kruhový posuv mm/zdvih', 'Rotary feed mm/stroke')}
              value={ui.rf}
              options={OHA.rotFeed.map((f, i) => [i, String(f)])}
              onChange={(i) => set('rf', i)}
            />
          </div>
          <div className="sec">
            <div className="section-heading">
              <h2 className="sec-title mb-2">{L('Nastavenie', 'Setup')}</h2>
              <SectionInfo title={L('Delenie', 'Indexing')}>
                <p className="text-xs muted">
                  {L(
                    'Nôž a obrobok sa otáčajú v pomere z0 / z – výmenné kolesá určia počet zubov obrobku.',
                    'The cutter and the work turn in the ratio z0 / z – the change gears set the number of teeth.',
                  )}
                </p>
              </SectionInfo>
            </div>
            <SegRow
              label={L('Výmenné kolesá – z', 'Change gears – z')}
              value={ui.zSel}
              options={OHA.zSet.map((z) => [z, String(z)])}
              onChange={(z) => ui.door && !ui.running && set('zSel', z)}
            />
            <Toggle
              on={ui.door}
              label={L('Dvierka kolies otvorené', 'Gear door open')}
              onClick={() => set('door', !ui.door)}
            />
            <Slider
              id="ohl"
              label={L('Dĺžka zdvihu', 'Stroke length')}
              unit="mm"
              min={10}
              max={70}
              step={1}
              value={ui.L}
              digits={0}
              onChange={(v) => !ui.running && set('L', v)}
            />
            <Slider
              id="oht"
              label={L('Horná úvrať nad stolom', 'Top of stroke above the table')}
              unit="mm"
              min={20}
              max={120}
              step={1}
              value={ui.top}
              digits={0}
              onChange={(v) => !ui.running && set('top', v)}
            />
            <Slider
              id="ohd"
              label={L('Radiálny prísuv', 'Radial infeed')}
              unit="mm"
              min={0}
              max={8}
              step={0.01}
              value={ui.d}
              actual={tele.d}
              digits={2}
              onChange={(v) => set('d', v)}
            />
          </div>
          <ExportSection machine="oha" apiRef={apiRef} canSave={false} />
          <ViewSection
            apiRef={apiRef}
            views={[
              ['celok', L('Celok', 'Overview')],
              ['rez', L('Detail noža', 'Cutter detail')],
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

function buildOha(x) {
  const { kit, det, M, grp, v3, c, st, ctrl, push, pend, say, sayOnce, needPower, anchors, views, apiRef } = x;
  const { add, box, cylY, cylZ, ball, handwheel } = kit;
  const { rbox, ribs, nameplate, oilGlass, cable } = det;
  // ---------- lôžko a stojan ----------
  const col = grp('stojan');
  rbox(col, -4.6, 4.2, 0, 2.2, -3.6, 3.0, M.greenDark, 0.18);
  rbox(col, -1.8, 1.8, 2.2, 11.0, -3.4, -1.2, M.green, 0.22);
  ribs(col, 'y', 3, 10.5, 5, -1.7, 1.7, -3.55, 0.15, 0.12, M.greenDark);
  rbox(col, -1.4, 1.4, 6.6, 10.4, -1.2, 0.6, M.green, 0.15); // vreteník
  nameplate(col, 0, 4.4, -1.19, 0, 'TOS Čelákovice', 'OHA 32 A', 1.15);
  oilGlass(col, 1.3, 3.2, -1.19);
  // ---------- nožové koleso na vretene ----------
  const nz = grp('noz', col);
  const ram = new THREE.Group();
  nz.add(ram);
  cylY(ram, 0.22, 0.22, 0.25, 4.0, 0, 0, M.steel, 20);
  const cutterG = new THREE.Group();
  ram.add(cutterG);
  cylY(cutterG, R0 - 0.03, R0 - 0.03, 0, 0.15, 0, 0, M.cutter, 25 * 2);
  for (let k = 0; k < OHA.z0; k++) {
    const a = (k / OHA.z0) * TAU,
      tooth = add(
        cutterG,
        new THREE.BoxGeometry(0.05, 0.15, 0.05),
        M.cutter,
        Math.cos(a) * (R0 - 0.01),
        0.075,
        Math.sin(a) * (R0 - 0.01),
      );
    tooth.rotation.y = -a;
  }
  const NZX = 0; // os noža (svet x)
  // ---------- skriňa výmenných kolies ----------
  const gb = grp('kolesa', col);
  rbox(gb, 1.8, 3.2, 2.4, 5.6, -3.2, -1.2, M.green, 0.12);
  const door = new THREE.Group();
  door.position.set(3.22, 2.6, -3.0);
  gb.add(door);
  rbox(door, 0, 0.06, 0, 2.8, 0, 1.6, M.greenDark, 0.03);
  ball(door, 0.08, 0.12, 1.4, 1.4, M.black);
  kit.hitProxy(door, 0.6, 0.1, 1.4, 0.8);
  const gearSet = new THREE.Group();
  gearSet.position.set(3.15, 4.0, -2.2);
  gb.add(gearSet);
  const gearsG = new THREE.Group();
  gearSet.add(gearsG);
  kit.hitProxy(gearSet, 0.7, 0, 0, 0);
  const rebuildGears = (z) => {
    while (gearsG.children.length) gearsG.remove(gearsG.children[0]);
    [
      [OHA.z0, -0.7],
      [z, 0.2 + (z / 60) * 0.3],
    ].forEach(([n, y]) => {
      const r = (n * 0.3) / 40;
      const m = cylZ(gearsG, r, r, -0.05, 0.05, 0, y, M.insert, Math.max(12, n));
      m.rotation.y = Math.PI / 2;
      m.userData.controlPassThrough = true;
    });
    gearSet.userData.z = z;
  };
  rebuildGears(c.zSel);
  // ---------- stôl a obrobok ----------
  const tb = grp('stol');
  const slide = new THREE.Group();
  tb.add(slide);
  rbox(slide, -2.2, 2.2, 2.2, TT - 0.4, -1.8, 2.2, M.green, 0.12);
  const rot = new THREE.Group();
  rot.position.y = TT - 0.4;
  slide.add(rot);
  cylY(rot, 1.5, 1.5, 0, 0.4, 0, 0, M.steelDark, 64);
  for (let k = 0; k < 6; k++) {
    // upínky po obvode prstenca
    const a = (k * TAU) / 6,
      cl = box(rot, -0.08, 0.08, 0.4, 0.55, -0.09, 0.09, M.steel);
    cl.position.set(Math.cos(a) * (RO + 0.11), 0.475, -Math.sin(a) * (RO + 0.11));
    cl.rotation.y = a;
  }
  const workG = grp('obrobok', rot);
  let ring = createRing({ zT: ZT, b: B }),
    wMesh = null,
    dirty = true,
    lastB = -9;
  const buildWork = () => {
    if (wMesh) {
      workG.remove(wMesh);
      wMesh.geometry.dispose();
    }
    const shape = new THREE.Shape();
    shape.absarc(0, 0, RO, 0, TAU, false);
    const hole = new THREE.Path();
    for (let i = 0; i <= ring.N; i += 2) {
      const a = (i / ring.N) * TAU,
        r = RI + ring.depth[i % ring.N] / 100;
      if (i) hole.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      else hole.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    shape.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(shape, { depth: B / 100, bevelEnabled: false, curveSegments: 64 });
    g.rotateX(-Math.PI / 2);
    wMesh = new THREE.Mesh(g, M.gear);
    wMesh.position.y = 0.4;
    wMesh.castShadow = true;
    wMesh.userData.part = 'obrobok';
    workG.add(wMesh);
    dirty = false;
  };
  buildWork();
  const wD = handwheel(slide, 0.45, 2.55, 2.9, 0.6, 'x', 0.28); // radiálny prísuv (1 otáčka = 1 mm)
  const wL = handwheel(col, 0.3, -1.75, 8.6, 0.0, '-x', 0.18); // dĺžka zdvihu
  const wT = handwheel(col, 0.3, -1.75, 7.6, 0.0, '-x', 0.18); // poloha zdvihu
  // ---------- panel ----------
  const pan = grp('ovladanie', col);
  rbox(pan, 1.8, 1.92, 6.8, 9.4, -1.0, 0.4, M.panel, 0.03);
  const face = new THREE.Group();
  face.position.set(1.92, 0, -0.3);
  face.rotation.y = Math.PI / 2;
  pan.add(face);
  const mSw = mainSwitch(kit, M, face, 0, 8.9, 0.01);
  const bStart = panelButton(kit, M, face, -0.35, 7.9, 0.01, M.btnGreen),
    bStop = panelButton(kit, M, face, 0.35, 7.9, 0.01, M.red);
  const lampRun = M.lamp.clone();
  ball(face, 0.06, 0, 7.3, 0.02, lampRun);
  cable(col, [
    [1.9, 6.8, -0.75],
    [2.1, 5.8, -1.05],
    [1.85, 5.0, -1.15],
  ]);
  // ---------- stav ----------
  Object.assign(st, { spm: 0, ph: 0, wa: 0, d: c.d, cutT: -9, crashes: 0, crashF: false });
  // os obrobku je vo vzdialenosti a(d) od osi noža: pri d = 0 sa hlava noža dotkne hlavovej kružnice prstenca,
  // pri prísuve sa nôž vzďaľuje od osi obrobku (pri plnej hĺbke ≈ osová vzdialenosť AF)
  const axisDist = (d = st.d) => (RI - R0) * 100 + d;
  const place = () => {
    slide.position.x = NZX - axisDist() / 100;
  };
  place();
  // poloha spodku noža nad stolom (mm) pri fáze zdvihu ph (0 = horná úvrať)
  const cutterBottom = () => c.top - c.L * (0.5 - 0.5 * Math.cos(st.ph));
  Object.assign(anchors, {
    stojan: () => v3(0, 11.0, -1.2),
    noz: () => v3(NZX, TT + 1.2, 0.4),
    kolesa: () => v3(3.2, 5.6, -2.2),
    stol: () => v3(-2.2, TT - 0.4, 2.2),
    obrobok: () => v3(NZX - axisDist() / 100 - RO, TT + 0.4, 0),
    ovladanie: () => v3(1.92, 9.4, -0.3),
  });
  Object.assign(views, {
    celok: () => [
      [8, 11, 11],
      [0, 5.0, 0],
    ],
    rez: () => [[NZX + 1.8, TT + 2.4, 2.6], [NZX, TT + 0.5, 0], true],
    zhora: () => [[NZX - 0.3, TT + 6, 0.4], [NZX - 0.5, TT, 0], true],
  });
  const stopped = () => !c.running && st.spm < 1;
  const start = needPower(() => {
    if (c.door) return say(L('Zatvor dvierka výmenných kolies.', 'Close the change-gear door.'));
    if (!apiRef.current.safetyGate || apiRef.current.safetyGate.ok()) push('running', true);
    else apiRef.current.safetyGate.request();
  });
  apiRef.current.toggleRun = () => (c.running ? push('running', false) : start());
  apiRef.current.newBlank = () => {
    if (!stopped())
      return (say(L('Obrobok sa mení pri stojacom stroji.', 'The work is changed with the machine stopped.')), false);
    ring = createRing({ zT: ZT, b: B });
    push('d', 0);
    st.d = 0;
    st.crashes = 0;
    buildWork();
    return true;
  };
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
      hint: LL(
        'Spustí zdvihy noža a odvaľovanie (dvierka kolies musia byť zatvorené).',
        'Starts the cutter strokes and generating (the gear door must be closed).',
      ),
      action: start,
    },
    bStart,
  );
  ctrl.reg(
    {
      type: 'button',
      label: LL('STOP', 'STOP'),
      hint: LL('Zastaví stroj.', 'Stops the machine.'),
      action: () => push('running', false),
    },
    bStop,
  );
  ctrl.reg(
    {
      type: 'button',
      still: true,
      label: LL('Dvierka výmenných kolies', 'Change-gear door'),
      hint: LL(
        'Otvorí alebo zatvorí skriňu kolies – len pri stojacom stroji.',
        'Opens or closes the gear box – only with the machine stopped.',
      ),
      action: () => (stopped() ? push('door', !c.door) : say(L('Najprv zastav stroj.', 'Stop the machine first.'))),
      read: () => (c.door ? L('otvorené', 'open') : L('zatvorené', 'closed')),
    },
    door,
  );
  ctrl.reg(
    {
      type: 'button',
      still: true,
      label: LL('Výmenné kolesá delenia', 'Index change gears'),
      hint: LL(
        'Kliknutím nasadíš kolesá pre ďalší počet zubov z (pri otvorených dvierkach).',
        'Click to fit the gears for the next tooth count z (door open).',
      ),
      action: () => {
        if (!c.door) return say(L('Najprv otvor dvierka.', 'Open the door first.'));
        const i = OHA.zSet.indexOf(c.zSel);
        push('zSel', OHA.zSet[(i + 1) % OHA.zSet.length]);
      },
      read: () => `z ${c.zSel}`,
    },
    gearSet,
  );
  ctrl.reg(
    {
      type: 'wheel',
      minR: 0.25,
      inc: 1,
      label: LL('Koleso radiálneho prísuvu', 'Radial infeed handwheel'),
      hint: LL('1 otáčka = 1 mm do hĺbky.', '1 turn = 1 mm into depth.'),
      turn: (d) => push('d', clamp(Math.round((c.d + d / TAU) * 100) / 100, 0, 8)),
      read: () => `${st.d.toFixed(2)} mm`,
    },
    wD,
  );
  ctrl.reg(
    {
      type: 'wheel',
      minR: 0.15,
      inc: 1,
      label: LL('Dĺžka zdvihu', 'Stroke length'),
      hint: LL('Len pri stojacom stroji. 1 otáčka = 5 mm.', 'Machine stopped only. 1 turn = 5 mm.'),
      guard: () =>
        stopped() ||
        (say(L('Zdvih sa nastavuje pri stojacom stroji.', 'The stroke is set with the machine stopped.')), false),
      turn: (d) => push('L', clamp(Math.round(c.L + (d / TAU) * 5), 10, 70)),
      read: () => `${c.L} mm`,
    },
    wL,
  );
  ctrl.reg(
    {
      type: 'wheel',
      minR: 0.15,
      inc: 1,
      label: LL('Poloha zdvihu', 'Stroke position'),
      hint: LL('Horná úvrať nad stolom. 1 otáčka = 5 mm.', 'Top of stroke above the table. 1 turn = 5 mm.'),
      guard: () =>
        stopped() ||
        (say(L('Zdvih sa nastavuje pri stojacom stroji.', 'The stroke is set with the machine stopped.')), false),
      turn: (d) => push('top', clamp(Math.round(c.top + (d / TAU) * 5), 20, 120)),
      read: () => `${c.top} mm`,
    },
    wT,
  );
  // ---------- slučka ----------
  const update = (dt, t) => {
    if (!c.power && c.running) push('running', false);
    if (c.running && c.door) push('running', false);
    st.spm = approach(st.spm, c.running && c.power ? OHA.strokes[c.sn] : 0, 400 * dt);
    const running = st.spm > 1,
      dts = dt * c.timeScale;
    const prev = st.ph;
    st.ph += (st.spm / 60) * TAU * dt;
    const strokes = (st.spm / 60) * dts;
    // odvaľovanie: obrobok sa otočí o 2 f / (m z) na zdvih
    st.wa += (strokes * 2 * OHA.rotFeed[c.rf]) / (OHA.m * c.zSel);
    rot.rotation.y = st.wa;
    cutterG.rotation.y = st.wa * (c.zSel / OHA.z0);
    // poloha noža: spodok noža nad stolom
    const yb = cutterBottom();
    ram.position.y = TT + 0.4 + yb / 100;
    if (c.top - c.L < -8) {
      if (running && !st.crashF) {
        st.crashF = true;
        st.crashes++;
        push('running', false);
        say(
          L(
            'Nôž narazil do stola – skráť zdvih alebo zdvihni jeho polohu!',
            'The cutter hit the table – shorten the stroke or raise its position!',
          ),
          'danger',
        );
      }
    } else st.crashF = false;
    st.d = approach(st.d, c.d, (running ? 0.15 * c.timeScale : 3) * dt);
    if (!running && st.d > TOUCH && st.d > (st.dOld ?? 0) + 1e-6) {
      st.d = st.dOld ?? 0;
      c.d = st.d;
      pend.d = st.d;
      sayOnce(
        'stopcut',
        true,
        L(
          'Nôž by sa zarezal do stojaceho obrobku – spusti stroj.',
          'The cutter would cut into the stationary work – start the machine.',
        ),
        'danger',
      );
    }
    st.dOld = st.d;
    place();
    // rez: počas pracovného zdvihu (nadol) a prekrytia s obrobkom
    if (running && st.d > TOUCH && Math.sin(st.ph) > 0 && st.ph !== prev) {
      // nôž (šírka 15 mm) prejde pásmo od dolnej úvrati po hornú; plná šírka len s výbehom dole a nábehom hore
      const lo = c.top - c.L,
        cover = Math.max(0, Math.min(B, c.top + 15) - Math.max(0, lo)),
        cov = lo <= -1 && c.top >= B + 2 ? B : Math.min(cover, B - 1);
      if (cutAt(ring, -st.wa, st.d, c.zSel, cov) > 0) {
        dirty = true;
        st.cutT = t;
      }
      if (c.zSel !== ZT)
        sayOnce(
          'z',
          true,
          L(
            `Výmenné kolesá sú na z ${c.zSel}, prstenec je pre z ${ZT} – koleso bude mať zlý počet zubov.`,
            `The change gears are set for z ${c.zSel}, the ring is for z ${ZT} – the gear will have the wrong tooth count.`,
          ),
          'warn',
        );
      if (cov < B)
        sayOnce(
          'cov',
          true,
          L(
            'Zdvih neprechádza celou šírkou kolesa – zuby nebudú po celej šírke.',
            'The stroke does not cover the whole face width – the teeth will not run full width.',
          ),
          'warn',
        );
    }
    if (dirty && t - lastB > 0.25) {
      buildWork();
      lastB = t;
    }
    if (gearSet.userData.z !== c.zSel) rebuildGears(c.zSel);
    st.dOpen = approach(st.dOpen || 0, c.door ? 1 : 0, 2.5 * dt);
    door.rotation.y = st.dOpen * 1.8;
    gearSet.visible = st.dOpen > 0.02;
    lampRun.emissive.setHex(running ? 0x22dd55 : 0);
    wD.rotation.z = st.d * TAU;
    wL.rotation.z = (c.L / 5) * TAU;
    wT.rotation.z = (c.top / 5) * TAU;
  };
  return {
    update,
    tele: () => ({ spm: st.spm, d: st.d, L: c.L, top: c.top, info: ringInfo(ring), cutting: x.time() - st.cutT < 0.4 }),
    measure: () => ({ info: ringInfo(ring), crashes: st.crashes }),
    workObj: () => workG,
    workSpot: () => v3(0, 7, 6),
    canInspect: () => (!stopped() ? L('Najprv zastav stroj.', 'Stop the machine first.') : null),
    prepareInspect: () => buildWork(),
    sound: () => ({ motor: st.spm / 500, cut: x.time() - st.cutT < 0.4 ? 0.6 : 0 }),
  };
}

export { OhaSimulator };
export default OhaSimulator;
