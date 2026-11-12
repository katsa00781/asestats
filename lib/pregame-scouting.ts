import type { TeamOpponentBox } from './team-analysis';
import { parsePositionBuckets, type Position } from './positions';
import { DEFENSE_STYLE_LABELS, OFFENSE_STYLE_LABELS, finalizeDefenseStyle, finalizeOffenseStyle } from './style-vocabulary';
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
  /**
   * Az ellenfelek box score-ja a párosított meccseken (lásd
   * `team-analysis.ts` `buildOpponentBoxTotals`). Hiányában az OREB% nem
   * számolható, a tempó pedig csak a saját birtoklásbecslés.
   */
  opponent?: TeamOpponentBox;
};

export type PlayerSeasonStat = {
  playerId: string;
  name: string;
  position: Position;
  positionLabel?: string;
  positionBuckets?: Position[];
  heightCm?: number;
  games: number;
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

export type ShotZoneKey = 'rim' | 'paint' | 'mid' | 'corner3' | 'aboveBreak3';

export type ShotZoneStats = {
  attempts: number;
  made: number;
  pct: number;
};

export type ShotProfileSummary = {
  attempts: number;
  made: number;
  fgPct: number;
  zoneStats: Record<ShotZoneKey, ShotZoneStats>;
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

export type PositionComparison = {
  position: Position;
  ownValPer36: number;
  oppValPer36: number;
  ownPointsPer36: number;
  oppPointsPer36: number;
  deltaValPer36: number;
  matchupFlag?: 'critical_disadvantage' | 'clear_advantage';
};

export type ScoutingReportLLMContext = {
  opponentTempoDescriptor: string;
  ownTempoDescriptor: string;
  opponentDominantAxis: 'transition' | 'periméter' | 'festék';
  /** A két csapat közti legnagyobb standardizált eltérés tengelye (lásd `getMatchupAxis`). */
  matchupAxis?: MatchupAxis;
  tempoControlNote?: string;
  matchupRealizationNote?: string;
  riskNote?: string;
  varianceDrivers: string[];
  positionDeltaSummary: {
    perimeterDelta: number;
    frontcourtDelta: number;
  };
  significantMatchups: Array<{
    position: Position;
    deltaValPer36: number;
    matchupFlag?: PositionComparison['matchupFlag'];
  }>;
  confidenceReasons?: string[];
  shotProfileNotes?: string[];
  shotDefenseNotes?: string[];
};

export type AdvancedPlayerStat = {
  playerId: string;
  name: string;
  position: Position;
  minutes: number;
  minutesPerGame: number;
  valPer36: number;
  pointsPer36: number;
  proxyPer: number;
  /** `null`, ha a csapat tényleges győzelemszáma nem ismert (nincs mérkőzés-kontextus). */
  proxyWinShare: number | null;
};

export type AdvancedPlayerEligibility = {
  minTotalMinutes: number;
  minMinutesPerGame: number;
  minEligibleGames: number;
};

export type XFactorImpact = {
  primaryDeltaPct: number;
  secondaryDeltaPct: number;
  combinedDeltaPct: number;
  /**
   * A kontrollált forgatókönyv tényleges eltolása az alaphoz képest (pp): a
   * `combinedDeltaPct`, a 8–92%-os valószínűségi sávra vágva. Ezt mutatja a
   * forgatókönyv-tábla és az X-faktor mondat is – egyetlen forrás.
   */
  controlledScenarioDeltaPct?: number;
  /** Igaz, ha a sáv széle miatt a tényleges eltolás kisebb a modellhatásnál. */
  controlledScenarioCapped?: boolean;
};

/** A kockázati tábla alapsora, ha egyetlen kockázati trigger sem aktív. */
export const BASELINE_RISK_SCENARIO_TITLE = 'Alapforgatókönyv – nincs kockázati trigger';

/**
 * A győzelmi valószínűség log-odds modellje. Minden korrekció logitban adódik
 * össze; a megjelenített érték puha sávba kerül (3–97%), kemény vágás nincs,
 * így a korrekciók magas alapnál is látszanak.
 */
const logit = (p: number) => Math.log(p / (1 - p));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const SHOWN_PROB_FLOOR = 0.03;
const SHOWN_PROB_SPAN = 0.94;
/** Logit → megjelenített saját győzelmi esély (%), puha 3–97%-os sávban. */
const toShownPct = (z: number) => round((SHOWN_PROB_FLOOR + SHOWN_PROB_SPAN * sigmoid(z)) * 100, 1);
/** Az „50%-nál ennyi pp” modellhatás logitban (dp/dz = 0,25 50%-nál). */
const ppAtEvenToLogit = (pp: number) => pp / 25;
/** A rating-különbség → logit osztója (a korábbi `1/(1+e^(−diff/18))`). */
const RATING_LOGIT_DIVISOR = 18;
/** A pozíciós matchup: súlyozott VAL/36-különbség egységenként ennyi logit (≈10 pp 50%-nál). */
const MATCHUP_LOGIT_SCALE = 0.4;
const MATCHUP_LOGIT_CAP = 0.6;
/** A hazai pálya logit-plafonja (≈ ±6 pp 50%-nál). */
const HOME_LOGIT_CAP = 0.24;
/** Hiányzók: a kieső VAL/meccs csapat-VAL arányának szorzója logitban. */
const INJURY_LOGIT_SCALE = 2.5;
const INJURY_SHARE_CAP = 0.6;

/** A győzelmi valószínűség lépésenkénti bontása (megjelenített %, illetve logit). */
export type WinProbabilityBreakdown = {
  basePct: number;
  afterMatchupPct: number;
  afterHomePct: number;
  finalPct: number;
  baseLogit: number;
  matchupLogit: number;
  homeLogit: number;
  injuryLogit: number;
  finalLogit: number;
};

export type ScenarioOutcome = {
  key: string;
  label: string;
  ownPct: number;
  opponentPct: number;
  deltaVsBase: number;
  note: string;
};

export type RiskScenario = {
  title: string;
  trigger: string;
  instantResponse: string;
  estimatedOwnSwingPct: number;
};

export type FanSummary = {
  headline: string;
  keyEdges: string[];
  majorRisks: string[];
  gamePlan: string[];
  fallbackPlan: string[];
};

export type CalibrationDimension = {
  key: string;
  label: string;
  score: number;
  note: string;
  context?: string;
};

export type CalibrationDiagnostics = {
  overallIntensity: number;
  scaleLabel?: string;
  summary?: string;
  dimensions: CalibrationDimension[];
};

type KeyPlayerGroups = {
  primaryScorers: string[];
  primaryPlaymakers: string[];
  stretchThreats: string[];
  mismatchCandidates: string[];
};

export type ScoutingReport = {
  ownTeamId: string;
  ownTeamName: string;
  opponentTeamId: string;
  opponentTeamName: string;
  league: string;
  season: string;
  winProbability: {
    ownPct: number;
    opponentPct: number;
    predictedWinner: 'own' | 'opponent' | 'even';
    confidence: 'Low' | 'Medium' | 'High';
    confidenceReasons: string[];
    /** Alap → +matchup → +hazai → ±hiányzók → végső (log-odds lánc). */
    breakdown?: WinProbabilityBreakdown;
  };
  positionComparison: PositionComparison[];
  profile: {
    tempo: string;
    offense: string[];
    defense: string[];
  };
  ownTeamProfile?: {
    tempo: string;
    offense: string[];
    defense: string[];
  };
  threats: string[];
  vulnerabilities: string[];
  keyPlayers: KeyPlayerGroups;
  ownKeyPlayers: KeyPlayerGroups;
  focusPoints: string[];
  xFactorContext?: PreGameXFactorContext;
  xFactorImpact?: XFactorImpact;
  scenarioOutcomes?: ScenarioOutcome[];
  riskScenarios?: RiskScenario[];
  fanSummary?: FanSummary;
  calibrationDiagnostics?: CalibrationDiagnostics;
  advancedPlayers?: {
    own: AdvancedPlayerStat[];
    opponent: AdvancedPlayerStat[];
  };
  advancedPlayersEligibility?: {
    own: AdvancedPlayerEligibility;
    opponent: AdvancedPlayerEligibility;
  };
  riskFlags?: string[];
  injuryContext?: {
    own: string[];
    opponent: string[];
  };
  positionComparisonNote?: string;
  llmContext?: ScoutingReportLLMContext;
  shotProfileContext?: {
    ownZones: PregameShotZone[];
    opponentZones: PregameShotZone[];
    ownAllowedZones: PregameShotZone[];
    opponentAllowedZones: PregameShotZone[];
    ownTopZones: PregameShotZone[];
    opponentTopZones: PregameShotZone[];
    ownDefensePressureZones: PregameShotZone[];
    opponentDefensePressureZones: PregameShotZone[];
    clashZones: string[];
    notes: string[];
    defenseNotes: string[];
  };
  /**
   * Csapatszintű mutatók (%-ban). Az `orebRate` `null`, ha nincs párosított
   * (mindkét oldali box score-os) meccs; a `paceFromOwnOnly` jelzi, hogy a tempó
   * ellenfél-birtoklás nélkül, csak a saját becslésből jön.
   */
  teamStats?: {
    own: PregameTeamStatLine;
    opponent: PregameTeamStatLine;
  };
  matchContext?: PregameMatchContext;
  injuryImpact?: { own: PregameInjuryImpactReport; opponent: PregameInjuryImpactReport };
  /** A PER* skála viszonyítási pontja: a liga percekkel súlyozott PER*-átlaga. */
  leagueProxyPerAverage?: number | null;
  summary: string;
};

/**
 * Egy dobászóna összesítője a liga-átlaghoz mérve. `rate` = a zóna aránya a
 * kísérletekből (%), `pct` = nyers FG% a zónában, `pctShrunk` = a liga felé
 * húzott FG% (kis mintán a nyers érték irreális lehet), `pps` = pont / dobás a
 * shrinkelt FG%-ból (2P zóna 2×, tripla 3×). A Δ mezők a liga ugyanezen értékétől vett eltérések
 * (`rate`, `pct`: százalékpont; `pps`: pont / dobás).
 */
export type PregameShotZone = {
  key: ShotZoneKey;
  label: string;
  attempts: number;
  rate: number;
  pct: number;
  /** A liga zóna-FG%-a felé húzott (Bayes-shrink, K = 20 kísérlet) FG%. */
  pctShrunk: number;
  /** Pont / dobás a shrinkelt FG%-ból. */
  pps: number;
  rateDeltaVsLeague: number;
  /** A nyers FG% eltérése a ligától (kijelzés). */
  pctDeltaVsLeague: number;
  /** A shrinkelt FG% eltérése a ligától (a jegyzetek ebből dolgoznak). */
  pctShrunkDeltaVsLeague: number;
  ppsDeltaVsLeague: number;
};

export type PregameTeamStatLine = {
  pace: number;
  paceFromOwnOnly: boolean;
  efg: number;
  threeRate: number;
  threePct: number;
  turnoverRate: number;
  ftRate: number;
  orebRate: number | null;
  assistRate: number;
};

/** Egy bajnoki fixture (`league_fixtures`) a mérkőzés-kontextushoz. */
export type PregameFixture = {
  homeTeamId: string;
  awayTeamId: string;
  date: string;
  homeScore: number | null;
  awayScore: number | null;
};

export type PregameTeamRecord = {
  wins: number;
  losses: number;
  homeWins: number;
  homeLosses: number;
  awayWins: number;
  awayLosses: number;
  /** Az utolsó (legfeljebb 5) eredmény, a legrégebbitől a legfrissebbig. */
  last5: Array<'W' | 'L'>;
};

export type PregameHeadToHeadGame = {
  date: string;
  venue: 'home' | 'away';
  ownScore: number;
  opponentScore: number;
};

/**
 * A meccs körülményei: pályaválasztó, mérlegek, forma, egymás elleni
 * eredmények és a liga hazai győzelmi aránya. Történeti nézetben csak a
 * meccs előtti eredmények számítanak (`beforeDate`).
 */
export type PregameMatchContext = {
  venue: 'home' | 'away' | 'unknown';
  matchDate: string | null;
  ownRecord: PregameTeamRecord;
  opponentRecord: PregameTeamRecord;
  headToHead: PregameHeadToHeadGame[];
  /** A liga hazai győzelmi aránya (%) a figyelembe vett meccseken; `null`, ha nincs minta. */
  leagueHomeWinPct: number | null;
  leagueGames: number;
  /**
   * A saját győzelmi esély hazai pálya korrekciója logitban (előjeles):
   * `logit(zsugorított liga hazai gy%)`, ±0,24-re vágva. A tényleges pp-hatás a
   * `winProbability.breakdown`-ban van (az alaptól függ).
   */
  homeLogit: number;
};

/**
 * A hiányzók kieső termelése meccsátlagban, a játékperccel természetesen
 * súlyozva (VAL/meccs = VAL/36 × perc/meccs ÷ 36). `status`: `marked` = van
 * megjelölt hiányzó; `confirmedNone` = a keret ellenőrizve, nincs hiányzó;
 * `unknown` = nincs adat (nem ellenőrzött, nincs megjelölés).
 */
export type PregameInjuryImpact = {
  status: 'marked' | 'confirmedNone' | 'unknown';
  players: number;
  lostMinutesPerGame: number;
  lostValPerGame: number;
  lostPointsPerGame: number;
  coreNames: string[];
};

/** A riportba kerülő hiányzó-hatás: a bemenet + a csapat VAL/meccs és a logit-hatás. */
export type PregameInjuryImpactReport = PregameInjuryImpact & {
  teamValPerGame: number;
  /** Kieső VAL/meccs ÷ csapat VAL/meccs (0–1). */
  valShare: number;
  /** A saját győzelmi esélyre gyakorolt hatás logitban (saját hiányzó negatív). */
  logit: number;
};

/** Az `analyzePreGameScouting` opcionális, komponensből érkező kiegészítői. */
export type PregameScoutingExtras = {
  matchContext?: PregameMatchContext | null;
  injuryImpact?: { own: PregameInjuryImpact; opponent: PregameInjuryImpact } | null;
  leagueProxyPerAverage?: number | null;
};

type XFactorCandidate = {
  key: string;
  label: string;
  short: string;
};

type XFactorInsight = {
  primary: XFactorCandidate;
  secondary: XFactorCandidate;
};

export type PreGameXFactorContext = {
  primaryKey: string;
  secondaryKey?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  primaryDeltaPct?: number;
  secondaryDeltaPct?: number;
  combinedDeltaPct?: number;
  riskFlags?: string[];
};

/** Határozott névelő a szó elé: „az” magánhangzóval kezdődő szónál, különben „a”. */
const withArticle = (word: string) => `${/^[aáeéiíoóöőuúüű]/i.test(word.trim()) ? 'az' : 'a'} ${word}`;

/**
 * Egy összefűzött sor írásjeleinek rendbetétele: a mondatvégi írásjel utáni
 * újabb pont (pl. „… visszafogása..”) és a dupla szóköz eltűnik.
 */
const tidySentence = (line: string) =>
  line
    .replace(/([.!?])\.+(?=\s|$)/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();

const round = (value: number, digits = 2) => {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const average = (values: number[]) =>
  values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const stdDev = (values: number[]) => {
  if (values.length <= 1) return 0;
  const mean = average(values);
  const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
};

const zScore = (value: number, pool: number[]) => {
  const mean = average(pool);
  const sd = stdDev(pool);
  if (!Number.isFinite(value) || !Number.isFinite(sd) || sd <= 0.0001) return 0;
  return (value - mean) / sd;
};

const POSITION_LABELS: Record<Position, string> = {
  PG: 'irányító',
  SG: 'dobóhátvéd',
  SF: 'kiscsatár',
  PF: 'erőcsatár',
  C: 'center',
};

const SHOT_ZONE_LABELS: Record<ShotZoneKey, string> = {
  rim: 'Gyűrű',
  paint: 'Festék',
  mid: 'Középtáv',
  corner3: 'Sarok tripla',
  aboveBreak3: 'Egyéb tripla',
};

const BALL_HANDLER_ROLE_HINTS = new Set<string>([
  'Primary Ball Handler',
  'Secondary Creator',
  'Secondary Playmaker',
  'Offensive Hub',
]);

const getPlayerPositionBuckets = (player: PlayerSeasonStat): Position[] => {
  if (player.positionBuckets?.length) return player.positionBuckets;
  const parsedLabel = parsePositionBuckets(player.positionLabel);
  if (parsedLabel.length > 0) return parsedLabel;
  const fallback = parsePositionBuckets(player.position);
  if (fallback.length > 0) return fallback;
  return player.position ? [player.position] : [];
};

const playerMatchesPosition = (player: PlayerSeasonStat, position: Position) =>
  getPlayerPositionBuckets(player).includes(position);

const playerMatchesAnyPosition = (player: PlayerSeasonStat, positions: Position[]) =>
  positions.some(pos => playerMatchesPosition(player, pos));

// Ensures PG slot stats fall back to combo guards if no natural point guard logged minutes.
const selectPlayersForPosition = (players: PlayerSeasonStat[], position: Position) => {
  const primaryMatches = players.filter(player => playerMatchesPosition(player, position));
  if (position !== 'PG') return primaryMatches;
  if (primaryMatches.length > 0) return primaryMatches;

  const comboGuards = players.filter(player => {
    const guardSlot = playerMatchesAnyPosition(player, ['PG', 'SG']);
    const handlesBall = (player.roles ?? []).some(role => BALL_HANDLER_ROLE_HINTS.has(role));
    return guardSlot && handlesBall;
  });
  if (comboGuards.length > 0) return comboGuards;

  return players.filter(player => playerMatchesPosition(player, 'SG'));
};

const CRITICAL_MATCHUP_DELTA = -12;
const CLEAR_ADVANTAGE_DELTA = 12;
const SIGNIFICANT_MATCHUP_DELTA = 10;
const POSITION_MATCHUP_WEIGHTS: Record<string, number> = {
  PG: 0.25, SG: 0.15, SF: 0.15, PF: 0.20, C: 0.25,
};

type TempoBand = 'high' | 'medium' | 'low';

type TeamStyleProfile = {
  tempo: string;
  offense: string[];
  defense: string[];
};

/**
 * Két csapat tempója ennél kisebb eltérésnél (birtoklás/meccs) ugyanabba a
 * sávba esik: a 39,0 „Közepes” / 38,5 „Alacsony” típusú éles vágás így nem
 * fordulhat elő egy párosításon belül.
 */
const TEMPO_PAIR_TOLERANCE = 1.5;

const PERCENTILE_POINTS: Array<[keyof BenchmarkPercentiles, number]> = [
  ['P10', 10], ['P25', 25], ['P40', 40], ['P50', 50], ['P60', 60], ['P75', 75], ['P90', 90],
];

/**
 * Valódi liga-percentilis rang (0–100) a benchmark P10…P90 pontjai közti
 * lineáris interpolációval; a széleken a szomszédos szakasz meredekségével
 * extrapolál. (A `getPercentileScore` ezzel szemben a P10–P90 közti lineáris
 * skála, ahol az 50 nem a medián.)
 */
const getPercentileRank = (benchmarks: LeagueTeamBenchmarks, team: NormalizedTeamStats, stat: string, value: number) => {
  const points = PERCENTILE_POINTS
    .map(([key, pct]) => ({ value: getBenchmarkThreshold(benchmarks, team, stat, key), pct }))
    .filter(point => Number.isFinite(point.value));
  if (points.length < 2 || !Number.isFinite(value)) return 50;
  const interpolate = (a: { value: number; pct: number }, b: { value: number; pct: number }) =>
    b.value === a.value ? (a.pct + b.pct) / 2 : a.pct + ((value - a.value) / (b.value - a.value)) * (b.pct - a.pct);
  if (value <= points[0].value) return clamp(interpolate(points[0], points[1]), 0, 100);
  for (let i = 1; i < points.length; i += 1) {
    if (value <= points[i].value) return clamp(interpolate(points[i - 1], points[i]), 0, 100);
  }
  return clamp(interpolate(points[points.length - 2], points[points.length - 1]), 0, 100);
};

/** A tempó, amelyhez a sávot mérjük: közeli párnál a kettő átlaga. */
const getComparablePace = (team: NormalizedTeamStats, counterpart?: NormalizedTeamStats) =>
  counterpart && Math.abs(team.pace - counterpart.pace) < TEMPO_PAIR_TOLERANCE
    ? (team.pace + counterpart.pace) / 2
    : team.pace;

const getTempoRank = (team: NormalizedTeamStats, benchmarks: LeagueTeamBenchmarks, counterpart?: NormalizedTeamStats) =>
  getPercentileRank(benchmarks, team, 'pace', getComparablePace(team, counterpart));

/** Tempó-sáv a liga harmadai szerint (percentilis-rang), a pár-toleranciával. */
const getTempoBand = (
  team: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks,
  counterpart?: NormalizedTeamStats
): TempoBand => {
  const rank = getTempoRank(team, benchmarks, counterpart);
  if (rank >= 67) return 'high';
  if (rank <= 33) return 'low';
  return 'medium';
};

const describeTempo = (team: NormalizedTeamStats, benchmarks: LeagueTeamBenchmarks, counterpart?: NormalizedTeamStats) => {
  const rank = getTempoRank(team, benchmarks, counterpart);
  if (rank >= 90) return 'rendkívül gyors tempójú';
  if (rank >= 67) return 'gyors tempójú';
  if (rank <= 10) return 'rendkívül lassú tempójú';
  if (rank <= 33) return 'lassú tempójú';
  return 'közepes tempójú';
};

const getTempoLevelLabel = (team: NormalizedTeamStats, benchmarks: LeagueTeamBenchmarks, counterpart?: NormalizedTeamStats) => {
  const tempoBand = getTempoBand(team, benchmarks, counterpart);
  if (tempoBand === 'high') return 'Magas';
  if (tempoBand === 'low') return 'Alacsony';
  return 'Közepes';
};

const finalizeTeamProfile = (
  tempo: string,
  style: ReturnType<typeof buildTeamStyle>,
  options?: { defensiveDataLimited?: boolean }
): TeamStyleProfile => ({
  tempo,
  offense: finalizeOffenseStyle(style.offense),
  defense: finalizeDefenseStyle(style.defense, options?.defensiveDataLimited),
});

const summarizePositionDeltas = (positionComparison: PositionComparison[]) => {
  const perimeterDelta = positionComparison
    .filter(item => ['PG', 'SG', 'SF'].includes(item.position))
    .reduce((sum, item) => sum + item.deltaValPer36, 0);
  const frontcourtDelta = positionComparison
    .filter(item => ['PF', 'C'].includes(item.position))
    .reduce((sum, item) => sum + item.deltaValPer36, 0);
  return { perimeterDelta, frontcourtDelta };
};

const VARIANCE_DRIVER_THREE = 'tripla-variancia';
const VARIANCE_DRIVER_FT = 'büntetőarány / faultterhelés';

const buildVarianceDrivers = (
  opponent: NormalizedTeamStats,
  ownTeam: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks,
  riskFlags: string[] = []
) => {
  const drivers: string[] = [];
  const tripleVariance =
    scoreAbove(benchmarks, opponent, 'three_rate', 60) ||
    scoreAbove(benchmarks, opponent, 'three_pct', 60) ||
    scoreAbove(benchmarks, ownTeam, 'three_rate', 60) ||
    scoreAbove(benchmarks, ownTeam, 'three_pct', 60);
  if (tripleVariance) drivers.push(VARIANCE_DRIVER_THREE);

  const ftVariance =
    scoreAbove(benchmarks, opponent, 'ft_rate', 60) ||
    scoreAbove(benchmarks, ownTeam, 'ft_rate', 60) ||
    riskFlags.some(flag => {
      const lowered = flag.toLowerCase();
      return (
        lowered.includes('fault') ||
        lowered.includes('ft-rate') ||
        lowered.includes('büntető') ||
        lowered.includes('bünteto')
      );
    });
  if (ftVariance) drivers.push(VARIANCE_DRIVER_FT);

  return drivers;
};

const buildSignificantMatchups = (positionComparison: PositionComparison[]) =>
  positionComparison
    .filter(item => Math.abs(item.deltaValPer36) >= SIGNIFICANT_MATCHUP_DELTA)
    .map(item => ({
      position: item.position,
      deltaValPer36: item.deltaValPer36,
      matchupFlag: item.matchupFlag,
    }));


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
      // Ellenfél-lepattanó nélkül nincs értelmes OREB% – a benchmarkból kimarad.
      return team.hasOpponentBox ? team.orebRate : Number.NaN;
    case 'two_rate':
      return team.twoRate;
    case 'three_rate':
      return team.threeRate;
    case 'three_pct':
      return team.threePct;
    case 'two_pct':
      return team.fga2 > 0 ? (team.fgm2 / team.fga2) * 100 : Number.NaN;
    case 'ft_rate':
      return team.ftRate;
    case 'opp_ft_rate_allowed':
      // Csak párosított meccsekből ismert; hiányában kimarad a benchmarkból.
      return team.hasOpponentBox ? team.oppFtRateAllowed : Number.NaN;
    case 'efg':
      return team.efg;
    case 'val_per_game':
      return team.valPerGame;
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
  /** Van-e párosított (mindkét oldali box score-os) meccs – az OREB% csak ekkor értelmes. */
  hasOpponentBox: boolean;
  /** A csapat védekezése által engedett FTA / FGA (az ellenfelek büntetőaránya), 0–1. */
  oppFtRateAllowed: number;
};

const computePossessions = (fga2: number, fga3: number, fta: number, oreb: number, tov: number) =>
  Math.max(fga2 + fga3 + 0.44 * fta + tov - oreb, 0);

export const normalizeTeamStats = (raw: TeamSeasonStat): NormalizedTeamStats => {
  const games = raw.games || 1;
  const fga = raw.fga2 + raw.fga3;
  const fgm = raw.fgm2 + raw.fgm3;
  const opponent = raw.opponent;
  const opponentGames = opponent?.games ?? 0;
  const hasOpponentBox = Boolean(opponent) && opponentGames > 0;

  const teamPossessionsPerGame = computePossessions(raw.fga2, raw.fga3, raw.fta, raw.oreb, raw.tov) / games;
  const opponentPossessionsPerGame = opponent && hasOpponentBox
    ? computePossessions(opponent.fga2, opponent.fga3, opponent.fta, opponent.oreb, opponent.tov) / opponentGames
    : 0;
  // Tempó: a két csapat birtoklásbecslésének átlaga; ellenfél box score nélkül
  // csak a saját becslés (nem felezve).
  const pace = opponentPossessionsPerGame > 0
    ? (teamPossessionsPerGame + opponentPossessionsPerGame) / 2
    : teamPossessionsPerGame;
  const assistRate = fgm > 0 ? raw.ast / fgm : 0;
  const turnoverRate = teamPossessionsPerGame > 0 ? (raw.tov / games) / teamPossessionsPerGame : 0;
  // OREB%: saját T-lep / (saját T-lep + ellenfél V-lep), azonos (párosított) mintán.
  const orebDenominator = opponent && hasOpponentBox ? opponent.ownOreb + opponent.dreb : 0;
  const orebRate = opponent && orebDenominator > 0 ? opponent.ownOreb / orebDenominator : 0;
  const twoRate = fga > 0 ? raw.fga2 / fga : 0;
  const threeRate = fga > 0 ? raw.fga3 / fga : 0;
  const threePct = raw.fga3 > 0 ? (raw.fgm3 / raw.fga3) * 100 : 0;
  const ftRate = fga > 0 ? raw.fta / fga : 0;
  const efg = fga > 0 ? ((fgm + 0.5 * raw.fgm3) / fga) * 100 : 0;
  const valPerGame = raw.val / games;
  const opponentFga = opponent ? opponent.fga2 + opponent.fga3 : 0;
  const oppFtRateAllowed = opponent && hasOpponentBox && opponentFga > 0 ? opponent.fta / opponentFga : 0;

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
    hasOpponentBox: hasOpponentBox && orebDenominator > 0,
    oppFtRateAllowed: round(oppFtRateAllowed, 3),
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
  'two_pct',
  'ft_rate',
  'opp_ft_rate_allowed',
  'efg',
  'val_per_game',
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
      const statBenchmarks: TeamBenchmarks = {};
      TEAM_STAT_KEYS.forEach(stat => {
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

// Returns 0–100 via linear interpolation between P10 and P90.
// A score of 50 means halfway between the 10th and 90th percentile, not the median.
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

const scoreAbove = (benchmarks: LeagueTeamBenchmarks, team: NormalizedTeamStats, stat: string, score: number) =>
  getPercentileScore(benchmarks, team, stat) >= score;

const scoreBelow = (benchmarks: LeagueTeamBenchmarks, team: NormalizedTeamStats, stat: string, score: number) =>
  getPercentileScore(benchmarks, team, stat) <= score;

export type MatchupAxisKey = 'tempo' | 'perimeter' | 'paint' | 'free_throw' | 'rebound' | 'ball_security';

/**
 * A meccs döntő tengelye: az a mutató, ahol a két csapat közti különbség a
 * liga szórásához mérve a legnagyobb. `z` előjele: pozitív = saját előny.
 */
export type MatchupAxis = {
  axis: MatchupAxisKey;
  axisLabel: string;
  metricLabel: string;
  ownValue: string;
  opponentValue: string;
  z: number;
};

const MATCHUP_AXIS_LABELS: Record<MatchupAxisKey, string> = {
  tempo: 'tempó',
  perimeter: 'periméter',
  paint: 'festék',
  free_throw: 'büntető',
  rebound: 'lepattanó',
  ball_security: 'labdabiztonság',
};

const MATCHUP_AXIS_METRICS: Array<{
  stat: string;
  axis: MatchupAxisKey;
  label: string;
  format: (value: number) => string;
  lowerIsBetter?: boolean;
  /** Tempónál nincs „jobb” irány: az előjel csak a gyorsabb csapatot jelzi. */
  neutral?: boolean;
}> = [
  { stat: 'pace', axis: 'tempo', label: 'tempó', format: v => `${v.toFixed(1)} birtoklás`, neutral: true },
  { stat: 'three_rate', axis: 'perimeter', label: '3P arány', format: v => `${(v * 100).toFixed(1)}%` },
  { stat: 'three_pct', axis: 'perimeter', label: '3P%', format: v => `${v.toFixed(1)}%` },
  { stat: 'two_rate', axis: 'paint', label: '2P arány', format: v => `${(v * 100).toFixed(1)}%` },
  { stat: 'two_pct', axis: 'paint', label: '2P%', format: v => `${v.toFixed(1)}%` },
  { stat: 'ft_rate', axis: 'free_throw', label: 'FT arány', format: v => `${(v * 100).toFixed(1)}%` },
  { stat: 'oreb_rate', axis: 'rebound', label: 'OREB%', format: v => `${(v * 100).toFixed(1)}%` },
  { stat: 'turnover_rate', axis: 'ball_security', label: 'TO rate', format: v => `${(v * 100).toFixed(1)}%`, lowerIsBetter: true },
];

/** A liga szórásának becslése a benchmark-percentilisekből: σ ≈ (P90 − P10) / 2,563. */
const estimateLeagueStd = (benchmarks: LeagueTeamBenchmarks, team: NormalizedTeamStats, stat: string) => {
  const p10 = getBenchmarkThreshold(benchmarks, team, stat, 'P10');
  const p90 = getBenchmarkThreshold(benchmarks, team, stat, 'P90');
  const std = (p90 - p10) / 2.563;
  return Number.isFinite(std) && std > 0 ? std : null;
};

/** A döntő tengely: a legnagyobb |z| = |saját − ellenfél| / liga-σ mutató tengelye. */
const getMatchupAxis = (
  ownTeam: NormalizedTeamStats,
  opponent: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks
): MatchupAxis | undefined => {
  const candidates = MATCHUP_AXIS_METRICS
    .map(metric => {
      const own = getStatValue(ownTeam, metric.stat);
      const opp = getStatValue(opponent, metric.stat);
      const std = estimateLeagueStd(benchmarks, ownTeam, metric.stat);
      if (!Number.isFinite(own) || !Number.isFinite(opp) || std === null) return null;
      const raw = (own - opp) / std;
      return { metric, own, opp, z: metric.lowerIsBetter ? -raw : raw };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
  const top = candidates[0];
  if (!top) return undefined;
  return {
    axis: top.metric.axis,
    axisLabel: MATCHUP_AXIS_LABELS[top.metric.axis],
    metricLabel: top.metric.label,
    ownValue: top.metric.format(top.own),
    opponentValue: top.metric.format(top.opp),
    z: round(top.z, 2),
  };
};

const getDominantAxis = (team: NormalizedTeamStats, benchmarks: LeagueTeamBenchmarks) => {
  const paceScore = getPercentileScore(benchmarks, team, 'pace');
  const twoRateScore = getPercentileScore(benchmarks, team, 'two_rate');
  const threeRateScore = getPercentileScore(benchmarks, team, 'three_rate');
  const threePctScore = getPercentileScore(benchmarks, team, 'three_pct');
  const ftRateScore = getPercentileScore(benchmarks, team, 'ft_rate');
  const perimeterScore = Math.max(threeRateScore, round(threeRateScore * 0.7 + threePctScore * 0.3, 1));
  const paintScore = Math.max(twoRateScore, round(twoRateScore * 0.75 + ftRateScore * 0.25, 1));

  if (paceScore >= 75 && paceScore >= perimeterScore + 8 && paceScore >= paintScore + 8) return 'transition';
  if (perimeterScore >= 58 && perimeterScore >= paintScore + 3) return 'periméter';
  if (paintScore >= 60 && paintScore >= perimeterScore + 3) return 'festék';

  const maxScore = Math.max(paceScore, perimeterScore, paintScore);
  if (maxScore === paceScore) return 'transition';
  if (maxScore === perimeterScore) return 'periméter';
  return 'festék';
};

const buildTeamStyle = (team: NormalizedTeamStats, benchmarks: LeagueTeamBenchmarks, counterpart?: NormalizedTeamStats) => {
  const offense: string[] = [];
  const defense: string[] = [];
  const tempoBand = getTempoBand(team, benchmarks, counterpart);
  const paceScore = getPercentileScore(benchmarks, team, 'pace');
  const assistScore = getPercentileScore(benchmarks, team, 'assist_rate');
  const twoRateScore = getPercentileScore(benchmarks, team, 'two_rate');
  const threeRateScore = getPercentileScore(benchmarks, team, 'three_rate');
  const threePctScore = getPercentileScore(benchmarks, team, 'three_pct');
  const ftRateScore = getPercentileScore(benchmarks, team, 'ft_rate');

  if (tempoBand === 'high') offense.push(OFFENSE_STYLE_LABELS.transition);
  if (tempoBand === 'low' && assistScore >= 60) {
    offense.push(OFFENSE_STYLE_LABELS.halfcourt);
  }
  if ((threeRateScore >= 60 && threePctScore >= 60) || threeRateScore >= 70) {
    offense.push(OFFENSE_STYLE_LABELS.perimeter);
  }
  if (
    twoRateScore >= 70
    && ftRateScore >= 60
    && threeRateScore <= 45
  ) {
    offense.push(OFFENSE_STYLE_LABELS.interior);
  }

  if (offense.length === 0) {
    if (threeRateScore >= 58) {
      offense.push(OFFENSE_STYLE_LABELS.perimeter);
    } else if (paceScore <= 40 && assistScore >= 50) {
      offense.push(OFFENSE_STYLE_LABELS.halfcourt);
    } else if (twoRateScore >= 60 || ftRateScore >= 60) {
      offense.push(OFFENSE_STYLE_LABELS.interior);
    }
  }

  if (scoreAbove(benchmarks, team, 'stl_per_game', 60)) defense.push(DEFENSE_STYLE_LABELS.pressure);
  if (scoreAbove(benchmarks, team, 'blk_per_game', 60)) defense.push(DEFENSE_STYLE_LABELS.rim);
  if (scoreBelow(benchmarks, team, 'fouls_per_game', 40)) defense.push(DEFENSE_STYLE_LABELS.disciplined);

  return { offense, defense };
};

const computePlayerUsage = (player: PlayerSeasonStat) => {
  const fga = player.fga2 + player.fga3;
  const possessionsUsed = fga + 0.44 * player.fta + player.tov;
  return player.games > 0 ? possessionsUsed / player.games : 0;
};

/** A zóna-FG% shrinkage prior-súlya (kísérletben): ennyi liga-átlagos dobással húzzuk a mintát. */
export const ZONE_SHRINK_PRIOR_ATTEMPTS = 20;
/** Zóna-matchuphoz és zárd/engedd párhoz szükséges minimum kísérletszám. */
const MIN_MATCHUP_ATTEMPTS = 12;

const buildShotProfileContext = (
  ownShotProfile?: ShotProfileSummary | null,
  opponentShotProfile?: ShotProfileSummary | null,
  leagueShotProfile?: ShotProfileSummary | null,
  ownAllowedShotProfile?: ShotProfileSummary | null,
  opponentAllowedShotProfile?: ShotProfileSummary | null
) => {
  if (!ownShotProfile || !opponentShotProfile || !leagueShotProfile) return undefined;

  const zonePoints = (zone: ShotZoneKey) => (zone === 'corner3' || zone === 'aboveBreak3' ? 3 : 2);

  const summarize = (profile: ShotProfileSummary): PregameShotZone[] => {
    const totalAttempts = Math.max(profile.attempts, 1);
    const leagueTotalAttempts = Math.max(leagueShotProfile.attempts, 1);

    return (Object.keys(profile.zoneStats) as ShotZoneKey[])
      .map(zone => {
        const attempts = profile.zoneStats[zone].attempts;
        const rate = (attempts / totalAttempts) * 100;
        const pct = profile.zoneStats[zone].pct;
        const leagueRate = (leagueShotProfile.zoneStats[zone].attempts / leagueTotalAttempts) * 100;
        const leaguePct = leagueShotProfile.zoneStats[zone].pct;
        // Bayes-shrink: (találat + K × liga FG) / (kísérlet + K).
        const pctShrunk = ((profile.zoneStats[zone].made + ZONE_SHRINK_PRIOR_ATTEMPTS * (leaguePct / 100))
          / (attempts + ZONE_SHRINK_PRIOR_ATTEMPTS)) * 100;
        const pps = (pctShrunk / 100) * zonePoints(zone);
        const leaguePps = (leaguePct / 100) * zonePoints(zone);

        return {
          key: zone,
          label: SHOT_ZONE_LABELS[zone],
          attempts,
          rate: round(rate, 1),
          pct: round(pct, 1),
          pctShrunk: round(pctShrunk, 1),
          pps: round(pps, 2),
          rateDeltaVsLeague: round(rate - leagueRate, 1),
          pctDeltaVsLeague: round(pct - leaguePct, 1),
          pctShrunkDeltaVsLeague: round(pctShrunk - leaguePct, 1),
          ppsDeltaVsLeague: round(pps - leaguePps, 2),
        };
      })
      .sort((a, b) => {
        const aScore = a.rateDeltaVsLeague * 0.7 + a.pctShrunkDeltaVsLeague * 0.3;
        const bScore = b.rateDeltaVsLeague * 0.7 + b.pctShrunkDeltaVsLeague * 0.3;
        return bScore - aScore;
      });
  };

  /** A profil teljes pont / dobás értéke (büntetők nélkül). */
  const overallPps = (profile: ShotProfileSummary) => {
    const attempts = (Object.keys(profile.zoneStats) as ShotZoneKey[])
      .reduce((sum, zone) => sum + profile.zoneStats[zone].attempts, 0);
    if (attempts <= 0) return 0;
    const points = (Object.keys(profile.zoneStats) as ShotZoneKey[])
      .reduce((sum, zone) => sum + profile.zoneStats[zone].made * zonePoints(zone), 0);
    return points / attempts;
  };

  const ownZones = summarize(ownShotProfile);
  const opponentZones = summarize(opponentShotProfile);
  const ownAllowedZones = ownAllowedShotProfile ? summarize(ownAllowedShotProfile) : [];
  const opponentAllowedZones = opponentAllowedShotProfile ? summarize(opponentAllowedShotProfile) : [];
  const ownTopZones = ownZones.filter(zone => zone.attempts >= 12).slice(0, 2);
  const opponentTopZones = opponentZones.filter(zone => zone.attempts >= 12).slice(0, 2);
  const ownDefensePressureZones = ownAllowedZones
    .filter(zone => zone.attempts >= 12)
    .sort((a, b) => a.rateDeltaVsLeague - b.rateDeltaVsLeague || a.pctDeltaVsLeague - b.pctDeltaVsLeague)
    .slice(0, 2);
  const opponentDefensePressureZones = opponentAllowedZones
    .filter(zone => zone.attempts >= 12)
    .sort((a, b) => a.rateDeltaVsLeague - b.rateDeltaVsLeague || a.pctDeltaVsLeague - b.pctDeltaVsLeague)
    .slice(0, 2);
  const clashZones = ownTopZones
    .map(zone => zone.label)
    .filter(label => opponentTopZones.some(item => item.label === label));

  const notes: string[] = [];
  const defenseNotes: string[] = [];
  const ownBestEfficiency = ownZones.find(zone => zone.pctShrunkDeltaVsLeague >= 2 && zone.attempts >= 10) || null;
  const opponentBestEfficiency = opponentZones.find(zone => zone.pctShrunkDeltaVsLeague >= 2 && zone.attempts >= 10) || null;

  // Zóna-matchup pont / dobás alapon (shrinkelt értékekből): a várható érték =
  // saját zóna pps + amennyivel a védekező csapat ott többet enged a ligánál.
  // „Kedvező” csak az a zóna lehet, ahol ez legalább a támadó teljes pps-e.
  const bestZoneMatchup = (attackZones: PregameShotZone[], defenseAllowed: PregameShotZone[], attackOverallPps: number) =>
    attackZones
      .filter(zone => zone.attempts >= MIN_MATCHUP_ATTEMPTS)
      .map(zone => {
        const allowed = defenseAllowed.find(item => item.key === zone.key);
        if (!allowed) return null;
        return {
          zone,
          allowedPpsDelta: allowed.ppsDeltaVsLeague,
          expectedPps: round(zone.pps + allowed.ppsDeltaVsLeague, 2),
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .filter(item => item.allowedPpsDelta > 0 && item.expectedPps >= attackOverallPps)
      .sort((a, b) => b.expectedPps - a.expectedPps)[0] || null;

  const ownBestAttackVsOpponentDefense = opponentAllowedShotProfile
    ? bestZoneMatchup(ownZones, opponentAllowedZones, overallPps(ownShotProfile))
    : null;
  const opponentBestAttackVsOwnDefense = ownAllowedShotProfile
    ? bestZoneMatchup(opponentZones, ownAllowedZones, overallPps(opponentShotProfile))
    : null;

  // Dobástérkép-fókusz (támadás): a saját kedvező zóna-matchup és hatékony zóna.
  if (ownBestAttackVsOpponentDefense) {
    const { zone, allowedPpsDelta, expectedPps } = ownBestAttackVsOpponentDefense;
    notes.push(`${zone.label}: kedvező saját zóna-matchup – várható ${expectedPps.toFixed(2)} pont/dobás (saját ${zone.pps.toFixed(2)}, ${zone.attempts} kísérlet; az ellenfél itt +${allowedPpsDelta.toFixed(2)} pont/dobással többet enged a ligánál).`);
  }
  if (ownBestEfficiency && ownBestEfficiency.key !== ownBestAttackVsOpponentDefense?.zone.key) {
    notes.push(`${ownBestEfficiency.label}: saját támadó zónaelőny (shrinkelt FG% ${ownBestEfficiency.pctShrunkDeltaVsLeague >= 0 ? '+' : ''}${ownBestEfficiency.pctShrunkDeltaVsLeague.toFixed(1)} pp a liga fölött, ${ownBestEfficiency.pps.toFixed(2)} pont/dobás, ${ownBestEfficiency.attempts} kísérlet).`);
  }
  if (opponentBestEfficiency) {
    notes.push(`${opponentBestEfficiency.label}: ellenfél elsődleges hatékony zónája (shrinkelt FG% ${opponentBestEfficiency.pctShrunkDeltaVsLeague >= 0 ? '+' : ''}${opponentBestEfficiency.pctShrunkDeltaVsLeague.toFixed(1)} pp a liga fölött, ${opponentBestEfficiency.pps.toFixed(2)} pont/dobás).`);
  }
  if (clashZones.length > 0) {
    notes.push(`Zónaütközés: mindkét csapat hangsúlyosan támadja a következő területeket: ${clashZones.join(', ')}.`);
  }

  // Dobástérkép-védekezés: az ellenfél zónáiból zárd / engedd pár.
  const opponentSampleZones = opponentZones.filter(zone => zone.attempts >= MIN_MATCHUP_ATTEMPTS);
  if (opponentSampleZones.length >= 2) {
    const byPps = [...opponentSampleZones].sort((a, b) => b.pps - a.pps);
    const close = byPps[0];
    const allow = byPps[byPps.length - 1];
    defenseNotes.push(`Zárd: ${close.label.toLowerCase()} (${close.pps.toFixed(2)} pont/dobás, ${close.attempts} kísérlet) – engedd: ${allow.label.toLowerCase()} (${allow.pps.toFixed(2)} pont/dobás, ${allow.attempts} kísérlet).`);
  }
  if (opponentBestAttackVsOwnDefense) {
    const { zone, allowedPpsDelta, expectedPps } = opponentBestAttackVsOwnDefense;
    defenseNotes.push(`${zone.label}: ellenfél támadási matchup-fenyegetés – várható ${expectedPps.toFixed(2)} pont/dobás (ellenfél ${zone.pps.toFixed(2)}, a saját védekezés itt +${allowedPpsDelta.toFixed(2)} pont/dobással többet enged a ligánál).`);
  }
  if (clashZones.includes('Gyűrű')) {
    defenseNotes.push('Gyűrű-zónaütközés: a mérkőzés gerince a festékharc lehet, ezért help-védekezés és korai visszarendeződés is kritikus.');
  }
  if (clashZones.includes('Sarok tripla') || clashZones.includes('Egyéb tripla')) {
    defenseNotes.push('Periméter-zónaütközés: a closeout-fegyelem és a tiszta triplahelyzetek limitálása közvetlenül swingeli a varianciát.');
  }

  return {
    ownZones,
    opponentZones,
    ownAllowedZones,
    opponentAllowedZones,
    ownTopZones,
    opponentTopZones,
    ownDefensePressureZones,
    opponentDefensePressureZones,
    clashZones,
    notes: notes.slice(0, 3),
    defenseNotes: defenseNotes.slice(0, 3),
  };
};

/** A PER* és WS* skála magyarázata (UI és export közös szövege). */
export const PROXY_PER_DEFINITION =
  'PER* = saját proxy, nem a Hollinger-féle PER: 36 percre vetítve 0,35·pont + 0,22·assziszt + 0,26·szerzett labda + 0,17·blokk − 0,20·eladott labda (lepattanó és dobáshatékonyság nélkül).';
export const PROXY_WIN_SHARE_DEFINITION =
  'WS* = a játékos VAL-részesedése a csapat teljes szezon-VAL-jából × a csapat tényleges győzelmeinek száma × hatékonysági szorzó (VAL/meccs ÷ 18, 0,5–1,5 között); becsült győzelem-hozzájárulás, csak új eredménnyel változik. Mérkőzés-kontextus (mérleg) nélkül nem számolható.';

/** A PER* számításához szükséges játékosmezők (szezon-összegek). */
type ProxyPerInput = Pick<PlayerSeasonStat, 'minutes' | 'points' | 'ast' | 'stl' | 'blk' | 'tov'>;

/**
 * PER* – saját, egyszerűsített teljesítmény-proxy, **nem** a Hollinger-féle PER:
 * 36 percre vetítve 0,35·pont + 0,22·assziszt + 0,26·szerzett labda +
 * 0,17·blokk − 0,20·eladott labda (alsó korlát 0). Lepattanót és dobás-
 * hatékonyságot nem tartalmaz; csak a ligaátlaghoz mérve értelmezhető.
 */
export const computeProxyPer = (player: ProxyPerInput) => {
  const minutes = Math.max(player.minutes || 0, 1);
  const pointsPer36 = (player.points / minutes) * 36;
  const astPer36 = (player.ast / minutes) * 36;
  const stlPer36 = (player.stl / minutes) * 36;
  const blkPer36 = (player.blk / minutes) * 36;
  const tovPer36 = (player.tov / minutes) * 36;
  const score =
    pointsPer36 * 0.35 +
    astPer36 * 0.22 +
    stlPer36 * 0.26 +
    blkPer36 * 0.17 -
    tovPer36 * 0.20;
  return round(Math.max(score, 0), 1);
};

/**
 * A liga PER*-átlaga a kulcsjátékos-listával azonos jogosultsági küszöbbel
 * (`getAdvancedEligibility`), percekkel súlyozva – a PER* skála viszonyítási
 * pontja. `teamGames` = a liga csapatainak jellemző meccsszáma.
 */
export const computeLeagueProxyPerAverage = (
  players: Array<ProxyPerInput & { games: number }>,
  teamGames: number
) => {
  const eligibility = getAdvancedEligibility(teamGames);
  const eligible = players.filter(player => {
    const games = Math.max(player.games || 0, 1);
    return (
      player.minutes >= eligibility.minTotalMinutes
      && player.minutes / games >= eligibility.minMinutesPerGame
      && games >= eligibility.minEligibleGames
    );
  });
  const totalMinutes = eligible.reduce((sum, player) => sum + player.minutes, 0);
  if (totalMinutes <= 0) return null;
  const weighted = eligible.reduce((sum, player) => sum + computeProxyPer(player) * player.minutes, 0);
  return round(weighted / totalMinutes, 1);
};

/**
 * WS*: a játékos VAL-részesedése a csapat **teljes** szezon-VAL-jából × a
 * csapat **tényleges** győzelmei × hatékonysági szorzó. Nem függ az adott meccs
 * modellezett esélyétől és a hiányzók szűrésétől, ezért meccsek között csak
 * új eredménnyel változik.
 */
const computeProxyWinShare = (
  player: PlayerSeasonStat,
  teamTotalVal: number,
  teamWins: number
) => {
  const valueShare = teamTotalVal > 0 ? player.val / teamTotalVal : 0;
  const efficiencyBoost = player.games > 0 ? clamp((player.val / player.games) / 18, 0.5, 1.5) : 1;
  return round(valueShare * teamWins * efficiencyBoost, 2);
};

const getAdvancedEligibility = (teamGames: number): AdvancedPlayerEligibility => {
  const safeTeamGames = Math.max(Math.round(teamGames || 0), 6);
  const minEligibleGames = clamp(Math.round(safeTeamGames * 0.2), 3, 8);
  const minMinutesPerGame = safeTeamGames >= 24 ? 10 : safeTeamGames >= 14 ? 9 : 8;
  const minTotalMinutes = minEligibleGames * minMinutesPerGame;
  return {
    minTotalMinutes,
    minMinutesPerGame,
    minEligibleGames,
  };
};

const getAdvancedFallbackEligibility = (eligibility: AdvancedPlayerEligibility): AdvancedPlayerEligibility => ({
  minTotalMinutes: Math.max(45, Math.round(eligibility.minTotalMinutes * 0.7)),
  minMinutesPerGame: Math.max(6, round(eligibility.minMinutesPerGame * 0.75, 1)),
  minEligibleGames: Math.max(2, Math.round(eligibility.minEligibleGames * 0.75)),
});

const buildAdvancedPlayers = (
  players: PlayerSeasonStat[],
  teamGames: number,
  teamTotalVal: number,
  teamWins: number | null
): AdvancedPlayerStat[] => {
  const withMinutes = players
    .filter(player => (player.minutes || 0) > 0)
    .map(player => {
      const minutes = player.minutes || 0;
      const games = Math.max(player.games || 0, 1);
      const minutesPerGame = minutes / games;
      return {
        ...player,
        minutes,
        minutesPerGame,
      };
    });

  const eligibility = getAdvancedEligibility(teamGames);
  const fallbackEligibility = getAdvancedFallbackEligibility(eligibility);

  const eligible = withMinutes.filter(player => {
    const games = Math.max(player.games || 0, 1);
    return (
      player.minutes >= eligibility.minTotalMinutes &&
      player.minutesPerGame >= eligibility.minMinutesPerGame &&
      games >= eligibility.minEligibleGames
    );
  });

  const filteredPool = eligible.length >= 3
    ? eligible
    : withMinutes.filter(player => {
      const games = Math.max(player.games || 0, 1);
      return (
        player.minutes >= fallbackEligibility.minTotalMinutes &&
        player.minutesPerGame >= fallbackEligibility.minMinutesPerGame &&
        games >= fallbackEligibility.minEligibleGames
      );
    });

  return filteredPool
    .map(player => {
      const minutes = Math.max(player.minutes || 0, 1);
      const valPer36 = (player.val / minutes) * 36;
      const pointsPer36 = (player.points / minutes) * 36;
      return {
        playerId: player.playerId,
        name: player.name,
        position: player.position,
        minutes: round(minutes, 1),
        minutesPerGame: round(player.minutesPerGame, 1),
        valPer36: round(valPer36, 1),
        pointsPer36: round(pointsPer36, 1),
        proxyPer: computeProxyPer(player),
        proxyWinShare: teamWins === null ? null : computeProxyWinShare(player, teamTotalVal, teamWins),
      };
    })
    .sort((a, b) => b.proxyPer - a.proxyPer)
    .slice(0, 5);
};

const computeUsageConcentration = (players: PlayerSeasonStat[]) => {
  const usage = players.map(computePlayerUsage).filter(v => Number.isFinite(v)).sort((a, b) => b - a);
  const total = usage.reduce((sum, v) => sum + v, 0) || 1;
  const top2 = usage.slice(0, 2).reduce((sum, v) => sum + v, 0);
  return round(top2 / total, 3);
};

const buildPositionComparison = (ownPlayers: PlayerSeasonStat[], opponentPlayers: PlayerSeasonStat[]) => {
  const positions: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];

  const allocationWeightForPosition = (player: PlayerSeasonStat, target: Position) => {
    const buckets = getPlayerPositionBuckets(player).filter(pos => positions.includes(pos));
    if (buckets.length === 0) return 0;
    if (buckets.includes(target)) return 1 / buckets.length;
    // Borrowed combo-guard fallback to PG should not be fully duplicated in SG totals.
    if (target === 'PG' && buckets.includes('SG')) return 0.5;
    return 0;
  };

  const aggregate = (players: PlayerSeasonStat[], position: Position) => {
    const bucket = selectPlayersForPosition(players, position);
    return bucket
      .reduce(
        (acc, player) => {
          const weight = allocationWeightForPosition(player, position);
          if (weight <= 0) return acc;
          acc.games += (player.games || 0) * weight;
          acc.minutes += (player.minutes || 0) * weight;
          acc.val += (player.val || 0) * weight;
          acc.points += (player.points || 0) * weight;
          return acc;
        },
        { games: 0, minutes: 0, val: 0, points: 0 }
      );
  };

  return positions.map(position => {
    const own = aggregate(ownPlayers, position);
    const opp = aggregate(opponentPlayers, position);

    const ownValPer36 = own.minutes > 0 ? (own.val / own.minutes) * 36 : 0;
    const oppValPer36 = opp.minutes > 0 ? (opp.val / opp.minutes) * 36 : 0;
    const ownPointsPer36 = own.minutes > 0 ? (own.points / own.minutes) * 36 : 0;
    const oppPointsPer36 = opp.minutes > 0 ? (opp.points / opp.minutes) * 36 : 0;

    const deltaValPer36 = round(ownValPer36 - oppValPer36, 1);
    let matchupFlag: PositionComparison['matchupFlag'];
    if (deltaValPer36 <= CRITICAL_MATCHUP_DELTA) {
      matchupFlag = 'critical_disadvantage';
    } else if (deltaValPer36 >= CLEAR_ADVANTAGE_DELTA) {
      matchupFlag = 'clear_advantage';
    }

    return {
      position,
      ownValPer36: round(ownValPer36, 1),
      oppValPer36: round(oppValPer36, 1),
      ownPointsPer36: round(ownPointsPer36, 1),
      oppPointsPer36: round(oppPointsPer36, 1),
      deltaValPer36,
      matchupFlag,
    };
  });
};

const identifyKeyPlayers = (players: PlayerSeasonStat[], teamUsageShare: number) => {
  const usageValues = players.map(computePlayerUsage).filter(v => Number.isFinite(v));
  const valPer36Pool = players.map(player => {
    const minutes = Math.max(player.minutes || 0, 1);
    return (player.val / minutes) * 36;
  });
  const astPerGamePool = players.map(player => player.games > 0 ? player.ast / player.games : 0);
  const astToPool = players.map(player => player.tov > 0 ? player.ast / player.tov : player.ast);
  const threeVolumePool = players.map(player => player.games > 0 ? player.fga3 / player.games : 0);
  const threePctPool = players.map(player => player.fga3 > 0 ? (player.fgm3 / player.fga3) * 100 : 0);

  const primaryScorers: Array<{ key: string; label: string; score: number }> = [];
  const primaryPlaymakers: Array<{ key: string; label: string; score: number }> = [];
  const stretchThreats: Array<{ key: string; label: string; score: number }> = [];
  const mismatchCandidates: Array<{ key: string; label: string; score: number }> = [];

  const heightByPos = players.reduce((acc, player) => {
    const height = player.heightCm;
    if (typeof height === 'number' && Number.isFinite(height)) {
      getPlayerPositionBuckets(player).forEach(pos => {
        acc[pos] = acc[pos] || { sum: 0, count: 0 };
        acc[pos].sum += height;
        acc[pos].count += 1;
      });
    }
    return acc;
  }, {} as Record<Position, { sum: number; count: number }>);

  const avgHeight = (pos: Position) => {
    const entry = heightByPos[pos];
    return entry && entry.count > 0 ? entry.sum / entry.count : null;
  };

  players.forEach(player => {
    const threePct = player.fga3 > 0 ? (player.fgm3 / player.fga3) * 100 : 0;
    const astTo = player.tov > 0 ? player.ast / player.tov : player.ast;
    const usage = computePlayerUsage(player);
    const astPerGame = player.games > 0 ? player.ast / player.games : 0;
    const threeVolume = player.games > 0 ? player.fga3 / player.games : 0;
    const minutes = Math.max(player.minutes || 0, 1);
    const valPer36 = (player.val / minutes) * 36;
    const primaryPos = getPlayerPositionBuckets(player)[0] ?? player.position;
    const posAvgHeight = avgHeight(primaryPos);
    const height = player.heightCm;
    const usageNorm = zScore(usage, usageValues);
    const valNorm = zScore(valPer36, valPer36Pool);
    const astNorm = zScore(astPerGame, astPerGamePool);
    const astToNorm = zScore(astTo, astToPool);
    const threeVolumeNorm = zScore(threeVolume, threeVolumePool);
    const threePctNorm = zScore(threePct, threePctPool);

    if (usageNorm >= 0.35 || (usageNorm >= 0.1 && valNorm >= 0.35)) {
      primaryScorers.push({ key: player.name, label: player.name, score: usageNorm * 0.65 + valNorm * 0.35 });
    }
    if (astPerGame >= 2.5 && astTo >= 1.4) {
      primaryPlaymakers.push({ key: player.name, label: player.name, score: astNorm * 0.6 + astToNorm * 0.4 });
    }
    if (threeVolume >= 1.5 && threePct >= 34) {
      stretchThreats.push({ key: player.name, label: player.name, score: threeVolumeNorm * 0.55 + threePctNorm * 0.45 });
    }
    if (usageNorm >= 0 || valNorm >= 0.15) {
      mismatchCandidates.push({ key: player.name, label: player.name, score: valNorm * 0.65 + usageNorm * 0.35 });
    }
    if (posAvgHeight != null && typeof height === 'number' && Number.isFinite(height) && height >= posAvgHeight + 5) {
      mismatchCandidates.push({ key: player.name, label: `${player.name} (magassági előny)`, score: valNorm + 0.9 });
    }
  });

  if (teamUsageShare >= 0.55 && primaryScorers.length === 0) {
    const topUsage = players.slice().sort((a, b) => computePlayerUsage(b) - computePlayerUsage(a))[0];
    if (topUsage) primaryScorers.push({ key: topUsage.name, label: topUsage.name, score: computePlayerUsage(topUsage) });
  }

  const pickTop = (items: Array<{ key: string; label: string; score: number }>) => {
    const unique = new Map<string, { label: string; score: number }>();
    items.forEach(item => {
      const current = unique.get(item.key);
      if (!current || item.score > current.score) {
        unique.set(item.key, { label: item.label, score: item.score });
      }
    });
    return Array.from(unique.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(item => item.label)
      .filter(Boolean);
  };

  return {
    primaryScorers: pickTop(primaryScorers),
    primaryPlaymakers: pickTop(primaryPlaymakers),
    stretchThreats: pickTop(stretchThreats),
    mismatchCandidates: pickTop(mismatchCandidates),
  };
};

const buildThreats = (team: NormalizedTeamStats, benchmarks: LeagueTeamBenchmarks, usageShare: number) => {
  const threats: string[] = [];
  if (scoreAbove(benchmarks, team, 'three_rate', 60)) {
    threats.push('Magas tripla-volumen → nagyobb pontszerzési variancia, gyors futások veszélye');
  }
  if (scoreAbove(benchmarks, team, 'three_pct', 60)) {
    threats.push('Erős 3P-hatékonyság → gyors pontfutás kockázat');
  }
  if (scoreAbove(benchmarks, team, 'assist_rate', 60)) {
    threats.push('Szervezett labdajáratás → rotációs bontás veszély');
  }
  if (scoreAbove(benchmarks, team, 'efg', 60) && !scoreAbove(benchmarks, team, 'three_pct', 60)) {
    threats.push('Hatékony dobás → félpályás megállítás nehezebb');
  }
  if (scoreAbove(benchmarks, team, 'two_rate', 60) && scoreAbove(benchmarks, team, 'ft_rate', 60)) {
    threats.push('Festékdomináns támadás → faultterhelés és belső nyomás');
  }
  if (scoreAbove(benchmarks, team, 'oreb_rate', 60)) {
    threats.push('Erős támadólepattanózás → második esély pontok veszélye');
  }
  if (usageShare >= 0.55) threats.push('Kulcsjátékos dominancia → fókuszált elfojtás szükséges');
  return threats;
};

/** Gyengeség-címke: az ellenfél védekezése sok büntetőt enged (FTA/FGA a liga felső 40%-ában). */
export const FOUL_PRONE_DEFENSE_VULNERABILITY = 'Sokat faultoló védekezés';

const buildVulnerabilities = (team: NormalizedTeamStats, benchmarks: LeagueTeamBenchmarks) => {
  const vulnerabilities: string[] = [];
  if (scoreAbove(benchmarks, team, 'turnover_rate', 60)) vulnerabilities.push('Magas labdaeladás arány');
  if (scoreBelow(benchmarks, team, 'assist_rate', 40)) vulnerabilities.push('Alacsony assziszt-arány');
  if (scoreBelow(benchmarks, team, 'efg', 40)) vulnerabilities.push('Alacsony dobáshatékonyság');
  // Kihasználható gyengeség az ellenfél *védekezése* által engedett büntető:
  // a saját FTA/FGA-ja (kevés kiharcolt büntető) nem nekünk ad előnyt.
  if (team.hasOpponentBox && scoreAbove(benchmarks, team, 'opp_ft_rate_allowed', 60)) {
    vulnerabilities.push(FOUL_PRONE_DEFENSE_VULNERABILITY);
  }
  if (scoreBelow(benchmarks, team, 'three_pct', 40)) vulnerabilities.push('Gyenge periméter-hatékonyság');
  if (scoreBelow(benchmarks, team, 'oreb_rate', 40)) vulnerabilities.push('Gyenge támadólepattanózás');
  return vulnerabilities;
};

const buildFocusPoints = (
  opponent: NormalizedTeamStats,
  ownTeam: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks,
  xFactors?: XFactorInsight
) => {
  const focus: string[] = [];
  let contingencyFocus: string | null = null;

  if (scoreAbove(benchmarks, opponent, 'three_rate', 60)) {
    focus.push('Periméter-védekezés kiemelt, agresszív kilépések a triplákon');
  }
  if (scoreAbove(benchmarks, opponent, 'three_pct', 60)) {
    focus.push('Kilépés fegyelem, ne engedj tiszta triplát');
  }
  if (scoreAbove(benchmarks, opponent, 'ft_rate', 60)) {
    focus.push('Fault-limitáció, betörések védése');
  }
  if (scoreAbove(benchmarks, opponent, 'two_rate', 60)) {
    focus.push('Festékzárás, help rotációk gyorsítása');
  }
  if (scoreAbove(benchmarks, opponent, 'assist_rate', 60)) {
    focus.push('Labdajáratás bontása, passzsávok zárása');
  }
  if (scoreAbove(benchmarks, opponent, 'turnover_rate', 60)) {
    focus.push('Nyomás alatt labdaeladás kényszerítése');
  }

  if (scoreAbove(benchmarks, ownTeam, 'pace', 60) && scoreBelow(benchmarks, opponent, 'pace', 40)) {
    focus.push('Gyorsabb tempó erőltetése');
  }
  if (scoreAbove(benchmarks, ownTeam, 'assist_rate', 60) && scoreBelow(benchmarks, opponent, 'assist_rate', 40)) {
    focus.push('Labdajáratásból előny építése');
  }

  if (scoreBelow(benchmarks, opponent, 'three_pct', 40) && scoreAbove(benchmarks, ownTeam, 'three_rate', 60)) {
    focus.push('Külső dobóterhelés növelése (ellenfél gyenge periméter-hatékonyság)');
  }
  if (scoreBelow(benchmarks, opponent, 'turnover_rate', 40) && scoreAbove(benchmarks, ownTeam, 'turnover_rate', 60)) {
    focus.push('Labdabiztonság kiemelt, az ellenfél védekezése nem kényszerít labdaeladást');
  }
  if (scoreAbove(benchmarks, opponent, 'turnover_rate', 60) && scoreAbove(benchmarks, ownTeam, 'stl_per_game', 60)) {
    focus.push('Labdaszerzés maximalizálása, agresszív nyomás engedhető');
  }
  if (scoreBelow(benchmarks, opponent, 'two_rate', 40) && scoreAbove(benchmarks, ownTeam, 'two_rate', 60)) {
    focus.push('Festékelőny erőltetése (ellenfél alacsony 2P-fókusz)');
  }
  if (
    opponent.hasOpponentBox
    && scoreAbove(benchmarks, opponent, 'opp_ft_rate_allowed', 60)
    && scoreAbove(benchmarks, ownTeam, 'two_rate', 55)
  ) {
    focus.push('Festéktámadásból büntetők kiharcolása, drive-and-kick és korai belső érintések erőltetése');
  }

  if (scoreAbove(benchmarks, opponent, 'stl_per_game', 60) && scoreAbove(benchmarks, ownTeam, 'turnover_rate', 50)) {
    focus.push('Labdabiztonság vs labdanyomás, egyszerűsített döntések, letámadás-bontó sémák');
  }
  if (scoreAbove(benchmarks, ownTeam, 'oreb_rate', 60) && scoreBelow(benchmarks, opponent, 'oreb_rate', 40)) {
    focus.push('OREB agresszivitás növelése, második esélyek kihasználása');
  }

  if (xFactors && xFactors.primary.short !== xFactors.secondary.short && !focus.some(item => item.startsWith('Ha '))) {
    contingencyFocus = `Ha ${xFactors.primary.short} nem működik → ${xFactors.secondary.short}`;
  }

  const uniqueFocus = Array.from(new Set(focus)).slice(0, 5);
  if (!contingencyFocus) return uniqueFocus;
  if (uniqueFocus.includes(contingencyFocus)) return uniqueFocus;
  if (uniqueFocus.length < 5) return [...uniqueFocus, contingencyFocus];
  uniqueFocus[4] = contingencyFocus;
  return uniqueFocus;
};

const buildRiskNotes = (
  opponent: NormalizedTeamStats,
  ownTeam: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks
) => {
  const riskFlags: string[] = [];

  if (scoreAbove(benchmarks, opponent, 'ft_rate', 65)) {
    riskFlags.push('FT-rate volumen kockázat (fault + vonal)');
  }
  if (scoreAbove(benchmarks, opponent, 'oreb_rate', 65)) {
    riskFlags.push('OREB volumen kockázat (második esélyek)');
  }
  if (scoreAbove(benchmarks, opponent, 'stl_per_game', 60) && scoreAbove(benchmarks, ownTeam, 'turnover_rate', 50)) {
    riskFlags.push('Labdabiztonsági kockázat (nyomás alatti TO)');
  }

  return {
    note: riskFlags.length > 0 ? `Kockázati jelzők: ${riskFlags.join(', ')}.` : '',
    flags: riskFlags,
  };
};

const buildTempoControlNote = (
  opponent: NormalizedTeamStats,
  ownTeam: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks
) => {
  const dominantAxis = getDominantAxis(opponent, benchmarks);
  if (dominantAxis !== 'transition') return '';

  if (getTempoBand(opponent, benchmarks, ownTeam) !== 'high') return '';

  return getTempoBand(ownTeam, benchmarks, opponent) === 'low'
    ? 'Kontrollált tempó kockázat: átmeneti játékot preferáló ellenfél, futások megfékezése kulcs.'
    : 'Tempó-futás kontroll: futások kezelése és defenzív egyensúly fenntartása kiemelt feladat.';
};

const buildMatchupRealizationNote = (
  positionComparison: PositionComparison[],
  profile: ReturnType<typeof buildTeamStyle>
) => {
  const perimeterDelta = positionComparison
    .filter(item => ['PG', 'SG', 'SF'].includes(item.position))
    .reduce((sum, item) => sum + item.deltaValPer36, 0);
  const frontcourtDelta = positionComparison
    .filter(item => ['PF', 'C'].includes(item.position))
    .reduce((sum, item) => sum + item.deltaValPer36, 0);

  const notes: string[] = [];
  if (perimeterDelta >= 3 && profile.defense.includes('Labdanyomás')) {
    notes.push('Periméter előny csak stabil labdabiztonsággal és tudatos térnyitással realizálható (ellenfél labdanyomás).');
  }
  if (frontcourtDelta >= 3 && (profile.defense.includes('Festékvédelem') || profile.defense.includes('Kevés faultos védekezés'))) {
    notes.push('Belső poszt előny kihasználása térnyitást és faultkikényszerítést igényel (festékvédelem).');
  }

  return notes.join(' ');
};

const buildCriticalMatchupNote = (
  positionComparison: PositionComparison[],
  winProbability: ScoutingReport['winProbability'],
  ownTeamName: string
) => {
  const biggestNegative = positionComparison
    .filter(item => item.deltaValPer36 <= -2)
    .sort((a, b) => a.deltaValPer36 - b.deltaValPer36)[0];
  const biggestPositive = positionComparison
    .filter(item => item.deltaValPer36 >= 2)
    .sort((a, b) => b.deltaValPer36 - a.deltaValPer36)[0];

  if (!biggestNegative && !biggestPositive) return '';

  const parts: string[] = [];

  if (biggestNegative) {
    parts.push(
      `${withArticle(POSITION_LABELS[biggestNegative.position])} poszton van a legnagyobb rés (${biggestNegative.deltaValPer36} VAL/36)`
    );
  }

  if (biggestPositive) {
    parts.push(
      `${ownTeamName} legerősebb visszaütési pontja ${withArticle(POSITION_LABELS[biggestPositive.position])} poszt (${biggestPositive.deltaValPer36 >= 0 ? '+' : ''}${biggestPositive.deltaValPer36} VAL/36)`
    );
  }

  if (biggestNegative && biggestPositive) {
    if (Math.abs(biggestNegative.deltaValPer36) > biggestPositive.deltaValPer36 + 2) {
      parts.push('ez részben kompenzálható, de a nettó matchup-mérleg még mindig inkább az ellenfél felé billen');
    } else {
      parts.push('ez magyarázza, hogy egy önmagában kellemetlen poszthátrány nem feltétlenül döntő, ha más tengelyeken van visszaütési pont');
    }
  } else if (biggestNegative && winProbability.predictedWinner === 'own') {
    parts.push('a modell így is az összképet favorizálja, de ez a rés érzékeny pont marad');
  }

  return parts.length > 0 ? `Megjegyzés: ${parts.join(', ')}.` : '';
};

const X_FACTOR_CANDIDATES: Record<'perimeter' | 'turnover' | 'rebound_edge' | 'tempo' | 'paint', XFactorCandidate> = {
  perimeter: { key: 'perimeter', label: 'periméter kontrollja és tripla-variancia kezelése', short: 'periméter kontroll' },
  turnover: { key: 'turnover', label: 'labdaszerzések és extra támadások menedzselése', short: 'labdaszerzés / extra támadások' },
  rebound_edge: { key: 'rebound_edge', label: 'támadólepattanó fókusz és második esélyek maximalizálása', short: 'OREB / második esély' },
  tempo: { key: 'tempo', label: 'átmeneti futások kontrollja és visszarendeződés', short: 'tempó kontroll' },
  paint: { key: 'paint', label: 'festék kontrollja és faultterhelés menedzselése', short: 'festék kontroll' },
};

const buildXFactors = (
  opponent: NormalizedTeamStats,
  ownTeam: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks,
  threats: string[],
  vulnerabilities: string[]
): XFactorInsight => {
  const candidates: XFactorCandidate[] = [];

  const hasPerimeterThreat = threats.some(item => item.includes('tripla') || item.includes('3P'));
  const hasTurnoverWeakness = vulnerabilities.some(item => item.toLowerCase().includes('labdaeladás'));
  const hasReboundOpportunity = vulnerabilities.some(item => item.toLowerCase().includes('lepattanó'));
  const tempoScore = getPercentileScore(benchmarks, opponent, 'pace');

  if (hasPerimeterThreat) candidates.push(X_FACTOR_CANDIDATES.perimeter);
  if (hasTurnoverWeakness) candidates.push(X_FACTOR_CANDIDATES.turnover);
  if (hasReboundOpportunity) candidates.push(X_FACTOR_CANDIDATES.rebound_edge);
  if (tempoScore >= 70) candidates.push(X_FACTOR_CANDIDATES.tempo);
  if (!candidates.some(item => item.key === 'paint')) candidates.push(X_FACTOR_CANDIDATES.paint);

  const primary = candidates[0];
  // A másodlagos X-faktor sosem lehet azonos az elsődlegessel. Ha a szabályok
  // csak egy jelöltet adnak, a maradék tengelyek közül a legerősebb jelzésű lép
  // be (saját OREB, ellenfél labdaeladás, ellenfél tripla-profil, ellenfél tempó).
  const fallbackIntensity: Record<string, number> = {
    rebound_edge: getPercentileScore(benchmarks, ownTeam, 'oreb_rate'),
    turnover: getPercentileScore(benchmarks, opponent, 'turnover_rate'),
    perimeter: (getPercentileScore(benchmarks, opponent, 'three_rate') + getPercentileScore(benchmarks, opponent, 'three_pct')) / 2,
    tempo: tempoScore,
    paint: (getPercentileScore(benchmarks, ownTeam, 'two_rate') + getPercentileScore(benchmarks, ownTeam, 'ft_rate')) / 2,
  };
  const secondary = candidates.find(item => item.key !== primary.key)
    ?? Object.values(X_FACTOR_CANDIDATES)
      .filter(item => item.key !== primary.key)
      .sort((a, b) => (fallbackIntensity[b.key] ?? 0) - (fallbackIntensity[a.key] ?? 0))[0];

  return { primary, secondary };
};

const buildXFactorImpact = (
  xFactors: XFactorInsight,
  opponent: NormalizedTeamStats,
  ownTeam: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks
): XFactorImpact => {
  const baseByKey: Record<string, { floor: number; ceiling: number }> = {
    perimeter: { floor: 1.8, ceiling: 4.6 },
    turnover: { floor: 1.4, ceiling: 3.9 },
    rebound_edge: { floor: 1.2, ceiling: 3.6 },
    tempo: { floor: 1.4, ceiling: 4.1 },
    paint: { floor: 1.2, ceiling: 3.4 },
  };

  const blend = (floor: number, ceiling: number, ratio: number) =>
    floor + (ceiling - floor) * clamp(ratio, 0, 1);

  const keyDelta = (key?: string) => {
    if (!key) return 1.6;
    const range = baseByKey[key] ?? { floor: 1.2, ceiling: 3.2 };
    const perimeterIntensity = (
      getPercentileScore(benchmarks, opponent, 'three_rate') +
      getPercentileScore(benchmarks, opponent, 'three_pct')
    ) / 200;
    const turnoverIntensity = (
      getPercentileScore(benchmarks, opponent, 'turnover_rate') +
      getPercentileScore(benchmarks, ownTeam, 'stl_per_game')
    ) / 200;
    const reboundIntensity = (
      getPercentileScore(benchmarks, ownTeam, 'oreb_rate') +
      (100 - getPercentileScore(benchmarks, opponent, 'oreb_rate'))
    ) / 200;
    const tempoIntensity = clamp(
      (Math.abs(getPercentileScore(benchmarks, ownTeam, 'pace') - getPercentileScore(benchmarks, opponent, 'pace')) +
        getPercentileScore(benchmarks, opponent, 'pace')) / 180,
      0,
      1
    );
    const paintIntensity = (
      getPercentileScore(benchmarks, ownTeam, 'two_rate') +
      getPercentileScore(benchmarks, ownTeam, 'ft_rate')
    ) / 200;

    const intensityByKey: Record<string, number> = {
      perimeter: perimeterIntensity,
      turnover: turnoverIntensity,
      rebound_edge: reboundIntensity,
      tempo: tempoIntensity,
      paint: paintIntensity,
    };

    return round(blend(range.floor, range.ceiling, intensityByKey[key] ?? 0.5), 1);
  };

  const primaryDeltaPct = keyDelta(xFactors.primary.key);
  const secondaryDeltaPct = round(keyDelta(xFactors.secondary.key) * 0.7, 1);
  const combinedDeltaPct = round(primaryDeltaPct + secondaryDeltaPct, 1);

  return {
    primaryDeltaPct,
    secondaryDeltaPct,
    combinedDeltaPct,
  };
};

const buildRiskScenarios = (
  riskFlags: string[],
  opponent: NormalizedTeamStats,
  ownTeam: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks,
  varianceDrivers: string[] = []
): RiskScenario[] => {
  const scenarios: RiskScenario[] = [];

  const oppFtScore = getPercentileScore(benchmarks, opponent, 'ft_rate');
  const oppOrebScore = getPercentileScore(benchmarks, opponent, 'oreb_rate');
  const oppStlScore = getPercentileScore(benchmarks, opponent, 'stl_per_game');
  const ownToScore = getPercentileScore(benchmarks, ownTeam, 'turnover_rate');
  const oppThreeBlend =
    (getPercentileScore(benchmarks, opponent, 'three_rate') + getPercentileScore(benchmarks, opponent, 'three_pct')) / 2;
  const paceGap = Math.abs(getPercentileScore(benchmarks, ownTeam, 'pace') - getPercentileScore(benchmarks, opponent, 'pace'));

  const dynamicSwing = (base: number, intensity: number, max: number) =>
    -round(clamp(base + (intensity / 100) * (max - base), base, max), 1);

  if (riskFlags.some(flag => flag.toLowerCase().includes('ft-rate'))) {
    scenarios.push({
      title: 'Faultterhelés felpörgése',
      trigger: 'Az ellenfél sokat jut vonalra az első félidőben.',
      instantResponse: 'Korai rotáció, festéksegítés késleltetése, verticality-fókusz.',
      estimatedOwnSwingPct: dynamicSwing(2.4, oppFtScore, 6.4),
    });
  }

  if (riskFlags.some(flag => flag.toLowerCase().includes('oreb'))) {
    scenarios.push({
      title: 'Második esély pontok',
      trigger: 'Két egymást követő támadólepattanó ugyanabban a szakaszban.',
      instantResponse: 'Plusz boxout szabály, gyengeoldali zárás, hosszú lepattanó-vadászat.',
      estimatedOwnSwingPct: dynamicSwing(2.1, oppOrebScore, 5.8),
    });
  }

  if (riskFlags.some(flag => flag.toLowerCase().includes('labdabiztons'))) {
    scenarios.push({
      title: 'Nyomás alatti eladások',
      trigger: '3+ gyorsindítás kapott pont labdaeladásból negyeden belül.',
      instantResponse: 'Két labdakezelős felállás, rövid outlet, első passz egyszerűsítése.',
      estimatedOwnSwingPct: dynamicSwing(2.6, (oppStlScore + ownToScore) / 2, 6.8),
    });
  }

  if (scoreAbove(benchmarks, opponent, 'three_rate', 60) && scoreAbove(benchmarks, opponent, 'three_pct', 60)) {
    scenarios.push({
      title: 'Periméter-run veszély',
      trigger: 'Két gyors tripla ugyanabból az akciótípusból.',
      instantResponse: 'Switch-szigorítás, agresszívabb első closeout, zóna-look 1-2 támadásra.',
      estimatedOwnSwingPct: dynamicSwing(2.2, oppThreeBlend, 6.3),
    });
  }

  // A variancia-forrás (lásd `buildVarianceDrivers`) mindig kockázati trigger is:
  // a „magas variancia” és a „nincs trigger” nem állhat egyszerre a riportban.
  const hasScenario = (title: string) => scenarios.some(item => item.title === title);
  if (varianceDrivers.includes(VARIANCE_DRIVER_THREE) && !hasScenario('Periméter-run veszély')) {
    const ownThreeBlend =
      (getPercentileScore(benchmarks, ownTeam, 'three_rate') + getPercentileScore(benchmarks, ownTeam, 'three_pct')) / 2;
    scenarios.push({
      title: 'Tripla-variancia',
      trigger: 'Egy negyeden belül 3+ tripla-különbség bármelyik irányban.',
      instantResponse: 'Closeout-fegyelem a dobókra, saját oldalon a rossz ritmusú korai triplák visszafogása.',
      estimatedOwnSwingPct: dynamicSwing(1.6, Math.max(oppThreeBlend, ownThreeBlend), 4.8),
    });
  }
  if (varianceDrivers.includes(VARIANCE_DRIVER_FT) && !hasScenario('Faultterhelés felpörgése')) {
    scenarios.push({
      title: 'Faultterhelés felpörgése',
      trigger: 'Bármelyik csapat a negyed felénél bónuszba kerül.',
      instantResponse: 'Fault-fegyelem a kulcsjátékosokon, korai rotáció a 2 faultos játékosnál.',
      estimatedOwnSwingPct: dynamicSwing(1.6, Math.max(oppFtScore, getPercentileScore(benchmarks, ownTeam, 'ft_rate')), 4.6),
    });
  }

  if (getTempoBand(ownTeam, benchmarks, opponent) === 'low' && getTempoBand(opponent, benchmarks, ownTeam) === 'high') {
    scenarios.push({
      title: 'Tempó-szétcsúszás',
      trigger: 'A meccs a saját tempó felett pörög két negyeden át.',
      instantResponse: 'Támadóidő mélyebb kihasználása, támadólepattanó-visszafogás, korai visszarendeződés.',
      estimatedOwnSwingPct: dynamicSwing(1.8, paceGap, 5.2),
    });
  }

  if (scenarios.length === 0) {
    // Nincs aktív trigger → nincs modellezett negatív swing; ez az alapsor.
    scenarios.push({
      title: BASELINE_RISK_SCENARIO_TITLE,
      trigger: 'Egyik kockázati trigger sem aktív.',
      instantResponse: 'Félpályás ritmuskontroll, stabil kezdő rotáció és tudatosan időzített timeout a spacing resethez.',
      estimatedOwnSwingPct: 0,
    });
  }

  return scenarios.slice(0, 4);
};

/** A forgatókönyvek modell-eltolása logitban (az 50%-os pp-ből átváltva). */
type ScenarioLogits = { controlled: number; highVariance: number };

const buildScenarioLogits = (
  winProbability: Pick<ScoutingReport['winProbability'], 'confidence'>,
  xFactorPpAtEven: { primaryDeltaPct: number; secondaryDeltaPct: number },
  varianceDrivers: string[],
  riskScenarios: RiskScenario[]
): ScenarioLogits => {
  const downside = Math.abs(riskScenarios.reduce((sum, item) => sum + Math.min(item.estimatedOwnSwingPct, 0), 0));
  const confidenceMultiplier = winProbability.confidence === 'High'
    ? 0.85
    : winProbability.confidence === 'Medium'
      ? 1
      : 1.15;
  // A két forgatókönyv független: a kontrollált az X-faktorokból, a magas
  // varianciájú a variancia-forrásokból és a kockázati triggerekből számol.
  const variancePenaltyPp = clamp(0.9 + varianceDrivers.length * 1.15 + downside * 0.16, 1.2, 8.6);
  return {
    controlled: ppAtEvenToLogit(xFactorPpAtEven.primaryDeltaPct + xFactorPpAtEven.secondaryDeltaPct),
    highVariance: -ppAtEvenToLogit(variancePenaltyPp * confidenceMultiplier + downside * 0.32),
  };
};

const buildScenarioOutcomes = (
  winProbability: ScoutingReport['winProbability'],
  scenarioLogits: ScenarioLogits,
  riskScenarios: RiskScenario[],
  ownTeamName: string,
  opponentTeamName: string
): ScenarioOutcome[] => {
  const baseOwn = winProbability.ownPct;
  const baseLogit = winProbability.breakdown?.finalLogit ?? logit(clamp(baseOwn / 100, 0.01, 0.99));
  const makeScenario = (key: string, label: string, deltaLogit: number, note: string): ScenarioOutcome => {
    const ownPct = deltaLogit === 0 ? baseOwn : toShownPct(baseLogit + deltaLogit);
    return {
      key,
      label,
      ownPct,
      opponentPct: round(100 - ownPct, 1),
      deltaVsBase: round(ownPct - baseOwn, 1),
      note,
    };
  };

  return [
    makeScenario(
      'base',
      'Alapforgatókönyv',
      0,
      `Kiinduló modell a jelenlegi statisztikai állapot szerint (${ownTeamName} vs ${opponentTeamName}).`
    ),
    makeScenario(
      'controlled_tempo',
      'Kontrollált tempó és fókuszált végrehajtás',
      scenarioLogits.controlled,
      'A kulcsfaktorok realizálódnak, a tempó kontrollált marad.'
    ),
    makeScenario(
      'high_variance',
      'Magas variancia, ellenfél futásokkal',
      scenarioLogits.highVariance,
      riskScenarios.some(item => item.estimatedOwnSwingPct < 0)
        ? 'A kockázati triggerek (lásd a kockázati táblát) az ellenfél oldalára billentik a futásokat.'
        : 'Általános szórás: kockázati trigger nélkül is előforduló ellenfél-futások.'
    ),
  ];
};

const buildCalibrationDiagnostics = (
  opponent: NormalizedTeamStats,
  ownTeam: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks,
  varianceDrivers: string[],
  riskFlags: string[]
): CalibrationDiagnostics => {
  const perimeterScore = round(
    (getPercentileScore(benchmarks, opponent, 'three_rate') +
      getPercentileScore(benchmarks, opponent, 'three_pct')) / 2,
    1
  );
  const pressureScore = round(
    (getPercentileScore(benchmarks, opponent, 'stl_per_game') +
      getPercentileScore(benchmarks, ownTeam, 'turnover_rate')) / 2,
    1
  );
  const paintScore = round(
    (getPercentileScore(benchmarks, ownTeam, 'two_rate') +
      getPercentileScore(benchmarks, ownTeam, 'ft_rate') +
      (100 - getPercentileScore(benchmarks, opponent, 'fouls_per_game'))) / 3,
    1
  );
  const tempoScore = round(
    clamp(
      (Math.abs(getPercentileScore(benchmarks, ownTeam, 'pace') - getPercentileScore(benchmarks, opponent, 'pace')) +
        getPercentileScore(benchmarks, opponent, 'pace')) / 1.8,
      0,
      100
    ),
    1
  );
  const volatilityScore = round(
    clamp(
      varianceDrivers.length * 22 + riskFlags.length * 12,
      0,
      100
    ),
    1
  );

  const scoreToNote = (score: number) => {
    if (score >= 70) return 'Magas';
    if (score >= 45) return 'Közepes';
    return 'Alacsony';
  };

  const dimensions: CalibrationDimension[] = [
    {
      key: 'perimeter_pressure',
      label: 'Periméter nyomás',
      score: perimeterScore,
      note: scoreToNote(perimeterScore),
      context: `Ellenfél 3P-profil: ${opponent.threePct.toFixed(1)}% tripla, ${(opponent.threeRate * 100).toFixed(1)}% triplaarány.`,
    },
    {
      key: 'ball_pressure',
      label: 'Labdanyomás / TO-kockázat',
      score: pressureScore,
      note: scoreToNote(pressureScore),
      context: `Labdanyomás olvasat: ${(opponent.games > 0 ? opponent.stl / opponent.games : 0).toFixed(1)} labdaszerzés/meccs vs ${(ownTeam.turnoverRate * 100).toFixed(1)}% saját TO%.`,
    },
    {
      key: 'paint_edge',
      label: 'Festék-faultelőny',
      score: paintScore,
      note: scoreToNote(paintScore),
      context: `Festékből generálható faultnyomás: ${(ownTeam.ftRate * 100).toFixed(1)}% saját FT rate vs ${(opponent.games > 0 ? opponent.fouls / opponent.games : 0).toFixed(1)} fault/meccs ellenféloldalon.`,
    },
    {
      key: 'tempo_gap',
      label: 'Tempó-eltérés',
      score: tempoScore,
      note: scoreToNote(tempoScore),
      context: `Tempóprofil: saját ${ownTeam.pace.toFixed(1)} poss/meccs vs ellenfél ${opponent.pace.toFixed(1)} poss/meccs.`,
    },
    {
      key: 'volatility',
      label: 'Variancia-kitettség',
      score: volatilityScore,
      note: scoreToNote(volatilityScore),
      context: varianceDrivers.length > 0
        ? `Varianciaforrások: ${varianceDrivers.join(', ')}${riskFlags.length > 0 ? ` | kockázati zászlók: ${riskFlags.join(', ')}` : ''}.`
        : 'Nincs kiugró varianciaforrás vagy extra kockázati zászló.',
    },
  ];

  const overallIntensity = round(
    dimensions.reduce((sum, item) => sum + item.score, 0) / (dimensions.length || 1),
    1
  );

  const overallLabel = scoreToNote(overallIntensity);

  return {
    overallIntensity,
    scaleLabel: '0-100 matchup-intenzitás skála',
    summary: `${overallLabel} nehézségű matchup; a magasabb értékek azok a tengelyek, ahol a párosítás leginkább kilengést okozhat.`,
    dimensions,
  };
};

const buildFanSummary = (
  ownTeamName: string,
  opponentTeamName: string,
  winProbability: ScoutingReport['winProbability'],
  threats: string[],
  vulnerabilities: string[],
  focusPoints: string[],
  positionComparison: PositionComparison[],
  riskScenarios: RiskScenario[]
): FanSummary => {
  const ownEdgePositions = positionComparison
    .filter(item => item.deltaValPer36 >= 2)
    .map(item => POSITION_LABELS[item.position] ?? item.position)
    .slice(0, 3);

  const favoredPct = winProbability.predictedWinner === 'own'
    ? winProbability.ownPct
    : winProbability.predictedWinner === 'opponent'
      ? winProbability.opponentPct
      : 50;

  const headline = winProbability.predictedWinner === 'own'
    ? favoredPct >= 70
      ? `${ownTeamName} erős favoritnak számít, de a matchup kulcsterületeit így is kontrollálni kell.`
      : favoredPct >= 60
        ? `${ownTeamName} világos előnyben van, de fegyelmezett végrehajtás kell a modell realizálásához.`
        : `${ownTeamName} enyhe-mérsékelt előnyben van, a futások kezelése döntheti el a meccset.`
    : winProbability.predictedWinner === 'opponent'
      ? favoredPct >= 70
        ? `${opponentTeamName} egyértelmű favorit, ezért magas fegyelmi szint és jó ritmusváltás kell a fordításhoz.`
        : favoredPct >= 60
          ? `${opponentTeamName} jelentős előnyben van, ezért kontrollált tempó és a legerősebb saját tengelyek maximalizálása kell a meccs nyitva tartásához.`
          : `${opponentTeamName} enyhe-mérsékelt előnyben van, jó ritmusváltással nyitva tartható a matchup.`
      : 'Kiegyenlített párharc várható, a kulcsfutások dönthetnek a végjátékban.';

  return {
    headline,
    keyEdges: [
      ownEdgePositions.length > 0
        ? `Pozíciós előny: ${ownEdgePositions.join(', ')}.`
        : 'Nincs egyértelmű posztfölény, párosítási döntések lesznek a kulcs.',
      ...vulnerabilities.slice(0, 2).map(item => `Támadható pont: ${item}.`),
    ].slice(0, 3),
    majorRisks: [
      ...threats.slice(0, 2).map(item => item.endsWith('.') ? item : `${item}.`),
      ...riskScenarios
        .filter(item => item.title !== BASELINE_RISK_SCENARIO_TITLE)
        .slice(0, 1)
        .map(item => `${item.title}: ${item.trigger}`),
    ].slice(0, 3),
    gamePlan: focusPoints.slice(0, 3),
    fallbackPlan: riskScenarios.slice(0, 2).map(item => item.instantResponse),
  };
};

const formatRecord = (record: PregameTeamRecord) =>
  `${record.wins}–${record.losses} (otthon ${record.homeWins}–${record.homeLosses}, idegenben ${record.awayWins}–${record.awayLosses})`;

const formatForm = (record: PregameTeamRecord) =>
  record.last5.length > 0 ? record.last5.map(item => (item === 'W' ? 'Gy' : 'V')).join('-') : 'nincs eredmény';

/** A mérkőzés-kontextus egy mondatban (summary és export). */
export const describeMatchContext = (context: PregameMatchContext, ownTeamName: string, opponentTeamName: string) => {
  const venueText = context.venue === 'home'
    ? `${ownTeamName} hazai pályán${context.matchDate ? ` (${context.matchDate})` : ''}`
    : context.venue === 'away'
      ? `${ownTeamName} idegenben${context.matchDate ? ` (${context.matchDate})` : ''}`
      : 'pályaválasztó nem ismert';
  const h2hText = context.headToHead.length > 0
    ? context.headToHead
      .map(game => `${game.date} ${game.venue === 'home' ? 'otthon' : 'idegenben'} ${game.ownScore}–${game.opponentScore}`)
      .join(', ')
    : 'idén még nem találkoztak';
  return `Mérkőzés-kontextus: ${venueText}. Mérleg: ${ownTeamName} ${formatRecord(context.ownRecord)}, ${opponentTeamName} ${formatRecord(context.opponentRecord)}. Forma (utolsó 5): ${ownTeamName} ${formatForm(context.ownRecord)}, ${opponentTeamName} ${formatForm(context.opponentRecord)}. Egymás ellen: ${h2hText}.`;
};

const buildSummary = (
  opponent: NormalizedTeamStats,
  ownTeam: NormalizedTeamStats,
  profile: ReturnType<typeof buildTeamStyle>,
  threats: string[],
  vulnerabilities: string[],
  benchmarks: LeagueTeamBenchmarks,
  winProbability: ScoutingReport['winProbability'],
  positionComparison: PositionComparison[],
  xFactors: XFactorInsight,
  matchupRealizationNote: string,
  tempoControlNote: string,
  focusPoints: string[],
  ownTeamName: string,
  riskFlags: string[] = [],
  varianceDrivers: string[] = [],
  xFactorImpact?: XFactorImpact,
  riskScenarios: RiskScenario[] = [],
  fanSummary?: FanSummary,
  positionComparisonNote?: string,
  injuryContext?: { own: string[]; opponent: string[] },
  confidenceReasons: string[] = [],
  shotProfileNotes: string[] = [],
  shotDefenseNotes: string[] = [],
  matchContext?: PregameMatchContext | null,
  injuryImpact?: { own: PregameInjuryImpactReport; opponent: PregameInjuryImpactReport } | null,
  matchupAxis?: MatchupAxis
) => {
  const tempo = describeTempo(opponent, benchmarks, ownTeam);
  const offense = profile.offense.length > 0 ? profile.offense.join(', ') : 'kiegyensúlyozott';
  const defense = profile.defense.length > 0 ? profile.defense.join(', ') : 'kiegyensúlyozott';
  const matchupAxisText = matchupAxis
    ? ` Döntő tengely: ${matchupAxis.axisLabel} (${matchupAxis.metricLabel} ${matchupAxis.ownValue} vs ${matchupAxis.opponentValue}, z = ${matchupAxis.z >= 0 ? '+' : ''}${matchupAxis.z.toFixed(1)} – a legnagyobb, liga-szórással mért eltérés).`
    : '';

  const viewpointLine = `Elemzés nézőpontja: ${ownTeamName}`;
  const favoredLabel = winProbability.predictedWinner === 'even'
    ? 'Nincs (egyensúly)'
    : winProbability.predictedWinner === 'own'
      ? ownTeamName
      : opponent.teamName;
  const probabilityText = winProbability.predictedWinner === 'even'
    ? 'Valószínűség: 50-50'
    : `Valószínűség: ${winProbability.ownPct}% - ${winProbability.opponentPct}%`;
  const favoredPct = winProbability.predictedWinner === 'even'
    ? 50
    : winProbability.predictedWinner === 'own'
      ? winProbability.ownPct
      : winProbability.opponentPct;
  const confidenceMap: Record<ScoutingReport['winProbability']['confidence'], string> = {
    High: 'Bizonyosság: Magas',
    Medium: 'Bizonyosság: Közepes',
    Low: 'Bizonyosság: Alacsony',
  };
  const probabilityConfidenceLabel = favoredPct >= 55 && favoredPct <= 60
    ? 'Bizonyosság: Közepes–alacsony'
    : confidenceMap[winProbability.confidence];
  const probabilityLine = `Eredmény-prognózis: Várható győztes: ${favoredLabel} | ${probabilityText} | ${probabilityConfidenceLabel}.`;
  const confidenceReasonLine = confidenceReasons.length > 0
    ? `Bizonyosság kontextusa: ${confidenceReasons.join(' • ')}.`
    : '';

  const threatText = threats.length > 0
    ? threats.join('; ')
    : 'kiegyensúlyozott fegyvertár, extrém veszély nélkül';
  const vulnText = vulnerabilities.length > 0
    ? vulnerabilities.join('; ')
    : 'matchupfüggő, rendszerszintű rés nem látszik';
  // A kockázati jelzők és a kockázati tábla triggerei ugyanazt mondják: ha nincs
  // jelző, de van aktív trigger (pl. variancia-forrás), azt nevezzük meg.
  const activeRiskTitles = riskScenarios
    .filter(item => item.title !== BASELINE_RISK_SCENARIO_TITLE)
    .map(item => item.title.toLowerCase());
  const ownRiskText = riskFlags.length > 0
    ? riskFlags.join('; ')
    : activeRiskTitles.length > 0
      ? activeRiskTitles.join('; ')
      : 'nincs aktív kockázati trigger';
  const injuryLine = (() => {
    const describe = (names: string[] | undefined, impact?: PregameInjuryImpactReport) => {
      if (!impact || impact.status === 'unknown') return names?.length ? names.join(', ') : 'nincs adat';
      if (impact.status === 'confirmedNone') return 'nincs ismert hiányzó';
      return `${(names ?? []).join(', ')} (kieső ${impact.lostMinutesPerGame.toFixed(1)} perc, ${impact.lostValPerGame.toFixed(1)} VAL, ${impact.lostPointsPerGame.toFixed(1)} pont meccsenként – a csapat VAL-jának ${(impact.valShare * 100).toFixed(0)}%-a)`;
    };
    const anyInfo = [injuryImpact?.own, injuryImpact?.opponent].some(item => item && item.status !== 'unknown')
      || Boolean(injuryContext?.own?.length || injuryContext?.opponent?.length);
    if (!anyInfo) return '';
    return `Hiányzók: ${ownTeamName}: ${describe(injuryContext?.own, injuryImpact?.own)} | ${opponent.teamName}: ${describe(injuryContext?.opponent, injuryImpact?.opponent)}; a pozíciós VAL/36 már csak az elérhető játékosokból számol.`;
  })();

  const breakdown = winProbability.breakdown;
  const breakdownLine = breakdown
    ? `Valószínűség-bontás (${ownTeamName}): alap ${breakdown.basePct.toFixed(1)}% → matchup ${breakdown.afterMatchupPct.toFixed(1)}% → pályaválasztó ${breakdown.afterHomePct.toFixed(1)}% → hiányzók ${breakdown.finalPct.toFixed(1)}% (log-odds összeadás, puha 3–97%-os sáv).`
    : '';

  const matchContextLine = matchContext ? describeMatchContext(matchContext, ownTeamName, opponent.teamName) : '';

  const { perimeterDelta, frontcourtDelta } = summarizePositionDeltas(positionComparison);
  const posSummary = perimeterDelta >= 3 && frontcourtDelta >= 3
    ? 'Minden poszt-kategóriában saját előny, szisztematikus nyomásgyakorlás fenntartható.'
    : perimeterDelta >= 3 && frontcourtDelta <= -1
    ? 'Periméteren saját előny (PG–SG–SF), az ellenfél inkább a magas posztokon veszélyes.'
    : frontcourtDelta >= 3 && perimeterDelta <= -1
      ? 'Belső poszt előny (PF–C), periméteren óvatos párosítás szükséges.'
      : 'Pozíciós előnyök megoszlanak, párosítás-alapú döntés javasolt.';

  const formatDelta = (value: number) => (value > 0 ? `+${value}` : `${value}`);
  const criticalLine = positionComparison
    .filter(item => item.matchupFlag === 'critical_disadvantage')
    .map(item => `${POSITION_LABELS[item.position] ?? item.position} (${formatDelta(item.deltaValPer36)})`)
    .join(', ');
  const advantageLine = positionComparison
    .filter(item => item.matchupFlag === 'clear_advantage')
    .map(item => `${POSITION_LABELS[item.position] ?? item.position} (${formatDelta(item.deltaValPer36)})`)
    .join(', ');

  const positionSectionParts = [
    `Pozíciós dinamika: ${posSummary} ${matchupRealizationNote}`.trim(),
    criticalLine ? `Kritikus hátrány: ${criticalLine}.` : '',
    advantageLine ? `Egyértelmű előny: ${advantageLine}.` : '',
    positionComparisonNote?.trim() ?? '',
  ].filter(part => part.length > 0);
  const positionSection = positionSectionParts.join(' ');

  const shotProfileLine = shotProfileNotes.length > 0
    ? `Dobástérkép-fókusz: ${shotProfileNotes.join(' • ')}.`
    : '';
  const shotDefenseLine = shotDefenseNotes.length > 0
    ? `Dobástérkép-védekezés: ${shotDefenseNotes.join(' • ')}.`
    : '';

  const focusLine = focusPoints.length > 0
    ? `Fókuszpontok (reakciók): ${focusPoints.join(' • ')}.`
    : '';

  const varianceNote = varianceDrivers.length > 0
    ? `${tempoControlNote ? 'Magas' : 'magas'} varianciájú mérkőzés (${varianceDrivers.join(' + ')}).`
    : '';
  const tempoLineParts = [tempoControlNote, varianceNote].filter(Boolean);
  const tempoLine = tempoLineParts.length > 0
    ? `Tempó és variancia: ${tempoLineParts.join(' ')}`
    : '';

  // Egyetlen X-faktor mondat: a címkék és a számok együtt, a kontrollált
  // forgatókönyv tényleges (az aktuális alapon realizált) eltolásával – ugyanaz, mint a táblában.
  const xFactorNumbers = (pct?: number) => (xFactorImpact && pct !== undefined ? ` (+${pct.toFixed(1)} pp)` : '');
  const controlledDelta = xFactorImpact?.controlledScenarioDeltaPct ?? xFactorImpact?.combinedDeltaPct;
  const xFactorImpactPart = xFactorImpact && controlledDelta !== undefined
    ? `; a kontrollált forgatókönyvben együtt +${controlledDelta.toFixed(1)} pp`
    : '';
  const xFactorLine = `X-faktorok: elsődleges – ${xFactors.primary.label}${xFactorNumbers(xFactorImpact?.primaryDeltaPct)}; másodlagos – ${xFactors.secondary.label}${xFactorNumbers(xFactorImpact?.secondaryDeltaPct)}${xFactorImpactPart}.`;
  const riskScenarioLine = riskScenarios.length > 0
    ? `Ha-bekövetkezik forgatókönyvek: ${riskScenarios.map(item => `${item.title} → ${item.instantResponse}`).join(' | ')}.`
    : '';
  const fanLine = fanSummary?.headline ? `Szurkolói fókusz: ${fanSummary.headline}` : '';

  const sections = [
    viewpointLine,
    probabilityLine,
    breakdownLine,
    confidenceReasonLine,
    `Kontextus: az ellenfél ${tempo}; támadás: ${offense}; védekezés: ${defense}.${matchupAxisText}`,
    `Fő veszélyek: ${threatText}.`,
    `Feltételes sebezhetőségek (ellenfél): ${vulnText}.`,
    `Saját kockázati pontok: ${ownRiskText}.`,
    matchContextLine,
    injuryLine,
    positionSection,
    shotProfileLine,
    shotDefenseLine,
    focusLine,
    tempoLine,
    xFactorLine,
    riskScenarioLine,
    fanLine,
  ]
    .map(tidySentence)
    .filter(line => line.length > 0);

  return sections.join('\n');
};

const computeTeamRating = (team: NormalizedTeamStats, benchmarks: LeagueTeamBenchmarks) => {
  const metrics = [
    { stat: 'efg', weight: 1.4, invert: false },
    { stat: 'turnover_rate', weight: 1.2, invert: true },
    { stat: 'assist_rate', weight: 1.0, invert: false },
    { stat: 'oreb_rate', weight: 0.6, invert: false },
    { stat: 'ft_rate', weight: 0.6, invert: false },
    { stat: 'three_pct', weight: 0.8, invert: false },
    { stat: 'val_per_game', weight: 1.4, invert: false },
    { stat: 'stl_per_game', weight: 0.5, invert: false },
    { stat: 'blk_per_game', weight: 0.4, invert: false },
    { stat: 'fouls_per_game', weight: 0.4, invert: true },
  ];

  const totalWeight = metrics.reduce((sum, metric) => sum + metric.weight, 0) || 1;
  const weightedScore = metrics.reduce((sum, metric) => {
    const percentile = getPercentileScore(benchmarks, team, metric.stat);
    const score = metric.invert ? 100 - percentile : percentile;
    return sum + score * metric.weight;
  }, 0);

  return weightedScore / totalWeight;
};

type BaseWinModel = {
  baseLogit: number;
  confidence: 'Low' | 'Medium' | 'High';
  confidenceReasons: string[];
};

const computeBaseWinModel = (
  ownTeam: NormalizedTeamStats,
  opponentTeam: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks
): BaseWinModel => {
  const ownRating = computeTeamRating(ownTeam, benchmarks);
  const opponentRating = computeTeamRating(opponentTeam, benchmarks);
  const diff = ownRating - opponentRating;

  const ownThreeRateScore = getPercentileScore(benchmarks, ownTeam, 'three_rate');
  const oppThreeRateScore = getPercentileScore(benchmarks, opponentTeam, 'three_rate');
  const volatilityFactor = ownThreeRateScore >= 70 || oppThreeRateScore >= 70 ? 0.9 : 1;

  const adjustedDiff = diff * volatilityFactor;
  const absDiff = Math.abs(adjustedDiff);
  const confidenceReasons: string[] = [];

  let confidence: 'Low' | 'Medium' | 'High' = absDiff >= 16
    ? 'High'
    : absDiff >= 8
      ? 'Medium'
      : 'Low';

  if (absDiff < 8) confidenceReasons.push('szűk rating-különbség');

  const minGames = Math.min(ownTeam.games || 0, opponentTeam.games || 0);
  if (minGames < 10 && confidence === 'High') confidence = 'Medium';
  if (minGames < 10) confidenceReasons.push('korlátozott szezonminta');
  if (volatilityFactor < 1 && confidence === 'High') confidence = 'Medium';
  if (volatilityFactor < 1) confidenceReasons.push('magas tripla-variancia');

  return { baseLogit: adjustedDiff / RATING_LOGIT_DIVISOR, confidence, confidenceReasons };
};

/** A pozíciós matchup-mérleg logitban (súlyozott VAL/36-különbség). */
const computeMatchupLogit = (positionComparison: ReturnType<typeof buildPositionComparison>) => {
  const weightedDelta = positionComparison.reduce((acc, pos) => {
    const w = POSITION_MATCHUP_WEIGHTS[pos.position] ?? 0.20;
    return acc + pos.deltaValPer36 * w;
  }, 0);
  const value = clamp(weightedDelta * MATCHUP_LOGIT_SCALE, -MATCHUP_LOGIT_CAP, MATCHUP_LOGIT_CAP);
  // A korábbi 2 pp-es küszöb logit-megfelelője: zajszintű mérleg nem mozdít.
  return Math.abs(value) < ppAtEvenToLogit(2) ? 0 : value;
};

/** A hiányzók logit-hatása csapatonként (a kieső VAL/meccs a csapat VAL/meccs-éhez mérve). */
const buildInjuryImpactReport = (
  impact: PregameInjuryImpact | undefined,
  team: NormalizedTeamStats,
  sign: 1 | -1
): PregameInjuryImpactReport => {
  const base: PregameInjuryImpact = impact ?? {
    status: 'unknown', players: 0, lostMinutesPerGame: 0, lostValPerGame: 0, lostPointsPerGame: 0, coreNames: [],
  };
  const teamValPerGame = Math.max(team.valPerGame, 0);
  const valShare = teamValPerGame > 0 ? clamp(base.lostValPerGame / teamValPerGame, 0, INJURY_SHARE_CAP) : 0;
  return {
    ...base,
    teamValPerGame: round(teamValPerGame, 1),
    valShare: round(valShare, 3),
    logit: round(sign * -INJURY_LOGIT_SCALE * valShare, 3),
  };
};

/**
 * A győzelmi valószínűség log-odds lánca: alap (rating) + matchup + hazai +
 * hiányzók, a végén puha 3–97%-os sávba képezve. A lépések pp-hatása így az
 * alaptól függ, de sosem nullázódik egy plafonon.
 */
const computeWinProbability = (
  base: BaseWinModel,
  matchupLogit: number,
  homeLogit: number,
  injuryLogit: number,
  matchContext?: PregameMatchContext | null
): ScoutingReport['winProbability'] => {
  const afterMatchup = base.baseLogit + matchupLogit;
  const afterHome = afterMatchup + homeLogit;
  const finalLogit = afterHome + injuryLogit;
  const breakdown: WinProbabilityBreakdown = {
    basePct: toShownPct(base.baseLogit),
    afterMatchupPct: toShownPct(afterMatchup),
    afterHomePct: toShownPct(afterHome),
    finalPct: toShownPct(finalLogit),
    baseLogit: round(base.baseLogit, 3),
    matchupLogit: round(matchupLogit, 3),
    homeLogit: round(homeLogit, 3),
    injuryLogit: round(injuryLogit, 3),
    finalLogit: round(finalLogit, 3),
  };
  const ownPct = breakdown.finalPct;
  const predictedWinner: 'own' | 'opponent' | 'even' =
    Math.abs(ownPct - 50) < 2 ? 'even' : ownPct > 50 ? 'own' : 'opponent';

  const signedPp = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)} pp`;
  const reasons = [...base.confidenceReasons];
  let confidence = base.confidence;
  if (Math.abs(matchupLogit) >= ppAtEvenToLogit(5)) reasons.push('matchup-mérleg korrekció');
  if (confidence === 'High' && Math.abs(matchupLogit) >= ppAtEvenToLogit(8)) confidence = 'Medium';
  if (homeLogit !== 0 && matchContext) {
    reasons.push(
      `${matchContext.venue === 'home' ? 'hazai pálya' : 'idegenbeli meccs'} ${signedPp(breakdown.afterHomePct - breakdown.afterMatchupPct)} (liga hazai győzelmi arány ${matchContext.leagueHomeWinPct?.toFixed(1)}%, ${matchContext.leagueGames} meccs)`
    );
  }
  if (injuryLogit !== 0) reasons.push(`hiányzók ${signedPp(breakdown.finalPct - breakdown.afterHomePct)}`);

  return {
    ownPct,
    opponentPct: round(100 - ownPct, 1),
    predictedWinner,
    confidence,
    confidenceReasons: reasons,
    breakdown,
  };
};

/** A hazai módosító zsugorítása: ennyi meccsnyi „semleges” minta húzza 50% felé. */
const HOME_ADVANTAGE_PRIOR_GAMES = 40;

const emptyRecord = (): PregameTeamRecord => ({
  wins: 0, losses: 0, homeWins: 0, homeLosses: 0, awayWins: 0, awayLosses: 0, last5: [],
});

/**
 * Mérkőzés-kontextus a bajnoki fixture-ökből. A pályaválasztó sorrendje:
 * `venueOverride` (történeti nézetben a kiválasztott meccs), különben a két
 * csapat következő (`asOfDate` utáni) kiírt meccse. A hazai módosító a liga
 * hazai győzelmi arányából jön: `(arány − 50) × n / (n + 40)`, ±6 pp-re vágva.
 */
export const buildPregameMatchContext = (params: {
  playedFixtures: PregameFixture[];
  scheduledFixtures: Array<Pick<PregameFixture, 'homeTeamId' | 'awayTeamId' | 'date'>>;
  ownTeamId: string;
  opponentTeamId: string;
  /** Csak az e dátum előtti eredmények számítanak (történeti nézet). */
  beforeDate?: string | null;
  /** A következő meccs keresésének kezdőnapja (YYYY-MM-DD). */
  asOfDate?: string | null;
  venueOverride?: { venue: 'home' | 'away'; date: string } | null;
}): PregameMatchContext => {
  const { ownTeamId, opponentTeamId, beforeDate } = params;
  const played = params.playedFixtures
    .filter(item => item.homeScore !== null && item.awayScore !== null && item.homeScore !== item.awayScore)
    .filter(item => !beforeDate || item.date < beforeDate)
    .sort((a, b) => a.date.localeCompare(b.date));

  const recordFor = (teamId: string) => {
    const record = emptyRecord();
    const results: Array<'W' | 'L'> = [];
    played.forEach(item => {
      const isHome = item.homeTeamId === teamId;
      if (!isHome && item.awayTeamId !== teamId) return;
      const own = (isHome ? item.homeScore : item.awayScore) as number;
      const opp = (isHome ? item.awayScore : item.homeScore) as number;
      const won = own > opp;
      results.push(won ? 'W' : 'L');
      if (won) record.wins += 1; else record.losses += 1;
      if (isHome) {
        if (won) record.homeWins += 1; else record.homeLosses += 1;
      } else if (won) {
        record.awayWins += 1;
      } else {
        record.awayLosses += 1;
      }
    });
    record.last5 = results.slice(-5);
    return record;
  };

  const headToHead: PregameHeadToHeadGame[] = played
    .filter(item =>
      (item.homeTeamId === ownTeamId && item.awayTeamId === opponentTeamId)
      || (item.homeTeamId === opponentTeamId && item.awayTeamId === ownTeamId))
    .map(item => {
      const ownHome = item.homeTeamId === ownTeamId;
      return {
        date: item.date,
        venue: ownHome ? 'home' as const : 'away' as const,
        ownScore: (ownHome ? item.homeScore : item.awayScore) as number,
        opponentScore: (ownHome ? item.awayScore : item.homeScore) as number,
      };
    });

  let venue: PregameMatchContext['venue'] = 'unknown';
  let matchDate: string | null = null;
  if (params.venueOverride) {
    venue = params.venueOverride.venue;
    matchDate = params.venueOverride.date;
  } else {
    const next = params.scheduledFixtures
      .filter(item =>
        (item.homeTeamId === ownTeamId && item.awayTeamId === opponentTeamId)
        || (item.homeTeamId === opponentTeamId && item.awayTeamId === ownTeamId))
      .filter(item => !params.asOfDate || item.date >= params.asOfDate)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    if (next) {
      venue = next.homeTeamId === ownTeamId ? 'home' : 'away';
      matchDate = next.date;
    }
  }

  const leagueGames = played.length;
  const homeWins = played.filter(item => (item.homeScore as number) > (item.awayScore as number)).length;
  const leagueHomeWinPct = leagueGames > 0 ? (homeWins / leagueGames) * 100 : null;
  // Zsugorított liga hazai győzelmi arány → logit (két egyforma csapatnál a
  // hazai csapat esélye), ±0,24-re vágva.
  const shrunkHomeShare = leagueHomeWinPct === null
    ? 0.5
    : 0.5 + (leagueHomeWinPct / 100 - 0.5) * (leagueGames / (leagueGames + HOME_ADVANTAGE_PRIOR_GAMES));
  const magnitude = clamp(logit(clamp(shrunkHomeShare, 0.01, 0.99)), -HOME_LOGIT_CAP, HOME_LOGIT_CAP);
  const homeLogit = venue === 'home' ? round(magnitude, 3) : venue === 'away' ? round(-magnitude, 3) : 0;

  return {
    venue,
    matchDate,
    ownRecord: recordFor(ownTeamId),
    opponentRecord: recordFor(opponentTeamId),
    headToHead,
    leagueHomeWinPct: leagueHomeWinPct === null ? null : round(leagueHomeWinPct, 1),
    leagueGames,
    homeLogit,
  };
};

export const analyzePreGameScouting = (
  opponentTeam: TeamSeasonStat,
  opponentPlayers: PlayerSeasonStat[],
  ownTeam: TeamSeasonStat,
  leagueBenchmarks: LeagueTeamBenchmarks,
  ownPlayers: PlayerSeasonStat[] = [],
  injuryContext?: { own: string[]; opponent: string[] },
  shotProfiles?: {
    own?: ShotProfileSummary | null;
    opponent?: ShotProfileSummary | null;
    league?: ShotProfileSummary | null;
    ownAllowed?: ShotProfileSummary | null;
    opponentAllowed?: ShotProfileSummary | null;
  },
  extras?: PregameScoutingExtras
): ScoutingReport => {
  const normalizedOpponent = normalizeTeamStats(opponentTeam);
  const normalizedOwn = normalizeTeamStats(ownTeam);

  const opponentStyle = buildTeamStyle(normalizedOpponent, leagueBenchmarks, normalizedOwn);
  const ownStyle = buildTeamStyle(normalizedOwn, leagueBenchmarks, normalizedOpponent);
  const usageShare = computeUsageConcentration(opponentPlayers);
  const ownUsageShare = computeUsageConcentration(ownPlayers);
  const keyPlayers = identifyKeyPlayers(opponentPlayers, usageShare);
  const ownKeyPlayers = identifyKeyPlayers(ownPlayers, ownUsageShare);

  const ownHeightByPos = ownPlayers.reduce((acc, player) => {
    const height = player.heightCm;
    if (typeof height === 'number' && Number.isFinite(height)) {
      getPlayerPositionBuckets(player).forEach(pos => {
        acc[pos] = acc[pos] || { sum: 0, count: 0 };
        acc[pos].sum += height;
        acc[pos].count += 1;
      });
    }
    return acc;
  }, {} as Record<Position, { sum: number; count: number }>);

  const opponentHeightByPos = opponentPlayers.reduce((acc, player) => {
    const height = player.heightCm;
    if (typeof height === 'number' && Number.isFinite(height)) {
      getPlayerPositionBuckets(player).forEach(pos => {
        acc[pos] = acc[pos] || { sum: 0, count: 0 };
        acc[pos].sum += height;
        acc[pos].count += 1;
      });
    }
    return acc;
  }, {} as Record<Position, { sum: number; count: number }>);

  const avgHeight = (map: Record<Position, { sum: number; count: number }>, pos: Position) => {
    const entry = map[pos];
    return entry && entry.count > 0 ? entry.sum / entry.count : null;
  };

  const heightMismatchNotes: string[] = [];
  (['PG', 'SG', 'SF', 'PF', 'C'] as Position[]).forEach(pos => {
    const ownAvg = avgHeight(ownHeightByPos, pos);
    const oppAvg = avgHeight(opponentHeightByPos, pos);
    if (ownAvg && oppAvg && oppAvg - ownAvg >= 4) {
      heightMismatchNotes.push(`Magassági hátrány a ${pos} poszton (≈${round(oppAvg - ownAvg, 1)} cm).`);
    }
  });
  const threats = buildThreats(normalizedOpponent, leagueBenchmarks, usageShare);
  const vulnerabilities = buildVulnerabilities(normalizedOpponent, leagueBenchmarks);
  const positionComparison = buildPositionComparison(ownPlayers, opponentPlayers);
  const injuryImpact = {
    own: buildInjuryImpactReport(extras?.injuryImpact?.own, normalizedOwn, 1),
    opponent: buildInjuryImpactReport(extras?.injuryImpact?.opponent, normalizedOpponent, -1),
  };
  const winProbability = computeWinProbability(
    computeBaseWinModel(normalizedOwn, normalizedOpponent, leagueBenchmarks),
    computeMatchupLogit(positionComparison),
    extras?.matchContext?.homeLogit ?? 0,
    injuryImpact.own.logit + injuryImpact.opponent.logit,
    extras?.matchContext
  );
  const xFactors = buildXFactors(normalizedOpponent, normalizedOwn, leagueBenchmarks, threats, vulnerabilities);
  const baseXFactorImpact = buildXFactorImpact(xFactors, normalizedOpponent, normalizedOwn, leagueBenchmarks);
  const riskNotes = buildRiskNotes(normalizedOpponent, normalizedOwn, leagueBenchmarks);
  const tempoControlNote = buildTempoControlNote(normalizedOpponent, normalizedOwn, leagueBenchmarks);
  const matchupRealizationNote = buildMatchupRealizationNote(positionComparison, opponentStyle);
  const focusPoints = buildFocusPoints(normalizedOpponent, normalizedOwn, leagueBenchmarks, xFactors);
  const positionComparisonNote = buildCriticalMatchupNote(positionComparison, winProbability, ownTeam.teamName);
  const { perimeterDelta, frontcourtDelta } = summarizePositionDeltas(positionComparison);
  const varianceDrivers = buildVarianceDrivers(normalizedOpponent, normalizedOwn, leagueBenchmarks, riskNotes.flags);
  const riskScenarios = buildRiskScenarios(
    riskNotes.flags,
    normalizedOpponent,
    normalizedOwn,
    leagueBenchmarks,
    varianceDrivers
  );
  const shotProfileContext = buildShotProfileContext(
    shotProfiles?.own,
    shotProfiles?.opponent,
    shotProfiles?.league,
    shotProfiles?.ownAllowed,
    shotProfiles?.opponentAllowed
  );
  const scenarioLogits = buildScenarioLogits(winProbability, baseXFactorImpact, varianceDrivers, riskScenarios);
  const scenarioOutcomes = buildScenarioOutcomes(
    winProbability,
    scenarioLogits,
    riskScenarios,
    ownTeam.teamName,
    opponentTeam.teamName
  );
  // Az X-faktorok a tényleges alapon realizált pp-ben: ugyanaz a szám áll a
  // forgatókönyv-táblában, az X-faktor mondatban és a kártyán.
  const finalLogit = winProbability.breakdown?.finalLogit ?? 0;
  const realizedPp = (deltaLogit: number) => round(toShownPct(finalLogit + deltaLogit) - winProbability.ownPct, 1);
  const controlledOutcome = scenarioOutcomes.find(item => item.key === 'controlled_tempo');
  const xFactorImpact: XFactorImpact = {
    primaryDeltaPct: realizedPp(ppAtEvenToLogit(baseXFactorImpact.primaryDeltaPct)),
    secondaryDeltaPct: realizedPp(ppAtEvenToLogit(baseXFactorImpact.secondaryDeltaPct)),
    combinedDeltaPct: controlledOutcome?.deltaVsBase ?? realizedPp(scenarioLogits.controlled),
    controlledScenarioDeltaPct: controlledOutcome?.deltaVsBase ?? realizedPp(scenarioLogits.controlled),
    controlledScenarioCapped: false,
  };
  const calibrationDiagnostics = buildCalibrationDiagnostics(
    normalizedOpponent,
    normalizedOwn,
    leagueBenchmarks,
    varianceDrivers,
    riskNotes.flags
  );
  const fanSummary = buildFanSummary(
    ownTeam.teamName,
    opponentTeam.teamName,
    winProbability,
    threats,
    vulnerabilities,
    focusPoints,
    positionComparison,
    riskScenarios
  );
  const advancedPlayers = {
    own: buildAdvancedPlayers(
      ownPlayers,
      ownTeam.games || normalizedOwn.games || 1,
      ownTeam.val,
      extras?.matchContext ? extras.matchContext.ownRecord.wins : null
    ),
    opponent: buildAdvancedPlayers(
      opponentPlayers,
      opponentTeam.games || normalizedOpponent.games || 1,
      opponentTeam.val,
      extras?.matchContext ? extras.matchContext.opponentRecord.wins : null
    ),
  };
  const advancedPlayersEligibility = {
    own: getAdvancedEligibility(ownTeam.games || normalizedOwn.games || 1),
    opponent: getAdvancedEligibility(opponentTeam.games || normalizedOpponent.games || 1),
  };
  const opponentTempoDescriptor = describeTempo(normalizedOpponent, leagueBenchmarks, normalizedOwn);
  const ownTempoDescriptor = describeTempo(normalizedOwn, leagueBenchmarks, normalizedOpponent);
  const opponentProfile = finalizeTeamProfile(
    getTempoLevelLabel(normalizedOpponent, leagueBenchmarks, normalizedOwn),
    opponentStyle,
    { defensiveDataLimited: opponentStyle.defense.length === 0 }
  );
  const ownTeamProfile = finalizeTeamProfile(
    getTempoLevelLabel(normalizedOwn, leagueBenchmarks, normalizedOpponent),
    ownStyle,
    { defensiveDataLimited: ownStyle.defense.length === 0 }
  );
  const dominantAxis = getDominantAxis(normalizedOpponent, leagueBenchmarks);
  const matchupAxis = getMatchupAxis(normalizedOwn, normalizedOpponent, leagueBenchmarks);
  const significantMatchups = buildSignificantMatchups(positionComparison);
  const llmContext: ScoutingReportLLMContext = {
    opponentTempoDescriptor,
    ownTempoDescriptor,
    opponentDominantAxis: dominantAxis,
    matchupAxis,
    tempoControlNote: tempoControlNote || undefined,
    matchupRealizationNote: matchupRealizationNote || undefined,
    riskNote: riskNotes.note || undefined,
    varianceDrivers,
    confidenceReasons: winProbability.confidenceReasons,
    shotProfileNotes: shotProfileContext?.notes,
    shotDefenseNotes: shotProfileContext?.defenseNotes,
    positionDeltaSummary: {
      perimeterDelta,
      frontcourtDelta,
    },
    significantMatchups,
  };
  const xFactorContext: PreGameXFactorContext = {
    primaryKey: xFactors.primary.key,
    primaryLabel: xFactors.primary.label,
    secondaryKey: xFactors.secondary?.key,
    secondaryLabel: xFactors.secondary?.label,
    primaryDeltaPct: xFactorImpact.primaryDeltaPct,
    secondaryDeltaPct: xFactorImpact.secondaryDeltaPct,
    combinedDeltaPct: xFactorImpact.combinedDeltaPct,
    riskFlags: riskNotes.flags,
  };

  return {
    ownTeamId: ownTeam.teamId,
    ownTeamName: ownTeam.teamName,
    opponentTeamId: opponentTeam.teamId,
    opponentTeamName: opponentTeam.teamName,
    league: opponentTeam.league,
    season: opponentTeam.season,
    winProbability,
    positionComparison,
    profile: opponentProfile,
    ownTeamProfile,
    threats,
    vulnerabilities,
    keyPlayers: {
      ...keyPlayers,
      mismatchCandidates: [...keyPlayers.mismatchCandidates, ...heightMismatchNotes].slice(0, 4),
    },
    ownKeyPlayers,
    focusPoints,
    xFactorContext,
    xFactorImpact,
    scenarioOutcomes,
    riskScenarios,
    fanSummary,
    calibrationDiagnostics,
    shotProfileContext,
    advancedPlayers,
    advancedPlayersEligibility,
    teamStats: {
      own: {
        pace: normalizedOwn.pace,
        paceFromOwnOnly: !normalizedOwn.hasOpponentBox,
        efg: normalizedOwn.efg,
        threeRate: round(normalizedOwn.threeRate * 100, 1),
        threePct: normalizedOwn.threePct,
        turnoverRate: round(normalizedOwn.turnoverRate * 100, 1),
        ftRate: round(normalizedOwn.ftRate * 100, 1),
        orebRate: normalizedOwn.hasOpponentBox ? round(normalizedOwn.orebRate * 100, 1) : null,
        assistRate: round(normalizedOwn.assistRate * 100, 1),
      },
      opponent: {
        pace: normalizedOpponent.pace,
        paceFromOwnOnly: !normalizedOpponent.hasOpponentBox,
        efg: normalizedOpponent.efg,
        threeRate: round(normalizedOpponent.threeRate * 100, 1),
        threePct: normalizedOpponent.threePct,
        turnoverRate: round(normalizedOpponent.turnoverRate * 100, 1),
        ftRate: round(normalizedOpponent.ftRate * 100, 1),
        orebRate: normalizedOpponent.hasOpponentBox ? round(normalizedOpponent.orebRate * 100, 1) : null,
        assistRate: round(normalizedOpponent.assistRate * 100, 1),
      },
    },
    riskFlags: riskNotes.flags,
    matchContext: extras?.matchContext ?? undefined,
    injuryImpact,
    leagueProxyPerAverage: extras?.leagueProxyPerAverage ?? null,
    positionComparisonNote: positionComparisonNote || undefined,
    llmContext,
    summary: buildSummary(
      normalizedOpponent,
      normalizedOwn,
      opponentStyle,
      threats,
      vulnerabilities,
      leagueBenchmarks,
      winProbability,
      positionComparison,
      xFactors,
      matchupRealizationNote,
      tempoControlNote,
      focusPoints,
      ownTeam.teamName,
      riskNotes.flags,
      varianceDrivers,
      xFactorImpact,
      riskScenarios,
      fanSummary,
      positionComparisonNote || '',
      injuryContext,
      winProbability.confidenceReasons,
      shotProfileContext?.notes ?? [],
      shotProfileContext?.defenseNotes ?? [],
      extras?.matchContext,
      injuryImpact,
      matchupAxis
    ),
    injuryContext,
  };
};
