import { chromium, type Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { inspect } from 'node:util';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || (!SUPABASE_ANON_KEY && !SUPABASE_SERVICE_ROLE_KEY)) {
  console.error('Missing Supabase env vars.');
  process.exit(1);
}

const SUPABASE_KEY = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const KOSARSTAT_BASE = 'https://kosarstat.hu';
const KOSARSTAT_SEASON_CODE = process.env.KOSARSTAT_SEASON_CODE || '2526';
const KOSARSTAT_SEASON_NAME = process.env.KOSARSTAT_SEASON_NAME || '2025/2026';
const KOSARSTAT_SEASON_ID = process.env.KOSARSTAT_SEASON_ID || process.env.HUNBASKET_SEASON_ID || '';
const KOSARSTAT_HEADLESS = process.env.KOSARSTAT_HEADLESS === 'false' ? false : true;
const KOSARSTAT_GAME_LIMIT = parseInt(process.env.KOSARSTAT_GAME_LIMIT || '0', 10);
const KOSARSTAT_START_GAME_INDEX = parseInt(process.env.KOSARSTAT_START_GAME_INDEX || '1', 10);
const KOSARSTAT_FORCE_REIMPORT = process.env.KOSARSTAT_FORCE_REIMPORT === 'true';
const NAVIGATION_TIMEOUT_MS = parseInt(process.env.KOSARSTAT_NAVIGATION_TIMEOUT_MS || '60000', 10);
const NAVIGATION_RETRIES = parseInt(process.env.KOSARSTAT_NAVIGATION_RETRIES || '4', 10);
const REQUIRED_PAGE_TYPES = ['game', 'game_lineups', 'game_events', 'game_result_chart', 'game_quarters'] as const;

type ExtractedTable = {
  tableIndex: number;
  sourceTableDomId: string | null;
  sourceTableDomClass: string | null;
  headingText: string | null;
  headers: string[];
  rows: string[][];
};

type UpsertRawPageOptions = {
  preserveExisting?: boolean;
};

type RawPageMetadata = {
  competitionSeasonLabel: string | null;
  competitionPhase: string | null;
  matchDate: string | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
  homeScore: number | null;
  awayScore: number | null;
};

type MergeTablesResult = {
  inserted: number;
  updatedMetadata: number;
};

type QuarterStatRow = {
  season_id: string;
  kosarstat_game_id: string;
  page_raw_id: string;
  team_name: string;
  team_side: 'home' | 'away' | 'unknown';
  quarter: number;
  points: number | null;
  cumulative_points: number | null;
  imported_at: string;
};

type TeamMetricRow = {
  season_id: string;
  kosarstat_game_id: string;
  page_raw_id: string;
  team_name: string;
  team_side: 'home' | 'away' | 'unknown';
  poss: number | null;
  ortg: number | null;
  efg: number | null;
  tov_pct: number | null;
  orb_pct: number | null;
  ftm_rate: number | null;
  imported_at: string;
};

const formatSupabaseError = (error: unknown) => {
  if (!error) return 'unknown error';
  if (error instanceof Error) return error.message;

  if (typeof error === 'object') {
    const err = error as Record<string, unknown>;
    const parts = [
      typeof err.message === 'string' ? err.message : null,
      typeof err.code === 'string' ? `code=${err.code}` : null,
      typeof err.details === 'string' ? `details=${err.details}` : null,
      typeof err.hint === 'string' ? `hint=${err.hint}` : null,
      typeof err.status === 'number' ? `status=${String(err.status)}` : null,
    ].filter(Boolean);

    if (parts.length > 0) return parts.join(' | ');
  }

  try {
    const asJson = JSON.stringify(error);
    if (asJson && asJson !== '{}') return asJson;
    return inspect(error, { depth: 4, showHidden: true });
  } catch {
    return inspect(error, { depth: 4, showHidden: true });
  }
};

const resolveSeasonId = async (): Promise<string> => {
  if (KOSARSTAT_SEASON_ID) {
    const { data, error } = await supabase
      .from('seasons')
      .select('id')
      .eq('id', KOSARSTAT_SEASON_ID)
      .single();

    if (error || !data) {
      throw new Error(`Season not found for KOSARSTAT_SEASON_ID=${KOSARSTAT_SEASON_ID}`);
    }

    return data.id;
  }

  const { data, error } = await supabase
    .from('seasons')
    .select('id')
    .eq('name', KOSARSTAT_SEASON_NAME)
    .single();

  if (error || !data) {
    throw new Error(`Season not found: ${KOSARSTAT_SEASON_NAME}`);
  }

  return data.id;
};

const dismissCookieBanner = async (page: Page) => {
  try {
    const acceptButton = page.locator('button:has-text("Elfogadom")');
    if (await acceptButton.count()) {
      await acceptButton.first().click({ timeout: 2000 }).catch(() => undefined);
    }
  } catch {
    // no-op
  }
};

const sleep = async (ms: number) => {
  await new Promise(resolve => setTimeout(resolve, ms));
};

const isRetryableNavigationError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || '');
  const lowered = message.toLowerCase();

  return (
    lowered.includes('timeout') ||
    lowered.includes('err_network_changed') ||
    lowered.includes('err_internet_disconnected') ||
    lowered.includes('err_connection_reset') ||
    lowered.includes('err_connection_closed') ||
    lowered.includes('err_connection_aborted') ||
    lowered.includes('err_timed_out')
  );
};

