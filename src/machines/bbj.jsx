import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { L, LL, RPM } from '../core/i18n';
import { angleScaleTex } from '../core/detail';
import { TAU, approach, clamp } from '../core/util';
import { ExportSection, TaskSection } from '../ui/tools';
import { SectionInfo } from '../ui/sectionInfo';
import { ShaftDrawing } from '../ui/sketch';
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
import { BBJ, bbjChecks, grindPass, pinsInfo, throughFeed } from './bbjMath';

// =====================================================================
// BEZHROTOVÁ BRÚSKA TOS HOSTIVAŘ BBJ 6 – brúsny a podávací kotúč, podpera, priebežné brúsenie kolíkov
// =====================================================================
const AY = 9.0, // výška osí kotúčov
  RG = 2.5, // brúsny kotúč Ø500
  RR = BBJ.dR / 200, // podávací kotúč Ø250
  WW = 1.5, // šírka kotúčov (pozdĺž Z)
  D0 = 20.3; // priemer polotovaru kolíka

const bbjParts = () =>
  mkParts([
    [
      'lozko',
      'Lôžko',
      'Bed',
      'Lôžko so saňami',
      'Bed with slides',
      'Lôžko nesie brúsny vreteník (pevne) a sane podávacieho kotúča, ktorými sa nastavuje medzera = výsledný priemer. Predloha: TOS Hostivař BBJ 6, priemer brúsenia do 63 mm.',
      'The bed carries the fixed wheelhead and the regulating wheel slide that sets the gap = finished diameter. Model: TOS Hostivař BBJ 6, grinding diameter up to 63 mm.',
    ],
    [
      'brusny',
      'Brúsny kotúč',
      'Grinding wheel',
      'Brúsny kotúč Ø500',
      'Grinding wheel Ø500',
      'Rýchlo sa točiaci kotúč brúsi obvod kolíka (≈ 30 m/s).',
      'The fast wheel grinds the pin circumference (≈ 30 m/s).',
    ],
    [
      'podavaci',
      'Podávací kotúč',
      'Regulating wheel',
      'Podávací kotúč Ø250 s naklopením',
      'Regulating wheel Ø250, tilted',
      'Pomalý gumový kotúč točí kolíkom a tlačí ho dopredu – rýchlosť prechodu v = π · d · n · sin α. Naklopenie α sa nastavuje pri stojacom kotúči.',
      'The slow rubber-bond wheel rotates the pin and pushes it through – throughfeed v = π · d · n · sin α. The tilt α is set with the wheel stopped.',
    ],
    [
      'podpera',
      'Podpera',
      'Work rest',
      'Podpera obrobku (lišta)',
      'Work rest blade',
      'Kolík leží na lište medzi kotúčmi. Stred kolíka má byť nad spojnicou osí kotúčov (≈ d/2) – inak vzniká mnohohran a kolík nie je guľatý.',
      'The pin lies on the blade between the wheels. Its centre must be above the line of wheel centres (≈ d/2) – otherwise lobes form and the pin is out of round.',
    ],
    [
      'obrobok',
      'Kolíky',
      'Pins',
      'Kolíky Ø20,3 × 100',
      'Pins Ø20.3 × 100',
      'Oceľové kolíky prechádzajú brúskou jeden za druhým; po prechode padajú do debny.',
      'Steel pins pass through the grinder one after another and drop into the bin.',
    ],
    [
      'ovladanie',
      'Ovládanie',
      'Controls',
      'Ovládací panel',
      'Control panel',
      'Hlavný vypínač, brúsny a podávací kotúč, chladenie.',
      'Main switch, grinding and regulating wheel, coolant.',
    ],
  ]);

