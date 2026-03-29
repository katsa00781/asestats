import type { PreGameXFactorContext } from './pregame-scouting';
import { buildPlayerPostGameReport, computePlayerUsage } from './player-postgame';
import type { PlayerPostGameReport, PlayerShotMapContext } from './player-postgame';

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
  shotMap?: {
    available: boolean;
    team: TeamShotMapSummary | null;
    season: TeamShotMapSummary | null;
    comparison: ShotMapComparison | null;
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
  playerReport: PlayerPostGameReport;
  strengths: string[];
  problems: string[];
  nextFocus: string[];
  reflection: {
    xFactor: string;
    risk: string;
  };
  lineupInsights?: {
    available: boolean;
    totalStints: number;
    totalMinutes: number;
    topLineup?: {
      players: string[];
      minutes: number;
      plusMinus: number;
      netPer40: number;
    } | null;
    bottomLineup?: {
      players: string[];
      minutes: number;
      plusMinus: number;
      netPer40: number;
    } | null;
    topPair?: {
      players: string[];
      minutes: number;
      netPer40: number;
    } | null;
    implications: string[];
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

export type ShotMapEventInput = {
  playerId: string | null;
  x: number;
  y: number;
  isSuccessful: boolean;
  shotSide: 'home' | 'away';
};

export type PostGameShotMapContext = {
  gameShots: ShotMapEventInput[];
  seasonShots?: ShotMapEventInput[];
};

type ShotZone = 'rim' | 'paint' | 'mid' | 'corner3' | 'aboveBreak3';

type ShotZoneSummary = {
  attempts: number;
  made: number;
  pct: number;
};

type TeamShotMapSummary = {
  attempts: number;
  made: number;
  fgPct: number;
  rimRate: number;
  rimPct: number;
  midRate: number;
  midPct: number;
  threeRate: number;
  threePct: number;
  corner3Rate: number;
  corner3Pct: number;
  shotQualityIndex: number;
  zones: Record<ShotZone, ShotZoneSummary>;
};

type ShotMapComparison = {
  rimRateDelta: number;
  midRateDelta: number;
  threeRateDelta: number;
  corner3RateDelta: number;
  rimPctDelta: number;
  threePctDelta: number;
  shotQualityDelta: number;
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

type MechanismSignal = {
  realized: boolean;
  reason?: string;
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

const normalizeOffenseX = (event: ShotMapEventInput) =>
  event.shotSide === 'away' ? 100 - event.x : event.x;

const classifyShotZone = (event: ShotMapEventInput): ShotZone => {
  const x = normalizeOffenseX(event);
  const y = event.y;
  const dx = x - 6;
  const dy = y - 50;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance <= 9) return 'rim';
  if (distance <= 18) return 'paint';

  const corner3 = x >= 25 && (y <= 14 || y >= 86);
  if (corner3) return 'corner3';

  if (distance >= 29) return 'aboveBreak3';
  return 'mid';
};

const emptyZoneSummary = (): Record<ShotZone, ShotZoneSummary> => ({
  rim: { attempts: 0, made: 0, pct: 0 },
  paint: { attempts: 0, made: 0, pct: 0 },
  mid: { attempts: 0, made: 0, pct: 0 },
  corner3: { attempts: 0, made: 0, pct: 0 },
  aboveBreak3: { attempts: 0, made: 0, pct: 0 },
});

const buildTeamShotMapSummary = (events: ShotMapEventInput[]): TeamShotMapSummary => {
  const zones = emptyZoneSummary();
  let attempts = 0;
  let made = 0;

  events.forEach(event => {
    const zone = classifyShotZone(event);
    attempts += 1;
    zones[zone].attempts += 1;
    if (event.isSuccessful) {
      made += 1;
      zones[zone].made += 1;
    }
  });

  (Object.keys(zones) as ShotZone[]).forEach(zone => {
    zones[zone].pct = zones[zone].attempts > 0
      ? round((zones[zone].made / zones[zone].attempts) * 100, 1)
      : 0;
  });

  const threeAttempts = zones.corner3.attempts + zones.aboveBreak3.attempts;
  const threeMade = zones.corner3.made + zones.aboveBreak3.made;

  const rimRate = attempts > 0 ? zones.rim.attempts / attempts : 0;
  const midRate = attempts > 0 ? zones.mid.attempts / attempts : 0;
  const threeRate = attempts > 0 ? threeAttempts / attempts : 0;
  const corner3Rate = attempts > 0 ? zones.corner3.attempts / attempts : 0;

  const rimPct = zones.rim.attempts > 0 ? (zones.rim.made / zones.rim.attempts) * 100 : 0;
  const midPct = zones.mid.attempts > 0 ? (zones.mid.made / zones.mid.attempts) * 100 : 0;
  const threePct = threeAttempts > 0 ? (threeMade / threeAttempts) * 100 : 0;
  const corner3Pct = zones.corner3.attempts > 0 ? (zones.corner3.made / zones.corner3.attempts) * 100 : 0;

  const shotQualityIndex = round(((rimRate * 1.25) + (corner3Rate * 1.2) + (threeRate * 0.7) - (midRate * 0.9)) * 100, 1);

  return {
    attempts,
    made,
    fgPct: attempts > 0 ? round((made / attempts) * 100, 1) : 0,
    rimRate: round(rimRate * 100, 1),
    rimPct: round(rimPct, 1),
    midRate: round(midRate * 100, 1),
    midPct: round(midPct, 1),
    threeRate: round(threeRate * 100, 1),
    threePct: round(threePct, 1),
    corner3Rate: round(corner3Rate * 100, 1),
    corner3Pct: round(corner3Pct, 1),
    shotQualityIndex,
    zones,
  };
};

const buildShotMapComparison = (
  game: TeamShotMapSummary,
  season: TeamShotMapSummary
): ShotMapComparison => ({
  rimRateDelta: round(game.rimRate - season.rimRate, 1),
  midRateDelta: round(game.midRate - season.midRate, 1),
  threeRateDelta: round(game.threeRate - season.threeRate, 1),
  corner3RateDelta: round(game.corner3Rate - season.corner3Rate, 1),
  rimPctDelta: round(game.rimPct - season.rimPct, 1),
  threePctDelta: round(game.threePct - season.threePct, 1),
  shotQualityDelta: round(game.shotQualityIndex - season.shotQualityIndex, 1),
});

const buildPlayerShotMapContext = (events: ShotMapEventInput[]): PlayerShotMapContext => {
  const map: PlayerShotMapContext = {};

  events.forEach(event => {
    if (!event.playerId) return;
    if (!map[event.playerId]) {
      map[event.playerId] = {
        attempts: 0,
        made: 0,
        rimAttempts: 0,
        rimMade: 0,
        midAttempts: 0,
        midMade: 0,
        threeAttempts: 0,
        threeMade: 0,
        corner3Attempts: 0,
        corner3Made: 0,
      };
    }

    const row = map[event.playerId];
    const zone = classifyShotZone(event);
    row.attempts += 1;
    if (event.isSuccessful) row.made += 1;

    if (zone === 'rim' || zone === 'paint') {
      row.rimAttempts += 1;
      if (event.isSuccessful) row.rimMade += 1;
      return;
    }

    if (zone === 'mid') {
      row.midAttempts += 1;
      if (event.isSuccessful) row.midMade += 1;
      return;
    }

    row.threeAttempts += 1;
    if (event.isSuccessful) row.threeMade += 1;
    if (zone === 'corner3') {
      row.corner3Attempts += 1;
      if (event.isSuccessful) row.corner3Made += 1;
    }
  });

  return map;
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

  if (threePctDelta >= 4) {
    offense.push(`Periméterdobás hatékonyabb (+${threePctDelta} pp)`);
  } else if (threePctDelta <= -4) {
    offense.push(`Gyenge 3P-hatékonyság (${threePctDelta} pp)`);
  }

  if (twoRateDelta >= 6) offense.push(`Festékfókusz erősebb (+${twoRateDelta} pp)`);

  if (ftRateDelta >= 8) {
    offense.unshift(`FT rate dominancia (+${ftRateDelta} pp)`);
  } else if (ftRateDelta >= 5) {
    offense.push(`Aggresszív támadás (FT rate +${ftRateDelta} pp)`);
  } else if (ftRateDelta <= -6) {
    offense.push(`Kevés büntető (FT rate ${ftRateDelta} pp)`);
  }
  if (assistRateDelta >= 5) offense.push(`Jobb labdajáratás (+${assistRateDelta} pp)`);
  if (assistRateDelta <= -5) offense.push(`Labdajáratás akadozott (${assistRateDelta} pp)`);
  if (turnoverRateDelta >= 5) offense.push(`Támadás szétesett (TO rate +${turnoverRateDelta} pp)`);
  if (orebRateDelta >= 6) {
    offense.push(`Második esély dominancia (OREB +${orebRateDelta} pp)`);
  } else if (orebRateDelta <= -6) {
    offense.push(`Második esély hiány (OREB ${orebRateDelta} pp)`);
  }

  if (opponent) {
    const oppEfg = opponent.efg;
    const defenseHeldOverall = oppEfg <= season.efg - 3;
    if (oppEfg <= season.efg - 3) defense.push(`Ellenfél dobáshatékonyság limitált (${round(oppEfg, 1)}% eFG)`);
    if (opponent.fga3 >= 16) {
      const opponentThreePct = (opponent.fgm3 / opponent.fga3) * 100;
      const clearPerimeterIssue = opponentThreePct >= 42;
      const contextualIssue = opponentThreePct >= 38 && !defenseHeldOverall;
      if (clearPerimeterIssue || contextualIssue) {
        defense.push('Perimétervédekezési probléma');
      } else if (opponentThreePct >= 35 && !defenseHeldOverall) {
        defense.push(`Tripla-volumen kockázat kontroll alatt (${round(opponentThreePct, 1)}% ellenfél 3P)`);
      }
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
): MechanismSignal => {
  switch (key) {
    case 'perimeter': {
      if (opponent && opponent.fga3 > 0) {
        const oppThree = round((opponent.fgm3 / opponent.fga3) * 100, 1);
        if (oppThree <= 32) return { realized: true, reason: `védekezés: ellenfél 3P ${oppThree}%` };
      }
      const delta = round(game.threePct - season.threePct, 1);
      if (delta >= 4) {
        return { realized: true, reason: `támadás: saját 3P +${delta} pp (bónusz)` };
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

const computePlayerTrueShooting = (player: PlayerGameStat) => {
  const fga = player.fga2 + player.fga3;
  const denominator = 2 * (fga + 0.44 * player.fta);
  if (denominator === 0) return 0;
  return player.points / denominator;
};

const formatPositiveContributorLabel = (player: PlayerGameStat) => {
  const ts = computePlayerTrueShooting(player);
  const limitedScoringPlaymaker = player.ast >= 7 && ts <= 0.4 && player.points <= 6;
  if (limitedScoringPlaymaker) {
    return `${player.name} (${player.ast} assziszt, playmaker szerep – dobóhatékonyság fejlesztendő)`;
  }
  return player.name;
};

const analyzePlayerImpact = (players: PlayerGameStat[]) => {
  const positive: string[] = [];
  const negative: string[] = [];
  const overperformers: Array<{ name: string; score: number }> = [];
  const underperformers: Array<{ name: string; score: number }> = [];

  const totalUsage = players.reduce((sum, player) => sum + computePlayerUsage(player), 0);

  players.forEach(player => {
    const usage = computePlayerUsage(player);
    const usageShare = totalUsage > 0 ? usage / totalUsage : 0;
    const ts = computePlayerTrueShooting(player);
    const valPer36 = player.minutes > 0 ? (player.val / player.minutes) * 36 : 0;
    const hasReliableSample = player.minutes >= 8;

    if (usageShare >= 0.13 && player.val <= 5) negative.push(player.name);
    if (hasReliableSample && usageShare <= 0.1 && (player.val >= 10 || (player.minutes >= 12 && valPer36 >= 18))) {
      positive.push(formatPositiveContributorLabel(player));
    }

    const qualifiesOverperformer =
      player.minutes >= 18
      && (player.val >= 18 || valPer36 >= 20)
      && (ts >= 0.55 || usageShare >= 0.12);

    if (qualifiesOverperformer) {
      const score =
        player.val * 0.45
        + valPer36 * 0.2
        + player.points * 0.2
        + ts * 100 * 0.1
        + usageShare * 100 * 0.05;
      overperformers.push({ name: player.name, score });
    }

    const qualifiesUnderperformer =
      player.minutes >= 14
      && player.val <= 3
      && (ts <= 0.47 || usageShare >= 0.1);

    if (qualifiesUnderperformer) {
      const score = (4 - player.val) * 2 + Math.max((0.5 - ts) * 100, 0) + usageShare * 100;
      underperformers.push({ name: player.name, score });
    }
  });

  return {
    positive: positive.slice(0, 3),
    negative: negative.slice(0, 3),
    overperformers: overperformers
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(entry => entry.name),
    underperformers: underperformers
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(entry => entry.name),
  };
};

const buildStrengths = (
  game: NormalizedGameStats,
  season: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks,
  shotMapComparison?: ShotMapComparison | null
) => {
  const strengths: string[] = [];
  const efgDelta = round(game.efg - season.efg, 1);
  const assistRateDelta = toPct(game.assistRate - season.assistRate, 1);
  const orebRateDelta = toPct(game.orebRate - season.orebRate, 1);
  const threePctDelta = round(game.threePct - season.threePct, 1);
  const twoRateDelta = toPct(game.twoRate - season.twoRate, 1);

  if (efgDelta >= 3) strengths.push(`Dobáshatékonyság a szezonátlag felett (+${efgDelta} százalékpont)`);
  if (assistRateDelta >= 5) strengths.push(`Labdajáratás javult (+${assistRateDelta} százalékpont)`);
  if (orebRateDelta >= 5) strengths.push(`Támadólepattanózás erős (+${orebRateDelta} százalékpont)`);
  if (threePctDelta >= 4) strengths.push(`Erős 3P-hatékonyság (+${threePctDelta} százalékpont)`);
  if (twoRateDelta >= 6) strengths.push(`Festékből több befejezés (+${twoRateDelta} százalékpont)`);

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

  if (shotMapComparison) {
    if (shotMapComparison.rimRateDelta >= 6 && shotMapComparison.rimPctDelta >= 4) {
      strengths.push('Dobástérkép: gyűrűnyomás és befejezési hatékonyság javult');
    }
    if (shotMapComparison.corner3RateDelta >= 3 && shotMapComparison.threePctDelta >= 3) {
      strengths.push('Dobástérkép: saroktripla-volumen és hatékonyság liga-szintű trendet mutat');
    }
    if (shotMapComparison.shotQualityDelta >= 5) {
      strengths.push('Dobásszelekció javult (shot quality index emelkedés)');
    }
  }

  return strengths.slice(0, 3);
};

const buildProblems = (
  game: NormalizedGameStats,
  season: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks,
  shotMapComparison?: ShotMapComparison | null
) => {
  const problems: string[] = [];
  const turnoverRateDelta = toPct(game.turnoverRate - season.turnoverRate, 1);
  const efgDelta = round(game.efg - season.efg, 1);
  const assistRateDelta = toPct(game.assistRate - season.assistRate, 1);
  const threePctDelta = round(game.threePct - season.threePct, 1);
  const twoRateDelta = toPct(game.twoRate - season.twoRate, 1);
  const orebRateDelta = toPct(game.orebRate - season.orebRate, 1);
  const ftRateDelta = toPct(game.ftRate - season.ftRate, 1);

  if (turnoverRateDelta >= 5) problems.push(`Sok labdaeladás (+${turnoverRateDelta} százalékpont TO rate)`);
  if (efgDelta <= -3) problems.push(`Dobáshatékonyság visszaesett (${efgDelta} százalékpont)`);
  if (assistRateDelta <= -5) problems.push(`Labdajáratás akadozott (${assistRateDelta} százalékpont)`);
  if (threePctDelta <= -4) problems.push(`Gyenge 3P-hatékonyság (${threePctDelta} százalékpont)`);
  if (twoRateDelta <= -6) problems.push(`Festékbefejezések visszaestek (${twoRateDelta} százalékpont)`);
  if (orebRateDelta <= -6) problems.push(`Második esély volumen visszaesett (${orebRateDelta} százalékpont OREB)`);
  if (ftRateDelta <= -8) problems.push(`Alacsony FT rate (${ftRateDelta} százalékpont)`);

  if (scoreAbove(benchmarks, season, 'turnover_rate', game.turnoverRate, 60)) {
    problems.push('TO arány a liga felett');
  }
  if (scoreBelow(benchmarks, season, 'efg', game.efg, 40)) {
    problems.push('Dobáshatékonyság a liga alatt');
  }
  if (scoreBelow(benchmarks, season, 'three_pct', game.threePct, 40)) {
    problems.push('Periméter-hatékonyság a liga alatt');
  }
  if (scoreBelow(benchmarks, season, 'oreb_rate', game.orebRate, 40)) {
    problems.push('OREB volumen a liga alatt');
  }
  if (scoreBelow(benchmarks, season, 'ft_rate', game.ftRate, 40)) {
    problems.push('FT rate a liga alatt');
  }

  if (shotMapComparison) {
    if (shotMapComparison.midRateDelta >= 6 && shotMapComparison.shotQualityDelta <= -4) {
      problems.push('Dobástérkép: túl magas középtávoli arány, romló shot quality');
    }
    if (shotMapComparison.rimRateDelta <= -5 && shotMapComparison.rimPctDelta <= -4) {
      problems.push('Dobástérkép: gyengült gyűrűtámadás és festékbeli befejezés');
    }
    if (shotMapComparison.threeRateDelta >= 6 && shotMapComparison.threePctDelta <= -5) {
      problems.push('Dobástérkép: magas tripla-volumen alacsony hatékonysággal');
    }
  }

  return problems.slice(0, 3);
};

const buildNextFocus = (
  game: NormalizedGameStats,
  season: NormalizedTeamStats,
  problems: string[],
  strengths: string[]
) => {
  const focus: string[] = [];

  const topicKey = (message: string) => {
    const lower = message.toLowerCase();
    if (lower.includes('ft-rate') || lower.includes('ft rate') || lower.includes('büntető')) return 'ft';
    if (lower.includes('to-rate') || lower.includes('to ') || lower.includes('turnover') || lower.includes('labda')) return 'to';
    if (lower.includes('oreb') || lower.includes('második esély') || lower.includes('lepattanó')) return 'oreb';
    if (lower.includes('periméter') || lower.includes('3p')) return 'perimeter';
    if (lower.includes('assist') || lower.includes('playmaking')) return 'playmaking';
    if (lower.includes('festék')) return 'paint';
    if (lower.includes('efg') || lower.includes('dobás')) return 'shooting';
    return lower;
  };

  const topicPriority = (message: string) => {
    switch (topicKey(message)) {
      case 'ft':
        return 1;
      case 'to':
        return 2;
      case 'shooting':
        return 3;
      case 'playmaking':
        return 4;
      case 'perimeter':
        return 5;
      case 'paint':
        return 6;
      case 'oreb':
        return 7;
      default:
        return 9;
    }
  };

  const addFocus = (message: string) => {
    const key = topicKey(message);
    if (focus.some(item => topicKey(item) === key)) return;
    focus.push(message);
  };

  const formatFocusPlan = (title: string, goal: string, how: string) =>
    `${title}: Cél ${goal}. Hogyan: ${how}.`;

  const hasTurnoverProblem = problems.some(item =>
    item.includes('Sok labdaeladás') || item.includes('TO arány a liga felett')
  );
  if (hasTurnoverProblem) {
    addFocus(
      formatFocusPlan(
        'Labdabiztonság stabilizálása',
        `TO-rate ${toPct(game.turnoverRate, 1)}% → ${toPct(season.turnoverRate, 1)}%`,
        'egyszerűsített első passzok és korai döntések'
      )
    );
  }

  if (problems.includes('Dobáshatékonyság visszaesett')) {
    addFocus(
      formatFocusPlan(
        'Dobásminőség újrakalibrálása',
        `eFG ${game.efg.toFixed(1)}% vs ${season.efg.toFixed(1)}%`,
        'több festékből érkező befejezés és extra pass'
      )
    );
  }

  if (problems.includes('Labdajáratás akadozott')) {
    addFocus(
      formatFocusPlan(
        'Playmaking ritmus',
        `Assist-rate ${toPct(game.assistRate, 1)}% → ${toPct(season.assistRate, 1)}%`,
        'short roll és skip-pass visszahozása'
      )
    );
  }

  if (problems.includes('Gyenge 3P-hatékonyság')) {
    addFocus(
      formatFocusPlan(
        'Periméter fegyelem',
        `3P% ${game.threePct.toFixed(1)}% vs ${season.threePct.toFixed(1)}%`,
        'saroktriplák kialakítása, kevesebb erőltetett pull-up'
      )
    );
  }

  if (problems.includes('Festékbefejezések visszaestek')) {
    addFocus(
      formatFocusPlan(
        'Festék kontroll',
        'deep catch és rim run volumen visszaépítése',
        'nagyobb hangsúly a deep catch befejezéseken és rim run-okon'
      )
    );
  }

  const hasOrebProblem = problems.some(item => item.includes('második esély') || item.includes('OREB'));
  if (hasOrebProblem) {
    addFocus(
      formatFocusPlan(
        'Második esélyek visszaépítése',
        `OREB% ${toPct(game.orebRate, 1)}% → ${toPct(season.orebRate, 1)}%`,
        '4-5-ös posztok agresszívabb weakside crash-e'
      )
    );
  }

  const hasFtProblem = problems.some(item => item.includes('FT rate') || item.includes('büntető')); 
  if (hasFtProblem) {
    addFocus(
      formatFocusPlan(
        'Büntetők növelése',
        `FT-rate ${toPct(game.ftRate, 1)}% → ${toPct(season.ftRate, 1)}%`,
        'több kontaktkeresés az 1-3-asoktól és wedge setek'
      )
    );
  }

  if (strengths.includes('Támadólepattanózás erős')) {
    addFocus(
      formatFocusPlan(
        'OREB agresszivitás fenntartása',
        `jelenlegi OREB% ${toPct(game.orebRate, 1)}%`,
        'azonos intenzitás a támadóüvegen'
      )
    );
  }

  const margin = game.pointsFor - game.pointsAgainst;
  if (margin >= 20 && focus.length < 2) {
    addFocus(
      'Domináns minták konzerválása: a legerősebb rotációs és spacing-sémák tudatos korai visszahívása a következő meccsen.'
    );
  }

  if (focus.length === 0) {
    addFocus('Végrehajtás stabilizálása a meglévő erősségek fenntartásával.');
  }

  return [...focus]
    .sort((a, b) => topicPriority(a) - topicPriority(b))
    .slice(0, 2);
};

const buildOpponentProfileSection = (
  opponentName: string,
  game: NormalizedGameStats,
  season: NormalizedTeamStats,
  preGame?: PreGameXFactorContext
) => {
  const lines = ['**Ellenfél profil**'];
  const descriptors: string[] = [];
  if (preGame) {
    const labels = [
      preGame.primaryLabel || X_FACTOR_LABELS[preGame.primaryKey] || preGame.primaryKey,
      preGame.secondaryKey
        ? preGame.secondaryLabel || X_FACTOR_LABELS[preGame.secondaryKey] || preGame.secondaryKey
        : null,
    ].filter(Boolean) as string[];
    if (labels.length > 0) {
      lines.push(`• Pre-game fókusz: ${labels.join(' + ')}.`);
    }
  }

  const threeDelta = round(game.threePct - season.threePct, 1);
  if (threeDelta <= -4) descriptors.push(`periméter-limitálás (${game.threePct.toFixed(1)}% 3P vs ${season.threePct.toFixed(1)}%)`);
  const ftDelta = toPct(game.ftRate - season.ftRate, 1);
  if (ftDelta <= -6) descriptors.push(`kontakt-limitálás (${toPct(game.ftRate, 1)}% FT-rate vs ${toPct(season.ftRate, 1)}%)`);
  const orebDelta = toPct(game.orebRate - season.orebRate, 1);
  if (orebDelta <= -6) descriptors.push(`lepattanó-kontroll (${toPct(game.orebRate, 1)}% OREB vs ${toPct(season.orebRate, 1)}%)`);
  const assistDelta = toPct(game.assistRate - season.assistRate, 1);
  if (assistDelta <= -5) descriptors.push(`passzútvonal-zavarás (Assist-rate ${toPct(game.assistRate, 1)}% vs ${toPct(season.assistRate, 1)}%)`);
  if (descriptors.length === 0) {
    const margin = game.pointsFor - game.pointsAgainst;
    if (margin >= 20) {
      lines.push(`• ${opponentName} védekező identitása nem tudta érdemben lassítani a támadásunkat; domináns saját végrehajtás alakította a profilt.`);
    } else {
      lines.push(`• ${opponentName} védekező identitása ezen a meccsen nem torzította markánsan a támadóprofilunkat.`);
    }
  } else {
    lines.push(`• ${opponentName} védekezési realizáció: ${descriptors.join('; ')}.`);
  }
  return lines;
};

const buildSummary = (
  teamName: string,
  opponentName: string,
  result: 'win' | 'loss',
  context: PostGameReport['context'],
  decisive: PostGameReport['decisiveFactors'],
  playerImpact: PostGameReport['playerImpact'],
  playerReport: PlayerPostGameReport,
  nextFocus: string[],
  dataNotes: string[],
  metrics: PostGameReport['metrics'],
  season: NormalizedTeamStats,
  game: NormalizedGameStats,
  preGame?: PreGameXFactorContext,
  reflectionLine?: string
) => {
  const tempoText = context.paceDelta === 'Higher'
    ? 'gyorsabb'
    : context.paceDelta === 'Lower'
      ? 'lassabb'
      : 'szezonátlagos';

  const offenseText = context.offenseEfficiencyDelta === 'Higher'
    ? 'a szezonátlagnál hatékonyabb volt'
    : context.offenseEfficiencyDelta === 'Lower'
      ? 'a szezonátlaghoz képest visszaesett'
      : 'szezonátlag körül teljesített';

  const defenseSummaryText = context.defenseEfficiencyDelta === 'Higher'
    ? 'jobb hatékonyságot mutatott'
    : context.defenseEfficiencyDelta === 'Lower'
      ? 'romlott a hatékonyság'
      : 'átlagos teljesítményt nyújtott';

  const decisiveText = [...decisive.offense, ...decisive.defense].slice(0, 3).join('; ');

  const marginAbs = Math.abs(metrics.margin);
  const marginLabel = marginAbs >= 12
    ? 'nagy különbség'
    : marginAbs >= 5
      ? 'közepes különbség'
      : marginAbs >= 1
        ? 'szoros végjáték'
        : 'minimális különbség';
  const efgDelta = round(metrics.efg - season.efg, 1);
  const efgLine = `${metrics.efg.toFixed(1)}% (szezon ${season.efg.toFixed(1)}%, ${efgDelta >= 0 ? '+' : ''}${efgDelta} pp)`;

  const normalizePlayerName = (name: string) => name.toLowerCase().replace(/\s+/g, ' ').trim();
  const playerLookup = new Map(
    playerReport.players.map(player => [normalizePlayerName(player.name), player])
  );

  const formatPlayerContext = (name: string, mode: 'positive' | 'over' | 'negative' | 'under') => {
    const player = playerLookup.get(normalizePlayerName(name));
    if (!player) return name;
    if (mode === 'over') {
      return `${player.name} (${player.points} pont, TS ${player.tsPct.toFixed(1)}%, VAL/36 ${player.valPer36.toFixed(1)})`;
    }
    if (mode === 'positive') {
      return `${player.name} (VAL/36 ${player.valPer36.toFixed(1)}, usage ${toPct(player.usageShare, 1)}%)`;
    }
    if (mode === 'negative') {
      return `${player.name} (VAL ${player.val}, usage ${toPct(player.usageShare, 1)}%)`;
    }
    return `${player.name} (TS ${player.tsPct.toFixed(1)}%, VAL ${player.val})`;
  };

  const playerHighlightLines = (() => {
    const lines: string[] = [];
    if (
      playerImpact.positive.length === 0 &&
      playerImpact.overperformers.length === 0 &&
      playerImpact.negative.length === 0 &&
      playerImpact.underperformers.length === 0
    ) {
      lines.push('**Játékos kiemelések**');
      lines.push('• Pozitív hatás: nincs kiemelt szereplő.');
      return lines;
    }
    lines.push('**Játékos kiemelések**');
    if (playerImpact.positive.length > 0) {
      lines.push(`• Pozitív hatás: ${playerImpact.positive.map(name => formatPlayerContext(name, 'positive')).join(', ')}.`);
    }
    if (playerImpact.overperformers.length > 0) {
      lines.push(`• Kiugró teljesítmény: ${playerImpact.overperformers.map(name => formatPlayerContext(name, 'over')).join(', ')}.`);
    }
    if (playerImpact.negative.length > 0) {
      lines.push(`• Limitált hatás: ${playerImpact.negative.map(name => formatPlayerContext(name, 'negative')).join(', ')}.`);
    }
    if (playerImpact.underperformers.length > 0) {
      lines.push(`• Visszaesés: ${playerImpact.underperformers.map(name => formatPlayerContext(name, 'under')).join(', ')}.`);
    }
    return lines;
  })();

  const focusLines = nextFocus.length > 0
    ? ['**Következő fókusz**', ...nextFocus.map(item => `• ${item}`)]
    : ['**Következő fókusz**', '• Végrehajtás stabilizálása.'];

  const opponentLines = dataNotes.some(note => note.includes('Ellenfél statisztikák nem elérhetők'))
    ? []
    : buildOpponentProfileSection(opponentName, game, season, preGame);

  const bulletLines = [
    '**Mérkőzés összefoglalója**',
    `• Eredmény: ${teamName} ${result === 'win' ? 'legyőzte' : 'alulmaradt'} ${opponentName} ellen (${metrics.pointsFor}-${metrics.pointsAgainst}).`,
    `• Tempó: ${tempoText} (${metrics.pace.toFixed(1)} támadás).`,
    `• Hatékonyság: támadásban ${offenseText} (${efgLine}); védekezésben ${defenseSummaryText}.`,
    `• Margin: ${metrics.margin > 0 ? '+' : ''}${metrics.margin.toFixed(1)} (${marginLabel}).`,
    decisiveText ? `• Kulcsmomentumok: ${decisiveText}.` : '',
    ...playerHighlightLines,
    ...opponentLines,
    ...focusLines,
  ].filter(Boolean);

  if (dataNotes.length > 0) {
    bulletLines.push(`• Megjegyzés: ${dataNotes.join(' ')}`);
  }

  if (reflectionLine) {
    bulletLines.push(`• Reflexió: ${reflectionLine}`);
  }

  return bulletLines.join('\n');
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
    if (item.includes('második esély') || item.includes('OREB')) return 'második esély volumen és lepattanó kontroll';
    if (item.includes('FT rate') || item.includes('büntető')) return 'büntető kiharcolási volumen és kontaktusmenedzsment';
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
  preGameContext?: PreGameXFactorContext,
  shotMapContext?: PostGameShotMapContext
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
  const leagueMedianEfg = getBenchmarkThreshold(leagueBenchmarks, season, 'efg', 'P50');
  const defenseReferenceEfg = Number.isFinite(leagueMedianEfg) && leagueMedianEfg > 0
    ? leagueMedianEfg
    : season.efg;
  const defenseDelta = opponent
    ? classifyDelta(defenseReferenceEfg - opponent.efg, 2.5)
    : 'Similar';

  const decisive = buildDecisiveFactors(game, opponent, season);
  const decisiveAnnotations = annotateDecisiveFactors(decisive);
  const playerImpact = analyzePlayerImpact(players);
  const gameShotSummary = shotMapContext?.gameShots?.length
    ? buildTeamShotMapSummary(shotMapContext.gameShots)
    : null;
  const seasonShotSummary = shotMapContext?.seasonShots?.length
    ? buildTeamShotMapSummary(shotMapContext.seasonShots)
    : null;
  const shotMapComparison = gameShotSummary && seasonShotSummary
    ? buildShotMapComparison(gameShotSummary, seasonShotSummary)
    : null;

  const playerShotMapContext = shotMapContext?.gameShots?.length
    ? buildPlayerShotMapContext(shotMapContext.gameShots)
    : undefined;

  const playerReport = buildPlayerPostGameReport(players, playerShotMapContext);
  const strengths = buildStrengths(game, season, leagueBenchmarks, shotMapComparison);
  const problems = buildProblems(game, season, leagueBenchmarks, shotMapComparison);
  const nextFocus = buildNextFocus(game, season, problems, strengths);
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
    shotMap: {
      available: Boolean(gameShotSummary),
      team: gameShotSummary,
      season: seasonShotSummary,
      comparison: shotMapComparison,
    },
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
    playerReport,
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
      playerReport,
      nextFocus,
      dataNotes,
      metricsSummary,
      season,
      game,
      preGameContext,
      combinedReflection
    ),
  };
};
