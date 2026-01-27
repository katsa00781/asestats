-- Csapat meccs elemzés view-k létrehozása
-- Ez lehetővé teszi a csapat teljesítményének összehasonlítását egy adott meccsen a szezon átlagával

-- 1. Csapat meccs statisztikák view (egy adott meccsre)
DROP VIEW IF EXISTS team_game_stats CASCADE;

CREATE VIEW team_game_stats
WITH (security_invoker = true)
AS
SELECT 
  g.id as game_id,
  g.date,
  g.opponent,
  g.home_away,
  g.our_score,
  g.opp_score,
  g.result,
  g.season_id,
  s.name as season_name,
  g.our_team_id,
  t.name as team_name,
  t.short_name as team_short_name,
  
  -- Dobás statisztikák
  SUM(pgs.close_made) as close_made,
  SUM(pgs.close_attempted) as close_attempted,
  CASE 
    WHEN SUM(pgs.close_attempted) > 0 
    THEN ROUND((SUM(pgs.close_made)::numeric / SUM(pgs.close_attempted)::numeric * 100), 1)
    ELSE 0 
  END as close_percentage,
  
  SUM(pgs.mid_made) as mid_made,
  SUM(pgs.mid_attempted) as mid_attempted,
  CASE 
    WHEN SUM(pgs.mid_attempted) > 0 
    THEN ROUND((SUM(pgs.mid_made)::numeric / SUM(pgs.mid_attempted)::numeric * 100), 1)
    ELSE 0 
  END as mid_percentage,
  
  SUM(pgs.three_made) as three_made,
  SUM(pgs.three_attempted) as three_attempted,
  CASE 
    WHEN SUM(pgs.three_attempted) > 0 
    THEN ROUND((SUM(pgs.three_made)::numeric / SUM(pgs.three_attempted)::numeric * 100), 1)
    ELSE 0 
  END as three_percentage,
  
  SUM(pgs.free_throw_made) as free_throw_made,
  SUM(pgs.free_throw_attempted) as free_throw_attempted,
  CASE 
    WHEN SUM(pgs.free_throw_attempted) > 0 
    THEN ROUND((SUM(pgs.free_throw_made)::numeric / SUM(pgs.free_throw_attempted)::numeric * 100), 1)
    ELSE 0 
  END as free_throw_percentage,
  
  -- Pontok dobástípusonként
  SUM(pgs.close_made) * 2 as close_points,
  SUM(pgs.mid_made) * 2 as mid_points,
  SUM(pgs.three_made) * 3 as three_points,
  SUM(pgs.free_throw_made) as free_throw_points,
  
  -- Egyéb statisztikák
  SUM(pgs.points) as total_points,
  SUM(pgs.offensive_rebounds) as offensive_rebounds,
  SUM(pgs.defensive_rebounds) as defensive_rebounds,
  SUM(pgs.total_rebounds) as total_rebounds,
  SUM(pgs.assists) as assists,
  SUM(pgs.steals) as steals,
  SUM(pgs.blocks) as blocks,
  SUM(pgs.turnovers) as turnovers,
  SUM(pgs.fouls_committed) as fouls_committed,
  SUM(pgs.plus_minus) as plus_minus,
  SUM(pgs.valuation) as valuation

FROM games g
INNER JOIN seasons s ON g.season_id = s.id
INNER JOIN teams t ON g.our_team_id = t.id
INNER JOIN player_game_stats pgs ON g.id = pgs.game_id

GROUP BY 
  g.id, g.date, g.opponent, g.home_away, g.our_score, g.opp_score, g.result,
  g.season_id, s.name, g.our_team_id, t.name, t.short_name;

GRANT SELECT ON team_game_stats TO anon, authenticated;

-- 2. Csapat szezon átlagok view (egy csapat egy szezonra)
DROP VIEW IF EXISTS team_season_averages CASCADE;

CREATE VIEW team_season_averages
WITH (security_invoker = true)
AS
SELECT 
  t.id as team_id,
  t.name as team_name,
  t.short_name as team_short_name,
  s.id as season_id,
  s.name as season_name,
  s.is_current,
  
  COUNT(DISTINCT g.id) as games_count,
  
  -- Átlagos dobás statisztikák
  ROUND(AVG(game_stats.close_attempted), 1) as avg_close_attempted,
  ROUND(AVG(game_stats.close_percentage), 1) as avg_close_percentage,
  ROUND(AVG(game_stats.close_points), 1) as avg_close_points,
  
  ROUND(AVG(game_stats.mid_attempted), 1) as avg_mid_attempted,
  ROUND(AVG(game_stats.mid_percentage), 1) as avg_mid_percentage,
  ROUND(AVG(game_stats.mid_points), 1) as avg_mid_points,
  
  ROUND(AVG(game_stats.three_attempted), 1) as avg_three_attempted,
  ROUND(AVG(game_stats.three_percentage), 1) as avg_three_percentage,
  ROUND(AVG(game_stats.three_points), 1) as avg_three_points,
  
  ROUND(AVG(game_stats.free_throw_attempted), 1) as avg_free_throw_attempted,
  ROUND(AVG(game_stats.free_throw_percentage), 1) as avg_free_throw_percentage,
  ROUND(AVG(game_stats.free_throw_points), 1) as avg_free_throw_points,
  
  -- Átlagos egyéb statisztikák
  ROUND(AVG(game_stats.total_points), 1) as avg_total_points,
  ROUND(AVG(game_stats.offensive_rebounds), 1) as avg_offensive_rebounds,
  ROUND(AVG(game_stats.defensive_rebounds), 1) as avg_defensive_rebounds,
  ROUND(AVG(game_stats.total_rebounds), 1) as avg_total_rebounds,
  ROUND(AVG(game_stats.assists), 1) as avg_assists,
  ROUND(AVG(game_stats.steals), 1) as avg_steals,
  ROUND(AVG(game_stats.blocks), 1) as avg_blocks,
  ROUND(AVG(game_stats.turnovers), 1) as avg_turnovers,
  ROUND(AVG(game_stats.fouls_committed), 1) as avg_fouls_committed,
  ROUND(AVG(game_stats.valuation), 1) as avg_valuation

