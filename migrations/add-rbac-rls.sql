-- ============================================================
-- RBAC: DB-SZINTŰ ÍRÁS-VÉDELEM ADMIN SZEREPKÖRRE
-- ============================================================
-- Ez a migráció opcionális, de ajánlott.
-- Az UI-szintű elrejtés mellett ez biztosítja, hogy még ha
-- valaki megkerülné a UI-t (pl. API hívással), akkor sem tud
-- adatot módosítani/törölni anélkül, hogy admin role-ja lenne.
--
-- Adminok beállítása Supabase Dashboard-ban:
--   Authentication → Users → felhasználó kiválasztása →
--   "Update User" → Raw User Meta Data:
--   { "role": "admin" }
--
-- FONTOS: A jelenlegi RLS policy-k permisszívak (bárki írhat).
-- Ez a migráció ezeket lecseréli szigorúbbekra.
-- ============================================================

-- Helper function: ellenőrzi hogy a bejelentkezett user admin-e
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );
END;
$$;

-- ============================================================
-- GAMES tábla
-- ============================================================

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON games;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON games;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON games;

CREATE POLICY "Admin: insert games"
  ON games FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admin: update games"
  ON games FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admin: delete games"
  ON games FOR DELETE
  USING (is_admin());

-- ============================================================
-- PLAYERS tábla
-- ============================================================

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON players;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON players;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON players;

CREATE POLICY "Admin: insert players"
  ON players FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admin: update players"
  ON players FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admin: delete players"
  ON players FOR DELETE
  USING (is_admin());

-- ============================================================
-- PLAYER_GAME_STATS szezonos táblák
-- ============================================================

-- 2023/2024
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON player_game_stats_2023_2024;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON player_game_stats_2023_2024;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON player_game_stats_2023_2024;

CREATE POLICY "Admin: insert stats 2023_2024"
  ON player_game_stats_2023_2024 FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admin: update stats 2023_2024"
  ON player_game_stats_2023_2024 FOR UPDATE USING (is_admin());
CREATE POLICY "Admin: delete stats 2023_2024"
  ON player_game_stats_2023_2024 FOR DELETE USING (is_admin());

-- 2024/2025
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON player_game_stats_2024_2025;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON player_game_stats_2024_2025;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON player_game_stats_2024_2025;

CREATE POLICY "Admin: insert stats 2024_2025"
  ON player_game_stats_2024_2025 FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admin: update stats 2024_2025"
  ON player_game_stats_2024_2025 FOR UPDATE USING (is_admin());
CREATE POLICY "Admin: delete stats 2024_2025"
  ON player_game_stats_2024_2025 FOR DELETE USING (is_admin());

-- 2025/2026
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON player_game_stats_2025_2026;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON player_game_stats_2025_2026;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON player_game_stats_2025_2026;

CREATE POLICY "Admin: insert stats 2025_2026"
  ON player_game_stats_2025_2026 FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admin: update stats 2025_2026"
  ON player_game_stats_2025_2026 FOR UPDATE USING (is_admin());
CREATE POLICY "Admin: delete stats 2025_2026"
  ON player_game_stats_2025_2026 FOR DELETE USING (is_admin());

-- 2026/2027 (ha már létezik)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'player_game_stats_2026_2027') THEN
    DROP POLICY IF EXISTS "Enable insert for authenticated users" ON player_game_stats_2026_2027;
    DROP POLICY IF EXISTS "Enable update for authenticated users" ON player_game_stats_2026_2027;
    DROP POLICY IF EXISTS "Enable delete for authenticated users" ON player_game_stats_2026_2027;

    EXECUTE 'CREATE POLICY "Admin: insert stats 2026_2027"
      ON player_game_stats_2026_2027 FOR INSERT WITH CHECK (is_admin())';
    EXECUTE 'CREATE POLICY "Admin: update stats 2026_2027"
      ON player_game_stats_2026_2027 FOR UPDATE USING (is_admin())';
    EXECUTE 'CREATE POLICY "Admin: delete stats 2026_2027"
      ON player_game_stats_2026_2027 FOR DELETE USING (is_admin())';
  END IF;
END;
$$;

-- ============================================================
-- LEAGUE_FIXTURES tábla
-- ============================================================

ALTER TABLE league_fixtures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users"
  ON league_fixtures FOR SELECT USING (true);

CREATE POLICY "Admin: insert fixtures"
  ON league_fixtures FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "Admin: update fixtures"
  ON league_fixtures FOR UPDATE USING (is_admin());

CREATE POLICY "Admin: delete fixtures"
  ON league_fixtures FOR DELETE USING (is_admin());

-- ============================================================
-- ELLENŐRZÉS
-- ============================================================

SELECT
  tablename,
  policyname,
  cmd,
  permissive
FROM pg_policies
WHERE tablename IN (
  'games', 'players',
  'player_game_stats_2023_2024',
  'player_game_stats_2024_2025',
  'player_game_stats_2025_2026',
  'league_fixtures'
)
ORDER BY tablename, cmd;
