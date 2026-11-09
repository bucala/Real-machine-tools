# História zmien

Zoznam zmien po dňoch. Podrobnosti sú v jednotlivých pull requestoch a commitoch; zdroje a obmedzenia modelov
moderných strojov sú v [docs/precision-machines.md](docs/precision-machines.md), audity v [docs/AUDIT.md](docs/AUDIT.md)
a [docs/AUDIT-2026-11.md](docs/AUDIT-2026-11.md).

## 9. 11. 2026

- Bystronic: nový vzorový program – krabička 200 × 150 × 60 mm z plechu 2 mm s vonkajším lemom 25 mm na stene A,
  5 ohybov na jednom prírezu (lem rubom hore, dlhé steny, krátke steny medzi ohnutými). Po každom ohybe tlačidlo
  „↻ Otočiť plech“ prevráti / otočí diel s animáciou a nastaví doraz X, uhol a dĺžku ďalšieho ohybu; Štart bez
  otočenia sa odmietne. Tabuľka programu ukazuje manipuláciu, hranu, X a dĺžku ohybu.
- Nástroje pre krabičku: razník zložený zo segmentov 100 / 50 / 40 mm na dĺžku ohybu (krátke steny sa ohýbajú medzi
  dlhými) a úzka matrica V16, vedľa ktorej sa zmestí zahnutý lem.
- Oprava: ohýbanie sa zastavilo po prvom ohybe a sprievodca hneď skočil na koniec – sprievodca teraz vedie cez všetkých
  5 ohybov a 4 otočenia plechu; test v prehliadači prejde celý program.
- Export STL obrobku vynechá skryté siete.
- Krabička na Bystronic: ohyby majú skutočný oblúk s vnútorným polomerom podľa matrice (ri = max(0,16·V; 0,8·t),
  pri V16 a plechu 2 mm 2,56 mm) namiesto dvoch prekrývajúcich sa dosiek. Rozvinutá dĺžka sa pri ohýbaní zachováva:
  na začiatku ohybu je polomer väčší a pri konečnom uhle je presne polomer nástroja. Rovné časti sú skrátené
  o nábeh ohybu, takže vonkajšie rozmery krabičky ostávajú 200 × 150 × 60 mm, a v rohoch zostáva medzera
  na odľahčenie.

## 8. 11. 2026

- Oprava: lišta „Rozpracovaná práca“ (Invalid Date) sa ukázala aj bez uloženej práce; konzola TNC drží pomer strán
  a štart / stop a korekcie posuvu sú v mriežke s okrajom od spodnej hrany (predtým sa odrezávali).
- Sprievodca je na konci panela za časťami stroja; kroky sa zobrazujú v samostatnom plávajúcom okne nad scénou.
- Zložité dlhé programy pre moderné stroje: Hermle – príruba s kupolou (8 nástrojov, 3+2 aj simultánne 5-osé
  s TCP, ~2 800 blokov), Röders – forma s voľnou plochou (HSC rastre, ~5 200 blokov), OSCARMAX – vložka formy
  3 × 3 (27 hĺbení, E1 + E2, G-kód s T1/T2 M6 a prúdom S), Bystronic – program ohybov C-profilu s lemami
  (4 ohyby s otáčaním dielu, hotové ohyby zostávajú na plechu).
- Zložité dielce sú predvolené: po otvorení stroja je pripravený zložitý program (jednoduchšie ukážky sú v zozname).
- HMI cez celé okno na telefóne: bez prázdnych pásov okolo displeja, celé popisy korekcií na termináli Röders.
- Sprievodca krok za krokom pre sústruh, frézku, vŕtačku, zváranie MMA, Hermle, Röders, OSCARMAX a Bystronic:
  zvýraznený diel v scéne a ovládač v paneli, krok sa splní podľa stavu stroja.
- Dotykové HMI Hermle (TNC 640) a Röders (RMS6): záložky stránok, posuvníky rýchlosti simulácie a korekcie posuvu
  na displeji, grafy zaťaženia vretena a úberu.
