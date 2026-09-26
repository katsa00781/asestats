-- =====================================================================
-- add-games-opponent-team-id.sql
-- KÉZZEL FUTTATANDÓ a Supabase SQL Editorban!
--
-- Cél: a games.opponent eddig csak szabad szöveg volt (az import pillanatában
-- érvényes klubnév). A kliens ezt pontos névegyezéssel kereste a teams
-- táblában (hooks/useGameData.ts, TeamComparison), így minden klub-átnevezés
-- után a régi meccseknél elveszett az ellenfél-párosítás. A H3-as Honvéd
-- átnevezés óta ez 69 meccsen élő hiba (BACKLOG H7).
--
-- Ez a migráció:
--   1) felveszi a games.opponent_team_id oszlopot (FK → teams.id),
--   2) visszatölti a meglévő sorokra: pontos név, ill. ismert átnevezés,
--   3) indexet tesz rá a szezon-szűrt ellenfél-lekérdezésekhez.
--
-- A games.opponent szöveg MARAD (megjelenítés, historikus név); a
-- csapat-azonosítás mostantól az opponent_team_id-n megy. Az oszlop
-- nullable: kézi / JSON importnál előfordulhat nem feloldható ellenfél.
--
-- Idempotens: többször futtatva sem okoz kárt, a backfill csak a még
-- NULL sorokat tölti.
-- =====================================================================

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS opponent_team_id uuid
  REFERENCES public.teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS games_season_opponent_team_idx
  ON public.games (season_id, opponent_team_id);

COMMENT ON COLUMN public.games.opponent_team_id IS
  'Az ellenfél teams sora. A csapat-azonosítás erre épül; a games.opponent csak az import kori megjelenítési név.';

DO $$
DECLARE
  v_exact integer;
  v_alias integer;
  v_missing integer;
BEGIN
  -- 1) Pontos (kis-/nagybetű és szélső szóköz független) névegyezés.
  UPDATE public.games g
  SET opponent_team_id = t.id
  FROM public.teams t
  WHERE g.opponent_team_id IS NULL
    AND lower(trim(t.name)) = lower(trim(g.opponent));
  GET DIAGNOSTICS v_exact = ROW_COUNT;

  -- 2) Klub-átnevezések (a scrape-utils.ts TEAM_NAME_ALIASES games-ben
  --    ténylegesen előforduló régi nevei). Régi név → a teams sor mai neve.
  UPDATE public.games g
  SET opponent_team_id = t.id
  FROM (VALUES
    ('Endo Plus Service-Honvéd', 'Budapesti Honvéd Sportegyesület')
  ) AS a(old_name, current_name)
  JOIN public.teams t ON t.name = a.current_name
  WHERE g.opponent_team_id IS NULL
    AND lower(trim(g.opponent)) = lower(a.old_name);
  GET DIAGNOSTICS v_alias = ROW_COUNT;

  SELECT count(*) INTO v_missing FROM public.games WHERE opponent_team_id IS NULL;

  RAISE NOTICE 'opponent_team_id backfill: % pontos név, % átnevezés, % feloldatlan',
    v_exact, v_alias, v_missing;
END $$;

-- Ellenőrzés az Editorban (várt eredmény: 0 sor):
SELECT opponent, count(*) AS games
FROM public.games
WHERE opponent_team_id IS NULL
GROUP BY opponent
ORDER BY games DESC;
