# Audit aplikácie Real machine tools

*Stav kódu: commit `0cef01b` (2. 11. 2026) · rozsah: `public/index.html`, `src/machines.jsx`, `wrangler.jsonc`, `README.md`*

## 1. Zhrnutie

Real machine tools je funkčne bohatá a technicky vydarená aplikácia: sedem 3D simulátorov (sústruh, fréza, vŕtačka, ohýbačka, brúska, pásová píla, oblúková zváračka) s reálnym odoberaním materiálu, kontrolou kolízií, ručným ovládaním prvkov stroja, dvoma jazykmi a troma vzhľadmi. Spoločné jadro (`createStage`, `createControls`, `createInspector`, `createWorkInspect`, `createHeightField`) je dobre navrhnuté a správne uvoľňuje prostriedky – pri teste som nenašiel únik pamäte ani WebGL kontextov.

Slabiny sú najmä **v dodávaní a prevádzke**, nie v samotnej simulácii:

| # | Najdôležitejšie zistenie | Závažnosť | Stav |
|---|---|---|---|
| 1 | Bez WebGL (alebo pri akejkoľvek chybe v scéne) sa zobrazí **úplne prázdna stránka** bez vysvetlenia | vysoká | ✅ hláška s návodom a cestou späť, upozornenie v menu |
| 2 | Aplikácia sa pri každom načítaní **prekladá v prehliadači** (Babel ~2,9 MB) a štýly generuje **Tailwind Play CDN**, ktorý nie je určený na produkciu; počas načítania je stránka prázdna | vysoká | ✅ build cez Vite, úvodná obrazovka počas načítania |
| 3 | Päť externých skriptov **bez SRI a bez CSP**; pri výpadku ktoréhokoľvek CDN aplikácia nefunguje | vysoká | ✅ všetko z vlastnej domény, prísne CSP, offline režim (service worker), inštalácia ako aplikácia |
| 4 | Záblesk oblúka a svetlo oblúka **blikajú náhodne každý snímok** a nerešpektujú `prefers-reduced-motion` (riziko pre fotosenzitívnych používateľov) | vysoká | ✅ pomalé kolísanie, prepínač efektov, rešpektuje `prefers-reduced-motion` |
| 5 | Kód je **dvakrát** (index.html + src/machines.jsx), v jednom súbore s 5 137 riadkami, bez testov, lintu a CI | stredná | ✅ jeden zdroj v 19 moduloch, ESLint, 46 testov, CI |
| 6 | Scéna sa **renderuje nepretržite** aj v kľude (vrátane tieňových máp), panel sa prekresľuje 10× za sekundu | stredná | ✅ kreslí sa len pri zmene, panel len pri zmene hodnôt, obrobok a zvar sa prestavujú len v zmenenej oblasti |
| 7 | Posuvník otáčok v paneli **obchádza blokovanie prevodovky**, ktoré páky v modeli dodržiavajú | stredná | ✅ otáčky a posuvy len zo stupňov prevodovky; zamknuté aj X brúsky pri pohybe stola, hláška pri rýchlosti pásu píly |

Celkové hodnotenie: **simulácia 8/10, architektúra a údržba 5/10, dodanie a prevádzka 4/10, prístupnosť 6/10.** Väčšinu problémov z bodov 1 – 4 a 7 sa dá odstrániť za 1 – 2 dni; bod 2, 3 a 5 rieši jeden krok – zavedenie zostavenia (build) cez Vite.

### Stav opráv – fáza 1 (3. 11. 2026)

| Zistenie | Stav | Čo sa zmenilo |
|---|---|---|
| V1 prázdna stránka bez WebGL | ✅ opravené | `SimBoundary` okolo každého simulátora (hláška, „Späť do menu“, „Načítať znova“); v menu len skryteľné upozornenie s návodom na zapnutie akcelerácie (Chrome / Edge, Firefox, Safari) a odkazmi na stiahnutie prehliadača – stroje sa dajú otvoriť aj tak |
| V2 prázdna stránka počas načítania | ✅ čiastočne | indikátor načítania v `#root`, `<noscript>`; preklad v prehliadači zostáva do fázy 2 (Vite) |
| V3 skripty bez SRI | ✅ čiastočne | `integrity` + `crossorigin` pre React, ReactDOM, three.js (overené voči API cdnjs) a Babel; pri výpadku CDN hláška namiesto nekonečného načítania. Tailwind Play CDN generuje skript dynamicky, SRI sa naň dať nedá – odstráni ho fáza 2 |
| V4 blikanie oblúka | ✅ opravené | kolísanie ~11× za s namiesto každého snímku, prepínač „Efekty záblesku“, pri `prefers-reduced-motion` predvolene vypnutý (plynulé rozjasnenie bez záblesku), upozornenie na karte zvárania |
| S1 duplicitný kód | ✅ zmiernené | `tools/sync-index.mjs` generuje blok v `index.html` zo `src/machines.jsx`, `--check` overí zhodu |
| S7 panel obchádza prevodovku | ✅ opravené | otáčky sústruhu, frézy a vŕtačky len zo stupňov prevodovky a len pri stojacom vretene; posuvy sústruhu a frézy zo stupňov prevodovky |
| S8 živá oblasť | ✅ opravené | priebežné údaje (`run`, `idle`) majú `aria-live="off"`, hlásky a varovania sa naďalej oznamujú |
| N4 drobnosti | ✅ opravené | odstránené mŕtve volanie `span`, `window.__weld` sa pri odchode zo zvárania zmaže |
| N5 – N7 prístupnosť | ✅ opravené | dotykové ciele ≥ 24 px, sekcie panelu `<h2>`, fokus na nadpis po prechode menu ↔ stroj |
| N8 meta a ikona | ✅ čiastočne | ikona (SVG), `theme-color`, Open Graph; manifest a offline režim vo fáze 4 |

