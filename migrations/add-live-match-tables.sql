-- Élő mérkőzés-követés táblái.
--
-- Miért külön táblák, nem a games/league_fixtures bővítése: a `games` sorai
-- NOT NULL végeredményt tárolnak és csapatperspektíva-specifikusak, a
-- `league_fixtures.status` CHECK-je (scheduled/played/postponed/cancelled)
-- pedig minden meglévő lekérdezést érintene egy 'live' érték felvételével.
-- A három új tábla nem bolygat meg egyetlen létező query-t sem, és a lezárt
-- meccs igazságforrása is egyértelmű marad: a heti Playwright-scrape írja a
-- games/player_game_stats_* táblákat, ez a három tábla csak a meccs
-- KÖZBENI állapotot tükrözi, és a meccs végén (retention) törlődik.
--
-- Az oszlopnevek szándékosan megegyeznek a player_game_stats_YYYY_YYYY és a
-- kosarstat_game_quarter_stats tábláknál használt nevekkel (close_made,
-- mid_attempted, total_rebounds, fouls_committed, team_side, cumulative_points
-- stb.), hogy az olvasó oldalon (mobil app) a meglévő mapper-mintákat lehessen
-- újrahasznosítani.
--
-- Író: a `supabase/functions/live-scan` Edge Function, service role kulccsal
-- (megkerüli az RLS-t). Kliens oldalról csak SELECT megy.

-- 1. Egy sor = egy találkozó (NEM csapatperspektíva, a games-szel ellentétben)
CREATE TABLE IF NOT EXISTS live_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  -- Ha a párosítás felismerhető a league_fixtures-ben (dátum + csapatok
  -- alapján) – nem kötelező, csak diagnosztikai/kereszthivatkozási célra.
  fixture_id UUID REFERENCES league_fixtures(id) ON DELETE SET NULL,
  home_team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  away_team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  -- A forrás nyers csapatneve – diagnosztikára, ha a teams-feloldás hibázna.
  home_team_name TEXT NOT NULL,
  away_team_name TEXT NOT NULL,
  home_score INTEGER NOT NULL DEFAULT 0,
  away_score INTEGER NOT NULL DEFAULT 0,
  -- 0 = még nem kezdődött, 1-4 negyed, 5+ hosszabbítás.
  period INTEGER NOT NULL DEFAULT 0,
  -- A forrás órája MM:SS alakban, vagy NULL, ha nincs (lásd HOWTO-live-scan.md
  -- – a v1-ben ez mindig NULL, amíg a forrás órasémáját éles meccsen nem
  -- sikerül validálni).
  clock TEXT,
  status TEXT NOT NULL DEFAULT 'live'
    CHECK (status IN ('scheduled', 'live', 'halftime', 'final')),
  -- Az MKOSZ netcasting rendszer meccskódja (pl. 'hun_134745') – ebből épül
  -- a `storage/full<kód>.html` URL, amit a gyűjtő újra lekér.
  source_code TEXT NOT NULL,
  source_url TEXT,
  started_at TIMESTAMPTZ,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT live_games_distinct_teams CHECK (home_team_id <> away_team_id),
  CONSTRAINT live_games_unique_source UNIQUE (season_id, source_code)
);

CREATE INDEX IF NOT EXISTS idx_live_games_season_status ON live_games(season_id, status);
CREATE INDEX IF NOT EXISTS idx_live_games_home_team ON live_games(home_team_id);
CREATE INDEX IF NOT EXISTS idx_live_games_away_team ON live_games(away_team_id);

-- 2. Játékosonkénti élő box score sor.
CREATE TABLE IF NOT EXISTS live_player_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_game_id UUID NOT NULL REFERENCES live_games(id) ON DELETE CASCADE,
  team_side TEXT NOT NULL CHECK (team_side IN ('home', 'away')),
  -- A netcasting játékoskódja (pl. 'B97205') – ez az upsert dedup kulcsa,
  -- NEM a players.id. A player_id feloldás (név alapján) v2-re marad: a
  -- forrás névalakja (ékezet, sorrend, "&nbsp;") túl bizonytalan ahhoz, hogy
  -- automatikus feloldás hibás párosítást ne adjon.
  source_player_code TEXT NOT NULL,
  player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  player_name TEXT NOT NULL,
  number INTEGER,
  -- v1-ben mindig 0: a percek kiszámítása a csereesemények (kód 1011)
  -- párosításából lehetséges, de ez külön feladat – lásd HOWTO-live-scan.md.
  minutes INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  close_made INTEGER NOT NULL DEFAULT 0,
  close_attempted INTEGER NOT NULL DEFAULT 0,
  mid_made INTEGER NOT NULL DEFAULT 0,
  mid_attempted INTEGER NOT NULL DEFAULT 0,
  three_made INTEGER NOT NULL DEFAULT 0,
  three_attempted INTEGER NOT NULL DEFAULT 0,
  free_throw_made INTEGER NOT NULL DEFAULT 0,
  free_throw_attempted INTEGER NOT NULL DEFAULT 0,
  total_rebounds INTEGER NOT NULL DEFAULT 0,
  assists INTEGER NOT NULL DEFAULT 0,
  steals INTEGER NOT NULL DEFAULT 0,
  blocks INTEGER NOT NULL DEFAULT 0,
  turnovers INTEGER NOT NULL DEFAULT 0,
  fouls_committed INTEGER NOT NULL DEFAULT 0,
  valuation INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT live_player_lines_unique UNIQUE (live_game_id, team_side, source_player_code)
);

CREATE INDEX IF NOT EXISTS idx_live_player_lines_game ON live_player_lines(live_game_id);

-- 3. Negyedenkénti pontbontás.
CREATE TABLE IF NOT EXISTS live_quarter_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_game_id UUID NOT NULL REFERENCES live_games(id) ON DELETE CASCADE,
  team_side TEXT NOT NULL CHECK (team_side IN ('home', 'away')),
  quarter SMALLINT NOT NULL CHECK (quarter >= 1),
  points INTEGER NOT NULL DEFAULT 0,
  cumulative_points INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT live_quarter_scores_unique UNIQUE (live_game_id, team_side, quarter)
);

CREATE INDEX IF NOT EXISTS idx_live_quarter_scores_game ON live_quarter_scores(live_game_id);

-- RLS: bejelentkezett felhasználók olvashatnak, írás csak service_role-nak
-- (az Edge Function ezzel a kulccsal fut, megkerüli az RLS-t) – ugyanaz a
-- minta, mint a game_text_reports/team_text_reports táblákon
-- (add-rls-to-text-report-tables.sql).
ALTER TABLE live_games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "live_games_select_authenticated"
  ON live_games
  FOR SELECT
  TO authenticated
  USING (true);

ALTER TABLE live_player_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "live_player_lines_select_authenticated"
  ON live_player_lines
  FOR SELECT
  TO authenticated
  USING (true);

ALTER TABLE live_quarter_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "live_quarter_scores_select_authenticated"
  ON live_quarter_scores
  FOR SELECT
  TO authenticated
  USING (true);
