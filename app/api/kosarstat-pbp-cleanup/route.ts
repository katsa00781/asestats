import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

type CleanupPayload = {
  seasonId?: string;
  seasonCode?: string;
};

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as CleanupPayload | null;
  const seasonId = payload?.seasonId?.trim();
  const seasonCode = payload?.seasonCode?.trim();

  if (!seasonId && !seasonCode) {
    return NextResponse.json(
      { ok: false, error: 'Add meg legalabb a seasonId vagy seasonCode erteket.' },
      { status: 400 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { ok: false, error: 'Hianyzik a Supabase konfiguracio az API route futtatasahoz.' },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  let query = supabase.from('kosarstat_game_pages_raw').delete();

  if (seasonId && seasonCode) {
    query = query.eq('season_id', seasonId).eq('kosarstat_season_code', seasonCode);
  } else if (seasonId) {
    query = query.eq('season_id', seasonId);
  } else if (seasonCode) {
    query = query.eq('kosarstat_season_code', seasonCode);
  }

  const { error } = await query;
  if (error) {
    return NextResponse.json(
      { ok: false, error: `Cleanup sikertelen: ${error.message}` },
      { status: 500 }
    );
  }

  let countQuery = supabase.from('kosarstat_game_pages_raw').select('id', { head: true, count: 'exact' });
  if (seasonId && seasonCode) {
    countQuery = countQuery.eq('season_id', seasonId).eq('kosarstat_season_code', seasonCode);
  } else if (seasonId) {
    countQuery = countQuery.eq('season_id', seasonId);
  } else if (seasonCode) {
    countQuery = countQuery.eq('kosarstat_season_code', seasonCode);
  }

  const { count, error: countError } = await countQuery;
  if (countError) {
    return NextResponse.json(
      {
        ok: true,
        warning: `Cleanup lefutott, de maradek sorok szamlalasa sikertelen: ${countError.message}`,
      },
      { status: 200 }
    );
  }

  return NextResponse.json({
    ok: true,
    remainingRawRows: count ?? 0,
  });
}
