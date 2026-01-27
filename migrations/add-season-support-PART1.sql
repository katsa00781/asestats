-- PART 1: Szezon támogatás - CSAK tábla és trigger létrehozás (VIEW NÉLKÜL!)
-- Ezt futtatsd le ELŐSZÖR

-- 1. Szezonok tábla létrehozása
CREATE TABLE IF NOT EXISTS seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE, -- pl. "2024/2025", "2023/2024"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 2. Season mező hozzáadása a games táblához
ALTER TABLE games 
  ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES seasons(id) ON DELETE SET NULL;

-- 3. Index a gyorsabb szezon alapú lekérdezésekhez
CREATE INDEX IF NOT EXISTS idx_games_season_id ON games(season_id);

-- 4. Alapértelmezett szezon létrehozása (jelenlegi szezon)
INSERT INTO seasons (name, start_date, end_date, is_current)
VALUES ('2025/2026', '2025-09-01', '2026-05-31', true)
ON CONFLICT (name) DO NOTHING;

-- 5. Meglévő meccsek hozzárendelése a jelenlegi szezonhoz
UPDATE games 
SET season_id = (SELECT id FROM seasons WHERE is_current = true LIMIT 1)
WHERE season_id IS NULL;

-- 6. Trigger: csak egy szezon lehet current egyszerre
CREATE OR REPLACE FUNCTION ensure_single_current_season()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_current = true THEN
    UPDATE seasons SET is_current = false WHERE id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ensure_single_current_season ON seasons;

CREATE TRIGGER trigger_ensure_single_current_season
  BEFORE INSERT OR UPDATE ON seasons
  FOR EACH ROW
  WHEN (NEW.is_current = true)
  EXECUTE FUNCTION ensure_single_current_season();

-- 7. Updated_at trigger a seasons táblához
DROP TRIGGER IF EXISTS update_seasons_updated_at ON seasons;

CREATE TRIGGER update_seasons_updated_at 
  BEFORE UPDATE ON seasons
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- 8. RLS policy a seasons táblához
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON seasons;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON seasons;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON seasons;

CREATE POLICY "Enable read access for all users" ON seasons
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON seasons
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users only" ON seasons
  FOR UPDATE USING (auth.role() = 'authenticated');

-- 9. Jogosultságok beállítása
GRANT SELECT ON seasons TO anon, authenticated;

-- ELLENŐRZÉS:
SELECT 
  name as season_name,
  is_current,
  start_date,
  end_date
FROM seasons
ORDER BY start_date DESC;
