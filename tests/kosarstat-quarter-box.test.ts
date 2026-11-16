import type { QuarterBoxLine } from '../lib/kosarstat-quarter-box';
import {
  buildQuarterMatchupMetrics,
  emptyQuarterLine,
  parseKosarstatQuarterBox,
  quarterPeriodLabel,
  TOTAL_PERIOD_KEY,
} from '../lib/kosarstat-quarter-box';
import { postgameReportToMd } from '../lib/export-to-md';
import { SEASON, report } from './fixtures/postgame-ase-sopron';
import assert from 'node:assert/strict';
import { test } from 'node:test';

// A Kosarstat `game_events` eseménytáblájának oszlopai (valós fejléc).
const HEADERS = [
  'minutes', 'home_event', 'result', 'away_event', 'row', 'row_type',
  'h_ev_form', 'a_ev_form', 'sub_form', 'res_form', 'home_player_filter', 'away_player_filter',
];

/** `[óra, hazai esemény, vendég esemény, hazai névszűrő, vendég névszűrő]` → teljes sor. */
const row = (clock: string, home: string, away: string, homeFilter: string, awayFilter: string, rowType = '3'): unknown[] =>
  [clock, home, '', away, '', rowType, '', '', '', '', homeFilter, awayFilter];

// Szintetikus, de valós szövegformátumú meccsrészlet (a szövegek a 2026/27-es eseménylistákból).
const ROWS: unknown[][] = [
  ['', '1. negyed', '', '', '0.1', '1', '', '', '', '', '', ''],
  row('', 'KRNJAJSZKI Borisz | PALLAI Tamás', '', '', '', '4'),
  row('Q1 9:42', 'A. Barnes kihagyott középtávoli', '', 'Auston BARNES', ''),
  row('Q1 9:38', '', 'D. Underwood védőlepattanó', '', 'Dimitrius UNDERWOOD'),
  row('Q1 9:22', '', 'Mócsán B. sikeres közeli 2 pont', '', 'MÓCSÁN Bálint'),
  // Gólpassz: a szűrő a két teljes nevet összefűzve adja.
  row('Q1 9:06', 'C. Goodwin sikeres zsákolás (Gólpassz: Krnjajszki B.) 2 pont', '', 'Chevez GOODWIN KRNJAJSZKI Borisz', ''),
  row('Q1 8:21', '', 'Mócsán B. eladott labda (C. Goodwin labdaszerzés)', 'Chevez GOODWIN', 'MÓCSÁN Bálint'),
  row('Q1 8:07', 'Krnjajszki B. sikeres hárompontos 3 pont', '', 'KRNJAJSZKI Borisz', ''),
  row('Q1 7:50', '', 'Kovács Á. kihagyott közeli (Blokk: C. Goodwin)', 'Chevez GOODWIN', 'KOVÁCS Ákos'),
  row('Q1 7:48', '', 'Kovács Á. támadólepattanó', '', 'KOVÁCS Ákos'),
  row('Q1 7:40', 'C. Goodwin fault (Kovács Á. ellen)', '', 'Chevez GOODWIN', 'KOVÁCS Ákos'),
  row('Q1 7:40', '', 'Kovács Á. sikeres büntető 1 pont', '', 'KOVÁCS Ákos'),
  row('Q1 7:40', '', 'Kovács Á. kihagyott büntető', '', 'KOVÁCS Ákos'),
  row('Q1 7:30', 'Csere: A. Barnes helyett Pallai T.', '', 'Auston BARNES PALLAI Tamás', ''),
  row('Q1 7:20', 'Időkérés', '', '', ''),
  ['', '2. negyed', '', '', '0.1', '1', '', '', '', '', '', ''],
  // A büntetőhöz írt gólpassz is gólpassz (a hivatalos box score is így számol).
  row('Q2 9:00', 'Pallai T. sikeres büntető (Gólpassz: Krnjajszki B.) 1 pont', '', 'PALLAI Tamás KRNJAJSZKI Borisz', ''),
  // Holt labdás eladás, csapat technikai hiba, játékos technikai hiba.
  row('Q2 8:40', 'Pallai T. eladott labda', '', 'PALLAI Tamás', ''),
  row('Q2 8:30', '', 'Csapat technikai hiba', '', ''),
  row('Q2 8:20', 'Krnjajszki B. technikai hiba', '', 'KRNJAJSZKI Borisz', ''),
  // Játékos nélküli (csapat-)lepattanó: csak a csapatsorba kerül.
  row('Q2 8:10', 'Csapat védőlepattanó', '', '', ''),
  ['', 'Hosszabbítás', '', '', '0.1', '1', '', '', '', '', '', ''],
  row('OT1 4:30', '', 'Mócsán B. sikeres hárompontos (Gólpassz: Kovács Á.) 3 pont', '', 'MÓCSÁN Bálint KOVÁCS Ákos'),
];

