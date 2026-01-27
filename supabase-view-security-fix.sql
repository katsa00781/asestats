-- Frissítés: player_season_stats view security javítása

-- Töröljük a meglévő view-t
DROP VIEW IF EXISTS player_season_stats;

-- Újra létrehozzuk SECURITY INVOKER módban (nem SECURITY DEFINER)
CREATE OR REPLACE VIEW player_season_stats 
WITH (security_invoker = true)
AS
SELECT 
  p.id,
  p.name,
  p.number,
  p.position,
  COUNT(DISTINCT pgs.game_id) as games_played,
  SUM(pgs.points) as total_points,
  SUM(pgs.minutes) as total_minutes,
  SUM(pgs.close_made) as close_made,
  SUM(pgs.close_attempted) as close_attempted,
  SUM(pgs.mid_made) as mid_made,
  SUM(pgs.mid_attempted) as mid_attempted,
  SUM(pgs.three_made) as three_made,
  SUM(pgs.three_attempted) as three_attempted,
  SUM(pgs.free_throw_made) as free_throw_made,
  SUM(pgs.free_throw_attempted) as free_throw_attempted,
  SUM(pgs.offensive_rebounds) as offensive_rebounds,
  SUM(pgs.defensive_rebounds) as defensive_rebounds,
  SUM(pgs.total_rebounds) as total_rebounds,
  SUM(pgs.assists) as assists,
  SUM(pgs.steals) as steals,
  SUM(pgs.blocks) as blocks,
  SUM(pgs.turnovers) as turnovers,
  SUM(pgs.fouls_committed) as fouls_committed,
  SUM(pgs.valuation) as valuation,
  AVG(pgs.offensive_rating) as avg_offensive_rating,
  AVG(pgs.defensive_rating) as avg_defensive_rating,
  AVG(pgs.true_shooting_percentage) as avg_true_shooting_pct,
  AVG(pgs.effective_field_goal_percentage) as avg_effective_fg_pct
FROM players p
LEFT JOIN player_game_stats pgs ON p.id = pgs.player_id
GROUP BY p.id, p.name, p.number, p.position;

-- Engedélyezzük az olvasást mindenkinek a view-n keresztül is
GRANT SELECT ON player_season_stats TO anon, authenticated;

-- MEGJEGYZÉS:
-- A 'security_invoker = true' opció azt jelenti, hogy a view-t a 
-- lekérdező felhasználó jogosultságaival futtatja, nem a view 
-- tulajdonosának jogosultságaival. Ez biztonságosabb, mert az 
-- alaptáblák RLS policy-jei továbbra is érvényesek.
