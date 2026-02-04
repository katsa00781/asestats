import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import type { ScoutingReport } from '@/lib/pregame-scouting';

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

const MAX_RESPONSE_MS = 45_000;
const OPENAI_URL = process.env.OPENAI_API_URL ?? 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';

const SYSTEM_PROMPT = `Te a klub szakmai stábjának mesterséges intelligencia elemzője vagy.
- KIZÁRÓLAG a megadott, algoritmus által számolt adatokat használhatod.
- Tilos új mutatót, százalékot, előnyt vagy kockázatot kitalálni.
- Magyar kosárlabda-szaknyelvet kell használnod, angol zsargont (run, transition, pace stb.) nem írhatsz.`;

const USER_PROMPT_TEMPLATE = `Az alábbi adatok egy kosárlabda mérkőzés pre-game elemzéséből származnak.
Az adatok egy algoritmus által számított, validált kimenetek.

⚠️ KRITIKUS SZABÁLY – HALLUCINÁCIÓ TILTÁSA:
- KIZÁRÓLAG a megadott, számított értékeket és megállapításokat használhatod.
- Nem számolhatsz, nem becsülhetsz és nem vezethetsz le új statisztikát.
- Nem nevezhetsz meg olyan előnyt, kockázatot vagy tendenciát, amely nem szerepel az adatokban.
- Nem használhatsz „általában”, „jellemzően”, „várhatóan” típusú általánosítást.
- Ha egy tényező bizonytalan vagy alacsony bizonyosságú, azt kizárólag kontextusként, nem értékítéletként kezeld.

Feladatod:
- készíts szakmailag pontos, szöveges mérkőzés előtti értékelést
- értelmezd a MEGLÉVŐ statisztikai esélyeket és poszt-összehasonlításokat
- emeld ki az ellenfél játékából fakadó, ADATOKKAL ALÁTÁMASZTOTT fő kockázatokat
- nevezd meg a mérkőzés döntő tényezőjét (X-faktor), kizárólag az elemzés alapján
- ne ismételd szó szerint a felsorolásokat, hanem szintetizáld őket
- fogalmazz leíró, narratív stílusban, kerülve a felsorolás-szerű monotonitást
- adj konkrét, adat-alapú mérkőzésstratégiát az ellenfél ellen (pl. tempó, párosítás, fókuszpontok)

⚠️ SZAKNYELVI KÖTELEZETTSÉG:
- Magyar kosárlabda-szaknyelvet használj.
- Kerüld az angol vagy amerikanizált kifejezéseket.
- Használd a bevett magyar szakmai fogalmakat.

Strukturált adatok:
{{PRE_GAME_ANALYSIS_OBJECT}}

Elvárt kimenet:
- 6–10 mondatos összefoglaló
- tagolt, logikusan felépített szöveg az alábbi logikai blokkokkal (sorszámot nem kell írni, de a témákat külön mondatcsoportokban fejtsd ki):
  • Kontextus (tempó, tengely, statisztikai esély)
  • Fenyegetések és sebezhetőségek (adatokra hivatkozva)
  • Pozíciós dinamika és kulcspárosítások
  • Stratégiai javaslat az ellenfél ellen, a fókuszpontok/X-faktor alapján
- magyar szaknyelv használata
- edzői döntéshozatalt támogató hangsúlyok, egyértelmű ajánlások`;

type PregameTextPayload = {
  gameId?: string | null;
  pregameReport: ScoutingReport;
  ownTeamName?: string | null;
  opponentTeamName?: string | null;
  ownTeamId?: string | null;
  opponentTeamId?: string | null;
  generatedBy?: string | null;
};

const normalizeUuid = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const resolveOwnTeamId = (payload: PregameTextPayload) =>
  payload.ownTeamId ?? payload.pregameReport.ownTeamId ?? null;

const resolveOwnTeamName = (payload: PregameTextPayload) =>
  payload.ownTeamName ?? payload.pregameReport.ownTeamName ?? 'Saját csapat';

const resolveOpponentTeamId = (payload: PregameTextPayload) =>
  payload.opponentTeamId ?? payload.pregameReport.opponentTeamId ?? null;

