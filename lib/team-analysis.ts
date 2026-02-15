import { normalizeRoleKeys, type RoleKey } from './player-analysis';

import type { Position } from './positions';
export type { Position };

export type TeamSeasonStat = {
  teamId: string;
  teamName: string;
  league: string;
  season: string;
  games: number;
  pointsFor: number;
  pointsAgainst: number;
  fga2: number;
  fgm2: number;
  fga3: number;
  fgm3: number;
  fta: number;
  ftm: number;
  oreb: number;
  dreb: number;
  ast: number;
  tov: number;
  stl: number;
  blk: number;
  fouls: number;
  val: number;
  opponent: {
    fga2: number;
    fgm2: number;
    fga3: number;
    fgm3: number;
    fta: number;
    ftm: number;
    oreb: number;
    dreb: number;
    tov: number;
  };
  roster: Array<{
    playerId: string;
    name: string;
    position: Position;
    positionBuckets?: Position[];
    positionLabel?: string | null;
    rawPosition?: string | null;
    isActive?: boolean;
    minutes: number;
    usageProxy: number;
    heightCm?: number;
    roles: string[];
  }>;
};

export type NormalizedTeamStats = TeamSeasonStat & {
  fga: number;
  fgm: number;
  pace: number; // per game
  assistRate: number;
  turnoverRate: number;
  orebRate: number;
  twoRate: number;
  threeRate: number;
  threePct: number;
  ftRate: number;
  efg: number;
  valPerGame: number;
  opp2Pct: number;
  opp3Pct: number;
  oppTurnoverRate: number;
  hasOpponentShooting: boolean;
  hasOpponentReb: boolean;
  hasOpponentTo: boolean;
};

export type BenchmarkPercentiles = {
  P10: number;
  P25: number;
  P40: number;
  P50: number;
  P60: number;
  P75: number;
  P90: number;
};

export type TeamBenchmarkMeta = {
  teamCount: number;
  avgHeightOverall: number | null;
  avgHeightByPosition: Record<Position, number | null>;
  avgHeightFrontcourt: number | null;
  usageP10: number;
  usageP90: number;
  frontcourtPresenceP10: number;
  frontcourtPresenceP90: number;
  clusterCounts: Record<string, number>;
};

export type TeamBenchmarks = Record<string, BenchmarkPercentiles> & {
  _meta?: TeamBenchmarkMeta;
};

export type LeagueTeamBenchmarks = Record<
  string,
  Record<string, TeamBenchmarks>
>;

export type TeamStyle = {
  offense: string[];
  defense: string[];
};

export type RosterFlags = {
  scorerDependency: boolean;
  lowPlaymakingDepth: boolean;
  weakReboundingPresence: boolean;
};

export type TeamAnalysis = {
  teamId: string;
  teamName: string;
  league: string;
  season: string;
  style: TeamStyle;
  strengths: string[];
  limitations: string[];
  rosterSummary: {
    positionMinutesShare: Record<Position, number>;
    roleCounts: Record<string, number>;
    rolePlayers: Record<string, string[]>;
    top2UsageShare: number;
    flags: RosterFlags;
    avgHeightByPosition: Record<Position, number | null>;
    avgHeightOverall: number | null;
    positionPlayers: Record<Position, string[]>;
    totalMinutes: number;
  };
  rosterInsights: string[];
  riskPriorities: string[];
  leagueProfile: {
    entries: Array<{
      key: string;
      label: string;
      percentile: number;
      value: number;
      tier: string;
    }>;
    clusterLabel: string;
    clusterCount: number | null;
    teamCount: number | null;
    opponentStatsComplete: boolean;
  };
  summary: string;
};

const round = (value: number, digits = 2) => {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);


const ROLE_CATALOG = [
  'Primary Ball Handler',
  'Secondary Creator',
  'Defensive Guard',
  'Offensive Hub',
  '3&D Wing',
  'Scoring Wing',
  'Secondary Playmaker',
  'Glue Guy',
  'Slasher',
  'Floor Spacer',
  'Stretch 4',
  'Physical 4',
  'Rim Protector',
  'Roll Man',
  'Stretch 5',
  'Energy Big',
];

const POSITION_ORDER: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];

type RosterPlayer = TeamSeasonStat['roster'][number];

const normalizePositionLabel = (label?: string | null) => label?.toString().trim().toUpperCase() ?? '';

const buildPositionSignature = (player: RosterPlayer) => {
  const raw = normalizePositionLabel(player.rawPosition ?? player.positionLabel);
  if (raw) return raw;
  if (player.positionBuckets?.length) return player.positionBuckets.join('-');
  return player.position;
};

type AggregatedRosterEntry = {
  playerId: string;
  name: string;
  minutes: number;
  usageProxy: number;
  heightCm?: number;
  roleKeys: RoleKey[];
  positionBuckets: Position[];
  basePosition: Position;
};

type NormalizedRosterEntry = AggregatedRosterEntry & { position: Position };

const dedupePositions = (positions: Array<Position | undefined>): Position[] => {
  const seen = new Set<Position>();
  const ordered: Position[] = [];
  positions.forEach(pos => {
    if (!pos) return;
    if (seen.has(pos)) return;
    seen.add(pos);
    ordered.push(pos);
  });
  return ordered;
};

const mergeRoleKeys = (base: RoleKey[], incoming: RoleKey[]) => {
  const seen = new Set(base);
  incoming.forEach(role => {
    if (!seen.has(role)) {
      seen.add(role);
      base.push(role);
    }
  });
  return base;
};

const buildRosterKey = (player: RosterPlayer) => {
  const signature = buildPositionSignature(player) || 'GEN';
  if (player.playerId) return `${player.playerId}::${signature}`;
  const normalizedName = player.name?.trim().toLowerCase() || 'unknown-player';
  const heightKey = player.heightCm ? Math.round(player.heightCm) : 'na';
  return `${normalizedName}::${heightKey}::${signature}`;
};

const POSITION_BASE_SCORES: Record<Position, number> = {
  PG: -0.15,
  SG: -0.05,
  SF: 0,
  PF: 0.1,
  C: 0.2,
};

