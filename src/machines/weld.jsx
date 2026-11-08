// Zváranie (MMA a MIG/MAG): React panel a hlavný komponent; scéna je v weldScene.js, dáta a úlohy v weldData.jsx.
import { Guide } from '../ui/guide';
import { WELD_GUIDE } from './guides';
import { SectionInfo } from '../ui/sectionInfo';
import { useEffect, useRef } from 'react';
import { L, REDUCED_MOTION } from '../core/i18n';
import { clamp } from '../core/util';
import { ExportSection, TaskSection } from '../ui/tools';
import { MIG_GASES, MIG_WIRES, MODE_NAMES, gasCover, migRange, migSynergic, stickoutI } from './migMath';
import { SHAPE_GROUPS, posAllowed, sizeDefault, sizeOptions, usesSize, weldPrep, weldProfile } from './weldShape';
import {
  HelpFooter,
  PanelHeader,
  PartsSection,
  SceneView,
  SegRow,
  Slider,
  Toggle,
  ViewSection,
  useMachine,
  useTele,
} from '../ui/common';
import {
  ELECTRODES,
  FILLETS,
  MIG_SAFETY,
  MIG_TASKS,
  SHAPE_HINT,
  WELD_DIAL,
  WELD_POS,
  WELD_POS_PIPE,
  WELD_SAFETY,
  WELD_TASKS,
  WELD_TYPES,
  WeldSection,
  migParts,
  weldParts,
} from './weldData';
import { createWeldScene } from './weldScene';