const navigateWithRetry = async (page: Page, url: string) => {
  const attempts = Number.isFinite(NAVIGATION_RETRIES) ? Math.max(1, Math.floor(NAVIGATION_RETRIES)) : 4;
  const timeoutMs = Number.isFinite(NAVIGATION_TIMEOUT_MS)
    ? Math.max(10000, Math.floor(NAVIGATION_TIMEOUT_MS))
    : 60000;

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
      return;
    } catch (error) {
      lastError = error;
      const retryable = isRetryableNavigationError(error);
      const canRetry = retryable && attempt < attempts;
      const reason = error instanceof Error ? error.message : String(error || 'unknown error');

      if (!canRetry) {
        throw error;
      }

      const backoffMs = Math.min(30000, 1500 * attempt);
      console.warn(
        `  NAV RETRY ${attempt}/${attempts} url=${url} wait=${backoffMs}ms reason=${reason.replace(/\s+/g, ' ').slice(0, 220)}`
      );
      await sleep(backoffMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Navigation failed for ${url}`);
};

const collectGameIdsOnCurrentSeasonPage = async (page: Page) => {
  return await page.$$eval('a, [onclick], [data-game], [data-game-id]', elements => {
    const ids = new Set<string>();
    const pattern = /(?:[?&]game=|\bgame\D+)(\d{10,20})/g;

    for (const el of elements) {
      const candidates = [
        el.getAttribute('href'),
        el.getAttribute('onclick'),
        el.getAttribute('data-game'),
        el.getAttribute('data-game-id'),
        el.textContent,
      ];

      for (const input of candidates) {
        if (!input) continue;
        pattern.lastIndex = 0;
        for (const match of input.matchAll(pattern)) {
          if (match[1]) ids.add(match[1]);
        }
      }
    }

    return Array.from(ids);
  });
};

const collectSeasonPageUrlsOnCurrentPage = async (page: Page) => {
  return await page.$$eval('a, [onclick]', (elements, seasonCode) => {
    const urls = new Set<string>();

    for (const el of elements) {
      const rawCandidates: string[] = [];
      const href = el.getAttribute('href') || '';
      const onclick = el.getAttribute('onclick') || '';

      if (href) rawCandidates.push(href);

      const directSeasonMatches = onclick.matchAll(/https?:\/\/[^'"\s)]+\/games\/season_games\/[^'"\s)]+/g);
      for (const match of directSeasonMatches) {
        if (match[0]) rawCandidates.push(match[0]);
      }

      const relativeSeasonMatches = onclick.matchAll(/\/games\/season_games\/[^'"\s)]+/g);
      for (const match of relativeSeasonMatches) {
        if (match[0]) rawCandidates.push(match[0]);
      }

      const querySeasonMatches = onclick.matchAll(/\?season=\d{2,6}[^'"\s)]*/g);
      for (const match of querySeasonMatches) {
        if (match[0]) rawCandidates.push(match[0]);
      }

      for (const raw of rawCandidates) {
        const trimmed = raw.trim();
        if (!trimmed) continue;

        const resolvedCandidates: string[] = [];
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
          resolvedCandidates.push(trimmed);
        } else if (trimmed.startsWith('/')) {
          resolvedCandidates.push(`${location.origin}${trimmed}`);
        } else if (trimmed.startsWith('?')) {
          resolvedCandidates.push(`${location.origin}/games/season_games/${trimmed}`);
        }

        for (const candidate of resolvedCandidates) {
          const cleanCandidate = candidate.split('#')[0];
          let normalized = '';
          try {
            const parsed = new URL(cleanCandidate, location.origin);
            if (!parsed.pathname.includes('/games/season_games/')) continue;

            // Pagination links often omit `season`, so force current target season.
            if (!parsed.searchParams.get('season')) {
              parsed.searchParams.set('season', String(seasonCode || ''));
            }

            normalized = `${parsed.origin}${parsed.pathname}${parsed.search}`;
          } catch {
            continue;
          }

          // Keep only the selected season.
          if (!normalized.includes(`season=${seasonCode}`)) continue;

          urls.add(normalized);
        }
      }
    }

    return Array.from(urls);
  }, KOSARSTAT_SEASON_CODE);
};

const getSeasonPageSignature = async (page: Page) => {
  return await page.evaluate(() => {
    const activePage =
      document.querySelector('a[aria-current="page"]')?.textContent?.trim() ||
      document.querySelector('.pagination .active')?.textContent?.trim() ||
      document.querySelector('.paginate_button.current')?.textContent?.trim() ||
      '';

    const rows = Array.from(document.querySelectorAll('table tbody tr'))
      .slice(0, 5)
      .map(row => (row.textContent || '').replace(/\s+/g, ' ').trim())
      .join('|');

    return `${activePage}::${rows}`;
  });
};

const waitForSeasonPageChange = async (page: Page, beforeSignature: string, timeoutMs = 6000) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    await page.waitForTimeout(250);
    const current = await getSeasonPageSignature(page);
    if (current !== beforeSignature) {
      return true;
    }
  }
  return false;
};

const moveToNextSeasonPage = async (page: Page, beforeSignature: string) => {
  const clickLocators = [
    'a.paginate_button.next',
    '.paginate_button.next',
    'li.next a',
    '.paginate_button.next a',
    'a:has-text("Következő")',
    'a:has-text("KOVETKEZO")',
    'a:has-text("Next")',
  ];

  for (const selector of clickLocators) {
    const candidate = page.locator(selector).first();
    if ((await candidate.count()) === 0) continue;

    const className = ((await candidate.getAttribute('class')) || '').toLowerCase();
    const ariaDisabled = ((await candidate.getAttribute('aria-disabled')) || '').toLowerCase();
    const disabledByClass = className.includes('disabled');
    const disabledByAria = ariaDisabled === 'true';
    if (disabledByClass || disabledByAria) continue;

    await candidate.click({ timeout: 5000 }).catch(() => undefined);
    await dismissCookieBanner(page);

    if (await waitForSeasonPageChange(page, beforeSignature, 5000)) {
      return true;
    }
  }

  const movedByDataTable = await page
    .evaluate(() => {
      type DataTableInfo = { page: number; pages: number };
      type DataTableApi = {
        page: {
          (): DataTableInfo;
          (action: 'next'): { draw: (mode: 'page') => void };
        };
      };
      type JQueryLike = ((selector: string) => { DataTable: () => DataTableApi }) & {
        fn?: {
          dataTable?: {
            isDataTable?: (selector: string) => boolean;
          };
        };
      };

      const win = window as unknown as { jQuery?: unknown; $?: unknown };
      const jqValue = win.jQuery ?? win.$;
      if (!jqValue) return false;

      const $ = jqValue as JQueryLike;
      if (!$.fn?.dataTable?.isDataTable) return false;

      const table = document.querySelector('table') as HTMLTableElement | null;
      if (!table || !table.id) return false;

      const tableSelector = `#${table.id}`;
      if (!$.fn.dataTable.isDataTable(tableSelector)) return false;

      const dt = $(tableSelector).DataTable();
      const info = dt.page();
      if (!info || info.page >= info.pages - 1) return false;

      dt.page('next').draw('page');
      return true;
    })
    .catch(() => false);

  if (movedByDataTable) {
    await dismissCookieBanner(page);
    if (await waitForSeasonPageChange(page, beforeSignature, 5000)) {
      return true;
    }
  }

  return false;
};

