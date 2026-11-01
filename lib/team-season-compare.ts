import type { TeamExportAggregate, TeamExportGame, TeamSeasonExport } from './team-season-export';
import { aggregateGames } from './team-season-export';
import { aggregateRatings, orebPct, teamRates } from './export-to-md';

// Ugyanazon csapat két szezonjának összevetése. Mindkét oldal a
// `buildTeamSeasonExport` meccssoraiból számolódik (ugyanaz a box score
// szűrés, versenyszakasz-besorolás és birtoklásbecslés, mint az exportban),
// itt csak a mintaválasztás és a két oldal különbsége készül el.

/** Az összevetés alapja: a tavalyi alapszakasz első N meccse, vagy az egész alapszakasz. */
export type CompareBasis = 'firstN' | 'fullRegular';

/** Ennyi meccs alatt a különbségek zajszintűek lehetnek – a nézet figyelmeztet. */
export const SMALL_SAMPLE_GAMES = 10;

export type ComparableSample = {
  games: TeamExportGame[];
  aggregate: TeamExportAggregate;
  /** A szezon összes alapszakasz-meccse (a minta ennek része). */
  regularTotal: number;
  /** A szezon minden meccse versenyszakasztól függetlenül. */
  seasonTotal: number;
};

/**
 * Alapszakasz-minta időrendben. A rájátszás és a nem azonosítható szakasz
 * (kupa, forduló nélküli meccs) kimarad: más ellenfélszint, más tét.
 * `limit` = az első ennyi meccs; null = az egész alapszakasz.
 */
export function selectRegularSample(model: TeamSeasonExport, limit: number | null): ComparableSample {
  const regular = model.games.filter(game => game.phase === 'regular');
  const games = limit === null ? regular : regular.slice(0, limit);
  return {
    games,
    aggregate: aggregateGames(games),
    regularTotal: regular.length,
    seasonTotal: model.games.length,
  };
}

export type CompareMetricGroup = 'result' | 'attack' | 'defense' | 'play';

export const GROUP_LABELS: Record<CompareMetricGroup, string> = {
  result: 'Eredmény',
  attack: 'Támadás',
  defense: 'Védekezés',
  play: 'Csapatjáték',
};

export type CompareMetric = {
  key: string;
  label: string;
  group: CompareMetricGroup;
  /** '%' = százalékpontban értelmezett különbség; '' = egyéb. */
  unit: '%' | '';
  digits: number;
  prev: number | null;
  cur: number | null;
  delta: number | null;
  /** null = a mutató semleges (tempó, hárompontos arány): nincs „jobb” oldala. */
  higherIsBetter: boolean | null;
  winner: 'cur' | 'prev' | 'even' | null;
};

export type GroupTally = { better: number; worse: number; even: number };

export type TeamSeasonComparison = {
  metrics: CompareMetric[];
  tally: GroupTally;
  byGroup: Record<CompareMetricGroup, GroupTally>;
  prevGames: number;
  curGames: number;
  /** A pontkülönbség-változás és annak becsült bizonytalansága (meccsek közti szórásból). */
  margin: { delta: number | null; standardError: number | null; reliable: boolean | null };
  /** Összesített irány: a net rating (ennek híján a pontkülönbség) előjele. */
  overall: 'cur' | 'prev' | 'even' | null;
};

type SampleValues = Record<string, number | null>;

const perGame = (value: number, games: number): number | null => (games > 0 ? value / games : null);
const ratio = (part: number, whole: number): number | null => (whole > 0 ? (part / whole) * 100 : null);

/** Egy minta minden összevetett mutatója; adat híján null. */
function sampleValues(agg: TeamExportAggregate): SampleValues {
  const games = agg.games;
  const boxGames = agg.boxGames;
  const hasBox = boxGames > 0;
  const hasPaired = agg.pairedGames > 0;
  const own = teamRates(agg.own);
  const opp = teamRates(agg.opp);
  const ratings = aggregateRatings(agg);
  const line = agg.own;

  return {
    winPct: ratio(agg.wins, games),
    ppg: perGame(agg.pointsFor, games),
    oppg: perGame(agg.pointsAgainst, games),
    margin: perGame(agg.pointsFor - agg.pointsAgainst, games),
    net: ratings.net,
    ortg: ratings.ortg,
    pace: ratings.pace,
    efg: hasBox ? own.efg : null,
    ts: hasBox ? own.ts : null,
    twoPct: ratio(line.closeMade + line.midMade, line.closeAtt + line.midAtt),
    threePct: ratio(line.threeMade, line.threeAtt),
    ftPct: ratio(line.ftMade, line.ftAtt),
    threeRate: hasBox ? own.threeRate : null,
    ftmRate: hasBox ? own.ftmRate : null,
    toRate: hasBox ? own.toRate : null,
    oreb: hasPaired ? orebPct(agg.pairedOwn, agg.opp) : null,
    drtg: ratings.drtg,
    oppEfg: hasPaired ? opp.efg : null,
    oppThreePct: hasPaired ? ratio(agg.opp.threeMade, agg.opp.threeAtt) : null,
    oppToRate: hasPaired ? opp.toRate : null,
    dreb: hasPaired ? 100 - orebPct(agg.opp, agg.pairedOwn) : null,
    stl: perGame(line.stl, boxGames),
    blk: perGame(line.blk, boxGames),
    ast: perGame(line.ast, boxGames),
    astRate: hasBox ? own.assistRate : null,
    astTo: line.tov > 0 ? line.ast / line.tov : null,
    reb: perGame(line.reb, boxGames),
    tov: perGame(line.tov, boxGames),
    pf: perGame(line.pf, boxGames),
  };
}