### Stav opráv – fázy 2 a 3 (3. 11. 2026)

| Zistenie | Stav | Čo sa zmenilo |
|---|---|---|
| V2 preklad v prehliadači, Tailwind Play CDN | ✅ opravené | build cez Vite 8; Babel ani Tailwind CDN sa už nenačítavajú, Tailwind sa generuje pri builde (6 kB gzip). Menu sa v teste načíta za 0,45 s namiesto 1,9 s |
| V3 externé skripty, CSP | ✅ opravené | všetko vrátane písiem (`@fontsource`) sa servíruje z vlastnej domény; `static/_headers` nastavuje prísne CSP (`script-src 'self'`, `style-src 'self'`), `nosniff`, `Referrer-Policy`, `Permissions-Policy` a dlhú cache pre `assets/`. Aplikácia nič neposiela tretím stranám (ani Google Fonts) |
| S1 duplicitný kód | ✅ opravené | jediný zdroj v `src/`, `public/` je výstup buildu; CI kontroluje, že commitnutý `public/` zodpovedá zdrojom |
| S2 monolit, testy, nástroje | ✅ opravené | `src/machines.jsx` rozdelený na 19 modulov (`core/`, `ui/`, `machines/`, `App.jsx`) s importmi odvodenými z kódu; `package.json` s pevnými verziami, ESLint, 42 testov vo Vitest, GitHub Actions (lint, testy, build) |
| S4 nepretržité renderovanie | ✅ opravené | `createStage` kreslí len pri zmene scény, kamery alebo pri vstupe používateľa, inak 4× za s; tiene sa prepočítajú len pri zmene scény. Stojaci sústruh: 16 vykreslení za 4 s namiesto 241 |
| S5 prestavba výškových máp | ✅ opravené | fréza a brúska: `cutRect` si pamätá zasiahnutú oblasť a `rebuild()` prepočíta polohy, farby a normály len v nej (výsledok zhodný s `computeVertexNormals`, overené testom), do GPU ide len dotknutý pás riadkov; zváranie: chladnutie aj prefarbenie žiary len v obdĺžniku ohriatych buniek |
| S6 panel 10× za sekundu | ✅ opravené | `useTele` nastaví stav len pri skutočnej zmene hodnôt – stojaci stroj panel neprekresľuje |
| N1 alokácie v slučke | ✅ opravené | zváranie: pomocné vektory a kvaternión sa vytvárajú raz, kábel držiaka sa prestavuje najviac 20× za s; DRO sústruhu a frézy sa prekreslí len pri zmene údaja |
| N2 častice | ✅ opravené | `createParticles` používa `InstancedMesh` – jedno vykreslenie na druh častíc namiesto stoviek; ležiace častice sa neposielajú znova do GPU |
| N3 rozlíšenie výškovej mapy | ✅ opravené (fréza) | bunka ~1,2 mm podľa rozmeru obrobku (najviac 40 000 vrcholov) namiesto pevných 108 × 60 |
| – | ✅ nové | testy odhalili chybu v `eachRect`: uzly presne na hrane obdĺžnika vypadávali kvôli zaokrúhleniu – opravené toleranciou |
| – | ✅ nové | stroje sa načítavajú postupne (`React.lazy`): menu 58 kB gzip, 3D jadro s three.js 140 kB, každý stroj 6 – 20 kB; pri výpadku siete samostatná hláška |
| V3 offline režim | ✅ opravené | service worker (`sw-template.js` → `public/sw.js`) pri prvej návšteve uloží všetky súbory aplikácie; stránka sa načítava najprv zo siete, bez siete z pamäte. Manifest a ikony PNG – aplikácia sa dá nainštalovať |
| S7 ďalšie stroje | ✅ opravené | brúska: posuvník stola X je pri zapnutom pohybe tam a späť zamknutý ako ručné koleso; píla: pri pokuse zmeniť rýchlosť pásu za chodu sa zobrazí dôvod; fréza, vŕtačka a sústruh vynucujú zaistenia v hlavnej slučke, výmena nástroja je strážená |
| S3 zastarané závislosti | ⏳ fáza 5 | three.js r128 a React 18 zostávajú; build už umožňuje prechod bez CDN obmedzení |

### Stav – fázy 4 a 5 (3. 11. 2026)

