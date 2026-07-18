-- =====================================================================
-- fix-season-view-games-played.sql
-- KÉZZEL FUTTATANDÓ a Supabase SQL Editorban!
--
-- A player_season_stats_by_season view három hibájának javítása
-- (az aggregációs logika – súlyozott összegek – változatlan marad):
--
--   1) games_played: eddig a 0 perces (DNP) sorokat is számolta, ami
--      hígította a meccsenkénti átlagokat (points / games_played).
--      Javítás: csak a minutes > 0 sorok számítanak játszott meccsnek.
--      Az avg_valuation ugyanígy csak a ténylegesen játszott meccsekből
--      átlagol.
--
--   2) Átigazolás: eddig a játékos JELENLEGI csapatához (p.team_id)
--      kötöttük a meccseket, így egy szezon közbeni igazolásnál a korábbi
--      csapatnál játszott meccsek kiestek az aggregátumból. Javítás: a
--      csapat a MECCSBŐL származik (g.our_team_id) – átigazolt játékosnak
--      csapatonként külön szezon-sora lesz, ami a csapatszűrős nézetekkel
--      konzisztens.
--
--   3) is_active szűrő: eddig az inaktív (távozott) játékosok teljesen
--      eltűntek a szezon-aggregátumokból. Javítás: a szűrő elhagyása –
--      a kliens az is_active flag alapján dönt a megjelenítésről
--      (SeasonComparison már most is szűr rá).
-- =====================================================================

CREATE OR REPLACE VIEW player_season_stats_by_season
WITH (security_invoker = true)
AS
SELECT
  p.id as player_id,
  p.name,
  p.number,
  p.position,
  p.birth_year,
  p.height,
  p.weight,
  g.our_team_id as team_id,
  p.is_active,
  t.name as team_name,
  t.short_name as team_short_name,
  s.id as season_id,
  s.name as season_name,
  s.is_current,
  COUNT(DISTINCT pgs.game_id) FILTER (WHERE pgs.minutes > 0) as games_played,
  SUM(pgs.points) as total_points,
  SUM(pgs.minutes) as total_minutes,
  SUM(pgs.close_made) as total_close_made,
  SUM(pgs.close_attempted) as total_close_attempted,
  SUM(pgs.mid_made) as total_mid_made,
  SUM(pgs.mid_attempted) as total_mid_attempted,
  SUM(pgs.three_made) as total_three_made,
  SUM(pgs.three_attempted) as total_three_attempted,
  SUM(pgs.free_throw_made) as total_free_throw_made,
  SUM(pgs.free_throw_attempted) as total_free_throw_attempted,
  SUM(pgs.offensive_rebounds) as total_offensive_rebounds,
  SUM(pgs.defensive_rebounds) as total_defensive_rebounds,
  SUM(pgs.total_rebounds) as total_rebounds,
  SUM(pgs.assists) as total_assists,
  SUM(pgs.steals) as total_steals,
  SUM(pgs.blocks) as total_blocks,
  SUM(pgs.turnovers) as total_turnovers,
  SUM(pgs.fouls_committed) as total_fouls_committed,
  SUM(pgs.fouls_drawn) as total_fouls_drawn,
  SUM(pgs.plus_minus) as total_plus_minus,
  SUM(pgs.valuation) as total_valuation,
  COALESCE(ROUND((AVG(pgs.valuation) FILTER (WHERE pgs.minutes > 0))::numeric, 1), 0) as avg_valuation
FROM players p
INNER JOIN seasons s ON p.season_id = s.id
INNER JOIN (
  SELECT id, game_id, player_id, minutes, points,
    close_made, close_attempted, mid_made, mid_attempted,
    three_made, three_attempted, free_throw_made, free_throw_attempted,
    offensive_rebounds, defensive_rebounds, total_rebounds,
    assists, steals, blocks, turnovers, fouls_committed,
    fouls_drawn, blocks_suffered, blocks_given,
    plus_minus, valuation, offensive_rating, defensive_rating,
    true_shooting_percentage, effective_field_goal_percentage, is_starter
  FROM player_game_stats_2023_2024
  UNION ALL
  SELECT id, game_id, player_id, minutes, points,
    close_made, close_attempted, mid_made, mid_attempted,
    three_made, three_attempted, free_throw_made, free_throw_attempted,
    offensive_rebounds, defensive_rebounds, total_rebounds,
    assists, steals, blocks, turnovers, fouls_committed,
    fouls_drawn, blocks_suffered, blocks_given,
    plus_minus, valuation, offensive_rating, defensive_rating,
    true_shooting_percentage, effective_field_goal_percentage, is_starter
  FROM player_game_stats_2024_2025
  UNION ALL
  SELECT id, game_id, player_id, minutes, points,
    close_made, close_attempted, mid_made, mid_attempted,
    three_made, three_attempted, free_throw_made, free_throw_attempted,
    offensive_rebounds, defensive_rebounds, total_rebounds,
    assists, steals, blocks, turnovers, fouls_committed,
    fouls_drawn, blocks_suffered, blocks_given,
    plus_minus, valuation, offensive_rating, defensive_rating,
    true_shooting_percentage, effective_field_goal_percentage, is_starter
  FROM player_game_stats_2025_2026
  UNION ALL
  SELECT id, game_id, player_id, minutes, points,
    close_made, close_attempted, mid_made, mid_attempted,
    three_made, three_attempted, free_throw_made, free_throw_attempted,
    offensive_rebounds, defensive_rebounds, total_rebounds,
    assists, steals, blocks, turnovers, fouls_committed,
    fouls_drawn, blocks_suffered, blocks_given,
    plus_minus, valuation, offensive_rating, defensive_rating,
    true_shooting_percentage, effective_field_goal_percentage, is_starter
  FROM player_game_stats_2026_2027
) pgs ON p.id = pgs.player_id
INNER JOIN games g ON pgs.game_id = g.id
  AND g.season_id = s.id
INNER JOIN teams t ON g.our_team_id = t.id
GROUP BY
  p.id, p.name, p.number, p.position, p.birth_year, p.height, p.weight,
  g.our_team_id, p.is_active, t.name, t.short_name, s.id, s.name, s.is_current;

GRANT SELECT ON player_season_stats_by_season TO anon, authenticated;

-- A player_season_stats függő view definíciója változatlan, a CREATE OR
-- REPLACE miatt nem kell újra létrehozni.

-- =====================================================================
-- ELLENŐRZÉS (futtasd le a migráció után):
--
-- 1) Egy ismert DNP-s játékos games_played értéke = ténylegesen játszott
--    (minutes > 0) meccsek száma:
-- SELECT name, games_played FROM player_season_stats_by_season
-- WHERE name ILIKE '%<játékosnév>%';
--
-- 2) Átigazolt játékosnak csapatonként külön sora van:
-- SELECT name, season_name, team_name, games_played
-- FROM player_season_stats_by_season
-- GROUP BY name, season_name, team_name, games_played
-- HAVING count(*) > 0
-- ORDER BY name;
--
-- 3) Inaktív játékosok is szerepelnek (várt: > 0, ha van távozott játékos):
-- SELECT count(*) FROM player_season_stats_by_season WHERE is_active = false;
-- =====================================================================
