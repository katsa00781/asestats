-- Célzott helyreállítás: SMITH Jamari Alayae + HAWKINS Elijah Jamil
-- Szenárió: játékos import után rekordok szétestek / rossz csapathoz kerültek / inaktiválódtak.
--
-- Mit csinál:
-- 1) Kiválasztja a kanonikus rekordot névenként a 2025/2026 szezonban
--    (elsőbbség: Atomerőmű SE csapat, aktív státusz, újabb rekord).
-- 2) A kanonikus rekordot Atomerőmű SE-hez állítja és aktiválja.
-- 3) Átmozgatja az azonos nevű többi rekord statjait a kanonikus rekordra
--    (ütközésnél nem ír felül meglévő game/player sort).
-- 4) A maradék duplikátum rekordokat inaktiválja.

BEGIN;

WITH input_names AS (
  SELECT unnest(ARRAY[
    'SMITH Jamari Alayae',
    'HAWKINS Elijah Jamil'
  ]) AS player_name
),
season_ref AS (
  SELECT id AS season_id
  FROM seasons
  WHERE name = '2025/2026'
  LIMIT 1
),
team_ref AS (
  SELECT id AS team_id
  FROM teams
  WHERE name = 'Atomerőmű SE'
  LIMIT 1
),
candidates AS (
  SELECT
    p.id,
    p.name,
    p.team_id,
    p.season_id,
    COALESCE(p.is_active, true) AS is_active,
    p.created_at,
    i.player_name,
    ROW_NUMBER() OVER (
      PARTITION BY i.player_name
      ORDER BY
        CASE WHEN p.team_id = tr.team_id THEN 0 ELSE 1 END,
        CASE WHEN COALESCE(p.is_active, true) THEN 0 ELSE 1 END,
        p.created_at DESC,
        p.id
    ) AS rn
  FROM input_names i
  CROSS JOIN season_ref sr
  CROSS JOIN team_ref tr
  JOIN players p
    ON p.season_id = sr.season_id
   AND lower(trim(p.name)) = lower(trim(i.player_name))
),
canonical AS (
  SELECT id, player_name
  FROM candidates
  WHERE rn = 1
),
canonical_upd AS (
  UPDATE players p
  SET
    team_id = tr.team_id,
    is_active = true,
    updated_at = timezone('utc', now())
  FROM canonical c
  CROSS JOIN team_ref tr
  WHERE p.id = c.id
  RETURNING p.id, p.name
),
all_dupes AS (
  SELECT
    p.id,
    i.player_name,
    c.id AS canonical_id
  FROM input_names i
  CROSS JOIN season_ref sr
  JOIN players p
    ON p.season_id = sr.season_id
   AND lower(trim(p.name)) = lower(trim(i.player_name))
  JOIN canonical c
    ON c.player_name = i.player_name
),
stats_move AS (
  UPDATE player_game_stats pgs
  SET player_id = d.canonical_id
  FROM all_dupes d
  WHERE pgs.player_id = d.id
    AND d.id <> d.canonical_id
    AND NOT EXISTS (
      SELECT 1
      FROM player_game_stats existing
      WHERE existing.game_id = pgs.game_id
        AND existing.player_id = d.canonical_id
    )
  RETURNING pgs.id
),
deactivate_dupes AS (
  UPDATE players p
  SET
    is_active = false,
    updated_at = timezone('utc', now())
  FROM all_dupes d
  WHERE p.id = d.id
    AND d.id <> d.canonical_id
  RETURNING p.id
)
SELECT
  (SELECT count(*) FROM canonical_upd) AS canonical_players_updated,
  (SELECT count(*) FROM stats_move) AS stats_rows_moved,
  (SELECT count(*) FROM deactivate_dupes) AS duplicate_players_deactivated;

COMMIT;

-- Ellenőrzés 1: játékos rekordok
SELECT
  p.id,
  p.name,
  t.name AS team_name,
  s.name AS season_name,
  p.number,
  p.position,
  p.is_active,
  p.created_at
FROM players p
JOIN teams t ON t.id = p.team_id
JOIN seasons s ON s.id = p.season_id
WHERE s.name = '2025/2026'
  AND lower(trim(p.name)) IN (
    lower('SMITH Jamari Alayae'),
    lower('HAWKINS Elijah Jamil')
  )
ORDER BY p.name, p.is_active DESC, p.created_at DESC;

-- Ellenőrzés 2: meccsszám játékosonként
SELECT
  p.name,
  t.name AS team_name,
  p.is_active,
  COUNT(DISTINCT pgs.game_id) AS games_with_stats
FROM players p
LEFT JOIN player_game_stats pgs ON pgs.player_id = p.id
JOIN teams t ON t.id = p.team_id
JOIN seasons s ON s.id = p.season_id
WHERE s.name = '2025/2026'
  AND lower(trim(p.name)) IN (
    lower('SMITH Jamari Alayae'),
    lower('HAWKINS Elijah Jamil')
  )
GROUP BY p.name, t.name, p.is_active
ORDER BY p.name, p.is_active DESC;
