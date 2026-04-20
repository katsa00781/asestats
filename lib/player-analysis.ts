import { parsePositionBuckets, type Position } from './positions';
export type { Position };

export type RawPlayerSeasonStat = {
  playerId: string;
  name: string;
  league: string;
  season: string;
  position: Position;
  positionLabel?: string | null;
  positionBuckets?: Position[];
  games: number;
  minutes: number; // total minutes
  points: number;
  close: { made: number; attempted: number };
  mid: { made: number; attempted: number };
  three: { made: number; attempted: number };
  ft: { made: number; attempted: number };
  rebounds: { offensive: number; defensive: number; total?: number };
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: { committed: number; received: number };
  valuation: number;
};

export type NormalizedStats = RawPlayerSeasonStat & {
  minutesPerGame: number;
  fga: number;
  fta: number;
  threePA: number;
  ptsPer36: number;
  rebPer36: number;
  defRebPer36: number;
  astPer36: number;
  stlPer36: number;
  blkPer36: number;
  tovPer36: number;
  fgaPer36: number;
  ftaPer36: number;
  threePAPer36: number;
  threePct: number;
  ftPct: number;
  efg: number;
  tsPct: number;
  astTo: number;
  valPer36: number;
  usageProxyPer36: number;
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

export type StatBenchmarks = Record<string, BenchmarkPercentiles>;

export type LeagueBenchmarks = Record<
  string,
  Record<string, Record<Position, StatBenchmarks>>
>;

export type RoleKey =
  | 'Primary Ball Handler'
  | 'Secondary Creator'
  | 'Defensive Guard'
  | '3&D Wing'
  | 'Scoring Wing'
  | 'Secondary Playmaker'
  | 'Glue Guy'
  | 'Stretch 4'
  | 'Physical 4'
  | 'Rim Protector'
  | 'Roll Man'
  | 'Stretch 5'
  | 'Energy Big'
  | 'Offensive Hub'
  | 'Slasher'
  | 'Floor Spacer';

export type SkillScores = {
  scoring: number;
  shooting: number;
  playmaking: number;
  rebounding: number;
  defense: number;
  efficiency: number;
};

export type RoleResult = {
  role: RoleKey;
  confidence: number;
};

export type PlayerAnalysis = {
  position: Position;
  roleKeys: RoleKey[];
  roles: string[];
  skillScores: SkillScores;
  strengths: string[];
  limitations: string[];
  improvements: string[];
  summary: string;
  confidence: 'Magas' | 'Közepes' | 'Alacsony';
  roleConfidence: number;
};

export type PlayerTrend = {
  name: string;
  position: Position;
  roles: string[];
  VAL_avg_5: number;
  VAL_season_avg: number;
  VAL_std_5: number;
  usage_avg_5: number;
  usage_season_avg: number;
  minutes_avg_5: number;
  trendLabel: 'Improving' | 'Stable' | 'Declining' | 'Strongly Declining';
  consistencyLabel: 'High' | 'Medium' | 'Low';
  roleTrendLabel: 'Expanding' | 'Stable' | 'Shrinking';
  context: 'pre-game' | 'post-game' | 'player-profile';
};

export type VisualTrendBadge = {
  label: string;
  icon: string;
  color: string;
  severity: 'Alacsony' | 'Közepes' | 'Magas';
};

export type PlayerTrendReport = {
  section: string;
  sectionTitle: string;
  focus: string[];
  summary: string;
  stability: string;
  roleTrend: string;
  roleContext: string;
  badge: VisualTrendBadge;
  takeaway: string;
};

const POSITION_PRIORITY: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];
const DEFAULT_POSITION: Position = 'C';

type PositionBucketMeta = {
  buckets: Position[];
  trustOrder: boolean;
};

const dedupePositions = (positions: Position[]): Position[] => {
  const seen = new Set<Position>();
  const ordered: Position[] = [];
  positions.forEach(position => {
    if (position && !seen.has(position)) {
      seen.add(position);
      ordered.push(position);
    }
  });
  return ordered;
};

const derivePositionBuckets = (raw: RawPlayerSeasonStat): PositionBucketMeta => {
  if (raw.positionBuckets?.length) {
    return { buckets: dedupePositions(raw.positionBuckets), trustOrder: true };
  }

  const fromLabel = parsePositionBuckets(raw.positionLabel ?? undefined);
  if (fromLabel.length) {
    return { buckets: dedupePositions(fromLabel), trustOrder: true };
  }

  const fromValue = parsePositionBuckets(raw.position ?? undefined);
  if (fromValue.length) {
    return { buckets: dedupePositions(fromValue), trustOrder: true };
  }

  return { buckets: POSITION_PRIORITY.slice(), trustOrder: false };
};

const computePositionFitScore = (player: NormalizedStats, position: Position) => {
  const {
    astPer36,
    usageProxyPer36,
    rebPer36,
    defRebPer36,
    blkPer36,
    stlPer36,
    threePAPer36,
    ptsPer36,
  } = player;

  switch (position) {
    case 'PG':
      return astPer36 * 2 + usageProxyPer36 * 0.4 + stlPer36 * 0.3 - rebPer36 * 0.3 - blkPer36 * 0.6;
    case 'SG':
      return ptsPer36 * 0.6 + threePAPer36 * 0.8 + usageProxyPer36 * 0.3 + astPer36 * 0.2 - rebPer36 * 0.1 - blkPer36 * 0.4;
    case 'SF':
      return ptsPer36 * 0.5 + rebPer36 * 0.5 + threePAPer36 * 0.4 + stlPer36 * 0.2;
    case 'PF':
      return rebPer36 * 0.9 + defRebPer36 * 0.5 + blkPer36 * 0.7 + ptsPer36 * 0.3 - threePAPer36 * 0.15;
    case 'C':
      return rebPer36 * 1.1 + defRebPer36 * 0.6 + blkPer36 * 0.9 - threePAPer36 * 0.4 - astPer36 * 0.2;
    default:
      return 0;
  }
};

const resolvePositionMetadata = (player: NormalizedStats, raw: RawPlayerSeasonStat) => {
  const { buckets, trustOrder } = derivePositionBuckets(raw);
  if (buckets.length === 0) return { position: DEFAULT_POSITION, buckets: [DEFAULT_POSITION] };
  if (trustOrder || buckets.length === 1) return { position: buckets[0], buckets };

  let bestPosition = buckets[0];
  let bestScore = -Infinity;

  buckets.forEach((candidate, index) => {
    const score = computePositionFitScore(player, candidate) - index * 0.05;
    if (score > bestScore) {
      bestScore = score;
      bestPosition = candidate;
    }
  });

  return { position: bestPosition, buckets };
};

const REQUIRED_MIN_GAMES = 8;
const REQUIRED_MIN_MINUTES_PER_GAME = 15;

const SKILL_LABELS: Record<keyof SkillScores, string> = {
  scoring: 'Pontszerzés',
  shooting: 'Dobás',
  playmaking: 'Játéképítés',
  rebounding: 'Lepattanózás',
  defense: 'Védekezés',
  efficiency: 'Hatékonyság',
};

export const ROLE_LABELS_HU: Record<RoleKey, string> = {
  'Primary Ball Handler': 'Elsődleges irányító',
  'Secondary Creator': 'Másodlagos szervező',
  'Defensive Guard': 'Védekező hátvéd',
  '3&D Wing': 'Triplázó-védő csatár',
  'Scoring Wing': 'Pontszerző csatár',
  'Secondary Playmaker': 'Kiegészítő játéképítő',
  'Glue Guy': 'Csapatember',
  'Stretch 4': 'Térnyitó 4-es',
  'Physical 4': 'Fizikai 4-es',
  'Rim Protector': 'Gyűrűvédő',
  'Roll Man': 'Kettő-kettő befejező',
  'Stretch 5': 'Térnyitó center',
  'Energy Big': 'Energikus magas',
  'Offensive Hub': 'Támadó vezér',
  'Slasher': 'Betörő',
  'Floor Spacer': 'Térnyitó dobó',
};

