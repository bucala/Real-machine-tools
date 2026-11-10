import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { L, LL } from '../core/i18n';
import { TAU, approach, clamp } from '../core/util';
import { ExportSection, TaskSection } from '../ui/tools';
import { SectionInfo } from '../ui/sectionInfo';
import { ForgeDrawing } from '../ui/sketch2';
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
import { FORGE, KHZ, blank, blow, bucharChecks, bucharTask, cool, heat, turn } from './bucharMath';

// =====================================================================
// KOVACÍ BUCHAR ŠMERAL KHZ 2 – zúžený rám s oknom, baran z valca hore, plynová pec, kliešte
// =====================================================================
// mierka 1 = 100 mm; os baranu x = 0, z = 0; obsluha stojí vpredu (+z), pec je vľavo.
const DIE = 9.4, // horná plocha spodného kovadla
  REST = DIE + KHZ.stroke / 100, // spodok baranu v hornej polohe
  FX = -7.6, // os pece
  FY = 7.2, // dno pracovného priestoru pece
  ZB = 0.5; // os obrobku pred osou baranu (kliešte idú dopredu)

const bucharParts = () =>
  mkParts([
    [
      'ram',
      'Rám',
      'Frame',
      'Liatinový rám so šabotou',
      'Cast frame with anvil block',
      'Zúžený rám s pracovným oknom nesie vedenie baranu, dole je šabota so spodným kovadlom. Predloha: Šmeral KHZ 2 – energia úderu 20 kJ, baran 920 kg, zdvih 400 mm, 60 úderov/min.',
      'The tapered frame with the working window carries the ram guides, the anvil block with the lower die is at the bottom. Model: Šmeral KHZ 2 – blow energy 20 kJ, ram 920 kg, stroke 400 mm, 60 blows/min.',
    ],
    [
      'baran',
      'Baran',
      'Ram',
      'Baran s horným kovadlom',
      'Ram with upper die',
      'Baran zdvíha hydraulický valec hore na ráme. Pedálom sa spustí jeden úder; energiu určuje zdvih baranu nastavený voličom.',
      'The ram is lifted by the hydraulic cylinder on top of the frame. The pedal releases one blow; the energy depends on the ram lift set on the selector.',
    ],
    [
      'pec',
      'Pec',
      'Furnace',
      'Plynová kovacia pec',
      'Gas forging furnace',
      'Obrobok sa ohrieva na kovaciu teplotu 1 200 °C. Nad ≈ 1 280 °C sa oceľ spáli (oxiduje po hraniciach zŕn) a je na odpad.',
      'The work is heated to the forging temperature of 1,200 °C. Above ≈ 1,280 °C the steel burns (oxidises along the grain boundaries) and is scrap.',
    ],
    [
      'obrobok',
      'Obrobok',
      'Workpiece',
      'Hranol 60 × 60 × 120 v kliešťach',
      'Bar 60 × 60 × 120 in tongs',
      'Oceľový hranol sa drží kliešťami. Kuje sa medzi 1 200 a 850 °C – pod 850 °C sa už nesmie kovať, pod 750 °C praská.',
      'The steel bar is held in tongs. Forge between 1,200 and 850 °C – no forging below 850 °C, below 750 °C it cracks.',
    ],
    [
      'ovladanie',
      'Ovládanie',
      'Controls',
      'Ovládacie stojany a pedál',
      'Control stands and pedal',
      'Vpravo hlavný vypínač, čerpadlo a volič energie úderu, vľavo tlakomery hydrauliky, na zemi pedál úderu.',
      'Right: main switch, pump and the blow-energy selector, left: hydraulic pressure gauges, on the floor the blow pedal.',
    ],
  ]);

const mkTask = (id, title, desc, drawing) => {
  const t = bucharTask(id);
  const labels = {
    h: () => `${L('Hrúbka', 'Thickness')} ${t.h} ±${t.th} mm`,
    w: () => `${L('Šírka', 'Width')} ${t.w} ±${t.tw} mm`,
    cold: () => L('Žiadne údery pod 850 °C', 'No blows below 850 °C'),
    crack: () => L('Bez trhlín', 'No cracks'),
    burn: () => L('Materiál nespálený', 'Steel not burnt'),
  };
  return {
    id,
    title,
    desc,
    setup: {},
    drawing,
    checks: (m) => bucharChecks[id](m).map((c) => ({ ...c, label: labels[c.key]() })),
  };
};
const BUCHAR_TASKS = [
  mkTask(
    'plochy',
    () => L('Plochá tyč 40 × 60', 'Flat bar 40 × 60'),
    () =>
      L(
        'Ohrej hranol 60 × 60 × 120 v peci na ≈ 1 200 °C, prelož ho na kovadlo a slabšími údermi skuj na hrúbku 40 ±1 mm. Šírka sa pri kovaní rozširuje – keď presiahne 63 mm, hranol otoč o 90° a šírku stiahni späť. Pod 850 °C prestaň a ohrej ho znova.',
        'Heat the 60 × 60 × 120 bar in the furnace to ≈ 1,200 °C, move it to the anvil and forge it with lighter blows to a thickness of 40 ±1 mm. The width spreads while forging – when it exceeds 63 mm, turn the bar 90° and bring the width back. Below 850 °C stop and reheat.',
      ),
    () => <ForgeDrawing a={60} h={40} w={60} L0={120} tw="±3" />,
  ),
  mkTask(
    'stvorec',
    () => L('Predĺženie na štvorec 40 × 40', 'Draw out to a 40 × 40 square'),
    () =>
      L(
        'Hranol 60 × 60 predĺž na štvorec 40 × 40 ±1 mm: kuj striedavo na dvoch susedných stranách (po každých pár úderoch otoč o 90°), aby prierez ostal štvorcový. Podľa potreby ohrievaj v peci.',
        'Draw the 60 × 60 bar out to a 40 × 40 ±1 mm square: forge alternately on two adjacent faces (turn 90° every few blows) so the section stays square. Reheat in the furnace as needed.',
      ),
    () => <ForgeDrawing a={60} h={40} w={40} L0={120} tw="±1" />,
  ),
];

