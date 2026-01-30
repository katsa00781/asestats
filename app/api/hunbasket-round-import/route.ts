import { NextResponse } from 'next/server';
import { spawn } from 'child_process';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 600;

type ImportRequestPayload = {
  roundFilter?: string;
  teamFilter?: string;
  seasonSlug?: string;
  seasonName?: string;
  seasonId?: string;
  headless?: boolean;
};

type ImportOptions = {
  roundFilter: string;
  teamFilter?: string;
  seasonSlug?: string;
  seasonName?: string;
  seasonId?: string;
  headless?: boolean;
  signal?: AbortSignal;
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
    return NextResponse.json({ ok: false, error: 'Már fut egy import folyamat. Várj, amíg befejeződik!' }, { status: 409 });
  }

  const payload = (await request.json().catch(() => null)) as ImportRequestPayload | null;
  const rawRoundFilter = payload?.roundFilter?.trim();
  if (!rawRoundFilter) {
    return NextResponse.json({ ok: false, error: 'Hiányzik a roundFilter mező.' }, { status: 400 });
  }

  const sanitizedRoundFilter = rawRoundFilter.replace(/[^0-9,\s-]/g, '').trim();
  if (!sanitizedRoundFilter) {
    return NextResponse.json({ ok: false, error: 'A roundFilter csak számokat, vesszőt és kötőjelet tartalmazhat.' }, { status: 400 });
  }

  isRunning = true;
  const startedAt = Date.now();

  try {
    const result = await runImporter({
      roundFilter: sanitizedRoundFilter,
      teamFilter: payload?.teamFilter?.trim() || undefined,
      seasonSlug: payload?.seasonSlug?.trim() || undefined,
      seasonName: payload?.seasonName?.trim() || undefined,
      seasonId: payload?.seasonId?.trim() || undefined,
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

const runImporter = ({ roundFilter, teamFilter, seasonSlug, seasonName, seasonId, headless = true, signal }: ImportOptions) =>
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
      HUNBASKET_ROUND_FILTER: roundFilter,
      HUNBASKET_HEADLESS: headless === false ? 'false' : 'true',
    };

    if (teamFilter !== undefined) env.HUNBASKET_TEAM_FILTER = teamFilter;
    if (seasonSlug) env.HUNBASKET_SEASON_SLUG = seasonSlug;
    if (seasonName) env.HUNBASKET_SEASON_NAME = seasonName;
    if (seasonId) env.HUNBASKET_SEASON_ID = seasonId;

    const child = spawn(NPX_COMMAND, ['tsx', 'scrape-hunbasket.ts'], {
      cwd: process.cwd(),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    const handleAbort = () => {
      child.kill('SIGTERM');
      safeReject(new Error('Az import folyamat megszakadt.'));
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
      safeReject(error);
    });

    child.on('close', code => {
      if (signal) {
        signal.removeEventListener('abort', handleAbort);
      }

      if (code === 0) {
        safeResolve({ stdout, stderr, exitCode: 0 });
      } else {
        const execError = new Error(`Az importáló folyamat ${code} kóddal állt le.`);
        (execError as Error & ImportResult).stdout = stdout;
        (execError as Error & ImportResult).stderr = stderr;
        (execError as Error & ImportResult).exitCode = code ?? 1;
        safeReject(execError as Error & ImportResult);
      }
    });
  });
