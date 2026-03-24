-- Team-level season text reports storage (LLM output)

CREATE TABLE IF NOT EXISTS team_text_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id text NOT NULL,
  team_id text NOT NULL,
  report_type text NOT NULL DEFAULT 'season',
  narrative text NOT NULL,
  analysis_snapshot jsonb,
  generated_by text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_text_reports_unique UNIQUE (season_id, team_id, report_type)
);

ALTER TABLE team_text_reports
  DROP CONSTRAINT IF EXISTS team_text_reports_report_type_check;

ALTER TABLE team_text_reports
  ADD CONSTRAINT team_text_reports_report_type_check
  CHECK (report_type IN ('season', 'season_fan', 'season_coach', 'season_scouting'));

-- Legacy compatibility: migrate generic season rows to fan preset.
-- If a season_fan row already exists for the same season/team, drop the legacy season row first.
DELETE FROM team_text_reports legacy
USING team_text_reports fan
WHERE legacy.season_id = fan.season_id
  AND legacy.team_id = fan.team_id
  AND legacy.report_type = 'season'
  AND fan.report_type = 'season_fan';

UPDATE team_text_reports
SET report_type = 'season_fan'
WHERE report_type = 'season';

CREATE INDEX IF NOT EXISTS idx_team_text_reports_season ON team_text_reports(season_id);
CREATE INDEX IF NOT EXISTS idx_team_text_reports_team ON team_text_reports(team_id);
CREATE INDEX IF NOT EXISTS idx_team_text_reports_generated_at ON team_text_reports(generated_at DESC);

ALTER TABLE team_text_reports ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'team_text_reports' AND policyname = 'Enable read access for all users'
  ) THEN
    CREATE POLICY "Enable read access for all users" ON team_text_reports
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'team_text_reports' AND policyname = 'Enable insert for all users'
  ) THEN
    CREATE POLICY "Enable insert for all users" ON team_text_reports
      FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'team_text_reports' AND policyname = 'Enable update for all users'
  ) THEN
    CREATE POLICY "Enable update for all users" ON team_text_reports
      FOR UPDATE USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'team_text_reports' AND policyname = 'Enable delete for all users'
  ) THEN
    CREATE POLICY "Enable delete for all users" ON team_text_reports
      FOR DELETE USING (true);
  END IF;
END$$;

CREATE OR REPLACE FUNCTION set_team_text_reports_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_team_text_reports_updated_at ON team_text_reports;
CREATE TRIGGER trg_team_text_reports_updated_at
BEFORE UPDATE ON team_text_reports
FOR EACH ROW
EXECUTE FUNCTION set_team_text_reports_updated_at();
