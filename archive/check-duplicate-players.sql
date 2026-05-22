-- Duplikált játékosok keresése (ugyanaz a név + mezszám, de különböző csapat)
SELECT 
  p1.name,
  p1.number,
  p1.id as player1_id,
  t1.name as team1,
  s1.name as season1,
  p2.id as player2_id,
  t2.name as team2,
  s2.name as season2
FROM players p1
JOIN players p2 ON 
  p1.name = p2.name 
  AND p1.number = p2.number 
  AND p1.id < p2.id  -- Csak egyszer jelenjen meg minden pár
JOIN teams t1 ON p1.team_id = t1.id
JOIN teams t2 ON p2.team_id = t2.id
JOIN seasons s1 ON p1.season_id = s1.id
JOIN seasons s2 ON p2.season_id = s2.id
WHERE 
  p1.team_id != p2.team_id  -- Különböző csapatok
  AND p1.season_id = p2.season_id  -- Ugyanaz a szezon
ORDER BY p1.name, p1.number;
