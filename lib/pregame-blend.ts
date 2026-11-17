// Pre-game aggregátumok: egy meccs kivonása a csapat- és játékos-szezonösszegből
// (az elemzett meccs ne legyen a saját bemenete), az ellenfél-box összegzése / levonása,
// a kapott pont a `games` végeredményéből, valamint a szezon és a friss forma keverése
// (`computeRecentBlendWeight`, `blendPregameTeamStats`, `blendPregamePlayers`).
// A SeasonComparison-ből kiszervezve (H34/F1c), viselkedésváltozás nélkül. Nem @core modul.
import type { PlayerSeasonStat, TeamSeasonStat as PregameTeamSeasonStat } from '@/lib/pregame-scouting';
import type { GamePlayerStatRow } from '@/lib/season-comparison-helpers';
import { emptyTeamOpponentBox, type TeamGameScore, type TeamOpponentBox } from '@/lib/team-analysis';

const clampStat = (value: number) => (value < 0 ? 0 : value);

const aggregateTeamGameRows = (rows: GamePlayerStatRow[]) => {
  return rows.reduce(
    (acc, row) => {
      acc.pointsFor += row.points || 0;
      acc.fga2 += (row.close_attempted || 0) + (row.mid_attempted || 0);
      acc.fgm2 += (row.close_made || 0) + (row.mid_made || 0);
      acc.fga3 += row.three_attempted || 0;
      acc.fgm3 += row.three_made || 0;
      acc.fta += row.free_throw_attempted || 0;
      acc.ftm += row.free_throw_made || 0;
      acc.oreb += row.offensive_rebounds || 0;
      acc.dreb += row.defensive_rebounds || 0;
      acc.ast += row.assists || 0;
      acc.tov += row.turnovers || 0;
      acc.stl += row.steals || 0;
      acc.blk += row.blocks || 0;
      acc.fouls += row.fouls_committed || 0;
      acc.val += row.valuation || 0;
      return acc;
    },
    {
      pointsFor: 0,
      fga2: 0,
      fgm2: 0,
      fga3: 0,
      fgm3: 0,
      fta: 0,
      ftm: 0,
      oreb: 0,
      dreb: 0,
      ast: 0,
      tov: 0,
      stl: 0,
      blk: 0,
      fouls: 0,
      val: 0,
    }
  );
};

// Az ellenfél-box levonása / keverése: a mezők azonos nevűek, ezért
// mezőnként, egy listán megyünk végig.
const OPPONENT_BOX_KEYS = ['fga2', 'fgm2', 'fga3', 'fgm3', 'fta', 'ftm', 'oreb', 'dreb', 'tov', 'games', 'ownOreb', 'ownDreb'] as const;

const subtractOpponentBox = (total: TeamOpponentBox | undefined, game: TeamOpponentBox | undefined) => {
  if (!total || !game) return total;
  const result = { ...total };
  OPPONENT_BOX_KEYS.forEach(key => {
    result[key] = Math.max(0, total[key] - game[key]);
  });
  return result;
};

export const sumOpponentBoxes = (boxes: Array<TeamOpponentBox | undefined>) => {
  const result = emptyTeamOpponentBox();
  boxes.forEach(box => {
    if (!box) return;
    OPPONENT_BOX_KEYS.forEach(key => {
      result[key] += box[key];
    });
  });
  return result;
};

const blendOpponentBox = (
  season: TeamOpponentBox | undefined,
  recent: TeamOpponentBox | undefined,
  recentWeight: number
) => {
  // Ha bármelyik oldalon hiányzik a párosított minta, a meglévőt tartjuk meg
  // (a keverés különben nullával hígítaná az OREB%-ot és a tempót).
  if (!season?.games) return recent;
  if (!recent?.games) return season;
  const result = emptyTeamOpponentBox();
  OPPONENT_BOX_KEYS.forEach(key => {
    result[key] = season[key] * (1 - recentWeight) + recent[key] * recentWeight;
  });
  return result;
};

/**
 * A kapott pont a csapat saját meccsein, a `games` végeredményéből
 * (`buildTeamScoreTotals`). `countedGames`: az ismert eredményű meccsek száma.
 */
export const sumPointsAgainst = (
  teamId: string,
  gameIds: string[],
  gameScores: Map<string, TeamGameScore>
) => gameIds.reduce(
  (acc, gameId) => {
    const score = gameScores.get(gameId);
    if (!score || score.ourTeamId !== teamId) return acc;
    return { pointsAgainst: acc.pointsAgainst + score.oppScore, countedGames: acc.countedGames + 1 };
  },
  { pointsAgainst: 0, countedGames: 0 }
);