const collectGameIdsByNextPagination = async (page: Page, seasonUrl: string, maxPagesToScan: number) => {
  const gameIds = new Set<string>();
  const seenSignatures = new Set<string>();

  await navigateWithRetry(page, seasonUrl);
  await page.waitForTimeout(1200);
  await dismissCookieBanner(page);

  for (let pageIndex = 0; pageIndex < maxPagesToScan; pageIndex += 1) {
    await page.waitForTimeout(500);

    const idsOnPage = await collectGameIdsOnCurrentSeasonPage(page);
    for (const id of idsOnPage) gameIds.add(id);

    const signatureBefore = await getSeasonPageSignature(page);
    if (seenSignatures.has(signatureBefore)) {
      break;
    }
    seenSignatures.add(signatureBefore);

    const moved = await moveToNextSeasonPage(page, signatureBefore);

    if (!moved) {
      break;
    }
  }

  return {
    gameIds: Array.from(gameIds),
    scannedPages: seenSignatures.size,
  };
};

const extractGameIdsFromSeasonPage = async (page: Page) => {
  const seasonUrl = `${KOSARSTAT_BASE}/games/season_games/?season=${KOSARSTAT_SEASON_CODE}`;
  const maxPagesToScan = 100;

  const primary = await collectGameIdsByNextPagination(page, seasonUrl, maxPagesToScan);
  const gameIds = new Set<string>(primary.gameIds);
  console.log(`Season pages scanned (next pagination): ${primary.scannedPages}`);

  // Fallback: also crawl discovered season page URLs and merge IDs.
  const urlsToVisit: string[] = [seasonUrl];
  const queuedUrls = new Set<string>([seasonUrl]);
  const visitedUrls = new Set<string>();

  while (urlsToVisit.length > 0 && visitedUrls.size < maxPagesToScan) {
    const currentUrl = urlsToVisit.shift();
    if (!currentUrl) break;
    if (visitedUrls.has(currentUrl)) continue;

    visitedUrls.add(currentUrl);

    await navigateWithRetry(page, currentUrl);
    await page.waitForTimeout(1200);
    await dismissCookieBanner(page);
    await page.waitForTimeout(600);

    const idsOnPage = await collectGameIdsOnCurrentSeasonPage(page);
    for (const id of idsOnPage) gameIds.add(id);

    const discoveredSeasonUrls = await collectSeasonPageUrlsOnCurrentPage(page);
    for (const discoveredUrl of discoveredSeasonUrls) {
      if (queuedUrls.has(discoveredUrl) || visitedUrls.has(discoveredUrl)) continue;
      queuedUrls.add(discoveredUrl);
      urlsToVisit.push(discoveredUrl);
    }
  }

  console.log(`Season pages scanned (url crawl): ${visitedUrls.size}`);

  return Array.from(gameIds);
};

const discoverGamePageUrls = async (page: Page, gameId: string) => {
  const rootUrl = `${KOSARSTAT_BASE}/games/game/?game=${gameId}`;

  await navigateWithRetry(page, rootUrl);
  await page.waitForTimeout(1000);
  await dismissCookieBanner(page);

  const links = await page.$$eval('a[href*="?game="]', (anchors, gid) => {
    const urls = new Set<string>();

    for (const a of anchors) {
      const href = a.getAttribute('href') || '';
      const absolute = href.startsWith('http') ? href : `${location.origin}${href}`;
      if (!absolute.includes(`game=${gid}`)) continue;
      if (!absolute.includes('/games/game/')) continue;
      urls.add(absolute);
    }

    return Array.from(urls);
  }, gameId);

  const defaults = [
    rootUrl,
    `${KOSARSTAT_BASE}/games/game/game_lineups/?game=${gameId}`,
    `${KOSARSTAT_BASE}/games/game/game_events/?game=${gameId}`,
    `${KOSARSTAT_BASE}/games/game/game_result_chart/?game=${gameId}`,
    `${KOSARSTAT_BASE}/games/game/game_qrts/?game=${gameId}`,
    `${KOSARSTAT_BASE}/games/game/game_quarters/?game=${gameId}`,
  ];

  const merged = new Set<string>([...defaults, ...links]);
  return Array.from(merged);
};

