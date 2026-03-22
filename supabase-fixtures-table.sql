-- League fixtures table for full season schedule import (played + upcoming)
CREATE TABLE IF NOT EXISTS league_fixtures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  round INTEGER,
  game_date DATE NOT NULL,
  home_team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  away_team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  home_score INTEGER,
  away_score INTEGER,
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'played', 'postponed', 'cancelled')) DEFAULT 'scheduled',
  source_url TEXT,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT league_fixtures_distinct_teams CHECK (home_team_id <> away_team_id),
  CONSTRAINT league_fixtures_unique_match UNIQUE (season_id, game_date, home_team_id, away_team_id)
);

CREATE INDEX IF NOT EXISTS idx_league_fixtures_season_date ON league_fixtures(season_id, game_date);
CREATE INDEX IF NOT EXISTS idx_league_fixtures_status ON league_fixtures(status);

ALTER TABLE league_fixtures ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'league_fixtures' AND policyname = 'Enable read access for all users'
  ) THEN
    CREATE POLICY "Enable read access for all users" ON league_fixtures
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'league_fixtures' AND policyname = 'Enable insert for all users'
  ) THEN
    CREATE POLICY "Enable insert for all users" ON league_fixtures
      FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'league_fixtures' AND policyname = 'Enable update for all users'
  ) THEN
    CREATE POLICY "Enable update for all users" ON league_fixtures
      FOR UPDATE USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'league_fixtures' AND policyname = 'Enable delete for all users'
  ) THEN
    CREATE POLICY "Enable delete for all users" ON league_fixtures
      FOR DELETE USING (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION set_league_fixtures_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_league_fixtures_updated_at ON league_fixtures;
CREATE TRIGGER trg_league_fixtures_updated_at
BEFORE UPDATE ON league_fixtures
FOR EACH ROW
EXECUTE FUNCTION set_league_fixtures_updated_at();
