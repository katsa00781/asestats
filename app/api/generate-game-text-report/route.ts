import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { ScoutingReport } from '@/lib/pregame-scouting';
import type { PostGameReport } from '@/lib/postgame-report';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
- Magyar szaknyelvet használj, angol zsargont kerüld.
- A hangnem legyen támogató és érthető: ne legyen bántó, ne hibáztass név szerint.
- Úgy fogalmazz, mintha meccs után egy szurkolói műsorban magyaráznád az összefüggéseket.
- Legyen emberi tónus, de maradjon adatvezérelt és szakmailag feszes.`;

type GeneratePayload = {
  gameId: string;
  opponentName?: string;
  reportType?: 'pregame' | 'postgame' | 'combined';
  stylePreset?: 'fan' | 'balanced' | 'coach';
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
  // Pre-computed deltas extracted directly from decisiveFactors strings.
  // Use ONLY these values when quoting pp-differences — do NOT recalculate.
  computedDeltas: extractDeltasFromDecisiveFactors(report.decisiveFactors),
  strengths: report.strengths,
  problems: report.problems,
  nextFocus: report.nextFocus,
  reflection: report.reflection,
  playerImpact: report.playerImpact,
  lineupInsights: report.lineupInsights ?? null,
  playerReport: extractPlayerContext(report),
});

const DELTA_PATTERN = /\(([+-]?\d+(?:\.\d+)?)\s*pp\)/;

const extractDeltasFromDecisiveFactors = (
  factors: { offense?: string[]; defense?: string[] } | null | undefined
): Record<string, string> => {
  const result: Record<string, string> = {};
  const all = [...(factors?.offense ?? []), ...(factors?.defense ?? [])];
  for (const factor of all) {
    const match = DELTA_PATTERN.exec(factor);
    if (!match) continue;
    const delta = `${match[1]} pp`;
    if (/3P|tripla|periméter/i.test(factor)) result['threePctDelta'] = delta;
    else if (/assist|labdajárat/i.test(factor)) result['assistRateDelta'] = delta;
    else if (/TO|labdavesztés|turnover/i.test(factor)) result['turnoverRateDelta'] = delta;
    else if (/eFG|hatékonyság/i.test(factor)) result['efgDelta'] = delta;
    else if (/OREB|lepattanó/i.test(factor)) result['orebDelta'] = delta;
  }
  return result;
};

const extractPlayerContext = (report: PostGameReport) => {
  const pr = report.playerReport;
  if (!pr) return null;

  const slim = (p: { name: string; position: string; llmContext: Record<string, unknown> }) => ({
    name: p.name,
    position: p.position,
    ...p.llmContext,
  });

  return {
    mvp: pr.highlights.mvp ? slim(pr.highlights.mvp) : null,
    engines: pr.highlights.engines.map(slim),
    sparkPlugs: pr.highlights.sparkPlugs.map(slim),
    struggling: pr.highlights.struggling.map(slim),
    rotationAndHeavy: pr.players
      .filter(p => p.minutesBucket !== 'micro')
      .map(p => slim(p)),
  };
};

const BASE_INSTRUCTIONS = `Feladatod egy szurkolóbarát, jól olvasható szöveges mérkőzés-elemzés készítése a pre-game és post-game riportok alapján.

