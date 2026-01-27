-- HELYES MECCSEK AZONOSÍTÁSA
-- A helyes meccsek azok, ahol van párosított ellenfél meccs (home-away)

-- 1. TALÁLD MEG A VALÓDI PÁROKAT
-- Két meccs akkor párja egymásnak, ha:
-- - Ugyanaz a dátum
-- - A vs B (eredmény X-Y) ÉS B vs A (eredmény Y-X)
WITH valid_games AS (
  SELECT DISTINCT
    g1.id as game1_id,
    g1.date,
    t1.name as team1,
    g1.opponent as team2,
    g1.our_score as score1,
    g1.opp_score as score2,
    g2.id as game2_id,
    t2.name as team2_check
  FROM games g1
  JOIN seasons s ON g1.season_id = s.id
  JOIN teams t1 ON g1.our_team_id = t1.id
  LEFT JOIN games g2 ON 
    g2.season_id = s.id
    AND g2.date = g1.date
    AND g2.our_score = g1.opp_score  -- Fordított eredmény
    AND g2.opp_score = g1.our_score
  LEFT JOIN teams t2 ON g2.our_team_id = t2.id
  WHERE s.name = '2025/2026'
    AND t2.name = g1.opponent  -- Az ellenfél neve megegyezik a másik csapat nevével
)
SELECT 
  date,
  team1 || ' ' || score1 || '-' || score2 || ' ' || team2 as match,
  game1_id,
  game2_id
FROM valid_games
ORDER BY date DESC
LIMIT 30;

-- 2. ROSSZ MECCSEK: Ahol NINCS érvényes pár
-- Ezek a meccsek nem illeszkednek semelyik másik meccshez
WITH valid_game_ids AS (
  SELECT DISTINCT g1.id
  FROM games g1
  JOIN seasons s ON g1.season_id = s.id
  JOIN teams t1 ON g1.our_team_id = t1.id
  JOIN games g2 ON 
    g2.season_id = s.id
    AND g2.date = g1.date
    AND g2.our_score = g1.opp_score
    AND g2.opp_score = g1.our_score
  JOIN teams t2 ON g2.our_team_id = t2.id
  WHERE s.name = '2025/2026'
    AND t2.name = g1.opponent
)
SELECT 
  g.id,
  g.date,
  t.name as our_team,
  g.opponent,
  g.our_score,
  g.opp_score
FROM games g
JOIN seasons s ON g.season_id = s.id
JOIN teams t ON g.our_team_id = t.id
WHERE s.name = '2025/2026'
  AND g.id NOT IN (SELECT id FROM valid_game_ids)
ORDER BY g.date DESC
LIMIT 50;

-- 3. TÖRLÉS: Rossz meccsek (azok ahol nincs érvényes pár)
/*
WITH valid_game_ids AS (
  SELECT DISTINCT g1.id
  FROM games g1
  JOIN seasons s ON g1.season_id = s.id
  JOIN teams t1 ON g1.our_team_id = t1.id
  JOIN games g2 ON 
    g2.season_id = s.id
    AND g2.date = g1.date
    AND g2.our_score = g1.opp_score
    AND g2.opp_score = g1.our_score
  JOIN teams t2 ON g2.our_team_id = t2.id
  WHERE s.name = '2025/2026'
    AND t2.name = g1.opponent
)
DELETE FROM player_game_stats
WHERE game_id IN (
  SELECT g.id
  FROM games g
  JOIN seasons s ON g.season_id = s.id
  WHERE s.name = '2025/2026'
    AND g.id NOT IN (SELECT id FROM valid_game_ids)
);

DELETE FROM games
WHERE id IN (
  SELECT g.id
  FROM games g
  JOIN seasons s ON g.season_id = s.id
  WHERE s.name = '2025/2026'
    AND g.id NOT IN (SELECT id FROM valid_game_ids)
);
*/

-- 4. ELLENŐRZÉS: Csapatonkénti meccsszám
/*
SELECT 
  t.name as team,
  COUNT(g.id) as games_count
FROM games g
JOIN teams t ON g.our_team_id = t.id
JOIN seasons s ON g.season_id = s.id
WHERE s.name = '2025/2026'
GROUP BY t.name
ORDER BY games_count DESC;
*/
