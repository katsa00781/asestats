// Kosarstat eseménylista (play-by-play) → negyedenkénti csapat- és játékos-box score.
//
// A Kosarstat negyedenként csak pontot közöl (`kosarstat_game_quarter_stats`),
// ezért a dobásokat, lepattanókat, gólpasszokat, labdaeladásokat stb. a
// `game_events` oldal eseménytáblájából számoljuk periódusonként. Nem
// hivatalos box score: a hívó a pontösszeget a végeredménnyel összevetve
// ellenőrzi, hogy az eseménylista teljes-e.
//
// Tiszta függvények, külső függőség nélkül – a lekérdezés a hívó dolga.

import { effectiveFgPct, trueShootingPct } from './stat-formulas';
import { matchesAbbreviation } from './kosarstat-substitutions';

export type QuarterSide = 'home' | 'away';

export type QuarterBoxLine = {
  points: number;
  fgm2: number;
  fga2: number;
  fgm3: number;
  fga3: number;
  ftm: number;
  fta: number;
  oreb: number;
  dreb: number;
  ast: number;
  tov: number;
  stl: number;
  blk: number;
  /** Elkövetett fault (személyi + a játékos technikai hibája; a csapat technikai hibája nem). */
  pf: number;
};

export type QuarterPlayerLine = QuarterBoxLine & {
  /** A Kosarstat teljes névírása („KRNJAJSZKI Borisz”), vagy ha nem feloldható, a rövidített alak. */
  player: string;
};

export type QuarterPeriod = {
  /** A forrás periódusa: `Q1` … `Q4`, `OT1` …; az egész meccs összesítője `ALL`. */
  key: string;
  /** Megjelenített címke: `N1` … `N4`, `H1` …, `Teljes meccs`. */
  label: string;
  team: Record<QuarterSide, QuarterBoxLine>;
  players: Record<QuarterSide, QuarterPlayerLine[]>;
};

export type KosarstatQuarterBox = {
  /** A periódusok a meccs sorrendjében (rendes negyedek, majd hosszabbítások). */
  periods: QuarterPeriod[];
  /** Az egész meccs ugyanebből az eseménylistából. */
  total: QuarterPeriod;
};

/** A Kosarstat eseménysor típusa: 3 = játékesemény (1–2 fejléc, 4 = ötös). */
const EVENT_ROW_TYPE = '3';

export const TOTAL_PERIOD_KEY = 'ALL';

export const emptyQuarterLine = (): QuarterBoxLine => ({
  points: 0,
  fgm2: 0,
  fga2: 0,
  fgm3: 0,
  fga3: 0,
  ftm: 0,
  fta: 0,
  oreb: 0,
  dreb: 0,
  ast: 0,
  tov: 0,
  stl: 0,
  blk: 0,
  pf: 0,
});

/** „Q1” → „N1”, „OT1” → „H1”. */
export const quarterPeriodLabel = (key: string) => {
  if (key === TOTAL_PERIOD_KEY) return 'Teljes meccs';
  const quarter = key.match(/^Q(\d+)$/i);
  if (quarter) return `N${quarter[1]}`;
  const overtime = key.match(/^(?:OT|H)(\d*)$/i);
  if (overtime) return `H${overtime[1] || 1}`;
  return key;
};

/** Rendezési kulcs: a rendes negyedek a hosszabbítások előtt. */
const periodOrder = (key: string) => {
  const quarter = key.match(/^Q(\d+)$/i);
  if (quarter) return Number(quarter[1]);
  const overtime = key.match(/^(?:OT|H)(\d*)$/i);
  if (overtime) return 100 + Number(overtime[1] || 1);
  return 1000;
};

