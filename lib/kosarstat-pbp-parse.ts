// Kosarstat eseménylista (play-by-play) → pontforrások csapatonként.
//
// A Kosarstat nem közöl második esély / labdaeladásból szerzett / gyorsindítás
// pontot, ezért a `game_events` oldal eseménytáblájából, birtoklás-követéssel
// számoljuk. Nem hivatalos adat: a hívó a `points` mezőt a végeredménnyel
// összevetve ellenőrzi, hogy az eseménylista teljes-e.

import type { KosarstatPointSourceTotals } from './postgame-report';

/** Gyors befejezés: labdaszerzés vagy védőlepattanó után ennyi mp-en belüli pont. */
export const QUICK_FINISH_SECONDS = 6;

type Side = 'home' | 'away';
type PossessionStart = 'steal' | 'deadTurnover' | 'defensiveRebound' | 'made' | 'other';

type Possession = {
  side: Side;
  secondChance: boolean;
  offTurnover: boolean;
  startKind: PossessionStart;
  startPeriod: string;
  startRemaining: number;
  scored: boolean;
};

type PossessionEnd = { kind: PossessionStart; by: Side; period: string; remaining: number };

/** A Kosarstat eseménysor típusa: 3 = játékesemény (1–2 fejléc, 4 = ötös). */
const EVENT_ROW_TYPE = '3';

const emptyLine = () => ({ points: 0, secondChancePoints: 0, pointsOffTurnovers: 0, quickFinishPoints: 0 });

/** „Q1 9:37” → periódus + hátralévő másodperc; más alakra `null`. */
const parseClock = (value: string) => {
  const match = value.match(/^(\S+)\s+(\d+):(\d+)/);
  return match ? { period: match[1], remaining: Number(match[2]) * 60 + Number(match[3]) } : null;
};

const pointsOfMadeShot = (text: string, shotType: string) => {
  const explicit = Number(text.match(/(\d) pont/)?.[1]);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  if (shotType === 'hárompontos') return 3;
  return shotType === 'büntető' ? 1 : 2;
};

/**
 * `headers` / `rows`: a `kosarstat_game_page_tables` eseménytáblája (az, amelyik
 * `home_event` oszlopot tartalmaz). `null`, ha a tábla nem eseménylista vagy
 * egyetlen értelmezhető esemény sincs benne.
 */
export const parseKosarstatPointSources = (
  headers: string[],
  rows: unknown[][],
  quickFinishSeconds = QUICK_FINISH_SECONDS
): KosarstatPointSourceTotals | null => {
  const clockIndex = headers.indexOf('minutes');
  const homeIndex = headers.indexOf('home_event');
  const awayIndex = headers.indexOf('away_event');
  const rowTypeIndex = headers.indexOf('row_type');
  if (clockIndex < 0 || homeIndex < 0 || awayIndex < 0 || rowTypeIndex < 0) return null;

  const totals = { home: emptyLine(), away: emptyLine() };
  let possession: Possession | null = null;
  let lastEnd: PossessionEnd | null = null;
  let parsedEvents = 0;

  for (const row of rows) {
    if (String(row[rowTypeIndex] ?? '').trim() !== EVENT_ROW_TYPE) continue;
    const clock = parseClock(String(row[clockIndex] ?? '').trim());
    if (!clock) continue;

    const homeText = String(row[homeIndex] ?? '').trim();
    const awayText = String(row[awayIndex] ?? '').trim();
    const side: Side | null = homeText ? 'home' : awayText ? 'away' : null;
    if (!side) continue;
    const text = (side === 'home' ? homeText : awayText).toLowerCase();

    const made = text.match(/sikeres (\S+)/);
    const missed = text.match(/kihagyott (\S+)/);
    const isOffensiveRebound = text.includes('támadólepattanó');
    const isDefensiveRebound = text.includes('védőlepattanó');
    const isTurnover = text.includes('eladott labda');
    // Fault, csere, időkérés, technikai hiba: nem befolyásolja a birtoklást.
    if (!made && !missed && !isOffensiveRebound && !isDefensiveRebound && !isTurnover) continue;
    parsedEvents += 1;

    // Új birtoklás: a másik csapat lép, vagy a saját kosár után új akció jön
    // (a kosár utáni büntető és a támadólepattanó ugyanahhoz a birtokláshoz tartozik).
    const isFreeThrow = made?.[1] === 'büntető' || missed?.[1] === 'büntető';
    const startsAfterOwnScore: boolean =
      possession !== null && possession.side === side && possession.scored && !isFreeThrow && !isOffensiveRebound;
    if (possession === null || possession.side !== side || startsAfterOwnScore) {
      const previousEnd: PossessionEnd | null = lastEnd !== null && lastEnd.by !== side ? lastEnd : null;
      // Védőlepattanóval induló birtoklás kezdete maga a lepattanó.
      const startFrom: PossessionEnd | null = isDefensiveRebound ? null : previousEnd;
      possession = {
        side,
        secondChance: false,
        offTurnover: !isDefensiveRebound && (previousEnd?.kind === 'steal' || previousEnd?.kind === 'deadTurnover'),
        startKind: isDefensiveRebound ? 'defensiveRebound' : previousEnd?.kind ?? 'other',
        startPeriod: startFrom?.period ?? clock.period,
        startRemaining: startFrom?.remaining ?? clock.remaining,
        scored: false,
      };
      // A lezáró esemény egyszer használható fel – ne öröklődjön későbbi birtoklásra.
      lastEnd = null;
    }

    if (isDefensiveRebound) continue;
    if (isOffensiveRebound) {
      possession.secondChance = true;
      continue;
    }
    if (isTurnover) {
      lastEnd = {
        kind: text.includes('labdaszerzés') ? 'steal' : 'deadTurnover',
        by: side,
        period: clock.period,
        remaining: clock.remaining,
      };
      possession = null;
      continue;
    }
    if (made) {
      const points = pointsOfMadeShot(text, made[1]);
      const line = totals[side];
      line.points += points;
      if (possession.secondChance) line.secondChancePoints += points;
      if (possession.offTurnover) line.pointsOffTurnovers += points;
      const liveStart = possession.startKind === 'steal' || possession.startKind === 'defensiveRebound';
      const elapsed = possession.startPeriod === clock.period ? possession.startRemaining - clock.remaining : Infinity;
      if (liveStart && !possession.secondChance && elapsed <= quickFinishSeconds) line.quickFinishPoints += points;
      possession.scored = true;
      lastEnd = { kind: 'made', by: side, period: clock.period, remaining: clock.remaining };
    }
  }

  if (parsedEvents === 0) return null;
  return { home: totals.home, away: totals.away, quickFinishSeconds };
};
