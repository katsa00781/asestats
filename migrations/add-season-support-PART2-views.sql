-- PART 2: View-k létrehozása
-- Ezt futtatsd le CSAK az add-season-to-players.sql UTÁN!
-- (amikor már létezik a players.season_id oszlop)

-- 1. Töröljük a meglévő view-t hogy újra lehessen építeni új oszlopokkal
DROP VIEW IF EXISTS player_season_stats_by_season CASCADE;

-- 2. View: szezon specifikus statisztikák
-- FONTOS: INNER JOIN-t használunk, hogy csak azokat a játékosokat mutassuk, akik játszottak az adott szezonban
-- FONTOS: A játékosok is szezon-specifikusak (players.season_id = seasons.id)
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

-- 3. Jogosultságok
GRANT SELECT ON player_season_stats_by_season TO anon, authenticated;

-- 4. Eredeti player_season_stats view újra létrehozása
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
  birth_year,
  height,
  weight,
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

-- ELLENŐRZÉS:
SELECT 
  season_name,
  COUNT(*) as player_count
FROM player_season_stats_by_season
GROUP BY season_name
ORDER BY season_name DESC;
