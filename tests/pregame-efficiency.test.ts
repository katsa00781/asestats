import { buildPregameEfficiencyBaseline, projectPregameEfficiency } from '../lib/pregame-efficiency';
import type { TeamSeasonStat } from '../lib/pregame-scouting';
import assert from 'node:assert/strict';
import { test } from 'node:test';

// 10 meccs: meccsenként 40 2PA (50%), 20 3PA (35%), 15 FTA (70%), 12 TOV, 10 OREB, 80 pont.
const team: TeamSeasonStat = {
  teamId: 't1',
  teamName: 'Teszt SE',
  league: 'NB I',
  season: '2026/2027',
  games: 10,
  pointsFor: 800,
  pointsAgainst: 760,
  fga2: 400,
  fgm2: 200,
  fga3: 200,
  fgm3: 70,
  fta: 150,
  ftm: 105,
  oreb: 100,
  dreb: 250,
  ast: 150,
  tov: 120,
  stl: 60,
  blk: 20,
  fouls: 180,
  val: 900,
};

test('buildPregameEfficiencyBaseline: meccsátlagból birtoklás, mix, eFG, PPP, várható pont (kézzel számolva)', () => {
  const baseline = buildPregameEfficiencyBaseline(team);
  // birtoklás = 60 FGA + 0,44·15 FTA + 12 TOV − 10 OREB = 68,6
  assert.equal(baseline.possessions, 68.6);
  assert.equal(baseline.fga, 60);
  assert.equal(baseline.twoPA, 40);
  assert.equal(baseline.threePA, 20);
  assert.equal(baseline.twoPct, 50);
  assert.equal(baseline.threePct, 35);
  assert.equal(baseline.ftPct, 70);
  assert.equal(baseline.threeSharePct, 33.3);
  assert.equal(baseline.ftRatePct, 25);
  assert.equal(baseline.tovRatePct, 17.5); // 12 / 68,6
  assert.equal(baseline.orebBonusPct, 14.6); // 10 / 68,6
  // várható pont = 20·2 + 7·3 + 15·0,7 = 71,5; eFG = (20 + 1,5·7) / 60
  assert.equal(baseline.expectedPoints, 71.5);
  assert.equal(baseline.efg, 50.8);
  assert.equal(baseline.ppp, 1.042);
  assert.equal(baseline.actualPointsPerGame, 80);
});

test('buildPregameEfficiencyBaseline: 0 meccsnél 1-gyel oszt, a birtoklás legalább 0,1', () => {
  const empty = buildPregameEfficiencyBaseline({ ...team, games: 0, fga2: 0, fgm2: 0, fga3: 0, fgm3: 0, fta: 0, ftm: 0, tov: 0, oreb: 0, pointsFor: 0 });
  assert.equal(empty.games, 1);
  assert.equal(empty.possessions, 0.1);
  assert.equal(empty.efg, 0);
  assert.equal(empty.expectedPoints, 0);
});

test('projectPregameEfficiency: a baseline nyers arányaival visszaadja a baseline-t (delta 0)', () => {
  const baseline = buildPregameEfficiencyBaseline(team);
  const projected = projectPregameEfficiency(baseline, {
    possessions: 68.6,
    threeSharePct: 100 / 3,
    ftRatePct: 25,
    tovRatePct: (12 / 68.6) * 100,
    orebBonusPct: (10 / 68.6) * 100,
    twoPct: 50,
    threePct: 35,
    ftPct: 70,
  });
  assert.equal(projected.fga, 60);
  assert.equal(projected.tov, 12);
  assert.equal(projected.oreb, 10);
  assert.equal(projected.expectedPoints, 71.5);
  // a lebegőpontos maradék kerekítése -0-t is adhat, ezért == 0 összevetés
  assert.ok(projected.deltaPoints === 0, String(projected.deltaPoints));
  assert.ok(projected.deltaEfg === 0, String(projected.deltaEfg));
});

test('projectPregameEfficiency: a bemenetek a modell sávjaiba korlátozva', () => {
  const baseline = buildPregameEfficiencyBaseline(team);
  const projected = projectPregameEfficiency(baseline, {
    possessions: 0,
    threeSharePct: 90,
    ftRatePct: 1,
    tovRatePct: 2,
    orebBonusPct: 35,
    twoPct: 120,
    threePct: -5,
    ftPct: 70,
  });
  assert.equal(projected.possessions, 1);
  assert.equal(projected.threeSharePct, 70);
  assert.equal(projected.ftRatePct, 5);
  assert.equal(projected.tovRatePct, 5);
  assert.equal(projected.orebBonusPct, 20);
  assert.equal(projected.twoPct, 100);
  assert.equal(projected.threePct, 0);
});
