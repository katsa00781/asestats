// H34/F2c: a post-game riport összeállítása (`lib/postgame-report-builder.ts`) a valós
// Atomerőmű SE – Sopron KC 109–80 (2026-10-10) box score-ral és Kosarstat lineup-oldallal.
import { parseKosarstatLineupAnalysis } from '../lib/kosarstat-lineup-analysis';
import { buildKosarstatPostgameContext } from '../lib/postgame-report';
import { buildPostgameReport, type PostgameReportInputs } from '../lib/postgame-report-builder';
import type { GamePlayerStatRow } from '../lib/season-comparison-helpers';
import { emptyTeamOpponentBox } from '../lib/team-analysis';
import { LINEUP_TABLES } from './fixtures/kosarstat-ase-sopron-lineup';
import { ASE_BOX, ASE_SEASON, BENCHMARKS } from './fixtures/postgame-ase-sopron';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const toRow = (gameId: string, withStarterFlag: boolean) => (
  [name, minutes, points, close, mid, three, ft, oreb, dreb, ast, tov, stl, blk, val, isStarter]: (typeof ASE_BOX)[number],
  index: number
): GamePlayerStatRow => ({
  id: `${gameId}-r${index}`,
  player_id: `${gameId}-p${index}`,
  game_id: gameId,
  is_starter: withStarterFlag ? isStarter : null,
  minutes,
  points,
  close_made: close[0],
  close_attempted: close[1],
  mid_made: mid[0],
  mid_attempted: mid[1],
  three_made: three[0],
  three_attempted: three[1],
  free_throw_made: ft[0],
  free_throw_attempted: ft[1],
  offensive_rebounds: oreb,
  defensive_rebounds: dreb,
  assists: ast,
  turnovers: tov,
  steals: stl,
  blocks: blk,
  valuation: val,
  players: { name, position: 'SF' },
});

const inputs = (overrides: Partial<PostgameReportInputs> = {}): PostgameReportInputs => ({
  selectedGame: {
    id: 'g1', date: '2026-10-10', opponent: 'Sopron KC', homeAway: 'home',
    ourScore: 109, oppScore: 80, result: 'win', players: [],
  },
  selectedTeamStats: { ...ASE_SEASON, teamId: 'ase', teamName: 'Atomerőmű SE', opponent: emptyTeamOpponentBox(), roster: [] },
  postgameBenchmarks: BENCHMARKS,
  resolvedTeamId: 'ase',
  playerGameStats: ASE_BOX.map(toRow('g1', false)),
  league: 'NB I/A',
  kosarstatLineupAnalysis: null,
  seasonPlayers: [],
  rolesByPlayerId: new Map(),
  postgameOpponentTotalsByTeam: new Map([['ase', { dreb: 60, possessions: 228 }]]),
  postgamePregameXFactorContext: undefined,
  postgameShotContext: null,
  kosarstatPostgameContext: buildKosarstatPostgameContext(null),
  kosarstatPostgameNotes: [],
  ...overrides,
});

const LINEUP = parseKosarstatLineupAnalysis(LINEUP_TABLES, 'g1', 'Atomerőmű SE', 'home');
const BOX_STARTERS = ASE_BOX.filter(row => row[14]).map(row => row[0]).sort();

test('post-game riport: nincs riport csapat / meccs / box score nélkül', () => {
  assert.equal(buildPostgameReport(inputs({ resolvedTeamId: 'all' })), null);
  assert.equal(buildPostgameReport(inputs({ selectedGame: null })), null);
  assert.equal(buildPostgameReport(inputs({ playerGameStats: ASE_BOX.map(toRow('masik-meccs', false)) })), null);
});

