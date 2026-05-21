-- ============================================================
-- DIAGNOSZTIKA + JAVÍTÁS: player_game_stats_legacy átmaradt sorok
-- ============================================================
-- Futtasd le LÉPÉSRŐL LÉPÉSRE a Supabase SQL Editorban.
-- ============================================================

-- ============================================================
-- 1. DIAGNOSZTIKA: mi maradt a legacy táblában?
-- ============================================================

-- Hány sor maradt át nem migrálva?
SELECT
  'legacy sorok összesen' AS info,
  COUNT(*) AS db
FROM player_game_stats_legacy;

-- Melyik meccsekhez tartoznak a legacy sorok, és mi a gondjuk?
SELECT
  g.id AS game_id,
  g.date,
  g.opponent,
  g.season_id,
  s.name AS season_name,
  COUNT(pgs.id) AS statisztika_sorok,
  CASE
    WHEN g.season_id IS NULL THEN 'HIBA: nincs season_id a games táblában'
    WHEN s.id IS NULL       THEN 'HIBA: season_id érvénytelen (nincs ilyen szezon)'
    ELSE 'OK: migrálható'
  END AS allapot
FROM player_game_stats_legacy pgs
JOIN games g ON pgs.game_id = g.id
LEFT JOIN seasons s ON g.season_id = s.id
GROUP BY g.id, g.date, g.opponent, g.season_id, s.name, s.id
ORDER BY g.date DESC;

-- ============================================================
-- 2. JAVÍTÁS A: ha a meccsnek van season_id-je (normál eset)
--    – csak az átmásolás maradt ki a migrációból
-- ============================================================

INSERT INTO player_game_stats_2023_2024 (
  id, game_id, player_id, minutes, points,
  close_made, close_attempted, mid_made, mid_attempted,
  three_made, three_attempted, free_throw_made, free_throw_attempted,
  offensive_rebounds, defensive_rebounds, total_rebounds,
  assists, steals, blocks, turnovers, fouls_committed,
  fouls_drawn, blocks_suffered, blocks_given,
  plus_minus, valuation,
  offensive_rating, defensive_rating,
  true_shooting_percentage, effective_field_goal_percentage,
  created_at
)
SELECT
  pgs.id, pgs.game_id, pgs.player_id, pgs.minutes, pgs.points,
  pgs.close_made, pgs.close_attempted, pgs.mid_made, pgs.mid_attempted,
  pgs.three_made, pgs.three_attempted, pgs.free_throw_made, pgs.free_throw_attempted,
  pgs.offensive_rebounds, pgs.defensive_rebounds, pgs.total_rebounds,
  pgs.assists, pgs.steals, pgs.blocks, pgs.turnovers, pgs.fouls_committed,
  COALESCE(pgs.fouls_drawn, 0), COALESCE(pgs.blocks_suffered, 0), COALESCE(pgs.blocks_given, 0),
  pgs.plus_minus, pgs.valuation,
  pgs.offensive_rating, pgs.defensive_rating,
  pgs.true_shooting_percentage, pgs.effective_field_goal_percentage,
  pgs.created_at
FROM player_game_stats_legacy pgs
JOIN games g ON pgs.game_id = g.id
JOIN seasons s ON g.season_id = s.id
WHERE s.name = '2023/2024'
ON CONFLICT (game_id, player_id) DO NOTHING;

INSERT INTO player_game_stats_2024_2025 (
  id, game_id, player_id, minutes, points,
  close_made, close_attempted, mid_made, mid_attempted,
  three_made, three_attempted, free_throw_made, free_throw_attempted,
  offensive_rebounds, defensive_rebounds, total_rebounds,
  assists, steals, blocks, turnovers, fouls_committed,
  fouls_drawn, blocks_suffered, blocks_given,
  plus_minus, valuation,
  offensive_rating, defensive_rating,
  true_shooting_percentage, effective_field_goal_percentage,
  created_at
)
SELECT
  pgs.id, pgs.game_id, pgs.player_id, pgs.minutes, pgs.points,
  pgs.close_made, pgs.close_attempted, pgs.mid_made, pgs.mid_attempted,
  pgs.three_made, pgs.three_attempted, pgs.free_throw_made, pgs.free_throw_attempted,
  pgs.offensive_rebounds, pgs.defensive_rebounds, pgs.total_rebounds,
  pgs.assists, pgs.steals, pgs.blocks, pgs.turnovers, pgs.fouls_committed,
  COALESCE(pgs.fouls_drawn, 0), COALESCE(pgs.blocks_suffered, 0), COALESCE(pgs.blocks_given, 0),
  pgs.plus_minus, pgs.valuation,
  pgs.offensive_rating, pgs.defensive_rating,
  pgs.true_shooting_percentage, pgs.effective_field_goal_percentage,
  pgs.created_at
