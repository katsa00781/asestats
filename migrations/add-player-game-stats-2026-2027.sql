-- ============================================================
-- 2026/2027 SZEZON ELŐKÉSZÍTÉSE
-- ============================================================
-- Futtatás: Supabase SQL Editorban, teljes fájl egyszerre
--
-- Ez a migráció:
--   1. Létrehozza a player_game_stats_2026_2027 táblát
--   2. Frissíti a player_game_stats UNION view-t
--   3. Frissíti az INSTEAD OF triggereket (INSERT, UPDATE, DELETE)
--   4. Frissíti a player_season_stats_by_season view-t
--   5. Hozzáadja a 2026/2027 szezont a seasons táblába
-- ============================================================

-- ============================================================
-- 1. ÚJ SZEZONSPECIFIKUS TÁBLA
-- ============================================================

CREATE TABLE IF NOT EXISTS player_game_stats_2026_2027 (
  LIKE player_game_stats_2025_2026 INCLUDING ALL
);

-- FK-kat a LIKE nem örököl, explicit kell.
-- (Az ALTER TABLE ... ADD CONSTRAINT IF NOT EXISTS nem létezik Postgresben,
-- ezért DO blokkos guard védi az újrafuttathatóságot.)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_2026_2027_game') THEN
    ALTER TABLE player_game_stats_2026_2027
      ADD CONSTRAINT fk_2026_2027_game
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_2026_2027_player') THEN
    ALTER TABLE player_game_stats_2026_2027
      ADD CONSTRAINT fk_2026_2027_player
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pgs_2026_2027_game_id   ON player_game_stats_2026_2027(game_id);
CREATE INDEX IF NOT EXISTS idx_pgs_2026_2027_player_id ON player_game_stats_2026_2027(player_id);

-- ============================================================
-- 2. RLS
-- ============================================================

ALTER TABLE player_game_stats_2026_2027 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON player_game_stats_2026_2027;
CREATE POLICY "Enable read access for all users"
  ON player_game_stats_2026_2027 FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON player_game_stats_2026_2027;
CREATE POLICY "Enable insert for authenticated users"
  ON player_game_stats_2026_2027 FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for authenticated users" ON player_game_stats_2026_2027;
CREATE POLICY "Enable update for authenticated users"
  ON player_game_stats_2026_2027 FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Enable delete for authenticated users" ON player_game_stats_2026_2027;
CREATE POLICY "Enable delete for authenticated users"
  ON player_game_stats_2026_2027 FOR DELETE USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON player_game_stats_2026_2027 TO anon, authenticated;

-- ============================================================
-- 3. UNION VIEW FRISSÍTÉSE (player_game_stats)
-- ============================================================

DROP VIEW IF EXISTS player_game_stats CASCADE;

CREATE VIEW player_game_stats
WITH (security_invoker = true)
AS
  SELECT
    id, game_id, player_id, minutes, points,
    close_made, close_attempted, mid_made, mid_attempted,
    three_made, three_attempted, free_throw_made, free_throw_attempted,
    offensive_rebounds, defensive_rebounds, total_rebounds,
    assists, steals, blocks, turnovers, fouls_committed,
    fouls_drawn, blocks_suffered, blocks_given,
    plus_minus, valuation,
    offensive_rating, defensive_rating,
    true_shooting_percentage, effective_field_goal_percentage,
    is_starter, created_at
  FROM player_game_stats_2023_2024
  UNION ALL
  SELECT
    id, game_id, player_id, minutes, points,
    close_made, close_attempted, mid_made, mid_attempted,
    three_made, three_attempted, free_throw_made, free_throw_attempted,
    offensive_rebounds, defensive_rebounds, total_rebounds,
    assists, steals, blocks, turnovers, fouls_committed,
    fouls_drawn, blocks_suffered, blocks_given,
    plus_minus, valuation,
    offensive_rating, defensive_rating,
    true_shooting_percentage, effective_field_goal_percentage,
    is_starter, created_at
  FROM player_game_stats_2024_2025
  UNION ALL
  SELECT
    id, game_id, player_id, minutes, points,
    close_made, close_attempted, mid_made, mid_attempted,
    three_made, three_attempted, free_throw_made, free_throw_attempted,
    offensive_rebounds, defensive_rebounds, total_rebounds,
    assists, steals, blocks, turnovers, fouls_committed,
    fouls_drawn, blocks_suffered, blocks_given,
    plus_minus, valuation,
    offensive_rating, defensive_rating,
    true_shooting_percentage, effective_field_goal_percentage,
    is_starter, created_at
  FROM player_game_stats_2025_2026
  UNION ALL
  SELECT
    id, game_id, player_id, minutes, points,
    close_made, close_attempted, mid_made, mid_attempted,
    three_made, three_attempted, free_throw_made, free_throw_attempted,
    offensive_rebounds, defensive_rebounds, total_rebounds,
    assists, steals, blocks, turnovers, fouls_committed,
    fouls_drawn, blocks_suffered, blocks_given,
    plus_minus, valuation,
    offensive_rating, defensive_rating,
    true_shooting_percentage, effective_field_goal_percentage,
    is_starter, created_at
  FROM player_game_stats_2026_2027;