const ROLE_POSITION_HINTS: Record<RoleKey, Partial<Record<Position, number>>> = {
  'Primary Ball Handler': { PG: 0.9 },
  'Secondary Creator': { PG: 0.5, SG: 0.4 },
  'Defensive Guard': { PG: 0.4, SG: 0.6 },
  'Offensive Hub': { SF: 0.4, PF: 0.3 },
  '3&D Wing': { SG: 0.3, SF: 0.6 },
  'Scoring Wing': { SG: 0.4, SF: 0.5 },
  'Secondary Playmaker': { PG: 0.4, SG: 0.3, SF: 0.2 },
  'Glue Guy': { SF: 0.4, PF: 0.2 },
  'Slasher': { SG: 0.5, SF: 0.4 },
  'Floor Spacer': { SG: 0.3, SF: 0.3, PF: 0.2 },
  'Stretch 4': { PF: 0.9, SF: 0.2 },
  'Physical 4': { PF: 0.9, C: 0.3 },
  'Rim Protector': { C: 1 },
  'Roll Man': { C: 0.7, PF: 0.4 },
  'Stretch 5': { C: 0.9, PF: 0.4 },
  'Energy Big': { PF: 0.6, C: 0.5 },
};

const getRoleBias = (roles: RoleKey[], position: Position) =>
  roles.reduce((score, role) => score + (ROLE_POSITION_HINTS[role]?.[position] ?? 0), 0);

const getHeightBias = (height: number | undefined, position: Position) => {
  if (typeof height !== 'number' || !Number.isFinite(height)) return 0;
  if (position === 'C') {
    if (height >= 208) return 1;
    if (height >= 203) return 0.6;
    if (height <= 198) return -0.5;
  }
  if (position === 'PF') {
    if (height >= 204) return 0.5;
    if (height <= 196) return -0.3;
  }
  if (position === 'SF') {
    if (height >= 202) return 0.2;
    if (height <= 194) return -0.2;
  }
  if (position === 'SG') {
    if (height <= 192) return 0.4;
    if (height >= 202) return -0.3;
  }
  if (position === 'PG') {
    if (height <= 188) return 0.6;
    if (height >= 198) return -0.4;
  }
  return 0;
};

const resolveRosterPosition = (player: AggregatedRosterEntry): Position => {
  const buckets = player.positionBuckets.length > 0 ? player.positionBuckets : [player.basePosition];
  let bestPosition = player.basePosition;
  let bestScore = -Infinity;

  buckets.forEach((candidate, index) => {
    let score = POSITION_BASE_SCORES[candidate] ?? 0;
    score -= index * 0.1;
    score += getHeightBias(player.heightCm, candidate);
    score += getRoleBias(player.roleKeys, candidate);
    if (candidate === player.basePosition) score += 0.15;
    if (score > bestScore) {
      bestScore = score;
      bestPosition = candidate;
    }
  });

  return bestPosition;
};

const aggregateRoster = (roster: RosterPlayer[]): NormalizedRosterEntry[] => {
  const map = new Map<string, AggregatedRosterEntry>();

  roster.forEach(player => {
    if (player.isActive === false) return;
    const key = buildRosterKey(player);
    const normalizedRoles = normalizeRoleKeys(player.roles ?? []);
    const positionBuckets = dedupePositions([
      ...(player.positionBuckets ?? []),
      player.position,
    ]);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        playerId: player.playerId,
        name: player.name,
        minutes: player.minutes || 0,
        usageProxy: player.usageProxy || 0,
        heightCm: player.heightCm,
        roleKeys: normalizedRoles,
        positionBuckets: positionBuckets.length > 0 ? positionBuckets : ['C'],
        basePosition: player.position,
      });
      return;
    }

    existing.minutes += player.minutes || 0;
    existing.usageProxy += player.usageProxy || 0;
    if (!existing.heightCm && player.heightCm) existing.heightCm = player.heightCm;
    existing.roleKeys = mergeRoleKeys(existing.roleKeys, normalizedRoles);
    existing.positionBuckets = dedupePositions([
      ...existing.positionBuckets,
      ...positionBuckets,
    ]);
  });

  return Array.from(map.values()).map(entry => ({
    ...entry,
    position: resolveRosterPosition(entry),
  }));
};

const toAverage = (values: Array<number | null | undefined>, digits = 1) => {
  const filtered = values.filter((value): value is number => Number.isFinite(value));
  if (filtered.length === 0) return null;
  const sum = filtered.reduce((acc, value) => acc + value, 0);
  return round(sum / filtered.length, digits);
};

const percentileFromThresholds = (value: number, p10: number, p90: number) => {
  if (!Number.isFinite(value) || !Number.isFinite(p10) || !Number.isFinite(p90) || p90 === p10) return 50;
  const score = ((value - p10) / (p90 - p10)) * 100;
  return clamp(score, 0, 100);
};

const percentileLabel = (score: number) => {
  if (score >= 80) return 'Liga elit';
  if (score >= 60) return 'Liga felett';
  if (score >= 40) return 'Liga átlag';
  if (score >= 20) return 'Liga alatt';
  return 'Liga gyenge';
};

const quantile = (sorted: number[], percentile: number) => {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * percentile;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
};

const getStatValue = (team: NormalizedTeamStats, stat: string) => {
  switch (stat) {
    case 'pace':
      return team.pace;
    case 'assist_rate':
      return team.assistRate;
    case 'turnover_rate':
      return team.turnoverRate;
    case 'oreb_rate':
      return team.orebRate;
    case 'two_rate':
      return team.twoRate;
    case 'three_rate':
      return team.threeRate;
    case 'three_pct':
      return team.threePct;
    case 'ft_rate':
      return team.ftRate;
    case 'efg':
      return team.efg;
    case 'val_per_game':
      return team.valPerGame;
    case 'opp2_pct':
      return team.opp2Pct;
    case 'opp3_pct':
      return team.opp3Pct;
    case 'opp_to_rate':
      return team.oppTurnoverRate;
    case 'stl_per_game':
      return team.games > 0 ? team.stl / team.games : 0;
    case 'blk_per_game':
      return team.games > 0 ? team.blk / team.games : 0;
    case 'fouls_per_game':
      return team.games > 0 ? team.fouls / team.games : 0;
    default:
      return 0;
  }
};

