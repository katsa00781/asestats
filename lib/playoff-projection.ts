// Bajnoki előrejelzés és rájátszás-szimuláció: a projekció sor- és párharc-típusai,
// a győzelmi valószínűség bizonyossági címkéje és a best-of párharc kimenet-eloszlása.
// A csapat-erősség (`buildProjectionStrengthByTeamKey`) és a rájátszás-szimuláció
// (`buildPlayoffProjection`) a H34/F2a-ban került ide.
// A SeasonComparison-ből kiszervezve (H34/F1c, F2a), viselkedésváltozás nélkül. Nem @core modul.
import type { TeamSeasonStat as PregameTeamSeasonStat } from '@/lib/pregame-scouting';
import type { TeamGameScore, TeamSeasonStat } from '@/lib/team-analysis';
import { blendPregameTeamStats, computeRecentBlendWeight, sumPointsAgainst } from '@/lib/pregame-blend';
import type { GamePlayerStatRow } from '@/lib/season-comparison-helpers';
import { average, clamp01, normalizeTeamKey, stdDev } from '@/lib/season-comparison-helpers';

export type ProjectionRow = {
  team: string;
  currentWins: number;
  currentLosses: number;
  projectedWins: number;
  projectedLosses: number;
  expectedExtraWins: number;
  expectedFinalPoints: number;
  avgWinProbability: number;
  certaintyLabel: 'Magas' | 'Közepes' | 'Alacsony';
  certaintyScore: number;
};

export type PlayoffSeriesProjection = {
  seriesKey: string;
  round: 'Negyeddöntő' | 'Elődöntő' | 'Döntő' | 'Bronz' | '5-8 helyosztó elődöntő' | '5. helyért' | '7. helyért';
  homeSeed: number;
  awaySeed: number;
  homeTeam: string;
  awayTeam: string;
  homeWinProbability: number;
  awayWinProbability: number;
  winner: string;
  loser: string;
  mostLikelyScore: string;
  certaintyLabel: 'Magas' | 'Közepes' | 'Alacsony';
  manualOverride: boolean;
};

export type ProjectionUpcomingGame = {
  fixtureId: string;
  gameDate: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamKey: string;
  awayTeamKey: string;
  homeWinProbabilityModel: number;
  awayWinProbabilityModel: number;
  homeWinProbabilityApplied: number;
  awayWinProbabilityApplied: number;
  certaintyApplied: number;
  overrideWinnerSide: 'home' | 'away' | null;
};

export type PlayoffProjectionResult = {
  champion: string;
  runnerUp: string;
  third: string;
  fourth: string;
  finalRanking: Array<{ position: number; team: string; note?: string }>;
  series: PlayoffSeriesProjection[];
};

export const probabilityLabel = (value: number): 'Magas' | 'Közepes' | 'Alacsony' => {
  if (value >= 0.68 || value <= 0.32) return 'Magas';
  if (value >= 0.58 || value <= 0.42) return 'Közepes';
  return 'Alacsony';
};

export const bestOfSeriesOutcome = (gameProbabilities: number[], winsNeeded: number) => {
  const scoreProbabilities = new Map<string, number>();

  const walk = (gameIndex: number, homeWins: number, awayWins: number, probability: number) => {
    if (homeWins >= winsNeeded || awayWins >= winsNeeded || gameIndex >= gameProbabilities.length) {
      if (homeWins >= winsNeeded || awayWins >= winsNeeded) {
        const key = `${homeWins}-${awayWins}`;
        scoreProbabilities.set(key, (scoreProbabilities.get(key) || 0) + probability);
      }
      return;
    }

    const pHome = clamp01(gameProbabilities[gameIndex] ?? 0.5);
    walk(gameIndex + 1, homeWins + 1, awayWins, probability * pHome);
    walk(gameIndex + 1, homeWins, awayWins + 1, probability * (1 - pHome));
  };

  walk(0, 0, 0, 1);

  let homeSeriesWinProbability = 0;
  let mostLikelyHomeWinScore: string | null = null;
  let mostLikelyAwayWinScore: string | null = null;
  let mostLikelyHomeWinProbability = -1;
  let mostLikelyAwayWinProbability = -1;

  scoreProbabilities.forEach((probability, score) => {
    const [home, away] = score.split('-').map(value => Number(value));
    if (home > away) {
      homeSeriesWinProbability += probability;
      if (probability > mostLikelyHomeWinProbability) {
        mostLikelyHomeWinProbability = probability;
        mostLikelyHomeWinScore = score;
      }
    } else {
      if (probability > mostLikelyAwayWinProbability) {
        mostLikelyAwayWinProbability = probability;
        mostLikelyAwayWinScore = score;
      }
    }
  });

  return {
    homeSeriesWinProbability: clamp01(homeSeriesWinProbability),
    mostLikelyHomeWinScore,
    mostLikelyAwayWinScore,
  };
};