GRANT SELECT ON player_game_stats TO anon, authenticated;

-- ============================================================
-- 4. INSTEAD OF TRIGGEREK ÚJRADEFINIÁLÁSA
-- ============================================================

-- 4a. INSERT trigger

CREATE OR REPLACE FUNCTION route_pgs_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season_name TEXT;
BEGIN
  SELECT s.name INTO v_season_name
  FROM games g
  JOIN seasons s ON g.season_id = s.id
  WHERE g.id = NEW.game_id;

  IF v_season_name IS NULL THEN
    RAISE EXCEPTION 'Ismeretlen szezon a game_id=% értékhez', NEW.game_id;
  END IF;

  CASE v_season_name
    WHEN '2023/2024' THEN
      INSERT INTO player_game_stats_2023_2024 (
        id, game_id, player_id, minutes, points,
        close_made, close_attempted, mid_made, mid_attempted,
        three_made, three_attempted, free_throw_made, free_throw_attempted,
        offensive_rebounds, defensive_rebounds, total_rebounds,
        assists, steals, blocks, turnovers, fouls_committed,
        fouls_drawn, blocks_suffered, blocks_given,
        plus_minus, valuation, offensive_rating, defensive_rating,
        true_shooting_percentage, effective_field_goal_percentage,
        is_starter, created_at
      ) VALUES (
        COALESCE(NEW.id, gen_random_uuid()), NEW.game_id, NEW.player_id,
        NEW.minutes, NEW.points, NEW.close_made, NEW.close_attempted,
        NEW.mid_made, NEW.mid_attempted, NEW.three_made, NEW.three_attempted,
        NEW.free_throw_made, NEW.free_throw_attempted,
        NEW.offensive_rebounds, NEW.defensive_rebounds, NEW.total_rebounds,
        NEW.assists, NEW.steals, NEW.blocks, NEW.turnovers, NEW.fouls_committed,
        COALESCE(NEW.fouls_drawn, 0), COALESCE(NEW.blocks_suffered, 0), COALESCE(NEW.blocks_given, 0),
        NEW.plus_minus, NEW.valuation, NEW.offensive_rating, NEW.defensive_rating,
        NEW.true_shooting_percentage, NEW.effective_field_goal_percentage,
        NEW.is_starter, COALESCE(NEW.created_at, TIMEZONE('utc', NOW()))
      );
    WHEN '2024/2025' THEN
      INSERT INTO player_game_stats_2024_2025 (
        id, game_id, player_id, minutes, points,
        close_made, close_attempted, mid_made, mid_attempted,
        three_made, three_attempted, free_throw_made, free_throw_attempted,
        offensive_rebounds, defensive_rebounds, total_rebounds,
        assists, steals, blocks, turnovers, fouls_committed,
        fouls_drawn, blocks_suffered, blocks_given,
        plus_minus, valuation, offensive_rating, defensive_rating,
        true_shooting_percentage, effective_field_goal_percentage,
        is_starter, created_at
      ) VALUES (
        COALESCE(NEW.id, gen_random_uuid()), NEW.game_id, NEW.player_id,
        NEW.minutes, NEW.points, NEW.close_made, NEW.close_attempted,
        NEW.mid_made, NEW.mid_attempted, NEW.three_made, NEW.three_attempted,
        NEW.free_throw_made, NEW.free_throw_attempted,
        NEW.offensive_rebounds, NEW.defensive_rebounds, NEW.total_rebounds,
        NEW.assists, NEW.steals, NEW.blocks, NEW.turnovers, NEW.fouls_committed,
        COALESCE(NEW.fouls_drawn, 0), COALESCE(NEW.blocks_suffered, 0), COALESCE(NEW.blocks_given, 0),
        NEW.plus_minus, NEW.valuation, NEW.offensive_rating, NEW.defensive_rating,
        NEW.true_shooting_percentage, NEW.effective_field_goal_percentage,
        NEW.is_starter, COALESCE(NEW.created_at, TIMEZONE('utc', NOW()))
      );
    WHEN '2025/2026' THEN
      INSERT INTO player_game_stats_2025_2026 (
        id, game_id, player_id, minutes, points,
        close_made, close_attempted, mid_made, mid_attempted,
        three_made, three_attempted, free_throw_made, free_throw_attempted,
        offensive_rebounds, defensive_rebounds, total_rebounds,
        assists, steals, blocks, turnovers, fouls_committed,
        fouls_drawn, blocks_suffered, blocks_given,
        plus_minus, valuation, offensive_rating, defensive_rating,
        true_shooting_percentage, effective_field_goal_percentage,
        is_starter, created_at
      ) VALUES (
        COALESCE(NEW.id, gen_random_uuid()), NEW.game_id, NEW.player_id,
        NEW.minutes, NEW.points, NEW.close_made, NEW.close_attempted,
        NEW.mid_made, NEW.mid_attempted, NEW.three_made, NEW.three_attempted,
        NEW.free_throw_made, NEW.free_throw_attempted,
        NEW.offensive_rebounds, NEW.defensive_rebounds, NEW.total_rebounds,
        NEW.assists, NEW.steals, NEW.blocks, NEW.turnovers, NEW.fouls_committed,
        COALESCE(NEW.fouls_drawn, 0), COALESCE(NEW.blocks_suffered, 0), COALESCE(NEW.blocks_given, 0),
        NEW.plus_minus, NEW.valuation, NEW.offensive_rating, NEW.defensive_rating,
        NEW.true_shooting_percentage, NEW.effective_field_goal_percentage,
        NEW.is_starter, COALESCE(NEW.created_at, TIMEZONE('utc', NOW()))
      );
    WHEN '2026/2027' THEN
      INSERT INTO player_game_stats_2026_2027 (
        id, game_id, player_id, minutes, points,
        close_made, close_attempted, mid_made, mid_attempted,
        three_made, three_attempted, free_throw_made, free_throw_attempted,
        offensive_rebounds, defensive_rebounds, total_rebounds,
        assists, steals, blocks, turnovers, fouls_committed,
        fouls_drawn, blocks_suffered, blocks_given,
        plus_minus, valuation, offensive_rating, defensive_rating,
        true_shooting_percentage, effective_field_goal_percentage,
        is_starter, created_at
      ) VALUES (
        COALESCE(NEW.id, gen_random_uuid()), NEW.game_id, NEW.player_id,
        NEW.minutes, NEW.points, NEW.close_made, NEW.close_attempted,
        NEW.mid_made, NEW.mid_attempted, NEW.three_made, NEW.three_attempted,
        NEW.free_throw_made, NEW.free_throw_attempted,
        NEW.offensive_rebounds, NEW.defensive_rebounds, NEW.total_rebounds,
        NEW.assists, NEW.steals, NEW.blocks, NEW.turnovers, NEW.fouls_committed,
        COALESCE(NEW.fouls_drawn, 0), COALESCE(NEW.blocks_suffered, 0), COALESCE(NEW.blocks_given, 0),
        NEW.plus_minus, NEW.valuation, NEW.offensive_rating, NEW.defensive_rating,
        NEW.true_shooting_percentage, NEW.effective_field_goal_percentage,
        NEW.is_starter, COALESCE(NEW.created_at, TIMEZONE('utc', NOW()))
      );
    ELSE
      RAISE EXCEPTION 'Ismeretlen szezon: %. Adj hozzá új táblát és trigger ágat!', v_season_name;
  END CASE;

  RETURN NEW;
