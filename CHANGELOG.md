# História zmien

Zoznam zmien po dňoch. Podrobnosti sú v jednotlivých pull requestoch a commitoch; zdroje a obmedzenia modelov
moderných strojov sú v [docs/precision-machines.md](docs/precision-machines.md), audity v [docs/AUDIT.md](docs/AUDIT.md),
[docs/AUDIT-2026-11.md](docs/AUDIT-2026-11.md) a
[docs/AUDIT-2026-11-klasicke-stroje.md](docs/AUDIT-2026-11-klasicke-stroje.md).

## 10. 11. 2026

- CI: test v prehliadači (Playwright, ~25 min) beží len na vyžiadanie – ručné spustenie workflow so zaškrtnutým „e2e“
  alebo štítok `e2e` na pull requeste. Animácia otočenia plechu na Bystronic používa skutočný čas (test nevyprší pri
  nízkej snímkovej frekvencii).
- Nový moderný stroj: vláknový laser Amada BREVIS 1212 AJ (3 kW, 1 270 × 1 270 mm, AMNC 3i). Tvar podľa siete odhadnutej
  z fotografií (Meshy) a fotografií, rozmery podľa letáku (šírka 2 389, dĺžka 3 088, výška 1 900 mm): úzke čelo s
  červeným stĺpom (žltý dvojpruh, znak AMADA, BREVIS 1212 AJ), šikmé čelné dvere z dvoch krídel so zaoblenými tmavými
  oknami a čiernym klinom s madlom. Otváranie: krídla sa posúvajú kaskádovo doľava (pravé pod ľavé, potom obe spolu pod
  pevný červený stĺp, úplne otvorené celé mimo otvoru, prečnievajú cez ľavý bok pod červeným stĺpom), potom sa pravý bok
  so strechou – delený na predný a stredný diel – kaskádovo zasunie dozadu (predný diel cez stredný, potom oba spolu)
  nad nižšiu skriňu zdroja aj s pravým predným rohom, bez presahu za stroj, takže čelo, strecha aj pravý bok rezacieho
  priestoru sú celé prístupné. Pod dverami výsuvná červená rezacia paleta (párne lamely roštu sa vysúvajú s ňou, nepárne
  ostávajú v stroji; pri vysúvaní sa paleta s plechom nadvihne, po zasunutí klesne na všetky hroty) s čiernou zásterou,
  dlhým madlom a špicatým lôžkom; ľavý bok ako odskočené (užšie a nižšie) čierne pokračovanie červeného stĺpa až za
  stroj, pravý bok z troch sekcií (predná s oknom, znakom a typovým označením, stredná s podpisom FL, nižšia tmavá
  skriňa laserového zdroja), päť červených pruhov, čierne kliny s madlami, ustúpený čierny podstavec s podložkami nôh a
  štítkami. Vnútri čierne steny, LED pás, masívny priečny nosník, ktorý jazdí vľavo po vedení v stene a vpravo nohou po
  spodnom masívnom nosníku, čierna hlava s červeným krytom a energetická reťaz. Robustný tablet AMNC 3i na výšku (gumené
  rohy, rebrované úchopy, horné držadlo, strieborná doska s núdzovým stopom, regulátorom, štvorcovými tlačidlami a
  kľúčovým spínačom) na konzole pripevnenej len na čele červeného stĺpa, závesný ovládač na špirálovom kábli, nožný
  pedál, tri blokované servisné dvere (ľavá stena, ľavý stĺp, skriňa zdroja), odsávanie a chladič. Rezanie tabule podľa
  programu (príruby, konzoly) s rezným plynom, tlakom, ohniskom a rýchlosťou, kvalita hrany, vypadávanie výrezov,
  vyberanie dielov; úlohy príruby z ocele 3 mm a konzoly z nerezu 2 mm. Ovládanie zjednotené ako pri iných strojoch: nad
  scénou len Pozrieť obrobok a HMI, v paneli sekcia Prevádzka s tlačidlami (štart, zastaviť, reset, stroj, laser,
  núdzový STOP, dvere, bočné kryty, paleta) a prepínačom osvetlenia; dvojklik na obrazovku v ručnom režime otvorí HMI
  AMNC 3i na celú obrazovku ako vernú kópiu tabletu z modelu (rovnaký tvar, gumené rohy, úchopy, živá obrazovka, núdzový
  STOP, regulátor OVERRIDE, kľúčový spínač laseru a tlačidlá na rovnakých miestach a funkčné). Kolízia núdzového STOP s
  regulátorom OVERRIDE odstránená posunom doľava. Lišta HMI má ako pri iných strojoch Priestor (pevný širokouhlý pohľad
  kamerou vnútri krytu na celý plech a portál), Split a zvuk; displej je dotykový so stránkami PROGRAM, CONDITION,
  MANUAL, SETUP a MAINT. Pedál: krátke stlačenie posúva len čelné krídla po jednom (pravé pod ľavé, obe pod stĺp, späť
  pravé, zatvorené), dlhé podržanie otvorí alebo zatvorí čelo aj bočné kryty; voľné tlačidlá HMI ovládajú svetlo (LIGHT)
  a bočné kryty (COVER). Pozrieť obrobok pri vypnutom alebo nečinnom stroji úplne otvorí čelo, vysunie paletu a plech
  vyberie na prehliadku; po vrátení sa dvere a paleta vrátia do pôvodného stavu. Odstránený čierny prah nad vysunutou
  paletou.
