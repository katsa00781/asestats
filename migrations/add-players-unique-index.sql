-- =====================================================================
-- add-players-unique-index.sql
-- KÉZZEL FUTTATANDÓ a Supabase SQL Editorban!
-- ELŐFELTÉTEL: add-games-unique-constraint.sql már lefutott.
--
-- Cél: a players egyediségi védelem visszaállítása. A korábbi
-- (number-alapú) constraintet a remove-number-unique-constraint.sql
-- eldobta, mert a mezszám változhat – azóta csak app-szintű matching véd,
-- és visszatérően keletkeznek duplikált játékosok.
--
-- Új kulcs (user által jóváhagyva): (season_id, team_id, lower(name)) –
-- a mezszám NEM része a kulcsnak. Ismert korlát: két azonos nevű játékos
-- ugyanabban a csapatban/szezonban nem vehető fel (ritka eset, kézi
-- feloldást igényel – pl. névkiegészítés).
--
-- MEGJEGYZÉS: a dedup egyetlen DO blokkban fut, mert a Supabase SQL
-- Editor a statementeket külön session-ben futtatja (temp tábla nem
-- élné túl a statement-határokat).
-- =====================================================================

DO $$
DECLARE
  v_dup_count integer;
BEGIN
  -- -------------------------------------------------------------------
  -- 0) Duplikátumok felmérése: keeper = a legtöbb stat sorral rendelkező
  --    játékos-sor (döntetlennél a legkorábban létrehozott).
  -- -------------------------------------------------------------------
  CREATE TEMP TABLE player_dupes ON COMMIT DROP AS
  WITH stat_counts AS (
    SELECT
      p.id,
      p.season_id,
      p.team_id,
      lower(trim(p.name)) AS norm_name,
      p.created_at,
      COALESCE((SELECT count(*) FROM player_game_stats_2023_2024 s WHERE s.player_id = p.id), 0)
        + COALESCE((SELECT count(*) FROM player_game_stats_2024_2025 s WHERE s.player_id = p.id), 0)
        + COALESCE((SELECT count(*) FROM player_game_stats_2025_2026 s WHERE s.player_id = p.id), 0)
        + COALESCE((SELECT count(*) FROM player_game_stats_2026_2027 s WHERE s.player_id = p.id), 0)
        AS stat_count
    FROM players p
    WHERE p.season_id IS NOT NULL
      AND p.team_id IS NOT NULL
  ),
  ranked AS (
    SELECT
      id,
      row_number() OVER w AS rn,
      first_value(id) OVER w AS keeper_id
    FROM stat_counts
    WINDOW w AS (
      PARTITION BY season_id, team_id, norm_name
      ORDER BY stat_count DESC, created_at ASC, id ASC
      ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    )
  )
  SELECT id AS dup_id, keeper_id
  FROM ranked
  WHERE rn > 1;

  SELECT count(*) INTO v_dup_count FROM player_dupes;
  RAISE NOTICE 'Összeolvasztandó duplikált players sorok: %', v_dup_count;

  -- -------------------------------------------------------------------
  -- 1) Hasznos mezők átmentése a keeperre (ha ott üresek).
  -- -------------------------------------------------------------------
  UPDATE players k
  SET
    number = COALESCE(k.number, dup.number),
    position = COALESCE(k.position, dup.position),
    birth_year = COALESCE(k.birth_year, dup.birth_year),
    height = COALESCE(k.height, dup.height),
    weight = COALESCE(k.weight, dup.weight)
  FROM player_dupes d
  JOIN players dup ON dup.id = d.dup_id
  WHERE k.id = d.keeper_id;

  -- -------------------------------------------------------------------
  -- 2) Stat sorok átkötése (szezononkénti táblák, UNIQUE(game_id, player_id)).
  --    Ha a keepernek már van sora ugyanarra a meccsre, a duplikált törlődik.
  -- -------------------------------------------------------------------
  UPDATE player_game_stats_2023_2024 s
  SET player_id = d.keeper_id
  FROM player_dupes d
  WHERE s.player_id = d.dup_id
    AND NOT EXISTS (
      SELECT 1 FROM player_game_stats_2023_2024 k
      WHERE k.player_id = d.keeper_id AND k.game_id = s.game_id
    );
  DELETE FROM player_game_stats_2023_2024 s
  USING player_dupes d
  WHERE s.player_id = d.dup_id;

  UPDATE player_game_stats_2024_2025 s
  SET player_id = d.keeper_id
  FROM player_dupes d
  WHERE s.player_id = d.dup_id
    AND NOT EXISTS (
      SELECT 1 FROM player_game_stats_2024_2025 k
      WHERE k.player_id = d.keeper_id AND k.game_id = s.game_id
    );
  DELETE FROM player_game_stats_2024_2025 s
  USING player_dupes d
  WHERE s.player_id = d.dup_id;

  UPDATE player_game_stats_2025_2026 s
  SET player_id = d.keeper_id
  FROM player_dupes d
  WHERE s.player_id = d.dup_id
    AND NOT EXISTS (
      SELECT 1 FROM player_game_stats_2025_2026 k
      WHERE k.player_id = d.keeper_id AND k.game_id = s.game_id
    );
  DELETE FROM player_game_stats_2025_2026 s
  USING player_dupes d
  WHERE s.player_id = d.dup_id;

  UPDATE player_game_stats_2026_2027 s
  SET player_id = d.keeper_id
  FROM player_dupes d
  WHERE s.player_id = d.dup_id
    AND NOT EXISTS (
      SELECT 1 FROM player_game_stats_2026_2027 k
      WHERE k.player_id = d.keeper_id AND k.game_id = s.game_id
    );
  DELETE FROM player_game_stats_2026_2027 s
  USING player_dupes d
  WHERE s.player_id = d.dup_id;

  -- -------------------------------------------------------------------
  -- 3) Riportok átkötése (to_regclass guard: csak ha a tábla létezik).
  -- -------------------------------------------------------------------
  -- player_game_text_reports: UNIQUE(game_id, player_id)
  IF to_regclass('public.player_game_text_reports') IS NOT NULL THEN
    UPDATE player_game_text_reports r
    SET player_id = d.keeper_id
    FROM player_dupes d
    WHERE r.player_id = d.dup_id
      AND NOT EXISTS (
        SELECT 1 FROM player_game_text_reports k
        WHERE k.player_id = d.keeper_id AND k.game_id = r.game_id
      );
    DELETE FROM player_game_text_reports r
    USING player_dupes d
    WHERE r.player_id = d.dup_id;
  END IF;

  -- player_text_reports: UNIQUE(season_id, team_id, player_id, report_type)
  IF to_regclass('public.player_text_reports') IS NOT NULL THEN
    UPDATE player_text_reports r
    SET player_id = d.keeper_id
    FROM player_dupes d
    WHERE r.player_id = d.dup_id
      AND NOT EXISTS (
        SELECT 1 FROM player_text_reports k
        WHERE k.player_id = d.keeper_id
          AND k.season_id = r.season_id
          AND k.team_id = r.team_id
          AND k.report_type = r.report_type
      );
    DELETE FROM player_text_reports r
    USING player_dupes d
    WHERE r.player_id = d.dup_id;
  END IF;

  -- -------------------------------------------------------------------
  -- 4) Esemény-táblák átkötése (nincs player-alapú unique constraint).
  -- -------------------------------------------------------------------
  IF to_regclass('public.hunbasket_shot_events') IS NOT NULL THEN
    UPDATE hunbasket_shot_events e
    SET player_id = d.keeper_id
    FROM player_dupes d
    WHERE e.player_id = d.dup_id;
  END IF;

  IF to_regclass('public.hunbasket_pbp_events') IS NOT NULL THEN
    UPDATE hunbasket_pbp_events e
    SET player_id = d.keeper_id
    FROM player_dupes d
    WHERE e.player_id = d.dup_id;
  END IF;

  -- -------------------------------------------------------------------
  -- 5) Duplikált játékos-sorok törlése.
  -- -------------------------------------------------------------------
  DELETE FROM players p
  USING player_dupes d
  WHERE p.id = d.dup_id;

  RAISE NOTICE 'Dedup kész.';
END $$;

-- A partial unique index önálló statementként is futhat.
CREATE UNIQUE INDEX IF NOT EXISTS players_season_team_name_unique
  ON players (season_id, team_id, lower(trim(name)))
  WHERE season_id IS NOT NULL AND team_id IS NOT NULL;

-- =====================================================================
-- ELLENŐRZÉS (futtasd le a migráció után):
--
-- 1) Nem maradt duplikátum (várt eredmény: 0 sor):
-- SELECT season_id, team_id, lower(trim(name)), count(*)
-- FROM players
-- WHERE season_id IS NOT NULL AND team_id IS NOT NULL
-- GROUP BY season_id, team_id, lower(trim(name))
-- HAVING count(*) > 1;
--
-- 2) Az index létezik:
-- SELECT indexname FROM pg_indexes
-- WHERE tablename = 'players' AND indexname = 'players_season_team_name_unique';
--
-- 3) Nincs árva stat sor (várt eredmény: 0):
-- SELECT count(*) FROM player_game_stats pgs
-- LEFT JOIN players p ON p.id = pgs.player_id
-- WHERE p.id IS NULL;
-- =====================================================================
