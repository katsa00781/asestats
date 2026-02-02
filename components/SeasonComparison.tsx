'use client';

import { TerminologyGlossary } from './TerminologyGlossary';

import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { PlayerStats, TeamGame } from '@/app/page';
import {
  analyzePlayerSeason,
  buildLeagueBenchmarks,
  computeSimilarity,
  isEligibleSample,
  normalizePlayerStats,
  buildCoachSummary,
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
  fouls_committed?: number;
};

const mapPosition = (pos: string): Position => {
  const normalized = pos?.toUpperCase?.() || '';
  const normalizedAscii = normalized
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^A-Z0-9]/g, '');

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

  if (normalizedAscii.includes('IRANYITO')) return 'PG';
  if (normalizedAscii.includes('DOBOHATVED')) return 'SG';
  if (normalizedAscii.includes('HATVED')) return 'SG';
  if (normalizedAscii.includes('BEDOBO')) return 'SF';
  if (normalizedAscii.includes('EROCSATAR')) return 'PF';
  if (normalizedAscii.includes('CSATAR')) return 'PF';
  if (normalizedAscii.includes('CENTER')) return 'C';
  if (normalizedAscii.includes('CENT')) return 'C';
  return 'C';
};

const POSITION_LABELS: Record<Position, string> = {
  PG: 'Irányító',
  SG: 'Dobóhátvéd',
  SF: 'Bedobó',
  PF: 'Erőcsatár',
  C: 'Center',
};

const SKILL_LABELS_HU: Record<string, string> = {
  scoring: 'Pontszerzés',
  shooting: 'Dobás',
  playmaking: 'Játéképítés',
  rebounding: 'Lepattanózás',
  defense: 'Védekezés',
  efficiency: 'Hatékonyság',
};

const RECENT_GAMES_WINDOW = 5;

const roundValue = (value: number, digits = 1) => {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
};

const stdDev = (values: number[]) => {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
};

const buildTeamGameMetrics = (rows: GamePlayerStatRow[]) => {
  const totals = rows.reduce(
    (acc, row) => {
      acc.fga2 += (row.close_attempted || 0) + (row.mid_attempted || 0);
      acc.fgm2 += (row.close_made || 0) + (row.mid_made || 0);
      acc.fga3 += row.three_attempted || 0;
      acc.fgm3 += row.three_made || 0;
      acc.fta += row.free_throw_attempted || 0;
      acc.tov += row.turnovers || 0;
      return acc;
    },
    { fga2: 0, fgm2: 0, fga3: 0, fgm3: 0, fta: 0, tov: 0 }
  );

  const fga = totals.fga2 + totals.fga3;
  const pace = fga + 0.44 * totals.fta + totals.tov;
  const threePct = totals.fga3 > 0 ? (totals.fgm3 / totals.fga3) * 100 : 0;
  const turnoverRate = pace > 0 ? totals.tov / pace : 0;

  return {
    pace,
    threePct,
    turnoverRate,
  };
};

const getPositionLabel = (position: Position) => POSITION_LABELS[position] ?? position;

const buildSimilarityReason = (base: PlayerAnalysis, other: PlayerAnalysis) => {
  const sharedRoles = base.roles.filter(role => other.roles.includes(role)).slice(0, 1);
  const sharedSkills = (Object.keys(base.skillScores) as Array<keyof PlayerAnalysis['skillScores']>)
    .filter(key => base.skillScores[key] >= 70 && other.skillScores[key] >= 70)
    .slice(0, 2)
    .map(key => SKILL_LABELS_HU[key] ?? key);

  const parts = [...sharedRoles, ...sharedSkills].filter(Boolean);
  if (parts.length === 0) return 'profil-azonosság';
  return parts.join(', ');
};

const getConfidenceTone = (confidence: PlayerAnalysis['confidence']) => {
  switch (confidence) {
    case 'High':
      return 'text-emerald-400';
    case 'Medium':
      return 'text-amber-400';
    default:
      return 'text-rose-400';
  }
};

