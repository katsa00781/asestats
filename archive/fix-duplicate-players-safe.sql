-- Biztonságos duplikátum-javítás (első kör)
--
-- Mit javít automatikusan:
-- 1) Ugyanazon csapat+szezon+mezszám+név_key duplikátumok összevonása
--    - statok átmozgatása kanonikus rekordra
--    - stat nélküli duplikátum rekordok inaktiválása
-- 2) Cross-team esetben CSAK a stat nélküli duplikátumokat inaktiválja
--    (nem mozgat statot csapatok között)
--
-- Javaslat: először csak a 2025/2026 szezonra futtasd,
-- majd ha rendben, akkor más szezonokra is.

BEGIN;

WITH season_ref AS (
  SELECT id AS season_id, name AS season_name
  FROM seasons
  WHERE name = '2025/2026'
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
    p.created_at
  FROM players p
  JOIN season_ref sr ON sr.season_id = p.season_id
),
player_stats AS (
  SELECT pgs.player_id, COUNT(*) AS stat_rows, COUNT(DISTINCT pgs.game_id) AS game_rows
  FROM player_game_stats pgs
  GROUP BY pgs.player_id
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
within_team_ranked AS (
  SELECT
    sp.*,
    COALESCE(ps.stat_rows, 0) AS stat_rows,
    COALESCE(ps.game_rows, 0) AS game_rows,
    ROW_NUMBER() OVER (
      PARTITION BY sp.season_id, sp.team_id, sp.number, sp.name_key
      ORDER BY
        CASE WHEN sp.is_active THEN 0 ELSE 1 END,
        COALESCE(ps.game_rows, 0) DESC,
        COALESCE(ps.stat_rows, 0) DESC,
        sp.created_at DESC,
        sp.id
    ) AS rn
  FROM scoped_players sp
  JOIN within_team_groups g
    ON g.season_id = sp.season_id
   AND g.team_id = sp.team_id
   AND g.number = sp.number
   AND g.name_key = sp.name_key
  LEFT JOIN player_stats ps ON ps.player_id = sp.id
),
within_team_canonical AS (
  SELECT
    season_id,
    team_id,
    number,
    name_key,
    id AS canonical_id
  FROM within_team_ranked
  WHERE rn = 1
),
within_team_dupes AS (
  SELECT
    r.id AS duplicate_id,
    c.canonical_id
  FROM within_team_ranked r
  JOIN within_team_canonical c
    ON c.season_id = r.season_id
   AND c.team_id = r.team_id
   AND c.number = r.number
   AND c.name_key = r.name_key
  WHERE r.rn > 1
),
move_stats_within_team AS (
  UPDATE player_game_stats pgs
  SET player_id = d.canonical_id
  FROM within_team_dupes d
  WHERE pgs.player_id = d.duplicate_id
    AND NOT EXISTS (
      SELECT 1
      FROM player_game_stats existing
      WHERE existing.game_id = pgs.game_id
        AND existing.player_id = d.canonical_id
    )
  RETURNING pgs.id
),
remaining_dupe_stats AS (
  SELECT
    d.duplicate_id,
    COUNT(pgs.id) AS remaining_rows
  FROM within_team_dupes d
  LEFT JOIN player_game_stats pgs ON pgs.player_id = d.duplicate_id
  GROUP BY d.duplicate_id
),
deactivate_within_team_empty_dupes AS (
  UPDATE players p
  SET
    is_active = false,
    updated_at = timezone('utc', now())
  FROM remaining_dupe_stats r
  WHERE p.id = r.duplicate_id
    AND r.remaining_rows = 0
    AND COALESCE(p.is_active, true)
  RETURNING p.id
),

-- Cross-team: csak stat nélküli duplikátumok inaktiválása
cross_team_groups AS (
  SELECT
    sp.season_id,
    sp.name_key
  FROM scoped_players sp
  GROUP BY sp.season_id, sp.name_key
  HAVING COUNT(DISTINCT sp.team_id) > 1
),
cross_team_ranked AS (
  SELECT
    sp.*,
    COALESCE(ps.stat_rows, 0) AS stat_rows,
    COALESCE(ps.game_rows, 0) AS game_rows,
    ROW_NUMBER() OVER (
      PARTITION BY sp.season_id, sp.name_key
      ORDER BY
        CASE WHEN sp.is_active THEN 0 ELSE 1 END,
        COALESCE(ps.game_rows, 0) DESC,
        COALESCE(ps.stat_rows, 0) DESC,
        sp.created_at DESC,
        sp.id
    ) AS rn
  FROM scoped_players sp
  JOIN cross_team_groups g
    ON g.season_id = sp.season_id
   AND g.name_key = sp.name_key
  LEFT JOIN player_stats ps ON ps.player_id = sp.id
),
deactivate_cross_team_empty_non_canonical AS (
  UPDATE players p
  SET
    is_active = false,
    updated_at = timezone('utc', now())
  FROM cross_team_ranked r
  WHERE p.id = r.id
    AND r.rn > 1
    AND r.stat_rows = 0
    AND COALESCE(p.is_active, true)
  RETURNING p.id
)
SELECT
  (SELECT COUNT(*) FROM within_team_groups) AS within_team_groups_found,
  (SELECT COUNT(*) FROM within_team_dupes) AS within_team_duplicate_rows,
  (SELECT COUNT(*) FROM move_stats_within_team) AS stats_rows_moved_within_team,
  (SELECT COUNT(*) FROM deactivate_within_team_empty_dupes) AS within_team_rows_deactivated,
  (SELECT COUNT(*) FROM cross_team_groups) AS cross_team_groups_found,
  (SELECT COUNT(*) FROM deactivate_cross_team_empty_non_canonical) AS cross_team_rows_deactivated;

COMMIT;

-- Utóellenőrzés (ugyanarra a szezonra)
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
cross_team AS (
  SELECT season_name, name_key
  FROM normalized
  GROUP BY season_name, name_key
  HAVING COUNT(DISTINCT team_id) > 1
),
within_team AS (
  SELECT season_name, team_id, number, name_key
  FROM normalized
  GROUP BY season_name, team_id, number, name_key
  HAVING COUNT(*) > 1
)
SELECT
  (SELECT COUNT(*) FROM cross_team) AS remaining_cross_team_duplicate_groups,
  (SELECT COUNT(*) FROM within_team) AS remaining_within_team_duplicate_groups;
