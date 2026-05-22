-- Keressük meg Darthard és Huszár játékosokat
SELECT 
  p.id,
  p.name,
  p.number,
  t.name as team,
  s.name as season,
  (SELECT COUNT(*) FROM player_season_stats pss WHERE pss.player_id = p.id) as stats_count
FROM players p
JOIN teams t ON p.team_id = t.id
JOIN seasons s ON p.season_id = s.id
WHERE p.name ILIKE '%darthard%' 
   OR p.name ILIKE '%huszár%'
ORDER BY p.name;