- Nový stroj: kovací buchar Šmeral KHZ 2 (energia úderu 20 kJ, baran 920 kg, zdvih 400 mm) podľa fotiek – zúžený
  rám s pracovným oknom, valec na vrchu, ploché kovadlá, ovládacie stojany a pedál; plynová kovacia pec s dvierkami
  a regulátorom teploty, kliešte. Kovanie hranola so zachovaním objemu a rozširovaním, energia úderu voličom,
  otáčanie o 90°, chladnutie na vzduchu, údery pod 850 °C, trhliny pod 750 °C, spálenie nad 1 280 °C, úder
  naprázdno. Úlohy: plochá tyč 40 × 60 a predĺženie na štvorec 40 × 40.
- Spoločné jadro klasických strojov prijíma obmedzenia kamery (vysoké stroje sa zmestia do predvoleného pohľadu).
- TOS SV 18 RA podľa fotiek odlíšená od SN: zaoblené odliatky (podstavce, lôžko, vretenník, skrine, koník, suport),
  oblé veko vretenníka, okrúhle štítky voličov otáčok, vetracie mriežky na podstavcoch, šikmý okraj vane, svetlejší
  odtieň TOS zelenej; bez digitálneho odčítania polohy (DRO), bez núdzového tlačidla na zámkovej skrini a bez krytu
  skľučovadla s mikrospínačom – polohu odčítaš len z nóniusov na kolesách.

## 9. 11. 2026

- Nové stroje (body 13 – 22 auditu, overené konkrétne modely):
  - univerzálna konzolová frézka TOS Olomouc FGU 32 – kotúčová fréza na tŕni, otočný stôl, súsledné / nesúsledné
    frézovanie; nástrojárska frézka TOS Kuřim FNK 25 – natáčacia hlava a úkos; karuselový sústruh TOS Hulín SK 12;
    hrotový sústruh TOS Trenčín SV 18 RA; bezhrotová brúska TOS Hostivař BBJ 6 (priebežné brúsenie kolíkov);
  - zvislá obrážačka TOS HOV 25 (nahradila obrážačku ozubenia OHA 32 A): oblúkový stojan, smykadlo so zdvihom do
    250 mm, krížový a otočný stôl Ø500 so šnekom a zaistením, samočinný priečny a kruhový posuv s narážkami;
    úlohy štyri drážky 10 × 3 po 90° s delením a vonkajší oblúk R55 kruhovým posuvom; nárazy do stola, podložky
    a upínok, preťaženie noža;
  - pásová píla Pilous ARG 200 PLUS: zverák, dĺžkový doraz so stupnicou, otočné rameno na šikmé rezy so zaistením,
    hydraulické klesanie ramena, rýchlosť pásu 40 / 80 m/min, chladenie, preťaženie pásu, koncový spínač; úlohy
    tri kusy 250 mm a dva kusy 150 mm pod 45°.
