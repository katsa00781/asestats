import type { KosarstatPlayerRotation } from '../lib/kosarstat-substitutions';
import {
  endsOnCourt,
  groupRotationByPlayer,
  parseKosarstatSubstitutions,
  rotationFromMinuteCodes,
  validateRotation,
} from '../lib/kosarstat-substitutions';
import { postgameReportToMd } from '../lib/export-to-md';
import { AWAY_GRID, EVENT_HEADERS, EVENT_ROWS, HOME_GRID } from './fixtures/kosarstat-ase-sopron-rotation';
import { SEASON, report } from './fixtures/postgame-ase-sopron';
import assert from 'node:assert/strict';
import { test } from 'node:test';

// Valós adat: Atomerőmű SE – Sopron KC 109–80 (2026-10-10).
const SUBS = parseKosarstatSubstitutions(EVENT_HEADERS, EVENT_ROWS);
const gridRotations = (grid: Array<[string, string]>) => grid.map(([player, codes]) => rotationFromMinuteCodes(player, codes.split('')));
const HOME = gridRotations(HOME_GRID);
const STARTERS = HOME.filter(rotation => rotation.isStarter).map(rotation => rotation.player);

const minutes = (rotation: KosarstatPlayerRotation | undefined, type: 'in' | 'out') =>
  (rotation?.events ?? []).filter(event => event.type === type).map(event => event.minute);
const byPlayer = (rotations: KosarstatPlayerRotation[], player: string) => rotations.find(rotation => rotation.player === player);

test('Eseménylista: mind az 58 csere, teljes névvel, a negyedik negyeddel együtt', () => {
  assert.ok(SUBS);
  // Csere-soronként egy lecserélés és egy beállás.
  assert.equal(SUBS.home.length, 64);
  assert.equal(SUBS.away.length, 52);
  const names = new Set(SUBS.home.map(event => event.player));
  assert.deepEqual([...names].sort(), HOME_GRID.map(([player]) => player).sort());
  // Rövidített név („J. Chandler”, „Géringer G.”) nem marad.
  assert.ok(![...names, ...SUBS.away.map(event => event.player)].some(name => /\.$|^\p{L}\. /u.test(name)));
  assert.ok(SUBS.away.some(event => event.player === 'Robert FORD III'));

  const fourthQuarter = SUBS.home.filter(event => event.clockLabel.startsWith('Q4'));
  assert.equal(fourthQuarter.length, 18);
  assert.deepEqual(
    fourthQuarter.filter(event => event.player === 'Jay Jay CHANDLER').map(event => [event.type, event.clockLabel, event.minute]),
    [['in', 'Q4 4:49', 36], ['out', 'Q4 4:49', 36]]
  );
  // A félidei (Q2 0:00) csere a 21. perc – mint a percrácsban.
  assert.ok(SUBS.home.some(event => event.clockLabel === 'Q2 0:00' && event.minute === 21 && event.gameSecond === 1200));
});

test('Chandler és Révész be- és lecserélései párosíthatók (a hibalista esete)', () => {
  assert.ok(SUBS);
  const rotations = groupRotationByPlayer(SUBS.home, STARTERS);

  const chandler = byPlayer(rotations, 'Jay Jay CHANDLER');
  assert.ok(chandler?.isStarter);
  assert.deepEqual(minutes(chandler, 'in'), [13, 21, 36]);
  assert.deepEqual(minutes(chandler, 'out'), [8, 18, 31, 36]);
  assert.equal(endsOnCourt(chandler), false);

  const revesz = byPlayer(rotations, 'RÉVÉSZ Ádám');
  assert.deepEqual(minutes(revesz, 'in'), [12, 21, 28, 36, 38]);
  assert.deepEqual(minutes(revesz, 'out'), [6, 16, 26, 31, 36]);
  assert.equal(endsOnCourt(revesz!), true);

  // Daniels is érintett: a 36. percben le-, majd visszacserélték.
  const daniels = byPlayer(rotations, 'Clarence DANIELS');
  assert.deepEqual(minutes(daniels, 'in'), [8, 18, 27, 36]);
  assert.deepEqual(minutes(daniels, 'out'), [13, 21, 36]);

  assert.deepEqual(validateRotation(rotations), []);
  // A percrács utolsó perce (független forrás) ugyanazt a meccs végi állapotot adja.
  const observedEnd = new Map(HOME.map(rotation => [rotation.player, rotation.observedEndsOnCourt === true]));
  assert.deepEqual(validateRotation(groupRotationByPlayer(SUBS.home, STARTERS, observedEnd)), []);
  assert.deepEqual(validateRotation(groupRotationByPlayer(SUBS.away, gridRotations(AWAY_GRID).filter(item => item.isStarter).map(item => item.player))), []);
});

test('Percrács: a percenként egy kódból hiányzó eseményt az állapot pótolja, megjelölve', () => {
  const chandler = byPlayer(HOME, 'Jay Jay CHANDLER');
  assert.ok(chandler);
  assert.deepEqual(minutes(chandler, 'in'), [13, 21, 36]);
  assert.deepEqual(chandler.events.filter(event => event.inferred).map(event => [event.type, event.minute]), [['in', 36]]);
  // Daniels: a 36. perc kódja „lejött”, a 37. percben mégis végig pályán van.
  const daniels = byPlayer(HOME, 'Clarence DANIELS');
  assert.deepEqual(daniels?.events.filter(event => event.inferred).map(event => [event.type, event.minute]), [['in', 36]]);
  assert.deepEqual(validateRotation(HOME), []);

  // A pótlás után a rács percre egyezik az eseménylistával.
  assert.ok(SUBS);
  for (const rotation of groupRotationByPlayer(SUBS.home, STARTERS)) {
    const grid = byPlayer(HOME, rotation.player);
    assert.deepEqual(
      grid?.events.map(event => [event.type, event.minute]),
      rotation.events.map(event => [event.type, event.minute]),
      rotation.player
    );
  }
});