const ROLE_INTROS: Record<RoleKey, string> = {
  'Primary Ball Handler': 'Elsődleges irányító, aki a támadások fő szervezője és labdakihozatala.',
  'Secondary Creator': 'Másodlagos szervező, aki tehermentesíti az első számú labdakezelőt.',
  'Defensive Guard': 'Periméteren védekező specialista hátvéd, aki ritmust tör meg.',
  '3&D Wing': 'Periméteren megbízható triplázó-védő opció, dobásaival teret nyit.',
  'Scoring Wing': 'Periméteren elsődleges pontszerző opció, önmagának is dobást teremt.',
  'Secondary Playmaker': 'Periméteren kiegészítő játéképítő, aki extra passzt és flow-t ad.',
  'Glue Guy': 'Csapatember szerepben sok apró dolgot tesz hozzá, összetartja a sorokat.',
  'Stretch 4': 'Magas poszton térnyitó 4-es, aki kintről is folyamatosan veszélyes.',
  'Physical 4': 'Fizikai 4-es, aki lepattanóban és a festékben dominál.',
  'Rim Protector': 'Festékben megbízható gyűrűvédő, aki lezárja a palánkot.',
  'Roll Man': 'Kettő-kettő helyzetekben veszélyes befejező, a gyűrű közelében él.',
  'Stretch 5': 'Térnyitó center, aki külső dobással is fenyeget.',
  'Energy Big': 'Energikus magas, aki munkabírásból és küzdésből él.',
  'Offensive Hub': 'Támadásban központi vezér, magas labdabirtoklási aránnyal és ponttermeléssel.',
  'Slasher': 'Betörésekből hatékonyan támadó, faultot kiharcoló játékos.',
  'Floor Spacer': 'Külső dobással teret nyitó, alacsonyabb labdaigényű opció.',
};

const translateRoleLabel = (role: RoleKey) => ROLE_LABELS_HU[role] ?? role;

const translateTrendRoles = (roles: string[]) => roles.map(role => ROLE_LABELS_HU[role as RoleKey] ?? role);

const ROLE_LABEL_ENTRIES = Object.entries(ROLE_LABELS_HU) as Array<[RoleKey, string]>;

export const resolveRoleKey = (role: string): RoleKey | null => {
  if ((ROLE_LABELS_HU as Record<string, string>)[role]) {
    return role as RoleKey;
  }
  const match = ROLE_LABEL_ENTRIES.find(([, label]) => label === role);
  return match ? match[0] : null;
};

export const normalizeRoleKeys = (roles: string[]): RoleKey[] =>
  roles.map(resolveRoleKey).filter((role): role is RoleKey => role !== null);

