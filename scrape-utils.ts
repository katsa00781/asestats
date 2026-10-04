// Közös segédfüggvények a gyökérszintű scraping CLI szkriptekhez.
// Korábban a normalizeName / buildAbbreviation / cleanTeamName /
// findTeamInCache és a Supabase kliens bootstrap 4 szkriptben volt
// szó szerint duplikálva – ez a modul az egyetlen példány.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

export type ScrapeTeamRecord = {
  id: string;
  name: string;
  short_name?: string | null;
  is_primary?: boolean | null;
};

/** Ékezet- és írásjel-mentes, kisbetűs, whitespace-normalizált név. */
export const normalizeName = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * A Hunbasket box-score / keret táblái a vezetéknevet ASCII-only
 * nagybetűsítéssel adják (2026 januárja óta): „RéVéSZ Ádám”, „BUGLYó Barna
 * Gergő”. Az a szótag hibás, amelyben nincs ASCII kisbetű, legalább két ASCII
 * nagybetű van, de van (ékezetes) kisbetű – ezt magyar locale-lal
 * nagybetűsítjük („RÉVÉSZ Ádám”). A rendes nevek („Ádám”, „McDonald”, „II”)
 * változatlanok.
 */
const isAsciiUppercasedToken = (token: string) =>
  !/[a-z]/.test(token) && /[A-Z].*[A-Z]/.test(token) && /\p{Ll}/u.test(token);

export const fixAsciiUppercasedName = (value: string) =>
  value
    .split(' ')
    .map(token => (isAsciiUppercasedToken(token) ? token.toLocaleUpperCase('hu-HU') : token))
    .join(' ');

