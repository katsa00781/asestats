// GENERÁLT MÁSOLAT (leegyszerűsítve) – forrás: asestats/scrape-utils.ts
// (normalizeName, TEAM_NAME_ALIASES, findTeamByNameStrict).
//
// Deno futásidő, nem tudja importálni a Node-alapú scrape-utils.ts-t
// (process.env, dotenv). Csak a szigorú (nem fuzzy) egyezést hozza át: a
// gyűjtő inkább hagy ki egy meccset, mint hogy rossz csapathoz írjon élő
// adatot – lásd `live-scan/index.ts` "névdrift-védelem" kommentjét.
//
// Klub átnevezéskor MINDKÉT helyre (ide és a scrape-utils.ts-be) fel kell
// venni az alias-t, különben az élő gyűjtő nem találja meg az új nevet.

export interface LiveTeamRecord {
  id: string;
  name: string;
  short_name: string | null;
}

const TEAM_NAME_ALIASES: Record<string, string> = {
  'endo plus service-honved': 'budapesti honved sportegyesulet',
};

export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function applyAlias(normalized: string): string {
  return TEAM_NAME_ALIASES[normalized] ?? normalized;
}

/** Pontos név vagy short_name egyezés, illetve az egyik a másik részlete. */
export function findTeamByName<T extends LiveTeamRecord>(teams: T[], name: string): T | null {
  const target = applyAlias(normalizeName(name));
  if (!target) return null;

  const exact =
    teams.find((team) => normalizeName(team.name) === target) ??
    teams.find((team) => team.short_name && normalizeName(team.short_name) === target);
  if (exact) return exact;

  const partial = teams.find((team) => {
    const teamName = normalizeName(team.name);
    return teamName.length > 0 && (teamName.includes(target) || target.includes(teamName));
  });
  return partial ?? null;
}
