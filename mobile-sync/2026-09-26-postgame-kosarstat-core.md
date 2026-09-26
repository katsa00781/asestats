# Post-game kosarstat-kiegészítés a `@core`-ban

- **Dátum:** 2026-09-26
- **Webes commit:** ez a commit
- **Típus:** @core
- **Állapot a mobilban:** ÁTVEZETVE (2026-09-26, mobil commit 1e86c39; a webes összevetés és az eszközös ellenőrzés nyitott)

## Mi változott

A web post-game nézetének kosarstat-alapú sorai eddig a
`components/SeasonComparison.tsx`-ben éltek. Ezek a negyed-trend, a kosarstat
eFG / TO% / ORB% különbség és a clutch alapján állnak elő. Most átkerültek a
`lib/postgame-report.ts`-be, a web pedig már innen hívja őket. A web
viselkedése nem változott: a küszöbök, a szövegek és a duplikátumszűrés ugyanazok.

Új exportok a `@core/postgame-report`-ban:

| Export | Szerep |
|---|---|
| `buildKosarstatPostgameContext<C>(input \| null)` | Kosarstat sorokból → `quarterDiffRows`, `ownMetrics`, `oppMetrics`, `clutch`, `turnoverTypes`, `strengths`, `problems`, `nextFocus`, `insightNotes`. `null` bemenetre üres kontextust ad. |
| `mergeKosarstatPostgameContext(report, context, { extraNotes?, lineupInsights? })` | Ráfűzi a kontextust az `analyzePostGameReport` riportjára: `dataNotes`, `strengths`, `problems`, `nextFocus`, sorrendtartó, kis- és nagybetűre érzéketlen duplikátumszűréssel. Ha nincs mit hozzáadni, az eredeti riportot adja vissza. |
| `KosarstatQuarterStatRow`, `KosarstatTeamMetricRow` | Típusok a `kosarstat_game_quarter_stats` és a `kosarstat_game_team_metrics` soraihoz, snake_case oszlopnevekkel. |
| `PostgameClutchInput` | A clutch-szabályokhoz szükséges minimum. A `@core/kosarstat-clutch-parse` `KosarstatGameClutch` típusa **közvetlenül megfelel neki**. |
| `KosarstatPostgameInput`, `KosarstatPostgameContext`, `PostgameQuarterDiffRow`, `PostgameTurnoverType` | Be- és kimeneti típusok. |

A `KosarstatPostgameInput` mezői:
- `ownSide`: `'home' | 'away'`;
- `teamName?`;
- `quarterStats`;
- `teamMetrics`;
- `clutch?`;
- `turnoverTypes?`;
- `clutchImportNote?`.

A lineup-elemzés (`lineupInsights`) webes marad, mert a kosarstat nyers PBP
webes parszolásából jön. A `merge` csak opcionális paraméterként fogadja.

**A korábbi jegyzet egy pontja megváltozik.** A
`2026-09-26-postgame-analysis-spec.md` 5. pontjában a „Kosarstat-kiegészítés”
már **nincs kihagyva**. A mobil v1-be bekerülhet, és a `@core`-ból kell hívni.
A lineup-elemzés továbbra is kimarad.

## Hatás a mobil appra

- A mobil build nem törik: csak új exportok jöttek, a meglévők nem változtak.
- `npm run sync:core` kell. A `core/postgame-report.ts` frissül, más fájl nem.
- A post-game elemzés (lásd a spec jegyzetet) így ugyanazokat az
  erősség / probléma / fókusz sorokat adja, mint a web.

## Teendő a mobil repóban

- [x] `npm run sync:core`.
- [x] A post-game hookban az `analyzePostGameReport` után:
  ```ts
  const context = game.kosarstatGameId
    ? buildKosarstatPostgameContext({
        ownSide: game.homeAway === 'away' ? 'away' : 'home',
        teamName,                 // a kiválasztott csapat neve
        quarterStats,             // nyers kosarstat_game_quarter_stats sorok
        teamMetrics,              // nyers kosarstat_game_team_metrics sorok
        clutch,                   // a meglévő fetchClutch() KosarstatGameClutch | null
        turnoverTypes: [],        // a web is üresen adja, nincs forrása
        clutchImportNote: null,   // lásd lent
      })
    : buildKosarstatPostgameContext(null);
  const report = mergeKosarstatPostgameContext(baseReport, context);
  ```
- [x] Nyers sorok: a `useGameDetails` a negyedeket és a metrikákat most
      rögtön `QuarterScore` / `FourFactorRow` alakra képezi le. A post-game
      számításhoz a nyers sorok kellenek a rendszerhatáron validálva, és
      bővebb oszloplista kell:
  - `kosarstat_game_quarter_stats`:
    `team_name, team_side, quarter, points, cumulative_points`;
  - `kosarstat_game_team_metrics`:
    `team_name, team_side, poss, ortg, efg, tov_pct, orb_pct, ftm_rate`.

  A `team_name` a tartalék párosításhoz kell, ha a `team_side` hiányzik. A
  web ugyanígy kérdez le. Két lehetőség van: a payload megtartja a nyers
  sorokat is, vagy a post-game hook újra lekéri őket (meccsenként ≤ 10 sor).
- [x] `extraNotes` és `clutchImportNote`: a web ide technikai
      import-állapot üzeneteket tesz (pl. „Team advanced mutatók csatolva (2
      sor).”). A mobil fogyasztói nézetben ezek nem kellenek, ezért
      javaslat: `null` és üres tömb. Ekkor a kosarstat `insightNotes`-a
      marad a `dataNotes`-ban: negyed-összegzés, „team-metric blokk
      integrálva”, clutch-minta.
- [x] A kontextus `quarterDiffRows`, `ownMetrics`, `oppMetrics` mezője a
      meglévő negyed- és four-factors panelek helyett **nem** kell. Azok
      maradnak, a kontextusból csak a szövegsorok számítanak.
- [x] A szövegek `→`/`≈` nélküliek, de a `plainText` továbbra is kötelező a
      teljes riportra (D-064).
- [x] A clutch-szöveg a web szerint „Clutch (utolsó 5 perc, <=5 pont)”. A
      mobil D-089 döntése szerint a kosarstat clutch nem fix 5 perces
      ablak. Ha ez zavaró, a feliratot a `@core`-ban kell javítani külön
      webes commitban, nem a mobilban felülírni.
- [ ] Ellenőrzés: egy kosarstat-importos 2025/2026-os ASE meccsen a
      `strengths` / `problems` / `nextFocus` egyezik a webes post-game
      nézettel. Ott a „Kosarstat only: BE” kapcsoló megmutatja, mely sorok
      jönnek a kosarstatból.

## Kézi lépések

Nincs. Nincs migráció és nincs újraimport.
