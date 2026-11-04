// Portable tool cabinet. Dimensions are millimetres; T is a preferred NC number,
// not a cabinet identity. No PowerMill project/database formats are implied.
export const LIBRARY_KEY = 'rmt-cnc-tool-library-v1';
export const MAX_TOOLS = 500;
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const TOOL_FIELDS = ['t', 'name', 'kind', 'd', 'cr', 'tip', 'l', 'lc', 's', 'dh', 'z'];
export const newToolId = () => globalThis.crypto.randomUUID();
export const shapeOf = t => t.kind === 'cone' ? Number(t.tip) === 90 ? 'chamfer' : 'drill' : Number(t.cr) === Number(t.d) / 2 ? 'ball' : t.cr > 0 ? 'bull' : 'flat';
export const shapeTool = (t, shape) => ({ ...t, kind: ['drill', 'chamfer'].includes(shape) ? 'cone' : 'mill', tip: shape === 'chamfer' ? 90 : 118, cr: shape === 'ball' ? t.d / 2 : shape === 'bull' ? Math.min(2, t.d / 4) : 0 });

export function validateTool(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Neplatný záznam nástroja / Invalid tool record.');
  const t = {};
  for (const key of TOOL_FIELDS) {
    if (key === 'tip' && raw.kind === 'mill') { t.tip = 118; continue; }
    const v = raw[key];
    if (key === 'name') {
      if (typeof v !== 'string' || !v.trim() || v.length > 160 || [...v].some(c => c.charCodeAt(0) < 32)) throw new Error('Neplatný názov / Invalid name (1–160).');
      t.name = v.trim();
    } else if (key === 'kind') {
      if (!['mill', 'cone'].includes(v)) throw new Error('Typ musí byť mill alebo cone / Invalid kind.');
      t.kind = v;
    } else {
      if (v === '' || v === null || v === undefined || !['number','string'].includes(typeof v) || !Number.isFinite(Number(v))) throw new Error(`Chýba alebo je neplatné / Missing or invalid: ${key}`);
      t[key] = Number(v);
    }
  }
  const ranges = { t: [1, 9999], d: [.5, 80], cr: [0, t.d / 2], tip: [30, 160], l: [40, 300], lc: [.5, 300], s: [1, 275], dh: [20, 80], z: [1, 12] };
  for (const [k, [min, max]] of Object.entries(ranges)) if (t[k] < min || t[k] > max || (['t', 'z'].includes(k) && !Number.isInteger(t[k]))) throw new Error(`${k}: ${min}–${max}${['t','z'].includes(k) ? ' (celé číslo / integer)' : ''}`);
  if (t.kind === 'cone' && t.cr !== 0) throw new Error('Vrták / skosenie vyžaduje CR = 0 / Cone requires CR = 0.');
  const minCut = t.kind === 'cone' ? t.d / 2 / Math.tan(t.tip * Math.PI / 360) : t.cr;
  if (t.lc > t.s || t.s > t.l - 25 || t.lc + 1e-6 < minCut) throw new Error('Rozmery: rezná časť ≤ vyloženie ≤ L − 25 mm; rezná časť musí obsiahnuť špičku / Check flute, stick-out and tip.');
  return t;
}
export function validateLibrary(raw) {
  if (!Array.isArray(raw) || raw.length > MAX_TOOLS) throw new Error(`Knižnica musí obsahovať najviac ${MAX_TOOLS} nástrojov / Too many tools.`);
  const ids = new Set();
  return raw.map((r, i) => {
    const id = typeof r?.id === 'string' && /^[\w-]{1,80}$/.test(r.id) ? r.id : newToolId();
    if (ids.has(id)) throw new Error(`Duplicitné ID / Duplicate ID: ${id}`);
    ids.add(id);
    try { return { id, ...validateTool(r) }; } catch (e) { throw new Error(`${i + 1}: ${e.message}`); }
  });
}
export function encodeLibrary(tools) { return JSON.stringify({ format: 'rmt-tool-library', version: 1, units: 'mm', tools: validateLibrary(tools) }, null, 2); }
export function decodeLibrary(text) {
  const doc = JSON.parse(text);
  if (doc?.format !== 'rmt-tool-library' || doc.version !== 1 || doc.units !== 'mm') throw new Error('Očakáva sa RMT knižnica v1 v mm / Expected RMT v1 library in mm.');
  return validateLibrary(doc.tools);
}
const CSV_KEYS = ['id', ...TOOL_FIELDS];
export function encodeCsv(tools) {
  const cell = v => `"${String(v).replaceAll('"', '""')}"`;
  // Prefix formula-like names for safe spreadsheet use. Import reverses this escape.
  return '\uFEFF' + [CSV_KEYS.join(','), ...validateLibrary(tools).map(t => CSV_KEYS.map(k => cell(k === 'name' && /^['=+\-@]/.test(t[k]) ? `'${t[k]}` : t[k])).join(','))].join('\r\n');
}
export function decodeCsv(input) {
  const text = input.replace(/^\uFEFF/, ''), delimiter = text.slice(0, text.indexOf('\n') < 0 ? undefined : text.indexOf('\n')).includes(';') ? ';' : ',';
  const rows = []; let row = [], value = '', quoted = false, closed = false;
  for (let i = 0; i <= text.length; i++) {
    const c = text[i];
    if (quoted) { if (c === undefined) throw new Error('Neuzavreté úvodzovky CSV / Unterminated CSV quote.'); if (c === '"') { if (text[i + 1] === '"') { value += '"'; i++; } else { quoted = false; closed = true; } } else value += c; }
    else if (c === '"' && value === '' && !closed) quoted = true;
    else if (c === delimiter || c === '\n' || c === undefined) { row.push(value.replace(/\r$/, '')); value = ''; closed = false; if (c !== delimiter) { if (row.some(v => v !== '')) rows.push(row); row = []; } }
    else { if (closed && c !== '\r') throw new Error('Neplatné CSV / Invalid CSV.'); value += c; }
  }
  const header = rows.shift();
  if (!header || !TOOL_FIELDS.every(k => header.includes(k)) || new Set(header).size !== header.length) throw new Error(`CSV hlavička / CSV header: ${CSV_KEYS.join(',')}`);
  return validateLibrary(rows.map(row => {
    if (row.length !== header.length) throw new Error('Nesprávny počet stĺpcov CSV / CSV column count.');
    const t = {};
    CSV_KEYS.forEach(k => { const index = header.indexOf(k); if (index >= 0) t[k] = row[index]; });
    if (/^'['=+\-@]/.test(t.name)) t.name = t.name.slice(1);
    return t;
  }));
}
export function readCabinet(storage, defaults) {
  const saved = storage.getItem(LIBRARY_KEY);
  return saved === null ? defaults.map(t => ({ id: newToolId(), ...validateTool(t) })) : decodeLibrary(saved);
}
export function installTool(machineTools, tool, pocket, capacity) {
  if (!Number.isInteger(pocket) || pocket < 1 || pocket > capacity) throw new Error(`T: 1–${capacity}`);
  const next = { ...validateTool(tool), t: pocket };
  return [...machineTools.filter(t => t.t !== pocket), next].sort((a, b) => a.t - b.t);
}
export function encodeToolComments(tools) {
  return ['(RMT TOOL METADATA - MM - NOT A MACHINING PROGRAM)', ...tools.map(raw => {
    const t = validateTool(raw);
    return `(T${t.t} D=${t.d} CR=${t.cr} L=${t.l} LC=${t.lc} S=${t.s} DH=${t.dh} Z=${t.z} TIP=${t.tip} TYPE=${shapeOf(t)} NAME=${t.name.replace(/[();]/g, ' ')})`;
  })].join('\n');
}

// Scan comments independently from motion interpretation. Offset registers G43 H,
// G41 D and cycle R values are never treated as physical tool dimensions.
export function detectNcTools(input) {
  const found = new Map(); let active = null, scale = 1;
  const entry = n => { if (n < 1 || n > 9999 || !Number.isInteger(n)) return null; if (!found.has(n)) found.set(n, { t:n, fields:{}, conflicts:[], sources:[] }); return found.get(n); };
  const put = (e, key, value, line) => {
    if (value === undefined || !e) return;
    if (e.fields[key] !== undefined && e.fields[key] !== value) e.conflicts.push(`${key}: ${e.fields[key]} / ${value} (${line})`);
    else e.fields[key] = value;
    if (!e.sources.includes(line)) e.sources.push(line);
  };
  input.replace(/\r/g,'').split('\n').forEach((line,index) => {
    const comments = [], code = line.replace(/\(([^)]*)\)/g, (_, c) => { comments.push(c); return ' '; }).replace(/;(.*)$/, (_,c) => { comments.push(c); return ''; });
    if (/\bG0?20\b/i.test(code) || /BEGIN PGM.*\bINCH\b/i.test(code)) scale = 25.4;
    if (/\bG0?21\b/i.test(code) || /BEGIN PGM.*\bMM\b/i.test(code)) scale = 1;
    for (const m of code.matchAll(/\bT\s*0*(\d+)\b|\bTOOL\s+(?:CALL|DEF)\s+(\d+)\b/gi)) { const n = Number(m[1] || m[2]); entry(n); active = n; }
    comments.forEach(comment => {
      const m = comment.match(/\bT\s*0*(\d+)\b|\bTOOL\s*(?:NUMBER|NO\.?|NUM)?\s*[:=]\s*(\d+)\b/i);
      if (m) active = Number(m[1] || m[2]);
      const e = active && entry(active); if (!e) return;
      const read = aliases => { const match = comment.match(new RegExp(`(?:^|[\\s,])(?:${aliases})\\s*[:=]\\s*([+]?(?:\\d+(?:\\.\\d*)?|\\.\\d+))(?![\\d.])`, 'i')); return match ? Number(match[1]) : undefined; };
      const dimensions = { d:'D|DIAMETER|TOOL[ _]DIAMETER|DIA', cr:'CR|(?:TOOL[ _])?CORNER[ _]RADIUS|TIP[ _]RADIUS', l:'L|GAUGE[ _]LENGTH', lc:'LC|(?:TOOL[ _])?FLUTE[ _]LENGTH|CUTTING[ _]LENGTH', s:'S|STICK[ _-]?OUT', dh:'DH|HOLDER[ _]DIAMETER' };
      for (const [key,aliases] of Object.entries(dimensions)) { const v = read(aliases); if (v !== undefined) put(e,key,Math.round(v * scale * 1e6)/1e6,index+1); }
      for (const [key,aliases] of Object.entries({tip:'TIP|TAPER|TIP[ _]ANGLE',z:'Z|FLUTES|TEETH'})) put(e,key,read(aliases),index+1);
      const name = comment.match(/\b(?:TOOL[ _]NAME|NAME)\s*[:=]\s*(.+)$/i); if (name) put(e,'name',name[1].trim(),index+1);
      const type = comment.match(/\bTYPE\s*[:=]\s*(flat|ball|bull|drill|chamfer)\b/i)?.[1]?.toLowerCase() || (/drill|vrták/i.test(comment)?'drill':/chamfer|countersink/i.test(comment)?'chamfer':/ball[ -]?(?:nose|end|mill)/i.test(comment)?'ball':/flat[ -]end/i.test(comment)?'flat':/bull[ -]nose|tip[ -]?radiused|toroid/i.test(comment)?'bull':undefined);
      if (!type && /end[ -]mill|face[ -]mill/i.test(comment)) put(e,'kind','mill',index+1);
      if (type) { put(e,'kind',['drill','chamfer'].includes(type)?'cone':'mill',index+1); put(e,'shape',type,index+1); }
    });
  });
  return [...found.values()].sort((a,b)=>a.t-b.t).map(e => {
    const f=e.fields;
    if (f.shape === 'ball' && f.d !== undefined) {
      if (f.cr !== undefined && f.cr !== f.d / 2) e.conflicts.push(`cr: ${f.cr} / ${f.d / 2} (ball)`);
      f.cr = f.d / 2;
    }
    if (['flat','drill','chamfer'].includes(f.shape) && f.cr > 0) e.conflicts.push(`cr: ${f.cr} / 0 (${f.shape})`);
    if (['flat','drill','chamfer'].includes(f.shape) && f.cr === undefined) f.cr = 0;
    // A shape name does not establish a drill point angle or any axial lengths.
    e.missing = ['d','kind','cr','l','lc','s','dh','z',...(f.kind === 'cone'?['tip']:[])].filter(k=>f[k] === undefined);
    return e;
  });
}
