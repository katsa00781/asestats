-- =====================================================
-- JÁTÉKOSOK ADATAINAK FRISSÍTÉSE
-- =====================================================
-- Ezt a szkriptet a Supabase SQL Editor-ban kell lefuttatni
-- https://supabase.com/dashboard/project/iipcpjczjjkwwifwzmut/sql/new

-- 1. OSZLOPOK HOZZÁADÁSA
-- =====================================================
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS birth_year INTEGER,
ADD COLUMN IF NOT EXISTS height INTEGER,
ADD COLUMN IF NOT EXISTS weight INTEGER;

-- A view-t törölni kell mielőtt módosítjuk a position oszlopot
DROP VIEW IF EXISTS player_season_stats;

-- Töröljük a position oszlop CHECK constraint-jét
ALTER TABLE players 
DROP CONSTRAINT IF EXISTS players_position_check;

-- Növeljük a position oszlop hosszát a magyar fordításoknak
ALTER TABLE players 
ALTER COLUMN position TYPE VARCHAR(100);

-- View újralétrehozása
CREATE OR REPLACE VIEW player_season_stats 
WITH (security_invoker=true) 
AS
SELECT 
  p.id,
  p.name,
  p.number,
  p.position,
  p.birth_year,
  p.height,
  p.weight,
  COUNT(DISTINCT pgs.game_id) as games_played,
  COALESCE(SUM(pgs.points), 0) as total_points,
  COALESCE(ROUND(AVG(pgs.points)::numeric, 1), 0) as avg_points,
  COALESCE(SUM(pgs.minutes), 0) as total_minutes,
  COALESCE(ROUND(AVG(pgs.minutes)::numeric, 1), 0) as avg_minutes,
  COALESCE(SUM(pgs.close_made), 0) as total_close_made,
  COALESCE(SUM(pgs.close_attempted), 0) as total_close_attempted,
  COALESCE(SUM(pgs.mid_made), 0) as total_mid_made,
  COALESCE(SUM(pgs.mid_attempted), 0) as total_mid_attempted,
  COALESCE(SUM(pgs.three_made), 0) as total_three_made,
  COALESCE(SUM(pgs.three_attempted), 0) as total_three_attempted,
  COALESCE(SUM(pgs.free_throw_made), 0) as total_free_throw_made,
  COALESCE(SUM(pgs.free_throw_attempted), 0) as total_free_throw_attempted,
  COALESCE(SUM(pgs.offensive_rebounds), 0) as total_offensive_rebounds,
  COALESCE(SUM(pgs.defensive_rebounds), 0) as total_defensive_rebounds,
  COALESCE(SUM(pgs.offensive_rebounds + pgs.defensive_rebounds), 0) as total_rebounds,
  COALESCE(ROUND(AVG(pgs.offensive_rebounds + pgs.defensive_rebounds)::numeric, 1), 0) as avg_rebounds,
  COALESCE(SUM(pgs.assists), 0) as total_assists,
  COALESCE(ROUND(AVG(pgs.assists)::numeric, 1), 0) as avg_assists,
  COALESCE(SUM(pgs.steals), 0) as total_steals,
  COALESCE(SUM(pgs.turnovers), 0) as total_turnovers,
  COALESCE(SUM(pgs.fouls_committed), 0) as total_fouls_committed,
  COALESCE(SUM(pgs.blocks), 0) as total_blocks,
  COALESCE(SUM(pgs.valuation), 0) as total_valuation,
  COALESCE(ROUND(AVG(pgs.valuation)::numeric, 1), 0) as avg_valuation
FROM players p
LEFT JOIN player_game_stats pgs ON p.id = pgs.player_id
GROUP BY p.id, p.name, p.number, p.position, p.birth_year, p.height, p.weight
HAVING COUNT(DISTINCT pgs.game_id) > 0;

-- Kommentek az oszlopokhoz
COMMENT ON COLUMN players.birth_year IS 'Születési év';
COMMENT ON COLUMN players.height IS 'Magasság cm-ben';
COMMENT ON COLUMN players.weight IS 'Súly kg-ban';

-- 2. JÁTÉKOSOK ADATAINAK FRISSÍTÉSE
-- =====================================================

-- Edwin Deon Javern - 0
UPDATE players SET 
  birth_year = 1992,
  position = '1-2 (Irányító/Dobóhátvéd)',
  height = 194,
  weight = 100
WHERE number = 0;

-- Nagy Dániel - 1
UPDATE players SET 
  birth_year = 2006,
  position = '3-4 (Kiscsatár/Erőcsatár)',
  height = 193,
  weight = 89
WHERE number = 1;

-- Bluiett Trevon Nykee - 2
UPDATE players SET 
  birth_year = 1994,
  position = '2-3 (Dobóhátvéd/Kiscsatár)',
  height = 198,
  weight = 98
WHERE number = 2;

-- Hicks Tony Hollis - 3
UPDATE players SET 
  birth_year = 1994,
  position = '1 (Irányító)',
  height = 189,
  weight = 84
WHERE number = 3;

-- Edosomwan Kinsley Nehizena - 4
UPDATE players SET 
  birth_year = 1993,
  position = '5 (Center)',
  height = 206,
  weight = 118
WHERE number = 4;

-- Eilingsfeld János - 7
UPDATE players SET 
  birth_year = 1991,
  position = '4 (Erőcsatár)',
  height = 200,
  weight = 103
WHERE number = 7;

-- Révész Ádám - 10
UPDATE players SET 
  birth_year = 1995,
  position = '5 (Center)',
  height = 200,
  weight = 108
WHERE number = 10;

-- Benke Szilárd - 11
UPDATE players SET 
  birth_year = 1995,
  position = '2-3 (Dobóhátvéd/Kiscsatár)',
  height = 197,
  weight = 95
WHERE number = 11;

-- Halmai Dániel - 12
UPDATE players SET 
  birth_year = 2004,
  position = '1 (Irányító)',
  height = 184,
  weight = 80
WHERE number = 12;

-- Géringer Gergő - 13
UPDATE players SET 
  birth_year = 2005,
  position = '3-4 (Kiscsatár/Erőcsatár)',
  height = 198,
  weight = 97
WHERE number = 13;

-- Arnold Botond - 15
UPDATE players SET 
  birth_year = 2003,
  position = '5-4 (Center/Erőcsatár)',
  height = 206,
  weight = 105
WHERE number = 15;

-- Krivacevic Markó - 22
UPDATE players SET 
  birth_year = 1996,
  position = '5-4 (Center/Erőcsatár)',
  height = 202,
  weight = 98
WHERE number = 22;

-- Cohill Eric Edward - 41
UPDATE players SET 
  birth_year = 2003,
  position = '3 (Kiscsatár)',
  height = 196,
  weight = 86
WHERE number = 41;

-- 3. ELLENŐRZÉS
-- =====================================================
SELECT 
  number,
  name,
  birth_year,
  position,
  height,
  weight
FROM players
ORDER BY number;
