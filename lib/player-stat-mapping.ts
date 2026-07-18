// A player_season_stats_by_season view sorának közös típusa és PlayerStats
// konverziója. Korábban a useGameData és useFilterData szó szerint duplikálta
// mindkettőt – ez a modul az egyetlen példány.

import type { PlayerStats, GamePerformance } from '@/lib/dashboard-types';
import { trueShootingPct, effectiveFgPct } from '@/lib/stat-formulas';

export type SupabasePlayerStat = {
  player_id: string;
  name: string;
  number: number;
  position: string;
  season_id: string;
  season_name: string;
  is_active?: boolean;
  birth_year?: number;
  height?: number;
  weight?: number;
  team_id: string;
  team_name: string;
  team_short_name: string;
  games_played: number;
  total_points: number;
  total_minutes: number;
  total_close_made: number;
  total_close_attempted: number;
  total_mid_made: number;
  total_mid_attempted: number;
  total_three_made: number;
  total_three_attempted: number;
  total_free_throw_made: number;
  total_free_throw_attempted: number;
  total_offensive_rebounds: number;
  total_defensive_rebounds: number;
  total_rebounds: number;
  total_assists: number;
  total_steals: number;
  total_blocks: number;
  total_turnovers: number;
  total_fouls_committed: number;
  total_fouls_drawn: number;
  total_valuation: number;
  avg_valuation: number;
};

type MapOptions = {
  /** A players.is_active friss értéke (a view eshet késésbe) */
  isActiveOverride?: boolean;
  /** Meccsenkénti előzmények – ha a hívó összeállította */
  gameHistory?: GamePerformance[];
  /** Hívó-specifikus rating értékek (a két hook eltérő metrikát használ) */
  offensiveRating?: number;
  defensiveRating?: number;
};

/**
 * View sor → PlayerStats. A TS% és eFG% mindig az összegzett dobásokból
 * számolódik (helyes súlyozás) – NEM a meccsenkénti százalékok átlagából.
 */
export function mapSupabaseStatToPlayerStats(ps: SupabasePlayerStat, options: MapOptions = {}): PlayerStats {
  const totalFGMade = (ps.total_close_made || 0) + (ps.total_mid_made || 0) + (ps.total_three_made || 0);
  const totalFGAttempted =
    (ps.total_close_attempted || 0) + (ps.total_mid_attempted || 0) + (ps.total_three_attempted || 0);

  const ts = trueShootingPct(ps.total_points || 0, totalFGAttempted, ps.total_free_throw_attempted || 0);
  const efg = effectiveFgPct(totalFGMade, ps.total_three_made || 0, totalFGAttempted);

  return {
    id: ps.player_id,
    name: ps.name,
    number: ps.number,
    position: ps.position,
    isActive: options.isActiveOverride ?? ps.is_active ?? true,
    seasonId: ps.season_id,
    seasonName: ps.season_name,
    teamId: ps.team_id,
    teamName: ps.team_name,
    birthYear: ps.birth_year,
    height: ps.height,
    weight: ps.weight,
    gamesPlayed: ps.games_played || 0,
    points: ps.total_points || 0,
    minutes: ps.total_minutes || 0,
    shooting: {
      close: { made: ps.total_close_made || 0, attempted: ps.total_close_attempted || 0 },
      mid: { made: ps.total_mid_made || 0, attempted: ps.total_mid_attempted || 0 },
      three: { made: ps.total_three_made || 0, attempted: ps.total_three_attempted || 0 },
      freeThrow: { made: ps.total_free_throw_made || 0, attempted: ps.total_free_throw_attempted || 0 },
    },
    rebounds: {
      offensive: ps.total_offensive_rebounds || 0,
      defensive: ps.total_defensive_rebounds || 0,
      total: ps.total_rebounds || 0,
    },
    assists: ps.total_assists || 0,
    steals: ps.total_steals || 0,
    turnovers: ps.total_turnovers || 0,
    foulsCommitted: ps.total_fouls_committed || 0,
    foulsDrawn: ps.total_fouls_drawn ?? 0,
    blocks: ps.total_blocks || 0,
    valuation: ps.avg_valuation || 0,
    offensiveRating: options.offensiveRating ?? 0,
    defensiveRating: options.defensiveRating ?? 0,
    trueShootingPct: Math.round(ts * 10) / 10,
    effectiveShootingPct: Math.round(efg * 10) / 10,
    gameHistory: options.gameHistory ?? [],
  };
}
