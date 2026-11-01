# Real-machine-tools

Interaktívne 3D modely konvenčných obrábacích strojov v prehliadači.

## Hrotový sústruh

Simulátor konvenčného hrotového sústruhu v štýle strojov TOS SN / VDF (React + Three.js r128 + Tailwind).

- Lôžko, vretenník, 3-čeľusťové skľučovadlo s mosadzným obrobkom Ø90 mm, suport s priečnymi saňami a nožovou hlavou, koník s pinolou, vodiaca skrutka a ťažná tyč.
- Štart/stop vretena, posuvy Z a X, pinola a poloha koníka; ručné kolesá sa otáčajú podľa posuvu.
- Rezanie obrobku s trieskami, automatický posuv v mm/ot, kontrola kolízií (suport, koník, pinola, obrobok).
- **Ručné ovládanie (kláves M):** pohľad sa zamkne a myšou sa ovládajú ručné kolesá, páky otáčok a posuvov, hlavný vypínač, tlačidlá Štart/Stop/osvetlenie, núdzový STOP aj koník.

### Súbory

| Cesta | Obsah |
| --- | --- |
| `public/index.html` | Samostatná stránka (knižnice z CDN), nasadzuje sa na Cloudflare |
| `wrangler.jsonc` | Konfigurácia Cloudflare Workers so statickými súbormi z `public/` |
| `src/LatheSimulator.jsx` | Ten istý komponent ako React modul (`export default`), vyžaduje `three@0.128` |

### Lokálne spustenie

```bash
npx serve public
```

### Nasadenie

Živá verzia: https://real-machine-tools.marcel-bucala.workers.dev

```bash
npx wrangler deploy
```
