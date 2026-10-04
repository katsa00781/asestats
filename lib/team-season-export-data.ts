import type { PlayerStats, TeamGame } from './dashboard-types';
import type { TeamExportLineupInput, TeamExportQuarterRow, TeamExportStatRow } from './team-season-export';
import { teamStatsToMd } from './export-to-md';
import { fetchAllRows } from './fetch-all-rows';
import { buildLeagueComparison } from './team-season-export';
import { getSeasonStatsTable } from './season-tables';
import { supabase } from './supabase';

// A csapat szezon export igény szerint (gombnyomásra) betöltött kiegészítő
// adatai: a csapat negyedenkénti pontjai és a teljes liga meccs-sorai a
// liga-összehasonlításhoz. A dashboard alap adatfolyama (useGameData) csak a
// kiválasztott csapat meccseit tölti be, ezért ez külön lekérdezés.

export type TeamSeasonExportExtras = {
  quarterRows: TeamExportQuarterRow[];
  leagueTeams: Array<{ teamId: string; teamName: string; games: TeamGame[] }>;
  leagueStatRows: TeamExportStatRow[];
  /** Sikertelen részlekérdezések – az export ezek nélkül is elkészül. */
  notes: string[];
};

type LeagueGameRow = {
  id: string;
  date: string;
  opponent: string;
  home_away: 'home' | 'away';
  our_score: number;
  opp_score: number;
  result: 'win' | 'loss';
  our_team_id: string;
  opponent_team_id: string | null;
  round: number | null;
  kosarstat_game_id: string | null;
};

type PhaseRow = { kosarstat_game_id: string | null; competition_phase: string | null };

// Egyetlen string literál: összefűzött stringből a Supabase kliens nem tud sortípust levezetni.
const STAT_COLUMNS = 'game_id, player_id, minutes, points, close_made, close_attempted, mid_made, mid_attempted, three_made, three_attempted, free_throw_made, free_throw_attempted, offensive_rebounds, defensive_rebounds, total_rebounds, assists, steals, blocks, turnovers, fouls_committed, valuation';

/** Ennyi meccs játékos-sorait kérjük le egy lekérdezésben (URL-hossz korlát). */
const GAME_ID_CHUNK = 50;

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : 'ismeretlen hiba');

async function loadQuarterRows(seasonId: string, kosarstatGameIds: string[]): Promise<TeamExportQuarterRow[]> {
  if (kosarstatGameIds.length === 0) return [];
  return fetchAllRows<TeamExportQuarterRow>((from, to) =>
    supabase
      .from('kosarstat_game_quarter_stats' as never)
      .select('kosarstat_game_id, team_side, quarter, points')
      .eq('season_id', seasonId)
      .in('kosarstat_game_id', kosarstatGameIds)
      .order('kosarstat_game_id', { ascending: true })
      .order('team_side', { ascending: true })
      .order('quarter', { ascending: true })
      .range(from, to)
  );
}

async function loadLeague(
  seasonId: string,
  seasonName: string,
  teams: Array<{ id: string; name: string }>
): Promise<Pick<TeamSeasonExportExtras, 'leagueTeams' | 'leagueStatRows'>> {
  const statsTable = getSeasonStatsTable(seasonName);
  if (statsTable === 'player_game_stats') {
    throw new Error(`ismeretlen szezon: „${seasonName}” – nincs hozzá szezontábla`);
  }

  const [gameRows, phaseRows] = await Promise.all([
    fetchAllRows<LeagueGameRow>((from, to) =>
      supabase
        .from('games')
        .select('id, date, opponent, home_away, our_score, opp_score, result, our_team_id, opponent_team_id, round, kosarstat_game_id')
        .eq('season_id', seasonId)
        .order('date', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)
    ),
    fetchAllRows<PhaseRow>((from, to) =>
      supabase
        .from('kosarstat_game_pages_raw' as never)
        .select('kosarstat_game_id, competition_phase')
        .eq('season_id', seasonId)
        .eq('page_type', 'game')
        .order('kosarstat_game_id', { ascending: true })
        .range(from, to)
    ),
  ]);

  const phaseByKosarstatId = new Map<string, string>();
  phaseRows.forEach(row => {
    if (row.kosarstat_game_id && row.competition_phase) {
      phaseByKosarstatId.set(String(row.kosarstat_game_id), row.competition_phase);
    }
  });

  // Az ellenfél-nézetű meccs: ugyanaz a nap, felcserélt csapatokkal.
  const gameIdByTeamAndDate = new Map(gameRows.map(row => [`${row.date}::${row.our_team_id}::${row.opponent_team_id ?? ''}`, row.id]));

  const gameIds = gameRows.map(row => row.id);
  const chunks: string[][] = [];
  for (let index = 0; index < gameIds.length; index += GAME_ID_CHUNK) {
    chunks.push(gameIds.slice(index, index + GAME_ID_CHUNK));
  }
  const statChunks = await Promise.all(
    chunks.map(chunk =>
      fetchAllRows<TeamExportStatRow>((from, to) =>
        supabase
          .from(statsTable as never)
          .select(STAT_COLUMNS)
          .in('game_id', chunk)
          .order('id', { ascending: true })
          .range(from, to)
      )
    )
  );

  // A Kosarstat-link sokszor csak a meccs egyik nézetén van meg: a címkét a
  // tükörmeccs linkjéről is átvesszük.
  const kosarstatIdByGameId = new Map(gameRows.map(row => [row.id, row.kosarstat_game_id]));
  const phaseOf = (row: LeagueGameRow, mirrorGameId?: string) => {
    const ownPhase = row.kosarstat_game_id ? phaseByKosarstatId.get(row.kosarstat_game_id) : undefined;
    if (ownPhase) return ownPhase;
    const mirrorKosarstatId = mirrorGameId ? kosarstatIdByGameId.get(mirrorGameId) : null;
    return (mirrorKosarstatId ? phaseByKosarstatId.get(mirrorKosarstatId) : undefined) ?? null;
  };

  const teamNameById = new Map(teams.map(team => [team.id, team.name]));
  const gamesByTeam = new Map<string, TeamGame[]>();
  gameRows.forEach(row => {
    const mirrorGameId = row.opponent_team_id
      ? gameIdByTeamAndDate.get(`${row.date}::${row.opponent_team_id}::${row.our_team_id}`)
      : undefined;
    const game: TeamGame = {
      id: row.id,
      date: row.date,
      opponent: row.opponent,
      homeAway: row.home_away,
      ourScore: row.our_score,
      oppScore: row.opp_score,
      result: row.result,
      kosarstatGameId: row.kosarstat_game_id,
      players: [],
      opponentGameId: mirrorGameId,
      opponentTeamId: row.opponent_team_id,
      round: row.round,
      competitionPhase: phaseOf(row, mirrorGameId),
    };
    const list = gamesByTeam.get(row.our_team_id);
    if (list) list.push(game);
    else gamesByTeam.set(row.our_team_id, [game]);
  });

  return {
    leagueTeams: Array.from(gamesByTeam.entries()).map(([teamId, games]) => ({
      teamId,
      teamName: teamNameById.get(teamId) ?? 'Ismeretlen csapat',
      games,
    })),
    leagueStatRows: statChunks.flat(),
  };
}