| Oblasť | Stav | Čo pribudlo |
|---|---|---|
| Fáza 5: three.js a React | ✅ | three r128 → r186.1, React 18 → 19.3.1; vzhľad overený porovnaním snímok všetkých strojov (priemerný rozdiel 1,2 – 2,6 z 255), bez varovaní |
| Úlohy s kontrolou | ✅ | 13 úloh na 7 strojoch (`ui/tools.jsx` – `TaskSection`), kontroly ako čisté funkcie (`latheMath.js`, `core/hfMath.js`, `shopMath.js`) pokryté testami; percentá, známka, čas, počet varovaní |
| Režim učiteľa | ✅ | odkaz `#stroj/uloha=…` otvorí stroj s úlohou a zapnutou kontrolou BOZP |
| Závity | ✅ | závitový nôž 60°, páka a prepínač matice vodiacej skrutky (vylučuje sa s posuvom), posuv P na otáčku, skrutkovicová geometria, kontrola zmiešaného stúpania |
| Meradlá | ✅ | sústruh (posuvné meradlo 0,02 / mikrometer 0,01, tabuľka osadení, závit), fréza (hĺbkomer), vŕtačka (diery a rozostup), brúska (úbytok, rovinnosť) |
| Kalkulačka rezných podmienok | ✅ | sústruh, fréza, vŕtačka; HSS / SK, nastavenie najbližšieho stupňa |
| Kontrola BOZP | ✅ | kontrolné zoznamy pre 6 strojov (pri zváraní pred prepnutím do režimu Zváranie) |
| Zvuk | ✅ | Web Audio syntéza bez súborov, predvolene vypnutý, predvoľba sa pamätá |
| Uloženie a export | ✅ | uloženie obrobku (sústruh, fréza, vŕtačka, brúska), STL v mm (okrem vŕtačky, kde sú diery len vizuálne), PNG |
| Adaptívna kvalita | ✅ | pri < ~22 snímkach/s pri práci najprv rozlíšenie 1×, potom bez tieňov lámp; `?hq` vypne |
| Ďalšie jazyky (CZ, DE, HU) | ⏳ | vyžaduje presunúť ~2 000 textov z `L('sk', 'en')` do slovníkov – samostatný krok |
| Výmena elektródy | ✅ | pri dohorenej elektróde vyskočí tlačidlo „Vymeň elektródu“ (aj E); animácia: držiak sa zdvihne, ohorok vypadne, nová elektróda sa zasunie do čeľustí |
| Zváranie MIG/MAG | ✅ | 8. stroj `#mag` – Fronius TransPuls Synergic TPS 450 s podávačom VR 4000, chladením FK a fľašou; synergia (`migMath.js`), 2T/4T, štandard/impulz, plynová ochrana a póry, 3 úlohy (`migChecks`) |
| Tvar a poloha polotovarov | ✅ | skupiny rovinné / kolmé / kruhové / tvarové plechy; spoj je ľubovoľná krivka (`weldShape.js`), rúra – rúra sa zobrazuje na valci s polohami PH, PJ, H-L045 a PC; hodnotenie po krivke je pri priamych spojoch zhodné s pôvodným (test) |
| Obrážačka TOS | ✅ | `#obrazacka` (v menu skrytá, dostupná odkazom): kulisový mechanizmus s rýchlym spätným chodom, sklopná doska, západkový posuv, 4 nože, 3 úlohy (`shaperMath.js`) |
| Rez zvarom, zvarová mierka, viacvrstvové zvary | ✅ | makrovýbrus v ľubovoľnom mieste, natavenie, vrstvy, vtrúseniny, mierka h / b / a (`sectionMetrics`), polohovadlo rúr, 2 nové úlohy |
| Deliaci prístroj na fréze | ✅ | tyč r(x, θ), delenie n = 40 / z s kruhom dier, aretácia, koník, úlohy šesťhran a štvorhran (`millIndex.js`) |
| Zvislá obrážačka TOS ST 350 | ✅ | `#zobrazacka` za brúskou: zvislé smykadlo s kulisou, krížový a otočný stôl s delením, prierez triesky, úlohy drážka 12 × 3,3 a štvorhran 25 × 25 (`slotterMath.js`) |
| Profilová ohýbačka COMAC 3025 HV | ✅ | 11. stroj `#profilova` za ohýbačkou plechu: tri valce v pyramíde, pružno-plastický ohyb s odpružením, 5 profilov, tvarové valce, vodiace kladky, poloha H / V, 3 úlohy (`benderMath.js`) |
| Sústruh: veľkosti a vybavenie | ✅ | TOS SN 32 / 40 / 50 / 55 (mierka stroja, mm obrobku zachované, `profileInfo(u)`), kryt skľučovadla s mikrospínačom, chladenie, zadný kryt, pevná a pohyblivá luneta, kryt skrutiek, nožná brzda |
| Radiálna vŕtačka TOS VO 50 | ✅ | `#radialka`: model podľa VO 50 (základová doska, príruba stĺpa, horná skriňa, rozvádzač na plášti, skriňové rameno), otočné rameno, vreteník na ramene, upínanie stĺpa a vreteníka, automatický posuv s dorazom, úlohy rozteč a príruba (`radialMath.js`) |
| Hrotová brúska na guľato | ✅ | `#gulato`: hydraulický stôl s dorazmi, prísuv 0,005 mm, odtláčanie a vyiskrovanie, prepal, úlohy h6 a h5 (`cylMath.js`) |
| Horizontálka TOS Varnsdorf | ✅ | `#horizontalka`: vreteník Y, vreteno W, sane Z, stôl X, otočný stôl B; vyvrtávanie s priehybom tyče, úlohy Ø80 H7 a súosé otvory (`horizMath.js`) |
| Odvalovacia frézka | ✅ | `#odvalovacka`: výmenné kolesá delenia, sklon frézy, hĺbka 2,25 · m, Wk (`hobMath.js`) |
| Zakružovačka plechu TOS XZC 3000/10 | ✅ | `#zakruzovacka`: trojvalcová pyramída, prísuv horného valca kolesom, odpruženie, predohnutie koncov podložným plechom, odklopné ložisko s kolíkom (`plateMath.js`) |
| Tabuľové nožnice BS 2000/8 | ✅ | `#noznice`: model podľa BS 2000/8 (horný kryt výstredníka, hrebeňový kryt, pedálová tyč, pohon vľavo), plech do 8 mm, zadný doraz, uholník, vôľa nožov, kryt prstov, kapacita (`shearMath.js`) |

