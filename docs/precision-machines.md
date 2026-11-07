# Presné obrábanie a elektroerózia – zdroje modelov

## Hermle C 32 U / C 42 U

Podklady dodané používateľom:

- `671527777-Catalogo-Hermle-Brochure-C32-EN.pdf`: PDF strany 4–8 (čelo, odkrytý stroj, ergonómia), 18 (technické údaje), 20 (rozmerový layout). Jedna PDF strana spravidla obsahuje dve tlačené strany.
- `490488889-201611-Hermle-C42-EN.pdf`: PDF strany 10–11 (čelo), 15 (lôžko a lineárne osi), 19 (dvere a HMI), 22–23 (stoly), 34–35 (zásobník), 46–48 (technické údaje), 50 (štandardný layout).
- `Hermle-C42-Brochure.pdf`: PDF strany 18–19 (ergonómia a jediný pevný nosník HMI), 52 (novší pôdorys s explicitnou šírkou zásuvky 400 mm). Pre jej polohu používateľ výslovne vybral starší layout zo strany 50 katalógu 2016: odsadenie 720 mm, nie 750 mm z novšej verzie. Dodatočné fotografie spresňujú čap pod okrajom stroja, spodné zalomenia plechov a pás pri pravom vonkajšom okraji.
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

### Dodané STL, čelo a servisné otvory (november 2026)

