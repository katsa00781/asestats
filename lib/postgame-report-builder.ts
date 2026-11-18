// Post-game riport összeállítása egy meccsre: a csapat- és ellenfél-box a játékos-meccs
// sorokból, a játékosbontás (meccsbeli pozíció a Kosarstat lineup-slotból, kezdő-jelölés),
// a szezonos összevetés, a Kosarstat ↔ box score névillesztés jegyzetei, a lineup-
// összefoglaló (top / bottom ötös, páros, következtetések), a leggyengébb mag, a kezdő-split
// és az on/off, végül a Kosarstat meccs-kontextus beolvasztása (`mergeKosarstatPostgameContext`).
// A SeasonComparison-ből kiszervezve (H34/F2c), viselkedésváltozás nélkül. Nem @core modul;
// a @core `lib/postgame-report.ts` változatlan.
import type { PlayerStats, TeamGame } from '@/lib/dashboard-types';
import type { KosarstatLineupAnalysis } from '@/lib/kosarstat-lineup-analysis';
import type { Position } from '@/lib/player-analysis';
import { resolvePlayerNames } from '@/lib/player-name-match';
import { buildPostgameLineupSides, describeStarterSplit, describeWeakestLineupCore } from '@/lib/postgame-lineup-export';
import {
  analyzePostGameReport,
  mergeKosarstatPostgameContext,
  type KosarstatPostgameContext,
  type LeagueTeamBenchmarks,
  type PlayerGameStat,
  type PostGameReport,
  type PostGameShotMapContext,
  type TeamGameStat,
  type TeamSeasonStat as PostgameTeamSeasonStat,
} from '@/lib/postgame-report';
import type { PreGameXFactorContext } from '@/lib/pregame-scouting';
import type { GamePlayerStatRow } from '@/lib/season-comparison-helpers';
import { buildNormalizedNameProfile, matchesNormalizedNameProfile, roundValue } from '@/lib/season-comparison-helpers';
import { mapPosition } from '@/lib/season-raw-stats';
import type { TeamSeasonStat } from '@/lib/team-analysis';

/**
 * Lineup-rangsorok minimális együtt töltött ideje. 1–3 perces minták
 * extrapolálva irreális Net/40-et adnak (pl. +666,7 vagy −324,3).
 */
export const LINEUP_MIN_SAMPLE_SECONDS = 300;

export type PostgameReportInputs = {
  selectedGame: TeamGame | null;
  /** A kiválasztott csapat szezonösszege (a szezonos összevetéshez). */
  selectedTeamStats: TeamSeasonStat | null;
  postgameBenchmarks: LeagueTeamBenchmarks | null;
  resolvedTeamId: string;
  playerGameStats: GamePlayerStatRow[];
  league: string;
  kosarstatLineupAnalysis: KosarstatLineupAnalysis | null;
  seasonPlayers: PlayerStats[];
  rolesByPlayerId: Map<string, string[]>;
  /** Csapatonként az ellenfelek DREB-je és birtoklása a szezonban (meccsszámra skálázva). */
  postgameOpponentTotalsByTeam: Map<string, { dreb: number; possessions: number }>;
  /** A pregame modell X-faktor kontextusa a post-game Reflexióhoz. */
  postgamePregameXFactorContext: PreGameXFactorContext | undefined;
  postgameShotContext: PostGameShotMapContext | null;
  kosarstatPostgameContext: KosarstatPostgameContext;
  kosarstatPostgameNotes: string[];
};

