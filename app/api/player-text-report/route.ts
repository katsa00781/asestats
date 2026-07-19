import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const supabaseAdmin = getSupabaseAdmin();

type SavePlayerTextPayload = {
  seasonId: string;
  teamId?: string | null;
  playerId: string;
  reportType?: 'season';
  narrative: string;
  analysisSnapshot?: unknown;
  generatedBy?: string | null;
};

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const payload = (await request.json().catch(() => null)) as SavePlayerTextPayload | null;

  if (!payload) {
    return NextResponse.json({ ok: false, error: 'Hiányzik a kérés törzse.' }, { status: 400 });
  }

  if (!payload.seasonId || !payload.playerId || !payload.narrative?.trim()) {
    return NextResponse.json(
      { ok: false, error: 'A seasonId, playerId és narrative mezők kötelezőek.' },
      { status: 400 }
    );
  }

  const generatedAt = new Date().toISOString();
  const reportType = payload.reportType ?? 'season';

  const { data, error } = await supabaseAdmin
    .from('player_text_reports')
    .upsert(
      {
        season_id: payload.seasonId,
        team_id: payload.teamId ?? null,
        player_id: payload.playerId,
        report_type: reportType,
        narrative: payload.narrative.trim(),
        analysis_snapshot: payload.analysisSnapshot ?? null,
        generated_by: payload.generatedBy ?? 'season-comparison-ui',
        generated_at: generatedAt,
      },
      { onConflict: 'season_id,team_id,player_id,report_type' }
    )
    .select('id, narrative, generated_at, generated_by')
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, report: data });
}