- Používateľ dodal `Meshy_AI_Industrial_Rotary_Positioner_20261105_texture.stl` (632 414 trojuholníkov). Oddelený komponent stola sa nepoužíva: model potrebuje nezávislú os C a presné katalógové rozmery upínacej plochy. Najväčší komponent – kolíska s bočnými prírubami – je zjednodušený na 14 000 trojuholníkov v `src/machines/cnc/assets/hermle-cradle.json` (~343 kB). Osi pôvodného STL sa prevedú na súradnice scény, rozmery sa prispôsobia ložiskám A a výške stola. Ide o používateľom dodaný generovaný tvar, nie o rozmerovo overený CAD výrobcu; STL neobsahuje textúru.
- Fotografia čela C 42 U určuje zrkadlové zalomenie vnútorných okrajov skiel, hornú bielu plochu dverí a spodnú šikmú fasciu. Logo je na pevnom ľavom paneli a zvislé označenie „C 42 U dynamic“ na pevnom pravom paneli. Dve čelné krídla sa posúvajú do strán aj so sklom a madlami.
- Doplnený layout C 42 U MT (tlačené strany 56–57) slúži ako podklad pre servisné prístupy a voľný priestor okolo zariadenia. Profil simulácie zostáva frézovací C 42 U, nepridáva sústruženie MT. Dva páry bočných a jeden pár zadných servisných krídel majú vlastné závesy a animované otvorenie von. Voliteľný dochladzovač má navyše vlastné čelné servisné dvere a otvor pri výmenníku. Kliknutie v ručnom režime ich otvorí/zatvorí; otvorenie zastaví program a nové spustenie je blokované aj počas dobiehania zatvárania. Neokótované veľkosti jednotlivých plechov a vnútorné elektrické vybavenie sú vizuálna rekonštrukcia.
- Základná zásuvka je otvorená nízka vaňa s ohnutými okrajmi, štyrmi kolieskami a madlom. Vybraný layout 2016 určuje **720 mm odsadenie od čela**, 680 mm presah boku a **ďalších 1700 mm výsuvu** do šrafovanej oblasti. Otvorená tak siaha 2380 mm od boku, bez lemov a madla. Šírka 400 mm v smere Z je explicitná v novšom pôdoryse; hodnota 720/750 mm označuje odstup, nie šírku vane. Zadná nádrž s čerpadlom zostáva pevná. Lôžko a spodná kabína majú priechodný otvor aj pre náhradný dopravník. Ten zdieľa polohu výstupu a susedné moduly sa posúvajú spolu s ním, aby vozík nekolidoval s ICS. Pri voľbe dopravníka sa zásuvka, nádrž a vodidlá skryjú. C 32 používa proporčné zmenšenie zostavy podľa šírky kabíny, nie samostatne doložené kóty zásuvky. Vnútorná dĺžka, hrúbky plechov a čerpadlo sú rekonštrukcia.
- Podľa C 42 PDF strany 43 má dopravník zalomené bočnice, zakrytú šikmú vetvu, spodný motor a výsyp s otvoreným hrdlom. Vozík má otvorenú vaňu na čapoch, kolieska a západku. ICS má nízku nádrž, šikmú filtračnú hlavu, rolku a čerpadlá; ICS 80 pridáva vysokú zadnú časť. Dochladzovač má hornú mriežku a servisné dvere. Odstup nádrže zachováva približne 900 mm servisnú uličku C 42. Neokótované tvary sú vizuálne odhady.
- HMI má **jeden pevný nosník**, nie dve zalamovacie ramená. Čap leží pod pravým okrajom stroja, nie na širokej vysunutej polici. Nosník nízko vychádza spod kabíny a šikmo stúpa do hranatého stĺpika; panel má samostatný horný otočný čap. Dĺžka 1020 mm a sektor 34–146° sú vizuálna rekonštrukcia, nie výrobné kóty. Voľby Obsluha/Bok/Zásobník, ťahanie a zámok zostávajú funkčné. Posuvník 0–100 % vyjadruje postup medzi krajnými polohami; pôvodná interná hodnota 0–180 zostáva zachovaná pre existujúce ovládanie. Testy kontrolujú konštantnú dĺžku, čap pod okrajom, priechod pri lôžku a voľné natočenie konzoly mimo kabíny.
- Spodné čelné plechy ustupujú o 220 mm, bočné o 180 mm a stretávajú sa v zrezaných rohoch. Tieto hodnoty sú odhad z fotografií. Pevné kryty končia krátkym lemom; posuvné dvere majú nižšiu zvislú zásteru. Tesnenie, skrutky a dolné vedenie sledujú odsadenú geometriu. Nerezové dno, žľaby a čelá odliatku končia za zalomením a neprenikajú cez dvere. Pätky 120 × 140 mm s nastavovacími skrutkami sú zasunuté pod základňu, nie pred nakladací otvor. Červený pás je 160 mm od pravého okraja a pokračuje po šikmej ploche. Zadné servisné skrine zostávajú hranaté.
- Posledná označená fotografia dopĺňa vysoký vystupujúci chladiaci kryt na ľavom zadnom servisnom krídle. Má zaoblené zalomené okraje, sivú plochu a čierne označenie; otvára sa s krídlom a nezasahuje do zásuvky. Nižšia pevná nádrž za zásuvkou má zhodný vonkajší presah, delené zapustené veko, spodný lem a čerpadlo. Tieto neokótované detaily sú vizuálna rekonštrukcia, nemenia rozmery výsuvu z vybraného pôdorysu.
- Detail HMI určuje **dve samostatné červené bočné trubky**, zaoblený prechod medzi monitorom a pultom a čierne koncové zátky. Predná spojovacia priečka sa nepoužíva. Pod pravou trubkou visí podlhovastý čierny ručný ovládač s farebnými klávesmi, závesom, konektorom a špirálovým káblom, bez domysleného displeja. Doplnené sú aj legendy klávesov a zadné vetranie monitora. Varianty TNC na fotografiách nie sú totožné; model zostáva zvolenou konzolou TNC 640, nie kombináciou všetkých generácií.
- TNC panel a fullscreen používajú spoločné súradnice klávesov, oboch korekčných ovládačov, štartu/stopu, núdzového STOP, prepínača, kľúča, trackballu a loga. Pomer strán spodného panela je 6,04 : 4,7 v oboch zobrazeniach. Monitor dopĺňajú bočné a spodné klávesy podľa fotografie. Korekcia vo fullscreen sa otvorí kliknutím na príslušný otočný ovládač; šípky klávesnice menia hodnotu o 1 %. Dekoratívne klávesy nepredstierajú kompletnú emuláciu TNC. Na malých displejoch zostáva dostupné existujúce kompaktné ovládanie.

