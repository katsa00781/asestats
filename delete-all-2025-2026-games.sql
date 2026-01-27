-- FIGYELEM: Ez törli az ÖSSZES 2025/2026 szezónbeli meccset!
-- Csak akkor futtasd, ha teljesen újra akarod importálni őket.

-- 1. ELŐNÉZET: Hány meccs lesz törölve?
SELECT 
  COUNT(*) as total_games_to_delete,
  COUNT(DISTINCT g.id) as unique_games
FROM games g
JOIN seasons s ON g.season_id = s.id
WHERE s.name = '2025/2026';

-- 2. TÖRLÉS: Player game stats először (foreign key miatt)
/*
DELETE FROM player_game_stats
WHERE game_id IN (
  SELECT g.id 
  FROM games g
  JOIN seasons s ON g.season_id = s.id
  WHERE s.name = '2025/2026'
);

-- 3. TÖRLÉS: Games
DELETE FROM games
WHERE season_id IN (
  SELECT id FROM seasons WHERE name = '2025/2026'
);
*/

-- Ellenőrzés után:
-- SELECT COUNT(*) FROM games WHERE season_id IN (SELECT id FROM seasons WHERE name = '2025/2026');
