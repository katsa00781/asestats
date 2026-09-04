// Élő mérkőzés-gyűjtő – Supabase Edge Function.
//
// Forrás: az MKOSZ `hunbasket.hu/elo` oldala linkeli az éppen futó
// mérkőzések netcasting élő jegyzőkönyvét (`class="live-game"` link,
// `https://netcasting<N>.webpont.com/?<kód>` alakban). A netcasting kliens
// saját maga a `storage/full<kód>.html` végpontot hívja JSON-ért – ez NEM
// szabványos JSON, három string-cserével dekódolható
// (`js/1.n6.js` `jsonDecode()` függvénye):
//
//   s.replace(/#/g, '","').replace(/\|/g, '":"').replace(/%/g, '"},{"')
//
// A play-by-play esemény-kódok (a `f` tömb `"2"` mezője) és a dobás-altípus
// pontértéke (a `"6"` mező, `alkodok` térkép a forrásban) a netcasting
// kliens saját, magyar nyelvű `filmCode2Text.hun` szótárából és az
// `addEvent()` switch-ágaiból lettek kiolvasva – nem feltételezés:
//
//   1000 = sikeres dobás (altípus 1=közeli/2, 2=középtávoli/2, 3=hárompontos/3,
//          4=büntető/1, 5=zsákolás/2 – a szám a pontérték)
//   1001 = sikertelen dobás (ugyanazok az altípusok, csak kísérlet nő)
//   1002 = védőlepattanó · 1003 = támadólepattanó · 1004 = szerzett labda
//   1005 = eladott labda · 1007 = fault · 1008 = gólpassz · 1009 = blokk
//   1020 = technikai fault (faultként számoljuk)
//   1006 (kiharcolt fault), 1010 (kapott blokk), 1011 (csere), 1100 (óra
//   ketyegés), 1101 (negyed vége), 2xxx (csapatszintű, nincs játékoskód)
//   – nincs megfelelő oszlop a box score-ban, szándékosan kimaradnak.
//
// Amit NEM tudunk biztosan (élő meccsen validálandó – lásd HOWTO-live-scan.md):
//   - a percek (minutes) kiszámítása csereesemény-párosításból still nyitott,
//     v1-ben minden sor `minutes = 0`
//   - a "félidő" (halftime) állapot forrásbeli jelzése nincs megbízhatóan
//     azonosítva, v1-ben nem írunk 'halftime' státuszt, csak 'live'/'final'-t
//   - az óra (`clock`) a forrás saját `getTimeStrFromGT()` képletét követi
//     (`gt % 600` másodperc a negyeden belül, NÖVEKVŐ, nem visszaszámláló),
//     de ezt még nem láttuk élő meccsen a saját szemünkkel

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

import { simpleValuation } from '../_shared/stat-formulas.ts';
import { findTeamByName, type LiveTeamRecord } from '../_shared/team-match.ts';

const ELO_URL = 'https://hunbasket.hu/elo';
const USER_AGENT = 'Mozilla/5.0 (compatible; ASEStatsLiveScan/1.0; +https://asestats.hu)';
const FINAL_RETENTION_HOURS = 6;
/** alkodok – a dobás-altípus (1–5) pontértéke, a forrás saját térképe. */
const SHOT_POINTS: Record<number, number> = { 1: 2, 2: 2, 3: 3, 4: 1, 5: 2 };
/** Csak a férfi NB I. A csoport kódjai (nem kupa/utánpótlás/női). */
const MATCH_CODE_PATTERN = /^hun_\d+$/i;

type TeamSide = 'home' | 'away';

