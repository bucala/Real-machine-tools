// Sústruh TOS SN: React panel a hlavný komponent; scéna je v latheScene.js, dáta a úlohy v latheData.jsx.
import { SectionInfo } from '../ui/sectionInfo';
import { useEffect, useRef, useState } from 'react';
import { L, RPM } from '../core/i18n';
import { clamp } from '../core/util';
import { CutCalc, ExportSection, TaskSection } from '../ui/tools';
import { METRIC_PITCHES, threadDepth } from './latheMath';
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
  LATHE_FEEDS,
  LATHE_MODELS,
  LATHE_SAFETY,
  LATHE_TASKS,
  LATHE_TOOLS,
  MODEL_KEY,
  latheParts,
  toolName,
} from './latheData';
import { createLatheScene } from './latheScene';

// =====================================================================
// HROTOVÝ SÚSTRUH
// =====================================================================
function LatheCore({ onBack, params, model, onModel }) {
  const MD = LATHE_MODELS[model] || LATHE_MODELS.sn50,
    S = MD.S,
    U = 100 * S,
    U2 = 2 * U,
    SPD = MD.speeds;
  const maxD = Math.round((120 * S) / 5) * 5,
    maxLen = Math.round((600 * S) / 10) * 10;
  const mountRef = useRef(null),
    layerRef = useRef(null),
    tipRef = useRef(null);
  const init = {
    running: false,
    power: true,
    light: true,
    manual: false,
    rpm: SPD[7],
    z: 395,
    x: Math.min(140, maxD + 40),
    top: 0,
    quill: 0,
    tail: Math.round(765 * S),
    autoFeed: false,
    feed: 0.25,
    timeScale: 10,
    slot: 0,
    slots: [
      { type: 'rough', hand: 'R' },
      { type: 'bent', hand: 'R' },
      { type: 'parting', hand: 'R' },
      { type: 'finish', hand: 'R' },
    ],
    postLock: true,
    quillLock: false,
    tailLock: true,
    bShape: 'round',
    bD: Math.min(90, maxD),
    bLen: Math.min(605, maxLen),
    bMat: 'brass',
    pitch: 1.5,
    halfNut: false,
    measure: false,
    measZ: 300,
    guard: false,
    guardOpen: false,
    coolant: false,
    coolOn: false,
    splash: false,
    steady: false,
    steadyZ: Math.round((600 * S) / 10) * 10,
    follow: false,
    screwGuard: false,
    brake: false,
  };
  const { ctl, ui, setUi, set, selected, selectPart, apiRef } = useMachine(init);
  const [tele, setTele] = useTele({
    rpm: 0,
    z: 395,
    x: 140,
    quill: 0,
    tail: Math.round(765 * S),
    vc: 0,
    msg: null,
    cutting: false,
    engaged: false,
    workD: 90,
    slot: 0,
    busy: false,
    postLocked: true,
    blank: 'round 90 605 brass',
  });
  const [edit, setEdit] = useState(null);

  useEffect(() => createLatheScene({ MD, S, SPD, U, U2, apiRef, ctl, layerRef, mountRef, setTele, setUi, tipRef }), []);

  const parts = latheParts();
  const statusMsg = tele.msg
    ? tele.msg
    : ui.unclamped
      ? {
          kind: 'info',
          text: L('Polotovar je odopnutý a vybratý zo stroja.', 'The workpiece is unclamped and out of the machine.'),
        }
      : tele.cutting
        ? {
            kind: 'run',
            text: `${L('Nôž v reze', 'Tool cutting')} – Ø${tele.workD.toFixed(1)} mm, vc ${tele.vc.toFixed(0)} m/min`,
          }
        : tele.rpm > 15
          ? {
              kind: 'run',
              text: L(
                'Vreteno beží. Prisuň nôž k obrobku posuvom X.',
                'The spindle is running. Bring the tool to the workpiece with the X feed.',
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
                  'Stroj stojí. Spusti hlavný chod, potom nastav nôž.',
                  'The machine is stopped. Start the spindle, then set the tool.',
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
  if (tele.engaged) chips.push({ color: '#7fb6ff', text: L('Podopreté hrotom', 'Supported by centre') });
  if (!tele.postLocked) chips.push({ color: '#ff8a1f', text: L('Hlava uvoľnená', 'Post released') });
  const es = edit != null ? edit : tele.slot;
  const draft = ui.slots[es];
  const setDraft = (patch) => {
    const arr = ui.slots.map((s) => ({ ...s }));
    arr[es] = { ...arr[es], ...patch };
    set('slots', arr);
  };
  const stopped = !ui.running && tele.rpm <= 1;
  // príprava úlohy: polotovar, nôž v predpísanej polohe, stúpanie a otáčky
  const setupTask = (task) => {
    const su = task.setup;
    if (!stopped) return;
    ['bShape', 'bD', 'bLen', 'bMat'].forEach((k) => set(k, su[k]));
    if (su.pitch) set('pitch', su.pitch);
    if (su.rpm) set('rpm', su.rpm);
    if (ui.halfNut && apiRef.current.setHalfNut) apiRef.current.setHalfNut(false);
    const r = apiRef.current.newBlank && apiRef.current.newBlank();
    if (r) Object.entries(r).forEach(([k, v]) => set(k, v));
    set('x', Math.max(ui.x, su.bD + 30));
    const arr = ui.slots.map((x) => ({ ...x }));
    arr[su.slot] = { ...su.tool };
    set('slots', arr);
    setEdit(su.slot);
    set('slot', su.slot); // hlava sa natočí, keď stroj dokončí výmenu noža (fronta úkonov v slučke)
  };
  const minfo = ui.measure && apiRef.current.measure ? apiRef.current.measure().info : null;
  const mz = minfo ? clamp(ui.measZ, 0, Math.max(0, minfo.end - 0.5)) : 0;

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
            kicker={L('Simulátor · sústruh', 'Simulator · lathe')}
            title={L('Konvenčný hrotový sústruh', 'Conventional centre lathe')}
            sub={L(
              `Predloha: sústruhy TOS SN a VDF, veľkosť TOS ${MD.name}.`,
              `Modelled after TOS SN and VDF lathes, size TOS ${MD.name}.`,
            )}
            rows={[
              ['X Ø', tele.x.toFixed(2)],
              ['Z', tele.z.toFixed(2)],
            ]}
            foot={[`n ${Math.round(tele.rpm)} ${RPM()}`, `vc ${tele.vc.toFixed(0)} m/min`]}
            status={statusMsg}
          />

          <TaskSection
            machine="sustruh"
            tasks={LATHE_TASKS}
            apiRef={apiRef}
            params={params}
            status={statusMsg}
            onSetup={setupTask}
            safety={{ ui, set, runKey: 'running', items: LATHE_SAFETY() }}
          />

          <div className="sec">
            <div className="section-heading">
              <h2 className="sec-title mb-2">{L('Veľkosť stroja', 'Machine size')}</h2>
              <SectionInfo title={L('Veľkosť stroja', 'Machine size')}>
                <p className="text-xs muted">
                  {L(
                    `${MD.name}: výška hrotov ${Math.round(250 * S)} mm, točný priemer nad lôžkom ${Math.round(500 * S)} mm, vzdialenosť hrotov ≈ ${Math.round((1250 * S) / 50) * 50} mm, ${SPD[0]} – ${SPD[SPD.length - 1]} ot/min, polotovar do Ø${maxD}. Rozmery sú orientačné. Zmena veľkosti postaví nový stroj (len pri stojacom vretene).`,
                    `${MD.name}: centre height ${Math.round(250 * S)} mm, swing over bed ${Math.round(500 * S)} mm, distance between centres ≈ ${Math.round((1250 * S) / 50) * 50} mm, ${SPD[0]} – ${SPD[SPD.length - 1]} rpm, bar up to Ø${maxD}. Approximate dimensions. Changing the size builds a new machine (spindle stopped only).`,
                  )}
                </p>
              </SectionInfo>
            </div>
            <SegRow
              label="TOS"
              value={model}
              options={Object.entries(LATHE_MODELS).map(([k, m]) => [k, m.name])}
              onChange={(m) => {
                if (stopped && m !== model) onModel(m);
              }}
            />
          </div>

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
              <Toggle
                on={ui.light}
                label={L('Pracovné osvetlenie', 'Work light')}
                onClick={() => set('light', !ui.light)}
              />
            </div>
            <div className="mt-3">
              <StepSelect
                id="rpm"
                label={L('Otáčky vretena', 'Spindle speed')}
                unit={RPM()}
                values={SPD}
                value={ui.rpm}
                onChange={(v) => set('rpm', v)}
                locked={ui.running || tele.rpm > 1}
                lockNote={GEAR_LOCK()}
              />
              <CutCalc
                D={tele.workD > 1 ? tele.workD : ui.bD}
                mat={ui.bMat}
                speeds={SPD}
                rpm={ui.rpm}
                locked={!stopped}
                onApply={(n) => set('rpm', n)}
                what={L('Priemer pri noži', 'Diameter at the tool')}
              />
            </div>
          </div>

          <div className="sec">
            <div className="section-heading">
              <h2 className="sec-title mb-2">{L('Prídavné vybavenie', 'Accessories')}</h2>
              <SectionInfo title={L('Prídavné vybavenie', 'Accessories')}>
                <p className="text-xs muted mt-2">
                  {L(
                    'Lunety sa nasadzujú pri stojacom vretene. Dlhý tenký obrobok (vyloženie nad 6 × Ø) bez podopretia sa pri reze chveje; oceľ pri vysokej reznej rýchlosti potrebuje chladenie.',
                    'The rests are fitted with the spindle stopped. A long slender part (over 6 × Ø stick-out) without support chatters in the cut; steel at a high cutting speed needs coolant.',
                  )}
                </p>
              </SectionInfo>
            </div>
            <Toggle
              on={ui.guard}
              label={L('Ochranný kryt skľučovadla s mikrospínačom', 'Chuck guard with microswitch')}
              onClick={() => set('guard', !ui.guard)}
            />
            {ui.guard && (
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  className={`btn ${ui.guardOpen ? 'active' : ''}`}
                  onClick={() => set('guardOpen', !ui.guardOpen)}
                >
                  {ui.guardOpen ? L('Zatvoriť kryt', 'Close the guard') : L('Otvoriť kryt', 'Open the guard')}
                </button>
                <span className="text-xs muted self-center">
                  {ui.guardOpen
                    ? L('otvorený – vreteno sa nespustí', 'open – the spindle will not start')
                    : L('zatvorený', 'closed')}
                </span>
              </div>
            )}
            <Toggle
              on={ui.coolant}
              label={L(
                'Chladiaci systém (čerpadlo, vaňa, hadica Loc-Line)',
                'Coolant system (pump, tray, Loc-Line hose)',
              )}
              onClick={() => {
                set('coolant', !ui.coolant);
                if (ui.coolant) set('coolOn', false);
              }}
            />
            {ui.coolant && (
              <Toggle
                on={ui.coolOn}
                label={L('Chladenie zapnuté', 'Coolant on')}
                onClick={() => set('coolOn', !ui.coolOn)}
              />
            )}
            <Toggle
              on={ui.splash}
              label={L('Zadný ochranný kryt (triesky a emulzia)', 'Rear splash and chip guard')}
              onClick={() => set('splash', !ui.splash)}
            />
            <Toggle
              on={ui.steady}
              label={L('Pevná luneta na lôžku', 'Steady rest on the bed')}
              onClick={() => {
                if (stopped) set('steady', !ui.steady);
              }}
            />
            {ui.steady && (
              <Slider
                id="steadyz"
                label={L('Poloha lunety od čeľustí', 'Steady rest position from the jaws')}
                unit="mm"
                min={Math.round(150 * S)}
                max={Math.round(1100 * S)}
                step={5}
                value={ui.steadyZ}
                onChange={(v) => {
                  if (stopped) set('steadyZ', v);
                }}
              />
            )}
            <Toggle
              on={ui.follow}
              label={L('Pohyblivá luneta na suporte', 'Follow rest on the carriage')}
              onClick={() => {
                if (stopped) set('follow', !ui.follow);
              }}
            />
            <Toggle
              on={ui.screwGuard}
              label={L('Kryt vodiacej skrutky a ťažnej tyče', 'Leadscrew and feed-rod guard')}
              onClick={() => set('screwGuard', !ui.screwGuard)}
            />
            <Toggle
              on={ui.brake}
              label={L('Nožná brzda po celej dĺžke stroja', 'Foot brake along the machine')}
              onClick={() => set('brake', !ui.brake)}
            />
            {ui.brake && (
              <button
                type="button"
                className="btn-run stop mt-2"
                onClick={() => apiRef.current.footBrake && apiRef.current.footBrake()}
              >
                {L('Šliapnuť na nožnú brzdu', 'Step on the foot brake')}
              </button>
            )}
          </div>

          <div className="sec">
            <div className="section-heading">
              <h2 className="sec-title mb-2">{L('Posuvy suportu', 'Carriage feeds')}</h2>
              <SectionInfo title={L('Posuvy suportu', 'Carriage feeds')}>
                <p className="text-xs muted">
                  {L(
                    'Údaj Z na displeji je poloha hrotu noža = suport + horné sane + vyloženie zvoleného noža. X = 0 je os vretena, nôž prejde až 5 mm za os.',
                    'The Z readout is the tool tip position = carriage + top slide + offset of the selected tool. X = 0 is the spindle axis; the tool can go 5 mm past it.',
                  )}
                </p>
              </SectionInfo>
            </div>
            <Slider
              id="z"
              label={L('Suport pozdĺžne Z (od čeľustí)', 'Carriage Z (from the jaws)')}
              unit="mm"
              min={10}
              max={Math.round(1150 * S)}
              step={1}
              value={ui.z}
              actual={tele.carZ}
              onChange={(v) => set('z', v)}
            />
            <Slider
              id="top"
              label={L('Mikroposuv – horné sane Z', 'Fine feed – top slide Z')}
              unit="mm"
              min={-50}
              max={50}
              step={0.05}
              value={ui.top}
              actual={tele.top}
              digits={2}
              onChange={(v) => set('top', v)}
            />
            <Slider
              id="x"
              label={L('Priečny posuv X (priemer)', 'Cross feed X (diameter)')}
              unit="mm"
              min={-10}
              max={Math.round(260 * S)}
              step={0.5}
              value={ui.x}
              actual={tele.x}
              digits={1}
              onChange={(v) => set('x', v)}
            />
            <Toggle
              on={ui.autoFeed}
              label={L('Automatický pozdĺžny posuv k skľučovadlu', 'Automatic longitudinal feed towards the chuck')}
              onClick={() => set('autoFeed', !ui.autoFeed)}
            />
            <div className="mt-2">
              <StepSelect
                id="feed"
                label={L('Posuv na otáčku', 'Feed per revolution')}
                unit={L('mm/ot', 'mm/rev')}
                values={LATHE_FEEDS}
                value={ui.feed}
                onChange={(v) => set('feed', v)}
                fmt={(v) => L(v.toFixed(2).replace('.', ','), v.toFixed(2))}
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
          </div>

          <div className="sec">
            <div className="section-heading">
              <h2 className="sec-title mb-2">{L('Nožová hlava', 'Tool post')}</h2>
              <SectionInfo title={L('Nožová hlava', 'Tool post')}>
                <p className="text-xs muted mt-2">
                  {L(
                    'Výber polohy pootočí hlavu (páka sa uvoľní a znovu zaistí), zmena noža ho vymení. Oboje len pri stojacom vretene a s nožmi mimo obrobku. Pravý nôž reže smerom k skľučovadlu, ľavý ku koníku.',
                    'Choosing a position indexes the post (the lever is released and locked again); changing the tool swaps it. Both only with the spindle stopped and the tools clear of the work. A right-hand tool cuts towards the chuck, a left-hand one towards the tailstock.',
                  )}
                </p>
              </SectionInfo>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {ui.slots.map((s, k) => (
                <button
                  key={k}
                  type="button"
                  className={`tool-slot ${tele.slot === k ? 'on' : ''}`}
                  aria-pressed={tele.slot === k}
                  onClick={() => {
                    setEdit(k);
                    if (k !== tele.slot) apiRef.current.setSlot && apiRef.current.setSlot(k);
                  }}
                >
                  <b>
                    {L('Poloha', 'Position')} {k + 1}
                    {tele.slot === k ? ` · ${L('v reze', 'active')}` : ''}
                  </b>
                  {toolName(s)}
                </button>
              ))}
            </div>
            <label className="text-sm font-semibold block mb-1" htmlFor="ltool">
              {L('Nôž v polohe', 'Tool in position')} {es + 1}
            </label>
            <select
              id="ltool"
              className="sel mb-2"
              value={draft.type}
              onChange={(e) => setDraft({ type: e.target.value })}
            >
              {Object.entries(LATHE_TOOLS).map(([k, tl], i) => (
                <option key={k} value={k}>
                  {i + 1}. {L(tl.sk, tl.en)}
                </option>
              ))}
            </select>
            {!LATHE_TOOLS[draft.type].sym && (
              <SegRow
                label={L('Prevedenie', 'Hand')}
                value={draft.hand}
                options={[
                  ['R', L('Pravý', 'Right')],
                  ['L', L('Ľavý', 'Left')],
                ]}
                onChange={(v) => setDraft({ hand: v })}
              />
            )}
            <Toggle
              on={ui.postLock}
              label={L('Nožová hlava zaistená', 'Tool post locked')}
              onClick={() => apiRef.current.setPostLock && apiRef.current.setPostLock(!ui.postLock)}
            />
          </div>

          <div className="sec">
            <div className="section-heading">
              <h2 className="sec-title mb-2">{L('Rezanie závitov', 'Thread cutting')}</h2>
              <SectionInfo title={L('Rezanie závitov', 'Thread cutting')}>
                <p className="text-xs muted mt-2">
                  {L(
                    `Hĺbka metrického závitu h3 = 0,6134 · P = ${threadDepth(ui.pitch).toFixed(2).replace('.', ',')} mm (priemer jadra o ${(2 * threadDepth(ui.pitch)).toFixed(2).replace('.', ',')} mm menší). Postup: závitový nôž, nízke otáčky, prísuv X, zapni maticu – suport ide o P na otáčku k skľučovadlu; po prechode vysuň nôž, vypni maticu, vráť suport, pridaj prísuv a opakuj.`,
                    `Metric thread depth h3 = 0.6134 · P = ${threadDepth(ui.pitch).toFixed(2)} mm (minor diameter ${(2 * threadDepth(ui.pitch)).toFixed(2)} mm smaller). Procedure: thread tool, low speed, infeed X, engage the half-nut – the carriage moves P per revolution towards the chuck; after the pass retract the tool, disengage, return the carriage, add infeed and repeat.`,
                  )}
                </p>
              </SectionInfo>
            </div>
            <StepSelect
              id="pitch"
              label={L('Stúpanie závitu P', 'Thread pitch P')}
              unit="mm"
              values={METRIC_PITCHES}
              value={ui.pitch}
              onChange={(v) => set('pitch', v)}
              locked={!stopped}
              lockNote={L(
                'Stúpanie sa nastavuje len pri stojacom vretene.',
                'The pitch can only be set with the spindle stopped.',
              )}
              fmt={(v) => L(String(v).replace('.', ','), String(v))}
            />
            <Toggle
              on={ui.halfNut}
              label={L('Matica vodiacej skrutky zapnutá', 'Half-nut engaged')}
              onClick={() => apiRef.current.setHalfNut && apiRef.current.setHalfNut(!ui.halfNut)}
            />
          </div>

          <div className="sec">
            <div className="section-heading">
              <h2 className="sec-title mb-2">{L('Meranie', 'Measuring')}</h2>
              <SectionInfo title={L('Meranie', 'Measuring')}>
                <p className="text-xs muted mt-2">
                  {L(
                    'Meria sa pri stojacom vretene. Osadenia sú zoradené od voľného konca.',
                    'Measure with the spindle stopped. Shoulders are listed from the free end.',
                  )}
                </p>
              </SectionInfo>
            </div>
            <Toggle
              on={ui.measure}
              label={L('Posuvné meradlo na obrobku', 'Calliper on the workpiece')}
              onClick={() => set('measure', !ui.measure)}
            />
            {minfo && (
              <div className="mt-2">
                <Slider
                  id="measz"
                  label={L('Poloha merania od čeľustí', 'Measuring position from the jaws')}
                  unit="mm"
                  min={0}
                  max={Math.max(1, Math.floor(minfo.end - 0.5))}
                  step={0.5}
                  value={mz}
                  digits={1}
                  onChange={(v) => set('measZ', v)}
                />
                <div className="dro tnum" style={{ padding: '8px 12px' }}>
                  <div className="dro-row">
                    <span>{L('Ø (meradlo 0,02)', 'Ø (calliper 0.02)')}</span>
                    <b style={{ fontSize: 22 }}>{(Math.round(minfo.dAt(mz) / 0.02) * 0.02).toFixed(2)}</b>
                  </div>
                  <div className="dro-sub">
                    <span>
                      {L('dĺžka od čeľustí', 'length from jaws')} {minfo.end.toFixed(2)}
                    </span>
                    <span>
                      {L('mikrometer', 'micrometer')} {minfo.dAt(mz).toFixed(2)}
                    </span>
                  </div>
                </div>
                <table className="text-xs tnum mt-2 w-full" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr className="muted">
                      <th className="text-left font-semibold">Ø mm</th>
                      <th className="text-right font-semibold">{L('od – do (od čeľustí)', 'from – to (from jaws)')}</th>
                      <th className="text-right font-semibold">{L('dĺžka', 'length')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {minfo.steps
                      .filter((x) => x.len >= 1)
                      .reverse()
                      .map((x, i) => (
                        <tr key={i}>
                          <td>{x.d.toFixed(2)}</td>
                          <td className="text-right">
                            {x.z0.toFixed(1)} – {x.z1.toFixed(1)}
                          </td>
                          <td className="text-right">{x.len.toFixed(1)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {minfo.thread && (
                  <p className="text-xs mt-2">
                    {L('Závit', 'Thread')}: P {minfo.thread.pitch} mm · {L('hĺbka', 'depth')}{' '}
                    {minfo.thread.depth.toFixed(2)} mm · {minfo.thread.z0.toFixed(1)} – {minfo.thread.z1.toFixed(1)} mm
                    {minfo.thread.mixed ? L(' · poškodený (rôzne stúpanie)', ' · damaged (mixed pitch)') : ''}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="sec">
            <h2 className="sec-title mb-2">{L('Koník', 'Tailstock')}</h2>
            <Toggle
              on={ui.tailLock}
              label={L('Koník zaistený na lôžku', 'Tailstock clamped to the bed')}
              onClick={() => set('tailLock', !ui.tailLock)}
            />
            <Toggle
              on={ui.quillLock}
              label={L('Pinola zaistená', 'Quill locked')}
              onClick={() => set('quillLock', !ui.quillLock)}
            />
            <div className="mt-2">
              <Slider
                id="quill"
                label={L('Výsuv pinoly', 'Quill extension')}
                unit="mm"
                min={0}
                max={Math.round(150 * S)}
                step={1}
                value={ui.quill}
                actual={tele.quill}
                onChange={(v) => set('quill', v)}
              />
              <Slider
                id="tail"
                label={L('Poloha koníka na lôžku', 'Tailstock position')}
                unit="mm"
                min={Math.round(350 * S)}
                max={Math.round(1245 * S)}
                step={1}
                value={ui.tail}
                actual={tele.tail}
                onChange={(v) => set('tail', v)}
              />
            </div>
          </div>

          <BlankSection
            onApply={() => {
              const r = apiRef.current.newBlank && apiRef.current.newBlank();
              if (r) Object.entries(r).forEach(([k, v]) => set(k, v));
            }}
            note={L(
              'Šesťhran sa upína na plochy, priemer je cez rohy. Polotovar sa mení len pri stojacom vretene.',
              'A hexagon is clamped on its flats; the size is across the corners. The workpiece can only be changed with the spindle stopped.',
            )}
          >
            <SegRow
              label={L('Tvar', 'Shape')}
              value={ui.bShape}
              options={[
                ['round', L('Kruhová tyč', 'Round bar')],
                ['hex', L('Šesťhran', 'Hexagon')],
              ]}
              onChange={(v) => set('bShape', v)}
            />
            <SegRow
              label={L('Materiál', 'Material')}
              value={ui.bMat}
              options={[
                ['brass', L('Mosadz', 'Brass')],
                ['steel', L('Oceľ', 'Steel')],
                ['alu', L('Hliník', 'Alu')],
              ]}
              onChange={(v) => set('bMat', v)}
            />
            <Slider
              id="bd"
              label={L('Priemer', 'Diameter')}
              unit="mm"
              min={20}
              max={maxD}
              step={5}
              value={ui.bD}
              onChange={(v) => set('bD', v)}
            />
            <Slider
              id="blen"
              label={L('Vyloženie zo skľučovadla', 'Stick-out from the chuck')}
              unit="mm"
              min={100}
              max={maxLen}
              step={10}
              value={ui.bLen}
              onChange={(v) => set('bLen', v)}
            />
          </BlankSection>

          <ExportSection machine="sustruh" apiRef={apiRef} />
          <ViewSection
            apiRef={apiRef}
            views={[
              ['celok', L('Celok', 'Overview')],
              ['rez', L('Detail rezu', 'Cutting detail')],
              ['noz', L('Nožová hlava', 'Tool post')],
              ['spredu', L('Spredu', 'Front')],
              ['zhora', L('Zhora', 'Top')],
              ['konik', L('Koník', 'Tailstock')],
            ]}
          />
          <PartsSection parts={parts} selected={selected} selectPart={selectPart} />
          <HelpFooter apiRef={apiRef} ui={ui} />
        </fieldset>
      </aside>
    </div>
  );
}

// výber veľkosti stroja – pri zmene sa stroj postaví nanovo (iný stroj = nový stav)
function LatheSimulator(props) {
  const [model, setModel] = useState(() => {
    try {
      const m = window.localStorage.getItem(MODEL_KEY);
      return LATHE_MODELS[m] ? m : 'sn50';
    } catch (err) {
      return 'sn50';
    }
  });
  const onModel = (m) => {
    try {
      window.localStorage.setItem(MODEL_KEY, m);
    } catch (err) {
      /* ignorované */
    }
    setModel(m);
  };
  return <LatheCore key={model} {...props} model={model} onModel={onModel} />;
}

export { LatheSimulator };
export { LATHE_MODELS, LATHE_TOOLS, SPEEDS, LATHE_FEEDS, FEED_BASE, FEED_MULT } from './latheData';
export default LatheSimulator;