const BBJ_TASKS = [
  {
    id: 'kolik',
    title: () => L('5 kolíkov Ø20 ±0,01 mm', '5 pins Ø20 ±0.01 mm'),
    desc: () =>
      L(
        'Kolíky Ø20,3 × 100 prebrús priebežne na Ø20,00 ±0,01 mm s guľatosťou do 0,005 mm. Uber najviac 0,1 mm na prechod (kolíky vracaj na ďalší prechod), stred kolíka nastav nad spojnicu osí (výška podpery ≈ 10 mm) a naklopenie podávacieho kotúča 2 – 4°.',
        'Throughfeed-grind Ø20.3 × 100 pins to Ø20.00 ±0.01 mm, roundness within 0.005 mm. Remove at most 0.1 mm per pass (return the pins for the next pass), set the pin centre above the centre line (rest height ≈ 10 mm) and tilt the regulating wheel 2 – 4°.',
      ),
    setup: {},
    drawing: () => <ShaftDrawing d={20} tol="±0,01" len={100} bL={100} />,
    labels: {
      count: () => L('5 kolíkov v tolerancii', '5 pins within tolerance'),
      round: () => L('Guľatosť ≤ 0,005 mm', 'Roundness ≤ 0.005 mm'),
      burn: () => L('Bez prepálenia', 'No burning'),
    },
  },
].map((t) => ({ ...t, checks: (m) => bbjChecks[t.id](m).map((c) => ({ ...c, label: t.labels[c.key]() })) }));

const BBJ_SAFETY = () => [
  L(
    'Kryty kotúčov sú zatvorené, podpera je pevne upnutá.',
    'The wheel guards are closed and the work rest is clamped tight.',
  ),
  L(
    'Kolíky vkladám do žľabu, nikdy rukou medzi kotúče.',
    'I put the pins into the chute, never by hand between the wheels.',
  ),
  L(
    'Naklopenie a podperu nastavujem len pri stojacich kotúčoch.',
    'I set the tilt and the rest only with the wheels stopped.',
  ),
];

