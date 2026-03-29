-- Kosarstat game oldalak (game, game_lineups, stb.) nyers + tabla szintu tarolasa
CREATE TABLE IF NOT EXISTS kosarstat_game_pages_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  kosarstat_season_code TEXT NOT NULL,
  kosarstat_game_id TEXT NOT NULL,
  page_type TEXT NOT NULL,
  source_url TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  competition_season_label TEXT,
  competition_phase TEXT,
  match_date DATE,
  home_team_name TEXT,
  away_team_name TEXT,
  home_score INTEGER,
  away_score INTEGER,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT kosarstat_game_pages_raw_unique UNIQUE (season_id, kosarstat_game_id, page_type)
);

ALTER TABLE kosarstat_game_pages_raw
  ADD COLUMN IF NOT EXISTS competition_season_label TEXT;
ALTER TABLE kosarstat_game_pages_raw
  ADD COLUMN IF NOT EXISTS competition_phase TEXT;
ALTER TABLE kosarstat_game_pages_raw
  ADD COLUMN IF NOT EXISTS match_date DATE;
ALTER TABLE kosarstat_game_pages_raw
  ADD COLUMN IF NOT EXISTS home_team_name TEXT;
ALTER TABLE kosarstat_game_pages_raw
  ADD COLUMN IF NOT EXISTS away_team_name TEXT;
ALTER TABLE kosarstat_game_pages_raw
  ADD COLUMN IF NOT EXISTS home_score INTEGER;
ALTER TABLE kosarstat_game_pages_raw
  ADD COLUMN IF NOT EXISTS away_score INTEGER;

CREATE INDEX IF NOT EXISTS idx_kosarstat_game_pages_raw_season
  ON kosarstat_game_pages_raw(season_id);
CREATE INDEX IF NOT EXISTS idx_kosarstat_game_pages_raw_game
  ON kosarstat_game_pages_raw(kosarstat_game_id);
CREATE INDEX IF NOT EXISTS idx_kosarstat_game_pages_raw_match_date
  ON kosarstat_game_pages_raw(season_id, page_type, match_date);

ALTER TABLE games
  ADD COLUMN IF NOT EXISTS kosarstat_game_id TEXT;

CREATE INDEX IF NOT EXISTS idx_games_kosarstat_game_id
  ON games(kosarstat_game_id);

CREATE TABLE IF NOT EXISTS kosarstat_game_page_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_raw_id UUID NOT NULL REFERENCES kosarstat_game_pages_raw(id) ON DELETE CASCADE,
  table_index INTEGER NOT NULL,
  source_table_dom_id TEXT,
  source_table_dom_class TEXT,
  heading_text TEXT,
  headers JSONB NOT NULL DEFAULT '[]'::JSONB,
  rows JSONB NOT NULL DEFAULT '[]'::JSONB,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT kosarstat_game_page_tables_unique UNIQUE (page_raw_id, table_index)
);

CREATE INDEX IF NOT EXISTS idx_kosarstat_game_page_tables_page_raw
  ON kosarstat_game_page_tables(page_raw_id);

ALTER TABLE kosarstat_game_page_tables
  ADD COLUMN IF NOT EXISTS source_table_dom_id TEXT;
ALTER TABLE kosarstat_game_page_tables
  ADD COLUMN IF NOT EXISTS source_table_dom_class TEXT;

CREATE INDEX IF NOT EXISTS idx_kosarstat_game_page_tables_dom_id
  ON kosarstat_game_page_tables(source_table_dom_id);

ALTER TABLE kosarstat_game_pages_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE kosarstat_game_page_tables ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'kosarstat_game_pages_raw' AND policyname = 'Enable read access for all users'
  ) THEN
    CREATE POLICY "Enable read access for all users" ON kosarstat_game_pages_raw
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'kosarstat_game_pages_raw' AND policyname = 'Enable insert for all users'
  ) THEN
    CREATE POLICY "Enable insert for all users" ON kosarstat_game_pages_raw
      FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'kosarstat_game_pages_raw' AND policyname = 'Enable update for all users'
  ) THEN
    CREATE POLICY "Enable update for all users" ON kosarstat_game_pages_raw
      FOR UPDATE USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'kosarstat_game_pages_raw' AND policyname = 'Enable delete for all users'
  ) THEN
    CREATE POLICY "Enable delete for all users" ON kosarstat_game_pages_raw
      FOR DELETE USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'kosarstat_game_page_tables' AND policyname = 'Enable read access for all users'
  ) THEN
    CREATE POLICY "Enable read access for all users" ON kosarstat_game_page_tables
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'kosarstat_game_page_tables' AND policyname = 'Enable insert for all users'
  ) THEN
    CREATE POLICY "Enable insert for all users" ON kosarstat_game_page_tables
      FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'kosarstat_game_page_tables' AND policyname = 'Enable update for all users'
  ) THEN
    CREATE POLICY "Enable update for all users" ON kosarstat_game_page_tables
      FOR UPDATE USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'kosarstat_game_page_tables' AND policyname = 'Enable delete for all users'
  ) THEN
    CREATE POLICY "Enable delete for all users" ON kosarstat_game_page_tables
      FOR DELETE USING (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION set_kosarstat_game_pages_raw_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_kosarstat_game_pages_raw_updated_at ON kosarstat_game_pages_raw;
CREATE TRIGGER trg_kosarstat_game_pages_raw_updated_at
BEFORE UPDATE ON kosarstat_game_pages_raw
FOR EACH ROW
EXECUTE FUNCTION set_kosarstat_game_pages_raw_updated_at();

CREATE OR REPLACE FUNCTION set_kosarstat_game_page_tables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_kosarstat_game_page_tables_updated_at ON kosarstat_game_page_tables;
CREATE TRIGGER trg_kosarstat_game_page_tables_updated_at
BEFORE UPDATE ON kosarstat_game_page_tables
FOR EACH ROW
EXECUTE FUNCTION set_kosarstat_game_page_tables_updated_at();