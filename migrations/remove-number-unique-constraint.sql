-- Eltávolítjuk a mezszám unique constraintet
-- Így több játékos is lehet ugyanazzal a mezszámmal egy csapatban

ALTER TABLE players 
DROP CONSTRAINT IF EXISTS players_number_season_team_unique;

-- Megjegyzés: Ezután a játékosok azonosítása csak név + mezszám + csapat alapján történik
