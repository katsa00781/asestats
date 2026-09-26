-- =====================================================================
-- fix-merge-duplicate-szolnok-team.sql
-- KÉZZEL FUTTATANDÓ a Supabase SQL Editorban! Egyszeri adatjavítás.
--
-- Cél: a teams táblában a Szolnok klub két sorral szerepel:
--   KEEP  62d8fe26-… 'NHSZ-Szolnoki Olajbányász' (2025-11-15, 72 meccs, 49 játékos)
--   DUP   f9b17624-… 'Szolnoki Olajbányász'      (2026-04-19, a 25/26 playoff
--         importjából; 11 meccs, 13 játékos)
-- A DUP minden hivatkozása a KEEP sorra kerül, majd a DUP törlődik.
--
-- Benne van a 2026-09-26-i incidens visszaállítása is (BACKLOG H7): az
-- ellenőrző import a 2025-09-27-i Szolnok–Kaposvár meccsre a DUP alá egy
-- második games sort írt (d32cd3d5-…, 9 stat sor) – ez törlődik, az eredeti
-- KEEP-sor érintetlen; a kaposvári sor ellenfél-neve visszaáll.
--
-- Játékosok: mind a 13 DUP játékosnak pontosan 1 azonos nevű
-- (lower(trim(name))) párja van a KEEP alatt ugyanabban a szezonban → a
-- stat / dobás hivatkozások átkötve, a DUP játékossorok törölve.
-- hunbasket_player_links: mind a 13 DUP link kódja megvan a KEEP alatt is →
-- a DUP linkek törölve.
--
-- Mentés futtatás előtt: archive/backups/2026-09-26-szolnok-team-merge.json
-- Előfeltétel: a scrape-utils.ts 'szolnoki olajbanyasz' aliasa (commit
-- 9c529ef) – enélkül a keret import a DUP sort újra létrehozná.
--
-- Biztonság: egyetlen DO blokk = egyetlen tranzakció. Minden előfeltétel
-- ellenőrzött; bármely eltérésnél RAISE EXCEPTION → teljes visszagörgetés.
-- A végén nulla maradék DUP-hivatkozás nélkül a teams sor nem törlődik.
-- =====================================================================

DO $$
DECLARE
  v_dup  constant uuid := 'f9b17624-ce30-4195-be7d-e86f073d9722';
  v_keep constant uuid := '62d8fe26-fadc-4e07-89f5-09d4c5674bbb';
  v_conflict_game constant uuid := 'd32cd3d5-e195-4b76-bb27-7ea9985f5a1d';
  v_kaposvar_game constant uuid := 'b20f2756-f0e0-4339-85a2-44222daf6375';
  v_n integer;
  v_left integer;
