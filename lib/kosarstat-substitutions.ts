// Kosarstat cserék játékosonként: beállások és lecserélések.
//
// Két forrás van. Az elsődleges a `game_events` oldal eseménytáblája
// („Csere: X helyett Y”, másodpercre pontos órával). A tartalék a lineup oldal
// percrácsa, amely percenként egyetlen kódot ad (1 = végig pályán, 2 = beállt,
// 3 = lejött) – ha valaki ugyanabban a percben be is áll és le is megy, az
// egyik esemény a rácsból hiányzik. Ezt a rács-olvasó a pályán / padon
// állapotból következteti vissza, és a következtetett eseményt megjelöli.

export type KosarstatSide = 'home' | 'away';

export type KosarstatRotationEvent = {
  type: 'in' | 'out';
  player: string;
  /** A meccs kezdete óta eltelt játékidő másodpercben. */
  gameSecond: number;
  /** Hányadik játékpercben történt (1-től). */
  minute: number;
  /** Megjelenített idő: a forrás órája („Q4 4:49”) vagy a rácsnál a perc. */
  clockLabel: string;
  /** A percrácsból következtetett esemény – a forrás nem jelöli külön. */
  inferred?: boolean;
};

export type KosarstatPlayerRotation = {
  player: string;
  isStarter: boolean;
  events: KosarstatRotationEvent[];
  /**
   * A meccs végi állapot az eseményektől független forrásból (a percrács
   * utolsó perce), ha ismert – az ellenőrzés ehhez méri az eseményeket.
   */
  observedEndsOnCourt?: boolean;
};

export type KosarstatRotationIssue = {
  player: string;
  ins: number;
  outs: number;
  message: string;
};

/** A Kosarstat eseménysor típusa: 3 = játékesemény. */
const EVENT_ROW_TYPE = '3';
const QUARTER_SECONDS = 600;
const OVERTIME_SECONDS = 300;
const REGULATION_SECONDS = 4 * QUARTER_SECONDS;

const normalizeToken = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\./g, '')
    .trim();

const tokensOf = (value: string) => value.split(/\s+/).map(normalizeToken).filter(Boolean);

/**
 * Illik-e a rövidített név a teljes névre. A Kosarstat a külföldi nevet
 * „Y. Joseph” ↔ „Yasiin JOSEPH”, a magyart „Eilingsfeld J.” ↔ „EILINGSFELD
 * János” alakban írja: ha a rövidítés kezdőbetűvel indul, a teljes név a
 * vezetéknévvel (és az esetleges utótaggal, pl. „III”) zárul; ha kezdőbetűvel
 * végződik, a teljes név a vezetéknévvel kezdődik. A kezdőbetű egy további
 * névelem elején áll.
 */
const matchesAbbreviation = (full: string, abbreviation: string) => {
  const fullTokens = tokensOf(full);
  const abbrTokens = tokensOf(abbreviation);
  const written = abbrTokens.filter(item => item.length > 1);
  const initials = abbrTokens.filter(item => item.length === 1);
  if (written.length === 0 || fullTokens.length < written.length + initials.length) return false;

  const initialFirst = abbrTokens[0].length === 1;
  const surname = initialFirst
    ? fullTokens.slice(fullTokens.length - written.length)
    : fullTokens.slice(0, written.length);
  if (surname.join(' ') !== written.join(' ')) return false;

  const rest = initialFirst
    ? fullTokens.slice(0, fullTokens.length - written.length)
    : fullTokens.slice(written.length);
  return initials.every(initial => {
    const index = rest.findIndex(item => item.startsWith(initial));
    if (index < 0) return false;
    rest.splice(index, 1);
    return true;
  });
};

type NameSplit = { out: string; in: string };

/**
 * A szűrőoszlop a két teljes nevet szóközzel összefűzve adja („Yasiin JOSEPH
 * EILINGSFELD János”); a lehetséges határokat a rövidített nevek jelölik ki.
 * Több keresztnévnél („GÉRINGER Gergő Jay Jay CHANDLER”) több határ is
 * illeszkedhet – ezt a hívó a már ismert nevekkel oldja fel.
 */
