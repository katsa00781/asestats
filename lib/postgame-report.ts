import type { PreGameXFactorContext } from './pregame-scouting';
import { USG_HIGH_MIN, USG_LOW_MAX, buildPlayerPostGameReport, computeUsageRates } from './player-postgame';
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
  isStarter?: boolean;
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
  /**
   * Az ellenfelek védő lepattanói a szezonban. Ezzel az OREB% ugyanazt a
   * definíciót követi, mint a meccsérték (T-lep / (T-lep + ellenfél V-lep));
   * hiányában a saját lepattanókból számolt közelítés marad.
   */
  oppDreb?: number;
  /**
   * Az ellenfelek birtoklásbecslése a szezonban. Megadva a tempó és az
   * ORtg / DRtg a két csapat átlagolt birtoklásszámából számol, mint a meccsen.
   */
  oppPossessions?: number;
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

/**
 * A meccsértékek referenciája. Kis szezonmintánál (kevesebb mint
 * `MIN_SEASON_BASELINE_GAMES` meccs) a szezonátlag gyakorlatilag maga a meccs,
 * ezért ilyenkor a liga medián (P50) a viszonyítási alap.
 */
export type PostgameBaseline = {
  kind: 'season' | 'league';
  seasonGames: number;
  smallSample: boolean;
  /**
   * Van-e értelmes viszonyítási alap. Kis mintánál liga benchmark nélkül a
   * szezonátlag maga a meccs – ilyenkor a szöveg nem hivatkozik referenciára.
   */
  comparable: boolean;
  /** Oszlopfejléc / címke, pl. „Szezon átl.” vagy „Liga medián (kis minta)”. */
  label: string;
  /** Szövegbe illeszthető főnév: „szezonátlag” vagy „ligamedián”. */
  noun: string;
};

/** Pont / 100 birtoklás – a birtoklás a `metrics.pace` közös (két csapat átlaga) becslése. */
export type PostgameRatings = {
  possessions: number;
  ortg: number;
  drtg: number;
  net: number;
  refPossessions: number | null;
  refOrtg: number | null;
  refDrtg: number | null;
  refNet: number | null;
  /** Melyik oldal tért el jobban a referenciától a végeredmény irányába. */
  primaryCause: 'offense' | 'defense' | 'balanced' | 'unknown';
};

export type PostgameOpponentShooting = {
  efg: number;
  fgm3: number;
  fga3: number;
  threePct: number;
  ftRate: number;
  orebRate: number;
  turnoverRate: number;
};

