# Audit klasických strojov – ovládače, kolízie, dizajn (9. 11. 2026)

Kontrola 18 klasických strojov (vrátane skrytej priečnej obrážačky) v zostavenej aplikácii v Chromiu.

## Ako sa kontrolovalo

- **Ovládače v scéne.** Skript v prehliadači prešiel každý zaregistrovaný ovládač: tlačidlá, páky, kolesá aj posuvné
  diely, spolu 180. Každý aktivoval a zaznamenal, čo sa zmenilo v stave stroja.
  - Ovládače bez zmeny stavu otestoval druhý prechod znova, každý samostatne na čerstvo načítanom stroji. Tak sa
    odlíšilo skutočne nefunkčné od poradia, napríklad ŠTART po vypnutí hlavného vypínača.
- **Klikateľnosť.** Pre každý ovládač sa overilo, či ho myš z predvoleného pohľadu trafí. Ak nie, testovalo sa
  zblízka z 9 smerov a zisťovalo sa, čo ho zakrýva.
- **Kolízie.** Prešiel som kód a urobil dynamické skúšky: pri stojacom stroji sa nástroj, stôl alebo suport posunie
  kolesom do obrobku alebo upínača a sleduje sa, či sa pohyb zastaví. Testované boli sústruh, frézka, vŕtačka,
  brúska, guľato, odvalovačka, horizontálka, obrážačky a radiálka.
- **Dizajn.** Porovnal som snímky všetkých strojov z predvoleného pohľadu.

## Výsledky

| Stroj                    | Ovládače | Funkčné | Poznámka                                                                    |
| ------------------------ | -------: | :-----: | --------------------------------------------------------------------------- |
| Sústruh TOS SN           |       22 |   áno   | kryt skľučovadla a nožná brzda sú príslušenstvo (predvolene skryté)         |
| Frézka                   |       21 |   áno   | kľuka a aretácia deliaceho prístroja len pri namontovanom prístroji         |
| Vŕtačka                  |        8 |   áno   |                                                                             |
| Odvalovacia frézka       |        6 |   áno   | málo ovládačov v scéne – výmenné kolesá a sklon frézy len v paneli          |
| Radiálna vŕtačka VO 50   |       13 |   áno   | rameno ▲ / ▼ hlási uvoľnenie stĺpa                                          |
| Horizontálka Varnsdorf   |       10 |   áno   |                                                                             |
| Ručná ohýbačka           |        2 |   áno   |                                                                             |
| Tabuľové nožnice BS 2000 |        3 |   áno   | hlavný vypínač je z predvoleného pohľadu zakrytý (treba otočiť kameru)      |
| Lis TOMA LEN 40C         |        8 |   áno   |                                                                             |
| Profilová ohýbačka COMAC |       10 |   áno   |                                                                             |
| Zakružovačka XZC 3000/10 |        7 |   áno   | **opravené:** panel bol otočený k stojanu, tlačidlá sa nedali kliknúť       |
| Rovinná brúska           |       14 |   áno   |                                                                             |
| Brúska na guľato BUA     |       11 |   áno   |                                                                             |
| Priečna obrážačka        |       10 |   áno   | v menu skrytá                                                               |
| Zvislá obrážačka ST 350  |       10 |   áno   |                                                                             |
| Pásová píla              |        7 |   áno   |                                                                             |
| Zváranie MMA             |        4 |   áno   | zdroj nie je v predvolenom pohľade (pohľad na spoj) – zámerné               |
| Zváranie MIG/MAG         |        7 |   áno   | zdroj nie je v predvolenom pohľade (pohľad na spoj) – zámerné               |

- Žiadny ovládač nevyhodil výnimku a v konzole nebola chyba.
- Ovládače, ktoré samostatne nezmenili stav, sú očakávané:
  - STOP pri stojacom stroji;
  - pedál alebo rameno s hláškou o podmienke („Motor stojí…“, „uvoľni upínaciu páku stĺpa“);
  - stredný valec na doraze.

### Kolízie

Všetky stroje s rezným nástrojom majú v kóde kontrolu dotyku, ktorá pohyb zastaví:
- **Sústruh:** čeľuste, koník, luneta, nožová hlava.
- **Frézka:** obrobok, zverák, deliaci prístroj.
- **Vŕtačka a radiálka:** obrobok, podložky, stôl, spúšťanie ramena.
- **Brúsky:** magnetická doska, hroty a unášač.
- **Obrážačky:** čeľuste zveráka, skľučovadlo, plný materiál.
- **Odvalovačka a horizontálka:** prísuv do stojaceho polotovaru, stena odliatku.

V dynamických skúškach sa pohyb vždy zastavil pred prienikom. Napríklad suport sa pri ručnom kolese zastavil pred
čeľusťami (zadané Z 91,5, skutočné 95,5 mm) a pri pohybe na druhú stranu na koníku s hláškou.

Nedostatky:

- **Hláška o náraze nie je vždy viditeľná.** Ukáže sa len v stavovom riadku na 2,6 s. Nič v scéne neukáže, čo
  narazilo – pri rýchlom točení kolesom si žiak náraz nemusí všimnúť.
