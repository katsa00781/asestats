# ASEStats Mobile – Vizuális design promptok

_Létrehozva: 2026-08-30 · 1 alapozó + 14 képernyő prompt_

Célszerszám: **v0 / Figma Make / Lovable / Claude Artifact**. A promptok iPhone-keretes vizuális makettet kérnek, nem futtatható React Native kódot – a kimenet a **design nyelv validálására** szolgál, az RN implementáció ezután, kézzel készül.

---

## Használat

Minden prompt két részből áll össze:

1. a lenti **DS-BLOKK** (változatlan, minden promptban azonos), plusz
2. a képernyő saját prompt-teste, ahol a `[[DS-BLOKK]]` jelölés áll.

**Futtatáskor a `[[DS-BLOKK]]` helyére másold be a DS-BLOKK teljes szövegét.** Így minden prompt önállóan futtatható külön chat-ablakban is.

> _Eltérés a tervtől:_ a terv szerint minden prompt szó szerint tartalmazta volna a blokkot. Egyetlen definíció + jelölés helyette azért jobb, mert egy token-változás így egy helyen javul, nem tizenöt helyen – a 15-szörös másolat garantáltan szétcsúszna.

### Futtatási sorrend

**Először a P0-t futtasd le.** Ha a style tile nem áll össze, a `mobile-ui-context.md` módosul, és csak utána megy a többi. Utána P2 és P8 – ez a két képernyő feszíti meg legjobban a rendszert (sűrű StatTile rács, illetve fagyasztott oszlopos mátrix). Ha ez a három rendben van, a maradék 11 futhat bármilyen sorrendben.

---

## DS-BLOKK

````
=== ASE STATS – DARK COMMAND CENTER DESIGN RENDSZER ===

Ez egy magyar kosárlabda-statisztikai alkalmazás (ASE – Atomerőmű SE) iOS verziója.
Karaktere: sportos telemetria, "command center" – sötét, sűrű, precíz, adatvezérelt.
NEM lekerekített, barátságos consumer app. Műszerfal-érzet, nem játék-érzet.

SZÍNEK (pontosan ezeket használd, más színt ne vezess be):
  Háttér alap        #050B14
  Kártya felület     #0A1628
  Nyomott / sheet    #0F1F3D
  Beágyazott / aktív #162440

  Cián (primary)     #00D4FF     Cián halvány  #0096B8
  Narancs (CTA)      #FF6B35     Narancs halv. #B84A22
  Lila (AI tartalom) #7C3AED     Lila halvány  #5B21B6

  Szöveg fő          #E8F4FF
  Szöveg másodlagos  #7A9ABB
  Szöveg halvány     #4A6D95

  Pozitív / nyert    #10D98A
  Negatív / vesztett #FF4757
  Figyelmeztetés     #FFB627

  Vonal finom        #0F2040
  Vonal aktív        #1E3A5F
  Vonal erős         #2A4A75

TIPOGRÁFIA (három család, szigorú szereposztás – ne keverd őket):
  Barlow Condensed – címek, címkék, badge-ek, gombfeliratok.
                     Címkéknél ALL CAPS + 0.12em betűköz.
  DM Sans          – folyó szöveg, leírások.
  JetBrains Mono   – MINDEN szám, kivétel nélkül, tabular-nums igazítással.

MÉRETEK (pt, iPhone 15 – 390×844):
  Címek:  34 hero / 28 képernyőcím / 22 szekció / 17 kártyacím  (Barlow Condensed 600)
  Számok: 40 hero / 28 fő stat / 20 kiemelt / 15 cella          (JetBrains Mono)
  Szöveg: 15 body / 13 caption                                   (DM Sans)
  Címke:  11 ALL CAPS 0.12em betűköz                             (Barlow Condensed 600)

TÉRKÖZ: 4pt rács – 4 / 8 / 12 / 16 / 20 / 24 / 32
  Képernyő oldalmargó 16 · kártyák közti rés 12 · kártya belső padding 16 · szekciórés 24

SARKOK: badge 2 · input 4 · gomb 6 · listasor 10 · fő kártya 14
  FONTOS: szűk sarkok, NEM iOS-esen kerek. Ez adja a telemetria-karaktert.

