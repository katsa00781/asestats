// Játékos haladó blokkjai a Játékos nézethez: dobásminőség vs. értékesítés (dobástérkép vs. liga),
// matchup- és terhelés-bontás, szerepkör-hatékonyság, clutch-identitás, lineup on/off és párosok,
// stabilitás, fáradás, blokk-verdiktek a mintaküszöbökkel és a küszöb-magyarázatok. Az arányok
// összegből (`aggregatePlayerGames`). A SeasonComparison-ből kiszervezve (H34/F2e),
// viselkedésváltozás nélkül. Nem @core modul.
import type { PlayerStats, TeamGame } from '@/lib/dashboard-types';
import {
  CLUTCH_MIN_GAMES_FOR_VERDICT,
  buildAggregatedKosarstatPlayerClutchContext,
  type KosarstatParsedClutchGame,
} from '@/lib/kosarstat-clutch-context';
import type { KosarstatTeamLineupAnalysis } from '@/lib/kosarstat-lineup-analysis';
import type { PlayerAnalysis } from '@/lib/player-analysis';
import { aggregatePlayerGames, type PlayerGameLine } from '@/lib/player-game-aggregate';
import { resolvePlayerNames } from '@/lib/player-name-match';
import type { GamePlayerStatRow } from '@/lib/season-comparison-helpers';
import {
  buildNormalizedNameProfile,
  formatNullableNumber,
  matchesNormalizedNameProfile,
  normalizeTeamKey,
  roundValue,
  stdDev,
} from '@/lib/season-comparison-helpers';
import type { ShotProfileSummary, ShotZoneKey } from '@/lib/shot-profile';

/** A szerepkör-csoport (ball-handler / off-ball / magas 3PA / gyűrűnyomás) ennyi meccstől számít a verdiktbe. */
export const ROLE_MIN_GAMES_FOR_VERDICT = 3;
/** A lineup on/off verdikt a játszott percek legalább ekkora lefedettségétől. */
export const IMPACT_MIN_COVERAGE = 0.8;
/** Ekkora |on/off delta| (net/40) alatt az egymeccses lineup-zaj miatt nincs pozitív / negatív verdikt. */
export const IMPACT_NOISE_NET40 = 5;

export type PlayerAdvancedInsightsInputs = {
  selectedPlayer: PlayerStats | null;
  analysis: PlayerAnalysis | null;
  /** A kiválasztott játékos meccssorai a szezonban. */
  selectedPlayerRows: GamePlayerStatRow[];
  games: TeamGame[];
  playerGameStats: GamePlayerStatRow[];
  /** Ellenfél-erősség (z-pont) név-kulcs szerint, a matchup-bontáshoz. */
  opponentQualityByTeamKey: Map<string, number>;
  playerSeasonShotSummary: ShotProfileSummary | null;
  leagueSeasonShotSummary: ShotProfileSummary | null;
  seasonKosarstatParsedClutchGames: KosarstatParsedClutchGame[];
  seasonKosarstatLineupTeam: KosarstatTeamLineupAnalysis | null;
  activeKosarstatTeamAnalysis: KosarstatTeamLineupAnalysis | null;
  activeSeasonPlayers: PlayerStats[];
};

