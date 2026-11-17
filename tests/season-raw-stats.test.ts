import type { PlayerStats } from '../lib/dashboard-types';
import type { GamePlayerStatRow } from '../lib/season-comparison-helpers';
import {
  buildTeamSeasonStats,
  computeTotalValuation,
  mapPositionInfo,
  toRawStat,
  toRawStatFromGameRows,
} from '../lib/season-raw-stats';
import assert from 'node:assert/strict';
import { test } from 'node:test';

// Szezonösszeg 10 meccsre (a `valuation` a dashboardon meccsátlag).
const player = (overrides: Partial<PlayerStats> = {}): PlayerStats => ({
  id: 'p1',
  name: 'TESZT Elek',
  number: 7,
  position: 'PG',
  teamId: 't1',
  teamName: 'Teszt SE',
  gamesPlayed: 10,
  points: 120,
  minutes: 250,
  shooting: {
    close: { made: 20, attempted: 35 },
    mid: { made: 10, attempted: 25 },
    three: { made: 14, attempted: 40 },
    freeThrow: { made: 18, attempted: 20 },
  },
  rebounds: { offensive: 5, defensive: 20, total: 25 },
  assists: 30,
  steals: 8,
  turnovers: 15,
  foulsCommitted: 22,
  foulsDrawn: 19,
  blocks: 2,
  valuation: 11,
  offensiveRating: 0,
  defensiveRating: 0,
  trueShootingPct: 0,
  effectiveShootingPct: 0,
  gameHistory: [],
  ...overrides,
});

const row = (gameId: string, overrides: Partial<GamePlayerStatRow> = {}): GamePlayerStatRow => ({
  id: `p1-${gameId}`,
  player_id: 'p1',
  game_id: gameId,
  minutes: 25,
  points: 12,
  close_made: 2,
  close_attempted: 4,
  mid_made: 1,
  mid_attempted: 2,
  three_made: 2,
  three_attempted: 4,
  free_throw_made: 2,
  free_throw_attempted: 2,
  offensive_rebounds: 1,
  defensive_rebounds: 3,
  assists: 2,
  steals: 1,
  blocks: 0,
  turnovers: 1,
  fouls_committed: 2,
  valuation: 11,
  ...overrides,
});

test('mapPositionInfo: a poszt-metaadat, ismeretlen / üres posztnál a C a tartalék', () => {
  assert.equal(mapPositionInfo('PG').position, 'PG');
  assert.equal(mapPositionInfo('PG').positionLabel, 'PG');
  assert.equal(mapPositionInfo('').position, 'C');
  assert.equal(mapPositionInfo(null).position, 'C');
});

test('computeTotalValuation: PIR-közelítés a szezonösszegből (kiharcolt fault nélkül)', () => {
  // 120 pont + 25 lep + 30 gp + 8 szerz + 2 blokk − 56 kihagyott mezőny (30 + 26) − 2 kihagyott bünti − 15 eladás
  assert.equal(computeTotalValuation(player()), 112);
});

test('toRawStat: a VAL a meccsátlag × meccsszám; ha az 0, a PIR-közelítés', () => {
  const raw = toRawStat(player(), 'NB I', '2026/2027');
  assert.equal(raw.games, 10);
  assert.equal(raw.valuation, 110);
  assert.deepEqual(raw.three, { made: 14, attempted: 40 });
  assert.deepEqual(raw.ft, { made: 18, attempted: 20 });
  assert.deepEqual(raw.fouls, { committed: 22, received: 19 });
  assert.equal(raw.position, 'PG');
  assert.equal(raw.league, 'NB I');

  assert.equal(toRawStat(player({ valuation: 0 }), 'NB I', '2026/2027').valuation, 112);
});

test('toRawStatFromGameRows: soronkénti összeg, a meccsszám a különböző game_id-kból', () => {
  const raw = toRawStatFromGameRows(player(), [row('g1'), row('g2', { points: 20, three_made: 4 }), row('g2')], 'NB I', '2026/2027');
  assert.equal(raw.games, 2);
  assert.equal(raw.points, 44);
  assert.equal(raw.minutes, 75);
  assert.deepEqual(raw.three, { made: 8, attempted: 12 });
  assert.deepEqual(raw.rebounds, { offensive: 3, defensive: 9, total: 12 });
  assert.deepEqual(raw.fouls, { committed: 6, received: 0 });
  assert.equal(raw.valuation, 33);
});

test('buildTeamSeasonStats: csapatonként összeg, a meccsszám a legtöbbet játszó játékosé, keret a roster-listából', () => {
  const teams = buildTeamSeasonStats(
    [player(), player({ id: 'p2', gamesPlayed: 8, points: 80, valuation: 5 }), player({ id: 'p3', teamId: undefined })],
    'NB I',
    '2026/2027',
    [{ id: 't1', name: 'Teszt SE (törzs)' }],
    new Map([['p1', ['Irányító']]]),
    [player(), player({ id: 'p4', isActive: false, minutes: 40 })]
  );
  assert.equal(teams.length, 1);
  const [team] = teams;
  assert.equal(team.teamName, 'Teszt SE (törzs)');
  assert.equal(team.games, 10);
  assert.equal(team.pointsFor, 200);
  assert.equal(team.fga2, 120);
  assert.equal(team.val, 150); // 11 × 10 + 5 × 8
  assert.equal(team.pointsAgainst, 0);
  assert.equal(team.opponent.games, 0);
  assert.deepEqual(team.roster.map(entry => [entry.playerId, entry.isActive, entry.roles]), [
    ['p1', true, ['Irányító']],
    ['p4', false, []],
  ]);
  // usage-proxy = FGA + 0,44 · FTA + TOV = 100 + 8,8 + 15
  assert.ok(Math.abs(team.roster[0].usageProxy - 123.8) < 1e-9);
});
