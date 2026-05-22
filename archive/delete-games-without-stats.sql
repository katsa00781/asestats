-- VÉGLEGES MEGOLDÁS: TÖRÖLJÜK A MECCSEKET AHOL NINCS PLAYER_GAME_STATS
-- Ezek a fiktív duplikációk, amikhez nem importáltál játékos statisztikákat!

-- 1. ELŐNÉZET: Hány meccsnek NINCS player_stats-ja?
SELECT 
  COUNT(*) as games_without_stats
FROM games g
JOIN seasons s ON g.season_id = s.id
LEFT JOIN player_game_stats pgs ON pgs.game_id = g.id
WHERE s.name = '2025/2026'
GROUP BY g.id
HAVING COUNT(pgs.id) = 0;

-- 2. ELŐNÉZET: Melyik meccseknek nincs player_stats-ja?
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
LEFT JOIN player_game_stats pgs ON pgs.game_id = g.id
WHERE s.name = '2025/2026'
GROUP BY g.id, g.date, t.name, g.opponent, g.our_score, g.opp_score
HAVING COUNT(pgs.id) = 0
ORDER BY g.date DESC
LIMIT 50;

-- 3. TÖRLÉS: Meccsek ahol NINCS player_game_stats
-- Ezek a fiktív duplikációk!
-- FUTTATÁS: Vedd ki a kommentet és futtasd!
DELETE FROM games
WHERE id IN (
  SELECT g.id
  FROM games g
  JOIN seasons s ON g.season_id = s.id
  LEFT JOIN player_game_stats pgs ON pgs.game_id = g.id
  WHERE s.name = '2025/2026'
  GROUP BY g.id
  HAVING COUNT(pgs.id) = 0
);

-- 4. ELLENŐRZÉS: Csapatonkénti meccsszám
-- FUTTATÁS: Vedd ki a kommentet!
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

-- 5. VÉGSŐ ELLENŐRZÉS: Van-e még tripla duplikáció?
-- FUTTATÁS: Vedd ki a kommentet!
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
