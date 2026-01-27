-- Games tábla módosítása csapat támogatáshoz
-- Futtatsd le az add-teams-to-players.sql UTÁN!

-- 1. Oszlopok hozzáadása
ALTER TABLE games
ADD COLUMN IF NOT EXISTS our_team_id UUID REFERENCES teams(id) ON DELETE CASCADE;

-- 2. Index létrehozása
CREATE INDEX IF NOT EXISTS idx_games_our_team_id ON games(our_team_id);

-- 3. Meglévő meccsek ASE csapathoz rendelése
UPDATE games
SET our_team_id = (SELECT id FROM teams WHERE is_primary = true)
WHERE our_team_id IS NULL;

-- 4. Ellenőrzés
DO $$
DECLARE
  games_without_team INTEGER;
BEGIN
  SELECT COUNT(*) INTO games_without_team
  FROM games
  WHERE our_team_id IS NULL;
  
  IF games_without_team > 0 THEN
    RAISE EXCEPTION 'Van % meccs our_team_id nélkül!', games_without_team;
  END IF;
  
  RAISE NOTICE 'Minden meccsnek van our_team_id-je ✓';
END $$;

-- 5. our_team_id NOT NULL constraint
ALTER TABLE games
ALTER COLUMN our_team_id SET NOT NULL;

-- 6. Ellenőrzés
SELECT 
  t.name as team_name,
  s.name as season_name,
  COUNT(g.id) as game_count
FROM games g
JOIN teams t ON g.our_team_id = t.id
JOIN seasons s ON g.season_id = s.id
GROUP BY t.name, s.name
ORDER BY t.name, s.name DESC;
