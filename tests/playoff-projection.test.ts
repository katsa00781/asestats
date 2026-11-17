import { bestOfSeriesOutcome, probabilityLabel } from '../lib/playoff-projection';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);

test('probabilityLabel: 68% / 32% fölött Magas, 58% / 42%-tól Közepes, köztük Alacsony', () => {
  assert.equal(probabilityLabel(0.68), 'Magas');
  assert.equal(probabilityLabel(0.32), 'Magas');
  assert.equal(probabilityLabel(0.9), 'Magas');
  assert.equal(probabilityLabel(0.58), 'Közepes');
  assert.equal(probabilityLabel(0.42), 'Közepes');
  assert.equal(probabilityLabel(0.6), 'Közepes');
  assert.equal(probabilityLabel(0.5), 'Alacsony');
  assert.equal(probabilityLabel(0.57), 'Alacsony');
});

test('bestOfSeriesOutcome: két győzelemig, 50%-os meccsek', () => {
  const result = bestOfSeriesOutcome([0.5, 0.5, 0.5], 2);
  close(result.homeSeriesWinProbability, 0.5);
  // azonos valószínűségnél az elsőként bejárt végeredmény marad
  assert.equal(result.mostLikelyHomeWinScore, '2-0');
  assert.equal(result.mostLikelyAwayWinScore, '1-2');
});

test('bestOfSeriesOutcome: három győzelemig, 60%-os hazai meccsek (binomiális, kézzel számolva)', () => {
  const result = bestOfSeriesOutcome([0.6, 0.6, 0.6, 0.6, 0.6], 3);
  // 3-0: 0,216; 3-1: 3·0,6³·0,4 = 0,2592; 3-2: 6·0,6³·0,4² = 0,20736
  close(result.homeSeriesWinProbability, 0.216 + 0.2592 + 0.20736);
  assert.equal(result.mostLikelyHomeWinScore, '3-1');
  // 0-3: 0,064; 1-3: 0,1152; 2-3: 0,13824
  assert.equal(result.mostLikelyAwayWinScore, '2-3');
});

test('bestOfSeriesOutcome: a meccs-valószínűség 0–1 közé korlátozva; üres meccslistánál nincs végeredmény', () => {
  const sure = bestOfSeriesOutcome([1.5, 2, 2], 2);
  close(sure.homeSeriesWinProbability, 1);
  assert.equal(sure.mostLikelyHomeWinScore, '2-0');
  // a 0 valószínűségű ágakat is bejárja, így a vendég-végeredmény az elsőként elért (jellemző viselkedés)
  assert.equal(sure.mostLikelyAwayWinScore, '1-2');

  const missing = bestOfSeriesOutcome([], 2);
  close(missing.homeSeriesWinProbability, 0);
  assert.equal(missing.mostLikelyHomeWinScore, null);
});