Deno.serve(async () => {
  try {
    const summary = await runLiveScan();
    return new Response(JSON.stringify(summary), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('live-scan: futtatási hiba', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

interface ScanSummary {
  seasonId: string | null;
  liveMatchesFound: number;
  processed: number;
  skipped: Array<{ code: string; reason: string }>;
  finalized: number;
  purged: number;
}

async function runLiveScan(): Promise<ScanSummary> {
  const supabase = createServiceClient();

  const season = await resolveCurrentSeason(supabase);
  if (!season) {
    console.warn('live-scan: nincs is_current=true szezon, kilépés.');
    return { seasonId: null, liveMatchesFound: 0, processed: 0, skipped: [], finalized: 0, purged: 0 };
  }

  const purged = await purgeOldFinalMatches(supabase, season.id);

  const eloHtml = await fetchText(ELO_URL);
  const links = parseLiveMatchLinks(eloHtml);

  if (links.length === 0) {
    // Nincs élő közvetítés – a korábban élőnek jelölt sorokat lezárjuk, és kilépünk.
    const finalized = await finalizeMissingMatches(supabase, season.id, new Set());
    return {
      seasonId: season.id,
      liveMatchesFound: 0,
      processed: 0,
      skipped: [],
      finalized,
      purged,
    };
  }

  const teams = await fetchTeams(supabase);
  const seenSourceCodes = new Set<string>();
  const skipped: Array<{ code: string; reason: string }> = [];
  let processed = 0;

  for (const link of links) {
    try {
      const handled = await processMatch(supabase, season.id, teams, link);
      if (handled) {
        seenSourceCodes.add(link.code);
        processed++;
      } else {
        skipped.push({ code: link.code, reason: 'csapat feloldás sikertelen' });
      }
    } catch (error) {
      // Egy hibás meccs ne akassza meg a többit.
      console.error(`live-scan: hiba a(z) ${link.code} feldolgozásakor`, error);
      skipped.push({ code: link.code, reason: String(error) });
    }
  }

  const finalized = await finalizeMissingMatches(supabase, season.id, seenSourceCodes);

  return {
    seasonId: season.id,
    liveMatchesFound: links.length,
    processed,
    skipped,
    finalized,
    purged,
  };
}

function createServiceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY hiányzik (platform-injektált secret).');
  }
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`${url} → HTTP ${response.status}`);
  return response.text();
}

// --- 1. Élő meccs-linkek a /elo oldalról ---------------------------------

interface LiveLink {
  code: string;
  host: string;
}

/**
 * A `hunbasket.hu/elo` "Élő mérkőzések" / "Befejezett mérkőzések" szekciói
 * közötti szakaszból szedi ki a netcasting linkeket. Ha a két szövegjelölő
 * nem található (a szerkezet megváltozott), üres listát ad – ezt a HOWTO
 * hangsúlyozza, mint az első ellenőrizendő pontot élő meccsen.
 */
export function parseLiveMatchLinks(html: string): LiveLink[] {
  const start = html.indexOf('Élő mérkőzések');
  if (start === -1) return [];

  const end = html.indexOf('Befejezett mérkőzések', start);
  const section = end === -1 ? html.slice(start) : html.slice(start, end);

  const linkPattern = /href="https?:\/\/(netcasting\d*\.webpont\.com)\/\?([a-z0-9_]+)"/gi;
  const links: LiveLink[] = [];
  const seen = new Set<string>();

  for (const match of section.matchAll(linkPattern)) {
    const [, host, code] = match;
    if (!MATCH_CODE_PATTERN.test(code)) continue; // csak férfi NB I, nem kupa/utánpótlás/női
    const key = `${host}:${code}`;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ code, host });
  }

  return links;
}

// --- 2. Netcasting JSON dekódolás -----------------------------------------

interface PlayerRosterEntry {
  Jatekos: string;
  nev: string;
  mez: string;
}

interface NetcastingGame {
  i?: {
    h?: string;
    a?: string;
    hp?: string | number;
    vp?: string | number;
    [key: string]: unknown;
  };
  f?: Array<Record<string, string>>;
  jr?: string | number;
  players?: { home?: unknown; away?: unknown };
  [key: string]: unknown;
}

