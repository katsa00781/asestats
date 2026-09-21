-- Bajnokság-szintű játékosmozgás nyomonkövetés – alaptáblák.
-- KÉZZEL FUTTATANDÓ a Supabase SQL Editorban!
--
-- Miért külön táblák, nem a `players` bővítése: a `players` a jelenlegi
-- szezon/csapat stat-linkeléshez van (player_game_stats FK-k, dedup kulcs:
-- (season_id, team_id, lower(trim(name))) – lásd add-players-unique-index.sql),
-- és nincs benne stabil azonosító szezonok/csapatok között. Ez a feature
-- viszont a kosarstat.hu-adta STABIL player-ID-ra épül, ami szezonokon és
-- csapatokon átívelő igazolás-történetet tesz lehetővé anélkül, hogy a
-- meglévő stat-workflow-t érintené.
--
-- Forrás: kosarstat.hu/teams/team/boxstats/?team=<ID>&season=<kód>, a
-- scrape-kosarstat-team-players.ts szkript pontos szezonos névsorokat tölt fel.
-- A `kosarstat_team_map` a kosarstat csapat-ID -> teams.id leképezést tárolja,
-- forrásoldali klubnév-aliasok és egyértelmű névegyezés alapján;
-- a korábban rögzített kézi leképezés elsőbbséget élvez.
--
-- Író: csak a scraper (service role, megkerüli az RLS-t). Kliens oldalról
-- csak SELECT megy – ugyanaz a minta, mint az add-live-match-tables.sql-ben.

CREATE TABLE IF NOT EXISTS kosarstat_team_map (
  team_id UUID PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
  kosarstat_team_id TEXT NOT NULL UNIQUE,
  kosarstat_team_name TEXT NOT NULL,
  matched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Kézi javításra, ha egy klub átnevezés/eltérő megjelenítési név miatt a
  -- fuzzy match tévedne vagy nem találna párt.
  notes TEXT
);

CREATE TABLE IF NOT EXISTS league_players (
  -- A kosarstat.hu /players/player/?player=<id> URL-jéből származó opak
  -- azonosító string (pl. "willnick82") – NEM parse-oljuk/generáljuk,
  -- csak stabil kulcsként kezeljük.
  kosarstat_player_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  position TEXT,
  birth_year INT,
  height_cm INT,
  weight_kg INT,
  -- hazai / legios (Légiós) / honositott (Honosított) – a legutóbb látott
  -- állapot; karrier alatt változhat (pl. honosítás), a pontos idősoros
  -- állapot a league_player_team_seasons.status_at_time-ban van.
  latest_status TEXT CHECK (latest_status IN ('hazai', 'legios', 'honositott')),
  profile_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS league_player_team_seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kosarstat_player_id TEXT NOT NULL REFERENCES league_players(kosarstat_player_id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  -- Lehet NULL, ha a kosarstat_season_label nem illeszthető a seasons
  -- táblára (pl. formátum-eltérés) – a nyers label akkor is megmarad,
  -- a sor nem vész el, később kézzel javítható.
  season_id UUID REFERENCES seasons(id) ON DELETE SET NULL,
  -- Szezonjelölés (pl. "2023-24") – kizárólag az adott szezon boxstats
  -- névsorában ténylegesen szereplő tagság, archív időtartomány-kibontás nélkül.
  kosarstat_season_label TEXT NOT NULL,
  status_at_time TEXT CHECK (status_at_time IN ('hazai', 'legios', 'honositott')),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (kosarstat_player_id, team_id, kosarstat_season_label)
);

CREATE INDEX IF NOT EXISTS idx_lpts_player ON league_player_team_seasons (kosarstat_player_id);
CREATE INDEX IF NOT EXISTS idx_lpts_team_season ON league_player_team_seasons (team_id, season_id);
CREATE INDEX IF NOT EXISTS idx_lpts_season ON league_player_team_seasons (season_id);

-- RLS: bejelentkezett felhasználók olvashatnak, írás csak service_role-nak
-- (a scraper ezzel a kulccsal fut, megkerüli az RLS-t) – ugyanaz a minta,
-- mint a live_games/live_player_lines táblákon (add-live-match-tables.sql).
ALTER TABLE kosarstat_team_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_player_team_seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kosarstat_team_map_select_authenticated"
  ON kosarstat_team_map
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "league_players_select_authenticated"
  ON league_players
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "lpts_select_authenticated"
  ON league_player_team_seasons
  FOR SELECT
  TO authenticated
  USING (true);
