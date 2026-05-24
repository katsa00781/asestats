'use client';

import { TerminologyGlossary } from './TerminologyGlossary';
import Image from 'next/image';
import { Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { playerSeasonToMd, teamStatsToMd, pregameReportToMd, postgameReportToMd } from '@/lib/export-to-md';
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
import type { PlayerStats, TeamGame, GameAggregate } from '@/lib/dashboard-types';
import {
  analyzePlayerSeason,
  buildLeagueBenchmarks,
  buildAdvancedPlayerBlocks,
  computeSimilarity,
  isEligibleSample,
  normalizePlayerStats,
  buildCoachSummary,
  type LeagueBenchmarks,
  type PlayerAnalysis,
  type AdvancedPlayerBlocks,
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
  type PostGameShotMapContext,
  type TeamGameStat,
  type TeamSeasonStat as PostgameTeamSeasonStat,
  type PostGameReport,
} from '@/lib/postgame-report';

type SeasonComparisonProps = {
  allPlayers: PlayerStats[];
  allSeasons: Array<{ id: string; name: string }>;
  allTeams: Array<{ id: string; name: string }>;
  currentSeasonId: string | null;
  currentTeamId: string | null;
  games: TeamGame[];
  playerGameStats: GamePlayerStatRow[];
};

type GamePlayerStatRow = {
  id: string;
  player_id: string;
  game_id: string;
  is_starter?: boolean | null;
  points?: number | null;
  minutes?: number | null;
  close_made?: number | null;
  close_attempted?: number | null;
  mid_made?: number | null;
  mid_attempted?: number | null;
  three_made?: number | null;
  three_attempted?: number | null;
  free_throw_made?: number | null;
  free_throw_attempted?: number | null;
  offensive_rebounds?: number | null;
  defensive_rebounds?: number | null;
  total_rebounds?: number | null;
  assists?: number | null;
  steals?: number | null;
  turnovers?: number | null;
  blocks?: number | null;
  valuation?: number | null;
  fouls_committed?: number | null;
  fouls_drawn?: number | null;
  blocks_suffered?: number | null;
  blocks_given?: number | null;
  plus_minus?: number | null;
  created_at?: string | null;
  offensive_rating?: number | null;
  defensive_rating?: number | null;
  true_shooting_percentage?: number | null;
  effective_field_goal_percentage?: number | null;
  games?: {
    date?: string | null;
    opponent?: string | null;
    season_id?: string | null;
  } | null;
  players?: {
    name?: string | null;
    position?: string | null;
    team_id?: string | null;
  } | null;
  teams?: {
    name?: string | null;
  } | null;
};

type StandingsSnapshotRow = {
  team: string;
  matches: number;
  wins: number;
  losses: number;
  scored: number;
  conceded: number;
  points: number;
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

type TeamTextReportRow = {
  narrative?: string | null;
  generated_at?: string | null;
  generated_by?: string | null;
};

type GameTextReportRow = {
  narrative?: string | null;
  generated_at?: string | null;
  generated_by?: string | null;
};

type KosarstatLineupTableRow = {
  rows?: unknown;
  headers?: unknown;
  source_table_dom_id?: unknown;
  table_index?: unknown;
};

type KosarstatPlayerMinuteStat = {
  player: string;
  minutesLabel: string;
  seconds: number;
  plusMinus: number | null;
  on40: number | null;
  teamPts: number | null;
  oppPts: number | null;
};

type KosarstatSubEvent = {
  gameSecond: number;
  minute: number;
  clockLabel: string;
  type: 'in' | 'out';
  player: string;
};

type KosarstatPlayerTimeline = {
  player: string;
  minuteCodes: string[];
  minutesLabel: string;
  seconds: number;
  plusMinus: number | null;
  subInMinutes: number[];
  subOutMinutes: number[];
};

type KosarstatLineupStint = {
  players: string[];
  minutesLabel: string;
  seconds: number;
  teamPts: number;
  oppPts: number;
  plusMinus: number;
  on40: number | null;
};

type KosarstatComboStat = {
  key: string;
  players: string[];
  stints: number;
  seconds: number;
  minutesLabel: string;
  plusMinus: number;
  netPer40: number;
  offPer40: number;
  defPer40: number;
  assists: null;
};

type KosarstatTeamLineupAnalysis = {
  teamName: string;
  starters: string[];
  playerMinutes: KosarstatPlayerMinuteStat[];
  playerTimelines: KosarstatPlayerTimeline[];
  substitutions: KosarstatSubEvent[];
  stints: KosarstatLineupStint[];
  pairStats: KosarstatComboStat[];
  trioStats: KosarstatComboStat[];
};

type KosarstatLineupAnalysis = {
  gameId: string;
  selectedTeam: KosarstatTeamLineupAnalysis | null;
  homeTeam: KosarstatTeamLineupAnalysis | null;
  awayTeam: KosarstatTeamLineupAnalysis | null;
};

type KosarstatQuarterStatRow = {
  team_name?: string | null;
  team_side?: 'home' | 'away' | 'unknown' | null;
  quarter?: number | null;
  points?: number | null;
  cumulative_points?: number | null;
};

type KosarstatTeamMetricRow = {
  team_name?: string | null;
  team_side?: 'home' | 'away' | 'unknown' | null;
  poss?: number | null;
  ortg?: number | null;
  efg?: number | null;
  tov_pct?: number | null;
  orb_pct?: number | null;
  ftm_rate?: number | null;
};

type PostgamePbpContext = {
  clutch: {
    available: boolean;
    sampleSize: number;
    sampleLabel: string;
    ownPoints: number;
    oppPoints: number;
    diff: number;
    ownTurnovers: number;
    oppTurnovers: number;
    ortg: number | null;
    drtg: number | null;
    net: number | null;
    tovPct: number | null;
    rebPct: number | null;
    ftRate: number | null;
    assistToTurnover: number | null;
    topUsageClosers: Array<{ player: string; usageShare: number }>;
  };
  turnoverTypes: Array<{ type: string; count: number }>;
  ownTurnovers: number;
};

type KosarstatClutchPlayerStat = {
  player: string;
  seconds: number;
  points: number;
  assists: number;
  turnovers: number;
  drb: number;
  orb: number;
  trb: number;
  ftMade: number;
  ftAtt: number;
  fgAtt: number;
  fga2: number;
  fga3: number;
  usageBase: number;
};

type KosarstatClutchTeamTotals = {
  points: number;
  assists: number;
  turnovers: number;
  drb: number;
  orb: number;
  trb: number;
  ftMade: number;
  ftAtt: number;
  fgAtt: number;
  fga2: number;
  fga3: number;
  usageBase: number;
  seconds: number;
};

type KosarstatClutchTeamSummary = {
  teamName: string;
  sampleSeconds: number;
  sampleLabel: string;
  totals: KosarstatClutchTeamTotals;
  possessions: number;
  ortg: number | null;
  tovPct: number | null;
  ftRate: number | null;
  players: KosarstatClutchPlayerStat[];
  topUsageClosers: Array<{ player: string; usageShare: number }>;
};

type KosarstatParsedClutchGame = {
  ownTeam: KosarstatClutchTeamSummary;
  oppTeam: KosarstatClutchTeamSummary;
  clutch: PostgamePbpContext['clutch'];
};

const parseSignedNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(',', '.').replace(/^\+/, '');
  if (!/^[-+]?\d+(?:\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseMmSsToSeconds = (value: unknown) => {
  if (typeof value !== 'string') return 0;
  const text = value.trim();
  const match = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return 0;
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return 0;
  return minutes * 60 + seconds;
};

const formatSecondsAsMmSs = (seconds: number) => {
  const safe = Math.max(0, Math.round(seconds));
  const mm = Math.floor(safe / 60);
  const ss = safe % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
};

const formatElapsedGameClock = (elapsedSeconds: number) => {
  const totalSeconds = Math.max(0, Math.round(elapsedSeconds));
  const periodLengthSeconds = 10 * 60;
  const maxRegulationSeconds = 40 * 60;
  const bounded = Math.min(totalSeconds, maxRegulationSeconds);

  const period = Math.min(4, Math.floor(bounded / periodLengthSeconds) + 1);
  const periodStart = (period - 1) * periodLengthSeconds;
  const inPeriodElapsed = Math.max(0, bounded - periodStart);
  const remainingInPeriod = Math.max(0, periodLengthSeconds - inPeriodElapsed);

  return `Q${period} ${formatSecondsAsMmSs(remainingInPeriod)}`;
};

const normalizeKosarstatClutchHeader = (value: unknown) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\./g, '')
    .trim();

const findKosarstatClutchHeaderIndex = (headers: string[], labels: string[]) => {
  const normalizedLabels = labels.map(label => normalizeKosarstatClutchHeader(label));
  return headers.findIndex(header => normalizedLabels.includes(normalizeKosarstatClutchHeader(header)));
};

const parseKosarstatClutchBannerTeamName = (value: unknown) => {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.split('(')[0]?.trim() || text;
};

const isKosarstatClutchPlayerStatsTable = (headers: string[]) => {
  const normalized = headers.map(header => normalizeKosarstatClutchHeader(header));
  return normalized.includes('jatekos') && normalized.includes('min') && normalized.includes('pts');
};

const computeKosarstatClutchTopUsage = (players: KosarstatClutchPlayerStat[], totals: KosarstatClutchTeamTotals) => {
  return players
    .filter(player => player.seconds > 0)
    .map(player => ({
      player: player.player,
      usageShare: roundValue(
        totals.usageBase > 0
          ? player.usageBase / totals.usageBase
          : player.seconds / Math.max(1, totals.seconds),
        3
      ),
    }))
    .sort((a, b) => b.usageShare - a.usageShare)
    .slice(0, 3);
};

const parseKosarstatClutchTeamTable = (teamName: string, table: { headers: string[]; rows: unknown[][] }): KosarstatClutchTeamSummary => {
  const idx = {
    player: findKosarstatClutchHeaderIndex(table.headers, ['Játékos']),
    min: findKosarstatClutchHeaderIndex(table.headers, ['MIN', 'Min']),
    pts: findKosarstatClutchHeaderIndex(table.headers, ['PTS']),
    ast: findKosarstatClutchHeaderIndex(table.headers, ['AST']),
    tov: findKosarstatClutchHeaderIndex(table.headers, ['TOV']),
    drb: findKosarstatClutchHeaderIndex(table.headers, ['DRB']),
    orb: findKosarstatClutchHeaderIndex(table.headers, ['ORB']),
    trb: findKosarstatClutchHeaderIndex(table.headers, ['TRB']),
    ftMade: findKosarstatClutchHeaderIndex(table.headers, ['FT made']),
    ftAtt: findKosarstatClutchHeaderIndex(table.headers, ['FT att.', 'FT att']),
    fgAtt: findKosarstatClutchHeaderIndex(table.headers, ['FG att.', 'FG att']),
    fga2: findKosarstatClutchHeaderIndex(table.headers, ['2P att.', '2P att']),
    fga3: findKosarstatClutchHeaderIndex(table.headers, ['3P att.', '3P att']),
  };

  const players: KosarstatClutchPlayerStat[] = [];

  table.rows.forEach(rawRow => {
    if (!Array.isArray(rawRow)) return;
    const offset = rawRow.length >= table.headers.length ? rawRow.length - table.headers.length : 0;
    const readCell = (index: number) => (index >= 0 ? rawRow[index + offset] : null);
    const player = String(readCell(idx.player) || '').trim();
    const minutesLabel = String(readCell(idx.min) || '').trim();
    const normalizedPlayer = normalizeKosarstatClutchHeader(player);
    if (!player || !minutesLabel || normalizedPlayer === 'jatekos' || normalizedPlayer.startsWith('ossz')) return;

    const seconds = parseMmSsToSeconds(minutesLabel);
    const points = parseSignedNumber(readCell(idx.pts)) ?? 0;
    const assists = parseSignedNumber(readCell(idx.ast)) ?? 0;
    const turnovers = parseSignedNumber(readCell(idx.tov)) ?? 0;
    const drb = parseSignedNumber(readCell(idx.drb)) ?? 0;
    const orb = parseSignedNumber(readCell(idx.orb)) ?? 0;
    const trb = parseSignedNumber(readCell(idx.trb)) ?? (drb + orb);
    const ftMade = parseSignedNumber(readCell(idx.ftMade)) ?? 0;
    const ftAtt = parseSignedNumber(readCell(idx.ftAtt)) ?? 0;
    const fgAtt = parseSignedNumber(readCell(idx.fgAtt)) ?? 0;
    const fga2 = parseSignedNumber(readCell(idx.fga2)) ?? 0;
    const fga3 = parseSignedNumber(readCell(idx.fga3)) ?? 0;
    const usageBase = fga2 + fga3 + 0.44 * ftAtt + turnovers;

    if (seconds <= 0 && usageBase <= 0 && points <= 0 && trb <= 0 && assists <= 0) return;

    players.push({
      player,
      seconds,
      points,
      assists,
      turnovers,
      drb,
      orb,
      trb,
      ftMade,
      ftAtt,
      fgAtt,
      fga2,
      fga3,
      usageBase,
    });
  });

  const totals = players.reduce<KosarstatClutchTeamTotals>(
    (acc, player) => ({
      points: acc.points + player.points,
      assists: acc.assists + player.assists,
      turnovers: acc.turnovers + player.turnovers,
      drb: acc.drb + player.drb,
      orb: acc.orb + player.orb,
      trb: acc.trb + player.trb,
      ftMade: acc.ftMade + player.ftMade,
      ftAtt: acc.ftAtt + player.ftAtt,
      fgAtt: acc.fgAtt + player.fgAtt,
      fga2: acc.fga2 + player.fga2,
      fga3: acc.fga3 + player.fga3,
      usageBase: acc.usageBase + player.usageBase,
      seconds: acc.seconds + player.seconds,
    }),
    { points: 0, assists: 0, turnovers: 0, drb: 0, orb: 0, trb: 0, ftMade: 0, ftAtt: 0, fgAtt: 0, fga2: 0, fga3: 0, usageBase: 0, seconds: 0 }
  );

  const sampleSeconds = Math.max(
    players.reduce((max, player) => Math.max(max, player.seconds), 0),
    Math.round(totals.seconds / 5)
  );
  const possessionsRaw = totals.fgAtt + 0.44 * totals.ftAtt + totals.turnovers - totals.orb;
  const possessions = possessionsRaw > 0 ? possessionsRaw : totals.fgAtt + 0.44 * totals.ftAtt + totals.turnovers;
  const ortg = possessions > 0 ? roundValue((totals.points / possessions) * 100, 1) : null;
  const tovPct = possessions > 0 ? roundValue((totals.turnovers / possessions) * 100, 1) : null;
  const ftRate = totals.fgAtt > 0 ? roundValue(totals.ftMade / totals.fgAtt, 3) : null;

  return {
    teamName,
    sampleSeconds,
    sampleLabel: formatSecondsAsMmSs(sampleSeconds),
    totals,
    possessions,
    ortg,
    tovPct,
    ftRate,
    players,
    topUsageClosers: computeKosarstatClutchTopUsage(players, totals),
  };
};

const parseKosarstatClutchGame = (
  tables: Array<{ headers: string[]; rows: unknown[][]; sourceTableDomId: string | null }>,
  metadata: { homeTeamName?: string | null; awayTeamName?: string | null },
  ownSide: 'home' | 'away',
  selectedTeamName?: string
): KosarstatParsedClutchGame | null => {
  const parsedTeams = tables
    .map((table, index, allTables) => {
      if (!isKosarstatClutchPlayerStatsTable(table.headers)) return null;
      const bannerTable = index > 0 ? allTables[index - 1] : null;
      const firstBannerRow = bannerTable && Array.isArray(bannerTable.rows[0]) ? bannerTable.rows[0] : null;
      const teamName = parseKosarstatClutchBannerTeamName(firstBannerRow?.[0]);
      if (!teamName) return null;
      return parseKosarstatClutchTeamTable(teamName, table);
    })
    .filter((item): item is KosarstatClutchTeamSummary => Boolean(item));

  if (parsedTeams.length < 2) return null;

  const ownNameCandidates = [
    selectedTeamName,
    ownSide === 'home' ? metadata.homeTeamName : metadata.awayTeamName,
  ]
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .map(normalizeTeamKey);
  const oppNameCandidates = [ownSide === 'home' ? metadata.awayTeamName : metadata.homeTeamName]
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .map(normalizeTeamKey);

  const matchTeam = (candidates: KosarstatClutchTeamSummary[], needles: string[]) =>
    candidates.find(team => {
      const teamKey = normalizeTeamKey(team.teamName);
      return needles.some(needle => teamKey.includes(needle) || needle.includes(teamKey));
    }) || null;

  const ownTeam = matchTeam(parsedTeams, ownNameCandidates)
    || (ownSide === 'home' ? parsedTeams[0] : parsedTeams[1])
    || null;
  const oppTeam = matchTeam(parsedTeams.filter(team => team !== ownTeam), oppNameCandidates)
    || parsedTeams.find(team => team !== ownTeam)
    || null;

  if (!ownTeam || !oppTeam) return null;

  const rebPct = ownTeam.totals.orb + oppTeam.totals.drb > 0
    ? roundValue((ownTeam.totals.orb / (ownTeam.totals.orb + oppTeam.totals.drb)) * 100, 1)
    : null;
  const assistToTurnover = ownTeam.totals.turnovers > 0
    ? roundValue(ownTeam.totals.assists / ownTeam.totals.turnovers, 2)
    : null;
  const sampleSeconds = Math.max(ownTeam.sampleSeconds, oppTeam.sampleSeconds);

  return {
    ownTeam,
    oppTeam,
    clutch: {
      available: sampleSeconds >= 60,
      sampleSize: sampleSeconds,
      sampleLabel: formatSecondsAsMmSs(sampleSeconds),
      ownPoints: ownTeam.totals.points,
      oppPoints: oppTeam.totals.points,
      diff: ownTeam.totals.points - oppTeam.totals.points,
      ownTurnovers: ownTeam.totals.turnovers,
      oppTurnovers: oppTeam.totals.turnovers,
      ortg: ownTeam.ortg,
      drtg: oppTeam.ortg,
      net: ownTeam.ortg !== null && oppTeam.ortg !== null ? roundValue(ownTeam.ortg - oppTeam.ortg, 1) : null,
      tovPct: ownTeam.tovPct,
      rebPct,
      ftRate: ownTeam.ftRate,
      assistToTurnover,
      topUsageClosers: ownTeam.topUsageClosers,
    },
  };
};

const buildAggregatedKosarstatClutchContext = (
  games: KosarstatParsedClutchGame[],
  activePlayerProfiles: NormalizedNameProfile[] = []
): PostgamePbpContext['clutch'] | null => {
  if (games.length === 0) return null;

  const ownTotals = games.reduce<KosarstatClutchTeamTotals>(
    (acc, game) => ({
      points: acc.points + game.ownTeam.totals.points,
      assists: acc.assists + game.ownTeam.totals.assists,
      turnovers: acc.turnovers + game.ownTeam.totals.turnovers,
      drb: acc.drb + game.ownTeam.totals.drb,
      orb: acc.orb + game.ownTeam.totals.orb,
      trb: acc.trb + game.ownTeam.totals.trb,
      ftMade: acc.ftMade + game.ownTeam.totals.ftMade,
      ftAtt: acc.ftAtt + game.ownTeam.totals.ftAtt,
      fgAtt: acc.fgAtt + game.ownTeam.totals.fgAtt,
      fga2: acc.fga2 + game.ownTeam.totals.fga2,
      fga3: acc.fga3 + game.ownTeam.totals.fga3,
      usageBase: acc.usageBase + game.ownTeam.totals.usageBase,
      seconds: acc.seconds + game.ownTeam.totals.seconds,
    }),
    { points: 0, assists: 0, turnovers: 0, drb: 0, orb: 0, trb: 0, ftMade: 0, ftAtt: 0, fgAtt: 0, fga2: 0, fga3: 0, usageBase: 0, seconds: 0 }
  );
  const oppTotals = games.reduce<KosarstatClutchTeamTotals>(
    (acc, game) => ({
      points: acc.points + game.oppTeam.totals.points,
      assists: acc.assists + game.oppTeam.totals.assists,
      turnovers: acc.turnovers + game.oppTeam.totals.turnovers,
      drb: acc.drb + game.oppTeam.totals.drb,
      orb: acc.orb + game.oppTeam.totals.orb,
      trb: acc.trb + game.oppTeam.totals.trb,
      ftMade: acc.ftMade + game.oppTeam.totals.ftMade,
      ftAtt: acc.ftAtt + game.oppTeam.totals.ftAtt,
      fgAtt: acc.fgAtt + game.oppTeam.totals.fgAtt,
      fga2: acc.fga2 + game.oppTeam.totals.fga2,
      fga3: acc.fga3 + game.oppTeam.totals.fga3,
      usageBase: acc.usageBase + game.oppTeam.totals.usageBase,
      seconds: acc.seconds + game.oppTeam.totals.seconds,
    }),
    { points: 0, assists: 0, turnovers: 0, drb: 0, orb: 0, trb: 0, ftMade: 0, ftAtt: 0, fgAtt: 0, fga2: 0, fga3: 0, usageBase: 0, seconds: 0 }
  );

  const ownPossessionsRaw = ownTotals.fgAtt + 0.44 * ownTotals.ftAtt + ownTotals.turnovers - ownTotals.orb;
  const oppPossessionsRaw = oppTotals.fgAtt + 0.44 * oppTotals.ftAtt + oppTotals.turnovers - oppTotals.orb;
  const ownPossessions = ownPossessionsRaw > 0 ? ownPossessionsRaw : ownTotals.fgAtt + 0.44 * ownTotals.ftAtt + ownTotals.turnovers;
  const oppPossessions = oppPossessionsRaw > 0 ? oppPossessionsRaw : oppTotals.fgAtt + 0.44 * oppTotals.ftAtt + oppTotals.turnovers;
  const sampleSeconds = games.reduce((sum, game) => sum + game.clutch.sampleSize, 0);
  const usageByPlayer = new Map<string, { usageBase: number; seconds: number }>();

  games.forEach(game => {
    game.ownTeam.players.forEach(player => {
      const existing = usageByPlayer.get(player.player) || { usageBase: 0, seconds: 0 };
      existing.usageBase += player.usageBase;
      existing.seconds += player.seconds;
      usageByPlayer.set(player.player, existing);
    });
  });

  const topUsageClosers = Array.from(usageByPlayer.entries())
    .filter(([player]) => activePlayerProfiles.length === 0 || matchesNormalizedNameProfile(player, activePlayerProfiles))
    .map(([player, value]) => ({
      player,
      usageShare: roundValue(
        ownTotals.usageBase > 0
          ? value.usageBase / ownTotals.usageBase
          : value.seconds / Math.max(1, ownTotals.seconds),
        3
      ),
    }))
    .sort((a, b) => b.usageShare - a.usageShare)
    .slice(0, 3);

  const ortg = ownPossessions > 0 ? roundValue((ownTotals.points / ownPossessions) * 100, 1) : null;
  const drtg = oppPossessions > 0 ? roundValue((oppTotals.points / oppPossessions) * 100, 1) : null;
  const rebPct = ownTotals.orb + oppTotals.drb > 0
    ? roundValue((ownTotals.orb / (ownTotals.orb + oppTotals.drb)) * 100, 1)
    : null;
  const ftRate = ownTotals.fgAtt > 0 ? roundValue(ownTotals.ftMade / ownTotals.fgAtt, 3) : null;
  const assistToTurnover = ownTotals.turnovers > 0 ? roundValue(ownTotals.assists / ownTotals.turnovers, 2) : null;
  const tovPct = ownPossessions > 0 ? roundValue((ownTotals.turnovers / ownPossessions) * 100, 1) : null;

  return {
    available: sampleSeconds >= 60,
    sampleSize: sampleSeconds,
    sampleLabel: formatSecondsAsMmSs(sampleSeconds),
    ownPoints: ownTotals.points,
    oppPoints: oppTotals.points,
    diff: ownTotals.points - oppTotals.points,
    ownTurnovers: ownTotals.turnovers,
    oppTurnovers: oppTotals.turnovers,
    ortg,
    drtg,
    net: ortg !== null && drtg !== null ? roundValue(ortg - drtg, 1) : null,
    tovPct,
    rebPct,
    ftRate,
    assistToTurnover,
    topUsageClosers,
  };
};

const buildAggregatedKosarstatPlayerClutchContext = (
  games: KosarstatParsedClutchGame[],
  playerProfiles: NormalizedNameProfile[]
) => {
  const matchedGames = games
    .map(game => {
      const matchedPlayer = game.ownTeam.players.find(player => matchesNormalizedNameProfile(player.player, playerProfiles)) || null;
      return matchedPlayer ? { game, player: matchedPlayer } : null;
    })
    .filter((item): item is { game: KosarstatParsedClutchGame; player: KosarstatClutchPlayerStat } => Boolean(item));

  if (matchedGames.length === 0) {
    return {
      available: true,
      games: 0,
      sampleSeconds: 0,
      sampleLabel: '00:00',
      confidence: 'alacsony' as const,
      usagePct: null as number | null,
      tsPct: null as number | null,
      tovPct: null as number | null,
      astTo: null as number | null,
      ppp: null as number | null,
      sampleWarning: 'Nincs Kosarstat clutch minta ehhez a játékoshoz.' as string | null,
      roleNote: null as string | null,
    };
  }

  const totals = matchedGames.reduce(
    (acc, item) => ({
      points: acc.points + item.player.points,
      assists: acc.assists + item.player.assists,
      turnovers: acc.turnovers + item.player.turnovers,
      ftAtt: acc.ftAtt + item.player.ftAtt,
      fgAtt: acc.fgAtt + item.player.fgAtt,
      usageBase: acc.usageBase + item.player.usageBase,
      seconds: acc.seconds + item.player.seconds,
      teamUsageBase: acc.teamUsageBase + item.game.ownTeam.totals.usageBase,
    }),
    { points: 0, assists: 0, turnovers: 0, ftAtt: 0, fgAtt: 0, usageBase: 0, seconds: 0, teamUsageBase: 0 }
  );

  const tsDen = 2 * (totals.fgAtt + 0.44 * totals.ftAtt);
  const usagePct = totals.teamUsageBase > 0 ? roundValue((totals.usageBase / totals.teamUsageBase) * 100, 1) : null;
  const tsPct = tsDen > 0 ? roundValue((totals.points / tsDen) * 100, 1) : null;
  const tovPct = totals.usageBase > 0 ? roundValue((totals.turnovers / totals.usageBase) * 100, 1) : null;
  const astTo = totals.turnovers > 0 ? roundValue(totals.assists / totals.turnovers, 2) : (totals.assists > 0 ? roundValue(totals.assists, 2) : null);
  const ppp = totals.usageBase > 0 ? roundValue(totals.points / totals.usageBase, 3) : null;

  return {
    available: true,
    games: matchedGames.length,
    sampleSeconds: totals.seconds,
    sampleLabel: formatSecondsAsMmSs(totals.seconds),
    confidence: matchedGames.length >= 8 ? 'magas' as const : matchedGames.length >= 4 ? 'kozepes' as const : 'alacsony' as const,
    usagePct,
    tsPct,
    tovPct,
    astTo,
    ppp,
    sampleWarning: matchedGames.length < 10 ? 'Korlátozott Kosarstat clutch minta: az értelmezés inkább irányadó, mint végleges.' : null,
    roleNote: (() => {
      if (usagePct === null) return null;
      if (usagePct < 15) return 'Clutch szerepben inkább befejező opció, nem elsődleges labdás vagy izolációs lezáró.';
      if (usagePct >= 24) return 'Clutch szerepben érdemi labdás terhelést is kap.';
      return 'Clutch szerepe vegyes: részben befejező, részben kapcsolódó labdás feladatokkal.';
    })(),
  };
};

const buildPostgamePbpContextFromKosarstatClutch = (
  tables: Array<{ headers: string[]; rows: unknown[][]; sourceTableDomId: string | null }>,
  metadata: { homeTeamName?: string | null; awayTeamName?: string | null },
  ownSide: 'home' | 'away',
  selectedTeamName?: string
): PostgamePbpContext | null => {
  const parsedGame = parseKosarstatClutchGame(tables, metadata, ownSide, selectedTeamName);
  if (!parsedGame) return null;

  return {
    clutch: {
      ...parsedGame.clutch,
    },
    turnoverTypes: [],
    ownTurnovers: parsedGame.ownTeam.totals.turnovers,
  };
};

const buildComboStats = (stints: KosarstatLineupStint[], comboSize: 2 | 3): KosarstatComboStat[] => {
  const aggregate = new Map<string, { players: string[]; stints: number; seconds: number; plusMinus: number; teamPts: number; oppPts: number }>();

  const combinations = (items: string[], size: number): string[][] => {
    const out: string[][] = [];
    const walk = (start: number, current: string[]) => {
      if (current.length === size) {
        out.push([...current]);
        return;
      }
      for (let i = start; i < items.length; i += 1) {
        current.push(items[i]);
        walk(i + 1, current);
        current.pop();
      }
    };
    walk(0, []);
    return out;
  };

  stints.forEach(stint => {
    if (stint.players.length < comboSize || stint.seconds <= 0) return;
    const combos = combinations(stint.players, comboSize);
    combos.forEach(players => {
      const key = [...players].sort().join(' | ');
      const existing = aggregate.get(key) || {
        players: [...players].sort(),
        stints: 0,
        seconds: 0,
        plusMinus: 0,
        teamPts: 0,
        oppPts: 0,
      };

      existing.stints += 1;
      existing.seconds += stint.seconds;
      existing.plusMinus += stint.plusMinus;
      existing.teamPts += stint.teamPts;
      existing.oppPts += stint.oppPts;
      aggregate.set(key, existing);
    });
  });

  return Array.from(aggregate.entries())
    .map(([key, value]) => {
      const per40Factor = value.seconds > 0 ? 2400 / value.seconds : 0;
      return {
        key,
        players: value.players,
        stints: value.stints,
        seconds: value.seconds,
        minutesLabel: formatSecondsAsMmSs(value.seconds),
        plusMinus: value.plusMinus,
        netPer40: (value.teamPts - value.oppPts) * per40Factor,
        offPer40: value.teamPts * per40Factor,
        defPer40: value.oppPts * per40Factor,
        assists: null,
      };
    })
    .sort((a, b) => b.netPer40 - a.netPer40 || b.seconds - a.seconds);
};

const buildAggregatedKosarstatLineupTeamAnalysis = (
  teams: KosarstatTeamLineupAnalysis[],
  fallbackTeamName: string
): KosarstatTeamLineupAnalysis | null => {
  if (teams.length === 0) return null;

  const playerMinuteMap = new Map<string, {
    seconds: number;
    plusMinus: number | null;
    teamPts: number | null;
    oppPts: number | null;
  }>();

  teams.forEach(team => {
    team.playerMinutes.forEach(item => {
      const existing = playerMinuteMap.get(item.player) || {
        seconds: 0,
        plusMinus: 0,
        teamPts: 0,
        oppPts: 0,
      };
      existing.seconds += item.seconds || 0;
      existing.plusMinus = (existing.plusMinus ?? 0) + (item.plusMinus ?? 0);
      existing.teamPts = (existing.teamPts ?? 0) + (item.teamPts ?? 0);
      existing.oppPts = (existing.oppPts ?? 0) + (item.oppPts ?? 0);
      playerMinuteMap.set(item.player, existing);
    });
  });

  const aggregatedStintsMap = new Map<string, {
    players: string[];
    seconds: number;
    teamPts: number;
    oppPts: number;
    plusMinus: number;
  }>();
  const allStints: KosarstatLineupStint[] = [];

  teams.forEach(team => {
    team.stints.forEach(stint => {
      allStints.push(stint);
      const key = [...stint.players].sort((a, b) => a.localeCompare(b, 'hu')).join(' | ');
      const existing = aggregatedStintsMap.get(key) || {
        players: [...stint.players].sort((a, b) => a.localeCompare(b, 'hu')),
        seconds: 0,
        teamPts: 0,
        oppPts: 0,
        plusMinus: 0,
      };
      existing.seconds += stint.seconds || 0;
      existing.teamPts += stint.teamPts || 0;
      existing.oppPts += stint.oppPts || 0;
      existing.plusMinus += stint.plusMinus || 0;
      aggregatedStintsMap.set(key, existing);
    });
  });

  const playerMinutes = Array.from(playerMinuteMap.entries())
    .map(([player, value]) => ({
      player,
      minutesLabel: formatSecondsAsMmSs(value.seconds),
      seconds: value.seconds,
      plusMinus: value.plusMinus,
      on40: value.seconds > 0 && value.plusMinus !== null ? roundValue((value.plusMinus * 2400) / value.seconds, 1) : null,
      teamPts: value.teamPts,
      oppPts: value.oppPts,
    }))
    .sort((a, b) => b.seconds - a.seconds || a.player.localeCompare(b.player, 'hu'));

  const starters = playerMinutes.slice(0, 5).map(item => item.player);
  const stints = Array.from(aggregatedStintsMap.values())
    .map(item => ({
      players: item.players,
      minutesLabel: formatSecondsAsMmSs(item.seconds),
      seconds: item.seconds,
      teamPts: item.teamPts,
      oppPts: item.oppPts,
      plusMinus: item.plusMinus,
      on40: item.seconds > 0 ? roundValue((item.plusMinus * 2400) / item.seconds, 1) : null,
    }))
    .sort((a, b) => b.seconds - a.seconds || (Number(b.on40 ?? 0) - Number(a.on40 ?? 0)));

  return {
    teamName: fallbackTeamName || teams[0]?.teamName || '',
    starters,
    playerMinutes,
    playerTimelines: [],
    substitutions: [],
    stints,
    pairStats: buildComboStats(allStints, 2),
    trioStats: buildComboStats(allStints, 3),
  };
};

const parseKosarstatTeamLineupAnalysis = (
  teamName: string,
  teamTables: Array<{ headers: string[]; rows: unknown[][]; sourceTableDomId: string | null }>
): KosarstatTeamLineupAnalysis => {
  const isInvalidPlayerLabel = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return true;
    if (/^\d+$/.test(trimmed)) return true;
    if (/^(?:j[aá]t[eé]kos|player)$/i.test(trimmed)) return true;
    return false;
  };

  const isLikelyMinuteGridTable = (table: { headers: string[]; rows: unknown[][] }) => {
    const row = table.rows.find(item => Array.isArray(item)) as unknown[] | undefined;
    if (!row || row.length < 8) return false;
    const cells = row.map(cell => String(cell ?? '').trim());
    const hasPlayerAndMinute = cells.includes('Játékos') && cells.includes('Perc');
    const numericMinuteMarkers = cells.filter(cell => /^\d{1,2}$/.test(cell) && Number(cell) >= 1 && Number(cell) <= 40);
    return hasPlayerAndMinute && numericMinuteMarkers.length >= 10;
  };

  const getMinuteColumnIndexes = (table: { headers: string[]; rows: unknown[][] }) => {
    const fromHeaders = table.headers
      .map((header, index) => ({ header, index }))
      .filter(item => /^\d{1,2}$/.test(item.header) && Number(item.header) >= 1 && Number(item.header) <= 40)
      .sort((a, b) => Number(a.header) - Number(b.header));

    if (fromHeaders.length > 0) {
      return fromHeaders;
    }

    const headerLikeRow = table.rows.find(item => {
      if (!Array.isArray(item)) return false;
      const cells = item.map(cell => String(cell ?? '').trim());
      return cells.includes('Játékos') && cells.includes('Perc') && cells.some(cell => /^\d{1,2}$/.test(cell));
    }) as unknown[] | undefined;

    if (!headerLikeRow) return [] as Array<{ header: string; index: number }>;

    const cells = headerLikeRow.map(cell => String(cell ?? '').trim());
    const hasLeadingOrder = /^\d+$/.test(cells[0] || '') && cells.includes('Játékos') && cells.includes('Perc');
    const headerBaseOffset = hasLeadingOrder ? 1 : 0;

    return cells
      .map((cell, index) => ({ header: cell, index: index - headerBaseOffset }))
      .filter(item => item.index >= 0 && /^\d{1,2}$/.test(item.header) && Number(item.header) >= 1 && Number(item.header) <= 40)
      .sort((a, b) => Number(a.header) - Number(b.header));
  };

  const playerSummaryCandidates = teamTables.filter(table => table.headers.includes('Játékos') && table.headers.includes('Min') && table.headers.includes('On40'));
  const minuteGrid =
    teamTables.find(table => table.sourceTableDomId === 'table_7' || table.sourceTableDomId === 'table_12') ||
    teamTables.find(table => table.headers.includes('Perc') && table.headers.includes('1') && table.headers.includes('40')) ||
    teamTables.find(table => isLikelyMinuteGridTable(table));
  const fiveMan = teamTables.find(table => table.headers.includes('PG') && table.headers.includes('SG') && table.headers.includes('SF') && table.headers.includes('PF') && table.headers.includes('C') && table.headers.some(h => h.includes('On +/-')));

  const parsePlayerSummaryTable = (table: { headers: string[]; rows: unknown[][] }) => {
    const list: KosarstatPlayerMinuteStat[] = [];
    const idx = {
      player: table.headers.indexOf('Játékos'),
      min: table.headers.indexOf('Min'),
      teamPts: table.headers.indexOf('Team PTS'),
      oppPts: table.headers.indexOf('Opp. PTS'),
      pm: table.headers.indexOf('+/-'),
      on40: table.headers.findIndex(h => h.toLowerCase() === 'on40' || h.toLowerCase() === 'on 40'),
    };

    table.rows.forEach(rawRow => {
      if (!Array.isArray(rawRow)) return;
      const player = String(rawRow[idx.player] || '').trim();
      const minutesLabel = String(rawRow[idx.min] || '').trim();
      if (!minutesLabel || player === 'Játékos' || isInvalidPlayerLabel(player)) return;

      list.push({
        player,
        minutesLabel,
        seconds: parseMmSsToSeconds(minutesLabel),
        plusMinus: parseSignedNumber(rawRow[idx.pm]),
        on40: parseSignedNumber(rawRow[idx.on40]),
        teamPts: parseSignedNumber(rawRow[idx.teamPts]),
        oppPts: parseSignedNumber(rawRow[idx.oppPts]),
      });
    });

    return list.sort((a, b) => b.seconds - a.seconds);
  };

  const playerMinutes: KosarstatPlayerMinuteStat[] = [];

  const stints: KosarstatLineupStint[] = [];
  if (fiveMan) {
    const idx = {
      pg: fiveMan.headers.indexOf('PG'),
      sg: fiveMan.headers.indexOf('SG'),
      sf: fiveMan.headers.indexOf('SF'),
      pf: fiveMan.headers.indexOf('PF'),
      c: fiveMan.headers.indexOf('C'),
      min: fiveMan.headers.indexOf('Min'),
      teamPts: fiveMan.headers.indexOf('Team PTS'),
      oppPts: fiveMan.headers.indexOf('Opp. PTS'),
      pm: fiveMan.headers.findIndex(h => h.includes('On +/-')),
      on40: fiveMan.headers.findIndex(h => h.includes('On 40')),
    };

    fiveMan.rows.forEach(rawRow => {
      if (!Array.isArray(rawRow)) return;
      const players = [rawRow[idx.pg], rawRow[idx.sg], rawRow[idx.sf], rawRow[idx.pf], rawRow[idx.c]]
        .map(cell => (typeof cell === 'string' ? cell.trim() : ''))
        .filter(Boolean);
      const minutesLabel = typeof rawRow[idx.min] === 'string' ? String(rawRow[idx.min]).trim() : '';
      if (players.length !== 5 || !minutesLabel || minutesLabel === 'Min') return;
      const seconds = parseMmSsToSeconds(minutesLabel);
      if (seconds <= 0) return;

      const teamPts = parseSignedNumber(rawRow[idx.teamPts]) ?? 0;
      const oppPts = parseSignedNumber(rawRow[idx.oppPts]) ?? 0;
      const plusMinus = parseSignedNumber(rawRow[idx.pm]) ?? teamPts - oppPts;

      stints.push({
        players,
        minutesLabel,
        seconds,
        teamPts,
        oppPts,
        plusMinus,
        on40: parseSignedNumber(rawRow[idx.on40]),
      });
    });
  }

  let starters = stints[0]?.players || [];

  const substitutions: KosarstatSubEvent[] = [];
  const playerTimelines: KosarstatPlayerTimeline[] = [];
  if (minuteGrid) {
    const minuteColumnIndexes = getMinuteColumnIndexes(minuteGrid);

    const startersFromGrid: string[] = [];

    minuteGrid.rows.forEach(rawRow => {
      if (!Array.isArray(rawRow)) return;

      const row = rawRow.map(cell => String(cell ?? '').trim());
      if (row.length < 4) return;

      const hasLeadingOrder = /^\d+$/.test(row[0] || '') && /^\d{1,2}:\d{2}$/.test(row[2] || '');
      const baseOffset = hasLeadingOrder ? 1 : 0;

      const player = (row[0 + baseOffset] || '').trim();
      if (player === 'Játékos' || player.includes('Pályán töltött') || isInvalidPlayerLabel(player)) return;

      const minuteCodes = minuteColumnIndexes.map(({ index, header }) => ({
        minute: Number(header),
        code: (row[index + baseOffset] || '').trim(),
      }));

      const rowMinutesLabel = (row[1 + baseOffset] || '').trim();
      const parsedRowSeconds = parseMmSsToSeconds(rowMinutesLabel);
      const rowPlusMinus = parseSignedNumber(row[2 + baseOffset]);
      const derivedSecondsFromCodes = minuteCodes.reduce((acc, item) => {
        const code = item.code;
        if (code === '1') return acc + 60;
        if (code === '2' || code === '3') return acc + 30;
        return acc;
      }, 0);
      const timelineSeconds = parsedRowSeconds > 0 ? parsedRowSeconds : derivedSecondsFromCodes;
      const timelineMinutesLabel = parsedRowSeconds > 0
        ? rowMinutesLabel
        : formatSecondsAsMmSs(timelineSeconds);

      const firstMinuteCode = minuteCodes.find(item => item.minute === 1)?.code || '';
      if (firstMinuteCode === '1' || firstMinuteCode === '3') {
        startersFromGrid.push(player);
      }

      const minuteCodesOnly = minuteCodes.map(item => item.code || '0');
      const subInMinutes = minuteCodes.filter(item => item.code === '2').map(item => item.minute);
      const subOutMinutes = minuteCodes.filter(item => item.code === '3').map(item => item.minute);
      playerTimelines.push({
        player,
        minuteCodes: minuteCodesOnly,
        minutesLabel: timelineMinutesLabel,
        seconds: timelineSeconds,
        plusMinus: rowPlusMinus,
        subInMinutes,
        subOutMinutes,
      });

      const hasExplicitCodes = minuteCodes.some(item => item.code === '2' || item.code === '3');

      minuteCodes.forEach(item => {
        const gameSecond = Math.max(0, (item.minute - 1) * 60);
        const clockLabel = formatElapsedGameClock(gameSecond);

        if (item.code === '2') {
          substitutions.push({
            gameSecond,
            minute: item.minute,
            clockLabel,
            type: 'in',
            player,
          });
        } else if (item.code === '3') {
          substitutions.push({
            gameSecond,
            minute: item.minute,
            clockLabel,
            type: 'out',
            player,
          });
        }
      });

      // Fallback for legacy data where explicit 2/3 event markers are missing.
      if (!hasExplicitCodes) {
        let wasOn = false;
        minuteCodes.forEach(item => {
          const gameSecond = Math.max(0, (item.minute - 1) * 60);
          const clockLabel = formatElapsedGameClock(gameSecond);
          const isOn = item.code !== '' && item.code !== '0';
          if (!wasOn && isOn) {
            substitutions.push({ gameSecond, minute: item.minute, clockLabel, type: 'in', player });
          }
          if (wasOn && !isOn) {
            substitutions.push({ gameSecond, minute: item.minute, clockLabel, type: 'out', player });
          }
          wasOn = isOn;
        });
      }
    });

    if (startersFromGrid.length >= 5) {
      starters = startersFromGrid.slice(0, 5);
    }
  } else if (stints.length > 1) {
    let elapsedSeconds = 0;

    for (let index = 0; index < stints.length - 1; index += 1) {
      const current = stints[index];
      const next = stints[index + 1];
      elapsedSeconds += current.seconds;

      const nextSet = new Set(next.players);
      const currentSet = new Set(current.players);

      const outPlayers = current.players.filter(player => !nextSet.has(player));
      const inPlayers = next.players.filter(player => !currentSet.has(player));

      const minute = Math.min(40, Math.max(1, Math.floor(elapsedSeconds / 60) + 1));
      const clockLabel = formatElapsedGameClock(elapsedSeconds);

      outPlayers.forEach(player => {
        substitutions.push({
          gameSecond: elapsedSeconds,
          minute,
          clockLabel,
          type: 'out',
          player,
        });
      });

      inPlayers.forEach(player => {
        substitutions.push({
          gameSecond: elapsedSeconds,
          minute,
          clockLabel,
          type: 'in',
          player,
        });
      });
    }
  }

  const referencePlayers = new Set<string>();
  starters.forEach(player => {
    if (player) referencePlayers.add(player);
  });
  stints.forEach(stint => {
    stint.players.forEach(player => {
      if (player) referencePlayers.add(player);
    });
  });
  playerTimelines.forEach(row => {
    if (row.player) referencePlayers.add(row.player);
  });

  if (playerSummaryCandidates.length > 0) {
    const scoredSummaries = playerSummaryCandidates
      .map(table => {
        const parsed = parsePlayerSummaryTable(table);
        const names = new Set(parsed.map(item => item.player));
        let overlap = 0;
        referencePlayers.forEach(name => {
          if (names.has(name)) overlap += 1;
        });
        return { parsed, overlap };
      })
      .sort((a, b) => b.overlap - a.overlap || b.parsed.length - a.parsed.length);

    const best = scoredSummaries[0];
    if (best && (best.overlap > 0 || referencePlayers.size === 0)) {
      playerMinutes.push(...best.parsed);
    }
  }

  if (starters.length < 5 && playerMinutes.length > 0) {
    starters = playerMinutes.slice(0, 5).map(item => item.player);
  }

  if (starters.length < 5 && playerTimelines.length > 0) {
    starters = playerTimelines.slice(0, 5).map(item => item.player);
  }

  const minuteStatByPlayer = new Map(playerMinutes.map(item => [item.player, item]));
  playerTimelines.forEach(row => {
    const minuteStat = minuteStatByPlayer.get(row.player);
    if (!minuteStat) return;
    row.minutesLabel = minuteStat.minutesLabel;
    row.seconds = minuteStat.seconds;
    row.plusMinus = minuteStat.plusMinus;
  });

  if (playerMinutes.length === 0 && playerTimelines.length > 0) {
    playerTimelines.forEach(row => {
      playerMinutes.push({
        player: row.player,
        minutesLabel: row.minutesLabel,
        seconds: row.seconds,
        plusMinus: row.plusMinus,
        on40: null,
        teamPts: null,
        oppPts: null,
      });
    });
    playerMinutes.sort((a, b) => b.seconds - a.seconds || a.player.localeCompare(b.player, 'hu'));
  }

  playerTimelines.sort((a, b) => b.seconds - a.seconds || a.player.localeCompare(b.player, 'hu'));

  substitutions.sort((a, b) => a.gameSecond - b.gameSecond || a.type.localeCompare(b.type));

  return {
    teamName,
    starters,
    playerMinutes,
    playerTimelines,
    substitutions,
    stints,
    pairStats: buildComboStats(stints, 2),
    trioStats: buildComboStats(stints, 3),
  };
};

const parseKosarstatLineupAnalysis = (
  tablesData: KosarstatLineupTableRow[],
  gameId: string,
  selectedTeamName: string | null,
  preferredSide?: 'home' | 'away'
): KosarstatLineupAnalysis | null => {
  const tables = tablesData
    .map(table => ({
      headers: Array.isArray(table.headers) ? (table.headers as unknown[]).map(item => (typeof item === 'string' ? item.trim() : '')).filter(Boolean) : [],
      rows: Array.isArray(table.rows) ? (table.rows as unknown[]) : [],
      sourceTableDomId: typeof table.source_table_dom_id === 'string' ? table.source_table_dom_id.trim() || null : null,
    }))
    .map(table => ({
      headers: table.headers,
      rows: table.rows.filter(Array.isArray) as unknown[][],
      sourceTableDomId: table.sourceTableDomId,
    }));

  type Bucket = { teamName: string; tables: Array<{ headers: string[]; rows: unknown[][]; sourceTableDomId: string | null }> };
  const buckets: Bucket[] = [];
  let currentBucket: Bucket | null = null;

  tables.forEach(table => {
    const firstCell = Array.isArray(table.rows[0]) ? String(table.rows[0][0] || '').trim() : '';
    if (firstCell && firstCell.includes('Mérleg:')) {
      const teamName = firstCell.split('(')[0].trim();
      currentBucket = { teamName, tables: [] };
      buckets.push(currentBucket);
      return;
    }

    if (currentBucket) {
      currentBucket.tables.push(table);
    }
  });

  const parsedTeams = buckets
    .map(bucket => parseKosarstatTeamLineupAnalysis(bucket.teamName, bucket.tables))
    .filter(team => team.playerMinutes.length > 0 || team.playerTimelines.length > 0 || team.stints.length > 0);
  if (parsedTeams.length === 0) return null;

  const selectedKey = selectedTeamName ? normalizeTeamKey(selectedTeamName) : '';
  const sideSelectedTeam = preferredSide === 'home'
    ? parsedTeams[0] || null
    : preferredSide === 'away'
      ? parsedTeams[1] || null
      : null;
  const nameSelectedTeam = selectedKey
    ? parsedTeams.find(team => normalizeTeamKey(team.teamName).includes(selectedKey) || selectedKey.includes(normalizeTeamKey(team.teamName))) || null
    : null;
  const selectedTeam = nameSelectedTeam || sideSelectedTeam || parsedTeams[0] || null;

  return {
    gameId,
    selectedTeam,
    homeTeam: parsedTeams[0] || null,
    awayTeam: parsedTeams[1] || null,
  };
};

const normalizeSearchText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

const toDateSearchVariants = (value: string) => {
  const variants = new Set<string>();
  if (!value) return variants;

  variants.add(value);

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return variants;

  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');

  variants.add(`${yyyy}-${mm}-${dd}`);
  variants.add(`${yyyy}.${mm}.${dd}`);
  variants.add(`${yyyy}/${mm}/${dd}`);
  variants.add(`${dd}.${mm}.${yyyy}`);
  variants.add(`${dd}/${mm}/${yyyy}`);

  return variants;
};

const toIsoDateString = (value: string) => {
  if (!value) return '';

  const trimmed = value.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const huMatch = /^(\d{4})\.(\d{2})\.(\d{2})\.?$/.exec(trimmed);
  if (huMatch) return `${huMatch[1]}-${huMatch[2]}-${huMatch[3]}`;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return '';

  const yyyy = String(parsed.getFullYear());
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

type SeasonFixture = {
  id: string;
  home_team_id: string;
  away_team_id: string;
  game_date: string;
  status: string;
};

type ShotRawRow = {
  id: string;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
};

type ShotEventRow = {
  raw_game_id?: string | null;
  team_id?: string | null;
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

type PregameEfficiencyBaseline = {
  teamId: string;
  teamName: string;
  games: number;
  actualPointsPerGame: number;
  possessions: number;
  fga: number;
  twoPA: number;
  threePA: number;
  fta: number;
  tov: number;
  oreb: number;
  twoPct: number;
  threePct: number;
  ftPct: number;
  threeSharePct: number;
  ftRatePct: number;
  tovRatePct: number;
  orebBonusPct: number;
  efg: number;
  ppp: number;
  expectedPoints: number;
};

type PregameEfficiencyInputs = {
  ownPossessions: number;
  ownThreeSharePct: number;
  ownFtRatePct: number;
  ownTovRatePct: number;
  ownOrebBonusPct: number;
  ownTwoPct: number;
  ownThreePct: number;
  ownFtPct: number;
  opponentPossessions: number;
  opponentThreeSharePct: number;
  opponentFtRatePct: number;
  opponentTovRatePct: number;
  opponentOrebBonusPct: number;
  opponentTwoPct: number;
  opponentThreePct: number;
  opponentFtPct: number;
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

type PlayoffSeriesProjection = {
  seriesKey: string;
  round: 'Negyeddöntő' | 'Elődöntő' | 'Döntő' | 'Bronz' | '5-8 helyosztó elődöntő' | '5. helyért' | '7. helyért';
  homeSeed: number;
  awaySeed: number;
  homeTeam: string;
  awayTeam: string;
  homeWinProbability: number;
  awayWinProbability: number;
  winner: string;
  loser: string;
  mostLikelyScore: string;
  certaintyLabel: 'Magas' | 'Közepes' | 'Alacsony';
  manualOverride: boolean;
};

type ProjectionUpcomingGame = {
  fixtureId: string;
  gameDate: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamKey: string;
  awayTeamKey: string;
  homeWinProbabilityModel: number;
  awayWinProbabilityModel: number;
  homeWinProbabilityApplied: number;
  awayWinProbabilityApplied: number;
  certaintyApplied: number;
  overrideWinnerSide: 'home' | 'away' | null;
};

type PlayoffProjectionResult = {
  champion: string;
  runnerUp: string;
  third: string;
  fourth: string;
  finalRanking: Array<{ position: number; team: string; note?: string }>;
  series: PlayoffSeriesProjection[];
};

const normalizeTeamKey = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

type NormalizedNameProfile = {
  key: string;
  tokens: string[];
};

const buildNormalizedNameProfile = (value: string): NormalizedNameProfile => {
  const key = normalizeTeamKey(value);
  const tokens = key.split(' ').filter(Boolean);
  return { key, tokens };
};

const matchesNormalizedNameProfile = (candidate: string, profiles: NormalizedNameProfile[]) => {
  const normalizedCandidate = buildNormalizedNameProfile(candidate);
  if (!normalizedCandidate.key) return false;

  return profiles.some(profile => {
    if (profile.key === normalizedCandidate.key) return true;
    if (normalizedCandidate.tokens.length < 2) return false;

    // Long-token shortcut: if both sides share a token of ≥6 chars it's the same person.
    // Handles foreign names where Kosarstat uses a nickname/abbreviated form
    // (e.g. "Zena EDOSOMWAN" vs "EDOSOMWAN Kinsley Nehizena").
    const hasLongSharedToken = profile.tokens.some(profileToken =>
      profileToken.length >= 6
      && normalizedCandidate.tokens.some(t =>
        t === profileToken || profileToken.includes(t) || t.includes(profileToken)
      )
    );
    if (hasLongSharedToken) return true;

    let exactMatches = 0;
    const allTokensMatch = normalizedCandidate.tokens.every(token => {
      const matchedToken = profile.tokens.find(profileToken => (
        profileToken === token
        || profileToken.includes(token)
        || token.includes(profileToken)
      ));

      if (matchedToken && matchedToken === token) {
        exactMatches += 1;
      }

      return Boolean(matchedToken);
    });

    return allTokensMatch && exactMatches >= 1;
  });
};

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

const SKILL_SCORE_HELPERS_HU: Record<string, string> = {
  scoring: 'Pozíciós benchmark-index, nem nyers PPG vagy usage%.',
  shooting: 'Dobóhatékonyság és shot profile alapú index.',
  playmaking: 'AST/36 és AST/TO alapú, nem klasszikus irányító-terhelés.',
  rebounding: 'Lepattanótermelés a saját poszt benchmarkjaihoz mérve.',
  defense: 'Boxscore-alapú védőindex: blokk, labdaszerzés, védőlepattanó.',
  efficiency: 'VAL/36 és eFG összesített mutató.',
};

const RECENT_GAMES_WINDOW = 5;
const TEAM_FORM_WINDOW = 5;
const TEAM_FORM_CHART_POINTS = 8;
const TEAM_FORM_ROLLING_WINDOW = 3;
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

const formatNullableNumber = (value: number | null | undefined, digits = 1, suffix = '') => {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'n/a';
  return `${Number(value).toFixed(digits)}${suffix}`;
};

const getInsightToneClass = (tone: 'good' | 'neutral' | 'risk' | 'na') => {
  if (tone === 'good') return 'text-positive';
  if (tone === 'risk') return 'text-negative';
  if (tone === 'neutral') return 'text-warning';
  return 'text-secondary';
};

const getSampleConfidenceBadgeClass = (confidence: 'alacsony' | 'kozepes' | 'magas') => {
  if (confidence === 'magas') return 'bg-positive/15 text-positive border border-positive/30';
  if (confidence === 'kozepes') return 'bg-warning/15 text-warning border border-warning/30';
  return 'bg-surface-2 text-primary border border-border-subtle';
};

const normalizeSampleConfidence = (confidence: string | undefined): 'alacsony' | 'kozepes' | 'magas' => {
  if (confidence === 'magas' || confidence === 'kozepes' || confidence === 'alacsony') return confidence;
  return 'alacsony';
};

const formatSampleConfidenceLabel = (confidence: 'alacsony' | 'kozepes' | 'magas') => {
  if (confidence === 'magas') return 'Minta: magas';
  if (confidence === 'kozepes') return 'Minta: közepes';
  return 'Minta: alacsony';
};

const stdDev = (values: number[]) => {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const clampPercent = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const buildPregameEfficiencyBaseline = (team: PregameTeamSeasonStat): PregameEfficiencyBaseline => {
  const games = Math.max(team.games || 1, 1);
  const twoPA = (team.fga2 || 0) / games;
  const threePA = (team.fga3 || 0) / games;
  const fta = (team.fta || 0) / games;
  const tov = (team.tov || 0) / games;
  const oreb = (team.oreb || 0) / games;
  const fga = twoPA + threePA;
  const possessions = Math.max(fga + 0.44 * fta + tov - oreb, 0.1);
  const twoPct = team.fga2 > 0 ? ((team.fgm2 || 0) / team.fga2) * 100 : 0;
  const threePct = team.fga3 > 0 ? ((team.fgm3 || 0) / team.fga3) * 100 : 0;
  const ftPct = team.fta > 0 ? ((team.ftm || 0) / team.fta) * 100 : 0;
  const threeSharePct = fga > 0 ? (threePA / fga) * 100 : 0;
  const ftRatePct = fga > 0 ? (fta / fga) * 100 : 0;
  const tovRatePct = possessions > 0 ? (tov / possessions) * 100 : 0;
  const orebBonusPct = possessions > 0 ? (oreb / possessions) * 100 : 0;
  const made2 = twoPA * (twoPct / 100);
  const made3 = threePA * (threePct / 100);
  const expectedPoints = made2 * 2 + made3 * 3 + fta * (ftPct / 100);
  const efg = fga > 0 ? ((made2 + 1.5 * made3) / fga) * 100 : 0;
  const ppp = possessions > 0 ? expectedPoints / possessions : 0;

  return {
    teamId: team.teamId,
    teamName: team.teamName,
    games,
    actualPointsPerGame: (team.pointsFor || 0) / games,
    possessions: roundValue(possessions, 1),
    fga: roundValue(fga, 1),
    twoPA: roundValue(twoPA, 1),
    threePA: roundValue(threePA, 1),
    fta: roundValue(fta, 1),
    tov: roundValue(tov, 1),
    oreb: roundValue(oreb, 1),
    twoPct: roundValue(twoPct, 1),
    threePct: roundValue(threePct, 1),
    ftPct: roundValue(ftPct, 1),
    threeSharePct: roundValue(threeSharePct, 1),
    ftRatePct: roundValue(ftRatePct, 1),
    tovRatePct: roundValue(tovRatePct, 1),
    orebBonusPct: roundValue(orebBonusPct, 1),
    efg: roundValue(efg, 1),
    ppp: roundValue(ppp, 3),
    expectedPoints: roundValue(expectedPoints, 1),
  };
};

const projectPregameEfficiency = (
  baseline: PregameEfficiencyBaseline,
  inputs: {
    possessions: number;
    threeSharePct: number;
    ftRatePct: number;
    tovRatePct: number;
    orebBonusPct: number;
    twoPct: number;
    threePct: number;
    ftPct: number;
  }
) => {
  const possessions = Math.max(inputs.possessions, 1);
  const threeSharePct = clampPercent(inputs.threeSharePct, 10, 70);
  const ftRatePct = clampPercent(inputs.ftRatePct, 5, 80);
  const tovRatePct = clampPercent(inputs.tovRatePct, 5, 30);
  const orebBonusPct = clampPercent(inputs.orebBonusPct, 0, 20);
  const twoPct = clampPercent(inputs.twoPct);
  const threePct = clampPercent(inputs.threePct);
  const ftPct = clampPercent(inputs.ftPct);
  const ftRate = ftRatePct / 100;
  const tov = possessions * (tovRatePct / 100);
  const oreb = possessions * (orebBonusPct / 100);
  const fga = Math.max((possessions - tov + oreb) / (1 + 0.44 * ftRate), 0);
  const threePA = fga * (threeSharePct / 100);
  const twoPA = Math.max(fga - threePA, 0);
  const fta = fga * ftRate;
  const made2 = twoPA * (twoPct / 100);
  const made3 = threePA * (threePct / 100);
  const expectedPoints = made2 * 2 + made3 * 3 + fta * (ftPct / 100);
  const totalFga = twoPA + threePA;
  const efg = totalFga > 0 ? ((made2 + 1.5 * made3) / totalFga) * 100 : 0;
  const ppp = possessions > 0 ? expectedPoints / possessions : 0;

  return {
    possessions: roundValue(possessions, 1),
    fga: roundValue(fga, 1),
    twoPA: roundValue(twoPA, 1),
    threePA: roundValue(threePA, 1),
    fta: roundValue(fta, 1),
    tov: roundValue(tov, 1),
    oreb: roundValue(oreb, 1),
    threeSharePct: roundValue(threeSharePct, 1),
    ftRatePct: roundValue(ftRatePct, 1),
    tovRatePct: roundValue(tovRatePct, 1),
    orebBonusPct: roundValue(orebBonusPct, 1),
    twoPct: roundValue(twoPct, 1),
    threePct: roundValue(threePct, 1),
    ftPct: roundValue(ftPct, 1),
    expectedPoints: roundValue(expectedPoints, 1),
    efg: roundValue(efg, 1),
    ppp: roundValue(ppp, 3),
    deltaPoints: roundValue(expectedPoints - baseline.expectedPoints, 1),
    deltaEfg: roundValue(efg - baseline.efg, 1),
  };
};

const probabilityLabel = (value: number): 'Magas' | 'Közepes' | 'Alacsony' => {
  if (value >= 0.68 || value <= 0.32) return 'Magas';
  if (value >= 0.58 || value <= 0.42) return 'Közepes';
  return 'Alacsony';
};

const bestOfSeriesOutcome = (gameProbabilities: number[], winsNeeded: number) => {
  const scoreProbabilities = new Map<string, number>();

  const walk = (gameIndex: number, homeWins: number, awayWins: number, probability: number) => {
    if (homeWins >= winsNeeded || awayWins >= winsNeeded || gameIndex >= gameProbabilities.length) {
      if (homeWins >= winsNeeded || awayWins >= winsNeeded) {
        const key = `${homeWins}-${awayWins}`;
        scoreProbabilities.set(key, (scoreProbabilities.get(key) || 0) + probability);
      }
      return;
    }

    const pHome = clamp01(gameProbabilities[gameIndex] ?? 0.5);
    walk(gameIndex + 1, homeWins + 1, awayWins, probability * pHome);
    walk(gameIndex + 1, homeWins, awayWins + 1, probability * (1 - pHome));
  };

  walk(0, 0, 0, 1);

  let homeSeriesWinProbability = 0;
  let mostLikelyHomeWinScore: string | null = null;
  let mostLikelyAwayWinScore: string | null = null;
  let mostLikelyHomeWinProbability = -1;
  let mostLikelyAwayWinProbability = -1;

  scoreProbabilities.forEach((probability, score) => {
    const [home, away] = score.split('-').map(value => Number(value));
    if (home > away) {
      homeSeriesWinProbability += probability;
      if (probability > mostLikelyHomeWinProbability) {
        mostLikelyHomeWinProbability = probability;
        mostLikelyHomeWinScore = score;
      }
    } else {
      if (probability > mostLikelyAwayWinProbability) {
        mostLikelyAwayWinProbability = probability;
        mostLikelyAwayWinScore = score;
      }
    }
  });

  return {
    homeSeriesWinProbability: clamp01(homeSeriesWinProbability),
    mostLikelyHomeWinScore,
    mostLikelyAwayWinScore,
  };
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
  const tsDenominator = 2 * (fga + 0.44 * totals.fta);
  const tsPct = tsDenominator > 0 ? (totals.points / tsDenominator) * 100 : 0;
  const ppp = pace > 0 ? totals.points / pace : 0;

  return {
    pace,
    threePct,
    turnoverRate,
    efg,
    tsPct,
    ppp,
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
      return 'text-positive';
    case 'Közepes':
      return 'text-warning';
    default:
      return 'text-negative';
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
  if (!Number.isFinite(value) || Math.abs(value) < 0.2) return 'text-secondary';
  return value > 0 ? 'text-positive' : 'text-negative';
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
  rolesByPlayerId: Map<string, string[]>,
  rosterPlayers: PlayerStats[] = players
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
    teams.set(teamId, team);
  });

  rosterPlayers.forEach(player => {
    if (!player.teamId) return;
    const team = teams.get(player.teamId);
    if (!team) return;

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
  const [pregameEfficiencyInputs, setPregameEfficiencyInputs] = useState<PregameEfficiencyInputs>({
    ownPossessions: 70,
    ownThreeSharePct: 35,
    ownFtRatePct: 25,
    ownTovRatePct: 14,
    ownOrebBonusPct: 5,
    ownTwoPct: 50,
    ownThreePct: 33,
    ownFtPct: 75,
    opponentPossessions: 70,
    opponentThreeSharePct: 35,
    opponentFtRatePct: 25,
    opponentTovRatePct: 14,
    opponentOrebBonusPct: 5,
    opponentTwoPct: 50,
    opponentThreePct: 33,
    opponentFtPct: 75,
  });
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
  const [textReportStyle, setTextReportStyle] = useState<'fan' | 'balanced' | 'coach'>('balanced');
  const [expandedPlayerImpactId, setExpandedPlayerImpactId] = useState<string | null>(null);
  const [playerNarratives, setPlayerNarratives] = useState<Record<string, PlayerNarrativeStatus>>({});
  const [isGeneratingAllPlayerNarratives, setIsGeneratingAllPlayerNarratives] = useState(false);
  const [teamNarrative, setTeamNarrative] = useState<TeamNarrativeStatus>({ status: 'idle' });
  const [teamNarrativeStyle, setTeamNarrativeStyle] = useState<'fan' | 'coach' | 'scouting'>('fan');
  const [isGeneratingTeamNarrative, setIsGeneratingTeamNarrative] = useState(false);
  const [isGeneratingPlayerSeasonText, setIsGeneratingPlayerSeasonText] = useState(false);
  const [isSavingPlayerSeasonText, setIsSavingPlayerSeasonText] = useState(false);
  const [playerSeasonSaveStatus, setPlayerSeasonSaveStatus] = useState<
    { type: 'success' | 'error'; message: string } | null
  >(null);
  const [postgameShotContext, setPostgameShotContext] = useState<PostGameShotMapContext | null>(null);
  const [kosarstatPostgameNotes, setKosarstatPostgameNotes] = useState<string[]>([]);
  const [kosarstatLineupAnalysis, setKosarstatLineupAnalysis] = useState<KosarstatLineupAnalysis | null>(null);
  const [kosarstatQuarterStats, setKosarstatQuarterStats] = useState<KosarstatQuarterStatRow[]>([]);
  const [kosarstatTeamMetrics, setKosarstatTeamMetrics] = useState<KosarstatTeamMetricRow[]>([]);
  const [postgamePbpContext, setPostgamePbpContext] = useState<PostgamePbpContext | null>(null);
  const [kosarstatClutchImportNote, setKosarstatClutchImportNote] = useState<string | null>(null);
  const [seasonKosarstatClutch, setSeasonKosarstatClutch] = useState<PostgamePbpContext['clutch'] | null>(null);
  const [seasonKosarstatClutchGames, setSeasonKosarstatClutchGames] = useState(0);
  const [seasonKosarstatParsedClutchGames, setSeasonKosarstatParsedClutchGames] = useState<KosarstatParsedClutchGame[]>([]);
  const [seasonKosarstatLineupTeam, setSeasonKosarstatLineupTeam] = useState<KosarstatTeamLineupAnalysis | null>(null);
  const [seasonKosarstatLineupGames, setSeasonKosarstatLineupGames] = useState(0);
  const [isLoadingKosarstatPostgame, setIsLoadingKosarstatPostgame] = useState(false);
  const [selectedComboSize, setSelectedComboSize] = useState<2 | 3>(2);
  const [selectedComboPlayerA, setSelectedComboPlayerA] = useState('');
  const [selectedComboPlayerB, setSelectedComboPlayerB] = useState('');
  const [selectedComboPlayerC, setSelectedComboPlayerC] = useState('');
  const LINEUP_FILTER_ALL = '__all__';
  const [lineupAnyPlayerFilter, setLineupAnyPlayerFilter] = useState(LINEUP_FILTER_ALL);
  const [lineupPgFilter, setLineupPgFilter] = useState(LINEUP_FILTER_ALL);
  const [lineupSgFilter, setLineupSgFilter] = useState(LINEUP_FILTER_ALL);
  const [lineupSfFilter, setLineupSfFilter] = useState(LINEUP_FILTER_ALL);
  const [lineupPfFilter, setLineupPfFilter] = useState(LINEUP_FILTER_ALL);
  const [lineupCFilter, setLineupCFilter] = useState(LINEUP_FILTER_ALL);
  const [selectedPostgameShotPlayerId, setSelectedPostgameShotPlayerId] = useState('all');
  const [showPostgameShotPoints, setShowPostgameShotPoints] = useState(true);
  const [showPostgameShotHeatmap, setShowPostgameShotHeatmap] = useState(true);
  const [showKosarstatOnlyPostgame, setShowKosarstatOnlyPostgame] = useState(false);
  const [postgameHeatmapContrast, setPostgameHeatmapContrast] = useState<'soft' | 'normal' | 'sharp'>('normal');
  const [postgameHeatmapMode, setPostgameHeatmapMode] = useState<'volume' | 'efficiency'>('volume');
  const [selectedPostgameFactor, setSelectedPostgameFactor] = useState<string | null>(null);
  const [selectedPostgameZone, setSelectedPostgameZone] = useState<'rim' | 'paint' | 'mid' | 'corner3' | 'aboveBreak3' | null>(null);
  const [selectedTrendPlayerId, setSelectedTrendPlayerId] = useState<string>('');
  const [teamSeasonShotRows, setTeamSeasonShotRows] = useState<ShotEventRow[]>([]);
  const [opponentSeasonShotRows, setOpponentSeasonShotRows] = useState<ShotEventRow[]>([]);
  const [teamAllowedSeasonShotRows, setTeamAllowedSeasonShotRows] = useState<ShotEventRow[]>([]);
  const [opponentAllowedSeasonShotRows, setOpponentAllowedSeasonShotRows] = useState<ShotEventRow[]>([]);
  const [leagueSeasonShotRows, setLeagueSeasonShotRows] = useState<ShotEventRow[]>([]);
  const [playerSeasonShotRows, setPlayerSeasonShotRows] = useState<ShotEventRow[]>([]);
  const [standingsSnapshot, setStandingsSnapshot] = useState<StandingsSnapshotRow[]>([]);
  const [seasonFixtures, setSeasonFixtures] = useState<SeasonFixture[]>([]);
  const [seasonPlayedFixtures, setSeasonPlayedFixtures] = useState<
    Array<{
      home_team_id: string;
      away_team_id: string;
      game_date: string;
      home_score: number | null;
      away_score: number | null;
      status: string;
    }>
  >([]);
  const [usedLegacyStandingsFallback, setUsedLegacyStandingsFallback] = useState(false);
  const [projectionScenario, setProjectionScenario] = useState<'baseline' | 'form' | 'upset'>('baseline');
  const [whatIfHomeAdvantageDelta, setWhatIfHomeAdvantageDelta] = useState(0);
  const [whatIfLogisticDelta, setWhatIfLogisticDelta] = useState(0);
  const [whatIfTeamAdjustments, setWhatIfTeamAdjustments] = useState<Record<string, number>>({});
  const [whatIfTeamKey, setWhatIfTeamKey] = useState<string>('');
  const [whatIfTeamDeltaInput, setWhatIfTeamDeltaInput] = useState<string>('0');
  const [selectedProjectionTeamKey, setSelectedProjectionTeamKey] = useState<string>('');
  const [fixtureWinnerOverrides, setFixtureWinnerOverrides] = useState<Partial<Record<string, 'home' | 'away'>>>({});
  const [playoffSeriesWinnerOverrides, setPlayoffSeriesWinnerOverrides] = useState<Partial<Record<string, 'home' | 'away'>>>({});
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
  const selectedGameForPostgame = useMemo(() => {
    if (!selectedGameId) return null;
    return games.find(game => game.id === selectedGameId) || null;
  }, [games, selectedGameId]);
  const selectedTeamNameForPostgame = useMemo(() => {
    return allTeams.find(team => team.id === resolvedTeamId)?.name || null;
  }, [allTeams, resolvedTeamId]);
  const selectedGamePlayerNameKeysForPostgame = useMemo(() => {
    if (!selectedGameForPostgame?.id) return [] as string[];
    const names = new Set<string>();
    playerGameStats.forEach(row => {
      if (row.game_id !== selectedGameForPostgame.id) return;
      const normalized = normalizeTeamKey(row.players?.name || '');
      if (normalized) names.add(normalized);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'hu'));
  }, [playerGameStats, selectedGameForPostgame?.id]);
  const selectedGamePlayerNamesSignatureForPostgame = useMemo(() => {
    return selectedGamePlayerNameKeysForPostgame.join('|');
  }, [selectedGamePlayerNameKeysForPostgame]);
  const selectedGamePlayerNamesCsvSignatureForPostgame = useMemo(() => {
    return selectedGamePlayerNameKeysForPostgame.join(',');
  }, [selectedGamePlayerNameKeysForPostgame]);

  useEffect(() => {
    setSelectedProjectionTeamKey('');
    setFixtureWinnerOverrides({});
    setPlayoffSeriesWinnerOverrides({});
  }, [resolvedSeasonId]);

  useEffect(() => {
    if (!resolvedTeamId || resolvedTeamId === 'all') return;
    const selectedTeamName = allTeams.find(team => team.id === resolvedTeamId)?.name;
    if (!selectedTeamName) return;
    setSelectedProjectionTeamKey(normalizeTeamKey(selectedTeamName));
  }, [allTeams, resolvedTeamId]);

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

    const loadOpponentSeasonShots = async () => {
      if (!resolvedSeasonId || !selectedOpponentTeamId) {
        if (!cancelled) setOpponentSeasonShotRows([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('hunbasket_shot_events' as never)
          .select('player_id, x, y, is_successful, shot_side')
          .eq('season_id', resolvedSeasonId)
          .eq('team_id', selectedOpponentTeamId);

        if (error || !Array.isArray(data)) {
          if (!cancelled) setOpponentSeasonShotRows([]);
          return;
        }

        if (!cancelled) {
          setOpponentSeasonShotRows(data as ShotEventRow[]);
        }
      } catch {
        if (!cancelled) setOpponentSeasonShotRows([]);
      }
    };

    loadOpponentSeasonShots();

    return () => {
      cancelled = true;
    };
  }, [resolvedSeasonId, selectedOpponentTeamId]);

  useEffect(() => {
    let cancelled = false;

    const loadAllowedSeasonShots = async (
      teamId: string | null,
      setter: (value: ShotEventRow[]) => void
    ) => {
      if (!resolvedSeasonId || !teamId) {
        if (!cancelled) setter([]);
        return;
      }

      try {
        const { data: rawData, error: rawError } = await supabase
          .from('hunbasket_shotchart_raw' as never)
          .select('id, home_team_id, away_team_id')
          .eq('season_id', resolvedSeasonId)
          .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`);

        if (rawError || !Array.isArray(rawData)) {
          if (!cancelled) setter([]);
          return;
        }

        const rawIds = (rawData as ShotRawRow[])
          .map(row => String(row.id || ''))
          .filter(Boolean);

        if (rawIds.length === 0) {
          if (!cancelled) setter([]);
          return;
        }

        const { data: shotData, error: shotError } = await supabase
          .from('hunbasket_shot_events' as never)
          .select('raw_game_id, team_id, player_id, x, y, is_successful, shot_side')
          .in('raw_game_id', rawIds)
          .neq('team_id', teamId);

        if (shotError || !Array.isArray(shotData)) {
          if (!cancelled) setter([]);
          return;
        }

        if (!cancelled) {
          setter(shotData as ShotEventRow[]);
        }
      } catch {
        if (!cancelled) setter([]);
      }
    };

    loadAllowedSeasonShots(resolvedTeamId && resolvedTeamId !== 'all' ? resolvedTeamId : null, setTeamAllowedSeasonShotRows);
    loadAllowedSeasonShots(selectedOpponentTeamId || null, setOpponentAllowedSeasonShotRows);

    return () => {
      cancelled = true;
    };
  }, [resolvedSeasonId, resolvedTeamId, selectedOpponentTeamId]);

  useEffect(() => {
    let cancelled = false;

    const loadKosarstatPostgameNotes = async () => {
      const targetGame = selectedGameForPostgame;
      const selectedTeamName = selectedTeamNameForPostgame;

      if (!targetGame || !resolvedSeasonId || !resolvedTeamId || resolvedTeamId === 'all') {
        if (!cancelled) {
          setKosarstatPostgameNotes([]);
          setKosarstatLineupAnalysis(null);
          setKosarstatQuarterStats([]);
          setKosarstatTeamMetrics([]);
          setIsLoadingKosarstatPostgame(false);
        }
        return;
      }

      setIsLoadingKosarstatPostgame(true);

      try {
        let loadedQuarterStats: KosarstatQuarterStatRow[] = [];
        let loadedTeamMetrics: KosarstatTeamMetricRow[] = [];

        const ownTeamNeedle = normalizeSearchText(selectedTeamName || '');
        const opponentNeedle = normalizeSearchText(targetGame.opponent || '');
        const dateVariants = Array.from(toDateSearchVariants(targetGame.date)).map(normalizeSearchText);
        const targetDateIso = toIsoDateString(targetGame.date);
        const ownScoreNeedle = Number.isFinite(targetGame.ourScore) ? String(targetGame.ourScore) : '';
        const oppScoreNeedle = Number.isFinite(targetGame.oppScore) ? String(targetGame.oppScore) : '';
        const hasScoreContext = Number.isFinite(targetGame.ourScore) && Number.isFinite(targetGame.oppScore);
        const hasDateContext = dateVariants.length > 0;
        const expectedHomeScore = targetGame.homeAway === 'home' ? targetGame.ourScore : targetGame.oppScore;
        const expectedAwayScore = targetGame.homeAway === 'home' ? targetGame.oppScore : targetGame.ourScore;
        const scoreSeparators = '[:\\-–]';

        const containsScorePair = (text: string, left: number, right: number) => {
          const matcher = new RegExp(`(^|\\D)${left}\\s*${scoreSeparators}\\s*${right}(\\D|$)`);
          return matcher.test(text);
        };

        const scoreGamePageCandidate = (row: {
          raw_text?: string;
          source_url?: string;
          match_date?: string | null;
          home_team_name?: string | null;
          away_team_name?: string | null;
          home_score?: number | null;
          away_score?: number | null;
          competition_phase?: string | null;
        }) => {
          const raw = typeof row.raw_text === 'string' ? row.raw_text : '';
          const normalizedRaw = normalizeSearchText(raw);
          const normalizedUrl = normalizeSearchText(typeof row.source_url === 'string' ? row.source_url : '');
          const normalizedHomeTeam = normalizeSearchText(typeof row.home_team_name === 'string' ? row.home_team_name : '');
          const normalizedAwayTeam = normalizeSearchText(typeof row.away_team_name === 'string' ? row.away_team_name : '');
          const metadataDate = typeof row.match_date === 'string' ? row.match_date : '';
          const metadataDateMatched = !!targetDateIso && !!metadataDate && metadataDate === targetDateIso;
          const metadataHomeScore = typeof row.home_score === 'number' && Number.isFinite(row.home_score) ? row.home_score : null;
          const metadataAwayScore = typeof row.away_score === 'number' && Number.isFinite(row.away_score) ? row.away_score : null;
          const metadataScoreOrderMatched =
            hasScoreContext &&
            metadataHomeScore !== null &&
            metadataAwayScore !== null &&
            metadataHomeScore === expectedHomeScore &&
            metadataAwayScore === expectedAwayScore;
          const metadataReverseScoreOrderMatched =
            hasScoreContext &&
            metadataHomeScore !== null &&
            metadataAwayScore !== null &&
            metadataHomeScore === expectedAwayScore &&
            metadataAwayScore === expectedHomeScore;
          const ownMatched = ownTeamNeedle
            ? normalizedRaw.includes(ownTeamNeedle) || normalizedUrl.includes(ownTeamNeedle) || normalizedHomeTeam.includes(ownTeamNeedle) || normalizedAwayTeam.includes(ownTeamNeedle)
            : false;
          const opponentMatched = opponentNeedle
            ? normalizedRaw.includes(opponentNeedle) || normalizedUrl.includes(opponentNeedle) || normalizedHomeTeam.includes(opponentNeedle) || normalizedAwayTeam.includes(opponentNeedle)
            : false;
          const rawDateMatched = dateVariants.some(variant => variant && (normalizedRaw.includes(variant) || normalizedUrl.includes(variant)));
          const dateMatched = metadataDateMatched || rawDateMatched;
          const expectedScoreOrderMatched = hasScoreContext
            ? containsScorePair(raw, expectedHomeScore, expectedAwayScore) || metadataScoreOrderMatched
            : false;
          const reverseScoreOrderMatched = hasScoreContext
            ? containsScorePair(raw, expectedAwayScore, expectedHomeScore) || metadataReverseScoreOrderMatched
            : false;
          let score = 0;

          if (ownMatched) score += 5;
          if (opponentMatched) score += 5;
          if (ownMatched && opponentMatched) score += 6;
          if (rawDateMatched) score += 8;
          if (metadataDateMatched) score += 20;
          if (metadataScoreOrderMatched) score += 20;
          if (ownScoreNeedle && raw.includes(ownScoreNeedle)) score += 1;
          if (oppScoreNeedle && raw.includes(oppScoreNeedle)) score += 1;
          if (expectedScoreOrderMatched) score += 8;
          if (reverseScoreOrderMatched) score -= 4;

          return {
            score,
            ownMatched,
            opponentMatched,
            dateMatched,
            expectedScoreOrderMatched,
          };
        };

        const selectedGamePlayerNames = new Set(
          selectedGamePlayerNamesSignatureForPostgame
            ? selectedGamePlayerNamesSignatureForPostgame.split('|').filter(Boolean)
            : []
        );

        const normalizedHeader = (value: unknown) =>
          String(value ?? '')
            .replace(/\u00A0/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();

        const hasHeader = (headers: string[], matcher: (header: string) => boolean) =>
          headers.some(header => matcher(normalizedHeader(header)));

        const computeLineupRawQuality = (tables: KosarstatLineupTableRow[]) => {
          let hasFiveMan = false;
          let hasPlayerSummary = false;
          let hasMinuteGrid = false;

          tables.forEach(table => {
            const headers = Array.isArray(table.headers)
              ? (table.headers as unknown[]).map(item => String(item ?? '').trim()).filter(Boolean)
              : [];
            if (headers.length === 0) return;

            const hasPg = hasHeader(headers, h => h === 'pg');
            const hasSg = hasHeader(headers, h => h === 'sg');
            const hasSf = hasHeader(headers, h => h === 'sf');
            const hasPf = hasHeader(headers, h => h === 'pf');
            const hasC = hasHeader(headers, h => h === 'c');
            const hasMin = hasHeader(headers, h => h === 'min');
            const hasOnPlusMinus = hasHeader(headers, h => h.includes('on +/-') || h.includes('on + -') || h.includes('on±'));
            const hasOn40 = hasHeader(headers, h => h === 'on40' || h === 'on 40');
            const hasJatekos = hasHeader(headers, h => h === 'játékos' || h === 'jatekos');
            const hasPerc = hasHeader(headers, h => h === 'perc');
            const hasMinute1 = hasHeader(headers, h => h === '1');
            const hasMinute40 = hasHeader(headers, h => h === '40');

            if (hasPg && hasSg && hasSf && hasPf && hasC && hasMin && hasOnPlusMinus) {
              hasFiveMan = true;
            }
            if (hasJatekos && hasMin && hasOn40) {
              hasPlayerSummary = true;
            }
            if (hasJatekos && hasPerc && hasMinute1 && hasMinute40) {
              hasMinuteGrid = true;
            }
          });

          let score = 0;
          if (hasFiveMan) score += 100;
          if (hasPlayerSummary) score += 40;
          if (hasMinuteGrid) score += 25;
          score += Math.min(20, tables.length);

          return {
            score,
            hasFiveMan,
            hasPlayerSummary,
            hasMinuteGrid,
          };
        };

        const directGameId = typeof targetGame.kosarstatGameId === 'string' ? targetGame.kosarstatGameId.trim() : '';
        let gameId = directGameId;

        if (gameId) {
          const { data: directGamePage } = await supabase
            .from('kosarstat_game_pages_raw' as never)
            .select('raw_text, source_url, match_date, home_team_name, away_team_name, home_score, away_score, competition_phase')
            .eq('season_id', resolvedSeasonId)
            .eq('page_type', 'game')
            .eq('kosarstat_game_id', gameId)
            .order('imported_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const check = scoreGamePageCandidate((directGamePage || {}) as {
            raw_text?: string;
            source_url?: string;
            match_date?: string | null;
            home_team_name?: string | null;
            away_team_name?: string | null;
            home_score?: number | null;
            away_score?: number | null;
            competition_phase?: string | null;
          });
          const directLooksValid =
            check.ownMatched &&
            check.opponentMatched &&
            (!hasDateContext || check.dateMatched) &&
            (!hasScoreContext || check.expectedScoreOrderMatched);
          if (!directLooksValid) {
            if (selectedGameId) {
              await supabase
                .from('games' as never)
                .update({ kosarstat_game_id: null } as never)
                .eq('id', selectedGameId);
            }
            gameId = '';
          }
        }

        if (!gameId) {
          const { data: gamePages, error: gameError } = await supabase
            .from('kosarstat_game_pages_raw' as never)
            .select('kosarstat_game_id, imported_at, raw_text, source_url, match_date, home_team_name, away_team_name, home_score, away_score, competition_phase')
            .eq('season_id', resolvedSeasonId)
            .eq('page_type', 'game')
            .order('imported_at', { ascending: false })
            .limit(2000);

          if (gameError || !Array.isArray(gamePages) || gamePages.length === 0) {
            if (!cancelled) {
              setKosarstatPostgameNotes([]);
              setIsLoadingKosarstatPostgame(false);
            }
            return;
          }

          const scoredCandidates = (gamePages as Array<{
            kosarstat_game_id?: string;
            raw_text?: string;
            imported_at?: string;
            source_url?: string;
            match_date?: string | null;
            home_team_name?: string | null;
            away_team_name?: string | null;
            home_score?: number | null;
            away_score?: number | null;
            competition_phase?: string | null;
          }>).
            map(row => {
              const scored = scoreGamePageCandidate(row);

              return {
                row,
                ...scored,
              };
            })
            .filter(candidate => candidate.score > 0)
            .sort((a, b) => b.score - a.score);

          const strictWithDateCandidates = scoredCandidates.filter(candidate => {
            const ownOk = ownTeamNeedle ? candidate.ownMatched : true;
            const opponentOk = opponentNeedle ? candidate.opponentMatched : true;
            const dateOk = hasDateContext ? candidate.dateMatched : true;
            const scoreOk = hasScoreContext ? candidate.expectedScoreOrderMatched : true;
            return ownOk && opponentOk && dateOk && scoreOk;
          });

          const strictCandidates = strictWithDateCandidates.length > 0
            ? strictWithDateCandidates
            : scoredCandidates.filter(candidate => {
                const ownOk = ownTeamNeedle ? candidate.ownMatched : true;
                const opponentOk = opponentNeedle ? candidate.opponentMatched : true;
                const scoreOk = hasScoreContext ? candidate.expectedScoreOrderMatched : true;
                return ownOk && opponentOk && scoreOk;
              });

          const baseCandidates = strictCandidates
            .map(candidate => String(candidate.row?.kosarstat_game_id || ''))
            .filter(Boolean);

          gameId = baseCandidates[0] || '';

          if (selectedGamePlayerNames.size > 0 && baseCandidates.length > 1) {
            const candidateGameIds = Array.from(new Set(baseCandidates)).slice(0, 6);

            const { data: lineupRawCandidates } = await supabase
              .from('kosarstat_game_pages_raw' as never)
              .select('id, kosarstat_game_id, imported_at')
              .eq('season_id', resolvedSeasonId)
              .eq('page_type', 'game_lineups')
              .in('kosarstat_game_id', candidateGameIds)
              .order('imported_at', { ascending: false });

            const rawIdsByGameId = new Map<string, string[]>();
            (lineupRawCandidates as Array<{ id?: string; kosarstat_game_id?: string }> | null)?.forEach(row => {
              const gid = String(row.kosarstat_game_id || '');
              const rid = String(row.id || '');
              if (!gid || !rid) return;
              if (!rawIdsByGameId.has(gid)) rawIdsByGameId.set(gid, []);
              rawIdsByGameId.get(gid)!.push(rid);
            });

            const rawIds = Array.from(new Set(Array.from(rawIdsByGameId.values()).flat()));
            if (rawIds.length > 0) {
              const { data: candidateTables } = await supabase
                .from('kosarstat_game_page_tables' as never)
                .select('page_raw_id, table_index, rows, headers, source_table_dom_id')
                .in('page_raw_id', rawIds)
                .order('table_index', { ascending: true });

              const tablesByRawId = new Map<string, KosarstatLineupTableRow[]>();
              (candidateTables as Array<KosarstatLineupTableRow & { page_raw_id?: string }> | null)?.forEach(row => {
                const rawId = String(row.page_raw_id || '');
                if (!rawId) return;
                if (!tablesByRawId.has(rawId)) tablesByRawId.set(rawId, []);
                tablesByRawId.get(rawId)!.push(row);
              });

              tablesByRawId.forEach((items, rawId) => {
                items.sort((a, b) => {
                  const aIdx = Number.parseInt(String((a as { table_index?: unknown }).table_index ?? ''), 10);
                  const bIdx = Number.parseInt(String((b as { table_index?: unknown }).table_index ?? ''), 10);
                  if (Number.isFinite(aIdx) && Number.isFinite(bIdx)) return aIdx - bIdx;
                  return 0;
                });
                tablesByRawId.set(rawId, items);
              });

              const usableRawByGameId = new Map<string, string>();
              rawIdsByGameId.forEach((ids, gid) => {
                const ranked = ids
                  .map(id => {
                    const tables = tablesByRawId.get(id) || [];
                    return {
                      id,
                      quality: computeLineupRawQuality(tables),
                      tableCount: tables.length,
                    };
                  })
                  .sort((a, b) => b.quality.score - a.quality.score || b.tableCount - a.tableCount);

                const usableId = ranked[0]?.id || ids[0];
                if (usableId) usableRawByGameId.set(gid, usableId);
              });

              let bestOverlapGameId = gameId;
              let bestOverlapCount = -1;

              candidateGameIds.forEach(candidateId => {
                const rawId = usableRawByGameId.get(candidateId);
                if (!rawId) return;
                const tables = tablesByRawId.get(rawId) || [];
                if (tables.length === 0) return;

                const parsed = parseKosarstatLineupAnalysis(tables, candidateId, selectedTeamName, targetGame.homeAway);
                const team = parsed?.selectedTeam || parsed?.homeTeam || parsed?.awayTeam;
                if (!team) return;

                const lineupPlayers = new Set(team.playerMinutes.map(item => normalizeTeamKey(item.player)).filter(Boolean));
                let overlap = 0;
                selectedGamePlayerNames.forEach(name => {
                  if (lineupPlayers.has(name)) overlap += 1;
                });

                if (overlap > bestOverlapCount) {
                  bestOverlapCount = overlap;
                  bestOverlapGameId = candidateId;
                }
              });

              if (bestOverlapCount >= 2) {
                gameId = bestOverlapGameId;
              }
            }
          }

          if (gameId && selectedGameId && gameId !== directGameId) {
            await supabase
              .from('games' as never)
              .update({ kosarstat_game_id: gameId } as never)
              .eq('id', selectedGameId);
          }
        }

        if (!gameId) {
          if (!cancelled) {
            setKosarstatPostgameNotes([
              `Kosarstat meccs-egyeztetes sikertelen ehhez a postgame meccshez (datum=${targetGame.date}, ellenfel=${targetGame.opponent || 'ismeretlen'}).`,
            ]);
            setPostgamePbpContext(null);
            setKosarstatClutchImportNote(null);
            setKosarstatQuarterStats([]);
            setKosarstatTeamMetrics([]);
            setIsLoadingKosarstatPostgame(false);
          }
          return;
        }

        const [quarterStatsResult, teamMetricsResult, clutchRawResult] = await Promise.all([
          supabase
            .from('kosarstat_game_quarter_stats' as never)
            .select('team_name, team_side, quarter, points, cumulative_points')
            .eq('season_id', resolvedSeasonId)
            .eq('kosarstat_game_id', gameId)
            .order('quarter', { ascending: true }),
          supabase
            .from('kosarstat_game_team_metrics' as never)
            .select('team_name, team_side, poss, ortg, efg, tov_pct, orb_pct, ftm_rate')
            .eq('season_id', resolvedSeasonId)
            .eq('kosarstat_game_id', gameId),
          supabase
            .from('kosarstat_game_pages_raw' as never)
            .select('id, imported_at, home_team_name, away_team_name')
            .eq('season_id', resolvedSeasonId)
            .eq('kosarstat_game_id', gameId)
            .eq('page_type', 'game_clutch')
            .order('imported_at', { ascending: false })
            .limit(5)
        ]);

        loadedQuarterStats = Array.isArray(quarterStatsResult.data)
          ? (quarterStatsResult.data as KosarstatQuarterStatRow[])
          : [];
        loadedTeamMetrics = Array.isArray(teamMetricsResult.data)
          ? (teamMetricsResult.data as KosarstatTeamMetricRow[])
          : [];
        const clutchRawRows = Array.isArray(clutchRawResult.data)
          ? (clutchRawResult.data as Array<{ id?: string; imported_at?: string | null; home_team_name?: string | null; away_team_name?: string | null }>)
          : [];
        let loadedClutchContext: PostgamePbpContext | null = null;
        let loadedClutchImportNote = clutchRawRows.length > 0
          ? 'Kosarstat clutch oldal importálva van ehhez a meccshez, de nem sikerült még értelmezhető clutch blokkot építeni belőle.'
          : 'Kosarstat clutch oldal még nem érhető el ehhez a meccshez.';

        if (clutchRawRows.length > 0) {
          const clutchRawIds = clutchRawRows
            .map(row => String(row.id || ''))
            .filter(Boolean);

          if (clutchRawIds.length > 0) {
            const { data: clutchTablesData } = await supabase
              .from('kosarstat_game_page_tables' as never)
              .select('page_raw_id, table_index, rows, headers, source_table_dom_id')
              .in('page_raw_id', clutchRawIds)
              .order('table_index', { ascending: true });

            const clutchTablesByRawId = new Map<string, Array<{ headers: string[]; rows: unknown[][]; sourceTableDomId: string | null }>>();

            (clutchTablesData as Array<KosarstatLineupTableRow & { page_raw_id?: string }> | null)?.forEach(row => {
              const rawId = String(row.page_raw_id || '');
              if (!rawId) return;
              if (!clutchTablesByRawId.has(rawId)) clutchTablesByRawId.set(rawId, []);
              clutchTablesByRawId.get(rawId)!.push({
                headers: Array.isArray(row.headers) ? row.headers.map(item => String(item ?? '').trim()) : [],
                rows: Array.isArray(row.rows)
                  ? row.rows.filter(Array.isArray).map(item => item as unknown[])
                  : [],
                sourceTableDomId: typeof row.source_table_dom_id === 'string' ? row.source_table_dom_id : null,
              });
            });

            for (const clutchRawRow of clutchRawRows) {
              const rawId = String(clutchRawRow.id || '');
              if (!rawId) continue;
              const clutchTables = clutchTablesByRawId.get(rawId) || [];
              if (clutchTables.length === 0) continue;

              const parsedClutchContext = buildPostgamePbpContextFromKosarstatClutch(
                clutchTables,
                {
                  homeTeamName: clutchRawRow.home_team_name,
                  awayTeamName: clutchRawRow.away_team_name,
                },
                targetGame.homeAway === 'away' ? 'away' : 'home',
                selectedTeamName ?? undefined
              );

              if (!parsedClutchContext?.clutch) continue;

              loadedClutchContext = parsedClutchContext;
              loadedClutchImportNote = parsedClutchContext.clutch.available
                ? `Kosarstat clutch stat integrálva (${parsedClutchContext.clutch.sampleLabel} minta).`
                : `Kosarstat clutch stat integrálva, de a minta rövid (${parsedClutchContext.clutch.sampleLabel}).`;
              break;
            }
          }
        }

        if (!cancelled) {
          setKosarstatQuarterStats(loadedQuarterStats);
          setKosarstatTeamMetrics(loadedTeamMetrics);
          setPostgamePbpContext(loadedClutchContext);
          setKosarstatClutchImportNote(loadedClutchImportNote);
        }

        const { data: lineupRawData, error: lineupRawError } = await supabase
          .from('kosarstat_game_pages_raw' as never)
          .select('id, imported_at')
          .eq('season_id', resolvedSeasonId)
          .eq('page_type', 'game_lineups')
          .eq('kosarstat_game_id', gameId)
          .order('imported_at', { ascending: false })
          .limit(12);

        const lineupRawRows = Array.isArray(lineupRawData)
          ? (lineupRawData as Array<{ id?: string; imported_at?: string | null }>)
          : [];
        const lineupRawIds = lineupRawRows
          .map(row => String(row.id || ''))
          .filter(Boolean);

        if (lineupRawError || lineupRawIds.length === 0) {
          if (!cancelled) {
            const notes = [
              `Kosarstat game adat azonosítva (game=${gameId}), de lineup tábla még nem érhető el ehhez a meccshez.`,
            ];
            if (loadedQuarterStats.length > 0) {
              notes.push(`Negyedenkénti pontprofil csatolva (${loadedQuarterStats.length} sor).`);
            } else {
              notes.push('Kosarstat negyedenkénti pontprofil még nem érhető el ehhez a meccshez.');
            }
            if (loadedTeamMetrics.length > 0) {
              notes.push(`Team advanced mutatók csatolva (${loadedTeamMetrics.length} sor).`);
            } else {
              notes.push('Kosarstat team advanced mutatók még nem érhetők el ehhez a meccshez.');
            }
            notes.push(loadedClutchImportNote);
            setKosarstatPostgameNotes(notes);
            setPostgamePbpContext(loadedClutchContext);
            setKosarstatLineupAnalysis(null);
            setIsLoadingKosarstatPostgame(false);
          }
          return;
        }

        const { data: tablesData, error: tablesError } = await supabase
          .from('kosarstat_game_page_tables' as never)
          .select('page_raw_id, table_index, rows, headers, source_table_dom_id')
          .in('page_raw_id', lineupRawIds)
          .order('table_index', { ascending: true });

        if (tablesError || !Array.isArray(tablesData)) {
          if (!cancelled) {
            const notes = [
              `Kosarstat lineup betöltés sikertelen (game=${gameId}).`,
            ];
            if (loadedQuarterStats.length > 0) {
              notes.push(`Negyedenkénti pontprofil csatolva (${loadedQuarterStats.length} sor).`);
            }
            if (loadedTeamMetrics.length > 0) {
              notes.push(`Team advanced mutatók csatolva (${loadedTeamMetrics.length} sor).`);
            }
            notes.push(loadedClutchImportNote);
            setKosarstatPostgameNotes(notes);
            setPostgamePbpContext(loadedClutchContext);
            setKosarstatLineupAnalysis(null);
            setIsLoadingKosarstatPostgame(false);
          }
          return;
        }

        const tablesByRawId = new Map<string, KosarstatLineupTableRow[]>();
        (tablesData as Array<KosarstatLineupTableRow & { page_raw_id?: string }>).forEach(row => {
          const rawId = String(row.page_raw_id || '');
          if (!rawId) return;
          if (!tablesByRawId.has(rawId)) tablesByRawId.set(rawId, []);
          tablesByRawId.get(rawId)!.push(row);
        });

        tablesByRawId.forEach((items, rawId) => {
          items.sort((a, b) => {
            const aIdx = Number.parseInt(String((a as { table_index?: unknown }).table_index ?? ''), 10);
            const bIdx = Number.parseInt(String((b as { table_index?: unknown }).table_index ?? ''), 10);
            if (Number.isFinite(aIdx) && Number.isFinite(bIdx)) return aIdx - bIdx;
            return 0;
          });
          tablesByRawId.set(rawId, items);
        });

        const selectedLineupRawId = (() => {
          const ranked = lineupRawIds
            .map(id => {
              const tables = tablesByRawId.get(id) || [];
              return {
                id,
                quality: computeLineupRawQuality(tables),
                tableCount: tables.length,
              };
            })
            .sort((a, b) => b.quality.score - a.quality.score || b.tableCount - a.tableCount);

          return ranked[0]?.id || lineupRawIds[0] || '';
        })();
        const selectedTablesData = selectedLineupRawId
          ? (tablesByRawId.get(selectedLineupRawId) || [])
          : [];

        if (selectedTablesData.length === 0) {
          if (!cancelled) {
            const notes = [
              `Kosarstat game adat azonosítva (game=${gameId}), de a mentett lineup raw rekord(ok)hoz nincs feldolgozott táblázat.`,
            ];
            if (loadedQuarterStats.length > 0) {
              notes.push(`Negyedenkénti pontprofil csatolva (${loadedQuarterStats.length} sor).`);
            } else {
              notes.push('Kosarstat negyedenkénti pontprofil még nem érhető el ehhez a meccshez.');
            }
            if (loadedTeamMetrics.length > 0) {
              notes.push(`Team advanced mutatók csatolva (${loadedTeamMetrics.length} sor).`);
            } else {
              notes.push('Kosarstat team advanced mutatók még nem érhetők el ehhez a meccshez.');
            }
            notes.push(loadedClutchImportNote);
            setKosarstatPostgameNotes(notes);
            setPostgamePbpContext(loadedClutchContext);
            setKosarstatLineupAnalysis(null);
            setIsLoadingKosarstatPostgame(false);
          }
          return;
        }

        const parsedLineupRaw = parseKosarstatLineupAnalysis(
          selectedTablesData,
          gameId,
          selectedTeamName,
          targetGame.homeAway
        );

        const teamOverlapScore = (team: KosarstatTeamLineupAnalysis | null) => {
          if (!team || selectedGamePlayerNames.size === 0) return 0;
          const names = new Set<string>();
          team.playerMinutes.forEach(item => names.add(normalizeTeamKey(item.player)));
          team.playerTimelines.forEach(item => names.add(normalizeTeamKey(item.player)));
          team.stints.forEach(stint => stint.players.forEach(player => names.add(normalizeTeamKey(player))));
          let overlap = 0;
          selectedGamePlayerNames.forEach(name => {
            if (names.has(name)) overlap += 1;
          });
          return overlap;
        };

        let parsedLineup = parsedLineupRaw;
        if (parsedLineupRaw) {
          const homeScore = teamOverlapScore(parsedLineupRaw.homeTeam);
          const awayScore = teamOverlapScore(parsedLineupRaw.awayTeam);

          let byOverlap = homeScore >= awayScore ? parsedLineupRaw.homeTeam : parsedLineupRaw.awayTeam;

          // Tie-breaker: prefer the requested side if overlap is equal.
          if (homeScore === awayScore) {
            if (targetGame.homeAway === 'home' && parsedLineupRaw.homeTeam) {
              byOverlap = parsedLineupRaw.homeTeam;
            } else if (targetGame.homeAway === 'away' && parsedLineupRaw.awayTeam) {
              byOverlap = parsedLineupRaw.awayTeam;
            }
          }

          if (selectedGamePlayerNames.size > 0 && Math.max(homeScore, awayScore) >= 1 && byOverlap) {
            parsedLineup = {
              ...parsedLineupRaw,
              selectedTeam: {
                ...byOverlap,
                // Ensure the header reflects the selected team context when Kosarstat labels are swapped.
                teamName: selectedTeamName || byOverlap.teamName,
              },
            };
          }
        }

        let totalRows = 0;
        const plusMinusValues: number[] = [];

        selectedTablesData.forEach(table => {
          const headers = Array.isArray(table.headers) ? (table.headers as unknown[]) : [];
          const plusMinusColumnIndexes = headers
            .map((header, index) => ({
              index,
              text:
                typeof header === 'string'
                  ? header
                      .toLowerCase()
                      .replace(/\s+/g, ' ')
                      .trim()
                  : '',
            }))
            .filter(item =>
              item.text.includes('+/-') ||
              item.text.includes('±') ||
              item.text.includes('plus/minus') ||
              item.text === '+-'
            )
            .map(item => item.index);

          const rows = Array.isArray(table.rows) ? (table.rows as unknown[]) : [];
          totalRows += rows.length;

          rows.forEach(rawRow => {
            if (!Array.isArray(rawRow)) return;
            const indexesToCheck = plusMinusColumnIndexes.length > 0
              ? plusMinusColumnIndexes
              : [];

            indexesToCheck.forEach(index => {
              const cell = rawRow[index];
              if (typeof cell !== 'string') return;
              const normalized = cell.trim().replace(',', '.');
              if (!/^[-+]?\d{1,3}(?:\.\d+)?$/.test(normalized)) return;
              const value = Number(normalized);
              if (!Number.isFinite(value)) return;
              if (Math.abs(value) > 100) return;
              plusMinusValues.push(value);
            });
          });
        });

        const notes: string[] = [
          `Kosarstat lineup adat csatolva (game=${gameId}, raw=${selectedLineupRawId}, tablazatok=${selectedTablesData.length}, sorok=${totalRows}).`,
        ];

        if (plusMinusValues.length > 0) {
          const minPm = Math.min(...plusMinusValues);
          const maxPm = Math.max(...plusMinusValues);
          notes.push(`Lineup +/- tartomány: ${minPm > 0 ? '+' : ''}${minPm} ... ${maxPm > 0 ? '+' : ''}${maxPm}.`);
        }

        if (loadedQuarterStats.length > 0) {
          notes.push(`Negyedenkénti pontprofil csatolva (${loadedQuarterStats.length} sor).`);
        } else {
          notes.push('Kosarstat negyedenkénti pontprofil még nem érhető el ehhez a meccshez.');
        }
        if (loadedTeamMetrics.length > 0) {
          notes.push(`Team advanced mutatók csatolva (${loadedTeamMetrics.length} sor).`);
        } else {
          notes.push('Kosarstat team advanced mutatók még nem érhetők el ehhez a meccshez.');
        }
        notes.push(loadedClutchImportNote);

        if (!cancelled) {
          setKosarstatPostgameNotes(notes);
          setPostgamePbpContext(loadedClutchContext);
          setKosarstatLineupAnalysis(parsedLineup);
          setIsLoadingKosarstatPostgame(false);
        }
      } catch {
        if (!cancelled) {
          setKosarstatPostgameNotes([]);
          setPostgamePbpContext(null);
          setKosarstatClutchImportNote(null);
          setKosarstatLineupAnalysis(null);
          setKosarstatQuarterStats([]);
          setKosarstatTeamMetrics([]);
          setIsLoadingKosarstatPostgame(false);
        }
      }
    };

    loadKosarstatPostgameNotes();

    return () => {
      cancelled = true;
    };
  }, [
    resolvedSeasonId,
    resolvedTeamId,
    selectedGameId,
    selectedGameForPostgame,
    selectedTeamNameForPostgame,
    selectedGamePlayerNamesCsvSignatureForPostgame,
    selectedGamePlayerNamesSignatureForPostgame,
  ]);

  useEffect(() => {
    let cancelled = false;

    const loadSeasonKosarstatClutch = async () => {
      const fallbackPlayerTeam = allPlayers.find(player => (
        String(player.seasonId ?? '') === String(resolvedSeasonId)
        &&
        String(player.id ?? '') === String(selectedPlayerId)
        && player.isActive !== false
      )) || null;
      const effectiveTeamId = resolvedTeamId && resolvedTeamId !== 'all'
        ? String(resolvedTeamId)
        : String(fallbackPlayerTeam?.teamId ?? '');
      const effectiveTeamName = (resolvedTeamId && resolvedTeamId !== 'all'
        ? selectedTeamNameForPostgame
        : fallbackPlayerTeam?.teamName) || '';

      if (!resolvedSeasonId || !effectiveTeamId || !effectiveTeamName) {
        if (!cancelled) {
          setSeasonKosarstatClutch(null);
          setSeasonKosarstatClutchGames(0);
          setSeasonKosarstatParsedClutchGames([]);
        }
        return;
      }

      try {
        const activeSelectedTeamPlayerProfiles = allPlayers
          .filter(player => String(player.seasonId ?? '') === String(resolvedSeasonId))
          .filter(player => player.isActive !== false)
          .filter(player => String(player.teamId ?? '') === effectiveTeamId)
          .map(player => buildNormalizedNameProfile(player.name || ''))
          .filter(profile => Boolean(profile.key));

        const { data: rawData, error: rawError } = await supabase
          .from('kosarstat_game_pages_raw' as never)
          .select('id, kosarstat_game_id, imported_at, home_team_name, away_team_name')
          .eq('season_id', resolvedSeasonId)
          .eq('page_type', 'game_clutch')
          .order('imported_at', { ascending: false })
          .limit(400);

        if (rawError || !Array.isArray(rawData)) {
          if (!cancelled) {
            setSeasonKosarstatClutch(null);
            setSeasonKosarstatClutchGames(0);
            setSeasonKosarstatParsedClutchGames([]);
          }
          return;
        }

        const teamNeedle = normalizeTeamKey(effectiveTeamName);
        const candidateRows = (rawData as Array<{
          id?: string | null;
          kosarstat_game_id?: string | null;
          imported_at?: string | null;
          home_team_name?: string | null;
          away_team_name?: string | null;
        }>).filter(row => {
          const homeKey = normalizeTeamKey(String(row.home_team_name || ''));
          const awayKey = normalizeTeamKey(String(row.away_team_name || ''));
          return Boolean(teamNeedle) && (
            homeKey.includes(teamNeedle)
            || teamNeedle.includes(homeKey)
            || awayKey.includes(teamNeedle)
            || teamNeedle.includes(awayKey)
          );
        });

        const bestRowsByGame = new Map<string, typeof candidateRows[number]>();
        candidateRows.forEach(row => {
          const gameId = String(row.kosarstat_game_id || '');
          const rawId = String(row.id || '');
          if (!gameId || !rawId || bestRowsByGame.has(gameId)) return;
          bestRowsByGame.set(gameId, row);
        });

        const selectedRows = Array.from(bestRowsByGame.values());
        const rawIds = selectedRows.map(row => String(row.id || '')).filter(Boolean);
        if (rawIds.length === 0) {
          if (!cancelled) {
            setSeasonKosarstatClutch(null);
            setSeasonKosarstatClutchGames(0);
            setSeasonKosarstatParsedClutchGames([]);
          }
          return;
        }

        const { data: tableData, error: tableError } = await supabase
          .from('kosarstat_game_page_tables' as never)
          .select('page_raw_id, table_index, rows, headers, source_table_dom_id')
          .in('page_raw_id', rawIds)
          .order('table_index', { ascending: true });

        if (tableError || !Array.isArray(tableData)) {
          if (!cancelled) {
            setSeasonKosarstatClutch(null);
            setSeasonKosarstatClutchGames(0);
            setSeasonKosarstatParsedClutchGames([]);
          }
          return;
        }

        const tablesByRawId = new Map<string, Array<{ headers: string[]; rows: unknown[][]; sourceTableDomId: string | null }>>();
        (tableData as Array<KosarstatLineupTableRow & { page_raw_id?: string | null }>).forEach(row => {
          const rawId = String(row.page_raw_id || '');
          if (!rawId) return;
          if (!tablesByRawId.has(rawId)) tablesByRawId.set(rawId, []);
          tablesByRawId.get(rawId)!.push({
            headers: Array.isArray(row.headers) ? row.headers.map(item => String(item ?? '').trim()) : [],
            rows: Array.isArray(row.rows)
              ? row.rows.filter(Array.isArray).map(item => item as unknown[])
              : [],
            sourceTableDomId: typeof row.source_table_dom_id === 'string' ? row.source_table_dom_id : null,
          });
        });

        const parsedGames = selectedRows
          .map(row => {
            const rawId = String(row.id || '');
            const tables = tablesByRawId.get(rawId) || [];
            if (tables.length === 0) return null;
            const ownSide: 'home' | 'away' = normalizeTeamKey(String(row.away_team_name || '')).includes(teamNeedle)
              || teamNeedle.includes(normalizeTeamKey(String(row.away_team_name || '')))
              ? 'away'
              : 'home';
            return parseKosarstatClutchGame(
              tables,
              {
                homeTeamName: row.home_team_name,
                awayTeamName: row.away_team_name,
              },
              ownSide,
              effectiveTeamName
            );
          })
          .filter((item): item is KosarstatParsedClutchGame => Boolean(item));

        if (!cancelled) {
          setSeasonKosarstatClutch(buildAggregatedKosarstatClutchContext(parsedGames, activeSelectedTeamPlayerProfiles));
          setSeasonKosarstatClutchGames(parsedGames.length);
          setSeasonKosarstatParsedClutchGames(parsedGames);
        }
      } catch {
        if (!cancelled) {
          setSeasonKosarstatClutch(null);
          setSeasonKosarstatClutchGames(0);
          setSeasonKosarstatParsedClutchGames([]);
        }
      }
    };

    loadSeasonKosarstatClutch();

    return () => {
      cancelled = true;
    };
  }, [allPlayers, resolvedSeasonId, resolvedTeamId, selectedPlayerId, selectedTeamNameForPostgame]);

  useEffect(() => {
    let cancelled = false;

    const loadSeasonKosarstatLineups = async () => {
      const fallbackPlayerTeam = allPlayers.find(player => (
        String(player.seasonId ?? '') === String(resolvedSeasonId)
        &&
        String(player.id ?? '') === String(selectedPlayerId)
        && player.isActive !== false
      )) || null;
      const effectiveTeamId = resolvedTeamId && resolvedTeamId !== 'all'
        ? String(resolvedTeamId)
        : String(fallbackPlayerTeam?.teamId ?? '');
      const effectiveTeamName = (resolvedTeamId && resolvedTeamId !== 'all'
        ? selectedTeamNameForPostgame
        : fallbackPlayerTeam?.teamName) || '';

      if (!resolvedSeasonId || !effectiveTeamId || !effectiveTeamName) {
        if (!cancelled) {
          setSeasonKosarstatLineupTeam(null);
          setSeasonKosarstatLineupGames(0);
        }
        return;
      }

      try {
        const activeSelectedTeamPlayerProfiles = allPlayers
          .filter(player => String(player.seasonId ?? '') === String(resolvedSeasonId))
          .filter(player => player.isActive !== false)
          .filter(player => String(player.teamId ?? '') === effectiveTeamId)
          .map(player => buildNormalizedNameProfile(player.name || ''))
          .filter(profile => Boolean(profile.key));

        const { data: rawData, error: rawError } = await supabase
          .from('kosarstat_game_pages_raw' as never)
          .select('id, kosarstat_game_id, imported_at, home_team_name, away_team_name')
          .eq('season_id', resolvedSeasonId)
          .eq('page_type', 'game_lineups')
          .order('imported_at', { ascending: false })
          .limit(500);

        if (rawError || !Array.isArray(rawData)) {
          if (!cancelled) {
            setSeasonKosarstatLineupTeam(null);
            setSeasonKosarstatLineupGames(0);
          }
          return;
        }

        const normalizeHeader = (value: unknown) =>
          String(value ?? '')
            .replace(/\u00A0/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
        const hasHeader = (headers: string[], matcher: (header: string) => boolean) =>
          headers.some(header => matcher(normalizeHeader(header)));
        const computeLineupRawQuality = (tables: KosarstatLineupTableRow[]) => {
          let hasFiveMan = false;
          let hasPlayerSummary = false;
          let hasMinuteGrid = false;

          tables.forEach(table => {
            const headers = Array.isArray(table.headers)
              ? (table.headers as unknown[]).map(item => String(item ?? '').trim()).filter(Boolean)
              : [];
            if (headers.length === 0) return;

            const hasPg = hasHeader(headers, h => h === 'pg');
            const hasSg = hasHeader(headers, h => h === 'sg');
            const hasSf = hasHeader(headers, h => h === 'sf');
            const hasPf = hasHeader(headers, h => h === 'pf');
            const hasC = hasHeader(headers, h => h === 'c');
            const hasMin = hasHeader(headers, h => h === 'min');
            const hasOnPlusMinus = hasHeader(headers, h => h.includes('on +/-') || h.includes('on + -') || h.includes('on±'));
            const hasOn40 = hasHeader(headers, h => h === 'on40' || h === 'on 40');
            const hasJatekos = hasHeader(headers, h => h === 'játékos' || h === 'jatekos');
            const hasPerc = hasHeader(headers, h => h === 'perc');
            const hasMinute1 = hasHeader(headers, h => h === '1');
            const hasMinute40 = hasHeader(headers, h => h === '40');

            if (hasPg && hasSg && hasSf && hasPf && hasC && hasMin && hasOnPlusMinus) {
              hasFiveMan = true;
            }
            if (hasJatekos && hasMin && hasOn40) {
              hasPlayerSummary = true;
            }
            if (hasJatekos && hasPerc && hasMinute1 && hasMinute40) {
              hasMinuteGrid = true;
            }
          });

          let score = 0;
          if (hasFiveMan) score += 100;
          if (hasPlayerSummary) score += 40;
          if (hasMinuteGrid) score += 25;
          score += Math.min(20, tables.length);

          return { score };
        };

        const teamNeedle = normalizeTeamKey(effectiveTeamName);
        const candidateRows = (rawData as Array<{
          id?: string | null;
          kosarstat_game_id?: string | null;
          imported_at?: string | null;
          home_team_name?: string | null;
          away_team_name?: string | null;
        }>).filter(row => {
          const homeKey = normalizeTeamKey(String(row.home_team_name || ''));
          const awayKey = normalizeTeamKey(String(row.away_team_name || ''));
          return Boolean(teamNeedle) && (
            homeKey.includes(teamNeedle)
            || teamNeedle.includes(homeKey)
            || awayKey.includes(teamNeedle)
            || teamNeedle.includes(awayKey)
          );
        });

        const rowsByGameId = new Map<string, typeof candidateRows>();
        candidateRows.forEach(row => {
          const gameId = String(row.kosarstat_game_id || '');
          if (!gameId) return;
          if (!rowsByGameId.has(gameId)) rowsByGameId.set(gameId, []);
          rowsByGameId.get(gameId)!.push(row);
        });

        const rawIds = Array.from(new Set(candidateRows.map(row => String(row.id || '')).filter(Boolean)));
        if (rawIds.length === 0) {
          if (!cancelled) {
            setSeasonKosarstatLineupTeam(null);
            setSeasonKosarstatLineupGames(0);
          }
          return;
        }

        const { data: tableData, error: tableError } = await supabase
          .from('kosarstat_game_page_tables' as never)
          .select('page_raw_id, table_index, rows, headers, source_table_dom_id')
          .in('page_raw_id', rawIds)
          .order('table_index', { ascending: true });

        if (tableError || !Array.isArray(tableData)) {
          if (!cancelled) {
            setSeasonKosarstatLineupTeam(null);
            setSeasonKosarstatLineupGames(0);
          }
          return;
        }

        const tablesByRawId = new Map<string, KosarstatLineupTableRow[]>();
        (tableData as Array<KosarstatLineupTableRow & { page_raw_id?: string | null }>).forEach(row => {
          const rawId = String(row.page_raw_id || '');
          if (!rawId) return;
          if (!tablesByRawId.has(rawId)) tablesByRawId.set(rawId, []);
          tablesByRawId.get(rawId)!.push(row);
        });

        tablesByRawId.forEach((items, rawId) => {
          items.sort((a, b) => {
            const aIdx = Number.parseInt(String((a as { table_index?: unknown }).table_index ?? ''), 10);
            const bIdx = Number.parseInt(String((b as { table_index?: unknown }).table_index ?? ''), 10);
            if (Number.isFinite(aIdx) && Number.isFinite(bIdx)) return aIdx - bIdx;
            return 0;
          });
          tablesByRawId.set(rawId, items);
        });

        const parsedTeamsWithOverlap: Array<{
          team: KosarstatTeamLineupAnalysis;
          overlapCount: number;
          overlapRate: number;
        }> = [];

        rowsByGameId.forEach((rows, gameId) => {
          const ranked = rows
            .map(row => {
              const rawId = String(row.id || '');
              const tables = tablesByRawId.get(rawId) || [];
              return {
                row,
                rawId,
                tables,
                quality: computeLineupRawQuality(tables),
              };
            })
            .filter(item => item.rawId && item.tables.length > 0)
            .sort((a, b) => b.quality.score - a.quality.score || b.tables.length - a.tables.length);

          const best = ranked[0];
          if (!best) return;

          const awayKey = normalizeTeamKey(String(best.row.away_team_name || ''));
          const ownSide: 'home' | 'away' = awayKey.includes(teamNeedle) || teamNeedle.includes(awayKey) ? 'away' : 'home';
          const parsed = parseKosarstatLineupAnalysis(best.tables, gameId, effectiveTeamName, ownSide);
          const team = parsed?.selectedTeam || parsed?.homeTeam || parsed?.awayTeam;
          if (!team) return;

          const teamPlayerKeys = new Set<string>();
          team.playerMinutes.forEach(item => {
            const key = normalizeTeamKey(item.player);
            if (key) teamPlayerKeys.add(key);
          });
          team.stints.forEach(stint => {
            stint.players.forEach(player => {
              const key = normalizeTeamKey(player);
              if (key) teamPlayerKeys.add(key);
            });
          });

          const totalKeys = teamPlayerKeys.size;
          let overlapCount = 0;
          teamPlayerKeys.forEach(key => {
            if (matchesNormalizedNameProfile(key, activeSelectedTeamPlayerProfiles)) overlapCount += 1;
          });

          parsedTeamsWithOverlap.push({
            team,
            overlapCount,
            overlapRate: totalKeys > 0 ? overlapCount / totalKeys : 0,
          });
        });

        const rankedParsedTeams = [...parsedTeamsWithOverlap].sort((a, b) => {
          if (b.overlapCount !== a.overlapCount) return b.overlapCount - a.overlapCount;
          if (b.overlapRate !== a.overlapRate) return b.overlapRate - a.overlapRate;

          const aSeconds = a.team.stints.reduce((sum, stint) => sum + (stint.seconds || 0), 0);
          const bSeconds = b.team.stints.reduce((sum, stint) => sum + (stint.seconds || 0), 0);
          return bSeconds - aSeconds;
        });

        const bestOverlapCount = rankedParsedTeams.reduce((max, entry) => Math.max(max, entry.overlapCount), 0);
        const overlapCandidates = rankedParsedTeams.filter(entry => entry.overlapCount > 0);
        const filteredParsedTeams = (() => {
          if (activeSelectedTeamPlayerProfiles.length === 0) {
            return rankedParsedTeams.map(entry => entry.team);
          }

          if (overlapCandidates.length === 0 || bestOverlapCount <= 0) {
            return [] as KosarstatTeamLineupAnalysis[];
          }

          const minOverlapCount = Math.max(2, bestOverlapCount - 1);
          const minOverlapRate = bestOverlapCount >= 5 ? 0.6 : 0.35;
          const primaryMatches = overlapCandidates
            .filter(entry => entry.overlapCount >= minOverlapCount && entry.overlapRate >= minOverlapRate)
            .map(entry => entry.team);

          if (primaryMatches.length > 0) {
            return primaryMatches;
          }

          return overlapCandidates
            .slice(0, Math.min(6, overlapCandidates.length))
            .map(entry => entry.team);
        })();

        if (!cancelled) {
          setSeasonKosarstatLineupTeam(
            buildAggregatedKosarstatLineupTeamAnalysis(filteredParsedTeams, effectiveTeamName)
          );
          setSeasonKosarstatLineupGames(filteredParsedTeams.length);
        }
      } catch {
        if (!cancelled) {
          setSeasonKosarstatLineupTeam(null);
          setSeasonKosarstatLineupGames(0);
        }
      }
    };

    loadSeasonKosarstatLineups();

    return () => {
      cancelled = true;
    };
  }, [allPlayers, resolvedSeasonId, resolvedTeamId, selectedPlayerId, selectedTeamNameForPostgame]);

  useEffect(() => {
    const activeTeam =
      kosarstatLineupAnalysis?.selectedTeam ||
      kosarstatLineupAnalysis?.homeTeam ||
      kosarstatLineupAnalysis?.awayTeam ||
      null;

    setLineupAnyPlayerFilter(LINEUP_FILTER_ALL);
    setLineupPgFilter(LINEUP_FILTER_ALL);
    setLineupSgFilter(LINEUP_FILTER_ALL);
    setLineupSfFilter(LINEUP_FILTER_ALL);
    setLineupPfFilter(LINEUP_FILTER_ALL);
    setLineupCFilter(LINEUP_FILTER_ALL);

    if (!activeTeam) {
      setSelectedComboPlayerA('');
      setSelectedComboPlayerB('');
      setSelectedComboPlayerC('');
      return;
    }

    const defaults = activeTeam.starters.slice(0, 3);
    setSelectedComboPlayerA(defaults[0] || '');
    setSelectedComboPlayerB(defaults[1] || '');
    setSelectedComboPlayerC(defaults[2] || '');
  }, [kosarstatLineupAnalysis]);

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
          setSeasonPlayedFixtures([]);
        }
        return;
      }

      try {
        const [{ data: standingsData }, { data: fixturesData }, { data: playedFixturesData }] = await Promise.all([
          supabase
            .from('standings')
            .select('data')
            .eq('season_id', resolvedSeasonId)
            .order('matchday', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('league_fixtures')
            .select('id, home_team_id, away_team_id, game_date, status')
            .eq('season_id', resolvedSeasonId)
            .in('status', ['scheduled', 'postponed']),
          supabase
            .from('league_fixtures')
            .select('home_team_id, away_team_id, game_date, home_score, away_score, status')
            .eq('season_id', resolvedSeasonId)
            .eq('status', 'played')
            .order('game_date', { ascending: false }),
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
        setSeasonFixtures((fixturesData || []) as SeasonFixture[]);
        setSeasonPlayedFixtures((playedFixturesData || []) as Array<{
          home_team_id: string;
          away_team_id: string;
          game_date: string;
          home_score: number | null;
          away_score: number | null;
          status: string;
        }>);
        setUsedLegacyStandingsFallback(usedLegacyFallback);
      } catch {
        if (!cancelled) {
          setStandingsSnapshot([]);
          setSeasonFixtures([]);
          setSeasonPlayedFixtures([]);
          setUsedLegacyStandingsFallback(false);
        }
      }
    };

    loadProjectionInputs();
    const refreshHandle = window.setInterval(loadProjectionInputs, 120000);

    return () => {
      cancelled = true;
      window.clearInterval(refreshHandle);
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

  const opponentSeasonShotPoints = useMemo(() => toShotPoints(opponentSeasonShotRows), [opponentSeasonShotRows]);

  const opponentSeasonShotSummary = useMemo<ShotProfileSummary | null>(() => {
    if (opponentSeasonShotPoints.length === 0) return null;
    return buildShotProfileSummary(opponentSeasonShotPoints);
  }, [opponentSeasonShotPoints]);

  const teamAllowedSeasonShotPoints = useMemo(() => toShotPoints(teamAllowedSeasonShotRows), [teamAllowedSeasonShotRows]);

  const teamAllowedSeasonShotSummary = useMemo<ShotProfileSummary | null>(() => {
    if (teamAllowedSeasonShotPoints.length === 0) return null;
    return buildShotProfileSummary(teamAllowedSeasonShotPoints);
  }, [teamAllowedSeasonShotPoints]);

  const opponentAllowedSeasonShotPoints = useMemo(() => toShotPoints(opponentAllowedSeasonShotRows), [opponentAllowedSeasonShotRows]);

  const opponentAllowedSeasonShotSummary = useMemo<ShotProfileSummary | null>(() => {
    if (opponentAllowedSeasonShotPoints.length === 0) return null;
    return buildShotProfileSummary(opponentAllowedSeasonShotPoints);
  }, [opponentAllowedSeasonShotPoints]);

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

  const selectedPlayerRaw = useMemo<RawPlayerSeasonStat | null>(() => {
    if (!selectedPlayer || !resolvedSeasonId) return null;
    return selectedPlayerRows.length > 0
      ? toRawStatFromGameRows(selectedPlayer, selectedPlayerRows, league, resolvedSeasonId)
      : toRawStat(selectedPlayer, league, resolvedSeasonId);
  }, [league, resolvedSeasonId, selectedPlayer, selectedPlayerRows]);

  const selectedPlayerNormalized = useMemo(() => {
    if (!selectedPlayerRaw) return null;
    return normalizePlayerStats(selectedPlayerRaw);
  }, [selectedPlayerRaw]);

  const playerSeasonOverview = useMemo(() => {
    if (!selectedPlayerRaw || !selectedPlayerNormalized) return null;

    const games = selectedPlayerRaw.games || 0;
    const fga = selectedPlayerNormalized.fga;
    const fgm = selectedPlayerRaw.close.made + selectedPlayerRaw.mid.made + selectedPlayerRaw.three.made;
    const tsDen = 2 * (selectedPlayerNormalized.fga + 0.44 * selectedPlayerNormalized.fta);
    const tsPct = tsDen > 0 ? (selectedPlayerRaw.points / tsDen) * 100 : null;
    const fgPct = fga > 0 ? (fgm / fga) * 100 : null;
    const totalRebounds = selectedPlayerRaw.rebounds.total ?? (selectedPlayerRaw.rebounds.offensive + selectedPlayerRaw.rebounds.defensive);
    const foulsPer36 = selectedPlayerRaw.minutes > 0 ? (selectedPlayerRaw.fouls.committed / selectedPlayerRaw.minutes) * 36 : null;

    return {
      games,
      minutesPerGame: selectedPlayerNormalized.minutesPerGame,
      pointsPerGame: games > 0 ? selectedPlayerRaw.points / games : 0,
      reboundsPerGame: games > 0 ? totalRebounds / games : 0,
      assistsPerGame: games > 0 ? selectedPlayerRaw.assists / games : 0,
      blocksPerGame: games > 0 ? selectedPlayerRaw.blocks / games : 0,
      stealsPerGame: games > 0 ? selectedPlayerRaw.steals / games : 0,
      foulsPerGame: games > 0 ? selectedPlayerRaw.fouls.committed / games : 0,
      fgPct,
      twoPct: (() => {
        const twoAttempts = selectedPlayerRaw.close.attempted + selectedPlayerRaw.mid.attempted;
        const twoMade = selectedPlayerRaw.close.made + selectedPlayerRaw.mid.made;
        return twoAttempts > 0 ? (twoMade / twoAttempts) * 100 : null;
      })(),
      threePct: selectedPlayerRaw.three.attempted > 0 ? (selectedPlayerRaw.three.made / selectedPlayerRaw.three.attempted) * 100 : null,
      ftPct: selectedPlayerRaw.ft.attempted > 0 ? (selectedPlayerRaw.ft.made / selectedPlayerRaw.ft.attempted) * 100 : null,
      tsPct,
      valPer36: selectedPlayerNormalized.valPer36,
      usageProxyPer36: selectedPlayerNormalized.usageProxyPer36,
      astTo: selectedPlayerNormalized.astTo,
      foulsPer36,
      defRebPer36: selectedPlayerNormalized.defRebPer36,
      blkPer36: selectedPlayerNormalized.blkPer36,
      stlPer36: selectedPlayerNormalized.stlPer36,
    };
  }, [selectedPlayerNormalized, selectedPlayerRaw]);

  const analysis = useMemo<PlayerAnalysis | null>(() => {
    if (!benchmarks || !selectedPlayerRaw || !selectedPlayerNormalized) return null;
    const normalized = selectedPlayerNormalized;
    if (!isEligibleSample(normalized)) return null;
    return analyzePlayerSeason(selectedPlayerRaw, benchmarks);
  }, [benchmarks, selectedPlayerNormalized, selectedPlayerRaw]);

  const advancedBlocks = useMemo<AdvancedPlayerBlocks | null>(() => {
    if (!benchmarks || !selectedPlayerRaw || !selectedPlayerNormalized) return null;
    if (!isEligibleSample(selectedPlayerNormalized)) return null;
    return buildAdvancedPlayerBlocks(selectedPlayerRaw, benchmarks);
  }, [benchmarks, selectedPlayerNormalized, selectedPlayerRaw]);

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
    const baseStats = buildTeamSeasonStats(
      seasonPlayers,
      league,
      resolvedSeasonId,
      allTeams,
      rolesByPlayerId,
      activeSeasonPlayers
    );

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
  }, [activeSeasonPlayers, allTeams, league, playerGameStats, resolvedSeasonId, rolesByPlayerId, seasonPlayers]);

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

  const ownGameIds = useMemo(() => {
    return new Set(games.map(game => game.id));
  }, [games]);

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

  const teamPlayerRowsByGame = useMemo(() => {
    const map = new Map<string, GamePlayerStatRow[]>();
    playerGameStats.forEach(row => {
      if (resolvedSeasonId && String(row.games?.season_id ?? '') !== String(resolvedSeasonId)) return;
      if (!ownGameIds.has(row.game_id)) return;
      if (!map.has(row.game_id)) map.set(row.game_id, []);
      map.get(row.game_id)!.push(row);
    });
    return map;
  }, [ownGameIds, playerGameStats, resolvedSeasonId]);

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
        tsPct: metrics?.tsPct ?? null,
        turnoverRate: metrics?.turnoverRate ?? null,
        ppp: metrics?.ppp ?? null,
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
    const tsValues = windowGames
      .map(item => item.tsPct)
      .filter((value): value is number => Number.isFinite(value));
    const tovValues = windowGames
      .map(item => item.turnoverRate)
      .filter((value): value is number => Number.isFinite(value));
    const recentEfgAvg = efgValues.length > 0 ? roundValue(average(efgValues), 1) : null;
    const recentTsAvg = tsValues.length > 0 ? roundValue(average(tsValues), 1) : null;
    const recentTovAvg = tovValues.length > 0 ? roundValue(average(tovValues) * 100, 1) : null;
    const efgDelta = recentEfgAvg !== null ? roundValue(recentEfgAvg - normalizedTeamStats.efg, 1) : null;

    const efgStd = efgValues.length > 1 ? roundValue(stdDev(efgValues), 1) : 0;
    const tsStd = tsValues.length > 1 ? roundValue(stdDev(tsValues), 1) : 0;
    const tovStdPct = tovValues.length > 1 ? roundValue(stdDev(tovValues.map(item => item * 100)), 1) : 0;
    const marginStd = windowGames.length > 1 ? roundValue(stdDev(windowGames.map(item => item.margin)), 1) : 0;
    const volatilityIndex = roundValue(
      clamp01((efgStd / 8) * 0.35 + (tsStd / 8) * 0.25 + (tovStdPct / 5) * 0.2 + (marginStd / 12) * 0.2) * 100,
      1
    );

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
      ? 'bg-positive/15 text-positive border border-positive/30'
      : status === 'down'
        ? 'bg-negative/15 text-negative border border-negative/30'
        : 'bg-surface-2 text-primary border border-border-subtle';

    const descriptionParts = [
      `Pontkülönbség átlag: ${marginAvg >= 0 ? '+' : ''}${roundValue(marginAvg, 1)} (szezon: ${seasonMargin >= 0 ? '+' : ''}${roundValue(seasonMargin, 1)})`,
    ];
    if (recentEfgAvg !== null && efgDelta !== null) {
      descriptionParts.push(`eFG: ${recentEfgAvg.toFixed(1)}% (${efgDelta >= 0 ? '+' : ''}${efgDelta.toFixed(1)} pp)`);
    }
    if (recentTsAvg !== null) {
      descriptionParts.push(`TS: ${recentTsAvg.toFixed(1)}%`);
    }
    if (recentTovAvg !== null) {
      descriptionParts.push(`TO: ${recentTovAvg.toFixed(1)}%`);
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
      recentTsAvg,
      recentTovAvg,
      efgStd,
      tsStd,
      tovStdPct,
      marginStd,
      volatilityIndex,
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
          tsPct: item.tsPct !== null ? roundValue(item.tsPct, 1) : null,
          turnoverPct: item.turnoverRate !== null ? roundValue(item.turnoverRate * 100, 1) : null,
          ppp: item.ppp !== null ? roundValue(item.ppp, 3) : null,
          opponent: item.opponent,
          result: item.result,
        };
      });
  }, [teamFormSeries]);

  const teamFormVolatilityData = useMemo(() => {
    const base = teamFormSeries
      .slice(0, TEAM_FORM_CHART_POINTS)
      .reverse()
      .map(item => {
        const timestamp = item.date ? new Date(item.date).getTime() : 0;
        const label = timestamp
          ? new Date(timestamp).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })
          : 'Ismeretlen';
        return {
          label,
          efg: typeof item.efg === 'number' ? item.efg : null,
          tsPct: typeof item.tsPct === 'number' ? item.tsPct : null,
          turnoverPct: typeof item.turnoverRate === 'number' ? item.turnoverRate * 100 : null,
          ppp: typeof item.ppp === 'number' ? item.ppp : null,
          margin: item.margin,
        };
      });

    if (base.length === 0) return [] as Array<{
      label: string;
      rollEfg: number | null;
      rollTs: number | null;
      rollTo: number | null;
      rollPpp: number | null;
      stdEfg: number | null;
      stdTs: number | null;
      stdPpp: number | null;
      phase: 'Felfelé' | 'Stabil' | 'Hektikus' | 'Lejtmenet';
      phaseScore: number;
    }>;

    const seasonPpp = normalizedTeamStats && normalizedTeamStats.pace > 0
      ? (normalizedTeamStats.pointsFor / Math.max(1, normalizedTeamStats.games)) / normalizedTeamStats.pace
      : null;

    return base.map((item, index) => {
      const start = Math.max(0, index - TEAM_FORM_ROLLING_WINDOW + 1);
      const window = base.slice(start, index + 1);

      const efgValues = window.map(entry => entry.efg).filter((value): value is number => Number.isFinite(value));
      const tsValues = window.map(entry => entry.tsPct).filter((value): value is number => Number.isFinite(value));
      const toValues = window.map(entry => entry.turnoverPct).filter((value): value is number => Number.isFinite(value));
      const pppValues = window.map(entry => entry.ppp).filter((value): value is number => Number.isFinite(value));

      const rollEfg = efgValues.length > 0 ? roundValue(average(efgValues), 1) : null;
      const rollTs = tsValues.length > 0 ? roundValue(average(tsValues), 1) : null;
      const rollTo = toValues.length > 0 ? roundValue(average(toValues), 1) : null;
      const rollPpp = pppValues.length > 0 ? roundValue(average(pppValues), 3) : null;

      const stdEfg = efgValues.length > 1 ? roundValue(stdDev(efgValues), 1) : null;
      const stdTs = tsValues.length > 1 ? roundValue(stdDev(tsValues), 1) : null;
      const stdPpp = pppValues.length > 1 ? roundValue(stdDev(pppValues), 3) : null;

      let phase: 'Felfelé' | 'Stabil' | 'Hektikus' | 'Lejtmenet' = 'Stabil';
      if (
        (stdEfg !== null && stdEfg >= 5.5)
        || (stdTs !== null && stdTs >= 4.8)
        || (stdPpp !== null && stdPpp >= 0.085)
      ) {
        phase = 'Hektikus';
      }

      if (
        rollEfg !== null
        && normalizedTeamStats
        && rollEfg <= normalizedTeamStats.efg - 2.5
      ) {
        phase = 'Lejtmenet';
      }

      if (
        phase !== 'Lejtmenet'
        && rollEfg !== null
        && normalizedTeamStats
        && rollEfg >= normalizedTeamStats.efg + 2
        && (seasonPpp === null || (rollPpp !== null && rollPpp >= seasonPpp + 0.035))
      ) {
        phase = 'Felfelé';
      }

      const phaseScore = roundValue(
        clamp01(
          (rollEfg !== null && normalizedTeamStats ? (rollEfg - normalizedTeamStats.efg + 10) / 20 : 0.5) * 0.55
          + (rollPpp !== null && seasonPpp !== null ? (rollPpp - seasonPpp + 0.18) / 0.36 : 0.5) * 0.45
        ) * 100,
        1
      );

      return {
        label: item.label,
        rollEfg,
        rollTs,
        rollTo,
        rollPpp,
        stdEfg,
        stdTs,
        stdPpp,
        phase,
        phaseScore,
      };
    });
  }, [normalizedTeamStats, teamFormSeries]);

  const teamFormPhaseSummary = useMemo(() => {
    if (teamFormVolatilityData.length === 0) return null;

    const counts = teamFormVolatilityData.reduce(
      (acc, item) => {
        acc[item.phase] += 1;
        return acc;
      },
      { Felfelé: 0, Stabil: 0, Hektikus: 0, Lejtmenet: 0 } as Record<'Felfelé' | 'Stabil' | 'Hektikus' | 'Lejtmenet', number>
    );

    const latest = teamFormVolatilityData[teamFormVolatilityData.length - 1] ?? null;
    if (!latest) return null;

    const latestBadgeClass = latest.phase === 'Felfelé'
      ? 'bg-positive/15 text-positive border border-positive/30'
      : latest.phase === 'Lejtmenet'
        ? 'bg-negative/15 text-negative border border-negative/30'
        : latest.phase === 'Hektikus'
          ? 'bg-warning/15 text-warning border border-warning/30'
          : 'bg-surface-2 text-primary border border-border-subtle';

    return {
      counts,
      latest,
      latestBadgeClass,
    };
  }, [teamFormVolatilityData]);

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
            generatedAt: row.generated_at ?? undefined,
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

  const projectionScenarioSettings = useMemo(() => {
    if (projectionScenario === 'form') {
      return {
        label: 'Forma-követő',
        recentWeightMultiplier: 1.2,
        homeAdvantage: 0.22,
        logisticDivisor: 0.9,
      };
    }

    if (projectionScenario === 'upset') {
      return {
        label: 'Upset-figyelő',
        recentWeightMultiplier: 1.35,
        homeAdvantage: 0.18,
        logisticDivisor: 1.02,
      };
    }

    return {
      label: 'Alap',
      recentWeightMultiplier: 1,
      homeAdvantage: 0.22,
      logisticDivisor: 0.85,
    };
  }, [projectionScenario]);

  const projectionHomeAdvantage = useMemo(
    () => projectionScenarioSettings.homeAdvantage + whatIfHomeAdvantageDelta,
    [projectionScenarioSettings.homeAdvantage, whatIfHomeAdvantageDelta]
  );

  const projectionLogisticDivisor = useMemo(
    () => Math.max(0.55, projectionScenarioSettings.logisticDivisor + whatIfLogisticDelta),
    [projectionScenarioSettings.logisticDivisor, whatIfLogisticDelta]
  );

  const recentFormByTeamKey = useMemo(() => {
    const teamNameById = new Map(allTeams.map(team => [team.id, team.name]));
    const result = new Map<string, { team: string; games: number; wins: number; losses: number; winRate: number; netPerGame: number }>();

    const fixturesByTeamId = new Map<string, typeof seasonPlayedFixtures>();
    seasonPlayedFixtures.forEach(fixture => {
      if (!fixturesByTeamId.has(fixture.home_team_id)) fixturesByTeamId.set(fixture.home_team_id, []);
      if (!fixturesByTeamId.has(fixture.away_team_id)) fixturesByTeamId.set(fixture.away_team_id, []);
      fixturesByTeamId.get(fixture.home_team_id)!.push(fixture);
      fixturesByTeamId.get(fixture.away_team_id)!.push(fixture);
    });

    fixturesByTeamId.forEach((fixtures, teamId) => {
      const relevant = [...fixtures]
        .sort((a, b) => new Date(b.game_date).getTime() - new Date(a.game_date).getTime())
        .slice(0, 5);
      let games = 0;
      let wins = 0;
      let losses = 0;
      let totalNet = 0;

      relevant.forEach(fixture => {
        if (fixture.home_score == null || fixture.away_score == null) return;
        const isHome = fixture.home_team_id === teamId;
        const ownPoints = isHome ? fixture.home_score : fixture.away_score;
        const oppPoints = isHome ? fixture.away_score : fixture.home_score;
        games += 1;
        totalNet += ownPoints - oppPoints;
        if (ownPoints > oppPoints) wins += 1;
        else losses += 1;
      });

      if (games === 0) return;
      const teamName = teamNameById.get(teamId) ?? 'Ismeretlen csapat';
      result.set(normalizeTeamKey(teamName), {
        team: teamName,
        games,
        wins,
        losses,
        winRate: wins / games,
        netPerGame: totalNet / games,
      });
    });

    return result;
  }, [allTeams, seasonPlayedFixtures]);

  const opponentQualityByTeamKey = useMemo(() => {
    const rows = standingsSnapshot
      .map(row => {
        const matches = Math.max(1, row.matches || 0);
        const key = normalizeTeamKey(row.team);
        const winRate = (row.wins || 0) / Math.max(1, (row.wins || 0) + (row.losses || 0));
        const netPerGame = ((row.scored || 0) - (row.conceded || 0)) / matches;
        const recent = recentFormByTeamKey.get(key);
        const recentAdj = recent
          ? ((recent.winRate - 0.5) * 0.8) + Math.max(-1, Math.min(1, recent.netPerGame / 12)) * 0.2
          : 0;

        return {
          key,
          winRate,
          netPerGame,
          recentAdj,
        };
      })
      .filter(item => item.key.length > 0);

    const zScore = (value: number, values: number[]) => {
      if (values.length === 0) return 0;
      const mean = average(values);
      const sd = stdDev(values);
      if (!Number.isFinite(sd) || sd === 0) return 0;
      return (value - mean) / sd;
    };

    const winValues = rows.map(item => item.winRate);
    const netValues = rows.map(item => item.netPerGame);
    const recentValues = rows.map(item => item.recentAdj);

    return new Map(
      rows.map(item => {
        const score =
          0.55 * zScore(item.winRate, winValues)
          + 0.3 * zScore(item.netPerGame, netValues)
          + 0.15 * zScore(item.recentAdj, recentValues);
        return [item.key, score] as const;
      })
    );
  }, [recentFormByTeamKey, standingsSnapshot]);

  const scheduleStrengthByTeamKey = useMemo(() => {
    const teamKeyById = new Map(allTeams.map(team => [team.id, normalizeTeamKey(team.name)]));
    const gamesByTeamKey = new Map<string, Array<{ opponentKey: string; dateValue: number }>>();

    seasonPlayedFixtures.forEach(fixture => {
      const homeKey = teamKeyById.get(fixture.home_team_id);
      const awayKey = teamKeyById.get(fixture.away_team_id);
      if (!homeKey || !awayKey || homeKey === awayKey) return;

      const dateValue = fixture.game_date ? new Date(fixture.game_date).getTime() : 0;
      if (!gamesByTeamKey.has(homeKey)) gamesByTeamKey.set(homeKey, []);
      if (!gamesByTeamKey.has(awayKey)) gamesByTeamKey.set(awayKey, []);
      gamesByTeamKey.get(homeKey)!.push({ opponentKey: awayKey, dateValue });
      gamesByTeamKey.get(awayKey)!.push({ opponentKey: homeKey, dateValue });
    });

    const seasonRaw = new Map<string, number>();
    const recentRaw = new Map<string, number>();

    gamesByTeamKey.forEach((games, teamKey) => {
      const validSeasonValues = games
        .map(game => opponentQualityByTeamKey.get(game.opponentKey))
        .filter((value): value is number => Number.isFinite(value));
      if (validSeasonValues.length === 0) return;

      const seasonAvg = average(validSeasonValues);
      seasonRaw.set(teamKey, seasonAvg);

      const validRecentValues = [...games]
        .sort((a, b) => b.dateValue - a.dateValue)
        .slice(0, 5)
        .map(game => opponentQualityByTeamKey.get(game.opponentKey))
        .filter((value): value is number => Number.isFinite(value));

      if (validRecentValues.length > 0) {
        recentRaw.set(teamKey, average(validRecentValues));
      }
    });

    const zMap = (source: Map<string, number>) => {
      const values = Array.from(source.values());
      const mean = average(values);
      const sd = stdDev(values);
      const map = new Map<string, number>();
      source.forEach((value, key) => {
        if (!Number.isFinite(sd) || sd === 0) {
          map.set(key, 0);
          return;
        }
        map.set(key, (value - mean) / sd);
      });
      return map;
    };

    const seasonZ = zMap(seasonRaw);
    const recentZ = zMap(recentRaw);
    const keys = new Set<string>([...seasonZ.keys(), ...recentZ.keys()]);
    const result = new Map<string, { season: number; recent: number; combined: number }>();

    keys.forEach(key => {
      const season = seasonZ.get(key) ?? 0;
      const recent = recentZ.get(key) ?? 0;
      result.set(key, {
        season,
        recent,
        combined: season * 0.55 + recent * 0.45,
      });
    });

    return result;
  }, [allTeams, seasonPlayedFixtures, opponentQualityByTeamKey]);

  const headToHeadByPair = useMemo(() => {
    type HeadToHead = {
      teamAKey: string;
      teamBKey: string;
      teamAName: string;
      teamBName: string;
      games: number;
      teamAWins: number;
      teamBWins: number;
      teamAPoints: number;
      teamBPoints: number;
    };

    const teamNameById = new Map(allTeams.map(team => [team.id, team.name]));
    const map = new Map<string, HeadToHead>();

    seasonPlayedFixtures.forEach(fixture => {
      if (fixture.home_score == null || fixture.away_score == null) return;
      const homeName = teamNameById.get(fixture.home_team_id);
      const awayName = teamNameById.get(fixture.away_team_id);
      if (!homeName || !awayName) return;

      const homeKey = normalizeTeamKey(homeName);
      const awayKey = normalizeTeamKey(awayName);
      if (homeKey === awayKey) return;

      const [teamAKey, teamBKey] = [homeKey, awayKey].sort((a, b) => a.localeCompare(b));
      const teamAIsHome = teamAKey === homeKey;
      const teamAName = teamAIsHome ? homeName : awayName;
      const teamBName = teamAIsHome ? awayName : homeName;
      const teamAScore = teamAIsHome ? fixture.home_score : fixture.away_score;
      const teamBScore = teamAIsHome ? fixture.away_score : fixture.home_score;
      const pairKey = `${teamAKey}__${teamBKey}`;

      const base = map.get(pairKey) ?? {
        teamAKey,
        teamBKey,
        teamAName,
        teamBName,
        games: 0,
        teamAWins: 0,
        teamBWins: 0,
        teamAPoints: 0,
        teamBPoints: 0,
      };

      base.games += 1;
      base.teamAPoints += teamAScore;
      base.teamBPoints += teamBScore;
      if (teamAScore > teamBScore) base.teamAWins += 1;
      else if (teamBScore > teamAScore) base.teamBWins += 1;

      map.set(pairKey, base);
    });

    return map;
  }, [allTeams, seasonPlayedFixtures]);

  const projectionStrengthByTeamKey = useMemo(() => {
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
        const baseRecentWeight = computeRecentBlendWeight(recentSnapshot.games || 0, seasonBase.games || 0);
        const adjustedRecentWeight = Math.min(
          0.9,
          Math.max(0, baseRecentWeight * projectionScenarioSettings.recentWeightMultiplier)
        );
        if (adjustedRecentWeight <= 0) return seasonBase;
        return blendPregameTeamStats(seasonBase, recentSnapshot, adjustedRecentWeight);
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

    const statsStrength = new Map(
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

    const standingsBase = standingsSnapshot
      .map(row => {
        const matches = Math.max(1, row.matches || 0);
        return {
          key: normalizeTeamKey(row.team),
          netPerGame: ((row.scored || 0) - (row.conceded || 0)) / matches,
          winRate: (row.wins || 0) / Math.max(1, (row.wins || 0) + (row.losses || 0)),
        };
      })
      .filter(item => item.key.length > 0);

    const standingNetValues = standingsBase.map(item => item.netPerGame);
    const standingWinValues = standingsBase.map(item => item.winRate);
    const standingsStrength = new Map(
      standingsBase.map(item => {
        const score = 0.6 * z(item.netPerGame, standingNetValues) + 0.4 * z(item.winRate, standingWinValues);
        return [item.key, score] as const;
      })
    );

    const merged = new Map<string, number>();
    const keys = new Set<string>([...standingsStrength.keys(), ...statsStrength.keys()]);
    keys.forEach(key => {
      const standing = standingsStrength.get(key);
      const stats = statsStrength.get(key);
      const blendedCore = standing !== undefined && stats !== undefined
        ? stats * 0.65 + standing * 0.35
        : stats ?? standing ?? 0;
      const form = recentFormByTeamKey.get(key);
      const formAdjustment = form
        ? ((form.winRate - 0.5) * 0.9) + Math.max(-1, Math.min(1, form.netPerGame / 10)) * 0.35
        : 0;
      const scheduleStrength = scheduleStrengthByTeamKey.get(key)?.combined ?? 0;
      const blended = blendedCore + formAdjustment * 0.35 + scheduleStrength * 0.22;
      const manualAdjustment = whatIfTeamAdjustments[key] ?? 0;
      merged.set(key, blended + manualAdjustment);
    });

    return merged;
  }, [
    MIN_RECENT_GAMES_TEAM,
    gameTeamPoints,
    playerGameStats,
    playerTeamMap,
    projectionScenarioSettings.recentWeightMultiplier,
    recentGameIdsByTeam,
    recentFormByTeamKey,
    scheduleStrengthByTeamKey,
    standingsSnapshot,
    teamSeasonStats,
    whatIfTeamAdjustments,
  ]);

  const projectionUpcomingGames = useMemo(() => {
    if (standingsSnapshot.length === 0) return [] as ProjectionUpcomingGame[];

    const teamNameById = new Map(allTeams.map(team => [team.id, team.name]));
    const currentStandingByKey = new Map(
      standingsSnapshot.map(row => [
        normalizeTeamKey(row.team),
        {
          wins: row.wins,
          losses: row.losses,
        },
      ])
    );

    const today = new Date().toISOString().split('T')[0];

    return seasonFixtures
      .filter(fixture => fixture.game_date >= today)
      .reduce<ProjectionUpcomingGame[]>((games, fixture) => {
        const homeName = teamNameById.get(fixture.home_team_id);
        const awayName = teamNameById.get(fixture.away_team_id);
        if (!homeName || !awayName) return games;

        const homeKey = normalizeTeamKey(homeName);
        const awayKey = normalizeTeamKey(awayName);
        const homeStandingBase = currentStandingByKey.get(homeKey);
        const awayStandingBase = currentStandingByKey.get(awayKey);
        if (!homeStandingBase || !awayStandingBase) return games;

        const homeStrengthBase = projectionStrengthByTeamKey.get(homeKey) ?? 0;
        const awayStrengthBase = projectionStrengthByTeamKey.get(awayKey) ?? 0;
        const homeStanding = (homeStandingBase.wins + homeStandingBase.losses) > 0
          ? homeStandingBase.wins / (homeStandingBase.wins + homeStandingBase.losses)
          : 0.5;
        const awayStanding = (awayStandingBase.wins + awayStandingBase.losses) > 0
          ? awayStandingBase.wins / (awayStandingBase.wins + awayStandingBase.losses)
          : 0.5;

        const homeStrength = homeStrengthBase + (homeStanding - 0.5) * 0.8;
        const awayStrength = awayStrengthBase + (awayStanding - 0.5) * 0.8;
        const homeRecent = recentFormByTeamKey.get(homeKey);
        const awayRecent = recentFormByTeamKey.get(awayKey);
        const homeRecentAdj = homeRecent
          ? ((homeRecent.winRate - 0.5) * 0.75) + Math.max(-1, Math.min(1, homeRecent.netPerGame / 12)) * 0.25
          : 0;
        const awayRecentAdj = awayRecent
          ? ((awayRecent.winRate - 0.5) * 0.75) + Math.max(-1, Math.min(1, awayRecent.netPerGame / 12)) * 0.25
          : 0;

        const [teamAKey, teamBKey] = [homeKey, awayKey].sort((a, b) => a.localeCompare(b));
        const h2h = headToHeadByPair.get(`${teamAKey}__${teamBKey}`);
        const homeH2hAdj = (() => {
          if (!h2h || h2h.games < 1) return 0;
          const homeIsTeamA = h2h.teamAKey === homeKey;
          const homeWins = homeIsTeamA ? h2h.teamAWins : h2h.teamBWins;
          const awayWins = homeIsTeamA ? h2h.teamBWins : h2h.teamAWins;
          const homePts = homeIsTeamA ? h2h.teamAPoints : h2h.teamBPoints;
          const awayPts = homeIsTeamA ? h2h.teamBPoints : h2h.teamAPoints;
          const winEdge = (homeWins - awayWins) / Math.max(1, h2h.games);
          const netEdge = (homePts - awayPts) / Math.max(1, h2h.games);
          return winEdge * 0.24 + Math.max(-1, Math.min(1, netEdge / 12)) * 0.1;
        })();

        const expectedStrengthDelta = (homeStrength + homeRecentAdj + homeH2hAdj - awayStrength - awayRecentAdj) + projectionHomeAdvantage;
        const homeWinProbabilityModel = 1 / (1 + Math.exp(-expectedStrengthDelta / projectionLogisticDivisor));
        const awayWinProbabilityModel = 1 - homeWinProbabilityModel;
        const overrideWinnerSide = fixtureWinnerOverrides[fixture.id] ?? null;
        const homeWinProbabilityApplied = overrideWinnerSide === 'home' ? 1 : overrideWinnerSide === 'away' ? 0 : homeWinProbabilityModel;
        const awayWinProbabilityApplied = 1 - homeWinProbabilityApplied;
        const certaintyApplied = overrideWinnerSide ? 1 : Math.abs(homeWinProbabilityModel - 0.5) * 2;

        games.push({
          fixtureId: fixture.id,
          gameDate: fixture.game_date,
          homeTeam: homeName,
          awayTeam: awayName,
          homeTeamKey: homeKey,
          awayTeamKey: awayKey,
          homeWinProbabilityModel,
          awayWinProbabilityModel,
          homeWinProbabilityApplied,
          awayWinProbabilityApplied,
          certaintyApplied,
          overrideWinnerSide,
        });

        return games;
      }, [])
      .sort((a, b) => new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime());
  }, [
    allTeams,
    fixtureWinnerOverrides,
    headToHeadByPair,
    projectionHomeAdvantage,
    projectionLogisticDivisor,
    projectionStrengthByTeamKey,
    recentFormByTeamKey,
    seasonFixtures,
    standingsSnapshot,
  ]);

  const projectedStandings = useMemo(() => {
    if (standingsSnapshot.length === 0) return [] as ProjectionRow[];

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

    projectionUpcomingGames.forEach(game => {
      const homeProjection = projectionMap.get(game.homeTeamKey);
      const awayProjection = projectionMap.get(game.awayTeamKey);
      if (!homeProjection || !awayProjection) return;

      homeProjection.projectedWins += game.homeWinProbabilityApplied;
      homeProjection.projectedLosses += game.awayWinProbabilityApplied;
      homeProjection.expectedExtraWins += game.homeWinProbabilityApplied;
      homeProjection.expectedFinalPoints += game.homeWinProbabilityApplied * 2;
      homeProjection.winProbabilitySum += game.homeWinProbabilityApplied;
      homeProjection.remainingGames += 1;
      homeProjection.certaintyAccumulator += game.certaintyApplied;

      awayProjection.projectedWins += game.awayWinProbabilityApplied;
      awayProjection.projectedLosses += game.homeWinProbabilityApplied;
      awayProjection.expectedExtraWins += game.awayWinProbabilityApplied;
      awayProjection.expectedFinalPoints += game.awayWinProbabilityApplied * 2;
      awayProjection.winProbabilitySum += game.awayWinProbabilityApplied;
      awayProjection.remainingGames += 1;
      awayProjection.certaintyAccumulator += game.certaintyApplied;
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
  }, [projectionUpcomingGames, standingsSnapshot]);

  const playoffProjection = useMemo<PlayoffProjectionResult | null>(() => {
    if (projectedStandings.length < 8) return null;

    const topEight = projectedStandings.slice(0, 8).map((row, index) => ({
      ...row,
      seed: index + 1,
      key: normalizeTeamKey(row.team),
      standing: row.projectedWins / Math.max(1, row.projectedWins + row.projectedLosses),
    }));

    const bySeed = new Map(topEight.map(row => [row.seed, row]));
    const teamStrength = (seed: number) => {
      const row = bySeed.get(seed);
      if (!row) return 0;
      const base = projectionStrengthByTeamKey.get(row.key) ?? 0;
      const recent = recentFormByTeamKey.get(row.key);
      const recentAdj = recent
        ? ((recent.winRate - 0.5) * 0.85) + Math.max(-1, Math.min(1, recent.netPerGame / 10)) * 0.3
        : 0;
      return base + (row.standing - 0.5) * 0.8 + recentAdj * 0.4;
    };

    const singleGameHomeWinProbability = (homeSeed: number, awaySeed: number, homeAdvantageSign: 1 | -1) => {
      const home = bySeed.get(homeSeed);
      const away = bySeed.get(awaySeed);
      if (!home || !away) return 0.5;
      const [teamAKey, teamBKey] = [home.key, away.key].sort((a, b) => a.localeCompare(b));
      const h2h = headToHeadByPair.get(`${teamAKey}__${teamBKey}`);
      const h2hAdj = (() => {
        if (!h2h || h2h.games < 1) return 0;
        const homeIsTeamA = h2h.teamAKey === home.key;
        const homeWins = homeIsTeamA ? h2h.teamAWins : h2h.teamBWins;
        const awayWins = homeIsTeamA ? h2h.teamBWins : h2h.teamAWins;
        const homePts = homeIsTeamA ? h2h.teamAPoints : h2h.teamBPoints;
        const awayPts = homeIsTeamA ? h2h.teamBPoints : h2h.teamAPoints;
        const winEdge = (homeWins - awayWins) / Math.max(1, h2h.games);
        const netEdge = (homePts - awayPts) / Math.max(1, h2h.games);
        return winEdge * 0.28 + Math.max(-1, Math.min(1, netEdge / 12)) * 0.12;
      })();

      const delta = teamStrength(homeSeed) - teamStrength(awaySeed) + h2hAdj + projectionHomeAdvantage * homeAdvantageSign;
      return clamp01(1 / (1 + Math.exp(-delta / projectionLogisticDivisor)));
    };

    const simulateSeries = (
      round: PlayoffSeriesProjection['round'],
      homeSeed: number,
      awaySeed: number
    ): PlayoffSeriesProjection => {
      const home = bySeed.get(homeSeed);
      const away = bySeed.get(awaySeed);
      if (!home || !away) {
        throw new Error('Playoff széria számításhoz hiányzó seed.');
      }

      const homeCourtPattern: Array<1 | -1> = [1, -1, 1, -1, 1];
      const gameProbabilities = homeCourtPattern.map(sign => singleGameHomeWinProbability(homeSeed, awaySeed, sign));
      const seriesOutcome = bestOfSeriesOutcome(gameProbabilities, 3);
      const seriesKey = `${round}-${homeSeed}-${awaySeed}`;
      const manualWinnerSide = playoffSeriesWinnerOverrides[seriesKey] ?? null;
      const homeSeriesWinProbability = manualWinnerSide === 'home' ? 1 : manualWinnerSide === 'away' ? 0 : seriesOutcome.homeSeriesWinProbability;
      const awaySeriesWinProbability = 1 - homeSeriesWinProbability;
      const homeWinsSeries = homeSeriesWinProbability >= awaySeriesWinProbability;
      const mostLikelyScore = homeWinsSeries
        ? (seriesOutcome.mostLikelyHomeWinScore ?? '3-2')
        : (seriesOutcome.mostLikelyAwayWinScore ?? '2-3');

      return {
        seriesKey,
        round,
        homeSeed,
        awaySeed,
        homeTeam: home.team,
        awayTeam: away.team,
        homeWinProbability: homeSeriesWinProbability,
        awayWinProbability: awaySeriesWinProbability,
        winner: homeWinsSeries ? home.team : away.team,
        loser: homeWinsSeries ? away.team : home.team,
        mostLikelyScore,
        certaintyLabel: probabilityLabel(Math.max(homeSeriesWinProbability, awaySeriesWinProbability)),
        manualOverride: manualWinnerSide !== null,
      };
    };

    const qf1 = simulateSeries('Negyeddöntő', 1, 8);
    const qf2 = simulateSeries('Negyeddöntő', 2, 7);
    const qf3 = simulateSeries('Negyeddöntő', 3, 6);
    const qf4 = simulateSeries('Negyeddöntő', 4, 5);

    const seedOf = (team: string) => topEight.find(item => item.team === team)?.seed ?? 99;
    const sfASeeds = [seedOf(qf1.winner), seedOf(qf4.winner)].sort((a, b) => a - b);
    const sfBSeeds = [seedOf(qf2.winner), seedOf(qf3.winner)].sort((a, b) => a - b);

    const sf1 = simulateSeries('Elődöntő', sfASeeds[0], sfASeeds[1]);
    const sf2 = simulateSeries('Elődöntő', sfBSeeds[0], sfBSeeds[1]);

    const finalSeeds = [seedOf(sf1.winner), seedOf(sf2.winner)].sort((a, b) => a - b);
    const bronzeSeeds = [seedOf(sf1.loser), seedOf(sf2.loser)].sort((a, b) => a - b);

    const finalSeries = simulateSeries('Döntő', finalSeeds[0], finalSeeds[1]);
    const bronzeSeries = simulateSeries('Bronz', bronzeSeeds[0], bronzeSeeds[1]);

    const placeSemiASeeds = [seedOf(qf1.loser), seedOf(qf4.loser)].sort((a, b) => a - b);
    const placeSemiBSeeds = [seedOf(qf2.loser), seedOf(qf3.loser)].sort((a, b) => a - b);

    const placeSemiA = simulateSeries('5-8 helyosztó elődöntő', placeSemiASeeds[0], placeSemiASeeds[1]);
    const placeSemiB = simulateSeries('5-8 helyosztó elődöntő', placeSemiBSeeds[0], placeSemiBSeeds[1]);

    const place5Seeds = [seedOf(placeSemiA.winner), seedOf(placeSemiB.winner)].sort((a, b) => a - b);
    const place7Seeds = [seedOf(placeSemiA.loser), seedOf(placeSemiB.loser)].sort((a, b) => a - b);

    const place5Series = simulateSeries('5. helyért', place5Seeds[0], place5Seeds[1]);
    const place7Series = simulateSeries('7. helyért', place7Seeds[0], place7Seeds[1]);

    const finalRanking: Array<{ position: number; team: string; note?: string }> = [
      { position: 1, team: finalSeries.winner, note: 'Bajnok' },
      { position: 2, team: finalSeries.loser, note: 'Döntős' },
      { position: 3, team: bronzeSeries.winner, note: 'Bronzérmes' },
      { position: 4, team: bronzeSeries.loser, note: '4. hely' },
      { position: 5, team: place5Series.winner, note: '5. helyért győztes' },
      { position: 6, team: place5Series.loser, note: '5. helyért vesztes' },
      { position: 7, team: place7Series.winner, note: '7. helyért győztes' },
      { position: 8, team: place7Series.loser, note: '7. helyért vesztes' },
      ...projectedStandings.slice(8).map((row, index) => ({
        position: index + 9,
        team: row.team,
        note: 'Alapszakasz alapján',
      })),
    ];

    return {
      champion: finalSeries.winner,
      runnerUp: finalSeries.loser,
      third: bronzeSeries.winner,
      fourth: bronzeSeries.loser,
      finalRanking,
      series: [qf1, qf2, qf3, qf4, sf1, sf2, finalSeries, bronzeSeries, placeSemiA, placeSemiB, place5Series, place7Series],
    };
  }, [
    projectedStandings,
    projectionHomeAdvantage,
    projectionLogisticDivisor,
    projectionStrengthByTeamKey,
    recentFormByTeamKey,
    headToHeadByPair,
    playoffSeriesWinnerOverrides,
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

  const projectionFinalPlaceForSelectedTeam = useMemo(() => {
    if (!playoffProjection || !resolvedTeamId || resolvedTeamId === 'all') return null;
    const selectedTeamName = allTeams.find(team => team.id === resolvedTeamId)?.name;
    if (!selectedTeamName) return null;
    const selectedKey = normalizeTeamKey(selectedTeamName);
    const hit = playoffProjection.finalRanking.find(row => normalizeTeamKey(row.team) === selectedKey);
    return hit?.position ?? null;
  }, [allTeams, playoffProjection, resolvedTeamId]);

  const projectionWhyForSelectedTeam = useMemo(() => {
    if (!projectionContext || !resolvedTeamId || resolvedTeamId === 'all') return null;
    const selectedTeamName = allTeams.find(team => team.id === resolvedTeamId)?.name;
    if (!selectedTeamName) return null;
    const selectedKey = normalizeTeamKey(selectedTeamName);
    const selectedForm = recentFormByTeamKey.get(selectedKey);
    const selectedStrength = projectionStrengthByTeamKey.get(selectedKey) ?? 0;
    const selectedScheduleStrength = scheduleStrengthByTeamKey.get(selectedKey) ?? null;

    const qfSeries = playoffProjection?.series.find(
      item => item.round === 'Negyeddöntő' && (normalizeTeamKey(item.homeTeam) === selectedKey || normalizeTeamKey(item.awayTeam) === selectedKey)
    );

    const h2hLine = (() => {
      if (!qfSeries) return null;
      const opponentName = normalizeTeamKey(qfSeries.homeTeam) === selectedKey ? qfSeries.awayTeam : qfSeries.homeTeam;
      const opponentKey = normalizeTeamKey(opponentName);
      const [teamAKey, teamBKey] = [selectedKey, opponentKey].sort((a, b) => a.localeCompare(b));
      const h2h = headToHeadByPair.get(`${teamAKey}__${teamBKey}`);
      if (!h2h || h2h.games === 0) return `Nincs idei H2H minta ${opponentName} ellen.`;

      const selectedIsA = h2h.teamAKey === selectedKey;
      const selectedWins = selectedIsA ? h2h.teamAWins : h2h.teamBWins;
      const oppWins = selectedIsA ? h2h.teamBWins : h2h.teamAWins;
      const selectedPts = selectedIsA ? h2h.teamAPoints : h2h.teamBPoints;
      const oppPts = selectedIsA ? h2h.teamBPoints : h2h.teamAPoints;
      const net = (selectedPts - oppPts) / Math.max(1, h2h.games);
      return `H2H vs ${opponentName}: ${selectedWins}-${oppWins}, nettó ${net >= 0 ? '+' : ''}${net.toFixed(1)} pont/meccs (${h2h.games} meccs).`;
    })();

    return {
      selectedTeamName,
      selectedStrength,
      selectedScheduleStrength,
      selectedForm,
      qfSeries,
      h2hLine,
    };
  }, [allTeams, projectionContext, projectionStrengthByTeamKey, scheduleStrengthByTeamKey, recentFormByTeamKey, resolvedTeamId, playoffProjection, headToHeadByPair]);

  const activeProjectionTeamKey = useMemo(() => {
    if (selectedProjectionTeamKey) return selectedProjectionTeamKey;
    if (!resolvedTeamId || resolvedTeamId === 'all') return '';
    const selectedTeamName = allTeams.find(team => team.id === resolvedTeamId)?.name;
    return selectedTeamName ? normalizeTeamKey(selectedTeamName) : '';
  }, [allTeams, resolvedTeamId, selectedProjectionTeamKey]);

  const remainingProjectionGamesForSelectedTeam = useMemo(() => {
    if (!activeProjectionTeamKey) return [];
    return projectionUpcomingGames
      .filter(item => item.homeTeamKey === activeProjectionTeamKey || item.awayTeamKey === activeProjectionTeamKey)
      .map(item => {
        const isHome = item.homeTeamKey === activeProjectionTeamKey;
        const ownTeam = isHome ? item.homeTeam : item.awayTeam;
        const opponent = isHome ? item.awayTeam : item.homeTeam;
        const ownModelWinProbability = isHome ? item.homeWinProbabilityModel : item.awayWinProbabilityModel;
        const ownAppliedWinProbability = isHome ? item.homeWinProbabilityApplied : item.awayWinProbabilityApplied;
        const selectedWinner = item.overrideWinnerSide
          ? (item.overrideWinnerSide === 'home' ? item.homeTeam : item.awayTeam)
          : null;

        return {
          ...item,
          isHome,
          ownTeam,
          opponent,
          ownModelWinProbability,
          ownAppliedWinProbability,
          selectedWinner,
        };
      });
  }, [activeProjectionTeamKey, projectionUpcomingGames]);

  const activeProjectionTeamName = useMemo(() => {
    if (remainingProjectionGamesForSelectedTeam.length > 0) return remainingProjectionGamesForSelectedTeam[0].ownTeam;
    const hit = projectedStandings.find(row => normalizeTeamKey(row.team) === activeProjectionTeamKey);
    return hit?.team ?? null;
  }, [activeProjectionTeamKey, projectedStandings, remainingProjectionGamesForSelectedTeam]);

  const setFixtureWinnerOverride = (fixtureId: string, winnerMode: 'model' | 'home' | 'away') => {
    setFixtureWinnerOverrides(prev => {
      const next = { ...prev };
      if (winnerMode === 'model') {
        delete next[fixtureId];
      } else {
        next[fixtureId] = winnerMode;
      }
      return next;
    });
  };

  const setPlayoffSeriesWinnerOverride = (seriesKey: string, winnerMode: 'model' | 'home' | 'away') => {
    setPlayoffSeriesWinnerOverrides(prev => {
      const next = { ...prev };
      if (winnerMode === 'model') {
        delete next[seriesKey];
      } else {
        next[seriesKey] = winnerMode;
      }
      return next;
    });
  };

  const resetWinnerOverrides = () => {
    setFixtureWinnerOverrides({});
    setPlayoffSeriesWinnerOverrides({});
  };

  const whatIfTeamOptions = useMemo(() => {
    if (projectedStandings.length > 0) {
      return projectedStandings.map(row => ({
        key: normalizeTeamKey(row.team),
        label: row.team,
      }));
    }

    return standingsSnapshot.map(row => ({
      key: normalizeTeamKey(row.team),
      label: row.team,
    }));
  }, [projectedStandings, standingsSnapshot]);

  const applyWhatIfTeamAdjustment = () => {
    if (!whatIfTeamKey) return;
    const parsed = Number(whatIfTeamDeltaInput.replace(',', '.'));
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.max(-2, Math.min(2, parsed));
    setWhatIfTeamAdjustments(prev => ({ ...prev, [whatIfTeamKey]: clamped }));
  };

  const removeWhatIfTeamAdjustment = (teamKey: string) => {
    setWhatIfTeamAdjustments(prev => {
      const next = { ...prev };
      delete next[teamKey];
      return next;
    });
  };

  const resetWhatIfSettings = () => {
    setWhatIfHomeAdvantageDelta(0);
    setWhatIfLogisticDelta(0);
    setWhatIfTeamAdjustments({});
    setWhatIfTeamDeltaInput('0');
  };

  const getPercentileColor = (value: number) => {
    if (value >= 80) return 'var(--positive)';
    if (value >= 60) return 'var(--accent-cyan)';
    if (value >= 40) return 'var(--warning)';
    if (value >= 20) return 'var(--accent-orange)';
    return 'var(--negative)';
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
      pregameInjuryContext,
      {
        own: teamSeasonShotSummary,
        opponent: opponentSeasonShotSummary,
        league: leagueSeasonShotSummary,
        ownAllowed: teamAllowedSeasonShotSummary,
        opponentAllowed: opponentAllowedSeasonShotSummary,
      }
    );
  }, [
    pregameBenchmarks,
    pregameInjuryContext,
    pregameOpponentPlayers,
    pregameOpponentTeam,
    pregameOwnPlayers,
    pregameOwnTeam,
    teamSeasonShotSummary,
    opponentSeasonShotSummary,
    teamAllowedSeasonShotSummary,
    opponentAllowedSeasonShotSummary,
    leagueSeasonShotSummary,
  ]);

  const pregameEfficiencyBaseline = useMemo(() => {
    if (!pregameOwnTeam || !pregameOpponentTeam) return null;
    return {
      own: buildPregameEfficiencyBaseline(pregameOwnTeam),
      opponent: buildPregameEfficiencyBaseline(pregameOpponentTeam),
    };
  }, [pregameOpponentTeam, pregameOwnTeam]);

  useEffect(() => {
    if (!pregameEfficiencyBaseline) return;
    setPregameEfficiencyInputs({
      ownPossessions: pregameEfficiencyBaseline.own.possessions,
      ownThreeSharePct: pregameEfficiencyBaseline.own.threeSharePct,
      ownFtRatePct: pregameEfficiencyBaseline.own.ftRatePct,
      ownTovRatePct: pregameEfficiencyBaseline.own.tovRatePct,
      ownOrebBonusPct: pregameEfficiencyBaseline.own.orebBonusPct,
      ownTwoPct: pregameEfficiencyBaseline.own.twoPct,
      ownThreePct: pregameEfficiencyBaseline.own.threePct,
      ownFtPct: pregameEfficiencyBaseline.own.ftPct,
      opponentPossessions: pregameEfficiencyBaseline.opponent.possessions,
      opponentThreeSharePct: pregameEfficiencyBaseline.opponent.threeSharePct,
      opponentFtRatePct: pregameEfficiencyBaseline.opponent.ftRatePct,
      opponentTovRatePct: pregameEfficiencyBaseline.opponent.tovRatePct,
      opponentOrebBonusPct: pregameEfficiencyBaseline.opponent.orebBonusPct,
      opponentTwoPct: pregameEfficiencyBaseline.opponent.twoPct,
      opponentThreePct: pregameEfficiencyBaseline.opponent.threePct,
      opponentFtPct: pregameEfficiencyBaseline.opponent.ftPct,
    });
  }, [pregameEfficiencyBaseline]);

  const pregameEfficiencyModel = useMemo(() => {
    if (!pregameEfficiencyBaseline) return null;
    const own = projectPregameEfficiency(pregameEfficiencyBaseline.own, {
      possessions: pregameEfficiencyInputs.ownPossessions,
      threeSharePct: pregameEfficiencyInputs.ownThreeSharePct,
      ftRatePct: pregameEfficiencyInputs.ownFtRatePct,
      tovRatePct: pregameEfficiencyInputs.ownTovRatePct,
      orebBonusPct: pregameEfficiencyInputs.ownOrebBonusPct,
      twoPct: pregameEfficiencyInputs.ownTwoPct,
      threePct: pregameEfficiencyInputs.ownThreePct,
      ftPct: pregameEfficiencyInputs.ownFtPct,
    });
    const opponent = projectPregameEfficiency(pregameEfficiencyBaseline.opponent, {
      possessions: pregameEfficiencyInputs.opponentPossessions,
      threeSharePct: pregameEfficiencyInputs.opponentThreeSharePct,
      ftRatePct: pregameEfficiencyInputs.opponentFtRatePct,
      tovRatePct: pregameEfficiencyInputs.opponentTovRatePct,
      orebBonusPct: pregameEfficiencyInputs.opponentOrebBonusPct,
      twoPct: pregameEfficiencyInputs.opponentTwoPct,
      threePct: pregameEfficiencyInputs.opponentThreePct,
      ftPct: pregameEfficiencyInputs.opponentFtPct,
    });

    return {
      own,
      opponent,
      netExpectedPoints: roundValue(own.expectedPoints - opponent.expectedPoints, 1),
      netDeltaVsBaseline: roundValue(
        (own.expectedPoints - opponent.expectedPoints)
          - (pregameEfficiencyBaseline.own.expectedPoints - pregameEfficiencyBaseline.opponent.expectedPoints),
        1
      ),
      opponentSuppression: roundValue(pregameEfficiencyBaseline.opponent.expectedPoints - opponent.expectedPoints, 1),
    };
  }, [pregameEfficiencyBaseline, pregameEfficiencyInputs]);

  const pregameInjuryImpactEstimate = useMemo(() => {
    const ownMissing = activeSeasonPlayers.filter(
      player => String(player.teamId ?? '') === String(resolvedTeamId) && pregameOwnInjuries.includes(player.id)
    );
    const opponentMissing = activeSeasonPlayers.filter(
      player => String(player.teamId ?? '') === String(selectedOpponentTeamId) && pregameOpponentInjuries.includes(player.id)
    );

    const summarizeMissing = (players: PlayerStats[]) => {
      const eligiblePlayers = players.filter(player => {
        const games = Math.max(player.gamesPlayed || 0, 0);
        const minutesPerGame = games > 0 ? (player.minutes || 0) / games : 0;
        return games >= 4 && minutesPerGame >= 8;
      });

      const totals = eligiblePlayers.reduce(
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

  type PregameKeyPlayerFingerprint = {
    playerId: string;
    name: string;
    positionLabel: string;
    attempts: number;
    fgPct: number;
    profileNote: string;
    sampleNote: string;
    topZones: Array<{ label: string; rate: number }>;
    zones: Array<{
      key: ShotZoneKey;
      label: string;
      attempts: number;
      rate: number;
      pct: number;
      rateDeltaVsLeague: number;
      fillClass: string;
    }>;
  };

  type PregameOptimalLineupCandidate = {
    key: string;
    players: PlayerSeasonStat[];
    names: string[];
    roleAssignments: Array<{ playerId: string; name: string; role: Position }>;
    totalScore: number;
    exactSampleMinutes: number;
    exactNetPer40: number | null;
    pairSampleMinutes: number;
    trioSampleMinutes: number;
    certainty: 'high' | 'medium' | 'low';
    reasons: string[];
  };

  type PregameOptimalLineupResult = {
    best: PregameOptimalLineupCandidate;
    alternates: PregameOptimalLineupCandidate[];
    candidateCount: number;
    sourceGames: number;
    matchupWeights: {
      perimeter: number;
      paint: number;
      ballSecurity: number;
    };
    headline: string;
  };

  const buildPregameKeyPlayerFingerprints = (
    keyPlayers: {
      primaryScorers: string[];
      primaryPlaymakers: string[];
      stretchThreats: string[];
      mismatchCandidates: string[];
    } | null | undefined,
    players: PlayerSeasonStat[],
    shotRows: ShotEventRow[]
  ) => {
    if (!keyPlayers || !leagueSeasonShotSummary || shotRows.length === 0) {
      return [] as PregameKeyPlayerFingerprint[];
    }

    const zoneDefinitions: Array<{ key: ShotZoneKey; label: string; fillClass: string }> = [
      { key: 'rim', label: 'Gyűrű', fillClass: 'bg-positive' },
      { key: 'paint', label: 'Festék', fillClass: 'bg-cyan' },
      { key: 'mid', label: 'Középtáv', fillClass: 'bg-warning' },
      { key: 'corner3', label: 'Sarok tripla', fillClass: 'bg-orange' },
      { key: 'aboveBreak3', label: 'Egyéb tripla', fillClass: 'bg-ai' },
    ];
    const leagueTotal = Math.max(leagueSeasonShotSummary.attempts, 1);
    const stripAnnotation = (value: string) => value.replace(/\s*\([^)]*\)\s*$/u, '').trim();
    const keyPlayerLabels = [
      ...keyPlayers.primaryScorers,
      ...keyPlayers.primaryPlaymakers,
      ...keyPlayers.stretchThreats,
      ...keyPlayers.mismatchCandidates,
    ]
      .map(stripAnnotation)
      .filter(Boolean);

    const matchedPlayers = new Map<string, PlayerSeasonStat>();
    keyPlayerLabels.forEach(label => {
      const profiles = [buildNormalizedNameProfile(label)];
      const player = players.find(candidate => matchesNormalizedNameProfile(candidate.name, profiles));
      if (player && !matchedPlayers.has(player.playerId)) {
        matchedPlayers.set(player.playerId, player);
      }
    });

    return Array.from(matchedPlayers.values())
      .map(player => {
        const summary = buildShotProfileSummary(
          toShotPoints(shotRows.filter(row => row.player_id === player.playerId))
        );
        if (summary.attempts <= 0) return null;

        const totalAttempts = Math.max(summary.attempts, 1);
        const zones = zoneDefinitions.map(zone => {
          const stats = summary.zoneStats[zone.key];
          const leagueRate = (leagueSeasonShotSummary.zoneStats[zone.key].attempts / leagueTotal) * 100;
          const rate = (stats.attempts / totalAttempts) * 100;
          return {
            key: zone.key,
            label: zone.label,
            attempts: stats.attempts,
            rate: roundValue(rate, 1),
            pct: stats.pct,
            rateDeltaVsLeague: roundValue(rate - leagueRate, 1),
            fillClass: zone.fillClass,
          };
        });

        const topZones = [...zones]
          .filter(zone => zone.attempts > 0)
          .sort((a, b) => b.rate - a.rate)
          .slice(0, 2)
          .map(zone => ({ label: zone.label, rate: zone.rate }));

        const sampleNote = summary.attempts >= 25
          ? 'stabil shotchart minta'
          : summary.attempts >= 12
            ? 'közepes shotchart minta'
            : 'limitált shotchart minta';
        const profileNote = topZones.length >= 2
          ? `${topZones[0].label} + ${topZones[1].label} súlypont`
          : topZones[0]
            ? `${topZones[0].label} súlypont`
            : 'vegyes dobásprofil';

        return {
          playerId: player.playerId,
          name: player.name,
          positionLabel: player.positionLabel || player.position,
          attempts: summary.attempts,
          fgPct: summary.fgPct,
          profileNote,
          sampleNote,
          topZones,
          zones,
        };
      })
      .filter((player): player is PregameKeyPlayerFingerprint => Boolean(player))
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, 3);
  };

  const pregameOwnKeyPlayerFingerprints = useMemo(
    () => buildPregameKeyPlayerFingerprints(pregameReport?.ownKeyPlayers, pregameOwnPlayers, teamSeasonShotRows),
    [leagueSeasonShotSummary, pregameOwnPlayers, pregameReport, teamSeasonShotRows]
  );

  const pregameOpponentKeyPlayerFingerprints = useMemo(
    () => buildPregameKeyPlayerFingerprints(pregameReport?.keyPlayers, pregameOpponentPlayers, opponentSeasonShotRows),
    [leagueSeasonShotSummary, opponentSeasonShotRows, pregameOpponentPlayers, pregameReport]
  );

  const pregameHeadToHeadSummary = useMemo(() => {
    const ownName = pregameOwnTeam?.teamName;
    const opponentName = pregameOpponentTeam?.teamName;
    if (!ownName || !opponentName) {
      return {
        games: 0,
        ownWins: 0,
        opponentWins: 0,
        ownAvgPoints: 0,
        opponentAvgPoints: 0,
        note: 'Első találkozó a szezonban.',
      };
    }

    const ownKey = normalizeTeamKey(ownName);
    const opponentKey = normalizeTeamKey(opponentName);
    if (!ownKey || !opponentKey || ownKey === opponentKey) {
      return {
        games: 0,
        ownWins: 0,
        opponentWins: 0,
        ownAvgPoints: 0,
        opponentAvgPoints: 0,
        note: 'Nincs értelmezhető head-to-head minta.',
      };
    }

    const [teamAKey, teamBKey] = [ownKey, opponentKey].sort((a, b) => a.localeCompare(b));
    const h2h = headToHeadByPair.get(`${teamAKey}__${teamBKey}`);
    if (!h2h || h2h.games === 0) {
      return {
        games: 0,
        ownWins: 0,
        opponentWins: 0,
        ownAvgPoints: 0,
        opponentAvgPoints: 0,
        note: 'Első találkozó a szezonban.',
      };
    }

    const ownIsTeamA = h2h.teamAKey === ownKey;
    const ownWins = ownIsTeamA ? h2h.teamAWins : h2h.teamBWins;
    const opponentWins = ownIsTeamA ? h2h.teamBWins : h2h.teamAWins;
    const ownPoints = ownIsTeamA ? h2h.teamAPoints : h2h.teamBPoints;
    const opponentPoints = ownIsTeamA ? h2h.teamBPoints : h2h.teamAPoints;
    const ownAvgPoints = ownPoints / Math.max(1, h2h.games);
    const opponentAvgPoints = opponentPoints / Math.max(1, h2h.games);

    return {
      games: h2h.games,
      ownWins,
      opponentWins,
      ownAvgPoints: roundValue(ownAvgPoints, 1),
      opponentAvgPoints: roundValue(opponentAvgPoints, 1),
      note: `${ownName} ${ownWins}-${opponentWins} a szezonos H2H-ban, átlagpontok: ${ownAvgPoints.toFixed(1)}-${opponentAvgPoints.toFixed(1)}.`,
    };
  }, [headToHeadByPair, pregameOpponentTeam, pregameOwnTeam]);

  const pregameHeadToHeadInsight = useMemo(() => {
    if (!latestHeadToHeadGame || !resolvedTeamId || resolvedTeamId === 'all' || !selectedOpponentTeamId) return null;

    const ownRows = teamGamePlayerRows.get(resolvedTeamId)?.get(latestHeadToHeadGame.ownGameId) ?? null;
    const opponentGameId = latestHeadToHeadGame.opponentGameId ?? latestHeadToHeadGame.ownGameId;
    const opponentRows = teamGamePlayerRows.get(selectedOpponentTeamId)?.get(opponentGameId) ?? null;
    if (!ownRows?.length || !opponentRows?.length) return null;

    const summarizeGameRows = (rows: GamePlayerStatRow[]) => {
      const points = rows.reduce((sum, row) => sum + Number(row.points || 0), 0);
      const threeMade = rows.reduce((sum, row) => sum + Number(row.three_made || 0), 0);
      const threeAttempted = rows.reduce((sum, row) => sum + Number(row.three_attempted || 0), 0);
      const fta = rows.reduce((sum, row) => sum + Number(row.free_throw_attempted || 0), 0);
      const turnovers = rows.reduce((sum, row) => sum + Number(row.turnovers || 0), 0);
      const rebounds = rows.reduce((sum, row) => {
        const totalRebounds = Number(row.total_rebounds || 0);
        if (totalRebounds > 0) return sum + totalRebounds;
        return sum + Number(row.offensive_rebounds || 0) + Number(row.defensive_rebounds || 0);
      }, 0);
      const leaders = [...rows]
        .map(row => ({
          name: String(row.players?.name || '').trim(),
          points: Number(row.points || 0),
          valuation: Number(row.valuation || 0),
        }))
        .filter(row => row.name)
        .sort((a, b) => b.points - a.points || b.valuation - a.valuation)
        .slice(0, 2)
        .map(row => `${row.name} ${row.points} pont`);

      return {
        points,
        threePct: threeAttempted > 0 ? (threeMade / threeAttempted) * 100 : 0,
        fta,
        turnovers,
        rebounds,
        leaders,
      };
    };

    const ownGame = summarizeGameRows(ownRows);
    const opponentGame = summarizeGameRows(opponentRows);
    const margin = ownGame.points - opponentGame.points;

    const takeaway = (() => {
      if (ownGame.threePct >= opponentGame.threePct + 5) {
        return `A korábbi meccsen a tripla-hatékonyság döntő előnyt adott (${ownGame.threePct.toFixed(1)}% vs ${opponentGame.threePct.toFixed(1)}%).`;
      }
      if (ownGame.fta >= opponentGame.fta + 4) {
        return `A festéktámadás több büntetőt hozott (${ownGame.fta}-${opponentGame.fta} FTA), ez most is működő támadási út lehet.`;
      }
      if (ownGame.turnovers <= opponentGame.turnovers - 2) {
        return `A labdabiztonság a saját oldalra billentette a szoros meccset (${ownGame.turnovers}-${opponentGame.turnovers} TO).`;
      }
      return `A ${Math.abs(margin)} pontos különbséget a végrehajtás apró részletei döntötték el, ezért most is szoros végjáték várható.`;
    })();

    const warning = (() => {
      if (opponentGame.threePct >= ownGame.threePct + 5) {
        return `Az ellenfél kinti játéka akkor is élt (${opponentGame.threePct.toFixed(1)}% tripla), ezt most korábban kell lezárni.`;
      }
      if (opponentGame.fta >= ownGame.fta + 4) {
        return `Az ellenfél akkor is sok vonalat generált (${opponentGame.fta} FTA), a faultterhelés most sem engedhető el.`;
      }
      if (opponentGame.rebounds >= ownGame.rebounds + 4) {
        return 'A lepattanóharcban az ellenfél tudott plusz labdákat nyerni, a második esélyeket most vissza kell fogni.';
      }
      return 'A minimális H2H-különbség nem jelent automatikus ismétlést, a mostani matchup is könnyen átbillenhet.';
    })();

    return {
      ownScore: ownGame.points,
      opponentScore: opponentGame.points,
      margin,
      ownThreePct: roundValue(ownGame.threePct, 1),
      opponentThreePct: roundValue(opponentGame.threePct, 1),
      ownStandouts: ownGame.leaders,
      opponentStandouts: opponentGame.leaders,
      takeaway,
      warning,
    };
  }, [latestHeadToHeadGame, resolvedTeamId, selectedOpponentTeamId, teamGamePlayerRows]);

  const pregameBaseKeyMatchups = useMemo(() => {
    if (!pregameReport) {
      return [] as Array<{
        title: string;
        edge: 'own' | 'opponent' | 'even';
        ownPlayer: string;
        opponentPlayer: string;
        summary: string;
        tacticalNote: string;
      }>;
    }

    const ownFingerprints = new Map(pregameOwnKeyPlayerFingerprints.map(player => [player.playerId, player]));
    const opponentFingerprints = new Map(pregameOpponentKeyPlayerFingerprints.map(player => [player.playerId, player]));
    const playerBuckets = (player: PlayerSeasonStat) => {
      if (player.positionBuckets?.length) return player.positionBuckets as Position[];
      return [player.position as Position];
    };
    const playerMatches = (player: PlayerSeasonStat, positions: Position[]) =>
      playerBuckets(player).some(position => positions.includes(position));

    const pickLeader = (
      players: PlayerSeasonStat[],
      positions: Position[],
      mode: 'balanced' | 'wing' | 'playmaker' = 'balanced'
    ) => {
      const filtered = players
        .filter(player => playerMatches(player, positions))
        .map(player => {
          const minutes = Math.max(player.minutes || 0, 1);
          const games = Math.max(player.games || 0, 1);
          const valPer36 = (player.val / minutes) * 36;
          const pointsPer36 = (player.points / minutes) * 36;
          const fgAttempts = player.fga2 + player.fga3;
          const fgPct = fgAttempts > 0 ? ((player.fgm2 + player.fgm3) / fgAttempts) * 100 : 0;
          const threePct = player.fga3 > 0 ? (player.fgm3 / player.fga3) * 100 : 0;
          const threeVolume = player.fga3 / games;
          const astTo = player.tov > 0 ? player.ast / player.tov : player.ast;

          let score = valPer36 * 0.55 + pointsPer36 * 0.2 + threePct * 0.08;
          if (mode === 'wing') score += threeVolume * 3.4 + threePct * 0.3;
          if (mode === 'playmaker') score += (player.ast / games) * 2.4 + astTo * 2.1;

          return {
            player,
            valPer36: roundValue(valPer36, 1),
            pointsPer36: roundValue(pointsPer36, 1),
            fgPct: roundValue(fgPct, 1),
            threePct: roundValue(threePct, 1),
            threeVolume: roundValue(threeVolume, 1),
            astTo: roundValue(astTo, 2),
            score,
          };
        })
        .sort((a, b) => b.score - a.score || b.valPer36 - a.valPer36);

      return filtered[0] ?? null;
    };

    const buildZoneSnippet = (
      playerId: string,
      fingerprints: Map<string, (typeof pregameOwnKeyPlayerFingerprints)[number]>
    ) => {
      const fingerprint = fingerprints.get(playerId);
      if (!fingerprint || fingerprint.topZones.length === 0) return '';
      const zone = fingerprint.topZones[0];
      return `${zone.label} ${zone.rate.toFixed(0)}%-os súlyponttal`;
    };

    const buildMatchup = (
      title: string,
      ownLeader: ReturnType<typeof pickLeader>,
      opponentLeader: ReturnType<typeof pickLeader>,
      tacticalNoteBuilder: (own: NonNullable<typeof ownLeader>, opponent: NonNullable<typeof opponentLeader>, edge: 'own' | 'opponent' | 'even') => string,
      summaryBuilder: (own: NonNullable<typeof ownLeader>, opponent: NonNullable<typeof opponentLeader>) => string
    ) => {
      if (!ownLeader || !opponentLeader) return null;
      const delta = roundValue(ownLeader.valPer36 - opponentLeader.valPer36, 1);
      const edge: 'own' | 'opponent' | 'even' = delta >= 2 ? 'own' : delta <= -2 ? 'opponent' : 'even';
      return {
        title,
        edge,
        ownPlayer: ownLeader.player.name,
        opponentPlayer: opponentLeader.player.name,
        summary: summaryBuilder(ownLeader, opponentLeader),
        tacticalNote: tacticalNoteBuilder(ownLeader, opponentLeader, edge),
      };
    };

    const ownPg = pickLeader(pregameOwnPlayers, ['PG'], 'playmaker');
    const opponentPg = pickLeader(pregameOpponentPlayers, ['PG'], 'playmaker');
    const ownWing = pickLeader(pregameOwnPlayers, ['SG', 'SF'], 'wing');
    const opponentWing = pickLeader(pregameOpponentPlayers, ['SG', 'SF'], 'wing');
    const ownCenter = pickLeader(pregameOwnPlayers, ['C', 'PF'], 'balanced');
    const opponentCenter = pickLeader(pregameOpponentPlayers, ['C', 'PF'], 'balanced');

    return [
      buildMatchup(
        'Irányító csata',
        ownPg,
        opponentPg,
        (own, opponent, edge) => edge === 'opponent'
          ? `${opponent.player.name} szervezését első passzon kell lassítani; ${own.player.name} labdabiztonsága és AST/TO mutatója tarthatja kontroll alatt a matchupot.`
          : `${own.player.name} döntéshozatala és tempókontrollja csökkentheti az ellenfél futásainak számát.`,
        (own, opponent) => {
          const ownZone = buildZoneSnippet(own.player.playerId, ownFingerprints);
          const opponentZone = buildZoneSnippet(opponent.player.playerId, opponentFingerprints);
          return `${own.player.name} ${own.valPer36.toFixed(1)} VAL/36 és ${own.astTo.toFixed(2)} AST/TO, míg ${opponent.player.name} ${opponent.valPer36.toFixed(1)} VAL/36-t hoz. ${ownZone ? `${own.player.name} profilja: ${ownZone}. ` : ''}${opponentZone ? `${opponent.player.name} profilja: ${opponentZone}.` : ''}`.trim();
        }
      ),
      buildMatchup(
        'Wing csata',
        ownWing,
        opponentWing,
        (_own, opponent, edge) => edge === 'opponent'
          ? `${opponent.player.name} tiszta külső helyzeteit kell elvenni; a rotáló closeout és a második kilépés fontosabb, mint az egyéni izoláció.`
          : 'A wing-előny csak akkor vált pontelőnnyé, ha a spacingből jövő triplahelyzetek valóban megérkeznek.',
        (own, opponent) => `${own.player.name} ${own.threePct.toFixed(1)}% 3P és ${own.threeVolume.toFixed(1)} tripla/meccs, szemben ${opponent.player.name} ${opponent.threePct.toFixed(1)}%-os triplájával. ${buildZoneSnippet(own.player.playerId, ownFingerprints) ? `${own.player.name}: ${buildZoneSnippet(own.player.playerId, ownFingerprints)}. ` : ''}${buildZoneSnippet(opponent.player.playerId, opponentFingerprints) ? `${opponent.player.name}: ${buildZoneSnippet(opponent.player.playerId, opponentFingerprints)}.` : ''}`.trim(),
      ),
      buildMatchup(
        'Center csata',
        ownCenter,
        opponentCenter,
        (_own, opponent, edge) => edge === 'opponent'
          ? `${opponent.player.name} ellen korai segítség és gyengeoldali visszazárás kell; az izolált posztvédekezés önmagában kevés lehet.`
          : 'A belső matchup akkor tartható kézben, ha a festékérintésekből nem lesz gyors foulterhelés.',
        (own, opponent) => `${own.player.name} ${own.valPer36.toFixed(1)} VAL/36 és ${own.fgPct.toFixed(1)}% FG, míg ${opponent.player.name} ${opponent.valPer36.toFixed(1)} VAL/36-t és ${opponent.fgPct.toFixed(1)}% FG-t hoz.`,
      ),
    ].filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [pregameOpponentKeyPlayerFingerprints, pregameOpponentPlayers, pregameOwnKeyPlayerFingerprints, pregameOwnPlayers, pregameReport]);

  const pregameOptimalLineup = useMemo<PregameOptimalLineupResult | null>(() => {
    if (!pregameReport || pregameOwnPlayers.length < 5) return null;

    const lineupSlots: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];

    const getBuckets = (player: PlayerSeasonStat): Position[] => {
      if (player.positionBuckets?.length) return player.positionBuckets as Position[];
      return [player.position as Position];
    };

    const getEligibleSlots = (player: PlayerSeasonStat): Position[] => {
      const buckets = getBuckets(player);
      const slots = new Set<Position>();
      const games = Math.max(player.games || 1, 1);
      const reboundsPerGame = (player.oreb + player.dreb) / games;
      const wingLikeProfile = (player.heightCm ?? 0) >= 194 || reboundsPerGame >= 4.2;

      buckets.forEach(bucket => {
        if (bucket === 'PG') {
          slots.add('PG');
          slots.add('SG');
        }
        if (bucket === 'SG') {
          slots.add('SG');
          if (wingLikeProfile && !buckets.includes('PG')) {
            slots.add('SF');
          }
        }
        if (bucket === 'SF') {
          slots.add('SF');
          slots.add('PF');
        }
        if (bucket === 'PF') slots.add('PF');
        if (bucket === 'C') slots.add('C');
      });

      const assistsPerGame = player.ast / Math.max(player.games || 1, 1);
      if (assistsPerGame >= 4.5 && (slots.has('SG') || buckets.includes('SG'))) {
        slots.add('PG');
      }

      return lineupSlots.filter(slot => slots.has(slot));
    };

    const assignLineupRoles = (players: PlayerSeasonStat[]) => {
      const orderedPlayers = [...players].sort((a, b) => {
        const aEligible = getEligibleSlots(a).length;
        const bEligible = getEligibleSlots(b).length;
        if (aEligible !== bEligible) return aEligible - bEligible;
        return (b.minutes || 0) - (a.minutes || 0);
      });

      const slotFitScore = (player: PlayerSeasonStat, slot: Position) => {
        const buckets = getBuckets(player);
        const games = Math.max(player.games || 1, 1);
        const pointsPer36 = ((player.points || 0) / Math.max(player.minutes || 1, 1)) * 36;
        const assistsPerGame = (player.ast || 0) / games;
        const reboundsPerGame = ((player.oreb || 0) + (player.dreb || 0)) / games;
        const threeVolume = (player.fga3 || 0) / games;
        const threePct = player.fga3 > 0 ? (player.fgm3 / player.fga3) * 100 : 0;
        const height = player.heightCm ?? 0;

        let score = 0;
        if (buckets.includes(slot)) score += 2.2;

        if (slot === 'PG' && buckets.includes('SG')) score += assistsPerGame >= 4 ? 1.0 : 0.35;
        if (slot === 'SG' && buckets.includes('PG')) score += assistsPerGame >= 3 ? 0.7 : 0.4;
        if (slot === 'SF' && buckets.includes('SG')) score += (height >= 194 || reboundsPerGame >= 4.2) ? 0.65 : -0.4;
        if (slot === 'PF' && buckets.includes('SF')) score += reboundsPerGame >= 4 ? 0.7 : 0.25;
        if (slot === 'C' && buckets.includes('PF')) score += (height >= 201 || reboundsPerGame >= 6) ? 0.55 : -0.8;

        if (slot === 'PG') {
          score += assistsPerGame * 0.22;
          score += pointsPer36 >= 12 ? 0.15 : -0.1;
        }
        if (slot === 'SG') {
          score += pointsPer36 * 0.16 + threeVolume * 0.22;
          score += threePct >= 34 ? 0.4 : -0.2;
        }
        if (slot === 'SF') {
          score += pointsPer36 * 0.12 + reboundsPerGame * 0.2;
          score += height >= 195 ? 0.35 : -0.25;
        }
        if (slot === 'PF') {
          score += reboundsPerGame * 0.25;
          score += height >= 198 ? 0.3 : 0;
        }
        if (slot === 'C') {
          score += reboundsPerGame * 0.38;
          score += height >= 202 ? 0.35 : -0.35;
        }

        return score;
      };

      const usedSlots = new Set<Position>();
      const workingAssignments: Array<{ playerId: string; name: string; role: Position }> = [];
      let bestAssignments: Array<{ playerId: string; name: string; role: Position }> = [];
      let bestScore = Number.NEGATIVE_INFINITY;

      const walk = (index: number, score: number) => {
        if (index >= orderedPlayers.length) {
          if (workingAssignments.length === players.length && score > bestScore) {
            bestScore = score;
            bestAssignments = [...workingAssignments];
          }
          return;
        }

        const player = orderedPlayers[index];
        const eligibleSlots = getEligibleSlots(player);
        for (const slot of eligibleSlots) {
          if (usedSlots.has(slot)) continue;
          usedSlots.add(slot);
          workingAssignments.push({ playerId: player.playerId, name: player.name, role: slot });
          walk(index + 1, score + slotFitScore(player, slot));
          workingAssignments.pop();
          usedSlots.delete(slot);
        }
      };

      walk(0, 0);
      if (bestAssignments.length !== players.length) return null;
      return lineupSlots.flatMap(slot => bestAssignments.find(item => item.role === slot) ?? []);
    };

    const playerMatches = (player: PlayerSeasonStat, positions: Position[]) =>
      getBuckets(player).some(position => positions.includes(position));

    const combinations = <T,>(items: T[], size: number): T[][] => {
      const result: T[][] = [];
      const walk = (start: number, current: T[]) => {
        if (current.length === size) {
          result.push([...current]);
          return;
        }
        for (let index = start; index < items.length; index += 1) {
          current.push(items[index]);
          walk(index + 1, current);
          current.pop();
        }
      };
      walk(0, []);
      return result;
    };

    const matchNamesToPlayers = (names: string[]) => {
      const matched: PlayerSeasonStat[] = [];
      const used = new Set<string>();
      for (const name of names) {
        const nameProfile = buildNormalizedNameProfile(name);
        const player = pregameOwnPlayers.find(candidate => (
          !used.has(candidate.playerId)
          && (
            // Kosarstat lineup names and season roster names can differ in token length/order.
            matchesNormalizedNameProfile(candidate.name, [nameProfile])
            || matchesNormalizedNameProfile(name, [buildNormalizedNameProfile(candidate.name)])
          )
        ));
        if (!player) return null;
        used.add(player.playerId);
        matched.push(player);
      }
      return matched;
    };

    const lineupKey = (players: PlayerSeasonStat[]) =>
      [...players].map(player => player.playerId).sort((a, b) => a.localeCompare(b)).join('|');

    const comboKey = (players: PlayerSeasonStat[]) =>
      [...players].map(player => player.playerId).sort((a, b) => a.localeCompare(b)).join('|');

    const confidenceFromEvidence = (minutes: number): 'high' | 'medium' | 'low' => (
      minutes >= 18 ? 'high' : minutes >= 8 ? 'medium' : 'low'
    );

    const metricBase = pregameOwnPlayers.map(player => {
      const minutes = Math.max(player.minutes || 0, 1);
      const games = Math.max(player.games || 0, 1);
      const valPer36 = (player.val / minutes) * 36;
      const pointsPer36 = (player.points / minutes) * 36;
      const astPerGame = player.ast / games;
      const tovPerGame = player.tov / games;
      const astTo = player.tov > 0 ? player.ast / player.tov : player.ast;
      const threePct = player.fga3 > 0 ? (player.fgm3 / player.fga3) * 100 : 0;
      const threeVolume = player.fga3 / games;
      const reboundsPer36 = ((player.oreb + player.dreb) / minutes) * 36;
      const blkPer36 = (player.blk / minutes) * 36;
      const stlPer36 = (player.stl / minutes) * 36;
      return {
        player,
        valPer36,
        pointsPer36,
        astPerGame,
        tovPerGame,
        astTo,
        threePct,
        threeVolume,
        reboundsPer36,
        blkPer36,
        stlPer36,
      };
    });

    const zScore = (value: number, pool: number[]) => {
      const filtered = pool.filter(item => Number.isFinite(item));
      if (filtered.length < 2) return 0;
      const mean = average(filtered);
      const sd = stdDev(filtered);
      if (!Number.isFinite(sd) || sd <= 0.0001) return 0;
      return (value - mean) / sd;
    };

    const valPool = metricBase.map(item => item.valPer36);
    const scoringPool = metricBase.map(item => item.pointsPer36);
    const spacingPool = metricBase.map(item => item.threeVolume * Math.max(item.threePct - 26, 0));
    const creationPool = metricBase.map(item => item.astPerGame * 1.8 + item.astTo * 1.1 - item.tovPerGame * 0.8);
    const rimPool = metricBase.map(item => item.reboundsPer36 * 0.35 + item.blkPer36 * 2.2);
    const securityPool = metricBase.map(item => item.astTo * 1.5 + item.stlPer36 * 0.8 - item.tovPerGame * 0.6);

    const metricByPlayerId = new Map(metricBase.map(item => {
      const spacingRaw = item.threeVolume * Math.max(item.threePct - 26, 0);
      const creationRaw = item.astPerGame * 1.8 + item.astTo * 1.1 - item.tovPerGame * 0.8;
      const rimRaw = item.reboundsPer36 * 0.35 + item.blkPer36 * 2.2;
      const securityRaw = item.astTo * 1.5 + item.stlPer36 * 0.8 - item.tovPerGame * 0.6;
      return [item.player.playerId, {
        talent: zScore(item.valPer36, valPool),
        scoring: zScore(item.pointsPer36, scoringPool),
        spacing: zScore(spacingRaw, spacingPool),
        creation: zScore(creationRaw, creationPool),
        rim: zScore(rimRaw, rimPool),
        security: zScore(securityRaw, securityPool),
        rawThreePct: item.threePct,
        rawThreeVolume: item.threeVolume,
      }] as const;
    }));

    const opponentPerimeterNeed = clamp01(
      (pregameReport.llmContext?.opponentDominantAxis === 'periméter' ? 0.3 : 0)
      + ((pregameReport.profile.offense ?? []).some(item => /periméter/i.test(item)) ? 0.2 : 0)
      + ((pregameReport.shotProfileContext?.opponentTopZones ?? []).some(zone => /tripla/i.test(zone.label)) ? 0.2 : 0)
      + (pregameReport.focusPoints.some(item => /periméter|tripla|closeout/i.test(item)) ? 0.2 : 0)
    );
    const centerDelta = pregameReport.positionComparison.find(item => item.position === 'C')?.deltaValPer36 ?? 0;
    const opponentPaintNeed = clamp01(
      (pregameReport.llmContext?.opponentDominantAxis === 'festék' ? 0.25 : 0)
      + ((pregameReport.shotProfileContext?.clashZones ?? []).includes('Gyűrű') ? 0.25 : 0)
      + (centerDelta <= -4 ? 0.25 : 0)
      + (pregameReport.focusPoints.some(item => /festék|betörés|lepattanó/i.test(item)) ? 0.15 : 0)
    );
    const ballSecurityNeed = clamp01(
      ((pregameReport.profile.defense ?? []).some(item => /labdanyomás/i.test(item)) ? 0.35 : 0)
      + (pregameReport.focusPoints.some(item => /labdabiztonság|nyomás|letámadás/i.test(item)) ? 0.25 : 0)
      + (pregameReport.calibrationDiagnostics?.dimensions.some(item => item.key === 'ball_pressure' && item.score >= 55) ? 0.2 : 0)
    );
    const boundedPerimeterNeed = roundValue(opponentPerimeterNeed * 0.75, 2);
    const boundedPaintNeed = roundValue(opponentPaintNeed * 0.75, 2);
    const boundedBallSecurityNeed = roundValue(ballSecurityNeed * 0.75, 2);

    const naturalCenters = pregameOwnPlayers
      .filter(player => getBuckets(player).includes('C'))
      .map(player => {
        const metric = metricByPlayerId.get(player.playerId);
        return {
          player,
          score: metric
            ? metric.talent * 1.2 + metric.rim * (1.45 + boundedPaintNeed * 1.35) + metric.security * 0.15 + metric.spacing * 0.05
            : -99,
        };
      })
      .sort((a, b) => b.score - a.score);

    const topCenter = naturalCenters[0] ?? null;

    const lineupSource = seasonKosarstatLineupTeam;
    const playerMinutesById = new Map<string, { seconds: number; on40: number | null }>();
    const exactLineupByKey = new Map<string, { seconds: number; netPer40: number }>();
    const pairByKey = new Map<string, { seconds: number; netPer40: number }>();
    const trioByKey = new Map<string, { seconds: number; netPer40: number }>();
    const incumbentStarterIds = new Set<string>();

    if (lineupSource) {
      lineupSource.playerMinutes.forEach(item => {
        const matched = pregameOwnPlayers.find(player => matchesNormalizedNameProfile(item.player, [buildNormalizedNameProfile(player.name)]));
        if (!matched) return;
        playerMinutesById.set(matched.playerId, { seconds: item.seconds, on40: item.on40 });
      });

      lineupSource.stints.forEach(stint => {
        if (stint.players.length !== 5 || stint.seconds <= 0) return;
        const matched = matchNamesToPlayers(stint.players);
        if (!matched || matched.length !== 5) return;
        exactLineupByKey.set(lineupKey(matched), {
          seconds: stint.seconds,
          netPer40: stint.on40 ?? (stint.seconds > 0 ? (stint.plusMinus * 2400) / stint.seconds : 0),
        });
      });

      lineupSource.pairStats.forEach(item => {
        const matched = matchNamesToPlayers(item.players);
        if (!matched || matched.length !== 2) return;
        pairByKey.set(comboKey(matched), { seconds: item.seconds, netPer40: item.netPer40 });
      });

      lineupSource.trioStats.forEach(item => {
        const matched = matchNamesToPlayers(item.players);
        if (!matched || matched.length !== 3) return;
        trioByKey.set(comboKey(matched), { seconds: item.seconds, netPer40: item.netPer40 });
      });

      const matchedStarters = matchNamesToPlayers(lineupSource.starters);
      matchedStarters?.forEach(player => incumbentStarterIds.add(player.playerId));
    }

    const availablePlayersSorted = [...pregameOwnPlayers].sort((a, b) => {
      const aLineupSeconds = playerMinutesById.get(a.playerId)?.seconds ?? 0;
      const bLineupSeconds = playerMinutesById.get(b.playerId)?.seconds ?? 0;
      if (bLineupSeconds !== aLineupSeconds) return bLineupSeconds - aLineupSeconds;
      if ((b.minutes || 0) !== (a.minutes || 0)) return (b.minutes || 0) - (a.minutes || 0);
      return (b.val || 0) - (a.val || 0);
    });

    const candidatePool = availablePlayersSorted.slice(0, Math.min(Math.max(7, pregameOwnPlayers.length), 9));
    const strictValidity = (players: PlayerSeasonStat[]) => {
      const roleAssignments = assignLineupRoles(players);
      if (!roleAssignments) return false;
      const backcourt = players.filter(player => playerMatches(player, ['PG', 'SG'])).length;
      const frontcourt = players.filter(player => playerMatches(player, ['PF', 'C'])).length;
      const wings = players.filter(player => playerMatches(player, ['SG', 'SF'])).length;
      const handlers = players.filter(player => playerMatches(player, ['PG']) || ((player.games || 0) > 0 && (player.ast / Math.max(player.games, 1)) >= 2.5)).length;
      return backcourt >= 2 && frontcourt >= 2 && wings >= 1 && handlers >= 1;
    };
    const relaxedValidity = (players: PlayerSeasonStat[]) => {
      if (!assignLineupRoles(players)) return false;
      const backcourt = players.filter(player => playerMatches(player, ['PG', 'SG'])).length;
      const frontcourt = players.filter(player => playerMatches(player, ['PF', 'C'])).length;
      return backcourt >= 1 && frontcourt >= 1;
    };

    const candidateMap = new Map<string, PlayerSeasonStat[]>();
    combinations(candidatePool, 5)
      .filter(strictValidity)
      .forEach(players => candidateMap.set(lineupKey(players), players));

    if (candidateMap.size === 0) {
      combinations(candidatePool, 5)
        .filter(relaxedValidity)
        .forEach(players => candidateMap.set(lineupKey(players), players));
    }

    if (lineupSource?.starters?.length === 5) {
      const matchedStarters = matchNamesToPlayers(lineupSource.starters);
      if (matchedStarters && matchedStarters.length === 5) {
        candidateMap.set(lineupKey(matchedStarters), matchedStarters);
      }
    }

    [...exactLineupByKey.keys()].forEach(key => {
      if (candidateMap.has(key)) return;
      const players = pregameOwnPlayers.filter(player => key.split('|').includes(player.playerId));
      if (players.length === 5) candidateMap.set(key, players);
    });

    const evaluated = Array.from(candidateMap.values()).map(players => {
      const roleAssignments = assignLineupRoles(players);
      if (!roleAssignments) return null;
      const exactLineup = exactLineupByKey.get(lineupKey(players)) ?? null;
      const exactSampleMinutes = exactLineup ? exactLineup.seconds / 60 : 0;
      const cappedExactNetPer40 = exactLineup ? Math.min(Math.max(exactLineup.netPer40, -35), 35) : 0;
      const exactComponent = exactLineup
        ? cappedExactNetPer40 * (exactLineup.seconds / (exactLineup.seconds + 900)) * 0.9
        : 0;

      const pairSamples = combinations(players, 2)
        .map(pair => pairByKey.get(comboKey(pair)) ?? null)
        .filter((item): item is { seconds: number; netPer40: number } => Boolean(item));
      const trioSamples = combinations(players, 3)
        .map(trio => trioByKey.get(comboKey(trio)) ?? null)
        .filter((item): item is { seconds: number; netPer40: number } => Boolean(item));

      const pairSampleMinutes = pairSamples.reduce((sum, item) => sum + item.seconds, 0) / 60;
      const trioSampleMinutes = trioSamples.reduce((sum, item) => sum + item.seconds, 0) / 60;
      const pairComponent = pairSamples.length > 0
        ? average(pairSamples.map(item => item.netPer40 * (item.seconds / (item.seconds + 240)))) * 0.7
        : 0;
      const trioComponent = trioSamples.length > 0
        ? average(trioSamples.map(item => item.netPer40 * (item.seconds / (item.seconds + 180)))) * 0.5
        : 0;

      const assignedRoleByPlayerId = new Map(roleAssignments.map(item => [item.playerId, item.role] as const));
      const playerFitComponent = average(players.map(player => {
        const metric = metricByPlayerId.get(player.playerId);
        const assignedRole = assignedRoleByPlayerId.get(player.playerId);
        if (!metric || !assignedRole) return 0;

        if (assignedRole === 'PG') {
          return (
            metric.talent * 1.05
            + metric.scoring * 0.2
            + metric.creation * (0.8 + boundedBallSecurityNeed)
            + metric.security * (0.65 + boundedBallSecurityNeed * 0.8)
            + metric.spacing * (0.15 + boundedPerimeterNeed * 0.35)
            + metric.rim * 0.05
          );
        }

        if (assignedRole === 'SG') {
          return (
            metric.talent * 1.05
            + metric.scoring * (0.55 + boundedPerimeterNeed * 0.4)
            + metric.spacing * (0.75 + boundedPerimeterNeed)
            + metric.creation * (0.18 + boundedBallSecurityNeed * 0.28)
            + metric.security * 0.2
            + metric.rim * 0.05
          );
        }

        if (assignedRole === 'SF') {
          return (
            metric.talent * 1.1
            + metric.scoring * (0.45 + boundedPerimeterNeed * 0.25)
            + metric.spacing * (0.5 + boundedPerimeterNeed * 0.6)
            + metric.creation * 0.22
            + metric.security * 0.2
            + metric.rim * (0.2 + boundedPaintNeed * 0.2)
          );
        }

        if (assignedRole === 'PF') {
          return (
            metric.talent * 1.12
            + metric.spacing * (0.28 + boundedPerimeterNeed * 0.35)
            + metric.creation * 0.08
            + metric.security * 0.12
            + metric.rim * (0.75 + boundedPaintNeed * 0.65)
          );
        }

        return (
          metric.talent * 1.2
          + metric.spacing * 0.05
          + metric.creation * 0.05
          + metric.security * 0.16
          + metric.rim * (1.25 + boundedPaintNeed * 1.25)
        );
      })) * 1.95;

      const spacingCount = players.filter(player => {
        const metric = metricByPlayerId.get(player.playerId);
        return (metric?.rawThreePct ?? 0) >= 33 && (metric?.rawThreeVolume ?? 0) >= 1.2;
      }).length;
      const handlerCount = players.filter(player => playerMatches(player, ['PG']) || ((player.ast / Math.max(player.games || 1, 1)) >= 2.5)).length;
      const bigCount = players.filter(player => playerMatches(player, ['PF', 'C'])).length;
      const incumbentOverlap = players.filter(player => incumbentStarterIds.has(player.playerId)).length;
      const lineupMinutes = players.reduce((sum, player) => sum + (playerMinutesById.get(player.playerId)?.seconds ?? 0), 0) / 60;
      const assignedCenter = roleAssignments.find(item => item.role === 'C');
      const assignedCenterMetric = assignedCenter ? metricByPlayerId.get(assignedCenter.playerId) : null;
      const centerAnchorBonus = (() => {
        if (!assignedCenter || !topCenter) return 0;
        if (assignedCenter.playerId === topCenter.player.playerId) return 1.4 + boundedPaintNeed * 0.8;
        const assignedScore = assignedCenterMetric
          ? assignedCenterMetric.talent * 1.2 + assignedCenterMetric.rim * (1.35 + boundedPaintNeed * 1.2)
          : -99;
        const gap = topCenter.score - assignedScore;
        const tacticalFitEdge = assignedCenterMetric
          ? (assignedCenterMetric.spacing * (0.45 + boundedPerimeterNeed)
            + assignedCenterMetric.security * (0.25 + boundedBallSecurityNeed * 0.8))
          : 0;
        const topCenterMetric = metricByPlayerId.get(topCenter.player.playerId);
        const topTacticalFit = topCenterMetric
          ? (topCenterMetric.spacing * (0.45 + boundedPerimeterNeed)
            + topCenterMetric.security * (0.25 + boundedBallSecurityNeed * 0.8))
          : 0;
        const tacticalGap = tacticalFitEdge - topTacticalFit;
        if (gap >= 1.1) return -2.4;
        if (gap >= 0.6 && tacticalGap >= 0.45) return -0.45;
        if (gap >= 0.6) return -1.4;
        if (gap >= 0.25 && tacticalGap >= 0.35) return -0.25;
        if (gap >= 0.25) return -0.7;
        return -0.15;
      })();

      let structureBonus = 0;
      if (spacingCount >= 2) structureBonus += 0.7 + boundedPerimeterNeed * 1.1;
      if (handlerCount >= 2) structureBonus += 0.45 + boundedBallSecurityNeed * 0.9;
      if (bigCount >= 2) structureBonus += 0.4 + boundedPaintNeed * 0.95;
      if (strictValidity(players)) structureBonus += 0.4;
      structureBonus += centerAnchorBonus;

      const lineupBalancePenalty = (() => {
        const pgRole = roleAssignments.find(item => item.role === 'PG') ?? null;
        const sgRole = roleAssignments.find(item => item.role === 'SG') ?? null;
        const sfRole = roleAssignments.find(item => item.role === 'SF') ?? null;
        if (!pgRole || !sgRole) return 0;

        const pgPlayer = players.find(player => player.playerId === pgRole.playerId) || null;
        const sgPlayer = players.find(player => player.playerId === sgRole.playerId) || null;
        if (!pgPlayer || !sgPlayer) return 0;

        const pgMetric = metricByPlayerId.get(pgRole.playerId);
        const sgMetric = metricByPlayerId.get(sgRole.playerId);
        const sfMetric = sfRole ? metricByPlayerId.get(sfRole.playerId) : null;
        if (!pgMetric || !sgMetric) return 0;

        const dualPgBackcourt = getBuckets(pgPlayer).includes('PG') && getBuckets(sgPlayer).includes('PG');
        const lowScoringBackcourt = (pgMetric.scoring + sgMetric.scoring) <= -0.25;
        const lowSpacingBackcourt = (pgMetric.spacing + sgMetric.spacing) <= -0.2;
        const sfCanCarryScoring = Boolean(sfMetric && (sfMetric.scoring >= 0.35 || sfMetric.spacing >= 0.35));
        const smallBackcourt = (pgPlayer.heightCm ?? 0) > 0
          && (sgPlayer.heightCm ?? 0) > 0
          && (pgPlayer.heightCm ?? 0) <= 191
          && (sgPlayer.heightCm ?? 0) <= 191;

        let penalty = 0;
        if (dualPgBackcourt && lowScoringBackcourt && lowSpacingBackcourt && !sfCanCarryScoring) {
          penalty -= 1.8 + boundedPerimeterNeed * 0.9;
        } else if (dualPgBackcourt && lowScoringBackcourt && !sfCanCarryScoring) {
          penalty -= 1.0 + boundedPerimeterNeed * 0.55;
        }
        if (smallBackcourt && boundedPerimeterNeed >= 0.45) {
          penalty -= 0.45;
        }
        return penalty;
      })();

      const continuityBonus = (() => {
        let bonus = 0;
        if (incumbentStarterIds.size > 0) {
          if (incumbentOverlap >= 5) bonus += 2.2;
          else if (incumbentOverlap === 4) bonus += 1.5;
          else if (incumbentOverlap === 3) bonus += 0.7;
          else if (incumbentOverlap <= 2) bonus -= 0.8;
        }
        if (lineupMinutes >= 95) bonus += 1.1;
        else if (lineupMinutes >= 75) bonus += 0.7;
        else if (lineupMinutes <= 35) bonus -= 0.5;
        return bonus;
      })();

      const totalScore = roundValue(
        exactComponent * 1.1 + pairComponent + trioComponent + playerFitComponent + structureBonus + continuityBonus + lineupBalancePenalty,
        2
      );

      const evidenceMinutes = exactSampleMinutes + pairSampleMinutes * 0.18 + trioSampleMinutes * 0.14;
      const certainty = confidenceFromEvidence(evidenceMinutes);

      const reasons: string[] = [];
      if (exactSampleMinutes >= 4) reasons.push(`van közvetlen szezonos ötösminta (${exactSampleMinutes.toFixed(1)} perc)`);
      if (pairSampleMinutes >= 14) reasons.push(`erős páros szinergiák támasztják (${pairSampleMinutes.toFixed(1)} párosperc)`);
      if (incumbentOverlap >= 4) reasons.push('közel marad a megszokott kezdőszerkezethez, ezért rotációsan reálisabb');
      if (opponentPerimeterNeed >= 0.55 && spacingCount >= 2) reasons.push('jobban nyitja a pályát a periméterfókuszú matchupban');
      if (ballSecurityNeed >= 0.55 && handlerCount >= 2) reasons.push('stabilabb labdakezelést ad nyomás ellen');
      if (opponentPaintNeed >= 0.55 && bigCount >= 2) reasons.push('több festékfizikalitást és lepattanót hoz');
      if (reasons.length === 0) reasons.push('a kis mintát egyéni profil és rész-szinergiák felé shrinkeli a modell');

      return {
        key: lineupKey(players),
        players,
        names: roleAssignments.map(item => item.name),
        roleAssignments,
        totalScore,
        exactSampleMinutes: roundValue(exactSampleMinutes, 1),
        exactNetPer40: exactLineup ? roundValue(exactLineup.netPer40, 1) : null,
        pairSampleMinutes: roundValue(pairSampleMinutes, 1),
        trioSampleMinutes: roundValue(trioSampleMinutes, 1),
        certainty,
        reasons: reasons.slice(0, 3),
      } satisfies PregameOptimalLineupCandidate;
    })
      .filter((item): item is PregameOptimalLineupCandidate => Boolean(item))
      .sort((a, b) => b.totalScore - a.totalScore || b.exactSampleMinutes - a.exactSampleMinutes || b.pairSampleMinutes - a.pairSampleMinutes);

    if (evaluated.length === 0) return null;

    const strongestCenterLineup = topCenter
      ? evaluated.find(item => item.roleAssignments.some(role => role.role === 'C' && role.playerId === topCenter.player.playerId)) ?? null
      : null;

    const centerOverrideCandidate = (() => {
      if (!topCenter || !strongestCenterLineup) return null;
      const provisionalBest = evaluated[0];
      const provisionalCenter = provisionalBest.roleAssignments.find(role => role.role === 'C');
      if (!provisionalCenter || provisionalCenter.playerId === topCenter.player.playerId) return null;

      const scoreGap = provisionalBest.totalScore - strongestCenterLineup.totalScore;
      const exactMinutesGap = provisionalBest.exactSampleMinutes - strongestCenterLineup.exactSampleMinutes;
      const pairMinutesGap = provisionalBest.pairSampleMinutes - strongestCenterLineup.pairSampleMinutes;
      const trioMinutesGap = provisionalBest.trioSampleMinutes - strongestCenterLineup.trioSampleMinutes;

      const hasStrongExactEvidence = provisionalBest.exactSampleMinutes >= 8 && exactMinutesGap >= 5;
      const hasStrongSynergyEdge = pairMinutesGap >= 18 || trioMinutesGap >= 12;
      const hasClearOverallEdge = scoreGap >= 3.2;

      const centerTacticalScore = (candidate: PregameOptimalLineupCandidate) => {
        const centerRole = candidate.roleAssignments.find(role => role.role === 'C');
        if (!centerRole) return -99;
        const metric = metricByPlayerId.get(centerRole.playerId);
        if (!metric) return -99;
        return metric.spacing * (0.55 + boundedPerimeterNeed * 1.1)
          + metric.security * (0.25 + boundedBallSecurityNeed * 0.9)
          + metric.talent * 0.35;
      };

      const tacticalScoreGap = centerTacticalScore(provisionalBest) - centerTacticalScore(strongestCenterLineup);
      const hasTacticalCenterEdge = tacticalScoreGap >= 0.5 && scoreGap >= 1.4;
      const hasAdequateEvidenceForTacticalEdge = provisionalBest.exactSampleMinutes >= 6 || provisionalBest.pairSampleMinutes >= 55 || provisionalBest.trioSampleMinutes >= 30;

      if (hasClearOverallEdge && hasStrongExactEvidence && hasStrongSynergyEdge) {
        return null;
      }
      if (hasTacticalCenterEdge && hasAdequateEvidenceForTacticalEdge) {
        return null;
      }

      return strongestCenterLineup;
    })();

    const best = centerOverrideCandidate ?? evaluated[0];
    const alternates = evaluated.filter(item => item.key !== best.key).slice(0, 2);
    const primaryNeed = opponentPerimeterNeed >= opponentPaintNeed && opponentPerimeterNeed >= ballSecurityNeed
      ? 'periméter'
      : opponentPaintNeed >= ballSecurityNeed
        ? 'festék'
        : 'labdabiztonság';

    return {
      best,
      alternates,
      candidateCount: evaluated.length,
      sourceGames: seasonKosarstatLineupGames,
      matchupWeights: {
        perimeter: roundValue(boundedPerimeterNeed * 100, 0),
        paint: roundValue(boundedPaintNeed * 100, 0),
        ballSecurity: roundValue(boundedBallSecurityNeed * 100, 0),
      },
      headline: centerOverrideCandidate
        ? `A modell elsődleges matchup-fókusza most a ${primaryNeed}, de a legerősebb természetes center csak erős mintabeli fölénnyel szorítható ki, ezért itt a center-prior felülírta a puszta rotációs kényelmet.`
        : `A modell elsődleges matchup-fókusza most a ${primaryNeed}, de a valós rotációhoz közeli szerkezetet és a megszokott kezdők priorját is külön visszasúlyozza.`
    };
  }, [pregameOwnPlayers, pregameReport, seasonKosarstatLineupGames, seasonKosarstatLineupTeam]);

  const pregameKeyMatchups = useMemo(() => {
    if (!pregameBaseKeyMatchups.length || !pregameReport) return pregameBaseKeyMatchups;
    if (!pregameOptimalLineup) return pregameBaseKeyMatchups;

    const ownFingerprints = new Map(pregameOwnKeyPlayerFingerprints.map(player => [player.playerId, player] as const));
    const opponentFingerprints = new Map(pregameOpponentKeyPlayerFingerprints.map(player => [player.playerId, player] as const));
    const roleMap = new Map(pregameOptimalLineup.best.roleAssignments.map(item => [item.role, item.playerId] as const));

    const findPlayerById = (players: PlayerSeasonStat[], playerId?: string | null) =>
      playerId ? players.find(player => player.playerId === playerId) ?? null : null;

    const findPlayerByName = (players: PlayerSeasonStat[], name?: string | null) => {
      if (!name) return null;
      const profile = buildNormalizedNameProfile(name);
      return players.find(player => matchesNormalizedNameProfile(player.name, [profile])) ?? null;
    };

    const buildZoneSnippet = (
      playerId: string,
      fingerprints: Map<string, PregameKeyPlayerFingerprint>
    ) => {
      const fingerprint = fingerprints.get(playerId);
      if (!fingerprint || fingerprint.topZones.length === 0) return '';
      const zone = fingerprint.topZones[0];
      return `${zone.label} ${zone.rate.toFixed(0)}%-os súlyponttal`;
    };

    const playerMetrics = (player: PlayerSeasonStat) => {
      const minutes = Math.max(player.minutes || 0, 1);
      const games = Math.max(player.games || 0, 1);
      const fieldGoalsAttempted = player.fga2 + player.fga3;
      return {
        valPer36: roundValue((player.val / minutes) * 36, 1),
        astTo: roundValue(player.tov > 0 ? player.ast / player.tov : player.ast, 2),
        threePct: roundValue(player.fga3 > 0 ? (player.fgm3 / player.fga3) * 100 : 0, 1),
        threeVolume: roundValue(player.fga3 / games, 1),
        fgPct: roundValue(fieldGoalsAttempted > 0 ? ((player.fgm2 + player.fgm3) / fieldGoalsAttempted) * 100 : 0, 1),
      };
    };

    const buildMatchup = (
      title: string,
      ownPlayer: PlayerSeasonStat | null,
      opponentPlayer: PlayerSeasonStat | null,
      summary: (own: PlayerSeasonStat, opponent: PlayerSeasonStat) => string,
      tacticalNote: (own: PlayerSeasonStat, opponent: PlayerSeasonStat, edge: 'own' | 'opponent' | 'even') => string
    ) => {
      if (!ownPlayer || !opponentPlayer) return null;
      const ownMetrics = playerMetrics(ownPlayer);
      const opponentMetrics = playerMetrics(opponentPlayer);
      const delta = ownMetrics.valPer36 - opponentMetrics.valPer36;
      const edge: 'own' | 'opponent' | 'even' = delta >= 2 ? 'own' : delta <= -2 ? 'opponent' : 'even';
      return {
        title,
        edge,
        ownPlayer: ownPlayer.name,
        opponentPlayer: opponentPlayer.name,
        summary: summary(ownPlayer, opponentPlayer),
        tacticalNote: tacticalNote(ownPlayer, opponentPlayer, edge),
      };
    };

    const assignedPg = findPlayerById(pregameOwnPlayers, roleMap.get('PG'));
    const assignedSg = findPlayerById(pregameOwnPlayers, roleMap.get('SG'));
    const assignedSf = findPlayerById(pregameOwnPlayers, roleMap.get('SF'));
    const assignedWing = assignedSg ?? assignedSf;
    const assignedCenter = findPlayerById(pregameOwnPlayers, roleMap.get('C'));

    const opponentPg = findPlayerByName(
      pregameOpponentPlayers,
      pregameBaseKeyMatchups.find(item => item.title === 'Irányító csata')?.opponentPlayer
    );
    const opponentWing = findPlayerByName(
      pregameOpponentPlayers,
      pregameBaseKeyMatchups.find(item => item.title === 'Wing csata')?.opponentPlayer
    );
    const opponentCenter = findPlayerByName(
      pregameOpponentPlayers,
      pregameBaseKeyMatchups.find(item => item.title === 'Center csata')?.opponentPlayer
    );

    const keyMatchups = [
      buildMatchup(
        'Irányító csata',
        assignedPg,
        opponentPg,
        (own, opponent) => {
          const ownMetrics = playerMetrics(own);
          const opponentMetrics = playerMetrics(opponent);
          const ownZone = buildZoneSnippet(own.playerId, ownFingerprints);
          const opponentZone = buildZoneSnippet(opponent.playerId, opponentFingerprints);
          return `${own.name} az ajánlott kezdőben elsődleges irányító; ${ownMetrics.valPer36.toFixed(1)} VAL/36 és ${ownMetrics.astTo.toFixed(2)} AST/TO, szemben ${opponent.name} ${opponentMetrics.valPer36.toFixed(1)} VAL/36-jával. ${ownZone ? `${own.name} profilja: ${ownZone}. ` : ''}${opponentZone ? `${opponent.name} profilja: ${opponentZone}.` : ''}`.trim();
        },
        (own, opponent, edge) => {
          const secondaryHandler = assignedSg && assignedSg.playerId !== own.playerId ? assignedSg.name : null;
          if (edge === 'opponent') {
            return `${opponent.name} szervezését első passzon kell lassítani; ${own.name} viszi az elsődleges labdás matchupot,${secondaryHandler ? ` ${secondaryHandler} pedig secondary ball-handlerként tehermentesítheti.` : ' a második labdás segítséget gyorsan mellé kell tenni.'}`;
          }
          return `${own.name} viszi az elsődleges irányítói ritmuskontrollt;${secondaryHandler ? ` ${secondaryHandler} secondary ball-handlerként támadhatja a switch-eket és leveheti róla a nyomást.` : ' a labdabiztonság és a tempókontroll tarthatja kézben a matchupot.'}`;
        }
      ),
      buildMatchup(
        'Wing csata',
        assignedWing,
        opponentWing,
        (own, opponent) => {
          const ownMetrics = playerMetrics(own);
          const opponentMetrics = playerMetrics(opponent);
          return `${own.name} ${ownMetrics.threePct.toFixed(1)}% 3P és ${ownMetrics.threeVolume.toFixed(1)} tripla/meccs mutatóval érkezik, szemben ${opponent.name} ${opponentMetrics.threePct.toFixed(1)}%-os triplájával. ${buildZoneSnippet(own.playerId, ownFingerprints) ? `${own.name}: ${buildZoneSnippet(own.playerId, ownFingerprints)}. ` : ''}${buildZoneSnippet(opponent.playerId, opponentFingerprints) ? `${opponent.name}: ${buildZoneSnippet(opponent.playerId, opponentFingerprints)}.` : ''}`.trim();
        },
        (own, opponent, edge) => edge === 'opponent'
          ? `${opponent.name} tiszta külső helyzeteit kell elvenni; a rotáló closeout és a második kilépés fontosabb, mint az izolált egyéni védekezés.`
          : `${own.name} előnye csak akkor vált pontelőnnyé, ha off-ball screen actionből és spacingből valóban megérkeznek a triplahelyzetek.`
      ),
      buildMatchup(
        'Center csata',
        assignedCenter,
        opponentCenter,
        (own, opponent) => {
          const ownMetrics = playerMetrics(own);
          const opponentMetrics = playerMetrics(opponent);
          return `${own.name} ${ownMetrics.valPer36.toFixed(1)} VAL/36 és ${ownMetrics.fgPct.toFixed(1)}% FG mutatóval áll szemben ${opponent.name} ${opponentMetrics.valPer36.toFixed(1)} VAL/36-os és ${opponentMetrics.fgPct.toFixed(1)}%-os profiljával.`;
        },
        (_own, opponent, edge) => edge === 'opponent'
          ? `${opponent.name} ellen korai segítség és gyengeoldali visszazárás kell; az izolált posztvédekezés önmagában kevés lehet.`
          : 'A korai belső érintések és a festékfizikalitás segíthetnek faultot generálni, de a visszarendeződésről nem lehet lemondani.'
      ),
    ].filter((item): item is NonNullable<typeof item> => Boolean(item));

    return keyMatchups.length > 0 ? keyMatchups : pregameBaseKeyMatchups;
  }, [pregameBaseKeyMatchups, pregameOpponentKeyPlayerFingerprints, pregameOpponentPlayers, pregameOptimalLineup, pregameOwnKeyPlayerFingerprints, pregameOwnPlayers, pregameReport]);

  const pregameVulnerabilityPlaybook = useMemo(() => {
    if (!pregameReport?.vulnerabilities.includes('Kevés büntető') || !pregameEfficiencyBaseline) return null;

    const ownFtRate = pregameEfficiencyBaseline.own.ftRatePct;
    const opponentFtRate = pregameEfficiencyBaseline.opponent.ftRatePct;
    const targetFta = Math.max(20, Math.round(pregameEfficiencyBaseline.own.fta));
    const pgName = pregameOptimalLineup?.best.roleAssignments.find(item => item.role === 'PG')?.name ?? null;
    const centerName = pregameOptimalLineup?.best.roleAssignments.find(item => item.role === 'C')?.name ?? null;
    const wingNames = pregameOptimalLineup?.best.roleAssignments
      .filter(item => item.role === 'SG' || item.role === 'SF')
      .map(item => item.name)
      .slice(0, 2) ?? [];

    return {
      title: 'Kevés büntető',
      ownFtRatePct: roundValue(ownFtRate, 1),
      opponentFtRatePct: roundValue(opponentFtRate, 1),
      targetFta,
      actions: [
        pgName ? `Agresszív festéktámadás ${pgName} drive-jaiból.` : 'Agresszív festéktámadás elsődleges labdás penetrációkból.',
        centerName ? `${centerName} korai belső érintései és duck-in post szituációi.` : 'Korai belső érintések és mély posztfoglalás.',
        wingNames.length > 0 ? `Drive-and-kick játék a festéksegítésből ${wingNames.join('/')} külső helyzeteihez.` : 'Drive-and-kick offense a help-védekezés büntetésére.',
      ],
      expectedImpact: `Ha a csapat eléri a ${targetFta}+ FTA-sávot, az várhatóan 4-6 pont extra stabilitást adhat a támadásoknak.`,
    };
  }, [pregameEfficiencyBaseline, pregameOptimalLineup, pregameReport]);

  const controlledScenarioGuidance = useMemo(() => {
    const controlledScenario = (pregameReport?.riskScenarios ?? []).find(item => item.title === 'Kontrollált alapforgatókönyv') ?? null;
    if (!controlledScenario) return null;

    const ownTeamLabel = pregameOwnTeam?.teamName ?? pregameReport?.ownTeamName ?? 'Saját csapat';
    const opponentTeamLabel = pregameOpponentTeam?.teamName ?? pregameReport?.opponentTeamName ?? 'Ellenfél';
    const centerName = pregameOptimalLineup?.best.roleAssignments.find(item => item.role === 'C')?.name ?? null;
    return {
      title: controlledScenario.title,
      triggers: [
        `${opponentTeamLabel} tripla-hatékonysága 35% alatt marad.`,
        `${ownTeamLabel} TO%-a 14% alatt marad.`,
        centerName ? `${centerName} legfeljebb 3 faulttal érkezik a negyedik negyedhez.` : 'A saját center nem kerül korai faultgondba.',
      ],
      response: [
        'Félpályás setup minden támadásban, a korai, előkészítetlen dobások visszafogásával.',
        'A kezdő ötös percterhelésének védelme, hogy a fő playmaking és spacing együtt maradjon.',
        'Timeout a spacing resethez és a labdás nyomás ritmusának megtörésére, nem az első apró futásnál.',
      ],
      expectedOutcome: 'Várható kimenet: szoros meccs a negyedik negyedig, nagyjából plusz-mínusz 5 ponton belül.',
    };
  }, [pregameOpponentTeam, pregameOptimalLineup, pregameOwnTeam, pregameReport]);

  const pregameSummaryTargets = useMemo(() => {
    const pgName = pregameOptimalLineup?.best.roleAssignments.find(item => item.role === 'PG')?.name ?? null;
    const wingName = pregameOptimalLineup?.best.roleAssignments.find(item => item.role === 'SG')?.name
      ?? pregameOptimalLineup?.best.roleAssignments.find(item => item.role === 'SF')?.name
      ?? null;

    return {
      closingLevers: [
        pgName ? `${pgName} labdabiztonsága és első passzos döntéshozatala` : null,
        wingName ? `${wingName} triplahelyzeteinek maximalizálása` : null,
        controlledScenarioGuidance?.expectedOutcome ?? null,
      ].filter((item): item is string => Boolean(item)),
    };
  }, [controlledScenarioGuidance, pregameOptimalLineup]);

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

  const kosarstatPostgameContext = useMemo(() => {
    const targetGame = selectedGameForPostgame;
    const teamName = selectedTeamNameForPostgame || '';
    if (!targetGame) {
      return {
        quarterDiffRows: [] as Array<{ quarter: number; ownPoints: number; oppPoints: number; diff: number; cumulativeDiff: number | null }>,
        ownMetrics: null as KosarstatTeamMetricRow | null,
        oppMetrics: null as KosarstatTeamMetricRow | null,
        clutch: null as PostgamePbpContext['clutch'] | null,
        turnoverTypes: [] as Array<{ type: string; count: number }>,
        strengths: [] as string[],
        problems: [] as string[],
        nextFocus: [] as string[],
        insightNotes: [] as string[],
      };
    }

    const ownSide = targetGame.homeAway === 'away' ? 'away' : 'home';
    const oppSide = ownSide === 'home' ? 'away' : 'home';
    const ownNeedle = normalizeTeamKey(teamName);

    const bySideOrName = <T extends { team_side?: 'home' | 'away' | 'unknown' | null; team_name?: string | null }>(
      rows: T[],
      side: 'home' | 'away'
    ) => {
      const bySide = rows.filter(row => row.team_side === side);
      if (bySide.length > 0) return bySide;
      if (!ownNeedle) return [] as T[];
      return rows.filter(row => normalizeTeamKey(String(row.team_name || '')).includes(ownNeedle));
    };

    const quarterRows = Array.isArray(kosarstatQuarterStats)
      ? kosarstatQuarterStats.filter(row => Number.isFinite(Number(row.quarter)) && Number(row.quarter) >= 1 && Number(row.quarter) <= 4)
      : [];
    const ownQuarterRows = bySideOrName(quarterRows, ownSide);
    const oppQuarterRowsBySide = quarterRows.filter(row => row.team_side === oppSide);
    const ownQuarterSet = new Set(ownQuarterRows.map(row => normalizeTeamKey(String(row.team_name || ''))).filter(Boolean));
    const oppQuarterRows = oppQuarterRowsBySide.length > 0
      ? oppQuarterRowsBySide
      : quarterRows.filter(row => {
          const nameKey = normalizeTeamKey(String(row.team_name || ''));
          return nameKey && !ownQuarterSet.has(nameKey);
        });

    const ownByQuarter = new Map<number, KosarstatQuarterStatRow>();
    ownQuarterRows.forEach(row => {
      const quarter = Number(row.quarter);
      if (!Number.isFinite(quarter) || ownByQuarter.has(quarter)) return;
      ownByQuarter.set(quarter, row);
    });
    const oppByQuarter = new Map<number, KosarstatQuarterStatRow>();
    oppQuarterRows.forEach(row => {
      const quarter = Number(row.quarter);
      if (!Number.isFinite(quarter) || oppByQuarter.has(quarter)) return;
      oppByQuarter.set(quarter, row);
    });

    const quarterDiffRows = [1, 2, 3, 4]
      .map(quarter => {
        const ownRow = ownByQuarter.get(quarter);
        const oppRow = oppByQuarter.get(quarter);
        const ownPoints = Number(ownRow?.points);
        const oppPoints = Number(oppRow?.points);
        if (!Number.isFinite(ownPoints) || !Number.isFinite(oppPoints)) return null;

        const ownCumulative = Number(ownRow?.cumulative_points);
        const oppCumulative = Number(oppRow?.cumulative_points);
        const cumulativeDiff = Number.isFinite(ownCumulative) && Number.isFinite(oppCumulative)
          ? roundValue(ownCumulative - oppCumulative, 0)
          : null;

        return {
          quarter,
          ownPoints: roundValue(ownPoints, 0),
          oppPoints: roundValue(oppPoints, 0),
          diff: roundValue(ownPoints - oppPoints, 0),
          cumulativeDiff,
        };
      })
      .filter((row): row is { quarter: number; ownPoints: number; oppPoints: number; diff: number; cumulativeDiff: number | null } => Boolean(row));

    const bestQuarter = quarterDiffRows.reduce<{ quarter: number; diff: number } | null>((best, row) => {
      if (!best || row.diff > best.diff) return { quarter: row.quarter, diff: row.diff };
      return best;
    }, null);
    const worstQuarter = quarterDiffRows.reduce<{ quarter: number; diff: number } | null>((worst, row) => {
      if (!worst || row.diff < worst.diff) return { quarter: row.quarter, diff: row.diff };
      return worst;
    }, null);
    const secondHalfDiff = quarterDiffRows
      .filter(row => row.quarter >= 3)
      .reduce((sum, row) => sum + row.diff, 0);

    const metricRows = Array.isArray(kosarstatTeamMetrics) ? kosarstatTeamMetrics : [];
    const ownMetric = bySideOrName(metricRows, ownSide)[0] ?? null;
    const oppMetric = metricRows.find(row => row.team_side === oppSide)
      ?? metricRows.find(row => {
        const nameKey = normalizeTeamKey(String(row.team_name || ''));
        const ownName = normalizeTeamKey(String(ownMetric?.team_name || ''));
        return nameKey && (!ownName || nameKey !== ownName);
      })
      ?? null;

    const strengths: string[] = [];
    const problems: string[] = [];
    const nextFocus: string[] = [];
    const insightNotes: string[] = [];

    if (bestQuarter && bestQuarter.diff >= 6) {
      strengths.push(`Negyed-szintű trend: a Q${bestQuarter.quarter} szakaszt ${bestQuarter.diff > 0 ? '+' : ''}${bestQuarter.diff} ponttal nyertük.`);
    }
    if (worstQuarter && worstQuarter.diff <= -6) {
      problems.push(`Negyed-szintű trend: a Q${worstQuarter.quarter} szakaszban ${worstQuarter.diff} pontos visszaesés jött.`);
      nextFocus.push(`Q${worstQuarter.quarter} szakasz kontrollja: azonnali válaszcsomag a rosszabb periódusokra.`);
    }

    if (quarterDiffRows.length >= 4) {
      if (secondHalfDiff <= -8) {
        problems.push(`Második félidős trend: Q3-Q4 összesítésben ${secondHalfDiff} pontot veszítettünk.`);
        nextFocus.push('Második félidős ritmus: rotáció és timeout időzítés stabilizálása.');
      } else if (secondHalfDiff >= 8) {
        strengths.push(`Második félidős trend: Q3-Q4 összesítésben ${secondHalfDiff > 0 ? '+' : ''}${secondHalfDiff} pontot nyertünk.`);
      }
    }

    const asNumber = (value: unknown) => {
      const num = Number(value);
      return Number.isFinite(num) ? num : null;
    };

    const ownEfg = asNumber(ownMetric?.efg);
    const oppEfg = asNumber(oppMetric?.efg);
    if (ownEfg !== null && oppEfg !== null) {
      const diff = roundValue(ownEfg - oppEfg, 1);
      if (diff >= 4) {
        strengths.push(`Kosarstat eFG különbség: ${diff > 0 ? '+' : ''}${diff} pp előny.`);
      } else if (diff <= -4) {
        problems.push(`Kosarstat eFG különbség: ${diff} pp hátrány.`);
        nextFocus.push('Dobásminőség: jobb spacing és magasabb minőségű első opciós dobások.');
      }
    }

    const ownTov = asNumber(ownMetric?.tov_pct);
    const oppTov = asNumber(oppMetric?.tov_pct);
    if (ownTov !== null && oppTov !== null) {
      const diff = roundValue(ownTov - oppTov, 1);
      if (diff <= -2) {
        strengths.push(`Labdabiztonság előny: TO% különbség ${diff} pp.`);
      } else if (diff >= 2) {
        problems.push(`Labdabiztonság hátrány: TO% különbség +${diff} pp.`);
        nextFocus.push('Labdavesztés-kontroll: első passzok és handoff döntések egyszerűsítése.');
      }
    }

    const ownOrb = asNumber(ownMetric?.orb_pct);
    const oppOrb = asNumber(oppMetric?.orb_pct);
    if (ownOrb !== null && oppOrb !== null) {
      const diff = roundValue(ownOrb - oppOrb, 1);
      if (diff >= 5) {
        strengths.push(`Második esély: ORB% különbség +${diff} pp.`);
      } else if (diff <= -5) {
        problems.push(`Lepattanó hátrány: ORB% különbség ${diff} pp.`);
        nextFocus.push('Védőlepattanó zárás: gyűrű alatti első kontakt és boxout fegyelem.');
      }
    }

    if (quarterDiffRows.length > 0) {
      const rowLabel = quarterDiffRows
        .map(row => `Q${row.quarter}: ${row.ownPoints}-${row.oppPoints}`)
        .join(', ');
      insightNotes.push(`Kosarstat negyedek: ${rowLabel}.`);
    }
    if (ownMetric || oppMetric) {
      insightNotes.push('Kosarstat team-metric blokk integrálva (POSS/ORTG/eFG/TO%/ORB%/FTM rate).');
    }

    const clutch = postgamePbpContext?.clutch ?? null;
    const turnoverTypes = postgamePbpContext?.turnoverTypes ?? [];

    if (!clutch?.available && kosarstatClutchImportNote) {
      insightNotes.push(kosarstatClutchImportNote);
    }

    if (clutch?.available) {
      if (clutch.diff >= 3) {
        strengths.push(`Clutch (utolsó 5 perc, <=5 pont): ${clutch.diff > 0 ? '+' : ''}${clutch.diff} pont.`);
      } else if (clutch.diff <= -3) {
        problems.push(`Clutch (utolsó 5 perc, <=5 pont): ${clutch.diff} pont.`);
        nextFocus.push('Clutch execution: utolsó 5 percben első opció és spacing előkészítése.');
      }

      if (clutch.ownTurnovers >= 2 && clutch.ownTurnovers > clutch.oppTurnovers) {
        problems.push(`Clutch labdaeladás: ${clutch.ownTurnovers}-${clutch.oppTurnovers} TO arány.`);
        nextFocus.push('Clutch labdakezelés: biztonsági első passz és handoff-szabályok.');
      }

      insightNotes.push(
        `Clutch minta: ${clutch.ownPoints}-${clutch.oppPoints} pont, TO ${clutch.ownTurnovers}-${clutch.oppTurnovers} (${clutch.sampleLabel}).`
      );
    }

    if (turnoverTypes.length > 0) {
      const label = turnoverTypes
        .slice(0, 3)
        .map(item => `${item.type} (${item.count})`)
        .join(', ');
      insightNotes.push(`TO típusbontás: ${label}.`);

      const top = turnoverTypes[0];
      if (top && top.count >= 2) {
        problems.push(`Visszatérő TO típus: ${top.type} (${top.count}).`);
        nextFocus.push(`TO célfókusz: ${top.type} helyzetek egyszerűsítése.`);
      }
    }

    return {
      quarterDiffRows,
      ownMetrics: ownMetric,
      oppMetrics: oppMetric,
      clutch,
      turnoverTypes,
      strengths,
      problems,
      nextFocus,
      insightNotes,
    };
  }, [kosarstatClutchImportNote, kosarstatQuarterStats, kosarstatTeamMetrics, postgamePbpContext, selectedGameForPostgame, selectedTeamNameForPostgame]);

  const postgameReport = useMemo<PostGameReport | null>(() => {
    if (!selectedGame || !selectedTeamStats || !postgameBenchmarks || !resolvedTeamId || resolvedTeamId === 'all') return null;

    const teamPlayers = playerGameStats.filter(row => row.game_id === selectedGame.id);

    const opponentPlayers = selectedGame.opponentGameId
      ? playerGameStats.filter(row => row.game_id === selectedGame.opponentGameId)
      : [];

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

    const activeLineupTeam =
      kosarstatLineupAnalysis?.selectedTeam ||
      kosarstatLineupAnalysis?.homeTeam ||
      kosarstatLineupAnalysis?.awayTeam ||
      null;

    const starterProfiles = (activeLineupTeam?.starters || [])
      .map(name => buildNormalizedNameProfile(name))
      .filter(profile => profile.key.length > 0);

    const players: PlayerGameStat[] = teamPlayers.map(row => {
      const seasonPlayer = seasonPlayers.find(player => String(player.id) === String(row.player_id));
      const fallbackName = row.players?.name?.trim();
      const resolvedName = seasonPlayer?.name || fallbackName || row.player_id;
      const explicitStarter = typeof row.is_starter === 'boolean' ? row.is_starter : undefined;
      const inferredStarter = starterProfiles.length > 0
        ? matchesNormalizedNameProfile(resolvedName, starterProfiles)
        : undefined;

      return {
        playerId: row.player_id,
        name: resolvedName,
        position: mapPosition(seasonPlayer?.position || 'PG'),
        isStarter: explicitStarter ?? inferredStarter,
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

    const baseReport = analyzePostGameReport(
      teamGame,
      opponentGame,
      seasonStats,
      postgameBenchmarks,
      players,
      alignedXFactorContext,
      postgameShotContext ?? undefined
    );

    const lineupInsights: PostGameReport['lineupInsights'] | undefined = (() => {
      if (!activeLineupTeam) return undefined;

      const validStints = activeLineupTeam.stints.filter(stint => stint.seconds > 0 && stint.players.length === 5);
      const totalSeconds = validStints.reduce((sum, stint) => sum + stint.seconds, 0);
      const totalMinutes = roundValue(totalSeconds / 60, 1);

      const withDerived = validStints.map(stint => ({
        ...stint,
        netPer40: stint.seconds > 0 ? roundValue((stint.plusMinus * 2400) / stint.seconds, 1) : 0,
      }));

      const minSampleSeconds = 180;
      const stableSample = withDerived.filter(stint => stint.seconds >= minSampleSeconds);
      const topPool = stableSample.length > 0 ? stableSample : withDerived;
      const topLineup = [...topPool].sort((a, b) => b.netPer40 - a.netPer40 || b.seconds - a.seconds)[0] || null;

      const bottomCandidates = [...topPool]
        .filter(stint => !topLineup || stint.players.join('|') !== topLineup.players.join('|'))
        .sort((a, b) => a.netPer40 - b.netPer40 || b.seconds - a.seconds);
      const bottomLineup = bottomCandidates[0] || null;

      const pairPool = activeLineupTeam.pairStats.filter(item => item.seconds >= minSampleSeconds);
      const topPairSource = (pairPool.length > 0 ? pairPool : activeLineupTeam.pairStats)
        .slice()
        .sort((a, b) => b.netPer40 - a.netPer40 || b.seconds - a.seconds)[0] || null;

      const implications: string[] = [];
      if (topLineup && topLineup.netPer40 >= 6) {
        implications.push(`A legeredményesebb ötös (${topLineup.players.join(', ')}) jó ritmust hozott (${topLineup.netPer40.toFixed(1)} net/40), ezért érdemes ezt a felállást tudatosabban és korábban bevonni a rotációba.`);
      }
      if (bottomLineup && bottomLineup.netPer40 <= -6) {
        implications.push(`A kevésbé működő ötös (${bottomLineup.players.join(', ')}) ebben a meccsképben nehezebben találta az előnyöket (${bottomLineup.netPer40.toFixed(1)} net/40), ezért ellenfélfüggő szerep- vagy párosítási finomhangolás javasolt.`);
      }
      if (topLineup && bottomLineup) {
        const spread = roundValue(topLineup.netPer40 - bottomLineup.netPer40, 1);
        if (spread >= 10) {
          implications.push(`Jelentős különbség látszott az ötösök között (${spread.toFixed(1)} net/40), emiatt a csereegységek időzítése és szerkezete fontos meccsfaktor lehetett.`);
        }
      }
      if (topPairSource && topPairSource.netPer40 >= 6) {
        implications.push(`A legerősebb páros (${topPairSource.players.join(' + ')}) együtt stabilabban termelte az előnyt, ezért célszerű tudatosan közös perceket adni nekik.`);
      }
      if (totalMinutes < 12) {
        implications.push('A lineup minta korlátozott játékidőből áll össze, ezért az értékelés irányadó, de nem végleges ítélet.');
      }

      return {
        available: validStints.length > 0,
        totalStints: validStints.length,
        totalMinutes,
        topLineup: topLineup
          ? {
              players: topLineup.players,
              minutes: roundValue(topLineup.seconds / 60, 1),
              plusMinus: topLineup.plusMinus,
              netPer40: topLineup.netPer40,
            }
          : null,
        bottomLineup: bottomLineup
          ? {
              players: bottomLineup.players,
              minutes: roundValue(bottomLineup.seconds / 60, 1),
              plusMinus: bottomLineup.plusMinus,
              netPer40: bottomLineup.netPer40,
            }
          : null,
        topPair: topPairSource
          ? {
              players: topPairSource.players,
              minutes: roundValue(topPairSource.seconds / 60, 1),
              netPer40: roundValue(topPairSource.netPer40, 1),
            }
          : null,
        implications,
      };
    })();

    const mergeUnique = (base: string[], extra: string[]) => {
      const out: string[] = [];
      const seen = new Set<string>();

      [...base, ...extra].forEach(item => {
        const normalized = item.trim().toLowerCase();
        if (!normalized || seen.has(normalized)) return;
        seen.add(normalized);
        out.push(item);
      });

      return out;
    };

    if (
      kosarstatPostgameNotes.length === 0 &&
      !lineupInsights &&
      kosarstatPostgameContext.strengths.length === 0 &&
      kosarstatPostgameContext.problems.length === 0 &&
      kosarstatPostgameContext.nextFocus.length === 0 &&
      kosarstatPostgameContext.insightNotes.length === 0
    ) {
      return baseReport;
    }

    return {
      ...baseReport,
      dataNotes: mergeUnique(baseReport.dataNotes, [...kosarstatPostgameNotes, ...kosarstatPostgameContext.insightNotes]),
      strengths: mergeUnique(baseReport.strengths, kosarstatPostgameContext.strengths),
      problems: mergeUnique(baseReport.problems, kosarstatPostgameContext.problems),
      nextFocus: mergeUnique(baseReport.nextFocus, kosarstatPostgameContext.nextFocus),
      lineupInsights,
    };
  }, [kosarstatLineupAnalysis, kosarstatPostgameContext, kosarstatPostgameNotes, league, playerGameStats, postgameBenchmarks, postgameShotContext, pregameReport, rolesByPlayerId, seasonPlayers, selectedGame, resolvedTeamId, selectedTeamStats]);

  const activeKosarstatTeamAnalysis = useMemo(() => {
    if (!kosarstatLineupAnalysis) return null;
    return kosarstatLineupAnalysis.selectedTeam || kosarstatLineupAnalysis.homeTeam || kosarstatLineupAnalysis.awayTeam;
  }, [kosarstatLineupAnalysis]);

  const comboPlayerOptions = useMemo(() => {
    if (!activeKosarstatTeamAnalysis) return [] as string[];
    const names = new Set<string>();
    activeKosarstatTeamAnalysis.playerMinutes.forEach(item => names.add(item.player));
    activeKosarstatTeamAnalysis.stints.forEach(stint => stint.players.forEach(player => names.add(player)));
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'hu'));
  }, [activeKosarstatTeamAnalysis]);

  const lineupPositionOptions = useMemo(() => {
    if (!activeKosarstatTeamAnalysis) {
      return {
        pg: [] as string[],
        sg: [] as string[],
        sf: [] as string[],
        pf: [] as string[],
        c: [] as string[],
      };
    }

    const pg = new Set<string>();
    const sg = new Set<string>();
    const sf = new Set<string>();
    const pf = new Set<string>();
    const c = new Set<string>();

    activeKosarstatTeamAnalysis.stints.forEach(stint => {
      if (stint.players[0]) pg.add(stint.players[0]);
      if (stint.players[1]) sg.add(stint.players[1]);
      if (stint.players[2]) sf.add(stint.players[2]);
      if (stint.players[3]) pf.add(stint.players[3]);
      if (stint.players[4]) c.add(stint.players[4]);
    });

    const sorter = (a: string, b: string) => a.localeCompare(b, 'hu');
    return {
      pg: Array.from(pg).sort(sorter),
      sg: Array.from(sg).sort(sorter),
      sf: Array.from(sf).sort(sorter),
      pf: Array.from(pf).sort(sorter),
      c: Array.from(c).sort(sorter),
    };
  }, [activeKosarstatTeamAnalysis]);

  useEffect(() => {
    if (lineupPgFilter !== LINEUP_FILTER_ALL && !lineupPositionOptions.pg.includes(lineupPgFilter)) {
      setLineupPgFilter(LINEUP_FILTER_ALL);
    }
    if (lineupSgFilter !== LINEUP_FILTER_ALL && !lineupPositionOptions.sg.includes(lineupSgFilter)) {
      setLineupSgFilter(LINEUP_FILTER_ALL);
    }
    if (lineupSfFilter !== LINEUP_FILTER_ALL && !lineupPositionOptions.sf.includes(lineupSfFilter)) {
      setLineupSfFilter(LINEUP_FILTER_ALL);
    }
    if (lineupPfFilter !== LINEUP_FILTER_ALL && !lineupPositionOptions.pf.includes(lineupPfFilter)) {
      setLineupPfFilter(LINEUP_FILTER_ALL);
    }
    if (lineupCFilter !== LINEUP_FILTER_ALL && !lineupPositionOptions.c.includes(lineupCFilter)) {
      setLineupCFilter(LINEUP_FILTER_ALL);
    }
  }, [
    LINEUP_FILTER_ALL,
    lineupPgFilter,
    lineupSgFilter,
    lineupSfFilter,
    lineupPfFilter,
    lineupCFilter,
    lineupPositionOptions,
  ]);

  const filteredFiveManLineups = useMemo(() => {
    if (!activeKosarstatTeamAnalysis) {
      return [] as Array<
        KosarstatLineupStint & {
          pg: string;
          sg: string;
          sf: string;
          pf: string;
          c: string;
        }
      >;
    }

    return activeKosarstatTeamAnalysis.stints
      .map(stint => ({
        ...stint,
        pg: stint.players[0] || '',
        sg: stint.players[1] || '',
        sf: stint.players[2] || '',
        pf: stint.players[3] || '',
        c: stint.players[4] || '',
      }))
      .filter(stint => {
        if (lineupAnyPlayerFilter !== LINEUP_FILTER_ALL && !stint.players.includes(lineupAnyPlayerFilter)) {
          return false;
        }
        if (lineupPgFilter !== LINEUP_FILTER_ALL && stint.pg !== lineupPgFilter) return false;
        if (lineupSgFilter !== LINEUP_FILTER_ALL && stint.sg !== lineupSgFilter) return false;
        if (lineupSfFilter !== LINEUP_FILTER_ALL && stint.sf !== lineupSfFilter) return false;
        if (lineupPfFilter !== LINEUP_FILTER_ALL && stint.pf !== lineupPfFilter) return false;
        if (lineupCFilter !== LINEUP_FILTER_ALL && stint.c !== lineupCFilter) return false;
        return true;
      })
      .sort((a, b) => b.seconds - a.seconds || b.plusMinus - a.plusMinus);
  }, [
    LINEUP_FILTER_ALL,
    activeKosarstatTeamAnalysis,
    lineupAnyPlayerFilter,
    lineupPgFilter,
    lineupSgFilter,
    lineupSfFilter,
    lineupPfFilter,
    lineupCFilter,
  ]);

  const selectedComboStat = useMemo(() => {
    if (!activeKosarstatTeamAnalysis) return null;
    const source = selectedComboSize === 2 ? activeKosarstatTeamAnalysis.pairStats : activeKosarstatTeamAnalysis.trioStats;
    const selectedPlayers = [selectedComboPlayerA, selectedComboPlayerB, selectedComboPlayerC]
      .slice(0, selectedComboSize)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'hu'));

    if (selectedPlayers.length !== selectedComboSize) return null;
    const key = selectedPlayers.join(' | ');
    return source.find(item => item.key === key) || null;
  }, [activeKosarstatTeamAnalysis, selectedComboPlayerA, selectedComboPlayerB, selectedComboPlayerC, selectedComboSize]);

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

    const normalizeTopic = (text: string) => {
      const lower = text.toLowerCase();
      if (lower.includes('ft rate') || lower.includes('büntető')) return 'ft';
      if (lower.includes('to ') || lower.includes('turnover') || lower.includes('labdaeladás')) return 'to';
      if (lower.includes('oreb') || lower.includes('második esély') || lower.includes('lepattanó')) return 'oreb';
      if (lower.includes('3p') || lower.includes('periméter')) return 'perimeter';
      return lower.replace(/\s+/g, ' ').trim();
    };

    const pushUniqueByTopic = (arr: string[], candidate: string) => {
      const topic = normalizeTopic(candidate);
      if (arr.some(item => normalizeTopic(item) === topic)) return;
      arr.push(candidate);
    };

    const topicPriority = (text: string) => {
      const topic = normalizeTopic(text);
      if (topic === 'to') return 1;
      if (topic === 'ft') return 2;
      if (topic === 'perimeter') return 3;
      if (topic === 'oreb') return 4;
      return 9;
    };

    const factorHint = opponentLinkedBreakdown[0]?.detail;
    const focus: string[] = [];

    postgameReport.nextFocus.forEach(item => {
      pushUniqueByTopic(focus, item);
    });

    kosarstatPostgameContext.nextFocus.forEach(item => {
      pushUniqueByTopic(focus, item);
    });

    if (factorHint) {
      focus.unshift(`Ellenfél-specifikus fókusz: ${factorHint}.`);
    }

    if (postgameReport.problems.length > 0) {
      pushUniqueByTopic(focus, `Mérkőzés utáni javítás: ${postgameReport.problems[0]}.`);
    }

    if (kosarstatPostgameContext.problems.length > 0) {
      pushUniqueByTopic(focus, `Kosarstat javítási pont: ${kosarstatPostgameContext.problems[0]}`);
    }

    return focus
      .sort((a, b) => topicPriority(a) - topicPriority(b))
      .slice(0, 3);
  }, [kosarstatPostgameContext.nextFocus, kosarstatPostgameContext.problems, opponentLinkedBreakdown, postgameReport]);

  const displayedPostgameStrengths = useMemo(() => {
    if (!postgameReport) return [] as string[];
    if (showKosarstatOnlyPostgame) return kosarstatPostgameContext.strengths;
    return postgameReport.strengths;
  }, [kosarstatPostgameContext.strengths, postgameReport, showKosarstatOnlyPostgame]);

  const displayedPostgameProblems = useMemo(() => {
    if (!postgameReport) return [] as string[];
    if (showKosarstatOnlyPostgame) return kosarstatPostgameContext.problems;
    return postgameReport.problems;
  }, [kosarstatPostgameContext.problems, postgameReport, showKosarstatOnlyPostgame]);

  const displayedPostgameFocus = useMemo(() => {
    if (!postgameReport) return [] as string[];
    if (!showKosarstatOnlyPostgame) return nextGameAutoFocus;

    const focus = [...kosarstatPostgameContext.nextFocus];
    if (focus.length === 0 && kosarstatPostgameContext.problems.length > 0) {
      focus.push(`Kosarstat javítási pont: ${kosarstatPostgameContext.problems[0]}`);
    }
    return focus.slice(0, 3);
  }, [kosarstatPostgameContext.nextFocus, kosarstatPostgameContext.problems, nextGameAutoFocus, postgameReport, showKosarstatOnlyPostgame]);

  const enrichedTeamAnalysis = useMemo<TeamAnalysis | null>(() => {
    if (!displayTeamAnalysis) return null;

    const sampleLabel = (minutes: number): 'alacsony' | 'kozepes' | 'magas' => {
      if (minutes >= 20) return 'magas';
      if (minutes >= 10) return 'kozepes';
      return 'alacsony';
    };

    const activeSelectedTeamPlayerProfiles = allPlayers
      .filter(player => String(player.seasonId ?? '') === String(resolvedSeasonId))
      .filter(player => player.isActive !== false)
      .filter(player => String(player.teamId ?? '') === String(resolvedTeamId))
      .map(player => buildNormalizedNameProfile(player.name || ''))
      .filter(profile => Boolean(profile.key));

    const lineupSupportSource = seasonKosarstatLineupTeam ?? activeKosarstatTeamAnalysis;
    const stints = (lineupSupportSource?.stints ?? []).filter(stint => {
      if (activeSelectedTeamPlayerProfiles.length === 0) return true;
      return (stint.players ?? []).every(player => matchesNormalizedNameProfile(player, activeSelectedTeamPlayerProfiles));
    });
    const pairStats = (lineupSupportSource?.pairStats ?? []).filter(item => {
      if (activeSelectedTeamPlayerProfiles.length === 0) return true;
      return (item.players ?? []).every(player => matchesNormalizedNameProfile(player, activeSelectedTeamPlayerProfiles));
    });

    const validStints = stints
      .map(stint => ({
        ...stint,
        minutes: roundValue((stint.seconds || 0) / 60, 1),
        netPer40: Number.isFinite(Number(stint.on40)) ? Number(stint.on40) : null,
      }))
      .filter(stint => (stint.seconds || 0) >= 90 && stint.netPer40 !== null);

    const lineupRankingStints = validStints.filter(stint => (stint.seconds || 0) >= 180);

    const sortedStints = [...lineupRankingStints].sort((a, b) => Number(b.netPer40) - Number(a.netPer40));
    const topLineupRaw = sortedStints[0] ?? null;
    const bottomLineupRaw = sortedStints.length > 1 ? sortedStints[sortedStints.length - 1] : null;

    const validPairs = pairStats
      .map(item => ({
        ...item,
        minutes: roundValue((item.seconds || 0) / 60, 1),
      }))
      .filter(item => (item.seconds || 0) >= 90 && Number.isFinite(Number(item.netPer40)));

    const topPairRaw = [...validPairs].sort((a, b) => Number(b.netPer40) - Number(a.netPer40))[0] ?? null;
    const bottomPairRaw = [...validPairs].sort((a, b) => Number(a.netPer40) - Number(b.netPer40))[0] ?? null;

    let cumulativeSeconds = 0;
    let rotationBreakpoint: {
      minute: number | null;
      trigger: string;
      netDropPer40: number;
      confidence: 'alacsony' | 'kozepes' | 'magas';
    } | null = null;

    for (let i = 1; i < validStints.length; i += 1) {
      const prev = validStints[i - 1];
      const curr = validStints[i];
      cumulativeSeconds += prev.seconds || 0;
      if (prev.netPer40 === null || curr.netPer40 === null) continue;
      const drop = Number(prev.netPer40) - Number(curr.netPer40);
      if (drop < 8) continue;

      const prevPlayers = new Set(prev.players || []);
      const currPlayers = new Set(curr.players || []);
      const left = Array.from(prevPlayers).filter(player => !currPlayers.has(player));
      const entered = Array.from(currPlayers).filter(player => !prevPlayers.has(player));
      const trigger = entered.length > 0 || left.length > 0
        ? `be: ${entered.join(', ') || '-'} | ki: ${left.join(', ') || '-'}`
        : 'ötösváltás';
      const sampleMinutes = roundValue(((prev.seconds || 0) + (curr.seconds || 0)) / 60, 1);
      const confidence: 'alacsony' | 'kozepes' | 'magas' = sampleMinutes >= 14 ? 'magas' : sampleMinutes >= 8 ? 'kozepes' : 'alacsony';

      if (!rotationBreakpoint || drop > rotationBreakpoint.netDropPer40) {
        rotationBreakpoint = {
          minute: roundValue(cumulativeSeconds / 60, 1),
          trigger,
          netDropPer40: roundValue(drop, 1),
          confidence,
        };
      }
    }

    const clutch = seasonKosarstatClutch ?? kosarstatPostgameContext.clutch;

    const clutchProfile: NonNullable<TeamAnalysis['clutchProfile']> = {
      available: Boolean(clutch?.available),
      sampleSize: clutch?.sampleSize ?? 0,
      sampleLabel: clutch?.sampleLabel ?? null,
      ortg: clutch?.ortg ?? null,
      drtg: clutch?.drtg ?? null,
      net: clutch?.net ?? null,
      tovPct: clutch?.tovPct ?? null,
      rebPct: clutch?.rebPct ?? null,
      ftRate: clutch?.ftRate ?? null,
      topUsageClosers: clutch?.topUsageClosers ?? [],
      assistToTurnover: clutch?.assistToTurnover ?? null,
      notes: clutch?.available
        ? [
            `Kosarstat clutch stat blokkból számolva (${clutch.sampleLabel}${seasonKosarstatClutchGames > 0 ? `, ${seasonKosarstatClutchGames} meccs` : ''}).`,
            'Lezáró profil a clutch usage-share alapján.'
          ]
        : [
            'Nincs elegendő Kosarstat clutch minta a szezonprofilhoz.',
            teamFormSummary && Math.abs(teamFormSummary.marginAvg) >= 10
              ? 'Az utóbbi minta nagy különbségű meccseket jelez, ezért kevés a valódi végjáték-szituáció.'
              : 'Végjáték-protokollt proxy alapon érdemes kezelni (ATO, első passz, fault-management).'
          ],
    };

    const shotMapZones = teamSeasonShotSummary
      ? ([
          { key: 'rim', label: 'Gyűrű' },
          { key: 'paint', label: 'Festék' },
          { key: 'mid', label: 'Középtáv' },
          { key: 'corner3', label: 'Sarok tripla' },
          { key: 'aboveBreak3', label: 'Egyéb tripla' },
        ] as const).map(zone => {
          const total = Math.max(1, teamSeasonShotSummary.attempts);
          const zoneStats = teamSeasonShotSummary.zoneStats[zone.key];
          const relative = teamLeagueRelativeZoneRows.find(row => row.label === zone.label);
          return {
            key: zone.key,
            label: zone.label,
            rate: roundValue((zoneStats.attempts / total) * 100, 1),
            pct: roundValue(zoneStats.pct, 1),
            rateDeltaVsLeague: relative?.rateDelta ?? 0,
            pctDeltaVsLeague: relative?.pctDelta ?? 0,
            rateDeltaVsSeason: 0,
            pctDeltaVsSeason: 0,
          };
        })
      : [];

    const shotMapNotes = (() => {
      if (shotMapZones.length === 0) return ['Nincs szezon shot map adat.'];
      const notes: string[] = [];
      const bestEfficiency = [...shotMapZones].sort((a, b) => b.pctDeltaVsLeague - a.pctDeltaVsLeague)[0];
      const underusedPositive = shotMapZones.find(zone => zone.pctDeltaVsLeague >= 2 && zone.rate >= 6 && zone.rateDeltaVsLeague <= -1.5);
      const overusedWeak = shotMapZones.find(zone => zone.rate >= 6 && zone.rateDeltaVsLeague >= 1.5 && zone.pctDeltaVsLeague <= -2);

      if (bestEfficiency && bestEfficiency.pctDeltaVsLeague >= 2) {
        notes.push(`${bestEfficiency.label}: kiemelt hatékonysági zóna (${bestEfficiency.pctDeltaVsLeague >= 0 ? '+' : ''}${bestEfficiency.pctDeltaVsLeague.toFixed(1)} pp liga felett).`);
      }
      if (underusedPositive) {
        notes.push(`${underusedPositive.label}: jó minőségű, de alulhasznált zóna; volumen emelhető.`);
      }
      if (overusedWeak) {
        notes.push(`${overusedWeak.label}: a volumen magasabb, mint amit a hatékonyság indokol.`);
      }
      if (notes.length === 0) {
        notes.push('A shot profile kiegyensúlyozott, nincs extrém túlhúzott vagy alulhasznált zóna.');
      }
      return notes;
    })();

    const shotMapProfile: NonNullable<TeamAnalysis['shotMapProfile']> = {
      available: Boolean(teamSeasonShotSummary),
      zones: shotMapZones,
      offenseQualityIndex: teamSeasonShotSummary
        ? roundValue(
            teamSeasonShotSummary.zoneStats.rim.pct * 0.32
            + teamSeasonShotSummary.zoneStats.corner3.pct * 0.25
            + teamSeasonShotSummary.zoneStats.aboveBreak3.pct * 0.18
            - teamSeasonShotSummary.zoneStats.mid.pct * 0.12,
            1
          )
        : null,
      allowedQualityIndex: null,
      notes: shotMapNotes,
    };

    const formProfile: NonNullable<TeamAnalysis['formProfile']> = teamFormSummary
      ? {
          available: true,
          trendLabel: teamFormSummary.badgeLabel,
          volatilityIndex: teamFormSummary.volatilityIndex,
          volatilityLabel: teamFormSummary.volatilityIndex >= 80
            ? 'Extrém volatilis'
            : teamFormSummary.volatilityIndex >= 60
              ? 'Erősen ingadozó'
              : teamFormSummary.volatilityIndex >= 35
                ? 'Mérsékelten ingadozó'
                : 'Stabilabb profil',
          notes: [
            `${teamFormSummary.badgeLabel}: margin ${teamFormSummary.marginAvg >= 0 ? '+' : ''}${teamFormSummary.marginAvg.toFixed(1)} a szezon ${teamFormSummary.seasonMargin >= 0 ? '+' : ''}${teamFormSummary.seasonMargin.toFixed(1)} értékéhez képest.`,
            `Volatilitás ${teamFormSummary.volatilityIndex.toFixed(1)}/100, eFG szórás ${teamFormSummary.efgStd.toFixed(1)}, TS szórás ${teamFormSummary.tsStd.toFixed(1)}, TO szórás ${teamFormSummary.tovStdPct.toFixed(1)} pp.`,
          ],
        }
      : {
          available: false,
          trendLabel: 'Nincs formaadat',
          volatilityIndex: null,
          volatilityLabel: null,
          notes: ['Nincs elegendő forma minta.'],
        };

    const enrichedSummary = [
      displayTeamAnalysis.summary,
      formProfile.available && formProfile.volatilityLabel
        ? `Forma-kiegészítés: ${formProfile.trendLabel}, ${formProfile.volatilityLabel.toLowerCase()} profillal.`
        : null,
      !clutchProfile.available
        ? 'Clutch-kiegészítés: a végjáték minta alacsony, ezért a protokollok stabilizálása fontosabb, mint a visszaolvasott clutch számok.'
        : null,
      shotMapProfile.notes[0] ?? null,
    ].filter((item): item is string => Boolean(item)).join(' ');

    const avgNetPer40 = validStints.length > 0
      ? average(validStints.map(item => Number(item.netPer40 || 0)))
      : null;

    const selectedTeamKey = normalizeTeamKey(displayTeamAnalysis.teamName);
    const scheduleStrength = selectedTeamKey
      ? scheduleStrengthByTeamKey.get(selectedTeamKey) ?? null
      : null;
    const sosWeight = scheduleStrength !== null ? roundValue(1 + scheduleStrength.combined * 0.08, 3) : null;

    const impactProfile: NonNullable<TeamAnalysis['impactProfile']> = {
      available: validStints.length > 0,
      bestNetPer40: topLineupRaw?.netPer40 !== null && topLineupRaw?.netPer40 !== undefined ? roundValue(Number(topLineupRaw.netPer40), 1) : null,
      worstNetPer40: bottomLineupRaw?.netPer40 !== null && bottomLineupRaw?.netPer40 !== undefined ? roundValue(Number(bottomLineupRaw.netPer40), 1) : null,
      adjustedNetPer40: avgNetPer40 !== null
        ? roundValue(avgNetPer40 * (sosWeight ?? 1), 1)
        : null,
      sosWeight,
      garbageTimeFiltered: true,
      sampleMinutes: roundValue(validStints.reduce((sum, item) => sum + item.minutes, 0), 1),
      notes: [
        'Possession-normalizált net/40 alkalmazva.',
        'Egyszerű SOS súly beépítve (schedule-strength alapján).',
        'Alacsony játékidejű stintek kiszűrve.'
      ],
    };

    const actionableFocus = [
      rotationBreakpoint
        ? `Rotációs töréspont kezelése: ~${rotationBreakpoint.minute ?? 0}. perc, ${rotationBreakpoint.trigger} után -${rotationBreakpoint.netDropPer40} net/40.`
        : null,
      topPairRaw && bottomPairRaw
        ? `Páros menedzsment: ${topPairRaw.players.join(' + ')} (${roundValue(Number(topPairRaw.netPer40), 1)} net/40) priorizálása, ${bottomPairRaw.players.join(' + ')} limitálása.`
        : null,
      clutch?.available
        ? `Clutch fókusz: utolsó 5 percben TO kontroll (${clutch.ownTurnovers}-${clutch.oppTurnovers}) és első opciós spacing.`
        : 'Clutch minta alacsony: végjáték protokollok stabilizálása (ATO, első passz, fault-management).',
      formProfile.available && formProfile.volatilityIndex !== null && formProfile.volatilityIndex >= 60
        ? `Forma-stabilizálás: a magas volatilitás (${formProfile.volatilityIndex.toFixed(1)}/100) miatt kell egy biztosabb B-terv félpályán.`
        : null,
      shotMapNotes[1] ?? null,
    ].filter((item): item is string => Boolean(item)).slice(0, 4);

    return {
      ...displayTeamAnalysis,
      summary: enrichedSummary,
      formProfile,
      clutchProfile,
      shotMapProfile,
      lineupProfile: {
        available: validStints.length > 0,
        topLineup: topLineupRaw
          ? {
              players: topLineupRaw.players,
              minutes: topLineupRaw.minutes,
              netPer40: roundValue(Number(topLineupRaw.netPer40), 1),
              sampleLabel: sampleLabel(topLineupRaw.minutes),
            }
          : null,
        bottomLineup: bottomLineupRaw
          ? {
              players: bottomLineupRaw.players,
              minutes: bottomLineupRaw.minutes,
              netPer40: roundValue(Number(bottomLineupRaw.netPer40), 1),
              sampleLabel: sampleLabel(bottomLineupRaw.minutes),
            }
          : null,
        topPair: topPairRaw
          ? {
              players: topPairRaw.players,
              minutes: topPairRaw.minutes,
              netPer40: roundValue(Number(topPairRaw.netPer40), 1),
              sampleLabel: sampleLabel(topPairRaw.minutes),
            }
          : null,
        bottomPair: bottomPairRaw
          ? {
              players: bottomPairRaw.players,
              minutes: bottomPairRaw.minutes,
              netPer40: roundValue(Number(bottomPairRaw.netPer40), 1),
              sampleLabel: sampleLabel(bottomPairRaw.minutes),
            }
          : null,
        rotationBreakpoint,
        notes: validStints.length > 0
            ? [`Lineup alapú döntéstámogatás aktív (Kosarstat stints + pair stats${seasonKosarstatLineupGames > 0 ? `, ${seasonKosarstatLineupGames} meccs` : ''}).`]
          : ['Nincs elegendő lineup minta a döntéstámogatáshoz.'],
      },
      impactProfile,
      actionableFocus,
    };
  }, [
    allPlayers,
    activeKosarstatTeamAnalysis,
    displayTeamAnalysis,
    kosarstatPostgameContext,
    resolvedSeasonId,
    resolvedTeamId,
    scheduleStrengthByTeamKey,
    seasonKosarstatClutch,
    seasonKosarstatClutchGames,
    seasonKosarstatLineupGames,
    seasonKosarstatLineupTeam,
    teamFormSummary,
    teamLeagueRelativeZoneRows,
    teamSeasonShotSummary,
  ]);

  const effectiveTeamAnalysis = enrichedTeamAnalysis ?? displayTeamAnalysis;

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
          fill="var(--text-primary)"
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
          headToHeadSummary: pregameHeadToHeadSummary,
          keyMatchups: pregameKeyMatchups,
          focusPriority: {
            pressure: pregamePressureWeight,
            perimeter: pregamePerimeterWeight,
            paint: Math.max(0, 100 - pregamePressureWeight - pregamePerimeterWeight),
          },
          extraContext: {
            lineupContext: pregameOptimalLineup ? {
              recommendedLineup: pregameOptimalLineup.best.roleAssignments,
              primaryHandler: pregameOptimalLineup.best.roleAssignments.find(item => item.role === 'PG')?.name ?? null,
              secondaryHandler: pregameOptimalLineup.best.roleAssignments.find(item => item.role === 'SG')?.name ?? null,
            } : null,
            vulnerabilityPlaybook: pregameVulnerabilityPlaybook,
            headToHeadInsight: pregameHeadToHeadInsight,
            scenarioGuidance: controlledScenarioGuidance,
            summaryTargets: pregameSummaryTargets,
          },
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
          stylePreset: textReportStyle,
          pregameReport,
          postgameReport,
          generatedBy: `season-comparison-ui:${textReportStyle}`,
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
    if (!effectiveTeamAnalysis || !resolvedSeasonId || !resolvedTeamId || resolvedTeamId === 'all') return;

    setIsGeneratingTeamNarrative(true);
    setTeamNarrative({ status: 'loading' });

    try {
      const response = await fetch('/api/generate-team-analysis-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonId: resolvedSeasonId,
          teamId: resolvedTeamId,
          teamName: effectiveTeamAnalysis.teamName,
          stylePreset: teamNarrativeStyle,
          teamAnalysis: effectiveTeamAnalysis,
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
          advancedStats: playerAdvancedLlmContext,
          seasonSummary: playerSeasonOverview,
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
            advancedStats: playerAdvancedLlmContext,
            seasonSummary: playerSeasonOverview,
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

  const handleGenerateAllPlayerNarratives = async () => {
    if (!postgameReport?.playerReport?.players?.length) return;
    setIsGeneratingAllPlayerNarratives(true);
    await Promise.all(postgameReport.playerReport.players.map(p => handleGeneratePlayerNarrative(p.playerId)));
    setIsGeneratingAllPlayerNarratives(false);
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

  const playerAdvancedInsights = useMemo(() => {
    if (!selectedPlayer || !analysis) return null;

    const asPct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0);
    const safeNum = (value: number | null | undefined) => (Number.isFinite(Number(value)) ? Number(value) : 0);
    const confidenceFromSample = (sample: number, medium: number, high: number): 'alacsony' | 'kozepes' | 'magas' => {
      if (sample >= high) return 'magas';
      if (sample >= medium) return 'kozepes';
      return 'alacsony';
    };
    const shotInterpretation = (valueAdd: number | null): 'jobb mint varhato' | 'varhato szint' | 'varakozas alatt' | 'n/a' => {
      if (valueAdd === null) return 'n/a';
      if (valueAdd >= 1.5) return 'jobb mint varhato';
      if (valueAdd <= -1.5) return 'varakozas alatt';
      return 'varhato szint';
    };
    const matchupInterpretation = (tsDelta: number | null): 'ellenall' | 'semleges' | 'erzekeny' | 'n/a' => {
      if (tsDelta === null) return 'n/a';
      if (tsDelta >= -1.5) return 'ellenall';
      if (tsDelta <= -4) return 'erzekeny';
      return 'semleges';
    };
    const gradeHigherBetter = (value: number | null, goodAtOrAbove: number, riskBelow: number): 'good' | 'neutral' | 'risk' | 'na' => {
      if (value === null || !Number.isFinite(value)) return 'na';
      if (value >= goodAtOrAbove) return 'good';
      if (value < riskBelow) return 'risk';
      return 'neutral';
    };
    const gradeLowerBetter = (value: number | null, goodAtOrBelow: number, riskAbove: number): 'good' | 'neutral' | 'risk' | 'na' => {
      if (value === null || !Number.isFinite(value)) return 'na';
      if (value <= goodAtOrBelow) return 'good';
      if (value > riskAbove) return 'risk';
      return 'neutral';
    };
    const positionProfile = (() => {
      if (analysis.position === 'PG' || analysis.position === 'SG') {
        return {
          decisionGood: 64,
          decisionRisk: 52,
          stabilityGood: 18,
          stabilityRisk: 30,
          fatigueGoodDrop: -0.8,
          fatigueRiskDrop: -2.6,
        };
      }
      if (analysis.position === 'SF') {
        return {
          decisionGood: 60,
          decisionRisk: 50,
          stabilityGood: 17,
          stabilityRisk: 29,
          fatigueGoodDrop: -1.0,
          fatigueRiskDrop: -3.0,
        };
      }
      return {
        decisionGood: 58,
        decisionRisk: 48,
        stabilityGood: 16,
        stabilityRisk: 28,
        fatigueGoodDrop: -1.2,
        fatigueRiskDrop: -3.2,
      };
    })();
    const gameById = new Map(games.map(game => [game.id, game]));

    const usageByGameAndTeam = new Map<string, number>();
    playerGameStats.forEach(row => {
      const teamId = row.players?.team_id;
      if (!teamId) return;
      const key = `${row.game_id}::${teamId}`;
      const usage = (row.close_attempted || 0) + (row.mid_attempted || 0) + (row.three_attempted || 0) + 0.44 * (row.free_throw_attempted || 0) + (row.turnovers || 0);
      usageByGameAndTeam.set(key, (usageByGameAndTeam.get(key) ?? 0) + usage);
    });

    const rows = selectedPlayerRows
      .map(row => {
        const fga = (row.close_attempted || 0) + (row.mid_attempted || 0) + (row.three_attempted || 0);
        const fgm = (row.close_made || 0) + (row.mid_made || 0) + (row.three_made || 0);
        const fta = row.free_throw_attempted || 0;
        const usageProxy = fga + 0.44 * fta + (row.turnovers || 0);
        const tsDen = 2 * (fga + 0.44 * fta);
        const tsPct = tsDen > 0 ? ((row.points || 0) / tsDen) * 100 : 0;
        const efgPct = fga > 0 ? ((fgm + 0.5 * (row.three_made || 0)) / fga) * 100 : 0;
        const ppp = usageProxy > 0 ? (row.points || 0) / usageProxy : 0;
        const tovPct = asPct(row.turnovers || 0, usageProxy);
        const astTo = (row.turnovers || 0) > 0 ? (row.assists || 0) / (row.turnovers || 1) : (row.assists || 0);
        const teamId = row.players?.team_id ?? selectedPlayer.teamId ?? null;
        const teamUsage = teamId ? usageByGameAndTeam.get(`${row.game_id}::${teamId}`) ?? 0 : 0;
        const usageSharePct = asPct(usageProxy, teamUsage);
        const minutes = row.minutes || 0;
        const valPer36 = minutes > 0 ? ((row.valuation || 0) / minutes) * 36 : 0;
        const dateValue = row.games?.date ? new Date(row.games.date).getTime() : 0;
        const gameMeta = gameById.get(row.game_id);
        const margin = gameMeta ? Math.abs((gameMeta.ourScore || 0) - (gameMeta.oppScore || 0)) : null;
        const opponentKey = normalizeTeamKey(String(row.games?.opponent || ''));
        const oppQuality = opponentQualityByTeamKey.get(opponentKey) ?? null;
        const threeRate = asPct(row.three_attempted || 0, fga);
        const rimRate = asPct(row.close_attempted || 0, fga);
        const midRate = asPct(row.mid_attempted || 0, fga);

        return {
          row,
          fga,
          usageProxy,
          tsPct,
          efgPct,
          ppp,
          tovPct,
          astTo,
          usageSharePct,
          valPer36,
          minutes,
          dateValue,
          margin,
          oppQuality,
          threeRate,
          rimRate,
          midRate,
        };
      })
      .filter(item => item.fga > 0 || item.usageProxy > 0);

    const seasonTs = average(rows.map(item => item.tsPct));
    const seasonPpp = average(rows.map(item => item.ppp));
    const seasonTov = average(rows.map(item => item.tovPct));

    const shotQualityVsMaking = (() => {
      if (!playerSeasonShotSummary || !leagueSeasonShotSummary) {
        return {
          available: false,
          expectedEfg: null as number | null,
          actualEfg: null as number | null,
          valueAdd: null as number | null,
          note: null as string | null,
          zoneAdds: [] as Array<{ label: string; delta: number }>,
        };
      }

      const zones: Array<{ key: ShotZoneKey; label: string; weight: number }> = [
        { key: 'rim', label: 'Gyűrű', weight: 2 },
        { key: 'paint', label: 'Festék', weight: 2 },
        { key: 'mid', label: 'Középtáv', weight: 2 },
        { key: 'corner3', label: 'Sarok tripla', weight: 3 },
        { key: 'aboveBreak3', label: 'Egyéb tripla', weight: 3 },
      ];

      const totalAttempts = Math.max(1, playerSeasonShotSummary.attempts);
      let expectedPoints = 0;
      let actualPoints = 0;

      const zoneAdds = zones.map(zone => {
        const attempts = playerSeasonShotSummary.zoneStats[zone.key].attempts;
        const actualPct = playerSeasonShotSummary.zoneStats[zone.key].pct / 100;
        const expectedPct = leagueSeasonShotSummary.zoneStats[zone.key].pct / 100;
        const zoneActualPoints = attempts * actualPct * zone.weight;
        const zoneExpectedPoints = attempts * expectedPct * zone.weight;
        expectedPoints += zoneExpectedPoints;
        actualPoints += zoneActualPoints;
        return {
          label: zone.label,
          delta: roundValue((zoneActualPoints - zoneExpectedPoints) / totalAttempts * 100, 1),
        };
      });

      const expectedEfg = roundValue((expectedPoints / (2 * totalAttempts)) * 100, 1);
      const actualEfg = roundValue((actualPoints / (2 * totalAttempts)) * 100, 1);
      return {
        available: true,
        sampleAttempts: totalAttempts,
        confidence: confidenceFromSample(totalAttempts, 70, 140),
        expectedEfg,
        actualEfg,
        valueAdd: roundValue(actualEfg - expectedEfg, 1),
        interpretation: shotInterpretation(roundValue(actualEfg - expectedEfg, 1)),
        note: roundValue(actualEfg - expectedEfg, 1) >= 8
          ? 'A befejezési minőség jóval felülmúlja a dobásminőségből várható szintet; ez inkább elit befejező profilra utal, nem feltétlenül magas önteremtő volumenre.'
          : roundValue(actualEfg - expectedEfg, 1) <= -8
            ? 'A vállalt dobások minőségéhez képest gyengébb a befejezés, ezért a kivitelezés külön figyelmet igényel.'
            : null,
        zoneAdds,
      };
    })();

    const clutchIdentity = (() => {
      const selectedPlayerProfiles = [
        buildNormalizedNameProfile(selectedPlayer.name || ''),
      ].filter(profile => Boolean(profile.key));

      return buildAggregatedKosarstatPlayerClutchContext(
        seasonKosarstatParsedClutchGames,
        selectedPlayerProfiles
      );
    })();

    const plusMinusContext = (() => {
      const selectedPlayerProfiles = [
        buildNormalizedNameProfile(selectedPlayer.name || ''),
      ].filter(profile => Boolean(profile.key));
      const lineupSupportSource = seasonKosarstatLineupTeam ?? activeKosarstatTeamAnalysis;
      const stints = lineupSupportSource?.stints ?? [];
      const withNet = stints
        .map(stint => ({
          ...stint,
          netPer40: Number.isFinite(Number(stint.on40)) ? Number(stint.on40) : (stint.seconds > 0 ? (stint.plusMinus * 2400) / stint.seconds : null),
        }))
        .filter(stint => stint.netPer40 !== null && stint.seconds >= 60);

      const on = withNet.filter(stint => stint.players.some(player => matchesNormalizedNameProfile(player, selectedPlayerProfiles)));
      const off = withNet.filter(stint => !stint.players.some(player => matchesNormalizedNameProfile(player, selectedPlayerProfiles)));

      const weighted = (pool: typeof withNet) => {
        const sec = pool.reduce((sum, item) => sum + item.seconds, 0);
        if (sec <= 0) return null;
        const weightedNet = pool.reduce((sum, item) => sum + safeNum(item.netPer40) * item.seconds, 0) / sec;
        return roundValue(weightedNet, 1);
      };

      const topPairWithPlayer = (lineupSupportSource?.pairStats ?? [])
        .filter(pair => pair.players.some(player => matchesNormalizedNameProfile(player, selectedPlayerProfiles)) && pair.seconds >= 90)
        .sort((a, b) => b.netPer40 - a.netPer40)[0] ?? null;

      return {
        available: on.length > 0 || off.length > 0,
        confidence: confidenceFromSample(roundValue(on.reduce((sum, item) => sum + item.seconds, 0) / 60, 1), 12, 24),
        onNet40: weighted(on),
        offNet40: weighted(off),
        delta: weighted(on) !== null && weighted(off) !== null ? roundValue((weighted(on) as number) - (weighted(off) as number), 1) : null,
        lineupMinutes: roundValue(on.reduce((sum, item) => sum + item.seconds, 0) / 60, 1),
        topPair: topPairWithPlayer
          ? {
              label: topPairWithPlayer.players.join(' + '),
              netPer40: roundValue(topPairWithPlayer.netPer40, 1),
              minutes: roundValue(topPairWithPlayer.seconds / 60, 1),
            }
          : null,
      };
    })();

    const roleEfficiency = (() => {
      const ballHandlerRows = rows.filter(item => item.usageSharePct >= 24);
      const offBallRows = rows.filter(item => item.usageSharePct < 18);
      const highThreeRows = rows.filter(item => item.threeRate >= 45);
      const rimPressureRows = rows.filter(item => item.rimRate >= 35);

      const roleCoverageCount = [ballHandlerRows.length, offBallRows.length].filter(sample => sample > 0).length;
      const leanestCoreRoleSample = roleCoverageCount > 0
        ? Math.min(
            ...[ballHandlerRows.length, offBallRows.length].filter(sample => sample > 0)
          )
        : 0;
      const totalCoreRoleSample = ballHandlerRows.length + offBallRows.length;
      const confidence: 'alacsony' | 'kozepes' | 'magas' = roleCoverageCount >= 2
        ? leanestCoreRoleSample >= 5 && totalCoreRoleSample >= 14
          ? 'magas'
          : leanestCoreRoleSample >= 2 && totalCoreRoleSample >= 8
            ? 'kozepes'
            : 'alacsony'
        : totalCoreRoleSample >= 10
          ? 'kozepes'
          : 'alacsony';

      return {
        confidence,
        ballHandlerSample: ballHandlerRows.length,
        offBallSample: offBallRows.length,
        ballHandlerTs: ballHandlerRows.length ? roundValue(average(ballHandlerRows.map(item => item.tsPct)), 1) : null,
        ballHandlerPpp: ballHandlerRows.length ? roundValue(average(ballHandlerRows.map(item => item.ppp)), 3) : null,
        offBallTs: offBallRows.length ? roundValue(average(offBallRows.map(item => item.tsPct)), 1) : null,
        offBallPpp: offBallRows.length ? roundValue(average(offBallRows.map(item => item.ppp)), 3) : null,
        highThreeTs: highThreeRows.length ? roundValue(average(highThreeRows.map(item => item.tsPct)), 1) : null,
        rimPressureTs: rimPressureRows.length ? roundValue(average(rimPressureRows.map(item => item.tsPct)), 1) : null,
      };
    })();

    const decisionQuality = (() => {
      const astTo = roundValue(average(rows.map(item => item.astTo)), 2);
      const tovPct = roundValue(average(rows.map(item => item.tovPct)), 1);
      const midRate = roundValue(average(rows.map(item => item.midRate)), 1);
      const qualityAdd = shotQualityVsMaking.valueAdd ?? 0;
      const scoreRaw = 55 + astTo * 8 - tovPct * 1.3 - midRate * 0.15 + qualityAdd * 2;
      const score = Math.max(0, Math.min(100, roundValue(scoreRaw, 1)));
      const tier = score >= 70 ? 'elit' : score >= 55 ? 'stabil' : 'kockázatos';
      return {
        confidence: confidenceFromSample(rows.length, 6, 12),
        score,
        tier,
        astTo,
        tovPct,
        midRate,
      };
    })();

    const stability = (() => {
      const chrono = [...rows].sort((a, b) => a.dateValue - b.dateValue);
      const rollingWindow = 5;
      const rolling: Array<{ ts: number; ppp: number; tov: number }> = [];
      for (let i = rollingWindow - 1; i < chrono.length; i += 1) {
        const slice = chrono.slice(i - rollingWindow + 1, i + 1);
        rolling.push({
          ts: average(slice.map(item => item.tsPct)),
          ppp: average(slice.map(item => item.ppp)),
          tov: average(slice.map(item => item.tovPct)),
        });
      }

      const tsStd = roundValue(stdDev(rows.map(item => item.tsPct)), 1);
      const pppStd = roundValue(stdDev(rows.map(item => item.ppp)), 3);
      const tovStd = roundValue(stdDev(rows.map(item => item.tovPct)), 1);
      const volatility = roundValue(Math.min(100, tsStd * 1.2 + pppStd * 18 + tovStd * 1.4), 1);
      const trend = rows.length >= 6
        ? roundValue(average(rows.slice(0, 3).map(item => item.tsPct)) - average(rows.slice(-3).map(item => item.tsPct)), 1)
        : 0;

      return {
        confidence: confidenceFromSample(rows.length, 8, 14),
        rollingPoints: rolling.length,
        tsStd,
        pppStd,
        tovStd,
        volatility,
        trend,
      };
    })();

    const matchupSensitivity = (() => {
      const withQuality = rows.filter(item => item.oppQuality !== null) as Array<typeof rows[number] & { oppQuality: number }>;
      if (withQuality.length < 4) {
        return {
          available: false,
          strongTs: null as number | null,
          weakTs: null as number | null,
          strongPpp: null as number | null,
          weakPpp: null as number | null,
          tsDelta: null as number | null,
          strongOpponents: [] as string[],
          weakOpponents: [] as string[],
        };
      }

      const strong = withQuality.filter(item => item.oppQuality >= 0.5);
      const weak = withQuality.filter(item => item.oppQuality <= -0.5);
      const strongPool = strong.length >= 2 ? strong : [...withQuality].sort((a, b) => b.oppQuality - a.oppQuality).slice(0, Math.ceil(withQuality.length / 2));
      const weakPool = weak.length >= 2 ? weak : [...withQuality].sort((a, b) => a.oppQuality - b.oppQuality).slice(0, Math.ceil(withQuality.length / 2));
      const pairedSample = Math.min(strongPool.length, weakPool.length);

      const strongTs = roundValue(average(strongPool.map(item => item.tsPct)), 1);
      const weakTs = roundValue(average(weakPool.map(item => item.tsPct)), 1);
      const strongPpp = roundValue(average(strongPool.map(item => item.ppp)), 3);
      const weakPpp = roundValue(average(weakPool.map(item => item.ppp)), 3);
      return {
        available: true,
        confidence: pairedSample >= 4 ? 'magas' : pairedSample >= 2 ? 'kozepes' : 'alacsony',
        sampleSize: withQuality.length,
        strongTs,
        weakTs,
        strongPpp,
        weakPpp,
        tsDelta: roundValue(strongTs - weakTs, 1),
        interpretation: matchupInterpretation(roundValue(strongTs - weakTs, 1)),
        strongOpponents: Array.from(new Set(strongPool.map(item => String(item.row.games?.opponent || '')).filter(Boolean))).slice(0, 3),
        weakOpponents: Array.from(new Set(weakPool.map(item => String(item.row.games?.opponent || '')).filter(Boolean))).slice(0, 3),
      };
    })();

    const fatigueLoad = (() => {
      const sorted = [...rows].sort((a, b) => a.dateValue - b.dateValue);
      const withB2B = sorted.map((item, index) => {
        if (index === 0) return { ...item, b2b: false };
        const prev = sorted[index - 1];
        const dayGap = (item.dateValue - prev.dateValue) / (1000 * 60 * 60 * 24);
        return { ...item, b2b: Number.isFinite(dayGap) && dayGap > 0 && dayGap <= 1.5 };
      });

      const highLoad = withB2B.filter(item => item.minutes >= 30);
      const normalLoad = withB2B.filter(item => item.minutes < 30);
      const b2b = withB2B.filter(item => item.b2b);

      const highTs = highLoad.length ? roundValue(average(highLoad.map(item => item.tsPct)), 1) : null;
      const normalTs = normalLoad.length ? roundValue(average(normalLoad.map(item => item.tsPct)), 1) : null;
      const b2bTov = b2b.length ? roundValue(average(b2b.map(item => item.tovPct)), 1) : null;
      const balancedLoadSample = Math.min(highLoad.length, normalLoad.length);

      return {
        confidence: balancedLoadSample >= 6 ? 'magas' : balancedLoadSample >= 3 ? 'kozepes' : 'alacsony',
        sampleSize: sorted.length,
        highLoadGames: highLoad.length,
        b2bGames: b2b.length,
        highLoadTs: highTs,
        normalLoadTs: normalTs,
        tsDrop: highTs !== null && normalTs !== null ? roundValue(highTs - normalTs, 1) : null,
        b2bTovPct: b2bTov,
        note: highLoad.length === 0 ? 'Nincs érdemi 30+ perces minta, ezért a terhelési blokk korlátozottan értelmezhető.' : null,
      };
    })();

    const coachingFocus = [
      shotQualityVsMaking.valueAdd !== null && shotQualityVsMaking.valueAdd <= -1.5
        ? 'Dobásminőség és kivitelezés: expected eFG alatt termel, érdemes a preferált zónákra visszaterelni.'
        : null,
      decisionQuality.score < 55
        ? `Döntéshozatali kockázat: ${decisionQuality.score.toFixed(1)}-es index, AST/TO ${decisionQuality.astTo.toFixed(2)}.`
        : null,
      plusMinusContext.delta !== null && plusMinusContext.delta <= -4
        ? 'Lineup fit probléma: on/off delta negatív, érdemes a sikeres párosokkal többet együtt játszatni.'
        : null,
      matchupSensitivity.available && matchupSensitivity.tsDelta !== null && matchupSensitivity.tsDelta <= -4
        ? 'Matchup érzékenység erős védelmek ellen: ellenállóbb belső opciók vagy korai könnyű kísérletek növelése javasolt.'
        : null,
      fatigueLoad.tsDrop !== null && fatigueLoad.tsDrop <= -3
        ? 'Terhelés menedzsment: nagy percterhelésnél hatékonyság-esés látható, váltás/rotáció finomítása indokolt.'
        : null,
    ].filter((item): item is string => Boolean(item)).slice(0, 3);

    const blockVerdicts = (() => {
      const shotTone = gradeHigherBetter(shotQualityVsMaking.valueAdd, 1.5, -1.5);
      const clutchTsDelta = clutchIdentity.tsPct !== null ? roundValue(clutchIdentity.tsPct - seasonTs, 1) : null;
      const clutchTone = gradeHigherBetter(clutchTsDelta, 1.0, -2.0);
      const impactTone = gradeHigherBetter(plusMinusContext.delta, 2.0, -2.0);
      const roleBestTs = Math.max(
        roleEfficiency.ballHandlerTs ?? -Infinity,
        roleEfficiency.offBallTs ?? -Infinity,
        roleEfficiency.highThreeTs ?? -Infinity,
        roleEfficiency.rimPressureTs ?? -Infinity
      );
      const roleTsDelta = Number.isFinite(roleBestTs) ? roundValue(roleBestTs - seasonTs, 1) : null;
      const roleTone = gradeHigherBetter(roleTsDelta, 1.0, -1.5);
      const decisionTone = gradeHigherBetter(decisionQuality.score, positionProfile.decisionGood, positionProfile.decisionRisk);
      const stabilityTone = gradeLowerBetter(stability.volatility, positionProfile.stabilityGood, positionProfile.stabilityRisk);
      const matchupTone = gradeHigherBetter(matchupSensitivity.tsDelta, -1.0, -4.0);
      const fatigueTone = gradeHigherBetter(fatigueLoad.tsDrop, positionProfile.fatigueGoodDrop, positionProfile.fatigueRiskDrop);

      return {
        shot: {
          tone: shotTone,
          text: shotTone === 'good'
            ? 'Verdict: a dobáskivitelezés a vártnál jobb szintet hoz.'
            : shotTone === 'risk'
              ? 'Verdict: a kivitelezés elmarad a várható dobásminőségtől.'
              : 'Verdict: a kivitelezés nagyjából a várható szinten mozog.',
        },
        clutch: {
          tone: clutchTone,
          text: clutchTone === 'good'
            ? 'Verdict: clutch helyzetben stabilan tartja vagy javítja a szezon-szintet.'
            : clutchTone === 'risk'
              ? 'Verdict: clutchban érdemi visszaesés látszik a szezonátlaghoz képest.'
              : 'Verdict: clutch teljesítménye jelenleg közeli a szezonmintához.',
        },
        impact: {
          tone: impactTone,
          text: impactTone === 'good'
            ? 'Verdict: a lineup on/off alapján pozitív nettó hatást ad.'
            : impactTone === 'risk'
              ? 'Verdict: a jelenlegi lineup-környezetben negatívabb nettó hatás látszik.'
              : 'Verdict: a lineup-hatás vegyes, matchup- és rotációfüggő.',
        },
        role: {
          tone: roleTone,
          text: roleTone === 'good'
            ? 'Verdict: legalább egy szerepkörben a szezon-szint fölé tud lépni.'
            : roleTone === 'risk'
              ? 'Verdict: a szerepkörök között nincs stabilan pluszt hozó profil.'
              : 'Verdict: a szerepkör-hatékonyság közepes, még finomhangolható.',
        },
        decision: {
          tone: decisionTone,
          text: decisionTone === 'good'
            ? 'Verdict: döntésminőség jelenleg erős.'
            : decisionTone === 'risk'
              ? 'Verdict: döntésminőségi kockázat látszik (shot selection / labdabiztonság).'
              : 'Verdict: döntésminőség stabil, de nem kiugró.',
        },
        stability: {
          tone: stabilityTone,
          text: stabilityTone === 'good'
            ? 'Verdict: meccsről meccsre alacsonyabb kilengés, megbízhatóbb output.'
            : stabilityTone === 'risk'
              ? 'Verdict: magasabb ingadozás, a teljesítmény kevésbé kiszámítható.'
              : 'Verdict: közepes stabilitás, rövid távon hullámzó lehet.',
        },
        matchup: {
          tone: matchupTone,
          text: matchupTone === 'good'
            ? 'Verdict: erősebb védelem ellen is jól tartja a hatékonyságát.'
            : matchupTone === 'risk'
              ? 'Verdict: erősebb védelem ellen érzékenyebb visszaesés látszik.'
              : 'Verdict: matchup-érzékenység közepes, ellenféltől függően változik.',
        },
        fatigue: {
          tone: fatigueTone,
          text: fatigueTone === 'good'
            ? 'Verdict: terhelés mellett is tartja a hatékonyságot.'
            : fatigueTone === 'risk'
              ? 'Verdict: nagy terhelésnél érdemi hatékonyság-esés jelentkezik.'
              : 'Verdict: terhelésre mérsékelten reagál, monitorozás javasolt.',
        },
      };
    })();

    const toneReason = (tone: 'good' | 'neutral' | 'risk' | 'na') => {
      if (tone === 'good') return 'good, mert átlépi a pozitív küszöböt';
      if (tone === 'risk') return 'risk, mert a kockázati küszöb alá/fölé esik';
      if (tone === 'neutral') return 'neutral, mert a két küszöb között van';
      return 'n/a, mert nincs elég adat';
    };

    const clutchDeltaForHint = clutchIdentity.tsPct !== null ? roundValue(clutchIdentity.tsPct - seasonTs, 1) : null;
    const roleBestTsForHint = Math.max(
      roleEfficiency.ballHandlerTs ?? -Infinity,
      roleEfficiency.offBallTs ?? -Infinity,
      roleEfficiency.highThreeTs ?? -Infinity,
      roleEfficiency.rimPressureTs ?? -Infinity
    );
    const roleTsDeltaForHint = Number.isFinite(roleBestTsForHint) ? roundValue(roleBestTsForHint - seasonTs, 1) : null;

    const thresholdHints = {
      shot: `Good: value add >= +1.5 pp | Risk: value add < -1.5 pp | Minta: ${shotQualityVsMaking.sampleAttempts ?? 0} kísérlet\nAktuális: ${formatNullableNumber(shotQualityVsMaking.valueAdd, 1, ' pp')} | Indok: ${toneReason(blockVerdicts.shot.tone)}`,
      clutch: `Good: clutch TS - szezon TS >= +1.0 pp | Risk: <= -2.0 pp | Minta: ${clutchIdentity.games} Kosarstat clutch meccs\nAktuális: ${formatNullableNumber(clutchDeltaForHint, 1, ' pp')} | Indok: ${toneReason(blockVerdicts.clutch.tone)}`,
      impact: `Good: on/off delta >= +2.0 net/40 | Risk: < -2.0 net/40 | Minta: ${plusMinusContext.lineupMinutes.toFixed(1)} lineup perc\nAktuális: ${formatNullableNumber(plusMinusContext.delta, 1)} | Indok: ${toneReason(blockVerdicts.impact.tone)}`,
      role: `Good: legjobb szerepkör TS >= szezon TS +1.0 pp | Risk: <= -1.5 pp | Minta: BH ${roleEfficiency.ballHandlerSample} / OB ${roleEfficiency.offBallSample}\nAktuális: ${formatNullableNumber(roleTsDeltaForHint, 1, ' pp')} | Indok: ${toneReason(blockVerdicts.role.tone)}`,
      decision: `Good: index >= ${positionProfile.decisionGood} | Risk: < ${positionProfile.decisionRisk} | Pozíciós küszöb (${analysis.position})\nAktuális: ${decisionQuality.score.toFixed(1)} | Indok: ${toneReason(blockVerdicts.decision.tone)}`,
      stability: `Good: volatilitási index <= ${positionProfile.stabilityGood} | Risk: > ${positionProfile.stabilityRisk} | Pozíciós küszöb (${analysis.position})\nAktuális: ${stability.volatility.toFixed(1)} | Indok: ${toneReason(blockVerdicts.stability.tone)}`,
      matchup: `Good: erős-gyenge TS delta >= -1.0 pp | Risk: < -4.0 pp | Minta: ${matchupSensitivity.sampleSize ?? 0} meccs\nAktuális: ${formatNullableNumber(matchupSensitivity.tsDelta, 1, ' pp')} | Indok: ${toneReason(blockVerdicts.matchup.tone)}`,
      fatigue: `Good: high-load TS - normal TS >= ${positionProfile.fatigueGoodDrop.toFixed(1)} pp | Risk: <= ${positionProfile.fatigueRiskDrop.toFixed(1)} pp | Pozíciós küszöb (${analysis.position})\nAktuális: ${formatNullableNumber(fatigueLoad.tsDrop, 1, ' pp')} | Indok: ${toneReason(blockVerdicts.fatigue.tone)}`,
    };

    return {
      shotQualityVsMaking,
      clutchIdentity,
      plusMinusContext,
      roleEfficiency,
      decisionQuality,
      stability,
      matchupSensitivity,
      fatigueLoad,
      blockVerdicts,
      thresholdHints,
      coachingFocus,
      season: {
        tsPct: roundValue(seasonTs, 1),
        ppp: roundValue(seasonPpp, 3),
        tovPct: roundValue(seasonTov, 1),
      },
    };
  }, [
    activeKosarstatTeamAnalysis,
    analysis,
    games,
    leagueSeasonShotSummary,
    opponentQualityByTeamKey,
    playerGameStats,
    playerSeasonShotSummary,
    seasonKosarstatParsedClutchGames,
    selectedPlayer,
    selectedPlayerRows,
  ]);

  const eligibleCount = useMemo(() => {
    if (!resolvedSeasonId) return 0;
    return seasonPlayers
      .map(player => normalizePlayerStats(toRawStat(player, league, resolvedSeasonId)))
      .filter(isEligibleSample).length;
  }, [league, seasonPlayers, resolvedSeasonId]);

  const playerAdvancedLlmContext = useMemo(() => {
    if (!playerAdvancedInsights) return null;

    return {
      shotQualityVsMaking: {
        confidence: playerAdvancedInsights.shotQualityVsMaking.confidence ?? 'alacsony',
        expectedEfg: playerAdvancedInsights.shotQualityVsMaking.expectedEfg,
        actualEfg: playerAdvancedInsights.shotQualityVsMaking.actualEfg,
        valueAdd: playerAdvancedInsights.shotQualityVsMaking.valueAdd,
        interpretation: playerAdvancedInsights.shotQualityVsMaking.interpretation ?? null,
        note: playerAdvancedInsights.shotQualityVsMaking.note ?? null,
      },
      clutchIdentity: {
        confidence: playerAdvancedInsights.clutchIdentity.confidence ?? 'alacsony',
        games: playerAdvancedInsights.clutchIdentity.games,
        usagePct: playerAdvancedInsights.clutchIdentity.usagePct,
        tsPct: playerAdvancedInsights.clutchIdentity.tsPct,
        tovPct: playerAdvancedInsights.clutchIdentity.tovPct,
        astTo: playerAdvancedInsights.clutchIdentity.astTo,
        ppp: playerAdvancedInsights.clutchIdentity.ppp,
        sampleWarning: playerAdvancedInsights.clutchIdentity.sampleWarning ?? null,
        roleNote: playerAdvancedInsights.clutchIdentity.roleNote ?? null,
      },
      plusMinusContext: {
        confidence: playerAdvancedInsights.plusMinusContext.confidence ?? 'alacsony',
        onNet40: playerAdvancedInsights.plusMinusContext.onNet40,
        offNet40: playerAdvancedInsights.plusMinusContext.offNet40,
        delta: playerAdvancedInsights.plusMinusContext.delta,
        lineupMinutes: playerAdvancedInsights.plusMinusContext.lineupMinutes,
        topPair: playerAdvancedInsights.plusMinusContext.topPair ?? null,
      },
      roleEfficiency: {
        confidence: playerAdvancedInsights.roleEfficiency.confidence,
        ballHandlerSample: playerAdvancedInsights.roleEfficiency.ballHandlerSample,
        offBallSample: playerAdvancedInsights.roleEfficiency.offBallSample,
        ballHandlerTs: playerAdvancedInsights.roleEfficiency.ballHandlerTs,
        offBallTs: playerAdvancedInsights.roleEfficiency.offBallTs,
        highThreeTs: playerAdvancedInsights.roleEfficiency.highThreeTs,
        rimPressureTs: playerAdvancedInsights.roleEfficiency.rimPressureTs,
      },
      decisionQuality: {
        confidence: playerAdvancedInsights.decisionQuality.confidence,
        score: playerAdvancedInsights.decisionQuality.score,
        tier: playerAdvancedInsights.decisionQuality.tier,
        astTo: playerAdvancedInsights.decisionQuality.astTo,
        tovPct: playerAdvancedInsights.decisionQuality.tovPct,
      },
      stability: {
        confidence: playerAdvancedInsights.stability.confidence,
        volatility: playerAdvancedInsights.stability.volatility,
        tsStd: playerAdvancedInsights.stability.tsStd,
        pppStd: playerAdvancedInsights.stability.pppStd,
        trend: playerAdvancedInsights.stability.trend,
      },
      matchupSensitivity: {
        confidence: playerAdvancedInsights.matchupSensitivity.confidence ?? 'alacsony',
        sampleSize: playerAdvancedInsights.matchupSensitivity.sampleSize ?? 0,
        strongTs: playerAdvancedInsights.matchupSensitivity.strongTs,
        weakTs: playerAdvancedInsights.matchupSensitivity.weakTs,
        tsDelta: playerAdvancedInsights.matchupSensitivity.tsDelta,
        interpretation: playerAdvancedInsights.matchupSensitivity.interpretation ?? null,
        strongOpponents: playerAdvancedInsights.matchupSensitivity.strongOpponents ?? [],
        weakOpponents: playerAdvancedInsights.matchupSensitivity.weakOpponents ?? [],
      },
      fatigueLoad: {
        confidence: playerAdvancedInsights.fatigueLoad.confidence,
        sampleSize: playerAdvancedInsights.fatigueLoad.sampleSize,
        highLoadGames: playerAdvancedInsights.fatigueLoad.highLoadGames,
        b2bGames: playerAdvancedInsights.fatigueLoad.b2bGames,
        highLoadTs: playerAdvancedInsights.fatigueLoad.highLoadTs,
        normalLoadTs: playerAdvancedInsights.fatigueLoad.normalLoadTs,
        tsDrop: playerAdvancedInsights.fatigueLoad.tsDrop,
        note: playerAdvancedInsights.fatigueLoad.note ?? null,
      },
      seasonSummary: playerSeasonOverview,
      blockVerdicts: playerAdvancedInsights.blockVerdicts,
      coachingFocus: playerAdvancedInsights.coachingFocus,
    };
  }, [playerAdvancedInsights, playerSeasonOverview]);

  const showPlayerSection = activeSection === 'player';
  const showTeamSection = activeSection === 'team';
  const showPregameSection = activeSection === 'pregame';
  const showPostgameSection = activeSection === 'postgame';
  const showProjectionSection = activeSection === 'projection';

  const renderThresholdTooltip = (content: string) => (
    <UiTooltip>
      <TooltipTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-border-subtle text-[10px] text-secondary hover:bg-surface-2"
          aria-label="Küszöb információ"
        >
          i
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs whitespace-pre-line text-xs leading-relaxed">
        {content}
      </TooltipContent>
    </UiTooltip>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-display uppercase tracking-wide text-primary">Elemzés</h1>
        <Badge className="badge-neutral">
          {league}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display uppercase tracking-wide text-primary">Játékos kiválasztása</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-secondary mb-2 block">Szezon</label>
              <Select
                value={resolvedSeasonId || ''}
                onValueChange={(value) => {
                  setSelectedSeasonId(value);
                  setSelectedPlayerId('');
                  setSelectedGameId('');
                  setSelectedOpponentTeamId('');
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Válassz szezont..." className="truncate" />
                </SelectTrigger>
                <SelectContent>
                  {allSeasons.map(season => (
                    <SelectItem key={season.id} value={String(season.id)}>
                      {season.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-secondary mb-2 block">Csapat</label>
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
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Válassz csapatot..." className="truncate" />
                </SelectTrigger>
                <SelectContent>
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
              <label className="text-sm text-secondary mb-2 block">Játékos</label>
              <Select
                key={`${resolvedSeasonId ?? 'none'}-${resolvedTeamId}`}
                value={selectedPlayerId}
                onValueChange={setSelectedPlayerId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Válassz játékost..." className="truncate" />
                </SelectTrigger>
                <SelectContent>
                  {filteredPlayers.map(player => (
                    <SelectItem key={`${player.id}-${player.seasonId}`} value={player.id}>
                      #{player.number} {player.name} ({player.teamName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-secondary">
            <span>Mintaszűrés: meccs ≥ 10, perc/meccs ≥ 15</span>
            <span>Aktív minták: {eligibleCount}</span>
          </div>
        </CardContent>
      </Card>
      <TerminologyGlossary />

      <Card>
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
                    ? ''
                    : 'border-border-subtle text-secondary hover:bg-surface-2'
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
        <Card>
          <CardContent className="p-6 text-sm text-secondary">
            A kiválasztott játékos nem felel meg a minimum mintaszűrésnek.
          </CardContent>
        </Card>
      )}

      {showPlayerSection && analysis && selectedPlayer && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-display uppercase tracking-wide text-primary">
                  {selectedPlayer.name} • {getPositionLabel(analysis.position)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">

                  {analysis.roles.map(role => (
                    <Badge key={role} className="badge-orange">
                      {role}
                    </Badge>
                  ))}
                  {analysis.roles.length === 0 && (
                    <Badge className="badge-neutral">
                      Nincs egyértelmű szerepkör
                    </Badge>
                  )}
                </div>

                <div className="text-sm text-primary leading-relaxed">{analysis.summary}</div>
                <div className="text-sm text-secondary">{buildCoachSummary(analysis)}</div>

                <div className="rounded-lg border border-border-subtle bg-surface-2/40 p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm text-secondary font-medium">GPT szezonértékelés</div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleGeneratePlayerSeasonNarrative}
                        disabled={isGeneratingPlayerSeasonText}
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
                        className="border-border-subtle text-secondary hover:bg-surface-2"
                      >
                        {isSavingPlayerSeasonText ? 'Mentés...' : 'Mentés'}
                      </Button>
                    </div>
                  </div>

                  {playerSeasonSaveStatus && (
                    <div className={`text-xs ${playerSeasonSaveStatus.type === 'success' ? 'text-positive' : 'text-negative'}`}>
                      {playerSeasonSaveStatus.message}
                    </div>
                  )}

                  {playerNarratives[selectedPlayer.id]?.status === 'loading' && (
                    <div className="text-sm text-secondary">Játékos szezonértékelés generálása folyamatban...</div>
                  )}

                  {playerNarratives[selectedPlayer.id]?.status === 'error' && (
                    <div className="text-sm text-negative">{playerNarratives[selectedPlayer.id]?.error ?? 'Hiba történt.'}</div>
                  )}

                  {playerNarratives[selectedPlayer.id]?.status === 'success' && playerNarratives[selectedPlayer.id]?.text && (
                    <>
                      <div className="text-xs text-muted">
                        {playerNarratives[selectedPlayer.id]?.generatedAt
                          ? `Mentve: ${formatGeneratedAt(playerNarratives[selectedPlayer.id]?.generatedAt) ?? 'ismeretlen'}${playerNarratives[selectedPlayer.id]?.generatedBy ? ` • Forrás: ${playerNarratives[selectedPlayer.id]?.generatedBy}` : ''}`
                          : 'Mentett játékos szezonértékelés'}
                      </div>
                      <div className="text-sm text-primary whitespace-pre-line leading-relaxed">
                        {playerNarratives[selectedPlayer.id]?.text}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-border-subtle hover:bg-surface-2 text-cyan"
                        onClick={() => {
                          const md = playerSeasonToMd(selectedPlayer);
                          const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `jatekos-${selectedPlayer.name.replace(/\s+/g, '-')}.md`;
                          a.click();
                          URL.revokeObjectURL(url);
                          navigator.clipboard.writeText(md).catch(() => null);
                          toast.success('MD exportálva – vágólapra másolva és letöltve');
                        }}
                      >
                        <Download className="w-3 h-3 mr-1.5" />
                        Export MD
                      </Button>
                    </>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className={`font-semibold ${getConfidenceTone(analysis.confidence)}`}>
                    Bizonyosság: {analysis.confidence}
                  </span>
                  <span className="text-secondary">Szerep biztonság: {(analysis.roleConfidence * 100).toFixed(0)}%</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-display uppercase tracking-wide text-primary">Szezonos alapkontekstus</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {playerSeasonOverview ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div className="p-3 bg-surface-2 rounded-lg">
                        <div className="text-xs text-muted">Meccs</div>
                        <div className="text-primary font-mono tabular-nums text-lg font-medium">{playerSeasonOverview.games}</div>
                      </div>
                      <div className="p-3 bg-surface-2 rounded-lg">
                        <div className="text-xs text-muted">MPG</div>
                        <div className="text-primary font-mono tabular-nums text-lg font-medium">{playerSeasonOverview.minutesPerGame.toFixed(1)}</div>
                      </div>
                      <div className="p-3 bg-surface-2 rounded-lg">
                        <div className="text-xs text-muted">PPG</div>
                        <div className="text-primary font-mono tabular-nums text-lg font-medium">{playerSeasonOverview.pointsPerGame.toFixed(1)}</div>
                      </div>
                      <div className="p-3 bg-surface-2 rounded-lg">
                        <div className="text-xs text-muted">RPG</div>
                        <div className="text-primary font-mono tabular-nums text-lg font-medium">{playerSeasonOverview.reboundsPerGame.toFixed(1)}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div className="text-secondary">AST: <span className="text-primary font-mono tabular-nums">{playerSeasonOverview.assistsPerGame.toFixed(1)}</span></div>
                      <div className="text-secondary">BLK: <span className="text-primary font-mono tabular-nums">{playerSeasonOverview.blocksPerGame.toFixed(1)}</span></div>
                      <div className="text-secondary">STL: <span className="text-primary font-mono tabular-nums">{playerSeasonOverview.stealsPerGame.toFixed(1)}</span></div>
                      <div className="text-secondary">Fault/meccs: <span className="text-primary font-mono tabular-nums">{playerSeasonOverview.foulsPerGame.toFixed(1)}</span></div>
                      <div className="text-secondary">FG%: <span className="text-primary font-mono tabular-nums">{formatNullableNumber(playerSeasonOverview.fgPct, 1, '%')}</span></div>
                      <div className="text-secondary">2P%: <span className="text-primary font-mono tabular-nums">{formatNullableNumber(playerSeasonOverview.twoPct, 1, '%')}</span></div>
                      <div className="text-secondary">3P%: <span className="text-primary font-mono tabular-nums">{formatNullableNumber(playerSeasonOverview.threePct, 1, '%')}</span></div>
                      <div className="text-secondary">FT%: <span className="text-primary font-mono tabular-nums">{formatNullableNumber(playerSeasonOverview.ftPct, 1, '%')}</span></div>
                      <div className="text-secondary">TS%: <span className="text-primary font-mono tabular-nums">{formatNullableNumber(playerSeasonOverview.tsPct, 1, '%')}</span></div>
                      <div className="text-secondary">VAL/36: <span className="text-primary font-mono tabular-nums">{playerSeasonOverview.valPer36.toFixed(1)}</span></div>
                      <div className="text-secondary">Usage proxy/36: <span className="text-primary font-mono tabular-nums">{playerSeasonOverview.usageProxyPer36.toFixed(1)}</span></div>
                      <div className="text-secondary">Fault/36: <span className="text-primary font-mono tabular-nums">{formatNullableNumber(playerSeasonOverview.foulsPer36, 1)}</span></div>
                    </div>
                    <div className="text-xs text-muted">
                      Ezek nyers szezonos alapmutatók. A képesség pontszámok ettől külön, 0-100-as posztos benchmark-indexek, nem nyers PPG/usage mutatók.
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-secondary">Nincs elég szezonos adat az összesített kontextushoz.</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-display uppercase tracking-wide text-primary">Képesség pontszámok</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(analysis.skillScores).map(([key, value]) => (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-secondary">{SKILL_LABELS_HU[key] ?? key}</span>
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-32 bg-surface-2 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-positive/80"
                            style={{ width: `${value}%` }}
                          />
                        </div>
                        <span className="text-primary font-mono tabular-nums font-semibold w-10 text-right">{value}</span>
                      </div>
                    </div>
                    <div className="text-[11px] text-muted">{SKILL_SCORE_HELPERS_HU[key] ?? 'Pozíciós benchmark-index.'}</div>
                  </div>
                ))}
                <div className="text-[11px] text-muted">
                  A magas pontszám önmagában nem jelent elsődleges scorer vagy playmaker szerepet; a szezonos volumen- és usage-kontekstust mindig az alapkártyával együtt kell olvasni.
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-display uppercase tracking-wide text-primary">Last 5 Trend (VAL / perc)</CardTitle>
              </CardHeader>
              <CardContent>
                {lastFiveChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={lastFiveChartData} margin={{ left: 8, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                      <XAxis dataKey="label" stroke="var(--text-secondary)" />
                      <YAxis stroke="var(--text-secondary)" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--bg-surface-2)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '8px',
                          color: 'var(--text-primary)',
                        }}
                      />
                      <Line type="monotone" dataKey="val" stroke="var(--positive)" strokeWidth={2} dot={{ r: 3 }} name="VAL" />
                      <Line type="monotone" dataKey="minutes" stroke="var(--accent-cyan)" strokeWidth={2} dot={{ r: 3 }} name="Perc" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-sm text-secondary">Nincs elérhető meccs adat.</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-display uppercase tracking-wide text-primary">Személyes dobásprofil (szezon)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {playerSeasonShotSummary ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-3 bg-surface-2 rounded-lg">
                        <div className="text-xs text-muted">Kísérlet</div>
                        <div className="text-primary font-mono tabular-nums text-lg font-medium">{playerSeasonShotSummary.attempts}</div>
                      </div>
                      <div className="p-3 bg-surface-2 rounded-lg">
                        <div className="text-xs text-muted">Bedobott</div>
                        <div className="text-primary font-mono tabular-nums text-lg font-medium">{playerSeasonShotSummary.made}</div>
                      </div>
                      <div className="p-3 bg-surface-2 rounded-lg">
                        <div className="text-xs text-muted">FG%</div>
                        <div className="text-primary font-mono tabular-nums text-lg font-medium">{formatShotPct(playerSeasonShotSummary.fgPct)}</div>
                      </div>
                      <div className="p-3 bg-surface-2 rounded-lg">
                        <div className="text-xs text-muted">Mintanagyság</div>
                        <div className="text-primary font-mono tabular-nums text-lg font-medium">Hunbasket</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      <div className="p-3 bg-surface-2/40 rounded-lg">
                        <div className="text-sm text-secondary font-medium mb-2">Zónavolumen (kísérlet)</div>
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={playerShotZoneRows} margin={{ left: 8, right: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                            <XAxis
                              dataKey="label"
                              stroke="var(--text-secondary)"
                              tick={{ fontSize: 10 }}
                              interval={0}
                              angle={-18}
                              textAnchor="end"
                              tickMargin={10}
                              height={52}

                            />
                            <YAxis stroke="var(--text-secondary)" tick={{ fontSize: 10 }} allowDecimals={false} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'var(--bg-surface-2)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: '8px',
                                color: 'var(--text-primary)',
                              }}
                              labelStyle={{ color: 'var(--text-primary)', fontWeight: 'bold' }}
                              itemStyle={{ color: 'var(--text-primary)' }}
                            />
                            <Bar dataKey="attempts" name="Kísérlet" fill="var(--accent-cyan)" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="p-3 bg-surface-2/40 rounded-lg">
                        <div className="text-sm text-secondary font-medium mb-2">Zónahatékonyság (FG%)</div>
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={playerShotZoneRows} margin={{ left: 8, right: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                            <XAxis
                              dataKey="label"
                              stroke="var(--text-secondary)"
                              tick={{ fontSize: 10 }}
                              interval={0}
                              angle={-18}
                              textAnchor="end"
                              tickMargin={10}
                              height={52}
                            />
                            <YAxis stroke="var(--text-secondary)" tick={{ fontSize: 10 }} domain={[0, 100]} />
                            <Tooltip
                              formatter={(value: number | string | undefined) => `${Number(value ?? 0).toFixed(1)}%`}
                              contentStyle={{
                                backgroundColor: 'var(--bg-surface-2)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: '8px',
                                color: 'var(--text-primary)',
                              }}
                              labelStyle={{ color: 'var(--text-primary)', fontWeight: 'bold' }}
                              itemStyle={{ color: 'var(--text-primary)' }}
                            />
                            <Bar dataKey="pct" name="FG%" fill="var(--positive)" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-secondary">Ehhez a játékoshoz még nincs elég Hunbasket dobástérkép adat.</div>
                )}
              </CardContent>
            </Card>

            {playerAdvancedInsights && (
              <Card>
                <CardHeader>
                  <CardTitle className="font-display uppercase tracking-wide text-primary">Haladó játékos blokkok (új statok)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <TooltipProvider delayDuration={120}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">

                    {/* 1) Shot quality vs shot making */}
                    <div className="rounded-md border border-border-subtle bg-surface-2/50 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <div className="text-primary font-medium">1) Dobásminőség vs kivitelezés</div>
                          {renderThresholdTooltip(playerAdvancedInsights.thresholdHints.shot)}
                        </div>
                        {'confidence' in playerAdvancedInsights.shotQualityVsMaking && (
                          <Badge className={getSampleConfidenceBadgeClass(normalizeSampleConfidence(playerAdvancedInsights.shotQualityVsMaking.confidence))}>{formatSampleConfidenceLabel(normalizeSampleConfidence(playerAdvancedInsights.shotQualityVsMaking.confidence))}</Badge>
                        )}
                      </div>
                      <p className={`text-[11px] leading-relaxed ${getInsightToneClass(playerAdvancedInsights.blockVerdicts.shot.tone)}`}>
                        {playerAdvancedInsights.blockVerdicts.shot.text}
                        {'interpretation' in playerAdvancedInsights.shotQualityVsMaking && playerAdvancedInsights.shotQualityVsMaking.interpretation
                          ? ` (${playerAdvancedInsights.shotQualityVsMaking.interpretation})` : ''}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">Várt eFG: {formatNullableNumber(playerAdvancedInsights.shotQualityVsMaking.expectedEfg, 1, '%')}</span>
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">Tényleges eFG: {formatNullableNumber(playerAdvancedInsights.shotQualityVsMaking.actualEfg, 1, '%')}</span>
                        <span className={`px-1.5 py-0.5 rounded bg-surface-2 text-[10px] ${Number(playerAdvancedInsights.shotQualityVsMaking.valueAdd ?? 0) >= 0 ? 'text-positive' : 'text-negative'}`}>
                          Értéktöbblet: {formatNullableNumber(playerAdvancedInsights.shotQualityVsMaking.valueAdd, 1, ' pp')}
                        </span>
                      </div>
                      {playerAdvancedInsights.shotQualityVsMaking.zoneAdds.length > 0 && (
                        <div className="text-[10px] text-muted">
                          Zóna delta: {playerAdvancedInsights.shotQualityVsMaking.zoneAdds.slice(0, 3).map(item => `${item.label} ${item.delta >= 0 ? '+' : ''}${item.delta.toFixed(1)}`).join(' • ')}
                        </div>
                      )}
                    </div>

                    {/* 2) Clutch identitás */}
                    <div className="rounded-md border border-border-subtle bg-surface-2/50 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <div className="text-primary font-medium">2) Clutch identitás</div>
                          {renderThresholdTooltip(playerAdvancedInsights.thresholdHints.clutch)}
                        </div>
                        {'confidence' in playerAdvancedInsights.clutchIdentity && (
                          <Badge className={getSampleConfidenceBadgeClass(normalizeSampleConfidence(playerAdvancedInsights.clutchIdentity.confidence))}>{formatSampleConfidenceLabel(normalizeSampleConfidence(playerAdvancedInsights.clutchIdentity.confidence))}</Badge>
                        )}
                      </div>
                      <p className={`text-[11px] leading-relaxed ${getInsightToneClass(playerAdvancedInsights.blockVerdicts.clutch.tone)}`}>
                        {playerAdvancedInsights.blockVerdicts.clutch.text}
                        {'roleNote' in playerAdvancedInsights.clutchIdentity && playerAdvancedInsights.clutchIdentity.roleNote
                          ? ` ${playerAdvancedInsights.clutchIdentity.roleNote}` : ''}
                      </p>
                      {playerAdvancedInsights.clutchIdentity.games === 0 && (
                        <div className="text-[10px] text-negative font-semibold">Nincs clutch minta – adatok tájékoztató jellegűek.</div>
                      )}
                      {'sampleWarning' in playerAdvancedInsights.clutchIdentity && playerAdvancedInsights.clutchIdentity.sampleWarning && (
                        <div className="text-[10px] text-warning font-semibold">{playerAdvancedInsights.clutchIdentity.sampleWarning}</div>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">Minta: {playerAdvancedInsights.clutchIdentity.games} meccs</span>
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">Usage: {formatNullableNumber(playerAdvancedInsights.clutchIdentity.usagePct, 1, '%')}</span>
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">TS%: {formatNullableNumber(playerAdvancedInsights.clutchIdentity.tsPct, 1, '%')}</span>
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">TOV%: {formatNullableNumber(playerAdvancedInsights.clutchIdentity.tovPct, 1, '%')}</span>
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">AST/TO: {formatNullableNumber(playerAdvancedInsights.clutchIdentity.astTo, 2)}</span>
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">PPP: {formatNullableNumber(playerAdvancedInsights.clutchIdentity.ppp, 3)}</span>
                      </div>
                    </div>

                    {/* 3) Kontextusos +/- (lineup) */}
                    <div className="rounded-md border border-border-subtle bg-surface-2/50 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <div className="text-primary font-medium">3) Kontextusos +/- (lineup)</div>
                          {renderThresholdTooltip(playerAdvancedInsights.thresholdHints.impact)}
                        </div>
                        {'confidence' in playerAdvancedInsights.plusMinusContext && (
                          <Badge className={getSampleConfidenceBadgeClass(normalizeSampleConfidence(playerAdvancedInsights.plusMinusContext.confidence))}>{formatSampleConfidenceLabel(normalizeSampleConfidence(playerAdvancedInsights.plusMinusContext.confidence))}</Badge>
                        )}
                      </div>
                      <p className={`text-[11px] leading-relaxed ${getInsightToneClass(playerAdvancedInsights.blockVerdicts.impact.tone)}`}>
                        {playerAdvancedInsights.blockVerdicts.impact.text}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">Pályán: {formatNullableNumber(playerAdvancedInsights.plusMinusContext.onNet40, 1)} net/40</span>
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">Pályán kívül: {formatNullableNumber(playerAdvancedInsights.plusMinusContext.offNet40, 1)} net/40</span>
                        <span className={`px-1.5 py-0.5 rounded bg-surface-2 text-[10px] ${Number(playerAdvancedInsights.plusMinusContext.delta ?? 0) >= 0 ? 'text-positive' : 'text-negative'}`}>
                          On/Off delta: {formatNullableNumber(playerAdvancedInsights.plusMinusContext.delta, 1)}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-muted">Minta: {playerAdvancedInsights.plusMinusContext.lineupMinutes.toFixed(0)} perc</span>
                      </div>
                      {playerAdvancedInsights.plusMinusContext.topPair && (
                        <div className="text-[10px] text-muted">
                          Legjobb páros: {playerAdvancedInsights.plusMinusContext.topPair.label} ({playerAdvancedInsights.plusMinusContext.topPair.netPer40.toFixed(1)} net/40)
                        </div>
                      )}
                    </div>

                    {/* 4) Szerepkör-hatékonyság */}
                    <div className="rounded-md border border-border-subtle bg-surface-2/50 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <div className="text-primary font-medium">4) Szerepkör-hatékonyság</div>
                          {renderThresholdTooltip(playerAdvancedInsights.thresholdHints.role)}
                        </div>
                        {'confidence' in playerAdvancedInsights.roleEfficiency && (
                          <Badge className={getSampleConfidenceBadgeClass(normalizeSampleConfidence(playerAdvancedInsights.roleEfficiency.confidence))}>{formatSampleConfidenceLabel(normalizeSampleConfidence(playerAdvancedInsights.roleEfficiency.confidence))}</Badge>
                        )}
                      </div>
                      <p className={`text-[11px] leading-relaxed ${getInsightToneClass(playerAdvancedInsights.blockVerdicts.role.tone)}`}>
                        {playerAdvancedInsights.blockVerdicts.role.text}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">Ball-handler TS/PPP: {formatNullableNumber(playerAdvancedInsights.roleEfficiency.ballHandlerTs, 1, '%')} / {formatNullableNumber(playerAdvancedInsights.roleEfficiency.ballHandlerPpp, 3)}</span>
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">Off-ball TS/PPP: {formatNullableNumber(playerAdvancedInsights.roleEfficiency.offBallTs, 1, '%')} / {formatNullableNumber(playerAdvancedInsights.roleEfficiency.offBallPpp, 3)}</span>
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">Rim nyomás TS%: {formatNullableNumber(playerAdvancedInsights.roleEfficiency.rimPressureTs, 1, '%')}</span>
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">Magas 3PA TS%: {formatNullableNumber(playerAdvancedInsights.roleEfficiency.highThreeTs, 1, '%')}</span>
                      </div>
                      {'ballHandlerSample' in playerAdvancedInsights.roleEfficiency && 'offBallSample' in playerAdvancedInsights.roleEfficiency && (
                        <div className="text-[10px] text-muted">Minta: ball-handler {playerAdvancedInsights.roleEfficiency.ballHandlerSample} • off-ball {playerAdvancedInsights.roleEfficiency.offBallSample} meccs</div>
                      )}
                    </div>

                    {/* 5) Döntésminőség index */}
                    <div className="rounded-md border border-border-subtle bg-surface-2/50 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <div className="text-primary font-medium">5) Döntésminőség index</div>
                          {renderThresholdTooltip(playerAdvancedInsights.thresholdHints.decision)}
                        </div>
                        {'confidence' in playerAdvancedInsights.decisionQuality && (
                          <Badge className={getSampleConfidenceBadgeClass(normalizeSampleConfidence(playerAdvancedInsights.decisionQuality.confidence))}>{formatSampleConfidenceLabel(normalizeSampleConfidence(playerAdvancedInsights.decisionQuality.confidence))}</Badge>
                        )}
                      </div>
                      <p className={`text-[11px] leading-relaxed ${getInsightToneClass(playerAdvancedInsights.blockVerdicts.decision.tone)}`}>
                        {playerAdvancedInsights.blockVerdicts.decision.text}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-cyan font-semibold">{playerAdvancedInsights.decisionQuality.score.toFixed(1)} / 100 — {playerAdvancedInsights.decisionQuality.tier}</span>
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">AST/TO: {playerAdvancedInsights.decisionQuality.astTo.toFixed(2)}</span>
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">TOV%: {playerAdvancedInsights.decisionQuality.tovPct.toFixed(1)}%</span>
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">Midrange arány: {playerAdvancedInsights.decisionQuality.midRate.toFixed(1)}%</span>
                      </div>
                    </div>

                    {/* 6) Stabilitás és hullámzás */}
                    <div className="rounded-md border border-border-subtle bg-surface-2/50 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <div className="text-primary font-medium">6) Stabilitás és hullámzás</div>
                          {renderThresholdTooltip(playerAdvancedInsights.thresholdHints.stability)}
                        </div>
                        {'confidence' in playerAdvancedInsights.stability && (
                          <Badge className={getSampleConfidenceBadgeClass(normalizeSampleConfidence(playerAdvancedInsights.stability.confidence))}>{formatSampleConfidenceLabel(normalizeSampleConfidence(playerAdvancedInsights.stability.confidence))}</Badge>
                        )}
                      </div>
                      <p className={`text-[11px] leading-relaxed ${getInsightToneClass(playerAdvancedInsights.blockVerdicts.stability.tone)}`}>
                        {playerAdvancedInsights.blockVerdicts.stability.text}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">Volatilitás: {playerAdvancedInsights.stability.volatility.toFixed(1)} / 100</span>
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">TS szórás: {playerAdvancedInsights.stability.tsStd.toFixed(1)}</span>
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">PPP szórás: {playerAdvancedInsights.stability.pppStd.toFixed(3)}</span>
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">TO szórás: {playerAdvancedInsights.stability.tovStd.toFixed(1)} pp</span>
                        <span className={`px-1.5 py-0.5 rounded bg-surface-2 text-[10px] ${playerAdvancedInsights.stability.trend >= 0 ? 'text-positive' : 'text-negative'}`}>
                          Trend (TS): {playerAdvancedInsights.stability.trend >= 0 ? '+' : ''}{playerAdvancedInsights.stability.trend.toFixed(1)} pp
                        </span>
                      </div>
                    </div>

                    {/* 7) Matchup érzékenység */}
                    <div className="rounded-md border border-border-subtle bg-surface-2/50 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <div className="text-primary font-medium">7) Matchup érzékenység</div>
                          {renderThresholdTooltip(playerAdvancedInsights.thresholdHints.matchup)}
                        </div>
                        {'confidence' in playerAdvancedInsights.matchupSensitivity && (
                          <Badge className={getSampleConfidenceBadgeClass(normalizeSampleConfidence(playerAdvancedInsights.matchupSensitivity.confidence))}>{formatSampleConfidenceLabel(normalizeSampleConfidence(playerAdvancedInsights.matchupSensitivity.confidence))}</Badge>
                        )}
                      </div>
                      <p className={`text-[11px] leading-relaxed ${getInsightToneClass(playerAdvancedInsights.blockVerdicts.matchup.tone)}`}>
                        {playerAdvancedInsights.blockVerdicts.matchup.text}
                        {'interpretation' in playerAdvancedInsights.matchupSensitivity && playerAdvancedInsights.matchupSensitivity.interpretation
                          ? ` (${playerAdvancedInsights.matchupSensitivity.interpretation})` : ''}
                      </p>
                      {playerAdvancedInsights.matchupSensitivity.available ? (
                        <>
                          <div className="flex flex-wrap gap-1.5">
                            <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">Erős véd. TS/PPP: {formatNullableNumber(playerAdvancedInsights.matchupSensitivity.strongTs, 1, '%')} / {formatNullableNumber(playerAdvancedInsights.matchupSensitivity.strongPpp, 3)}</span>
                            <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">Gyengébb véd. TS/PPP: {formatNullableNumber(playerAdvancedInsights.matchupSensitivity.weakTs, 1, '%')} / {formatNullableNumber(playerAdvancedInsights.matchupSensitivity.weakPpp, 3)}</span>
                            <span className={`px-1.5 py-0.5 rounded bg-surface-2 text-[10px] ${Number(playerAdvancedInsights.matchupSensitivity.tsDelta ?? 0) >= 0 ? 'text-positive' : 'text-negative'}`}>
                              TS delta: {formatNullableNumber(playerAdvancedInsights.matchupSensitivity.tsDelta, 1, ' pp')}
                            </span>
                          </div>
                          {'strongOpponents' in playerAdvancedInsights.matchupSensitivity && playerAdvancedInsights.matchupSensitivity.strongOpponents?.length > 0 && (
                            <div className="text-[10px] text-muted">Erős: {playerAdvancedInsights.matchupSensitivity.strongOpponents.join(' • ')}</div>
                          )}
                          {'weakOpponents' in playerAdvancedInsights.matchupSensitivity && playerAdvancedInsights.matchupSensitivity.weakOpponents?.length > 0 && (
                            <div className="text-[10px] text-muted">Gyengébb: {playerAdvancedInsights.matchupSensitivity.weakOpponents.join(' • ')}</div>
                          )}
                        </>
                      ) : (
                        <div className="text-[10px] text-secondary">Nincs elég minta az ellenfél-minőség szerinti splithez.</div>
                      )}
                    </div>

                    {/* 8) Fáradás és terhelés */}
                    <div className="rounded-md border border-border-subtle bg-surface-2/50 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <div className="text-primary font-medium">8) Fáradás és terhelés</div>
                          {renderThresholdTooltip(playerAdvancedInsights.thresholdHints.fatigue)}
                        </div>
                        {'confidence' in playerAdvancedInsights.fatigueLoad && (
                          <Badge className={getSampleConfidenceBadgeClass(normalizeSampleConfidence(playerAdvancedInsights.fatigueLoad.confidence))}>{formatSampleConfidenceLabel(normalizeSampleConfidence(playerAdvancedInsights.fatigueLoad.confidence))}</Badge>
                        )}
                      </div>
                      <p className={`text-[11px] leading-relaxed ${getInsightToneClass(playerAdvancedInsights.blockVerdicts.fatigue.tone)}`}>
                        {playerAdvancedInsights.blockVerdicts.fatigue.text}
                        {'note' in playerAdvancedInsights.fatigueLoad && playerAdvancedInsights.fatigueLoad.note
                          ? ` ${playerAdvancedInsights.fatigueLoad.note}` : ''}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">High-load meccsek: {playerAdvancedInsights.fatigueLoad.highLoadGames}</span>
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">B2B minta: {playerAdvancedInsights.fatigueLoad.b2bGames}</span>
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">High-load TS%: {formatNullableNumber(playerAdvancedInsights.fatigueLoad.highLoadTs, 1, '%')}</span>
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">Normál TS%: {formatNullableNumber(playerAdvancedInsights.fatigueLoad.normalLoadTs, 1, '%')}</span>
                        <span className={`px-1.5 py-0.5 rounded bg-surface-2 text-[10px] ${Number(playerAdvancedInsights.fatigueLoad.tsDrop ?? 0) >= 0 ? 'text-positive' : 'text-negative'}`}>
                          TS különbség: {formatNullableNumber(playerAdvancedInsights.fatigueLoad.tsDrop, 1, ' pp')}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">B2B TOV%: {formatNullableNumber(playerAdvancedInsights.fatigueLoad.b2bTovPct, 1, '%')}</span>
                      </div>
                    </div>

                    {/* 9–13) advancedBlocks — dobásprofil, játéképítés, védekezés, pontszerzés, hatékonyság */}
                    {advancedBlocks && (<>
                    <div className="rounded-md border border-border-subtle bg-surface-2/50 p-3 space-y-2">
                      <div className="text-primary font-medium">9) Dobásprofil (per-36)</div>
                      <p className="text-[11px] leading-relaxed text-secondary">{advancedBlocks.shooting.narrative}</p>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">TS%: {advancedBlocks.shooting.tsPct.toFixed(1)}%</span>
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">eFG%: {advancedBlocks.shooting.efg.toFixed(1)}%</span>
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">3P%: {advancedBlocks.shooting.threePct.toFixed(1)}%</span>
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">FT%: {advancedBlocks.shooting.ftPct.toFixed(1)}%</span>
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">Rim: {(advancedBlocks.shooting.rimRate * 100).toFixed(0)}% ({advancedBlocks.shooting.closeEffPct.toFixed(0)}%)</span>
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">Mid: {(advancedBlocks.shooting.midRate * 100).toFixed(0)}% ({advancedBlocks.shooting.midEffPct.toFixed(0)}%)</span>
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">3P-arány: {(advancedBlocks.shooting.threeRate * 100).toFixed(0)}%</span>
                      </div>
                    </div>

                    <div className="rounded-md border border-border-subtle bg-surface-2/50 p-3 space-y-2">
                      <div className="text-primary font-medium">10) Játéképítés (per-36)</div>
                      <p className="text-[11px] leading-relaxed text-secondary">{advancedBlocks.playmaking.narrative}</p>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">AST/36: {advancedBlocks.playmaking.astPer36.toFixed(1)}</span>
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">AST/TO: {advancedBlocks.playmaking.astTo.toFixed(2)}</span>
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">Usage/36: {advancedBlocks.playmaking.usageProxy.toFixed(1)}</span>
                      </div>
                    </div>

                    <div className="rounded-md border border-border-subtle bg-surface-2/50 p-3 space-y-2">
                      <div className="text-primary font-medium">11) Védekezés (per-36)</div>
                      <p className="text-[11px] leading-relaxed text-secondary">{advancedBlocks.defense.narrative}</p>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">STL/36: {advancedBlocks.defense.stlPer36.toFixed(1)}</span>
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">BLK/36: {advancedBlocks.defense.blkPer36.toFixed(1)}</span>
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">DREB/36: {advancedBlocks.defense.defRebPer36.toFixed(1)}</span>
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">Faultok/36: {advancedBlocks.defense.foulsPer36.toFixed(1)}</span>
                      </div>
                    </div>

                    <div className="rounded-md border border-border-subtle bg-surface-2/50 p-3 space-y-2">
                      <div className="text-primary font-medium">12) Pontszerzés (per-36)</div>
                      <p className="text-[11px] leading-relaxed text-secondary">{advancedBlocks.scoring.narrative}</p>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">PTS/36: {advancedBlocks.scoring.ptsPer36.toFixed(1)}</span>
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">TS%: {advancedBlocks.scoring.tsPct.toFixed(1)}%</span>
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">Usage/36: {advancedBlocks.scoring.usageProxy.toFixed(1)}</span>
                      </div>
                    </div>

                    <div className="rounded-md border border-border-subtle bg-surface-2/50 p-3 space-y-2">
                      <div className="text-primary font-medium">13) Összhatékonyság (per-36)</div>
                      <p className="text-[11px] leading-relaxed text-secondary">{advancedBlocks.efficiency.narrative}</p>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">VAL/36: {advancedBlocks.efficiency.valPer36.toFixed(1)}</span>
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">TS%: {advancedBlocks.efficiency.tsPct.toFixed(1)}%</span>
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-secondary">eFG%: {advancedBlocks.efficiency.efg.toFixed(1)}%</span>
                      </div>
                    </div>
                    </>)}

                    </div>
                  </TooltipProvider>

                  {playerAdvancedInsights.coachingFocus.length > 0 && (
                    <div className="space-y-1 rounded-md border border-cyan-900/70 bg-cyan-950/20 p-3">
                      <div className="text-xs font-medium text-cyan-200">Edzői fókusz (automatikus)</div>
                      {playerAdvancedInsights.coachingFocus.map(item => (
                        <div key={item} className="text-xs text-cyan-100">• {item}</div>
                      ))}
                    </div>
                  )}

                  <div className="text-[11px] text-muted">
                    Megjegyzés: több blokk továbbra is proxy mutatókat használ (lineup/pályahatás), de a clutch blokk ezen a nézeten már a Kosarstat clutch stat oldalról épül.
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="font-display uppercase tracking-wide text-primary">Összegzett értékelés</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2 text-primary">
                  <div className="text-secondary font-medium">Erősségek</div>
                  {analysis.strengths.length > 0 ? (
                    <ul className="list-disc list-inside space-y-1 text-pretty leading-relaxed">
                      {analysis.strengths.map(item => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-secondary">Nincs kiemelt erősség.</div>
                  )}
                </div>
                <div className="space-y-2 text-primary">
                  <div className="text-secondary font-medium">Limitációk</div>
                  {analysis.limitations.length > 0 ? (
                    <ul className="list-disc list-inside space-y-1 text-pretty leading-relaxed">
                      {analysis.limitations.map(item => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-secondary">Nincs kiemelt limitáció.</div>
                  )}
                </div>
                <div className="space-y-2 text-primary">
                  <div className="text-secondary font-medium">Javítandó pontok</div>
                  {analysis.improvements.length > 0 ? (
                    <ul className="list-disc list-inside space-y-1 text-pretty leading-relaxed">
                      {analysis.improvements.map(item => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-secondary">Nincs kiemelt javítandó pont.</div>
                  )}
                </div>
              </CardContent>
            </Card>

          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-display uppercase tracking-wide text-primary">Last 5 Games Performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {lastFiveGames.length > 0 ? (
                  lastFiveGames.map(game => (
                    <div key={game.id} className="rounded-lg border border-border-subtle bg-surface-2/40 p-3">
                      <div className="flex items-center justify-between text-primary">
                        <span>{game.games?.opponent ?? 'Ismeretlen ellenfél'}</span>
                        <span className="text-xs text-secondary">
                          {game.games?.date ? new Date(game.games.date).toLocaleDateString('hu-HU') : 'Ismeretlen dátum'}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-secondary">
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
                  <div className="text-secondary">Nincs elérhető meccs adat az utolsó 5 mérkőzéshez.</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-display uppercase tracking-wide text-primary">Hasonló profilok</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {similarityList.length > 0 ? (
                  similarityList.map(item => (
                    <div key={item.playerId} className="flex items-center justify-between text-primary">
                      <span>{item.name}</span>
                      <span className="text-secondary">{(item.similarity * 100).toFixed(0)}% – {item.reason}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-secondary">Nincs elég összehasonlítható minta.</div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {showTeamSection && <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="font-display uppercase tracking-wide text-primary">Csapat elemzés</CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="border-border-subtle hover:bg-surface-2 text-cyan shrink-0"
              onClick={() => {
                const teamPlayers = activeSeasonPlayers.filter(p => String(p.teamId ?? '') === String(resolvedTeamId));
                const n = Math.max(games.length, 1);
                const agg: GameAggregate = {
                  totalGames: games.length,
                  avgPoints: games.reduce((s, g) => s + g.ourScore, 0) / n,
                  avgRebounds: games.reduce((s, g) => s + g.players.reduce((ps, p) => ps + p.rebounds.total, 0), 0) / n,
                  avgAssists: games.reduce((s, g) => s + g.players.reduce((ps, p) => ps + p.assists, 0), 0) / n,
                  avgSteals: games.reduce((s, g) => s + g.players.reduce((ps, p) => ps + p.steals, 0), 0) / n,
                  avgBlocks: games.reduce((s, g) => s + g.players.reduce((ps, p) => ps + p.blocks, 0), 0) / n,
                  avgTurnovers: games.reduce((s, g) => s + g.players.reduce((ps, p) => ps + p.turnovers, 0), 0) / n,
                  avgValuation: games.reduce((s, g) => s + g.players.reduce((ps, p) => ps + p.valuation, 0), 0) / n,
                };
                const tName = allTeams.find(t => t.id === resolvedTeamId)?.name;
                const sName = allSeasons.find(s => s.id === resolvedSeasonId)?.name;
                const md = teamStatsToMd(teamPlayers, games, agg, tName, sName);
                const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `csapat-${(tName ?? 'statisztika').replace(/\s+/g, '-')}.md`;
                a.click();
                URL.revokeObjectURL(url);
                navigator.clipboard.writeText(md).catch(() => null);
                toast.success('MD exportálva – vágólapra másolva és letöltve');
              }}
            >
              <Download className="w-4 h-4 mr-2" />
              Export MD
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {resolvedTeamId === 'all' && (
            <div className="text-sm text-secondary">
              Válassz csapatot a csapat elemzéshez.
            </div>
          )}

          {resolvedTeamId !== 'all' && !effectiveTeamAnalysis && (
            <div className="text-sm text-secondary">
              Nincs elég adat a csapat elemzéséhez.
            </div>
          )}

          {resolvedTeamId !== 'all' && effectiveTeamAnalysis && (
            <div className="space-y-4 text-sm">
              <div className="text-sm text-primary leading-relaxed">{effectiveTeamAnalysis.summary}</div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm text-secondary font-medium">LLM csapatértékelés (gyenge pontok és matchup következmény)</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 rounded-md border border-border-subtlebg-surface-1/80 p-1">
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
                            ? 'h-7 px-2 bg-cyan text-base hover:bg-cyan/80'
                            : 'h-7 px-2 border-border-subtle text-secondary hover:bg-surface-2'}
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
                      disabled={isGeneratingTeamNarrative || !effectiveTeamAnalysis}
                      className="bg-indigo-500 hover:bg-indigo-400 text-white disabled:opacity-60"
                    >
                      {isGeneratingTeamNarrative ? 'LLM értékelés készül…' : teamNarrative.status === 'success' ? 'LLM értékelés frissítése' : 'LLM értékelés generálása'}
                    </Button>
                  </div>
                </div>
                {teamNarrative.status === 'error' && (
                  <div className="text-xs text-negative">{teamNarrative.error}</div>
                )}
                {teamNarrative.status === 'success' && teamNarrative.text && (
                  <div className="space-y-1">
                    <div className="text-[11px] text-muted">
                      Generálva: {formatGeneratedAt(teamNarrative.generatedAt) ?? 'ismeretlen'}
                      {teamNarrative.generatedBy ? ` • Forrás: ${teamNarrative.generatedBy}` : ''}
                    </div>
                    <div className="rounded-md border border-border-subtle bg-surface-2/40 px-3 py-2 text-sm text-primary whitespace-pre-line">
                      {teamNarrative.text}
                    </div>
                  </div>
                )}
                {teamNarrative.status === 'idle' && (
                  <div className="text-xs text-secondary">
                    Aktív stílus: {teamNarrativeStyle === 'fan' ? 'szurkolóbarát' : teamNarrativeStyle === 'coach' ? 'edzői' : 'scouting'}.
                    A gomb a meglévő csapat metrikákból és dobásprofilból készít szöveges taktikai értékelést.
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {effectiveTeamAnalysis.style.offense.map(style => (
                  <Badge key={style} className="badge-cyan">
                    {style}
                  </Badge>
                ))}
                {effectiveTeamAnalysis.style.defense.map(style => (
                  <Badge key={style} className="badge-positive">
                    {style}
                  </Badge>
                ))}
                {effectiveTeamAnalysis.style.offense.length === 0 && effectiveTeamAnalysis.style.defense.length === 0 && (
                  <Badge variant="secondary" className="badge-neutral">
                    Nincs egyértelmű stílusprofil
                  </Badge>
                )}
              </div>

              {teamFormSummary && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <div className="text-sm text-secondary font-medium">
                      Forma trend (utolsó {teamFormSummary.windowSize} meccs)
                    </div>
                    <Badge className={teamFormSummary.badgeClass}>{teamFormSummary.badgeLabel}</Badge>
                    <div className="text-sm text-primary">{teamFormSummary.description}</div>
                    <div className="text-xs text-secondary">
                      Pontkülönbség: {teamFormSummary.marginAvg >= 0 ? '+' : ''}{teamFormSummary.marginAvg.toFixed(1)} • Szezon: {teamFormSummary.seasonMargin >= 0 ? '+' : ''}{teamFormSummary.seasonMargin.toFixed(1)}
                    </div>
                    {teamFormSummary.recentEfgAvg !== null && teamFormSummary.efgDelta !== null && (
                      <div className="text-xs text-secondary">
                        eFG: {teamFormSummary.recentEfgAvg.toFixed(1)}% ({teamFormSummary.efgDelta >= 0 ? '+' : ''}{teamFormSummary.efgDelta.toFixed(1)} pp)
                      </div>
                    )}
                    <div className="text-xs text-secondary">
                      Volatilitás-index: {teamFormSummary.volatilityIndex.toFixed(1)} / 100
                      {' '}• eFG szórás: {teamFormSummary.efgStd.toFixed(1)}
                      {' '}• TS szórás: {teamFormSummary.tsStd.toFixed(1)}
                      {' '}• TO szórás: {teamFormSummary.tovStdPct.toFixed(1)} pp
                    </div>
                  </div>
                  <div className="lg:col-span-2">
                    <div className="h-56 rounded-lg border border-border-subtle bg-surface-1/60 p-3">
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
                                  tsPct: number | null;
                                  turnoverPct: number | null;
                                  ppp: number | null;
                                  result: 'win' | 'loss';
                                };
                                if (!datum) return null;
                                return (
                                  <div className="rounded-md border border-border-subtle bg-surface-1 px-3 py-2 text-xs text-primary space-y-1">
                                    <div className="font-semibold text-primary">
                                      {datum.label} • {datum.opponent}
                                    </div>
                                    <div>
                                      Eredmény: {datum.result === 'win' ? 'Győzelem' : 'Vereség'} ({datum.margin >= 0 ? '+' : ''}{datum.margin})
                                    </div>
                                    {typeof datum.efg === 'number' && (
                                      <div>eFG: {datum.efg.toFixed(1)}%</div>
                                    )}
                                    {typeof datum.tsPct === 'number' && (
                                      <div>TS: {datum.tsPct.toFixed(1)}%</div>
                                    )}
                                    {typeof datum.turnoverPct === 'number' && (
                                      <div>TO: {datum.turnoverPct.toFixed(1)}%</div>
                                    )}
                                    {typeof datum.ppp === 'number' && (
                                      <div>PPP: {datum.ppp.toFixed(3)}</div>
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
                            <Line
                              yAxisId="efg"
                              type="monotone"
                              dataKey="tsPct"
                              stroke="#a78bfa"
                              strokeWidth={2}
                              dot={{ r: 3 }}
                              name="TS%"
                              connectNulls
                            />
                            <Line
                              yAxisId="efg"
                              type="monotone"
                              dataKey="turnoverPct"
                              stroke="#f43f5e"
                              strokeWidth={2}
                              dot={{ r: 3 }}
                              name="TO%"
                              connectNulls
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="text-sm text-secondary">Nincs trend adat.</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {teamFormVolatilityData.length > 0 && teamFormPhaseSummary && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <div className="text-sm text-secondary font-medium">
                      Teljesítmény-hullámzás (rolling {TEAM_FORM_ROLLING_WINDOW} meccs)
                    </div>
                    <Badge className={teamFormPhaseSummary.latestBadgeClass}>
                      Aktuális fázis: {teamFormPhaseSummary.latest.phase}
                    </Badge>
                    <div className="text-xs text-secondary">
                      Fázis-pontszám: {teamFormPhaseSummary.latest.phaseScore.toFixed(1)} / 100
                    </div>
                    <div className="text-xs text-secondary">
                      Felfelé: {teamFormPhaseSummary.counts.Felfelé} • Stabil: {teamFormPhaseSummary.counts.Stabil}
                      {' '}• Hektikus: {teamFormPhaseSummary.counts.Hektikus} • Lejtmenet: {teamFormPhaseSummary.counts.Lejtmenet}
                    </div>
                    <div className="text-xs text-secondary">
                      A rolling panel megmutatja, hogy a hatékonyság trendje stabilan javul-e, vagy inkább variancia-vezérelt hullámzás látszik.
                    </div>
                  </div>
                  <div className="xl:col-span-2 space-y-3">
                    <div className="h-56 rounded-lg border border-border-subtle bg-surface-1/60 p-3">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={teamFormVolatilityData} margin={{ left: 8, right: 16 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                          <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                          <YAxis yAxisId="eff" stroke="#22d3ee" tick={{ fontSize: 11 }} width={52} domain={[35, 75]} />
                          <YAxis yAxisId="to" orientation="right" stroke="#f43f5e" tick={{ fontSize: 11 }} width={52} domain={[5, 25]} />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload || payload.length === 0) return null;
                              const datum = payload[0]?.payload as {
                                label: string;
                                rollEfg: number | null;
                                rollTs: number | null;
                                rollTo: number | null;
                                rollPpp: number | null;
                                phase: string;
                              };
                              if (!datum) return null;
                              return (
                                <div className="rounded-md border border-border-subtle bg-surface-1 px-3 py-2 text-xs text-primary space-y-1">
                                  <div className="font-semibold text-primary">{datum.label} • {datum.phase}</div>
                                  {typeof datum.rollEfg === 'number' && <div>Rolling eFG: {datum.rollEfg.toFixed(1)}%</div>}
                                  {typeof datum.rollTs === 'number' && <div>Rolling TS: {datum.rollTs.toFixed(1)}%</div>}
                                  {typeof datum.rollTo === 'number' && <div>Rolling TO: {datum.rollTo.toFixed(1)}%</div>}
                                  {typeof datum.rollPpp === 'number' && <div>Rolling PPP: {datum.rollPpp.toFixed(3)}</div>}
                                </div>
                              );
                            }}
                          />
                          <Line yAxisId="eff" type="monotone" dataKey="rollEfg" stroke="#22d3ee" strokeWidth={2} dot={{ r: 2 }} name="Rolling eFG%" connectNulls />
                          <Line yAxisId="eff" type="monotone" dataKey="rollTs" stroke="#a78bfa" strokeWidth={2} dot={{ r: 2 }} name="Rolling TS%" connectNulls />
                          <Line yAxisId="to" type="monotone" dataKey="rollTo" stroke="#f43f5e" strokeWidth={2} dot={{ r: 2 }} name="Rolling TO%" connectNulls />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="h-44 rounded-lg border border-border-subtle bg-surface-1/60 p-3">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={teamFormVolatilityData} margin={{ left: 8, right: 16 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                          <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                          <YAxis stroke="#f59e0b" tick={{ fontSize: 11 }} width={52} />
                          <Tooltip
                            formatter={(value: number | string | undefined, name?: string) => {
                              const numeric = Number(value ?? 0);
                              const label = name ?? '';
                              if (label.includes('PPP')) return [numeric.toFixed(3), label];
                              return [numeric.toFixed(1), label];
                            }}
                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '8px', color: '#f1f5f9' }}
                          />
                          <Legend wrapperStyle={{ color: '#94a3b8' }} verticalAlign="top" height={24} />
                          <Line type="monotone" dataKey="stdEfg" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} name="eFG szórás" connectNulls />
                          <Line type="monotone" dataKey="stdTs" stroke="#fb7185" strokeWidth={2} dot={{ r: 2 }} name="TS szórás" connectNulls />
                          <Line type="monotone" dataKey="stdPpp" stroke="#60a5fa" strokeWidth={2} dot={{ r: 2 }} name="PPP szórás" connectNulls />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="text-sm text-secondary font-medium">Szezon dobásprofil (Hunbasket)</div>
                {teamSeasonShotSummary ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="rounded-md bg-surface-2 border border-border-subtle px-3 py-2">
                        <div className="text-xs text-secondary">Kísérlet</div>
                        <div className="text-primary font-mono tabular-nums font-medium">{teamSeasonShotSummary.attempts}</div>
                      </div>
                      <div className="rounded-md bg-surface-2 border border-border-subtle px-3 py-2">
                        <div className="text-xs text-secondary">Bedobott</div>
                        <div className="text-primary font-mono tabular-nums font-medium">{teamSeasonShotSummary.made}</div>
                      </div>
                      <div className="rounded-md bg-surface-2 border border-border-subtle px-3 py-2">
                        <div className="text-xs text-secondary">FG%</div>
                        <div className="text-primary font-mono tabular-nums font-medium">{formatShotPct(teamSeasonShotSummary.fgPct)}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      <div className="p-3 bg-surface-2/40 rounded-lg">
                        <div className="text-sm text-secondary font-medium mb-2">Zónaeloszlás (%)</div>
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
                      <div className="p-3 bg-surface-2/40 rounded-lg">
                        <div className="text-sm text-secondary font-medium mb-2">Zónahatékonyság (FG%)</div>
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
                      <div className="p-3 bg-surface-2/40 rounded-lg space-y-2">
                        <div className="text-sm text-secondary font-medium">Szezon zóna heatmap</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <div className="text-xs text-secondary">Volumen (kísérlet)</div>
                            {teamSeasonHeatmapRows.map(row => (
                              <div key={`team-heat-rate-${row.label}`} className="rounded-md border border-border-subtle px-2 py-1" style={{
                                backgroundColor: `rgba(56, 189, 248, ${0.14 + row.rateNorm * 0.56})`,
                              }}>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-primary">{row.label}</span>
                                  <span className="text-base font-semibold">{row.attempts} ({row.rate.toFixed(1)}%)</span>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="space-y-1">
                            <div className="text-xs text-secondary">Hatékonyság (FG%)</div>
                            {teamSeasonHeatmapRows.map(row => (
                              <div key={`team-heat-pct-${row.label}`} className="rounded-md border border-border-subtle px-2 py-1" style={{
                                backgroundColor: `rgba(34, 197, 94, ${0.14 + row.pctNorm * 0.56})`,
                              }}>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-primary">{row.label}</span>
                                  <span className="text-base font-semibold">{row.pct.toFixed(1)}%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {teamLeagueRelativeZoneRows.length > 0 && (
                      <div className="p-3 bg-surface-2/40 rounded-lg space-y-2">
                        <div className="text-sm text-secondary font-medium">Liga-átlag overlay (relatív zónadelta)</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {teamLeagueRelativeZoneRows.map(row => {
                            const tone = row.rateDelta >= 0 ? 'text-positive' : 'text-negative';
                            const tonePct = row.pctDelta >= 0 ? 'text-positive' : 'text-negative';
                            const bgAlpha = Math.min(0.12 + Math.abs(row.rateDelta) / 25, 0.5);
                            return (
                              <div
                                key={`league-overlay-${row.label}`}
                                className="rounded-md border border-border-subtle px-2.5 py-2"
                                style={{
                                  backgroundColor: row.rateDelta >= 0
                                    ? `rgba(16, 185, 129, ${bgAlpha})`
                                    : `rgba(244, 63, 94, ${bgAlpha})`,
                                }}
                              >
                                <div className="text-xs text-primary font-medium">{row.label}</div>
                                <div className="text-xs text-secondary mt-1">
                                  Volumen delta: <span className={tone}>{row.rateDelta >= 0 ? '+' : ''}{row.rateDelta.toFixed(1)} pp</span>
                                </div>
                                <div className="text-xs text-secondary">
                                  FG% delta: <span className={tonePct}>{row.pctDelta >= 0 ? '+' : ''}{row.pctDelta.toFixed(1)} pp</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="text-[11px] text-muted">Pozitív delta: csapat a ligaátlag felett, negatív delta: ligaátlag alatt.</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-secondary">Nincs elérhető szezon dobástérkép adat ehhez a csapathoz.</div>
                )}
              </div>

              {teamTacticalWeaknesses.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm text-secondary font-medium">Adatalapú taktikai gyenge pontok</div>
                  {teamTacticalWeaknesses.map(item => (
                    <div key={item} className="text-sm text-warning rounded-md border border-warning/30 bg-warning/10 px-3 py-2">• {item}</div>
                  ))}
                </div>
              )}

              {(effectiveTeamAnalysis.lineupProfile || effectiveTeamAnalysis.clutchProfile || effectiveTeamAnalysis.impactProfile) && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                  <div className="rounded-lg border border-border-subtle bg-surface-1/60 p-3 space-y-2">
                    <div className="text-sm text-secondary font-medium">Lineup stabilitás és döntéstámogatás</div>
                    {effectiveTeamAnalysis.lineupProfile?.topLineup && (
                      <div className="text-xs text-primary">
                        Legjobb 5-ös: <span className="text-positive">{effectiveTeamAnalysis.lineupProfile.topLineup.netPer40.toFixed(1)} net/40</span>
                        {' '}• {effectiveTeamAnalysis.lineupProfile.topLineup.players.join(', ')}
                        {' '}<span className="text-muted">({effectiveTeamAnalysis.lineupProfile.topLineup.minutes.toFixed(1)} perc, minta: {effectiveTeamAnalysis.lineupProfile.topLineup.sampleLabel})</span>
                      </div>
                    )}
                    {effectiveTeamAnalysis.lineupProfile?.bottomLineup && (
                      <div className="text-xs text-primary">
                        Legrosszabb 5-ös: <span className="text-negative">{effectiveTeamAnalysis.lineupProfile.bottomLineup.netPer40.toFixed(1)} net/40</span>
                        {' '}• {effectiveTeamAnalysis.lineupProfile.bottomLineup.players.join(', ')}
                        {' '}<span className="text-muted">({effectiveTeamAnalysis.lineupProfile.bottomLineup.minutes.toFixed(1)} perc, minta: {effectiveTeamAnalysis.lineupProfile.bottomLineup.sampleLabel})</span>
                      </div>
                    )}
                    {effectiveTeamAnalysis.lineupProfile?.topPair && (
                      <div className="text-xs text-secondary">
                        Legjobb páros: {effectiveTeamAnalysis.lineupProfile.topPair.players.join(' + ')}
                        {' '}<span className="text-positive">({effectiveTeamAnalysis.lineupProfile.topPair.netPer40.toFixed(1)} net/40)</span>
                      </div>
                    )}
                    {effectiveTeamAnalysis.lineupProfile?.bottomPair && (
                      <div className="text-xs text-secondary">
                        Legrosszabb páros: {effectiveTeamAnalysis.lineupProfile.bottomPair.players.join(' + ')}
                        {' '}<span className="text-negative">({effectiveTeamAnalysis.lineupProfile.bottomPair.netPer40.toFixed(1)} net/40)</span>
                      </div>
                    )}
                    {effectiveTeamAnalysis.lineupProfile?.rotationBreakpoint && (
                      <div className="text-xs text-warning rounded-md border border-warning/30 bg-warning/10px-2 py-1.5">
                        Rotációs töréspont: {effectiveTeamAnalysis.lineupProfile.rotationBreakpoint.minute?.toFixed(1) ?? '-'} perc
                        {' '}• {effectiveTeamAnalysis.lineupProfile.rotationBreakpoint.trigger}
                        {' '}• -{effectiveTeamAnalysis.lineupProfile.rotationBreakpoint.netDropPer40.toFixed(1)} net/40
                        {' '}({effectiveTeamAnalysis.lineupProfile.rotationBreakpoint.confidence})
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-border-subtle bg-surface-1/60 p-3 space-y-2">
                    <div className="text-sm text-secondary font-medium">Clutch identitás blokk</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-md border border-border-subtle bg-surface-2 px-2 py-1.5 text-primary">ORtg: {formatNullableNumber(effectiveTeamAnalysis.clutchProfile?.ortg, 1)}</div>
                      <div className="rounded-md border border-border-subtle bg-surface-2 px-2 py-1.5 text-primary">DRtg: {formatNullableNumber(effectiveTeamAnalysis.clutchProfile?.drtg, 1)}</div>
                      <div className="rounded-md border border-border-subtle bg-surface-2 px-2 py-1.5 text-primary">Net: {formatNullableNumber(effectiveTeamAnalysis.clutchProfile?.net, 1)}</div>
                      <div className="rounded-md border border-border-subtle bg-surface-2 px-2 py-1.5 text-primary">TO%: {formatNullableNumber(effectiveTeamAnalysis.clutchProfile?.tovPct, 1, '%')}</div>
                      <div className="rounded-md border border-border-subtle bg-surface-2 px-2 py-1.5 text-primary">REB%: {formatNullableNumber(effectiveTeamAnalysis.clutchProfile?.rebPct, 1, '%')}</div>
                      <div className="rounded-md border border-border-subtle bg-surface-2 px-2 py-1.5 text-primary">FT-rate: {formatNullableNumber(effectiveTeamAnalysis.clutchProfile?.ftRate, 1)}</div>
                    </div>
                    <div className="text-xs text-secondary">
                      Lezáró profil: {effectiveTeamAnalysis.clutchProfile?.topUsageClosers.length
                        ? effectiveTeamAnalysis.clutchProfile.topUsageClosers.map(item => `${item.player} (${(item.usageShare * 100).toFixed(1)}%)`).join(', ')
                        : 'nincs elegendő minta'}
                    </div>
                    <div className="text-xs text-secondary">
                      Assist/TO: {formatNullableNumber(effectiveTeamAnalysis.clutchProfile?.assistToTurnover, 2)} •
                      {' '}minta: {effectiveTeamAnalysis.clutchProfile?.sampleLabel ?? 'n/a'}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border-subtle bg-surface-1/60 p-3 space-y-2">
                    <div className="text-sm text-secondary font-medium">Impact (+/-) kontextus</div>
                    <div className="text-xs text-primary">Best net/40: {formatNullableNumber(effectiveTeamAnalysis.impactProfile?.bestNetPer40, 1)}</div>
                    <div className="text-xs text-primary">Worst net/40: {formatNullableNumber(effectiveTeamAnalysis.impactProfile?.worstNetPer40, 1)}</div>
                    <div className="text-xs text-primary">Adjusted net/40: {formatNullableNumber(effectiveTeamAnalysis.impactProfile?.adjustedNetPer40, 1)}</div>
                    <div className="text-xs text-secondary">
                      SOS súly: {formatNullableNumber(effectiveTeamAnalysis.impactProfile?.sosWeight, 3)}
                      {' '}• Garbage-time szűrve: {effectiveTeamAnalysis.impactProfile?.garbageTimeFiltered ? 'igen' : 'nem'}
                      {' '}• Minta: {formatNullableNumber(effectiveTeamAnalysis.impactProfile?.sampleMinutes, 1)} perc
                    </div>
                  </div>
                </div>
              )}

              {effectiveTeamAnalysis.shotMapProfile?.available && (
                <div className="space-y-2">
                  <div className="text-sm text-secondary font-medium">Shot-quality profil</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2">
                    {effectiveTeamAnalysis.shotMapProfile.zones.map(zone => (
                      <div key={`sq-${zone.key}`} className="rounded-md border border-border-subtle bg-surface-2 px-2.5 py-2 text-xs">
                        <div className="text-primary font-mono tabular-nums font-medium">{zone.label}</div>
                        <div className="text-secondary">Vol: {zone.rate.toFixed(1)}%</div>
                        <div className="text-secondary">FG%: {zone.pct.toFixed(1)}%</div>
                        <div className={zone.rateDeltaVsLeague >= 0 ? 'text-positive' : 'text-negative'}>
                          Liga vol delta: {zone.rateDeltaVsLeague >= 0 ? '+' : ''}{zone.rateDeltaVsLeague.toFixed(1)} pp
                        </div>
                        <div className={zone.pctDeltaVsLeague >= 0 ? 'text-positive' : 'text-negative'}>
                          Liga FG delta: {zone.pctDeltaVsLeague >= 0 ? '+' : ''}{zone.pctDeltaVsLeague.toFixed(1)} pp
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-secondary">
                    Minőség-index (támadás): {formatNullableNumber(effectiveTeamAnalysis.shotMapProfile.offenseQualityIndex, 1)}
                    {' '}• Minőség-index (engedett): {formatNullableNumber(effectiveTeamAnalysis.shotMapProfile.allowedQualityIndex, 1)}
                  </div>
                </div>
              )}

              {effectiveTeamAnalysis.actionableFocus && effectiveTeamAnalysis.actionableFocus.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm text-secondary font-medium">Actionable fókusz (edzői)</div>
                  {effectiveTeamAnalysis.actionableFocus.map(item => (
                    <div key={item} className="text-sm text-cyan-100 rounded-md border border-cyan-700/40 bg-cyan-950/20 px-3 py-2">• {item}</div>
                  ))}
                </div>
              )}

              {(effectiveTeamAnalysis.formProfile || effectiveTeamAnalysis.defensiveProfile) && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {effectiveTeamAnalysis.formProfile && (
                    <div className="rounded-lg border border-border-subtle bg-surface-1/60 p-3 space-y-2">
                      <div className="text-sm text-secondary font-medium">Forma és volatilitás olvasat</div>
                      <div className="text-xs text-primary">
                        Trend: {effectiveTeamAnalysis.formProfile.trendLabel}
                        {effectiveTeamAnalysis.formProfile.volatilityLabel ? ` • ${effectiveTeamAnalysis.formProfile.volatilityLabel}` : ''}
                      </div>
                      {effectiveTeamAnalysis.formProfile.volatilityIndex !== null && (
                        <div className="text-xs text-secondary">
                          Volatilitás-index: {effectiveTeamAnalysis.formProfile.volatilityIndex.toFixed(1)} / 100
                        </div>
                      )}
                      {effectiveTeamAnalysis.formProfile.notes.map(note => (
                        <div key={note} className="text-xs text-secondary">• {note}</div>
                      ))}
                    </div>
                  )}

                  {effectiveTeamAnalysis.defensiveProfile && (
                    <div className="rounded-lg border border-border-subtle bg-surface-1/60 p-3 space-y-2">
                      <div className="text-sm text-secondary font-medium">Defensive profile</div>
                      <div className="text-xs text-secondary">Adatbiztonság: {effectiveTeamAnalysis.defensiveProfile.availability}</div>
                      <div className="text-xs text-primary">Gyűrűvédekezés: {effectiveTeamAnalysis.defensiveProfile.rimProtection}</div>
                      <div className="text-xs text-primary">Periméter: {effectiveTeamAnalysis.defensiveProfile.perimeterDefense}</div>
                      <div className="text-xs text-primary">Lepattanózás: {effectiveTeamAnalysis.defensiveProfile.rebounding}</div>
                      <div className="text-xs text-primary">Fault-discipline: {effectiveTeamAnalysis.defensiveProfile.foulDiscipline}</div>
                      {effectiveTeamAnalysis.defensiveProfile.notes.map(note => (
                        <div key={note} className="text-xs text-secondary">• {note}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-sm text-secondary font-medium">Erősségek</div>
                  {effectiveTeamAnalysis.strengths.length > 0 ? (
                    <ul className="list-disc list-inside space-y-1 text-sm text-primary text-pretty leading-relaxed">
                      {effectiveTeamAnalysis.strengths.map(item => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm text-secondary">Nincs kiemelt erősség.</div>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-secondary font-medium">Limitációk</div>
                  {effectiveTeamAnalysis.limitations.length > 0 ? (
                    <ul className="list-disc list-inside space-y-1 text-sm text-primary text-pretty leading-relaxed">
                      {effectiveTeamAnalysis.limitations.map(item => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm text-secondary">Nincs kiemelt limitáció.</div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm text-secondary font-medium">Liga összevetés (percentilis)</div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="h-72 rounded-lg border border-border-subtle bg-surface-1/60 p-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={effectiveTeamAnalysis.leagueProfile.entries}
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
                              <div className="rounded-md border border-border-subtle bg-surface-1 px-3 py-2 text-xs text-primary">
                                <div className="text-sm font-semibold text-primary">{data.label}</div>
                                <div className="text-secondary">Percentilis: {data.percentile}</div>
                                <div className="text-secondary">Nyers érték: {formatLeagueValue(data.key, data.value)}</div>
                                <div className="text-secondary">{data.tier}</div>
                              </div>
                            );
                          }}
                        />
                        <Bar dataKey="percentile" radius={[4, 4, 4, 4]}>
                          {effectiveTeamAnalysis.leagueProfile.entries.map(entry => (
                            <Cell key={entry.key} fill={getPercentileColor(entry.percentile)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2 text-sm">
                    {effectiveTeamAnalysis.leagueProfile.entries.map(entry => (
                      <div key={entry.key} className="flex items-center justify-between text-primary">
                        <span>{entry.label}</span>
                        <span className="text-secondary">
                          {entry.tier} • {entry.percentile}. percentilis
                        </span>
                      </div>
                    ))}
                    <div className="text-xs text-secondary">
                      Liga-klaszter: {effectiveTeamAnalysis.leagueProfile.clusterLabel}
                      {effectiveTeamAnalysis.leagueProfile.clusterCount && effectiveTeamAnalysis.leagueProfile.teamCount
                        ? ` (${effectiveTeamAnalysis.leagueProfile.clusterCount}/${effectiveTeamAnalysis.leagueProfile.teamCount} csapat)`
                        : ''}
                    </div>
                    {!effectiveTeamAnalysis.leagueProfile.opponentStatsComplete && (
                      <div className="text-xs text-warning">
                        Opponent statisztikák hiányosak, védekezési profil korlátozott.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <div className="text-sm text-secondary font-medium">Posztmegoszlás</div>
                  {(Object.entries(effectiveTeamAnalysis.rosterSummary.positionMinutesShare) as Array<[Position, number]>)
                    .map(([pos, share]) => ({
                      pos,
                      share,
                      label: getPositionLabel(pos),
                      players: effectiveTeamAnalysis.rosterSummary.positionPlayers[pos] ?? [],
                    }))
                    .map(({ pos, share, label, players }) => (
                      <div key={pos} className="text-sm text-primary space-y-0.5">
                        <div>
                          {label}: {share.toFixed(1)}%
                        </div>
                        {players.length > 0 && (
                          <div className="text-xs text-secondary">
                            {players.slice(0, 4).join(', ')}
                            {players.length > 4 ? '…' : ''}
                          </div>
                        )}
                      </div>
                    ))}
                  {effectiveTeamAnalysis.rosterSummary.avgHeightOverall && (
                    <div className="text-xs text-secondary">
                      Átlagmagasság: {effectiveTeamAnalysis.rosterSummary.avgHeightOverall.toFixed(1)} cm
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-secondary font-medium">Role-megoszlás</div>
                  {Object.keys(effectiveTeamAnalysis.rosterSummary.roleCounts).length > 0 ? (
                    Object.entries(effectiveTeamAnalysis.rosterSummary.roleCounts).map(([role, count]) => (
                      <div key={role} className="text-sm text-primary space-y-0.5">
                        <div>
                          {count >= 3
                            ? `${role}: redundáns (${count}) – rotációs előny, de szerepütközés lehetséges`
                            : count === 0
                              ? `${role}: hiány – taktikai opció nem elérhető`
                              : `${role}: ${count}`}
                        </div>
                        {(() => {
                          const playerNames = effectiveTeamAnalysis.rosterSummary.rolePlayers[role] ?? [];
                          if (playerNames.length === 0 && (rolePlayersByRole.get(role)?.length ?? 0) === 0) return null;
                          const inferredNames = playerNames.length > 0
                            ? playerNames
                            : rolePlayersByRole.get(role) ?? [];
                          if (inferredNames.length === 0) return null;
                          return (
                            <div className="text-xs text-secondary">
                              {inferredNames.slice(0, 4).join(', ')}
                              {inferredNames.length > 4 ? '…' : ''}
                            </div>
                          );
                        })()}
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-secondary">Nincs szerepkör adat.</div>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-secondary font-medium">Usage koncentráció</div>
                  <div className="text-sm text-primary">
                    Top2 usage arány: {(effectiveTeamAnalysis.rosterSummary.top2UsageShare * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-secondary">
                    {effectiveTeamAnalysis.rosterSummary.flags.scorerDependency && '• Túlzott scorer-függőség'}
                    {effectiveTeamAnalysis.rosterSummary.flags.lowPlaymakingDepth && ' • Alacsony playmaking depth'}
                    {effectiveTeamAnalysis.rosterSummary.flags.weakReboundingPresence && ' • Lepattanó hiány posztonként'}
                  </div>
                </div>
              </div>

              {effectiveTeamAnalysis.rosterInsights.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm text-secondary font-medium">Roster értelmezés</div>
                  {effectiveTeamAnalysis.rosterInsights.map(item => (
                    <div key={item} className="text-sm text-primary">• {item}</div>
                  ))}
                </div>
              )}

              {effectiveTeamAnalysis.riskPriorities.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm text-secondary font-medium">Kockázatok</div>
                  {effectiveTeamAnalysis.riskPriorities.map(item => (
                    <div key={item} className="text-sm text-primary">• {item}</div>
                  ))}
                </div>
              )}

            </div>
          )}
        </CardContent>
      </Card>}

      {showProjectionSection && <Card>
        <CardHeader>
          <CardTitle className="font-display uppercase tracking-wide text-primary">Várható alapszakasz végeredmény (modell)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {projectedStandings.length === 0 ? (
            <div className="space-y-2">
              <div className="text-sm text-secondary">
                Az előrejelzéshez nincs elérhető tabella snapshot a kiválasztott szezonhoz.
              </div>
              <div className="text-xs text-secondary">
                Importálj tabellát a Tabella fülön a jelenlegi szezonhoz, majd futtasd a menetrend importot az Import fülön.
              </div>
            </div>
          ) : (
            <>
              {usedLegacyStandingsFallback && (
                <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                  Legacy tabella snapshot került felhasználásra (season_id nélküli rekord). Érdemes a szezonhoz kötött tabellát újraimportálni.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-wide text-secondary">Szcenárió mód</div>
                  <Select value={projectionScenario} onValueChange={(value: 'baseline' | 'form' | 'upset') => setProjectionScenario(value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Válassz szcenáriót" />
                    </SelectTrigger>
                    <SelectContent className="">
                      <SelectItem value="baseline">Alap</SelectItem>
                      <SelectItem value="form">Forma-követő (utolsó 5 meccs erősebb súly)</SelectItem>
                      <SelectItem value="upset">Upset-figyelő (nagyobb variancia)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-md border border-border-subtlebg-surface-2/60 px-3 py-2 text-xs text-secondary">
                  Aktív profil: <span className="font-semibold text-primary">{projectionScenarioSettings.label}</span>
                  <div className="mt-1 text-secondary">
                    A modell csapatstatisztikákból számolt erősségre épül, utolsó 5 meccs súlyozással.
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-border-subtlebg-surface-2/50 p-3 space-y-3">
                <div className="text-xs uppercase tracking-wide text-secondary">What-if panel</div>
                <div className="rounded-md border border-border-subtle bg-surface-1/60 px-3 py-2 text-xs text-secondary space-y-1">
                  <div className="font-medium text-primary">Használati útmutató</div>
                  <div>1. Válassz szcenárió módot (Alap / Forma-követő / Upset-figyelő).</div>
                  <div>2. Állítsd a Hazai pálya delta és Variancia delta csúszkákat a kívánt modellérzékenységhez.</div>
                  <div>3. Ha egy csapatra külön becslést szeretnél, válaszd ki és adj meg -2 és +2 közötti erősség deltát, majd kattints az Alkalmaz gombra.</div>
                  <div>4. Az aktív korrekciók chipként látszanak; kattintással egyesével törölhetők, a Reset mindent nulláz.</div>
                  <div className="text-secondary">Pozitív csapat-delta növeli, negatív csökkenti a csapat matchup esélyeit.</div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="text-xs text-secondary">
                    Hazai pálya delta: <span className="font-semibold text-primary">{whatIfHomeAdvantageDelta >= 0 ? '+' : ''}{whatIfHomeAdvantageDelta.toFixed(2)}</span>
                    <input
                      type="range"
                      min={-0.3}
                      max={0.3}
                      step={0.01}
                      value={whatIfHomeAdvantageDelta}
                      onChange={(event) => setWhatIfHomeAdvantageDelta(Number(event.target.value))}
                      className="mt-1 w-full"
                    />
                  </label>
                  <label className="text-xs text-secondary">
                    Variancia delta (logistic): <span className="font-semibold text-primary">{whatIfLogisticDelta >= 0 ? '+' : ''}{whatIfLogisticDelta.toFixed(2)}</span>
                    <input
                      type="range"
                      min={-0.25}
                      max={0.25}
                      step={0.01}
                      value={whatIfLogisticDelta}
                      onChange={(event) => setWhatIfLogisticDelta(Number(event.target.value))}
                      className="mt-1 w-full"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_auto_auto] gap-2 items-end">
                  <div>
                    <div className="text-xs text-secondary mb-1">Csapat erősség korrekció</div>
                    <Select value={whatIfTeamKey} onValueChange={setWhatIfTeamKey}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Válassz csapatot" />
                      </SelectTrigger>
                      <SelectContent className="">
                        {whatIfTeamOptions.map(option => (
                          <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <div className="text-xs text-secondary mb-1">Delta (-2..+2)</div>
                    <Input
                      value={whatIfTeamDeltaInput}
                      onChange={(event) => setWhatIfTeamDeltaInput(event.target.value)}
                      className=""
                    />
                  </div>
                  <Button type="button" size="sm" onClick={applyWhatIfTeamAdjustment} className="bg-cyan-600 hover:bg-cyan-500 text-white">
                    Alkalmaz
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={resetWhatIfSettings} className="border-border-subtle text-secondary hover:bg-surface-2">
                    Reset
                  </Button>
                </div>

                {Object.keys(whatIfTeamAdjustments).length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs text-secondary">Aktív csapat-korrekciók</div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(whatIfTeamAdjustments).map(([teamKey, delta]) => {
                        const label = whatIfTeamOptions.find(item => item.key === teamKey)?.label ?? teamKey;
                        return (
                          <button
                            key={teamKey}
                            type="button"
                            onClick={() => removeWhatIfTeamAdjustment(teamKey)}
                            className="rounded-full border border-border-subtle px-2 py-1 text-xs text-primary hover:bg-surface-2"
                          >
                            {label}: {delta >= 0 ? '+' : ''}{delta.toFixed(2)} ×
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-md border border-border-subtlebg-surface-2/40 p-3">
                <div className="text-xs uppercase tracking-wide text-secondary mb-2">Forma ellenőrzés (utolsó 5 meccs)</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border-subtle text-secondary">
                        <th className="text-left py-1 pr-2">Csapat</th>
                        <th className="text-right py-1 pr-2">Mérleg</th>
                        <th className="text-right py-1 pr-2">Win%</th>
                        <th className="text-right py-1">Net/meccs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from(recentFormByTeamKey.values())
                        .sort((a, b) => b.winRate - a.winRate || b.netPerGame - a.netPerGame)
                        .slice(0, 10)
                        .map(item => (
                          <tr key={item.team} className="border-b border-border-subtle">
                            <td className="py-1 pr-2 text-primary">{item.team}</td>
                            <td className="py-1 pr-2 text-right text-secondary">{item.wins}-{item.losses}</td>
                            <td className="py-1 pr-2 text-right text-secondary">{(item.winRate * 100).toFixed(0)}%</td>
                            <td className={`py-1 text-right ${item.netPerGame >= 0 ? 'text-positive' : 'text-negative'}`}>
                              {item.netPerGame >= 0 ? '+' : ''}{item.netPerGame.toFixed(1)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {projectionContext && (
                <div className="rounded-lg border border-cyan-700/40 bg-cyan-950/20 px-4 py-3 text-sm text-cyan-100">
                  <div>
                    Várható alapszakasz seed: <span className="font-semibold">{projectionContext.seed}. hely</span>
                    {projectionFinalPlaceForSelectedTeam && (
                      <span className="ml-2 text-cyan-200">
                        • Várható végső hely: <span className="font-semibold text-cyan-100">{projectionFinalPlaceForSelectedTeam}. hely</span>
                      </span>
                    )}
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

              {projectionWhyForSelectedTeam && (
                <div className="rounded-md border border-indigo-700/40 bg-indigo-950/20 px-4 py-3 space-y-2">
                  <div className="text-xs uppercase tracking-wide text-indigo-200">Miért ez a várható végső hely?</div>
                  <div className="text-sm text-indigo-100">
                    {projectionWhyForSelectedTeam.selectedTeamName} erősségi score: {projectionWhyForSelectedTeam.selectedStrength >= 0 ? '+' : ''}
                    {projectionWhyForSelectedTeam.selectedStrength.toFixed(2)}
                  </div>
                  {projectionWhyForSelectedTeam.selectedForm && (
                    <div className="text-sm text-indigo-200">
                      Utolsó {projectionWhyForSelectedTeam.selectedForm.games} meccs forma: {projectionWhyForSelectedTeam.selectedForm.wins}-
                      {projectionWhyForSelectedTeam.selectedForm.losses}, nettó {projectionWhyForSelectedTeam.selectedForm.netPerGame >= 0 ? '+' : ''}
                      {projectionWhyForSelectedTeam.selectedForm.netPerGame.toFixed(1)} pont/meccs.
                    </div>
                  )}
                  {projectionWhyForSelectedTeam.selectedScheduleStrength && (
                    <div className="text-sm text-indigo-200">
                      Ellenfél-erősség (SOS): szezon {projectionWhyForSelectedTeam.selectedScheduleStrength.season >= 0 ? '+' : ''}
                      {projectionWhyForSelectedTeam.selectedScheduleStrength.season.toFixed(2)} • utolsó 5 {projectionWhyForSelectedTeam.selectedScheduleStrength.recent >= 0 ? '+' : ''}
                      {projectionWhyForSelectedTeam.selectedScheduleStrength.recent.toFixed(2)}.
                    </div>
                  )}
                  {projectionWhyForSelectedTeam.qfSeries && (
                    <div className="text-sm text-indigo-200">
                      Negyeddöntő esély: {projectionWhyForSelectedTeam.qfSeries.winner} várható győzelmi esélye{' '}
                      {(Math.max(projectionWhyForSelectedTeam.qfSeries.homeWinProbability, projectionWhyForSelectedTeam.qfSeries.awayWinProbability) * 100).toFixed(1)}%
                      .
                    </div>
                  )}
                  {projectionWhyForSelectedTeam.h2hLine && (
                    <div className="text-sm text-indigo-200">{projectionWhyForSelectedTeam.h2hLine}</div>
                  )}
                </div>
              )}

              <div className="rounded-md border border-border-subtlebg-surface-2/40 p-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-secondary">Hátralévő meccsek (interaktív)</div>
                    <div className="text-sm text-primary">
                      {activeProjectionTeamName
                        ? `${activeProjectionTeamName} hátralévő alapszakasz meccsei`
                        : 'Kattints egy csapatra az előrejelzett tabellában'}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={resetWinnerOverrides}
                    className="border-border-subtle text-secondary hover:bg-surface-2"
                  >
                    Győztes-felülírás reset
                  </Button>
                </div>

                {remainingProjectionGamesForSelectedTeam.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border-subtle text-secondary">
                          <th className="text-left py-2 pr-2">Dátum</th>
                          <th className="text-left py-2 pr-2">Párharc</th>
                          <th className="text-right py-2 pr-2">Modell W%</th>
                          <th className="text-right py-2 pr-2">Figyelembe vett W%</th>
                          <th className="text-right py-2">Győztes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {remainingProjectionGamesForSelectedTeam.map(item => (
                          <tr key={item.fixtureId} className="border-b border-border-subtle">
                            <td className="py-2 pr-2 text-secondary">{item.gameDate}</td>
                            <td className="py-2 pr-2 text-primary">
                              {item.isHome ? 'H' : 'V'}: {item.ownTeam} vs {item.opponent}
                            </td>
                            <td className="py-2 pr-2 text-right text-secondary">{(item.ownModelWinProbability * 100).toFixed(1)}%</td>
                            <td className={`py-2 pr-2 text-right ${item.overrideWinnerSide ? 'text-cyan font-medium' : 'text-secondary'}`}>
                              {(item.ownAppliedWinProbability * 100).toFixed(1)}%
                            </td>
                            <td className="py-2 text-right">
                              <Select
                                value={item.overrideWinnerSide ?? 'model'}
                                onValueChange={(value) => setFixtureWinnerOverride(item.fixtureId, value as 'model' | 'home' | 'away')}
                              >
                                <SelectTrigger className="ml-auto w-45">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="">
                                  <SelectItem value="model">Modell alapján</SelectItem>
                                  <SelectItem value="home">{item.homeTeam}</SelectItem>
                                  <SelectItem value="away">{item.awayTeam}</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-xs text-secondary">Az adott csapatnál nincs több hátralévő meccs a menetrendben.</div>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-subtle text-secondary">
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
                      const rowTeamKey = normalizeTeamKey(row.team);
                      const isSelectedTeam = rowTeamKey === activeProjectionTeamKey;

                      return (
                        <tr
                          key={row.team}
                          className={`border-b border-border-subtle ${isSelectedTeam ? 'bg-sky-900/20' : ''}`}
                        >
                          <td className="py-2 pr-2 text-primary">
                            <span className={isTop8 ? 'text-positive font-semibold' : 'text-secondary'}>{index + 1}</span>
                          </td>
                          <td className="py-2 pr-2 text-primary">
                            <button
                              type="button"
                              onClick={() => setSelectedProjectionTeamKey(rowTeamKey)}
                              className={`text-left hover:text-cyan-300 ${isSelectedTeam ? 'text-cyan-200 font-medium' : ''}`}
                            >
                              {row.team}
                            </button>
                          </td>
                          <td className="py-2 pr-2 text-right text-secondary">
                            {row.currentWins}-{row.currentLosses}
                          </td>
                          <td className="py-2 pr-2 text-right text-primary">{row.projectedWins.toFixed(1)}</td>
                          <td className="py-2 pr-2 text-right text-primary">{row.projectedLosses.toFixed(1)}</td>
                          <td className="py-2 pr-2 text-right text-secondary">{(row.avgWinProbability * 100).toFixed(1)}%</td>
                          <td className="py-2 text-right text-cyan-300">+{row.expectedExtraWins.toFixed(1)}</td>
                          <td
                            className={`py-2 text-right ${
                              row.certaintyLabel === 'Magas'
                                ? 'text-positive'
                                : row.certaintyLabel === 'Közepes'
                                  ? 'text-warning'
                                  : 'text-secondary'
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

              {playoffProjection && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-positive/30 bg-positive/10px-4 py-3 text-sm text-positive">
                    <div className="font-medium">Rájátszás előrejelzés (modell)</div>
                    <div className="mt-1 text-positive">
                      Bajnok: <span className="font-semibold">{playoffProjection.champion}</span> •
                      Döntős: {playoffProjection.runnerUp} •
                      Bronz: {playoffProjection.third}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border-subtle text-secondary">
                          <th className="text-left py-2 pr-2">Kör</th>
                          <th className="text-left py-2 pr-2">Párharc</th>
                          <th className="text-right py-2 pr-2">Hazai ág esély</th>
                          <th className="text-right py-2 pr-2">Várható eredmény</th>
                          <th className="text-right py-2 pr-2">Győztes</th>
                          <th className="text-right py-2">Bizonyosság</th>
                        </tr>
                      </thead>
                      <tbody>
                        {playoffProjection.series.map(item => (
                          <tr key={`${item.round}-${item.homeTeam}-${item.awayTeam}`} className="border-b border-border-subtle">
                            <td className="py-2 pr-2 text-secondary">{item.round}</td>
                            <td className="py-2 pr-2 text-primary">
                              ({item.homeSeed}) {item.homeTeam} vs ({item.awaySeed}) {item.awayTeam}
                            </td>
                            <td className="py-2 pr-2 text-right text-primary">{(item.homeWinProbability * 100).toFixed(1)}%</td>
                            <td className="py-2 pr-2 text-right text-cyan-300">
                              {item.winner} ({item.mostLikelyScore})
                            </td>
                            <td className="py-2 pr-2 text-right">
                              <Select
                                value={playoffSeriesWinnerOverrides[item.seriesKey] ?? 'model'}
                                onValueChange={(value) => setPlayoffSeriesWinnerOverride(item.seriesKey, value as 'model' | 'home' | 'away')}
                              >
                                <SelectTrigger className="ml-auto w-45">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="">
                                  <SelectItem value="model">Modell alapján</SelectItem>
                                  <SelectItem value="home">{item.homeTeam}</SelectItem>
                                  <SelectItem value="away">{item.awayTeam}</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td
                              className={`py-2 text-right ${
                                item.certaintyLabel === 'Magas'
                                  ? 'text-positive'
                                  : item.certaintyLabel === 'Közepes'
                                    ? 'text-warning'
                                    : 'text-secondary'
                              }`}
                            >
                              {item.manualOverride ? 'Manuális' : item.certaintyLabel}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border-subtle text-secondary">
                          <th className="text-left py-2 pr-2">Várható végső hely</th>
                          <th className="text-left py-2 pr-2">Csapat</th>
                          <th className="text-left py-2">Megjegyzés</th>
                        </tr>
                      </thead>
                      <tbody>
                        {playoffProjection.finalRanking.map(row => (
                          <tr key={`${row.position}-${row.team}`} className="border-b border-border-subtle">
                            <td className="py-2 pr-2 text-primary font-mono tabular-nums font-medium">{row.position}.</td>
                            <td className="py-2 pr-2 text-primary">{row.team}</td>
                            <td className="py-2 text-secondary">{row.note || ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="text-xs text-secondary">
                A modell a jelenlegi tabellaállásból indul, és a hátralévő meccsekre várható győzelmi valószínűséget számol
                csapat-erősség (szezon + utolsó 5 meccs súlyozott statisztika), valamint hazai pálya alapján.
                A becslés korrigál ellenfél-erősséggel (SOS) is, szezonos és utolsó 5 meccses bontásban.
                A várható alapszakasz seed és a várható végső hely eltérhet, mert a playoff ág upseteket is tartalmazhat.
              </div>
            </>
          )}
        </CardContent>
      </Card>}

      {showPregameSection && <Card>
        <CardHeader>
          <CardTitle className="font-display uppercase tracking-wide text-primary">Pre-game elemzés</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-secondary mb-2 block">Ellenfél</label>
              <Select value={selectedOpponentTeamId} onValueChange={setSelectedOpponentTeamId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Válassz ellenfelet..." className="truncate" />
                </SelectTrigger>
                <SelectContent className="">
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
                  ? ''
                  : 'border-border-subtle text-secondary hover:bg-surface-2'}
              >
                Utolsó 5 meccs súlyozása
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm text-secondary">Saját sérültek / kihagyók</label>
                <Button
                  type="button"
                  size="sm"
                  variant={showOwnInjuryPicker ? 'default' : 'outline'}
                  disabled={pregameOwnRosterOptions.length === 0}
                  onClick={() => setShowOwnInjuryPicker(value => !value)}
                  className={showOwnInjuryPicker
                    ? 'bg-negative hover:bg-negative/80 text-white'
                    : 'border-border-subtle text-secondary hover:bg-surface-2'}
                >
                  {showOwnInjuryPicker ? 'Kész' : 'Sérültlista szerkesztése'}
                </Button>
              </div>
              <div className="text-xs text-secondary mt-1">
                {pregameOwnRosterOptions.length === 0
                  ? 'Válaszd ki a csapatot a lista betöltéséhez.'
                  : pregameOwnInjuryNames.length > 0
                    ? `Megjelölve: ${pregameOwnInjuryNames.join(', ')}`
                    : 'Jelöld ki a hiányzókat (nem számítjuk őket az elemzésben).'}
              </div>
              {showOwnInjuryPicker && pregameOwnRosterOptions.length > 0 && (
                <>
                  <div className="max-h-32 overflow-y-auto rounded-md border border-border-subtle bg-surface-2/70 p-2 flex flex-wrap gap-2 mt-2">
                    {pregameOwnRosterOptions.map(player => {
                      const isSelected = pregameOwnInjuries.includes(player.id);
                      return (
                        <button
                          type="button"
                          key={player.id}
                          onClick={() => handleToggleOwnInjury(player.id)}
                          className={`text-xs px-2 py-1 rounded-md border transition focus:outline-none focus:ring-2 focus:ring-cyan/50 ${
                            isSelected
                              ? 'bg-negative/15 border-negative/50 text-negative'
                              : 'bg-surface-1/60 border-border-subtle text-primary hover:border-border-active'
                          }`}
                          aria-pressed={isSelected}
                        >
                          {player.name}
                          <span className="text-[10px] text-muted ml-1">
                            ({POSITION_LABELS[player.position] ?? player.position})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-xs text-muted mt-1">
                    Válassz ki minden hiányzót, majd zárd a panelt a &quot;Kész&quot; gombbal.
                  </div>
                </>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm text-secondary">Ellenfél sérültek</label>
                <Button
                  type="button"
                  size="sm"
                  variant={showOpponentInjuryPicker ? 'default' : 'outline'}
                  disabled={pregameOpponentRosterOptions.length === 0}
                  onClick={() => setShowOpponentInjuryPicker(value => !value)}
                  className={showOpponentInjuryPicker
                    ? 'bg-negative hover:bg-negative/80 text-white'
                    : 'border-border-subtle text-secondary hover:bg-surface-2'}
                >
                  {showOpponentInjuryPicker ? 'Kész' : 'Sérültlista szerkesztése'}
                </Button>
              </div>
              <div className="text-xs text-secondary mt-1">
                {pregameOpponentRosterOptions.length === 0
                  ? 'Válassz ellenfelet a lista szerkesztéséhez.'
                  : pregameOpponentInjuryNames.length > 0
                    ? `Megjelölve: ${pregameOpponentInjuryNames.join(', ')}`
                    : 'Add meg, kik hiányozhatnak az ellenféltől.'}
              </div>
              {showOpponentInjuryPicker && pregameOpponentRosterOptions.length > 0 && (
                <>
                  <div className="max-h-32 overflow-y-auto rounded-md border border-border-subtle bg-surface-2/70 p-2 flex flex-wrap gap-2 mt-2">
                    {pregameOpponentRosterOptions.map(player => {
                      const isSelected = pregameOpponentInjuries.includes(player.id);
                      return (
                        <button
                          type="button"
                          key={player.id}
                          onClick={() => handleToggleOpponentInjury(player.id)}
                          className={`text-xs px-2 py-1 rounded-md border transition focus:outline-none focus:ring-2 focus:ring-cyan/50 ${
                            isSelected
                              ? 'bg-negative/15 border-negative/50 text-negative'
                              : 'bg-surface-1/60 border-border-subtle text-primary hover:border-border-active'
                          }`}
                          aria-pressed={isSelected}
                        >
                          {player.name}
                          <span className="text-[10px] text-muted ml-1">
                            ({POSITION_LABELS[player.position] ?? player.position})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-xs text-muted mt-1">
                    A jelöltek nem kerülnek bele a matchup elemzésbe és a GPT jelentésbe; zárd vissza a panelt a &quot;Kész&quot; gombbal.
                  </div>
                </>
              )}
            </div>
          </div>

          {!selectedOpponentTeamId && (
            <div className="text-sm text-secondary">Válassz ellenfelet a pre-game jelentéshez.</div>
          )}

          {selectedOpponentTeamId && !pregameReport && (
            <div className="text-sm text-secondary">Nincs elég adat a pre-game scoutinghoz.</div>
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
            const confidenceReasons = pregameReport.winProbability.confidenceReasons ?? [];
            const shotProfileContext = pregameReport.shotProfileContext;
            const efficiencyBaseline = pregameEfficiencyBaseline;
            const efficiencyModel = pregameEfficiencyModel;
            const ownOffenseLabels = ownProfile?.offense?.length ? ownProfile.offense : ['Kiegyensúlyozott támadás'];
            const ownDefenseLabels = ownProfile?.defense?.length ? ownProfile.defense : ['Nincs kiugró védőszignatúra'];
            const opponentOffenseLabels = opponentProfile?.offense?.length ? opponentProfile.offense : ['Kiegyensúlyozott támadás'];
            const opponentDefenseLabels = opponentProfile?.defense?.length ? opponentProfile.defense : ['Nincs kiugró védőszignatúra'];
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
                interactiveDelta = (perimeterWeight - 33) * 0.17 + (paintWeight - 33) * 0.05 + (pressureWeight - 33) * 0.03;
              } else if (scenario.key === 'high_variance') {
                interactiveDelta = (perimeterWeight - 33) * 0.12 + (paintWeight - 33) * 0.02 - (pressureWeight - 33) * 0.04;
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
              context: item.context,
            }));

            const shotProfileChartData = shotProfileContext
              ? shotProfileContext.ownZones.map(zone => {
                  const opponentZone = shotProfileContext.opponentZones.find(item => item.label === zone.label);
                  return {
                    label: zone.label,
                    ownRate: zone.rate,
                    opponentRate: opponentZone?.rate ?? 0,
                    ownPct: zone.pct,
                    opponentPct: opponentZone?.pct ?? 0,
                  };
                })
              : [];

            const shotProfileHeatmapCells = shotProfileContext
              ? shotProfileContext.ownZones.map(zone => ({
                  label: zone.label,
                  rateDelta: roundValue(zone.rateDeltaVsLeague - (shotProfileContext.opponentZones.find(item => item.label === zone.label)?.rateDeltaVsLeague ?? 0), 1),
                  pctDelta: roundValue(zone.pctDeltaVsLeague - (shotProfileContext.opponentZones.find(item => item.label === zone.label)?.pctDeltaVsLeague ?? 0), 1),
                  compositeDelta: roundValue(
                    (zone.rateDeltaVsLeague - (shotProfileContext.opponentZones.find(item => item.label === zone.label)?.rateDeltaVsLeague ?? 0)) * 0.6
                    + (zone.pctDeltaVsLeague - (shotProfileContext.opponentZones.find(item => item.label === zone.label)?.pctDeltaVsLeague ?? 0)) * 0.4,
                    1
                  ),
                }))
              : [];

            const offenseDefenseZoneData = shotProfileContext
              ? shotProfileContext.ownZones.map(zone => {
                  const opponentAllowed = shotProfileContext.opponentAllowedZones.find(item => item.label === zone.label);
                  const opponentOffense = shotProfileContext.opponentZones.find(item => item.label === zone.label);
                  const ownAllowed = shotProfileContext.ownAllowedZones.find(item => item.label === zone.label);
                  return {
                    label: zone.label,
                    ownOffensePct: zone.pct,
                    opponentAllowedPct: opponentAllowed?.pct ?? 0,
                    opponentOffensePct: opponentOffense?.pct ?? 0,
                    ownAllowedPct: ownAllowed?.pct ?? 0,
                    ownAttackEdge: roundValue(zone.pct - (opponentAllowed?.pct ?? 0), 1),
                    opponentAttackEdge: roundValue((opponentOffense?.pct ?? 0) - (ownAllowed?.pct ?? 0), 1),
                  };
                })
              : [];

            const focusWeightBars = [
              { label: 'Labdanyomás', value: pressureWeight, fill: '#f59e0b' },
              { label: 'Periméter', value: perimeterWeight, fill: '#38bdf8' },
              { label: 'Festék', value: paintWeight, fill: '#10b981' },
            ];
            const overallIntensityLabel = calibrationDiagnostics
              ? calibrationDiagnostics.overallIntensity >= 70
                ? 'Magas'
                : calibrationDiagnostics.overallIntensity >= 45
                  ? 'Közepes'
                  : 'Alacsony'
              : null;
            const recommendedFocusPreset = (() => {
              const strongestDimension = [...(calibrationDiagnostics?.dimensions ?? [])]
                .sort((a, b) => b.score - a.score)[0];
              if (!strongestDimension) return null;
              if (strongestDimension.key === 'perimeter_pressure') {
                return { label: 'Periméter-prioritás', pressure: 25, perimeter: 50, paint: 25 };
              }
              if (strongestDimension.key === 'ball_pressure') {
                return { label: 'Labdanyomás-prioritás', pressure: 45, perimeter: 30, paint: 25 };
              }
              if (strongestDimension.key === 'paint_edge') {
                return { label: 'Festék-prioritás', pressure: 25, perimeter: 30, paint: 45 };
              }
              return { label: 'Kiegyensúlyozott', pressure: 33, perimeter: 34, paint: 33 };
            })();
            const axisLabelMap: Record<'transition' | 'periméter' | 'festék', string> = {
              transition: 'átmeneti játék',
              periméter: 'periméter',
              festék: 'festék',
            };
            const formatDelta = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}`;
            const topFocusPoints = prioritizedFocusPoints.slice(0, 5);
            const secondaryFocusPoints = prioritizedFocusPoints.slice(5);
            const controlledScenario = adjustedScenarioOutcomes.find(item => item.key === 'controlled_tempo') ?? null;
            const highVarianceScenario = adjustedScenarioOutcomes.find(item => item.key === 'high_variance') ?? null;
            const pregameXAxisProps = {
              stroke: '#94a3b8',
              tick: { fill: '#94a3b8', fontSize: 10 },
              interval: 0 as const,
              angle: -18,
              textAnchor: 'end' as const,
              height: 56,
              tickMargin: 10,
            };
            const zoneChartLabelMap: Record<string, string> = {
              'Gyűrű': 'Gyűrű',
              'Festék': 'Festék',
              'Középtáv': 'Közép',
              'Sarok tripla': 'Sarok 3',
              'Egyéb tripla': 'Tripla',
            };
            const pregameOptimalLineupNarrative = (() => {
              if (!pregameOptimalLineup) return '';

              const best = pregameOptimalLineup.best;
              const roleMap = new Map(best.roleAssignments.map(item => [item.role, item.name] as const));
              const primaryAxis = pregameOptimalLineup.matchupWeights.perimeter >= pregameOptimalLineup.matchupWeights.paint
                && pregameOptimalLineup.matchupWeights.perimeter >= pregameOptimalLineup.matchupWeights.ballSecurity
                ? 'periméter'
                : pregameOptimalLineup.matchupWeights.paint >= pregameOptimalLineup.matchupWeights.ballSecurity
                  ? 'festék'
                  : 'labdabiztonság';

              const evidenceLine = best.exactSampleMinutes >= 10
                ? `A közvetlen ötösminta már használható méretű (${best.exactSampleMinutes.toFixed(1)} perc), ezért nem csak profil-, hanem konkrét lineup-bizonyíték is támogatja a döntést.`
                : best.exactSampleMinutes >= 4
                  ? `Van közvetlen ötösminta (${best.exactSampleMinutes.toFixed(1)} perc), de a modell ezt páros/trió szinergiával együtt értelmezi a kis minta miatt.`
                  : 'Közvetlen ötösminta limitált, ezért a rendszer főleg szerepkiosztási fitre és páros/trió szinergiára támaszkodik.';

              const roleLine = [
                roleMap.get('PG') ? `A labdás irányítás fő felelőse ${roleMap.get('PG')}.` : '',
                roleMap.get('SG') ? `${roleMap.get('SG')} második labdás/scorer tengelyt ad a backcourtban.` : '',
                roleMap.get('SF') ? `${roleMap.get('SF')} wing-kapcsoló szerepben stabilizálja a szerkezetet.` : '',
                roleMap.get('C') ? `${roleMap.get('C')} adja a belső védelmi és lepattanó alapot.` : '',
              ].filter(Boolean).join(' ');

              const reasonLine = best.reasons.length > 0
                ? `Fő döntési tényezők: ${best.reasons.slice(0, 2).join('; ')}.`
                : '';

              return `Szöveges indoklás: az ajánlott ötös a ${primaryAxis}-fókuszú matchupra optimalizál, miközben a valós rotációs stabilitást is megtartja. ${evidenceLine} ${roleLine} ${reasonLine}`.trim();
            })();
            const combinedKeyPlayerCards = (() => {
              const rows: Array<{
                teamKey: 'own' | 'opponent';
                teamLabel: string;
                accentClass: string;
                card: (typeof pregameOwnKeyPlayerFingerprints)[number];
              }> = [];
              const maxLength = Math.max(
                pregameOwnKeyPlayerFingerprints.length,
                pregameOpponentKeyPlayerFingerprints.length
              );

              for (let index = 0; index < maxLength; index += 1) {
                const ownCard = pregameOwnKeyPlayerFingerprints[index];
                const opponentCard = pregameOpponentKeyPlayerFingerprints[index];
                if (ownCard) {
                  rows.push({
                    teamKey: 'own',
                    teamLabel: ownLabel,
                    accentClass: 'border-positive/30 bg-positive/10',
                    card: ownCard,
                  });
                }
                if (opponentCard) {
                  rows.push({
                    teamKey: 'opponent',
                    teamLabel: opponentLabel,
                    accentClass: 'border-orange-800/50 bg-orange-950/10',
                    card: opponentCard,
                  });
                }
              }

              return rows;
            })();

            return (
              <div className="space-y-5">
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] gap-4">
                  <div className="p-4 bg-surface-2/50 rounded-lg space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-secondary">
                      <span>Elemzés nézőpontja: {ownLabel}</span>
                      <span>Ellenfél: {opponentLabel}</span>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm text-secondary font-medium">Pregame összkép</div>
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <div className="text-2xl font-semibold text-primary">{favoredTeamLabel}</div>
                          <div className="text-sm text-secondary">modellfavorit • {probabilitySpread}</div>
                        </div>
                        <div className="flex gap-2 text-xs">
                          <div className="px-2 py-1 rounded-full border border-positive/30 bg-positive/15 text-positive">
                            {ownLabel}: {pregameReport.winProbability.ownPct.toFixed(1)}%
                          </div>
                          <div className="px-2 py-1 rounded-full border border-orange-700/50 bg-orange-950/30 text-orange-200">
                            {opponentLabel}: {pregameReport.winProbability.opponentPct.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-surface-2 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-positive"
                        style={{ width: `${pregameReport.winProbability.ownPct}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div className="bg-surface-1/60 border border-border-subtle rounded-md px-3 py-2">
                        <div className="text-muted uppercase tracking-wide text-[10px]">Bizonyosság</div>
                        <div className="text-primary mt-1">{probabilityConfidenceLabel}</div>
                      </div>
                      <div className="bg-surface-1/60 border border-border-subtle rounded-md px-3 py-2">
                        <div className="text-muted uppercase tracking-wide text-[10px]">Domináns ellenfél-tengely</div>
                        <div className="text-primary mt-1">{axisLabelMap[llmContext?.opponentDominantAxis ?? 'periméter'] ?? 'periméter'}</div>
                      </div>
                      <div className="bg-surface-1/60 border border-border-subtle rounded-md px-3 py-2">
                        <div className="text-muted uppercase tracking-wide text-[10px]">Fő fókusz</div>
                        <div className="text-primary mt-1">{topFocusPoints[0] ?? 'Nincs kiemelt fókuszpont'}</div>
                      </div>
                    </div>
                    <div className="text-sm text-primary leading-relaxed whitespace-pre-line">{pregameReport.summary}</div>
                    {confidenceReasons.length > 0 && (
                      <div className="text-xs text-warning bg-warning/10 border border-warning/30 rounded-md px-3 py-2">
                        Bizonyosság oka: {confidenceReasons.join(' • ')}
                      </div>
                    )}
                    {(effectiveTeamAnalysis?.leagueProfile.clusterPeers?.length ?? 0) > 0 && (
                      <div className="text-xs text-muted space-y-1">
                        <div>Klaszter-társak: {effectiveTeamAnalysis?.leagueProfile.clusterPeers.join(', ')}</div>
                        <div>Ez stílusrokonságot jelez, nem közvetlen H2H- vagy eredménybizonyítékot.</div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    {fanSummary && (
                      <div className="p-3 bg-surface-2/50 rounded-lg space-y-3">
                        <div className="text-sm text-secondary font-medium">Szurkolói gyorskép</div>
                        <div className="text-sm text-primary">{fanSummary.headline}</div>
                        <div className="grid grid-cols-1 gap-2 text-sm">
                          <div className="bg-surface-1/60 border border-border-subtle rounded-md p-2">
                            <div className="text-xs uppercase tracking-wide text-muted mb-1">Előnyeink</div>
                            {fanSummary.keyEdges.length > 0 ? fanSummary.keyEdges.map(item => (
                              <div key={`fan-edge-${item}`} className="text-primary">• {item}</div>
                            )) : <div className="text-muted">Nincs kiemelt előny.</div>}
                          </div>
                          <div className="bg-surface-1/60 border border-border-subtle rounded-md p-2">
                            <div className="text-xs uppercase tracking-wide text-muted mb-1">Fő kockázatok</div>
                            {fanSummary.majorRisks.length > 0 ? fanSummary.majorRisks.map(item => (
                              <div key={`fan-risk-${item}`} className="text-primary">• {item}</div>
                            )) : <div className="text-muted">Nincs kiemelt kockázat.</div>}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="p-3 bg-surface-2/50 rounded-lg space-y-2">
                      <div className="text-sm text-secondary font-medium">Head-to-head</div>
                      {pregameHeadToHeadSummary.games > 0 ? (
                        <>
                          <div className="text-sm text-primary">
                            {ownLabel} vs {opponentLabel}: {pregameHeadToHeadSummary.ownWins}-{pregameHeadToHeadSummary.opponentWins}
                          </div>
                          <div className="text-xs text-secondary">
                            Átlagpontok: {pregameHeadToHeadSummary.ownAvgPoints.toFixed(1)} - {pregameHeadToHeadSummary.opponentAvgPoints.toFixed(1)}
                            {' '}({pregameHeadToHeadSummary.games} meccs)
                          </div>
                          {pregameHeadToHeadInsight && (
                            <div className="rounded-md border border-border-subtle bg-surface-2/40 px-3 py-2 space-y-1 text-xs">
                              <div className="text-primary">
                                Legutóbbi H2H: {pregameHeadToHeadInsight.ownScore}-{pregameHeadToHeadInsight.opponentScore}
                                {' '}• tripla: {pregameHeadToHeadInsight.ownThreePct.toFixed(1)}% - {pregameHeadToHeadInsight.opponentThreePct.toFixed(1)}%
                              </div>
                              {pregameHeadToHeadInsight.ownStandouts.length > 0 && (
                                <div className="text-secondary">Saját húzóemberek: {pregameHeadToHeadInsight.ownStandouts.join(', ')}</div>
                              )}
                              {pregameHeadToHeadInsight.opponentStandouts.length > 0 && (
                                <div className="text-secondary">Ellenfél húzóemberek: {pregameHeadToHeadInsight.opponentStandouts.join(', ')}</div>
                              )}
                              <div className="text-positive">Tanulság: {pregameHeadToHeadInsight.takeaway}</div>
                              <div className="text-warning">Veszély: {pregameHeadToHeadInsight.warning}</div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-sm text-secondary">Első találkozó a szezonban.</div>
                      )}
                    </div>

                    {pregameOptimalLineup && (
                      <div className="p-3 bg-surface-2/50 rounded-lg space-y-3">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="text-sm text-secondary font-medium">Ajánlott kezdő ötös az ellenfél ellen</div>
                          <div className={`text-[11px] px-2 py-1 rounded-full border ${
                            pregameOptimalLineup.best.certainty === 'high'
                              ? 'border-positive/30 bg-positive/15 text-positive'
                              : pregameOptimalLineup.best.certainty === 'medium'
                                ? 'border-warning/30 bg-warning/15 text-warning'
                                : 'border-border-subtle bg-surface-1/60 text-secondary'
                          }`}>
                            Bizonyosság: {pregameOptimalLineup.best.certainty === 'high' ? 'magas' : pregameOptimalLineup.best.certainty === 'medium' ? 'közepes' : 'alacsony'}
                          </div>
                        </div>
                        <div className="text-xs text-secondary">{pregameOptimalLineup.headline}</div>
                        <div className="flex flex-wrap gap-2">
                          {pregameOptimalLineup.best.roleAssignments.map(item => (
                            <Badge key={`pregame-optimal-${item.playerId}-${item.role}`} variant="secondary" className="bg-sky-900/30 text-sky-100 border border-sky-700/50">
                              {item.role}: {item.name}
                            </Badge>
                          ))}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                          <div className="rounded-md border border-border-subtle bg-surface-2/40 px-3 py-2">
                            <div className="text-muted">Közvetlen ötösminta</div>
                            <div className="text-primary mt-1">{pregameOptimalLineup.best.exactSampleMinutes.toFixed(1)} perc</div>
                            <div className="text-muted">{pregameOptimalLineup.best.exactNetPer40 !== null ? `${pregameOptimalLineup.best.exactNetPer40 >= 0 ? '+' : ''}${pregameOptimalLineup.best.exactNetPer40.toFixed(1)} net/40` : 'nincs direkt ötösminta'}</div>
                          </div>
                          <div className="rounded-md border border-border-subtle bg-surface-2/40 px-3 py-2">
                            <div className="text-muted">Páros / trió háttér</div>
                            <div className="text-primary mt-1">{pregameOptimalLineup.best.pairSampleMinutes.toFixed(1)} / {pregameOptimalLineup.best.trioSampleMinutes.toFixed(1)} perc</div>
                            <div className="text-muted">szinergia-shrinkage a kis mintára</div>
                          </div>
                          <div className="rounded-md border border-border-subtle bg-surface-2/40 px-3 py-2">
                            <div className="text-muted">Matchup-súlyok</div>
                            <div className="text-primary mt-1">Periméter {pregameOptimalLineup.matchupWeights.perimeter}%</div>
                            <div className="text-secondary">Festék {pregameOptimalLineup.matchupWeights.paint}% • Labdabiztonság {pregameOptimalLineup.matchupWeights.ballSecurity}%</div>
                          </div>
                        </div>
                        <div className="space-y-1 text-xs text-secondary">
                          {pregameOptimalLineup.best.reasons.map(reason => (
                            <div key={`pregame-optimal-reason-${reason}`}>• {reason}</div>
                          ))}
                        </div>
                        {pregameOptimalLineupNarrative && (
                          <div className="rounded-md border border-border-subtle bg-surface-2/40 px-3 py-2 text-xs text-primary leading-relaxed">
                            {pregameOptimalLineupNarrative}
                          </div>
                        )}
                        {pregameOptimalLineup.alternates.length > 0 && (
                          <div className="rounded-md border border-border-subtle bg-surface-2/40 px-3 py-2 space-y-2">
                            <div className="text-xs uppercase tracking-wide text-muted">Alternatív kezdő variációk</div>
                            {pregameOptimalLineup.alternates.map(option => (
                              <div key={`pregame-alt-${option.key}`} className="text-xs text-secondary">
                                <span className="text-primary">{option.roleAssignments.map(item => `${item.role}: ${item.name}`).join(', ')}</span>
                                {' '}• {option.reasons[0] ?? 'alternatív szerkezeti válasz'}
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="text-[11px] text-muted">
                          Forrás: {pregameOptimalLineup.sourceGames > 0 ? `${pregameOptimalLineup.sourceGames} aggregált Kosarstat lineup-meccs` : 'egyéni és matchup profil'} • {pregameOptimalLineup.candidateCount} vizsgált ötös.
                        </div>
                      </div>
                    )}

                    {(pregameInjuryImpactEstimate.own.valPer36 > 0 || pregameInjuryImpactEstimate.opponent.valPer36 > 0) && (
                      <div className="p-3 bg-surface-2/50 rounded-lg space-y-2">
                        <div className="text-sm text-secondary font-medium">Hiányzások becsült hatása</div>
                        <div className="text-xs text-muted">Csak legalább 4 meccses és 8 perc/meccs mintájú játékosokkal számolva.</div>
                        <div className="grid grid-cols-1 gap-3 text-sm">
                          <div className="bg-surface-1/60 border border-border-subtle rounded-md p-2">
                            <div className="text-xs uppercase tracking-wide text-muted mb-1">Saját kiesés</div>
                            <div className="text-negative">-{pregameInjuryImpactEstimate.own.valPer36.toFixed(1)} VAL/36</div>
                            <div className="text-negative">-{pregameInjuryImpactEstimate.own.pointsPer36.toFixed(1)} pont/36</div>
                            {pregameInjuryImpactEstimate.own.coreNames.length > 0 && (
                              <div className="text-xs text-secondary mt-1">
                                Kulcs kiesők: {pregameInjuryImpactEstimate.own.coreNames.join(', ')}
                              </div>
                            )}
                          </div>
                          <div className="bg-surface-1/60 border border-border-subtle rounded-md p-2">
                            <div className="text-xs uppercase tracking-wide text-muted mb-1">Ellenfél kiesés</div>
                            <div className="text-positive">-{pregameInjuryImpactEstimate.opponent.valPer36.toFixed(1)} VAL/36</div>
                            <div className="text-positive">-{pregameInjuryImpactEstimate.opponent.pointsPer36.toFixed(1)} pont/36</div>
                            {pregameInjuryImpactEstimate.opponent.coreNames.length > 0 && (
                              <div className="text-xs text-secondary mt-1">
                                Kulcs kiesők: {pregameInjuryImpactEstimate.opponent.coreNames.join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-xs uppercase tracking-[0.18em] text-muted px-1">Matchup réteg</div>

                {(ownProfile || opponentProfile) && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="p-3 bg-surface-2/50 rounded-lg space-y-3 lg:col-span-2">
                      <div className="text-sm text-secondary font-medium">Játékstílus összevetés</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <div className="flex items-center justify-between text-xs text-secondary">
                            <span>{ownLabel}</span>
                            <span>Tempó: {ownProfile?.tempo ?? 'n.a.'}</span>
                          </div>
                          {ownProfile ? (
                            <div className="mt-2 space-y-2 text-sm">
                              <div>
                                <div className="text-[11px] uppercase tracking-wide text-muted">Támadás</div>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {ownOffenseLabels.map(item => (
                                    <Badge
                                      key={`own-offense-${item}`}
                                      className="bg-sky-600/20 text-sky-200 border border-sky-700/40"
                                    >
                                      {item}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <div className="text-[11px] uppercase tracking-wide text-muted">Védekezés</div>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {ownDefenseLabels.map(item => (
                                    <Badge
                                      key={`own-defense-${item}`}
                                      className="bg-positive/15 text-positive border border-positive/30"
                                    >
                                      {item}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-2 text-xs text-muted">Ehhez a csapathoz még nincs profil adat.</div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center justify-between text-xs text-secondary">
                            <span>{opponentLabel}</span>
                            <span>Tempó: {opponentProfile?.tempo ?? 'n.a.'}</span>
                          </div>
                          {opponentProfile ? (
                            <div className="mt-2 space-y-2 text-sm">
                              <div>
                                <div className="text-[11px] uppercase tracking-wide text-muted">Támadás</div>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {opponentOffenseLabels.map(item => (
                                    <Badge
                                      key={`opp-offense-${item}`}
                                      className="bg-orange-600/20 text-orange-200 border border-orange-700/40"
                                    >
                                      {item}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <div className="text-[11px] uppercase tracking-wide text-muted">Védekezés</div>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {opponentDefenseLabels.map(item => (
                                    <Badge
                                      key={`opp-defense-${item}`}
                                      className="bg-positive/15 text-positive border border-positive/30"
                                    >
                                      {item}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-2 text-xs text-muted">Ehhez az ellenfélhez nincs profil adat.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {shotProfileContext && (
                    <div className="p-3 bg-surface-2/50 rounded-lg space-y-3">
                    <div className="text-sm text-secondary font-medium">Dobástérkép matchup</div>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      <div className="bg-surface-1/60 border border-border-subtle rounded-md p-2">
                        <div className="text-xs uppercase tracking-wide text-muted mb-2">Zónaarány összevetés</div>
                        <ResponsiveContainer width="100%" height={244}>
                          <BarChart data={shotProfileChartData} margin={{ top: 8, right: 8, left: 8, bottom: 22 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis
                              dataKey="label"
                              {...pregameXAxisProps}
                              angle={-28}
                              height={68}
                              tickFormatter={(value: string | number) => zoneChartLabelMap[String(value)] ?? String(value)}
                            />
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
                            <Bar dataKey="ownRate" name={`${ownLabel} zónaarány`} fill="#10b981" radius={[6, 6, 0, 0]} />
                            <Bar dataKey="opponentRate" name={`${opponentLabel} zónaarány`} fill="#f97316" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                        <div className="text-xs text-muted mt-1">A sávok a szezonos dobásmegoszlást mutatják zónánként.</div>
                      </div>
                      <div className="bg-surface-1/60 border border-border-subtle rounded-md p-2">
                        <div className="text-xs uppercase tracking-wide text-muted mb-2">Liga-delta heatmap</div>
                        <PostgameZoneHeatmapChart
                          cells={shotProfileHeatmapCells}
                          interpretation="relative"
                          perspectiveLabel={ownLabel}
                          opponentLabel={opponentLabel}
                        />
                        <div className="text-xs text-muted mt-1">Pozitív érték: saját liga-delta mínusz ellenfél liga-delta ugyanabban a zónában. Ezért lehet piros akkor is, ha az ellenfél ligaátlag felett dob az adott zónából.</div>
                      </div>
                    </div>
                    <div className="bg-surface-1/60 border border-border-subtle rounded-md p-2">
                      <div className="text-xs uppercase tracking-wide text-muted mb-2">Offense vs defense zóna-matchup</div>
                      <ResponsiveContainer width="100%" height={252}>
                        <BarChart data={offenseDefenseZoneData} margin={{ top: 8, right: 8, left: 8, bottom: 14 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis dataKey="label" {...pregameXAxisProps} />
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
                          <Bar dataKey="ownAttackEdge" name={`${ownLabel} támadás vs ${opponentLabel} engedett`} fill="#10b981" radius={[6, 6, 0, 0]} />
                          <Bar dataKey="opponentAttackEdge" name={`${opponentLabel} támadás vs ${ownLabel} engedett`} fill="#f97316" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="text-xs text-muted mt-1">A pozitív érték zónaszinten kedvezőbb támadás-védekezés matchupot jelez az adott oldalon.</div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-sm">
                      <div className="bg-surface-1/60 border border-border-subtle rounded-md p-2">
                        <div className="text-xs uppercase tracking-wide text-muted mb-2">Saját zónafegyverek</div>
                        {shotProfileContext.ownTopZones.length > 0 ? shotProfileContext.ownTopZones.map(zone => (
                          <div key={`own-shot-zone-${zone.label}`} className="flex items-center justify-between py-1 border-b border-border-subtle last:border-0">
                            <div>
                              <div className="text-primary">{zone.label}</div>
                              <div className="text-xs text-secondary">Arány: {zone.rate.toFixed(1)}% • Hatékonyság: {zone.pct.toFixed(1)}%</div>
                            </div>
                            <div className="text-right text-xs">
                              <div className={zone.rateDeltaVsLeague >= 0 ? 'text-positive' : 'text-negative'}>
                                {zone.rateDeltaVsLeague >= 0 ? '+' : ''}{zone.rateDeltaVsLeague.toFixed(1)} pp ráta
                              </div>
                              <div className={zone.pctDeltaVsLeague >= 0 ? 'text-positive' : 'text-negative'}>
                                {zone.pctDeltaVsLeague >= 0 ? '+' : ''}{zone.pctDeltaVsLeague.toFixed(1)} pp liga vs
                              </div>
                            </div>
                          </div>
                        )) : <div className="text-muted">Nincs elég saját shot-profile minta.</div>}
                      </div>
                      <div className="bg-surface-1/60 border border-border-subtle rounded-md p-2">
                        <div className="text-xs uppercase tracking-wide text-muted mb-2">Ellenfél zónafegyverek</div>
                        {shotProfileContext.opponentTopZones.length > 0 ? shotProfileContext.opponentTopZones.map(zone => (
                          <div key={`opp-shot-zone-${zone.label}`} className="flex items-center justify-between py-1 border-b border-border-subtle last:border-0">
                            <div>
                              <div className="text-primary">{zone.label}</div>
                              <div className="text-xs text-secondary">Arány: {zone.rate.toFixed(1)}% • Hatékonyság: {zone.pct.toFixed(1)}%</div>
                            </div>
                            <div className="text-right text-xs">
                              <div className={zone.rateDeltaVsLeague >= 0 ? 'text-orange-300' : 'text-secondary'}>
                                {zone.rateDeltaVsLeague >= 0 ? '+' : ''}{zone.rateDeltaVsLeague.toFixed(1)} pp ráta
                              </div>
                              <div className={zone.pctDeltaVsLeague >= 0 ? 'text-orange-300' : 'text-secondary'}>
                                {zone.pctDeltaVsLeague >= 0 ? '+' : ''}{zone.pctDeltaVsLeague.toFixed(1)} pp liga vs
                              </div>
                            </div>
                          </div>
                        )) : <div className="text-muted">Nincs elég ellenfél shot-profile minta.</div>}
                      </div>
                    </div>
                    {(shotProfileContext.notes.length > 0 || shotProfileContext.defenseNotes.length > 0 || shotProfileContext.clashZones.length > 0) && (
                      <div className="bg-surface-1/60 border border-border-subtle rounded-md p-2 space-y-1">
                        {shotProfileContext.notes.map(note => (
                          <div key={note} className="text-xs text-secondary">• {note}</div>
                        ))}
                        {shotProfileContext.defenseNotes.map(note => (
                          <div key={note} className="text-xs text-warning">• {note}</div>
                        ))}
                        {shotProfileContext.clashZones.length > 0 && (
                          <div className="text-xs text-warning">
                            Közös hangsúlyzónák: {shotProfileContext.clashZones.join(', ')}
                          </div>
                        )}
                      </div>
                    )}
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="p-3 bg-surface-2/50 rounded-lg">
                      <div className="text-sm text-secondary font-medium mb-2">Kulcsjátékosok</div>
                      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-3 mb-4">
                        {[
                          {
                            key: 'own',
                            title: ownLabel,
                            accentClass: 'border-positive/30 bg-positive/10',
                            groups: pregameReport.ownKeyPlayers,
                          },
                          {
                            key: 'opponent',
                            title: opponentLabel,
                            accentClass: 'border-orange-800/50 bg-orange-950/10',
                            groups: pregameReport.keyPlayers,
                          },
                        ].map(section => (
                          <div key={section.key} className={`rounded-md border p-3 space-y-2 ${section.accentClass}`}>
                            <div className="text-xs uppercase tracking-wide text-secondary">{section.title}</div>
                            <div className="text-xs text-secondary">Pontfelelősök: <span className="text-primary">{section.groups.primaryScorers.join(', ') || '-'}</span></div>
                            <div className="text-xs text-secondary">Szervezők: <span className="text-primary">{section.groups.primaryPlaymakers.join(', ') || '-'}</span></div>
                            <div className="text-xs text-secondary">Stretch: <span className="text-primary">{section.groups.stretchThreats.join(', ') || '-'}</span></div>
                            <div className="text-xs text-secondary">Mismatch: <span className="text-primary">{section.groups.mismatchCandidates.join(', ') || '-'}</span></div>
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
                        {combinedKeyPlayerCards.map(item => {
                          const player = item.card;
                          return (
                            <div key={`${item.teamKey}-${player.playerId}`} className={`rounded-md border p-3 space-y-2 ${item.accentClass}`}>
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="text-[11px] uppercase tracking-wide text-muted">{item.teamLabel}</div>
                                  <div className="text-sm font-medium text-primary">{player.name}</div>
                                  <div className="text-[11px] text-muted">{player.positionLabel} • {player.attempts} kísérlet</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-[11px] text-muted">FG%</div>
                                  <div className="text-sm text-warning">{player.fgPct.toFixed(1)}%</div>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {player.topZones.map(zone => (
                                  <Badge
                                    key={`${item.teamKey}-${player.playerId}-${zone.label}`}
                                    variant="secondary"
                                    className="border border-border-subtle bg-surface-2/70 text-[11px] text-primary"
                                  >
                                    {zone.label} {zone.rate.toFixed(0)}%
                                  </Badge>
                                ))}
                              </div>
                              <div className="text-[11px] text-secondary">{player.profileNote} • {player.sampleNote}</div>
                              <div className="space-y-2">
                                {player.zones.map(zone => (
                                  <div key={`${item.teamKey}-${player.playerId}-${zone.key}`} className="space-y-1">
                                    <div className="flex items-center justify-between text-[11px]">
                                      <span className="text-secondary">{zone.label}</span>
                                      <span className="text-muted">{zone.attempts} kís.</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                                      <div
                                        className={`${zone.fillClass} h-full rounded-full`}
                                        style={{ width: `${zone.attempts > 0 ? Math.max(zone.rate, 6) : 0}%` }}
                                      />
                                    </div>
                                    <div className="flex items-center justify-between text-[11px]">
                                      <span className="text-muted">Ráta {zone.rate.toFixed(1)}% • FG {zone.pct.toFixed(1)}%</span>
                                      <span className={zone.rateDeltaVsLeague >= 0 ? 'text-positive' : 'text-negative'}>
                                        {zone.rateDeltaVsLeague >= 0 ? '+' : ''}{zone.rateDeltaVsLeague.toFixed(1)} pp liga
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {pregameKeyMatchups.length > 0 && (
                        <div className="mt-4 space-y-2">
                          <div className="text-sm text-secondary font-medium">Kritikus párosítások</div>
                          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
                            {pregameKeyMatchups.map(item => (
                              <div key={`${item.title}-${item.ownPlayer}-${item.opponentPlayer}`} className="rounded-md border border-border-subtle bg-surface-2/40 p-3 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="text-sm text-primary font-medium">{item.title}</div>
                                  <div className={`text-[11px] px-2 py-1 rounded-full border ${
                                    item.edge === 'own'
                                      ? 'border-positive/30 bg-positive/15 text-positive'
                                      : item.edge === 'opponent'
                                        ? 'border-negative/30 bg-negative/15 text-negative'
                                        : 'border-border-subtle bg-surface-2 text-secondary'
                                  }`}>
                                    {item.edge === 'own' ? 'Saját él' : item.edge === 'opponent' ? 'Ellenfél él' : 'Kiegyenlített'}
                                  </div>
                                </div>
                                <div className="text-xs text-secondary">{item.ownPlayer} vs {item.opponentPlayer}</div>
                                <div className="text-xs text-secondary">{item.summary}</div>
                                <div className="text-xs text-warning">Taktikai kulcs: {item.tacticalNote}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      <div className="p-3 bg-surface-2/50 rounded-lg">
                        <div className="text-sm text-secondary font-medium mb-2">Fókuszpontok</div>
                        {topFocusPoints.length > 0 ? (
                          <div className="space-y-2">
                            {topFocusPoints.map(item => <div key={item} className="text-sm text-primary">• {item}</div>)}
                            {secondaryFocusPoints.length > 0 && (
                              <div className="pt-2 border-t border-border-subtle text-xs text-muted">
                                További pontok: {secondaryFocusPoints.join(' • ')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-sm text-secondary">Nincs kiemelt fókuszpont.</div>
                        )}
                      </div>

                      <div className="p-3 bg-surface-2/50 rounded-lg">
                        <div className="text-sm text-secondary font-medium mb-2">Kockázati térkép</div>
                        <div className="grid grid-cols-1 gap-3 text-sm">
                          <div>
                            <div className="text-xs uppercase tracking-wide text-muted mb-1">Fő veszélyek</div>
                            {pregameReport.threats.length > 0 ? (
                              pregameReport.threats.map(item => <div key={item} className="text-primary">• {item}</div>)
                            ) : (
                              <div className="text-secondary">Kiegyensúlyozott fegyvertár, extrém veszély nélkül.</div>
                            )}
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-wide text-muted mb-1">Feltételes sebezhetőségek</div>
                            {pregameReport.vulnerabilities.length > 0 ? (
                              <>
                                {pregameReport.vulnerabilities.map(item => <div key={item} className="text-primary">• {item}</div>)}
                                {pregameVulnerabilityPlaybook && (
                                  <div className="mt-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning space-y-1">
                                    <div>
                                      {pregameVulnerabilityPlaybook.title} ({ownLabel} {pregameVulnerabilityPlaybook.ownFtRatePct.toFixed(1)}% FT rate vs {opponentLabel} {pregameVulnerabilityPlaybook.opponentFtRatePct.toFixed(1)}%)
                                    </div>
                                    {pregameVulnerabilityPlaybook.actions.map(action => (
                                      <div key={action}>• {action}</div>
                                    ))}
                                    <div className="text-warning">Várható hatás: {pregameVulnerabilityPlaybook.expectedImpact}</div>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="text-secondary">Matchupfüggő, rendszerszintű rés nem látszik.</div>
                            )}
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-wide text-muted mb-1">Saját kockázati pontok</div>
                            {riskFlags.length > 0 ? (
                              riskFlags.map(item => <div key={item} className="text-primary">• {item}</div>)
                            ) : (
                              <div className="text-secondary">Általános faultterhelés- és lepattanó-kontroll figyelmeztetés, konkrét riasztás nélkül.</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-xs uppercase tracking-[0.18em] text-muted px-1">Interaktív modellezés</div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="p-3 bg-surface-2/50 rounded-lg">
                    <div className="text-sm text-secondary font-medium mb-2">Támadó-védő profil mutatók</div>
                    <ResponsiveContainer width="100%" height={248}>
                      <BarChart data={pregameStyleMetricChartData} margin={{ top: 8, right: 8, left: 8, bottom: 12 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="label" {...pregameXAxisProps} />
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
                    <div className="text-xs text-muted mt-1">
                      Tempó, tripla-, TO- és FT-mutatók összevetése gyors meccsképhez.
                    </div>
                  </div>

                  <div className="p-3 bg-surface-2/50 rounded-lg space-y-3">
                    <div className="text-sm text-secondary font-medium">Interaktív fókusz prioritás</div>
                    <div className="text-xs text-secondary">Súlyozd a meccsterv hangsúlyait; a kontrollált és a magas varianciás forgatókönyv azonnal újraszámolódik.</div>
                    <div className="space-y-2 text-xs text-secondary">
                      <label className="block">
                        <div className="flex justify-between mb-1"><span>Labdanyomás</span><span>{pressureWeight}%</span></div>
                        <input
                          type="range"
                          min={0}
                          max={100 - perimeterWeight}
                          step={1}
                          value={pressureWeight}
                          onChange={event => setPregamePressureWeight(Math.min(Number(event.target.value), 100 - perimeterWeight))}
                          className="w-full accent-warning"
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
                    <div className="rounded-md border border-border-subtle bg-surface-2/40 px-3 py-2 text-xs text-secondary space-y-1">
                      <div>Slider-hatás: labdanyomás emelése a press, visszazárás és TO-kontroll hangsúlyát növeli.</div>
                      <div>Periméter kontroll emelése a closeout-fegyelmet és a tiszta triplahelyzetek elvételét priorizálja.</div>
                      <div>Festék kontroll emelése a help-rotációt, rim protectiont és belső segítséget tolja előtérbe.</div>
                      {recommendedFocusPreset && (
                        <div className="text-warning">
                          Ajánlott preset ehhez a matchuphoz: {recommendedFocusPreset.label} ({recommendedFocusPreset.pressure}-{recommendedFocusPreset.perimeter}-{recommendedFocusPreset.paint}).
                        </div>
                      )}
                      {(controlledScenario || highVarianceScenario) && (
                        <div className="text-secondary">
                          Aktuális hatás: kontrollált forgatókönyv {controlledScenario ? `${controlledScenario.deltaVsBase >= 0 ? '+' : ''}${controlledScenario.deltaVsBase.toFixed(1)} pp` : 'n.a.'}, magas variancia {highVarianceScenario ? `${highVarianceScenario.deltaVsBase >= 0 ? '+' : ''}${highVarianceScenario.deltaVsBase.toFixed(1)} pp` : 'n.a.'} az alapmodellhez képest.
                        </div>
                      )}
                    </div>

                    <ResponsiveContainer width="100%" height={128}>
                      <BarChart data={focusWeightBars} layout="vertical" margin={{ top: 6, right: 10, left: 18, bottom: 6 }}>
                        <XAxis type="number" domain={[0, 100]} stroke="#94a3b8" tick={{ fontSize: 10 }} />
                        <YAxis dataKey="label" type="category" stroke="#94a3b8" tick={{ fontSize: 10 }} width={108} />
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

                {efficiencyBaseline && efficiencyModel && (
                  <div className="p-3 bg-surface-2/50 rounded-lg space-y-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <div className="text-sm text-secondary font-medium">Hatékonysági sandbox</div>
                        <div className="text-xs text-muted mt-1">
                          Szezonos 2PA, 3PA és FTA volumen mellett modellezi, mennyit mozdít a ponttermelésen a dobáshatékonyság változása.
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 border-border-subtle bg-surface-1/60 text-primary"
                        onClick={() => setPregameEfficiencyInputs({
                          ownPossessions: efficiencyBaseline.own.possessions,
                          ownThreeSharePct: efficiencyBaseline.own.threeSharePct,
                          ownFtRatePct: efficiencyBaseline.own.ftRatePct,
                          ownTovRatePct: efficiencyBaseline.own.tovRatePct,
                          ownOrebBonusPct: efficiencyBaseline.own.orebBonusPct,
                          ownTwoPct: efficiencyBaseline.own.twoPct,
                          ownThreePct: efficiencyBaseline.own.threePct,
                          ownFtPct: efficiencyBaseline.own.ftPct,
                          opponentPossessions: efficiencyBaseline.opponent.possessions,
                          opponentThreeSharePct: efficiencyBaseline.opponent.threeSharePct,
                          opponentFtRatePct: efficiencyBaseline.opponent.ftRatePct,
                          opponentTovRatePct: efficiencyBaseline.opponent.tovRatePct,
                          opponentOrebBonusPct: efficiencyBaseline.opponent.orebBonusPct,
                          opponentTwoPct: efficiencyBaseline.opponent.twoPct,
                          opponentThreePct: efficiencyBaseline.opponent.threePct,
                          opponentFtPct: efficiencyBaseline.opponent.ftPct,
                        })}
                      >
                        Alaphelyzet visszaállítása
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div className="rounded-lg border border-border-subtle bg-surface-2/40 px-3 py-2">
                        <div className="text-muted uppercase tracking-wide">Várható nettó pontkülönbség</div>
                        <div className={`mt-1 text-lg font-semibold ${efficiencyModel.netExpectedPoints >= 0 ? 'text-positive' : 'text-negative'}`}>
                          {efficiencyModel.netExpectedPoints >= 0 ? '+' : ''}{efficiencyModel.netExpectedPoints.toFixed(1)}
                        </div>
                        <div className="text-muted">fix volumen, állított hatékonyság</div>
                      </div>
                      <div className="rounded-lg border border-border-subtle bg-surface-2/40 px-3 py-2">
                        <div className="text-muted uppercase tracking-wide">Ellenfél pontcsökkentés</div>
                        <div className="mt-1 text-lg font-semibold text-cyan-300">{efficiencyModel.opponentSuppression.toFixed(1)}</div>
                        <div className="text-muted">pont/meccs a bázishoz képest</div>
                      </div>
                      <div className="rounded-lg border border-border-subtle bg-surface-2/40 px-3 py-2">
                        <div className="text-muted uppercase tracking-wide">Nettó eltolás</div>
                        <div className={`mt-1 text-lg font-semibold ${efficiencyModel.netDeltaVsBaseline >= 0 ? 'text-positive' : 'text-negative'}`}>
                          {efficiencyModel.netDeltaVsBaseline >= 0 ? '+' : ''}{efficiencyModel.netDeltaVsBaseline.toFixed(1)}
                        </div>
                        <div className="text-muted">pont/meccs a bázis sandboxhoz képest</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {[
                        {
                          label: ownLabel,
                          toneClass: 'accent-positive',
                          baseline: efficiencyBaseline.own,
                          projection: efficiencyModel.own,
                          values: {
                            possessions: pregameEfficiencyInputs.ownPossessions,
                            threeSharePct: pregameEfficiencyInputs.ownThreeSharePct,
                            ftRatePct: pregameEfficiencyInputs.ownFtRatePct,
                            tovRatePct: pregameEfficiencyInputs.ownTovRatePct,
                            orebBonusPct: pregameEfficiencyInputs.ownOrebBonusPct,
                            twoPct: pregameEfficiencyInputs.ownTwoPct,
                            threePct: pregameEfficiencyInputs.ownThreePct,
                            ftPct: pregameEfficiencyInputs.ownFtPct,
                          },
                          onPossessions: (value: number) => setPregameEfficiencyInputs(current => ({ ...current, ownPossessions: value })),
                          onThreeSharePct: (value: number) => setPregameEfficiencyInputs(current => ({ ...current, ownThreeSharePct: value })),
                          onFtRatePct: (value: number) => setPregameEfficiencyInputs(current => ({ ...current, ownFtRatePct: value })),
                          onTovRatePct: (value: number) => setPregameEfficiencyInputs(current => ({ ...current, ownTovRatePct: value })),
                          onOrebBonusPct: (value: number) => setPregameEfficiencyInputs(current => ({ ...current, ownOrebBonusPct: value })),
                          onTwoPct: (value: number) => setPregameEfficiencyInputs(current => ({ ...current, ownTwoPct: value })),
                          onThreePct: (value: number) => setPregameEfficiencyInputs(current => ({ ...current, ownThreePct: value })),
                          onFtPct: (value: number) => setPregameEfficiencyInputs(current => ({ ...current, ownFtPct: value })),
                        },
                        {
                          label: opponentLabel,
                          toneClass: 'accent-orange-400',
                          baseline: efficiencyBaseline.opponent,
                          projection: efficiencyModel.opponent,
                          values: {
                            possessions: pregameEfficiencyInputs.opponentPossessions,
                            threeSharePct: pregameEfficiencyInputs.opponentThreeSharePct,
                            ftRatePct: pregameEfficiencyInputs.opponentFtRatePct,
                            tovRatePct: pregameEfficiencyInputs.opponentTovRatePct,
                            orebBonusPct: pregameEfficiencyInputs.opponentOrebBonusPct,
                            twoPct: pregameEfficiencyInputs.opponentTwoPct,
                            threePct: pregameEfficiencyInputs.opponentThreePct,
                            ftPct: pregameEfficiencyInputs.opponentFtPct,
                          },
                          onPossessions: (value: number) => setPregameEfficiencyInputs(current => ({ ...current, opponentPossessions: value })),
                          onThreeSharePct: (value: number) => setPregameEfficiencyInputs(current => ({ ...current, opponentThreeSharePct: value })),
                          onFtRatePct: (value: number) => setPregameEfficiencyInputs(current => ({ ...current, opponentFtRatePct: value })),
                          onTovRatePct: (value: number) => setPregameEfficiencyInputs(current => ({ ...current, opponentTovRatePct: value })),
                          onOrebBonusPct: (value: number) => setPregameEfficiencyInputs(current => ({ ...current, opponentOrebBonusPct: value })),
                          onTwoPct: (value: number) => setPregameEfficiencyInputs(current => ({ ...current, opponentTwoPct: value })),
                          onThreePct: (value: number) => setPregameEfficiencyInputs(current => ({ ...current, opponentThreePct: value })),
                          onFtPct: (value: number) => setPregameEfficiencyInputs(current => ({ ...current, opponentFtPct: value })),
                        },
                      ].map(teamSandbox => (
                        <div key={teamSandbox.label} className="rounded-lg border border-border-subtle bg-surface-2/40 p-3 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium text-primary">{teamSandbox.label}</div>
                              <div className="text-xs text-muted mt-1">
                                  Bázis: {teamSandbox.baseline.possessions.toFixed(1)} poss • {teamSandbox.baseline.twoPA.toFixed(1)} 2PA • {teamSandbox.baseline.threePA.toFixed(1)} 3PA • {teamSandbox.baseline.fta.toFixed(1)} FTA
                              </div>
                            </div>
                            <div className="text-right text-xs text-secondary">
                              <div>Valós PPG: {teamSandbox.baseline.actualPointsPerGame.toFixed(1)}</div>
                                <div>Bázis PPP: {teamSandbox.baseline.ppp.toFixed(3)}</div>
                            </div>
                          </div>

                          <div className="space-y-2 text-xs text-secondary">
                              <label className="block">
                                <div className="flex justify-between mb-1"><span>Possz./meccs</span><span>{teamSandbox.values.possessions.toFixed(1)}</span></div>
                                <input
                                  type="range"
                                  min={55}
                                  max={85}
                                  step={0.5}
                                  value={teamSandbox.values.possessions}
                                  onChange={event => teamSandbox.onPossessions(Number(event.target.value))}
                                  className={`w-full ${teamSandbox.toneClass}`}
                                />
                              </label>
                              <label className="block">
                                <div className="flex justify-between mb-1"><span>3PA arány</span><span>{teamSandbox.values.threeSharePct.toFixed(1)}%</span></div>
                                <input
                                  type="range"
                                  min={15}
                                  max={65}
                                  step={0.5}
                                  value={teamSandbox.values.threeSharePct}
                                  onChange={event => teamSandbox.onThreeSharePct(clampPercent(Number(event.target.value), 15, 65))}
                                  className={`w-full ${teamSandbox.toneClass}`}
                                />
                                <div className="mt-1 text-[11px] text-muted">
                                  2PA arány automatikusan: {(100 - teamSandbox.values.threeSharePct).toFixed(1)}%
                                </div>
                              </label>
                              <label className="block">
                                <div className="flex justify-between mb-1"><span>FT rate</span><span>{teamSandbox.values.ftRatePct.toFixed(1)}%</span></div>
                                <input
                                  type="range"
                                  min={10}
                                  max={55}
                                  step={0.5}
                                  value={teamSandbox.values.ftRatePct}
                                  onChange={event => teamSandbox.onFtRatePct(clampPercent(Number(event.target.value), 10, 55))}
                                  className={`w-full ${teamSandbox.toneClass}`}
                                />
                              </label>
                              <label className="block">
                                <div className="flex justify-between mb-1"><span>TO%</span><span>{teamSandbox.values.tovRatePct.toFixed(1)}%</span></div>
                                <input
                                  type="range"
                                  min={7}
                                  max={25}
                                  step={0.5}
                                  value={teamSandbox.values.tovRatePct}
                                  onChange={event => teamSandbox.onTovRatePct(clampPercent(Number(event.target.value), 7, 25))}
                                  className={`w-full ${teamSandbox.toneClass}`}
                                />
                              </label>
                              <label className="block">
                                <div className="flex justify-between mb-1"><span>OREB bónusz</span><span>{teamSandbox.values.orebBonusPct.toFixed(1)}%</span></div>
                                <input
                                  type="range"
                                  min={0}
                                  max={15}
                                  step={0.5}
                                  value={teamSandbox.values.orebBonusPct}
                                  onChange={event => teamSandbox.onOrebBonusPct(clampPercent(Number(event.target.value), 0, 15))}
                                  className={`w-full ${teamSandbox.toneClass}`}
                                />
                              </label>
                            <label className="block">
                              <div className="flex justify-between mb-1"><span>2P%</span><span>{teamSandbox.values.twoPct.toFixed(1)}%</span></div>
                              <input
                                type="range"
                                min={35}
                                max={75}
                                step={0.5}
                                value={teamSandbox.values.twoPct}
                                onChange={event => teamSandbox.onTwoPct(clampPercent(Number(event.target.value), 35, 75))}
                                className={`w-full ${teamSandbox.toneClass}`}
                              />
                            </label>
                            <label className="block">
                              <div className="flex justify-between mb-1"><span>3P%</span><span>{teamSandbox.values.threePct.toFixed(1)}%</span></div>
                              <input
                                type="range"
                                min={20}
                                max={50}
                                step={0.5}
                                value={teamSandbox.values.threePct}
                                onChange={event => teamSandbox.onThreePct(clampPercent(Number(event.target.value), 20, 50))}
                                className={`w-full ${teamSandbox.toneClass}`}
                              />
                            </label>
                            <label className="block">
                              <div className="flex justify-between mb-1"><span>FT%</span><span>{teamSandbox.values.ftPct.toFixed(1)}%</span></div>
                              <input
                                type="range"
                                min={55}
                                max={90}
                                step={0.5}
                                value={teamSandbox.values.ftPct}
                                onChange={event => teamSandbox.onFtPct(clampPercent(Number(event.target.value), 55, 90))}
                                className={`w-full ${teamSandbox.toneClass}`}
                              />
                            </label>
                          </div>

                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                            <div className="rounded-md border border-border-subtle bg-base/50 px-3 py-2">
                              <div className="text-muted">Várható pont</div>
                              <div className="mt-1 text-primary font-medium">{teamSandbox.projection.expectedPoints.toFixed(1)}</div>
                              <div className={teamSandbox.projection.deltaPoints >= 0 ? 'text-positive' : 'text-negative'}>
                                {teamSandbox.projection.deltaPoints >= 0 ? '+' : ''}{teamSandbox.projection.deltaPoints.toFixed(1)} vs bázis
                              </div>
                            </div>
                            <div className="rounded-md border border-border-subtle bg-base/50 px-3 py-2">
                              <div className="text-muted">Származtatott eFG%</div>
                              <div className="mt-1 text-primary font-medium">{teamSandbox.projection.efg.toFixed(1)}%</div>
                              <div className={teamSandbox.projection.deltaEfg >= 0 ? 'text-positive' : 'text-negative'}>
                                {teamSandbox.projection.deltaEfg >= 0 ? '+' : ''}{teamSandbox.projection.deltaEfg.toFixed(1)} pp vs bázis
                              </div>
                            </div>
                            <div className="rounded-md border border-border-subtle bg-base/50 px-3 py-2">
                              <div className="text-muted">PPP</div>
                              <div className="mt-1 text-primary font-medium">{teamSandbox.projection.ppp.toFixed(3)}</div>
                              <div className="text-muted">{teamSandbox.projection.possessions.toFixed(1)} poss alapján</div>
                            </div>
                            <div className="rounded-md border border-border-subtle bg-base/50 px-3 py-2">
                              <div className="text-muted">Kísérletmix</div>
                              <div className="mt-1 text-primary font-medium">{teamSandbox.projection.twoPA.toFixed(1)} / {teamSandbox.projection.threePA.toFixed(1)}</div>
                              <div className="text-muted">
                                2PA / 3PA • {(100 - teamSandbox.projection.threeSharePct).toFixed(1)}% / {teamSandbox.projection.threeSharePct.toFixed(1)}%
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="text-xs text-muted leading-relaxed">
                      Ez a blokk továbbra sem teljes meccs-előrejelzés, hanem expected possessions sandbox. A ponttermelés a possz./meccs, a 3PA arány, a FT rate, a TO% és az OREB bónusz alapján számolt várható dobásvolumenből épül fel, így már a lehetőségek és a hatékonyság együtt mozgatják a kimenetet.
                    </div>
                  </div>
                )}

                {scenarioChartData.length > 0 && (
                  <div className="p-3 bg-surface-2/50 rounded-lg space-y-3">
                    <div className="text-sm text-secondary font-medium">Forgatókönyv-modellezés</div>
                    <ResponsiveContainer width="100%" height={248}>
                      <BarChart data={scenarioChartData} margin={{ top: 8, right: 8, left: 8, bottom: 14 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="label" {...pregameXAxisProps} />
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
                          className="bg-surface-1/60 border border-border-subtle rounded-md px-3 py-2 text-xs text-secondary"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-primary font-mono tabular-nums font-medium">{item.label}</span>
                            <span className={item.deltaVsBase >= 0 ? 'text-positive' : 'text-negative'}>
                              {item.deltaVsBase >= 0 ? '+' : ''}{item.deltaVsBase.toFixed(1)} pp vs alap
                            </span>
                          </div>
                          <div className="mt-1 text-secondary">{item.note}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {calibrationDiagnostics && calibrationChartData.length > 0 && (
                  <div className="p-3 bg-surface-2/50 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-secondary font-medium">Kalibrációs diagnosztika</div>
                      <div
                        className={`text-xs px-2 py-1 rounded-full border ${
                          calibrationDiagnostics.overallIntensity >= 70
                            ? 'bg-negative/15 border-negative/40 text-negative'
                            : calibrationDiagnostics.overallIntensity >= 45
                              ? 'bg-warning/15 border-warning/40 text-warning'
                              : 'bg-positive/15 border-positive/40 text-positive'
                        }`}
                      >
                        Össz-intenzitás: {calibrationDiagnostics.overallIntensity.toFixed(1)}
                      </div>
                    </div>
                    <div className="text-xs text-secondary">
                      {calibrationDiagnostics.scaleLabel ?? '0-100 matchup-intenzitás skála'} • {overallIntensityLabel ? `${overallIntensityLabel} nehézségű matchup.` : ''} {calibrationDiagnostics.summary ?? ''}
                    </div>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={calibrationChartData} layout="vertical" margin={{ top: 8, right: 10, left: 18, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis type="number" domain={[0, 100]} stroke="#94a3b8" tick={{ fontSize: 10 }} />
                        <YAxis dataKey="label" type="category" stroke="#94a3b8" tick={{ fontSize: 10 }} width={188} />
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
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 text-xs">
                      {calibrationChartData.map(item => (
                        <div key={`calibration-detail-${item.label}`} className="rounded-md border border-border-subtle bg-surface-2/40 px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-primary">{item.label}</span>
                            <span className={item.score >= 70 ? 'text-negative' : item.score >= 45 ? 'text-warning' : 'text-positive'}>
                              {item.score.toFixed(1)} • {item.note}
                            </span>
                          </div>
                          {item.context && <div className="text-muted mt-1">{item.context}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-3 bg-surface-2/50 rounded-lg">
                <div className="text-sm text-secondary font-medium mb-2">Poszt-összehasonlítás (VAL/36)</div>
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
                        <BarChart data={positionComparisonChart} margin={{ top: 8, right: 8, left: 8, bottom: 12 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis dataKey="label" {...pregameXAxisProps} />
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
                          let tone = 'text-secondary';
                          let label = `Kiegyenlített (${deltaLabel})`;
                          let container = 'bg-surface-1/60 border border-border-subtle';

                          if (item.matchupFlag === 'critical_disadvantage') {
                            tone = 'text-negative';
                            label = `Kritikus hátrány (${deltaLabel})`;
                            container = 'bg-negative/15 border border-negative/40';
                          } else if (item.matchupFlag === 'clear_advantage') {
                            tone = 'text-positive';
                            label = `Egyértelmű előny (${deltaLabel})`;
                            container = 'bg-positive/15 border border-positive/40';
                          } else if (item.deltaValPer36 >= 2) {
                            tone = 'text-positive';
                            label = `Saját előny (${deltaLabel})`;
                          } else if (item.deltaValPer36 <= -2) {
                            tone = 'text-negative';
                            label = `Ellenfél előny (${deltaLabel})`;
                          }

                          return (
                            <div
                              key={item.position}
                              className={`${container} flex items-center justify-between rounded-md px-3 py-2`}
                            >
                              <span className="text-primary">{item.label}</span>
                              <span className={tone}>{label}</span>
                            </div>
                          );
                        })}
                      </div>

                      {pregameReport.positionComparisonNote && (
                        <div className="mt-3 text-xs text-warning bg-warning/10 border border-warning/30 rounded-md px-3 py-2">
                          {pregameReport.positionComparisonNote}
                        </div>
                      )}
                    </>
                  );
                })()}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="p-3 bg-surface-2/50 rounded-lg">
                    <div className="text-sm text-secondary font-medium mb-2">Kockázati forgatókönyvek (mi történik, ha...)</div>
                    {riskScenarios.length > 0 ? (
                      <div className="space-y-2">
                        {riskScenarios.map(item => (
                          <div key={item.title} className="bg-surface-1/60 border border-border-subtle rounded-md px-3 py-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-primary">{item.title}</span>
                              <span className="text-negative">{item.estimatedOwnSwingPct.toFixed(1)} pp</span>
                            </div>
                            {item.title === 'Kontrollált alapforgatókönyv' && controlledScenarioGuidance ? (
                              <div className="mt-1 space-y-1 text-xs">
                                <div className="text-secondary">Triggerek:</div>
                                {controlledScenarioGuidance.triggers.map(trigger => (
                                  <div key={trigger} className="text-secondary">• {trigger}</div>
                                ))}
                                <div className="text-warning mt-1">Azonnali válaszok:</div>
                                {controlledScenarioGuidance.response.map(step => (
                                  <div key={step} className="text-warning">• {step}</div>
                                ))}
                                <div className="text-secondary mt-1">{controlledScenarioGuidance.expectedOutcome}</div>
                              </div>
                            ) : (
                              <>
                                <div className="text-xs text-secondary mt-1">Trigger: {item.trigger}</div>
                                <div className="text-xs text-warning mt-1">Azonnali válasz: {item.instantResponse}</div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-secondary">Nincs külön kockázati forgatókönyv.</div>
                    )}
                  </div>

                  <div className="p-3 bg-surface-2/50 rounded-lg">
                    <div className="text-sm text-secondary font-medium mb-2">X-faktor számszerűsítés</div>
                    {xFactorImpact ? (
                      <div className="space-y-2">
                        <div className="text-xs text-muted">Ezek a számok swing-potenciált mutatnak kontrollált forgatókönyvben, nem garantált nyereséget.</div>
                        <div className="bg-surface-1/60 border border-border-subtle rounded-md px-3 py-2 text-sm text-primary">
                          Elsődleges x-faktor hatás: <span className="text-positive">+{xFactorImpact.primaryDeltaPct.toFixed(1)}%</span>
                        </div>
                        <div className="bg-surface-1/60 border border-border-subtle rounded-md px-3 py-2 text-sm text-primary">
                          Másodlagos x-faktor hatás: <span className="text-positive">+{xFactorImpact.secondaryDeltaPct.toFixed(1)}%</span>
                        </div>
                        <div className="bg-surface-1/60 border border-border-subtle rounded-md px-3 py-2 text-sm text-primary">
                          Kombinált modellhatás: <span className="text-positive">+{xFactorImpact.combinedDeltaPct.toFixed(1)}%</span>
                        </div>
                        {adjustedScenarioOutcomes.find(item => item.key === 'controlled_tempo') && (
                          <div className="bg-positive/10 border border-positive/30 rounded-md px-3 py-2 text-xs text-positive">
                            Jelenlegi fókuszsúlyok mellett a kontrollált forgatókönyv tényleges modell-eltolása: {(() => {
                              const controlledScenario = adjustedScenarioOutcomes.find(item => item.key === 'controlled_tempo');
                              return `${controlledScenario && controlledScenario.deltaVsBase >= 0 ? '+' : ''}${controlledScenario?.deltaVsBase.toFixed(1)} pp vs alap`;
                            })()}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-secondary">Nincs számszerűsíthető x-faktor hatás.</div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-secondary font-medium mb-2">Saját sérültek / hiányzók</div>
                    {pregameReport.injuryContext?.own?.length ? (
                      pregameReport.injuryContext.own.map(name => (
                        <div key={`own-injury-${name}`} className="text-sm text-primary">
                          • {name}
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-secondary">Nincs megjelölt kihagyó.</div>
                    )}
                  </div>
                  <div>
                    <div className="text-sm text-secondary font-medium mb-2">Ellenfél sérültek / hiányzók</div>
                    {pregameReport.injuryContext?.opponent?.length ? (
                      pregameReport.injuryContext.opponent.map(name => (
                        <div key={`opp-injury-${name}`} className="text-sm text-primary">
                          • {name}
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-secondary">Nincs megjelölt kihagyó.</div>
                    )}
                  </div>
                </div>

                {advancedPlayers && (
                  <div className="p-3 bg-surface-2/50 rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="text-sm text-secondary font-medium">Haladó játékosmutatók (proxy PER / proxy WS)</div>
                      <TooltipProvider>
                        <UiTooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="h-5 w-5 rounded-full border border-border-subtle text-[11px] text-secondary hover:text-primary hover:border-border-active"
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
                        <div className="text-xs uppercase tracking-wide text-muted mb-1">{ownLabel}</div>
                        <div className="space-y-1">
                          {advancedPlayers.own.length > 0 ? advancedPlayers.own.map(player => (
                            <div
                              key={`own-adv-${player.playerId}`}
                              className="grid grid-cols-[1fr_auto_auto] gap-2 items-center bg-surface-1/60 border border-border-subtle rounded-md px-2 py-1 text-xs"
                            >
                              <span className="text-primary">{player.name} <span className="text-muted">({player.minutesPerGame.toFixed(1)} mpg)</span></span>
                              <span className="text-sky-300">PER*: {player.proxyPer.toFixed(1)}</span>
                              <span className="text-positive">WS*: {player.proxyWinShare.toFixed(2)}</span>
                            </div>
                          )) : <div className="text-xs text-muted">Nincs elég adat.</div>}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wide text-muted mb-1">{opponentLabel}</div>
                        <div className="space-y-1">
                          {advancedPlayers.opponent.length > 0 ? advancedPlayers.opponent.map(player => (
                            <div
                              key={`opp-adv-${player.playerId}`}
                              className="grid grid-cols-[1fr_auto_auto] gap-2 items-center bg-surface-1/60 border border-border-subtle rounded-md px-2 py-1 text-xs"
                            >
                              <span className="text-primary">{player.name} <span className="text-muted">({player.minutesPerGame.toFixed(1)} mpg)</span></span>
                              <span className="text-sky-300">PER*: {player.proxyPer.toFixed(1)}</span>
                              <span className="text-orange-300">WS*: {player.proxyWinShare.toFixed(2)}</span>
                            </div>
                          )) : <div className="text-xs text-muted">Nincs elég adat.</div>}
                        </div>
                      </div>
                    </div>
                    <div className="text-[11px] text-muted">
                      A PER* és WS* becslés saját, boxscore-alapú proxy mutató, összehasonlító célra.
                    </div>
                  </div>
                )}

                <div className="border-t border-border-subtle pt-4">
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
                      <div className="text-xs text-secondary">
                        Szigorúan adat-alapú, 6 rövid bekezdéses összefoglaló készül.
                      </div>
                    </div>
                    {pregameSaveStatus && (
                      <div
                        className={`text-xs ${
                          pregameSaveStatus.type === 'success'
                            ? 'text-positive'
                            : pregameSaveStatus.type === 'warning'
                              ? 'text-warning'
                              : 'text-negative'
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

          <div className="border-t border-border-subtle pt-4 space-y-3">
            <div className="text-sm text-secondary font-medium">Mentett pre-game jelentés</div>

            {!hasPregameLookupTarget && (
              <div className="text-sm text-secondary">
                Válassz meccset vagy ellenfelet a mentett pre-game szöveg megjelenítéséhez.
              </div>
            )}

            {hasPregameLookupTarget && pregameTextError && (
              <div className="text-sm text-negative bg-negative/15 border border-negative/40 rounded-md px-3 py-2">
                {pregameTextError}
              </div>
            )}

            {hasPregameLookupTarget && !pregameTextError && !pregameText && (
              <div className="text-sm text-secondary">
                Nincs mentett pre-game szöveges értékelés a kiválasztott meccshez vagy ellenfélhez.
              </div>
            )}

            {hasPregameLookupTarget && pregameText && (
              <div className="space-y-1">
                <div className="text-xs text-secondary">
                  {pregameTextMeta.generatedAt ? (
                    <>
                      Mentve: {formatGeneratedAt(pregameTextMeta.generatedAt) ?? 'ismeretlen időpont'} • Forrás:{' '}
                      {pregameTextMeta.generatedBy ?? 'gpt-automata'}
                    </>
                  ) : (
                    'Ez a szöveg még nincs adatbázisban mentve.'
                  )}
                </div>
                <div className="text-sm text-primary whitespace-pre-line bg-surface-2/60 border border-border-subtle rounded-lg px-4 py-3">
                  {pregameText}
                </div>
                {pregameReport && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-border-subtle hover:bg-surface-2 text-cyan"
                    onClick={() => {
                      const md = pregameReportToMd(pregameReport);
                      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `pregame-${pregameReport.ownTeamName.replace(/\s+/g, '-')}-vs-${pregameReport.opponentTeamName.replace(/\s+/g, '-')}.md`;
                      a.click();
                      URL.revokeObjectURL(url);
                      navigator.clipboard.writeText(md).catch(() => null);
                      toast.success('MD exportálva – vágólapra másolva és letöltve');
                    }}
                  >
                    <Download className="w-3 h-3 mr-1.5" />
                    Export MD
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>}

      {showPostgameSection && <Card>
        <CardHeader>
          <CardTitle className="font-display uppercase tracking-wide text-primary">Post-game jelentés</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-secondary mb-2 block">Mérkőzés</label>
              <Select value={selectedGameId} onValueChange={setSelectedGameId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Válassz meccset..." className="truncate" />
                </SelectTrigger>
                <SelectContent className="">
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
            <div className="text-sm text-secondary">Válassz meccset a post-game jelentéshez.</div>
          )}

          {selectedGameId && !postgameReport && (
            <div className="text-sm text-secondary">
              Nincs elég adat a post-game jelentéshez.
            </div>
          )}

          {selectedGameId && isLoadingKosarstatPostgame && (
            <div className="flex items-center gap-2 text-xs text-secondary">
              <Loader2 size={14} className="animate-spin" />
              Kosarstat lineup adatok csatolása folyamatban...
            </div>
          )}

          {postgameReport && (
            <div className="space-y-4">
              <div className="text-sm text-primary leading-relaxed">{postgameReport.summary}</div>

              {(postgameReport.reflection.xFactor || postgameReport.reflection.risk) && (
                <div className="text-xs text-warning space-y-1">
                  {postgameReport.reflection.xFactor && (
                    <div className="font-medium">{postgameReport.reflection.xFactor}</div>
                  )}
                  {postgameReport.reflection.risk && (
                    <div className="text-secondary">{postgameReport.reflection.risk}</div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={showKosarstatOnlyPostgame ? 'default' : 'outline'}
                  onClick={() => setShowKosarstatOnlyPostgame(prev => !prev)}
                  className={showKosarstatOnlyPostgame
                    ? 'h-7 bg-cyan hover:bg-cyan/80 text-base'
                    : 'h-7 border-border-subtle text-secondary hover:bg-surface-2'}
                >
                  {showKosarstatOnlyPostgame ? 'Kosarstat only: BE' : 'Kosarstat only: KI'}
                </Button>
                <span className="text-xs text-muted">
                  Bekapcsolva csak a Kosarstat negyed + team metric insightok látszanak az erősség/probléma/fókusz blokkokban.
                </span>
              </div>

              {postgameReport.dataNotes.length > 0 && (
                <div className="text-xs text-secondary">
                  {postgameReport.dataNotes.join(' ')}
                </div>
              )}

              {(
                kosarstatPostgameContext.quarterDiffRows.length > 0
                || kosarstatPostgameContext.ownMetrics
                || kosarstatPostgameContext.oppMetrics
                || Boolean(kosarstatPostgameContext.clutch)
                || Boolean(kosarstatPostgameContext.clutch?.available)
                || kosarstatPostgameContext.turnoverTypes.length > 0
              ) && (
                <div className="rounded-lg border border-sky-900/60 bg-sky-950/20 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium text-sky-100">Kosarstat meccs-flow (új import)</div>
                    <div className="text-xs text-sky-300/70">Negyedek + team metricek</div>
                  </div>

                  {kosarstatPostgameContext.quarterDiffRows.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs text-secondary">Negyedenkénti pontkülönbség</div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {kosarstatPostgameContext.quarterDiffRows.map(row => (
                          <div key={`quarter-flow-${row.quarter}`} className="rounded-md border border-border-subtle bg-surface-2/40 p-2">
                            <div className="text-xs text-secondary">Q{row.quarter}</div>
                            <div className="text-sm text-primary tabular-nums">{row.ownPoints} - {row.oppPoints}</div>
                            <div className={`text-xs tabular-nums ${row.diff >= 0 ? 'text-positive' : 'text-negative'}`}>
                              Diff: {row.diff > 0 ? '+' : ''}{row.diff}
                            </div>
                            {row.cumulativeDiff !== null && (
                              <div className={`text-[11px] tabular-nums ${row.cumulativeDiff >= 0 ? 'text-positive/90' : 'text-negative/90'}`}>
                                Cum: {row.cumulativeDiff > 0 ? '+' : ''}{row.cumulativeDiff}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="rounded-md border border-border-subtle bg-surface-1/60 p-2">
                        <div className="text-[11px] text-secondary mb-1">Negyed trend mini chart (pontkülönbség)</div>
                        <ResponsiveContainer width="100%" height={120}>
                          <BarChart data={kosarstatPostgameContext.quarterDiffRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="quarter" tickFormatter={(value: number | string) => `Q${value}`} stroke="#94a3b8" tick={{ fontSize: 10 }} />
                            <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} />
                            <Tooltip
                              formatter={(value: number | string | undefined) => [`${Number(value ?? 0).toFixed(0)}`, 'Pontkülönbség']}
                              labelFormatter={(label: unknown) => `Q${String(label ?? '')}`}
                              contentStyle={{
                                backgroundColor: '#0f172a',
                                border: '1px solid #475569',
                                borderRadius: '8px',
                                color: '#f1f5f9',
                              }}
                            />
                            <Bar dataKey="diff" radius={[4, 4, 0, 0]}>
                              {kosarstatPostgameContext.quarterDiffRows.map(item => (
                                <Cell
                                  key={`quarter-diff-cell-${item.quarter}`}
                                  fill={item.diff >= 0 ? '#34d399' : '#fb7185'}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {(() => {
                    const own = kosarstatPostgameContext.ownMetrics;
                    const opp = kosarstatPostgameContext.oppMetrics;
                    if (!own && !opp) return null;

                    const fmt = (value: unknown, digits = 1, suffix = '') => {
                      const numeric = Number(value);
                      if (!Number.isFinite(numeric)) return '-';
                      return `${roundValue(numeric, digits)}${suffix}`;
                    };

                    const diffBadge = (label: string, ownValue: unknown, oppValue: unknown, suffix = '') => {
                      const ownNum = Number(ownValue);
                      const oppNum = Number(oppValue);
                      if (!Number.isFinite(ownNum) || !Number.isFinite(oppNum)) return null;
                      const diff = roundValue(ownNum - oppNum, 1);
                      return (
                        <div key={`metric-diff-${label}`} className="rounded-md border border-border-subtle bg-surface-1/60 px-2 py-1 text-xs">
                          <span className="text-secondary">{label}: </span>
                          <span className={diff >= 0 ? 'text-positive' : 'text-negative'}>
                            {diff > 0 ? '+' : ''}{diff}{suffix}
                          </span>
                        </div>
                      );
                    };

                    return (
                      <div className="space-y-2">
                        <div className="text-xs text-secondary">Team advanced mutatók</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                          <div className="rounded-md border border-border-subtle bg-surface-1/60 p-2">
                            <div className="text-muted mb-1">Saját csapat ({own?.team_name || 'ismeretlen'})</div>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-primary tabular-nums">
                              <div>POSS: {fmt(own?.poss)}</div>
                              <div>ORTG: {fmt(own?.ortg)}</div>
                              <div>eFG: {fmt(own?.efg, 1, '%')}</div>
                              <div>TO%: {fmt(own?.tov_pct, 1, '%')}</div>
                              <div>ORB%: {fmt(own?.orb_pct, 1, '%')}</div>
                              <div>FTM rate: {fmt(own?.ftm_rate, 3)}</div>
                            </div>
                          </div>
                          <div className="rounded-md border border-border-subtle bg-surface-1/60 p-2">
                            <div className="text-muted mb-1">Ellenfél ({opp?.team_name || 'ismeretlen'})</div>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-primary tabular-nums">
                              <div>POSS: {fmt(opp?.poss)}</div>
                              <div>ORTG: {fmt(opp?.ortg)}</div>
                              <div>eFG: {fmt(opp?.efg, 1, '%')}</div>
                              <div>TO%: {fmt(opp?.tov_pct, 1, '%')}</div>
                              <div>ORB%: {fmt(opp?.orb_pct, 1, '%')}</div>
                              <div>FTM rate: {fmt(opp?.ftm_rate, 3)}</div>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {[
                            diffBadge('ORTG diff', own?.ortg, opp?.ortg),
                            diffBadge('eFG diff', own?.efg, opp?.efg, ' pp'),
                            diffBadge('TO% diff', own?.tov_pct, opp?.tov_pct, ' pp'),
                            diffBadge('ORB% diff', own?.orb_pct, opp?.orb_pct, ' pp'),
                          ].filter(Boolean)}
                        </div>
                      </div>
                    );
                  })()}

                  {(kosarstatPostgameContext.clutch || kosarstatPostgameContext.turnoverTypes.length > 0) && (
                    <div className="space-y-2">
                      <div className="text-xs text-secondary">Kosarstat clutch blokk</div>

                      {kosarstatPostgameContext.clutch?.available && (
                        <div className="rounded-md border border-border-subtle bg-surface-1/60 p-2">
                          <div className="text-muted mb-1 text-xs">Clutch szakasz (Kosarstat clutch stat)</div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-1 text-xs tabular-nums text-primary">
                            <div>
                              Pontok: {kosarstatPostgameContext.clutch.ownPoints}-{kosarstatPostgameContext.clutch.oppPoints}
                            </div>
                            <div>
                              Diff:{' '}
                              <span className={kosarstatPostgameContext.clutch.diff >= 0 ? 'text-positive' : 'text-negative'}>
                                {kosarstatPostgameContext.clutch.diff > 0 ? '+' : ''}{kosarstatPostgameContext.clutch.diff}
                              </span>
                            </div>
                            <div>
                              TO: {kosarstatPostgameContext.clutch.ownTurnovers}-{kosarstatPostgameContext.clutch.oppTurnovers}
                            </div>
                            <div>Minta: {kosarstatPostgameContext.clutch.sampleLabel}</div>
                            <div>ORtg: {formatNullableNumber(kosarstatPostgameContext.clutch.ortg, 1)}</div>
                            <div>DRtg: {formatNullableNumber(kosarstatPostgameContext.clutch.drtg, 1)}</div>
                            <div>TO%: {formatNullableNumber(kosarstatPostgameContext.clutch.tovPct, 1, '%')}</div>
                            <div>AST/TO: {formatNullableNumber(kosarstatPostgameContext.clutch.assistToTurnover, 2)}</div>
                          </div>
                        </div>
                      )}

                      {kosarstatPostgameContext.clutch && !kosarstatPostgameContext.clutch.available && (
                        <div className="rounded-md border border-border-subtle bg-surface-1/60 p-2 text-xs text-secondary">
                          Kosarstat clutch minta rövid vagy nem elérhető ebben a meccsben.
                        </div>
                      )}

                      {kosarstatPostgameContext.turnoverTypes.length > 0 && (
                        <div className="rounded-md border border-border-subtle bg-surface-1/60 p-2">
                          <div className="text-muted mb-1 text-xs">Labdavesztés típusok (top 5)</div>
                          <div className="flex flex-wrap gap-2">
                            {kosarstatPostgameContext.turnoverTypes.map(item => (
                              <div key={`to-type-${item.type}`} className="rounded-md border border-border-subtlebg-surface-1/80 px-2 py-1 text-xs text-primary tabular-nums">
                                <span className="text-secondary">{item.type}: </span>
                                <span className="text-negative">{item.count}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {kosarstatPostgameContext.clutch && kosarstatPostgameContext.turnoverTypes.length === 0 && (
                        <div className="rounded-md border border-border-subtle bg-surface-1/60 p-2 text-xs text-secondary">
                          TO típus bontás: a Kosarstat clutch stat oldal nem ad külön turnover-típus részletezést.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeKosarstatTeamAnalysis && (
                <div className="rounded-lg border border-border-subtlebg-surface-1/80 p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium text-primary">
                      Kosarstat lineup elemzés: {activeKosarstatTeamAnalysis.teamName}
                    </div>
                    <div className="text-xs text-secondary">
                      Assist alapú páros/trió adat jelenleg nem érhető el a Kosarstat lineup exportból.
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-secondary mb-2">Kezdő ötös</div>
                    <div className="flex flex-wrap gap-2">
                      {activeKosarstatTeamAnalysis.starters.map(player => (
                        <Badge key={`starter-${player}`} variant="secondary" className="badge-positive">
                          {player}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-md border border-border-subtle bg-base/60 p-3">
                      <div className="text-sm text-secondary font-medium mb-2">Játékpercek és +/-</div>
                      <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                        {activeKosarstatTeamAnalysis.playerMinutes.map(item => (
                          <div key={`pm-${item.player}`} className="flex items-center justify-between text-xs bg-surface-1/60 rounded px-2 py-1">
                            <span className="text-primary truncate pr-2">{item.player}</span>
                            <span className="text-secondary">{item.minutesLabel}</span>
                            <span className={item.plusMinus !== null && item.plusMinus >= 0 ? 'text-positive' : 'text-negative'}>
                              {item.plusMinus === null ? '-' : `${item.plusMinus > 0 ? '+' : ''}${item.plusMinus.toFixed(1)}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-md border border-border-subtle bg-base/60 p-3">
                      <div className="text-sm text-secondary font-medium mb-2">Csere-események (2=be, 3=le)</div>
                      <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                        {activeKosarstatTeamAnalysis.substitutions.length === 0 && (
                          <div className="text-xs text-muted">Nincs használható csereesemény.</div>
                        )}
                        {activeKosarstatTeamAnalysis.substitutions.slice(0, 40).map((event, idx) => (
                          <div key={`sub-${idx}-${event.player}-${event.gameSecond}-${event.type}`} className="flex items-center justify-between text-xs bg-surface-1/60 rounded px-2 py-1">
                            <span className="text-secondary">{event.clockLabel}</span>
                            <span className={event.type === 'in' ? 'text-positive' : 'text-warning'}>
                              {event.type === 'in' ? 'be' : 'le'}
                            </span>
                            <span className="text-primary truncate pl-2">{event.player}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-md border border-border-subtle bg-base/60 p-3 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm text-secondary font-medium">Rotáció timeline (1 képre)</div>
                      <div className="text-xs text-muted">Színek alapján: pályánlét és cserepillanatok</div>
                    </div>

                    <div className="flex flex-wrap gap-3 text-[11px] text-secondary">
                      <div className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-surface-2" />Nincs pályán</div>
                      <div className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-positive/70" />Pályán</div>
                      <div className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-positive" />Beállás</div>
                      <div className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-warning" />Lecsere</div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px] border-collapse table-fixed" style={{ minWidth: 1320 }}>
                        <thead>
                          <tr className="text-secondary">
                            <th className="text-left px-2 py-1 w-44">Játékos</th>
                            <th className="text-center px-2 py-1 w-16 tabular-nums">Idő</th>
                            <th className="text-center px-2 py-1 w-12 tabular-nums">+/-</th>
                            {Array.from({ length: 40 }, (_, i) => i + 1).map(minute => (
                              <th
                                key={`rot-head-${minute}`}
                                className={`px-1 py-1 text-center border-l border-border-subtle/70 w-5 tabular-nums ${minute % 10 === 1 ? 'border-primary/30' : ''}`}
                              >
                                {minute}
                              </th>
                            ))}
                            <th className="text-right px-2 py-1 w-20">Be</th>
                            <th className="text-right px-2 py-1 w-20">Le</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeKosarstatTeamAnalysis.playerTimelines.map(row => (
                            <tr key={`rot-row-${row.player}`} className="border-t border-border-subtle/80">
                              <td className="px-2 py-1 text-primary whitespace-nowrap truncate">{row.player}</td>
                              <td className="px-2 py-1 text-secondary whitespace-nowrap text-center tabular-nums">{row.minutesLabel}</td>
                              <td className={`px-2 py-1 whitespace-nowrap text-center tabular-nums ${row.plusMinus !== null && row.plusMinus >= 0 ? 'text-positive' : 'text-negative'}`}>
                                {row.plusMinus === null ? '-' : `${row.plusMinus > 0 ? '+' : ''}${row.plusMinus.toFixed(0)}`}
                              </td>
                              {row.minuteCodes.map((code, idx) => {
                                const display = code || '0';
                                const cls =
                                  display === '1'
                                    ? 'bg-positive/55 text-base'
                                    : display === '2'
                                    ? 'bg-positive/80 text-base font-semibold'
                                    : display === '3'
                                    ? 'bg-warning/70 text-base font-semibold'
                                    : 'bg-surface-2/45 text-secondary';
                                return (
                                  <td
                                    key={`rot-cell-${row.player}-${idx}`}
                                    className={`px-1 py-1 text-center border-l border-border-subtle/70 ${cls} ${idx % 10 === 0 ? 'border-primary/30' : ''}`}
                                    title={
                                      display === '1'
                                        ? 'Pályán'
                                        : display === '2'
                                          ? 'Beállás'
                                          : display === '3'
                                            ? 'Lecsere'
                                            : 'Nincs pályán'
                                    }
                                  >
                                    &nbsp;
                                  </td>
                                );
                              })}
                              <td className="px-2 py-1 text-secondary whitespace-nowrap text-right tabular-nums">{row.subInMinutes.length > 0 ? row.subInMinutes.join(', ') : '-'}</td>
                              <td className="px-2 py-1 text-secondary whitespace-nowrap text-right tabular-nums">{row.subOutMinutes.length > 0 ? row.subOutMinutes.join(', ') : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-md border border-border-subtle bg-base/60 p-3 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm text-secondary font-medium">5-ös felállások (Kosarstat nézet)</div>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-8"
                        onClick={() => {
                          setLineupAnyPlayerFilter(LINEUP_FILTER_ALL);
                          setLineupPgFilter(LINEUP_FILTER_ALL);
                          setLineupSgFilter(LINEUP_FILTER_ALL);
                          setLineupSfFilter(LINEUP_FILTER_ALL);
                          setLineupPfFilter(LINEUP_FILTER_ALL);
                          setLineupCFilter(LINEUP_FILTER_ALL);
                        }}
                      >
                        Szűrők törlése
                      </Button>
                    </div>

                    <div className="overflow-x-auto">
                      <div className="flex items-center gap-2 min-w-max pb-1">
                        <Select value={lineupAnyPlayerFilter} onValueChange={setLineupAnyPlayerFilter}>
                          <SelectTrigger className="h-8 text-xs min-w-44"><SelectValue placeholder="Bármely játékos" /></SelectTrigger>
                          <SelectContent className="">
                            <SelectItem value={LINEUP_FILTER_ALL}>Bármely játékos</SelectItem>
                            {comboPlayerOptions.map(name => (<SelectItem key={`lineup-any-${name}`} value={name}>{name}</SelectItem>))}
                          </SelectContent>
                        </Select>

                        <Select value={lineupPgFilter} onValueChange={setLineupPgFilter}>
                          <SelectTrigger className="h-8 text-xs min-w-36"><SelectValue placeholder="PG" /></SelectTrigger>
                          <SelectContent className="">
                            <SelectItem value={LINEUP_FILTER_ALL}>PG: mind</SelectItem>
                            {lineupPositionOptions.pg.map(name => (<SelectItem key={`lineup-pg-${name}`} value={name}>{name}</SelectItem>))}
                          </SelectContent>
                        </Select>

                        <Select value={lineupSgFilter} onValueChange={setLineupSgFilter}>
                          <SelectTrigger className="h-8 text-xs min-w-36"><SelectValue placeholder="SG" /></SelectTrigger>
                          <SelectContent className="">
                            <SelectItem value={LINEUP_FILTER_ALL}>SG: mind</SelectItem>
                            {lineupPositionOptions.sg.map(name => (<SelectItem key={`lineup-sg-${name}`} value={name}>{name}</SelectItem>))}
                          </SelectContent>
                        </Select>

                        <Select value={lineupSfFilter} onValueChange={setLineupSfFilter}>
                          <SelectTrigger className="h-8 text-xs min-w-36"><SelectValue placeholder="SF" /></SelectTrigger>
                          <SelectContent className="">
                            <SelectItem value={LINEUP_FILTER_ALL}>SF: mind</SelectItem>
                            {lineupPositionOptions.sf.map(name => (<SelectItem key={`lineup-sf-${name}`} value={name}>{name}</SelectItem>))}
                          </SelectContent>
                        </Select>

                        <Select value={lineupPfFilter} onValueChange={setLineupPfFilter}>
                          <SelectTrigger className="h-8 text-xs min-w-36"><SelectValue placeholder="PF" /></SelectTrigger>
                          <SelectContent className="">
                            <SelectItem value={LINEUP_FILTER_ALL}>PF: mind</SelectItem>
                            {lineupPositionOptions.pf.map(name => (<SelectItem key={`lineup-pf-${name}`} value={name}>{name}</SelectItem>))}
                          </SelectContent>
                        </Select>

                        <Select value={lineupCFilter} onValueChange={setLineupCFilter}>
                          <SelectTrigger className="h-8 text-xs min-w-36"><SelectValue placeholder="C" /></SelectTrigger>
                          <SelectContent className="">
                            <SelectItem value={LINEUP_FILTER_ALL}>C: mind</SelectItem>
                            {lineupPositionOptions.c.map(name => (<SelectItem key={`lineup-c-${name}`} value={name}>{name}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="text-xs text-muted">
                      Találatok: <span className="text-secondary font-medium">{filteredFiveManLineups.length}</span>
                    </div>

                    <div className="overflow-x-auto max-h-112">
                      <table className="w-full text-xs border-collapse" style={{ minWidth: 980 }}>
                        <thead>
                          <tr className="text-muted border-b border-border-subtle/80">
                            <th className="px-2 py-1 text-left">PG</th>
                            <th className="px-2 py-1 text-left">SG</th>
                            <th className="px-2 py-1 text-left">SF</th>
                            <th className="px-2 py-1 text-left">PF</th>
                            <th className="px-2 py-1 text-left">C</th>
                            <th className="px-2 py-1 text-right">Min</th>
                            <th className="px-2 py-1 text-right">Team PTS</th>
                            <th className="px-2 py-1 text-right">Opp PTS</th>
                            <th className="px-2 py-1 text-right">On +/-</th>
                            <th className="px-2 py-1 text-right">On40</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredFiveManLineups.length === 0 && (
                            <tr>
                              <td colSpan={10} className="px-2 py-4 text-center text-muted">
                                Nincs találat a megadott szűrőkkel.
                              </td>
                            </tr>
                          )}

                          {filteredFiveManLineups.map((stint, idx) => (
                            <tr key={`lineup-five-${idx}-${stint.players.join('|')}-${stint.seconds}`} className="border-t border-border-subtle/70">
                              <td className="px-2 py-1 text-primary whitespace-nowrap">{stint.pg || '-'}</td>
                              <td className="px-2 py-1 text-primary whitespace-nowrap">{stint.sg || '-'}</td>
                              <td className="px-2 py-1 text-primary whitespace-nowrap">{stint.sf || '-'}</td>
                              <td className="px-2 py-1 text-primary whitespace-nowrap">{stint.pf || '-'}</td>
                              <td className="px-2 py-1 text-primary whitespace-nowrap">{stint.c || '-'}</td>
                              <td className="px-2 py-1 text-secondary text-right whitespace-nowrap">{stint.minutesLabel}</td>
                              <td className="px-2 py-1 text-secondary text-right whitespace-nowrap">{stint.teamPts}</td>
                              <td className="px-2 py-1 text-secondary text-right whitespace-nowrap">{stint.oppPts}</td>
                              <td className={`px-2 py-1 text-right whitespace-nowrap ${stint.plusMinus >= 0 ? 'text-positive' : 'text-negative'}`}>
                                {stint.plusMinus > 0 ? '+' : ''}{stint.plusMinus}
                              </td>
                              <td className="px-2 py-1 text-secondary text-right whitespace-nowrap">
                                {stint.on40 === null ? '-' : `${stint.on40 > 0 ? '+' : ''}${stint.on40.toFixed(1)}`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-md border border-border-subtle bg-base/60 p-3 space-y-3">
                    <div className="text-sm text-secondary font-medium">Páros / hármas együttállás elemző</div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={selectedComboSize === 2 ? 'default' : 'secondary'}
                        onClick={() => setSelectedComboSize(2)}
                      >
                        Páros
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={selectedComboSize === 3 ? 'default' : 'secondary'}
                        onClick={() => setSelectedComboSize(3)}
                      >
                        Hármas
                      </Button>
                    </div>

                    <div className={`grid gap-2 ${selectedComboSize === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
                      <Select value={selectedComboPlayerA} onValueChange={setSelectedComboPlayerA}>
                        <SelectTrigger className=""><SelectValue placeholder="1. játékos" /></SelectTrigger>
                        <SelectContent className="">
                          {comboPlayerOptions.map(name => (<SelectItem key={`combo-a-${name}`} value={name}>{name}</SelectItem>))}
                        </SelectContent>
                      </Select>

                      <Select value={selectedComboPlayerB} onValueChange={setSelectedComboPlayerB}>
                        <SelectTrigger className=""><SelectValue placeholder="2. játékos" /></SelectTrigger>
                        <SelectContent className="">
                          {comboPlayerOptions.map(name => (<SelectItem key={`combo-b-${name}`} value={name}>{name}</SelectItem>))}
                        </SelectContent>
                      </Select>

                      {selectedComboSize === 3 && (
                        <Select value={selectedComboPlayerC} onValueChange={setSelectedComboPlayerC}>
                          <SelectTrigger className=""><SelectValue placeholder="3. játékos" /></SelectTrigger>
                          <SelectContent className="">
                            {comboPlayerOptions.map(name => (<SelectItem key={`combo-c-${name}`} value={name}>{name}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    {selectedComboStat ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                        <div className="rounded bg-surface-1/70 px-2 py-2"><div className="text-secondary">Együtt töltött idő</div><div className="text-primary">{selectedComboStat.minutesLabel}</div></div>
                        <div className="rounded bg-surface-1/70 px-2 py-2"><div className="text-secondary">+/-</div><div className={selectedComboStat.plusMinus >= 0 ? 'text-positive' : 'text-negative'}>{selectedComboStat.plusMinus > 0 ? '+' : ''}{selectedComboStat.plusMinus.toFixed(1)}</div></div>
                        <div className="rounded bg-surface-1/70 px-2 py-2"><div className="text-secondary">Off hatékonyság (40p)</div><div className="text-primary">{selectedComboStat.offPer40.toFixed(1)}</div></div>
                        <div className="rounded bg-surface-1/70 px-2 py-2"><div className="text-secondary">Def hatékonyság (40p)</div><div className="text-primary">{selectedComboStat.defPer40.toFixed(1)}</div></div>
                      </div>
                    ) : (
                      <div className="text-xs text-muted">Válassz érvényes {selectedComboSize === 2 ? 'párost' : 'hármast'} az aggregált mutatókhoz.</div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs text-secondary mb-1">Leghatékonyabb együttállások (Net/40)</div>
                        <div className="space-y-1">
                          {(selectedComboSize === 2 ? activeKosarstatTeamAnalysis.pairStats : activeKosarstatTeamAnalysis.trioStats)
                            .slice(0, 5)
                            .map(item => (
                              <div key={`best-net-${item.key}`} className="text-xs bg-surface-1/60 rounded px-2 py-1 flex items-center justify-between">
                                <span className="text-primary truncate pr-2">{item.players.join(' + ')}</span>
                                <span className={item.netPer40 >= 0 ? 'text-positive' : 'text-negative'}>{item.netPer40 > 0 ? '+' : ''}{item.netPer40.toFixed(1)}</span>
                              </div>
                            ))}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-secondary mb-1">Legjobb védekező együttállások (legalacsonyabb Def/40)</div>
                        <div className="space-y-1">
                          {(selectedComboSize === 2 ? activeKosarstatTeamAnalysis.pairStats : activeKosarstatTeamAnalysis.trioStats)
                            .slice()
                            .sort((a, b) => a.defPer40 - b.defPer40)
                            .slice(0, 5)
                            .map(item => (
                              <div key={`best-def-${item.key}`} className="text-xs bg-surface-1/60 rounded px-2 py-1 flex items-center justify-between">
                                <span className="text-primary truncate pr-2">{item.players.join(' + ')}</span>
                                <span className="text-cyan-300">{item.defPer40.toFixed(1)}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 bg-surface-2/50 rounded-lg">
                  <div className="text-xs text-secondary">Pontok</div>
                  <div className="text-primary text-lg font-medium">
                    {postgameReport.metrics.pointsFor} - {postgameReport.metrics.pointsAgainst}
                  </div>
                  <div className={`text-xs ${postgameReport.metrics.margin >= 0 ? 'text-positive' : 'text-negative'}`}>
                    Margin: {postgameReport.metrics.margin > 0 ? '+' : ''}{postgameReport.metrics.margin.toFixed(1)}
                  </div>
                </div>
                <div className="p-3 bg-surface-2/50 rounded-lg">
                  <div className="text-xs text-secondary">Tempó (pace)</div>
                  <div className="text-primary text-lg font-medium">{postgameReport.metrics.pace.toFixed(1)}</div>
                  <div className="text-xs text-muted">Meccs-possessions becslés</div>
                </div>
                <div className="p-3 bg-surface-2/50 rounded-lg">
                  <div className="text-xs text-secondary">eFG%</div>
                  <div className="text-primary text-lg font-medium">{postgameReport.metrics.efg.toFixed(1)}%</div>
                  <div className="text-xs text-muted">Hatékonyság</div>
                </div>
              </div>

              <div>
                <div className="text-sm text-secondary font-medium mb-2">Kulcs mutatók (meccs vs. szezon)</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {postgameReport.metrics.keyStats.map(item => (
                    <div key={item.key} className="p-3 bg-surface-2/50 rounded-lg flex items-center justify-between">
                      <div>
                        <div className="text-xs text-secondary">{item.label}</div>
                        <div className="text-primary text-lg font-medium">
                          {formatPostgameValue(item.game, item.unit)}
                        </div>
                        <div className="text-xs text-muted">
                          Szezon: {formatPostgameValue(item.season, item.unit)}
                          {Number.isFinite(item.leagueMedian) ? ` • Liga medián: ${formatPostgameValue(item.leagueMedian ?? 0, item.unit)}` : ''}
                        </div>
                      </div>
                      <div className={`text-sm font-medium ${item.delta >= 0 ? 'text-positive' : 'text-negative'}`}>
                        {formatPostgameDelta(item.delta, item.unit)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-3 bg-surface-2/50 rounded-lg">
                  <div className="text-sm text-secondary font-medium mb-2">Hatékonyság összevetés</div>
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
                <div className="p-3 bg-surface-2/50 rounded-lg">
                  <div className="text-sm text-secondary font-medium mb-2">Dobásprofil</div>
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
                <div className="rounded-lg border border-border-subtle bg-surface-2/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-primary font-medium">Dobástérkép kontextus (meccs vs. szezon)</div>
                    <div className="text-xs text-muted">
                      Kísérletek: {postgameReport.shotMap.team.attempts} • FG%: {formatShotPct(postgameReport.shotMap.team.fgPct)}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="p-3 bg-surface-2/50 rounded-lg">
                      <div className="text-xs text-secondary">Gyűrű arány</div>
                      <div className="text-primary text-lg font-medium">{formatShotPct(postgameReport.shotMap.team.rimRate)}</div>
                      <div className={`text-xs ${shotDeltaTone(postgameReport.shotMap.comparison.rimRateDelta)}`}>
                        Delta: {formatShotDeltaPp(postgameReport.shotMap.comparison.rimRateDelta)}
                      </div>
                    </div>
                    <div className="p-3 bg-surface-2/50 rounded-lg">
                      <div className="text-xs text-secondary">Középtáv arány</div>
                      <div className="text-primary text-lg font-medium">{formatShotPct(postgameReport.shotMap.team.midRate)}</div>
                      <div className={`text-xs ${shotDeltaTone(postgameReport.shotMap.comparison.midRateDelta)}`}>
                        Delta: {formatShotDeltaPp(postgameReport.shotMap.comparison.midRateDelta)}
                      </div>
                    </div>
                    <div className="p-3 bg-surface-2/50 rounded-lg">
                      <div className="text-xs text-secondary">Tripla arány</div>
                      <div className="text-primary text-lg font-medium">{formatShotPct(postgameReport.shotMap.team.threeRate)}</div>
                      <div className={`text-xs ${shotDeltaTone(postgameReport.shotMap.comparison.threeRateDelta)}`}>
                        Delta: {formatShotDeltaPp(postgameReport.shotMap.comparison.threeRateDelta)}
                      </div>
                    </div>
                    <div className="p-3 bg-surface-2/50 rounded-lg">
                      <div className="text-xs text-secondary">Sarok tripla arány</div>
                      <div className="text-primary text-lg font-medium">{formatShotPct(postgameReport.shotMap.team.corner3Rate)}</div>
                      <div className={`text-xs ${shotDeltaTone(postgameReport.shotMap.comparison.corner3RateDelta)}`}>
                        Delta: {formatShotDeltaPp(postgameReport.shotMap.comparison.corner3RateDelta)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-3 bg-surface-2/40 rounded-lg">
                      <div className="text-xs text-secondary">Gyűrű FG%</div>
                      <div className="text-sm text-primary">
                        {formatShotPct(postgameReport.shotMap.team.rimPct)}
                        <span className={`ml-2 ${shotDeltaTone(postgameReport.shotMap.comparison.rimPctDelta)}`}>
                          ({formatShotDeltaPp(postgameReport.shotMap.comparison.rimPctDelta)})
                        </span>
                      </div>
                    </div>
                    <div className="p-3 bg-surface-2/40 rounded-lg">
                      <div className="text-xs text-secondary">Tripla FG%</div>
                      <div className="text-sm text-primary">
                        {formatShotPct(postgameReport.shotMap.team.threePct)}
                        <span className={`ml-2 ${shotDeltaTone(postgameReport.shotMap.comparison.threePctDelta)}`}>
                          ({formatShotDeltaPp(postgameReport.shotMap.comparison.threePctDelta)})
                        </span>
                      </div>
                    </div>
                    <div className="p-3 bg-surface-2/40 rounded-lg">
                      <div className="text-xs text-secondary">Shot quality index</div>
                      <div className="text-sm text-primary">
                        {postgameReport.shotMap.team.shotQualityIndex.toFixed(2)}
                        <span className={`ml-2 ${shotDeltaTone(postgameReport.shotMap.comparison.shotQualityDelta)}`}>
                          ({postgameReport.shotMap.comparison.shotQualityDelta > 0 ? '+' : ''}{postgameReport.shotMap.comparison.shotQualityDelta.toFixed(2)})
                        </span>
                      </div>
                    </div>
                  </div>

                  {postgameZoneDrilldownRows.length > 0 && (
                    <div className="space-y-2 rounded-lg border border-border-subtle bg-surface-1/60 p-3">
                      <div className="text-sm text-secondary font-medium">Interaktív zóna drilldown</div>
                      <div className="flex flex-wrap gap-2">
                        {postgameZoneDrilldownRows.map(zone => (
                          <Button
                            key={`zone-drill-${zone.key}`}
                            type="button"
                            size="sm"
                            variant={selectedPostgameZone === zone.key ? 'default' : 'outline'}
                            onClick={() => setSelectedPostgameZone(zone.key)}
                            className={selectedPostgameZone === zone.key
                              ? 'bg-cyan hover:bg-cyan/80 text-base'
                              : 'border-border-subtle text-secondary hover:bg-surface-2'}
                          >
                            {zone.label}
                          </Button>
                        ))}
                      </div>
                      {selectedZoneDrilldown && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                          <div className="rounded-md border border-border-subtle bg-surface-2p-2">
                            <div className="text-secondary">Volumen</div>
                            <div className="text-primary mt-1">Meccs: {selectedZoneDrilldown.gameRate.toFixed(1)}%</div>
                            <div className="text-secondary">Szezon: {selectedZoneDrilldown.seasonRate.toFixed(1)}%</div>
                            <div className={selectedZoneDrilldown.rateDelta >= 0 ? 'text-positive mt-1' : 'text-negative mt-1'}>
                              Delta: {selectedZoneDrilldown.rateDelta >= 0 ? '+' : ''}{selectedZoneDrilldown.rateDelta.toFixed(1)} pp
                            </div>
                          </div>
                          <div className="rounded-md border border-border-subtle bg-surface-2p-2">
                            <div className="text-secondary">Hatékonyság (FG%)</div>
                            <div className="text-primary mt-1">Meccs: {selectedZoneDrilldown.gamePct.toFixed(1)}%</div>
                            <div className="text-secondary">Szezon: {selectedZoneDrilldown.seasonPct.toFixed(1)}%</div>
                            <div className={selectedZoneDrilldown.pctDelta >= 0 ? 'text-positive mt-1' : 'text-negative mt-1'}>
                              Delta: {selectedZoneDrilldown.pctDelta >= 0 ? '+' : ''}{selectedZoneDrilldown.pctDelta.toFixed(1)} pp
                            </div>
                          </div>
                          <div className="rounded-md border border-border-subtle bg-surface-2p-2 text-secondary">
                            <div className="text-secondary">Kísérlet</div>
                            <div className="mt-1">Meccs: {selectedZoneDrilldown.gameAttempts}</div>
                            <div>Szezon: {selectedZoneDrilldown.seasonAttempts}</div>
                            <div className="text-muted mt-1">A zóna részletes összevetése meccs-szezon kontextusban.</div>
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
                        ? 'bg-positive/20 border-positive/50 text-positive'
                        : compositeDelta >= 1.5
                          ? 'bg-positive/10 border-positive/30 text-positive'
                          : compositeDelta <= -4
                            ? 'bg-negative/20 border-negative/50 text-negative'
                            : compositeDelta <= -1.5
                              ? 'bg-negative/10 border-negative/30 text-negative'
                              : 'bg-surface-1/60 border-border-subtle text-primary';

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
                          <div className="p-3 bg-surface-2/50 rounded-lg">
                            <div className="text-sm text-secondary font-medium mb-2">Zónaeloszlás (%)</div>
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
                          <div className="p-3 bg-surface-2/50 rounded-lg">
                            <div className="text-sm text-secondary font-medium mb-2">Zónahatékonyság (FG%)</div>
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

                        <div className="p-3 bg-surface-2/50 rounded-lg space-y-3">
                          <div className="text-sm text-secondary font-medium">Zóna delta hőtérkép (meccs vs szezon)</div>
                          <PostgameZoneHeatmapChart cells={zoneHeatCells} />
                          <div className="text-xs text-secondary">
                            Erős zónák: {strongZones.length > 0 ? strongZones.join(', ') : 'nincs kiugró pozitív zóna'} •
                            Gyenge zónák: {weakZones.length > 0 ? weakZones.join(', ') : 'nincs kiugró gyenge zóna'}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {postgameShotScatterData.length > 0 && (
                    <div className="p-3 bg-surface-2/40 rounded-lg">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm text-secondary font-medium" title="Pontok: konkrét dobások. Heatmap: területi sűrűség vagy FG% hatékonyság réteg.">Dobástérkép kombó nézet (aktuális meccs, félpálya)</div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={showPostgameShotPoints ? 'default' : 'outline'}
                            className={showPostgameShotPoints
                              ? 'h-7 bg-positive hover:bg-positive/80 text-base'
                              : 'h-7 border-border-subtle text-secondary hover:bg-surface-2'}
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
                              ? 'h-7 bg-orange hover:bg-orange/80 text-base'
                              : 'h-7 border-border-subtle text-secondary hover:bg-surface-2'}
                            onClick={() => {
                              if (showPostgameShotHeatmap && !showPostgameShotPoints) return;
                              setShowPostgameShotHeatmap(prev => !prev);
                            }}
                          >
                            Heatmap
                          </Button>
                          {showPostgameShotHeatmap && (
                            <div className="ml-1 flex flex-wrap items-center gap-1 rounded-md border border-border-subtle bg-surface-1/70 p-1">
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
                                      ? 'h-6 px-2 bg-warning/30 text-primary hover:bg-warning/40'
                                      : 'h-6 px-2 border-border-subtle text-secondary hover:bg-surface-2'}
                                    onClick={() => setPostgameHeatmapMode(option.key as 'volume' | 'efficiency')}
                                    title={option.key === 'volume' ? 'Dobáskísérlet sűrűség alapján színez' : 'FG% alapján színez, minimum mintaszámmal'}
                                  >
                                    {option.label}
                                  </Button>
                                ))}
                              </div>
                              <div className="hidden sm:block h-4 w-px bg-border-subtle mx-1" />
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
                                    ? 'h-6 px-2 bg-surface-3 text-primary hover:bg-border-subtle'
                                    : 'h-6 px-2 border-border-subtle text-secondary hover:bg-surface-2'}
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
                        <div className="mb-2 rounded-md border border-warning/40 bg-warning/10 px-2.5 py-2 text-xs text-warning">
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
                      <div className="mt-3 rounded-md border border-border-subtle bg-surface-1/70 p-2.5">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-secondary">Játékos:</span>
                            <Select value={selectedPostgameShotPlayerId} onValueChange={setSelectedPostgameShotPlayerId}>
                              <SelectTrigger className="h-8 w-57.5 text-xs text-primary">
                                <SelectValue placeholder="Minden játékos" />
                              </SelectTrigger>
                              <SelectContent className="">
                                <SelectItem className="" value="all">Minden játékos</SelectItem>
                                {postgameShotPlayerOptions.players.map(player => (
                                  <SelectItem className="" key={player.id} value={player.id}>{player.name}</SelectItem>
                                ))}
                                {postgameShotPlayerOptions.unknownShotCount > 0 && (
                                  <SelectItem className="" value="__unknown__">Ismeretlen játékos ({postgameShotPlayerOptions.unknownShotCount})</SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                          <span className="text-xs text-secondary">Szűrt dobások: {filteredPostgameShotScatterData.length}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted">
                          {showPostgameShotPoints && <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-positive" />Bement</span>}
                          {showPostgameShotPoints && <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-negative" />Kimaradt</span>}
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
                  <div className="text-sm text-secondary font-medium mb-2">Döntő tényezők</div>
                  {decisiveFactorGroups.length > 0 ? (
                    <div className="space-y-3">
                      {decisiveFactorGroups.map(group => (
                        <div
                          key={group.key}
                          className="rounded-lg border border-border-subtle bg-linear-to-r from-surface-1/80 to-surface-2/30 p-3"
                        >
                          <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-secondary">
                            <span>{group.label}</span>
                            <span className={group.axis === 'offense' ? 'text-orange-300' : 'text-cyan-300'}>
                              {group.axis === 'offense' ? '⚡' : '🛡️'}
                            </span>
                          </div>
                          <ul className="mt-2 space-y-1">
                            {group.items.map(label => {
                              const isNegative = isNegativeDecisiveLabel(label, group.axis);
                              const toneClass = isNegative ? 'text-negative' : 'text-positive';
                              const icon = isNegative ? '🔻' : '▲';
                              const isActive = selectedPostgameFactor === label;
                              return (
                                <li key={label}>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedPostgameFactor(label)}
                                    className={`w-full text-left flex items-start gap-2 rounded-md px-2 py-1.5 text-sm transition ${isActive ? 'bg-surface-2/70 ring-1 ring-cyan/40 text-primary' : 'text-primary hover:bg-surface-2/50'}`}
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
                    <div className="text-sm text-secondary">Nincs kiemelt faktor.</div>
                  )}
                </div>
                <div className="space-y-3">
                  <div className="rounded-lg border border-border-subtle bg-surface-1/60 p-3">
                    <div className="text-sm text-secondary font-medium mb-2" title="Megmutatja, hogy típusonként hány döntő faktor jelent meg a meccs képében.">Ellenfél-hatás faktoronként</div>
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
                      <div className="text-sm text-muted">Nincs elég faktor adat az ellenfél-hatás bontáshoz.</div>
                    )}
                  </div>

                  <div className="rounded-lg border border-border-subtle bg-surface-1/60 p-3">
                    <div className="text-sm text-secondary font-medium mb-1">Kiválasztott faktor részletei</div>
                    {selectedFactorDrilldown ? (
                      <div className="space-y-2 text-sm">
                        <div className="text-primary">{selectedFactorDrilldown.label}</div>
                        <div className="text-xs text-secondary">
                          Tengely: {selectedFactorDrilldown.axis === 'offense' ? 'támadás' : 'védekezés'} • Típus: {selectedFactorDrilldown.type}
                        </div>
                        {selectedFactorDrilldown.relatedStats.length > 0 ? (
                          <div className="space-y-1">
                            {selectedFactorDrilldown.relatedStats.map(stat => (
                              <div key={`factor-stat-${stat.key}`} className="text-xs text-secondary flex items-center justify-between rounded border border-border-subtle bg-surface-2/40 px-2 py-1">
                                <span>{stat.label}</span>
                                <span className="text-primary">{stat.delta >= 0 ? '+' : ''}{stat.delta.toFixed(1)}{stat.unit === 'pct' ? ' pp' : ''}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-muted">Nincs közvetlenül kapcsolt key stat.</div>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-muted">Válassz egy faktort a bal oldali listából.</div>
                    )}
                  </div>

                  <div className="rounded-lg border border-border-subtle bg-surface-1/60 p-3">
                    <div className="text-sm text-secondary font-medium mb-1">Ellenfélhez kötött bontás</div>
                    {opponentLinkedBreakdown.length > 0 ? (
                      <div className="space-y-1.5">
                        {opponentLinkedBreakdown.map((row, index) => (
                          <button
                            key={`linked-breakdown-${index}`}
                            type="button"
                            onClick={() => row.linkedFactor && setSelectedPostgameFactor(row.linkedFactor)}
                            className="w-full text-left rounded-md border border-border-subtle bg-surface-2 px-2 py-1.5 hover:bg-surface-3"
                          >
                            <div className="text-xs text-secondary">{row.title}</div>
                            <div className="text-sm text-primary">{row.detail}</div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted">Nincs ellenfélhez kapcsolt extra bontás.</div>
                    )}
                  </div>

                  <div>
                    <div className="text-sm text-secondary font-medium mb-2">Játékos hatás</div>
                    <div className="text-sm text-primary">Pozitív: {postgameReport.playerImpact.positive.join(', ') || '-'}</div>
                    <div className="text-sm text-primary">Negatív: {postgameReport.playerImpact.negative.join(', ') || '-'}</div>
                  </div>
                </div>
              </div>

              {postgameReport.playerReport && (
                <div className="space-y-3 rounded-lg border border-border-subtle bg-surface-2/40 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm text-secondary font-medium">Játékos post-game elemzés</div>
                    <div className="text-xs text-muted">Usage% és TS% perc-normalizált • kattints a sorokra a részletekért</div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {(() => {
                      const highlightCards = [
                        {
                          key: 'mvp',
                          title: 'Meccs motor',
                          player: postgameReport.playerReport.highlights.mvp,
                          classes: 'bg-positive/10 border border-positive/30',
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
                          classes: 'bg-warning/10 border border-warning/30',
                          fallback: 'Nem volt kiugró spark plug.',
                        },
                      ];
                      return highlightCards.map(card => (
                        <div key={card.key} className={`rounded-lg p-3 text-sm text-primary ${card.classes}`}>
                          <div className="text-[11px] uppercase tracking-wide text-muted">{card.title}</div>
                          {card.player ? (
                            <>
                              <div className="text-base font-semibold text-primary">{card.player.name}</div>
                              <div className="text-xs text-secondary">{card.player.summaryLine}</div>
                              <div className="text-[11px] text-secondary mt-1">{card.player.impactLabel}</div>
                            </>
                          ) : (
                            <div className="text-xs text-muted">{card.fallback}</div>
                          )}
                        </div>
                      ));
                    })()}
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    <div className="rounded-lg border border-border-subtle bg-surface-1/60 p-3">
                      <div className="text-sm text-secondary font-medium mb-2" title="X: Usage%, Y: TS%, buborékméret: VAL/36.">Usage vs TS% buborék</div>
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
                          <div className="mt-1 text-[11px] text-muted">Névfelirat: vezetéknév (hosszabb név rövidítve).</div>
                        </>
                      ) : (
                        <div className="text-sm text-muted">Nincs játékosadat a buborékdiagramhoz.</div>
                      )}
                    </div>

                    <div className="rounded-lg border border-border-subtle bg-surface-1/60 p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="text-sm text-secondary font-medium" title="Időbeli alakulás az utolsó 8 meccsen: TS%, Usage%, VAL/36.">Játékos trend (utolsó 8 meccs)</div>
                        <Select value={selectedTrendPlayerId} onValueChange={setSelectedTrendPlayerId}>
                          <SelectTrigger className="h-8 w-52 text-primary">
                            <SelectValue placeholder="Válassz játékost" />
                          </SelectTrigger>
                          <SelectContent className="">
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
                        <div className="text-sm text-muted">Nincs elég meccsadat trendgörbéhez.</div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-muted">Kattints egy sorra a részletekért</div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleGenerateAllPlayerNarratives}
                      disabled={isGeneratingAllPlayerNarratives || !postgameReport.playerReport.players.length}
                      className="bg-violet-900/40 text-violet-200 border-violet-700 hover:bg-violet-800/60"
                    >
                      {isGeneratingAllPlayerNarratives ? 'LLM értékelések készülnek…' : 'Összes játékos LLM értékelése'}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {postgameReport.playerReport.players.map(player => {
                      const isExpanded = expandedPlayerImpactId === player.playerId;
                      const narrativeState = playerNarratives[player.playerId];
                      return (
                        <div key={player.playerId} className="rounded-lg border border-border-subtle bg-surface-1/60">
                          <button
                            type="button"
                            onClick={() => handleTogglePlayerDetail(player.playerId)}
                            className="w-full px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-left"
                          >
                            <div>
                              <div className="text-sm text-primary font-medium">{player.name}</div>
                              <div className="text-xs text-secondary">{player.summaryLine}</div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="px-2 py-1 rounded-full bg-surface-2 text-primary">{player.impactLabel}</span>
                              <span className="px-2 py-1 rounded-full bg-surface-2 text-primary">{player.usageLabel}</span>
                              <span className="text-muted">TS {player.hasShotAttempts ? `${player.tsPct.toFixed(1)}%` : '–'}</span>
                              <span className="text-muted">VAL {player.val}</span>
                              <span className="text-muted">VAL/36 {player.valPer36.toFixed(1)}</span>
                            </div>
                          </button>
                          {isExpanded && (
                            <div className="border-t border-border-subtle px-3 py-3 space-y-3">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-secondary">
                                <div>
                                  <div className="text-[11px] uppercase tracking-wide text-muted">Erősségek</div>
                                  {player.strengths.length > 0 ? (
                                    player.strengths.map(item => <div key={item}>• {item}</div>)
                                  ) : (
                                    <div className="text-muted">Nincs kiemelt erősség.</div>
                                  )}
                                </div>
                                <div>
                                  <div className="text-[11px] uppercase tracking-wide text-muted">Limitációk</div>
                                  {player.issues.length > 0 ? (
                                    player.issues.map(item => <div key={item}>• {item}</div>)
                                  ) : (
                                    <div className="text-muted">Stabil végrehajtás.</div>
                                  )}
                                </div>
                                <div>
                                  <div className="text-[11px] uppercase tracking-wide text-muted">Fókusz</div>
                                  {player.focus.length > 0 ? (
                                    player.focus.map(item => <div key={item}>• {item}</div>)
                                  ) : (
                                    <div className="text-muted">Fenntartandó teljesítmény.</div>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-secondary">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleGeneratePlayerNarrative(player.playerId)}
                                  disabled={narrativeState?.status === 'loading'}
                                  className="bg-surface-2 text-primary border-border-subtle hover:bg-surface-3"
                                >
                                  {narrativeState?.status === 'loading'
                                    ? 'LLM értékelés készül…'
                                    : 'LLM szöveges értékelés'}
                                </Button>
                                {narrativeState?.generatedAt && (
                                  <span>Mentve: {formatGeneratedAt(narrativeState.generatedAt) ?? 'friss'}</span>
                                )}
                                {narrativeState?.status === 'error' && (
                                  <span className="text-negative">{narrativeState.error}</span>
                                )}
                              </div>
                              {narrativeState?.text && (
                                <div className="text-sm text-primary whitespace-pre-line bg-surface-1/80 border border-border-subtle rounded-md px-3 py-2">
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
                  <div className="text-sm text-secondary font-medium mb-2">Erősségek</div>
                  {displayedPostgameStrengths.length > 0 ? (
                    displayedPostgameStrengths.map(item => <div key={item} className="text-sm text-primary">• {item}</div>)
                  ) : (
                    <div className="text-sm text-secondary">Nincs kiemelt erősség.</div>
                  )}
                </div>
                <div>
                  <div className="text-sm text-secondary font-medium mb-2">Problémák</div>
                  {displayedPostgameProblems.length > 0 ? (
                    displayedPostgameProblems.map(item => <div key={item} className="text-sm text-primary">• {item}</div>)
                  ) : (
                    <div className="text-sm text-secondary">Nincs kiemelt probléma.</div>
                  )}
                </div>
              </div>

              <div>
                <div className="text-sm text-secondary font-medium mb-2">Következő fókusz (auto ajánlás)</div>
                {displayedPostgameFocus.length > 0 ? (
                  displayedPostgameFocus.map(item => <div key={item} className="text-sm text-primary">• {item}</div>)
                ) : (
                  <div className="text-sm text-secondary">Nincs kiemelt fókuszpont.</div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>}

      {showPostgameSection && <Card>
        <CardHeader>
          <CardTitle className="font-display uppercase tracking-wide text-primary">Szöveges mérkőzés-elemzés (GPT)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-md border border-border-subtlebg-surface-1/80 p-1">
              {[
                { key: 'fan', label: 'Szurkolóbarát' },
                { key: 'balanced', label: 'Balanced' },
                { key: 'coach', label: 'Edzői' },
              ].map(option => (
                <Button
                  key={`postgame-style-${option.key}`}
                  type="button"
                  size="sm"
                  variant={textReportStyle === option.key ? 'default' : 'outline'}
                  className={textReportStyle === option.key
                    ? 'h-7 px-2 bg-cyan text-base hover:bg-cyan/80'
                    : 'h-7 px-2 border-border-subtle text-secondary hover:bg-surface-2'}
                  onClick={() => setTextReportStyle(option.key as 'fan' | 'balanced' | 'coach')}
                >
                  {option.label}
                </Button>
              ))}
            </div>
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
            <div className="text-xs text-secondary">
              {(() => {
                if (!selectedGameId) return 'Válassz mérkőzést a gomb aktiválásához.';
                if (!pregameReport) return 'A pre-game elemzés szükséges a generáláshoz.';
                if (!postgameReport) return 'A post-game jelentés nélkül nem generálható.';
                if (isLoadingTextReport) return 'Korábbi jelentés betöltése folyamatban…';
                if (textReportMeta.generatedAt) {
                  return `Utolsó mentés: ${formatGeneratedAt(textReportMeta.generatedAt) ?? 'ismeretlen időpont'}`;
                }
                return `Aktív stílus: ${textReportStyle === 'fan' ? 'szurkolóbarát' : textReportStyle === 'coach' ? 'edzői' : 'kiegyensúlyozott'}. Generálj egy szöveges összefoglalót, amit automatikusan el is mentünk.`;
              })()}
            </div>
          </div>

          {textReportError && (
            <div className="text-sm text-negative bg-negative/15 border border-negative/40 rounded-md px-3 py-2">
              {textReportError}
            </div>
          )}

          {isLoadingTextReport && !textReport && (
            <div className="text-sm text-secondary">Korábbi jelentés betöltése…</div>
          )}

          {textReport && (
            <div className="space-y-2">
              <div className="text-xs text-secondary">
                Mentve: {formatGeneratedAt(textReportMeta.generatedAt) ?? 'ismeretlen időpont'} • Forrás:{' '}
                {textReportMeta.generatedBy ?? 'gpt-automata'}
              </div>
              <div className="text-sm text-primary whitespace-pre-line bg-surface-2/60 border border-border-subtle rounded-lg px-4 py-3">
                {textReport}
              </div>
              {postgameReport && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border-subtle hover:bg-surface-2 text-cyan"
                  onClick={() => {
                    const md = postgameReportToMd(postgameReport);
                    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `postgame-${postgameReport.teamName.replace(/\s+/g, '-')}-vs-${postgameReport.opponentName.replace(/\s+/g, '-')}.md`;
                    a.click();
                    URL.revokeObjectURL(url);
                    navigator.clipboard.writeText(md).catch(() => null);
                    toast.success('MD exportálva – vágólapra másolva és letöltve');
                  }}
                >
                  <Download className="w-3 h-3 mr-1.5" />
                  Export MD
                </Button>
              )}
            </div>
          )}

          {!textReport && !isLoadingTextReport && !textReportError && (
            <div className="text-sm text-secondary">
              Még nincs elmentett szöveges elemzés ehhez a meccshez.
            </div>
          )}
        </CardContent>
      </Card>}

      {showPlayerSection && !selectedPlayer && (
        <Card>
          <CardContent className="p-6 text-sm text-secondary">
            Válassz szezont, csapatot és játékost a scouting szintű elemzéshez.
          </CardContent>
        </Card>
      )}

      {showPlayerSection && (
        <details className="rounded-lg border border-border-subtle bg-surface-1 px-4 py-3">
          <summary className="cursor-pointer text-primary font-medium">Fogalmak (röviden)</summary>
          <div className="mt-3 space-y-2 text-sm text-secondary">
            <div><span className="text-primary font-medium">Pace (tempó):</span> dobáskísérlet + 0.44×büntető + labdaeladás, meccsenként.</div>
            <div><span className="text-primary font-medium">eFG%:</span> dobáshatékonyság, ahol a tripla 1.5-nek számít.</div>
            <div><span className="text-primary font-medium">Assist rate:</span> gólpassz / dobáskísérlet arány.</div>
            <div><span className="text-primary font-medium">TO rate:</span> labdaeladás arány a tempóhoz viszonyítva.</div>
            <div><span className="text-primary font-medium">3P/FT rate:</span> triplák/büntetők aránya az összes dobáskísérlethez.</div>
            <div><span className="text-primary font-medium">Usage proxy:</span> FGA + 0.44×FTA + TO – támadó terheltség becslése.</div>
          </div>
        </details>
      )}

      {showPlayerSection && <details className="rounded-lg border border-border-subtle bg-surface-1 px-4 py-3" open>
        <summary className="cursor-pointer text-primary font-medium">Érkező játékos előzetes elemzése</summary>
        <div className="mt-3 space-y-4">
          {!benchmarks && (
            <div className="text-sm text-secondary">Válassz szezont az előzetes elemzéshez.</div>
          )}

          {benchmarks && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs text-muted mb-1 block">Név</label>
                  <Input
                    value={incomingPlayer.name}
                    onChange={(e) => setIncomingPlayer(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Játékos neve"
                    className=""
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      className="bg-surface-2 text-primary hover:bg-surface-3"
                      onClick={() => importIncomingPlayerFromEurobasket()}
                      disabled={isImportingIncomingPlayer || !incomingPlayer.name.trim()}
                    >
                      {isImportingIncomingPlayer ? 'Eurobasket import...' : 'Eurobasket auto import'}
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Poszt</label>
                  <Select
                    value={incomingPlayer.position}
                    onValueChange={(value) => setIncomingPlayer(prev => ({ ...prev, position: value as Position }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Válassz posztot" />
                    </SelectTrigger>
                    <SelectContent className="">
                      <SelectItem value="PG">Irányító</SelectItem>
                      <SelectItem value="SG">Dobóhátvéd</SelectItem>
                      <SelectItem value="SF">Bedobó</SelectItem>
                      <SelectItem value="PF">Erőcsatár</SelectItem>
                      <SelectItem value="C">Center</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Meccsek</label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={displayIncomingValue('games', incomingPlayer.games)}
                    onFocus={() => setFocusedIncomingField('games')}
                    onBlur={() => setFocusedIncomingField(null)}
                    onChange={(e) => handleIncomingNumberChange('games', e.target.value)}
                    className=""
                  />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Perc/meccs</label>
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    value={displayIncomingValue('minutesPerGame', incomingPlayer.minutesPerGame)}
                    onFocus={() => setFocusedIncomingField('minutesPerGame')}
                    onBlur={() => setFocusedIncomingField(null)}
                    onChange={(e) => handleIncomingNumberChange('minutesPerGame', e.target.value)}
                    className=""
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs text-muted mb-1 block">Pont/meccs</label>
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    value={displayIncomingValue('pointsPerGame', incomingPlayer.pointsPerGame)}
                    onFocus={() => setFocusedIncomingField('pointsPerGame')}
                    onBlur={() => setFocusedIncomingField(null)}
                    onChange={(e) => handleIncomingNumberChange('pointsPerGame', e.target.value)}
                    className=""
                  />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Assziszt/meccs</label>
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    value={displayIncomingValue('assistsPerGame', incomingPlayer.assistsPerGame)}
                    onFocus={() => setFocusedIncomingField('assistsPerGame')}
                    onBlur={() => setFocusedIncomingField(null)}
                    onChange={(e) => handleIncomingNumberChange('assistsPerGame', e.target.value)}
                    className=""
                  />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Lepatt./meccs (T)</label>
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
                    className=""
                  />
                  <div className="text-[10px] text-muted">OREB/DREB arány automatikusan megtartva.</div>
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">VAL/meccs</label>
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    value={displayIncomingValue('valuationPerGame', incomingPlayer.valuationPerGame)}
                    onFocus={() => setFocusedIncomingField('valuationPerGame')}
                    onBlur={() => setFocusedIncomingField(null)}
                    onChange={(e) => handleIncomingNumberChange('valuationPerGame', e.target.value)}
                    className=""
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs text-muted mb-1 block">2FGP (%), 2FGA/meccs</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={displayIncomingValue('twoPct', incomingPlayer.twoPct)}
                      onFocus={() => setFocusedIncomingField('twoPct')}
                      onBlur={() => setFocusedIncomingField(null)}
                      onChange={(e) => handleIncomingNumberChange('twoPct', e.target.value)}
                      className=""
                    />
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={displayIncomingValue('twoAttemptedPerGame', incomingPlayer.twoAttemptedPerGame)}
                      onFocus={() => setFocusedIncomingField('twoAttemptedPerGame')}
                      onBlur={() => setFocusedIncomingField(null)}
                      onChange={(e) => handleIncomingNumberChange('twoAttemptedPerGame', e.target.value)}
                      className=""
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">3FGP (%), 3FGA/meccs</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={displayIncomingValue('threePct', incomingPlayer.threePct)}
                      onFocus={() => setFocusedIncomingField('threePct')}
                      onBlur={() => setFocusedIncomingField(null)}
                      onChange={(e) => handleIncomingNumberChange('threePct', e.target.value)}
                      className=""
                    />
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={displayIncomingValue('threeAttemptedPerGame', incomingPlayer.threeAttemptedPerGame)}
                      onFocus={() => setFocusedIncomingField('threeAttemptedPerGame')}
                      onBlur={() => setFocusedIncomingField(null)}
                      onChange={(e) => handleIncomingNumberChange('threeAttemptedPerGame', e.target.value)}
                      className=""
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">FT% és FTA/meccs</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={displayIncomingValue('ftPct', incomingPlayer.ftPct)}
                      onFocus={() => setFocusedIncomingField('ftPct')}
                      onBlur={() => setFocusedIncomingField(null)}
                      onChange={(e) => handleIncomingNumberChange('ftPct', e.target.value)}
                      className=""
                    />
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={displayIncomingValue('ftAttemptedPerGame', incomingPlayer.ftAttemptedPerGame)}
                      onFocus={() => setFocusedIncomingField('ftAttemptedPerGame')}
                      onBlur={() => setFocusedIncomingField(null)}
                      onChange={(e) => handleIncomingNumberChange('ftAttemptedPerGame', e.target.value)}
                      className=""
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs text-muted mb-1 block">Labdaeladás/meccs</label>
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    value={displayIncomingValue('turnoversPerGame', incomingPlayer.turnoversPerGame)}
                    onFocus={() => setFocusedIncomingField('turnoversPerGame')}
                    onBlur={() => setFocusedIncomingField(null)}
                    onChange={(e) => handleIncomingNumberChange('turnoversPerGame', e.target.value)}
                    className=""
                  />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Lopás/meccs</label>
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    value={displayIncomingValue('stealsPerGame', incomingPlayer.stealsPerGame)}
                    onFocus={() => setFocusedIncomingField('stealsPerGame')}
                    onBlur={() => setFocusedIncomingField(null)}
                    onChange={(e) => handleIncomingNumberChange('stealsPerGame', e.target.value)}
                    className=""
                  />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Blokk/meccs</label>
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    value={displayIncomingValue('blocksPerGame', incomingPlayer.blocksPerGame)}
                    onFocus={() => setFocusedIncomingField('blocksPerGame')}
                    onBlur={() => setFocusedIncomingField(null)}
                    onChange={(e) => handleIncomingNumberChange('blocksPerGame', e.target.value)}
                    className=""
                  />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Faultok (elköv/kap)</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={displayIncomingValue('foulsCommittedPerGame', incomingPlayer.foulsCommittedPerGame)}
                      onFocus={() => setFocusedIncomingField('foulsCommittedPerGame')}
                      onBlur={() => setFocusedIncomingField(null)}
                      onChange={(e) => handleIncomingNumberChange('foulsCommittedPerGame', e.target.value)}
                      className=""
                    />
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={displayIncomingValue('foulsReceivedPerGame', incomingPlayer.foulsReceivedPerGame)}
                      onFocus={() => setFocusedIncomingField('foulsReceivedPerGame')}
                      onBlur={() => setFocusedIncomingField(null)}
                      onChange={(e) => handleIncomingNumberChange('foulsReceivedPerGame', e.target.value)}
                      className=""
                    />
                  </div>
                </div>
              </div>

              {incomingImportError && (
                <div className="text-xs text-negative bg-negative/15 border border-negative/40 rounded-md px-3 py-2">
                  {incomingImportError}
                </div>
              )}

              {incomingImportInfo && (
                <div className="text-xs text-positive bg-positive/10 border border-positive/30 rounded-md px-3 py-2 space-y-1">
                  <div>{incomingImportInfo}</div>
                  {incomingImportCareer && (
                    <div className="text-positive/90 space-y-1">
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
                      className="underline text-positive"
                    >
                      Forras profil ({incomingImportSource.seasonYear})
                    </a>
                  )}
                </div>
              )}

              {incomingCandidates.length > 1 && (
                <div className="rounded-md border border-border-subtlebg-base/60 p-3 space-y-3">
                  <div className="text-xs text-secondary">Valaszd ki a megfelelo jatekost:</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {incomingCandidates.map(candidate => (
                      <div
                        key={candidate.profileUrl}
                        className="rounded-md border border-border-subtle bg-surface-1/70 p-3 space-y-2"
                      >
                        <div className="flex items-start gap-3">
                          <Image
                            src={getCandidatePhotoSrc(candidate)}
                            alt={candidate.name}
                            width={64}
                            height={64}
                            className="h-16 w-16 rounded object-cover border border-border-subtlebg-surface-2"
                            loading="lazy"
                            unoptimized
                            onError={() => {
                              setIncomingPhotoLoadFailed(prev => {
                                if (prev[candidate.profileUrl]) return prev;
                                return { ...prev, [candidate.profileUrl]: true };
                              });
                            }}
                          />
                          <div className="text-xs text-primary space-y-1">
                            <div className="font-semibold text-primary">{candidate.name}</div>
                            <div>{candidate.position || '-'} {candidate.height ? `• ${candidate.height} cm` : ''}</div>
                            <div>Szuletett: {candidate.born || '-'}</div>
                            <div className="text-secondary">{candidate.nationality || '-'}</div>
                            <div className="text-secondary">Jelenlegi: {candidate.currentTeam || candidate.team || '-'}</div>
                            <div className="text-muted inline-flex items-center gap-1">
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
                            <div className="text-muted">
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
                            className="bg-surface-2 text-primary hover:bg-surface-3"
                            onClick={() => importIncomingPlayerFromEurobasket(candidate.profileUrl)}
                            disabled={isImportingIncomingPlayer}
                          >
                            Ezt importalom
                          </Button>
                          <a
                            href={candidate.profileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-secondary underline"
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
                <div className="text-xs text-secondary">
                  Az elemzéshez legalább 8 meccs és 15 perc/meccs szükséges.
                </div>
              )}

              {incomingAnalysis && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  <div className="xl:col-span-2 space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="font-display uppercase tracking-wide text-primary">
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
                            <Badge variant="secondary" className="badge-neutral">
                              Nincs egyértelmű szerepkör
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-primary leading-relaxed">{incomingAnalysis.summary}</div>
                        <div className="flex flex-wrap items-center gap-3 text-xs">
                          <span className={`font-semibold ${getConfidenceTone(incomingAnalysis.confidence)}`}>
                            Bizonyosság: {incomingAnalysis.confidence}
                          </span>
                          <span className="text-secondary">Szerep biztonság: {(incomingAnalysis.roleConfidence * 100).toFixed(0)}%</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="font-display uppercase tracking-wide text-primary">Képesség pontszámok</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {Object.entries(incomingAnalysis.skillScores).map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between text-sm">
                            <span className="text-secondary">{SKILL_LABELS_HU[key] ?? key}</span>
                            <div className="flex items-center gap-3">
                              <div className="h-2 w-32 bg-surface-2 rounded-full overflow-hidden">
                                <div className="h-full bg-positive/80" style={{ width: `${value}%` }} />
                              </div>
                              <span className="text-primary font-semibold w-10 text-right">{value}</span>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="font-display uppercase tracking-wide text-primary">Erősségek</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-primary">
                        {incomingAnalysis.strengths.length > 0 ? (
                          <ul className="list-disc list-inside space-y-1 text-pretty leading-relaxed">
                            {incomingAnalysis.strengths.map(item => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-secondary">Nincs kiemelt erősség.</div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="font-display uppercase tracking-wide text-primary">Limitációk</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-primary">
                        {incomingAnalysis.limitations.length > 0 ? (
                          <ul className="list-disc list-inside space-y-1 text-pretty leading-relaxed">
                            {incomingAnalysis.limitations.map(item => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-secondary">Nincs kiemelt limitáció.</div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="font-display uppercase tracking-wide text-primary">Javítandó pontok</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-primary">
                        {incomingAnalysis.improvements.length > 0 ? (
                          <ul className="list-disc list-inside space-y-1 text-pretty leading-relaxed">
                            {incomingAnalysis.improvements.map(item => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-secondary">Nincs kiemelt javítandó pont.</div>
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
        <Button variant="secondary" className="badge-neutral" disabled>
          Determinisztikus értékelés · Ligafüggetlen
        </Button>
      </div>
    </div>
  );
}
