# Post-game riport: büntető-címke iránya, ellenfélprofil, box score alapmutatók

- **Dátum:** 2026-10-04
- **Webes commit:** ez a commit
- **Típus:** @core | funkcionális
- **Állapot a mobilban:** ÁTVEZETVE (2026-10-04, mobil commit e3e8c62, @core szinkron 6610ffb; a 3 soros ellenfélprofil rendben tördel, a „Box score alapmutatók” szekció is elkészült, mobil D-126)

## Mi változott
- `lib/postgame-report.ts`:
  - **Döntő tényező címke**: a párharc FT-sora
    `Több / Kevesebb büntetőpont az ellenfélnél (FTM rate …)` helyett
    `Büntető-előny / Büntető-hátrány az ellenféllel szemben (FTM rate …)`.
    A `tone` / `topic` / `type` változatlan.
  - **Összefoglaló „Ellenfél profil” blokk** (`report.summary` szövege):
    új első sor `• <ellenfél> mért mutatói: eFG …, 3P x/y (…%), FTM rate …,
    OREB% …, TO rate ….`; a `védekezési realizáció: kontakt-limitálás (…);
    passzútvonal-zavarás (…)` sor helyett
    `• Saját támadómutatók a <referencia> alatt <ellenfél> ellen: FTM rate …;
    Assist% ….` + külön `• Értelmezés: …` sor. A leíró nélküli ág szövege:
    `<ellenfél> ellen egyik fő saját támadómutatónk sem esett érdemben a
    <referencia> alá.`
  - **Új opcionális mező**: `PostGameReport.metrics.boxScore`
    (`{ own: PostgameBoxScoreLine; opponent: PostgameBoxScoreLine | null }`),
    új exportált típus `PostgameBoxScoreLine` (fgm, fga, fgPct, ftm, fta,
    ftPct, oreb, dreb, reb).
- Webes (nem `@core`): `lib/export-to-md.ts` – „Box score alapmutatók” tábla,
  `(+)` / `(−)` előjel a döntő tényezőknél, lábjegyzet a nem elérhető
  mutatókról (TO-ból / második esélyből / fast breakből szerzett pont).

## Hatás a mobil appra
- A build nem törik (az új mező opcionális, a többi szövegváltozás).
- `npm run sync:core` nélkül a mobil post-game nézet a régi, félreérthető
  büntető-címkét és a régi „védekezési realizáció” sort mutatja – eltér a webtől.
- `lib/postgame-view.ts`: a döntő tényezők a `tone` alapján színeződnek, a
  címkére nincs szöveges illesztés – teendő nincs. Ha a nézet az
  összefoglaló soraira szövegminta alapján szűr („védekezési realizáció”),
  azt igazítani kell.
- A `metrics.boxScore` megjeleníthető (FG%, FT%, lepattanó), de nem kötelező.

## Teendő a mobil repóban
- [x] `npm run sync:core`
- [x] Ellenőrizni, hogy a post-game összefoglaló az új „Ellenfél profil”
      sorokat helyesen tördeli (3 sor a korábbi 1 helyett)
- [x] Opcionális: `metrics.boxScore` megjelenítése a post-game nézetben

## Kézi lépések
nincs (a már mentett riportszövegek nem változnak; új generálás / export kell)