const BOX = parseKosarstatQuarterBox(HEADERS, ROWS);

const sumLines = (lines: QuarterBoxLine[]) =>
  lines.reduce((acc, line) => {
    (Object.keys(acc) as Array<keyof QuarterBoxLine>).forEach(key => { acc[key] += line[key]; });
    return acc;
  }, emptyQuarterLine());

const player = (side: 'home' | 'away', name: string, period = TOTAL_PERIOD_KEY) => {
  const target = period === TOTAL_PERIOD_KEY ? BOX?.total : BOX?.periods.find(item => item.key === period);
  return target?.players[side].find(line => line.player === name);
};

test('Periódusok a meccs sorrendjében, magyar címkével, hosszabbítással', () => {
  assert.ok(BOX);
  assert.deepEqual(BOX.periods.map(period => period.key), ['Q1', 'Q2', 'OT1']);
  assert.deepEqual(BOX.periods.map(period => period.label), ['N1', 'N2', 'H1']);
  assert.equal(BOX.total.label, 'Teljes meccs');
  assert.equal(quarterPeriodLabel('Q4'), 'N4');
});

test('Pontok és dobások periódusonként; a periódusok összege az egész meccs', () => {
  assert.ok(BOX);
  const [q1, q2, ot] = BOX.periods;
  assert.equal(q1.team.home.points, 5);
  assert.equal(q1.team.away.points, 3);
  assert.equal(q2.team.home.points, 1);
  assert.equal(ot.team.away.points, 3);
  assert.deepEqual(
    { fgm2: q1.team.home.fgm2, fga2: q1.team.home.fga2, fgm3: q1.team.home.fgm3, fga3: q1.team.home.fga3 },
    { fgm2: 1, fga2: 2, fgm3: 1, fga3: 1 }
  );
  assert.deepEqual({ ftm: q1.team.away.ftm, fta: q1.team.away.fta }, { ftm: 1, fta: 2 });
  for (const side of ['home', 'away'] as const) {
    assert.deepEqual(sumLines(BOX.periods.map(period => period.team[side])), BOX.total.team[side]);
  }
});

test('Névfeloldás: gólpassznál a szűrő kettébontva, a teljes név jelenik meg', () => {
  assert.equal(player('home', 'Chevez GOODWIN')?.points, 2);
  assert.equal(player('home', 'KRNJAJSZKI Borisz')?.ast, 2);
  assert.equal(player('away', 'KOVÁCS Ákos')?.ast, 1);
  assert.equal(player('away', 'MÓCSÁN Bálint')?.points, 5);
  // Nincs rövidített (feloldatlan) név.
  for (const side of ['home', 'away'] as const) {
    BOX?.total.players[side].forEach(line => assert.match(line.player, /[A-ZÁÉÍÓÖŐÚÜŰ]{2,}/));
  }
});

test('Gólpassz a büntetőnél is; labdaszerzés és blokk a másik oldalnak', () => {
  assert.equal(player('home', 'KRNJAJSZKI Borisz', 'Q2')?.ast, 1);
  assert.equal(player('home', 'Chevez GOODWIN')?.stl, 1);
  assert.equal(player('home', 'Chevez GOODWIN')?.blk, 1);
  assert.equal(player('away', 'MÓCSÁN Bálint')?.tov, 1);
  assert.equal(BOX?.total.team.home.tov, 1);
  assert.equal(BOX?.total.team.away.tov, 1);
});

