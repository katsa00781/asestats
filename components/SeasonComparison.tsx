import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { PlayerStats, TeamGame } from '@/app/page';
import {
  analyzePlayerSeason,
  buildLeagueBenchmarks,
  computeSimilarity,
  isEligibleSample,
  normalizePlayerStats,
  type LeagueBenchmarks,
  type PlayerAnalysis,
  type Position,
  type RawPlayerSeasonStat,
} from '@/lib/player-analysis';
import {
  analyzeTeamSeason,
  buildTeamBenchmarks,
  type TeamAnalysis,
  type TeamSeasonStat,
} from '@/lib/team-analysis';
import {
  analyzePreGameScouting,
  buildTeamBenchmarks as buildPregameBenchmarks,
  type PlayerSeasonStat,
  type TeamSeasonStat as PregameTeamSeasonStat,
} from '@/lib/pregame-scouting';
import {
  analyzePostGameReport,
  buildTeamBenchmarks as buildPostgameBenchmarks,
  type PlayerGameStat,
  type TeamGameStat,
  type TeamSeasonStat as PostgameTeamSeasonStat,
  type PostGameReport,
} from '@/lib/postgame-report';

type SeasonComparisonProps = {
  allPlayers: PlayerStats[];
  allSeasons: { id: string; name: string }[];
  allTeams: { id: string; name: string }[];
  currentSeasonId?: string | null;
  currentTeamId?: string | null;
  currentTeamPlayers: PlayerStats[];
  games: TeamGame[];
  playerGameStats: GamePlayerStatRow[];
};

type GamePlayerStatRow = {
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
  games?: { date?: string; opponent?: string; season_id?: string | null } | null;
  players?: { team_id?: string | null } | null;
};

const mapPosition = (pos: string): Position => {
  const normalized = pos?.toUpperCase?.() || '';

  const digits = normalized.match(/[1-5]/g) || [];
  if (digits.length > 0) {
    const primary = digits.sort()[0];
    if (primary === '1') return 'PG';
    if (primary === '2') return 'SG';
    if (primary === '3') return 'SF';
    if (primary === '4') return 'PF';
    if (primary === '5') return 'C';
  }

  if (normalized.includes('PG')) return 'PG';
  if (normalized.includes('SG')) return 'SG';
  if (normalized.includes('SF')) return 'SF';
  if (normalized.includes('PF')) return 'PF';
  if (normalized.includes('G')) return 'SG';
  if (normalized.includes('F')) return 'SF';
  if (normalized.includes('C')) return 'C';
  return 'C';
};

const toRawStat = (player: PlayerStats, league: string, season: string): RawPlayerSeasonStat => {
  const totalValuation = player.valuation * (player.gamesPlayed || 0);
  return {
    playerId: player.id,
    name: player.name,
    league,
    season,
    position: mapPosition(player.position),
    games: player.gamesPlayed,
    minutes: player.minutes,
    points: player.points,
    close: {
      made: player.shooting?.close?.made || 0,
      attempted: player.shooting?.close?.attempted || 0,
    },
    mid: {
      made: player.shooting?.mid?.made || 0,
      attempted: player.shooting?.mid?.attempted || 0,
    },
    three: {
      made: player.shooting?.three?.made || 0,
      attempted: player.shooting?.three?.attempted || 0,
    },
    ft: {
      made: player.shooting?.freeThrow?.made || 0,
      attempted: player.shooting?.freeThrow?.attempted || 0,
    },
    rebounds: {
      offensive: player.rebounds?.offensive || 0,
      defensive: player.rebounds?.defensive || 0,
      total: player.rebounds?.total || 0,
    },
    assists: player.assists || 0,
    steals: player.steals || 0,
    blocks: player.blocks || 0,
    turnovers: player.turnovers || 0,
    fouls: {
      committed: player.foulsCommitted || 0,
      received: player.foulsDrawn || 0,
    },
    valuation: totalValuation,
  };
};

const getPositionLabel = (pos: Position) => {
  switch (pos) {
    case 'PG':
      return 'PG (Irányító)';
    case 'SG':
      return 'SG (Dobóhátvéd)';
    case 'SF':
      return 'SF (Bedobó)';
    case 'PF':
      return 'PF (Erőcsatár)';
    default:
      return 'C (Center)';
  }
};

const getConfidenceTone = (value: PlayerAnalysis['confidence']) => {
  if (value === 'High') return 'text-emerald-400';
  if (value === 'Medium') return 'text-amber-400';
  return 'text-slate-400';
};

const formatPostgameValue = (value: number, unit: 'pct' | 'count') => {
  if (!Number.isFinite(value)) return '-';
  if (unit === 'pct') return `${value.toFixed(1)}%`;
  return value.toFixed(1);
};

const formatPostgameDelta = (value: number, unit: 'pct' | 'count') => {
  if (!Number.isFinite(value)) return '-';
  const sign = value > 0 ? '+' : '';
  if (unit === 'pct') return `${sign}${value.toFixed(1)} pp`;
  return `${sign}${value.toFixed(1)}`;
};

const SKILL_LABELS_HU: Record<string, string> = {
  scoring: 'Pontszerzés',
  shooting: 'Dobás',
  playmaking: 'Játéképítés',
  rebounding: 'Lepattanózás',
  defense: 'Védekezés',
  efficiency: 'Hatékonyság',
};

