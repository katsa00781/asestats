-- ÓVATOS TAKARÍTÁS: hibásan importált meccsek és stats törlése (csak adott időablakban)
-- 1) ÁLLÍTSD BE a paramétereket az import időpontjára és a szezon nevére.
-- 2) Futtasd a PREVIEW részt.
-- 3) Ha stimmel, futtasd a DELETE részt és COMMIT.

BEGIN;

-- Paraméterek
WITH params AS (
  SELECT
    '2025/2026'::text AS season_name,
    -- Import időablak (UTC). ÁLLÍTSD A SAJÁT IDŐPONTODRA!
    '2026-02-01 06:00:00+00'::timestamptz AS created_from,
    '2026-02-01 07:00:00+00'::timestamptz AS created_to
)
SELECT 1;

-- PREVIEW: összesítő ellenőrzés
WITH params AS (
  SELECT
    '2025/2026'::text AS season_name,
    '2026-02-01 06:00:00+00'::timestamptz AS created_from,
    '2026-02-01 07:00:00+00'::timestamptz AS created_to
),
suspect_games AS (
  SELECT
    g.id,
    g.date,
    g.created_at,
    g.opponent,
    g.home_away,
    g.our_score,
    g.opp_score,
    g.season_id,
    s.name AS season_name,
    s.start_date,
    s.end_date
  FROM games g
  JOIN seasons s ON s.id = g.season_id
  JOIN params p ON p.season_name = s.name
  WHERE g.created_at BETWEEN p.created_from AND p.created_to
    -- Hibásan datált meccsek: szezon dátumtartományon KÍVÜL
    AND (g.date < s.start_date OR g.date > s.end_date)
)
SELECT
  COUNT(*) AS suspect_games_count,
  MIN(date) AS min_game_date,
  MAX(date) AS max_game_date,
  MIN(created_at) AS min_created_at,
  MAX(created_at) AS max_created_at
FROM suspect_games;

-- Részletes lista (ellenőrzéshez)
WITH params AS (
  SELECT
    '2025/2026'::text AS season_name,
    '2026-02-01 06:00:00+00'::timestamptz AS created_from,
    '2026-02-01 07:00:00+00'::timestamptz AS created_to
),
suspect_games AS (
  SELECT
    g.id,
    g.date,
    g.created_at,
    g.opponent,
    g.home_away,
    g.our_score,
    g.opp_score,
    g.season_id,
    s.name AS season_name,
    s.start_date,
    s.end_date
  FROM games g
  JOIN seasons s ON s.id = g.season_id
  JOIN params p ON p.season_name = s.name
  WHERE g.created_at BETWEEN p.created_from AND p.created_to
    AND (g.date < s.start_date OR g.date > s.end_date)
)
SELECT * FROM suspect_games ORDER BY date;

-- DELETE: először a player_game_stats, majd a games
WITH params AS (
  SELECT
    '2025/2026'::text AS season_name,
    '2026-02-01 06:00:00+00'::timestamptz AS created_from,
    '2026-02-01 07:00:00+00'::timestamptz AS created_to
),
suspect_games AS (
  SELECT g.id
  FROM games g
  JOIN seasons s ON s.id = g.season_id
  JOIN params p ON p.season_name = s.name
  WHERE g.created_at BETWEEN p.created_from AND p.created_to
    AND (g.date < s.start_date OR g.date > s.end_date)
)
DELETE FROM player_game_stats
WHERE game_id IN (SELECT id FROM suspect_games);

WITH params AS (
  SELECT
    '2025/2026'::text AS season_name,
    '2026-02-01 06:00:00+00'::timestamptz AS created_from,
    '2026-02-01 07:00:00+00'::timestamptz AS created_to
),
suspect_games AS (
  SELECT g.id
  FROM games g
  JOIN seasons s ON s.id = g.season_id
  JOIN params p ON p.season_name = s.name
  WHERE g.created_at BETWEEN p.created_from AND p.created_to
    AND (g.date < s.start_date OR g.date > s.end_date)
)
DELETE FROM games
WHERE id IN (SELECT id FROM suspect_games);

-- Ha minden rendben, engedélyezd:
-- COMMIT;
-- Ha nem oké, akkor:
-- ROLLBACK;
