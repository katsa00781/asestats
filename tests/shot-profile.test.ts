// A koordináták a H21 zónageometria-teszt valós Hunbasket-pontjai (tests/shot-zone-geometry.test.ts).
import { buildShotProfileSummary, toShotPoints, withShotGames, type ShotEventRow } from '../lib/shot-profile';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const shot = (x: number | null, y: number | null, made: boolean | null, overrides: Partial<ShotEventRow> = {}): ShotEventRow => ({
  raw_game_id: 'r1',
  team_id: 't1',
  player_id: 'p1',
  x,
  y,
  is_successful: made,
  shot_side: 'home',
  ...overrides,
});

test('toShotPoints: hiányzó koordináta vagy oldal kiesik, a találat logikai értékre alakul', () => {
  const points = toShotPoints([
    shot(6, 50, true),
    shot(null, 50, true),
    shot(19, 50, true, { shot_side: null }),
    shot(31, 50, null, { player_id: null, shot_side: 'away' }),
  ]);
  assert.deepEqual(points, [
    { playerId: 'p1', x: 6, y: 50, isSuccessful: true, shotSide: 'home' },
    { playerId: null, x: 31, y: 50, isSuccessful: false, shotSide: 'away' },
  ]);
});

test('buildShotProfileSummary: zónánkénti kísérlet / találat / %, összesített FG%', () => {
  const summary = buildShotProfileSummary(
    toShotPoints([
      shot(6, 50, true), // gyűrű
      shot(94, 56, false, { shot_side: 'away' }), // gyűrű (vendég oldal, tükrözve)
      shot(9, 53, true), // gyűrű
      shot(19, 50, false), // festék
      shot(23, 62, true), // középtáv
      shot(3, 97, true), // sarok tripla
      shot(31, 50, false), // tető tripla
      shot(31, 44, false), // tető tripla
    ])
  );
  assert.equal(summary.attempts, 8);
  assert.equal(summary.made, 4);
  assert.equal(summary.fgPct, 50);
  assert.deepEqual(summary.zoneStats, {
    rim: { attempts: 3, made: 2, pct: 66.7 },
    paint: { attempts: 1, made: 0, pct: 0 },
    mid: { attempts: 1, made: 1, pct: 100 },
    corner3: { attempts: 1, made: 1, pct: 100 },
    aboveBreak3: { attempts: 2, made: 0, pct: 0 },
  });
  assert.equal(summary.games, undefined);
});

test('buildShotProfileSummary: üres lista → 0 kísérlet, 0%', () => {
  const summary = buildShotProfileSummary([]);
  assert.equal(summary.attempts, 0);
  assert.equal(summary.fgPct, 0);
  assert.equal(summary.zoneStats.rim.pct, 0);
});

test('withShotGames: a különböző raw_game_id-k száma; azonosító nélkül a profil változatlan', () => {
  const rows = [shot(6, 50, true), shot(19, 50, false, { raw_game_id: 'r2' }), shot(23, 62, true, { raw_game_id: 'r2' })];
  const summary = buildShotProfileSummary(toShotPoints(rows));
  assert.equal(withShotGames(summary, rows).games, 2);

  const withoutIds = rows.map(row => ({ ...row, raw_game_id: null }));
  assert.equal(withShotGames(summary, withoutIds), summary);
});
