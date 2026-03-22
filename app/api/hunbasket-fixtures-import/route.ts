import { NextResponse } from 'next/server';
import { spawn } from 'child_process';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

type FixturesImportPayload = {
  seasonId?: string;
  seasonName?: string;
  seasonSlug?: string;
  scheduleUrl?: string;
  headless?: boolean;
};

type ImportResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

const NPX_COMMAND = process.platform === 'win32' ? 'npx.cmd' : 'npx';
let isRunning = false;

export async function POST(request: Request) {
  if (isRunning) {
    return NextResponse.json(
      { ok: false, error: 'Már fut egy menetrend import. Várj, amíg befejeződik!' },
      { status: 409 }
    );
  }

  const payload = (await request.json().catch(() => null)) as FixturesImportPayload | null;
  const seasonId = payload?.seasonId?.trim();
  if (!seasonId) {
    return NextResponse.json({ ok: false, error: 'Hiányzik a seasonId mező.' }, { status: 400 });
  }

  const seasonName = payload?.seasonName?.trim();
  const seasonSlug = payload?.seasonSlug?.trim();
  const scheduleUrl = sanitizeScheduleUrl(payload?.scheduleUrl);
  const headless = payload?.headless;

  isRunning = true;
  const startedAt = Date.now();

  try {
    const result = await runImporter({
      seasonId,
      seasonName,
      seasonSlug,
      scheduleUrl,
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
    const details = error as Error & Partial<ImportResult>;
    return NextResponse.json(
      {
        ok: false,
        error: details.message || 'Ismeretlen hiba történt a menetrend import során.',
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
  scheduleUrl?: string;
  headless?: boolean;
  signal?: AbortSignal;
};

const runImporter = ({ seasonId, seasonName, seasonSlug, scheduleUrl, headless = true, signal }: ImportOptions) =>
  new Promise<ImportResult>((resolve, reject) => {
    let settled = false;
    const safeResolve = (value: ImportResult) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const safeReject = (error: Error & Partial<ImportResult>) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      HUNBASKET_SEASON_ID: seasonId,
      HUNBASKET_HEADLESS: headless === false ? 'false' : 'true',
    };

    if (seasonName) env.HUNBASKET_SEASON_NAME = seasonName;
    if (seasonSlug) env.HUNBASKET_SEASON_SLUG = seasonSlug;
    if (scheduleUrl) env.HUNBASKET_SCHEDULE_URL = scheduleUrl;

    const child = spawn(NPX_COMMAND, ['tsx', 'scrape-hunbasket-fixtures.ts'], {
      cwd: process.cwd(),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    const handleAbort = () => {
      child.kill('SIGTERM');
      safeReject(Object.assign(new Error('A menetrend import megszakadt.'), { stdout, stderr }));
    };

    if (signal) {
      if (signal.aborted) {
        handleAbort();
        return;
      }
      signal.addEventListener('abort', handleAbort, { once: true });
    }

    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    child.on('error', error => {
      safeReject(Object.assign(error, { stdout, stderr }));
    });

    child.on('close', code => {
      if (signal) {
        signal.removeEventListener('abort', handleAbort);
      }

      if (code === 0) {
        safeResolve({ stdout, stderr, exitCode: 0 });
      } else {
        const execError = Object.assign(new Error(`A menetrend import folyamat ${code ?? 1} kóddal állt le.`), {
          stdout,
          stderr,
          exitCode: code ?? 1,
        });
        safeReject(execError);
      }
    });
  });

const sanitizeScheduleUrl = (value?: string | null) => {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
};
