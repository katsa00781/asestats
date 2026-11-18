// H34/F2b: a pre-game optimális kezdőötös (`lib/pregame-optimal-lineup.ts`) jellemző viselkedése
// kis, kézzel összerakott kereten: szerepkör-kiosztás, matchup-súlyok, a szezonos ötösminta hatása.
import type { KosarstatTeamLineupAnalysis } from '../lib/kosarstat-lineup-analysis';
import { buildPregameOptimalLineup } from '../lib/pregame-optimal-lineup';
import type { PlayerSeasonStat, ScoutingReport } from '../lib/pregame-scouting';
import assert from 'node:assert/strict';
import { test } from 'node:test';

type ReportOverrides = {
  dominantAxis?: string;
  offense?: string[];
  defense?: string[];
  opponentTopZones?: Array<{ label: string }>;
  clashZones?: string[];
  focusPoints?: string[];
  centerDelta?: number;
};

// Az optimális ötös a riportnak csak a matchup-jelzéseit olvassa; a teszt ezeket adja meg.
const report = (overrides: ReportOverrides = {}) => ({
  llmContext: { opponentDominantAxis: overrides.dominantAxis ?? 'kiegyensúlyozott' },
  profile: { offense: overrides.offense ?? [], defense: overrides.defense ?? [] },
  shotProfileContext: {
    opponentTopZones: overrides.opponentTopZones ?? [],
    clashZones: overrides.clashZones ?? [],
  },
  focusPoints: overrides.focusPoints ?? [],
  positionComparison: [{ position: 'C', deltaValPer36: overrides.centerDelta ?? 0 }],
  calibrationDiagnostics: { dimensions: [] },
}) as unknown as ScoutingReport;

const player = (playerId: string, name: string, position: PlayerSeasonStat['position'], overrides: Partial<PlayerSeasonStat> = {}): PlayerSeasonStat => ({
  playerId,
  name,
  position,
  games: 10,
  minutes: 250,
  points: 100,
  fga2: 60,
  fgm2: 30,
  fga3: 20,
  fgm3: 7,
  fta: 20,
  ftm: 15,
  oreb: 10,
  dreb: 30,
  ast: 20,
  tov: 15,
  stl: 8,
  blk: 3,
  val: 100,
  roles: [],
  ...overrides,
});

const roster: PlayerSeasonStat[] = [
  player('p1', 'ALFA Pál', 'PG', { minutes: 300, points: 140, ast: 55, tov: 18, val: 150, heightCm: 188 }),
  player('p2', 'BÉTA Bence', 'SG', { minutes: 290, points: 150, fga3: 50, fgm3: 19, val: 130, heightCm: 193 }),
  player('p3', 'GAMMA Géza', 'SF', { minutes: 280, points: 120, oreb: 15, dreb: 40, val: 120, heightCm: 198 }),
  player('p4', 'DELTA Dániel', 'PF', { minutes: 270, points: 110, oreb: 25, dreb: 55, val: 125, heightCm: 203 }),
  player('p5', 'EPSZILON Ede', 'C', { minutes: 280, points: 120, oreb: 35, dreb: 65, blk: 15, val: 160, heightCm: 208 }),
  player('p6', 'ZÉTA Zoltán', 'PG', { minutes: 120, points: 35, ast: 18, tov: 14, val: 30, heightCm: 185 }),
  player('p7', 'ÉTA Endre', 'C', { minutes: 100, points: 30, oreb: 10, dreb: 20, blk: 4, val: 35, heightCm: 205 }),
];

const ROLE_ORDER = ['PG', 'SG', 'SF', 'PF', 'C'];

test('optimális ötös: riport nélkül vagy 5-nél kisebb keretnél nincs', () => {
  const base = { pregameOwnPlayers: roster, seasonKosarstatLineupTeam: null, seasonKosarstatLineupGames: 0 };
  assert.equal(buildPregameOptimalLineup({ ...base, pregameReport: null }), null);
  assert.equal(buildPregameOptimalLineup({ ...base, pregameReport: report(), pregameOwnPlayers: roster.slice(0, 4) }), null);
});

