-- View-k frissítése csapat támogatáshoz
-- Futtatsd le az add-teams-to-games.sql UTÁN!

-- 1. player_season_stats_by_season view újraépítése csapat támogatással
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
  SUM(pgs.plus_minus) as total_plus_minus,
  SUM(pgs.valuation) as total_valuation
FROM 
  players p
  INNER JOIN teams t ON p.team_id = t.id
  INNER JOIN seasons s ON p.season_id = s.id
  INNER JOIN player_game_stats pgs ON p.id = pgs.player_id
  INNER JOIN games g ON pgs.game_id = g.id 
    AND g.season_id = s.id 
    AND g.our_team_id = t.id
GROUP BY 
  p.id, p.name, p.number, p.position, p.birth_year, p.height, p.weight, 
  p.team_id, t.name, t.short_name, s.id, s.name, s.is_current;

GRANT SELECT ON player_season_stats_by_season TO anon, authenticated;

-- 2. player_season_stats view (csak jelenlegi szezon)
DROP VIEW IF EXISTS player_season_stats CASCADE;

CREATE VIEW player_season_stats 
WITH (security_invoker = true)
AS
SELECT 
  player_id, name, number, position, birth_year, height, weight,
  team_id, team_name, team_short_name,
  games_played, total_points, total_minutes,
  total_close_made, total_close_attempted,
  total_mid_made, total_mid_attempted,
  total_three_made, total_three_attempted,
  total_free_throw_made, total_free_throw_attempted,
  total_offensive_rebounds, total_defensive_rebounds, total_rebounds,
  total_assists, total_steals, total_blocks, total_turnovers,
  total_fouls_committed, total_plus_minus, total_valuation
FROM player_season_stats_by_season
WHERE is_current = true;

GRANT SELECT ON player_season_stats TO anon, authenticated;

-- 3. Ellenőrzés
SELECT 
  team_name,
  season_name,
  COUNT(*) as player_count
FROM player_season_stats_by_season
GROUP BY team_name, season_name
ORDER BY team_name, season_name DESC;
