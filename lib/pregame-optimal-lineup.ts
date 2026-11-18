// Pre-game optimális kezdőötös: a saját keret szerepkör-kiosztása (PG–C), a jelöltötösök
// pontozása egyéni profil z-pontokkal, a szezonos Kosarstat ötös / páros / hármas mintával,
// a megszokott kezdők és a valós rotáció priorjával, valamint az ellenfél-matchup igénye
// (periméter / festék / labdabiztonság) szerint; center-prior felülírással.
// A SeasonComparison-ből kiszervezve (H34/F2b), viselkedésváltozás nélkül. Nem @core modul.
import type { KosarstatTeamLineupAnalysis } from '@/lib/kosarstat-lineup-analysis';
import type { Position } from '@/lib/player-analysis';
import type { PlayerSeasonStat, ScoutingReport } from '@/lib/pregame-scouting';
import {
  average,
  buildNormalizedNameProfile,
  clamp01,
  matchesNormalizedNameProfile,
  roundValue,
  stdDev,
} from '@/lib/season-comparison-helpers';

export type PregameOptimalLineupCandidate = {
  key: string;
  players: PlayerSeasonStat[];
  names: string[];
  roleAssignments: Array<{ playerId: string; name: string; role: Position }>;
  totalScore: number;
  exactSampleMinutes: number;
  exactNetPer40: number | null;
  pairSampleMinutes: number;
  trioSampleMinutes: number;
  certainty: 'high' | 'medium' | 'low';
  reasons: string[];
};

export type PregameOptimalLineupResult = {
  best: PregameOptimalLineupCandidate;
  alternates: PregameOptimalLineupCandidate[];
  candidateCount: number;
  sourceGames: number;
  matchupWeights: {
    perimeter: number;
    paint: number;
    ballSecurity: number;
  };
  headline: string;
};

export type PregameOptimalLineupInputs = {
  pregameReport: ScoutingReport | null;
  /** A saját keret (sérültek nélkül) pre-game szezon-statisztikája. */
  pregameOwnPlayers: PlayerSeasonStat[];
  /** A saját csapat szezonos Kosarstat lineup-összesítése (ötösök, párosok, hármasok, kezdők). */
  seasonKosarstatLineupTeam: KosarstatTeamLineupAnalysis | null;
  seasonKosarstatLineupGames: number;
};