type MetricDef = {
  key: string;
  label: string;
  group: CompareMetricGroup;
  unit?: '%';
  digits?: number;
  higherIsBetter: boolean | null;
};

const METRIC_DEFS: MetricDef[] = [
  { key: 'winPct', label: 'Győzelmi arány', group: 'result', unit: '%', digits: 1, higherIsBetter: true },
  { key: 'ppg', label: 'Szerzett pont / meccs', group: 'result', higherIsBetter: true },
  { key: 'oppg', label: 'Kapott pont / meccs', group: 'result', higherIsBetter: false },
  { key: 'margin', label: 'Pontkülönbség / meccs', group: 'result', higherIsBetter: true },
  { key: 'net', label: 'Net rating (ORtg − DRtg)', group: 'result', higherIsBetter: true },

  { key: 'ortg', label: 'ORtg (pont / 100 birtoklás)', group: 'attack', higherIsBetter: true },
  { key: 'pace', label: 'Tempó (birtoklás / meccs)', group: 'attack', higherIsBetter: null },
  { key: 'efg', label: 'eFG%', group: 'attack', unit: '%', higherIsBetter: true },
  { key: 'ts', label: 'TS%', group: 'attack', unit: '%', higherIsBetter: true },
  { key: 'twoPct', label: '2P%', group: 'attack', unit: '%', higherIsBetter: true },
  { key: 'threePct', label: '3P%', group: 'attack', unit: '%', higherIsBetter: true },
  { key: 'ftPct', label: 'FT%', group: 'attack', unit: '%', higherIsBetter: true },
  { key: 'threeRate', label: 'Hárompontos arány (3PA / FGA)', group: 'attack', unit: '%', higherIsBetter: null },
  { key: 'ftmRate', label: 'FTM rate (FTM / FGA)', group: 'attack', unit: '%', higherIsBetter: true },
  { key: 'toRate', label: 'Labdavesztés % (TO rate)', group: 'attack', unit: '%', higherIsBetter: false },
  { key: 'oreb', label: 'Támadó lepattanó % (OREB%)', group: 'attack', unit: '%', higherIsBetter: true },

  { key: 'drtg', label: 'DRtg (kapott pont / 100 birtoklás)', group: 'defense', higherIsBetter: false },
  { key: 'oppEfg', label: 'Ellenfél eFG%', group: 'defense', unit: '%', higherIsBetter: false },
  { key: 'oppThreePct', label: 'Ellenfél 3P%', group: 'defense', unit: '%', higherIsBetter: false },
  { key: 'oppToRate', label: 'Ellenfél labdavesztés %', group: 'defense', unit: '%', higherIsBetter: true },
  { key: 'dreb', label: 'Védő lepattanó % (DREB%)', group: 'defense', unit: '%', higherIsBetter: true },
  { key: 'stl', label: 'Szerzett labda / meccs', group: 'defense', higherIsBetter: true },
  { key: 'blk', label: 'Blokk / meccs', group: 'defense', higherIsBetter: true },

  { key: 'ast', label: 'Gólpassz / meccs', group: 'play', higherIsBetter: true },
  { key: 'astRate', label: 'Gólpassz arány (AST / FGM)', group: 'play', unit: '%', higherIsBetter: true },
  { key: 'astTo', label: 'AST/TO', group: 'play', digits: 2, higherIsBetter: true },
  { key: 'reb', label: 'Lepattanó / meccs', group: 'play', higherIsBetter: true },
  { key: 'tov', label: 'Eladott labda / meccs', group: 'play', higherIsBetter: false },
  { key: 'pf', label: 'Személyi hiba / meccs', group: 'play', higherIsBetter: false },
];

const emptyTally = (): GroupTally => ({ better: 0, worse: 0, even: 0 });

/** A különbség a megjelenített pontosságon belül nulla, ha kerekítve nem látszik. */
const isEven = (delta: number, digits: number) => Math.abs(delta) < 0.5 * 10 ** -digits;

function marginStats(games: TeamExportGame[]): { n: number; mean: number; variance: number } | null {
  if (games.length < 2) return null;
  const margins = games.map(game => game.ourScore - game.oppScore);
  const mean = margins.reduce((sum, value) => sum + value, 0) / margins.length;
  const variance = margins.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (margins.length - 1);
  return { n: margins.length, mean, variance };
}