export const normalizeTeamStats = (raw: TeamSeasonStat): NormalizedTeamStats => {
  const games = raw.games || 1;
  const fga = raw.fga2 + raw.fga3;
  const fgm = raw.fgm2 + raw.fgm3;
  const hasOpponentShooting = raw.opponent.fga2 + raw.opponent.fga3 > 0;
  const hasOpponentReb = raw.opponent.dreb + raw.opponent.oreb > 0;
  const hasOpponentTo = raw.opponent.tov > 0;
  const computePossessions = (
    fga2: number,
    fga3: number,
    fta: number,
    oreb: number,
    tov: number
  ) => {
    const totalFga = fga2 + fga3;
    const attempts = totalFga + 0.44 * fta + tov;
    const possessions = attempts - oreb;
    return Math.max(possessions, 0);
  };

  const teamPossessions = computePossessions(raw.fga2, raw.fga3, raw.fta, raw.oreb, raw.tov);
  const opponentPossessions = computePossessions(
    raw.opponent.fga2,
    raw.opponent.fga3,
    raw.opponent.fta,
    raw.opponent.oreb,
    raw.opponent.tov
  );
  const teamPossessionsPerGame = games > 0 ? teamPossessions / games : 0;
  const opponentPossessionsPerGame = games > 0 ? opponentPossessions / games : 0;
  const pace = (teamPossessionsPerGame + opponentPossessionsPerGame) / 2;
  const assistRate = fga > 0 ? raw.ast / fga : 0;
  const turnoverRate = teamPossessionsPerGame > 0 ? (raw.tov / games) / teamPossessionsPerGame : 0;
  const orebDenominator = raw.oreb + raw.opponent.dreb;
  const orebRate = orebDenominator > 0 ? raw.oreb / orebDenominator : 0;
  const twoRate = fga > 0 ? raw.fga2 / fga : 0;
  const threeRate = fga > 0 ? raw.fga3 / fga : 0;
  const threePct = raw.fga3 > 0 ? (raw.fgm3 / raw.fga3) * 100 : 0;
  const ftRate = fga > 0 ? raw.fta / fga : 0;
  const efg = fga > 0 ? ((fgm + 0.5 * raw.fgm3) / fga) * 100 : 0;
  const valPerGame = raw.val / games;
  const opp2Pct = raw.opponent.fga2 > 0 ? (raw.opponent.fgm2 / raw.opponent.fga2) * 100 : 0;
  const opp3Pct = raw.opponent.fga3 > 0 ? (raw.opponent.fgm3 / raw.opponent.fga3) * 100 : 0;
  const oppTurnoverRate = opponentPossessionsPerGame > 0
    ? (raw.opponent.tov / games) / opponentPossessionsPerGame
    : 0;

  return {
    ...raw,
    fga,
    fgm,
    pace: round(pace, 2),
    assistRate: round(assistRate, 3),
    turnoverRate: round(turnoverRate, 3),
    orebRate: round(orebRate, 3),
    twoRate: round(twoRate, 3),
    threeRate: round(threeRate, 3),
    threePct: round(threePct, 1),
    ftRate: round(ftRate, 3),
    efg: round(efg, 1),
    valPerGame: round(valPerGame, 1),
    opp2Pct: round(opp2Pct, 1),
    opp3Pct: round(opp3Pct, 1),
    oppTurnoverRate: round(oppTurnoverRate, 3),
    hasOpponentShooting,
    hasOpponentReb,
    hasOpponentTo,
  };
};

const STAT_KEYS = [
  'pace',
  'assist_rate',
  'turnover_rate',
  'oreb_rate',
  'two_rate',
  'three_rate',
  'three_pct',
  'ft_rate',
  'efg',
  'val_per_game',
  'opp2_pct',
  'opp3_pct',
  'opp_to_rate',
  'stl_per_game',
  'blk_per_game',
  'fouls_per_game',
];

export const buildTeamBenchmarks = (teams: TeamSeasonStat[]): LeagueTeamBenchmarks => {
  const normalized = teams.map(normalizeTeamStats);
  const result: LeagueTeamBenchmarks = {};

  normalized.forEach(team => {
    if (!result[team.league]) result[team.league] = {};
    if (!result[team.league][team.season]) result[team.league][team.season] = {};
  });

  Object.keys(result).forEach(league => {
    Object.keys(result[league]).forEach(season => {
      const pool = normalized.filter(t => t.league === league && t.season === season);
      const rosterSummaries = pool.map(team => ({
        team,
        roster: buildRosterSummary(team),
      }));

      const avgHeightOverall = toAverage(rosterSummaries.map(entry => entry.roster.avgHeightOverall));
      const avgHeightByPosition = (['PG', 'SG', 'SF', 'PF', 'C'] as Position[]).reduce(
        (acc, pos) => {
          acc[pos] = toAverage(rosterSummaries.map(entry => entry.roster.avgHeightByPosition[pos]));
          return acc;
        },
        { PG: null, SG: null, SF: null, PF: null, C: null } as Record<Position, number | null>
      );

      const frontcourtHeights = rosterSummaries
        .map(entry => getFrontcourtAvgHeight(entry.roster))
        .filter((value): value is number => Number.isFinite(value));
      const avgHeightFrontcourt = frontcourtHeights.length > 0
        ? round(frontcourtHeights.reduce((sum, value) => sum + value, 0) / frontcourtHeights.length, 1)
        : null;

      const usageShares = rosterSummaries
        .map(entry => entry.roster.top2UsageShare)
        .filter(value => Number.isFinite(value))
        .sort((a, b) => a - b);
      const frontcourtPresence = rosterSummaries
        .map(entry => (entry.roster.positionMinutesShare.PF + entry.roster.positionMinutesShare.C) / 100)
        .filter(value => Number.isFinite(value))
        .sort((a, b) => a - b);

      const usageP10 = round(quantile(usageShares, 0.1), 3);
      const usageP90 = round(quantile(usageShares, 0.9), 3);
      const frontcourtPresenceP10 = round(quantile(frontcourtPresence, 0.1), 3);
      const frontcourtPresenceP90 = round(quantile(frontcourtPresence, 0.9), 3);

      const statBenchmarks: TeamBenchmarks = {};
      STAT_KEYS.forEach(stat => {
        const values = pool
          .map(team => getStatValue(team, stat))
          .filter(v => Number.isFinite(v))
          .sort((a, b) => a - b);
        statBenchmarks[stat] = {
          P10: round(quantile(values, 0.1), 3),
          P25: round(quantile(values, 0.25), 3),
          P40: round(quantile(values, 0.4), 3),
          P50: round(quantile(values, 0.5), 3),
          P60: round(quantile(values, 0.6), 3),
          P75: round(quantile(values, 0.75), 3),
          P90: round(quantile(values, 0.9), 3),
        };
      });
      result[league][season] = statBenchmarks;

      const clusterCounts: Record<string, number> = {};
      rosterSummaries.forEach(entry => {
        const paceScore = getPercentileScore(result, entry.team, 'pace');
        const twoRateScore = getPercentileScore(result, entry.team, 'two_rate');
        const threeRateScore = getPercentileScore(result, entry.team, 'three_rate');
        const assistScore = getPercentileScore(result, entry.team, 'assist_rate');
        const pressureScore = entry.team.hasOpponentTo
          ? getPercentileScore(result, entry.team, 'opp_to_rate')
          : getPercentileScore(result, entry.team, 'stl_per_game');
        const usageScore = percentileFromThresholds(entry.roster.top2UsageShare, usageP10, usageP90);
        const cluster = getClusterLabel({
          paceScore,
          twoRateScore,
          threeRateScore,
          assistScore,
          usageScore,
          pressureScore,
        });
        clusterCounts[cluster] = (clusterCounts[cluster] ?? 0) + 1;
      });
      statBenchmarks._meta = {
        teamCount: pool.length,
        avgHeightOverall,
        avgHeightByPosition,
        avgHeightFrontcourt,
        usageP10,
        usageP90,
        frontcourtPresenceP10,
        frontcourtPresenceP90,
        clusterCounts,
      };
      result[league][season] = statBenchmarks;
    });
  });

  return result;
};

