-- Szezon támogatás hozzáadása az adatbázishoz
-- Ez lehetővé teszi a korábbi szezonok kezelését és összehasonlítását

-- 1. Szezonok tábla létrehozása
CREATE TABLE IF NOT EXISTS seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE, -- pl. "2024/2025", "2023/2024"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 2. Season mező hozzáadása a games táblához
ALTER TABLE games 
  ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES seasons(id) ON DELETE SET NULL;

-- 3. Index a gyorsabb szezon alapú lekérdezésekhez
CREATE INDEX IF NOT EXISTS idx_games_season_id ON games(season_id);

-- 4. Alapértelmezett szezon létrehozása (jelenlegi szezon)
INSERT INTO seasons (name, start_date, end_date, is_current)
VALUES ('2025/2026', '2025-09-01', '2026-05-31', true)
ON CONFLICT (name) DO NOTHING;

-- 5. Meglévő meccsek hozzárendelése a jelenlegi szezonhoz
UPDATE games 
SET season_id = (SELECT id FROM seasons WHERE is_current = true LIMIT 1)
WHERE season_id IS NULL;

-- 6. Trigger: csak egy szezon lehet current egyszerre
CREATE OR REPLACE FUNCTION ensure_single_current_season()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_current = true THEN
    UPDATE seasons SET is_current = false WHERE id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ensure_single_current_season ON seasons;

CREATE TRIGGER trigger_ensure_single_current_season
  BEFORE INSERT OR UPDATE ON seasons
  FOR EACH ROW
  WHEN (NEW.is_current = true)
  EXECUTE FUNCTION ensure_single_current_season();

-- 7. Updated_at trigger a seasons táblához
DROP TRIGGER IF EXISTS update_seasons_updated_at ON seasons;

CREATE TRIGGER update_seasons_updated_at 
  BEFORE UPDATE ON seasons
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- 8. View frissítése: szezon specifikus statisztikák
-- FONTOS: INNER JOIN-t használunk, hogy csak azokat a játékosokat mutassuk, akik játszottak az adott szezonban
-- FONTOS: A játékosok is szezon-specifikusak (players.season_id = seasons.id)
CREATE OR REPLACE VIEW player_season_stats_by_season
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
  s.id as season_id,
  s.name as season_name,
  s.is_current,
  COUNT(DISTINCT pgs.game_id) as games_played,
  SUM(pgs.points) as total_points,
  SUM(pgs.minutes) as total_minutes,
  
  -- Dobások
  SUM(pgs.close_made) as total_close_made,
  SUM(pgs.close_attempted) as total_close_attempted,
  SUM(pgs.mid_made) as total_mid_made,
  SUM(pgs.mid_attempted) as total_mid_attempted,
  SUM(pgs.three_made) as total_three_made,
  SUM(pgs.three_attempted) as total_three_attempted,
  SUM(pgs.free_throw_made) as total_free_throw_made,
  SUM(pgs.free_throw_attempted) as total_free_throw_attempted,
  
  -- Lepattanók
  SUM(pgs.offensive_rebounds) as total_offensive_rebounds,
  SUM(pgs.defensive_rebounds) as total_defensive_rebounds,
  SUM(pgs.total_rebounds) as total_rebounds,
  
  -- Egyéb statisztikák
  SUM(pgs.assists) as total_assists,
  SUM(pgs.steals) as total_steals,
  SUM(pgs.blocks) as total_blocks,
  SUM(pgs.turnovers) as total_turnovers,
  SUM(pgs.fouls_committed) as total_fouls_committed,
  SUM(pgs.plus_minus) as total_plus_minus,
  SUM(pgs.valuation) as total_valuation
FROM 
  players p
  INNER JOIN seasons s ON p.season_id = s.id
  INNER JOIN player_game_stats pgs ON p.id = pgs.player_id
  INNER JOIN games g ON pgs.game_id = g.id AND g.season_id = s.id
GROUP BY 
  p.id, p.name, p.number, p.position, p.birth_year, p.height, p.weight, s.id, s.name, s.is_current;

-- 9. Jogosultságok beállítása
GRANT SELECT ON seasons TO anon, authenticated;
GRANT SELECT ON player_season_stats_by_season TO anon, authenticated;

-- 10. RLS policy a seasons táblához
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON seasons;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON seasons;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON seasons;

CREATE POLICY "Enable read access for all users" ON seasons
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON seasons
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users only" ON seasons
  FOR UPDATE USING (auth.role() = 'authenticated');

-- 11. Töröljük és újra létrehozzuk az eredeti player_season_stats view-t
-- Most csak a jelenlegi szezont mutatja
DROP VIEW IF EXISTS player_season_stats CASCADE;

CREATE VIEW player_season_stats 
WITH (security_invoker = true)
AS
SELECT 
  player_id,
  name,
  number,
  position,
  games_played,
  total_points,
  total_minutes,
  total_close_made,
  total_close_attempted,
  total_mid_made,
  total_mid_attempted,
  total_three_made,
  total_three_attempted,
  total_free_throw_made,
  total_free_throw_attempted,
  total_offensive_rebounds,
  total_defensive_rebounds,
  total_rebounds,
  total_assists,
  total_steals,
  total_blocks,
  total_turnovers,
  total_fouls_committed,
  total_plus_minus,
  total_valuation
FROM player_season_stats_by_season
WHERE is_current = true;

GRANT SELECT ON player_season_stats TO anon, authenticated;
