// Nyers szezon-statisztika konverziók: a dashboard `PlayerStats` (szezonösszeg) és a
// játékos-meccs sorok (`GamePlayerStatRow`) átalakítása a játékoselemzés
// `RawPlayerSeasonStat` bemenetére, a csapatszintű `TeamSeasonStat` összegzés a
// keretlistával, a VAL-fallback és a poszt-metaadat. A SeasonComparison-ből
// kiszervezve (H34/F1d), viselkedésváltozás nélkül. Nem @core modul.
import type { PlayerStats } from '@/lib/dashboard-types';
import type { RawPlayerSeasonStat } from '@/lib/player-analysis';
import type { GamePlayerStatRow } from '@/lib/season-comparison-helpers';
import { buildPositionMetadata } from '@/lib/positions';
import { emptyTeamOpponentBox, type TeamSeasonStat } from '@/lib/team-analysis';

export const mapPositionInfo = (pos?: string | null) => buildPositionMetadata(pos, 'C');

// Egyszerűsített PIR-közelítés, KIZÁRÓLAG fallbackként, ha nincs DB-ben tárolt
// valuation. A hivatalos hunbasket VAL tartalmazza a kiharcolt/elkövetett
// faultokat is, de a fouls_drawn adat jelenleg megbízhatatlan (mindig 0),
// ezért itt szándékosan kimarad – a tárolt érték az elsődleges forrás.
export const computeTotalValuation = (player: PlayerStats) => {
  const fga2 = (player.shooting?.close?.attempted || 0) + (player.shooting?.mid?.attempted || 0);
  const fgm2 = (player.shooting?.close?.made || 0) + (player.shooting?.mid?.made || 0);
  const fga3 = player.shooting?.three?.attempted || 0;
  const fgm3 = player.shooting?.three?.made || 0;
  const fta = player.shooting?.freeThrow?.attempted || 0;
  const ftm = player.shooting?.freeThrow?.made || 0;
  const missed = (fga2 - fgm2) + (fga3 - fgm3) + (fta - ftm);
  return (
    (player.points || 0) +
    (player.rebounds?.total || 0) +
    (player.assists || 0) +
    (player.steals || 0) +
    (player.blocks || 0) -
    missed -
    (player.turnovers || 0)
  );
};

export const toRawStat = (player: PlayerStats, league: string, season: string): RawPlayerSeasonStat => {
  const gamesPlayed = player.gamesPlayed || 0;
  const totalValuation = (player.valuation || 0) * gamesPlayed;
  const fallbackValuation = computeTotalValuation(player);
  const valuation = totalValuation > 0 ? totalValuation : fallbackValuation;
  const positionInfo = mapPositionInfo(player.position);
  return {
    playerId: player.id,
    name: player.name,
    league,
    season,
    position: positionInfo.position,
    positionLabel: positionInfo.positionLabel,
    positionBuckets: positionInfo.positionBuckets,
    games: gamesPlayed,
    minutes: player.minutes || 0,
    points: player.points || 0,
    close: {
      made: player.shooting?.close?.made || 0,
      attempted: player.shooting?.close?.attempted || 0,
    },
    mid: {
      made: player.shooting?.mid?.made || 0,
      attempted: player.shooting?.mid?.attempted || 0,
    },
    three: {
      made: player.shooting?.three?.made || 0,
      attempted: player.shooting?.three?.attempted || 0,
    },
    ft: {
      made: player.shooting?.freeThrow?.made || 0,
      attempted: player.shooting?.freeThrow?.attempted || 0,
    },
    rebounds: {
      offensive: player.rebounds?.offensive || 0,
      defensive: player.rebounds?.defensive || 0,
      total: player.rebounds?.total || 0,
    },
    assists: player.assists || 0,
    steals: player.steals || 0,
    blocks: player.blocks || 0,
    turnovers: player.turnovers || 0,
    fouls: {
      committed: player.foulsCommitted || 0,
      received: player.foulsDrawn || 0,
    },
    valuation,
  };
};

