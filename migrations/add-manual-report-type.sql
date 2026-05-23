-- Kézzel futtatandó a Supabase SQL Editorban
-- Hozzáadja a 'manual' report_type értéket a riport táblák CHECK constraintjeihez
-- Ez szükséges a kézzel beillesztett Claude-elemzések mentéséhez.

-- ============================================================
-- 1. game_text_reports: 'manual' hozzáadása
-- ============================================================

DO $$
DECLARE
  v_conname text;
BEGIN
  SELECT conname INTO v_conname
  FROM pg_constraint
  WHERE conrelid = 'game_text_reports'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%report_type%';
  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE game_text_reports DROP CONSTRAINT %I', v_conname);
    RAISE NOTICE 'game_text_reports: % constraint törölve', v_conname;
  END IF;
  EXECUTE $inner$
    ALTER TABLE game_text_reports
      ADD CONSTRAINT game_text_reports_report_type_check
      CHECK (report_type IN ('pregame', 'postgame', 'combined', 'manual'))
  $inner$;
  RAISE NOTICE 'game_text_reports: új constraint sikeresen hozzáadva';
END $$;

-- ============================================================
-- 2. team_text_reports: 'manual' hozzáadása
-- ============================================================

DO $$
DECLARE
  v_conname text;
BEGIN
  SELECT conname INTO v_conname
  FROM pg_constraint
  WHERE conrelid = 'team_text_reports'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%report_type%';
  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE team_text_reports DROP CONSTRAINT %I', v_conname);
    RAISE NOTICE 'team_text_reports: % constraint törölve', v_conname;
  END IF;
  EXECUTE $inner$
    ALTER TABLE team_text_reports
      ADD CONSTRAINT team_text_reports_report_type_check
      CHECK (report_type IN ('season', 'season_fan', 'season_coach', 'season_scouting', 'manual'))
  $inner$;
  RAISE NOTICE 'team_text_reports: új constraint sikeresen hozzáadva';
END $$;

-- ============================================================
-- 3. player_text_reports: 'manual' hozzáadása (ha létezik a tábla)
-- ============================================================

DO $$
DECLARE
  v_conname text;
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'player_text_reports'
  ) THEN
    RAISE NOTICE 'player_text_reports tábla nem létezik, kihagyva';
    RETURN;
  END IF;

  SELECT conname INTO v_conname
  FROM pg_constraint
  WHERE conrelid = 'player_text_reports'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%report_type%';
  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE player_text_reports DROP CONSTRAINT %I', v_conname);
    RAISE NOTICE 'player_text_reports: % constraint törölve', v_conname;
  END IF;

  EXECUTE $inner$
    ALTER TABLE player_text_reports
      ADD CONSTRAINT player_text_reports_report_type_check
      CHECK (report_type IN ('season', 'manual'))
  $inner$;
  RAISE NOTICE 'player_text_reports: új constraint sikeresen hozzáadva';
END $$;
