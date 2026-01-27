-- LEGEGYSZERŰBB MEGOLDÁS: Töröljük az "ASE" opponent-es meccseket
-- Ezek biztosan fiktív duplikációk (az import bug következménye)

-- 1. ELŐNÉZET: Hány "ASE" opponent-es meccs van?
SELECT COUNT(*) as ase_games
FROM games g
JOIN seasons s ON g.season_id = s.id
WHERE s.name = '2025/2026'
  AND g.opponent = 'ASE';

-- 2. TÖRLÉS: Meccsek ahol opponent = "ASE"
/*
DELETE FROM games
WHERE id IN (
  SELECT g.id
  FROM games g
  JOIN seasons s ON g.season_id = s.id
  WHERE s.name = '2025/2026'
    AND g.opponent = 'ASE'
);
*/

-- 3. ELLENŐRZÉS: Csapatonkénti meccsszám
/*
SELECT 
  t.name as team,
  COUNT(g.id) as games_count
FROM games g
JOIN teams t ON g.our_team_id = t.id
JOIN seasons s ON g.season_id = s.id
WHERE s.name = '2025/2026'
GROUP BY t.name
ORDER BY games_count DESC;
*/

-- 4. VAN-E MÉG TRIPLA DUPLIKÁCIÓ?
/*
SELECT 
  g.date,
  g.our_score,
  g.opp_score,
  COUNT(*) as count,
  STRING_AGG(t.name || ' vs ' || g.opponent, ' | ') as games
FROM games g
JOIN seasons s ON g.season_id = s.id
JOIN teams t ON g.our_team_id = t.id
WHERE s.name = '2025/2026'
GROUP BY g.date, g.our_score, g.opp_score
HAVING COUNT(*) > 2
ORDER BY g.date DESC
LIMIT 20;
*/