const ACTION_PATTERN = /^(.*?)\s*(sikeres|kihagyott|támadólepattanó|védőlepattanó|eladott labda|fault|technikai hiba)(?=\s|\(|$)(.*)$/i;

type ParsedAction = {
  actor: string;
  kind: 'made' | 'missed' | 'oreb' | 'dreb' | 'tov' | 'foul' | 'technical';
  shotType: string;
  points: number;
  assister: string | null;
  blocker: string | null;
  stealer: string | null;
};

const shotPoints = (rest: string, shotType: string) => {
  const explicit = Number(rest.match(/(\d)\s*pont/i)?.[1]);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  if (shotType === 'hárompontos') return 3;
  return shotType === 'büntető' ? 1 : 2;
};

const parseAction = (text: string): ParsedAction | null => {
  const match = text.match(ACTION_PATTERN);
  if (!match) return null;
  const actor = match[1].trim();
  const keyword = match[2].toLowerCase();
  const rest = match[3] ?? '';
  const detail = rest.match(/\(([^)]*)\)/)?.[1]?.trim() ?? '';
  const assister = detail.match(/^gólpassz:\s*(.+)$/i)?.[1]?.trim() ?? null;
  const blocker = detail.match(/^blokk:\s*(.+)$/i)?.[1]?.trim() ?? null;
  const stealer = detail.match(/^(.+?)\s+labdaszerzés$/i)?.[1]?.trim() ?? null;
  const shotType = (rest.trim().split(/\s+/)[0] ?? '').toLowerCase();

  const base = { actor, shotType: '', points: 0, assister: null, blocker: null, stealer: null };
  switch (keyword) {
    case 'sikeres':
      return { ...base, kind: 'made', shotType, points: shotPoints(rest, shotType), assister };
    case 'kihagyott':
      return { ...base, kind: 'missed', shotType, blocker };
    case 'támadólepattanó':
      return { ...base, kind: 'oreb' };
    case 'védőlepattanó':
      return { ...base, kind: 'dreb' };
    case 'eladott labda':
      return { ...base, kind: 'tov', stealer };
    case 'fault':
      return { ...base, kind: 'foul' };
    default:
      return { ...base, kind: 'technical' };
  }
};

/**
 * A szűrőoszlop az adott oldal érintett játékosainak teljes nevét adja szóközzel
 * összefűzve (pl. dobó + gólpasszt adó: „Chevez GOODWIN KRNJAJSZKI Borisz”).
 * Egy névnél maga a szűrő a teljes név; kettőnél a rövidítések jelölik ki a
 * határt, többértelműség esetén a már ismert nevek döntenek.
 */
const resolveSideNames = (abbreviations: string[], filter: string, known: Map<string, string>): Array<string | null> => {
  if (abbreviations.length === 0) return [];
  if (abbreviations.length === 1) {
    if (filter) return [filter];
    return [known.get(abbreviations[0]) ?? null];
  }
  const parts = filter.split(/\s+/).filter(Boolean);
  const splits: Array<[string, string]> = [];
  for (let index = 1; index < parts.length; index += 1) {
    const left = parts.slice(0, index).join(' ');
    const right = parts.slice(index).join(' ');
    if (matchesAbbreviation(left, abbreviations[0]) && matchesAbbreviation(right, abbreviations[1])) splits.push([left, right]);
  }
  const knownFirst = known.get(abbreviations[0]);
  const knownSecond = known.get(abbreviations[1]);
  const pick = splits.length === 1
    ? splits[0]
    : splits.find(([left, right]) => left === knownFirst || right === knownSecond) ?? null;
  if (pick) return pick;
  return [knownFirst ?? null, knownSecond ?? null];
};

type EventRow = {
  period: string;
  side: QuarterSide;
  action: ParsedAction;
  filters: Record<QuarterSide, string>;
};

const otherSide = (side: QuarterSide): QuarterSide => (side === 'home' ? 'away' : 'home');

/** Az oldalanként érintett rövidített nevek: [dobó / szereplő, gólpasszt adó] és [labdaszerző / blokkoló]. */
const involvedAbbreviations = (row: EventRow): Record<QuarterSide, string[]> => {
  const { action, side } = row;
  const own = [action.actor, action.assister].filter((name): name is string => Boolean(name));
  const other = [action.stealer, action.blocker].filter((name): name is string => Boolean(name));
  return side === 'home' ? { home: own, away: other } : { home: other, away: own };
};

/**
 * `headers` / `rows`: a `kosarstat_game_page_tables` eseménytáblája (az, amelyik
 * `home_event` oszlopot tartalmaz). `null`, ha a tábla nem eseménylista vagy
 * egyetlen értelmezhető játékesemény sincs benne.
 */