END;
$$;

CREATE TRIGGER pgs_insert
  INSTEAD OF INSERT ON player_game_stats
  FOR EACH ROW
  EXECUTE FUNCTION route_pgs_insert();

-- 4b. DELETE trigger

CREATE OR REPLACE FUNCTION route_pgs_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM player_game_stats_2023_2024 WHERE id = OLD.id;
  DELETE FROM player_game_stats_2024_2025 WHERE id = OLD.id;
  DELETE FROM player_game_stats_2025_2026 WHERE id = OLD.id;
  DELETE FROM player_game_stats_2026_2027 WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER pgs_delete
  INSTEAD OF DELETE ON player_game_stats
  FOR EACH ROW
  EXECUTE FUNCTION route_pgs_delete();

-- 4c. UPDATE trigger

CREATE OR REPLACE FUNCTION route_pgs_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE player_game_stats_2023_2024 SET
    game_id = NEW.game_id, player_id = NEW.player_id, minutes = NEW.minutes,
    points = NEW.points, close_made = NEW.close_made, close_attempted = NEW.close_attempted,
    mid_made = NEW.mid_made, mid_attempted = NEW.mid_attempted,
    three_made = NEW.three_made, three_attempted = NEW.three_attempted,
    free_throw_made = NEW.free_throw_made, free_throw_attempted = NEW.free_throw_attempted,
    offensive_rebounds = NEW.offensive_rebounds, defensive_rebounds = NEW.defensive_rebounds,
    total_rebounds = NEW.total_rebounds, assists = NEW.assists, steals = NEW.steals,
    blocks = NEW.blocks, turnovers = NEW.turnovers, fouls_committed = NEW.fouls_committed,
    fouls_drawn = NEW.fouls_drawn, blocks_suffered = NEW.blocks_suffered,
    blocks_given = NEW.blocks_given, plus_minus = NEW.plus_minus, valuation = NEW.valuation,
    offensive_rating = NEW.offensive_rating, defensive_rating = NEW.defensive_rating,
    true_shooting_percentage = NEW.true_shooting_percentage,
    effective_field_goal_percentage = NEW.effective_field_goal_percentage,
    is_starter = NEW.is_starter
  WHERE id = OLD.id;

  UPDATE player_game_stats_2024_2025 SET
    game_id = NEW.game_id, player_id = NEW.player_id, minutes = NEW.minutes,
    points = NEW.points, close_made = NEW.close_made, close_attempted = NEW.close_attempted,
    mid_made = NEW.mid_made, mid_attempted = NEW.mid_attempted,
    three_made = NEW.three_made, three_attempted = NEW.three_attempted,
    free_throw_made = NEW.free_throw_made, free_throw_attempted = NEW.free_throw_attempted,
    offensive_rebounds = NEW.offensive_rebounds, defensive_rebounds = NEW.defensive_rebounds,
    total_rebounds = NEW.total_rebounds, assists = NEW.assists, steals = NEW.steals,
    blocks = NEW.blocks, turnovers = NEW.turnovers, fouls_committed = NEW.fouls_committed,
    fouls_drawn = NEW.fouls_drawn, blocks_suffered = NEW.blocks_suffered,
    blocks_given = NEW.blocks_given, plus_minus = NEW.plus_minus, valuation = NEW.valuation,
    offensive_rating = NEW.offensive_rating, defensive_rating = NEW.defensive_rating,
    true_shooting_percentage = NEW.true_shooting_percentage,
    effective_field_goal_percentage = NEW.effective_field_goal_percentage,
    is_starter = NEW.is_starter
  WHERE id = OLD.id;

  UPDATE player_game_stats_2025_2026 SET
    game_id = NEW.game_id, player_id = NEW.player_id, minutes = NEW.minutes,
    points = NEW.points, close_made = NEW.close_made, close_attempted = NEW.close_attempted,
    mid_made = NEW.mid_made, mid_attempted = NEW.mid_attempted,
    three_made = NEW.three_made, three_attempted = NEW.three_attempted,
    free_throw_made = NEW.free_throw_made, free_throw_attempted = NEW.free_throw_attempted,
    offensive_rebounds = NEW.offensive_rebounds, defensive_rebounds = NEW.defensive_rebounds,
    total_rebounds = NEW.total_rebounds, assists = NEW.assists, steals = NEW.steals,
    blocks = NEW.blocks, turnovers = NEW.turnovers, fouls_committed = NEW.fouls_committed,
    fouls_drawn = NEW.fouls_drawn, blocks_suffered = NEW.blocks_suffered,
    blocks_given = NEW.blocks_given, plus_minus = NEW.plus_minus, valuation = NEW.valuation,
    offensive_rating = NEW.offensive_rating, defensive_rating = NEW.defensive_rating,
    true_shooting_percentage = NEW.true_shooting_percentage,
    effective_field_goal_percentage = NEW.effective_field_goal_percentage,
    is_starter = NEW.is_starter
  WHERE id = OLD.id;

  UPDATE player_game_stats_2026_2027 SET
    game_id = NEW.game_id, player_id = NEW.player_id, minutes = NEW.minutes,
    points = NEW.points, close_made = NEW.close_made, close_attempted = NEW.close_attempted,
    mid_made = NEW.mid_made, mid_attempted = NEW.mid_attempted,
    three_made = NEW.three_made, three_attempted = NEW.three_attempted,
    free_throw_made = NEW.free_throw_made, free_throw_attempted = NEW.free_throw_attempted,
    offensive_rebounds = NEW.offensive_rebounds, defensive_rebounds = NEW.defensive_rebounds,
    total_rebounds = NEW.total_rebounds, assists = NEW.assists, steals = NEW.steals,
    blocks = NEW.blocks, turnovers = NEW.turnovers, fouls_committed = NEW.fouls_committed,
    fouls_drawn = NEW.fouls_drawn, blocks_suffered = NEW.blocks_suffered,
    blocks_given = NEW.blocks_given, plus_minus = NEW.plus_minus, valuation = NEW.valuation,
    offensive_rating = NEW.offensive_rating, defensive_rating = NEW.defensive_rating,
    true_shooting_percentage = NEW.true_shooting_percentage,
    effective_field_goal_percentage = NEW.effective_field_goal_percentage,
    is_starter = NEW.is_starter
  WHERE id = OLD.id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER pgs_update
  INSTEAD OF UPDATE ON player_game_stats
  FOR EACH ROW
  EXECUTE FUNCTION route_pgs_update();

