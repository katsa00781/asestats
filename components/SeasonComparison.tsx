'use client';

import { TerminologyGlossary } from './TerminologyGlossary';
import Image from 'next/image';

import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import type { Props as RechartsLabelProps } from 'recharts/types/component/Label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PostgameShotScatterChart } from '@/components/PostgameShotScatterChart';
import { PostgameZoneHeatmapChart } from '@/components/PostgameZoneHeatmapChart';
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
  normalizeTeamStats as normalizePregameTeamStats,
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
  type PostGameShotMapContext,
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
  generatedBy?: string;
};

type TeamNarrativeStatus = {
  status: 'idle' | 'loading' | 'success' | 'error';
  text?: string;
  error?: string;
  generatedAt?: string;
  generatedBy?: string;
};

type GameTextReportRow = Database['public']['Tables']['game_text_reports']['Row'];
type TeamTextReportRow = Database['public']['Tables']['team_text_reports']['Row'];

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

type ShotRawRow = {
  id: string;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
};

type ShotEventRow = {
  player_id: string | null;
  x: number | null;
  y: number | null;
  is_successful: boolean | null;
  shot_side: 'home' | 'away' | null;
};

type ShotZoneKey = 'rim' | 'paint' | 'mid' | 'corner3' | 'aboveBreak3';

type ShotPoint = {
  playerId: string | null;
  x: number;
  y: number;
  isSuccessful: boolean;
  shotSide: 'home' | 'away';
};

type ShotZoneStats = {
  attempts: number;
  made: number;
  pct: number;
};

