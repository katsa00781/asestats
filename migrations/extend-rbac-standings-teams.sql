-- ============================================================
-- RBAC BŐVÍTÉS: STANDINGS + TEAMS ÍRÁS CSAK ADMINNAK
-- ============================================================
-- Előfeltétel: migrations/add-rbac-rls.sql (is_admin() függvény) lefuttatva.
-- A fix-standings-rls.sql korábbi "bármely authenticated írhat" policyját
-- cseréli admin-only írásra; a teams táblát ugyanígy védi.
-- Az olvasás (SELECT) minden bejelentkezett felhasználónak marad.
--
-- KÉZZEL FUTTATANDÓ a Supabase SQL Editorban!
-- ============================================================

-- RLS engedélyezése (idempotens)
ALTER TABLE standings ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- Minden meglévő nem-SELECT policy törlése a két táblán (nevek változhattak,
-- ezért dinamikusan), a SELECT policy-k megmaradnak
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('standings', 'teams')
      AND cmd <> 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END;
$$;

-- Olvasás: bejelentkezett felhasználóknak (ha még nincs SELECT policy)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'standings' AND cmd = 'SELECT'
  ) THEN
    EXECUTE 'CREATE POLICY "Read standings" ON standings FOR SELECT USING (true)';
  END IF;
  IF NOT EXISTS (
    SELECT FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'teams' AND cmd = 'SELECT'
  ) THEN
    EXECUTE 'CREATE POLICY "Read teams" ON teams FOR SELECT USING (true)';
  END IF;
END;
$$;

-- ============================================================
-- STANDINGS: írás csak adminnak
-- ============================================================

CREATE POLICY "Admin: insert standings"
  ON standings FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "Admin: update standings"
  ON standings FOR UPDATE USING (is_admin());

CREATE POLICY "Admin: delete standings"
  ON standings FOR DELETE USING (is_admin());

-- ============================================================
-- TEAMS: írás csak adminnak
-- ============================================================

CREATE POLICY "Admin: insert teams"
  ON teams FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "Admin: update teams"
  ON teams FOR UPDATE USING (is_admin());

CREATE POLICY "Admin: delete teams"
  ON teams FOR DELETE USING (is_admin());

-- ============================================================
-- ELLENŐRZÉS
-- ============================================================

SELECT tablename, policyname, cmd, permissive
FROM pg_policies
WHERE tablename IN ('standings', 'teams')
ORDER BY tablename, cmd;
