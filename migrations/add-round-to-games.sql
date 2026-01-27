-- Add round column to games table
ALTER TABLE games ADD COLUMN IF NOT EXISTS round INTEGER;

-- Create index on round for better query performance
CREATE INDEX IF NOT EXISTS idx_games_round ON games(round);

-- Add comment
COMMENT ON COLUMN games.round IS 'A bajnokság fordulószáma (pl. 1, 2, 3...)';