type ShotProfileSummary = {
  attempts: number;
  made: number;
  fgPct: number;
  zoneStats: Record<ShotZoneKey, ShotZoneStats>;
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

const computeRecentBlendWeight = (recentGames: number, seasonGames: number) => {
  if (!Number.isFinite(recentGames) || recentGames < 3) return 0;
  const season = Math.max(seasonGames || 1, 1);
  const coverage = Math.min(recentGames / season, 1);
  const baseWeight = 0.45 + coverage * 0.3;
  return Math.min(Math.max(baseWeight, 0.45), 0.72);
};

const blendValue = (seasonValue: number, recentValue: number, recentWeight: number) =>
  seasonValue * (1 - recentWeight) + recentValue * recentWeight;

const blendPregameTeamStats = (
  season: PregameTeamSeasonStat,
  recent: PregameTeamSeasonStat,
  recentWeight: number
): PregameTeamSeasonStat => ({
  ...season,
  games: blendValue(season.games || 0, recent.games || 0, recentWeight),
  pointsFor: blendValue(season.pointsFor || 0, recent.pointsFor || 0, recentWeight),
  pointsAgainst: blendValue(season.pointsAgainst || 0, recent.pointsAgainst || 0, recentWeight),
  fga2: blendValue(season.fga2 || 0, recent.fga2 || 0, recentWeight),
  fgm2: blendValue(season.fgm2 || 0, recent.fgm2 || 0, recentWeight),
  fga3: blendValue(season.fga3 || 0, recent.fga3 || 0, recentWeight),
  fgm3: blendValue(season.fgm3 || 0, recent.fgm3 || 0, recentWeight),
  fta: blendValue(season.fta || 0, recent.fta || 0, recentWeight),
  ftm: blendValue(season.ftm || 0, recent.ftm || 0, recentWeight),
  oreb: blendValue(season.oreb || 0, recent.oreb || 0, recentWeight),
  dreb: blendValue(season.dreb || 0, recent.dreb || 0, recentWeight),
  ast: blendValue(season.ast || 0, recent.ast || 0, recentWeight),
  tov: blendValue(season.tov || 0, recent.tov || 0, recentWeight),
  stl: blendValue(season.stl || 0, recent.stl || 0, recentWeight),
  blk: blendValue(season.blk || 0, recent.blk || 0, recentWeight),
  fouls: blendValue(season.fouls || 0, recent.fouls || 0, recentWeight),
  val: blendValue(season.val || 0, recent.val || 0, recentWeight),
});

const blendPregamePlayers = (
  seasonPlayers: PlayerSeasonStat[],
  recentPlayers: PlayerSeasonStat[],
  recentWeight: number
): PlayerSeasonStat[] => {
  const seasonMap = new Map(seasonPlayers.map(player => [player.playerId, player]));
  const recentMap = new Map(recentPlayers.map(player => [player.playerId, player]));
  const playerIds = new Set<string>([...seasonMap.keys(), ...recentMap.keys()]);

  return Array.from(playerIds)
    .map(playerId => {
      const season = seasonMap.get(playerId);
      const recent = recentMap.get(playerId);
      if (!season) return recent!;
      if (!recent) return season;

      return {
        ...season,
        name: season.name || recent.name,
        position: season.position || recent.position,
        positionLabel: season.positionLabel ?? recent.positionLabel,
        positionBuckets: season.positionBuckets ?? recent.positionBuckets,
        heightCm: season.heightCm ?? recent.heightCm,
        roles: season.roles?.length ? season.roles : recent.roles,
        games: blendValue(season.games || 0, recent.games || 0, recentWeight),
        minutes: blendValue(season.minutes || 0, recent.minutes || 0, recentWeight),
        points: blendValue(season.points || 0, recent.points || 0, recentWeight),
        fga2: blendValue(season.fga2 || 0, recent.fga2 || 0, recentWeight),
        fgm2: blendValue(season.fgm2 || 0, recent.fgm2 || 0, recentWeight),
        fga3: blendValue(season.fga3 || 0, recent.fga3 || 0, recentWeight),
        fgm3: blendValue(season.fgm3 || 0, recent.fgm3 || 0, recentWeight),
        fta: blendValue(season.fta || 0, recent.fta || 0, recentWeight),
        ftm: blendValue(season.ftm || 0, recent.ftm || 0, recentWeight),
        oreb: blendValue(season.oreb || 0, recent.oreb || 0, recentWeight),
        dreb: blendValue(season.dreb || 0, recent.dreb || 0, recentWeight),
        ast: blendValue(season.ast || 0, recent.ast || 0, recentWeight),
        tov: blendValue(season.tov || 0, recent.tov || 0, recentWeight),
        stl: blendValue(season.stl || 0, recent.stl || 0, recentWeight),
        blk: blendValue(season.blk || 0, recent.blk || 0, recentWeight),
        val: blendValue(season.val || 0, recent.val || 0, recentWeight),
      };
    })
    .filter(player => (player.games || 0) > 0);
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

const formatShotPct = (value: number) => {
  if (!Number.isFinite(value)) return '-';
  return `${value.toFixed(1)}%`;
};

const formatShotDeltaPp = (value: number) => {
  if (!Number.isFinite(value)) return '-';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)} pp`;
};

const shotDeltaTone = (value: number) => {
  if (!Number.isFinite(value) || Math.abs(value) < 0.2) return 'text-slate-400';
  return value > 0 ? 'text-emerald-400' : 'text-rose-400';
};

const normalizeShotX = (point: ShotPoint) => (point.shotSide === 'away' ? 100 - point.x : point.x);

const classifyShotZone = (point: ShotPoint): ShotZoneKey => {
  const x = normalizeShotX(point);
  const y = point.y;
  const dx = x - 6;
  const dy = y - 50;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance <= 9) return 'rim';
  if (distance <= 18) return 'paint';

  const isCorner3 = x >= 25 && (y <= 14 || y >= 86);
  if (isCorner3) return 'corner3';

  if (distance >= 29) return 'aboveBreak3';
  return 'mid';
};

const toShotPoints = (rows: ShotEventRow[]): ShotPoint[] => {
  return rows
    .map(row => {
      if (!Number.isFinite(row.x) || !Number.isFinite(row.y)) return null;
      if (row.shot_side !== 'home' && row.shot_side !== 'away') return null;
      return {
        playerId: row.player_id,
        x: Number(row.x),
        y: Number(row.y),
        isSuccessful: Boolean(row.is_successful),
        shotSide: row.shot_side,
      };
    })
    .filter((item): item is ShotPoint => Boolean(item));
};

const buildShotProfileSummary = (points: ShotPoint[]): ShotProfileSummary => {
  const zoneStats: Record<ShotZoneKey, ShotZoneStats> = {
    rim: { attempts: 0, made: 0, pct: 0 },
    paint: { attempts: 0, made: 0, pct: 0 },
    mid: { attempts: 0, made: 0, pct: 0 },
    corner3: { attempts: 0, made: 0, pct: 0 },
    aboveBreak3: { attempts: 0, made: 0, pct: 0 },
  };

  let attempts = 0;
  let made = 0;

  points.forEach(point => {
    attempts += 1;
    const zone = classifyShotZone(point);
    zoneStats[zone].attempts += 1;
    if (point.isSuccessful) {
      made += 1;
      zoneStats[zone].made += 1;
    }
  });

  (Object.keys(zoneStats) as ShotZoneKey[]).forEach(zone => {
    const attemptsInZone = zoneStats[zone].attempts;
    zoneStats[zone].pct = attemptsInZone > 0 ? roundValue((zoneStats[zone].made / attemptsInZone) * 100, 1) : 0;
  });

  return {
    attempts,
    made,
    fgPct: attempts > 0 ? roundValue((made / attempts) * 100, 1) : 0,
    zoneStats,
  };
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
  const [pregamePressureWeight, setPregamePressureWeight] = useState(34);
  const [pregamePerimeterWeight, setPregamePerimeterWeight] = useState(33);
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
  const [teamNarrative, setTeamNarrative] = useState<TeamNarrativeStatus>({ status: 'idle' });
  const [teamNarrativeStyle, setTeamNarrativeStyle] = useState<'fan' | 'coach' | 'scouting'>('fan');
  const [isGeneratingTeamNarrative, setIsGeneratingTeamNarrative] = useState(false);
  const [isGeneratingPlayerSeasonText, setIsGeneratingPlayerSeasonText] = useState(false);
  const [isSavingPlayerSeasonText, setIsSavingPlayerSeasonText] = useState(false);
  const [playerSeasonSaveStatus, setPlayerSeasonSaveStatus] = useState<
    { type: 'success' | 'error'; message: string } | null
  >(null);
  const [postgameShotContext, setPostgameShotContext] = useState<PostGameShotMapContext | null>(null);
  const [selectedPostgameShotPlayerId, setSelectedPostgameShotPlayerId] = useState('all');
  const [showPostgameShotPoints, setShowPostgameShotPoints] = useState(true);
  const [showPostgameShotHeatmap, setShowPostgameShotHeatmap] = useState(true);
  const [postgameHeatmapContrast, setPostgameHeatmapContrast] = useState<'soft' | 'normal' | 'sharp'>('normal');
  const [postgameHeatmapMode, setPostgameHeatmapMode] = useState<'volume' | 'efficiency'>('volume');
  const [selectedPostgameFactor, setSelectedPostgameFactor] = useState<string | null>(null);
  const [selectedPostgameZone, setSelectedPostgameZone] = useState<'rim' | 'paint' | 'mid' | 'corner3' | 'aboveBreak3' | null>(null);
  const [selectedTrendPlayerId, setSelectedTrendPlayerId] = useState<string>('');
  const [teamSeasonShotRows, setTeamSeasonShotRows] = useState<ShotEventRow[]>([]);
  const [leagueSeasonShotRows, setLeagueSeasonShotRows] = useState<ShotEventRow[]>([]);
  const [playerSeasonShotRows, setPlayerSeasonShotRows] = useState<ShotEventRow[]>([]);
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

    const loadTeamSeasonShots = async () => {
      if (!resolvedSeasonId || !resolvedTeamId || resolvedTeamId === 'all') {
        if (!cancelled) setTeamSeasonShotRows([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('hunbasket_shot_events' as never)
          .select('player_id, x, y, is_successful, shot_side')
          .eq('season_id', resolvedSeasonId)
          .eq('team_id', resolvedTeamId);

        if (error || !Array.isArray(data)) {
          if (!cancelled) setTeamSeasonShotRows([]);
          return;
        }

        if (!cancelled) {
          setTeamSeasonShotRows(data as ShotEventRow[]);
        }
      } catch {
        if (!cancelled) setTeamSeasonShotRows([]);
      }
    };

    loadTeamSeasonShots();

    return () => {
      cancelled = true;
    };
  }, [resolvedSeasonId, resolvedTeamId]);

  useEffect(() => {
    let cancelled = false;

    const loadLeagueSeasonShots = async () => {
      if (!resolvedSeasonId) {
        if (!cancelled) setLeagueSeasonShotRows([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('hunbasket_shot_events' as never)
          .select('player_id, x, y, is_successful, shot_side')
          .eq('season_id', resolvedSeasonId);

        if (error || !Array.isArray(data)) {
          if (!cancelled) setLeagueSeasonShotRows([]);
          return;
        }

        if (!cancelled) {
          setLeagueSeasonShotRows(data as ShotEventRow[]);
        }
      } catch {
        if (!cancelled) setLeagueSeasonShotRows([]);
      }
    };

    loadLeagueSeasonShots();

    return () => {
      cancelled = true;
    };
  }, [resolvedSeasonId]);

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
    let cancelled = false;

    const loadPlayerSeasonShots = async () => {
      if (!resolvedSeasonId || !selectedPlayerId) {
        if (!cancelled) setPlayerSeasonShotRows([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('hunbasket_shot_events' as never)
          .select('player_id, x, y, is_successful, shot_side')
          .eq('season_id', resolvedSeasonId)
          .eq('player_id', selectedPlayerId);

        if (error || !Array.isArray(data)) {
          if (!cancelled) setPlayerSeasonShotRows([]);
          return;
        }

        if (!cancelled) {
          setPlayerSeasonShotRows(data as ShotEventRow[]);
        }
      } catch {
        if (!cancelled) setPlayerSeasonShotRows([]);
      }
    };

    loadPlayerSeasonShots();

    return () => {
      cancelled = true;
    };
  }, [resolvedSeasonId, selectedPlayerId]);

  const teamSeasonShotPoints = useMemo(() => toShotPoints(teamSeasonShotRows), [teamSeasonShotRows]);

  const teamSeasonShotSummary = useMemo(() => {
    if (teamSeasonShotPoints.length === 0) return null;
    return buildShotProfileSummary(teamSeasonShotPoints);
  }, [teamSeasonShotPoints]);

  const teamSeasonShotZoneRows = useMemo(() => {
    if (!teamSeasonShotSummary) return [] as Array<{ label: string; rate: number; pct: number; attempts: number }>;
    const total = Math.max(1, teamSeasonShotSummary.attempts);
    return [
      { label: 'Gyűrű', rate: (teamSeasonShotSummary.zoneStats.rim.attempts / total) * 100, pct: teamSeasonShotSummary.zoneStats.rim.pct, attempts: teamSeasonShotSummary.zoneStats.rim.attempts },
      { label: 'Festék', rate: (teamSeasonShotSummary.zoneStats.paint.attempts / total) * 100, pct: teamSeasonShotSummary.zoneStats.paint.pct, attempts: teamSeasonShotSummary.zoneStats.paint.attempts },
      { label: 'Középtáv', rate: (teamSeasonShotSummary.zoneStats.mid.attempts / total) * 100, pct: teamSeasonShotSummary.zoneStats.mid.pct, attempts: teamSeasonShotSummary.zoneStats.mid.attempts },
      { label: 'Sarok tripla', rate: (teamSeasonShotSummary.zoneStats.corner3.attempts / total) * 100, pct: teamSeasonShotSummary.zoneStats.corner3.pct, attempts: teamSeasonShotSummary.zoneStats.corner3.attempts },
      { label: 'Egyéb tripla', rate: (teamSeasonShotSummary.zoneStats.aboveBreak3.attempts / total) * 100, pct: teamSeasonShotSummary.zoneStats.aboveBreak3.pct, attempts: teamSeasonShotSummary.zoneStats.aboveBreak3.attempts },
    ].map(item => ({
      ...item,
      rate: roundValue(item.rate, 1),
      pct: roundValue(item.pct, 1),
    }));
  }, [teamSeasonShotSummary]);

  const leagueSeasonShotPoints = useMemo(() => toShotPoints(leagueSeasonShotRows), [leagueSeasonShotRows]);

  const leagueSeasonShotSummary = useMemo(() => {
    if (leagueSeasonShotPoints.length === 0) return null;
    return buildShotProfileSummary(leagueSeasonShotPoints);
  }, [leagueSeasonShotPoints]);

  const teamLeagueRelativeZoneRows = useMemo(() => {
    if (!teamSeasonShotSummary || !leagueSeasonShotSummary) {
      return [] as Array<{ label: string; rateDelta: number; pctDelta: number }>;
    }

    const teamTotal = Math.max(1, teamSeasonShotSummary.attempts);
    const leagueTotal = Math.max(1, leagueSeasonShotSummary.attempts);

    const rows: Array<{ key: ShotZoneKey; label: string }> = [
      { key: 'rim', label: 'Gyűrű' },
      { key: 'paint', label: 'Festék' },
      { key: 'mid', label: 'Középtáv' },
      { key: 'corner3', label: 'Sarok tripla' },
      { key: 'aboveBreak3', label: 'Egyéb tripla' },
    ];

    return rows.map(row => {
      const teamRate = (teamSeasonShotSummary.zoneStats[row.key].attempts / teamTotal) * 100;
      const leagueRate = (leagueSeasonShotSummary.zoneStats[row.key].attempts / leagueTotal) * 100;
      const teamPct = teamSeasonShotSummary.zoneStats[row.key].pct;
      const leaguePct = leagueSeasonShotSummary.zoneStats[row.key].pct;
      return {
        label: row.label,
        rateDelta: roundValue(teamRate - leagueRate, 1),
        pctDelta: roundValue(teamPct - leaguePct, 1),
      };
    });
  }, [leagueSeasonShotSummary, teamSeasonShotSummary]);

  const teamSeasonHeatmapRows = useMemo(() => {
    if (teamSeasonShotZoneRows.length === 0) {
      return [] as Array<{ label: string; attempts: number; rate: number; pct: number; rateNorm: number; pctNorm: number }>;
    }

    const maxAttempts = Math.max(...teamSeasonShotZoneRows.map(row => row.attempts), 1);
    const maxPct = Math.max(...teamSeasonShotZoneRows.map(row => row.pct), 1);

    return teamSeasonShotZoneRows.map(row => ({
      ...row,
      rateNorm: row.attempts / maxAttempts,
      pctNorm: row.pct / maxPct,
    }));
  }, [teamSeasonShotZoneRows]);

  const teamTacticalWeaknesses = useMemo(() => {
    if (!resolvedTeamId || resolvedTeamId === 'all') return [] as string[];

    const teamPlayers = activeSeasonPlayers
      .filter(player => String(player.teamId ?? '') === String(resolvedTeamId))
      .filter(player => (player.minutes || 0) > 80 && (player.gamesPlayed || 0) >= 4);

    if (teamPlayers.length === 0) return [] as string[];

    const withDerived = teamPlayers.map(player => {
      const fga2 = (player.shooting?.close?.attempted || 0) + (player.shooting?.mid?.attempted || 0);
      const fga3 = player.shooting?.three?.attempted || 0;
      const fga = fga2 + fga3;
      const fta = player.shooting?.freeThrow?.attempted || 0;
      const usageProxy = fga + 0.44 * fta + (player.turnovers || 0);
      const games = Math.max(player.gamesPlayed || 1, 1);
      const threePerGame = fga3 / games;
      return {
        name: player.name,
        minutes: player.minutes || 0,
        usageProxy,
        threePerGame,
        rimAttempts: player.shooting?.close?.attempted || 0,
      };
    });

    const rotationMinutes = withDerived.reduce((sum, p) => sum + p.minutes, 0);
    const sortedByUsage = [...withDerived].sort((a, b) => b.usageProxy - a.usageProxy);
    const primary = sortedByUsage[0];
    const rimFinisher = [...withDerived].sort((a, b) => b.rimAttempts - a.rimAttempts)[0];

    const lowGravityHighMinute = withDerived
      .filter(p => p.threePerGame < 1.0 && (rotationMinutes > 0 ? p.minutes / rotationMinutes : 0) >= 0.11)
      .sort((a, b) => b.minutes - a.minutes);

    const lowGravityPrimaryHandler = sortedByUsage
      .slice(0, 3)
      .filter(p => p.threePerGame < 1.0)
      .sort((a, b) => b.usageProxy - a.usageProxy)[0];

    const insights: string[] = [];

    if (lowGravityPrimaryHandler && rimFinisher && lowGravityPrimaryHandler.name !== rimFinisher.name) {
      insights.push(
        `${lowGravityPrimaryHandler.name} alacsony tripla-volumene (${lowGravityPrimaryHandler.threePerGame.toFixed(1)} 3PA/meccs) miatt az ellenfél könnyebben besegíthet ${rimFinisher.name} gyűrű körüli játékára.`
      );
    }

    if (lowGravityHighMinute.length >= 2) {
      const names = lowGravityHighMinute.slice(0, 2).map(p => p.name).join(', ');
      insights.push(
        `A rotációban egyszerre több alacsony periméter-gravitációjú játékos van (${names}), ami leszűkítheti a betörési sávokat félpályán.`
      );
    }

    if (primary && primary.usageProxy > 0) {
      const top2 = sortedByUsage.slice(0, 2).reduce((sum, p) => sum + p.usageProxy, 0);
      const totalUsage = sortedByUsage.reduce((sum, p) => sum + p.usageProxy, 0);
      const top2Share = totalUsage > 0 ? (top2 / totalUsage) * 100 : 0;
      if (top2Share >= 44) {
        insights.push(
          `A támadó döntéshozatal erősen koncentrált (Top2 usage: ${top2Share.toFixed(1)}%), ezért erősebb nyomásnál nőhet a labdavesztés- és rossz dobáskockázat.`
        );
      }
    }

    return insights.slice(0, 4);
  }, [activeSeasonPlayers, resolvedTeamId]);

  const playerSeasonShotPoints = useMemo(() => toShotPoints(playerSeasonShotRows), [playerSeasonShotRows]);

  const playerSeasonShotSummary = useMemo(() => {
    if (playerSeasonShotPoints.length === 0) return null;
    return buildShotProfileSummary(playerSeasonShotPoints);
  }, [playerSeasonShotPoints]);

  const playerShotZoneRows = useMemo(() => {
    if (!playerSeasonShotSummary) return [] as Array<{ label: string; attempts: number; pct: number }>;
    return [
      { label: 'Gyűrű', attempts: playerSeasonShotSummary.zoneStats.rim.attempts, pct: playerSeasonShotSummary.zoneStats.rim.pct },
      { label: 'Festék', attempts: playerSeasonShotSummary.zoneStats.paint.attempts, pct: playerSeasonShotSummary.zoneStats.paint.pct },
      { label: 'Középtáv', attempts: playerSeasonShotSummary.zoneStats.mid.attempts, pct: playerSeasonShotSummary.zoneStats.mid.pct },
      { label: 'Sarok tripla', attempts: playerSeasonShotSummary.zoneStats.corner3.attempts, pct: playerSeasonShotSummary.zoneStats.corner3.pct },
      { label: 'Egyéb tripla', attempts: playerSeasonShotSummary.zoneStats.aboveBreak3.attempts, pct: playerSeasonShotSummary.zoneStats.aboveBreak3.pct },
    ];
  }, [playerSeasonShotSummary]);

  useEffect(() => {
    let cancelled = false;

    const loadPlayerSeasonNarrative = async () => {
      if (!resolvedSeasonId || !selectedPlayerId) {
        if (!cancelled) setPlayerNarratives({});
        return;
      }

      try {
        const { data, error } = (await supabase
          .from('player_text_reports' as never)
          .select('narrative, generated_at, generated_by')
          .eq('season_id', resolvedSeasonId)
          .eq('player_id', selectedPlayerId)
          .eq('report_type', 'season')
          .order('generated_at', { ascending: false })
          .limit(1)
          .maybeSingle()) as {
            data: { narrative: string | null; generated_at: string | null; generated_by: string | null } | null;
            error: { message?: string } | null;
          };

        if (cancelled) return;

        if (error || !data) {
          setPlayerNarratives({});
          return;
        }

        setPlayerNarratives({
          [selectedPlayerId]: {
            status: 'success',
            text: data.narrative ?? '',
            generatedAt: data.generated_at ?? undefined,
            generatedBy: data.generated_by ?? undefined,
          },
        });
      } catch {
        if (!cancelled) setPlayerNarratives({});
      }
    };

    loadPlayerSeasonNarrative();

    return () => {
      cancelled = true;
    };
  }, [resolvedSeasonId, selectedPlayerId]);

  const postgameShotScatterData = useMemo(() => {
    if (!postgameShotContext?.gameShots?.length) {
      return [] as Array<{ x: number; y: number; result: string; player: string; playerId: string | null }>;
    }
    const playerNameById = new Map(seasonPlayers.map(player => [player.id, player.name]));
    return postgameShotContext.gameShots.map(shot => ({
      x: shot.shotSide === 'away' ? 100 - shot.x : shot.x,
      y: shot.y,
      result: shot.isSuccessful ? 'Bement' : 'Kimaradt',
      player: shot.playerId ? (playerNameById.get(shot.playerId) ?? 'Ismeretlen') : 'Ismeretlen',
      playerId: shot.playerId,
    }));
  }, [postgameShotContext, seasonPlayers]);

  const postgameShotPlayerOptions = useMemo(() => {
    const byPlayer = new Map<string, string>();
    let unknownShotCount = 0;

    postgameShotScatterData.forEach(shot => {
      if (shot.playerId) {
        if (!byPlayer.has(shot.playerId)) byPlayer.set(shot.playerId, shot.player);
      } else {
        unknownShotCount += 1;
      }
    });

    const players = Array.from(byPlayer.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'hu'));

    return {
      players,
      unknownShotCount,
    };
  }, [postgameShotScatterData]);

  const filteredPostgameShotScatterData = useMemo(() => {
    if (selectedPostgameShotPlayerId === 'all') return postgameShotScatterData;
    if (selectedPostgameShotPlayerId === '__unknown__') {
      return postgameShotScatterData.filter(shot => !shot.playerId);
    }
    return postgameShotScatterData.filter(shot => shot.playerId === selectedPostgameShotPlayerId);
  }, [postgameShotScatterData, selectedPostgameShotPlayerId]);

  useEffect(() => {
    if (selectedPostgameShotPlayerId === 'all') return;
    if (selectedPostgameShotPlayerId === '__unknown__') {
      if (postgameShotPlayerOptions.unknownShotCount > 0) return;
      setSelectedPostgameShotPlayerId('all');
      return;
    }

    const stillExists = postgameShotPlayerOptions.players.some(player => player.id === selectedPostgameShotPlayerId);
    if (!stillExists) setSelectedPostgameShotPlayerId('all');
  }, [postgameShotPlayerOptions, selectedPostgameShotPlayerId]);

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

  useEffect(() => {
    let cancelled = false;

    const loadPostgameShotContext = async () => {
      if (!selectedGame || !resolvedSeasonId || !resolvedTeamId || resolvedTeamId === 'all') {
        if (!cancelled) setPostgameShotContext(null);
        return;
      }

      try {
        const { data: rawData, error: rawError } = await supabase
          .from('hunbasket_shotchart_raw' as never)
          .select('id, home_team_id, away_team_id, home_score, away_score')
          .eq('season_id', resolvedSeasonId)
          .eq('game_date', selectedGame.date)
          .or(`home_team_id.eq.${resolvedTeamId},away_team_id.eq.${resolvedTeamId}`);

        if (rawError || !Array.isArray(rawData) || rawData.length === 0) {
          if (!cancelled) setPostgameShotContext(null);
          return;
        }

        const candidates = (rawData as ShotRawRow[]).filter(row => {
          const scoreMatch = (
            (row.home_score === selectedGame.ourScore && row.away_score === selectedGame.oppScore)
            || (row.home_score === selectedGame.oppScore && row.away_score === selectedGame.ourScore)
          );
          if (!scoreMatch) return false;

          if (!selectedOpponentTeamId) return true;

          const teams = [row.home_team_id, row.away_team_id];
          return teams.includes(resolvedTeamId) && teams.includes(selectedOpponentTeamId);
        });

        const selectedRaw = candidates[0] || (rawData as ShotRawRow[])[0];
        if (!selectedRaw?.id) {
          if (!cancelled) setPostgameShotContext(null);
          return;
        }

        const [{ data: gameEventsData }, { data: seasonEventsData }] = await Promise.all([
          supabase
            .from('hunbasket_shot_events' as never)
            .select('player_id, x, y, is_successful, shot_side')
            .eq('raw_game_id', selectedRaw.id)
            .eq('team_id', resolvedTeamId),
          supabase
            .from('hunbasket_shot_events' as never)
            .select('player_id, x, y, is_successful, shot_side')
            .eq('season_id', resolvedSeasonId)
            .eq('team_id', resolvedTeamId),
        ]);

        if (cancelled) return;

        const mapEvent = (row: ShotEventRow) => {
          if (!Number.isFinite(row.x) || !Number.isFinite(row.y)) return null;
          if (row.shot_side !== 'home' && row.shot_side !== 'away') return null;
          return {
            playerId: row.player_id,
            x: Number(row.x),
            y: Number(row.y),
            isSuccessful: Boolean(row.is_successful),
            shotSide: row.shot_side,
          };
        };

        const gameShots = ((gameEventsData || []) as ShotEventRow[])
          .map(mapEvent)
          .filter((item): item is NonNullable<ReturnType<typeof mapEvent>> => Boolean(item));

        const seasonShots = ((seasonEventsData || []) as ShotEventRow[])
          .map(mapEvent)
          .filter((item): item is NonNullable<ReturnType<typeof mapEvent>> => Boolean(item));

        setPostgameShotContext({
          gameShots,
          seasonShots,
        });
      } catch {
        if (!cancelled) setPostgameShotContext(null);
      }
    };

    loadPostgameShotContext();

    return () => {
      cancelled = true;
    };
  }, [resolvedSeasonId, resolvedTeamId, selectedGame, selectedOpponentTeamId]);

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

  const teamNarrativeReportType = useMemo(() => {
    if (teamNarrativeStyle === 'coach') return 'season_coach';
    if (teamNarrativeStyle === 'scouting') return 'season_scouting';
    return 'season_fan';
  }, [teamNarrativeStyle]);

  useEffect(() => {
    let cancelled = false;

    const loadTeamNarrative = async () => {
      if (!resolvedSeasonId || !resolvedTeamId || resolvedTeamId === 'all') {
        if (!cancelled) setTeamNarrative({ status: 'idle' });
        return;
      }

      try {
        const { data, error } = await supabase
          .from('team_text_reports')
          .select('narrative, generated_at, generated_by')
          .eq('season_id', resolvedSeasonId)
          .eq('team_id', resolvedTeamId)
          .eq('report_type', teamNarrativeReportType)
          .order('generated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cancelled) return;

        const applyNarrative = (row: Pick<TeamTextReportRow, 'narrative' | 'generated_at' | 'generated_by'> | null) => {
          if (!row?.narrative) {
            setTeamNarrative({ status: 'idle' });
            return;
          }
          setTeamNarrative({
            status: 'success',
            text: row.narrative,
            generatedAt: row.generated_at,
            generatedBy: row.generated_by ?? undefined,
          });
        };

        if (!error && data?.narrative) {
          applyNarrative(data as Pick<TeamTextReportRow, 'narrative' | 'generated_at' | 'generated_by'>);
          return;
        }

        // Legacy fallback: old rows saved as 'season' should still be visible in fan preset.
        if (teamNarrativeReportType === 'season_fan') {
          const { data: legacyData, error: legacyError } = await supabase
            .from('team_text_reports')
            .select('narrative, generated_at, generated_by')
            .eq('season_id', resolvedSeasonId)
            .eq('team_id', resolvedTeamId)
            .eq('report_type', 'season')
            .order('generated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (cancelled) return;
          if (!legacyError && legacyData?.narrative) {
            applyNarrative(legacyData as Pick<TeamTextReportRow, 'narrative' | 'generated_at' | 'generated_by'>);
            return;
          }
        }

        setTeamNarrative({ status: 'idle' });
      } catch {
        if (!cancelled) setTeamNarrative({ status: 'idle' });
      }
    };

    loadTeamNarrative();

    return () => {
      cancelled = true;
    };
  }, [resolvedSeasonId, resolvedTeamId, teamNarrativeReportType]);

  const projectedStandings = useMemo(() => {
    if (standingsSnapshot.length === 0) return [] as ProjectionRow[];

    const teamNameById = new Map(allTeams.map(team => [team.id, team.name]));

    const recentSnapshotByTeamId = new Map<string, PregameTeamSeasonStat>();
    teamSeasonStats.forEach(team => {
      const recentGameIds = recentGameIdsByTeam.get(team.teamId) ?? [];
      if (recentGameIds.length < MIN_RECENT_GAMES_TEAM) return;
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
        if (rowTeamId !== team.teamId) return;

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
        const ownPoints = byTeam.get(team.teamId);
        if (ownPoints === undefined) return;
        const totalPoints = Array.from(byTeam.values()).reduce((sum, value) => sum + value, 0);
        pointsAgainst += totalPoints - ownPoints;
        countedGames += 1;
      });

      const gamesCount = countedGames > 0 ? countedGames : recentGameIds.length;

      recentSnapshotByTeamId.set(team.teamId, {
        teamId: team.teamId,
        teamName: team.teamName,
        league: team.league,
        season: team.season,
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
      });
    });

    const teamMetrics = teamSeasonStats.map(team => {
      const seasonBase: PregameTeamSeasonStat = {
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
      };

      const recentSnapshot = recentSnapshotByTeamId.get(team.teamId);
      const blended = (() => {
        if (!recentSnapshot) return seasonBase;
        const recentWeight = computeRecentBlendWeight(recentSnapshot.games || 0, seasonBase.games || 0);
        if (recentWeight <= 0) return seasonBase;
        return blendPregameTeamStats(seasonBase, recentSnapshot, recentWeight);
      })();

      const gamesPlayed = Math.max(1, blended.games || 0);
      const fga = (blended.fga2 || 0) + (blended.fga3 || 0);
      const fgm = (blended.fgm2 || 0) + (blended.fgm3 || 0);
      const possessions = Math.max(1, fga + 0.44 * (blended.fta || 0) + (blended.tov || 0));

      return {
        key: normalizeTeamKey(team.teamName),
        netRatingPerGame: ((blended.pointsFor || 0) - (blended.pointsAgainst || 0)) / gamesPlayed,
        efg: fga > 0 ? ((fgm + 0.5 * (blended.fgm3 || 0)) / fga) * 100 : 0,
        astToTov: (blended.ast || 0) / Math.max(1, blended.tov || 0),
        reboundsPerGame: ((blended.oreb || 0) + (blended.dreb || 0)) / gamesPlayed,
        defensiveActivityPerGame: ((blended.stl || 0) + (blended.blk || 0)) / gamesPlayed,
        turnoverRate: (blended.tov || 0) / possessions,
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
  }, [
    MIN_RECENT_GAMES_TEAM,
    allTeams,
    gameTeamPoints,
    playerGameStats,
    playerTeamMap,
    recentGameIdsByTeam,
    seasonFixtures,
    standingsSnapshot,
    teamSeasonStats,
  ]);

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
    const recentSnapshot = useRecentFormPregame
      ? buildRecentTeamStat(resolvedTeamId, {
        excludeGameId: excludeOwnPregameGameId,
      })
      : null;

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

    let seasonBase = fallbackSeason;
    if (!seasonBase) return null;

    const shouldAdjustSeasonAggregate = Boolean(
      excludeOwnPregameGameId && (!useRecentFormPregame || !recentSnapshot)
    );

    if (shouldAdjustSeasonAggregate) {
      seasonBase = subtractGameFromTeamAggregate(
        seasonBase,
        resolvedTeamId,
        excludeOwnPregameGameId,
        teamGamePlayerRows,
        gameTeamPoints
      );
    }

    if (!useRecentFormPregame || !recentSnapshot) return seasonBase;

    const recentWeight = computeRecentBlendWeight(recentSnapshot.games || 0, seasonBase.games || 0);
    if (recentWeight <= 0) return seasonBase;

    return blendPregameTeamStats(seasonBase, recentSnapshot, recentWeight);
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

    const recentSnapshot = useRecentFormPregame
      ? buildRecentTeamStat(selectedOpponentTeamId, {
        excludeGameId: excludeOpponentPregameGameId,
      }) ?? null
      : null;

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

    let seasonBase = fallbackSeason;
    if (!seasonBase) return null;

    const shouldAdjustSeasonAggregate = Boolean(
      excludeOpponentPregameGameId && (!useRecentFormPregame || !recentSnapshot)
    );

    if (shouldAdjustSeasonAggregate) {
      seasonBase = subtractGameFromTeamAggregate(
        seasonBase,
        selectedOpponentTeamId,
        excludeOpponentPregameGameId,
        teamGamePlayerRows,
        gameTeamPoints
      );
    }

    if (!useRecentFormPregame || !recentSnapshot) return seasonBase;

    const recentWeight = computeRecentBlendWeight(recentSnapshot.games || 0, seasonBase.games || 0);
    if (recentWeight <= 0) return seasonBase;

    return blendPregameTeamStats(seasonBase, recentSnapshot, recentWeight);
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

    const seasonPlayers = buildFromSeason();
    if (!useRecentFormPregame) return seasonPlayers;

    const recentGameIds = recentGameIdsByTeam.get(selectedOpponentTeamId) ?? [];
    const filteredRecentIds = excludeGameId
      ? recentGameIds.filter(id => id !== excludeGameId)
      : recentGameIds;
    if (filteredRecentIds.length < MIN_RECENT_GAMES_TEAM) return seasonPlayers;
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

    const recentPlayers = Array.from(statsMap.values())
      .map(player => ({
        ...player,
        games: gamesMap.get(player.playerId)?.size ?? 0,
      }))
      .filter(player => hasSampleForPregame(player.games || 0, MIN_PREGAME_GAMES, MIN_PREGAME_GAMES_FLOOR))
      .filter(player => seasonPlayerMap.get(player.playerId)?.isActive !== false)
      .filter(player => !injurySet.has(player.playerId));

    const seasonGames = Math.max(...seasonPlayers.map(player => player.games || 0), 0);
    const recentWeight = computeRecentBlendWeight(filteredRecentIds.length, seasonGames);
    if (recentWeight <= 0 || recentPlayers.length === 0) return seasonPlayers;
    return blendPregamePlayers(seasonPlayers, recentPlayers, recentWeight)
      .filter(player => hasSampleForPregame(player.games || 0, MIN_PREGAME_GAMES, MIN_PREGAME_GAMES_FLOOR));
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

    const seasonPlayers = buildFromSeason();
    if (!useRecentFormPregame) return seasonPlayers;

    const recentGameIds = recentGameIdsByTeam.get(resolvedTeamId) ?? [];
    const filteredRecentIds = excludeGameId
      ? recentGameIds.filter(id => id !== excludeGameId)
      : recentGameIds;
    if (filteredRecentIds.length < MIN_RECENT_GAMES_TEAM) return seasonPlayers;
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

    const recentPlayers = Array.from(statsMap.values())
      .map(player => ({
        ...player,
        games: gamesMap.get(player.playerId)?.size ?? 0,
      }))
      .filter(player => hasSampleForPregame(player.games || 0, MIN_PREGAME_GAMES, MIN_PREGAME_GAMES_FLOOR))
      .filter(player => seasonPlayerMap.get(player.playerId)?.isActive !== false)
      .filter(player => !injurySet.has(player.playerId));

    const seasonGames = Math.max(...seasonPlayers.map(player => player.games || 0), 0);
    const recentWeight = computeRecentBlendWeight(filteredRecentIds.length, seasonGames);
    if (recentWeight <= 0 || recentPlayers.length === 0) return seasonPlayers;
    return blendPregamePlayers(seasonPlayers, recentPlayers, recentWeight)
      .filter(player => hasSampleForPregame(player.games || 0, MIN_PREGAME_GAMES, MIN_PREGAME_GAMES_FLOOR));
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

  const pregameInjuryImpactEstimate = useMemo(() => {
    const ownMissing = activeSeasonPlayers.filter(
      player => String(player.teamId ?? '') === String(resolvedTeamId) && pregameOwnInjuries.includes(player.id)
    );
    const opponentMissing = activeSeasonPlayers.filter(
      player => String(player.teamId ?? '') === String(selectedOpponentTeamId) && pregameOpponentInjuries.includes(player.id)
    );

    const summarizeMissing = (players: PlayerStats[]) => {
      const totals = players.reduce(
        (acc, player) => {
          const games = Math.max(player.gamesPlayed || 0, 1);
          const minutesPerGame = (player.minutes || 0) / games;
          const valuationPerGame = player.valuation || 0;
          const pointsPerGame = player.points || 0;
          acc.valPer36 += minutesPerGame > 0 ? (valuationPerGame / minutesPerGame) * 36 : 0;
          acc.pointsPer36 += minutesPerGame > 0 ? (pointsPerGame / minutesPerGame) * 36 : 0;
          if (valuationPerGame >= 12) acc.coreNames.push(player.name);
          return acc;
        },
        { valPer36: 0, pointsPer36: 0, coreNames: [] as string[] }
      );

      return {
        valPer36: roundValue(totals.valPer36, 1),
        pointsPer36: roundValue(totals.pointsPer36, 1),
        coreNames: totals.coreNames.slice(0, 4),
      };
    };

    return {
      own: summarizeMissing(ownMissing),
      opponent: summarizeMissing(opponentMissing),
    };
  }, [
    activeSeasonPlayers,
    pregameOpponentInjuries,
    pregameOwnInjuries,
    resolvedTeamId,
    selectedOpponentTeamId,
  ]);

  const pregameStyleMetricChartData = useMemo(() => {
    if (!pregameOwnTeam || !pregameOpponentTeam) return [] as Array<{
      label: string;
      own: number;
      opponent: number;
    }>;

    const own = normalizePregameTeamStats(pregameOwnTeam);
    const opponent = normalizePregameTeamStats(pregameOpponentTeam);
    return [
      { label: 'Tempó', own: own.pace, opponent: opponent.pace },
      { label: '3P%', own: own.threePct, opponent: opponent.threePct },
      { label: '3PA ráta', own: own.threeRate * 100, opponent: opponent.threeRate * 100 },
      { label: 'TO ráta', own: own.turnoverRate * 100, opponent: opponent.turnoverRate * 100 },
      { label: 'FT ráta', own: own.ftRate * 100, opponent: opponent.ftRate * 100 },
    ].map(item => ({ ...item, own: roundValue(item.own, 1), opponent: roundValue(item.opponent, 1) }));
  }, [pregameOpponentTeam, pregameOwnTeam]);

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

    return analyzePostGameReport(
      teamGame,
      opponentGame,
      seasonStats,
      postgameBenchmarks,
      players,
      alignedXFactorContext,
      postgameShotContext ?? undefined
    );
  }, [currentTeamPlayerIds, league, playerGameStats, playerTeamMap, postgameBenchmarks, postgameShotContext, pregameReport, rolesByPlayerId, seasonPlayers, selectedGame, resolvedTeamId, selectedTeamStats]);

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

  const opponentImpactChartData = useMemo(() => {
    if (!postgameReport) return [] as Array<{ label: string; impact: number; axis: string }>;

    const counters = new Map<string, { impact: number; axis: string }>();
    postgameReport.decisiveFactorMeta.forEach(item => {
      const key = item.type;
      const current = counters.get(key) ?? { impact: 0, axis: item.axis === 'defense' ? 'Védekezés' : 'Támadás' };
      current.impact += 1;
      if (item.axis === 'defense') current.axis = 'Védekezés';
      counters.set(key, current);
    });

    return Array.from(counters.entries()).map(([label, value]) => ({
      label,
      impact: value.impact,
      axis: value.axis,
    }));
  }, [postgameReport]);

  const postgameZoneDrilldownRows = useMemo(() => {
    if (!postgameReport?.shotMap?.team || !postgameReport.shotMap.season) return [] as Array<{
      key: 'rim' | 'paint' | 'mid' | 'corner3' | 'aboveBreak3';
      label: string;
      gameAttempts: number;
      seasonAttempts: number;
      gamePct: number;
      seasonPct: number;
      gameRate: number;
      seasonRate: number;
      rateDelta: number;
      pctDelta: number;
    }>;

    const team = postgameReport.shotMap.team;
    const season = postgameReport.shotMap.season;
    const makeRow = (key: 'rim' | 'paint' | 'mid' | 'corner3' | 'aboveBreak3', label: string) => ({
      key,
      label,
      gameAttempts: team.zones[key].attempts,
      seasonAttempts: season.zones[key].attempts,
      gamePct: team.zones[key].pct,
      seasonPct: season.zones[key].pct,
      gameRate: team.attempts > 0 ? roundValue((team.zones[key].attempts / team.attempts) * 100, 1) : 0,
      seasonRate: season.attempts > 0 ? roundValue((season.zones[key].attempts / season.attempts) * 100, 1) : 0,
      rateDelta: team.attempts > 0 && season.attempts > 0
        ? roundValue((team.zones[key].attempts / team.attempts) * 100 - (season.zones[key].attempts / season.attempts) * 100, 1)
        : 0,
      pctDelta: roundValue(team.zones[key].pct - season.zones[key].pct, 1),
    });

    return [
      makeRow('rim', 'Gyűrű'),
      makeRow('paint', 'Festék'),
      makeRow('mid', 'Középtáv'),
      makeRow('corner3', 'Sarok tripla'),
      makeRow('aboveBreak3', 'Egyéb tripla'),
    ];
  }, [postgameReport]);

  const selectedZoneDrilldown = useMemo(() => {
    if (!selectedPostgameZone) return null;
    return postgameZoneDrilldownRows.find(row => row.key === selectedPostgameZone) ?? null;
  }, [postgameZoneDrilldownRows, selectedPostgameZone]);

  const selectedFactorDrilldown = useMemo(() => {
    if (!postgameReport || !selectedPostgameFactor) return null;
    const factor = postgameReport.decisiveFactorMeta.find(item => item.label === selectedPostgameFactor);
    if (!factor) return null;

    const relatedStats = postgameReport.metrics.keyStats.filter(stat => {
      const l = factor.label.toLowerCase();
      if (l.includes('3p') || l.includes('periméter')) return stat.key.includes('three');
      if (l.includes('ft')) return stat.key.includes('ft');
      if (l.includes('oreb') || l.includes('második')) return stat.key.includes('oreb');
      if (l.includes('labdajár') || l.includes('assist')) return stat.key.includes('assist');
      if (l.includes('to') || l.includes('labdaelad')) return stat.key.includes('turnover');
      return stat.key.includes('efg') || stat.key.includes('pace');
    }).slice(0, 2);

    return {
      ...factor,
      relatedStats,
    };
  }, [postgameReport, selectedPostgameFactor]);

  const opponentLinkedBreakdown = useMemo(() => {
    if (!postgameReport) return [] as Array<{ title: string; detail: string; linkedFactor?: string }>;
    const defenseFactors = postgameReport.decisiveFactorMeta.filter(item => item.axis === 'defense');
    const offenseIssues = postgameReport.decisiveFactorMeta
      .filter(item => item.axis === 'offense')
      .filter(item => /gyenge|akadozott|szétesett|kevés|hiány/i.test(item.label));

    const lines: Array<{ title: string; detail: string; linkedFactor?: string }> = [];
    defenseFactors.slice(0, 2).forEach(item => {
      lines.push({
        title: `${postgameReport.opponentName} erősség`,
        detail: item.label,
        linkedFactor: item.label,
      });
    });
    offenseIssues.slice(0, 2).forEach(item => {
      lines.push({
        title: `${postgameReport.teamName} javítandó`,
        detail: item.label,
        linkedFactor: item.label,
      });
    });
    return lines;
  }, [postgameReport]);

  const nextGameAutoFocus = useMemo(() => {
    if (!postgameReport) return [] as string[];
    const factorHint = opponentLinkedBreakdown[0]?.detail;
    const focus = [...postgameReport.nextFocus];
    if (factorHint) {
      focus.unshift(`Ellenfél-specifikus fókusz: ${factorHint}.`);
    }
    if (postgameReport.problems.length > 0) {
      focus.push(`Mérkőzés utáni javítás: ${postgameReport.problems[0]}.`);
    }
    return Array.from(new Set(focus)).slice(0, 3);
  }, [opponentLinkedBreakdown, postgameReport]);

  const playerUsageVsTsData = useMemo(() => {
    if (!postgameReport?.playerReport?.players) return [] as Array<{ name: string; usagePct: number; tsPct: number; valPer36: number }>;
    return postgameReport.playerReport.players.map(player => ({
      name: player.name,
      usagePct: roundValue(player.usageShare * 100, 1),
      tsPct: roundValue(player.tsPct, 1),
      valPer36: roundValue(player.valPer36, 1),
    }));
  }, [postgameReport]);

  const playerTrendSeries = useMemo(() => {
    if (!resolvedTeamId || !selectedTrendPlayerId) {
      return [] as Array<{ label: string; tsPct: number; usagePct: number; valPer36: number }>;
    }

    const gamesByTeam = teamGamePlayerRows.get(resolvedTeamId);
    if (!gamesByTeam) return [] as Array<{ label: string; tsPct: number; usagePct: number; valPer36: number }>;

    const rows = Array.from(gamesByTeam.entries())
      .map(([gameId, players]) => {
        const target = players.find(item => item.player_id === selectedTrendPlayerId);
        if (!target) return null;

        const usage = (target.close_attempted || 0) + (target.mid_attempted || 0) + (target.three_attempted || 0) + 0.44 * (target.free_throw_attempted || 0) + (target.turnovers || 0);
        const totalUsage = players.reduce((sum, row) => {
          const rowUsage = (row.close_attempted || 0) + (row.mid_attempted || 0) + (row.three_attempted || 0) + 0.44 * (row.free_throw_attempted || 0) + (row.turnovers || 0);
          return sum + rowUsage;
        }, 0);
        const fga = (target.close_attempted || 0) + (target.mid_attempted || 0) + (target.three_attempted || 0);
        const tsDenominator = 2 * (fga + 0.44 * (target.free_throw_attempted || 0));
        const tsPct = tsDenominator > 0 ? (target.points || 0) / tsDenominator * 100 : 0;
        const valPer36 = (target.minutes || 0) > 0 ? ((target.valuation || 0) / (target.minutes || 1)) * 36 : 0;
        const dateValue = target.games?.date ? new Date(target.games.date).getTime() : 0;

        return {
          gameId,
          dateValue,
          label: target.games?.date
            ? new Date(target.games.date).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })
            : 'Ismeretlen',
          tsPct: roundValue(tsPct, 1),
          usagePct: totalUsage > 0 ? roundValue((usage / totalUsage) * 100, 1) : 0,
          valPer36: roundValue(valPer36, 1),
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => b.dateValue - a.dateValue)
      .slice(0, 8)
      .reverse();

    return rows;
  }, [resolvedTeamId, selectedTrendPlayerId, teamGamePlayerRows]);

  const bubbleLabelOffsets = useMemo(
    () => [
      { dx: 0, dy: -12 },
      { dx: 12, dy: -2 },
      { dx: -12, dy: -2 },
      { dx: 0, dy: 12 },
      { dx: 14, dy: 10 },
      { dx: -14, dy: 10 },
      { dx: 18, dy: -10 },
      { dx: -18, dy: -10 },
    ],
    []
  );

  const formatBubbleLabel = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const base = parts.length > 1 ? parts[parts.length - 1] : (parts[0] ?? '');
    return base.length > 12 ? `${base.slice(0, 11)}…` : base;
  };

  const renderUsageTsBubbleLabel = (props: RechartsLabelProps) => {
    const x = typeof props.x === 'number' ? props.x : Number(props.x);
    const y = typeof props.y === 'number' ? props.y : Number(props.y);
    if (!Number.isFinite(x) || !Number.isFinite(y) || props.value === null || props.value === undefined || props.value === false) return null;
    const index = typeof props.index === 'number' ? props.index : 0;
    const offset = bubbleLabelOffsets[index % bubbleLabelOffsets.length];
    const label = formatBubbleLabel(String(props.value));
    const textWidth = Math.max(24, label.length * 6.2);
    const rectX = x + offset.dx - textWidth / 2;
    const rectY = y + offset.dy - 8;

    return (
      <g pointerEvents="none">
        <rect
          x={rectX}
          y={rectY}
          width={textWidth}
          height={14}
          rx={4}
          fill="rgba(15, 23, 42, 0.85)"
          stroke="rgba(100, 116, 139, 0.7)"
          strokeWidth={0.6}
        />
        <text
          x={x + offset.dx}
          y={y + offset.dy + 2}
          fill="#e2e8f0"
          textAnchor="middle"
          fontSize={10}
          fontWeight={500}
        >
          {label}
        </text>
      </g>
    );
  };

  useEffect(() => {
    if (!postgameReport?.playerReport?.players?.length) {
      setSelectedTrendPlayerId('');
      return;
    }

    if (postgameReport.playerReport.players.some(player => player.playerId === selectedTrendPlayerId)) return;
    setSelectedTrendPlayerId(postgameReport.playerReport.players[0].playerId);
  }, [postgameReport, selectedTrendPlayerId]);

  useEffect(() => {
    if (!postgameReport?.decisiveFactorMeta?.length) {
      setSelectedPostgameFactor(null);
      return;
    }
    if (selectedPostgameFactor && postgameReport.decisiveFactorMeta.some(item => item.label === selectedPostgameFactor)) return;
    setSelectedPostgameFactor(postgameReport.decisiveFactorMeta[0].label);
  }, [postgameReport, selectedPostgameFactor]);

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
    setPlayerSeasonSaveStatus(null);
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

  const handleGenerateTeamNarrative = async () => {
    if (!displayTeamAnalysis || !resolvedSeasonId || !resolvedTeamId || resolvedTeamId === 'all') return;

    setIsGeneratingTeamNarrative(true);
    setTeamNarrative({ status: 'loading' });

    try {
      const response = await fetch('/api/generate-team-analysis-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonId: resolvedSeasonId,
          teamId: resolvedTeamId,
          teamName: displayTeamAnalysis.teamName,
          stylePreset: teamNarrativeStyle,
          teamAnalysis: displayTeamAnalysis,
          shotProfile: teamSeasonShotSummary
            ? {
                attempts: teamSeasonShotSummary.attempts,
                made: teamSeasonShotSummary.made,
                fgPct: teamSeasonShotSummary.fgPct,
                zones: teamSeasonShotZoneRows,
              }
            : null,
          tacticalWeaknesses: teamTacticalWeaknesses,
          generatedBy: 'season-comparison-ui',
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        narrative?: string;
        generatedAt?: string;
        generatedBy?: string;
        report?: TeamTextReportRow;
        error?: string;
      };

      if (!response.ok || !payload.ok || !payload.narrative) {
        throw new Error(payload.error ?? 'A csapat LLM értékelés generálása nem sikerült.');
      }

      setTeamNarrative({
        status: 'success',
        text: payload.narrative ?? payload.report?.narrative,
        generatedAt: payload.report?.generated_at ?? payload.generatedAt ?? new Date().toISOString(),
        generatedBy: payload.report?.generated_by ?? payload.generatedBy ?? 'gpt-automata',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ismeretlen hiba történt.';
      setTeamNarrative({ status: 'error', error: message });
    } finally {
      setIsGeneratingTeamNarrative(false);
    }
  };

  const handleTogglePlayerDetail = (playerId: string) => {
    setExpandedPlayerImpactId(current => (current === playerId ? null : playerId));
  };

  const handleGeneratePlayerSeasonNarrative = async () => {
    if (!analysis || !selectedPlayer || !resolvedSeasonId) return;

    setIsGeneratingPlayerSeasonText(true);
    setPlayerSeasonSaveStatus(null);
    setPlayerNarratives(prev => ({
      ...prev,
      [selectedPlayer.id]: { status: 'loading' },
    }));

    try {
      const response = await fetch('/api/generate-player-season-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonId: resolvedSeasonId,
          teamId: selectedPlayer.teamId ?? null,
          teamName: selectedPlayer.teamName ?? null,
          playerId: selectedPlayer.id,
          playerName: selectedPlayer.name,
          generatedBy: 'season-comparison-ui',
          analysis,
          shotProfile: playerSeasonShotSummary
            ? {
                attempts: playerSeasonShotSummary.attempts,
                made: playerSeasonShotSummary.made,
                fgPct: playerSeasonShotSummary.fgPct,
                zones: playerShotZoneRows,
              }
            : null,
          recentGames: lastFiveGames.map(game => ({
            date: game.games?.date ?? null,
            opponent: game.games?.opponent ?? null,
            points: game.points,
            minutes: game.minutes,
            valuation: game.valuation,
            assists: game.assists,
            rebounds: game.total_rebounds,
            turnovers: game.turnovers,
          })),
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        narrative?: string;
        report?: { generated_at?: string | null; generated_by?: string | null };
        error?: string;
      };

      if (!response.ok || !payload.ok || !payload.narrative) {
        throw new Error(payload.error ?? 'A játékos szezonértékelés generálása nem sikerült.');
      }

      setPlayerNarratives(prev => ({
        ...prev,
        [selectedPlayer.id]: {
          status: 'success',
          text: payload.narrative,
          generatedAt: payload.report?.generated_at ?? new Date().toISOString(),
          generatedBy: payload.report?.generated_by ?? 'gpt-automata',
        },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ismeretlen hiba történt.';
      setPlayerNarratives(prev => ({
        ...prev,
        [selectedPlayer.id]: {
          status: 'error',
          error: message,
        },
      }));
    } finally {
      setIsGeneratingPlayerSeasonText(false);
    }
  };

  const handleSavePlayerSeasonNarrative = async () => {
    if (!analysis || !selectedPlayer || !resolvedSeasonId) return;
    const current = playerNarratives[selectedPlayer.id];
    const narrative = current?.text?.trim();
    if (!narrative) return;

    setIsSavingPlayerSeasonText(true);
    setPlayerSeasonSaveStatus(null);

    try {
      const response = await fetch('/api/player-text-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonId: resolvedSeasonId,
          teamId: selectedPlayer.teamId ?? null,
          playerId: selectedPlayer.id,
          reportType: 'season',
          narrative,
          generatedBy: 'season-comparison-ui',
          analysisSnapshot: {
            analysis,
            shotProfile: playerSeasonShotSummary
              ? {
                  attempts: playerSeasonShotSummary.attempts,
                  made: playerSeasonShotSummary.made,
                  fgPct: playerSeasonShotSummary.fgPct,
                  zones: playerShotZoneRows,
                }
              : null,
            recentGames: lastFiveGames.map(game => ({
              date: game.games?.date ?? null,
              opponent: game.games?.opponent ?? null,
              points: game.points,
              minutes: game.minutes,
              valuation: game.valuation,
              assists: game.assists,
              rebounds: game.total_rebounds,
              turnovers: game.turnovers,
            })),
          },
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        report?: { generated_at?: string | null; generated_by?: string | null; narrative?: string | null };
        error?: string;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? 'A játékos szezonértékelés mentése nem sikerült.');
      }

      setPlayerNarratives(prev => ({
        ...prev,
        [selectedPlayer.id]: {
          status: 'success',
          text: payload.report?.narrative ?? narrative,
          generatedAt: payload.report?.generated_at ?? new Date().toISOString(),
          generatedBy: payload.report?.generated_by ?? 'season-comparison-ui',
        },
      }));

      setPlayerSeasonSaveStatus({ type: 'success', message: 'Játékos szezonértékelés elmentve.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ismeretlen hiba történt a mentés során.';
      setPlayerSeasonSaveStatus({ type: 'error', message });
    } finally {
      setIsSavingPlayerSeasonText(false);
    }
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

                <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm text-slate-300 font-medium">GPT szezonértékelés</div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleGeneratePlayerSeasonNarrative}
                        disabled={isGeneratingPlayerSeasonText}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white"
                      >
                        {isGeneratingPlayerSeasonText ? 'Generálás...' : 'Komplex játékos elemzés'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleSavePlayerSeasonNarrative}
                        disabled={
                          isSavingPlayerSeasonText
                          || !playerNarratives[selectedPlayer.id]?.text
                        }
                        className="border-slate-700 text-slate-200 hover:bg-slate-800"
                      >
                        {isSavingPlayerSeasonText ? 'Mentés...' : 'Mentés'}
                      </Button>
                    </div>
                  </div>

                  {playerSeasonSaveStatus && (
                    <div className={`text-xs ${playerSeasonSaveStatus.type === 'success' ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {playerSeasonSaveStatus.message}
                    </div>
                  )}

                  {playerNarratives[selectedPlayer.id]?.status === 'loading' && (
                    <div className="text-sm text-slate-400">Játékos szezonértékelés generálása folyamatban...</div>
                  )}

                  {playerNarratives[selectedPlayer.id]?.status === 'error' && (
                    <div className="text-sm text-rose-300">{playerNarratives[selectedPlayer.id]?.error ?? 'Hiba történt.'}</div>
                  )}

                  {playerNarratives[selectedPlayer.id]?.status === 'success' && playerNarratives[selectedPlayer.id]?.text && (
                    <>
                      <div className="text-xs text-slate-500">
                        {playerNarratives[selectedPlayer.id]?.generatedAt
                          ? `Mentve: ${formatGeneratedAt(playerNarratives[selectedPlayer.id]?.generatedAt) ?? 'ismeretlen'}${playerNarratives[selectedPlayer.id]?.generatedBy ? ` • Forrás: ${playerNarratives[selectedPlayer.id]?.generatedBy}` : ''}`
                          : 'Mentett játékos szezonértékelés'}
                      </div>
                      <div className="text-sm text-slate-100 whitespace-pre-line leading-relaxed">
                        {playerNarratives[selectedPlayer.id]?.text}
                      </div>
                    </>
                  )}
                </div>

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
                <CardTitle className="text-slate-50">Személyes dobásprofil (szezon)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {playerSeasonShotSummary ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-3 bg-slate-800/50 rounded-lg">
                        <div className="text-xs text-slate-400">Kísérlet</div>
                        <div className="text-slate-50 text-lg font-medium">{playerSeasonShotSummary.attempts}</div>
                      </div>
                      <div className="p-3 bg-slate-800/50 rounded-lg">
                        <div className="text-xs text-slate-400">Bedobott</div>
                        <div className="text-slate-50 text-lg font-medium">{playerSeasonShotSummary.made}</div>
                      </div>
                      <div className="p-3 bg-slate-800/50 rounded-lg">
                        <div className="text-xs text-slate-400">FG%</div>
                        <div className="text-slate-50 text-lg font-medium">{formatShotPct(playerSeasonShotSummary.fgPct)}</div>
                      </div>
                      <div className="p-3 bg-slate-800/50 rounded-lg">
                        <div className="text-xs text-slate-400">Mintanagyság</div>
                        <div className="text-slate-50 text-lg font-medium">Hunbasket</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      <div className="p-3 bg-slate-800/40 rounded-lg">
                        <div className="text-sm text-slate-300 font-medium mb-2">Zónavolumen (kísérlet)</div>
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={playerShotZoneRows} margin={{ left: 8, right: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis
                              dataKey="label"
                              stroke="#94a3b8"
                              tick={{ fontSize: 10 }}
                              interval={0}
                              angle={-18}
                              textAnchor="end"
                              tickMargin={10}
                              height={52}
                
                            />
                            <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} allowDecimals={false} />
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
                            <Bar dataKey="attempts" name="Kísérlet" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="p-3 bg-slate-800/40 rounded-lg">
                        <div className="text-sm text-slate-300 font-medium mb-2">Zónahatékonyság (FG%)</div>
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={playerShotZoneRows} margin={{ left: 8, right: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis
                              dataKey="label"
                              stroke="#94a3b8"
                              tick={{ fontSize: 10 }}
                              interval={0}
                              angle={-18}
                              textAnchor="end"
                              tickMargin={10}
                              height={52}
                            />
                            <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} domain={[0, 100]} />
                            <Tooltip
                              formatter={(value: number | string | undefined) => `${Number(value ?? 0).toFixed(1)}%`}
                              contentStyle={{
                                backgroundColor: '#0f172a',
                                border: '1px solid #475569',
                                borderRadius: '8px',
                                color: '#f1f5f9',
                              }}
                              labelStyle={{ color: '#f1f5f9', fontWeight: 'bold' }}
                              itemStyle={{ color: '#e2e8f0' }}
                            />
                            <Bar dataKey="pct" name="FG%" fill="#22c55e" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-slate-400">Ehhez a játékoshoz még nincs elég Hunbasket dobástérkép adat.</div>
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

              <div className="rounded-lg border border-slate-800 bg-slate-900/45 p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm text-slate-300 font-medium">LLM csapatértékelés (gyenge pontok és matchup következmény)</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900/60 p-1">
                      {[
                        { key: 'fan', label: 'Szurkolóbarát' },
                        { key: 'coach', label: 'Edzői' },
                        { key: 'scouting', label: 'Scouting' },
                      ].map(option => (
                        <Button
                          key={`team-style-${option.key}`}
                          type="button"
                          size="sm"
                          variant={teamNarrativeStyle === option.key ? 'default' : 'outline'}
                          className={teamNarrativeStyle === option.key
                            ? 'h-7 px-2 bg-cyan-300 text-slate-900 hover:bg-cyan-200'
                            : 'h-7 px-2 border-slate-700 text-slate-300 hover:bg-slate-800'}
                          onClick={() => setTeamNarrativeStyle(option.key as 'fan' | 'coach' | 'scouting')}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleGenerateTeamNarrative}
                      disabled={isGeneratingTeamNarrative || !displayTeamAnalysis}
                      className="bg-indigo-500 hover:bg-indigo-400 text-white disabled:opacity-60"
                    >
                      {isGeneratingTeamNarrative ? 'LLM értékelés készül…' : teamNarrative.status === 'success' ? 'LLM értékelés frissítése' : 'LLM értékelés generálása'}
                    </Button>
                  </div>
                </div>
                {teamNarrative.status === 'error' && (
                  <div className="text-xs text-rose-300">{teamNarrative.error}</div>
                )}
                {teamNarrative.status === 'success' && teamNarrative.text && (
                  <div className="space-y-1">
                    <div className="text-[11px] text-slate-500">
                      Generálva: {formatGeneratedAt(teamNarrative.generatedAt) ?? 'ismeretlen'}
                      {teamNarrative.generatedBy ? ` • Forrás: ${teamNarrative.generatedBy}` : ''}
                    </div>
                    <div className="rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm text-slate-100 whitespace-pre-line">
                      {teamNarrative.text}
                    </div>
                  </div>
                )}
                {teamNarrative.status === 'idle' && (
                  <div className="text-xs text-slate-400">
                    Aktív stílus: {teamNarrativeStyle === 'fan' ? 'szurkolóbarát' : teamNarrativeStyle === 'coach' ? 'edzői' : 'scouting'}.
                    A gomb a meglévő csapat metrikákból és dobásprofilból készít szöveges taktikai értékelést.
                  </div>
                )}
              </div>

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

              <div className="space-y-2">
                <div className="text-sm text-slate-300 font-medium">Szezon dobásprofil (Hunbasket)</div>
                {teamSeasonShotSummary ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="rounded-md bg-slate-900/50 border border-slate-800 px-3 py-2">
                        <div className="text-xs text-slate-400">Kísérlet</div>
                        <div className="text-slate-100 font-medium">{teamSeasonShotSummary.attempts}</div>
                      </div>
                      <div className="rounded-md bg-slate-900/50 border border-slate-800 px-3 py-2">
                        <div className="text-xs text-slate-400">Bedobott</div>
                        <div className="text-slate-100 font-medium">{teamSeasonShotSummary.made}</div>
                      </div>
                      <div className="rounded-md bg-slate-900/50 border border-slate-800 px-3 py-2">
                        <div className="text-xs text-slate-400">FG%</div>
                        <div className="text-slate-100 font-medium">{formatShotPct(teamSeasonShotSummary.fgPct)}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      <div className="p-3 bg-slate-800/40 rounded-lg">
                        <div className="text-sm text-slate-300 font-medium mb-2">Zónaeloszlás (%)</div>
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={teamSeasonShotZoneRows} margin={{ left: 8, right: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                            <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} domain={[0, 60]} />
                            <Tooltip
                              formatter={(value: number | string | undefined) => `${Number(value ?? 0).toFixed(1)}%`}
                              contentStyle={{
                                backgroundColor: '#0f172a',
                                border: '1px solid #475569',
                                borderRadius: '8px',
                                color: '#f1f5f9',
                              }}
                              labelStyle={{ color: '#f1f5f9', fontWeight: 'bold' }}
                              itemStyle={{ color: '#e2e8f0' }}
                            />
                            <Legend wrapperStyle={{ color: '#94a3b8' }} verticalAlign="top" height={24} />
                            <Bar dataKey="rate" name="Zónaarány" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="p-3 bg-slate-800/40 rounded-lg">
                        <div className="text-sm text-slate-300 font-medium mb-2">Zónahatékonyság (FG%)</div>
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={teamSeasonShotZoneRows} margin={{ left: 8, right: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                            <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} domain={[0, 100]} />
                            <Tooltip
                              formatter={(value: number | string | undefined) => `${Number(value ?? 0).toFixed(1)}%`}
                              contentStyle={{
                                backgroundColor: '#0f172a',
                                border: '1px solid #475569',
                                borderRadius: '8px',
                                color: '#f1f5f9',
                              }}
                              labelStyle={{ color: '#f1f5f9', fontWeight: 'bold' }}
                              itemStyle={{ color: '#e2e8f0' }}
                            />
                            <Legend wrapperStyle={{ color: '#94a3b8' }} verticalAlign="top" height={24} />
                            <Bar dataKey="pct" name="FG%" fill="#22c55e" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {teamSeasonHeatmapRows.length > 0 && (
                      <div className="p-3 bg-slate-800/40 rounded-lg space-y-2">
                        <div className="text-sm text-slate-300 font-medium">Szezon zóna heatmap</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <div className="text-xs text-slate-400">Volumen (kísérlet)</div>
                            {teamSeasonHeatmapRows.map(row => (
                              <div key={`team-heat-rate-${row.label}`} className="rounded-md border border-slate-700/80 px-2 py-1" style={{
                                backgroundColor: `rgba(56, 189, 248, ${0.14 + row.rateNorm * 0.56})`,
                              }}>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-slate-100">{row.label}</span>
                                  <span className="text-slate-900/90 font-semibold">{row.attempts} ({row.rate.toFixed(1)}%)</span>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="space-y-1">
                            <div className="text-xs text-slate-400">Hatékonyság (FG%)</div>
                            {teamSeasonHeatmapRows.map(row => (
                              <div key={`team-heat-pct-${row.label}`} className="rounded-md border border-slate-700/80 px-2 py-1" style={{
                                backgroundColor: `rgba(34, 197, 94, ${0.14 + row.pctNorm * 0.56})`,
                              }}>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-slate-100">{row.label}</span>
                                  <span className="text-slate-900/90 font-semibold">{row.pct.toFixed(1)}%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {teamLeagueRelativeZoneRows.length > 0 && (
                      <div className="p-3 bg-slate-800/40 rounded-lg space-y-2">
                        <div className="text-sm text-slate-300 font-medium">Liga-átlag overlay (relatív zónadelta)</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {teamLeagueRelativeZoneRows.map(row => {
                            const tone = row.rateDelta >= 0 ? 'text-emerald-300' : 'text-rose-300';
                            const tonePct = row.pctDelta >= 0 ? 'text-emerald-300' : 'text-rose-300';
                            const bgAlpha = Math.min(0.12 + Math.abs(row.rateDelta) / 25, 0.5);
                            return (
                              <div
                                key={`league-overlay-${row.label}`}
                                className="rounded-md border border-slate-700/80 px-2.5 py-2"
                                style={{
                                  backgroundColor: row.rateDelta >= 0
                                    ? `rgba(16, 185, 129, ${bgAlpha})`
                                    : `rgba(244, 63, 94, ${bgAlpha})`,
                                }}
                              >
                                <div className="text-xs text-slate-100 font-medium">{row.label}</div>
                                <div className="text-xs text-slate-300 mt-1">
                                  Volumen delta: <span className={tone}>{row.rateDelta >= 0 ? '+' : ''}{row.rateDelta.toFixed(1)} pp</span>
                                </div>
                                <div className="text-xs text-slate-300">
                                  FG% delta: <span className={tonePct}>{row.pctDelta >= 0 ? '+' : ''}{row.pctDelta.toFixed(1)} pp</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="text-[11px] text-slate-500">Pozitív delta: csapat a ligaátlag felett, negatív delta: ligaátlag alatt.</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-slate-400">Nincs elérhető szezon dobástérkép adat ehhez a csapathoz.</div>
                )}
              </div>

              {teamTacticalWeaknesses.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm text-slate-300 font-medium">Adatalapú taktikai gyenge pontok</div>
                  {teamTacticalWeaknesses.map(item => (
                    <div key={item} className="text-sm text-amber-100 rounded-md border border-amber-700/40 bg-amber-950/20 px-3 py-2">• {item}</div>
                  ))}
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
                Utolsó 5 meccs súlyozása
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
            const riskScenarios = pregameReport.riskScenarios ?? [];
            const xFactorImpact = pregameReport.xFactorImpact;
            const fanSummary = pregameReport.fanSummary;
            const advancedPlayers = pregameReport.advancedPlayers;
            const calibrationDiagnostics = pregameReport.calibrationDiagnostics;
            const ownProfile = pregameReport.ownTeamProfile;
            const opponentProfile = pregameReport.profile;
            const llmContext = pregameReport.llmContext;
            const pressureWeight = pregamePressureWeight;
            const perimeterWeight = pregamePerimeterWeight;
            const paintWeight = Math.max(0, 100 - pressureWeight - perimeterWeight);

            const scoreFocusPriority = (item: string) => {
              const lowered = item.toLowerCase();
              const pressureScore = /labdaelad|nyomás|letámadás|labdaszerzés|to/.test(lowered) ? pressureWeight : 0;
              const perimeterScore = /tripla|periméter|kilépés|closeout|3p/.test(lowered) ? perimeterWeight : 0;
              const paintScore = /festék|lepattanó|oreb|betörés|fault/.test(lowered) ? paintWeight : 0;
              const coverage = [pressureScore > 0, perimeterScore > 0, paintScore > 0].filter(Boolean).length;
              if (coverage === 0) return (pressureWeight + perimeterWeight + paintWeight) / 3;
              return pressureScore + perimeterScore + paintScore;
            };

            const prioritizedFocusPoints = [...pregameReport.focusPoints]
              .map(item => ({ item, priorityScore: scoreFocusPriority(item) }))
              .sort((a, b) => b.priorityScore - a.priorityScore)
              .map(item => item.item);

            const adjustedScenarioOutcomes = (pregameReport.scenarioOutcomes ?? []).map(scenario => {
              let interactiveDelta = 0;
              if (scenario.key === 'controlled_tempo') {
                interactiveDelta = (paintWeight - 33) * 0.06 + (pressureWeight - 33) * 0.03 + (perimeterWeight - 33) * 0.02;
              } else if (scenario.key === 'high_variance') {
                interactiveDelta = (pressureWeight - 33) * 0.04 - (perimeterWeight - 33) * 0.06;
              }
              const ownPct = Math.max(8, Math.min(92, scenario.ownPct + interactiveDelta));
              const opponentPct = 100 - ownPct;
              return {
                ...scenario,
                ownPct,
                opponentPct,
                deltaVsBase: ownPct - pregameReport.winProbability.ownPct,
              };
            });

            const scenarioChartData = adjustedScenarioOutcomes.map(item => ({
              label: item.label,
              ownPct: roundValue(item.ownPct, 1),
              opponentPct: roundValue(item.opponentPct, 1),
            }));

            const calibrationChartData = (calibrationDiagnostics?.dimensions ?? []).map(item => ({
              label: item.label,
              score: item.score,
              note: item.note,
            }));

            const focusWeightBars = [
              { label: 'Labdanyomás', value: pressureWeight, fill: '#f59e0b' },
              { label: 'Periméter', value: perimeterWeight, fill: '#38bdf8' },
              { label: 'Festék', value: paintWeight, fill: '#10b981' },
            ];
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

                {fanSummary && (
                  <div className="p-3 bg-slate-800/50 rounded-lg space-y-3">
                    <div className="text-sm text-slate-300 font-medium">Szurkolói gyorskép</div>
                    <div className="text-sm text-slate-100">{fanSummary.headline}</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div className="bg-slate-900/40 border border-slate-800 rounded-md p-2">
                        <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Előnyeink</div>
                        {fanSummary.keyEdges.length > 0 ? fanSummary.keyEdges.map(item => (
                          <div key={`fan-edge-${item}`} className="text-slate-200">• {item}</div>
                        )) : <div className="text-slate-500">Nincs kiemelt előny.</div>}
                      </div>
                      <div className="bg-slate-900/40 border border-slate-800 rounded-md p-2">
                        <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Fő kockázatok</div>
                        {fanSummary.majorRisks.length > 0 ? fanSummary.majorRisks.map(item => (
                          <div key={`fan-risk-${item}`} className="text-slate-200">• {item}</div>
                        )) : <div className="text-slate-500">Nincs kiemelt kockázat.</div>}
                      </div>
                      <div className="bg-slate-900/40 border border-slate-800 rounded-md p-2">
                        <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Meccsterv</div>
                        {fanSummary.gamePlan.length > 0 ? fanSummary.gamePlan.map(item => (
                          <div key={`fan-plan-${item}`} className="text-slate-200">• {item}</div>
                        )) : <div className="text-slate-500">Nincs kiemelt meccsterv.</div>}
                      </div>
                      <div className="bg-slate-900/40 border border-slate-800 rounded-md p-2">
                        <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">B terv</div>
                        {fanSummary.fallbackPlan.length > 0 ? fanSummary.fallbackPlan.map(item => (
                          <div key={`fan-fallback-${item}`} className="text-slate-200">• {item}</div>
                        )) : <div className="text-slate-500">Nincs kiemelt fallback.</div>}
                      </div>
                    </div>
                  </div>
                )}

                {(pregameInjuryImpactEstimate.own.valPer36 > 0 || pregameInjuryImpactEstimate.opponent.valPer36 > 0) && (
                  <div className="p-3 bg-slate-800/50 rounded-lg space-y-2">
                    <div className="text-sm text-slate-300 font-medium">Hiányzások becsült hatása</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div className="bg-slate-900/40 border border-slate-800 rounded-md p-2">
                        <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Saját kiesés</div>
                        <div className="text-rose-200">-{pregameInjuryImpactEstimate.own.valPer36.toFixed(1)} VAL/36</div>
                        <div className="text-rose-200">-{pregameInjuryImpactEstimate.own.pointsPer36.toFixed(1)} pont/36</div>
                        {pregameInjuryImpactEstimate.own.coreNames.length > 0 && (
                          <div className="text-xs text-slate-300 mt-1">
                            Kulcs kiesők: {pregameInjuryImpactEstimate.own.coreNames.join(', ')}
                          </div>
                        )}
                      </div>
                      <div className="bg-slate-900/40 border border-slate-800 rounded-md p-2">
                        <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Ellenfél kiesés</div>
                        <div className="text-emerald-200">-{pregameInjuryImpactEstimate.opponent.valPer36.toFixed(1)} VAL/36</div>
                        <div className="text-emerald-200">-{pregameInjuryImpactEstimate.opponent.pointsPer36.toFixed(1)} pont/36</div>
                        {pregameInjuryImpactEstimate.opponent.coreNames.length > 0 && (
                          <div className="text-xs text-slate-300 mt-1">
                            Kulcs kiesők: {pregameInjuryImpactEstimate.opponent.coreNames.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

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

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-800/50 rounded-lg">
                    <div className="text-sm text-slate-300 font-medium mb-2">Támadó-védő profil mutatók</div>
                    <ResponsiveContainer width="100%" height={230}>
                      <BarChart data={pregameStyleMetricChartData} margin={{ left: 8, right: 8 }}>
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
                        />
                        <Legend wrapperStyle={{ color: '#94a3b8' }} />
                        <Bar dataKey="own" name={ownLabel} fill="#10b981" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="opponent" name={opponentLabel} fill="#f97316" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="text-xs text-slate-500 mt-1">
                      Tempó, tripla-, TO- és FT-mutatók összevetése gyors meccsképhez.
                    </div>
                  </div>

                  <div className="p-3 bg-slate-800/50 rounded-lg space-y-3">
                    <div className="text-sm text-slate-300 font-medium">Interaktív fókusz prioritás</div>
                    <div className="text-xs text-slate-400">Súlyozd a meccsterv hangsúlyait, a forgatókönyvek azonnal frissülnek.</div>
                    <div className="space-y-2 text-xs text-slate-300">
                      <label className="block">
                        <div className="flex justify-between mb-1"><span>Labdanyomás</span><span>{pressureWeight}%</span></div>
                        <input
                          type="range"
                          min={0}
                          max={100 - perimeterWeight}
                          step={1}
                          value={pressureWeight}
                          onChange={event => setPregamePressureWeight(Math.min(Number(event.target.value), 100 - perimeterWeight))}
                          className="w-full accent-amber-400"
                        />
                      </label>
                      <label className="block">
                        <div className="flex justify-between mb-1"><span>Periméter kontroll</span><span>{perimeterWeight}%</span></div>
                        <input
                          type="range"
                          min={0}
                          max={100 - pressureWeight}
                          step={1}
                          value={perimeterWeight}
                          onChange={event => setPregamePerimeterWeight(Math.min(Number(event.target.value), 100 - pressureWeight))}
                          className="w-full accent-sky-400"
                        />
                      </label>
                      <div className="flex justify-between"><span>Festék kontroll (auto)</span><span>{paintWeight}%</span></div>
                    </div>

                    <ResponsiveContainer width="100%" height={120}>
                      <BarChart data={focusWeightBars} layout="vertical" margin={{ left: 10, right: 10 }}>
                        <XAxis type="number" domain={[0, 100]} stroke="#94a3b8" tick={{ fontSize: 10 }} />
                        <YAxis dataKey="label" type="category" stroke="#94a3b8" tick={{ fontSize: 10 }} width={90} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            border: '1px solid #475569',
                            borderRadius: '8px',
                            color: '#f1f5f9',
                          }}
                        />
                        <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                          {focusWeightBars.map(item => (
                            <Cell key={`priority-${item.label}`} fill={item.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {scenarioChartData.length > 0 && (
                  <div className="p-3 bg-slate-800/50 rounded-lg space-y-3">
                    <div className="text-sm text-slate-300 font-medium">Forgatókönyv-modellezés</div>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={scenarioChartData} margin={{ left: 8, right: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                        <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} domain={[0, 100]} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            border: '1px solid #475569',
                            borderRadius: '8px',
                            color: '#f1f5f9',
                          }}
                        />
                        <Legend wrapperStyle={{ color: '#94a3b8' }} />
                        <Bar dataKey="ownPct" name={ownLabel} fill="#10b981" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="opponentPct" name={opponentLabel} fill="#f97316" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="space-y-2">
                      {adjustedScenarioOutcomes.map(item => (
                        <div
                          key={item.key}
                          className="bg-slate-900/40 border border-slate-800 rounded-md px-3 py-2 text-xs text-slate-300"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-slate-100 font-medium">{item.label}</span>
                            <span className={item.deltaVsBase >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                              {item.deltaVsBase >= 0 ? '+' : ''}{item.deltaVsBase.toFixed(1)} pp vs alap
                            </span>
                          </div>
                          <div className="mt-1 text-slate-400">{item.note}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {calibrationDiagnostics && calibrationChartData.length > 0 && (
                  <div className="p-3 bg-slate-800/50 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-slate-300 font-medium">Kalibrációs diagnosztika</div>
                      <div
                        className={`text-xs px-2 py-1 rounded-full border ${
                          calibrationDiagnostics.overallIntensity >= 70
                            ? 'bg-rose-900/40 border-rose-700/60 text-rose-200'
                            : calibrationDiagnostics.overallIntensity >= 45
                              ? 'bg-amber-900/40 border-amber-700/60 text-amber-200'
                              : 'bg-emerald-900/40 border-emerald-700/60 text-emerald-200'
                        }`}
                      >
                        Össz-intenzitás: {calibrationDiagnostics.overallIntensity.toFixed(1)}
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={calibrationChartData} layout="vertical" margin={{ left: 10, right: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis type="number" domain={[0, 100]} stroke="#94a3b8" tick={{ fontSize: 10 }} />
                        <YAxis dataKey="label" type="category" stroke="#94a3b8" tick={{ fontSize: 10 }} width={170} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            border: '1px solid #475569',
                            borderRadius: '8px',
                            color: '#f1f5f9',
                          }}
                        />
                        <Bar dataKey="score" radius={[0, 6, 6, 0]}>
                          {calibrationChartData.map(item => (
                            <Cell
                              key={`calibration-${item.label}`}
                              fill={item.score >= 70 ? '#ef4444' : item.score >= 45 ? '#f59e0b' : '#10b981'}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="text-xs text-slate-400">
                      Ez a blokk mutatja, hogy a modell mely matchup-tengelyeket tekinti a legfontosabbnak a jelenlegi párosításban.
                    </div>
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

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-800/50 rounded-lg">
                    <div className="text-sm text-slate-300 font-medium mb-2">Kockázati forgatókönyvek (mi történik, ha...)</div>
                    {riskScenarios.length > 0 ? (
                      <div className="space-y-2">
                        {riskScenarios.map(item => (
                          <div key={item.title} className="bg-slate-900/40 border border-slate-800 rounded-md px-3 py-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-100">{item.title}</span>
                              <span className="text-rose-300">{item.estimatedOwnSwingPct.toFixed(1)} pp</span>
                            </div>
                            <div className="text-xs text-slate-400 mt-1">Trigger: {item.trigger}</div>
                            <div className="text-xs text-amber-200 mt-1">Azonnali válasz: {item.instantResponse}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-400">Nincs külön kockázati forgatókönyv.</div>
                    )}
                  </div>

                  <div className="p-3 bg-slate-800/50 rounded-lg">
                    <div className="text-sm text-slate-300 font-medium mb-2">X-faktor számszerűsítés</div>
                    {xFactorImpact ? (
                      <div className="space-y-2">
                        <div className="bg-slate-900/40 border border-slate-800 rounded-md px-3 py-2 text-sm text-slate-200">
                          Elsődleges x-faktor hatás: <span className="text-emerald-300">+{xFactorImpact.primaryDeltaPct.toFixed(1)}%</span>
                        </div>
                        <div className="bg-slate-900/40 border border-slate-800 rounded-md px-3 py-2 text-sm text-slate-200">
                          Másodlagos x-faktor hatás: <span className="text-emerald-300">+{xFactorImpact.secondaryDeltaPct.toFixed(1)}%</span>
                        </div>
                        <div className="bg-slate-900/40 border border-slate-800 rounded-md px-3 py-2 text-sm text-slate-200">
                          Kombinált modellhatás: <span className="text-emerald-300">+{xFactorImpact.combinedDeltaPct.toFixed(1)}%</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-slate-400">Nincs számszerűsíthető x-faktor hatás.</div>
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
                    {prioritizedFocusPoints.length > 0 ? (
                      prioritizedFocusPoints.map(item => <div key={item} className="text-sm text-slate-200">• {item}</div>)
                    ) : (
                      <div className="text-sm text-slate-400">Nincs kiemelt fókuszpont.</div>
                    )}
                  </div>
                </div>

                {advancedPlayers && (
                  <div className="p-3 bg-slate-800/50 rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="text-sm text-slate-300 font-medium">Haladó játékosmutatók (proxy PER / proxy WS)</div>
                      <TooltipProvider>
                        <UiTooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="h-5 w-5 rounded-full border border-slate-600 text-[11px] text-slate-300 hover:text-slate-100 hover:border-slate-400"
                              aria-label="Haladó mutatók magyarázata"
                            >
                              i
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs text-xs leading-relaxed">
                            <div className="space-y-1">
                              <div>
                                Szűrés (dinamikus): saját csapat minimum
                                {' '}{pregameReport.advancedPlayersEligibility?.own.minTotalMinutes ?? 90} összperc,
                                {' '}{pregameReport.advancedPlayersEligibility?.own.minMinutesPerGame ?? 8} perc/meccs,
                                {' '}{pregameReport.advancedPlayersEligibility?.own.minEligibleGames ?? 3} meccs.
                              </div>
                              <div>
                                Ellenfél minimum
                                {' '}{pregameReport.advancedPlayersEligibility?.opponent.minTotalMinutes ?? 90} összperc,
                                {' '}{pregameReport.advancedPlayersEligibility?.opponent.minMinutesPerGame ?? 8} perc/meccs,
                                {' '}{pregameReport.advancedPlayersEligibility?.opponent.minEligibleGames ?? 3} meccs.
                              </div>
                              <div>PER*: saját, boxscore-alapú hatékonysági index (nem hivatalos NBA PER).</div>
                              <div>WS*: becsült győzelem-hozzájárulás a csapat teljesítményére vetítve.</div>
                              <div>VAL/36: 36 percre normalizált értéktermelés (összehasonlíthatóság miatt).</div>
                            </div>
                          </TooltipContent>
                        </UiTooltip>
                      </TooltipProvider>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">{ownLabel}</div>
                        <div className="space-y-1">
                          {advancedPlayers.own.length > 0 ? advancedPlayers.own.map(player => (
                            <div
                              key={`own-adv-${player.playerId}`}
                              className="grid grid-cols-[1fr_auto_auto] gap-2 items-center bg-slate-900/40 border border-slate-800 rounded-md px-2 py-1 text-xs"
                            >
                              <span className="text-slate-200">{player.name} <span className="text-slate-500">({player.minutesPerGame.toFixed(1)} mpg)</span></span>
                              <span className="text-sky-300">PER*: {player.proxyPer.toFixed(1)}</span>
                              <span className="text-emerald-300">WS*: {player.proxyWinShare.toFixed(2)}</span>
                            </div>
                          )) : <div className="text-xs text-slate-500">Nincs elég adat.</div>}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">{opponentLabel}</div>
                        <div className="space-y-1">
                          {advancedPlayers.opponent.length > 0 ? advancedPlayers.opponent.map(player => (
                            <div
                              key={`opp-adv-${player.playerId}`}
                              className="grid grid-cols-[1fr_auto_auto] gap-2 items-center bg-slate-900/40 border border-slate-800 rounded-md px-2 py-1 text-xs"
                            >
                              <span className="text-slate-200">{player.name} <span className="text-slate-500">({player.minutesPerGame.toFixed(1)} mpg)</span></span>
                              <span className="text-sky-300">PER*: {player.proxyPer.toFixed(1)}</span>
                              <span className="text-orange-300">WS*: {player.proxyWinShare.toFixed(2)}</span>
                            </div>
                          )) : <div className="text-xs text-slate-500">Nincs elég adat.</div>}
                        </div>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      A PER* és WS* becslés saját, boxscore-alapú proxy mutató, összehasonlító célra.
                    </div>
                  </div>
                )}

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

              {postgameReport.shotMap?.available && postgameReport.shotMap.team && postgameReport.shotMap.comparison && (
                <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-slate-200 font-medium">Dobástérkép kontextus (meccs vs. szezon)</div>
                    <div className="text-xs text-slate-500">
                      Kísérletek: {postgameReport.shotMap.team.attempts} • FG%: {formatShotPct(postgameReport.shotMap.team.fgPct)}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="p-3 bg-slate-800/50 rounded-lg">
                      <div className="text-xs text-slate-400">Gyűrű arány</div>
                      <div className="text-slate-50 text-lg font-medium">{formatShotPct(postgameReport.shotMap.team.rimRate)}</div>
                      <div className={`text-xs ${shotDeltaTone(postgameReport.shotMap.comparison.rimRateDelta)}`}>
                        Delta: {formatShotDeltaPp(postgameReport.shotMap.comparison.rimRateDelta)}
                      </div>
                    </div>
                    <div className="p-3 bg-slate-800/50 rounded-lg">
                      <div className="text-xs text-slate-400">Középtáv arány</div>
                      <div className="text-slate-50 text-lg font-medium">{formatShotPct(postgameReport.shotMap.team.midRate)}</div>
                      <div className={`text-xs ${shotDeltaTone(postgameReport.shotMap.comparison.midRateDelta)}`}>
                        Delta: {formatShotDeltaPp(postgameReport.shotMap.comparison.midRateDelta)}
                      </div>
                    </div>
                    <div className="p-3 bg-slate-800/50 rounded-lg">
                      <div className="text-xs text-slate-400">Tripla arány</div>
                      <div className="text-slate-50 text-lg font-medium">{formatShotPct(postgameReport.shotMap.team.threeRate)}</div>
                      <div className={`text-xs ${shotDeltaTone(postgameReport.shotMap.comparison.threeRateDelta)}`}>
                        Delta: {formatShotDeltaPp(postgameReport.shotMap.comparison.threeRateDelta)}
                      </div>
                    </div>
                    <div className="p-3 bg-slate-800/50 rounded-lg">
                      <div className="text-xs text-slate-400">Sarok tripla arány</div>
                      <div className="text-slate-50 text-lg font-medium">{formatShotPct(postgameReport.shotMap.team.corner3Rate)}</div>
                      <div className={`text-xs ${shotDeltaTone(postgameReport.shotMap.comparison.corner3RateDelta)}`}>
                        Delta: {formatShotDeltaPp(postgameReport.shotMap.comparison.corner3RateDelta)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-3 bg-slate-800/40 rounded-lg">
                      <div className="text-xs text-slate-400">Gyűrű FG%</div>
                      <div className="text-sm text-slate-100">
                        {formatShotPct(postgameReport.shotMap.team.rimPct)}
                        <span className={`ml-2 ${shotDeltaTone(postgameReport.shotMap.comparison.rimPctDelta)}`}>
                          ({formatShotDeltaPp(postgameReport.shotMap.comparison.rimPctDelta)})
                        </span>
                      </div>
                    </div>
                    <div className="p-3 bg-slate-800/40 rounded-lg">
                      <div className="text-xs text-slate-400">Tripla FG%</div>
                      <div className="text-sm text-slate-100">
                        {formatShotPct(postgameReport.shotMap.team.threePct)}
                        <span className={`ml-2 ${shotDeltaTone(postgameReport.shotMap.comparison.threePctDelta)}`}>
                          ({formatShotDeltaPp(postgameReport.shotMap.comparison.threePctDelta)})
                        </span>
                      </div>
                    </div>
                    <div className="p-3 bg-slate-800/40 rounded-lg">
                      <div className="text-xs text-slate-400">Shot quality index</div>
                      <div className="text-sm text-slate-100">
                        {postgameReport.shotMap.team.shotQualityIndex.toFixed(2)}
                        <span className={`ml-2 ${shotDeltaTone(postgameReport.shotMap.comparison.shotQualityDelta)}`}>
                          ({postgameReport.shotMap.comparison.shotQualityDelta > 0 ? '+' : ''}{postgameReport.shotMap.comparison.shotQualityDelta.toFixed(2)})
                        </span>
                      </div>
                    </div>
                  </div>

                  {postgameZoneDrilldownRows.length > 0 && (
                    <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/35 p-3">
                      <div className="text-sm text-slate-300 font-medium">Interaktív zóna drilldown</div>
                      <div className="flex flex-wrap gap-2">
                        {postgameZoneDrilldownRows.map(zone => (
                          <Button
                            key={`zone-drill-${zone.key}`}
                            type="button"
                            size="sm"
                            variant={selectedPostgameZone === zone.key ? 'default' : 'outline'}
                            onClick={() => setSelectedPostgameZone(zone.key)}
                            className={selectedPostgameZone === zone.key
                              ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                              : 'border-slate-700 text-slate-300 hover:bg-slate-800'}
                          >
                            {zone.label}
                          </Button>
                        ))}
                      </div>
                      {selectedZoneDrilldown && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                          <div className="rounded-md border border-slate-800 bg-slate-900/50 p-2">
                            <div className="text-slate-400">Volumen</div>
                            <div className="text-slate-100 mt-1">Meccs: {selectedZoneDrilldown.gameRate.toFixed(1)}%</div>
                            <div className="text-slate-400">Szezon: {selectedZoneDrilldown.seasonRate.toFixed(1)}%</div>
                            <div className={selectedZoneDrilldown.rateDelta >= 0 ? 'text-emerald-300 mt-1' : 'text-rose-300 mt-1'}>
                              Delta: {selectedZoneDrilldown.rateDelta >= 0 ? '+' : ''}{selectedZoneDrilldown.rateDelta.toFixed(1)} pp
                            </div>
                          </div>
                          <div className="rounded-md border border-slate-800 bg-slate-900/50 p-2">
                            <div className="text-slate-400">Hatékonyság (FG%)</div>
                            <div className="text-slate-100 mt-1">Meccs: {selectedZoneDrilldown.gamePct.toFixed(1)}%</div>
                            <div className="text-slate-400">Szezon: {selectedZoneDrilldown.seasonPct.toFixed(1)}%</div>
                            <div className={selectedZoneDrilldown.pctDelta >= 0 ? 'text-emerald-300 mt-1' : 'text-rose-300 mt-1'}>
                              Delta: {selectedZoneDrilldown.pctDelta >= 0 ? '+' : ''}{selectedZoneDrilldown.pctDelta.toFixed(1)} pp
                            </div>
                          </div>
                          <div className="rounded-md border border-slate-800 bg-slate-900/50 p-2 text-slate-300">
                            <div className="text-slate-400">Kísérlet</div>
                            <div className="mt-1">Meccs: {selectedZoneDrilldown.gameAttempts}</div>
                            <div>Szezon: {selectedZoneDrilldown.seasonAttempts}</div>
                            <div className="text-slate-500 mt-1">A zóna részletes összevetése meccs-szezon kontextusban.</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {postgameReport.shotMap.season && (() => {
                    const team = postgameReport.shotMap!.team!;
                    const season = postgameReport.shotMap!.season!;

                    const zoneRows = [
                      {
                        label: 'Gyűrű',
                        gameRate: team.attempts > 0 ? (team.zones.rim.attempts / team.attempts) * 100 : 0,
                        seasonRate: season.attempts > 0 ? (season.zones.rim.attempts / season.attempts) * 100 : 0,
                        gamePct: team.zones.rim.pct,
                        seasonPct: season.zones.rim.pct,
                      },
                      {
                        label: 'Festék',
                        gameRate: team.attempts > 0 ? (team.zones.paint.attempts / team.attempts) * 100 : 0,
                        seasonRate: season.attempts > 0 ? (season.zones.paint.attempts / season.attempts) * 100 : 0,
                        gamePct: team.zones.paint.pct,
                        seasonPct: season.zones.paint.pct,
                      },
                      {
                        label: 'Középtáv',
                        gameRate: team.attempts > 0 ? (team.zones.mid.attempts / team.attempts) * 100 : 0,
                        seasonRate: season.attempts > 0 ? (season.zones.mid.attempts / season.attempts) * 100 : 0,
                        gamePct: team.zones.mid.pct,
                        seasonPct: season.zones.mid.pct,
                      },
                      {
                        label: 'Sarok tripla',
                        gameRate: team.attempts > 0 ? (team.zones.corner3.attempts / team.attempts) * 100 : 0,
                        seasonRate: season.attempts > 0 ? (season.zones.corner3.attempts / season.attempts) * 100 : 0,
                        gamePct: team.zones.corner3.pct,
                        seasonPct: season.zones.corner3.pct,
                      },
                      {
                        label: 'Egyéb tripla',
                        gameRate: team.attempts > 0 ? (team.zones.aboveBreak3.attempts / team.attempts) * 100 : 0,
                        seasonRate: season.attempts > 0 ? (season.zones.aboveBreak3.attempts / season.attempts) * 100 : 0,
                        gamePct: team.zones.aboveBreak3.pct,
                        seasonPct: season.zones.aboveBreak3.pct,
                      },
                    ];

                    const zoneHeatCells = zoneRows.map(row => {
                      const rateDelta = round(row.gameRate - row.seasonRate, 1);
                      const pctDelta = round(row.gamePct - row.seasonPct, 1);
                      // Weighted composite highlights where higher efficiency in meaningful volume matters most.
                      const compositeDelta = round(pctDelta * 0.65 + rateDelta * 0.35, 1);

                      const tone = compositeDelta >= 4
                        ? 'bg-emerald-900/35 border-emerald-700/60 text-emerald-100'
                        : compositeDelta >= 1.5
                          ? 'bg-emerald-950/25 border-emerald-800/50 text-emerald-200'
                          : compositeDelta <= -4
                            ? 'bg-rose-900/35 border-rose-700/60 text-rose-100'
                            : compositeDelta <= -1.5
                              ? 'bg-rose-950/25 border-rose-800/50 text-rose-200'
                              : 'bg-slate-900/40 border-slate-700/50 text-slate-200';

                      const trendLabel = compositeDelta >= 1.5
                        ? 'Pozitív zóna-trend'
                        : compositeDelta <= -1.5
                          ? 'Negatív zóna-trend'
                          : 'Semleges trend';

                      return {
                        ...row,
                        rateDelta,
                        pctDelta,
                        compositeDelta,
                        tone,
                        trendLabel,
                      };
                    });

                    const weakZones = zoneHeatCells
                      .filter(item => item.compositeDelta <= -1.5)
                      .sort((a, b) => a.compositeDelta - b.compositeDelta)
                      .slice(0, 2)
                      .map(item => item.label);

                    const strongZones = zoneHeatCells
                      .filter(item => item.compositeDelta >= 1.5)
                      .sort((a, b) => b.compositeDelta - a.compositeDelta)
                      .slice(0, 2)
                      .map(item => item.label);

                    return (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                          <div className="p-3 bg-slate-800/50 rounded-lg">
                            <div className="text-sm text-slate-300 font-medium mb-2">Zónaeloszlás (%)</div>
                            <ResponsiveContainer width="100%" height={260}>
                              <BarChart data={zoneRows} margin={{ left: 8, right: 8 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                                <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} domain={[0, 60]} />
                                <Tooltip
                                  formatter={(value: number | string | undefined) => `${Number(value ?? 0).toFixed(1)}%`}
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
                                <Bar dataKey="gameRate" name="Meccs" fill="#f97316" radius={[6, 6, 0, 0]} />
                                <Bar dataKey="seasonRate" name="Szezon" fill="#22c55e" radius={[6, 6, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="p-3 bg-slate-800/50 rounded-lg">
                            <div className="text-sm text-slate-300 font-medium mb-2">Zónahatékonyság (FG%)</div>
                            <ResponsiveContainer width="100%" height={260}>
                              <LineChart data={zoneRows} margin={{ left: 8, right: 8 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                                <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} domain={[0, 100]} />
                                <Tooltip
                                  formatter={(value: number | string | undefined) => `${Number(value ?? 0).toFixed(1)}%`}
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
                                <Line type="monotone" dataKey="gamePct" name="Meccs FG%" stroke="#f97316" strokeWidth={2.5} dot={{ r: 3 }} />
                                <Line type="monotone" dataKey="seasonPct" name="Szezon FG%" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 3 }} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        <div className="p-3 bg-slate-800/50 rounded-lg space-y-3">
                          <div className="text-sm text-slate-300 font-medium">Zóna delta hőtérkép (meccs vs szezon)</div>
                          <PostgameZoneHeatmapChart cells={zoneHeatCells} />
                          <div className="text-xs text-slate-400">
                            Erős zónák: {strongZones.length > 0 ? strongZones.join(', ') : 'nincs kiugró pozitív zóna'} •
                            Gyenge zónák: {weakZones.length > 0 ? weakZones.join(', ') : 'nincs kiugró gyenge zóna'}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {postgameShotScatterData.length > 0 && (
                    <div className="p-3 bg-slate-800/40 rounded-lg">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm text-slate-300 font-medium" title="Pontok: konkrét dobások. Heatmap: területi sűrűség vagy FG% hatékonyság réteg.">Dobástérkép kombó nézet (aktuális meccs, félpálya)</div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={showPostgameShotPoints ? 'default' : 'outline'}
                            className={showPostgameShotPoints
                              ? 'h-7 bg-emerald-600 hover:bg-emerald-500 text-white'
                              : 'h-7 border-slate-700 text-slate-300 hover:bg-slate-800'}
                            onClick={() => {
                              if (showPostgameShotPoints && !showPostgameShotHeatmap) return;
                              setShowPostgameShotPoints(prev => !prev);
                            }}
                          >
                            Pontok
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={showPostgameShotHeatmap ? 'default' : 'outline'}
                            className={showPostgameShotHeatmap
                              ? 'h-7 bg-orange-500 hover:bg-orange-400 text-slate-950'
                              : 'h-7 border-slate-700 text-slate-300 hover:bg-slate-800'}
                            onClick={() => {
                              if (showPostgameShotHeatmap && !showPostgameShotPoints) return;
                              setShowPostgameShotHeatmap(prev => !prev);
                            }}
                          >
                            Heatmap
                          </Button>
                          {showPostgameShotHeatmap && (
                            <div className="ml-1 flex flex-wrap items-center gap-1 rounded-md border border-slate-700 bg-slate-900/70 p-1">
                              <div className="flex items-center gap-1">
                                {[
                                  { key: 'volume', label: 'Volumen' },
                                  { key: 'efficiency', label: 'FG%' },
                                ].map(option => (
                                  <Button
                                    key={`heat-mode-${option.key}`}
                                    type="button"
                                    size="sm"
                                    variant={postgameHeatmapMode === option.key ? 'default' : 'outline'}
                                    className={postgameHeatmapMode === option.key
                                      ? 'h-6 px-2 bg-amber-200 text-slate-900 hover:bg-amber-100'
                                      : 'h-6 px-2 border-slate-700 text-slate-300 hover:bg-slate-800'}
                                    onClick={() => setPostgameHeatmapMode(option.key as 'volume' | 'efficiency')}
                                    title={option.key === 'volume' ? 'Dobáskísérlet sűrűség alapján színez' : 'FG% alapján színez, minimum mintaszámmal'}
                                  >
                                    {option.label}
                                  </Button>
                                ))}
                              </div>
                              <div className="hidden sm:block h-4 w-px bg-slate-700 mx-1" />
                              {[
                                { key: 'soft', label: 'Lágy' },
                                { key: 'normal', label: 'Normál' },
                                { key: 'sharp', label: 'Éles' },
                              ].map(option => (
                                <Button
                                  key={`heat-contrast-${option.key}`}
                                  type="button"
                                  size="sm"
                                  variant={postgameHeatmapContrast === option.key ? 'default' : 'outline'}
                                  className={postgameHeatmapContrast === option.key
                                    ? 'h-6 px-2 bg-slate-200 text-slate-900 hover:bg-white'
                                    : 'h-6 px-2 border-slate-700 text-slate-300 hover:bg-slate-800'}
                                  onClick={() => setPostgameHeatmapContrast(option.key as 'soft' | 'normal' | 'sharp')}
                                >
                                  {option.label}
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      {showPostgameShotHeatmap && filteredPostgameShotScatterData.length < 24 && (
                        <div className="mb-2 rounded-md border border-amber-700/60 bg-amber-900/20 px-2.5 py-2 text-xs text-amber-200">
                          Alacsony mintaszám a heatmaphez ({filteredPostgameShotScatterData.length} dobás). A zónák trendje óvatosan értelmezendő.
                        </div>
                      )}
                      <PostgameShotScatterChart
                        shots={filteredPostgameShotScatterData}
                        showPoints={showPostgameShotPoints}
                        showHeatmap={showPostgameShotHeatmap}
                        heatmapContrast={postgameHeatmapContrast}
                        heatmapMode={postgameHeatmapMode}
                      />
                      <div className="mt-3 rounded-md border border-slate-700/80 bg-slate-900/50 p-2.5">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">Játékos:</span>
                            <Select value={selectedPostgameShotPlayerId} onValueChange={setSelectedPostgameShotPlayerId}>
                              <SelectTrigger className="h-8 w-57.5 border-slate-600 bg-slate-900/80 text-xs text-slate-100">
                                <SelectValue placeholder="Minden játékos" />
                              </SelectTrigger>
                              <SelectContent className="border-slate-700 bg-slate-900 text-slate-100">
                                <SelectItem className="text-slate-100 focus:bg-slate-800 focus:text-slate-100" value="all">Minden játékos</SelectItem>
                                {postgameShotPlayerOptions.players.map(player => (
                                  <SelectItem className="text-slate-100 focus:bg-slate-800 focus:text-slate-100" key={player.id} value={player.id}>{player.name}</SelectItem>
                                ))}
                                {postgameShotPlayerOptions.unknownShotCount > 0 && (
                                  <SelectItem className="text-slate-100 focus:bg-slate-800 focus:text-slate-100" value="__unknown__">Ismeretlen játékos ({postgameShotPlayerOptions.unknownShotCount})</SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                          <span className="text-xs text-slate-400">Szűrt dobások: {filteredPostgameShotScatterData.length}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                          {showPostgameShotPoints && <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />Bement</span>}
                          {showPostgameShotPoints && <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-500" />Kimaradt</span>}
                          {showPostgameShotHeatmap && <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-orange-400/90" />Heatmap ({postgameHeatmapMode === 'volume' ? 'volumen' : 'FG% hatékonyság'})</span>}
                          <span>Kék vonal: hárompontos ív és sarokhatár, fehér vonal: alapvonal/palánk</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

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
                              const isActive = selectedPostgameFactor === label;
                              return (
                                <li key={label}>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedPostgameFactor(label)}
                                    className={`w-full text-left flex items-start gap-2 rounded-md px-2 py-1.5 text-sm transition ${isActive ? 'bg-slate-800/70 ring-1 ring-cyan-500/60 text-slate-50' : 'text-slate-100 hover:bg-slate-800/50'}`}
                                  >
                                    <span className={`${toneClass} text-xs mt-0.5`}>{icon}</span>
                                    <span>{label}</span>
                                  </button>
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
                <div className="space-y-3">
                  <div className="rounded-lg border border-slate-800 bg-slate-900/35 p-3">
                    <div className="text-sm text-slate-300 font-medium mb-2" title="Megmutatja, hogy típusonként hány döntő faktor jelent meg a meccs képében.">Ellenfél-hatás faktoronként</div>
                    {opponentImpactChartData.length > 0 ? (
                      <div className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={opponentImpactChartData} margin={{ top: 8, right: 10, left: 0, bottom: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={55} />
                            <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }}
                              labelStyle={{ color: '#e2e8f0' }}
                              itemStyle={{ color: '#e2e8f0' }}
                              formatter={(value: number | string | undefined, _name?: string, item?: { payload?: { axis?: string } }) => {
                                const axis = item?.payload?.axis ?? '-';
                                return [`${Number(value ?? 0)} faktor`, `${axis}`];
                              }}
                            />
                            <Bar dataKey="impact" radius={[6, 6, 0, 0]}>
                              {opponentImpactChartData.map((item) => (
                                <Cell key={`impact-${item.label}`} fill={item.axis === 'Védekezés' ? '#38bdf8' : '#fb923c'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500">Nincs elég faktor adat az ellenfél-hatás bontáshoz.</div>
                    )}
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-900/35 p-3">
                    <div className="text-sm text-slate-300 font-medium mb-1">Kiválasztott faktor részletei</div>
                    {selectedFactorDrilldown ? (
                      <div className="space-y-2 text-sm">
                        <div className="text-slate-100">{selectedFactorDrilldown.label}</div>
                        <div className="text-xs text-slate-400">
                          Tengely: {selectedFactorDrilldown.axis === 'offense' ? 'támadás' : 'védekezés'} • Típus: {selectedFactorDrilldown.type}
                        </div>
                        {selectedFactorDrilldown.relatedStats.length > 0 ? (
                          <div className="space-y-1">
                            {selectedFactorDrilldown.relatedStats.map(stat => (
                              <div key={`factor-stat-${stat.key}`} className="text-xs text-slate-300 flex items-center justify-between rounded border border-slate-800 bg-slate-900/40 px-2 py-1">
                                <span>{stat.label}</span>
                                <span className="text-slate-100">{stat.delta >= 0 ? '+' : ''}{stat.delta.toFixed(1)}{stat.unit === 'pct' ? ' pp' : ''}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500">Nincs közvetlenül kapcsolt key stat.</div>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500">Válassz egy faktort a bal oldali listából.</div>
                    )}
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-900/35 p-3">
                    <div className="text-sm text-slate-300 font-medium mb-1">Ellenfélhez kötött bontás</div>
                    {opponentLinkedBreakdown.length > 0 ? (
                      <div className="space-y-1.5">
                        {opponentLinkedBreakdown.map((row, index) => (
                          <button
                            key={`linked-breakdown-${index}`}
                            type="button"
                            onClick={() => row.linkedFactor && setSelectedPostgameFactor(row.linkedFactor)}
                            className="w-full text-left rounded-md border border-slate-800 bg-slate-900/50 px-2 py-1.5 hover:bg-slate-800/60"
                          >
                            <div className="text-xs text-slate-400">{row.title}</div>
                            <div className="text-sm text-slate-100">{row.detail}</div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500">Nincs ellenfélhez kapcsolt extra bontás.</div>
                    )}
                  </div>

                  <div>
                    <div className="text-sm text-slate-300 font-medium mb-2">Játékos hatás</div>
                    <div className="text-sm text-slate-200">Pozitív: {postgameReport.playerImpact.positive.join(', ') || '-'}</div>
                    <div className="text-sm text-slate-200">Negatív: {postgameReport.playerImpact.negative.join(', ') || '-'}</div>
                  </div>
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

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    <div className="rounded-lg border border-slate-800 bg-slate-900/35 p-3">
                      <div className="text-sm text-slate-300 font-medium mb-2" title="X: Usage%, Y: TS%, buborékméret: VAL/36.">Usage vs TS% buborék</div>
                      {playerUsageVsTsData.length > 0 ? (
                        <>
                          <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                              <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis
                                  type="number"
                                  dataKey="usagePct"
                                  name="Usage%"
                                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                                  label={{ value: 'Usage %', position: 'insideBottom', offset: -4, fill: '#94a3b8', fontSize: 11 }}
                                />
                                <YAxis
                                  type="number"
                                  dataKey="tsPct"
                                  name="TS%"
                                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                                  label={{ value: 'TS %', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
                                />
                                <ZAxis type="number" dataKey="valPer36" range={[70, 320]} name="VAL/36" />
                                <Tooltip
                                  cursor={{ strokeDasharray: '3 3' }}
                                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }}
                                  labelStyle={{ color: '#e2e8f0' }}
                                  itemStyle={{ color: '#e2e8f0' }}
                                  formatter={(value: number | string | undefined, name?: string) => {
                                    if (name === 'Usage%') return [`${Number(value ?? 0).toFixed(1)}%`, 'Usage'];
                                    if (name === 'TS%') return [`${Number(value ?? 0).toFixed(1)}%`, 'TS'];
                                    return [`${Number(value ?? 0).toFixed(1)}`, 'VAL/36'];
                                  }}
                                  labelFormatter={(label) => String(label)}
                                />
                                <Scatter name="Játékosok" data={playerUsageVsTsData} fill="#22d3ee">
                                  <LabelList dataKey="name" content={renderUsageTsBubbleLabel} />
                                </Scatter>
                              </ScatterChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="mt-1 text-[11px] text-slate-500">Névfelirat: vezetéknév (hosszabb név rövidítve).</div>
                        </>
                      ) : (
                        <div className="text-sm text-slate-500">Nincs játékosadat a buborékdiagramhoz.</div>
                      )}
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-900/35 p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="text-sm text-slate-300 font-medium" title="Időbeli alakulás az utolsó 8 meccsen: TS%, Usage%, VAL/36.">Játékos trend (utolsó 8 meccs)</div>
                        <Select value={selectedTrendPlayerId} onValueChange={setSelectedTrendPlayerId}>
                          <SelectTrigger className="h-8 w-52 bg-slate-800 border-slate-700 text-slate-100">
                            <SelectValue placeholder="Válassz játékost" />
                          </SelectTrigger>
                          <SelectContent className="border-slate-700 bg-slate-900 text-slate-100">
                            {(postgameReport.playerReport?.players ?? []).map(player => (
                              <SelectItem key={`trend-player-${player.playerId}`} value={player.playerId}>
                                {player.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {playerTrendSeries.length > 0 ? (
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={playerTrendSeries} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                              <YAxis yAxisId="left" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                              <Tooltip
                                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }}
                                labelStyle={{ color: '#e2e8f0' }}
                                itemStyle={{ color: '#e2e8f0' }}
                                formatter={(value: number | string | undefined, name?: string) => {
                                  if (name === 'TS%') return [`${Number(value ?? 0).toFixed(1)}%`, 'TS%'];
                                  if (name === 'Usage%') return [`${Number(value ?? 0).toFixed(1)}%`, 'Usage%'];
                                  return [`${Number(value ?? 0).toFixed(1)}`, 'VAL/36'];
                                }}
                              />
                              <Legend />
                              <Line yAxisId="left" type="monotone" dataKey="tsPct" stroke="#38bdf8" strokeWidth={2} dot={false} name="TS%" />
                              <Line yAxisId="left" type="monotone" dataKey="usagePct" stroke="#f59e0b" strokeWidth={2} dot={false} name="Usage%" />
                              <Line yAxisId="right" type="monotone" dataKey="valPer36" stroke="#34d399" strokeWidth={2} dot={false} name="VAL/36" />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-500">Nincs elég meccsadat trendgörbéhez.</div>
                      )}
                    </div>
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
                <div className="text-sm text-slate-300 font-medium mb-2">Következő fókusz (auto ajánlás)</div>
                {nextGameAutoFocus.length > 0 ? (
                  nextGameAutoFocus.map(item => <div key={item} className="text-sm text-slate-200">• {item}</div>)
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
