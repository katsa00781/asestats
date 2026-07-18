import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import type { ScoutingReport } from '@/lib/pregame-scouting';
import type { PostGameReport } from '@/lib/postgame-report';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const supabaseAdmin = getSupabaseAdmin();

type SaveTextReportPayload = {
  gameId: string;
  reportType?: 'pregame' | 'postgame' | 'combined';
  narrative: string;
  pregameSnapshot?: ScoutingReport | null;
  postgameSnapshot?: PostGameReport | null;
  generatedBy?: string | null;
  ownTeamId?: string | null;
  ownTeamName?: string | null;
  opponentTeamId?: string | null;
  opponentTeamName?: string | null;
};

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const payload = (await request.json().catch(() => null)) as SaveTextReportPayload | null;

  if (!payload) {
    return NextResponse.json({ ok: false, error: 'Hiányzik a kérés törzse.' }, { status: 400 });
  }

  const { gameId, narrative } = payload;
  if (!gameId) {
    return NextResponse.json({ ok: false, error: 'A gameId mező kötelező.' }, { status: 400 });
  }
  if (!narrative?.trim()) {
    return NextResponse.json({ ok: false, error: 'A narratíva nem lehet üres.' }, { status: 400 });
  }

  const reportType = payload.reportType ?? 'combined';
  const ownTeamId =
    payload.ownTeamId ??
    payload.postgameSnapshot?.teamId ??
    payload.pregameSnapshot?.ownTeamId ??
    null;
  const ownTeamName =
    payload.ownTeamName ??
    payload.postgameSnapshot?.teamName ??
    payload.pregameSnapshot?.ownTeamName ??
    null;
  const opponentTeamId =
    payload.opponentTeamId ??
    payload.pregameSnapshot?.opponentTeamId ??
    null;
  const opponentTeamName =
    payload.opponentTeamName ??
    payload.pregameSnapshot?.opponentTeamName ??
    payload.postgameSnapshot?.opponentName ??
    null;
  const generatedAt = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('game_text_reports')
    .upsert(
      {
        game_id: gameId,
        report_type: reportType,
        narrative: narrative.trim(),
        pregame_snapshot: payload.pregameSnapshot ?? null,
        postgame_snapshot: payload.postgameSnapshot ?? null,
        generated_by: payload.generatedBy ?? null,
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
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, report: data });
}
