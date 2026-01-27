-- Pozíciók egységesítése numerikus formátumra
-- Az összes csapat játékosainál egységesen 1-5 számok legyenek

-- G (Guard) -> 1 vagy 2
-- F (Forward) -> 3 vagy 4  
-- C (Center) -> 5
-- Összetett pozíciók: G-F -> 2-3, F-C -> 4-5, stb.

BEGIN;

-- Ellenőrizzük, milyen pozíciók vannak
SELECT DISTINCT position, COUNT(*) as count
FROM players
GROUP BY position
ORDER BY position;

-- Frissítjük a G pozíciókat -> 1-2 (Guard általában irányító vagy dobóhátvéd)
UPDATE players
SET position = '1-2'
WHERE position = 'G';

-- Frissítjük az F pozíciókat -> 3-4 (Forward általában szélső vagy erőcsatár)
UPDATE players
SET position = '3-4'
WHERE position = 'F';

-- Frissítjük a C pozíciókat -> 5 (Center)
UPDATE players
SET position = '5'
WHERE position = 'C';

-- Ellenőrizzük az eredményt
SELECT DISTINCT position, COUNT(*) as count
FROM players
GROUP BY position
ORDER BY position;

COMMIT;