const BUCHAR_SAFETY = () => [
  L(
    'Mám kovačskú zásteru, rukavice, štít a pevnú obuv; okolo bucharu nikto nestojí.',
    'I wear a forging apron, gloves, a face shield and safety shoes; nobody stands around the hammer.',
  ),
  L(
    'Kliešte pevne držia obrobok a nikdy ich nemám pred telom – pri údere môžu odskočiť.',
    'The tongs grip the work firmly and are never in front of my body – they can kick back on a blow.',
  ),
  L(
    'Neudieram naprázdno (kovadlo na kovadlo) a nekujem studený materiál.',
    'I never strike die on die and never forge cold material.',
  ),
];

// farba žeravej ocele podľa teploty
const glowColor = (T, out) => {
  const st = [
    [450, 0x6d7276, 0],
    [600, 0x4a1a10, 0x2a0400],
    [750, 0x7a1408, 0x6a0800],
    [900, 0xb83010, 0xc02200],
    [1050, 0xe86a18, 0xff5a00],
    [1200, 0xffb040, 0xffa020],
    [1300, 0xffe8a8, 0xfff0c0],
  ];
  if (T <= st[0][0]) return (out.color.setHex(st[0][1]), out.emissive.setHex(0), (out.emissiveIntensity = 0));
  for (let i = 1; i < st.length; i++)
    if (T <= st[i][0] || i === st.length - 1) {
      const k = clamp((T - st[i - 1][0]) / (st[i][0] - st[i - 1][0]), 0, 1),
        a = new THREE.Color(st[i - 1][1]),
        b = new THREE.Color(st[i][1]);
      out.color.copy(a.lerp(b, k));
      out.emissive.copy(new THREE.Color(st[i - 1][2]).lerp(new THREE.Color(st[i][2]), k));
      out.emissiveIntensity = 0.6 + k * 0.6;
      return;
    }
};

