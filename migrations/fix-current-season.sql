-- GYORS FIX: Beállítja a 2025/2026 szezont current-nek
-- Futtasd le ezt, majd utána az add-season-to-players.sql-t

-- 1. Először minden szezont false-ra állítunk
UPDATE seasons SET is_current = false;

-- 2. A 2025/2026-ot true-ra állítjuk
UPDATE seasons SET is_current = true WHERE name = '2025/2026';

-- 3. Ellenőrzés
SELECT 
  name,
  is_current,
  CASE WHEN is_current THEN '✓ CURRENT' ELSE '' END as status
FROM seasons
ORDER BY start_date DESC;
