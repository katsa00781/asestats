# Post-game riport: kis minta referencia, ratingek, ellenfél-bizonyíték

- **Dátum:** 2026-09-27
- **Webes commit:** ez a commit
- **Típus:** @core | funkcionális
- **Állapot a mobilban:** NYITOTT

## Mi változott
- `lib/postgame-report.ts` (`analyzePostGameReport`):
  - Új `report.baseline?: PostgameBaseline` (`kind: 'season' | 'league'`, `seasonGames`, `smallSample`, `label`, `noun`). `MIN_SEASON_BASELINE_GAMES = 3` alatt a referencia a liga medián (P50), nem a szezonátlag. A `keyStats[].season` mező innentől **a referencia értéke** (szezonátlag vagy liga medián).
  - Új `report.metrics.ratings?: PostgameRatings | null` (ORtg, DRtg, Net, referenciaértékek, `primaryCause`) és `report.metrics.opponent?: PostgameOpponentShooting | null` (ellenfél eFG, 3P m/a/%, FT rate, OREB%, TO rate).
  - A ligabenchmark (`buildTeamBenchmarks`) `ortg` / `drtg` kulccsal bővült; `NormalizedTeamStats` új `ortg` / `drtg` mezői.
  - Liga-referenciánál a szezon-delta alapú erősség/probléma sorok kimaradnak.
  - `nextFocus` célértékei a referencia és a liga medián közül a jobbikat mutatják; a korábban soha nem aktiválódó fókusz-szabályok javítva (több fókuszsor jelenhet meg, mint eddig).
  - Szövegváltozások: „Visszaesés” / „Meccs-szintű visszaesés” → „Gyenge meccs”; a védekezési tényezők zárójeles számot kapnak (pl. `Perimétervédekezési probléma (ellenfél 3P 10/26, 38.5%)`); az összefoglaló új `Ratingek`, `Fő ok`, `Minta` sorokat kap; a „szezonátlag” szó kis mintánál „ligamedián”.
- `lib/player-postgame.ts`: a vezető címke („Elsődleges motor”) a meccs legjobbjától ≤10%-ra lévő játékosokra is jár (`TOP_PERFORMER_BAND = 0.9`, a 60-as küszöb a meccs legjobbjára vonatkozik).
- Webes (nem `@core`): `lib/export-to-md.ts` MD kimenet, `SeasonComparison.tsx` címkék.

## Hatás a mobil appra
- Az új mezők opcionálisak, a mostani mobil build nem törik.
- Ha a mobil post-game nézet a `keyStats[].season` értéket „Szezon” felirattal mutatja, kis mintánál (szezon eleje) valójában liga mediánt mutatna → a felirat legyen `report.baseline?.label ?? 'Szezon'`.
- Ha a mobil a „Visszaesés” szöveget saját címkeként írja ki az `underperformers` listához, cserélendő „Gyenge meccs”-re.
- Ha a mobil a `decisiveFactors` szövegeire pontos egyezéssel szűr (pl. `'Perimétervédekezési probléma'`), előtag-alapú egyezésre kell váltani.

## Teendő a mobil repóban
- [ ] `npm run sync:core`
- [ ] Post-game nézet: referencia felirat a `report.baseline` alapján, „Kis minta” jelzés `baseline.smallSample` esetén
- [ ] Opcionális: ORtg / DRtg / Net sor (`metrics.ratings`) és ellenfél-dobás blokk (`metrics.opponent`) megjelenítése
- [ ] „Visszaesés” → „Gyenge meccs” saját címkékben, ha van

## Kézi lépések
nincs
