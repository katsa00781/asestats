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
  summary: string;
  confidence: 'High' | 'Medium' | 'Low';
  roleConfidence: number;
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

const buildSummary = (
  player: NormalizedStats,
  roles: RoleResult[],
  skills: SkillScores,
  benchmarks: LeagueBenchmarks
) => {
  const intro = roles[0]?.role ? ROLE_INTROS[roles[0].role] : `${player.position} poszton szereplő játékos.`;
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

  return [intro, primaryStrength, secondaryStrength, limitation, valSentence]
    .filter(Boolean)
    .join(' ')
    .trim();
};

const roleConfidenceLabel = (confidence: number): PlayerAnalysis['confidence'] => {
  if (confidence >= 0.75) return 'High';
  if (confidence >= 0.5) return 'Medium';
  return 'Low';
};

export const analyzePlayerSeason = (
  raw: RawPlayerSeasonStat,
  benchmarks: LeagueBenchmarks
): PlayerAnalysis => {
  const normalized = normalizePlayerStats(raw);
  const roles = detectRoles(normalized, benchmarks);
  const roleConfidence = roles.length > 0 ? roles[0].confidence : 0;
  const skills = computeSkillScores(normalized, benchmarks);
  const strengths = buildStrengths(skills);
  const limitations = buildLimitations(skills);

  return {
    position: raw.position,
    roles: roles.map(r => r.role),
    skillScores: skills,
    strengths,
    limitations,
    summary: buildSummary(normalized, roles, skills, benchmarks),
    confidence: roleConfidenceLabel(roleConfidence),
    roleConfidence: round(roleConfidence, 2),
  };
};

export const buildSkillVector = (analysis: PlayerAnalysis) => {
  return [
    analysis.skillScores.scoring,
    analysis.skillScores.shooting,
    analysis.skillScores.playmaking,
    analysis.skillScores.rebounding,
    analysis.skillScores.defense,
    analysis.skillScores.efficiency,
  ];
};

export const computeSimilarity = (a: PlayerAnalysis, b: PlayerAnalysis) => {
  if (a.position !== b.position) return 0;
  const vecA = buildSkillVector(a);
  const vecB = buildSkillVector(b);
  const sumSq = vecA.reduce((sum, value, idx) => sum + Math.pow(value - vecB[idx], 2), 0);
  const distance = Math.sqrt(sumSq);
  const maxDistance = Math.sqrt(vecA.length * Math.pow(100, 2));
  const similarity = 1 - distance / maxDistance;
  return clamp(round(similarity, 3), 0, 1);
};