const detectPageType = (url: string) => {
  if (url.includes('/game_lineups/')) return 'game_lineups';
  if (url.includes('/game_events/')) return 'game_events';
  if (url.includes('/game_result_chart/')) return 'game_result_chart';
  if (url.includes('/game_qrts/')) return 'game_quarters';
  if (url.includes('/game_quarters/')) return 'game_quarters';
  return 'game';
};

const normalizeText = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const parseNumeric = (value: string) => {
  const normalized = String(value || '')
    .replace(/\s+/g, '')
    .replace(',', '.')
    .replace('%', '');
  if (!normalized) return null;
  const num = Number.parseFloat(normalized);
  return Number.isFinite(num) ? num : null;
};

const getTeamSide = (teamName: string, metadata: RawPageMetadata): 'home' | 'away' | 'unknown' => {
  const normalized = normalizeText(teamName);
  if (!normalized) return 'unknown';

  const home = normalizeText(metadata.homeTeamName || '');
  const away = normalizeText(metadata.awayTeamName || '');
  if (home && (normalized === home || normalized.includes(home) || home.includes(normalized))) return 'home';
  if (away && (normalized === away || normalized.includes(away) || away.includes(normalized))) return 'away';
  return 'unknown';
};

const headerIndex = (headers: string[], candidates: string[]) => {
  const normalized = headers.map(h => normalizeText(h));
  for (let i = 0; i < normalized.length; i += 1) {
    const current = normalized[i];
    if (candidates.some(candidate => current === candidate || current.includes(candidate))) {
      return i;
    }
  }
  return -1;
};

const extractGameStatsFromTables = (
  seasonId: string,
  gameId: string,
  pageRawId: string,
  tables: ExtractedTable[],
  metadata: RawPageMetadata
) => {
  const importedAt = new Date().toISOString();
  const quarterStats: QuarterStatRow[] = [];
  const teamMetrics: TeamMetricRow[] = [];

  tables.forEach(table => {
    const headers = table.headers.map(item => item.trim()).filter(Boolean);
    const normalizedHeaders = headers.map(item => normalizeText(item));

    const hasTeamCol = normalizedHeaders.some(header => header === 'csapat' || header.includes('csapat'));
    if (!hasTeamCol) return;

    const quarterHeaderCount = normalizedHeaders.filter(header => /^q[1-4]$/.test(header)).length;

    if (quarterHeaderCount >= 4) {
      table.rows.forEach(row => {
        const teamName = String(row[0] || '').trim();
        if (!teamName || normalizeText(teamName) === 'csapat') return;

        const values = row
          .slice(1)
          .map(cell => parseNumeric(cell))
          .filter((num): num is number => typeof num === 'number');

        if (values.length < 4) return;

        const quarterPoints = values.slice(0, 4);
        const cumulative = values.length >= 8 ? values.slice(4, 8) : null;
        const teamSide = getTeamSide(teamName, metadata);

        quarterPoints.forEach((points, quarterIndex) => {
          quarterStats.push({
            season_id: seasonId,
            kosarstat_game_id: gameId,
            page_raw_id: pageRawId,
            team_name: teamName,
            team_side: teamSide,
            quarter: quarterIndex + 1,
            points: Number.isFinite(points) ? Math.round(points) : null,
            cumulative_points:
              cumulative && Number.isFinite(cumulative[quarterIndex])
                ? Math.round(cumulative[quarterIndex])
                : null,
            imported_at: importedAt,
          });
        });
      });
      return;
    }

    const possIndex = headerIndex(headers, ['poss']);
    const ortgIndex = headerIndex(headers, ['ortg']);
    const efgIndex = headerIndex(headers, ['efg']);
    const tovIndex = headerIndex(headers, ['tov']);
    const orbIndex = headerIndex(headers, ['orb']);
    const ftmRateIndex = headerIndex(headers, ['ftm rate', 'ftm']);

    const canParseMetrics =
      possIndex >= 0 &&
      ortgIndex >= 0 &&
      efgIndex >= 0 &&
      tovIndex >= 0 &&
      orbIndex >= 0 &&
      ftmRateIndex >= 0;

    if (!canParseMetrics) return;

    table.rows.forEach(row => {
      const teamName = String(row[0] || '').trim();
      if (!teamName || normalizeText(teamName) === 'csapat') return;

      teamMetrics.push({
        season_id: seasonId,
        kosarstat_game_id: gameId,
        page_raw_id: pageRawId,
        team_name: teamName,
        team_side: getTeamSide(teamName, metadata),
        poss: parseNumeric(row[possIndex] || ''),
        ortg: parseNumeric(row[ortgIndex] || ''),
        efg: parseNumeric(row[efgIndex] || ''),
        tov_pct: parseNumeric(row[tovIndex] || ''),
        orb_pct: parseNumeric(row[orbIndex] || ''),
        ftm_rate: parseNumeric(row[ftmRateIndex] || ''),
        imported_at: importedAt,
      });
    });
  });

  const quarterKey = (row: QuarterStatRow) =>
    `${row.season_id}::${row.kosarstat_game_id}::${normalizeText(row.team_name)}::${row.quarter}`;
  const metricKey = (row: TeamMetricRow) =>
    `${row.season_id}::${row.kosarstat_game_id}::${normalizeText(row.team_name)}`;

  const uniqueQuarter = new Map<string, QuarterStatRow>();
  quarterStats.forEach(row => {
    uniqueQuarter.set(quarterKey(row), row);
  });

  const uniqueMetrics = new Map<string, TeamMetricRow>();
  teamMetrics.forEach(row => {
    uniqueMetrics.set(metricKey(row), row);
  });

  return {
    quarterStats: Array.from(uniqueQuarter.values()),
    teamMetrics: Array.from(uniqueMetrics.values()),
  };
};

