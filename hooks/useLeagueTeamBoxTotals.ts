'use client';

import type { BoxStatRow, LeagueGameBox, OpponentBoxTotals, TeamBoxTotals } from '@/lib/team-analysis';
import { fetchAllRows } from '@/lib/fetch-all-rows';
import { getSeasonStatsTable } from '@/lib/season-tables';
import { supabase } from '@/lib/supabase';
import { buildOpponentBoxTotals, sumBoxRows } from '@/lib/team-analysis';
import { useEffect, useMemo, useState } from 'react';

// A liga minden meccsének csapat-box score-ja, az ellenfél-összesítőhöz
// (OREB%, közös tempó, DRtg). A dashboard alap adatfolyama (useGameData) csak a
// kiválasztott csapat meccseit tölti, ezért ez szezononként egyszer, külön
// lekérdezéssel jön – a team-season-export-data liga-betöltőjének mintájára.

const BOX_COLUMNS = 'game_id, close_made, close_attempted, mid_made, mid_attempted, three_made, three_attempted, free_throw_made, free_throw_attempted, offensive_rebounds, defensive_rebounds, turnovers';
const GAME_ID_CHUNK = 50;

type GameRow = { id: string; date: string; our_team_id: string; opponent_team_id: string | null };
type StatRow = BoxStatRow & { game_id: string };
type BoxResult = { key: string; totals: OpponentBoxTotals; error: string | null };

const EMPTY_TOTALS: OpponentBoxTotals = { byTeam: new Map(), byGame: new Map() };

async function loadLeagueGameBoxes(seasonId: string, seasonName: string, signal: AbortSignal): Promise<LeagueGameBox[]> {
  const statsTable = getSeasonStatsTable(seasonName);
  if (statsTable === 'player_game_stats') throw new Error(`Ismeretlen szezon: ${seasonName}`);

  const games = await fetchAllRows<GameRow>((from, to) =>
    supabase
      .from('games')
      .select('id, date, our_team_id, opponent_team_id')
      .eq('season_id', seasonId)
      .order('id', { ascending: true })
      .range(from, to)
      .abortSignal(signal)
  );

  const gameIds = games.map(game => game.id);
  const chunks: string[][] = [];
  for (let i = 0; i < gameIds.length; i += GAME_ID_CHUNK) chunks.push(gameIds.slice(i, i + GAME_ID_CHUNK));
  const statChunks = await Promise.all(
    chunks.map(chunk =>
      fetchAllRows<StatRow>((from, to) =>
        supabase
          .from(statsTable as never)
          .select(BOX_COLUMNS)
          .in('game_id', chunk)
          .order('id', { ascending: true })
          .range(from, to)
          .abortSignal(signal)
      )
    )
  );

  const rowsByGame = new Map<string, StatRow[]>();
  statChunks.flat().forEach(row => {
    if (!rowsByGame.has(row.game_id)) rowsByGame.set(row.game_id, []);
    rowsByGame.get(row.game_id)!.push(row);
  });

  return games.map(game => {
    const rows = rowsByGame.get(game.id);
    const box: TeamBoxTotals | null = rows && rows.length > 0 ? sumBoxRows(rows) : null;
    return {
      gameId: game.id,
      date: game.date,
      ourTeamId: game.our_team_id,
      opponentTeamId: game.opponent_team_id,
      box,
    };
  });
}

/**
 * Csapatonként és meccsenként az ellenfél-box a párosított meccseken.
 * Betöltés közben / hiba esetén üres térképet ad – a hívó ilyenkor az
 * ellenfél-oldal nélküli (saját becslésű) értékekre esik vissza.
 */
export function useLeagueTeamBoxTotals(seasonId: string | null | undefined, seasonName: string | null | undefined) {
  const [result, setResult] = useState<BoxResult | null>(null);
  const key = useMemo(() => (seasonId && seasonName ? `${seasonId}|${seasonName}` : ''), [seasonId, seasonName]);

  useEffect(() => {
    if (!key || !seasonId || !seasonName) return;
    let active = true;
    const controller = new AbortController();
    const load = async () => {
      try {
        const games = await loadLeagueGameBoxes(seasonId, seasonName, controller.signal);
        if (active) setResult({ key, totals: buildOpponentBoxTotals(games), error: null });
      } catch (error) {
        if (!active) return;
        console.error('Liga box score betöltési hiba:', error);
        setResult({ key, totals: EMPTY_TOTALS, error: 'A liga box score-ok betöltése nem sikerült.' });
      }
    };
    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [key, seasonId, seasonName]);

  const current = result?.key === key ? result : null;
  return {
    totals: current?.totals ?? EMPTY_TOTALS,
    loading: Boolean(key && !current),
    error: current?.error ?? null,
  };
}
