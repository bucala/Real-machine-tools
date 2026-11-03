import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

// Vygeneruje public/sw.js so zoznamom všetkých súborov buildu (offline režim).
// Písma sa ukladajú len v latinke (latin, latin-ext) – ostatné sady znakov aplikácia nepotrebuje.
function serviceWorker() {
  return {
    name: 'rmt-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const staticFiles = readdirSync('static').filter((f) => !['_headers', 'sw.js'].includes(f)).sort();
      const built = Object.keys(bundle).filter((f) => !f.endsWith('.map') && f !== 'index.html')
        .filter((f) => !/\.woff2?$/.test(f) || (/-latin(-ext)?-\d+-normal-.*\.woff2$/.test(f))).sort();
      const files = ['/', ...staticFiles.map((f) => `/${f}`), ...built.map((f) => `/${f}`)];
      const h = createHash('sha256');
      files.forEach((f) => h.update(f));
      staticFiles.forEach((f) => h.update(readFileSync(`static/${f}`)));
      const src = readFileSync('sw-template.js', 'utf8')
        .replace('__VERSION__', h.digest('hex').slice(0, 12))
        .replace('__PRECACHE__', JSON.stringify(files, null, 2));
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
        // three.js a 3D jadro v jednom spoločnom súbore: menu ho nepotrebuje, stroje ho zdieľajú
        manualChunks(id) {
          if (id.includes('/node_modules/three/')) return 'core3d';
          if (/\/src\/core\/(stage|kit|workInspect|particles|heightField|controls|inspector)\.js$/.test(id)) return 'core3d';
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{js,jsx}'],
  },
});