const upsertGameStats = async (quarterStats: QuarterStatRow[], teamMetrics: TeamMetricRow[]) => {
  if (quarterStats.length > 0) {
    const { error } = await supabase
      .from('kosarstat_game_quarter_stats')
      .upsert(quarterStats, { onConflict: 'season_id,kosarstat_game_id,team_name,quarter' });

    if (error) {
      throw new Error(
        `Quarter stat upsert failed: ${formatSupabaseError(error)}. Futtasd a supabase-kosarstat-pbp-tables.sql frissitett verziojat.`
      );
    }
  }

  if (teamMetrics.length > 0) {
    const { error } = await supabase
      .from('kosarstat_game_team_metrics')
      .upsert(teamMetrics, { onConflict: 'season_id,kosarstat_game_id,team_name' });

    if (error) {
      throw new Error(
        `Team metric upsert failed: ${formatSupabaseError(error)}. Futtasd a supabase-kosarstat-pbp-tables.sql frissitett verziojat.`
      );
    }
  }
};

const getSeasonGameIdsFromDatabase = async (seasonId: string) => {
  const ids = new Set<string>();

  const { data: fromRaw, error: rawError } = await supabase
    .from('kosarstat_game_pages_raw')
    .select('kosarstat_game_id')
    .eq('season_id', seasonId)
    .not('kosarstat_game_id', 'is', null);

  if (rawError) {
    throw new Error(`DB game id lookup failed (raw pages): ${formatSupabaseError(rawError)}`);
  }

  (fromRaw || []).forEach(row => {
    const gameId = String((row as { kosarstat_game_id?: string | null }).kosarstat_game_id || '').trim();
    if (gameId) ids.add(gameId);
  });

  const { data: fromGames, error: gamesError } = await supabase
    .from('games')
    .select('kosarstat_game_id')
    .eq('season_id', seasonId)
    .not('kosarstat_game_id', 'is', null);

  if (gamesError) {
    throw new Error(`DB game id lookup failed (games): ${formatSupabaseError(gamesError)}`);
  }

  (fromGames || []).forEach(row => {
    const gameId = String((row as { kosarstat_game_id?: string | null }).kosarstat_game_id || '').trim();
    if (gameId) ids.add(gameId);
  });

  return Array.from(ids);
};

const getGameMissingState = async (seasonId: string, gameId: string) => {
  const { data: rawPages, error: rawPagesError } = await supabase
    .from('kosarstat_game_pages_raw')
    .select('id, page_type')
    .eq('season_id', seasonId)
    .eq('kosarstat_game_id', gameId);

  if (rawPagesError) {
    throw new Error(`Missing-state check failed (raw pages): ${formatSupabaseError(rawPagesError)}`);
  }

  const rows = (rawPages || []) as Array<{ id?: string; page_type?: string | null }>;
  const alreadyImported = rows.length > 0;
  const presentPageTypes = new Set<string>();

  rows.forEach(row => {
    const pageType = String(row.page_type || '').trim();
    if (!pageType) return;
    presentPageTypes.add(pageType === 'game_qrts' ? 'game_quarters' : pageType);
  });

  const missingPageTypes = REQUIRED_PAGE_TYPES.filter(pageType => !presentPageTypes.has(pageType));

  const rawIds = rows.map(row => String(row.id || '')).filter(Boolean);
  if (rawIds.length === 0) {
    return {
      alreadyImported,
      missingPageTypes,
      missingTableMetadata: true,
      missingQuarterStats: true,
      missingTeamMetrics: true,
      needsRefresh: true,
    };
  }

  const { count, error: missingError } = await supabase
    .from('kosarstat_game_page_tables')
    .select('id', { count: 'exact', head: true })
    .in('page_raw_id', rawIds)
    .is('source_table_dom_id', null);

  if (missingError) {
    throw new Error(`Missing-state check failed (table metadata): ${formatSupabaseError(missingError)}`);
  }

  const missingTableMetadata = (count || 0) > 0;

  const { count: quarterStatCount, error: quarterStatError } = await supabase
    .from('kosarstat_game_quarter_stats')
    .select('id', { count: 'exact', head: true })
    .eq('season_id', seasonId)
    .eq('kosarstat_game_id', gameId);

  if (quarterStatError) {
    throw new Error(`Missing-state check failed (quarter stats): ${formatSupabaseError(quarterStatError)}`);
  }

  const { count: teamMetricCount, error: teamMetricError } = await supabase
    .from('kosarstat_game_team_metrics')
    .select('id', { count: 'exact', head: true })
    .eq('season_id', seasonId)
    .eq('kosarstat_game_id', gameId);

  if (teamMetricError) {
    throw new Error(`Missing-state check failed (team metrics): ${formatSupabaseError(teamMetricError)}`);
  }

  // Typical regulation games produce 8 quarter rows (2 teams x 4 quarters) and 2 team metric rows.
  const missingQuarterStats = (quarterStatCount || 0) < 8;
  const missingTeamMetrics = (teamMetricCount || 0) < 2;

  return {
    alreadyImported,
    missingPageTypes,
    missingTableMetadata,
    missingQuarterStats,
    missingTeamMetrics,
    needsRefresh:
      missingPageTypes.length > 0 ||
      missingTableMetadata ||
      missingQuarterStats ||
      missingTeamMetrics,
  };
};

