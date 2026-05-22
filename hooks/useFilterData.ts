'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ALL_SEASON_STATS_TABLES } from '@/lib/season-tables';
import type { PlayerStats } from '@/lib/dashboard-types';

type SupabasePlayerStat = {
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

type SupabasePlayerSeasonGameStat = {
  player_id: string;
  offensive_rating: number | null;
  defensive_rating: number | null;
  true_shooting_percentage: number | null;
  effective_field_goal_percentage: number | null;
  games?: { season_id: string | null } | { season_id: string | null }[] | null;
};

export function useFilterData() {
  const [allSeasons, setAllSeasons] = useState<{ id: string; name: string }[]>([]);
  const [allTeams, setAllTeams] = useState<{ id: string; name: string }[]>([]);
  const [allPlayersForComparison, setAllPlayersForComparison] = useState<PlayerStats[]>([]);
  const [filterLoading, setFilterLoading] = useState(true);
  const [filterError, setFilterError] = useState<string | null>(null);

  useEffect(() => {
    const loadFilters = async () => {
      setFilterLoading(true);
      setFilterError(null);
      try {
        const [[seasonsResult, teamsResult, allPlayersResult, playerStatusResult], allGameStatsResults] =
          await Promise.all([
            Promise.all([
              supabase.from('seasons').select('id, name').order('start_date', { ascending: false }),
              supabase.from('teams').select('id, name').order('is_primary', { ascending: false }).order('name'),
              supabase.from('player_season_stats_by_season').select('*'),
              supabase.from('players').select('id, name, number, position, season_id, team_id, is_active, birth_year, height, weight'),
            ]),
            Promise.all(
              ALL_SEASON_STATS_TABLES.map(table =>
                supabase
                  .from(table as never)
                  .select('player_id, offensive_rating, defensive_rating, true_shooting_percentage, effective_field_goal_percentage, games!inner(season_id)')
              )
            ),
          ]);

        if (seasonsResult.data) setAllSeasons(seasonsResult.data);
        if (teamsResult.data) setAllTeams(teamsResult.data);

        const allGameStatsData = (allGameStatsResults as Array<{ data: SupabasePlayerSeasonGameStat[] | null; error: unknown }>)
          .flatMap(r => r.data ?? []);

        if (allPlayersResult.data && allGameStatsData.length >= 0) {
          const playerGameStats = allGameStatsData as SupabasePlayerSeasonGameStat[];
          const playerActiveMap = new Map(
            (playerStatusResult.data ?? []).map(row => [row.id, row.is_active])
          );

          const allPlayersConverted: PlayerStats[] = allPlayersResult.data.map((ps: SupabasePlayerStat) => {
            const playerSeasonGames = playerGameStats.filter((gs) => {
              if (gs.player_id !== ps.player_id || !gs.games) return false;
              const linkedGames = Array.isArray(gs.games) ? gs.games : gs.games ? [gs.games] : [];
              return linkedGames.some((game) => game?.season_id === ps.season_id);
            });

            const gamesWithOffRtg = playerSeasonGames.filter((g) => g.offensive_rating != null);
            const avgOffRtg = gamesWithOffRtg.length > 0
              ? gamesWithOffRtg.reduce((sum, g) => sum + (g.offensive_rating ?? 0), 0) / gamesWithOffRtg.length
              : 0;

            const gamesWithDefRtg = playerSeasonGames.filter((g) => g.defensive_rating != null);
            const avgDefRtg = gamesWithDefRtg.length > 0
              ? gamesWithDefRtg.reduce((sum, g) => sum + (g.defensive_rating ?? 0), 0) / gamesWithDefRtg.length
              : 0;

            const gamesWithTS = playerSeasonGames.filter((g) => g.true_shooting_percentage != null);
            const avgTS = gamesWithTS.length > 0
              ? gamesWithTS.reduce((sum, g) => sum + (g.true_shooting_percentage ?? 0), 0) / gamesWithTS.length
              : 0;

            const gamesWithEFG = playerSeasonGames.filter((g) => g.effective_field_goal_percentage != null);
            const avgEFG = gamesWithEFG.length > 0
              ? gamesWithEFG.reduce((sum, g) => sum + (g.effective_field_goal_percentage ?? 0), 0) / gamesWithEFG.length
              : 0;

            return {
              id: ps.player_id,
              name: ps.name,
              number: ps.number,
              position: ps.position,
              isActive: playerActiveMap.get(ps.player_id) ?? ps.is_active ?? true,
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
              offensiveRating: Math.round(avgOffRtg * 10) / 10,
              defensiveRating: Math.round(avgDefRtg * 10) / 10,
              trueShootingPct: Math.round(avgTS * 10) / 10,
              effectiveShootingPct: Math.round(avgEFG * 10) / 10,
              gameHistory: [],
            };
          });

          const seasonsById = new Map((seasonsResult.data ?? []).map(season => [String(season.id), season.name]));
          const teamsById = new Map((teamsResult.data ?? []).map(team => [String(team.id), team.name]));
          const existingIds = new Set(allPlayersConverted.map(player => player.id));

          const basePlayers = (playerStatusResult.data ?? []) as Array<{
            id: string;
            name: string;
            number: number | null;
            position: string | null;
            season_id: string | null;
            team_id: string | null;
            is_active: boolean | null;
            birth_year: number | null;
            height: number | null;
            weight: number | null;
          }>;

          const playersWithoutGames: PlayerStats[] = basePlayers
            .filter(player => player.season_id && !existingIds.has(player.id))
            .map(player => ({
              id: player.id,
              name: player.name,
              number: player.number ?? 0,
              position: player.position ?? '',
              isActive: player.is_active ?? true,
              seasonId: player.season_id ?? undefined,
              seasonName: seasonsById.get(String(player.season_id)) ?? '',
              teamId: player.team_id ?? undefined,
              teamName: teamsById.get(String(player.team_id)) ?? '',
              birthYear: player.birth_year ?? undefined,
              height: player.height ?? undefined,
              weight: player.weight ?? undefined,
              gamesPlayed: 0,
              points: 0,
              minutes: 0,
              shooting: {
                close: { made: 0, attempted: 0 },
                mid: { made: 0, attempted: 0 },
                three: { made: 0, attempted: 0 },
                freeThrow: { made: 0, attempted: 0 },
              },
              rebounds: { offensive: 0, defensive: 0, total: 0 },
              assists: 0,
              steals: 0,
              turnovers: 0,
              foulsCommitted: 0,
              foulsDrawn: 0,
              blocks: 0,
              valuation: 0,
              offensiveRating: 0,
              defensiveRating: 0,
              trueShootingPct: 0,
              effectiveShootingPct: 0,
              gameHistory: [],
            }));

          setAllPlayersForComparison([...allPlayersConverted, ...playersWithoutGames]);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Ismeretlen hiba';
        console.error('Hiba a szűrők betöltésekor:', err);
        setFilterError(`A szűrők betöltése sikertelen: ${msg}`);
      } finally {
        setFilterLoading(false);
      }
    };
    loadFilters();
  }, []);

  return { allSeasons, allTeams, allPlayersForComparison, filterLoading, filterError };
}