test('post-game riport lineup nélkül: box score-összeg, explicit kezdő-jelölés, keretpozíció-fallback', () => {
  const report = buildPostgameReport(inputs({
    playerGameStats: ASE_BOX.map(toRow('g1', true)),
    kosarstatPostgameNotes: ['Kosarstat jegyzet'],
  }));
  assert.ok(report);
  assert.equal(report.teamName, 'Atomerőmű SE');
  assert.equal(report.result, 'win');
  assert.equal(report.metrics.pointsFor, 109);
  assert.equal(report.metrics.pointsAgainst, 80);
  // ellenfél box score nélkül az általános név és a korlátozott védekezési jegyzet
  assert.equal(report.opponentName, 'Ellenfél');
  assert.ok(report.dataNotes.includes('Ellenfél statisztikák nem elérhetők, a védekező értékelés korlátozott.'));
  assert.ok(report.dataNotes.includes('Kosarstat jegyzet'));
  assert.equal(report.lineupInsights, undefined);
  const players = report.playerReport.players;
  assert.equal(players.length, ASE_BOX.length);
  assert.deepEqual(players.filter(player => player.isStarter).map(player => player.name).sort(), BOX_STARTERS);
  // szezonos játékossor nélkül a keretpozíció a „PG” fallback
  assert.ok(players.every(player => player.position === 'PG'));
});

test('post-game riport Kosarstat lineuppal: kezdők és meccsbeli pozíció a lineupból, lineup-összefoglaló', () => {
  const report = buildPostgameReport(inputs({ kosarstatLineupAnalysis: LINEUP }));
  assert.ok(report);
  const players = report.playerReport.players;
  // a box score-ban nincs kezdő-jelölés: a Kosarstat kezdők névillesztése adja
  assert.deepEqual(players.filter(player => player.isStarter).map(player => player.name).sort(), BOX_STARTERS);
  const positionOf = (name: string) => players.find(player => player.name === name)?.position;
  assert.equal(positionOf('JOSEPH Yasiin Yousef'), 'PG');
  assert.equal(positionOf('CHANDLER III. John Watson'), 'SG');
  assert.equal(positionOf('YOUNG Kalif Karl'), 'C');
  // minden Kosarstat név párosult a box score-ral
  assert.ok(report.dataNotes.every(note => !note.startsWith('Névillesztés')));

  const insights = report.lineupInsights;
  assert.ok(insights);
  assert.equal(insights.available, true);
  assert.equal(insights.totalStints, 18);
  assert.equal(insights.totalMinutes, 40);
  assert.deepEqual(insights.topLineup, {
    players: ['Yasiin JOSEPH', 'Jay Jay CHANDLER', 'BENKE Szilárd', 'RÉVÉSZ Ádám', 'Kalif YOUNG'],
    minutes: 11,
    plusMinus: 12,
    netPer40: 43.5,
  });
  // a 109–80-as győzelemben nincs másik, legalább 5 perces ötös
  assert.equal(insights.bottomLineup, null);
  assert.deepEqual(insights.topPair, { players: ['HALMAI Dániel', 'RÉVÉSZ Ádám'], minutes: 8.3, netPer40: 106.7 });
  assert.equal(insights.implications.length, 2);

  // a leggyengébb mag és a kezdő-split a lineup-modellből
  assert.ok(report.problems.some(problem => problem.startsWith('Együttállás: DANIELS II Clarence Oliver + GÉRINGER Gergő + HALMAI Dániel + KRIVACEVIC Markó')));
  assert.match(report.lineupSummary?.starterSplit ?? '', /a kezdő ötös 11:02 alatt 29–17 \(\+12, Net\/40 \+43\.5\)/);
});

test('post-game riport ellenfél box score-ral: a kapott pont és az ellenfél neve a meccsből', () => {
  const opponentRows: GamePlayerStatRow[] = [
    { id: 'o1', player_id: 'o-p1', game_id: 'g1-opp', points: 50, close_attempted: 20, close_made: 10, three_attempted: 10, three_made: 4, defensive_rebounds: 10 },
    { id: 'o2', player_id: 'o-p2', game_id: 'g1-opp', points: 30, mid_attempted: 10, mid_made: 5, three_attempted: 13, three_made: 5, defensive_rebounds: 6 },
  ];
  const report = buildPostgameReport(inputs({
    selectedGame: {
      id: 'g1', date: '2026-10-10', opponent: 'Sopron KC', homeAway: 'home',
      ourScore: 109, oppScore: 80, result: 'win', players: [], opponentGameId: 'g1-opp',
    },
    playerGameStats: [...ASE_BOX.map(toRow('g1', true)), ...opponentRows],
  }));
  assert.ok(report);
  assert.equal(report.opponentName, 'Sopron KC');
  assert.equal(report.metrics.pointsAgainst, 80);
  assert.ok(!report.dataNotes.includes('Ellenfél statisztikák nem elérhetők, a védekező értékelés korlátozott.'));
});
