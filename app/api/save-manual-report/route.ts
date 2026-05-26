import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL hiányzik.');
if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY hiányzik.');

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

type SaveManualPayload = {
  reportTarget: 'game' | 'player_season' | 'team_season';
  reportType?: string | null;
  narrative: string;
  // game report
  gameId?: string | null;
  opponentName?: string | null;
  ownTeamId?: string | null;
  ownTeamName?: string | null;
  opponentTeamId?: string | null;
  // player season report
  playerId?: string | null;
  playerName?: string | null;
  // shared: season/team
  seasonId?: string | null;
  teamId?: string | null;
};

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as SaveManualPayload | null;

  if (!payload?.narrative?.trim()) {
    return NextResponse.json({ ok: false, error: 'Hiányzik a narrative mező.' }, { status: 400 });
  }

  const generatedAt = new Date().toISOString();

  try {
    if (payload.reportTarget === 'game') {
      if (!payload.gameId) {
        return NextResponse.json({ ok: false, error: 'Hiányzik a gameId.' }, { status: 400 });
      }
      const gameReportType = payload.reportType ?? 'manual';
      const { data, error } = await supabaseAdmin
        .from('game_text_reports')
        .upsert(
          {
            game_id: payload.gameId,
            team_pair_key: null,
            report_type: gameReportType,
            narrative: payload.narrative.trim(),
            own_team_id: payload.ownTeamId ?? null,
            own_team_name: payload.ownTeamName ?? null,
            opponent_team_id: payload.opponentTeamId ?? null,
            opponent_team_name: payload.opponentName ?? null,
            generated_by: 'manual',
            generated_at: generatedAt,
          },
          { onConflict: 'game_id,report_type' }
        )
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ ok: true, report: data });
    }

    if (payload.reportTarget === 'team_season') {
      if (!payload.seasonId || !payload.teamId) {
        return NextResponse.json({ ok: false, error: 'Hiányzik a seasonId vagy teamId.' }, { status: 400 });
      }
      const { data, error } = await supabaseAdmin
        .from('team_text_reports')
        .upsert(
          {
            season_id: payload.seasonId,
            team_id: payload.teamId,
            report_type: 'manual',
            narrative: payload.narrative.trim(),
            generated_by: 'manual',
            generated_at: generatedAt,
          },
          { onConflict: 'season_id,team_id,report_type' }
        )
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ ok: true, report: data });
    }

    if (payload.reportTarget === 'player_season') {
      if (!payload.playerId || !payload.seasonId) {
        return NextResponse.json({ ok: false, error: 'Hiányzik a playerId vagy seasonId.' }, { status: 400 });
      }
      const { data, error } = await supabaseAdmin
        .from('player_text_reports' as never)
        .upsert(
          {
            player_id: payload.playerId,
            season_id: payload.seasonId,
            team_id: payload.teamId ?? null,
            report_type: 'manual',
            narrative: payload.narrative.trim(),
            generated_by: 'manual',
            generated_at: generatedAt,
          } as never,
          { onConflict: 'player_id,season_id,report_type' }
        )
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ ok: true, report: data });
    }

    return NextResponse.json({ ok: false, error: 'Ismeretlen reportTarget.' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ismeretlen hiba.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
