// Frézka: React panel a hlavný komponent; scéna je v millScene.js, dáta a úlohy v millData.jsx.
import { SectionInfo } from '../ui/sectionInfo';
import { useEffect, useRef } from 'react';
import { L, RPM } from '../core/i18n';
import { DIVISIONS, indexPlan } from './millIndex';
import { CutCalc, ExportSection, TaskSection } from '../ui/tools';
import {
  BlankSection,
  GEAR_LOCK,
  HelpFooter,
  PanelHeader,
  PartsSection,
  SceneView,
  SegRow,
  Slider,
  StepSelect,
  Toggle,
  ViewSection,
  useMachine,
  useTele,
} from '../ui/common';
import {
  MILL_FEEDS,
  MILL_SAFETY,
  MILL_SPEEDS,
  MILL_TASKS,
  MILL_TOOLS,
  MILL_TOOL_LIST,
  millParts,
  millToolName,
} from './millData';
import { createMillScene } from './millScene';

// =====================================================================
// UNIVERZÁLNA FRÉZA TOS FA 3 B
// =====================================================================
function MillSimulator({ onBack, params }) {
  const mountRef = useRef(null),
    layerRef = useRef(null),
    tipRef = useRef(null);
  const init = {
    running: false,
    power: true,
    coolant: false,
    light: true,
    manual: false,
    rpm: 400,
    x: 400,
    y: 120,
    z: 150,
    feedDir: 0,
    feed: 118,
    timeScale: 10,
    tool: 'end20',
    quill: 0,
    quillLock: false,
    kneeLock: false,
    sadLock: false,
    bShape: 'block',
    bL: 180,
    bW: 100,
    bH: 60,
    bD: 60,
    probe: false,
    px: 90,
    pz: 50,
    hold: 'vise',
    tail: true,
    divZ: 6,
    divLock: true,
  };
  const { ctl, ui, setUi, set, selected, selectPart, apiRef } = useMachine(init);
  const [tele, setTele] = useTele({
    rpm: 0,
    x: 400,
    y: 120,
    z: 150,
    q: 0,
    vc: 0,
    vf: 0,
    msg: null,
    cutting: false,
    depth: 0,
    tool: 'end20',
    changing: false,
    hold: 'vise',
    idx: 0,
    phi: 0,
    indexing: false,
  });

  useEffect(() => createMillScene({ apiRef, ctl, layerRef, mountRef, setTele, setUi, tipRef }), []);

  const parts = millParts();
  const statusMsg = tele.msg
    ? tele.msg
    : ui.unclamped
      ? {
          kind: 'info',
          text: L('Polotovar je odopnutý a vybratý zo zveráka.', 'The workpiece is unclamped and out of the vise.'),
        }
      : tele.cutting
        ? {
            kind: 'run',
            text: `${L('Frézovanie – hĺbka', 'Milling – depth')} ${tele.depth.toFixed(1)} mm ${L('pod pôvodnou plochou', 'below the original surface')}, vc ${tele.vc.toFixed(0)} m/min`,
          }
        : tele.rpm > 15
          ? {
              kind: 'run',
              text: L(
                'Vreteno beží. Zdvihni konzolu (Z) k fréze a posúvaj stôl.',
                'The spindle is running. Raise the knee (Z) to the cutter and move the table.',
              ),
            }
          : !ui.power
            ? {
                kind: 'warn',
                text: L(
                  'Hlavný vypínač je vypnutý – stroj je bez napätia.',
                  'The main switch is off – the machine is de-energised.',
                ),
              }
            : {
                kind: 'idle',
                text: L(
                  'Stroj stojí. Spusti vreteno a priveď obrobok k fréze.',
                  'The machine is stopped. Start the spindle and bring the workpiece to the cutter.',
                ),
              };
  const running = ui.running;
  const chips = [
    {
      color: tele.rpm > 15 ? '#3ee06c' : '#8b8f89',
      text: tele.rpm > 15 ? `${Math.round(tele.rpm)} ${RPM()}` : L('Vreteno stojí', 'Spindle stopped'),
    },
  ];
  if (tele.cutting) chips.push({ color: '#ffb340', text: L('Rez', 'Cutting') });
  if (tele.vf) chips.push({ color: '#7fb6ff', text: `${L('Posuv', 'Feed')} ${tele.vf} mm/min` });
  if (ui.coolant && ui.power) chips.push({ color: '#8fd0ff', text: L('Chladenie', 'Coolant') });
  const kinds = [
    ['end', L('Stopková', 'End mill')],
    ['ball', L('Guľová', 'Ball-nose')],
    ['face', L('Čelná', 'Face mill')],
  ];
  const curKind = MILL_TOOLS[ui.tool].kind;
  const stopped = !ui.running && tele.rpm <= 1;
  const setupTask = (task) => {
    const su = task.setup;
    if (!stopped) return;
    set('hold', su.hold || 'vise');
    ['bShape', 'bL', 'bW', 'bH', 'bD', 'tail', 'divZ'].forEach((k) => {
      if (su[k] !== undefined) set(k, su[k]);
    });
    const r = apiRef.current.newBlank && apiRef.current.newBlank();
    if (r) Object.entries(r).forEach(([k, v]) => set(k, v));
    set('z', Math.min(ui.z, 150));
    set('tool', su.tool);
    set('rpm', su.rpm);
  };
  const pinfo = ui.probe && apiRef.current.measure ? apiRef.current.measure().info : null;

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
      />
      <aside className="panel">
        <fieldset className="machine-settings" disabled={ui.unclamped}>
          <PanelHeader
            ui={ui}
            set={set}
            kicker={L('Simulátor · fréza', 'Simulator · milling machine')}
            title={L('Univerzálna konzolová fréza', 'Universal knee-type milling machine')}
            sub={L(
              'Predloha: TOS FA 3 B so sklopnou vertikálnou hlavou. Mierka 1 : 100 mm.',
              'Modelled after the TOS FA 3 B with a swivelling vertical head. Scale 1 : 100 mm.',
            )}
            rows={[
              ['X', tele.x.toFixed(2)],
              ['Y', tele.y.toFixed(2)],
              ['Z', tele.z.toFixed(2)],
            ]}
            foot={[
              `n ${Math.round(tele.rpm)} ${RPM()}`,
              `vf ${tele.vf} mm/min`,
              `${L('pinola', 'quill')} ${tele.q.toFixed(1)}`,
            ]}
            status={statusMsg}
          />

          <TaskSection
            machine="freza"
            tasks={MILL_TASKS}
            apiRef={apiRef}
            params={params}
            status={statusMsg}
            onSetup={setupTask}
            safety={{ ui, set, runKey: 'running', items: MILL_SAFETY() }}
          />

          <div className="sec">
            <h2 className="sec-title mb-2">{L('Hlavný chod', 'Main drive')}</h2>
            <button
              type="button"
              className={`btn-run ${running ? 'stop' : 'start'}`}
              onClick={() => {
                if (!running && !ui.power) set('power', true);
                set('running', !running);
              }}
            >
              {running ? L('■ Stop vretena', '■ Stop spindle') : L('▶ Štart vretena', '▶ Start spindle')}
            </button>
            <div className="mt-2">
              <Toggle
                on={ui.power}
                label={L('Hlavný vypínač', 'Main switch')}
                onClick={() => {
                  const v = !ui.power;
                  set('power', v);
                  if (!v) set('running', false);
                }}
              />
              <Toggle on={ui.coolant} label={L('Chladenie', 'Coolant')} onClick={() => set('coolant', !ui.coolant)} />
              <Toggle
                on={ui.light}
                label={L('Pracovné osvetlenie', 'Work light')}
                onClick={() => set('light', !ui.light)}
              />
            </div>
            <div className="mt-3">
              <StepSelect
                id="mrpm"
                label={L('Otáčky vretena', 'Spindle speed')}
                unit={RPM()}
                values={MILL_SPEEDS}
                value={ui.rpm}
                onChange={(v) => set('rpm', v)}
                locked={ui.running || tele.rpm > 1}
                lockNote={GEAR_LOCK()}
              />
              <CutCalc
                D={MILL_TOOLS[ui.tool].d}
                mat="steel"
                speeds={MILL_SPEEDS}
                rpm={ui.rpm}
                locked={!stopped}
                onApply={(n) => set('rpm', n)}
                what={L('Priemer frézy', 'Cutter diameter')}
              />
            </div>
          </div>

          <div className="sec">
            <div className="section-heading">
              <h2 className="sec-title mb-2">{L('Nástroj', 'Tool')}</h2>
              <SectionInfo title={L('Nástroj', 'Tool')}>
                <p>
                  {L(
                    'Nástroj sa mení len pri stojacom vretene a mimo obrobku. Odporúčané vc pre oceľ: 25 – 35 m/min (HSS), 120 – 180 m/min (SK).',
                    'Tools are changed only with the spindle stopped and clear of the work. Recommended vc for steel: 25 – 35 m/min (HSS), 120 – 180 m/min (carbide).',
                  )}
                </p>
              </SectionInfo>
            </div>
            <SegRow
              label={L('Druh', 'Type')}
              value={curKind}
              options={kinds}
              onChange={(k) => {
                const first =
                  MILL_TOOL_LIST.find((x) => x.kind === k && x.d === (k === 'face' ? 63 : k === 'ball' ? 10 : 20)) ||
                  MILL_TOOL_LIST.find((x) => x.kind === k);
                set('tool', first.id);
              }}
            />
            <div className="flex flex-wrap gap-1.5 mb-2">
              {MILL_TOOL_LIST.filter((x) => x.kind === curKind).map((x) => (
                <button
                  key={x.id}
                  type="button"
                  className={`btn ${ui.tool === x.id ? 'active' : ''}`}
                  aria-pressed={ui.tool === x.id}
                  onClick={() => set('tool', x.id)}
                >
                  Ø{x.d}
                </button>
              ))}
            </div>
            <p className="text-xs muted">
              {L('Upnutá', 'Clamped')}: <b className="ink">{millToolName(MILL_TOOLS[tele.tool])}</b>
              {tele.changing ? ` · ${L('výmena…', 'changing…')}` : ''}
            </p>
          </div>

          <div className="sec">
            <div className="section-heading">
              <h2 className="sec-title mb-2">{L('Posuvy', 'Feeds')}</h2>
              <SectionInfo title={L('Posuvy', 'Feeds')}>
                <p className="text-xs muted">
                  {L(
                    'Automatický posuv stola beží len pri otáčajúcom sa vretene. Pri X = 400 a Y = 120 je os frézy nad stredom 100 mm širokého obrobku.',
                    'The table power feed only runs while the spindle turns. At X = 400 and Y = 120 the cutter axis is above the centre of a 100 mm wide workpiece.',
                  )}
                </p>
              </SectionInfo>
            </div>
            <Slider
              id="mx"
              label={L('Stôl pozdĺžne X', 'Table X')}
              unit="mm"
              min={0}
              max={800}
              step={1}
              value={ui.x}
              actual={tele.x}
              onChange={(v) => set('x', v)}
            />
            <Slider
              id="my"
              label={L('Sane priečne Y', 'Saddle Y')}
              unit="mm"
              min={0}
              max={300}
              step={0.5}
              value={ui.y}
              actual={tele.y}
              digits={1}
              onChange={(v) => set('y', v)}
            />
            <Slider
              id="mz"
              label={L('Konzola zvisle Z', 'Knee Z')}
              unit="mm"
              min={0}
              max={420}
              step={0.5}
              value={ui.z}
              actual={tele.z}
              digits={1}
              onChange={(v) => set('z', v)}
            />
            <Slider
              id="mq"
              label={L('Výsuv pinoly', 'Quill extension')}
              unit="mm"
              min={0}
              max={80}
              step={0.1}
              value={ui.quill}
              actual={tele.q}
              digits={1}
              onChange={(v) => set('quill', v)}
            />
            <Toggle
              on={ui.kneeLock}
              label={L('Konzola zaistená', 'Knee clamped')}
              onClick={() => set('kneeLock', !ui.kneeLock)}
            />
            <Toggle
              on={ui.sadLock}
              label={L('Sane zaistené', 'Saddle clamped')}
              onClick={() => set('sadLock', !ui.sadLock)}
            />
            <Toggle
              on={ui.quillLock}
              label={L('Pinola zaistená', 'Quill locked')}
              onClick={() => set('quillLock', !ui.quillLock)}
            />
            <div className="mb-3" />
            <SegRow
              label={L('Posuv stola', 'Table feed')}
              value={ui.feedDir}
              options={[
                [-1, L('← Vľavo', '← Left')],
                [0, 'Stop'],
                [1, L('Vpravo →', 'Right →')],
              ]}
              onChange={(v) => set('feedDir', v)}
            />
            <StepSelect
              id="mfeed"
              label={L('Rýchlosť posuvu', 'Feed rate')}
              unit="mm/min"
              values={MILL_FEEDS}
              value={ui.feed}
              onChange={(v) => set('feed', v)}
              fmt={(v) => L(String(v).replace('.', ','), String(v))}
            />
            <SegRow
              label={L('Zrýchlenie posuvu', 'Feed acceleration')}
              value={ui.timeScale}
              options={[
                [1, '1×'],
                [10, '10×'],
                [50, '50×'],
              ]}
              onChange={(v) => set('timeScale', v)}
            />
          </div>

          <div className="sec">
            <div className="section-heading">
              <h2 className="sec-title mb-2">{L('Meranie', 'Measuring')}</h2>
              <SectionInfo title={L('Meranie', 'Measuring')}>
                <p>
                  {L(
                    'Hĺbkomer meria úber oproti pôvodnej hornej ploche polotovaru. Polohu merania zvoľ posuvníkmi.',
                    'The depth gauge measures removal relative to the original top face of the blank. Select the measuring position with the sliders.',
                  )}
                </p>
                {pinfo && (
                  <>
                    <p className="text-xs muted mt-2">
                      {L(
                        `Hĺbka pod pôvodnou hornou plochou. Sieť merania ${pinfo.dX.toFixed(1).replace('.', ',')} × ${pinfo.dZ.toFixed(1).replace('.', ',')} mm.`,
                        `Depth below the original top surface. Measuring grid ${pinfo.dX.toFixed(1)} × ${pinfo.dZ.toFixed(1)} mm.`,
                      )}
                    </p>
                  </>
                )}
              </SectionInfo>
            </div>
            <Toggle
              on={ui.probe}
              label={L('Hĺbkomer na obrobku', 'Depth gauge on the workpiece')}
              onClick={() => set('probe', !ui.probe)}
            />
            {pinfo && (
              <div className="mt-2">
                <Slider
                  id="mpx"
                  label={L('Poloha pozdĺž (od ľavej hrany)', 'Position along (from the left edge)')}
                  unit="mm"
                  min={0}
                  max={Math.round(pinfo.L)}
                  step={0.5}
                  value={Math.min(ui.px, pinfo.L)}
                  digits={1}
                  onChange={(v) => set('px', v)}
                />
                <Slider
                  id="mpz"
                  label={L('Poloha naprieč (od zadnej hrany)', 'Position across (from the back edge)')}
                  unit="mm"
                  min={0}
                  max={Math.round(pinfo.Wd)}
                  step={0.5}
                  value={Math.min(ui.pz, pinfo.Wd)}
                  digits={1}
                  onChange={(v) => set('pz', v)}
                />
                <div className="dro tnum" style={{ padding: '8px 12px' }}>
                  <div className="dro-row">
                    <span>{L('hĺbka', 'depth')}</span>
                    <b style={{ fontSize: 22 }}>
                      {pinfo.depthAt(Math.min(ui.px, pinfo.L), Math.min(ui.pz, pinfo.Wd)).toFixed(2)}
                    </b>
                  </div>
                  <div className="dro-sub">
                    <span>
                      {L('najväčšia', 'max')} {pinfo.maxDep.toFixed(2)} mm
                    </span>
                    <span>
                      {L('obrobené', 'machined')} {Math.round(pinfo.cover * 100)} %
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {tele.hold === 'div' &&
            (() => {
              const p = indexPlan(ui.divZ),
                deg = ((((tele.phi * 180) / Math.PI) % 360) + 360) % 360;
              return (
                <div className="sec">
                  <div className="section-heading">
                    <h2 className="sec-title mb-2">{L('Deliaci prístroj', 'Dividing head')}</h2>
                    <SectionInfo title={L('Deliaci prístroj', 'Dividing head')}>
                      <p className="text-xs muted mt-1">
                        {L(
                          'Pri frézovaní musí byť vreteno zaistené. Na delenie odsuň frézu od obrobku. V ručnom ovládaní sa dá točiť aj kľukou (1 otáčka = 9°).',
                          'The spindle must be locked while milling. Move the cutter clear before indexing. In manual control the crank can be turned too (1 turn = 9°).',
                        )}
                      </p>
                    </SectionInfo>
                  </div>
                  <SegRow
                    label={L('Počet dielov z', 'Divisions z')}
                    value={ui.divZ}
                    options={DIVISIONS.map((z) => [z, String(z)])}
                    onChange={(z) => {
                      if (!tele.indexing) set('divZ', z);
                    }}
                  />
                  <div className="desc" style={{ marginTop: 0 }}>
                    <div className="font-semibold">
                      n = 40 / {ui.divZ} = {p.turns}
                      {p.holes ? ` ${p.holes}/${p.circle}` : ''} {L('otáčky kľuky', 'crank turns')}
                    </div>
                    <div>
                      {p.holes
                        ? L(
                            `${p.turns} celých otáčok a ${p.holes} dier na kruhu ${p.circle} deliaceho kotúča (nožnice nastav na ${p.holes} medzier).`,
                            `${p.turns} full turns and ${p.holes} holes on the ${p.circle}-hole circle (set the sector arms to ${p.holes} spaces).`,
                          )
                        : L(`${p.turns} celých otáčok kľuky.`, `${p.turns} full crank turns.`)}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      className="btn"
                      disabled={tele.indexing}
                      onClick={() => apiRef.current.index && apiRef.current.index(-1)}
                    >
                      {L('← Dielik späť', '← Division back')}
                    </button>
                    <button
                      type="button"
                      className="btn active"
                      style={{ flex: 1 }}
                      disabled={tele.indexing}
                      onClick={() => apiRef.current.index && apiRef.current.index(1)}
                    >
                      {L('Pootočiť o 1 dielik →', 'Index 1 division →')}
                    </button>
                  </div>
                  <p className="text-sm tnum mt-2">
                    {L('Dielik', 'Division')}{' '}
                    <b>
                      {tele.idx + 1} / {ui.divZ}
                    </b>{' '}
                    · {L('uhol', 'angle')} <b>{L(deg.toFixed(1).replace('.', ','), deg.toFixed(1))}°</b>
                    {tele.indexing ? ` · ${L('delí sa…', 'indexing…')}` : ''}
                  </p>
                  <Toggle
                    on={ui.divLock}
                    label={L('Aretácia vretena zaistená', 'Spindle lock engaged')}
                    onClick={() => set('divLock', !ui.divLock)}
                  />
                </div>
              );
            })()}

          <BlankSection
            onApply={() => {
              const r = apiRef.current.newBlank && apiRef.current.newBlank();
              if (r) Object.entries(r).forEach(([k, v]) => set(k, v));
            }}
            note={L(
              'Obrobok leží vo zveráku na podložkách pri pevnej čeľusti; posuvná čeľusť dosadne podľa šírky. Nízky kus sa podloží vyššie, aby vyčnieval nad čeľuste.',
              'The workpiece sits on parallels against the fixed jaw; the moving jaw closes to its width. A low part is raised on higher parallels so it sticks out above the jaws.',
            )}
          >
            <SegRow
              label={L('Upnutie', 'Work holding')}
              value={ui.hold}
              options={[
                ['vise', L('Zverák', 'Vise')],
                ['div', L('Deliaci prístroj', 'Dividing head')],
              ]}
              onChange={(v) => {
                set('hold', v);
                if (v === 'div') set('bShape', 'round');
              }}
            />
            {ui.hold === 'div' && (
              <Toggle
                on={ui.tail}
                label={L('Koník podopiera tyč', 'Tailstock supports the bar')}
                onClick={() => set('tail', !ui.tail)}
              />
            )}
            {ui.hold !== 'div' && (
              <SegRow
                label={L('Tvar', 'Shape')}
                value={ui.bShape}
                options={[
                  ['block', L('Hranol', 'Block')],
                  ['round', L('Kruhová tyč', 'Round bar')],
                ]}
                onChange={(v) => set('bShape', v)}
              />
            )}
            <Slider
              id="bl"
              label={L('Dĺžka', 'Length')}
              unit="mm"
              min={100}
              max={250}
              step={5}
              value={ui.bL}
              onChange={(v) => set('bL', v)}
            />
            {ui.bShape === 'block' && ui.hold !== 'div' ? (
              <>
                <Slider
                  id="bw"
                  label={L('Šírka', 'Width')}
                  unit="mm"
                  min={30}
                  max={100}
                  step={5}
                  value={ui.bW}
                  onChange={(v) => set('bW', v)}
                />
                <Slider
                  id="bh"
                  label={L('Výška', 'Height')}
                  unit="mm"
                  min={20}
                  max={80}
                  step={5}
                  value={ui.bH}
                  onChange={(v) => set('bH', v)}
                />
              </>
            ) : (
              <Slider
                id="bdm"
                label={L('Priemer', 'Diameter')}
                unit="mm"
                min={20}
                max={80}
                step={5}
                value={ui.bD}
                onChange={(v) => set('bD', v)}
              />
            )}
          </BlankSection>

          <ExportSection machine="freza" apiRef={apiRef} />
          <ViewSection
            apiRef={apiRef}
            views={[
              ['celok', L('Celok', 'Overview')],
              ['rez', L('Detail frézy', 'Cutter detail')],
              ['spredu', L('Spredu', 'Front')],
              ['zhora', L('Zhora', 'Top')],
              ['bok', L('Rozvádzač', 'Cabinet')],
            ]}
          />
          <PartsSection parts={parts} selected={selected} selectPart={selectPart} />
          <HelpFooter apiRef={apiRef} ui={ui} />
        </fieldset>
      </aside>
    </div>
  );
}

export { MillSimulator };
export { MILL_SPEEDS, MILL_FEEDS, MILL_TOOLS } from './millData';
export default MillSimulator;
