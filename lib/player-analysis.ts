export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C';

export type RawPlayerSeasonStat = {
  playerId: string;
  name: string;
  league: string;
  season: string;
  position: Position;
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

export type SkillScores = {
  scoring: number;
  shooting: number;
  playmaking: number;
  rebounding: number;
  defense: number;
  efficiency: number;
};

export type RoleResult = {
  role: string;
  confidence: number;
};

export type PlayerAnalysis = {
  position: Position;
  roles: string[];
  skillScores: SkillScores;
  strengths: string[];
  limitations: string[];
  improvements: string[];
  summary: string;
  confidence: 'High' | 'Medium' | 'Low';
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
  severity: 'Low' | 'Medium' | 'High';
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

const REQUIRED_MIN_GAMES = 10;
const REQUIRED_MIN_MINUTES_PER_GAME = 15;

const SKILL_LABELS: Record<keyof SkillScores, string> = {
  scoring: 'Pontszerzés',
  shooting: 'Dobás',
  playmaking: 'Játéképítés',
  rebounding: 'Lepattanózás',
  defense: 'Védekezés',
  efficiency: 'Hatékonyság',
};

const ROLE_INTROS: Record<string, string> = {
  'Primary Ball Handler': 'Irányító poszton elsődleges labdás játékos.',
  'Secondary Creator': 'Irányító poszton másodlagos támadásépítő.',
  'Defensive Guard': 'Periméteren védekező specialista guard.',
  '3&D Wing': 'Periméter poszton megbízható 3&D játékos, aki dobással spacinget biztosít.',
  'Scoring Wing': 'Periméteren elsődleges pontszerző opció.',
  'Secondary Playmaker': 'Periméteren kiegészítő játéképítő.',
  'Glue Guy': 'Csapatjátékos szerepkörben értékes kiegészítő.',
  'Stretch 4': 'Magas poszton stretch 4 típus, aki kintről is veszélyes.',
  'Physical 4': 'Fizikai 4-es, aki lepattanóban és festékben erős.',
  'Rim Protector': 'Festékben rim protector szerepkör.',
  'Roll Man': 'Pick-and-roll befejező típus a gyűrű közelében.',
  'Stretch 5': 'Stretch 5, aki kintről is elkapja.',
  'Energy Big': 'Energikus magas, aki munkával termel.',
  'Offensive Hub': 'Támadásban központi szerepű, magas usage és ponttermelésű játékos.',
  'Slasher': 'Betörésekből hatékonyan támadó, faultot kiharcoló játékos.',
  'Floor Spacer': 'Külső dobással teret nyitó, alacsonyabb usage-ú játékos.',
};

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

  return {
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
    astTo: round(clamp(astTo, 0, 20), 2),
    valPer36: round(valPer36),
    usageProxyPer36: round(usageProxyPer36),
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
  const playmaking = scoreFromStats([
    getPercentile(benchmarks, player, 'ast_per36') * playmakingWeights[0],
    getPercentile(benchmarks, player, 'ast_to') * playmakingWeights[1],
  ]);

  const defense = player.position === 'PF' || player.position === 'C'
    ? scoreFromStats([
        getPercentile(benchmarks, player, 'blk_per36'),
        getPercentile(benchmarks, player, 'def_reb_per36'),
      ])
    : scoreFromStats([
        getPercentile(benchmarks, player, 'stl_per36') * 0.5,
        getPercentile(benchmarks, player, 'def_reb_per36') * 0.25,
        getPercentile(benchmarks, player, 'blk_per36') * 0.25,
      ]);

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

  const pushRole = (role: string, conditions: boolean[]) => {
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
  roles: string[]
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
    improvements.push(`3P hatékonyság jó (${round(threePct, 1)}%), de alacsony volumen (${round(threePA, 1)} 3PA/36).`);
  }

  if (ftPct >= threshold('ft_pct', 'P75') && fta <= threshold('fta_per36', 'P40')) {
    improvements.push(`Büntető hatékonyság jó (${round(ftPct, 1)}%), de kevés kiharcolt büntető (${round(fta, 1)} FTA/36).`);
  }

  if (efg <= threshold('efg', 'P40') && usage >= threshold('usage_proxy', 'P60')) {
    improvements.push(`Magas usage (${round(usage, 1)}/36) mellett alacsony eFG (${round(efg, 1)}%) → dobásminőség javítása.`);
  }

  if (usage <= threshold('usage_proxy', 'P40') && efg >= threshold('efg', 'P60')) {
    improvements.push(`Alacsony usage (${round(usage, 1)}/36) mellett jó eFG (${round(efg, 1)}%) → több támadó szerep vállalható.`);
  }

  if (tov >= threshold('tov_per36', 'P60') && astTo <= threshold('ast_to', 'P40')) {
    improvements.push(`Labdaeladás csökkentése (TO/36: ${round(tov, 1)}, AST/TO: ${round(astTo, 2)}).`);
  }

  if ((player.position === 'PG' || player.position === 'SG') && ast <= threshold('ast_per36', 'P40') && usage >= threshold('usage_proxy', 'P50')) {
    improvements.push(`Játéképítés fejlesztése (AST/36: ${round(ast, 1)}) a labdával töltött időhöz képest.`);
  }

  if ((player.position === 'PF' || player.position === 'C') && reb <= threshold('reb_per36', 'P40')) {
    improvements.push(`Lepattanózás erősítése (REB/36: ${round(reb, 1)}).`);
  }

  if ((player.position === 'SG' || player.position === 'SF') && stl <= threshold('stl_per36', 'P40') && defReb <= threshold('def_reb_per36', 'P40')) {
    improvements.push(`Periméter védekezés/possession-érték növelése (STL/36: ${round(stl, 1)}, DREB/36: ${round(defReb, 1)}).`);
  }

  if ((player.position === 'PF' || player.position === 'C') && blk <= threshold('blk_per36', 'P40')) {
    improvements.push(`Rim protection javítása (BLK/36: ${round(blk, 1)}).`);
  }

  const lowAst = ast <= threshold('ast_per36', 'P40');
  const low3PA = threePA <= threshold('threePA_per36', 'P40');
  const ftBelowAvg = ftPct <= threshold('ft_pct', 'P50');
  const foulsPer36 = normalizePer36(player.fouls.committed, player.minutes);
  const highFouls = foulsPer36 >= 4;

  if (roles.includes('Roll Man') && lowAst) {
    improvements.push('Short roll döntéshozatal és passzopciók fejlesztése.');
  }
  if (ftBelowAvg) {
    improvements.push('Büntetődobás stabilitás javítása.');
  }
  if (highFouls) {
    improvements.push('Defensive foul control javítása, felesleges faultok csökkentése.');
  }
  if (low3PA && roles.includes('Stretch 5') === false && roles.includes('Stretch 4') === false) {
    improvements.push('Spacing-érték növelése (minimum corner/short corner fenyegetés).');
  }

  if (improvements.length === 0) {
    improvements.push('Low priority development: szerep-optimalizálás és matchup-fókusz.');
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
  const roleNames = roles.map(role => role.role);
  const strengths = buildStrengths(skills);
  const limitations = buildLimitations(skills);

  const primaryStrength = strengths[0] ? `${strengths[0]} terén kiemelkedő.` : '';
  const secondaryStrength = strengths[1] ? `${strengths[1]} terén pozitív.` : '';
  const limitation = limitations[0] ? `${limitations[0]} terén visszafogott.` : '';

  const valPct = getPercentile(benchmarks, player, 'val_per36');
  const usagePct = getPercentile(benchmarks, player, 'usage_proxy');

  let valSentence = '';
  if (skills.scoring >= 70 && valPct < 40) {
    valSentence = 'Magas ponttermelés mellett a VAL hatékonysági mutató visszafogott.';
  } else if (usagePct < 40 && valPct >= 70) {
    valSentence = 'Alacsony usage mellett is magas VAL értékek, ami glue guy profilt jelez.';
  } else if (valPct >= 75) {
    valSentence = 'Kiemelkedő VAL mutatók, hatékony hozzájárulás.';
  } else {
    valSentence = 'VAL mutatói a ligaátlag körül mozognak.';
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
  const hasInteriorRole = roleNames.includes('Rim Protector') || roleNames.includes('Roll Man');
  const hasRollMan = roleNames.includes('Roll Man');

  const interiorContext = hasInteriorRole && highTwoPct && lowAst && lowOutsidePaint && highValPer36
    ? [
        `Pontszerzése elsősorban ${hasRollMan ? 'pick&roll befejezésekből, ' : ''}támadólepattanókból és közeli helyzetekből érkezik.`,
        lowUsage ? 'Nem igényel labdát, alacsony usage mellett is magas hatékonyságot biztosít.' : '',
      ].filter(Boolean).join(' ')
    : '';

  return [intro, interiorContext, primaryStrength, secondaryStrength, limitation, valSentence]
    .filter(Boolean)
    .join(' ')
    .trim();
};

const roleConfidenceLabel = (confidence: number): PlayerAnalysis['confidence'] => {
  if (confidence >= 0.75) return 'High';
  if (confidence >= 0.5) return 'Medium';
  return 'Low';
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
  const playmaking = scoreFromStats([
    getPercentile(benchmarks, player, 'ast_per36') * playmakingWeights[0],
    getPercentile(benchmarks, player, 'ast_to') * playmakingWeights[1],
  ]);
  const rebounding = getPercentile(benchmarks, player, 'reb_per36');
  const defense = player.position === 'PF' || player.position === 'C'
    ? scoreFromStats([
        getPercentile(benchmarks, player, 'blk_per36'),
        getPercentile(benchmarks, player, 'def_reb_per36'),
      ])
    : scoreFromStats([
        getPercentile(benchmarks, player, 'stl_per36') * 0.5,
        getPercentile(benchmarks, player, 'def_reb_per36') * 0.25,
        getPercentile(benchmarks, player, 'blk_per36') * 0.25,
      ]);
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
  const rawSkills = clampSkillScores(computeSkillScores(normalized, benchmarks));
  const skillPercentiles = computeSkillPercentiles(normalized, benchmarks);
  const skills = applySkillCaps(rawSkills, skillPercentiles);
  const strengths = buildStrengths(skills);
  const limitations = buildDetailedLimitations(normalized, benchmarks, roles.map(role => role.role), skills);
  const improvements = buildImprovementPoints(normalized, benchmarks, roles.map(role => role.role));
  const cappedConfidence = clampRoleConfidence(roleConfidence, raw.games);

  return {
    position: raw.position,
    roles: roles.map(r => r.role),
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
  roleNames: string[],
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

  if (lowAst && skills.playmaking <= 40) {
    limitations.push('Játéképítés: nem secondary creator, short roll playmaking limitált.');
  }
  if (low3PA && (roleNames.includes('Stretch 5') === false && roleNames.includes('Stretch 4') === false)) {
    limitations.push('Spacing-limit: nem stretch center, festékben extra védőt vonzhat.');
  }
  if (highUsage && paintHeavy && low3PA) {
    limitations.push('Festékfókusz: támadásban extra help védekezést hívhat, spacing sérülhet.');
  }

  if (limitations.length === 0) {
    return buildLimitations(skills).map(item => `${item}: szerepkörben limitált, matchup-kockázatot jelenthet.`);
  }

  return limitations.slice(0, 3);
};

// Build a coach-facing one-line summary from analysis output.
export const buildCoachSummary = (analysis: PlayerAnalysis) => {
  if (analysis.roles.includes('Rim Protector') || analysis.roles.includes('Roll Man')) {
    return 'Low-usage, high-impact center, aki védekezésben stabilizálja a festéket, támadásban pedig pick&roll rendszerben maximális hatékonyságot hoz – labda nélkül.';
  }
  if (analysis.roles.includes('Scoring Wing') || analysis.roles.includes('Offensive Hub')) {
    return 'Elsődleges pontszerző szerepben hatékony, támadásban magas felelősséggel használható – stabil spacing mellett.';
  }
  if (analysis.roles.includes('3&D Wing') || analysis.roles.includes('Defensive Guard')) {
    return 'Kétoldalú periméter szerepben értékes, védekezésben matchup-stabil, támadásban kiegészítő spacing-opció.';
  }
  return 'Kiegészítő szerepkörben stabil rotációs érték, matchup-alapú optimalizálással.';
};

const buildTrendSummary = (trend: PlayerTrend) => {
  const base = `${trend.name} az utolsó 5 mérkőzés alapján ${trend.trendLabel} formát mutat.`;
  if (trend.trendLabel !== 'Stable') return `${base} Eltérés a szezonátlagtól érzékelhető.`;
  return base;
};

const buildStabilityText = (trend: PlayerTrend) => {
  if (trend.consistencyLabel === 'High') return 'Meccsről meccsre stabil teljesítmény.';
  if (trend.consistencyLabel === 'Medium') return 'Mérsékelt ingadozás, matchup-érzékeny teljesítmény.';
  return 'Volatilis forma, rotációs kockázat.';
};

const buildRoleTrendText = (trend: PlayerTrend) => {
  const roles = trend.roles.length > 0 ? trend.roles.join(', ') : 'szerepkör nélkül';
  if (trend.roleTrendLabel === 'Expanding') {
    return `Növekvő támadó felelősség (${roles}).`;
  }
  if (trend.roleTrendLabel === 'Shrinking') {
    return `Csökkenő usage vagy szerep (${roles}).`;
  }
  return `Változatlan szerepkör (${roles}).`;
};

const buildRoleContext = (trend: PlayerTrend) => {
  const roles = trend.roles.join(', ');
  const isAttackRole = trend.roles.some(role => ['Scoring Wing', 'Offensive Hub'].includes(role));
  const isDefenseRole = trend.roles.some(role => ['3&D Wing', 'Defensive Guard', 'Rim Protector'].includes(role));
  const highUsage = trend.usage_avg_5 >= trend.usage_season_avg;

  const parts: string[] = [];
  if (isAttackRole) {
    parts.push('Támadásfókuszú szerepkör mellett a forma alakulása közvetlenül hat a scoring stabilitására.');
  } else if (isDefenseRole) {
    parts.push('Defenzív szerepkörben a stabilitás elsődleges, a trend elsősorban meccsritmusra utal.');
  } else {
    parts.push('A szerepkör inkább kiegészítő jellegű, a trend a rotációs értéket befolyásolja.');
  }

  if (trend.trendLabel === 'Declining' && highUsage) {
    parts.push('Csökkenő forma magas usage mellett csapatkockázatot jelent.');
  } else if (trend.trendLabel === 'Strongly Declining' && highUsage) {
    parts.push('Erősen visszaeső forma magas usage mellett fokozott kockázat.');
  }

  if (!roles) return parts.slice(0, 2).join(' ');
  return parts.slice(0, 2).join(' ');
};

const buildTrendBadge = (trend: PlayerTrend): VisualTrendBadge => {
  if (trend.trendLabel === 'Improving' && trend.consistencyLabel === 'High') {
    return { label: 'Hot', icon: 'arrow-up', color: 'green', severity: 'Low' };
  }
  if (trend.trendLabel === 'Improving' && trend.consistencyLabel !== 'High') {
    return { label: 'Positive Trend', icon: 'trending-up', color: 'light-green', severity: 'Low' };
  }
  if (trend.trendLabel === 'Stable') {
    return { label: 'Stable', icon: 'minus', color: 'grey', severity: 'Low' };
  }
  if (trend.trendLabel === 'Strongly Declining' || (trend.trendLabel === 'Declining' && trend.consistencyLabel === 'Low')) {
    return { label: 'Warning', icon: 'alert-triangle', color: 'red', severity: 'High' };
  }
  if (trend.trendLabel === 'Declining') {
    return { label: 'Cold', icon: 'arrow-down', color: 'orange', severity: 'Medium' };
  }
  return { label: 'Stable', icon: 'minus', color: 'grey', severity: 'Low' };
};

const buildCoachTakeaway = (trend: PlayerTrend) => {
  if (trend.trendLabel === 'Improving' && trend.roleTrendLabel === 'Expanding') {
    return 'Szerep növelése kontrollált usage mellett.';
  }
  if (trend.trendLabel === 'Improving') {
    return 'Szerep fenntartása, stabil terhelés mellett.';
  }
  if (trend.trendLabel === 'Stable' && trend.consistencyLabel === 'High') {
    return 'Szerep fenntartása, megbízható rotációs opcióként.';
  }
  if (trend.trendLabel === 'Declining' || trend.trendLabel === 'Strongly Declining') {
    return 'Matchup-alapú használat vagy rotációs óvatosság.';
  }
  return 'Szerep fenntartása, matchup-kontroll mellett.';
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
    ? 'Pre-Game Report'
    : trend.context === 'post-game'
      ? 'Post-Game Report'
      : 'Player Profile';

  const sectionTitle = trend.context === 'pre-game'
    ? 'Hot / Cold Players (Last 5 Games)'
    : trend.context === 'post-game'
      ? 'Performance vs Recent Form'
      : 'Last 5 Games Trend';

  const focus = trend.context === 'pre-game'
    ? ['forma iránya', 'várható impact', 'matchup-kockázat vagy előny']
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
