import type { PostgameExportExtras } from '../lib/export-to-md';
import { postgameReportToMd } from '../lib/export-to-md';
import { buildPostgameLineupExport } from '../lib/postgame-lineup-export';
import {
  buildKosarstatPostgameContext,
  buildPostgameAutoFocus,
  mergeKosarstatPostgameContext,
} from '../lib/postgame-report';
import { POINT_SOURCES, SEASON, SHOT_MAP, report } from './fixtures/postgame-ase-sopron';
import assert from 'node:assert/strict';
import { test } from 'node:test';

// Valós adat: Atomerőmű SE – Sopron KC 109–80 (2026-10-10), Kosarstat
// `kosarstat_game_quarter_stats` és `kosarstat_game_team_metrics` sorai.
const quarter = (side: 'home' | 'away', q: number, points: number, cumulative: number) => ({
  team_side: side, team_name: side === 'home' ? 'Atomerőmű SE' : 'Sopron KC', quarter: q, points, cumulative_points: cumulative,
});
const KOSARSTAT = buildKosarstatPostgameContext({
  ownSide: 'home',
  teamName: 'Atomerőmű SE',
  quarterStats: [
    quarter('home', 1, 32, 32), quarter('away', 1, 27, 27), quarter('away', 2, 19, 46), quarter('home', 2, 29, 61),
    quarter('home', 3, 23, 84), quarter('away', 3, 10, 56), quarter('home', 4, 25, 109), quarter('away', 4, 24, 80),
  ],
  teamMetrics: [
    { team_side: 'home', team_name: 'Atomerőmű SE', poss: 75, ortg: 145.333, efg: 68.75, tov_pct: 13.333, orb_pct: 38.462, ftm_rate: 0.328 },
    { team_side: 'away', team_name: 'Sopron KC', poss: 75.68, ortg: 105.708, efg: 54.464, tov_pct: 25.106, orb_pct: 31.034, ftm_rate: 0.339 },
  ],
  pointSources: POINT_SOURCES,
  expectedPoints: { own: 109, opponent: 80 },
});
const REPORT = mergeKosarstatPostgameContext(report(SHOT_MAP), KOSARSTAT);

const EXTRAS: PostgameExportExtras = {
  focus: buildPostgameAutoFocus(REPORT, KOSARSTAT),
  game: { date: '2026-10-10', homeAway: 'home', round: 3, kosarstatGameId: '20261010102163' },
  kosarstat: KOSARSTAT,
  // A Kosarstat percrácsából (2 = becserélés, 3 = lecserélés perce).
  rotation: [
    { player: 'BENKE Szilárd', seconds: 1637, plusMinus: 26, isStarter: true, subInMinutes: [12, 31], subOutMinutes: [8, 27, 36] },
    { player: 'HALMAI Dániel', seconds: 1361, plusMinus: 16, isStarter: false, subInMinutes: [6, 17, 24, 36], subOutMinutes: [14, 21, 31] },
  ],
  officialPlusMinus: { 'BENKE Szilárd': 26, 'HALMAI Dániel': 16, 'KRIVACEVIC Markó': -10 },
  playerTrends: [
    {
      player: 'HALMAI Dániel',
      games: [
        { label: 'szept. 26.', tsPct: 60, usagePct: 18.2, valPer36: 20.5 },
        { label: 'okt. 3.', tsPct: 55.4, usagePct: 21, valPer36: 17.1 },
        { label: 'okt. 10.', tsPct: 78.1, usagePct: 20.9, valPer36: 36 },
      ],
    },
    { player: 'MERKL Barna Márton', games: [{ label: 'okt. 10.', tsPct: 0, usagePct: 0, valPer36: 0 }] },
  ],
};
const MD = postgameReportToMd(REPORT, SEASON, undefined, EXTRAS);
const section = (title: string) => MD.split(`## ${title}`)[1]?.split('\n## ')[0] ?? '';

test('Fejléc: dátum, hazai / vendég, forduló és game ID', () => {
  assert.ok(MD.includes('**Mérkőzés:** 2026.10.10. · hazai · 3. forduló · Kosarstat game ID 20261010102163'));
});

