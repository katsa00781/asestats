'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, LogOut } from 'lucide-react';
import PlayerDetails from '@/components/PlayerDetails';
import { PlayersList } from '@/components/PlayersList';
import { TeamStatistics } from '@/components/TeamStatistics';
import { JsonImport } from '@/components/JsonImport';
import { GamesList } from '@/components/GamesList';
import { PlayersManagement } from '@/components/PlayersManagement';
import { StandingsImport } from '@/components/StandingsImport';
import { StandingsView } from '@/components/StandingsView';
import { PlayerComparison } from '@/components/PlayerComparison';
import { TeamComparison } from '@/components/TeamComparison';
import { GameLog } from '@/components/GameLog';
import { GameManagement } from '@/components/GameManagement';
import { LoginForm } from '@/components/LoginForm';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useMemo } from 'react';
import { SeasonSelector } from '@/components/SeasonSelector';
import { SeasonComparison } from '@/components/SeasonComparison';
import { TeamSelector } from '@/components/TeamSelector';
import { Updates } from '@/components/Updates';
import { GameQuickImport } from '@/components/GameQuickImport';
import { PlayersImport } from '@/components/PlayersImport';
import { RoundImport } from '@/components/RoundImport';
import type { PlayerTrend } from '@/lib/player-analysis';

export type ShootingStats = {
  close: { made: number; attempted: number };
  mid: { made: number; attempted: number };
  three: { made: number; attempted: number };
  freeThrow: { made: number; attempted: number };
};

export type PlayerStats = {
  id: string;
  name: string;
  number: number;
  position: string;
  seasonId?: string;
  seasonName?: string;
  teamId?: string;
  teamName?: string;
  birthYear?: number;
  height?: number;
  weight?: number;
  gamesPlayed: number;
  points: number;
  minutes: number;
  shooting: ShootingStats;
  rebounds: { offensive: number; defensive: number; total: number };
  assists: number;
  steals: number;
  turnovers: number;
  foulsCommitted: number;
  foulsDrawn: number;
  blocks: number;
  valuation: number;
  // Fejlett statisztikák
  offensiveRating: number;
  defensiveRating: number;
  trueShootingPct: number;
  effectiveShootingPct: number;
  gameHistory: GamePerformance[];
  trend?: PlayerTrend;
};

export type GamePerformance = {
  date: string;
  opponent: string;
  points: number;
  minutes: number;
  shooting: ShootingStats;
  rebounds: { offensive: number; defensive: number; total: number };
  assists: number;
  steals: number;
  turnovers: number;
  blocks: number;
  valuation: number;
  offensiveRating?: number;
  defensiveRating?: number;
  trueShootingPct?: number;
  effectiveShootingPct?: number;
};

export type GamePlayer = {
  number: number;
  name: string;
  position: string;
  minutes: number;
  points: number;
  shooting: ShootingStats;
  rebounds: {
    defensive: number;
    offensive: number;
    total: number;
  };
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  plusMinus: number;
  valuation: number;
  advanced: {
    offensiveRating: number;
    defensiveRating: number;
    trueShootingPercentage: number;
    effectiveFieldGoalPercentage: number;
  };
};

export type TeamGame = {
  id: string;
  date: string;
  opponent: string;
  homeAway: 'home' | 'away';
  ourScore: number;
  oppScore: number;
  result: 'win' | 'loss';
  players: GamePlayer[];
  opponentGameId?: string;
};

export type GameAggregate = {
  totalGames: number;
  avgPoints: number;
  avgRebounds: number;
  avgAssists: number;
  avgSteals: number;
  avgBlocks: number;
  avgTurnovers: number;
  avgValuation: number;
};

// Supabase típusok
type SupabasePlayerStat = {
  player_id: string;
  name: string;
  number: number;
  position: string;
  season_id: string;
  season_name: string;
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
  total_valuation: number;
  avg_valuation: number;
};

type SupabaseGame = {
  id: string;
  date: string;
  opponent: string;
  home_away: 'home' | 'away';
  our_score: number;
  opp_score: number;
  result: 'win' | 'loss';
  our_team_id?: string;
};

type SupabasePlayerGameStat = {
  id: string;
  player_id: string;
  game_id: string;
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
};

type SupabasePlayerSeasonGameStat = {
  player_id: string;
  offensive_rating: number | null;
  defensive_rating: number | null;
  true_shooting_percentage: number | null;
  effective_field_goal_percentage: number | null;
  games?: { season_id: string | null } | { season_id: string | null }[] | null;
};

