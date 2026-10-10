import type {
  KosarstatPointSourceTotals,
  PlayerGameStat,
  PostGameShotMapContext,
  ShotMapEventInput,
  TeamGameStat,
  TeamSeasonStat,
} from '../lib/postgame-report';
import {
  analyzePostGameReport,
  buildKosarstatPostgameContext,
  buildPostgameAutoFocus,
  buildTeamBenchmarks,
  mergeKosarstatPostgameContext,
} from '../lib/postgame-report';
import { postgameReportToMd } from '../lib/export-to-md';
import assert from 'node:assert/strict';
import { test } from 'node:test';

// Valós box score: Atomerőmű SE – Sopron KC 109–80 (2026-10-10).
const LEAGUE = 'NB I/A';
const SEASON = '2026/2027';

const ASE_GAME: TeamGameStat = {
  teamId: 'ase', teamName: 'Atomerőmű SE', league: LEAGUE, season: SEASON,
  pointsFor: 109, pointsAgainst: 80,
  fga2: 34, fgm2: 23, fga3: 30, fgm3: 14, fta: 25, ftm: 21,
  oreb: 10, dreb: 20, ast: 21, tov: 10, stl: 12, blk: 2, fouls: 0, val: 157,
  actualPointsFor: 109, actualPointsAgainst: 80, result: 'win',
};
const SOPRON_GAME: TeamGameStat = {
  teamId: 'opponent', teamName: 'Sopron KC', league: LEAGUE, season: SEASON,
  pointsFor: 80, pointsAgainst: 109,
  fga2: 33, fgm2: 17, fga3: 23, fgm3: 9, fta: 22, ftm: 19,
  oreb: 9, dreb: 16, ast: 14, tov: 19, stl: 6, blk: 0, fouls: 0, val: 95,
  actualPointsFor: 80, actualPointsAgainst: 109, result: 'loss',
};