function BucharSimulator({ onBack, params }) {
  const mountRef = useRef(null),
    layerRef = useRef(null),
    tipRef = useRef(null);
  const init = { power: true, running: false, lev: 1, door: false, Tf: 1220, light: true, manual: false };
  const { ctl, ui, setUi, set, selected, selectPart, apiRef } = useMachine(init);
  const [tele, setTele] = useTele({ T: 20, Tfur: 20, b: blank(), at: 'pec', pump: 0, blows: 0, cold: 0, msg: null });
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
      colors: [0x8fc48c, 0x77ab76, 0x5d8c5d],
      mats: {
        hot: new THREE.MeshStandardMaterial({ color: 0x6d7276, roughness: 0.6, metalness: 0.4 }),
        brick: [0x9b5a3c, 0.9, 0],
        fire: new THREE.MeshBasicMaterial({ color: 0xff8a2a, toneMapped: false }),
        die: [0x4b5055, 0.45, 0.7],
        spark: new THREE.MeshBasicMaterial({ color: 0xffb347, toneMapped: false }),
      },
      name: L('Kovací buchar Šmeral KHZ 2', 'Šmeral KHZ 2 forging hammer'),
      sound: 'hammer',
      debugKey: '__buchar',
      orbitOptions: { maxDistance: 80, maxTargetY: 30 },
      build: (x) => buildBuchar(x),
    });
  }, []);
  const parts = bucharParts();
  const act = (k, v) => apiRef.current.act?.[k]?.(v);
  const T = tele.T,
    tCol = T >= FORGE.cold ? '#3ee06c' : T >= FORGE.crack ? '#ff8a1f' : '#8b8f89';
  const statusMsg = tele.msg
    ? tele.msg
    : !ui.power
      ? { kind: 'warn', text: L('Hlavný vypínač je vypnutý.', 'The main switch is off.') }
      : tele.at === 'pec'
        ? { kind: 'idle', text: `${L('Obrobok v peci', 'Work in the furnace')} – ${Math.round(T)} °C` }
        : tele.at === 'kovadlo' && T >= FORGE.cold
          ? { kind: 'run', text: `${L('Kuj – teplota', 'Forge – temperature')} ${Math.round(T)} °C` }
          : tele.at === 'kovadlo'
            ? {
                kind: 'warn',
                text: `${Math.round(T)} °C – ${L('príliš studený, vráť ho do pece', 'too cold, return it to the furnace')}`,
              }
            : { kind: 'idle', text: L('Kliešte prenášajú obrobok.', 'The tongs carry the work.') };
  const chips = [
    {
      color: tele.pump > 0.5 ? '#3ee06c' : '#8b8f89',
      text: tele.pump > 0.5 ? L('čerpadlo beží', 'pump running') : L('čerpadlo stojí', 'pump stopped'),
    },
    { color: tCol, text: `${Math.round(T)} °C` },
    { color: '#7fb6ff', text: `${Math.round(KHZ.levels[ui.lev] * 100)} % ${L('energie', 'energy')}` },
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
            'Klik na rukoväť klieští prenesie obrobok medzi pecou a kovadlom, klik na obrobok na kovadle ho otočí o 90°, pedál spustí úder.',
            'Click the tong handles to carry the work between the furnace and the anvil, click the work on the anvil to turn it 90°, the pedal releases a blow.',
          ),
        ]}
      />
      <aside className="panel">
        <fieldset className="machine-settings" disabled={ui.unclamped}>
          <PanelHeader
            ui={ui}
            set={set}
            kicker={L('Simulátor · kovanie', 'Simulator · forging')}
            title={L('Kovací buchar', 'Forging hammer')}
            sub={L(
              'Predloha: Šmeral KHZ 2 – energia úderu 20 kJ, baran 920 kg, zdvih 400 mm, 60 úderov/min. Ploché kovadlá na voľné kovanie, ohrev v peci je zrýchlený. Mierka 1 : 100 mm.',
              'Modelled after the Šmeral KHZ 2 – blow energy 20 kJ, ram 920 kg, stroke 400 mm, 60 blows/min. Flat dies for open-die forging, furnace heating is sped up. Scale 1 : 100 mm.',
            )}
            rows={[
              [L('Hrúbka', 'Thick.'), tele.b.h.toFixed(1)],
              [L('Šírka', 'Width'), tele.b.w.toFixed(1)],
              [L('Dĺžka', 'Length'), tele.b.L.toFixed(0)],
            ]}
            foot={[`${Math.round(T)} °C`, `${tele.blows} ${L('úderov', 'blows')}`]}
            status={statusMsg}
          />
          <TaskSection
            machine="buchar"
            tasks={BUCHAR_TASKS}
            apiRef={apiRef}
            params={params}
            status={statusMsg}
            onSetup={() => apiRef.current.newBlank?.()}
            safety={{ ui, set, runKey: 'running', items: BUCHAR_SAFETY() }}
          />
          <div className="sec">
            <h2 className="sec-title mb-2">{L('Buchar', 'Hammer')}</h2>
            <button type="button" className="btn-run w-full" onClick={() => apiRef.current.toggleRun?.()}>
              {ui.running ? L('■ Stop čerpadla', '■ Stop pump') : L('▶ Štart čerpadla', '▶ Start pump')}
            </button>
            <Toggle on={ui.power} label={L('Hlavný vypínač', 'Main switch')} onClick={() => set('power', !ui.power)} />
            <SegRow
              label={L('Energia úderu', 'Blow energy')}
              value={ui.lev}
              options={KHZ.levels.map((v, i) => [i, `${Math.round(v * 100)} %`])}
              onChange={(i) => set('lev', i)}
            />
            <div className="flex gap-2 mt-2">
              <button type="button" className="btn flex-1" onClick={() => act('blow')}>
                {L('Úder (pedál)', 'Blow (pedal)')}
              </button>
              <button type="button" className="btn flex-1" onClick={() => act('turn')}>
                {L('Otočiť o 90°', 'Turn 90°')}
              </button>
            </div>
          </div>
          <div className="sec">
            <div className="section-heading">
              <h2 className="sec-title mb-2">{L('Pec a kliešte', 'Furnace and tongs')}</h2>
              <SectionInfo title={L('Kovacia teplota', 'Forging temperature')}>
                <p className="text-xs muted">
                  {L(
                    'Uhlíková oceľ sa kuje medzi 1 200 a 850 °C (žltá až svetločervená). Pod 850 °C (tmavočervená) materiál tvrdne a praská, nad ≈ 1 280 °C sa spáli.',
                    'Carbon steel is forged between 1,200 and 850 °C (yellow to bright red). Below 850 °C (dark red) it hardens and cracks, above ≈ 1,280 °C it burns.',
                  )}
                </p>
              </SectionInfo>
            </div>
            <Slider
              id="buTf"
              label={L('Teplota pece', 'Furnace temperature')}
              unit="°C"
              min={900}
              max={1350}
              step={10}
              value={ui.Tf}
              digits={0}
              onChange={(v) => set('Tf', v)}
            />
            <Toggle on={ui.door} label={L('Dvierka pece otvorené', 'Furnace door open')} onClick={() => act('door')} />
            <div className="flex gap-2 mt-2">
              <button type="button" className="btn flex-1" onClick={() => act('move')}>
                {tele.at === 'pec'
                  ? L('Vybrať na kovadlo', 'Take to the anvil')
                  : L('Vložiť do pece', 'Put into the furnace')}
              </button>
              <button type="button" className="btn flex-1" onClick={() => apiRef.current.newBlank?.()}>
                {L('Nový polotovar', 'New blank')}
              </button>
            </div>
          </div>
          <ExportSection machine="buchar" apiRef={apiRef} canSave={false} />
          <ViewSection
            apiRef={apiRef}
            views={[
              ['celok', L('Celok', 'Overview')],
              ['kovadlo', L('Kovadlo', 'Anvil')],
              ['pec', L('Pec', 'Furnace')],
            ]}
          />
          <PartsSection parts={parts} selected={selected} selectPart={selectPart} />
          <HelpFooter apiRef={apiRef} ui={ui} />
        </fieldset>
      </aside>
    </div>
  );
}