const TAB_TRIGGER_CLASS = 'text-xs sm:text-sm flex-shrink-0 md:flex-1 min-w-[7rem] px-3 py-2 whitespace-nowrap';

export default function Home() {
  const [players, setPlayers] = useState<PlayerStats[]>([]);
  const [allPlayersForComparison, setAllPlayersForComparison] = useState<PlayerStats[]>([]);
  const [games, setGames] = useState<TeamGame[]>([]);
  const [gameStats, setGameStats] = useState<GameAggregate>({
    totalGames: 0,
    avgPoints: 0,
    avgRebounds: 0,
    avgAssists: 0,
    avgSteals: 0,
    avgBlocks: 0,
    avgTurnovers: 0,
    avgValuation: 0,
  });
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [showTeamComparison, setShowTeamComparison] = useState(false);
  const [standingsRefresh, setStandingsRefresh] = useState(0);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [allSeasons, setAllSeasons] = useState<{id: string; name: string}[]>([]);
  const [allTeams, setAllTeams] = useState<{id: string; name: string}[]>([]);
    const [playerGameStats, setPlayerGameStats] = useState<SupabasePlayerGameStat[]>([]);
  const [lastImportedGame, setLastImportedGame] = useState<{
    date: string;
    homeTeamName: string;
    awayTeamName: string;
    homeScore: number;
    awayScore: number;
    round: number | null;
  } | null>(null);

  const playersBySeason = useMemo(() => {
    if (!selectedSeasonId) return players;
    return players.filter(player => String(player.seasonId ?? '') === String(selectedSeasonId));
  }, [players, selectedSeasonId]);

  const selectedPlayer = selectedPlayerId 
    ? playersBySeason.find((player: PlayerStats) => player.id === selectedPlayerId) || null 
    : null;

  const handleGameImport = (gameData?: {
    date: string;
    homeTeamName: string;
    awayTeamName: string;
    homeScore: number;
    awayScore: number;
    round: number | null;
  }) => {
    if (gameData) {
      setLastImportedGame(gameData);
    }
    loadData();
  };

  // Betöltjük az összes szezont és csapatot (összehasonlításhoz)
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [seasonsResult, teamsResult, allPlayersResult, allGameStatsResult] = await Promise.all([
          supabase.from('seasons').select('id, name').order('start_date', { ascending: false }),
          supabase.from('teams').select('id, name').order('is_primary', { ascending: false }).order('name'),
          supabase.from('player_season_stats_by_season').select('*'),
          supabase.from('player_game_stats').select('player_id, offensive_rating, defensive_rating, true_shooting_percentage, effective_field_goal_percentage, games!inner(season_id)')
        ]);

        if (seasonsResult.data) setAllSeasons(seasonsResult.data);
        if (teamsResult.data) setAllTeams(teamsResult.data);
        
        // Minden játékos minden szezonból és csapatból
        if (allPlayersResult.data && allGameStatsResult.data) {
          const playerGameStats = allGameStatsResult.data as SupabasePlayerSeasonGameStat[];

          const allPlayersConverted: PlayerStats[] = allPlayersResult.data.map((ps: SupabasePlayerStat) => {
            // Szűrjük le a játékos meccseit ebben a szezonban
            const playerSeasonGames = playerGameStats.filter((gs) => {
              if (gs.player_id !== ps.player_id || !gs.games) {
                return false;
              }

              const linkedGames = Array.isArray(gs.games)
                ? gs.games
                : gs.games
                  ? [gs.games]
                  : [];

              return linkedGames.some((game) => game?.season_id === ps.season_id);
            });

            // Számítsuk ki az átlagokat a meccsenkénti értékekből
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
              foulsDrawn: 0,
              blocks: ps.total_blocks || 0,
              valuation: ps.avg_valuation || 0,
              offensiveRating: Math.round(avgOffRtg * 10) / 10,
              defensiveRating: Math.round(avgDefRtg * 10) / 10,
              trueShootingPct: Math.round(avgTS * 10) / 10,
              effectiveShootingPct: Math.round(avgEFG * 10) / 10,
              gameHistory: []
            };
          });
          setAllPlayersForComparison(allPlayersConverted);
        }
      } catch (error) {
        console.error('Hiba a szűrők betöltésekor:', error);
      }
    };
    loadFilters();
  }, []);

  // Betöltjük az adatokat Supabase-ből
  const loadData = useCallback(async () => {
      if (!selectedSeasonId || !selectedTeamId) return;
      
      console.log('🔍 Loading data for season:', selectedSeasonId, 'team:', selectedTeamId);
      
      try {
        // 1. Meccsek betöltése - szűrés szezon és csapat szerint
        const { data: gamesData, error: gamesError } = await supabase
          .from('games')
          .select('*')
          .eq('season_id', selectedSeasonId)
          .eq('our_team_id', selectedTeamId)
          .order('date', { ascending: false });

        if (gamesError) throw gamesError;
        console.log('✅ Games loaded:', gamesData?.length, 'games');

        // 2. Játékosok aggregált statisztikáinak betöltése a view-ból - szűrés szezon és csapat szerint
        const { data: playerStatsData, error: statsError } = await supabase
          .from('player_season_stats_by_season')
          .select('*')
          .eq('season_id', selectedSeasonId)
          .eq('team_id', selectedTeamId)
          .order('total_points', { ascending: false });

        if (statsError) throw statsError;
        console.log('✅ Player stats loaded:', playerStatsData?.length, 'players');
        console.log('📊 First player:', playerStatsData?.[0]);

        // 3. Játékos teljesítmények betöltése (gameHistory-hoz) - csak a kiválasztott szezon játékaiból
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

        const { data: playerGameStatsData, error: gameStatsError } = await supabase
          .from('player_game_stats')
          .select(`
            *,
            games:game_id (date, opponent, season_id),
            players:player_id (team_id)
          `)
          .in('game_id', allGameIds.length > 0 ? allGameIds : ['00000000-0000-0000-0000-000000000000']); // Ha nincs meccs, üres eredmény

        if (gameStatsError) throw gameStatsError;
        setPlayerGameStats((playerGameStatsData as SupabasePlayerGameStat[]) || []);

        // 3b. Meccsenkénti csapat összesítés (TeamStatistics-hoz) - csak a kiválasztott szezon meccseiből
        const { data: gameAggregates, error: aggregateError } = await supabase
          .from('player_game_stats')
          .select('game_id, points, total_rebounds, assists, steals, blocks, turnovers, valuation')
          .in('game_id', gameIds.length > 0 ? gameIds : ['00000000-0000-0000-0000-000000000000']);

        if (aggregateError) throw aggregateError;

        const filteredPlayerStats = (playerStatsData || []).filter((ps: SupabasePlayerStat) => {
          return String(ps.season_id ?? '') === String(selectedSeasonId);
        });

        // 4. Konvertáljuk a PlayerStats formátumra - CSAK azokat akiknek van meccsük
        const playersConverted: PlayerStats[] = filteredPlayerStats
          .filter((ps: SupabasePlayerStat) => ps.games_played > 0) // Csak akiknek van meccsük
          .map((ps: SupabasePlayerStat) => {
          // Gyűjtsük össze a játékos meccs teljesítményeit
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
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Rendezés DÁTUM szerint, csökkenő

                    // Számítsuk ki a fejlett statisztikákat a season összesítésből
          const totalFGMade = (ps.total_close_made || 0) + (ps.total_mid_made || 0) + (ps.total_three_made || 0);
          const totalFGAttempted = (ps.total_close_attempted || 0) + (ps.total_mid_attempted || 0) + (ps.total_three_attempted || 0);
          
          // True Shooting % = Points / (2 * (FGA + 0.44 * FTA))
          const tsAttempts = totalFGAttempted + (0.44 * (ps.total_free_throw_attempted || 0));
          const trueShootingPct = tsAttempts > 0 ? ((ps.total_points || 0) / (2 * tsAttempts)) * 100 : 0;

          // Effective FG% = (FGM + 0.5 * 3PM) / FGA
          const effectiveShootingPct = totalFGAttempted > 0 
            ? ((totalFGMade + (0.5 * (ps.total_three_made || 0))) / totalFGAttempted) * 100 
            : 0;

          // Ponthatékonyság (csak valós adatok, nincs becsült birtoklás)
          // Megmutatja, hogy mennyi pontot termel a játékos dobási kísérleteire
          const scoringAttempts = totalFGAttempted + (0.5 * (ps.total_free_throw_attempted || 0));
          const scoringEfficiency = scoringAttempts > 0 
            ? ((ps.total_points || 0) / scoringAttempts) 
            : 0;

          // Védekezési Index (csak valós adatok)
          // Az összes védekezési statisztika átlaga meccsenként
          const totalDefensiveActions = (ps.total_steals || 0) + (ps.total_blocks || 0) + (ps.total_defensive_rebounds || 0);
          const defensiveIndex = (ps.games_played || 1) > 0 
            ? totalDefensiveActions / (ps.games_played || 1)
            : 0;


          return {
            id: ps.player_id,
            name: ps.name,
            number: ps.number,
            position: ps.position,
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
            foulsDrawn: 0, // Nincs a view-ban
            blocks: ps.total_blocks || 0,
            valuation: ps.avg_valuation || 0, // VAL egy mutató, átlagot használunk
            offensiveRating: Math.round(scoringEfficiency * 100) / 100,
            defensiveRating: Math.round(defensiveIndex * 10) / 10,
            trueShootingPct: Math.round(trueShootingPct * 10) / 10,
            effectiveShootingPct: Math.round(effectiveShootingPct * 10) / 10,
            gameHistory,
          };
        });

        // 5. Konvertáljuk a TeamGame formátumra
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
          players: [], // Ezt nem használjuk a TeamStatistics-ban
          opponentGameId,
          };
        });

        // 6. Számítsuk ki a meccsenkénti átlagokat
        // Csoportosítjuk game_id szerint
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
            points: 0,
            rebounds: 0,
            assists: 0,
            steals: 0,
            blocks: 0,
            turnovers: 0,
            valuation: 0,
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

        // Átlagoljuk
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
      } catch (error) {
        console.error('Hiba az adatok betöltésekor:', error);
      }
    }, [allTeams, selectedSeasonId, selectedTeamId]);

  useEffect(() => {
    if (selectedSeasonId && selectedTeamId) {
      loadData();
    }
  }, [selectedSeasonId, selectedTeamId, loadData]);

  const { user, loading, signOut } = useAuth();

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 dark flex items-center justify-center">
        <div className="text-white text-xl">Betöltés...</div>
      </div>
    );
  }

  // Show login form if not authenticated
  if (!user) {
    return <LoginForm />;
  }

  return (
    <div className="min-h-screen bg-slate-950 dark">
      <header className="bg-slate-900 text-white py-4 sm:py-6 shadow-lg">
        <div className="container mx-auto px-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h1 className="text-center md:text-left text-2xl sm:text-3xl md:text-4xl font-bold flex items-center gap-2 sm:gap-3">
              <Trophy className="h-6 w-6 sm:h-8 sm:w-8 md:h-10 md:w-10" />
              ASE Statisztika Kezelő
            </h1>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => signOut()}
              className="flex items-center justify-center gap-2 w-full md:w-auto"
            >
              <LogOut className="h-4 w-4" />
              Kijelentkezés
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
        {/* Szezon és csapat választó */}
        <div className="mb-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="w-full">
              <label className="text-sm text-slate-400 mb-2 block">Szezon</label>
              <SeasonSelector 
                selectedSeasonId={selectedSeasonId}
                onSeasonChange={setSelectedSeasonId}
              />
            </div>
            <div className="w-full">
              <label className="text-sm text-slate-400 mb-2 block">Csapat</label>
              <TeamSelector 
                selectedTeamId={selectedTeamId}
                onTeamChange={setSelectedTeamId}
              />
            </div>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-4 sm:space-y-6">
          <div className="-mx-2 sm:mx-0">
            <div className="overflow-x-auto pb-2">
              <TabsList className="min-w-max md:min-w-0 md:w-full flex-nowrap md:flex-wrap h-auto gap-2 p-1 justify-start">
                <TabsTrigger value="overview" className={TAB_TRIGGER_CLASS}>Áttekintés</TabsTrigger>
                <TabsTrigger value="players" className={TAB_TRIGGER_CLASS}>Játékosok</TabsTrigger>
                <TabsTrigger value="comparison" className={TAB_TRIGGER_CLASS}>Elemzések</TabsTrigger>
                <TabsTrigger value="standings" className={TAB_TRIGGER_CLASS}>Tabella</TabsTrigger>
                <TabsTrigger value="games" className={TAB_TRIGGER_CLASS}>Meccsek</TabsTrigger>
                <TabsTrigger value="gamelog" className={TAB_TRIGGER_CLASS}>Meccs Log</TabsTrigger>
                <TabsTrigger value="updates" className={TAB_TRIGGER_CLASS}>Frissítések</TabsTrigger>
                <TabsTrigger value="manage" className={TAB_TRIGGER_CLASS}>Kezelés</TabsTrigger>
                <TabsTrigger value="playersimport" className={TAB_TRIGGER_CLASS}>Játékos Import</TabsTrigger>
                <TabsTrigger value="delete" className={`${TAB_TRIGGER_CLASS} text-red-400`}>Törlés</TabsTrigger>
                <TabsTrigger value="import" className={TAB_TRIGGER_CLASS}>Import</TabsTrigger>
              </TabsList>
            </div>
          </div>

          <TabsContent value="overview">
            {showTeamComparison ? (
              <TeamComparison
                allSeasons={allSeasons}
                allTeams={allTeams}
                currentSeasonId={selectedSeasonId}
                currentTeamId={selectedTeamId}
                onBack={() => setShowTeamComparison(false)}
              />
            ) : (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button
                    onClick={() => setShowTeamComparison(true)}
                    size="sm"
                    className="gap-2 bg-slate-700 hover:bg-slate-600 text-slate-100 border border-slate-600"
                  >
                    Csapatok összehasonlítása
                  </Button>
                </div>
                <TeamStatistics 
                  players={playersBySeason} 
                  games={games} 
                  gameStats={gameStats} 
                  teamName={allTeams.find(t => t.id === selectedTeamId)?.name}
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="players">
            {showComparison ? (
              <PlayerComparison 
                allPlayers={allPlayersForComparison}
                allSeasons={allSeasons}
                allTeams={allTeams}
                currentSeasonId={selectedSeasonId}
                currentTeamId={selectedTeamId}
                onBack={() => setShowComparison(false)}
              />
            ) : selectedPlayer ? (
              <PlayerDetails 
                player={selectedPlayer} 
                onBack={() => setSelectedPlayerId(null)} 
              />
            ) : (
              <PlayersList 
                players={playersBySeason}
                onSelectPlayer={setSelectedPlayerId}
                onCompare={() => setShowComparison(true)}
              />
            )}
          </TabsContent>

          <TabsContent value="comparison">
            <SeasonComparison
              allPlayers={allPlayersForComparison}
              allSeasons={allSeasons}
              allTeams={allTeams}
              currentSeasonId={selectedSeasonId}
              currentTeamId={selectedTeamId}
              currentTeamPlayers={playersBySeason}
              games={games}
              playerGameStats={playerGameStats}
            />
          </TabsContent>

          <TabsContent value="standings">
            <div className="space-y-6">
              <StandingsView onRefresh={standingsRefresh} />
              <StandingsImport onImportComplete={() => setStandingsRefresh(prev => prev + 1)} />
            </div>
          </TabsContent>

          <TabsContent value="games">
            <GamesList 
              games={games} 
              onGameDeleted={loadData}
            />
          </TabsContent>

          <TabsContent value="gamelog">
            <GameLog players={playersBySeason} />
          </TabsContent>

          <TabsContent value="updates">
            <Updates />
          </TabsContent>

          <TabsContent value="manage">
            <PlayersManagement onPlayersChanged={loadData} />
          </TabsContent>

          <TabsContent value="playersimport">
            <PlayersImport
              onImportComplete={loadData}
              selectedSeasonId={selectedSeasonId}
              selectedTeamId={selectedTeamId}
              selectedSeasonName={allSeasons.find(s => s.id === selectedSeasonId)?.name}
              selectedTeamName={allTeams.find(t => t.id === selectedTeamId)?.name}
              allSeasons={allSeasons}
              allTeams={allTeams}
            />
          </TabsContent>

          <TabsContent value="delete">
            <GameManagement onDeleteComplete={loadData} />
          </TabsContent>

          <TabsContent value="import">
            <div className="space-y-6">
              <RoundImport
                onImportComplete={loadData}
                selectedSeasonId={selectedSeasonId}
                selectedSeasonName={allSeasons.find(s => s.id === selectedSeasonId)?.name}
              />
              <GameQuickImport 
                onImportComplete={handleGameImport}
                selectedSeasonId={selectedSeasonId}
              />
              <JsonImport 
                onImportComplete={loadData} 
                lastImportedGame={lastImportedGame}
                selectedSeasonId={selectedSeasonId}
              />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