const round = (value: number, decimals = 1) => {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const formatPostgameValue = (value: number, unit: 'pct' | 'count') => {
  if (!Number.isFinite(value)) return '-';
  if (unit === 'pct') return `${value.toFixed(1)}%`;
  return Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(1);
};

const formatPostgameDelta = (value: number, unit: 'pct' | 'count') => {
  if (!Number.isFinite(value)) return '-';
  const sign = value > 0 ? '+' : '';
  if (unit === 'pct') return `${sign}${value.toFixed(1)}%`;
  return `${sign}${value.toFixed(1)}`;
};

const computeTotalValuation = (player: PlayerStats) => {
  const fga2 = (player.shooting?.close?.attempted || 0) + (player.shooting?.mid?.attempted || 0);
  const fgm2 = (player.shooting?.close?.made || 0) + (player.shooting?.mid?.made || 0);
  const fga3 = player.shooting?.three?.attempted || 0;
  const fgm3 = player.shooting?.three?.made || 0;
  const fta = player.shooting?.freeThrow?.attempted || 0;
  const ftm = player.shooting?.freeThrow?.made || 0;
  const missed = (fga2 - fgm2) + (fga3 - fgm3) + (fta - ftm);
  return (
    (player.points || 0) +
    (player.rebounds?.total || 0) +
    (player.assists || 0) +
    (player.steals || 0) +
    (player.blocks || 0) -
    missed -
    (player.turnovers || 0)
  );
};

const toRawStat = (player: PlayerStats, league: string, season: string): RawPlayerSeasonStat => {
  const gamesPlayed = player.gamesPlayed || 0;
  const totalValuation = (player.valuation || 0) * gamesPlayed;
  const fallbackValuation = computeTotalValuation(player);
  const valuation = totalValuation > 0 ? totalValuation : fallbackValuation;
  return {
    playerId: player.id,
    name: player.name,
    league,
    season,
    position: mapPosition(player.position),
    games: gamesPlayed,
    minutes: player.minutes || 0,
    points: player.points || 0,
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
    valuation,
  };
};

const buildTeamSeasonStats = (
  players: PlayerStats[],
  league: string,
  season: string,
  allTeams: { id: string; name: string }[],
  rolesByPlayerId: Map<string, string[]>
): TeamSeasonStat[] => {
  const teamNameMap = new Map(allTeams.map(team => [team.id, team.name]));
  const teams = new Map<string, TeamSeasonStat>();

  players.forEach(player => {
    if (!player.teamId) return;
    const teamId = player.teamId;
    const teamName = teamNameMap.get(teamId) ?? player.teamName ?? 'Ismeretlen csapat';
    const existing = teams.get(teamId);
    const team: TeamSeasonStat = existing ?? {
      teamId,
      teamName,
      league,
      season,
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
    };

    const gamesPlayed = player.gamesPlayed || 0;
    team.games = Math.max(team.games, gamesPlayed);
    team.pointsFor += player.points || 0;
    team.fga2 += (player.shooting?.close?.attempted || 0) + (player.shooting?.mid?.attempted || 0);
    team.fgm2 += (player.shooting?.close?.made || 0) + (player.shooting?.mid?.made || 0);
    team.fga3 += player.shooting?.three?.attempted || 0;
    team.fgm3 += player.shooting?.three?.made || 0;
    team.fta += player.shooting?.freeThrow?.attempted || 0;
    team.ftm += player.shooting?.freeThrow?.made || 0;
    team.oreb += player.rebounds?.offensive || 0;
    team.dreb += player.rebounds?.defensive || 0;
    team.ast += player.assists || 0;
    team.tov += player.turnovers || 0;
    team.stl += player.steals || 0;
    team.blk += player.blocks || 0;
    team.fouls += player.foulsCommitted || 0;
    team.val += (player.valuation || 0) * gamesPlayed;

    const fga =
      (player.shooting?.close?.attempted || 0) +
      (player.shooting?.mid?.attempted || 0) +
      (player.shooting?.three?.attempted || 0);
    const usageProxy = fga + 0.44 * (player.shooting?.freeThrow?.attempted || 0) + (player.turnovers || 0);

    team.roster.push({
      playerId: player.id,
      name: player.name,
      position: mapPosition(player.position),
      minutes: player.minutes || 0,
      usageProxy,
      heightCm: player.height || undefined,
      roles: rolesByPlayerId.get(player.id) ?? [],
    });

    teams.set(teamId, team);
  });

  return Array.from(teams.values());
};

type IncomingPlayerInput = {
  name: string;
  position: Position;
  games: number;
  minutesPerGame: number;
  pointsPerGame: number;
  assistsPerGame: number;
  orebPerGame: number;
  drebPerGame: number;
  valuationPerGame: number;
  twoPct: number;
  twoAttemptedPerGame: number;
  threePct: number;
  threeAttemptedPerGame: number;
  ftPct: number;
  ftAttemptedPerGame: number;
  turnoversPerGame: number;
  stealsPerGame: number;
  blocksPerGame: number;
  foulsCommittedPerGame: number;
  foulsReceivedPerGame: number;
};

type IncomingField = keyof IncomingPlayerInput | 'rebTotal';

const DEFAULT_INCOMING_PLAYER: IncomingPlayerInput = {
  name: '',
  position: 'SG',
  games: 0,
  minutesPerGame: 0,
  pointsPerGame: 0,
  assistsPerGame: 0,
  orebPerGame: 0,
  drebPerGame: 0,
  valuationPerGame: 0,
  twoPct: 0,
  twoAttemptedPerGame: 0,
  threePct: 0,
  threeAttemptedPerGame: 0,
  ftPct: 0,
  ftAttemptedPerGame: 0,
  turnoversPerGame: 0,
  stealsPerGame: 0,
  blocksPerGame: 0,
  foulsCommittedPerGame: 0,
  foulsReceivedPerGame: 0,
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
  const [selectedSeasonId, setSelectedSeasonId] = useState(currentSeasonId ?? '');
  const [selectedTeamId, setSelectedTeamId] = useState(currentTeamId ?? 'all');
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [selectedOpponentTeamId, setSelectedOpponentTeamId] = useState('');
  const [selectedGameId, setSelectedGameId] = useState('');
  const [incomingPlayer, setIncomingPlayer] = useState<IncomingPlayerInput>(DEFAULT_INCOMING_PLAYER);
  const [focusedIncomingField, setFocusedIncomingField] = useState<IncomingField | null>(null);
  const [useRecentFormPregame, setUseRecentFormPregame] = useState(false);

  const MIN_PREGAME_GAMES = 4;
  const MIN_RECENT_GAMES_TEAM = 3;

  const resolvedSeasonId = selectedSeasonId || currentSeasonId || allSeasons[0]?.id || '';
  const resolvedTeamId = selectedTeamId || currentTeamId || 'all';

  const league = useMemo(() => {
    const seasonName = allSeasons.find(season => String(season.id) === String(resolvedSeasonId))?.name;
    return seasonName ?? 'NB I/A';
  }, [allSeasons, resolvedSeasonId]);

  const seasonPlayers = useMemo(() => {
    if (!resolvedSeasonId) return [];
    return allPlayers.filter(player => {
      return String(player.seasonId ?? '') === String(resolvedSeasonId);
    });
  }, [allPlayers, resolvedSeasonId]);

  const filteredPlayers = useMemo(() => {
    const base = resolvedTeamId !== 'all'
      ? seasonPlayers.filter(player => player.teamId === resolvedTeamId)
      : seasonPlayers;
    return [...base].sort((a, b) => a.name.localeCompare(b.name, 'hu'));
  }, [resolvedTeamId, seasonPlayers]);

  const activeSeasonPlayers = useMemo(() => {
    return seasonPlayers.filter(player => player.isActive !== false);
  }, [seasonPlayers]);

  const selectedPlayer = useMemo(() => {
    if (!selectedPlayerId) return null;
    return seasonPlayers.find(player => player.id === selectedPlayerId) || null;
  }, [seasonPlayers, selectedPlayerId]);


  const lastFiveGames = useMemo(() => {
    if (!selectedPlayer) return [];
    return playerGameStats
      .filter(row => row.player_id === selectedPlayer.id)
      .filter(row => {
        if (!resolvedSeasonId) return true;
        return String(row.games?.season_id ?? '') === String(resolvedSeasonId);
      })
      .sort((a, b) => {
        const aDate = a.games?.date ? new Date(a.games.date).getTime() : 0;
        const bDate = b.games?.date ? new Date(b.games.date).getTime() : 0;
        return bDate - aDate;
      })
      .slice(0, 5);
  }, [playerGameStats, resolvedSeasonId, selectedPlayer]);

  const benchmarks = useMemo<LeagueBenchmarks | null>(() => {
    if (!resolvedSeasonId || seasonPlayers.length === 0) return null;
    const raw = seasonPlayers.map(player => toRawStat(player, league, resolvedSeasonId));
    return buildLeagueBenchmarks(raw);
  }, [league, seasonPlayers, resolvedSeasonId]);

  const analysis = useMemo<PlayerAnalysis | null>(() => {
    if (!benchmarks || !selectedPlayer || !resolvedSeasonId) return null;
    const raw = toRawStat(selectedPlayer, league, resolvedSeasonId);
    const normalized = normalizePlayerStats(raw);
    if (!isEligibleSample(normalized)) return null;
    return analyzePlayerSeason(raw, benchmarks);
  }, [benchmarks, league, resolvedSeasonId, selectedPlayer]);

  const rolesByPlayerId = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!benchmarks || !resolvedSeasonId) return map;
    seasonPlayers.forEach(player => {
      const raw = toRawStat(player, league, resolvedSeasonId);
      const normalized = normalizePlayerStats(raw);
      if (!isEligibleSample(normalized) && normalized.games < MIN_PREGAME_GAMES) {
        map.set(player.id, []);
        return;
      }
      const playerAnalysis = analyzePlayerSeason(raw, benchmarks);
      map.set(player.id, playerAnalysis.roles);
    });
    return map;
  }, [benchmarks, league, resolvedSeasonId, seasonPlayers]);

  const displayIncomingValue = (field: IncomingField, value: number) => {
    if (focusedIncomingField !== field && (!Number.isFinite(value) || value === 0)) return '';
    return Number.isFinite(value) ? value : '';
  };

  const handleIncomingNumberChange = (field: keyof IncomingPlayerInput, value: string) => {
    const numeric = Number(value);
    setIncomingPlayer(prev => ({
      ...prev,
      [field]: Number.isFinite(numeric) ? numeric : 0,
    }));
  };

  const incomingRaw = useMemo<RawPlayerSeasonStat | null>(() => {
    if (!resolvedSeasonId) return null;
    const gamesCount = incomingPlayer.games || 0;
    const twoAttempts = (incomingPlayer.twoAttemptedPerGame || 0) * gamesCount;
    const threeAttempts = (incomingPlayer.threeAttemptedPerGame || 0) * gamesCount;
    const ftAttempts = (incomingPlayer.ftAttemptedPerGame || 0) * gamesCount;
    const twoMade = twoAttempts * (incomingPlayer.twoPct || 0) / 100;
    const threeMade = threeAttempts * (incomingPlayer.threePct || 0) / 100;
    const ftMade = ftAttempts * (incomingPlayer.ftPct || 0) / 100;
    const oreb = (incomingPlayer.orebPerGame || 0) * gamesCount;
    const dreb = (incomingPlayer.drebPerGame || 0) * gamesCount;

    return {
      playerId: 'incoming',
      name: incomingPlayer.name || 'Érkező játékos',
      league,
      season: resolvedSeasonId,
      position: incomingPlayer.position,
      games: gamesCount,
      minutes: (incomingPlayer.minutesPerGame || 0) * gamesCount,
      points: (incomingPlayer.pointsPerGame || 0) * gamesCount,
      close: { made: 0, attempted: 0 },
      mid: { made: twoMade, attempted: twoAttempts },
      three: { made: threeMade, attempted: threeAttempts },
      ft: { made: ftMade, attempted: ftAttempts },
      rebounds: { offensive: oreb, defensive: dreb, total: oreb + dreb },
      assists: (incomingPlayer.assistsPerGame || 0) * gamesCount,
      steals: (incomingPlayer.stealsPerGame || 0) * gamesCount,
      blocks: (incomingPlayer.blocksPerGame || 0) * gamesCount,
      turnovers: (incomingPlayer.turnoversPerGame || 0) * gamesCount,
      fouls: {
        committed: (incomingPlayer.foulsCommittedPerGame || 0) * gamesCount,
        received: (incomingPlayer.foulsReceivedPerGame || 0) * gamesCount,
      },
      valuation: (incomingPlayer.valuationPerGame || 0) * gamesCount,
    };
  }, [incomingPlayer, league, resolvedSeasonId]);

  const incomingEligibility = useMemo(() => {
    if (!incomingRaw) return false;
    return isEligibleSample(normalizePlayerStats(incomingRaw));
  }, [incomingRaw]);

  const incomingAnalysis = useMemo<PlayerAnalysis | null>(() => {
    if (!benchmarks || !incomingRaw || !incomingEligibility) return null;
    return analyzePlayerSeason(incomingRaw, benchmarks);
  }, [benchmarks, incomingEligibility, incomingRaw]);

  const teamSeasonStats = useMemo(() => {
    if (!resolvedSeasonId) return [];
    return buildTeamSeasonStats(seasonPlayers, league, resolvedSeasonId, allTeams, rolesByPlayerId);
  }, [allTeams, league, resolvedSeasonId, rolesByPlayerId, seasonPlayers]);

  const teamBenchmarks = useMemo(() => {
    if (teamSeasonStats.length === 0) return null;
    return buildTeamBenchmarks(teamSeasonStats);
  }, [teamSeasonStats]);

  const selectedTeamStats = useMemo(() => {
    if (!resolvedTeamId || resolvedTeamId === 'all') return null;
    const byId = teamSeasonStats.find(team => team.teamId === resolvedTeamId) || null;
    const isEmpty = (team: TeamSeasonStat | null) => {
      if (!team) return true;
      return (team.fga2 + team.fga3 + team.fta + team.tov) === 0;
    };
    if (byId && !isEmpty(byId)) return byId;
    const selectedTeamName = allTeams.find(team => team.id === resolvedTeamId)?.name;
    if (!selectedTeamName) return byId;
    const byName = teamSeasonStats.find(team => team.teamName === selectedTeamName) || null;
    return byName ?? byId;
  }, [allTeams, resolvedTeamId, teamSeasonStats]);

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

  const seasonPlayerMap = useMemo(() => {
    const map = new Map<string, PlayerStats>();
    seasonPlayers.forEach(player => map.set(player.id, player));
    return map;
  }, [seasonPlayers]);

  const recentGameIdsByTeam = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    playerGameStats.forEach(row => {
      if (resolvedSeasonId && String(row.games?.season_id ?? '') !== String(resolvedSeasonId)) return;
      const teamId = row.players?.team_id ?? playerTeamMap.get(row.player_id);
      if (!teamId) return;
      const date = row.games?.date ? new Date(row.games.date).getTime() : 0;
      if (!map.has(teamId)) map.set(teamId, new Map());
      const teamGames = map.get(teamId)!;
      const existing = teamGames.get(row.game_id);
      if (!existing || date > existing) teamGames.set(row.game_id, date);
    });

    const result = new Map<string, string[]>();
    map.forEach((teamGames, teamId) => {
      const sorted = Array.from(teamGames.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([gameId]) => gameId);
      result.set(teamId, sorted.slice(0, 5));
    });

    return result;
  }, [playerGameStats, playerTeamMap, resolvedSeasonId]);

  const gameTeamPoints = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    playerGameStats.forEach(row => {
      if (resolvedSeasonId && String(row.games?.season_id ?? '') !== String(resolvedSeasonId)) return;
      const teamId = row.players?.team_id ?? playerTeamMap.get(row.player_id);
      if (!teamId) return;
      if (!map.has(row.game_id)) map.set(row.game_id, new Map());
      const byTeam = map.get(row.game_id)!;
      const current = byTeam.get(teamId) ?? 0;
      byTeam.set(teamId, current + (row.points || 0));
    });
    return map;
  }, [playerGameStats, playerTeamMap, resolvedSeasonId]);

  const currentTeamPlayerIds = useMemo(() => {
    const set = new Set<string>();
    currentTeamPlayers.forEach(player => set.add(player.id));
    return set;
  }, [currentTeamPlayers]);

  const recentGameMetrics = useMemo(() => {
    if (!resolvedTeamId) return [];
    const recentGames = games.slice(0, RECENT_GAMES_WINDOW);
    return recentGames
      .map(game => {
        const rows = playerGameStats.filter(row => (
          row.game_id === game.id
          && (row.players?.team_id === resolvedTeamId
            || currentTeamPlayerIds.has(row.player_id)
            || playerTeamMap.get(row.player_id) === resolvedTeamId)
        ));
        if (rows.length === 0) return null;
        return buildTeamGameMetrics(rows);
      })
      .filter((item): item is ReturnType<typeof buildTeamGameMetrics> => Boolean(item));
  }, [currentTeamPlayerIds, games, playerGameStats, playerTeamMap, resolvedTeamId]);

  const consistencyInsights = useMemo(() => {
    if (recentGameMetrics.length < 3) return [];
    const paceStd = stdDev(recentGameMetrics.map(item => item.pace));
    const threePctStd = stdDev(recentGameMetrics.map(item => item.threePct));
    const turnoverStd = stdDev(recentGameMetrics.map(item => item.turnoverRate));

    const isHigh = paceStd >= 4 || threePctStd >= 6 || turnoverStd >= 0.04;
    if (!isHigh) return [];

    return [
      `Inkonzisztens teljesítmény (utolsó ${recentGameMetrics.length} meccs szórás: Pace ${roundValue(paceStd, 1)}, 3P% ${roundValue(threePctStd, 1)}, TO ${roundValue(turnoverStd * 100, 1)}%).`,
    ];
  }, [recentGameMetrics]);

  const displayTeamAnalysis = useMemo<TeamAnalysis | null>(() => {
    if (!teamAnalysis) return null;
    if (consistencyInsights.length === 0) return teamAnalysis;
    return {
      ...teamAnalysis,
      rosterInsights: [...teamAnalysis.rosterInsights, ...consistencyInsights],
    };
  }, [consistencyInsights, teamAnalysis]);

  const getPercentileColor = (value: number) => {
    if (value >= 80) return '#22c55e';
    if (value >= 60) return '#38bdf8';
    if (value >= 40) return '#a3e635';
    if (value >= 20) return '#f97316';
    return '#ef4444';
  };

  const formatLeagueValue = (key: string, value: number) => {
    if (!Number.isFinite(value)) return 'N/A';
    if (key === 'pace') return value.toFixed(2);
    if (key === 'three_pct') return `${value.toFixed(1)}%`;
    if (['two_rate', 'three_rate', 'ft_rate', 'assist_rate', 'usage_concentration', 'frontcourt_presence'].includes(key)) {
      return `${(value * 100).toFixed(1)}%`;
    }
    return value.toFixed(2);
  };

  const rolePlayersByRole = useMemo(() => {
    const map = new Map<string, string[]>();
    seasonPlayers
      .filter(player => player.teamId === resolvedTeamId)
      .forEach(player => {
        const roles = rolesByPlayerId.get(player.id) ?? [];
        roles.forEach(role => {
          if (!map.has(role)) map.set(role, []);
          map.get(role)!.push(player.name);
        });
      });
    return map;
  }, [resolvedTeamId, rolesByPlayerId, seasonPlayers]);


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

  const buildRecentTeamStat = useMemo(() => {
    return (teamId: string): PregameTeamSeasonStat | null => {
      if (!teamId || teamId === 'all') return null;
      const meta = teamSeasonStats.find(team => team.teamId === teamId);
      if (!meta) return null;
      const recentGameIds = recentGameIdsByTeam.get(teamId) ?? [];
      if (recentGameIds.length < MIN_RECENT_GAMES_TEAM) return null;
      const recentGameSet = new Set(recentGameIds);

      const totals = {
        pointsFor: 0,
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
      };

      playerGameStats.forEach(row => {
        if (!recentGameSet.has(row.game_id)) return;
        const rowTeamId = row.players?.team_id ?? playerTeamMap.get(row.player_id);
        if (rowTeamId !== teamId) return;

        totals.pointsFor += row.points || 0;
        totals.fga2 += (row.close_attempted || 0) + (row.mid_attempted || 0);
        totals.fgm2 += (row.close_made || 0) + (row.mid_made || 0);
        totals.fga3 += row.three_attempted || 0;
        totals.fgm3 += row.three_made || 0;
        totals.fta += row.free_throw_attempted || 0;
        totals.ftm += row.free_throw_made || 0;
        totals.oreb += row.offensive_rebounds || 0;
        totals.dreb += row.defensive_rebounds || 0;
        totals.ast += row.assists || 0;
        totals.tov += row.turnovers || 0;
        totals.stl += row.steals || 0;
        totals.blk += row.blocks || 0;
        totals.fouls += row.fouls_committed || 0;
        totals.val += row.valuation || 0;
      });

      let pointsAgainst = 0;
      let countedGames = 0;
      recentGameIds.forEach(gameId => {
        const byTeam = gameTeamPoints.get(gameId);
        if (!byTeam) return;
        const ownPoints = byTeam.get(teamId);
        if (ownPoints === undefined) return;
        const totalPoints = Array.from(byTeam.values()).reduce((sum, value) => sum + value, 0);
        pointsAgainst += totalPoints - ownPoints;
        countedGames += 1;
      });

      const gamesCount = countedGames > 0 ? countedGames : recentGameIds.length;

      return {
        teamId: meta.teamId,
        teamName: meta.teamName,
        league: meta.league,
        season: meta.season,
        games: gamesCount,
        pointsFor: totals.pointsFor,
        pointsAgainst,
        fga2: totals.fga2,
        fgm2: totals.fgm2,
        fga3: totals.fga3,
        fgm3: totals.fgm3,
        fta: totals.fta,
        ftm: totals.ftm,
        oreb: totals.oreb,
        dreb: totals.dreb,
        ast: totals.ast,
        tov: totals.tov,
        stl: totals.stl,
        blk: totals.blk,
        fouls: totals.fouls,
        val: totals.val,
      };
    };
  }, [MIN_RECENT_GAMES_TEAM, gameTeamPoints, playerGameStats, playerTeamMap, recentGameIdsByTeam, teamSeasonStats]);

  const pregameOwnTeam = useMemo<PregameTeamSeasonStat | null>(() => {
    if (useRecentFormPregame) {
      return buildRecentTeamStat(resolvedTeamId) ?? (selectedTeamStats ? {
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
      } : null);
    }
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
  }, [buildRecentTeamStat, resolvedTeamId, selectedTeamStats, useRecentFormPregame]);

  const pregameOpponentTeam = useMemo<PregameTeamSeasonStat | null>(() => {
    if (!selectedOpponentTeamId || selectedOpponentTeamId === resolvedTeamId) return null;
    if (useRecentFormPregame) {
      return buildRecentTeamStat(selectedOpponentTeamId)
        ?? teamSeasonStats.find(team => team.teamId === selectedOpponentTeamId)
        ?? null;
    }
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
  }, [buildRecentTeamStat, resolvedTeamId, selectedOpponentTeamId, teamSeasonStats, useRecentFormPregame]);

  const pregameOpponentPlayers = useMemo<PlayerSeasonStat[]>(() => {
    if (!selectedOpponentTeamId) return [];

    const buildFromSeason = () =>
      activeSeasonPlayers
        .filter(player => player.teamId === selectedOpponentTeamId)
        .filter(player => (player.gamesPlayed || 0) >= MIN_PREGAME_GAMES)
        .map(player => ({
          playerId: player.id,
          name: player.name,
          position: mapPosition(player.position),
          heightCm: player.height || undefined,
          games: player.gamesPlayed || 0,
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
          val: (() => {
            const totalValuation = (player.valuation || 0) * (player.gamesPlayed || 0);
            return totalValuation > 0 ? totalValuation : computeTotalValuation(player);
          })(),
          roles: rolesByPlayerId.get(player.id) ?? [],
        }));

    if (!useRecentFormPregame) return buildFromSeason();

    const recentGameIds = recentGameIdsByTeam.get(selectedOpponentTeamId) ?? [];
    if (recentGameIds.length < MIN_RECENT_GAMES_TEAM) return buildFromSeason();
    const recentGameSet = new Set(recentGameIds);
    const statsMap = new Map<string, PlayerSeasonStat>();
    const gamesMap = new Map<string, Set<string>>();

    playerGameStats.forEach(row => {
      if (!recentGameSet.has(row.game_id)) return;
      const teamId = row.players?.team_id ?? playerTeamMap.get(row.player_id);
      if (teamId !== selectedOpponentTeamId) return;
      if (seasonPlayerMap.get(row.player_id)?.isActive === false) return;

      const base = statsMap.get(row.player_id) ?? {
        playerId: row.player_id,
        name: seasonPlayerMap.get(row.player_id)?.name ?? row.player_id,
        position: mapPosition(seasonPlayerMap.get(row.player_id)?.position ?? 'C'),
        heightCm: seasonPlayerMap.get(row.player_id)?.height || undefined,
        games: 0,
        minutes: 0,
        points: 0,
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
        val: 0,
        roles: rolesByPlayerId.get(row.player_id) ?? [],
      };

      base.minutes += row.minutes || 0;
      base.points += row.points || 0;
      base.fga2 += (row.close_attempted || 0) + (row.mid_attempted || 0);
      base.fgm2 += (row.close_made || 0) + (row.mid_made || 0);
      base.fga3 += row.three_attempted || 0;
      base.fgm3 += row.three_made || 0;
      base.fta += row.free_throw_attempted || 0;
      base.ftm += row.free_throw_made || 0;
      base.oreb += row.offensive_rebounds || 0;
      base.dreb += row.defensive_rebounds || 0;
      base.ast += row.assists || 0;
      base.tov += row.turnovers || 0;
      base.stl += row.steals || 0;
      base.blk += row.blocks || 0;
      base.val += row.valuation || 0;
      statsMap.set(row.player_id, base);

      if (!gamesMap.has(row.player_id)) gamesMap.set(row.player_id, new Set());
      gamesMap.get(row.player_id)!.add(row.game_id);
    });

    return Array.from(statsMap.values())
      .map(player => ({
        ...player,
        games: gamesMap.get(player.playerId)?.size ?? 0,
      }))
      .filter(player => (player.games || 0) >= MIN_PREGAME_GAMES)
      .filter(player => seasonPlayerMap.get(player.playerId)?.isActive !== false);
  }, [MIN_PREGAME_GAMES, MIN_RECENT_GAMES_TEAM, activeSeasonPlayers, playerGameStats, playerTeamMap, recentGameIdsByTeam, rolesByPlayerId, seasonPlayerMap, selectedOpponentTeamId, useRecentFormPregame]);

  const pregameOwnPlayers = useMemo<PlayerSeasonStat[]>(() => {
    if (!resolvedTeamId || resolvedTeamId === 'all') return [];

    const buildFromSeason = () =>
      activeSeasonPlayers
        .filter(player => player.teamId === resolvedTeamId)
        .filter(player => (player.gamesPlayed || 0) >= MIN_PREGAME_GAMES)
        .map(player => ({
          playerId: player.id,
          name: player.name,
          position: mapPosition(player.position),
          heightCm: player.height || undefined,
          games: player.gamesPlayed || 0,
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
          val: (() => {
            const totalValuation = (player.valuation || 0) * (player.gamesPlayed || 0);
            return totalValuation > 0 ? totalValuation : computeTotalValuation(player);
          })(),
          roles: rolesByPlayerId.get(player.id) ?? [],
        }));

    if (!useRecentFormPregame) return buildFromSeason();

    const recentGameIds = recentGameIdsByTeam.get(resolvedTeamId) ?? [];
    if (recentGameIds.length < MIN_RECENT_GAMES_TEAM) return buildFromSeason();
    const recentGameSet = new Set(recentGameIds);
    const statsMap = new Map<string, PlayerSeasonStat>();
    const gamesMap = new Map<string, Set<string>>();

    playerGameStats.forEach(row => {
      if (!recentGameSet.has(row.game_id)) return;
      const teamId = row.players?.team_id ?? playerTeamMap.get(row.player_id);
      if (teamId !== resolvedTeamId) return;
      if (seasonPlayerMap.get(row.player_id)?.isActive === false) return;

      const base = statsMap.get(row.player_id) ?? {
        playerId: row.player_id,
        name: seasonPlayerMap.get(row.player_id)?.name ?? row.player_id,
        position: mapPosition(seasonPlayerMap.get(row.player_id)?.position ?? 'C'),
        heightCm: seasonPlayerMap.get(row.player_id)?.height || undefined,
        games: 0,
        minutes: 0,
        points: 0,
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
        val: 0,
        roles: rolesByPlayerId.get(row.player_id) ?? [],
      };

      base.minutes += row.minutes || 0;
      base.points += row.points || 0;
      base.fga2 += (row.close_attempted || 0) + (row.mid_attempted || 0);
      base.fgm2 += (row.close_made || 0) + (row.mid_made || 0);
      base.fga3 += row.three_attempted || 0;
      base.fgm3 += row.three_made || 0;
      base.fta += row.free_throw_attempted || 0;
      base.ftm += row.free_throw_made || 0;
      base.oreb += row.offensive_rebounds || 0;
      base.dreb += row.defensive_rebounds || 0;
      base.ast += row.assists || 0;
      base.tov += row.turnovers || 0;
      base.stl += row.steals || 0;
      base.blk += row.blocks || 0;
      base.val += row.valuation || 0;
      statsMap.set(row.player_id, base);

      if (!gamesMap.has(row.player_id)) gamesMap.set(row.player_id, new Set());
      gamesMap.get(row.player_id)!.add(row.game_id);
    });

    return Array.from(statsMap.values())
      .map(player => ({
        ...player,
        games: gamesMap.get(player.playerId)?.size ?? 0,
      }))
      .filter(player => (player.games || 0) >= MIN_PREGAME_GAMES)
      .filter(player => seasonPlayerMap.get(player.playerId)?.isActive !== false);
  }, [MIN_PREGAME_GAMES, MIN_RECENT_GAMES_TEAM, activeSeasonPlayers, playerGameStats, playerTeamMap, recentGameIdsByTeam, resolvedTeamId, rolesByPlayerId, seasonPlayerMap, useRecentFormPregame]);

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
        reason: buildSimilarityReason(analysis, item.analysis),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3);
  }, [analysis, benchmarks, league, seasonPlayers, selectedPlayer, resolvedSeasonId]);

  const lastFiveChartData = useMemo(() => {
    return lastFiveGames
      .slice(0, 5)
      .map(game => ({
        label: game.games?.date
          ? new Date(game.games.date).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })
          : 'N/A',
        val: game.valuation,
        minutes: game.minutes,
      }))
      .reverse();
  }, [lastFiveGames]);

  const eligibleCount = useMemo(() => {
    if (!resolvedSeasonId) return 0;
    return seasonPlayers
      .map(player => normalizePlayerStats(toRawStat(player, league, resolvedSeasonId)))
      .filter(isEligibleSample).length;
  }, [league, seasonPlayers, resolvedSeasonId]);

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
                <SelectTrigger className="bg-slate-800 border-slate-700 w-full">
                  <SelectValue placeholder="Válassz szezont..." className="truncate" />
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
                <SelectTrigger className="bg-slate-800 border-slate-700 w-full">
                  <SelectValue placeholder="Válassz csapatot..." className="truncate" />
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
                <SelectTrigger className="bg-slate-800 border-slate-700 w-full">
                  <SelectValue placeholder="Válassz játékost..." className="truncate" />
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
      <TerminologyGlossary />

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
                <div className="text-sm text-slate-300">{buildCoachSummary(analysis)}</div>

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

            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-50">Last 5 Trend (VAL / perc)</CardTitle>
              </CardHeader>
              <CardContent>
                {lastFiveChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={lastFiveChartData} margin={{ left: 8, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="label" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          color: '#f1f5f9',
                        }}
                      />
                      <Line type="monotone" dataKey="val" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} name="VAL" />
                      <Line type="monotone" dataKey="minutes" stroke="#38bdf8" strokeWidth={2} dot={{ r: 3 }} name="Perc" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-sm text-slate-400">Nincs elérhető meccs adat.</div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-50">Last 5 Games Performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {lastFiveGames.length > 0 ? (
                  lastFiveGames.map(game => (
                    <div key={game.id} className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                      <div className="flex items-center justify-between text-slate-200">
                        <span>{game.games?.opponent ?? 'Ismeretlen ellenfél'}</span>
                        <span className="text-xs text-slate-400">
                          {game.games?.date ? new Date(game.games.date).toLocaleDateString('hu-HU') : 'Ismeretlen dátum'}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-300">
                        <div>PTS: {game.points}</div>
                        <div>MIN: {game.minutes}</div>
                        <div>VAL: {game.valuation}</div>
                        <div>REB: {game.total_rebounds}</div>
                        <div>AST: {game.assists}</div>
                        <div>TO: {game.turnovers}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-400">Nincs elérhető meccs adat az utolsó 5 mérkőzéshez.</div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-50">Összegzett értékelés</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2 text-slate-200">
                  <div className="text-slate-300 font-medium">Erősségek</div>
                  {analysis.strengths.length > 0 ? (
                    analysis.strengths.map(item => <div key={item}>• {item}</div>)
                  ) : (
                    <div className="text-slate-400">Nincs kiemelt erősség.</div>
                  )}
                </div>
                <div className="space-y-2 text-slate-200">
                  <div className="text-slate-300 font-medium">Limitációk</div>
                  {analysis.limitations.length > 0 ? (
                    analysis.limitations.map(item => <div key={item}>• {item}</div>)
                  ) : (
                    <div className="text-slate-400">Nincs kiemelt limitáció.</div>
                  )}
                </div>
                <div className="space-y-2 text-slate-200">
                  <div className="text-slate-300 font-medium">Javítandó pontok</div>
                  {analysis.improvements.length > 0 ? (
                    analysis.improvements.map(item => <div key={item}>• {item}</div>)
                  ) : (
                    <div className="text-slate-400">Nincs kiemelt javítandó pont.</div>
                  )}
                </div>
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
                      <span className="text-slate-400">{(item.similarity * 100).toFixed(0)}% – {item.reason}</span>
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

          {resolvedTeamId !== 'all' && !displayTeamAnalysis && (
            <div className="text-sm text-slate-300">
              Nincs elég adat a csapat elemzéséhez.
            </div>
          )}

          {resolvedTeamId !== 'all' && displayTeamAnalysis && (
            <div className="space-y-4">
              <div className="text-sm text-slate-200 leading-relaxed">{displayTeamAnalysis.summary}</div>

              <div className="flex flex-wrap gap-2">
                {displayTeamAnalysis.style.offense.map(style => (
                  <Badge key={style} className="bg-cyan-600/20 text-cyan-200 border border-cyan-600/40">
                    {style}
                  </Badge>
                ))}
                {displayTeamAnalysis.style.defense.map(style => (
                  <Badge key={style} className="bg-emerald-600/20 text-emerald-200 border border-emerald-600/40">
                    {style}
                  </Badge>
                ))}
                {displayTeamAnalysis.style.offense.length === 0 && displayTeamAnalysis.style.defense.length === 0 && (
                  <Badge variant="secondary" className="bg-slate-800 text-slate-200">
                    Nincs egyértelmű stílusprofil
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-sm text-slate-300 font-medium">Erősségek</div>
                  {displayTeamAnalysis.strengths.length > 0 ? (
                    displayTeamAnalysis.strengths.map(item => <div key={item} className="text-sm text-slate-200">• {item}</div>)
                  ) : (
                    <div className="text-sm text-slate-400">Nincs kiemelt erősség.</div>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-slate-300 font-medium">Limitációk</div>
                  {displayTeamAnalysis.limitations.length > 0 ? (
                    displayTeamAnalysis.limitations.map(item => <div key={item} className="text-sm text-slate-200">• {item}</div>)
                  ) : (
                    <div className="text-sm text-slate-400">Nincs kiemelt limitáció.</div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm text-slate-300 font-medium">Liga összevetés (percentilis)</div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="h-72 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={displayTeamAnalysis.leagueProfile.entries}
                        layout="vertical"
                        margin={{ left: 12, right: 12 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis type="number" domain={[0, 100]} stroke="#94a3b8" tick={{ fontSize: 11 }} />
                        <YAxis dataKey="label" type="category" width={110} stroke="#94a3b8" tick={{ fontSize: 11 }} />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload || payload.length === 0) return null;
                            const data = payload[0]?.payload as {
                              key: string;
                              label: string;
                              percentile: number;
                              value: number;
                              tier: string;
                            };
                            if (!data) return null;
                            return (
                              <div className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-xs text-slate-100">
                                <div className="text-sm font-semibold text-slate-100">{data.label}</div>
                                <div className="text-slate-300">Percentilis: {data.percentile}</div>
                                <div className="text-slate-300">Nyers érték: {formatLeagueValue(data.key, data.value)}</div>
                                <div className="text-slate-400">{data.tier}</div>
                              </div>
                            );
                          }}
                        />
                        <Bar dataKey="percentile" radius={[4, 4, 4, 4]}>
                          {displayTeamAnalysis.leagueProfile.entries.map(entry => (
                            <Cell key={entry.key} fill={getPercentileColor(entry.percentile)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2 text-sm">
                    {displayTeamAnalysis.leagueProfile.entries.map(entry => (
                      <div key={entry.key} className="flex items-center justify-between text-slate-200">
                        <span>{entry.label}</span>
                        <span className="text-slate-400">
                          {entry.tier} • {entry.percentile}. percentilis
                        </span>
                      </div>
                    ))}
                    <div className="text-xs text-slate-400">
                      Liga-klaszter: {displayTeamAnalysis.leagueProfile.clusterLabel}
                      {displayTeamAnalysis.leagueProfile.clusterCount && displayTeamAnalysis.leagueProfile.teamCount
                        ? ` (${displayTeamAnalysis.leagueProfile.clusterCount}/${displayTeamAnalysis.leagueProfile.teamCount} csapat)`
                        : ''}
                    </div>
                    {!displayTeamAnalysis.leagueProfile.opponentStatsComplete && (
                      <div className="text-xs text-amber-300">
                        Opponent statisztikák hiányosak, védekezési profil korlátozott.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <div className="text-sm text-slate-300 font-medium">Posztmegoszlás</div>
                  {(Object.entries(displayTeamAnalysis.rosterSummary.positionMinutesShare) as [string, number][])
                    .map(([pos, share]) => (
                      <div key={pos} className="text-sm text-slate-200">
                        {pos}: {share.toFixed(1)}%
                      </div>
                    ))}
                  {displayTeamAnalysis.rosterSummary.avgHeightOverall && (
                    <div className="text-xs text-slate-400">
                      Átlagmagasság: {displayTeamAnalysis.rosterSummary.avgHeightOverall.toFixed(1)} cm
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-slate-300 font-medium">Role-megoszlás</div>
                  {Object.keys(displayTeamAnalysis.rosterSummary.roleCounts).length > 0 ? (
                    Object.entries(displayTeamAnalysis.rosterSummary.roleCounts).map(([role, count]) => (
                      <div key={role} className="text-sm text-slate-200">
                        <div>
                          {count >= 3
                            ? `${role}: redundáns (${count}) – rotációs előny, de szerepütközés lehetséges`
                            : count === 0
                              ? `${role}: hiány – taktikai opció nem elérhető`
                              : `${role}: ${count}`}
                        </div>
                        {count > 0 && (rolePlayersByRole.get(role)?.length ?? 0) > 0 && (
                          <div className="text-xs text-slate-400">
                            {rolePlayersByRole.get(role)!.slice(0, 4).join(', ')}
                            {rolePlayersByRole.get(role)!.length > 4 ? '…' : ''}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-slate-400">Nincs szerepkör adat.</div>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-slate-300 font-medium">Usage koncentráció</div>
                  <div className="text-sm text-slate-200">
                    Top2 usage arány: {(displayTeamAnalysis.rosterSummary.top2UsageShare * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-slate-400">
                    {displayTeamAnalysis.rosterSummary.flags.scorerDependency && '• Túlzott scorer-függőség'}
                    {displayTeamAnalysis.rosterSummary.flags.lowPlaymakingDepth && ' • Alacsony playmaking depth'}
                    {displayTeamAnalysis.rosterSummary.flags.weakReboundingPresence && ' • Lepattanó hiány posztonként'}
                  </div>
                </div>
              </div>

              {displayTeamAnalysis.rosterInsights.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm text-slate-300 font-medium">Roster értelmezés</div>
                  {displayTeamAnalysis.rosterInsights.map(item => (
                    <div key={item} className="text-sm text-slate-200">• {item}</div>
                  ))}
                </div>
              )}

              {displayTeamAnalysis.riskPriorities.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm text-slate-300 font-medium">Kockázatok</div>
                  {displayTeamAnalysis.riskPriorities.map(item => (
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
                <SelectTrigger className="bg-slate-800 border-slate-700 w-full">
                  <SelectValue placeholder="Válassz ellenfelet..." className="truncate" />
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
            <div className="flex items-end">
              <Button
                type="button"
                size="sm"
                variant={useRecentFormPregame ? 'default' : 'outline'}
                onClick={() => setUseRecentFormPregame(value => !value)}
                className={useRecentFormPregame
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'border-slate-700 text-slate-300 hover:bg-slate-800'}
              >
                Utolsó 5 meccs formája
              </Button>
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
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <div className="text-sm text-slate-300 font-medium mb-2">
                  Várható győztes (statisztikai becslés)
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-emerald-300">
                    {(pregameOwnTeam?.teamName ?? 'Saját csapat')}: {pregameReport.winProbability.ownPct.toFixed(1)}%
                  </span>
                  <span className="text-slate-400">vs</span>
                  <span className="text-orange-300">
                    {pregameReport.opponentTeamName}: {pregameReport.winProbability.opponentPct.toFixed(1)}%
                  </span>
                </div>
                <div className="mt-2 h-2 w-full bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${pregameReport.winProbability.ownPct}%` }}
                  />
                </div>
                <div className="text-xs text-slate-400 mt-2">
                  Várható győztes:{' '}
                  {pregameReport.winProbability.predictedWinner === 'even'
                    ? 'Kiegyenlített'
                    : pregameReport.winProbability.predictedWinner === 'own'
                      ? (pregameOwnTeam?.teamName ?? 'Saját csapat')
                      : pregameReport.opponentTeamName}
                  {' • '}Bizonyosság:{' '}
                  {pregameReport.winProbability.confidence === 'High'
                    ? 'Magas'
                    : pregameReport.winProbability.confidence === 'Medium'
                      ? 'Közepes'
                      : 'Alacsony'}
                </div>
              </div>

              <div className="text-sm text-slate-200 leading-relaxed">{pregameReport.summary}</div>

              <div className="p-3 bg-slate-800/50 rounded-lg">
                <div className="text-sm text-slate-300 font-medium mb-2">Poszt-összehasonlítás (VAL/36)</div>
                {(() => {
                  const positionLabels: Record<string, string> = {
                    PG: 'Irányító',
                    SG: 'Dobó',
                    SF: 'Bedobó',
                    PF: 'Erőcsatár',
                    C: 'Center',
                  };
                  const positionComparisonChart = pregameReport.positionComparison.map(item => ({
                    ...item,
                    label: positionLabels[item.position] ?? item.position,
                  }));
                  return (
                    <>
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={positionComparisonChart} margin={{ left: 8, right: 8 }}>
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
                          <Bar dataKey="ownValPer36" name="Saját csapat" fill="#10b981" radius={[6, 6, 0, 0]} />
                          <Bar dataKey="oppValPer36" name="Ellenfél" fill="#f97316" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>

                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        {positionComparisonChart.map(item => {
                          let tone = 'text-slate-400';
                          let label = 'Kiegyenlített';
                          if (item.deltaValPer36 >= 2) {
                            tone = 'text-emerald-400';
                            label = `Saját előny (+${item.deltaValPer36.toFixed(1)} VAL/36)`;
                          } else if (item.deltaValPer36 <= -2) {
                            tone = 'text-rose-400';
                            label = `Ellenfél előny (${item.deltaValPer36.toFixed(1)} VAL/36)`;
                          }
                          return (
                            <div key={item.position} className="flex items-center justify-between bg-slate-900/40 rounded-md px-3 py-2">
                              <span className="text-slate-200">{item.label}</span>
                              <span className={tone}>{label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </div>

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
                <SelectTrigger className="bg-slate-800 border-slate-700 w-full">
                  <SelectValue placeholder="Válassz meccset..." className="truncate" />
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

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-slate-50">Érkező játékos előzetes elemzése</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!benchmarks && (
            <div className="text-sm text-slate-300">Válassz szezont az előzetes elemzéshez.</div>
          )}

          {benchmarks && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Név</label>
                  <Input
                    value={incomingPlayer.name}
                    onChange={(e) => setIncomingPlayer(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Játékos neve"
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Poszt</label>
                  <Select
                    value={incomingPlayer.position}
                    onValueChange={(value) => setIncomingPlayer(prev => ({ ...prev, position: value as Position }))}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-700 w-full">
                      <SelectValue placeholder="Válassz posztot" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="PG">Irányító</SelectItem>
                      <SelectItem value="SG">Dobóhátvéd</SelectItem>
                      <SelectItem value="SF">Bedobó</SelectItem>
                      <SelectItem value="PF">Erőcsatár</SelectItem>
                      <SelectItem value="C">Center</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Meccsek</label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={displayIncomingValue('games', incomingPlayer.games)}
                    onFocus={() => setFocusedIncomingField('games')}
                    onBlur={() => setFocusedIncomingField(null)}
                    onChange={(e) => handleIncomingNumberChange('games', e.target.value)}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Perc/meccs</label>
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    value={displayIncomingValue('minutesPerGame', incomingPlayer.minutesPerGame)}
                    onFocus={() => setFocusedIncomingField('minutesPerGame')}
                    onBlur={() => setFocusedIncomingField(null)}
                    onChange={(e) => handleIncomingNumberChange('minutesPerGame', e.target.value)}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Pont/meccs</label>
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    value={displayIncomingValue('pointsPerGame', incomingPlayer.pointsPerGame)}
                    onFocus={() => setFocusedIncomingField('pointsPerGame')}
                    onBlur={() => setFocusedIncomingField(null)}
                    onChange={(e) => handleIncomingNumberChange('pointsPerGame', e.target.value)}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Assziszt/meccs</label>
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    value={displayIncomingValue('assistsPerGame', incomingPlayer.assistsPerGame)}
                    onFocus={() => setFocusedIncomingField('assistsPerGame')}
                    onBlur={() => setFocusedIncomingField(null)}
                    onChange={(e) => handleIncomingNumberChange('assistsPerGame', e.target.value)}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Lepatt./meccs (T)</label>
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    value={displayIncomingValue('rebTotal', incomingPlayer.orebPerGame + incomingPlayer.drebPerGame)}
                    onFocus={() => setFocusedIncomingField('rebTotal')}
                    onBlur={() => setFocusedIncomingField(null)}
                    onChange={(e) => {
                      const total = Number(e.target.value) || 0;
                      const ratio = incomingPlayer.orebPerGame + incomingPlayer.drebPerGame > 0
                        ? incomingPlayer.orebPerGame / (incomingPlayer.orebPerGame + incomingPlayer.drebPerGame)
                        : 0.3;
                      const oreb = total * ratio;
                      const dreb = total - oreb;
                      setIncomingPlayer(prev => ({ ...prev, orebPerGame: round(oreb, 1), drebPerGame: round(dreb, 1) }));
                    }}
                    className="bg-slate-800 border-slate-700"
                  />
                  <div className="text-[10px] text-slate-500">OREB/DREB arány automatikusan megtartva.</div>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">VAL/meccs</label>
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    value={displayIncomingValue('valuationPerGame', incomingPlayer.valuationPerGame)}
                    onFocus={() => setFocusedIncomingField('valuationPerGame')}
                    onBlur={() => setFocusedIncomingField(null)}
                    onChange={(e) => handleIncomingNumberChange('valuationPerGame', e.target.value)}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">2FGP (%), 2FGA/meccs</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={displayIncomingValue('twoPct', incomingPlayer.twoPct)}
                      onFocus={() => setFocusedIncomingField('twoPct')}
                      onBlur={() => setFocusedIncomingField(null)}
                      onChange={(e) => handleIncomingNumberChange('twoPct', e.target.value)}
                      className="bg-slate-800 border-slate-700"
                    />
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={displayIncomingValue('twoAttemptedPerGame', incomingPlayer.twoAttemptedPerGame)}
                      onFocus={() => setFocusedIncomingField('twoAttemptedPerGame')}
                      onBlur={() => setFocusedIncomingField(null)}
                      onChange={(e) => handleIncomingNumberChange('twoAttemptedPerGame', e.target.value)}
                      className="bg-slate-800 border-slate-700"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">3FGP (%), 3FGA/meccs</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={displayIncomingValue('threePct', incomingPlayer.threePct)}
                      onFocus={() => setFocusedIncomingField('threePct')}
                      onBlur={() => setFocusedIncomingField(null)}
                      onChange={(e) => handleIncomingNumberChange('threePct', e.target.value)}
                      className="bg-slate-800 border-slate-700"
                    />
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={displayIncomingValue('threeAttemptedPerGame', incomingPlayer.threeAttemptedPerGame)}
                      onFocus={() => setFocusedIncomingField('threeAttemptedPerGame')}
                      onBlur={() => setFocusedIncomingField(null)}
                      onChange={(e) => handleIncomingNumberChange('threeAttemptedPerGame', e.target.value)}
                      className="bg-slate-800 border-slate-700"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">FT% és FTA/meccs</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={displayIncomingValue('ftPct', incomingPlayer.ftPct)}
                      onFocus={() => setFocusedIncomingField('ftPct')}
                      onBlur={() => setFocusedIncomingField(null)}
                      onChange={(e) => handleIncomingNumberChange('ftPct', e.target.value)}
                      className="bg-slate-800 border-slate-700"
                    />
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={displayIncomingValue('ftAttemptedPerGame', incomingPlayer.ftAttemptedPerGame)}
                      onFocus={() => setFocusedIncomingField('ftAttemptedPerGame')}
                      onBlur={() => setFocusedIncomingField(null)}
                      onChange={(e) => handleIncomingNumberChange('ftAttemptedPerGame', e.target.value)}
                      className="bg-slate-800 border-slate-700"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Labdaeladás/meccs</label>
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    value={displayIncomingValue('turnoversPerGame', incomingPlayer.turnoversPerGame)}
                    onFocus={() => setFocusedIncomingField('turnoversPerGame')}
                    onBlur={() => setFocusedIncomingField(null)}
                    onChange={(e) => handleIncomingNumberChange('turnoversPerGame', e.target.value)}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Lopás/meccs</label>
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    value={displayIncomingValue('stealsPerGame', incomingPlayer.stealsPerGame)}
                    onFocus={() => setFocusedIncomingField('stealsPerGame')}
                    onBlur={() => setFocusedIncomingField(null)}
                    onChange={(e) => handleIncomingNumberChange('stealsPerGame', e.target.value)}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Blokk/meccs</label>
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    value={displayIncomingValue('blocksPerGame', incomingPlayer.blocksPerGame)}
                    onFocus={() => setFocusedIncomingField('blocksPerGame')}
                    onBlur={() => setFocusedIncomingField(null)}
                    onChange={(e) => handleIncomingNumberChange('blocksPerGame', e.target.value)}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Faultok (elköv/kap)</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={displayIncomingValue('foulsCommittedPerGame', incomingPlayer.foulsCommittedPerGame)}
                      onFocus={() => setFocusedIncomingField('foulsCommittedPerGame')}
                      onBlur={() => setFocusedIncomingField(null)}
                      onChange={(e) => handleIncomingNumberChange('foulsCommittedPerGame', e.target.value)}
                      className="bg-slate-800 border-slate-700"
                    />
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={displayIncomingValue('foulsReceivedPerGame', incomingPlayer.foulsReceivedPerGame)}
                      onFocus={() => setFocusedIncomingField('foulsReceivedPerGame')}
                      onBlur={() => setFocusedIncomingField(null)}
                      onChange={(e) => handleIncomingNumberChange('foulsReceivedPerGame', e.target.value)}
                      className="bg-slate-800 border-slate-700"
                    />
                  </div>
                </div>
              </div>

              {!incomingEligibility && (
                <div className="text-xs text-slate-400">
                  Az elemzéshez legalább 10 meccs és 15 perc/meccs szükséges.
                </div>
              )}

              {incomingAnalysis && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  <div className="xl:col-span-2 space-y-4">
                    <Card className="bg-slate-900 border-slate-800">
                      <CardHeader>
                        <CardTitle className="text-slate-50">
                          {incomingRaw?.name ?? 'Érkező játékos'} • {getPositionLabel(incomingAnalysis.position)}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {incomingAnalysis.roles.map(role => (
                            <Badge key={role} className="bg-orange-600/20 text-orange-300 border border-orange-600/40">
                              {role}
                            </Badge>
                          ))}
                          {incomingAnalysis.roles.length === 0 && (
                            <Badge variant="secondary" className="bg-slate-800 text-slate-200">
                              Nincs egyértelmű szerepkör
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-slate-200 leading-relaxed">{incomingAnalysis.summary}</div>
                        <div className="flex flex-wrap items-center gap-3 text-xs">
                          <span className={`font-semibold ${getConfidenceTone(incomingAnalysis.confidence)}`}>
                            Bizonyosság: {incomingAnalysis.confidence}
                          </span>
                          <span className="text-slate-400">Role confidence: {(incomingAnalysis.roleConfidence * 100).toFixed(0)}%</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-slate-900 border-slate-800">
                      <CardHeader>
                        <CardTitle className="text-slate-50">Skill score-ok</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {Object.entries(incomingAnalysis.skillScores).map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between text-sm">
                            <span className="text-slate-300">{SKILL_LABELS_HU[key] ?? key}</span>
                            <div className="flex items-center gap-3">
                              <div className="h-2 w-32 bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500/80" style={{ width: `${value}%` }} />
                              </div>
                              <span className="text-slate-200 font-semibold w-10 text-right">{value}</span>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-4">
                    <Card className="bg-slate-900 border-slate-800">
                      <CardHeader>
                        <CardTitle className="text-slate-50">Erősségek</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm text-slate-200">
                        {incomingAnalysis.strengths.length > 0 ? (
                          incomingAnalysis.strengths.map(item => <div key={item}>• {item}</div>)
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
                        {incomingAnalysis.limitations.length > 0 ? (
                          incomingAnalysis.limitations.map(item => <div key={item}>• {item}</div>)
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
                        {incomingAnalysis.improvements.length > 0 ? (
                          incomingAnalysis.improvements.map(item => <div key={item}>• {item}</div>)
                        ) : (
                          <div className="text-slate-400">Nincs kiemelt javítandó pont.</div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </div>
          )}
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
