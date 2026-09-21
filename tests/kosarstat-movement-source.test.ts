import type { SourceTable } from '../lib/kosarstat-movement-source';
import { parseSeasonPlayers, seasonCode } from '../lib/kosarstat-movement-source';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const table: SourceTable = {
  headers: ['status', 'first_game', 'height', 'player', 'weight', 'position'],
  rows: [{ cells: ['U23', '', '197 cm', 'BENKE Szilárd', '95 kg', 'SF'], links: [
    { text: 'BENKE Szilárd', url: 'https://kosarstat.hu/players/player/?player=benkszil95' },
  ] }],
};
test('A szezonnal együtt megadott kerettag meccs nélkül is szerepel; az U23 nem állampolgárság', () => {
  const [player] = parseSeasonPlayers([table]);
  assert.equal(player.kosarstat_player_id, 'benkszil95');
  assert.equal(player.latest_status, null);
  assert.equal(player.height_cm, 197);
  assert.equal(player.position, 'SF');
});
test('A fejlécek alapján olvas, a név helyett a stabil forrásazonosítót használja', () => {
  const rows = [table.rows[0], { ...table.rows[0], links: [{ text: 'Benke Szilárd', url: table.rows[0].links[0].url }] }];
  assert.equal(parseSeasonPlayers([{ ...table, rows }]).length, 1);
});
test('A hiányzó vagy megváltozott forrás nem lesz csendben üres keret', () => {
  assert.throws(() => parseSeasonPlayers([]), /nem található/);
  assert.throws(() => parseSeasonPlayers([{ ...table, rows: [{ ...table.rows[0], cells: ['Új státusz'] }] }]), /Ismeretlen/);
});
test('A magyar ékezetes státuszok és a szezonhatárok érvényesek', () => {
  for (const [source, expected] of [['Hazai', 'hazai'], ['Légiós', 'legios'], ['Honosított', 'honositott']]) {
    assert.equal(parseSeasonPlayers([{ ...table, rows: [{ ...table.rows[0], cells: [source] }] }])[0].latest_status, expected);
  }
  assert.equal(seasonCode('2026/2027'), '2627');
  assert.throws(() => seasonCode('2026/2028'));
  assert.throws(() => seasonCode('hibás'));
});
