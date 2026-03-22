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

const SYSTEM_PROMPT = `Te egy magyar kosárlabda-szakértő elemző vagy.
Feladatod: szurkolóbarát, olvasmányos, mégis szakmailag pontos mérkőzésértékelést írni a kapott pre-game és post-game riport alapján.
Kritikus szabályok:
- Csak a megadott adatokból dolgozhatsz.
- Nem számolhatsz új statisztikát és nem találhatsz ki új tényt.
- Tartsd a kért szerkezetet, de a megfogalmazás legyen természetes, narratív.
- Magyar szaknyelvet használj, angol zsargont kerüld.`;

type GeneratePayload = {
  gameId: string;
  opponentName?: string;
  reportType?: 'pregame' | 'postgame' | 'combined';
  pregameReport: ScoutingReport;
  postgameReport: PostGameReport;
  generatedBy?: string | null;
};

const resolveOwnTeamId = (payload: GeneratePayload) =>
  payload.postgameReport.teamId ?? payload.pregameReport.ownTeamId ?? null;

const resolveOwnTeamName = (payload: GeneratePayload) =>
  payload.postgameReport.teamName ?? payload.pregameReport.ownTeamName ?? 'Saját csapat';

const resolveOpponentTeamId = (payload: GeneratePayload) =>
  payload.pregameReport.opponentTeamId ?? null;

const resolveOpponentTeamName = (payload: GeneratePayload) =>
  payload.opponentName ?? payload.pregameReport.opponentTeamName ?? payload.postgameReport.opponentName ?? null;

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
  injuryContext: report.injuryContext,
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

const formatInstructions = `Feladatod egy szurkolóbarát, jól olvasható szöveges mérkőzés-elemzés készítése a pre-game és post-game riportok alapján.

Kritikus szabályok:
- Ne számolj új statisztikát és ne becsülj új esélyeket.
- Ne vond kétségbe az algoritmus döntéseit.
- Ne adj hozzá új adatot, csak értelmezd a meglévőt.
- Ha bizonytalanság szerepel a pre-game elemzésben, azt kontextusként kezeld, nem hibaként.
- Az X-faktor kontextust csak egyszer említsd meg, ne duplikáld sem a pre-, sem a post-game blokkból.
- Narratív, leíró, olvasmányos hangnemben fogalmazz; minden blokk legyen legalább 2 összefüggő mondat.
- A post-game értékelés során mindig köss össze adatot és következményt ("mert" szerkezet vagy ok-okozati fordulat).
- Adj konkrét edzői javaslatot arra, hogyan használható fel a tapasztalat a következő meccsen / visszavágón.

Terminológiai egység:
- Kizárólag magyar kosárlabda-szaknyelvet használj.
- Kerüld az angol vagy amerikanizált kifejezéseket (pl. pace, matchup, run, transition, spacing).
- Használd helyettük a bevett magyar szakmai fogalmakat (játéktempó, átmeneti játék, egy az egy elleni párosítás, pontsorozat, területnyitás, besegítés, visszarendeződés, labdanyomás, kizárás a dobásnál).

Kötelező szerkezet (alcímeket is írd ki):
1️⃣ Kiindulási kép – Pre-game kontextus (3–4 mondat)
2️⃣ A mérkőzés tényleges képe – Post-game valóság (legalább 3 mondat, mindig adj konkrét példát a statisztikai eltérésre)
3️⃣ Pre-game várakozás vs. realizáció – kezdj egy félkövér alcímmel (**3️⃣ Pre-game várakozás vs. realizáció**), majd minden kulcspontot két sorban írj le: az első sor legyen pl. "✓ **Teljesült**: fókusz", a második sor "  → rövid magyarázat". Használd a ✓ / ↺ / ✗ jelöléseket.
4️⃣ Mi döntötte el valójában a mérkőzést? – Nevezd meg, hogy hatékonyság-, volumen- vagy kontroll-alapú faktor volt, és térj ki arra is, hogy a kulcsra kijelölt X-faktor miért nem (vagy hogyan) lett tényleges döntő tényező. Zárd le a bekezdést egy stratégiai javaslattal a következő találkozóra.
4️⃣/b RiskFlags – ha a pre-game riport tartalmazott risk flag-eket, itt kezeld önálló bekezdésben, rendezetten felsorolva a bekövetkezett vs. elmaradt kockázatokat.
5️⃣ Tanulság és alkalmazhatóság – 2–3 mondatban fogalmazd meg, hogyan hasznosítható mindez a következő meccseken/edzéseken (tempó, rotáció, védekező elvek, speciális játékhelyzetek).

Plusz elvárások:
- Adj rövid indoklást arra, hogy melyik előzetes fókuszpont miért NEM vált döntővé (ha releváns).
- Emeld ki, ha valamely kockázati jelző nem materializálódott, és miért.
- A záró tanulság mindig mutasson előre (edzésfókusz, rotáció, taktikai döntés), pozitív és érthető stílusban.
- Használj kötőszavakat, amelyek segítik a logikus átmenetet ("emiatt", "ezért", "mivel").

Stíluselvárás:
- A szöveg legyen olyan, amit egy szurkoló is szívesen végigolvas.
- Kerüld a túl tömör, táblázatszagú mondatokat.
- Rövidebb bekezdésekben, tiszta logikával írd le az összefüggéseket.

Terjedelem: 14–20 mondat. Alkoss összefüggő, UI-ba illeszthető szöveget.`;

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

    return NextResponse.json({ ok: true, narrative, report: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ismeretlen hiba történt.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
