// H21 – dobászóna valós méretarányú (FIBA) geometriával, az ASE–Kecskemét
// 112–66 (2026-11-07) valós Hunbasket-koordinátáin.
import { classifyShotZone } from '../lib/postgame-report';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const zone = (x: number, y: number, shotSide: 'home' | 'away' = 'home') => classifyShotZone({ x, y, shotSide });

test('Festék: a festett téglalapon belüli, gyűrűn kívüli dobás festék – a régi besoroló középtávnak vette', () => {
  // ASE dobások a festék oldalsó részéből (régen: „mid”).
  assert.equal(zone(18, 65), 'paint');
  assert.equal(zone(16, 35), 'paint');
  assert.equal(zone(18, 35), 'paint');
  assert.equal(zone(16, 65), 'paint');
  // A büntetővonal előtt, középen.
  assert.equal(zone(19, 50), 'paint');
  // A gyűrű mellett, de a no-charge félkörön (1,25 m) kívül.
  assert.equal(zone(10, 57), 'paint');
  assert.equal(zone(8, 38), 'paint');
  // Vendég oldalon a tükrözött koordinátával (Kecskemét).
  assert.equal(zone(80, 50, 'away'), 'paint');
});

test('Gyűrű: a no-charge félkörön (1,25 m) belül', () => {
  assert.equal(zone(6, 50), 'rim');
  assert.equal(zone(9, 53), 'rim');
  assert.equal(zone(6, 44), 'rim');
  assert.equal(zone(94, 56, 'away'), 'rim');
});

test('Tripla: a tetőn leadott, 6,75 m-en túli dobás hármas – a régi besoroló középtávnak vette', () => {
  assert.equal(zone(31, 44), 'aboveBreak3');
  assert.equal(zone(31, 50), 'aboveBreak3');
  assert.equal(zone(27, 19), 'aboveBreak3');
  // Sarok: az egyenes sarokszakasz mentén.
  assert.equal(zone(3, 97), 'corner3');
  assert.equal(zone(96, 3, 'away'), 'corner3');
});

test('Középtáv: az alapvonal melletti kétpontos nem tripla – a régi besoroló hármasnak vette', () => {
  // Kecskemét: normalizálva (6, 18) és (7, 80) – 4,5–4,8 m-re a kosártól.
  assert.equal(zone(94, 18, 'away'), 'mid');
  assert.equal(zone(93, 80, 'away'), 'mid');
  // A festéken kívüli kétpontos.
  assert.equal(zone(23, 62), 'mid');
  assert.equal(zone(21, 35), 'mid');
});
