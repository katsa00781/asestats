-- SZTE-Szedeák elleni meccs dátum javítás ellenőrzése
-- A probléma: A meccs törölve és újra felvéve lett, de a dátum nem megfelelő

-- 1. Keressük meg a SZTE-Szedeák elleni meccs(eke)t
SELECT 
  g.id,
  g.date,
  g.opponent,
  g.our_score,
  g.opp_score,
  g.season_id,
  s.name as season_name,
  g.our_team_id,
  t.name as team_name,
  g.created_at,
  g.updated_at,
  COUNT(pgs.id) as player_stats_count
FROM games g
LEFT JOIN seasons s ON g.season_id = s.id
LEFT JOIN teams t ON g.our_team_id = t.id
LEFT JOIN player_game_stats pgs ON g.id = pgs.game_id
WHERE g.opponent LIKE '%Szedeák%'
GROUP BY g.id, g.date, g.opponent, g.our_score, g.opp_score, 
         g.season_id, s.name, g.our_team_id, t.name, g.created_at, g.updated_at
ORDER BY g.date DESC, g.created_at DESC;

-- 2. Ha a dátum nem '2025-09-27', akkor javítsuk
-- Először ellenőrizzük, melyik az a SZTE-Szedeák meccs ami rossz dátumú
-- UPDATE games 
-- SET date = '2025-09-27'
-- WHERE opponent LIKE '%Szedeák%' 
--   AND date != '2025-09-27'
--   AND season_id = (SELECT id FROM seasons WHERE name = '2024/2025');

-- 3. Ellenőrizzük, hogy vannak-e duplikált SZTE-Szedeák meccsek
SELECT 
  date,
  opponent,
  COUNT(*) as count,
  STRING_AGG(id::text, ', ') as game_ids
FROM games
WHERE opponent LIKE '%Szedeák%'
GROUP BY date, opponent
HAVING COUNT(*) > 1;

-- 4. Ha vannak duplikált meccsek, válasszuk ki melyiket tartjuk meg
-- (általában az újabbat, ami később lett létrehozva)
-- És töröljük a másikat (ez automatikusan törli a player_game_stats rekordokat is CASCADE miatt)

-- Példa törléséhez (NE FUTTASD AUTOMATIKUSAN!):
-- DELETE FROM games 
-- WHERE id IN (
--   SELECT id FROM (
--     SELECT id, 
--            ROW_NUMBER() OVER (PARTITION BY date, opponent ORDER BY created_at DESC) as rn
--     FROM games
--     WHERE opponent LIKE '%Szedeák%'
--   ) t
--   WHERE rn > 1
-- );

-- 5. Ellenőrizzük az eredményt
SELECT 
  g.id,
  g.date,
  g.opponent,
  COUNT(pgs.id) as stats_count,
  STRING_AGG(DISTINCT p.name, ', ') as players
FROM games g
LEFT JOIN player_game_stats pgs ON g.id = pgs.game_id
LEFT JOIN players p ON pgs.player_id = p.id
WHERE g.opponent LIKE '%Szedeák%'
GROUP BY g.id, g.date, g.opponent
ORDER BY g.date DESC;
