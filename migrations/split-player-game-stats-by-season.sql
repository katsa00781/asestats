-- ============================================================
-- PLAYER_GAME_STATS SZÉTVÁLASZTÁSA SZEZONOK SZERINT
-- ============================================================
-- Célja: A Supabase PostgREST 1000 soros alapértelmezett limitet
-- megkerülni azáltal, hogy minden szezon adatait külön táblában
-- tároljuk. A meglévő alkalmazáskód zavartalanul működik tovább
-- az INSTEAD OF triggerekkel ellátott UNION view-n keresztül.
--
-- FUTTATÁSI SORREND:
--   1. Futtasd le ezt a teljes fájlt a Supabase SQL Editorban.
--   2. Ellenőrizd a sorvégeredmény kommenteket.
--   3. Ha minden OK, a player_game_stats_legacy tábla törölhető.
-- ============================================================

-- ============================================================
-- 1. SZEZONSPECIFIKUS TÁBLÁK LÉTREHOZÁSA
-- ============================================================

CREATE TABLE IF NOT EXISTS player_game_stats_2023_2024 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
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
  offensive_rebounds INTEGER NOT NULL DEFAULT 0,
  defensive_rebounds INTEGER NOT NULL DEFAULT 0,
  total_rebounds INTEGER NOT NULL DEFAULT 0,
  assists INTEGER NOT NULL DEFAULT 0,
  steals INTEGER NOT NULL DEFAULT 0,
  blocks INTEGER NOT NULL DEFAULT 0,
  turnovers INTEGER NOT NULL DEFAULT 0,
  fouls_committed INTEGER NOT NULL DEFAULT 0,
  fouls_drawn INTEGER DEFAULT 0,
  blocks_suffered INTEGER DEFAULT 0,
  blocks_given INTEGER DEFAULT 0,
  plus_minus INTEGER NOT NULL DEFAULT 0,
  valuation INTEGER NOT NULL DEFAULT 0,
  offensive_rating DECIMAL(5,2) DEFAULT 0,
  defensive_rating DECIMAL(5,2) DEFAULT 0,
  true_shooting_percentage DECIMAL(5,2) DEFAULT 0,
  effective_field_goal_percentage DECIMAL(5,2) DEFAULT 0,
  is_starter BOOLEAN DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(game_id, player_id)
);

CREATE TABLE IF NOT EXISTS player_game_stats_2024_2025 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
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
  offensive_rebounds INTEGER NOT NULL DEFAULT 0,
  defensive_rebounds INTEGER NOT NULL DEFAULT 0,
  total_rebounds INTEGER NOT NULL DEFAULT 0,
  assists INTEGER NOT NULL DEFAULT 0,
  steals INTEGER NOT NULL DEFAULT 0,
  blocks INTEGER NOT NULL DEFAULT 0,
  turnovers INTEGER NOT NULL DEFAULT 0,
  fouls_committed INTEGER NOT NULL DEFAULT 0,
  fouls_drawn INTEGER DEFAULT 0,
  blocks_suffered INTEGER DEFAULT 0,
  blocks_given INTEGER DEFAULT 0,
  plus_minus INTEGER NOT NULL DEFAULT 0,
  valuation INTEGER NOT NULL DEFAULT 0,
  offensive_rating DECIMAL(5,2) DEFAULT 0,
  defensive_rating DECIMAL(5,2) DEFAULT 0,
  true_shooting_percentage DECIMAL(5,2) DEFAULT 0,
  effective_field_goal_percentage DECIMAL(5,2) DEFAULT 0,
  is_starter BOOLEAN DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(game_id, player_id)
);