/** `prev` = a korábbi szezon mintája, `cur` = az aktuális. */
export function buildTeamSeasonComparison(prev: ComparableSample, cur: ComparableSample): TeamSeasonComparison {
  const prevValues = sampleValues(prev.aggregate);
  const curValues = sampleValues(cur.aggregate);

  const metrics: CompareMetric[] = METRIC_DEFS.map(def => {
    const digits = def.digits ?? 1;
    const prevValue = prevValues[def.key];
    const curValue = curValues[def.key];
    const delta = prevValue !== null && curValue !== null ? curValue - prevValue : null;
    let winner: CompareMetric['winner'] = null;
    if (delta !== null && def.higherIsBetter !== null) {
      if (isEven(delta, digits)) winner = 'even';
      else winner = (delta > 0) === def.higherIsBetter ? 'cur' : 'prev';
    }
    return {
      key: def.key,
      label: def.label,
      group: def.group,
      unit: def.unit ?? '',
      digits,
      prev: prevValue,
      cur: curValue,
      delta,
      higherIsBetter: def.higherIsBetter,
      winner,
    };
  });

  const tally = emptyTally();
  const byGroup: Record<CompareMetricGroup, GroupTally> = {
    result: emptyTally(), attack: emptyTally(), defense: emptyTally(), play: emptyTally(),
  };
  metrics.forEach(metric => {
    if (metric.winner === null) return;
    const bucket = metric.winner === 'cur' ? 'better' : metric.winner === 'prev' ? 'worse' : 'even';
    tally[bucket] += 1;
    byGroup[metric.group][bucket] += 1;
  });

  const marginMetric = metrics.find(metric => metric.key === 'margin');
  const prevMargin = marginStats(prev.games);
  const curMargin = marginStats(cur.games);
  const marginDelta = marginMetric?.delta ?? null;
  const standardError = prevMargin && curMargin
    ? Math.sqrt(prevMargin.variance / prevMargin.n + curMargin.variance / curMargin.n)
    : null;
  // Kb. 95%-os sáv: a különbség a standard hiba kétszerese fölött már nem pusztán meccsek közti ingadozás.
  const reliable = marginDelta !== null && standardError !== null ? Math.abs(marginDelta) >= 2 * standardError : null;

  const lead = metrics.find(metric => metric.key === 'net' && metric.winner !== null)
    ?? metrics.find(metric => metric.key === 'margin' && metric.winner !== null);

  return {
    metrics,
    tally,
    byGroup,
    prevGames: prev.games.length,
    curGames: cur.games.length,
    margin: { delta: marginDelta, standardError, reliable },
    overall: lead?.winner ?? null,
  };
}

/** Előjeles szám megjelenítése („+2.3”, „−1.0”); nem véges értékre „–”. */
export function formatSigned(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return '–';
  const text = Math.abs(value).toFixed(digits);
  if (Number(text) === 0) return text;
  return `${value > 0 ? '+' : '−'}${text}`;
}

/** A nézet összegző mondatai – szabály alapúak, nem AI-generáltak. */
export function buildComparisonVerdict(comparison: TeamSeasonComparison): string[] {
  const lines: string[] = [];
  const find = (key: string) => comparison.metrics.find(metric => metric.key === key);
  const margin = find('margin');
  const net = find('net');

  if (margin && margin.prev !== null && margin.cur !== null && margin.delta !== null) {
    const verb = margin.winner === 'cur' ? 'jobb' : margin.winner === 'prev' ? 'gyengébb' : 'ugyanakkora';
    lines.push(
      `Idén ${formatSigned(margin.cur)} a pontkülönbség meccsenként (tavaly ${formatSigned(margin.prev)}): ` +
        `${Math.abs(margin.delta).toFixed(1)} ponttal ${verb}${margin.winner === 'even' ? '' : ' a csapat'}.`
    );
  }
  if (net && net.prev !== null && net.cur !== null && net.delta !== null) {
    lines.push(`Net rating: ${formatSigned(net.cur)} idén, ${formatSigned(net.prev)} tavaly (${formatSigned(net.delta)} / 100 birtoklás).`);
  }
  const { better, worse, even } = comparison.tally;
  if (better + worse + even > 0) {
    lines.push(`Az összevethető ${better + worse + even} mutatóból idén ${better} jobb, ${worse} gyengébb, ${even} azonos.`);
  }
  if (comparison.margin.reliable === false) {
    lines.push(
      `A pontkülönbség változása (${formatSigned(comparison.margin.delta)}) a meccsek közti ingadozáson belül van ` +
        `(${comparison.curGames} idei és ${comparison.prevGames} tavalyi meccs): óvatosan értelmezd.`
    );
  } else if (comparison.margin.reliable === null) {
    lines.push('Egy oldalon kevesebb mint 2 meccs van: a változás megbízhatóságát nem lehet megbecsülni.');
  }
  return lines;
}
