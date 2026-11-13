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

/**
 * Pozíciós összevetés. A `ownValPer36` / `oppValPer36` a 40 percre feltöltött
 * slot-érték (lásd `buildPositionComparison`), a `*RawValPer36` a csak a poszt
 * játékosaiból számolt nyers érték; a delta, a flag és a matchup-logit a
 * feltöltött értékből dolgozik.
 */
export type PositionComparison = {
  position: Position;
  ownValPer36: number;
  oppValPer36: number;
  ownPointsPer36: number;
  oppPointsPer36: number;
  deltaValPer36: number;
  matchupFlag?: 'critical_disadvantage' | 'clear_advantage';
  /** A poszt játékosainak (pozíció-súlyozott) perce csapatmeccsenként. */
  ownMinutesPerGame: number;
  oppMinutesPerGame: number;
  /** A nyers, csak a poszt játékosaiból számolt VAL/36. */
  ownRawValPer36: number;
  oppRawValPer36: number;
  /** Igaz, ha a slotra `LOW_SLOT_MINUTES` alatti perc jut meccsenként. */
  ownLowMinutes: boolean;
  oppLowMinutes: boolean;
};

export type ScoutingReportLLMContext = {
  opponentTempoDescriptor: string;
  ownTempoDescriptor: string;
  opponentDominantAxis: 'transition' | 'periméter' | 'festék';
  /** A legnagyobb nettó matchup-él tengelye (lásd `getMatchupAxis`). */
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

/** A győzelmi esély bizonyosságának címkéje – a summary, az export és a UI közös forrása. */
export const CONFIDENCE_LABELS: Record<'High' | 'Medium' | 'Low', string> = {
  High: 'Magas',
  Medium: 'Közepes',
  Low: 'Alacsony',
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
/**
 * Egy logit-eltolás tényleges pp-hatása a végső esélyen. Ezt használja a
 * forgatókönyv-tábla, a kockázati tábla és az X-faktor is – egyetlen skála.
 */
const realizedLogitPp = (finalLogit: number, baseShownPct: number, deltaLogit: number) =>
  deltaLogit === 0 ? 0 : round(toShownPct(finalLogit + deltaLogit) - baseShownPct, 1);
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
  /** A modellhatás „50%-os” pp-ben (nyers input; a variancia-forgatókönyv ebből számol). */
  swingPpAtEven: number;
  /**
   * A tényleges (végső) esélyen realizált pp – ugyanazzal a `realizedPp`
   * függvénnyel, mint a forgatókönyv-tábla és az X-faktor.
   */
  estimatedOwnSwingPct: number;
};

/**
 * A forgatókönyvek nyers inputjai (ellenőrzéshez / debug-loghoz). Minden pp
 * „50%-os” modellhatás; a `realizedPp` a végső esélyen ténylegesen látszó eltérés.
 */
export type ScenarioDiagnostics = {
  baseLogit: number;
  basePct: number;
  controlled: {
    primaryPpAtEven: number;
    secondaryPpAtEven: number;
    totalPpAtEven: number;
    logit: number;
    realizedPp: number;
  };
  highVariance: {
    varianceDriverCount: number;
    downsidePpAtEven: number;
    variancePenaltyPp: number;
    confidence: 'Low' | 'Medium' | 'High';
    confidenceMultiplier: number;
    totalPpAtEven: number;
    logit: number;
    realizedPp: number;
  };
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
  /** A forgatókönyvek nyers inputjai (lásd `ScenarioDiagnostics`). */
  scenarioDiagnostics?: ScenarioDiagnostics;
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
  /** Támadás vs. engedett párok tengelyenként (a döntő tengely ezekből választ). */
  matchupPairs?: MatchupPairRow[];
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
  /** A csapat védekezése által engedett FTA/FGA (%); `null`, ha nincs párosított meccs. */
  oppFtRateAllowed: number | null;
  /** Engedett 3P% (%); `null`, ha nincs párosított meccs. */
  oppThreePctAllowed: number | null;
  /** Engedett OREB% (= 1 − DREB%, %); `null`, ha nincs párosított meccs. */
  oppOrebRateAllowed: number | null;
  /** Kényszerített TO rate (%); `null`, ha nincs párosított meccs. */
  oppTurnoverRateAllowed: number | null;
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
 * A hiányzók kieső termelése meccsátlagban (bruttó: a hiányzók szezonbeli
 * meccsátlagainak összege). `status`: `marked` = van megjelölt hiányzó;
 * `confirmedNone` = a keret ellenőrizve, nincs hiányzó; `unknown` = nincs adat
 * (nem ellenőrzött, nincs megjelölés).
 */
export type PregameInjuryImpact = {
  status: 'marked' | 'confirmedNone' | 'unknown';
  players: number;
  lostMinutesPerGame: number;
  lostValPerGame: number;
  lostPointsPerGame: number;
  coreNames: string[];
};

/**
 * A riportba kerülő hiányzó-hatás. A győzelmi esélyt a **nettó** veszteség
 * mozgatja: játékosonként (VAL/meccs − pótlás VAL/36 × perc/meccs ÷ 36), 0-nál
 * alulról vágva, × a játszott meccsek aránya (az alap-rating a nélküle játszott
 * meccseket már tartalmazza).
 */
export type PregameInjuryImpactReport = PregameInjuryImpact & {
  teamValPerGame: number;
  /** A pótlás minősége: a padsor (perc/meccs szerinti top 5 utáni elérhetők) VAL/36-ja. */
  replacementValPer36: number;
  /** Nettó kieső VAL/meccs (pótlással és meccsaránnyal korrigálva). */
  netLostValPerGame: number;
  /** A hiányzók játszott meccseinek aránya a csapat meccseihez, perc/meccs-szel súlyozva (0–1). */
  presenceShare: number;
  /** Nettó kieső VAL/meccs ÷ csapat VAL/meccs (0–1). */
  valShare: number;
  /** A saját győzelmi esélyre gyakorolt hatás logitban (saját hiányzó negatív). */
  logit: number;
};

/**
 * Egy csapat hiányzó-bemenete: a megjelölt hiányzók szezon-sorai (ugyanabból a
 * forrásból, mint a keret), a megjelöltek száma és a „Keret ellenőrizve” jelölő.
 * Egy kevés meccses megjelölt játékos hiányozhat a `players`-ből (mintaküszöb).
 */
export type PregameInjuryInput = {
  checked: boolean;
  markedCount: number;
  players: PlayerSeasonStat[];
};

/** Az `analyzePreGameScouting` opcionális, komponensből érkező kiegészítői. */
export type PregameScoutingExtras = {
  matchContext?: PregameMatchContext | null;
  /**
   * A hiányzók. A pozíciós matchup a teljes kerettel (elérhetők + hiányzók)
   * számol; a hiányzók hatását egyedül a hiányzó-lépés viszi.
   */
  injuries?: { own: PregameInjuryInput; opponent: PregameInjuryInput } | null;
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
/** Egy poszt-slot perce meccsenként; a hiányzó perceket a csapat VAL/36-ja tölti ki. */
export const POSITION_SLOT_MINUTES = 40;
/** Ennyi perc/meccs alatt a slot „kevés perc” jelzést kap. */
export const LOW_SLOT_MINUTES = 24;
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
    case 'opp_three_pct_allowed':
      return team.hasOpponentBox ? team.oppThreePctAllowed : Number.NaN;
    case 'opp_three_rate_allowed':
      return team.hasOpponentBox ? team.oppThreeRateAllowed : Number.NaN;
    case 'opp_two_pct_allowed':
      return team.hasOpponentBox ? team.oppTwoPctAllowed : Number.NaN;
    case 'opp_oreb_rate_allowed':
      return team.hasOpponentBox ? team.oppOrebRateAllowed : Number.NaN;
    case 'opp_turnover_rate_allowed':
      return team.hasOpponentBox ? team.oppTurnoverRateAllowed : Number.NaN;
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
  // A csapat védekezése által engedett mutatók (az ellenfelek támadása a csapat
  // ellen, csak párosított meccsekből). A matchup-párok ezekből számolnak:
  // saját támadás vs. ellenfél *engedett* érték.
  /** Engedett 3P% (0–100). */
  oppThreePctAllowed: number;
  /** Engedett 3P arány (3PA / FGA, 0–1). */
  oppThreeRateAllowed: number;
  /** Engedett 2P% (0–100). */
  oppTwoPctAllowed: number;
  /** Engedett OREB% = ellenfél T-lep / (ellenfél T-lep + saját V-lep), 0–1 (= 1 − DREB%). */
  oppOrebRateAllowed: number;
  /** Kényszerített TO rate = ellenfél LV / ellenfél birtoklás, 0–1. */
  oppTurnoverRateAllowed: number;
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
  // Engedett mutatók: az ellenfelek box score-ja a csapat ellen (párosított meccsek).
  const oppThreePctAllowed = opponent && hasOpponentBox && opponent.fga3 > 0 ? (opponent.fgm3 / opponent.fga3) * 100 : 0;
  const oppThreeRateAllowed = opponent && hasOpponentBox && opponentFga > 0 ? opponent.fga3 / opponentFga : 0;
  const oppTwoPctAllowed = opponent && hasOpponentBox && opponent.fga2 > 0 ? (opponent.fgm2 / opponent.fga2) * 100 : 0;
  const allowedOrebDenominator = opponent && hasOpponentBox ? opponent.oreb + opponent.ownDreb : 0;
  const oppOrebRateAllowed = opponent && allowedOrebDenominator > 0 ? opponent.oreb / allowedOrebDenominator : 0;
  const oppTurnoverRateAllowed = opponent && opponentPossessionsPerGame > 0
    ? (opponent.tov / opponentGames) / opponentPossessionsPerGame
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
    hasOpponentBox: hasOpponentBox && orebDenominator > 0,
    oppFtRateAllowed: round(oppFtRateAllowed, 3),
    oppThreePctAllowed: round(oppThreePctAllowed, 1),
    oppThreeRateAllowed: round(oppThreeRateAllowed, 3),
    oppTwoPctAllowed: round(oppTwoPctAllowed, 1),
    oppOrebRateAllowed: round(oppOrebRateAllowed, 3),
    oppTurnoverRateAllowed: round(oppTurnoverRateAllowed, 3),
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
  'opp_three_pct_allowed',
  'opp_three_rate_allowed',
  'opp_two_pct_allowed',
  'opp_oreb_rate_allowed',
  'opp_turnover_rate_allowed',
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
 * Egy matchup-pár egyik iránya: a támadó csapat mutatója a védekező csapat
 * *engedett* ugyanazon mutatójával szemben. `edge` = (támadó z + védekező
 * engedett z) / 2, mindkettő a liga mediánjához és szórásához mérve;
 * pozitív = a támadónak kedvez.
 */
export type MatchupPairSide = {
  attackValue: string;
  allowedValue: string;
  edge: number;
};

/**
 * A meccs döntő tengelye: az a mutató, ahol a két irány (saját támadás vs.
 * ellenfél védekezés, ellenfél támadás vs. saját védekezés) éle közti
 * különbség a legnagyobb. `z` = saját él − ellenfél él; pozitív = saját előny.
 * Tempónál nincs „engedett” pár: ott `z` = (saját − ellenfél tempó) / liga-σ,
 * az előjel csak a gyorsabb csapatot jelzi.
 */
export type MatchupAxis = {
  axis: MatchupAxisKey;
  axisLabel: string;
  metricLabel: string;
  /** Tempónál a saját tempó, párnál a saját támadó érték. */
  ownValue: string;
  /** Tempónál az ellenfél tempója, párnál az ellenfél engedett értéke. */
  opponentValue: string;
  z: number;
  /** Saját támadás vs. ellenfél engedett (tempónál nincs). */
  ownAttack?: MatchupPairSide;
  /** Ellenfél támadás vs. saját engedett (tempónál nincs). */
  opponentAttack?: MatchupPairSide;
};

const MATCHUP_AXIS_LABELS: Record<MatchupAxisKey, string> = {
  tempo: 'tempó',
  perimeter: 'periméter',
  paint: 'festék',
  free_throw: 'büntető',
  rebound: 'lepattanó',
  ball_security: 'labdabiztonság',
};

const formatPct100 = (v: number) => `${v.toFixed(1)}%`;
const formatPct01 = (v: number) => `${(v * 100).toFixed(1)}%`;

/**
 * A matchup-párok: támadó mutató ↔ a védekező csapat engedett mutatója. Csak
 * hatékonysági mutatók; a dobásmix (3P / 2P arány) stílus, nem előny.
 */
const MATCHUP_PAIR_METRICS: Array<{
  axis: Exclude<MatchupAxisKey, 'tempo'>;
  attackStat: string;
  allowedStat: string;
  label: string;
  allowedLabel: string;
  format: (value: number) => string;
  lowerIsBetter?: boolean;
}> = [
  { axis: 'perimeter', attackStat: 'three_pct', allowedStat: 'opp_three_pct_allowed', label: '3P%', allowedLabel: 'engedett 3P%', format: formatPct100 },
  { axis: 'paint', attackStat: 'two_pct', allowedStat: 'opp_two_pct_allowed', label: '2P%', allowedLabel: 'engedett 2P%', format: formatPct100 },
  { axis: 'free_throw', attackStat: 'ft_rate', allowedStat: 'opp_ft_rate_allowed', label: 'FT arány', allowedLabel: 'engedett FT arány', format: formatPct01 },
  { axis: 'rebound', attackStat: 'oreb_rate', allowedStat: 'opp_oreb_rate_allowed', label: 'OREB%', allowedLabel: 'engedett OREB%', format: formatPct01 },
  { axis: 'ball_security', attackStat: 'turnover_rate', allowedStat: 'opp_turnover_rate_allowed', label: 'TO rate', allowedLabel: 'kényszerített TO rate', format: formatPct01, lowerIsBetter: true },
];

/** A liga szórásának becslése a benchmark-percentilisekből: σ ≈ (P90 − P10) / 2,563. */
const estimateLeagueStd = (benchmarks: LeagueTeamBenchmarks, team: NormalizedTeamStats, stat: string) => {
  const p10 = getBenchmarkThreshold(benchmarks, team, stat, 'P10');
  const p90 = getBenchmarkThreshold(benchmarks, team, stat, 'P90');
  const std = (p90 - p10) / 2.563;
  return Number.isFinite(std) && std > 0 ? std : null;
};

/** Egy érték z-je a liga mediánjához és szórásához mérve; `null`, ha nem számolható. */
const leagueZ = (benchmarks: LeagueTeamBenchmarks, refTeam: NormalizedTeamStats, stat: string, value: number) => {
  const std = estimateLeagueStd(benchmarks, refTeam, stat);
  const median = benchmarks[refTeam.league]?.[refTeam.season]?.[stat]?.P50;
  if (std === null || median === undefined || !Number.isFinite(value)) return null;
  return (value - median) / std;
};

/**
 * Egy matchup-pár éle: `attacker` támadó mutatója vs. `defender` engedett
 * mutatója. `null`, ha bármelyik oldal hiányzik (pl. nincs párosított meccs) –
 * ilyenkor nincs visszaesés azonos oldalas összevetésre.
 */
const computePairEdge = (
  metric: (typeof MATCHUP_PAIR_METRICS)[number],
  attacker: NormalizedTeamStats,
  defender: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks
) => {
  const attack = getStatValue(attacker, metric.attackStat);
  const allowed = getStatValue(defender, metric.allowedStat);
  const zAttack = leagueZ(benchmarks, attacker, metric.attackStat, attack);
  const zAllowed = leagueZ(benchmarks, attacker, metric.allowedStat, allowed);
  if (zAttack === null || zAllowed === null) return null;
  const sign = metric.lowerIsBetter ? -1 : 1;
  return { attack, allowed, edge: (sign * (zAttack + zAllowed)) / 2 };
};

const getPairMetric = (axis: Exclude<MatchupAxisKey, 'tempo'>) =>
  MATCHUP_PAIR_METRICS.find(metric => metric.axis === axis)!;

/** A döntő tengely: a legnagyobb |saját él − ellenfél él| (tempónál |Δ tempó| / liga-σ). */
const getMatchupAxis = (
  ownTeam: NormalizedTeamStats,
  opponent: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks
): MatchupAxis | undefined => {
  const candidates: MatchupAxis[] = [];

  const paceStd = estimateLeagueStd(benchmarks, ownTeam, 'pace');
  if (paceStd !== null && Number.isFinite(ownTeam.pace) && Number.isFinite(opponent.pace)) {
    candidates.push({
      axis: 'tempo',
      axisLabel: MATCHUP_AXIS_LABELS.tempo,
      metricLabel: 'tempó',
      ownValue: `${ownTeam.pace.toFixed(1)} birtoklás`,
      opponentValue: `${opponent.pace.toFixed(1)} birtoklás`,
      z: round((ownTeam.pace - opponent.pace) / paceStd, 2),
    });
  }

  MATCHUP_PAIR_METRICS.forEach(metric => {
    const own = computePairEdge(metric, ownTeam, opponent, benchmarks);
    const opp = computePairEdge(metric, opponent, ownTeam, benchmarks);
    if (!own || !opp) return;
    candidates.push({
      axis: metric.axis,
      axisLabel: MATCHUP_AXIS_LABELS[metric.axis],
      metricLabel: metric.label,
      ownValue: metric.format(own.attack),
      opponentValue: metric.format(own.allowed),
      z: round(own.edge - opp.edge, 2),
      ownAttack: { attackValue: metric.format(own.attack), allowedValue: metric.format(own.allowed), edge: round(own.edge, 2) },
      opponentAttack: { attackValue: metric.format(opp.attack), allowedValue: metric.format(opp.allowed), edge: round(opp.edge, 2) },
    });
  });

  return candidates.sort((a, b) => Math.abs(b.z) - Math.abs(a.z))[0];
};

const signedZ = (z: number) => `${z >= 0 ? '+' : ''}${z.toFixed(1)}`;

/** A döntő tengely egy mondatban (summary és UI közös szövege). */
export const describeMatchupAxis = (axis: MatchupAxis) => {
  if (!axis.ownAttack || !axis.opponentAttack) {
    return `${axis.axisLabel} (${axis.metricLabel} ${axis.ownValue} vs ${axis.opponentValue}, z = ${signedZ(axis.z)})`;
  }
  return `${axis.axisLabel} – saját ${axis.metricLabel} ${axis.ownAttack.attackValue} vs. ellenfél engedett ${axis.ownAttack.allowedValue} (él ${signedZ(axis.ownAttack.edge)}), ellenfél ${axis.metricLabel} ${axis.opponentAttack.attackValue} vs. saját engedett ${axis.opponentAttack.allowedValue} (él ${signedZ(axis.opponentAttack.edge)}); nettó z = ${signedZ(axis.z)}`;
};

/** Minden matchup-pár (a riport „Matchup-párok” táblájához), tengelysorrendben. */
const buildMatchupPairs = (
  ownTeam: NormalizedTeamStats,
  opponent: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks
): MatchupPairRow[] =>
  MATCHUP_PAIR_METRICS.flatMap(metric => {
    const own = computePairEdge(metric, ownTeam, opponent, benchmarks);
    const opp = computePairEdge(metric, opponent, ownTeam, benchmarks);
    if (!own || !opp) return [];
    return [{
      axis: metric.axis,
      axisLabel: MATCHUP_AXIS_LABELS[metric.axis],
      metricLabel: metric.label,
      allowedLabel: metric.allowedLabel,
      ownAttack: { attackValue: metric.format(own.attack), allowedValue: metric.format(own.allowed), edge: round(own.edge, 2) },
      opponentAttack: { attackValue: metric.format(opp.attack), allowedValue: metric.format(opp.allowed), edge: round(opp.edge, 2) },
      netZ: round(own.edge - opp.edge, 2),
    }];
  });

/** A „Matchup-párok” tábla egy sora. */
export type MatchupPairRow = {
  axis: Exclude<MatchupAxisKey, 'tempo'>;
  axisLabel: string;
  metricLabel: string;
  allowedLabel: string;
  ownAttack: MatchupPairSide;
  opponentAttack: MatchupPairSide;
  /** Saját él − ellenfél él. */
  netZ: number;
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
/** Zónaütközés: mindkét csapatnál legalább ennyivel (pp) a liga feletti zónaarány… */
const CLASH_MIN_RATE_DELTA = 2;
/** Ez alatti pont/dobású ellenfél-zóna help-forrás: onnan lehet segíteni, nem kell closeout. */
export const HELP_SOURCE_PPS = 0.95;

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
  // Zónaütközés: mindkét csapat hangsúlyosan (Δ arány ≥ +2 pp) ÉS legalább
  // ligaszinten hatékonyan (pps ≥ liga) támadja a zónát, elég mintával.
  const isClashSide = (zone: PregameShotZone | undefined) =>
    Boolean(zone)
    && zone!.attempts >= MIN_MATCHUP_ATTEMPTS
    && zone!.rateDeltaVsLeague >= CLASH_MIN_RATE_DELTA
    && zone!.ppsDeltaVsLeague >= 0;
  const clashZones = ownZones
    .filter(zone => isClashSide(zone) && isClashSide(opponentZones.find(item => item.key === zone.key)))
    .map(zone => zone.label);

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
    notes.push(`Zónaütközés: mindkét csapat hangsúlyosan (≥ +${CLASH_MIN_RATE_DELTA} pp a ligánál) és legalább ligaszinten hatékonyan támadja: ${clashZones.join(', ')}.`);
  }

  // Dobástérkép-védekezés: kizárólag az ellenfél zónáiból (zárd / engedd pár).
  // A HELP_SOURCE_PPS alatti zóna help-forrás: onnan lehet segíteni, ott nem
  // closeout a feladat.
  const opponentSampleZones = opponentZones.filter(zone => zone.attempts >= MIN_MATCHUP_ATTEMPTS);
  if (opponentSampleZones.length >= 2) {
    const byPps = [...opponentSampleZones].sort((a, b) => b.pps - a.pps);
    const close = byPps[0];
    const zoneText = (zone: PregameShotZone) => `${zone.label.toLowerCase()} (${zone.pps.toFixed(2)} pont/dobás, ${zone.attempts} kísérlet)`;
    const helpSources = byPps.filter(zone => zone.key !== close.key && zone.pps < HELP_SOURCE_PPS).reverse();
    if (helpSources.length > 0) {
      defenseNotes.push(`Zárd: ${zoneText(close)} – help-forrás (innen lehet segíteni, nem kell closeout): ${helpSources.map(zoneText).join(', ')}.`);
    } else {
      const allow = byPps[byPps.length - 1];
      defenseNotes.push(`Zárd: ${zoneText(close)} – engedd: ${zoneText(allow)}; ${HELP_SOURCE_PPS.toFixed(2)} pont/dobás alatti zóna nincs, ezért help-forrás sincs.`);
    }
  }
  if (opponentBestAttackVsOwnDefense) {
    const { zone, allowedPpsDelta, expectedPps } = opponentBestAttackVsOwnDefense;
    defenseNotes.push(`${zone.label}: ellenfél támadási matchup-fenyegetés – várható ${expectedPps.toFixed(2)} pont/dobás (ellenfél ${zone.pps.toFixed(2)}, a saját védekezés itt +${allowedPpsDelta.toFixed(2)} pont/dobással többet enged a ligánál).`);
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
  'PER* = saját proxy, nem a Hollinger-féle PER: 36 percre vetítve 0,35·pont + 0,22·assziszt + 0,26·szerzett labda + 0,17·blokk + 0,10·támadó lepattanó + 0,05·védő lepattanó − 0,20·eladott labda (dobáshatékonyság nélkül).';
export const PROXY_WIN_SHARE_DEFINITION =
  'WS* = a csapat tényleges győzelmei szétosztva a játékosok VAL-részesedése × hatékonysági szorzó (VAL/meccs ÷ 18, 0,5–1,5 között) arányában, úgy normalizálva, hogy a teljes keret WS*-összege = a győzelmek száma; becsült győzelem-hozzájárulás, csak új eredménnyel változik. Mérkőzés-kontextus (mérleg) nélkül nem számolható.';

/** A PER* számításához szükséges játékosmezők (szezon-összegek). */
type ProxyPerInput = Pick<PlayerSeasonStat, 'minutes' | 'points' | 'ast' | 'stl' | 'blk' | 'tov' | 'oreb' | 'dreb'>;

/**
 * PER* – saját, egyszerűsített teljesítmény-proxy, **nem** a Hollinger-féle PER:
 * 36 percre vetítve 0,35·pont + 0,22·assziszt + 0,26·szerzett labda +
 * 0,17·blokk + 0,10·T-lep + 0,05·V-lep − 0,20·eladott labda (alsó korlát 0).
 * A lepattanósúly nélkül a magas posztokat alulértékelte. Dobáshatékonyságot
 * nem tartalmaz; csak a ligaátlaghoz mérve értelmezhető.
 */
export const computeProxyPer = (player: ProxyPerInput) => {
  const minutes = Math.max(player.minutes || 0, 1);
  const pointsPer36 = (player.points / minutes) * 36;
  const astPer36 = (player.ast / minutes) * 36;
  const stlPer36 = (player.stl / minutes) * 36;
  const blkPer36 = (player.blk / minutes) * 36;
  const tovPer36 = (player.tov / minutes) * 36;
  const orebPer36 = ((player.oreb || 0) / minutes) * 36;
  const drebPer36 = ((player.dreb || 0) / minutes) * 36;
  const score =
    pointsPer36 * 0.35 +
    astPer36 * 0.22 +
    stlPer36 * 0.26 +
    blkPer36 * 0.17 +
    orebPer36 * 0.10 +
    drebPer36 * 0.05 -
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

/** A WS* nyers súlya: VAL-részesedés (negatív VAL nélkül) × hatékonysági szorzó (0,5–1,5). */
const proxyWinShareWeight = (player: PlayerSeasonStat, teamTotalVal: number) => {
  const valueShare = teamTotalVal > 0 ? Math.max(player.val, 0) / teamTotalVal : 0;
  const efficiencyBoost = player.games > 0 ? clamp((player.val / player.games) / 18, 0.5, 1.5) : 1;
  return valueShare * efficiencyBoost;
};

/**
 * WS* normalizáló: a teljes keret súlyainak összege + a kereten kívüli (a
 * mintaküszöb miatt nem listázott) játékosok VAL-részesedése 1-es szorzóval.
 * Így Σ WS* (teljes csapat) = a tényleges győzelmek száma.
 */
const proxyWinShareNormalizer = (roster: PlayerSeasonStat[], teamTotalVal: number) => {
  const rosterShare = teamTotalVal > 0
    ? roster.reduce((sum, player) => sum + Math.max(player.val, 0), 0) / teamTotalVal
    : 0;
  const residualShare = Math.max(0, 1 - rosterShare);
  return roster.reduce((sum, player) => sum + proxyWinShareWeight(player, teamTotalVal), 0) + residualShare;
};

/**
 * WS*: a csapat **tényleges** győzelmei a VAL-részesedés × hatékonysági szorzó
 * arányában szétosztva (a normalizálás miatt Σ WS* = győzelmek). Nem függ az
 * adott meccs modellezett esélyétől és a hiányzók jelölésétől, ezért meccsek
 * között csak új eredménnyel változik.
 */
const computeProxyWinShare = (
  player: PlayerSeasonStat,
  teamTotalVal: number,
  teamWins: number,
  normalizer: number
) => (normalizer > 0 ? round((teamWins * proxyWinShareWeight(player, teamTotalVal)) / normalizer, 2) : 0);

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
  teamWins: number | null,
  /** A teljes keret (elérhetők + hiányzók) a WS* normalizálásához. */
  roster: PlayerSeasonStat[] = players
): AdvancedPlayerStat[] => {
  const winShareNormalizer = proxyWinShareNormalizer(roster, teamTotalVal);
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
        proxyWinShare: teamWins === null ? null : computeProxyWinShare(player, teamTotalVal, teamWins, winShareNormalizer),
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

/**
 * Pozíciós VAL/36 összevetés. Egy slot nyers értéke a poszt játékosainak
 * (pozíció-súlyozott) Σ VAL ÷ Σ perc × 36. Ha a slotra meccsenként 40 percnél
 * kevesebb jut, a maradék perceket a valóságban más posztú játékosok töltik –
 * ezeket a csapat teljes keretes VAL/36-ja tölti ki:
 * (VAL + csapat VAL/36 ÷ 36 × (40 − perc/meccs) × meccs) ÷ (40 × meccs).
 */
const buildPositionComparison = (
  ownPlayers: PlayerSeasonStat[],
  opponentPlayers: PlayerSeasonStat[],
  ownGames: number,
  opponentGames: number
): PositionComparison[] => {
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

  const teamValPer36 = (players: PlayerSeasonStat[]) => {
    const minutes = players.reduce((sum, player) => sum + (player.minutes || 0), 0);
    const val = players.reduce((sum, player) => sum + (player.val || 0), 0);
    return minutes > 0 ? (val / minutes) * 36 : 0;
  };
  const ownTeamValPer36 = teamValPer36(ownPlayers);
  const oppTeamValPer36 = teamValPer36(opponentPlayers);

  const slotValue = (slot: ReturnType<typeof aggregate>, games: number, teamVal36: number) => {
    const teamGames = Math.max(games, 1);
    const minutesPerGame = slot.minutes / teamGames;
    const raw = slot.minutes > 0 ? (slot.val / slot.minutes) * 36 : 0;
    const fillMinutes = Math.max(0, POSITION_SLOT_MINUTES - minutesPerGame) * teamGames;
    const filled = fillMinutes > 0
      ? ((slot.val + (teamVal36 / 36) * fillMinutes) / (slot.minutes + fillMinutes)) * 36
      : raw;
    return { minutesPerGame, raw, filled };
  };

  return positions.map(position => {
    const own = aggregate(ownPlayers, position);
    const opp = aggregate(opponentPlayers, position);
    const ownSlot = slotValue(own, ownGames, ownTeamValPer36);
    const oppSlot = slotValue(opp, opponentGames, oppTeamValPer36);

    const ownPointsPer36 = own.minutes > 0 ? (own.points / own.minutes) * 36 : 0;
    const oppPointsPer36 = opp.minutes > 0 ? (opp.points / opp.minutes) * 36 : 0;

    const deltaValPer36 = round(ownSlot.filled - oppSlot.filled, 1);
    let matchupFlag: PositionComparison['matchupFlag'];
    if (deltaValPer36 <= CRITICAL_MATCHUP_DELTA) {
      matchupFlag = 'critical_disadvantage';
    } else if (deltaValPer36 >= CLEAR_ADVANTAGE_DELTA) {
      matchupFlag = 'clear_advantage';
    }

    return {
      position,
      ownValPer36: round(ownSlot.filled, 1),
      oppValPer36: round(oppSlot.filled, 1),
      ownPointsPer36: round(ownPointsPer36, 1),
      oppPointsPer36: round(oppPointsPer36, 1),
      deltaValPer36,
      matchupFlag,
      ownMinutesPerGame: round(ownSlot.minutesPerGame, 1),
      oppMinutesPerGame: round(oppSlot.minutesPerGame, 1),
      ownRawValPer36: round(ownSlot.raw, 1),
      oppRawValPer36: round(oppSlot.raw, 1),
      ownLowMinutes: ownSlot.minutesPerGame < LOW_SLOT_MINUTES,
      oppLowMinutes: oppSlot.minutesPerGame < LOW_SLOT_MINUTES,
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

/**
 * Az ellenfél fő veszélyei. A matchup-párral rendelkező címkéket az ellenfél
 * támadásának éle a saját védekezés ellen szűri (`computePairEdge`): negatív
 * élnél ebben a párosításban nem veszély (kimarad), egyébként az él kiíródik.
 * Ha a pár nem számolható (nincs párosított meccs), a címke él nélkül marad.
 */
const buildThreats = (
  team: NormalizedTeamStats,
  ownTeam: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks,
  usageShare: number
) => {
  const threats: string[] = [];
  const pairEdge = (axes: Array<Exclude<MatchupAxisKey, 'tempo'>>) => {
    const edges = axes
      .map(axis => computePairEdge(getPairMetric(axis), team, ownTeam, benchmarks))
      .filter((pair): pair is NonNullable<typeof pair> => pair !== null)
      .map(pair => pair.edge);
    return edges.length > 0 ? Math.max(...edges) : null;
  };
  const pushMatchupThreat = (label: string, axes: Array<Exclude<MatchupAxisKey, 'tempo'>>) => {
    const edge = pairEdge(axes);
    if (edge === null) {
      threats.push(label);
      return;
    }
    if (edge < 0) return;
    threats.push(`${label} (matchup-él ${signedZ(edge)})`);
  };

  if (scoreAbove(benchmarks, team, 'three_rate', 60)) {
    threats.push('Magas tripla-volumen → nagyobb pontszerzési variancia, gyors futások veszélye');
  }
  if (scoreAbove(benchmarks, team, 'three_pct', 60)) {
    pushMatchupThreat('Erős 3P-hatékonyság → gyors pontfutás kockázat', ['perimeter']);
  }
  if (scoreAbove(benchmarks, team, 'assist_rate', 60)) {
    threats.push('Szervezett labdajáratás → rotációs bontás veszély');
  }
  if (scoreAbove(benchmarks, team, 'efg', 60) && !scoreAbove(benchmarks, team, 'three_pct', 60)) {
    pushMatchupThreat('Hatékony dobás → félpályás megállítás nehezebb', ['perimeter', 'paint']);
  }
  if (scoreAbove(benchmarks, team, 'two_rate', 60) && scoreAbove(benchmarks, team, 'ft_rate', 60)) {
    pushMatchupThreat('Festékdomináns támadás → faultterhelés és belső nyomás', ['paint', 'free_throw']);
  }
  if (scoreAbove(benchmarks, team, 'oreb_rate', 60)) {
    pushMatchupThreat('Erős támadólepattanózás → második esély pontok veszélye', ['rebound']);
  }
  if (usageShare >= 0.55) threats.push('Kulcsjátékos dominancia → fókuszált elfojtás szükséges');
  return threats;
};

/** Gyengeség-címke: az ellenfél védekezése sok büntetőt enged (engedett FTA/FGA a liga 70. percentilise felett). */
export const FOUL_PRONE_DEFENSE_VULNERABILITY = 'Sokat faultoló védekezés';
const FOUL_PRONE_DEFENSE_RANK = 70;

/** Az engedett FTA/FGA valódi liga-percentilis rangja ≥ 70 (csak párosított meccsekből). */
const isFoulProneDefense = (team: NormalizedTeamStats, benchmarks: LeagueTeamBenchmarks) =>
  team.hasOpponentBox
  && getPercentileRank(benchmarks, team, 'opp_ft_rate_allowed', team.oppFtRateAllowed) >= FOUL_PRONE_DEFENSE_RANK;

const buildVulnerabilities = (team: NormalizedTeamStats, benchmarks: LeagueTeamBenchmarks) => {
  const vulnerabilities: string[] = [];
  if (scoreAbove(benchmarks, team, 'turnover_rate', 60)) vulnerabilities.push('Magas labdaeladás arány');
  if (scoreBelow(benchmarks, team, 'assist_rate', 40)) vulnerabilities.push('Alacsony assziszt-arány');
  if (scoreBelow(benchmarks, team, 'efg', 40)) vulnerabilities.push('Alacsony dobáshatékonyság');
  // Kihasználható gyengeség az ellenfél *védekezése* által engedett büntető:
  // a saját FTA/FGA-ja (kevés kiharcolt büntető) nem nekünk ad előnyt.
  if (isFoulProneDefense(team, benchmarks)) {
    vulnerabilities.push(FOUL_PRONE_DEFENSE_VULNERABILITY);
  }
  if (scoreBelow(benchmarks, team, 'three_pct', 40)) vulnerabilities.push('Gyenge periméter-hatékonyság');
  if (scoreBelow(benchmarks, team, 'oreb_rate', 40)) vulnerabilities.push('Gyenge támadólepattanózás');
  return vulnerabilities;
};

/**
 * Lepattanó-matchup: a saját OREB% az ellenfél *engedett* OREB%-ával szemben
 * (= 1 − az ellenfél DREB%-a). `z` a pár éle (lásd `computePairEdge`);
 * `null`, ha nincs párosított meccs.
 */
const OREB_EDGE_Z = 1;
const getOrebEdge = (attacker: NormalizedTeamStats, defender: NormalizedTeamStats, benchmarks: LeagueTeamBenchmarks) => {
  const pair = computePairEdge(getPairMetric('rebound'), attacker, defender, benchmarks);
  return pair ? { z: pair.edge, own: pair.attack, allowed: pair.allowed } : null;
};
/** A második esély elleni kockázat küszöbe (az ellenfél lepattanó-éle a saját védekezés ellen). */
const OPPONENT_OREB_RISK_Z = 0.4;

/** Ennyi |nettó z| felett a döntő tengely fókuszpont és X-faktor is. */
const MATCHUP_AXIS_FOCUS_Z = 1;

/**
 * A döntő tengely fókuszpontja. A nagyobb |él|-ű oldalt idézi (az viszi a
 * nettó z-t), az irány az él előjeléből jön: saját támadásnál erőltetni vagy
 * kerülni, ellenfél támadásánál elzárni vagy megtartani.
 */
const buildMatchupAxisFocus = (axis: MatchupAxis) => {
  const z = signedZ(axis.z);
  if (!axis.ownAttack || !axis.opponentAttack) {
    return `Döntő tengely – tempó: ${axis.ownValue} vs ${axis.opponentValue} (z = ${z}) – a tempó feletti kontroll`;
  }
  const ownSide = Math.abs(axis.ownAttack.edge) >= Math.abs(axis.opponentAttack.edge);
  if (ownSide) {
    const side = axis.ownAttack;
    const action = side.edge >= 0
      ? 'ezt a matchupot kell erőltetni'
      : 'itt vagyunk hátrányban: alternatív pontforrás, jobb dobásválasztás';
    return `Döntő tengely – ${axis.axisLabel}: saját ${axis.metricLabel} ${side.attackValue} vs. ellenfél engedett ${side.allowedValue} (él ${signedZ(side.edge)}; nettó z = ${z}) – ${action}`;
  }
  const side = axis.opponentAttack;
  const action = side.edge >= 0
    ? 'ezt kell elzárni'
    : 'a saját védekezés itt erős, ezt kell megtartani';
  return `Döntő tengely – ${axis.axisLabel}: ellenfél ${axis.metricLabel} ${side.attackValue} vs. saját engedett ${side.allowedValue} (él ${signedZ(side.edge)}; nettó z = ${z}) – ${action}`;
};

const buildFocusPoints = (
  opponent: NormalizedTeamStats,
  ownTeam: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks,
  xFactors?: XFactorInsight,
  matchupAxis?: MatchupAxis
) => {
  const focus: string[] = [];
  let contingencyFocus: string | null = null;

  // Egyértelmű lepattanó-előny (saját OREB% vs. ellenfél engedett OREB%, él ≥ 1)
  // elsődleges fókusz, nem „ha nem működik” ág.
  const orebEdge = getOrebEdge(ownTeam, opponent, benchmarks);
  const hasOrebFocus = Boolean(orebEdge && orebEdge.z >= OREB_EDGE_Z);
  // A döntő tengely az első fókuszpont, ha elég erős (a lepattanót a
  // specifikusabb T-lep sor adja).
  if (
    matchupAxis
    && Math.abs(matchupAxis.z) >= MATCHUP_AXIS_FOCUS_Z
    && !(matchupAxis.axis === 'rebound' && hasOrebFocus)
  ) {
    focus.push(buildMatchupAxisFocus(matchupAxis));
  }
  if (orebEdge && hasOrebFocus) {
    focus.push(`T-lep támadás: saját OREB% ${(orebEdge.own * 100).toFixed(1)}% vs. ellenfél engedett OREB% ${(orebEdge.allowed * 100).toFixed(1)}% (él z = +${orebEdge.z.toFixed(1)}) – második esélyek maximalizálása`);
  }

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

  // Saját támadás vs. ellenfél *védekezés*: az ellenfél engedett mutatóiból.
  if (scoreAbove(benchmarks, opponent, 'opp_three_pct_allowed', 60) && scoreAbove(benchmarks, ownTeam, 'three_rate', 60)) {
    focus.push(`Külső dobóterhelés növelése (az ellenfél engedett 3P%-a ${opponent.oppThreePctAllowed.toFixed(1)}%)`);
  }
  if (scoreBelow(benchmarks, opponent, 'opp_turnover_rate_allowed', 40) && scoreAbove(benchmarks, ownTeam, 'turnover_rate', 60)) {
    focus.push('Labdabiztonság kiemelt: az ellenfél védekezése kevés eladást kényszerít, a saját hibák döntenek');
  }
  if (scoreAbove(benchmarks, opponent, 'turnover_rate', 60) && scoreAbove(benchmarks, ownTeam, 'stl_per_game', 60)) {
    focus.push('Labdaszerzés maximalizálása, agresszív nyomás engedhető');
  }
  if (scoreAbove(benchmarks, opponent, 'opp_two_pct_allowed', 60) && scoreAbove(benchmarks, ownTeam, 'two_rate', 60)) {
    focus.push(`Festékelőny erőltetése (az ellenfél engedett 2P%-a ${opponent.oppTwoPctAllowed.toFixed(1)}%)`);
  }
  if (
    isFoulProneDefense(opponent, benchmarks)
    && scoreAbove(benchmarks, ownTeam, 'two_rate', 55)
  ) {
    focus.push('Festéktámadásból büntetők kiharcolása, drive-and-kick és korai belső érintések erőltetése');
  }

  if (scoreAbove(benchmarks, opponent, 'stl_per_game', 60) && scoreAbove(benchmarks, ownTeam, 'turnover_rate', 50)) {
    focus.push('Labdabiztonság vs labdanyomás, egyszerűsített döntések, letámadás-bontó sémák');
  }
  if (
    !(orebEdge && orebEdge.z >= OREB_EDGE_Z)
    && scoreAbove(benchmarks, ownTeam, 'oreb_rate', 60)
    && scoreAbove(benchmarks, opponent, 'opp_oreb_rate_allowed', 60)
  ) {
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
  // Ellenfél támadólepattanó vs. a saját *engedett* OREB%.
  const opponentOrebEdge = getOrebEdge(opponent, ownTeam, benchmarks);
  if (opponentOrebEdge && opponentOrebEdge.z >= OPPONENT_OREB_RISK_Z) {
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

/** A döntő tengely → X-faktor jelölt. */
const AXIS_X_FACTOR: Record<MatchupAxisKey, keyof typeof X_FACTOR_CANDIDATES> = {
  tempo: 'tempo',
  perimeter: 'perimeter',
  paint: 'paint',
  free_throw: 'paint',
  rebound: 'rebound_edge',
  ball_security: 'turnover',
};

const buildXFactors = (
  opponent: NormalizedTeamStats,
  ownTeam: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks,
  threats: string[],
  vulnerabilities: string[],
  matchupAxis?: MatchupAxis
): XFactorInsight => {
  const candidates: XFactorCandidate[] = [];
  // Az elég erős döntő tengely (|nettó z| ≥ 1) az elsődleges X-faktor.
  if (matchupAxis && Math.abs(matchupAxis.z) >= MATCHUP_AXIS_FOCUS_Z) {
    candidates.push(X_FACTOR_CANDIDATES[AXIS_X_FACTOR[matchupAxis.axis]]);
  }

  const hasPerimeterThreat = threats.some(item => item.includes('tripla') || item.includes('3P'));
  const hasTurnoverWeakness = vulnerabilities.some(item => item.toLowerCase().includes('labdaeladás'));
  const tempoScore = getPercentileScore(benchmarks, opponent, 'pace');

  const orebEdge = getOrebEdge(ownTeam, opponent, benchmarks);
  const addCandidate = (candidate: XFactorCandidate) => {
    if (!candidates.some(item => item.key === candidate.key)) candidates.push(candidate);
  };
  if (orebEdge && orebEdge.z >= OREB_EDGE_Z) addCandidate(X_FACTOR_CANDIDATES.rebound_edge);
  if (hasPerimeterThreat) addCandidate(X_FACTOR_CANDIDATES.perimeter);
  if (hasTurnoverWeakness) addCandidate(X_FACTOR_CANDIDATES.turnover);
  if (tempoScore >= 70) addCandidate(X_FACTOR_CANDIDATES.tempo);
  if (!candidates.some(item => item.key === 'paint')) candidates.push(X_FACTOR_CANDIDATES.paint);

  const primary = candidates[0];
  // A másodlagos X-faktor sosem lehet azonos az elsődlegessel. Ha a szabályok
  // csak egy jelöltet adnak, a maradék tengelyek közül a legerősebb jelzésű lép
  // be (saját OREB, ellenfél labdaeladás, ellenfél tripla-profil, ellenfél tempó).
  const fallbackIntensity: Record<string, number> = {
    rebound_edge: (getPercentileScore(benchmarks, ownTeam, 'oreb_rate') + getPercentileScore(benchmarks, opponent, 'opp_oreb_rate_allowed')) / 2,
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
      getPercentileScore(benchmarks, opponent, 'opp_oreb_rate_allowed')
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
  const oppOrebScore = (getPercentileScore(benchmarks, opponent, 'oreb_rate') + getPercentileScore(benchmarks, ownTeam, 'opp_oreb_rate_allowed')) / 2;
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
      swingPpAtEven: dynamicSwing(2.4, oppFtScore, 6.4),
      estimatedOwnSwingPct: dynamicSwing(2.4, oppFtScore, 6.4),
    });
  }

  if (riskFlags.some(flag => flag.toLowerCase().includes('oreb'))) {
    scenarios.push({
      title: 'Második esély pontok',
      trigger: 'Két egymást követő támadólepattanó ugyanabban a szakaszban.',
      instantResponse: 'Plusz boxout szabály, gyengeoldali zárás, hosszú lepattanó-vadászat.',
      swingPpAtEven: dynamicSwing(2.1, oppOrebScore, 5.8),
      estimatedOwnSwingPct: dynamicSwing(2.1, oppOrebScore, 5.8),
    });
  }

  if (riskFlags.some(flag => flag.toLowerCase().includes('labdabiztons'))) {
    scenarios.push({
      title: 'Nyomás alatti eladások',
      trigger: '3+ gyorsindítás kapott pont labdaeladásból negyeden belül.',
      instantResponse: 'Két labdakezelős felállás, rövid outlet, első passz egyszerűsítése.',
      swingPpAtEven: dynamicSwing(2.6, (oppStlScore + ownToScore) / 2, 6.8),
      estimatedOwnSwingPct: dynamicSwing(2.6, (oppStlScore + ownToScore) / 2, 6.8),
    });
  }

  if (scoreAbove(benchmarks, opponent, 'three_rate', 60) && scoreAbove(benchmarks, opponent, 'three_pct', 60)) {
    scenarios.push({
      title: 'Periméter-run veszély',
      trigger: 'Két gyors tripla ugyanabból az akciótípusból.',
      instantResponse: 'Switch-szigorítás, agresszívabb első closeout, zóna-look 1-2 támadásra.',
      swingPpAtEven: dynamicSwing(2.2, oppThreeBlend, 6.3),
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
      swingPpAtEven: dynamicSwing(1.6, Math.max(oppThreeBlend, ownThreeBlend), 4.8),
      estimatedOwnSwingPct: dynamicSwing(1.6, Math.max(oppThreeBlend, ownThreeBlend), 4.8),
    });
  }
  if (varianceDrivers.includes(VARIANCE_DRIVER_FT) && !hasScenario('Faultterhelés felpörgése')) {
    scenarios.push({
      title: 'Faultterhelés felpörgése',
      trigger: 'Bármelyik csapat a negyed felénél bónuszba kerül.',
      instantResponse: 'Fault-fegyelem a kulcsjátékosokon, korai rotáció a 2 faultos játékosnál.',
      swingPpAtEven: dynamicSwing(1.6, Math.max(oppFtScore, getPercentileScore(benchmarks, ownTeam, 'ft_rate')), 4.6),
      estimatedOwnSwingPct: dynamicSwing(1.6, Math.max(oppFtScore, getPercentileScore(benchmarks, ownTeam, 'ft_rate')), 4.6),
    });
  }

  if (getTempoBand(ownTeam, benchmarks, opponent) === 'low' && getTempoBand(opponent, benchmarks, ownTeam) === 'high') {
    scenarios.push({
      title: 'Tempó-szétcsúszás',
      trigger: 'A meccs a saját tempó felett pörög két negyeden át.',
      instantResponse: 'Támadóidő mélyebb kihasználása, támadólepattanó-visszafogás, korai visszarendeződés.',
      swingPpAtEven: dynamicSwing(1.8, paceGap, 5.2),
      estimatedOwnSwingPct: dynamicSwing(1.8, paceGap, 5.2),
    });
  }

  if (scenarios.length === 0) {
    // Nincs aktív trigger → nincs modellezett negatív swing; ez az alapsor.
    scenarios.push({
      title: BASELINE_RISK_SCENARIO_TITLE,
      trigger: 'Egyik kockázati trigger sem aktív.',
      instantResponse: 'Félpályás ritmuskontroll, stabil kezdő rotáció és tudatosan időzített timeout a spacing resethez.',
      swingPpAtEven: 0,
      estimatedOwnSwingPct: 0,
    });
  }

  return scenarios.slice(0, 4);
};

/** A forgatókönyvek modell-eltolása logitban (az 50%-os pp-ből átváltva). */
type ScenarioLogits = { controlled: number; highVariance: number };

/**
 * A két forgatókönyv logitja és nyers inputjai. A két forgatókönyv független:
 * a kontrollált az X-faktorokból, a magas varianciájú a variancia-forrásokból
 * és a kockázati triggerek (50%-os) swingjéből számol.
 */
const buildScenarioLogits = (
  winProbability: Pick<ScoutingReport['winProbability'], 'confidence' | 'ownPct' | 'breakdown'>,
  xFactorPpAtEven: { primaryDeltaPct: number; secondaryDeltaPct: number },
  varianceDrivers: string[],
  riskScenarios: RiskScenario[]
): { logits: ScenarioLogits; diagnostics: ScenarioDiagnostics } => {
  const downside = Math.abs(riskScenarios.reduce((sum, item) => sum + Math.min(item.swingPpAtEven, 0), 0));
  const confidenceMultiplier = winProbability.confidence === 'High'
    ? 0.85
    : winProbability.confidence === 'Medium'
      ? 1
      : 1.15;
  const variancePenaltyPp = clamp(0.9 + varianceDrivers.length * 1.15 + downside * 0.16, 1.2, 8.6);
  const controlledPp = xFactorPpAtEven.primaryDeltaPct + xFactorPpAtEven.secondaryDeltaPct;
  const highVariancePp = variancePenaltyPp * confidenceMultiplier + downside * 0.32;
  const logits = {
    controlled: ppAtEvenToLogit(controlledPp),
    highVariance: -ppAtEvenToLogit(highVariancePp),
  };
  const baseLogit = winProbability.breakdown?.finalLogit ?? logit(clamp(winProbability.ownPct / 100, 0.01, 0.99));
  return {
    logits,
    diagnostics: {
      baseLogit: round(baseLogit, 3),
      basePct: winProbability.ownPct,
      controlled: {
        primaryPpAtEven: xFactorPpAtEven.primaryDeltaPct,
        secondaryPpAtEven: xFactorPpAtEven.secondaryDeltaPct,
        totalPpAtEven: round(controlledPp, 2),
        logit: round(logits.controlled, 3),
        realizedPp: realizedLogitPp(baseLogit, winProbability.ownPct, logits.controlled),
      },
      highVariance: {
        varianceDriverCount: varianceDrivers.length,
        downsidePpAtEven: round(downside, 2),
        variancePenaltyPp: round(variancePenaltyPp, 2),
        confidence: winProbability.confidence,
        confidenceMultiplier,
        totalPpAtEven: round(highVariancePp, 2),
        logit: round(logits.highVariance, 3),
        realizedPp: realizedLogitPp(baseLogit, winProbability.ownPct, logits.highVariance),
      },
    },
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
    const deltaVsBase = realizedLogitPp(baseLogit, baseOwn, deltaLogit);
    const ownPct = round(baseOwn + deltaVsBase, 1);
    return {
      key,
      label,
      ownPct,
      opponentPct: round(100 - ownPct, 1),
      deltaVsBase,
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
      riskScenarios.some(item => item.swingPpAtEven < 0)
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
    ? ` Döntő tengely: ${describeMatchupAxis(matchupAxis)}.`
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
  const probabilityConfidenceLabel = `Bizonyosság: ${CONFIDENCE_LABELS[winProbability.confidence]}`;
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
    // A pozíciós VAL/36 a teljes kerettel számol; ezt csak akkor írjuk ki, ha
    // van megjelölt hiányzó (különben nincs mit pontosítani).
    const anyMarked = [injuryImpact?.own, injuryImpact?.opponent].some(item => item?.status === 'marked');
    const rosterNote = anyMarked
      ? '; a pozíciós VAL/36 a teljes kerettel számol, a hiányzás csak a hiányzó-lépésben hat'
      : '';
    return `Hiányzók: ${ownTeamName}: ${describe(injuryContext?.own, injuryImpact?.own)} | ${opponent.teamName}: ${describe(injuryContext?.opponent, injuryImpact?.opponent)}${rosterNote}.`;
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

/** Ennyi (perc/meccs szerinti) vezető játékos nem számít padsornak a pótlásnál. */
const REPLACEMENT_STARTERS = 5;
/** Ennyi VAL/meccs felett „kulcs” a hiányzó (a kártya névlistájához). */
const INJURY_CORE_VAL_PER_GAME = 12;

/** A pótlás VAL/36-ja: a top 5 utáni elérhetők; üres padnál az elérhető keret. */
const computeReplacementValPer36 = (available: PlayerSeasonStat[]) => {
  const withMinutes = available
    .filter(player => (player.minutes || 0) > 0 && (player.games || 0) > 0)
    .sort((a, b) => b.minutes / b.games - a.minutes / a.games);
  const bench = withMinutes.slice(REPLACEMENT_STARTERS);
  const pool = bench.length > 0 ? bench : withMinutes;
  const minutes = pool.reduce((sum, player) => sum + player.minutes, 0);
  const val = pool.reduce((sum, player) => sum + player.val, 0);
  return minutes > 0 ? Math.max((val / minutes) * 36, 0) : 0;
};

/**
 * A hiányzók logit-hatása csapatonként. Nettó veszteség játékosonként:
 * max(0, VAL/meccs − pótlás VAL/36 × perc/meccs ÷ 36) × min(1, játszott meccs ÷
 * csapat meccs); a nettó összeg a csapat VAL/meccs-éhez mérve, × −2,5 logit.
 */
const buildInjuryImpactReport = (
  input: PregameInjuryInput | undefined,
  available: PlayerSeasonStat[],
  team: NormalizedTeamStats,
  sign: 1 | -1
): PregameInjuryImpactReport => {
  const players = input?.players ?? [];
  const markedCount = Math.max(input?.markedCount ?? 0, players.length);
  const status: PregameInjuryImpact['status'] = markedCount > 0 ? 'marked' : input?.checked ? 'confirmedNone' : 'unknown';
  const teamGames = Math.max(team.games || 0, 1);
  const replacementValPer36 = computeReplacementValPer36(available);

  const totals = players.reduce(
    (acc, player) => {
      const games = player.games || 0;
      if (games <= 0) return acc;
      const minutesPerGame = (player.minutes || 0) / games;
      const valPerGame = (player.val || 0) / games;
      const presence = Math.min(1, games / teamGames);
      const net = Math.max(0, valPerGame - (replacementValPer36 * minutesPerGame) / 36) * presence;
      acc.minutes += minutesPerGame;
      acc.val += valPerGame;
      acc.points += (player.points || 0) / games;
      acc.net += net;
      acc.presenceMinutes += minutesPerGame * presence;
      if (valPerGame >= INJURY_CORE_VAL_PER_GAME) acc.coreNames.push(player.name);
      return acc;
    },
    { minutes: 0, val: 0, points: 0, net: 0, presenceMinutes: 0, coreNames: [] as string[] }
  );

  const teamValPerGame = Math.max(team.valPerGame, 0);
  const valShare = teamValPerGame > 0 ? clamp(totals.net / teamValPerGame, 0, INJURY_SHARE_CAP) : 0;
  return {
    status,
    players: markedCount,
    lostMinutesPerGame: round(totals.minutes, 1),
    lostValPerGame: round(totals.val, 1),
    lostPointsPerGame: round(totals.points, 1),
    coreNames: totals.coreNames.slice(0, 4),
    teamValPerGame: round(teamValPerGame, 1),
    replacementValPer36: round(replacementValPer36, 1),
    netLostValPerGame: round(totals.net, 1),
    presenceShare: totals.minutes > 0 ? round(totals.presenceMinutes / totals.minutes, 3) : 0,
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
  const threats = buildThreats(normalizedOpponent, normalizedOwn, leagueBenchmarks, usageShare);
  const vulnerabilities = buildVulnerabilities(normalizedOpponent, leagueBenchmarks);
  // A pozíciós matchup a teljes kerettel számol (mint az alap-rating); a
  // hiányzók hatását egyedül a hiányzó-lépés viszi – így nincs duplán.
  const ownInjured = extras?.injuries?.own.players ?? [];
  const opponentInjured = extras?.injuries?.opponent.players ?? [];
  const ownRoster = [...ownPlayers, ...ownInjured];
  const opponentRoster = [...opponentPlayers, ...opponentInjured];
  const positionComparison = buildPositionComparison(
    ownRoster,
    opponentRoster,
    normalizedOwn.games || 0,
    normalizedOpponent.games || 0
  );
  const injuryImpact = {
    own: buildInjuryImpactReport(extras?.injuries?.own, ownPlayers, normalizedOwn, 1),
    opponent: buildInjuryImpactReport(extras?.injuries?.opponent, opponentPlayers, normalizedOpponent, -1),
  };
  const winProbability = computeWinProbability(
    computeBaseWinModel(normalizedOwn, normalizedOpponent, leagueBenchmarks),
    computeMatchupLogit(positionComparison),
    extras?.matchContext?.homeLogit ?? 0,
    injuryImpact.own.logit + injuryImpact.opponent.logit,
    extras?.matchContext
  );
  const matchupAxis = getMatchupAxis(normalizedOwn, normalizedOpponent, leagueBenchmarks);
  const xFactors = buildXFactors(normalizedOpponent, normalizedOwn, leagueBenchmarks, threats, vulnerabilities, matchupAxis);
  const baseXFactorImpact = buildXFactorImpact(xFactors, normalizedOpponent, normalizedOwn, leagueBenchmarks);
  const riskNotes = buildRiskNotes(normalizedOpponent, normalizedOwn, leagueBenchmarks);
  const tempoControlNote = buildTempoControlNote(normalizedOpponent, normalizedOwn, leagueBenchmarks);
  const matchupRealizationNote = buildMatchupRealizationNote(positionComparison, opponentStyle);
  const focusPoints = buildFocusPoints(normalizedOpponent, normalizedOwn, leagueBenchmarks, xFactors, matchupAxis);
  const positionComparisonNote = buildCriticalMatchupNote(positionComparison, winProbability, ownTeam.teamName);
  const { perimeterDelta, frontcourtDelta } = summarizePositionDeltas(positionComparison);
  const varianceDrivers = buildVarianceDrivers(normalizedOpponent, normalizedOwn, leagueBenchmarks, riskNotes.flags);
  // A kockázati swing a tényleges esélyen, ugyanazzal a függvénnyel, mint a
  // forgatókönyv-tábla (a nyers 50%-os érték a `swingPpAtEven`).
  const finalLogit = winProbability.breakdown?.finalLogit ?? 0;
  const realizedPp = (deltaLogit: number) => realizedLogitPp(finalLogit, winProbability.ownPct, deltaLogit);
  const riskScenarios = buildRiskScenarios(
    riskNotes.flags,
    normalizedOpponent,
    normalizedOwn,
    leagueBenchmarks,
    varianceDrivers
  ).map(item => ({ ...item, estimatedOwnSwingPct: realizedPp(ppAtEvenToLogit(item.swingPpAtEven)) }));
  const shotProfileContext = buildShotProfileContext(
    shotProfiles?.own,
    shotProfiles?.opponent,
    shotProfiles?.league,
    shotProfiles?.ownAllowed,
    shotProfiles?.opponentAllowed
  );
  const { logits: scenarioLogits, diagnostics: scenarioDiagnostics } = buildScenarioLogits(
    winProbability,
    baseXFactorImpact,
    varianceDrivers,
    riskScenarios
  );
  const scenarioOutcomes = buildScenarioOutcomes(
    winProbability,
    scenarioLogits,
    riskScenarios,
    ownTeam.teamName,
    opponentTeam.teamName
  );
  // Az X-faktorok a tényleges alapon realizált pp-ben: ugyanaz a szám áll a
  // forgatókönyv-táblában, az X-faktor mondatban és a kártyán.
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
      extras?.matchContext ? extras.matchContext.ownRecord.wins : null,
      ownRoster
    ),
    opponent: buildAdvancedPlayers(
      opponentPlayers,
      opponentTeam.games || normalizedOpponent.games || 1,
      opponentTeam.val,
      extras?.matchContext ? extras.matchContext.opponentRecord.wins : null,
      opponentRoster
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
    scenarioDiagnostics,
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
        oppFtRateAllowed: normalizedOwn.hasOpponentBox ? round(normalizedOwn.oppFtRateAllowed * 100, 1) : null,
        oppThreePctAllowed: normalizedOwn.hasOpponentBox ? normalizedOwn.oppThreePctAllowed : null,
        oppOrebRateAllowed: normalizedOwn.hasOpponentBox ? round(normalizedOwn.oppOrebRateAllowed * 100, 1) : null,
        oppTurnoverRateAllowed: normalizedOwn.hasOpponentBox ? round(normalizedOwn.oppTurnoverRateAllowed * 100, 1) : null,
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
        oppFtRateAllowed: normalizedOpponent.hasOpponentBox ? round(normalizedOpponent.oppFtRateAllowed * 100, 1) : null,
        oppThreePctAllowed: normalizedOpponent.hasOpponentBox ? normalizedOpponent.oppThreePctAllowed : null,
        oppOrebRateAllowed: normalizedOpponent.hasOpponentBox ? round(normalizedOpponent.oppOrebRateAllowed * 100, 1) : null,
        oppTurnoverRateAllowed: normalizedOpponent.hasOpponentBox ? round(normalizedOpponent.oppTurnoverRateAllowed * 100, 1) : null,
      },
    },
    matchupPairs: buildMatchupPairs(normalizedOwn, normalizedOpponent, leagueBenchmarks),
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
