import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { callAi, AI_GENERATED_BY } from '@/lib/ai-client';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const supabaseAdmin = getSupabaseAdmin();

const SYSTEM_PROMPT = `Te egy magyar kosárlabda-elemző vagy, aki szurkolóbarát, élményszerű, de adathű szezonértékelést ír.
Szabályok:
- Csak a megadott adatokból dolgozhatsz.
- Nem találhatsz ki új számot vagy mutatót.
- A szöveg legyen olvasmányos, közérthető, mégis szakmailag pontos.
- Kerüld a száraz, túlzottan táblázatszerű megfogalmazást.
- Ha az advancedStats egy blokkja alacsony confidence-et jelez, ezt óvatosan, irányadó megállapításként fogalmazd meg.`;

const FORMAT_INSTRUCTIONS = `Készíts magyar nyelvű, 12-16 mondatos, szurkolóbarát játékos szezonértékelést.
Kötelező szerkezet:
1) Profil és szerep (2-3 mondat)
2) Hatékonyság és volumen (2-3 mondat)
3) Dobásprofil-olvasat (2-3 mondat): külön kezeld a gyűrű/festék/középtáv/sarok tripla/egyéb tripla mintázatot
4) Kockázatok és limitációk (2-3 mondat)
5) Edzői fókuszpontok a következő időszakra (2-3 mondat)
6) Haladó statisztikai blokk értelmezés (2-3 mondat): shot quality, clutch, on/off impact, döntésminőség, stabilitás, matchup, terhelés

Szabályok:
- Ne számolj új mutatót, ne becsülj.
- Használj magyar kosárlabda-szaknyelvet, de közérthetően.
- Adj ok-okozati mondatokat ("mert", "emiatt", "ezért").
- A dobásprofil következtetés legyen konkrét, ne sablon.
- A hangnem legyen tárgyilagosan biztató, ne rideg.
- A zárásban legyen egy rövid, előremutató összegzés.

Haladó statisztikák feldolgozási elvek:
- Az advancedStats mezőből emelj ki legalább 4 blokkot, és írd le a hatásukat rövid ok-okozati lánccal.
- A blockVerdicts szövegeit használd irányadónak, de ne másold szó szerint egymás után.
- A thresholdHints alapján fogalmazd meg röviden, hogy miért lett jó/közepes/kockázatos az adott blokk.
- Ha egy blokk confidence szintje "alacsony", azt jelezd: "korlátozott minta" vagy "irányadó minta".
- A coachingFocus pontokat építsd be az edzői fókusz szakaszba, ne hagyd figyelmen kívül.

Stíluskontroll:
- Ne listázz mechanikusan számokat; a számokat mindig értelmezd.
- Azonosíts legalább egy erősséget és legalább egy fejlesztendő területet az advancedStats alapján.
- Ne írj ellentmondást: ha valamely blokk kockázatos, a zárás ne nevezze egyértelmű erősségnek ugyanazt a területet.

Kritikus értelmezési szabályok:
- Az analysis.skillScores és az advancedStats.seasonSummary skill-jellegű indexei benchmark-mutatók, nem nyers per-meccs volumenadatok.
- Ne nevezz valakit elsődleges pontszerzőnek vagy go-to opciónak csak magas skill score alapján; ehhez nyers PPG/MPG/usage-kontekstus is kell.
- Ha a clutch usage alacsony, ezt másodlagos vagy befejező szerepkörként írd le, ne closerként.
- Ne találj ki transition, short-roll vagy egyéb specifikus játékszituációs gyengeséget, ha nincs rá explicit adat a bemenetben.
- Fault-fegyelmet csak akkor említs konkrét javítandó pontként, ha van hozzá számszerű seasonSummary vagy improvement adat.
- Ha a szezonos stabilitás gyenge, de a clutch blokk pozitív, ezt minta- és szerepkör-különbségként oldd fel, ne állíts be globális ellentmondásmentes stabilitást.`;

type GeneratePlayerSeasonPayload = {
  seasonId: string;
  teamId?: string | null;
  teamName?: string | null;
  playerId: string;
  playerName: string;
  generatedBy?: string | null;
  analysis: unknown;
  advancedStats?: unknown;
  seasonSummary?: unknown;
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
    advancedStats: payload.advancedStats ?? null,
    seasonSummary: payload.seasonSummary ?? null,
    shotProfile: payload.shotProfile ?? null,
    recentGames: payload.recentGames ?? null,
  };

  return `${FORMAT_INSTRUCTIONS}\n\n### ADATOK JSON FORMÁBAN\n${JSON.stringify(context, null, 2)}`;
};

const callAiForSeason = (prompt: string) =>
  callAi(SYSTEM_PROMPT, prompt, 0.3);

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

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
    const narrative = await callAiForSeason(prompt);
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
            advancedStats: payload.advancedStats ?? null,
            seasonSummary: payload.seasonSummary ?? null,
            shotProfile: payload.shotProfile ?? null,
            recentGames: payload.recentGames ?? null,
          },
          generated_by: payload.generatedBy ?? AI_GENERATED_BY,
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
