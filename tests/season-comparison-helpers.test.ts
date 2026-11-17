import {
  buildNormalizedNameProfile,
  formatElapsedGameClock,
  formatSecondsAsMmSs,
  matchesNormalizedNameProfile,
  normalizeTeamKey,
  parseMmSsToSeconds,
  parseSignedNumber,
  roundValue,
} from '../lib/season-comparison-helpers';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('parseSignedNumber: előjeles, tizedesvesszős cella; nem szám → null', () => {
  assert.equal(parseSignedNumber('+12'), 12);
  assert.equal(parseSignedNumber('-3'), -3);
  assert.equal(parseSignedNumber(' 38,1 '), 38.1);
  assert.equal(parseSignedNumber(7), 7);
  assert.equal(parseSignedNumber(''), null);
  assert.equal(parseSignedNumber('n/a'), null);
  assert.equal(parseSignedNumber(null), null);
});

test('MM:SS: beolvasás és formázás', () => {
  assert.equal(parseMmSsToSeconds('27:17'), 1637);
  assert.equal(parseMmSsToSeconds('0:05'), 5);
  assert.equal(parseMmSsToSeconds('27'), 0);
  assert.equal(parseMmSsToSeconds(null), 0);
  assert.equal(formatSecondsAsMmSs(1637), '27:17');
  assert.equal(formatSecondsAsMmSs(-4), '00:00');
});

test('formatElapsedGameClock: eltelt idő → negyed és hátralévő óra (a rendes játékidőn belül)', () => {
  assert.equal(formatElapsedGameClock(0), 'Q1 10:00');
  assert.equal(formatElapsedGameClock(15 * 60), 'Q2 05:00');
  assert.equal(formatElapsedGameClock(40 * 60), 'Q4 00:00');
  assert.equal(formatElapsedGameClock(45 * 60), 'Q4 00:00');
});

test('normalizeTeamKey és névprofil-illesztés', () => {
  assert.equal(normalizeTeamKey('Atomerőmű SE'), 'atomeromu se');
  assert.equal(normalizeTeamKey('  NHSZ-Szolnoki   Olajbányász '), 'nhsz szolnoki olajbanyasz');
  const profile = buildNormalizedNameProfile('RÉVÉSZ Ádám');
  assert.deepEqual(profile, { key: 'revesz adam', tokens: ['revesz', 'adam'], raw: 'RÉVÉSZ Ádám' });
  assert.equal(matchesNormalizedNameProfile('Révész Ádám', [profile]), true);
  assert.equal(matchesNormalizedNameProfile('BENKE Szilárd', [profile]), false);
});

test('roundValue', () => {
  assert.equal(roundValue(78.43137), 78.4);
  assert.equal(roundValue(0.15, 3), 0.15);
  assert.equal(roundValue(1.66666, 3), 1.667);
});
