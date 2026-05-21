-- ============================================================
-- Kaposvár meccs diagnosztika + season_id javítás
-- ============================================================

-- 1. Meccs megkeresése és season_id ellenőrzése
SELECT
  g.id,
  g.date,
  g.opponent,
  g.our_team_id,
  g.season_id,
  s.name AS season_name,
  CASE
    WHEN g.season_id IS NULL THEN '⚠️  HIBA: nincs season_id – az import trigger el fog bukni!'
    ELSE '✅ season_id rendben'
  END AS allapot
FROM games g
LEFT JOIN seasons s ON g.season_id = s.id
WHERE g.opponent ILIKE '%kaposv%'
ORDER BY g.date DESC
LIMIT 5;

-- 2. Van-e már statisztika ehhez a meccshez?
SELECT
  g.date,
  g.opponent,
  (SELECT COUNT(*) FROM player_game_stats_legacy    WHERE game_id = g.id) AS legacy_sorok,
  (SELECT COUNT(*) FROM player_game_stats_2023_2024 WHERE game_id = g.id) AS "2023/2024",
  (SELECT COUNT(*) FROM player_game_stats_2024_2025 WHERE game_id = g.id) AS "2024/2025",
  (SELECT COUNT(*) FROM player_game_stats_2025_2026 WHERE game_id = g.id) AS "2025/2026"
FROM games g
WHERE g.opponent ILIKE '%kaposv%'
ORDER BY g.date DESC
LIMIT 5;

-- ============================================================
-- 3. Ha season_id hiányzik (1. lekérdezésben ⚠️ látható):
--    Futtasd le ezt a javítást, MIELŐTT újra importálsz!
-- ============================================================

UPDATE games
SET season_id = (SELECT id FROM seasons WHERE is_current = true LIMIT 1)
WHERE season_id IS NULL
  AND opponent ILIKE '%kaposv%';

-- Ellenőrzés utána:
SELECT id, date, opponent, season_id FROM games
WHERE opponent ILIKE '%kaposv%'
ORDER BY date DESC LIMIT 5;