Tri polohy držiaka HMI v aktuálnom modeli:

| Obsluha | Bok | Zásobník |
| --- | --- | --- |
| ![HMI pri obsluhe](img/hermle-rigid-operator.png) | ![HMI pri boku](img/hermle-rigid-side.png) | ![HMI pri zásobníku](img/hermle-rigid-magazine.png) |

[Opravené čelné a bočné plechy](img/hermle-folded-panels.png) · [Zasunutá zásuvka a pevné čerpadlo](img/hermle-drawer-closed.png) · [Vysunutá zásuvka](img/hermle-drawer-open.png)

[Bočný chladiaci kryt a nádrž](img/hermle-left-cover.png) · [Bočné trubky a ručný ovládač HMI](img/hermle-hmi-detail.png)

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

Horné opláštenie vychádza z dvoch solidov používateľovho [referenčného STEP](references/roeders-cover-user.STEP), pôvodne `roders-rxu-1001-dsh-model_uprava.STEP`. Prevod jeho súradníc v mm do scény je `[(X−734)/100, (Y+2)/100, (Z−1256.75012207)/100]`. Preberá sa profil vysokej steny a všetkých päť plôch bočného klinu; plný objem solidu nenahrádza vnútro stroja. Stred krytu zostáva otvorený pre pôvodný portál. Jeho šikmé ostenia a lamelové pásy sledujú sklon nameraný zo STEP. Geometria krytov je samostatne v `src/machines/precision/roedersCover.js`.

Ľavé dvierka obchádzajú zalomenie klinu s medzerou; spodné skosenie klinu, dvierok a okna má spoločný uhol. Sklo má podľa detailnej fotografie šesť vrcholov, šikmý zadný horný okraj a vyššiu prednú časť. Dvierka majú tri pánty pri čelnej hrane a v ručnom režime sa kliknutím otvárajú smerom von. Otvorené dvierka zastavia cyklus a zablokujú jeho spustenie až do zavretia. Rozmery okna, medzery, pántov a otvoru portálu sú prispôsobené existujúcemu modelu podľa fotografií; STEP ich neobsahuje. Pracovný súradnicový rámec, pohony, stôl, HMI a príslušenstvo sa touto úpravou nemenia.

Pôdorys modelu má čelo široké 2190 mm, odsadené širšie ľavé rameno, zadnú pravú servisnú skriňu a priečny zadný blok s voľným servisným výrezom. HMI je pri ľavom ramene za bočným oknom; jeho držiak je pripojený ku skrini. Rozmer 4814 mm na strane 57 patrí základnému RXU 1001; údaj 5300 mm v tabuľke DSH je potrebný inštalačný priestor. Nie je použitý ako automatické predĺženie jednotlivých panelov. Tieto vzťahy sú sústredené v `src/machines/precision/roedersLayout.js`. Detailné výšky krytov, šírka okien a zdvih dverí sú rekonštrukcia podľa fotografie.

Pracovná zostava je posunutá do prednej ľavej časti kabíny ako celok: stôl, upínač, polotovar, lineárne osi a vreteno zdieľajú rovnaký súradnicový rámec. Tvarovaná kolíska A/C a dve ložiskové podpery vychádzajú z rezov a fotografie na stranách 58–59. Osvetlenie aj detailné pohľady sledujú skutočnú polohu tejto zostavy.

