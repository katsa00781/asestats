import {
  buildPostgameAutoFocus,
  mergeKosarstatPostgameContext,
} from '../lib/postgame-report';
import { postgameReportToMd } from '../lib/export-to-md';
import {
  GAME_SHOTS,
  POINT_SOURCES,
  SEASON,
  SEASON_SHOTS,
  SHOT_MAP,
  kosarstat,
  report,
  shots,
} from './fixtures/postgame-ase-sopron';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('Festék-állítás csak a dobástérkép gyűrű + festék zónájából: növekvő gyűrű-aránynál nincs „visszaesés”', () => {
  const result = report(SHOT_MAP);
  const comparison = result.shotMap?.comparison;
  assert.ok(comparison);
  // Gyűrű +6,5 pp, a gyűrűn kívüli festék zóna −7,7 pp → együtt −1,2 pp.
  assert.equal(comparison.rimRateDelta, 6.5);
  assert.equal(comparison.paintRateDelta, -7.7);
  assert.equal(comparison.interiorRateDelta, -1.2);
  assert.equal(result.shotMap?.team?.rimPct, 72);

  const lines = [...result.problems, ...result.nextFocus, ...result.strengths, ...result.decisiveFactors.offense];
  assert.ok(!lines.some(item => /Festékbefejezések visszaestek|2P-kísérletek aránya|rim run/.test(item)), lines.join('\n'));
});

test('Dobástérkép nélkül a sor a tényleges mutatót nevezi meg, festékre és rim runra nem hivatkozik', () => {
  const result = report();
  const line = result.problems.find(item => item.startsWith('2P-kísérletek aránya visszaesett'));
  assert.ok(line, result.problems.join('\n'));
  assert.match(line, /-9\.4 százalékpont; dobástérkép nélkül a festék-volumen nem ítélhető meg/);
  assert.ok(![...result.problems, ...result.nextFocus].some(item => /Festékbefejezések|rim run/.test(item)));
});

test('Valódi belső visszaesésnél a sor megmarad, mindkét zóna értékével, és jön a fókusz is', () => {
  const result = report({
    gameShots: [...shots('rim', 12, 8), ...shots('paint', 4, 2), ...shots('mid', 18, 8), ...shots('three', 29, 13)],
    seasonShots: SEASON_SHOTS,
  });
  const line = result.problems.find(item => item.startsWith('Festékbefejezések visszaestek'));
  assert.ok(line, result.problems.join('\n'));
  assert.match(line, /gyűrű \+ festék zóna aránya -21\.8 pp; gyűrű -14\.2 pp, festék -7\.7 pp/);
  assert.ok(result.nextFocus.some(item => item.includes('rim run')));
});

test('A dobástérkép hiányzó dobása jelölve van (63 a 64 mezőnykísérletből)', () => {
  const result = report(SHOT_MAP);
  assert.deepEqual(result.shotMap?.coverage, { shotMapAttempts: 63, boxAttempts: 64, missing: 1 });
  const note = result.dataNotes.find(item => item.startsWith('Dobástérkép lefedettség'));
  assert.ok(note, result.dataNotes.join('\n'));
  assert.match(note, /63 dobás a box score 64 mezőnykísérletéből \(1 hiányzik\)/);
  assert.match(note, /57\.1%.*57\.8% \(37\/64\)/);

  // Teljes dobástérképnél nincs megjegyzés.
  const full = report({ gameShots: [...GAME_SHOTS, ...shots('mid', 1, 1)], seasonShots: SEASON_SHOTS });
  assert.equal(full.shotMap?.coverage?.missing, 0);
  assert.ok(!full.dataNotes.some(item => item.startsWith('Dobástérkép')));
});

test('ORB%-előny negatív második esély mellett nem erősség (7–10)', () => {
  const context = kosarstat();
  assert.ok(!context.strengths.some(item => item.includes('ORB%')), context.strengths.join('\n'));
  assert.deepEqual(
    context.problems.filter(item => item.startsWith('Támadólepattanó-fölény')),
    ['Támadólepattanó-fölény nem vált pontra: ORB% különbség +7.4 pp, második esélyből 7–10 pont.']
  );

  // A riport saját „Támadólepattanózás erős” sora is kikerül az erősségek közül.
  const base = report(SHOT_MAP);
  assert.ok(base.strengths.some(item => item.startsWith('Támadólepattanózás erős')), base.strengths.join('\n'));
  const merged = mergeKosarstatPostgameContext(base, context);
  assert.ok(!merged.strengths.some(item => /ORB%|Támadólepattanózás erős/.test(item)), merged.strengths.join('\n'));
  assert.equal(merged.problems.filter(item => item.startsWith('Támadólepattanó-fölény')).length, 1);
  // A „tartsd fenn” fókusz helyére a pontra váltás lép.
  assert.ok(base.nextFocus.some(item => item.startsWith('OREB agresszivitás fenntartása')));
  assert.ok(!merged.nextFocus.some(item => item.startsWith('OREB agresszivitás fenntartása')));
  assert.equal(merged.nextFocus.filter(item => item.startsWith('Második esélyek pontra váltása')).length, 1);
  assert.match(merged.nextFocus.join('\n'), /második esélyből 7–10 pont/);
});

