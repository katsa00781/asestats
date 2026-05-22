-- Szezonra szurt duplikatum audit
-- Hasznalat: allitsd be a season_name erteket, majd futtasd.

WITH params AS (
  SELECT '2025/2026'::text AS season_name
),
normalized AS (
  SELECT
    p.id,
    p.name,
    lower(trim(p.name)) AS name_key,
    p.number,
    COALESCE(p.is_active, true) AS is_active,
    p.team_id,
    p.season_id,
    t.name AS team_name,
    s.name AS season_name
  FROM players p
  JOIN teams t ON t.id = p.team_id
  JOIN seasons s ON s.id = p.season_id
  JOIN params par ON par.season_name = s.name
),
player_stats AS (
  SELECT pgs.player_id, COUNT(DISTINCT pgs.game_id) AS games_with_stats
  FROM player_game_stats pgs
  GROUP BY pgs.player_id
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
),
stats_split AS (
  SELECT
    n.season_name,
    n.name_key,
    COUNT(*) FILTER (WHERE COALESCE(ps.games_with_stats, 0) > 0) AS ids_with_stats
  FROM normalized n
  LEFT JOIN player_stats ps ON ps.player_id = n.id
  GROUP BY n.season_name, n.name_key
  HAVING COUNT(*) FILTER (WHERE COALESCE(ps.games_with_stats, 0) > 0) > 1
)
SELECT
  (SELECT season_name FROM params) AS season,
  (SELECT COUNT(*) FROM cross_team) AS cross_team_duplicate_groups,
  (SELECT COUNT(*) FROM within_team) AS within_team_duplicate_groups,
  (SELECT COUNT(*) FROM stats_split) AS split_ids_with_stats_groups;

-- Reszletes top lista (within-team duplikatumok)
WITH params AS (
  SELECT '2025/2026'::text AS season_name
),
normalized AS (
  SELECT
    p.id,
    p.name,
    lower(trim(p.name)) AS name_key,
    p.number,
    COALESCE(p.is_active, true) AS is_active,
    p.team_id,
    s.name AS season_name,
    t.name AS team_name
  FROM players p
  JOIN teams t ON t.id = p.team_id
  JOIN seasons s ON s.id = p.season_id
  JOIN params par ON par.season_name = s.name
),
player_stats AS (
  SELECT pgs.player_id, COUNT(DISTINCT pgs.game_id) AS games_with_stats
  FROM player_game_stats pgs
  GROUP BY pgs.player_id
)
SELECT
  n.team_name,
  n.number,
  n.name_key,
  COUNT(*) AS duplicate_rows,
  SUM(CASE WHEN n.is_active THEN 1 ELSE 0 END) AS active_rows,
  SUM(COALESCE(ps.games_with_stats, 0)) AS total_games_on_ids,
  STRING_AGG(
    CONCAT(n.id::text, ' | ', n.name, ' | active=', n.is_active::text, ' | games=', COALESCE(ps.games_with_stats, 0)::text),
    ' || ' ORDER BY COALESCE(ps.games_with_stats, 0) DESC, n.id
  ) AS details
FROM normalized n
LEFT JOIN player_stats ps ON ps.player_id = n.id
GROUP BY n.team_name, n.number, n.name_key
HAVING COUNT(*) > 1
ORDER BY duplicate_rows DESC, total_games_on_ids DESC, n.team_name, n.number
LIMIT 50;