Pravý kryt tvorí jeden profil s otvorom pre kontrolné sklo, takže medzi vežou a predným panelom nezostáva priebežná štrbina. Ľavé dvierka majú zapustený obvodový rám. Detail interiéru dopĺňa fazetované lôžko s radmi zapustených spojov, osemuholníkové podpery A s prírubami, zaoblená kolíska a centrálna misa pohonu C. Šikmé teleskopické kryty reagujú na os X; plášť portálovej hlavy má priechod pre pinolu so štyrmi vodiacimi stĺpmi. Vreteno má rozdeľovač chladiacej kvapaliny, dýzy a vedenia. Nerezové žľaby, skrutky, odvetranie základne a vzduchová hadica dopĺňajú model podľa fotografií. Tieto detaily sú vizuálna rekonštrukcia v `roedersDetails.js`.

[Detail vretena a naklonenej kolísky](img/roeders-interior.png)

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

Aktualizácia podľa dvoch doplnených výstavných fotografií EX500: nižšie, miernejšie skosené zadné rameno, stĺp zarovnaný s osou elektródy, úzka príruba nad mechom, nadväzujúce rohové piliere vane a ľavá horná polica. Z a priečne kryty majú uzavretú skladanú geometriu, ktorá pri pohybe zachováva oba konce. Doplnený je odkrytý kovový upínač, výplachové hadice s koncovkami, držiaky hasiacej fľaše, zapínateľné svetelné lišty, tesnenia, odtok, skrutky a servisné panely. Potlač používa biele EX / červené 500 na tmavom štítku a súbežné žlto-bielo-sivo-modré pásy na stĺpe. Drobné nečitateľné štítky sú schematické; nejde o reprodukciu certifikácie ani bezpečnostnej dokumentácie výrobcu. Menu obsahuje aj pohľady **Ľavý bok** a **Detail hlavy**.

[Aktualizovaný model EX500](img/oscarmax-ex500.png) · [Detail hlavy, mechu a výplachu](img/oscarmax-head.png)

Proces je zjednodušená **hĺbiaca elektroerózia**, nie frézovanie ani EDM vŕtanie. Má hranolovú alebo valcovú Cu elektródu, výbojovú medzeru 0,01–0,20 mm a prúd 1–60 A. Polotovar je oceľový 100 × 80 × 30 mm. Kontrola vyžaduje ponorenie aspoň 40 mm nad obrobkom, zatvorené dvere, zapnutý výplach a uvoľnený STOP. Odber materiálu používa rovnaké voxelové pole a surface nets ako CNC; hranol odoberá hranolovú dutinu. Sieť má 0,7 mm, preto nezobrazuje mikrometrovú drsnosť ani presnosť reálnej EDM.

Rýchlosť servo-prísuvu `0,012 + 0,0012 × prúd` mm/s a opotrebenie elektródy 0,8 % odobratého objemu sú **výučbové odhady**. Negarantujú technologický čas, kvalitu povrchu alebo reálnu spotrebu elektródy. UV snímač a hasiaci prvok sú modelované vizuálne; ich elektronika, generátorové impulzy, adaptívne riadenie APC a OSCARPGM sa neemulujú.

Skrinka elektród používa lokálny kľúč `rmt-edm-electrodes-v1`; JSON má tvar `{ "version": 1, "electrodes": [{ "id": "cu20", "name": "Cu 20 × 15", "shape": "box", "w": 20, "d": 15, "length": 100 }] }`. Rozmery sú v mm. Import zlúči podľa ID, overí rozmery a nikdy neosadí elektródu automaticky.

## ShuangliCNC ZJA13-2013F · Siemens Edition

Na žiadosť používateľa je zariadenie skryté z verejného výberu. Priamy odkaz `#shuangli` zobrazí menu moderných strojov. Zdrojový simulátor, geometria, konfigurácia a testy zostávajú zachované; skrytie neodstraňuje uložené údaje. Návrat do ponuky sa riadi príznakom `hidden` v registri `MODERN`.

