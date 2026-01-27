-- Szezon hozzáadása a játékosokhoz
-- Ez megoldja a mezszám keveredés problémáját
-- 
-- FONTOS: Ezt a scriptet CSAK az add-season-support.sql lefutása UTÁN futtatd!
--

-- 0. Ellenőrzés: létezik-e a seasons tábla és van-e current szezon
DO $$
DECLARE
  table_exists BOOLEAN;
  current_season_id UUID;
BEGIN
  -- Ellenőrizzük, létezik-e a seasons tábla
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'seasons'
  ) INTO table_exists;
  
  IF NOT table_exists THEN
    RAISE EXCEPTION 'A seasons tábla nem létezik! Először futtasd le az add-season-support.sql migrációt!';
  END IF;
  
  -- Ellenőrizzük, van-e current szezon
  SELECT id INTO current_season_id FROM seasons WHERE is_current = true LIMIT 1;
  
  IF current_season_id IS NULL THEN
    -- Ha nincs current szezon, a 2025/2026-ot állítjuk be
    RAISE NOTICE '⚠ Nincs current szezon, beállítom a 2025/2026-ot...';
    
    UPDATE seasons SET is_current = true WHERE name = '2025/2026';
    
    SELECT id INTO current_season_id FROM seasons WHERE is_current = true LIMIT 1;
    
    IF current_season_id IS NULL THEN
      RAISE EXCEPTION 'A 2025/2026 szezon nem található! Először futtasd le az add-season-support-PART1.sql migrációt!';
    END IF;
  END IF;
  
  RAISE NOTICE '✓ Seasons tábla létezik';
  RAISE NOTICE '✓ Current szezon ID: %', current_season_id;
END $$;

-- 1. Season_id hozzáadása a players táblához
ALTER TABLE players 
  ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES seasons(id) ON DELETE CASCADE;

-- 2. Töröljük a régi UNIQUE constraint-et (csak mezszám)
ALTER TABLE players 
  DROP CONSTRAINT IF EXISTS players_number_key;

-- 3. Új UNIQUE constraint: mezszám + szezon kombinációja egyedi
ALTER TABLE players
  ADD CONSTRAINT players_number_season_unique UNIQUE (number, season_id);

-- 4. Index a gyorsabb lekérdezésekhez
CREATE INDEX IF NOT EXISTS idx_players_season_id ON players(season_id);

-- 5. Ellenőrizzük a jelenlegi szezont
DO $$
DECLARE
  current_season_id UUID;
BEGIN
  SELECT id INTO current_season_id FROM seasons WHERE is_current = true LIMIT 1;
  
  IF current_season_id IS NULL THEN
    RAISE EXCEPTION 'Nincs current szezon! Először futtasd le az add-season-support.sql-t!';
  END IF;
  
  RAISE NOTICE 'Jelenlegi szezon ID: %', current_season_id;
END $$;

-- 6. Meglévő játékosok hozzárendelése a jelenlegi szezonhoz
UPDATE players 
SET season_id = (SELECT id FROM seasons WHERE is_current = true LIMIT 1)
WHERE season_id IS NULL;

-- 7. Ellenőrizzük, hogy minden játékos kapott-e season_id-t
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count FROM players WHERE season_id IS NULL;
  
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Még mindig van % játékos NULL season_id-val!', null_count;
  ELSE
    RAISE NOTICE 'Minden játékos kapott season_id-t ✓';
  END IF;
END $$;

-- 8. Season_id mezőt kötelezővé tesszük (csak az update után!)
ALTER TABLE players
  ALTER COLUMN season_id SET NOT NULL;

-- ELLENŐRZÉS:
-- Játékosok szezon szerint
SELECT 
  s.name as season_name,
  COUNT(DISTINCT p.id) as player_count,
  COUNT(DISTINCT p.number) as unique_numbers
FROM players p
JOIN seasons s ON p.season_id = s.id
GROUP BY s.name, s.start_date
ORDER BY s.start_date DESC;

-- Duplikált mezszámok ellenőrzése (üresnek kell lennie)
SELECT 
  p.number,
  s.name as season_name,
  COUNT(*) as count
FROM players p
JOIN seasons s ON p.season_id = s.id
GROUP BY p.number, s.name
HAVING COUNT(*) > 1;
