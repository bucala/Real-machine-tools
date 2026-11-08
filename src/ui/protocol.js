// Protokol z cvičenia: samostatný HTML súbor (dá sa vytlačiť alebo uložiť ako PDF) so zadaním, výkresom,
// nastavením stroja, nameranými hodnotami, odchýlkami, snímkou dosiahnutého tvaru a hodnotením.
// Bez Reactu a three.js – testované v tests/protocol.test.js.
import { L } from '../core/i18n';

export const grade = (pct) => (pct >= 90 ? 1 : pct >= 75 ? 2 : pct >= 50 ? 3 : pct >= 30 ? 4 : 5);
export const score = (checks, warns) => {
  const ok = checks.filter((c) => c.ok).length;
  const pct = checks.length ? Math.max(0, (ok / checks.length) * 100 - Math.min(20, warns * 2)) : 0;
  return { ok, total: checks.length, warns, pct, grade: grade(pct) };
};

const NUM = '[-−]?\\d+(?:[.,]\\d+)?';
const toN = (s) => parseFloat(String(s).replace('−', '-').replace(',', '.'));
const decs = (s) => {
  const m = String(s).match(/[.,](\d+)/);
  return m ? m[1].length : 0;
};
// predpis z textu požiadavky: „… 30 ±0,5 mm“ → menovitá hodnota a tolerancia, „Ø40 h6 (40,000 – 39,984)“ → medze
export function parseReq(label) {
  const s = String(label);
  const pm = s.match(new RegExp(`(${NUM})\\s*±\\s*(${NUM})`));
  if (pm && !/[×x]\s*$/.test(s.slice(0, pm.index))) {
    return {
      nom: toN(pm[1]),
      lo: toN(pm[1]) - toN(pm[2]),
      hi: toN(pm[1]) + toN(pm[2]),
      d: Math.max(decs(pm[1]), decs(pm[2])),
      text: `${pm[1]} ±${pm[2]}`,
    };
  }
  const rg = s.match(new RegExp(`\\((${NUM})\\s*[–-]\\s*(${NUM})\\)`));
  if (rg) {
    const a = toN(rg[1]),
      b = toN(rg[2]),
      nm = s.match(new RegExp(`Ø\\s*(${NUM})`));
    return {
      nom: nm ? toN(nm[1]) : (a + b) / 2,
      lo: Math.min(a, b),
      hi: Math.max(a, b),
      d: Math.max(decs(rg[1]), decs(rg[2])),
      text: `${rg[1]} – ${rg[2]}`,
    };
  }
  return null;
}
// nameraná hodnota: jediné číslo v texte (inak sa odchýlka nepočíta)
export function parseAct(actual) {
  const ms = String(actual == null ? '' : actual).match(new RegExp(NUM, 'g'));
  return ms && ms.length === 1 ? { v: toN(ms[0]), d: decs(ms[0]) } : null;
}
const fmtN = (v, d) => L(v.toFixed(d).replace('.', ','), v.toFixed(d));
export function deviation(label, actual) {
  const r = parseReq(label),
    a = parseAct(actual);
  if (!r || !a) return { req: r ? r.text : '', dev: '' };
  const d = Math.min(3, Math.max(r.d, a.d)),
    dv = a.v - r.nom;
  return {
    req: r.text,
    dev: Math.abs(dv) < 0.5 * 10 ** -d ? fmtN(0, d) : `${dv > 0 ? '+' : '−'}${fmtN(Math.abs(dv), d)}`,
  };
}

