import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { L, LL, RPM } from '../core/i18n';
import { angleScaleTex } from '../core/detail';
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
  Toggle,
  ViewSection,
  mkParts,
  useMachine,
  useTele,
} from '../ui/common';
import { createClassicScene, mainSwitch, panelButton } from './classic/scaffold';
import { TOOL, area, clipPoly, grindChecksTool, toolAngles, toolPoly } from './toolGrindMath';

// =====================================================================
// NÁSTROJÁRSKA BRÚSKA TOS HOSTIVAŘ BN 102 – hrnčekový kotúč, univerzálny držiak noža s naklápaním, stôl X / Y
// =====================================================================
const XW = 1.2, // čelo hrnčekového kotúča (svet x)
  WY = 6.6, // os kotúča
  WZ = 0, // os kotúča (z)
  RR = 0.62; // vonkajší polomer okraja hrnčeka

const bnParts = () =>
  mkParts([
    [
      'podstavec',
      'Podstavec',
      'Base',
      'Podstavec s vedením stola',
      'Base with table ways',
      'Skriňový podstavec nesie pozdĺžny stôl a priečne sane. Predloha: TOS Hostivař BN 102 – stôl 920 × 140 mm, X 510 / Y 250 mm, ≈ 1 000 kg.',
      'The box base carries the table and the cross slide. Model: TOS Hostivař BN 102 – table 920 × 140 mm, X 510 / Y 250 mm, ≈ 1,000 kg.',
    ],
    [
      'vretennik',
      'Brúsny vreteník',
      'Wheelhead',
      'Vreteník s hrnčekovým kotúčom',
      'Wheelhead with cup wheel',
      'Na stĺpe je vreteník s motorom 1,2 kW a otáčkami 2 800 – 5 600 ot/min. Čelo hrnčekového kotúča brúsi rovinnú plochu noža.',
      'The column carries the wheelhead with a 1.2 kW motor, 2,800 – 5,600 rpm. The face of the cup wheel grinds a flat face on the tool.',
    ],
    [
      'drziak',
      'Držiak noža',
      'Tool holder',
      'Univerzálny držiak s naklápaním',
      'Universal tilting holder',
      'Nôž je upnutý v zveráčiku, ktorý sa nakláňa podľa stupnice – uhol naklopenia je uhol brúsenej plochy. Páka prepína polohu noža: koncom alebo vrchom ku kotúču.',
      'The tool is clamped in a small vise that tilts by its scale – the tilt is the angle of the ground face. The lever turns the tool end-on or top-on to the wheel.',
    ],
    [
      'noz',
      'Nôž',
      'Tool bit',
      'Sústružnícky nôž 16 × 16 HSS',
      'Turning tool 16 × 16 HSS',
      'Rýchlorezná oceľ – pri veľkom prísuve sa prepáli (popúšťacie farby) a zmäkne.',
      'High-speed steel – too large an infeed burns it (temper colours) and softens it.',
    ],
    [
      'ovladanie',
      'Ovládanie',
      'Controls',
      'Ovládací panel',
      'Control panel',
      'Hlavný vypínač, štart a stop kotúča.',
      'Main switch, wheel start and stop.',
    ],
  ]);

const BN_TASKS = [
  {
    id: 'chrbat',
    title: () => L('Uhol chrbta α = 8°', 'Clearance angle α = 8°'),
    desc: () =>
      L(
        'Nôž upni koncom ku kotúču, nakloň držiak na 8° a prebrús celú čelnú (chrbtovú) plochu noža. Prísuv po malých krokoch (≤ 0,05 mm) a nôž prechádzaj po čele kotúča – inak sa prepáli.',
        'Clamp the tool end-on to the wheel, tilt the holder to 8° and grind the whole end (clearance) face. Feed in small steps (≤ 0.05 mm) and traverse the tool across the wheel face – otherwise it burns.',
      ),
    setup: { mode: 'end', tilt: 0 },
    drawing: () => <ToolAngleDrawing alpha={8} gamma={0} />,
    labels: {
      alpha: () => L('Uhol chrbta 8 ±0,5°', 'Clearance angle 8 ±0.5°'),
      face: () => L('Prebrúsená celá výška čela', 'Whole face height ground'),
      burn: () => L('Bez prepálenia', 'No burning'),
    },
  },
  {
    id: 'celo',
    title: () => L('Uhol čela γ = 12°', 'Rake angle γ = 12°'),
    desc: () =>
      L(
        'Nôž upni vrchom ku kotúču, nakloň držiak na 12° a vybrús čelo (hornú plochu) noža aspoň v dĺžke 5 mm.',
        'Clamp the tool top-on to the wheel, tilt the holder to 12° and grind the rake (top) face over at least 5 mm.',
      ),
    setup: { mode: 'top', tilt: 0 },
    drawing: () => <ToolAngleDrawing alpha={8} gamma={12} />,
    labels: {
      gamma: () => L('Uhol čela 12 ±0,5°', 'Rake angle 12 ±0.5°'),
      face: () => L('Dĺžka čela ≥ 5 mm', 'Rake face ≥ 5 mm long'),
      burn: () => L('Bez prepálenia', 'No burning'),
    },
  },
].map((t) => ({ ...t, checks: (m) => grindChecksTool[t.id](m).map((c) => ({ ...c, label: t.labels[c.key]() })) }));

