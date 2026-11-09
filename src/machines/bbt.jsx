import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { L, LL, RPM } from '../core/i18n';
import { TAU, approach, clamp } from '../core/util';
import { ExportSection, TaskSection } from '../ui/tools';
import { SectionInfo } from '../ui/sectionInfo';
import { ToolAngleDrawing } from '../ui/sketch2';
import {
  HelpFooter,
  PanelHeader,
  PartsSection,
  SceneView,
  SegRow,
  Slider,
  ViewSection,
  mkParts,
  useMachine,
  useTele,
} from '../ui/common';
import { createClassicScene, mainSwitch, panelButton } from './classic/scaffold';
import { TOOL, clipPoly, toolAngles, toolPoly } from './toolGrindMath';

// =====================================================================
// DVOJKOTÚČOVÁ STOJANOVÁ BRÚSKA TOS BBT 350 – kotúče Ø350, opierky, ochranné štíty, nádobka s vodou
// =====================================================================
const WY = 10.8, // os kotúčov
  RW = 1.75, // polomer kotúča Ø350
  BW = 0.4, // šírka kotúča
  WXS = [-2.6, 2.6]; // stredy kotúčov (hrubý, jemný)

const bbtParts = () =>
  mkParts([
    [
      'stojan',
      'Stojan',
      'Pedestal',
      'Liatinový stojan',
      'Cast-iron pedestal',
      'Stojan pripevnený k podlahe kotvami; na ňom je nádobka s vodou na chladenie nástroja.',
      'Pedestal bolted to the floor; it carries the water pot for cooling the tool.',
    ],
    [
      'kotuce',
      'Kotúče',
      'Wheels',
      'Brúsne kotúče Ø350 v krytoch',
      'Ø350 wheels in guards',
      'Vľavo hrubý kotúč na hrubovanie, vpravo jemný na dokončenie. Kryt zakrýva kotúč, voľný je len pracovný výrez.',
      'Coarse wheel on the left for roughing, fine on the right for finishing. The guard covers the wheel except for the working opening.',
    ],
    [
      'opierky',
      'Opierky a štíty',
      'Rests and shields',
      'Opierky nástroja a ochranné štíty',
      'Tool rests and eye shields',
      'Medzera medzi opierkou a kotúčom smie byť najviac 3 mm – inak sa nôž vtiahne medzi opierku a kotúč. Priehľadný štít chráni oči.',
      'The gap between the rest and the wheel must be at most 3 mm – otherwise the tool is pulled in between the rest and the wheel. The clear shield protects the eyes.',
    ],
    [
      'noz',
      'Nôž',
      'Tool bit',
      'Sústružnícky nôž 16 × 16 HSS',
      'Turning tool 16 × 16 HSS',
      'Nôž sa drží v rukách na opierke a často sa chladí vo vode – inak sa prepáli.',
      'The tool is held by hand on the rest and cooled in water often – otherwise it burns.',
    ],
    [
      'ovladanie',
      'Ovládanie',
      'Controls',
      'Vypínač na stojane',
      'Switch on the pedestal',
      'Hlavný vypínač, štart a stop motora.',
      'Main switch, motor start and stop.',
    ],
  ]);

