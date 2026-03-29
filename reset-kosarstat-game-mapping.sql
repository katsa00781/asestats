-- Targeted cleanup for wrong Kosarstat game mapping on home/away rematches.
-- Run in Supabase SQL editor.

-- 1) Preview potentially wrong mappings:
-- Same team/opponent pair has multiple games and reuses the same kosarstat_game_id.
WITH duplicated_mapping AS (
  SELECT
    season_id,
    our_team_id,
    opponent,
    kosarstat_game_id,
    COUNT(*) AS game_count
  FROM games
  WHERE kosarstat_game_id IS NOT NULL
  GROUP BY season_id, our_team_id, opponent, kosarstat_game_id
  HAVING COUNT(*) > 1
)
SELECT
  g.id,
  g.season_id,
  g.our_team_id,
  g.date,
  g.home_away,
  g.opponent,
  g.our_score,
  g.opp_score,
  g.kosarstat_game_id
FROM games g
JOIN duplicated_mapping d
  ON d.season_id = g.season_id
 AND d.our_team_id = g.our_team_id
 AND d.opponent = g.opponent
 AND d.kosarstat_game_id = g.kosarstat_game_id
ORDER BY g.season_id, g.our_team_id, g.opponent, g.date;

-- 2) Targeted reset (only duplicated wrong mappings):
WITH duplicated_mapping AS (
  SELECT
    season_id,
    our_team_id,
    opponent,
    kosarstat_game_id
  FROM games
  WHERE kosarstat_game_id IS NOT NULL
  GROUP BY season_id, our_team_id, opponent, kosarstat_game_id
  HAVING COUNT(*) > 1
)
UPDATE games g
SET kosarstat_game_id = NULL
FROM duplicated_mapping d
WHERE d.season_id = g.season_id
  AND d.our_team_id = g.our_team_id
  AND d.opponent = g.opponent
  AND d.kosarstat_game_id = g.kosarstat_game_id;

-- 3) Optional: if you want to scope to one season, use this instead of step 2:
-- UPDATE games
-- SET kosarstat_game_id = NULL
-- WHERE season_id = 'YOUR-SEASON-UUID'
--   AND kosarstat_game_id IS NOT NULL;

-- 4) Verify there are no duplicated mappings left:
SELECT
  season_id,
  our_team_id,
  opponent,
  kosarstat_game_id,
  COUNT(*) AS game_count
FROM games
WHERE kosarstat_game_id IS NOT NULL
GROUP BY season_id, our_team_id, opponent, kosarstat_game_id
HAVING COUNT(*) > 1
ORDER BY game_count DESC;