test('Validáció: a nyers rács (pótlás nélkül) hibát jelez Chandlernél és Révésznél', () => {
  const raw = HOME.map(rotation => ({ ...rotation, events: rotation.events.filter(event => !event.inferred) }));
  const issues = validateRotation(raw);
  assert.deepEqual(issues.map(issue => issue.player).sort(), ['Clarence DANIELS', 'Jay Jay CHANDLER', 'RÉVÉSZ Ádám'].sort());
  const chandler = issues.find(issue => issue.player === 'Jay Jay CHANDLER');
  assert.equal(chandler?.ins, 2);
  assert.equal(chandler?.outs, 4);
  assert.match(chandler?.message ?? '', /kezdő\): 2 beállás, 4 lecserélés/);
  // Révész: a darabszám (4 / 5) megengedett, a sorrend viszont nem váltakozik.
  assert.match(issues.find(issue => issue.player === 'RÉVÉSZ Ádám')?.message ?? '', /4 beállás, 5 lecserélés – a sorrend nem váltakozik \(36\. perc: lecserélés padon ülő játékosnál\)/);
  // Daniels: 3 / 3 és váltakozik is, de a rács szerint a meccs végén a pályán van.
  assert.match(issues.find(issue => issue.player === 'Clarence DANIELS')?.message ?? '', /3 beállás, 3 lecserélés – a meccs végén a pályán van, az események szerint a padon \(hiányzó beállás\)/);

  // Szabály: kezdőnél a lecserélések száma = beállások, vagy +1; cserénél fordítva.
  const event = (type: 'in' | 'out', minute: number) => ({ type, player: 'X', gameSecond: minute * 60, minute, clockLabel: `${minute}. perc` });
  assert.deepEqual(validateRotation([{ player: 'X', isStarter: true, events: [event('out', 5), event('in', 9), event('out', 20)] }]), []);
  assert.deepEqual(validateRotation([{ player: 'X', isStarter: false, events: [event('in', 5), event('out', 9), event('in', 20)] }]), []);
  assert.equal(validateRotation([{ player: 'X', isStarter: false, events: [event('out', 5)] }]).length, 1);
});

test('Nem eseménylista vagy csere nélküli tábla: null', () => {
  assert.equal(parseKosarstatSubstitutions(['a', 'b'], [['1', '2']]), null);
  assert.equal(parseKosarstatSubstitutions(EVENT_HEADERS, EVENT_ROWS.filter(row => !row.join('|').includes('Csere:'))), null);
});

test('Export MD: a rotációs tábla a forrást, a meccs végi állapotot és a hibát is kiírja', () => {
  assert.ok(SUBS);
  const rows = groupRotationByPlayer(SUBS.home, STARTERS).map(rotation => ({
    player: rotation.player,
    seconds: 1200,
    plusMinus: 0,
    isStarter: rotation.isStarter,
    subInMinutes: minutes(rotation, 'in'),
    subOutMinutes: minutes(rotation, 'out'),
    endsOnCourt: endsOnCourt(rotation),
  }));
  const md = postgameReportToMd(report(), SEASON, undefined, { rotation: rows, rotationSource: 'events', rotationIssues: [] });
  const table = md.split('## Rotáció és cserék')[1]?.split('\n## ')[0] ?? '';
  assert.ok(table.includes('| Játékos | Perc | +/- | Kezdő | Be (perc) | Le (perc) | Meccs végén |'));
  assert.ok(table.includes('| Jay Jay CHANDLER | 20:00 | 0 | igen | 13, 21, 36 | 8, 18, 31, 36 | padon |'));
  assert.ok(table.includes('| RÉVÉSZ Ádám | 20:00 | 0 | igen | 12, 21, 28, 36, 38 | 6, 16, 26, 31, 36 | pályán |'));
  assert.match(table, /Forrás: a Kosarstat eseménylistájának csere-eseményei/);
  assert.doesNotMatch(table, /Párosítási hiba/);

  // Percrács-forrás: a következtetett perc csillagot kap, a hiba megjelenik.
  const grid = postgameReportToMd(report(), SEASON, undefined, {
    rotation: [{ player: 'CHANDLER', seconds: 1355, plusMinus: 25, isStarter: true, subInMinutes: [13, 21, 36], subOutMinutes: [8, 18, 31, 36], inferredInMinutes: [36] }],
    rotationSource: 'grid',
    rotationIssues: ['X (kezdő): 0 beállás, 3 lecserélés – a lecserélések száma a beállásokkal egyenlő vagy eggyel több lehet'],
  });
  const gridTable = grid.split('## Rotáció és cserék')[1]?.split('\n## ')[0] ?? '';
  assert.ok(gridTable.includes('| CHANDLER | 22:35 | +25 | igen | 13, 21, 36* | 8, 18, 31, 36 |'));
  assert.match(gridTable, /\*\*Párosítási hiba:\*\* a be- és lecserélések nem párosíthatók – X \(kezdő\)/);
  assert.match(gridTable, /a \* jelölésű perc a pályán \/ padon állapotból következtetett esemény/);
});
