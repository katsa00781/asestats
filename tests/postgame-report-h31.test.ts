// H31 – post-game riport (ASE–Alba Fehérvár 102–91 után): a „Fő ok” a
// pontkülönbség-bontásból, a Net-eltérés oka külön sorban, „ellensúlyozta”,
// a ratingek liga mediánja, a fókusz sorrendje a becsült pontköltség szerint
// (belső védekezési céllal), az eFG egy sorban, a hiányzó Reflexió jelzése.
import type { TeamGameStat } from '../lib/postgame-report';
import {
  analyzePostGameReport,
  buildKosarstatPostgameContext,
  buildPostgameAutoFocus,
  mergeKosarstatPostgameContext,
} from '../lib/postgame-report';
import { postgameReportToMd } from '../lib/export-to-md';
import { BENCHMARKS, LEAGUE, PLAYERS, SEASON, seasonOf } from './fixtures/postgame-ase-sopron';
import assert from 'node:assert/strict';
import { test } from 'node:test';

// Valós box score: Atomerőmű SE – Alba Fehérvár 102–91 (2026-11-14).
const ASE_GAME: TeamGameStat = {
  teamId: 'ase', teamName: 'Atomerőmű SE', league: LEAGUE, season: SEASON,
  pointsFor: 102, pointsAgainst: 91,
  fga2: 37, fgm2: 22, fga3: 26, fgm3: 11, fta: 33, ftm: 25,
  oreb: 9, dreb: 22, ast: 15, tov: 11, stl: 9, blk: 0, fouls: 0, val: 134,
  actualPointsFor: 102, actualPointsAgainst: 91, result: 'win',
};
const ALBA_GAME: TeamGameStat = {
  teamId: 'opponent', teamName: 'Alba Fehérvár', league: LEAGUE, season: SEASON,
  pointsFor: 91, pointsAgainst: 102,
  fga2: 31, fgm2: 22, fga3: 25, fgm3: 12, fta: 17, ftm: 11,
  oreb: 2, dreb: 19, ast: 24, tov: 16, stl: 7, blk: 1, fouls: 0, val: 100,
  actualPointsFor: 91, actualPointsAgainst: 102, result: 'loss',
};
// Erős szezon: magas Net, alacsony kapott pont – a meccsen a védekezés esik vissza.
const ASE_SEASON = seasonOf('ase', {
  pointsFor: 99, pointsAgainst: 76, fga2: 38, fgm2: 22.5, fga3: 27, fgm3: 11, fta: 22, ftm: 16,
  oreb: 13, dreb: 24, ast: 20, tov: 10, oppDreb: 18, oppPossessions: 78,
});

const report = () => analyzePostGameReport(ASE_GAME, ALBA_GAME, ASE_SEASON, BENCHMARKS, PLAYERS);
const kosarstat = () => buildKosarstatPostgameContext({
  ownSide: 'home',
  teamName: 'Atomerőmű SE',
  quarterStats: [],
  teamMetrics: [
    { team_side: 'home', team_name: 'Atomerőmű SE', poss: 79.5, ortg: 128.3, efg: 61.1, tov_pct: 13.8, orb_pct: 32.1, ftm_rate: 0.397 },
    { team_side: 'away', team_name: 'Alba Fehérvár', poss: 77.5, ortg: 117.5, efg: 71.4, tov_pct: 20.6, orb_pct: 8.3, ftm_rate: 0.196 },
  ],
  pointSources: {
    home: { points: 102, secondChancePoints: 8, pointsOffTurnovers: 23, quickFinishPoints: 18 },
    away: { points: 91, secondChancePoints: 7, pointsOffTurnovers: 15, quickFinishPoints: 11 },
    quickFinishSeconds: 6,
  },
  expectedPoints: { own: 102, opponent: 91 },
});

test('Fő ok: ugyanabból a volumen / hatékonyság bontásból, mint a „Mi döntötte el”', () => {
  const result = report();
  assert.equal(result.metrics.marginBreakdown?.volume, 20.1);
  assert.equal(result.metrics.marginBreakdown?.efficiency, -9.1);
  assert.match(result.summary, /• Fő ok: az előnyt elsősorban a volumen hozta \(\+20\.1 pont\), a hatékonyság -9\.1 ponttal ellensúlyozta\./);
  assert.doesNotMatch(result.summary, /Fő ok: .*támadás \(ORtg\)/);
  assert.doesNotMatch(result.summary, /Elsősorban a volumen döntött/);
});

