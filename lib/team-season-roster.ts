import type { TeamExportStatRow } from './team-season-export';

// Keretváltozás két szezon összevetett mintája között. A játékosokat a
// meccs-sorokból olvassuk (ugyanabból a meccshalmazból, amelyből a mutatók
// készülnek), és név szerint párosítjuk: a `players` tábla szezononként
// külön sort tart, a dedup kulcs a `lower(trim(name))`.

export type RosterLine = {
  key: string;
  name: string;
  /** Meccsek, ahol pályára lépett (perc > 0). */
  games: number;
  minutes: number;
  points: number;
};

export type RosterStayer = { key: string; name: string; prev: RosterLine; cur: RosterLine };

export type RosterChange = {
  stayed: RosterStayer[];
  arrived: RosterLine[];
  left: RosterLine[];
  /** A mintában pályára lépő játékosok száma oldalanként. */
  prevPlayers: number;
  curPlayers: number;
  /** Az idei percek hány %-át játsszák olyanok, akik a tavalyi mintában is szerepeltek. */
  continuityMinutesPct: number | null;
  /** A tavalyi pontok hány %-át szerezték a távozók. */
  leftPointsPct: number | null;
  /** Az idei pontok hány %-át szerzik az érkezők. */
  arrivedPointsPct: number | null;
};

const normalizeName = (name: string) => name.trim().toLowerCase();

/** Egy minta játékosonkénti összesítése a minta saját meccseinek sorai alapján. */
export function buildRosterLines(rows: TeamExportStatRow[], gameIds: Set<string>): Map<string, RosterLine> {
  const lines = new Map<string, RosterLine>();
  rows.forEach(row => {
    if (!gameIds.has(row.game_id)) return;
    const name = row.players?.name?.trim();
    if (!name) return;
    const minutes = row.minutes ?? 0;
    if (minutes <= 0) return;
    const key = normalizeName(name);
    const line = lines.get(key) ?? { key, name, games: 0, minutes: 0, points: 0 };
    line.games += 1;
    line.minutes += minutes;
    line.points += row.points ?? 0;
    lines.set(key, line);
  });
  return lines;
}

const sumOf = (lines: Iterable<RosterLine>, field: 'minutes' | 'points') => {
  let total = 0;
  for (const line of lines) total += line[field];
  return total;
};

const pct = (part: number, whole: number): number | null => (whole > 0 ? (part / whole) * 100 : null);

export function buildRosterChange(prev: Map<string, RosterLine>, cur: Map<string, RosterLine>): RosterChange {
  const stayed: RosterStayer[] = [];
  const arrived: RosterLine[] = [];
  const left: RosterLine[] = [];

  cur.forEach((line, key) => {
    const before = prev.get(key);
    if (before) stayed.push({ key, name: line.name, prev: before, cur: line });
    else arrived.push(line);
  });
  prev.forEach((line, key) => {
    if (!cur.has(key)) left.push(line);
  });

  const byMinutes = (a: RosterLine, b: RosterLine) => b.minutes - a.minutes;
  stayed.sort((a, b) => b.cur.minutes - a.cur.minutes);
  arrived.sort(byMinutes);
  left.sort(byMinutes);

  return {
    stayed,
    arrived,
    left,
    prevPlayers: prev.size,
    curPlayers: cur.size,
    continuityMinutesPct: pct(sumOf(stayed.map(item => item.cur), 'minutes'), sumOf(cur.values(), 'minutes')),
    leftPointsPct: pct(sumOf(left, 'points'), sumOf(prev.values(), 'points')),
    arrivedPointsPct: pct(sumOf(arrived, 'points'), sumOf(cur.values(), 'points')),
  };
}
