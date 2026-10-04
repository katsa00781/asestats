import { assertDatesMatchSeason } from '../scrape-utils';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const season = { name: '2025/2026', start_date: '2025-09-01', end_date: '2026-05-31' };
const item = (date: string) => ({ date, label: 'Hazai–Vendég' });

test('Másik évad menetrendje írás előtt megállítja az importot', () => {
  const lastSeason = ['2024-09-27', '2024-10-04', '2025-02-12'].map(item);
  assert.throws(
    () => assertDatesMatchSeason(season, lastSeason, 'https://hunbasket.hu/menetrend-teljes/ferfi/x2425/hun'),
    /nem illeszkedik a kiválasztott szezonhoz[\s\S]*3 mérkőzésből 3[\s\S]*x2425/
  );
});

test('Néhány kilógó meccs (pl. júniusi döntő) csak figyelmeztetés', () => {
  const games = [...Array.from({ length: 19 }, (_, i) => item(`2025-10-${String(i + 1).padStart(2, '0')}`)), item('2026-06-02')];
  assert.deepEqual(assertDatesMatchSeason(season, games, 'url').map(g => g.date), ['2026-06-02']);
});

test('Illeszkedő menetrend, üres lista és dátum nélküli szezon nem dob hibát', () => {
  assert.deepEqual(assertDatesMatchSeason(season, [item('2025-09-27'), item('2026-05-25')], 'url'), []);
  assert.deepEqual(assertDatesMatchSeason(season, [], 'url'), []);
  assert.deepEqual(assertDatesMatchSeason({ name: 'x', start_date: null, end_date: null }, [item('2020-01-01')], 'url'), []);
});
