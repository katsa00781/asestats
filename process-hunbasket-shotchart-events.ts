import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || (!SUPABASE_ANON_KEY && !SUPABASE_SERVICE_ROLE_KEY)) {
  console.error('Missing Supabase env vars.');
  process.exit(1);
}

const SUPABASE_KEY = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const HUNBASKET_SEASON_NAME = process.env.HUNBASKET_SEASON_NAME || '2025/2026';
const HUNBASKET_SEASON_ID = process.env.HUNBASKET_SEASON_ID;
const BATCH_SIZE = parseInt(process.env.HUNBASKET_SHOT_BATCH_SIZE || '25', 10);

type RawGame = {
  id: string;
  season_id: string;
  game_code: string;
  home_team_id: string | null;
  away_team_id: string | null;
  shotchart_data: unknown;
};

type ShotEvent = {
  playercode?: string;
  playercode2?: string;
  side?: string;
  period?: string;
  event_order?: string;
  x?: number;
  y?: number;
  wbname?: string;
  firstname?: string;
  lastname?: string;
  is_successfull?: boolean;
};

type PlayerRow = {
  id: string;
  season_id: string;
  team_id: string;
  name: string;
};

type PlayerLinkRow = {
  season_id: string;
  team_id: string;
  hunbasket_player_code: string;
  player_id: string | null;
};

const normalizeName = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const getDisplayName = (event: ShotEvent) => {
  if (event.wbname && event.wbname.trim().length > 0) return event.wbname.trim();
  const name = `${event.firstname || ''} ${event.lastname || ''}`.trim();
  return name;
};