const candidateSplits = (filter: string, outAbbr: string, inAbbr: string): NameSplit[] => {
  const parts = filter.split(/\s+/).filter(Boolean);
  const splits: NameSplit[] = [];
  for (let index = 1; index < parts.length; index += 1) {
    const left = parts.slice(0, index).join(' ');
    const right = parts.slice(index).join(' ');
    if (matchesAbbreviation(left, outAbbr) && matchesAbbreviation(right, inAbbr)) splits.push({ out: left, in: right });
  }
  return splits;
};

/**
 * A csere-sorok névpárjai. Az egyértelmű sorok nevei ismertté válnak, a
 * többértelmű sorokat ezekkel (és a hívó `knownNames` listájával, pl. a lineup
 * oldal neveivel) oldjuk fel. Ami így sem dől el, a rövidített alakban marad.
 */
const resolveNameSplits = (
  rows: Array<{ filter: string; outAbbr: string; inAbbr: string }>,
  knownNames: string[]
): NameSplit[] => {
  const known = new Set(knownNames);
  const candidates = rows.map(row => (row.filter ? candidateSplits(row.filter, row.outAbbr, row.inAbbr) : []));
  const resolved: Array<NameSplit | null> = rows.map(() => null);

  let progressed = true;
  while (progressed) {
    progressed = false;
    candidates.forEach((splits, index) => {
      if (resolved[index]) return;
      const bothKnown = splits.filter(split => known.has(split.out) && known.has(split.in));
      const oneKnown = splits.filter(split => known.has(split.out) || known.has(split.in));
      const pick = splits.length === 1
        ? splits[0]
        : bothKnown.length === 1 ? bothKnown[0] : oneKnown.length === 1 ? oneKnown[0] : null;
      if (!pick) return;
      resolved[index] = pick;
      known.add(pick.out);
      known.add(pick.in);
      progressed = true;
    });
  }

  return resolved.map((split, index) => split ?? { out: rows[index].outAbbr, in: rows[index].inAbbr });
};

/** „Q4 4:49” → a meccs kezdete óta eltelt másodperc; ismeretlen periódusra `null`. */
const elapsedSeconds = (clock: string): number | null => {
  const match = clock.match(/^(\S+)\s+(\d+):(\d+)/);
  if (!match) return null;
  const remaining = Number(match[2]) * 60 + Number(match[3]);
  const quarter = match[1].match(/^Q(\d)$/i);
  if (quarter) {
    const index = Number(quarter[1]);
    if (index < 1 || index > 4) return null;
    return (index - 1) * QUARTER_SECONDS + Math.max(0, QUARTER_SECONDS - remaining);
  }
  const overtime = match[1].match(/^(?:OT|H)(\d*)$/i);
  if (overtime) {
    const index = Number(overtime[1] || 1);
    return REGULATION_SECONDS + (index - 1) * OVERTIME_SECONDS + Math.max(0, OVERTIME_SECONDS - remaining);
  }
  return null;
};

/**
 * Játékperc (1-től). A negyed végi (0:00) csere a következő perchez tartozik –
 * mint a percrácsban, ahol a félidei csere a 21. percben áll. A rendes
 * játékidő és a hosszabbítások végén nincs következő perc: az a záró percé.
 */
const minuteOf = (gameSecond: number) => {
  const closesGame = gameSecond >= REGULATION_SECONDS && (gameSecond - REGULATION_SECONDS) % OVERTIME_SECONDS === 0;
  return Math.max(1, Math.floor(gameSecond / 60) + (closesGame ? 0 : 1));
};

/**
 * Csere-események az eseménylistából, oldalanként, a forrás sorrendjében (az
 * azonos időpontú cseréknél a sorrend számít: valaki ugyanabban a holtidőben
 * beállhat és le is jöhet). `headers` / `rows`: a `kosarstat_game_page_tables`
 * eseménytáblája; `knownNames`: a játékosok teljes neve, ha ismert (a lineup
 * oldalról) – a névpárok szétválasztását segíti. `null`, ha a tábla nem
 * eseménylista vagy nincs benne csere.
 */