- Jednotné klávesové skratky: medzerník štart / stop, 1 – 9 pohľady, + / − zrýchlenie, L názvy častí, I Pomocník.
- Rozpracovaná práca na moderných strojoch (program, nastavenie, obrobok) sa uloží v prehliadači a ponúkne
  „Pokračovať“.
- Balík Hermle 129 → 16 kB (kolíska sa načíta zvlášť), sústruh, frézka a zváranie rozdelené na panel, scénu a dáta.
- Test v prehliadači znova otvára všetky stroje (od preformátovania kódu ich nenachádzal), nové postupy na
  sústruhu, frézke a pri zváraní; test, že slovenské texty majú anglický ekvivalent.
- OSCARMAX: živé dotykové HMI – stránky MACHINE, PROGRAM, TOOL, GENERATOR, MONITOR a HELP (prúd generátora,
  dielektrikum a výplach, softvérové tlačidlá cyklu, graf hĺbky a úberu, kontrola podmienok štartu); posuvník
  rýchlosti simulácie je v stavovom riadku displeja, ovládanie aj klávesmi 1 – 6 a šípkami; núdzový STOP okrúhly.
- Výkon: obrobok CNC a elektroerózie sa do GPU posiela po 2 × 2 × 2 blokoch, zlučovanie sietí sa učí, ktoré diely sa
  naozaj hýbu (Hermle 715 → 281, Röders 957 → 212 vykreslení po behu programu), `?noopt` na porovnanie.
- Elektroerózia: operácie s elektródou E1 / E2 a vlastným prúdom, výmena elektródy, servo podľa plochy v zábere;
  úloha hrubovanie a dokončenie dvoma elektródami.
- Test výkonu (`?perf` alebo Pomocník): živé FPS a 12 s test s výsledkom na skopírovanie.

