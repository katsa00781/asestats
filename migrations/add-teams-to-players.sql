-- Players tábla módosítása csapat támogatáshoz
-- Futtatsd le CSAK az add-teams-support.sql UTÁN!

-- 1. Ellenőrzés: létezik-e a teams tábla
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'teams') THEN
    RAISE EXCEPTION 'A teams tábla nem létezik! Futtasd le először az add-teams-support.sql-t!';
  END IF;
END $$;

-- 2. team_id oszlop hozzáadása
ALTER TABLE players
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE CASCADE;

-- 3. Index létrehozása
CREATE INDEX IF NOT EXISTS idx_players_team_id ON players(team_id);

-- 4. Meglévő játékosok ASE csapathoz rendelése
UPDATE players
SET team_id = (SELECT id FROM teams WHERE is_primary = true)
WHERE team_id IS NULL;

-- 5. Ellenőrzés: minden játékosnak van-e team_id-je
DO $$
DECLARE
  players_without_team INTEGER;
BEGIN
  SELECT COUNT(*) INTO players_without_team
  FROM players
  WHERE team_id IS NULL;
  
  IF players_without_team > 0 THEN
    RAISE EXCEPTION 'Van % játékos team_id nélkül!', players_without_team;
  END IF;
  
  RAISE NOTICE 'Minden játékosnak van team_id-je ✓';
END $$;

-- 6. team_id NOT NULL constraint
ALTER TABLE players
ALTER COLUMN team_id SET NOT NULL;

-- 7. UNIQUE constraint módosítása: number + season_id + team_id
ALTER TABLE players
DROP CONSTRAINT IF EXISTS players_number_season_unique;

ALTER TABLE players
DROP CONSTRAINT IF EXISTS players_number_season_team_unique;

ALTER TABLE players
ADD CONSTRAINT players_number_season_team_unique 
UNIQUE (number, season_id, team_id);

-- 8. Ellenőrzés
SELECT 
  t.name as team_name,
  s.name as season_name,
  COUNT(p.id) as player_count
FROM players p
JOIN teams t ON p.team_id = t.id
JOIN seasons s ON p.season_id = s.id
GROUP BY t.name, s.name
ORDER BY t.name, s.name DESC;
