-- Csapatok támogatásának hozzáadása
-- Ezt futtatsd le a Supabase SQL Editor-ban

-- 1. TEAMS tábla létrehozása
CREATE TABLE IF NOT EXISTS teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  short_name TEXT NOT NULL UNIQUE,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. ASE csapat beszúrása (alapértelmezett/elsődleges)
INSERT INTO teams (name, short_name, is_primary)
VALUES ('ASE', 'ASE', true)
ON CONFLICT (name) DO NOTHING;

-- 3. RLS engedélyezése
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- 4. RLS policy-k
DROP POLICY IF EXISTS "Mindenki olvashatja a csapatokat" ON teams;
CREATE POLICY "Mindenki olvashatja a csapatokat"
  ON teams FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Csak authentikált felhasználók módosíthatnak" ON teams;
CREATE POLICY "Csak authentikált felhasználók módosíthatnak"
  ON teams FOR ALL
  USING (auth.role() = 'authenticated');

-- 5. Jogosultságok
GRANT SELECT ON teams TO anon, authenticated;
GRANT ALL ON teams TO authenticated;

-- 6. Ellenőrzés
SELECT * FROM teams;
