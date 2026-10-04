-- =====================================================================
-- fix-remove-2024-25-games-from-2025-26-season.sql
-- KÉZZEL FUTTATANDÓ a Supabase SQL Editorban! (adattartalom-javítás)
--
-- Hiba: 2026-02-07-én és 2026-04-20-án a box-score import a 2024/2025-ös
-- Hunbasket sluggal (x2425) futott, de a 2025/2026-os szezonba írt. Emiatt
-- a 2025/2026 szezonban 276 olyan `games` sor van (csapatonként 19–21),
-- amelynek dátuma 2024-09-27 és 2025-02-28 közé esik, 2737
-- `player_game_stats_2025_2026` sorral. Ugyanezek a meccsek a 2024/2025
-- szezonban helyesen megvannak.
--
-- Következmény: a 2025/2026-os csapat- és játékosösszesítők (meccsszám,
-- pontátlag, `player_season_stats_by_season` view) a két szezon keverékét
-- mutatták – az ASE-nél 58 meccs a valós 39 helyett.
--
-- A script csak azokat a meccseket törli, amelyeknek van párja a 2024/2025
-- szezonban (azonos csapat + dátum). A `players` sorokhoz nem nyúl.
-- Futtatás: előbb az 1. lépés (előnézet), utána a 2. lépés egyben.
--
-- ÁLLAPOT: lefuttatva 2026-10-04-én (276 meccs, 2737 + 1 stat sor, 1 hibás
-- „játékos” törölve). Újrafuttatva az előnézet 0 sort ad, a törlés 0 sort érint.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ELŐNÉZET – csak olvas
-- ---------------------------------------------------------------------

-- 1/a) Törlendő meccsek csapatonként (várt összeg: 276)
SELECT t.name AS csapat, count(*) AS meccs, min(g.date) AS elso, max(g.date) AS utolso
FROM games g
JOIN seasons s ON s.id = g.season_id
JOIN teams t ON t.id = g.our_team_id
WHERE s.name = '2025/2026'
  AND g.date < s.start_date
GROUP BY t.name
ORDER BY t.name;

-- 1/b) Pár nélküli meccsek: ezeknek NINCS megfelelője a 2024/2025 szezonban,
--      a script nem törli őket (várt eredmény: 0 sor)
SELECT g.id, g.date, t.name AS csapat, g.opponent
FROM games g
JOIN seasons s ON s.id = g.season_id
JOIN teams t ON t.id = g.our_team_id
WHERE s.name = '2025/2026'
  AND g.date < s.start_date
  AND NOT EXISTS (
    SELECT 1
    FROM games g2
    JOIN seasons s2 ON s2.id = g2.season_id
    WHERE s2.name = '2024/2025'
      AND g2.our_team_id = g.our_team_id
      AND g2.date = g.date
  );

-- 1/c) Érintett játékos-sorok száma (várt: 2737)
SELECT count(*) AS stat_sor
FROM player_game_stats_2025_2026 pgs
JOIN games g ON g.id = pgs.game_id
JOIN seasons s ON s.id = g.season_id
WHERE s.name = '2025/2026'
  AND g.date < s.start_date;

-- ---------------------------------------------------------------------
-- 2. JAVÍTÁS – egy tranzakcióban
-- ---------------------------------------------------------------------
-- A törlendő halmaz mindkét utasításban ugyanaz az allekérdezés (nincs temp
-- tábla), így a lépések külön-külön kijelölve is futtathatók és a script
-- újrafuttatható: második futásra 0 sort töröl.
BEGIN;

-- A stat sorok FK-ja ON DELETE CASCADE, de explicit töröljük, hogy a
-- törölt sorszám a futtatáskor látható legyen.
DELETE FROM player_game_stats_2025_2026
WHERE game_id IN (
  SELECT g.id
  FROM games g
  JOIN seasons s ON s.id = g.season_id
  WHERE s.name = '2025/2026'
    AND g.date < s.start_date
    AND EXISTS (
      SELECT 1
      FROM games g2
      JOIN seasons s2 ON s2.id = g2.season_id
      WHERE s2.name = '2024/2025'
        AND g2.our_team_id = g.our_team_id
        AND g2.date = g.date
    )
);

DELETE FROM games
WHERE id IN (
  SELECT g.id
  FROM games g
  JOIN seasons s ON s.id = g.season_id
  WHERE s.name = '2025/2026'
    AND g.date < s.start_date
    AND EXISTS (
      SELECT 1
      FROM games g2
      JOIN seasons s2 ON s2.id = g2.season_id
      WHERE s2.name = '2024/2025'
        AND g2.our_team_id = g.our_team_id
        AND g2.date = g.date
    )
);

-- 2/b) Összesítő-sorból keletkezett „játékos” (a neve csupa szám és tabulátor,
--      pl. a 2026-02-22-i Honvéd–ASE kupameccsen): a csapat összesítő sora
--      játékosként importálódott, ezért a meccs box score-ja duplán számolt.
DELETE FROM player_game_stats_2025_2026
WHERE player_id IN (SELECT id FROM players WHERE name ~ '^[0-9[:space:]]+$');

DELETE FROM players
WHERE name ~ '^[0-9[:space:]]+$';

COMMIT;

-- ---------------------------------------------------------------------
-- 3. ELLENŐRZÉS – a javítás után
-- ---------------------------------------------------------------------

-- 3/a) Nem maradhat szezonon kívüli dátumú meccs a 2025/2026 szezonban (várt: 0)
SELECT count(*) AS maradt
FROM games g
JOIN seasons s ON s.id = g.season_id
WHERE s.name = '2025/2026'
  AND g.date < s.start_date;

-- 3/b) Az ASE 2025/2026 meccsszáma (várt: 39)
SELECT count(*) AS ase_meccs
FROM games g
JOIN seasons s ON s.id = g.season_id
JOIN teams t ON t.id = g.our_team_id
WHERE s.name = '2025/2026'
  AND t.name = 'Atomerőmű SE';

-- 3/c) Tájékoztató: 2025/2026-os játékosok, akiknek a javítás után egyetlen
--      meccs-soruk sincs. Ezek nem törlődnek – lehetnek valódi keret-tagok
--      (roster import), a Kezelés tabon kell átnézni őket.
SELECT t.name AS csapat, p.name AS jatekos, p.is_active
FROM players p
JOIN seasons s ON s.id = p.season_id
LEFT JOIN teams t ON t.id = p.team_id
WHERE s.name = '2025/2026'
  AND NOT EXISTS (SELECT 1 FROM player_game_stats_2025_2026 pgs WHERE pgs.player_id = p.id)
ORDER BY t.name, p.name;
