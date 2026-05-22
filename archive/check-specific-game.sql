-- JÁTÉKOS STATISZTIKÁK ELLENŐRZÉSE
-- Melyik meccshez van player_game_stats adat?
-- Ez megmondja melyik a VALÓDI meccs!

SELECT 
  g.id,
  g.date,
  t.name as our_team,
  g.opponent,
  g.our_score,
  g.opp_score,
  COUNT(pgs.id) as player_stats_count
FROM games g
JOIN seasons s ON g.season_id = s.id
JOIN teams t ON g.our_team_id = t.id
LEFT JOIN player_game_stats pgs ON pgs.game_id = g.id
WHERE s.name = '2025/2026'
  AND g.date = '2025-10-11'
  AND g.our_score = 96
  AND g.opp_score = 104
GROUP BY g.id, g.date, t.name, g.opponent, g.our_score, g.opp_score
ORDER BY player_stats_count DESC;

-- Ha csak az Endo Plus-hoz van player_stats, akkor:
-- MEGOLDÁS: Töröljük azokat ahol player_stats_count = 0!