-- ============================================================
-- 5. PLAYER_SEASON_STATS_BY_SEASON VIEW FRISSÍTÉSE
-- ============================================================

DROP VIEW IF EXISTS player_season_stats CASCADE;
DROP VIEW IF EXISTS player_season_stats_by_season CASCADE;

CREATE VIEW player_season_stats_by_season
WITH (security_invoker = true)
AS
SELECT
  p.id as player_id,
  p.name,
  p.number,
  p.position,
  p.birth_year,
  p.height,
  p.weight,
  p.team_id,
  p.is_active,
  t.name as team_name,
  t.short_name as team_short_name,
  s.id as season_id,
  s.name as season_name,
  s.is_current,
  COUNT(DISTINCT pgs.game_id) as games_played,
  SUM(pgs.points) as total_points,
  SUM(pgs.minutes) as total_minutes,
  SUM(pgs.close_made) as total_close_made,
  SUM(pgs.close_attempted) as total_close_attempted,
  SUM(pgs.mid_made) as total_mid_made,
  SUM(pgs.mid_attempted) as total_mid_attempted,
  SUM(pgs.three_made) as total_three_made,
  SUM(pgs.three_attempted) as total_three_attempted,
  SUM(pgs.free_throw_made) as total_free_throw_made,
  SUM(pgs.free_throw_attempted) as total_free_throw_attempted,
  SUM(pgs.offensive_rebounds) as total_offensive_rebounds,
  SUM(pgs.defensive_rebounds) as total_defensive_rebounds,
  SUM(pgs.total_rebounds) as total_rebounds,
  SUM(pgs.assists) as total_assists,
  SUM(pgs.steals) as total_steals,
  SUM(pgs.blocks) as total_blocks,
  SUM(pgs.turnovers) as total_turnovers,
  SUM(pgs.fouls_committed) as total_fouls_committed,
  SUM(pgs.fouls_drawn) as total_fouls_drawn,
  SUM(pgs.plus_minus) as total_plus_minus,
  SUM(pgs.valuation) as total_valuation,
  COALESCE(ROUND(AVG(pgs.valuation)::numeric, 1), 0) as avg_valuation