Podklady dodané používateľom: fotografia kompletného bieleho stroja s červeným pásom, obrázok odkrytého vodorovného vŕtacieho mechanizmu, fotografie interiéru, okrytovania a snímka tabuľky z Made-in-China. Tabuľka aj nápis na referenčnej kabíne uvádzajú **Zonjet ZJA13-1610**. Používateľ požaduje názov **ShuangliCNC ZJA13-2013F**. Bez technického listu tejto konkrétnej verzie sa údaje neprenášajú ako jej garantovaná špecifikácia.

| Podklad | Údaje / spôsob použitia |
| --- | --- |
| Tabuľka ZJA13-1610 | 3 osi, vodorovná konštrukcia, výška 2 800 mm, max. hĺbka 1 300 mm, priemer <50 mm, 12 t, nosnosť 10 t; uvedené iba ako príbuzná referencia |
| Fotografie | rozdelenie kabíny, presklenie, červený pás, čierny sokel, odkryté vedenia, dlhý vrták a dopravník |
| Geometria simulátora | rozmery panelov, drážkovaný stôl 1 300 × 2 000 mm, vedenia, dvere a príslušenstvo sú vizuálne odhady; nie výrobné CAD dáta |
| Výučbový rozsah | vrták Ø8–40 mm, 100–6 000 ot/min, posuv 5–400 mm/min, tlak 0–80 bar (cyklus vyžaduje ≥10 bar) |
| Výučbový polotovar | 500 × 160 × 240 mm, voxelová sieť 2 mm; slepé otvory s rezervou 5 mm pred zadným čelom |

Tri predné listy sa teleskopicky presúvajú doprava, ľavé dvere sa otáčajú von. Odkrytie mechanizmu je vizuálna funkcia, nemení stav dverových zámkov. X posúva stôl priečne k vrtáku; Y dvíha nosník a Z posúva vreteník po vodorovných vedeniach. Dlhý nástroj má priamu drážku, pevnú prednú vodiacu oporu a dve pohyblivé podpery. Vedenia majú priechodný otvor; rám nepretína os nástroja.

Program zadáva súradnice X/Y na vstupnom čele a hĺbku Z. Postupuje cez polohovanie, nájazd, súvislé vŕtanie a vytiahnutie. Kontroluje všetky modelované dvere, upnutie, STOP a chladenie. Hold zachová materiál aj miesto v cykle. Prehliadka odtiahne nástroj; pokračovanie dokončí aktuálny otvor. Úber používa valcový obal nástroja, takže dno je zjednodušené na rovinu; mikrometrická presnosť, ohyb, opotrebenie a tvorba triesky sa nepočítajú.

Siemens Edition používa jeden živý canvas pre monitor aj zväčšené HMI. Rozhranie je inšpirované SINUMERIK, neimplementuje firmvér ani import Siemens NC programov. OBJ/STL/STEP export stroja je v päte menu; samostatný export obrobku zachová aktuálny úber. Testy `deepDrill.test.js` overujú interlocky, hlboké slepé otvory, indexovanie až po vytiahnutí, zachovanie rozpracovaného stavu, polohu vrtáka voči obrobku, priechodnosť podpier a otváranie dverí.

## Bystronic Xpert Pro 320/4300

Používateľ zvolil **320/4300 v štandardnej výške**. Parametre vychádzajú zo štvrtej strany dodaného [technického listu Xpert Pro](references/bystronic-xpert-pro-technical-data.pdf), zo stĺpca **320/4300**, nie **320/4300 Extended**. Fotografie modelov 150 a 320 slúžia pre tvar a členenie okrytovania, nástrojov a príslušenstva.

