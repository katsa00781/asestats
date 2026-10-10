import type { PostgameLineupStintInput } from '../lib/postgame-lineup-export';
import { buildPostgameLineupExport, buildPostgameLineupSides, LINEUP_NET_MIN_SECONDS, MAX_TRIOS } from '../lib/postgame-lineup-export';
import { postgameLineupsToMd } from '../lib/export-to-md';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const seconds = (label: string) => {
  const [min, sec] = label.split(':').map(Number);
  return min * 60 + sec;
};
const stint = (players: string, min: string, teamPts: number, oppPts: number): PostgameLineupStintInput => ({
  players: players.split(', '), seconds: seconds(min), teamPts, oppPts,
});

// Valós adat: Egis Körmend – Atomerőmű SE 84–95 (2026-10-03), a Kosarstat lineup
// oldal ötös-táblái (kosarstat_game_id 20261003140102), PG–C sorrendben.
const ASE: PostgameLineupStintInput[] = [
  stint('Yasiin JOSEPH, Jay Jay CHANDLER, BENKE Szilárd, RÉVÉSZ Ádám, Kalif YOUNG', '11:13', 22, 21),
  stint('HALMAI Dániel, Jay Jay CHANDLER, BENKE Szilárd, RÉVÉSZ Ádám, Kalif YOUNG', '3:29', 10, 4),
  stint('Yasiin JOSEPH, Jay Jay CHANDLER, BENKE Szilárd, RÉVÉSZ Ádám, KRIVACSEVICS Markó', '3:01', 12, 9),
  stint('HALMAI Dániel, Clarence DANIELS, BENKE Szilárd, GÉRINGER Gergő, RÉVÉSZ Ádám', '3:01', 14, 2),
  stint('Yasiin JOSEPH, Clarence DANIELS, BENKE Szilárd, GÉRINGER Gergő, KRIVACSEVICS Markó', '2:56', 6, 4),
  stint('Yasiin JOSEPH, Clarence DANIELS, BENKE Szilárd, RÉVÉSZ Ádám, Kalif YOUNG', '2:53', 3, 7),
  stint('HALMAI Dániel, Jay Jay CHANDLER, Clarence DANIELS, GÉRINGER Gergő, KRIVACSEVICS Markó', '2:47', 2, 8),
  stint('HALMAI Dániel, Jay Jay CHANDLER, Clarence DANIELS, RÉVÉSZ Ádám, Kalif YOUNG', '2:29', 5, 11),
  stint('HALMAI Dániel, Jay Jay CHANDLER, BENKE Szilárd, GÉRINGER Gergő, KRIVACSEVICS Markó', '1:53', 3, 5),
  stint('HALMAI Dániel, Jay Jay CHANDLER, Clarence DANIELS, GÉRINGER Gergő, Kalif YOUNG', '1:17', 4, 3),
  stint('Yasiin JOSEPH, Jay Jay CHANDLER, Clarence DANIELS, GÉRINGER Gergő, KRIVACSEVICS Markó', '1:07', 2, 0),
  stint('Yasiin JOSEPH, Clarence DANIELS, BENKE Szilárd, GÉRINGER Gergő, Kalif YOUNG', '1:04', 7, 3),
  stint('HALMAI Dániel, Jay Jay CHANDLER, Clarence DANIELS, GÉRINGER Gergő, RÉVÉSZ Ádám', '0:58', 3, 0),
  stint('HALMAI Dániel, Jay Jay CHANDLER, BENKE Szilárd, RÉVÉSZ Ádám, KRIVACSEVICS Markó', '0:46', 2, 2),
  stint('HALMAI Dániel, Clarence DANIELS, GÉRINGER Gergő, RÉVÉSZ Ádám, Kalif YOUNG', '0:33', 0, 2),
  stint('HALMAI Dániel, Clarence DANIELS, BENKE Szilárd, GÉRINGER Gergő, KRIVACSEVICS Markó', '0:32', 0, 3),
];
const KORMEND: PostgameLineupStintInput[] = [
  stint('Uchenna IROEGBU, Marques WARRICK, TAKÁCS Kristóf, DURÁZI Krisztofer, IVOSEV Tamás', '8:16', 23, 21),
  stint('BARTIK Zalán, Marques WARRICK, TAKÁCS Kristóf, DURÁZI Krisztofer, IVOSEV Tamás', '6:43', 16, 12),
  stint('Uchenna IROEGBU, Marques WARRICK, COHILL Eric, DURÁZI Krisztofer, Xavier CORK', '4:47', 7, 11),
  stint('Uchenna IROEGBU, Marques WARRICK, COHILL Eric, DURÁZI Krisztofer, IVOSEV Tamás', '3:29', 7, 9),
  stint('Uchenna IROEGBU, Marques WARRICK, COHILL Eric, CSUTI Kornél, Xavier CORK', '2:13', 2, 10),
  stint('Marques WARRICK, KISS Mátyás, TAKÁCS Kristóf, DURÁZI Krisztofer, CSUTI Kornél', '2:08', 5, 2),
  stint('BARTIK Zalán, Uchenna IROEGBU, TAKÁCS Kristóf, DURÁZI Krisztofer, Xavier CORK', '2:04', 4, 1),
  stint('Uchenna IROEGBU, KISS Mátyás, TAKÁCS Kristóf, CSUTI Kornél, Xavier CORK', '1:53', 2, 6),
  stint('Uchenna IROEGBU, Marques WARRICK, TAKÁCS Kristóf, CSUTI Kornél, Xavier CORK', '1:46', 0, 7),
  stint('BARTIK Zalán, Uchenna IROEGBU, TAKÁCS Kristóf, CSUTI Kornél, Xavier CORK', '1:43', 5, 7),
  stint('Uchenna IROEGBU, Marques WARRICK, TAKÁCS Kristóf, DURÁZI Krisztofer, CSUTI Kornél', '1:27', 3, 2),
  stint('Uchenna IROEGBU, Marques WARRICK, TAKÁCS Kristóf, DURÁZI Krisztofer, Xavier CORK', '1:25', 2, 6),
  stint('Uchenna IROEGBU, Marques WARRICK, COHILL Eric, IVOSEV Tamás, CSUTI Kornél', '0:51', 6, 1),
  stint('Marques WARRICK, KISS Mátyás, TAKÁCS Kristóf, CSUTI Kornél, Xavier CORK', '0:43', 0, 0),
  stint('Uchenna IROEGBU, Marques WARRICK, TURCSÁNYI Nándor, DURÁZI Krisztofer, Xavier CORK', '0:33', 2, 0),
];
const STARTERS = ['Yasiin JOSEPH', 'Jay Jay CHANDLER', 'BENKE Szilárd', 'RÉVÉSZ Ádám', 'Kalif YOUNG'];

