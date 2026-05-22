-- Ellenőrizzük hogy mely meccsek vannak többszörösen rendelve
-- vagy rossz csapathoz rendelve az opponent alapján

SELECT 
  g.id,
  g.date,
  t.name as our_team,
  g.opponent,
  g.our_score,
  g.opp_score
FROM games g
JOIN seasons s ON g.season_id = s.id
JOIN teams t ON g.our_team_id = t.id
WHERE s.name = '2025/2026'
ORDER BY g.date DESC, g.opponent;