const getBenchmarkThreshold = (
  benchmarks: LeagueTeamBenchmarks,
  team: NormalizedTeamStats,
  stat: string,
  pct: keyof BenchmarkPercentiles
) => {
  return benchmarks[team.league]?.[team.season]?.[stat]?.[pct] ?? 0;
};

const getPercentileScore = (
  benchmarks: LeagueTeamBenchmarks,
  team: NormalizedTeamStats,
  stat: string
) => {
  const p10 = getBenchmarkThreshold(benchmarks, team, stat, 'P10');
  const p90 = getBenchmarkThreshold(benchmarks, team, stat, 'P90');
  const value = getStatValue(team, stat);
  if (!Number.isFinite(value) || !Number.isFinite(p10) || !Number.isFinite(p90) || p90 === p10) {
    return 50;
  }
  const score = ((value - p10) / (p90 - p10)) * 100;
  return clamp(score, 0, 100);
};

const getLeagueMeta = (benchmarks: LeagueTeamBenchmarks, team: NormalizedTeamStats) =>
  benchmarks[team.league]?.[team.season]?._meta;

const getFrontcourtAvgHeight = (roster: ReturnType<typeof buildRosterSummary>) => {
  const heights = [roster.avgHeightByPosition.PF, roster.avgHeightByPosition.C].filter(
    (value): value is number => Number.isFinite(value)
  );
  if (heights.length === 0) return null;
  return round(heights.reduce((sum, value) => sum + value, 0) / heights.length, 1);
};

const getClusterLabel = (inputs: {
  paceScore: number;
  twoRateScore: number;
  threeRateScore: number;
  assistScore: number;
  usageScore: number;
  pressureScore: number;
}) => {
  const { paceScore, twoRateScore, threeRateScore, assistScore, usageScore, pressureScore } = inputs;

  if (paceScore >= 70 && pressureScore >= 60) return 'Transition-heavy';
  if (paceScore >= 60 && twoRateScore >= 60) return 'Gyors, festék-orientált';
  if (paceScore <= 40 && threeRateScore >= 60) return 'Lassú, periméter-orientált';
  if (paceScore <= 45 && assistScore >= 60) return 'Halfcourt, playmaker-domináns';
  if (pressureScore >= 70 && paceScore <= 55) return 'Defense-first';

  const maxScore = Math.max(paceScore, twoRateScore, threeRateScore, assistScore, usageScore, pressureScore);
  if (maxScore === pressureScore) return 'Defense-first';
  if (maxScore === paceScore) return 'Transition-heavy';
  if (maxScore === twoRateScore) return 'Gyors, festék-orientált';
  if (maxScore === threeRateScore) return 'Lassú, periméter-orientált';
  return 'Halfcourt, playmaker-domináns';
};

const scoreAbove = (benchmarks: LeagueTeamBenchmarks, team: NormalizedTeamStats, stat: string, score: number) =>
  getPercentileScore(benchmarks, team, stat) >= score;

const scoreBelow = (benchmarks: LeagueTeamBenchmarks, team: NormalizedTeamStats, stat: string, score: number) =>
  getPercentileScore(benchmarks, team, stat) <= score;

const detectTeamStyle = (team: NormalizedTeamStats, benchmarks: LeagueTeamBenchmarks): TeamStyle => {
  const offense: string[] = [];
  const defense: string[] = [];

  if (
    scoreAbove(benchmarks, team, 'pace', 75)
    && (scoreAbove(benchmarks, team, 'stl_per_game', 60)
      || (team.hasOpponentTo && scoreAbove(benchmarks, team, 'opp_to_rate', 60)))
  ) {
    offense.push('Gyorsindítás-orientált');
  }
  if (scoreBelow(benchmarks, team, 'pace', 40) && scoreAbove(benchmarks, team, 'assist_rate', 60)) {
    offense.push('Félpályás támadás');
  }
  if (scoreAbove(benchmarks, team, 'three_rate', 60) && scoreAbove(benchmarks, team, 'three_pct', 60)) {
    offense.push('Periméter-orientált');
  }
  if (scoreAbove(benchmarks, team, 'two_rate', 60) && scoreAbove(benchmarks, team, 'ft_rate', 60)) {
    offense.push('Festék-orientált');
  }

  if (team.hasOpponentTo && scoreAbove(benchmarks, team, 'stl_per_game', 60) && scoreAbove(benchmarks, team, 'opp_to_rate', 60)) {
    defense.push('Agresszív védekezés');
  }
  if (scoreBelow(benchmarks, team, 'fouls_per_game', 40) && scoreBelow(benchmarks, team, 'pace', 40)) {
    defense.push('Konzervatív védekezés');
  }
  if (team.hasOpponentShooting && scoreAbove(benchmarks, team, 'blk_per_game', 60) && scoreBelow(benchmarks, team, 'opp2_pct', 40)) {
    defense.push('Gyűrűvédő');
  }
  if (team.hasOpponentShooting && scoreBelow(benchmarks, team, 'opp3_pct', 40)) {
    defense.push('Periméter-fókuszú');
  }

  return { offense, defense };
};