const BBT_TASKS = [
  {
    id: 'ostrenie',
    title: () => L('Naostrenie chrbta noža na α = 8°', 'Sharpen the tool flank to α = 8°'),
    desc: () =>
      L(
        'Nastav medzeru opierky najviac 3 mm, sklop štít, drž nôž na opierke pod uhlom 8° a prebrús celú chrbtovú plochu na jemnom kotúči. Nôž často chlaď vo vode, aby sa neprepálil.',
        'Set the rest gap to at most 3 mm, lower the shield, hold the tool on the rest at 8° and grind the whole flank on the fine wheel. Cool the tool in water often so it does not burn.',
      ),
    setup: {},
    drawing: () => <ToolAngleDrawing alpha={8} gamma={0} />,
    checks: (m) => [
      {
        label: L('Uhol chrbta 8 ±1°', 'Clearance angle 8 ±1°'),
        ok: m.ang.alpha !== null && Math.abs(m.ang.alpha - 8) <= 1,
        value: m.ang.alpha === null ? '—' : `${m.ang.alpha.toFixed(1)}°`,
      },
      {
        label: L('Prebrúsená celá chrbtová plocha', 'Whole flank ground'),
        ok: m.ang.endLen >= 0.9 * TOOL.H,
        value: `${m.ang.endLen.toFixed(1)} mm`,
      },
      { label: L('Nôž neprepálený', 'Tool not burnt'), ok: !m.burn, value: m.burn ? '✗' : '✓' },
      {
        label: L('Medzera opierky ≤ 3 mm pri brúsení', 'Rest gap ≤ 3 mm while grinding'),
        ok: !m.gapBad,
        value: m.gapBad ? '✗' : '✓',
      },
      {
        label: L('Štít sklopený pri brúsení', 'Shield lowered while grinding'),
        ok: !m.shieldBad,
        value: m.shieldBad ? '✗' : '✓',
      },
    ],
  },
];

const BBT_SAFETY = () => [
  L(
    'Kotúče sú bez trhlín, kryty sú nasadené, medzera opierky je najviac 3 mm.',
    'The wheels are crack-free, the guards are on and the rest gap is at most 3 mm.',
  ),
  L(
    'Mám ochranné okuliare a sklopený štít; pri brúsení nemám rukavice ani voľný odev.',
    'I wear safety glasses with the shield lowered; no gloves or loose clothing while grinding.',
  ),
  L(
    'Stojím mimo roviny kotúča pri rozbehu a nôž často chladím vo vode.',
    'I stand out of the wheel plane at start-up and cool the tool in water often.',
  ),
];