## 2. Rozsah a metodika

- **Prehliadka kódu** – celé jadro (riadky 1 – 1 100), celý simulátor sústruhu, kľúčové časti frézy a zvárania, životný cyklus (`useEffect`, `requestAnimationFrame`, `dispose`, poslucháči udalostí) vo všetkých siedmich simulátoroch.
- **Kontrola zhody** `public/index.html` ↔ `src/machines.jsx` – blok medzi `MACHINES START/END` je zhodný so `src/machines.jsx` (rozdiel sú len importy a exporty).
- **Spustenie v headless Chromiu** (Playwright, SwiftShader, knižnice z npm v rovnakých verziách ako CDN): menu + všetkých 7 strojov, 21 prepnutí medzi strojmi kvôli únikom, mobilné rozlíšenie 390 × 844, beh bez WebGL.
- **Meranie veľkosti** načítavaných knižníc a času prekladu Babelom.

FPS namerané v SwiftShaderi (softvérové vykresľovanie) nie sú porovnateľné so skutočným GPU – slúžia len na relatívne porovnanie strojov (najnáročnejší je sústruh a zváranie).

## 3. Silné stránky

- **Správa prostriedkov:** každý simulátor v `useEffect` ruší `requestAnimationFrame`, odpája poslucháčov a `createStage().dispose()` uvoľní geometrie, materiály, textúry, PMREM a vynúti stratu WebGL kontextu (`src/machines.jsx:268-277`). Po 21 prepnutiach bola halda 20 MB, teda **bez úniku**.
- **Spoločné jadro** – orbit kamera s dotykom a pinch-zoomom, ručné ovládanie kolies a pák premietnuté na dotyčnicu obvodu (`:606-629`), odopnutie obrobku, výšková mapa – všetko znovu použité vo všetkých strojoch.
- **Kvalita simulácie** – nástroj reže podľa skutočného tvaru ostria (`LATHE_TOOLS[].prof`), bok noža voči materiálu sa kontroluje zvlášť (`penetration().side`), zváranie má tepelné pole, popúšťacie farby, šupiny húsenice a hodnotenie zvaru.
- **Rozhranie** – dobré farebné tokeny pre 3 vzhľady, `aria-pressed` na prepínačoch, `label` pri posuvníkoch, `:focus-visible`, `role="status"`, `lang` na `<html>`, ošetrené `env(safe-area-inset-*)`, na mobile bez vodorovného posunu (overené).
- **Odolnosť** – `localStorage` a DOM operácie sú v `try/catch`, neznámy hash v URL vráti menu.

## 4. Zistenia

Závažnosť: **V** = vysoká, **S** = stredná, **N** = nízka. Stav: **overené** = reprodukované za behu, **z kódu** = zistené čítaním kódu.

### 4.1 Spoľahlivosť a dodanie

#### V1 · Prázdna stránka bez WebGL alebo pri chybe · overené
`createStage` volá `new THREE.WebGLRenderer()` (`:211`) bez kontroly podpory. Výnimka v `useEffect` bez Error Boundary odpojí celý React strom. Pri spustení bez WebGL bolo `#root` prázdne a v konzole len `Error creating WebGL context.` Týka sa to starších počítačov v školských učebniach, vypnutej hardvérovej akcelerácie a niektorých firemných prehliadačov.

**Návrh:** detekcia WebGL pred vstupom do stroja + Error Boundary okolo simulátora s hláškou a tlačidlom späť do menu (kód v kapitole 5.1).

#### V2 · Preklad v prehliadači a Tailwind Play CDN · overené
`public/index.html:11-15` načítava `@babel/standalone` (2,87 MB, 606 kB gzip) a Tailwind Play CDN. Prehliadač pri každom načítaní prekladá ~400 kB JSX (v Node 0,7 s; na slabšom mobile odhadom niekoľkonásobne dlhšie). Babel to sám hlási v konzole (*„Be sure to precompile your scripts for production“*) a Tailwind Play CDN je podľa autorov určený len na vývoj. Kým preklad neskončí, `<div id="root">` je prázdny – používateľ nevidí ani indikátor načítania.

| Súbor | Veľkosť | gzip |
|---|---|---|
| `@babel/standalone` 7.24.7 | 2 866 kB | 606 kB |
| `three.min.js` r128 | 603 kB | 149 kB |
| `react` + `react-dom` 18.3.1 | 143 kB | 47 kB |
| `index.html` (vrátane JSX) | 401 kB | 125 kB |
| Tailwind Play CDN | nemerané (CDN nedostupné z testovacieho prostredia) | – |

