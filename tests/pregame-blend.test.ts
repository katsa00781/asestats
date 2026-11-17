import {
  blendPregamePlayers,
  blendPregameTeamStats,
  computeRecentBlendWeight,
  hasSampleForPregame,
  subtractGameFromPlayerAggregates,
  subtractGameFromTeamAggregate,
  sumOpponentBoxes,
  sumPointsAgainst,
} from '../lib/pregame-blend';
import type { PlayerSeasonStat, TeamSeasonStat } from '../lib/pregame-scouting';
import type { GamePlayerStatRow } from '../lib/season-comparison-helpers';
import { emptyTeamOpponentBox, type TeamGameScore, type TeamOpponentBox } from '../lib/team-analysis';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const box = (overrides: Partial<TeamOpponentBox>): TeamOpponentBox => ({ ...emptyTeamOpponentBox(), ...overrides });

const team = (overrides: Partial<TeamSeasonStat> = {}): TeamSeasonStat => ({
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
  ...overrides,
});

const player = (playerId: string, overrides: Partial<PlayerSeasonStat> = {}): PlayerSeasonStat => ({
  playerId,
  name: playerId,
  position: 'SG',
  games: 10,
  minutes: 250,
  points: 120,
  fga2: 60,
  fgm2: 30,
  fga3: 40,
  fgm3: 14,
  fta: 20,
  ftm: 18,
  oreb: 5,
  dreb: 20,
  ast: 25,
  tov: 15,
  stl: 8,
  blk: 2,
  val: 110,
  roles: [],
  ...overrides,
});

const row = (playerId: string, overrides: Partial<GamePlayerStatRow> = {}): GamePlayerStatRow => ({
  id: `${playerId}-g1`,
  player_id: playerId,
  game_id: 'g1',
  minutes: 25,
  points: 12,
  close_attempted: 4,
  close_made: 2,
  mid_attempted: 2,
  mid_made: 1,
  three_attempted: 4,
  three_made: 2,
  free_throw_attempted: 2,
  free_throw_made: 2,
  offensive_rebounds: 1,
  defensive_rebounds: 3,
  assists: 2,
  turnovers: 1,
  steals: 1,
  blocks: 0,
  fouls_committed: 2,
  valuation: 11,
  ...overrides,
});

test('computeRecentBlendWeight: 3 meccs alatt 0, egyébként 0,45–0,72 a lefedettség szerint', () => {
  assert.equal(computeRecentBlendWeight(2, 10), 0);
  assert.equal(computeRecentBlendWeight(Number.NaN, 10), 0);
  assert.ok(Math.abs(computeRecentBlendWeight(5, 10) - 0.6) < 1e-12);
  assert.equal(computeRecentBlendWeight(10, 10), 0.72);
  assert.ok(Math.abs(computeRecentBlendWeight(3, 100) - 0.459) < 1e-12);
  assert.ok(Math.abs(computeRecentBlendWeight(3, 0) - 0.72) < 1e-12); // 0 szezonmeccs → 1-gyel osztva, lefedettség 1
});

test('hasSampleForPregame: az alsó (tartalék) küszöbtől elég a minta', () => {
  assert.equal(hasSampleForPregame(8, 8, 4), true);
  assert.equal(hasSampleForPregame(5, 8, 4), true);
  assert.equal(hasSampleForPregame(3, 8, 4), false);
  assert.equal(hasSampleForPregame(Number.NaN, 8, 4), false);
});

test('blendPregameTeamStats: mezőnként súlyozott átlag; az ellenfél-box csak párosított mintával keveredik', () => {
  const season = team({ opponent: box({ games: 10, oreb: 100 }) });
  const recent = team({ games: 5, pointsFor: 450, opponent: box({ games: 5, oreb: 40 }) });
  const blended = blendPregameTeamStats(season, recent, 0.5);
  assert.equal(blended.games, 7.5);
  assert.equal(blended.pointsFor, 625);
  assert.equal(blended.teamName, 'Teszt SE');
  assert.equal(blended.opponent?.games, 7.5);
  assert.equal(blended.opponent?.oreb, 70);

  // ha az egyik oldalon nincs ellenfél-minta, a meglévőt tartja meg (nem hígít nullával)
  const noSeasonOpp = blendPregameTeamStats(team(), recent, 0.5);
  assert.equal(noSeasonOpp.opponent, recent.opponent);
  const noRecentOpp = blendPregameTeamStats(season, team({ opponent: box({}) }), 0.5);
  assert.equal(noRecentOpp.opponent, season.opponent);
});

