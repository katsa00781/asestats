import {
  applyRotationSource,
  buildAggregatedKosarstatLineupTeamAnalysis,
  buildComboStats,
  parseKosarstatLineupAnalysis,
} from '../lib/kosarstat-lineup-analysis';
import { parseKosarstatSubstitutions } from '../lib/kosarstat-substitutions';
import { LINEUP_TABLES } from './fixtures/kosarstat-ase-sopron-lineup';
import { EVENT_HEADERS, EVENT_ROWS } from './fixtures/kosarstat-ase-sopron-rotation';
import assert from 'node:assert/strict';
import { test } from 'node:test';

// Valós adat: Atomerőmű SE – Sopron KC 109–80 (2026-10-10). A H34/F1b-ben a
// SeasonComparison-ből bájtra azonosan kiszervezett lineup-parser jellemző tesztjei.
const ANALYSIS = parseKosarstatLineupAnalysis(LINEUP_TABLES, 'game-1', 'Atomerőmű SE', 'home');
const ASE = ANALYSIS?.selectedTeam;
const sum = (values: number[]) => values.reduce((acc, value) => acc + value, 0);

test('Csapatok: a Mérleg-sor szerinti két blokk, a név szerinti választás az ASE', () => {
  assert.ok(ANALYSIS && ASE);
  assert.equal(ANALYSIS.gameId, 'game-1');
  assert.equal(ANALYSIS.homeTeam?.teamName, 'Atomerőmű SE');
  assert.equal(ANALYSIS.awayTeam?.teamName, 'Sopron KC');
  assert.equal(ANALYSIS.selectedSide, 'home');
  assert.equal(ASE.teamName, 'Atomerőmű SE');

  // Név nélkül az oldal dönt.
  const away = parseKosarstatLineupAnalysis(LINEUP_TABLES, 'game-1', null, 'away');
  assert.equal(away?.selectedSide, 'away');
  assert.equal(away?.selectedTeam?.teamName, 'Sopron KC');
  assert.equal(parseKosarstatLineupAnalysis([], 'game-1', null), null);
});

test('Játékosperc-tábla: 11 játékos, 200 játékosperc, +/- és On40 a forrásból', () => {
  assert.ok(ASE);
  assert.equal(ASE.playerMinutes.length, 11);
  assert.equal(sum(ASE.playerMinutes.map(row => row.seconds)), 200 * 60);
  assert.deepEqual(ASE.playerMinutes[0], {
    player: 'BENKE Szilárd',
    minutesLabel: '27:17',
    seconds: 1637,
    plusMinus: 26,
    on40: 38.1,
    teamPts: 78,
    oppPts: 52,
  });
  assert.deepEqual(ASE.starters, ['BENKE Szilárd', 'Kalif YOUNG', 'Jay Jay CHANDLER', 'RÉVÉSZ Ádám', 'Yasiin JOSEPH']);
});

test('Ötösök: a szakaszok együtt kiadják a 40 percet és a +29-es végeredményt', () => {
  assert.ok(ASE);
  assert.equal(ASE.stints.length, 19);
  assert.equal(sum(ASE.stints.map(stint => stint.seconds)), 40 * 60);
  assert.equal(sum(ASE.stints.map(stint => stint.plusMinus)), 109 - 80);
  assert.equal(sum(ASE.stints.map(stint => stint.teamPts)), 109);
  assert.equal(sum(ASE.stints.map(stint => stint.oppPts)), 80);
  assert.ok(ASE.stints.every(stint => stint.players.length === 5));
  assert.deepEqual(ASE.stints[0], {
    players: ['Yasiin JOSEPH', 'Jay Jay CHANDLER', 'BENKE Szilárd', 'RÉVÉSZ Ádám', 'Kalif YOUNG'],
    minutesLabel: '11:02',
    seconds: 662,
    teamPts: 29,
    oppPts: 17,
    plusMinus: 12,
    on40: 43.5,
  });
});