**Návrh:** zostavenie cez Vite (kapitola 5.2). Výsledok: jeden predkompilovaný bundle (odhadom 250 – 300 kB gzip vrátane three.js a Reactu), bez Babelu a bez runtime Tailwindu. Okamžite aspoň pridať do `#root` statický text „Načítava sa…“, ktorý React po štarte nahradí.

#### V3 · Externé skripty bez SRI a CSP · z kódu
Päť skriptov z troch CDN (`cdn.tailwindcss.com`, `cdnjs.cloudflare.com`, `unpkg.com`) nemá atribút `integrity` ani `crossorigin`, stránka nemá Content-Security-Policy. Kompromitovaný alebo zmenený súbor na CDN by bežal s plnými právami stránky. Zároveň výpadok ktoréhokoľvek z nich znamená nefunkčnú aplikáciu a aplikácia nefunguje offline (dielňa, učebňa bez internetu).

**Návrh:** po zavedení buildu hostovať všetko z vlastnej domény (Cloudflare Workers assets) a pridať `public/_headers` s CSP a cache hlavičkami (kapitola 5.3). Do tej doby doplniť `integrity` + `crossorigin="anonymous"` k skriptom z cdnjs a unpkg.

#### V4 · Blikanie záblesku a oblúka · z kódu
- `:4645` – bez kukly má biela prekrývacia vrstva cez celú scénu náhodnú nepriehľadnosť 0,78 – 1,0 **v každom snímku** (60 – 144 Hz).
- `:4635-4637` – intenzita bodového svetla oblúka sa náhodne mení každý snímok (3,75 – 6,25), teda bliká celá scéna aj s kuklou.
- Každé zapálenie oblúka bez kukly = celoplošný biely záblesk; opakovaným klikaním sa ľahko prekročia 3 záblesky za sekundu (WCAG 2.3.1).
- Jediné ošetrenie `prefers-reduced-motion` je pre CSS prechody (`:145`).

**Návrh:** pri `prefers-reduced-motion` aj ako voľba v paneli: záblesk bez blikania so stlmenou intenzitou, plynulé (nízkofrekvenčné) kolísanie svetla oblúka, obmedzenie záblesku na 1× za sekundu; v menu pri karte zvárania krátke upozornenie (kapitola 5.4).

#### S1 · Duplicitný kód · z kódu
`public/index.html` obsahuje celú kópiu `src/machines.jsx`. Momentálne sú zhodné, ale synchronizácia je ručná a nič ju nekontroluje – stačí jedna oprava len na jednom mieste. **Návrh:** build z `src/` (kapitola 5.2); do tej doby aspoň skript, ktorý `index.html` generuje zo `src/machines.jsx`, a kontrola v CI.

#### S2 · Monolit bez testov a nástrojov · z kódu
- 5 137 riadkov v jednom súbore; každý simulátor je jeden `useEffect` uzáver s 400 – 900 riadkami, v ktorom je zmiešaná stavba modelu, fyzika, vstup myši, telemetria pre React aj texty.
- Žiadny `package.json`, testy, linter, formátovač ani CI. `wrangler.jsonc` odkazuje `$schema` na `node_modules/wrangler/…`, ktorý v repozitári nie je; `npx wrangler deploy` tak použije vždy najnovšiu verziu.
- Čistá logika (prienik a rez noža, `weldProfile`, `weldPrep`, `evalWeld`, výšková mapa, odpruženie plechu) je vhodná na jednotkové testy, ale je zamknutá v uzáveroch.

**Návrh:** štruktúra v kapitole 5.2; vytiahnuť výpočty do čistých funkcií a pokryť ich testami vo Vitest (napr. „rohový nôž neprejde bokom do osadenia“, „V-zvar 8 mm má medzeru a otupenie podľa tabuľky“).

#### S3 · Zastarané závislosti · z kódu
three.js r128 je z roku 2021. Novšie verzie odstránili API, ktoré aplikácia používa (`outputEncoding`, `sRGBEncoding`, `Color.convertSRGBToLinear`, zmena jednotiek svetiel). React 19 už neposkytuje UMD buildy, takže prístup cez CDN skripty zablokuje aj prechod na novší React. **Návrh:** po zavedení buildu postupný prechod na aktuálne three.js (premenovania sú mechanické, svetlá treba preladiť).

### 4.2 Výkon

#### S4 · Nepretržité renderovanie · z kódu
Každý simulátor volá `renderer.render()` v každom snímku (`:1762` a obdobne), aj keď stroj stojí a kamera sa nehýbe. Pri každom snímku sa prepočítajú tieňové mapy – slnko 2048 × 2048 s PCFSoft (`:239`) a pri strojoch s lampou ďalšia 1024 × 1024 (`:391`). Na notebookoch a tabletoch to znamená zbytočné vybíjanie batérie a zahrievanie.

**Návrh:** renderovať len pri zmene (pohyb kamery, vstup, bežiace vreteno, aktívne častice, animácia) a inak obmedziť slučku na ~10 FPS; `renderer.shadowMap.autoUpdate = false` a `needsUpdate = true` len keď sa niečo pohne (kapitola 5.5).

