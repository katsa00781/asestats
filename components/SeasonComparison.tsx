'use client';

import { TerminologyGlossary } from './TerminologyGlossary';
import Image from 'next/image';

import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase, type Database } from '@/lib/supabase';
import { buildPositionMetadata } from '@/lib/positions';
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
  normalizeTeamStats,
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
  players?: { team_id?: string | null; name?: string | null } | null;
  fouls_committed?: number;
};

type PlayerNarrativeStatus = {
  status: 'idle' | 'loading' | 'success' | 'error';
  text?: string;
  error?: string;
  generatedAt?: string;
};

type GameTextReportRow = Database['public']['Tables']['game_text_reports']['Row'];

type StandingsSnapshotRow = {
  position: number;
  team: string;
  matches: number;
  wins: number;
  losses: number;
  scored: number;
  conceded: number;
  points: number;
};

type ProjectionRow = {
  team: string;
  currentWins: number;
  currentLosses: number;
  projectedWins: number;
  projectedLosses: number;
  expectedExtraWins: number;
  expectedFinalPoints: number;
  avgWinProbability: number;
  certaintyLabel: 'Magas' | 'Közepes' | 'Alacsony';
  certaintyScore: number;
};

const normalizeTeamKey = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const mapPositionInfo = (pos?: string | null) => buildPositionMetadata(pos, 'C');

const mapPosition = (pos: string): Position => mapPositionInfo(pos).position;

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
const TEAM_FORM_WINDOW = 5;
const TEAM_FORM_CHART_POINTS = 8;
const TEAM_FORM_EFG_THRESHOLD = 3;
const TEAM_FORM_MARGIN_THRESHOLD = 4;
const HEAD_TO_HEAD_MATCH_WINDOW_MS = 36 * 60 * 60 * 1000; // 36 hours tolerance when pairing mirrored game IDs

const isNegativeDecisiveLabel = (label: string, axis: 'offense' | 'defense') => {
  const lower = label.toLowerCase();
  const hasNegativeDelta = /-\d+(?:[.,]\d+)?\s*pp/.test(lower);
  const hasPositiveDelta = /\+\d+(?:[.,]\d+)?\s*pp/.test(lower);

  if (axis === 'defense') {
    if (/limit[aá]lt|kontroll|megfog|zavar/.test(lower)) return false;
    if (/probl[eé]ma|gyenge|romlott|engedett|visszaesett|hi[aá]ny/.test(lower)) return true;
    if (hasNegativeDelta && !hasPositiveDelta) return true;
    return false;
  }

  if (/hi[aá]ny|gyenge|vissza|akadozott|sz[eé]tesett|alacsony|probl[eé]ma/.test(lower)) return true;
  if (hasNegativeDelta && !hasPositiveDelta) return true;
  return false;
};

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

const average = (values: number[]) => {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
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
      acc.points += row.points || 0;
      return acc;
    },
    { fga2: 0, fgm2: 0, fga3: 0, fgm3: 0, fta: 0, tov: 0, points: 0 }
  );

  const fga = totals.fga2 + totals.fga3;
  const fgm = totals.fgm2 + totals.fgm3;
  const pace = fga + 0.44 * totals.fta + totals.tov;
  const threePct = totals.fga3 > 0 ? (totals.fgm3 / totals.fga3) * 100 : 0;
  const turnoverRate = pace > 0 ? totals.tov / pace : 0;
  const efg = fga > 0 ? ((fgm + 0.5 * totals.fgm3) / fga) * 100 : 0;

  return {
    pace,
    threePct,
    turnoverRate,
    efg,
    points: totals.points,
  };
};

const clampStat = (value: number) => (value < 0 ? 0 : value);

const aggregateTeamGameRows = (rows: GamePlayerStatRow[]) => {
  return rows.reduce(
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
      acc.fouls += row.fouls_committed || 0;
      acc.val += row.valuation || 0;
      return acc;
    },
    {
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
    }
  );
};

const subtractGameFromTeamAggregate = (
  team: PregameTeamSeasonStat,
  teamId: string | null | undefined,
  gameId: string | null | undefined,
  teamGamePlayerRows: Map<string, Map<string, GamePlayerStatRow[]>>,
  gameTeamPoints: Map<string, Map<string, number>>
) => {
  if (!teamId || !gameId) return team;
  const rows = teamGamePlayerRows.get(teamId)?.get(gameId);
  if (!rows || rows.length === 0) return team;
  const totals = aggregateTeamGameRows(rows);
  const scoreMap = gameTeamPoints.get(gameId);
  const ownPoints = scoreMap?.get(teamId) ?? totals.pointsFor;
  const totalPoints = scoreMap
    ? Array.from(scoreMap.values()).reduce((sum, value) => sum + value, 0)
    : ownPoints;
  const opponentPoints = Math.max(0, totalPoints - ownPoints);

  return {
    ...team,
    games: Math.max(0, (team.games || 0) - 1),
    pointsFor: clampStat(team.pointsFor - totals.pointsFor),
    pointsAgainst: clampStat(team.pointsAgainst - opponentPoints),
    fga2: clampStat(team.fga2 - totals.fga2),
    fgm2: clampStat(team.fgm2 - totals.fgm2),
    fga3: clampStat(team.fga3 - totals.fga3),
    fgm3: clampStat(team.fgm3 - totals.fgm3),
    fta: clampStat(team.fta - totals.fta),
    ftm: clampStat(team.ftm - totals.ftm),
    oreb: clampStat(team.oreb - totals.oreb),
    dreb: clampStat(team.dreb - totals.dreb),
    ast: clampStat(team.ast - totals.ast),
    tov: clampStat(team.tov - totals.tov),
    stl: clampStat(team.stl - totals.stl),
    blk: clampStat(team.blk - totals.blk),
    fouls: clampStat(team.fouls - totals.fouls),
    val: clampStat(team.val - totals.val),
  };
};

const subtractGameFromPlayerAggregates = (
  players: PlayerSeasonStat[],
  teamId: string | null | undefined,
  gameId: string | null | undefined,
  teamGamePlayerRows: Map<string, Map<string, GamePlayerStatRow[]>>
) => {
  if (!teamId || !gameId || players.length === 0) return players;
  const rows = teamGamePlayerRows.get(teamId)?.get(gameId);
  if (!rows || rows.length === 0) return players;
  const rowsByPlayer = new Map<string, GamePlayerStatRow[]>();
  rows.forEach(row => {
    if (!rowsByPlayer.has(row.player_id)) rowsByPlayer.set(row.player_id, []);
    rowsByPlayer.get(row.player_id)!.push(row);
  });

  return players
    .map(player => {
      const playerRows = rowsByPlayer.get(player.playerId);
      if (!playerRows || playerRows.length === 0) return player;
      const totals = playerRows.reduce(
        (acc, row) => {
          acc.games += 1;
          acc.minutes += row.minutes || 0;
          acc.points += row.points || 0;
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
          acc.val += row.valuation || 0;
          return acc;
        },
        {
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
        }
      );

      return {
        ...player,
        games: Math.max(0, (player.games || 0) - totals.games),
        minutes: clampStat(player.minutes - totals.minutes),
        points: clampStat(player.points - totals.points),
        fga2: clampStat(player.fga2 - totals.fga2),
        fgm2: clampStat(player.fgm2 - totals.fgm2),
        fga3: clampStat(player.fga3 - totals.fga3),
        fgm3: clampStat(player.fgm3 - totals.fgm3),
        fta: clampStat(player.fta - totals.fta),
        ftm: clampStat(player.ftm - totals.ftm),
        oreb: clampStat(player.oreb - totals.oreb),
        dreb: clampStat(player.dreb - totals.dreb),
        ast: clampStat(player.ast - totals.ast),
        tov: clampStat(player.tov - totals.tov),
        stl: clampStat(player.stl - totals.stl),
        blk: clampStat(player.blk - totals.blk),
        val: clampStat(player.val - totals.val),
      };
    })
    .filter(player => player.games > 0);
};

const getPositionLabel = (position: Position) => POSITION_LABELS[position] ?? position;

