-- Élő mérkőzés – csapatszintű meccsstatisztika.
--
-- A `live_player_lines` csak a játékosok eseményeit tartalmazza. A netcasting
-- forrás a játékoskód nélküli, csapatszintű eseményeket (2002 csapat
-- védőlepattanó, 2003 csapat támadólepattanó, 2004 csapat szerzett labda,
-- 2005 csapat eladott labda, 2006 csapat kiharcolt fault, 2007/2020 csapat
-- fault, 2011 időkérés) külön „Csapat" sorba gyűjti, és a saját
-- „Statisztikák" panelje az ezzel együtt számolt összesítőt mutatja. Ezek a
-- játékos sorokból nem számolhatók vissza, ezért kell ez a tábla.
--
-- Egy sor = egy élő meccs egyik oldala (home/away), ugyanaz a minta, mint a
-- `live_quarter_scores`-nál. Minden oszlop a TELJES csapat-összesítő (játékos
-- + csapatszintű esemény); a `team_rebounds` és `team_turnovers` csak a
-- csapatszintű részt mutatja külön, és benne van a `total_rebounds`-ban,
-- illetve a `turnovers`-ben.
--
-- Az oszlopnevek a `live_player_lines` és a `player_game_stats_YYYY_YYYY`
-- neveit követik (D-107 a mobil repóban): close/mid/three/free_throw,
-- offensive_rebounds, defensive_rebounds, fouls_committed, fouls_drawn.
--
-- Író: a `supabase/functions/live-scan` Edge Function, service role kulccsal.
-- Törlés: a `live_games` retention törlése CASCADE-dal viszi.

CREATE TABLE IF NOT EXISTS live_team_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_game_id UUID NOT NULL REFERENCES live_games(id) ON DELETE CASCADE,
  team_side TEXT NOT NULL CHECK (team_side IN ('home', 'away')),
  points INTEGER NOT NULL DEFAULT 0,
  close_made INTEGER NOT NULL DEFAULT 0,
  close_attempted INTEGER NOT NULL DEFAULT 0,
  mid_made INTEGER NOT NULL DEFAULT 0,
  mid_attempted INTEGER NOT NULL DEFAULT 0,
  three_made INTEGER NOT NULL DEFAULT 0,
  three_attempted INTEGER NOT NULL DEFAULT 0,
  free_throw_made INTEGER NOT NULL DEFAULT 0,
  free_throw_attempted INTEGER NOT NULL DEFAULT 0,
  offensive_rebounds INTEGER NOT NULL DEFAULT 0,
  defensive_rebounds INTEGER NOT NULL DEFAULT 0,
  total_rebounds INTEGER NOT NULL DEFAULT 0,
  -- A total_rebounds-ból a csapatszintű (2002/2003) rész.
  team_rebounds INTEGER NOT NULL DEFAULT 0,
  assists INTEGER NOT NULL DEFAULT 0,
  steals INTEGER NOT NULL DEFAULT 0,
  blocks INTEGER NOT NULL DEFAULT 0,
  turnovers INTEGER NOT NULL DEFAULT 0,
  -- A turnovers-ből a csapatszintű (2005) rész.
  team_turnovers INTEGER NOT NULL DEFAULT 0,
  fouls_committed INTEGER NOT NULL DEFAULT 0,
  fouls_drawn INTEGER NOT NULL DEFAULT 0,
  timeouts INTEGER NOT NULL DEFAULT 0,
  valuation INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT live_team_stats_unique UNIQUE (live_game_id, team_side)
);

-- A UNIQUE (live_game_id, team_side) index a live_game_id szerinti
-- lekérdezést is kiszolgálja, külön index nem kell.

-- RLS: ugyanaz, mint a többi live_* táblán (add-live-match-tables.sql).
ALTER TABLE live_team_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "live_team_stats_select_authenticated"
  ON live_team_stats
  FOR SELECT
  TO authenticated
  USING (true);
