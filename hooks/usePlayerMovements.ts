'use client';

import type { PlayerMovement } from '@/lib/player-movements';
import { parsePlayerMovement } from '@/lib/player-movements';
import { fetchAllRows } from '@/lib/fetch-all-rows';
import { supabase } from '@/lib/supabase';
import { useCallback, useEffect, useMemo, useState } from 'react';

type MovementResult = { request: object; rows: PlayerMovement[]; error: string | null };
const EMPTY_ROWS: PlayerMovement[] = [];

export function usePlayerMovements(seasonId: string | null, teamId: string | null) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<MovementResult | null>(null);
  const request = useMemo(() => ({ seasonId, teamId, revision }), [seasonId, teamId, revision]);
  const reload = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => {
    if (!request.seasonId) return;
    let active = true;
    const controller = new AbortController();
    const load = async () => {
      try {
        const data = await fetchAllRows<unknown>((from, to) => {
          let query = supabase.from('league_player_movements').select('*')
            .eq('season_id', request.seasonId).order('id').range(from, to).abortSignal(controller.signal);
          if (request.teamId) query = query.eq('team_id', request.teamId);
          return query;
        });
        const rows = data.map(parsePlayerMovement);
        if (active) setResult({ request, rows, error: null });
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : '';
        const missingSource = /schema cache|does not exist|could not find/i.test(message);
        setResult({ request, rows: [], error: missingSource
          ? 'Az igazolási adatforrás még nincs előkészítve. Kérd az adminisztrátor segítségét.'
          : 'Az igazolások betöltése nem sikerült. Próbáld újra.' });
      }
    };
    void load();
    return () => { active = false; controller.abort(); };
  }, [request]);

  // Szűrőváltáskor az előző csapat sorai már az első renderben eltűnnek;
  // későn visszaérkező kérés nem írhatja felül az aktuális listát.
  const current = result?.request === request ? result : null;
  return { rows: current?.rows ?? EMPTY_ROWS, loading: Boolean(seasonId && !current), error: current?.error ?? null, reload };
}
