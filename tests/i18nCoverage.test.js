// Slovenské texty mimo prekladu: každý reťazec s diakritikou musí byť prvým argumentom L / LL, súčasťou
// dvojice SK / EN (susedný argument alebo prvok poľa, kľúč sk / labelEn / helpEn) alebo na zozname výnimiek.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import * as espree from 'espree';
import { KEYS } from 'eslint-visitor-keys';

const SK = /[áäčďéíĺľňóôŕšťúýžÁČĎÉÍĽŇÓŠŤÚÝŽ]/;
// vlastné mená, české štítky na stroji Elektrokov, dvojjazyčné hlavičky
const ALLOW = /Čelákovice|SVAŘ|NABÍJ|PŘÍSTŘEŠKEM|CSV hlavička \/ CSV header|^Mosadz|^Oceľ|^Hliník/;
const files = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = `${d}/${f}`;
    if (statSync(p).isDirectory()) {
      if (f !== 'assets') walk(p);
    } else if (/\.(jsx?|mjs)$/.test(f)) files.push(p);
  }
})(new URL('../src', import.meta.url).pathname);

const str = (x) =>
  x &&
  ((x.type === 'Literal' && typeof x.value === 'string') ||
    ['TemplateLiteral', 'ConditionalExpression'].includes(x.type));
function untranslated(file) {
  const src = readFileSync(file, 'utf8'),
    ast = espree.parse(src, { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true }, loc: true }),
    out = [];
  const visit = (n, anc) => {
    if (!n || typeof n.type !== 'string') return;
    let txt = null;
    if (n.type === 'Literal' && typeof n.value === 'string') txt = n.value;
    else if (n.type === 'TemplateLiteral') txt = n.quasis.map((q) => q.value.cooked).join('…');
    else if (n.type === 'JSXText') txt = n.value.trim();
    if (txt && SK.test(txt) && !ALLOW.test(txt)) {
      const chain = [...anc, n];
      const ok = chain.some((a, i) => {
        const child = chain[i + 1];
        if (!child) return false;
        if (a.type === 'CallExpression' || a.type === 'NewExpression') {
          const k = a.arguments.indexOf(child);
          if (k < 0) return false;
          if (k === 0 && ['L', 'LL', 'tx'].includes(a.callee.name)) return true;
          return str(a.arguments[k + 1]);
        }
        if (a.type === 'ArrayExpression') return str(a.elements[a.elements.indexOf(child) + 1]);
        if (a.type === 'Property' && a.value === child) {
          const key = a.key?.name || a.key?.value;
          const obj = chain[i - 1];
          return (
            key === 'sk' ||
            /Sk$/.test(key) ||
            obj?.properties?.some((p) => (p.key?.name || '').startsWith(key) && /En$/.test(p.key?.name || ''))
          );
        }
        return a.type === 'Property' && a.key === child;
      });
      if (!ok) out.push(`${file.split('/src/')[1]}:${n.loc.start.line} ${txt.slice(0, 70)}`);
      return;
    }
    for (const k of KEYS[n.type] || []) {
      const v = n[k];
      if (Array.isArray(v)) v.forEach((c) => visit(c, [...anc, n]));
      else if (v) visit(v, [...anc, n]);
    }
  };
  visit(ast, []);
  return out;
}

describe('preklad', () => {
  it('slovenské texty majú anglický ekvivalent', () => {
    expect(files.flatMap(untranslated)).toEqual([]);
  });
});
