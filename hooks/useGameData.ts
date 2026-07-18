'use client';
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getSeasonStatsTable } from '@/lib/season-tables';
import { mapSupabaseStatToPlayerStats, type SupabasePlayerStat } from '@/lib/player-stat-mapping';
import type { PlayerStats, TeamGame, GameAggregate, UpcomingFixture, GamePerformance } from '@/lib/dashboard-types';

type SupabaseGame = {
  id: string;
  date: string;
  opponent: string;
  home_away: 'home' | 'away';
  our_score: number;
  opp_score: number;
  result: 'win' | 'loss';
  kosarstat_game_id?: string | null;
  our_team_id?: string;
};

export type SupabasePlayerGameStat = {
  id: string;
  player_id: string;
  game_id: string;
  is_starter?: boolean | null;
  points: number;
  minutes: number;
  close_made: number;
  close_attempted: number;
  mid_made: number;
  mid_attempted: number;
  three_made: number;
  three_attempted: number;
  free_throw_made: number;
  free_throw_attempted: number;
  offensive_rebounds: number;
  defensive_rebounds: number;
  total_rebounds: number;
  assists: number;
  steals: number;
  turnovers: number;
  blocks: number;
  valuation: number;
  offensive_rating?: number;
  defensive_rating?: number;
  true_shooting_percentage?: number;
  effective_field_goal_percentage?: number;
  games?: {
    date: string;
    opponent: string;
  };
  players?: {
    team_id?: string | null;
    name?: string | null;
  } | null;
};

const EMPTY_GAME_STATS: GameAggregate = {
  totalGames: 0,
  avgPoints: 0,
  avgRebounds: 0,
  avgAssists: 0,
  avgSteals: 0,
  avgBlocks: 0,
  avgTurnovers: 0,
  avgValuation: 0,
};

