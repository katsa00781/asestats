-- Egyszerű lekérdezés: milyen pozíciók vannak az adatbázisban
SELECT DISTINCT position, COUNT(*) as count
FROM players
GROUP BY position
ORDER BY position;
