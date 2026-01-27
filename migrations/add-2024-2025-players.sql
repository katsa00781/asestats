-- 2024/2025 szezon játékosainak hozzáadása
-- Ezek a játékosok a tavalyi szezonban játszottak

-- 1. Szezon ID lekérése
DO $$
DECLARE
  season_2024_id UUID;
BEGIN
  SELECT id INTO season_2024_id FROM seasons WHERE name = '2024/2025' LIMIT 1;
  
  IF season_2024_id IS NULL THEN
    RAISE EXCEPTION 'A 2024/2025 szezon nem található!';
  END IF;
  
  RAISE NOTICE '2024/2025 szezon ID: %', season_2024_id;
END $$;

-- 2. Játékosok beszúrása 2024/2025 szezonba
INSERT INTO players (number, name, birth_year, position, height, weight, season_id)
VALUES
  (0, 'CHANDLER III. John Watson', 1998, '1', 194, 82, (SELECT id FROM seasons WHERE name = '2024/2025')),
  (1, 'LOCKETT Eric Javon', 1995, '3', 196, 92, (SELECT id FROM seasons WHERE name = '2024/2025')),
  (5, 'DUKES Khalil Quinton', 1995, '1', 183, 82, (SELECT id FROM seasons WHERE name = '2024/2025')),
  (6, 'KOVÁCS Ákos', 1988, '1-2', 186, 75, (SELECT id FROM seasons WHERE name = '2024/2025')),
  (7, 'EILINGSFELD János', 1991, '4', 200, 103, (SELECT id FROM seasons WHERE name = '2024/2025')),
  (10, 'RÉVÉSZ Ádám', 1995, '5', 200, 108, (SELECT id FROM seasons WHERE name = '2024/2025')),
  (11, 'BENKE Szilárd', 1995, '2-3', 197, 95, (SELECT id FROM seasons WHERE name = '2024/2025')),
  (12, 'HALMAI Dániel', 2004, '1', 184, 80, (SELECT id FROM seasons WHERE name = '2024/2025')),
  (13, 'GÉRINGER Gergő', 2005, '3-4', 198, 97, (SELECT id FROM seasons WHERE name = '2024/2025')),
  (15, 'ARNOLD Botond', 2003, '5-4', 206, 105, (SELECT id FROM seasons WHERE name = '2024/2025')),
  (17, 'KÉKESI Kolos', 2006, '2-1', 189, 90, (SELECT id FROM seasons WHERE name = '2024/2025')),
  (19, 'DOROGI Gergő', 2000, '4-5', 201, 100, (SELECT id FROM seasons WHERE name = '2024/2025')),
  (20, 'LAKE De''Quon', 1997, '5', 208, 102, (SELECT id FROM seasons WHERE name = '2024/2025')),
  (30, 'KUCSORA Csaba Ákos', 1998, '3-2', 188, 85, (SELECT id FROM seasons WHERE name = '2024/2025'))
ON CONFLICT (number, season_id) DO UPDATE SET
  position = EXCLUDED.position,
  birth_year = EXCLUDED.birth_year,
  height = EXCLUDED.height,
  weight = EXCLUDED.weight;

-- 3. Ellenőrzés
SELECT 
  p.number,
  p.name,
  p.position,
  s.name as season_name
FROM players p
JOIN seasons s ON p.season_id = s.id
WHERE s.name = '2024/2025'
ORDER BY p.number;

-- 4. Összesítés
SELECT 
  s.name as season_name,
  COUNT(*) as player_count
FROM players p
JOIN seasons s ON p.season_id = s.id
GROUP BY s.name
ORDER BY s.name DESC;
