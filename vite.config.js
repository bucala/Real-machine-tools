import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Zdroj: index.html + src/, statické súbory: static/.
// Výstup ide do public/ a commituje sa – nasadenie (npx wrangler deploy aj Workers Builds z Gitu)
// tak nepotrebuje build krok a nastavenia Cloudflare zostávajú nezmenené.
export default defineConfig({
  plugins: [react()],
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