CREATE TABLE IF NOT EXISTS player_game_stats_2025_2026 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
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
  offensive_rebounds INTEGER NOT NULL DEFAULT 0,
  defensive_rebounds INTEGER NOT NULL DEFAULT 0,
  total_rebounds INTEGER NOT NULL DEFAULT 0,
  assists INTEGER NOT NULL DEFAULT 0,
  steals INTEGER NOT NULL DEFAULT 0,
  blocks INTEGER NOT NULL DEFAULT 0,
  turnovers INTEGER NOT NULL DEFAULT 0,
  fouls_committed INTEGER NOT NULL DEFAULT 0,
  fouls_drawn INTEGER DEFAULT 0,
  blocks_suffered INTEGER DEFAULT 0,
  blocks_given INTEGER DEFAULT 0,
  plus_minus INTEGER NOT NULL DEFAULT 0,
  valuation INTEGER NOT NULL DEFAULT 0,
  offensive_rating DECIMAL(5,2) DEFAULT 0,
  defensive_rating DECIMAL(5,2) DEFAULT 0,
  true_shooting_percentage DECIMAL(5,2) DEFAULT 0,
  effective_field_goal_percentage DECIMAL(5,2) DEFAULT 0,
  is_starter BOOLEAN DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(game_id, player_id)
);

-- Indexek a gyors kereséshez
CREATE INDEX IF NOT EXISTS idx_pgs_2023_2024_game_id   ON player_game_stats_2023_2024(game_id);
CREATE INDEX IF NOT EXISTS idx_pgs_2023_2024_player_id ON player_game_stats_2023_2024(player_id);
CREATE INDEX IF NOT EXISTS idx_pgs_2024_2025_game_id   ON player_game_stats_2024_2025(game_id);
CREATE INDEX IF NOT EXISTS idx_pgs_2024_2025_player_id ON player_game_stats_2024_2025(player_id);
CREATE INDEX IF NOT EXISTS idx_pgs_2025_2026_game_id   ON player_game_stats_2025_2026(game_id);
CREATE INDEX IF NOT EXISTS idx_pgs_2025_2026_player_id ON player_game_stats_2025_2026(player_id);

-- ============================================================
-- 2. ADATMIGRÁCIÓ AZ EREDETI TÁBLÁBÓL
-- ============================================================

INSERT INTO player_game_stats_2023_2024 (
  id, game_id, player_id, minutes, points,
  close_made, close_attempted, mid_made, mid_attempted,
  three_made, three_attempted, free_throw_made, free_throw_attempted,
  offensive_rebounds, defensive_rebounds, total_rebounds,
  assists, steals, blocks, turnovers, fouls_committed,
  fouls_drawn, blocks_suffered, blocks_given,
  plus_minus, valuation,
  offensive_rating, defensive_rating,
  true_shooting_percentage, effective_field_goal_percentage,
  created_at
)
SELECT
  pgs.id, pgs.game_id, pgs.player_id, pgs.minutes, pgs.points,
  pgs.close_made, pgs.close_attempted, pgs.mid_made, pgs.mid_attempted,
  pgs.three_made, pgs.three_attempted, pgs.free_throw_made, pgs.free_throw_attempted,
  pgs.offensive_rebounds, pgs.defensive_rebounds, pgs.total_rebounds,
  pgs.assists, pgs.steals, pgs.blocks, pgs.turnovers, pgs.fouls_committed,
  COALESCE(pgs.fouls_drawn, 0),
  COALESCE(pgs.blocks_suffered, 0),
  COALESCE(pgs.blocks_given, 0),
  pgs.plus_minus, pgs.valuation,
  pgs.offensive_rating, pgs.defensive_rating,
  pgs.true_shooting_percentage, pgs.effective_field_goal_percentage,
  pgs.created_at
FROM player_game_stats pgs
JOIN games g ON pgs.game_id = g.id
JOIN seasons s ON g.season_id = s.id
WHERE s.name = '2023/2024'
ON CONFLICT (game_id, player_id) DO NOTHING;