/** Játékosnév a Hunbasket táblákból: avatar-szöveg, csillag, whitespace, nagybetűsítés. */
export const cleanPlayerName = (value: string) =>
  fixAsciiUppercasedName(
    value
      .replace(/player avatar/gi, '')
      .replace(/\*/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  );

export const buildAbbreviation = (value: string) =>
  value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map(token => (token.length <= 2 ? token : token[0]))
    .join('');

export const tokenizeTeamName = (value: string) => tokenizeNormalized(normalizeName(value));

/** Már normalizált névből tokenek – hogy az alias feloldás után se kelljen újranormalizálni. */
const tokenizeNormalized = (normalized: string) =>
  normalized
    .split(/[\s-]+/)
    .filter(token => token.length >= 2);

/**
 * Klub-átnevezések: `régi név → mai név`, mindkettő normalizált alakban (lásd
 * normalizeName). A forrásoldalak hol a régi, hol az új nevet mutatják, amit a
 * fuzzy matching nem tud kitalálni (nincs elég közös token).
 *
 * Az egyeztetés a párokat **egyenértékű névcsoportként** kezeli (lásd
 * teamNameVariants): a teams sor a csoport bármelyik nevét viselheti, így a
 * `teams.name` átnevezése előtt és után is ugyanarra a sorra talál.
 *
 * Klub átnevezésekor ide kell felvenni a régi nevet, különben a korábbi
 * szezonok újraimportálása duplikált teams sort termel.
 */
export const TEAM_NAME_ALIASES: Record<string, string> = {
  // 2026/2027-től az "Endo Plus Service" szponzornév kikerült a klub nevéből.
  'endo plus service-honved': 'budapesti honved sportegyesulet',
  // 2026/2027-es szponzornév-változások (hunbasket tabella, BACKLOG H7).
  'mvm-ose lions': 'ose lions',
  'szte-szedeak': 'delut-szte-szedeak',
  'falco-vulcano energia kc szombathely': 'falco kc szombathely',
  // A hunbasket a 25/26-os oldalakat már szponzornév nélkül mutatja; ebből
  // keletkezett a 2026-04-19-i duplikált teams sor (összevonva: BACKLOG H7).
  'szolnoki olajbanyasz': 'nhsz-szolnoki olajbanyasz',
};

/** Név → az alias-csoport összes tagja (tranzitívan összefűzve). */
const TEAM_NAME_GROUPS: Map<string, string[]> = (() => {
  const groups = new Map<string, Set<string>>();
  for (const [from, to] of Object.entries(TEAM_NAME_ALIASES)) {
    const merged = new Set([from, to, ...(groups.get(from) ?? []), ...(groups.get(to) ?? [])]);
    merged.forEach(name => groups.set(name, merged));
  }
  return new Map([...groups].map(([name, members]) => [name, [...members]]));
})();

/** A normalizált név és alias-csoportjának többi tagja – a saját név elöl. */
const teamNameVariants = (normalized: string) => [
  normalized,
  ...(TEAM_NAME_GROUPS.get(normalized) ?? []).filter(variant => variant !== normalized),
];

type TeamNamePredicate<T> = (team: T, target: string) => boolean;

/**
 * A lépéseket sorrendben próbálja; egy lépésen belül előbb a saját névvel,
 * aztán az alias-változatokkal. Így egy pontos névegyezés mindig megelőzi a
 * lazább (short_name, substring, rövidítés) találatokat.
 */
const findByNameSteps = <T extends ScrapeTeamRecord>(
  teams: T[],
  name: string,
  steps: TeamNamePredicate<T>[]
): T | undefined => {
  const normalized = normalizeName(name);
  if (!normalized) return undefined;
  const variants = teamNameVariants(normalized);

  for (const step of steps) {
    for (const variant of variants) {
      const hit = teams.find(team => step(team, variant));
      if (hit) return hit;
    }
  }
  return undefined;
};

const matchesExactName = <T extends ScrapeTeamRecord>(team: T, target: string) =>
  normalizeName(team.name) === target;

const matchesShortName = <T extends ScrapeTeamRecord>(team: T, target: string) =>
  Boolean(team.short_name) && normalizeName(team.short_name as string) === target;

const matchesAbbreviation = <T extends ScrapeTeamRecord>(team: T, target: string) => {
  const teamAbbr = buildAbbreviation(normalizeName(team.name));
  return Boolean(teamAbbr) && teamAbbr === buildAbbreviation(target);
};

const matchesSubstring = <T extends ScrapeTeamRecord>(team: T, target: string) => {
  const normalizedTeamName = normalizeName(team.name);
  return normalizedTeamName.includes(target) || target.includes(normalizedTeamName);
};

const matchesTokenOverlap = <T extends ScrapeTeamRecord>(team: T, target: string) => {
  const targetTokens = tokenizeNormalized(target);
  if (targetTokens.length === 0) return false;
  const teamTokens = tokenizeTeamName(team.name);
  if (teamTokens.length === 0) return false;
  const overlap = targetTokens.filter(token => teamTokens.includes(token)).length;
  return overlap >= Math.min(2, targetTokens.length);
};

export const cleanTeamName = (value: string) =>
  value
    .replace(/first teams logo|second teams logo|logo/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Szigorú matching: pontos név, short_name vagy rövidítés egyezés. */
export const findTeamByNameStrict = <T extends ScrapeTeamRecord>(
  teams: T[],
  name: string
): T | undefined =>
  findByNameSteps(teams, name, [matchesExactName, matchesShortName, matchesAbbreviation]);

/** Fuzzy matching: a szigorú lépések + substring és token-átfedés. */
export const findTeamByNameFuzzy = <T extends ScrapeTeamRecord>(
  teams: T[],
  name: string
): T | undefined =>
  findByNameSteps(teams, name, [
    matchesExactName,
    matchesShortName,
    matchesSubstring,
    matchesTokenOverlap,
    matchesAbbreviation,
  ]);

/* ---------------------------------------------------------------------------
 * Szezon-illeszkedés
 * ------------------------------------------------------------------------- */

export type SeasonDateRange = {
  name: string;
  start_date: string | null;
  end_date: string | null;
};

export type SeasonDatedItem = { date: string; label: string };

/** Ekkora szezonon kívüli arány fölött az import írás előtt leáll. */
export const SEASON_MISMATCH_RATIO = 0.1;

/**
 * Szezon-illeszkedés ellenőrzés a Hunbasket importokhoz. A menetrend URL
 * slugja (x2526) és a célszezon egymástól függetlenül állítható – ha
 * elcsúsznak, egy másik évad meccsei kerülnek rossz season_id alá (2026-ban
 * 276 meccs és 138 dobástérkép került így a 2025/2026 szezonba).
 *
 * A TELJES, szűretlen menetrend-listára kell hívni: néhány kilógó meccs
 * (elhalasztott mérkőzés, júniusi döntő) valós lehet, ezeket csak jelzi és
 * visszaadja; a határérték fölött hibát dob, hogy semmi ne íródjon.
 */
export const assertDatesMatchSeason = (
  season: SeasonDateRange,
  items: SeasonDatedItem[],
  source: string
): SeasonDatedItem[] => {
  if (items.length === 0) return [];

  const { start_date: start, end_date: end } = season;
  if (!start || !end) {
    console.warn(`FIGYELEM: a(z) ${season.name} szezonnak nincs start_date/end_date értéke – az illeszkedés nem ellenőrizhető.`);
    return [];
  }

  const outside = items.filter(item => item.date < start || item.date > end);
  if (outside.length === 0) return [];

  const seasonRange = `${start} – ${end}`;
  if (outside.length / items.length <= SEASON_MISMATCH_RATIO) {
    console.warn(
      `FIGYELEM: ${outside.length} mérkőzés dátuma a(z) ${season.name} szezon határain kívül esik (${seasonRange}): ` +
        outside.map(item => `${item.date} ${item.label}`).join(', ')
    );
    return outside;
  }

  const dates = items.map(item => item.date).sort();
  throw new Error(
    `A menetrend nem illeszkedik a kiválasztott szezonhoz: a(z) ${items.length} mérkőzésből ${outside.length} ` +
      `a(z) ${season.name} szezon határain kívül esik. Menetrend dátumtartomány: ${dates[0]} – ${dates[dates.length - 1]}, ` +
      `szezon: ${seasonRange}. Valószínűleg rossz a slug vagy az URL (${source}) a kiválasztott szezonhoz. Nem írok adatot.`
  );
};

/* ---------------------------------------------------------------------------
 * Menetrend-szűrők
 *
 * A forduló-, dátum- és csapatszűrés korábban csak a box-score importban
 * (scrape-hunbasket.ts) létezett, így a dobástérkép-import nem volt szűkíthető.
 * Itt egyetlen példányban él, hogy a szkriptek azonos szintaxist fogadjanak el.
 * ------------------------------------------------------------------------- */

export type RoundFilter = { rounds: Set<number>; stages: Set<string> };

/**
 * Forduló-szűrő bemenet: számok, tartományok és szöveges körök vegyesen,
 * vesszővel elválasztva – pl. `"3-5,12,negyeddöntő"`.
 */
export const parseRoundFilter = (value: string): RoundFilter => {
  const rounds = new Set<number>();
  const stages = new Set<string>();

  value
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .forEach(token => {
      const rangeMatch = token.match(/^(\d+)\s*-\s*(\d+)$/);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1], 10);
        const end = parseInt(rangeMatch[2], 10);
        if (!Number.isNaN(start) && !Number.isNaN(end)) {
          const [min, max] = start <= end ? [start, end] : [end, start];
          for (let current = min; current <= max; current += 1) {
            rounds.add(current);
          }
        }
        return;
      }

      const parsed = parseInt(token, 10);
      if (!Number.isNaN(parsed)) {
        rounds.add(parsed);
        return;
      }

      // Ugyanaz a normalizálás, mint az illesztésnél – így a többszörös
      // szóköz sem akadályozza meg a találatot.
      const normalizedStage = normalizeName(token);
      if (normalizedStage) {
        stages.add(normalizedStage);
      }
    });

  return { rounds, stages };
};

