-- Standings tábla RLS policy javítása
-- Futtasd le a Supabase SQL Editor-ban

-- 1. RLS engedélyezése (ha még nincs)
ALTER TABLE standings ENABLE ROW LEVEL SECURITY;

-- 2. Meglévő policy-k törlése (ha vannak)
DROP POLICY IF EXISTS "Mindenki olvashatja a standings-ot" ON standings;
DROP POLICY IF EXISTS "Csak authentikált felhasználók módosíthatnak" ON standings;

-- 3. Új policy-k létrehozása
CREATE POLICY "Mindenki olvashatja a standings-ot"
  ON standings FOR SELECT
  USING (true);

CREATE POLICY "Csak authentikált felhasználók módosíthatnak"
  ON standings FOR ALL
  USING (auth.role() = 'authenticated');

-- 4. Jogosultságok
GRANT SELECT ON standings TO anon, authenticated;
GRANT ALL ON standings TO authenticated;

-- 5. Ellenőrzés
SELECT * FROM standings LIMIT 5;