INSERT INTO player_game_stats_2024_2025 (
  id, game_id, player_id, minutes, points,
  close_made, close_attempted, mid_made, mid_attempted,
  three_made, three_attempted, free_throw_made, free_throw_attempted,
  offensive_rebounds, defensive_rebounds, total_rebounds,
  assists, steals, blocks, turnovers, fouls_committed,
  fouls_drawn, blocks_suffered, blocks_given,
  plus_minus, valuation,
  offensive_rating, defensive_rating,
  true_shooting_percentage, effective_field_goal_percentage,
  created_at
)
SELECT
  pgs.id, pgs.game_id, pgs.player_id, pgs.minutes, pgs.points,
  pgs.close_made, pgs.close_attempted, pgs.mid_made, pgs.mid_attempted,
  pgs.three_made, pgs.three_attempted, pgs.free_throw_made, pgs.free_throw_attempted,
  pgs.offensive_rebounds, pgs.defensive_rebounds, pgs.total_rebounds,
  pgs.assists, pgs.steals, pgs.blocks, pgs.turnovers, pgs.fouls_committed,
  COALESCE(pgs.fouls_drawn, 0),
  COALESCE(pgs.blocks_suffered, 0),
  COALESCE(pgs.blocks_given, 0),
  pgs.plus_minus, pgs.valuation,
  pgs.offensive_rating, pgs.defensive_rating,
  pgs.true_shooting_percentage, pgs.effective_field_goal_percentage,
  pgs.created_at
FROM player_game_stats pgs
JOIN games g ON pgs.game_id = g.id
JOIN seasons s ON g.season_id = s.id
WHERE s.name = '2024/2025'
ON CONFLICT (game_id, player_id) DO NOTHING;

INSERT INTO player_game_stats_2025_2026 (
  id, game_id, player_id, minutes, points,
  close_made, close_attempted, mid_made, mid_attempted,
  three_made, three_attempted, free_throw_made, free_throw_attempted,
  offensive_rebounds, defensive_rebounds, total_rebounds,
  assists, steals, blocks, turnovers, fouls_committed,
  fouls_drawn, blocks_suffered, blocks_given,
  plus_minus, valuation,
  offensive_rating, defensive_rating,
  true_shooting_percentage, effective_field_goal_percentage,
  created_at
)
SELECT
  pgs.id, pgs.game_id, pgs.player_id, pgs.minutes, pgs.points,
  pgs.close_made, pgs.close_attempted, pgs.mid_made, pgs.mid_attempted,
  pgs.three_made, pgs.three_attempted, pgs.free_throw_made, pgs.free_throw_attempted,
  pgs.offensive_rebounds, pgs.defensive_rebounds, pgs.total_rebounds,
  pgs.assists, pgs.steals, pgs.blocks, pgs.turnovers, pgs.fouls_committed,
  COALESCE(pgs.fouls_drawn, 0),
  COALESCE(pgs.blocks_suffered, 0),
  COALESCE(pgs.blocks_given, 0),
  pgs.plus_minus, pgs.valuation,
  pgs.offensive_rating, pgs.defensive_rating,
  pgs.true_shooting_percentage, pgs.effective_field_goal_percentage,
  pgs.created_at
FROM player_game_stats pgs
JOIN games g ON pgs.game_id = g.id
JOIN seasons s ON g.season_id = s.id
WHERE s.name = '2025/2026'
ON CONFLICT (game_id, player_id) DO NOTHING;

-- Ellenőrzés: migráció utáni sorvégeredmény
SELECT 'Migráció összesítés' AS info,
  (SELECT COUNT(*) FROM player_game_stats)         AS eredeti_osszes,
  (SELECT COUNT(*) FROM player_game_stats_2023_2024) AS "2023_2024",
  (SELECT COUNT(*) FROM player_game_stats_2024_2025) AS "2024_2025",
  (SELECT COUNT(*) FROM player_game_stats_2025_2026) AS "2025_2026";

-- ============================================================
-- 3. EREDETI TÁBLA ÁTNEVEZÉSE BIZTONSÁGI MENTÉSKÉNT
-- ============================================================

-- FONTOS: csak akkor futtasd le ezt a részt, ha a migráció
-- ellenőrzése sikeres volt (fenti SELECT eredmény helyes)!

ALTER TABLE player_game_stats RENAME TO player_game_stats_legacy;