const parseNullableInt = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseInt(String(value), 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const parseNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const resolveSeasonId = async (): Promise<string> => {
  if (HUNBASKET_SEASON_ID) {
    const { data, error } = await supabase
      .from('seasons')
      .select('id')
      .eq('id', HUNBASKET_SEASON_ID)
      .single();

    if (error || !data) throw new Error(`Season not found for HUNBASKET_SEASON_ID=${HUNBASKET_SEASON_ID}`);
    return data.id;
  }

  const { data, error } = await supabase
    .from('seasons')
    .select('id')
    .eq('name', HUNBASKET_SEASON_NAME)
    .single();

  if (error || !data) throw new Error(`Season not found: ${HUNBASKET_SEASON_NAME}`);
  return data.id;
};

const loadPlayers = async (seasonId: string) => {
  const { data, error } = await supabase
    .from('players')
    .select('id, season_id, team_id, name')
    .eq('season_id', seasonId);

  if (error) throw new Error(`Failed loading players: ${error.message}`);

  const byTeam = new Map<string, Array<PlayerRow & { nameNorm: string }>>();
  for (const row of (data || []) as PlayerRow[]) {
    const list = byTeam.get(row.team_id) || [];
    list.push({ ...row, nameNorm: normalizeName(row.name) });
    byTeam.set(row.team_id, list);
  }

  return byTeam;
};

const loadPlayerLinks = async (seasonId: string) => {
  const { data, error } = await supabase
    .from('hunbasket_player_links')
    .select('season_id, team_id, hunbasket_player_code, player_id')
    .eq('season_id', seasonId);

  if (error) throw new Error(`Failed loading player links: ${error.message}`);

  const map = new Map<string, string | null>();
  for (const row of (data || []) as PlayerLinkRow[]) {
    const key = `${row.season_id}|${row.team_id}|${row.hunbasket_player_code}`;
    map.set(key, row.player_id);
  }

  return map;
};

const resolvePlayerByName = (
  teamPlayers: Array<PlayerRow & { nameNorm: string }>,
  rawName: string
): string | null => {
  if (!rawName) return null;
  const target = normalizeName(rawName);
  if (!target) return null;

  const exact = teamPlayers.filter(player => player.nameNorm === target);
  if (exact.length === 1) return exact[0].id;

  const includes = teamPlayers.filter(player => player.nameNorm.includes(target) || target.includes(player.nameNorm));
  if (includes.length === 1) return includes[0].id;

  return null;
};

const fetchRawGames = async (seasonId: string): Promise<RawGame[]> => {
  let from = 0;
  const allGames: RawGame[] = [];

  while (true) {
    const to = from + BATCH_SIZE - 1;
    const { data, error } = await supabase
      .from('hunbasket_shotchart_raw')
      .select('id, season_id, game_code, home_team_id, away_team_id, shotchart_data')
      .eq('season_id', seasonId)
      .order('game_date', { ascending: true })
      .range(from, to);

    if (error) throw new Error(`Failed loading raw games: ${error.message}`);
    const batch = (data || []) as RawGame[];
    if (batch.length === 0) break;

    allGames.push(...batch);
    from += BATCH_SIZE;
  }

  return allGames;
};

const upsertPlayerLink = async (
  seasonId: string,
  teamId: string,
  hunbasketPlayerCode: string,
  playerId: string | null,
  playerNameRaw: string
) => {
  const { error } = await supabase
    .from('hunbasket_player_links')
    .upsert(
      {
        season_id: seasonId,
        team_id: teamId,
        hunbasket_player_code: hunbasketPlayerCode,
        player_id: playerId,
        player_name_raw: playerNameRaw || null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'season_id,team_id,hunbasket_player_code' }
    );

  if (error) throw new Error(`Failed upserting player link: ${error.message}`);
};

const processRawGame = async (
  game: RawGame,
  playersByTeam: Map<string, Array<PlayerRow & { nameNorm: string }>>,
  playerLinks: Map<string, string | null>
) => {
  const rawEvents = Array.isArray(game.shotchart_data) ? (game.shotchart_data as ShotEvent[]) : [];

  const { error: deleteError } = await supabase
    .from('hunbasket_shot_events')
    .delete()
    .eq('raw_game_id', game.id);

  if (deleteError) throw new Error(`Failed deleting previous shot events: ${deleteError.message}`);

  if (rawEvents.length === 0) {
    return { inserted: 0, linkedPlayers: 0, unresolvedPlayers: 0 };
  }

  const eventRows: Array<Record<string, unknown>> = [];
  let linkedPlayers = 0;
  let unresolvedPlayers = 0;

  for (const event of rawEvents) {
    const side = event.side === '0' ? 'away' : 'home';
    const teamId = side === 'home' ? game.home_team_id : game.away_team_id;
    const playerCode = (event.playercode || event.playercode2 || '').trim();
    const playerNameRaw = getDisplayName(event);

    let playerId: string | null = null;

    if (teamId && playerCode) {
      const linkKey = `${game.season_id}|${teamId}|${playerCode}`;
      if (playerLinks.has(linkKey)) {
        playerId = playerLinks.get(linkKey) || null;
      } else {
        const candidates = playersByTeam.get(teamId) || [];
        playerId = resolvePlayerByName(candidates, playerNameRaw);
        await upsertPlayerLink(game.season_id, teamId, playerCode, playerId, playerNameRaw);
        playerLinks.set(linkKey, playerId);
      }
    } else if (teamId) {
      const candidates = playersByTeam.get(teamId) || [];
      playerId = resolvePlayerByName(candidates, playerNameRaw);
    }

    if (playerId) linkedPlayers += 1;
    else unresolvedPlayers += 1;

    eventRows.push({
      raw_game_id: game.id,
      season_id: game.season_id,
      game_code: game.game_code,
      period: parseNullableInt(event.period),
      event_order: parseNullableInt(event.event_order),
      x: parseNullableNumber(event.x),
      y: parseNullableNumber(event.y),
      is_successful: typeof event.is_successfull === 'boolean' ? event.is_successfull : null,
      shot_side: side,
      team_id: teamId,
      player_id: playerId,
      hunbasket_player_code: playerCode || null,
      player_name_raw: playerNameRaw || null,
      source_event: event,
      imported_at: new Date().toISOString(),
    });
  }

  const { error: insertError } = await supabase
    .from('hunbasket_shot_events')
    .insert(eventRows);

  if (insertError) throw new Error(`Failed inserting shot events: ${insertError.message}`);

  return {
    inserted: eventRows.length,
    linkedPlayers,
    unresolvedPlayers,
  };
};

const main = async () => {
  const seasonId = await resolveSeasonId();
  const playersByTeam = await loadPlayers(seasonId);
  const playerLinks = await loadPlayerLinks(seasonId);
  const rawGames = await fetchRawGames(seasonId);

  console.log(`Raw games to process: ${rawGames.length}`);

  let totalEvents = 0;
  let totalLinked = 0;
  let totalUnresolved = 0;
  let failed = 0;

  for (const [index, game] of rawGames.entries()) {
    console.log(`[${index + 1}/${rawGames.length}] ${game.game_code}`);
    try {
      const result = await processRawGame(game, playersByTeam, playerLinks);
      totalEvents += result.inserted;
      totalLinked += result.linkedPlayers;
      totalUnresolved += result.unresolvedPlayers;
      console.log(`  events=${result.inserted} linked=${result.linkedPlayers} unresolved=${result.unresolvedPlayers}`);
    } catch (error) {
      failed += 1;
      console.error(`  FAIL - ${(error as Error).message}`);
    }
  }

  console.log('Shot event assignment completed.');
  console.log(`Processed games: ${rawGames.length - failed}`);
  console.log(`Failed games: ${failed}`);
  console.log(`Total events: ${totalEvents}`);
  console.log(`Linked players: ${totalLinked}`);
  console.log(`Unresolved players: ${totalUnresolved}`);
};

main().catch(error => {
  console.error('Shot event assignment failed:', error);
  process.exit(1);
});
