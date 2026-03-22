-- Hunbasket dobasterkep nyers adatok (meccs-szintu JSON snapshot)
CREATE TABLE IF NOT EXISTS hunbasket_shotchart_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  game_code TEXT NOT NULL,
  league_code TEXT NOT NULL DEFAULT 'hun',
  season_slug TEXT NOT NULL,
  match_url TEXT NOT NULL,
  game_date DATE,
  round INTEGER,
  home_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  away_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  home_team TEXT,
  away_team TEXT,
  home_score INTEGER,
  away_score INTEGER,
  shotchart_data JSONB NOT NULL,
  event_count INTEGER NOT NULL DEFAULT 0,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hunbasket_shotchart_raw_unique_game UNIQUE (season_id, game_code)
);

CREATE INDEX IF NOT EXISTS idx_hunbasket_shotchart_raw_season ON hunbasket_shotchart_raw(season_id);
CREATE INDEX IF NOT EXISTS idx_hunbasket_shotchart_raw_imported_at ON hunbasket_shotchart_raw(imported_at DESC);
CREATE INDEX IF NOT EXISTS idx_hunbasket_shotchart_raw_game_date ON hunbasket_shotchart_raw(game_date DESC);
CREATE INDEX IF NOT EXISTS idx_hunbasket_shotchart_raw_home_team_id ON hunbasket_shotchart_raw(home_team_id);
CREATE INDEX IF NOT EXISTS idx_hunbasket_shotchart_raw_away_team_id ON hunbasket_shotchart_raw(away_team_id);

ALTER TABLE hunbasket_shotchart_raw ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hunbasket_shotchart_raw' AND policyname = 'Enable read access for all users'
  ) THEN
    CREATE POLICY "Enable read access for all users" ON hunbasket_shotchart_raw
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hunbasket_shotchart_raw' AND policyname = 'Enable insert for all users'
  ) THEN
    CREATE POLICY "Enable insert for all users" ON hunbasket_shotchart_raw
      FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hunbasket_shotchart_raw' AND policyname = 'Enable update for all users'
  ) THEN
    CREATE POLICY "Enable update for all users" ON hunbasket_shotchart_raw
      FOR UPDATE USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hunbasket_shotchart_raw' AND policyname = 'Enable delete for all users'
  ) THEN
    CREATE POLICY "Enable delete for all users" ON hunbasket_shotchart_raw
      FOR DELETE USING (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION set_hunbasket_shotchart_raw_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hunbasket_shotchart_raw_updated_at ON hunbasket_shotchart_raw;
CREATE TRIGGER trg_hunbasket_shotchart_raw_updated_at
BEFORE UPDATE ON hunbasket_shotchart_raw
FOR EACH ROW
EXECUTE FUNCTION set_hunbasket_shotchart_raw_updated_at();