export const subtractGameFromTeamAggregate = (
  team: PregameTeamSeasonStat,
  teamId: string | null | undefined,
  gameId: string | null | undefined,
  teamGamePlayerRows: Map<string, Map<string, GamePlayerStatRow[]>>,
  gameScores: Map<string, TeamGameScore>,
  opponentBoxByGame: Map<string, TeamOpponentBox>
) => {
  if (!teamId || !gameId) return team;
  const rows = teamGamePlayerRows.get(teamId)?.get(gameId);
  if (!rows || rows.length === 0) return team;
  const totals = aggregateTeamGameRows(rows);
  // A kapott pont ugyanabból a forrásból vonódik ki, amiből a szezonösszeg épül.
  const { pointsAgainst: opponentPoints } = sumPointsAgainst(teamId, [gameId], gameScores);

  return {
    ...team,
    games: Math.max(0, (team.games || 0) - 1),
    pointsFor: clampStat(team.pointsFor - totals.pointsFor),
    pointsAgainst: clampStat(team.pointsAgainst - opponentPoints),
    fga2: clampStat(team.fga2 - totals.fga2),
    fgm2: clampStat(team.fgm2 - totals.fgm2),
    fga3: clampStat(team.fga3 - totals.fga3),
    fgm3: clampStat(team.fgm3 - totals.fgm3),
    fta: clampStat(team.fta - totals.fta),
    ftm: clampStat(team.ftm - totals.ftm),
    oreb: clampStat(team.oreb - totals.oreb),
    dreb: clampStat(team.dreb - totals.dreb),
    ast: clampStat(team.ast - totals.ast),
    tov: clampStat(team.tov - totals.tov),
    stl: clampStat(team.stl - totals.stl),
    blk: clampStat(team.blk - totals.blk),
    fouls: clampStat(team.fouls - totals.fouls),
    val: clampStat(team.val - totals.val),
    opponent: subtractOpponentBox(team.opponent, opponentBoxByGame.get(gameId)),
  };
};

export const subtractGameFromPlayerAggregates = (
  players: PlayerSeasonStat[],
  teamId: string | null | undefined,
  gameId: string | null | undefined,
  teamGamePlayerRows: Map<string, Map<string, GamePlayerStatRow[]>>
) => {
  if (!teamId || !gameId || players.length === 0) return players;
  const rows = teamGamePlayerRows.get(teamId)?.get(gameId);
  if (!rows || rows.length === 0) return players;
  const rowsByPlayer = new Map<string, GamePlayerStatRow[]>();
  rows.forEach(row => {
    if (!rowsByPlayer.has(row.player_id)) rowsByPlayer.set(row.player_id, []);
    rowsByPlayer.get(row.player_id)!.push(row);
  });

  return players
    .map(player => {
      const playerRows = rowsByPlayer.get(player.playerId);
      if (!playerRows || playerRows.length === 0) return player;
      const totals = playerRows.reduce(
        (acc, row) => {
          acc.games += 1;
          acc.minutes += row.minutes || 0;
          acc.points += row.points || 0;
          acc.fga2 += (row.close_attempted || 0) + (row.mid_attempted || 0);
          acc.fgm2 += (row.close_made || 0) + (row.mid_made || 0);
          acc.fga3 += row.three_attempted || 0;
          acc.fgm3 += row.three_made || 0;
          acc.fta += row.free_throw_attempted || 0;
          acc.ftm += row.free_throw_made || 0;
          acc.oreb += row.offensive_rebounds || 0;
          acc.dreb += row.defensive_rebounds || 0;
          acc.ast += row.assists || 0;
          acc.tov += row.turnovers || 0;
          acc.stl += row.steals || 0;
          acc.blk += row.blocks || 0;
          acc.val += row.valuation || 0;
          return acc;
        },
        {
          games: 0,
          minutes: 0,
          points: 0,
          fga2: 0,
          fgm2: 0,
          fga3: 0,
          fgm3: 0,
          fta: 0,
          ftm: 0,
          oreb: 0,
          dreb: 0,
          ast: 0,
          tov: 0,
          stl: 0,
          blk: 0,
          val: 0,
        }
      );

      return {
        ...player,
        games: Math.max(0, (player.games || 0) - totals.games),
        minutes: clampStat(player.minutes - totals.minutes),
        points: clampStat(player.points - totals.points),
        fga2: clampStat(player.fga2 - totals.fga2),
        fgm2: clampStat(player.fgm2 - totals.fgm2),
        fga3: clampStat(player.fga3 - totals.fga3),
        fgm3: clampStat(player.fgm3 - totals.fgm3),
        fta: clampStat(player.fta - totals.fta),
        ftm: clampStat(player.ftm - totals.ftm),
        oreb: clampStat(player.oreb - totals.oreb),
        dreb: clampStat(player.dreb - totals.dreb),
        ast: clampStat(player.ast - totals.ast),
        tov: clampStat(player.tov - totals.tov),
        stl: clampStat(player.stl - totals.stl),
        blk: clampStat(player.blk - totals.blk),
        val: clampStat(player.val - totals.val),
      };
    })
    .filter(player => player.games > 0);
};

