// Post-game export: egy meccs Kosarstat ötös-adatainak modellje (ötösök, on/off,
// párosok, hármasok). Tiszta modul – a nyers Kosarstat táblák értelmezése a
// `SeasonComparison` parserében marad, ide már a kinyert ötösök érkeznek.

/** A Kosarstat ötös-tábla oszlopsorrendje: az ötös i. játékosa ezen a poszton állt. */
export const LINEUP_SLOT_POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'] as const;

/**
 * Ennél rövidebb együtt töltött időből nem vetítünk 40 percre: 1–3 perces
 * mintából irreális Net/40 jön ki. Azonos a post-game nézet rangsor-küszöbével
 * (`SeasonComparison` `LINEUP_MIN_SAMPLE_SECONDS`).
 */
export const LINEUP_NET_MIN_SECONDS = 300;

/**
 * Ennyi hármas kerül az exportba (a legtöbbet együtt játszók). A párosokat a
 * mintaküszöb önmagában kezelhető méretűre szűri (9 játékosnál legfeljebb 36).
 */
export const MAX_TRIOS = 20;

export type PostgameLineupStintInput = {
  /** PG, SG, SF, PF, C sorrendben. */
  players: string[];
  seconds: number;
  teamPts: number;
  oppPts: number;
};

export type PostgameLineupInput = {
  teamName: string;
  starters: string[];
  stints: PostgameLineupStintInput[];
};

/** Egy együtt pályán lévő egység (ötös, páros vagy hármas) ideje és pontjai. */
export type PostgameLineupUnit = {
  players: string[];
  seconds: number;
  teamPts: number;
  oppPts: number;
};

export type PostgameLineupOnOff = {
  player: string;
  /** Poszt szerinti játékidő a Kosarstat ötös-beosztásból, idő szerint csökkenően. */
  positions: Array<{ position: string; seconds: number }>;
  onSeconds: number;
  onFor: number;
  onAgainst: number;
  offSeconds: number;
  offFor: number;
  offAgainst: number;
};

export type PostgameLineupExport = {
  teamName: string;
  starters: string[];
  totalSeconds: number;
  totalFor: number;
  totalAgainst: number;
  /** Minden ötös, együtt töltött idő szerint csökkenően. */
  lineups: PostgameLineupUnit[];
  /** Játékosonkénti on/off, pályán töltött idő szerint csökkenően. */
  onOff: PostgameLineupOnOff[];
  /** Legalább `LINEUP_NET_MIN_SECONDS`-ot együtt töltő párosok, idő szerint csökkenően. */
  pairs: PostgameLineupUnit[];
  /** Ugyanez hármasokra, legfeljebb `MAX_TRIOS` elem. */
  trios: PostgameLineupUnit[];
};

const byName = (a: string, b: string) => a.localeCompare(b, 'hu');

const bySecondsThenDiff = (a: PostgameLineupUnit, b: PostgameLineupUnit) =>
  b.seconds - a.seconds ||
  (b.teamPts - b.oppPts) - (a.teamPts - a.oppPts) ||
  byName(a.players.join('|'), b.players.join('|'));

const combinations = (items: string[], size: number): string[][] => {
  if (size === 0) return [[]];
  return items.flatMap((item, index) =>
    combinations(items.slice(index + 1), size - 1).map(rest => [item, ...rest])
  );
};

/** Az ötösökből összevont `size` fős együttállások, a mintaküszöb fölött. */
const buildCombos = (lineups: PostgameLineupUnit[], size: number, limit?: number): PostgameLineupUnit[] => {
  const byKey = new Map<string, PostgameLineupUnit>();
  lineups.forEach(lineup => {
    combinations([...lineup.players].sort(byName), size).forEach(players => {
      const key = players.join('|');
      const entry = byKey.get(key) ?? { players, seconds: 0, teamPts: 0, oppPts: 0 };
      entry.seconds += lineup.seconds;
      entry.teamPts += lineup.teamPts;
      entry.oppPts += lineup.oppPts;
      byKey.set(key, entry);
    });
  });

  return Array.from(byKey.values())
    .filter(combo => combo.seconds >= LINEUP_NET_MIN_SECONDS)
    .sort(bySecondsThenDiff)
    .slice(0, limit);
};

