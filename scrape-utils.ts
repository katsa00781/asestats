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
