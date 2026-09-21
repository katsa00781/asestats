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
 * Klub-átnevezések. A régebbi szezonok scrapelt oldalain még a korábbi név
 * szerepel, a teams sor viszont már az aktuálisat viseli – a fuzzy matching
 * ezt nem tudja kitalálni (nincs elég közös token). Kulcs és érték is
 * normalizált alak (lásd normalizeName).
 *
 * Klub átnevezésekor ide kell felvenni a régi nevet, különben a korábbi
 * szezonok újraimportálása duplikált teams sort termel.
 */
export const TEAM_NAME_ALIASES: Record<string, string> = {
  // 2026/2027-től az "Endo Plus Service" szponzornév kikerült a klub nevéből.
  'endo plus service-honved': 'budapesti honved sportegyesulet',
};

const applyTeamNameAlias = (normalized: string) => TEAM_NAME_ALIASES[normalized] || normalized;

export const cleanTeamName = (value: string) =>
  value
    .replace(/first teams logo|second teams logo|logo/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Szigorú matching: pontos név, short_name vagy rövidítés egyezés. */
export const findTeamByNameStrict = <T extends ScrapeTeamRecord>(
  teams: T[],
  name: string
): T | undefined => {
  const normalizedTarget = applyTeamNameAlias(normalizeName(name));
  if (!normalizedTarget) return undefined;

  return (
    teams.find(team => normalizeName(team.name) === normalizedTarget) ||
    teams.find(team => team.short_name && normalizeName(team.short_name) === normalizedTarget) ||
    teams.find(team => {
      const teamAbbr = buildAbbreviation(normalizeName(team.name));
      const targetAbbr = buildAbbreviation(normalizedTarget);
      return Boolean(teamAbbr) && teamAbbr === targetAbbr;
    })
  );
};

/** Fuzzy matching: a szigorú lépések + substring és token-átfedés. */
export const findTeamByNameFuzzy = <T extends ScrapeTeamRecord>(
  teams: T[],
  name: string
): T | undefined => {
  const normalizedTarget = applyTeamNameAlias(normalizeName(name));
  if (!normalizedTarget) return undefined;

  const targetTokens = tokenizeNormalized(normalizedTarget);

  return (
    teams.find(team => normalizeName(team.name) === normalizedTarget) ||
    teams.find(team => team.short_name && normalizeName(team.short_name) === normalizedTarget) ||
    teams.find(team => {
      const normalizedTeamName = normalizeName(team.name);
      return normalizedTeamName.includes(normalizedTarget) || normalizedTarget.includes(normalizedTeamName);
    }) ||
    teams.find(team => {
      if (targetTokens.length === 0) return false;
      const teamTokens = tokenizeTeamName(team.name);
      if (teamTokens.length === 0) return false;
      const overlap = targetTokens.filter(token => teamTokens.includes(token)).length;
      return overlap >= Math.min(2, targetTokens.length);
    }) ||
    teams.find(team => {
      const teamAbbr = buildAbbreviation(normalizeName(team.name));
      const targetAbbr = buildAbbreviation(normalizedTarget);
      return Boolean(teamAbbr) && teamAbbr === targetAbbr;
    })
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

/** Supabase hibaobjektum olvasható stringgé alakítása CLI loghoz. */
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
