-- Paraméterezett duplikátum-javító pipeline
--
-- Használat:
-- 1) Állítsd át az INSERT-ben a season nevet.
-- 2) Futtasd le egyben a scriptet Supabase SQL Editorban.
-- 3) Nézd meg a PRECHECK / PASS / POSTCHECK eredmény sorokat.
--
-- Biztonsági elv:
-- - Csapatok között nem mozgatunk statot.
-- - Csak csapaton belül merge-elünk.
-- - Csak stat nélküli, nem kanonikus sorokat inaktiválunk/törlünk.

BEGIN;

CREATE TEMP TABLE IF NOT EXISTS _dup_fix_params (
  target_season_name text NOT NULL
) ON COMMIT DROP;

TRUNCATE TABLE _dup_fix_params;
INSERT INTO _dup_fix_params (target_season_name)
VALUES ('2025/2026'); -- <- ezt írd át (pl. '2024/2025')

-- PRECHECK
WITH params AS (
  SELECT target_season_name FROM _dup_fix_params LIMIT 1
),
normalized AS (
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
  JOIN params par ON par.target_season_name = s.name
),
within_team_all AS (
  SELECT season_name, team_id, number, name_key
  FROM normalized
  GROUP BY season_name, team_id, number, name_key
  HAVING COUNT(*) > 1
),
within_team_active AS (
  SELECT season_name, team_id, number, name_key
  FROM normalized
  WHERE is_active = true
  GROUP BY season_name, team_id, number, name_key
  HAVING COUNT(*) > 1
),
cross_team_all AS (
  SELECT season_name, name_key
  FROM normalized
  GROUP BY season_name, name_key
  HAVING COUNT(DISTINCT team_id) > 1
)
SELECT
  'PRECHECK' AS stage,
  (SELECT COUNT(*) FROM within_team_all) AS within_team_all_groups,
  (SELECT COUNT(*) FROM within_team_active) AS within_team_active_groups,
  (SELECT COUNT(*) FROM cross_team_all) AS cross_team_groups;

