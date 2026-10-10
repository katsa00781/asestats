// Közös tesztadat: Atomerőmű SE – Sopron KC 109–80 (2026-10-10, Kosarstat
// 20261010102163) – valós box score, a webes dobástérkép zónaszámai és a
// Kosarstat csapatmutatói.
import type {
  KosarstatPointSourceTotals,
  PlayerGameStat,
  PostGameShotMapContext,
  ShotMapEventInput,
  TeamGameStat,
  TeamSeasonStat,
} from '../../lib/postgame-report';
import {
  analyzePostGameReport,
  buildKosarstatPostgameContext,
  buildTeamBenchmarks,
} from '../../lib/postgame-report';

// Valós box score: Atomerőmű SE – Sopron KC 109–80 (2026-10-10).
export const LEAGUE = 'NB I/A';
export const SEASON = '2026/2027';

export const ASE_GAME: TeamGameStat = {
  teamId: 'ase', teamName: 'Atomerőmű SE', league: LEAGUE, season: SEASON,
  pointsFor: 109, pointsAgainst: 80,
  fga2: 34, fgm2: 23, fga3: 30, fgm3: 14, fta: 25, ftm: 21,
  oreb: 10, dreb: 20, ast: 21, tov: 10, stl: 12, blk: 2, fouls: 0, val: 157,
  actualPointsFor: 109, actualPointsAgainst: 80, result: 'win',
};
export const SOPRON_GAME: TeamGameStat = {
  teamId: 'opponent', teamName: 'Sopron KC', league: LEAGUE, season: SEASON,
  pointsFor: 80, pointsAgainst: 109,
  fga2: 33, fgm2: 17, fga3: 23, fgm3: 9, fta: 22, ftm: 19,
  oreb: 9, dreb: 16, ast: 14, tov: 19, stl: 6, blk: 0, fouls: 0, val: 95,
  actualPointsFor: 80, actualPointsAgainst: 109, result: 'loss',
};

/** Szezonsor: 3 meccs, a megadott meccsenkénti átlagokból. */
export const seasonOf = (teamId: string, perGame: Partial<TeamSeasonStat>): TeamSeasonStat => {
  const base = {
    pointsFor: 85, pointsAgainst: 82, fga2: 40, fgm2: 21, fga3: 24, fgm3: 8.4, fta: 20, ftm: 15,
    oreb: 10, dreb: 24, ast: 18, tov: 13, stl: 7, blk: 2, fouls: 20, val: 95, oppDreb: 24, oppPossessions: 75,
    ...perGame,
  };
  const total = Object.fromEntries(Object.entries(base).map(([key, value]) => [key, Number(value) * 3]));
  return { teamId, teamName: teamId, league: LEAGUE, season: SEASON, games: 3, ...total } as TeamSeasonStat;
};

// Az ASE szezonja: a 2P-kísérletarány 62,5% (a meccsen 53,1% → −9,4 pp),
// OREB% 33,3% (a meccsen 38,5% → +5,2 pp), a többi mutató a meccs alatt.
export const ASE_SEASON = seasonOf('ase', {
  pointsFor: 98, pointsAgainst: 80, fga2: 40, fgm2: 24, fga3: 24, fgm3: 9, fta: 22, ftm: 18,
  oreb: 10, dreb: 22, ast: 20, tov: 12, oppDreb: 20, oppPossessions: 76,
});
// A liga 3P%-a 35% körül: az ellenfél 39,1%-a 3–6 pp-vel a medián felett.
export const LEAGUE_TEAMS: TeamSeasonStat[] = [
  ASE_SEASON,
  seasonOf('t1', { fgm3: 8.2 }), seasonOf('t2', { fgm3: 8.4 }), seasonOf('t3', { fgm3: 8.4 }),
  seasonOf('t4', { fgm3: 8.6 }), seasonOf('t5', { fgm3: 8.3 }), seasonOf('t6', { fgm3: 8.5 }),
];
export const BENCHMARKS = buildTeamBenchmarks(LEAGUE_TEAMS);

