// H19 – a harmadik hibalista szabályai a valós ASE–Honvéd 112–81 adatokon.
import { analyzePostGameReport } from '../lib/postgame-report';
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
