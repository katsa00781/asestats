-- Supabase táblák létrehozása az ASE Stats projekthez

-- 1. Meccsek tábla
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  opponent VARCHAR(255) NOT NULL,
  home_away VARCHAR(10) CHECK (home_away IN ('home', 'away')),
  our_score INTEGER NOT NULL,
  opp_score INTEGER NOT NULL,
  result VARCHAR(10) CHECK (result IN ('win', 'loss')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 2. Játékosok tábla (alapadatok)
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  number INTEGER NOT NULL,
  position VARCHAR(10) CHECK (position IN ('G', 'F', 'C')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(number)
);

-- 3. Játékos teljesítmények meccsenkénti bontásban
CREATE TABLE IF NOT EXISTS player_game_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  minutes INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  
  -- Dobások
  close_made INTEGER NOT NULL DEFAULT 0,
  close_attempted INTEGER NOT NULL DEFAULT 0,
  mid_made INTEGER NOT NULL DEFAULT 0,
  mid_attempted INTEGER NOT NULL DEFAULT 0,
  three_made INTEGER NOT NULL DEFAULT 0,
  three_attempted INTEGER NOT NULL DEFAULT 0,
  free_throw_made INTEGER NOT NULL DEFAULT 0,
  free_throw_attempted INTEGER NOT NULL DEFAULT 0,
  
  -- Lepattanók
  offensive_rebounds INTEGER NOT NULL DEFAULT 0,
  defensive_rebounds INTEGER NOT NULL DEFAULT 0,
  total_rebounds INTEGER NOT NULL DEFAULT 0,
  
  -- Egyéb statisztikák
  assists INTEGER NOT NULL DEFAULT 0,
  steals INTEGER NOT NULL DEFAULT 0,
  blocks INTEGER NOT NULL DEFAULT 0,
  turnovers INTEGER NOT NULL DEFAULT 0,
  fouls_committed INTEGER NOT NULL DEFAULT 0,
  plus_minus INTEGER NOT NULL DEFAULT 0,
  valuation INTEGER NOT NULL DEFAULT 0,
  
  -- Fejlett statisztikák
  offensive_rating DECIMAL(5,2) DEFAULT 0,
  defensive_rating DECIMAL(5,2) DEFAULT 0,
  true_shooting_percentage DECIMAL(5,2) DEFAULT 0,
  effective_field_goal_percentage DECIMAL(5,2) DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(game_id, player_id)
);

-- 4. Indexek a gyorsabb lekérdezésekhez
CREATE INDEX IF NOT EXISTS idx_games_date ON games(date DESC);
CREATE INDEX IF NOT EXISTS idx_player_game_stats_game_id ON player_game_stats(game_id);
CREATE INDEX IF NOT EXISTS idx_player_game_stats_player_id ON player_game_stats(player_id);

-- 4/b. Szöveges meccsjelentések tárolása
CREATE TABLE IF NOT EXISTS game_text_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  report_type VARCHAR(20) NOT NULL CHECK (report_type IN ('pregame', 'postgame', 'combined')),
  narrative TEXT NOT NULL,
  pregame_snapshot JSONB,
  postgame_snapshot JSONB,
  generated_by VARCHAR(255),
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(game_id, report_type)
);

CREATE INDEX IF NOT EXISTS idx_game_text_reports_game_id ON game_text_reports(game_id);