const own = () => {
  const model = buildPostgameLineupExport({ teamName: 'Atomerőmű SE', starters: STARTERS, stints: ASE });
  assert.ok(model);
  return model;
};
/** A Kosarstat soronként másodpercre kerekít: az összeg 1–2 mp-cel eltérhet a saját összesítőjétől. */
const assertNear = (actual: number | undefined, label: string) =>
  assert.ok(actual !== undefined && Math.abs(actual - seconds(label)) <= 2, `${actual} ≉ ${label}`);
const GAME = { teamName: 'Atomerőmű SE', opponentName: 'Egis Körmend', pointsFor: 95, pointsAgainst: 84 };

test('Az ötösök összege kiadja a teljes meccset és a végeredményt', () => {
  const model = own();
  assert.equal(model.lineups.length, 16);
  assertNear(model.totalSeconds, '40:00');
  assert.equal(model.totalFor, 95);
  assert.equal(model.totalAgainst, 84);
  assert.deepEqual(model.lineups[0].players, STARTERS);
  assert.equal(model.lineups[0].seconds, seconds('11:13'));
});

test('Az on/off a Kosarstat játékostáblájával egyezik, a padon töltött rész a maradék', () => {
  const byPlayer = new Map(own().onOff.map(item => [item.player, item]));
  // Kosarstat: BENKE 30:49, 79–60; JOSEPH 22:15, 52–44; KRIVACSEVICS 13:02, 27–31.
  const benke = byPlayer.get('BENKE Szilárd');
  assertNear(benke?.onSeconds, '30:49');
  assert.deepEqual([benke?.onFor, benke?.onAgainst, benke?.offFor, benke?.offAgainst], [79, 60, 16, 24]);
  assert.equal((benke?.onSeconds ?? 0) + (benke?.offSeconds ?? 0), own().totalSeconds);
  const joseph = byPlayer.get('Yasiin JOSEPH');
  assertNear(joseph?.onSeconds, '22:15');
  assert.deepEqual([joseph?.onFor, joseph?.onAgainst], [52, 44]);
  const krivacsevics = byPlayer.get('KRIVACSEVICS Markó');
  assertNear(krivacsevics?.onSeconds, '13:02');
  assert.deepEqual([krivacsevics?.onFor, krivacsevics?.onAgainst], [27, 31]);
  assert.equal(own().onOff[0].player, 'BENKE Szilárd');
});

