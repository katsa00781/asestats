'use client';

import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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

const getPositionLabel = (position: Position) => POSITION_LABELS[position] ?? position;

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

  const resolvedSeasonId = selectedSeasonId || currentSeasonId || allSeasons[0]?.id || '';
  const resolvedTeamId = selectedTeamId || currentTeamId || 'all';

  const league = useMemo(() => {
    const seasonName = allSeasons.find(season => String(season.id) === String(resolvedSeasonId))?.name;
    return seasonName ?? 'NB I/A';
  }, [allSeasons, resolvedSeasonId]);

  const seasonPlayers = useMemo(() => {
    if (!resolvedSeasonId) return [];
    return allPlayers.filter(player => String(player.seasonId ?? '') === String(resolvedSeasonId));
  }, [allPlayers, resolvedSeasonId]);

  const filteredPlayers = useMemo(() => {
    const base = resolvedTeamId !== 'all'
      ? seasonPlayers.filter(player => player.teamId === resolvedTeamId)
      : seasonPlayers;
    return [...base].sort((a, b) => a.name.localeCompare(b.name, 'hu'));
  }, [resolvedTeamId, seasonPlayers]);

  const selectedPlayer = useMemo(() => {
    if (!selectedPlayerId) return null;
    return seasonPlayers.find(player => player.id === selectedPlayerId) || null;
  }, [seasonPlayers, selectedPlayerId]);

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
      if (!isEligibleSample(normalized)) {
        map.set(player.id, []);
        return;
      }
      const playerAnalysis = analyzePlayerSeason(raw, benchmarks);
      map.set(player.id, playerAnalysis.roles);
    });
    return map;
  }, [benchmarks, league, seasonPlayers, resolvedSeasonId]);

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
  }, [analysis, benchmarks, league, seasonPlayers, selectedPlayer, resolvedSeasonId]);

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