| Parameter | Štandard 320/4300 |
| --- | --- |
| Lisovacia sila / pracovná dĺžka | 3 200 kN / 4 300 mm |
| Rozmery L × W × H | 5 260 × 2 000 × 3 170 mm |
| Zdvih / otvorenie bez nástrojov | 250 / 640 mm |
| Vzdialenosť medzi stojanmi / vyloženie | 3 750 / 400 mm |
| Šírka stola | 74 mm |
| Rozsah dorazu X / zdvih saní X | 1 050 / 600 mm |
| Zdvih R / dráha Z | 250 / 2 900 mm |
| Presnosť Y podľa technického listu | 0,004 mm |
| Olej / hmotnosť | 600 l / 24,3 t |
| Príkon ByTower / Servo Dynamic | 34 / 31 kW |

Model má bočné C-rámy, tvarovaný čierny horný kryt, oranžový firemný výstupok a pás, segmentovaný horný nástroj a spodnú V-matricu so skutočným výrezom. Obsahuje upínacie prvky a stupnice, vodiace lišty, zadné dorazy X/R/Z, valčekové predné podpery, pomocnú podperu s mechom, bočné presklené kryty, zadné servisné dvere s lamelami, hydraulické valce a hadice, laserové hlavy, mobilný dotykový terminál a samostatný pedál. Neokótované detaily a príslušenstvo sú rekonštrukciou fotografií. Celková obálka s terminálom a pedálom presahuje rozmery hlavného rámu.

Pohľad **Dorazy** odkryje zadné opláštenie; prepínač **Odkryť mechanizmus** funguje nezávisle od ochranných dverí. Skryté kryty nezachytávajú výber myšou. Celok, Čelo a Zadná časť obnovia opláštenie. Info okná pri jednotlivých sekciách obsahujú opis a obmedzenia; export stroja je v päte menu.

Proces predstavuje jeden ohyb vo vzduchu. Zadáva sa materiál, hrúbka, dĺžka ohybu, hĺbka prírezu, zadné rameno X, vnútorný uhol a otvorenie V. Výpočet `F = 1,42 × Rm × L × t² / V / 1000` používa mm, MPa a výsledok v kN. Materiálové pevnosti (oceľ 450, nehrdzavejúca oceľ 700, hliník 250 MPa), polomer, odpruženie a rýchlosti sú **výučbové odhady**. Osadený nástroj má pri zdvihnutom barane 180 mm medzeru nad matricou; nejde o katalógové otvorenie bez nástrojov. Nie je implementovaná všeobecná analýza kolízií zložitých dielov ani viacnásobné ohyby.

Baran sa priblíži, vytvorí ohyb, podrží zaťaženie a zdvihne sa s uvoľnením odpruženia. Priečny profil plechu zachováva rozvinutú dĺžku, hrúbku a polomer. Pause zachová rozpracovaný tvar; predčasné zdvihnutie ho neoznačí za dokončený ohyb. Nový plech sa vloží až pri stojacom a zdvihnutom barane. Kontroly blokujú otvorené kryty, prekážku v ochrannom poli, vypnutú hydrauliku, STOP, vybraný plech, prekročenú silu, nevhodnú matricu, príliš krátke rameno a prekročené vyloženie rámu pri širokom príreze. Pre tento plochý prírez musí byť doraz R v základnej polohe.

Mobilné HMI a monitor v 3D zdieľajú jeden živý displej. Ide o výučbové ovládanie, nie implementáciu ByVision. Ručné ovládanie zahŕňa oba pedále, STOP, bočné kryty a monitor. Po zdvihnutí barana sa dá rovnaký plech odopnúť, otočiť, vrátiť a exportovať ako STL/STEP. Stroj má samostatný export OBJ/STL/STEP aktuálnej polohy a viditeľných dielov, bez plechu a podlahy; STEP je plošková CAD geometria bez parametrickej histórie.