const STATS_FOR_BENCHMARKS = [
  'pts_per36',
  'reb_per36',
  'def_reb_per36',
  'ast_per36',
  'stl_per36',
  'blk_per36',
  'tov_per36',
  'fga_per36',
  'fta_per36',
  'threePA_per36',
  'threeP_pct',
  'ft_pct',
  'efg',
  'ts_pct',
  'ast_to',
  'val_per36',
  'usage_proxy',
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const round = (value: number, digits = 1) => {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
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


const normalizePer36 = (value: number, minutes: number) => {
  if (minutes <= 0) return 0;
  return (value / minutes) * 36;
};

export const normalizePlayerStats = (raw: RawPlayerSeasonStat): NormalizedStats => {
  const totalRebounds = raw.rebounds.total ?? (raw.rebounds.offensive + raw.rebounds.defensive);
  const minutesPerGame = raw.games > 0 ? raw.minutes / raw.games : 0;
  const fga = raw.close.attempted + raw.mid.attempted + raw.three.attempted;
  const fta = raw.ft.attempted;
  const threePA = raw.three.attempted;
  const fgm = raw.close.made + raw.mid.made + raw.three.made;
  const threePct = raw.three.attempted > 0 ? (raw.three.made / raw.three.attempted) * 100 : 0;
  const ftPct = raw.ft.attempted > 0 ? (raw.ft.made / raw.ft.attempted) * 100 : 0;
  const efg = fga > 0 ? ((fgm + 0.5 * raw.three.made) / fga) * 100 : 0;
  const tsPctDenom = 2 * (fga + 0.44 * fta);
  const tsPct = tsPctDenom > 0 ? (raw.points / tsPctDenom) * 100 : 0;

  const ptsPer36 = normalizePer36(raw.points, raw.minutes);
  const rebPer36 = normalizePer36(totalRebounds, raw.minutes);
  const defRebPer36 = normalizePer36(raw.rebounds.defensive, raw.minutes);
  const astPer36 = normalizePer36(raw.assists, raw.minutes);
  const stlPer36 = normalizePer36(raw.steals, raw.minutes);
  const blkPer36 = normalizePer36(raw.blocks, raw.minutes);
  const tovPer36 = normalizePer36(raw.turnovers, raw.minutes);
  const fgaPer36 = normalizePer36(fga, raw.minutes);
  const ftaPer36 = normalizePer36(fta, raw.minutes);
  const threePAPer36 = normalizePer36(threePA, raw.minutes);
  const valPer36 = normalizePer36(raw.valuation, raw.minutes);
  const usageProxyPer36 = fgaPer36 + 0.44 * ftaPer36 + tovPer36;
  const astTo = tovPer36 > 0.1 ? astPer36 / tovPer36 : astPer36 / 0.1;

  const normalized: NormalizedStats = {
    ...raw,
    minutesPerGame,
    fga,
    fta,
    threePA,
    ptsPer36: round(ptsPer36),
    rebPer36: round(rebPer36),
    defRebPer36: round(defRebPer36),
    astPer36: round(astPer36),
    stlPer36: round(stlPer36),
    blkPer36: round(blkPer36),
    tovPer36: round(tovPer36),
    fgaPer36: round(fgaPer36),
    ftaPer36: round(ftaPer36),
    threePAPer36: round(threePAPer36),
    threePct: round(threePct, 1),
    ftPct: round(ftPct, 1),
    efg: round(efg, 1),
    tsPct: round(tsPct, 1),
    astTo: round(clamp(astTo, 0, 20), 2),
    valPer36: round(valPer36),
    usageProxyPer36: round(usageProxyPer36),
  };

  const { position, buckets } = resolvePositionMetadata(normalized, raw);

  return {
    ...normalized,
    position,
    positionBuckets: buckets,
  };
};

export const isEligibleSample = (normalized: NormalizedStats) => {
  return normalized.games >= REQUIRED_MIN_GAMES && normalized.minutesPerGame >= REQUIRED_MIN_MINUTES_PER_GAME;
};

export const buildLeagueBenchmarks = (players: RawPlayerSeasonStat[]): LeagueBenchmarks => {
  const normalized = players.map(normalizePlayerStats).filter(isEligibleSample);
  const result: LeagueBenchmarks = {};

  normalized.forEach(player => {
    if (!result[player.league]) result[player.league] = {};
    if (!result[player.league][player.season]) result[player.league][player.season] = {} as Record<Position, StatBenchmarks>;
    if (!result[player.league][player.season][player.position]) result[player.league][player.season][player.position] = {};
  });

  Object.keys(result).forEach(league => {
    Object.keys(result[league]).forEach(season => {
      (['PG', 'SG', 'SF', 'PF', 'C'] as Position[]).forEach(position => {
        const pool = normalized.filter(p => p.league === league && p.season === season && p.position === position);
        const statBenchmarks: StatBenchmarks = {};
        STATS_FOR_BENCHMARKS.forEach(stat => {
          const values = pool
            .map(p => getStatValue(p, stat))
            .filter(v => Number.isFinite(v))
            .sort((a, b) => a - b);
          statBenchmarks[stat] = {
            P10: round(quantile(values, 0.1), 2),
            P25: round(quantile(values, 0.25), 2),
            P40: round(quantile(values, 0.4), 2),
            P50: round(quantile(values, 0.5), 2),
            P60: round(quantile(values, 0.6), 2),
            P75: round(quantile(values, 0.75), 2),
            P90: round(quantile(values, 0.9), 2),
          };
        });
        result[league][season][position] = statBenchmarks;
      });
    });
  });

  return result;
};

const getStatValue = (player: NormalizedStats, stat: string) => {
  switch (stat) {
    case 'pts_per36':
      return player.ptsPer36;
    case 'reb_per36':
      return player.rebPer36;
    case 'def_reb_per36':
      return player.defRebPer36;
    case 'ast_per36':
      return player.astPer36;
    case 'stl_per36':
      return player.stlPer36;
    case 'blk_per36':
      return player.blkPer36;
    case 'tov_per36':
      return player.tovPer36;
    case 'fga_per36':
      return player.fgaPer36;
    case 'fta_per36':
      return player.ftaPer36;
    case 'threePA_per36':
      return player.threePAPer36;
    case 'threeP_pct':
      return player.threePct;
    case 'ft_pct':
      return player.ftPct;
    case 'efg':
      return player.efg;
    case 'ts_pct':
      return player.tsPct;
    case 'ast_to':
      return player.astTo;
    case 'val_per36':
      return player.valPer36;
    case 'usage_proxy':
      return player.usageProxyPer36;
    default:
      return 0;
  }
};

const getPercentile = (
  benchmarks: LeagueBenchmarks,
  player: NormalizedStats,
  stat: string
) => {
  const statBenchmarks = benchmarks[player.league]?.[player.season]?.[player.position]?.[stat];
  if (!statBenchmarks) return 0;
  const values = [
    { label: 'P10', value: statBenchmarks.P10 },
    { label: 'P25', value: statBenchmarks.P25 },
    { label: 'P40', value: statBenchmarks.P40 },
    { label: 'P50', value: statBenchmarks.P50 },
    { label: 'P60', value: statBenchmarks.P60 },
    { label: 'P75', value: statBenchmarks.P75 },
    { label: 'P90', value: statBenchmarks.P90 },
  ];
  const statValue = getStatValue(player, stat);
  if (statValue <= values[0].value) return 0;
  if (statValue >= values[values.length - 1].value) return 100;

  for (let i = 0; i < values.length - 1; i += 1) {
    const a = values[i];
    const b = values[i + 1];
    if (statValue >= a.value && statValue <= b.value) {
      const range = b.value - a.value || 1;
      const ratio = (statValue - a.value) / range;
      const aPct = parseInt(a.label.replace('P', ''), 10);
      const bPct = parseInt(b.label.replace('P', ''), 10);
      return aPct + ratio * (bPct - aPct);
    }
  }
  return 50;
};

const getBenchmarkThreshold = (
  benchmarks: LeagueBenchmarks,
  player: NormalizedStats,
  stat: string,
  pct: keyof BenchmarkPercentiles
) => {
  return benchmarks[player.league]?.[player.season]?.[player.position]?.[stat]?.[pct] ?? 0;
};

const scoreFromStats = (values: number[]) => {
  if (values.length === 0) return 0;
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  return clamp(Math.round(avg), 0, 100);
};

const computeSkillScores = (player: NormalizedStats, benchmarks: LeagueBenchmarks): SkillScores => {
  const scoring = getPercentile(benchmarks, player, 'pts_per36');
  const shooting = player.position === 'PF' || player.position === 'C'
    ? scoreFromStats([
        getPercentile(benchmarks, player, 'ft_pct'),
        getPercentile(benchmarks, player, 'efg'),
      ])
    : scoreFromStats([
        getPercentile(benchmarks, player, 'threeP_pct'),
        getPercentile(benchmarks, player, 'ft_pct'),
        getPercentile(benchmarks, player, 'efg'),
      ]);

  const playmakingWeights = player.position === 'PG' || player.position === 'SG'
    ? [0.7, 0.3]
    : [0.5, 0.5];
  const playmaking = clamp(Math.round(
    getPercentile(benchmarks, player, 'ast_per36') * playmakingWeights[0] +
    getPercentile(benchmarks, player, 'ast_to') * playmakingWeights[1]
  ), 0, 100);

  const defense = player.position === 'PF' || player.position === 'C'
    ? scoreFromStats([
        getPercentile(benchmarks, player, 'blk_per36'),
        getPercentile(benchmarks, player, 'def_reb_per36'),
      ])
    : clamp(Math.round(
        getPercentile(benchmarks, player, 'stl_per36') * 0.5 +
        getPercentile(benchmarks, player, 'def_reb_per36') * 0.25 +
        getPercentile(benchmarks, player, 'blk_per36') * 0.25
      ), 0, 100);

  const rebounding = getPercentile(benchmarks, player, 'reb_per36');
  const efficiency = scoreFromStats([
    getPercentile(benchmarks, player, 'val_per36'),
    getPercentile(benchmarks, player, 'efg'),
  ]);

  return {
    scoring: clamp(Math.round(scoring), 0, 100),
    shooting,
    playmaking,
    rebounding: clamp(Math.round(rebounding), 0, 100),
    defense,
    efficiency,
  };
};

const detectRoles = (player: NormalizedStats, benchmarks: LeagueBenchmarks): RoleResult[] => {
  const roles: RoleResult[] = [];

  const meets = (stat: string, pct: keyof BenchmarkPercentiles, compare: '>=' | '<', value?: number) => {
    const target = value ?? getBenchmarkThreshold(benchmarks, player, stat, pct);
    const actual = getStatValue(player, stat);
    return compare === '>=' ? actual >= target : actual < target;
  };

  const pushRole = (role: RoleKey, conditions: boolean[]) => {
    const satisfied = conditions.filter(Boolean).length;
    const confidence = conditions.length > 0 ? satisfied / conditions.length : 0;
    if (confidence > 0) {
      roles.push({ role, confidence: round(confidence, 2) });
    }
  };

  if (player.position === 'PG') {
    pushRole('Primary Ball Handler', [
      meets('ast_per36', 'P75', '>='),
      meets('usage_proxy', 'P60', '>='),
      player.astTo >= 1.8,
    ]);
    pushRole('Secondary Creator', [
      meets('ast_per36', 'P60', '>='),
      meets('usage_proxy', 'P50', '>='),
    ]);
    pushRole('Defensive Guard', [
      meets('stl_per36', 'P60', '>='),
      meets('def_reb_per36', 'P40', '>='),
      meets('usage_proxy', 'P60', '<'),
    ]);
    pushRole('Offensive Hub', [
      meets('pts_per36', 'P75', '>='),
      meets('usage_proxy', 'P75', '>='),
    ]);
  }

  if (player.position === 'SG' || player.position === 'SF') {
    pushRole('3&D Wing', [
      meets('threePA_per36', 'P60', '>='),
      meets('threeP_pct', 'P50', '>='),
      meets('stl_per36', 'P50', '>='),
      meets('usage_proxy', 'P60', '<'),
    ]);
    pushRole('Scoring Wing', [
      meets('pts_per36', 'P75', '>='),
      meets('usage_proxy', 'P60', '>='),
    ]);
    pushRole('Secondary Playmaker', [
      meets('ast_per36', 'P60', '>='),
      player.astTo >= 1.6,
    ]);
    pushRole('Glue Guy', [
      meets('usage_proxy', 'P50', '<'),
      meets('val_per36', 'P60', '>='),
    ]);
    pushRole('Offensive Hub', [
      meets('pts_per36', 'P75', '>='),
      meets('usage_proxy', 'P75', '>='),
    ]);
    pushRole('Slasher', [
      meets('fta_per36', 'P60', '>='),
      meets('threePA_per36', 'P40', '<'),
      meets('pts_per36', 'P60', '>='),
    ]);
    pushRole('Floor Spacer', [
      meets('threeP_pct', 'P75', '>='),
      meets('threePA_per36', 'P60', '>='),
      meets('usage_proxy', 'P60', '<'),
    ]);
  }

  if (player.position === 'PF') {
    pushRole('Stretch 4', [
      meets('threePA_per36', 'P60', '>='),
      meets('threeP_pct', 'P50', '>='),
      meets('reb_per36', 'P50', '>='),
    ]);
    pushRole('Physical 4', [
      meets('reb_per36', 'P75', '>='),
      meets('def_reb_per36', 'P60', '>='),
      meets('blk_per36', 'P40', '>='),
    ]);
    pushRole('Floor Spacer', [
      meets('threeP_pct', 'P75', '>='),
      meets('threePA_per36', 'P50', '>='),
      meets('usage_proxy', 'P60', '<'),
    ]);
  }

  if (player.position === 'C') {
    pushRole('Rim Protector', [
      meets('blk_per36', 'P75', '>='),
      meets('def_reb_per36', 'P60', '>='),
    ]);
    pushRole('Roll Man', [
      meets('pts_per36', 'P60', '>='),
      meets('usage_proxy', 'P60', '>='),
      meets('efg', 'P60', '>='),
    ]);
    pushRole('Stretch 5', [
      meets('threePA_per36', 'P50', '>='),
      meets('threeP_pct', 'P40', '>='),
      meets('efg', 'P60', '>='),
    ]);
    pushRole('Energy Big', [
      meets('reb_per36', 'P75', '>='),
      meets('stl_per36', 'P40', '>='),
      meets('usage_proxy', 'P50', '<'),
    ]);
    pushRole('Floor Spacer', [
      meets('threeP_pct', 'P75', '>='),
      meets('threePA_per36', 'P50', '>='),
      meets('usage_proxy', 'P60', '<'),
    ]);
  }

  return roles.sort((a, b) => b.confidence - a.confidence).slice(0, 2);
};

const buildStrengths = (skills: SkillScores) => {
  return Object.entries(skills)
    .sort((a, b) => b[1] - a[1])
    .filter(([, value]) => value >= 70)
    .slice(0, 2)
    .map(([key]) => SKILL_LABELS[key as keyof SkillScores]);
};

const buildLimitations = (skills: SkillScores) => {
  return Object.entries(skills)
    .sort((a, b) => a[1] - b[1])
    .filter(([, value]) => value <= 40)
    .slice(0, 2)
    .map(([key]) => SKILL_LABELS[key as keyof SkillScores]);
};

const buildImprovementPoints = (
  player: NormalizedStats,
  benchmarks: LeagueBenchmarks,
  roles: RoleKey[]
) => {
  const improvements: string[] = [];

  const threshold = (stat: string, pct: keyof BenchmarkPercentiles) =>
    getBenchmarkThreshold(benchmarks, player, stat, pct);

  const threePct = player.threePct;
  const threePA = player.threePAPer36;
  const ftPct = player.ftPct;
  const fta = player.ftaPer36;
  const efg = player.efg;
  const usage = player.usageProxyPer36;
  const ast = player.astPer36;
  const tov = player.tovPer36;
  const astTo = player.astTo;
  const reb = player.rebPer36;
  const defReb = player.defRebPer36;
  const stl = player.stlPer36;
  const blk = player.blkPer36;

  if (threePct >= threshold('threeP_pct', 'P75') && threePA <= threshold('threePA_per36', 'P40')) {
    improvements.push(`Tripla hatékonyság erős (${round(threePct, 1)}%), de alacsony volumen (${round(threePA, 1)} hármaskísérlet/36).`);
  }

  if (ftPct >= threshold('ft_pct', 'P75') && fta <= threshold('fta_per36', 'P40')) {
    improvements.push(`Büntető hatékonyság jó (${round(ftPct, 1)}%), de kevés kiharcolt dobás (${round(fta, 1)} büntető/36).`);
  }

  if (efg <= threshold('efg', 'P40') && usage >= threshold('usage_proxy', 'P60')) {
    improvements.push(`Magas labdabirtoklási arány (${round(usage, 1)}/36) mellett alacsony effektív mezőny% (${round(efg, 1)}%) → dobásminőség javítása szükséges.`);
  }

  if (usage <= threshold('usage_proxy', 'P40') && efg >= threshold('efg', 'P60')) {
    improvements.push(`Alacsony labdabirtoklási arány (${round(usage, 1)}/36) mellett jó effektív mezőny% (${round(efg, 1)}%) → több támadó szerep vállalható.`);
  }

  if (tov >= threshold('tov_per36', 'P60') && astTo <= threshold('ast_to', 'P40')) {
    improvements.push(`Labdaeladások mérséklése (eladott labdák/36: ${round(tov, 1)}, gólpassz/eladott labda: ${round(astTo, 2)}).`);
  }

  if ((player.position === 'PG' || player.position === 'SG') && ast <= threshold('ast_per36', 'P40') && usage >= threshold('usage_proxy', 'P50')) {
    improvements.push(`Játéképítés fejlesztése (gólpassz/36: ${round(ast, 1)}) a labdával töltött időhöz mérten.`);
  }

  if ((player.position === 'PF' || player.position === 'C') && reb <= threshold('reb_per36', 'P40')) {
    improvements.push(`Lepattanózás erősítése (lepattanó/36: ${round(reb, 1)}).`);
  }

  if ((player.position === 'SG' || player.position === 'SF') && stl <= threshold('stl_per36', 'P40') && defReb <= threshold('def_reb_per36', 'P40')) {
    improvements.push(`Periméter védekezés és birtoklásonkénti érték növelése (labdaszerzés/36: ${round(stl, 1)}, védőlepattanó/36: ${round(defReb, 1)}).`);
  }

  if ((player.position === 'PF' || player.position === 'C') && blk <= threshold('blk_per36', 'P40')) {
    improvements.push(`Gyűrűvédelem javítása (blokkok/36: ${round(blk, 1)}).`);
  }

  const lowAst = ast <= threshold('ast_per36', 'P40');
  const low3PA = threePA <= threshold('threePA_per36', 'P40');
  const ftBelowAvg = ftPct <= threshold('ft_pct', 'P50');
  const foulsPer36 = normalizePer36(player.fouls.committed, player.minutes);
  const highFouls = foulsPer36 >= 4;

  if (roles.includes('Roll Man') && lowAst) {
    improvements.push(`Passzjáték és gyors döntések fejlesztése kevés gólpassztermelés mellett (AST/TO: ${round(astTo, 2)}).`);
  }
  if (ftBelowAvg) {
    improvements.push('Büntetődobás stabilitás javítása.');
  }
  if (highFouls) {
    improvements.push(`Fault fegyelem javítása (${round(foulsPer36, 1)} fault/36), a felesleges szabálytalanságok csökkentésével.`);
  }
  if (low3PA && roles.includes('Stretch 5') === false && roles.includes('Stretch 4') === false) {
    improvements.push('Térnyitás növelése (legalább sarokból érkező fenyegetés).');
  }

  if (improvements.length === 0) {
    improvements.push('Alacsony prioritású fejlesztés: szerep optimalizálása és párosítás-alapú finomhangolás.');
  }

  return improvements.slice(0, 3);
};

const buildSummary = (
  player: NormalizedStats,
  roles: RoleResult[],
  skills: SkillScores,
  benchmarks: LeagueBenchmarks
) => {
  const intro = roles[0]?.role ? ROLE_INTROS[roles[0].role] : `${player.position} poszton szereplő játékos.`;
  const roleKeys = roles.map(role => role.role);
  const rankedSkills = (Object.entries(skills) as Array<[keyof SkillScores, number]>)
    .sort((a, b) => b[1] - a[1]);
  const topSkill = rankedSkills[0]?.[0] ?? null;
  const secondSkill = rankedSkills[1]?.[0] ?? null;
  const weakestSkill = rankedSkills[rankedSkills.length - 1]?.[0] ?? null;

  const valPct = getPercentile(benchmarks, player, 'val_per36');
  const usagePct = getPercentile(benchmarks, player, 'usage_proxy');

  const describeStrength = (skill: keyof SkillScores | null, secondary = false) => {
    if (!skill) return '';

    switch (skill) {
      case 'scoring':
        if (usagePct < 40) {
          return secondary
            ? 'Pontszerzésben szerepköréhez mérten hatékony kiegészítő opció.'
            : 'Pontszerzésben inkább hatékony befejező, mint elsődleges volumenforrás.';
        }
        return secondary
          ? 'Pontszerzésben stabil második hullámos terhelést is elbír.'
          : 'Pontszerzésben a posztjához képest erős volumen-hatékonyságot ad.';
      case 'shooting':
        return secondary
          ? 'Dobásban használható másodlagos erősség.'
          : 'Dobásminőség és kivitelezés terén erős profil.';
      case 'playmaking':
        return secondary
          ? 'Játéképítésben kiegészítő előnyt ad.'
          : 'Játéképítésben a szerepkörénél több kapcsolódó értéket termel.';
      case 'rebounding':
        return secondary
          ? 'Lepattanózásban stabil kiegészítő érték.'
          : 'Lepattanózásban a posztjához képest erős jelenlétet ad.';
      case 'defense':
        return secondary
          ? 'Védekezésben használható kiegészítő érték.'
          : 'Védekezésben a posztjához képest pozitív hatást ad.';
      case 'efficiency':
        return secondary
          ? 'Hatékonyságban megbízható másodlagos erősség.'
          : 'Hatékonyságban kiemelt erősség, kevés labdából is értéket termel.';
      default:
        return '';
    }
  };

  const describeWeakness = (skill: keyof SkillScores | null) => {
    if (!skill) return '';

    switch (skill) {
      case 'playmaking':
        return player.position === 'PF' || player.position === 'C'
          ? 'Játéképítésben inkább befejező magas, nem szervező típus.'
          : 'Játéképítésben nem elsődleges szervező, passzjátéka limitáltabb.';
      case 'shooting':
        return 'Dobásban jelenleg nincs stabil, széles spektrumú fenyegetés.';
      case 'defense':
        return 'Védekezésben a nyers boxscore-hatás nem elég következetes.';
      case 'rebounding':
        return 'Lepattanózásban nincs állandó fölénye a saját posztján.';
      case 'scoring':
        return usagePct < 40
          ? 'Pontszerzésben jelenleg inkább kiegészítő volumenű opció.'
          : 'Pontszerzésben a volumen és a hatékonyság nem egyszerre kiugró.';
      case 'efficiency':
        return 'Hatékonyságban nincs minden területen stabil plusza.';
      default:
        return '';
    }
  };

  const primaryStrength = describeStrength(topSkill, false);
  const secondaryStrength = secondSkill && secondSkill !== topSkill ? describeStrength(secondSkill, true) : '';
  const limitation = describeWeakness(weakestSkill);

  let valSentence = '';
  if (skills.scoring >= 70 && valPct < 40) {
    valSentence = 'Magas ponttermelés mellett a VAL hatékonysági mutató visszafogott.';
  } else if (usagePct < 40 && valPct >= 70) {
    valSentence = 'Alacsony labdabirtoklási arány mellett is erős VAL/36 értéket ad, ezért kiegészítő szerepben is hasznos.';
  } else if (valPct >= 75) {
    valSentence = 'VAL/36 alapú hozzájárulása a saját posztján a mezőny felső részébe esik.';
  } else {
    valSentence = 'VAL/36 mutatója inkább a ligaátlag körüli vagy enyhén afeletti szintet jelzi.';
  }

  const twoAttempts = player.close.attempted + player.mid.attempted;
  const twoMade = player.close.made + player.mid.made;
  const twoPct = twoAttempts > 0 ? (twoMade / twoAttempts) * 100 : 0;
  const outsidePaintShare = player.fga > 0
    ? (player.mid.attempted + player.three.attempted) / player.fga
    : 0;
  const lowAst = player.astPer36 <= getBenchmarkThreshold(benchmarks, player, 'ast_per36', 'P40');
  const highTwoPct = twoPct >= 55;
  const lowOutsidePaint = outsidePaintShare <= 0.35;
  const highValPer36 = player.valPer36 >= getBenchmarkThreshold(benchmarks, player, 'val_per36', 'P75');
  const lowUsage = player.usageProxyPer36 <= getBenchmarkThreshold(benchmarks, player, 'usage_proxy', 'P40');
  const hasInteriorRole = roleKeys.includes('Rim Protector') || roleKeys.includes('Roll Man');
  const hasRollMan = roleKeys.includes('Roll Man');

  const interiorContext = hasInteriorRole && highTwoPct && lowAst && lowOutsidePaint && highValPer36
    ? [
        `Pontjainak döntő része ${hasRollMan ? 'kettő-kettő befejezésekből, ' : ''}támadólepattanókból és közeli szituációkból érkezik.`,
        lowUsage ? 'Kevés labdát igényel, alacsony labdabirtoklási arány mellett is magas hatékonyságot ad.' : '',
      ].filter(Boolean).join(' ')
    : '';

  return [intro, interiorContext, primaryStrength, secondaryStrength, limitation, valSentence]
    .filter(Boolean)
    .join(' ')
    .trim();
};

const roleConfidenceLabel = (confidence: number): PlayerAnalysis['confidence'] => {
  if (confidence >= 0.75) return 'Magas';
  if (confidence >= 0.5) return 'Közepes';
  return 'Alacsony';
};

// Clamp skill scores to 0-100 range.
const clampSkillScores = (scores: SkillScores): SkillScores => ({
  scoring: clamp(Math.round(scores.scoring), 0, 100),
  shooting: clamp(Math.round(scores.shooting), 0, 100),
  playmaking: clamp(Math.round(scores.playmaking), 0, 100),
  rebounding: clamp(Math.round(scores.rebounding), 0, 100),
  defense: clamp(Math.round(scores.defense), 0, 100),
  efficiency: clamp(Math.round(scores.efficiency), 0, 100),
});

// Clamp role confidence to 0-1 range with a conservative ceiling.
const clampRoleConfidence = (confidence: number, games: number) => {
  const cap = games >= 20 ? 0.95 : 0.9;
  return clamp(round(confidence, 2), 0, cap);
};

// Compute percentiles used to cap skill scores.
const computeSkillPercentiles = (player: NormalizedStats, benchmarks: LeagueBenchmarks) => {
  const scoring = getPercentile(benchmarks, player, 'pts_per36');
  const shooting = player.position === 'PF' || player.position === 'C'
    ? scoreFromStats([
        getPercentile(benchmarks, player, 'ft_pct'),
        getPercentile(benchmarks, player, 'efg'),
      ])
    : scoreFromStats([
        getPercentile(benchmarks, player, 'threeP_pct'),
        getPercentile(benchmarks, player, 'ft_pct'),
        getPercentile(benchmarks, player, 'efg'),
      ]);
  const playmakingWeights = player.position === 'PG' || player.position === 'SG'
    ? [0.7, 0.3]
    : [0.5, 0.5];
  const playmaking = clamp(Math.round(
    getPercentile(benchmarks, player, 'ast_per36') * playmakingWeights[0] +
    getPercentile(benchmarks, player, 'ast_to') * playmakingWeights[1]
  ), 0, 100);
  const rebounding = getPercentile(benchmarks, player, 'reb_per36');
  const defense = player.position === 'PF' || player.position === 'C'
    ? scoreFromStats([
        getPercentile(benchmarks, player, 'blk_per36'),
        getPercentile(benchmarks, player, 'def_reb_per36'),
      ])
    : clamp(Math.round(
        getPercentile(benchmarks, player, 'stl_per36') * 0.5 +
        getPercentile(benchmarks, player, 'def_reb_per36') * 0.25 +
        getPercentile(benchmarks, player, 'blk_per36') * 0.25
      ), 0, 100);
  const efficiency = scoreFromStats([
    getPercentile(benchmarks, player, 'val_per36'),
    getPercentile(benchmarks, player, 'efg'),
  ]);

  return { scoring, shooting, playmaking, rebounding, defense, efficiency };
};

// Cap skill scores at 95 unless percentile indicates an outlier (>=95).
const applySkillCaps = (scores: SkillScores, percentiles: SkillScores): SkillScores => ({
  scoring: percentiles.scoring >= 95 ? clamp(scores.scoring, 0, 100) : Math.min(scores.scoring, 95),
  shooting: percentiles.shooting >= 95 ? clamp(scores.shooting, 0, 100) : Math.min(scores.shooting, 95),
  playmaking: percentiles.playmaking >= 95 ? clamp(scores.playmaking, 0, 100) : Math.min(scores.playmaking, 95),
  rebounding: percentiles.rebounding >= 95 ? clamp(scores.rebounding, 0, 100) : Math.min(scores.rebounding, 95),
  defense: percentiles.defense >= 95 ? clamp(scores.defense, 0, 100) : Math.min(scores.defense, 95),
  efficiency: percentiles.efficiency >= 95 ? clamp(scores.efficiency, 0, 100) : Math.min(scores.efficiency, 95),
});

// Build a validated PlayerAnalysis object from raw stats.
const buildValidatedAnalysis = (
  raw: RawPlayerSeasonStat,
  benchmarks: LeagueBenchmarks
): PlayerAnalysis => {
  const normalized = normalizePlayerStats(raw);
  const roles = detectRoles(normalized, benchmarks);
  const roleConfidence = roles.length > 0 ? roles[0].confidence : 0;
  const roleKeys = roles.map(role => role.role);
  const rawSkills = clampSkillScores(computeSkillScores(normalized, benchmarks));
  const skillPercentiles = computeSkillPercentiles(normalized, benchmarks);
  const skills = applySkillCaps(rawSkills, skillPercentiles);
  const strengths = buildStrengths(skills);
  const limitations = buildDetailedLimitations(normalized, benchmarks, roleKeys, skills);
  const improvements = buildImprovementPoints(normalized, benchmarks, roleKeys);
  const cappedConfidence = clampRoleConfidence(roleConfidence, raw.games);

  return {
    position: normalized.position,
    roleKeys,
    roles: roleKeys.map(translateRoleLabel),
    skillScores: skills,
    strengths,
    limitations,
    improvements,
    summary: buildSummary(normalized, roles, skills, benchmarks),
    confidence: roleConfidenceLabel(cappedConfidence),
    roleConfidence: cappedConfidence,
  };
};

// Build limitation strings with functional + tactical consequence context.
const buildDetailedLimitations = (
  player: NormalizedStats,
  benchmarks: LeagueBenchmarks,
  roleNames: RoleKey[],
  skills: SkillScores
) => {
  const limitations: string[] = [];
  const lowAst = player.astPer36 <= getBenchmarkThreshold(benchmarks, player, 'ast_per36', 'P40');
  const low3PA = player.threePAPer36 <= getBenchmarkThreshold(benchmarks, player, 'threePA_per36', 'P40');
  const highUsage = player.usageProxyPer36 >= getBenchmarkThreshold(benchmarks, player, 'usage_proxy', 'P60');
  const outsidePaintShare = player.fga > 0
    ? (player.mid.attempted + player.three.attempted) / player.fga
    : 0;
  const paintHeavy = outsidePaintShare <= 0.35;
  const isGuard = player.position === 'PG' || player.position === 'SG';
  const isFrontcourt = player.position === 'PF' || player.position === 'C';

  if (lowAst && skills.playmaking <= 40) {
    limitations.push('Játéképítés: nem másodlagos szervező, inkább befejező vagy egyszerű továbbjátszó szerepkörben érzi jól magát.');
  }
  if (low3PA && !roleNames.includes('Stretch 5') && !roleNames.includes('Stretch 4')) {
    const spacingLabel = isFrontcourt
      ? 'Térnyitási limit: nem térnyitó magas, a festékben extra védőt vonzhat.'
      : isGuard
        ? 'Periméter térnyitás hiánya: irányítóként/dobóhátvédként kevés triplakísérlet miatt leválhatnak róla.'
        : 'Periméter térnyitás hiánya: wing szerepben kevés külső dobás miatt segíteni tudnak róla.';
    limitations.push(spacingLabel);
  }
  if (highUsage && paintHeavy && low3PA) {
    limitations.push('Festékfókusz: támadásban plusz segítő védekezést hív, emiatt szűkül a tér.');
  }

  if (limitations.length === 0) {
    return buildLimitations(skills).map(item => `${item}: szerepkörben limitált, párosítási kockázatot jelenthet.`);
  }

  return limitations.slice(0, 3);
};

// Build a coach-facing one-line summary from analysis output.
export const buildCoachSummary = (analysis: PlayerAnalysis) => {
  const hasRole = (role: RoleKey) => analysis.roleKeys.includes(role);

  if (hasRole('Rim Protector') || hasRole('Roll Man')) {
    return 'Alacsony labdaigényű, nagy hatású center: védekezésben stabilizálja a festéket, támadásban kettő-kettő rendszerben hatékony befejező.';
  }
  if (hasRole('Scoring Wing') || hasRole('Offensive Hub')) {
    return 'Elsődleges pontszerzőként megbízható, támadásban nagy felelősség adható neki – megfelelő térnyitás mellett.';
  }
  if (hasRole('3&D Wing') || hasRole('Defensive Guard')) {
    return 'Kétoldalú periméter opció, védekezésben stabil párosítás, támadásban megbízható térnyitás.';
  }
  return 'Kiegészítő szerepkörben stabil rotációs érték, párosításalapú optimalizálással.';
};

const TREND_LABELS_HU: Record<PlayerTrend['trendLabel'], string> = {
  Improving: 'javuló',
  Stable: 'stabil',
  Declining: 'romló',
  'Strongly Declining': 'erősen romló',
};

const translateTrendLabel = (label: PlayerTrend['trendLabel']) => TREND_LABELS_HU[label] ?? label;

const buildTrendSummary = (trend: PlayerTrend) => {
  const label = translateTrendLabel(trend.trendLabel);
  const base = `${trend.name} az utolsó 5 mérkőzés alapján ${label} formát mutat.`;
  if (trend.trendLabel !== 'Stable') return `${base} Érezhető eltérés a szezonátlagtól.`;
  return base;
};

const buildStabilityText = (trend: PlayerTrend) => {
  if (trend.consistencyLabel === 'High') return 'Meccsről meccsre stabil teljesítmény.';
  if (trend.consistencyLabel === 'Medium') return 'Mérsékelt ingadozás, párosítás-érzékeny teljesítmény.';
  return 'Volatilis forma, rotációs kockázat.';
};

const buildRoleTrendText = (trend: PlayerTrend) => {
  const translatedRoles = translateTrendRoles(trend.roles);
  const roles = translatedRoles.length > 0 ? translatedRoles.join(', ') : 'szerepkör nélkül';
  if (trend.roleTrendLabel === 'Expanding') {
    return `Növekvő támadó felelősség (${roles}).`;
  }
  if (trend.roleTrendLabel === 'Shrinking') {
    return `Csökkenő labdabirtoklási arány vagy szerep (${roles}).`;
  }
  return `Változatlan szerepkör (${roles}).`;
};

const buildRoleContext = (trend: PlayerTrend) => {
  const roleKeys = normalizeRoleKeys(trend.roles);
  const isAttackRole = roleKeys.some(role => ['Scoring Wing', 'Offensive Hub'].includes(role));
  const isDefenseRole = roleKeys.some(role => ['3&D Wing', 'Defensive Guard', 'Rim Protector'].includes(role));
  const highUsage = trend.usage_avg_5 >= trend.usage_season_avg;

  const parts: string[] = [];
  if (isAttackRole) {
    parts.push('Támadásfókuszú szerepkör mellett a forma alakulása közvetlenül hat a pontszerzés stabilitására.');
  } else if (isDefenseRole) {
    parts.push('Defenzív szerepkörben a stabilitás elsődleges, a trend elsősorban meccsritmusra utal.');
  } else {
    parts.push('A szerepkör inkább kiegészítő jellegű, a trend a rotációs értéket befolyásolja.');
  }

  if (trend.trendLabel === 'Declining' && highUsage) {
    parts.push('Csökkenő forma magas labdabirtoklási arány mellett csapatkockázatot jelent.');
  } else if (trend.trendLabel === 'Strongly Declining' && highUsage) {
    parts.push('Erősen visszaeső forma magas labdabirtoklási arány mellett fokozott kockázat.');
  }

  return parts.slice(0, 2).join(' ');
};

const buildTrendBadge = (trend: PlayerTrend): VisualTrendBadge => {
  if (trend.trendLabel === 'Improving' && trend.consistencyLabel === 'High') {
    return { label: 'Forró forma', icon: 'arrow-up', color: 'green', severity: 'Alacsony' };
  }
  if (trend.trendLabel === 'Improving' && trend.consistencyLabel !== 'High') {
    return { label: 'Pozitív trend', icon: 'trending-up', color: 'light-green', severity: 'Alacsony' };
  }
  if (trend.trendLabel === 'Stable') {
    return { label: 'Stabil', icon: 'minus', color: 'grey', severity: 'Alacsony' };
  }
  if (trend.trendLabel === 'Strongly Declining' || (trend.trendLabel === 'Declining' && trend.consistencyLabel === 'Low')) {
    return { label: 'Figyelmeztetés', icon: 'alert-triangle', color: 'red', severity: 'Magas' };
  }
  if (trend.trendLabel === 'Declining') {
    return { label: 'Visszaesés', icon: 'arrow-down', color: 'orange', severity: 'Közepes' };
  }
  return { label: 'Stabil', icon: 'minus', color: 'grey', severity: 'Alacsony' };
};

const buildCoachTakeaway = (trend: PlayerTrend) => {
  if (trend.trendLabel === 'Improving' && trend.roleTrendLabel === 'Expanding') {
    return 'Szerep növelése kontrollált labdabirtoklási arány mellett.';
  }
  if (trend.trendLabel === 'Improving') {
    return 'Szerep fenntartása, stabil terhelés mellett.';
  }
  if (trend.trendLabel === 'Stable' && trend.consistencyLabel === 'High') {
    return 'Szerep fenntartása, megbízható rotációs opcióként.';
  }
  if (trend.trendLabel === 'Declining' || trend.trendLabel === 'Strongly Declining') {
    return 'Párosítás-alapú használat vagy rotációs óvatosság.';
  }
  return 'Szerep fenntartása, párosítás-kontroll mellett.';
};

export const analyzePlayerSeason = (
  raw: RawPlayerSeasonStat,
  benchmarks: LeagueBenchmarks
): PlayerAnalysis => {
  return buildValidatedAnalysis(raw, benchmarks);
};

// Build a normalized skill vector (0-1 scale) for similarity.
export const buildSkillVector = (analysis: PlayerAnalysis) => {
  const scores = clampSkillScores(analysis.skillScores);
  return [
    scores.scoring / 100,
    scores.shooting / 100,
    scores.playmaking / 100,
    scores.rebounding / 100,
    scores.defense / 100,
    scores.efficiency / 100,
  ];
};

// Compute similarity on normalized vectors with bounded output.
export const computeSimilarity = (a: PlayerAnalysis, b: PlayerAnalysis) => {
  if (a.position !== b.position) return 0;
  const vecA = buildSkillVector(a);
  const vecB = buildSkillVector(b);
  const sumSq = vecA.reduce((sum, value, idx) => sum + Math.pow(value - vecB[idx], 2), 0);
  const distance = Math.sqrt(sumSq);
  const maxDistance = Math.sqrt(vecA.length);
  const similarity = 1 - distance / maxDistance;
  return clamp(round(similarity, 3), 0, 1);
};

export const buildPlayerTrendReport = (trend: PlayerTrend): PlayerTrendReport => {
  const summary = buildTrendSummary(trend);
  const stability = buildStabilityText(trend);
  const roleTrend = buildRoleTrendText(trend);
  const roleContext = buildRoleContext(trend);
  const badge = buildTrendBadge(trend);
  const takeaway = buildCoachTakeaway(trend);

  const section = trend.context === 'pre-game'
    ? 'Mérkőzés előtti riport'
    : trend.context === 'post-game'
      ? 'Mérkőzés utáni riport'
      : 'Játékos profil';

  const sectionTitle = trend.context === 'pre-game'
    ? 'Formamutató (utolsó 5 meccs)'
    : trend.context === 'post-game'
      ? 'Teljesítmény vs aktuális forma'
      : 'Utolsó 5 meccs trendje';

  const focus = trend.context === 'pre-game'
    ? ['forma iránya', 'várható hatás', 'párosítási kockázat vagy előny']
    : trend.context === 'post-game'
      ? ['trend igazolása vagy cáfolata', 'pozitív/negatív megerősítés']
      : ['hosszabb távú forma', 'szerep stabilitása', 'rotációs érték'];

  return {
    section,
    sectionTitle,
    focus,
    summary,
    stability,
    roleTrend,
    roleContext,
    badge,
    takeaway,
  };
};

// Build PlayerAnalysis entries for a list of raw players.
export const buildPlayerAnalyses = (
  players: RawPlayerSeasonStat[],
  benchmarks: LeagueBenchmarks
): PlayerAnalysis[] => {
  return players.map(raw => buildValidatedAnalysis(raw, benchmarks));
};

// Validate trend labels and return a safe PlayerTrend input.
const normalizePlayerTrend = (trend: PlayerTrend): PlayerTrend => {
  const trendLabel = trend.trendLabel;
  const consistencyLabel = trend.consistencyLabel;
  const roleTrendLabel = trend.roleTrendLabel;
  return {
    ...trend,
    trendLabel,
    consistencyLabel,
    roleTrendLabel,
    VAL_avg_5: Number.isFinite(trend.VAL_avg_5) ? trend.VAL_avg_5 : 0,
    VAL_season_avg: Number.isFinite(trend.VAL_season_avg) ? trend.VAL_season_avg : 0,
    VAL_std_5: Number.isFinite(trend.VAL_std_5) ? trend.VAL_std_5 : 0,
    usage_avg_5: Number.isFinite(trend.usage_avg_5) ? trend.usage_avg_5 : 0,
    usage_season_avg: Number.isFinite(trend.usage_season_avg) ? trend.usage_season_avg : 0,
    minutes_avg_5: Number.isFinite(trend.minutes_avg_5) ? trend.minutes_avg_5 : 0,
  };
};

// Build a safe PlayerTrendReport from trend input.
export const buildValidatedPlayerTrendReport = (trend: PlayerTrend): PlayerTrendReport => {
  return buildPlayerTrendReport(normalizePlayerTrend(trend));
};

// ─── Advanced Player Blocks ───────────────────────────────────────────────────

export type ShootingBlock = {
  tsPct: number;
  efg: number;
  rimRate: number;
  midRate: number;
  threeRate: number;
  ftRate: number;
  closeEffPct: number;
  midEffPct: number;
  threePct: number;
  ftPct: number;
  narrative: string;
};

export type PlaymakingBlock = {
  astPer36: number;
  astTo: number;
  usageProxy: number;
  narrative: string;
};

export type DefenseBlock = {
  stlPer36: number;
  blkPer36: number;
  defRebPer36: number;
  foulsPer36: number;
  narrative: string;
};

export type ScoringBlock = {
  ptsPer36: number;
  tsPct: number;
  usageProxy: number;
  narrative: string;
};

export type EfficiencyBlock = {
  valPer36: number;
  tsPct: number;
  efg: number;
  narrative: string;
};

export type AdvancedPlayerBlocks = {
  shooting: ShootingBlock;
  playmaking: PlaymakingBlock;
  defense: DefenseBlock;
  scoring: ScoringBlock;
  efficiency: EfficiencyBlock;
};

const pctLabel = (pct: number) =>
  pct >= 75 ? 'kiemelkedő' : pct >= 55 ? 'átlag feletti' : pct >= 40 ? 'átlagos' : 'átlag alatti';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const buildShootingNarrative = (player: NormalizedStats, benchmarks: LeagueBenchmarks): string => {
  const tsPct = getPercentile(benchmarks, player, 'ts_pct');
  const threePctPct = getPercentile(benchmarks, player, 'threeP_pct');
  const ftPctPct = getPercentile(benchmarks, player, 'ft_pct');

  const rimRate = player.fga > 0 ? player.close.attempted / player.fga : 0;
  const midRate = player.fga > 0 ? player.mid.attempted / player.fga : 0;
  const threeRate = player.fga > 0 ? player.three.attempted / player.fga : 0;

  const parts: string[] = [];

  parts.push(
    `${capitalize(pctLabel(tsPct))} dobáshatékonyság (TS%: ${player.tsPct}%, eFG%: ${player.efg}%).`
  );

  const zoneParts: string[] = [];
  if (rimRate >= 0.3) zoneParts.push(`${Math.round(rimRate * 100)}% gyűrűközelből`);
  if (threeRate >= 0.2) zoneParts.push(`${Math.round(threeRate * 100)}% hárompontosból`);
  if (midRate >= 0.25) zoneParts.push(`${Math.round(midRate * 100)}% középtávról`);
  if (zoneParts.length > 0) parts.push(`Shot mix: ${zoneParts.join(', ')}.`);

  if (midRate >= 0.35 && player.mid.attempted > 0) {
    const midPct = Math.round((player.mid.made / player.mid.attempted) * 100);
    if (midPct < 42) {
      parts.push(
        `Magas középtávú arány (${Math.round(midRate * 100)}%) alacsony hatékonysággal (${midPct}%) — shot selection javítható.`
      );
    }
  }

  if (threeRate >= 0.25) {
    if (threePctPct >= 65) {
      parts.push(`Hárompontos megbízható (${player.threePct}%), a volumen indokolt.`);
    } else if (threePctPct <= 30 && threeRate >= 0.35) {
      parts.push(
        `Magas tripla-volumen (${Math.round(threeRate * 100)}%) alacsony százalékkal (${player.threePct}%) — visszafogottabb hármashasználat javasolt.`
      );
    }
  }

  if (player.ft.attempted >= 2) {
    if (ftPctPct <= 30) {
      parts.push(`Büntető hatékonyság gyenge (${player.ftPct}%) — faultból való pontszerzés korlátozott.`);
    } else if (ftPctPct >= 75) {
      parts.push(`Büntetővonalnál megbízható (${player.ftPct}%).`);
    }
  }

  return parts.join(' ');
};

const buildPlaymakingNarrative = (player: NormalizedStats, benchmarks: LeagueBenchmarks): string => {
  const astPct = getPercentile(benchmarks, player, 'ast_per36');
  const usagePct = getPercentile(benchmarks, player, 'usage_proxy');

  const parts: string[] = [];

  if (astPct >= 70) {
    parts.push(`Aktív játéképítő a posztján belül (AST/36: ${player.astPer36}).`);
  } else if (astPct >= 45) {
    parts.push(`Mérsékelt passzaktivitás (AST/36: ${player.astPer36}).`);
  } else {
    parts.push(`Elsősorban befejező, kevésbé szervező szerepkörben (AST/36: ${player.astPer36}).`);
  }

  if (player.astTo >= 2.5) {
    parts.push(`Labdabiztonság kiváló (AST/TO: ${player.astTo}).`);
  } else if (player.astTo >= 1.5) {
    parts.push(`Labdabiztonság elfogadható (AST/TO: ${player.astTo}).`);
  } else if (player.astPer36 >= 2) {
    parts.push(
      `Labdaeladási arány magas a passzaktivitáshoz képest (AST/TO: ${player.astTo}) — döntéshozatal fejlesztése javasolt.`
    );
  }

  if (usagePct >= 70) {
    parts.push(`Magas labdabirtoklási arány — elsődleges opcióként kezelik (usage proxy/36: ${player.usageProxyPer36}).`);
  } else if (usagePct <= 30) {
    parts.push(`Alacsony labdaigény — kiegészítő szerepben hasznosítható leghatékonyabban.`);
  }

  return parts.join(' ');
};

const buildDefenseNarrative = (player: NormalizedStats, benchmarks: LeagueBenchmarks): string => {
  const stlPct = getPercentile(benchmarks, player, 'stl_per36');
  const blkPct = getPercentile(benchmarks, player, 'blk_per36');
  const defRebPct = getPercentile(benchmarks, player, 'def_reb_per36');
  const foulsPer36 = player.minutes > 0 ? normalizePer36(player.fouls.committed, player.minutes) : 0;

  const isFrontcourt = player.position === 'PF' || player.position === 'C';
  const parts: string[] = [];

  if (isFrontcourt) {
    if (blkPct >= 65 && defRebPct >= 55) {
      parts.push(
        `Erős festékvédő hatás: aktív blokkolással (BLK/36: ${player.blkPer36}) és lepattanódominanciával (DREB/36: ${player.defRebPer36}).`
      );
    } else if (blkPct >= 65) {
      parts.push(
        `Gyűrűvédelem fókusz: kiemelkedő blokkszám (BLK/36: ${player.blkPer36}), védőlepattanóban van tartalék (DREB/36: ${player.defRebPer36}).`
      );
    } else if (defRebPct >= 65) {
      parts.push(
        `Lepattanó-dominancia jellemzi (DREB/36: ${player.defRebPer36}), blokktermelése közepes (BLK/36: ${player.blkPer36}).`
      );
    } else {
      parts.push(
        `Festékhatás korlátozott: blokk (${player.blkPer36}/36) és védőlepattanó (${player.defRebPer36}/36) is az átlag körüli vagy az alatt.`
      );
    }
  } else {
    if (stlPct >= 65) {
      parts.push(`Aktív perimétervédekezés, magas labdaszerzési szint (STL/36: ${player.stlPer36}).`);
    } else if (stlPct >= 40) {
      parts.push(`Mérsékelt periméter védelmi hatás (STL/36: ${player.stlPer36}).`);
    } else {
      parts.push(
        `Perimétervédekezés kevésbé aktív a nyers statisztikákban (STL/36: ${player.stlPer36}) — matchup-függő értékelés szükséges.`
      );
    }
    if (defRebPct >= 65) {
      parts.push(`Posztjához képest erős védőlepattanózás (DREB/36: ${player.defRebPer36}).`);
    }
  }

  if (foulsPer36 >= 4.5) {
    parts.push(
      `Fault-terhelés kritikus (${round(foulsPer36, 1)}/36 perc) — korlátozhatja a pályán töltött perceket.`
    );
  } else if (foulsPer36 >= 3.5) {
    parts.push(`Fault-fegyelem javítható (${round(foulsPer36, 1)}/36).`);
  }

  return parts.join(' ');
};

const buildScoringNarrative = (player: NormalizedStats, benchmarks: LeagueBenchmarks): string => {
  const ptsPct = getPercentile(benchmarks, player, 'pts_per36');
  const usagePct = getPercentile(benchmarks, player, 'usage_proxy');
  const tsPct = getPercentile(benchmarks, player, 'ts_pct');

  const parts: string[] = [];

  if (ptsPct >= 75) {
    parts.push(`Kiemelkedő ponttermelő a posztján (${player.ptsPer36} pont/36).`);
  } else if (ptsPct >= 55) {
    parts.push(`Stabil pontszerzési jelenlét (${player.ptsPer36} pont/36).`);
  } else if (ptsPct >= 35) {
    parts.push(`Mérsékelt ponttermelés (${player.ptsPer36} pont/36).`);
  } else {
    parts.push(`Alacsony ponttermelési szerep (${player.ptsPer36} pont/36).`);
  }

  if (usagePct >= 65 && tsPct >= 60) {
    parts.push(
      `Magas labdabirtoklás mellett jó hatékonysággal (TS%: ${player.tsPct}%) — értékes elsődleges opció.`
    );
  } else if (usagePct >= 65 && tsPct <= 40) {
    parts.push(
      `Magas labdabirtoklás (${player.usageProxyPer36}/36) mellett alacsony hatékonyság (TS%: ${player.tsPct}%) — shot selection finomítása javasolt.`
    );
  } else if (usagePct <= 35 && tsPct >= 65) {
    parts.push(
      `Kevés labdával is hatékony (TS%: ${player.tsPct}%) — spot-up és cut-szerepkörökben kiváló opció.`
    );
  }

  return parts.join(' ');
};

const buildEfficiencyNarrative = (player: NormalizedStats, benchmarks: LeagueBenchmarks): string => {
  const valPct = getPercentile(benchmarks, player, 'val_per36');
  const efgPct = getPercentile(benchmarks, player, 'efg');
  const usagePct = getPercentile(benchmarks, player, 'usage_proxy');

  const parts: string[] = [];

  parts.push(
    `${capitalize(pctLabel(valPct))} összhatékonyság: VAL/36 a ${Math.round(valPct)}. percentilisen (${player.valPer36} VAL/36).`
  );

  if (valPct >= 70 && usagePct >= 60) {
    parts.push(`Magas labdabirtoklás mellett is erős VAL-termelés — csapatban elsőrendű értékmegőrző.`);
  } else if (valPct >= 70 && usagePct < 40) {
    parts.push(`Alacsony labdaigény mellett is hatékony hozzájárulás — kiegészítő szerepben maximálisan hasznosítható.`);
  } else if (valPct < 40 && usagePct >= 60) {
    parts.push(
      `Magas labdabirtoklás ellenére a VAL relatíve alacsony — átfogóbb hatékonyságjavítás szükséges.`
    );
  }

  if (efgPct >= 70) {
    parts.push(`Mezőnydобás-hatékonyság posztján kiemelkedő (eFG%: ${player.efg}%).`);
  } else if (efgPct <= 30 && player.fga > 0) {
    parts.push(`Mezőnydобás-hatékonyság alacsony (eFG%: ${player.efg}%) — javítandó terület.`);
  }

  return parts.join(' ');
};

export const buildAdvancedPlayerBlocks = (
  raw: RawPlayerSeasonStat,
  benchmarks: LeagueBenchmarks
): AdvancedPlayerBlocks => {
  const player = normalizePlayerStats(raw);
  const foulsPer36 = player.minutes > 0 ? round(normalizePer36(raw.fouls.committed, raw.minutes), 1) : 0;

  const rimRate = player.fga > 0 ? round(player.close.attempted / player.fga, 3) : 0;
  const midRate = player.fga > 0 ? round(player.mid.attempted / player.fga, 3) : 0;
  const threeRate = player.fga > 0 ? round(player.three.attempted / player.fga, 3) : 0;
  const ftRate = player.fga > 0 ? round(player.fta / player.fga, 3) : 0;
  const closeEffPct = raw.close.attempted > 0
    ? round((raw.close.made / raw.close.attempted) * 100, 1)
    : 0;
  const midEffPct = raw.mid.attempted > 0
    ? round((raw.mid.made / raw.mid.attempted) * 100, 1)
    : 0;

  return {
    shooting: {
      tsPct: player.tsPct,
      efg: player.efg,
      rimRate,
      midRate,
      threeRate,
      ftRate,
      closeEffPct,
      midEffPct,
      threePct: player.threePct,
      ftPct: player.ftPct,
      narrative: buildShootingNarrative(player, benchmarks),
    },
    playmaking: {
      astPer36: player.astPer36,
      astTo: player.astTo,
      usageProxy: player.usageProxyPer36,
      narrative: buildPlaymakingNarrative(player, benchmarks),
    },
    defense: {
      stlPer36: player.stlPer36,
      blkPer36: player.blkPer36,
      defRebPer36: player.defRebPer36,
      foulsPer36,
      narrative: buildDefenseNarrative(player, benchmarks),
    },
    scoring: {
      ptsPer36: player.ptsPer36,
      tsPct: player.tsPct,
      usageProxy: player.usageProxyPer36,
      narrative: buildScoringNarrative(player, benchmarks),
    },
    efficiency: {
      valPer36: player.valPer36,
      tsPct: player.tsPct,
      efg: player.efg,
      narrative: buildEfficiencyNarrative(player, benchmarks),
    },
  };
};