Kritikus szabályok:
- Ne számolj új statisztikát és ne becsülj új esélyeket.
- Ne vond kétségbe az algoritmus döntéseit.
- Ne adj hozzá új adatot, csak értelmezd a meglévőt.
- Ha bizonytalanság szerepel a pre-game elemzésben, azt kontextusként kezeld, nem hibaként.
- Az X-faktor kontextust csak egyszer említsd meg, ne duplikáld sem a pre-, sem a post-game blokkból.
- Narratív, leíró, olvasmányos hangnemben fogalmazz; minden blokk legyen legalább 2 összefüggő mondat.
- A post-game értékelés során mindig köss össze adatot és következményt ("mert" szerkezet vagy ok-okozati fordulat).
- Ha a post-game blokk tartalmaz lineupInsights mezőt, kötelező legalább 2 mondatban értelmezni az ötös statokat és azok taktikai/rotációs következményeit.
- A hangvétel legyen szurkolóbarát: közérthető, de ne leegyszerűsítő; kritikát is építő módon fogalmazz meg.
- Minden fő blokkban szerepeljen legalább egy konkrét szám vagy százalékpont-eltérés a kapott adatokból.
- Adj konkrét edzői javaslatot arra, hogyan használható fel a tapasztalat a következő meccsen / visszavágón.
- FONTOS – pontos számok: csak a JSON-ban szereplő pontos értékeket idézd, ne kerekítsd vagy becsüld felül/alul a statisztikákat. A "computedDeltas" mezőben találod az előre kiszámított pp-különbségeket (pl. threePctDelta, assistRateDelta) – ezeket szó szerint használd, ne számolj belőlük újat.
- FONTOS – lineup adatok: csak a lineupInsights-ban ténylegesen szereplő párosokat/ötösöket és azok statjait idézd; ne találj ki olyan összeköttetéseket, amelyek nem szerepelnek az adatban.
- FONTOS – hatékonysági mutatók: a csapatszintű hatékonysági mutatóra az adatban "efgPct" / "eFG%" szerepel (effective field goal %), ez NEM ugyanaz mint a TS% (true shooting). Ne cseréld fel, és ne nevezd TS%-nak az eFG%-ot.
- FONTOS – pregame adatok iránya: a "pregame.threats" mezőben lévő elemek AZ ELLENFÉLTŐL EREDŐ VESZÉLYEKET írják le, amelyek SAJÁT CSAPATUNKAT (ASE-t) fenyegetik. Például ha a threats tartalmaz 3P%-ot az ellenfél védekezéséhez kapcsolva (pl. "periméter-limitálás 25.0% 3P"), az azt jelenti, hogy az ellenfél képes volt limitálni az ASE triplakísérleteit erre a szintre – ez NEM az ASE saját védekezési teljesítménye. A "pregame.vulnerabilities" szintén ASE saját gyengeségeit írja le. Ne fordítsd meg ezek irányát: threats és vulnerabilities sosem ASE védekezési eredmény, hanem ellenfél-erősség vagy saját gyengeség.
- FONTOS – postgame decisiveFactors iránya: a "postgame.decisiveFactors.offense" kizárólag ASE saját offenzív teljesítményét írja le (pl. "Gyenge 3P-hatékonyság" = ASE volt gyenge hármasban, nem az ellenfél). A "postgame.decisiveFactors.defense" az ellenfélre vonatkozó védekezési adatokat tartalmazza, és ott explicit "ellenfél 3P" / "ellenfél eFG" jelzés is szerepel. A 3-as blokk "pre-game várakozás vs. realizáció" összehasonlításánál az xFactor "periméter kontroll" teljesítését KIZÁRÓLAG a defense-ben lévő ellenfél-3P adatból értékelj, NE az offense-ben lévő ASE saját 3P%-ából.

Terminológiai egység:
- Kizárólag magyar kosárlabda-szaknyelvet használj – egyetlen angol kifejezés sem szerepelhet a végső szövegben.
- TILOS kifejezések és kötelező magyarítások (teljes lista, szigorúan betartandó):
  pace → játéktempó | matchup → párosítás / egy az egy elleni párosítás | run → pontsorozat / roham | transition → átmeneti játék | spacing → területnyitás / tér kihasználás | help defense → besegítés / segédvédekezés | closeout → kirobbanás a dobóra | weakside crash → gyengeoldali betörés / gyenge oldali lepattanó-közelítés | drive → kosárra törés / festékbe lépés | kick-out pass → kiengedő passz / kick-out átadás | pick and roll → gát és gurulás | screen → gát / blokk | spot-up → helyzetből dobás / kiszabadult dobás | usage → terhelés / igénybevétel | paint touch → festék-érintés | putback → második esélyes befejezés | stock → szerzett labda (lopás+blokk) | impact → hatás / mérkőzésszintű hatás | engine → motor játékos | MVP → legértékesebb játékos
- Ha egy fogalomra nincs bevett fordítás, körülírd magyarul – ne hagyd angolul.

Kötelező szerkezet (alcímeket is írd ki):
1️⃣ Kiindulási kép – Pre-game kontextus (3–4 mondat)
2️⃣ A mérkőzés tényleges képe – Post-game valóság (legalább 3 mondat, mindig adj konkrét példát a statisztikai eltérésre)
3️⃣ Pre-game várakozás vs. realizáció – kezdj egy félkövér alcímmel (**3️⃣ Pre-game várakozás vs. realizáció**), majd minden kulcspontot két sorban írj le: az első sor legyen pl. "✓ **Teljesült**: fókusz", a második sor "  → rövid magyarázat". Használd a ✓ / ↺ / ✗ jelöléseket.
4️⃣ Mi döntötte el valójában a mérkőzést? – Nevezd meg, hogy hatékonyság-, volumen- vagy kontroll-alapú faktor volt, és térj ki arra is, hogy a kulcsra kijelölt X-faktor miért nem (vagy hogyan) lett tényleges döntő tényező. Zárd le a bekezdést egy stratégiai javaslattal a következő találkozóra.
4️⃣/b RiskFlags – ha a pre-game riport tartalmazott risk flag-eket, itt kezeld önálló bekezdésben, rendezetten felsorolva a bekövetkezett vs. elmaradt kockázatokat.
5️⃣ Játékos-kiemelések – a rotation és heavy percesek kötelezők (legalább 2–3 játékos részletes értékelése):
   - Az MVP-t és az engine játékosokat pozitívan emeld ki, mindig adj konkrét statisztikát (VAL, TS%, pont).
   - A sparkplug játékosoknál mutasd meg az arányos hatást: "rövid perc, de érzékelhető lendület".
   - A küzdő (struggling) játékosoknál fogalmazz építő kritikát, mindig zárj megoldási iránnyal.
   - Ne gépies felsorolás legyen, hanem olvaszd a játékosokat a narratívába.
   - A TS% és a VAL/36 a legfontosabb mutatók; ha messze eltér a szezonátlagtól, feltétlenül tüntesd fel.