const hasSampleForPregame = (games: number, preferredMinimum: number, fallbackMinimum: number) => {
  if (!Number.isFinite(games)) return false;
  if (games >= preferredMinimum) return true;
  return games >= fallbackMinimum;
};

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
    case 'Magas':
      return 'text-emerald-400';
    case 'Közepes':
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
  const positionInfo = mapPositionInfo(player.position);
  return {
    playerId: player.id,
    name: player.name,
    league,
    season,
    position: positionInfo.position,
    positionLabel: positionInfo.positionLabel,
    positionBuckets: positionInfo.positionBuckets,
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

const toRawStatFromGameRows = (
  player: PlayerStats,
  rows: GamePlayerStatRow[],
  league: string,
  season: string
): RawPlayerSeasonStat => {
  const positionInfo = mapPositionInfo(player.position);
  const gameIds = new Set(rows.map(row => row.game_id).filter(Boolean));

  const totals = rows.reduce(
    (acc, row) => {
      acc.minutes += row.minutes || 0;
      acc.points += row.points || 0;
      acc.closeMade += row.close_made || 0;
      acc.closeAttempted += row.close_attempted || 0;
      acc.midMade += row.mid_made || 0;
      acc.midAttempted += row.mid_attempted || 0;
      acc.threeMade += row.three_made || 0;
      acc.threeAttempted += row.three_attempted || 0;
      acc.ftMade += row.free_throw_made || 0;
      acc.ftAttempted += row.free_throw_attempted || 0;
      acc.oreb += row.offensive_rebounds || 0;
      acc.dreb += row.defensive_rebounds || 0;
      acc.assists += row.assists || 0;
      acc.steals += row.steals || 0;
      acc.blocks += row.blocks || 0;
      acc.turnovers += row.turnovers || 0;
      acc.foulsCommitted += row.fouls_committed || 0;
      acc.valuation += row.valuation || 0;
      return acc;
    },
    {
      minutes: 0,
      points: 0,
      closeMade: 0,
      closeAttempted: 0,
      midMade: 0,
      midAttempted: 0,
      threeMade: 0,
      threeAttempted: 0,
      ftMade: 0,
      ftAttempted: 0,
      oreb: 0,
      dreb: 0,
      assists: 0,
      steals: 0,
      blocks: 0,
      turnovers: 0,
      foulsCommitted: 0,
      valuation: 0,
    }
  );

  return {
    playerId: player.id,
    name: player.name,
    league,
    season,
    position: positionInfo.position,
    positionLabel: positionInfo.positionLabel,
    positionBuckets: positionInfo.positionBuckets,
    games: gameIds.size,
    minutes: totals.minutes,
    points: totals.points,
    close: { made: totals.closeMade, attempted: totals.closeAttempted },
    mid: { made: totals.midMade, attempted: totals.midAttempted },
    three: { made: totals.threeMade, attempted: totals.threeAttempted },
    ft: { made: totals.ftMade, attempted: totals.ftAttempted },
    rebounds: {
      offensive: totals.oreb,
      defensive: totals.dreb,
      total: totals.oreb + totals.dreb,
    },
    assists: totals.assists,
    steals: totals.steals,
    blocks: totals.blocks,
    turnovers: totals.turnovers,
    fouls: {
      committed: totals.foulsCommitted,
      received: 0,
    },
    valuation: totals.valuation,
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

    const positionInfo = mapPositionInfo(player.position);

    team.roster.push({
      playerId: player.id,
      name: player.name,
      position: positionInfo.position,
      positionBuckets: positionInfo.positionBuckets,
      positionLabel: player.position ?? null,
      rawPosition: player.position ?? null,
      isActive: player.isActive !== false,
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

type IncomingEurobasketPayload = {
  name: string;
  position?: string;
  currentTeam?: string;
  currentCountry?: string;
  currentCountryFlagUrl?: string;
  previousTeam?: string;
  previousCountry?: string;
  previousCountryFlagUrl?: string;
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
  sourceUrl: string;
  seasonYearUsed: number;
  usedFallbackSeason: boolean;
  gamesSampled: number;
};

type IncomingEurobasketCandidate = {
  name: string;
  profileUrl: string;
  height?: string;
  position?: string;
  born?: string;
  nationality?: string;
  team?: string;
  currentTeam?: string;
  currentCountry?: string;
  currentCountryFlagUrl?: string;
  previousTeam?: string;
  previousCountry?: string;
  previousCountryFlagUrl?: string;
  flagUrl?: string;
  photoUrl?: string;
};

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

const INCOMING_PLAYER_PLACEHOLDER = '/player-placeholder.svg';

const isUnavailableIncomingPhoto = (photoUrl?: string) => {
  if (!photoUrl) return true;
  return /Not_Available\.jpg|images\/logom1\.jpg/i.test(photoUrl);
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
  const [activeSection, setActiveSection] = useState<'player' | 'team' | 'pregame' | 'postgame' | 'projection'>('player');
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [selectedOpponentTeamId, setSelectedOpponentTeamId] = useState('');
  const [selectedGameId, setSelectedGameId] = useState('');
  const [incomingPlayer, setIncomingPlayer] = useState<IncomingPlayerInput>(DEFAULT_INCOMING_PLAYER);
  const [focusedIncomingField, setFocusedIncomingField] = useState<IncomingField | null>(null);
  const [isImportingIncomingPlayer, setIsImportingIncomingPlayer] = useState(false);
  const [incomingImportError, setIncomingImportError] = useState<string | null>(null);
  const [incomingImportInfo, setIncomingImportInfo] = useState<string | null>(null);
  const [incomingImportSource, setIncomingImportSource] = useState<{ url: string; seasonYear: number } | null>(null);
  const [incomingImportCareer, setIncomingImportCareer] = useState<{
    currentTeam?: string;
    currentCountry?: string;
    currentCountryFlagUrl?: string;
    previousTeam?: string;
    previousCountry?: string;
    previousCountryFlagUrl?: string;
  } | null>(null);
  const [incomingCandidates, setIncomingCandidates] = useState<IncomingEurobasketCandidate[]>([]);
  const [incomingPhotoLoadFailed, setIncomingPhotoLoadFailed] = useState<Record<string, boolean>>({});
  const [useRecentFormPregame, setUseRecentFormPregame] = useState(false);
  const [pregameOwnInjuries, setPregameOwnInjuries] = useState<string[]>([]);
  const [pregameOpponentInjuries, setPregameOpponentInjuries] = useState<string[]>([]);
  const [showOwnInjuryPicker, setShowOwnInjuryPicker] = useState(false);
  const [showOpponentInjuryPicker, setShowOpponentInjuryPicker] = useState(false);
  const [pregameText, setPregameText] = useState('');
  const [pregameTextError, setPregameTextError] = useState<string | null>(null);
  const [isGeneratingPregameText, setIsGeneratingPregameText] = useState(false);
  const [pregameTextMeta, setPregameTextMeta] = useState<{ generatedAt?: string | null; generatedBy?: string | null }>({});
  const [pregameSaveStatus, setPregameSaveStatus] = useState<
    { type: 'success' | 'warning' | 'error'; message: string } | null
  >(null);
  const [textReport, setTextReport] = useState('');
  const [textReportMeta, setTextReportMeta] = useState<{ generatedAt?: string | null; generatedBy?: string | null }>({});
  const [textReportError, setTextReportError] = useState<string | null>(null);
  const [isLoadingTextReport, setIsLoadingTextReport] = useState(false);
  const [isGeneratingTextReport, setIsGeneratingTextReport] = useState(false);
  const [expandedPlayerImpactId, setExpandedPlayerImpactId] = useState<string | null>(null);
  const [playerNarratives, setPlayerNarratives] = useState<Record<string, PlayerNarrativeStatus>>({});
  const [standingsSnapshot, setStandingsSnapshot] = useState<StandingsSnapshotRow[]>([]);
  const [seasonFixtures, setSeasonFixtures] = useState<
    Array<{ home_team_id: string; away_team_id: string; game_date: string; status: string }>
  >([]);
  const [usedLegacyStandingsFallback, setUsedLegacyStandingsFallback] = useState(false);
  const handleToggleOwnInjury = (playerId: string) => {
    setPregameOwnInjuries(prev => (prev.includes(playerId) ? prev.filter(id => id !== playerId) : [...prev, playerId]));
  };
  const handleToggleOpponentInjury = (playerId: string) => {
    setPregameOpponentInjuries(prev =>
      prev.includes(playerId) ? prev.filter(id => id !== playerId) : [...prev, playerId]
    );
  };
  const formatGeneratedAt = (value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('hu-HU', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  };

  const MIN_PREGAME_GAMES = 4;
  const MIN_PREGAME_GAMES_FLOOR = 2;
  const MIN_RECENT_GAMES_TEAM = 3;

  const resolvedSeasonId = selectedSeasonId || currentSeasonId || allSeasons[0]?.id || '';
  const resolvedTeamId = selectedTeamId || currentTeamId || 'all';

  useEffect(() => {
    let cancelled = false;

    const loadProjectionInputs = async () => {
      if (!resolvedSeasonId) {
        if (!cancelled) {
          setStandingsSnapshot([]);
          setSeasonFixtures([]);
        }
        return;
      }

      try {
        const [{ data: standingsData }, { data: fixturesData }] = await Promise.all([
          supabase
            .from('standings')
            .select('data')
            .eq('season_id', resolvedSeasonId)
            .order('matchday', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('league_fixtures')
            .select('home_team_id, away_team_id, game_date, status')
            .eq('season_id', resolvedSeasonId)
            .in('status', ['scheduled', 'postponed']),
        ]);

        if (cancelled) return;

        let rows = Array.isArray(standingsData?.data)
          ? (standingsData?.data as StandingsSnapshotRow[])
          : [];
        let usedLegacyFallback = false;

        if (rows.length === 0) {
          const { data: legacyStandingsData } = await supabase
            .from('standings')
            .select('data')
            .is('season_id', null)
            .order('matchday', { ascending: false })
            .limit(1)
            .maybeSingle();

          const legacyRows = Array.isArray(legacyStandingsData?.data)
            ? (legacyStandingsData?.data as StandingsSnapshotRow[])
            : [];

          if (legacyRows.length > 0) {
            rows = legacyRows;
            usedLegacyFallback = true;
          }
        }

        setStandingsSnapshot(rows);
        setSeasonFixtures((fixturesData || []) as Array<{ home_team_id: string; away_team_id: string; game_date: string; status: string }>);
        setUsedLegacyStandingsFallback(usedLegacyFallback);
      } catch {
        if (!cancelled) {
          setStandingsSnapshot([]);
          setSeasonFixtures([]);
          setUsedLegacyStandingsFallback(false);
        }
      }
    };

    loadProjectionInputs();

    return () => {
      cancelled = true;
    };
  }, [resolvedSeasonId]);

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

  const activeSeasonPlayers = useMemo(() => {
    return seasonPlayers.filter(player => player.isActive !== false);
  }, [seasonPlayers]);

  const pregameOwnRosterOptions = useMemo(() => {
    if (!resolvedTeamId || resolvedTeamId === 'all') return [];
    return activeSeasonPlayers
      .filter(player => String(player.teamId ?? '') === String(resolvedTeamId))
      .map(player => ({
        id: player.id,
        name: player.name,
        position: mapPosition(player.position),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'hu'));
  }, [activeSeasonPlayers, resolvedTeamId]);

  const pregameOpponentRosterOptions = useMemo(() => {
    if (!selectedOpponentTeamId) return [];
    return activeSeasonPlayers
      .filter(player => String(player.teamId ?? '') === String(selectedOpponentTeamId))
      .map(player => ({
        id: player.id,
        name: player.name,
        position: mapPosition(player.position),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'hu'));
  }, [activeSeasonPlayers, selectedOpponentTeamId]);

  const filteredPlayers = useMemo(() => {
    const base = resolvedTeamId !== 'all'
      ? activeSeasonPlayers.filter(player => String(player.teamId ?? '') === String(resolvedTeamId))
      : activeSeasonPlayers;

    const uniqueMap = new Map<string, PlayerStats>();
    base.forEach(player => {
      const nameKey = player.name?.trim().toLowerCase() ?? player.id;
      const teamKey = String(player.teamId ?? 'unknown-team');
      const numberKey = typeof player.number === 'number' ? player.number : 'unknown-number';
      const key = `${teamKey}::${nameKey}::${numberKey}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, player);
      }
    });

    return Array.from(uniqueMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'hu'));
  }, [resolvedTeamId, activeSeasonPlayers]);

  const selectedPlayer = useMemo(() => {
    if (!selectedPlayerId) return null;
    return activeSeasonPlayers.find(player => player.id === selectedPlayerId) || null;
  }, [activeSeasonPlayers, selectedPlayerId]);

  const selectedPlayerRows = useMemo(() => {
    if (!selectedPlayer) return [] as GamePlayerStatRow[];
    return playerGameStats
      .filter(row => row.player_id === selectedPlayer.id)
      .filter(row => {
        if (!resolvedSeasonId) return true;
        if (String(row.games?.season_id ?? '') === String(resolvedSeasonId)) return true;
        return String(selectedPlayer.seasonId ?? '') === String(resolvedSeasonId);
      })
      .sort((a, b) => {
        const aDate = a.games?.date ? new Date(a.games.date).getTime() : 0;
        const bDate = b.games?.date ? new Date(b.games.date).getTime() : 0;
        return bDate - aDate;
      });
  }, [playerGameStats, resolvedSeasonId, selectedPlayer]);

  useEffect(() => {
    if (!selectedPlayerId) return;
    if (activeSeasonPlayers.some(player => player.id === selectedPlayerId)) return;
    setSelectedPlayerId('');
  }, [activeSeasonPlayers, selectedPlayerId]);


  const lastFiveGames = useMemo(() => {
    return selectedPlayerRows.slice(0, 5);
  }, [selectedPlayerRows]);

  useEffect(() => {
    setPregameOwnInjuries([]);
    setShowOwnInjuryPicker(false);
  }, [resolvedTeamId]);

  useEffect(() => {
    setPregameOpponentInjuries([]);
    setShowOpponentInjuryPicker(false);
  }, [selectedOpponentTeamId]);

  const benchmarks = useMemo<LeagueBenchmarks | null>(() => {
    if (!resolvedSeasonId || seasonPlayers.length === 0) return null;
    const raw = seasonPlayers.map(player => toRawStat(player, league, resolvedSeasonId));
    return buildLeagueBenchmarks(raw);
  }, [league, seasonPlayers, resolvedSeasonId]);

  const analysis = useMemo<PlayerAnalysis | null>(() => {
    if (!benchmarks || !selectedPlayer || !resolvedSeasonId) return null;
    const raw = selectedPlayerRows.length > 0
      ? toRawStatFromGameRows(selectedPlayer, selectedPlayerRows, league, resolvedSeasonId)
      : toRawStat(selectedPlayer, league, resolvedSeasonId);
    const normalized = normalizePlayerStats(raw);
    if (!isEligibleSample(normalized)) return null;
    return analyzePlayerSeason(raw, benchmarks);
  }, [benchmarks, league, resolvedSeasonId, selectedPlayer, selectedPlayerRows]);

  const rolesByPlayerId = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!benchmarks || !resolvedSeasonId) return map;
    seasonPlayers.forEach(player => {
      const raw = toRawStat(player, league, resolvedSeasonId);
      const normalized = normalizePlayerStats(raw);
      if (!isEligibleSample(normalized) && normalized.games < MIN_PREGAME_GAMES_FLOOR) {
        map.set(player.id, []);
        return;
      }
      const playerAnalysis = analyzePlayerSeason(raw, benchmarks);
      map.set(player.id, playerAnalysis.roles);
    });
    return map;
  }, [MIN_PREGAME_GAMES_FLOOR, benchmarks, league, resolvedSeasonId, seasonPlayers]);

  const displayIncomingValue = (field: IncomingField, value: number) => {
    if (focusedIncomingField !== field && (!Number.isFinite(value) || value === 0)) return '';
    if (!Number.isFinite(value)) return '';
    if (field === 'games') return Math.round(value);
    return round(value, 1).toFixed(1);
  };

  const handleIncomingNumberChange = (field: keyof IncomingPlayerInput, value: string) => {
    const numeric = Number(value);
    const normalized = Number.isFinite(numeric)
      ? field === 'games'
        ? Math.max(0, Math.round(numeric))
        : Math.max(0, round(numeric, 1))
      : 0;

    setIncomingPlayer(prev => ({
      ...prev,
      [field]: normalized,
    }));
  };

  const applyImportedIncomingPlayer = (imported: IncomingEurobasketPayload) => {
    setIncomingPlayer(prev => ({
      ...prev,
      name: imported.name || prev.name,
      position: imported.position ? mapPosition(imported.position) : prev.position,
      games: Math.max(0, Math.round(imported.games || 0)),
      minutesPerGame: imported.minutesPerGame || 0,
      pointsPerGame: imported.pointsPerGame || 0,
      assistsPerGame: imported.assistsPerGame || 0,
      orebPerGame: imported.orebPerGame || 0,
      drebPerGame: imported.drebPerGame || 0,
      valuationPerGame: imported.valuationPerGame || 0,
      twoPct: imported.twoPct || 0,
      twoAttemptedPerGame: imported.twoAttemptedPerGame || 0,
      threePct: imported.threePct || 0,
      threeAttemptedPerGame: imported.threeAttemptedPerGame || 0,
      ftPct: imported.ftPct || 0,
      ftAttemptedPerGame: imported.ftAttemptedPerGame || 0,
      turnoversPerGame: imported.turnoversPerGame || 0,
      stealsPerGame: imported.stealsPerGame || 0,
      blocksPerGame: imported.blocksPerGame || 0,
      foulsCommittedPerGame: imported.foulsCommittedPerGame || 0,
      foulsReceivedPerGame: imported.foulsReceivedPerGame || 0,
    }));

    setIncomingImportSource({ url: imported.sourceUrl, seasonYear: imported.seasonYearUsed });
    setIncomingImportCareer({
      currentTeam: imported.currentTeam,
      currentCountry: imported.currentCountry,
      currentCountryFlagUrl: imported.currentCountryFlagUrl,
      previousTeam: imported.previousTeam,
      previousCountry: imported.previousCountry,
      previousCountryFlagUrl: imported.previousCountryFlagUrl,
    });

    const fallbackNote = imported.usedFallbackSeason
      ? `Nem volt elérhető ${new Date().getFullYear() - 1}-es minta, ezért a profil legfrissebb publikus meccslogját használtam (${imported.gamesSampled} meccs).`
      : `${imported.seasonYearUsed}-es publikus meccslog alapján importálva (${imported.gamesSampled} meccs).`;

    setIncomingImportInfo(fallbackNote);
    setIncomingCandidates([]);
    setIncomingPhotoLoadFailed({});
  };

  const getCandidatePhotoSrc = (candidate: IncomingEurobasketCandidate) => {
    if (incomingPhotoLoadFailed[candidate.profileUrl]) return INCOMING_PLAYER_PLACEHOLDER;
    if (isUnavailableIncomingPhoto(candidate.photoUrl)) return INCOMING_PLAYER_PLACEHOLDER;
    return candidate.photoUrl as string;
  };

  const importIncomingPlayerFromEurobasket = async (forcedProfileUrl?: string) => {
    const name = incomingPlayer.name.trim();
    if (!name) {
      setIncomingImportError('Adj meg egy játékosnevet az Eurobasket importhoz.');
      setIncomingImportInfo(null);
      setIncomingImportCareer(null);
      return;
    }

    setIsImportingIncomingPlayer(true);
    setIncomingImportError(null);
    setIncomingImportInfo(null);
    setIncomingImportCareer(null);

    try {
      let selectedProfileUrl = forcedProfileUrl;

      if (!selectedProfileUrl) {
        const searchResponse = await fetch('/api/eurobasket-player-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'search', playerName: name, maxCandidates: 12 }),
        });

        const searchPayload = await searchResponse.json().catch(() => null) as
          | { ok: true; candidates: IncomingEurobasketCandidate[]; multiple: boolean }
          | { ok: false; error?: string }
          | null;

        if (!searchResponse.ok || !searchPayload || !('ok' in searchPayload) || !searchPayload.ok) {
          throw new Error((searchPayload && 'error' in searchPayload && searchPayload.error) || 'Nem sikerült játékost keresni Eurobasketen.');
        }

        if (!searchPayload.candidates || searchPayload.candidates.length === 0) {
          throw new Error('Nem találtam játékost erre a névre Eurobasketen.');
        }

        if (searchPayload.candidates.length > 1) {
          setIncomingCandidates(searchPayload.candidates);
          setIncomingPhotoLoadFailed({});
          setIncomingImportInfo('Több azonos nevű játékos található. Válaszd ki a megfelelőt a fotó alapján.');
          return;
        }

        selectedProfileUrl = searchPayload.candidates[0].profileUrl;
      }

      const response = await fetch('/api/eurobasket-player-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'import', playerName: name, profileUrl: selectedProfileUrl }),
      });

      const payload = await response.json().catch(() => null) as
        | { ok: true; player: IncomingEurobasketPayload }
        | { ok: false; error?: string; code?: string; candidates?: IncomingEurobasketCandidate[] }
        | null;

      if (!response.ok || !payload || !('ok' in payload) || !payload.ok) {
        if (payload && 'code' in payload && payload.code === 'MULTIPLE_MATCHES' && Array.isArray(payload.candidates)) {
          setIncomingCandidates(payload.candidates);
          setIncomingPhotoLoadFailed({});
          setIncomingImportInfo('Több azonos nevű játékos található. Válaszd ki a megfelelőt a fotó alapján.');
          return;
        }
        throw new Error((payload && 'error' in payload && payload.error) || 'Nem sikerült importálni a játékos statisztikát.');
      }

      applyImportedIncomingPlayer(payload.player);
    } catch (error) {
      setIncomingImportError(error instanceof Error ? error.message : 'Ismeretlen hiba történt az import során.');
      setIncomingImportSource(null);
      setIncomingImportCareer(null);
    } finally {
      setIsImportingIncomingPlayer(false);
    }
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
      positionLabel: incomingPlayer.position,
      positionBuckets: [incomingPlayer.position],
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
    const baseStats = buildTeamSeasonStats(seasonPlayers, league, resolvedSeasonId, allTeams, rolesByPlayerId);

    const playerToTeam = new Map<string, string>();
    seasonPlayers.forEach(player => {
      if (player.teamId) playerToTeam.set(player.id, player.teamId);
    });

    const gamePoints = new Map<string, Map<string, number>>();
    playerGameStats.forEach(row => {
      if (resolvedSeasonId && String(row.games?.season_id ?? '') !== String(resolvedSeasonId)) return;
      const teamId = row.players?.team_id ?? playerToTeam.get(row.player_id);
      if (!teamId) return;
      if (!gamePoints.has(row.game_id)) gamePoints.set(row.game_id, new Map());
      const byTeam = gamePoints.get(row.game_id)!;
      byTeam.set(teamId, (byTeam.get(teamId) ?? 0) + (row.points || 0));
    });

    const againstTotals = new Map<string, number>();
    gamePoints.forEach(teamMap => {
      const total = Array.from(teamMap.values()).reduce((sum, value) => sum + value, 0);
      teamMap.forEach((points, teamId) => {
        const against = total - points;
        againstTotals.set(teamId, (againstTotals.get(teamId) ?? 0) + against);
      });
    });

    if (againstTotals.size === 0) return baseStats;

    return baseStats.map(team => ({
      ...team,
      pointsAgainst: againstTotals.get(team.teamId) ?? team.pointsAgainst,
    }));
  }, [allTeams, league, playerGameStats, resolvedSeasonId, rolesByPlayerId, seasonPlayers]);

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

  const normalizedTeamStats = useMemo(() => {
    if (!selectedTeamStats) return null;
    return normalizeTeamStats(selectedTeamStats);
  }, [selectedTeamStats]);

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

  const pregameOwnInjuryNames = useMemo(() => {
    return pregameOwnInjuries
      .map(playerId => seasonPlayerMap.get(playerId)?.name)
      .filter((name): name is string => Boolean(name));
  }, [pregameOwnInjuries, seasonPlayerMap]);

  const pregameOpponentInjuryNames = useMemo(() => {
    return pregameOpponentInjuries
      .map(playerId => seasonPlayerMap.get(playerId)?.name)
      .filter((name): name is string => Boolean(name));
  }, [pregameOpponentInjuries, seasonPlayerMap]);

  const pregameInjuryContext = useMemo(() => {
    const hasOwn = pregameOwnInjuryNames.length > 0;
    const hasOpponent = pregameOpponentInjuryNames.length > 0;
    if (!hasOwn && !hasOpponent) return undefined;
    return {
      own: pregameOwnInjuryNames,
      opponent: pregameOpponentInjuryNames,
    };
  }, [pregameOpponentInjuryNames, pregameOwnInjuryNames]);

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

  const teamGamePlayerRows = useMemo(() => {
    const map = new Map<string, Map<string, GamePlayerStatRow[]>>();
    playerGameStats.forEach(row => {
      if (resolvedSeasonId && String(row.games?.season_id ?? '') !== String(resolvedSeasonId)) return;
      const teamId = row.players?.team_id ?? playerTeamMap.get(row.player_id);
      if (!teamId) return;
      if (!map.has(teamId)) map.set(teamId, new Map());
      const byGame = map.get(teamId)!;
      if (!byGame.has(row.game_id)) byGame.set(row.game_id, []);
      byGame.get(row.game_id)!.push(row);
    });
    return map;
  }, [playerGameStats, playerTeamMap, resolvedSeasonId]);

  const selectedGame = useMemo(() => {
    if (!selectedGameId) return null;
    return games.find(game => game.id === selectedGameId) || null;
  }, [games, selectedGameId]);

  type HeadToHeadGame = { ownGameId: string; opponentGameId: string | null; timestamp: number };

  const latestHeadToHeadGame = useMemo<HeadToHeadGame | null>(() => {
    if (!resolvedTeamId || resolvedTeamId === 'all' || !selectedOpponentTeamId) return null;
    const ownGames = teamGamePlayerRows.get(resolvedTeamId);
    if (!ownGames || ownGames.size === 0) return null;
    const opponentGames = teamGamePlayerRows.get(selectedOpponentTeamId);

    const rowsToTimestamp = (rows: GamePlayerStatRow[]) => {
      return rows.reduce((max, row) => {
        if (!row.games?.date) return max;
        const value = new Date(row.games.date).getTime();
        return Number.isFinite(value) && value > max ? value : max;
      }, 0);
    };

    const findOpponentGameIdByTimestamp = (target: number) => {
      if (!opponentGames || !target) return null;
      let bestGameId: string | null = null;
      let bestDelta = Number.POSITIVE_INFINITY;
      opponentGames.forEach((rows, gameId) => {
        if (!rows || rows.length === 0) return;
        const ts = rowsToTimestamp(rows);
        if (!ts) return;
        const delta = Math.abs(ts - target);
        const withinWindow = delta <= HEAD_TO_HEAD_MATCH_WINDOW_MS;
        if (withinWindow && delta < bestDelta) {
          bestGameId = gameId;
          bestDelta = delta;
        }
      });
      return bestGameId;
    };

    let latest: HeadToHeadGame | null = null;
    ownGames.forEach((rows, gameId) => {
      if (!rows || rows.length === 0) return;
      const pointsMap = gameTeamPoints.get(gameId);
      if (!pointsMap || !pointsMap.has(selectedOpponentTeamId)) return;
      const timestamp = rowsToTimestamp(rows);
      if (!timestamp) return;

      let opponentGameId: string | null = opponentGames?.has(gameId) ? gameId : null;
      if (!opponentGameId) {
        opponentGameId = findOpponentGameIdByTimestamp(timestamp);
      }

      if (!latest || timestamp > latest.timestamp) {
        latest = { ownGameId: gameId, opponentGameId, timestamp };
      }
    });

    return latest;
  }, [gameTeamPoints, resolvedTeamId, selectedOpponentTeamId, teamGamePlayerRows]);

  const selectedGameOpponentTeamId = useMemo(() => {
    if (!selectedGame) return null;
    const resolveFromGame = (gameId?: string | null) => {
      if (!gameId) return null;
      const byTeam = gameTeamPoints.get(gameId);
      if (!byTeam) return null;
      const candidate = Array.from(byTeam.keys()).find(id => id !== resolvedTeamId);
      return candidate ?? null;
    };
    return resolveFromGame(selectedGame.opponentGameId) ?? resolveFromGame(selectedGame.id);
  }, [gameTeamPoints, resolvedTeamId, selectedGame]);

  const shouldUseHistoricalPregameSnapshot = useMemo(() => {
    if (!selectedGame || !selectedOpponentTeamId || !selectedGameOpponentTeamId) return false;
    return selectedOpponentTeamId === selectedGameOpponentTeamId;
  }, [selectedGame, selectedGameOpponentTeamId, selectedOpponentTeamId]);

  const excludeOwnPregameGameId = shouldUseHistoricalPregameSnapshot
    ? selectedGame?.id ?? latestHeadToHeadGame?.ownGameId ?? null
    : latestHeadToHeadGame?.ownGameId ?? null;
  const excludeOpponentPregameGameId = shouldUseHistoricalPregameSnapshot
    ? selectedGame?.opponentGameId
        ?? selectedGame?.id
        ?? latestHeadToHeadGame?.opponentGameId
        ?? latestHeadToHeadGame?.ownGameId
        ?? null
    : latestHeadToHeadGame?.opponentGameId ?? latestHeadToHeadGame?.ownGameId ?? null;

  const currentTeamPlayerIds = useMemo(() => {
    const set = new Set<string>();
    currentTeamPlayers.forEach(player => set.add(player.id));
    return set;
  }, [currentTeamPlayers]);

  const teamPlayerRowsByGame = useMemo(() => {
    const map = new Map<string, GamePlayerStatRow[]>();
    if (!resolvedTeamId) return map;
    playerGameStats.forEach(row => {
      if (resolvedSeasonId && String(row.games?.season_id ?? '') !== String(resolvedSeasonId)) return;
      const belongsToTeam = row.players?.team_id === resolvedTeamId
        || currentTeamPlayerIds.has(row.player_id)
        || playerTeamMap.get(row.player_id) === resolvedTeamId;
      if (!belongsToTeam) return;
      if (!map.has(row.game_id)) map.set(row.game_id, []);
      map.get(row.game_id)!.push(row);
    });
    return map;
  }, [currentTeamPlayerIds, playerGameStats, playerTeamMap, resolvedSeasonId, resolvedTeamId]);

  const recentGameMetrics = useMemo(() => {
    if (!resolvedTeamId) return [];
    const sortedGames = [...games].sort((a, b) => {
      const aDate = a.date ? new Date(a.date).getTime() : 0;
      const bDate = b.date ? new Date(b.date).getTime() : 0;
      return bDate - aDate;
    });
    return sortedGames
      .slice(0, RECENT_GAMES_WINDOW)
      .map(game => {
        const rows = teamPlayerRowsByGame.get(game.id) ?? [];
        if (rows.length === 0) return null;
        return buildTeamGameMetrics(rows);
      })
      .filter((item): item is ReturnType<typeof buildTeamGameMetrics> => Boolean(item));
  }, [games, resolvedTeamId, teamPlayerRowsByGame]);

  const teamFormSeries = useMemo(() => {
    if (!resolvedTeamId) return [];
    const uniqueGamesMap = new Map<string, TeamGame>();
    games.forEach(game => {
      uniqueGamesMap.set(game.id, game);
    });
    const sortedGames = Array.from(uniqueGamesMap.values()).sort((a, b) => {
      const aDate = a.date ? new Date(a.date).getTime() : 0;
      const bDate = b.date ? new Date(b.date).getTime() : 0;
      return bDate - aDate;
    });

    return sortedGames.map(game => {
      const rows = teamPlayerRowsByGame.get(game.id) ?? [];
      const metrics = rows.length > 0 ? buildTeamGameMetrics(rows) : null;
      const pointsByTeam = gameTeamPoints.get(game.id);
      const derivedOurScore = typeof resolvedTeamId === 'string'
        ? pointsByTeam?.get(resolvedTeamId)
        : undefined;
      const ourScore = typeof game.ourScore === 'number' && Number.isFinite(game.ourScore) && game.ourScore > 0
        ? game.ourScore
        : typeof derivedOurScore === 'number'
          ? derivedOurScore
          : metrics?.points ?? null;
      let derivedOppScore: number | null = null;
      if (pointsByTeam && typeof derivedOurScore === 'number') {
        const totalPoints = Array.from(pointsByTeam.values()).reduce((sum, value) => sum + value, 0);
        derivedOppScore = totalPoints - derivedOurScore;
      }
      const oppScore = typeof game.oppScore === 'number' && Number.isFinite(game.oppScore) && game.oppScore > 0
        ? game.oppScore
        : derivedOppScore;
      const hasScores = typeof ourScore === 'number' && typeof oppScore === 'number';
      const margin = hasScores ? ourScore - oppScore : 0;
      const result = game.result
        ?? (hasScores ? (ourScore >= oppScore ? 'win' : 'loss') : 'loss');

      return {
        id: game.id,
        date: game.date,
        opponent: game.opponent,
        result,
        margin,
        ourScore: typeof ourScore === 'number' ? ourScore : 0,
        oppScore: typeof oppScore === 'number' ? oppScore : 0,
        efg: metrics?.efg ?? null,
        pace: metrics?.pace ?? null,
      };
    });
  }, [gameTeamPoints, games, resolvedTeamId, teamPlayerRowsByGame]);

  const teamFormSummary = useMemo(() => {
    if (!normalizedTeamStats || teamFormSeries.length === 0) return null;
    const windowGames = teamFormSeries.slice(0, TEAM_FORM_WINDOW);
    if (windowGames.length === 0) return null;
    const marginAvg = average(windowGames.map(item => item.margin));
    const seasonMarginFromGames = teamFormSeries.length > 0
      ? average(teamFormSeries.map(item => item.margin))
      : null;
    const seasonMargin = seasonMarginFromGames ?? (
      normalizedTeamStats.games > 0
        ? (normalizedTeamStats.pointsFor - normalizedTeamStats.pointsAgainst) / normalizedTeamStats.games
        : 0
    );
    const marginDelta = roundValue(marginAvg - seasonMargin, 1);

    const efgValues = windowGames
      .map(item => item.efg)
      .filter((value): value is number => Number.isFinite(value));
    const recentEfgAvg = efgValues.length > 0 ? roundValue(average(efgValues), 1) : null;
    const efgDelta = recentEfgAvg !== null ? roundValue(recentEfgAvg - normalizedTeamStats.efg, 1) : null;

    let status: 'up' | 'down' | 'flat' = 'flat';
    if (marginDelta >= TEAM_FORM_MARGIN_THRESHOLD || (efgDelta !== null && efgDelta >= TEAM_FORM_EFG_THRESHOLD)) {
      status = 'up';
    } else if (marginDelta <= -TEAM_FORM_MARGIN_THRESHOLD || (efgDelta !== null && efgDelta <= -TEAM_FORM_EFG_THRESHOLD)) {
      status = 'down';
    }

    const badgeLabel = status === 'up'
      ? 'Forma javul'
      : status === 'down'
        ? 'Forma romlik'
        : 'Forma stabil';
    const badgeClass = status === 'up'
      ? 'bg-emerald-600/20 text-emerald-200 border border-emerald-500/60'
      : status === 'down'
        ? 'bg-rose-600/20 text-rose-200 border border-rose-500/60'
        : 'bg-slate-800 text-slate-200 border border-slate-700';

    const descriptionParts = [
      `Pontkülönbség átlag: ${marginAvg >= 0 ? '+' : ''}${roundValue(marginAvg, 1)} (szezon: ${seasonMargin >= 0 ? '+' : ''}${roundValue(seasonMargin, 1)})`,
    ];
    if (recentEfgAvg !== null && efgDelta !== null) {
      descriptionParts.push(`eFG: ${recentEfgAvg.toFixed(1)}% (${efgDelta >= 0 ? '+' : ''}${efgDelta.toFixed(1)} pp)`);
    }

    return {
      badgeLabel,
      badgeClass,
      description: descriptionParts.join(' • '),
      windowSize: windowGames.length,
      seasonMargin: roundValue(seasonMargin, 1),
      marginAvg: roundValue(marginAvg, 1),
      marginDelta,
      seasonEfg: normalizedTeamStats.efg,
      recentEfgAvg,
      efgDelta,
    };
  }, [normalizedTeamStats, teamFormSeries]);

  const teamFormChartData = useMemo(() => {
    return teamFormSeries
      .slice(0, TEAM_FORM_CHART_POINTS)
      .reverse()
      .map(item => {
        const timestamp = item.date ? new Date(item.date).getTime() : 0;
        const label = timestamp
          ? new Date(timestamp).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })
          : 'Ismeretlen';
        return {
          label,
          margin: roundValue(item.margin, 1),
          efg: item.efg !== null ? roundValue(item.efg, 1) : null,
          opponent: item.opponent,
          result: item.result,
        };
      });
  }, [teamFormSeries]);

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

  const projectedStandings = useMemo(() => {
    if (standingsSnapshot.length === 0) return [] as ProjectionRow[];

    const teamNameById = new Map(allTeams.map(team => [team.id, team.name]));

    const teamMetrics = teamSeasonStats.map(team => {
      const gamesPlayed = Math.max(1, team.games || 0);
      const fga = (team.fga2 || 0) + (team.fga3 || 0);
      const fgm = (team.fgm2 || 0) + (team.fgm3 || 0);
      const possessions = Math.max(1, fga + 0.44 * (team.fta || 0) + (team.tov || 0));

      return {
        key: normalizeTeamKey(team.teamName),
        netRatingPerGame: ((team.pointsFor || 0) - (team.pointsAgainst || 0)) / gamesPlayed,
        efg: fga > 0 ? ((fgm + 0.5 * (team.fgm3 || 0)) / fga) * 100 : 0,
        astToTov: (team.ast || 0) / Math.max(1, team.tov || 0),
        reboundsPerGame: ((team.oreb || 0) + (team.dreb || 0)) / gamesPlayed,
        defensiveActivityPerGame: ((team.stl || 0) + (team.blk || 0)) / gamesPlayed,
        turnoverRate: (team.tov || 0) / possessions,
      };
    });

    const z = (value: number, values: number[]) => {
      if (values.length === 0) return 0;
      const mean = average(values);
      const sd = stdDev(values);
      if (!Number.isFinite(sd) || sd === 0) return 0;
      return (value - mean) / sd;
    };

    const netValues = teamMetrics.map(item => item.netRatingPerGame);
    const efgValues = teamMetrics.map(item => item.efg);
    const astToTovValues = teamMetrics.map(item => item.astToTov);
    const rebValues = teamMetrics.map(item => item.reboundsPerGame);
    const defActValues = teamMetrics.map(item => item.defensiveActivityPerGame);
    const tovRateValues = teamMetrics.map(item => item.turnoverRate);

    const statsByTeamKey = new Map(
      teamMetrics.map(metric => {
        const score =
          0.4 * z(metric.netRatingPerGame, netValues)
          + 0.2 * z(metric.efg, efgValues)
          + 0.15 * z(metric.astToTov, astToTovValues)
          + 0.1 * z(metric.reboundsPerGame, rebValues)
          + 0.1 * z(metric.defensiveActivityPerGame, defActValues)
          - 0.05 * z(metric.turnoverRate, tovRateValues);

        return [metric.key, score] as const;
      })
    );

    const projectionMap = new Map(
      standingsSnapshot.map(row => [
        normalizeTeamKey(row.team),
        {
          team: row.team,
          currentWins: row.wins,
          currentLosses: row.losses,
          projectedWins: row.wins,
          projectedLosses: row.losses,
          expectedExtraWins: 0,
          expectedFinalPoints: row.points,
          winProbabilitySum: 0,
          remainingGames: 0,
          certaintyAccumulator: 0,
          scored: row.scored,
          conceded: row.conceded,
        },
      ])
    );

    const today = new Date().toISOString().split('T')[0];
    const homeAdvantage = 0.22;

    seasonFixtures
      .filter(fixture => fixture.game_date >= today)
      .forEach(fixture => {
        const homeName = teamNameById.get(fixture.home_team_id);
        const awayName = teamNameById.get(fixture.away_team_id);
        if (!homeName || !awayName) return;

        const homeKey = normalizeTeamKey(homeName);
        const awayKey = normalizeTeamKey(awayName);
        const homeProjection = projectionMap.get(homeKey);
        const awayProjection = projectionMap.get(awayKey);
        if (!homeProjection || !awayProjection) return;

        const homeStrengthBase = statsByTeamKey.get(homeKey) ?? 0;
        const awayStrengthBase = statsByTeamKey.get(awayKey) ?? 0;
        const homeStanding = (homeProjection.currentWins + homeProjection.currentLosses) > 0
          ? homeProjection.currentWins / (homeProjection.currentWins + homeProjection.currentLosses)
          : 0.5;
        const awayStanding = (awayProjection.currentWins + awayProjection.currentLosses) > 0
          ? awayProjection.currentWins / (awayProjection.currentWins + awayProjection.currentLosses)
          : 0.5;

        const homeStrength = homeStrengthBase + (homeStanding - 0.5) * 0.8;
        const awayStrength = awayStrengthBase + (awayStanding - 0.5) * 0.8;
        const expectedStrengthDelta = (homeStrength - awayStrength) + homeAdvantage;
        const homeWinProbability = 1 / (1 + Math.exp(-expectedStrengthDelta / 0.85));
        const awayWinProbability = 1 - homeWinProbability;
        const certainty = Math.abs(homeWinProbability - 0.5) * 2;

        homeProjection.projectedWins += homeWinProbability;
        homeProjection.projectedLosses += awayWinProbability;
        homeProjection.expectedExtraWins += homeWinProbability;
        homeProjection.expectedFinalPoints += homeWinProbability * 2;
        homeProjection.winProbabilitySum += homeWinProbability;
        homeProjection.remainingGames += 1;
        homeProjection.certaintyAccumulator += certainty;

        awayProjection.projectedWins += awayWinProbability;
        awayProjection.projectedLosses += homeWinProbability;
        awayProjection.expectedExtraWins += awayWinProbability;
        awayProjection.expectedFinalPoints += awayWinProbability * 2;
        awayProjection.winProbabilitySum += awayWinProbability;
        awayProjection.remainingGames += 1;
        awayProjection.certaintyAccumulator += certainty;
      });

    return Array.from(projectionMap.values())
      .sort((a, b) => {
        if (b.projectedWins !== a.projectedWins) return b.projectedWins - a.projectedWins;
        return (b.scored - b.conceded) - (a.scored - a.conceded);
      })
      .map(item => ({
        avgWinProbability: item.remainingGames > 0 ? item.winProbabilitySum / item.remainingGames : 0.5,
        certaintyScore: item.remainingGames > 0 ? item.certaintyAccumulator / item.remainingGames : 0,
        certaintyLabel:
          (item.remainingGames > 0 ? item.certaintyAccumulator / item.remainingGames : 0) >= 0.38
            ? 'Magas'
            : (item.remainingGames > 0 ? item.certaintyAccumulator / item.remainingGames : 0) >= 0.22
              ? 'Közepes'
              : 'Alacsony',
        team: item.team,
        currentWins: item.currentWins,
        currentLosses: item.currentLosses,
        projectedWins: item.projectedWins,
        projectedLosses: item.projectedLosses,
        expectedExtraWins: item.expectedExtraWins,
        expectedFinalPoints: item.expectedFinalPoints,
      }));
  }, [allTeams, seasonFixtures, standingsSnapshot, teamSeasonStats]);

  const projectionContext = useMemo(() => {
    if (projectedStandings.length === 0 || !resolvedTeamId || resolvedTeamId === 'all') return null;
    const selectedTeamName = allTeams.find(team => team.id === resolvedTeamId)?.name;
    if (!selectedTeamName) return null;
    const selectedTeamKey = normalizeTeamKey(selectedTeamName);
    const selectedTeamProjection = projectedStandings.find(row => normalizeTeamKey(row.team) === selectedTeamKey);
    const seed = projectedStandings.findIndex(row => normalizeTeamKey(row.team) === selectedTeamKey) + 1;
    if (seed <= 0) return null;

    const playoffOpponentSeed = seed >= 1 && seed <= 8 ? 9 - seed : null;
    const playoffOpponent = playoffOpponentSeed
      ? projectedStandings[playoffOpponentSeed - 1]?.team ?? null
      : null;

    return {
      seed,
      playoffOpponentSeed,
      playoffOpponent,
      certaintyLabel: selectedTeamProjection?.certaintyLabel ?? 'Alacsony',
      avgWinProbability: selectedTeamProjection?.avgWinProbability ?? 0.5,
    };
  }, [allTeams, projectedStandings, resolvedTeamId]);

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
    return (
      teamId: string,
      options?: {
        excludeGameId?: string | null;
      }
    ): PregameTeamSeasonStat | null => {
      if (!teamId || teamId === 'all') return null;
      const meta = teamSeasonStats.find(team => team.teamId === teamId);
      if (!meta) return null;
      const recentGameIds = recentGameIdsByTeam.get(teamId) ?? [];
      const excludeGameId = options?.excludeGameId ?? null;
      const filteredRecentIds = excludeGameId
        ? recentGameIds.filter(id => id !== excludeGameId)
        : recentGameIds;
      if (filteredRecentIds.length < MIN_RECENT_GAMES_TEAM) return null;
      const recentGameSet = new Set(filteredRecentIds);

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
      filteredRecentIds.forEach(gameId => {
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
    let recentSnapshot: PregameTeamSeasonStat | null = null;
    if (useRecentFormPregame) {
      recentSnapshot = buildRecentTeamStat(resolvedTeamId, {
        excludeGameId: excludeOwnPregameGameId,
      });
    }

    const fallbackSeason = selectedTeamStats
      ? {
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
        }
      : null;

    let base = recentSnapshot ?? fallbackSeason;
    if (!base) return null;

    const shouldAdjustSeasonAggregate = Boolean(
      excludeOwnPregameGameId && (!useRecentFormPregame || !recentSnapshot)
    );

    if (shouldAdjustSeasonAggregate) {
      base = subtractGameFromTeamAggregate(
        base,
        resolvedTeamId,
        excludeOwnPregameGameId,
        teamGamePlayerRows,
        gameTeamPoints
      );
    }

    return base;
  }, [
    buildRecentTeamStat,
    excludeOwnPregameGameId,
    gameTeamPoints,
    resolvedTeamId,
    selectedTeamStats,
    teamGamePlayerRows,
    useRecentFormPregame,
  ]);

  const pregameOpponentTeam = useMemo<PregameTeamSeasonStat | null>(() => {
    if (!selectedOpponentTeamId || selectedOpponentTeamId === resolvedTeamId) return null;

    let recentSnapshot: PregameTeamSeasonStat | null = null;
    if (useRecentFormPregame) {
      recentSnapshot = buildRecentTeamStat(selectedOpponentTeamId, {
        excludeGameId: excludeOpponentPregameGameId,
      }) ?? null;
    }

    const seasonAggregate = teamSeasonStats.find(team => team.teamId === selectedOpponentTeamId);
    const fallbackSeason = seasonAggregate
      ? {
          teamId: seasonAggregate.teamId,
          teamName: seasonAggregate.teamName,
          league: seasonAggregate.league,
          season: seasonAggregate.season,
          games: seasonAggregate.games,
          pointsFor: seasonAggregate.pointsFor,
          pointsAgainst: seasonAggregate.pointsAgainst,
          fga2: seasonAggregate.fga2,
          fgm2: seasonAggregate.fgm2,
          fga3: seasonAggregate.fga3,
          fgm3: seasonAggregate.fgm3,
          fta: seasonAggregate.fta,
          ftm: seasonAggregate.ftm,
          oreb: seasonAggregate.oreb,
          dreb: seasonAggregate.dreb,
          ast: seasonAggregate.ast,
          tov: seasonAggregate.tov,
          stl: seasonAggregate.stl,
          blk: seasonAggregate.blk,
          fouls: seasonAggregate.fouls,
          val: seasonAggregate.val,
        }
      : null;

    let base = recentSnapshot ?? fallbackSeason;
    if (!base) return null;

    const shouldAdjustSeasonAggregate = Boolean(
      excludeOpponentPregameGameId && (!useRecentFormPregame || !recentSnapshot)
    );

    if (shouldAdjustSeasonAggregate) {
      base = subtractGameFromTeamAggregate(
        base,
        selectedOpponentTeamId,
        excludeOpponentPregameGameId,
        teamGamePlayerRows,
        gameTeamPoints
      );
    }

    return base;
  }, [
    buildRecentTeamStat,
    excludeOpponentPregameGameId,
    gameTeamPoints,
    resolvedTeamId,
    selectedOpponentTeamId,
    teamGamePlayerRows,
    teamSeasonStats,
    useRecentFormPregame,
  ]);

  const pregameOpponentPlayers = useMemo<PlayerSeasonStat[]>(() => {
    if (!selectedOpponentTeamId) return [];
    const injurySet = new Set(pregameOpponentInjuries);

    const excludeGameId = shouldUseHistoricalPregameSnapshot ? excludeOpponentPregameGameId : null;

    const buildFromSeason = () =>
      subtractGameFromPlayerAggregates(
        activeSeasonPlayers
        .filter(player => player.teamId === selectedOpponentTeamId)
        .filter(player => hasSampleForPregame(player.gamesPlayed || 0, MIN_PREGAME_GAMES, MIN_PREGAME_GAMES_FLOOR))
        .map(player => {
          const positionInfo = mapPositionInfo(player.position);
          return {
            playerId: player.id,
            name: player.name,
            ...positionInfo,
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
          };
        }),
        selectedOpponentTeamId,
        excludeGameId,
        teamGamePlayerRows
      )
        .filter(player => hasSampleForPregame(player.games || 0, MIN_PREGAME_GAMES, MIN_PREGAME_GAMES_FLOOR))
        .filter(player => !injurySet.has(player.playerId));

    if (!useRecentFormPregame) return buildFromSeason();

    const recentGameIds = recentGameIdsByTeam.get(selectedOpponentTeamId) ?? [];
    const filteredRecentIds = excludeGameId
      ? recentGameIds.filter(id => id !== excludeGameId)
      : recentGameIds;
    if (filteredRecentIds.length < MIN_RECENT_GAMES_TEAM) return buildFromSeason();
    const recentGameSet = new Set(filteredRecentIds);
    const statsMap = new Map<string, PlayerSeasonStat>();
    const gamesMap = new Map<string, Set<string>>();

    playerGameStats.forEach(row => {
      if (!recentGameSet.has(row.game_id)) return;
      const teamId = row.players?.team_id ?? playerTeamMap.get(row.player_id);
      if (teamId !== selectedOpponentTeamId) return;
      if (seasonPlayerMap.get(row.player_id)?.isActive === false) return;

      const positionInfo = mapPositionInfo(seasonPlayerMap.get(row.player_id)?.position ?? undefined);
      const base = statsMap.get(row.player_id) ?? {
        playerId: row.player_id,
        name: seasonPlayerMap.get(row.player_id)?.name ?? row.player_id,
        ...positionInfo,
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
      .filter(player => hasSampleForPregame(player.games || 0, MIN_PREGAME_GAMES, MIN_PREGAME_GAMES_FLOOR))
      .filter(player => seasonPlayerMap.get(player.playerId)?.isActive !== false)
      .filter(player => !injurySet.has(player.playerId));
  }, [
    MIN_PREGAME_GAMES,
    MIN_PREGAME_GAMES_FLOOR,
    MIN_RECENT_GAMES_TEAM,
    activeSeasonPlayers,
    excludeOpponentPregameGameId,
    pregameOpponentInjuries,
    playerGameStats,
    playerTeamMap,
    recentGameIdsByTeam,
    rolesByPlayerId,
    seasonPlayerMap,
    selectedOpponentTeamId,
    shouldUseHistoricalPregameSnapshot,
    teamGamePlayerRows,
    useRecentFormPregame,
  ]);

  const pregameOwnPlayers = useMemo<PlayerSeasonStat[]>(() => {
    if (!resolvedTeamId || resolvedTeamId === 'all') return [];
    const injurySet = new Set(pregameOwnInjuries);

    const excludeGameId = shouldUseHistoricalPregameSnapshot ? excludeOwnPregameGameId : null;

    const buildFromSeason = () =>
      subtractGameFromPlayerAggregates(
        activeSeasonPlayers
        .filter(player => player.teamId === resolvedTeamId)
        .filter(player => hasSampleForPregame(player.gamesPlayed || 0, MIN_PREGAME_GAMES, MIN_PREGAME_GAMES_FLOOR))
        .map(player => {
          const positionInfo = mapPositionInfo(player.position);
          return {
            playerId: player.id,
            name: player.name,
            ...positionInfo,
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
          };
        }),
        resolvedTeamId,
        excludeGameId,
        teamGamePlayerRows
      )
        .filter(player => hasSampleForPregame(player.games || 0, MIN_PREGAME_GAMES, MIN_PREGAME_GAMES_FLOOR))
        .filter(player => !injurySet.has(player.playerId));

    if (!useRecentFormPregame) return buildFromSeason();

    const recentGameIds = recentGameIdsByTeam.get(resolvedTeamId) ?? [];
    const filteredRecentIds = excludeGameId
      ? recentGameIds.filter(id => id !== excludeGameId)
      : recentGameIds;
    if (filteredRecentIds.length < MIN_RECENT_GAMES_TEAM) return buildFromSeason();
    const recentGameSet = new Set(filteredRecentIds);
    const statsMap = new Map<string, PlayerSeasonStat>();
    const gamesMap = new Map<string, Set<string>>();

    playerGameStats.forEach(row => {
      if (!recentGameSet.has(row.game_id)) return;
      const teamId = row.players?.team_id ?? playerTeamMap.get(row.player_id);
      if (teamId !== resolvedTeamId) return;
      if (seasonPlayerMap.get(row.player_id)?.isActive === false) return;

      const positionInfo = mapPositionInfo(seasonPlayerMap.get(row.player_id)?.position ?? undefined);
      const base = statsMap.get(row.player_id) ?? {
        playerId: row.player_id,
        name: seasonPlayerMap.get(row.player_id)?.name ?? row.player_id,
        ...positionInfo,
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
      .filter(player => hasSampleForPregame(player.games || 0, MIN_PREGAME_GAMES, MIN_PREGAME_GAMES_FLOOR))
      .filter(player => seasonPlayerMap.get(player.playerId)?.isActive !== false)
      .filter(player => !injurySet.has(player.playerId));
  }, [
    MIN_PREGAME_GAMES,
    MIN_PREGAME_GAMES_FLOOR,
    MIN_RECENT_GAMES_TEAM,
    activeSeasonPlayers,
    excludeOwnPregameGameId,
    pregameOwnInjuries,
    playerGameStats,
    playerTeamMap,
    recentGameIdsByTeam,
    resolvedTeamId,
    rolesByPlayerId,
    seasonPlayerMap,
    shouldUseHistoricalPregameSnapshot,
    teamGamePlayerRows,
    useRecentFormPregame,
  ]);

  const pregameReport = useMemo(() => {
    if (!pregameBenchmarks || !pregameOwnTeam || !pregameOpponentTeam) return null;
    if (pregameOpponentPlayers.length === 0) return null;
    return analyzePreGameScouting(
      pregameOpponentTeam,
      pregameOpponentPlayers,
      pregameOwnTeam,
      pregameBenchmarks,
      pregameOwnPlayers,
      pregameInjuryContext
    );
  }, [
    pregameBenchmarks,
    pregameInjuryContext,
    pregameOpponentPlayers,
    pregameOpponentTeam,
    pregameOwnPlayers,
    pregameOwnTeam,
  ]);

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

    teamGame.actualPointsFor = selectedGame.ourScore;
    teamGame.actualPointsAgainst = selectedGame.oppScore;
    teamGame.result = selectedGame.result;

    if (opponentGame) {
      opponentGame.actualPointsFor = selectedGame.oppScore;
      opponentGame.actualPointsAgainst = selectedGame.ourScore;
      opponentGame.result = selectedGame.result === 'win' ? 'loss' : 'win';
    }

    const players: PlayerGameStat[] = teamPlayers.map(row => {
      const seasonPlayer = seasonPlayers.find(player => String(player.id) === String(row.player_id));
      const fallbackName = row.players?.name?.trim();

      return {
        playerId: row.player_id,
        name: seasonPlayer?.name || fallbackName || row.player_id,
        position: mapPosition(seasonPlayer?.position || 'PG'),
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
      };
    });

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

    const normalizedOpponentName = selectedGame.opponent?.toLowerCase() ?? '';
    const alignedXFactorContext =
      pregameReport && pregameReport.opponentTeamName.toLowerCase() === normalizedOpponentName
        ? pregameReport.xFactorContext
        : undefined;

    return analyzePostGameReport(teamGame, opponentGame, seasonStats, postgameBenchmarks, players, alignedXFactorContext);
  }, [currentTeamPlayerIds, league, playerGameStats, playerTeamMap, postgameBenchmarks, pregameReport, rolesByPlayerId, seasonPlayers, selectedGame, resolvedTeamId, selectedTeamStats]);

  const decisiveFactorGroups = useMemo(() => {
    if (!postgameReport) return [] as Array<{ key: string; axis: 'offense' | 'defense'; type: string; label: string; items: string[] }>;
    const grouped = new Map<string, { key: string; axis: 'offense' | 'defense'; type: string; items: string[] }>();
    postgameReport.decisiveFactorMeta.forEach(factor => {
      const key = `${factor.axis}-${factor.type}`;
      if (!grouped.has(key)) {
        grouped.set(key, { key, axis: factor.axis, type: factor.type, items: [] });
      }
      grouped.get(key)!.items.push(factor.label);
    });
    return Array.from(grouped.values()).map(group => ({
      ...group,
      label: `${group.axis === 'offense' ? 'Támadás' : 'Védekezés'} – ${group.type}`,
    }));
  }, [postgameReport]);

  const canLookupPregameByTeams = Boolean(
    selectedOpponentTeamId &&
    resolvedTeamId &&
    resolvedTeamId !== 'all'
  );

  useEffect(() => {
    if (selectedGameId || canLookupPregameByTeams) return;
    setPregameText('');
    setPregameTextError(null);
    setPregameTextMeta({});
    setPregameSaveStatus(null);
  }, [canLookupPregameByTeams, selectedGameId]);

  useEffect(() => {
    let isMounted = true;

    const loadPregameNarrative = async () => {
      if (!selectedGameId && !canLookupPregameByTeams) {
        if (!isMounted) return;
        setPregameText('');
        setPregameTextError(null);
        return;
      }

      setPregameTextError(null);

      try {
        let query = supabase
          .from('game_text_reports')
          .select('narrative, generated_at, generated_by')
          .eq('report_type', 'pregame');
        let usedTeamMatch = false;

        if (selectedGameId) {
          query = query.eq('game_id', selectedGameId);
        } else if (canLookupPregameByTeams && resolvedTeamId && resolvedTeamId !== 'all' && selectedOpponentTeamId) {
          usedTeamMatch = true;
          query = query
            .eq('own_team_id', resolvedTeamId)
            .eq('opponent_team_id', selectedOpponentTeamId);

          if (resolvedSeasonId) {
            query = query.filter('pregame_snapshot->>season', 'eq', resolvedSeasonId);
          }

          if (league) {
            query = query.filter('pregame_snapshot->>league', 'eq', league);
          }
        } else if (selectedOpponentTeamId) {
          query = query.filter('pregame_snapshot->>opponentTeamId', 'eq', selectedOpponentTeamId);

          if (resolvedSeasonId) {
            query = query.filter('pregame_snapshot->>season', 'eq', resolvedSeasonId);
          }

          if (league) {
            query = query.filter('pregame_snapshot->>league', 'eq', league);
          }
        }

        const { data, error } = await query
          .order('generated_at', { ascending: false })
          .limit(1);

        let finalData = data?.[0] ?? null;
        let finalError = error ?? null;

        if (!finalData && !finalError && usedTeamMatch && selectedOpponentTeamId) {
          let legacyQuery = supabase
            .from('game_text_reports')
            .select('narrative, generated_at, generated_by')
            .eq('report_type', 'pregame')
            .filter('pregame_snapshot->>opponentTeamId', 'eq', selectedOpponentTeamId);

          if (resolvedSeasonId) {
            legacyQuery = legacyQuery.filter('pregame_snapshot->>season', 'eq', resolvedSeasonId);
          }

          if (league) {
            legacyQuery = legacyQuery.filter('pregame_snapshot->>league', 'eq', league);
          }

          const legacyResult = await legacyQuery
            .order('generated_at', { ascending: false })
            .limit(1);

          finalData = legacyResult.data?.[0] ?? null;
          finalError = legacyResult.error ?? null;
        }

        if (!isMounted) return;

        if (finalError) {
          setPregameText('');
          setPregameTextError('Nem sikerült betölteni a pre-game elemzést.');
          setPregameTextMeta({});
          setPregameSaveStatus(null);
          return;
        }

        setPregameText(finalData?.narrative ?? '');
        setPregameTextMeta(
          finalData
            ? { generatedAt: finalData.generated_at, generatedBy: finalData.generated_by }
            : {}
        );
      } catch {
        if (!isMounted) return;
        setPregameText('');
        setPregameTextError('Nem sikerült betölteni a pre-game elemzést.');
        setPregameTextMeta({});
        setPregameSaveStatus(null);
      }
    };

    loadPregameNarrative();

    return () => {
      isMounted = false;
    };
  }, [canLookupPregameByTeams, league, resolvedSeasonId, resolvedTeamId, selectedGameId, selectedOpponentTeamId]);

  useEffect(() => {
    let isMounted = true;

    const loadReport = async () => {
      if (!selectedGameId) {
        if (!isMounted) return;
        setTextReport('');
        setTextReportMeta({});
        setTextReportError(null);
        setIsLoadingTextReport(false);
        return;
      }

      setIsLoadingTextReport(true);
      setTextReportError(null);

      try {
        const { data, error } = await supabase
          .from('game_text_reports')
          .select('narrative, generated_at, generated_by')
          .eq('game_id', selectedGameId)
          .eq('report_type', 'combined')
          .maybeSingle();

        if (!isMounted) return;

        if (error && error.code !== 'PGRST116') {
          setTextReport('');
          setTextReportMeta({});
          setTextReportError('Nem sikerült betölteni a szöveges elemzést.');
          return;
        }

        if (data) {
          setTextReport(data.narrative ?? '');
          setTextReportMeta({ generatedAt: data.generated_at, generatedBy: data.generated_by });
        } else {
          setTextReport('');
          setTextReportMeta({});
        }
      } catch {
        if (!isMounted) return;
        setTextReport('');
        setTextReportMeta({});
        setTextReportError('Nem sikerült betölteni a szöveges elemzést.');
      } finally {
        if (isMounted) {
          setIsLoadingTextReport(false);
        }
      }
    };

    loadReport();

    return () => {
      isMounted = false;
    };
  }, [selectedGameId]);

  const canGenerateTextReport = Boolean(selectedGame && pregameReport && postgameReport);

  const canGeneratePregameText = Boolean(pregameReport);
  const hasPregameLookupTarget = Boolean(selectedGameId || canLookupPregameByTeams);

  useEffect(() => {
    setPregameSaveStatus(null);
  }, [selectedGameId, selectedOpponentTeamId]);

  useEffect(() => {
    setExpandedPlayerImpactId(null);
    setPlayerNarratives({});
  }, [selectedGameId]);

  const handleGeneratePregameText = async () => {
    if (!pregameReport) return;

    const opponentLabel = pregameOpponentTeam?.teamName ?? pregameReport.opponentTeamName ?? 'ellenfél';
    const confirmed = window.confirm(
      `Biztosan lefuttatod a ${opponentLabel} elleni pre-game GPT értékelést? A meglévő szöveg felülíródhat.`
    );
    if (!confirmed) {
      return;
    }
    setIsGeneratingPregameText(true);
    setPregameTextError(null);
    setPregameSaveStatus(null);
    try {
      const ownTeamIdPayload =
        resolvedTeamId && resolvedTeamId !== 'all'
          ? resolvedTeamId
          : pregameReport.ownTeamId ?? null;
      const ownTeamNamePayload =
        pregameOwnTeam?.teamName ?? pregameReport.ownTeamName ?? 'Saját csapat';
      const opponentTeamIdPayload = selectedOpponentTeamId || pregameReport.opponentTeamId;
      const opponentTeamNamePayload =
        pregameOpponentTeam?.teamName ?? pregameReport.opponentTeamName;

      const response = await fetch('/api/generate-pregame-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: selectedGame?.id ?? selectedGameId ?? null,
          pregameReport,
          ownTeamId: ownTeamIdPayload,
          ownTeamName: ownTeamNamePayload,
          opponentTeamId: opponentTeamIdPayload,
          opponentTeamName: opponentTeamNamePayload,
          generatedBy: 'season-comparison-ui',
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        narrative?: string;
        report?: GameTextReportRow | null;
        saveStatus?: { saved?: boolean; message?: string } | null;
        error?: string;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? 'A pre-game szöveges elemzés nem sikerült.');
      }

      setPregameText(payload.narrative ?? '');
      if (payload.report) {
        setPregameTextMeta({
          generatedAt: payload.report.generated_at,
          generatedBy: payload.report.generated_by,
        });
      } else {
        setPregameTextMeta({});
      }

      if (payload.saveStatus?.message) {
        setPregameSaveStatus({
          type: payload.saveStatus.saved ? 'success' : 'warning',
          message: payload.saveStatus.message,
        });
      } else {
        setPregameSaveStatus(
          payload.report
            ? { type: 'success', message: 'Pre-game jelentés elmentve.' }
            : {
                type: 'warning',
                message: 'Nem történt mentés, mert nem volt kiválasztott meccs (gameId).',
              }
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ismeretlen hiba történt a generálás során.';
      setPregameTextError(message);
      setPregameSaveStatus({ type: 'error', message: `Mentés meghiúsult: ${message}` });
    } finally {
      setIsGeneratingPregameText(false);
    }
  };

  const handleGenerateTextReport = async () => {
    if (!selectedGame || !pregameReport || !postgameReport) return;
    setIsGeneratingTextReport(true);
    setTextReportError(null);
    try {
      const response = await fetch('/api/generate-game-text-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: selectedGame.id,
          opponentName: selectedGame.opponent,
          reportType: 'combined',
          pregameReport,
          postgameReport,
          generatedBy: 'season-comparison-ui',
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        narrative?: string;
        report?: GameTextReportRow;
        error?: string;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? 'A szöveges elemzés generálása nem sikerült.');
      }

      const narrative = payload.narrative ?? payload.report?.narrative ?? '';
      setTextReport(narrative);
      setTextReportMeta({
        generatedAt: payload.report?.generated_at ?? new Date().toISOString(),
        generatedBy: payload.report?.generated_by ?? 'gpt-automata',
      });
    } catch (error) {
      setTextReportError(error instanceof Error ? error.message : 'Ismeretlen hiba történt a generálás során.');
    } finally {
      setIsGeneratingTextReport(false);
    }
  };

  const handleTogglePlayerDetail = (playerId: string) => {
    setExpandedPlayerImpactId(current => (current === playerId ? null : playerId));
  };

  const handleGeneratePlayerNarrative = async (playerId: string) => {
    if (!postgameReport?.playerReport) return;
    const targetPlayer = postgameReport.playerReport.players.find(player => player.playerId === playerId);
    if (!targetPlayer) return;

    setPlayerNarratives(prev => ({
      ...prev,
      [playerId]: { status: 'loading' },
    }));

    try {
      const response = await fetch('/api/generate-player-postgame-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: selectedGame?.id ?? selectedGameId ?? null,
          playerId: targetPlayer.playerId,
          playerName: targetPlayer.name,
          teamName: postgameReport.teamName,
          opponentName: postgameReport.opponentName,
          result: postgameReport.result,
          report: targetPlayer,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        narrative?: string;
        generatedAt?: string;
        error?: string;
      };

      if (!response.ok || !payload.ok || !payload.narrative) {
        throw new Error(payload.error ?? 'A játékos posztmeccses értékelés generálása nem sikerült.');
      }

      setPlayerNarratives(prev => ({
        ...prev,
        [playerId]: {
          status: 'success',
          text: payload.narrative,
          generatedAt: payload.generatedAt,
        },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ismeretlen hiba történt.';
      setPlayerNarratives(prev => ({
        ...prev,
        [playerId]: {
          status: 'error',
          error: message,
        },
      }));
    }
  };

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

  const showPlayerSection = activeSection === 'player';
  const showTeamSection = activeSection === 'team';
  const showPregameSection = activeSection === 'pregame';
  const showPostgameSection = activeSection === 'postgame';
  const showProjectionSection = activeSection === 'projection';

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
                <SelectContent className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-400">
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
                <SelectContent className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-400">
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
                <SelectContent className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-400">
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

      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'player', label: 'Játékos' },
              { key: 'team', label: 'Csapat' },
              { key: 'pregame', label: 'Pre-game' },
              { key: 'postgame', label: 'Post-game' },
              { key: 'projection', label: 'Előrejelzés' },
            ].map(item => (
              <Button
                key={item.key}
                type="button"
                size="sm"
                variant={activeSection === item.key ? 'default' : 'outline'}
                className={
                  activeSection === item.key
                    ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                    : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                }
                onClick={() => setActiveSection(item.key as typeof activeSection)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {showPlayerSection && selectedPlayer && !analysis && (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6 text-sm text-slate-300">
            A kiválasztott játékos nem felel meg a minimum mintaszűrésnek.
          </CardContent>
        </Card>
      )}

      {showPlayerSection && analysis && selectedPlayer && (
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
                  <span className="text-slate-400">Szerep biztonság: {(analysis.roleConfidence * 100).toFixed(0)}%</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-50">Képesség pontszámok</CardTitle>
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

            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-50">Összegzett értékelés</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2 text-slate-200">
                  <div className="text-slate-300 font-medium">Erősségek</div>
                  {analysis.strengths.length > 0 ? (
                    <ul className="list-disc list-inside space-y-1 text-pretty leading-relaxed">
                      {analysis.strengths.map(item => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-slate-400">Nincs kiemelt erősség.</div>
                  )}
                </div>
                <div className="space-y-2 text-slate-200">
                  <div className="text-slate-300 font-medium">Limitációk</div>
                  {analysis.limitations.length > 0 ? (
                    <ul className="list-disc list-inside space-y-1 text-pretty leading-relaxed">
                      {analysis.limitations.map(item => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-slate-400">Nincs kiemelt limitáció.</div>
                  )}
                </div>
                <div className="space-y-2 text-slate-200">
                  <div className="text-slate-300 font-medium">Javítandó pontok</div>
                  {analysis.improvements.length > 0 ? (
                    <ul className="list-disc list-inside space-y-1 text-pretty leading-relaxed">
                      {analysis.improvements.map(item => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-slate-400">Nincs kiemelt javítandó pont.</div>
                  )}
                </div>
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

      {showTeamSection && <Card className="bg-slate-900 border-slate-800">
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

              {teamFormSummary && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <div className="text-sm text-slate-300 font-medium">
                      Forma trend (utolsó {teamFormSummary.windowSize} meccs)
                    </div>
                    <Badge className={teamFormSummary.badgeClass}>{teamFormSummary.badgeLabel}</Badge>
                    <div className="text-sm text-slate-200">{teamFormSummary.description}</div>
                    <div className="text-xs text-slate-400">
                      Pontkülönbség: {teamFormSummary.marginAvg >= 0 ? '+' : ''}{teamFormSummary.marginAvg.toFixed(1)} • Szezon: {teamFormSummary.seasonMargin >= 0 ? '+' : ''}{teamFormSummary.seasonMargin.toFixed(1)}
                    </div>
                    {teamFormSummary.recentEfgAvg !== null && teamFormSummary.efgDelta !== null && (
                      <div className="text-xs text-slate-400">
                        eFG: {teamFormSummary.recentEfgAvg.toFixed(1)}% ({teamFormSummary.efgDelta >= 0 ? '+' : ''}{teamFormSummary.efgDelta.toFixed(1)} pp)
                      </div>
                    )}
                  </div>
                  <div className="lg:col-span-2">
                    <div className="h-56 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                      {teamFormChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={teamFormChartData} margin={{ left: 8, right: 16 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                            <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                            <YAxis yAxisId="margin" stroke="#f97316" tick={{ fontSize: 11 }} width={48} />
                            <YAxis
                              yAxisId="efg"
                              orientation="right"
                              stroke="#22d3ee"
                              tickFormatter={value => `${value}%`}
                              tick={{ fontSize: 11 }}
                              width={56}
                            />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (!active || !payload || payload.length === 0) return null;
                                const datum = payload[0]?.payload as {
                                  label: string;
                                  opponent: string;
                                  margin: number;
                                  efg: number | null;
                                  result: 'win' | 'loss';
                                };
                                if (!datum) return null;
                                return (
                                  <div className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 space-y-1">
                                    <div className="font-semibold text-slate-50">
                                      {datum.label} • {datum.opponent}
                                    </div>
                                    <div>
                                      Eredmény: {datum.result === 'win' ? 'Győzelem' : 'Vereség'} ({datum.margin >= 0 ? '+' : ''}{datum.margin})
                                    </div>
                                    {typeof datum.efg === 'number' && (
                                      <div>eFG: {datum.efg.toFixed(1)}%</div>
                                    )}
                                  </div>
                                );
                              }}
                            />
                            <Line
                              yAxisId="margin"
                              type="monotone"
                              dataKey="margin"
                              stroke="#f97316"
                              strokeWidth={2}
                              dot={{ r: 3 }}
                              name="Pontkülönbség"
                            />
                            <Line
                              yAxisId="efg"
                              type="monotone"
                              dataKey="efg"
                              stroke="#22d3ee"
                              strokeWidth={2}
                              dot={{ r: 3 }}
                              name="eFG%"
                              connectNulls
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="text-sm text-slate-400">Nincs trend adat.</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-sm text-slate-300 font-medium">Erősségek</div>
                  {displayTeamAnalysis.strengths.length > 0 ? (
                    <ul className="list-disc list-inside space-y-1 text-sm text-slate-200 text-pretty leading-relaxed">
                      {displayTeamAnalysis.strengths.map(item => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm text-slate-400">Nincs kiemelt erősség.</div>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-slate-300 font-medium">Limitációk</div>
                  {displayTeamAnalysis.limitations.length > 0 ? (
                    <ul className="list-disc list-inside space-y-1 text-sm text-slate-200 text-pretty leading-relaxed">
                      {displayTeamAnalysis.limitations.map(item => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
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
                  {(Object.entries(displayTeamAnalysis.rosterSummary.positionMinutesShare) as Array<[Position, number]>)
                    .map(([pos, share]) => ({
                      pos,
                      share,
                      label: getPositionLabel(pos),
                      players: displayTeamAnalysis.rosterSummary.positionPlayers[pos] ?? [],
                    }))
                    .map(({ pos, share, label, players }) => (
                      <div key={pos} className="text-sm text-slate-200 space-y-0.5">
                        <div>
                          {label}: {share.toFixed(1)}%
                        </div>
                        {players.length > 0 && (
                          <div className="text-xs text-slate-400">
                            {players.slice(0, 4).join(', ')}
                            {players.length > 4 ? '…' : ''}
                          </div>
                        )}
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
                      <div key={role} className="text-sm text-slate-200 space-y-0.5">
                        <div>
                          {count >= 3
                            ? `${role}: redundáns (${count}) – rotációs előny, de szerepütközés lehetséges`
                            : count === 0
                              ? `${role}: hiány – taktikai opció nem elérhető`
                              : `${role}: ${count}`}
                        </div>
                        {(() => {
                          const playerNames = displayTeamAnalysis.rosterSummary.rolePlayers[role] ?? [];
                          if (playerNames.length === 0 && (rolePlayersByRole.get(role)?.length ?? 0) === 0) return null;
                          const inferredNames = playerNames.length > 0
                            ? playerNames
                            : rolePlayersByRole.get(role) ?? [];
                          if (inferredNames.length === 0) return null;
                          return (
                            <div className="text-xs text-slate-400">
                              {inferredNames.slice(0, 4).join(', ')}
                              {inferredNames.length > 4 ? '…' : ''}
                            </div>
                          );
                        })()}
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
      </Card>}

      {showProjectionSection && <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-slate-50">Várható alapszakasz végeredmény (modell)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {projectedStandings.length === 0 ? (
            <div className="space-y-2">
              <div className="text-sm text-slate-300">
                Az előrejelzéshez nincs elérhető tabella snapshot a kiválasztott szezonhoz.
              </div>
              <div className="text-xs text-slate-400">
                Importálj tabellát a Tabella fülön a jelenlegi szezonhoz, majd futtasd a menetrend importot az Import fülön.
              </div>
            </div>
          ) : (
            <>
              {usedLegacyStandingsFallback && (
                <div className="rounded-md border border-amber-700/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
                  Legacy tabella snapshot került felhasználásra (season_id nélküli rekord). Érdemes a szezonhoz kötött tabellát újraimportálni.
                </div>
              )}

              {projectionContext && (
                <div className="rounded-lg border border-cyan-700/40 bg-cyan-950/20 px-4 py-3 text-sm text-cyan-100">
                  <div>
                    Várható helyezés: <span className="font-semibold">{projectionContext.seed}. hely</span>
                  </div>
                  <div className="mt-1 text-cyan-200">
                    Hátralévő meccsek átlagos győzelmi esélye: {(projectionContext.avgWinProbability * 100).toFixed(1)}% •
                    Bizonyosság: {projectionContext.certaintyLabel}
                  </div>
                  {projectionContext.playoffOpponent && projectionContext.playoffOpponentSeed && (
                    <div className="mt-1 text-cyan-200">
                      Lehetséges playoff párharc: {projectionContext.seed}. vs {projectionContext.playoffOpponentSeed}. (
                      {projectionContext.playoffOpponent})
                    </div>
                  )}
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400">
                      <th className="text-left py-2 pr-2">#</th>
                      <th className="text-left py-2 pr-2">Csapat</th>
                      <th className="text-right py-2 pr-2">Jelenlegi</th>
                      <th className="text-right py-2 pr-2">Proj. W</th>
                      <th className="text-right py-2 pr-2">Proj. L</th>
                      <th className="text-right py-2 pr-2">Átl. W%</th>
                      <th className="text-right py-2">Plusz győz.</th>
                      <th className="text-right py-2">Bizonyosság</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectedStandings.slice(0, 14).map((row, index) => {
                      const isTop8 = index < 8;
                      const isSelectedTeam = resolvedTeamId !== 'all'
                        && normalizeTeamKey(row.team)
                          === normalizeTeamKey(allTeams.find(team => team.id === resolvedTeamId)?.name ?? '');

                      return (
                        <tr
                          key={row.team}
                          className={`border-b border-slate-800 ${isSelectedTeam ? 'bg-sky-900/20' : ''}`}
                        >
                          <td className="py-2 pr-2 text-slate-200">
                            <span className={isTop8 ? 'text-emerald-300 font-semibold' : 'text-slate-300'}>{index + 1}</span>
                          </td>
                          <td className="py-2 pr-2 text-slate-100">{row.team}</td>
                          <td className="py-2 pr-2 text-right text-slate-300">
                            {row.currentWins}-{row.currentLosses}
                          </td>
                          <td className="py-2 pr-2 text-right text-slate-100">{row.projectedWins.toFixed(1)}</td>
                          <td className="py-2 pr-2 text-right text-slate-100">{row.projectedLosses.toFixed(1)}</td>
                          <td className="py-2 pr-2 text-right text-slate-300">{(row.avgWinProbability * 100).toFixed(1)}%</td>
                          <td className="py-2 text-right text-cyan-300">+{row.expectedExtraWins.toFixed(1)}</td>
                          <td
                            className={`py-2 text-right ${
                              row.certaintyLabel === 'Magas'
                                ? 'text-emerald-300'
                                : row.certaintyLabel === 'Közepes'
                                  ? 'text-amber-300'
                                  : 'text-slate-400'
                            }`}
                          >
                            {row.certaintyLabel}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="text-xs text-slate-400">
                A modell a jelenlegi tabellaállásból indul, és a hátralévő meccsekre várható győzelmi valószínűséget számol
                csapat-erősség (pontkülönbség/meccs) és hazai pálya alapján.
              </div>
            </>
          )}
        </CardContent>
      </Card>}

      {showPregameSection && <Card className="bg-slate-900 border-slate-800">
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
                <SelectContent className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-400">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm text-slate-400">Saját sérültek / kihagyók</label>
                <Button
                  type="button"
                  size="sm"
                  variant={showOwnInjuryPicker ? 'default' : 'outline'}
                  disabled={pregameOwnRosterOptions.length === 0}
                  onClick={() => setShowOwnInjuryPicker(value => !value)}
                  className={showOwnInjuryPicker
                    ? 'bg-rose-700 hover:bg-rose-600 text-white'
                    : 'border-slate-700 text-slate-300 hover:bg-slate-800'}
                >
                  {showOwnInjuryPicker ? 'Kész' : 'Sérültlista szerkesztése'}
                </Button>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {pregameOwnRosterOptions.length === 0
                  ? 'Válaszd ki a csapatot a lista betöltéséhez.'
                  : pregameOwnInjuryNames.length > 0
                    ? `Megjelölve: ${pregameOwnInjuryNames.join(', ')}`
                    : 'Jelöld ki a hiányzókat (nem számítjuk őket az elemzésben).'}
              </div>
              {showOwnInjuryPicker && pregameOwnRosterOptions.length > 0 && (
                <>
                  <div className="max-h-32 overflow-y-auto rounded-md border border-slate-800/70 bg-slate-900/70 p-2 flex flex-wrap gap-2 mt-2">
                    {pregameOwnRosterOptions.map(player => {
                      const isSelected = pregameOwnInjuries.includes(player.id);
                      return (
                        <button
                          type="button"
                          key={player.id}
                          onClick={() => handleToggleOwnInjury(player.id)}
                          className={`text-xs px-2 py-1 rounded-md border transition focus:outline-none focus:ring-2 focus:ring-slate-500 ${
                            isSelected
                              ? 'bg-rose-900/40 border-rose-700 text-rose-100'
                              : 'bg-slate-900/40 border-slate-700 text-slate-200 hover:border-slate-500'
                          }`}
                          aria-pressed={isSelected}
                        >
                          {player.name}
                          <span className="text-[10px] text-slate-400 ml-1">
                            ({POSITION_LABELS[player.position] ?? player.position})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Válassz ki minden hiányzót, majd zárd a panelt a &quot;Kész&quot; gombbal.
                  </div>
                </>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm text-slate-400">Ellenfél sérültek</label>
                <Button
                  type="button"
                  size="sm"
                  variant={showOpponentInjuryPicker ? 'default' : 'outline'}
                  disabled={pregameOpponentRosterOptions.length === 0}
                  onClick={() => setShowOpponentInjuryPicker(value => !value)}
                  className={showOpponentInjuryPicker
                    ? 'bg-rose-700 hover:bg-rose-600 text-white'
                    : 'border-slate-700 text-slate-300 hover:bg-slate-800'}
                >
                  {showOpponentInjuryPicker ? 'Kész' : 'Sérültlista szerkesztése'}
                </Button>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {pregameOpponentRosterOptions.length === 0
                  ? 'Válassz ellenfelet a lista szerkesztéséhez.'
                  : pregameOpponentInjuryNames.length > 0
                    ? `Megjelölve: ${pregameOpponentInjuryNames.join(', ')}`
                    : 'Add meg, kik hiányozhatnak az ellenféltől.'}
              </div>
              {showOpponentInjuryPicker && pregameOpponentRosterOptions.length > 0 && (
                <>
                  <div className="max-h-32 overflow-y-auto rounded-md border border-slate-800/70 bg-slate-900/70 p-2 flex flex-wrap gap-2 mt-2">
                    {pregameOpponentRosterOptions.map(player => {
                      const isSelected = pregameOpponentInjuries.includes(player.id);
                      return (
                        <button
                          type="button"
                          key={player.id}
                          onClick={() => handleToggleOpponentInjury(player.id)}
                          className={`text-xs px-2 py-1 rounded-md border transition focus:outline-none focus:ring-2 focus:ring-slate-500 ${
                            isSelected
                              ? 'bg-rose-900/40 border-rose-700 text-rose-100'
                              : 'bg-slate-900/40 border-slate-700 text-slate-200 hover:border-slate-500'
                          }`}
                          aria-pressed={isSelected}
                        >
                          {player.name}
                          <span className="text-[10px] text-slate-400 ml-1">
                            ({POSITION_LABELS[player.position] ?? player.position})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    A jelöltek nem kerülnek bele a matchup elemzésbe és a GPT jelentésbe; zárd vissza a panelt a &quot;Kész&quot; gombbal.
                  </div>
                </>
              )}
            </div>
          </div>

          {!selectedOpponentTeamId && (
            <div className="text-sm text-slate-300">Válassz ellenfelet a pre-game jelentéshez.</div>
          )}

          {selectedOpponentTeamId && !pregameReport && (
            <div className="text-sm text-slate-300">Nincs elég adat a pre-game scoutinghoz.</div>
          )}

          {pregameReport && (() => {
            const ownLabel = pregameOwnTeam?.teamName ?? pregameReport.ownTeamName ?? 'Saját csapat';
            const opponentLabel = pregameReport.opponentTeamName;
            const predictedWinner = pregameReport.winProbability.predictedWinner;
            const favoredTeamLabel = predictedWinner === 'even'
              ? 'Kiegyenlített'
              : predictedWinner === 'own'
                ? ownLabel
                : opponentLabel;
            const favoredPct = predictedWinner === 'even'
              ? 50
              : predictedWinner === 'own'
                ? pregameReport.winProbability.ownPct
                : pregameReport.winProbability.opponentPct;
            const probabilitySpread = predictedWinner === 'even'
              ? '50-50'
              : `${pregameReport.winProbability.ownPct.toFixed(1)}% - ${pregameReport.winProbability.opponentPct.toFixed(1)}%`;
            const probabilityConfidenceLabel = favoredPct >= 55 && favoredPct <= 60
              ? 'Közepes–alacsony'
              : pregameReport.winProbability.confidence === 'High'
                ? 'Magas'
                : pregameReport.winProbability.confidence === 'Medium'
                  ? 'Közepes'
                  : 'Alacsony';
            const riskFlags = pregameReport.riskFlags ?? [];
            const ownProfile = pregameReport.ownTeamProfile;
            const opponentProfile = pregameReport.profile;
            const llmContext = pregameReport.llmContext;
            const axisLabelMap: Record<'transition' | 'periméter' | 'festék', string> = {
              transition: 'átmeneti játék',
              periméter: 'periméter',
              festék: 'festék',
            };
            const formatDelta = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}`;

            return (
              <div className="space-y-4">
                <div className="p-3 bg-slate-800/50 rounded-lg">
                  <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 mb-1">
                    <span>Elemzés nézőpontja: {ownLabel}</span>
                    <span>Ellenfél: {opponentLabel}</span>
                  </div>
                  <div className="text-sm text-slate-300 font-medium mb-2">Statisztikai esélyek (modell)</div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-emerald-300">
                      {ownLabel}: {pregameReport.winProbability.ownPct.toFixed(1)}%
                    </span>
                    <span className="text-slate-400">vs</span>
                    <span className="text-orange-300">
                      {opponentLabel}: {pregameReport.winProbability.opponentPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${pregameReport.winProbability.ownPct}%` }}
                    />
                  </div>
                  <div className="text-xs text-slate-400 mt-2">
                    Eredmény-prognózis: {favoredTeamLabel} • Valószínűség: {probabilitySpread} • Bizonyosság: {probabilityConfidenceLabel}
                  </div>
                </div>

                <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">{pregameReport.summary}</div>

                {(ownProfile || opponentProfile || llmContext) && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {(ownProfile || opponentProfile) && (
                      <div className="p-3 bg-slate-800/50 rounded-lg space-y-3">
                        <div className="text-sm text-slate-300 font-medium">Játékstílus összevetés</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <div className="flex items-center justify-between text-xs text-slate-400">
                              <span>{ownLabel}</span>
                              <span>Tempó: {ownProfile?.tempo ?? 'n.a.'}</span>
                            </div>
                            {ownProfile ? (
                              <div className="mt-2 space-y-2 text-sm">
                                <div>
                                  <div className="text-[11px] uppercase tracking-wide text-slate-500">Támadás</div>
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {ownProfile.offense.length > 0 ? (
                                      ownProfile.offense.map(item => (
                                        <Badge
                                          key={`own-offense-${item}`}
                                          className="bg-sky-600/20 text-sky-200 border border-sky-700/40"
                                        >
                                          {item}
                                        </Badge>
                                      ))
                                    ) : (
                                      <span className="text-xs text-slate-500">Nincs adat</span>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[11px] uppercase tracking-wide text-slate-500">Védekezés</div>
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {ownProfile.defense.length > 0 ? (
                                      ownProfile.defense.map(item => (
                                        <Badge
                                          key={`own-defense-${item}`}
                                          className="bg-emerald-600/20 text-emerald-200 border border-emerald-700/40"
                                        >
                                          {item}
                                        </Badge>
                                      ))
                                    ) : (
                                      <span className="text-xs text-slate-500">Nincs adat</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-2 text-xs text-slate-500">Ehhez a csapathoz még nincs profil adat.</div>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center justify-between text-xs text-slate-400">
                              <span>{opponentLabel}</span>
                              <span>Tempó: {opponentProfile?.tempo ?? 'n.a.'}</span>
                            </div>
                            {opponentProfile ? (
                              <div className="mt-2 space-y-2 text-sm">
                                <div>
                                  <div className="text-[11px] uppercase tracking-wide text-slate-500">Támadás</div>
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {opponentProfile.offense.length > 0 ? (
                                      opponentProfile.offense.map(item => (
                                        <Badge
                                          key={`opp-offense-${item}`}
                                          className="bg-orange-600/20 text-orange-200 border border-orange-700/40"
                                        >
                                          {item}
                                        </Badge>
                                      ))
                                    ) : (
                                      <span className="text-xs text-slate-500">Nincs adat</span>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[11px] uppercase tracking-wide text-slate-500">Védekezés</div>
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {opponentProfile.defense.length > 0 ? (
                                      opponentProfile.defense.map(item => (
                                        <Badge
                                          key={`opp-defense-${item}`}
                                          className="bg-emerald-600/20 text-emerald-200 border border-emerald-700/40"
                                        >
                                          {item}
                                        </Badge>
                                      ))
                                    ) : (
                                      <span className="text-xs text-slate-500">Nincs adat</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-2 text-xs text-slate-500">Ehhez az ellenfélhez nincs profil adat.</div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    {llmContext && (
                      <div className="p-3 bg-slate-800/50 rounded-lg space-y-2">
                        <div className="text-sm text-slate-300 font-medium">LLM bemeneti kontextus</div>
                        <div className="text-xs text-slate-400">
                          Tempó: {ownLabel} → {llmContext.ownTempoDescriptor}, {opponentLabel} → {llmContext.opponentTempoDescriptor}
                        </div>
                        <div className="text-xs text-slate-400">
                          Domináns tengely (ellenfél): {axisLabelMap[llmContext.opponentDominantAxis] ?? llmContext.opponentDominantAxis}
                        </div>
                        {llmContext.varianceDrivers.length > 0 ? (
                          <div className="text-xs text-slate-400">
                            Varianciát okozó tényezők: <span className="text-slate-200">{llmContext.varianceDrivers.join(' + ')}</span>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500">Nincs kiemelt variancia-forrás.</div>
                        )}
                        {llmContext.tempoControlNote && (
                          <div className="text-xs text-amber-200">{llmContext.tempoControlNote}</div>
                        )}
                        {llmContext.matchupRealizationNote && (
                          <div className="text-xs text-amber-200">{llmContext.matchupRealizationNote}</div>
                        )}
                        {llmContext.riskNote && (
                          <div className="text-xs text-rose-200">{llmContext.riskNote}</div>
                        )}
                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                          <div className="bg-slate-900/40 border border-slate-800 rounded-md px-2 py-1">
                            <div className="text-[10px] uppercase tracking-wide text-slate-500">Periméter delta</div>
                            <div className="font-mono text-sm">
                              {formatDelta(llmContext.positionDeltaSummary.perimeterDelta)} VAL/36
                            </div>
                          </div>
                          <div className="bg-slate-900/40 border border-slate-800 rounded-md px-2 py-1">
                            <div className="text-[10px] uppercase tracking-wide text-slate-500">Belső poszt delta</div>
                            <div className="font-mono text-sm">
                              {formatDelta(llmContext.positionDeltaSummary.frontcourtDelta)} VAL/36
                            </div>
                          </div>
                        </div>
                        {llmContext.significantMatchups.length > 0 && (
                          <div className="pt-1">
                            <div className="text-xs text-slate-400 font-medium">Jelentős párosítások</div>
                            <div className="mt-1 space-y-1">
                              {llmContext.significantMatchups.map(item => (
                                <div
                                  key={item.position}
                                  className="flex items-center justify-between bg-slate-900/40 border border-slate-800 rounded-md px-2 py-1"
                                >
                                  <span className="text-slate-200">{POSITION_LABELS[item.position] ?? item.position}</span>
                                  <span className={item.deltaValPer36 >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                                    {formatDelta(item.deltaValPer36)} VAL/36
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

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
                          const deltaLabel = `${item.deltaValPer36 >= 0 ? '+' : ''}${item.deltaValPer36.toFixed(1)} VAL/36`;
                          let tone = 'text-slate-400';
                          let label = `Kiegyenlített (${deltaLabel})`;
                          let container = 'bg-slate-900/40 border border-slate-800';

                          if (item.matchupFlag === 'critical_disadvantage') {
                            tone = 'text-rose-300';
                            label = `Kritikus hátrány (${deltaLabel})`;
                            container = 'bg-rose-950/40 border border-rose-800/60';
                          } else if (item.matchupFlag === 'clear_advantage') {
                            tone = 'text-emerald-300';
                            label = `Egyértelmű előny (${deltaLabel})`;
                            container = 'bg-emerald-950/30 border border-emerald-800/50';
                          } else if (item.deltaValPer36 >= 2) {
                            tone = 'text-emerald-400';
                            label = `Saját előny (${deltaLabel})`;
                          } else if (item.deltaValPer36 <= -2) {
                            tone = 'text-rose-400';
                            label = `Ellenfél előny (${deltaLabel})`;
                          }

                          return (
                            <div
                              key={item.position}
                              className={`${container} flex items-center justify-between rounded-md px-3 py-2`}
                            >
                              <span className="text-slate-200">{item.label}</span>
                              <span className={tone}>{label}</span>
                            </div>
                          );
                        })}
                      </div>

                      {pregameReport.positionComparisonNote && (
                        <div className="mt-3 text-xs text-amber-200 bg-amber-900/20 border border-amber-700/40 rounded-md px-3 py-2">
                          {pregameReport.positionComparisonNote}
                        </div>
                      )}
                    </>
                  );
                })()}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-slate-300 font-medium mb-2">Fő veszélyek</div>
                    {pregameReport.threats.length > 0 ? (
                      pregameReport.threats.map(item => <div key={item} className="text-sm text-slate-200">• {item}</div>)
                    ) : (
                      <div className="text-sm text-slate-400">Kiegyensúlyozott fegyvertár, extrém veszély nélkül.</div>
                    )}
                  </div>
                  <div>
                    <div className="text-sm text-slate-300 font-medium mb-2">Feltételes sebezhetőségek (ellenfél)</div>
                    {pregameReport.vulnerabilities.length > 0 ? (
                      pregameReport.vulnerabilities.map(item => <div key={item} className="text-sm text-slate-200">• {item}</div>)
                    ) : (
                      <div className="text-sm text-slate-400">Matchupfüggő, rendszerszintű rés nem látszik.</div>
                    )}
                  </div>
                  <div>
                    <div className="text-sm text-slate-300 font-medium mb-2">Saját kockázati pontok</div>
                    {riskFlags.length > 0 ? (
                      riskFlags.map(item => <div key={item} className="text-sm text-slate-200">• {item}</div>)
                    ) : (
                      <div className="text-sm text-slate-400">
                        Általános faultterhelés- és lepattanó-kontroll figyelmeztetés, konkrét riasztás nélkül.
                      </div>
                    )}
                  </div>
                </div>

                {(pregameReport.injuryContext?.own?.length || pregameReport.injuryContext?.opponent?.length) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-slate-300 font-medium mb-2">Saját sérültek</div>
                      {pregameReport.injuryContext?.own?.length ? (
                        pregameReport.injuryContext.own.map(name => (
                          <div key={`own-injury-${name}`} className="text-sm text-slate-200">
                            • {name}
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-slate-400">Nincs megjelölt kihagyó.</div>
                      )}
                    </div>
                    <div>
                      <div className="text-sm text-slate-300 font-medium mb-2">Ellenfél sérültek</div>
                      {pregameReport.injuryContext?.opponent?.length ? (
                        pregameReport.injuryContext.opponent.map(name => (
                          <div key={`opp-injury-${name}`} className="text-sm text-slate-200">
                            • {name}
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-slate-400">Nincs megjelölt kihagyó.</div>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-slate-300 font-medium mb-2">Kulcsjátékosok</div>
                    <div className="text-sm text-slate-200">Pontfelelősök: {pregameReport.keyPlayers.primaryScorers.join(', ') || '-'}</div>
                    <div className="text-sm text-slate-200">Elsődleges szervezők: {pregameReport.keyPlayers.primaryPlaymakers.join(', ') || '-'}</div>
                    <div className="text-sm text-slate-200">Stretch fenyegetések: {pregameReport.keyPlayers.stretchThreats.join(', ') || '-'}</div>
                    <div className="text-sm text-slate-200">Mismatch jelöltek: {pregameReport.keyPlayers.mismatchCandidates.join(', ') || '-'}</div>
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

                <div className="border-t border-slate-800 pt-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        type="button"
                        onClick={handleGeneratePregameText}
                        disabled={!canGeneratePregameText || isGeneratingPregameText}
                        className="bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-60"
                      >
                        {isGeneratingPregameText ? 'Pre-game értékelés készítése…' : 'Pre-game GPT értékelés'}
                      </Button>
                      <div className="text-xs text-slate-400">
                        Szigorúan adat-alapú, 6–10 mondatos összefoglaló készül.
                      </div>
                    </div>
                    {pregameSaveStatus && (
                      <div
                        className={`text-xs ${
                          pregameSaveStatus.type === 'success'
                            ? 'text-emerald-400'
                            : pregameSaveStatus.type === 'warning'
                              ? 'text-amber-300'
                              : 'text-rose-300'
                        }`}
                      >
                        {pregameSaveStatus.message}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="border-t border-slate-800 pt-4 space-y-3">
            <div className="text-sm text-slate-300 font-medium">Mentett pre-game jelentés</div>

            {!hasPregameLookupTarget && (
              <div className="text-sm text-slate-400">
                Válassz meccset vagy ellenfelet a mentett pre-game szöveg megjelenítéséhez.
              </div>
            )}

            {hasPregameLookupTarget && pregameTextError && (
              <div className="text-sm text-rose-300 bg-rose-900/30 border border-rose-800 rounded-md px-3 py-2">
                {pregameTextError}
              </div>
            )}

            {hasPregameLookupTarget && !pregameTextError && !pregameText && (
              <div className="text-sm text-slate-400">
                Nincs mentett pre-game szöveges értékelés a kiválasztott meccshez vagy ellenfélhez.
              </div>
            )}

            {hasPregameLookupTarget && pregameText && (
              <div className="space-y-1">
                <div className="text-xs text-slate-400">
                  {pregameTextMeta.generatedAt ? (
                    <>
                      Mentve: {formatGeneratedAt(pregameTextMeta.generatedAt) ?? 'ismeretlen időpont'} • Forrás:{' '}
                      {pregameTextMeta.generatedBy ?? 'gpt-automata'}
                    </>
                  ) : (
                    'Ez a szöveg még nincs adatbázisban mentve.'
                  )}
                </div>
                <div className="text-sm text-slate-50 whitespace-pre-line bg-slate-800/60 border border-slate-700 rounded-lg px-4 py-3">
                  {pregameText}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>}

      {showPostgameSection && <Card className="bg-slate-900 border-slate-800">
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
                <SelectContent className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-400">
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

              {(postgameReport.reflection.xFactor || postgameReport.reflection.risk) && (
                <div className="text-xs text-amber-200 space-y-1">
                  {postgameReport.reflection.xFactor && (
                    <div className="font-medium">{postgameReport.reflection.xFactor}</div>
                  )}
                  {postgameReport.reflection.risk && (
                    <div className="text-slate-400">{postgameReport.reflection.risk}</div>
                  )}
                </div>
              )}

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
                  {decisiveFactorGroups.length > 0 ? (
                    <div className="space-y-3">
                      {decisiveFactorGroups.map(group => (
                        <div
                          key={group.key}
                          className="rounded-lg border border-slate-800 bg-linear-to-r from-slate-900/60 to-slate-800/30 p-3"
                        >
                          <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-400">
                            <span>{group.label}</span>
                            <span className={group.axis === 'offense' ? 'text-orange-300' : 'text-cyan-300'}>
                              {group.axis === 'offense' ? '⚡' : '🛡️'}
                            </span>
                          </div>
                          <ul className="mt-2 space-y-1">
                            {group.items.map(label => {
                              const isNegative = isNegativeDecisiveLabel(label, group.axis);
                              const toneClass = isNegative ? 'text-rose-300' : 'text-emerald-300';
                              const icon = isNegative ? '🔻' : '▲';
                              return (
                                <li key={label} className="flex items-start gap-2 text-sm text-slate-100">
                                  <span className={`${toneClass} text-xs mt-0.5`}>{icon}</span>
                                  <span>{label}</span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
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

              {postgameReport.playerReport && (
                <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm text-slate-300 font-medium">Játékos post-game elemzés</div>
                    <div className="text-xs text-slate-500">Usage% és TS% perc-normalizált • kattints a sorokra a részletekért</div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {(() => {
                      const highlightCards = [
                        {
                          key: 'mvp',
                          title: 'Meccs motor',
                          player: postgameReport.playerReport.highlights.mvp,
                          classes: 'bg-emerald-950/30 border border-emerald-800/40',
                          fallback: 'Nincs kiemelt motor ezen a meccsen.',
                        },
                        {
                          key: 'engines',
                          title: 'Stabil alappillérek',
                          player: postgameReport.playerReport.highlights.engines[0],
                          classes: 'bg-sky-950/30 border border-sky-800/40',
                          fallback: 'Nincs stabil másodlagos motor.',
                        },
                        {
                          key: 'spark',
                          title: 'Padlóról érkező szikra',
                          player: postgameReport.playerReport.highlights.sparkPlugs[0],
                          classes: 'bg-amber-950/30 border border-amber-800/40',
                          fallback: 'Nem volt kiugró spark plug.',
                        },
                      ];
                      return highlightCards.map(card => (
                        <div key={card.key} className={`rounded-lg p-3 text-sm text-slate-200 ${card.classes}`}>
                          <div className="text-[11px] uppercase tracking-wide text-slate-500">{card.title}</div>
                          {card.player ? (
                            <>
                              <div className="text-base font-semibold text-slate-50">{card.player.name}</div>
                              <div className="text-xs text-slate-300">{card.player.summaryLine}</div>
                              <div className="text-[11px] text-slate-400 mt-1">{card.player.impactLabel}</div>
                            </>
                          ) : (
                            <div className="text-xs text-slate-500">{card.fallback}</div>
                          )}
                        </div>
                      ));
                    })()}
                  </div>
                  <div className="space-y-2">
                    {postgameReport.playerReport.players.map(player => {
                      const isExpanded = expandedPlayerImpactId === player.playerId;
                      const narrativeState = playerNarratives[player.playerId];
                      return (
                        <div key={player.playerId} className="rounded-lg border border-slate-800 bg-slate-900/30">
                          <button
                            type="button"
                            onClick={() => handleTogglePlayerDetail(player.playerId)}
                            className="w-full px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-left"
                          >
                            <div>
                              <div className="text-sm text-slate-200 font-medium">{player.name}</div>
                              <div className="text-xs text-slate-400">{player.summaryLine}</div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="px-2 py-1 rounded-full bg-slate-800 text-slate-200">{player.impactLabel}</span>
                              <span className="px-2 py-1 rounded-full bg-slate-800 text-slate-200">{player.usageLabel}</span>
                              <span className="text-slate-500">TS {player.tsPct.toFixed(1)}%</span>
                              <span className="text-slate-500">VAL {player.val}</span>
                              <span className="text-slate-500">VAL/36 {player.valPer36.toFixed(1)}</span>
                            </div>
                          </button>
                          {isExpanded && (
                            <div className="border-t border-slate-800 px-3 py-3 space-y-3">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-300">
                                <div>
                                  <div className="text-[11px] uppercase tracking-wide text-slate-500">Erősségek</div>
                                  {player.strengths.length > 0 ? (
                                    player.strengths.map(item => <div key={item}>• {item}</div>)
                                  ) : (
                                    <div className="text-slate-500">Nincs kiemelt erősség.</div>
                                  )}
                                </div>
                                <div>
                                  <div className="text-[11px] uppercase tracking-wide text-slate-500">Limitációk</div>
                                  {player.issues.length > 0 ? (
                                    player.issues.map(item => <div key={item}>• {item}</div>)
                                  ) : (
                                    <div className="text-slate-500">Stabil végrehajtás.</div>
                                  )}
                                </div>
                                <div>
                                  <div className="text-[11px] uppercase tracking-wide text-slate-500">Fókusz</div>
                                  {player.focus.length > 0 ? (
                                    player.focus.map(item => <div key={item}>• {item}</div>)
                                  ) : (
                                    <div className="text-slate-500">Fenntartandó teljesítmény.</div>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleGeneratePlayerNarrative(player.playerId)}
                                  disabled={narrativeState?.status === 'loading'}
                                  className="bg-slate-800 text-slate-100 border-slate-700 hover:bg-slate-700"
                                >
                                  {narrativeState?.status === 'loading'
                                    ? 'LLM értékelés készül…'
                                    : 'LLM szöveges értékelés'}
                                </Button>
                                {narrativeState?.generatedAt && (
                                  <span>Mentve: {formatGeneratedAt(narrativeState.generatedAt) ?? 'friss'}</span>
                                )}
                                {narrativeState?.status === 'error' && (
                                  <span className="text-rose-300">{narrativeState.error}</span>
                                )}
                              </div>
                              {narrativeState?.text && (
                                <div className="text-sm text-slate-100 whitespace-pre-line bg-slate-900/60 border border-slate-800 rounded-md px-3 py-2">
                                  {narrativeState.text}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

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
      </Card>}

      {showPostgameSection && <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-slate-50">Szöveges mérkőzés-elemzés (GPT)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={handleGenerateTextReport}
              disabled={!canGenerateTextReport || isGeneratingTextReport}
              className="bg-indigo-500 hover:bg-indigo-400 text-white disabled:opacity-60"
            >
              {isGeneratingTextReport
                ? 'Elemzés készítése...'
                : textReport
                  ? 'Elemzés újragenerálása'
                  : 'Szöveges elemzés generálása'}
            </Button>
            <div className="text-xs text-slate-400">
              {(() => {
                if (!selectedGameId) return 'Válassz mérkőzést a gomb aktiválásához.';
                if (!pregameReport) return 'A pre-game elemzés szükséges a generáláshoz.';
                if (!postgameReport) return 'A post-game jelentés nélkül nem generálható.';
                if (isLoadingTextReport) return 'Korábbi jelentés betöltése folyamatban…';
                if (textReportMeta.generatedAt) {
                  return `Utolsó mentés: ${formatGeneratedAt(textReportMeta.generatedAt) ?? 'ismeretlen időpont'}`;
                }
                return 'Generálj egy szöveges összefoglalót, amit automatikusan el is mentünk.';
              })()}
            </div>
          </div>

          {textReportError && (
            <div className="text-sm text-rose-300 bg-rose-900/30 border border-rose-800 rounded-md px-3 py-2">
              {textReportError}
            </div>
          )}

          {isLoadingTextReport && !textReport && (
            <div className="text-sm text-slate-400">Korábbi jelentés betöltése…</div>
          )}

          {textReport && (
            <div className="space-y-2">
              <div className="text-xs text-slate-400">
                Mentve: {formatGeneratedAt(textReportMeta.generatedAt) ?? 'ismeretlen időpont'} • Forrás:{' '}
                {textReportMeta.generatedBy ?? 'gpt-automata'}
              </div>
              <div className="text-sm text-slate-50 whitespace-pre-line bg-slate-800/60 border border-slate-700 rounded-lg px-4 py-3">
                {textReport}
              </div>
            </div>
          )}

          {!textReport && !isLoadingTextReport && !textReportError && (
            <div className="text-sm text-slate-400">
              Még nincs elmentett szöveges elemzés ehhez a meccshez.
            </div>
          )}
        </CardContent>
      </Card>}

      {showPlayerSection && !selectedPlayer && (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6 text-sm text-slate-300">
            Válassz szezont, csapatot és játékost a scouting szintű elemzéshez.
          </CardContent>
        </Card>
      )}

      {showPlayerSection && (
        <details className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-3">
          <summary className="cursor-pointer text-slate-100 font-medium">Fogalmak (röviden)</summary>
          <div className="mt-3 space-y-2 text-sm text-slate-300">
            <div><span className="text-slate-200 font-medium">Pace (tempó):</span> dobáskísérlet + 0.44×büntető + labdaeladás, meccsenként.</div>
            <div><span className="text-slate-200 font-medium">eFG%:</span> dobáshatékonyság, ahol a tripla 1.5-nek számít.</div>
            <div><span className="text-slate-200 font-medium">Assist rate:</span> gólpassz / dobáskísérlet arány.</div>
            <div><span className="text-slate-200 font-medium">TO rate:</span> labdaeladás arány a tempóhoz viszonyítva.</div>
            <div><span className="text-slate-200 font-medium">3P/FT rate:</span> triplák/büntetők aránya az összes dobáskísérlethez.</div>
            <div><span className="text-slate-200 font-medium">Usage proxy:</span> FGA + 0.44×FTA + TO – támadó terheltség becslése.</div>
          </div>
        </details>
      )}

      {showPlayerSection && <details className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-3" open>
        <summary className="cursor-pointer text-slate-100 font-medium">Érkező játékos előzetes elemzése</summary>
        <div className="mt-3 space-y-4">
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
                    className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-400"
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      className="bg-slate-800 text-slate-200 hover:bg-slate-700"
                      onClick={() => importIncomingPlayerFromEurobasket()}
                      disabled={isImportingIncomingPlayer || !incomingPlayer.name.trim()}
                    >
                      {isImportingIncomingPlayer ? 'Eurobasket import...' : 'Eurobasket auto import'}
                    </Button>
                  </div>
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
                    <SelectContent className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-400">
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
                    className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-400"
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
                    className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-400"
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
                    className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-400"
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
                    className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-400"
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
                    className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-400"
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
                    className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-400"
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
                      className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-400"
                    />
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={displayIncomingValue('twoAttemptedPerGame', incomingPlayer.twoAttemptedPerGame)}
                      onFocus={() => setFocusedIncomingField('twoAttemptedPerGame')}
                      onBlur={() => setFocusedIncomingField(null)}
                      onChange={(e) => handleIncomingNumberChange('twoAttemptedPerGame', e.target.value)}
                      className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-400"
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
                      className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-400"
                    />
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={displayIncomingValue('threeAttemptedPerGame', incomingPlayer.threeAttemptedPerGame)}
                      onFocus={() => setFocusedIncomingField('threeAttemptedPerGame')}
                      onBlur={() => setFocusedIncomingField(null)}
                      onChange={(e) => handleIncomingNumberChange('threeAttemptedPerGame', e.target.value)}
                      className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-400"
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
                      className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-400"
                    />
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={displayIncomingValue('ftAttemptedPerGame', incomingPlayer.ftAttemptedPerGame)}
                      onFocus={() => setFocusedIncomingField('ftAttemptedPerGame')}
                      onBlur={() => setFocusedIncomingField(null)}
                      onChange={(e) => handleIncomingNumberChange('ftAttemptedPerGame', e.target.value)}
                      className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-400"
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
                    className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-400"
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
                    className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-400"
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
                    className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-400"
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
                      className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-400"
                    />
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={displayIncomingValue('foulsReceivedPerGame', incomingPlayer.foulsReceivedPerGame)}
                      onFocus={() => setFocusedIncomingField('foulsReceivedPerGame')}
                      onBlur={() => setFocusedIncomingField(null)}
                      onChange={(e) => handleIncomingNumberChange('foulsReceivedPerGame', e.target.value)}
                      className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-400"
                    />
                  </div>
                </div>
              </div>

              {incomingImportError && (
                <div className="text-xs text-rose-300 bg-rose-950/30 border border-rose-800 rounded-md px-3 py-2">
                  {incomingImportError}
                </div>
              )}

              {incomingImportInfo && (
                <div className="text-xs text-emerald-300 bg-emerald-950/30 border border-emerald-800 rounded-md px-3 py-2 space-y-1">
                  <div>{incomingImportInfo}</div>
                  {incomingImportCareer && (
                    <div className="text-emerald-200/90 space-y-1">
                      <div>
                        Jelenlegi: {incomingImportCareer.currentTeam || '-'}
                        {incomingImportCareer.currentCountry ? (
                          <span className="inline-flex items-center gap-1 ml-1">
                            {incomingImportCareer.currentCountryFlagUrl && (
                              <Image
                                src={incomingImportCareer.currentCountryFlagUrl}
                                alt={incomingImportCareer.currentCountry}
                                width={14}
                                height={10}
                                className="h-2.5 w-3.5 rounded-[2px] object-cover"
                                unoptimized
                              />
                            )}
                            <span>({incomingImportCareer.currentCountry})</span>
                          </span>
                        ) : ''}
                      </div>
                      <div>
                        Elozo: {incomingImportCareer.previousTeam || '-'}
                        {incomingImportCareer.previousCountry ? (
                          <span className="inline-flex items-center gap-1 ml-1">
                            {incomingImportCareer.previousCountryFlagUrl && (
                              <Image
                                src={incomingImportCareer.previousCountryFlagUrl}
                                alt={incomingImportCareer.previousCountry}
                                width={14}
                                height={10}
                                className="h-2.5 w-3.5 rounded-[2px] object-cover"
                                unoptimized
                              />
                            )}
                            <span>({incomingImportCareer.previousCountry})</span>
                          </span>
                        ) : ''}
                      </div>
                    </div>
                  )}
                  {incomingImportSource && (
                    <a
                      href={incomingImportSource.url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline text-emerald-200"
                    >
                      Forras profil ({incomingImportSource.seasonYear})
                    </a>
                  )}
                </div>
              )}

              {incomingCandidates.length > 1 && (
                <div className="rounded-md border border-slate-700 bg-slate-950/40 p-3 space-y-3">
                  <div className="text-xs text-slate-300">Valaszd ki a megfelelo jatekost:</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {incomingCandidates.map(candidate => (
                      <div
                        key={candidate.profileUrl}
                        className="rounded-md border border-slate-700 bg-slate-900/70 p-3 space-y-2"
                      >
                        <div className="flex items-start gap-3">
                          <Image
                            src={getCandidatePhotoSrc(candidate)}
                            alt={candidate.name}
                            width={64}
                            height={64}
                            className="h-16 w-16 rounded object-cover border border-slate-700 bg-slate-800"
                            loading="lazy"
                            unoptimized
                            onError={() => {
                              setIncomingPhotoLoadFailed(prev => {
                                if (prev[candidate.profileUrl]) return prev;
                                return { ...prev, [candidate.profileUrl]: true };
                              });
                            }}
                          />
                          <div className="text-xs text-slate-200 space-y-1">
                            <div className="font-semibold text-slate-100">{candidate.name}</div>
                            <div>{candidate.position || '-'} {candidate.height ? `• ${candidate.height} cm` : ''}</div>
                            <div>Szuletett: {candidate.born || '-'}</div>
                            <div className="text-slate-300">{candidate.nationality || '-'}</div>
                            <div className="text-slate-400">Jelenlegi: {candidate.currentTeam || candidate.team || '-'}</div>
                            <div className="text-slate-400 inline-flex items-center gap-1">
                              <span>Orszag:</span>
                              {(candidate.currentCountryFlagUrl || candidate.flagUrl) && (
                                <Image
                                  src={candidate.currentCountryFlagUrl || candidate.flagUrl || INCOMING_PLAYER_PLACEHOLDER}
                                  alt={candidate.currentCountry || candidate.nationality || 'Orszag zaszlo'}
                                  width={14}
                                  height={10}
                                  className="h-2.5 w-3.5 rounded-[2px] object-cover"
                                  unoptimized
                                />
                              )}
                              <span>{candidate.currentCountry || candidate.nationality || '-'}</span>
                            </div>
                            <div className="text-slate-500">
                              Elozo: {candidate.previousTeam || '-'}
                              {candidate.previousCountry ? (
                                <span className="inline-flex items-center gap-1 ml-1">
                                  {candidate.previousCountryFlagUrl && (
                                    <Image
                                      src={candidate.previousCountryFlagUrl}
                                      alt={candidate.previousCountry}
                                      width={14}
                                      height={10}
                                      className="h-2.5 w-3.5 rounded-[2px] object-cover"
                                      unoptimized
                                    />
                                  )}
                                  <span>({candidate.previousCountry})</span>
                                </span>
                              ) : ''}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="bg-slate-800 text-slate-200 hover:bg-slate-700"
                            onClick={() => importIncomingPlayerFromEurobasket(candidate.profileUrl)}
                            disabled={isImportingIncomingPlayer}
                          >
                            Ezt importalom
                          </Button>
                          <a
                            href={candidate.profileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-slate-300 underline"
                          >
                            Profil
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!incomingEligibility && (
                <div className="text-xs text-slate-400">
                  Az elemzéshez legalább 8 meccs és 15 perc/meccs szükséges.
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
                          <span className="text-slate-400">Szerep biztonság: {(incomingAnalysis.roleConfidence * 100).toFixed(0)}%</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-slate-900 border-slate-800">
                      <CardHeader>
                        <CardTitle className="text-slate-50">Képesség pontszámok</CardTitle>
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
                      <CardContent className="text-sm text-slate-200">
                        {incomingAnalysis.strengths.length > 0 ? (
                          <ul className="list-disc list-inside space-y-1 text-pretty leading-relaxed">
                            {incomingAnalysis.strengths.map(item => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-slate-400">Nincs kiemelt erősség.</div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="bg-slate-900 border-slate-800">
                      <CardHeader>
                        <CardTitle className="text-slate-50">Limitációk</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-slate-200">
                        {incomingAnalysis.limitations.length > 0 ? (
                          <ul className="list-disc list-inside space-y-1 text-pretty leading-relaxed">
                            {incomingAnalysis.limitations.map(item => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-slate-400">Nincs kiemelt limitáció.</div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="bg-slate-900 border-slate-800">
                      <CardHeader>
                        <CardTitle className="text-slate-50">Javítandó pontok</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-slate-200">
                        {incomingAnalysis.improvements.length > 0 ? (
                          <ul className="list-disc list-inside space-y-1 text-pretty leading-relaxed">
                            {incomingAnalysis.improvements.map(item => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
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
        </div>
      </details>}

      <div className="flex justify-end">
        <Button variant="secondary" className="bg-slate-800 text-slate-200" disabled>
          Determinisztikus értékelés · Ligafüggetlen
        </Button>
      </div>
    </div>
  );
}
