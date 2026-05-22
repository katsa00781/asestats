-- Ellenőrizzük hány meccs van csapatonként a 2025/2026 szezonban
SELECT 
  t.name as team,
  COUNT(g.id) as games_count
FROM games g
JOIN teams t ON g.our_team_id = t.id
JOIN seasons s ON g.season_id = s.id
WHERE s.name = '2025/2026'
GROUP BY t.name
ORDER BY games_count DESC;