// =====================================================================
// OBLÚKOVÉ ZVÁRANIE – TRANSFORMÁTOROVÁ ZVÁRAČKA ELEKTROKOV JS 90FN
// =====================================================================
function WeldingSimulator({ onBack, params, process = 'mma' }) {
  const MIG = process === 'mig';
  const mountRef = useRef(null),
    layerRef = useRef(null),
    tipRef = useRef(null),
    flashRef = useRef(null),
    glassRef = useRef(null);
  const init = {
    manual: false,
    mode: 'w380',
    current: 100,
    etype: 'rutile',
    de: 3.2,
    ground: true,
    helmet: false,
    helmetType: 'auto',
    shade: 11,
    adfDelay: 0.3,
    autoArc: true,
    arcLen: 3,
    handV: 6,
    wType: 'V',
    wPos: 'PA',
    wT: 8,
    wL: 150,
    wD: 60.3,
    rotOn: false,
    rotV: 3,
    secOn: false,
    secPos: 50,
    tiltA: 20,
    tiltB: 0,
    tripped: false,
    slag: true,
    flashFx: !REDUCED_MOTION,
    ...(MIG
      ? {
          power: true,
          prog: 'std',
          trig: '2T',
          wire: 1,
          gas: 'M21',
          vd: 8,
          corr: 0,
          valve: true,
          flow: 14,
          ctwd: 12,
          handV: 8,
          slag: false,
        }
      : {}),
  };
  const { ctl, ui, setUi, set, selected, selectPart, apiRef } = useMachine(init);
  const [tele, setTele] = useTele({
    arc: false,
    I: 0,
    la: 3,
    v: 0,
    le: 350,
    msg: null,
    stats: null,
    U: 0,
    mode: 'short',
    cover: 1,
    wire: 0,
  });

  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target && e.target.tagName;
      if (
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        (tag === 'INPUT' && e.target.type !== 'range')
      )
        return;
      if (e.key === 'h' || e.key === 'H') set('helmet', !ctl.current.helmet);
      if ((e.key === 'e' || e.key === 'E') && apiRef.current.newElectrode) apiRef.current.newElectrode();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(
    () => createWeldScene({ MIG, apiRef, ctl, flashRef, glassRef, layerRef, mountRef, setTele, setUi, tipRef }),
    [],
  );

  const parts = MIG ? migParts() : weldParts();
  // MIG/MAG: synergický bod z nastavenia (aj bez oblúka), odporúčaný prúd podľa hrúbky plechu
  const syn = MIG ? migSynergic({ wire: ui.wire, vd: ui.vd, prog: ui.prog, gas: ui.gas, corr: ui.corr }) : null;
  const synI = MIG ? Math.round(stickoutI(syn.I, ui.ctwd)) : 0;
  const cover = MIG ? gasCover({ valve: ui.valve, flow: ui.flow, ctwd: ui.ctwd }) : 1;
  const [lo, hi] = MIG ? migRange(ui.wT) : ELECTRODES[ui.etype].r[ui.de] || [60, 120];
  const modeName = (m) => {
    const n = MODE_NAMES[m] || MODE_NAMES.short;
    return L(n[0], n[1]);
  };
  const wt = WELD_TYPES.find((w) => w.id === ui.wType);
  const prep = weldPrep(ui.wType, ui.wT);
  const fmt = (v, d = 1) => L(v.toFixed(d).replace('.', ','), v.toFixed(d));
  const fmtD = (v) => L(String(v).replace('.', ','), String(v));
  const prepText = ['I', 'V', 'HV', 'Y', 'U', 'J'].includes(ui.wType)
    ? `${L('Medzera', 'Gap')} ${fmt(prep.gap)} mm${ui.wType !== 'I' ? `, ${L('otupenie', 'root face')} ${fmt(prep.root)} mm, ${ui.wType === 'U' || ui.wType === 'J' ? `R ${prep.R} mm, ${L('boky', 'sides')} ${prep.ang}°` : `${L('úkos', 'bevel')} ${ui.wType === 'HV' ? 45 : 60}°`}` : ''}.`
    : ui.wType === 'K'
      ? `${L('Kútový zvar s výškou', 'Fillet weld, throat')} a ≈ ${fmt(0.7 * ui.wT)} mm (${L('rameno', 'leg')} ≈ ${fmt(ui.wT)} mm).`
      : ui.wType === 'L'
        ? L(
            'Presah dielov – kútový zvar na hrane horného plechu.',
            'Overlapping parts – fillet on the edge of the upper plate.',
          )
        : ui.wType === 'C'
          ? L(
              `Kolmý plech stojí na okraji vodorovného – kútový zvar v kúte s výškou a ≈ ${fmt(0.7 * ui.wT)} mm.`,
              `The upright plate stands on the edge of the flat one – fillet in the corner, throat a ≈ ${fmt(0.7 * ui.wT)} mm.`,
            )
          : ui.wType === 'O'
            ? L(
                `Plechy pod 90° hranou nahor, medzi hranami drážka V hlboká ≈ ${fmt(0.7 * ui.wT)} mm – vypĺňa sa ako tupý zvar.`,
                `Plates at 90° with the corner up, a V groove ≈ ${fmt(0.7 * ui.wT)} mm deep between the edges – filled like a butt weld.`,
              )
            : ui.wType === 'RR'
              ? L(
                  `Rúra Ø${fmtD(ui.wD)} × ${ui.wT} mm, obvodový tupý zvar ${ui.wT <= 3 ? 'I' : 'V 60°'} dookola (obvod ${Math.round(Math.PI * ui.wD)} mm). Pri pevnej rúre sa zvára po polovičkách obvodu od spodku nahor (PH).`,
                  `Pipe Ø${ui.wD} × ${ui.wT} mm, circumferential ${ui.wT <= 3 ? 'square' : '60° V'} butt weld all round (circumference ${Math.round(Math.PI * ui.wD)} mm). On a fixed pipe weld each half from the bottom up (PH).`,
                )
              : ui.wType === 'RP'
                ? L(
                    `Rúra Ø${fmtD(ui.wD)} (stena ${fmt(Math.min(5, Math.max(2, ui.wT / 2)))} mm) postavená na plech ${ui.wT} mm – kútový zvar dookola, dĺžka ≈ ${Math.round(Math.PI * (ui.wD + 3))} mm. Horák veď stále kolmo na obvod.`,
                    `Pipe Ø${ui.wD} (wall ${fmt(Math.min(5, Math.max(2, ui.wT / 2)))} mm) set on a ${ui.wT} mm plate – fillet all round, length ≈ ${Math.round(Math.PI * (ui.wD + 3))} mm. Keep the torch square to the circumference.`,
                  )
                : ui.wType === 'JK'
                  ? L(
                      `Jokel ${ui.wD} × ${ui.wD} mm na plechu ${ui.wT} mm – kútový zvar dookola, na zaoblených rohoch spomaľ a natoč ruku.`,
                      `Box section ${ui.wD} × ${ui.wD} mm on a ${ui.wT} mm plate – fillet all round; slow down and turn your hand on the rounded corners.`,
                    )
                  : ui.wType === 'TV'
                    ? L(
                        `Plechy vypálené do vlnovky (amplitúda 10 mm) – tupý zvar ${ui.wT <= 4 ? 'I' : 'V'} po krivke; modrá čiara ukazuje spoj.`,
                        `Plates cut to a wave (10 mm amplitude) – ${ui.wT <= 4 ? 'square' : 'V'} butt weld along the curve; the blue line shows the joint.`,
                      )
                    : ui.wType === 'E'
                      ? L(
                          'Okraje plechov ohnuté nahor – zvar sa robí bez prídavného materiálu natavením lemov.',
                          'Sheet edges flanged up – welded by melting the flanges.',
                        )
                      : L(
                          'Navárať sa dá kdekoľvek na plech – húsenice vedľa seba s prekrytím asi tretiny, ďalšie vrstvy sa ukladajú na predchádzajúce.',
                          'You can build up material anywhere on the plate – beads side by side overlapping about a third, further layers go on top of the previous ones.',
                        );
  const curNow = MIG ? synI : ui.current;
  const grpNow = wt.g,
    allowed = posAllowed(ui.wType),
    isFil = FILLETS.includes(ui.wType);
  // výber druhu zvaru: poloha, rozmer rúry a hrúbka sa prispôsobia, ak pre nový tvar nesedia
  const pickType = (id) => {
    const w = WELD_TYPES.find((x) => x.id === id),
      ok = posAllowed(id);
    set('wType', id);
    if (!ok.includes(ui.wPos)) set('wPos', ok[0]);
    if (usesSize(id) && !sizeOptions(id).includes(ui.wD)) set('wD', sizeDefault(id));
    if (w.g !== 'plane' && (ui.wT < w.t[0] || ui.wT > w.t[1])) set('wT', clamp(ui.wT, w.t[0], w.t[1]));
  };
  const groove = ['V', 'HV', 'Y', 'U', 'J'].includes(ui.wType)
    ? Math.max(1, Math.round((ui.wT * ui.wT * 0.45) / ((MIG ? syn.dep : 0.42 * ui.current) / 3)))
    : 1;
  const thWarn = ui.wT < wt.t[0] || ui.wT > wt.t[1];
  const s = tele.stats;
  const sec = ui.secOn && apiRef.current.section ? apiRef.current.section(ui.secPos / 100) : null;
  const defects = [];
  if (s) {
    if (s.cold > 0.8) defects.push(L('studený spoj (nízky prúd)', 'cold lap (low current)'));
    if (MIG && s.por > 0.5) defects.push(L('póry (slabá plynová ochrana)', 'porosity (poor gas shielding)'));
    if (MIG && s.spat > 400) defects.push(L('veľký rozstrek', 'heavy spatter'));
    if (s.longArc > 1.2) defects.push(L('póry a rozstrek (dlhý oblúk)', 'porosity and spatter (long arc)'));
    if (s.fast > 1.2)
      defects.push(L('úzka húsenica, neprevarenie (rýchly posuv)', 'narrow bead, lack of fusion (fast travel)'));
    if (s.off > 0.4)
      defects.push(
        L(
          `${Math.round(s.off * 100)} % kovu je mimo spoja – veď ${MIG ? 'horák' : 'elektródu'} po modrej čiare`,
          `${Math.round(s.off * 100)} % of the metal is off the joint – guide the ${MIG ? 'torch' : 'electrode'} along the blue line`,
        ),
      );
    if (s.wrongDir > 0.8)
      defects.push(L('zlý smer zvárania pre túto polohu', 'wrong travel direction for this position'));
    if (s.sag > 0.8)
      defects.push(L('stekanie kúpeľa (vysoký prúd v polohe)', 'sagging pool (current too high for the position)'));
    if (s.fill != null && s.cov > 0.6 && s.fill < 0.9)
      defects.push(L('neúplne vyplnený úkos – pridaj ďalšie vrstvy', 'groove not completely filled – add more passes'));
    if (s.reinf > 3.2) defects.push(L('príliš veľké prevýšenie', 'excessive reinforcement'));
    if (s.inc > 15)
      defects.push(
        L(
          'troskové vtrúseniny medzi húsenicami – pred ďalšou otlč trosku',
          'slag inclusions between passes – chip the slag before the next one',
        ),
      );
    if (s.rootRisk)
      defects.push(
        L('pri zvare I nad 4 mm hrozí neprevarený koreň', 'square butt over 4 mm risks lack of root fusion'),
      );
  }
  const setupTask = (task) => {
    if (tele.arc) return;
    Object.entries(task.setup).forEach(([k, v]) => set(k, v));
    if (apiRef.current.newParts) apiRef.current.newParts();
  };
  const statusMsg = tele.msg
    ? tele.msg
    : ui.unclamped
      ? {
          kind: 'info',
          text: L('Prezeráš si zvarenec – ťahaním ho otáčaš.', 'Inspecting the weldment – drag to rotate it.'),
        }
      : tele.arc && MIG
        ? {
            kind: 'run',
            text: `${L('Oblúk horí', 'Arc burning')} – ${tele.I} A, ${fmt(tele.U)} V, ${modeName(tele.mode)}, ${L('posuv', 'travel')} ${fmt(tele.v)} mm/s, ${L('sklon', 'tilt')} ${ui.tiltA}° / ${ui.tiltB}°`,
          }
        : tele.arc
          ? {
              kind: 'run',
              text: `${L('Oblúk horí', 'Arc burning')} – ${tele.I} A, ${L('oblúk', 'arc')} ${fmt(tele.la)} mm, ${L('posuv', 'travel')} ${fmt(tele.v)} mm/s`,
            }
          : tele.stuck
            ? {
                kind: 'danger',
                text: L('Elektróda je prilepená – pusti tlačidlá.', 'The electrode is stuck – release the buttons.'),
              }
            : MIG && !ui.manual
              ? {
                  kind: 'idle',
                  text: L(
                    'Prepni na režim Zváranie (M) – potom drž pravé tlačidlo a veď horák, ľavé tlačidlo je spúšťač. Kukla: H.',
                    'Switch to welding mode (M) – then hold the right button to guide the torch, the left button is the trigger. Helmet: H.',
                  ),
                }
              : MIG
                ? {
                    kind: 'idle',
                    text:
                      ui.trig === '4T'
                        ? L(
                            '4-takt: ľavým tlačidlom (pri držanom pravom) oblúk zapáliš, ďalším stlačením zhasneš. Kukla: H.',
                            '4-step: press the left button (with the right held) to start the arc, press again to stop. Helmet: H.',
                          )
                        : L(
                            'Drž pravé tlačidlo a veď horák k spoju, ľavým (spúšťač) zváraš, kým ho držíš. Kukla: H.',
                            'Hold the right button to guide the torch to the joint, the left one (trigger) welds while held. Helmet: H.',
                          ),
                  }
                : !ui.manual
                  ? {
                      kind: 'idle',
                      text: L(
                        'Prepni na režim Zváranie (M) – potom drž pravé tlačidlo a veď elektródu, ľavým zapáliš oblúk. Kukla: H.',
                        'Switch to welding mode (M) – then hold the right button to guide the electrode, press the left one to strike the arc. Helmet: H.',
                      ),
                    }
                  : {
                      kind: 'idle',
                      text: L(
                        'Drž pravé tlačidlo a veď elektródu k spoju, ľavým tlačidlom zapáliš oblúk. Kukla: H.',
                        'Hold the right button to guide the electrode to the joint, press the left button to strike the arc. Helmet: H.',
                      ),
                    };
  const chips = [
    { color: tele.arc ? '#ffffff' : '#8b8f89', text: tele.arc ? L('Oblúk', 'Arc') : L('Oblúk zhasnutý', 'No arc') },
  ];
  if (ui.helmet) chips.push({ color: '#3ee06c', text: L('Kukla dole', 'Helmet down') });
  if (tele.hot > 0.15) chips.push({ color: '#ff7a2a', text: L('Horúci zvar', 'Hot weld') });
  if (MIG && !ui.power) chips.push({ color: '#ff5a3c', text: L('Zdroj vypnutý', 'Source off') });
  if (MIG && cover < 0.7) chips.push({ color: '#ff7a2a', text: L('Bez plynovej ochrany', 'No gas shielding') });
  if (ui.tripped) chips.push({ color: '#ff5a3c', text: L('Istič vypadol', 'Breaker tripped') });
  const overlay = (
    <>
      {ui.helmet && (
        <div className={`helmet ${ui.helmetType}`}>
          <div ref={glassRef} className="helmet-glass" />
          <div className="helmet-tag">
            {ui.helmetType === 'auto'
              ? `${L('Samostmievacia kukla', 'Auto-darkening helmet')} · DIN ${ui.shade} · ${fmt(ui.adfDelay)} s · ${L('H zdvihne', 'H lifts')}`
              : L('Stará kukla · pevné sklo DIN 11 · H zdvihne', 'Old helmet · fixed DIN 11 glass · H lifts')}
          </div>
        </div>
      )}
      <div ref={flashRef} className="flash" />
      {!MIG && tele.le < 30 && !tele.swap && !tele.arc && !ui.unclamped && (
        <div className="absolute inset-x-0 flex justify-center pointer-events-none" style={{ bottom: 70, zIndex: 7 }}>
          <div
            className="pop-in desc"
            role="alert"
            style={{
              pointerEvents: 'auto',
              marginTop: 0,
              background: 'var(--chrome)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,.25)',
              textAlign: 'center',
              boxShadow: '0 10px 30px rgba(0,0,0,.45)',
            }}
          >
            <div className="text-sm mb-2">{L('Elektróda je spotrebovaná.', 'The electrode is used up.')}</div>
            <button
              type="button"
              className="scene-btn on"
              style={{ fontSize: 15, padding: '9px 16px' }}
              onClick={() => apiRef.current.newElectrode && apiRef.current.newElectrode()}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5" />
              </svg>
              {L('Vymeň elektródu (E)', 'Replace electrode (E)')}
            </button>
          </div>
        </div>
      )}
    </>
  );

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
        workLabels={[L('Pozrieť obrobok', 'Inspect workpiece'), L('Upnúť späť', 'Clamp back')]}
        overlay={overlay}
        manualLabel={L('Zváranie', 'Welding')}
        tools={
          <>
            <button
              type="button"
              className={`scene-btn ${ui.helmet ? 'on' : ''}`}
              aria-pressed={ui.helmet}
              onClick={() => set('helmet', !ui.helmet)}
              title="H"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 10a7 7 0 0 1 14 0v7a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z" />
                <path d="M8 11h8v4H8z" />
              </svg>
              {ui.helmet ? L('Kukla spustená', 'Helmet down') : L('Kukla zdvihnutá', 'Helmet up')}
            </button>
            {!MIG && (
              <button
                type="button"
                className="scene-btn"
                disabled={!ui.slag || ui.unclamped}
                style={{ opacity: ui.slag ? 1 : 0.5 }}
                onClick={() => {
                  if (apiRef.current.chip && apiRef.current.chip()) set('slag', false);
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M14 4l6 6-3 3-6-6zM11 7l-7 7 3 3 7-7" />
                </svg>
                {L('Otĺcť trosku', 'Chip slag')}
              </button>
            )}
          </>
        }
        hint={L(
          'Ťahaj: otáčanie · pravé tlačidlo: posun · koliesko: zoom · M: režim Zváranie · H: kukla',
          'Drag: orbit · right button: pan · wheel: zoom · M: welding mode · H: helmet',
        )}
        manualHint={
          MIG ? (
            <>
              <b className="ink">{L('Zváranie:', 'Welding:')}</b>{' '}
              {L(
                'drž pravé tlačidlo a veď horák, ľavé tlačidlo pri držanom pravom je spúšťač (2T / 4T), samotné ľavé tlačidlo nakláňa horák, koliesko s pravým mení výlet drôtu. Na dotyku 1 prst vedie, 2 prsty zvárajú. Kameru vráti M alebo Esc.',
                'hold the right button to guide the torch, the left button with the right held is the trigger (2T / 4T), the left button alone tilts the torch, the wheel with the right button sets the stick-out. On touch 1 finger guides, 2 fingers weld. M or Esc returns to the camera.',
              )}
            </>
          ) : (
            <>
              <b className="ink">{L('Zváranie:', 'Welding:')}</b>{' '}
              {L(
                'drž pravé tlačidlo a veď elektródu, ľavým pri držanom pravom zapáliš oblúk, samotné ľavé tlačidlo nakláňa elektródu, koliesko s pravým mení dĺžku oblúka. Na dotyku 1 prst vedie, 2 prsty zvárajú. Kameru vráti M alebo Esc.',
                'hold the right button to guide the electrode, press the left one as well to strike the arc, the left button alone tilts the electrode, the wheel with the right button sets the arc length. On touch 1 finger guides, 2 fingers weld. M or Esc returns to the camera.',
              )}
            </>
          )
        }
      />
      <aside className="panel">
        {!MIG && <Guide steps={WELD_GUIDE} ui={ui} tele={tele} apiRef={apiRef} />}
        <fieldset className="machine-settings" disabled={ui.unclamped}>
          {MIG ? (
            <PanelHeader
              ui={ui}
              set={set}
              kicker={L('Simulátor · zváranie MIG/MAG', 'Simulator · MIG/MAG welding')}
              title={L('Zváranie v ochrannom plyne', 'Gas metal arc welder')}
              sub={L(
                'Predloha: invertorový zdroj Fronius TransPuls Synergic TPS 450 s podávačom drôtu VR 4000 a chladiacim modulom FK.',
                'Modelled after the Fronius TransPuls Synergic TPS 450 inverter source with a VR 4000 wire feeder and an FK cooling unit.',
              )}
              rows={[
                [L('Prúd A', 'Current A'), String(tele.arc ? tele.I : synI)],
                [L('Napätie V', 'Voltage V'), (tele.arc ? tele.U : syn.U).toFixed(1)],
                [L('Drôt m/min', 'Wire m/min'), ui.vd.toFixed(1)],
              ]}
              foot={[
                `Ø${L(String(ui.wire).replace('.', ','), String(ui.wire))} G3Si1 · ${ui.gas}`,
                `${L('výlet', 'stick-out')} ${ui.ctwd} mm · ${ui.trig}`,
              ]}
              status={statusMsg}
            />
          ) : (
            <PanelHeader
              ui={ui}
              set={set}
              kicker={L('Simulátor · zváranie', 'Simulator · welding')}
              title={L('Oblúková zváračka', 'Arc welder')}
              sub={L(
                'Predloha: transformátorová zváračka Elektrokov JS 90FN, ručné zváranie obalenou elektródou (MMA).',
                'Modelled after the Elektrokov JS 90FN transformer welder, manual metal arc welding (MMA).',
              )}
              rows={[
                [L('Prúd A', 'Current A'), String(tele.I)],
                [L('Oblúk mm', 'Arc mm'), tele.la.toFixed(1)],
                [L('Posuv mm/s', 'Travel mm/s'), tele.v.toFixed(1)],
              ]}
              foot={[
                `Ø${ui.de} ${ui.etype === 'rutile' ? 'E 6013' : 'E 7018'}`,
                `${L('elektróda', 'electrode')} ${Math.round(tele.le)} mm`,
              ]}
              status={statusMsg}
            />
          )}

          <TaskSection
            machine={MIG ? 'mag' : 'zvaranie'}
            tasks={MIG ? MIG_TASKS : WELD_TASKS}
            apiRef={apiRef}
            params={params}
            status={statusMsg}
            onSetup={setupTask}
            safety={{ ui, set, runKey: 'manual', items: MIG ? MIG_SAFETY() : WELD_SAFETY() }}
          />

          {MIG && (
            <>
              <div className="sec">
                <div className="section-heading">
                  <h2 className="sec-title mb-2">{L('Zdroj TPS 450', 'TPS 450 source')}</h2>
                  <SectionInfo title={L('Zdroj TPS 450', 'TPS 450 source')}>
                    <p className="text-xs muted mt-2">
                      {L(
                        '2-takt: zvára sa, kým držíš spúšťač – na krátke zvary a stehy. 4-takt: stlač a pusti = štart, znova = koniec – na dlhé zvary.',
                        '2-step: welds while you hold the trigger – for short welds and tacks. 4-step: press and release = start, again = stop – for long welds.',
                      )}
                    </p>
                  </SectionInfo>
                </div>
                <Toggle
                  on={ui.power}
                  label={L('Hlavný vypínač zapnutý', 'Main switch on')}
                  onClick={() => set('power', !ui.power)}
                />
                <SegRow
                  label={L('Proces', 'Process')}
                  value={ui.prog}
                  options={[
                    ['std', L('Synergic štandard', 'Synergic standard')],
                    ['pulse', L('Synergic impulz', 'Synergic pulse')],
                  ]}
                  onChange={(v) => set('prog', v)}
                />
                <SegRow
                  label={L('Horák', 'Torch')}
                  value={ui.trig}
                  options={[
                    ['2T', L('2-takt', '2-step')],
                    ['4T', L('4-takt', '4-step')],
                  ]}
                  onChange={(v) => set('trig', v)}
                />
                <Toggle
                  on={ui.ground}
                  label={L('Zemniaca svorka pripojená', 'Ground clamp attached')}
                  onClick={() => set('ground', !ui.ground)}
                />
              </div>

              <div className="sec">
                <div className="section-heading">
                  <h2 className="sec-title mb-2">{L('Synergický program', 'Synergic program')}</h2>
                  <SectionInfo title={L('Synergický program', 'Synergic program')}>
                    <p className="text-xs muted mt-2">
                      {L(
                        'Synergia: zvolíš drôt a plyn, rýchlosťou drôtu nastavíš výkon – zdroj sám dopočíta prúd a napätie. Korekciou predĺžiš (+) alebo skrátiš (−) oblúk.',
                        'Synergic: choose the wire and gas, set the power with the wire speed – the source works out current and voltage. The correction lengthens (+) or shortens (−) the arc.',
                      )}
                    </p>
                  </SectionInfo>
                </div>
                <SegRow
                  label={L('Drôt G3Si1', 'Wire G3Si1')}
                  value={ui.wire}
                  options={MIG_WIRES.map((d) => [d, `Ø${L(String(d).replace('.', ','), String(d))}`])}
                  onChange={(v) => set('wire', v)}
                />
                <SegRow
                  label={L('Plyn', 'Gas')}
                  value={ui.gas}
                  options={Object.entries(MIG_GASES).map(([k, g]) => [k, L(g.sk, g.en)])}
                  onChange={(v) => set('gas', v)}
                />
                <Slider
                  id="mvd"
                  label={L('Rýchlosť drôtu', 'Wire speed')}
                  unit="m/min"
                  min={1}
                  max={22}
                  step={0.5}
                  value={ui.vd}
                  digits={1}
                  onChange={(v) => set('vd', v)}
                />
                <Slider
                  id="mco"
                  label={L('Korekcia dĺžky oblúka', 'Arc length correction')}
                  unit="V"
                  min={-3}
                  max={3}
                  step={0.5}
                  value={ui.corr}
                  digits={1}
                  onChange={(v) => set('corr', v)}
                />
                <div className="desc" style={{ marginTop: 0 }}>
                  <div>
                    <b>{synI} A</b> · <b>{fmt(syn.U)} V</b> · {modeName(syn.mode)}
                  </div>
                  <div className="mt-1">
                    {L(
                      `Odporúčaný prúd pre plech ${ui.wT} mm: ${lo} – ${hi} A.`,
                      `Recommended current for a ${ui.wT} mm plate: ${lo} – ${hi} A.`,
                    )}
                  </div>
                  {syn.overload && (
                    <div className="mt-1" style={{ color: 'var(--warn)' }}>
                      {L(
                        `Na drôt Ø${String(ui.wire).replace('.', ',')} je prúd príliš vysoký – zvoľ hrubší drôt.`,
                        `The current is too high for a Ø${ui.wire} wire – choose a thicker one.`,
                      )}
                    </div>
                  )}
                  {syn.mode === 'globular' && (
                    <div className="mt-1" style={{ color: 'var(--warn)' }}>
                      {ui.gas === 'C1'
                        ? L(
                            'V čistom CO₂ nevznikne sprchový prenos – rozstrek je väčší.',
                            'Pure CO₂ gives no spray transfer – more spatter.',
                          )
                        : L(
                            'Prechodová oblasť – veľký rozstrek. Zmeň rýchlosť drôtu alebo zapni impulz.',
                            'Globular range – heavy spatter. Change the wire speed or switch to pulse.',
                          )}
                    </div>
                  )}
                </div>
              </div>

              <div className="sec">
                <div className="section-heading">
                  <h2 className="sec-title mb-2">{L('Plyn a horák', 'Gas and torch')}</h2>
                  <SectionInfo title={L('Plyn a horák', 'Gas and torch')}>
                    <p className="text-xs muted mt-1" style={{ color: cover < 0.7 ? 'var(--warn)' : undefined }}>
                      {L(
                        `Plynová ochrana: ${Math.round(cover * 100)} %. Prietok 12 – 16 l/min, výlet 10 – 15 mm. Dlhší výlet zníži prúd a plyn kúpeľ nechráni.`,
                        `Gas shielding: ${Math.round(cover * 100)} %. Flow 12 – 16 l/min, stick-out 10 – 15 mm. A longer stick-out lowers the current and the gas no longer covers the pool.`,
                      )}
                    </p>
                  </SectionInfo>
                </div>
                <Toggle
                  on={ui.valve}
                  label={L('Ventil plynovej fľaše otvorený', 'Gas cylinder valve open')}
                  onClick={() => set('valve', !ui.valve)}
                />
                <Slider
                  id="mfl"
                  label={L('Prietok plynu', 'Gas flow')}
                  unit="l/min"
                  min={0}
                  max={25}
                  step={1}
                  value={ui.flow}
                  onChange={(v) => set('flow', v)}
                />
                <Slider
                  id="mct"
                  label={L('Výlet drôtu (vzdialenosť špičky)', 'Stick-out (contact tip distance)')}
                  unit="mm"
                  min={2}
                  max={30}
                  step={1}
                  value={ui.ctwd}
                  onChange={(v) => set('ctwd', v)}
                />
                <Slider
                  id="mhv"
                  label={L('Najvyššia rýchlosť ruky pri zváraní', 'Max hand speed while welding')}
                  unit="mm/s"
                  min={1}
                  max={20}
                  step={0.5}
                  value={ui.handV}
                  digits={1}
                  onChange={(v) => set('handV', v)}
                />
                <p className="text-xs muted mt-1" style={{ color: cover < 0.7 ? 'var(--warn)' : undefined }}>
                  {L('Plynová ochrana', 'Gas shielding')}: {Math.round(cover * 100)} %
                </p>
                {ui.manual && (
                  <p className="text-xs muted mt-1">
                    {L(`Drôtu spotrebovaného: ${fmt(tele.wire || 0)} m.`, `Wire used: ${fmt(tele.wire || 0)} m.`)}
                  </p>
                )}
              </div>
            </>
          )}

          {!MIG && (
            <>
              <div className="sec">
                <div className="section-heading">
                  <h2 className="sec-title mb-2">{L('Zváračka', 'Welder')}</h2>
                  <SectionInfo title={L('Zváračka', 'Welder')}>
                    <p className="text-xs muted mt-2">
                      {L(
                        'Pri 220 V je dovolený prúd najviac 75 A – inak istič vypadne.',
                        'On 220 V the current is limited to 75 A – otherwise the breaker trips.',
                      )}
                    </p>
                  </SectionInfo>
                </div>
                <SegRow
                  label={L('Prepínač', 'Switch')}
                  value={ui.mode}
                  options={[
                    ['off', '0'],
                    ['w380', '380 V'],
                    ['w220', '220 V'],
                    ['charge', L('Nabíjanie', 'Charging')],
                  ]}
                  onChange={(v) => set('mode', v)}
                />
                <div className="text-sm font-semibold mb-1">{L('Zvárací prúd', 'Welding current')}</div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {WELD_DIAL.map((a) => (
                    <button
                      key={a}
                      type="button"
                      className={`btn ${ui.current === a ? 'active' : ''}`}
                      aria-pressed={ui.current === a}
                      onClick={() => set('current', a)}
                    >
                      {a} A
                    </button>
                  ))}
                </div>
                <Toggle
                  on={ui.ground}
                  label={L('Zemniaca svorka pripojená', 'Ground clamp attached')}
                  onClick={() => set('ground', !ui.ground)}
                />
                {ui.tripped && (
                  <button type="button" className="btn w-full mt-2" onClick={() => set('tripped', false)}>
                    {L('Zapnúť istič', 'Reset the breaker')}
                  </button>
                )}
              </div>

              <div className="sec">
                <div className="section-heading">
                  <h2 className="sec-title mb-2">{L('Elektróda', 'Electrode')}</h2>
                  <SectionInfo title={L('Elektróda', 'Electrode')}>
                    <p className="text-xs muted mb-2">
                      {L(
                        `Odporúčaný prúd pre Ø${ui.de}: ${lo} – ${hi} A. Dĺžka oblúka ≈ priemer elektródy.`,
                        `Recommended current for Ø${ui.de}: ${lo} – ${hi} A. Arc length ≈ electrode diameter.`,
                      )}
                    </p>
                    <p className="text-xs muted mt-1">
                      {L(
                        'Elektróda ide za kurzorom (modrý krúžok) najviac touto rýchlosťou – bežne 2 – 6 mm/s. Pomalší posuv dá širšiu a vyššiu húsenicu.',
                        'The electrode follows the cursor (blue ring) at most at this speed – typically 2 – 6 mm/s. Slower travel gives a wider, higher bead.',
                      )}
                    </p>
                  </SectionInfo>
                </div>
                <SegRow
                  label={L('Druh', 'Type')}
                  value={ui.etype}
                  options={Object.entries(ELECTRODES).map(([k, e]) => [k, L(e.sk, e.en)])}
                  onChange={(v) => {
                    set('etype', v);
                    if (!ELECTRODES[v].r[ui.de]) set('de', 3.2);
                  }}
                />
                <SegRow
                  label={L('Priemer', 'Diameter')}
                  value={ui.de}
                  options={Object.keys(ELECTRODES[ui.etype].r)
                    .map(Number)
                    .sort((a, b) => a - b)
                    .map((d) => [d, `Ø${L(String(d).replace('.', ','), String(d))}`])}
                  onChange={(v) => set('de', v)}
                />

                <Slider
                  id="wla"
                  label={L('Dĺžka oblúka (výška elektródy)', 'Arc length (electrode height)')}
                  unit="mm"
                  min={0}
                  max={12}
                  step={0.5}
                  value={ui.arcLen}
                  digits={1}
                  onChange={(v) => set('arcLen', v)}
                />
                <Slider
                  id="whv"
                  label={L('Najvyššia rýchlosť ruky pri zváraní', 'Max hand speed while welding')}
                  unit="mm/s"
                  min={1}
                  max={20}
                  step={0.5}
                  value={ui.handV}
                  digits={1}
                  onChange={(v) => set('handV', v)}
                />
                <Toggle
                  on={ui.autoArc}
                  label={L('Ruka dorovnáva opaľovanie elektródy', 'Hand compensates electrode burn-off')}
                  onClick={() => set('autoArc', !ui.autoArc)}
                />

                <button
                  type="button"
                  className="btn w-full mt-2"
                  disabled={tele.swap || tele.arc}
                  onClick={() => apiRef.current.newElectrode && apiRef.current.newElectrode()}
                >
                  {L('Vymeniť elektródu (E)', 'Replace the electrode (E)')}
                </button>
              </div>
            </>
          )}

          <div className="sec">
            <div className="section-heading">
              <h2 className="sec-title mb-2">{L('Zvar a polotovar', 'Joint and parts')}</h2>
              <SectionInfo title={L('Zvar a polotovar', 'Joint and parts')}>
                <p className="text-xs muted mb-3">
                  {grpNow === 'plane' || ui.wType === 'K'
                    ? ''
                    : L(
                        `Pre tento tvar sa dajú nastaviť polohy ${allowed.join(', ')}.`,
                        `Positions available for this shape: ${allowed.join(', ')}.`,
                      )}
                  {FILLETS.includes(ui.wType) && ui.wPos === 'PC'
                    ? ` ${L('PC je poloha pre tupé zvary.', 'PC is a butt-weld position.')}`
                    : ''}
                  {!FILLETS.includes(ui.wType) && (ui.wPos === 'PB' || ui.wPos === 'PD')
                    ? ` ${L('PB a PD sú polohy pre kútové zvary.', 'PB and PD are fillet-weld positions.')}`
                    : ''}
                </p>
                <p className="text-xs muted">
                  {L(
                    'V režime Zváranie nakláňaš aj myšou: drž samotné ľavé tlačidlo a ťahaj – hore / dole sklon v smere zvárania, do strán pracovný uhol. Ťahom (10 – 25°) sa zvar viac natavuje, tlačením je plochší; nad 45° pribúda rozstrek' +
                      (MIG ? ' a plyn uniká.' : '.'),
                    'In welding mode you can tilt with the mouse too: hold the left button alone and drag – up / down tilts along the travel, sideways sets the work angle. Dragging (10 – 25°) gives deeper fusion, pushing a flatter bead; beyond 45° spatter increases' +
                      (MIG ? ' and the gas escapes.' : '.'),
                  )}
                </p>
                {ui.wType === 'RR' && ui.wPos === 'PA' && (
                  <>
                    <p className="text-xs muted">
                      {L(
                        'Rúra sa otáča pod horákom, miesto zvárania je stále hore. Drž horák nad spojom a veď ho len priečne; vrstvy kladieš pri ďalších otáčkach.',
                        'The pipe turns under the torch and the weld spot stays on top. Hold the torch over the joint and only move across it; lay further passes on the next turns.',
                      )}
                    </p>
                  </>
                )}
              </SectionInfo>
            </div>
            <div className="text-sm font-semibold mb-1">
              {L('Tvar a poloha polotovarov', 'Shape and position of the parts')}
            </div>
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              {SHAPE_GROUPS.map(([g, sk, en]) => (
                <button
                  key={g}
                  type="button"
                  className={`tool-slot ${grpNow === g ? 'on' : ''}`}
                  aria-pressed={grpNow === g}
                  onClick={() => {
                    if (grpNow !== g) pickType(WELD_TYPES.find((w) => w.g === g).id);
                  }}
                >
                  <b>{L(sk, en)}</b>
                  {L(...SHAPE_HINT[g])}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-5 gap-1.5 mb-3">
              {WELD_TYPES.filter((w) => w.g === grpNow).map((w) => (
                <button
                  key={w.id}
                  type="button"
                  className={`weld-type ${ui.wType === w.id ? 'on' : ''}`}
                  aria-pressed={ui.wType === w.id}
                  onClick={() => pickType(w.id)}
                  title={L(w.sk, w.en)}
                >
                  <svg
                    viewBox="0 0 30 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d={w.sym} />
                  </svg>
                  {L(w.sk, w.en)}
                </button>
              ))}
            </div>
            <div className="text-sm font-semibold mb-1">{L('Poloha zvárania', 'Welding position')}</div>
            <div className="grid grid-cols-2 gap-1.5 mb-1.5">
              {[
                ...WELD_POS.map(([k, code, sk, en]) => [
                  k,
                  ui.wType === 'RR' && k === 'PC'
                    ? L('2G · rúra zvislo', '2G · pipe vertical')
                    : ui.wType === 'RR' && k === 'PA'
                      ? L('1G · polohovadlo', '1G · positioner')
                      : code,
                  ui.wType === 'RR' && k === 'PA'
                    ? L('rúra sa otáča, zvára sa zhora', 'the pipe turns, weld on top')
                    : L(sk, en),
                ]),
                ...WELD_POS_PIPE.map(([k, g, f, sk, en]) => [k, isFil ? f : g, L(sk, en)]),
              ]
                .filter(([k]) => allowed.includes(k))
                .map(([k, code, text]) => (
                  <button
                    key={k}
                    type="button"
                    className={`tool-slot ${ui.wPos === k ? 'on' : ''}`}
                    aria-pressed={ui.wPos === k}
                    onClick={() => set('wPos', k)}
                  >
                    <b>
                      {k} · {code}
                    </b>
                    {text}
                  </button>
                ))}
            </div>

            {ui.wType === 'RR' && ui.wPos === 'PA' && (
              <div className="desc mb-3" style={{ marginTop: 0 }}>
                <Toggle
                  on={ui.rotOn}
                  label={L('Polohovadlo otáča rúru', 'Positioner turns the pipe')}
                  onClick={() => set('rotOn', !ui.rotOn)}
                />
                <Slider
                  id="wrv"
                  label={L('Obvodová rýchlosť (= rýchlosť zvárania)', 'Surface speed (= travel speed)')}
                  unit="mm/s"
                  min={0.5}
                  max={10}
                  step={0.5}
                  value={ui.rotV}
                  digits={1}
                  onChange={(v) => set('rotV', v)}
                />
              </div>
            )}
            {usesSize(ui.wType) && (
              <SegRow
                label={ui.wType === 'JK' ? L('Jokel', 'Box section') : L('Rúra Ø', 'Pipe Ø')}
                value={ui.wD}
                options={sizeOptions(ui.wType).map((d) => [d, ui.wType === 'JK' ? `${d}×${d}` : fmtD(d)])}
                onChange={(v) => set('wD', v)}
              />
            )}
            <Slider
              id="wt"
              label={
                ui.wType === 'RR'
                  ? L('Hrúbka steny rúry', 'Pipe wall thickness')
                  : L('Hrúbka plechu', 'Plate thickness')
              }
              unit="mm"
              min={1}
              max={30}
              step={1}
              value={ui.wT}
              onChange={(v) => set('wT', v)}
            />
            {ui.wType !== 'RR' && (
              <Slider
                id="wl"
                label={
                  ui.wType === 'RP' || ui.wType === 'JK'
                    ? L('Dĺžka plechu', 'Plate length')
                    : L('Dĺžka zvaru', 'Weld length')
                }
                unit="mm"
                min={80}
                max={250}
                step={10}
                value={ui.wL}
                onChange={(v) => set('wL', v)}
              />
            )}
            <div className="desc" style={{ marginTop: 0 }}>
              <div className="font-semibold mb-1">
                {L('Zvarová príprava', 'Joint preparation')}: {L(wt.sk, wt.en)}
              </div>
              <div>{prepText}</div>
              {groove > 1 && (
                <div className="mt-1">
                  {L(`Odhad: ${groove} húseníc pri ${curNow} A.`, `Estimate: ${groove} passes at ${curNow} A.`)}
                </div>
              )}
              {thWarn && (
                <div className="mt-1" style={{ color: 'var(--warn)' }}>
                  {L(
                    `Tento druh zvaru sa používa pre hrúbky ${wt.t[0]} – ${wt.t[1]} mm.`,
                    `This joint is used for thicknesses ${wt.t[0]} – ${wt.t[1]} mm.`,
                  )}
                </div>
              )}
            </div>
            <div className="text-sm font-semibold mt-3 mb-1">
              {MIG ? L('Sklon horáka', 'Torch angle') : L('Sklon elektródy', 'Electrode angle')}
            </div>
            <Slider
              id="wta"
              label={L('V smere zvárania (+ ťahom, − tlačením)', 'Along the travel (+ drag, − push)')}
              unit="°"
              min={-40}
              max={70}
              step={1}
              value={ui.tiltA}
              onChange={(v) => set('tiltA', v)}
            />
            <Slider
              id="wtb"
              label={L('Pracovný uhol do strany', 'Work angle sideways')}
              unit="°"
              min={-60}
              max={60}
              step={1}
              value={ui.tiltB}
              onChange={(v) => set('tiltB', v)}
            />
            <div className="flex gap-2 mb-1">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  set('tiltA', 20);
                  set('tiltB', 0);
                }}
              >
                {L('Vyrovnať', 'Reset')}
              </button>
              {FILLETS.includes(ui.wType) && ui.wType !== 'L' && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    set('tiltA', 15);
                    set('tiltB', ui.tiltB < 0 ? -45 : 45);
                  }}
                >
                  {L('45° do kúta', '45° into the corner')}
                </button>
              )}
            </div>

            <button
              type="button"
              className="btn w-full mt-2"
              onClick={() => apiRef.current.newParts && apiRef.current.newParts()}
            >
              {L('Pripraviť nové diely', 'Prepare new parts')}
            </button>
          </div>

          <div className="sec">
            <div className="section-heading">
              <h2 className="sec-title mb-2">{L('Ochrana', 'Protection')}</h2>
              <SectionInfo title={L('Ochrana', 'Protection')}>
                <p className="text-xs muted mt-2">
                  {L(
                    `Bez kukly oblúk oslňuje celú obrazovku. Záblesky bez kukly: ${tele.flashes || 0}.`,
                    `Without the helmet the arc blinds the whole screen. Flashes without helmet: ${tele.flashes || 0}.`,
                  )}{' '}
                  {L(
                    'Pri vypnutých efektoch sa obrazovka rozjasní plynulo a nebliká.',
                    'With effects off the screen brightens smoothly and does not flicker.',
                  )}
                </p>
                {ui.helmetType === 'auto' && (
                  <>
                    <p className="text-xs muted">
                      {L(
                        'Senzory zachytia oblúk a sklo okamžite stmavne; bez oblúka je priehľadné, takže vidíš, kam priložíš elektródu.',
                        'The sensors detect the arc and the glass darkens instantly; without the arc it is clear, so you see where to place the electrode.',
                      )}
                    </p>
                  </>
                )}
                {!(ui.helmetType === 'auto') && (
                  <>
                    <p className="text-xs muted mt-2">
                      {L(
                        'Pevné tmavé sklo DIN 11 – bez oblúka cez neho takmer nič nevidno, elektródu treba priložiť naslepo.',
                        'Fixed dark DIN 11 glass – without the arc you can hardly see anything, the electrode has to be placed blind.',
                      )}
                    </p>
                  </>
                )}
              </SectionInfo>
            </div>
            <SegRow
              label={L('Kukla', 'Helmet')}
              value={ui.helmetType}
              options={[
                ['auto', L('Moderná (senzor)', 'Modern (sensor)')],
                ['old', L('Stará (pevné sklo)', 'Old (fixed glass)')],
              ]}
              onChange={(v) => set('helmetType', v)}
            />
            <Toggle
              on={ui.helmet}
              label={L('Zváračská kukla spustená (H)', 'Welding helmet down (H)')}
              onClick={() => set('helmet', !ui.helmet)}
            />
            {ui.helmetType === 'auto' ? (
              <div className="mt-2">
                <Slider
                  id="wsh"
                  label={L('Stupeň stmavenia', 'Shade')}
                  unit="DIN"
                  min={9}
                  max={13}
                  step={1}
                  value={ui.shade}
                  onChange={(v) => set('shade', v)}
                />
                <Slider
                  id="wdl"
                  label={L('Oneskorenie zosvetlenia', 'Light-state delay')}
                  unit="s"
                  min={0.1}
                  max={1}
                  step={0.1}
                  value={ui.adfDelay}
                  digits={1}
                  onChange={(v) => set('adfDelay', v)}
                />
              </div>
            ) : (
              <></>
            )}
            <Toggle
              on={ui.flashFx}
              label={L('Efekty záblesku (blikanie oblúka)', 'Flash effects (arc flicker)')}
              onClick={() => set('flashFx', !ui.flashFx)}
            />
            <p className="text-xs muted mt-2">
              {L('Záblesky bez kukly', 'Flashes without helmet')}: {tele.flashes || 0}
            </p>
          </div>

          <div className="sec">
            <h2 className="sec-title mb-2">{L('Hodnotenie zvaru', 'Weld assessment')}</h2>
            {s ? (
              <div className="text-sm" style={{ lineHeight: 1.6 }}>
                <div>
                  {L('Zvarená dĺžka', 'Welded length')}: <b>{Math.round(s.cov * 100)} %</b>
                </div>
                {s.fill != null && (
                  <div>
                    {L('Vyplnenie úkosu', 'Groove filled')}: <b>{Math.round(s.fill * 100)} %</b>
                  </div>
                )}
                <div>
                  {L('Šírka húsenice', 'Bead width')}: <b>{fmt(s.width)} mm</b> · {L('prevýšenie', 'reinforcement')}:{' '}
                  <b>{fmt(s.reinf)} mm</b>
                </div>
                <div>
                  {L('Vrstvy nad sebou', 'Layers stacked')}: <b>{s.layers}</b>
                  {s.layers >= 3
                    ? ` (${L('koreň, výplň, krycia', 'root, fill, cap')})`
                    : s.layers === 2
                      ? ` (${L('koreň a krycia', 'root and cap')})`
                      : ''}
                </div>
                <div>
                  {L('Rozstrek', 'Spatter')}: <b>{s.spat}</b>
                  {MIG && (
                    <>
                      {' '}
                      · {L('póry', 'porosity')}: <b>{fmt(s.por || 0)} s</b>
                    </>
                  )}
                </div>
                <div className="mt-1" style={{ color: defects.length ? 'var(--warn)' : 'var(--accent)' }}>
                  {defects.length
                    ? `${L('Chyby', 'Defects')}: ${defects.join(', ')}.`
                    : L('Bez zjavných chýb.', 'No obvious defects.')}
                </div>
              </div>
            ) : (
              <p className="text-sm muted">{L('Zatiaľ nie je nič zvarené.', 'Nothing welded yet.')}</p>
            )}
            {!MIG && (
              <button
                type="button"
                className="btn w-full mt-2"
                disabled={!ui.slag}
                onClick={() => {
                  if (apiRef.current.chip && apiRef.current.chip()) set('slag', false);
                }}
              >
                {L('Otĺcť trosku', 'Chip off the slag')}
              </button>
            )}
          </div>

          <div className="sec">
            <div className="section-heading">
              <h2 className="sec-title mb-2">{L('Rez zvarom a zvarová mierka', 'Weld section and gauge')}</h2>
              <SectionInfo title={L('Rez zvarom a zvarová mierka', 'Weld section and gauge')}>
                <p className="text-xs muted mt-1">
                  {L(
                    'Tmavosivý je leptaný základný materiál, svetlé sú húsenice (každá iným odtieňom), prerušovaná čiara je hranica natavenia, olivová oblasť je tepelne ovplyvnená. Červená značka = neprievar. Oranžovo zvarová mierka. Miesto rezu ukazuje v scéne červená rovina.',
                    'Dark grey is the etched parent metal, the light areas are the passes (each in its own shade), the dashed line is the fusion boundary, the olive band is the heat-affected zone. Red mark = lack of fusion. The weld gauge is in orange. The red plane in the scene shows where the section is cut.',
                  )}
                </p>
              </SectionInfo>
            </div>
            <Toggle
              on={ui.secOn}
              label={L('Rez zvarom (makrovýbrus)', 'Weld section (macro etch)')}
              onClick={() => set('secOn', !ui.secOn)}
            />
            {ui.secOn && (
              <>
                <Slider
                  id="wsp"
                  label={L('Miesto rezu pozdĺž zvaru', 'Section position along the weld')}
                  unit="%"
                  min={0}
                  max={100}
                  step={1}
                  value={ui.secPos}
                  onChange={(v) => set('secPos', v)}
                />
                {sec && sec.m ? (
                  <>
                    <WeldSection sec={sec.sec} m={sec.m} />
                    <div className="text-sm tnum mt-2" style={{ lineHeight: 1.6 }}>
                      {sec.m.legs ? (
                        <div>
                          {L('Kútový zvar', 'Fillet')}: z₁ <b>{fmt(sec.m.legs.z1)}</b> · z₂ <b>{fmt(sec.m.legs.z2)}</b>{' '}
                          · a <b>{fmt(sec.m.legs.a)} mm</b>{' '}
                          <span className="muted">
                            ({L('odporúčané', 'recommended')} a ≈ {fmt(0.7 * ui.wT)} mm)
                          </span>
                        </div>
                      ) : (
                        <div>
                          {L('Šírka', 'Width')} b <b>{fmt(sec.m.width)} mm</b> · {L('prevýšenie', 'reinforcement')} h{' '}
                          <b>{fmt(sec.m.reinf)} mm</b>
                        </div>
                      )}
                      <div>
                        {L('Vrstvy v reze', 'Layers in the section')}: <b>{sec.m.layers}</b>
                        {sec.m.rootFilled != null && (
                          <>
                            {' '}
                            · {L('koreň', 'root')}:{' '}
                            <b style={{ color: sec.m.rootFilled ? 'var(--accent)' : 'var(--warn)' }}>
                              {sec.m.rootFilled ? L('prevarený', 'fused') : L('neprevarený', 'not fused')}
                            </b>
                          </>
                        )}
                      </div>
                      {sec.m.wallFus != null && (
                        <div style={{ color: sec.m.lof ? 'var(--warn)' : undefined }}>
                          {L('Natavenie bokov úkosu', 'Side-wall fusion')}: <b>{fmt(sec.m.wallFus)} mm</b>
                          {sec.m.lof ? ` – ${L('studený spoj (neprievar) na boku', 'cold lap on the side wall')}` : ''}
                        </div>
                      )}
                      {(sec.m.por > 0 || sec.m.inc > 0) && (
                        <div style={{ color: 'var(--warn)' }}>
                          {sec.m.por > 0 ? L('póry v reze', 'pores in the section') : ''}
                          {sec.m.por > 0 && sec.m.inc > 0 ? ' · ' : ''}
                          {sec.m.inc > 0 ? L('troskové vtrúseniny', 'slag inclusions') : ''}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-sm muted mt-1">
                    {L('V tomto mieste ešte nie je zvar.', 'There is no weld at this spot yet.')}
                  </p>
                )}
              </>
            )}
          </div>

          <ExportSection machine={MIG ? 'mag' : 'zvaranie'} apiRef={apiRef} canSave={false} />
          <ViewSection
            apiRef={apiRef}
            views={[
              ['detail', L('Detail spoja', 'Joint detail')],
              ['zhora', L('Zhora', 'Top')],
              ['celok', L('Celok', 'Overview')],
              ['zvaracka', MIG ? L('Zdroj TPS 450', 'TPS 450 source') : L('Zváračka', 'Welder')],
            ]}
          />
          <PartsSection parts={parts} selected={selected} selectPart={selectPart} />
          <HelpFooter apiRef={apiRef} ui={ui} />
        </fieldset>
      </aside>
    </div>
  );
}

function MigSimulator(props) {
  return <WeldingSimulator {...props} process="mig" />;
}

export { WeldingSimulator, MigSimulator, weldPrep, weldProfile };
export { WELD_TYPES, WELD_DIAL, ELECTRODES } from './weldData';
export default WeldingSimulator;
