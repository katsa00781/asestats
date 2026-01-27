-- Tabella (standings) tábla létrehozása
CREATE TABLE IF NOT EXISTS standings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matchday INTEGER NOT NULL UNIQUE,
  date DATE NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index a fordulóra
CREATE INDEX IF NOT EXISTS idx_standings_matchday ON standings(matchday);

-- Index a dátumra
CREATE INDEX IF NOT EXISTS idx_standings_date ON standings(date);

-- RLS (Row Level Security) engedélyezése
ALTER TABLE standings ENABLE ROW LEVEL SECURITY;

-- Policy: mindenki olvashat
CREATE POLICY "Enable read access for all users" ON standings
  FOR SELECT USING (true);

-- Policy: mindenki írhat (public használat esetén, később finomhangolható)
CREATE POLICY "Enable insert for all users" ON standings
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON standings
  FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" ON standings
  FOR DELETE USING (true);

-- Komment a táblához
COMMENT ON TABLE standings IS 'Bajnokság tabella fordulónként';
COMMENT ON COLUMN standings.matchday IS 'Forduló száma';
COMMENT ON COLUMN standings.date IS 'A forduló dátuma';
COMMENT ON COLUMN standings.data IS 'Tabella adatok JSON formátumban';
