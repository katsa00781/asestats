import type { ScriptError } from '@/lib/run-script';
import { requireAdmin } from '@/lib/api-auth';
import { runScript } from '@/lib/run-script';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

let isRunning = false;

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const payload: unknown = await request.json().catch(() => null);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return NextResponse.json({ ok: false, error: 'Érvénytelen JSON kérés.' }, { status: 400 });
  }
  const { seasonCount = 4, teamFilter = '' } = payload as Record<string, unknown>;
  if ((seasonCount !== 3 && seasonCount !== 4) || typeof teamFilter !== 'string' || teamFilter.length > 500) {
    return NextResponse.json(
      { ok: false, error: 'A szezonok száma 3 vagy 4 lehet; a csapatszűrő legfeljebb 500 karakteres szöveg.' },
      { status: 400 },
    );
  }

  // A JSON olvasása után ellenőrzünk, így két párhuzamos kérés sem indulhat el.
  if (isRunning) {
    return NextResponse.json({ ok: false, error: 'Már fut egy játékosmozgás-import. Várd meg a végét!' }, { status: 409 });
  }
  isRunning = true;
  const startedAt = Date.now();
  try {
    const result = await runScript('scrape-kosarstat-team-players.ts', {
      ...process.env,
      KOSARSTAT_HEADLESS: 'true',
      KOSARSTAT_MOVEMENT_SEASON_COUNT: String(seasonCount),
      KOSARSTAT_TEAM_FILTER: teamFilter.split(/[\n,]/).map(name => name.trim()).filter(Boolean).join(','),
    }, AbortSignal.any([request.signal, AbortSignal.timeout(280_000)]));
    return NextResponse.json({ ok: true, durationMs: Date.now() - startedAt, ...result });
  } catch (error) {
    console.error('Játékosmozgás-import hiba:', error);
    const details: ScriptError = error instanceof Error ? error : new Error('Ismeretlen importhiba.');
    return NextResponse.json({
      ok: false,
      error: details.message,
      stdout: details.stdout ?? '',
      stderr: details.stderr ?? '',
      durationMs: Date.now() - startedAt,
    }, { status: 500 });
  } finally {
    isRunning = false;
  }
}