const buildRosterSummary = (team: NormalizedTeamStats) => {
  const normalizedRoster = aggregateRoster(team.roster);
  const totalMinutes = normalizedRoster.reduce((sum, player) => sum + (player.minutes || 0), 0) || 1;

  const positionMinutesShare: Record<Position, number> = {
    PG: 0,
    SG: 0,
    SF: 0,
    PF: 0,
    C: 0,
  };

  const positionPlayers: Record<Position, Array<{ name: string; minutes: number }>> = {
    PG: [],
    SG: [],
    SF: [],
    PF: [],
    C: [],
  };

  const heightTotals: Record<Position, { sum: number; count: number }> = {
    PG: { sum: 0, count: 0 },
    SG: { sum: 0, count: 0 },
    SF: { sum: 0, count: 0 },
    PF: { sum: 0, count: 0 },
    C: { sum: 0, count: 0 },
  };
  let heightSum = 0;
  let heightCount = 0;

  const roleCounts: Record<string, number> = ROLE_CATALOG.reduce((acc, role) => {
    acc[role] = 0;
    return acc;
  }, {} as Record<string, number>);
  const rolePlayers: Record<string, string[]> = ROLE_CATALOG.reduce((acc, role) => {
    acc[role] = [];
    return acc;
  }, {} as Record<string, string[]>);

  normalizedRoster.forEach(player => {
    positionMinutesShare[player.position] += player.minutes;
    positionPlayers[player.position].push({ name: player.name, minutes: player.minutes || 0 });

    if (player.heightCm && Number.isFinite(player.heightCm)) {
      heightTotals[player.position].sum += player.heightCm;
      heightTotals[player.position].count += 1;
      heightSum += player.heightCm;
      heightCount += 1;
    }

    player.roleKeys.forEach(role => {
      roleCounts[role] = (roleCounts[role] ?? 0) + 1;
      if (!rolePlayers[role]) rolePlayers[role] = [];
      rolePlayers[role].push(player.name);
    });
  });

  POSITION_ORDER.forEach(pos => {
    positionMinutesShare[pos] = round((positionMinutesShare[pos] / totalMinutes) * 100, 1);
  });

  const sortedUsage = normalizedRoster
    .map(player => player.usageProxy)
    .filter(value => Number.isFinite(value))
    .sort((a, b) => b - a);
  const totalUsage = sortedUsage.reduce((sum, value) => sum + value, 0) || 1;
  const top2Usage = sortedUsage.slice(0, 2).reduce((sum, value) => sum + value, 0);
  const top2UsageShare = round(top2Usage / totalUsage, 3);

  const creatorRoles: RoleKey[] = ['Primary Ball Handler', 'Secondary Creator', 'Secondary Playmaker'];
  const creators = normalizedRoster.filter(player => player.roleKeys.some(role => creatorRoles.includes(role))).length;

  const bigShare = (positionMinutesShare.PF + positionMinutesShare.C) / 100;

  const flags: RosterFlags = {
    scorerDependency: top2UsageShare >= 0.55,
    lowPlaymakingDepth: creators < 2,
    weakReboundingPresence: bigShare < 0.35,
  };

  const avgHeightByPosition = (Object.keys(heightTotals) as Position[]).reduce(
    (acc, pos) => {
      const entry = heightTotals[pos];
      acc[pos] = entry.count > 0 ? round(entry.sum / entry.count, 1) : null;
      return acc;
    },
    {
      PG: null,
      SG: null,
      SF: null,
      PF: null,
      C: null,
    } as Record<Position, number | null>
  );

  const avgHeightOverall = heightCount > 0 ? round(heightSum / heightCount, 1) : null;

  const positionPlayerNames = (Object.keys(positionPlayers) as Position[]).reduce(
    (acc, pos) => {
      acc[pos] = positionPlayers[pos]
        .sort((a, b) => (b.minutes ?? 0) - (a.minutes ?? 0))
        .map(entry => entry.name);
      return acc;
    },
    {
      PG: [],
      SG: [],
      SF: [],
      PF: [],
      C: [],
    } as Record<Position, string[]>
  );

  return {
    positionMinutesShare,
    roleCounts,
    rolePlayers,
    top2UsageShare,
    flags,
    avgHeightByPosition,
    avgHeightOverall,
    positionPlayers: positionPlayerNames,
    totalMinutes,
  };
};

