import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import type { PlayerPostGameBreakdown } from '@/lib/player-postgame';
import { callAi } from '@/lib/ai-client';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Ebben a route-ban az admin kliens hiánya nem fatális (a mentés opcionális),
// ezért a factory hibáját null-ra fordítjuk – a viselkedés változatlan.
const supabaseAdmin = (() => {
  try {
    return getSupabaseAdmin();
  } catch {
    return null;
  }
})();

type PlayerPostGameTextPayload = {
  gameId?: string | null;
  playerId: string;
  playerName: string;
  teamName?: string;
  opponentName?: string;
  result?: 'win' | 'loss';
  report: PlayerPostGameBreakdown;
};

const SYSTEM_PROMPT = `Te egy magyar kosárlabda-elemző vagy, aki szurkolóbarát, közérthető, de szakmailag pontos szöveget ír.
Kötelező szabályok:
- Kizárólag a kapott adatokra hivatkozhatsz.
- Nem találhatsz ki új statisztikát vagy százalékot.
- A szöveg legyen olvasmányos, leíró, természetes ritmusú.
- Kerüld a túl technikai zsargont, de maradj szakmailag hiteles.`;

const formatInstructions = `Készíts 7-9 mondatos, szurkolóbarát játékos értékelést magyar nyelven.
Struktúra:
1. Nyitás: rövid kontextus (perc, usage, TS%) közérthetően.
2. Mi volt a játékos fő hatása a meccsre.
3. Dobásprofil: mondd el röviden, hogy a döntései milyen minőségű helyzeteket eredményeztek.
4. Limitáció: ha volt gond, írd le ok-okozattal ("mert", "emiatt", "ezért").
5. Következő fókusz: 1-2 konkrét, pozitív hangvételű fejlesztési javaslat.

Stílus:
- Legyen leíró, olvasmányos, ne bulletlista-szerű.
- A mondatok legyenek rövidek-közepesek, jól követhetők.
- Ha nincs komoly probléma, emeld ki a stabilitást és a fejlődési irányt.`;

const buildUserPrompt = (payload: PlayerPostGameTextPayload) => {
  const context = {
    gameId: payload.gameId ?? null,
    playerId: payload.playerId,
    playerName: payload.playerName,
    teamName: payload.teamName,
    opponentName: payload.opponentName,
    result: payload.result,
    breakdown: payload.report,
  };

  return `${formatInstructions}\n\n### ADATOK JSON FORMÁBAN\n${JSON.stringify(context, null, 2)}`;
};

const callAiForPlayer = (prompt: string) =>
  callAi(SYSTEM_PROMPT, prompt, 0.25);

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const payload = (await request.json().catch(() => null)) as PlayerPostGameTextPayload | null;
  if (!payload) {
    return NextResponse.json({ ok: false, error: 'Hiányzik a kérés törzse.' }, { status: 400 });
  }

  if (!payload.playerId || !payload.playerName) {
    return NextResponse.json({ ok: false, error: 'Hiányos játékos azonosító vagy név.' }, { status: 400 });
  }
  if (!payload.report) {
    return NextResponse.json({ ok: false, error: 'Hiányzik a játékos riport.' }, { status: 400 });
  }

  try {
    const prompt = buildUserPrompt(payload);
    const narrative = await callAiForPlayer(prompt);
    const generatedAt = new Date().toISOString();

    if (supabaseAdmin && payload.gameId) {
      await supabaseAdmin
        .from('player_game_text_reports')
        .upsert(
          {
            game_id: payload.gameId,
            player_id: payload.playerId,
            narrative,
            breakdown: payload.report as unknown as Record<string, unknown>,
            generated_at: generatedAt,
          },
          { onConflict: 'game_id,player_id' }
        );
    }

    return NextResponse.json({ ok: true, narrative, generatedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ismeretlen hiba történt.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