export type StandingsSnapshotRow = {
  team: string;
  matches: number;
  wins: number;
  losses: number;
  scored: number;
  conceded: number;
  points: number;
};

/** Két csapat egymás elleni mérlege a szezonban; a pár kulcsa a két név-kulcs ábécérendben (`a__b`). */
export type HeadToHeadRecord = {
  teamAKey: string;
  teamBKey: string;
  teamAName: string;
  teamBName: string;
  games: number;
  teamAWins: number;
  teamBWins: number;
  teamAPoints: number;
  teamBPoints: number;
};

/** Az utolsó (legfeljebb 5) lejátszott meccs formája: győzelmi arány és meccsenkénti pontkülönbség. */
export type TeamRecentFormSnapshot = {
  winRate: number;
  netPerGame: number;
};

export type ProjectionStrengthInputs = {
  teamSeasonStats: TeamSeasonStat[];
  playerGameStats: GamePlayerStatRow[];
  playerTeamMap: Map<string, string>;
  recentGameIdsByTeam: Map<string, string[]>;
  leagueGameScores: { byGame: Map<string, TeamGameScore> };
  /** Ennyi friss meccstől számít a csapat friss formája a keverésbe. */
  minRecentGames: number;
  /** A forgatókönyv friss-forma szorzója (Alap / Forma-követő / Upset-figyelő). */
  recentWeightMultiplier: number;
  standingsSnapshot: StandingsSnapshotRow[];
  recentFormByTeamKey: Map<string, TeamRecentFormSnapshot>;
  scheduleStrengthByTeamKey: Map<string, { combined: number }>;
  /** What-if: csapatonkénti kézi erősség-korrekció (név-kulcs → érték). */
  whatIfTeamAdjustments: Record<string, number>;
};

/**
 * Csapat-erősség (z-pont skála) név-kulcs szerint a bajnoki előrejelzéshez: szezon + friss
 * forma keverésű statprofil, tabella-mérleg, formaigazítás, menetrend-erősség és a what-if
 * kézi korrekció együtt.
 */