-- PASS 1: csapaton belüli duplikátum merge (ütköző game sorok GREATEST-tel)
WITH params AS (
  SELECT target_season_name FROM _dup_fix_params LIMIT 1
),
season_ref AS (
  SELECT s.id AS season_id
  FROM seasons s
  JOIN params p ON p.target_season_name = s.name
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
  SELECT sp.season_id, sp.team_id, sp.number, sp.name_key
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
  SELECT season_id, team_id, number, name_key, id AS canonical_id
  FROM within_team_ranked
  WHERE rn = 1
),
within_team_dupes AS (
  SELECT r.id AS duplicate_id, c.canonical_id
  FROM within_team_ranked r
  JOIN within_team_canonical c
    ON c.season_id = r.season_id
   AND c.team_id = r.team_id
   AND c.number = r.number
   AND c.name_key = r.name_key
  WHERE r.rn > 1
),
conflicting_rows AS (
  SELECT
    d.duplicate_id,
    d.canonical_id,
    dup.id AS dup_pgs_id,
    can.id AS can_pgs_id,
    dup.game_id,
    dup.minutes AS dup_minutes,
    dup.points AS dup_points,
    dup.close_made AS dup_close_made,
    dup.close_attempted AS dup_close_attempted,
    dup.mid_made AS dup_mid_made,
    dup.mid_attempted AS dup_mid_attempted,
    dup.three_made AS dup_three_made,
    dup.three_attempted AS dup_three_attempted,
    dup.free_throw_made AS dup_free_throw_made,
    dup.free_throw_attempted AS dup_free_throw_attempted,
    dup.offensive_rebounds AS dup_offensive_rebounds,
    dup.defensive_rebounds AS dup_defensive_rebounds,
    dup.total_rebounds AS dup_total_rebounds,
    dup.assists AS dup_assists,
    dup.steals AS dup_steals,
    dup.blocks AS dup_blocks,
    dup.turnovers AS dup_turnovers,
    dup.fouls_committed AS dup_fouls_committed,
    dup.plus_minus AS dup_plus_minus,
    dup.valuation AS dup_valuation,
    dup.offensive_rating AS dup_offensive_rating,
    dup.defensive_rating AS dup_defensive_rating,
    dup.true_shooting_percentage AS dup_true_shooting_percentage,
    dup.effective_field_goal_percentage AS dup_effective_field_goal_percentage
  FROM within_team_dupes d
  JOIN player_game_stats dup ON dup.player_id = d.duplicate_id
  JOIN player_game_stats can
    ON can.player_id = d.canonical_id
   AND can.game_id = dup.game_id
),
merge_conflicts AS (
  UPDATE player_game_stats can
  SET
    minutes = GREATEST(COALESCE(can.minutes, 0), COALESCE(c.dup_minutes, 0)),
    points = GREATEST(COALESCE(can.points, 0), COALESCE(c.dup_points, 0)),
    close_made = GREATEST(COALESCE(can.close_made, 0), COALESCE(c.dup_close_made, 0)),
    close_attempted = GREATEST(COALESCE(can.close_attempted, 0), COALESCE(c.dup_close_attempted, 0)),
    mid_made = GREATEST(COALESCE(can.mid_made, 0), COALESCE(c.dup_mid_made, 0)),
    mid_attempted = GREATEST(COALESCE(can.mid_attempted, 0), COALESCE(c.dup_mid_attempted, 0)),
    three_made = GREATEST(COALESCE(can.three_made, 0), COALESCE(c.dup_three_made, 0)),
    three_attempted = GREATEST(COALESCE(can.three_attempted, 0), COALESCE(c.dup_three_attempted, 0)),
    free_throw_made = GREATEST(COALESCE(can.free_throw_made, 0), COALESCE(c.dup_free_throw_made, 0)),
    free_throw_attempted = GREATEST(COALESCE(can.free_throw_attempted, 0), COALESCE(c.dup_free_throw_attempted, 0)),
    offensive_rebounds = GREATEST(COALESCE(can.offensive_rebounds, 0), COALESCE(c.dup_offensive_rebounds, 0)),
    defensive_rebounds = GREATEST(COALESCE(can.defensive_rebounds, 0), COALESCE(c.dup_defensive_rebounds, 0)),
    total_rebounds = GREATEST(COALESCE(can.total_rebounds, 0), COALESCE(c.dup_total_rebounds, 0)),
    assists = GREATEST(COALESCE(can.assists, 0), COALESCE(c.dup_assists, 0)),
    steals = GREATEST(COALESCE(can.steals, 0), COALESCE(c.dup_steals, 0)),
    blocks = GREATEST(COALESCE(can.blocks, 0), COALESCE(c.dup_blocks, 0)),
    turnovers = GREATEST(COALESCE(can.turnovers, 0), COALESCE(c.dup_turnovers, 0)),
    fouls_committed = GREATEST(COALESCE(can.fouls_committed, 0), COALESCE(c.dup_fouls_committed, 0)),
    plus_minus = GREATEST(COALESCE(can.plus_minus, 0), COALESCE(c.dup_plus_minus, 0)),
    valuation = GREATEST(COALESCE(can.valuation, 0), COALESCE(c.dup_valuation, 0)),
    offensive_rating = GREATEST(COALESCE(can.offensive_rating, 0), COALESCE(c.dup_offensive_rating, 0)),
    defensive_rating = GREATEST(COALESCE(can.defensive_rating, 0), COALESCE(c.dup_defensive_rating, 0)),
    true_shooting_percentage = GREATEST(COALESCE(can.true_shooting_percentage, 0), COALESCE(c.dup_true_shooting_percentage, 0)),
    effective_field_goal_percentage = GREATEST(COALESCE(can.effective_field_goal_percentage, 0), COALESCE(c.dup_effective_field_goal_percentage, 0))
  FROM conflicting_rows c
  WHERE can.id = c.can_pgs_id
  RETURNING can.id
),
delete_conflicting_dupes AS (
  DELETE FROM player_game_stats pgs
  USING conflicting_rows c
  WHERE pgs.id = c.dup_pgs_id
  RETURNING pgs.id
),
move_remaining_non_conflicts AS (
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
)
SELECT
  'PASS1_WITHIN_TEAM_MERGE' AS stage,
  (SELECT COUNT(*) FROM within_team_groups) AS within_team_groups_found,
  (SELECT COUNT(*) FROM within_team_dupes) AS within_team_duplicate_rows,
  (SELECT COUNT(*) FROM conflicting_rows) AS conflicting_game_rows_found,
  (SELECT COUNT(*) FROM merge_conflicts) AS canonical_rows_merged,
  (SELECT COUNT(*) FROM delete_conflicting_dupes) AS duplicate_conflict_rows_deleted,
  (SELECT COUNT(*) FROM move_remaining_non_conflicts) AS non_conflict_rows_moved;