const BN_SAFETY = () => [
  L(
    'Kotúč je bez trhlín (zvukovo skúšaný), kryt je nasadený.',
    'The wheel is crack-free (ring-tested) and its guard is on.',
  ),
  L('Mám ochranné okuliare, nôž je pevne v držiaku.', 'I wear safety glasses, the tool is tight in the holder.'),
  L(
    'Prisúvam po malých krokoch a pohybujem nožom po čele kotúča.',
    'I feed in small steps and traverse the tool across the wheel face.',
  ),
];

function BnSimulator({ onBack, params }) {
  const mountRef = useRef(null),
    layerRef = useRef(null),
    tipRef = useRef(null);
  const init = { power: true, running: false, mode: 'end', tilt: 0, x: -5, z: 55, light: true, manual: false };
  const { ctl, ui, setUi, set, selected, selectPart, apiRef } = useMachine(init);
  const [tele, setTele] = useTele({
    rpm: 0,
    x: -5,
    z: 55,
    tilt: 0,
    alpha: null,
    gamma: null,
    grinding: false,
    burn: false,
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
      colors: [0x8fa9b5, 0x768f9b, 0x5a717c],
      mats: {
        wheelM: [0x9aa4c4, 0.95, 0.0],
        tool: [0xc7ccd1, 0.3, 0.85],
        burnt: [0x5a4a8e, 0.35, 0.7],
        spark: new THREE.MeshBasicMaterial({ color: 0xffb347, toneMapped: false }),
      },
      name: L('Nástrojárska brúska TOS BN 102', 'TOS BN 102 tool and cutter grinder'),
      sound: 'grinder',
      debugKey: '__bn',
      build: (x) => buildBn(x),
    });
  }, []);
  const parts = bnParts();
  const statusMsg = tele.msg
    ? tele.msg
    : !ui.power
      ? { kind: 'warn', text: L('Hlavný vypínač je vypnutý.', 'The main switch is off.') }
      : tele.grinding
        ? {
            kind: tele.burn ? 'danger' : 'run',
            text: L(
              'Brúsenie – prísuv po malých krokoch, prechádzaj po čele kotúča.',
              'Grinding – feed in small steps, traverse across the wheel face.',
            ),
          }
        : tele.rpm > 5
          ? {
              kind: 'run',
              text: L(
                'Kotúč beží. Prisuň nôž kolesom prísuvu.',
                'The wheel runs. Feed the tool with the infeed handwheel.',
              ),
            }
          : {
              kind: 'idle',
              text: L(
                'Nakloň držiak, upni nôž a spusti kotúč.',
                'Tilt the holder, clamp the tool and start the wheel.',
              ),
            };
  const chips = [
    {
      color: tele.rpm > 5 ? '#3ee06c' : '#8b8f89',
      text: tele.rpm > 5 ? `${Math.round(tele.rpm)} ${RPM()}` : L('Kotúč stojí', 'Wheel stopped'),
    },
  ];
  chips.push({
    color: '#7fb6ff',
    text: `${ui.mode === 'end' ? L('koniec', 'end') : L('vrch', 'top')} ${tele.tilt.toFixed(1)}°`,
  });
  if (tele.burn) chips.push({ color: '#c06cff', text: L('Prepálené', 'Burnt') });
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
        workLabels={[L('Pozrieť nôž', 'Inspect the tool'), L('Upnúť späť', 'Clamp back')]}
        tips={[
          L(
            'Uhol naklopenia držiaka je uhol brúsenej plochy – nastav ho podľa stupnice.',
            'The holder tilt is the angle of the ground face – set it by the scale.',
          ),
        ]}
      />
      <aside className="panel">
        <fieldset className="machine-settings" disabled={ui.unclamped}>
          <PanelHeader
            ui={ui}
            set={set}
            kicker={L('Simulátor · brúska', 'Simulator · grinder')}
            title={L('Nástrojárska brúska', 'Tool and cutter grinder')}
            sub={L(
              'Predloha: TOS Hostivař BN 102 – kotúč do Ø280, 2 800 – 5 600 ot/min, 1,2 kW, stôl 920 × 140 mm. Mierka 1 : 100 mm.',
              'Modelled after the TOS Hostivař BN 102 – wheel up to Ø280, 2,800 – 5,600 rpm, 1.2 kW, table 920 × 140 mm. Scale 1 : 100 mm.',
            )}
            rows={[
              ['α', tele.alpha === null ? '—' : `${tele.alpha.toFixed(1)}°`],
              ['γ', tele.gamma === null ? '—' : `${tele.gamma.toFixed(1)}°`],
              ['X', tele.x.toFixed(2)],
            ]}
            foot={[
              `${L('naklopenie', 'tilt')} ${tele.tilt.toFixed(1)}°`,
              ui.mode === 'end' ? L('koncom ku kotúču', 'end-on') : L('vrchom ku kotúču', 'top-on'),
            ]}
            status={statusMsg}
          />
          <TaskSection
            machine="bn"
            tasks={BN_TASKS}
            apiRef={apiRef}
            params={params}
            status={statusMsg}
            onSetup={(t) => {
              Object.entries(t.setup).forEach(([k, v]) => set(k, v));
              setTimeout(() => apiRef.current.newBlank?.(), 200);
            }}
            safety={{ ui, set, runKey: 'running', items: BN_SAFETY() }}
          />
          <div className="sec">
            <h2 className="sec-title mb-2">{L('Kotúč', 'Wheel')}</h2>
            <button type="button" className="btn-run w-full" onClick={() => apiRef.current.toggleRun?.()}>
              {ui.running ? L('■ Stop kotúča', '■ Stop wheel') : L('▶ Štart kotúča', '▶ Start wheel')}
            </button>
            <div className="mt-2">
              <Toggle
                on={ui.power}
                label={L('Hlavný vypínač', 'Main switch')}
                onClick={() => set('power', !ui.power)}
              />
            </div>
          </div>
          <div className="sec">
            <div className="section-heading">
              <h2 className="sec-title mb-2">{L('Držiak a prísuv', 'Holder and infeed')}</h2>
              <SectionInfo title={L('Uhly noža', 'Tool angles')}>
                <p className="text-xs muted">
                  {L(
                    'Uhol chrbta α (6 – 10°) zabraňuje treniu chrbta o obrobok, uhol čela γ (10 – 20° pre oceľ) uľahčuje odchod triesky.',
                    'The clearance α (6 – 10°) keeps the flank off the work, the rake γ (10 – 20° for steel) eases chip flow.',
                  )}
                </p>
              </SectionInfo>
            </div>
            <SegRow
              label={L('Poloha noža', 'Tool position')}
              value={ui.mode}
              options={[
                ['end', L('koncom', 'end-on')],
                ['top', L('vrchom', 'top-on')],
              ]}
              onChange={(v) => !ui.running && set('mode', v)}
            />
            <Slider
              id="bnt"
              label={L('Naklopenie držiaka', 'Holder tilt')}
              unit="°"
              min={0}
              max={30}
              step={0.5}
              value={ui.tilt}
              actual={tele.tilt}
              digits={1}
              onChange={(v) => set('tilt', v)}
            />
            <Slider
              id="bnx"
              label={L('Prísuv X', 'Infeed X')}
              unit="mm"
              min={-10}
              max={4}
              step={0.01}
              value={ui.x}
              actual={tele.x}
              digits={2}
              onChange={(v) => set('x', v)}
            />
            <Slider
              id="bnz"
              label={L('Stôl Z (po čele kotúča)', 'Table Z (across the wheel)')}
              unit="mm"
              min={-90}
              max={90}
              step={1}
              value={ui.z}
              actual={tele.z}
              digits={0}
              onChange={(v) => set('z', v)}
            />
            <button type="button" className="btn w-full mt-2" onClick={() => apiRef.current.newBlank?.()}>
              {L('Upnúť nový nôž', 'Clamp a new tool')}
            </button>
          </div>
          <ExportSection machine="bn" apiRef={apiRef} canSave={false} />
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