export const buildProjectionStrengthByTeamKey = ({
  teamSeasonStats,
  playerGameStats,
  playerTeamMap,
  recentGameIdsByTeam,
  leagueGameScores,
  minRecentGames,
  recentWeightMultiplier,
  standingsSnapshot,
  recentFormByTeamKey,
  scheduleStrengthByTeamKey,
  whatIfTeamAdjustments,
}: ProjectionStrengthInputs): Map<string, number> => {
  const recentSnapshotByTeamId = new Map<string, PregameTeamSeasonStat>();
  teamSeasonStats.forEach(team => {
    const recentGameIds = recentGameIdsByTeam.get(team.teamId) ?? [];
    if (recentGameIds.length < minRecentGames) return;
    const recentGameSet = new Set(recentGameIds);

    const totals = {
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
    };

    playerGameStats.forEach(row => {
      if (!recentGameSet.has(row.game_id)) return;
      const rowTeamId = row.players?.team_id ?? playerTeamMap.get(row.player_id);
      if (rowTeamId !== team.teamId) return;

      totals.pointsFor += row.points || 0;
      totals.fga2 += (row.close_attempted || 0) + (row.mid_attempted || 0);
      totals.fgm2 += (row.close_made || 0) + (row.mid_made || 0);
      totals.fga3 += row.three_attempted || 0;
      totals.fgm3 += row.three_made || 0;
      totals.fta += row.free_throw_attempted || 0;
      totals.ftm += row.free_throw_made || 0;
      totals.oreb += row.offensive_rebounds || 0;
      totals.dreb += row.defensive_rebounds || 0;
      totals.ast += row.assists || 0;
      totals.tov += row.turnovers || 0;
      totals.stl += row.steals || 0;
      totals.blk += row.blocks || 0;
      totals.fouls += row.fouls_committed || 0;
      totals.val += row.valuation || 0;
    });

    const { pointsAgainst, countedGames } = sumPointsAgainst(team.teamId, recentGameIds, leagueGameScores.byGame);

    const gamesCount = countedGames > 0 ? countedGames : recentGameIds.length;

    recentSnapshotByTeamId.set(team.teamId, {
      teamId: team.teamId,
      teamName: team.teamName,
      league: team.league,
      season: team.season,
      games: gamesCount,
      pointsFor: totals.pointsFor,
      pointsAgainst,
      fga2: totals.fga2,
      fgm2: totals.fgm2,
      fga3: totals.fga3,
      fgm3: totals.fgm3,
      fta: totals.fta,
      ftm: totals.ftm,
      oreb: totals.oreb,
      dreb: totals.dreb,
      ast: totals.ast,
      tov: totals.tov,
      stl: totals.stl,
      blk: totals.blk,
      fouls: totals.fouls,
      val: totals.val,
    });
  });

  const teamMetrics = teamSeasonStats.map(team => {
    const seasonBase: PregameTeamSeasonStat = {
      teamId: team.teamId,
      teamName: team.teamName,
      league: team.league,
      season: team.season,
      games: team.games,
      pointsFor: team.pointsFor,
      pointsAgainst: team.pointsAgainst,
      fga2: team.fga2,
      fgm2: team.fgm2,
      fga3: team.fga3,
      fgm3: team.fgm3,
      fta: team.fta,
      ftm: team.ftm,
      oreb: team.oreb,
      dreb: team.dreb,
      ast: team.ast,
      tov: team.tov,
      stl: team.stl,
      blk: team.blk,
      fouls: team.fouls,
      val: team.val,
    };

    const recentSnapshot = recentSnapshotByTeamId.get(team.teamId);
    const blended = (() => {
      if (!recentSnapshot) return seasonBase;
      const baseRecentWeight = computeRecentBlendWeight(recentSnapshot.games || 0, seasonBase.games || 0);
      const adjustedRecentWeight = Math.min(
        0.9,
        Math.max(0, baseRecentWeight * recentWeightMultiplier)
      );
      if (adjustedRecentWeight <= 0) return seasonBase;
      return blendPregameTeamStats(seasonBase, recentSnapshot, adjustedRecentWeight);
    })();

    const gamesPlayed = Math.max(1, blended.games || 0);
    const fga = (blended.fga2 || 0) + (blended.fga3 || 0);
    const fgm = (blended.fgm2 || 0) + (blended.fgm3 || 0);
    const possessions = Math.max(1, fga + 0.44 * (blended.fta || 0) + (blended.tov || 0));

    return {
      key: normalizeTeamKey(team.teamName),
      netRatingPerGame: ((blended.pointsFor || 0) - (blended.pointsAgainst || 0)) / gamesPlayed,
      efg: fga > 0 ? ((fgm + 0.5 * (blended.fgm3 || 0)) / fga) * 100 : 0,
      astToTov: (blended.ast || 0) / Math.max(1, blended.tov || 0),
      reboundsPerGame: ((blended.oreb || 0) + (blended.dreb || 0)) / gamesPlayed,
      defensiveActivityPerGame: ((blended.stl || 0) + (blended.blk || 0)) / gamesPlayed,
      turnoverRate: (blended.tov || 0) / possessions,
    };
  });

  const z = (value: number, values: number[]) => {
    if (values.length === 0) return 0;
    const mean = average(values);
    const sd = stdDev(values);
    if (!Number.isFinite(sd) || sd === 0) return 0;
    return (value - mean) / sd;
  };

  const netValues = teamMetrics.map(item => item.netRatingPerGame);
  const efgValues = teamMetrics.map(item => item.efg);
  const astToTovValues = teamMetrics.map(item => item.astToTov);
  const rebValues = teamMetrics.map(item => item.reboundsPerGame);
  const defActValues = teamMetrics.map(item => item.defensiveActivityPerGame);
  const tovRateValues = teamMetrics.map(item => item.turnoverRate);

  const statsStrength = new Map(
    teamMetrics.map(metric => {
      const score =
        0.4 * z(metric.netRatingPerGame, netValues)
        + 0.2 * z(metric.efg, efgValues)
        + 0.15 * z(metric.astToTov, astToTovValues)
        + 0.1 * z(metric.reboundsPerGame, rebValues)
        + 0.1 * z(metric.defensiveActivityPerGame, defActValues)
        - 0.05 * z(metric.turnoverRate, tovRateValues);

      return [metric.key, score] as const;
    })
  );

  const standingsBase = standingsSnapshot
    .map(row => {
      const matches = Math.max(1, row.matches || 0);
      return {
        key: normalizeTeamKey(row.team),
        netPerGame: ((row.scored || 0) - (row.conceded || 0)) / matches,
        winRate: (row.wins || 0) / Math.max(1, (row.wins || 0) + (row.losses || 0)),
      };
    })
    .filter(item => item.key.length > 0);

  const standingNetValues = standingsBase.map(item => item.netPerGame);
  const standingWinValues = standingsBase.map(item => item.winRate);
  const standingsStrength = new Map(
    standingsBase.map(item => {
      const score = 0.6 * z(item.netPerGame, standingNetValues) + 0.4 * z(item.winRate, standingWinValues);
      return [item.key, score] as const;
    })
  );

  const merged = new Map<string, number>();
  const keys = new Set<string>([...standingsStrength.keys(), ...statsStrength.keys()]);
  keys.forEach(key => {
    const standing = standingsStrength.get(key);
    const stats = statsStrength.get(key);
    const blendedCore = standing !== undefined && stats !== undefined
      ? stats * 0.65 + standing * 0.35
      : stats ?? standing ?? 0;
    const form = recentFormByTeamKey.get(key);
    const formAdjustment = form
      ? ((form.winRate - 0.5) * 0.9) + Math.max(-1, Math.min(1, form.netPerGame / 10)) * 0.35
      : 0;
    const scheduleStrength = scheduleStrengthByTeamKey.get(key)?.combined ?? 0;
    const blended = blendedCore + formAdjustment * 0.35 + scheduleStrength * 0.22;
    const manualAdjustment = whatIfTeamAdjustments[key] ?? 0;
    merged.set(key, blended + manualAdjustment);
  });

  return merged;
};

