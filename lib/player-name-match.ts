/**
 * Játékosnevek párosítása a források között (Hunbasket box score ↔ Kosarstat).
 *
 * Mindkét forrás nagybetűvel írja a vezetéknevet, a sorrend és a keresztnév
 * viszont eltér: „CHANDLER III. John Watson” ↔ „Jay Jay CHANDLER”,
 * „KRIVACEVIC Markó” ↔ „KRIVACSEVICS Markó”. A párosítás ezért a
 * vezetéknévre épül (pontos vagy kis elírású egyezés), a keresztnév csak
 * megerősít. Két azonos keresztnevű csapattárs („HALMAI Dániel” / „NAGY
 * Dániel”) így nem keveredik össze.
 *
 * Tiszta függvények, külső függőség nélkül.
 */

/**
 * Kézi alias-térkép, ha a szabályok nem elegendők: normalizált forrásnév →
 * normalizált box score név (`normalizePlayerName` alak).
 */
export const PLAYER_NAME_ALIASES: Record<string, string> = {
  // „Trey” = III.; a rövid vezetéknév miatt a kezdőbetű-szabály nem elég.
  'trey wertz': 'wertz iii langston boyer walter',
};

const NAME_SUFFIXES = new Set(['ii', 'iii', 'iv', 'jr', 'sr']);

export const normalizePlayerName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

type NameParts = { surname: string[]; given: string[] };

/**
 * Vezeték- és keresztnév-tokenek. Vezetéknév = a csupa nagybetűs token; a
 * Kosarstat „ ᛫ C” pozíció-utótagja és a generációs jelölés (II, III., Jr)
 * kimarad.
 */
const splitPlayerName = (raw: string): NameParts => {
  const surname: string[] = [];
  const given: string[] = [];
  raw
    .split('᛫')[0]
    .split(/\s+/)
    .forEach(rawToken => {
      const token = normalizePlayerName(rawToken);
      if (!token || NAME_SUFFIXES.has(token)) return;
      const letters = rawToken.replace(/[^\p{L}]/gu, '');
      const isUpper = letters.length >= 2 && letters === letters.toLocaleUpperCase('hu');
      (isUpper ? surname : given).push(token);
    });
  return { surname, given };
};

const levenshtein = (a: string, b: string) => {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
};

/** Pontos egyezés, vagy hosszabb névnél legfeljebb 2 karakteres átírási eltérés. */
const tokensSimilar = (a: string, b: string) =>
  a === b || (Math.min(a.length, b.length) >= 6 && levenshtein(a, b) <= 2);

const givenCompatible = (a: string[], b: string[], longSurname: boolean) => {
  if (a.length === 0 || b.length === 0) return true;
  const overlaps = a.some(x => b.some(y => x === y || (Math.min(x.length, y.length) >= 4 && (x.includes(y) || y.includes(x)))));
  if (overlaps) return true;
  // Becenév („Jay Jay” ↔ „John Watson”): hosszú vezetéknévnél elég a kezdőbetű.
  return longSurname && a.some(x => b.some(y => x[0] === y[0]));
};

/** A korábbi token-alapú egyezés – csak ha valamelyik névben nincs nagybetűs vezetéknév. */
const legacyTokenMatch = (a: string, b: string) => {
  const aTokens = a.split(' ').filter(Boolean);
  const bTokens = b.split(' ').filter(Boolean);
  if (aTokens.length < 2) return false;
  const hasLongSharedToken = bTokens.some(bt =>
    bt.length >= 6 && aTokens.some(at => at === bt || bt.includes(at) || at.includes(bt))
  );
  if (hasLongSharedToken) return true;
  let exactMatches = 0;
  const allTokensMatch = aTokens.every(token => {
    const matched = bTokens.find(bt => bt === token || bt.includes(token) || token.includes(bt));
    if (matched === token) exactMatches += 1;
    return Boolean(matched);
  });
  return allTokensMatch && exactMatches >= 1;
};

/** Ugyanarra a játékosra utal-e a két név. */
export const playerNamesMatch = (a: string, b: string): boolean => {
  const aKey = normalizePlayerName(a);
  const bKey = normalizePlayerName(b);
  if (!aKey || !bKey) return false;
  if ((PLAYER_NAME_ALIASES[aKey] ?? aKey) === (PLAYER_NAME_ALIASES[bKey] ?? bKey)) return true;

  const aParts = splitPlayerName(a);
  const bParts = splitPlayerName(b);
  if (aParts.surname.length === 0 || bParts.surname.length === 0) {
    return legacyTokenMatch(aKey, bKey);
  }

  const sharedSurname = aParts.surname.find(x => bParts.surname.some(y => tokensSimilar(x, y)));
  if (!sharedSurname) return false;
  return givenCompatible(aParts.given, bParts.given, sharedSurname.length >= 6);
};

export type PlayerNameResolution = {
  /** Forrásnév → a párosított célnév. */
  matched: Map<string, string>;
  /** Egyik célnévvel sem párosítható forrásnevek. */
  unmatched: string[];
  /** Több célnévvel is párosítható forrásnevek (nem párosítjuk őket). */
  ambiguous: string[];
};

/** Forrásnevek (pl. Kosarstat) egyértelmű párosítása a célnevekhez (box score). */
export const resolvePlayerNames = (sourceNames: string[], targetNames: string[]): PlayerNameResolution => {
  const matched = new Map<string, string>();
  const unmatched: string[] = [];
  const ambiguous: string[] = [];
  Array.from(new Set(sourceNames)).forEach(source => {
    const candidates = targetNames.filter(target => playerNamesMatch(source, target));
    if (candidates.length === 1) matched.set(source, candidates[0]);
    else if (candidates.length === 0) unmatched.push(source);
    else ambiguous.push(source);
  });
  return { matched, unmatched, ambiguous };
};