function buildBn(x) {
  const { kit, det, M, grp, v3, c, st, ctrl, push, pend, say, sayOnce, needPower, anchors, views, apiRef } = x;
  const { add, cylX, cylY, ball, handwheel, pivotLever } = kit;
  const { rbox, nameplate, oilGlass, cable } = det;
  // ---------- podstavec, stôl ----------
  const base = grp('podstavec');
  rbox(base, -4.0, 4.0, 0, 4.6, -1.8, 1.8, M.green, 0.2);
  rbox(base, -4.1, 4.1, 0, 0.25, -1.9, 1.9, M.greenDeep, 0.06);
  nameplate(base, -2.4, 3.2, 1.805, 0, 'TOS Hostivař', 'BN 102', 1.05);
  oilGlass(base, 2.6, 1.0, 1.8);
  const tbl = new THREE.Group();
  base.add(tbl);
  rbox(tbl, -3.0, 0.6, 4.6, 5.0, -2.2, 2.2, M.greenDark, 0.06); // priečne sane a stôl
  const wX = handwheel(tbl, 0.4, -3.35, 4.8, 0, '-x', 0.26); // prísuv (1 otáčka = 1 mm)
  const wZ = handwheel(base, 0.42, 0, 3.6, 1.95, 'z', 0.28); // pozdĺžny stôl
  // ---------- stĺp a vreteník s hrnčekovým kotúčom ----------
  const wh = grp('vretennik');
  rbox(wh, 1.6, 3.2, 4.6, 8.4, -1.0, 1.0, M.green, 0.15);
  cylX(wh, 0.62, 0.62, 2.1, 3.4, WY, WZ, M.green, 28); // motor a vreteno
  for (let k = 0; k < 6; k++) cylX(wh, 0.66, 0.66, 2.2 + k * 0.2, 2.26 + k * 0.2, WY, WZ, M.greenDark, 28);
  const spin = new THREE.Group();
  spin.position.set(XW, WY, WZ);
  wh.add(spin);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(RR, RR * 0.8, 0.5, 48, 1, true), M.wheelM);
  cup.material = cup.material.clone();
  cup.material.side = THREE.DoubleSide;
  cup.geometry.rotateZ(Math.PI / 2);
  cup.position.x = 0.25;
  spin.add(cup);
  cylX(spin, RR * 0.8, RR * 0.8, 0.48, 0.52, 0, 0, M.wheelM, 48);
  add(spin, new THREE.TorusGeometry(RR - 0.05, 0.05, 8, 48), M.wheelM).rotation.y = Math.PI / 2;
  cylX(spin, 0.18, 0.18, 0.5, 1.0, 0, 0, M.steel, 20);
  // kryt kotúča (otvorený k nožu)
  const guard = new THREE.Mesh(
    new THREE.CylinderGeometry(RR + 0.12, RR + 0.12, 0.7, 40, 1, true, Math.PI * 0.15, Math.PI * 1.2),
    M.yellow,
  );
  guard.material = guard.material.clone();
  guard.material.side = THREE.DoubleSide;
  guard.geometry.rotateZ(Math.PI / 2);
  guard.position.set(XW + 0.3, WY, WZ);
  wh.add(guard);
  // ---------- univerzálny držiak a nôž ----------
  const hold = grp('drziak', tbl);
  rbox(hold, -1.6, -0.4, 5.0, 5.4, -0.7, 0.7, M.steelDark, 0.06);
  rbox(hold, -1.15, -0.65, 5.4, WY - 0.3, -0.25, 0.25, M.steelDark, 0.05); // stĺpik držiaka
  cylY(hold, 0.5, 0.5, 5.4, 5.55, -1.0, 0, M.steelDark, 32);
  const piv = new THREE.Group(); // čap naklápania v rohu noža (špička)
  hold.add(piv);
  const scTx = angleScaleTex(30, 2, { numR: 0.8, step: 10, len: 0.1 });
  if (scTx) {
    const sc = add(
      hold,
      new THREE.CircleGeometry(0.5, 48),
      new THREE.MeshStandardMaterial({ map: scTx, roughness: 0.4, metalness: 0.4 }),
      -1.0,
      5.56,
      0,
    );
    sc.rotation.x = -Math.PI / 2;
    sc.userData.noMerge = true;
    sc.castShadow = false;
  }
  const toolInner = new THREE.Group();
  piv.add(toolInner);
  const toolG = grp('noz', toolInner);
  let poly = toolPoly(),
    tMesh = null;
  const buildTool = () => {
    if (tMesh) {
      toolG.remove(tMesh);
      tMesh.geometry.dispose();
    }
    const s = new THREE.Shape();
    poly.forEach(([u, v], i) => (i ? s.lineTo(u / 100, v / 100) : s.moveTo(u / 100, v / 100)));
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: TOOL.H / 100, bevelEnabled: false });
    g.translate(0, 0, -TOOL.H / 200);
    tMesh = new THREE.Mesh(g, st.burn ? M.burnt : M.tool);
    tMesh.castShadow = true;
    tMesh.userData.part = 'noz';
    toolG.add(tMesh);
  };
  // zveráčik okolo zadnej časti noža
  rbox(toolInner, 0.05, 0.45, -0.06, 0.22, -0.15, 0.15, M.steel, 0.02);
  const levMode = pivotLever(hold, -1.45, 5.2, 0.72, 0.34, 1.2);
  const wTilt = handwheel(hold, 0.2, -1.62, 5.2, 0.3, '-x', 0.1);
  // ---------- panel ----------
  const pan = grp('ovladanie', base);
  rbox(pan, 3.2, 3.9, 2.0, 4.0, 1.8, 1.9, M.panel, 0.03);
  const mSw = mainSwitch(kit, M, pan, 3.55, 3.5, 1.91);
  const bStart = panelButton(kit, M, pan, 3.4, 2.6, 1.91, M.btnGreen),
    bStop = panelButton(kit, M, pan, 3.75, 2.6, 1.91, M.red);
  const lampRun = M.lamp.clone();
  ball(pan, 0.06, 3.55, 2.2, 1.92, lampRun);
  cable(base, [
    [3.4, 2.0, 1.85],
    [3.6, 1.0, 1.95],
    [3.8, 0.2, 2.1],
  ]);
  const sparks = [];
  const sparkG = new THREE.Group();
  x.scene.add(sparkG);
  // ---------- stav ----------
  Object.assign(st, { x: c.x, z: c.z, tilt: c.tilt, rpm: 0, a: 0, grindT: -9, burn: false });
  // poloha špičky noža (čap) vo svete: 5 mm pred čelom kotúča pri x = 0
  const place = () => {
    tbl.position.set(st.x / 100, 0, st.z / 100);
    piv.position.set(XW - 0.05, WY, 0);
    const phi = (c.mode === 'end' ? st.tilt : -90 + st.tilt) * (Math.PI / 180);
    piv.rotation.z = phi;
    toolInner.position.set(-TOOL.L / 100, -TOOL.H / 100, 0);
  };
  buildTool();
  place();
  Object.assign(anchors, {
    podstavec: () => v3(-4.0, 2.0, 1.8),
    vretennik: () => v3(2.4, 8.4, 0),
    drziak: () => v3(st.x / 100 - 1.0, 5.6, st.z / 100),
    noz: () => v3(st.x / 100 + XW - 0.6, WY + 0.2, st.z / 100),
    ovladanie: () => v3(3.55, 4.0, 1.9),
  });
  Object.assign(views, {
    celok: () => [
      [-6, 10, 10],
      [0.5, 5.6, 0],
    ],
    rez: () => [[XW - 0.6, WY + 0.9, 2.2], [XW - 0.1, WY, 0], true],
    zboku: () => [[XW - 0.4, WY + 0.2, 4], [XW - 0.3, WY, 0], true],
  });
  const stopped = () => !c.running && st.rpm < 1;
  const start = needPower(() => {
    if (!apiRef.current.safetyGate || apiRef.current.safetyGate.ok()) push('running', true);
    else apiRef.current.safetyGate.request();
  });
  apiRef.current.toggleRun = () => (c.running ? push('running', false) : start());
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
      label: LL('ŠTART kotúča', 'Wheel START'),
      hint: LL('Roztočí brúsny kotúč.', 'Starts the grinding wheel.'),
      action: start,
    },
    bStart,
  );
  ctrl.reg(
    {
      type: 'button',
      label: LL('STOP kotúča', 'Wheel STOP'),
      hint: LL('Zastaví kotúč.', 'Stops the wheel.'),
      action: () => push('running', false),
    },
    bStop,
  );
  ctrl.reg(
    {
      type: 'lever',
      angles: [0.5, -0.5],
      minR: 0.2,
      label: LL('Poloha noža v držiaku', 'Tool position in the holder'),
      hint: LL(
        'Hore = koncom ku kotúču (chrbát), dole = vrchom ku kotúču (čelo). Len pri odsunutom noži.',
        'Up = end-on (clearance), down = top-on (rake). Only with the tool backed off.',
      ),
      getIdx: () => (c.mode === 'end' ? 0 : 1),
      onSet: (i) =>
        st.x < -2
          ? push('mode', i === 0 ? 'end' : 'top')
          : say(L('Najprv odsuň nôž od kotúča.', 'Back the tool off the wheel first.')),
      read: () => (c.mode === 'end' ? L('koncom', 'end-on') : L('vrchom', 'top-on')),
    },
    levMode,
  );
  ctrl.reg(
    {
      type: 'wheel',
      minR: 0.12,
      inc: 1,
      label: LL('Naklopenie držiaka', 'Holder tilt'),
      hint: LL('1 otáčka = 2°; stupnica je na držiaku.', '1 turn = 2°; the scale is on the holder.'),
      guard: () => st.x < -2 || (say(L('Najprv odsuň nôž od kotúča.', 'Back the tool off the wheel first.')), false),
      turn: (d) => push('tilt', clamp(Math.round((c.tilt + (d / TAU) * 2) * 10) / 10, 0, 30)),
      read: () => `${st.tilt.toFixed(1)}°`,
    },
    wTilt,
  );
  ctrl.reg(
    {
      type: 'wheel',
      minR: 0.25,
      inc: 1,
      label: LL('Koleso prísuvu (X)', 'Infeed handwheel (X)'),
      hint: LL(
        '1 otáčka = 1 mm, dielik 0,02 mm. Prisúvaj po malých krokoch.',
        '1 turn = 1 mm, one division 0.02 mm. Feed in small steps.',
      ),
      turn: (d) => push('x', clamp(Math.round((c.x + d / TAU) * 100) / 100, -10, 4)),
      read: () => `X ${st.x.toFixed(2)} mm`,
    },
    wX,
  );
  ctrl.reg(
    {
      type: 'wheel',
      minR: 0.25,
      inc: 1,
      label: LL('Koleso stola (Z)', 'Table handwheel (Z)'),
      hint: LL('Posúva nôž po čele kotúča. 1 otáčka = 20 mm.', 'Moves the tool across the wheel face. 1 turn = 20 mm.'),
      turn: (d) => push('z', clamp(Math.round(c.z + (d / TAU) * 20), -90, 90)),
      read: () => `Z ${st.z.toFixed(0)} mm`,
    },
    wZ,
  );
  apiRef.current.newBlank = () => {
    if (st.x > -2) return (say(L('Najprv odsuň nôž od kotúča.', 'Back the tool off the wheel first.')), false);
    poly = toolPoly();
    st.burn = false;
    buildTool();
    say(L('Upnutý nový nôž 16 × 16 mm.', 'A new 16 × 16 mm tool is clamped.'), 'info');
    return true;
  };
  const e = new THREE.Matrix4();
  let lastBuild = -9,
    dirty = false;
  const update = (dt, t) => {
    if (!c.power && c.running) push('running', false);
    st.rpm = approach(st.rpm, c.running && c.power ? 2800 : 0, 3000 * dt);
    const running = st.rpm > 50;
    st.a += (st.rpm / 60) * TAU * dt * 0.05;
    spin.rotation.x = st.a;
    const old = { x: st.x, z: st.z, tilt: st.tilt };
    st.x = approach(st.x, c.x, 0.5 * dt);
    st.z = approach(st.z, c.z, 60 * dt);
    st.tilt = approach(st.tilt, c.tilt, 10 * dt);
    place();
    // kontakt: rovina čela kotúča v súradniciach noža, len ak je nôž v dosahu okraja hrnčeka
    toolG.updateWorldMatrix(true, false);
    e.copy(toolG.matrixWorld);
    const m = e.elements,
      a = m[0] * 100,
      b = m[4] * 100,
      cc = (XW - m[12]) * 100;
    const pen = Math.max(...poly.map(([u, v]) => (a * u + b * v) / 100)) - cc;
    // hrnčekový kotúč brúsi okrajom: nôž musí byť v pásme okraja (|Z| ≈ 42 – 70 mm)
    const zc = (m[14] - WZ) * 100;
    const inReach = Math.abs(zc) > (RR - 0.12) * 100 - 8 && Math.abs(zc) < RR * 100 + 8;
    if (pen > 0.001 && !inReach && Math.abs(zc) < (RR - 0.12) * 100 - 8)
      sayOnce(
        'hole',
        true,
        L(
          'Nôž je proti otvoru hrnčeka – posuň stôl tak, aby bol na okraji kotúča (Z ≈ ±55 mm).',
          'The tool faces the hole of the cup – move the table so it is on the wheel rim (Z ≈ ±55 mm).',
        ),
        'info',
      );
    if (pen > 0.001 && inReach) {
      if (!running) {
        Object.assign(st, old);
        c.x = st.x;
        pend.x = st.x;
        place();
        sayOnce(
          'stop',
          true,
          L('Nôž sa dotkol stojaceho kotúča – spusti kotúč.', 'The tool touched the stopped wheel – start the wheel.'),
          'danger',
        );
      } else {
        const r = clipPoly(poly, m[0], m[4], (XW - m[12]) * 100);
        if (r.removed > 1e-4) {
          poly = r.poly;
          dirty = true;
          st.grindT = t;
          // prepálenie: zadaný prísuv predbieha skutočný o viac ako 0,12 mm (príliš rýchle točenie kolesom)
          if (c.x - st.x > 0.12 && !st.burn) {
            st.burn = true;
            say(
              L(
                'Nôž sa prepálil – popúšťacie farby, ostrie zmäklo. Prisúvaj po malých krokoch!',
                'The tool burnt – temper colours, the edge has softened. Feed in small steps!',
              ),
              'danger',
            );
          }
          if (Math.abs(Math.abs(zc) - 55) < 2)
            sayOnce(
              'trav',
              true,
              L(
                'Pohybuj nožom po čele kotúča (koleso stola), kotúč sa inak opotrebuje nerovnomerne.',
                'Traverse the tool across the wheel face (table wheel), otherwise the wheel wears unevenly.',
              ),
              'info',
            );
          if (sparks.length < 120)
            for (let k = 0; k < 3; k++) {
              const sp = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.06), M.spark);
              sp.position.set(XW, WY - 0.1, m[14]);
              sparkG.add(sp);
              sparks.push({
                m: sp,
                v: v3(-1 - Math.random() * 2, -2 - Math.random() * 3, (Math.random() - 0.5) * 2),
                life: 0.5,
              });
            }
        }
      }
    }
    if (dirty && t - lastBuild > 0.1) {
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
    lampRun.emissive.setHex(running ? 0x22dd55 : 0);
    wX.rotation.z = st.x * TAU;
    wZ.rotation.z = (st.z / 20) * TAU;
    wTilt.rotation.z = (st.tilt / 2) * TAU;
  };
  return {
    update,
    tele: () => {
      const ang = toolAngles(poly);
      return {
        rpm: st.rpm,
        x: st.x,
        z: st.z,
        tilt: st.tilt,
        alpha: ang.alpha,
        gamma: ang.gamma,
        grinding: x.time() - st.grindT < 0.3,
        burn: st.burn,
      };
    },
    measure: () => ({ ang: toolAngles(poly), burn: st.burn, area: area(poly) }),
    workObj: () => toolG,
    workSpot: () => v3(-1, 7.5, 4),
    canInspect: () => (!stopped() ? L('Najprv zastav kotúč.', 'Stop the wheel first.') : null),
    prepareInspect: () => buildTool(),
    sound: () => ({ motor: st.rpm / 2800, grind: x.time() - st.grindT < 0.3 ? 0.8 : 0 }),
  };
}

export { BnSimulator };
export default BnSimulator;
