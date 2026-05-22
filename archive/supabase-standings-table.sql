-- Tabella (standings) tábla létrehozása
CREATE TABLE IF NOT EXISTS standings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID REFERENCES seasons(id) ON DELETE CASCADE,
  matchday INTEGER NOT NULL,
  date DATE NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE standings
  ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES seasons(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'standings_matchday_key'
      AND conrelid = 'public.standings'::regclass
  ) THEN
    ALTER TABLE standings DROP CONSTRAINT standings_matchday_key;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'standings_season_matchday_key'
      AND conrelid = 'public.standings'::regclass
  ) THEN
    ALTER TABLE standings ADD CONSTRAINT standings_season_matchday_key UNIQUE (season_id, matchday);
  END IF;
END $$;

-- Index a fordulóra
CREATE INDEX IF NOT EXISTS idx_standings_matchday ON standings(matchday);
CREATE INDEX IF NOT EXISTS idx_standings_season_matchday ON standings(season_id, matchday);

-- Index a dátumra
CREATE INDEX IF NOT EXISTS idx_standings_date ON standings(date);

-- RLS (Row Level Security) engedélyezése
ALTER TABLE standings ENABLE ROW LEVEL SECURITY;

-- Policy: mindenki olvashat
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'standings'
      AND policyname = 'Enable read access for all users'
  ) THEN
    CREATE POLICY "Enable read access for all users" ON standings
      FOR SELECT USING (true);
  END IF;
END $$;

-- Policy: mindenki írhat (public használat esetén, később finomhangolható)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'standings'
      AND policyname = 'Enable insert for all users'
  ) THEN
    CREATE POLICY "Enable insert for all users" ON standings
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'standings'
      AND policyname = 'Enable update for all users'
  ) THEN
    CREATE POLICY "Enable update for all users" ON standings
      FOR UPDATE USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'standings'
      AND policyname = 'Enable delete for all users'
  ) THEN
    CREATE POLICY "Enable delete for all users" ON standings
      FOR DELETE USING (true);
  END IF;
END $$;

-- Komment a táblához
COMMENT ON TABLE standings IS 'Bajnokság tabella fordulónként';
COMMENT ON COLUMN standings.matchday IS 'Forduló száma';
COMMENT ON COLUMN standings.date IS 'A forduló dátuma';
COMMENT ON COLUMN standings.data IS 'Tabella adatok JSON formátumban';
