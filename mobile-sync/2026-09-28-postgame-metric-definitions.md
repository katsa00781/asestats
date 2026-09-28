# Post-game riport: metrika-definíciók – közös birtoklás, FTM rate, egy TO%

- **Dátum:** 2026-09-28
- **Webes commit:** ez a commit
- **Típus:** @core | funkcionális
- **Állapot a mobilban:** ÁTVEZETVE (2026-09-28, mobil commit 3a1eea4, @core szinkron fa4ef72; az eszközös próba nyitott)

## Mi változott
- `lib/postgame-report.ts` (felhasználói döntések, 2026-09-28):
  - **Közös birtoklásszám**: meccsen `(saját + ellenfél birtoklás) / 2` – ez a
    `metrics.pace`, a `ratings.possessions`, és mindkét rating nevezője
    (a DRtg = az ellenfél ORtg-je; ASE–Pécs: 102,0 mindkét nézőpontból, a
    korábbi 98,8 / 105,3 helyett). Szezonban új opcionális
    `TeamSeasonStat.oppPossessions` (az ellenfelek szezonos birtoklásösszege);
    megadva a szezon- és liga-benchmark `pace` / `ortg` / `drtg` is közös
    birtoklással számol.
  - **FT-mutató = FTM / FGA mindenhol a riportban** (eddig FTA / FGA). A
    `ftRate` mezők (`NormalizedTeamStats`, `NormalizedGameStats`,
    `metrics.opponent.ftRate`, benchmark `ft_rate`) jelentése változott.
    Címkék: `FT rate` → `FTM rate`, `FT arány` → `FTM arány`; a küszöbök
    FTM-skálára igazítva (~0,75×).
  - **Egy TO-definíció**: Oliver-féle `LV / (FGA + 0,44·FTA + LV)`, címke
    `TO rate (Oliver)`. A Kosarstat TO% (LV / birtoklás) nem kerül többé a
    `buildKosarstatPostgameContext` erősség / probléma / fókusz soraiba.
- Webes (nem `@core`): `SeasonComparison.tsx` számolja és átadja az
  `oppPossessions`-t; a Kosarstat nyers blokk feliratai jelöltek
  („TO% (LV/birt.)”, „FTM rate (FTM/FGA)”), a TO-különbség színe javítva
  (kisebb a jobb); `lib/export-to-md.ts` képlet-lábjegyzet.

## Hatás a mobil appra
- A build nem törik (új mező opcionális).
- `oppPossessions` nélkül a mobil referencia-tempója és -ratingjei a saját
  birtoklásból számolnak → eltérnek a webtől.
- `lib/postgame-view.ts:48` a `'FT arány'` címkét fordítja („Büntető arány”)
  – az új címke `'FTM arány'`, a fordítás így nem illeszkedik.
- Ha a mobil a `keyStats` címkéjére (`'TO rate'`, `'FT rate'`) szűr vagy
  fordít, az új címkék: `'TO rate (Oliver)'`, `'FTM rate'`.

## Teendő a mobil repóban
- [x] `npm run sync:core`
- [x] `lib/team-season-stats.ts` / `lib/postgame-data.ts`: `oppPossessions`
      (az ellenfelek szezonos `FGA + 0,44·FTA + LV − T-lep` összege)
      átadása a benchmark-medence minden csapatánál
- [x] `lib/postgame-view.ts`: címke-térkép `'FTM arány'` (és ha van:
      `'FTM rate'`, `'TO rate (Oliver)'`)
- [x] Ha a mobil a Kosarstat TO%-ot a riport soraiban mutatja, jelölése
      „TO% (LV/birtoklás)”

## Kézi lépések
nincs