test('blendPregamePlayers: mindkét mintában szereplő keverve, egyoldalú változatlanul, 0 meccses kiesik', () => {
  const blended = blendPregamePlayers(
    [player('a', { games: 10, points: 100 }), player('b'), player('z', { games: 0 })],
    [player('a', { games: 4, points: 60, positionLabel: 'Dobóhátvéd' }), player('c')],
    0.25
  );
  const byId = new Map(blended.map(item => [item.playerId, item]));
  assert.deepEqual([...byId.keys()].sort(), ['a', 'b', 'c']);
  assert.equal(byId.get('a')?.games, 8.5);
  assert.equal(byId.get('a')?.points, 90);
  assert.equal(byId.get('a')?.positionLabel, 'Dobóhátvéd'); // a szezonsorból hiányzó mező a friss mintából
  assert.equal(byId.get('b')?.points, 120);
});

test('sumPointsAgainst: csak a csapat saját, ismert eredményű meccsei számítanak', () => {
  const scores = new Map<string, TeamGameScore>([
    ['g1', { ourTeamId: 't1', ourScore: 80, oppScore: 70 }],
    ['g2', { ourTeamId: 't1', ourScore: 75, oppScore: 81 }],
    ['g3', { ourTeamId: 't2', ourScore: 90, oppScore: 60 }],
  ]);
  assert.deepEqual(sumPointsAgainst('t1', ['g1', 'g2', 'g3', 'g4'], scores), { pointsAgainst: 151, countedGames: 2 });
});

test('sumOpponentBoxes: mezőnkénti összeg, a hiányzó box kimarad', () => {
  const total = sumOpponentBoxes([box({ games: 1, oreb: 10, fga2: 30 }), undefined, box({ games: 1, oreb: 8, fga2: 34 })]);
  assert.equal(total.games, 2);
  assert.equal(total.oreb, 18);
  assert.equal(total.fga2, 64);
});

test('subtractGameFromTeamAggregate: a meccs saját sorai, kapott pontja és ellenfél-boxa levonva', () => {
  const rows = new Map([['t1', new Map([['g1', [row('p1'), row('p2', { points: 8, turnovers: 3 })]]])]]);
  const scores = new Map<string, TeamGameScore>([['g1', { ourTeamId: 't1', ourScore: 20, oppScore: 70 }]]);
  const opponentByGame = new Map([['g1', box({ games: 1, oreb: 12, fga2: 500 })]]);
  const season = team({ opponent: box({ games: 10, oreb: 100, fga2: 300 }) });

  const result = subtractGameFromTeamAggregate(season, 't1', 'g1', rows, scores, opponentByGame);
  assert.equal(result.games, 9);
  assert.equal(result.pointsFor, 780);
  assert.equal(result.pointsAgainst, 690);
  assert.equal(result.fga2, 388); // 2 × (4 + 2)
  assert.equal(result.fgm3, 66);
  assert.equal(result.tov, 116);
  assert.equal(result.fouls, 176);
  assert.equal(result.opponent?.games, 9);
  assert.equal(result.opponent?.oreb, 88);
  assert.equal(result.opponent?.fga2, 0); // 0 alá nem megy

  // hiányzó azonosító vagy sor: változatlan objektum
  assert.equal(subtractGameFromTeamAggregate(season, null, 'g1', rows, scores, opponentByGame), season);
  assert.equal(subtractGameFromTeamAggregate(season, 't1', 'g9', rows, scores, opponentByGame), season);
});

test('subtractGameFromPlayerAggregates: játékosonként levonva; aki csak ezen a meccsen játszott, kiesik', () => {
  const rows = new Map([['t1', new Map([['g1', [row('p1'), row('p2')]]])]]);
  const result = subtractGameFromPlayerAggregates(
    [player('p1'), player('p2', { games: 1, points: 12 }), player('p3')],
    't1',
    'g1',
    rows
  );
  const byId = new Map(result.map(item => [item.playerId, item]));
  assert.deepEqual([...byId.keys()], ['p1', 'p3']);
  assert.equal(byId.get('p1')?.games, 9);
  assert.equal(byId.get('p1')?.points, 108);
  assert.equal(byId.get('p1')?.minutes, 225);
  assert.equal(byId.get('p3')?.points, 120);
});
