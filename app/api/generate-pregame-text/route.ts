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

const SYSTEM_PROMPT = `Te a klub elemzője vagy, aki szurkolóbarát, közérthető, mégis szakmai pre-game értékelést ír.
Kötelező szabályok:
- Kizárólag a kapott, algoritmus által számolt adatokból dolgozhatsz.
- Nem találhatsz ki új mutatót, százalékot, előnyt vagy kockázatot.
- Ha nincs konkrét küszöb, esemény vagy játékos-szintű trigger a strukturált inputban, akkor ne írj ilyet a szövegbe.
- Az x-faktor százalékokat swing-potenciálként kezeld, ne garantált hatásként.
- A dobástérkép vagy shot-profile megállapításokat csak zónaszintű megfogalmazásban használd, ne találj ki nem adott védekezési engedési adatot.
- Magyar kosárlabda-szaknyelvet használj, angol zsargont kerüld.
- A szöveg legyen leíró, olvasmányos, logikusan felépített.
- Folyamatos, értelmes magyar mondatokban írj, ne kulcsszó-listákkal.
- Ha új mezők vannak (scenarioOutcomes, xFactorImpact, riskScenarios, calibrationDiagnostics, advancedPlayers), azokat természetes nyelven építsd be.`;

const USER_PROMPT_TEMPLATE = `KONTEXTUS:
- Elemzés nézőpontja: [CSAPAT_NEVE] (esélyük: X%)
- Ellenfél: [ELLENFÉL_NEVE] (esélyük: Y%)
- KRITIKUS: Használd a csapatneveket, NE "favorit/ellenfél" kifejezéseket

KÖTELEZŐ INPUT-ELLENŐRZÉS:
1. Van-e saját csapat stílus-leírása? (Ha nincs → jelezd hiányként)
2. Van-e poszt-összehasonlítás magyarázat? (Miért X% esély, ha Y poszt-előny van?)
3. Kulcsjátékosok nevesítve vannak-e?

SZERKEZET:
1. Mérkőzés alapkép
  - "[CSAPAT] X% eséllyel indul, [ELLENFÉL] Y%-kal"
  - Variancia-forrás nevesítése (tripla%, fault-arány, konkrét párosítás)

2. Stílusütközés
   - [CSAPAT] játékstílusa: [ADAT: tempó, támadási fókusz, védekezési típus]
   - [ELLENFÉL] játékstílusa: [ADAT]
   - Várható tempó és dinamika

3. Kritikus matchupok
  - Poszt-összehasonlítás legnagyobb eltérései (±10 VAL felett)
   - Konkrét játékosnevek: pl. "[JÁTÉKOS] +23.1 VAL az irányítóposzton"
   - Magyarázd meg, miért nem döntő önmagában egy matchup

4. Taktikai válaszok
   - [CSAPAT] válasza [ELLENFÉL] fő veszélyeire (fókuszpontok alapján)
   - Küszöbértékek ahol rendelkezésre állnak (pl. "<25 tripla-kísérlet")

5. X-faktorok operacionalizálása
  - Elsődleges: csak a strukturált inputból származó matchup-tengely és swing-potenciál
  - Másodlagos: feltételes forgatókönyv, új szám vagy trigger kitalálása nélkül

6. Forgatókönyvek
  - IF [feltétel alapján strukturált adatokból] THEN [következmény]
  - Csak a meglévő scenarioOutcomes / riskScenarios logikáját írd át természetes nyelvre, ne találj ki új százalékos trigger-mondatot

7. Kalibrációs diagnosztika (kötelező, ha van calibrationDiagnostics)
  - Nevesíts legalább 2 magasabb intenzitású dimenziót (pl. periméter nyomás, tempó-eltérés).
  - Magyarázd el 1-2 mondatban, ez taktikai értelemben mit jelent.

8. Haladó játékosmutatók (kötelező, ha van advancedPlayers)
  - Nevesíts 1-1 saját és ellenfél játékost PER*/WS* alapon.
  - Röviden jelezd, hogy perc-küszöb szűrés után kerültek be (marginális percek kizárva).

9. Dobástérkép / shot-profile (kötelező, ha van shotProfileContext)
  - Nevezd meg a legfontosabb saját és ellenfél zónát.
  - Csak a megadott zónákat és liga-deltákat használd.
  - Ne írj olyan védekezési következtetést, amire nincs explicit adat.

STÍLUS ELVÁRÁS:
- Írj 12-16 mondatot, rövid bekezdésekben.
- Legyen olvasmányos, szurkolóbarát, de ne bulváros.
- Adj rövid, közérthető magyarázatot arra, miért fontos egy-egy statisztikai jel.
- Mondatszintű, összefüggő elemzést adj: legyen bevezetés, közép és lezárás.
- Használj magyar szaknyelvet: tempó, labdanyomás, visszarendeződés, festékvédekezés, faultterhelés, lepattanóharc.
- Kerüld a gépies felsorolást és a sablonos ismétlést.

TILOS:
- Általános kijelentések játékstílus nélkül ("gyors csapat" – miből derül ki?)
- Névtelen X-faktorok ("a periméterjátékos" – ki?)
- Ellentmondás a strukturált adatokkal (ellenőrizd irányító-matchup előjelét!)
- Olyan következtetés, ami nincs alátámasztva a strukturált mezőkben.
- Nyers JSON-részletek visszamásolása a válaszba.

STRUKTURÁLT ADATOK (változtatás nélkül dolgozz velük):
{{PRE_GAME_ANALYSIS_OBJECT}}`;

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
