import {
  buildAggregatedKosarstatClutchContext,
  buildAggregatedKosarstatPlayerClutchContext,
  buildPostgamePbpContextFromKosarstatClutch,
  parseKosarstatClutchGame,
} from '../lib/kosarstat-clutch-context';
import { buildNormalizedNameProfile } from '../lib/season-comparison-helpers';
import { CLUTCH_AWAY_TEAM, CLUTCH_HOME_TEAM, CLUTCH_TABLES_RAW } from './fixtures/kosarstat-deac-ase-clutch';
import assert from 'node:assert/strict';
import { test } from 'node:test';

// Valós adat: DEAC – Atomerőmű SE 74–83 (2026-11-11), az ASE vendég. A H34/F1b-ben a
// SeasonComparison-ből bájtra azonosan kiszervezett clutch-parser jellemző tesztjei.
const TABLES = CLUTCH_TABLES_RAW.map(table => ({ headers: table.headers, rows: table.rows, sourceTableDomId: table.source_table_dom_id }));
const META = { homeTeamName: CLUTCH_HOME_TEAM, awayTeamName: CLUTCH_AWAY_TEAM };
const GAME = parseKosarstatClutchGame(TABLES, META, 'away', 'Atomerőmű SE');

test('Oldalválasztás: az ASE a saját csapat vendégként, a DEAC az ellenfél', () => {
  assert.ok(GAME);
  assert.equal(GAME.ownTeam.teamName, 'Atomerőmű SE');
  assert.equal(GAME.oppTeam.teamName, 'DEAC');
  // Csapatnév nélkül is az oldal dönt.
  assert.equal(parseKosarstatClutchGame(TABLES, META, 'away')?.ownTeam.teamName, 'Atomerőmű SE');
  assert.equal(parseKosarstatClutchGame(TABLES.slice(0, 6), META, 'away'), null);
});

test('Játékossor: Benke clutch-sora a táblából, usage-bázis = 2PA + 3PA + 0,44·FTA + TOV', () => {
  assert.ok(GAME);
  const benke = GAME.ownTeam.players.find(player => player.player === 'BENKE Szilárd');
  assert.deepEqual(benke, {
    player: 'BENKE Szilárd',
    seconds: 300,
    points: 5,
    assists: 1,
    turnovers: 0,
    drb: 2,
    orb: 0,
    trb: 2,
    ftMade: 0,
    ftAtt: 0,
    fgAtt: 3,
    fga2: 2,
    fga3: 1,
    usageBase: 3,
  });
});

test('Arány-mutatók: ORtg / DRtg / TOV% / FT-ráta a birtoklásbecslésből', () => {
  assert.ok(GAME);
  // ASE: 13 pont, 8 FGA + 2 TOV − 0 OREB = 10 birtoklás → 130; DEAC: 8 pont, 11 FGA + 0,44·5 FTA − 3 OREB = 10,2 → 78,4.
  assert.equal(GAME.clutch.ortg, 130);
  assert.equal(GAME.clutch.drtg, 78.4);
  assert.equal(GAME.clutch.net, 51.6);
  assert.equal(GAME.clutch.tovPct, 20);
  assert.equal(GAME.clutch.ftRate, 0);
  assert.equal(GAME.clutch.assistToTurnover, 1.5);
  assert.equal(GAME.clutch.rebPct, 0);
  assert.equal(GAME.clutch.available, true);
});

// ISMERT HIBA (H35, a refaktor előtt is így volt): a `CSAPAT` összesítő sor játékosként számít, ezért a
// darabszámok és a minta duplázódnak, a „CSAPAT” a top usage listára kerül. A H34 viselkedésváltozás nélküli
// refaktor, ezért ez a teszt a mostani kimenetet rögzíti; a H35 javításakor a helyes értékekre kell átírni
// (ASE 13 – DEAC 8, minta 05:00, top usage: Benke / Halmai 0,3).
test('Jellemző teszt – ismert hiba (H35): a CSAPAT sor duplázza a darabszámokat', () => {
  assert.ok(GAME);
  assert.ok(GAME.ownTeam.players.some(player => player.player === 'CSAPAT'));
  assert.equal(GAME.clutch.ownPoints, 26);
  assert.equal(GAME.clutch.oppPoints, 16);
  assert.equal(GAME.clutch.diff, 10);
  assert.equal(GAME.clutch.ownTurnovers, 4);
  assert.equal(GAME.clutch.sampleSize, 1500);
  assert.equal(GAME.clutch.sampleLabel, '25:00');
  assert.deepEqual(GAME.clutch.topUsageClosers, [
    { player: 'CSAPAT', usageShare: 0.5 },
    { player: 'BENKE Szilárd', usageShare: 0.15 },
    { player: 'HALMAI Dániel', usageShare: 0.15 },
  ]);
});

test('Post-game PBP kontextus: a clutch rész a meccs-parserből', () => {
  const context = buildPostgamePbpContextFromKosarstatClutch(TABLES, META, 'away', 'Atomerőmű SE');
  assert.ok(context && GAME);
  assert.deepEqual(context.clutch, GAME.clutch);
  assert.deepEqual(context.turnoverTypes, []);
  assert.equal(context.ownTurnovers, GAME.ownTeam.totals.turnovers);
});

test('Szezonos csapat-aggregálás: egy meccsből a meccs-értékek, a top usage az aktív keretre szűrve', () => {
  assert.ok(GAME);
  assert.equal(buildAggregatedKosarstatClutchContext([]), null);
  const roster = ['BENKE Szilárd', 'HALMAI Dániel', 'Kalif YOUNG'].map(buildNormalizedNameProfile);
  const season = buildAggregatedKosarstatClutchContext([GAME], roster);
  assert.ok(season);
  assert.equal(season.ortg, 130);
  assert.equal(season.drtg, 78.4);
  assert.equal(season.sampleLabel, GAME.clutch.sampleLabel);
  assert.deepEqual(season.topUsageClosers.map(item => item.player), ['BENKE Szilárd', 'HALMAI Dániel', 'Kalif YOUNG']);
});

test('Játékos clutch-kontextus: illesztés névprofillal, kevés meccsnél nincs szerep-verdikt', () => {
  assert.ok(GAME);
  const benke = buildAggregatedKosarstatPlayerClutchContext([GAME], [buildNormalizedNameProfile('Benke Szilárd')]);
  assert.equal(benke.games, 1);
  assert.equal(benke.sampleLabel, '05:00');
  assert.equal(benke.tsPct, 83.3);
  assert.equal(benke.ppp, 1.667);
  assert.equal(benke.confidence, 'alacsony');
  assert.equal(benke.roleNote, null);
  assert.match(benke.sampleWarning ?? '', /^Kevés adat: 1 clutch meccs/);
  // A usage% nevezője a (H35 miatt duplázott) csapat-bázis: 3 / 20.
  assert.equal(benke.usagePct, 15);

  const nobody = buildAggregatedKosarstatPlayerClutchContext([GAME], [buildNormalizedNameProfile('Nem Létező')]);
  assert.equal(nobody.games, 0);
  assert.equal(nobody.sampleWarning, 'Nincs Kosarstat clutch minta ehhez a játékoshoz.');
});