FROM teams t
CROSS JOIN seasons s
LEFT JOIN games g ON t.id = g.our_team_id AND s.id = g.season_id
LEFT JOIN LATERAL (
  SELECT 
    SUM(pgs.close_attempted) as close_attempted,
    CASE 
      WHEN SUM(pgs.close_attempted) > 0 
      THEN (SUM(pgs.close_made)::numeric / SUM(pgs.close_attempted)::numeric * 100)
      ELSE 0 
    END as close_percentage,
    SUM(pgs.close_made) * 2 as close_points,
    
    SUM(pgs.mid_attempted) as mid_attempted,
    CASE 
      WHEN SUM(pgs.mid_attempted) > 0 
      THEN (SUM(pgs.mid_made)::numeric / SUM(pgs.mid_attempted)::numeric * 100)
      ELSE 0 
    END as mid_percentage,
    SUM(pgs.mid_made) * 2 as mid_points,
    
    SUM(pgs.three_attempted) as three_attempted,
    CASE 
      WHEN SUM(pgs.three_attempted) > 0 
      THEN (SUM(pgs.three_made)::numeric / SUM(pgs.three_attempted)::numeric * 100)
      ELSE 0 
    END as three_percentage,
    SUM(pgs.three_made) * 3 as three_points,
    
    SUM(pgs.free_throw_attempted) as free_throw_attempted,
    CASE 
      WHEN SUM(pgs.free_throw_attempted) > 0 
      THEN (SUM(pgs.free_throw_made)::numeric / SUM(pgs.free_throw_attempted)::numeric * 100)
      ELSE 0 
    END as free_throw_percentage,
    SUM(pgs.free_throw_made) as free_throw_points,
    
    SUM(pgs.points) as total_points,
    SUM(pgs.offensive_rebounds) as offensive_rebounds,
    SUM(pgs.defensive_rebounds) as defensive_rebounds,
    SUM(pgs.total_rebounds) as total_rebounds,
    SUM(pgs.assists) as assists,
    SUM(pgs.steals) as steals,
    SUM(pgs.blocks) as blocks,
    SUM(pgs.turnovers) as turnovers,
    SUM(pgs.fouls_committed) as fouls_committed,
    SUM(pgs.valuation) as valuation
  FROM player_game_stats pgs
  WHERE pgs.game_id = g.id
) as game_stats ON true

WHERE g.id IS NOT NULL

GROUP BY 
  t.id, t.name, t.short_name, s.id, s.name, s.is_current;

GRANT SELECT ON team_season_averages TO anon, authenticated;

-- 3. Összehasonlító view: egy meccs vs szezon átlag
DROP VIEW IF EXISTS game_vs_season_comparison CASCADE;

CREATE VIEW game_vs_season_comparison
WITH (security_invoker = true)
AS
SELECT 
  tgs.*,
  
  -- Szezon átlagok
  tsa.avg_close_attempted,
  tsa.avg_close_percentage,
  tsa.avg_close_points,
  tsa.avg_mid_attempted,
  tsa.avg_mid_percentage,
  tsa.avg_mid_points,
  tsa.avg_three_attempted,
  tsa.avg_three_percentage,
  tsa.avg_three_points,
  tsa.avg_free_throw_attempted,
  tsa.avg_free_throw_percentage,
  tsa.avg_free_throw_points,
  tsa.avg_total_points,
  
  -- Különbségek az átlaghoz képest
  tgs.close_points - tsa.avg_close_points as close_points_diff,
  tgs.mid_points - tsa.avg_mid_points as mid_points_diff,
  tgs.three_points - tsa.avg_three_points as three_points_diff,
  tgs.free_throw_points - tsa.avg_free_throw_points as free_throw_points_diff,
  tgs.total_points - tsa.avg_total_points as total_points_diff,
  
  -- Százalék különbségek
  tgs.close_percentage - tsa.avg_close_percentage as close_percentage_diff,
  tgs.mid_percentage - tsa.avg_mid_percentage as mid_percentage_diff,
  tgs.three_percentage - tsa.avg_three_percentage as three_percentage_diff,
  tgs.free_throw_percentage - tsa.avg_free_throw_percentage as free_throw_percentage_diff

FROM team_game_stats tgs
INNER JOIN team_season_averages tsa 
  ON tgs.our_team_id = tsa.team_id 
  AND tgs.season_id = tsa.season_id;

GRANT SELECT ON game_vs_season_comparison TO anon, authenticated;
