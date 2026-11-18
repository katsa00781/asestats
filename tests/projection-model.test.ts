// H34/F2a: a bajnoki előrejelzés csapat-erőssége és a rájátszás-szimuláció
// (`lib/playoff-projection.ts`) kézzel számolt bemenetekkel.
import {
  buildPlayoffProjection,
  buildProjectionStrengthByTeamKey,
  type ProjectionStrengthInputs,
  type StandingsSnapshotRow,
} from '../lib/playoff-projection';
import { normalizeTeamKey, type GamePlayerStatRow } from '../lib/season-comparison-helpers';
import { emptyTeamOpponentBox, type TeamSeasonStat } from '../lib/team-analysis';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const close = (actual: number | undefined, expected: number) =>
  assert.ok(actual !== undefined && Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);

const standing = (team: string, wins: number, losses: number, scored: number, conceded: number): StandingsSnapshotRow => ({
  team,
  matches: wins + losses,
  wins,
  losses,
  scored,
  conceded,
  points: wins * 2 + losses,
});

const teamStat = (overrides: Partial<TeamSeasonStat>): TeamSeasonStat => ({
  teamId: 't',
  teamName: 'Csapat',
  league: 'NB I',
  season: '2026/2027',
  games: 10,
  pointsFor: 0,
  pointsAgainst: 0,
  fga2: 400,
  fgm2: 200,
  fga3: 200,
  fgm3: 70,
  fta: 100,
  ftm: 75,
  oreb: 100,
  dreb: 300,
  ast: 150,
  tov: 120,
  stl: 60,
  blk: 20,
  fouls: 180,
  val: 900,
  opponent: emptyTeamOpponentBox(),
  roster: [],
  ...overrides,
});

const baseInputs = (overrides: Partial<ProjectionStrengthInputs> = {}): ProjectionStrengthInputs => ({
  teamSeasonStats: [],
  playerGameStats: [],
  playerTeamMap: new Map(),
  recentGameIdsByTeam: new Map(),
  leagueGameScores: { byGame: new Map() },
  minRecentGames: 3,
  recentWeightMultiplier: 1,
  standingsSnapshot: [],
  recentFormByTeamKey: new Map(),
  scheduleStrengthByTeamKey: new Map(),
  whatIfTeamAdjustments: {},
  ...overrides,
});

const A = normalizeTeamKey('Alfa SE');
const B = normalizeTeamKey('Béta KK');

test('csapat-erősség csak tabellából: 0,6·z(net) + 0,4·z(győzelmi arány), what-if korrekcióval', () => {
  const result = buildProjectionStrengthByTeamKey(baseInputs({
    // net/meccs: +10 és −10 → z = ±1; győzelmi arány 1 és 0 → z = ±1
    standingsSnapshot: [standing('Alfa SE', 10, 0, 900, 800), standing('Béta KK', 0, 10, 800, 900)],
    whatIfTeamAdjustments: { [B]: 0.5 },
  }));
  close(result.get(A), 1);
  close(result.get(B), -1 + 0.5);
});

test('csapat-erősség: forma- (×0,35) és menetrend-igazítás (×0,22)', () => {
  const result = buildProjectionStrengthByTeamKey(baseInputs({
    standingsSnapshot: [standing('Alfa SE', 10, 0, 900, 800), standing('Béta KK', 0, 10, 800, 900)],
    // forma: (1 − 0,5)·0,9 + min(1, 20/10)·0,35 = 0,8
    recentFormByTeamKey: new Map([[A, { winRate: 1, netPerGame: 20 }]]),
    scheduleStrengthByTeamKey: new Map([[A, { combined: 1 }]]),
  }));
  close(result.get(A), 1 + 0.8 * 0.35 + 0.22);
  close(result.get(B), -1);
});

test('csapat-erősség statprofilból: súlyozott z-pontok, a labdaeladási arány negatív súllyal', () => {
  const alfa = teamStat({
    teamId: 'a', teamName: 'Alfa SE', pointsFor: 900, pointsAgainst: 800,
    fgm2: 220, fgm3: 80, ast: 200, tov: 150, oreb: 110, dreb: 310, stl: 80, blk: 30,
  });
  const beta = teamStat({
    teamId: 'b', teamName: 'Béta KK', pointsFor: 800, pointsAgainst: 900,
    fgm2: 180, fgm3: 60, ast: 120, tov: 100, oreb: 90, dreb: 290, stl: 60, blk: 20,
  });
  const statsOnly = buildProjectionStrengthByTeamKey(baseInputs({ teamSeasonStats: [alfa, beta] }));
  // két csapatnál minden mutató z-je ±1: 0,4 + 0,2 + 0,15 + 0,1 + 0,1 − 0,05 (Alfa többet ad el)
  close(statsOnly.get(A), 0.9);
  close(statsOnly.get(B), -0.9);

  // tabellával együtt: stat 0,65 + tabella 0,35
  const blended = buildProjectionStrengthByTeamKey(baseInputs({
    teamSeasonStats: [alfa, beta],
    standingsSnapshot: [standing('Alfa SE', 10, 0, 900, 800), standing('Béta KK', 0, 10, 800, 900)],
  }));
  close(blended.get(A), 0.9 * 0.65 + 1 * 0.35);
});

