# Presné obrábanie a elektroerózia – zdroje modelov

## Hermle C 32 U / C 42 U

Podklady dodané používateľom:

- `671527777-Catalogo-Hermle-Brochure-C32-EN.pdf`: PDF strany 4–8 (čelo, odkrytý stroj, ergonómia), 18 (technické údaje), 20 (rozmerový layout). Jedna PDF strana spravidla obsahuje dve tlačené strany.
- `490488889-201611-Hermle-C42-EN.pdf`: PDF strany 10–11 (čelo), 15 (lôžko a lineárne osi), 19 (dvere a HMI), 22–23 (stoly), 34–35 (zásobník), 46–48 (technické údaje), 50 (štandardný layout).
- Dodatočné obrázky odkrytého lôžka, karusela s bočným pohonom a stola Torque Ø800 × 630 mm s tandemovým pohonom A. Tieto obrázky určujú zvolený variant C 42.
- [Používateľom odporúčané video](https://www.youtube.com/watch?v=2DWQGW74FJc). Prístup k YouTube bol v pracovnom prostredí zablokovaný; video sa nepoužíva ako overený zdroj rozmerov ani pohybov.

| Parameter modelu | C 32 U | C 42 U |
| --- | --- | --- |
| Kabína – šírka / celková hĺbka | 2270 / 3680 mm | 2450 / 4000 mm |
| Výška kabíny / horného pohonu | 2660 / 3190 mm | 2650 / 3290 mm |
| Svetlý otvor dverí | 758 mm | 940 mm |
| Nakladacia výška | 950 mm | 950 mm |
| Stôl / T-drážky | Ø650 × 540 mm / 7 × 14 H7 | Ø800 × 630 mm / 9 × 14 H7 |
| Zvolený pohon stola | závitovkový C, A 25 / C 30 ot/min | Torque C, tandem A 25 / C 65 ot/min |
| Dráhy X/Y/Z | 650 / 650 / 500 mm | 800 / 800 / 550 mm |
| Rýchloposuv X/Y/Z | 45 / 45 / 40 m/min | 45 / 45 / 40 m/min |
| Vreteno HSK-A63 | 18 000 ot/min, 42 kW / 148 Nm | 18 000 ot/min, 20 kW / 180 Nm |
| Pick-up zásobník | 36 miest | 42 miest |

Výkon a moment vretena sú katalógové špičkové údaje pri 20 % ED, nie konštantný výkon v celom rozsahu otáčok. Interné výškové offsety osí, presná kinematika pohonu zásobníka a výkonový model zostávajú výučbovou aproximáciou.

`src/machines/cnc/hermleModel.js` obsahuje samostatnú geometriu a rozmerové profily oboch modelov. Kabína a HMI už nepoužívajú plošné zväčšenie C 32. Pohyblivé dvere, osi, stôl, nástroje a ovládače zostávajú pripojené na spoločné CNC jadro. Číselné rozmery stolov, ich nakladacia výška, svetlý otvor dverí a zhoda polohy pick-up s CNC súradnicami sa overujú geometrickými testami.

Karusel má pevný rebrovaný bubon, indexovaný prstenec s 36/42 otvorenými vidlicami, obvodové ozubenie a bočný pohon pod tvarovaným krytom. Dlhá základňa nad prstencom nesie dvojicu vedení a skrutku. Lôžko má šikmé čelá nosných stien, nerezové žľaby a prepážku s otvorom pre pick-up. Krátke lichobežníkové lamelové kryty majú priestorové sklady, šikmé krajné lišty a menia šírku s osou X. Kolíska je priestorový odliatok s rozšírenou spodnou vaňou a úzkymi stúpajúcimi ramenami pri dvoch odkrytých prírubách; stôl má sploštené okraje a fyzické rovnobežné drážky. Neokótované detaily sú rekonštrukcia fotografií; model neslúži na výrobu dielov ani montážnu kontrolu kolízií.

## Röders RXU 1001 DSH

Podklad: používateľom dodaný katalóg `884756316-roders-rxu-1001-dsh-katalogu-729.pdf` (2016), PDF strany 58–59. Fotografia, diagramy obojstranného uloženia stola a údaje DSH sú na týchto stranách; pôdorys základného RXU 1001 je na strane 57. Katalóg na strane 59 uvádza, že rozloženie DSH je **veľmi podobné** RXU 1001. Pôdorys zo strany 57 preto určuje vzájomné polohy blokov, nie zameniteľnosť všetkých rozmerov oboch variantov. Používateľ doplnil rovnakú fotografiu a pôdorys a upresnil ľavé pozorovacie okno, zadnejšiu ľavú polohu HMI a otváranie dverí doprava.

| Parameter | Použitý údaj |
| --- | --- |
| Dráhy | 800 × 855 × 500 mm |
| Os A | ±115° |
| Os C | priebežná rotácia |
| Stôl | variant Ø600 mm s dvomi zarovnanými stranami, obojstranné uloženie |
| Zaťaženie stola | max. 800 kg |
| Vreteno | 24 000 ot/min, 67 Nm S1, HSK-A63 |
| Priemer nástroja | max. Ø35 mm so štandardným vretenom |
| Zásobník | štandardný rotačný, 24 miest |
| Lineárny posuv | 0–60 000 mm/min |
| Hmotnosť | približne 21 t |
| Potrebný priestor DSH | šírka 3 500 × dĺžka 5 300 × výška 3 550 mm |

Pôvodné zadanie uvádzalo RXU1000DSH; dodaný katalóg a fotografia identifikujú **RXU 1001 DSH**. Údaje trojosého RXU 1001 (1 000 × 810 × 500 mm, pravouhlý stôl 996 × 798 mm a 2 000 kg) sa nepoužívajú pre DSH.

Exteriér a neokótované vnútorné diely sú rekonštruované z fotografií, nejde o výrobný CAD. Pracovný priestor má ľavé bočné okno bez nepriehľadnej steny za sklom; červené čelné dvere sa **posúvajú doprava po spodnej koľajnici**, bez otáčania do priestoru. List sa posúva pred pravým servisným panelom, madlo aj sklo sa pohybujú spolu s ním. HMI má samostatný červený RMS terminál s PC klávesnicou, strieborným rámom displeja, fyzickými ovládačmi nad čiernou klávesnicou, myšou a samostatným ručným ovládačom vpravo. Detail vychádza aj z dodaných fotografií skutočného stroja; tlačidlá Stop/Štart na ručnom ovládači sú prepojené s rovnakými funkciami ako konzola. Je umiestnený pri ľavom boku za čelnou rovinou, nie pred nakladacím otvorom.

Kinematika A/C, interpolácia, CNC úber a skrinka nástrojov sú zdieľané s Hermle. ISO rozhranie nie je emulácia RMS6 ani import natívneho projektu RMS. Rotačné rýchlosti (90/180 °/s), výmena 6 s, výškové offsety a zaťažovací model sú výučbové odhady. Katalóg neposkytuje výkonovú krivku; zaťaženie používa momentový obal 67 Nm. Dĺžka nástroja 250 mm je limit výučbového profilu, nie tvrdenie o limite výrobcu. Doplnkový reťazový zásobník nie je simulovaný.

Samostatne zapínateľná chladiaca jednotka (1050 × 750 mm) a pásový filter (1523 × 1380 mm) rešpektujú dodaný pôdorys; sú predvolene vypnuté a modelované vizuálne bez simulácie filtrácie. Ich výšky a vnútorné diely sú odhady.

Prepravný vozík na triesky je pri zadnej ľavej časti, napojený na dva výstupy skrutkových dopravníkov. Bočná zostava **KNOLL** s vysokou šikmou výsypkou nad vozíkom je súčasťou základného modelu podľa ďalších používateľových fotografií. Výsypka je napojená na stroj, má otvorené spodné ústie priamo nad korbou a zobrazuje sa aj bez zapnutia prídavných chladiacich zariadení. Dopravné priečky sa počas chodu posúvajú.

Pravý bok má malé kontrolné okno a rozdelené servisné panely; chladenie má ventilátory na hornej ploche. Vnútorné odovzdávanie nástroja medzi rotačným zásobníkom a vretenom je schematická animácia; katalóg neobsahuje výrobný výkres tejto mechaniky.

Pôdorys modelu má čelo široké 2190 mm, odsadené širšie ľavé rameno, zadnú pravú servisnú skriňu a priečny zadný blok s voľným servisným výrezom. HMI je pri ľavom ramene za bočným oknom; jeho držiak je pripojený ku skrini. Rozmer 4814 mm na strane 57 patrí základnému RXU 1001; údaj 5300 mm v tabuľke DSH je potrebný inštalačný priestor. Nie je použitý ako automatické predĺženie jednotlivých panelov. Tieto vzťahy sú sústredené v `src/machines/precision/roedersLayout.js`. Detailné výšky krytov, šírka okien a zdvih dverí sú rekonštrukcia podľa fotografie.

Pracovná zostava je posunutá do prednej ľavej časti kabíny ako celok: stôl, upínač, polotovar, lineárne osi a vreteno zdieľajú rovnaký súradnicový rámec. Tvarovaná kolíska A/C a dve ložiskové podpery vychádzajú z rezov a fotografie na stranách 58–59. Osvetlenie aj detailné pohľady sledujú skutočnú polohu tejto zostavy.

## OSCARMAX EX 500

Podklady: [stránka výrobcu EX 500](https://www.oscaredm.com/en-US/p182-die-sinker-electrical-discharge-machine-ex-500), jej fotografie a tabuľky dodané používateľom; následne katalóg `346ce9ffaa88.pdf`, PDF strana 6 (tlačené strany 10–11), pôdorys a vonkajšie rozmery na PDF strane 10. Starší dodaný súbor `2023OSCAR_pdf_3247285_134929_7818263.pdf` opisuje EXD vŕtačky a SD ZNC, nepoužíva sa pre parametre EX 500.

| Parameter | Údaj výrobcu |
| --- | --- |
| Konštrukcia | pohyblivý stĺp, stacionárny stôl |
| Dráhy X/Y/Z | 500 / 400 / 450 mm |
| Stôl | 850 × 450 mm |
| Najväčší obrobok W × D | 1 020 × 710 mm |
| Max. výška napustenia nádrže | 355 mm |
| Vzdialenosť upínača od stola | 130–480 mm |
| Max. hmotnosť obrobku / elektródy | 2 300 / 200 kg |
| Hmotnosť stroja | 3 000 kg |
| Generátor | 60 A, 10 kVA, 350 kg |
| Nádrž / filtrácia | 850 l, 20 µm, 6 vložiek |
| Vonkajšie rozmery L × W × H | 2 493 × 2 810,5 × 2 778 mm |

Nádrž má spúšťaciu nakladaciu stenu; automatické riadenie dverí je katalógová možnosť, v simulátore ide o používateľom ovládanú animáciu. Stĺp a elektróda sa pohybujú v XY; stôl ani polotovar neposkakujú spolu s nimi. Foto predlohy určuje strieborné opláštenie, žlto-modré pásy a PC terminál. Neokótované diely, elektroinštalácia a hadice sú vizuálna rekonštrukcia.

Proces je zjednodušená **hĺbiaca elektroerózia**, nie frézovanie ani EDM vŕtanie. Má hranolovú alebo valcovú Cu elektródu, výbojovú medzeru 0,01–0,20 mm a prúd 1–60 A. Polotovar je oceľový 100 × 80 × 30 mm. Kontrola vyžaduje ponorenie aspoň 40 mm nad obrobkom, zatvorené dvere, zapnutý výplach a uvoľnený STOP. Odber materiálu používa rovnaké voxelové pole a surface nets ako CNC; hranol odoberá hranolovú dutinu. Sieť má 0,7 mm, preto nezobrazuje mikrometrovú drsnosť ani presnosť reálnej EDM.

Rýchlosť servo-prísuvu `0,012 + 0,0012 × prúd` mm/s a opotrebenie elektródy 0,8 % odobratého objemu sú **výučbové odhady**. Negarantujú technologický čas, kvalitu povrchu alebo reálnu spotrebu elektródy. UV snímač a hasiaci prvok sú modelované vizuálne; ich elektronika, generátorové impulzy, adaptívne riadenie APC a OSCARPGM sa neemulujú.

Skrinka elektród používa lokálny kľúč `rmt-edm-electrodes-v1`; JSON má tvar `{ "version": 1, "electrodes": [{ "id": "cu20", "name": "Cu 20 × 15", "shape": "box", "w": 20, "d": 15, "length": 100 }] }`. Rozmery sú v mm. Import zlúči podľa ID, overí rozmery a nikdy neosadí elektródu automaticky.

## Spoločné ovládanie a overenie

Kategória `#moderne` je tmavosivá; simulátory používajú pôvodné rozloženie a farebný akcent značky. Konvenčné stroje zachovávajú pôvodné vzhľady. Zvuk je pri novom načítaní vypnutý.

Oba nové stroje majú zamknutú kameru v ručnom režime, fyzické tlačidlá, živé HMI, zámok jeho polohy a odopnutie/prehliadku/vrátenie rovnakého obrobku. EX 500 pred odopnutím vypustí nádrž, otvorí stenu a odtiahne elektródu. STL a STEP zachovajú aktuálny prerušený stav; STEP používa existujúci AP214 export geometrie v mm, neobnovuje čistý polotovar.

Automatické testy `precision.test.js`, `precisionModels.test.js` a `electrodes.test.js` kontrolujú dráhy DSH, ukážkový CNC cyklus, bezpečnostné blokovania EDM, rozdiel hranol/valec, zachovanie rozpracovaného stavu, odtiahnutie medzi dutinami, priehľadný otvor okna RXU, posuv dverí bez natočenia, otvorený servisný výrez v pôdoryse, priechodnosť okna, rozsah ramena RMS bez prieniku do kabíny, polohu RMS, stacionárny stôl EX500 a validáciu skrinky.
