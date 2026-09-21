-- Játékosmozgások a valós szezonos keretek különbségéből.
-- KÉZZEL FUTTATANDÓ a Supabase SQL Editorban az alaptáblák és a teljes
-- kosarstat:team-players import UTÁN. A forrás: szezonos boxstats névsor.
--
-- A season_id mindkét iránynál a CÉLSZEZON: 2025/26 alatt a 2024/25 ->
-- 2025/26 váltás érkezői és távozói látszanak. Nincs napon belüli vagy
-- szezonon belüli sorrendállítás. Az első importált év csak viszonyítási
-- alap; hiányzó következő szezonból nem gyártunk tömeges távozásokat.
-- A hiány nem bizonyít külföldi klubot: az unknown kizárólag ismeretlent jelent.
-- A return a nyomon követett csapatok közé való visszatérés, nem feltétlenül
-- ugyanahhoz a klubhoz. Több csapat/szezon esetén minden ismert ellenoldali
-- klubot visszaadunk, nem választunk önkényesen LAG-szomszédot.

BEGIN;

CREATE OR REPLACE VIEW public.league_player_movements
WITH (security_invoker = true) AS
WITH memberships AS (
  SELECT m.*, s.name AS season_name, EXTRACT(YEAR FROM s.start_date)::int AS season_year
  FROM public.league_player_team_seasons m
  JOIN public.seasons s ON s.id = m.season_id
), observed_seasons AS (
  SELECT DISTINCT season_id, season_name, season_year FROM memberships
), player_seasons AS (
  SELECT kosarstat_player_id, season_id, season_year, ARRAY_AGG(DISTINCT team_id ORDER BY team_id) AS team_ids
  FROM memberships
  GROUP BY kosarstat_player_id, season_id, season_year
), history AS (
  SELECT *,
    LAG(season_year) OVER player_history AS previous_year,
    LAG(team_ids) OVER player_history AS previous_teams,
    LEAD(season_year) OVER player_history AS next_year,
    LEAD(team_ids) OVER player_history AS next_teams
  FROM player_seasons
  WINDOW player_history AS (PARTITION BY kosarstat_player_id ORDER BY season_year)
), events AS (
  SELECT m.id::text || ':arrival' AS id, m.kosarstat_player_id, m.team_id,
    m.season_id, m.season_name, prior.season_name AS previous_season_name,
    'arrival'::text AS direction,
    CASE WHEN h.previous_year = m.season_year - 1 THEN 'domestic_transfer'
         WHEN h.previous_year < m.season_year - 1 THEN 'return'
         ELSE 'unknown' END AS movement_type,
    CASE WHEN h.previous_year = m.season_year - 1 THEN h.previous_teams ELSE ARRAY[]::uuid[] END AS counterpart_team_ids,
    CASE WHEN h.previous_year < m.season_year - 1 THEN m.season_year - h.previous_year - 1 ELSE 0 END AS gap_seasons,
    m.status_at_time, m.imported_at
  FROM memberships m
  JOIN history h USING (kosarstat_player_id, season_id, season_year)
  JOIN observed_seasons prior ON prior.season_year = m.season_year - 1
  WHERE h.previous_year IS NULL OR h.previous_year <> m.season_year - 1
     OR NOT (m.team_id = ANY(h.previous_teams))
  UNION ALL
  SELECT m.id::text || ':departure', m.kosarstat_player_id, m.team_id,
    following.season_id, following.season_name, m.season_name,
    'departure'::text,
    CASE WHEN h.next_year = m.season_year + 1 THEN 'domestic_transfer' ELSE 'unknown' END,
    CASE WHEN h.next_year = m.season_year + 1 THEN h.next_teams ELSE ARRAY[]::uuid[] END,
    0, m.status_at_time, m.imported_at
  FROM memberships m
  JOIN history h USING (kosarstat_player_id, season_id, season_year)
  JOIN observed_seasons following ON following.season_year = m.season_year + 1
  WHERE h.next_year IS NULL OR h.next_year <> m.season_year + 1
     OR NOT (m.team_id = ANY(h.next_teams))
)
SELECT e.*, p.display_name, p.position, p.profile_url, t.name AS team_name,
  ARRAY(SELECT other.name FROM public.teams other WHERE other.id = ANY(e.counterpart_team_ids) ORDER BY other.name) AS counterpart_team_names
FROM events e
JOIN public.league_players p USING (kosarstat_player_id)
JOIN public.teams t ON t.id = e.team_id;

-- A hívó jogosultságával fut: az alaptáblák RLS-e érvényben marad.
REVOKE ALL ON public.league_player_movements FROM PUBLIC, anon;
GRANT SELECT ON public.league_player_movements TO authenticated, service_role;
COMMENT ON VIEW public.league_player_movements IS
  'Szezonos keretkülönbségek, célszezon szerint; unknown nem bizonyított külföldi igazolás. Teljes bajnokság-import után értelmezendő.';

COMMIT;

-- Ellenőrzés az Editorban:
SELECT season_name, direction, movement_type, COUNT(*) AS movements
FROM public.league_player_movements
GROUP BY season_name, direction, movement_type
ORDER BY season_name, direction, movement_type;
