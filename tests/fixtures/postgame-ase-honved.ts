// Közös tesztadat: Atomerőmű SE – Budapesti Honvéd 112–81 (2026-10-17, Kosarstat
// 20261017102114) – valós box score (mindkét csapat), a dobástérkép valós
// zónaszámai (meccs és szezon), szintetikus szezon- és ligasorok.
import type { PlayerGameStat, PostGameShotMapContext, TeamGameStat } from '../../lib/postgame-report';
import { analyzePostGameReport, buildTeamBenchmarks } from '../../lib/postgame-report';
import { LEAGUE, SEASON, seasonOf, shots } from './postgame-ase-sopron';

export const ASE_GAME: TeamGameStat = {
  teamId: 'ase', teamName: 'Atomerőmű SE', league: LEAGUE, season: SEASON,
  pointsFor: 112, pointsAgainst: 81,
  fga2: 42, fgm2: 20, fga3: 36, fgm3: 18, fta: 21, ftm: 18,
  oreb: 17, dreb: 25, ast: 29, tov: 11, stl: 6, blk: 1, fouls: 24, val: 155,
  actualPointsFor: 112, actualPointsAgainst: 81, result: 'win',
};
export const HONVED_GAME: TeamGameStat = {
  teamId: 'opponent', teamName: 'Budapesti Honvéd Sportegyesület', league: LEAGUE, season: SEASON,
  pointsFor: 81, pointsAgainst: 112,
  fga2: 30, fgm2: 16, fga3: 29, fgm3: 10, fta: 24, ftm: 19,
  oreb: 4, dreb: 23, ast: 15, tov: 11, stl: 5, blk: 2, fouls: 19, val: 105,
  actualPointsFor: 81, actualPointsAgainst: 112, result: 'loss',
};

// Az ASE szezonja: erős támadás (ORtg ~136), a liga felett lepattanózó csapat.
export const ASE_SEASON = seasonOf('ase', {
  pointsFor: 105, pointsAgainst: 84, fga2: 38, fgm2: 22, fga3: 30, fgm3: 12, fta: 22, ftm: 17,
  oreb: 12, dreb: 24, ast: 24, tov: 12, oppDreb: 22, oppPossessions: 76,
});
// Liga: FTM rate medián ~28% (18 / 64), OREB% ~29%, eFG ~49%, TO rate ~15%.
export const LEAGUE_TEAMS = [
  ASE_SEASON,
  seasonOf('t1', { ftm: 17.5 }), seasonOf('t2', { ftm: 18 }), seasonOf('t3', { ftm: 18 }),
  seasonOf('t4', { ftm: 18.5 }), seasonOf('t5', { ftm: 17.8 }), seasonOf('t6', { ftm: 18.2 }),
];
export const BENCHMARKS = buildTeamBenchmarks(LEAGUE_TEAMS);

// [név, perc, pont, 2P [jó, kís], 3P, FT, TLep, VLep, Gp, LV, St, Bl, VAL, kezdő]
type BoxRow = [string, number, number, [number, number], [number, number], [number, number], number, number, number, number, number, number, number, boolean];
export const ASE_BOX: BoxRow[] = [
  ['BENKE Szilárd', 24, 11, [4, 8], [1, 4], [0, 1], 1, 0, 2, 0, 1, 0, 11, true],
  ['EILINGSFELD János', 24, 14, [2, 4], [3, 5], [1, 1], 3, 4, 4, 1, 1, 0, 23, true],
  ['DANIELS II Clarence Oliver', 23, 21, [3, 9], [4, 8], [3, 3], 0, 4, 0, 0, 0, 0, 16, false],
  ['YOUNG Kalif Karl', 22, 8, [4, 7], [0, 0], [0, 1], 5, 5, 3, 2, 0, 1, 17, true],
  ['JOSEPH Yasiin Yousef', 21, 13, [0, 1], [4, 6], [1, 1], 1, 4, 6, 2, 0, 0, 21, true],
  ['HALMAI Dániel', 20, 8, [0, 0], [2, 3], [2, 2], 1, 0, 7, 2, 1, 0, 16, false],
  ['RÉVÉSZ Ádám', 19, 4, [1, 3], [0, 0], [2, 2], 3, 0, 4, 2, 0, 0, 8, false],
  ['CHANDLER III. John Watson', 17, 17, [2, 5], [2, 7], [7, 7], 0, 4, 1, 0, 2, 0, 20, true],
  ['GÉRINGER Gergő', 16, 12, [2, 2], [2, 3], [2, 3], 0, 2, 1, 1, 0, 0, 14, false],
  ['KRIVACEVIC Markó', 8, 4, [2, 2], [0, 0], [0, 0], 1, 2, 0, 0, 0, 0, 7, false],
  ['MERKL Barna Márton', 3, 0, [0, 0], [0, 0], [0, 0], 0, 0, 0, 0, 1, 0, 1, false],
  ['NAGY Dániel', 3, 0, [0, 1], [0, 0], [0, 0], 2, 0, 1, 1, 0, 0, 1, false],
];
export const PLAYERS: PlayerGameStat[] = ASE_BOX.map(([name, minutes, points, two, three, ft, oreb, dreb, ast, tov, stl, blk, val, isStarter]) => ({
  playerId: name, name, position: 'SF', isStarter, minutes, points,
  fga2: two[1], fgm2: two[0], fga3: three[1], fgm3: three[0], fta: ft[1], ftm: ft[0],
  oreb, dreb, ast, tov, stl, blk, val, roles: [],
}));

// A dobástérkép valós számai: 75 dobás – gyűrű 12/28, festék 3/7, középtáv
// 7/9, tripla 14/31 (a box score-ban 3P 18/36, 2P 20/42: a térképen 2 kétpontos
// találattal több és 4 hármassal kevesebb van).
export const GAME_SHOTS = [
  ...shots('rim', 28, 12), ...shots('paint', 7, 3), ...shots('mid', 9, 7), ...shots('three', 31, 14),
];
// Szezon (a meccsel együtt, 289 dobás): gyűrű 60/99 (60,6%).
export const SEASON_SHOTS = [
  ...shots('rim', 99, 60), ...shots('paint', 37, 18), ...shots('mid', 45, 22),
  ...shots('three', 100, 41), ...shots('corner3', 8, 3),
];
export const SHOT_MAP: PostGameShotMapContext = { gameShots: GAME_SHOTS, seasonShots: SEASON_SHOTS };

export const report = (shotMap: PostGameShotMapContext | undefined = SHOT_MAP) =>
  analyzePostGameReport(ASE_GAME, HONVED_GAME, ASE_SEASON, BENCHMARKS, PLAYERS, undefined, shotMap);
