'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ALL_SEASON_STATS_TABLES } from '@/lib/season-tables';
import { fetchAllRows } from '@/lib/fetch-all-rows';
import { mapSupabaseStatToPlayerStats, type SupabasePlayerStat } from '@/lib/player-stat-mapping';
import type { PlayerStats } from '@/lib/dashboard-types';

type BasePlayerRow = {
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
};

type SupabasePlayerSeasonGameStat = {
  player_id: string;
  offensive_rating: number | null;
  defensive_rating: number | null;
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
        // A view, a players tábla és a szezon-táblák 1000 sor fölé nőhetnek –
        // lapozva kell lekérni, különben a PostgREST némán csonkolja a választ.
        const [[seasonsResult, teamsResult], allPlayersRows, playerStatusRows, allGameStatsPages] =
          await Promise.all([
            Promise.all([
              supabase.from('seasons').select('id, name').order('start_date', { ascending: false }),
              supabase.from('teams').select('id, name').order('is_primary', { ascending: false }).order('name'),
            ]),
            fetchAllRows<SupabasePlayerStat>((from, to) =>
              supabase
                .from('player_season_stats_by_season')
                .select('*')
                .order('player_id')
                .order('season_id')
                .range(from, to)
            ),
            fetchAllRows<BasePlayerRow>((from, to) =>
              supabase
                .from('players')
                .select('id, name, number, position, season_id, team_id, is_active, birth_year, height, weight')
                .order('id')
                .range(from, to)
            ),
            Promise.all(
              ALL_SEASON_STATS_TABLES.map(table =>
                fetchAllRows<SupabasePlayerSeasonGameStat>((from, to) =>
                  supabase
                    .from(table as never)
                    .select('player_id, offensive_rating, defensive_rating, games!inner(season_id)')
                    .order('id')
                    .range(from, to)
                )
              )
            ),
          ]);

        if (seasonsResult.data) setAllSeasons(seasonsResult.data);
        if (teamsResult.data) setAllTeams(teamsResult.data);

        const allGameStatsData = allGameStatsPages.flat();

        {
          const playerGameStats = allGameStatsData;
          const playerActiveMap = new Map(
            playerStatusRows.map(row => [row.id, row.is_active])
          );

          const allPlayersConverted: PlayerStats[] = allPlayersRows.map((ps: SupabasePlayerStat) => {
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

            // A TS%/eFG% a közös mappingben az összegzett dobásokból számolódik
            // (helyes súlyozás) – a korábbi meccsenkénti-százalék-átlag torzított.
            return mapSupabaseStatToPlayerStats(ps, {
              isActiveOverride: playerActiveMap.get(ps.player_id) ?? undefined,
              offensiveRating: Math.round(avgOffRtg * 10) / 10,
              defensiveRating: Math.round(avgDefRtg * 10) / 10,
            });
          });

          const seasonsById = new Map((seasonsResult.data ?? []).map(season => [String(season.id), season.name]));
          const teamsById = new Map((teamsResult.data ?? []).map(team => [String(team.id), team.name]));
          const existingIds = new Set(allPlayersConverted.map(player => player.id));

          const basePlayers = playerStatusRows;

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