export type PostGameReport = {
  teamId: string;
  teamName: string;
  opponentName: string;
  league: string;
  season: string;
  result: 'win' | 'loss';
  /** Opcionális a korábban mentett / régi riportobjektumok miatt. */
  baseline?: PostgameBaseline;
  metrics: {
    pointsFor: number;
    pointsAgainst: number;
    margin: number;
    pace: number;
    efg: number;
    /** `season`: a referencia értéke (szezonátlag vagy kis mintánál liga medián). */
    keyStats: PostGameMetric[];
    ratings?: PostgameRatings | null;
    opponent?: PostgameOpponentShooting | null;
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
  /** Explicit előjel; opcionális a korábban mentett riportok miatt. */
  tone?: 'positive' | 'negative';
  /** `opponent`: meccs-párharc; `reference`: liga medián / szezonátlag. */
  source?: 'opponent' | 'reference';
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
  const aboveBreak3Rate = attempts > 0 ? zones.aboveBreak3.attempts / attempts : 0;
  const paintRate = attempts > 0 ? zones.paint.attempts / attempts : 0;

  const rimPct = zones.rim.attempts > 0 ? (zones.rim.made / zones.rim.attempts) * 100 : 0;
  const midPct = zones.mid.attempts > 0 ? (zones.mid.made / zones.mid.attempts) * 100 : 0;
  const threePct = threeAttempts > 0 ? (threeMade / threeAttempts) * 100 : 0;
  const corner3Pct = zones.corner3.attempts > 0 ? (zones.corner3.made / zones.corner3.attempts) * 100 : 0;

  const shotQualityIndex = round(
    ((rimRate * 1.25) + (paintRate * 0.8) + (corner3Rate * 1.2) + (aboveBreak3Rate * 0.65) - (midRate * 0.9)) * 100,
    1
  );

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
  /** FTM / FGA (értékesített büntető / mezőnykísérlet). */
  ftRate: number;
  efg: number;
  valPerGame: number;
  /** Pont / 100 saját birtoklás; 0, ha nincs adat. */
  ortg: number;
  /** Kapott pont / 100 saját birtoklás; 0, ha nincs adat. */
  drtg: number;
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

/**
 * Közös birtoklásszám: a két csapat becslésének átlaga. Egy meccsen a két
 * csapat birtoklása ±1 lehet csak, ezért mindkét rating ugyanazzal a
 * nevezővel számol (így a DRtg = az ellenfél ORtg-je).
 */
const sharedPossessions = (own: number, opponent: number) => (own + opponent) / 2;

const normalizeTeamSeason = (raw: TeamSeasonStat): NormalizedTeamStats => {
  const games = raw.games || 1;
  const fga = raw.fga2 + raw.fga3;
  const fgm = raw.fgm2 + raw.fgm3;
  const tovDenominator = fga + 0.44 * raw.fta + raw.tov;
  const ownPossessions = Math.max(tovDenominator - raw.oreb, 0);
  const totalPossessions = typeof raw.oppPossessions === 'number' && raw.oppPossessions > 0
    ? sharedPossessions(ownPossessions, raw.oppPossessions)
    : ownPossessions;
  const pace = totalPossessions / games;
  const ortg = totalPossessions > 0 ? (raw.pointsFor / totalPossessions) * 100 : 0;
  const drtg = totalPossessions > 0 ? (raw.pointsAgainst / totalPossessions) * 100 : 0;
  const assistRate = fgm > 0 ? raw.ast / fgm : 0;
  const turnoverRate = tovDenominator > 0 ? raw.tov / tovDenominator : 0;
  const orebDenominator = typeof raw.oppDreb === 'number' && raw.oppDreb > 0
    ? raw.oreb + raw.oppDreb
    : raw.oreb + raw.dreb;
  const orebRate = orebDenominator > 0 ? raw.oreb / orebDenominator : 0;
  const twoRate = fga > 0 ? raw.fga2 / fga : 0;
  const threeRate = fga > 0 ? raw.fga3 / fga : 0;
  const threePct = raw.fga3 > 0 ? (raw.fgm3 / raw.fga3) * 100 : 0;
  const ftRate = fga > 0 ? raw.ftm / fga : 0;
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
    ortg: round(ortg, 1),
    drtg: round(drtg, 1),
  };
};

const normalizeTeamGame = (raw: TeamGameStat, opponent: TeamGameStat): NormalizedGameStats => {
  const fga = raw.fga2 + raw.fga3;
  const fgm = raw.fgm2 + raw.fgm3;
  const tovDenominator = fga + 0.44 * raw.fta + raw.tov;
  const pace = Math.max(tovDenominator - raw.oreb, 0);
  const assistRate = fgm > 0 ? raw.ast / fgm : 0;
  const turnoverRate = tovDenominator > 0 ? raw.tov / tovDenominator : 0;
  const orebRate = (raw.oreb + opponent.dreb) > 0 ? raw.oreb / (raw.oreb + opponent.dreb) : 0;
  const twoRate = fga > 0 ? raw.fga2 / fga : 0;
  const threeRate = fga > 0 ? raw.fga3 / fga : 0;
  const threePct = raw.fga3 > 0 ? (raw.fgm3 / raw.fga3) * 100 : 0;
  const ftRate = fga > 0 ? raw.ftm / fga : 0;
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
  'ortg',
  'drtg',
];

/** A ratingeknél a 0 „nincs adat” (pl. hiányzó kapott pontok), nem valós érték. */
const POSITIVE_ONLY_STAT_KEYS = new Set(['ortg', 'drtg']);

/** Ennél kevesebb szezonmeccsnél a szezonátlag helyett a liga medián a referencia. */
export const MIN_SEASON_BASELINE_GAMES = 3;

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
          .filter(v => Number.isFinite(v) && (!POSITIVE_ONLY_STAT_KEYS.has(stat) || v > 0))
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
    case 'ortg':
      return team.ortg;
    case 'drtg':
      return team.drtg;
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

/** A liga medián (P50) értéke, vagy null, ha nincs értelmezhető benchmark. */
const getLeagueMedian = (
  benchmarks: LeagueTeamBenchmarks,
  team: NormalizedTeamStats,
  stat: string
): number | null => {
  const value = benchmarks[team.league]?.[team.season]?.[stat]?.P50;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
};

/**
 * A referencia kiválasztása (egyetlen belépési pont). Elég szezonmintánál a
 * saját szezonátlag; kis mintánál (ahol a szezonátlag ≈ a meccs, minden delta
 * 0) a liga medián. Ha liga benchmark sincs, a baseline `comparable: false`:
 * a szöveg ekkor nem hivatkozik referenciára.
 */
const resolveBaseline = (
  season: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks
): { reference: NormalizedTeamStats; baseline: PostgameBaseline } => {
  const seasonGames = season.games;
  const smallSample = seasonGames < MIN_SEASON_BASELINE_GAMES;
  const leagueEfg = getLeagueMedian(benchmarks, season, 'efg');

  if (!smallSample) {
    return {
      reference: season,
      baseline: { kind: 'season', seasonGames, smallSample, comparable: true, label: 'Szezon átl.', noun: 'szezonátlag' },
    };
  }

  if (leagueEfg === null) {
    return {
      reference: season,
      baseline: {
        kind: 'season',
        seasonGames,
        smallSample,
        comparable: false,
        label: 'Nincs referencia (kis minta)',
        noun: 'referencia',
      },
    };
  }

  const pick = (stat: string, fallback: number) => getLeagueMedian(benchmarks, season, stat) ?? fallback;

  return {
    reference: {
      ...season,
      pace: pick('pace', season.pace),
      assistRate: pick('assist_rate', season.assistRate),
      turnoverRate: pick('turnover_rate', season.turnoverRate),
      orebRate: pick('oreb_rate', season.orebRate),
      twoRate: pick('two_rate', season.twoRate),
      threeRate: pick('three_rate', season.threeRate),
      threePct: pick('three_pct', season.threePct),
      ftRate: pick('ft_rate', season.ftRate),
      efg: leagueEfg,
      valPerGame: pick('val_per_game', season.valPerGame),
      ortg: pick('ortg', season.ortg),
      drtg: pick('drtg', season.drtg),
    },
    baseline: {
      kind: 'league',
      seasonGames,
      smallSample,
      comparable: true,
      label: 'Liga medián (kis minta)',
      noun: 'ligamedián',
    },
  };
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

/**
 * Egy döntő tényező jelöltje. A `tone` explicit előjel (a szövegből nem kell
 * kikövetkeztetni); a `source` mutatja, hogy az állítás a meccs-párharcból
 * (saját vs. ellenfél ugyanazon a meccsen) vagy a referenciából (liga medián /
 * szezonátlag) származik.
 */
type DecisiveFactorCandidate = {
  label: string;
  axis: 'offense' | 'defense';
  type: FactorType;
  tone: 'positive' | 'negative';
  source: 'opponent' | 'reference';
  topic: string;
  /** |eltérés| / küszöb – a rangsoroláshoz. */
  strength: number;
};

const signedPp = (value: number) => `${value >= 0 ? '+' : ''}${round(value, 1)} pp`;
/** Egy tizedesre kerekítve, a kulcsmutató-táblával azonos kerekítéssel. */
const fixed1 = (value: number) => round(value, 1).toFixed(1);

/**
 * A párharc-tényező (saját vs. ellenfél) mindkét csapat értékét mutatja, így
 * lefedi az azonos témájú ellenfél-oldali sort is.
 */
const OPPONENT_TOPIC_COVERS: Record<string, string[]> = {
  efg: ['efg', 'opp-efg'],
  to: ['to', 'opp-to'],
  oreb: ['oreb', 'opp-oreb'],
  ft: ['ft'],
};

/**
 * Döntő tényezők. Elsődleges forrás a meccs-párharc (négy faktor: eFG, TO,
 * OREB, FT rate a két csapat között) és a védekezésnél az ellenfél értéke a
 * liga mediánhoz mérve; a saját referenciához (liga medián / szezonátlag)
 * mért delta másodlagos, és azonos témában nem ismétli a párharc-tényezőt.
 * Kis minta + referencia nélkül a referencia-delta sorok kimaradnak.
 */
const buildDecisiveFactors = (
  game: NormalizedGameStats,
  opponent: NormalizedGameStats | null,
  season: NormalizedTeamStats,
  baseline: PostgameBaseline,
  benchmarks: LeagueTeamBenchmarks
): { offense: string[]; defense: string[]; meta: FactorMeta[] } => {
  const candidates: DecisiveFactorCandidate[] = [];
  const add = (candidate: DecisiveFactorCandidate) => candidates.push(candidate);

  // 1) Meccs-párharc: saját vs. ellenfél ugyanazon a meccsen.
  if (opponent) {
    const efgDiff = round(game.efg - opponent.efg, 1);
    if (Math.abs(efgDiff) >= 5) {
      add({
        label: `Dobáshatékonysági ${efgDiff > 0 ? 'előny' : 'hátrány'} az ellenféllel szemben (eFG ${game.efg.toFixed(1)}% vs ${opponent.efg.toFixed(1)}%, ${signedPp(efgDiff)})`,
        axis: 'offense', type: 'Hatékonyság', tone: efgDiff > 0 ? 'positive' : 'negative',
        source: 'opponent', topic: 'efg', strength: Math.abs(efgDiff) / 5,
      });
    }
    const toDiff = toPct(game.turnoverRate - opponent.turnoverRate, 1);
    if (Math.abs(toDiff) >= 4) {
      add({
        label: `Labdabiztonsági ${toDiff < 0 ? 'előny' : 'hátrány'} (TO rate ${toPct(game.turnoverRate, 1)}% vs ${toPct(opponent.turnoverRate, 1)}%, ${signedPp(toDiff)})`,
        axis: 'offense', type: 'Kontroll', tone: toDiff < 0 ? 'positive' : 'negative',
        source: 'opponent', topic: 'to', strength: Math.abs(toDiff) / 4,
      });
    }
    const orebDiff = toPct(game.orebRate - opponent.orebRate, 1);
    if (Math.abs(orebDiff) >= 10) {
      add({
        label: `Lepattanó-${orebDiff > 0 ? 'fölény' : 'hátrány'} (OREB% ${toPct(game.orebRate, 1)}% vs ${toPct(opponent.orebRate, 1)}%, ${signedPp(orebDiff)})`,
        axis: 'offense', type: 'Volumen', tone: orebDiff > 0 ? 'positive' : 'negative',
        source: 'opponent', topic: 'oreb', strength: Math.abs(orebDiff) / 10,
      });
    }
    const ftDiff = toPct(game.ftRate - opponent.ftRate, 1);
    if (Math.abs(ftDiff) >= 7) {
      add({
        label: `${ftDiff > 0 ? 'Több' : 'Kevesebb'} büntetőpont az ellenfélnél (FTM rate ${toPct(game.ftRate, 1)}% vs ${toPct(opponent.ftRate, 1)}%, ${signedPp(ftDiff)})`,
        axis: 'offense', type: 'Volumen', tone: ftDiff > 0 ? 'positive' : 'negative',
        source: 'opponent', topic: 'ft', strength: Math.abs(ftDiff) / 7,
      });
    }
  }

  // 2) Referencia-delta (liga medián / szezonátlag) – másodlagos.
  if (baseline.comparable) {
    const noun = baseline.noun;
    const reference = (
      topic: string,
      delta: number,
      threshold: number,
      type: FactorType,
      positiveLabel: string,
      negativeLabel: string,
      higherIsBetter = true
    ) => {
      if (Math.abs(delta) < threshold) return;
      const better = higherIsBetter ? delta > 0 : delta < 0;
      add({
        label: `${better ? positiveLabel : negativeLabel} (${signedPp(delta)})`,
        axis: 'offense', type, tone: better ? 'positive' : 'negative',
        source: 'reference', topic, strength: Math.abs(delta) / threshold,
      });
    };

    reference('three', round(game.threePct - season.threePct, 1), 4, 'Hatékonyság',
      `3P% a ${noun} felett`, `3P% a ${noun} alatt`);
    const twoRateDelta = toPct(game.twoRate - season.twoRate, 1);
    if (twoRateDelta >= 6) {
      reference('paint', twoRateDelta, 6, 'Volumen', `Festékfókusz erősebb a ${noun}nál`, '');
    }
    reference('ft', toPct(game.ftRate - season.ftRate, 1), 5, 'Volumen',
      `Több büntetőpont a ${noun}nál (FTM rate)`, `Kevés büntetőpont a ${noun}hoz képest (FTM rate)`);
    reference('assist', toPct(game.assistRate - season.assistRate, 1), 5, 'Hatékonyság',
      `Jobb labdajáratás a ${noun}nál`, `Labdajáratás akadozott a ${noun}hoz képest`);
    reference('to', toPct(game.turnoverRate - season.turnoverRate, 1), 5, 'Kontroll',
      `Kevesebb labdaeladás a ${noun}nál (TO rate)`, `Támadás szétesett a ${noun}hoz képest (TO rate)`, false);
    reference('oreb', toPct(game.orebRate - season.orebRate, 1), 6, 'Volumen',
      `Második esély a ${noun} felett (OREB)`, `Második esély a ${noun} alatt (OREB)`);
  }

  // 3) Védekezés: az ellenfél meccsértéke a liga mediánhoz mérve. Liga
  //    benchmark nélkül nincs megbízható viszonyítás – a sor kimarad.
  if (opponent) {
    const leagueEfg = getLeagueMedian(benchmarks, season, 'efg');
    if (leagueEfg !== null) {
      const delta = round(opponent.efg - leagueEfg, 1);
      if (Math.abs(delta) >= 3) {
        add({
          label: delta < 0
            ? `Ellenfél dobáshatékonysága limitálva (eFG ${fixed1(opponent.efg)}% vs liga medián ${fixed1(leagueEfg)}%)`
            : `Ellenfél hatékonyan dobott (eFG ${fixed1(opponent.efg)}% vs liga medián ${fixed1(leagueEfg)}%)`,
          axis: 'defense', type: 'Hatékonyság', tone: delta < 0 ? 'positive' : 'negative',
          source: 'reference', topic: 'opp-efg', strength: Math.abs(delta) / 3,
        });
      }
    }

    const leagueThree = getLeagueMedian(benchmarks, season, 'three_pct');
    if (leagueThree !== null && opponent.fga3 >= 16) {
      // Az állítás mellé mindig odakerül a bizonyíték (ellenfél 3P dobás/kísérlet).
      const evidence = `ellenfél 3P ${opponent.fgm3}/${opponent.fga3}, ${fixed1(opponent.threePct)}% vs liga medián ${fixed1(leagueThree)}%`;
      const delta = round(opponent.threePct - leagueThree, 1);
      if (delta >= 6) {
        add({
          label: `Perimétervédekezési probléma (${evidence})`,
          axis: 'defense', type: 'Hatékonyság', tone: 'negative',
          source: 'reference', topic: 'opp-three', strength: delta / 3,
        });
      } else if (delta >= 3) {
        add({
          label: `Periméter-kockázat (${evidence})`,
          axis: 'defense', type: 'Hatékonyság', tone: 'negative',
          source: 'reference', topic: 'opp-three', strength: delta / 3,
        });
      } else if (delta <= -5) {
        add({
          label: `Periméter kontroll (${evidence})`,
          axis: 'defense', type: 'Hatékonyság', tone: 'positive',
          source: 'reference', topic: 'opp-three', strength: Math.abs(delta) / 3,
        });
      }
    }

    const leagueOreb = getLeagueMedian(benchmarks, season, 'oreb_rate');
    if (leagueOreb !== null) {
      const delta = toPct(opponent.orebRate - leagueOreb, 1);
      if (Math.abs(delta) >= 6) {
        add({
          label: `${delta > 0 ? 'Védőlepattanózás gyenge' : 'Védőlepattanó kontroll'} (ellenfél OREB ${toPct(opponent.orebRate, 1)}% vs liga medián ${toPct(leagueOreb, 1)}%)`,
          axis: 'defense', type: 'Volumen', tone: delta > 0 ? 'negative' : 'positive',
          source: 'reference', topic: 'opp-oreb', strength: Math.abs(delta) / 6,
        });
      }
    }

    const leagueTo = getLeagueMedian(benchmarks, season, 'turnover_rate');
    if (leagueTo !== null) {
      const delta = toPct(opponent.turnoverRate - leagueTo, 1);
      if (Math.abs(delta) >= 5) {
        add({
          label: `${delta > 0 ? 'Kikényszerített labdavesztések' : 'Kevés kikényszerített labdavesztés'} (ellenfél TO rate ${toPct(opponent.turnoverRate, 1)}% vs liga medián ${toPct(leagueTo, 1)}%)`,
          axis: 'defense', type: 'Kontroll', tone: delta > 0 ? 'positive' : 'negative',
          source: 'reference', topic: 'opp-to', strength: Math.abs(delta) / 5,
        });
      }
    }
  }

  // Azonos témában a párharc-tényező nyer; a sorrend: párharc, majd erősség.
  const opponentTopics = new Set(
    candidates
      .filter(c => c.source === 'opponent')
      .flatMap(c => OPPONENT_TOPIC_COVERS[c.topic] ?? [c.topic])
  );
  const selected = candidates
    .filter(c => c.source === 'opponent' || !opponentTopics.has(c.topic))
    .sort((a, b) => {
      if (a.source !== b.source) return a.source === 'opponent' ? -1 : 1;
      return b.strength - a.strength;
    });

  const meta = selected.map<FactorMeta>(c => ({
    label: c.label,
    annotated: `${c.label} • ${c.type}-alapú`,
    type: c.type,
    axis: c.axis,
    tone: c.tone,
    source: c.source,
  }));

  return {
    offense: meta.filter(item => item.axis === 'offense').map(item => item.label),
    defense: meta.filter(item => item.axis === 'defense').map(item => item.label),
    meta: [...meta.filter(item => item.axis === 'offense'), ...meta.filter(item => item.axis === 'defense')],
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
      const gameTwoPct = game.fga2 > 0 ? (game.fgm2 / game.fga2) * 100 : 0;
      const seasonTwoPct = season.fga2 > 0 ? (season.fgm2 / season.fga2) * 100 : 0;
      const twoPctDelta = round(gameTwoPct - seasonTwoPct, 1);
      if (twoDelta >= 5) return { realized: true, reason: `2P fókusz +${twoDelta} pp` };
      if (ftDelta >= 6) return { realized: true, reason: `FTM rate +${ftDelta} pp` };
      if (twoPctDelta >= 6) return { realized: true, reason: `2P% +${twoPctDelta} pp` };
      break;
    }
    default: {
      // A `season.pointsFor` szezonösszeg – meccsátlaggal kell összevetni.
      const valDelta = round(game.pointsFor - season.pointsFor / Math.max(season.games, 1), 1);
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
    return delta >= 4
      ? `✓ ${flag} (FTM rate +${delta} pp)`
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

  // Standard, perc-normalizált USG% (0–1), ugyanaz, mint a játékosbontásban.
  const usageRates = computeUsageRates(players);

  players.forEach(player => {
    const usageShare = usageRates.get(player.playerId) ?? 0;
    const ts = computePlayerTrueShooting(player);
    const valPer36 = player.minutes > 0 ? (player.val / player.minutes) * 36 : 0;
    const hasReliableSample = player.minutes >= 8;

    if (usageShare >= USG_HIGH_MIN && player.val <= 5) negative.push(player.name);
    if (hasReliableSample && usageShare <= USG_LOW_MAX && (player.val >= 10 || (player.minutes >= 12 && valPer36 >= 18))) {
      positive.push(formatPositiveContributorLabel(player));
    }

    // Also include high-efficiency starters who played fewer minutes (e.g. foul trouble,
    // tactical substitution) but dominated their time (valPer36 ≥ 35, ts ≥ 0.65).
    const qualifiesOverperformer =
      (player.minutes >= 18 || (player.minutes >= 12 && valPer36 >= 35 && ts >= 0.65))
      && (player.val >= 18 || valPer36 >= 20)
      && (ts >= 0.55 || usageShare >= 0.2);

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
      && (ts <= 0.47 || usageShare >= 0.18);

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

/**
 * A következő meccsre kitűzött cél legnagyobb lépése (százalékpont, a
 * megjelenített mértékegységben). Egy meccsről a teljes liga-mediánig tartó
 * ugrás (pl. FT rate 23,7% → 42,1%) nem reális cél.
 */
const GOAL_MAX_STEP_PP: Record<string, number> = {
  turnover_rate: 3,
  efg: 4,
  three_pct: 5,
  assist_rate: 6,
  oreb_rate: 5,
  ft_rate: 6,
};

/** Előtag-alapú keresés: a listaelemek zárójeles számot is tartalmaznak. */
const hasItemStartingWith = (items: string[], ...prefixes: string[]) =>
  items.some(item => prefixes.some(prefix => item.startsWith(prefix)));

const buildStrengths = (
  game: NormalizedGameStats,
  season: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks,
  baseline: PostgameBaseline,
  shotMapComparison?: ShotMapComparison | null
) => {
  const strengths: string[] = [];
  const efgDelta = round(game.efg - season.efg, 1);
  const assistRateDelta = toPct(game.assistRate - season.assistRate, 1);
  const orebRateDelta = toPct(game.orebRate - season.orebRate, 1);
  const threePctDelta = round(game.threePct - season.threePct, 1);
  const twoRateDelta = toPct(game.twoRate - season.twoRate, 1);

  // Liga-referenciánál a szezon-delta sorok értelmetlenek; a lenti
  // liga-percentilis sorok adják az összevetést.
  if (baseline.kind === 'season') {
    if (efgDelta >= 3) strengths.push(`Dobáshatékonyság a szezonátlag felett (+${efgDelta} százalékpont)`);
    if (assistRateDelta >= 5) strengths.push(`Labdajáratás javult (+${assistRateDelta} százalékpont)`);
    if (orebRateDelta >= 5) strengths.push(`Támadólepattanózás erős (+${orebRateDelta} százalékpont)`);
    if (threePctDelta >= 4) strengths.push(`Erős 3P-hatékonyság (+${threePctDelta} százalékpont)`);
    if (twoRateDelta >= 6) strengths.push(`Festékből több befejezés (+${twoRateDelta} százalékpont)`);
  }

  if (scoreAbove(benchmarks, season, 'efg', game.efg, 60)
    && !hasItemStartingWith(strengths, 'Dobáshatékonyság a szezonátlag felett')) {
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
  baseline: PostgameBaseline,
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

  // A „visszaesett” jellegű sorok szezonbeli bázist feltételeznek.
  if (baseline.kind === 'season') {
    if (turnoverRateDelta >= 5) problems.push(`Sok labdaeladás (+${turnoverRateDelta} százalékpont TO rate)`);
    if (efgDelta <= -3) problems.push(`Dobáshatékonyság visszaesett (${efgDelta} százalékpont)`);
    if (assistRateDelta <= -5) problems.push(`Labdajáratás akadozott (${assistRateDelta} százalékpont)`);
    if (threePctDelta <= -4) problems.push(`Gyenge 3P-hatékonyság (${threePctDelta} százalékpont)`);
    if (twoRateDelta <= -6) problems.push(`Festékbefejezések visszaestek (${twoRateDelta} százalékpont)`);
    if (orebRateDelta <= -6) problems.push(`Második esély volumen visszaesett (${orebRateDelta} százalékpont OREB)`);
    if (ftRateDelta <= -6) problems.push(`Alacsony FTM rate (${ftRateDelta} százalékpont)`);
  }

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
    problems.push('FTM rate a liga alatt');
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
  strengths: string[],
  benchmarks: LeagueTeamBenchmarks
) => {
  const focus: string[] = [];

  const topicKey = (message: string) => {
    const lower = message.toLowerCase();
    if (lower.includes('ftm rate') || lower.includes('ft rate') || lower.includes('büntető')) return 'ft';
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

  /**
   * Célérték: a jelenlegi érték és a jobbik referencia (referencia / liga
   * medián) közötti sávban, meccsenként reális lépéskorláttal
   * (`GOAL_MAX_STEP_PP`). Ha a korlát vág, a teljes referencia zárójelben
   * látszik. Ha egyik referencia sem jobb a meccsértéknél, nincs önmagára
   * mutató cél, csak irány.
   */
  const formatGoal = (
    label: string,
    gameValue: number,
    referenceValue: number,
    stat: string,
    multiplier: number,
    direction: 'higher' | 'lower'
  ) => {
    const gameShown = round(gameValue * multiplier, 1);
    const league = getLeagueMedian(benchmarks, season, stat);
    const candidates = [referenceValue, league]
      .filter((value): value is number => value !== null && Number.isFinite(value) && value > 0)
      .map(value => round(value * multiplier, 1));
    const reference = candidates.length === 0
      ? null
      : direction === 'lower' ? Math.min(...candidates) : Math.max(...candidates);
    const improves = reference !== null && (direction === 'lower' ? reference < gameShown : reference > gameShown);
    if (!improves || reference === null) {
      return `${label} ${gameShown.toFixed(1)}% ${direction === 'lower' ? 'csökkentése' : 'növelése'}`;
    }
    const maxStep = GOAL_MAX_STEP_PP[stat] ?? Number.POSITIVE_INFINITY;
    const gap = Math.abs(reference - gameShown);
    if (gap <= maxStep) return `${label} ${gameShown.toFixed(1)}% → ${reference.toFixed(1)}%`;
    const target = round(direction === 'lower' ? gameShown - maxStep : gameShown + maxStep, 1);
    return `${label} ${gameShown.toFixed(1)}% → ${target.toFixed(1)}% (referencia ${reference.toFixed(1)}%)`;
  };

  if (hasItemStartingWith(problems, 'Sok labdaeladás', 'TO arány a liga felett')) {
    addFocus(
      formatFocusPlan(
        'Labdabiztonság stabilizálása',
        formatGoal('TO-rate', game.turnoverRate, season.turnoverRate, 'turnover_rate', 100, 'lower'),
        'egyszerűsített első passzok és korai döntések'
      )
    );
  }

  if (hasItemStartingWith(problems, 'Dobáshatékonyság visszaesett', 'Dobáshatékonyság a liga alatt')) {
    addFocus(
      formatFocusPlan(
        'Dobásminőség újrakalibrálása',
        formatGoal('eFG', game.efg, season.efg, 'efg', 1, 'higher'),
        'több festékből érkező befejezés és extra pass'
      )
    );
  }

  if (hasItemStartingWith(problems, 'Labdajáratás akadozott')) {
    addFocus(
      formatFocusPlan(
        'Playmaking ritmus',
        formatGoal('Assist-rate', game.assistRate, season.assistRate, 'assist_rate', 100, 'higher'),
        'short roll és skip-pass visszahozása'
      )
    );
  }

  if (hasItemStartingWith(problems, 'Gyenge 3P-hatékonyság', 'Periméter-hatékonyság a liga alatt')) {
    addFocus(
      formatFocusPlan(
        'Periméter fegyelem',
        formatGoal('3P%', game.threePct, season.threePct, 'three_pct', 1, 'higher'),
        'saroktriplák kialakítása, kevesebb erőltetett pull-up'
      )
    );
  }

  if (hasItemStartingWith(problems, 'Festékbefejezések visszaestek')) {
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
        formatGoal('OREB%', game.orebRate, season.orebRate, 'oreb_rate', 100, 'higher'),
        '4-5-ös posztok agresszívabb weakside crash-e'
      )
    );
  }

  const hasFtProblem = problems.some(item => item.includes('FTM rate') || item.includes('büntető'));
  if (hasFtProblem) {
    addFocus(
      formatFocusPlan(
        'Büntetők növelése',
        formatGoal('FTM rate', game.ftRate, season.ftRate, 'ft_rate', 100, 'higher'),
        'több kontaktkeresés az 1-3-asoktól és wedge setek'
      )
    );
  }

  if (hasItemStartingWith(strengths, 'Támadólepattanózás erős')) {
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
  const keyLabel = (key: string, fallback?: string) => fallback || X_FACTOR_LABELS[key] || key;
  const signed = (value: number) => `${value >= 0 ? '+' : ''}${round(value, 1)}`;
  const signedPct = (value: number) => `${value >= 0 ? '+' : ''}${toPct(value, 1)}%`;

  const evaluateOpponentMechanism = (key: string, label: string) => {
    switch (key) {
      case 'perimeter': {
        const delta = game.threePct - season.threePct;
        const realized = delta <= -4;
        return {
          label,
          realized,
          expectation: `${label}: a saját 3P-hatékonyságunk visszanyomása volt várható.`,
          actual: `${label}: 3P% ${season.threePct.toFixed(1)}% → ${game.threePct.toFixed(1)}% (${signed(delta)} pp).`,
          verdict: realized ? 'realizálódott' : 'nem realizálódott',
        };
      }
      case 'turnover': {
        const delta = game.turnoverRate - season.turnoverRate;
        const realized = delta >= 0.03;
        return {
          label,
          realized,
          expectation: `${label}: magasabb labdanyomás és több eladott labda volt várható.`,
          actual: `${label}: TO-rate ${toPct(season.turnoverRate, 1)}% → ${toPct(game.turnoverRate, 1)}% (${signedPct(delta)}).`,
          verdict: realized ? 'realizálódott' : 'nem realizálódott',
        };
      }
      case 'rebound': {
        const delta = game.orebRate - season.orebRate;
        const realized = delta <= -0.06;
        return {
          label,
          realized,
          expectation: `${label}: a támadólepattanóink visszaszorítása volt várható.`,
          actual: `${label}: OREB% ${toPct(season.orebRate, 1)}% → ${toPct(game.orebRate, 1)}% (${signedPct(delta)}).`,
          verdict: realized ? 'realizálódott' : 'nem realizálódott',
        };
      }
      case 'tempo': {
        const delta = game.pace - season.pace;
        const realized = delta <= -4;
        return {
          label,
          realized,
          expectation: `${label}: lassabb ritmus és kevesebb nyílt pályás helyzet volt várható.`,
          actual: `${label}: tempó ${season.pace.toFixed(1)} → ${game.pace.toFixed(1)} (${signed(delta)}).`,
          verdict: realized ? 'realizálódott' : 'nem realizálódott',
        };
      }
      case 'paint': {
        const twoDelta = game.twoRate - season.twoRate;
        const ftDelta = game.ftRate - season.ftRate;
        const gameTwoPct = game.fga2 > 0 ? (game.fgm2 / game.fga2) * 100 : 0;
        const seasonTwoPct = season.fga2 > 0 ? (season.fgm2 / season.fga2) * 100 : 0;
        const twoPctDelta = gameTwoPct - seasonTwoPct;
        const volumeSuppressed = twoDelta <= -0.05 || ftDelta <= -0.05;
        const efficiencyResisted = twoPctDelta <= 2;
        const realized = volumeSuppressed && efficiencyResisted;
        return {
          label,
          realized,
          expectation: `${label}: festékbe jutás és fault-kiharcolás csökkenése volt várható.`,
          actual: `${label}: 2P arány ${toPct(season.twoRate, 1)}% → ${toPct(game.twoRate, 1)}% (${signedPct(twoDelta)}), 2P% ${seasonTwoPct.toFixed(1)}% → ${gameTwoPct.toFixed(1)}% (${signed(twoPctDelta)} pp), FTM rate ${toPct(season.ftRate, 1)}% → ${toPct(game.ftRate, 1)}% (${signedPct(ftDelta)}).`,
          verdict: realized ? 'realizálódott' : 'nem realizálódott',
        };
      }
      default: {
        const delta = game.efg - season.efg;
        const realized = delta <= -3;
        return {
          label,
          realized,
          expectation: `${label}: a támadóhatékonyságunk csökkentése volt várható.`,
          actual: `${label}: eFG% ${season.efg.toFixed(1)}% → ${game.efg.toFixed(1)}% (${signed(delta)} pp).`,
          verdict: realized ? 'realizálódott' : 'nem realizálódott',
        };
      }
    }
  };

  const lines = ['**Ellenfél profil**'];
  const preGameEvaluations: Array<{
    label: string;
    realized: boolean;
    expectation: string;
    actual: string;
    verdict: string;
  }> = [];
  const descriptors: string[] = [];
  if (preGame) {
    const labels = [
      keyLabel(preGame.primaryKey, preGame.primaryLabel),
      preGame.secondaryKey
        ? keyLabel(preGame.secondaryKey, preGame.secondaryLabel)
        : null,
    ].filter(Boolean) as string[];
    if (labels.length > 0) {
      lines.push(`• Pre-game fókusz: ${labels.join(' + ')}.`);
      lines.push('• Meccs előtt várható hatás:');
      const primaryEval = evaluateOpponentMechanism(
        preGame.primaryKey,
        keyLabel(preGame.primaryKey, preGame.primaryLabel)
      );
      preGameEvaluations.push(primaryEval);
      lines.push(`• ${primaryEval.expectation}`);

      if (preGame.secondaryKey) {
        const secondaryEval = evaluateOpponentMechanism(
          preGame.secondaryKey,
          keyLabel(preGame.secondaryKey, preGame.secondaryLabel)
        );
        preGameEvaluations.push(secondaryEval);
        lines.push(`• ${secondaryEval.expectation}`);
      }

      lines.push('• Meccs után (realizáció):');
      preGameEvaluations.forEach(item => {
        lines.push(`• ${item.actual} Értékelés: ${item.verdict}.`);
      });

      const realizedCount = preGameEvaluations.filter(item => item.realized).length;
      const total = preGameEvaluations.length;
      const conclusion = realizedCount === total
        ? `${opponentName} védekező profilja teljes mértékben realizálódott, érdemben szűkítette a támadásunkat.`
        : realizedCount > 0
          ? `${opponentName} védekező profilja részben realizálódott (${realizedCount}/${total}), de több kulcsterületet nem tudott stabilan kontrollálni.`
          : `${opponentName} védekező profilja ezen a meccsen nem realizálódott; a saját támadóidentitásunk maradt domináns.`;
      lines.push(`• Következtetés: ${conclusion}`);
      return lines;
    }
  }

  const threeDelta = round(game.threePct - season.threePct, 1);
  if (threeDelta <= -4) descriptors.push(`periméter-limitálás (${game.threePct.toFixed(1)}% 3P vs ${season.threePct.toFixed(1)}%)`);
  const ftDelta = toPct(game.ftRate - season.ftRate, 1);
  if (ftDelta <= -5) descriptors.push(`kontakt-limitálás (${toPct(game.ftRate, 1)}% FTM rate vs ${toPct(season.ftRate, 1)}%)`);
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
  baseline: PostgameBaseline,
  ratings: PostgameRatings | null,
  preGame?: PreGameXFactorContext,
  reflectionLine?: string
) => {
  const refNoun = baseline.noun;
  const tempoText = !baseline.comparable
    ? 'viszonyítási alap nélkül'
    : context.paceDelta === 'Higher'
      ? 'gyorsabb'
      : context.paceDelta === 'Lower'
        ? 'lassabb'
        : `${refNoun} körüli`;

  const offenseText = !baseline.comparable
    ? 'viszonyítási alap nélkül'
    : context.offenseEfficiencyDelta === 'Higher'
      ? `a ${refNoun}nál hatékonyabb volt`
      : context.offenseEfficiencyDelta === 'Lower'
        ? `a ${refNoun}hoz képest visszaesett`
        : `${refNoun} körül teljesített`;

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
  const efgLine = baseline.comparable
    ? `${metrics.efg.toFixed(1)}% (${refNoun} ${season.efg.toFixed(1)}%, ${efgDelta >= 0 ? '+' : ''}${efgDelta} pp)`
    : `${metrics.efg.toFixed(1)}% eFG`;

  const signedOne = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}`;
  const ratingsLine = (() => {
    if (!ratings) return '';
    const refPart = ratings.refOrtg !== null && ratings.refDrtg !== null && ratings.refNet !== null
      ? ` – ${refNoun}: ORtg ${ratings.refOrtg.toFixed(1)}, DRtg ${ratings.refDrtg.toFixed(1)}, Net ${signedOne(ratings.refNet)}`
      : '';
    return `• Ratingek (pont/100 birtoklás): ORtg ${ratings.ortg.toFixed(1)}, DRtg ${ratings.drtg.toFixed(1)}, Net ${signedOne(ratings.net)}${refPart}.`;
  })();
  const causeLine = (() => {
    if (!ratings) return '';
    const direction = metrics.margin >= 0 ? 'az előnyt' : 'a hátrányt';
    switch (ratings.primaryCause) {
      case 'offense':
        return `• Fő ok: ${direction} elsősorban a támadás (ORtg) alakította.`;
      case 'defense':
        return `• Fő ok: ${direction} elsősorban a védekezés (DRtg) alakította.`;
      case 'balanced':
        return `• Fő ok: ${direction} a támadás és a védekezés együtt alakította.`;
      default:
        return '';
    }
  })();
  const sampleLine = baseline.smallSample
    ? `• Minta: ${baseline.seasonGames} szezonmeccs – kis minta, a referencia: ${baseline.label}.`
    : '';

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
      lines.push(`• Gyenge meccs: ${playerImpact.underperformers.map(name => formatPlayerContext(name, 'under')).join(', ')}.`);
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
    ratingsLine,
    `• Margin: ${metrics.margin > 0 ? '+' : ''}${metrics.margin.toFixed(1)} (${marginLabel}).`,
    causeLine,
    sampleLine,
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

/** `refNoun === null`: nincs viszonyítási alap, a szöveg nem hivatkozik referenciára. */
const interpretGameContext = (context: PostGameReport['context'], refNoun: string | null) => {
  if (refNoun === null) {
    return 'Kis szezonminta és liga benchmark hiányában a tempó és a hatékonyság nem vethető össze referenciával.';
  }
  const tempoText = context.paceDelta === 'Higher'
    ? `A csapat a ${refNoun}nál gyorsabb tempót diktált`
    : context.paceDelta === 'Lower'
      ? `A mérkőzés tempója a ${refNoun}nál lassabb volt`
      : `A tempó a ${refNoun} körül mozgott`;

  const offenseText = context.offenseEfficiencyDelta === 'Higher'
    ? `támadásban a ${refNoun}nál hatékonyabb megoldásokat talált`
    : context.offenseEfficiencyDelta === 'Lower'
      ? `támadásban a ${refNoun}hoz képest visszaesett a hatékonyság`
      : `támadásban a ${refNoun} körüli hatékonyság érvényesült`;

  const defenseText = context.defenseEfficiencyDelta === 'Higher'
    ? `védekezésben a ${refNoun}nál stabilabb teljesítményt hozott`
    : context.defenseEfficiencyDelta === 'Lower'
      ? `védekezésben a ${refNoun}hoz képest gyengébb kontrollt mutatott`
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
    ? `Gyenge meccs: ${impact.underperformers.join(', ')}.`
    : '';

  return [positiveText, negativeText, overText, underText].filter(Boolean).join(' ');
};

const interpretStrengths = (strengths: string[]) => {
  const filtered = strengths.filter(item => item.includes('szezonátlag felett') || item.includes('liga felett'));
  if (filtered.length === 0) return 'Erősségek: nem volt stabil, szezon- vagy liga feletti mutató.';
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
    if (item.includes('FTM rate') || item.includes('büntető')) return 'büntető kiharcolási volumen és kontaktusmenedzsment';
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
  const refNoun = report.baseline?.noun ?? 'szezonátlag';
  const comparable = report.baseline?.comparable ?? true;
  const tempoText = !comparable
    ? 'referencia nélkül értékelhető tempó'
    : report.context.paceDelta === 'Higher'
      ? 'gyorsabb tempó'
      : report.context.paceDelta === 'Lower'
        ? 'lassabb tempó'
        : `${refNoun} körüli tempó`;
  const decisiveCore = decisiveText.split('.').shift()?.trim() || 'Komplex mérkőzéskép';
  const focusCore = nextFocusText.replace('Következő fókusz: ', '').replace(/ /g, '');
  const reflectionFragment = [report.reflection?.xFactor, report.reflection?.risk].filter(Boolean).join(' ');
  const reflectionText = reflectionFragment ? ` ${reflectionFragment}` : '';
  return `${report.teamName} ${report.result === 'win' ? 'megnyerte' : 'elveszítette'} a mérkőzést ${report.opponentName} ellen ${tempoText} mellett. ${decisiveCore}. ${focusCore}${reflectionText}`.trim();
};

export const interpretPostGameReport = (report: PostGameReport): PostGameInterpretation => {
  const gameContext = interpretGameContext(
    report.context,
    report.baseline && !report.baseline.comparable ? null : report.baseline?.noun ?? 'szezonátlag'
  );
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

/**
 * ORtg / DRtg / Net a meccs közös birtoklásszámából (`game.pace`, a két csapat
 * becslésének átlaga), így a tempó és mindkét rating egy nevezőn áll, és a
 * DRtg megegyezik az ellenfél ORtg-jével.
 */
const buildRatings = (
  game: NormalizedGameStats,
  season: NormalizedTeamStats,
  baseline: PostgameBaseline
): PostgameRatings | null => {
  const possessions = game.pace;
  if (!(possessions > 0)) return null;

  const ortg = round((game.pointsFor / possessions) * 100, 1);
  const drtg = round((game.pointsAgainst / possessions) * 100, 1);
  const net = round(ortg - drtg, 1);
  // Viszonyítási alap nélkül a referencia maga a meccs – nem mutatunk eltérést.
  const refOrtg = baseline.comparable && season.ortg > 0 ? round(season.ortg, 1) : null;
  const refDrtg = baseline.comparable && season.drtg > 0 ? round(season.drtg, 1) : null;
  const refNet = refOrtg !== null && refDrtg !== null ? round(refOrtg - refDrtg, 1) : null;

  // Pozitív eltérés = a referenciánál jobb (támadásban több, védekezésben kevesebb pont).
  let primaryCause: PostgameRatings['primaryCause'] = 'unknown';
  if (refOrtg !== null && refDrtg !== null) {
    const offenseDev = ortg - refOrtg;
    const defenseDev = refDrtg - drtg;
    if (Math.abs(offenseDev - defenseDev) < 5) {
      primaryCause = 'balanced';
    } else if (net >= 0) {
      primaryCause = offenseDev > defenseDev ? 'offense' : 'defense';
    } else {
      primaryCause = offenseDev < defenseDev ? 'offense' : 'defense';
    }
  }

  return {
    possessions: round(possessions, 1),
    ortg,
    drtg,
    net,
    refPossessions: baseline.comparable && season.pace > 0 ? round(season.pace, 1) : null,
    refOrtg,
    refDrtg,
    refNet,
    primaryCause,
  };
};

/**
 * A dobástérkép dobásszámának egyeztetése a box score FGA-jával. Eltérésnél a
 * dobástérkép hiányos (pl. kimaradt események), így a zóna- és 3P-adatai
 * nem egyeznek a box score-ral – ezt a riport jelzi. Nagy (>10%) hiánynál a
 * dobástérkép-alapú erősség/probléma sorok sem megbízhatók.
 */
const validateShotMap = (summary: TeamShotMapSummary | null, game: NormalizedGameStats) => {
  if (!summary || !(game.fga > 0)) return { notes: [] as string[], reliable: Boolean(summary) };
  const notes: string[] = [];
  const diff = summary.attempts - game.fga;
  const relative = Math.abs(diff) / game.fga;
  if (Math.abs(diff) >= 3 || relative >= 0.05) {
    notes.push(
      `Dobástérkép hiányos: ${summary.attempts} dobás a box score ${game.fga} mezőnykísérletével szemben (${diff > 0 ? '+' : ''}${diff}); a dobástérkép zóna- és 3P-adatai (3P% ${summary.threePct.toFixed(1)}%) csak tájékoztatók, a box score 3P% ${game.threePct.toFixed(1)}%.`
    );
  } else {
    const shotMapThreeAttempts = Math.round((summary.threeRate / 100) * summary.attempts);
    if (Math.abs(shotMapThreeAttempts - game.fga3) >= 3) {
      notes.push(
        `Dobástérkép 3P-besorolás eltér: ${shotMapThreeAttempts} tripla a box score ${game.fga3} hárompontos kísérletével szemben – a zónaadatok tájékoztatók.`
      );
    }
  }
  return { notes, reliable: relative <= 0.1 };
};

const buildOpponentShooting = (opponent: NormalizedGameStats | null): PostgameOpponentShooting | null => {
  if (!opponent) return null;
  return {
    efg: round(opponent.efg, 1),
    fgm3: opponent.fgm3,
    fga3: opponent.fga3,
    threePct: round(opponent.threePct, 1),
    ftRate: toPct(opponent.ftRate, 1),
    orebRate: toPct(opponent.orebRate, 1),
    turnoverRate: toPct(opponent.turnoverRate, 1),
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
    metric('turnover_rate', 'TO rate (Oliver)', game.turnoverRate, season.turnoverRate, 'pct', 100),
    metric('oreb_rate', 'OREB%', game.orebRate, season.orebRate, 'pct', 100),
    metric('ft_rate', 'FTM rate', game.ftRate, season.ftRate, 'pct', 100),
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
      label: 'FTM arány',
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

  const ownGame = normalizeTeamGame(calibratedTeamGame, calibratedOpponent);
  const opponentRaw = opponentGame ? normalizeTeamGame(calibratedOpponent, calibratedTeamGame) : null;
  // Közös birtoklásszám mindkét oldalon: a tempó és mindkét rating nevezője.
  const sharedPace = opponentRaw ? round(sharedPossessions(ownGame.pace, opponentRaw.pace), 2) : ownGame.pace;
  const game: NormalizedGameStats = { ...ownGame, pace: sharedPace };
  const opponent: NormalizedGameStats | null = opponentRaw ? { ...opponentRaw, pace: sharedPace } : null;
  // A `season` innentől a referencia: szezonátlag, vagy kis mintánál liga medián.
  const { reference: season, baseline } = resolveBaseline(normalizeTeamSeason(teamSeason), leagueBenchmarks);

  const paceDelta = classifyDelta(game.pace - season.pace, 2.5);
  const offenseDelta = classifyDelta(game.efg - season.efg, 2.5);
  const leagueMedianEfg = getBenchmarkThreshold(leagueBenchmarks, season, 'efg', 'P50');
  const defenseReferenceEfg = Number.isFinite(leagueMedianEfg) && leagueMedianEfg > 0
    ? leagueMedianEfg
    : season.efg;
  const defenseDelta = opponent
    ? classifyDelta(defenseReferenceEfg - opponent.efg, 2.5)
    : 'Similar';

  const decisiveResult = buildDecisiveFactors(game, opponent, season, baseline, leagueBenchmarks);
  const decisive = { offense: decisiveResult.offense, defense: decisiveResult.defense };
  const decisiveAnnotations = {
    annotated: {
      offense: decisiveResult.meta.filter(item => item.axis === 'offense').map(item => item.annotated),
      defense: decisiveResult.meta.filter(item => item.axis === 'defense').map(item => item.annotated),
    },
    meta: decisiveResult.meta,
  };
  const playerImpact = analyzePlayerImpact(players);
  const gameShotSummary = shotMapContext?.gameShots?.length
    ? buildTeamShotMapSummary(shotMapContext.gameShots)
    : null;
  const seasonShotSummary = shotMapContext?.seasonShots?.length
    ? buildTeamShotMapSummary(shotMapContext.seasonShots)
    : null;
  const shotMapValidation = validateShotMap(gameShotSummary, game);
  const shotMapComparison = gameShotSummary && seasonShotSummary && shotMapValidation.reliable
    ? buildShotMapComparison(gameShotSummary, seasonShotSummary)
    : null;

  const playerShotMapContext = shotMapContext?.gameShots?.length
    ? buildPlayerShotMapContext(shotMapContext.gameShots)
    : undefined;

  const playerReport = buildPlayerPostGameReport(players, playerShotMapContext);
  const strengths = buildStrengths(game, season, leagueBenchmarks, baseline, shotMapComparison);
  const problems = buildProblems(game, season, leagueBenchmarks, baseline, shotMapComparison);
  const nextFocus = buildNextFocus(game, season, problems, strengths, leagueBenchmarks);
  const xFactorReflection = buildXFactorReflection(preGameContext, game, season, opponent, decisiveAnnotations.meta);
  const combinedReflection = [xFactorReflection.line, xFactorReflection.riskLine].filter(Boolean).join(' ');

  const metricsSummary = buildPostgameMetrics(game, season, leagueBenchmarks);
  const ratings = buildRatings(game, season, baseline);
  const opponentShooting = buildOpponentShooting(opponent);

  const result: 'win' | 'loss' =
    teamGame.result ?? (actualPointsFor >= actualPointsAgainst ? 'win' : 'loss');

  const dataNotes = [
    ...(opponent ? [] : ['Ellenfél statisztikák nem elérhetők, a védekező értékelés korlátozott.']),
    ...shotMapValidation.notes,
  ];

  return {
    teamId: teamGame.teamId,
    teamName: teamGame.teamName,
    opponentName: opponentGame?.teamName || opponentFallback.teamName,
    league: teamGame.league,
    season: teamGame.season,
    result,
    baseline,
    metrics: {
      pointsFor: metricsSummary.pointsFor,
      pointsAgainst: metricsSummary.pointsAgainst,
      margin: metricsSummary.margin,
      pace: metricsSummary.pace,
      efg: metricsSummary.efg,
      keyStats: metricsSummary.keyStats,
      ratings,
      opponent: opponentShooting,
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
      baseline,
      ratings,
      preGameContext,
      combinedReflection
    ),
  };
};

// ---------------------------------------------------------------------------
// Kosarstat-kiegészítés
//
// A kosarstat importból (negyedek, csapatmetrikák, clutch) szabályalapú
// erősség / probléma / fókusz sorok és adatmegjegyzések készülnek, amelyeket a
// `mergeKosarstatPostgameContext` fűz rá az `analyzePostGameReport` riportjára.
// Tiszta függvények: a lekérdezés a hívó (web / mobil) dolga.
// ---------------------------------------------------------------------------

export type KosarstatTeamSide = 'home' | 'away' | 'unknown' | null;

export type KosarstatQuarterStatRow = {
  team_name?: string | null;
  team_side?: KosarstatTeamSide;
  quarter?: number | null;
  points?: number | null;
  cumulative_points?: number | null;
};

export type KosarstatTeamMetricRow = {
  team_name?: string | null;
  team_side?: KosarstatTeamSide;
  poss?: number | null;
  ortg?: number | null;
  efg?: number | null;
  tov_pct?: number | null;
  orb_pct?: number | null;
  ftm_rate?: number | null;
};

/**
 * A clutch-blokkból a szabályokhoz szükséges minimum. A
 * `kosarstat-clutch-parse` `KosarstatGameClutch` típusa kielégíti, és a webes
 * bővebb clutch-alak is – a generikus paraméter megőrzi a hívó típusát.
 */
export type PostgameClutchInput = {
  available: boolean;
  sampleLabel: string;
  ownPoints: number;
  oppPoints: number;
  diff: number;
  ownTurnovers: number;
  oppTurnovers: number;
};

export type PostgameTurnoverType = { type: string; count: number };

export type PostgameQuarterDiffRow = {
  quarter: number;
  ownPoints: number;
  oppPoints: number;
  diff: number;
  cumulativeDiff: number | null;
};

export type KosarstatPostgameInput<C extends PostgameClutchInput = PostgameClutchInput> = {
  /** A saját csapat oldala a kosarstat sorokban (`games.home_away` alapján). */
  ownSide: 'home' | 'away';
  /** A saját csapat neve – tartalék párosítás, ha a `team_side` hiányzik. */
  teamName?: string | null;
  quarterStats: KosarstatQuarterStatRow[];
  teamMetrics: KosarstatTeamMetricRow[];
  clutch?: C | null;
  turnoverTypes?: PostgameTurnoverType[];
  /** Import-állapot megjegyzés, ha nincs értelmezhető clutch blokk. */
  clutchImportNote?: string | null;
};

export type KosarstatPostgameContext<C extends PostgameClutchInput = PostgameClutchInput> = {
  quarterDiffRows: PostgameQuarterDiffRow[];
  ownMetrics: KosarstatTeamMetricRow | null;
  oppMetrics: KosarstatTeamMetricRow | null;
  clutch: C | null;
  turnoverTypes: PostgameTurnoverType[];
  strengths: string[];
  problems: string[];
  nextFocus: string[];
  insightNotes: string[];
};

const normalizeKosarstatTeamKey = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const finiteOrNull = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

export const buildKosarstatPostgameContext = <C extends PostgameClutchInput = PostgameClutchInput>(
  input: KosarstatPostgameInput<C> | null
): KosarstatPostgameContext<C> => {
  if (!input) {
    return {
      quarterDiffRows: [],
      ownMetrics: null,
      oppMetrics: null,
      clutch: null,
      turnoverTypes: [],
      strengths: [],
      problems: [],
      nextFocus: [],
      insightNotes: [],
    };
  }

  const ownSide = input.ownSide;
  const oppSide = ownSide === 'home' ? 'away' : 'home';
  const ownNeedle = normalizeKosarstatTeamKey(input.teamName || '');

  const bySideOrName = <T extends { team_side?: KosarstatTeamSide; team_name?: string | null }>(
    rows: T[],
    side: 'home' | 'away'
  ) => {
    const bySide = rows.filter(row => row.team_side === side);
    if (bySide.length > 0) return bySide;
    if (!ownNeedle) return [] as T[];
    return rows.filter(row => normalizeKosarstatTeamKey(String(row.team_name || '')).includes(ownNeedle));
  };

  const quarterRows = Array.isArray(input.quarterStats)
    ? input.quarterStats.filter(row => Number.isFinite(Number(row.quarter)) && Number(row.quarter) >= 1 && Number(row.quarter) <= 4)
    : [];
  const ownQuarterRows = bySideOrName(quarterRows, ownSide);
  const oppQuarterRowsBySide = quarterRows.filter(row => row.team_side === oppSide);
  const ownQuarterSet = new Set(
    ownQuarterRows.map(row => normalizeKosarstatTeamKey(String(row.team_name || ''))).filter(Boolean)
  );
  const oppQuarterRows = oppQuarterRowsBySide.length > 0
    ? oppQuarterRowsBySide
    : quarterRows.filter(row => {
        const nameKey = normalizeKosarstatTeamKey(String(row.team_name || ''));
        return nameKey && !ownQuarterSet.has(nameKey);
      });

  const firstByQuarter = (rows: KosarstatQuarterStatRow[]) => {
    const map = new Map<number, KosarstatQuarterStatRow>();
    rows.forEach(row => {
      const quarter = Number(row.quarter);
      if (!Number.isFinite(quarter) || map.has(quarter)) return;
      map.set(quarter, row);
    });
    return map;
  };
  const ownByQuarter = firstByQuarter(ownQuarterRows);
  const oppByQuarter = firstByQuarter(oppQuarterRows);

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
        ? round(ownCumulative - oppCumulative, 0)
        : null;

      return {
        quarter,
        ownPoints: round(ownPoints, 0),
        oppPoints: round(oppPoints, 0),
        diff: round(ownPoints - oppPoints, 0),
        cumulativeDiff,
      };
    })
    .filter((row): row is PostgameQuarterDiffRow => Boolean(row));

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

  const metricRows = Array.isArray(input.teamMetrics) ? input.teamMetrics : [];
  const ownMetric = bySideOrName(metricRows, ownSide)[0] ?? null;
  const oppMetric = metricRows.find(row => row.team_side === oppSide)
    ?? metricRows.find(row => {
      const nameKey = normalizeKosarstatTeamKey(String(row.team_name || ''));
      const ownName = normalizeKosarstatTeamKey(String(ownMetric?.team_name || ''));
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

  const ownEfg = finiteOrNull(ownMetric?.efg);
  const oppEfg = finiteOrNull(oppMetric?.efg);
  if (ownEfg !== null && oppEfg !== null) {
    const diff = round(ownEfg - oppEfg, 1);
    if (diff >= 4) {
      strengths.push(`Kosarstat eFG különbség: ${diff > 0 ? '+' : ''}${diff} pp előny.`);
    } else if (diff <= -4) {
      problems.push(`Kosarstat eFG különbség: ${diff} pp hátrány.`);
      nextFocus.push('Dobásminőség: jobb spacing és magasabb minőségű első opciós dobások.');
    }
  }

  // A Kosarstat TO% (LV / birtoklás) szándékosan nem kerül a riport
  // erősség/probléma soraiba: a riport egyetlen TO-definíciója az Oliver-féle
  // LV / (FGA + 0,44·FTA + LV); a Kosarstat érték csak a nyers blokkban látszik.

  const ownOrb = finiteOrNull(ownMetric?.orb_pct);
  const oppOrb = finiteOrNull(oppMetric?.orb_pct);
  if (ownOrb !== null && oppOrb !== null) {
    const diff = round(ownOrb - oppOrb, 1);
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
    insightNotes.push('Kosarstat team-metric blokk integrálva (POSS/ORTG/eFG/ORB%/FTM rate; a Kosarstat TO% = LV/birtoklás csak a nyers blokkban).');
  }

  const clutch = input.clutch ?? null;
  const turnoverTypes = input.turnoverTypes ?? [];

  if (!clutch?.available && input.clutchImportNote) {
    insightNotes.push(input.clutchImportNote);
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
};

/** Sorrendtartó összefűzés, kis-/nagybetűre és szóközre érzéketlen dedup-pal. */
const mergeUniqueLines = (base: string[], extra: string[]) => {
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

/**
 * A kosarstat-kiegészítés ráfűzése az `analyzePostGameReport` riportjára.
 * `extraNotes`: a hívó import-állapot megjegyzései (a `dataNotes` elé kerülnek
 * a kontextus `insightNotes`-a előtt). `lineupInsights`: a webes lineup-elemzés
 * eredménye, ha van. Ha nincs mit hozzáadni, a riport változatlanul tér vissza.
 */
export const mergeKosarstatPostgameContext = (
  report: PostGameReport,
  context: KosarstatPostgameContext,
  options: {
    extraNotes?: string[];
    lineupInsights?: PostGameReport['lineupInsights'];
  } = {}
): PostGameReport => {
  const extraNotes = options.extraNotes ?? [];
  const lineupInsights = options.lineupInsights;

  if (
    extraNotes.length === 0 &&
    !lineupInsights &&
    context.strengths.length === 0 &&
    context.problems.length === 0 &&
    context.nextFocus.length === 0 &&
    context.insightNotes.length === 0
  ) {
    return report;
  }

  return {
    ...report,
    dataNotes: mergeUniqueLines(report.dataNotes, [...extraNotes, ...context.insightNotes]),
    strengths: mergeUniqueLines(report.strengths, context.strengths),
    problems: mergeUniqueLines(report.problems, context.problems),
    nextFocus: mergeUniqueLines(report.nextFocus, context.nextFocus),
    lineupInsights,
  };
};
