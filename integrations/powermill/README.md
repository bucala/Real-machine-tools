# Živé prepojenie Real Machine Tools ↔ PowerMill

Lokálny most spája webovú aplikáciu s **už otvoreným PowerMillom vo Windows** cez COM (`PowerMILL.Application`). Beží na počítači používateľa, nie na serveri aplikácie. Projekt PowerMillu sa neodosiela do cloudu.

## Spustenie

1. Na rovnakom počítači maj nainštalovaný a otvorený PowerMill, otvor jeho projekt a dokonči výpočty/dialógy. PowerMill, most aj prehliadač spúšťaj pod rovnakým používateľom a s rovnakou úrovňou oprávnení.
2. Nainštaluj **Python 3.11 alebo novší pre Windows** aj s Python Launcherom `py`. Most potrebuje `pywin32`; neobsahuje PowerMill ani licenciu Autodesku.
3. V aplikácii otvor **Hermle → Nástroje → PowerMill / CAM → Stiahnuť most pre Windows**. Rozbaľ ZIP.
4. Dvojklikni na `start.cmd`. Vytvorí lokálne `.venv`, nainštaluje `requirements-windows.txt` a spustí most. Pre čítanie NC výstupov spusti z príkazového riadka:

   ```bat
   start.cmd "C:\CAM\NC"
   ```

   Alternatívne po nainštalovaní závislostí:

   ```bat
   .venv\Scripts\python.exe bridge.py --nc-root "C:\CAM\NC"
   ```

5. Skopíruj **pairing token** z okna mosta do poľa v aplikácii a klikni na *Pripojiť / overiť stav*. V prehliadači povoľ prístup stránky k lokálnej sieti, ak sa naň opýta. Okno mosta nechaj otvorené. Token sa mení pri každom spustení; aplikácia ho uchováva iba v pamäti aktuálnej relácie.
6. Použi *Obnoviť nástroje a NC programy*. Potom *Overiť prevzaté nástroje v knižnici* alebo vyber NC program a klikni na *Prevziať NC do detekcie*. Samotné prevzatie nemení obrobok ani program simulátora.

Most načúva výhradne na **127.0.0.1:8766**. Webová aplikácia aj PowerMill preto musia bežať v prehliadači a na desktope toho istého počítača. Nevystavuj ho na verejnej adrese. Zastavíš ho cez Ctrl+C alebo zavretím okna; PowerMill zostane otvorený.

## Čo sa prenáša

- **Stav bežiaceho PowerMillu** a informácia, či je zaneprázdnený.
- **Nástroje otvoreného projektu:** end mill, ball nosed, tip radiused a drill. Číslo T, priemer, polomer, rezná dĺžka, overhang, počet zubov a vrcholový uhol, ak ich COM sprístupňuje. Palcové projekty sa pri čítaní prepočítajú na mm. Nepodporované typy alebo nástroje bez platného čísla T sa zobrazia v upozorneniach.
- **Existujúci vygenerovaný NC výstup** vybraného NC programu. V PowerMill najprv spusti postprocesor a ulož súbor pod adresár `--nc-root`; most ho iba prečíta. Nespúšťa postprocesor automaticky a neposkytuje prehliadanie disku. `FileName` musí ukazovať na konkrétny existujúci súbor v tomto adresári alebo podadresári, do 2 MB.
- **Nová kópia vybraného nástroja do PowerMillu:** na karte *Skrinka* vyber a over nástroj, na karte *PowerMill / CAM* použi *Vytvoriť nový nástroj v PowerMill*. Vyžaduje projekt v mm. Vytvorí entitu `RMT_T<číslo>_<jedinečné ID>`; existujúce nástroje a dráhy sa nenahrádzajú. Čítaním späť sa overí priemer, LC, vyloženie, číslo a zuby.

