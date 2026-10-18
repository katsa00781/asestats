// H19 – a harmadik hibalista szabályai a valós ASE–Honvéd 112–81 adatokon.
import { analyzePostGameReport, buildPostgameAutoFocus } from '../lib/postgame-report';
import { ASE_GAME, ASE_SEASON, BENCHMARKS, HONVED_GAME, PLAYERS, report } from './fixtures/postgame-ase-honved';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('„Kiugró teljesítmény” az Impact score-ból: Chandler bent (17 perc, 71,1), Daniels nem (47,1)', () => {
  const result = report();
  const byName = new Map(result.playerReport.players.map(player => [player.name, player]));
  assert.ok(result.playerImpact.overperformers.includes('CHANDLER III. John Watson'), result.playerImpact.overperformers.join(', '));
  assert.ok(!result.playerImpact.overperformers.includes('DANIELS II Clarence Oliver'));
  for (const name of result.playerImpact.overperformers) {
    const player = byName.get(name);
    assert.ok(player && player.minutes >= 12, name);
    assert.ok(player.impactClass === 'mvp' || player.impactScore >= 60, `${name}: ${player.impactScore}`);
  }
  // A sorrend az Impact score-t követi.
  const scores = result.playerImpact.overperformers.map(name => byName.get(name)?.impactScore ?? 0);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
  assert.match(result.summary, /Kiugró teljesítmény: CHANDLER III\. John Watson/);
});

test('„Limitált hatás (magas usage)” csak megbízható mintán: 3 perc nem elég (Nagy Dániel)', () => {
  const result = report();
  assert.ok(!result.playerImpact.negative.includes('NAGY Dániel'), result.playerImpact.negative.join(', '));
  assert.doesNotMatch(result.summary, /Limitált hatás: NAGY Dániel/);
});

test('Védekezés: a DRtg dönt, a mondat megnevezi a hajtóerőt (védőlepattanózás) és ami ellene szólt (faultfegyelem)', () => {
  const result = report();
  const defense = result.context.defense;
  assert.ok(defense);
  assert.equal(defense.drtg, 102.7);
  assert.equal(defense.opponentOrebRate, 13.8);
  assert.equal(defense.opponentFtRate, 32.2);
  assert.equal(result.context.defenseEfficiencyDelta, 'Higher');
  assert.match(
    result.summary,
    /védekezésben a liga szintjénél jobb volt \(DRtg 102\.7 vs liga medián \d+\.\d; elsősorban: védőlepattanózás \(ellenfél OREB% 13\.8% vs liga medián \d+\.\d%, -\d+\.\d pp\); ellene szólt: faultfegyelem \(ellenfél FTM rate 32\.2%/
  );
});

test('Védekezés: medián feletti ellenfél-eFG mellett is a DRtg dönt (a szavazás „ligaszintűt” adott volna)', () => {
  // Ugyanannyi kapott pont, de több mezőny- és kevesebb büntetőpont: eFG 57,6%.
  const sharperOpponent = { ...HONVED_GAME, fgm2: 19, ftm: 13 };
  const result = analyzePostGameReport(ASE_GAME, sharperOpponent, ASE_SEASON, BENCHMARKS, PLAYERS);
  assert.equal(result.context.defenseEfficiencyDelta, 'Higher');
  assert.match(result.summary, /ellene szólt: dobásvédekezés \(ellenfél eFG 57\.6%/);
});

test('Gyűrű körüli befejezés: 12/28 (42,9%) vs szezon 60,6% probléma és fókusz, a gyűrű-arány változásától függetlenül', () => {
  const result = report();
  assert.ok(result.problems.includes('Gyűrű körüli befejezés gyenge (12/28, 42.9% vs szezon 60.6%, -17.7 pp)'), result.problems.join('\n'));
  assert.ok(result.nextFocus.some(item => item.startsWith('Befejezés a gyűrűnél: Cél gyűrű FG% 42.9% → 54.9% (szezon 60.6%)')), result.nextFocus.join('\n'));
  assert.ok(!result.problems.some(item => item.startsWith('Dobástérkép: gyengült gyűrűtámadás')));
});

test('Büntetők: magas triplaaránynál nincs „kontaktkeresés” fókusz, a faultfegyelem probléma és fókusz', () => {
  const result = report();
  assert.ok(result.problems.some(item => item.startsWith('Kevés büntető a magas triplaarány mellett (FTM rate 23.1%')), result.problems.join('\n'));
  assert.ok(!result.problems.some(item => item.startsWith('FTM rate a liga alatt')));
  assert.ok(result.problems.includes('Védekezés: Faultfegyelem – az ellenfél 24 büntetőt dobott 59 mezőnykísérletre (FTM rate 32.2% vs liga medián 28.1%, +4.1 pp)'), result.problems.join('\n'));

  const focus = buildPostgameAutoFocus(result);
  assert.ok(!focus.some(item => item.includes('kontaktkeresés')), focus.join('\n'));
  assert.ok(!result.nextFocus.some(item => item.includes('kontaktkeresés')));
  assert.ok(focus[0].startsWith('Faultfegyelem: Cél ellenfél FTM rate 32.2% → 28.1%'), focus.join('\n'));
  assert.ok(focus.some(item => item.startsWith('Befejezés a gyűrűnél')), focus.join('\n'));
  // A büntető-hátrány tippje nem foglal külön helyet a faultfegyelem mellett.
  assert.ok(!focus.some(item => item.startsWith('Ellenfél-specifikus fókusz: Büntető-hátrány')), focus.join('\n'));
});

test('Büntetők: átlagos triplaaránynál az alacsony FTM rate továbbra is kontaktkeresés-fókuszt ad', () => {
  // 3PA-arány 30,8% (a liga medián 37,5% alatt), FTM rate változatlanul 23,1%.
  const insideGame = { ...ASE_GAME, fga2: 54, fgm2: 26, fga3: 24, fgm3: 12 };
  const result = analyzePostGameReport(insideGame, HONVED_GAME, ASE_SEASON, BENCHMARKS, PLAYERS);
  assert.ok(result.problems.some(item => item.startsWith('FTM rate a liga alatt')), result.problems.join('\n'));
  assert.ok(result.nextFocus.some(item => item.startsWith('Büntetők növelése') && item.includes('kontaktkeresés')), result.nextFocus.join('\n'));
});
