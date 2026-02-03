import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { ScoutingReport } from '@/lib/pregame-scouting';
import type { PostGameReport } from '@/lib/postgame-report';

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

const SYSTEM_PROMPT = `Te egy magyar kosárlabda-szakértő elemző vagy. Feladatod, hogy az edzői stáb számára készíts taktikai összefoglalót a megadott pre-game és post-game algoritmikus riportok alapján. Mindig tartsd a kért struktúrát, csak a megadott adatokból dolgozz, ne vezesd le újra a statisztikákat, és ne vezess be új fogalmakat. Kerüld az angol zsargont: a "run" vagy "transition" helyett mindig használj magyar megfelelőket (pl. "átmeneti játék", "rendezetlen visszarendeződés").`;

type GeneratePayload = {
  gameId: string;
  opponentName?: string;
  reportType?: 'pregame' | 'postgame' | 'combined';
  pregameReport: ScoutingReport;
  postgameReport: PostGameReport;
  generatedBy?: string | null;
};

const extractPregameContext = (report: ScoutingReport) => ({
  summary: report.summary,
  winProbability: report.winProbability,
  profile: report.profile,
  threats: report.threats,
  vulnerabilities: report.vulnerabilities,
  keyPlayers: report.keyPlayers,
  focusPoints: report.focusPoints,
  xFactorContext: report.xFactorContext,
  riskFlags: report.riskFlags ?? [],
});

const extractPostgameContext = (report: PostGameReport) => ({
  summary: report.summary,
  result: report.result,
  context: report.context,
  decisiveFactors: report.decisiveFactors,
  decisiveFactorMeta: report.decisiveFactorMeta,
  strengths: report.strengths,
  problems: report.problems,
  nextFocus: report.nextFocus,
  reflection: report.reflection,
  playerImpact: report.playerImpact,
});

const formatInstructions = `Feladatod egy SZÖVEGES MÉRKŐZÉS-ELEMZÉS generálása a meglévő pre-game és post-game algoritmusok összefoglalói alapján.

Kritikus szabályok:
- Ne számolj új statisztikát és ne becsülj új esélyeket.
- Ne vond kétségbe az algoritmus döntéseit.
- Ne adj hozzá új adatot, csak értelmezd a meglévőt.
- Ha bizonytalanság szerepel a pre-game elemzésben, azt kontextusként kezeld, nem hibaként.
- Az X-faktor kontextust csak egyszer említsd meg, ne duplikáld sem a pre-, sem a post-game blokkból.

Terminológiai egység:
- Kizárólag magyar kosárlabda-szaknyelvet használj.
- Kerüld az angol vagy amerikanizált kifejezéseket (pl. pace, matchup, run, transition, spacing).
- Használd helyettük a bevett magyar szakmai fogalmakat (játéktempó, átmeneti játék, egy az egy elleni párosítás, pontsorozat, területnyitás, besegítés, visszarendeződés, labdanyomás, kizárás a dobásnál).

Kötelező szerkezet (alcímeket is írd ki):
1️⃣ Kiindulási kép – Pre-game kontextus (3–4 mondat)
2️⃣ A mérkőzés tényleges képe – Post-game valóság
3️⃣ Pre-game várakozás vs. realizáció (minden kulcspontot ✓ / ↺ / ✗ jelöléssel minősíts)
4️⃣ Mi döntötte el valójában a mérkőzést? – Nevezd meg, hogy hatékonyság-, volumen- vagy kontroll-alapú faktor volt, és térj ki arra is, hogy a kulcsra kijelölt X-faktor miért nem (vagy hogyan) lett tényleges döntő tényező.
4️⃣/b RiskFlags – ha a pre-game riport tartalmazott risk flag-eket, itt kezeld önálló bekezdésben, rendezetten felsorolva a bekövetkezett vs. elmaradt kockázatokat.
5️⃣ Tanulság és alkalmazhatóság – 1–2 mondatban fogalmazd meg, hogyan hasznosítható mindez a következő meccseken/edzéseken.

Plusz elvárások:
- Adj rövid indoklást arra, hogy melyik előzetes fókuszpont miért NEM vált döntővé (ha releváns).
- Emeld ki, ha valamely kockázati jelző nem materializálódott, és miért.
- A záró tanulság mindig mutasson előre (edzésfókusz, rotáció, taktikai döntés).

Terjedelem: kb. 12–18 mondat. Alkoss összefüggő, UI-ba illeszthető szöveget.`;

const buildUserPrompt = (payload: GeneratePayload) => {
  const pregame = extractPregameContext(payload.pregameReport);
  const postgame = extractPostgameContext(payload.postgameReport);
  const contextBlock = {
    gameId: payload.gameId,
    opponentName: payload.opponentName ?? payload.pregameReport.opponentTeamName,
    pregame,
    postgame,
  };

  return `${formatInstructions}\n\n### KONKRÉT ADATOK JSON FORMÁBAN\n${JSON.stringify(contextBlock, null, 2)}`;
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
        temperature: 0.35,
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
  const payload = (await request.json().catch(() => null)) as GeneratePayload | null;
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
    const prompt = buildUserPrompt(payload);
    const narrative = await callOpenAi(prompt);
    const reportType = payload.reportType ?? 'combined';

    const { data, error } = await supabaseAdmin
      .from('game_text_reports')
      .upsert(
        {
          game_id: payload.gameId,
          report_type: reportType,
          narrative,
          pregame_snapshot: payload.pregameReport,
          postgame_snapshot: payload.postgameReport,
          generated_by: payload.generatedBy ?? 'gpt-automata',
        },
        { onConflict: 'game_id,report_type' }
      )
      .select()
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
