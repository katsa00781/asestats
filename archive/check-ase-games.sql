-- ASE meccsek (ahol az ASE játszott)
-- ASE név variációk: ASE, Atomerőmű SE, Paksi Atomerőmű SE stb.
SELECT 
  g.id,
  g.date,
  g.opponent,
  g.our_score,
  g.opp_score,
  t.name as our_team
FROM games g
JOIN teams t ON g.our_team_id = t.id
JOIN seasons s ON g.season_id = s.id
WHERE s.name = '2025/2026'
  AND t.name LIKE '%ASE%'
ORDER BY g.date DESC;

-- Hány ilyen meccs van?
SELECT COUNT(*) as ase_games_count
FROM games g
JOIN teams t ON g.our_team_id = t.id
JOIN seasons s ON g.season_id = s.id
WHERE s.name = '2025/2026'
  AND t.name LIKE '%ASE%';