function decodeNetcastingJson(raw: string): NetcastingGame | null {
  const transformed = raw.replace(/#/g, '","').replace(/\|/g, '":"').replace(/%/g, '"},{"');
  try {
    return JSON.parse(transformed) as NetcastingGame;
  } catch {
    return null;
  }
}

// --- 3. Egy meccs feldolgozása ---------------------------------------------

async function processMatch(
  supabase: SupabaseClient,
  seasonId: string,
  teams: LiveTeamRecord[],
  link: LiveLink,
): Promise<boolean> {
  const sourceUrl = `https://${link.host}/storage/full${link.code}.html`;
  const raw = await fetchText(sourceUrl);
  const game = decodeNetcastingJson(raw);
  if (!game || !game.i || !game.f) {
    console.warn(`live-scan: ${link.code} – dekódolás vagy alapmezők sikertelenek, kihagyva.`);
    return false;
  }

  const homeName = typeof game.i.h === 'string' ? game.i.h : '';
  const awayName = typeof game.i.a === 'string' ? game.i.a : '';
  const homeTeam = findTeamByName(teams, homeName);
  const awayTeam = findTeamByName(teams, awayName);

  // Névdrift-védelem: ha a csapat nem oldható fel, ne írjunk sort – ugyanaz
  // az elv, mint a `scrape-hunbasket-fixtures.ts`-ben (nem hozunk létre új
  // `teams` sort automatikusan, inkább hangosan kihagyjuk).
  if (!homeTeam || !awayTeam) {
    console.warn(
      `live-scan: ${link.code} – csapat nem oldható fel ("${homeName}" / "${awayName}"), kihagyva.`,
    );
    return false;
  }

  const events = game.f;
  const lastEvent = events.length > 0 ? events[events.length - 1] : null;
  const gt = lastEvent ? Number(lastEvent.gt) || 0 : 0;
  const period = gt > 0 ? Math.ceil(gt / 600) : 0;
  const clock = gt > 0 ? formatClock(gt) : null;
  const finished = Number(game.jr) === 2;

  const homeScore = toInt(game.i.hp);
  const awayScore = toInt(game.i.vp);

  const fixtureId = await resolveFixtureId(supabase, seasonId, homeTeam.id, awayTeam.id);

  const { data: liveGameRow, error: gameError } = await supabase
    .from('live_games')
    .upsert(
      {
        season_id: seasonId,
        fixture_id: fixtureId,
        home_team_id: homeTeam.id,
        away_team_id: awayTeam.id,
        home_team_name: homeName || homeTeam.name,
        away_team_name: awayName || awayTeam.name,
        home_score: homeScore,
        away_score: awayScore,
        period,
        clock,
        status: finished ? 'final' : 'live',
        source_code: link.code,
        source_url: sourceUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'season_id,source_code' },
    )
    .select('id')
    .single();

  if (gameError || !liveGameRow) {
    throw new Error(`live_games upsert sikertelen (${link.code}): ${gameError?.message ?? 'ismeretlen hiba'}`);
  }

  const liveGameId = liveGameRow.id as string;
  const roster = buildRosterMaps(game.players);

  await upsertPlayerLines(supabase, liveGameId, events, roster);
  await upsertQuarterScores(supabase, liveGameId, events);

  return true;
}

function toInt(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/**
 * A forrás saját `getTimeStrFromGT()` képlete: a negyeden belüli eltelt
 * másodperc (`gt % 600`), NÖVEKVŐ óraként formázva (nem visszaszámláló).
 * Hosszabbítás alatt a forrás is ugyanezzel a %600-zal számol – ezt a
 * (nem tökéletes, de a forrással konzisztens) viselkedést követjük.
 */
function formatClock(gt: number): string {
  const seconds = gt % 600;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

// --- 4. Csapatok és szezon ---------------------------------------------------

async function fetchTeams(supabase: SupabaseClient): Promise<LiveTeamRecord[]> {
  const { data, error } = await supabase.from('teams').select('id, name, short_name');
  if (error) throw new Error(`teams lekérdezés sikertelen: ${error.message}`);
  return (data ?? []) as LiveTeamRecord[];
}

async function resolveCurrentSeason(supabase: SupabaseClient): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from('seasons')
    .select('id')
    .eq('is_current', true)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`seasons lekérdezés sikertelen: ${error.message}`);
  return data ? { id: data.id as string } : null;
}

/** Best-effort: nem blokkol, ha nincs találat – a mobil app nem használja ezt a mezőt. */
async function resolveFixtureId(
  supabase: SupabaseClient,
  seasonId: string,
  homeTeamId: string,
  awayTeamId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('league_fixtures')
    .select('id')
    .eq('season_id', seasonId)
    .eq('home_team_id', homeTeamId)
    .eq('away_team_id', awayTeamId)
    .order('game_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? (data.id as string) : null;
}

// --- 5. Box score a play-by-play eseményekből -------------------------------

function buildRosterMaps(players: NetcastingGame['players']): Record<TeamSide, Map<string, PlayerRosterEntry>> {
  const toMap = (list: unknown): Map<string, PlayerRosterEntry> => {
    const map = new Map<string, PlayerRosterEntry>();
    if (!Array.isArray(list)) return map;
    for (const row of list) {
      if (!row || typeof row !== 'object') continue;
      const entry = row as Partial<PlayerRosterEntry>;
      if (typeof entry.Jatekos !== 'string') continue;
      map.set(entry.Jatekos, {
        Jatekos: entry.Jatekos,
        nev: typeof entry.nev === 'string' ? entry.nev : entry.Jatekos,
        mez: typeof entry.mez === 'string' ? entry.mez : '',
      });
    }
    return map;
  };

  return { home: toMap(players?.home), away: toMap(players?.away) };
}

function cleanPlayerName(raw: string): string {
  return raw.replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
}

interface PlayerAgg {
  side: TeamSide;
  code: string;
  name: string;
  number: number | null;
  points: number;
  closeMade: number;
  closeAttempted: number;
  midMade: number;
  midAttempted: number;
  threeMade: number;
  threeAttempted: number;
  ftMade: number;
  ftAttempted: number;
  totalRebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  foulsCommitted: number;
}

function aggregateBoxScore(
  events: Array<Record<string, string>>,
  roster: Record<TeamSide, Map<string, PlayerRosterEntry>>,
): PlayerAgg[] {
  const byKey = new Map<string, PlayerAgg>();

  const ensure = (side: TeamSide, code: string): PlayerAgg => {
    const key = `${side}:${code}`;
    let entry = byKey.get(key);
    if (!entry) {
      const info = roster[side].get(code);
      entry = {
        side,
        code,
        name: info ? cleanPlayerName(info.nev) : code,
        // `Number(...) || null` 0-s mezszámnál hibásan null-t adna (0 falsy) –
        // explicit véges-szám ellenőrzés kell.
        number: info && info.mez !== '' && Number.isFinite(Number(info.mez)) ? Number(info.mez) : null,
        points: 0,
        closeMade: 0,
        closeAttempted: 0,
        midMade: 0,
        midAttempted: 0,
        threeMade: 0,
        threeAttempted: 0,
        ftMade: 0,
        ftAttempted: 0,
        totalRebounds: 0,
        assists: 0,
        steals: 0,
        blocks: 0,
        turnovers: 0,
        foulsCommitted: 0,
      };
      byKey.set(key, entry);
    }
    return entry;
  };

  for (const event of events) {
    const code = Number(event['2']);
    const playerCode = (event['3'] ?? '').trim();
    if (!playerCode || !Number.isFinite(code) || code >= 2000) continue; // csapatszintű esemény kimarad

    const side: TeamSide = event['1'] === '1' ? 'home' : 'away';
    const player = ensure(side, playerCode);
    const subtype = Number(event['6']);

    switch (code) {
      case 1000: {
        const points = SHOT_POINTS[subtype] ?? 0;
        player.points += points;
        if (subtype === 3) {
          player.threeMade++;
          player.threeAttempted++;
        } else if (subtype === 4) {
          player.ftMade++;
          player.ftAttempted++;
        } else if (subtype === 2) {
          player.midMade++;
          player.midAttempted++;
        } else {
          // subtype 1 (közeli) és 5 (zsákolás) – mindkettő a "close" vödörbe
          // megy, ugyanaz a konvenció, mint a lejátszott meccsek box score-jában
          // (close_made = közeli + zsákolás egy oszlopban).
          player.closeMade++;
          player.closeAttempted++;
        }
        break;
      }
      case 1001: {
        if (subtype === 3) player.threeAttempted++;
        else if (subtype === 4) player.ftAttempted++;
        else if (subtype === 2) player.midAttempted++;
        else player.closeAttempted++;
        break;
      }
      case 1002:
      case 1003:
        player.totalRebounds++;
        break;
      case 1004:
        player.steals++;
        break;
      case 1005:
        player.turnovers++;
        break;
      case 1007:
      case 1020:
        player.foulsCommitted++;
        break;
      case 1008:
        player.assists++;
        break;
      case 1009:
        player.blocks++;
        break;
      default:
        // 1006 (kiharcolt fault), 1010 (kapott blokk), 1011 (csere), 1100
        // (óra ketyegés), 1101 (negyed vége) – nincs megfelelő oszlop.
        break;
    }
  }

  return [...byKey.values()];
}

async function upsertPlayerLines(
  supabase: SupabaseClient,
  liveGameId: string,
  events: Array<Record<string, string>>,
  roster: Record<TeamSide, Map<string, PlayerRosterEntry>>,
): Promise<void> {
  const players = aggregateBoxScore(events, roster);
  if (players.length === 0) return;

  const rows = players.map((player) => ({
    live_game_id: liveGameId,
    team_side: player.side,
    source_player_code: player.code,
    player_name: player.name,
    number: player.number,
    // v1: a percek kiszámítása csereesemény-párosításból nyitott feladat –
    // lásd a fájl fejlécét és a HOWTO-live-scan.md-t.
    minutes: 0,
    points: player.points,
    close_made: player.closeMade,
    close_attempted: player.closeAttempted,
    mid_made: player.midMade,
    mid_attempted: player.midAttempted,
    three_made: player.threeMade,
    three_attempted: player.threeAttempted,
    free_throw_made: player.ftMade,
    free_throw_attempted: player.ftAttempted,
    total_rebounds: player.totalRebounds,
    assists: player.assists,
    steals: player.steals,
    blocks: player.blocks,
    turnovers: player.turnovers,
    fouls_committed: player.foulsCommitted,
    valuation: simpleValuation({
      points: player.points,
      rebounds: player.totalRebounds,
      assists: player.assists,
      steals: player.steals,
      blocks: player.blocks,
      fgMade: player.closeMade + player.midMade + player.threeMade,
      fgAttempted: player.closeAttempted + player.midAttempted + player.threeAttempted,
      ftMade: player.ftMade,
      ftAttempted: player.ftAttempted,
      turnovers: player.turnovers,
    }),
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('live_player_lines')
    .upsert(rows, { onConflict: 'live_game_id,team_side,source_player_code' });
  if (error) throw new Error(`live_player_lines upsert sikertelen: ${error.message}`);
}

// --- 6. Negyedenkénti pontbontás --------------------------------------------

async function upsertQuarterScores(
  supabase: SupabaseClient,
  liveGameId: string,
  events: Array<Record<string, string>>,
): Promise<void> {
  const totals: Record<TeamSide, Map<number, number>> = { home: new Map(), away: new Map() };

  for (const event of events) {
    const code = Number(event['2']);
    if (code !== 1000) continue; // csak a sikeres dobás módosítja az eredményt
    const side: TeamSide = event['1'] === '1' ? 'home' : 'away';
    const subtype = Number(event['6']);
    const points = SHOT_POINTS[subtype] ?? 0;
    const gt = Number(event.gt) || 0;
    const quarter = gt > 0 ? Math.max(1, Math.ceil(gt / 600)) : 1;
    totals[side].set(quarter, (totals[side].get(quarter) ?? 0) + points);
  }

  const rows: Array<{
    live_game_id: string;
    team_side: TeamSide;
    quarter: number;
    points: number;
    cumulative_points: number;
    updated_at: string;
  }> = [];

  for (const side of ['home', 'away'] as const) {
    const quarters = [...totals[side].keys()].sort((a, b) => a - b);
    let cumulative = 0;
    for (const quarter of quarters) {
      const points = totals[side].get(quarter) ?? 0;
      cumulative += points;
      rows.push({
        live_game_id: liveGameId,
        team_side: side,
        quarter,
        points,
        cumulative_points: cumulative,
        updated_at: new Date().toISOString(),
      });
    }
  }

  if (rows.length === 0) return;

  const { error } = await supabase
    .from('live_quarter_scores')
    .upsert(rows, { onConflict: 'live_game_id,team_side,quarter' });
  if (error) throw new Error(`live_quarter_scores upsert sikertelen: ${error.message}`);
}

// --- 7. Lezárás és takarítás -------------------------------------------------

/**
 * Minden `live`/`halftime` sor, ami ebben a futásban NEM szerepelt az élő
 * listában, 'final'-ra vált – a meccs véget ért, vagy a forrás eltávolította.
 */
async function finalizeMissingMatches(
  supabase: SupabaseClient,
  seasonId: string,
  seenSourceCodes: Set<string>,
): Promise<number> {
  const { data, error } = await supabase
    .from('live_games')
    .select('id, source_code')
    .eq('season_id', seasonId)
    .in('status', ['live', 'halftime']);

  if (error) throw new Error(`live_games lekérdezés (finalize) sikertelen: ${error.message}`);
  if (!data) return 0;

  const staleIds = data
    .filter((row) => !seenSourceCodes.has(row.source_code as string))
    .map((row) => row.id as string);

  if (staleIds.length === 0) return 0;

  const { error: updateError } = await supabase
    .from('live_games')
    .update({ status: 'final', updated_at: new Date().toISOString() })
    .in('id', staleIds);
  if (updateError) throw new Error(`live_games finalize sikertelen: ${updateError.message}`);

  return staleIds.length;
}

/** A lezárt meccsek `FINAL_RETENTION_HOURS` óra után törlődnek (cascade a gyerek táblákra). */
async function purgeOldFinalMatches(supabase: SupabaseClient, seasonId: string): Promise<number> {
  const cutoff = new Date(Date.now() - FINAL_RETENTION_HOURS * 60 * 60 * 1000).toISOString();
  const { error, count } = await supabase
    .from('live_games')
    .delete({ count: 'exact' })
    .eq('season_id', seasonId)
    .eq('status', 'final')
    .lt('updated_at', cutoff);
  if (error) {
    console.error('live-scan: takarítás sikertelen', error.message);
    return 0;
  }
  return count ?? 0;
}