FROM players p
INNER JOIN teams t ON p.team_id = t.id
INNER JOIN seasons s ON p.season_id = s.id
INNER JOIN (
  SELECT id, game_id, player_id, minutes, points,
    close_made, close_attempted, mid_made, mid_attempted,
    three_made, three_attempted, free_throw_made, free_throw_attempted,
    offensive_rebounds, defensive_rebounds, total_rebounds,
    assists, steals, blocks, turnovers, fouls_committed,
    fouls_drawn, blocks_suffered, blocks_given,
    plus_minus, valuation, offensive_rating, defensive_rating,
    true_shooting_percentage, effective_field_goal_percentage, is_starter
  FROM player_game_stats_2023_2024
  UNION ALL
  SELECT id, game_id, player_id, minutes, points,
    close_made, close_attempted, mid_made, mid_attempted,
    three_made, three_attempted, free_throw_made, free_throw_attempted,
    offensive_rebounds, defensive_rebounds, total_rebounds,
    assists, steals, blocks, turnovers, fouls_committed,
    fouls_drawn, blocks_suffered, blocks_given,
    plus_minus, valuation, offensive_rating, defensive_rating,
    true_shooting_percentage, effective_field_goal_percentage, is_starter
  FROM player_game_stats_2024_2025
  UNION ALL
  SELECT id, game_id, player_id, minutes, points,
    close_made, close_attempted, mid_made, mid_attempted,
    three_made, three_attempted, free_throw_made, free_throw_attempted,
    offensive_rebounds, defensive_rebounds, total_rebounds,
    assists, steals, blocks, turnovers, fouls_committed,
    fouls_drawn, blocks_suffered, blocks_given,
    plus_minus, valuation, offensive_rating, defensive_rating,
    true_shooting_percentage, effective_field_goal_percentage, is_starter
  FROM player_game_stats_2025_2026
  UNION ALL
  SELECT id, game_id, player_id, minutes, points,
    close_made, close_attempted, mid_made, mid_attempted,
    three_made, three_attempted, free_throw_made, free_throw_attempted,
    offensive_rebounds, defensive_rebounds, total_rebounds,
    assists, steals, blocks, turnovers, fouls_committed,
    fouls_drawn, blocks_suffered, blocks_given,
    plus_minus, valuation, offensive_rating, defensive_rating,
    true_shooting_percentage, effective_field_goal_percentage, is_starter
  FROM player_game_stats_2026_2027
) pgs ON p.id = pgs.player_id
INNER JOIN games g ON pgs.game_id = g.id
  AND g.season_id = s.id
  AND g.our_team_id = t.id
