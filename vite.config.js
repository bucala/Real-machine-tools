import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

// Vygeneruje public/sw.js (offline režim).
// PRECACHE = menu a jeho závislosti (uložia sa pri prvej návšteve); stroje sa ukladajú až pri prvom otvorení
// alebo naraz tlačidlom v menu (ALL). Skryté stroje (v App.jsx `hidden: true`) sa vopred neukladajú.
// Písma sa ukladajú len v latinke (latin, latin-ext) – ostatné sady znakov aplikácia nepotrebuje.
const HIDDEN_CHUNKS = ['shuangli', 'shaper'];
function serviceWorker() {
  return {
    name: 'rmt-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const staticFiles = readdirSync('static').filter((f) => !['_headers', 'sw.js'].includes(f)).sort();
      const font = (f) => /\.woff2?$/.test(f);
      const built = Object.keys(bundle).filter((f) => !f.endsWith('.map') && f !== 'index.html')
        .filter((f) => !font(f) || (/-latin(-ext)?-\d+-normal-.*\.woff2$/.test(f))).sort();
      // menu: vstupný chunk, jeho statické importy a CSS
      const shell = new Set();
      const visit = (f) => {
        const ch = bundle[f]; if (!ch || shell.has(f)) return; shell.add(f);
        if (ch.type === 'chunk') { ch.imports.forEach(visit); (ch.viteMetadata?.importedCss || []).forEach((c) => shell.add(c)); }
      };
      Object.keys(bundle).filter((f) => bundle[f].type === 'chunk' && bundle[f].isEntry).forEach(visit);
      const hidden = (f) => HIDDEN_CHUNKS.some((h) => f.startsWith(`assets/${h}-`));
      const precache = ['/', ...staticFiles.map((f) => `/${f}`), ...built.filter((f) => shell.has(f) || font(f)).map((f) => `/${f}`)];
      const all = ['/', ...staticFiles.map((f) => `/${f}`), ...built.filter((f) => !hidden(f)).map((f) => `/${f}`)];
      const h = createHash('sha256');
      all.forEach((f) => h.update(f));
      staticFiles.forEach((f) => h.update(readFileSync(`static/${f}`)));
      const src = readFileSync('sw-template.js', 'utf8')
        .replace('__VERSION__', h.digest('hex').slice(0, 12))
        .replace('__PRECACHE__', JSON.stringify(precache, null, 2))
        .replace('__ALL__', JSON.stringify(all, null, 2));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: src });
    },
  };
}

// Zdroj: index.html + src/, statické súbory: static/.
// Výstup ide do public/ a commituje sa – nasadenie (npx wrangler deploy aj Workers Builds z Gitu)
// tak nepotrebuje build krok a nastavenia Cloudflare zostávajú nezmenené.
export default defineConfig({
  plugins: [react(), serviceWorker()],
  publicDir: 'static',
  build: {
    outDir: 'public',
    emptyOutDir: true,
    target: 'es2020',
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // three.js a 3D jadro v jednom spoločnom súbore: menu ho nepotrebuje, stroje ho zdieľajú.
        // Drobné pomocné funkcie, ktoré používa aj menu, majú vyššiu prioritu – inak by ich skupina core3d
        // zachytila ako závislosť a menu by sťahovalo celé three.js.
        codeSplitting: {
          groups: [
            { name: 'util', test: /\/src\/core\/util\.js$/, priority: 2 },
            { name: 'core3d', test: /\/node_modules\/three\/|\/src\/core\/(stage|kit|workInspect|particles|heightField|controls|inspector|export)\.js$/, priority: 1 },
          ],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{js,jsx}'],
  },
});
