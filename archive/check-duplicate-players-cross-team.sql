-- Duplikált játékos audit az összes csapatra/szezonra
-- Cél: feltárni az importok után keletkezett duplikátumokat.
--
-- 1) Azonos név (case-insensitive) + azonos szezon, több különböző csapatban
-- 2) Azonos csapat + szezon + mezszám + név duplikáció
-- 3) Azonos név + szezon több player ID-n statisztikával (széttört rekordok)

-- 1) Cross-team duplikátumok ugyanabban a szezonban
WITH normalized AS (
  SELECT
    p.id,
    p.name,
    lower(trim(p.name)) AS name_key,
    p.number,
    p.is_active,
    p.team_id,
    p.season_id,
    t.name AS team_name,
    s.name AS season_name
  FROM players p
  JOIN teams t ON t.id = p.team_id
  JOIN seasons s ON s.id = p.season_id
)
SELECT
  n.season_name,
  n.name_key,
  MIN(n.name) AS sample_name,
  COUNT(*) AS player_rows,
  COUNT(DISTINCT n.team_id) AS team_count,
  STRING_AGG(DISTINCT n.team_name, ' | ' ORDER BY n.team_name) AS teams,
  SUM(CASE WHEN COALESCE(n.is_active, true) THEN 1 ELSE 0 END) AS active_rows
FROM normalized n
GROUP BY n.season_name, n.name_key
HAVING COUNT(DISTINCT n.team_id) > 1
ORDER BY n.season_name DESC, player_rows DESC, sample_name;

-- 2) Duplikátum ugyanazon csapaton belül (azonos név+mezszám+szezon)
WITH normalized AS (
  SELECT
    p.id,
    p.name,
    lower(trim(p.name)) AS name_key,
    p.number,
    p.is_active,
    p.team_id,
    p.season_id,
    t.name AS team_name,
    s.name AS season_name
  FROM players p
  JOIN teams t ON t.id = p.team_id
  JOIN seasons s ON s.id = p.season_id
)
SELECT
  n.season_name,
  n.team_name,
  n.number,
  n.name_key,
  COUNT(*) AS duplicate_rows,
  STRING_AGG(n.id::text, ' | ' ORDER BY n.id::text) AS player_ids,
  STRING_AGG(n.name, ' | ' ORDER BY n.name) AS names,
  SUM(CASE WHEN COALESCE(n.is_active, true) THEN 1 ELSE 0 END) AS active_rows
FROM normalized n
GROUP BY n.season_name, n.team_name, n.number, n.name_key
HAVING COUNT(*) > 1
ORDER BY n.season_name DESC, n.team_name, duplicate_rows DESC, n.number;

-- 3) Statisztika-széttörés: ugyanaz a név+szezon több player_id-n kapott meccs statot
WITH normalized AS (
  SELECT
    p.id,
    lower(trim(p.name)) AS name_key,
    p.name,
    p.team_id,
    p.season_id,
    t.name AS team_name,
    s.name AS season_name,
    COALESCE(p.is_active, true) AS is_active
  FROM players p
  JOIN teams t ON t.id = p.team_id
  JOIN seasons s ON s.id = p.season_id
),
stats_by_player AS (
  SELECT
    n.season_name,
    n.name_key,
    n.name,
    n.team_name,
    n.id AS player_id,
    n.is_active,
    COUNT(DISTINCT pgs.game_id) AS games_with_stats
  FROM normalized n
  LEFT JOIN player_game_stats pgs ON pgs.player_id = n.id
  GROUP BY n.season_name, n.name_key, n.name, n.team_name, n.id, n.is_active
)
SELECT
  season_name,
  name_key,
  MIN(name) AS sample_name,
  COUNT(*) FILTER (WHERE games_with_stats > 0) AS ids_with_stats,
  SUM(games_with_stats) AS total_games_on_all_ids,
  STRING_AGG(
    CONCAT(team_name, ' | ', player_id::text, ' | active=', is_active::text, ' | games=', games_with_stats::text),
    ' || ' ORDER BY games_with_stats DESC, team_name
  ) AS details
FROM stats_by_player
GROUP BY season_name, name_key
HAVING COUNT(*) FILTER (WHERE games_with_stats > 0) > 1
ORDER BY season_name DESC, total_games_on_all_ids DESC, sample_name;

-- 4) Gyors összesítő számok
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
  (SELECT COUNT(*) FROM cross_team) AS cross_team_duplicate_groups,
  (SELECT COUNT(*) FROM within_team) AS within_team_duplicate_groups;