- TOS Hostivař BN 102 prerobená podľa fotiek: skriňový podstavec s dvierkami a panelom, pozdĺžny stôl 920 mm
  s T-drážkou a narážkami, bubon priečneho prísuvu, stĺp s mechom, otočný vreteník s kotúčmi na oboch koncoch,
  lampa. Oprava: nôž sa dal prisunúť len o 4 mm, takže pri naklopení 8° sa nedalo prebrúsiť celé čelo.
- TOS BBT 350 prerobená podľa fotiek: nie je to stojanová dvojkotúčová brúska, ale brúska nožov – dva kotúče
  brúsia čelom, pred každým je naklápací stôl so segmentovou stupnicou (sklon = uhol chrbta), vane s chladiacou
  emulziou, prísuv stola ku kotúču (medzera do 3 mm). Úloha: hrubovanie na hrubom a dokončenie na jemnom kotúči.
- Unit testy výpočtov nových strojov (FGU, FNK, SK 12, brúsenie noža, BBJ 6, HOV 25, píla).

- Klasické stroje – ovládanie (body 5 – 7 auditu):
  - ryskovaná stupnica (nonius) na všetkých ručných kolesách s pevnou ryskou, dvojklik nastaví nulu;
  - odvalovačka: skriňa výmenných kolies s dvierkami (s otvorenými sa stroj nespustí), výmena kolies na kvadrante
    a šnek natáčania hlavy so stupnicou sklonu priamo v scéne;
  - rovinná brúska: narážky stola sa ťahajú po drážke stola;
  - nožnice: hlavný vypínač na čele skrine pohonu (bol zapustený v stolíku), radiálka: páka upnutia vreteníka na
    čele (zakrývalo ju rameno); test overí, že každý viditeľný ovládač je z predvoleného pohľadu klikateľný.
- Klasické stroje – dizajn (body 8 – 12): spoločný modul detailov (zaoblené odliatky, rebrá, výrobné štítky TOS,
  olejoznaky, tabuľky otáčok, káble, stupnice uhla); prepracované odvalovačka TOS Čelákovice OFA 32, horizontálka
  TOS Varnsdorf W 9 (rebrá, motor na stojane, kryty vedenia, stupnica stola B), brúska na guľato TOS Hostivař
  BUA 25 (dvierka, vaňa chladenia, hydraulický agregát, stupnica stola) a pásová píla (ukazovateľ napnutia pásu,
  pravítko, uhlový doraz, odsávanie); štítky a olejoznaky aj na sústruhu, frézke, rovinnej brúske, zvislej
  obrážačke a zakružovačke.
- Audit klasických strojov: všetkých 180 ovládačov v scéne (tlačidlá, páky, kolesá, posuvné diely) funguje bez
  chyby, kolízie nástroja so stojacim strojom a upínačmi sa zastavia; návrhy dizajnu a nových strojov TOS
  v [docs/AUDIT-2026-11-klasicke-stroje.md](docs/AUDIT-2026-11-klasicke-stroje.md).
- Zakružovačka: ovládací panel otočený k obsluhe – tlačidlá sa z predvoleného pohľadu dali kliknúť len zozadu.
- Test v prehliadači aktivuje každý ovládač klasických strojov a kontroluje klikateľnosť panela zakružovačky.
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