export const parseKosarstatSubstitutions = (
  headers: string[],
  rows: unknown[][],
  knownNames: string[] = []
): Record<KosarstatSide, KosarstatRotationEvent[]> | null => {
  const clockIndex = headers.indexOf('minutes');
  const rowTypeIndex = headers.indexOf('row_type');
  const columns: Record<KosarstatSide, { event: number; filter: number }> = {
    home: { event: headers.indexOf('home_event'), filter: headers.indexOf('home_player_filter') },
    away: { event: headers.indexOf('away_event'), filter: headers.indexOf('away_player_filter') },
  };
  if (clockIndex < 0 || rowTypeIndex < 0 || columns.home.event < 0 || columns.away.event < 0) return null;

  type SubRow = { side: KosarstatSide; gameSecond: number; clockLabel: string; filter: string; outAbbr: string; inAbbr: string };
  const subRows: SubRow[] = [];
  for (const row of rows) {
    if (String(row[rowTypeIndex] ?? '').trim() !== EVENT_ROW_TYPE) continue;
    const clockLabel = String(row[clockIndex] ?? '').trim();
    const gameSecond = elapsedSeconds(clockLabel);
    if (gameSecond === null) continue;

    for (const side of ['home', 'away'] as const) {
      const text = String(row[columns[side].event] ?? '').trim();
      const match = text.match(/^Csere:\s*(.+?)\s+helyett\s+(.+)$/);
      if (!match) continue;
      const filter = columns[side].filter >= 0 ? String(row[columns[side].filter] ?? '').trim() : '';
      subRows.push({ side, gameSecond, clockLabel, filter, outAbbr: match[1].trim(), inAbbr: match[2].trim() });
    }
  }
  if (subRows.length === 0) return null;

  const result: Record<KosarstatSide, KosarstatRotationEvent[]> = { home: [], away: [] };
  for (const side of ['home', 'away'] as const) {
    const sideRows = subRows.filter(row => row.side === side);
    const names = resolveNameSplits(sideRows, knownNames);
    sideRows.forEach((row, index) => {
      const base = { gameSecond: row.gameSecond, minute: minuteOf(row.gameSecond), clockLabel: row.clockLabel };
      result[side].push(
        { ...base, type: 'out', player: names[index].out },
        { ...base, type: 'in', player: names[index].in }
      );
    });
  }
  return result;
};

/**
 * Egy játékos eseményei a percrács kódjaiból (`codes[0]` az 1. perc). A rács
 * percenként egy kódot ad, ezért az állapotból (pályán / padon) pótoljuk, ami
 * hiányzik: lecserélés padon ülő játékosnál (előtte be kellett állnia), teljes
 * perc a pályán beállás nélkül, stb. A pótolt esemény `inferred`.
 */
export const rotationFromMinuteCodes = (player: string, codes: string[]): KosarstatPlayerRotation => {
  const events: KosarstatRotationEvent[] = [];
  const push = (type: 'in' | 'out', minute: number, inferred: boolean) => {
    const bounded = Math.max(1, minute);
    events.push({
      type,
      player,
      gameSecond: (bounded - 1) * 60,
      minute: bounded,
      clockLabel: `${bounded}. perc`,
      ...(inferred ? { inferred: true } : {}),
    });
  };

  const first = (codes[0] ?? '').trim();
  const isStarter = first === '1' || first === '3';
  let onCourt = isStarter;
  codes.forEach((raw, index) => {
    const code = raw.trim();
    const minute = index + 1;
    const previous = index > 0 ? codes[index - 1].trim() : '';
    if (code === '1') {
      // Beállás-kód nélkül pályán: az előző perc lecserélése után még abban a
      // percben visszaállt, különben a perchatáron lépett be.
      if (!onCourt) push('in', previous === '3' ? minute - 1 : minute, true);
      onCourt = true;
    } else if (code === '2') {
      if (onCourt) push('out', minute, true);
      push('in', minute, false);
      onCourt = true;
    } else if (code === '3') {
      if (!onCourt) push('in', minute, true);
      push('out', minute, false);
      onCourt = false;
    } else {
      // Lecserélés-kód nélkül padon: az előző perc beállása után még abban a
      // percben lejött, különben a perchatáron ment le.
      if (onCourt) push('out', previous === '2' ? minute - 1 : minute, true);
      onCourt = false;
    }
  });

  return { player, isStarter, events, observedEndsOnCourt: onCourt };
};

