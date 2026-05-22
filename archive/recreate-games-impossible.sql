-- GAMES TÁBLÁK ÚJRA LÉTREHOZÁSA A PLAYER_GAME_STATS ALAPJÁN
-- A player_game_stats-ban benne van a game_id, ebből visszakövetkeztethetünk

-- PROBLÉMA: Hiányzó adatok:
-- - date (nincs a player_game_stats-ban)
-- - opponent (nincs)
-- - our_score, opp_score (lehet számolni a player_game_stats-ból)
-- - our_team_id (nincs)
-- - season_id (lehet feltételezni hogy 2025/2026)

-- JAVASOLT MEGOLDÁS: 
-- Importáld újra a meccseket a UI-ból (JsonImport komponens)
-- A player_game_stats majd automatikusan összerendeződik a game_id alapján

-- Ha mégis SQL-lel próbálod:
-- Ez NEM fog működni teljesen, mert hiányzik túl sok adat!

/*
INSERT INTO games (id, date, our_team_id, opponent, our_score, opp_score, result, season_id)
SELECT 
  pgs.game_id as id,
  '2025-01-01'::date as date,  -- HIBÁS! Nem tudjuk a valódi dátumot!
  (SELECT id FROM teams WHERE name = 'ASE' LIMIT 1) as our_team_id,  -- HIBÁS! Nem tudjuk melyik csapat!
  'UNKNOWN' as opponent,  -- HIBÁS!
  SUM(pgs.points) as our_score,  -- Csak közelítés
  0 as opp_score,  -- NEM TUDJUK!
  'loss' as result,
  (SELECT id FROM seasons WHERE name = '2025/2026' LIMIT 1) as season_id
FROM player_game_stats pgs
LEFT JOIN games g ON pgs.game_id = g.id
WHERE g.id IS NULL
GROUP BY pgs.game_id;
*/

-- HELYES MEGOLDÁS:
-- 1. Menj az alkalmazásba
-- 2. JsonImport komponens
-- 3. Importáld újra a meccseket
-- 4. A player_game_stats már létezik, így összepárosodik az új games-zel