test('A poszt szerinti idő az ötös-beosztásból jön', () => {
  // Kosarstat: RÉVÉSZ PF 24.4 perc, C 4.0 perc.
  const revesz = own().onOff.find(item => item.player === 'RÉVÉSZ Ádám');
  assert.deepEqual(revesz?.positions, [
    { position: 'PF', seconds: seconds('24:24') },
    { position: 'C', seconds: seconds('3:59') },
  ]);
});

test('Páros és hármas csak a mintaküszöb fölött, idő szerint rendezve', () => {
  const model = own();
  // 9 játékos: 31 páros és 33 hármas töltött együtt legalább 5 percet.
  assert.equal(model.pairs.length, 31);
  assert.equal(model.trios.length, MAX_TRIOS);
  for (const combo of [...model.pairs, ...model.trios]) assert.ok(combo.seconds >= LINEUP_NET_MIN_SECONDS);
  assert.deepEqual(model.pairs.map(p => p.seconds), [...model.pairs.map(p => p.seconds)].sort((a, b) => b - a));
  // BENKE + RÉVÉSZ: minden közös ötösük összege.
  const pair = model.pairs.find(p => p.players.join('+') === 'BENKE Szilárd+RÉVÉSZ Ádám');
  assert.deepEqual([pair?.seconds, pair?.teamPts, pair?.oppPts], [seconds('24:23'), 63, 45]);
});

test('Ugyanaz az öt játékos más poszt-kiosztással egy ötös', () => {
  const model = buildPostgameLineupExport({
    teamName: 'Teszt', starters: [],
    stints: [
      { players: ['A', 'B', 'C', 'D', 'E'], seconds: 120, teamPts: 4, oppPts: 2 },
      { players: ['B', 'A', 'C', 'D', 'E'], seconds: 200, teamPts: 6, oppPts: 6 },
      { players: ['A', 'B', 'C', 'D'], seconds: 60, teamPts: 9, oppPts: 9 },
    ],
  });
  assert.equal(model?.lineups.length, 1);
  assert.deepEqual(model?.lineups[0], { players: ['B', 'A', 'C', 'D', 'E'], seconds: 320, teamPts: 10, oppPts: 8 });
  assert.deepEqual(model?.onOff.find(item => item.player === 'A')?.positions, [
    { position: 'SG', seconds: 200 }, { position: 'PG', seconds: 120 },
  ]);
  assert.equal(buildPostgameLineupExport({ teamName: 'Üres', starters: [], stints: [] }), null);
});