test('A Net eltérése a szezonátlagtól: a védekezés a forrás, részaránnyal', () => {
  const result = report();
  const ratings = result.metrics.ratings;
  assert.ok(ratings && ratings.refDrtg !== null && ratings.refOrtg !== null);
  // A győzelem ellenére mindkét oldal a szezonátlag alatt: a jobban romló védekezés az ok.
  assert.ok(ratings.drtg - ratings.refDrtg > ratings.refOrtg - ratings.ortg);
  assert.equal(ratings.primaryCause, 'defense');
  assert.match(
    result.summary,
    /• Eltérés a szezonátlagtól: Net \+\d+\.\d → \+\d+\.\d: a -\d+\.\d pontos \(100 birtoklásra\) visszaeséséből -\d+\.\d a védekezésből \(DRtg \d+\.\d → \d+\.\d, az eltérés \d+%-a\), -\d+\.\d a támadásból \(ORtg \d+\.\d → \d+\.\d\) – elsősorban a védekezés okozta\./
  );
});

test('Védekezés: a verdikttel szemben ható faktor „ellensúlyozta”, nem „ellene szólt”', () => {
  const result = report();
  assert.equal(result.context.defenseEfficiencyDelta, 'Lower');
  assert.match(result.summary, /ellensúlyozta: .*labdaszerzés/);
  assert.doesNotMatch(result.summary, /ellene szólt/);
});

test('Kulcs mutatók: a DRtg sor liga mediánja ugyanaz, mint az összefoglalóé', () => {
  const result = report();
  const leagueDrtg = result.context.defense?.leagueDrtg;
  assert.equal(typeof leagueDrtg, 'number');
  const md = postgameReportToMd(result, SEASON);
  const drtg = result.metrics.ratings!.drtg;
  const vsLeague = (drtg - (leagueDrtg as number));
  const row = `| DRtg (alacsonyabb a jobb) | ${drtg.toFixed(1)} |`;
  const line = md.split('\n').find(item => item.startsWith(row));
  assert.ok(line, md);
  assert.ok(line.endsWith(`| ${(leagueDrtg as number).toFixed(1)} | +${vsLeague.toFixed(1)} ▼ |`), line);
  assert.doesNotMatch(md, /\| ORtg \|.*\| – \| – \|/);
});

test('Következő fókusz: a becsült pontköltség dönt, két védekezési cél az OREB előtt', () => {
  const merged = mergeKosarstatPostgameContext(report(), kosarstat());
  const focus = buildPostgameAutoFocus(merged, kosarstat());
  assert.equal(focus.length, 3, focus.join('\n'));
  assert.ok(focus.slice(0, 2).some(item => item.startsWith('Perimétervédekezés: Cél ellenfél 3P% ≤ ')), focus.join('\n'));
  assert.ok(
    focus.slice(0, 2).some(item => /^Belső védekezés: Cél ellenfél 2P% ≤ \d+\.\d% \(liga medián; most 22\/31, 71\.0%\)/.test(item)),
    focus.join('\n')
  );
  // A sorrend a kiírt pontköltség szerint csökkenő.
  const costs = focus.map(item => Number(/Becsült pontköltség ezen a meccsen: ~(\d+\.\d)\./.exec(item)?.[1] ?? 0));
  assert.deepEqual([...costs].sort((a, b) => b - a), costs);
  assert.ok(!focus[0].includes('OREB') && !focus[1].includes('OREB'), focus.join('\n'));
  // A problémák között is ott a belső védekezés – a fókusz nem lóg a levegőben.
  assert.ok(merged.problems.some(item => item.startsWith('Védekezés: Belső védekezési probléma (ellenfél 2P 22/31, 71.0%')), merged.problems.join('\n'));
  // Az MD lábjegyzete megnevezi a sorrend szabályát.
  assert.match(postgameReportToMd(merged, SEASON, undefined, { focus }), /\*Sorrend: a becsült pontköltség szerint/);
});

test('eFG: a liga feletti saját dobás és az ellenfélhez mért hátrány egy sorban', () => {
  const merged = mergeKosarstatPostgameContext(report(), kosarstat());
  const line = merged.strengths.find(item => item.startsWith('Dobáshatékonyság a liga felett'));
  assert.ok(line, merged.strengths.join('\n'));
  assert.ok(line.endsWith(', de az ellenfél még jobban dobott (ellenfél eFG 71.4%, -10.3 pp)'), line);
  assert.ok(!merged.problems.some(item => item.startsWith('Kosarstat eFG különbség')), merged.problems.join('\n'));
});

test('Reflexió: pre-game kontextus nélkül adatmegjegyzés jelzi a hiányát', () => {
  const result = report();
  assert.equal(result.reflection.xFactor, '');
  assert.ok(result.dataNotes.some(item => item.startsWith('Pre-game reflexió és a pre-game fókusz realizációja nem készült')));
});