#### S5 · Celé prestavanie výškových máp · z kódu
`createHeightField.rebuild()` (`:535-545`) a `rebuildField` vo zváraní prepíšu všetky vrcholy a zavolajú `computeVertexNormals()` na celej sieti. Pri zvare s dĺžkou 250 mm má sieť ~124 000 vrcholov (`RES = 0,5 mm`, `:4274`) a prestavuje sa každých 100 ms **aj počas chladnutia** (`:4605-4610`), teda ešte niekoľko sekúnd po zhasnutí oblúka; navyše sa v každom snímku prechádza celé pole teplôt.

**Návrh:** sledovať obdĺžnik zmenených buniek, prepočítať len ten (vrátane normál) a použiť `BufferAttribute.updateRange`; chladnutie počítať len v okolí horúcich buniek alebo v nižšom rozlíšení.

#### S6 · Panel sa prekresľuje 10× za sekundu · z kódu
Hlavné slučky volajú `setTele({...})` každých 100 ms s novým objektom (`:1747`, `:4669`), takže React prekreslí celý panel (posuvníky, zoznamy dielov, `mkParts()`) aj keď sa nič nezmenilo. **Návrh:** zaokrúhliť hodnoty na zobrazenú presnosť a nastaviť stav len pri zmene; sekcie panelu obaliť `React.memo` (kapitola 5.6).

#### N1 · Alokácie v každom snímku · z kódu
`v3()`, `.clone()` a `new THREE.Quaternion()` v hlavnej slučke zvárania (`:4599`, `:4601`, `:4620`, `:4634`), nová `TubeGeometry` kábla pri každom pohybe držiaka (`:4626-4631`), kotvy popisov vracajú nový `Vector3` pre každý popis v každom snímku (`:1420-1431`, `:804`). Spôsobuje to tlak na garbage collector a mikrozáseky. **Návrh:** pomocné vektory vytvoriť raz; kábel aktualizovať prepisom pozícií existujúcej geometrie alebo s obmedzenou frekvenciou.

#### N2 · Častice ako samostatné objekty · z kódu
`createParticles` (`:494-499`) vytvára pre každú časticu vlastný `Mesh`; fréza má 160 triesok + 260 kvapiek, brúska 160 iskier + 160 hmly + 260 kvapiek. Triesky navyše vrhajú tiene. **Návrh:** `THREE.InstancedMesh` – jedno vykreslenie na typ častíc; triesky bez tieňov.

#### N3 · Pevné rozlíšenie výškových máp · z kódu
Fréza má sieť 108 × 60 bez ohľadu na rozmer obrobku (`:1875`) – pri 180 × 100 mm je bunka ~1,7 mm, takže drážka frézou Ø6 je viditeľne zubatá a pri dlhšom kuse sa to zhoršuje. Profil sústruhu má 340 úsekov (~2 mm pri najdlhšom kuse). **Návrh:** rozlíšenie odvodiť od rozmeru (napr. 1 mm na bunku s horným limitom počtu vrcholov).

### 4.3 Správanie a didaktika

#### S7 · Panel obchádza blokovania stroja · z kódu
Páky otáčok v modeli dovolia preradiť len pri stojacom vretene (`gearGuard`, `:1527`), ale posuvník v paneli zmení otáčky kedykoľvek a na ľubovoľnú hodnotu – sústruh `:1806`, fréza `:2525`, vŕtačka `:2962`. Posuvník sústruhu ide do 2 000 ot/min, hoci najvyšší stupeň stroja je 1 800 (`SPEEDS`, `:1057`). Pásová píla to rieši správne (`:4065`). Pre výučbový simulátor je to rozpor – žiak sa naučí, že sa dá preraďovať za chodu.

**Návrh:** v paneli ponúknuť len skutočné stupne (výber alebo `Seg`) a zmenu za chodu odmietnuť s rovnakou hláškou ako páka (kapitola 5.7).

#### N4 · Drobnosti v kóde · z kódu
- `:1476` – `span(cx, () => {})` je mŕtve volanie bez účinku.
- `:4700` – pri `?debug` sa nastaví `window.__weld`, ktoré po odchode zo stroja zostane a drží celú scénu v pamäti.
- Hlášky v `st.msg` sa vytvoria v jazyku platnom v čase vzniku; po prepnutí SK/EN ešte 2,6 s ukazujú pôvodný jazyk.
- Päť modulov registruje vlastných poslucháčov ukazovateľa na rovnaké plátno (orbit, inspector, controls, workInspect, zváranie s `capture` a `stopImmediatePropagation`). Poradie spracovania je implicitné a krehké – pri ďalšom režime ovládania hrozí, že si udalosti „ukradnú“. **Návrh:** jeden dispečer vstupu s explicitnou prioritou režimov.

### 4.4 Prístupnosť

| # | Zistenie | Návrh |
|---|---|---|
| S8 | `role="status"` (`:972`) je živá oblasť a počas rezu sa v nej každých 100 ms mení text (Ø, vc) – čítačka obrazovky by čítala neustále | živú oblasť použiť len pre hlášky (varovania, potvrdenia); priebežné údaje mimo nej |
| N5 | Tlačidlá `.seg` (~20 px) a vzorky vzhľadu `.swatch` (22 px) sú pod 24 × 24 px (WCAG 2.5.8) | zväčšiť klikateľnú plochu paddingom |
| N6 | Panel skáče z `<h1>` na `<h3>` | sekcie panelu ako `<h2>` |
| N7 | Po prechode menu → stroj sa fokus nepresunie | presunúť fokus na nadpis stroja (`tabIndex={-1}`) |
| – | Ovládanie 3D modelu len myšou | v poriadku, panel ponúka rovnaké funkcie klávesnicou; doplniť klávesové skratky pre pohľady (1 – 6) |