export const parseKosarstatQuarterBox = (headers: string[], rows: unknown[][]): KosarstatQuarterBox | null => {
  const clockIndex = headers.indexOf('minutes');
  const rowTypeIndex = headers.indexOf('row_type');
  const eventIndex: Record<QuarterSide, number> = { home: headers.indexOf('home_event'), away: headers.indexOf('away_event') };
  const filterIndex: Record<QuarterSide, number> = {
    home: headers.indexOf('home_player_filter'),
    away: headers.indexOf('away_player_filter'),
  };
  if (clockIndex < 0 || rowTypeIndex < 0 || eventIndex.home < 0 || eventIndex.away < 0) return null;

  const cell = (row: unknown[], index: number) => (index >= 0 ? String(row[index] ?? '').trim() : '');

  const events: EventRow[] = [];
  for (const row of rows) {
    if (cell(row, rowTypeIndex) !== EVENT_ROW_TYPE) continue;
    const period = cell(row, clockIndex).match(/^(\S+)\s+\d+:\d+/)?.[1]?.toUpperCase();
    if (!period) continue;
    const homeText = cell(row, eventIndex.home);
    const awayText = cell(row, eventIndex.away);
    const side: QuarterSide | null = homeText ? 'home' : awayText ? 'away' : null;
    if (!side) continue;
    const action = parseAction(side === 'home' ? homeText : awayText);
    if (!action) continue;
    events.push({
      period,
      side,
      action,
      filters: { home: cell(row, filterIndex.home), away: cell(row, filterIndex.away) },
    });
  }
  if (events.length === 0) return null;

  // 1. kör: rövidített név → teljes név az egyszereplős sorokból (oldalanként).
  const known: Record<QuarterSide, Map<string, string>> = { home: new Map(), away: new Map() };
  events.forEach(event => {
    const involved = involvedAbbreviations(event);
    (['home', 'away'] as const).forEach(side => {
      const filter = event.filters[side];
      if (involved[side].length === 1 && filter && !known[side].has(involved[side][0])) {
        known[side].set(involved[side][0], filter);
      }
    });
  });

  const periodMap = new Map<string, { team: Record<QuarterSide, QuarterBoxLine>; players: Record<QuarterSide, Map<string, QuarterPlayerLine>> }>();
  const bucket = (key: string) => {
    let entry = periodMap.get(key);
    if (!entry) {
      entry = {
        team: { home: emptyQuarterLine(), away: emptyQuarterLine() },
        players: { home: new Map(), away: new Map() },
      };
      periodMap.set(key, entry);
    }
    return entry;
  };

  // 2. kör: összegzés a periódusra és az egész meccsre.
  events.forEach(event => {
    const { action, side } = event;
    const involved = involvedAbbreviations(event);
    const names: Record<QuarterSide, Array<string | null>> = {
      home: resolveSideNames(involved.home, event.filters.home, known.home),
      away: resolveSideNames(involved.away, event.filters.away, known.away),
    };
    const actorName = names[side][0] ?? null;
    const assisterName = action.assister ? names[side][1] ?? null : null;
    const otherName = names[otherSide(side)][0] ?? null;
    // A csapat technikai hibája nem játékos-fault.
    const isTeamTechnical = action.kind === 'technical' && /^csapat$/i.test(action.actor);

    for (const key of [event.period, TOTAL_PERIOD_KEY]) {
      const entry = bucket(key);
      const playerLine = (lineSide: QuarterSide, name: string | null): QuarterBoxLine | null => {
        if (!name) return null;
        let line = entry.players[lineSide].get(name);
        if (!line) {
          line = { player: name, ...emptyQuarterLine() };
          entry.players[lineSide].set(name, line);
        }
        return line;
      };
      const apply = (lineSide: QuarterSide, name: string | null, update: (line: QuarterBoxLine) => void) => {
        update(entry.team[lineSide]);
        const line = playerLine(lineSide, name);
        if (line) update(line);
      };

      switch (action.kind) {
        case 'made':
        case 'missed': {
          const made = action.kind === 'made' ? 1 : 0;
          apply(side, actorName, line => {
            if (action.shotType === 'büntető') {
              line.fta += 1;
              line.ftm += made;
            } else if (action.shotType === 'hárompontos') {
              line.fga3 += 1;
              line.fgm3 += made;
            } else {
              line.fga2 += 1;
              line.fgm2 += made;
            }
            if (made) line.points += action.points;
          });
          // A sikeres büntetőhöz írt gólpassz is gólpassz – a hivatalos box score is
          // így számol (44 ASE meccsen ellenőrizve); kihagyott dobáshoz nem jár.
          if (made && action.assister) {
            apply(side, assisterName, line => { line.ast += 1; });
          }
          if (action.blocker) apply(otherSide(side), otherName, line => { line.blk += 1; });
          break;
        }
        case 'oreb':
          apply(side, actorName, line => { line.oreb += 1; });
          break;
        case 'dreb':
          apply(side, actorName, line => { line.dreb += 1; });
          break;
        case 'tov':
          apply(side, actorName, line => { line.tov += 1; });
          if (action.stealer) apply(otherSide(side), otherName, line => { line.stl += 1; });
          break;
        case 'foul':
          apply(side, actorName, line => { line.pf += 1; });
          break;
        case 'technical':
          if (!isTeamTechnical) apply(side, actorName, line => { line.pf += 1; });
          break;
      }
    }
  });

  const toPeriod = (key: string): QuarterPeriod => {
    const entry = bucket(key);
    const sortPlayers = (map: Map<string, QuarterPlayerLine>) =>
      Array.from(map.values()).sort((a, b) => b.points - a.points || a.player.localeCompare(b.player, 'hu'));
    return {
      key,
      label: quarterPeriodLabel(key),
      team: entry.team,
      players: { home: sortPlayers(entry.players.home), away: sortPlayers(entry.players.away) },
    };
  };

  const periodKeys = Array.from(periodMap.keys())
    .filter(key => key !== TOTAL_PERIOD_KEY)
    .sort((a, b) => periodOrder(a) - periodOrder(b));

  return { periods: periodKeys.map(toPeriod), total: toPeriod(TOTAL_PERIOD_KEY) };
};

