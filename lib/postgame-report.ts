import type { PreGameXFactorContext } from './pregame-scouting';

export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C';

export type TeamGameStat = {
  teamId: string;
  teamName: string;
  league: string;
  season: string;
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
  actualPointsFor?: number;
  actualPointsAgainst?: number;
  result?: 'win' | 'loss';
};

export type PlayerGameStat = {
  playerId: string;
  name: string;
  position: Position;
  minutes: number;
  points: number;
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
  val: number;
  roles: string[];
};

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

export type TeamBenchmarks = Record<string, BenchmarkPercentiles>;

export type LeagueTeamBenchmarks = Record<
  string,
  Record<string, TeamBenchmarks>
>;

export type PostGameReport = {
  teamId: string;
  teamName: string;
  opponentName: string;
  league: string;
  season: string;
  result: 'win' | 'loss';
  metrics: {
    pointsFor: number;
    pointsAgainst: number;
    margin: number;
    pace: number;
    efg: number;
    keyStats: PostGameMetric[];
  };
  charts: {
    efficiency: PostGameChartDatum[];
    shotProfile: PostGameShotProfileDatum[];
  };
  context: {
    paceDelta: 'Higher' | 'Lower' | 'Similar';
    offenseEfficiencyDelta: 'Higher' | 'Lower' | 'Similar';
    defenseEfficiencyDelta: 'Higher' | 'Lower' | 'Similar';
  };
  dataNotes: string[];
  decisiveFactors: {
    offense: string[];
    defense: string[];
  };
  decisiveFactorAnnotations: {
    offense: string[];
    defense: string[];
  };
  decisiveFactorMeta: FactorMeta[];
  playerImpact: {
    positive: string[];
    negative: string[];
    overperformers: string[];
    underperformers: string[];
  };
  strengths: string[];
  problems: string[];
  nextFocus: string[];
  reflection: {
    xFactor: string;
    risk: string;
  };
  summary: string;
};

export type PostGameInterpretation = {
  gameContext: string;
  decisiveFactors: string;
  playerImpact: string;
  strengths: string;
  problems: string;
  nextFocus: string;
  summary: string;
};

export type PostGameMetric = {
  key: string;
  label: string;
  game: number;
  season: number;
  delta: number;
  unit: 'pct' | 'count';
  leagueMedian?: number;
};

export type PostGameChartDatum = {
  label: string;
  game: number;
  season: number;
  league?: number;
};

export type PostGameShotProfileDatum = {
  label: string;
  game: number;
  season: number;
};

type FactorType = 'Hatékonyság' | 'Volumen' | 'Kontroll';

type FactorMeta = {
  label: string;
  annotated: string;
  type: FactorType;
  axis: 'offense' | 'defense';
};

type MechanismStatus = {
  icon: '✓' | '↺' | '✗';
  text: string;
};

const round = (value: number, digits = 2) => {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
};

const toPct = (value: number, digits = 1) => round(value * 100, digits);

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);


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

export type NormalizedTeamStats = TeamSeasonStat & {
  fga: number;
  fgm: number;
  pace: number;
  assistRate: number;
  turnoverRate: number;
  orebRate: number;
  twoRate: number;
  threeRate: number;
  threePct: number;
  ftRate: number;
  efg: number;
  valPerGame: number;
};

export type NormalizedGameStats = TeamGameStat & {
  fga: number;
  fgm: number;
  pace: number;
  assistRate: number;
  turnoverRate: number;
  orebRate: number;
  twoRate: number;
  threeRate: number;
  threePct: number;
  ftRate: number;
  efg: number;
};

const normalizeTeamSeason = (raw: TeamSeasonStat): NormalizedTeamStats => {
  const games = raw.games || 1;
  const fga = raw.fga2 + raw.fga3;
  const fgm = raw.fgm2 + raw.fgm3;
  const pace = (fga + 0.44 * raw.fta + raw.tov) / games;
  const assistRate = fga > 0 ? raw.ast / fga : 0;
  const turnoverRate = pace > 0 ? (raw.tov / games) / pace : 0;
  const orebRate = (raw.oreb + raw.dreb) > 0 ? raw.oreb / (raw.oreb + raw.dreb) : 0;
  const twoRate = fga > 0 ? raw.fga2 / fga : 0;
  const threeRate = fga > 0 ? raw.fga3 / fga : 0;
  const threePct = raw.fga3 > 0 ? (raw.fgm3 / raw.fga3) * 100 : 0;
  const ftRate = fga > 0 ? raw.fta / fga : 0;
  const efg = fga > 0 ? ((fgm + 0.5 * raw.fgm3) / fga) * 100 : 0;
  const valPerGame = raw.val / games;

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
  };
};