const buildRosterInsights = (
  team: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks,
  roster: ReturnType<typeof buildRosterSummary>
) => {
  const insights: string[] = [];

  const guardShare = roster.positionMinutesShare.PG + roster.positionMinutesShare.SG;
  const wingShare = roster.positionMinutesShare.SF;
  const bigShare = roster.positionMinutesShare.PF + roster.positionMinutesShare.C;

  if (bigShare >= 60) {
    insights.push('Erősen magas poszt-orientált (festékdomináns) struktúra.');
  }
  if (guardShare <= 20) {
    insights.push('Kevés guard perc, a periméter-kezdeményezés korlátozott lehet.');
  }
  if (wingShare <= 10) {
    insights.push('Alacsony wing jelenlét, perimétervédekezés sebezhető lehet.');
  }

  const creators = (roster.roleCounts['Primary Ball Handler'] || 0)
    + (roster.roleCounts['Secondary Creator'] || 0)
    + (roster.roleCounts['Secondary Playmaker'] || 0);
  if (creators <= 1) {
    insights.push('Kevés elsődleges/second playmaker, támadás könnyen beszűkülhet.');
  }

  const rollMen = roster.roleCounts['Roll Man'] || 0;
  const stretchBigs = (roster.roleCounts['Stretch 5'] || 0) + (roster.roleCounts['Stretch 4'] || 0);
  const rimProtectors = roster.roleCounts['Rim Protector'] || 0;

  if (rollMen >= 2) {
    insights.push('Erős pick-and-roll befejező mélység (Roll Man szerepkörök).');
  }
  if (stretchBigs >= 2) {
    insights.push('Több külső dobó magas, jobb spacing potenciál.');
  }
  if (rimProtectors >= 2) {
    insights.push('Festékvédekezésben több rim protector opció.');
  }

  const avgPG = roster.avgHeightByPosition.PG;
  const avgSG = roster.avgHeightByPosition.SG;
  const avgC = roster.avgHeightByPosition.C;

  if (avgPG && avgPG >= 190) {
    insights.push('Magas irányító rotáció (posztátlag alapján).');
  }
  if (avgSG && avgSG >= 193) {
    insights.push('Magas dobóhátvéd sor, periméteren méretelőny lehet.');
  }
  if (avgC && avgC <= 204) {
    insights.push('Relatíve alacsony center rotáció, magas poszton mismatch kockázat.');
  }

  const leagueMeta = getLeagueMeta(benchmarks, team);
  if (leagueMeta?.avgHeightOverall && roster.avgHeightOverall) {
    if (roster.avgHeightOverall > leagueMeta.avgHeightOverall + 3) {
      insights.push('Liga-szintű méretelőny.');
    }
  }

  if (leagueMeta?.avgHeightByPosition?.SG && avgSG) {
    if (avgSG > leagueMeta.avgHeightByPosition.SG + 3) {
      insights.push('Periméter méretelőny ligaszinten.');
    }
  }

  if (leagueMeta?.avgHeightOverall) {
    const frontcourtAvg = getFrontcourtAvgHeight(roster);
    if (frontcourtAvg && frontcourtAvg < leagueMeta.avgHeightOverall - 3) {
      insights.push('Frontcourt mérethátrány.');
    }
  }

  const isHighPace = scoreAbove(benchmarks, team, 'pace', 75);
  const frontcourtShare = roster.positionMinutesShare.PF + roster.positionMinutesShare.C;
  if (isHighPace && frontcourtShare < 20) {
    insights.push('A magas tempó rövid szakaszokon előnyös, azonban a frontcourt mélység hiánya miatt fenntarthatósági kockázatot hordoz 40 perces terhelésen.');
  }
  if (isHighPace && frontcourtShare >= 20) {
    insights.push('A magas tempó a roster összetétele alapján fenntartható.');
  }

  return insights;
};

const strengthLabels: Record<string, string> = {
  pace: 'Magas tempó',
  assist_rate: 'Magas assziszt-arány',
  oreb_rate: 'Erős támadólepattanózás',
  two_rate: 'Magas 2P-arány',
  three_rate: 'Magas triplavolumen',
  three_pct: 'Magas 3P%',
  ft_rate: 'Sok büntető',
  efg: 'Hatékony dobás',
  val_per_game: 'Magas VAL',
  opp2_pct: 'Festékvédekezés',
  opp3_pct: 'Perimétervédekezés',
  opp_to_rate: 'Labdaszerzés/nyomás',
};

const limitationLabels: Record<string, string> = {
  pace: 'Alacsony tempó',
  assist_rate: 'Alacsony assziszt-arány',
  turnover_rate: 'Magas eladott labda arány',
  oreb_rate: 'Gyenge támadólepattanózás',
  two_rate: 'Alacsony 2P-arány',
  three_rate: 'Alacsony triplavolumen',
  three_pct: 'Alacsony 3P%',
  ft_rate: 'Kevés büntető',
  efg: 'Alacsony dobáshatékonyság',
  val_per_game: 'Alacsony VAL',
  opp2_pct: 'Festék sebezhető',
  opp3_pct: 'Periméter sebezhető',
};

const buildStrengths = (team: NormalizedTeamStats, benchmarks: LeagueTeamBenchmarks) => {
  return Object.keys(strengthLabels)
    .filter(stat => {
      if (stat === 'oreb_rate' && !team.hasOpponentReb) return false;
      if ((stat === 'opp2_pct' || stat === 'opp3_pct') && !team.hasOpponentShooting) return false;
      if (stat === 'opp_to_rate' && !team.hasOpponentTo) return false;
      return scoreAbove(benchmarks, team, stat, 60);
    })
    .map(stat => strengthLabels[stat])
    .slice(0, 4);
};

const buildLimitations = (team: NormalizedTeamStats, benchmarks: LeagueTeamBenchmarks) => {
  return Object.keys(limitationLabels)
    .filter(stat => {
      if (stat === 'oreb_rate' && !team.hasOpponentReb) return false;
      if ((stat === 'opp2_pct' || stat === 'opp3_pct') && !team.hasOpponentShooting) return false;
      if (stat === 'opp_to_rate' && !team.hasOpponentTo) return false;
      return scoreBelow(benchmarks, team, stat, 40);
    })
    .map(stat => limitationLabels[stat])
    .slice(0, 4);
};