GLOW – nem árnyékkal, hanem rétegzéssel:
  háttér = accent szín 14% opacitás
  keret  = accent szín 30% opacitás, 1pt
  szöveg = accent szín 100%
  (AI variáns erősebb: 16% háttér / 40% keret / #C4B5FD szöveg)

JELLEGZETES ELEMEK – ezek adják a rendszer arcát, ne hagyd el őket:
  • BAL OLDALI ACCENT SÍN: 3pt függőleges csík a kártyák bal szélén, accent színben.
    Ez a legfelismerhetőbb jel az egész rendszerben.
  • PONT-RÁCS HÁTTÉR: nagyon halvány cián pontok 24pt rácsban a #050B14 alapon
    (kb. rgba(0,212,255,0.045)). Alig látható, de érezhető textúra.
  • Minden szám monospace és tabuláris – az oszlopok tökéletesen igazodnak.
  • Címkék mindig ALL CAPS, tág betűközzel, halvány színben.

BADGE VARIÁNSOK: cián · narancs · AI(lila) · pozitív · negatív · figyelmeztetés · semleges
  Barlow Condensed 600, ALL CAPS, 11pt, 0.12em betűköz, 2pt sarok, 3×8pt padding.

iOS KONVENCIÓK:
  • Safe area tisztelve: felül 44pt nav bar + inset, alul 49pt tab bar + home indicator
  • Minden érintési célpont legalább 44×44pt
  • Nincs hover – nyomott állapot: #0A1628 → #0F1F3D + a bal accent sín felerősödik
  • Státuszsáv világos tartalommal (sötét téma)

NYELV: minden felirat MAGYAR.
=== DS-BLOKK VÉGE ===
````

---

# P0 · Design system style tile

> **Ezt futtasd elsőnek.** Ez validálja a design nyelvet, mielőtt bármelyik képernyő elkészülne.

```
[[DS-BLOKK]]

FELADAT
Készíts egy "style tile" áttekintőt a fenti design rendszerről – NEM képernyőt,
hanem komponens-katalógust, ahogy egy design system dokumentáció kezdőoldala kinéz.
Formátum: egyetlen álló, görgethető felület 390pt szélességben, #050B14 alapon,
a halvány cián pont-ráccsal.

TARTALOM, fentről lefelé:

1. FEJLÉC
   "ASE STATS" Barlow Condensed 600, 28pt, alatta "DESIGN RENDSZER · iOS" 11pt
   ALL CAPS címke stílusban, halvány színnel.

2. SZÍNPALETTA
   Négy sor színmintákkal, mindegyik alatt a hex kód JetBrains Mono 11pt-tal:
   – Felületek: #050B14 #0A1628 #0F1F3D #162440
   – Accentek: #00D4FF #FF6B35 #7C3AED
   – Szemantikus: #10D98A #FF4757 #FFB627
   – Szöveg: #E8F4FF #7A9ABB #4A6D95
   A minták 56×56pt négyzetek, 4pt sarokkal.

3. TIPOGRÁFIA
   Mutasd be a három családot egymás alatt, mindegyiknél a szerepével:
   – Barlow Condensed: "MECCS ÁTTEKINTÉS" 22pt / "PONTÁTLAG" 11pt ALL CAPS
   – DM Sans: egy mondat folyó szöveg 15pt-tal
   – JetBrains Mono: "88 : 74" 40pt és "14.2  6.1  3.4" 20pt

4. STATTILE – 2 oszlopos rács, négy darab
   Mindegyik: bal 3pt accent sín, 96pt magas, #0A1628 alap, 14pt sarok,
   felül 11pt ALL CAPS címke halvány színnel, alatta 28pt mono érték.
   – "PONTÁTLAG" 78.4 – cián sín
   – "ASSZISZT" 15.2 – narancs sín, mellette zöld ▲ +2.1 trend-pill
   – "LEPATTANÓ" 38.6 – zöld sín
   – "HATÉKONYSÁG" 104.2 – lila sín

5. BADGE-EK
   Egy sorban mind a hét variáns: NYERT (zöld) · VESZTETT (piros) · AI ELEMZÉS (lila)
   · HAZAI (cián) · KIEMELT (narancs) · ELAVULT (sárga) · BEJÁTSZÓ (semleges)

6. GOMBOK
   – Elsődleges: tömör cián alap, #050B14 szöveg, ALL CAPS, 6pt sarok, 44pt magas
   – Másodlagos: #0F1F3D alap, aktív keret
   – Szellem: átlátszó, másodlagos szövegszín

7. LISTASOR MINTA (StackedRow) – három sor egymás alatt
   Bal oldalt 32pt kör mezszámmal, mellette név DM Sans 600 15pt és alatta poszt
   13pt halványan; jobbra három monospace szám (14.2 / 6.1 / 3.4), fölöttük
   11pt ALL CAPS fejléc: PPG RPG APG.
   A középső sor legyen NYOMOTT állapotban: #0F1F3D háttér + 2pt cián bal sín.

8. STATMATRIX MINTA
   Fagyasztott bal oszlop (108pt, "JÁTÉKOS" fejléc, #0A1628 alap, jobb szélén
   aktív színű elválasztó vonal), mellette vízszintesen görgethető statoszlopok:
   PER PT RB AS ST. A görgethetőséget a fagyasztott oszlop jobb szélén finom
   gradiens árnyék jelzi.

9. EGYÉB ELEMEK
   – bar-track / bar-fill: 6pt magas pill, #162440 alapon cián gradiens kitöltés
   – live-dot: 8pt piros pulzáló pont "ÉLŐ" felirattal
   – ai-marker: bal oldali 2pt lila függőleges gradiens sáv, mellette szövegblokk
   – hairline: finom, két végén elhalványuló elválasztó vonal

KIMENET
Egyetlen, sűrű, precíz katalógus-felület. Ne magyarázd, mutasd.
Minden felirat magyar. A hangulat: műszerfal, nem marketing oldal.
```

---

# P1 · Bejelentkezés

```
[[DS-BLOKK]]

KÉPERNYŐ: Bejelentkezés
Ez a belépőpont – az app teljesen zárt, csak belső csapattagoknak.

FELÉPÍTÉS (390×844pt iPhone keret, függőlegesen középre igazítva):

1. Fent, a képernyő felső harmadában:
   – 64pt kör logó, cián radiális glow-val mögötte (trófea/kosárlabda ikon,
     vékony vonalas, cián színben)
   – Alatta "ASE STATS" Barlow Condensed 700, 28pt
   – Alatta "STATISZTIKA · ELEMZÉS" 11pt ALL CAPS, 0.18em betűköz, halvány színnel

2. Középen a form, 16pt oldalmargóval:
   – "E-MAIL" 11pt ALL CAPS címke, alatta input mező:
     #0A1628 alap, aktív színű 1pt keret, 4pt sarok, 48pt magas,
     JetBrains Mono szöveg, placeholder halvány színnel: "nev@example.hu"
   – 16pt rés
   – "JELSZÓ" címke + azonos input, pontokkal kitöltve
   – 24pt rés
   – Elsődleges gomb teljes szélességben: tömör cián alap, #050B14 szöveg,
     "BEJELENTKEZÉS" ALL CAPS Barlow Condensed 600, 6pt sarok, 50pt magas

3. Fókuszált állapot bemutatása:
   Az e-mail mező legyen fókuszban – cián keret + 3pt-os halvány cián gyűrű körülötte.

4. Legalul, a safe area fölött:
   "Csak belső felhasználóknak" 13pt DM Sans, halvány színnel, középre.

HÁTTÉR
#050B14 a halvány cián pont-ráccsal, plusz két nagyon halvány radiális folt:
egy cián a bal felső sarok fölött, egy narancs a jobb alsó sarok alatt.

VARIÁNS – készítsd el mellé a hibaállapotot is:
Ugyanez a képernyő, de a jelszó mező kerete #FF4757, alatta 13pt hibaüzenet
ugyanezen a színen: "Hibás e-mail vagy jelszó." A gomb felirata "BELÉPÉS..."
és letiltott állapotú (60% opacitás).
```

---

# P2 · Ma (kezdőképernyő)

> A P0 után **ezt futtasd másodiknak** – ez feszíti meg legjobban a StatTile rendszert.

```
[[DS-BLOKK]]

KÉPERNYŐ: "Ma" – az app kezdőképernyője, az 5 tab közül az első.
Célja: az edző 3 másodperc alatt lássa, hol áll a csapat.

FELÉPÍTÉS fentről lefelé:

1. NAV BAR (44pt + safe area inset)
   – Bal oldalt "ASE" Barlow Condensed 700, 17pt
   – Középen szűrő-pill: "2025/2026 · ASE ▾" – #0F1F3D alap, aktív keret,
     6pt sarok, 32pt magas, 13pt szöveg. Ez egy koppintható elem.
   – Jobb oldalt fogaskerék ikon 22pt, halvány színnel

2. NAGY CÍM: "MA" Barlow Condensed 600, 28pt, 16pt oldalmargóval

3. KÖVETKEZŐ MECCS KÁRTYA (hero elem, teljes szélesség mínusz 32pt margó)
   #0A1628 alap, 14pt sarok, bal oldalán 3pt NARANCS sín, halvány narancs glow.
   Tartalom:
   – Felül "KÖVETKEZŐ MECCS" 11pt ALL CAPS halványan, jobb oldalt "HAZAI" cián badge
   – Középen nagyban: "ASE" vs "Falco-Vulcano Szombathely"
     Barlow Condensed 600, 22pt, közte kisebb "VS" halványan
   – Alatta dátum és helyszín 13pt DM Sans halványan:
     "2026. szeptember 6. · szombat 18:00 · Paks, Városi Sportcsarnok"
   – Legalul visszaszámláló JetBrains Mono 20pt cián színnel: "7 NAP 04:12"

4. STATTILE RÁCS – 2 oszlop, 4 darab, 12pt réssel
   Mindegyik 96pt magas, bal 3pt accent sín, 11pt ALL CAPS címke, 28pt mono érték:
   – "PONTÁTLAG"    82.4   cián sín,   zöld trend-pill ▲ 3.1
   – "KAPOTT PONT"  76.8   narancs sín, zöld trend-pill ▼ 2.4
   – "LEPATTANÓ"    38.6   zöld sín,   szürke trend-pill ▬ 0.2
   – "ELDOBOTT"     12.1   lila sín,   piros trend-pill ▲ 1.8

5. FORMA SZEKCIÓ
   – "FORMA · UTOLSÓ 5" 11pt ALL CAPS címke
   – Alatta öt darab 6×20pt függőleges pálcika, 4pt réssel:
     zöld-zöld-piros-zöld-zöld (nyert/vesztett), a zöldeken halvány glow
   – Mellette jobbra "3GY - 2V" JetBrains Mono 20pt

6. UTOLSÓ EREDMÉNY KÁRTYA
   #0A1628 alap, 10pt sarok, bal 3pt ZÖLD sín.
   – "LEGUTÓBB" 11pt ALL CAPS halványan, jobbra "NYERT" zöld badge
   – "ASE — Szolnoki Olajbányász" 17pt Barlow Condensed
   – Nagy eredmény: "88 : 74" JetBrains Mono 34pt, a nyertes oldal cián színnel
   – Alul "2026. augusztus 24." 13pt halványan, jobbra "Részletek ›" cián 13pt

7. TAB BAR (49pt + home indicator)
   Öt elem: Ma · Játékosok · Meccsek · Tabella · Elemzés
   Ikonok vékony vonalas stílusban, 24pt. Címkék 11pt.
   A "Ma" AKTÍV: cián ikon + cián címke + fölötte 24×3pt cián indikátor csík.
   A többi halvány színű. Az "Elemzés" ikon legyen csillag/szikra alakú.

HÁTTÉR: #050B14 halvány cián pont-ráccsal.
```

---

# P3 · Szezon és csapat szűrő (bottom sheet)

```
[[DS-BLOKK]]

KÉPERNYŐ: Globális szűrő – bottom sheet, ami a nav bar szűrő-pilljére koppintva nyílik.

FELÉPÍTÉS:
Mutasd a "Ma" képernyőt elhalványítva a háttérben (60% sötét fátyol),
előtte alulról felcsúszó sheet, a képernyő kb. 60%-át elfoglalva.

SHEET:
– #0F1F3D alap, felső két sarok 14pt lekerekítve, felül aktív színű 1pt keret
– Legfelül 36×4pt húzó-fogantyú, halvány színnel, középre
– Cím: "SZŰRŐ" 11pt ALL CAPS halványan, mellette jobbra "Kész" cián 15pt

1. SZEZON szekció
   – "SZEZON" 11pt ALL CAPS címke
   – Alatta négy sor, mindegyik 48pt magas, egymás alatt finom elválasztóval:
     "2026/2027"  ·  "2025/2026"  ·  "2024/2025"  ·  "2023/2024"
     JetBrains Mono 15pt.
   – A "2025/2026" AKTÍV: cián szöveg + jobb oldalt cián pipa ikon
     + a sor bal szélén 2pt cián sín + kissé világosabb háttér (#162440)

2. Elválasztó (finom, két végén elhalványuló vonal)

3. CSAPAT szekció
   – "CSAPAT" 11pt ALL CAPS címke
   – Három sor: "ASE"  ·  "ASE U20"  ·  "ASE Akadémia"
     DM Sans 600, 15pt. Az "ASE" aktív, ugyanazzal a jelöléssel.

4. Legalul, a home indicator fölött:
   13pt halvány szöveg: "A választás megjegyződik a következő indításig."

ÁLLAPOT
A sheet mögötti "Ma" képernyő legyen felismerhető, de erősen elhalványítva.
```

---

# P4 · Játékosok lista

```
[[DS-BLOKK]]

KÉPERNYŐ: Játékosok – a második tab. Aggregált szezonstatisztikák listája.

FELÉPÍTÉS:

1. NAV BAR: bal "ASE", közép szűrő-pill "2025/2026 · ASE ▾", jobb fogaskerék
2. NAGY CÍM: "JÁTÉKOSOK" Barlow Condensed 600, 28pt
   Mellette jobbra halványan "14 fő" JetBrains Mono 15pt

3. KERESŐ MEZŐ
   #0A1628 alap, aktív keret, 4pt sarok, 44pt magas, bal oldalt nagyító ikon,
   placeholder halványan: "Játékos keresése"

4. RENDEZÉS CHIP-SOR (vízszintesen görgethető, 12pt rés)
   Öt chip: "PONT" · "LEPATTANÓ" · "ASSZISZT" · "PERC" · "HATÉKONYSÁG"
   Mindegyik: 32pt magas, 6pt sarok, ALL CAPS 11pt.
   A "PONT" AKTÍV: cián 14% háttér + cián 30% keret + cián szöveg + lefelé nyíl ikon.
   A többi: #0F1F3D háttér, másodlagos szöveg.

5. JÁTÉKOSLISTA – StackedRow minta, nyolc sor
   Minden sor 68pt magas, #0A1628 alap, 10pt sarok, 8pt függőleges rés.
   Felépítés balról jobbra:
   – 32pt kör: #162440 alap, aktív keret, benne a mezszám Barlow Condensed 600, 13pt
   – Név DM Sans 600, 15pt, #E8F4FF
     alatta poszt 13pt halványan
   – Jobb oldalt három monospace szám 20pt, fölöttük 11pt ALL CAPS fejléc:
     PPG / RPG / APG (a fejléc csak az ELSŐ sor fölött jelenjen meg, oszlopfejlécként)

   Adatok:
     12  Kovács Péter      Bedobó hátvéd     18.4  4.2  3.1
      7  Nagy Bence        Irányító           12.1  2.8  6.4
     23  Szabó Márton      Bedobó szélső      14.7  5.9  2.2
      9  Tóth Ádám         Center              9.8  8.4  1.1
     15  Varga Dániel      Erőcsatár          11.2  6.7  1.8
      4  Horváth Levente   Irányító            7.4  1.9  4.2
     33  Balogh Gergő      Center              8.1  7.2  0.9
     21  Molnár Zsolt      Bedobó szélső       6.3  2.4  1.5

   A "Kovács Péter" sor legyen NYOMOTT állapotban: #0F1F3D háttér
   + 2pt cián bal sín.

6. TAB BAR – a "Játékosok" aktív (cián ikon, címke, felső indikátor csík)

FONTOS
Semmi vízszintes görgetés a listában. A számok tökéletesen oszlopba igazodnak
(tabuláris monospace). A sorok legalább 44pt magasak.
```

---

# P5 · Játékos részletek

```
[[DS-BLOKK]]

KÉPERNYŐ: Játékos részletek – a Játékosok listából megnyitva.

FELÉPÍTÉS:

1. NAV BAR: bal oldalt "‹ Játékosok" cián 15pt, jobb oldalt megosztás ikon

2. JÁTÉKOS FEJLÉC KÁRTYA
   #0A1628 alap, 14pt sarok, bal 3pt cián sín, halvány cián glow.
   – Bal oldalt 56pt kör: #162440 alap, aktív keret, benne "12"
     Barlow Condensed 700, 22pt cián színnel
   – Mellette: "KOVÁCS PÉTER" Barlow Condensed 600, 22pt
     alatta "Bedobó hátvéd · 194 cm · 1999" 13pt DM Sans halványan
   – Jobb felül "AKTÍV" zöld badge

3. SZEGMENTÁLT KONTROLL (teljes szélesség, 36pt magas, #0A1628 alap, 6pt sarok)
   Négy szegmens: "ÁTTEKINTÉS" · "MECCSEK" · "TREND" · "AI"
   Barlow Condensed 600, 11pt ALL CAPS.
   Az "ÁTTEKINTÉS" aktív: #162440 háttér + cián szöveg + alul 2pt cián csík.
   Az "AI" szegmens szövege legyen halvány LILA árnyalatú (#C4B5FD).

4. STATTILE RÁCS – 2 oszlop, 6 darab (a szegmentált kontroll alatt)
   – "PONT/MECCS"   18.4  cián sín,  zöld trend ▲ 2.1
   – "LEPATTANÓ"     4.2  zöld sín
   – "ASSZISZT"      3.1  narancs sín
   – "PERC"         28.6  cián sín
   – "TS%"          58.4  lila sín
   – "HATÉKONYSÁG"  16.8  zöld sín,  piros trend ▼ 0.7

5. DOBÓSZÁZALÉKOK szekció
   – "DOBÓTELJESÍTMÉNY" 11pt ALL CAPS címke
   – Három sor, mindegyikben: bal oldalt címke 13pt, középen bar-track
     (6pt magas pill, #162440 alap, cián gradiens kitöltés), jobbra mono érték:
     "MEZŐNY"       48%-ig kitöltve   "48.2%"
     "HÁRMAS"       36%-ig kitöltve   "36.4%"
     "BÜNTETŐ"      81%-ig kitöltve   "81.0%"

6. UTOLSÓ MECCSEK szekció
   – "UTOLSÓ 5 MECCS" 11pt ALL CAPS címke, jobbra "Összes ›" cián 13pt
   – Öt kompakt sor, mindegyik 52pt: bal oldalt ellenfél neve 15pt + dátum 13pt
     halványan, jobbra nagy mono pontszám 20pt, mellette zöld/piros
     NYERT/VESZTETT badge:
       Szolnoki Olajbányász  08.24   22   NYERT
       Alba Fehérvár         08.19   14   NYERT
       Egis Körmend          08.15   19   VESZTETT
       Kaposvári KK          08.11   24   NYERT
       DEAC                  08.07    9   VESZTETT

7. TAB BAR – "Játékosok" aktív
```

---

# P6 · Játékos összehasonlítás

```
[[DS-BLOKK]]

KÉPERNYŐ: Két játékos összehasonlítása, akár különböző szezonokból.

FELÉPÍTÉS:

1. NAV BAR: bal "‹ Vissza", cím középen "ÖSSZEHASONLÍTÁS" 17pt ALL CAPS

2. KÉT JÁTÉKOS FEJLÉC – egymás mellett, 50-50%, 12pt réssel
   Mindkettő: #0A1628 alap, 10pt sarok, 44pt kör mezszámmal, alatta név
   Barlow Condensed 600, 15pt, alatta szezon 11pt mono halványan.
   – Bal: 12 · Kovács Péter · 2025/2026 – bal 3pt CIÁN sín
   – Jobb: 23 · Szabó Márton · 2025/2026 – bal 3pt NARANCS sín
   Mindkettő alján koppintható "Csere ▾" 13pt cián felirat.

3. SZEMBEN ÁLLÓ BAR-OK – ez a képernyő lényege
   Hét sor, mindegyik így épül fel:
   – Középen a metrika neve 11pt ALL CAPS halványan
   – Alatta egy sor: BAL oldalt a cián érték monospace 20pt, jobbra igazítva;
     KÖZÉPEN két, egymással szemben növő vízszintes bar (bal cián, jobb narancs),
     közös középvonalról indulva; JOBB oldalt a narancs érték monospace 20pt.
   – A nagyobb érték bar-ja hosszabb és glow-t kap.

   Adatok (bal / jobb):
     PONT/MECCS        18.4  /  14.7
     LEPATTANÓ          4.2  /   5.9
     ASSZISZT           3.1  /   2.2
     PERC              28.6  /  26.1
     MEZŐNY %          48.2  /  51.4
     HÁRMAS %          36.4  /  33.8
     HATÉKONYSÁG       16.8  /  15.2

4. ÖSSZEGZŐ SÁV legalul a lista után
   #0F1F3D alap, 10pt sarok: "5 / 7 METRIKÁBAN VEZET" 11pt ALL CAPS halványan,
   mellette "KOVÁCS PÉTER" cián színnel 15pt.

FONTOS
A két oldal színkódja végig következetes: bal = cián, jobb = narancs.
Minden szám monospace, tabulárisan igazítva.
```

---

# P7 · Meccsek lista

```
[[DS-BLOKK]]

KÉPERNYŐ: Meccsek – a harmadik tab. Közelgő és lejátszott mérkőzések.

FELÉPÍTÉS:

1. NAV BAR: bal "ASE", közép szűrő-pill, jobb fogaskerék
2. NAGY CÍM: "MECCSEK" Barlow Condensed 600, 28pt

3. SZEGMENTÁLT KONTROLL (teljes szélesség, 36pt, #0A1628 alap, 6pt sarok)
   Két szegmens: "KÖVETKEZŐ" · "LEJÁTSZOTT"
   A "LEJÁTSZOTT" AKTÍV: #162440 háttér, cián szöveg, alul 2pt cián csík.

4. HÓNAP ELVÁLASZTÓ
   "2026. AUGUSZTUS" 11pt ALL CAPS halványan, mellette jobbra finom,
   elhalványuló vonal a képernyő széléig.

5. MECCSLISTA – hat kártya, mindegyik 76pt magas, #0A1628 alap, 10pt sarok,
   8pt függőleges rés. Felépítés:
   – Bal szélén 3pt sín: ZÖLD ha nyert, PIROS ha vesztett
   – Bal oldalt: ellenfél neve DM Sans 600, 15pt
     alatta 13pt halványan: dátum + "Hazai" vagy "Idegenbeli"
   – Jobb oldalt: eredmény JetBrains Mono 22pt ("88 : 74"), a saját pontszám
     kiemelve (#E8F4FF), az ellenfélé halványabb
     alatta NYERT (zöld) vagy VESZTETT (piros) badge

   Adatok:
     Szolnoki Olajbányász   08.24 · Hazai        88 : 74   NYERT
     Alba Fehérvár          08.19 · Idegenbeli   79 : 71   NYERT
     Egis Körmend           08.15 · Idegenbeli   68 : 82   VESZTETT
     Kaposvári KK           08.11 · Hazai        94 : 77   NYERT
     DEAC                   08.07 · Idegenbeli   71 : 78   VESZTETT
     Sopron KC              08.02 · Hazai        85 : 69   NYERT

   Az első kártya legyen NYOMOTT állapotban: #0F1F3D háttér.

6. TAB BAR – "Meccsek" aktív

VARIÁNS – készítsd el mellé a "KÖVETKEZŐ" szegmenst is:
Ugyanez a képernyő, de a lista közelgő meccseket mutat: nincs eredmény,
helyette jobb oldalt az időpont JetBrains Mono 20pt cián színnel ("18:00"),
alatta a hátralévő idő 13pt halványan ("7 nap"). A bal sín NARANCS.
Az első elem kapjon "KÖVETKEZŐ" narancs badge-et.
```

---

# P8 · Meccs részletek – box score

> A P0 után **ezt futtasd harmadiknak** – ez feszíti meg legjobban a táblázat-rendszert.

```
[[DS-BLOKK]]

KÉPERNYŐ: Egy mérkőzés részletei, box score-ral. Ez az app legsűrűbb adatképernyője.

FELÉPÍTÉS:

1. NAV BAR: bal "‹ Meccsek", jobb megosztás ikon

2. EREDMÉNY HERO
   #0A1628 alap, 14pt sarok, bal 3pt ZÖLD sín, halvány zöld glow.
   – Felül "2026. AUGUSZTUS 24. · HAZAI" 11pt ALL CAPS halványan,
     jobbra "NYERT" zöld badge
   – Középen két csapatnév egymással szemben, Barlow Condensed 600, 17pt:
     bal "ASE", jobb "Szolnoki Olajbányász"
   – Közöttük nagyban az eredmény: "88 : 74" JetBrains Mono 40pt,
     a 88 cián színnel, a 74 másodlagos színnel
   – Alul negyedbontás, öt oszlopban, monospace 15pt,
     fölöttük 11pt ALL CAPS fejléc:
       N1   N2   N3   N4
       24   18   22   24
       19   21   16   18
     A nyertes negyedek számai zöld színnel.

3. SZEGMENTÁLT KONTROLL
   Négy szegmens: "BOX SCORE" · "GRAFIKONOK" · "AI RIPORT" · "ELLENFÉL"
   A "BOX SCORE" aktív. Az "AI RIPORT" szövege halvány lila (#C4B5FD).

4. STATMATRIX – ez a képernyő magja
   Fagyasztott bal oszlop + vízszintesen görgethető statoszlopok.

   FAGYASZTOTT OSZLOP (108pt széles, #0A1628 alap, jobb szélén 1pt aktív
   színű elválasztó vonal + finom gradiens árnyék a görgethetőség jelzésére):
     fejléc: "JÁTÉKOS" 11pt ALL CAPS halványan
     sorok: mezszám halványan + vezetéknév + kezdőbetű, DM Sans 15pt
       12 Kovács P.
        7 Nagy B.
       23 Szabó M.
        9 Tóth Á.
       15 Varga D.
        4 Horváth L.
       33 Balogh G.

   GÖRGETHETŐ RÉSZ (#050B14 alap), oszlopok 11pt ALL CAPS fejléccel,
   cellák JetBrains Mono 15pt, jobbra igazítva, tabulárisan:
     PERC    PT   2P     3P     BÜ     LP   AS   LB   ELD  +/-
     32:14   22   6/11   2/5    4/4     5    3    2    1   +14
     28:02   11   3/7    1/4    2/2     3    8    1    2    +9
     30:45   19   7/12   1/3    2/3     7    2    0    3   +11
     24:18   12   5/8    0/0    2/4     9    1    3    2    +6
     26:33   14   4/9    2/4    0/0     6    2    1    1    +8
     18:22    6   2/5    0/2    2/2     2    4    0    1    -2
     14:46    4   2/3    0/0    0/1     4    0    1    0    +3

   A "+/-" oszlopban a pozitív értékek ZÖLDEK, a negatívak PIROSAK.
   A csapat legjobb pontszerzőjének (Kovács P., 22) sora kapjon finom
   kiemelést: #0F1F3D háttér + 2pt cián bal sín.

   ÖSSZESEN sor legalul, felül aktív színű elválasztóval, félkövéren:
     "ÖSSZESEN"  174:60  88  29/55  6/18  12/16  36  20  8  10

5. TAB BAR – "Meccsek" aktív

FONTOS
A vízszintes görgethetőséget egyértelműen jelezni kell: a jobb szélen
a tartalom "elvágva" folytatódik, a fagyasztott oszlop szélén árnyék.
A számok TÖKÉLETESEN oszlopba igazodnak – ez a képernyő hitelességének kulcsa.
```

---

# P9 · Meccs részletek – vizualizációk

```
[[DS-BLOKK]]

KÉPERNYŐ: Ugyanaz a mérkőzés, a "GRAFIKONOK" szegmens kiválasztva.
Három vizualizáció egymás alatt, görgethetően.

FELÉPÍTÉS:

1. NAV BAR: "‹ Meccsek"
2. Kompakt eredmény-fejléc (a P8 hero-jának alacsonyabb változata, 64pt):
   "ASE 88 : 74 Szolnoki Olajbányász" egy sorban, mono az eredmény
3. SZEGMENTÁLT KONTROLL – a "GRAFIKONOK" aktív

4. DOBÁSTÉRKÉP KÁRTYA
   #0A1628 alap, 14pt sarok, 16pt padding.
   – "DOBÁSTÉRKÉP" 11pt ALL CAPS címke, jobbra "48.2% MEZŐNY" mono 13pt
   – Alatta fél kosárlabdapálya rajza felülnézetből, VÉKONY VONALAS stílusban,
     aktív színű (#1E3A5F) vonalakkal: alapvonal, hárompontos ív, büntetődobó
     körzet, palánk. A pálya #050B14 alapon.
   – A pályán dobáspontok: kb. 30 darab.
     Betalált dobás = tömör ZÖLD (#10D98A) 7pt kör, halvány glow-val
     Kihagyott dobás = üres PIROS (#FF4757) 7pt kör, csak kerettel
     Eloszlás: sok a palánk alatt, néhány középtávon, egy csoport a hárompontos ív mögött.
   – Alul jelmagyarázat 11pt: zöld kör "BETALÁLT 29" · piros kör "KIHAGYOTT 26"

5. MOMENTUM GÖRBE KÁRTYA
   – "PONTKÜLÖNBSÉG ALAKULÁSA" 11pt ALL CAPS címke
   – Vonaldiagram: vízszintes tengely a játékidő (0–40 perc), függőleges a
     kumulatív pontkülönbség (-10 ... +20).
   – A nulla-vonal halvány vízszintes vonal.
   – A görbe CIÁN, 2pt vastag, a nulla fölötti része alatt halvány cián
     gradiens kitöltés; a nulla alatti rész PIROS.
   – A negyedhatároknál (10, 20, 30 perc) függőleges szaggatott halvány vonalak,
     alattuk "N1 N2 N3 N4" 11pt címkék.
   – A görbe induljon 0-ról, menjen -6-ig a 8. percnél, majd emelkedjen
     folyamatosan +14-ig a végén.

6. FOUR FACTORS KÁRTYA
   – "FOUR FACTORS" 11pt ALL CAPS címke
   – Négy metrika, mindegyiknél két egymás melletti vízszintes bar
     (felül CIÁN = ASE, alatta NARANCS = ellenfél), balról növekedve.
     Bal oldalt a metrika neve 11pt ALL CAPS, jobb oldalt mindkét érték mono 15pt.
       eFG%      54.5  /  47.2
       TOV%      12.1  /  16.8
       ORB%      31.4  /  24.6
       FT RATE   29.1  /  22.3
   – A jobb érték minden sorban glow-t kap.

7. TAB BAR – "Meccsek" aktív

STÍLUS
Minden grafikon a design rendszer színeiben, vékony vonalakkal, sűrűn.
Semmi 3D, semmi árnyék, semmi gradiens a vonalakon kívül.
Műszerfal-esztétika, nem infografika.
```

---

# P10 · AI riport olvasó

```
[[DS-BLOKK]]

KÉPERNYŐ: Egy AI-generált elemzés olvasónézete. Ez az app egyetlen
"hosszú szöveg" képernyője – a tipográfia itt a főszereplő.

FELÉPÍTÉS:

1. NAV BAR: bal "‹ Elemzés", jobb oldalt megosztás + szöveg-méret ikon

2. RIPORT FEJLÉC
   – "AI ELEMZÉS" LILA badge (16% lila háttér, 40% lila keret, #C4B5FD szöveg),
     mellette "POSTGAME" semleges badge
   – Alatta cím: "ASE — SZOLNOKI OLAJBÁNYÁSZ" Barlow Condensed 600, 22pt
   – Alatta meta sor 13pt halványan:
     "2026. augusztus 24. · Generálva: augusztus 25. 09:14"
   – Ha a riport elavult lenne, itt állna egy "ELAVULT" sárga badge –
     ezt MOST NE tedd bele, de a variánsban igen.

3. AI TARTALOM BLOKK – ez a képernyő lényege
   A teljes szövegtörzs bal szélén egy 2pt függőleges LILA gradiens sáv fut
   (felül és alul elhalványulva), 12pt-tal beljebb tolva a szöveget.
   Ez jelzi, hogy AI generált tartalom.

   A szöveg DM Sans 15pt, 1.6 sorköz, #E8F4FF színnel, bekezdések közt 16pt rés.
   A szövegben előforduló SZÁMOK legyenek JetBrains Mono és cián színűek.
   Szekciócímek: Barlow Condensed 600, 17pt, felettük 24pt rés.

   Tartalom (magyar kosárlabda-elemző hangnem):

   "ÖSSZKÉP"
   Az ASE magabiztos, 88:74 arányú győzelmet aratott a Szolnok ellen. A meccs
   fordulópontja a második negyed közepén jött, amikor a hazai csapat 14:2-es
   rohanással fordította meg az addig szoros mérkőzést. A 48.2%-os mezőnyteljesítmény
   és a 36 lepattanó együtt biztosította a kontrollt.

   "TÁMADÓJÁTÉK"
   A 20 gólpassz jelzi, hogy a labda mozgott – ez az elmúlt öt meccs legjobb értéke.
   Kovács Péter 22 pontja mellett Szabó Márton 19 pontja adta a gerincet, de a
   pontszerzés kellően megoszlott: öt játékos ért el kétszámjegyű teljesítményt.

   "VÉDEKEZÉS"
   A 74 kapott pont a szezonátlag alatt van. A 8 labdaszerzés és a 10 blokk
   mutatja, hogy az agresszív, ki-be segítő védekezés működött, bár a 16 eladott
   labda továbbra is javítandó terület.

   "AMIRE FIGYELNI KELL"
   A büntetődobás-arány (12/16, 75%) elmarad a szezonátlagtól. Szoros meccsen
   ez a különbség dönthet.

4. LÁBLÉC
   Finom elválasztó vonal, alatta 13pt halvány szöveg:
   "Generálta: Claude · A riport a mérkőzés statisztikái alapján készült."
   Mellette lila szikra ikon.

5. Nincs tab bar – ez egy teljes képernyős olvasónézet.

VARIÁNS – készítsd el mellé az "ELAVULT" állapotot is:
Ugyanez, de a fejlécben egy "ELAVULT" SÁRGA badge, alatta egy figyelmeztető sáv:
#0A1628 alap, bal 3pt sárga sín, 13pt szöveg:
"A riport generálása óta új mérkőzés került az adatbázisba."
```

---

# P11 · Tabella

```
[[DS-BLOKK]]

KÉPERNYŐ: Tabella – a negyedik tab. A bajnokság állása.

FELÉPÍTÉS:

1. NAV BAR: bal "ASE", közép szűrő-pill, jobb fogaskerék
2. NAGY CÍM: "TABELLA" Barlow Condensed 600, 28pt
   alatta "NB I/A · 2025/2026" 11pt ALL CAPS halványan

3. OSZLOPFEJLÉC SOR (nem görgethető, 11pt ALL CAPS, halvány színnel)
   Balról: "#" · "CSAPAT" · jobbra: "M" · "GY" · "V" · "+/-" · "P"

4. TABELLA SOROK – tíz sor, mindegyik 56pt magas, egymás alatt finom
   elválasztóval, NEM külön kártyák (ez egy sűrű lista).
   Felépítés:
   – Bal szélén a helyezés JetBrains Mono 15pt, 28pt széles oszlopban.
     Az első három hely száma CIÁN, a többi halvány.
   – Mellette 26pt csapat-jelvény: lekerekített négyzet (4pt sarok),
     #162440 alap, benne a csapat 2-3 betűs rövidítése Barlow Condensed 700, 11pt
   – Csapatnév DM Sans 15pt
   – Jobb oldalt öt monospace oszlop: M / GY / V / +/- / P
     A "+/-" pozitív értékei ZÖLDEK, negatívjai PIROSAK.
     A "P" oszlop félkövér, #E8F4FF.

   Adatok (# · rövidítés · név · M · GY · V · +/- · P):
     1  FAL  Falco-Vulcano Szombathely   18  15  3  +142  33
     2  SZO  Szolnoki Olajbányász        18  14  4   +98  32
     3  ASE  ASE                         18  12  6   +64  30
     4  ALB  Alba Fehérvár               18  11  7   +41  29
     5  KOR  Egis Körmend                18  10  8   +12  28
     6  SOP  Sopron KC                   18   9  9    -4  27
     7  KAP  Kaposvári KK                18   8 10   -22  26
     8  DEA  DEAC                        18   7 11   -48  25
     9  ZTE  Zalakerámia ZTE             18   5 13   -87  23
    10  PVS  PVSK                        18   3 15  -136  21

   AZ "ASE" SOR KIEMELVE: #0F1F3D háttér + 2pt CIÁN bal sín
   + a csapatnév cián színnel + a jelvény cián kerettel és halvány cián glow-val.

5. LÁBLÉC
   Finom elválasztó, alatta 13pt halványan: "Frissítve: 2026. augusztus 25."

6. TAB BAR – "Tabella" aktív

FONTOS
Sűrű, kompakt lista – ez táblázat, nem kártyagyűjtemény.
Minden szám tabulárisan igazodik. Nincs vízszintes görgetés: az öt számoszlop
elfér 390pt-on, ha a csapatnév szükség esetén elliptálódik.
```

---

# P12 · Elemzés hub

```
[[DS-BLOKK]]

KÉPERNYŐ: Elemzés – az ötödik tab. Az AI riportok és a számított elemzések belépője.

FELÉPÍTÉS:

1. NAV BAR: bal "ASE", közép szűrő-pill, jobb fogaskerék
2. NAGY CÍM: "ELEMZÉS" Barlow Condensed 600, 28pt

3. SZÁMÍTOTT ELEMZÉSEK szekció
   – "SZÁMÍTOTT ELEMZÉSEK" 11pt ALL CAPS címke
   – Három navigációs sor, mindegyik 60pt magas, #0A1628 alap, 10pt sarok,
     8pt réssel. Felépítés: bal oldalt 22pt vonalas ikon accent színben,
     mellette cím DM Sans 600, 15pt és alatta leírás 13pt halványan,
     jobb szélén "›" chevron halványan.
       [célkereszt ikon, cián]  Szituációk
                                Hazai/vendég, nyert/vesztett bontás
       [pajzs ikon, narancs]    Ellenfél scouting
                                A következő ellenfél erősségei és gyengéi
       [emberek ikon, zöld]     Szerepkör-elemzés
                                Ki mit tesz hozzá a csapatjátékhoz

4. AI RIPORTOK szekció
   – "AI RIPORTOK" 11pt ALL CAPS címke, mellette jobbra lila szikra ikon
   – Négy riport-kártya, mindegyik 88pt magas, #0A1628 alap, 10pt sarok,
     BAL 3pt LILA sín, 8pt réssel. Felépítés:
     – Felül egy sorban: típus-badge + dátum 13pt halványan jobbra igazítva
     – Alatta cím DM Sans 600, 15pt
     – Alatta a riport első mondata, 13pt halványan, EGY sorra vágva "…"-tal

     Kártyák:
       [POSTGAME lila badge]              augusztus 25.
       ASE — Szolnoki Olajbányász
       Az ASE magabiztos, 88:74 arányú győzelmet aratott…

       [PREGAME lila badge] [ELAVULT sárga badge]   augusztus 22.
       ASE — Falco-Vulcano Szombathely
       A Falco az idény legjobb védekezését hozza Paksra…

       [CSAPAT lila badge]                augusztus 20.
       ASE · 2025/2026 szezonértékelés
       Tizennyolc forduló után az ASE a harmadik helyen áll…

       [JÁTÉKOS lila badge]               augusztus 18.
       Kovács Péter · szezonértékelés
       Kovács Péter a csapat vezéregyénisége lett a szezon…

5. TAB BAR – "Elemzés" aktív.
   FONTOS: az aktív "Elemzés" tab ikonja és címkéje LILA (#C4B5FD), nem cián –
   ez az egyetlen tab, ami AI tónust kap. A felső indikátor csík is lila.

HANGULAT
Ez egy tartalom-hub. Levegősebb, mint a többi képernyő, de ugyanaz a nyelv.
```

---

# P13 · Szituációs elemzés

```
[[DS-BLOKK]]

KÉPERNYŐ: Szituációs elemzés – az Elemzés hubból megnyitva.
Ugyanaz a csapat, különböző körülmények között.

FELÉPÍTÉS:

1. NAV BAR: bal "‹ Elemzés", cím "SZITUÁCIÓK" 17pt ALL CAPS

2. SZEGMENTÁLT KONTROLL
   Két szegmens: "HAZAI / VENDÉG" · "NYERT / VESZTETT"
   A "HAZAI / VENDÉG" aktív.

3. ÖSSZEHASONLÍTÓ FEJLÉC – két oszlop, 50-50%, 12pt réssel
   – Bal: "HAZAI" 11pt ALL CAPS + "9 MECCS" mono 20pt, bal 3pt CIÁN sín
   – Jobb: "VENDÉG" 11pt ALL CAPS + "9 MECCS" mono 20pt, bal 3pt NARANCS sín
   Mindkettő #0A1628 alap, 10pt sarok, 72pt magas.
   A bal alatt "7GY - 2V" zöld színnel, a jobb alatt "5GY - 4V" halványan.

4. METRIKA ÖSSZEHASONLÍTÁS – nyolc sor
   FONTOS: NE használj 3 vagy 4 oszlopos rácsot – ez 390pt-on összeroppanna.
   Helyette minden metrika EGY teljes szélességű sor:
   – Felül a metrika neve 11pt ALL CAPS halványan, középre
   – Alatta egy sor három zónával:
     BAL: cián érték monospace 22pt, balra igazítva
     KÖZÉP: két szemben álló vízszintes bar közös középvonalról
            (bal cián, jobb narancs), 6pt magasak
     JOBB: narancs érték monospace 22pt, jobbra igazítva
   – A jobb érték kap glow-t, ha az a jobb teljesítmény.
   – Sorok között 16pt rés, finom elválasztó vonalakkal.

   Adatok (hazai / vendég):
     SZERZETT PONT      86.2  /  78.4
     KAPOTT PONT        74.1  /  81.6
     PONTKÜLÖNBSÉG     +12.1  /   -3.2
     MEZŐNY %           49.8  /  45.1
     HÁRMAS %           37.2  /  32.4
     LEPATTANÓ          40.1  /  36.8
     ASSZISZT           19.4  /  16.2
     ELADOTT LABDA      11.2  /  14.6

5. ÖSSZEGZŐ KÁRTYA legalul
   #0A1628 alap, 10pt sarok, bal 3pt CIÁN sín:
   – "MEGÁLLAPÍTÁS" 11pt ALL CAPS halványan
   – "Hazai pályán 15.3 ponttal jobb a pontkülönbség. A különbség fő forrása
      a védekezés: idegenben 7.5 ponttal többet kap a csapat."
     DM Sans 15pt, 1.5 sorköz. A számok monospace és ciánok.

6. TAB BAR – "Elemzés" aktív (lila)
```

---

# P14 · Rendszerállapotok

```
[[DS-BLOKK]]

FELADAT: Készíts EGY felületet, amin NÉGY iPhone keret áll egymás mellett,
mindegyik ugyanannak a "Játékosok" képernyőnek egy-egy állapotát mutatja.
A keretek fölött 11pt ALL CAPS címke jelzi, melyik állapot.

KERET 1 – "BETÖLTÉS"
  Nav bar és nagy cím ("JÁTÉKOSOK") normálisan látszik.
  A tartalom helyén nyolc skeleton-blokk: #0A1628 alap, 10pt sarok,
  68pt magasak, 8pt réssel. Mindegyiken egy finom, balról jobbra haladó,
  világosabb (#0F1F3D) fénycsík fut át – shimmer effekt.
  A skeleton-sorokon belül halványan érzékelhető a szerkezet:
  bal oldalt egy 32pt kör, mellette két különböző hosszúságú sáv.

KERET 2 – "ÜRES"
  Nav bar és nagy cím normálisan.
  Középen függőlegesen centrálva:
  – 48pt vonalas ikon (áthúzott emberek), halvány színnel (#4A6D95)
  – Alatta "NINCS ADAT" Barlow Condensed 600, 17pt, másodlagos színnel
  – Alatta 15pt DM Sans halványan, két sorban középre:
    "Ehhez a szezonhoz és csapathoz még nincsenek játékos-statisztikák."
  – Alatta 24pt réssel másodlagos gomb: "SZŰRŐ MÓDOSÍTÁSA"
    (#0F1F3D alap, aktív keret, ALL CAPS, 44pt magas)

KERET 3 – "HIBA"
  Nav bar és nagy cím normálisan.
  Középen:
  – 48pt vonalas figyelmeztető háromszög ikon, PIROS (#FF4757) színnel,
    halvány piros glow-val
  – Alatta "BETÖLTÉSI HIBA" Barlow Condensed 600, 17pt, piros színnel
  – Alatta 15pt DM Sans halványan:
    "Nem sikerült elérni az adatbázist."
  – Alatta monospace 13pt, nagyon halványan: "PGRST_TIMEOUT"
  – Alatta 24pt réssel elsődleges gomb: "ÚJRAPRÓBÁLKOZÁS"
    (tömör cián, #050B14 szöveg, 44pt magas)

KERET 4 – "OFFLINE"
  A képernyő normálisan tele van adattal (a P4 játékoslistája),
  DE közvetlenül a nav bar alatt egy teljes szélességű figyelmeztető sáv:
  – 32pt magas, #0A1628 alap, alul-felül aktív színű vonal,
    bal 3pt SÁRGA (#FFB627) sín
  – Bal oldalt 14pt áthúzott felhő ikon sárgán,
    mellette 13pt szöveg: "Nincs internetkapcsolat · Mentett adat"
  A lista alatta enyhén tompított (85% opacitás), jelezve hogy nem friss.

STÍLUS
Mind a négy keret ugyanabban a design nyelvben. A hibaállapot se legyen
riasztó vagy játékos – ugyanaz a mértéktartó, műszerfal-szerű hangnem.
```

---

## Lefedettség-ellenőrzés

| Web fogyasztói nézet | Komponens | Lefedő prompt |
|---|---|---|
| `overview` | `TeamStatistics`, `TeamComparison` | **P2** |
| `players` – lista | `PlayersList` | **P4** |
| `players` – részletek | `PlayerDetails`, `PlayerTrends` | **P5** |
| `players` – összehasonlítás | `PlayerComparison` | **P6** |
| `games` | `GamesList` | **P7** |
| `gamelog` | `GameLog` | **P7** (Lejátszott szegmens) |
| `games` – meccs részletek | `GameDetails` | **P8** |
| `games` – vizualizációk | `PostgameShotScatterChart`, `PostgameZoneHeatmapChart`, `GamePbpCharts` | **P9** |
| `standings` | `StandingsView` | **P11** |
| `comparison` – AI riportok | `SeasonComparison` (részhalmaz) | **P10**, **P12** |
| `situational` | `SituationalAnalysis` | **P13** |
| `updates` | `Updates` | **P3** (beállítás-sheet) |
| — bejelentkezés | `LoginForm` | **P1** |
| — globális szűrők | `SeasonSelector`, `TeamSelector` | **P3** |
| — rendszerállapotok | skeleton / hiba / üres | **P14** |
| — design nyelv | `stat-card.tsx`, `data-table.tsx`, `globals.css` | **P0** |

Mind a 8 fogyasztói nézet lefedve, plusz a bejelentkezés, a szűrők, a rendszerállapotok és a design system katalógus.

---

## Mit kell nézni a kimeneteken

Az eredmények elfogadásakor ezekre figyelj – ezek a leggyakoribb csúszások:

1. **Túl kerek sarkok.** Az AI eszközök hajlamosak 16–24pt-os iOS-es lekerekítést adni. A rendszer 10–14pt-nál nem megy tovább; ha kerekebb, elveszik a telemetria-karakter.
2. **A bal accent sín hiánya.** Ez a legfelismerhetőbb elem – ha lemarad, a kimenet generikus dark app lesz.
3. **Rossz font a számokon.** Minden szám JetBrains Mono. Ha bárhol DM Sans-szal jelenik meg egy statisztika, az hibás.
4. **Nem tabuláris igazítás.** A P8 box score-jában az oszlopoknak tökéletesen kell igazodniuk.
5. **Bevezetett új színek.** Lila-rózsaszín gradiensek, extra kékek – a paletta zárt.
6. **Webes layout.** Ha a kimenet szélesebb, mint egy telefon, vagy hover-állapotokat mutat, újra kell futtatni.
7. **Túl kevés adat.** A képernyők SŰRŰEK. Ha a kimenet levegős és marketinges, elvétette a karaktert.