export const isRoundFilterEmpty = (filter: RoundFilter) =>
  filter.rounds.size === 0 && filter.stages.size === 0;

export const matchesRound = (filter: RoundFilter, round?: number | null) => {
  if (isRoundFilterEmpty(filter)) return true;
  if (typeof round !== 'number' || Number.isNaN(round)) return false;
  return filter.rounds.has(round);
};

/**
 * Szöveges kör illesztése substring alapon, hogy a "negyeddonto 1" is
 * illeszkedjen a "negyeddöntő" szűrőre (és fordítva).
 */
export const matchesStage = (filter: RoundFilter, stage?: string | null) => {
  if (isRoundFilterEmpty(filter)) return true;
  const normalized = normalizeName(stage || '');
  if (!normalized) return false;
  for (const filterStage of filter.stages) {
    if (normalized.includes(filterStage) || filterStage.includes(normalized)) return true;
  }
  return false;
};

/** ISO dátum (YYYY-MM-DD) inkluzív tartomány-szűrése; üres határ = nincs korlát. */
export const matchesDateRange = (date: string, from: string, to: string) => {
  if (!from && !to) return true;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
};

/** Vesszős csapatlista normalizált tömbbé; üres bemenet = nincs szűrés. */
export const parseTeamFilter = (value: string): string[] =>
  value
    .split(',')
    .map(team => normalizeName(team.trim()))
    .filter(Boolean);

