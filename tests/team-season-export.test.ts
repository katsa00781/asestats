import type { TeamGame } from '../lib/dashboard-types';
import type { TeamExportStatRow } from '../lib/team-season-export';
import { buildLeagueComparison, buildTeamSeasonExport, classifyPhase } from '../lib/team-season-export';
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
  // Link nélküli helyosztó („5. helyért” → round = 5) az alapszakasz vége után rájátszás.
  const seasonEnd = { lastDate: '2026-04-11', maxRound: 26 };
  assert.equal(classifyPhase(null, 5, { date: '2026-05-03', regularSeason: seasonEnd }).phase, 'playoff');
  assert.equal(classifyPhase(null, 8, { date: '2025-11-08', regularSeason: seasonEnd }).phase, 'regular');
  assert.equal(classifyPhase(null, null, { date: '2026-05-16', regularSeason: seasonEnd }).phase, 'other');
  // Szezon közben: a még nem linkelt következő forduló alapszakasz marad.
  assert.equal(classifyPhase(null, 3, { date: '2026-10-10', regularSeason: { lastDate: '2026-10-03', maxRound: 2 } }).phase, 'regular');
});

test('Negyedprofil: csak a végeredménnyel egyező meccsek, a saját oldal a hazai/vendég alapján', () => {
  const quarters = (id: string, home: number[], away: number[]) => [
    ...home.map((points, i) => ({ kosarstat_game_id: id, team_side: 'home', quarter: i + 1, points })),
    ...away.map((points, i) => ({ kosarstat_game_id: id, team_side: 'away', quarter: i + 1, points })),
  ];
  const model = buildTeamSeasonExport({
    games: [
      game({ id: 'g1', date: '2025-10-01', kosarstatGameId: 'k1' }),
      game({ id: 'g2', date: '2025-10-08', kosarstatGameId: 'k2', homeAway: 'away', ourScore: 70, oppScore: 80, result: 'loss' }),
      game({ id: 'g3', date: '2025-10-15', kosarstatGameId: 'k3' }),
    ],
    statRows: [], players: [], seasonName: '2025/2026',
    quarterRows: [
      ...quarters('k1', [20, 20, 25, 15], [20, 10, 20, 20]),
      ...quarters('k2', [30, 20, 10, 20], [10, 20, 30, 10]),
      ...quarters('k3', [20, 20, 20, 10], [20, 10, 20, 20]),
    ],
  });
  const profile = model.quarterProfile;
  assert.ok(profile);
  assert.equal(profile.games, 2);
  // g1 hazai: 20–20 döntetlen; g2 vendég: 10–30 elvesztett.
  assert.deepEqual(
    { ...profile.quarters[0] },
    { label: '1. negyed', games: 2, pointsFor: 30, pointsAgainst: 50, won: 0, tied: 1, lost: 1 }
  );
  assert.equal(profile.halves[1].pointsFor, 40 + 40);
  assert.match(model.dataNotes.join(' '), /1 meccsen a Kosarstat negyedenkénti pontjainak összege eltér .*2025-10-15/);
});

test('On/off: a pályán és a padon töltött idő pontkülönbsége az ötösökből', () => {
  const model = buildTeamSeasonExport({
    games: [], statRows: [], players: [],
    lineups: {
      games: 2,
      stints: [
        { players: ['A', 'B', 'C', 'D', 'E'], seconds: 1200, teamPts: 50, oppPts: 40 },
        { players: ['A', 'B', 'C', 'D', 'F'], seconds: 600, teamPts: 20, oppPts: 25 },
        { players: ['B', 'C', 'D', 'E', 'F'], seconds: 600, teamPts: 10, oppPts: 20 },
      ],
    },
  });
  const lineups = model.lineups;
  assert.ok(lineups);
  assert.equal(lineups.totalSeconds, 2400);
  assert.deepEqual(lineups.lineups.map(l => l.seconds), [1200, 600, 600]);
  const a = lineups.onOff.find(item => item.player === 'A');
  assert.deepEqual(a, { player: 'A', onSeconds: 1800, onFor: 70, onAgainst: 65, offSeconds: 600, offFor: 10, offAgainst: 20 });
});

test('Liga-összehasonlítás: csapatonként az alapszakasz, a rájátszás nélkül', () => {
  const rows = buildLeagueComparison({
    seasonName: '2025/2026',
    statRows: [...ownRows('a1'), ...oppRows('b1')],
    teams: [
      { teamId: 'A', teamName: 'A csapat', games: [
        game({ id: 'a1', date: '2025-10-01', opponentGameId: 'b1', competitionPhase: 'Alapszakasz' }),
        game({ id: 'a2', date: '2026-05-01', competitionPhase: 'Döntő - 1. mérkőzés' }),
      ] },
      { teamId: 'B', teamName: 'B csapat', games: [
        game({ id: 'b1', date: '2025-10-01', opponentGameId: 'a1', competitionPhase: 'Alapszakasz', ourScore: 70, oppScore: 80, result: 'loss', homeAway: 'away' }),
      ] },
      { teamId: 'C', teamName: 'Csak rájátszás', games: [game({ id: 'c1', date: '2026-05-01', competitionPhase: 'Döntő - 1. mérkőzés' })] },
    ],
  });
  assert.deepEqual(rows.map(row => [row.teamId, row.aggregate.games, row.aggregate.wins]), [['A', 1, 1], ['B', 1, 0]]);
  // A két nézet ugyanarra a birtoklásszámra jut, így A ORtg-je = B DRtg-je.
  assert.equal(rows[0].aggregate.possessions, rows[1].aggregate.possessions);
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
  // Kiegészítő adat nélkül a három szakasz a „nem elérhető” listába kerül.
  assert.match(md, /## Ebben az exportban nem elérhető adat[\s\S]*Negyedprofil[\s\S]*Lineup és on\/off[\s\S]*Liga-összehasonlító/);
});