### 4.5 Repozitár a nasadenie

| # | Zistenie | Návrh |
|---|---|---|
| N8 | Chýba favicon, Open Graph / Twitter meta (náhľad pri zdieľaní odkazu), web manifest | doplniť; manifest + service worker umožní inštaláciu a offline beh |
| N9 | `docs/img` má 5,4 MB PNG, README sa načítava pomaly | prekomprimovať (oxipng) alebo WebP; README obrázky zmenšiť na 900 px |
| N10 | Žiadne cache hlavičky – pri bez-buildovom riešení sa 400 kB HTML sťahuje vždy celé | po builde hashované názvy súborov + `Cache-Control: immutable` |

## 5. Návrhy opráv

### 5.1 Kontrola WebGL a Error Boundary (V1)

```jsx
const hasWebGL = () => {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); }
  catch (err) { return false; }
};

class SimBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="menu"><div className="menu-inner">
        <h1 className="menu-title">{L('Simulátor sa nepodarilo spustiť', 'The simulator could not start')}</h1>
        <p className="menu-lead">{L('Prehliadač nepodporuje WebGL alebo je vypnutá hardvérová akcelerácia.', 'The browser does not support WebGL or hardware acceleration is off.')}</p>
        <button type="button" className="btn mt-4" onClick={this.props.onBack}>← {L('Späť do menu', 'Back to menu')}</button>
      </div></div>
    );
  }
}

// v App:
{m ? <SimBoundary key={m.id} onBack={() => go('')}><m.Comp lang={prefs.lang} onBack={() => go('')} /></SimBoundary> : <Menu onOpen={go} webgl={hasWebGL()} />}
```

V menu pri `webgl === false` zobraziť upozornenie nad kartami.

### 5.2 Build cez Vite a rozdelenie kódu (V2, V3, S1, S2)

```
package.json            vite, react, react-dom, three, vitest, eslint, wrangler (pevné verzie)
index.html              len <div id="root"> + <script type="module" src="/src/main.jsx">
src/main.jsx
src/core/               stage.js, orbit.js, controls.js, inspector.js, workInspect.js, heightField.js, particles.js, kit.js
src/ui/                 SceneView.jsx, Panel.jsx, Slider.jsx, Seg.jsx, PrefBar.jsx, i18n.js, theme.css
src/machines/lathe/     model.js (stavba scény), sim.js (čistá logika: prienik, rez, kolízie), LathePanel.jsx, index.jsx
src/machines/mill/ …    (rovnako pre ďalšie stroje)
tests/                  lathe.sim.test.js, weld.prep.test.js, heightField.test.js
```

- Tailwind cez PostCSS (`tailwindcss` 3.4 ako dev závislosť) – vygeneruje sa len použité CSS (~8 kB).
- `wrangler.jsonc` → `"assets": { "directory": "./dist" }`, `npm run deploy` = `vite build && wrangler deploy`.
- Simulátory načítavať cez `React.lazy(() => import('./machines/lathe'))`, menu sa tak zobrazí okamžite.
- GitHub Actions: `npm ci && npm run lint && npm test && npm run build` na každý PR.

### 5.3 Bezpečnostné a cache hlavičky (V3, N10)

`public/_headers` (Cloudflare Workers static assets):

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()

/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

Prísne CSP je možné až po odstránení Babelu (ten potrebuje `'unsafe-inline'`/`'unsafe-eval'`). Do tej doby aspoň SRI na skriptoch; hash pre každý súbor:

```bash
curl -s https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js | openssl dgst -sha384 -binary | openssl base64 -A
```

### 5.4 Šetrný záblesk a oblúk (V4)

```js
const REDUCED = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (err) { return false; } })();
let flick = 1, flickT = 0;                       // pomalé kolísanie namiesto náhody v každom snímku
// v slučke:
flickT += dt;
if (flickT > (REDUCED ? 1 : 0.12)) { flickT = 0; flick = 0.85 + Math.random() * 0.3; }
const fl = REDUCED ? 1 : flick;
arcLight.intensity = st.arc ? 5 * fl : 0;
const op = st.arc && !c.helmet ? (REDUCED || !c.flashFx ? 0.55 : 0.8 + 0.15 * fl) : Math.max(0, prevOp - dt * 2.5);
```

Plus prepínač „Efekt záblesku“ v paneli (predvolene zapnutý, pri `REDUCED` vypnutý) a upozornenie na karte zvárania v menu.

### 5.5 Renderovanie len pri zmene (S4)

```js
let wake = 0;                                   // čas, do ktorého treba renderovať plnou rýchlosťou
const poke = (s = 0.5) => { wake = Math.max(wake, t + s); };
dom.addEventListener('pointermove', () => poke(), { passive: true });
dom.addEventListener('wheel', () => poke(), { passive: true });
renderer.shadowMap.autoUpdate = false;

const loop = (nowMs) => {
  raf = requestAnimationFrame(loop);
  // ... simulácia ...
  const busy = st.rpm > 0 || st.job || st.cutting || particlesAlive() || insp.tweening() || wi.busy();
  if (busy) poke();
  if (t > wake && nowMs - lastRender < 100) return;        // v kľude ~10 FPS
  if (busy || t <= wake) renderer.shadowMap.needsUpdate = true;
  lastRender = nowMs;
  renderer.render(scene, camera);
};
```

