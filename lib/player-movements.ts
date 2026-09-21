import type { Database } from '@/lib/supabase';

export type PlayerMovement = Database['public']['Views']['league_player_movements']['Row'];

/** A PostgREST válaszát a rendszerhatáron ellenőrizzük. */
export function parsePlayerMovement(value: unknown): PlayerMovement {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Érvénytelen játékosmozgás-adat.');
  const row = value as Record<string, unknown>;
  const required = ['id', 'kosarstat_player_id', 'team_id', 'season_id', 'season_name', 'previous_season_name', 'display_name', 'team_name', 'imported_at'];
  const strings = (value: unknown) => Array.isArray(value) && value.every(item => typeof item === 'string');
  if (required.some(key => typeof row[key] !== 'string' || !row[key]) ||
      !['arrival', 'departure'].includes(String(row.direction)) ||
      !['domestic_transfer', 'return', 'unknown'].includes(String(row.movement_type)) ||
      !strings(row.counterpart_team_ids) || !strings(row.counterpart_team_names) ||
      typeof row.gap_seasons !== 'number' || !Number.isInteger(row.gap_seasons) || row.gap_seasons < 0 ||
      (row.position !== null && typeof row.position !== 'string') ||
      (row.profile_url !== null && typeof row.profile_url !== 'string') ||
      (row.status_at_time !== null && !['hazai', 'legios', 'honositott'].includes(String(row.status_at_time)))) {
    throw new Error('Hiányos vagy érvénytelen játékosmozgás-adat érkezett.');
  }
  return row as PlayerMovement;
}

/** Csak a forrás saját, HTTPS játékosprofiljára vezetünk ki. */
export function playerProfileUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'kosarstat.hu' && url.pathname === '/players/player/' && url.searchParams.get('player')
      ? url.toString() : null;
  } catch { return null; }
}

export function movementSummary(rows: PlayerMovement[]) {
  return {
    arrivals: rows.filter(r => r.direction === 'arrival').length,
    domestic: rows.filter(r => r.direction === 'arrival' && r.movement_type === 'domestic_transfer').length,
    returns: rows.filter(r => r.direction === 'arrival' && r.movement_type === 'return').length,
    departures: rows.filter(r => r.direction === 'departure').length,
    unknownDepartures: rows.filter(r => r.direction === 'departure' && r.movement_type === 'unknown').length,
  };
}

export function groupPlayerMovements(rows: PlayerMovement[]) {
  const groups = new Map<string, { teamId: string; teamName: string; arrivals: PlayerMovement[]; departures: PlayerMovement[] }>();
  for (const row of rows) {
    let group = groups.get(row.team_id);
    if (!group) {
      group = { teamId: row.team_id, teamName: row.team_name, arrivals: [], departures: [] };
      groups.set(row.team_id, group);
    }
    (row.direction === 'arrival' ? group.arrivals : group.departures).push(row);
  }
  return [...groups.values()].sort((a, b) => a.teamName.localeCompare(b.teamName, 'hu'));
}