6️⃣ Tanulság és alkalmazhatóság – 2–3 mondatban fogalmazd meg, hogyan hasznosítható mindez a következő meccseken/edzéseken (tempó, rotáció, védekező elvek, speciális játékhelyzetek).

Plusz elvárások:
- Adj rövid indoklást arra, hogy melyik előzetes fókuszpont miért NEM vált döntővé (ha releváns).
- Emeld ki, ha valamely kockázati jelző nem materializálódott, és miért.
- Lineup adatoknál írd le: melyik ötös/páros hozott vagy veszített előnyt, és ez milyen konkrét rotációs döntést indokol.
- Lineup adatoknál ne abszolút ítéletet írj, hanem valószínűsíthető mintázatot és alkalmazható következő lépést.
- Játékos-adatoknál (playerReport): az mvp és az engines játékosokat feltétlenül emeld ki névvel és konkrét statisztikával. A struggling játékosokat konstruktívan kezeld. Ha nincs mvp/engine adat, a rotationAndHeavy lista alapján írj minden rotation/heavy percest.
- A záró tanulság mindig mutasson előre (edzésfókusz, rotáció, taktikai döntés), pozitív és érthető stílusban.
- Használj kötőszavakat, amelyek segítik a logikus átmenetet ("emiatt", "ezért", "mivel").
- Célzott számtartalom: a teljes szövegben 6–12 konkrét szám szerepeljen; ne legyen se száraz, se túl általános.

Stíluselvárás:
- A szöveg legyen olyan, amit egy szurkoló is szívesen végigolvas.
- Kerüld a túl tömör, táblázatszagú mondatokat.
- Rövidebb bekezdésekben, tiszta logikával írd le az összefüggéseket.
- Alkalmazz világos történetívet: mi történt a pályán -> miért történt -> mit érdemes ebből továbbvinni.
- Váltogasd a mondathosszt (rövid + közepes), hogy ne legyen monoton a szöveg.
- Blokkonként 1-2 kulcsszámot emelj ki, és mindig tedd mellé a szakmai következményt.
- Amikor kritikát fogalmazol, megoldási iránnyal zárd a gondolatot.

Terjedelem: 20–30 mondat. Alkoss összefüggő, UI-ba illeszthető szöveget. A játékos-kiemelések szekció legalább 4–6 mondatot igényel.`;

const getStyleInstructions = (style: 'fan' | 'balanced' | 'coach') => {
  if (style === 'fan') {
    return `
Stílusprofil: SZURKOLÓBARÁT
- Közérthető, lendületes nyelv, erős átvezetésekkel.
- Minden bekezdésben legyen legalább 1 konkrét adat, de a hangsúly a magyarázaton legyen.
- Kerüld a túl technikai felsorolásokat, inkább meséld el, hogyan hatott a pályán.`;
  }
  if (style === 'coach') {
    return `
Stílusprofil: EDZŐI
- Tömörebb, szakmaibb és döntéstámogató nyelv.
- Minden fő blokkban kötelező legalább 2 konkrét adat vagy delta.
- A javaslatok legyenek végrehajthatóak (rotáció, matchup, tempókontroll, lepattanófeladatok).`;
  }
  return `
Stílusprofil: KIEGYENSÚLYOZOTT
- Adatvezérelt, de olvasmányos hangnem.
- Blokkonként 1-2 kulcsszám + egyértelmű következmény.
- A szöveg legyen szakmailag feszes, mégis szurkoló számára követhető.`;
};

const resolveTemperature = (style: 'fan' | 'balanced' | 'coach') => {
  if (style === 'fan') return 0.4;
  if (style === 'coach') return 0.3;
  return 0.36;
};

const buildUserPrompt = (payload: GeneratePayload) => {
  const style = payload.stylePreset ?? 'balanced';
  const pregame = extractPregameContext(payload.pregameReport);
  const postgame = extractPostgameContext(payload.postgameReport);
  const contextBlock = {
    gameId: payload.gameId,
    opponentName: payload.opponentName ?? payload.pregameReport.opponentTeamName,
    stylePreset: style,
    pregame,
    postgame,
  };

  return `${BASE_INSTRUCTIONS}${getStyleInstructions(style)}\n\n### KONKRÉT ADATOK JSON FORMÁBAN\n${JSON.stringify(contextBlock, null, 2)}`;
};

const callOpenAi = async (prompt: string, style: 'fan' | 'balanced' | 'coach') => {
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
        temperature: resolveTemperature(style),
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
    const style = payload.stylePreset ?? 'balanced';
    const prompt = buildUserPrompt(payload);
    const narrative = await callOpenAi(prompt, style);
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
