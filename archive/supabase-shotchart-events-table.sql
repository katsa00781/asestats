-- Hunbasket dobasesemenyek normalizalt tabla + jatekos osszerendeles
CREATE TABLE IF NOT EXISTS hunbasket_player_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  hunbasket_player_code TEXT NOT NULL,
  player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  player_name_raw TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hunbasket_player_links_unique UNIQUE (season_id, team_id, hunbasket_player_code)
);

CREATE INDEX IF NOT EXISTS idx_hunbasket_player_links_player_id ON hunbasket_player_links(player_id);
CREATE INDEX IF NOT EXISTS idx_hunbasket_player_links_team ON hunbasket_player_links(team_id);

CREATE TABLE IF NOT EXISTS hunbasket_shot_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_game_id UUID NOT NULL REFERENCES hunbasket_shotchart_raw(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  game_code TEXT NOT NULL,
  period INTEGER,
  event_order INTEGER,
  x NUMERIC(6,3),
  y NUMERIC(6,3),
  is_successful BOOLEAN,
  shot_side TEXT CHECK (shot_side IN ('home', 'away')),
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  hunbasket_player_code TEXT,
  player_name_raw TEXT,
  source_event JSONB NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hunbasket_shot_events_unique_event
    UNIQUE (season_id, game_code, period, event_order, hunbasket_player_code, x, y, is_successful)
);

CREATE INDEX IF NOT EXISTS idx_hunbasket_shot_events_raw_game ON hunbasket_shot_events(raw_game_id);
CREATE INDEX IF NOT EXISTS idx_hunbasket_shot_events_season ON hunbasket_shot_events(season_id);
CREATE INDEX IF NOT EXISTS idx_hunbasket_shot_events_game_code ON hunbasket_shot_events(game_code);
CREATE INDEX IF NOT EXISTS idx_hunbasket_shot_events_team ON hunbasket_shot_events(team_id);
CREATE INDEX IF NOT EXISTS idx_hunbasket_shot_events_player ON hunbasket_shot_events(player_id);

ALTER TABLE hunbasket_player_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE hunbasket_shot_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hunbasket_player_links' AND policyname = 'Enable read access for all users'
  ) THEN
    CREATE POLICY "Enable read access for all users" ON hunbasket_player_links
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hunbasket_player_links' AND policyname = 'Enable insert for all users'
  ) THEN
    CREATE POLICY "Enable insert for all users" ON hunbasket_player_links
      FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hunbasket_player_links' AND policyname = 'Enable update for all users'
  ) THEN
    CREATE POLICY "Enable update for all users" ON hunbasket_player_links
      FOR UPDATE USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hunbasket_player_links' AND policyname = 'Enable delete for all users'
  ) THEN
    CREATE POLICY "Enable delete for all users" ON hunbasket_player_links
      FOR DELETE USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hunbasket_shot_events' AND policyname = 'Enable read access for all users'
  ) THEN
    CREATE POLICY "Enable read access for all users" ON hunbasket_shot_events
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hunbasket_shot_events' AND policyname = 'Enable insert for all users'
  ) THEN
    CREATE POLICY "Enable insert for all users" ON hunbasket_shot_events
      FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hunbasket_shot_events' AND policyname = 'Enable update for all users'
  ) THEN
    CREATE POLICY "Enable update for all users" ON hunbasket_shot_events
      FOR UPDATE USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hunbasket_shot_events' AND policyname = 'Enable delete for all users'
  ) THEN
    CREATE POLICY "Enable delete for all users" ON hunbasket_shot_events
      FOR DELETE USING (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION set_hunbasket_player_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hunbasket_player_links_updated_at ON hunbasket_player_links;
CREATE TRIGGER trg_hunbasket_player_links_updated_at
BEFORE UPDATE ON hunbasket_player_links
FOR EACH ROW
EXECUTE FUNCTION set_hunbasket_player_links_updated_at();

CREATE OR REPLACE FUNCTION set_hunbasket_shot_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hunbasket_shot_events_updated_at ON hunbasket_shot_events;
CREATE TRIGGER trg_hunbasket_shot_events_updated_at
BEFORE UPDATE ON hunbasket_shot_events
FOR EACH ROW
EXECUTE FUNCTION set_hunbasket_shot_events_updated_at();