**Mapovanie dĺžok:** PowerMill `Length` sa prenáša ako rezná časť `LC`, `Overhang` ako `S`. Z nich sa automaticky neurčuje korekčná dĺžka `L` od čela vretena ani reálny HSK držiak. Pri prevzatí ich doplň v editore. Pri odoslaní sa vytvorí zjednodušený driek a valcový držiak ØH s dĺžkou `L − S`. Nie je to presná natívna zostava HSK-A63; skutočné upnutie a gauge length over v PowerMill pred použitím. Skosovací nástroj sa prenáša ako kužeľový vrták so zadaným uhlom.

Ak vytváranie zlyhá alebo vyprší spojenie, v PowerMill môže zostať čiastočne vytvorená nová entita. Hlásenie pri chybe príkazu obsahuje jej názov. **Pred opakovaním ju skontroluj**; most automaticky nemaže entity ani nerobí rollback projektu.

## Lokálne API

Všetky požiadavky okrem preflight vyžadujú `Authorization: Bearer <token>` a presný povolený `Origin`. Predvolený origin je `https://real-machine-tools.marcel-bucala.workers.dev`. Pre lokálny vývoj:

```bat
.venv\Scripts\python.exe bridge.py --origin http://127.0.0.1:5173 --nc-root "C:\CAM\NC"
```

| Endpoint | Účinok |
| --- | --- |
| `GET /v1/status` | pripojenie k existujúcej COM inštancii a stav busy |
| `GET /v1/snapshot` | podporované nástroje a názvy NC programov |
| `POST /v1/nc` s `{"name":"NC1"}` | čítanie existujúceho NC výstupu danej entity v povolenom priečinku |
| `POST /v1/tools` s `{"tool":{…}}` | explicitné vytvorenie novej validovanej kópie nástroja |

Most neprijíma voľné makrá, príkazy ani cestu k súboru od prehliadača. Kontroluje Origin, Host, token, veľkosť, rozmery a cesty vrátane symbolických odkazov. COM operácie sa vykonávajú sériovo na jednom STA vlákne. Tokeny a obsah požiadaviek sa nezapisujú do logov. Prehliadač posiela token iba na pevnú loopback adresu; CSP aplikácie povoľuje len tento dodatočný cieľ. Spojenie sa automaticky neopakuje pri chybe vytvárania.

## Overenie a limity

HTTP rozhranie, párovanie, mapovanie parametrov, ochrana lokálnych ciest, tvorba príkazov, čítanie späť a klient sú pokryté automatickými testami s **náhradným COM objektom**. Toto Linuxové prostredie nemá Windows ani PowerMill; **reálne COM spojenie a geometriu treba overiť na konkrétnej inštalácii PowerMillu**. Rozhranie používa verejne doložené `GetActiveObject`, `DoCommandEx`, `Project.Tools`, `Project.NCPrograms` a `PRINT PAR TERSE`; verzie PowerMillu sa môžu líšiť.

Pri prvom spustení over stav, prevzatie jedného známeho nástroja, jeho rozmery, čítanie existujúceho NC a vytvorenie jednej kópie v skúšobnom projekte. Ak sa nedá pripojiť, over COM registráciu pri inštalácii PowerMillu, rovnakého používateľa a oprávnenia, zatvorené modálne dialógy a povolenie lokálnej siete v prehliadači.

Zdroje syntaxe (implementácia mosta je samostatná; nepribaľuje cudzie DLL):

- [Excel-PowerMill – pripojenie k COM](https://github.com/OndrejMikulec/Excel-PowerMill)
- [PowerMill API – PMAutomation, PMTool, PMNCProgram](https://github.com/tonynzosh/PS_PM_API/tree/master/Delcam.ProductInterface.PowerMILL)
- [Príklad tvorby nástroja](https://github.com/Diosants/PowermillAPICreatingTool)

Vývojárske testy: `python3 -m unittest discover -s integrations/powermill -p test_bridge.py`. ZIP obnov: `python3 integrations/powermill/package.py` a potom `npm run build`.