/** Szezonsor: 3 meccs, a megadott meccsenkénti átlagokból. */
const seasonOf = (teamId: string, perGame: Partial<TeamSeasonStat>): TeamSeasonStat => {
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
const ASE_SEASON = seasonOf('ase', {
  pointsFor: 98, pointsAgainst: 80, fga2: 40, fgm2: 24, fga3: 24, fgm3: 9, fta: 22, ftm: 18,
  oreb: 10, dreb: 22, ast: 20, tov: 12, oppDreb: 20, oppPossessions: 76,
});
// A liga 3P%-a 35% körül: az ellenfél 39,1%-a 3–6 pp-vel a medián felett.
const LEAGUE_TEAMS: TeamSeasonStat[] = [
  ASE_SEASON,
  seasonOf('t1', { fgm3: 8.2 }), seasonOf('t2', { fgm3: 8.4 }), seasonOf('t3', { fgm3: 8.4 }),
  seasonOf('t4', { fgm3: 8.6 }), seasonOf('t5', { fgm3: 8.3 }), seasonOf('t6', { fgm3: 8.5 }),
];
const BENCHMARKS = buildTeamBenchmarks(LEAGUE_TEAMS);

type BoxRow = [string, number, number, [number, number], [number, number], [number, number], [number, number], number, number, number, number, number, number, number, boolean];
const ASE_BOX: BoxRow[] = [
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
const PLAYERS: PlayerGameStat[] = ASE_BOX.map(([name, minutes, points, close, mid, three, ft, oreb, dreb, ast, tov, stl, blk, val, isStarter]) => ({
  playerId: name, name, position: 'SF', isStarter, minutes, points,
  fga2: close[1] + mid[1], fgm2: close[0] + mid[0], fga3: three[1], fgm3: three[0], fta: ft[1], ftm: ft[0],
  oreb, dreb, ast, tov, stl, blk, val, roles: [],
}));

/** `count` dobás az adott zónából, az első `made` sikeres. */
const ZONE_POINT = { rim: [6, 50], paint: [20, 50], mid: [30, 50], three: [40, 50], corner3: [26, 5] } as const;
const shots = (zone: keyof typeof ZONE_POINT, count: number, made: number): ShotMapEventInput[] =>
  Array.from({ length: count }, (_, index) => ({
    playerId: null, x: ZONE_POINT[zone][0], y: ZONE_POINT[zone][1], isSuccessful: index < made, shotSide: 'home' as const,
  }));
// A webes dobástérkép számai: 63 kísérlet (36 jó, 57,1%); gyűrű 39,7% (FG 72%),
// középtáv 7,9%, tripla 46,0% (FG 44,8%), sarok 1,6% – a maradék 4 a festék zóna.
const GAME_SHOTS = [
  ...shots('rim', 25, 18), ...shots('paint', 4, 2), ...shots('mid', 5, 3),
  ...shots('three', 28, 13), ...shots('corner3', 1, 0),
];
// Szezon: gyűrű 33,2%, festék 14,0%, középtáv 16,8%, tripla 36,0% (ebből sarok 3,7%).
const SEASON_SHOTS = [
  ...shots('rim', 332, 224), ...shots('paint', 140, 60), ...shots('mid', 168, 62),
  ...shots('three', 323, 112), ...shots('corner3', 37, 14),
];
const SHOT_MAP: PostGameShotMapContext = { gameShots: GAME_SHOTS, seasonShots: SEASON_SHOTS };

const report = (shotMap?: PostGameShotMapContext) =>
  analyzePostGameReport(ASE_GAME, SOPRON_GAME, ASE_SEASON, BENCHMARKS, PLAYERS, undefined, shotMap);

const POINT_SOURCES: KosarstatPointSourceTotals = {
  home: { points: 109, secondChancePoints: 7, pointsOffTurnovers: 28, quickFinishPoints: 20 },
  away: { points: 80, secondChancePoints: 10, pointsOffTurnovers: 9, quickFinishPoints: 8 },
  quickFinishSeconds: 6,
};
const kosarstat = (options: { expected?: boolean; sources?: KosarstatPointSourceTotals | null } = {}) =>
  buildKosarstatPostgameContext({
    ownSide: 'home',
    teamName: 'Atomerőmű SE',
    quarterStats: [],
    teamMetrics: [
      { team_side: 'home', team_name: 'Atomerőmű SE', poss: 75, ortg: 145.3, efg: 68.8, tov_pct: 13.3, orb_pct: 38.4, ftm_rate: 32.8 },
      { team_side: 'away', team_name: 'Sopron KC', poss: 75.7, ortg: 105.7, efg: 54.5, tov_pct: 25.1, orb_pct: 31.0, ftm_rate: 33.9 },
    ],
    pointSources: options.sources === undefined ? POINT_SOURCES : options.sources,
    expectedPoints: options.expected === false ? null : { own: 109, opponent: 80 },
  });

test('Festék-állítás csak a dobástérkép gyűrű + festék zónájából: növekvő gyűrű-aránynál nincs „visszaesés”', () => {
  const result = report(SHOT_MAP);
  const comparison = result.shotMap?.comparison;
  assert.ok(comparison);
  // Gyűrű +6,5 pp, a gyűrűn kívüli festék zóna −7,7 pp → együtt −1,2 pp.
  assert.equal(comparison.rimRateDelta, 6.5);
  assert.equal(comparison.paintRateDelta, -7.7);
  assert.equal(comparison.interiorRateDelta, -1.2);
  assert.equal(result.shotMap?.team?.rimPct, 72);

  const lines = [...result.problems, ...result.nextFocus, ...result.strengths, ...result.decisiveFactors.offense];
  assert.ok(!lines.some(item => /Festékbefejezések visszaestek|2P-kísérletek aránya|rim run/.test(item)), lines.join('\n'));
});

test('Dobástérkép nélkül a sor a tényleges mutatót nevezi meg, festékre és rim runra nem hivatkozik', () => {
  const result = report();
  const line = result.problems.find(item => item.startsWith('2P-kísérletek aránya visszaesett'));
  assert.ok(line, result.problems.join('\n'));
  assert.match(line, /-9\.4 százalékpont; dobástérkép nélkül a festék-volumen nem ítélhető meg/);
  assert.ok(![...result.problems, ...result.nextFocus].some(item => /Festékbefejezések|rim run/.test(item)));
});

test('Valódi belső visszaesésnél a sor megmarad, mindkét zóna értékével, és jön a fókusz is', () => {
  const result = report({
    gameShots: [...shots('rim', 12, 8), ...shots('paint', 4, 2), ...shots('mid', 18, 8), ...shots('three', 29, 13)],
    seasonShots: SEASON_SHOTS,
  });
  const line = result.problems.find(item => item.startsWith('Festékbefejezések visszaestek'));
  assert.ok(line, result.problems.join('\n'));
  assert.match(line, /gyűrű \+ festék zóna aránya -21\.8 pp; gyűrű -14\.2 pp, festék -7\.7 pp/);
  assert.ok(result.nextFocus.some(item => item.includes('rim run')));
});

test('A dobástérkép hiányzó dobása jelölve van (63 a 64 mezőnykísérletből)', () => {
  const result = report(SHOT_MAP);
  assert.deepEqual(result.shotMap?.coverage, { shotMapAttempts: 63, boxAttempts: 64, missing: 1 });
  const note = result.dataNotes.find(item => item.startsWith('Dobástérkép lefedettség'));
  assert.ok(note, result.dataNotes.join('\n'));
  assert.match(note, /63 dobás a box score 64 mezőnykísérletéből \(1 hiányzik\)/);
  assert.match(note, /57\.1%.*57\.8% \(37\/64\)/);

  // Teljes dobástérképnél nincs megjegyzés.
  const full = report({ gameShots: [...GAME_SHOTS, ...shots('mid', 1, 1)], seasonShots: SEASON_SHOTS });
  assert.equal(full.shotMap?.coverage?.missing, 0);
  assert.ok(!full.dataNotes.some(item => item.startsWith('Dobástérkép')));
});

test('ORB%-előny negatív második esély mellett nem erősség (7–10)', () => {
  const context = kosarstat();
  assert.ok(!context.strengths.some(item => item.includes('ORB%')), context.strengths.join('\n'));
  assert.deepEqual(
    context.problems.filter(item => item.startsWith('Támadólepattanó-fölény')),
    ['Támadólepattanó-fölény nem vált pontra: ORB% különbség +7.4 pp, második esélyből 7–10 pont.']
  );

  // A riport saját „Támadólepattanózás erős” sora is kikerül az erősségek közül.
  const base = report(SHOT_MAP);
  assert.ok(base.strengths.some(item => item.startsWith('Támadólepattanózás erős')), base.strengths.join('\n'));
  const merged = mergeKosarstatPostgameContext(base, context);
  assert.ok(!merged.strengths.some(item => /ORB%|Támadólepattanózás erős/.test(item)), merged.strengths.join('\n'));
  assert.equal(merged.problems.filter(item => item.startsWith('Támadólepattanó-fölény')).length, 1);
  // A „tartsd fenn” fókusz helyére a pontra váltás lép.
  assert.ok(base.nextFocus.some(item => item.startsWith('OREB agresszivitás fenntartása')));
  assert.ok(!merged.nextFocus.some(item => item.startsWith('OREB agresszivitás fenntartása')));
  assert.equal(merged.nextFocus.filter(item => item.startsWith('Második esélyek pontra váltása')).length, 1);
  assert.match(merged.nextFocus.join('\n'), /második esélyből 7–10 pont/);
});

test('A végeredmény ismerete nélkül a kontextus nem ítél, az összefűzés viszont igen', () => {
  const context = kosarstat({ expected: false });
  assert.ok(context.strengths.includes('Második esély: ORB% különbség +7.4 pp.'));
  const merged = mergeKosarstatPostgameContext(report(SHOT_MAP), context);
  assert.ok(!merged.strengths.some(item => /ORB%|Támadólepattanózás erős/.test(item)));
  const problem = merged.problems.find(item => item.startsWith('Támadólepattanó-fölény'));
  assert.ok(problem);
  assert.match(problem, /OREB% \+5\.2 százalékpont a referenciához képest; ORB% különbség \+7\.4 pp, második esélyből 7–10 pont/);
});

test('Pozitív második esély vagy hiányzó / hibás pontforrás mellett az erősség marad', () => {
  const positive = kosarstat({ sources: { ...POINT_SOURCES, home: { ...POINT_SOURCES.home, secondChancePoints: 14 } } });
  assert.ok(positive.strengths.includes('Második esély: ORB% különbség +7.4 pp.'));
  assert.ok(kosarstat({ sources: null }).strengths.includes('Második esély: ORB% különbség +7.4 pp.'));
  // Az eseménylista pontösszege nem egyezik a végeredménnyel → nincs mihez mérni.
  const broken = kosarstat({ sources: { ...POINT_SOURCES, home: { ...POINT_SOURCES.home, points: 101 } } });
  assert.ok(broken.strengths.includes('Második esély: ORB% különbség +7.4 pp.'));
  const merged = mergeKosarstatPostgameContext(report(SHOT_MAP), broken);
  assert.ok(merged.strengths.some(item => item.includes('ORB%')));
});

test('Az Impact címke rangja az osztályt követi: a padról jövő alappillér nem kap alacsonyabb címkét', () => {
  const players = report(SHOT_MAP).playerReport.players;
  const byName = new Map(players.map(player => [player.name, player]));
  const halmai = byName.get('HALMAI Dániel');
  const joseph = byName.get('JOSEPH Yasiin Yousef');
  assert.ok(halmai && joseph);
  assert.ok(halmai.impactScore > joseph.impactScore);
  assert.equal(halmai.impactLabel, 'Stabil alappillér (padról)');
  assert.equal(joseph.impactLabel, 'Stabil alappillér');
  // 15 perc a padról: az alappillérhez kevés a játékidő – a címke ezt kimondja.
  const eilingsfeld = byName.get('EILINGSFELD János');
  assert.ok(eilingsfeld && eilingsfeld.impactScore > joseph.impactScore);
  assert.equal(eilingsfeld.impactLabel, 'Rotációs hozzájárulás (rövid percben)');
  assert.equal(byName.get('RÉVÉSZ Ádám')?.impactLabel, 'Rotációs hozzájárulás');

  const classRank = { mvp: 3, engine: 2, support: 1, struggling: 0 } as const;
  const labelRank = (label: string) =>
    label === 'Elsődleges motor' || label === 'Hatékony szerepjátékos' ? 3
      : label.startsWith('Stabil alappillér') ? 2
        : label.startsWith('Rotációs hozzájárulás') ? 1 : 0;
  for (const player of players) {
    assert.equal(labelRank(player.impactLabel), classRank[player.impactClass], `${player.name}: ${player.impactLabel}`);
  }
});

test('A fókuszlista az ellenfél-specifikus periméter-kockázattal indul, és az MD ugyanezt írja ki', () => {
  const context = kosarstat();
  const merged = mergeKosarstatPostgameContext(report(SHOT_MAP), context);
  const focus = buildPostgameAutoFocus(merged, context);
  assert.ok(focus.length <= 3);
  assert.ok(
    focus.some(item => item.startsWith('Ellenfél-specifikus fókusz: Periméter-kockázat (ellenfél 3P 9/23, 39.1%')),
    focus.join('\n')
  );

  const md = postgameReportToMd(merged, SEASON, undefined, { focus });
  const section = md.split('## Következő fókusz')[1]?.split('\n## ')[0] ?? '';
  for (const item of focus) assert.ok(section.includes(`- ${item}`), item);
  assert.ok(!md.includes('Festékbefejezések visszaestek'));

  // `extras.focus` nélkül az export a riportból maga állítja elő ugyanazt a listát.
  const fallback = postgameReportToMd(merged, SEASON).split('## Következő fókusz')[1] ?? '';
  assert.ok(fallback.includes('Ellenfél-specifikus fókusz: Periméter-kockázat'));
});