export const buildPostgameReport = ({
  selectedGame,
  selectedTeamStats,
  postgameBenchmarks,
  resolvedTeamId,
  playerGameStats,
  league,
  kosarstatLineupAnalysis,
  seasonPlayers,
  rolesByPlayerId,
  postgameOpponentTotalsByTeam,
  postgamePregameXFactorContext,
  postgameShotContext,
  kosarstatPostgameContext,
  kosarstatPostgameNotes,
}: PostgameReportInputs): PostGameReport | null => {
  if (!selectedGame || !selectedTeamStats || !postgameBenchmarks || !resolvedTeamId || resolvedTeamId === 'all') return null;

  const teamPlayers = playerGameStats.filter(row => row.game_id === selectedGame.id);

  const opponentPlayers = selectedGame.opponentGameId
    ? playerGameStats.filter(row => row.game_id === selectedGame.opponentGameId)
    : [];

  if (teamPlayers.length === 0) return null;

  const buildTeamGame = (rows: GamePlayerStatRow[], teamId: string, teamName: string): TeamGameStat => {
    return rows.reduce<TeamGameStat>(
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
        acc.fouls += 0;
        acc.val += row.valuation || 0;
        return acc;
      },
      {
        teamId,
        teamName,
        league,
        season: selectedTeamStats.season,
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
      }
    );
  };

  const teamGame = buildTeamGame(teamPlayers, selectedTeamStats.teamId, selectedTeamStats.teamName);
  const opponentGame = opponentPlayers.length > 0
    ? buildTeamGame(opponentPlayers, 'opponent', selectedGame.opponent)
    : null;
  if (opponentGame) {
    teamGame.pointsAgainst = opponentGame.pointsFor;
    opponentGame.pointsAgainst = teamGame.pointsFor;
  } else {
    teamGame.pointsAgainst = selectedGame.oppScore;
  }

  teamGame.actualPointsFor = selectedGame.ourScore;
  teamGame.actualPointsAgainst = selectedGame.oppScore;
  teamGame.result = selectedGame.result;

  if (opponentGame) {
    opponentGame.actualPointsFor = selectedGame.oppScore;
    opponentGame.actualPointsAgainst = selectedGame.ourScore;
    opponentGame.result = selectedGame.result === 'win' ? 'loss' : 'win';
  }

  const activeLineupTeam =
    kosarstatLineupAnalysis?.selectedTeam ||
    kosarstatLineupAnalysis?.homeTeam ||
    kosarstatLineupAnalysis?.awayTeam ||
    null;

  const starterProfiles = (activeLineupTeam?.starters || [])
    .map(name => buildNormalizedNameProfile(name))
    .filter(profile => profile.key.length > 0);

  const resolveBoxName = (row: GamePlayerStatRow) => {
    const seasonPlayer = seasonPlayers.find(player => String(player.id) === String(row.player_id));
    return seasonPlayer?.name || row.players?.name?.trim() || row.player_id;
  };

  // Kosarstat lineup ↔ box score névpárosítás (a nem illeszkedő nevek a riportba kerülnek).
  const lineupNames = activeLineupTeam
    ? Array.from(new Set([
        ...activeLineupTeam.playerMinutes.map(item => item.player),
        ...activeLineupTeam.stints.flatMap(stint => stint.players),
      ]))
    : [];
  const nameResolution = resolvePlayerNames(lineupNames, teamPlayers.map(resolveBoxName));
  const nameNotes: string[] = [];
  if (activeLineupTeam && lineupNames.length > 0) {
    if (nameResolution.matched.size === 0) {
      nameNotes.push('Névillesztés: a Kosarstat lineup egyetlen játékosa sem párosítható a box score-ral – a lineup-adatok nem ehhez a csapathoz kapcsolódnak.');
    } else {
      const secondsByName = new Map(activeLineupTeam.playerMinutes.map(item => [item.player, item.seconds]));
      const brief = nameResolution.unmatched.filter(name => (secondsByName.get(name) ?? 0) < 60);
      const missing = nameResolution.unmatched.filter(name => !brief.includes(name));
      if (missing.length > 0) {
        nameNotes.push(`Névillesztés: ${missing.length} Kosarstat játékos nem párosítható a box score-ral (${missing.join(', ')}) – a lineup-adataik nem kapcsolódnak a játékosbontáshoz.`);
      }
      if (brief.length > 0) {
        nameNotes.push(`1 percnél rövidebb játékidő, a box score-ban nincs soruk (a forrás 0 percnek írja): ${brief.join(', ')}.`);
      }
      if (nameResolution.ambiguous.length > 0) {
        nameNotes.push(`Névillesztés: több box score játékosra is illeszkedik, ezért nincs párosítva: ${nameResolution.ambiguous.join(', ')}.`);
      }
    }
    if (nameNotes.length > 0) {
      console.warn('[postgame] Kosarstat ↔ box score névillesztési eltérés', {
        unmatched: nameResolution.unmatched,
        ambiguous: nameResolution.ambiguous,
      });
    }
  }

  // Meccsbeli pozíció: a Kosarstat lineup-slot (PG…C), ahol a legtöbb időt
  // töltötte – ugyanaz a forrás, mint a lineup nézet pozíciószűrőinél.
  // Kosarstat adat nélkül a keretpozíció a fallback.
  const LINEUP_SLOT_POSITIONS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];
  const slotSecondsByBoxName = new Map<string, number[]>();
  activeLineupTeam?.stints.forEach(stint => {
    if (stint.players.length !== 5 || !(stint.seconds > 0)) return;
    stint.players.forEach((lineupName, slotIndex) => {
      const boxName = nameResolution.matched.get(lineupName);
      if (!boxName) return;
      const slots = slotSecondsByBoxName.get(boxName) ?? [0, 0, 0, 0, 0];
      slots[slotIndex] += stint.seconds;
      slotSecondsByBoxName.set(boxName, slots);
    });
  });
  const gamePositionFor = (boxName: string): Position | null => {
    const slots = slotSecondsByBoxName.get(boxName);
    if (!slots) return null;
    const max = Math.max(...slots);
    return max > 0 ? LINEUP_SLOT_POSITIONS[slots.indexOf(max)] : null;
  };

  const players: PlayerGameStat[] = teamPlayers.map(row => {
    const seasonPlayer = seasonPlayers.find(player => String(player.id) === String(row.player_id));
    const resolvedName = resolveBoxName(row);
    const explicitStarter = typeof row.is_starter === 'boolean' ? row.is_starter : undefined;
    const inferredStarter = starterProfiles.length > 0
      ? matchesNormalizedNameProfile(resolvedName, starterProfiles)
      : undefined;

    return {
      playerId: row.player_id,
      name: resolvedName,
      position: gamePositionFor(resolvedName) ?? mapPosition(seasonPlayer?.position || 'PG'),
      isStarter: explicitStarter ?? inferredStarter,
      minutes: row.minutes || 0,
      points: row.points || 0,
      fga2: (row.close_attempted || 0) + (row.mid_attempted || 0),
      fgm2: (row.close_made || 0) + (row.mid_made || 0),
      fga3: row.three_attempted || 0,
      fgm3: row.three_made || 0,
      fta: row.free_throw_attempted || 0,
      ftm: row.free_throw_made || 0,
      oreb: row.offensive_rebounds || 0,
      dreb: row.defensive_rebounds || 0,
      ast: row.assists || 0,
      tov: row.turnovers || 0,
      stl: row.steals || 0,
      blk: row.blocks || 0,
      val: row.valuation || 0,
      roles: rolesByPlayerId.get(row.player_id) ?? [],
    };
  });

  const seasonStats: PostgameTeamSeasonStat = {
    teamId: selectedTeamStats.teamId,
    teamName: selectedTeamStats.teamName,
    league: selectedTeamStats.league,
    season: selectedTeamStats.season,
    games: selectedTeamStats.games,
    pointsFor: selectedTeamStats.pointsFor,
    pointsAgainst: selectedTeamStats.pointsAgainst,
    fga2: selectedTeamStats.fga2,
    fgm2: selectedTeamStats.fgm2,
    fga3: selectedTeamStats.fga3,
    fgm3: selectedTeamStats.fgm3,
    fta: selectedTeamStats.fta,
    ftm: selectedTeamStats.ftm,
    oreb: selectedTeamStats.oreb,
    dreb: selectedTeamStats.dreb,
    ast: selectedTeamStats.ast,
    tov: selectedTeamStats.tov,
    stl: selectedTeamStats.stl,
    blk: selectedTeamStats.blk,
    fouls: selectedTeamStats.fouls,
    val: selectedTeamStats.val,
    oppDreb: postgameOpponentTotalsByTeam.get(selectedTeamStats.teamId)?.dreb,
    oppPossessions: postgameOpponentTotalsByTeam.get(selectedTeamStats.teamId)?.possessions,
  };

  const baseReport = analyzePostGameReport(
    teamGame,
    opponentGame,
    seasonStats,
    postgameBenchmarks,
    players,
    postgamePregameXFactorContext,
    postgameShotContext ?? undefined
  );

  const lineupInsights: PostGameReport['lineupInsights'] | undefined = (() => {
    if (!activeLineupTeam) return undefined;

    const validStints = activeLineupTeam.stints.filter(stint => stint.seconds > 0 && stint.players.length === 5);
    const totalSeconds = validStints.reduce((sum, stint) => sum + stint.seconds, 0);
    const totalMinutes = roundValue(totalSeconds / 60, 1);

    const withDerived = validStints.map(stint => ({
      ...stint,
      netPer40: stint.seconds > 0 ? roundValue((stint.plusMinus * 2400) / stint.seconds, 1) : 0,
    }));

    // Kis mintára nem esünk vissza: 5 percnél rövidebb ötösből nincs rangsor.
    const topPool = withDerived.filter(stint => stint.seconds >= LINEUP_MIN_SAMPLE_SECONDS);
    const topLineup = [...topPool].sort((a, b) => b.netPer40 - a.netPer40 || b.seconds - a.seconds)[0] || null;

    const bottomCandidates = [...topPool]
      .filter(stint => !topLineup || stint.players.join('|') !== topLineup.players.join('|'))
      .sort((a, b) => a.netPer40 - b.netPer40 || b.seconds - a.seconds);
    const bottomLineup = bottomCandidates[0] || null;

    const topPairSource = activeLineupTeam.pairStats
      .filter(item => item.seconds >= LINEUP_MIN_SAMPLE_SECONDS)
      .sort((a, b) => b.netPer40 - a.netPer40 || b.seconds - a.seconds)[0] || null;

    const implications: string[] = [];
    if (topLineup && topLineup.netPer40 >= 6) {
      implications.push(`A legeredményesebb ötös (${topLineup.players.join(', ')}) jó ritmust hozott (${topLineup.netPer40.toFixed(1)} net/40), ezért érdemes ezt a felállást tudatosabban és korábban bevonni a rotációba.`);
    }
    if (bottomLineup && bottomLineup.netPer40 <= -6) {
      implications.push(`A kevésbé működő ötös (${bottomLineup.players.join(', ')}) ebben a meccsképben nehezebben találta az előnyöket (${bottomLineup.netPer40.toFixed(1)} net/40), ezért ellenfélfüggő szerep- vagy párosítási finomhangolás javasolt.`);
    }
    if (topLineup && bottomLineup) {
      const spread = roundValue(topLineup.netPer40 - bottomLineup.netPer40, 1);
      if (spread >= 10) {
        implications.push(`Jelentős különbség látszott az ötösök között (${spread.toFixed(1)} net/40), emiatt a csereegységek időzítése és szerkezete fontos meccsfaktor lehetett.`);
      }
    }
    if (topPairSource && topPairSource.netPer40 >= 6) {
      implications.push(`A legerősebb páros (${topPairSource.players.join(' + ')}) együtt stabilabban termelte az előnyt, ezért célszerű tudatosan közös perceket adni nekik.`);
    }
    if (totalMinutes < 12) {
      implications.push('A lineup minta korlátozott játékidőből áll össze, ezért az értékelés irányadó, de nem végleges ítélet.');
    }
    if (topPool.length === 0 && validStints.length > 0) {
      implications.push('Egyik ötös sem töltött együtt legalább 5 percet, ezért ötös-rangsor nem készült.');
    }

    return {
      available: validStints.length > 0,
      totalStints: validStints.length,
      totalMinutes,
      topLineup: topLineup
        ? {
            players: topLineup.players,
            minutes: roundValue(topLineup.seconds / 60, 1),
            plusMinus: topLineup.plusMinus,
            netPer40: topLineup.netPer40,
          }
        : null,
      bottomLineup: bottomLineup
        ? {
            players: bottomLineup.players,
            minutes: roundValue(bottomLineup.seconds / 60, 1),
            plusMinus: bottomLineup.plusMinus,
            netPer40: bottomLineup.netPer40,
          }
        : null,
      topPair: topPairSource
        ? {
            players: topPairSource.players,
            minutes: roundValue(topPairSource.seconds / 60, 1),
            netPer40: roundValue(topPairSource.netPer40, 1),
          }
        : null,
      implications,
    };
  })();

  // Lineup-alapú probléma: a meccs leggyengébb, legalább 5 percet együtt töltő
  // magja, box score névírással.
  const ownLineupModel = activeLineupTeam
    ? buildPostgameLineupSides({
        own: {
          teamName: activeLineupTeam.teamName,
          starters: activeLineupTeam.starters,
          stints: activeLineupTeam.stints,
          officialPlayers: activeLineupTeam.playerMinutes.map(item => ({ player: item.player, plusMinus: item.plusMinus })),
        },
        opponent: null,
        ownBoxNames: teamPlayers.map(resolveBoxName),
        opponentBoxNames: [],
      }).own
    : null;
  // A leggyengébb mag mellett a top 2 Impact-játékos (és a fő center) jelenléte is kiíródik.
  const topImpactPlayers = [...baseReport.playerReport.players]
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, 2)
    .map(player => player.name);
  const lineupProblem = ownLineupModel
    ? describeWeakestLineupCore(ownLineupModel, { topImpact: topImpactPlayers })
    : null;

  return mergeKosarstatPostgameContext(baseReport, kosarstatPostgameContext, {
    extraNotes: [...kosarstatPostgameNotes, ...nameNotes],
    lineupInsights,
    extraProblems: lineupProblem ? [lineupProblem] : [],
    starterSplit: ownLineupModel ? describeStarterSplit(ownLineupModel) : null,
    onOff: ownLineupModel?.onOff.map(row => ({
      player: row.player,
      onSeconds: row.onSeconds,
      onDiff: row.onFor - row.onAgainst,
      offDiff: row.offFor - row.offAgainst,
    })),
  });
};