- **Audit 2. kolo** ([#23](https://github.com/bucala/Real-machine-tools/pull/23), [#24](https://github.com/bucala/Real-machine-tools/pull/24), [#25](https://github.com/bucala/Real-machine-tools/pull/25)):
  - zámok dverí CNC (štart len pri zatvorených dverách, dvere zamknuté počas programu), presné hlášky pri štarte elektroerózie;
  - hlášky procesov, interpretera a alarmov v jednom jazyku;
  - zlučovanie statických sietí a menej vrhačov tieňa (o polovicu až o 80 % menej vykreslení);
  - CNC jadro oddelené od Hermle, binárna kolíska, menu bez three.js;
  - test v prehliadači v CI, offline cache po strojoch s tlačidlom „Uložiť všetky stroje pre offline“;
  - úlohy s hodnotením a protokolom pre Hermle, Röders, OSCARMAX a Bystronic, meranie obrobku z poľa vzdialeností;
  - výučbový fyzikálny model elektroerózie (úber, medzera, Ra podľa prúdu);
  - presné dno po čelnej fréze, Prettier a rozdelenie CNC jadra na panel, scénu a úlohy;
  - odstránené PDF výrobcu, upozornenie o ochranných známkach.
- Úzka scéna (mobil): štítky stavu ako kontrolky, ďalšie tlačidlá pod „⋯“; kontrola BOZP pri úlohách na Bystronic;
  jemné nastavenie polohy HMI zbalené.
- Živé HMI s rozdelenou obrazovkou, výboj pri elektroerózii, priehľadné bočné okná Hermle, upravená kabína a zásuvka
  na triesky, tlačidlá názvov dielov; README prepísané.

## 7. 11. 2026

- Bystronic Xpert Pro 320/4300: CNC ohraňovací lis s funkčným HMI a stanovišťom obsluhy; ShuangliCNC skrytý.
- OSCARMAX EX 500: kabína, mechy, NC program elektroerózie, živé pohľady do pracovného priestoru.
- ShuangliCNC ZJA13-2013F: simulátor hĺbkového vŕtania (v menu skrytý).
- Terminály RMS (Röders) a EX500 spresnené; ovládací panel sklopený a zaoblený.

## 6. 11. 2026

- Export modelov strojov do OBJ, STEP a STL vo všetkých simulátoroch.
- Röders: horné kryty a bočné dvere podľa dodaného STEP, čelné ohyby, okná; pomocník a sťahovanie v menu.

## 5. 11. 2026

- Nové moderné stroje Röders RXU 1001 DSH a OSCARMAX EX 500.
- Hermle C 32 / C 42: lôžko, karusel a kabína podľa katalógov, kolíska z dodaného STL, periférie.
- Röders: pôdorys, posuvné dvere, konzola RMS a násypka KNOLL; grafitové menu moderných strojov.
- Rozptýlené osvetlenie a tienenie kabíny CNC, výber nástrojov zo skrinky ťahaním.

## 4. 11. 2026

- **Moderné stroje: Hermle C 32 U / C 42 U s CNC simuláciou a 5-osým úberom** ([#22](https://github.com/bucala/Real-machine-tools/pull/22)).
- Výkresy úloh s kótami, protokol z cvičenia, vybavenie sústruhu predvolene vypnuté ([#21](https://github.com/bucala/Real-machine-tools/pull/21)).
- Prerobené modely zakružovačky, radiálky a nožníc, nový výstredníkový lis TOMA LEN 40C ([#20](https://github.com/bucala/Real-machine-tools/pull/20)).
- Hermle: zásobník, panel, nástroje, dvere, otočné HMI s kĺbovým držiakom, prídavné vybavenie; knižnica nástrojov
  (priame prepojenie s PowerMill neskôr odstránené – zostal import z CAM).
- Kontrola strojov: zvuk, prehliadky obrobku, animácie, STEP export.

## 3. 11. 2026

- Horizontálka, odvalovacia frézka, zakružovačka plechu a tabuľové nožnice ([#19](https://github.com/bucala/Real-machine-tools/pull/19)).
- Radiálna vŕtačka TOS a hrotová brúska na guľato TOS BUA ([#18](https://github.com/bucala/Real-machine-tools/pull/18)).
- Sústruh TOS SN 32 / 40 / 50 / 55 s prídavným vybavením ([#17](https://github.com/bucala/Real-machine-tools/pull/17)).
- Pomocník „i“ v scéne, tlačidlá chodu, väčšia scéna ([#16](https://github.com/bucala/Real-machine-tools/pull/16)).
- Zvislá obrážačka TOS ST 350, profilová ohýbačka COMAC 3025 HV ([#15](https://github.com/bucala/Real-machine-tools/pull/15)).
- Obrážačka TOS, rez zvarom a zvarová mierka, viacvrstvové zvary, deliaci prístroj ([#14](https://github.com/bucala/Real-machine-tools/pull/14)).
- Fronius TPS 450 (MIG/MAG), výmena elektródy, tvary a polohy polotovarov pri zváraní ([#10](https://github.com/bucala/Real-machine-tools/pull/10), [#13](https://github.com/bucala/Real-machine-tools/pull/13)).
- Audit a fázy 1 – 5: build cez Vite, výkon, offline režim, úlohy, závity, three.js r186, automatické nasadenie ([#9](https://github.com/bucala/Real-machine-tools/pull/9)).

## 1. – 2. 11. 2026

- Hrotový sústruh ([#1](https://github.com/bucala/Real-machine-tools/pull/1)), hlavné menu s frézou, vŕtačkou, ohýbačkou a brúskou ([#2](https://github.com/bucala/Real-machine-tools/pull/2)),
  pásová píla, SK/EN a vzhľady ([#3](https://github.com/bucala/Real-machine-tools/pull/3)), oblúková zváračka Elektrokov JS 90FN ([#5](https://github.com/bucala/Real-machine-tools/pull/5) – [#8](https://github.com/bucala/Real-machine-tools/pull/8)).