const buildRiskPriorities = (
  roster: ReturnType<typeof buildRosterSummary>,
  limitations: string[]
) => {
  const risks: Array<{ label: string; weight: number }> = [];

  const positionRiskDetails: Record<Position, string> = {
    PG: 'szervezés és tempó menedzsment',
    SG: 'periméter scoring',
    SF: 'perimétervédekezés és méret',
    PF: 'fizikalitás és lepattanózás',
    C: 'lepattanó és rim defense',
  };

  (Object.keys(roster.positionMinutesShare) as Position[]).forEach(pos => {
    if (roster.positionMinutesShare[pos] < 8) {
      risks.push({
        label: `${pos === 'C' ? 'Center' : pos} hiány → ${positionRiskDetails[pos]}`,
        weight: 3,
      });
    }
  });

  const roleRiskDetails: Record<string, string> = {
    'Primary Ball Handler': 'szervezés limit',
    'Secondary Creator': 'secondary playmaking hiány',
    'Secondary Playmaker': 'másodlagos szervezés hiány',
    'Defensive Guard': 'periméter védekezés limit',
    '3&D Wing': 'kétoldalú wing hiány',
    'Scoring Wing': 'periméter scoring limit',
    'Offensive Hub': 'támadó kapcsolódás limit',
    'Glue Guy': 'kiegészítő szerepek hiánya',
    'Slasher': 'gyűrűtámadás limit',
    'Floor Spacer': 'spacing limit',
    'Stretch 4': 'spacing a magas posztokon',
    'Stretch 5': 'spacing a center poszton',
    'Physical 4': 'fizikalitás hiány',
    'Rim Protector': 'gyűrűvédekezés limit',
    'Roll Man': 'pick-and-roll befejezés limit',
    'Energy Big': 'energia/lepattanó limit',
  };

  ROLE_CATALOG.forEach(role => {
    if ((roster.roleCounts[role] ?? 0) === 0) {
      risks.push({
        label: `${role} hiány → ${roleRiskDetails[role] ?? 'taktikai opció nem elérhető'}`,
        weight: 3,
      });
    }
  });

  const limitationRiskDetails: Record<string, { detail: string; weight: number }> = {
    'Alacsony triplavolumen': { detail: 'spacing limit', weight: 2 },
    'Alacsony 3P%': { detail: 'spacing limit', weight: 2 },
    'Alacsony dobáshatékonyság': { detail: 'pontszerzés ingadozó', weight: 2 },
    'Kevés büntető': { detail: 'könnyű pontok hiánya', weight: 2 },
    'Alacsony 2P-arány': { detail: 'festékjáték limit', weight: 2 },
    'Gyenge támadólepattanózás': { detail: 'második esélyek hiánya', weight: 2 },
    'Magas eladott labda arány': { detail: 'labdabiztonság kockázat', weight: 2 },
    'Alacsony assziszt-arány': { detail: 'támadási flow limit', weight: 2 },
    'Alacsony VAL': { detail: 'összteljesítmény limit', weight: 2 },
    'Alacsony tempó': { detail: 'context-függő matchup kockázat', weight: 1 },
    'Festék sebezhető': { detail: 'rim defense kockázat', weight: 1 },
    'Periméter sebezhető': { detail: 'perimétervédekezés kockázat', weight: 1 },
  };

  limitations.forEach(limitation => {
    const entry = limitationRiskDetails[limitation] ?? { detail: 'kontextusfüggő', weight: 1 };
    risks.push({ label: `${limitation} → ${entry.detail}`, weight: entry.weight });
  });

  const topRisks = risks
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3);

  if (topRisks.length === 0) return [];

  return [
    'Legmagasabb kockázat:',
    ...topRisks.map((risk, index) => `${index + 1}. ${risk.label}`),
  ];
};

const buildSummary = (
  team: NormalizedTeamStats,
  style: TeamStyle,
  roster: ReturnType<typeof buildRosterSummary>,
  rosterInsights: string[],
  benchmarks: LeagueTeamBenchmarks
) => {
  const paceScore = getPercentileScore(benchmarks, team, 'pace');
  const tempo = paceScore >= 65 ? 'magas tempójú' : paceScore <= 35 ? 'alacsony tempójú' : 'közepes tempójú';
  const offense = style.offense[0] ?? 'kiegyensúlyozott támadás';
  const defense = style.defense[0] ?? 'kiegyensúlyozott védekezés';

  const rosterNotes: string[] = [];
  if (roster.flags.scorerDependency) rosterNotes.push('magas a top2 usage koncentráció');
  if (roster.flags.lowPlaymakingDepth) rosterNotes.push('kevés a playmaking mélység');
  if (roster.flags.weakReboundingPresence) rosterNotes.push('korlátozott a magas posztok jelenléte');

  const rosterSentence = rosterNotes.length > 0
    ? `Roster szempontból ${rosterNotes.join(', ')}.`
    : 'Roster szempontból nincs kiugró kockázat.';

  const rosterInsightSentence = rosterInsights.length > 0
    ? ` ${rosterInsights.join(' ')}`
    : '';

  const defenseNote = team.hasOpponentShooting && team.hasOpponentTo
    ? ''
    : ' Opponent statisztikák hiányosak, védekezési profil korlátozott.';

  const leagueMeta = getLeagueMeta(benchmarks, team);
  const percentileNotes: string[] = [];
  percentileNotes.push(`A csapat tempója ${percentileLabel(paceScore).toLowerCase()} (${round(paceScore, 0)}. percentilis).`);

  const twoRateScore = getPercentileScore(benchmarks, team, 'two_rate');
  percentileNotes.push(`2P arány ${percentileLabel(twoRateScore).toLowerCase()} (${round(twoRateScore, 0)}. percentilis).`);

  const threeRateScore = getPercentileScore(benchmarks, team, 'three_rate');
  percentileNotes.push(`3P arány ${percentileLabel(threeRateScore).toLowerCase()} (${round(threeRateScore, 0)}. percentilis).`);

  const threePctScore = getPercentileScore(benchmarks, team, 'three_pct');
  percentileNotes.push(`3P% ${percentileLabel(threePctScore).toLowerCase()} (${round(threePctScore, 0)}. percentilis).`);

  const ftRateScore = getPercentileScore(benchmarks, team, 'ft_rate');
  percentileNotes.push(`FT rate ${percentileLabel(ftRateScore).toLowerCase()} (${round(ftRateScore, 0)}. percentilis).`);

  const assistScore = getPercentileScore(benchmarks, team, 'assist_rate');
  percentileNotes.push(`Assist rate ${percentileLabel(assistScore).toLowerCase()} (${round(assistScore, 0)}. percentilis).`);

  const pressureScore = team.hasOpponentTo
    ? getPercentileScore(benchmarks, team, 'opp_to_rate')
    : getPercentileScore(benchmarks, team, 'stl_per_game');

  const usageScore = leagueMeta
    ? percentileFromThresholds(roster.top2UsageShare, leagueMeta.usageP10, leagueMeta.usageP90)
    : 50;
  percentileNotes.push(`Usage koncentráció ${percentileLabel(usageScore).toLowerCase()} (${round(usageScore, 0)}. percentilis).`);

  const frontcourtPresence = (roster.positionMinutesShare.PF + roster.positionMinutesShare.C) / 100;
  const frontcourtScore = leagueMeta
    ? percentileFromThresholds(frontcourtPresence, leagueMeta.frontcourtPresenceP10, leagueMeta.frontcourtPresenceP90)
    : 50;
  percentileNotes.push(`REB per poszt ${percentileLabel(frontcourtScore).toLowerCase()} (${round(frontcourtScore, 0)}. percentilis).`);

  const cluster = getClusterLabel({
    paceScore,
    twoRateScore,
    threeRateScore,
    assistScore,
    usageScore,
    pressureScore,
  });
  const clusterCount = leagueMeta?.clusterCounts?.[cluster] ?? null;
  const clusterNote = clusterCount && leagueMeta?.teamCount
    ? `A csapat a liga '${cluster}' klaszterébe tartozik (${clusterCount}/${leagueMeta.teamCount} csapat).`
    : `A csapat a liga '${cluster}' klaszterébe tartozik.`;

  return `A csapat ${tempo}, ${offense} fókuszú támadást játszik. Védekezésben ${defense} karakterű. ${rosterSentence}${rosterInsightSentence} ${percentileNotes.join(' ')} ${clusterNote}${defenseNote}`;
};

