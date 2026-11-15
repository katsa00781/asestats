// H32/C – játékos MD export: VAL összes / átlag / per-36, utolsó meccsek, átlátható indexek.
import type { GamePerformance, PlayerStats } from '../lib/dashboard-types';
import { playerSeasonToMd } from '../lib/export-to-md';
import assert from 'node:assert/strict';
import { test } from 'node:test';

// CHANDLER III. John Watson, 2026/27 – a `valuation` a meccsátlag (avg_valuation).
const CHANDLER = {
  id: 'chandler', name: 'CHANDLER III. John Watson', number: 0, position: '2-1', isActive: true,
  gamesPlayed: 10, points: 195, minutes: 254,
  shooting: {
    close: { made: 39, attempted: 65 }, mid: { made: 5, attempted: 10 },
    three: { made: 23, attempted: 64 }, freeThrow: { made: 38, attempted: 45 },
  },
  rebounds: { offensive: 6, defensive: 29, total: 35 },
  assists: 24, steals: 18, turnovers: 21, foulsCommitted: 22, foulsDrawn: 0, blocks: 1,
  valuation: 21.8, offensiveRating: 130, defensiveRating: 90.2,
  trueShootingPct: 61.4, effectiveShootingPct: 56.5, gameHistory: [],
} as unknown as PlayerStats;

const GAME: GamePerformance = {
  date: '2026-11-14', opponent: 'Alba Fehérvár', points: 32, minutes: 21,
  shooting: {
    close: { made: 6, attempted: 7 }, mid: { made: 0, attempted: 0 },
    three: { made: 4, attempted: 6 }, freeThrow: { made: 8, attempted: 9 },
  },
  rebounds: { offensive: 0, defensive: 3, total: 3 }, assists: 3, steals: 1, turnovers: 3, blocks: 0, valuation: 36,
};

test('VAL: 218 összes, 21,8 / meccs, 30,9 / 36 – nem kétszer osztva', () => {
  const md = playerSeasonToMd(CHANDLER);
  assert.match(md, /\| Valuation \| 218 \| 21\.8 \|/);
  assert.match(md, /\| VAL\/36 perc \| 30\.9 \|/);
  assert.match(md, /\| VAL\/36 \| 30\.9 \|/);
});

test('Utolsó meccsek: a külön átadott meccslista kitölti a táblát, ha a gameHistory üres', () => {
  const md = playerSeasonToMd(CHANDLER, [GAME]);
  assert.match(md, /\| 2026-11-14 \| Alba Fehérvár \| 21 \| 32 \| 6\/7 \| 0\/0 \| 4\/6 \| 8\/9 \| 3 \| 3 \| 1 \| 0 \| 3 \| 36 \|/);
});

test('Indexek: átlátható képlet, a nem reprodukálható DB-átlagok (130.00, 90.2) nélkül', () => {
  const md = playerSeasonToMd(CHANDLER);
  assert.doesNotMatch(md, /130\.00|90\.2|Defenzív index/);
  // 195 / (139 + 0,44 · 45) = 1,23; (18 + 1 + 29) / 10 = 4,8
  assert.match(md, /\| Pont \/ dobáskísérlet \(PTS \/ \(FGA \+ 0,44·FTA\)\) \| 1\.23 \|/);
  assert.match(md, /\| Védekező akció \/ meccs \(St \+ Bl \+ V-lep\) \| 4\.8 \|/);
});
