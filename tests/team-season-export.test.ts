import type { TeamGame } from '../lib/dashboard-types';
import type { TeamExportStatRow } from '../lib/team-season-export';
import { buildTeamSeasonExport, classifyPhase } from '../lib/team-season-export';
import { teamStatsToMd } from '../lib/export-to-md';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const game = (patch: Partial<TeamGame> & Pick<TeamGame, 'id' | 'date'>): TeamGame => ({
  opponent: 'Szolnoki Olajbányász', homeAway: 'home', ourScore: 80, oppScore: 70, result: 'win', players: [], ...patch,
});
// 80 pont: 20 közeli (40) + 10 hármas (30) + 10 büntető; 200 perc két játékosra osztva.
const ownRows = (gameId: string, points = 80): TeamExportStatRow[] => [
  { game_id: gameId, player_id: 'p1', minutes: 120, points: points - 30, close_made: 20, close_attempted: 30, free_throw_made: 10, free_throw_attempted: 12,
    offensive_rebounds: 5, defensive_rebounds: 15, total_rebounds: 20, assists: 10, turnovers: 6, players: { name: 'Első Játékos', is_active: false } },
  { game_id: gameId, player_id: 'p2', minutes: 80, points: 30, three_made: 10, three_attempted: 25,
    offensive_rebounds: 3, defensive_rebounds: 10, total_rebounds: 13, assists: 8, turnovers: 4, players: { name: 'Második Játékos' } },
];
const oppRows = (gameId: string, points = 70): TeamExportStatRow[] => [
  { game_id: gameId, player_id: 'o1', minutes: 200, points, close_made: 35, close_attempted: 70,
    offensive_rebounds: 8, defensive_rebounds: 20, total_rebounds: 28, assists: 12, turnovers: 10 },
];

test('A csapatátlagok a meccs-sorokból jönnek, nem az üres games[].players tömbből', () => {
  const model = buildTeamSeasonExport({
    games: [game({ id: 'g1', date: '2025-10-01', opponentGameId: 'o-g1' })],
    statRows: [...ownRows('g1'), ...oppRows('o-g1')], players: [], seasonName: '2025/2026',
  });
  assert.equal(model.overall.boxGames, 1);
  assert.equal(model.overall.own.reb, 33);
  assert.equal(model.overall.own.ast, 18);
  assert.equal(model.overall.own.points, model.overall.pointsFor);
  assert.deepEqual(model.dataNotes, []);
  // Birtoklás = a két csapat becslésének átlaga: saját 55+5,28+10−8 = 62,28; ellenfél 70+10−8 = 72.
  assert.ok(Math.abs((model.games[0].possessions ?? 0) - (62.28 + 72) / 2) < 1e-9);
  // Az inaktív játékos is a táblában van, így a játékos-összeg egyezik a csapatéval.
  assert.equal(model.players.reduce((sum, p) => sum + p.line.points, 0), 80);
});

test('A szezon dátumablakán kívüli meccs kimarad és jelölve van', () => {
  const model = buildTeamSeasonExport({
    games: [game({ id: 'old', date: '2024-10-01' }), game({ id: 'g1', date: '2025-10-01' })],
    statRows: [...ownRows('old'), ...ownRows('g1')], players: [], seasonName: '2025/2026',
  });
  assert.equal(model.overall.games, 1);
  assert.equal(model.players.find(p => p.playerId === 'p1')?.gamesPlayed, 1);
  assert.match(model.dataNotes[0], /1 meccs dátuma .* szezonon kívül esik/);
});

test('A végeredménytől eltérő pontösszegű box score nem kerül a mutatókba', () => {
  const model = buildTeamSeasonExport({
    games: [game({ id: 'g1', date: '2025-10-01', opponentGameId: 'o-g1' })],
    statRows: [...ownRows('g1'), ...oppRows('o-g1', 140)], players: [], seasonName: '2025/2026',
  });
  assert.equal(model.overall.pairedGames, 0);
  assert.equal(model.games[0].opp, null);
  assert.equal(model.dataNotes.length, 1);
  assert.match(model.dataNotes[0], /140 vs 70/);
});

test('Az ellenfél neve az azonosítóból oldódik fel, a szakasz a Kosarstat címkéből', () => {
  const model = buildTeamSeasonExport({
    games: [
      game({ id: 'g1', date: '2025-10-01', opponent: 'NHSZ-Szolnoki Olajbányász', opponentTeamId: 't-szolnok', competitionPhase: 'Alapszakasz', round: 1 }),
      game({ id: 'g2', date: '2026-05-02', opponent: 'Szolnoki Olajbányász', opponentTeamId: 't-szolnok', competitionPhase: 'Elődöntő - 1. mérkőzés', result: 'loss', ourScore: 70, oppScore: 80 }),
      game({ id: 'g3', date: '2026-05-03', opponent: 'Szolnoki Olajbányász', opponentTeamId: 't-szolnok' }),
    ],
    statRows: [], players: [], seasonName: '2025/2026',
    resolveTeamName: id => (id === 't-szolnok' ? 'NHSZ-Szolnoki Olajbányász' : undefined),
  });
  assert.equal(model.byOpponent.length, 1);
  assert.equal(model.byOpponent[0].aggregate.games, 3);
  assert.deepEqual(model.byPhase.map(item => [item.phase, item.aggregate.games]), [['regular', 1], ['playoff', 1], ['other', 1]]);
  assert.deepEqual(model.games.map(g => g.restDays), [null, 212, 0]);
});

test('A „3. helyért” sorozat fordulószáma nem teszi alapszakasszá a meccset', () => {
  assert.equal(classifyPhase('Harmadik helyért - 2. mérkőzés', 3).phase, 'playoff');
  assert.equal(classifyPhase(null, 8).phase, 'regular');
  assert.equal(classifyPhase(null, null).phase, 'other');
});

test('Az MD az FTM és az FTA rate-et külön, definícióval írja ki, kis mintánál nincs arány', () => {
  const md = teamStatsToMd({
    games: [game({ id: 'g1', date: '2025-10-01', opponentGameId: 'o-g1' })],
    statRows: [...ownRows('g1'), ...oppRows('o-g1')], players: [], teamName: 'Minta SE', seasonName: '2025/2026',
  });
  assert.match(md, /\| FTM rate \(FTM\/FGA\) \| 18\.2% \|/);
  assert.match(md, /\| FTA rate \(FTA\/FGA\) \| 21\.8% \|/);
  assert.match(md, /\| Lepattanók \| 33\.0 \| 28\.0 \|/);
  // 80 perc < 100: a „*” jelű sorban a TS% és a per-36 oszlop üres.
  assert.match(md, /Második Játékos \* \|.*\| – \| – \| – \| – \| – \| – \| – \|/);
  assert.match(md, /Első Játékos \(inaktív\) \|/);
});