function BbjSimulator({ onBack, params }) {
  const mountRef = useRef(null),
    layerRef = useRef(null),
    tipRef = useRef(null);
  const init = {
    power: true,
    gw: false,
    rw: false,
    coolant: true,
    nR: 1,
    alpha: 0,
    gap: 20.6,
    h: 0,
    light: true,
    manual: false,
    timeScale: 3,
  };
  const { ctl, ui, setUi, set, selected, selectPart, apiRef } = useMachine(init);
  const [tele, setTele] = useTele({
    gw: 0,
    rw: 0,
    gap: 20.6,
    alpha: 0,
    h: 0,
    vf: 0,
    n: 0,
    last: null,
    grinding: false,
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
      colors: [0x8fa7a0, 0x768f88, 0x58706a],
      mats: {
        wheelM: [0xbcb6a2, 0.95, 0],
        rubber: [0x4d4a48, 0.9, 0],
        pin: [0x9aa1a8, 0.35, 0.8],
        pinG: [0xe3e7ea, 0.2, 0.9],
        pinB: [0x5a4a8e, 0.35, 0.7],
      },
      name: L('Bezhrotová brúska TOS Hostivař BBJ 6', 'TOS Hostivař BBJ 6 centreless grinder'),
      sound: 'grinder',
      debugKey: '__bbj',
      build: (x) => buildBbj(x),
    });
  }, []);
  const parts = bbjParts();
  const vf = throughFeed(ui.alpha, BBJ.speedsR[ui.nR]);
  const statusMsg = tele.msg
    ? tele.msg
    : !ui.power
      ? { kind: 'warn', text: L('Hlavný vypínač je vypnutý.', 'The main switch is off.') }
      : tele.grinding
        ? {
            kind: 'run',
            text: `${L('Priebežné brúsenie', 'Throughfeed grinding')} – v ${tele.vf.toFixed(1)} mm/s, ${L('medzera', 'gap')} ${tele.gap.toFixed(3)} mm`,
          }
        : {
            kind: 'idle',
            text: L(
              'Nastav výšku podpery a naklopenie, spusti oba kotúče a vlož kolík do žľabu.',
              'Set the rest height and the tilt, start both wheels and put a pin into the chute.',
            ),
          };
  const chips = [
    {
      color: tele.gw > 5 ? '#3ee06c' : '#8b8f89',
      text: tele.gw > 5 ? L('Brúsny beží', 'Grinding wheel on') : L('Brúsny stojí', 'Grinding wheel off'),
    },
    {
      color: tele.rw > 1 ? '#3ee06c' : '#8b8f89',
      text:
        tele.rw > 1
          ? `${L('Podávací', 'Regulating')} ${Math.round(tele.rw)} ${RPM()}`
          : L('Podávací stojí', 'Regulating off'),
    },
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
            'Výsledný priemer určuje medzera medzi kotúčmi – zmenšuj ju po stotinách a kolíky vracaj na ďalší prechod.',
            'The finished diameter is set by the gap between the wheels – reduce it in hundredths and return the pins for another pass.',
          ),
        ]}
      />
      <aside className="panel">
        <fieldset className="machine-settings" disabled={ui.unclamped}>
          <PanelHeader
            ui={ui}
            set={set}
            kicker={L('Simulátor · brúska', 'Simulator · grinder')}
            title={L('Bezhrotová brúska', 'Centreless grinder')}
            sub={L(
              'Predloha: TOS Hostivař BBJ 6 – priemer brúsenia do 63 mm, brúsny kotúč Ø500, podávací Ø250. Mierka 1 : 100 mm.',
              'Modelled after the TOS Hostivař BBJ 6 – grinding diameter up to 63 mm, Ø500 grinding wheel, Ø250 regulating wheel. Scale 1 : 100 mm.',
            )}
            rows={[
              [L('Medzera', 'Gap'), tele.gap.toFixed(3)],
              ['α', `${tele.alpha.toFixed(1)}°`],
              ['h', `${tele.h.toFixed(1)}`],
            ]}
            foot={[
              `v ${vf.toFixed(1)} mm/s`,
              tele.last ? `${L('posledný', 'last')} Ø${tele.last.d.toFixed(3)} / ${tele.last.round.toFixed(3)}` : '—',
            ]}
            status={statusMsg}
          />
          <TaskSection
            machine="bezhrot"
            tasks={BBJ_TASKS}
            apiRef={apiRef}
            params={params}
            status={statusMsg}
            onSetup={() => apiRef.current.newBlank?.()}
            safety={{ ui, set, runKey: 'gw', items: BBJ_SAFETY() }}
          />
          <div className="sec">
            <h2 className="sec-title mb-2">{L('Kotúče', 'Wheels')}</h2>
            <Toggle on={ui.power} label={L('Hlavný vypínač', 'Main switch')} onClick={() => set('power', !ui.power)} />
            <Toggle on={ui.gw} label={L('Brúsny kotúč', 'Grinding wheel')} onClick={() => set('gw', !ui.gw)} />
            <Toggle on={ui.rw} label={L('Podávací kotúč', 'Regulating wheel')} onClick={() => set('rw', !ui.rw)} />
            <Toggle on={ui.coolant} label={L('Chladenie', 'Coolant')} onClick={() => set('coolant', !ui.coolant)} />
            <SegRow
              label={L('Otáčky podávacieho', 'Regulating speed')}
              value={ui.nR}
              options={BBJ.speedsR.map((n, i) => [i, String(n)])}
              onChange={(i) => set('nR', i)}
            />
          </div>
          <div className="sec">
            <div className="section-heading">
              <h2 className="sec-title mb-2">{L('Nastavenie', 'Setup')}</h2>
              <SectionInfo title={L('Bezhrotové brúsenie', 'Centreless grinding')}>
                <p className="text-xs muted">
                  {L(
                    'Kolík nemá hroty – vedú ho kotúče a podpera. Ak leží stred kolíka na spojnici osí, nerovnosti sa kopírujú a vzniká mnohohran.',
                    'The pin has no centres – it is guided by the wheels and the rest. If its centre lies on the line of wheel centres, the errors copy and lobes form.',
                  )}
                </p>
              </SectionInfo>
            </div>
            <Slider
              id="bjg"
              label={L('Medzera kotúčov (priemer)', 'Wheel gap (diameter)')}
              unit="mm"
              min={19.5}
              max={21}
              step={0.002}
              value={ui.gap}
              actual={tele.gap}
              digits={3}
              onChange={(v) => set('gap', v)}
            />
            <Slider
              id="bja"
              label={L('Naklopenie podávacieho kotúča α', 'Regulating wheel tilt α')}
              unit="°"
              min={0}
              max={6}
              step={0.25}
              value={ui.alpha}
              actual={tele.alpha}
              digits={2}
              onChange={(v) => set('alpha', v)}
              disabled={ui.rw}
            />
            <Slider
              id="bjh"
              label={L('Výška stredu nad spojnicou osí h', 'Centre height above the centre line h')}
              unit="mm"
              min={-4}
              max={20}
              step={0.5}
              value={ui.h}
              actual={tele.h}
              digits={1}
              onChange={(v) => set('h', v)}
              disabled={ui.gw || ui.rw}
            />
            <div className="flex gap-2 mt-2">
              <button type="button" className="btn flex-1" onClick={() => apiRef.current.feedPin?.()}>
                {L('Vložiť kolík', 'Feed a pin')}
              </button>
              <button type="button" className="btn flex-1" onClick={() => apiRef.current.refeed?.()}>
                {L('Vrátiť kolíky na prechod', 'Return pins for a pass')}
              </button>
            </div>
            <p className="text-xs muted mt-2">{L(`Prebrúsené: ${tele.n} kolíkov.`, `Ground: ${tele.n} pins.`)}</p>
          </div>
          <ExportSection machine="bezhrot" apiRef={apiRef} canSave={false} />
          <ViewSection
            apiRef={apiRef}
            views={[
              ['celok', L('Celok', 'Overview')],
              ['rez', L('Medzi kotúčmi', 'Between the wheels')],
              ['spredu', L('Spredu', 'Front')],
            ]}
          />
          <PartsSection parts={parts} selected={selected} selectPart={selectPart} />
          <HelpFooter apiRef={apiRef} ui={ui} />
        </fieldset>
      </aside>
    </div>
  );
}

