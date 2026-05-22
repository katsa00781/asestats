-- RLS engedélyezése a game_text_reports és team_text_reports táblákon
-- Policy: bejelentkezett felhasználók olvashatnak, írás csak service_role-nak (API route-ok)

-- game_text_reports
ALTER TABLE game_text_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "game_text_reports_select_authenticated"
  ON game_text_reports
  FOR SELECT
  TO authenticated
  USING (true);

-- team_text_reports
ALTER TABLE team_text_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_text_reports_select_authenticated"
  ON team_text_reports
  FOR SELECT
  TO authenticated
  USING (true);
