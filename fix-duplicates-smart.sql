-- INTELLIGENS DEDUPLIKÁCIÓ ÉS JAVÍTÁS
-- Probléma: Minden meccs háromszor van importálva
-- Megoldás: Törölni az "ASE" opponent-es meccseket (ezek a hibás duplikációk)

-- 1. ELŐNÉZET: Hány "ASE" opponent-es meccs van? (ezeket töröljük)
SELECT 
  COUNT(*) as ase_opponent_games,
  COUNT(DISTINCT CONCAT(g.date, '-', g.our_score, '-', g.opp_score)) as unique_games
FROM games g
JOIN seasons s ON g.season_id = s.id
WHERE s.name = '2025/2026'
  AND g.opponent = 'ASE';

-- 2. ELŐNÉZET: Duplikált meccsek (3-szor ugyanaz)
SELECT 
  g.date,
  g.our_score,
  g.opp_score,
  COUNT(*) as count,
  STRING_AGG(t.name, ' | ' ORDER BY t.name) as teams,
  STRING_AGG(g.opponent, ' | ' ORDER BY g.opponent) as opponents
FROM games g
JOIN seasons s ON g.season_id = s.id
JOIN teams t ON g.our_team_id = t.id
WHERE s.name = '2025/2026'
GROUP BY g.date, g.our_score, g.opp_score
HAVING COUNT(*) > 2
ORDER BY g.date DESC
LIMIT 20;

-- 3. TÖRLÉS FÁZIS 1: Meccsek ahol opponent = "ASE"
-- Ezek biztosan rossz duplikációk
/*
DELETE FROM player_game_stats
WHERE game_id IN (
  SELECT g.id
  FROM games g
  JOIN seasons s ON g.season_id = s.id
  WHERE s.name = '2025/2026'
    AND g.opponent = 'ASE'
);

DELETE FROM games
WHERE id IN (
  SELECT g.id
  FROM games g
  JOIN seasons s ON g.season_id = s.id
  WHERE s.name = '2025/2026'
    AND g.opponent = 'ASE'
);
*/

-- 4. TÖRLÉS FÁZIS 2: További duplikációk ahol az opponent NEM létező csapat
-- (futtatsd CSAK az ASE törlés után!)
/*
DELETE FROM player_game_stats
WHERE game_id IN (
  SELECT g.id
  FROM games g
  JOIN seasons s ON g.season_id = s.id
  LEFT JOIN teams t ON t.name = g.opponent
  WHERE s.name = '2025/2026'
    AND t.id IS NULL
    AND g.opponent != 'ASE'  -- már törölve
);

DELETE FROM games
WHERE id IN (
  SELECT g.id
  FROM games g
  JOIN seasons s ON g.season_id = s.id
  LEFT JOIN teams t ON t.name = g.opponent
  WHERE s.name = '2025/2026'
    AND t.id IS NULL
);
*/

-- 5. ELLENŐRZÉS: Meccsszám csapatonként
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

-- 6. VÉGSŐ ELLENŐRZÉS: Van-e még 3x duplikáció?
/*
SELECT 
  g.date,
  g.our_score,
  g.opp_score,
  COUNT(*) as count
FROM games g
JOIN seasons s ON g.season_id = s.id
WHERE s.name = '2025/2026'
GROUP BY g.date, g.our_score, g.opp_score
HAVING COUNT(*) > 2;
*/