const resolveOpponentTeamName = (payload: PregameTextPayload) =>
  payload.opponentTeamName ?? payload.pregameReport.opponentTeamName;

const buildUserPrompt = (payload: PregameTextPayload) => {
  const contextBlock = {
    ownTeamName: resolveOwnTeamName(payload),
    opponentTeamName: resolveOpponentTeamName(payload),
    report: payload.pregameReport,
  };
  return USER_PROMPT_TEMPLATE.replace(
    '{{PRE_GAME_ANALYSIS_OBJECT}}',
    JSON.stringify(contextBlock, null, 2)
  );
};

const hashToUuid = (hash: string) =>
  [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32),
  ].join('-');

const buildTeamPairKey = (
  payload: PregameTextPayload,
  ownTeamId: string | null,
  opponentTeamId: string | null
) => {
  if (!ownTeamId || !opponentTeamId) return null;
  const season = payload.pregameReport?.season;
  const league = payload.pregameReport?.league;
  if (!season || !league) return null;
  const raw = `pregame:${league}:${season}:${ownTeamId}:${opponentTeamId}`;
  const hash = createHash('sha1').update(raw).digest('hex');
  return hashToUuid(hash);
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
  const payload = (await request.json().catch(() => null)) as PregameTextPayload | null;
  if (!payload) {
    return NextResponse.json({ ok: false, error: 'Hiányzik a kérés törzse.' }, { status: 400 });
  }
  if (!payload.pregameReport) {
    return NextResponse.json({ ok: false, error: 'Hiányzik a pre-game riport.' }, { status: 400 });
  }

  try {
    const prompt = buildUserPrompt(payload);
    const narrative = await callOpenAi(prompt);
    let savedReport = null;
    const gameId = normalizeUuid(payload.gameId);
    const ownTeamId = normalizeUuid(resolveOwnTeamId(payload));
    const ownTeamName = resolveOwnTeamName(payload);
    const opponentTeamId = normalizeUuid(resolveOpponentTeamId(payload));
    const opponentTeamName = resolveOpponentTeamName(payload);
    const teamPairKey = gameId ? null : buildTeamPairKey(payload, ownTeamId, opponentTeamId);
    const generatedAt = new Date().toISOString();
    let saveStatus: { saved: boolean; message: string };

    if (gameId) {
      const { data, error } = await supabaseAdmin
        .from('game_text_reports')
        .upsert(
          {
            game_id: gameId,
            team_pair_key: null,
            report_type: 'pregame',
            narrative,
            pregame_snapshot: payload.pregameReport,
            postgame_snapshot: null,
            generated_by: payload.generatedBy ?? 'gpt-automata',
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
      savedReport = data;
      saveStatus = {
        saved: true,
        message: 'Pre-game jelentés elmentve a game_text_reports táblába.',
      };
    } else {
      if (teamPairKey) {
        const { data, error } = await supabaseAdmin
          .from('game_text_reports')
          .upsert(
            {
              game_id: null,
              team_pair_key: teamPairKey,
              report_type: 'pregame',
              narrative,
              pregame_snapshot: payload.pregameReport,
              postgame_snapshot: null,
              generated_by: payload.generatedBy ?? 'gpt-automata',
              generated_at: generatedAt,
              own_team_id: ownTeamId,
              own_team_name: ownTeamName,
              opponent_team_id: opponentTeamId,
              opponent_team_name: opponentTeamName,
            },
            { onConflict: 'team_pair_key,report_type' }
          )
          .select()
          .single();

        if (error) {
          throw new Error(error.message);
        }
        savedReport = data;
        saveStatus = {
          saved: true,
          message: 'Pre-game jelentés elmentve (ellenfél alapú azonosítás).',
        };
      } else {
        saveStatus = {
          saved: false,
          message: 'Nem történt mentés, mert nincs meccs ID és hiányzik a csapatpár.',
        };
      }
    }

    return NextResponse.json({ ok: true, narrative, report: savedReport, saveStatus });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ismeretlen hiba történt.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