-- PASS 2: cross-team stat nélküli nem-kanonikus sorok inaktiválása
WITH params AS (
  SELECT target_season_name FROM _dup_fix_params LIMIT 1
),
season_ref AS (
  SELECT s.id AS season_id
  FROM seasons s
  JOIN params p ON p.target_season_name = s.name
),
scoped_players AS (
  SELECT
    p.id,
    lower(trim(p.name)) AS name_key,
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
cross_team_groups AS (
  SELECT sp.season_id, sp.name_key
  FROM scoped_players sp
  GROUP BY sp.season_id, sp.name_key
  HAVING COUNT(DISTINCT sp.team_id) > 1
),
cross_team_ranked AS (
  SELECT
    sp.id,
    sp.season_id,
    sp.name_key,
    sp.is_active,
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
  'PASS2_CROSS_TEAM_DEACTIVATE' AS stage,
  (SELECT COUNT(*) FROM cross_team_groups) AS cross_team_groups_found,
  (SELECT COUNT(*) FROM deactivate_cross_team_empty_non_canonical) AS rows_deactivated;

-- PASS 3: stat nélküli, inaktív, nem-kanonikus within-team sorok törlése
WITH params AS (
  SELECT target_season_name FROM _dup_fix_params LIMIT 1
),
season_ref AS (
  SELECT s.id AS season_id
  FROM seasons s
  JOIN params p ON p.target_season_name = s.name
),
player_stats AS (
  SELECT pgs.player_id, COUNT(*) AS stat_rows, COUNT(DISTINCT pgs.game_id) AS game_rows
  FROM player_game_stats pgs
  GROUP BY pgs.player_id
),
scoped_players AS (
  SELECT
    p.id,
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
  SELECT sp.season_id, sp.team_id, sp.number, sp.name_key
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
  'PASS3_PRUNE' AS stage,
  (SELECT COUNT(*) FROM within_team_groups) AS within_team_groups_found,
  (SELECT COUNT(*) FROM delete_candidates) AS delete_candidates,
  (SELECT COUNT(*) FROM deleted_rows) AS deleted_rows;

COMMIT;

-- POSTCHECK
WITH params AS (
  SELECT target_season_name FROM _dup_fix_params LIMIT 1
),
normalized AS (
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
  JOIN params par ON par.target_season_name = s.name
),
within_team_all AS (
  SELECT season_name, team_id, number, name_key
  FROM normalized
  GROUP BY season_name, team_id, number, name_key
  HAVING COUNT(*) > 1
),
within_team_active AS (
  SELECT season_name, team_id, number, name_key
  FROM normalized
  WHERE is_active = true
  GROUP BY season_name, team_id, number, name_key
  HAVING COUNT(*) > 1
),
cross_team_all AS (
  SELECT season_name, name_key
  FROM normalized
  GROUP BY season_name, name_key
  HAVING COUNT(DISTINCT team_id) > 1
)
SELECT
  'POSTCHECK' AS stage,
  (SELECT COUNT(*) FROM within_team_all) AS within_team_all_groups,
  (SELECT COUNT(*) FROM within_team_active) AS within_team_active_groups,
  (SELECT COUNT(*) FROM cross_team_all) AS cross_team_groups;

-- Opcionális részletes lista: maradék AKTÍV duplikátumok (ha van)
WITH params AS (
  SELECT target_season_name FROM _dup_fix_params LIMIT 1
),
normalized AS (
  SELECT
    p.id,
    p.name,
    lower(trim(p.name)) AS name_key,
    p.number,
    p.team_id,
    COALESCE(p.is_active, true) AS is_active,
    t.name AS team_name,
    s.name AS season_name
  FROM players p
  JOIN teams t ON t.id = p.team_id
  JOIN seasons s ON s.id = p.season_id
  JOIN params par ON par.target_season_name = s.name
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