/**
 * Egy csapat meccsbeli ötös-adatai az exporthoz. `null`, ha nincs értékelhető
 * (öt játékosból álló, pozitív idejű) ötös-sor.
 */
export function buildPostgameLineupExport(input: PostgameLineupInput): PostgameLineupExport | null {
  const stints = input.stints.filter(stint => stint.players.length === 5 && stint.seconds > 0);
  if (stints.length === 0) return null;

  // Ugyanaz az öt játékos más poszt-kiosztással külön sorban is szerepelhet –
  // ötösként egy egység; a megjelenített beosztás a leghosszabb soré.
  const lineupsByKey = new Map<string, PostgameLineupUnit & { longestSeconds: number }>();
  const slotSecondsByPlayer = new Map<string, number[]>();
  stints.forEach(stint => {
    const key = [...stint.players].sort(byName).join('|');
    const entry = lineupsByKey.get(key) ?? { players: stint.players, seconds: 0, teamPts: 0, oppPts: 0, longestSeconds: 0 };
    entry.seconds += stint.seconds;
    entry.teamPts += stint.teamPts;
    entry.oppPts += stint.oppPts;
    if (stint.seconds > entry.longestSeconds) {
      entry.longestSeconds = stint.seconds;
      entry.players = stint.players;
    }
    lineupsByKey.set(key, entry);

    stint.players.forEach((player, slotIndex) => {
      const slots = slotSecondsByPlayer.get(player) ?? LINEUP_SLOT_POSITIONS.map(() => 0);
      slots[slotIndex] += stint.seconds;
      slotSecondsByPlayer.set(player, slots);
    });
  });

  const lineups: PostgameLineupUnit[] = Array.from(lineupsByKey.values())
    .map(({ players, seconds, teamPts, oppPts }) => ({ players, seconds, teamPts, oppPts }))
    .sort(bySecondsThenDiff);

  const total = lineups.reduce(
    (acc, lineup) => ({
      seconds: acc.seconds + lineup.seconds,
      teamPts: acc.teamPts + lineup.teamPts,
      oppPts: acc.oppPts + lineup.oppPts,
    }),
    { seconds: 0, teamPts: 0, oppPts: 0 }
  );

  const onOff: PostgameLineupOnOff[] = Array.from(slotSecondsByPlayer.entries())
    .map(([player, slots]) => {
      const on = lineups
        .filter(lineup => lineup.players.includes(player))
        .reduce(
          (acc, lineup) => ({
            seconds: acc.seconds + lineup.seconds,
            teamPts: acc.teamPts + lineup.teamPts,
            oppPts: acc.oppPts + lineup.oppPts,
          }),
          { seconds: 0, teamPts: 0, oppPts: 0 }
        );
      return {
        player,
        positions: LINEUP_SLOT_POSITIONS
          .map((position, index) => ({ position, seconds: slots[index] }))
          .filter(item => item.seconds > 0)
          .sort((a, b) => b.seconds - a.seconds),
        onSeconds: on.seconds,
        onFor: on.teamPts,
        onAgainst: on.oppPts,
        offSeconds: total.seconds - on.seconds,
        offFor: total.teamPts - on.teamPts,
        offAgainst: total.oppPts - on.oppPts,
      };
    })
    .sort((a, b) => b.onSeconds - a.onSeconds || byName(a.player, b.player));

  return {
    teamName: input.teamName,
    starters: input.starters,
    totalSeconds: total.seconds,
    totalFor: total.teamPts,
    totalAgainst: total.oppPts,
    lineups,
    onOff,
    pairs: buildCombos(lineups, 2),
    trios: buildCombos(lineups, 3, MAX_TRIOS),
  };
}
