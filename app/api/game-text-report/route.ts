import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { ScoutingReport } from '@/lib/pregame-scouting';
import type { PostGameReport } from '@/lib/postgame-report';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Hiányzik a NEXT_PUBLIC_SUPABASE_URL környezeti változó.');
}
if (!serviceRoleKey) {
  throw new Error('Hiányzik a SUPABASE_SERVICE_ROLE_KEY környezeti változó.');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

type SaveTextReportPayload = {
  gameId: string;
  reportType?: 'pregame' | 'postgame' | 'combined';
  narrative: string;
  pregameSnapshot?: ScoutingReport | null;
  postgameSnapshot?: PostGameReport | null;
  generatedBy?: string | null;
};

export async function POST(request: Request) {
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
