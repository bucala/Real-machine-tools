// Prenesie src/machines.jsx do public/index.html (blok medzi značkami MACHINES START / END).
// node tools/sync-index.mjs          – zapíše index.html
// node tools/sync-index.mjs --check  – len skontroluje zhodu (návratový kód 1 pri rozdiele)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const SRC = `${root}src/machines.jsx`, HTML = `${root}public/index.html`;
const START = '// ===== MACHINES START =====\n', END = '// ===== MACHINES END =====';

const lines = readFileSync(SRC, 'utf8').split('\n');
while (lines.length && (/^import .* from '[^']+';/.test(lines[0]) || lines[0].trim() === '')) lines.shift();
while (lines.length && (/^export /.test(lines[lines.length - 1]) || lines[lines.length - 1].trim() === '')) lines.pop();
const body = `${lines.join('\n')}\n`;

const html = readFileSync(HTML, 'utf8');
const a = html.indexOf(START), b = html.indexOf(END);
if (a < 0 || b < a) { console.error('index.html: značky MACHINES START / END sa nenašli'); process.exit(2); }
const next = html.slice(0, a + START.length) + body + html.slice(b);

if (process.argv.includes('--check')) {
  if (next !== html) { console.error('public/index.html nie je zhodný so src/machines.jsx – spusti: node tools/sync-index.mjs'); process.exit(1); }
  console.log('public/index.html je zhodný so src/machines.jsx');
} else if (next !== html) { writeFileSync(HTML, next); console.log('public/index.html aktualizovaný'); }
else console.log('public/index.html je už aktuálny');
