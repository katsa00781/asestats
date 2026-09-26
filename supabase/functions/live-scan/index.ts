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
//   – nincs megfelelő oszlop a játékos box score-ban, ott kimaradnak.
//
// A csapat-összesítő (`live_team_stats`) a forrás `addEvent()` + `kod2onev`
// logikáját követi: a játékos események mellé a csapatszintű „Csapat" sor
// eseményei is beszámítanak – 2002 csapat védőlepattanó, 2003 csapat
// támadólepattanó, 2004 csapat szerzett labda, 2005 csapat eladott labda,
// 2006 csapat kiharcolt fault, 2007/2020 csapat fault –, továbbá 1006
// (kiharcolt fault) és 2011 (időkérés). A kódok jelentését a `kod2onev`
// térkép adja (2006 → 'fa' kiharcolt, 2007 → 'f' elkövetett), nem a
// `filmCode2Text.hun` szöveg, ami a 2006/2007 feliratot felcserélve tartalmazza.
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
  let response: Response;
  try {
    response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  } catch (error) {
    // Hálózati hiba (nem HTTP státusz): IPv4-en újrapróbáljuk, lásd fetchTextOverIpv4.
    console.warn(`live-scan: ${url} fetch hiba, IPv4 újrapróba`, error);
    return fetchTextOverIpv4(url);
  }
  if (!response.ok) throw new Error(`${url} → HTTP ${response.status}`);
  return response.text();
}

/**
 * Egyszerű HTTPS GET kényszerített IPv4-en. A netcasting szerver (webpont.com)
 * az Edge Function IPv6 forráscíméről érkező kapcsolatot bontja ("Connection
 * reset by peer"), IPv4-ről viszont kiszolgál (2026-09-25). A `fetch` nem
 * választható IPv4-re (a `Deno.createHttpClient({ localAddress })` itt
 * hatástalan volt), ezért a TCP kapcsolat az A rekord címére nyílik, a TLS
 * pedig a valódi hostnévvel indul – a tanúsítvány-ellenőrzés így változatlan.
 * Csak a netcasting statikus válaszát kezeli: `Content-Length` vagy EOF-ig
 * olvasott törzs, chunked/tömörített válasz nélkül.
 */
async function fetchTextOverIpv4(url: string): Promise<string> {
  const { hostname, pathname, search, protocol } = new URL(url);
  if (protocol !== 'https:') throw new Error(`${url} → csak https támogatott IPv4 újrapróbánál`);

  const [address] = await Deno.resolveDns(hostname, 'A');
  if (!address) throw new Error(`${hostname} → nincs A rekord`);

  const tcp = await Deno.connect({ hostname: address, port: 443 });
  const conn = await Deno.startTls(tcp, { hostname });
  try {
    const request =
      `GET ${pathname}${search} HTTP/1.1\r\n` +
      `Host: ${hostname}\r\n` +
      `User-Agent: ${USER_AGENT}\r\n` +
      'Accept: */*\r\n' +
      'Connection: close\r\n\r\n';
    await conn.write(new TextEncoder().encode(request));
    const raw = new Uint8Array(await new Response(conn.readable).arrayBuffer());
    return parseHttpResponse(url, raw);
  } finally {
    try {
      conn.close();
    } catch {
      // A readable végigolvasása már lezárhatta – ez nem hiba.
    }
  }
}

function parseHttpResponse(url: string, raw: Uint8Array): string {
  const separator = findHeaderEnd(raw);
  if (separator < 0) throw new Error(`${url} → hiányos HTTP válasz`);

  const head = new TextDecoder().decode(raw.subarray(0, separator));
  const [statusLine, ...headerLines] = head.split('\r\n');
  const status = Number(statusLine.split(' ')[1]);
  if (status < 200 || status >= 300) throw new Error(`${url} → HTTP ${status} (IPv4)`);

  const headers = new Map(
    headerLines.map((line) => {
      const colon = line.indexOf(':');
      return [line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim()] as const;
    }),
  );
  if (headers.get('transfer-encoding')?.toLowerCase().includes('chunked')) {
    throw new Error(`${url} → chunked válasz, az IPv4 olvasó nem kezeli`);
  }

  let body = raw.subarray(separator + 4);
  const length = Number(headers.get('content-length'));
  if (Number.isFinite(length) && length >= 0) body = body.subarray(0, length);
  return new TextDecoder().decode(body);
}