export const matchesTeamFilter = (normalizedFilters: string[], teamName: string) => {
  if (normalizedFilters.length === 0) return true;
  return normalizedFilters.includes(normalizeName(teamName));
};

/** A Hunbasket getShootchart esemény azon mezői, amik a dedup kulcsot adják. */
export type ShotEventKeyFields = {
  period?: unknown;
  event_order?: unknown;
  playercode?: unknown;
  playercode2?: unknown;
  x?: unknown;
  y?: unknown;
  is_successfull?: unknown;
};

/**
 * Ismétlődő dobásesemények kiszűrése beszúrás előtt. A Hunbasket egyes
 * meccseknél ugyanazt az eseményt 2–3-szor is visszaadja (pl. hun_134749:
 * 309 elem, 125 egyedi), a `hunbasket_shot_events` UNIQUE kulcsa (period,
 * event_order, játékoskód, x, y, is_successful) miatt pedig ilyenkor a teljes
 * batch insert elbukik, és a meccsnek nem lesz dobástérképe. Az első előfordulás
 * marad meg.
 */
export const dedupeShotEvents = <T extends ShotEventKeyFields>(events: T[]): T[] => {
  const seen = new Set<string>();
  return events.filter(event => {
    const playerCode = String(event.playercode || event.playercode2 || '').trim();
    const key = [event.period, event.event_order, playerCode, event.x, event.y, event.is_successfull]
      .map(part => String(part ?? ''))
      .join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/** Supabase hibaobjektum olvasható stringgé alakítása CLI loghoz. */
export type LinkableGameRow = {
  id: string;
  our_team_id: string | null;
  opponent_team_id: string | null;
};

/**
 * Egy meccsnek két `games` sora van (mindkét csapat szemszögéből). A név-
 * alapú Kosarstat-párosítás szponzornév-driftnél csak az egyik sort találja
 * meg („Endo Plus Service-Honvéd” vs. az `opponent` szövegben „Budapesti
 * Honvéd Sportegyesület”), ezért a párosított sorok tükörsora – ugyanaz a
 * nap, felcserélt `our_team_id` / `opponent_team_id` – is hozzáadódik.
 * Az ellenfél azonosítása az `opponent_team_id`-n megy (architektúra 11.).
 */
export const withMirrorGames = <T extends LinkableGameRow>(matched: T[], candidates: T[]): T[] => {
  const result = [...matched];
  const ids = new Set(matched.map(row => row.id));
  matched.forEach(row => {
    if (!row.our_team_id || !row.opponent_team_id) return;
    candidates.forEach(candidate => {
      if (ids.has(candidate.id)) return;
      if (candidate.our_team_id === row.opponent_team_id && candidate.opponent_team_id === row.our_team_id) {
        result.push(candidate);
        ids.add(candidate.id);
      }
    });
  });
  return result;
};

export const formatSupabaseError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const parts = ['message', 'details', 'hint', 'code']
      .map(key => (error as Record<string, unknown>)[key])
      .filter((part): part is string => typeof part === 'string' && part.length > 0);
    if (parts.length > 0) return parts.join(' | ');
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
};

/**
 * Supabase kliens a CLI szkriptekhez: .env.local betöltés + env ellenőrzés.
 * Service role kulcsot preferálja, anon kulcsra esik vissza.
 */
export const createScriptClient = (): SupabaseClient => {
  dotenv.config({ path: '.env.local' });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!url || !key) {
    console.error('Hiányzó Supabase env változók (.env.local: NEXT_PUBLIC_SUPABASE_URL + kulcs).');
    process.exit(1);
  }

  return createClient(url, key, { auth: { persistSession: false } });
};