test('csapat-erősség: a friss forma csak elég friss meccstől, és 0-s forgatókönyv-szorzónál nem keveredik', () => {
  const alfa = teamStat({ teamId: 'a', teamName: 'Alfa SE', pointsFor: 900, pointsAgainst: 800, tov: 150 });
  const beta = teamStat({ teamId: 'b', teamName: 'Béta KK', pointsFor: 800, pointsAgainst: 900, tov: 100 });
  const gameRow = (gameId: string, points: number): GamePlayerStatRow => ({
    game_id: gameId,
    player_id: 'p-a',
    points,
    three_attempted: 10,
    three_made: 1,
  } as GamePlayerStatRow);
  const playerGameStats = [gameRow('g1', 40), gameRow('g2', 45), gameRow('g3', 42)];
  const reference = buildProjectionStrengthByTeamKey(baseInputs({ teamSeasonStats: [alfa, beta] }));
  const common = {
    teamSeasonStats: [alfa, beta],
    playerGameStats,
    playerTeamMap: new Map([['p-a', 'a']]),
  };

  const tooFew = buildProjectionStrengthByTeamKey(baseInputs({
    ...common,
    recentGameIdsByTeam: new Map([['a', ['g1', 'g2']]]),
  }));
  assert.deepEqual(tooFew, reference);

  const zeroWeight = buildProjectionStrengthByTeamKey(baseInputs({
    ...common,
    recentGameIdsByTeam: new Map([['a', ['g1', 'g2', 'g3']]]),
    recentWeightMultiplier: 0,
  }));
  assert.deepEqual(zeroWeight, reference);

  const withRecent = buildProjectionStrengthByTeamKey(baseInputs({
    ...common,
    recentGameIdsByTeam: new Map([['a', ['g1', 'g2', 'g3']]]),
  }));
  assert.notDeepEqual(withRecent, reference);
});

const projectedRow = (team: string, projectedWins: number, projectedLosses: number) => ({ team, projectedWins, projectedLosses });

const tenTeams = Array.from({ length: 10 }, (_, index) => projectedRow(`Csapat ${index + 1}`, 20 - index, 6 + index));
// erős, monoton erősségsor: a jobb kiemelt minden párharcot megnyer
const strength = new Map(tenTeams.map((row, index) => [normalizeTeamKey(row.team), 10 - index]));

const playoffInputs = (overrides: Partial<Parameters<typeof buildPlayoffProjection>[0]> = {}) => ({
  projectedStandings: tenTeams,
  projectionHomeAdvantage: 0.22,
  projectionLogisticDivisor: 0.85,
  projectionStrengthByTeamKey: strength,
  recentFormByTeamKey: new Map(),
  headToHeadByPair: new Map(),
  playoffSeriesWinnerOverrides: {},
  ...overrides,
});

test('rájátszás: 8-nál kevesebb csapatnál nincs szimuláció', () => {
  assert.equal(buildPlayoffProjection(playoffInputs({ projectedStandings: tenTeams.slice(0, 7) })), null);
});

test('rájátszás: monoton erősségnél a kiemelési sorrend marad, a 9. helytől alapszakasz szerint', () => {
  const result = buildPlayoffProjection(playoffInputs());
  assert.ok(result);
  assert.equal(result.champion, 'Csapat 1');
  assert.equal(result.runnerUp, 'Csapat 2');
  assert.equal(result.third, 'Csapat 3');
  assert.equal(result.fourth, 'Csapat 4');
  assert.deepEqual(result.finalRanking.map(row => row.team), tenTeams.map(row => row.team));
  assert.equal(result.finalRanking[8].note, 'Alapszakasz alapján');
  assert.equal(result.series.length, 12);
  assert.deepEqual(
    result.series.map(series => `${series.round}-${series.homeSeed}-${series.awaySeed}`),
    [
      'Negyeddöntő-1-8', 'Negyeddöntő-2-7', 'Negyeddöntő-3-6', 'Negyeddöntő-4-5',
      'Elődöntő-1-4', 'Elődöntő-2-3', 'Döntő-1-2', 'Bronz-3-4',
      '5-8 helyosztó elődöntő-5-8', '5-8 helyosztó elődöntő-6-7', '5. helyért-5-6', '7. helyért-7-8',
    ]
  );
  assert.ok(result.series.every(series => !series.manualOverride));
  assert.equal(result.series[0].certaintyLabel, 'Magas');
});

test('rájátszás: a kézi párharc-győztes továbbviszi a vendéget, és a sorsolás ehhez igazodik', () => {
  const result = buildPlayoffProjection(playoffInputs({
    playoffSeriesWinnerOverrides: { 'Negyeddöntő-1-8': 'away' },
  }));
  assert.ok(result);
  const qf1 = result.series[0];
  assert.equal(qf1.manualOverride, true);
  assert.equal(qf1.homeWinProbability, 0);
  assert.equal(qf1.awayWinProbability, 1);
  assert.equal(qf1.winner, 'Csapat 8');
  // elődöntő: a 4. és a 8. kiemelt (a jobb kiemelt a hazai), a döntőt a 2. kiemelt nyeri
  assert.equal(result.series[4].seriesKey, 'Elődöntő-4-8');
  assert.equal(result.champion, 'Csapat 2');
  // az 1. kiemelt a helyosztóba kerül, és megnyeri az 5. helyet
  assert.equal(result.finalRanking[4].team, 'Csapat 1');
});