export const buildPlayerAdvancedInsights = ({
  selectedPlayer,
  analysis,
  selectedPlayerRows,
  games,
  playerGameStats,
  opponentQualityByTeamKey,
  playerSeasonShotSummary,
  leagueSeasonShotSummary,
  seasonKosarstatParsedClutchGames,
  seasonKosarstatLineupTeam,
  activeKosarstatTeamAnalysis,
  activeSeasonPlayers,
}: PlayerAdvancedInsightsInputs) => {
  if (!selectedPlayer || !analysis) return null;

  const asPct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0);
  const safeNum = (value: number | null | undefined) => (Number.isFinite(Number(value)) ? Number(value) : 0);
  const confidenceFromSample = (sample: number, medium: number, high: number): 'alacsony' | 'kozepes' | 'magas' => {
    if (sample >= high) return 'magas';
    if (sample >= medium) return 'kozepes';
    return 'alacsony';
  };
  const shotInterpretation = (valueAdd: number | null): 'jobb mint varhato' | 'varhato szint' | 'varakozas alatt' | 'n/a' => {
    if (valueAdd === null) return 'n/a';
    if (valueAdd >= 1.5) return 'jobb mint varhato';
    if (valueAdd <= -1.5) return 'varakozas alatt';
    return 'varhato szint';
  };
  const matchupInterpretation = (tsDelta: number | null): 'ellenall' | 'semleges' | 'erzekeny' | 'n/a' => {
    if (tsDelta === null) return 'n/a';
    if (tsDelta >= -1.5) return 'ellenall';
    if (tsDelta <= -4) return 'erzekeny';
    return 'semleges';
  };
  const gradeHigherBetter = (value: number | null, goodAtOrAbove: number, riskBelow: number): 'good' | 'neutral' | 'risk' | 'na' => {
    if (value === null || !Number.isFinite(value)) return 'na';
    if (value >= goodAtOrAbove) return 'good';
    if (value < riskBelow) return 'risk';
    return 'neutral';
  };
  const gradeLowerBetter = (value: number | null, goodAtOrBelow: number, riskAbove: number): 'good' | 'neutral' | 'risk' | 'na' => {
    if (value === null || !Number.isFinite(value)) return 'na';
    if (value <= goodAtOrBelow) return 'good';
    if (value > riskAbove) return 'risk';
    return 'neutral';
  };
  const positionProfile = (() => {
    if (analysis.position === 'PG' || analysis.position === 'SG') {
      return {
        decisionGood: 64,
        decisionRisk: 52,
        stabilityGood: 18,
        stabilityRisk: 30,
        fatigueGoodDrop: -0.8,
        fatigueRiskDrop: -2.6,
      };
    }
    if (analysis.position === 'SF') {
      return {
        decisionGood: 60,
        decisionRisk: 50,
        stabilityGood: 17,
        stabilityRisk: 29,
        fatigueGoodDrop: -1.0,
        fatigueRiskDrop: -3.0,
      };
    }
    return {
      decisionGood: 58,
      decisionRisk: 48,
      stabilityGood: 16,
      stabilityRisk: 28,
      fatigueGoodDrop: -1.2,
      fatigueRiskDrop: -3.2,
    };
  })();
  const gameById = new Map(games.map(game => [game.id, game]));

  const usageByGameAndTeam = new Map<string, number>();
  playerGameStats.forEach(row => {
    const teamId = row.players?.team_id;
    if (!teamId) return;
    const key = `${row.game_id}::${teamId}`;
    const usage = (row.close_attempted || 0) + (row.mid_attempted || 0) + (row.three_attempted || 0) + 0.44 * (row.free_throw_attempted || 0) + (row.turnovers || 0);
    usageByGameAndTeam.set(key, (usageByGameAndTeam.get(key) ?? 0) + usage);
  });

  const rows = selectedPlayerRows
    .map(row => {
      const fga = (row.close_attempted || 0) + (row.mid_attempted || 0) + (row.three_attempted || 0);
      const fgm = (row.close_made || 0) + (row.mid_made || 0) + (row.three_made || 0);
      const fta = row.free_throw_attempted || 0;
      const usageProxy = fga + 0.44 * fta + (row.turnovers || 0);
      const tsDen = 2 * (fga + 0.44 * fta);
      const tsPct = tsDen > 0 ? ((row.points || 0) / tsDen) * 100 : 0;
      const efgPct = fga > 0 ? ((fgm + 0.5 * (row.three_made || 0)) / fga) * 100 : 0;
      const ppp = usageProxy > 0 ? (row.points || 0) / usageProxy : 0;
      const tovPct = asPct(row.turnovers || 0, usageProxy);
      const astTo = (row.turnovers || 0) > 0 ? (row.assists || 0) / (row.turnovers || 1) : (row.assists || 0);
      const teamId = row.players?.team_id ?? selectedPlayer.teamId ?? null;
      const teamUsage = teamId ? usageByGameAndTeam.get(`${row.game_id}::${teamId}`) ?? 0 : 0;
      const usageSharePct = asPct(usageProxy, teamUsage);
      const minutes = row.minutes || 0;
      const valPer36 = minutes > 0 ? ((row.valuation || 0) / minutes) * 36 : 0;
      const dateValue = row.games?.date ? new Date(row.games.date).getTime() : 0;
      const gameMeta = gameById.get(row.game_id);
      const margin = gameMeta ? Math.abs((gameMeta.ourScore || 0) - (gameMeta.oppScore || 0)) : null;
      const opponentKey = normalizeTeamKey(String(row.games?.opponent || ''));
      const oppQuality = opponentQualityByTeamKey.get(opponentKey) ?? null;
      const threeRate = asPct(row.three_attempted || 0, fga);
      const rimRate = asPct(row.close_attempted || 0, fga);
      const midRate = asPct(row.mid_attempted || 0, fga);
      const line: PlayerGameLine = {
        points: row.points || 0,
        fga,
        fgm,
        threeMade: row.three_made || 0,
        midAttempts: row.mid_attempted || 0,
        fta,
        ast: row.assists || 0,
        tov: row.turnovers || 0,
      };

      return {
        row,
        line,
        fga,
        usageProxy,
        tsPct,
        efgPct,
        ppp,
        tovPct,
        astTo,
        usageSharePct,
        valPer36,
        minutes,
        dateValue,
        margin,
        oppQuality,
        threeRate,
        rimRate,
        midRate,
      };
    })
    .filter(item => item.fga > 0 || item.usageProxy > 0);

  // Minden arány összegből (ΣPTS / (2·(ΣFGA + 0,44·ΣFTA)) stb.), nem a
  // meccsenkénti arányok átlagából – különben a részhalmazok (terhelés,
  // matchup, szerepkör) egyszerre lehetnének a szezonérték fölött.
  const aggregateOf = (pool: typeof rows) => aggregatePlayerGames(pool.map(item => item.line));
  const seasonAggregate = aggregateOf(rows);
  const seasonTs = seasonAggregate.tsPct ?? 0;
  const seasonPpp = seasonAggregate.ppp ?? 0;
  const seasonTov = seasonAggregate.tovPct ?? 0;
  const poolTs = (pool: typeof rows) => {
    const value = aggregateOf(pool).tsPct;
    return pool.length > 0 && value !== null ? roundValue(value, 1) : null;
  };
  const poolPpp = (pool: typeof rows) => {
    const value = aggregateOf(pool).ppp;
    return pool.length > 0 && value !== null ? roundValue(value, 3) : null;
  };

  const shotQualityVsMaking = (() => {
    if (!playerSeasonShotSummary || !leagueSeasonShotSummary) {
      return {
        available: false,
        expectedEfg: null as number | null,
        actualEfg: null as number | null,
        valueAdd: null as number | null,
        note: null as string | null,
        zoneAdds: [] as Array<{ label: string; delta: number }>,
      };
    }

    const zones: Array<{ key: ShotZoneKey; label: string; weight: number }> = [
      { key: 'rim', label: 'Gyűrű', weight: 2 },
      { key: 'paint', label: 'Festék', weight: 2 },
      { key: 'mid', label: 'Középtáv', weight: 2 },
      { key: 'corner3', label: 'Sarok tripla', weight: 3 },
      { key: 'aboveBreak3', label: 'Egyéb tripla', weight: 3 },
    ];

    const totalAttempts = Math.max(1, playerSeasonShotSummary.attempts);
    let expectedPoints = 0;
    let actualPoints = 0;

    const zoneAdds = zones.map(zone => {
      const attempts = playerSeasonShotSummary.zoneStats[zone.key].attempts;
      const actualPct = playerSeasonShotSummary.zoneStats[zone.key].pct / 100;
      const expectedPct = leagueSeasonShotSummary.zoneStats[zone.key].pct / 100;
      const zoneActualPoints = attempts * actualPct * zone.weight;
      const zoneExpectedPoints = attempts * expectedPct * zone.weight;
      expectedPoints += zoneExpectedPoints;
      actualPoints += zoneActualPoints;
      return {
        label: zone.label,
        delta: roundValue((zoneActualPoints - zoneExpectedPoints) / totalAttempts * 100, 1),
      };
    });

    const expectedEfg = roundValue((expectedPoints / (2 * totalAttempts)) * 100, 1);
    const actualEfg = roundValue((actualPoints / (2 * totalAttempts)) * 100, 1);
    // A dobástérkép (Hunbasket) nem minden kísérletet tartalmaz: a lefedettség a
    // box score mezőnykísérleteihez és találataihoz mérve, hogy a térkép-eFG ne
    // tűnjön a szezon-eFG-nek.
    const boxAttempts = seasonAggregate.fga;
    const boxMade = seasonAggregate.fgm;
    const mapMade = Object.values(playerSeasonShotSummary.zoneStats).reduce((sum, zone) => sum + zone.made, 0);
    const coveragePct = boxAttempts > 0 ? roundValue((playerSeasonShotSummary.attempts / boxAttempts) * 100, 0) : null;
    return {
      available: true,
      sampleAttempts: totalAttempts,
      coverage: {
        mapAttempts: playerSeasonShotSummary.attempts,
        mapMade,
        boxAttempts,
        boxMade,
        pct: coveragePct,
      },
      confidence: confidenceFromSample(totalAttempts, 70, 140),
      expectedEfg,
      actualEfg,
      valueAdd: roundValue(actualEfg - expectedEfg, 1),
      interpretation: shotInterpretation(roundValue(actualEfg - expectedEfg, 1)),
      note: roundValue(actualEfg - expectedEfg, 1) >= 8
        ? 'A befejezési minőség jóval felülmúlja a dobásminőségből várható szintet; ez inkább elit befejező profilra utal, nem feltétlenül magas önteremtő volumenre.'
        : roundValue(actualEfg - expectedEfg, 1) <= -8
          ? 'A vállalt dobások minőségéhez képest gyengébb a befejezés, ezért a kivitelezés külön figyelmet igényel.'
          : null,
      zoneAdds,
    };
  })();

  const clutchIdentity = (() => {
    const selectedPlayerProfiles = [
      buildNormalizedNameProfile(selectedPlayer.name || ''),
    ].filter(profile => Boolean(profile.key));

    return buildAggregatedKosarstatPlayerClutchContext(
      seasonKosarstatParsedClutchGames,
      selectedPlayerProfiles
    );
  })();

  const plusMinusContext = (() => {
    const selectedPlayerProfiles = [
      buildNormalizedNameProfile(selectedPlayer.name || ''),
    ].filter(profile => Boolean(profile.key));
    const lineupSupportSource = seasonKosarstatLineupTeam ?? activeKosarstatTeamAnalysis;
    const stints = lineupSupportSource?.stints ?? [];
    const withNet = stints
      .map(stint => ({
        ...stint,
        netPer40: Number.isFinite(Number(stint.on40)) ? Number(stint.on40) : (stint.seconds > 0 ? (stint.plusMinus * 2400) / stint.seconds : null),
      }))
      .filter(stint => stint.netPer40 !== null && stint.seconds >= 60);

    const on = withNet.filter(stint => stint.players.some(player => matchesNormalizedNameProfile(player, selectedPlayerProfiles)));
    const off = withNet.filter(stint => !stint.players.some(player => matchesNormalizedNameProfile(player, selectedPlayerProfiles)));

    const weighted = (pool: typeof withNet) => {
      const sec = pool.reduce((sum, item) => sum + item.seconds, 0);
      if (sec <= 0) return null;
      const weightedNet = pool.reduce((sum, item) => sum + safeNum(item.netPer40) * item.seconds, 0) / sec;
      return roundValue(weightedNet, 1);
    };

    // A Kosarstat lineup más névalakot használ (pl. „Jay Jay CHANDLER”): a
    // páros neveit a csapat játékos-adatbázisbeli nevére írjuk át.
    const teamPlayerNames = activeSeasonPlayers
      .filter(player => player.teamId === selectedPlayer.teamId)
      .map(player => player.name)
      .filter((name): name is string => Boolean(name));
    const topPairWithPlayer = (lineupSupportSource?.pairStats ?? [])
      .filter(pair => pair.players.some(player => matchesNormalizedNameProfile(player, selectedPlayerProfiles)) && pair.seconds >= 90)
      .sort((a, b) => b.netPer40 - a.netPer40)[0] ?? null;

    // Lefedettség: a lineup-adatban talált pályán töltött perc a box score
    // játszott perceihez mérve – hiányzó Kosarstat lineup meccseknél alacsony.
    const lineupOnMinutes = on.reduce((sum, item) => sum + item.seconds, 0) / 60;
    const playedMinutes = rows.reduce((sum, item) => sum + item.minutes, 0);
    const coverage = playedMinutes > 0 ? Math.min(1, lineupOnMinutes / playedMinutes) : 0;
    return {
      available: on.length > 0 || off.length > 0,
      confidence: lineupOnMinutes < 12
        ? 'alacsony' as const
        : coverage >= 0.9 ? 'magas' as const : coverage >= 0.7 ? 'kozepes' as const : 'alacsony' as const,
      coveragePct: roundValue(coverage * 100, 0),
      playedMinutes: roundValue(playedMinutes, 0),
      onNet40: weighted(on),
      offNet40: weighted(off),
      delta: weighted(on) !== null && weighted(off) !== null ? roundValue((weighted(on) as number) - (weighted(off) as number), 1) : null,
      lineupMinutes: roundValue(on.reduce((sum, item) => sum + item.seconds, 0) / 60, 1),
      topPair: topPairWithPlayer
        ? {
            label: (() => {
              const resolution = resolvePlayerNames(topPairWithPlayer.players, teamPlayerNames);
              return topPairWithPlayer.players.map(name => resolution.matched.get(name) ?? name).join(' + ');
            })(),
            netPer40: roundValue(topPairWithPlayer.netPer40, 1),
            minutes: roundValue(topPairWithPlayer.seconds / 60, 1),
          }
        : null,
    };
  })();

  const roleEfficiency = (() => {
    const ballHandlerRows = rows.filter(item => item.usageSharePct >= 24);
    const offBallRows = rows.filter(item => item.usageSharePct < 18);
    const highThreeRows = rows.filter(item => item.threeRate >= 45);
    const rimPressureRows = rows.filter(item => item.rimRate >= 35);

    const roleCoverageCount = [ballHandlerRows.length, offBallRows.length].filter(sample => sample > 0).length;
    const leanestCoreRoleSample = roleCoverageCount > 0
      ? Math.min(
          ...[ballHandlerRows.length, offBallRows.length].filter(sample => sample > 0)
        )
      : 0;
    const totalCoreRoleSample = ballHandlerRows.length + offBallRows.length;
    const confidence: 'alacsony' | 'kozepes' | 'magas' = roleCoverageCount >= 2
      ? leanestCoreRoleSample >= 5 && totalCoreRoleSample >= 14
        ? 'magas'
        : leanestCoreRoleSample >= 2 && totalCoreRoleSample >= 8
          ? 'kozepes'
          : 'alacsony'
      : totalCoreRoleSample >= 10
        ? 'kozepes'
        : 'alacsony';

    return {
      confidence,
      ballHandlerSample: ballHandlerRows.length,
      offBallSample: offBallRows.length,
      highThreeSample: highThreeRows.length,
      rimPressureSample: rimPressureRows.length,
      ballHandlerTs: poolTs(ballHandlerRows),
      ballHandlerPpp: poolPpp(ballHandlerRows),
      offBallTs: poolTs(offBallRows),
      offBallPpp: poolPpp(offBallRows),
      highThreeTs: poolTs(highThreeRows),
      rimPressureTs: poolTs(rimPressureRows),
    };
  })();

  // A legjobb szerepkör-TS csak a legalább ROLE_MIN_GAMES_FOR_VERDICT meccses
  // csoportokból: 1–2 meccses részhalmaz maximuma szelekciós torzítás.
  const bestRoleTs = Math.max(
    ...([
      [roleEfficiency.ballHandlerTs, roleEfficiency.ballHandlerSample],
      [roleEfficiency.offBallTs, roleEfficiency.offBallSample],
      [roleEfficiency.highThreeTs, roleEfficiency.highThreeSample],
      [roleEfficiency.rimPressureTs, roleEfficiency.rimPressureSample],
    ] as Array<[number | null, number]>)
      .filter(([ts, sample]) => ts !== null && sample >= ROLE_MIN_GAMES_FOR_VERDICT)
      .map(([ts]) => ts as number),
    -Infinity
  );

  const decisionQuality = (() => {
    // ΣAST / ΣTO – ugyanaz, mint a Játéképítés blokk AST/TO-ja.
    const astTo = roundValue(seasonAggregate.astTo, 2);
    const tovPct = roundValue(seasonAggregate.tovPct ?? 0, 1);
    const midRate = roundValue(seasonAggregate.midRatePct ?? 0, 1);
    const qualityAdd = shotQualityVsMaking.valueAdd ?? 0;
    const scoreRaw = 55 + astTo * 8 - tovPct * 1.3 - midRate * 0.15 + qualityAdd * 2;
    const score = Math.max(0, Math.min(100, roundValue(scoreRaw, 1)));
    const tier = score >= 70 ? 'elit' : score >= 55 ? 'stabil' : 'kockázatos';
    return {
      confidence: confidenceFromSample(rows.length, 6, 12),
      score,
      tier,
      astTo,
      tovPct,
      midRate,
    };
  })();

  const stability = (() => {
    const chrono = [...rows].sort((a, b) => a.dateValue - b.dateValue);
    const rollingWindow = 5;
    const rolling: Array<{ ts: number; ppp: number; tov: number }> = [];
    for (let i = rollingWindow - 1; i < chrono.length; i += 1) {
      const sliceAggregate = aggregateOf(chrono.slice(i - rollingWindow + 1, i + 1));
      rolling.push({
        ts: sliceAggregate.tsPct ?? 0,
        ppp: sliceAggregate.ppp ?? 0,
        tov: sliceAggregate.tovPct ?? 0,
      });
    }

    const tsStd = roundValue(stdDev(rows.map(item => item.tsPct)), 1);
    const pppStd = roundValue(stdDev(rows.map(item => item.ppp)), 3);
    const tovStd = roundValue(stdDev(rows.map(item => item.tovPct)), 1);
    const volatility = roundValue(Math.min(100, tsStd * 1.2 + pppStd * 18 + tovStd * 1.4), 1);
    const trend = rows.length >= 6
      ? roundValue((aggregateOf(rows.slice(0, 3)).tsPct ?? 0) - (aggregateOf(rows.slice(-3)).tsPct ?? 0), 1)
      : 0;

    return {
      confidence: confidenceFromSample(rows.length, 8, 14),
      rollingPoints: rolling.length,
      tsStd,
      pppStd,
      tovStd,
      volatility,
      trend,
    };
  })();

  const matchupSensitivity = (() => {
    const withQuality = rows.filter(item => item.oppQuality !== null) as Array<typeof rows[number] & { oppQuality: number }>;
    if (withQuality.length < 4) {
      return {
        available: false,
        strongTs: null as number | null,
        weakTs: null as number | null,
        strongPpp: null as number | null,
        weakPpp: null as number | null,
        tsDelta: null as number | null,
        strongOpponents: [] as string[],
        weakOpponents: [] as string[],
      };
    }

    const strong = withQuality.filter(item => item.oppQuality >= 0.5);
    const weak = withQuality.filter(item => item.oppQuality <= -0.5);
    const strongPool = strong.length >= 2 ? strong : [...withQuality].sort((a, b) => b.oppQuality - a.oppQuality).slice(0, Math.ceil(withQuality.length / 2));
    const weakPool = weak.length >= 2 ? weak : [...withQuality].sort((a, b) => a.oppQuality - b.oppQuality).slice(0, Math.ceil(withQuality.length / 2));
    const pairedSample = Math.min(strongPool.length, weakPool.length);

    const strongTs = poolTs(strongPool) ?? 0;
    const weakTs = poolTs(weakPool) ?? 0;
    const strongPpp = poolPpp(strongPool) ?? 0;
    const weakPpp = poolPpp(weakPool) ?? 0;
    // A két csoportba nem került meccsek (középmezőny, ill. besorolás nélküli
    // ellenfél) – külön kiírva, hogy látsszon, a minta mekkora részét fedi a két csoport.
    const pooled = new Set([...strongPool, ...weakPool]);
    const middlePool = rows.filter(item => !pooled.has(item as typeof withQuality[number]));
    return {
      available: true,
      confidence: pairedSample >= 4 ? 'magas' : pairedSample >= 2 ? 'kozepes' : 'alacsony',
      sampleSize: withQuality.length,
      strongTs,
      weakTs,
      strongPpp,
      weakPpp,
      tsDelta: roundValue(strongTs - weakTs, 1),
      interpretation: matchupInterpretation(roundValue(strongTs - weakTs, 1)),
      strongGames: strongPool.length,
      weakGames: weakPool.length,
      middleGames: middlePool.length,
      middleTs: poolTs(middlePool),
      middleOpponents: Array.from(new Set(middlePool.map(item => String(item.row.games?.opponent || '')).filter(Boolean))),
      strongOpponents: Array.from(new Set(strongPool.map(item => String(item.row.games?.opponent || '')).filter(Boolean))),
      weakOpponents: Array.from(new Set(weakPool.map(item => String(item.row.games?.opponent || '')).filter(Boolean))),
    };
  })();

  const fatigueLoad = (() => {
    const sorted = [...rows].sort((a, b) => a.dateValue - b.dateValue);
    const withB2B = sorted.map((item, index) => {
      if (index === 0) return { ...item, b2b: false };
      const prev = sorted[index - 1];
      const dayGap = (item.dateValue - prev.dateValue) / (1000 * 60 * 60 * 24);
      return { ...item, b2b: Number.isFinite(dayGap) && dayGap > 0 && dayGap <= 1.5 };
    });

    const highLoad = withB2B.filter(item => item.minutes >= 30);
    const normalLoad = withB2B.filter(item => item.minutes < 30);
    const b2b = withB2B.filter(item => item.b2b);

    const highTs = poolTs(highLoad);
    const normalTs = poolTs(normalLoad);
    const b2bTovValue = aggregateOf(b2b).tovPct;
    const b2bTov = b2b.length && b2bTovValue !== null ? roundValue(b2bTovValue, 1) : null;
    const balancedLoadSample = Math.min(highLoad.length, normalLoad.length);

    return {
      confidence: balancedLoadSample >= 6 ? 'magas' : balancedLoadSample >= 3 ? 'kozepes' : 'alacsony',
      sampleSize: sorted.length,
      highLoadGames: highLoad.length,
      b2bGames: b2b.length,
      highLoadTs: highTs,
      normalLoadTs: normalTs,
      tsDrop: highTs !== null && normalTs !== null ? roundValue(highTs - normalTs, 1) : null,
      b2bTovPct: b2bTov,
      note: highLoad.length === 0 ? 'Nincs érdemi 30+ perces minta, ezért a terhelési blokk korlátozottan értelmezhető.' : null,
    };
  })();

  const coachingFocus = [
    shotQualityVsMaking.valueAdd !== null && shotQualityVsMaking.valueAdd <= -1.5
      ? 'Dobásminőség és kivitelezés: expected eFG alatt termel, érdemes a preferált zónákra visszaterelni.'
      : null,
    decisionQuality.score < 55
      ? `Döntéshozatali kockázat: ${decisionQuality.score.toFixed(1)}-es index, AST/TO ${decisionQuality.astTo.toFixed(2)}.`
      : null,
    plusMinusContext.delta !== null && plusMinusContext.delta <= -4
      ? 'Lineup fit probléma: on/off delta negatív, érdemes a sikeres párosokkal többet együtt játszatni.'
      : null,
    matchupSensitivity.available && matchupSensitivity.tsDelta !== null && matchupSensitivity.tsDelta <= -4
      ? 'Matchup érzékenység erős védelmek ellen: ellenállóbb belső opciók vagy korai könnyű kísérletek növelése javasolt.'
      : null,
    fatigueLoad.tsDrop !== null && fatigueLoad.tsDrop <= -3
      ? 'Terhelés menedzsment: nagy percterhelésnél hatékonyság-esés látható, váltás/rotáció finomítása indokolt.'
      : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 3);

  const blockVerdicts = (() => {
    const shotTone = gradeHigherBetter(shotQualityVsMaking.valueAdd, 1.5, -1.5);
    const clutchTsDelta = clutchIdentity.tsPct !== null ? roundValue(clutchIdentity.tsPct - seasonTs, 1) : null;
    const clutchTone = clutchIdentity.games < CLUTCH_MIN_GAMES_FOR_VERDICT ? 'na' : gradeHigherBetter(clutchTsDelta, 1.0, -2.0);
    // Lineup on/off: csak elég lefedettségnél, és a zajszint (±5 net/40) fölött ad irányt.
    const impactCovered = (plusMinusContext.coveragePct ?? 0) >= IMPACT_MIN_COVERAGE * 100;
    const impactTone = impactCovered ? gradeHigherBetter(plusMinusContext.delta, IMPACT_NOISE_NET40, -IMPACT_NOISE_NET40) : 'na';
    const roleBestTs = bestRoleTs;
    const roleTsDelta = Number.isFinite(roleBestTs) ? roundValue(roleBestTs - seasonTs, 1) : null;
    const roleTone = gradeHigherBetter(roleTsDelta, 1.0, -1.5);
    const decisionTone = gradeHigherBetter(decisionQuality.score, positionProfile.decisionGood, positionProfile.decisionRisk);
    const stabilityTone = gradeLowerBetter(stability.volatility, positionProfile.stabilityGood, positionProfile.stabilityRisk);
    const matchupTone = gradeHigherBetter(matchupSensitivity.tsDelta, -1.0, -4.0);
    const fatigueTone = gradeHigherBetter(fatigueLoad.tsDrop, positionProfile.fatigueGoodDrop, positionProfile.fatigueRiskDrop);

    return {
      shot: {
        tone: shotTone,
        text: shotTone === 'good'
          ? 'Verdict: a dobáskivitelezés a vártnál jobb szintet hoz.'
          : shotTone === 'risk'
            ? 'Verdict: a kivitelezés elmarad a várható dobásminőségtől.'
            : 'Verdict: a kivitelezés nagyjából a várható szinten mozog.',
      },
      clutch: {
        tone: clutchTone,
        text: clutchTone === 'na'
          ? `Kevés adat: ${clutchIdentity.games} clutch meccs – verdikt legalább ${CLUTCH_MIN_GAMES_FOR_VERDICT} meccstől.`
          : clutchTone === 'good'
          ? 'Verdict: clutch helyzetben stabilan tartja vagy javítja a szezon-szintet.'
          : clutchTone === 'risk'
            ? 'Verdict: clutchban érdemi visszaesés látszik a szezonátlaghoz képest.'
            : 'Verdict: clutch teljesítménye jelenleg közeli a szezonmintához.',
      },
      impact: {
        tone: impactTone,
        text: impactTone === 'na'
          ? `Verdikt nélkül: a lineup-adat a játszott percek ${plusMinusContext.coveragePct ?? 0}%-át fedi (legalább ${Math.round(IMPACT_MIN_COVERAGE * 100)}% kell).`
          : impactTone === 'good'
            ? 'Verdict: a lineup on/off alapján érdemben pozitív nettó hatás (a ±5 net/40 zajszint fölött).'
            : impactTone === 'risk'
              ? 'Verdict: a lineup on/off alapján érdemben negatív nettó hatás (a ±5 net/40 zajszint alatt).'
              : 'Verdict: az on/off különbség zajszinten belül van (±5 net/40) – nincs egyértelmű lineup-hatás.',
      },
      role: {
        tone: roleTone,
        text: roleTone === 'na'
          ? `Kevés adat: egyik szerepkör-csoportban sincs legalább ${ROLE_MIN_GAMES_FOR_VERDICT} meccs – verdikt nélkül.`
          : roleTone === 'good'
          ? 'Verdict: legalább egy szerepkörben a szezon-szint fölé tud lépni.'
          : roleTone === 'risk'
            ? 'Verdict: a szerepkörök között nincs stabilan pluszt hozó profil.'
            : 'Verdict: a szerepkör-hatékonyság közepes, még finomhangolható.',
      },
      decision: {
        tone: decisionTone,
        text: decisionTone === 'good'
          ? 'Verdict: döntésminőség jelenleg erős.'
          : decisionTone === 'risk'
            ? 'Verdict: döntésminőségi kockázat látszik (shot selection / labdabiztonság).'
            : 'Verdict: döntésminőség stabil, de nem kiugró.',
      },
      stability: {
        tone: stabilityTone,
        text: stabilityTone === 'good'
          ? 'Verdict: meccsről meccsre alacsonyabb kilengés, megbízhatóbb output.'
          : stabilityTone === 'risk'
            ? 'Verdict: magasabb ingadozás, a teljesítmény kevésbé kiszámítható.'
            : 'Verdict: közepes stabilitás, rövid távon hullámzó lehet.',
      },
      matchup: {
        tone: matchupTone,
        text: matchupTone === 'good'
          ? 'Verdict: erősebb védelem ellen is jól tartja a hatékonyságát.'
          : matchupTone === 'risk'
            ? 'Verdict: erősebb védelem ellen érzékenyebb visszaesés látszik.'
            : 'Verdict: matchup-érzékenység közepes, ellenféltől függően változik.',
      },
      fatigue: {
        tone: fatigueTone,
        text: fatigueTone === 'good'
          ? 'Verdict: terhelés mellett is tartja a hatékonyságot.'
          : fatigueTone === 'risk'
            ? 'Verdict: nagy terhelésnél érdemi hatékonyság-esés jelentkezik.'
            : 'Verdict: terhelésre mérsékelten reagál, monitorozás javasolt.',
      },
    };
  })();

  const toneReason = (tone: 'good' | 'neutral' | 'risk' | 'na') => {
    if (tone === 'good') return 'good, mert átlépi a pozitív küszöböt';
    if (tone === 'risk') return 'risk, mert a kockázati küszöb alá/fölé esik';
    if (tone === 'neutral') return 'neutral, mert a két küszöb között van';
    return 'n/a, mert nincs elég adat';
  };

  const clutchDeltaForHint = clutchIdentity.tsPct !== null ? roundValue(clutchIdentity.tsPct - seasonTs, 1) : null;
  const roleTsDeltaForHint = Number.isFinite(bestRoleTs) ? roundValue(bestRoleTs - seasonTs, 1) : null;

  const thresholdHints = {
    shot: `Good: value add >= +1.5 pp | Risk: value add < -1.5 pp | Minta: ${shotQualityVsMaking.sampleAttempts ?? 0} kísérlet\nAktuális: ${formatNullableNumber(shotQualityVsMaking.valueAdd, 1, ' pp')} | Indok: ${toneReason(blockVerdicts.shot.tone)}`,
    clutch: `Good: clutch TS - szezon TS >= +1.0 pp | Risk: <= -2.0 pp | Minta: ${clutchIdentity.games} Kosarstat clutch meccs\nAktuális: ${formatNullableNumber(clutchDeltaForHint, 1, ' pp')} | Indok: ${toneReason(blockVerdicts.clutch.tone)}`,
    impact: `Good: on/off delta >= +${IMPACT_NOISE_NET40.toFixed(1)} net/40 | Risk: < -${IMPACT_NOISE_NET40.toFixed(1)} net/40 | Lefedettség legalább ${Math.round(IMPACT_MIN_COVERAGE * 100)}% | Minta: ${plusMinusContext.lineupMinutes.toFixed(1)} / ${plusMinusContext.playedMinutes} perc (${plusMinusContext.coveragePct}%)\nAktuális: ${formatNullableNumber(plusMinusContext.delta, 1)} | Indok: ${toneReason(blockVerdicts.impact.tone)}`,
    role: `Good: legjobb (legalább ${ROLE_MIN_GAMES_FOR_VERDICT} meccses) szerepkör TS >= szezon TS +1.0 pp | Risk: <= -1.5 pp | Minta: BH ${roleEfficiency.ballHandlerSample} / OB ${roleEfficiency.offBallSample} / 3PA ${roleEfficiency.highThreeSample} / gyűrű ${roleEfficiency.rimPressureSample}\nAktuális: ${formatNullableNumber(roleTsDeltaForHint, 1, ' pp')} | Indok: ${toneReason(blockVerdicts.role.tone)}`,
    decision: `Good: index >= ${positionProfile.decisionGood} | Risk: < ${positionProfile.decisionRisk} | Pozíciós küszöb (${analysis.position})\nAktuális: ${decisionQuality.score.toFixed(1)} | Indok: ${toneReason(blockVerdicts.decision.tone)}`,
    stability: `Skála: 0 = egyenletes, 100 = erősen hullámzó (magasabb = rosszabb) | Good: volatilitási index <= ${positionProfile.stabilityGood} | Risk: > ${positionProfile.stabilityRisk} | Pozíciós küszöb (${analysis.position})\nAktuális: ${stability.volatility.toFixed(1)} | Indok: ${toneReason(blockVerdicts.stability.tone)}`,
    matchup: `Good: erős-gyenge TS delta >= -1.0 pp | Risk: < -4.0 pp | Minta: ${matchupSensitivity.sampleSize ?? 0} meccs\nAktuális: ${formatNullableNumber(matchupSensitivity.tsDelta, 1, ' pp')} | Indok: ${toneReason(blockVerdicts.matchup.tone)}`,
    fatigue: `Good: high-load TS - normal TS >= ${positionProfile.fatigueGoodDrop.toFixed(1)} pp | Risk: <= ${positionProfile.fatigueRiskDrop.toFixed(1)} pp | Pozíciós küszöb (${analysis.position})\nAktuális: ${formatNullableNumber(fatigueLoad.tsDrop, 1, ' pp')} | Indok: ${toneReason(blockVerdicts.fatigue.tone)}`,
  };

  return {
    shotQualityVsMaking,
    clutchIdentity,
    plusMinusContext,
    roleEfficiency,
    decisionQuality,
    stability,
    matchupSensitivity,
    fatigueLoad,
    blockVerdicts,
    thresholdHints,
    coachingFocus,
    positionThresholds: { stabilityGood: positionProfile.stabilityGood, stabilityRisk: positionProfile.stabilityRisk },
    season: {
      tsPct: roundValue(seasonTs, 1),
      ppp: roundValue(seasonPpp, 3),
      tovPct: roundValue(seasonTov, 1),
    },
  };
};

export type PlayerAdvancedInsights = NonNullable<ReturnType<typeof buildPlayerAdvancedInsights>>;
