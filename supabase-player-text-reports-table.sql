-- Jatekos szoveges riportok (szezon / egyedi elemzes mentes)
CREATE TABLE IF NOT EXISTS player_text_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL DEFAULT 'season',
  narrative TEXT NOT NULL,
  analysis_snapshot JSONB,
  generated_by TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT player_text_reports_unique UNIQUE (season_id, team_id, player_id, report_type)
);

CREATE INDEX IF NOT EXISTS idx_player_text_reports_season ON player_text_reports(season_id);
CREATE INDEX IF NOT EXISTS idx_player_text_reports_team ON player_text_reports(team_id);
CREATE INDEX IF NOT EXISTS idx_player_text_reports_player ON player_text_reports(player_id);
CREATE INDEX IF NOT EXISTS idx_player_text_reports_generated_at ON player_text_reports(generated_at DESC);

ALTER TABLE player_text_reports ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'player_text_reports' AND policyname = 'Enable read access for all users'
  ) THEN
    CREATE POLICY "Enable read access for all users" ON player_text_reports
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'player_text_reports' AND policyname = 'Enable insert for all users'
  ) THEN
    CREATE POLICY "Enable insert for all users" ON player_text_reports
      FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'player_text_reports' AND policyname = 'Enable update for all users'
  ) THEN
    CREATE POLICY "Enable update for all users" ON player_text_reports
      FOR UPDATE USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'player_text_reports' AND policyname = 'Enable delete for all users'
  ) THEN
    CREATE POLICY "Enable delete for all users" ON player_text_reports
      FOR DELETE USING (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION set_player_text_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_player_text_reports_updated_at ON player_text_reports;
CREATE TRIGGER trg_player_text_reports_updated_at
BEFORE UPDATE ON player_text_reports
FOR EACH ROW
EXECUTE FUNCTION set_player_text_reports_updated_at();
