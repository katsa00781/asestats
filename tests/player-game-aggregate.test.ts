// Játékos meccssorainak összesítése: arányok összegből, nem meccsenkénti átlagból.
import type { PlayerGameLine } from '../lib/player-game-aggregate';
import { aggregatePlayerGames } from '../lib/player-game-aggregate';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const line = (partial: Partial<PlayerGameLine>): PlayerGameLine => ({
  points: 0, fga: 0, fgm: 0, threeMade: 0, midAttempts: 0, fta: 0, ast: 0, tov: 0, ...partial,
});

test('AST/TO összegből: 24 gólpassz / 21 labdavesztés = 1,14, nem a meccsenkénti arányok átlaga', () => {
  // Meccsenként 4/1, 1/5, 6/3, 3/2, 10/10 → arányátlag 1,74; összeg 24/21.
  const games = [line({ ast: 4, tov: 1 }), line({ ast: 1, tov: 5 }), line({ ast: 6, tov: 3 }), line({ ast: 3, tov: 2 }), line({ ast: 10, tov: 10 })];
  const result = aggregatePlayerGames(games);
  assert.equal(Math.round(result.astTo * 100) / 100, 1.14);
});

test('TS%: a két részhalmaz súlyozott összege a teljes érték – nem lehet mindkettő felette', () => {
  const highVolume = [line({ points: 20, fga: 20, fta: 0 }), line({ points: 18, fga: 18, fta: 0 })]; // TS 50%
  const lowVolume = [line({ points: 8, fga: 4, fta: 0 }), line({ points: 6, fga: 3, fta: 0 })]; // TS 100%
  const all = aggregatePlayerGames([...highVolume, ...lowVolume]);
  const high = aggregatePlayerGames(highVolume);
  const low = aggregatePlayerGames(lowVolume);
  assert.ok(all.tsPct !== null && high.tsPct !== null && low.tsPct !== null);
  assert.ok(Math.min(high.tsPct, low.tsPct) <= all.tsPct && all.tsPct <= Math.max(high.tsPct, low.tsPct));
  // Összegből: 52 / (2 · 45) = 57,8%; a meccsenkénti átlag 75% volna.
  assert.equal(Math.round(all.tsPct * 10) / 10, 57.8);
});

test('PPP, TOV%, középtáv-arány és eFG összegből; üres mintánál null', () => {
  const result = aggregatePlayerGames([
    line({ points: 10, fga: 8, fgm: 4, threeMade: 2, midAttempts: 2, fta: 0, tov: 2 }),
    line({ points: 5, fga: 2, fgm: 1, threeMade: 0, midAttempts: 0, fta: 5, tov: 0 }),
  ]);
  // usage = 10 + 0,44·5 + 2 = 14,2
  assert.equal(Math.round((result.ppp ?? 0) * 1000) / 1000, Math.round((15 / 14.2) * 1000) / 1000);
  assert.equal(Math.round((result.tovPct ?? 0) * 10) / 10, Math.round((2 / 14.2) * 1000) / 10);
  assert.equal(result.midRatePct, 20);
  assert.equal(result.efgPct, 60);
  const empty = aggregatePlayerGames([]);
  assert.equal(empty.tsPct, null);
  assert.equal(empty.ppp, null);
  assert.equal(empty.games, 0);
});