export function useGameData(
  selectedSeasonId: string | null,
  selectedTeamId: string | null,
  allTeams: { id: string; name: string }[],
  allSeasons: { id: string; name: string }[],
) {
  const [players, setPlayers] = useState<PlayerStats[]>([]);
  const [games, setGames] = useState<TeamGame[]>([]);
  const [gameStats, setGameStats] = useState<GameAggregate>(EMPTY_GAME_STATS);
  const [playerGameStats, setPlayerGameStats] = useState<SupabasePlayerGameStat[]>([]);
  const [upcomingFixtures, setUpcomingFixtures] = useState<UpcomingFixture[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!selectedSeasonId || !selectedTeamId) return;
    if (!allSeasons.length || !allTeams.length) return;

    console.log('🔍 Loading data for season:', selectedSeasonId, 'team:', selectedTeamId);

    setLoading(true);
    setError(null);
    try {
      const { data: gamesData, error: gamesError } = await supabase
        .from('games')
        .select('*')
        .eq('season_id', selectedSeasonId)
        .eq('our_team_id', selectedTeamId)
        .order('date', { ascending: false });

      if (gamesError) throw gamesError;
      console.log('✅ Games loaded:', gamesData?.length, 'games');

      const today = new Date().toISOString().split('T')[0];
      const { data: fixturesData, error: fixturesError } = await supabase
        .from('league_fixtures')
        .select('id, game_date, round, home_team_id, away_team_id, status, home_score, away_score')
        .eq('season_id', selectedSeasonId)
        .or(`home_team_id.eq.${selectedTeamId},away_team_id.eq.${selectedTeamId}`)
        .in('status', ['scheduled', 'postponed'])
        .gte('game_date', today)
        .order('game_date', { ascending: true })
        .limit(12);

      if (fixturesError) throw fixturesError;

      const teamNameMap = new Map(allTeams.map(team => [team.id, team.name]));
      const mappedFixtures: UpcomingFixture[] = (fixturesData || []).map((fixture: {
        id: string;
        game_date: string;
        round: number | null;
        home_team_id: string;
        away_team_id: string;
        status: 'scheduled' | 'played' | 'postponed' | 'cancelled';
        home_score: number | null;
        away_score: number | null;
      }) => ({
        id: fixture.id,
        gameDate: fixture.game_date,
        round: fixture.round,
        homeTeamId: fixture.home_team_id,
        awayTeamId: fixture.away_team_id,
        homeTeamName: teamNameMap.get(fixture.home_team_id) || 'Ismeretlen csapat',
        awayTeamName: teamNameMap.get(fixture.away_team_id) || 'Ismeretlen csapat',
        status: fixture.status,
        homeScore: fixture.home_score,
        awayScore: fixture.away_score,
      }));

      const { data: playerStatsData, error: statsError } = await supabase
        .from('player_season_stats_by_season')
        .select('*')
        .eq('season_id', selectedSeasonId)
        .eq('team_id', selectedTeamId)
        .order('total_points', { ascending: false });

      if (statsError) throw statsError;
      console.log('✅ Player stats loaded:', playerStatsData?.length, 'players');
      console.log('📊 First player:', playerStatsData?.[0]);

      const gameIds = gamesData?.map(g => g.id) || [];
      const teamName = allTeams.find(team => team.id === selectedTeamId)?.name;
      const opponentIds = (gamesData || [])
        .map(g => allTeams.find(team => team.name === g.opponent)?.id)
        .filter((id): id is string => Boolean(id));
      const gameDates = (gamesData || []).map(g => g.date);
      let opponentGamesData: SupabaseGame[] = [];

      if (teamName && opponentIds.length > 0 && gameDates.length > 0) {
        const { data: opponentGames, error: opponentError } = await supabase
          .from('games')
          .select('id, date, opponent, our_team_id, home_away, our_score, opp_score, result')
          .eq('season_id', selectedSeasonId)
          .eq('opponent', teamName)
          .in('our_team_id', opponentIds)
          .in('date', gameDates);

        if (opponentError) {
          console.warn('⚠️ Ellenfél meccsek lekérdezési hiba:', opponentError.message);
        } else {
          opponentGamesData = opponentGames || [];
        }
      }

      const opponentGameMap = new Map<string, string>();
      if (teamName) {
        opponentGamesData.forEach(og => {
          const key = `${og.date}::${og.our_team_id}`;
          opponentGameMap.set(key, og.id);
        });
      }

      const opponentGameIds = opponentGamesData.map(g => g.id);
      const allGameIds = Array.from(new Set([...gameIds, ...opponentGameIds]));

      const selectedSeasonName = allSeasons.find(s => s.id === selectedSeasonId)?.name;
      if (!selectedSeasonName) {
        throw new Error(`Szezon nem található az allSeasons listában (id: ${selectedSeasonId})`);
      }
      const statsTable = getSeasonStatsTable(selectedSeasonName);
      if (statsTable === 'player_game_stats') {
        throw new Error(`Ismeretlen szezon: "${selectedSeasonName}" – frissítsd a lib/season-tables.ts mappinget`);
      }

      // Két külön query a PostgREST 1000-soros limit elkerüléséért:
      // ASE saját meccsek és ellenfél-perspektíva meccsek külön lekérve.
      const [ownStatsResult, opponentStatsResult] = await Promise.all([
        supabase
          .from(statsTable as never)
          .select(`*, games:game_id (date, opponent, season_id), players:player_id (team_id, name)`)
          .in('game_id', gameIds.length > 0 ? gameIds : ['00000000-0000-0000-0000-000000000000']),
        opponentGameIds.length > 0
          ? supabase
              .from(statsTable as never)
              .select(`*, games:game_id (date, opponent, season_id), players:player_id (team_id, name)`)
              .in('game_id', opponentGameIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (ownStatsResult.error) throw ownStatsResult.error;
      if (opponentStatsResult.error) throw opponentStatsResult.error;

      const playerGameStatsData = [
        ...(ownStatsResult.data || []),
        ...(opponentStatsResult.data || []),
      ];
      setPlayerGameStats((playerGameStatsData as SupabasePlayerGameStat[]) || []);

      const { data: gameAggregates, error: aggregateError } = await supabase
        .from(statsTable as never)
        .select('game_id, points, total_rebounds, assists, steals, blocks, turnovers, valuation')
        .in('game_id', gameIds.length > 0 ? gameIds : ['00000000-0000-0000-0000-000000000000']);

      if (aggregateError) throw aggregateError;

      const filteredPlayerStats = (playerStatsData || []).filter((ps: SupabasePlayerStat) => {
        return String(ps.season_id ?? '') === String(selectedSeasonId);
      });

      const playerStatusMap = new Map<string, boolean>();
      const playerIds = filteredPlayerStats.map((ps: SupabasePlayerStat) => ps.player_id);
      if (playerIds.length > 0) {
        const { data: playerStatusData, error: playerStatusError } = await supabase
          .from('players')
          .select('id, is_active')
          .in('id', playerIds);
        if (playerStatusError) {
          console.warn('⚠️ Player status lekérdezési hiba:', playerStatusError.message);
        } else {
          (playerStatusData || []).forEach(row => playerStatusMap.set(row.id, row.is_active));
        }
      }

      const playersConverted: PlayerStats[] = filteredPlayerStats
        .filter((ps: SupabasePlayerStat) => ps.games_played > 0)
        .map((ps: SupabasePlayerStat) => {
          const gameHistory: GamePerformance[] = (playerGameStatsData || [])
            .filter((gs: SupabasePlayerGameStat) => gs.player_id === ps.player_id)
            .map((gs: SupabasePlayerGameStat) => ({
              date: gs.games?.date || '',
              opponent: gs.games?.opponent || '',
              points: gs.points,
              minutes: gs.minutes,
              shooting: {
                close: { made: gs.close_made, attempted: gs.close_attempted },
                mid: { made: gs.mid_made, attempted: gs.mid_attempted },
                three: { made: gs.three_made, attempted: gs.three_attempted },
                freeThrow: { made: gs.free_throw_made, attempted: gs.free_throw_attempted },
              },
              rebounds: {
                offensive: gs.offensive_rebounds,
                defensive: gs.defensive_rebounds,
                total: gs.total_rebounds,
              },
              assists: gs.assists,
              steals: gs.steals,
              turnovers: gs.turnovers,
              blocks: gs.blocks,
              valuation: gs.valuation,
              offensiveRating: gs.offensive_rating,
              defensiveRating: gs.defensive_rating,
              trueShootingPct: gs.true_shooting_percentage,
              effectiveShootingPct: gs.effective_field_goal_percentage,
            }))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

          // Figyelem: az itteni offensiveRating/defensiveRating NEM NBA metrika,
          // hanem ponthatékonyság és védekezési index (lásd StatInfoTooltip).
          const totalFGAttempted = (ps.total_close_attempted || 0) + (ps.total_mid_attempted || 0) + (ps.total_three_attempted || 0);
          const scoringAttempts = totalFGAttempted + (0.5 * (ps.total_free_throw_attempted || 0));
          const scoringEfficiency = scoringAttempts > 0
            ? ((ps.total_points || 0) / scoringAttempts)
            : 0;

          const totalDefensiveActions = (ps.total_steals || 0) + (ps.total_blocks || 0) + (ps.total_defensive_rebounds || 0);
          const defensiveIndex = (ps.games_played || 1) > 0
            ? totalDefensiveActions / (ps.games_played || 1)
            : 0;

          return mapSupabaseStatToPlayerStats(ps, {
            isActiveOverride: playerStatusMap.get(ps.player_id),
            gameHistory,
            offensiveRating: Math.round(scoringEfficiency * 100) / 100,
            defensiveRating: Math.round(defensiveIndex * 10) / 10,
          });
        });

      const gamesConverted: TeamGame[] = (gamesData || []).map((g: SupabaseGame) => {
        const opponentTeamId = allTeams.find(team => team.name === g.opponent)?.id;
        const opponentGameId = opponentTeamId
          ? opponentGameMap.get(`${g.date}::${opponentTeamId}`)
          : undefined;
        return {
          id: g.id,
          date: g.date,
          opponent: g.opponent,
          homeAway: g.home_away,
          ourScore: g.our_score,
          oppScore: g.opp_score,
          result: g.result,
          kosarstatGameId: g.kosarstat_game_id ?? null,
          players: [],
          opponentGameId,
        };
      });

      const gameStatsMap = new Map<string, {
        points: number;
        rebounds: number;
        assists: number;
        steals: number;
        blocks: number;
        turnovers: number;
        valuation: number;
      }>();

      (gameAggregates || []).forEach((stat: {
        game_id: string;
        points: number;
        total_rebounds: number;
        assists: number;
        steals: number;
        blocks: number;
        turnovers: number;
        valuation: number;
      }) => {
        const existing = gameStatsMap.get(stat.game_id) || {
          points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0, valuation: 0,
        };
        gameStatsMap.set(stat.game_id, {
          points: existing.points + (stat.points || 0),
          rebounds: existing.rebounds + (stat.total_rebounds || 0),
          assists: existing.assists + (stat.assists || 0),
          steals: existing.steals + (stat.steals || 0),
          blocks: existing.blocks + (stat.blocks || 0),
          turnovers: existing.turnovers + (stat.turnovers || 0),
          valuation: existing.valuation + (stat.valuation || 0),
        });
      });

      const gameCount = gameStatsMap.size;
      const totals = Array.from(gameStatsMap.values()).reduce(
        (acc, game) => ({
          points: acc.points + game.points,
          rebounds: acc.rebounds + game.rebounds,
          assists: acc.assists + game.assists,
          steals: acc.steals + game.steals,
          blocks: acc.blocks + game.blocks,
          turnovers: acc.turnovers + game.turnovers,
          valuation: acc.valuation + game.valuation,
        }),
        { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0, valuation: 0 }
      );

      setGameStats({
        totalGames: gameCount,
        avgPoints: gameCount > 0 ? totals.points / gameCount : 0,
        avgRebounds: gameCount > 0 ? totals.rebounds / gameCount : 0,
        avgAssists: gameCount > 0 ? totals.assists / gameCount : 0,
        avgSteals: gameCount > 0 ? totals.steals / gameCount : 0,
        avgBlocks: gameCount > 0 ? totals.blocks / gameCount : 0,
        avgTurnovers: gameCount > 0 ? totals.turnovers / gameCount : 0,
        avgValuation: gameCount > 0 ? totals.valuation / gameCount : 0,
      });

      setPlayers(playersConverted);
      setGames(gamesConverted);
      setUpcomingFixtures(mappedFixtures);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Ismeretlen hiba';
      console.error('Hiba az adatok betöltésekor:', JSON.stringify(err), err);
      setError(`Az adatok betöltése sikertelen: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [allTeams, allSeasons, selectedSeasonId, selectedTeamId]);

  useEffect(() => {
    if (selectedSeasonId && selectedTeamId) {
      loadData();
    }
  }, [selectedSeasonId, selectedTeamId, loadData]);

  return { players, games, gameStats, playerGameStats, upcomingFixtures, loadData, loading, error };
}
