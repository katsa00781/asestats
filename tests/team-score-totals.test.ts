// H29 – a kapott pont egyetlen forrása: a csapat saját `games` sorának végeredménye.
import type { LeagueGameBox, TeamBoxTotals } from '../lib/team-analysis';
import { buildTeamScoreTotals } from '../lib/team-analysis';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const BOX: TeamBoxTotals = { fga2: 40, fgm2: 20, fga3: 25, fgm3: 9, fta: 20, ftm: 15, oreb: 10, dreb: 25, tov: 12 };
const game = (gameId: string, ourTeamId: string, ourScore: number | null, oppScore: number | null, box: TeamBoxTotals | null = BOX): LeagueGameBox => ({
  gameId, date: '2026-11-14', ourTeamId, opponentTeamId: null, box, ourScore, oppScore,
});

test('ASE–Alba 102–91: a meccs két csapat-nézetű sora két csapat kapott pontját adja', () => {
  // Valós adat (2026-11-14): két `games` sor, egy `game_id` alatt csak az egyik csapat játékosai.
  const totals = buildTeamScoreTotals([
    game('dc623905', 'ase', 102, 91),
    game('a81366a7', 'alba', 91, 102),
  ]);
  assert.deepEqual(totals.byTeam.get('ase'), { games: 1, pointsFor: 102, pointsAgainst: 91 });
  assert.deepEqual(totals.byTeam.get('alba'), { games: 1, pointsFor: 91, pointsAgainst: 102 });
  assert.deepEqual(totals.byGame.get('dc623905'), { ourTeamId: 'ase', ourScore: 102, oppScore: 91 });
});

test('Box score nélküli, eredmény nélküli vagy 0–0-s meccs nem számít', () => {
  const totals = buildTeamScoreTotals([
    game('g1', 'ase', 83, 74),
    game('g2', 'ase', 90, 80, null),
    game('g3', 'ase', null, null),
    game('g4', 'ase', 0, 0),
  ]);
  assert.deepEqual(totals.byTeam.get('ase'), { games: 1, pointsFor: 83, pointsAgainst: 74 });
  assert.deepEqual(Array.from(totals.byGame.keys()), ['g1']);
});
