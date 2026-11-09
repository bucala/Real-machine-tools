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
import { TOOL, clipPoly, toolAngles, toolPoly } from './toolGrindMath';

// =====================================================================
// BRÚSKA NOŽOV TOS BBT 350 – dva kotúče brúsiace čelom, pred každým naklápací stôl, mokré brúsenie
// =====================================================================
// Kotúče sú na spoločnom vretene (os x). Strana s = −1 (vľavo, hrubý kotúč) a s = +1 (vpravo, jemný kotúč) sa stavia
// rovnako v „súradniciach strany“ (zrkadlenie mierkou x = s): čelo kotúča je rovina x = XF, stôl je za ním pri x > XF.
// Nôž leží na stole hrotom ku kotúču – sklon stola je uhol brúsenej plochy (uhol chrbta α).
const WY = 10.5, // os kotúčov
  RW = 1.75, // kotúč Ø350
  RF = 0.55, // príruba – vnútri nebrúsi
  XF = 1.6, // čelo kotúča (súradnice strany)
  TY = WY - 0.9, // horná plocha stola (os otáčania stola pri jeho hrane)
  TD = 2.1, // hĺbka stola 210 mm
  TW = 2.8; // polovica dĺžky stola (560 mm)

const bbtParts = () =>
  mkParts([
    [
      'stojan',
      'Stojan',
      'Pedestal',
      'Stojan s motorom a čerpadlom',
      'Pedestal with motor and pump',
      'V stojane je motor s remeňom k vretenu a čerpadlo chladiacej emulzie. Predloha: TOS BBT 350 – brúska nožov s dvoma kotúčmi a naklápacími stolmi 560 × 210 mm, vreteno ≈ 1 560 ot/min.',
      'The pedestal holds the motor with a belt to the spindle and the coolant pump. Model: TOS BBT 350 – tool grinder with two wheels and tilting tables 560 × 210 mm, spindle ≈ 1,560 rpm.',
    ],
    [
      'kotuce',
      'Kotúče',
      'Wheels',
      'Kotúče brúsiace čelom',
      'Wheels grinding with their face',
      'Vľavo hrubý kotúč na hrubovanie, vpravo jemný na dokončenie. Brúsi sa rovinným čelom kotúča, nie obvodom – plocha noža je rovná.',
      'Coarse wheel on the left for roughing, fine on the right for finishing. They grind with the flat face, not the periphery – the tool face comes out flat.',
    ],
    [
      'stoly',
      'Stoly',
      'Tables',
      'Naklápacie stoly so stupnicou',
      'Tilting tables with scale',
      'Nôž leží na stole a posúva sa ku kotúču. Sklon stola (hviezdicová matica, stupnica na segmente) je uhol brúsenej plochy. Ručné koleso na vani prisúva stôl ku kotúču – medzera najviac 3 mm.',
      'The tool lies on the table and is pushed to the wheel. The table tilt (star knob, scale on the segment) is the angle of the ground face. The handwheel on the tray moves the table to the wheel – gap at most 3 mm.',
    ],
    [
      'noz',
      'Nôž',
      'Tool bit',
      'Sústružnícky nôž 16 × 16 HSS',
      'Turning tool 16 × 16 HSS',
      'Nôž sa posúva rukou po stole. Chladiaca emulzia odvádza teplo – bez nej sa ostrie prepáli.',
      'The tool is pushed by hand along the table. The coolant carries the heat away – without it the edge burns.',
    ],
    [
      'ovladanie',
      'Ovládanie',
      'Controls',
      'Ovládanie na stojane',
      'Controls on the pedestal',
      'Hlavný vypínač, štart, stop a páka ventilu chladenia.',
      'Main switch, start, stop and the coolant valve lever.',
    ],
  ]);

const BBT_TASKS = [
  {
    id: 'ostrenie',
    title: () => L('Uhol chrbta α = 8° – hrubý a jemný kotúč', 'Clearance α = 8° – coarse and fine wheel'),
    desc: () =>
      L(
        'Nastav medzeru stola ku kotúču najviac 3 mm a sklon stola 8° na oboch stranách, zapni chladenie. Chrbát noža nahrub prebrús na ľavom (hrubom) kotúči, potom nôž prelož na pravý stôl a dokonči ho na jemnom kotúči.',
        'Set the table gap to the wheel to at most 3 mm and the table tilt to 8° on both sides, switch the coolant on. Rough the tool flank on the left (coarse) wheel, then move the tool to the right table and finish it on the fine wheel.',
      ),
    setup: {},
    drawing: () => <ToolAngleDrawing alpha={8} gamma={0} />,
    checks: (m) => [
      {
        label: L('Uhol chrbta 8 ±0,5°', 'Clearance angle 8 ±0.5°'),
        ok: m.ang.alpha !== null && Math.abs(m.ang.alpha - 8) <= 0.5,
        value: m.ang.alpha === null ? '—' : `${m.ang.alpha.toFixed(1)}°`,
      },
      {
        label: L('Prebrúsená celá chrbtová plocha', 'Whole flank ground'),
        ok: m.ang.endLen >= 0.9 * TOOL.H,
        value: `${m.ang.endLen.toFixed(1)} mm`,
      },
      {
        label: L('Dokončené na jemnom kotúči', 'Finished on the fine wheel'),
        ok: m.fine,
        value: m.fine ? '✓' : '✗',
      },
      { label: L('Nôž neprepálený', 'Tool not burnt'), ok: !m.burn, value: m.burn ? '✗' : '✓' },
      {
        label: L('Medzera stola ≤ 3 mm pri brúsení', 'Table gap ≤ 3 mm while grinding'),
        ok: !m.gapBad,
        value: m.gapBad ? '✗' : '✓',
      },
    ],
  },
];