type BoxRow = [string, number, number, [number, number], [number, number], [number, number], [number, number], number, number, number, number, number, number, number, boolean];
export const ASE_BOX: BoxRow[] = [
  ['BENKE Szilárd', 27, 21, [2, 3], [0, 0], [4, 4], [5, 6], 0, 1, 3, 1, 0, 0, 26, true],
  ['YOUNG Kalif Karl', 25, 9, [3, 6], [0, 0], [0, 0], [3, 4], 6, 3, 1, 0, 1, 0, 19, true],
  ['HALMAI Dániel', 23, 17, [3, 4], [0, 0], [3, 6], [2, 2], 2, 0, 5, 0, 2, 0, 23, false],
  ['CHANDLER III. John Watson', 23, 19, [3, 4], [1, 1], [2, 4], [5, 6], 0, 3, 4, 1, 3, 0, 31, true],
  ['DANIELS II Clarence Oliver', 21, 6, [0, 0], [0, 0], [2, 6], [0, 0], 0, 5, 1, 1, 0, 1, 9, false],
  ['RÉVÉSZ Ádám', 20, 8, [4, 4], [0, 0], [0, 2], [0, 0], 1, 4, 3, 1, 1, 1, 16, true],
  ['JOSEPH Yasiin Yousef', 17, 12, [2, 4], [0, 0], [2, 4], [2, 2], 0, 0, 3, 2, 2, 0, 14, true],
  ['GÉRINGER Gergő', 17, 2, [1, 2], [0, 0], [0, 1], [0, 0], 0, 3, 1, 1, 2, 0, 5, false],
  ['EILINGSFELD János', 15, 13, [3, 4], [0, 0], [1, 3], [4, 5], 1, 0, 0, 1, 1, 0, 14, false],
  ['KRIVACEVIC Markó', 7, 2, [1, 1], [0, 1], [0, 0], [0, 0], 0, 1, 0, 2, 0, 0, 0, false],
  ['MERKL Barna Márton', 5, 0, [0, 0], [0, 0], [0, 0], [0, 0], 0, 0, 0, 0, 0, 0, 0, false],
];
export const PLAYERS: PlayerGameStat[] = ASE_BOX.map(([name, minutes, points, close, mid, three, ft, oreb, dreb, ast, tov, stl, blk, val, isStarter]) => ({
  playerId: name, name, position: 'SF', isStarter, minutes, points,
  fga2: close[1] + mid[1], fgm2: close[0] + mid[0], fga3: three[1], fgm3: three[0], fta: ft[1], ftm: ft[0],
  oreb, dreb, ast, tov, stl, blk, val, roles: [],
}));

/** `count` dobás az adott zónából, az első `made` sikeres. */
export const ZONE_POINT = { rim: [6, 50], paint: [20, 50], mid: [30, 50], three: [40, 50], corner3: [26, 5] } as const;
export const shots = (zone: keyof typeof ZONE_POINT, count: number, made: number): ShotMapEventInput[] =>
  Array.from({ length: count }, (_, index) => ({
    playerId: null, x: ZONE_POINT[zone][0], y: ZONE_POINT[zone][1], isSuccessful: index < made, shotSide: 'home' as const,
  }));
// A webes dobástérkép számai: 63 kísérlet (36 jó, 57,1%); gyűrű 39,7% (FG 72%),
// középtáv 7,9%, tripla 46,0% (FG 44,8%), sarok 1,6% – a maradék 4 a festék zóna.
export const GAME_SHOTS = [
  ...shots('rim', 25, 18), ...shots('paint', 4, 2), ...shots('mid', 5, 3),
  ...shots('three', 28, 13), ...shots('corner3', 1, 0),
];
// Szezon: gyűrű 33,2%, festék 14,0%, középtáv 16,8%, tripla 36,0% (ebből sarok 3,7%).
export const SEASON_SHOTS = [
  ...shots('rim', 332, 224), ...shots('paint', 140, 60), ...shots('mid', 168, 62),
  ...shots('three', 323, 112), ...shots('corner3', 37, 14),
];
export const SHOT_MAP: PostGameShotMapContext = { gameShots: GAME_SHOTS, seasonShots: SEASON_SHOTS };

export const report = (shotMap?: PostGameShotMapContext) =>
  analyzePostGameReport(ASE_GAME, SOPRON_GAME, ASE_SEASON, BENCHMARKS, PLAYERS, undefined, shotMap);

export const POINT_SOURCES: KosarstatPointSourceTotals = {
  home: { points: 109, secondChancePoints: 7, pointsOffTurnovers: 28, quickFinishPoints: 20 },
  away: { points: 80, secondChancePoints: 10, pointsOffTurnovers: 9, quickFinishPoints: 8 },
  quickFinishSeconds: 6,
};
export const kosarstat = (options: { expected?: boolean; sources?: KosarstatPointSourceTotals | null } = {}) =>
  buildKosarstatPostgameContext({
    ownSide: 'home',
    teamName: 'Atomerőmű SE',
    quarterStats: [],
    teamMetrics: [
      { team_side: 'home', team_name: 'Atomerőmű SE', poss: 75, ortg: 145.3, efg: 68.8, tov_pct: 13.3, orb_pct: 38.4, ftm_rate: 0.328 },
      { team_side: 'away', team_name: 'Sopron KC', poss: 75.7, ortg: 105.7, efg: 54.5, tov_pct: 25.1, orb_pct: 31.0, ftm_rate: 0.339 },
    ],
    pointSources: options.sources === undefined ? POINT_SOURCES : options.sources,
    expectedPoints: options.expected === false ? null : { own: 109, opponent: 80 },
  });