function BbtSimulator({ onBack, params }) {
  const mountRef = useRef(null),
    layerRef = useRef(null),
    tipRef = useRef(null);
  const init = {
    power: true,
    running: false,
    wheel: 1,
    gap: 6,
    shield: false,
    tilt: 0,
    tz: 25,
    tx: 0,
    light: true,
    manual: false,
  };
  const { ctl, ui, setUi, set, selected, selectPart, apiRef } = useMachine(init);
  const [tele, setTele] = useTele({ rpm: 0, heat: 0, alpha: null, grinding: false, burn: false, gap: 6, msg: null });
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
      colors: [0x86a58f, 0x6f8e78, 0x52705b],
      mats: {
        coarse: [0x7c7366, 0.95, 0],
        fine: [0xb7b3a6, 0.95, 0],
        tool: [0xc7ccd1, 0.3, 0.85],
        burnt: [0x5a4a8e, 0.35, 0.7],
        hot: [0xd88a3a, 0.4, 0.6],
        water: new THREE.MeshStandardMaterial({
          color: 0x3f7fb0,
          roughness: 0.1,
          metalness: 0,
          transparent: true,
          opacity: 0.7,
        }),
        glass: new THREE.MeshStandardMaterial({
          color: 0xd8f0ff,
          roughness: 0.05,
          metalness: 0,
          transparent: true,
          opacity: 0.3,
          side: THREE.DoubleSide,
        }),
        spark: new THREE.MeshBasicMaterial({ color: 0xffb347, toneMapped: false }),
      },
      name: L('Dvojkotúčová stojanová brúska TOS BBT 350', 'TOS BBT 350 double-wheel pedestal grinder'),
      sound: 'grinder',
      debugKey: '__bbt',
      build: (x) => buildBbt(x),
    });
  }, []);
  const parts = bbtParts();
  const statusMsg = tele.msg
    ? tele.msg
    : !ui.power
      ? { kind: 'warn', text: L('Hlavný vypínač je vypnutý.', 'The main switch is off.') }
      : tele.grinding
        ? {
            kind: tele.heat > 0.7 ? 'warn' : 'run',
            text: `${L('Brúsenie – teplota noža', 'Grinding – tool temperature')} ${Math.round(20 + tele.heat * 280)} °C`,
          }
        : tele.rpm > 5
          ? {
              kind: 'run',
              text: L(
                'Kotúče bežia. Polož nôž na opierku a prisuň ho ku kotúču.',
                'The wheels run. Lay the tool on the rest and push it to the wheel.',
              ),
            }
          : {
              kind: 'idle',
              text: L(
                'Nastav medzeru opierky ≤ 3 mm, sklop štít a spusti brúsku.',
                'Set the rest gap ≤ 3 mm, lower the shield and start the grinder.',
              ),
            };
  const chips = [
    {
      color: tele.rpm > 5 ? '#3ee06c' : '#8b8f89',
      text: tele.rpm > 5 ? `${Math.round(tele.rpm)} ${RPM()}` : L('Stojí', 'Stopped'),
    },
  ];
  chips.push({ color: ui.gap <= 3 ? '#7fb6ff' : '#ff5a4f', text: `${L('medzera', 'gap')} ${ui.gap.toFixed(1)} mm` });
  if (!ui.shield) chips.push({ color: '#ff8a1f', text: L('Štít hore', 'Shield up') });
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
        workLabels={[L('Pozrieť nôž', 'Inspect the tool'), L('Späť k brúske', 'Back to the grinder')]}
        tips={[
          L(
            'Nôž ťahaj ku kotúču za telom noža (ručné ovládanie), uhol drž podľa stupnice.',
            'Drag the tool to the wheel by its body (manual control), hold the angle by the scale.',
          ),
        ]}
      />
      <aside className="panel">
        <fieldset className="machine-settings" disabled={ui.unclamped}>
          <PanelHeader
            ui={ui}
            set={set}
            kicker={L('Simulátor · brúska', 'Simulator · grinder')}
            title={L('Dvojkotúčová stojanová brúska', 'Double-wheel pedestal grinder')}
            sub={L(
              'Predloha: TOS BBT 350 – dva kotúče Ø350 mm na stojane, opierky a ochranné štíty. Mierka 1 : 100 mm.',
              'Modelled after the TOS BBT 350 – two Ø350 mm wheels on a pedestal, tool rests and eye shields. Scale 1 : 100 mm.',
            )}
            rows={[
              ['α', tele.alpha === null ? '—' : `${tele.alpha.toFixed(1)}°`],
              [L('Teplota', 'Temp.'), `${Math.round(20 + tele.heat * 280)} °C`],
              [L('Medzera', 'Gap'), `${tele.gap.toFixed(1)}`],
            ]}
            foot={[
              ui.wheel ? L('jemný kotúč', 'fine wheel') : L('hrubý kotúč', 'coarse wheel'),
              `${L('uhol držania', 'holding angle')} ${ui.tilt}°`,
            ]}
            status={statusMsg}
          />
          <TaskSection
            machine="dvojkotuc"
            tasks={BBT_TASKS}
            apiRef={apiRef}
            params={params}
            status={statusMsg}
            onSetup={() => apiRef.current.newBlank?.()}
            safety={{ ui, set, runKey: 'running', items: BBT_SAFETY() }}
          />
          <div className="sec">
            <h2 className="sec-title mb-2">{L('Brúska', 'Grinder')}</h2>
            <button type="button" className="btn-run w-full" onClick={() => apiRef.current.toggleRun?.()}>
              {ui.running ? L('■ Stop', '■ Stop') : L('▶ Štart', '▶ Start')}
            </button>
            <SegRow
              label={L('Kotúč', 'Wheel')}
              value={ui.wheel}
              options={[
                [0, L('hrubý', 'coarse')],
                [1, L('jemný', 'fine')],
              ]}
              onChange={(v) => set('wheel', v)}
            />
            <Slider
              id="bbg"
              label={L('Medzera opierky', 'Rest gap')}
              unit="mm"
              min={1}
              max={10}
              step={0.5}
              value={ui.gap}
              digits={1}
              onChange={(v) => set('gap', v)}
            />
            <SegRow
              label={L('Ochranný štít', 'Eye shield')}
              value={ui.shield ? 1 : 0}
              options={[
                [0, L('hore', 'up')],
                [1, L('sklopený', 'lowered')],
              ]}
              onChange={(v) => set('shield', !!v)}
            />
          </div>
          <div className="sec">
            <div className="section-heading">
              <h2 className="sec-title mb-2">{L('Nôž v rukách', 'Tool in hand')}</h2>
              <SectionInfo title={L('Prepálenie', 'Burning')}>
                <p className="text-xs muted">
                  {L(
                    'Rýchlorezná oceľ nad ≈ 250 °C popúšťa – ostrie zmäkne a zmodrie. Brús po krátkych dotykoch a chlaď vo vode.',
                    'High-speed steel tempers above ≈ 250 °C – the edge softens and turns blue. Grind with short touches and quench in water.',
                  )}
                </p>
              </SectionInfo>
            </div>
            <Slider
              id="bbt"
              label={L('Uhol držania (chrbát)', 'Holding angle (flank)')}
              unit="°"
              min={0}
              max={20}
              step={0.5}
              value={ui.tilt}
              digits={1}
              onChange={(v) => set('tilt', v)}
            />
            <Slider
              id="bbz"
              label={L('Posun noža ku kotúču', 'Tool towards the wheel')}
              unit="mm"
              min={-5}
              max={40}
              step={0.05}
              value={ui.tz}
              digits={2}
              onChange={(v) => set('tz', v)}
            />
            <div className="flex gap-2 mt-2">
              <button type="button" className="btn flex-1" onClick={() => apiRef.current.quench?.()}>
                {L('Ochladiť vo vode', 'Quench in water')}
              </button>
              <button type="button" className="btn flex-1" onClick={() => apiRef.current.newBlank?.()}>
                {L('Nový nôž', 'New tool')}
              </button>
            </div>
          </div>
          <ExportSection machine="dvojkotuc" apiRef={apiRef} canSave={false} />
          <ViewSection
            apiRef={apiRef}
            views={[
              ['celok', L('Celok', 'Overview')],
              ['rez', L('Detail brúsenia', 'Grinding detail')],
              ['zboku', L('Zboku', 'Side')],
            ]}
          />
          <PartsSection parts={parts} selected={selected} selectPart={selectPart} />
          <HelpFooter apiRef={apiRef} ui={ui} />
        </fieldset>
      </aside>
    </div>
  );
}