test('optimális ötös lineup-minta nélkül: PG–C sorrendű szerepek, alacsony bizonyosság, semleges matchup-súly', () => {
  const result = buildPregameOptimalLineup({
    pregameReport: report(),
    pregameOwnPlayers: roster,
    seasonKosarstatLineupTeam: null,
    seasonKosarstatLineupGames: 0,
  });
  assert.ok(result);
  assert.deepEqual(result.best.roleAssignments.map(item => item.role), ROLE_ORDER);
  assert.equal(result.best.players.length, 5);
  // a szerepkör szerinti név-sorrend
  assert.deepEqual(result.best.names, result.best.roleAssignments.map(item => item.name));
  // a jobb irányító és a természetes center kezd, a cserék nem
  assert.ok(result.best.players.some(item => item.playerId === 'p1'));
  assert.ok(result.best.roleAssignments.some(item => item.role === 'C' && item.playerId === 'p5'));
  assert.equal(result.best.certainty, 'low');
  assert.equal(result.best.exactNetPer40, null);
  assert.deepEqual(result.best.reasons, ['a kis mintát egyéni profil és rész-szinergiák felé shrinkeli a modell']);
  assert.ok(result.alternates.length <= 2);
  assert.ok(result.alternates.every(item => item.key !== result.best.key));
  assert.ok(result.candidateCount >= result.alternates.length + 1);
  assert.deepEqual(result.matchupWeights, { perimeter: 0, paint: 0, ballSecurity: 0 });
  assert.equal(result.sourceGames, 0);
  // azonos (0) igénynél a periméter az elsődleges fókusz
  assert.match(result.headline, /matchup-fókusza most a periméter/);
});

test('optimális ötös: a matchup-igény a riport jelzéseiből, 0,75-ös korláttal (%)', () => {
  const perimeter = buildPregameOptimalLineup({
    // periméter tengely 0,3 + tripla fókusz 0,2 = 0,5 → 0,375 → 38%
    pregameReport: report({ dominantAxis: 'periméter', focusPoints: ['tripla closeout'] }),
    pregameOwnPlayers: roster,
    seasonKosarstatLineupTeam: null,
    seasonKosarstatLineupGames: 0,
  });
  assert.deepEqual(perimeter?.matchupWeights, { perimeter: 38, paint: 0, ballSecurity: 0 });

  const paint = buildPregameOptimalLineup({
    // gyűrű-ütközés 0,25 + center VAL/36 hátrány (≤ −4) 0,25 = 0,5 → 38%
    pregameReport: report({ clashZones: ['Gyűrű'], centerDelta: -5 }),
    pregameOwnPlayers: roster,
    seasonKosarstatLineupTeam: null,
    seasonKosarstatLineupGames: 0,
  });
  assert.deepEqual(paint?.matchupWeights, { perimeter: 0, paint: 38, ballSecurity: 0 });
  assert.match(paint?.headline ?? '', /matchup-fókusza most a festék/);
});

test('optimális ötös: a szezonos ötösminta és a megszokott kezdők előre hozzák az ötöst', () => {
  const starters = ['ZÉTA Zoltán', 'BÉTA Bence', 'GAMMA Géza', 'DELTA Dániel', 'EPSZILON Ede'];
  const lineupTeam = {
    teamName: 'Saját',
    starters,
    playerMinutes: [],
    playerTimelines: [],
    substitutions: [],
    rotationSource: 'events',
    rotationIssues: [],
    stints: [{ players: starters, minutesLabel: '30:00', seconds: 1800, teamPts: 70, oppPts: 50, plusMinus: 20, on40: 26.7 }],
    pairStats: [],
    trioStats: [],
  } satisfies KosarstatTeamLineupAnalysis;

  const result = buildPregameOptimalLineup({
    pregameReport: report(),
    pregameOwnPlayers: roster,
    seasonKosarstatLineupTeam: lineupTeam,
    seasonKosarstatLineupGames: 6,
  });
  assert.ok(result);
  assert.deepEqual(result.best.players.map(item => item.playerId).sort(), ['p2', 'p3', 'p4', 'p5', 'p6']);
  assert.equal(result.best.exactSampleMinutes, 30);
  assert.equal(result.best.exactNetPer40, 26.7);
  assert.equal(result.best.certainty, 'high');
  assert.deepEqual(result.best.reasons.slice(0, 2), [
    'van közvetlen szezonos ötösminta (30.0 perc)',
    'közel marad a megszokott kezdőszerkezethez, ezért rotációsan reálisabb',
  ]);
  assert.equal(result.sourceGames, 6);
});
