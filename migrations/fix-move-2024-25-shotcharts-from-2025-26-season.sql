-- =====================================================================
-- fix-move-2024-25-shotcharts-from-2025-26-season.sql
-- KÉZZEL FUTTATANDÓ a Supabase SQL Editorban! (adattartalom-javítás, H22)
--
-- Hiba: 2026-04-20-án a dobástérkép-import a 2024/2025-ös Hunbasket sluggal
-- (x2425) futott, de a 2025/2026-os szezonba írt (ugyanaz a hiba, mint a
-- box-score-nál, lásd fix-remove-2024-25-games-from-2025-26-season.sql).
-- Emiatt a 2025/2026 szezonban 138 `hunbasket_shotchart_raw` sor
-- (meccsdátum 2024-09-27 – 2025-02-28) és 17 202 `hunbasket_shot_events` sor
-- van, a 2024/2025 szezonban pedig egyetlen dobástérkép sincs. A 2025/2026-os
-- szezon-dobásképek így két szezont kevernek.
--
-- A dobások `player_id`-je is a 2025/2026-os `players` sorokra mutat, ezért a
-- `season_id` átírása mellett a játékost is át kell kötni a 2024/2025-ös párjára
-- (azonos csapat + `lower(trim(name))` – ugyanaz a kulcs, mint a
-- players_season_team_name_unique index). Felmérés (2026-11-08, csak olvasás):
--   - 17 202 dobás: 119 játékos nélküli, 17 076 egyértelműen párosítható,
--     7 nem: ezeket a régi hozzárendelés HAWKINS Elijah Jamilhez kötötte, de a
--     Hunbasket-név „YASIIN Yousef Joseph” (kód SPIh3, 2024-10-04, ASE) – a box
--     score szerint Joseph Yasiin Yousef játszott; ő kapja (4. lépés).
--   - A 2024/2025 szezonban 0 dobástérkép-sor és 0 dobás van → a
--     UNIQUE (season_id, game_code) és a dobás-UNIQUE kulcs nem ütközhet.
--   - A 138 game_code egyike sincs a 2025/2026-os (x2526) sorok között.
--
-- A script nem töröl semmit, és a `players` / `hunbasket_player_links`
-- táblához nem nyúl. A 2025/2026-os helyes sorokat (x2526) nem érinti.
--
-- Futtatás: előbb az 1. lépés (előnézet, csak olvas) – a várt értékek a
-- megjegyzésekben. Ha minden egyezik, a 2. lépés EGYBEN. A 2. lépés egyetlen
-- DO blokk: bármelyik ellenőrzés elbukik → hibát dob, és SEMMI nem íródik.
-- Utána a 3. lépés (ellenőrzés). Újrafuttatva az előnézet 0 sort ad, a 2. lépés
-- „0 sor” hibával leáll (nincs mit átkötni) – ez a várt viselkedés.
--
-- ÁLLAPOT: még NEM futott.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ELŐNÉZET – csak olvas
-- ---------------------------------------------------------------------

-- 1/a) Átkötendő meccsek (várt: 138 sor, 2024-09-27 – 2025-02-28)
SELECT count(*) AS meccs, min(r.game_date) AS elso, max(r.game_date) AS utolso
FROM hunbasket_shotchart_raw r
JOIN seasons s ON s.id = r.season_id
WHERE s.name = '2025/2026'
  AND r.season_slug = 'x2425'
  AND r.game_date < s.start_date;

-- 1/b) Átkötendő dobások (várt: 17202, ebből játékos nélküli 119)
SELECT count(*) AS dobas, count(*) FILTER (WHERE e.player_id IS NULL) AS jatekos_nelkul
FROM hunbasket_shot_events e
JOIN hunbasket_shotchart_raw r ON r.id = e.raw_game_id
JOIN seasons s ON s.id = r.season_id
WHERE s.name = '2025/2026'
  AND r.season_slug = 'x2425'
  AND r.game_date < s.start_date;

-- 1/c) Ütközés-ellenőrzés: a 2024/2025 szezonban már meglévő dobástérkép és dobás
--      (várt: 0 és 0)
SELECT
  (SELECT count(*) FROM hunbasket_shotchart_raw r JOIN seasons s ON s.id = r.season_id WHERE s.name = '2024/2025') AS raw_2425,
  (SELECT count(*) FROM hunbasket_shot_events e JOIN seasons s ON s.id = e.season_id WHERE s.name = '2024/2025') AS esemeny_2425;

-- 1/d) Játékos-párosítás (várt: parositott 17076, nem_parositott 7)
WITH target_raw AS (
  SELECT r.id
  FROM hunbasket_shotchart_raw r
  JOIN seasons s ON s.id = r.season_id
  WHERE s.name = '2025/2026' AND r.season_slug = 'x2425' AND r.game_date < s.start_date
)
SELECT
  count(*) FILTER (WHERE p_new.id IS NOT NULL) AS parositott,
  count(*) FILTER (WHERE p_new.id IS NULL) AS nem_parositott