test('Kulcs mutatók: liga medián oszlop a szezonátlag mellett', () => {
  const table = section('Kulcs mutatók');
  assert.match(table, /\| Mutató \| Meccs \| Szezon átl\. \| Delta \| Liga medián \| vs liga \|/);
  // OREB%: 38,5% a meccsen, 33,3% a szezonban; a liga medián oszlop is kitöltött.
  assert.match(table, /\| OREB% \| 38\.5% \| 33\.3% \| \+5\.2 pp \| \d+\.\d% \| [+-]\d+\.\d pp \|/);
  assert.match(table, /\| ORtg \| .* \| – \| – \|/);

  // Ha a referencia maga a liga medián (kis minta), nincs ismétlő oszlop.
  const league = { ...REPORT, baseline: { ...REPORT.baseline!, kind: 'league' as const } };
  assert.doesNotMatch(postgameReportToMd(league, SEASON), /Liga medián \| vs liga \|/);
});

test('Negyedek kumulált különbséggel (+5 / +15 / +28 / +29)', () => {
  const table = section('Negyedek');
  assert.ok(table.includes('| Q1 | 32 | 27 | +5 | +5 |'));
  assert.ok(table.includes('| Q2 | 29 | 19 | +10 | +15 |'));
  assert.ok(table.includes('| Q3 | 23 | 10 | +13 | +28 |'));
  assert.ok(table.includes('| Q4 | 25 | 24 | +1 | +29 |'));
});

test('Kosarstat csapatmutatók kétoszlopos táblában, különbséggel', () => {
  const table = section('Kosarstat csapatmutatók');
  assert.ok(table.includes('| POSS (birtoklás) | 75.0 | 75.7 | -0.7 |'));
  assert.ok(table.includes('| ORTG | 145.3 | 105.7 | +39.6 |'));
  assert.ok(table.includes('| TO% (Kosarstat: LV / birtoklás) | 13.3% | 25.1% | -11.8 pp |'));
  assert.ok(table.includes('| ORB% | 38.5% | 31.0% | +7.4 pp |'));
  assert.ok(table.includes('| FTM rate (FTM/FGA) | 32.8% | 33.9% | -1.1 pp |'));
});

test('Dobástérkép és zónák: arány, delta, FG%, benne a festék zóna és a hiányzó dobás jelzése', () => {
  const table = section('Dobástérkép és zónák');
  assert.match(table, /Hiányos dobástérkép:\*\* 63 dobás a box score 64 mezőnykísérletével szemben \(1 dobás hiányzik\)/);
  assert.ok(table.includes('**Kísérletek:** 63 | **FG%:** 57.1% | **Shot quality index:** 78.3 (szezon 63.0, +15.3)'));
  assert.ok(table.includes('| Gyűrű | 18/25 | 39.7% | 33.2% | +6.5 pp | 72.0% | 67.5% | +4.5 pp |'));
  assert.ok(table.includes('| Festék (gyűrűn kívül) | 2/4 | 6.3% | 14.0% | -7.7 pp |'));
  assert.ok(table.includes('| Gyűrű + festék együtt | 20/29 | 46.0% | 47.2% | -1.2 pp |'));
  assert.ok(table.includes('| Középtáv | 3/5 | 7.9% | 16.8% | -8.9 pp |'));
  assert.ok(table.includes('| Sarok tripla | 0/1 | 1.6% | 3.7% | -2.1 pp |'));
  assert.ok(table.includes('| Tripla összesen | 13/29 | 46.0% | 36.0% | +10.0 pp | 44.8% |'));
});

test('Dobásprofil a referenciához mérve', () => {
  assert.ok(section('Dobásprofil').includes('| 2P arány | 53.1% | 62.5% | -9.4 pp |'));
});