-- 5. Updated_at automatikus frissítése
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_games_updated_at ON games;
CREATE TRIGGER update_games_updated_at BEFORE UPDATE ON games
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_players_updated_at ON players;
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_game_text_reports_updated_at ON game_text_reports;
CREATE TRIGGER update_game_text_reports_updated_at BEFORE UPDATE ON game_text_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. View az aggregált játékos statisztikákhoz
-- SECURITY INVOKER módban, hogy az RLS policy-k érvényesek legyenek
CREATE OR REPLACE VIEW player_season_stats 
WITH (security_invoker = true)
AS
SELECT 
  p.id,
  p.name,
  p.number,
  p.position,
  COUNT(DISTINCT pgs.game_id) as games_played,
  SUM(pgs.points) as total_points,
  SUM(pgs.minutes) as total_minutes,
  SUM(pgs.close_made) as close_made,
  SUM(pgs.close_attempted) as close_attempted,
  SUM(pgs.mid_made) as mid_made,
  SUM(pgs.mid_attempted) as mid_attempted,
  SUM(pgs.three_made) as three_made,
  SUM(pgs.three_attempted) as three_attempted,
  SUM(pgs.free_throw_made) as free_throw_made,
  SUM(pgs.free_throw_attempted) as free_throw_attempted,
  SUM(pgs.offensive_rebounds) as offensive_rebounds,
  SUM(pgs.defensive_rebounds) as defensive_rebounds,
  SUM(pgs.total_rebounds) as total_rebounds,
  SUM(pgs.assists) as assists,
  SUM(pgs.steals) as steals,
  SUM(pgs.blocks) as blocks,
  SUM(pgs.turnovers) as turnovers,
  SUM(pgs.fouls_committed) as fouls_committed,
  SUM(pgs.valuation) as valuation,
  AVG(pgs.offensive_rating) as avg_offensive_rating,
  AVG(pgs.defensive_rating) as avg_defensive_rating,
  AVG(pgs.true_shooting_percentage) as avg_true_shooting_pct,
  AVG(pgs.effective_field_goal_percentage) as avg_effective_fg_pct
FROM players p
LEFT JOIN player_game_stats pgs ON p.id = pgs.player_id
GROUP BY p.id, p.name, p.number, p.position;

-- View hozzáférés engedélyezése
GRANT SELECT ON player_season_stats TO anon, authenticated;

-- 7. Row Level Security (RLS) engedélyezése
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_game_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_text_reports ENABLE ROW LEVEL SECURITY;

-- Mindenki olvashat
DROP POLICY IF EXISTS "Enable read access for all users" ON games;
CREATE POLICY "Enable read access for all users" ON games FOR SELECT USING (true);
DROP POLICY IF EXISTS "Enable read access for all users" ON players;
CREATE POLICY "Enable read access for all users" ON players FOR SELECT USING (true);
DROP POLICY IF EXISTS "Enable read access for all users" ON player_game_stats;
CREATE POLICY "Enable read access for all users" ON player_game_stats FOR SELECT USING (true);
DROP POLICY IF EXISTS "Enable read access for all users" ON game_text_reports;
CREATE POLICY "Enable read access for all users" ON game_text_reports FOR SELECT USING (true);

-- Írás jogosultság (később finomhangolható)
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON games;
CREATE POLICY "Enable insert for authenticated users" ON games FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Enable update for authenticated users" ON games;
CREATE POLICY "Enable update for authenticated users" ON games FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON games;
CREATE POLICY "Enable delete for authenticated users" ON games FOR DELETE USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON players;
CREATE POLICY "Enable insert for authenticated users" ON players FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Enable update for authenticated users" ON players;
CREATE POLICY "Enable update for authenticated users" ON players FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON player_game_stats;
CREATE POLICY "Enable insert for authenticated users" ON player_game_stats FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Enable update for authenticated users" ON player_game_stats;
CREATE POLICY "Enable update for authenticated users" ON player_game_stats FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON player_game_stats;
CREATE POLICY "Enable delete for authenticated users" ON player_game_stats FOR DELETE USING (true);
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON game_text_reports;
CREATE POLICY "Enable insert for authenticated users" ON game_text_reports FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Enable update for authenticated users" ON game_text_reports;
CREATE POLICY "Enable update for authenticated users" ON game_text_reports FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON game_text_reports;
CREATE POLICY "Enable delete for authenticated users" ON game_text_reports FOR DELETE USING (true);

-- 8. Mintaadatok beszúrása a már meglévő JSON-ból (opcionális)
-- Ezt majd a Node.js kódból fogjuk megtenni