FROM player_game_stats_legacy pgs
JOIN games g ON pgs.game_id = g.id
JOIN seasons s ON g.season_id = s.id
WHERE s.name = '2024/2025'
ON CONFLICT (game_id, player_id) DO NOTHING;

INSERT INTO player_game_stats_2025_2026 (
  id, game_id, player_id, minutes, points,
  close_made, close_attempted, mid_made, mid_attempted,
  three_made, three_attempted, free_throw_made, free_throw_attempted,
  offensive_rebounds, defensive_rebounds, total_rebounds,
  assists, steals, blocks, turnovers, fouls_committed,
  fouls_drawn, blocks_suffered, blocks_given,
  plus_minus, valuation,
  offensive_rating, defensive_rating,
  true_shooting_percentage, effective_field_goal_percentage,
  created_at
)
SELECT
  pgs.id, pgs.game_id, pgs.player_id, pgs.minutes, pgs.points,
  pgs.close_made, pgs.close_attempted, pgs.mid_made, pgs.mid_attempted,
  pgs.three_made, pgs.three_attempted, pgs.free_throw_made, pgs.free_throw_attempted,
  pgs.offensive_rebounds, pgs.defensive_rebounds, pgs.total_rebounds,
  pgs.assists, pgs.steals, pgs.blocks, pgs.turnovers, pgs.fouls_committed,
  COALESCE(pgs.fouls_drawn, 0), COALESCE(pgs.blocks_suffered, 0), COALESCE(pgs.blocks_given, 0),
  pgs.plus_minus, pgs.valuation,
  pgs.offensive_rating, pgs.defensive_rating,
  pgs.true_shooting_percentage, pgs.effective_field_goal_percentage,
  pgs.created_at
FROM player_game_stats_legacy pgs
JOIN games g ON pgs.game_id = g.id
JOIN seasons s ON g.season_id = s.id
WHERE s.name = '2025/2026'
ON CONFLICT (game_id, player_id) DO NOTHING;

-- ============================================================
-- 2. JAVÍTÁS B: ha a meccsnek NINCS season_id-je
--    – először hozzárendeljük a 2025/2026 szezonhoz (jelenlegi),
--    majd átmásoljuk a statisztikákat
-- ============================================================

-- Meccsek season_id nélkül hozzárendelése a jelenlegi szezonhoz
UPDATE games
SET season_id = (SELECT id FROM seasons WHERE is_current = true LIMIT 1)
WHERE season_id IS NULL
  AND id IN (SELECT DISTINCT game_id FROM player_game_stats_legacy);

-- Utána futtasd újra a Javítás A részt (a 2025/2026 INSERT-et)

-- ============================================================
-- 3. ELLENŐRZÉS: mi maradt még a legacy-ben?
-- ============================================================

SELECT
  'Maradék legacy sorok (szezon nélküli meccsekhez)' AS info,
  COUNT(*) AS db
FROM player_game_stats_legacy pgs
JOIN games g ON pgs.game_id = g.id
LEFT JOIN seasons s ON g.season_id = s.id
WHERE s.id IS NULL OR g.season_id IS NULL;

-- Sikeres migráció után ez 0 kell legyen.
-- Ha nem 0, futtasd le a Javítás B részt, majd ismételd meg a Javítás A 2025/2026 INSERT-et.

-- Összesítés
SELECT
  (SELECT COUNT(*) FROM player_game_stats_legacy)  AS legacy_osszes,
  (SELECT COUNT(*) FROM player_game_stats_2023_2024) AS "2023/2024",
  (SELECT COUNT(*) FROM player_game_stats_2024_2025) AS "2024/2025",
  (SELECT COUNT(*) FROM player_game_stats_2025_2026) AS "2025/2026",
  (SELECT COUNT(*) FROM player_game_stats)           AS "view_osszes";
