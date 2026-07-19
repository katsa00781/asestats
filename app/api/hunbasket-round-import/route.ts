import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { runScript } from '@/lib/run-script';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

type ImportRequestPayload = {
  roundFilter?: string;
  teamFilter?: string;
  seasonSlug?: string;
  seasonName?: string;
  seasonId?: string;
  leagueCode?: string;
  scheduleUrl?: string;
  standingsUrl?: string;
  dateFrom?: string;
  dateTo?: string;
  headless?: boolean;
};

type ImportOptions = {
  roundFilter?: string;
  teamFilter?: string;
  seasonSlug?: string;
  seasonName?: string;
  seasonId?: string;
  leagueCode?: string;
  scheduleUrl?: string;
  standingsUrl?: string;
  standingsMatchday?: number;
  dateFrom?: string;
  dateTo?: string;
  headless?: boolean;
  signal?: AbortSignal;
};

type ImportResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

let isRunning = false;

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (isRunning) {
    return NextResponse.json({ ok: false, error: 'Már fut egy import folyamat. Várj, amíg befejeződik!' }, { status: 409 });
  }

  const payload = (await request.json().catch(() => null)) as ImportRequestPayload | null;
  const sanitizedRoundFilter = sanitizeRoundFilter(payload?.roundFilter);

  const scheduleUrl = sanitizeScheduleUrl(payload?.scheduleUrl);
  const leagueCode = sanitizeLeagueCode(payload?.leagueCode);
  const standingsUrl = sanitizeStandingsUrl(payload?.standingsUrl) || deriveStandingsUrl(scheduleUrl);
  const standingsMatchday = parseRoundFilterMaxRound(sanitizedRoundFilter);

  isRunning = true;
  const startedAt = Date.now();

  try {
    const result = await runImporter({
      roundFilter: sanitizedRoundFilter,
      teamFilter: payload?.teamFilter?.trim() || undefined,
      seasonSlug: payload?.seasonSlug?.trim() || undefined,
      seasonName: payload?.seasonName?.trim() || undefined,
      seasonId: payload?.seasonId?.trim() || undefined,
      leagueCode,
      scheduleUrl,
      standingsUrl,
      standingsMatchday,
      dateFrom: sanitizeDateString(payload?.dateFrom),
      dateTo: sanitizeDateString(payload?.dateTo),
      headless: payload?.headless,
      signal: request.signal,
    });

    return NextResponse.json({
      ok: true,
      durationMs: Date.now() - startedAt,
      stdout: result.stdout,
      stderr: result.stderr,
    });
  } catch (error) {
    const details = error as Error & { stdout?: string; stderr?: string };
    return NextResponse.json(
      {
        ok: false,
        error: details.message || 'Ismeretlen hiba történt az import során.',
        stdout: details.stdout,
        stderr: details.stderr,
      },
      { status: 500 }
    );
  } finally {
    isRunning = false;
  }
}