test('A végeredmény ismerete nélkül a kontextus nem ítél, az összefűzés viszont igen', () => {
  const context = kosarstat({ expected: false });
  assert.ok(context.strengths.includes('Második esély: ORB% különbség +7.4 pp.'));
  const merged = mergeKosarstatPostgameContext(report(SHOT_MAP), context);
  assert.ok(!merged.strengths.some(item => /ORB%|Támadólepattanózás erős/.test(item)));
  const problem = merged.problems.find(item => item.startsWith('Támadólepattanó-fölény'));
  assert.ok(problem);
  assert.match(problem, /OREB% \+5\.2 százalékpont a referenciához képest; ORB% különbség \+7\.4 pp, második esélyből 7–10 pont/);
});

test('Pozitív második esély vagy hiányzó / hibás pontforrás mellett az erősség marad', () => {
  const positive = kosarstat({ sources: { ...POINT_SOURCES, home: { ...POINT_SOURCES.home, secondChancePoints: 14 } } });
  assert.ok(positive.strengths.includes('Második esély: ORB% különbség +7.4 pp.'));
  assert.ok(kosarstat({ sources: null }).strengths.includes('Második esély: ORB% különbség +7.4 pp.'));
  // Az eseménylista pontösszege nem egyezik a végeredménnyel → nincs mihez mérni.
  const broken = kosarstat({ sources: { ...POINT_SOURCES, home: { ...POINT_SOURCES.home, points: 101 } } });
  assert.ok(broken.strengths.includes('Második esély: ORB% különbség +7.4 pp.'));
  const merged = mergeKosarstatPostgameContext(report(SHOT_MAP), broken);
  assert.ok(merged.strengths.some(item => item.includes('ORB%')));
});

test('Az Impact címke rangja az osztályt követi: a padról jövő alappillér nem kap alacsonyabb címkét', () => {
  const players = report(SHOT_MAP).playerReport.players;
  const byName = new Map(players.map(player => [player.name, player]));
  const halmai = byName.get('HALMAI Dániel');
  const joseph = byName.get('JOSEPH Yasiin Yousef');
  assert.ok(halmai && joseph);
  assert.ok(halmai.impactScore > joseph.impactScore);
  assert.equal(halmai.impactLabel, 'Stabil alappillér (padról)');
  assert.equal(joseph.impactLabel, 'Stabil alappillér');
  // 15 perc a padról: az alappillérhez kevés a játékidő – a címke ezt kimondja.
  const eilingsfeld = byName.get('EILINGSFELD János');
  assert.ok(eilingsfeld && eilingsfeld.impactScore > joseph.impactScore);
  assert.equal(eilingsfeld.impactLabel, 'Rotációs hozzájárulás (rövid percben)');
  assert.equal(byName.get('RÉVÉSZ Ádám')?.impactLabel, 'Rotációs hozzájárulás');

  const classRank = { mvp: 3, engine: 2, support: 1, struggling: 0 } as const;
  const labelRank = (label: string) =>
    label === 'Elsődleges motor' || label === 'Hatékony szerepjátékos' ? 3
      : label.startsWith('Stabil alappillér') ? 2
        : label.startsWith('Rotációs hozzájárulás') ? 1 : 0;
  for (const player of players) {
    assert.equal(labelRank(player.impactLabel), classRank[player.impactClass], `${player.name}: ${player.impactLabel}`);
  }
});

test('A fókuszlista az ellenfél-specifikus periméter-kockázattal indul, és az MD ugyanezt írja ki', () => {
  const context = kosarstat();
  const merged = mergeKosarstatPostgameContext(report(SHOT_MAP), context);
  const focus = buildPostgameAutoFocus(merged, context);
  assert.ok(focus.length <= 3);
  assert.ok(
    focus.some(item => item.startsWith('Ellenfél-specifikus fókusz: Periméter-kockázat (ellenfél 3P 9/23, 39.1%')),
    focus.join('\n')
  );

  const md = postgameReportToMd(merged, SEASON, undefined, { focus });
  const section = md.split('## Következő fókusz')[1]?.split('\n## ')[0] ?? '';
  for (const item of focus) assert.ok(section.includes(`- ${item}`), item);
  assert.ok(!md.includes('Festékbefejezések visszaestek'));

  // `extras.focus` nélkül az export a riportból maga állítja elő ugyanazt a listát.
  const fallback = postgameReportToMd(merged, SEASON).split('## Következő fókusz')[1] ?? '';
  assert.ok(fallback.includes('Ellenfél-specifikus fókusz: Periméter-kockázat'));
});
