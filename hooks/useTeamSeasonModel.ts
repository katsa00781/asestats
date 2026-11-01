'use client';

import type { TeamSeasonExport } from '@/lib/team-season-export';
import { buildTeamSeasonExport } from '@/lib/team-season-export';
import { loadTeamSeasonModelInput } from '@/lib/team-season-export-data';
import { useEffect, useMemo, useState } from 'react';

type ModelResult = { request: object; model: TeamSeasonExport | null; error: string | null };

/**
 * Egy csapat-szezon export-modellje (meccssorok versenyszakasz-besorolással,
 * box score aggregátumokkal). A szezon- vagy csapatváltáskor az előző kérés
 * válasza már az első renderben eltűnik, és a későn érkező válasz nem írja felül.
 */
export function useTeamSeasonModel(teamId: string | null, season: { id: string; name: string } | null) {
  const seasonId = season?.id ?? null;
  const seasonName = season?.name ?? null;
  const request = useMemo(() => ({ teamId, seasonId, seasonName }), [teamId, seasonId, seasonName]);
  const [result, setResult] = useState<ModelResult | null>(null);

  useEffect(() => {
    if (!request.teamId || !request.seasonId || !request.seasonName) return;
    const { teamId: requestTeamId, seasonId: requestSeasonId, seasonName: requestSeasonName } = request;
    let active = true;
    const load = async () => {
      try {
        const input = await loadTeamSeasonModelInput({
          seasonId: requestSeasonId,
          seasonName: requestSeasonName,
          teamId: requestTeamId,
        });
        const model = buildTeamSeasonExport({
          games: input.games,
          statRows: input.statRows,
          players: [],
          seasonName: requestSeasonName,
        });
        if (active) setResult({ request, model, error: null });
      } catch (error) {
        console.error('Csapat-szezon modell betöltése sikertelen:', error);
        if (active) setResult({ request, model: null, error: 'A szezon adatai nem töltődtek be. Próbáld újra.' });
      }
    };
    void load();
    return () => { active = false; };
  }, [request]);

  const current = result?.request === request ? result : null;
  const idle = !teamId || !seasonId || !seasonName;
  return {
    model: current?.model ?? null,
    loading: !idle && !current,
    error: current?.error ?? null,
  };
}