const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
// d = { machine, title, sub, kicker, task, desc, svg, shot, params: [{ sec, l, v }], dro: [[l, v]], checks, warns, secs, student, url, date }
export function buildProtocol(d) {
  const sc = score(d.checks, d.warns);
  const secs = [];
  d.params.forEach((p) => {
    let g = secs.find((x) => x.sec === p.sec);
    if (!g) {
      g = { sec: p.sec, rows: [] };
      secs.push(g);
    }
    g.rows.push(p);
  });
  const rows = d.checks
    .map((c, i) => {
      const dv = deviation(c.label, c.actual);
      return `<tr><td class="num">${i + 1}</td><td>${esc(c.label)}</td><td class="num">${esc(dv.req || '–')}</td><td class="num">${esc(c.actual || '–')}</td><td class="num">${esc(dv.dev || '–')}</td><td class="${c.ok ? 'ok' : 'ng'}">${c.ok ? L('✓ vyhovuje', '✓ pass') : L('✗ nevyhovuje', '✗ fail')}</td></tr>`;
    })
    .join('');
  const kv = (list) =>
    `<table class="kv">${list.map(([l, v]) => `<tr><th>${esc(l)}</th><td>${esc(v)}</td></tr>`).join('')}</table>`;
  const lang = L('sk', 'en');
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(L('Protokol', 'Report'))} – ${esc(d.task)}</title>
<style>
:root{--f-mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
body{font:14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#151816;background:#fff;max-width:920px;margin:24px auto;padding:0 18px}
h1{font-size:22px;margin:2px 0 4px}h2{font-size:16px;margin:22px 0 8px;border-bottom:1px solid #c9ccc4;padding-bottom:3px}h3{font-size:13px;margin:12px 0 4px;text-transform:uppercase;letter-spacing:.06em;color:#4a4f49}
.head{display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap;border-bottom:2px solid #222;padding-bottom:10px}
.kick{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#5b6158}.muted{color:#5b6158}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #c9ccc4;padding:4px 7px;text-align:left;vertical-align:top}
thead th{background:#eef0ea}.kv th{width:46%;font-weight:600;background:#f6f7f3}td.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.ok{color:#1d6b2c;font-weight:600;white-space:nowrap}.ng{color:#b3261e;font-weight:600;white-space:nowrap}
.draw{color:#151816;border:1px solid #c9ccc4;padding:10px;max-width:640px}.draw svg{width:100%;height:auto}
.shot img{width:100%;max-width:640px;border:1px solid #c9ccc4}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:4px 18px}
.res{font-size:16px;padding:10px 12px;border:2px solid #222;display:inline-block}.sign{margin-top:28px;display:flex;gap:40px;flex-wrap:wrap}
.sign div{border-top:1px solid #555;min-width:220px;padding-top:4px;font-size:12px;color:#5b6158}
button{font:inherit;padding:6px 12px;margin:12px 0;cursor:pointer}
@media print{button{display:none}body{margin:0;max-width:none}h2{break-after:avoid}table,.draw,.shot{break-inside:avoid}}
</style></head><body>
<div class="head">
  <div><div class="kick">${esc(L('Protokol z cvičenia', 'Exercise report'))} · ${esc(d.kicker)}</div><h1>${esc(d.task)}</h1><div>${esc(d.title)}</div><div class="muted" style="font-size:12px;max-width:560px">${esc(d.sub)}</div></div>
  <div style="text-align:right;font-size:13px">${esc(L('Dátum', 'Date'))}: <b>${esc(d.date)}</b><br>${esc(L('Žiak', 'Student'))}: <b>${esc(d.student || '………………………')}</b><br>${esc(L('Čas práce', 'Working time'))}: <b>${mmss(d.secs)}</b><br>${esc(L('Varovania a kolízie', 'Warnings and collisions'))}: <b>${d.warns}</b></div>
</div>
<button type="button" onclick="window.print()">${esc(L('Vytlačiť / uložiť ako PDF', 'Print / save as PDF'))}</button>
<h2>1. ${esc(L('Zadanie', 'Brief'))}</h2><p>${esc(d.desc)}</p>
${d.svg ? `<h2>2. ${esc(L('Výkres', 'Drawing'))}</h2><div class="draw">${d.svg}</div>` : ''}
<h2>3. ${esc(L('Výsledky merania a odchýlky', 'Measured results and deviations'))}</h2>
<table><thead><tr><th>#</th><th>${esc(L('Požiadavka', 'Requirement'))}</th><th>${esc(L('Predpísané', 'Specified'))}</th><th>${esc(L('Dosiahnuté', 'Achieved'))}</th><th>${esc(L('Odchýlka', 'Deviation'))}</th><th>${esc(L('Vyhodnotenie', 'Result'))}</th></tr></thead><tbody>${rows}</tbody></table>
<p class="muted" style="font-size:12px">${esc(L('Odchýlka = dosiahnutá − menovitá hodnota; počíta sa pri požiadavkách s číselnou toleranciou.', 'Deviation = achieved − nominal value; given for requirements with a numeric tolerance.'))}</p>
${d.shot ? `<h2>4. ${esc(L('Dosiahnutý tvar', 'Achieved shape'))}</h2><div class="shot"><img alt="" src="${d.shot}"><div class="muted" style="font-size:12px">${esc(L('Snímka aktuálneho pohľadu v simulátore v čase exportu.', 'Snapshot of the current simulator view at export time.'))}</div></div>` : ''}
<h2>5. ${esc(L('Nastavenie stroja a polotovar', 'Machine settings and workpiece'))}</h2>
${d.dro.length ? `<h3>${esc(L('Údaje stroja', 'Machine readings'))}</h3>${kv(d.dro)}` : ''}
<div class="grid">${secs.map((g) => `<div><h3>${esc(g.sec || L('Nastavenie', 'Settings'))}</h3>${kv(g.rows.map((p) => [p.l, p.v]))}</div>`).join('')}</div>
<h2>6. ${esc(L('Hodnotenie', 'Assessment'))}</h2>
<div class="res">${esc(L(`Splnené ${sc.ok} z ${sc.total} požiadaviek · varovania ${sc.warns} · ${Math.round(sc.pct)} % · známka ${sc.grade}`, `${sc.ok} of ${sc.total} requirements met · warnings ${sc.warns} · ${Math.round(sc.pct)} % · grade ${sc.grade}`))}</div>
<p class="muted" style="font-size:12px">${esc(L('Každé varovanie alebo kolízia znižuje výsledok o 2 % (najviac o 20 %). Známka: 1 ≥ 90 %, 2 ≥ 75 %, 3 ≥ 50 %, 4 ≥ 30 %.', 'Each warning or collision lowers the result by 2 % (at most 20 %). Grade: 1 ≥ 90 %, 2 ≥ 75 %, 3 ≥ 50 %, 4 ≥ 30 %.'))}</p>
<div class="sign"><div>${esc(L('Podpis žiaka', 'Student signature'))}</div><div>${esc(L('Podpis učiteľa', 'Teacher signature'))}</div></div>
<p class="muted" style="font-size:12px;margin-top:22px">${esc(L('Úloha v simulátore', 'Exercise in the simulator'))}: <a href="${esc(d.url)}">${esc(d.url)}</a><br>${esc(L('Vygenerované simulátorom Real machine tools', 'Generated by the Real machine tools simulator'))} · ${esc(d.machine)}</p>
</body></html>`;
}
