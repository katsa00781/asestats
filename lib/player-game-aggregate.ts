// Játékos meccssorainak összesítése: minden arány az ÖSSZEGEKBŐL számol
// (pl. TS% = ΣPTS / (2·(ΣFGA + 0,44·ΣFTA)), AST/TO = ΣAST / ΣTO), nem a
// meccsenkénti arányok átlagából. A meccsenkénti átlag torzít: a kevés
// kísérletes meccsek ugyanakkora súlyt kapnak, mint a nagy volumenűek, ezért
// pl. két részhalmaz TS%-a is lehet egyszerre a szezon-TS% fölött.
import { effectiveFgPct, trueShootingPct } from './stat-formulas';

/** Egy játékos egy meccsének box score sora (csak az aggregáláshoz szükséges mezők). */
export type PlayerGameLine = {
  points: number;
  /** Mezőnykísérlet (2P + 3P). */
  fga: number;
  fgm: number;
  threeMade: number;
  /** Középtávoli kísérlet – a dobásmix arányához. */
  midAttempts: number;
  fta: number;
  ast: number;
  tov: number;
};

export type PlayerGameAggregate = {
  games: number;
  points: number;
  fga: number;
  fgm: number;
  fta: number;
  ast: number;
  tov: number;
  /** FGA + 0,44·FTA + TO – a labdabirtoklás-közelítés (usage proxy). */
  usage: number;
  /** `null`, ha nincs dobáskísérlet. */
  tsPct: number | null;
  efgPct: number | null;
  /** Pont / usage proxy; `null`, ha a usage 0. */
  ppp: number | null;
  /** TO / usage proxy, százalékban; `null`, ha a usage 0. */
  tovPct: number | null;
  /** ΣAST / ΣTO; labdavesztés nélkül a gólpasszok száma (a korábbi konvenció). */
  astTo: number;
  /** Középtávoli kísérletek aránya a mezőnykísérletekből, százalékban; `null`, ha nincs kísérlet. */
  midRatePct: number | null;
};

export const aggregatePlayerGames = (lines: PlayerGameLine[]): PlayerGameAggregate => {
  const sum = (pick: (line: PlayerGameLine) => number) => lines.reduce((acc, line) => acc + (pick(line) || 0), 0);
  const points = sum(line => line.points);
  const fga = sum(line => line.fga);
  const fgm = sum(line => line.fgm);
  const threeMade = sum(line => line.threeMade);
  const midAttempts = sum(line => line.midAttempts);
  const fta = sum(line => line.fta);
  const ast = sum(line => line.ast);
  const tov = sum(line => line.tov);
  const usage = fga + 0.44 * fta + tov;
  const hasShots = fga + 0.44 * fta > 0;

  return {
    games: lines.length,
    points,
    fga,
    fgm,
    fta,
    ast,
    tov,
    usage,
    tsPct: hasShots ? trueShootingPct(points, fga, fta) : null,
    efgPct: fga > 0 ? effectiveFgPct(fgm, threeMade, fga) : null,
    ppp: usage > 0 ? points / usage : null,
    tovPct: usage > 0 ? (tov / usage) * 100 : null,
    astTo: tov > 0 ? ast / tov : ast,
    midRatePct: fga > 0 ? (midAttempts / fga) * 100 : null,
  };
};