const normalizeTeamGame = (raw: TeamGameStat, opponent: TeamGameStat): NormalizedGameStats => {
  const fga = raw.fga2 + raw.fga3;
  const fgm = raw.fgm2 + raw.fgm3;
  const pace = fga + 0.44 * raw.fta + raw.tov;
  const assistRate = fga > 0 ? raw.ast / fga : 0;
  const turnoverRate = pace > 0 ? raw.tov / pace : 0;
  const orebRate = (raw.oreb + opponent.dreb) > 0 ? raw.oreb / (raw.oreb + opponent.dreb) : 0;
  const twoRate = fga > 0 ? raw.fga2 / fga : 0;
  const threeRate = fga > 0 ? raw.fga3 / fga : 0;
  const threePct = raw.fga3 > 0 ? (raw.fgm3 / raw.fga3) * 100 : 0;
  const ftRate = fga > 0 ? raw.fta / fga : 0;
  const efg = fga > 0 ? ((fgm + 0.5 * raw.fgm3) / fga) * 100 : 0;

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
  };
};

const TEAM_STAT_KEYS = [
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
];

export const buildTeamBenchmarks = (teams: TeamSeasonStat[]): LeagueTeamBenchmarks => {
  const normalized = teams.map(normalizeTeamSeason);
  const result: LeagueTeamBenchmarks = {};

  normalized.forEach(team => {
    if (!result[team.league]) result[team.league] = {};
    if (!result[team.league][team.season]) result[team.league][team.season] = {};
  });

  Object.keys(result).forEach(league => {
    Object.keys(result[league]).forEach(season => {
      const pool = normalized.filter(t => t.league === league && t.season === season);
      const statBenchmarks: TeamBenchmarks = {};
      TEAM_STAT_KEYS.forEach(stat => {
        const values = pool
          .map(team => getTeamStatValue(team, stat))
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
    });
  });

  return result;
};

const getTeamStatValue = (team: NormalizedTeamStats, stat: string) => {
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
    default:
      return 0;
  }
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
  stat: string,
  value: number
) => {
  const p10 = getBenchmarkThreshold(benchmarks, team, stat, 'P10');
  const p90 = getBenchmarkThreshold(benchmarks, team, stat, 'P90');
  if (!Number.isFinite(value) || !Number.isFinite(p10) || !Number.isFinite(p90) || p90 === p10) {
    return 50;
  }
  const score = ((value - p10) / (p90 - p10)) * 100;
  return clamp(score, 0, 100);
};

const scoreAbove = (
  benchmarks: LeagueTeamBenchmarks,
  team: NormalizedTeamStats,
  stat: string,
  value: number,
  score: number
) => getPercentileScore(benchmarks, team, stat, value) >= score;

const scoreBelow = (
  benchmarks: LeagueTeamBenchmarks,
  team: NormalizedTeamStats,
  stat: string,
  value: number,
  score: number
) => getPercentileScore(benchmarks, team, stat, value) <= score;

const classifyDelta = (delta: number, threshold: number) => {
  if (delta >= threshold) return 'Higher';
  if (delta <= -threshold) return 'Lower';
  return 'Similar';
};

const buildDecisiveFactors = (
  game: NormalizedGameStats,
  opponent: NormalizedGameStats | null,
  season: NormalizedTeamStats
) => {
  const offense: string[] = [];
  const defense: string[] = [];

  const threePctDelta = round(game.threePct - season.threePct, 1);
  const twoRateDelta = toPct(game.twoRate - season.twoRate, 1);
  const ftRateDelta = toPct(game.ftRate - season.ftRate, 1);
  const assistRateDelta = toPct(game.assistRate - season.assistRate, 1);
  const turnoverRateDelta = toPct(game.turnoverRate - season.turnoverRate, 1);
  const orebRateDelta = toPct(game.orebRate - season.orebRate, 1);

  if (threePctDelta >= 4) offense.push(`Periméterdobás hatékonyabb (+${threePctDelta} pp)`);
  if (twoRateDelta >= 6) offense.push(`Festékfókusz erősebb (+${twoRateDelta} pp)`);

  if (ftRateDelta >= 8) {
    offense.unshift(`FT rate dominancia (+${ftRateDelta} pp)`);
  } else if (ftRateDelta >= 5) {
    offense.push(`Aggresszív támadás (FT rate +${ftRateDelta} pp)`);
  }
  if (assistRateDelta >= 5) offense.push(`Jobb labdajáratás (+${assistRateDelta} pp)`);
  if (turnoverRateDelta >= 5) offense.push(`Támadás szétesett (TO rate +${turnoverRateDelta} pp)`);
  if (orebRateDelta >= 6) offense.push(`Második esély dominancia (OREB +${orebRateDelta} pp)`);

  if (opponent) {
    const oppEfg = opponent.efg;
    if (oppEfg <= season.efg - 3) defense.push(`Ellenfél dobáshatékonyság limitált (${round(oppEfg, 1)}% eFG)`);
    if (opponent.fga3 > 0 && (opponent.fgm3 / opponent.fga3) * 100 >= 38) {
      defense.push('Perimétervédekezési probléma');
    }
    if (opponent.orebRate - season.orebRate >= 0.08) defense.push('Lepattanózás gyenge');
  }

  return { offense, defense };
};

const classifyFactorType = (label: string): FactorType => {
  const lower = label.toLowerCase();
  if (lower.includes('hatékony') || lower.includes('efg') || lower.includes('3p') || lower.includes('dobás')) {
    return 'Hatékonyság';
  }
  if (lower.includes('ft rate') || lower.includes('oreb') || lower.includes('második') || lower.includes('volumen') || lower.includes('possession')) {
    return 'Volumen';
  }
  if (lower.includes('tempó') || lower.includes('tempo') || lower.includes('labdabiztonság') || lower.includes('turnover') || lower.includes('nyomás') || lower.includes('kontroll')) {
    return 'Kontroll';
  }
  return 'Hatékonyság';
};

const annotateFactorList = (list: string[], axis: 'offense' | 'defense') => {
  return list.map<FactorMeta>(label => {
    const type = classifyFactorType(label);
    const annotated = `${label} • ${type}-alapú`;
    return { label, annotated, type, axis };
  });
};

const annotateDecisiveFactors = (decisive: { offense: string[]; defense: string[] }) => {
  const offenseMeta = annotateFactorList(decisive.offense, 'offense');
  const defenseMeta = annotateFactorList(decisive.defense, 'defense');
  return {
    annotated: {
      offense: offenseMeta.map(item => item.annotated),
      defense: defenseMeta.map(item => item.annotated),
    },
    meta: [...offenseMeta, ...defenseMeta],
  };
};

const X_FACTOR_LABELS: Record<string, string> = {
  perimeter: 'Periméter kontroll',
  turnover: 'Labdaszerzés / extra támadások',
  rebound: 'Lepattanó kontroll',
  tempo: 'Tempó kontroll',
  paint: 'Festék kontroll',
};

const getMechanismSignal = (
  key: string,
  game: NormalizedGameStats,
  season: NormalizedTeamStats,
  opponent: NormalizedGameStats | null
) => {
  switch (key) {
    case 'perimeter': {
      const delta = round(game.threePct - season.threePct, 1);
      if (delta >= 4) return { realized: true, reason: `3P% +${delta} pp` };
      if (opponent && opponent.fga3 > 0) {
        const oppThree = round((opponent.fgm3 / opponent.fga3) * 100, 1);
        if (oppThree <= 32) return { realized: true, reason: `ellenfél 3P ${oppThree}%` };
      }
      break;
    }
    case 'turnover': {
      const delta = toPct(season.turnoverRate - game.turnoverRate, 1);
      if (delta >= 3) return { realized: true, reason: `TO rate -${delta} pp` };
      break;
    }
    case 'rebound': {
      const delta = toPct(game.orebRate - season.orebRate, 1);
      if (delta >= 5) return { realized: true, reason: `OREB +${delta} pp` };
      break;
    }
    case 'tempo': {
      const delta = round(game.pace - season.pace, 1);
      if (Math.abs(delta) >= 4) {
        const direction = delta > 0 ? '+' : '';
        return { realized: true, reason: `tempó ${direction}${delta}` };
      }
      break;
    }
    case 'paint': {
      const twoDelta = toPct(game.twoRate - season.twoRate, 1);
      const ftDelta = toPct(game.ftRate - season.ftRate, 1);
      if (twoDelta >= 5) return { realized: true, reason: `2P fókusz +${twoDelta} pp` };
      if (ftDelta >= 8) return { realized: true, reason: `FT rate +${ftDelta} pp` };
      break;
    }
    default: {
      const valDelta = round(game.pointsFor - season.pointsFor, 1);
      if (valDelta >= 5) return { realized: true, reason: `Ponttermelés +${valDelta}` };
    }
  }
  return { realized: false };
};

const formatMechanismStatus = (
  key: string,
  label: string,
  game: NormalizedGameStats,
  season: NormalizedTeamStats,
  opponent: NormalizedGameStats | null,
  fallback: FactorMeta | undefined
): MechanismStatus => {
  const signal = getMechanismSignal(key, game, season, opponent);
  if (signal.realized) {
    return { icon: '✓', text: `${label} (${signal.reason})` };
  }
  if (fallback) {
    return {
      icon: '↺',
      text: `${label} → ${fallback.type.toLowerCase()} (${fallback.label})`,
    };
  }
  return { icon: '✗', text: `${label} nem volt meghatározó` };
};

const evaluateRiskFlag = (
  flag: string,
  game: NormalizedGameStats,
  season: NormalizedTeamStats
) => {
  const lower = flag.toLowerCase();
  if (lower.includes('ft')) {
    const delta = toPct(game.ftRate - season.ftRate, 1);
    return delta >= 5
      ? `✓ ${flag} (+${delta} pp)`
      : `✗ ${flag}`;
  }
  if (lower.includes('oreb')) {
    const delta = toPct(game.orebRate - season.orebRate, 1);
    return delta >= 5 ? `✓ ${flag} (+${delta} pp)` : `✗ ${flag}`;
  }
  if (lower.includes('labda') || lower.includes('to') || lower.includes('turnover')) {
    const delta = toPct(game.turnoverRate - season.turnoverRate, 1);
    return delta >= 3 ? `✓ ${flag} (+${delta} pp)` : `✗ ${flag}`;
  }
  return `${flag}`;
};

const buildXFactorReflection = (
  preGame: PreGameXFactorContext | undefined,
  game: NormalizedGameStats,
  season: NormalizedTeamStats,
  opponent: NormalizedGameStats | null,
  decisiveMeta: FactorMeta[]
) => {
  if (!preGame) return { line: '', riskLine: '' };
  const fallback = decisiveMeta[0];
  const secondaryFallback = decisiveMeta[1] || fallback;

  const lines: string[] = [];
  const riskLines: string[] = [];

  const primaryLabel = preGame.primaryLabel || X_FACTOR_LABELS[preGame.primaryKey] || preGame.primaryKey;
  const primaryStatus = formatMechanismStatus(
    preGame.primaryKey,
    primaryLabel,
    game,
    season,
    opponent,
    fallback
  );
  lines.push(`${primaryStatus.icon} ${primaryStatus.text}`);

  if (preGame.secondaryKey) {
    const secondaryLabel = preGame.secondaryLabel || X_FACTOR_LABELS[preGame.secondaryKey] || preGame.secondaryKey;
    const secondaryStatus = formatMechanismStatus(
      preGame.secondaryKey,
      secondaryLabel,
      game,
      season,
      opponent,
      secondaryFallback
    );
    lines.push(`${secondaryStatus.icon} ${secondaryStatus.text}`);
  }

  if (preGame.riskFlags && preGame.riskFlags.length > 0) {
    preGame.riskFlags.forEach(flag => {
      riskLines.push(evaluateRiskFlag(flag, game, season));
    });
  }

  return {
    line: lines.length ? `X-faktor visszacsatolás: ${lines.join(' • ')}` : '',
    riskLine: riskLines.length ? `Kockázati helyzet: ${riskLines.join(' • ')}` : '',
  };
};

const computePlayerUsage = (player: PlayerGameStat) => {
  const fga = player.fga2 + player.fga3;
  return fga + 0.44 * player.fta + player.tov;
};

const analyzePlayerImpact = (players: PlayerGameStat[]) => {
  const positive: string[] = [];
  const negative: string[] = [];
  const overperformers: string[] = [];
  const underperformers: string[] = [];

  players.forEach(player => {
    const usage = computePlayerUsage(player);
    if (usage >= 10 && player.val <= 5) negative.push(player.name);
    if (usage <= 6 && player.val >= 10) positive.push(player.name);

    if (player.val >= 15) overperformers.push(player.name);
    if (player.val <= 4) underperformers.push(player.name);
  });

  return {
    positive: positive.slice(0, 3),
    negative: negative.slice(0, 3),
    overperformers: overperformers.slice(0, 3),
    underperformers: underperformers.slice(0, 3),
  };
};

const buildStrengths = (
  game: NormalizedGameStats,
  season: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks
) => {
  const strengths: string[] = [];
  const efgDelta = round(game.efg - season.efg, 1);
  const assistRateDelta = toPct(game.assistRate - season.assistRate, 1);
  const orebRateDelta = toPct(game.orebRate - season.orebRate, 1);
  const threePctDelta = round(game.threePct - season.threePct, 1);
  const twoRateDelta = toPct(game.twoRate - season.twoRate, 1);

  if (efgDelta >= 3) strengths.push(`Dobáshatékonyság a szezonátlag felett (+${efgDelta} pp)`);
  if (assistRateDelta >= 5) strengths.push(`Labdajáratás javult (+${assistRateDelta} pp)`);
  if (orebRateDelta >= 5) strengths.push(`Támadólepattanózás erős (+${orebRateDelta} pp)`);
  if (threePctDelta >= 4) strengths.push(`Erős 3P-hatékonyság (+${threePctDelta} pp)`);
  if (twoRateDelta >= 6) strengths.push(`Festékből több befejezés (+${twoRateDelta} pp)`);

  if (scoreAbove(benchmarks, season, 'efg', game.efg, 60)
    && !strengths.includes('Dobáshatékonyság a szezonátlag felett')) {
    strengths.push('Dobáshatékonyság a liga felett');
  }
  if (scoreAbove(benchmarks, season, 'assist_rate', game.assistRate, 60)) {
    strengths.push('Labdajáratás a liga felett');
  }
  if (scoreAbove(benchmarks, season, 'three_pct', game.threePct, 60)) {
    strengths.push('Periméter-hatékonyság a liga felett');
  }

  return strengths.slice(0, 3);
};

const buildProblems = (
  game: NormalizedGameStats,
  season: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks
) => {
  const problems: string[] = [];
  const turnoverRateDelta = toPct(game.turnoverRate - season.turnoverRate, 1);
  const efgDelta = round(game.efg - season.efg, 1);
  const assistRateDelta = toPct(game.assistRate - season.assistRate, 1);
  const threePctDelta = round(game.threePct - season.threePct, 1);
  const twoRateDelta = toPct(game.twoRate - season.twoRate, 1);

  if (turnoverRateDelta >= 5) problems.push(`Sok labdaeladás (+${turnoverRateDelta} pp TO rate)`);
  if (efgDelta <= -3) problems.push(`Dobáshatékonyság visszaesett (${efgDelta} pp)`);
  if (assistRateDelta <= -5) problems.push(`Labdajáratás akadozott (${assistRateDelta} pp)`);
  if (threePctDelta <= -4) problems.push(`Gyenge 3P-hatékonyság (${threePctDelta} pp)`);
  if (twoRateDelta <= -6) problems.push(`Festékbefejezések visszaestek (${twoRateDelta} pp)`);

  if (scoreAbove(benchmarks, season, 'turnover_rate', game.turnoverRate, 60)) {
    problems.push('TO arány a liga felett');
  }
  if (scoreBelow(benchmarks, season, 'efg', game.efg, 40)) {
    problems.push('Dobáshatékonyság a liga alatt');
  }
  if (scoreBelow(benchmarks, season, 'three_pct', game.threePct, 40)) {
    problems.push('Periméter-hatékonyság a liga alatt');
  }

  return problems.slice(0, 3);
};

const buildNextFocus = (problems: string[], strengths: string[]) => {
  const focus: string[] = [];
  const hasTurnoverProblem = problems.some(item =>
    item.includes('Sok labdaeladás') || item.includes('TO arány a liga felett')
  );
  if (hasTurnoverProblem) focus.push('TO-k csökkentése, egyszerűsített döntések');
  if (problems.includes('Dobáshatékonyság visszaesett')) focus.push('Dobásminőség javítása, festékből érkező pontok');
  if (problems.includes('Labdajáratás akadozott')) focus.push('Spacing és passzsávok javítása');
  if (problems.includes('Gyenge 3P-hatékonyság')) focus.push('3P dobásminőség, extra pass');
  if (problems.includes('Festékbefejezések visszaestek')) focus.push('Festékből befejezések tisztítása');
  if (strengths.includes('Támadólepattanózás erős')) focus.push('OREB agresszivitás fenntartása');
  return focus.slice(0, 2);
};

const buildSummary = (
  teamName: string,
  opponentName: string,
  result: 'win' | 'loss',
  context: PostGameReport['context'],
  decisive: PostGameReport['decisiveFactors'],
  playerImpact: PostGameReport['playerImpact'],
  nextFocus: string[],
  dataNotes: string[],
  reflectionLine?: string
) => {
  const tempoText = context.paceDelta === 'Higher'
    ? 'gyorsabb'
    : context.paceDelta === 'Lower'
      ? 'lassabb'
      : 'szezonátlagos';

  const offenseText = context.offenseEfficiencyDelta === 'Higher'
    ? 'hatékonyabb támadást játszott'
    : context.offenseEfficiencyDelta === 'Lower'
      ? 'hatékonyságban visszaesett'
      : 'átlagos hatékonyságot hozott';

  const defenseText = context.defenseEfficiencyDelta === 'Higher'
    ? 'védekezésben jobb hatékonyságot mutatott'
    : context.defenseEfficiencyDelta === 'Lower'
      ? 'védekezésben romlott a hatékonyság'
      : 'védekezésben átlagos volt';

  const decisiveText = [...decisive.offense, ...decisive.defense].slice(0, 3).join('; ');
  const positiveImpact = playerImpact.positive.length > 0
    ? `Pozitív impact: ${playerImpact.positive.join(', ')}.`
    : 'Pozitív impact: nincs kiemelt szereplő.';
  const negativeImpact = playerImpact.negative.length > 0
    ? `Negatív impact: ${playerImpact.negative.join(', ')}.`
    : '';
  const overUnderText = [
    playerImpact.overperformers.length > 0 ? `Kiugró teljesítmény: ${playerImpact.overperformers.join(', ')}.` : '',
    playerImpact.underperformers.length > 0 ? `Visszaesés: ${playerImpact.underperformers.join(', ')}.` : '',
  ].filter(Boolean).join(' ');

  const focusText = nextFocus.length > 0
    ? `Következő fókusz: ${nextFocus.join(' • ')}.`
    : 'Következő fókusz: végrehajtás stabilizálása.';

  const noteText = dataNotes.length > 0 ? `Megjegyzés: ${dataNotes.join(' ')}.` : '';
  const reflectionText = reflectionLine ? `Reflexió: ${reflectionLine}` : '';

  const sections = [
    `${teamName} ${result === 'win' ? 'győzelemmel' : 'vereséggel'} zárt ${opponentName} ellen.`,
    `Tempó és hatékonyság: ${tempoText} mérkőzés, a csapat ${offenseText}, védekezésben ${defenseText}.`,
    decisiveText ? `Döntő tényezők: ${decisiveText}.` : '',
    `Játékos hatások: ${[positiveImpact, negativeImpact, overUnderText].filter(Boolean).join(' ')}`.trim(),
    focusText,
    [noteText, reflectionText].filter(Boolean).join(' '),
  ]
    .map(line => line.trim())
    .filter(line => line.length > 0);

  return sections.join('\n');
};

const interpretGameContext = (context: PostGameReport['context']) => {
  const tempoText = context.paceDelta === 'Higher'
    ? 'A csapat a szezonátlagnál gyorsabb tempót diktált'
    : context.paceDelta === 'Lower'
      ? 'A mérkőzés tempója a szezonátlagnál lassabb volt'
      : 'A tempó a szezonátlag körül mozgott';

  const offenseText = context.offenseEfficiencyDelta === 'Higher'
    ? 'támadásban a szezonátlagnál hatékonyabb megoldásokat talált'
    : context.offenseEfficiencyDelta === 'Lower'
      ? 'támadásban a szezonátlaghoz képest visszaesett a hatékonyság'
      : 'támadásban a szezonátlagos hatékonyság érvényesült';

  const defenseText = context.defenseEfficiencyDelta === 'Higher'
    ? 'védekezésben a szezonátlagnál stabilabb teljesítményt hozott'
    : context.defenseEfficiencyDelta === 'Lower'
      ? 'védekezésben a szezonátlaghoz képest gyengébb kontrollt mutatott'
      : 'védekezésben átlagos szintet tartott';

  return `${tempoText}, miközben ${offenseText}. ${defenseText}.`;
};

const interpretDecisiveFactors = (
  decisive: PostGameReport['decisiveFactors'],
  meta: PostGameReport['decisiveFactorMeta']
) => {
  const offense = decisive.offense.slice(0, 2);
  const defense = decisive.defense.slice(0, 2);
  const offenseCount = decisive.offense.length;
  const defenseCount = decisive.defense.length;

  const dominance = offenseCount > defenseCount
    ? 'A támadás döntött.'
    : defenseCount > offenseCount
      ? 'A védekezés döntött.'
      : 'Komplex mérkőzéskép alakult ki.';

  const highlights = [
    offense.length > 0 ? `Támadás: ${offense.join('; ')}.` : '',
    defense.length > 0 ? `Védekezés: ${defense.join('; ')}.` : '',
  ].filter(Boolean).join(' ');

  const typeCounts = meta.reduce<Record<FactorType, number>>((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1;
    return acc;
  }, {} as Record<FactorType, number>);
  const orderedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
  const typeSummary = orderedTypes.length > 0
    ? `Domináns tengely: ${orderedTypes.slice(0, 2).map(([type, count]) => `${type} (${count})`).join(', ')}.`
    : '';

  return `${dominance} ${highlights} ${typeSummary}`.trim();
};

const interpretPlayerImpact = (impact: PostGameReport['playerImpact']) => {
  const positiveText = impact.positive.length > 0
    ? `Pozitív hatás: ${impact.positive.join(', ')} (alacsonyabb usage mellett értékes VAL hozzájárulás).`
    : 'Pozitív hatás: nincs egyértelmű kiemelés.';
  const negativeText = impact.negative.length > 0
    ? `Negatív hatás: ${impact.negative.join(', ')} (magas usage mellett alacsony VAL).`
    : 'Negatív hatás: nincs egyértelmű kiemelés.';
  const overText = impact.overperformers.length > 0
    ? `Meccs-szintű kiugrás: ${impact.overperformers.join(', ')}.`
    : '';
  const underText = impact.underperformers.length > 0
    ? `Meccs-szintű visszaesés: ${impact.underperformers.join(', ')}.`
    : '';

  return [positiveText, negativeText, overText, underText].filter(Boolean).join(' ');
};

const interpretStrengths = (strengths: string[]) => {
  const filtered = strengths.filter(item => item.includes('szezonátlag felett') || item.includes('liga felett'));
  if (filtered.length === 0) return 'Erősségek: nem volt stabil, szezon vagy liga feletti mutató.';
  return `Erősségek: ${filtered.join('; ')}.`;
};

const interpretProblems = (problems: string[]) => {
  if (problems.length === 0) return 'Problémák: nem volt kiemelt strukturális limitáció.';
  const mapped = problems.map(item => {
    if (item.includes('labdaeladás') || item.includes('TO')) return 'döntéshozatali és labdabiztonsági limitáció';
    if (item.includes('dobáshatékonyság')) return 'shot quality és befejezési hatékonyság ingadozás';
    if (item.includes('3P')) return 'spacing és periméter-hatékonysági limitáció';
    if (item.includes('Festék')) return 'festékből érkező befejezések minősége';
    if (item.includes('assziszt')) return 'labdajáratás folyamatossága';
    return 'strukturális végrehajtási limitáció';
  });
  const unique = Array.from(new Set(mapped)).slice(0, 2);
  return `Problémák: ${unique.join('; ')}.`;
};

const interpretNextFocus = (nextFocus: string[]) => {
  if (nextFocus.length === 0) return 'Következő fókusz: nincs kiemelt azonnali beavatkozás.';
  const items = nextFocus.slice(0, 2).map(item => item.replace(/ /g, '').trim());
  return `Következő fókusz: ${items.join(' • ')}.`;
};

const interpretExecutiveSummary = (
  report: PostGameReport,
  decisiveText: string,
  nextFocusText: string
) => {
  const tempoText = report.context.paceDelta === 'Higher'
    ? 'gyorsabb tempó'
    : report.context.paceDelta === 'Lower'
      ? 'lassabb tempó'
      : 'szezonátlagos tempó';
  const decisiveCore = decisiveText.split('.').shift()?.trim() || 'Komplex mérkőzéskép';
  const focusCore = nextFocusText.replace('Következő fókusz: ', '').replace(/ /g, '');
  const reflectionFragment = [report.reflection?.xFactor, report.reflection?.risk].filter(Boolean).join(' ');
  const reflectionText = reflectionFragment ? ` ${reflectionFragment}` : '';
  return `${report.teamName} ${report.result === 'win' ? 'megnyerte' : 'elveszítette'} a mérkőzést ${report.opponentName} ellen ${tempoText} mellett. ${decisiveCore}. ${focusCore}${reflectionText}`.trim();
};

export const interpretPostGameReport = (report: PostGameReport): PostGameInterpretation => {
  const gameContext = interpretGameContext(report.context);
  const decisiveFactors = interpretDecisiveFactors(report.decisiveFactors, report.decisiveFactorMeta);
  const playerImpact = interpretPlayerImpact(report.playerImpact);
  const strengths = interpretStrengths(report.strengths);
  const problems = interpretProblems(report.problems);
  const nextFocus = interpretNextFocus(report.nextFocus);
  const summary = interpretExecutiveSummary(report, decisiveFactors, nextFocus);

  return {
    gameContext,
    decisiveFactors,
    playerImpact,
    strengths,
    problems,
    nextFocus,
    summary,
  };
};

const buildPostgameMetrics = (
  game: NormalizedGameStats,
  season: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks
) => {
  const metric = (key: string, label: string, gameValue: number, seasonValue: number, unit: 'pct' | 'count', multiplier = 1) => {
    const leagueMedian = getBenchmarkThreshold(benchmarks, season, key, 'P50');
    return {
      key,
      label,
      game: round(gameValue * multiplier, 1),
      season: round(seasonValue * multiplier, 1),
      delta: round((gameValue - seasonValue) * multiplier, 1),
      unit,
      leagueMedian: Number.isFinite(leagueMedian) ? round(leagueMedian * multiplier, 1) : undefined,
    };
  };

  const keyStats: PostGameMetric[] = [
    metric('efg', 'eFG%', game.efg, season.efg, 'pct', 1),
    metric('three_pct', '3P%', game.threePct, season.threePct, 'pct', 1),
    metric('assist_rate', 'Assist%', game.assistRate, season.assistRate, 'pct', 100),
    metric('turnover_rate', 'TO rate', game.turnoverRate, season.turnoverRate, 'pct', 100),
    metric('oreb_rate', 'OREB%', game.orebRate, season.orebRate, 'pct', 100),
    metric('ft_rate', 'FT rate', game.ftRate, season.ftRate, 'pct', 100),
  ];

  const efficiency: PostGameChartDatum[] = keyStats.map(item => ({
    label: item.label,
    game: item.game,
    season: item.season,
    league: item.leagueMedian,
  }));

  const shotProfile: PostGameShotProfileDatum[] = [
    {
      label: '2P arány',
      game: toPct(game.twoRate, 1),
      season: toPct(season.twoRate, 1),
    },
    {
      label: '3P arány',
      game: toPct(game.threeRate, 1),
      season: toPct(season.threeRate, 1),
    },
    {
      label: 'FT arány',
      game: toPct(game.ftRate, 1),
      season: toPct(season.ftRate, 1),
    },
  ];

  return {
    pointsFor: game.pointsFor,
    pointsAgainst: game.pointsAgainst,
    margin: round(game.pointsFor - game.pointsAgainst, 1),
    pace: game.pace,
    efg: game.efg,
    keyStats,
    charts: {
      efficiency,
      shotProfile,
    },
  };
};

export const analyzePostGameReport = (
  teamGame: TeamGameStat,
  opponentGame: TeamGameStat | null,
  teamSeason: TeamSeasonStat,
  leagueBenchmarks: LeagueTeamBenchmarks,
  players: PlayerGameStat[],
  preGameContext?: PreGameXFactorContext
): PostGameReport => {
  const actualPointsFor = teamGame.actualPointsFor ?? teamGame.pointsFor;
  const actualPointsAgainst = teamGame.actualPointsAgainst ?? teamGame.pointsAgainst;

  const opponentFallback: TeamGameStat = opponentGame || {
    teamId: 'opponent',
    teamName: 'Ellenfél',
    league: teamGame.league,
    season: teamGame.season,
    pointsFor: actualPointsAgainst,
    pointsAgainst: actualPointsFor,
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

  const calibratedTeamGame: TeamGameStat = {
    ...teamGame,
    pointsFor: actualPointsFor,
    pointsAgainst: actualPointsAgainst,
  };
  const calibratedOpponent: TeamGameStat = {
    ...opponentFallback,
    pointsFor: actualPointsAgainst,
    pointsAgainst: actualPointsFor,
  };

  const game = normalizeTeamGame(calibratedTeamGame, calibratedOpponent);
  const opponent = opponentGame ? normalizeTeamGame(calibratedOpponent, calibratedTeamGame) : null;
  const season = normalizeTeamSeason(teamSeason);

  const paceDelta = classifyDelta(game.pace - season.pace, 2.5);
  const offenseDelta = classifyDelta(game.efg - season.efg, 2.5);
  const defenseDelta = opponent
    ? classifyDelta(season.efg - opponent.efg, 2.5)
    : 'Similar';

  const decisive = buildDecisiveFactors(game, opponent, season);
  const decisiveAnnotations = annotateDecisiveFactors(decisive);
  const playerImpact = analyzePlayerImpact(players);
  const strengths = buildStrengths(game, season, leagueBenchmarks);
  const problems = buildProblems(game, season, leagueBenchmarks);
  const nextFocus = buildNextFocus(problems, strengths);
  const xFactorReflection = buildXFactorReflection(preGameContext, game, season, opponent, decisiveAnnotations.meta);
  const combinedReflection = [xFactorReflection.line, xFactorReflection.riskLine].filter(Boolean).join(' ');

  const metricsSummary = buildPostgameMetrics(game, season, leagueBenchmarks);

  const result: 'win' | 'loss' =
    teamGame.result ?? (actualPointsFor >= actualPointsAgainst ? 'win' : 'loss');

  const dataNotes = opponent ? [] : ['Ellenfél statisztikák nem elérhetők, a védekező értékelés korlátozott.'];

  return {
    teamId: teamGame.teamId,
    teamName: teamGame.teamName,
    opponentName: opponentGame?.teamName || opponentFallback.teamName,
    league: teamGame.league,
    season: teamGame.season,
    result,
    metrics: {
      pointsFor: metricsSummary.pointsFor,
      pointsAgainst: metricsSummary.pointsAgainst,
      margin: metricsSummary.margin,
      pace: metricsSummary.pace,
      efg: metricsSummary.efg,
      keyStats: metricsSummary.keyStats,
    },
    charts: metricsSummary.charts,
    context: {
      paceDelta,
      offenseEfficiencyDelta: offenseDelta,
      defenseEfficiencyDelta: defenseDelta,
    },
    dataNotes,
    decisiveFactors: decisive,
    decisiveFactorAnnotations: decisiveAnnotations.annotated,
    decisiveFactorMeta: decisiveAnnotations.meta,
    playerImpact,
    strengths,
    problems,
    nextFocus,
    reflection: {
      xFactor: xFactorReflection.line,
      risk: xFactorReflection.riskLine,
    },
    summary: buildSummary(
      teamGame.teamName,
      opponentGame?.teamName || opponentFallback.teamName,
      result,
      {
        paceDelta,
        offenseEfficiencyDelta: offenseDelta,
        defenseEfficiencyDelta: defenseDelta,
      },
      decisive,
      playerImpact,
      nextFocus,
      dataNotes,
      combinedReflection
    ),
  };
};