test('Fault: személyi és játékos technikai hiba igen, csapat technikai hiba nem', () => {
  assert.equal(player('home', 'Chevez GOODWIN')?.pf, 1);
  assert.equal(player('home', 'KRNJAJSZKI Borisz')?.pf, 1);
  assert.equal(BOX?.total.team.away.pf, 0);
  assert.equal(BOX?.total.team.home.pf, 2);
});

test('Csapat-lepattanó a csapatsorban igen, játékossorban nem; csere és időkérés nem esemény', () => {
  assert.ok(BOX);
  assert.equal(BOX.total.team.home.dreb, 1);
  assert.equal(sumLines(BOX.total.players.home).dreb, 0);
  assert.equal(player('home', 'Auston BARNES')?.fga2, 1);
  assert.equal(BOX.total.players.home.some(line => /csere|időkérés|csapat/i.test(line.player)), false);
});

test('Mutatók: közös birtoklás, ratingek, Oliver TO rate, OREB%, null üres mintánál', () => {
  const own: QuarterBoxLine = { ...emptyQuarterLine(), points: 20, fgm2: 6, fga2: 12, fgm3: 2, fga3: 6, ftm: 2, fta: 4, oreb: 3, dreb: 8, tov: 2 };
  const opp: QuarterBoxLine = { ...emptyQuarterLine(), points: 15, fgm2: 5, fga2: 14, fgm3: 1, fga3: 4, ftm: 2, fta: 2, oreb: 2, dreb: 9, tov: 4 };
  const metrics = buildQuarterMatchupMetrics(own, opp);
  // Saját: 18 + 1,76 + 2 − 3 = 18,76; ellenfél: 18 + 0,88 + 4 − 2 = 20,88; átlag 19,82.
  assert.ok(Math.abs(metrics.possessions - 19.82) < 1e-9);
  assert.ok(Math.abs((metrics.own.rating ?? 0) - (20 / 19.82) * 100) < 1e-9);
  assert.ok(Math.abs((metrics.own.efg ?? 0) - ((8 + 1) / 18) * 100) < 1e-9);
  assert.ok(Math.abs((metrics.own.turnoverRate ?? 0) - (2 / (18 + 1.76 + 2)) * 100) < 1e-9);
  assert.ok(Math.abs((metrics.own.orebPct ?? 0) - (3 / 12) * 100) < 1e-9);
  assert.ok(Math.abs((metrics.net ?? 0) - ((20 - 15) / 19.82) * 100) < 1e-9);

  const empty = buildQuarterMatchupMetrics(emptyQuarterLine(), emptyQuarterLine());
  assert.equal(empty.own.efg, null);
  assert.equal(empty.own.rating, null);
  assert.equal(empty.net, null);
});

test('Nem eseménylista táblára null', () => {
  assert.equal(parseKosarstatQuarterBox(['q1', 'q2'], [['20', '18']]), null);
  assert.equal(parseKosarstatQuarterBox(HEADERS, [row('Q1 9:00', 'Időkérés', '', '', '')]), null);
});

test('MD export: negyedenkénti csapattábla a saját csapat szemszögéből, összesítő sorral', () => {
  assert.ok(BOX);
  const base = report();
  const md = postgameReportToMd(base, SEASON, undefined, { quarterBox: { box: BOX, ownSide: 'away' } });
  assert.match(md, /## Negyedenkénti bontás/);
  // Vendég szemszög: N1 3–5, különbség -2; a hosszabbítás és az összesítő is megjelenik.
  assert.match(md, /\| N1 \| 3–5 \| -2 \|/);
  assert.match(md, /\| H1 \| 3–0 \| \+3 \|/);
  assert.match(md, /\| \*\*Teljes meccs\*\* \| 6–6 \| 0 \|/);
  assert.match(md, /\| N1 \| 1\/2 – 1\/2 \| 0\/0 – 1\/1 \| 1\/2 – 0\/0 \|/);
  // Kiegészítő nélkül nincs szakasz.
  assert.doesNotMatch(postgameReportToMd(base, SEASON), /Negyedenkénti bontás/);
});
