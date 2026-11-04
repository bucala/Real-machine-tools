# PowerMill / CAM a knižnica nástrojov

V simulátore **Hermle C 32 U / C 42 U → Nástroje → Skrinka a knižnica nástrojov…** nájdeš skrinku, editor, detekciu z NC a kartu **PowerMill / CAM**.

## Prenos programu

1. V PowerMill vytvor NC program postprocesorom pre zodpovedajúci stroj s otočno-sklopným stolom A/C a riadenie ISO/Fanuc alebo Heidenhain. Použi mm, dráhu stredu nástroja bez G41/G42 a nulový bod G54 v strede hornej plochy polotovaru. Podporovaná podmnožina príkazov je uvedená v README a v aplikácii v časti *Program z CAM*.
2. V knižnici otvor *Detekcia z NC* a vyber `.nc` alebo `.h`. Detekcia sama nemení stroj, jeho program ani rozpracovaný diel. Súbor môže mať najviac 2 MB.
3. Pri každom T klikni na *Otvoriť a overiť*. Doplň geometriu podľa CAM alebo nástroja, over prípadné rozpory a potvrď kontrolu rozmerov. Chýbajúce údaje v editore sú **dočasný vzor**; nejde o rozmery zistené z NC.
4. Ulož nástroj do skrinky. Vyber miesto zásobníka s číslom T zhodným s programom a osaď nástroj. C32 má 36 a C42 42 miest. Skrinka môže obsahovať 500 položiek vrátane alternatívnych nástrojov s rovnakým predvoleným T; každá má samostatné ID.
5. Vráť sa na *Detekcia z NC*, potvrď obnovenie polotovaru a klikni na *Načítať NC do stroja*. Skontroluj chyby interpretera a až potom spusti simuláciu. Výsledok môžeš exportovať ako STP/STEP alebo STL.

Osadenie nástroja alebo načítanie programu obnovuje simuláciu od polotovaru. Počas behu alebo prehliadky obrobku sú tieto akcie zablokované. Prezeranie, editácia a uloženie v skrinke samy osebe nemenia stav stroja. Skrinka sa uchováva v tomto prehliadači; osadenie zásobníka zostáva nastavením aktuálnej relácie simulátora. Tlačidlo *Uložiť osadené do skrinky* odloží kópie aktuálnych nástrojov stroja vrátane úprav v jeho tabuľke, bez vybratia zo zásobníka. Zhodné záznamy sa nepridávajú opakovane.

## Čo sa dá zistiť z NC

Rozpoznávajú sa čísla `T3`, `T003`, `T 3` a Heidenhain `TOOL CALL 3` / `TOOL DEF 3`. Samotné číslo nástroja neobsahuje rozmery. `G43 H3`, `G41 D3`, súradnice, cykly a hodnoty `R` sa nepovažujú za geometriu nástroja.

Postprocesor môže doplniť explicitné komentáre. Jednoriadkový príklad s kompletnou geometriou:

```gcode
(T3 D=10 CR=0 L=115 LC=25 S=48 DH=32 Z=3 TYPE=flat NAME=End mill 10)
```

Alebo samostatné komentáre:

```gcode
(TOOL NUMBER: 3)
(TOOL NAME: flat end mill 10)
(TOOL DIAMETER: 10)
(CORNER RADIUS: 0)
(GAUGE LENGTH: 115)
(FLUTE LENGTH: 25)
(STICK-OUT: 48)
(HOLDER DIAMETER: 32)
(FLUTES: 3)
```

- `D`: priemer reznej časti; `CR`: polomer rohu.
- `L` / `GAUGE LENGTH`: vzdialenosť od čela vretena po špičku, používaná aj pri G43 / TOOL CALL. Všeobecný údaj `TOOL LENGTH` sa automaticky nepoužíva, pretože nemusí znamenať túto dĺžku.
- `LC`: rezná dĺžka; `S`: vyloženie z držiaka; `DH`: priemer držiaka HSK-A63.
- `Z`: počet zubov; `TIP` / `TAPER`: vrcholový uhol špičky v stupňoch.
- `TYPE`: `flat`, `ball`, `bull`, `drill`, `chamfer`. Pri vrtáku zadaj aj uhol `TIP`.
- `NAME` je posledná položka jednoriadkového komentára.

Hlavička bez jednotiek sa vyhodnocuje v mm. Po `G20` / `BEGIN PGM … INCH` sa explicitné dĺžkové údaje prepočítajú na mm, po `G21` / `BEGIN PGM … MM` sa používajú mm. Jednotky preto uveď **pred hlavičkou nástrojov**. Pri rozdielnych hodnotách rovnakého poľa pre to isté T sa zobrazí rozpor na manuálne overenie. Neznáma alebo dynamicky vypočítaná geometria sa neuvádza ako potvrdený údaj.

Karta *PowerMill / CAM → Export metadát osadených nástrojov* vytvorí `.nc` obsahujúci iba komentáre. Nie je to obrábací program ani natívna databáza PowerMill.

## Záloha a prenos skrinky

**JSON** zachováva ID aj všetky podporované rozmery. **CSV** obsahuje stĺpce:

```text
id,t,name,kind,d,cr,tip,l,lc,s,dh,z
```

`kind` je `mill` alebo `cone`; čísla používajú desatinnú bodku a rozmery sú v mm. CSV akceptuje čiarku alebo bodkočiarku ako oddeľovač a štandardné úvodzovky pre názvy. Export pridáva UTF-8 BOM a chráni názvy začínajúce znakom vzorca pri otvorení v tabuľkovom procesore. JSON má obal:

```json
{
  "format": "rmt-tool-library",
  "version": 1,
  "units": "mm",
  "tools": [
    {"id":"example-3","t":3,"name":"End mill 10","kind":"mill","d":10,"cr":0,"tip":118,"l":115,"lc":25,"s":48,"dh":32,"z":3}
  ]
}
```

Import záznamy pridáva: zhodné ID a geometriu preskočí, pri rozdielnej geometrii rovnakého ID vytvorí samostatnú kópiu. Neplatný súbor sa odmietne celý, uložená skrinka sa neprepíše čiastočnými údajmi. Nástroj musí mať Ø 0,5–80 mm, L 40–300 mm, 1–12 zubov a konzistentné vyloženie a reznú dĺžku. Zmazanie položky zo skrinky nevyberá nástroj z už osadeného stroja.

## Rozsah prepojenia

Prepojenie funguje cez súbory bez ďalšej inštalácie. V PowerMill vytvor NC výstup kompatibilným postprocesorom a načítaj ho do simulátora cez kartu *PowerMill / CAM*.

Natívne projekty `.pmlprj`, databázy a kompletná simulácia PowerMillu sa neimportujú. JSON/CSV je formát tejto aplikácie; pre natívny import súborov do PowerMill potrebuješ mapovanie alebo importér. Komentáre postprocesorov sa líšia, preto aplikácia nepredpokladá, že každý PowerMill NC program obsahuje geometriu. Rozmery držiaka a dĺžku od čela vretena po špičku vždy skontroluj v editore.

[Autodesk PowerMill](https://www.autodesk.com/products/powermill/product-details#all-features) · [README – CNC](../../README.md#-moderné-stroje--cnc-a-5-osé-obrábanie-moderne)