export type PlayoffProjectionInputs = {
  /** A várható alapszakasz-végeredmény, sorrendben (a 9. helytől alapszakasz szerint). */
  projectedStandings: Array<Pick<ProjectionRow, 'team' | 'projectedWins' | 'projectedLosses'>>;
  projectionHomeAdvantage: number;
  projectionLogisticDivisor: number;
  projectionStrengthByTeamKey: Map<string, number>;
  recentFormByTeamKey: Map<string, TeamRecentFormSnapshot>;
  headToHeadByPair: Map<string, HeadToHeadRecord>;
  /** Kézi párharc-győztes (`<forduló>-<hazai seed>-<vendég seed>` → oldal). */
  playoffSeriesWinnerOverrides: Partial<Record<string, 'home' | 'away'>>;
};

/**
 * Rájátszás-szimuláció a várható alapszakasz-végeredmény első 8 helyezettjével: negyeddöntő,
 * elődöntő, döntő, bronz és az 5–8. helyosztók (best-of-5, 1-2-1-2-1 pályaelőny), végső
 * sorrend. 8-nál kevesebb csapatnál `null`.
 */
export const buildPlayoffProjection = ({
  projectedStandings,
  projectionHomeAdvantage,
  projectionLogisticDivisor,
  projectionStrengthByTeamKey,
  recentFormByTeamKey,
  headToHeadByPair,
  playoffSeriesWinnerOverrides,
}: PlayoffProjectionInputs): PlayoffProjectionResult | null => {
  if (projectedStandings.length < 8) return null;

  const topEight = projectedStandings.slice(0, 8).map((row, index) => ({
    ...row,
    seed: index + 1,
    key: normalizeTeamKey(row.team),
    standing: row.projectedWins / Math.max(1, row.projectedWins + row.projectedLosses),
  }));

  const bySeed = new Map(topEight.map(row => [row.seed, row]));
  const teamStrength = (seed: number) => {
    const row = bySeed.get(seed);
    if (!row) return 0;
    const base = projectionStrengthByTeamKey.get(row.key) ?? 0;
    const recent = recentFormByTeamKey.get(row.key);
    const recentAdj = recent
      ? ((recent.winRate - 0.5) * 0.85) + Math.max(-1, Math.min(1, recent.netPerGame / 10)) * 0.3
      : 0;
    return base + (row.standing - 0.5) * 0.8 + recentAdj * 0.4;
  };

  const singleGameHomeWinProbability = (homeSeed: number, awaySeed: number, homeAdvantageSign: 1 | -1) => {
    const home = bySeed.get(homeSeed);
    const away = bySeed.get(awaySeed);
    if (!home || !away) return 0.5;
    const [teamAKey, teamBKey] = [home.key, away.key].sort((a, b) => a.localeCompare(b));
    const h2h = headToHeadByPair.get(`${teamAKey}__${teamBKey}`);
    const h2hAdj = (() => {
      if (!h2h || h2h.games < 1) return 0;
      const homeIsTeamA = h2h.teamAKey === home.key;
      const homeWins = homeIsTeamA ? h2h.teamAWins : h2h.teamBWins;
      const awayWins = homeIsTeamA ? h2h.teamBWins : h2h.teamAWins;
      const homePts = homeIsTeamA ? h2h.teamAPoints : h2h.teamBPoints;
      const awayPts = homeIsTeamA ? h2h.teamBPoints : h2h.teamAPoints;
      const winEdge = (homeWins - awayWins) / Math.max(1, h2h.games);
      const netEdge = (homePts - awayPts) / Math.max(1, h2h.games);
      return winEdge * 0.28 + Math.max(-1, Math.min(1, netEdge / 12)) * 0.12;
    })();

    const delta = teamStrength(homeSeed) - teamStrength(awaySeed) + h2hAdj + projectionHomeAdvantage * homeAdvantageSign;
    return clamp01(1 / (1 + Math.exp(-delta / projectionLogisticDivisor)));
  };

  const simulateSeries = (
    round: PlayoffSeriesProjection['round'],
    homeSeed: number,
    awaySeed: number
  ): PlayoffSeriesProjection => {
    const home = bySeed.get(homeSeed);
    const away = bySeed.get(awaySeed);
    if (!home || !away) {
      throw new Error('Playoff széria számításhoz hiányzó seed.');
    }

    const homeCourtPattern: Array<1 | -1> = [1, -1, 1, -1, 1];
    const gameProbabilities = homeCourtPattern.map(sign => singleGameHomeWinProbability(homeSeed, awaySeed, sign));
    const seriesOutcome = bestOfSeriesOutcome(gameProbabilities, 3);
    const seriesKey = `${round}-${homeSeed}-${awaySeed}`;
    const manualWinnerSide = playoffSeriesWinnerOverrides[seriesKey] ?? null;
    const homeSeriesWinProbability = manualWinnerSide === 'home' ? 1 : manualWinnerSide === 'away' ? 0 : seriesOutcome.homeSeriesWinProbability;
    const awaySeriesWinProbability = 1 - homeSeriesWinProbability;
    const homeWinsSeries = homeSeriesWinProbability >= awaySeriesWinProbability;
    const mostLikelyScore = homeWinsSeries
      ? (seriesOutcome.mostLikelyHomeWinScore ?? '3-2')
      : (seriesOutcome.mostLikelyAwayWinScore ?? '2-3');

    return {
      seriesKey,
      round,
      homeSeed,
      awaySeed,
      homeTeam: home.team,
      awayTeam: away.team,
      homeWinProbability: homeSeriesWinProbability,
      awayWinProbability: awaySeriesWinProbability,
      winner: homeWinsSeries ? home.team : away.team,
      loser: homeWinsSeries ? away.team : home.team,
      mostLikelyScore,
      certaintyLabel: probabilityLabel(Math.max(homeSeriesWinProbability, awaySeriesWinProbability)),
      manualOverride: manualWinnerSide !== null,
    };
  };

  const qf1 = simulateSeries('Negyeddöntő', 1, 8);
  const qf2 = simulateSeries('Negyeddöntő', 2, 7);
  const qf3 = simulateSeries('Negyeddöntő', 3, 6);
  const qf4 = simulateSeries('Negyeddöntő', 4, 5);

  const seedOf = (team: string) => topEight.find(item => item.team === team)?.seed ?? 99;
  const sfASeeds = [seedOf(qf1.winner), seedOf(qf4.winner)].sort((a, b) => a - b);
  const sfBSeeds = [seedOf(qf2.winner), seedOf(qf3.winner)].sort((a, b) => a - b);

  const sf1 = simulateSeries('Elődöntő', sfASeeds[0], sfASeeds[1]);
  const sf2 = simulateSeries('Elődöntő', sfBSeeds[0], sfBSeeds[1]);

  const finalSeeds = [seedOf(sf1.winner), seedOf(sf2.winner)].sort((a, b) => a - b);
  const bronzeSeeds = [seedOf(sf1.loser), seedOf(sf2.loser)].sort((a, b) => a - b);

  const finalSeries = simulateSeries('Döntő', finalSeeds[0], finalSeeds[1]);
  const bronzeSeries = simulateSeries('Bronz', bronzeSeeds[0], bronzeSeeds[1]);

  const placeSemiASeeds = [seedOf(qf1.loser), seedOf(qf4.loser)].sort((a, b) => a - b);
  const placeSemiBSeeds = [seedOf(qf2.loser), seedOf(qf3.loser)].sort((a, b) => a - b);

  const placeSemiA = simulateSeries('5-8 helyosztó elődöntő', placeSemiASeeds[0], placeSemiASeeds[1]);
  const placeSemiB = simulateSeries('5-8 helyosztó elődöntő', placeSemiBSeeds[0], placeSemiBSeeds[1]);

  const place5Seeds = [seedOf(placeSemiA.winner), seedOf(placeSemiB.winner)].sort((a, b) => a - b);
  const place7Seeds = [seedOf(placeSemiA.loser), seedOf(placeSemiB.loser)].sort((a, b) => a - b);

  const place5Series = simulateSeries('5. helyért', place5Seeds[0], place5Seeds[1]);
  const place7Series = simulateSeries('7. helyért', place7Seeds[0], place7Seeds[1]);

  const finalRanking: Array<{ position: number; team: string; note?: string }> = [
    { position: 1, team: finalSeries.winner, note: 'Bajnok' },
    { position: 2, team: finalSeries.loser, note: 'Döntős' },
    { position: 3, team: bronzeSeries.winner, note: 'Bronzérmes' },
    { position: 4, team: bronzeSeries.loser, note: '4. hely' },
    { position: 5, team: place5Series.winner, note: '5. helyért győztes' },
    { position: 6, team: place5Series.loser, note: '5. helyért vesztes' },
    { position: 7, team: place7Series.winner, note: '7. helyért győztes' },
    { position: 8, team: place7Series.loser, note: '7. helyért vesztes' },
    ...projectedStandings.slice(8).map((row, index) => ({
      position: index + 9,
      team: row.team,
      note: 'Alapszakasz alapján',
    })),
  ];

  return {
    champion: finalSeries.winner,
    runnerUp: finalSeries.loser,
    third: bronzeSeries.winner,
    fourth: bronzeSeries.loser,
    finalRanking,
    series: [qf1, qf2, qf3, qf4, sf1, sf2, finalSeries, bronzeSeries, placeSemiA, placeSemiB, place5Series, place7Series],
  };
};
