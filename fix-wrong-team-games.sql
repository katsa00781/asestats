-- Meccsek javítása: átállítjuk az our_team_id-t a helyes csapathoz az opponent alapján
-- Ez javítja azokat a meccseket amelyek rossz csapathoz vannak rendelve

-- 1. ELŐNÉZET: Melyek azok a meccsek, ahol a csapat neve az opponent mezőben van?
SELECT 
  g.id,
  g.date,
  g.opponent,
  g.our_score,
  g.opp_score,
  current_team.name as current_team,
  correct_team.id as correct_team_id,
  correct_team.name as correct_team
FROM games g
JOIN seasons s ON g.season_id = s.id
JOIN teams current_team ON g.our_team_id = current_team.id
LEFT JOIN teams correct_team ON 
  correct_team.name ILIKE '%' || SUBSTRING(g.opponent FROM 1 FOR 15) || '%'
  OR g.opponent ILIKE '%' || SUBSTRING(correct_team.name FROM 1 FOR 15) || '%'
WHERE s.name = '2025/2026'
  AND correct_team.id IS NOT NULL
  AND correct_team.id != g.our_team_id  -- Csak azok ahol eltér
ORDER BY g.date DESC;

-- 2. JAVÍTÁS: Átállítjuk az our_team_id-t
-- FIGYELEM: Csak akkor futtasd, ha az előnézet rendben van!
/*
UPDATE games 
SET 
  our_team_id = subquery.correct_team_id,
  opponent = subquery.current_team_name
FROM (
  SELECT 
    g.id as game_id,
    correct_team.id as correct_team_id,
    current_team.name as current_team_name
  FROM games g
  JOIN seasons s ON g.season_id = s.id
  JOIN teams current_team ON g.our_team_id = current_team.id
  JOIN teams correct_team ON 
    correct_team.name ILIKE '%' || SUBSTRING(g.opponent FROM 1 FOR 15) || '%'
    OR g.opponent ILIKE '%' || SUBSTRING(correct_team.name FROM 1 FOR 15) || '%'
  WHERE s.name = '2025/2026'
    AND correct_team.id != g.our_team_id
) as subquery
WHERE games.id = subquery.game_id;
*/