HMI má päť funkčných obrazoviek: **Diel** upravuje prírez a cieľový uhol, ukladá pomenované nastavenia a načítava ich spolu s tromi predvoľbami. **Nástroje** menia skutočnú V-matricu, odporúčajú V približne 8 × hrúbka a nastavujú R. **Ohýbanie** zobrazuje aktuálny tvar, fázu, osi, silu a počítadlá. **Stroj** ovláda hydrauliku, osvetlenie, kryty, simulovanú prekážku, odkrytie, natočenie terminálu a rýchlosť. **Diagnostika** ukazuje päť blokovaní, potvrdzuje odstránené hlásenia a exportuje JSON so stavom a poslednými 40 udalosťami. Nastavenia dielov sa ukladajú pod `rmt-bystronic-recipes-v1`, maximálne 20, bez hardvérových a bezpečnostných prepínačov. Načítanie prejde validáciou pred zmenou modelu a počas rozpracovaného cyklu je blokované.

Terminál má tvarovaný oranžovo-sivý stojan, čierny rám, biely spodný úchop, zadný držiak, káble a dva funkčné spínače so stavovými kontrolkami. Samostatný STOP panel má šikmú ovládaciu plochu, päť tlačidiel, červený hríbik so žltým prstencom, priechodný spodný úchop, otvorený rám z dvoch ohnutých bočných ramien a dva nezávislé pedále pod nízkym krytom. Fyzické tlačidlá, bočné menu aj HMI volajú spoločný kontrolér. STOP sa zaistí okamžite, zachová ohyb a po uvoľnení ani potvrdení hlásenia automaticky neobnoví pohyb. Nový pohyb vyžaduje výslovný štart. Testy `brakeControl.test.js` overujú tento priebeh, zamknutie nastavení, okamžité zastavenie hydrauliky, počítanie prerušených cyklov a uložené programy.

[Interaktívne HMI](img/bystronic-hmi.png) · [STOP panel](img/bystronic-stop-panel.png)

`tests/pressBrake.test.js` overuje vybraný stĺpec technického listu, silu a jej škálovanie, limity, ochranné blokovania, pause/resume, predčasný návrat, uhol po odpružení, rozvinutú dĺžku, kontakt nástroja, V-dutinu matrice, polohu dorazu a zachovanie vybraného plechu. Prehliadačové overenie pokrýva mobilné rozloženie, info okná, HMI, prehliadku plechu a všetky exporty. STEP stroja aj ohnutého plechu je overený načítaním cez OpenCascade a kontrolou BRep.

[Model 320/4300](img/bystronic-xpert-pro-320.png) · [Nástroje a ohnutý plech](img/bystronic-bend.png)

## HMI terminály a pracovný priestor

Röders používa červený terminál so strieborným rámom, PC klávesnicou, otočnými korekciami, myšou a samostatným ručným panelom. Obraz RMS6 má červený titulok, modré bloky menu a živé NC riadky a súradnice. OSCARMAX má čierny širokouhlý monitor, bielu klávesnicovú policu, myš, predné tlačidlá, podstavec monitora a spodné madlo. Jeho svetlé zeleno-sivé PC rozhranie zobrazuje skutočné polohy, dutiny, elektródu, generátor, NC blok a výsledok. Nečitateľné položky fotografií sú výučbovou rekonštrukciou, nejde o firmvér výrobcov.

Modely a fullscreen používajú rovnaký živý canvas bez nezávislého vykresľovania obrazovky (`machineScreens.js`). PC klávesnice zdieľajú kresbu `terminalKeyboard.js`. Fullscreen zachováva farebné rámy a ovládacie prvky oboch terminálov.

Všetky fullscreen HMI (Hermle, Röders, OSCARMAX, Bystronic aj zachovaný Shuangli) majú hore tlačidlo **Pracovný priestor**. Otvorí samostatné modálne okno s kamerou bez ovládania. Rovnaká živá scéna sa vykresľuje vlastným rendererom do 800 × 500 px približne 10-krát za sekundu. Otvorenie, ťahanie v okne ani zatvorenie nemení hlavnú kameru, režim ovládania, dvere či rozpracovaný cyklus. Esc zavrie najprv detail a vráti fokus do HMI; ďalší Esc zavrie HMI. Renderer sa pri zatvorení uvoľní. OSCARMAX pracovný pohľad je vpredu v nádrži a mieri na elektródu a upnutie.