const buildTeamSeasonStats = (
  seasonPlayers: PlayerStats[],
  league: string,
  seasonId: string,
  allTeams: { id: string; name: string }[],
  rolesByPlayerId: Map<string, string[]>
) => {
  const teamMap = new Map<string, TeamSeasonStat>();

  const getTeamName = (teamId?: string) => {
    if (!teamId) return 'Ismeretlen csapat';
    return allTeams.find(team => team.id === teamId)?.name ?? 'Ismeretlen csapat';
  };

  seasonPlayers.forEach(player => {
    if (!player.teamId) return;
    const teamId = player.teamId;
    if (!teamMap.has(teamId)) {
      teamMap.set(teamId, {
        teamId,
        teamName: player.teamName || getTeamName(teamId),
        league,
        season: seasonId,
        games: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        fga2: 0,
        fgm2: 0,
        fga3: 0,
        fgm3: 0,
        fta: 0,
        ftm: 0,
        oreb: 0,
        dreb: 0,
        ast: 0,
        tov: 0,
        stl: 0,
        blk: 0,
        fouls: 0,
        val: 0,
        opponent: {
          fga2: 0,
          fgm2: 0,
          fga3: 0,
          fgm3: 0,
          fta: 0,
          ftm: 0,
          oreb: 0,
          dreb: 0,
          tov: 0,
        },
        roster: [],
      });
    }

    const team = teamMap.get(teamId);
    if (!team) return;

    const closeAttempts = player.shooting?.close?.attempted || 0;
    const closeMade = player.shooting?.close?.made || 0;
    const midAttempts = player.shooting?.mid?.attempted || 0;
    const midMade = player.shooting?.mid?.made || 0;
    const threeAttempts = player.shooting?.three?.attempted || 0;
    const threeMade = player.shooting?.three?.made || 0;
    const ftAttempts = player.shooting?.freeThrow?.attempted || 0;
    const ftMade = player.shooting?.freeThrow?.made || 0;

    const playerGames = player.gamesPlayed || 0;

    team.games = Math.max(team.games, playerGames);
    team.pointsFor += player.points || 0;
    team.fga2 += closeAttempts + midAttempts;
    team.fgm2 += closeMade + midMade;
    team.fga3 += threeAttempts;
    team.fgm3 += threeMade;
    team.fta += ftAttempts;
    team.ftm += ftMade;
    team.oreb += player.rebounds?.offensive || 0;
    team.dreb += player.rebounds?.defensive || 0;
    team.ast += player.assists || 0;
    team.tov += player.turnovers || 0;
    team.stl += player.steals || 0;
    team.blk += player.blocks || 0;
    team.fouls += player.foulsCommitted || 0;
    team.val += (player.valuation || 0) * playerGames;

    const usageProxy = (closeAttempts + midAttempts + threeAttempts) + 0.44 * ftAttempts + (player.turnovers || 0);
    team.roster.push({
      playerId: player.id,
      name: player.name,
      position: mapPosition(player.position),
      minutes: player.minutes || 0,
      usageProxy,
      heightCm: player.height || undefined,
      roles: rolesByPlayerId.get(player.id) ?? [],
    });
  });

  return Array.from(teamMap.values());
};

const matchesSeason = (
  player: PlayerStats,
  selectedSeasonId: string | null,
  allSeasons: { id: string; name: string }[]
) => {
  if (!selectedSeasonId) return false;
  const seasonKey = String(selectedSeasonId);
  const seasonName =
    allSeasons.find(season => String(season.id) === seasonKey || season.name === seasonKey)?.name ?? '';
  const playerSeasonId = String(player.seasonId ?? '');
  const playerSeasonName = player.seasonName ?? '';
  const candidates = [playerSeasonId, playerSeasonName];
  return candidates.some(
    value => value && (value === seasonKey || (seasonName && value === seasonName))
  );
};