test('Döntő tényezők kategóriánként, előjellel és tengellyel', () => {
  const block = section('Döntő tényezők');
  const efficiency = block.split('### Hatékonyság')[1]?.split('### ')[0] ?? '';
  assert.match(efficiency, /- \(\+\) Támadás: Dobáshatékonysági előny az ellenféllel szemben/);
  assert.match(efficiency, /- \(−\) Védekezés: Periméter-kockázat \(ellenfél 3P 9\/23, 39\.1%/);
  const control = block.split('### Kontroll')[1]?.split('### ')[0] ?? '';
  assert.match(control, /- \(\+\) Támadás: Labdabiztonsági előny/);
});

test('Játékostábla: hivatalos +/- oszlop a Perc után', () => {
  const table = section('Játékos bontás');
  assert.match(table, /\| Játékos \| Poz \| Perc \| \+\/- \| Pont \|/);
  assert.ok(table.includes('| HALMAI Dániel | SF | 23 | +16 | 17 |'));
  assert.ok(table.includes('| KRIVACEVIC Markó | SF | 7 | -10 | 2 |'));
  // Akinek nincs hivatalos értéke, gondolatjelet kap.
  assert.ok(table.includes('| RÉVÉSZ Ádám | SF | 20 | – | 8 |'));
});

test('Rotáció: be- és lecserélési percek játékosonként', () => {
  const table = section('Rotáció és cserék – Atomerőmű SE');
  assert.ok(table.includes('| BENKE Szilárd | 27:17 | +26 | igen | 12, 31 | 8, 27, 36 |'));
  assert.ok(table.includes('| HALMAI Dániel | 22:41 | +16 | – | 6, 17, 24, 36 | 14, 21, 31 |'));
});

test('Játékos trend az utolsó 3 meccsen; az egy meccses játékos kimarad', () => {
  const table = section('Játékos trend (utolsó 3 meccs)');
  assert.ok(table.includes('| HALMAI Dániel | szept. 26. → okt. 3. → okt. 10. | 60.0% → 55.4% → 78.1% | 18.2% → 21.0% → 20.9% | 20.5 → 17.1 → 36.0 |'));
  assert.doesNotMatch(table, /MERKL/);
});

test('Páros tábla Off/40 és Def/40 oszloppal, védekező lista és assist-megjegyzés', () => {
  const stint = (players: string, seconds: number, teamPts: number, oppPts: number) => ({ players: players.split(', '), seconds, teamPts, oppPts });
  const own = buildPostgameLineupExport({
    teamName: 'Atomerőmű SE', starters: [],
    stints: [
      stint('A, B, C, D, E', 600, 30, 20),
      stint('A, B, C, D, F', 400, 10, 5),
      stint('A, F, G, H, I', 500, 20, 30),
    ],
  });
  const md = postgameReportToMd(REPORT, SEASON, { own, opponent: null }, EXTRAS);
  assert.match(md, /\| Páros \| Perc \| Szerzett \| Kapott \| \+\/- \| Net\/40 \| Off\/40 \| Def\/40 \|/);
  // A + B: 1000 mp, 40–25 → Off/40 96,0, Def/40 60,0.
  assert.ok(md.includes('| A + B | 16:40 | 40 | 25 | +15 | +36.0 | 96.0 | 60.0 |'));
  const defense = md.split('### Legjobb védekező együttállások')[1]?.split('\n### ')[0] ?? '';
  assert.ok(defense.includes('| A + B | 16:40 | 25 | 60.0 | +36.0 |'));
  assert.match(md.split('## Adatminőség és megjegyzések')[1] ?? '', /Assist alapú páros \/ hármas adat nem érhető el/);
  // Ötös-adat nélkül az assist-megjegyzésnek nincs mire vonatkoznia.
  assert.doesNotMatch(MD, /Assist alapú/);
});

test('Kiegészítő adatok nélkül az új szakaszok kimaradnak, a riport-alapúak megmaradnak', () => {
  const plain = postgameReportToMd(REPORT, SEASON);
  for (const title of ['Negyedek', 'Kosarstat csapatmutatók', 'Rotáció és cserék', 'Játékos trend']) {
    assert.ok(!plain.includes(`## ${title}`), title);
  }
  assert.doesNotMatch(plain, /\*\*Mérkőzés:\*\*/);
  assert.match(plain, /\| Játékos \| Poz \| Perc \| Pont \|/);
  assert.ok(plain.includes('## Dobástérkép és zónák'));
  assert.ok(plain.includes('## Dobásprofil'));
});