FROM hunbasket_shot_events e
JOIN players p_old ON p_old.id = e.player_id
LEFT JOIN players p_new
  ON p_new.season_id = (SELECT id FROM seasons WHERE name = '2024/2025')
 AND p_new.team_id = e.team_id
 AND lower(trim(p_new.name)) = lower(trim(p_old.name))
WHERE e.raw_game_id IN (SELECT id FROM target_raw);

-- 1/e) A párosítatlan dobások (várt: 1 sor – HAWKINS Elijah Jamil, SPIh3,
--      YASIIN Yousef Joseph, 7 dobás)
WITH target_raw AS (
  SELECT r.id
  FROM hunbasket_shotchart_raw r
  JOIN seasons s ON s.id = r.season_id
  WHERE s.name = '2025/2026' AND r.season_slug = 'x2425' AND r.game_date < s.start_date
)
SELECT p_old.name AS jelenlegi_jatekos, e.hunbasket_player_code, e.player_name_raw, count(*) AS dobas
FROM hunbasket_shot_events e
JOIN players p_old ON p_old.id = e.player_id
LEFT JOIN players p_new
  ON p_new.season_id = (SELECT id FROM seasons WHERE name = '2024/2025')
 AND p_new.team_id = e.team_id
 AND lower(trim(p_new.name)) = lower(trim(p_old.name))
WHERE e.raw_game_id IN (SELECT id FROM target_raw)
  AND p_new.id IS NULL
GROUP BY p_old.name, e.hunbasket_player_code, e.player_name_raw;

-- 1/f) Joseph 2024/2025-ös ASE sora (várt: pontosan 1 sor)
SELECT p.id, p.name
FROM players p
JOIN seasons s ON s.id = p.season_id
JOIN teams t ON t.id = p.team_id
WHERE s.name = '2024/2025'
  AND t.name = 'Atomerőmű SE'
  AND lower(trim(p.name)) = 'joseph yasiin yousef';

-- ---------------------------------------------------------------------
-- 2. ÁTKÖTÉS – egyetlen tranzakció; bármely eltérésnél semmi nem íródik
-- ---------------------------------------------------------------------

DO $$
DECLARE
  v_s2425 uuid;
  v_s2526 uuid;
  v_s2526_start date;
  v_ase uuid;
  v_joseph_2425 uuid;
  v_hawkins_2526 uuid;
  v_raw_count int;
  v_event_count int;
  v_conflicts int;
  v_mapped int;
  v_joseph int;
  v_leftover int;
  v_moved_events int;
  v_moved_raw int;