const BBT_SAFETY = () => [
  L(
    'Kotúče sú bez trhlín a v krytoch, medzera stola ku kotúču je najviac 3 mm.',
    'The wheels are crack-free and guarded, the table gap to the wheel is at most 3 mm.',
  ),
  L(
    'Mám ochranné okuliare; pri brúsení nemám rukavice ani voľný odev.',
    'I wear safety glasses; no gloves or loose clothing while grinding.',
  ),
  L(
    'Nôž vediem oboma rukami po stole a prisúvam ho citlivo.',
    'I guide the tool along the table with both hands and feed it gently.',
  ),
];

function BbtSimulator({ onBack, params }) {
  const mountRef = useRef(null),
    layerRef = useRef(null),
    tipRef = useRef(null);
  const init = {
    power: true,
    running: false,
    cool: false,
    side: 0,
    tilt0: 0,
    tilt1: 0,
    gap0: 5,
    gap1: 5,
    d: 30,
    z: 0,
    light: true,
    manual: false,
  };
  const { ctl, ui, setUi, set, selected, selectPart, apiRef } = useMachine(init);
  const [tele, setTele] = useTele({ rpm: 0, heat: 0, alpha: null, d: 30, grinding: false, burn: false, msg: null });
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
      colors: [0x9cc79a, 0x83ad82, 0x67906a],
      mats: {
        coarse: [0x6f675b, 0.95, 0],
        fine: [0xc9c4b4, 0.95, 0],
        tool: [0xc7ccd1, 0.3, 0.85],
        burnt: [0x5a4a8e, 0.35, 0.7],
        hot: [0xd88a3a, 0.4, 0.6],
        plate: [0x6d7175, 0.45, 0.6],
        emul: new THREE.MeshStandardMaterial({
          color: 0xcfe3d9,
          roughness: 0.15,
          metalness: 0,
          transparent: true,
          opacity: 0.75,
        }),
        spark: new THREE.MeshBasicMaterial({ color: 0xffb347, toneMapped: false }),
      },
      name: L('Brúska nožov TOS BBT 350', 'TOS BBT 350 tool grinder'),
      sound: 'grinder',
      debugKey: '__bbt',
      build: (x) => buildBbt(x),
    });
  }, []);
  const parts = bbtParts();
  const act = (k, v) => apiRef.current.act?.[k]?.(v);
  const s = ui.side;
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
                'Kotúče bežia. Posúvaj nôž po stole ku kotúču.',
                'The wheels run. Push the tool along the table to the wheel.',
              ),
            }
          : {
              kind: 'idle',
              text: L(
                'Nastav medzeru a sklon stola, zapni chladenie a spusti brúsku.',
                'Set the table gap and tilt, switch on the coolant and start.',
              ),
            };
  const chips = [
    {
      color: tele.rpm > 5 ? '#3ee06c' : '#8b8f89',
      text: tele.rpm > 5 ? `${Math.round(tele.rpm)} ${RPM()}` : L('Stojí', 'Stopped'),
    },
    {
      color: ui[`gap${s}`] <= 3 ? '#7fb6ff' : '#ff5a4f',
      text: `${L('medzera', 'gap')} ${ui[`gap${s}`].toFixed(1)} mm`,
    },
    { color: ui.cool ? '#7fb6ff' : '#ff8a1f', text: ui.cool ? L('chladenie', 'coolant') : L('nasucho', 'dry') },
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
        canUnclamp
        workLabels={[L('Pozrieť nôž', 'Inspect the tool'), L('Späť k brúske', 'Back to the grinder')]}
        tips={[
          L(
            'Nôž ťahaj po stole za jeho zadný koniec (ručné ovládanie). Klik na druhý stôl nôž preloží.',
            'Drag the tool along the table by its back end (manual control). Click the other table to move the tool there.',
          ),
        ]}
      />
      <aside className="panel">
        <fieldset className="machine-settings" disabled={ui.unclamped}>
          <PanelHeader
            ui={ui}
            set={set}
            kicker={L('Simulátor · brúska', 'Simulator · grinder')}
            title={L('Brúska nožov', 'Tool grinder')}
            sub={L(
              'Predloha: TOS BBT 350 – dva kotúče brúsiace čelom, naklápacie stoly 560 × 210 mm, vreteno ≈ 1 560 ot/min, mokré brúsenie. Mierka 1 : 100 mm.',
              'Modelled after the TOS BBT 350 – two wheels grinding with their face, tilting tables 560 × 210 mm, spindle ≈ 1,560 rpm, wet grinding. Scale 1 : 100 mm.',
            )}
            rows={[
              ['α', tele.alpha === null ? '—' : `${tele.alpha.toFixed(1)}°`],
              [L('Teplota', 'Temp.'), `${Math.round(20 + tele.heat * 280)} °C`],
              [L('Ku kotúču', 'To wheel'), `${tele.d.toFixed(2)}`],
            ]}
            foot={[
              s ? L('pravý – jemný kotúč', 'right – fine wheel') : L('ľavý – hrubý kotúč', 'left – coarse wheel'),
              `${L('sklon stola', 'table tilt')} ${ui[`tilt${s}`].toFixed(1)}°`,
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
            <Toggle on={ui.power} label={L('Hlavný vypínač', 'Main switch')} onClick={() => set('power', !ui.power)} />
            <Toggle on={ui.cool} label={L('Chladiaca emulzia', 'Coolant')} onClick={() => set('cool', !ui.cool)} />
          </div>
          <div className="sec">
            <div className="section-heading">
              <h2 className="sec-title mb-2">{L('Stôl a nôž', 'Table and tool')}</h2>
              <SectionInfo title={L('Sklon stola', 'Table tilt')}>
                <p className="text-xs muted">
                  {L(
                    'Čelo kotúča je zvislá rovina. Nôž leží na naklonenom stole, takže brúsená plocha zviera so spodkom noža uhol 90° − sklon – teda uhol chrbta α = sklon stola.',
                    'The wheel face is a vertical plane. The tool lies on the tilted table, so the ground face makes 90° − tilt with the tool base – the clearance α equals the table tilt.',
                  )}
                </p>
              </SectionInfo>
            </div>
            <SegRow
              label={L('Strana', 'Side')}
              value={s}
              options={[
                [0, L('ľavá – hrubý', 'left – coarse')],
                [1, L('pravá – jemný', 'right – fine')],
              ]}
              onChange={(v) => act('side', v)}
            />
            <Slider
              id="bbtt"
              label={L('Sklon stola', 'Table tilt')}
              unit="°"
              min={-5}
              max={20}
              step={0.5}
              value={ui[`tilt${s}`]}
              digits={1}
              onChange={(v) => act('tilt', v)}
            />
            <Slider
              id="bbtg"
              label={L('Medzera stola ku kotúču', 'Table gap to the wheel')}
              unit="mm"
              min={1}
              max={10}
              step={0.5}
              value={ui[`gap${s}`]}
              digits={1}
              onChange={(v) => act('gap', v)}
            />
            <Slider
              id="bbtd"
              label={L('Nôž – vzdialenosť hrotu od čela kotúča', 'Tool – tip distance from the wheel face')}
              unit="mm"
              min={-4}
              max={60}
              step={0.05}
              value={ui.d}
              actual={tele.d}
              digits={2}
              onChange={(v) => act('d', v)}
            />
            <Slider
              id="bbtz"
              label={L('Nôž – posun po čele kotúča', 'Tool – across the wheel face')}
              unit="mm"
              min={-90}
              max={90}
              step={1}
              value={ui.z}
              digits={0}
              onChange={(v) => act('z', v)}
            />
            <button type="button" className="btn w-full mt-2" onClick={() => apiRef.current.newBlank?.()}>
              {L('Nový nôž', 'New tool')}
            </button>
          </div>
          <ExportSection machine="dvojkotuc" apiRef={apiRef} canSave={false} />
          <ViewSection
            apiRef={apiRef}
            views={[
              ['celok', L('Celok', 'Overview')],
              ['rez', L('Detail brúsenia', 'Grinding detail')],
              ['stol', L('Stôl zboku', 'Table side')],
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
  const { add, box, cylX, cylY, cylZ, ball, handwheel } = kit;
  const { rbox, nameplate, cable, bolts } = det;
  // ---------- stojan ----------
  const ped = grp('stojan');
  rbox(ped, -1.7, 1.7, 0, 0.35, -1.7, 1.5, M.greenDeep, 0.06);
  rbox(ped, -1.35, 1.35, 0.35, 7.7, -1.4, 1.2, M.green, 0.14);
  const door = new THREE.Group();
  door.position.z = 1.21;
  ped.add(door);
  rbox(door, -1.05, 1.05, 0.9, 5.2, 0, 0.05, M.greenDark, 0.04);
  for (let k = 0; k < 7; k++) box(door, -0.75, 0.75, 2.0 + k * 0.24, 2.07 + k * 0.24, 0.05, 0.07, M.greenDeep);
  // stredné teleso s vretenom a znakom TOS
  rbox(ped, -1.0, 1.0, 7.7, WY + 1.3, -1.2, 1.0, M.green, 0.16);
  nameplate(ped, 0, WY + 0.5, 1.01, 0, 'TOS', 'BBT 350', 0.8);
  // ---------- vreteno a kotúče ----------
  const kc = grp('kotuce');
  cylX(kc, 0.16, 0.16, -XF + 0.3, XF - 0.3, WY, 0, M.steel, 16);
  const stoly = grp('stoly');
  const sides = [-1, 1].map((sg, i) => {
    // súradnice strany (zrkadlené pre ľavú stranu): gk = kotúč a kryt, g = vaňa a stôl
    const gk = new THREE.Group(),
      g = new THREE.Group();
    gk.scale.x = sg;
    g.scale.x = sg;
    kc.add(gk);
    stoly.add(g);
    // kryt kotúča: skriňa za kotúčom so zaobleným vrchom a ráfik okolo čela
    const hood = new THREE.Group();
    gk.add(hood);
    rbox(hood, 0.95, XF - 0.42, WY - 2.0, WY + 2.0, -2.0, 1.95, M.green, 0.25); // zadná stena krytu
    rbox(hood, XF - 0.45, XF + 0.1, WY + 0.3, WY + 2.05, -2.0, 1.95, M.green, 0.2); // horný kryt
    rbox(hood, XF - 0.45, XF + 0.1, WY - 2.05, TY - 0.3, -2.0, 1.95, M.green, 0.12); // spodný kryt pod stolom
    [-1, 1].forEach((sz) =>
      rbox(hood, XF - 0.45, XF + 0.1, TY - 0.35, WY + 0.35, sz > 0 ? 1.75 : -2.0, sz > 0 ? 1.95 : -1.8, M.green, 0.05),
    );
    // kotúč: čelo v rovine x = XF
    const spin = new THREE.Group();
    spin.position.set(XF, WY, 0);
    gk.add(spin);
    cylX(spin, RW, RW, -0.4, -0.004, 0, 0, i ? M.fine : M.coarse, 64);
    cylX(spin, RF, RF, -0.4, 0.04, 0, 0, M.steel, 32); // príruba
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU,
        b = box(spin, 0, 0.06, -0.05, 0.05, -0.05, 0.05, M.steelDark);
      b.position.set(0.02, Math.cos(a) * 0.38, Math.sin(a) * 0.38);
    }
    box(spin, -0.002, 0.002, 0.9, 1.5, -0.04, 0.04, M.black); // značka – vidno otáčanie
    // dýza chladenia nad čelom
    cylY(gk, 0.05, 0.03, WY + 0.9, WY + 1.6, XF + 0.12, 0.6, M.steel, 10);
    const jet = add(gk, new THREE.CylinderGeometry(0.03, 0.06, 1.3, 8), M.emul, XF + 0.12, WY + 0.25, 0.6);
    jet.userData.noMerge = true;
    // vaňa pod stolom
    const tray = new THREE.Group();
    g.add(tray);
    rbox(tray, 0.95, XF + TD + 0.9, TY - 1.9, TY - 1.75, -TW - 0.5, TW + 0.5, M.green, 0.04);
    rbox(tray, XF + TD + 0.75, XF + TD + 0.9, TY - 1.75, TY - 0.95, -TW - 0.5, TW + 0.5, M.green, 0.03);
    [-1, 1].forEach((sz) =>
      rbox(
        tray,
        0.95,
        XF + TD + 0.9,
        TY - 1.75,
        TY - 0.95,
        sz * (TW + 0.5) - (sz > 0 ? 0.15 : 0),
        sz * (TW + 0.5) + (sz < 0 ? 0.15 : 0),
        M.green,
        0.03,
      ),
    );
    const emul = add(tray, new THREE.BoxGeometry(TD + 0.5, 0.02, 2 * TW + 0.7), M.emul, XF + TD / 2 + 0.6, TY - 1.6, 0);
    emul.userData.noMerge = true;
    rbox(g, 1.0, 1.9, 6.8, TY - 1.9, -1.0, 0.8, M.greenDark, 0.08); // konzola vane
    // naklápací stôl: os otáčania pri hrane ku kotúču (rovnobežná so z)
    const tbl = new THREE.Group();
    g.add(tbl);
    const plate = new THREE.Group();
    tbl.add(plate);
    rbox(plate, 0, TD, -0.14, 0, -TW, TW, M.plate, 0.03);
    rbox(plate, 0.1, TD - 0.1, -0.5, -0.14, -0.4, 0.4, M.greenDark, 0.05); // rebro pod stolom
    kit.hitProxy(plate, 0.6, TD - 0.4, 0.1, -TW + 0.7); // klik = preložiť nôž sem
    // segment so stupnicou a hviezdicová matica na prednej strane
    const seg = new THREE.Group();
    seg.position.set(XF + 0.9, TY - 0.72, TW - 0.2);
    g.add(seg);
    rbox(seg, -0.9, 0.9, -0.55, 0.45, -0.1, 0.05, M.greenDark, 0.06);
    const stx = angleScaleTex(20, 2, { numR: 0.82, step: 5, len: 0.1 });
    if (stx) {
      const sc = add(
        seg,
        new THREE.CircleGeometry(0.85, 48, Math.PI * 0.18, Math.PI * 0.64),
        new THREE.MeshStandardMaterial({ map: stx, roughness: 0.4, metalness: 0.3 }),
        0,
        -0.45,
        0.06,
      );
      sc.scale.x = sg; // zrkadlenie strany sa tu ruší – čísla ostanú čitateľné
      sc.userData.noMerge = true;
      sc.castShadow = false;
    }
    const ptr = new THREE.Group();
    ptr.position.set(0, -0.45, 0.08);
    seg.add(ptr);
    box(ptr, -0.015, 0.015, 0.4, 0.88, 0, 0.02, M.red);
    const star = new THREE.Group();
    star.position.set(0.55, -0.3, 0.1);
    seg.add(star);
    cylZ(star, 0.08, 0.08, 0, 0.18, 0, 0, M.steelDark, 12);
    for (let k = 0; k < 4; k++) {
      const arm = box(star, -0.04, 0.04, 0, 0.26, 0.14, 0.22, M.black);
      arm.rotation.z = (k * Math.PI) / 2 + Math.PI / 4;
    }
    kit.hitProxy(star, 0.26, 0, 0, 0.2);
    // ručné koleso prísuvu stola na čele vane
    const wGap = handwheel(g, 0.42, XF + TD / 2 + 0.6, TY - 1.35, TW + 0.62, 'z', 0.24);
    return { g, hood, spin, tbl, plate, ptr, star, wGap, jet };
  });
  // ---------- nôž (leží na aktívnom stole) ----------
  const toolPiv = new THREE.Group();
  const toolSpin = new THREE.Group(); // hrot k −x (ku kotúču), u → −x
  toolSpin.rotation.y = Math.PI;
  toolPiv.add(toolSpin);
  const toolG = grp('noz', toolSpin);
  toolG.position.set(-TOOL.L / 100, 0, 0); // spodný roh hrotu (u = L, v = 0) v počiatku toolPiv
  let poly = toolPoly(),
    tMesh = null;
  const buildTool = () => {
    if (tMesh) {
      toolG.remove(tMesh);
      tMesh.geometry.dispose();
    }
    const sh = new THREE.Shape();
    poly.forEach(([u, v], i) => (i ? sh.lineTo(u / 100, v / 100) : sh.moveTo(u / 100, v / 100)));
    sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: TOOL.H / 100, bevelEnabled: false });
    geo.translate(0, 0, -TOOL.H / 200);
    tMesh = new THREE.Mesh(geo, st.burn ? M.burnt : st.heat > 0.6 ? M.hot : M.tool);
    tMesh.castShadow = true;
    tMesh.userData.part = 'noz';
    tMesh.userData.controlPassThrough = true;
    toolG.add(tMesh);
  };
  const grip = new THREE.Group(); // úchop na zadnom konci noža
  grip.position.set(TOOL.L / 100 - 0.15, 0.1, 0);
  toolPiv.add(grip);
  kit.hitProxy(grip, 0.3, 0, 0, 0);
  // ---------- ovládanie ----------
  const pan = grp('ovladanie', ped);
  const face = new THREE.Group();
  face.position.set(0, 0, 1.01);
  pan.add(face);
  rbox(face, -0.75, 0.75, 7.95, 9.0, 0, 0.06, M.panel, 0.03);
  const mSw = mainSwitch(kit, M, face, -0.35, 8.5, 0.07);
  const bStart = panelButton(kit, M, face, 0.25, 8.75, 0.07, M.btnGreen, 0.1),
    bStop = panelButton(kit, M, face, 0.25, 8.25, 0.07, M.red, 0.1);
  const lampRun = M.lamp.clone();
  ball(face, 0.05, 0.6, 8.5, 0.08, lampRun);
  const levCool = kit.pivotLever(face, 0, 6.2, 0.06, 0.4, 0);
  cylZ(face, 0.12, 0.12, -0.02, 0.06, 0, 6.2, M.steelDark, 16);
  // čerpadlo a hadice k dýzam
  cylY(ped, 0.32, 0.32, 0.35, 1.2, 1.9, 0.0, M.greenDark, 20);
  cable(
    ped,
    [
      [1.9, 1.2, 0],
      [1.6, 5.0, 0.9],
      [1.3, WY + 1.4, 0.8],
      [XF + 0.12, WY + 1.65, 0.6],
    ],
    0.05,
    M.blue,
  );
  cable(
    ped,
    [
      [1.3, WY + 1.4, 0.8],
      [0, WY + 1.45, -0.9],
      [-1.3, WY + 1.4, 0.8],
      [-XF - 0.12, WY + 1.65, 0.6],
    ],
    0.05,
    M.blue,
  );
  bolts(
    ped,
    [
      [-1.5, 0.2],
      [1.5, 0.2],
    ],
    1.5,
    0.08,
  );
  const sparks = [],
    sparkG = new THREE.Group();
  x.scene.add(sparkG);
  // ---------- stav ----------
  Object.assign(st, {
    rpm: 0,
    a: 0,
    d: c.d,
    z: c.z,
    tilt: [c.tilt0, c.tilt1],
    heat: 0,
    burn: false,
    grindT: -9,
    gapBad: false,
    fineArea: 0,
    lastSide: -1,
  });
  const stopped = () => !c.running && st.rpm < 1;
  const gapOf = (i) => c[`gap${i}`];
  const place = () => {
    sides.forEach((S, i) => {
      S.tbl.position.set(XF + gapOf(i) / 100, TY, 0);
      S.tbl.rotation.z = (-st.tilt[i] * Math.PI) / 180;
      S.ptr.rotation.z = (st.tilt[i] * 2 * Math.PI) / 180;
      S.star.rotation.z = (st.tilt[i] / 2) * TAU;
      S.wGap.rotation.z = gapOf(i) * TAU;
    });
    const S = sides[c.side];
    if (toolPiv.parent !== S.tbl) S.tbl.add(toolPiv);
    // hrot noža je vo vzdialenosti d od čela kotúča (meraná po stole); stôl začína gap za čelom
    toolPiv.position.set((st.d - gapOf(c.side)) / 100, 0, st.z / 100);
  };
  // prienik noža do čela kotúča v súradniciach strany: polrovina x ≤ XF
  const inv = new THREE.Matrix4(),
    rel = new THREE.Matrix4();
  const contact = () => {
    const S = sides[c.side];
    S.g.updateWorldMatrix(true, false);
    toolG.updateWorldMatrix(true, false);
    inv.copy(S.g.matrixWorld).invert();
    rel.multiplyMatrices(inv, toolG.matrixWorld);
    const m = rel.elements,
      cc = (m[12] - XF) * 100, // nôž leží na strane x ≥ XF: ponecháva sa −x ≤ −XF
      pen = Math.max(...poly.map(([u, v]) => -(m[0] * u + m[4] * v))) - cc;
    const rr = Math.hypot(m[13] + (m[5] * TOOL.H) / 200 - WY, m[14]);
    return { m, pen, cc, inReach: rr > RF + 0.05 && rr < RW - 0.05, rr };
  };
  buildTool();
  place();
  Object.assign(anchors, {
    stojan: () => v3(0, 4.0, 1.25),
    kotuce: () => v3(-XF, WY + RW + 0.3, 0),
    stoly: () => v3(XF + TD, TY, TW),
    noz: () => {
      const p = new THREE.Vector3();
      toolPiv.getWorldPosition(p);
      return p.add(v3(0, 0.3, 0));
    },
    ovladanie: () => v3(0, 9.0, 1.05),
  });
  const sx = () => (c.side ? 1 : -1);
  Object.assign(views, {
    celok: () => [
      [6, 15.5, 15],
      [0, 8.8, 0],
    ],
    rez: () => [[sx() * (XF + 1.6), WY + 0.7, 3.4], [sx() * (XF + 0.3), TY + 0.1, 0], true],
    stol: () => [[sx() * (XF + 1.0), TY + 0.2, 5.5], [sx() * (XF + 0.6), TY, 0], true],
  });
  const start = needPower(() => {
    if (!apiRef.current.safetyGate || apiRef.current.safetyGate.ok()) push('running', true);
    else apiRef.current.safetyGate.request();
  });
  apiRef.current.toggleRun = () => (c.running ? push('running', false) : start());
  const away = () => st.d > 3;
  const act = {
    side: (i) => {
      if (i === c.side) return;
      if (!away()) return say(L('Najprv odtiahni nôž od kotúča.', 'Pull the tool away from the wheel first.'));
      push('side', i);
      push('d', 30);
      st.d = 30;
    },
    tilt: (v) => {
      if (!away())
        return say(
          L('Sklon stola meň s nožom odtiahnutým od kotúča.', 'Change the table tilt with the tool pulled back.'),
        );
      push(`tilt${c.side}`, clamp(Math.round(v * 2) / 2, -5, 20));
    },
    gap: (v) => {
      if (!stopped())
        return say(L('Stôl sa prestavuje pri stojacich kotúčoch.', 'The table is adjusted with the wheels stopped.'));
      push(`gap${c.side}`, clamp(Math.round(v * 2) / 2, 1, 10));
    },
    d: (v) => push('d', clamp(Math.round(v * 100) / 100, -4, 60)),
    z: (v) => push('z', clamp(Math.round(v), -90, 90)),
  };
  apiRef.current.act = act;
  apiRef.current.newBlank = () => {
    if (!away()) return (say(L('Najprv odtiahni nôž od kotúča.', 'Pull the tool away from the wheel first.')), false);
    poly = toolPoly();
    Object.assign(st, { burn: false, heat: 0, gapBad: false, fineArea: 0, lastSide: -1 });
    buildTool();
    return true;
  };
  // ---------- ovládače v scéne ----------
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
      hint: LL('Spustí motor kotúčov.', 'Starts the wheel motor.'),
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
  ctrl.reg(
    {
      type: 'lever',
      angles: [0.5, -0.5],
      minR: 0.18,
      label: LL('Ventil chladenia', 'Coolant valve'),
      hint: LL(
        'Pustí emulziu na čelo kotúča – mokré brúsenie neprepáli nôž.',
        'Lets the coolant onto the wheel face – wet grinding does not burn the tool.',
      ),
      getIdx: () => (c.cool ? 1 : 0),
      onSet: (i) => push('cool', i === 1),
      read: () => (c.cool ? L('otvorený', 'open') : L('zatvorený', 'closed')),
    },
    levCool,
  );
  sides.forEach((S, i) => {
    const side = i ? LL('pravý', 'right') : LL('ľavý', 'left');
    ctrl.reg(
      {
        type: 'button',
        still: true,
        label: i
          ? LL('Pravý stôl (jemný kotúč)', 'Right table (fine wheel)')
          : LL('Ľavý stôl (hrubý kotúč)', 'Left table (coarse wheel)'),
        hint: LL('Preloží nôž na tento stôl.', 'Moves the tool onto this table.'),
        action: () => act.side(i),
        read: () => (c.side === i ? L('nôž je tu', 'tool here') : '—'),
      },
      S.plate,
    );
    ctrl.reg(
      {
        type: 'wheel',
        minR: 0.12,
        inc: 1,
        label: LL('Matica sklonu stola', 'Table tilt knob'),
        hint: LL('1 otáčka = 2°, stupnica na segmente.', '1 turn = 2°, scale on the segment.'),
        guard: () =>
          (c.side === i && away()) ||
          c.side !== i ||
          (say(L('Najprv odtiahni nôž od kotúča.', 'Pull the tool away from the wheel first.')), false),
        turn: (d) =>
          push(`tilt${i}`, clamp(Math.round((c[`tilt${i}`] + (d / TAU) * 2 * (i ? 1 : -1)) * 10) / 10, -5, 20)),
        read: () => `${st.tilt[i].toFixed(1)}° (${side()})`,
      },
      S.star,
    );
    ctrl.reg(
      {
        type: 'wheel',
        minR: 0.2,
        inc: 1,
        label: LL('Prísuv stola ku kotúču', 'Table to the wheel'),
        hint: LL(
          'Medzera medzi stolom a čelom kotúča – najviac 3 mm. 1 otáčka = 1 mm, len pri stojacich kotúčoch.',
          'Gap between the table and the wheel face – at most 3 mm. 1 turn = 1 mm, wheels stopped only.',
        ),
        guard: () =>
          stopped() ||
          (say(L('Stôl sa prestavuje pri stojacich kotúčoch.', 'The table is adjusted with the wheels stopped.')),
          false),
        turn: (d) => push(`gap${i}`, clamp(Math.round((c[`gap${i}`] - d / TAU) * 10) / 10, 1, 10)),
        read: () => `${c[`gap${i}`].toFixed(1)} mm`,
      },
      S.wGap,
    );
  });
  let d0 = 0;
  ctrl.reg(
    {
      type: 'slide',
      axis: 'x',
      label: LL('Nôž', 'Tool'),
      hint: LL('Ťahaj nôž po stole ku kotúču a späť.', 'Drag the tool along the table to the wheel and back.'),
      read: () => `${st.d.toFixed(2)} mm`,
      start: () => (d0 = c.d),
      slide: (dx) => act.d(d0 + (c.side ? 1 : -1) * dx * 100),
      nudge: (d) => act.d(c.d - d * 0.05),
    },
    grip,
  );
  // ---------- slučka ----------
  let lastBuild = -9,
    dirty = false;
  const update = (dt, t) => {
    if (!c.power && c.running) push('running', false);
    st.rpm = approach(st.rpm, c.running && c.power ? 1560 : 0, 900 * dt);
    const running = st.rpm > 50;
    st.a += (st.rpm / 60) * TAU * dt * 0.05;
    sides.forEach((S) => (S.spin.rotation.x = st.a));
    sides.forEach((S, i) => (S.jet.visible = running && c.cool && c.side === i));
    const old = st.d;
    st.d = approach(st.d, c.d, 3 * dt);
    st.z = approach(st.z, c.z, 80 * dt);
    st.tilt = st.tilt.map((v, i) => approach(v, c[`tilt${i}`], 8 * dt));
    place();
    const k = contact();
    if (k.pen > 0.001 && k.inReach) {
      if (!running) {
        st.d = old;
        c.d = old;
        pend.d = old;
        place();
        sayOnce(
          'stop',
          true,
          L(
            'Nôž sa dotkol stojaceho kotúča – spusti brúsku.',
            'The tool touched the stopped wheel – start the grinder.',
          ),
          'danger',
        );
      } else {
        const r = clipPoly(poly, -k.m[0], -k.m[4], k.cc);
        if (r.removed > 1e-4) {
          poly = r.poly;
          dirty = true;
          st.grindT = t;
          st.lastSide = c.side;
          if (c.side === 1) st.fineArea += r.removed;
          else st.fineArea = 0;
          st.heat += r.removed * (c.cool ? 0.004 : 0.05);
          if (st.heat > 1 && !st.burn) {
            st.burn = true;
            say(
              L(
                'Nôž sa prepálil – zmodral a zmäkol. Brús s chladením a prisúvaj pomalšie!',
                'The tool burnt – it turned blue and softened. Grind with coolant and feed slower!',
              ),
              'danger',
            );
          }
          if (gapOf(c.side) > 3) {
            st.gapBad = true;
            sayOnce(
              'gap',
              true,
              L(
                'Medzera stola ku kotúču je väčšia ako 3 mm – nôž sa môže vtiahnuť pod kotúč!',
                'The table gap to the wheel is over 3 mm – the tool can be pulled in under the wheel!',
              ),
              'danger',
            );
          }
          if (sparks.length < 150 && !c.cool)
            for (let q = 0; q < 3; q++) {
              const sp = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.08), M.spark);
              sp.position.set(sx() * XF, k.m[13] + 0.08, k.m[14]);
              sparkG.add(sp);
              sparks.push({
                m: sp,
                v: v3(sx() * (0.5 + Math.random()), -2 - Math.random() * 3, (Math.random() - 0.5) * 3),
                life: 0.5,
              });
            }
        }
      }
    } else if (k.pen > 0.001 && !k.inReach)
      sayOnce(
        'reach',
        true,
        L(
          'Nôž je proti prírube alebo mimo kotúča – posuň ho po stole na čelo kotúča.',
          'The tool faces the flange or misses the wheel – slide it across the table onto the wheel face.',
        ),
        'info',
      );
    st.heat = Math.max(0, st.heat - (c.cool ? 0.8 : 0.05) * dt);
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
    lampRun.emissive.setHex(running ? 0x22dd55 : 0);
    mSw.rotation.z = c.power ? -Math.PI / 2 : 0;
    levCool.rotation.z = c.cool ? -0.5 : 0.5;
  };
  return {
    update,
    tele: () => ({
      rpm: st.rpm,
      heat: Math.min(1.2, st.heat),
      alpha: toolAngles(poly).alpha,
      d: st.d,
      grinding: x.time() - st.grindT < 0.3,
      burn: st.burn,
    }),
    measure: () => ({
      ang: toolAngles(poly),
      burn: st.burn,
      gapBad: st.gapBad,
      fine: st.lastSide === 1 && st.fineArea >= 2,
    }),
    workObj: () => toolPiv,
    workSpot: () => v3(0, 12.5, 6),
    canInspect: () => (!stopped() ? L('Najprv zastav brúsku.', 'Stop the grinder first.') : null),
    prepareInspect: () => buildTool(),
    sound: () => ({ motor: st.rpm / 1560, grind: x.time() - st.grindT < 0.3 ? 0.9 : 0 }),
  };
}

export { BbtSimulator };
export default BbtSimulator;