WHERE p.is_active = true
GROUP BY
  p.id, p.name, p.number, p.position, p.birth_year, p.height, p.weight,
  p.team_id, p.is_active, t.name, t.short_name, s.id, s.name, s.is_current;

GRANT SELECT ON player_season_stats_by_season TO anon, authenticated;

CREATE VIEW player_season_stats
WITH (security_invoker = true)
AS
SELECT
  player_id, name, number, position, birth_year, height, weight,
  season_id, team_id, is_active, team_name, team_short_name,
  games_played, total_points, total_minutes,
  total_close_made, total_close_attempted,
  total_mid_made, total_mid_attempted,
  total_three_made, total_three_attempted,
  total_free_throw_made, total_free_throw_attempted,
  total_offensive_rebounds, total_defensive_rebounds, total_rebounds,
  total_assists, total_steals, total_blocks, total_turnovers,
  total_fouls_committed, total_fouls_drawn,
  total_plus_minus, total_valuation, avg_valuation
FROM player_season_stats_by_season
WHERE is_current = true;

GRANT SELECT ON player_season_stats TO anon, authenticated;

-- ============================================================
-- 6. ÚJ SZEZON A SEASONS TÁBLÁBAN
-- ============================================================
-- FIGYELEM: A 2025/2026 szezon is_current értékét csak akkor
-- állítsd false-ra, ha a 2026/2027 szezon valóban megkezdődött!
-- Most csak az új szezont adjuk hozzá.

INSERT INTO seasons (name, start_date, end_date, is_current)
VALUES ('2026/2027', '2026-09-01', '2027-06-30', false)
ON CONFLICT (name) DO NOTHING;

-- Ha a szezon megkezdődött, futtasd ezt is:
-- UPDATE seasons SET is_current = false WHERE name = '2025/2026';
-- UPDATE seasons SET is_current = true  WHERE name = '2026/2027';

-- ============================================================
-- 7. ELLENŐRZÉS
-- ============================================================

SELECT
  name AS szezon,
  is_current,
  start_date,
  end_date
FROM seasons
ORDER BY start_date;