test('Párosok / hármasok: a szakaszokból összegezve', () => {
  assert.ok(ASE);
  assert.equal(ASE.pairStats.length, 46);
  assert.equal(ASE.trioStats.length, 84);
  // Egy ötösben 10 páros és 10 hármas van – a játszott idő ennyiszeresen oszlik szét.
  assert.equal(sum(ASE.pairStats.map(pair => pair.seconds)), 10 * 40 * 60);
  assert.equal(sum(ASE.trioStats.map(trio => trio.seconds)), 10 * 40 * 60);
  assert.equal(sum(ASE.pairStats.map(pair => pair.plusMinus)), 10 * 29);
  assert.deepEqual(buildComboStats(ASE.stints, 2), ASE.pairStats);
  assert.equal(ASE.pairStats[0].key, 'GÉRINGER Gergő | Yasiin JOSEPH');
  assert.equal(ASE.pairStats[0].assists, null);
});

test('Rotáció percrácsból: Benke beállásai és lecserélései', () => {
  assert.ok(ASE);
  assert.equal(ASE.rotationSource, 'grid');
  assert.deepEqual(ASE.rotationIssues, []);
  const benke = ASE.playerTimelines.find(row => row.player === 'BENKE Szilárd');
  assert.ok(benke);
  assert.equal(benke.minuteCodes.length, 40);
  assert.deepEqual(benke.subInMinutes, [12, 31]);
  assert.deepEqual(benke.subOutMinutes, [8, 27, 36]);
  assert.equal(benke.endsOnCourt, false);
});

test('applyRotationSource: eseménylista elsőbbsége, tartalék a percrács', () => {
  assert.ok(ASE);
  const subs = parseKosarstatSubstitutions(EVENT_HEADERS, EVENT_ROWS);
  assert.ok(subs);

  const fromEvents = applyRotationSource(ASE, subs.home);
  assert.equal(fromEvents.rotationSource, 'events');
  assert.deepEqual(fromEvents.rotationIssues, []);
  assert.equal(fromEvents.substitutions.length, 64);
  const chandler = fromEvents.playerTimelines.find(row => row.player === 'Jay Jay CHANDLER');
  assert.deepEqual(chandler?.subInMinutes, [13, 21, 36]);
  assert.deepEqual(chandler?.subOutMinutes, [8, 18, 31, 36]);

  assert.equal(applyRotationSource(ASE, undefined).rotationSource, 'grid');
  assert.equal(applyRotationSource(ASE, []).rotationSource, 'grid');

  const unknown = applyRotationSource(ASE, [{ ...subs.home[0], player: 'Ismeretlen JÁTÉKOS' }]);
  assert.equal(unknown.rotationSource, 'grid');
  assert.deepEqual(unknown.rotationIssues, [
    'Az eseménylista cseréi nem párosíthatók a lineup oldal neveivel (Ismeretlen JÁTÉKOS) – a cserék a percrácsból származnak.',
  ]);
});

test('Szezonos aggregálás: azonos ötösök és játékosok összeadódnak', () => {
  assert.ok(ASE);
  const aggregated = buildAggregatedKosarstatLineupTeamAnalysis([ASE, ASE], 'Atomerőmű SE');
  assert.ok(aggregated);
  assert.equal(aggregated.stints.length, ASE.stints.length);
  assert.equal(sum(aggregated.stints.map(stint => stint.seconds)), 2 * 40 * 60);
  assert.equal(sum(aggregated.stints.map(stint => stint.plusMinus)), 2 * 29);
  const benke = aggregated.playerMinutes.find(row => row.player === 'BENKE Szilárd');
  assert.deepEqual(
    benke && { seconds: benke.seconds, minutesLabel: benke.minutesLabel, plusMinus: benke.plusMinus, teamPts: benke.teamPts },
    { seconds: 2 * 1637, minutesLabel: '54:34', plusMinus: 52, teamPts: 156 }
  );
  assert.equal(aggregated.pairStats[0].stints, 2);
});