export const buildPregameOptimalLineup = ({
  pregameReport,
  pregameOwnPlayers,
  seasonKosarstatLineupTeam,
  seasonKosarstatLineupGames,
}: PregameOptimalLineupInputs): PregameOptimalLineupResult | null => {
  if (!pregameReport || pregameOwnPlayers.length < 5) return null;

  const lineupSlots: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];

  const getBuckets = (player: PlayerSeasonStat): Position[] => {
    if (player.positionBuckets?.length) return player.positionBuckets as Position[];
    return [player.position as Position];
  };

  const getEligibleSlots = (player: PlayerSeasonStat): Position[] => {
    const buckets = getBuckets(player);
    const slots = new Set<Position>();
    const games = Math.max(player.games || 1, 1);
    const reboundsPerGame = (player.oreb + player.dreb) / games;
    const wingLikeProfile = (player.heightCm ?? 0) >= 194 || reboundsPerGame >= 4.2;

    buckets.forEach(bucket => {
      if (bucket === 'PG') {
        slots.add('PG');
        slots.add('SG');
      }
      if (bucket === 'SG') {
        slots.add('SG');
        if (wingLikeProfile && !buckets.includes('PG')) {
          slots.add('SF');
        }
      }
      if (bucket === 'SF') {
        slots.add('SF');
        slots.add('PF');
      }
      if (bucket === 'PF') slots.add('PF');
      if (bucket === 'C') slots.add('C');
    });

    const assistsPerGame = player.ast / Math.max(player.games || 1, 1);
    if (assistsPerGame >= 4.5 && (slots.has('SG') || buckets.includes('SG'))) {
      slots.add('PG');
    }

    return lineupSlots.filter(slot => slots.has(slot));
  };

  const assignLineupRoles = (players: PlayerSeasonStat[]) => {
    const orderedPlayers = [...players].sort((a, b) => {
      const aEligible = getEligibleSlots(a).length;
      const bEligible = getEligibleSlots(b).length;
      if (aEligible !== bEligible) return aEligible - bEligible;
      return (b.minutes || 0) - (a.minutes || 0);
    });

    const slotFitScore = (player: PlayerSeasonStat, slot: Position) => {
      const buckets = getBuckets(player);
      const games = Math.max(player.games || 1, 1);
      const pointsPer36 = ((player.points || 0) / Math.max(player.minutes || 1, 1)) * 36;
      const assistsPerGame = (player.ast || 0) / games;
      const reboundsPerGame = ((player.oreb || 0) + (player.dreb || 0)) / games;
      const threeVolume = (player.fga3 || 0) / games;
      const threePct = player.fga3 > 0 ? (player.fgm3 / player.fga3) * 100 : 0;
      const height = player.heightCm ?? 0;

      let score = 0;
      if (buckets.includes(slot)) score += 2.2;

      if (slot === 'PG' && buckets.includes('SG')) score += assistsPerGame >= 4 ? 1.0 : 0.35;
      if (slot === 'SG' && buckets.includes('PG')) score += assistsPerGame >= 3 ? 0.7 : 0.4;
      if (slot === 'SF' && buckets.includes('SG')) score += (height >= 194 || reboundsPerGame >= 4.2) ? 0.65 : -0.4;
      if (slot === 'PF' && buckets.includes('SF')) score += reboundsPerGame >= 4 ? 0.7 : 0.25;
      if (slot === 'C' && buckets.includes('PF')) score += (height >= 201 || reboundsPerGame >= 6) ? 0.55 : -0.8;

      if (slot === 'PG') {
        score += assistsPerGame * 0.22;
        score += pointsPer36 >= 12 ? 0.15 : -0.1;
      }
      if (slot === 'SG') {
        score += pointsPer36 * 0.16 + threeVolume * 0.22;
        score += threePct >= 34 ? 0.4 : -0.2;
      }
      if (slot === 'SF') {
        score += pointsPer36 * 0.12 + reboundsPerGame * 0.2;
        score += height >= 195 ? 0.35 : -0.25;
      }
      if (slot === 'PF') {
        score += reboundsPerGame * 0.25;
        score += height >= 198 ? 0.3 : 0;
      }
      if (slot === 'C') {
        score += reboundsPerGame * 0.38;
        score += height >= 202 ? 0.35 : -0.35;
      }

      return score;
    };

    const usedSlots = new Set<Position>();
    const workingAssignments: Array<{ playerId: string; name: string; role: Position }> = [];
    let bestAssignments: Array<{ playerId: string; name: string; role: Position }> = [];
    let bestScore = Number.NEGATIVE_INFINITY;

    const walk = (index: number, score: number) => {
      if (index >= orderedPlayers.length) {
        if (workingAssignments.length === players.length && score > bestScore) {
          bestScore = score;
          bestAssignments = [...workingAssignments];
        }
        return;
      }

      const player = orderedPlayers[index];
      const eligibleSlots = getEligibleSlots(player);
      for (const slot of eligibleSlots) {
        if (usedSlots.has(slot)) continue;
        usedSlots.add(slot);
        workingAssignments.push({ playerId: player.playerId, name: player.name, role: slot });
        walk(index + 1, score + slotFitScore(player, slot));
        workingAssignments.pop();
        usedSlots.delete(slot);
      }
    };

    walk(0, 0);
    if (bestAssignments.length !== players.length) return null;
    return lineupSlots.flatMap(slot => bestAssignments.find(item => item.role === slot) ?? []);
  };

  const playerMatches = (player: PlayerSeasonStat, positions: Position[]) =>
    getBuckets(player).some(position => positions.includes(position));

  const combinations = <T,>(items: T[], size: number): T[][] => {
    const result: T[][] = [];
    const walk = (start: number, current: T[]) => {
      if (current.length === size) {
        result.push([...current]);
        return;
      }
      for (let index = start; index < items.length; index += 1) {
        current.push(items[index]);
        walk(index + 1, current);
        current.pop();
      }
    };
    walk(0, []);
    return result;
  };

  const matchNamesToPlayers = (names: string[]) => {
    const matched: PlayerSeasonStat[] = [];
    const used = new Set<string>();
    for (const name of names) {
      const nameProfile = buildNormalizedNameProfile(name);
      const player = pregameOwnPlayers.find(candidate => (
        !used.has(candidate.playerId)
        && (
          // Kosarstat lineup names and season roster names can differ in token length/order.
          matchesNormalizedNameProfile(candidate.name, [nameProfile])
          || matchesNormalizedNameProfile(name, [buildNormalizedNameProfile(candidate.name)])
        )
      ));
      if (!player) return null;
      used.add(player.playerId);
      matched.push(player);
    }
    return matched;
  };

  const lineupKey = (players: PlayerSeasonStat[]) =>
    [...players].map(player => player.playerId).sort((a, b) => a.localeCompare(b)).join('|');

  const comboKey = (players: PlayerSeasonStat[]) =>
    [...players].map(player => player.playerId).sort((a, b) => a.localeCompare(b)).join('|');

  const confidenceFromEvidence = (minutes: number): 'high' | 'medium' | 'low' => (
    minutes >= 18 ? 'high' : minutes >= 8 ? 'medium' : 'low'
  );

  const metricBase = pregameOwnPlayers.map(player => {
    const minutes = Math.max(player.minutes || 0, 1);
    const games = Math.max(player.games || 0, 1);
    const valPer36 = (player.val / minutes) * 36;
    const pointsPer36 = (player.points / minutes) * 36;
    const astPerGame = player.ast / games;
    const tovPerGame = player.tov / games;
    const astTo = player.tov > 0 ? player.ast / player.tov : player.ast;
    const threePct = player.fga3 > 0 ? (player.fgm3 / player.fga3) * 100 : 0;
    const threeVolume = player.fga3 / games;
    const reboundsPer36 = ((player.oreb + player.dreb) / minutes) * 36;
    const blkPer36 = (player.blk / minutes) * 36;
    const stlPer36 = (player.stl / minutes) * 36;
    return {
      player,
      valPer36,
      pointsPer36,
      astPerGame,
      tovPerGame,
      astTo,
      threePct,
      threeVolume,
      reboundsPer36,
      blkPer36,
      stlPer36,
    };
  });

  const zScore = (value: number, pool: number[]) => {
    const filtered = pool.filter(item => Number.isFinite(item));
    if (filtered.length < 2) return 0;
    const mean = average(filtered);
    const sd = stdDev(filtered);
    if (!Number.isFinite(sd) || sd <= 0.0001) return 0;
    return (value - mean) / sd;
  };

  const valPool = metricBase.map(item => item.valPer36);
  const scoringPool = metricBase.map(item => item.pointsPer36);
  const spacingPool = metricBase.map(item => item.threeVolume * Math.max(item.threePct - 26, 0));
  const creationPool = metricBase.map(item => item.astPerGame * 1.8 + item.astTo * 1.1 - item.tovPerGame * 0.8);
  const rimPool = metricBase.map(item => item.reboundsPer36 * 0.35 + item.blkPer36 * 2.2);
  const securityPool = metricBase.map(item => item.astTo * 1.5 + item.stlPer36 * 0.8 - item.tovPerGame * 0.6);

  const metricByPlayerId = new Map(metricBase.map(item => {
    const spacingRaw = item.threeVolume * Math.max(item.threePct - 26, 0);
    const creationRaw = item.astPerGame * 1.8 + item.astTo * 1.1 - item.tovPerGame * 0.8;
    const rimRaw = item.reboundsPer36 * 0.35 + item.blkPer36 * 2.2;
    const securityRaw = item.astTo * 1.5 + item.stlPer36 * 0.8 - item.tovPerGame * 0.6;
    return [item.player.playerId, {
      talent: zScore(item.valPer36, valPool),
      scoring: zScore(item.pointsPer36, scoringPool),
      spacing: zScore(spacingRaw, spacingPool),
      creation: zScore(creationRaw, creationPool),
      rim: zScore(rimRaw, rimPool),
      security: zScore(securityRaw, securityPool),
      rawThreePct: item.threePct,
      rawThreeVolume: item.threeVolume,
    }] as const;
  }));

  const opponentPerimeterNeed = clamp01(
    (pregameReport.llmContext?.opponentDominantAxis === 'periméter' ? 0.3 : 0)
    + ((pregameReport.profile.offense ?? []).some(item => /periméter/i.test(item)) ? 0.2 : 0)
    + ((pregameReport.shotProfileContext?.opponentTopZones ?? []).some(zone => /tripla/i.test(zone.label)) ? 0.2 : 0)
    + (pregameReport.focusPoints.some(item => /periméter|tripla|closeout/i.test(item)) ? 0.2 : 0)
  );
  const centerDelta = pregameReport.positionComparison.find(item => item.position === 'C')?.deltaValPer36 ?? 0;
  const opponentPaintNeed = clamp01(
    (pregameReport.llmContext?.opponentDominantAxis === 'festék' ? 0.25 : 0)
    + ((pregameReport.shotProfileContext?.clashZones ?? []).includes('Gyűrű') ? 0.25 : 0)
    + (centerDelta <= -4 ? 0.25 : 0)
    + (pregameReport.focusPoints.some(item => /festék|betörés|lepattanó/i.test(item)) ? 0.15 : 0)
  );
  const ballSecurityNeed = clamp01(
    ((pregameReport.profile.defense ?? []).some(item => /labdanyomás/i.test(item)) ? 0.35 : 0)
    + (pregameReport.focusPoints.some(item => /labdabiztonság|nyomás|letámadás/i.test(item)) ? 0.25 : 0)
    + (pregameReport.calibrationDiagnostics?.dimensions.some(item => item.key === 'ball_pressure' && item.score >= 55) ? 0.2 : 0)
  );
  const boundedPerimeterNeed = roundValue(opponentPerimeterNeed * 0.75, 2);
  const boundedPaintNeed = roundValue(opponentPaintNeed * 0.75, 2);
  const boundedBallSecurityNeed = roundValue(ballSecurityNeed * 0.75, 2);

  const naturalCenters = pregameOwnPlayers
    .filter(player => getBuckets(player).includes('C'))
    .map(player => {
      const metric = metricByPlayerId.get(player.playerId);
      return {
        player,
        score: metric
          ? metric.talent * 1.2 + metric.rim * (1.45 + boundedPaintNeed * 1.35) + metric.security * 0.15 + metric.spacing * 0.05
          : -99,
      };
    })
    .sort((a, b) => b.score - a.score);

  const topCenter = naturalCenters[0] ?? null;

  const lineupSource = seasonKosarstatLineupTeam;
  const playerMinutesById = new Map<string, { seconds: number; on40: number | null }>();
  const exactLineupByKey = new Map<string, { seconds: number; netPer40: number }>();
  const pairByKey = new Map<string, { seconds: number; netPer40: number }>();
  const trioByKey = new Map<string, { seconds: number; netPer40: number }>();
  const incumbentStarterIds = new Set<string>();

  if (lineupSource) {
    lineupSource.playerMinutes.forEach(item => {
      const matched = pregameOwnPlayers.find(player => matchesNormalizedNameProfile(item.player, [buildNormalizedNameProfile(player.name)]));
      if (!matched) return;
      playerMinutesById.set(matched.playerId, { seconds: item.seconds, on40: item.on40 });
    });

    lineupSource.stints.forEach(stint => {
      if (stint.players.length !== 5 || stint.seconds <= 0) return;
      const matched = matchNamesToPlayers(stint.players);
      if (!matched || matched.length !== 5) return;
      exactLineupByKey.set(lineupKey(matched), {
        seconds: stint.seconds,
        netPer40: stint.on40 ?? (stint.seconds > 0 ? (stint.plusMinus * 2400) / stint.seconds : 0),
      });
    });

    lineupSource.pairStats.forEach(item => {
      const matched = matchNamesToPlayers(item.players);
      if (!matched || matched.length !== 2) return;
      pairByKey.set(comboKey(matched), { seconds: item.seconds, netPer40: item.netPer40 });
    });

    lineupSource.trioStats.forEach(item => {
      const matched = matchNamesToPlayers(item.players);
      if (!matched || matched.length !== 3) return;
      trioByKey.set(comboKey(matched), { seconds: item.seconds, netPer40: item.netPer40 });
    });

    const matchedStarters = matchNamesToPlayers(lineupSource.starters);
    matchedStarters?.forEach(player => incumbentStarterIds.add(player.playerId));
  }

  const availablePlayersSorted = [...pregameOwnPlayers].sort((a, b) => {
    const aLineupSeconds = playerMinutesById.get(a.playerId)?.seconds ?? 0;
    const bLineupSeconds = playerMinutesById.get(b.playerId)?.seconds ?? 0;
    if (bLineupSeconds !== aLineupSeconds) return bLineupSeconds - aLineupSeconds;
    if ((b.minutes || 0) !== (a.minutes || 0)) return (b.minutes || 0) - (a.minutes || 0);
    return (b.val || 0) - (a.val || 0);
  });

  const candidatePool = availablePlayersSorted.slice(0, Math.min(Math.max(7, pregameOwnPlayers.length), 9));
  const strictValidity = (players: PlayerSeasonStat[]) => {
    const roleAssignments = assignLineupRoles(players);
    if (!roleAssignments) return false;
    const backcourt = players.filter(player => playerMatches(player, ['PG', 'SG'])).length;
    const frontcourt = players.filter(player => playerMatches(player, ['PF', 'C'])).length;
    const wings = players.filter(player => playerMatches(player, ['SG', 'SF'])).length;
    const handlers = players.filter(player => playerMatches(player, ['PG']) || ((player.games || 0) > 0 && (player.ast / Math.max(player.games, 1)) >= 2.5)).length;
    return backcourt >= 2 && frontcourt >= 2 && wings >= 1 && handlers >= 1;
  };
  const relaxedValidity = (players: PlayerSeasonStat[]) => {
    if (!assignLineupRoles(players)) return false;
    const backcourt = players.filter(player => playerMatches(player, ['PG', 'SG'])).length;
    const frontcourt = players.filter(player => playerMatches(player, ['PF', 'C'])).length;
    return backcourt >= 1 && frontcourt >= 1;
  };

  const candidateMap = new Map<string, PlayerSeasonStat[]>();
  combinations(candidatePool, 5)
    .filter(strictValidity)
    .forEach(players => candidateMap.set(lineupKey(players), players));

  if (candidateMap.size === 0) {
    combinations(candidatePool, 5)
      .filter(relaxedValidity)
      .forEach(players => candidateMap.set(lineupKey(players), players));
  }

  if (lineupSource?.starters?.length === 5) {
    const matchedStarters = matchNamesToPlayers(lineupSource.starters);
    if (matchedStarters && matchedStarters.length === 5) {
      candidateMap.set(lineupKey(matchedStarters), matchedStarters);
    }
  }

  [...exactLineupByKey.keys()].forEach(key => {
    if (candidateMap.has(key)) return;
    const players = pregameOwnPlayers.filter(player => key.split('|').includes(player.playerId));
    if (players.length === 5) candidateMap.set(key, players);
  });

  const evaluated = Array.from(candidateMap.values()).map(players => {
    const roleAssignments = assignLineupRoles(players);
    if (!roleAssignments) return null;
    const exactLineup = exactLineupByKey.get(lineupKey(players)) ?? null;
    const exactSampleMinutes = exactLineup ? exactLineup.seconds / 60 : 0;
    const cappedExactNetPer40 = exactLineup ? Math.min(Math.max(exactLineup.netPer40, -35), 35) : 0;
    const exactComponent = exactLineup
      ? cappedExactNetPer40 * (exactLineup.seconds / (exactLineup.seconds + 900)) * 0.9
      : 0;

    const pairSamples = combinations(players, 2)
      .map(pair => pairByKey.get(comboKey(pair)) ?? null)
      .filter((item): item is { seconds: number; netPer40: number } => Boolean(item));
    const trioSamples = combinations(players, 3)
      .map(trio => trioByKey.get(comboKey(trio)) ?? null)
      .filter((item): item is { seconds: number; netPer40: number } => Boolean(item));

    const pairSampleMinutes = pairSamples.reduce((sum, item) => sum + item.seconds, 0) / 60;
    const trioSampleMinutes = trioSamples.reduce((sum, item) => sum + item.seconds, 0) / 60;
    const pairComponent = pairSamples.length > 0
      ? average(pairSamples.map(item => item.netPer40 * (item.seconds / (item.seconds + 240)))) * 0.7
      : 0;
    const trioComponent = trioSamples.length > 0
      ? average(trioSamples.map(item => item.netPer40 * (item.seconds / (item.seconds + 180)))) * 0.5
      : 0;

    const assignedRoleByPlayerId = new Map(roleAssignments.map(item => [item.playerId, item.role] as const));
    const playerFitComponent = average(players.map(player => {
      const metric = metricByPlayerId.get(player.playerId);
      const assignedRole = assignedRoleByPlayerId.get(player.playerId);
      if (!metric || !assignedRole) return 0;

      if (assignedRole === 'PG') {
        return (
          metric.talent * 1.05
          + metric.scoring * 0.2
          + metric.creation * (0.8 + boundedBallSecurityNeed)
          + metric.security * (0.65 + boundedBallSecurityNeed * 0.8)
          + metric.spacing * (0.15 + boundedPerimeterNeed * 0.35)
          + metric.rim * 0.05
        );
      }

      if (assignedRole === 'SG') {
        return (
          metric.talent * 1.05
          + metric.scoring * (0.55 + boundedPerimeterNeed * 0.4)
          + metric.spacing * (0.75 + boundedPerimeterNeed)
          + metric.creation * (0.18 + boundedBallSecurityNeed * 0.28)
          + metric.security * 0.2
          + metric.rim * 0.05
        );
      }

      if (assignedRole === 'SF') {
        return (
          metric.talent * 1.1
          + metric.scoring * (0.45 + boundedPerimeterNeed * 0.25)
          + metric.spacing * (0.5 + boundedPerimeterNeed * 0.6)
          + metric.creation * 0.22
          + metric.security * 0.2
          + metric.rim * (0.2 + boundedPaintNeed * 0.2)
        );
      }

      if (assignedRole === 'PF') {
        return (
          metric.talent * 1.12
          + metric.spacing * (0.28 + boundedPerimeterNeed * 0.35)
          + metric.creation * 0.08
          + metric.security * 0.12
          + metric.rim * (0.75 + boundedPaintNeed * 0.65)
        );
      }

      return (
        metric.talent * 1.2
        + metric.spacing * 0.05
        + metric.creation * 0.05
        + metric.security * 0.16
        + metric.rim * (1.25 + boundedPaintNeed * 1.25)
      );
    })) * 1.95;

    const spacingCount = players.filter(player => {
      const metric = metricByPlayerId.get(player.playerId);
      return (metric?.rawThreePct ?? 0) >= 33 && (metric?.rawThreeVolume ?? 0) >= 1.2;
    }).length;
    const handlerCount = players.filter(player => playerMatches(player, ['PG']) || ((player.ast / Math.max(player.games || 1, 1)) >= 2.5)).length;
    const bigCount = players.filter(player => playerMatches(player, ['PF', 'C'])).length;
    const incumbentOverlap = players.filter(player => incumbentStarterIds.has(player.playerId)).length;
    const lineupMinutes = players.reduce((sum, player) => sum + (playerMinutesById.get(player.playerId)?.seconds ?? 0), 0) / 60;
    const assignedCenter = roleAssignments.find(item => item.role === 'C');
    const assignedCenterMetric = assignedCenter ? metricByPlayerId.get(assignedCenter.playerId) : null;
    const centerAnchorBonus = (() => {
      if (!assignedCenter || !topCenter) return 0;
      if (assignedCenter.playerId === topCenter.player.playerId) return 1.4 + boundedPaintNeed * 0.8;
      const assignedScore = assignedCenterMetric
        ? assignedCenterMetric.talent * 1.2 + assignedCenterMetric.rim * (1.35 + boundedPaintNeed * 1.2)
        : -99;
      const gap = topCenter.score - assignedScore;
      const tacticalFitEdge = assignedCenterMetric
        ? (assignedCenterMetric.spacing * (0.45 + boundedPerimeterNeed)
          + assignedCenterMetric.security * (0.25 + boundedBallSecurityNeed * 0.8))
        : 0;
      const topCenterMetric = metricByPlayerId.get(topCenter.player.playerId);
      const topTacticalFit = topCenterMetric
        ? (topCenterMetric.spacing * (0.45 + boundedPerimeterNeed)
          + topCenterMetric.security * (0.25 + boundedBallSecurityNeed * 0.8))
        : 0;
      const tacticalGap = tacticalFitEdge - topTacticalFit;
      if (gap >= 1.1) return -2.4;
      if (gap >= 0.6 && tacticalGap >= 0.45) return -0.45;
      if (gap >= 0.6) return -1.4;
      if (gap >= 0.25 && tacticalGap >= 0.35) return -0.25;
      if (gap >= 0.25) return -0.7;
      return -0.15;
    })();

    let structureBonus = 0;
    if (spacingCount >= 2) structureBonus += 0.7 + boundedPerimeterNeed * 1.1;
    if (handlerCount >= 2) structureBonus += 0.45 + boundedBallSecurityNeed * 0.9;
    if (bigCount >= 2) structureBonus += 0.4 + boundedPaintNeed * 0.95;
    if (strictValidity(players)) structureBonus += 0.4;
    structureBonus += centerAnchorBonus;

    const lineupBalancePenalty = (() => {
      const pgRole = roleAssignments.find(item => item.role === 'PG') ?? null;
      const sgRole = roleAssignments.find(item => item.role === 'SG') ?? null;
      const sfRole = roleAssignments.find(item => item.role === 'SF') ?? null;
      if (!pgRole || !sgRole) return 0;

      const pgPlayer = players.find(player => player.playerId === pgRole.playerId) || null;
      const sgPlayer = players.find(player => player.playerId === sgRole.playerId) || null;
      if (!pgPlayer || !sgPlayer) return 0;

      const pgMetric = metricByPlayerId.get(pgRole.playerId);
      const sgMetric = metricByPlayerId.get(sgRole.playerId);
      const sfMetric = sfRole ? metricByPlayerId.get(sfRole.playerId) : null;
      if (!pgMetric || !sgMetric) return 0;

      const dualPgBackcourt = getBuckets(pgPlayer).includes('PG') && getBuckets(sgPlayer).includes('PG');
      const lowScoringBackcourt = (pgMetric.scoring + sgMetric.scoring) <= -0.25;
      const lowSpacingBackcourt = (pgMetric.spacing + sgMetric.spacing) <= -0.2;
      const sfCanCarryScoring = Boolean(sfMetric && (sfMetric.scoring >= 0.35 || sfMetric.spacing >= 0.35));
      const smallBackcourt = (pgPlayer.heightCm ?? 0) > 0
        && (sgPlayer.heightCm ?? 0) > 0
        && (pgPlayer.heightCm ?? 0) <= 191
        && (sgPlayer.heightCm ?? 0) <= 191;

      let penalty = 0;
      if (dualPgBackcourt && lowScoringBackcourt && lowSpacingBackcourt && !sfCanCarryScoring) {
        penalty -= 1.8 + boundedPerimeterNeed * 0.9;
      } else if (dualPgBackcourt && lowScoringBackcourt && !sfCanCarryScoring) {
        penalty -= 1.0 + boundedPerimeterNeed * 0.55;
      }
      if (smallBackcourt && boundedPerimeterNeed >= 0.45) {
        penalty -= 0.45;
      }
      return penalty;
    })();

    const continuityBonus = (() => {
      let bonus = 0;
      if (incumbentStarterIds.size > 0) {
        if (incumbentOverlap >= 5) bonus += 2.2;
        else if (incumbentOverlap === 4) bonus += 1.5;
        else if (incumbentOverlap === 3) bonus += 0.7;
        else if (incumbentOverlap <= 2) bonus -= 0.8;
      }
      if (lineupMinutes >= 95) bonus += 1.1;
      else if (lineupMinutes >= 75) bonus += 0.7;
      else if (lineupMinutes <= 35) bonus -= 0.5;
      return bonus;
    })();

    const totalScore = roundValue(
      exactComponent * 1.1 + pairComponent + trioComponent + playerFitComponent + structureBonus + continuityBonus + lineupBalancePenalty,
      2
    );

    const evidenceMinutes = exactSampleMinutes + pairSampleMinutes * 0.18 + trioSampleMinutes * 0.14;
    const certainty = confidenceFromEvidence(evidenceMinutes);

    const reasons: string[] = [];
    if (exactSampleMinutes >= 4) reasons.push(`van közvetlen szezonos ötösminta (${exactSampleMinutes.toFixed(1)} perc)`);
    if (pairSampleMinutes >= 14) reasons.push(`erős páros szinergiák támasztják (${pairSampleMinutes.toFixed(1)} párosperc)`);
    if (incumbentOverlap >= 4) reasons.push('közel marad a megszokott kezdőszerkezethez, ezért rotációsan reálisabb');
    if (opponentPerimeterNeed >= 0.55 && spacingCount >= 2) reasons.push('jobban nyitja a pályát a periméterfókuszú matchupban');
    if (ballSecurityNeed >= 0.55 && handlerCount >= 2) reasons.push('stabilabb labdakezelést ad nyomás ellen');
    if (opponentPaintNeed >= 0.55 && bigCount >= 2) reasons.push('több festékfizikalitást és lepattanót hoz');
    if (reasons.length === 0) reasons.push('a kis mintát egyéni profil és rész-szinergiák felé shrinkeli a modell');

    return {
      key: lineupKey(players),
      players,
      names: roleAssignments.map(item => item.name),
      roleAssignments,
      totalScore,
      exactSampleMinutes: roundValue(exactSampleMinutes, 1),
      exactNetPer40: exactLineup ? roundValue(exactLineup.netPer40, 1) : null,
      pairSampleMinutes: roundValue(pairSampleMinutes, 1),
      trioSampleMinutes: roundValue(trioSampleMinutes, 1),
      certainty,
      reasons: reasons.slice(0, 3),
    } satisfies PregameOptimalLineupCandidate;
  })
    .filter((item): item is PregameOptimalLineupCandidate => Boolean(item))
    .sort((a, b) => b.totalScore - a.totalScore || b.exactSampleMinutes - a.exactSampleMinutes || b.pairSampleMinutes - a.pairSampleMinutes);

  if (evaluated.length === 0) return null;

  const strongestCenterLineup = topCenter
    ? evaluated.find(item => item.roleAssignments.some(role => role.role === 'C' && role.playerId === topCenter.player.playerId)) ?? null
    : null;

  const centerOverrideCandidate = (() => {
    if (!topCenter || !strongestCenterLineup) return null;
    const provisionalBest = evaluated[0];
    const provisionalCenter = provisionalBest.roleAssignments.find(role => role.role === 'C');
    if (!provisionalCenter || provisionalCenter.playerId === topCenter.player.playerId) return null;

    const scoreGap = provisionalBest.totalScore - strongestCenterLineup.totalScore;
    const exactMinutesGap = provisionalBest.exactSampleMinutes - strongestCenterLineup.exactSampleMinutes;
    const pairMinutesGap = provisionalBest.pairSampleMinutes - strongestCenterLineup.pairSampleMinutes;
    const trioMinutesGap = provisionalBest.trioSampleMinutes - strongestCenterLineup.trioSampleMinutes;

    const hasStrongExactEvidence = provisionalBest.exactSampleMinutes >= 8 && exactMinutesGap >= 5;
    const hasStrongSynergyEdge = pairMinutesGap >= 18 || trioMinutesGap >= 12;
    const hasClearOverallEdge = scoreGap >= 3.2;

    const centerTacticalScore = (candidate: PregameOptimalLineupCandidate) => {
      const centerRole = candidate.roleAssignments.find(role => role.role === 'C');
      if (!centerRole) return -99;
      const metric = metricByPlayerId.get(centerRole.playerId);
      if (!metric) return -99;
      return metric.spacing * (0.55 + boundedPerimeterNeed * 1.1)
        + metric.security * (0.25 + boundedBallSecurityNeed * 0.9)
        + metric.talent * 0.35;
    };

    const tacticalScoreGap = centerTacticalScore(provisionalBest) - centerTacticalScore(strongestCenterLineup);
    const hasTacticalCenterEdge = tacticalScoreGap >= 0.5 && scoreGap >= 1.4;
    const hasAdequateEvidenceForTacticalEdge = provisionalBest.exactSampleMinutes >= 6 || provisionalBest.pairSampleMinutes >= 55 || provisionalBest.trioSampleMinutes >= 30;

    if (hasClearOverallEdge && hasStrongExactEvidence && hasStrongSynergyEdge) {
      return null;
    }
    if (hasTacticalCenterEdge && hasAdequateEvidenceForTacticalEdge) {
      return null;
    }

    return strongestCenterLineup;
  })();

  const best = centerOverrideCandidate ?? evaluated[0];
  const alternates = evaluated.filter(item => item.key !== best.key).slice(0, 2);
  const primaryNeed = opponentPerimeterNeed >= opponentPaintNeed && opponentPerimeterNeed >= ballSecurityNeed
    ? 'periméter'
    : opponentPaintNeed >= ballSecurityNeed
      ? 'festék'
      : 'labdabiztonság';

  return {
    best,
    alternates,
    candidateCount: evaluated.length,
    sourceGames: seasonKosarstatLineupGames,
    matchupWeights: {
      perimeter: roundValue(boundedPerimeterNeed * 100, 0),
      paint: roundValue(boundedPaintNeed * 100, 0),
      ballSecurity: roundValue(boundedBallSecurityNeed * 100, 0),
    },
    headline: centerOverrideCandidate
      ? `A modell elsődleges matchup-fókusza most a ${primaryNeed}, de a legerősebb természetes center csak erős mintabeli fölénnyel szorítható ki, ezért itt a center-prior felülírta a puszta rotációs kényelmet.`
      : `A modell elsődleges matchup-fókusza most a ${primaryNeed}, de a valós rotációhoz közeli szerkezetet és a megszokott kezdők priorját is külön visszasúlyozza.`
  };
};