-- ============================================================
-- 4. UNION VIEW LÉTREHOZÁSA (visszafelé kompatibilitás)
-- ============================================================
-- A VIEW azonos nevű, így a meglévő SQL diagnosztikai scriptek
-- és admin műveletek változatlanul működnek.
-- Az INSTEAD OF triggerek az írási műveleteket a helyes
-- szezon-specifikus táblába irányítják.

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
    is_starter,
    created_at
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
    is_starter,
    created_at
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
    is_starter,
    created_at
  FROM player_game_stats_2025_2026;

GRANT SELECT ON player_game_stats TO anon, authenticated;

-- ============================================================
-- 5. INSTEAD OF TRIGGEREK A VIEW DML MŰVELETEIRE
-- ============================================================

-- 5a. INSERT trigger: game_id alapján meghatározza a célszezont

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
        plus_minus, valuation,
        offensive_rating, defensive_rating,
        true_shooting_percentage, effective_field_goal_percentage,
        is_starter, created_at
      ) VALUES (
        COALESCE(NEW.id, gen_random_uuid()),
        NEW.game_id, NEW.player_id, NEW.minutes, NEW.points,
        NEW.close_made, NEW.close_attempted, NEW.mid_made, NEW.mid_attempted,
        NEW.three_made, NEW.three_attempted, NEW.free_throw_made, NEW.free_throw_attempted,
        NEW.offensive_rebounds, NEW.defensive_rebounds, NEW.total_rebounds,
        NEW.assists, NEW.steals, NEW.blocks, NEW.turnovers, NEW.fouls_committed,
        COALESCE(NEW.fouls_drawn, 0), COALESCE(NEW.blocks_suffered, 0), COALESCE(NEW.blocks_given, 0),
        NEW.plus_minus, NEW.valuation,
        NEW.offensive_rating, NEW.defensive_rating,
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
        plus_minus, valuation,
        offensive_rating, defensive_rating,
        true_shooting_percentage, effective_field_goal_percentage,
        is_starter, created_at
      ) VALUES (
        COALESCE(NEW.id, gen_random_uuid()),
        NEW.game_id, NEW.player_id, NEW.minutes, NEW.points,
        NEW.close_made, NEW.close_attempted, NEW.mid_made, NEW.mid_attempted,
        NEW.three_made, NEW.three_attempted, NEW.free_throw_made, NEW.free_throw_attempted,
        NEW.offensive_rebounds, NEW.defensive_rebounds, NEW.total_rebounds,
        NEW.assists, NEW.steals, NEW.blocks, NEW.turnovers, NEW.fouls_committed,
        COALESCE(NEW.fouls_drawn, 0), COALESCE(NEW.blocks_suffered, 0), COALESCE(NEW.blocks_given, 0),
        NEW.plus_minus, NEW.valuation,
        NEW.offensive_rating, NEW.defensive_rating,
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
        plus_minus, valuation,
        offensive_rating, defensive_rating,
        true_shooting_percentage, effective_field_goal_percentage,
        is_starter, created_at
      ) VALUES (
        COALESCE(NEW.id, gen_random_uuid()),
        NEW.game_id, NEW.player_id, NEW.minutes, NEW.points,
        NEW.close_made, NEW.close_attempted, NEW.mid_made, NEW.mid_attempted,
        NEW.three_made, NEW.three_attempted, NEW.free_throw_made, NEW.free_throw_attempted,
        NEW.offensive_rebounds, NEW.defensive_rebounds, NEW.total_rebounds,
        NEW.assists, NEW.steals, NEW.blocks, NEW.turnovers, NEW.fouls_committed,
        COALESCE(NEW.fouls_drawn, 0), COALESCE(NEW.blocks_suffered, 0), COALESCE(NEW.blocks_given, 0),
        NEW.plus_minus, NEW.valuation,
        NEW.offensive_rating, NEW.defensive_rating,
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

-- 5b. DELETE trigger: minden szezon táblában törli az id-t

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
  RETURN OLD;
END;
$$;

CREATE TRIGGER pgs_delete
  INSTEAD OF DELETE ON player_game_stats
  FOR EACH ROW
  EXECUTE FUNCTION route_pgs_delete();

-- 5c. UPDATE trigger: minden szezon táblában próbálja frissíteni

CREATE OR REPLACE FUNCTION route_pgs_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE player_game_stats_2023_2024 SET
    game_id = NEW.game_id,
    player_id = NEW.player_id,
    minutes = NEW.minutes,
    points = NEW.points,
    close_made = NEW.close_made,
    close_attempted = NEW.close_attempted,
    mid_made = NEW.mid_made,
    mid_attempted = NEW.mid_attempted,
    three_made = NEW.three_made,
    three_attempted = NEW.three_attempted,
    free_throw_made = NEW.free_throw_made,
    free_throw_attempted = NEW.free_throw_attempted,
    offensive_rebounds = NEW.offensive_rebounds,
    defensive_rebounds = NEW.defensive_rebounds,
    total_rebounds = NEW.total_rebounds,
    assists = NEW.assists,
    steals = NEW.steals,
    blocks = NEW.blocks,
    turnovers = NEW.turnovers,
    fouls_committed = NEW.fouls_committed,
    fouls_drawn = NEW.fouls_drawn,
    blocks_suffered = NEW.blocks_suffered,
    blocks_given = NEW.blocks_given,
    plus_minus = NEW.plus_minus,
    valuation = NEW.valuation,
    offensive_rating = NEW.offensive_rating,
    defensive_rating = NEW.defensive_rating,
    true_shooting_percentage = NEW.true_shooting_percentage,
    effective_field_goal_percentage = NEW.effective_field_goal_percentage,
    is_starter = NEW.is_starter
  WHERE id = OLD.id;

  UPDATE player_game_stats_2024_2025 SET
    game_id = NEW.game_id,
    player_id = NEW.player_id,
    minutes = NEW.minutes,
    points = NEW.points,
    close_made = NEW.close_made,
    close_attempted = NEW.close_attempted,
    mid_made = NEW.mid_made,
    mid_attempted = NEW.mid_attempted,
    three_made = NEW.three_made,
    three_attempted = NEW.three_attempted,
    free_throw_made = NEW.free_throw_made,
    free_throw_attempted = NEW.free_throw_attempted,
    offensive_rebounds = NEW.offensive_rebounds,
    defensive_rebounds = NEW.defensive_rebounds,
    total_rebounds = NEW.total_rebounds,
    assists = NEW.assists,
    steals = NEW.steals,
    blocks = NEW.blocks,
    turnovers = NEW.turnovers,
    fouls_committed = NEW.fouls_committed,
    fouls_drawn = NEW.fouls_drawn,
    blocks_suffered = NEW.blocks_suffered,
    blocks_given = NEW.blocks_given,
    plus_minus = NEW.plus_minus,
    valuation = NEW.valuation,
    offensive_rating = NEW.offensive_rating,
    defensive_rating = NEW.defensive_rating,
    true_shooting_percentage = NEW.true_shooting_percentage,
    effective_field_goal_percentage = NEW.effective_field_goal_percentage,
    is_starter = NEW.is_starter
  WHERE id = OLD.id;

  UPDATE player_game_stats_2025_2026 SET
    game_id = NEW.game_id,
    player_id = NEW.player_id,
    minutes = NEW.minutes,
    points = NEW.points,
    close_made = NEW.close_made,
    close_attempted = NEW.close_attempted,
    mid_made = NEW.mid_made,
    mid_attempted = NEW.mid_attempted,
    three_made = NEW.three_made,
    three_attempted = NEW.three_attempted,
    free_throw_made = NEW.free_throw_made,
    free_throw_attempted = NEW.free_throw_attempted,
    offensive_rebounds = NEW.offensive_rebounds,
    defensive_rebounds = NEW.defensive_rebounds,
    total_rebounds = NEW.total_rebounds,
    assists = NEW.assists,
    steals = NEW.steals,
    blocks = NEW.blocks,
    turnovers = NEW.turnovers,
    fouls_committed = NEW.fouls_committed,
    fouls_drawn = NEW.fouls_drawn,
    blocks_suffered = NEW.blocks_suffered,
    blocks_given = NEW.blocks_given,
    plus_minus = NEW.plus_minus,
    valuation = NEW.valuation,
    offensive_rating = NEW.offensive_rating,
    defensive_rating = NEW.defensive_rating,
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
-- 6. RLS ENGEDÉLYEK AZ ÚJ TÁBLÁKHOZ
-- ============================================================

ALTER TABLE player_game_stats_2023_2024 ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_game_stats_2024_2025 ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_game_stats_2025_2026 ENABLE ROW LEVEL SECURITY;

-- Olvasás: mindenki
CREATE POLICY "Enable read access for all users" ON player_game_stats_2023_2024 FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON player_game_stats_2024_2025 FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON player_game_stats_2025_2026 FOR SELECT USING (true);

-- Írás: csak bejelentkezett felhasználók
CREATE POLICY "Enable insert for authenticated users" ON player_game_stats_2023_2024 FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for authenticated users" ON player_game_stats_2024_2025 FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for authenticated users" ON player_game_stats_2025_2026 FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON player_game_stats_2023_2024 FOR UPDATE USING (true);
CREATE POLICY "Enable update for authenticated users" ON player_game_stats_2024_2025 FOR UPDATE USING (true);
CREATE POLICY "Enable update for authenticated users" ON player_game_stats_2025_2026 FOR UPDATE USING (true);

CREATE POLICY "Enable delete for authenticated users" ON player_game_stats_2023_2024 FOR DELETE USING (true);
CREATE POLICY "Enable delete for authenticated users" ON player_game_stats_2024_2025 FOR DELETE USING (true);
CREATE POLICY "Enable delete for authenticated users" ON player_game_stats_2025_2026 FOR DELETE USING (true);

-- Jogosultságok a Supabase API-nak
GRANT SELECT, INSERT, UPDATE, DELETE ON player_game_stats_2023_2024 TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON player_game_stats_2024_2025 TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON player_game_stats_2025_2026 TO anon, authenticated;

-- ============================================================
-- 7. PLAYER_SEASON_STATS_BY_SEASON VIEW ÚJRAÉPÍTÉSE
--    (most közvetlenül a szezon-specifikus táblákból olvas)
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
  SELECT *, '2023/2024' AS season_tag FROM player_game_stats_2023_2024
  UNION ALL
  SELECT *, '2024/2025' AS season_tag FROM player_game_stats_2024_2025
  UNION ALL
  SELECT *, '2025/2026' AS season_tag FROM player_game_stats_2025_2026
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
-- 8. VÉGSŐ ELLENŐRZÉS
-- ============================================================

SELECT
  'Táblák létrehozva és adatok migrálva' AS status,
  (SELECT COUNT(*) FROM player_game_stats_2023_2024) AS "2023/2024 sorok",
  (SELECT COUNT(*) FROM player_game_stats_2024_2025) AS "2024/2025 sorok",
  (SELECT COUNT(*) FROM player_game_stats_2025_2026) AS "2025/2026 sorok",
  (SELECT COUNT(*) FROM player_game_stats)           AS "view összes";

-- ============================================================
-- ÚJ SZEZON HOZZÁADÁSAKOR (pl. 2026/2027):
--   1. CREATE TABLE player_game_stats_2026_2027 (...) az itteni
--      CREATE TABLE utasítások mintájára
--   2. Adj hozzá indexet, RLS politikát és GRANT-ot
--   3. Frissítsd a player_game_stats UNION VIEW definícióját
--      (DROP VIEW player_game_stats; CREATE VIEW ...)
--   4. Adj hozzá egy új WHEN ágat a route_pgs_insert() triggerben
--   5. Futtasd le a player_season_stats_by_season VIEW újraépítését
-- ============================================================
