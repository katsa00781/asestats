import { NextResponse } from 'next/server';
import type { PlayerPostGameBreakdown } from '@/lib/player-postgame';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const openAiApiKey = process.env.OPENAI_API_KEY;
const OPENAI_URL = process.env.OPENAI_API_URL ?? 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';
const MAX_RESPONSE_MS = 45_000;

if (!openAiApiKey) {
  throw new Error('OPENAI_API_KEY hiányzik a környezeti változók közül.');
}

type PlayerPostGameTextPayload = {
  gameId?: string | null;
  playerId: string;
  playerName: string;
  teamName?: string;
  opponentName?: string;
  result?: 'win' | 'loss';
  report: PlayerPostGameBreakdown;
};

const SYSTEM_PROMPT = `Te egy magyar kosárlabda-elemző vagy. Feladatod, hogy játékosonként készíts rövid, edzői szemszögű visszacsatolást a megadott algoritmikus riport (usage, TS%, VAL, erősségek, problémák, fókuszpontok) alapján. Nem vezethetsz le új statisztikát, kizárólag az átadott adatokra hivatkozhatsz.`;

const formatInstructions = `Készíts maximum 6-7 mondatos játékos értékelést magyar nyelven.
Struktúra:
1. Kontextus: perc terhelés + usage + hatékonyság (TS%).
2. Hatás: emeld ki, hogy pontszerzés, playmaking, lepattanó vagy védekezési playmaker szerep dominált.
3. Limitáció: ha van issue, írd le következménnyel együtt ("mert" szerkezet).
4. Következő fókusz: fogalmazz meg 1-2 mondatot a megadott fókuszpontok alapján.
Kritikus szabályok: ne találj ki új adatot; ha nincs issue, mondd ki, hogy stabil végrehajtás volt. Használj magyar szaknyelvet.`;

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
        temperature: 0.25,
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
    const narrative = await callOpenAi(prompt);
    const generatedAt = new Date().toISOString();
    return NextResponse.json({ ok: true, narrative, generatedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ismeretlen hiba történt.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