export function SeasonComparison({
  allPlayers,
  allSeasons,
  allTeams,
  currentSeasonId,
  currentTeamId,
  currentTeamPlayers,
  games,
  playerGameStats,
}: SeasonComparisonProps) {
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const [selectedOpponentTeamId, setSelectedOpponentTeamId] = useState<string>('');
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const league = 'HUNBASKET';

  const resolvedSeasonId = selectedSeasonId ?? currentSeasonId ?? null;
  const resolvedTeamId = selectedTeamId || currentTeamId || 'all';

  const seasonPlayers = useMemo(() => {
    if (!resolvedSeasonId) return [];
    return allPlayers.filter(player => matchesSeason(player, resolvedSeasonId, allSeasons));
  }, [allPlayers, allSeasons, resolvedSeasonId]);

  const filteredPlayers = useMemo(() => {
    if (!resolvedSeasonId) return [];
    return allPlayers.filter(player => {
      if (!matchesSeason(player, resolvedSeasonId, allSeasons)) return false;
      if (resolvedTeamId !== 'all' && player.teamId !== resolvedTeamId) return false;
      return true;
    });
  }, [allPlayers, allSeasons, resolvedSeasonId, resolvedTeamId]);

  const benchmarks = useMemo<LeagueBenchmarks | null>(() => {
    if (!resolvedSeasonId) return null;
    const rawSeason = seasonPlayers.map(player => toRawStat(player, league, resolvedSeasonId));
    if (rawSeason.length === 0) return null;
    return buildLeagueBenchmarks(rawSeason);
  }, [seasonPlayers, resolvedSeasonId]);

  const selectedPlayer = useMemo(() => {
    return filteredPlayers.find(player => player.id === selectedPlayerId) || null;
  }, [filteredPlayers, selectedPlayerId]);

  const analysis = useMemo<PlayerAnalysis | null>(() => {
    if (!selectedPlayer || !resolvedSeasonId || !benchmarks) return null;
    const raw = toRawStat(selectedPlayer, league, resolvedSeasonId);
    const normalized = normalizePlayerStats(raw);
    if (!isEligibleSample(normalized)) return null;
    return analyzePlayerSeason(raw, benchmarks);
  }, [selectedPlayer, resolvedSeasonId, benchmarks]);

  const rolesByPlayerId = useMemo(() => {
    const rolesMap = new Map<string, string[]>();
    if (!benchmarks || !resolvedSeasonId) return rolesMap;
    seasonPlayers.forEach(player => {
      const raw = toRawStat(player, league, resolvedSeasonId);
      const normalized = normalizePlayerStats(raw);
      if (!isEligibleSample(normalized)) {
        rolesMap.set(player.id, []);
        return;
      }
      const playerAnalysis = analyzePlayerSeason(raw, benchmarks);
      rolesMap.set(player.id, playerAnalysis.roles);
    });
    return rolesMap;
  }, [benchmarks, league, seasonPlayers, resolvedSeasonId]);

  const teamSeasonStats = useMemo(() => {
    if (!resolvedSeasonId) return [];
    return buildTeamSeasonStats(seasonPlayers, league, resolvedSeasonId, allTeams, rolesByPlayerId);
  }, [allTeams, league, rolesByPlayerId, seasonPlayers, resolvedSeasonId]);

  const teamBenchmarks = useMemo(() => {
    if (teamSeasonStats.length === 0) return null;
    return buildTeamBenchmarks(teamSeasonStats);
  }, [teamSeasonStats]);

  const selectedTeamStats = useMemo(() => {
    if (!resolvedTeamId || resolvedTeamId === 'all') return null;
    return teamSeasonStats.find(team => team.teamId === resolvedTeamId) || null;
  }, [resolvedTeamId, teamSeasonStats]);

  const teamAnalysis = useMemo<TeamAnalysis | null>(() => {
    if (!selectedTeamStats || !teamBenchmarks) return null;
    return analyzeTeamSeason(selectedTeamStats, teamBenchmarks);
  }, [selectedTeamStats, teamBenchmarks]);

  const playerTeamMap = useMemo(() => {
    const map = new Map<string, string>();
    seasonPlayers.forEach(player => {
      if (player.teamId) map.set(player.id, player.teamId);
    });
    return map;
  }, [seasonPlayers]);

  const currentTeamPlayerIds = useMemo(() => {
    const set = new Set<string>();
    currentTeamPlayers.forEach(player => set.add(player.id));
    return set;
  }, [currentTeamPlayers]);

  const pregameBenchmarks = useMemo(() => {
    if (teamSeasonStats.length === 0) return null;
    const pregameTeams: PregameTeamSeasonStat[] = teamSeasonStats.map(team => ({
      teamId: team.teamId,
      teamName: team.teamName,
      league: team.league,
      season: team.season,
      games: team.games,
      pointsFor: team.pointsFor,
      pointsAgainst: team.pointsAgainst,
      fga2: team.fga2,
      fgm2: team.fgm2,
      fga3: team.fga3,
      fgm3: team.fgm3,
      fta: team.fta,
      ftm: team.ftm,
      oreb: team.oreb,
      dreb: team.dreb,
      ast: team.ast,
      tov: team.tov,
      stl: team.stl,
      blk: team.blk,
      fouls: team.fouls,
      val: team.val,
    }));
    return buildPregameBenchmarks(pregameTeams);
  }, [teamSeasonStats]);

  const pregameOwnTeam = useMemo<PregameTeamSeasonStat | null>(() => {
    if (!selectedTeamStats) return null;
    return {
      teamId: selectedTeamStats.teamId,
      teamName: selectedTeamStats.teamName,
      league: selectedTeamStats.league,
      season: selectedTeamStats.season,
      games: selectedTeamStats.games,
      pointsFor: selectedTeamStats.pointsFor,
      pointsAgainst: selectedTeamStats.pointsAgainst,
      fga2: selectedTeamStats.fga2,
      fgm2: selectedTeamStats.fgm2,
      fga3: selectedTeamStats.fga3,
      fgm3: selectedTeamStats.fgm3,
      fta: selectedTeamStats.fta,
      ftm: selectedTeamStats.ftm,
      oreb: selectedTeamStats.oreb,
      dreb: selectedTeamStats.dreb,
      ast: selectedTeamStats.ast,
      tov: selectedTeamStats.tov,
      stl: selectedTeamStats.stl,
      blk: selectedTeamStats.blk,
      fouls: selectedTeamStats.fouls,
      val: selectedTeamStats.val,
    };
  }, [selectedTeamStats]);

  const pregameOpponentTeam = useMemo<PregameTeamSeasonStat | null>(() => {
    if (!selectedOpponentTeamId || selectedOpponentTeamId === resolvedTeamId) return null;
    const opponent = teamSeasonStats.find(team => team.teamId === selectedOpponentTeamId);
    if (!opponent) return null;
    return {
      teamId: opponent.teamId,
      teamName: opponent.teamName,
      league: opponent.league,
      season: opponent.season,
      games: opponent.games,
      pointsFor: opponent.pointsFor,
      pointsAgainst: opponent.pointsAgainst,
      fga2: opponent.fga2,
      fgm2: opponent.fgm2,
      fga3: opponent.fga3,
      fgm3: opponent.fgm3,
      fta: opponent.fta,
      ftm: opponent.ftm,
      oreb: opponent.oreb,
      dreb: opponent.dreb,
      ast: opponent.ast,
      tov: opponent.tov,
      stl: opponent.stl,
      blk: opponent.blk,
      fouls: opponent.fouls,
      val: opponent.val,
    };
  }, [resolvedTeamId, selectedOpponentTeamId, teamSeasonStats]);

  const pregameOpponentPlayers = useMemo<PlayerSeasonStat[]>(() => {
    if (!selectedOpponentTeamId) return [];
    return seasonPlayers
      .filter(player => player.teamId === selectedOpponentTeamId)
      .map(player => ({
        playerId: player.id,
        name: player.name,
        position: mapPosition(player.position),
        heightCm: player.height || undefined,
        minutes: player.minutes || 0,
        points: player.points || 0,
        fga2: (player.shooting?.close?.attempted || 0) + (player.shooting?.mid?.attempted || 0),
        fgm2: (player.shooting?.close?.made || 0) + (player.shooting?.mid?.made || 0),
        fga3: player.shooting?.three?.attempted || 0,
        fgm3: player.shooting?.three?.made || 0,
        fta: player.shooting?.freeThrow?.attempted || 0,
        ftm: player.shooting?.freeThrow?.made || 0,
        oreb: player.rebounds?.offensive || 0,
        dreb: player.rebounds?.defensive || 0,
        ast: player.assists || 0,
        tov: player.turnovers || 0,
        stl: player.steals || 0,
        blk: player.blocks || 0,
        val: (player.valuation || 0) * (player.gamesPlayed || 0),
        roles: rolesByPlayerId.get(player.id) ?? [],
      }));
  }, [rolesByPlayerId, seasonPlayers, selectedOpponentTeamId]);

  const pregameOwnPlayers = useMemo<PlayerSeasonStat[]>(() => {
    if (!resolvedTeamId || resolvedTeamId === 'all') return [];
    return seasonPlayers
      .filter(player => player.teamId === resolvedTeamId)
      .map(player => ({
        playerId: player.id,
        name: player.name,
        position: mapPosition(player.position),
        heightCm: player.height || undefined,
        minutes: player.minutes || 0,
        points: player.points || 0,
        fga2: (player.shooting?.close?.attempted || 0) + (player.shooting?.mid?.attempted || 0),
        fgm2: (player.shooting?.close?.made || 0) + (player.shooting?.mid?.made || 0),
        fga3: player.shooting?.three?.attempted || 0,
        fgm3: player.shooting?.three?.made || 0,
        fta: player.shooting?.freeThrow?.attempted || 0,
        ftm: player.shooting?.freeThrow?.made || 0,
        oreb: player.rebounds?.offensive || 0,
        dreb: player.rebounds?.defensive || 0,
        ast: player.assists || 0,
        tov: player.turnovers || 0,
        stl: player.steals || 0,
        blk: player.blocks || 0,
        val: (player.valuation || 0) * (player.gamesPlayed || 0),
        roles: rolesByPlayerId.get(player.id) ?? [],
      }));
  }, [resolvedTeamId, rolesByPlayerId, seasonPlayers]);

  const pregameReport = useMemo(() => {
    if (!pregameBenchmarks || !pregameOwnTeam || !pregameOpponentTeam) return null;
    if (pregameOpponentPlayers.length === 0) return null;
    return analyzePreGameScouting(
      pregameOpponentTeam,
      pregameOpponentPlayers,
      pregameOwnTeam,
      pregameBenchmarks,
      pregameOwnPlayers
    );
  }, [pregameBenchmarks, pregameOpponentPlayers, pregameOpponentTeam, pregameOwnPlayers, pregameOwnTeam]);

  const postgameBenchmarks = useMemo(() => {
    if (teamSeasonStats.length === 0) return null;
    const postTeams: PostgameTeamSeasonStat[] = teamSeasonStats.map(team => ({
      teamId: team.teamId,
      teamName: team.teamName,
      league: team.league,
      season: team.season,
      games: team.games,
      pointsFor: team.pointsFor,
      pointsAgainst: team.pointsAgainst,
      fga2: team.fga2,
      fgm2: team.fgm2,
      fga3: team.fga3,
      fgm3: team.fgm3,
      fta: team.fta,
      ftm: team.ftm,
      oreb: team.oreb,
      dreb: team.dreb,
      ast: team.ast,
      tov: team.tov,
      stl: team.stl,
      blk: team.blk,
      fouls: team.fouls,
      val: team.val,
    }));
    return buildPostgameBenchmarks(postTeams);
  }, [teamSeasonStats]);

  const selectedGame = useMemo(() => {
    if (!selectedGameId) return null;
    return games.find(game => game.id === selectedGameId) || null;
  }, [games, selectedGameId]);

  const postgameReport = useMemo<PostGameReport | null>(() => {
    if (!selectedGame || !selectedTeamStats || !postgameBenchmarks || !resolvedTeamId || resolvedTeamId === 'all') return null;

    const teamPlayers = playerGameStats.filter(row => {
      if (row.game_id !== selectedGame.id) return false;
      if (currentTeamPlayerIds.size > 0) {
        return currentTeamPlayerIds.has(row.player_id);
      }
      const teamId = row.players?.team_id ?? playerTeamMap.get(row.player_id);
      return teamId === resolvedTeamId;
    });

    const opponentPlayers = selectedGame.opponentGameId
      ? playerGameStats.filter(row => row.game_id === selectedGame.opponentGameId)
      : playerGameStats.filter(row => {
          if (row.game_id !== selectedGame.id) return false;
          if (currentTeamPlayerIds.size > 0) {
            return !currentTeamPlayerIds.has(row.player_id);
          }
          const teamId = row.players?.team_id ?? playerTeamMap.get(row.player_id);
          return teamId ? teamId !== resolvedTeamId : false;
        });

    if (teamPlayers.length === 0) return null;

    const buildTeamGame = (rows: GamePlayerStatRow[], teamId: string, teamName: string): TeamGameStat => {
      return rows.reduce<TeamGameStat>(
        (acc, row) => {
          acc.pointsFor += row.points || 0;
          acc.fga2 += (row.close_attempted || 0) + (row.mid_attempted || 0);
          acc.fgm2 += (row.close_made || 0) + (row.mid_made || 0);
          acc.fga3 += row.three_attempted || 0;
          acc.fgm3 += row.three_made || 0;
          acc.fta += row.free_throw_attempted || 0;
          acc.ftm += row.free_throw_made || 0;
          acc.oreb += row.offensive_rebounds || 0;
          acc.dreb += row.defensive_rebounds || 0;
          acc.ast += row.assists || 0;
          acc.tov += row.turnovers || 0;
          acc.stl += row.steals || 0;
          acc.blk += row.blocks || 0;
          acc.fouls += 0;
          acc.val += row.valuation || 0;
          return acc;
        },
        {
          teamId,
          teamName,
          league,
          season: selectedTeamStats.season,
          pointsFor: 0,
          pointsAgainst: 0,
          fga2: 0,
          fgm2: 0,
          fga3: 0,
          fgm3: 0,
          fta: 0,
          ftm: 0,
          oreb: 0,
          dreb: 0,
          ast: 0,
          tov: 0,
          stl: 0,
          blk: 0,
          fouls: 0,
          val: 0,
        }
      );
    };

    const teamGame = buildTeamGame(teamPlayers, selectedTeamStats.teamId, selectedTeamStats.teamName);
    const opponentGame = opponentPlayers.length > 0
      ? buildTeamGame(opponentPlayers, 'opponent', selectedGame.opponent)
      : null;
    if (opponentGame) {
      teamGame.pointsAgainst = opponentGame.pointsFor;
      opponentGame.pointsAgainst = teamGame.pointsFor;
    } else {
      teamGame.pointsAgainst = selectedGame.oppScore;
    }

    const players: PlayerGameStat[] = teamPlayers.map(row => ({
      playerId: row.player_id,
      name: seasonPlayers.find(player => player.id === row.player_id)?.name || row.player_id,
      position: mapPosition(seasonPlayers.find(player => player.id === row.player_id)?.position || 'PG'),
      minutes: row.minutes || 0,
      points: row.points || 0,
      fga2: (row.close_attempted || 0) + (row.mid_attempted || 0),
      fgm2: (row.close_made || 0) + (row.mid_made || 0),
      fga3: row.three_attempted || 0,
      fgm3: row.three_made || 0,
      fta: row.free_throw_attempted || 0,
      ftm: row.free_throw_made || 0,
      oreb: row.offensive_rebounds || 0,
      dreb: row.defensive_rebounds || 0,
      ast: row.assists || 0,
      tov: row.turnovers || 0,
      stl: row.steals || 0,
      blk: row.blocks || 0,
      val: row.valuation || 0,
      roles: rolesByPlayerId.get(row.player_id) ?? [],
    }));

    const seasonStats: PostgameTeamSeasonStat = {
      teamId: selectedTeamStats.teamId,
      teamName: selectedTeamStats.teamName,
      league: selectedTeamStats.league,
      season: selectedTeamStats.season,
      games: selectedTeamStats.games,
      pointsFor: selectedTeamStats.pointsFor,
      pointsAgainst: selectedTeamStats.pointsAgainst,
      fga2: selectedTeamStats.fga2,
      fgm2: selectedTeamStats.fgm2,
      fga3: selectedTeamStats.fga3,
      fgm3: selectedTeamStats.fgm3,
      fta: selectedTeamStats.fta,
      ftm: selectedTeamStats.ftm,
      oreb: selectedTeamStats.oreb,
      dreb: selectedTeamStats.dreb,
      ast: selectedTeamStats.ast,
      tov: selectedTeamStats.tov,
      stl: selectedTeamStats.stl,
      blk: selectedTeamStats.blk,
      fouls: selectedTeamStats.fouls,
      val: selectedTeamStats.val,
    };

    return analyzePostGameReport(teamGame, opponentGame, seasonStats, postgameBenchmarks, players);
  }, [currentTeamPlayerIds, league, playerGameStats, playerTeamMap, postgameBenchmarks, rolesByPlayerId, seasonPlayers, selectedGame, resolvedTeamId, selectedTeamStats]);

  const similarityList = useMemo(() => {
    if (!analysis || !benchmarks || !resolvedSeasonId || !selectedPlayer) return [];

    const poolRaw = seasonPlayers
      .map(player => toRawStat(player, league, resolvedSeasonId))
      .map(raw => ({ raw, normalized: normalizePlayerStats(raw) }))
      .filter(item => isEligibleSample(item.normalized))
      .filter(item => item.raw.playerId !== selectedPlayer.id)
      .filter(item => item.raw.position === analysis.position);

    const poolAnalyses = poolRaw.map(item => ({
      raw: item.raw,
      analysis: analyzePlayerSeason(item.raw, benchmarks),
    }));

    return poolAnalyses
      .map(item => ({
        playerId: item.raw.playerId,
        name: item.raw.name,
        season: item.raw.season,
        similarity: computeSimilarity(analysis, item.analysis),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3);
  }, [analysis, benchmarks, seasonPlayers, selectedPlayer, resolvedSeasonId]);

  const eligibleCount = useMemo(() => {
    if (!resolvedSeasonId) return 0;
    return seasonPlayers
      .map(player => normalizePlayerStats(toRawStat(player, league, resolvedSeasonId)))
      .filter(isEligibleSample).length;
  }, [seasonPlayers, resolvedSeasonId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-slate-50">Elemzés</h1>
        <Badge variant="secondary" className="bg-slate-800 text-slate-200">
          {league}
        </Badge>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-slate-50">Játékos kiválasztása</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Szezon</label>
              <Select
                value={resolvedSeasonId || ''}
                onValueChange={(value) => {
                  setSelectedSeasonId(value);
                  setSelectedPlayerId('');
                  setSelectedGameId('');
                  setSelectedOpponentTeamId('');
                }}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue placeholder="Válassz szezont..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {allSeasons.map(season => (
                    <SelectItem key={season.id} value={String(season.id)}>
                      {season.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-slate-400 mb-2 block">Csapat</label>
              <Select
                value={resolvedTeamId}
                onValueChange={(value) => {
                  setSelectedTeamId(value);
                  setSelectedPlayerId('');
                  setSelectedGameId('');
                  if (value === 'all') {
                    setSelectedOpponentTeamId('');
                  } else if (selectedOpponentTeamId === value) {
                    setSelectedOpponentTeamId('');
                  }
                }}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue placeholder="Válassz csapatot..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="all">Összes csapat</SelectItem>
                  {allTeams.map(team => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-slate-400 mb-2 block">Játékos</label>
              <Select
                key={`${resolvedSeasonId ?? 'none'}-${resolvedTeamId}`}
                value={selectedPlayerId}
                onValueChange={setSelectedPlayerId}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue placeholder="Válassz játékost..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {filteredPlayers.map(player => (
                    <SelectItem key={`${player.id}-${player.seasonId}`} value={player.id}>
                      #{player.number} {player.name} ({player.teamName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span>Mintaszűrés: meccs ≥ 10, perc/meccs ≥ 15</span>
            <span>Aktív minták: {eligibleCount}</span>
          </div>
        </CardContent>
      </Card>

      {selectedPlayer && !analysis && (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6 text-sm text-slate-300">
            A kiválasztott játékos nem felel meg a minimum mintaszűrésnek.
          </CardContent>
        </Card>
      )}

      {analysis && selectedPlayer && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-50">
                  {selectedPlayer.name} • {getPositionLabel(analysis.position)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  {analysis.roles.map(role => (
                    <Badge key={role} className="bg-orange-600/20 text-orange-300 border border-orange-600/40">
                      {role}
                    </Badge>
                  ))}
                  {analysis.roles.length === 0 && (
                    <Badge variant="secondary" className="bg-slate-800 text-slate-200">
                      Nincs egyértelmű szerepkör
                    </Badge>
                  )}
                </div>

                <div className="text-sm text-slate-200 leading-relaxed">{analysis.summary}</div>

                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className={`font-semibold ${getConfidenceTone(analysis.confidence)}`}>
                    Bizonyosság: {analysis.confidence}
                  </span>
                  <span className="text-slate-400">Role confidence: {(analysis.roleConfidence * 100).toFixed(0)}%</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-50">Skill score-ok</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(analysis.skillScores).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">{SKILL_LABELS_HU[key] ?? key}</span>
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-32 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500/80"
                          style={{ width: `${value}%` }}
                        />
                      </div>
                      <span className="text-slate-200 font-semibold w-10 text-right">{value}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-50">Erősségek</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-200">
                {analysis.strengths.length > 0 ? (
                  analysis.strengths.map(item => <div key={item}>• {item}</div>)
                ) : (
                  <div className="text-slate-400">Nincs kiemelt erősség.</div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-50">Limitációk</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-200">
                {analysis.limitations.length > 0 ? (
                  analysis.limitations.map(item => <div key={item}>• {item}</div>)
                ) : (
                  <div className="text-slate-400">Nincs kiemelt limitáció.</div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-50">Javítandó pontok</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-200">
                {analysis.improvements.length > 0 ? (
                  analysis.improvements.map(item => <div key={item}>• {item}</div>)
                ) : (
                  <div className="text-slate-400">Nincs kiemelt javítandó pont.</div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-50">Hasonló profilok</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {similarityList.length > 0 ? (
                  similarityList.map(item => (
                    <div key={item.playerId} className="flex items-center justify-between text-slate-200">
                      <span>{item.name}</span>
                      <span className="text-slate-400">{(item.similarity * 100).toFixed(0)}%</span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-400">Nincs elég összehasonlítható minta.</div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-slate-50">Csapat elemzés</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {resolvedTeamId === 'all' && (
            <div className="text-sm text-slate-300">
              Válassz csapatot a csapat elemzéshez.
            </div>
          )}

          {resolvedTeamId !== 'all' && !teamAnalysis && (
            <div className="text-sm text-slate-300">
              Nincs elég adat a csapat elemzéséhez.
            </div>
          )}

          {resolvedTeamId !== 'all' && teamAnalysis && (
            <div className="space-y-4">
              <div className="text-sm text-slate-200 leading-relaxed">{teamAnalysis.summary}</div>

              <div className="flex flex-wrap gap-2">
                {teamAnalysis.style.offense.map(style => (
                  <Badge key={style} className="bg-cyan-600/20 text-cyan-200 border border-cyan-600/40">
                    {style}
                  </Badge>
                ))}
                {teamAnalysis.style.defense.map(style => (
                  <Badge key={style} className="bg-emerald-600/20 text-emerald-200 border border-emerald-600/40">
                    {style}
                  </Badge>
                ))}
                {teamAnalysis.style.offense.length === 0 && teamAnalysis.style.defense.length === 0 && (
                  <Badge variant="secondary" className="bg-slate-800 text-slate-200">
                    Nincs egyértelmű stílusprofil
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-sm text-slate-300 font-medium">Erősségek</div>
                  {teamAnalysis.strengths.length > 0 ? (
                    teamAnalysis.strengths.map(item => <div key={item} className="text-sm text-slate-200">• {item}</div>)
                  ) : (
                    <div className="text-sm text-slate-400">Nincs kiemelt erősség.</div>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-slate-300 font-medium">Limitációk</div>
                  {teamAnalysis.limitations.length > 0 ? (
                    teamAnalysis.limitations.map(item => <div key={item} className="text-sm text-slate-200">• {item}</div>)
                  ) : (
                    <div className="text-sm text-slate-400">Nincs kiemelt limitáció.</div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <div className="text-sm text-slate-300 font-medium">Posztmegoszlás</div>
                  {(Object.entries(teamAnalysis.rosterSummary.positionMinutesShare) as [string, number][])
                    .map(([pos, share]) => (
                      <div key={pos} className="text-sm text-slate-200">
                        {pos}: {share.toFixed(1)}%
                      </div>
                    ))}
                  {teamAnalysis.rosterSummary.avgHeightOverall && (
                    <div className="text-xs text-slate-400">
                      Átlagmagasság: {teamAnalysis.rosterSummary.avgHeightOverall.toFixed(1)} cm
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-slate-300 font-medium">Role-megoszlás</div>
                  {Object.keys(teamAnalysis.rosterSummary.roleCounts).length > 0 ? (
                    Object.entries(teamAnalysis.rosterSummary.roleCounts).map(([role, count]) => (
                      <div key={role} className="text-sm text-slate-200">
                        {role}: {count}
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-slate-400">Nincs szerepkör adat.</div>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-slate-300 font-medium">Usage koncentráció</div>
                  <div className="text-sm text-slate-200">
                    Top2 usage arány: {(teamAnalysis.rosterSummary.top2UsageShare * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-slate-400">
                    {teamAnalysis.rosterSummary.flags.scorerDependency && '• Túlzott scorer-függőség'}
                    {teamAnalysis.rosterSummary.flags.lowPlaymakingDepth && ' • Alacsony playmaking depth'}
                    {teamAnalysis.rosterSummary.flags.weakReboundingPresence && ' • Lepattanó hiány posztonként'}
                  </div>
                </div>
              </div>

              {teamAnalysis.rosterInsights.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm text-slate-300 font-medium">Roster értelmezés</div>
                  {teamAnalysis.rosterInsights.map(item => (
                    <div key={item} className="text-sm text-slate-200">• {item}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-slate-50">Pre-game elemzés</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Ellenfél</label>
              <Select value={selectedOpponentTeamId} onValueChange={setSelectedOpponentTeamId}>
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue placeholder="Válassz ellenfelet..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {allTeams
                    .filter(team => team.id !== resolvedTeamId)
                    .map(team => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!selectedOpponentTeamId && (
            <div className="text-sm text-slate-300">Válassz ellenfelet a pre-game jelentéshez.</div>
          )}

          {selectedOpponentTeamId && !pregameReport && (
            <div className="text-sm text-slate-300">Nincs elég adat a pre-game scoutinghoz.</div>
          )}

          {pregameReport && (
            <div className="space-y-4">
              <div className="text-sm text-slate-200 leading-relaxed">{pregameReport.summary}</div>

              <div className="flex flex-wrap gap-2">
                {pregameReport.profile.offense.map(item => (
                  <Badge key={item} className="bg-orange-600/20 text-orange-200 border border-orange-600/40">
                    {item}
                  </Badge>
                ))}
                {pregameReport.profile.defense.map(item => (
                  <Badge key={item} className="bg-emerald-600/20 text-emerald-200 border border-emerald-600/40">
                    {item}
                  </Badge>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-slate-300 font-medium mb-2">Fő veszélyek</div>
                  {pregameReport.threats.length > 0 ? (
                    pregameReport.threats.map(item => <div key={item} className="text-sm text-slate-200">• {item}</div>)
                  ) : (
                    <div className="text-sm text-slate-400">Nincs kiemelt veszély.</div>
                  )}
                </div>
                <div>
                  <div className="text-sm text-slate-300 font-medium mb-2">Sebezhetőségek</div>
                  {pregameReport.vulnerabilities.length > 0 ? (
                    pregameReport.vulnerabilities.map(item => <div key={item} className="text-sm text-slate-200">• {item}</div>)
                  ) : (
                    <div className="text-sm text-slate-400">Nincs kiemelt sebezhetőség.</div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-slate-300 font-medium mb-2">Kulcsjátékosok</div>
                  <div className="text-sm text-slate-200">Scorer: {pregameReport.keyPlayers.primaryScorers.join(', ') || '-'}</div>
                  <div className="text-sm text-slate-200">Playmaker: {pregameReport.keyPlayers.primaryPlaymakers.join(', ') || '-'}</div>
                  <div className="text-sm text-slate-200">Stretch: {pregameReport.keyPlayers.stretchThreats.join(', ') || '-'}</div>
                  <div className="text-sm text-slate-200">Mismatch: {pregameReport.keyPlayers.mismatchCandidates.join(', ') || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-300 font-medium mb-2">Fókuszpontok</div>
                  {pregameReport.focusPoints.length > 0 ? (
                    pregameReport.focusPoints.map(item => <div key={item} className="text-sm text-slate-200">• {item}</div>)
                  ) : (
                    <div className="text-sm text-slate-400">Nincs kiemelt fókuszpont.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-slate-50">Post-game jelentés</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Mérkőzés</label>
              <Select value={selectedGameId} onValueChange={setSelectedGameId}>
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue placeholder="Válassz meccset..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {games.map(game => (
                    <SelectItem key={game.id} value={game.id}>
                      {game.date} • {game.opponent}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!selectedGameId && (
            <div className="text-sm text-slate-300">Válassz meccset a post-game jelentéshez.</div>
          )}

          {selectedGameId && !postgameReport && (
            <div className="text-sm text-slate-300">
              Nincs elég adat a post-game jelentéshez.
            </div>
          )}

          {postgameReport && (
            <div className="space-y-4">
              <div className="text-sm text-slate-200 leading-relaxed">{postgameReport.summary}</div>

              {postgameReport.dataNotes.length > 0 && (
                <div className="text-xs text-slate-400">
                  {postgameReport.dataNotes.join(' ')}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-800/50 rounded-lg">
                  <div className="text-xs text-slate-400">Pontok</div>
                  <div className="text-slate-50 text-lg font-medium">
                    {postgameReport.metrics.pointsFor} - {postgameReport.metrics.pointsAgainst}
                  </div>
                  <div className={`text-xs ${postgameReport.metrics.margin >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    Margin: {postgameReport.metrics.margin > 0 ? '+' : ''}{postgameReport.metrics.margin.toFixed(1)}
                  </div>
                </div>
                <div className="p-3 bg-slate-800/50 rounded-lg">
                  <div className="text-xs text-slate-400">Tempó (pace)</div>
                  <div className="text-slate-50 text-lg font-medium">{postgameReport.metrics.pace.toFixed(1)}</div>
                  <div className="text-xs text-slate-500">Meccs-possessions becslés</div>
                </div>
                <div className="p-3 bg-slate-800/50 rounded-lg">
                  <div className="text-xs text-slate-400">eFG%</div>
                  <div className="text-slate-50 text-lg font-medium">{postgameReport.metrics.efg.toFixed(1)}%</div>
                  <div className="text-xs text-slate-500">Hatékonyság</div>
                </div>
              </div>

              <div>
                <div className="text-sm text-slate-300 font-medium mb-2">Kulcs mutatók (meccs vs. szezon)</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {postgameReport.metrics.keyStats.map(item => (
                    <div key={item.key} className="p-3 bg-slate-800/50 rounded-lg flex items-center justify-between">
                      <div>
                        <div className="text-xs text-slate-400">{item.label}</div>
                        <div className="text-slate-50 text-lg font-medium">
                          {formatPostgameValue(item.game, item.unit)}
                        </div>
                        <div className="text-xs text-slate-500">
                          Szezon: {formatPostgameValue(item.season, item.unit)}
                          {Number.isFinite(item.leagueMedian) ? ` • Liga medián: ${formatPostgameValue(item.leagueMedian ?? 0, item.unit)}` : ''}
                        </div>
                      </div>
                      <div className={`text-sm font-medium ${item.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {formatPostgameDelta(item.delta, item.unit)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-3 bg-slate-800/50 rounded-lg">
                  <div className="text-sm text-slate-300 font-medium mb-2">Hatékonyság összevetés</div>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={postgameReport.charts.efficiency} margin={{ left: 8, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          border: '1px solid #475569',
                          borderRadius: '8px',
                          color: '#f1f5f9',
                        }}
                        labelStyle={{ color: '#f1f5f9', fontWeight: 'bold' }}
                        itemStyle={{ color: '#e2e8f0' }}
                      />
                      <Legend wrapperStyle={{ color: '#94a3b8' }} />
                      <Bar dataKey="game" name="Meccs" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="season" name="Szezon" fill="#10b981" radius={[6, 6, 0, 0]} />
                      {postgameReport.charts.efficiency.some(item => Number.isFinite(item.league)) && (
                        <Bar dataKey="league" name="Liga medián" fill="#a855f7" radius={[6, 6, 0, 0]} />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="p-3 bg-slate-800/50 rounded-lg">
                  <div className="text-sm text-slate-300 font-medium mb-2">Dobásprofil</div>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={postgameReport.charts.shotProfile} margin={{ left: 8, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          border: '1px solid #475569',
                          borderRadius: '8px',
                          color: '#f1f5f9',
                        }}
                        labelStyle={{ color: '#f1f5f9', fontWeight: 'bold' }}
                        itemStyle={{ color: '#e2e8f0' }}
                      />
                      <Legend wrapperStyle={{ color: '#94a3b8' }} />
                      <Bar dataKey="game" name="Meccs" fill="#f97316" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="season" name="Szezon" fill="#22c55e" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-slate-300 font-medium mb-2">Döntő tényezők</div>
                  {postgameReport.decisiveFactors.offense.concat(postgameReport.decisiveFactors.defense).length > 0 ? (
                    postgameReport.decisiveFactors.offense
                      .concat(postgameReport.decisiveFactors.defense)
                      .map(item => <div key={item} className="text-sm text-slate-200">• {item}</div>)
                  ) : (
                    <div className="text-sm text-slate-400">Nincs kiemelt faktor.</div>
                  )}
                </div>
                <div>
                  <div className="text-sm text-slate-300 font-medium mb-2">Játékos hatás</div>
                  <div className="text-sm text-slate-200">Pozitív: {postgameReport.playerImpact.positive.join(', ') || '-'}</div>
                  <div className="text-sm text-slate-200">Negatív: {postgameReport.playerImpact.negative.join(', ') || '-'}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-slate-300 font-medium mb-2">Erősségek</div>
                  {postgameReport.strengths.length > 0 ? (
                    postgameReport.strengths.map(item => <div key={item} className="text-sm text-slate-200">• {item}</div>)
                  ) : (
                    <div className="text-sm text-slate-400">Nincs kiemelt erősség.</div>
                  )}
                </div>
                <div>
                  <div className="text-sm text-slate-300 font-medium mb-2">Problémák</div>
                  {postgameReport.problems.length > 0 ? (
                    postgameReport.problems.map(item => <div key={item} className="text-sm text-slate-200">• {item}</div>)
                  ) : (
                    <div className="text-sm text-slate-400">Nincs kiemelt probléma.</div>
                  )}
                </div>
              </div>

              <div>
                <div className="text-sm text-slate-300 font-medium mb-2">Következő fókusz</div>
                {postgameReport.nextFocus.length > 0 ? (
                  postgameReport.nextFocus.map(item => <div key={item} className="text-sm text-slate-200">• {item}</div>)
                ) : (
                  <div className="text-sm text-slate-400">Nincs kiemelt fókuszpont.</div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {!selectedPlayer && (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6 text-sm text-slate-300">
            Válassz szezont, csapatot és játékost a scouting szintű elemzéshez.
          </CardContent>
        </Card>
      )}

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-slate-50">Fogalmak (röviden)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-300">
          <div><span className="text-slate-200 font-medium">Pace (tempó):</span> dobáskísérlet + 0.44×büntető + labdaeladás, meccsenként.</div>
          <div><span className="text-slate-200 font-medium">eFG%:</span> dobáshatékonyság, ahol a tripla 1.5-nek számít.</div>
          <div><span className="text-slate-200 font-medium">Assist rate:</span> gólpassz / dobáskísérlet arány.</div>
          <div><span className="text-slate-200 font-medium">TO rate:</span> labdaeladás arány a tempóhoz viszonyítva.</div>
          <div><span className="text-slate-200 font-medium">3P/FT rate:</span> triplák/büntetők aránya az összes dobáskísérlethez.</div>
          <div><span className="text-slate-200 font-medium">Usage proxy:</span> FGA + 0.44×FTA + TO – támadó terheltség becslése.</div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="secondary" className="bg-slate-800 text-slate-200" disabled>
          Determinisztikus értékelés · Ligafüggetlen
        </Button>
      </div>
    </div>
  );
}
