-- Hunbasket play-by-play eventlista: raw oldal + normalizalt esemenyek
CREATE TABLE IF NOT EXISTS hunbasket_pbp_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_game_id UUID REFERENCES hunbasket_shotchart_raw(id) ON DELETE SET NULL,
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  game_code TEXT NOT NULL,
  league_code TEXT NOT NULL DEFAULT 'hun',
  season_slug TEXT NOT NULL,
  event_list_url TEXT NOT NULL,
  match_url TEXT,
  home_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  away_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  raw_text TEXT NOT NULL,
  event_count INTEGER NOT NULL DEFAULT 0,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hunbasket_pbp_raw_unique_game UNIQUE (season_id, game_code)
);

CREATE INDEX IF NOT EXISTS idx_hunbasket_pbp_raw_season ON hunbasket_pbp_raw(season_id);
CREATE INDEX IF NOT EXISTS idx_hunbasket_pbp_raw_game_code ON hunbasket_pbp_raw(game_code);
CREATE INDEX IF NOT EXISTS idx_hunbasket_pbp_raw_imported_at ON hunbasket_pbp_raw(imported_at DESC);

CREATE TABLE IF NOT EXISTS hunbasket_pbp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_pbp_id UUID NOT NULL REFERENCES hunbasket_pbp_raw(id) ON DELETE CASCADE,
  raw_game_id UUID REFERENCES hunbasket_shotchart_raw(id) ON DELETE SET NULL,
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  game_code TEXT NOT NULL,
  event_order INTEGER NOT NULL,
  period INTEGER,
  clock_text TEXT,
  clock_seconds_remaining INTEGER,
  home_score INTEGER,
  away_score INTEGER,
  score_margin INTEGER,
  event_type TEXT,
  event_text TEXT,
  team_side TEXT CHECK (team_side IN ('home', 'away')),
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  player_name_raw TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::JSONB,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hunbasket_pbp_events_unique_event UNIQUE (season_id, game_code, event_order)
);

CREATE INDEX IF NOT EXISTS idx_hunbasket_pbp_events_raw_pbp ON hunbasket_pbp_events(raw_pbp_id);
CREATE INDEX IF NOT EXISTS idx_hunbasket_pbp_events_raw_game ON hunbasket_pbp_events(raw_game_id);
CREATE INDEX IF NOT EXISTS idx_hunbasket_pbp_events_season ON hunbasket_pbp_events(season_id);
CREATE INDEX IF NOT EXISTS idx_hunbasket_pbp_events_game_code ON hunbasket_pbp_events(game_code);
CREATE INDEX IF NOT EXISTS idx_hunbasket_pbp_events_team ON hunbasket_pbp_events(team_id);
CREATE INDEX IF NOT EXISTS idx_hunbasket_pbp_events_player ON hunbasket_pbp_events(player_id);
CREATE INDEX IF NOT EXISTS idx_hunbasket_pbp_events_period_clock ON hunbasket_pbp_events(period, clock_seconds_remaining DESC);
CREATE INDEX IF NOT EXISTS idx_hunbasket_pbp_events_event_type ON hunbasket_pbp_events(event_type);

ALTER TABLE hunbasket_pbp_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE hunbasket_pbp_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hunbasket_pbp_raw' AND policyname = 'Enable read access for all users'
  ) THEN
    CREATE POLICY "Enable read access for all users" ON hunbasket_pbp_raw
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hunbasket_pbp_raw' AND policyname = 'Enable insert for all users'
  ) THEN
    CREATE POLICY "Enable insert for all users" ON hunbasket_pbp_raw
      FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hunbasket_pbp_raw' AND policyname = 'Enable update for all users'
  ) THEN
    CREATE POLICY "Enable update for all users" ON hunbasket_pbp_raw
      FOR UPDATE USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hunbasket_pbp_raw' AND policyname = 'Enable delete for all users'
  ) THEN
    CREATE POLICY "Enable delete for all users" ON hunbasket_pbp_raw
      FOR DELETE USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hunbasket_pbp_events' AND policyname = 'Enable read access for all users'
  ) THEN
    CREATE POLICY "Enable read access for all users" ON hunbasket_pbp_events
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hunbasket_pbp_events' AND policyname = 'Enable insert for all users'
  ) THEN
    CREATE POLICY "Enable insert for all users" ON hunbasket_pbp_events
      FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hunbasket_pbp_events' AND policyname = 'Enable update for all users'
  ) THEN
    CREATE POLICY "Enable update for all users" ON hunbasket_pbp_events
      FOR UPDATE USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hunbasket_pbp_events' AND policyname = 'Enable delete for all users'
  ) THEN
    CREATE POLICY "Enable delete for all users" ON hunbasket_pbp_events
      FOR DELETE USING (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION set_hunbasket_pbp_raw_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hunbasket_pbp_raw_updated_at ON hunbasket_pbp_raw;
CREATE TRIGGER trg_hunbasket_pbp_raw_updated_at
BEFORE UPDATE ON hunbasket_pbp_raw
FOR EACH ROW
EXECUTE FUNCTION set_hunbasket_pbp_raw_updated_at();

CREATE OR REPLACE FUNCTION set_hunbasket_pbp_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hunbasket_pbp_events_updated_at ON hunbasket_pbp_events;
CREATE TRIGGER trg_hunbasket_pbp_events_updated_at
BEFORE UPDATE ON hunbasket_pbp_events
FOR EACH ROW
EXECUTE FUNCTION set_hunbasket_pbp_events_updated_at();