function buildBuchar(x) {
  const { kit, det, M, grp, v3, c, st, ctrl, push, say, sayOnce, needPower, anchors, views, apiRef } = x;
  const { add, box, cylX, cylY, cylZ, ball, handwheel } = kit;
  const { rbox, nameplate, cable, bolts } = det;
  // ---------- rám: zúžený profil s pracovným oknom (x–y), vytiahnutý v z ----------
  const fr = grp('ram');
  const prof = new THREE.Shape();
  // tvar A: široká päta, zúženie k valcu (podľa fotiek)
  prof.moveTo(-3.6, 0.6);
  prof.lineTo(3.6, 0.6);
  prof.lineTo(3.5, 2.0);
  prof.quadraticCurveTo(2.2, 3.5, 2.0, 7.0);
  prof.lineTo(1.5, 17.5);
  prof.quadraticCurveTo(1.4, 19.5, 1.0, 20.0);
  prof.lineTo(-1.0, 20.0);
  prof.quadraticCurveTo(-1.4, 19.5, -1.5, 17.5);
  prof.lineTo(-2.0, 7.0);
  prof.quadraticCurveTo(-2.2, 3.5, -3.5, 2.0);
  prof.closePath();
  const win = new THREE.Path();
  win.moveTo(-0.66, DIE - 0.45);
  win.lineTo(0.66, DIE - 0.45);
  win.lineTo(0.66, 15.6);
  win.lineTo(-0.66, 15.6);
  win.closePath();
  prof.holes.push(win);
  const fg = new THREE.ExtrudeGeometry(prof, {
    depth: 2.6,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.1,
    bevelSegments: 2,
    curveSegments: 16,
  });
  fg.translate(0, 0, -1.5);
  add(fr, fg, M.green).castShadow = true;
  rbox(fr, -3.6, 3.6, 0, 0.62, -1.9, 1.9, M.greenDeep, 0.08); // päta na základe
  [-3.3, 3.3].forEach((xx) => [-1.6, 1.6].forEach((zz) => cylY(fr, 0.18, 0.18, 0.62, 0.9, xx, zz, M.steelDark, 6)));
  // šabota a spodné kovadlo v okne
  rbox(fr, -0.66, 0.66, DIE - 0.45, DIE - 0.2, -1.3, 1.3, M.die, 0.03);
  rbox(fr, -0.55, 0.55, DIE - 0.2, DIE, -1.0, 1.0, M.die, 0.02);
  // vedenie baranu (lišty po stranách okna)
  [-0.6, 0.6].forEach((xx) => rbox(fr, xx - 0.08, xx + 0.08, DIE + 0.2, 15.5, -0.95, 0.95, M.steel, 0.02));
  bolts(
    fr,
    [-1.0, 1.0].flatMap((xx) => [10.5, 12.5, 14.5].map((y) => [xx, y])),
    1.38,
    0.08,
  );
  // valec na vrchu rámu s kopulou a okom
  cylY(fr, 1.0, 1.0, 20.0, 24.2, 0, 0, M.green, 40);
  ball(fr, 1.0, 0, 24.2, 0, M.green).scale.y = 0.4;
  add(fr, new THREE.TorusGeometry(0.22, 0.07, 8, 20), M.steelDark, 0, 24.75, 0);
  cylY(fr, 1.1, 1.1, 19.8, 20.2, 0, 0, M.greenDark, 40); // príruba valca
  nameplate(fr, 0, 17.3, 1.61, 0, 'ŠMERAL', 'KHZ 2', 1.0);
  // hydraulické rozvody a akumulátor vpravo
  cylY(fr, 0.32, 0.32, 0.62, 7.0, 4.2, -0.8, M.steelDark, 20);
  ball(fr, 0.32, 4.2, 7.0, -0.8, M.steelDark);
  cable(
    fr,
    [
      [4.2, 7.0, -0.8],
      [2.6, 9.0, -1.65],
      [1.75, 12.0, -1.65],
      [1.45, 18.0, -1.6],
      [0.6, 20.5, -0.9],
    ],
    0.07,
    M.black,
  );
  cable(
    fr,
    [
      [-3.0, 1.6, 1.65],
      [-1.95, 9.0, 1.65],
      [-1.6, 16.0, 1.62],
      [-0.7, 20.5, 0.8],
    ],
    0.06,
    M.black,
  );
  // ---------- baran ----------
  const ramG = grp('baran', fr);
  const ram = new THREE.Group();
  ramG.add(ram);
  rbox(ram, -0.5, 0.5, 0.2, 2.1, -0.85, 0.85, M.steelDark, 0.04);
  for (let k = 0; k < 4; k++) {
    const sb = box(ram, -0.5, 0.5, 0.6 + k * 0.3, 0.75 + k * 0.3, 0.86, 0.87, k % 2 ? M.black : M.yellow); // výstražné pruhy
    sb.rotation.z = 0.5;
    sb.scale.x = 0.9;
  }
  rbox(ram, -0.55, 0.55, 0, 0.2, -1.0, 1.0, M.die, 0.02); // horné kovadlo
  cylY(ram, 0.2, 0.2, 2.1, 8.0, 0, 0, M.ways, 20); // piestnica do valca
  // ---------- plynová pec vľavo ----------
  const fu = grp('pec');
  rbox(fu, FX - 2.0, FX + 2.0, 0, FY - 0.6, -1.6, 1.6, M.greenDark, 0.08);
  rbox(fu, FX - 2.1, FX + 2.1, FY - 0.6, FY + 2.6, -1.7, 1.7, M.brick, 0.12);
  rbox(fu, FX - 2.2, FX + 2.2, FY + 2.6, FY + 3.0, -1.8, 1.8, M.steelDark, 0.06);
  const mouth = add(fu, new THREE.PlaneGeometry(2.0, 1.4), M.fire, FX, FY + 0.75, 1.71);
  mouth.userData.noMerge = true;
  cylY(fu, 0.25, 0.25, FY + 3.0, FY + 6.0, FX + 1.2, -0.8, M.steelDark, 16); // komín
  [-1.2, 1.2].forEach((xx) => cylX(fu, 0.12, 0.12, FX + xx - 0.3, FX + xx + 0.3, FY + 2.2, -1.75, M.steel, 10)); // horáky
  // dvierka (posúvajú sa nahor)
  const door = new THREE.Group();
  door.position.set(FX, FY - 0.05, 1.78);
  fu.add(door);
  rbox(door, -1.15, 1.15, 0, 1.6, 0, 0.18, M.steelDark, 0.04);
  rbox(door, -0.9, 0.9, 0.2, 1.4, 0.18, 0.22, M.brick, 0.02);
  cylX(door, 0.06, 0.06, -0.5, 0.5, 0.8, 0.32, M.black, 10);
  kit.hitProxy(door, 0.6, 0, 0.8, 0.35);
  // regulátor teploty a ukazovateľ (pyrometer) na čele pece
  const fp = new THREE.Group();
  fp.position.set(FX + 1.55, FY - 2.4, 1.61);
  fu.add(fp);
  rbox(fp, -0.4, 0.4, -0.6, 0.9, 0, 0.08, M.panel, 0.03);
  const gauge = new THREE.Group();
  gauge.position.set(0, 0.45, 0.09);
  fp.add(gauge);
  cylZ(gauge, 0.28, 0.28, 0, 0.03, 0, 0, M.white, 32);
  const gPtr = new THREE.Group();
  gPtr.position.z = 0.04;
  gauge.add(gPtr);
  box(gPtr, -0.012, 0.012, 0, 0.24, 0, 0.01, M.red);
  const wTf = handwheel(fp, 0.17, 0, -0.25, 0.12, 'z', 0.08);
  // ---------- obrobok a kliešte ----------
  const work = grp('obrobok');
  const billet = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), M.hot);
  billet.castShadow = true;
  billet.userData.part = 'obrobok';
  billet.userData.noMerge = true;
  billet.userData.controlPassThrough = true;
  work.add(billet);
  const turnGrip = new THREE.Group();
  work.add(turnGrip);
  kit.hitProxy(turnGrip, 0.42, 0, 0, 0);
  const tongs = new THREE.Group();
  work.add(tongs);
  [-0.08, 0.08].forEach((dx) => {
    const r = kit.rod(tongs, v3(dx, 0.05, 0), v3(dx * 3, 0.15, 7.0), 0.05, M.black, 8);
    r.castShadow = true;
  });
  const tHandle = new THREE.Group();
  tHandle.position.set(0, 0.15, 7.0);
  tongs.add(tHandle);
  cylX(tHandle, 0.08, 0.08, -0.35, 0.35, 0, 0, M.steelDark, 10);
  kit.hitProxy(tHandle, 0.5, 0, 0, 0);
  // ---------- ovládanie: stojan vpravo, tlakomery vľavo, pedál ----------
  const pan = grp('ovladanie');
  rbox(pan, 3.0, 3.8, 0, 9.0, 1.2, 2.0, M.green, 0.06);
  const face = new THREE.Group();
  face.position.set(3.4, 0, 2.01);
  pan.add(face);
  rbox(face, -0.45, 0.45, 6.4, 8.8, 0, 0.06, M.panel, 0.03);
  const mSw = mainSwitch(kit, M, face, 0, 8.3, 0.07);
  const bStart = panelButton(kit, M, face, -0.2, 7.6, 0.07, M.btnGreen, 0.1),
    bStop = panelButton(kit, M, face, 0.2, 7.6, 0.07, M.red, 0.1);
  const lampRun = M.lamp.clone();
  ball(face, 0.05, 0, 7.2, 0.08, lampRun);
  const levE = kit.pivotLever(face, 0, 6.75, 0.07, 0.4, 0);
  rbox(pan, -3.8, -3.0, 0, 8.4, 1.2, 2.0, M.green, 0.06);
  [7.6, 6.8].forEach((y) => {
    const g = new THREE.Group();
    g.position.set(-3.4, y, 2.02);
    pan.add(g);
    cylZ(g, 0.25, 0.25, 0, 0.06, 0, 0, M.steelDark, 24);
    cylZ(g, 0.21, 0.21, 0.06, 0.07, 0, 0, M.white, 24);
    box(g, -0.01, 0.01, 0, 0.18, 0.07, 0.08, M.red).rotation.z = -0.6;
  });
  cable(pan, [
    [3.4, 0.2, 1.6],
    [2.6, 0.15, 0.9],
    [2.2, 1.6, 0.6],
  ]);
  // pedál na podlahe pred bucharom
  const pedal = new THREE.Group();
  pedal.position.set(1.4, 0.0, 3.0);
  pan.add(pedal);
  rbox(pedal, -0.4, 0.4, 0, 0.16, -0.5, 0.5, M.steelDark, 0.04);
  const ped = new THREE.Group();
  ped.position.set(0, 0.2, -0.35);
  pedal.add(ped);
  rbox(ped, -0.3, 0.3, 0, 0.06, 0, 0.8, M.black, 0.02);
  kit.hitProxy(pedal, 0.55, 0, 0.3, 0);
  cable(
    pan,
    [
      [1.4, 0.1, 2.5],
      [2.2, 0.1, 1.9],
      [3.0, 0.4, 1.6],
    ],
    0.04,
    M.black,
  );
  const sparks = [],
    sparkG = new THREE.Group();
  x.scene.add(sparkG);
  // ---------- stav ----------
  Object.assign(st, {
    pump: 0,
    T: 20,
    Tfur: 20,
    b: blank(),
    at: 'pec',
    mv: null,
    door: 0,
    blowT: -1,
    impacted: false,
    blows: 0,
    cold: 0,
    crack: false,
    burnt: false,
    dry: 0,
    hitT: -9,
  });
  const posAt = (at, b = st.b) => (at === 'pec' ? v3(FX, FY + b.h / 200, ZB - 0.6) : v3(0, DIE + b.h / 200, ZB));
  const ramBottom = (k) => {
    // k: 0 hore, 1 dopad na obrobok (alebo kovadlo)
    const hit = st.at === 'kovadlo' ? DIE + st.b.h / 100 : DIE;
    return REST + (hit - REST) * k;
  };
  const place = () => {
    billet.scale.set(st.b.w / 100, st.b.h / 100, st.b.L / 100);
    let p = posAt(st.at);
    if (st.mv) {
      const k = st.mv.k,
        a = posAt(st.mv.from),
        b = posAt(st.mv.to);
      p = a.lerp(b, k);
      p.y += Math.sin(k * Math.PI) * 1.2;
    }
    work.position.copy(p);
    billet.position.set(0, 0, 0);
    tongs.position.set(0, 0, st.b.L / 200 - 0.15);
    turnGrip.position.set(0, st.b.h / 200 + 0.05, 0);
    turnGrip.visible = st.at === 'kovadlo' && !st.mv; // otáča sa len na kovadle
    door.position.y = FY - 0.05 + st.door * 1.7;
    const k = st.blowT < 0 ? 0 : st.blowT < 0.35 ? (st.blowT / 0.35) ** 2 : 1 - (st.blowT - 0.35) / 0.65;
    ram.position.y = ramBottom(clamp(k, 0, 1));
    gPtr.rotation.z = 2.2 - (clamp(st.Tfur, 0, 1400) / 1400) * 4.4;
    wTf.rotation.z = ((c.Tf - 900) / 50) * TAU;
    levE.rotation.z = 0.6 - c.lev * 0.3;
    mSw.rotation.z = c.power ? -Math.PI / 2 : 0;
    ped.rotation.x = st.blowT >= 0 && st.blowT < 0.4 ? 0.18 : 0;
  };
  place();
  Object.assign(anchors, {
    ram: () => v3(-1.4, 17.5, 1.6),
    baran: () => v3(0.5, ram.position.y + 2.4, 0.9),
    pec: () => v3(FX, FY + 3.0, 1.8),
    obrobok: () => work.position.clone().add(v3(0, 0.4, 0)),
    ovladanie: () => v3(3.4, 8.8, 2.0),
  });
  Object.assign(views, {
    celok: () => [
      [14, 19, 30],
      [-2.6, 12.0, 0],
    ],
    kovadlo: () => [[2.2, DIE + 2.2, 5.0], [0, DIE + 0.4, ZB], true],
    pec: () => [[FX + 2.5, FY + 3.0, 6.5], [FX, FY + 0.7, 0.5], true],
  });
  const start = needPower(() => {
    if (!apiRef.current.safetyGate || apiRef.current.safetyGate.ok()) push('running', true);
    else apiRef.current.safetyGate.request();
  });
  apiRef.current.toggleRun = () => (c.running ? push('running', false) : start());
  const act = {
    blow: () => {
      if (!c.power) return say(L('Najprv zapni hlavný vypínač.', 'Switch on the main switch first.'));
      if (st.pump < 0.9) return say(L('Spusti hydraulické čerpadlo.', 'Start the hydraulic pump.'));
      if (st.blowT >= 0) return;
      if (st.mv) return say(L('Obrobok sa práve prenáša.', 'The work is being moved.'));
      st.blowT = 0;
      st.impacted = false;
    },
    turn: () => {
      if (st.at !== 'kovadlo' || st.mv) return say(L('Otáča sa obrobok na kovadle.', 'Turn the work on the anvil.'));
      if (st.blowT >= 0) return;
      st.b = turn(st.b);
    },
    move: () => {
      if (st.mv || st.blowT >= 0) return;
      if (!c.door) return say(L('Otvor dvierka pece.', 'Open the furnace door.'));
      if (st.door < 0.9) return;
      st.mv = { from: st.at, to: st.at === 'pec' ? 'kovadlo' : 'pec', k: 0 };
      st.at = 'move';
    },
    door: () => {
      if (st.mv) return;
      push('door', !c.door);
    },
  };
  apiRef.current.act = act;
  apiRef.current.newBlank = () => {
    if (st.mv || st.blowT >= 0) return false;
    Object.assign(st, { T: 20, b: blank(), at: 'pec', blows: 0, cold: 0, crack: false, burnt: false, dry: 0 });
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
      label: LL('ŠTART čerpadla', 'Pump START'),
      hint: LL(
        'Spustí hydraulické čerpadlo – baran sa zdvihne do hornej polohy.',
        'Starts the hydraulic pump – the ram rises to the top position.',
      ),
      action: start,
    },
    bStart,
  );
  ctrl.reg(
    {
      type: 'button',
      label: LL('STOP', 'STOP'),
      hint: LL('Zastaví čerpadlo.', 'Stops the pump.'),
      action: () => push('running', false),
    },
    bStop,
  );
  const eAng = KHZ.levels.map((_, i) => 0.6 - i * 0.3);
  ctrl.reg(
    {
      type: 'lever',
      angles: eAng,
      minR: 0.18,
      label: LL('Volič energie úderu', 'Blow energy selector'),
      hint: LL(
        'Zdvih baranu pred úderom – 5 % je ľahký úder na rovnanie, 100 % plný úder.',
        'Ram lift before the blow – 5 % is a light planishing blow, 100 % a full blow.',
      ),
      getIdx: () => c.lev,
      onSet: (i) => push('lev', i),
      read: () => `${Math.round(KHZ.levels[c.lev] * 100)} %`,
    },
    levE,
  );
  ctrl.reg(
    {
      type: 'button',
      label: LL('Pedál úderu', 'Blow pedal'),
      hint: LL('Jeden úder baranu so zvolenou energiou.', 'One ram blow with the selected energy.'),
      action: () => act.blow(),
    },
    pedal,
  );
  ctrl.reg(
    {
      type: 'button',
      still: true,
      label: LL('Dvierka pece', 'Furnace door'),
      hint: LL(
        'Otvorí alebo zatvorí dvierka – pri zatvorených pec hreje rýchlejšie.',
        'Opens or closes the door – closed, the furnace heats faster.',
      ),
      action: () => act.door(),
      read: () => (c.door ? L('otvorené', 'open') : L('zatvorené', 'closed')),
    },
    door,
  );
  ctrl.reg(
    {
      type: 'wheel',
      minR: 0.1,
      inc: 1,
      label: LL('Regulátor teploty pece', 'Furnace temperature controller'),
      hint: LL('1 otáčka = 50 °C. Kovacia teplota ≈ 1 200 °C.', '1 turn = 50 °C. Forging temperature ≈ 1,200 °C.'),
      turn: (d) => push('Tf', clamp(Math.round((c.Tf + (d / TAU) * 50) / 10) * 10, 900, 1350)),
      read: () => `${c.Tf} °C (${Math.round(st.Tfur)} °C)`,
    },
    wTf,
  );
  ctrl.reg(
    {
      type: 'button',
      still: true,
      label: LL('Kliešte', 'Tongs'),
      hint: LL(
        'Prenesie obrobok z pece na kovadlo alebo späť (dvierka musia byť otvorené).',
        'Carries the work from the furnace to the anvil or back (the door must be open).',
      ),
      action: () => act.move(),
      read: () => `${Math.round(st.T)} °C`,
    },
    tHandle,
  );
  ctrl.reg(
    {
      type: 'button',
      still: true,
      label: LL('Obrobok – otočiť o 90°', 'Work – turn 90°'),
      hint: LL(
        'Kliešťami otočí hranol na kovadle o 90° okolo dlhej osi.',
        'Turns the bar on the anvil 90° about its long axis with the tongs.',
      ),
      action: () => act.turn(),
      read: () => `${st.b.h.toFixed(1)} × ${st.b.w.toFixed(1)} mm`,
    },
    turnGrip,
  );
  // ---------- slučka ----------
  const update = (dt, t) => {
    if (!c.power && c.running) push('running', false);
    st.pump = approach(st.pump, c.running && c.power ? 1 : 0, 1.5 * dt);
    st.door = approach(st.door, c.door ? 1 : 0, 1.5 * dt);
    // pec: teplota priestoru sleduje regulátor, pri otvorených dvierkach pomalšie
    st.Tfur = approach(st.Tfur, c.Tf, (c.door ? 20 : 60) * dt);
    const thin = Math.min(st.b.h, st.b.w);
    if (st.at === 'pec') st.T = heat(st.T, dt * (c.door ? 0.4 : 1), thin, st.Tfur);
    else st.T = cool(st.T, dt, thin);
    if (st.T > FORGE.burn && !st.burnt) {
      st.burnt = true;
      say(
        L(
          'Oceľ sa v peci spálila – je na odpad! Nastav pec na ≈ 1 200 °C.',
          'The steel burnt in the furnace – it is scrap! Set the furnace to ≈ 1,200 °C.',
        ),
        'danger',
      );
    }
    sayOnce(
      'ready',
      st.at === 'pec' && st.T >= 1150,
      L(
        'Obrobok má kovaciu teplotu – vyber ho na kovadlo.',
        'The work is at forging temperature – take it to the anvil.',
      ),
      'info',
    );
    sayOnce(
      'cool',
      st.at === 'kovadlo' && st.T < FORGE.cold,
      L('Obrobok vychladol pod 850 °C – vráť ho do pece.', 'The work cooled below 850 °C – return it to the furnace.'),
      'warn',
    );
    // prenášanie kliešťami
    if (st.mv) {
      st.mv.k = Math.min(1, st.mv.k + dt / 1.2);
      if (st.mv.k >= 1) {
        st.at = st.mv.to;
        st.mv = null;
      }
    }
    // úder
    if (st.blowT >= 0) {
      const prev = st.blowT;
      st.blowT += dt / 0.6;
      if (prev < 0.35 && st.blowT >= 0.35 && !st.impacted) {
        st.impacted = true;
        st.hitT = t;
        if (st.at === 'kovadlo') {
          st.blows++;
          if (st.T < FORGE.crack) {
            st.crack = true;
            say(L('Obrobok praskol – kovaný príliš studený!', 'The work cracked – forged too cold!'), 'danger');
          } else if (st.T < FORGE.cold) {
            st.cold++;
            say(
              L('Úder za studena (pod 850 °C) – hrozí trhlina!', 'Cold blow (below 850 °C) – risk of cracking!'),
              'warn',
            );
          }
          if (!st.crack) {
            const r = blow(st.b, c.lev, st.T);
            st.b = { h: r.h, w: r.w, L: r.L };
          }
          for (let k = 0; k < 14 && sparks.length < 120; k++) {
            const sp = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.04), M.spark);
            sp.position.set((Math.random() - 0.5) * 0.4, DIE + st.b.h / 100, ZB + (Math.random() - 0.5) * 0.6);
            sparkG.add(sp);
            sparks.push({
              m: sp,
              v: v3((Math.random() - 0.5) * 6, 1 + Math.random() * 3, (Math.random() - 0.2) * 5),
              life: 0.6,
            });
          }
        } else {
          st.dry++;
          say(
            L('Úder naprázdno – kovadlo na kovadlo poškodzuje buchar!', 'Dry blow – die on die damages the hammer!'),
            'danger',
          );
        }
      }
      if (st.blowT >= 1) st.blowT = -1;
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
    glowColor(st.T, M.hot);
    if (st.crack) M.hot.color.multiplyScalar(0.8);
    M.fire.color.setHex(st.Tfur > 1000 ? 0xffa040 : st.Tfur > 700 ? 0xd04010 : 0x3a1a10);
    lampRun.emissive.setHex(st.pump > 0.5 ? 0x22dd55 : 0);
    place();
  };
  return {
    update,
    tele: () => ({
      T: st.T,
      Tfur: st.Tfur,
      b: { ...st.b },
      at: st.mv ? 'move' : st.at,
      pump: st.pump,
      blows: st.blows,
      cold: st.cold,
    }),
    measure: () => ({ b: { ...st.b }, cold: st.cold, crack: st.crack, burnt: st.burnt, dry: st.dry }),
    sound: () => ({ motor: st.pump * 0.6, cut: x.time() - st.hitT < 0.15 ? 1 : 0 }),
  };
}

export { BucharSimulator };
export default BucharSimulator;