const runImporter = ({
  roundFilter,
  teamFilter,
  seasonSlug,
  seasonName,
  seasonId,
  leagueCode,
  scheduleUrl,
  standingsUrl,
  standingsMatchday,
  dateFrom,
  dateTo,
  headless = true,
  signal,
}: ImportOptions) =>
  new Promise<ImportResult>((resolve, reject) => {
    let settled = false;
    const safeResolve = (result: ImportResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const safeReject = (error: Error & Partial<ImportResult>) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      HUNBASKET_HEADLESS: headless === false ? 'false' : 'true',
    };

    if (roundFilter) env.HUNBASKET_ROUND_FILTER = roundFilter;
    if (teamFilter !== undefined) env.HUNBASKET_TEAM_FILTER = teamFilter;
    if (seasonSlug) env.HUNBASKET_SEASON_SLUG = seasonSlug;
    if (seasonName) env.HUNBASKET_SEASON_NAME = seasonName;
    if (seasonId) env.HUNBASKET_SEASON_ID = seasonId;
    if (leagueCode) env.HUNBASKET_LEAGUE_CODE = leagueCode;
    if (scheduleUrl) env.HUNBASKET_SCHEDULE_URL = scheduleUrl;
    if (standingsUrl) env.HUNBASKET_STANDINGS_URL = standingsUrl;
    if (typeof standingsMatchday === 'number') env.HUNBASKET_STANDINGS_MATCHDAY = String(standingsMatchday);
    if (dateFrom) env.HUNBASKET_DATE_FROM = dateFrom;
    if (dateTo) env.HUNBASKET_DATE_TO = dateTo;

    let stdout = '';
    let stderr = '';
    let aborted = false;

    const run = async () => {
      const fixtures = await runScript('scrape-hunbasket-fixtures.ts', env, signal);
      stdout += fixtures.stdout;
      stderr += fixtures.stderr;

      const standings = await runScript('scrape-hunbasket-standings.ts', env, signal);
      stdout += standings.stdout;
      stderr += standings.stderr;

      const stats = await runScript('scrape-hunbasket.ts', env, signal);
      stdout += stats.stdout;
      stderr += stats.stderr;

      safeResolve({ stdout, stderr, exitCode: 0 });
    };

    const handleAbort = () => {
      aborted = true;
      safeReject(Object.assign(new Error('Az import folyamat megszakadt.'), { stdout, stderr, exitCode: 1 }));
    };

    if (signal) {
      if (signal.aborted) {
        handleAbort();
        return;
      }
      signal.addEventListener('abort', handleAbort, { once: true });
    }

    run().catch(error => {
      if (signal) {
        signal.removeEventListener('abort', handleAbort);
      }

      if (aborted) return;

      const details = error as Error & Partial<ImportResult>;
      safeReject(
        Object.assign(
          new Error(details.message || 'Az importáló folyamat hibával állt le.'),
          {
            stdout: stdout + (details.stdout || ''),
            stderr: stderr + (details.stderr || ''),
            exitCode: details.exitCode ?? 1,
          }
        )
      );
      return;
    }).finally(() => {
      if (signal) {
        signal.removeEventListener('abort', handleAbort);
      }
    });
  });

const sanitizeScheduleUrl = (value?: string | null) => {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return undefined;
    parsed.pathname = parsed.pathname.replace('/menetrend/', '/menetrend-teljes/');
    return parsed.toString();
  } catch {
    return undefined;
  }
};

const sanitizeLeagueCode = (value?: string | null) => {
  if (!value) return undefined;
  const sanitized = value.trim().replace(/[^a-z0-9_]/gi, '').toLowerCase();
  return sanitized || undefined;
};

const sanitizeStandingsUrl = (value?: string | null) => {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
};

const deriveStandingsUrl = (scheduleUrl?: string) => {
  if (!scheduleUrl) return undefined;
  try {
    const parsed = new URL(scheduleUrl);
    if (parsed.pathname.includes('/menetrend-teljes/')) {
      parsed.pathname = parsed.pathname.replace('/menetrend-teljes/', '/tabella/');
      return parsed.toString();
    }
    if (parsed.pathname.includes('/menetrend/')) {
      parsed.pathname = parsed.pathname.replace('/menetrend/', '/tabella/');
      return parsed.toString();
    }
    return undefined;
  } catch {
    return undefined;
  }
};

const parseRoundFilterMaxRound = (value?: string) => {
  if (!value) return undefined;
  const numbers = Array.from(value.matchAll(/\d+/g)).map(match => parseInt(match[0], 10)).filter(Number.isFinite);
  if (numbers.length === 0) return undefined;
  return Math.max(...numbers);
};

const sanitizeDateString = (value?: string | null) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : undefined;
};

const sanitizeRoundFilter = (value?: string | null) => {
  if (!value) return undefined;
  const sanitized = value
    .replace(/[^\p{L}0-9,\s-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  return sanitized || undefined;
};
