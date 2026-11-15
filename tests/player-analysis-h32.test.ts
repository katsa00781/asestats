// H32 – játékoselemzés: AST/TO-limitáció, poszthoz illő szerepcímke, karakterhibák.
import type { RawPlayerSeasonStat } from '../lib/player-analysis';
import { analyzePlayerSeason, buildLeagueBenchmarks, resolveRoleKey, roleLabelForPosition } from '../lib/player-analysis';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

// CHANDLER III. John Watson, 2026/27 (10 meccs) – valós szezonösszeg.
const CHANDLER: RawPlayerSeasonStat = {
  playerId: 'chandler', name: 'CHANDLER III. John Watson', league: 'NB I/A', season: '2026/2027',
  position: 'SG', games: 10, minutes: 254, points: 195,
  close: { made: 39, attempted: 65 }, mid: { made: 5, attempted: 10 }, three: { made: 23, attempted: 64 },
  ft: { made: 38, attempted: 45 }, rebounds: { offensive: 6, defensive: 29, total: 35 },
  assists: 24, steals: 18, blocks: 1, turnovers: 21, fouls: { committed: 22, received: 0 }, valuation: 218,
};
const peer = (id: string, scale: number): RawPlayerSeasonStat => ({
  ...CHANDLER, playerId: id, name: id,
  points: Math.round(140 * scale), assists: Math.round(30 * scale), turnovers: Math.round(15 * scale),
});
const BENCHMARKS = buildLeagueBenchmarks([CHANDLER, peer('a', 0.8), peer('b', 1), peer('c', 1.2), peer('d', 0.9)]);

test('1,5 alatti AST/TO (24 / 21 = 1,14) mindig limitáció', () => {
  const analysis = analyzePlayerSeason(CHANDLER, BENCHMARKS);
  assert.ok(
    analysis.limitations.some(item => item.startsWith('Labdabiztonság: AST/TO 1.14 (1.5 alatt)')),
    analysis.limitations.join('\n')
  );
});

test('1,5 feletti AST/TO-nál nincs labdabiztonsági limitáció', () => {
  const analysis = analyzePlayerSeason({ ...CHANDLER, assists: 40, turnovers: 20 }, BENCHMARKS);
  assert.ok(!analysis.limitations.some(item => item.startsWith('Labdabiztonság')), analysis.limitations.join('\n'));
});

test('A forrásban nincs cirill betű (a „Mezőnydobás” szóban korábban volt)', () => {
  const source = readFileSync(new URL('../lib/player-analysis.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /[\u0400-\u04FF]/);
});

test('Szerepcímke posztfüggő: hátvédnél „Pontszerző hátvéd”, nem „csatár”', () => {
  assert.equal(roleLabelForPosition('Scoring Wing', 'SG'), 'Pontszerző hátvéd');
  assert.equal(roleLabelForPosition('3&D Wing', 'PG'), 'Triplázó-védő hátvéd');
  assert.equal(roleLabelForPosition('Scoring Wing', 'SF'), 'Pontszerző csatár');
  // A hátvéd-címke is visszafejthető a szerepkulcsra (mentett szerepcímkék).
  assert.equal(resolveRoleKey('Pontszerző hátvéd'), 'Scoring Wing');
  const analysis = analyzePlayerSeason(CHANDLER, BENCHMARKS);
  assert.ok(!analysis.roles.some(role => role.includes('csatár')), analysis.roles.join(', '));
});

test('Képesség-pontszám mellett a nyers alap: a 100-as percentilis is megkülönböztethető', () => {
  const analysis = analyzePlayerSeason(CHANDLER, BENCHMARKS);
  assert.ok(analysis.skillBasis);
  // 195 pont / 254 perc · 36 = 27,6
  assert.deepEqual(analysis.skillBasis.scoring, [{ label: 'pont/36', value: 27.6, digits: 1 }]);
  assert.equal(analysis.skillBasis.playmaking.find(item => item.label === 'AST/TO')?.value, 1.14);
  // Hátvédnél a dobás alapja a 3P% is.
  assert.ok(analysis.skillBasis.shooting.some(item => item.label === '3P'));
});
