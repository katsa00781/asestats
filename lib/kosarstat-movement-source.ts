// A szezonos csapatoldal rendszerhatára: nyers DOM -> típusos játékoslista.
import type { Database } from './supabase';
export type LeaguePlayerStatus = NonNullable<Database['public']['Tables']['league_players']['Row']['latest_status']>;
export interface SourceTable {
  headers: string[];
  rows: { cells: string[]; links: { text: string; url: string }[] }[];
}
export type SeasonPlayer = Pick<Database['public']['Tables']['league_players']['Row'],
  'kosarstat_player_id' | 'display_name' | 'position' | 'height_cm' | 'weight_kg' | 'latest_status' | 'profile_url'>;
export function parseSeasonPlayers(tables: SourceTable[]): SeasonPlayer[] {
  // Élő DOM-on ellenőrzött gépi fejlécek. A magyar fejléc a tbody első
  // sora; azt a profil-link hiánya alapján hagyjuk ki.
  const table = tables.find(t => ['player', 'position', 'status', 'first_game'].every(h => t.headers.includes(h)));
  if (!table) throw new Error('A szezonos játékoslista táblája nem található.');
  const byId = new Map<string, SeasonPlayer>();
  for (const row of table.rows) {
    const link = row.links.find(link => {
      const url = new URL(link.url, 'https://kosarstat.hu');
      return url.hostname === 'kosarstat.hu' && url.pathname === '/players/player/' && url.searchParams.has('player');
    });
    if (!link) continue;
    const url = new URL(link.url, 'https://kosarstat.hu');
    const id = url.searchParams.get('player');
    if (!id || !link.text.trim()) throw new Error('Hiányos játékosazonosító vagy név.');
    const cell = (name: string) => row.cells[table.headers.indexOf(name)]?.replace(/\s+/g, ' ').trim() ?? '';
    const status = cell('status').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    if (status && !['hazai', 'legios', 'honositott', 'u23'].includes(status)) throw new Error(`Ismeretlen játékosstátusz: ${cell('status')}`);
    const number = (name: string) => {
      const match = cell(name).match(/^([1-9]\d*)\s*(cm|kg)?$/);
      return match ? Number(match[1]) : null;
    };
    byId.set(id, {
      kosarstat_player_id: id, display_name: link.text.trim(), position: cell('position') || null,
      height_cm: number('height'), weight_kg: number('weight'),
      // Az U23 korosztályból nem következtetünk állampolgárságra.
      latest_status: status && status !== 'u23' ? status as LeaguePlayerStatus : null, profile_url: url.toString(),
    });
  }
  return [...byId.values()];
}
export function seasonCode(name: string): string {
  const match = name.match(/^(20\d{2})[/-](20\d{2})$/);
  if (!match || Number(match[2]) !== Number(match[1]) + 1) throw new Error(`Érvénytelen szezon: ${name}`);
  return match[1].slice(-2) + match[2].slice(-2);
}
