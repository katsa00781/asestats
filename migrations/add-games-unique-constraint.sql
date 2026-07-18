-- =====================================================================
-- add-games-unique-constraint.sql
-- KÉZZEL FUTTATANDÓ a Supabase SQL Editorban!
--
-- Cél: a games táblán eddig NEM volt unique constraint, ezért az importok
-- (scrape-hunbasket, GameQuickImport, JsonImport) eltérő match-kulcsai
-- duplikált meccs-sorokat termeltek. Ez a migráció:
--   1) összeolvasztja a meglévő duplikátumokat (a player stat sorok és a
--      riportok átkötésével a megmaradó game sorra),
--   2) létrehozza a UNIQUE (season_id, our_team_id, date) indexet.
--
-- Kulcs-döntés (user által jóváhagyva): (season_id, our_team_id, date) –
-- egy csapat egy nap legfeljebb egyszer játszik, és ez a kulcs immunis az
-- opponent szabadszöveg-névváltozataira.
--
-- MEGJEGYZÉS: az egész dedup egyetlen DO blokkban fut, mert a Supabase
-- SQL Editor a statementeket külön session-ben futtatja, így a temp tábla
-- több statementen át nem élne túl.
-- =====================================================================

DO $$
DECLARE
  v_dup_count integer;
BEGIN
  -- -------------------------------------------------------------------
  -- 0) Duplikátumok felmérése: keeper = a legtöbb player stat sorral
  --    rendelkező game sor (döntetlennél a legkorábban létrehozott).
  -- -------------------------------------------------------------------
  CREATE TEMP TABLE game_dupes ON COMMIT DROP AS
  WITH stat_counts AS (
    SELECT
      g.id,
      g.season_id,
      g.our_team_id,
      g.date,
      g.created_at,
      COALESCE((SELECT count(*) FROM player_game_stats_2023_2024 s WHERE s.game_id = g.id), 0)
        + COALESCE((SELECT count(*) FROM player_game_stats_2024_2025 s WHERE s.game_id = g.id), 0)
        + COALESCE((SELECT count(*) FROM player_game_stats_2025_2026 s WHERE s.game_id = g.id), 0)
        + COALESCE((SELECT count(*) FROM player_game_stats_2026_2027 s WHERE s.game_id = g.id), 0)
        AS stat_count
    FROM games g
    WHERE g.season_id IS NOT NULL
      AND g.our_team_id IS NOT NULL
  ),
  ranked AS (
    SELECT
      id,
      row_number() OVER w AS rn,
      first_value(id) OVER w AS keeper_id
    FROM stat_counts
    WINDOW w AS (
      PARTITION BY season_id, our_team_id, date
      ORDER BY stat_count DESC, created_at ASC, id ASC
      ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    )
  )
  SELECT id AS dup_id, keeper_id
  FROM ranked
  WHERE rn > 1;

  SELECT count(*) INTO v_dup_count FROM game_dupes;
  RAISE NOTICE 'Összeolvasztandó duplikált games sorok: %', v_dup_count;

  -- -------------------------------------------------------------------
  -- 1) Hasznos mezők átmentése a keeperre, mielőtt a duplikátum törlődik
  --    (kosarstat_game_id, round – ha a keeperen üres, a duplikátumon nem).
  -- -------------------------------------------------------------------
  UPDATE games k
  SET
    kosarstat_game_id = COALESCE(k.kosarstat_game_id, dup.kosarstat_game_id),
    round = COALESCE(k.round, dup.round)
  FROM game_dupes d
  JOIN games dup ON dup.id = d.dup_id
  WHERE k.id = d.keeper_id;

  -- -------------------------------------------------------------------
  -- 2) Player stat sorok átkötése a keeperre (szezononkénti táblák).
  --    Ha a keeperen már van sor ugyanarra a játékosra (UNIQUE(game_id,
  --    player_id)), a duplikált sor törlődik.
  -- -------------------------------------------------------------------
  UPDATE player_game_stats_2023_2024 s
  SET game_id = d.keeper_id
  FROM game_dupes d
  WHERE s.game_id = d.dup_id
    AND NOT EXISTS (
      SELECT 1 FROM player_game_stats_2023_2024 k
      WHERE k.game_id = d.keeper_id AND k.player_id = s.player_id
    );
  DELETE FROM player_game_stats_2023_2024 s
  USING game_dupes d
  WHERE s.game_id = d.dup_id;

  UPDATE player_game_stats_2024_2025 s
  SET game_id = d.keeper_id
  FROM game_dupes d
  WHERE s.game_id = d.dup_id
    AND NOT EXISTS (
      SELECT 1 FROM player_game_stats_2024_2025 k
      WHERE k.game_id = d.keeper_id AND k.player_id = s.player_id
    );
  DELETE FROM player_game_stats_2024_2025 s
  USING game_dupes d
  WHERE s.game_id = d.dup_id;

  UPDATE player_game_stats_2025_2026 s
  SET game_id = d.keeper_id
  FROM game_dupes d
  WHERE s.game_id = d.dup_id
    AND NOT EXISTS (
      SELECT 1 FROM player_game_stats_2025_2026 k
      WHERE k.game_id = d.keeper_id AND k.player_id = s.player_id
    );
  DELETE FROM player_game_stats_2025_2026 s
  USING game_dupes d
  WHERE s.game_id = d.dup_id;

  UPDATE player_game_stats_2026_2027 s
  SET game_id = d.keeper_id
  FROM game_dupes d
  WHERE s.game_id = d.dup_id
    AND NOT EXISTS (
      SELECT 1 FROM player_game_stats_2026_2027 k
      WHERE k.game_id = d.keeper_id AND k.player_id = s.player_id
    );
  DELETE FROM player_game_stats_2026_2027 s
  USING game_dupes d
  WHERE s.game_id = d.dup_id;

  -- -------------------------------------------------------------------
  -- 3) Szöveges riportok átkötése (to_regclass guard: csak ha a tábla létezik).
  --    game_text_reports: UNIQUE(game_id, report_type)
  --    player_game_text_reports: UNIQUE(game_id, player_id)
  -- -------------------------------------------------------------------
  IF to_regclass('public.game_text_reports') IS NOT NULL THEN
    UPDATE game_text_reports r
    SET game_id = d.keeper_id
    FROM game_dupes d
    WHERE r.game_id = d.dup_id
      AND NOT EXISTS (
        SELECT 1 FROM game_text_reports k
        WHERE k.game_id = d.keeper_id AND k.report_type = r.report_type
      );
    DELETE FROM game_text_reports r
    USING game_dupes d
    WHERE r.game_id = d.dup_id;
  END IF;

  IF to_regclass('public.player_game_text_reports') IS NOT NULL THEN
    UPDATE player_game_text_reports r
    SET game_id = d.keeper_id
    FROM game_dupes d
    WHERE r.game_id = d.dup_id
      AND NOT EXISTS (
        SELECT 1 FROM player_game_text_reports k
        WHERE k.game_id = d.keeper_id AND k.player_id = r.player_id
      );
    DELETE FROM player_game_text_reports r
    USING game_dupes d
    WHERE r.game_id = d.dup_id;
  END IF;

  -- -------------------------------------------------------------------
  -- 4) Duplikált game sorok törlése.
  -- -------------------------------------------------------------------
  DELETE FROM games g
  USING game_dupes d
  WHERE g.id = d.dup_id;

  RAISE NOTICE 'Dedup kész.';
END $$;

-- A unique index önálló statementként is futhat (nem függ a temp táblától).
CREATE UNIQUE INDEX IF NOT EXISTS games_season_team_date_unique
  ON games (season_id, our_team_id, date);

-- =====================================================================
-- ELLENŐRZÉS (futtasd le a migráció után):
--
-- 1) Nem maradt duplikátum (várt eredmény: 0 sor):
-- SELECT season_id, our_team_id, date, count(*)
-- FROM games
-- WHERE season_id IS NOT NULL AND our_team_id IS NOT NULL
-- GROUP BY season_id, our_team_id, date
-- HAVING count(*) > 1;
--
-- 2) Az index létezik:
-- SELECT indexname FROM pg_indexes
-- WHERE tablename = 'games' AND indexname = 'games_season_team_date_unique';
--
-- 3) Nincs árva player stat sor (várt eredmény: 0):
-- SELECT count(*) FROM player_game_stats pgs
-- LEFT JOIN games g ON g.id = pgs.game_id
-- WHERE g.id IS NULL;
-- =====================================================================
