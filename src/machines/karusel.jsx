import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { L, LL } from '../core/i18n';
import { TAU, approach, clamp } from '../core/util';
import { ExportSection, TaskSection } from '../ui/tools';
import { SectionInfo } from '../ui/sectionInfo';
import { DiscDrawing } from '../ui/sketch2';
import {
  BlankSection,
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
import { SK, createDisc, cutSpeed, cutTool, discInfo, engage, karuselChecks, outline } from './karuselMath';

// =====================================================================
// KARUSELOVÝ SÚSTRUH TOS HULÍN SK 12 – upínacia doska Ø1 200, priečnik, bočný suport so smykadlom
// =====================================================================
const TY = 2.0, // horná plocha upínacej dosky
  TR = 6.0, // polomer dosky
  TZ = 0.9; // os dosky (pod nožom)

const skParts = () =>
  mkParts([
    [
      'stojany',
      'Stojany a priečnik',
      'Columns and cross rail',
      'Dva stojany s priečnikom',
      'Two columns with the cross rail',
      'Portál z dvoch stojanov nesie priečnik, ktorý sa po uvoľnení zdvíha motorom. Pri reze musí byť priečnik upnutý.',
      'The portal of two columns carries the cross rail, raised by a motor when released. It must be clamped while cutting.',
    ],
    [
      'suport',
      'Suport so smykadlom',
      'Rail head with ram',
      'Suport na priečniku so smykadlom',
      'Rail head with ram',
      'Suport sa posúva po priečniku (radiálne, X), smykadlo s nožom zvisle (Z). Posuv sa zapína pákou – v mm na otáčku stola.',
      'The head slides along the rail (radial, X), the ram with the tool vertically (Z). The feed is engaged by a lever – in mm per table revolution.',
    ],
    [
      'stol',
      'Upínacia doska',
      'Faceplate',
      'Otočná upínacia doska Ø1 200',
      'Rotary faceplate Ø1,200',
      'Doska sa otáča okolo zvislej osi; obrobok leží na nej a ťažké diely sa ľahko upínajú. Štyri čeľuste držia kotúč v otvore zvnútra.',
      'The table rotates about the vertical axis; the work lies on it so heavy parts are easy to clamp. Four jaws grip the disc from inside its bore.',
    ],
    [
      'obrobok',
      'Obrobok',
      'Workpiece',
      'Kotúč Ø1 000 × 200',
      'Disc Ø1,000 × 200',
      'Oceľový kotúč Ø1 000 × 200 mm s otvorom Ø200.',
      'Steel disc Ø1,000 × 200 mm with a Ø200 bore.',
    ],
    [
      'ovladanie',
      'Ovládanie',
      'Controls',
      'Závesný ovládací panel',
      'Pendant control panel',
      'Hlavný vypínač, štart a stop stola, zdvih priečnika.',
      'Main switch, table start and stop, rail elevation.',
    ],
  ]);

const SK_TASKS = [
  {
    id: 'priemer',
    title: () => L('Vonkajší priemer Ø900 a čelo na výšku 180', 'Outer diameter Ø900 and face to 180 height'),
    desc: () =>
      L(
        'Kotúč Ø1 000 × 200: zarovnaj čelo na výšku 180 ±0,5 mm a osústruž vonkajší priemer na Ø900 ±0,5 mm po celej výške. Pre spekaný karbid volí rezná rýchlosť 80 – 150 m/min – pri veľkom priemere stačia nízke otáčky stola.',
        'Disc Ø1,000 × 200: face to 180 ±0.5 mm height and turn the outer diameter to Ø900 ±0.5 mm over the whole height. Carbide needs 80 – 150 m/min – at a large diameter low table speeds are enough.',
      ),
    setup: {},
    drawing: () => <DiscDrawing D={900} d={900} H={180} h={0} tol="±0,5" />,
    labels: {
      dia: () => L('Ø900 ±0,5 po celej výške', 'Ø900 ±0.5 over the whole height'),
      top: () => L('Výška 180 ±0,5 mm', 'Height 180 ±0.5 mm'),
      crash: () => L('Bez nárazu', 'No crash'),
    },
  },
  {
    id: 'osadenie',
    title: () => L('Osadenie Ø600 × 60', 'Shoulder Ø600 × 60'),
    desc: () =>
      L(
        'Na hornej časti kotúča vysústruž osadenie Ø600 ±0,5 mm do hĺbky 60 ±1 mm; výška kotúča zostáva 200 mm.',
        'Turn a shoulder Ø600 ±0.5 mm, 60 ±1 mm deep on the top of the disc; the disc height stays 200 mm.',
      ),
    setup: {},
    drawing: () => <DiscDrawing D={1000} d={600} H={200} h={60} tol="±0,5" />,
    labels: {
      dia: () => L('Osadenie Ø600 ±0,5', 'Shoulder Ø600 ±0.5'),
      step: () => L('Hĺbka osadenia 60 ±1 mm', 'Shoulder depth 60 ±1 mm'),
      top: () => L('Výška 200 mm zachovaná', 'Height 200 mm kept'),
      crash: () => L('Bez nárazu', 'No crash'),
    },
  },
].map((t) => ({ ...t, checks: (m) => karuselChecks[t.id](m).map((c) => ({ ...c, label: t.labels[c.key]() })) }));

const SK_SAFETY = () => [
  L(
    'Obrobok je upnutý všetkými čeľusťami, na doske nie sú voľné predmety.',
    'The work is clamped by all jaws, no loose items lie on the table.',
  ),
  L(
    'Priečnik je upnutý, do priestoru otáčajúcej sa dosky nevstupujem.',
    'The rail is clamped and I do not step into the area of the rotating table.',
  ),
  L('Rozmery meriam len pri stojacej doske.', 'I measure only with the table stopped.'),
];

function KaruselSimulator({ onBack, params }) {
  const mountRef = useRef(null),
    layerRef = useRef(null),
    tipRef = useRef(null);
  const init = {
    power: true,
    running: false,
    sp: 6,
    fd: 2,
    feedX: 0,
    feedZ: 0,
    x: 560,
    z: 0,
    rail: 50,
    railLock: true,
    light: true,
    manual: false,
    timeScale: 4,
  };
  const { ctl, ui, setUi, set, selected, selectPart, apiRef } = useMachine(init);
  const [tele, setTele] = useTele({ rpm: 0, x: 560, z: 0, tipY: 250, rail: 50, cutting: false, d: 1000, msg: null });
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
      colors: [0x7f9aa6, 0x678391, 0x4c6572],
      mats: {
        work: [0x8c949b, 0.35, 0.8, { flatShading: true }],
        workCut: [0xd5dade, 0.25, 0.9, { flatShading: true }],
        insert: [0xd4ab38, 0.35, 0.8],
      },
      name: L('Karuselový sústruh TOS Hulín SK 12', 'TOS Hulín SK 12 vertical turret lathe'),
      sound: 'lathe',
      debugKey: '__sk',
      build: (x) => buildSk(x),
    });
  }, []);
  const parts = skParts();
  const v = cutSpeed(Math.max(200, 2 * tele.x), SK.speeds[ui.sp]);
  const statusMsg = tele.msg
    ? tele.msg
    : !ui.power
      ? { kind: 'warn', text: L('Hlavný vypínač je vypnutý.', 'The main switch is off.') }
      : tele.cutting
        ? {
            kind: 'run',
            text: `${L('Sústruženie', 'Turning')} – r ${tele.x.toFixed(1)} mm, ${L('výška', 'height')} ${tele.tipY.toFixed(1)} mm, v ${v.toFixed(0)} m/min`,
          }
        : tele.rpm > 0.2
          ? {
              kind: 'run',
              text: L(
                'Doska sa otáča. Prisuň nôž a zapni posuv.',
                'The table turns. Bring the tool in and engage the feed.',
              ),
            }
          : {
              kind: 'idle',
              text: L(
                'Upni priečnik, zvoľ otáčky a posuv a spusti dosku.',
                'Clamp the rail, select speed and feed and start the table.',
              ),
            };
  const chips = [
    {
      color: tele.rpm > 0.2 ? '#3ee06c' : '#8b8f89',
      text: tele.rpm > 0.2 ? `${tele.rpm.toFixed(1)} ${L('ot/min', 'rpm')}` : L('Doska stojí', 'Table stopped'),
    },
  ];
  if (!ui.railLock) chips.push({ color: '#ff8a1f', text: L('Priečnik uvoľnený', 'Rail released') });
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
        canUnclamp
        workLabels={[L('Pozrieť obrobok', 'Inspect workpiece'), L('Upnúť späť', 'Clamp back')]}
        tips={[
          L(
            'Rezná rýchlosť rastie s priemerom: pri Ø1 000 a 25 ot/min je 79 m/min.',
            'Cutting speed grows with the diameter: at Ø1,000 and 25 rpm it is 79 m/min.',
          ),
          L(
            'Čelo zarovnávaj radiálnym posuvom (X), priemer zvislým posuvom (Z).',
            'Face with the radial feed (X), turn the diameter with the vertical feed (Z).',
          ),
        ]}
      />
      <aside className="panel">
        <fieldset className="machine-settings" disabled={ui.unclamped}>
          <PanelHeader
            ui={ui}
            set={set}
            kicker={L('Simulátor · karusel', 'Simulator · vertical lathe')}
            title={L('Karuselový sústruh', 'Vertical turret lathe')}
            sub={L(
              'Predloha: TOS Hulín SK 12 – upínacia doska Ø1 200 mm, točný priemer do 1 300 mm, výška obrobku do 1 000 mm, obrobok do 4 t. Mierka 1 : 100 mm.',
              'Modelled after the TOS Hulín SK 12 – faceplate Ø1,200 mm, swing up to 1,300 mm, work height up to 1,000 mm, work up to 4 t. Scale 1 : 100 mm.',
            )}
            rows={[
              ['r', tele.x.toFixed(1)],
              ['Z', tele.tipY.toFixed(1)],
              ['Ø', (2 * tele.x).toFixed(1)],
            ]}
            foot={[
              `${SK.speeds[ui.sp]} ${L('ot/min', 'rpm')}`,
              `${SK.feeds[ui.fd]} mm/${L('ot', 'rev')}`,
              `v ${v.toFixed(0)} m/min`,
            ]}
            status={statusMsg}
          />
          <TaskSection
            machine="karusel"
            tasks={SK_TASKS}
            apiRef={apiRef}
            params={params}
            status={statusMsg}
            onSetup={() => apiRef.current.newBlank?.()}
            safety={{ ui, set, runKey: 'running', items: SK_SAFETY() }}
          />
          <div className="sec">
            <h2 className="sec-title mb-2">{L('Doska a posuvy', 'Table and feeds')}</h2>
            <button type="button" className="btn-run w-full" onClick={() => apiRef.current.toggleRun?.()}>
              {ui.running ? L('■ Stop dosky', '■ Stop table') : L('▶ Štart dosky', '▶ Start table')}
            </button>
            <div className="mt-2">
              <Toggle
                on={ui.power}
                label={L('Hlavný vypínač', 'Main switch')}
                onClick={() => set('power', !ui.power)}
              />
            </div>
            <SegRow
              label={L('Otáčky dosky', 'Table speed')}
              value={ui.sp}
              options={SK.speeds.map((n, i) => [i, String(n)])}
              onChange={(i) => !ui.running && set('sp', i)}
            />
            <SegRow
              label={L('Posuv mm/ot', 'Feed mm/rev')}
              value={ui.fd}
              options={SK.feeds.map((f, i) => [i, String(f)])}
              onChange={(i) => set('fd', i)}
            />
            <SegRow
              label={L('Radiálny posuv X', 'Radial feed X')}
              value={ui.feedX}
              options={[
                [-1, L('k osi', 'in')],
                [0, '0'],
                [1, L('von', 'out')],
              ]}
              onChange={(d) => set('feedX', d)}
            />
            <SegRow
              label={L('Zvislý posuv Z', 'Vertical feed Z')}
              value={ui.feedZ}
              options={[
                [-1, L('dole', 'down')],
                [0, '0'],
                [1, L('hore', 'up')],
              ]}
              onChange={(d) => set('feedZ', d)}
            />
            <Slider
              id="skx"
              label={L('Suport – polomer r', 'Head – radius r')}
              unit="mm"
              min={0}
              max={650}
              step={0.1}
              value={ui.x}
              actual={tele.x}
              digits={1}
              onChange={(val) => set('x', val)}
            />
            <Slider
              id="skz"
              label={L('Smykadlo Z', 'Ram Z')}
              unit="mm"
              min={0}
              max={600}
              step={0.1}
              value={ui.z}
              actual={tele.z}
              digits={1}
              onChange={(val) => set('z', val)}
            />
          </div>
          <div className="sec">
            <div className="section-heading">
              <h2 className="sec-title mb-2">{L('Priečnik', 'Cross rail')}</h2>
              <SectionInfo title={L('Priečnik', 'Cross rail')}>
                <p className="text-xs muted">
                  {L(
                    'Priečnik sa prestavuje podľa výšky obrobku – len pri stojacej doske a uvoľnenej páke upnutia.',
                    'The rail is set to the work height – only with the table stopped and the clamp lever released.',
                  )}
                </p>
              </SectionInfo>
            </div>
            <Toggle
              on={!ui.railLock}
              label={L('Priečnik uvoľnený', 'Rail released')}
              onClick={() => set('railLock', !ui.railLock)}
            />
            <Slider
              id="skr"
              label={L('Výška priečnika', 'Rail height')}
              unit="mm"
              min={-200}
              max={400}
              step={10}
              value={ui.rail}
              actual={tele.rail}
              digits={0}
              onChange={(val) => set('rail', val)}
              disabled={ui.railLock}
            />
          </div>
          <BlankSection
            onApply={() => apiRef.current.newBlank?.()}
            applyLabel={L('Upnúť nový kotúč', 'Clamp a new disc')}
          >
            <p className="text-xs muted">
              {L('Oceľový kotúč Ø1 000 × 200 mm s otvorom Ø200.', 'Steel disc Ø1,000 × 200 mm with a Ø200 bore.')}
            </p>
          </BlankSection>
          <ExportSection machine="karusel" apiRef={apiRef} canSave={false} />
          <ViewSection
            apiRef={apiRef}
            views={[
              ['celok', L('Celok', 'Overview')],
              ['rez', L('Detail noža', 'Tool detail')],
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

function buildSk(x) {
  const { kit, det, M, grp, v3, c, st, ctrl, push, pend, say, sayOnce, needPower, anchors, views, apiRef } = x;
  const { add, box, cylY, ball, handwheel, pivotLever } = kit;
  const { rbox, ribs, nameplate, oilGlass, cable } = det;
  // ---------- stojany a priečnik ----------
  const fr = grp('stojany');
  rbox(fr, -9.4, 9.4, 0, 1.2, -3.6, 7.2, M.greenDeep, 0.15); // základ
  [-1, 1].forEach((s) => {
    rbox(fr, s * 8.2 - 1.0, s * 8.2 + 1.0, 1.2, 15.5, -3.4, -0.8, M.green, 0.22);
    ribs(fr, 'y', 3, 14, 5, s * 8.2 - 0.9, s * 8.2 + 0.9, -3.55, 0.15, 0.12, M.greenDark);
    box(fr, s * 8.2 - 0.5, s * 8.2 + 0.5, 2.0, 15.0, -0.8, -0.7, M.ways);
  });
  rbox(fr, -9.4, 9.4, 15.5, 16.4, -3.6, -0.6, M.greenDark, 0.15); // horný most
  nameplate(fr, 8.2, 4.0, -0.79, 0, 'TOS Hulín', 'SK 12', 1.3);
  oilGlass(fr, -8.2, 3.2, -0.79);
  const rail = new THREE.Group();
  fr.add(rail);
  rbox(rail, -9.2, 9.2, -0.6, 0.6, -0.7, 0.3, M.green, 0.12);
  box(rail, -7.0, 7.0, -0.5, 0.5, 0.3, 0.36, M.ways);
  const lockLev = pivotLever(rail, -7.6, 0, 0.32, 0.4, 1.2); // upnutie priečnika
  // ---------- suport a smykadlo ----------
  const sup = grp('suport', rail);
  const head = new THREE.Group();
  sup.add(head);
  rbox(head, -0.8, 0.8, -1.0, 0.8, 0.36, 1.4, M.green, 0.1);
  const ram = new THREE.Group();
  head.add(ram);
  rbox(ram, -0.35, 0.35, -5.0, 0.6, 0.55, 1.25, M.greenDark, 0.05);
  // držiak noža a nôž: špička vľavo dole (smerom k osi), dĺžka smykadla odspodu
  rbox(ram, -0.45, 0.45, -5.4, -5.0, 0.5, 1.3, M.steelDark, 0.04);
  box(ram, -0.6, 0.1, -5.62, -5.4, 0.8, 1.0, M.steel); // nôž
  box(ram, -0.6, -0.48, -5.65, -5.6, 0.8, 1.0, M.insert); // plátok
  const wX = handwheel(head, 0.38, 0.95, 0.0, 1.2, 'x', 0.22);
  const wZ = handwheel(head, 0.38, 0.0, 0.55, 1.42, 'z', 0.22);
  const levFX = pivotLever(head, -0.6, -0.7, 1.42, 0.34, 1.2),
    levFZ = pivotLever(head, 0.5, -0.7, 1.42, 0.34, 1.2);
  // ---------- upínacia doska a čeľuste ----------
  const tb = grp('stol');
  cylY(tb, TR + 0.4, TR + 0.5, 1.2, TY - 0.3, 0, TZ, M.greenDark, 64); // podstavec dosky (os pred stojanmi)
  const spin = new THREE.Group();
  spin.position.set(0, 0, TZ);
  tb.add(spin);
  cylY(spin, TR, TR, TY - 0.3, TY, 0, 0, M.steelDark, 96);
  for (let k = 0; k < 8; k++) {
    const s = add(spin, new THREE.BoxGeometry(TR * 1.9, 0.02, 0.16), M.black, 0, TY + 0.005, 0);
    s.rotation.y = (k * Math.PI) / 8; // radiálne T-drážky
  }
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2,
      jaw = new THREE.Group();
    jaw.rotation.y = a;
    spin.add(jaw);
    box(jaw, 0.6, 0.98, TY, TY + 1.2, -0.18, 0.18, M.steel); // čeľusť v otvore (Ø200)
  }
  // ---------- obrobok ----------
  const workG = grp('obrobok', spin);
  let disc = createDisc(),
    wMesh = null,
    dirty = true,
    lastB = -9;
  const buildWork = () => {
    if (wMesh) {
      workG.remove(wMesh);
      wMesh.geometry.dispose();
    }
    const pts = outline(disc).map(([r, y]) => new THREE.Vector2(r / 100, y / 100));
    wMesh = new THREE.Mesh(
      new THREE.LatheGeometry(pts, 160),
      disc.rOut.some((r) => r < disc.R0 - 0.01) ? M.workCut : M.work,
    );
    wMesh.material.side = THREE.DoubleSide;
    wMesh.position.y = TY;
    wMesh.castShadow = true;
    wMesh.receiveShadow = true;
    wMesh.userData.part = 'obrobok';
    workG.add(wMesh);
    dirty = false;
  };
  buildWork();
  const crashes = { n: 0 };
  // ---------- závesný panel ----------
  const pan = grp('ovladanie');
  rbox(pan, 10.0, 11.6, 8.0, 10.6, 3.6, 3.85, M.panel, 0.06);
  cylY(pan, 0.06, 0.06, 10.6, 15.6, 10.8, 3.7, M.steelDark, 10);
  const mSw = mainSwitch(kit, M, pan, 10.8, 10.1, 3.86);
  const bStart = panelButton(kit, M, pan, 10.4, 9.3, 3.86, M.btnGreen),
    bStop = panelButton(kit, M, pan, 10.8, 9.3, 3.86, M.red),
    bUp = panelButton(kit, M, pan, 11.2, 9.3, 3.86, M.white),
    bDown = panelButton(kit, M, pan, 11.2, 8.8, 3.86, M.white);
  const lampRun = M.lamp.clone();
  ball(pan, 0.07, 10.4, 8.8, 3.88, lampRun);
  cable(fr, [
    [9.4, 15.0, -2.0],
    [10.6, 15.6, 1.0],
    [10.8, 15.6, 3.7],
  ]);
  const lamp = x.lamp({
    parent: fr,
    base: v3(-8.2, 15.5, -0.8),
    elbow: v3(-7.0, 16.6, 1.2),
    head: v3(-3.0, 12.0, 3.4),
    aim: v3(2.0, TY + 2, TZ),
    angle: 0.55,
    power: 3,
  });
  // ---------- stav ----------
  Object.assign(st, { x: c.x, z: c.z, rail: c.rail, rpm: 0, a: 0, cutT: -9 });
  const railY = (r = st.rail) => 9.6 + r / 100;
  // špička noža (mm): r = polomer od osi dosky, y = výška nad doskou
  const tipY = (z = st.z, r = st.rail) => (railY(r) - 5.65 - z / 100 - TY) * 100;
  const place = () => {
    rail.position.y = railY();
    sup.position.x = st.x / 100 + 0.6; // špička noža je 0,6 vľavo od stredu suportu
    ram.position.y = -st.z / 100;
  };
  place();
  Object.assign(anchors, {
    stojany: () => v3(-8.2, 13.0, -0.8),
    suport: () => v3(st.x / 100 + 0.6, railY() + 1.0, 1.4),
    stol: () => v3(-TR, TY, TZ),
    obrobok: () => v3(-3.5, TY + 2.1, TZ),
    ovladanie: () => v3(10.8, 10.8, 3.86),
  });
  Object.assign(views, {
    celok: () => [
      [14, 15, 24],
      [0, 6.5, 1.5],
    ],
    rez: () => [[st.x / 100 + 3, TY + 3.5, 6.5], [st.x / 100, TY + tipY() / 100, TZ], true],
    zhora: () => [[0, 24, 3], [0, TY, TZ], true],
  });
  const stopped = () => !c.running && st.rpm < 0.05;
  const start = needPower(() => {
    if (!c.railLock) {
      say(L('Najprv upni priečnik.', 'Clamp the cross rail first.'));
      return;
    }
    if (!apiRef.current.safetyGate || apiRef.current.safetyGate.ok()) push('running', true);
    else apiRef.current.safetyGate.request();
  });
  apiRef.current.toggleRun = () => (c.running ? push('running', false) : start());
  const railMove = (dir) => {
    if (!stopped())
      return say(L('Priečnik sa prestavuje len pri stojacej doske.', 'The rail is moved only with the table stopped.'));
    if (c.railLock) return say(L('Priečnik je upnutý – uvoľni páku.', 'The rail is clamped – release the lever.'));
    push('rail', clamp(c.rail + dir * 50, -200, 400));
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
      label: LL('ŠTART dosky', 'Table START'),
      hint: LL(
        'Roztočí upínaciu dosku (priečnik musí byť upnutý).',
        'Starts the faceplate (the rail must be clamped).',
      ),
      action: start,
    },
    bStart,
  );
  ctrl.reg(
    {
      type: 'button',
      label: LL('STOP dosky', 'Table STOP'),
      hint: LL('Zastaví dosku a posuvy.', 'Stops the table and the feeds.'),
      action: () => {
        push('running', false);
        push('feedX', 0);
        push('feedZ', 0);
      },
    },
    bStop,
  );
  ctrl.reg(
    {
      type: 'button',
      label: LL('Priečnik ▲', 'Rail ▲'),
      hint: LL('Zdvihne uvoľnený priečnik o 50 mm.', 'Raises the released rail by 50 mm.'),
      action: () => railMove(1),
    },
    bUp,
  );
  ctrl.reg(
    {
      type: 'button',
      label: LL('Priečnik ▼', 'Rail ▼'),
      hint: LL('Spustí uvoľnený priečnik o 50 mm.', 'Lowers the released rail by 50 mm.'),
      action: () => railMove(-1),
    },
    bDown,
  );
  ctrl.reg(
    {
      type: 'lever',
      angles: [0.5, -0.5],
      minR: 0.2,
      label: LL('Upnutie priečnika', 'Rail clamp'),
      hint: LL('Hore = upnutý.', 'Up = clamped.'),
      getIdx: () => (c.railLock ? 0 : 1),
      onSet: (i) =>
        stopped() || i === 0
          ? push('railLock', i === 0)
          : say(L('Priečnik sa uvoľňuje len pri stojacej doske.', 'The rail is released only with the table stopped.')),
      read: () => (c.railLock ? L('upnutý', 'clamped') : L('uvoľnený', 'released')),
    },
    lockLev,
  );
  const feedLever = (key, label, obj, names) =>
    ctrl.reg(
      {
        type: 'lever',
        angles: [0.6, 0, -0.6],
        minR: 0.2,
        label,
        hint: LL(
          'Posuv v mm na otáčku dosky; len pri bežiacej doske.',
          'Feed in mm per table revolution; only with the table running.',
        ),
        getIdx: () => c[key] + 1,
        onSet: (i) => push(key, i - 1),
        read: () => names[c[key] + 1],
      },
      obj,
    );
  feedLever('feedX', LL('Páka radiálneho posuvu X', 'Radial feed lever X'), levFX, ['←', '0', '→']);
  feedLever('feedZ', LL('Páka zvislého posuvu Z', 'Vertical feed lever Z'), levFZ, ['↓', '0', '↑']);
  ctrl.reg(
    {
      type: 'wheel',
      minR: 0.2,
      inc: 1,
      label: LL('Koleso suportu (X)', 'Head handwheel (X)'),
      hint: LL('1 otáčka = 5 mm na polomere.', '1 turn = 5 mm on the radius.'),
      guard: () => !c.feedX || (say(L('Najprv vypni posuv X.', 'Disengage feed X first.')), false),
      turn: (d) => push('x', clamp(Math.round((c.x + (d / TAU) * 5) * 100) / 100, 0, 650)),
      read: () => `r ${st.x.toFixed(2)} mm`,
    },
    wX,
  );
  ctrl.reg(
    {
      type: 'wheel',
      minR: 0.2,
      inc: -1,
      label: LL('Koleso smykadla (Z)', 'Ram handwheel (Z)'),
      hint: LL(
        '1 otáčka = 5 mm. V smere hodinových ručičiek ide nôž dole.',
        '1 turn = 5 mm. Clockwise lowers the tool.',
      ),
      guard: () => !c.feedZ || (say(L('Najprv vypni posuv Z.', 'Disengage feed Z first.')), false),
      turn: (d) => push('z', clamp(Math.round((c.z - (d / TAU) * 5) * 100) / 100, 0, 600)),
      read: () => `${L('výška', 'height')} ${tipY().toFixed(2)} mm`,
    },
    wZ,
  );
  apiRef.current.newBlank = () => {
    if (!stopped())
      return (say(L('Kotúč sa mení pri stojacej doske.', 'The disc is changed with the table stopped.')), false);
    disc = createDisc();
    buildWork();
    crashes.n = 0;
    say(L('Upnutý nový kotúč Ø1 000 × 200 mm.', 'A new disc Ø1,000 × 200 mm is clamped.'), 'info');
    return true;
  };
  // ---------- slučka ----------
  const update = (dt, t) => {
    if (!c.power && c.running) push('running', false);
    if (c.running && !c.railLock) {
      push('running', false);
      say(L('Priečnik nie je upnutý – doska zastavená.', 'The rail is not clamped – table stopped.'), 'danger');
    }
    st.rpm = approach(st.rpm, c.running && c.power ? SK.speeds[c.sp] : 0, 20 * dt);
    const running = st.rpm > 0.2,
      dts = dt * c.timeScale;
    st.a += (st.rpm / 60) * TAU * dt;
    spin.rotation.y = st.a;
    const fr2 = ((SK.feeds[c.fd] * st.rpm) / 60) * dts;
    if (c.feedX && running) {
      c.x = clamp(c.x + c.feedX * fr2, 0, 650);
      pend.x = Math.round(c.x * 10) / 10;
    } else if (c.feedX && !running) push('feedX', 0);
    if (c.feedZ && running) {
      c.z = clamp(c.z - c.feedZ * fr2, 0, 600);
      pend.z = Math.round(c.z * 10) / 10;
    } else if (c.feedZ && !running) push('feedZ', 0);
    const old = { x: st.x, z: st.z, rail: st.rail };
    st.x = approach(st.x, c.x, c.feedX && running ? 1e9 : 300 * dt);
    st.z = approach(st.z, c.z, c.feedZ && running ? 1e9 : 300 * dt);
    if (!c.railLock) st.rail = approach(st.rail, c.rail, 80 * dt);
    const ty = tipY(),
      eng = engage(disc, st.x, ty);
    let obst = null;
    if (ty < 0.5) obst = L('upínacej dosky', 'the faceplate');
    else if (st.x < 100 && ty < 120) obst = L('čeľustí', 'the jaws');
    const block = (why) => {
      Object.assign(st, old);
      c.x = st.x;
      c.z = st.z;
      pend.x = st.x;
      pend.z = st.z;
      push('feedX', 0);
      push('feedZ', 0);
      sayOnce('crash', true, why, 'danger');
    };
    if (obst) {
      if (!st.crashF) crashes.n++;
      st.crashF = true;
      block(
        `${L('Nôž by narazil do', 'The tool would hit')} ${obst} – ${L('pohyb je zastavený.', 'the motion is stopped.')}`,
      );
    } else if (eng > 0.01 && !running) {
      block(
        L(
          'Nôž sa dotkol obrobku pri stojacej doske – spusti dosku.',
          'The tool touched the work with the table stopped – start the table.',
        ),
      );
    } else {
      st.crashF = false;
      if (eng > 0.01) {
        if (eng > 8)
          sayOnce(
            'deep',
            true,
            L(
              'Príliš hlboký záber – nôž sa preťažuje. Uber najviac 8 mm naraz.',
              'Depth of cut too large – the tool is overloaded. Take at most 8 mm at once.',
            ),
            'warn',
          );
        if (cutTool(disc, st.x, ty) > 0) {
          dirty = true;
          st.cutT = t;
        }
        const vc = cutSpeed(2 * st.x, st.rpm);
        sayOnce(
          'vc',
          vc > 180,
          L('Príliš vysoká rezná rýchlosť – zníž otáčky dosky.', 'Cutting speed too high – reduce the table speed.'),
          'warn',
        );
      }
    }
    if (dirty && t - lastB > 0.2) {
      buildWork();
      lastB = t;
    }
    place();
    lampRun.emissive.setHex(running ? 0x22dd55 : 0);
    lamp.update(c.light);
    wX.rotation.z = (st.x / 5) * TAU;
    wZ.rotation.z = (-st.z / 5) * TAU;
  };
  return {
    update,
    tele: () => ({
      rpm: st.rpm,
      x: st.x,
      z: st.z,
      tipY: tipY(),
      rail: st.rail,
      cutting: x.time() - st.cutT < 0.3,
      d: 2 * st.x,
    }),
    measure: () => ({ info: discInfo(disc), crashes: crashes.n }),
    workObj: () => workG,
    workSpot: () => v3(0, 9, 14),
    canInspect: () => (!stopped() ? L('Najprv zastav dosku.', 'Stop the table first.') : null),
    prepareInspect: () => buildWork(),
    sound: () => ({ motor: st.rpm / 71, cut: x.time() - st.cutT < 0.3 ? 0.7 : 0 }),
  };
}

export { KaruselSimulator };
export default KaruselSimulator;