test('Az MD a nyers számokat mindig, a Net/40-et csak 5 perc fölött adja', () => {
  const opponent = buildPostgameLineupExport({ teamName: 'Egis Körmend', starters: [], stints: KORMEND });
  assert.equal(opponent?.totalFor, 84);
  assert.equal(opponent?.totalAgainst, 95);
  const md = postgameLineupsToMd({ own: own(), opponent }, GAME).join('\n');
  assert.match(md, /## Ötösök és on\/off \(Kosarstat lineup\)/);
  assert.match(md, /\*\*Lefedett játékidő:\*\* 39:59 \| \*\*Pontok ez idő alatt:\*\* 95–84 \| \*\*Különböző ötösök:\*\* 16/);
  // Kosarstat On 40 a kezdő ötösre: 3.6; a 3:29-es ötös nem kap vetített értéket.
  assert.ok(md.includes('| 1 | Yasiin JOSEPH | Jay Jay CHANDLER | BENKE Szilárd | RÉVÉSZ Ádám | Kalif YOUNG | 11:13 | 22 | 21 | +1 | +3.6 |'));
  assert.ok(md.includes('| 2 | HALMAI Dániel | Jay Jay CHANDLER | BENKE Szilárd | RÉVÉSZ Ádám | Kalif YOUNG | 3:29 | 10 | 4 | +6 | – |'));
  // Kosarstat On40: BENKE 24.7.
  assert.ok(md.includes('| BENKE Szilárd | SF 30:48 | 30:48 | 79–60 | +19 | +24.7 | 9:11 | 16–24 | -8 | -34.8 |'));
  assert.match(md, /### Ellenfél ötösei – Egis Körmend/);
  assert.ok(md.includes('**Pontok ez idő alatt:** 84–95'));
  assert.doesNotMatch(md, /Eltérés/);
});

test('Hiányos vagy hiányzó ötös-adat jelölve van', () => {
  const partial = buildPostgameLineupExport({ teamName: 'Atomerőmű SE', starters: [], stints: ASE.slice(0, 3) });
  const md = postgameLineupsToMd({ own: partial, opponent: null }, GAME).join('\n');
  assert.match(md, /Eltérés:\*\* az ötös-tábla pontösszege \(44–34\) nem egyezik a végeredménnyel \(95–84\)/);
  assert.doesNotMatch(md, /Ellenfél ötösei/);

  const missing = postgameLineupsToMd({ own: null, opponent: null }, GAME).join('\n');
  assert.match(missing, /Nem elérhető adat/);
  assert.doesNotMatch(missing, /\| # \|/);
});

// Valós adat: Atomerőmű SE – Sopron KC 109–80 (2026-10-10), kosarstat_game_id
// 20261010102163. Az ASE táblájának utolsó sora 0:00 idejű, 1–0 ponttal: csere
// közben dobott büntető, a Kosarstat idő nélküli ötöshöz rendeli.
const ASE_SOPRON: PostgameLineupStintInput[] = [
  stint('Yasiin JOSEPH, Jay Jay CHANDLER, BENKE Szilárd, RÉVÉSZ Ádám, Kalif YOUNG', '11:02', 29, 17),
  stint('HALMAI Dániel, Clarence DANIELS, GÉRINGER Gergő, EILINGSFELD János, KRIVACSEVICS Markó', '3:59', 7, 12),
  stint('Yasiin JOSEPH, Clarence DANIELS, BENKE Szilárd, EILINGSFELD János, Kalif YOUNG', '3:49', 5, 5),
  stint('HALMAI Dániel, Jay Jay CHANDLER, BENKE Szilárd, GÉRINGER Gergő, Kalif YOUNG', '2:43', 5, 5),
  stint('HALMAI Dániel, MERKL Barna, Clarence DANIELS, GÉRINGER Gergő, RÉVÉSZ Ádám', '2:35', 10, 1),
  stint('HALMAI Dániel, MERKL Barna, Clarence DANIELS, GÉRINGER Gergő, KRIVACSEVICS Markó', '2:14', 2, 10),
  stint('HALMAI Dániel, Clarence DANIELS, BENKE Szilárd, GÉRINGER Gergő, Kalif YOUNG', '2:01', 5, 4),
  stint('HALMAI Dániel, Jay Jay CHANDLER, BENKE Szilárd, EILINGSFELD János, Kalif YOUNG', '1:52', 8, 8),
  stint('HALMAI Dániel, Jay Jay CHANDLER, Clarence DANIELS, GÉRINGER Gergő, Kalif YOUNG', '1:37', 7, 2),
  stint('HALMAI Dániel, Jay Jay CHANDLER, Clarence DANIELS, EILINGSFELD János, RÉVÉSZ Ádám', '1:30', 5, 0),
  stint('HALMAI Dániel, Clarence DANIELS, BENKE Szilárd, EILINGSFELD János, RÉVÉSZ Ádám', '1:25', 8, 2),
  stint('HALMAI Dániel, Jay Jay CHANDLER, BENKE Szilárd, RÉVÉSZ Ádám, Kalif YOUNG', '1:11', 5, 0),
  stint('Yasiin JOSEPH, Clarence DANIELS, BENKE Szilárd, EILINGSFELD János, KRIVACSEVICS Markó', '1:04', 8, 5),
  stint('HALMAI Dániel, Jay Jay CHANDLER, Clarence DANIELS, GÉRINGER Gergő, RÉVÉSZ Ádám', '0:48', 0, 3),
  stint('HALMAI Dániel, Jay Jay CHANDLER, BENKE Szilárd, EILINGSFELD János, RÉVÉSZ Ádám', '0:46', 0, 0),
  stint('Yasiin JOSEPH, Jay Jay CHANDLER, BENKE Szilárd, GÉRINGER Gergő, Kalif YOUNG', '0:44', 4, 0),
  stint('Yasiin JOSEPH, Jay Jay CHANDLER, BENKE Szilárd, EILINGSFELD János, RÉVÉSZ Ádám', '0:22', 0, 3),
  stint('Yasiin JOSEPH, Clarence DANIELS, BENKE Szilárd, EILINGSFELD János, RÉVÉSZ Ádám', '0:18', 0, 3),
  stint('HALMAI Dániel, Clarence DANIELS, BENKE Szilárd, EILINGSFELD János, Kalif YOUNG', '0:00', 1, 0),
];
/** A Kosarstat játékostáblájának +/- oszlopa (a „hivatalos” érték). */
const ASE_SOPRON_OFFICIAL = [
  ['BENKE Szilárd', 26], ['Kalif YOUNG', 28], ['HALMAI Dániel', 16], ['Jay Jay CHANDLER', 25],
  ['Clarence DANIELS', 11], ['RÉVÉSZ Ádám', 28], ['Yasiin JOSEPH', 13], ['GÉRINGER Gergő', 3],
  ['EILINGSFELD János', 4], ['KRIVACSEVICS Markó', -10], ['MERKL Barna', 1],
].map(([player, plusMinus]) => ({ player: String(player), plusMinus: Number(plusMinus) }));
const SOPRON: PostgameLineupStintInput[] = [
  stint('Robert FORD III, Trey WERTZ, MESZLÉNYI Róbert, KUCSERA Dániel, Domagoj PROLETA', '7:38', 15, 24),
  stint('Robert FORD III, RUJÁK András, Trey WERTZ, KOVÁCS Benedek, KUCSERA Dániel', '3:16', 8, 5),
  stint('RUJÁK András, Trey WERTZ, HAJDU Péter, KUCSERA Dániel, Domagoj PROLETA', '2:52', 6, 7),
  stint('RUJÁK András, Trey WERTZ, KOVÁCS Benedek, HAJDU Péter, KELENFÖLDI Domonkos', '2:44', 7, 11),
  stint('Robert FORD III, RUJÁK András, MESZLÉNYI Róbert, KOVÁCS Benedek, Domagoj PROLETA', '2:18', 3, 5),
  stint('Robert FORD III, RUJÁK András, Trey WERTZ, KUCSERA Dániel, Domagoj PROLETA', '2:03', 2, 8),
  stint('RUJÁK András, Trey WERTZ, MESZLÉNYI Róbert, KUCSERA Dániel, KELENFÖLDI Domonkos', '2:03', 2, 2),
  stint('RUJÁK András, Trey WERTZ, MESZLÉNYI Róbert, KUCSERA Dániel, Domagoj PROLETA', '2:01', 4, 5),
  stint('Robert FORD III, RUJÁK András, HAJDU Péter, KUCSERA Dániel, Domagoj PROLETA', '1:52', 8, 8),
  stint('MESZLÉNYI Róbert, KELLER Bendegúz, HAJDU Péter, KELENFÖLDI Domonkos, Domagoj PROLETA', '1:46', 1, 5),
  stint('Trey WERTZ, MESZLÉNYI Róbert, HAJDU Péter, KELENFÖLDI Domonkos, Domagoj PROLETA', '1:41', 8, 2),
  stint('Robert FORD III, RUJÁK András, MESZLÉNYI Róbert, KOVÁCS Benedek, KUCSERA Dániel', '1:37', 2, 7),
  stint('RUJÁK András, Trey WERTZ, HAJDU Péter, KUCSERA Dániel, KELENFÖLDI Domonkos', '1:33', 4, 2),
  stint('Robert FORD III, Trey WERTZ, MESZLÉNYI Róbert, KUCSERA Dániel, KELENFÖLDI Domonkos', '1:11', 0, 5),
  stint('Robert FORD III, Trey WERTZ, MESZLÉNYI Róbert, KOVÁCS Benedek, KUCSERA Dániel', '1:02', 3, 0),
  stint('Robert FORD III, MESZLÉNYI Róbert, KOVÁCS Benedek, KUCSERA Dániel, Domagoj PROLETA', '1:01', 3, 0),
  stint('Robert FORD III, Trey WERTZ, KOVÁCS Benedek, HAJDU Péter, KELENFÖLDI Domonkos', '0:53', 2, 5),
  stint('MESZLÉNYI Róbert, KELLER Bendegúz, HAJDU Péter, KUCSERA Dániel, KELENFÖLDI Domonkos', '0:49', 0, 5),
  stint('Trey WERTZ, KOVÁCS Benedek, HAJDU Péter, KELENFÖLDI Domonkos, Domagoj PROLETA', '0:33', 2, 0),
  stint('RUJÁK András, Trey WERTZ, KOVÁCS Benedek, HAJDU Péter, KUCSERA Dániel', '0:33', 0, 0),
  stint('Robert FORD III, MESZLÉNYI Róbert, KOVÁCS Benedek, HAJDU Péter, Domagoj PROLETA', '0:32', 0, 3),
];
// A Hunbasket box score írásmódja (a `players` tábla nevei) ugyanerre a meccsre.
const ASE_BOX_NAMES = [
  'BENKE Szilárd', 'YOUNG Kalif Karl', 'HALMAI Dániel', 'CHANDLER III. John Watson', 'DANIELS II Clarence Oliver',
  'RÉVÉSZ Ádám', 'JOSEPH Yasiin Yousef', 'GÉRINGER Gergő', 'EILINGSFELD János', 'KRIVACEVIC Markó', 'MERKL Barna Márton',
];
const SOPRON_BOX_NAMES = [
  'KUCSERA Dániel', 'WERTZ III Langston Boyer Walter', 'MESZLÉNYI Róbert Vilmos', 'PROLETA Domagoj', 'RUJÁK András Baldvin',
  'FORD III Robert Edward', 'HAJDU Péter Márton', 'KOVÁCS Benedek Máté', 'KELENFÖLDI Domonkos', 'KELLER Bendegúz',
];
const SOPRON_GAME = { teamName: 'Atomerőmű SE', opponentName: 'Sopron KC', pointsFor: 109, pointsAgainst: 80 };
const aseSopronInput = () => ({
  teamName: 'Atomerőmű SE', starters: STARTERS, stints: ASE_SOPRON, officialPlayers: ASE_SOPRON_OFFICIAL,
});

test('A 0:00 idejű, pontot tartalmazó ötös-sor megmarad: a pontösszeg és az on/off egyezik', () => {
  const model = buildPostgameLineupExport(aseSopronInput());
  assert.ok(model);
  assert.equal(model.lineups.length, 19);
  assert.equal(model.totalFor, 109);
  assert.equal(model.totalAgainst, 80);
  // A box +/- (Kosarstat játékostábla) mind a 11 játékosra egyezik a számolt on +/- értékkel.
  for (const item of model.onOff) {
    assert.equal(item.onFor - item.onAgainst, item.officialPlusMinus, item.player);
  }
  const plusMinus = (player: string) => {
    const item = model.onOff.find(row => row.player === player);
    return item ? item.onFor - item.onAgainst : null;
  };
  assert.deepEqual(
    ['BENKE Szilárd', 'HALMAI Dániel', 'Clarence DANIELS', 'EILINGSFELD János', 'Kalif YOUNG'].map(plusMinus),
    [26, 16, 11, 4, 28]
  );
  // A pont nélküli 0:00 sor továbbra sem ötös.
  const empty = buildPostgameLineupExport({
    teamName: 'Teszt', starters: [],
    stints: [{ players: ['A', 'B', 'C', 'D', 'E'], seconds: 0, teamPts: 0, oppPts: 0 }],
  });
  assert.equal(empty, null);
});

test('HALMAI + RÉVÉSZ a meccs legjobb védekező párosa (Def/40 = 29,1)', () => {
  const model = buildPostgameLineupExport(aseSopronInput());
  const pair = model?.pairs.find(item => item.players.join('+') === 'HALMAI Dániel+RÉVÉSZ Ádám');
  assert.ok(pair);
  assert.equal(pair.seconds, 495);
  assert.equal(Math.round((pair.oppPts * 2400 * 10) / pair.seconds) / 10, 29.1);
});

test('Az ellenfél blokk az ellenfél lineupja, a nevek box score írásmódban', () => {
  const sides = buildPostgameLineupSides({
    own: aseSopronInput(),
    opponent: { teamName: 'Sopron KC', starters: [], stints: SOPRON },
    ownBoxNames: ASE_BOX_NAMES,
    opponentBoxNames: SOPRON_BOX_NAMES,
  });
  assert.ok(sides.own && sides.opponent);
  const ownPlayers = sides.own.onOff.map(item => item.player);
  // Egyetlen írásmód: a Kosarstat alak (KRIVACSEVICS, Jay Jay CHANDLER) eltűnik.
  assert.ok(ownPlayers.includes('KRIVACEVIC Markó'));
  assert.ok(ownPlayers.includes('CHANDLER III. John Watson'));
  assert.ok(ownPlayers.includes('DANIELS II Clarence Oliver'));
  assert.ok(!ownPlayers.some(name => /KRIVACSEVICS|Jay Jay|Clarence DANIELS/.test(name)));
  assert.equal(sides.own.onOff.find(item => item.player === 'KRIVACEVIC Markó')?.officialPlusMinus, -10);

  const opponentPlayers = sides.opponent.onOff.map(item => item.player);
  assert.ok(opponentPlayers.includes('FORD III Robert Edward'));
  assert.ok(opponentPlayers.includes('WERTZ III Langston Boyer Walter'));
  assert.ok(!opponentPlayers.some(name => ASE_BOX_NAMES.includes(name)));
  assert.deepEqual([sides.opponent.totalFor, sides.opponent.totalAgainst], [80, 109]);
  // Kosarstat játékostábla: Robert FORD III −24 (46–70).
  const ford = sides.opponent.onOff.find(item => item.player === 'FORD III Robert Edward');
  assert.deepEqual([ford?.onFor, ford?.onAgainst], [46, 70]);

  const md = postgameLineupsToMd(sides, SOPRON_GAME).join('\n');
  assert.ok(md.includes('**Pontok ez idő alatt:** 109–80'));
  assert.doesNotMatch(md, /Eltérés/);
  assert.match(md, /### Ellenfél ötösei – Sopron KC/);
  assert.match(md, /\| Hivatalos \+\/- \|/);
  assert.ok(md.includes('| BENKE Szilárd | SF 27:17 | 27:17 | 78–52 | +26 | +26 |'));
});

test('A saját csapat lineupja nem jelenhet meg ellenfélként', () => {
  // A hibás eset: az „ellenfél” oldalra is a saját csapat lineupja kerül.
  const sides = buildPostgameLineupSides({
    own: aseSopronInput(),
    opponent: { teamName: 'Sopron KC', starters: [], stints: ASE_SOPRON },
    ownBoxNames: ASE_BOX_NAMES,
    opponentBoxNames: SOPRON_BOX_NAMES,
  });
  assert.ok(sides.own);
  assert.equal(sides.opponent, null);
  const md = postgameLineupsToMd(sides, SOPRON_GAME).join('\n');
  assert.match(md, /Az ellenfél \(Sopron KC\) ötös-adata nem elérhető/);
  assert.doesNotMatch(md, /### Ellenfél ötösei/);

  // Ha a lineup egyetlen játékosa sem párosítható a box score-ral, nincs ötös-adat.
  const foreign = buildPostgameLineupSides({
    own: { teamName: 'Atomerőmű SE', starters: [], stints: SOPRON },
    opponent: null,
    ownBoxNames: ASE_BOX_NAMES,
    opponentBoxNames: [],
  });
  assert.deepEqual(foreign, { own: null, opponent: null });
});

test('Eltérő hivatalos +/- esetén az MD megnevezi az érintett játékosokat', () => {
  // A 0:00 sor nélkül (a korábbi hiba) négy-öt játékos on +/- értéke 1-gyel elmarad.
  const model = buildPostgameLineupExport({ ...aseSopronInput(), stints: ASE_SOPRON.slice(0, -1) });
  const md = postgameLineupsToMd({ own: model, opponent: null }, SOPRON_GAME).join('\n');
  assert.match(md, /az ötös-tábla pontösszege \(108–80\) nem egyezik a végeredménnyel \(109–80\)/);
  assert.match(md, /BENKE Szilárd \(számolt \+25, hivatalos \+26\)/);
  assert.match(md, /HALMAI Dániel \(számolt \+15, hivatalos \+16\)/);
  assert.doesNotMatch(md, /RÉVÉSZ Ádám \(számolt/);
});
