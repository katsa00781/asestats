-- Ellenőrző és javító script a szezon adatokhoz

-- 1. Nézd meg, milyen szezonok vannak az adatbázisban
SELECT * FROM seasons ORDER BY start_date DESC;

-- 2. Ha a 2025/2026-os szezon már létezik, de nincs is_current = true, akkor állítsd be:
UPDATE seasons 
SET is_current = true 
WHERE name = '2025/2026';

-- Ez automatikusan false-ra állítja a többi szezont a trigger miatt

-- 3. Ha még nem létezik a 2025/2026-os szezon, hozd létre:
INSERT INTO seasons (name, start_date, end_date, is_current)
VALUES ('2025/2026', '2025-09-01', '2026-05-31', true)
ON CONFLICT (name) DO UPDATE 
SET is_current = true;

-- 4. Ellenőrizd, hogy a meccseknek van-e season_id-juk
SELECT 
  COUNT(*) as total_games,
  COUNT(season_id) as games_with_season,
  COUNT(*) - COUNT(season_id) as games_without_season
FROM games;

-- 5. Ha vannak meccsek season_id nélkül, rendeld hozzá őket a jelenlegi szezonhoz
UPDATE games 
SET season_id = (SELECT id FROM seasons WHERE is_current = true LIMIT 1)
WHERE season_id IS NULL;

-- 6. Ellenőrzés: minden meccsnek van-e már season_id-ja?
SELECT 
  CASE 
    WHEN COUNT(*) = COUNT(season_id) THEN '✓ Minden meccsnek van season_id-ja'
    ELSE '✗ Még vannak meccsek season_id nélkül: ' || (COUNT(*) - COUNT(season_id))::text
  END as status
FROM games;

-- 7. Ellenőrizd a player_season_stats_by_season view-t
SELECT 
  season_name,
  COUNT(DISTINCT player_id) as player_count,
  SUM(games_played) as total_games_played
FROM player_season_stats_by_season
GROUP BY season_name, season_id
ORDER BY season_name DESC;

-- 8. Ellenőrizd a player_season_stats view-t (csak jelenlegi szezon)
SELECT COUNT(*) as current_season_players
FROM player_season_stats;
