# Post-game riport: szövegek referenciával, adatvezérelt fókusz, üres blokkok

- **Dátum:** 2026-09-28
- **Webes commit:** ez a commit
- **Típus:** @core | funkcionális
- **Állapot a mobilban:** ÁTVEZETVE (2026-09-28, mobil commit 3a1eea4, @core szinkron fa4ef72; a mobil nem ír saját védekezési mondatot, lineup / trend-blokk nincs)

## Mi változott
- `lib/postgame-report.ts` (`@core`):
  - Eredménymondat: „X győzött Y ellen” / „X vereséget szenvedett Y ellen”
    (a „legyőzte … ellen” / „alulmaradt … ellen” helyett).
  - Új opcionális `report.context.defense: { opponentEfg, leagueEfg } | null`.
    A védekezés viszonyítása mindig a liga medián eFG%; liga benchmark nélkül
    nincs viszonyítás (korábban a saját támadó eFG volt a tartalék, ami
    értelmetlen). A védekezési mondat számokkal: „az ellenfél a liga szintje
    felett dobott (ellenfél eFG 56.7% vs liga medián 53.0%, +3.7 pp)”.
  - A „Végrehajtás stabilizálása…” általános fallback-fókusz megszűnt: a
    referenciához képest leggyengébb mutató célértékes fókusza, ennek
    hiányában a legerősebb megtartása számmal; referencia nélkül ezt jelzi.
  - Ellenfélprofil: a számok mellett a referencia neve; nagy különbségnél a
    limitált terület és a „saját végrehajtás” egy, egymást ki nem záró
    állításban; referencia nélkül nem értékel.
- Webes (nem `@core`): lineup-rangsorok legalább 5 perces együttállásból
  (`LINEUP_MIN_SAMPLE_SECONDS`, nincs visszaesés kis mintára); a clutch blokk
  csak értelmezhető mintánál látszik, clutch szakasz nélkül erről szóló
  megjegyzés; a játékostrend csak ≥ 3 meccsnél; az üres ellenfél-hatás chart
  rejtve; a „Kosarstat only” kapcsoló leírása állapotfüggő.

## Hatás a mobil appra
- A build nem törik (az új mező opcionális).
- Ha a mobil a „legyőzte” / „alulmaradt” szövegre illeszt vagy a
  `defenseEfficiencyDelta`-hoz saját „romlott a hatékonyság” szöveget ír,
  az utóbbi referencia nélküli – a `context.defense` számait érdemes kiírni.
- Ha a mobil saját lineup-rangsort, clutch-blokkot vagy trendet mutat,
  ugyanazok az üres-/kismintás esetek állhatnak fenn.

## Teendő a mobil repóban
- [x] `npm run sync:core`
- [x] Védekezési összefoglaló: `report.context.defense` (ellenfél eFG vs liga
      medián) megjelenítése
- [x] Ha van: lineup-rangsor ≥ 5 perces mintából, clutch blokk csak
      `clutch.available` esetén, trend csak ≥ 3 meccsnél

## Kézi lépések
nincs