const buildLeagueProfile = (
  team: NormalizedTeamStats,
  roster: ReturnType<typeof buildRosterSummary>,
  benchmarks: LeagueTeamBenchmarks
) => {
  const leagueMeta = getLeagueMeta(benchmarks, team);
  const paceScore = getPercentileScore(benchmarks, team, 'pace');
  const twoRateScore = getPercentileScore(benchmarks, team, 'two_rate');
  const threeRateScore = getPercentileScore(benchmarks, team, 'three_rate');
  const threePctScore = getPercentileScore(benchmarks, team, 'three_pct');
  const ftRateScore = getPercentileScore(benchmarks, team, 'ft_rate');
  const assistScore = getPercentileScore(benchmarks, team, 'assist_rate');
  const usageScore = leagueMeta
    ? percentileFromThresholds(roster.top2UsageShare, leagueMeta.usageP10, leagueMeta.usageP90)
    : 50;
  const frontcourtPresence = (roster.positionMinutesShare.PF + roster.positionMinutesShare.C) / 100;
  const frontcourtScore = leagueMeta
    ? percentileFromThresholds(frontcourtPresence, leagueMeta.frontcourtPresenceP10, leagueMeta.frontcourtPresenceP90)
    : 50;
  const displayPercentile = (score: number) => clamp(score, 5, 95);

  const pressureScore = team.hasOpponentTo
    ? getPercentileScore(benchmarks, team, 'opp_to_rate')
    : getPercentileScore(benchmarks, team, 'stl_per_game');

  const clusterLabel = getClusterLabel({
    paceScore,
    twoRateScore,
    threeRateScore,
    assistScore,
    usageScore,
    pressureScore,
  });

  return {
    entries: [
      {
        key: 'pace',
        label: 'Tempó',
        percentile: round(displayPercentile(paceScore), 0),
        value: team.pace,
        tier: percentileLabel(paceScore),
      },
      {
        key: 'two_rate',
        label: '2P arány',
        percentile: round(displayPercentile(twoRateScore), 0),
        value: team.twoRate,
        tier: percentileLabel(twoRateScore),
      },
      {
        key: 'three_rate',
        label: '3P arány',
        percentile: round(displayPercentile(threeRateScore), 0),
        value: team.threeRate,
        tier: percentileLabel(threeRateScore),
      },
      {
        key: 'three_pct',
        label: '3P%',
        percentile: round(displayPercentile(threePctScore), 0),
        value: team.threePct,
        tier: percentileLabel(threePctScore),
      },
      {
        key: 'ft_rate',
        label: 'FT rate',
        percentile: round(displayPercentile(ftRateScore), 0),
        value: team.ftRate,
        tier: percentileLabel(ftRateScore),
      },
      {
        key: 'assist_rate',
        label: 'Assist rate',
        percentile: round(displayPercentile(assistScore), 0),
        value: team.assistRate,
        tier: percentileLabel(assistScore),
      },
      {
        key: 'usage_concentration',
        label: 'Usage koncentráció',
        percentile: round(displayPercentile(usageScore), 0),
        value: roster.top2UsageShare,
        tier: percentileLabel(usageScore),
      },
      {
        key: 'frontcourt_presence',
        label: 'REB per poszt',
        percentile: round(displayPercentile(frontcourtScore), 0),
        value: frontcourtPresence,
        tier: percentileLabel(frontcourtScore),
      },
    ],
    clusterLabel,
    clusterCount: leagueMeta?.clusterCounts?.[clusterLabel] ?? null,
    teamCount: leagueMeta?.teamCount ?? null,
    opponentStatsComplete: team.hasOpponentShooting && team.hasOpponentTo,
  };
};

export const analyzeTeamSeason = (
  raw: TeamSeasonStat,
  benchmarks: LeagueTeamBenchmarks
): TeamAnalysis => {
  const normalized = normalizeTeamStats(raw);
  const style = detectTeamStyle(normalized, benchmarks);
  const rosterSummary = buildRosterSummary(normalized);
  const strengths = buildStrengths(normalized, benchmarks);
  const limitations = buildLimitations(normalized, benchmarks);
  const leagueMeta = getLeagueMeta(benchmarks, normalized);
  const leagueProfile = buildLeagueProfile(normalized, rosterSummary, benchmarks);
  const clusterLabel = getClusterLabel({
    paceScore: getPercentileScore(benchmarks, normalized, 'pace'),
    twoRateScore: getPercentileScore(benchmarks, normalized, 'two_rate'),
    threeRateScore: getPercentileScore(benchmarks, normalized, 'three_rate'),
    assistScore: getPercentileScore(benchmarks, normalized, 'assist_rate'),
    usageScore: leagueMeta
      ? percentileFromThresholds(rosterSummary.top2UsageShare, leagueMeta.usageP10, leagueMeta.usageP90)
      : 50,
    pressureScore: normalized.hasOpponentTo
      ? getPercentileScore(benchmarks, normalized, 'opp_to_rate')
      : getPercentileScore(benchmarks, normalized, 'stl_per_game'),
  });

  if (clusterLabel) {
    const clusterTag = `Liga-klaszter: ${clusterLabel}`;
    if (!style.offense.includes(clusterTag)) style.offense.push(clusterTag);
  }
  const riskPriorities = buildRiskPriorities(rosterSummary, limitations);
  const rosterInsights = [
    ...buildRosterInsights(normalized, benchmarks, rosterSummary),
    ...riskPriorities,
  ];

  return {
    teamId: raw.teamId,
    teamName: raw.teamName,
    league: raw.league,
    season: raw.season,
    style,
    strengths,
    limitations,
    rosterSummary,
    rosterInsights,
    riskPriorities: riskPriorities.slice(1),
    leagueProfile,
    summary: buildSummary(normalized, style, rosterSummary, rosterInsights, benchmarks),
  };
};
