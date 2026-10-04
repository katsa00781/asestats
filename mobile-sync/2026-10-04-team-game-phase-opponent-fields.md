# TeamGame: ellenfél-azonosító, forduló és versenyszakasz

- **Dátum:** 2026-10-04
- **Webes commit:** ez a commit
- **Típus:** @core | funkcionális
- **Állapot a mobilban:** ÁTVEZETVE (2026-10-04, mobil commit 5af81c6, @core szinkron 6610ffb; az ellenfél neve `opponentTeamId` → `teams.name` alapján, mobil D-127; versenyszakasz-jelölés és `competitionPhase` most nem készül, mobil D-128)

## Mi változott
- `lib/dashboard-types.ts` (`@core`): a `TeamGame` három új **opcionális**
  mezőt kapott:
  - `opponentTeamId?: string | null` – a `games.opponent_team_id`; a
    `TeamGame.opponent` szabad szöveg (import kori név), a kanonikus
    csapatnév ebből az azonosítóból oldandó fel (`teams.name`).
  - `round?: number | null` – a `games.round`.
  - `competitionPhase?: string | null` – a Kosarstat versenyszakasz-címkéje
    (pl. `Alapszakasz`, `Negyeddöntő - 1. mérkőzés`, `Harmadik helyért - 3. mérkőzés`).
- `hooks/useGameData.ts` (webes): a mezőket tölti; a szakaszt a
  `kosarstat_game_pages_raw` táblából olvassa
  (`select('kosarstat_game_id, competition_phase')`, szűrés: `season_id`,
  `page_type = 'game'`, `kosarstat_game_id IN (a meccsek linkjei)`). A
  játékos-sorok joinja bővült: `players:player_id (team_id, name, number, position, is_active)`.
- Új, **nem `@core`** webes modul: `lib/team-season-export.ts`
  (`buildTeamSeasonExport`, `classifyPhase`) – a csapat szezon MD export
  adatmodellje; a `lib/export-to-md.ts` `teamStatsToMd` erre épül.
- Adatbázis-, scraping- és API-változás nincs.

## Hatás a mobil appra
- A mostani mobil build nem törik: a mezők opcionálisak, a mobil saját
  adatrétege nem tölti őket.
- A mobil Meccsek / Ma nézete az ellenfél nevét a `games.opponent` szövegből
  írja ki, ezért ugyanaz a csapat két néven jelenhet meg („Szolnoki
  Olajbányász” és „NHSZ-Szolnoki Olajbányász”). A weben az export már az
  azonosítóból oldja fel a nevet.
- Alapszakasz / rájátszás megkülönböztetés a mobilban jelenleg nincs; a
  `round` önmagában nem elég (a „3. helyért” sorozat `round = 3`).

## Teendő a mobil repóban
- [x] `npm run sync:core` (a `dashboard-types` frissítése)
- [x] A mobil `useGameData` megfelelőjében az `opponentTeamId`, `round` és
      `competitionPhase` kitöltése (ugyanazzal a `kosarstat_game_pages_raw`
      lekérdezéssel)
      – az `opponentTeamId` és a `round` eddig is megvolt; a `competitionPhase`
      nem készül (mobil D-128)
- [x] Eldönteni: az ellenfél neve a mobilban is az `opponentTeamId` → `teams.name`
      alapján jelenjen-e meg → igen (mobil D-127)
- [x] Eldönteni: kell-e versenyszakasz-jelölés a mobil meccslistában
      (a besorolási szabály a web `classifyPhase` függvénye) → most nem (mobil D-128)

## Kézi lépések
nincs