- **Zvuk nárazu chýba.** Pri dotyku nehrá žiadny zvuk.

### Dizajn – rozdiely v detailnosti

- **Prepracované stroje:** sústruh SN, frézka, lis, nožnice, radiálka, brúska, profilová ohýbačka.
- **Výrazne jednoduchšie, hranaté bloky bez detailov:**
  - **odvalovacia frézka** – stojan a hlava sú kvádre, fréza a výmenné kolesá málo viditeľné;
  - **horizontálka Varnsdorf** – stojan je doska, vreteník bez krytov a stupníc;
  - **brúska na guľato BUA** – lôžko je jeden veľký kváder, chýba vreteník kotúča s krytom, pracovný a koníkový
    vreteník sú malé;
  - **zvislá pásová píla** – jednoduché kolesá a stôl, chýbajú kryty kolies s dvierkami, napínacie koleso a
    odsávanie;
  - **vŕtačka** – jednoduchý stĺp a hlava.
- **Všeobecne:**
  - chýbajú zaoblené hrany odliatkov a rebrá;
  - chýbajú výrobné štítky a stupnice na kolesách (ryskované krúžky);
  - chýbajú olejoznaky, mazacie čapy, káble a vypínače s popisom;
  - chýbajú tabuľky otáčok a posuvov pri pákach.

## Oprava v tomto kole

- **Zakružovačka:** čelo skrinky s tlačidlami (hlavný vypínač, Vzad, STOP, Vpred, núdzový STOP) je otočené
  k obsluhe pred valcami. Predtým bolo otočené k stojanu stroja a z predvoleného pohľadu sa nedalo kliknúť ani
  jedno tlačidlo (0 zásahov zo 64 – 104 bodov, teraz 45 – 98).
- **Test v prehliadači:**
  - v každom klasickom stroji aktivuje všetky ovládače a zlyhá pri výnimke alebo chybe v konzole;
  - pri zakružovačke overí, že tlačidlá panelu sú klikateľné.

## Návrhy vylepšení

### Funkčnosť a kolízie

1. **Viditeľný náraz.**
   - Diel, ktorý narazil (čeľusť, zverák, stôl), krátko zasvieti načerveno a v scéne sa ukáže bod dotyku.
   - Zaznie zvuk nárazu.
   - Hláška ostane, kým žiak neodsunie nástroj.
2. **Počítadlo nárazov v úlohách.** Ako pri lise: náraz znižuje hodnotenie a zapíše sa do protokolu.
3. **Spoločný modul kolízií.**
   - Obalové telesá dielov (valec, kváder) a jedna funkcia „vzdialenosť nástroja k prekážke“ pre všetky stroje.
   - Dnes má každý stroj vlastnú logiku. Jednotný modul uľahčí nové stroje a test.
4. **Odozva tlačidla bez účinku.**
   - STOP pri stojacom stroji a ŠTART pri vypnutom vypínači krátko ukážu dôvod („Stroj stojí“, „Zapni hlavný
     vypínač“) namiesto tichého nič.
5. **Ovládače, ktoré sú dnes len v paneli, presunúť aj do scény:**
   - výmenné kolesá a sklon frézy na odvalovačke;
   - prepínanie rýchlosti pásu na píle;
   - nastavenie dorazov (narážok) stola na brúske ťahaním.
6. **Stupnice na kolesách.** Ryskovaný krúžok s nulovaním (ako na skutočnom stroji) a hodnota pri kurzore počas
   točenia.
7. **Predvolený pohľad k obsluhe** na nožniciach (hlavný vypínač zakrytý stojanom) a kontrola, že každý stroj
   začína z miesta obsluhy.

### Dizajn

8. **Odvalovacia frézka TOS Čelákovice:**
   - stojan s vedením a krytom;
   - hlava s otočnou doskou a stupnicou sklonu;
   - fréza na tŕni s ložiskom;
   - skriňa výmenných kolies s otváracím krytom;
   - protistojan s ramenom.
9. **Horizontálka TOS Varnsdorf:**
   - stojan s rebrami a vedením;
   - vreteník s krytmi, stupnicami a pákami prevodovky;
   - otočný stôl s T-drážkami a stupnicou B;
   - lunetový stojan pre dlhé tyče.
10. **Brúska na guľato TOS BUA:**
    - lôžko s vaňou na chladiacu kvapalinu a vodiacimi plochami stola;
    - vreteník kotúča s krytom a remeňovým krytom;
    - pracovný vreteník s unášačom;
    - koník s pákou;
    - hydraulický agregát vedľa stroja.
11. **Zvislá pásová píla TOS PPN:**
    - kryty kolies s dvierkami a kontaktom;
    - napínacie koleso so stupnicou napnutia;
    - posuvné pravítko a uhlový doraz na stole;
    - odsávacie hrdlo.