BEGIN
  -- -------------------------------------------------------------------
  -- 0) Előfeltételek
  -- -------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM teams WHERE id = v_dup AND name = 'Szolnoki Olajbányász') THEN
    RAISE EXCEPTION 'DUP teams sor nem található vagy átnevezték – leállás';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM teams WHERE id = v_keep AND name = 'NHSZ-Szolnoki Olajbányász') THEN
    RAISE EXCEPTION 'KEEP teams sor nem található vagy átnevezték – leállás';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM games WHERE id = v_conflict_game AND our_team_id = v_dup AND date = '2025-09-27') THEN
    RAISE EXCEPTION 'Az ütköző 2025-09-27-i DUP meccs nem az elvárt állapotban van – leállás';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM games WHERE our_team_id = v_keep AND date = '2025-09-27') THEN
    RAISE EXCEPTION 'Az eredeti KEEP meccs (2025-09-27) hiányzik – leállás';
  END IF;

  -- Játékos-párosítás: DUP → KEEP, azonos szezon + azonos név.
  CREATE TEMP TABLE player_map ON COMMIT DROP AS
  SELECT d.id AS dup_id, k.id AS keep_id
  FROM players d
  JOIN players k
    ON k.team_id = v_keep
   AND k.season_id = d.season_id
   AND lower(trim(k.name)) = lower(trim(d.name))
  WHERE d.team_id = v_dup;

  SELECT count(*) INTO v_n FROM players WHERE team_id = v_dup;
  IF (SELECT count(DISTINCT dup_id) FROM player_map) <> v_n
     OR (SELECT count(*) FROM player_map) <> v_n THEN
    RAISE EXCEPTION 'Nem minden DUP játékos párosítható egyértelműen (% db) – leállás', v_n;
  END IF;

  -- Minden DUP link kódja megvan-e a KEEP alatt?
  IF EXISTS (
    SELECT 1 FROM hunbasket_player_links d
    WHERE d.team_id = v_dup
      AND NOT EXISTS (
        SELECT 1 FROM hunbasket_player_links k
        WHERE k.team_id = v_keep AND k.season_id = d.season_id
          AND k.hunbasket_player_code = d.hunbasket_player_code)
  ) THEN
    RAISE EXCEPTION 'Van DUP hunbasket_player_link KEEP megfelelő nélkül – leállás';
  END IF;

  -- -------------------------------------------------------------------
  -- 1) Az incidens duplikált meccse (statokkal együtt) törlődik
  -- -------------------------------------------------------------------
  DELETE FROM player_game_stats_2025_2026 WHERE game_id = v_conflict_game;
  GET DIAGNOSTICS v_n = ROW_COUNT; RAISE NOTICE 'ütköző meccs 25/26 stat törölve: %', v_n;
  DELETE FROM player_game_stats_legacy WHERE game_id = v_conflict_game;
  GET DIAGNOSTICS v_n = ROW_COUNT; RAISE NOTICE 'ütköző meccs legacy stat törölve: %', v_n;
  DELETE FROM games WHERE id = v_conflict_game;

  -- -------------------------------------------------------------------
  -- 2) Játékos-hivatkozások átkötése DUP → KEEP játékosra
  -- -------------------------------------------------------------------
  UPDATE player_game_stats_2023_2024 s SET player_id = m.keep_id FROM player_map m WHERE s.player_id = m.dup_id;
  UPDATE player_game_stats_2024_2025 s SET player_id = m.keep_id FROM player_map m WHERE s.player_id = m.dup_id;
  UPDATE player_game_stats_2025_2026 s SET player_id = m.keep_id FROM player_map m WHERE s.player_id = m.dup_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; RAISE NOTICE '25/26 stat átkötve: %', v_n;
  UPDATE player_game_stats_2026_2027 s SET player_id = m.keep_id FROM player_map m WHERE s.player_id = m.dup_id;
  UPDATE player_game_stats_legacy s SET player_id = m.keep_id FROM player_map m WHERE s.player_id = m.dup_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; RAISE NOTICE 'legacy stat átkötve: %', v_n;
  UPDATE hunbasket_shot_events e SET player_id = m.keep_id FROM player_map m WHERE e.player_id = m.dup_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; RAISE NOTICE 'dobás esemény játékos átkötve: %', v_n;
  UPDATE hunbasket_pbp_events e SET player_id = m.keep_id FROM player_map m WHERE e.player_id = m.dup_id;
  UPDATE player_text_reports r SET player_id = m.keep_id FROM player_map m WHERE r.player_id = m.dup_id;
  UPDATE player_game_text_reports r SET player_id = m.keep_id FROM player_map m WHERE r.player_id = m.dup_id;
  UPDATE live_player_lines l SET player_id = m.keep_id FROM player_map m WHERE l.player_id = m.dup_id;

  DELETE FROM hunbasket_player_links WHERE team_id = v_dup;
  GET DIAGNOSTICS v_n = ROW_COUNT; RAISE NOTICE 'DUP hunbasket link törölve: %', v_n;

  DELETE FROM players p USING player_map m WHERE p.id = m.dup_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; RAISE NOTICE 'DUP játékossor törölve: %', v_n;

  -- -------------------------------------------------------------------
  -- 3) Csapat-hivatkozások átkötése DUP → KEEP
  -- -------------------------------------------------------------------
  UPDATE games SET our_team_id = v_keep WHERE our_team_id = v_dup;
  GET DIAGNOSTICS v_n = ROW_COUNT; RAISE NOTICE 'games.our_team_id átkötve: %', v_n;
  UPDATE games SET opponent_team_id = v_keep WHERE opponent_team_id = v_dup;
  GET DIAGNOSTICS v_n = ROW_COUNT; RAISE NOTICE 'games.opponent_team_id átkötve: %', v_n;
  -- Az incidens előtti ellenfél-név visszaállítása a kaposvári soron.
  UPDATE games SET opponent = 'NHSZ-Szolnoki Olajbányász' WHERE id = v_kaposvar_game;

  UPDATE hunbasket_shotchart_raw SET home_team_id = v_keep WHERE home_team_id = v_dup;
  UPDATE hunbasket_shotchart_raw SET away_team_id = v_keep WHERE away_team_id = v_dup;
  UPDATE hunbasket_shot_events SET team_id = v_keep WHERE team_id = v_dup;
  GET DIAGNOSTICS v_n = ROW_COUNT; RAISE NOTICE 'dobás esemény csapat átkötve: %', v_n;
  UPDATE hunbasket_pbp_raw SET home_team_id = v_keep WHERE home_team_id = v_dup;
  UPDATE hunbasket_pbp_raw SET away_team_id = v_keep WHERE away_team_id = v_dup;
  UPDATE hunbasket_pbp_events SET team_id = v_keep WHERE team_id = v_dup;
  UPDATE league_fixtures SET home_team_id = v_keep WHERE home_team_id = v_dup;
  UPDATE league_fixtures SET away_team_id = v_keep WHERE away_team_id = v_dup;
  UPDATE game_text_reports SET opponent_team_id = v_keep WHERE opponent_team_id = v_dup;
  UPDATE game_text_reports SET own_team_id = v_keep WHERE own_team_id = v_dup;
  UPDATE player_text_reports SET team_id = v_keep WHERE team_id = v_dup;
  UPDATE team_text_reports SET team_id = v_keep::text WHERE team_id = v_dup::text;
  UPDATE live_games SET home_team_id = v_keep WHERE home_team_id = v_dup;
  UPDATE live_games SET away_team_id = v_keep WHERE away_team_id = v_dup;

  -- -------------------------------------------------------------------
  -- 4) Maradék-ellenőrzés, majd a DUP teams sor törlése
  -- -------------------------------------------------------------------
  SELECT
      (SELECT count(*) FROM games WHERE our_team_id = v_dup OR opponent_team_id = v_dup)
    + (SELECT count(*) FROM players WHERE team_id = v_dup)
    + (SELECT count(*) FROM hunbasket_player_links WHERE team_id = v_dup)
    + (SELECT count(*) FROM hunbasket_shotchart_raw WHERE home_team_id = v_dup OR away_team_id = v_dup)
    + (SELECT count(*) FROM hunbasket_shot_events WHERE team_id = v_dup)
    + (SELECT count(*) FROM hunbasket_pbp_raw WHERE home_team_id = v_dup OR away_team_id = v_dup)
    + (SELECT count(*) FROM hunbasket_pbp_events WHERE team_id = v_dup)
    + (SELECT count(*) FROM league_fixtures WHERE home_team_id = v_dup OR away_team_id = v_dup)
    + (SELECT count(*) FROM league_player_team_seasons WHERE team_id = v_dup)
    + (SELECT count(*) FROM kosarstat_team_map WHERE team_id = v_dup)
    + (SELECT count(*) FROM game_text_reports WHERE own_team_id = v_dup OR opponent_team_id = v_dup)
    + (SELECT count(*) FROM player_text_reports WHERE team_id = v_dup)
    + (SELECT count(*) FROM team_text_reports WHERE team_id = v_dup::text)
    + (SELECT count(*) FROM live_games WHERE home_team_id = v_dup OR away_team_id = v_dup)
  INTO v_left;

  IF v_left <> 0 THEN
    RAISE EXCEPTION 'Maradt % DUP hivatkozás – leállás, semmi nem módosult', v_left;
  END IF;

  DELETE FROM teams WHERE id = v_dup;
  RAISE NOTICE 'Kész: a DUP Szolnok teams sor összevonva és törölve.';
END $$;

-- Ellenőrzés az Editorban (várt: 1 sor, 'NHSZ-Szolnoki Olajbányász', 82 meccs):
SELECT t.name, count(g.id) AS games
FROM teams t
LEFT JOIN games g ON g.our_team_id = t.id
WHERE t.name ILIKE '%szolnok%'
GROUP BY t.name;
