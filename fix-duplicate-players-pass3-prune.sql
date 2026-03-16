-- Duplikátum javítás - 3. passz
--
-- Cél:
-- 1) 2025/2026 szezonban a stat nélküli, inaktív duplikált player sorok törlése.
-- 2) Külön mérni az "összes" és az "aktív" duplikátum-csoportokat.
--
-- Biztonság:
-- - Csak olyan players sor törlődik, amelyhez 0 sor tartozik a player_game_stats táblában.
-- - A kanonikus rekordot sosem törli (rn = 1 marad).

BEGIN;

WITH season_ref AS (
  SELECT id AS season_id
  FROM seasons
  WHERE name = '2024/2025'
),
player_stats AS (
  SELECT pgs.player_id, COUNT(*) AS stat_rows, COUNT(DISTINCT pgs.game_id) AS game_rows
  FROM player_game_stats pgs
  GROUP BY pgs.player_id
),
scoped_players AS (
  SELECT
    p.id,
    p.name,
    lower(trim(p.name)) AS name_key,
    p.number,
    p.team_id,
    p.season_id,
    COALESCE(p.is_active, true) AS is_active,
    p.created_at,
    COALESCE(ps.stat_rows, 0) AS stat_rows,
    COALESCE(ps.game_rows, 0) AS game_rows
  FROM players p
  JOIN season_ref sr ON sr.season_id = p.season_id
  LEFT JOIN player_stats ps ON ps.player_id = p.id
),
within_team_groups AS (
  SELECT
    sp.season_id,
    sp.team_id,
    sp.number,
    sp.name_key
  FROM scoped_players sp
  GROUP BY sp.season_id, sp.team_id, sp.number, sp.name_key
  HAVING COUNT(*) > 1
),
ranked AS (
  SELECT
    sp.*,
    ROW_NUMBER() OVER (
      PARTITION BY sp.season_id, sp.team_id, sp.number, sp.name_key
      ORDER BY
        CASE WHEN sp.is_active THEN 0 ELSE 1 END,
        sp.game_rows DESC,
        sp.stat_rows DESC,
        sp.created_at DESC,
        sp.id
    ) AS rn
  FROM scoped_players sp
  JOIN within_team_groups g
    ON g.season_id = sp.season_id
   AND g.team_id = sp.team_id
   AND g.number = sp.number
   AND g.name_key = sp.name_key
),
delete_candidates AS (
  SELECT r.id
  FROM ranked r
  WHERE r.rn > 1
    AND r.is_active = false
    AND r.stat_rows = 0
),
deleted_rows AS (
  DELETE FROM players p
  USING delete_candidates d
  WHERE p.id = d.id
  RETURNING p.id
)
SELECT
  (SELECT COUNT(*) FROM within_team_groups) AS within_team_groups_found,
  (SELECT COUNT(*) FROM delete_candidates) AS delete_candidates,
  (SELECT COUNT(*) FROM deleted_rows) AS deleted_rows;

COMMIT;

-- Ellenőrzés A: összes duplikátum csoport (aktív + inaktív)
WITH normalized AS (
  SELECT
    p.id,
    lower(trim(p.name)) AS name_key,
    p.number,
    p.team_id,
    p.season_id,
    s.name AS season_name
  FROM players p
  JOIN seasons s ON s.id = p.season_id
  WHERE s.name = '2025/2026'
),
within_team AS (
  SELECT season_name, team_id, number, name_key
  FROM normalized
  GROUP BY season_name, team_id, number, name_key
  HAVING COUNT(*) > 1
)
SELECT COUNT(*) AS remaining_within_team_duplicate_groups_all
FROM within_team;

-- Ellenőrzés B: csak aktív duplikátum csoportok
WITH normalized AS (
  SELECT
    p.id,
    lower(trim(p.name)) AS name_key,
    p.number,
    p.team_id,
    p.season_id,
    COALESCE(p.is_active, true) AS is_active,
    s.name AS season_name
  FROM players p
  JOIN seasons s ON s.id = p.season_id
  WHERE s.name = '2025/2026'
),
within_team_active AS (
  SELECT season_name, team_id, number, name_key
  FROM normalized
  WHERE is_active = true
  GROUP BY season_name, team_id, number, name_key
  HAVING COUNT(*) > 1
)
SELECT COUNT(*) AS remaining_within_team_duplicate_groups_active
FROM within_team_active;

-- Ellenőrzés C: maradó aktív duplikátumok részletes listája
WITH normalized AS (
  SELECT
    p.id,
    p.name,
    lower(trim(p.name)) AS name_key,
    p.number,
    p.team_id,
    p.season_id,
    COALESCE(p.is_active, true) AS is_active,
    t.name AS team_name,
    s.name AS season_name
  FROM players p
  JOIN teams t ON t.id = p.team_id
  JOIN seasons s ON s.id = p.season_id
  WHERE s.name = '2025/2026'
),
active_dupe_groups AS (
  SELECT season_name, team_id, number, name_key
  FROM normalized
  WHERE is_active = true
  GROUP BY season_name, team_id, number, name_key
  HAVING COUNT(*) > 1
)
SELECT
  n.season_name,
  n.team_name,
  n.number,
  n.name_key,
  COUNT(*) AS active_rows,
  STRING_AGG(n.id::text, ' | ' ORDER BY n.id::text) AS player_ids,
  STRING_AGG(n.name, ' | ' ORDER BY n.name) AS names
FROM normalized n
JOIN active_dupe_groups g
  ON g.season_name = n.season_name
 AND g.team_id = n.team_id
 AND g.number = n.number
 AND g.name_key = n.name_key
WHERE n.is_active = true
GROUP BY n.season_name, n.team_name, n.number, n.name_key
ORDER BY n.team_name, n.number;