12. **Spoločné detaily pre všetky stroje:**
    - zaoblené hrany (RoundedBox);
    - výrobné štítky TOS;
    - olejoznaky a tabuľky otáčok pri pákach;
    - káble k rozvádzaču;
    - jemná textúra liatiny.

## Návrhy nových strojov (najmä TOS)

| #   | Stroj                                                       | Čo by učil                                                                    |
| --- | ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 13  | Univerzálna konzolová frézka TOS FGU 32 / FA 4 (Olomouc)    | otočný stôl pre skrutkovicové drážky, vodorovné vreteno s tŕňom, súbežné / nesúbežné frézovanie |
| 14  | Nástrojárska frézka TOS FNK 25                              | zvislá a vodorovná hlava, uhlový stôl, presné rozmery malých dielcov          |
| 15  | Karuselový sústruh TOS Hulín SK 12 / 16                     | veľké obrobky na upínacej doske, dve suportové hlavy, priečnik                |
| 16  | Univerzálny hrotový sústruh TOS SV 18 RA (Svitavy)          | najčastejší školský sústruh, porovnanie so SN                                  |
| 17  | Nástrojárska brúska TOS BN 102                              | ostrenie vrtákov a fréz, uhly čela a chrbta                                   |
| 18  | Bezhrotová brúska (TOS Hostivař)                            | brúsenie bez hrotov, podávací kotúč, sklon a výška obrobku                    |
| 19  | Obrážačka ozubenia (Fellows, TOS Čelákovice)                | vnútorné ozubenie, odvaľovací pohyb nožového kolesa                           |
| 20  | Stojanová dvojkotúčová brúska                               | BOZP: opierka, štít, vzdialenosť 2 – 3 mm, ostrenie sústružníckeho noža        |
| 21  | Vodorovná pásová píla na kov a ohýbačka rúr                 | delenie profilov vo zveráku pod uhlom, ohýbanie rúr – nadväzuje na úlohy MAG   |
| 22  | Pneumatický buchar (Šmeral)                                 | voľné kovanie, ohrev, údery, ručné náradie                                     |

Pri nových strojoch platia rovnaké zásady ako doteraz:
- skutočné ovládače v scéne;
- kontrola kolízií;
- úlohy s výkresom a protokolom;
- sprievodca krok za krokom a test v prehliadači.

## Stav realizácie (9. 11. 2026)

Body 5 – 12 sú hotové (ovládače v scéne, stupnice na kolesách, pohľad k obsluhe, detailnejšie modely a spoločné
detaily). Nové stroje boli postavené podľa konkrétnych overených modelov:

| #   | Stroj v aplikácii                                    | Overený model a zdroj údajov                                                                 |
| --- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 13  | Univerzálna konzolová frézka (`#fgu`)                | TOS Olomouc FGU 32 – inzeráty exapro, fermatmachinery                                        |
| 14  | Nástrojárska frézka (`#fnk`)                         | TOS Kuřim FNK 25 – unimachines, amaron-trading                                               |
| 15  | Karuselový sústruh (`#karusel`)                      | TOS Hulín SK 12 – unimachines, fermatmachinery                                               |
| 16  | Hrotový sústruh (`#sv`)                              | TOS Trenčín SV 18 RA (nie Svitavy) – inzeráty, smlouvy.gov.cz                                |
| 17  | Nástrojárska brúska (`#bn`)                          | TOS Hostivař BN 102 – model prerobený podľa fotiek používateľa (podstavec, stôl, mech, dva kotúče) |
| 18  | Bezhrotová brúska (`#bezhrot`)                       | TOS Hostivař BBJ 6 – priemer do 63 mm                                                         |
| 19  | Zvislá obrážačka s otočným stolom (`#hov`)           | TOS HOV 25 – zdvih 250 mm, stôl Ø500, posuvy 560 × 450 mm, vyloženie 365 mm, 4,5 kW, ≈ 2,85 t (inzeráty aptint, unimachines, machineryline); na želanie používateľa nahradila obrážačku ozubenia OHA 32 A |
| 20  | Brúska nožov (`#dvojkotuc`)                          | TOS BBT 350 – dva kotúče brúsiace čelom, naklápacie stoly 560 × 210 mm, vreteno ≈ 1 560 ot/min (inzerát equipt, fotky používateľa) |
| 21  | Vodorovná pásová píla (`#pasovka`)                   | Pilous ARG 200 PLUS (Česko, nie TOS) – kruh do Ø200, pás 20 × 0,9 mm, 40 / 80 m/min, 60° / 45° (directindustry) |
| 21  | Ohýbačka rúr                                         | konkrétny model TOS sa nenašiel – zostáva na ďalšie kolo                                      |
| 22  | Kovací buchar (`#buchar`)                           | Šmeral KHZ 2 – 20 kJ, baran 920 kg, zdvih 400 mm, 60 úderov/min (inzerát exapro); KJH 2 sa overiť nepodarilo, KJH 4 je protiúderový zápustkový buchar |

Údaje, ktoré sa nepodarilo overiť (napr. stupne zdvihov HOV 25), sú v simulátore označené ako orientačné.