function buildBbj(x) {
  const { kit, det, M, grp, v3, c, st, ctrl, push, pend, say, sayOnce, needPower, anchors, views, apiRef } = x;
  const { add, box, cylZ, ball, handwheel } = kit;
  const { rbox, ribs, nameplate, oilGlass, cable } = det;
  // ---------- lôžko ----------
  const bed = grp('lozko');
  rbox(bed, -6.5, 6.5, 0, 6.0, -2.4, 2.4, M.green, 0.22);
  ribs(bed, 'x', -6, 6, 6, 0.5, 5.5, 2.4, 0.08, 0.12, M.greenDark);
  rbox(bed, -6.6, 6.6, 6.0, 6.3, -2.6, 2.6, M.greenDark, 0.08);
  nameplate(bed, -4.6, 4.6, 2.49, 0, 'TOS Hostivař', 'BBJ 6', 1.1);
  oilGlass(bed, 4.8, 1.2, 2.48);
  // ---------- brúsny vreteník ----------
  const gwG = grp('brusny');
  rbox(gwG, -6.4, -3.2, 6.3, 12.0, -1.6, 1.6, M.green, 0.2);
  const gSpin = new THREE.Group();
  gSpin.position.set(-(RG + D0 / 200), AY, 0);
  gwG.add(gSpin);
  cylZ(gSpin, RG, RG, -WW / 2, WW / 2, 0, 0, M.wheelM, 72);
  cylZ(gSpin, 0.6, 0.6, -WW / 2 - 0.05, WW / 2 + 0.05, 0, 0, M.steel, 24);
  box(gSpin, -0.06, 0.06, 1.0, 1.6, WW / 2 + 0.01, WW / 2 + 0.03, M.black);
  // ---------- podávací kotúč na saniach ----------
  const rwG = grp('podavaci');
  const slide = new THREE.Group();
  rwG.add(slide);
  rbox(slide, 2.4, 6.2, 6.3, 7.2, -1.8, 1.8, M.greenDark, 0.1);
  rbox(slide, 3.2, 6.2, 7.2, 11.2, -1.4, 1.4, M.green, 0.18);
  const tiltG = new THREE.Group(); // naklopenie okolo vodorovnej osi X
  tiltG.position.set(RR + D0 / 200, AY, 0);
  slide.add(tiltG);
  const rSpin = new THREE.Group();
  tiltG.add(rSpin);
  cylZ(rSpin, RR, RR, -WW / 2, WW / 2, 0, 0, M.rubber, 64);
  cylZ(rSpin, 0.35, 0.35, -WW / 2 - 0.05, WW / 2 + 0.05, 0, 0, M.steel, 20);
  box(rSpin, -0.05, 0.05, 0.6, 1.1, WW / 2 + 0.01, WW / 2 + 0.03, M.white);
  const aTx = angleScaleTex(6, 5, { numR: 0.72, step: 2, len: 0.14 });
  if (aTx) {
    const sc = add(
      slide,
      new THREE.CircleGeometry(0.45, 48),
      new THREE.MeshStandardMaterial({ map: aTx, roughness: 0.4, metalness: 0.4 }),
      4.7,
      10.2,
      1.41,
    );
    sc.userData.noMerge = true;
    sc.castShadow = false;
  }
  const wGap = handwheel(rwG, 0.55, 6.85, 6.8, 0, 'x', 0.32); // prísuv (medzera)
  const wAlpha = handwheel(slide, 0.22, 4.7, 10.2, 1.52, 'z', 0.12); // naklopenie α
  // ---------- podpera a žľab ----------
  const rest = grp('podpera');
  const blade = new THREE.Group();
  rest.add(blade);
  rbox(rest, -0.6, 0.6, 6.3, AY - 1.4, -2.2, 2.2, M.steelDark, 0.06);
  rbox(blade, -0.08, 0.08, AY - 1.4, AY - 0.15, -2.6, 2.6, M.steel, 0.02);
  const wH = handwheel(rest, 0.2, 0, 7.1, 2.35, 'z', 0.1); // výška podpery
  // vstupný žľab a debna na hotové kolíky
  rbox(rest, -0.25, 0.25, AY - 0.4, AY - 0.3, 2.6, 4.2, M.steelDark, 0.02);
  const chute = new THREE.Group();
  chute.position.set(0, AY + 0.1, 3.8);
  rest.add(chute);
  kit.hitProxy(chute, 0.45, 0, 0, 0);
  box(chute, -0.3, 0.3, -0.05, 0.05, -0.4, 0.4, M.yellow);
  const bin = new THREE.Group();
  bin.position.set(0, 4.0, -3.4);
  rest.add(bin);
  rbox(bin, -1.0, 1.0, 0, 0.9, -0.7, 0.7, M.steelDark, 0.05);
  kit.hitProxy(bin, 0.8, 0, 0.5, 0);
  // ---------- panel ----------
  const pan = grp('ovladanie', bed);
  rbox(pan, -2.0, 1.8, 3.4, 5.6, 2.4, 2.5, M.panel, 0.04);
  const mSw = mainSwitch(kit, M, pan, -1.4, 5.0, 2.51);
  const bG = panelButton(kit, M, pan, -0.6, 5.0, 2.51, M.btnGreen),
    bGs = panelButton(kit, M, pan, -0.6, 4.4, 2.51, M.red),
    bR = panelButton(kit, M, pan, 0.2, 5.0, 2.51, M.btnGreen),
    bRs = panelButton(kit, M, pan, 0.2, 4.4, 2.51, M.red),
    bC = panelButton(kit, M, pan, 1.0, 5.0, 2.51, M.blue);
  const lampG = M.lamp.clone(),
    lampR = M.lamp.clone();
  ball(pan, 0.06, -0.6, 3.85, 2.52, lampG);
  ball(pan, 0.06, 0.2, 3.85, 2.52, lampR);
  cable(bed, [
    [1.8, 3.6, 2.45],
    [2.4, 2.0, 2.6],
    [2.6, 0.2, 2.8],
  ]);
  // ---------- kolíky ----------
  const pinsG = grp('obrobok');
  const pinGeo = new THREE.CylinderGeometry(1, 1, 1, 24);
  pinGeo.rotateX(Math.PI / 2);
  const pins = [],
    done = [];
  const pinMesh = (p) => {
    const m = new THREE.Mesh(pinGeo, p.burn ? M.pinB : p.passes ? M.pinG : M.pin);
    m.scale.set(p.d / 200, p.d / 200, 1.0);
    m.castShadow = true;
    m.userData.part = 'obrobok';
    pinsG.add(m);
    return m;
  };
  Object.assign(st, { gw: 0, rw: 0, ag: 0, ar: 0, gap: c.gap, alpha: c.alpha, h: c.h, grindT: -9, last: null });
  const place = () => {
    slide.position.x = (st.gap - D0) / 200;
    tiltG.rotation.x = (st.alpha * Math.PI) / 180;
    blade.position.y = st.h / 100;
  };
  place();
  Object.assign(anchors, {
    lozko: () => v3(-6.5, 3.0, 2.4),
    brusny: () => v3(-RG - 0.2, AY + RG, 0),
    podavaci: () => v3(RR + 0.4, AY + RR, 0),
    podpera: () => v3(0, AY - 0.15, 2.6),
    obrobok: () => v3(0, AY + 0.3, 3.8),
    ovladanie: () => v3(-0.1, 5.6, 2.5),
  });
  Object.assign(views, {
    celok: () => [
      [8, 15, 16],
      [0, 8.0, 0],
    ],
    rez: () => [[0, AY + 0.4, 5.5], [0, AY, 0], true],
    spredu: () => [[0, AY + 2, 12], [0, AY - 1, 0], true],
  });
  const stopped = () => !c.gw && !c.rw && st.gw < 1 && st.rw < 1;
  const startG = needPower(() => {
    if (!apiRef.current.safetyGate || apiRef.current.safetyGate.ok()) push('gw', true);
    else apiRef.current.safetyGate.request();
  });
  apiRef.current.feedPin = () => {
    if (pins.some((p) => p.z > 2.0))
      return say(
        L(
          'Žľab je obsadený – počkaj, kým kolík vojde medzi kotúče.',
          'The chute is occupied – wait until the pin enters between the wheels.',
        ),
      );
    const p = { z: 3.8, d: D0, passes: 0, round: 0.02, burn: false };
    p.m = pinMesh(p);
    pins.push(p);
  };
  apiRef.current.refeed = () => {
    if (!done.length) return say(L('V debne nie sú kolíky.', 'No pins in the bin.'));
    const p = done.shift();
    p.z = 3.8;
    p.m.position.set(0, 0, 0);
    pins.push(p);
    return true;
  };
  apiRef.current.newBlank = () => {
    [...pins, ...done].forEach((p) => pinsG.remove(p.m));
    pins.length = 0;
    done.length = 0;
    st.last = null;
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
        if (!i) {
          push('gw', false);
          push('rw', false);
        }
      },
      read: () => (c.power ? 'I' : '0'),
    },
    mSw,
  );
  ctrl.reg(
    {
      type: 'button',
      label: LL('ŠTART brúsneho kotúča', 'Grinding wheel START'),
      hint: LL('Roztočí brúsny kotúč.', 'Starts the grinding wheel.'),
      action: startG,
    },
    bG,
  );
  ctrl.reg(
    {
      type: 'button',
      label: LL('STOP brúsneho kotúča', 'Grinding wheel STOP'),
      hint: LL('Zastaví brúsny kotúč.', 'Stops the grinding wheel.'),
      action: () => push('gw', false),
    },
    bGs,
  );
  ctrl.reg(
    {
      type: 'button',
      label: LL('ŠTART podávacieho kotúča', 'Regulating wheel START'),
      hint: LL(
        'Roztočí podávací kotúč – kolíky začnú prechádzať.',
        'Starts the regulating wheel – the pins start passing through.',
      ),
      action: needPower(() => push('rw', true)),
    },
    bR,
  );
  ctrl.reg(
    {
      type: 'button',
      label: LL('STOP podávacieho kotúča', 'Regulating wheel STOP'),
      hint: LL('Zastaví podávací kotúč.', 'Stops the regulating wheel.'),
      action: () => push('rw', false),
    },
    bRs,
  );
  ctrl.reg(
    {
      type: 'button',
      label: LL('Chladenie', 'Coolant'),
      hint: LL('Zapne alebo vypne chladenie.', 'Switches the coolant on or off.'),
      action: () => push('coolant', !c.coolant),
    },
    bC,
  );
  ctrl.reg(
    {
      type: 'button',
      still: true,
      label: LL('Vstupný žľab', 'Feed chute'),
      hint: LL('Vloží kolík Ø20,3 do žľabu.', 'Puts a Ø20.3 pin into the chute.'),
      action: () => apiRef.current.feedPin(),
    },
    chute,
  );
  ctrl.reg(
    {
      type: 'button',
      still: true,
      label: LL('Debna s kolíkmi', 'Pin bin'),
      hint: LL(
        'Vráti prvý kolík z debny do žľabu na ďalší prechod.',
        'Returns the first pin from the bin to the chute for another pass.',
      ),
      action: () => apiRef.current.refeed(),
    },
    bin,
  );
  ctrl.reg(
    {
      type: 'wheel',
      minR: 0.3,
      inc: -1,
      label: LL('Koleso prísuvu podávacieho kotúča', 'Regulating slide handwheel'),
      hint: LL(
        'Mení medzeru = výsledný priemer. 1 otáčka = 0,1 mm, dielik 0,002 mm.',
        'Changes the gap = finished diameter. 1 turn = 0.1 mm, one division 0.002 mm.',
      ),
      turn: (d) => push('gap', clamp(Math.round((c.gap - (d / TAU) * 0.1) * 1000) / 1000, 19.5, 21)),
      read: () => `${st.gap.toFixed(3)} mm`,
    },
    wGap,
  );
  ctrl.reg(
    {
      type: 'wheel',
      minR: 0.12,
      inc: 1,
      label: LL('Naklopenie podávacieho kotúča', 'Regulating wheel tilt'),
      hint: LL(
        '1 otáčka = 1°, len pri stojacom podávacom kotúči.',
        '1 turn = 1°, only with the regulating wheel stopped.',
      ),
      guard: () =>
        (!c.rw && st.rw < 1) ||
        (say(
          L(
            'Naklopenie sa mení len pri stojacom podávacom kotúči.',
            'The tilt is changed only with the regulating wheel stopped.',
          ),
        ),
        false),
      turn: (d) => push('alpha', clamp(Math.round((c.alpha + d / TAU) * 4) / 4, 0, 6)),
      read: () => `${st.alpha.toFixed(2)}°`,
    },
    wAlpha,
  );
  ctrl.reg(
    {
      type: 'wheel',
      minR: 0.1,
      inc: 1,
      label: LL('Výška podpery', 'Work rest height'),
      hint: LL(
        'Výška stredu kolíka nad spojnicou osí. 1 otáčka = 2 mm, len pri stojacich kotúčoch.',
        'Height of the pin centre above the centre line. 1 turn = 2 mm, wheels stopped only.',
      ),
      guard: () =>
        stopped() ||
        (say(L('Podpera sa nastavuje len pri stojacich kotúčoch.', 'The rest is set only with the wheels stopped.')),
        false),
      turn: (d) => push('h', clamp(Math.round((c.h + (d / TAU) * 2) * 2) / 2, -4, 20)),
      read: () => `h ${st.h.toFixed(1)} mm`,
    },
    wH,
  );
  // ---------- slučka ----------
  const update = (dt, t) => {
    if (!c.power) {
      if (c.gw) push('gw', false);
      if (c.rw) push('rw', false);
    }
    st.gw = approach(st.gw, c.gw ? 1500 : 0, 1500 * dt);
    st.rw = approach(st.rw, c.rw ? BBJ.speedsR[c.nR] : 0, 60 * dt);
    st.ag += (st.gw / 60) * TAU * dt * 0.04;
    st.ar += (st.rw / 60) * TAU * dt;
    gSpin.rotation.z = st.ag;
    rSpin.rotation.z = st.ar;
    st.gap = approach(st.gap, c.gap, 0.2 * dt);
    if (!c.rw && st.rw < 1) st.alpha = approach(st.alpha, c.alpha, 2 * dt);
    else if (c.alpha !== st.alpha) {
      c.alpha = st.alpha;
      pend.alpha = st.alpha;
    }
    if (stopped()) st.h = approach(st.h, c.h, 10 * dt);
    else if (c.h !== st.h) {
      c.h = st.h;
      pend.h = st.h;
    }
    place();
    const vf = st.rw > 1 ? (throughFeed(st.alpha, st.rw) * c.timeScale) / 100 : 0;
    const yC = (p) => AY + st.h / 100 + (p.d - D0) / 200;
    for (let i = pins.length - 1; i >= 0; i--) {
      const p = pins[i];
      const before = p.z;
      // žľab: kolík sa sám posunie k vstupu kotúčov
      if (p.z > WW / 2 + 0.05) p.z = Math.max(WW / 2 + 0.05, p.z - 0.8 * dt);
      if (p.z <= WW / 2 + 0.05 + 1e-6) {
        const entering = p.z >= WW / 2;
        if (vf > 0) {
          if (entering && st.gap < p.d - 1e-6 && st.gw < 100) {
            sayOnce(
              'jam',
              true,
              L(
                'Kolík sa zasekol – brúsny kotúč stojí. Spusti brúsny kotúč.',
                'The pin jammed – the grinding wheel is stopped. Start the grinding wheel.',
              ),
              'danger',
            );
          } else p.z -= vf * dt;
        } else if (entering && c.rw && st.alpha <= 0)
          sayOnce(
            'alpha0',
            true,
            L(
              'Pri naklopení 0° kolík neprechádza – nastav naklopenie 2 – 4°.',
              'At 0° tilt the pin does not pass through – set a 2 – 4° tilt.',
            ),
            'warn',
          );
      }
      // prechod cez stred kotúčov: brúsenie
      if (before >= 0 && p.z < 0 && !p.thisPass) {
        p.thisPass = true;
        const r = grindPass(p.d, st.gap, st.h);
        if (r.cut > 0) {
          p.d = r.d;
          p.passes++;
          p.round = r.round;
          if (r.heavy) {
            p.burn = true;
            say(
              L(
                'Príliš veľký úber na prechod – kolík sa prepálil. Uber najviac 0,1 mm na prechod.',
                'Too much removed in one pass – the pin burnt. Remove at most 0.1 mm per pass.',
              ),
              'danger',
            );
          }
          if (!c.coolant)
            sayOnce(
              'cool',
              true,
              L('Brúsiš bez chladenia – zapni chladenie.', 'Grinding without coolant – switch the coolant on.'),
              'warn',
            );
          if (r.round > 0.008)
            sayOnce(
              'lobe',
              true,
              L(
                'Kolík nie je guľatý (mnohohran) – zvýš výšku podpery nad spojnicu osí (≈ d/2).',
                'The pin is out of round (lobed) – raise the rest above the centre line (≈ d/2).',
              ),
              'warn',
            );
          st.grindT = t;
          st.last = { d: p.d, round: p.round };
          pinsG.remove(p.m);
          p.m = pinMesh(p);
        }
      }
      if (p.z < -WW / 2 - 0.2) {
        // pád do debny
        p.thisPass = false;
        pins.splice(i, 1);
        done.push(p);
        p.m.position.set(
          (Math.random() - 0.5) * 1.2,
          4.5 + 0.1 * (done.length % 5),
          -3.4 + (Math.random() - 0.5) * 0.6,
        );
        continue;
      }
      p.m.position.set(0, yC(p), p.z);
      p.m.rotation.z = -st.ar * (BBJ.dR / p.d);
    }
    lampG.emissive.setHex(st.gw > 100 ? 0x22dd55 : 0);
    lampR.emissive.setHex(st.rw > 1 ? 0x22dd55 : 0);
    wGap.rotation.z = (-st.gap / 0.1) * TAU;
    wAlpha.rotation.z = st.alpha * TAU;
    wH.rotation.z = (st.h / 2) * TAU;
  };
  return {
    update,
    tele: () => ({
      gw: st.gw,
      rw: st.rw,
      gap: st.gap,
      alpha: st.alpha,
      h: st.h,
      vf: st.rw > 1 ? throughFeed(st.alpha, st.rw) : 0,
      n: done.filter((p) => p.passes).length,
      last: st.last,
      grinding: x.time() - st.grindT < 1.5,
    }),
    measure: () => ({ info: pinsInfo([...done, ...pins]) }),
    sound: () => ({ motor: st.gw / 1500, grind: x.time() - st.grindT < 0.4 ? 0.8 : 0 }),
  };
}

export { BbjSimulator };
export default BbjSimulator;