[Röders HMI](img/roeders-hmi.png) · [OSCARMAX HMI](img/oscarmax-hmi.png) · [Pracovný pohľad EX500](img/oscarmax-working-area.png)

## OSCARMAX – G-kód a grafitové elektródy

Program hĺbenia prepína medzi pôvodnými operáciami a **G-kód / ISO**. Editor otvorí NC/TAP/TXT/ISO do 256 kB, ponúka ukážku a kontrolu s číslom chybného riadku. Podporuje G0/G1, G21, G90/G91, G54, G94, F v mm/min, M3/M5, M8/M9 a M2/M30. G54 Z0 je horná plocha polotovaru; záporné Z je hĺbka dutiny. Pred XY a na konci programu musí byť elektróda vytiahnutá aspoň na Z5. Výučbový proces realizuje zvislé hĺbenie a automatické bezpečné vytiahnutie medzi dutinami; nejde o všeobecné kontúrové frézovanie. Nepodporované kódy, oblúky, rýchloposuv do materiálu, XY v materiáli, chybné posuvy a neukončené hĺbenie sa odmietnu. F obmedzuje pôvodný odhad servo-prísuvu, nezvyšuje ho nad model generátora. M8 pri novom štarte zapne výplach; koncové M9 ho po dokončení vypne. Ručné vypnutie výplachu preruší cyklus a samotné pokračovanie ho neobíde. Existujúce kontroly nádrže, dielektrika, STOP a výplachu platia aj pre NC. Hold/Resume zachová materiál, miesto v operácii a zdrojový riadok.

Skrinka obsahuje štyri grafitové hranoly **8 × 8, 12 × 12, 20 × 15 a 30 × 20 mm**, všetky L100 mm. Doplňujú sa aj do už uložených knižníc; pôvodné záznamy sa nemažú. JSON v1 rozširuje nepovinné `material: "copper" | "graphite"`; staré záznamy bez materiálu ostávajú medené. Materiál sa prenáša pri uložení, importe a osadení. Grafit má tmavý matný povrch, Cu pôvodný kovový medený. Nie sú zavedené neoverené technologické rozdiely úberu alebo opotrebenia grafitu. `edmGcode.test.js` overuje kompiláciu, zamietnutie nebezpečných blokov, reálny úber a doplnenie grafitu do starých knižníc.

## Spoločné ovládanie a overenie

Kategória `#moderne` je tmavosivá; simulátory používajú pôvodné rozloženie a farebný akcent značky. Konvenčné stroje zachovávajú pôvodné vzhľady. Zvuk je pri novom načítaní vypnutý.

Oba nové stroje majú zamknutú kameru v ručnom režime, fyzické tlačidlá, živé HMI, zámok jeho polohy a odopnutie/prehliadku/vrátenie rovnakého obrobku. EX 500 pred odopnutím vypustí nádrž, otvorí stenu a odtiahne elektródu. STL a STEP zachovajú aktuálny prerušený stav; STEP používa existujúci AP214 export geometrie v mm, neobnovuje čistý polotovar.

Automatické testy `precision.test.js`, `precisionModels.test.js` a `electrodes.test.js` kontrolujú dráhy DSH, ukážkový CNC cyklus, bezpečnostné blokovania EDM, rozdiel hranol/valec, zachovanie rozpracovaného stavu, odtiahnutie medzi dutinami, priehľadný otvor okna RXU, posuv dverí bez natočenia, otvorený servisný výrez v pôdoryse, priechodnosť okna, rozsah ramena RMS bez prieniku do kabíny, polohu RMS, stacionárny stôl EX500 a validáciu skrinky.
