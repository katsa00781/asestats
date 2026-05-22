-- Steals és turnovers felcserélése az adatbázisban
-- Probléma: Az Edwin import során az EL (eladott) és SZ (szerzett) oszlopokat fordítva olvastuk be
-- Edosomwan esetében: jelenleg 23 steals és 4 turnovers van, kellene 4 steals és 23 turnovers
-- Ez minden játékosnál érintett, ezért mindenkinél fel kell cserélni!

-- Ideiglenes oszlop létrehozása
ALTER TABLE player_game_stats ADD COLUMN IF NOT EXISTS temp_steals INTEGER;

-- Steals mentése a temp oszlopba
UPDATE player_game_stats SET temp_steals = steals;

-- Steals és turnovers felcserélése
UPDATE player_game_stats 
SET steals = turnovers,
    turnovers = temp_steals
WHERE steals IS NOT NULL OR turnovers IS NOT NULL;

-- Temp oszlop törlése
ALTER TABLE player_game_stats DROP COLUMN IF EXISTS temp_steals;

-- Ellenőrzés: Összes játékos
SELECT 
  p.name,
  p.number,
  SUM(pgs.steals) as total_steals,
  SUM(pgs.turnovers) as total_turnovers,
  ROUND(AVG(pgs.steals), 1) as avg_steals,
  ROUND(AVG(pgs.turnovers), 1) as avg_turnovers
FROM players p
JOIN player_game_stats pgs ON p.id = pgs.player_id
GROUP BY p.id, p.name, p.number
ORDER BY total_steals DESC;

-- Ellenőrzés: Edosomwan statisztikái
SELECT 
  p.name,
  SUM(pgs.steals) as total_steals,
  SUM(pgs.turnovers) as total_turnovers
FROM players p
JOIN player_game_stats pgs ON p.id = pgs.player_id
WHERE p.name ILIKE '%Edosomwan%'
GROUP BY p.name;
