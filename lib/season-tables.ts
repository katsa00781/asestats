// Szezonspecifikus player_game_stats táblanév mapping
// Új szezon hozzáadásakor: bővítsd ezt a mappinget ÉS a migrációs SQL-t.

export const SEASON_STATS_TABLES: Record<string, string> = {
  '2023/2024': 'player_game_stats_2023_2024',
  '2024/2025': 'player_game_stats_2024_2025',
  '2025/2026': 'player_game_stats_2025_2026',
} as const;

// Összes szezon tábla tömbje (pl. cross-season lekérdezésekhez)
export const ALL_SEASON_STATS_TABLES = Object.values(SEASON_STATS_TABLES);

/**
 * Visszaadja a megadott szezonnévhez tartozó player_game_stats táblanevet.
 * Ha ismeretlen a szezon, a UNION view-ra esik vissza (biztonságos fallback).
 */
export function getSeasonStatsTable(seasonName: string): string {
  return SEASON_STATS_TABLES[seasonName] ?? 'player_game_stats';
}
