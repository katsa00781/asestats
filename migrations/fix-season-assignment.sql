-- Javítás: Meglévő meccsek átállítása a helyes szezonra (2025/2026)

-- 1. Először ellenőrizzük, milyen szezonok vannak
SELECT 
  id,
  name,
  is_current,
  (SELECT COUNT(*) FROM games WHERE season_id = seasons.id) as games_count
FROM seasons 
ORDER BY start_date DESC;

-- 2. Minden meglévő meccs átmozgatása a 2025/2026 szezonba
UPDATE games 
SET season_id = (SELECT id FROM seasons WHERE name = '2025/2026' LIMIT 1)
WHERE season_id = (SELECT id FROM seasons WHERE name = '2024/2025' LIMIT 1);

-- 3. Vagy ha minden meccs még NULL season_id-val rendelkezik:
UPDATE games 
SET season_id = (SELECT id FROM seasons WHERE name = '2025/2026' LIMIT 1)
WHERE season_id IS NULL;

-- 4. Ellenőrzés: nézd meg, hogy minden meccs a 2025/2026 szezonban van-e
SELECT 
  s.name as season_name,
  COUNT(g.id) as games_count,
  MIN(g.date) as first_game,
  MAX(g.date) as last_game
FROM games g
JOIN seasons s ON g.season_id = s.id
GROUP BY s.name
ORDER BY s.name DESC;

-- 5. Melyik játékos melyik szezonban játszott?
SELECT 
  p.name,
  p.number,
  s.name as season_name,
  s.start_date,
  COUNT(DISTINCT g.id) as games_played
FROM players p
JOIN player_game_stats pgs ON p.id = pgs.player_id
JOIN games g ON pgs.game_id = g.id
JOIN seasons s ON g.season_id = s.id
GROUP BY p.id, p.name, p.number, s.name, s.start_date
ORDER BY p.number, s.start_date DESC;

-- 6. Ha szükséges: 2024/2025 szezon törlése (ha még nincsenek benne meccsek)
-- DELETE FROM seasons WHERE name = '2024/2025' AND NOT EXISTS (
--   SELECT 1 FROM games WHERE season_id = seasons.id
-- );