/**
 * Az oldal eseményei játékosonként. `starters`: a kezdő ötös (a lineup
 * oldalról); ha üres, kezdő az, akinek az első eseménye lecserélés.
 * `observedEnd`: játékosonként a meccs végi állapot független forrásból.
 */
export const groupRotationByPlayer = (
  events: KosarstatRotationEvent[],
  starters: string[],
  observedEnd?: Map<string, boolean>
): KosarstatPlayerRotation[] => {
  const byPlayer = new Map<string, KosarstatRotationEvent[]>();
  events.forEach(event => {
    const list = byPlayer.get(event.player) ?? [];
    list.push(event);
    byPlayer.set(event.player, list);
  });
  const starterSet = new Set(starters);
  starters.forEach(player => {
    if (!byPlayer.has(player)) byPlayer.set(player, []);
  });
  return Array.from(byPlayer.entries()).map(([player, list]) => ({
    player,
    isStarter: starters.length > 0 ? starterSet.has(player) : list[0]?.type === 'out',
    events: list,
    ...(observedEnd?.has(player) ? { observedEndsOnCourt: observedEnd.get(player) } : {}),
  }));
};

/** A játékos a meccs végén a pályán van-e (az események és a kezdő státusz szerint). */
export const endsOnCourt = (rotation: KosarstatPlayerRotation) => {
  const last = rotation.events[rotation.events.length - 1];
  return last ? last.type === 'in' : rotation.isStarter;
};

/**
 * Párosítás-ellenőrzés. Kezdőnél a lecserélések száma a beállásokkal egyenlő,
 * vagy eggyel több, ha a meccs végén a padon ül; cserénél a beállások száma a
 * lecserélésekkel egyenlő, vagy eggyel több, ha a pályán fejezi be. Az
 * eseményeknek ezen felül váltakozniuk kell (pályán lévő nem áll be újra), és
 * ha a meccs végi állapot független forrásból ismert, azzal is egyezniük kell.
 */
export const validateRotation = (rotations: KosarstatPlayerRotation[]): KosarstatRotationIssue[] => {
  const issues: KosarstatRotationIssue[] = [];
  rotations.forEach(rotation => {
    const ins = rotation.events.filter(event => event.type === 'in').length;
    const outs = rotation.events.filter(event => event.type === 'out').length;
    const diff = rotation.isStarter ? outs - ins : ins - outs;
    const counts = `${ins} beállás, ${outs} lecserélés`;

    if (diff !== 0 && diff !== 1) {
      issues.push({
        player: rotation.player,
        ins,
        outs,
        message: rotation.isStarter
          ? `${rotation.player} (kezdő): ${counts} – a lecserélések száma a beállásokkal egyenlő vagy eggyel több lehet`
          : `${rotation.player} (csere): ${counts} – a beállások száma a lecserélésekkel egyenlő vagy eggyel több lehet`,
      });
      return;
    }

    let onCourt = rotation.isStarter;
    const broken = rotation.events.find(event => {
      const wrong = event.type === 'in' ? onCourt : !onCourt;
      onCourt = event.type === 'in';
      return wrong;
    });
    if (broken) {
      issues.push({
        player: rotation.player,
        ins,
        outs,
        message: `${rotation.player}: ${counts} – a sorrend nem váltakozik (${broken.clockLabel}: ${broken.type === 'in' ? 'beállás pályán lévő játékosnál' : 'lecserélés padon ülő játékosnál'})`,
      });
      return;
    }

    const observed = rotation.observedEndsOnCourt;
    if (observed !== undefined && observed !== endsOnCourt(rotation)) {
      issues.push({
        player: rotation.player,
        ins,
        outs,
        message: `${rotation.player}: ${counts} – a meccs végén ${observed ? 'a pályán van' : 'a padon ül'}, az események szerint ${observed ? 'a padon' : 'a pályán'} (hiányzó ${observed ? 'beállás' : 'lecserélés'})`,
      });
    }
  });
  return issues;
};
