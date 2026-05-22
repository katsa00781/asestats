-- player_game_text_reports: per-játékos AI értékelések meccsenkénti tárolása
CREATE TABLE IF NOT EXISTS player_game_text_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  narrative text NOT NULL,
  breakdown jsonb,
  generated_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (game_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_player_game_text_reports_game_id
  ON player_game_text_reports (game_id);

CREATE OR REPLACE FUNCTION update_player_game_text_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_player_game_text_reports_updated_at
  BEFORE UPDATE ON player_game_text_reports
  FOR EACH ROW EXECUTE FUNCTION update_player_game_text_reports_updated_at();