// ---------------------------------------------------------------------------
// Származtatott mutatók – a post-game riport definícióival (H12): TO rate az
// Oliver-féle LV / (FGA + 0,44·FTA + LV), FT-mutató FTM / FGA, a birtoklás a két
// csapat becslésének átlaga. A százalékok 0–100 skálán, `null`, ha nincs minta.
// ---------------------------------------------------------------------------

export type QuarterLineMetrics = {
  fgm: number;
  fga: number;
  fgPct: number | null;
  twoPct: number | null;
  threePct: number | null;
  ftPct: number | null;
  efg: number | null;
  ts: number | null;
  reb: number;
  /** Oliver-féle TO rate: LV / (FGA + 0,44·FTA + LV). */
  turnoverRate: number | null;
  /** T-lep / (T-lep + ellenfél V-lep). */
  orebPct: number | null;
  /** FTM / FGA. */
  ftRate: number | null;
  /** Pont / 100 birtoklás a közös birtoklásszámmal. */
  rating: number | null;
};

export type QuarterMatchupMetrics = {
  own: QuarterLineMetrics;
  opp: QuarterLineMetrics;
  /** A két csapat birtoklásbecslésének átlaga. */
  possessions: number;
  /** Saját ORtg − ellenfél ORtg (= saját DRtg). */
  net: number | null;
};

const ratio = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : null);

/** Egy csapat birtoklásbecslése: FGA + 0,44·FTA + LV − T-lep. */
export const quarterLinePossessions = (line: QuarterBoxLine) =>
  Math.max(line.fga2 + line.fga3 + 0.44 * line.fta + line.tov - line.oreb, 0);

const lineMetrics = (line: QuarterBoxLine, opp: QuarterBoxLine, possessions: number): QuarterLineMetrics => {
  const fgm = line.fgm2 + line.fgm3;
  const fga = line.fga2 + line.fga3;
  const usage = fga + 0.44 * line.fta + line.tov;
  return {
    fgm,
    fga,
    fgPct: ratio(fgm, fga),
    twoPct: ratio(line.fgm2, line.fga2),
    threePct: ratio(line.fgm3, line.fga3),
    ftPct: ratio(line.ftm, line.fta),
    efg: fga > 0 ? effectiveFgPct(fgm, line.fgm3, fga) : null,
    ts: fga + line.fta > 0 ? trueShootingPct(line.points, fga, line.fta) : null,
    reb: line.oreb + line.dreb,
    turnoverRate: ratio(line.tov, usage),
    orebPct: ratio(line.oreb, line.oreb + opp.dreb),
    ftRate: ratio(line.ftm, fga),
    rating: possessions > 0 ? (line.points / possessions) * 100 : null,
  };
};

/** A saját és az ellenfél mutatói egy periódusra (vagy az egész meccsre). */
export const buildQuarterMatchupMetrics = (own: QuarterBoxLine, opp: QuarterBoxLine): QuarterMatchupMetrics => {
  const possessions = (quarterLinePossessions(own) + quarterLinePossessions(opp)) / 2;
  const ownMetrics = lineMetrics(own, opp, possessions);
  const oppMetrics = lineMetrics(opp, own, possessions);
  return {
    own: ownMetrics,
    opp: oppMetrics,
    possessions,
    net: ownMetrics.rating !== null && oppMetrics.rating !== null ? ownMetrics.rating - oppMetrics.rating : null,
  };
};

/** Egy játékos sorának mutatói (a csapat nélküli részhalmaz). */
export const quarterPlayerShooting = (line: QuarterBoxLine) => {
  const fgm = line.fgm2 + line.fgm3;
  const fga = line.fga2 + line.fga3;
  return {
    fgm,
    fga,
    reb: line.oreb + line.dreb,
    efg: fga > 0 ? effectiveFgPct(fgm, line.fgm3, fga) : null,
    ts: fga + line.fta > 0 ? trueShootingPct(line.points, fga, line.fta) : null,
  };
};