const parseRawPageMetadata = (rawText: string): RawPageMetadata => {
  const lines = String(rawText || '')
    .split('\n')
    .map(line => line.replace(/\u00A0/g, ' ').trim())
    .filter(Boolean);

  let competitionSeasonLabel: string | null = null;
  let competitionPhase: string | null = null;
  let matchDate: string | null = null;
  let homeTeamName: string | null = null;
  let awayTeamName: string | null = null;
  let homeScore: number | null = null;
  let awayScore: number | null = null;

  for (const line of lines) {
    const compact = line.replace(/\s+/g, ' ').trim();
    if (!compact) continue;

    if (!competitionSeasonLabel || !competitionPhase || !matchDate) {
      const pipeParts = compact
        .split('|')
        .map(part => part.trim())
        .filter(Boolean);

      if (pipeParts.length >= 3) {
        if (!competitionSeasonLabel && /^\d{4}\s*[-/]\s*\d{4}$/.test(pipeParts[0])) {
          competitionSeasonLabel = pipeParts[0].replace(/\s+/g, '');
        }

        if (!competitionPhase) {
          competitionPhase = pipeParts[1] || null;
        }

        if (!matchDate) {
          const dateMatch = /(\d{4})\.(\d{2})\.(\d{2})/.exec(pipeParts[2]);
          if (dateMatch) {
            matchDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
          }
        }
      }
    }

    if ((!homeTeamName || !awayTeamName) && compact.includes(' - ') && !/(\d{1,3})\s*-\s*(\d{1,3})/.test(compact)) {
      const teamMatch = /^(.+?)\s+-\s+(.+)$/.exec(compact);
      if (teamMatch) {
        const left = teamMatch[1]?.trim() || '';
        const right = teamMatch[2]?.trim() || '';
        if (left && right) {
          homeTeamName = left;
          awayTeamName = right;
        }
      }
    }

    if (homeScore === null || awayScore === null) {
      const scoreMatch = /(^|\D)(\d{1,3})\s*-\s*(\d{1,3})(\D|$)/.exec(compact);
      if (scoreMatch) {
        const parsedHome = Number.parseInt(scoreMatch[2], 10);
        const parsedAway = Number.parseInt(scoreMatch[3], 10);
        if (Number.isFinite(parsedHome) && Number.isFinite(parsedAway)) {
          homeScore = parsedHome;
          awayScore = parsedAway;
        }
      }
    }

    if (competitionSeasonLabel && competitionPhase && matchDate && homeTeamName && awayTeamName && homeScore !== null && awayScore !== null) {
      break;
    }
  }

  return {
    competitionSeasonLabel,
    competitionPhase,
    matchDate,
    homeTeamName,
    awayTeamName,
    homeScore,
    awayScore,
  };
};

