-- Árva player_game_stats rekordok ellenőrzése és javítása
-- (olyan rekordok, amik nem létező game_id-ra mutatnak)

-- 1. Először nézzük meg, vannak-e árva rekordok
SELECT 
  pgs.id,
  pgs.game_id,
  pgs.player_id,
  p.name as player_name,
  pgs.created_at
FROM player_game_stats pgs
LEFT JOIN games g ON pgs.game_id = g.id
LEFT JOIN players p ON pgs.player_id = p.id
WHERE g.id IS NULL
ORDER BY pgs.created_at DESC;

-- 2. Kézileg javítás a Szeged elleni meccshez (2025-09-27)
-- Először keressük meg a helyes game_id-t
SELECT id, date, opponent, our_score, opp_score 
FROM games 
WHERE opponent LIKE '%Szeged%' 
  AND date = '2025-09-27'
ORDER BY created_at DESC;

-- 3. Ha találtunk duplikált meccseket, töröljük a régit és árva statisztikákat
-- FIGYELEM: Ezt csak akkor futtasd, ha biztos vagy benne!
-- DELETE FROM player_game_stats 
-- WHERE game_id NOT IN (SELECT id FROM games);

-- 4. Ellenőrizzük, hogy minden player_game_stats rekordhoz van-e games rekord
SELECT 
  COUNT(*) as total_stats,
  COUNT(g.id) as with_games,
  COUNT(*) - COUNT(g.id) as orphaned
FROM player_game_stats pgs
LEFT JOIN games g ON pgs.game_id = g.id;

-- 5. Ha van duplikált Szeged meccs (rossz dátummal), töröljük
-- Először ellenőrizzük
SELECT 
  id,
  date,
  opponent,
  our_score,
  opp_score,
  created_at,
  updated_at
FROM games
WHERE opponent LIKE '%Szeged%'
ORDER BY created_at;

-- 6. Töröljük az összes árva player_game_stats rekordot
-- (Ez biztonságos, mert CASCADE miatt már törölve kellett volna lenniük)
DELETE FROM player_game_stats 
WHERE game_id NOT IN (SELECT id FROM games);