function buildBbt(x) {
  const { kit, det, M, grp, v3, c, st, ctrl, push, pend, say, sayOnce, needPower, anchors, views, apiRef } = x;
  const { add, box, cylX, cylY, handwheel } = kit;
  const { rbox, nameplate, cable } = det;
  // ---------- stojan a motor ----------
  const ped = grp('stojan');
  rbox(ped, -1.6, 1.6, 0, 0.3, -1.6, 1.6, M.greenDeep, 0.1);
  cylY(ped, 0.7, 1.1, 0.3, 8.2, 0, 0, M.green, 32);
  rbox(ped, -1.1, 1.1, 8.0, 8.6, -1.0, 1.0, M.green, 0.15);
  nameplate(ped, 0, 6.0, 0.95, 0, 'TOS', 'BBT 350', 0.9);
  // nádobka s vodou na stojane
  const pot = new THREE.Group();
  pot.position.set(1.15, 7.0, 0.9);
  ped.add(pot);
  cylY(pot, 0.36, 0.4, 0, 0.6, 0, 0, M.steelDark, 24);
  cylY(pot, 0.33, 0.33, 0.45, 0.5, 0, 0, M.water, 24);
  kit.hitProxy(pot, 0.45, 0, 0.35, 0);
  const kc = grp('kotuce');
  cylX(kc, 1.0, 1.0, -1.6, 1.6, WY, 0, M.green, 36); // motor
  for (let k = 0; k < 8; k++) cylX(kc, 1.04, 1.04, -1.3 + k * 0.34, -1.22 + k * 0.34, WY, 0, M.greenDark, 36);
  cylX(kc, 0.14, 0.14, -3.2, 3.2, WY, 0, M.steel, 16);
  const spins = WXS.map((wx, i) => {
    const g = new THREE.Group();
    g.position.set(wx, WY, 0);
    kc.add(g);
    cylX(g, RW, RW, -BW / 2, BW / 2, 0, 0, i ? M.fine : M.coarse, 64);
    cylX(g, 0.5, 0.5, -BW / 2 - 0.04, BW / 2 + 0.04, 0, 0, M.steel, 24); // príruby
    box(g, -BW / 2 - 0.06, -BW / 2 - 0.05, 0.6, 0.9, -0.05, 0.05, M.black);
    // kryt: plechový kryt s výrezom vpredu (od −35° do +60° okolo osi X)
    const hood = new THREE.Mesh(
      new THREE.CylinderGeometry(RW + 0.18, RW + 0.18, BW + 0.3, 48, 1, true, Math.PI * 0.6, Math.PI * 1.45),
      M.green,
    );
    hood.material = hood.material.clone();
    hood.material.side = THREE.DoubleSide;
    hood.geometry.rotateZ(Math.PI / 2);
    hood.position.set(wx, WY, 0);
    kc.add(hood);
    [-1, 1].forEach((s) => {
      const side = new THREE.Mesh(
        new THREE.CircleGeometry(RW + 0.18, 48, Math.PI * 0.6 - Math.PI / 2, Math.PI * 1.45),
        M.green,
      );
      side.rotation.y = Math.PI / 2;
      side.position.set(wx + s * (BW / 2 + 0.15), WY, 0);
      kc.add(side);
    });
    return g;
  });
  // ---------- opierky a štíty ----------
  const rs = grp('opierky');
  const rests = WXS.map((wx) => {
    const g = new THREE.Group();
    rs.add(g);
    rbox(g, wx - 0.5, wx + 0.5, WY - 0.32, WY - 0.2, RW, RW + 0.9, M.steelDark, 0.03);
    box(g, wx - 0.08, wx + 0.08, WY - 1.1, WY - 0.32, RW + 0.7, RW + 0.85, M.steelDark);
    return g;
  });
  const knob = handwheel(rs, 0.16, WXS[1] + 0.7, WY - 0.75, RW + 0.7, 'x', 0.08); // matica opierky
  const shields = WXS.map((wx) => {
    const g = new THREE.Group();
    g.position.set(wx, WY + RW + 0.15, 0.2);
    rs.add(g);
    const pane = add(g, new THREE.PlaneGeometry(1.0, 0.9), M.glass, 0, -0.45, 0);
    pane.userData.noMerge = true;
    box(g, -0.52, 0.52, -0.02, 0.04, -0.02, 0.02, M.steelDark);
    kit.hitProxy(g, 0.45, 0, -0.45, 0);
    return g;
  });
  // ---------- nôž ----------
  const tool = grp('noz');
  const piv = new THREE.Group();
  tool.add(piv);
  const yaw = new THREE.Group();
  yaw.rotation.y = Math.PI / 2; // lokálne u (k špičke) → svet −Z (ku kotúču)
  piv.add(yaw);
  const inner = new THREE.Group();
  yaw.add(inner);
  let poly = toolPoly(),
    tMesh = null;
  const buildTool = () => {
    if (tMesh) {
      inner.remove(tMesh);
      tMesh.geometry.dispose();
    }
    const s = new THREE.Shape();
    poly.forEach(([u, v], i) => (i ? s.lineTo(u / 100, v / 100) : s.moveTo(u / 100, v / 100)));
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: TOOL.H / 100, bevelEnabled: false });
    g.translate(0, 0, -TOOL.H / 200);
    tMesh = new THREE.Mesh(g, st.burn ? M.burnt : st.heat > 0.6 ? M.hot : M.tool);
    tMesh.castShadow = true;
    tMesh.userData.part = 'noz';
    tMesh.userData.controlPassThrough = true; // ťahá sa za úchop (sieť sa pri brúsení stavia znova)
    inner.add(tMesh);
  };
  inner.position.set(-TOOL.L / 100, 0, 0); // čap v spodnom rohu špičky (u = L, v = 0) – nôž leží na opierke
  kit.hitProxy(piv, 0.32, 0, 0.08, 0.55); // úchop noža
  // ---------- vypínač ----------
  const pan = grp('ovladanie', ped);
  rbox(pan, -0.55, 0.55, 4.6, 5.6, 0.95, 1.05, M.panel, 0.03);
  const mSw = mainSwitch(kit, M, pan, 0, 5.3, 1.06);
  const bStart = panelButton(kit, M, pan, -0.3, 4.85, 1.06, M.btnGreen, 0.1),
    bStop = panelButton(kit, M, pan, 0.3, 4.85, 1.06, M.red, 0.1);
  cable(ped, [
    [0, 5.6, 1.0],
    [0.3, 7.6, 0.6],
    [0.2, WY - 0.9, 0.3],
  ]);
  const sparks = [],
    sparkG = new THREE.Group();
  x.scene.add(sparkG);
  // ---------- stav ----------
  Object.assign(st, {
    rpm: 0,
    a: 0,
    tz: c.tz,
    tilt: c.tilt,
    gap: c.gap,
    sh: 0,
    heat: 0,
    burn: false,
    grindT: -9,
    gapBad: false,
    shieldBad: false,
  });
  const place = () => {
    const wx = WXS[c.wheel];
    // nôž leží na opierke: spodok v rovine opierky, špička vo vzdialenosti tz od obvodu kotúča
    tool.position.set(wx, WY - 0.2, 0);
    piv.position.set(0, 0, RW + st.tz / 100);
    piv.rotation.x = (st.tilt * Math.PI) / 180;
    rests.forEach((g, i) => (g.position.z = (i === c.wheel ? st.gap : c.gap) / 100 - 0.03));
    shields.forEach((g) => (g.rotation.x = -(1 - st.sh) * 1.2));
  };
  buildTool();
  place();
  Object.assign(anchors, {
    stojan: () => v3(0, 3.0, 1.1),
    kotuce: () => v3(WXS[0], WY + RW + 0.3, 0),
    opierky: () => v3(WXS[1], WY - 0.2, RW + 0.9),
    noz: () => v3(WXS[c.wheel], WY + 0.2, RW + st.tz / 100 + 0.6),
    ovladanie: () => v3(0, 5.6, 1.05),
  });
  Object.assign(views, {
    celok: () => [
      [5, 13, 12],
      [0, 9.5, 0.5],
    ],
    rez: () => [[WXS[c.wheel] + 2.2, WY + 0.8, RW + 2.0], [WXS[c.wheel], WY - 0.1, RW + 0.2], true],
    zboku: () => [[WXS[c.wheel] + 4, WY, RW + 0.3], [WXS[c.wheel], WY - 0.1, RW + 0.3], true],
  });
  const stopped = () => !c.running && st.rpm < 1;
  const start = needPower(() => {
    if (!apiRef.current.safetyGate || apiRef.current.safetyGate.ok()) push('running', true);
    else apiRef.current.safetyGate.request();
  });
  apiRef.current.toggleRun = () => (c.running ? push('running', false) : start());
  apiRef.current.quench = () => {
    st.heat = 0;
    say(L('Nôž ochladený vo vode.', 'The tool is quenched in water.'), 'info');
    buildTool();
  };
  apiRef.current.newBlank = () => {
    if (st.tz < 5) return (say(L('Najprv odtiahni nôž od kotúča.', 'Pull the tool away from the wheel first.')), false);
    poly = toolPoly();
    Object.assign(st, { burn: false, heat: 0, gapBad: false, shieldBad: false });
    buildTool();
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
        'Spustí motor brúsky (pri rozbehu stoj mimo roviny kotúča).',
        'Starts the grinder motor (stand out of the wheel plane at start-up).',
      ),
      action: start,
    },
    bStart,
  );
  ctrl.reg(
    {
      type: 'button',
      label: LL('STOP', 'STOP'),
      hint: LL('Zastaví motor.', 'Stops the motor.'),
      action: () => push('running', false),
    },
    bStop,
  );
  shields.forEach((g, i) =>
    ctrl.reg(
      {
        type: 'button',
        still: true,
        label: i ? LL('Štít jemného kotúča', 'Fine-wheel shield') : LL('Štít hrubého kotúča', 'Coarse-wheel shield'),
        hint: LL('Sklopí alebo zdvihne priehľadný ochranný štít.', 'Lowers or raises the clear eye shield.'),
        action: () => push('shield', !c.shield),
      },
      g,
    ),
  );
  ctrl.reg(
    {
      type: 'button',
      still: true,
      label: LL('Nádobka s vodou', 'Water pot'),
      hint: LL('Ochladí nôž vo vode.', 'Quenches the tool in water.'),
      action: () => apiRef.current.quench(),
    },
    pot,
  );
  ctrl.reg(
    {
      type: 'wheel',
      minR: 0.08,
      inc: 1,
      label: LL('Matica opierky', 'Rest nut'),
      hint: LL(
        'Prestaví medzeru opierky – len pri stojacom kotúči. 1 otáčka = 1 mm.',
        'Sets the rest gap – only with the wheel stopped. 1 turn = 1 mm.',
      ),
      guard: () =>
        stopped() ||
        (say(L('Opierka sa prestavuje len pri stojacom kotúči.', 'The rest is adjusted only with the wheel stopped.')),
        false),
      turn: (d) => push('gap', clamp(Math.round((c.gap + d / TAU) * 10) / 10, 1, 10)),
      read: () => `${st.gap.toFixed(1)} mm`,
    },
    knob,
  );
  let tz0 = 0;
  ctrl.reg(
    {
      type: 'slide',
      axis: 'z',
      label: LL('Nôž', 'Tool'),
      hint: LL('Ťahaj nôž po opierke ku kotúču a späť.', 'Drag the tool along the rest to the wheel and back.'),
      read: () => `${st.tz.toFixed(2)} mm`,
      start: () => (tz0 = c.tz),
      slide: (dz) => push('tz', clamp(Math.round((tz0 + dz * 100) * 100) / 100, -5, 40)),
      nudge: (d) => push('tz', clamp(c.tz - d * 0.1, -5, 40)),
    },
    tool,
  );
  const e = new THREE.Matrix4();
  let lastBuild = -9,
    dirty = false;
  const update = (dt, t) => {
    if (!c.power && c.running) push('running', false);
    st.rpm = approach(st.rpm, c.running && c.power ? 1450 : 0, 900 * dt);
    const running = st.rpm > 50;
    st.a += (st.rpm / 60) * TAU * dt * 0.05;
    spins.forEach((g) => (g.rotation.x = st.a));
    st.sh = approach(st.sh, c.shield ? 1 : 0, 3 * dt);
    if (stopped()) st.gap = c.gap;
    else if (c.gap !== st.gap) {
      c.gap = st.gap;
      pend.gap = st.gap;
    }
    const old = st.tz;
    st.tz = approach(st.tz, c.tz, 6 * dt);
    st.tilt = approach(st.tilt, c.tilt, 20 * dt);
    place();
    st.heat = Math.max(0, st.heat - 0.02 * dt);
    inner.updateWorldMatrix(true, false);
    e.copy(inner.matrixWorld);
    const m = e.elements;
    // ponechaná časť noža: svet z ≥ obvod kotúča (dotyčnicová rovina vpredu)
    const pen = Math.max(...poly.map(([u, v]) => -(m[2] * u + m[6] * v) / 100)) - (m[14] - RW);
    if (pen > 1e-5) {
      if (!running) {
        st.tz = old;
        c.tz = old;
        pend.tz = old;
        place();
        sayOnce('stop', true, L('Nôž sa dotkol stojaceho kotúča.', 'The tool touched the stopped wheel.'), 'warn');
      } else {
        const r = clipPoly(poly, -m[2], -m[6], (m[14] - RW) * 100);
        if (r.removed > 1e-4) {
          poly = r.poly;
          dirty = true;
          st.grindT = t;
          st.heat += r.removed * (c.wheel ? 0.05 : 0.03);
          if (st.heat > 1 && !st.burn) {
            st.burn = true;
            say(
              L(
                'Nôž sa prepálil – zmodral a zmäkol. Chlaď ho častejšie vo vode!',
                'The tool burnt – it turned blue and softened. Quench it more often!',
              ),
              'danger',
            );
          }
          if (c.gap > 3) {
            st.gapBad = true;
            sayOnce(
              'gap',
              true,
              L(
                'Medzera opierky je väčšia ako 3 mm – nôž sa môže vtiahnuť medzi opierku a kotúč!',
                'The rest gap is over 3 mm – the tool can be pulled in between the rest and the wheel!',
              ),
              'danger',
            );
          }
          if (!c.shield) {
            st.shieldBad = true;
            sayOnce(
              'shield',
              true,
              L(
                'Brúsiš so zdvihnutým štítom – sklop ochranný štít!',
                'Grinding with the shield up – lower the eye shield!',
              ),
              'danger',
            );
          }
          if (sparks.length < 150)
            for (let k = 0; k < 3; k++) {
              const sp = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.08), M.spark);
              sp.position.set(WXS[c.wheel] + (Math.random() - 0.5) * 0.2, WY - 0.25, RW + 0.02);
              sparkG.add(sp);
              sparks.push({
                m: sp,
                v: v3((Math.random() - 0.5) * 2, -3 - Math.random() * 3, 1 + Math.random() * 2),
                life: 0.5,
              });
            }
        }
      }
    }
    if ((dirty || st.heat > 0.6 !== st.hotShown) && t - lastBuild > 0.12) {
      st.hotShown = st.heat > 0.6;
      buildTool();
      dirty = false;
      lastBuild = t;
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const sp = sparks[i];
      sp.life -= dt;
      sp.v.y -= 9 * dt;
      sp.m.position.addScaledVector(sp.v, dt);
      if (sp.life <= 0) {
        sparkG.remove(sp.m);
        sp.m.geometry.dispose();
        sparks.splice(i, 1);
      }
    }
    knob.rotation.z = st.gap * TAU;
  };
  return {
    update,
    tele: () => ({
      rpm: st.rpm,
      heat: Math.min(1.2, st.heat),
      alpha: toolAngles(poly).alpha,
      grinding: x.time() - st.grindT < 0.3,
      burn: st.burn,
      gap: st.gap,
    }),
    measure: () => ({ ang: toolAngles(poly), burn: st.burn, gapBad: st.gapBad, shieldBad: st.shieldBad }),
    workObj: () => tool,
    workSpot: () => v3(0, 11, 6),
    canInspect: () => (!stopped() ? L('Najprv zastav brúsku.', 'Stop the grinder first.') : null),
    prepareInspect: () => buildTool(),
    sound: () => ({ motor: st.rpm / 1450, grind: x.time() - st.grindT < 0.3 ? 0.9 : 0 }),
  };
}

export { BbtSimulator };
export default BbtSimulator;
