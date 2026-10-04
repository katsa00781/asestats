import { NextResponse } from 'next/server';
import type { GameTextReportPayload } from '@/lib/game-text-report-prompt';
import { requireAdmin } from '@/lib/api-auth';
import { callAi, AI_GENERATED_BY } from '@/lib/ai-client';
import {
  SYSTEM_PROMPT,
  buildGameTextReportPrompt,
  findUngroundedNumbers,
  resolveTemperature,
} from '@/lib/game-text-report-prompt';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// A teljes elemzés generálása mérten 50–75 mp – a korábbi 60 mp-es keret kevés volt.
export const maxDuration = 120;

/** Az AI hívás időkorlátja; a `maxDuration` alatt marad, hogy a mentésre is jusson idő. */
const AI_TIMEOUT_MS = 105_000;

const supabaseAdmin = getSupabaseAdmin();

const resolveOwnTeamId = (payload: GameTextReportPayload) =>
  payload.postgameReport.teamId ?? payload.pregameReport.ownTeamId ?? null;

const resolveOwnTeamName = (payload: GameTextReportPayload) =>
  payload.postgameReport.teamName ?? payload.pregameReport.ownTeamName ?? 'Saját csapat';

const resolveOpponentTeamId = (payload: GameTextReportPayload) =>
  payload.pregameReport.opponentTeamId ?? null;

const resolveOpponentTeamName = (payload: GameTextReportPayload) =>
  payload.opponentName ?? payload.pregameReport.opponentTeamName ?? payload.postgameReport.opponentName ?? null;

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const payload = (await request.json().catch(() => null)) as GameTextReportPayload | null;
  if (!payload) {
    return NextResponse.json({ ok: false, error: 'Hiányzik a kérés törzse.' }, { status: 400 });
  }

  if (!payload.gameId) {
    return NextResponse.json({ ok: false, error: 'A gameId mező kötelező.' }, { status: 400 });
  }
  if (!payload.pregameReport || !payload.postgameReport) {
    return NextResponse.json({ ok: false, error: 'Hiányzik a pre-game vagy post-game riport.' }, { status: 400 });
  }

  try {
    const style = payload.stylePreset ?? 'balanced';
    const { prompt, context } = buildGameTextReportPrompt(payload);
    const narrative = await callAi(SYSTEM_PROMPT, prompt, resolveTemperature(style), AI_TIMEOUT_MS);
    // A szöveg azon számai, amelyek nem vezethetők vissza az átadott adatokra.
    const unverifiedNumbers = findUngroundedNumbers(narrative, context);
    if (unverifiedNumbers.length > 0) {
      console.warn(`[generate-game-text-report] nem igazolt számok (game=${payload.gameId}): ${unverifiedNumbers.join(', ')}`);
    }
    const reportType = payload.reportType ?? 'combined';
    const ownTeamId = resolveOwnTeamId(payload);
    const ownTeamName = resolveOwnTeamName(payload);
    const opponentTeamId = resolveOpponentTeamId(payload);
    const opponentTeamName = resolveOpponentTeamName(payload);
    const generatedAt = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('game_text_reports')
      .upsert(
        {
          game_id: payload.gameId,
          report_type: reportType,
          narrative,
          pregame_snapshot: payload.pregameReport,
          postgame_snapshot: payload.postgameReport,
          generated_by: payload.generatedBy ?? AI_GENERATED_BY,
          generated_at: generatedAt,
          own_team_id: ownTeamId,
          own_team_name: ownTeamName,
          opponent_team_id: opponentTeamId,
          opponent_team_name: opponentTeamName,
        },
        { onConflict: 'game_id,report_type' }
      )
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, narrative, report: data, unverifiedNumbers });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ismeretlen hiba történt.';
    console.error('[generate-game-text-report]', error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