Simulačný krok treba ponechať v každom snímku (alebo ho tiež uspať, keď nič nebeží) – inak sa zmení časovanie hlášok.

### 5.6 Menej prekresľovania panelu (S6)

```js
const r1 = (v) => Math.round(v * 10) / 10;
const next = { rpm: Math.round(st.rpm), z: r1(zmm), x: r1(dmm), /* … */ };
setTele((p) => (Object.keys(next).every((k) => p[k] === next[k]) ? p : next));
```

### 5.7 Otáčky v paneli podľa prevodovky (S7)

```jsx
<label className="text-sm font-semibold" htmlFor="rpm">{L('Otáčky vretena', 'Spindle speed')}</label>
<select id="rpm" className="sel" value={ui.rpm} disabled={ui.running || tele.rpm > 1}
  onChange={(e) => set('rpm', Number(e.target.value))}>
  {SPEEDS.map((n) => <option key={n} value={n}>{n} {RPM()}</option>)}
</select>
{(ui.running || tele.rpm > 1) && <p className="text-xs muted mt-1">{L('Otáčky sa preraďujú len pri stojacom vretene.', 'Speeds can only be changed with the spindle stopped.')}</p>}
```

Rovnako pre frézu (`MILL_SPEEDS`), vŕtačku (`DRILL_SPEEDS`) a posuvy frézy (`MILL_FEEDS`).

## 6. Návrhy vylepšení

**Didaktika**
- **Úlohy s výkresom a kontrolou** – napr. „osadenie Ø40 h11 na dĺžke 50 mm“, „drážka 10 × 5 mm“; po dokončení vyhodnotenie rozmerov z profilu / výškovej mapy, čas a počet kolízií. Dáta na to aplikácia už má (`prof`, `hf.hgt`, `evalWeld`).
- **Meradlá** – posuvné meradlo a mikrometer na odopnutom obrobku (režim prehliadky už existuje).
- **Kalkulačka rezných podmienok** – vc ↔ n podľa materiálu a nástroja, upozornenie pri nevhodných otáčkach (napr. Ø100 čelná fréza na 2 000 ot/min).
- **Rezanie závitov** na sústruhu – páka matice vodiacej skrutky je v modeli, simulácia chýba.
- **Bezpečnosť (BOZP)** – kontrolný zoznam pred spustením (okuliare, kľúč v skľučovadle, upnutie), hodnotenie porušení.
- **Režim učiteľa** – zdieľateľný odkaz s prednastavenou úlohou (parametre v URL hashi).

**Používateľský komfort**
- Zvuky (motor podľa otáčok, rez, oblúk) cez Web Audio s vypínačom.
- Uloženie rozpracovaného obrobku do `localStorage`, export STL / PNG.
- Indikátor načítania, PWA s offline režimom.
- Ďalšie jazyky (CZ, DE, HU) – texty presunúť z `L('sk', 'en')` do slovníkov podľa kľúčov.
- Adaptívna kvalita: pri nízkom FPS automaticky znížiť `pixelRatio` a vypnúť tiene lampy.

## 7. Odporúčaný postup

| Fáza | Obsah | Odhad | Stav |
|---|---|---|---|
| 1 · Rýchle opravy | V1 Error Boundary + kontrola WebGL, V4 záblesk, S7 otáčky v paneli, indikátor načítania, SRI, N4 | 1 – 2 dni | ✅ |
| 2 · Build a štruktúra | Vite, rozdelenie `src/`, Tailwind cez PostCSS, `_headers` s CSP, ESLint, GitHub Actions, prvé testy čistej logiky | 3 – 5 dní | ✅ |
| 3 · Výkon | render pri zmene, čiastočné prestavanie výškových máp, InstancedMesh, panel bez zbytočných prekreslení, adaptívne rozlíšenie máp | 3 – 4 dni | ✅ |
| 4 · Funkcie | úlohy s kontrolou, meradlá, závity, zvuk, PWA, uloženie stavu | podľa priorít | ✅ |
| 5 · Modernizácia | prechod na aktuálne three.js a React 19 | 2 – 3 dni | ✅ |

## Príloha – namerané hodnoty

| Test | Výsledok |
|---|---|
| Zhoda `index.html` ↔ `src/machines.jsx` | zhodné (okrem importov/exportov) |
| Chyby v konzole pri prechode všetkými strojmi | žiadne (len varovanie Babelu) |
| Halda JS po spustení stroja | 23 – 38 MB (najviac zváranie) |
| Halda po 21 prepnutiach strojov | 20 MB – bez úniku |
| Počet `<canvas>` po prepínaní | stále 1 – kontexty sa uvoľňujú |
| Mobil 390 × 844 | bez vodorovného posunu, rozloženie v poriadku |
| Bez WebGL | prázdna stránka, `#root` bez obsahu |
| Preklad JSX Babelom (Node, desktop) | 0,7 s |
| FPS v SwiftShaderi (len relatívne) | vŕtačka 8, ohýbačka 6, píla 5, fréza 4, brúska 3,5, zváranie 2, sústruh 1,5 |