const extractTables = async (page: Page): Promise<ExtractedTable[]> => {
  const tables = await page.$$eval('table', allTables => {
    return allTables.map((table, tableIndex) => {
      const headingElement = table.previousElementSibling;
      const headingText = headingElement?.textContent?.trim() || null;
      const sourceTableDomId = table.getAttribute('id')?.trim() || null;
      const sourceTableDomClass = table.getAttribute('class')?.trim() || null;

      const headerCells = Array.from(table.querySelectorAll('thead th'));
      const headers = headerCells
        .map(cell => (cell.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean);

      const bodyRows = Array.from(table.querySelectorAll('tbody tr'));
      const sourceRows = bodyRows.length > 0 ? bodyRows : Array.from(table.querySelectorAll('tr'));

      const rows = sourceRows
        .map(row => {
          const cells = Array.from(row.querySelectorAll('td,th'));
          return cells.map(cell => (cell.textContent || '').replace(/\s+/g, ' ').trim());
        })
        .filter(cells => cells.some(cell => cell.length > 0));

      return {
        tableIndex,
        sourceTableDomId,
        sourceTableDomClass,
        headingText,
        headers,
        rows,
      };
    });
  });

  return tables.filter(table => table.rows.length > 0 || table.headers.length > 0);
};

const upsertRawPage = async (
  seasonId: string,
  gameId: string,
  pageType: string,
  sourceUrl: string,
  rawText: string,
  metadata: RawPageMetadata,
  options?: UpsertRawPageOptions
) => {
  const preserveExisting = options?.preserveExisting === true;

  if (preserveExisting) {
    const { data: existingData, error: existingError } = await supabase
      .from('kosarstat_game_pages_raw')
      .select('id, competition_season_label, competition_phase, match_date, home_team_name, away_team_name, home_score, away_score')
      .eq('season_id', seasonId)
      .eq('kosarstat_game_id', gameId)
      .eq('page_type', pageType)
      .maybeSingle();

    if (existingError) {
      throw new Error(`Raw page existing lookup failed: ${formatSupabaseError(existingError)}`);
    }

    const metadataAlreadyPresent =
      !!existingData?.competition_season_label &&
      !!existingData?.competition_phase &&
      !!existingData?.match_date &&
      !!existingData?.home_team_name &&
      !!existingData?.away_team_name &&
      Number.isFinite(existingData?.home_score as number) &&
      Number.isFinite(existingData?.away_score as number);

    if (existingData?.id && metadataAlreadyPresent) {
      return existingData.id as string;
    }
  }

  const { data, error } = await supabase
    .from('kosarstat_game_pages_raw')
    .upsert(
      {
        season_id: seasonId,
        kosarstat_season_code: KOSARSTAT_SEASON_CODE,
        kosarstat_game_id: gameId,
        page_type: pageType,
        source_url: sourceUrl,
        raw_text: rawText,
        competition_season_label: metadata.competitionSeasonLabel,
        competition_phase: metadata.competitionPhase,
        match_date: metadata.matchDate,
        home_team_name: metadata.homeTeamName,
        away_team_name: metadata.awayTeamName,
        home_score: metadata.homeScore,
        away_score: metadata.awayScore,
        imported_at: new Date().toISOString(),
      },
      { onConflict: 'season_id,kosarstat_game_id,page_type' }
    )
    .select('id')
    .maybeSingle();

  if (error) {
    const formatted = formatSupabaseError(error);
    if (formatted === '{}') {
      throw new Error(
        'Raw page upsert failed: {}. Valoszinuleg hianyzik a schema vagy nincs jogosultsag. Futtasd a supabase-kosarstat-pbp-tables.sql fajlt a cel adatbazison.'
      );
    }
    throw new Error(`Raw page upsert failed: ${formatted}`);
  }

  if (data?.id) {
    return data.id as string;
  }

  const { data: lookupData, error: lookupError } = await supabase
    .from('kosarstat_game_pages_raw')
    .select('id')
    .eq('season_id', seasonId)
    .eq('kosarstat_game_id', gameId)
    .eq('page_type', pageType)
    .maybeSingle();

  if (lookupError) {
    const formatted = formatSupabaseError(lookupError);
    if (formatted === '{}') {
      throw new Error(
        'Raw page lookup after upsert failed: {}. Ellenorizd, hogy a kosarstat_game_pages_raw tabla es RLS policy-k letre vannak hozva.'
      );
    }
    throw new Error(`Raw page lookup after upsert failed: ${formatted}`);
  }

  if (!lookupData?.id) {
    throw new Error(
      'Raw page upsert returned no row. Ellenorizd, hogy lefutott a supabase-kosarstat-pbp-tables.sql migracio es a RLS policy-k megfeleloen be vannak allitva.'
    );
  }

  return lookupData.id as string;
};

const mergePageTables = async (pageRawId: string, tables: ExtractedTable[]): Promise<MergeTablesResult> => {
  if (tables.length === 0) return { inserted: 0, updatedMetadata: 0 };

  const { data: existingRows, error: existingError } = await supabase
    .from('kosarstat_game_page_tables')
    .select('id, table_index, source_table_dom_id, source_table_dom_class')
    .eq('page_raw_id', pageRawId);

  if (existingError) {
    throw new Error(`Failed loading existing tables: ${formatSupabaseError(existingError)}`);
  }

  const existingByIndex = new Map<number, { id: string; source_table_dom_id: string | null; source_table_dom_class: string | null }>();
  (existingRows || []).forEach(row => {
    if (typeof row.table_index !== 'number') return;
    existingByIndex.set(row.table_index, {
      id: String(row.id),
      source_table_dom_id: (row.source_table_dom_id as string | null) || null,
      source_table_dom_class: (row.source_table_dom_class as string | null) || null,
    });
  });

  const inserts = tables
    .filter(table => !existingByIndex.has(table.tableIndex))
    .map(table => ({
      page_raw_id: pageRawId,
      table_index: table.tableIndex,
      source_table_dom_id: table.sourceTableDomId,
      source_table_dom_class: table.sourceTableDomClass,
      heading_text: table.headingText,
      headers: table.headers,
      rows: table.rows,
      imported_at: new Date().toISOString(),
    }));

  if (inserts.length > 0) {
    const { error: insertError } = await supabase
      .from('kosarstat_game_page_tables')
      .insert(inserts);

    if (insertError) {
      throw new Error(`Failed inserting missing tables: ${formatSupabaseError(insertError)}`);
    }
  }

  let updatedMetadata = 0;
  for (const table of tables) {
    const existing = existingByIndex.get(table.tableIndex);
    if (!existing) continue;

    const patch: Record<string, string> = {};
    if (!existing.source_table_dom_id && table.sourceTableDomId) {
      patch.source_table_dom_id = table.sourceTableDomId;
    }
    if (!existing.source_table_dom_class && table.sourceTableDomClass) {
      patch.source_table_dom_class = table.sourceTableDomClass;
    }

    if (Object.keys(patch).length === 0) continue;

    const { error: updateError } = await supabase
      .from('kosarstat_game_page_tables')
      .update(patch)
      .eq('id', existing.id);

    if (updateError) {
      throw new Error(`Failed updating missing table metadata: ${formatSupabaseError(updateError)}`);
    }

    updatedMetadata += 1;
  }

  return {
    inserted: inserts.length,
    updatedMetadata,
  };
};

const importOneGamePage = async (
  page: Page,
  seasonId: string,
  gameId: string,
  url: string,
  options?: { preserveExistingRaw?: boolean }
) => {
  await navigateWithRetry(page, url);
  await page.waitForTimeout(1000);
  await dismissCookieBanner(page);

  const rawText = (await page.locator('body').innerText()) || '';
  const metadata = parseRawPageMetadata(rawText);
  const tables = await extractTables(page);
  const pageType = detectPageType(url);

  const pageRawId = await upsertRawPage(seasonId, gameId, pageType, url, rawText, metadata, {
    preserveExisting: options?.preserveExistingRaw === true,
  });
  const mergeResult = await mergePageTables(pageRawId, tables);

  let quarterStatRows = 0;
  let teamMetricRows = 0;
  if (pageType === 'game' || pageType === 'game_quarters') {
    const extracted = extractGameStatsFromTables(seasonId, gameId, pageRawId, tables, metadata);
    quarterStatRows = extracted.quarterStats.length;
    teamMetricRows = extracted.teamMetrics.length;
    if (quarterStatRows > 0 || teamMetricRows > 0) {
      await upsertGameStats(extracted.quarterStats, extracted.teamMetrics);
    }
  }

  return {
    pageType,
    tableCount: tables.length,
    insertedTables: mergeResult.inserted,
    updatedMetadata: mergeResult.updatedMetadata,
    quarterStatRows,
    teamMetricRows,
  };
};

const main = async () => {
  const seasonId = await resolveSeasonId();
  const browser = await chromium.launch({ headless: KOSARSTAT_HEADLESS });
  const page = await browser.newPage();

  let importedGames = 0;
  let importedPages = 0;
  let failedPages = 0;
  let failedGames = 0;
  let skippedGames = 0;
  let refreshedGames = 0;
  let refreshedPages = 0;

  try {
    const discoveredGameIds = await extractGameIdsFromSeasonPage(page);
    const dbGameIds = await getSeasonGameIdsFromDatabase(seasonId);
    const allGameIds = Array.from(new Set<string>([...discoveredGameIds, ...dbGameIds]));

    console.log(`Kosarstat game IDs found (season page): ${discoveredGameIds.length}`);
    console.log(`Kosarstat game IDs loaded from DB: ${dbGameIds.length}`);
    console.log(`Kosarstat game IDs total to consider: ${allGameIds.length}`);

    const startIndex = Number.isFinite(KOSARSTAT_START_GAME_INDEX)
      ? Math.max(1, Math.floor(KOSARSTAT_START_GAME_INDEX))
      : 1;
    const resumeOffset = Math.min(allGameIds.length, startIndex - 1);
    const resumedGameIds = allGameIds.slice(resumeOffset);
    const gameIds = KOSARSTAT_GAME_LIMIT > 0
      ? resumedGameIds.slice(0, KOSARSTAT_GAME_LIMIT)
      : resumedGameIds;

    if (resumeOffset > 0) {
      console.log(`Resume enabled: skipping first ${resumeOffset} games, starting from game #${resumeOffset + 1}.`);
    }

    if (gameIds.length === 0) {
      if (resumedGameIds.length === 0) {
        console.log(`No games to import after start index ${startIndex}.`);
      } else {
        console.log(
          `No games to import after applying game limit ${KOSARSTAT_GAME_LIMIT} from start index ${startIndex}.`
        );
      }
      return;
    }

    if (KOSARSTAT_GAME_LIMIT > 0) {
      console.log(
        `Game limit active: importing ${gameIds.length} games from start index ${startIndex} (available after resume: ${resumedGameIds.length}).`
      );
    }

    if (KOSARSTAT_FORCE_REIMPORT) {
      console.log('Force reimport enabled: existing games will be refreshed (no skip).');
    }

    for (const [idx, gameId] of gameIds.entries()) {
      const absoluteIndex = resumeOffset + idx + 1;
      console.log(`[${absoluteIndex}/${allGameIds.length}] game=${gameId}`);

      try {
        const missingState = await getGameMissingState(seasonId, gameId);
        const alreadyImported = missingState.alreadyImported;
        const needsMissingRefresh = missingState.needsRefresh;

        if (alreadyImported && !needsMissingRefresh && !KOSARSTAT_FORCE_REIMPORT) {
          skippedGames += 1;
          console.log('  SKIP already imported (no missing pages/metadata)');
          continue;
        }

        if (alreadyImported && needsMissingRefresh) {
          const missingPagesLabel = missingState.missingPageTypes.length > 0
            ? missingState.missingPageTypes.join(', ')
            : 'none';
          console.log(
            `  REFRESH missing parts (missing pages: ${missingPagesLabel}; missing table metadata: ${missingState.missingTableMetadata ? 'yes' : 'no'}; missing quarter stats: ${missingState.missingQuarterStats ? 'yes' : 'no'}; missing team metrics: ${missingState.missingTeamMetrics ? 'yes' : 'no'})`
          );
        }

        const urls = await discoverGamePageUrls(page, gameId);
        let gamePages = 0;
        let gamePageFailures = 0;
        let gameUpdatedMetadata = 0;
        let gameInsertedTables = 0;

        for (const url of urls) {
          try {
            const result = await importOneGamePage(page, seasonId, gameId, url, {
              preserveExistingRaw: alreadyImported,
            });
            gamePages += 1;
            importedPages += 1;
            gameUpdatedMetadata += result.updatedMetadata;
            gameInsertedTables += result.insertedTables;
            if (alreadyImported) {
              refreshedPages += 1;
            }
            console.log(
              `  OK ${result.pageType} tables=${result.tableCount} inserted=${result.insertedTables} metaUpdated=${result.updatedMetadata} qStats=${result.quarterStatRows} teamMetrics=${result.teamMetricRows}`
            );
          } catch (error) {
            gamePageFailures += 1;
            failedPages += 1;
            console.error(`  PAGE FAIL url=${url} error=${(error as Error).message}`);
          }
        }

        if (gamePages > 0) {
          if (alreadyImported) {
            refreshedGames += 1;
          } else {
            importedGames += 1;
          }
        } else {
          failedGames += 1;
        }

        console.log(
          `  Imported pages: ${gamePages}${gamePageFailures > 0 ? ` | Failed pages: ${gamePageFailures}` : ''}${
            alreadyImported ? ` | Missing inserts: ${gameInsertedTables} | Missing metadata updates: ${gameUpdatedMetadata}` : ''
          }`
        );
      } catch (error) {
        failedGames += 1;
        console.error(`  FAIL ${(error as Error).message}`);
      }
    }
  } finally {
    await browser.close();
  }

  console.log('Kosarstat import finished.');
  console.log(`Imported games: ${importedGames}`);
  console.log(`Refreshed games (missing-only): ${refreshedGames}`);
  console.log(`Skipped games: ${skippedGames}`);
  console.log(`Failed games: ${failedGames}`);
  console.log(`Imported pages: ${importedPages}`);
  console.log(`Refreshed pages (missing-only): ${refreshedPages}`);
  console.log(`Failed pages: ${failedPages}`);
};

main().catch(error => {
  console.error('Kosarstat import failed:', error);
  process.exit(1);
});