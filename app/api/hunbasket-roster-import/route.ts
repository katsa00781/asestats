import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { runScript, type ScriptResult, type ScriptError } from '@/lib/run-script';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

type RosterImportPayload = {
  teamFilter?: string;
  seasonSlug?: string;
  seasonName?: string;
  seasonId?: string;
  standingsUrl?: string;
  headless?: boolean;
};

let isRunning = false;

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (isRunning) {
    return NextResponse.json(
      { ok: false, error: 'Már fut egy keret frissítés. Várj, amíg befejeződik!' },
      { status: 409 }
    );
  }

  const payload = (await request.json().catch(() => null)) as RosterImportPayload | null;
  const seasonId = payload?.seasonId?.trim();
  if (!seasonId) {
    return NextResponse.json({ ok: false, error: 'Hiányzik a seasonId mező.' }, { status: 400 });
  }

  const seasonName = payload?.seasonName?.trim();
  const seasonSlug = payload?.seasonSlug?.trim();
  const headless = payload?.headless;
  const standingsUrl = sanitizeStandingsUrl(payload?.standingsUrl);
  const teamFilter = sanitizeTeamFilter(payload?.teamFilter);

  isRunning = true;
  const startedAt = Date.now();

  try {
    const result = await runImporter({
      seasonId,
      seasonName,
      seasonSlug,
      teamFilter,
      standingsUrl,
      headless,
      signal: request.signal,
    });

    return NextResponse.json({
      ok: true,
      durationMs: Date.now() - startedAt,
      stdout: result.stdout,
      stderr: result.stderr,
    });
  } catch (error) {
    const details = error as ScriptError;
    return NextResponse.json(
      {
        ok: false,
        error: details.message || 'Ismeretlen hiba történt a keret frissítése közben.',
        stdout: details.stdout,
        stderr: details.stderr,
      },
      { status: 500 }
    );
  } finally {
    isRunning = false;
  }
}

type ImportOptions = {
  seasonId: string;
  seasonName?: string;
  seasonSlug?: string;
  teamFilter?: string;
  standingsUrl?: string;
  headless?: boolean;
  signal?: AbortSignal;
};

const runImporter = ({ seasonId, seasonName, seasonSlug, teamFilter, standingsUrl, headless = true, signal }: ImportOptions): Promise<ScriptResult> => {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HUNBASKET_SEASON_ID: seasonId,
    HUNBASKET_HEADLESS: headless === false ? 'false' : 'true',
  };

  if (seasonName) env.HUNBASKET_SEASON_NAME = seasonName;
  if (seasonSlug) env.HUNBASKET_SEASON_SLUG = seasonSlug;
  if (teamFilter) env.HUNBASKET_TEAM_FILTER = teamFilter;
  if (standingsUrl) env.HUNBASKET_STANDINGS_URL = standingsUrl;

  return runScript('scrape-hunbasket-rosters.ts', env, signal);
};

const sanitizeTeamFilter = (value?: string | null) => {
  if (!value) return undefined;
  const names = value
    .split(',')
    .map(name => name.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (names.length === 0) return undefined;
  return names.join(', ');
};

const sanitizeStandingsUrl = (value?: string | null) => {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return undefined;
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
};
