import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openAiApiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL hiányzik a környezeti változók közül.');
}
if (!serviceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY hiányzik a környezeti változók közül.');
}
if (!openAiApiKey) {
  throw new Error('OPENAI_API_KEY hiányzik a környezeti változók közül.');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

const MAX_RESPONSE_MS = 50_000;
const OPENAI_URL = process.env.OPENAI_API_URL ?? 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';

const SYSTEM_PROMPT = `Te egy magyar kosárlabda-elemző vagy, aki szurkolóbarát, élményszerű, de adathű szezonértékelést ír.
Szabályok:
- Csak a megadott adatokból dolgozhatsz.
- Nem találhatsz ki új számot vagy mutatót.
- A szöveg legyen olvasmányos, közérthető, mégis szakmailag pontos.
- Kerüld a száraz, túlzottan táblázatszerű megfogalmazást.`;

const FORMAT_INSTRUCTIONS = `Készíts magyar nyelvű, 12-16 mondatos, szurkolóbarát játékos szezonértékelést.
Kötelező szerkezet:
1) Profil és szerep (2-3 mondat)
2) Hatékonyság és volumen (2-3 mondat)
3) Dobásprofil-olvasat (2-3 mondat): külön kezeld a gyűrű/festék/középtáv/sarok tripla/egyéb tripla mintázatot
4) Kockázatok és limitációk (2-3 mondat)
5) Edzői fókuszpontok a következő időszakra (2-3 mondat)

Szabályok:
- Ne számolj új mutatót, ne becsülj.
- Használj magyar kosárlabda-szaknyelvet, de közérthetően.
- Adj ok-okozati mondatokat ("mert", "emiatt", "ezért").
- A dobásprofil következtetés legyen konkrét, ne sablon.
- A hangnem legyen tárgyilagosan biztató, ne rideg.
- A zárásban legyen egy rövid, előremutató összegzés.`;

type GeneratePlayerSeasonPayload = {
  seasonId: string;
  teamId?: string | null;
  teamName?: string | null;
  playerId: string;
  playerName: string;
  generatedBy?: string | null;
  analysis: unknown;
  shotProfile?: unknown;
  recentGames?: unknown;
};

const buildUserPrompt = (payload: GeneratePlayerSeasonPayload) => {
  const context = {
    seasonId: payload.seasonId,
    teamId: payload.teamId ?? null,
    teamName: payload.teamName ?? null,
    playerId: payload.playerId,
    playerName: payload.playerName,
    analysis: payload.analysis,
    shotProfile: payload.shotProfile ?? null,
    recentGames: payload.recentGames ?? null,
  };

  return `${FORMAT_INSTRUCTIONS}\n\n### ADATOK JSON FORMÁBAN\n${JSON.stringify(context, null, 2)}`;
};

const callOpenAi = async (prompt: string) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MAX_RESPONSE_MS);
  try {
    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openAiApiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.3,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload.error?.message ?? 'Az OpenAI hívás sikertelen.');
    }

    const json = await response.json();
    const narrative: string | undefined = json.choices?.[0]?.message?.content?.trim();
    if (!narrative) {
      throw new Error('Az OpenAI válasza nem tartalmazott szöveget.');
    }

    return narrative;
  } finally {
    clearTimeout(timeout);
  }
};

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as GeneratePlayerSeasonPayload | null;

  if (!payload) {
    return NextResponse.json({ ok: false, error: 'Hiányzik a kérés törzse.' }, { status: 400 });
  }

  if (!payload.seasonId || !payload.playerId || !payload.playerName || !payload.analysis) {
    return NextResponse.json(
      { ok: false, error: 'Hiányzik a seasonId, playerId, playerName vagy analysis mező.' },
      { status: 400 }
    );
  }

  try {
    const prompt = buildUserPrompt(payload);
    const narrative = await callOpenAi(prompt);
    const generatedAt = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('player_text_reports')
      .upsert(
        {
          season_id: payload.seasonId,
          team_id: payload.teamId ?? null,
          player_id: payload.playerId,
          report_type: 'season',
          narrative,
          analysis_snapshot: {
            analysis: payload.analysis,
            shotProfile: payload.shotProfile ?? null,
            recentGames: payload.recentGames ?? null,
          },
          generated_by: payload.generatedBy ?? 'gpt-automata',
          generated_at: generatedAt,
        },
        { onConflict: 'season_id,team_id,player_id,report_type' }
      )
      .select('id, narrative, generated_at, generated_by')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, narrative, report: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ismeretlen hiba történt.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
