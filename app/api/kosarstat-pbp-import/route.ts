import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { spawn } from 'child_process';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

type KosarstatImportPayload = {
  seasonId?: string;
  seasonName?: string;
  seasonCode?: string;
  rounds?: string;
  dateFrom?: string;
  dateTo?: string;
  gameIds?: string;
  gameLimit?: number;
  startGameIndex?: number;
  forceReimport?: boolean;
  headless?: boolean;
};

type ImportResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

type ImportOptions = {
  seasonId: string;
  seasonName?: string;
  seasonCode?: string;
  rounds?: string;
  dateFrom?: string;
  dateTo?: string;
  gameIds?: string;
  gameLimit?: number;
  startGameIndex?: number;
  forceReimport?: boolean;
  headless?: boolean;
};

type LiveImportState = {
  isRunning: boolean;
  startedAt: number | null;
  finishedAt: number | null;
  durationMs: number | null;
  pid: number | null;
  exitCode: number | null;
  lastError: string | null;
  stoppedByUser: boolean;
  stopMessage: string | null;
  stdout: string;
  stderr: string;
  lastOutputAt: number | null;
  seasonId: string | null;
  seasonCode: string | null;
};

const NPX_COMMAND = process.platform === 'win32' ? 'npx.cmd' : 'npx';
let isRunning = false;
let activeImportProcess: ReturnType<typeof spawn> | null = null;
let stopRequested = false;
let liveState: LiveImportState = {
  isRunning: false,
  startedAt: null,
  finishedAt: null,
  durationMs: null,
  pid: null,
  exitCode: null,
  lastError: null,
  stoppedByUser: false,
  stopMessage: null,
  stdout: '',
  stderr: '',
  lastOutputAt: null,
  seasonId: null,
  seasonCode: null,
};