BEGIN
  SELECT id INTO STRICT v_s2425 FROM seasons WHERE name = '2024/2025';
  SELECT id, start_date INTO STRICT v_s2526, v_s2526_start FROM seasons WHERE name = '2025/2026';
  SELECT id INTO STRICT v_ase FROM teams WHERE name = 'Atomerőmű SE';
  -- STRICT: pontosan 1 sor kell, különben hiba.
  SELECT id INTO STRICT v_joseph_2425 FROM players
   WHERE season_id = v_s2425 AND team_id = v_ase AND lower(trim(name)) = 'joseph yasiin yousef';
  SELECT id INTO STRICT v_hawkins_2526 FROM players
   WHERE season_id = v_s2526 AND team_id = v_ase AND lower(trim(name)) = 'hawkins elijah jamil';

  CREATE TEMP TABLE h22_target_raw ON COMMIT DROP AS
    SELECT id FROM hunbasket_shotchart_raw
     WHERE season_id = v_s2526 AND season_slug = 'x2425' AND game_date < v_s2526_start;

  SELECT count(*) INTO v_raw_count FROM h22_target_raw;
  IF v_raw_count <> 138 THEN
    RAISE EXCEPTION 'H22: % átkötendő dobástérkép a várt 138 helyett – leállítva', v_raw_count;
  END IF;

  SELECT count(*) INTO v_event_count FROM hunbasket_shot_events
   WHERE raw_game_id IN (SELECT id FROM h22_target_raw);
  IF v_event_count <> 17202 THEN
    RAISE EXCEPTION 'H22: % átkötendő dobás a várt 17202 helyett – leállítva', v_event_count;
  END IF;

  -- Az esemény season_id-ja is a 2025/2026 legyen (különben a feltevés hamis).
  IF EXISTS (SELECT 1 FROM hunbasket_shot_events
              WHERE raw_game_id IN (SELECT id FROM h22_target_raw) AND season_id <> v_s2526) THEN
    RAISE EXCEPTION 'H22: van nem 2025/2026-os season_id-jú dobás a célmeccsekben – leállítva';
  END IF;

  -- Ütközés a 2024/2025 szezon meglévő soraival (UNIQUE season_id + game_code).
  SELECT count(*) INTO v_conflicts
    FROM hunbasket_shotchart_raw r
   WHERE r.season_id = v_s2425
     AND r.game_code IN (SELECT game_code FROM hunbasket_shotchart_raw WHERE id IN (SELECT id FROM h22_target_raw));
  IF v_conflicts <> 0 THEN
    RAISE EXCEPTION 'H22: % game_code már létezik a 2024/2025 szezonban – leállítva', v_conflicts;
  END IF;
  SELECT count(*) INTO v_conflicts
    FROM hunbasket_shot_events e
   WHERE e.season_id = v_s2425
     AND e.game_code IN (SELECT game_code FROM hunbasket_shotchart_raw WHERE id IN (SELECT id FROM h22_target_raw));
  IF v_conflicts <> 0 THEN
    RAISE EXCEPTION 'H22: % dobás már létezik ezekkel a game_code-okkal a 2024/2025 szezonban – leállítva', v_conflicts;
  END IF;

  -- 3) Játékos-átkötés: 2025/2026-os sor → 2024/2025-ös pár (csapat + név).
  UPDATE hunbasket_shot_events e
     SET player_id = p_new.id
    FROM players p_old, players p_new
   WHERE e.raw_game_id IN (SELECT id FROM h22_target_raw)
     AND p_old.id = e.player_id
     AND p_old.season_id = v_s2526
     AND p_new.season_id = v_s2425
     AND p_new.team_id = e.team_id
     AND lower(trim(p_new.name)) = lower(trim(p_old.name));
  GET DIAGNOSTICS v_mapped = ROW_COUNT;
  IF v_mapped <> 17076 THEN
    RAISE EXCEPTION 'H22: % dobás párosítva a várt 17076 helyett – leállítva', v_mapped;
  END IF;

  -- 4) A hibásan Hawkinshoz kötött 7 dobás Josephé (Hunbasket-név és box score alapján).
  UPDATE hunbasket_shot_events
     SET player_id = v_joseph_2425
   WHERE raw_game_id IN (SELECT id FROM h22_target_raw)
     AND player_id = v_hawkins_2526
     AND hunbasket_player_code = 'SPIh3'
     AND player_name_raw = 'YASIIN Yousef Joseph';
  GET DIAGNOSTICS v_joseph = ROW_COUNT;
  IF v_joseph <> 7 THEN
    RAISE EXCEPTION 'H22: % dobás Josephnek a várt 7 helyett – leállítva', v_joseph;
  END IF;

  -- Nem maradhat 2024/2025-ön kívüli játékosra mutató dobás.
  SELECT count(*) INTO v_leftover
    FROM hunbasket_shot_events e
    JOIN players p ON p.id = e.player_id
   WHERE e.raw_game_id IN (SELECT id FROM h22_target_raw)
     AND p.season_id <> v_s2425;
  IF v_leftover <> 0 THEN
    RAISE EXCEPTION 'H22: % dobás még nem 2024/2025-ös játékosra mutat – leállítva', v_leftover;
  END IF;

  -- 5) Szezon átkötése: előbb a dobások, aztán a nyers meccssorok.
  UPDATE hunbasket_shot_events
     SET season_id = v_s2425
   WHERE raw_game_id IN (SELECT id FROM h22_target_raw);
  GET DIAGNOSTICS v_moved_events = ROW_COUNT;

  UPDATE hunbasket_shotchart_raw
     SET season_id = v_s2425
   WHERE id IN (SELECT id FROM h22_target_raw);
  GET DIAGNOSTICS v_moved_raw = ROW_COUNT;

  IF v_moved_events <> 17202 OR v_moved_raw <> 138 THEN
    RAISE EXCEPTION 'H22: átkötve % dobás / % meccs a várt 17202 / 138 helyett – leállítva', v_moved_events, v_moved_raw;
  END IF;

  RAISE NOTICE 'H22 kész: % meccs, % dobás átkötve a 2024/2025 szezonba (% játékos-átkötés + % Joseph-javítás).',
    v_moved_raw, v_moved_events, v_mapped, v_joseph;
END $$;

-- ---------------------------------------------------------------------
-- 3. ELLENŐRZÉS – csak olvas
-- ---------------------------------------------------------------------

-- 3/a) Szezon ↔ slug egyezés (várt: 2024/2025 x2425 138 · 2025/2026 x2526 221 ·
--      2026/2027 x2627 a mostani darabszám; más kombináció nincs)
SELECT s.name AS szezon, r.season_slug, count(*) AS meccs,
       min(r.game_date) AS elso, max(r.game_date) AS utolso
FROM hunbasket_shotchart_raw r
JOIN seasons s ON s.id = r.season_id
GROUP BY s.name, r.season_slug
ORDER BY s.name, r.season_slug;

-- 3/b) Szezonon kívüli dátumú dobástérkép (várt: 0)
SELECT count(*) AS szezonon_kivul
FROM hunbasket_shotchart_raw r
JOIN seasons s ON s.id = r.season_id
WHERE r.game_date < s.start_date OR r.game_date > s.end_date;

-- 3/c) Dobás, amelynek szezonja eltér a meccséétől vagy a játékosáétól (várt: 0 és 0)
SELECT
  (SELECT count(*) FROM hunbasket_shot_events e JOIN hunbasket_shotchart_raw r ON r.id = e.raw_game_id
    WHERE e.season_id <> r.season_id) AS meccs_elteres,
  (SELECT count(*) FROM hunbasket_shot_events e JOIN players p ON p.id = e.player_id
    WHERE e.season_id <> p.season_id) AS jatekos_elteres;
