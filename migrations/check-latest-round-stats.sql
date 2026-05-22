-- ============================================================
-- DIAGNOSZTIKA: Utolsó forduló statisztikák ellenőrzése
-- Csak olvasás (SELECT), nincs adatmódosítás.
-- Futtatás: Supabase SQL Editorban
-- ============================================================

-- 1. Legutóbbi 20 meccs és melyik szezon-táblában vannak statisztikáik
SELECT
  g.date,
  g.opponent,
  g.our_score,
  g.opp_score,
  g.result,
  g.round,
  s.name AS season_name,
  g.id AS game_id,
  (SELECT COUNT(*) FROM player_game_stats_2025_2026 WHERE game_id = g.id) AS stats_25_26,
  (SELECT COUNT(*) FROM player_game_stats_2024_2025 WHERE game_id = g.id) AS stats_24_25,
  (SELECT COUNT(*) FROM player_game_stats_2023_2024 WHERE game_id = g.id) AS stats_23_24,
  0 AS stats_26_27  -- tábla még nem létezik
FROM games g
JOIN seasons s ON g.season_id = s.id
ORDER BY g.date DESC
LIMIT 20;

-- ============================================================
-- 2. Statisztika nélküli meccsek (ezeknek kellene lennnie)
-- ============================================================

SELECT
  g.date,
  g.opponent,
  g.our_score,
  g.opp_score,
  s.name AS season_name,
  g.id AS game_id
FROM games g
JOIN seasons s ON g.season_id = s.id
WHERE NOT EXISTS (
  SELECT 1 FROM player_game_stats pgs WHERE pgs.game_id = g.id
)
ORDER BY g.date DESC
LIMIT 20;

-- ============================================================
-- 3. Statisztikák amelyek NEM kerülnek be a view-ba
--    (season_id / our_team_id mismatch esetén)
-- ============================================================

SELECT
  pgs.game_id,
  g.date,
  g.opponent,
  g.our_score,
  g.opp_score,
  g.season_id AS game_season_id,
  s.name AS game_season_name,
  g.our_team_id,
  t.name AS team_name,
  COUNT(pgs.id) AS stat_rows
FROM player_game_stats_2025_2026 pgs
JOIN games g ON pgs.game_id = g.id
JOIN seasons s ON g.season_id = s.id
LEFT JOIN teams t ON g.our_team_id = t.id
GROUP BY pgs.game_id, g.date, g.opponent, g.our_score, g.opp_score, g.season_id, s.name, g.our_team_id, t.name
ORDER BY g.date DESC
LIMIT 20;

-- ============================================================
-- 4. Ellenőrzés: vannak-e 2025/2026-os játékosok a view-ban
-- ============================================================

SELECT
  player_id,
  name,
  season_name,
  team_name,
  games_played,
  total_points
FROM player_season_stats_by_season
WHERE season_name = '2025/2026'
ORDER BY games_played DESC
LIMIT 20;

-- ============================================================
-- 5. Seasons tábla ellenőrzése
-- ============================================================

SELECT id, name, is_current, start_date, end_date
FROM seasons
ORDER BY start_date;
