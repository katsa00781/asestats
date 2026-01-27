-- Hicks Tony Hollis átigazolás kezelése
-- Probléma: Hicks Tony Hollis elment, új játékos kapta a mezes számát, 
-- de az import során az új játékos statjai Hicks profiljára kerültek

-- LÉPÉSEK:

-- 1. Megkeressük Hicks Tony Hollis-t és megnézzük a statjait
SELECT 
  p.id as player_id,
  p.name,
  p.number,
  COUNT(pgs.id) as games_count,
  MIN(g.date) as first_game,
  MAX(g.date) as last_game
FROM players p
LEFT JOIN player_game_stats pgs ON p.id = pgs.player_id
LEFT JOIN games g ON pgs.game_id = g.id
WHERE p.name ILIKE '%Hicks%Tony%'
GROUP BY p.id, p.name, p.number;

-- 2. Ellenőrizzük, ki van a 3-as mezszámmal
SELECT 
  p.id,
  p.name,
  p.number,
  COUNT(pgs.id) as games_count
FROM players p
LEFT JOIN player_game_stats pgs ON p.id = pgs.player_id
WHERE p.number = 3
  AND p.season_id = (SELECT id FROM seasons WHERE name = '2024-2025' LIMIT 1)
GROUP BY p.id, p.name, p.number;

-- 3. EGYSZERŰ MEGOLDÁS: Hicks mezszámát megváltoztatjuk, majd létrehozzuk Hawkins-t

-- LÉPÉS 1: Hicks mezszámának megváltoztatása (3 → 99 vagy bármi más szabad szám)
UPDATE players
SET number = 99  -- Válassz egy szabad mezszámot!
WHERE name ILIKE '%Hicks%Tony%';

-- LÉPÉS 2: Hawkins létrehozása a 3-as mezszámmal
INSERT INTO players (name, number, position, birth_year, height, weight, team_id, season_id)
VALUES (
  'Hawkins Elijah Jamil',
  3,
  '1',
  2002,
  180,
  75,
  (SELECT team_id FROM players WHERE name ILIKE '%Hicks%Tony%' LIMIT 1),
  (SELECT season_id FROM players WHERE name ILIKE '%Hicks%Tony%' LIMIT 1)
)
RETURNING id;

-- LÉPÉS 3: A 2026-01-24 utáni meccsek statjait helyezd át Hawkins-hez
UPDATE player_game_stats
SET player_id = (SELECT id FROM players WHERE name = 'Hawkins Elijah Jamil' LIMIT 1)
WHERE player_id = (SELECT id FROM players WHERE name ILIKE '%Hicks%Tony%' LIMIT 1)
  AND game_id IN (SELECT id FROM games WHERE date >= '2026-01-24');

-- VÉGE! Hicks megmarad 99-es mezszámmal és korábbi statjaival,
-- Hawkins pedig megkapja a 3-as mezszámot és a 2026-01-24 utáni meccseket.

-- ELLENŐRZÉS: Mindkét játékos statisztikái
SELECT 
  p.name,
  p.number,
  COUNT(pgs.id) as games_count,
  MIN(g.date) as first_game,
  MAX(g.date) as last_game
FROM players p
LEFT JOIN player_game_stats pgs ON p.id = pgs.player_id
LEFT JOIN games g ON pgs.game_id = g.id
WHERE (p.number = 3 OR p.number = 99)  -- Hawkins (3) és Hicks (99)
  AND p.season_id = (SELECT id FROM seasons WHERE name = '2024-2025' LIMIT 1)
GROUP BY p.id, p.name, p.number
ORDER BY p.number;