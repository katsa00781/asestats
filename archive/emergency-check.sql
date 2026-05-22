-- SÜRGŐS ELLENŐRZÉS: Mi van az adatbázisban?

-- 1. Hány meccs van összesen a 2025/2026 szezonban?
SELECT COUNT(*) as total_games
FROM games g
JOIN seasons s ON g.season_id = s.id
WHERE s.name = '2025/2026';

-- 2. Hány player_game_stats van?
SELECT COUNT(*) as total_player_stats
FROM player_game_stats pgs
JOIN games g ON pgs.game_id = g.id
JOIN seasons s ON g.season_id = s.id
WHERE s.name = '2025/2026';

-- 3. Van-e CASCADE DELETE a games → player_game_stats között?
-- (Ez törölte volna a player_stats-okat amikor a games törölve lett!)
SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.table_name = 'player_game_stats'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'games';
