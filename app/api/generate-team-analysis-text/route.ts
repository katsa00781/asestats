import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const openAiApiKey = process.env.OPENAI_API_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_URL = process.env.OPENAI_API_URL ?? 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';
const MAX_RESPONSE_MS = 50_000;

if (!supabaseUrl) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL hiányzik a környezeti változók közül.');
}
if (!serviceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY hiányzik a környezeti változók közül.');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

const SYSTEM_PROMPT = `Te egy magyar kosárlabda-elemző vagy.
Feladat: adatalapú, taktikai fókuszú csapatértékelést írni, különösen a gyenge pontokra és azok matchup-következményeire.
Szabályok:
- Kizárólag a kapott adatokból dolgozz.
- Ne találj ki új számot, ne adj hamis ok-okozatot.
- Legyen konkrét, gyakorlati és edzői szemléletű.
- Használj magyar kosárlabda-szakszavakat természetes kontextusban (ne angol zsargon domináljon).`;

const FORMAT_INSTRUCTIONS = `Készíts magyar nyelvű, 9-12 mondatos elemzést.
Kötelező szerkezet:
1) Rövid csapatkép (1-2 mondat)
2) Fő gyenge pontok (3-4 mondat): konkrét név + mutató + taktikai következmény
3) Matchup-exploit szcenáriók (2-3 mondat): mit fog próbálni az ellenfél
4) Edzői ellenlépések (2-3 mondat): rövid, végrehajtható fókuszpontok

Stílus:
- Mondj ki ok-okozatot ("emiatt", "ezért", "így").
- Kerüld a sablon frázisokat.
- Ha kevés adat van, ezt jelezd röviden.`;

const TERMINOLOGY_REQUIREMENTS = `
Terminológiai elvárás:
- A szövegben jelenjen meg legalább 6-8 releváns magyar szakszó a következőkből (értelemszerűen):
  félpályás támadás, tranzíció, spacing, periméter, festék, gyűrűvédekezés, besegítés, visszazárás,
  labdás elzárás, leválás, mismatch, closeout, rotáció, lepattanózás, labdabiztonság, dobóvolumen,
  dobáskiválasztás, támadókapcsolódás, gyenge oldal, erős oldal.
- Kerüld az üres, túl általános megfogalmazást (pl. "jobbnak kell lenni", "nagyobb fókusz kell") önmagában.
- Ha nevet és gyenge pontot említesz, köss hozzá konkrét taktikai következményt és ellenlépést.
`;

type TeamNarrativePayload = {
  seasonId: string;
  teamId: string;
  teamName: string;
  stylePreset?: 'fan' | 'coach' | 'scouting';
  generatedBy?: string | null;
  teamAnalysis: unknown;
  shotProfile?: unknown;
  tacticalWeaknesses?: unknown;
};

const resolveStylePreset = (value: TeamNarrativePayload['stylePreset']) => {
  if (value === 'coach' || value === 'scouting') return value;
  return 'fan' as const;
};

const resolveReportType = (stylePreset: 'fan' | 'coach' | 'scouting') => {
  if (stylePreset === 'coach') return 'season_coach';
  if (stylePreset === 'scouting') return 'season_scouting';
  return 'season_fan';
};

const resolveStyleInstruction = (stylePreset: 'fan' | 'coach' | 'scouting') => {
  if (stylePreset === 'coach') {
    return 'Hangvétel: edzői. Rövid, direkt, végrehajtás-orientált utasításokkal.';
  }
  if (stylePreset === 'scouting') {
    return 'Hangvétel: scouting riport. Tömör, tárgyilagos, strukturált kockázat- és matchup-olvasattal.';
  }
  return 'Hangvétel: szurkolóbarát, közérthető, de továbbra is szakmailag pontos.';
};

const buildUserPrompt = (payload: TeamNarrativePayload) => {
  const stylePreset = resolveStylePreset(payload.stylePreset);
  const context = {
    seasonId: payload.seasonId,
    teamId: payload.teamId,
    teamName: payload.teamName,
    stylePreset,
    teamAnalysis: payload.teamAnalysis,
    shotProfile: payload.shotProfile ?? null,
    tacticalWeaknesses: payload.tacticalWeaknesses ?? null,
  };

  return `${FORMAT_INSTRUCTIONS}\n\n${resolveStyleInstruction(stylePreset)}\n\n${TERMINOLOGY_REQUIREMENTS}\n\n### ADATOK JSON FORMÁBAN\n${JSON.stringify(context, null, 2)}`;
};

const callOpenAi = async (prompt: string) => {
  if (!openAiApiKey) {
    throw new Error('OPENAI_API_KEY hiányzik a környezeti változók közül.');
  }

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
  const payload = (await request.json().catch(() => null)) as TeamNarrativePayload | null;

  if (!payload) {
    return NextResponse.json({ ok: false, error: 'Hiányzik a kérés törzse.' }, { status: 400 });
  }

  if (!payload.seasonId || !payload.teamId || !payload.teamName || !payload.teamAnalysis) {
    return NextResponse.json(
      { ok: false, error: 'Hiányzik a seasonId, teamId, teamName vagy teamAnalysis mező.' },
      { status: 400 }
    );
  }

  try {
    const prompt = buildUserPrompt(payload);
    const narrative = await callOpenAi(prompt);
    const generatedAt = new Date().toISOString();
    const stylePreset = resolveStylePreset(payload.stylePreset);
    const reportType = resolveReportType(stylePreset);

    const { data: report, error } = await supabaseAdmin
      .from('team_text_reports')
      .upsert(
        {
          season_id: payload.seasonId,
          team_id: payload.teamId,
          report_type: reportType,
          narrative,
          analysis_snapshot: {
            teamAnalysis: payload.teamAnalysis,
            shotProfile: payload.shotProfile ?? null,
            tacticalWeaknesses: payload.tacticalWeaknesses ?? null,
            stylePreset,
          },
          generated_by: payload.generatedBy ?? 'gpt-automata',
          generated_at: generatedAt,
        },
        { onConflict: 'season_id,team_id,report_type' }
      )
      .select('id, season_id, team_id, report_type, narrative, generated_by, generated_at')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      ok: true,
      narrative,
      generatedAt,
      generatedBy: payload.generatedBy ?? 'gpt-automata',
      report,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ismeretlen hiba történt.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