export async function loadTeamSeasonExportExtras(params: {
  seasonId: string;
  seasonName: string;
  teams: Array<{ id: string; name: string }>;
  /** A kiválasztott csapat Kosarstat-linkelt meccsei. */
  kosarstatGameIds: string[];
}): Promise<TeamSeasonExportExtras> {
  const notes: string[] = [];
  const [quarterResult, leagueResult] = await Promise.allSettled([
    loadQuarterRows(params.seasonId, params.kosarstatGameIds),
    loadLeague(params.seasonId, params.seasonName, params.teams),
  ]);

  if (quarterResult.status === 'rejected') {
    console.error('Negyedadatok betöltése sikertelen:', quarterResult.reason);
    notes.push(`A negyedenkénti pontok betöltése sikertelen (${errorMessage(quarterResult.reason)}): a negyedprofil kimaradt.`);
  }
  if (leagueResult.status === 'rejected') {
    console.error('Liga-adatok betöltése sikertelen:', leagueResult.reason);
    notes.push(`A liga meccsadatainak betöltése sikertelen (${errorMessage(leagueResult.reason)}): a liga-összehasonlítás kimaradt.`);
  }

  return {
    quarterRows: quarterResult.status === 'fulfilled' ? quarterResult.value : [],
    leagueTeams: leagueResult.status === 'fulfilled' ? leagueResult.value.leagueTeams : [],
    leagueStatRows: leagueResult.status === 'fulfilled' ? leagueResult.value.leagueStatRows : [],
    notes,
  };
}

/**
 * A csapat szezon export teljes MD-je: a már betöltött csapatadatok
 * (meccsek, játékos-sorok) mellé lekéri a negyedadatokat és a liga meccs-sorait.
 * Mindkét export gomb (Csapat tab, Elemzések) ezt hívja.
 */
export async function buildTeamSeasonMd(params: {
  seasonId: string;
  teamId: string;
  seasonName: string;
  teamName?: string;
  teams: Array<{ id: string; name: string }>;
  games: TeamGame[];
  statRows: TeamExportStatRow[];
  players: PlayerStats[];
  lineups?: TeamExportLineupInput;
}): Promise<string> {
  const extras = await loadTeamSeasonExportExtras({
    seasonId: params.seasonId,
    seasonName: params.seasonName,
    teams: params.teams,
    kosarstatGameIds: params.games
      .map(game => game.kosarstatGameId)
      .filter((id): id is string => Boolean(id)),
  });

  return teamStatsToMd({
    games: params.games,
    statRows: params.statRows,
    players: params.players,
    teamName: params.teamName,
    teamId: params.teamId,
    seasonName: params.seasonName,
    resolveTeamName: id => params.teams.find(team => team.id === id)?.name,
    quarterRows: extras.quarterRows,
    lineups: params.lineups,
    league: buildLeagueComparison({
      teams: extras.leagueTeams,
      statRows: extras.leagueStatRows,
      seasonName: params.seasonName,
    }),
    extraNotes: extras.notes,
  });
}