export const toRawStatFromGameRows = (
  player: PlayerStats,
  rows: GamePlayerStatRow[],
  league: string,
  season: string
): RawPlayerSeasonStat => {
  const positionInfo = mapPositionInfo(player.position);
  const gameIds = new Set(rows.map(row => row.game_id).filter(Boolean));

  const totals = rows.reduce(
    (acc, row) => {
      acc.minutes += row.minutes || 0;
      acc.points += row.points || 0;
      acc.closeMade += row.close_made || 0;
      acc.closeAttempted += row.close_attempted || 0;
      acc.midMade += row.mid_made || 0;
      acc.midAttempted += row.mid_attempted || 0;
      acc.threeMade += row.three_made || 0;
      acc.threeAttempted += row.three_attempted || 0;
      acc.ftMade += row.free_throw_made || 0;
      acc.ftAttempted += row.free_throw_attempted || 0;
      acc.oreb += row.offensive_rebounds || 0;
      acc.dreb += row.defensive_rebounds || 0;
      acc.assists += row.assists || 0;
      acc.steals += row.steals || 0;
      acc.blocks += row.blocks || 0;
      acc.turnovers += row.turnovers || 0;
      acc.foulsCommitted += row.fouls_committed || 0;
      acc.valuation += row.valuation || 0;
      return acc;
    },
    {
      minutes: 0,
      points: 0,
      closeMade: 0,
      closeAttempted: 0,
      midMade: 0,
      midAttempted: 0,
      threeMade: 0,
      threeAttempted: 0,
      ftMade: 0,
      ftAttempted: 0,
      oreb: 0,
      dreb: 0,
      assists: 0,
      steals: 0,
      blocks: 0,
      turnovers: 0,
      foulsCommitted: 0,
      valuation: 0,
    }
  );

  return {
    playerId: player.id,
    name: player.name,
    league,
    season,
    position: positionInfo.position,
    positionLabel: positionInfo.positionLabel,
    positionBuckets: positionInfo.positionBuckets,
    games: gameIds.size,
    minutes: totals.minutes,
    points: totals.points,
    close: { made: totals.closeMade, attempted: totals.closeAttempted },
    mid: { made: totals.midMade, attempted: totals.midAttempted },
    three: { made: totals.threeMade, attempted: totals.threeAttempted },
    ft: { made: totals.ftMade, attempted: totals.ftAttempted },
    rebounds: {
      offensive: totals.oreb,
      defensive: totals.dreb,
      total: totals.oreb + totals.dreb,
    },
    assists: totals.assists,
    steals: totals.steals,
    blocks: totals.blocks,
    turnovers: totals.turnovers,
    fouls: {
      committed: totals.foulsCommitted,
      received: 0,
    },
    valuation: totals.valuation,
  };
};

export const buildTeamSeasonStats = (
  players: PlayerStats[],
  league: string,
  season: string,
  allTeams: { id: string; name: string }[],
  rolesByPlayerId: Map<string, string[]>,
  rosterPlayers: PlayerStats[] = players
): TeamSeasonStat[] => {
  const teamNameMap = new Map(allTeams.map(team => [team.id, team.name]));
  const teams = new Map<string, TeamSeasonStat>();

  players.forEach(player => {
    if (!player.teamId) return;
    const teamId = player.teamId;
    const teamName = teamNameMap.get(teamId) ?? player.teamName ?? 'Ismeretlen csapat';
    const existing = teams.get(teamId);
    const team: TeamSeasonStat = existing ?? {
      teamId,
      teamName,
      league,
      season,
      games: 0,
      pointsFor: 0,
      pointsAgainst: 0,
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
      opponent: emptyTeamOpponentBox(),
      roster: [],
    };

    const gamesPlayed = player.gamesPlayed || 0;
    team.games = Math.max(team.games, gamesPlayed);
    team.pointsFor += player.points || 0;
    team.fga2 += (player.shooting?.close?.attempted || 0) + (player.shooting?.mid?.attempted || 0);
    team.fgm2 += (player.shooting?.close?.made || 0) + (player.shooting?.mid?.made || 0);
    team.fga3 += player.shooting?.three?.attempted || 0;
    team.fgm3 += player.shooting?.three?.made || 0;
    team.fta += player.shooting?.freeThrow?.attempted || 0;
    team.ftm += player.shooting?.freeThrow?.made || 0;
    team.oreb += player.rebounds?.offensive || 0;
    team.dreb += player.rebounds?.defensive || 0;
    team.ast += player.assists || 0;
    team.tov += player.turnovers || 0;
    team.stl += player.steals || 0;
    team.blk += player.blocks || 0;
    team.fouls += player.foulsCommitted || 0;
    team.val += (player.valuation || 0) * gamesPlayed;
    teams.set(teamId, team);
  });

  rosterPlayers.forEach(player => {
    if (!player.teamId) return;
    const team = teams.get(player.teamId);
    if (!team) return;

    const fga =
      (player.shooting?.close?.attempted || 0) +
      (player.shooting?.mid?.attempted || 0) +
      (player.shooting?.three?.attempted || 0);
    const usageProxy = fga + 0.44 * (player.shooting?.freeThrow?.attempted || 0) + (player.turnovers || 0);
    const positionInfo = mapPositionInfo(player.position);

    team.roster.push({
      playerId: player.id,
      name: player.name,
      position: positionInfo.position,
      positionBuckets: positionInfo.positionBuckets,
      positionLabel: player.position ?? null,
      rawPosition: player.position ?? null,
      isActive: player.isActive !== false,
      minutes: player.minutes || 0,
      usageProxy,
      heightCm: player.height || undefined,
      roles: rolesByPlayerId.get(player.id) ?? [],
    });
  });

  return Array.from(teams.values());
};