export async function DELETE(request: Request) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  if (!isRunning && !liveState.pid) {
    return NextResponse.json({ ok: false, error: 'Nincs futo Kosarstat import folyamat.' }, { status: 409 });
  }

  stopRequested = true;
  liveState.lastError = null;
  liveState.stoppedByUser = true;
  liveState.stopMessage = 'A Kosarstat import leallitva felhasznaloi keresre.';
  liveState.lastOutputAt = Date.now();

  const pid = activeImportProcess?.pid ?? liveState.pid ?? null;

  let terminated = false;
  if (activeImportProcess) {
    terminated = activeImportProcess.kill('SIGTERM');

    if (!terminated && activeImportProcess.killed === false) {
      activeImportProcess.kill('SIGKILL');
    }
  } else if (pid && isProcessAlive(pid)) {
    try {
      process.kill(pid, 'SIGTERM');
      terminated = true;
    } catch {
      terminated = false;
    }
  }

  if (!terminated) {
    isRunning = false;
    liveState.isRunning = false;
    liveState.finishedAt = Date.now();
    liveState.durationMs = liveState.startedAt ? Date.now() - liveState.startedAt : null;
  }

  return NextResponse.json({
    ok: true,
    stopped: true,
    pid,
    message: 'Kosarstat import leallitasa elinditva.',
  });
}

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const rawTail = Number.parseInt(url.searchParams.get('tail') || '12000', 10);
  const tailSize = Number.isFinite(rawTail) ? Math.min(Math.max(rawTail, 1000), 200000) : 12000;

  if (liveState.isRunning && liveState.pid && !isProcessAlive(liveState.pid)) {
    isRunning = false;
    liveState.isRunning = false;
    liveState.pid = null;
    liveState.finishedAt = Date.now();
    liveState.durationMs = liveState.startedAt ? Date.now() - liveState.startedAt : null;
    if (!liveState.lastError && !liveState.stoppedByUser) {
      liveState.lastError = 'A futtatott importer folyamat varatlanul leallt.';
    }
  }

  return NextResponse.json({
    ok: true,
    isRunning: liveState.isRunning,
    startedAt: liveState.startedAt,
    finishedAt: liveState.finishedAt,
    durationMs: liveState.durationMs,
    pid: liveState.pid,
    exitCode: liveState.exitCode,
    lastError: liveState.lastError,
    stoppedByUser: liveState.stoppedByUser,
    stopMessage: liveState.stopMessage,
    seasonId: liveState.seasonId,
    seasonCode: liveState.seasonCode,
    lastOutputAt: liveState.lastOutputAt,
    stdoutTail: tailText(liveState.stdout, tailSize),
    stderrTail: tailText(liveState.stderr, tailSize),
    stdoutLength: liveState.stdout.length,
    stderrLength: liveState.stderr.length,
  });
}

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  if (isRunning) {
    return NextResponse.json(
      { ok: false, error: 'Mar fut egy Kosarstat import folyamat. Varj, amig befejezodik.' },
      { status: 409 }
    );
  }

  const payload = (await request.json().catch(() => null)) as KosarstatImportPayload | null;
  const seasonId = payload?.seasonId?.trim();
  if (!seasonId) {
    return NextResponse.json({ ok: false, error: 'Hianyzik a seasonId mezo.' }, { status: 400 });
  }

  const seasonName = payload?.seasonName?.trim() || undefined;
  const seasonCode = sanitizeSeasonCode(payload?.seasonCode);
  const rounds = sanitizeCsvLike(payload?.rounds);
  const dateFrom = sanitizeIsoDate(payload?.dateFrom);
  const dateTo = sanitizeIsoDate(payload?.dateTo);
  const gameIds = sanitizeCsvLike(payload?.gameIds);
  const gameLimit = sanitizeGameLimit(payload?.gameLimit);
  const startGameIndex = sanitizeStartGameIndex(payload?.startGameIndex);
  const forceReimport = payload?.forceReimport === true || Boolean(rounds) || Boolean(gameIds) || Boolean(dateFrom) || Boolean(dateTo);
  const headless = payload?.headless;

  isRunning = true;
  stopRequested = false;
  const startedAt = Date.now();
  liveState = {
    isRunning: true,
    startedAt,
    finishedAt: null,
    durationMs: null,
    pid: null,
    exitCode: null,
    lastError: null,
    stoppedByUser: false,
    stopMessage: null,
    stdout: '',
    stderr: '',
    lastOutputAt: startedAt,
    seasonId,
    seasonCode: seasonCode || null,
  };

  // Fire-and-forget import job: request returns immediately, UI polls GET for live progress.
  void runImporter({
    seasonId,
    seasonName,
    seasonCode,
    rounds,
    dateFrom,
    dateTo,
    gameIds,
    gameLimit,
    startGameIndex,
    forceReimport,
    headless,
  })
    .then(result => {
      liveState.exitCode = result.exitCode;
      liveState.lastError = null;
      liveState.stoppedByUser = false;
      liveState.stopMessage = null;
      liveState.stdout = result.stdout;
      liveState.stderr = result.stderr;
      liveState.lastOutputAt = Date.now();
    })
    .catch(error => {
      const details = error as Error & Partial<ImportResult>;
      liveState.exitCode = details.exitCode ?? 1;
      if (stopRequested) {
        liveState.lastError = null;
        liveState.stoppedByUser = true;
        liveState.stopMessage = liveState.stopMessage || 'A Kosarstat import leallitva felhasznaloi keresre.';
      } else {
        liveState.lastError = details.message || 'Ismeretlen hiba tortent a Kosarstat import kozben.';
        liveState.stoppedByUser = false;
        liveState.stopMessage = null;
      }
      if (typeof details.stdout === 'string') liveState.stdout = details.stdout;
      if (typeof details.stderr === 'string') liveState.stderr = details.stderr;
      liveState.lastOutputAt = Date.now();
    })
    .finally(() => {
      isRunning = false;
      liveState.isRunning = false;
      liveState.pid = null;
      liveState.finishedAt = Date.now();
      liveState.durationMs = startedAt ? Date.now() - startedAt : null;
    });

  return NextResponse.json({
    ok: true,
    started: true,
    startedAt,
    message: 'Kosarstat import elinditva. A folyamat hatterben fut, a statusz GET endpointen kovetheto.',
  });
}

