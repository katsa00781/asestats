# Post-game riport: pontforrások a Kosarstat eseménylistából

- **Dátum:** 2026-10-04
- **Webes commit:** ez a commit
- **Típus:** @core | funkcionális
- **Állapot a mobilban:** ÁTVEZETVE (2026-10-04, mobil commit e3e8c62, @core szinkron 6610ffb; „Pontforrások” szekció a post-game nézetben, mobil D-126; eszközös próba nyitva)

## Mi változott
- **Új `@core`-jelölt modul:** `lib/kosarstat-pbp-parse.ts` –
  `parseKosarstatPointSources(headers, rows, quickFinishSeconds = 6)`. A
  Kosarstat `game_events` oldal eseménytáblájából (az a
  `kosarstat_game_page_tables` sor, amelynek `headers`-e tartalmazza a
  `home_event` oszlopot) birtoklás-követéssel számol oldalanként:
  `points`, `secondChancePoints`, `pointsOffTurnovers`, `quickFinishPoints`.
  Tiszta modul (nincs külső import, csak típus a `postgame-report`-ból).
- `lib/postgame-report.ts`:
  - új típusok: `PostgamePointSourceLine`, `PostgamePointSources`,
    `KosarstatPointSourceTotals`;
  - új opcionális mező: `PostGameReport.metrics.pointSources`;
  - `KosarstatPostgameInput.pointSources?` (bemenet) és
    `KosarstatPostgameContext.pointSources` (saját / ellenfél oldalra rendezve);
  - `mergeKosarstatPostgameContext` csak akkor írja a riportba, ha az
    eseményekből összeadott pontszám mindkét oldalon egyezik a
    `metrics.pointsFor` / `pointsAgainst` értékkel; egyébként megjegyzés kerül
    a `dataNotes`-ba.
- Webes (nem `@core`): `SeasonComparison.tsx` betölti a meccs `game_events`
  nyers oldalát és eseménytábláját, megjeleníti a pontforrásokat a Kosarstat
  blokkban; `lib/export-to-md.ts` „Pontforrások” tábla.
- Adatbázis-, scraping- és API-változás nincs.

## Hatás a mobil appra
- A build nem törik: a `postgame-report.ts` nem importálja az új modult, az
  új mezők opcionálisak, a `KosarstatPostgameContext`-et a mobil a
  `buildKosarstatPostgameContext`-ből kapja (`lib/postgame-data.ts:153`).
- `pointSources` átadása nélkül a mobil riportban nincs pontforrás – a web
  és a mobil post-game nézete ebben eltér.
- A definíció: gyors befejezés = labdaszerzés vagy védőlepattanó után ≤ 6 mp
  (nem jegyzőkönyvi fast break) – a feliratnak ezt kell tükröznie.

## Teendő a mobil repóban
- [x] `scripts/sync-core.ts` listájába felvenni: `kosarstat-pbp-parse`, majd
      `npm run sync:core`
- [x] `lib/postgame-data.ts`: a meccs `game_events` oldalának betöltése
      (`kosarstat_game_pages_raw` → `id`, majd `kosarstat_game_page_tables`
      `rows, headers` a `page_raw_id`-ra), `parseKosarstatPointSources`, és
      az eredmény átadása `pointSources`-ként a
      `buildKosarstatPostgameContext`-nek
- [x] Post-game nézet: `metrics.pointSources` megjelenítése (saját – ellenfél),
      „számított, nem hivatalos adat” jelöléssel
- [x] Átvezetés után a webes `CLAUDE.md` `@core` listájába felvenni a
      `kosarstat-pbp-parse` modult

## Kézi lépések
nincs (a már mentett riportok nem változnak; új generálás / export kell)
