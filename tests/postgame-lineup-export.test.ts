import type { PostgameLineupStintInput } from '../lib/postgame-lineup-export';
import { buildPostgameLineupExport, LINEUP_NET_MIN_SECONDS, MAX_TRIOS } from '../lib/postgame-lineup-export';
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