const runImporter = ({ seasonId, seasonName, seasonCode, rounds, dateFrom, dateTo, gameIds, gameLimit, startGameIndex, forceReimport, headless = true }: ImportOptions) =>
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
      KOSARSTAT_SEASON_ID: seasonId,
      KOSARSTAT_HEADLESS: headless === false ? 'false' : 'true',
    };

    if (seasonName) env.KOSARSTAT_SEASON_NAME = seasonName;
    if (seasonCode) env.KOSARSTAT_SEASON_CODE = seasonCode;
    if (rounds) env.KOSARSTAT_ONLY_ROUNDS = rounds;
    if (dateFrom) env.KOSARSTAT_DATE_FROM = dateFrom;
    if (dateTo) env.KOSARSTAT_DATE_TO = dateTo;
    if (gameIds) env.KOSARSTAT_ONLY_GAME_IDS = gameIds;
    if (typeof gameLimit === 'number') env.KOSARSTAT_GAME_LIMIT = String(gameLimit);
    if (typeof startGameIndex === 'number') env.KOSARSTAT_START_GAME_INDEX = String(startGameIndex);
    if (forceReimport) env.KOSARSTAT_FORCE_REIMPORT = 'true';

    const child = spawn(NPX_COMMAND, ['tsx', 'scrape-kosarstat-playbyplay.ts'], {
      cwd: process.cwd(),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    activeImportProcess = child;
    liveState.pid = child.pid ?? null;

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', chunk => {
      const text = chunk.toString();
      stdout += text;
      liveState.stdout += text;
      liveState.lastOutputAt = Date.now();
    });

    child.stderr.on('data', chunk => {
      const text = chunk.toString();
      stderr += text;
      liveState.stderr += text;
      liveState.lastOutputAt = Date.now();
    });

    child.on('error', error => {
      safeReject(Object.assign(error, { stdout, stderr }));
    });

    child.on('close', code => {
      activeImportProcess = null;
      liveState.pid = null;
      if (stopRequested) {
        safeReject(
          Object.assign(new Error('A Kosarstat import leallitva felhasznaloi keresre.'), {
            stdout,
            stderr,
            exitCode: 130,
          })
        );
        return;
      }

      if (code === 0) {
        safeResolve({ stdout, stderr, exitCode: 0 });
      } else {
        const execError = Object.assign(new Error(`A Kosarstat import folyamat ${code ?? 1} koddal allt le.`), {
          stdout,
          stderr,
          exitCode: code ?? 1,
        });
        safeReject(execError);
      }
    });
  });

const sanitizeSeasonCode = (value?: string | null) => {
  if (!value) return undefined;
  const normalized = value.trim();
  if (!/^\d{2,6}$/.test(normalized)) return undefined;
  return normalized;
};

const sanitizeGameLimit = (value?: number | null) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const intValue = Math.floor(value);
  if (intValue < 0) return 0;
  if (intValue > 5000) return 5000;
  return intValue;
};

const sanitizeStartGameIndex = (value?: number | null) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const intValue = Math.floor(value);
  if (intValue < 1) return 1;
  if (intValue > 5000) return 5000;
  return intValue;
};

const sanitizeCsvLike = (value?: string | null) => {
  if (!value) return undefined;
  const normalized = value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .join(',');
  return normalized || undefined;
};

const sanitizeIsoDate = (value?: string | null) => {
  if (!value) return undefined;
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return undefined;
  return normalized;
};

const tailText = (input: string, length: number) => {
  if (input.length <= length) return input;
  return input.slice(input.length - length);
};

const isProcessAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
