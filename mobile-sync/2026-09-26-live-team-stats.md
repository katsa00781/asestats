# Élő meccs – csapatszintű meccsstatisztika (`live_team_stats`)

- **Dátum:** 2026-09-26
- **Webes commit:** ez a commit (a migráció és a deploy kézi lépés, lásd lent)
- **Típus:** adatbázis + scraping
- **Állapot a mobilban:** ÁTVEZETVE (2026-09-26, mobil commit 61f8613)

## Mi változott
- Új tábla: `live_team_stats` (`migrations/add-live-team-stats-table.sql`).
  Egy sor = egy `live_games` sor egyik oldala, `UNIQUE (live_game_id, team_side)`,
  `ON DELETE CASCADE`. RLS: `authenticated` SELECT, ugyanaz, mint a többi `live_*` táblán.
- Oszlopok: `team_side` (`home`/`away`), `points`, `close_made/attempted`,
  `mid_made/attempted`, `three_made/attempted`, `free_throw_made/attempted`,
  `offensive_rebounds`, `defensive_rebounds`, `total_rebounds`, `team_rebounds`,
  `assists`, `steals`, `blocks`, `turnovers`, `team_turnovers`,
  `fouls_committed`, `fouls_drawn`, `timeouts`, `valuation`, `updated_at`.
- A `live-scan` Edge Function minden futásban mindkét oldalra upsertel. Az
  értékek a TELJES csapat-összesítőt adják: a játékos események mellett a
  játékoskód nélküli csapatszintű eseményeket is (csapat-lepattanó,
  csapat-labdaeladás, csapat szerzett labda, csapat fault, időkérés). Ezért
  **nem egyenlők a `live_player_lines` összegével**. A `team_rebounds` és a
  `team_turnovers` a csapatszintű részt mutatja, és benne van a
  `total_rebounds`-ban, illetve a `turnovers`-ben.
- A `live_player_lines` és a `live_quarter_scores` nem változott.

## Hatás a mobil appra
- A mostani mobil build nem törik: az új táblát semmi nem olvassa.
- Az élő nézet (`app/(tabs)/games/live.tsx`) jelenleg csak játékos box
  score-t és negyedeket mutat. A meccsstatisztika új szekció lehet (a
  netcasting „Statisztikák" panelje szerint: FG%, 2P%, 3P%, FT%, lepattanó,
  szerzett/eladott labda, assist, fault, kiharcolt fault, VAL, saját vs. ellenfél).
- Az oszlopnevek a `live_player_lines`-éit követik (D-107): a 2P a `close_* + mid_*` összege, ahogy a `toBoxScore()`-ban.

## Teendő a mobil repóban
- [x] `types/live.ts`: új `LiveTeamStats` típus és `teamStats` mező a `LiveGameDetails`-ben (saját/ellenfél).
- [x] `hooks/useLiveGame.ts` `fetchLiveDetails()`: harmadik párhuzamos lekérdezés
  `live_team_stats`-ra (`.eq('live_game_id', summary.id)`), és `toTeamStats()`
  mapper a `team_side` + `homeAway` alapján, rendszerhatár-validációval.
- [x] Élő nézet: meccsstatisztika szekció (saját vs. ellenfél). Üres állapot, ha még nincs sor, mert a migráció vagy a deploy előtt nem jön adat.

## Kézi lépések
- A `migrations/add-live-team-stats-table.sql` futtatása a Supabase SQL Editorban – a jegyzet írásakor még NEM futott.
- Utána a `supabase functions deploy live-scan --use-api` – még NEM futott. A sorrend kötelező, lásd `HOWTO-live-scan.md`.