/** Az első `\r\n\r\n` indexe a nyers válaszban, vagy -1. */
function findHeaderEnd(raw: Uint8Array): number {
  for (let i = 0; i + 3 < raw.length; i++) {
    if (raw[i] === 13 && raw[i + 1] === 10 && raw[i + 2] === 13 && raw[i + 3] === 10) return i;
  }
  return -1;
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
  await upsertTeamStats(supabase, liveGameId, events);

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

// --- 7. Csapatszintű meccsstatisztika ---------------------------------------

interface TeamAgg {
  points: number;
  closeMade: number;
  closeAttempted: number;
  midMade: number;
  midAttempted: number;
  threeMade: number;
  threeAttempted: number;
  ftMade: number;
  ftAttempted: number;
  offensiveRebounds: number;
  defensiveRebounds: number;
  teamRebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  teamTurnovers: number;
  foulsCommitted: number;
  foulsDrawn: number;
  timeouts: number;
}

function emptyTeamAgg(): TeamAgg {
  return {
    points: 0,
    closeMade: 0,
    closeAttempted: 0,
    midMade: 0,
    midAttempted: 0,
    threeMade: 0,
    threeAttempted: 0,
    ftMade: 0,
    ftAttempted: 0,
    offensiveRebounds: 0,
    defensiveRebounds: 0,
    teamRebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    teamTurnovers: 0,
    foulsCommitted: 0,
    foulsDrawn: 0,
    timeouts: 0,
  };
}

/**
 * A két csapat teljes összesítője (játékos + csapatszintű esemény). A dobások
 * vödrei ugyanazok, mint a játékos box score-ban (`aggregateBoxScore`).
 */
function aggregateTeamStats(events: Array<Record<string, string>>): Record<TeamSide, TeamAgg> {
  const totals: Record<TeamSide, TeamAgg> = { home: emptyTeamAgg(), away: emptyTeamAgg() };

  for (const event of events) {
    const code = Number(event['2']);
    if (!Number.isFinite(code)) continue;
    const team = totals[event['1'] === '1' ? 'home' : 'away'];
    const subtype = Number(event['6']);

    switch (code) {
      case 1000: {
        team.points += SHOT_POINTS[subtype] ?? 0;
        if (subtype === 3) {
          team.threeMade++;
          team.threeAttempted++;
        } else if (subtype === 4) {
          team.ftMade++;
          team.ftAttempted++;
        } else if (subtype === 2) {
          team.midMade++;
          team.midAttempted++;
        } else {
          team.closeMade++;
          team.closeAttempted++;
        }
        break;
      }
      case 1001: {
        if (subtype === 3) team.threeAttempted++;
        else if (subtype === 4) team.ftAttempted++;
        else if (subtype === 2) team.midAttempted++;
        else team.closeAttempted++;
        break;
      }
      case 1002:
        team.defensiveRebounds++;
        break;
      case 2002:
        team.defensiveRebounds++;
        team.teamRebounds++;
        break;
      case 1003:
        team.offensiveRebounds++;
        break;
      case 2003:
        team.offensiveRebounds++;
        team.teamRebounds++;
        break;
      case 1004:
      case 2004:
        team.steals++;
        break;
      case 1005:
        team.turnovers++;
        break;
      case 2005:
        team.turnovers++;
        team.teamTurnovers++;
        break;
      case 1006:
      case 2006:
        team.foulsDrawn++;
        break;
      case 1007:
      case 1020:
      case 2007:
      case 2020:
        team.foulsCommitted++;
        break;
      case 1008:
        team.assists++;
        break;
      case 1009:
        team.blocks++;
        break;
      case 2011:
        team.timeouts++;
        break;
      default:
        break;
    }
  }

  return totals;
}

async function upsertTeamStats(
  supabase: SupabaseClient,
  liveGameId: string,
  events: Array<Record<string, string>>,
): Promise<void> {
  const totals = aggregateTeamStats(events);
  const updatedAt = new Date().toISOString();

  const rows = (['home', 'away'] as const).map((side) => {
    const team = totals[side];
    const totalRebounds = team.offensiveRebounds + team.defensiveRebounds;
    return {
      live_game_id: liveGameId,
      team_side: side,
      points: team.points,
      close_made: team.closeMade,
      close_attempted: team.closeAttempted,
      mid_made: team.midMade,
      mid_attempted: team.midAttempted,
      three_made: team.threeMade,
      three_attempted: team.threeAttempted,
      free_throw_made: team.ftMade,
      free_throw_attempted: team.ftAttempted,
      offensive_rebounds: team.offensiveRebounds,
      defensive_rebounds: team.defensiveRebounds,
      total_rebounds: totalRebounds,
      team_rebounds: team.teamRebounds,
      assists: team.assists,
      steals: team.steals,
      blocks: team.blocks,
      turnovers: team.turnovers,
      team_turnovers: team.teamTurnovers,
      fouls_committed: team.foulsCommitted,
      fouls_drawn: team.foulsDrawn,
      timeouts: team.timeouts,
      // Ugyanaz a kanonikus képlet, mint a játékos soroknál – a csapatszintű
      // lepattanó és labdaeladás is beszámít, ahogy a forrás VAL-jában.
      valuation: simpleValuation({
        points: team.points,
        rebounds: totalRebounds,
        assists: team.assists,
        steals: team.steals,
        blocks: team.blocks,
        fgMade: team.closeMade + team.midMade + team.threeMade,
        fgAttempted: team.closeAttempted + team.midAttempted + team.threeAttempted,
        ftMade: team.ftMade,
        ftAttempted: team.ftAttempted,
        turnovers: team.turnovers,
      }),
      updated_at: updatedAt,
    };
  });

  const { error } = await supabase
    .from('live_team_stats')
    .upsert(rows, { onConflict: 'live_game_id,team_side' });
  if (error) throw new Error(`live_team_stats upsert sikertelen: ${error.message}`);
}

// --- 8. Lezárás és takarítás -------------------------------------------------

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