export const computeRecentBlendWeight = (recentGames: number, seasonGames: number) => {
  if (!Number.isFinite(recentGames) || recentGames < 3) return 0;
  const season = Math.max(seasonGames || 1, 1);
  const coverage = Math.min(recentGames / season, 1);
  const baseWeight = 0.45 + coverage * 0.3;
  return Math.min(Math.max(baseWeight, 0.45), 0.72);
};

const blendValue = (seasonValue: number, recentValue: number, recentWeight: number) =>
  seasonValue * (1 - recentWeight) + recentValue * recentWeight;

export const blendPregameTeamStats = (
  season: PregameTeamSeasonStat,
  recent: PregameTeamSeasonStat,
  recentWeight: number
): PregameTeamSeasonStat => ({
  ...season,
  games: blendValue(season.games || 0, recent.games || 0, recentWeight),
  pointsFor: blendValue(season.pointsFor || 0, recent.pointsFor || 0, recentWeight),
  pointsAgainst: blendValue(season.pointsAgainst || 0, recent.pointsAgainst || 0, recentWeight),
  fga2: blendValue(season.fga2 || 0, recent.fga2 || 0, recentWeight),
  fgm2: blendValue(season.fgm2 || 0, recent.fgm2 || 0, recentWeight),
  fga3: blendValue(season.fga3 || 0, recent.fga3 || 0, recentWeight),
  fgm3: blendValue(season.fgm3 || 0, recent.fgm3 || 0, recentWeight),
  fta: blendValue(season.fta || 0, recent.fta || 0, recentWeight),
  ftm: blendValue(season.ftm || 0, recent.ftm || 0, recentWeight),
  oreb: blendValue(season.oreb || 0, recent.oreb || 0, recentWeight),
  dreb: blendValue(season.dreb || 0, recent.dreb || 0, recentWeight),
  ast: blendValue(season.ast || 0, recent.ast || 0, recentWeight),
  tov: blendValue(season.tov || 0, recent.tov || 0, recentWeight),
  stl: blendValue(season.stl || 0, recent.stl || 0, recentWeight),
  blk: blendValue(season.blk || 0, recent.blk || 0, recentWeight),
  fouls: blendValue(season.fouls || 0, recent.fouls || 0, recentWeight),
  val: blendValue(season.val || 0, recent.val || 0, recentWeight),
  opponent: blendOpponentBox(season.opponent, recent.opponent, recentWeight),
});

export const blendPregamePlayers = (
  seasonPlayers: PlayerSeasonStat[],
  recentPlayers: PlayerSeasonStat[],
  recentWeight: number
): PlayerSeasonStat[] => {
  const seasonMap = new Map(seasonPlayers.map(player => [player.playerId, player]));
  const recentMap = new Map(recentPlayers.map(player => [player.playerId, player]));
  const playerIds = new Set<string>([...seasonMap.keys(), ...recentMap.keys()]);

  return Array.from(playerIds)
    .map(playerId => {
      const season = seasonMap.get(playerId);
      const recent = recentMap.get(playerId);
      if (!season) return recent!;
      if (!recent) return season;

      return {
        ...season,
        name: season.name || recent.name,
        position: season.position || recent.position,
        positionLabel: season.positionLabel ?? recent.positionLabel,
        positionBuckets: season.positionBuckets ?? recent.positionBuckets,
        heightCm: season.heightCm ?? recent.heightCm,
        roles: season.roles?.length ? season.roles : recent.roles,
        games: blendValue(season.games || 0, recent.games || 0, recentWeight),
        minutes: blendValue(season.minutes || 0, recent.minutes || 0, recentWeight),
        points: blendValue(season.points || 0, recent.points || 0, recentWeight),
        fga2: blendValue(season.fga2 || 0, recent.fga2 || 0, recentWeight),
        fgm2: blendValue(season.fgm2 || 0, recent.fgm2 || 0, recentWeight),
        fga3: blendValue(season.fga3 || 0, recent.fga3 || 0, recentWeight),
        fgm3: blendValue(season.fgm3 || 0, recent.fgm3 || 0, recentWeight),
        fta: blendValue(season.fta || 0, recent.fta || 0, recentWeight),
        ftm: blendValue(season.ftm || 0, recent.ftm || 0, recentWeight),
        oreb: blendValue(season.oreb || 0, recent.oreb || 0, recentWeight),
        dreb: blendValue(season.dreb || 0, recent.dreb || 0, recentWeight),
        ast: blendValue(season.ast || 0, recent.ast || 0, recentWeight),
        tov: blendValue(season.tov || 0, recent.tov || 0, recentWeight),
        stl: blendValue(season.stl || 0, recent.stl || 0, recentWeight),
        blk: blendValue(season.blk || 0, recent.blk || 0, recentWeight),
        val: blendValue(season.val || 0, recent.val || 0, recentWeight),
      };
    })
    .filter(player => (player.games || 0) > 0);
};

export const hasSampleForPregame = (games: number, preferredMinimum: number, fallbackMinimum: number) => {
  if (!Number.isFinite(games)) return false;
  if (games >= preferredMinimum) return true;
  return games >= fallbackMinimum;
};
