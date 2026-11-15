// H28 – post-game riportgenerátor: a második esély erősség-küszöbe, a
// védekezési verdikt súlyozása, a pp-mértékegység és az egységes kerekítés.
import { analyzePostGameReport, buildTeamBenchmarks, mergeKosarstatPostgameContext } from '../lib/postgame-report';
import {
  ASE_GAME,
  ASE_SEASON,
  LEAGUE_TEAMS,
  PLAYERS,
  POINT_SOURCES,
  SHOT_MAP,
  SOPRON_GAME,
  kosarstat,
  report,
  seasonOf,
} from './fixtures/postgame-ase-sopron';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const NOTE_PREFIX = 'Lepattanó-fölény érdemi pontelőny nélkül';

test('Második esély: kis pontelőnynél (11–10) a lepattanó-fölény nem erősség, csak megjegyzés', () => {
  const context = kosarstat({ sources: { ...POINT_SOURCES, home: { ...POINT_SOURCES.home, secondChancePoints: 11 } } });
  assert.ok(!context.strengths.some(item => item.includes('ORB%')), context.strengths.join('\n'));
  assert.ok(context.insightNotes.some(item => item.startsWith(NOTE_PREFIX)), context.insightNotes.join('\n'));
  assert.ok(!context.problems.some(item => item.startsWith('Támadólepattanó-fölény')));

  const base = report(SHOT_MAP);
  assert.ok(base.strengths.some(item => item.startsWith('Támadólepattanózás erős')));
  const merged = mergeKosarstatPostgameContext(base, context);
  assert.ok(!merged.strengths.some(item => /ORB%|Támadólepattanózás erős/.test(item)), merged.strengths.join('\n'));
  assert.ok(!merged.nextFocus.some(item => item.startsWith('OREB agresszivitás fenntartása')));
  // Egyetlen megjegyzés, mindkét bizonyítékkal és a pontokkal.
  const notes = merged.dataNotes.filter(item => item.startsWith(NOTE_PREFIX));
  assert.deepEqual(notes, [
    `${NOTE_PREFIX} (OREB% +5.2 százalékpont a referenciához képest; ORB% különbség +7.4 pp): második esélyből csak 11–10 pont, ezért nem került az erősségek közé.`,
  ]);
});

test('Második esély: a +4 pontos előny már erősség, a pontokkal együtt', () => {
  const context = kosarstat({ sources: { ...POINT_SOURCES, home: { ...POINT_SOURCES.home, secondChancePoints: 14 } } });
  const merged = mergeKosarstatPostgameContext(report(SHOT_MAP), context);
  assert.ok(merged.strengths.includes('Második esély: ORB% különbség +7.4 pp, második esélyből 14–10 pont.'), merged.strengths.join('\n'));
  assert.ok(!merged.dataNotes.some(item => item.startsWith(NOTE_PREFIX)));
});

test('A szezonhoz mért OREB-visszaesés nem „második esély” címkéjű', () => {
  // Szezon OREB% 50,0%, a meccs 38,5% → −11,5 pp.
  const season = seasonOf('ase', {
    pointsFor: 98, pointsAgainst: 80, fga2: 40, fgm2: 24, fga3: 24, fgm3: 9, fta: 22, ftm: 18,
    oreb: 14, dreb: 22, ast: 20, tov: 12, oppDreb: 14, oppPossessions: 76,
  });
  const result = analyzePostGameReport(ASE_GAME, SOPRON_GAME, season, buildTeamBenchmarks([season, ...LEAGUE_TEAMS.slice(1)]), PLAYERS);
  assert.ok(result.problems.includes('Támadólepattanózás a szezonátlag alatt (OREB% -11.5 százalékpont)'), result.problems.join('\n'));
  assert.ok(result.decisiveFactors.offense.includes('Támadólepattanózás a szezonátlag alatt (OREB%) (-11.5 pp)'));
  assert.ok(![...result.problems, ...result.decisiveFactors.offense].some(item => /második esély/i.test(item)));
});

test('Védekezés DRtg liga medián nélkül: Oliver-súlyozott négy faktor, a nagy eFG-hátrány dönt', () => {
  // Kapott pont nélküli szezonsorok: a liga DRtg medián nem képezhető.
  const benchmarks = buildTeamBenchmarks(LEAGUE_TEAMS.map(team => ({ ...team, pointsAgainst: 0 })));
  // Ellenfél eFG 81,3% (+28,8 pp), de a kikényszerített TO rate +7,2 pp jobb a ligánál.
  const hot = { ...SOPRON_GAME, fgm2: 26, fgm3: 13, pointsFor: 95 };
  const result = analyzePostGameReport({ ...ASE_GAME, pointsAgainst: 95, actualPointsAgainst: 95 }, hot, ASE_SEASON, benchmarks, PLAYERS);
  assert.equal(result.context.defense?.leagueDrtg, null);
  assert.equal(result.context.defenseEfficiencyDelta, 'Lower');
  assert.match(
    result.summary,
    /védekezésben a liga szintjénél gyengébb volt \(DRtg 126\.1 \(liga medián nem elérhető\); súlyozott négy faktor \(Oliver: eFG 40%, TO 25%, OREB 20%, FT 15%\): -11\.6 pp a liga mediánhoz képest; mögötte: dobásvédekezés/
  );

  // Csak a kisebb súlyú faktorok gyengébbek, a dobásvédekezés jó: a súlyozás „jobb”-at ad.
  const cold = { ...SOPRON_GAME, fgm2: 12, fgm3: 5, pointsFor: 60 };
  const good = analyzePostGameReport({ ...ASE_GAME, pointsAgainst: 60, actualPointsAgainst: 60 }, cold, ASE_SEASON, benchmarks, PLAYERS);
  assert.equal(good.context.defenseEfficiencyDelta, 'Higher');
});

test('Realizáció: a rate-különbség pp-ben, nem %-ban', () => {
  const result = analyzePostGameReport(ASE_GAME, SOPRON_GAME, ASE_SEASON, buildTeamBenchmarks(LEAGUE_TEAMS), PLAYERS, {
    primaryKey: 'turnover', secondaryKey: 'paint',
  });
  const lines = result.summary.split('\n').filter(line => /TO-rate|2P arány/.test(line));
  assert.equal(lines.length, 2, result.summary);
  lines.forEach(line => {
    assert.doesNotMatch(line, /\([+-]?\d+(\.\d+)?%\)/, line);
    assert.match(line, /\([+-]\d+(\.\d+)? pp\)/, line);
  });
});

test('Kerekítés: a szöveg és a kulcsmutató-tábla ugyanazt a pp-különbséget mutatja', () => {
  const result = report(SHOT_MAP);
  const round1 = (value: number) => Math.round(value * 10) / 10;
  result.metrics.keyStats.forEach(stat => {
    assert.equal(stat.delta, round1(stat.game - stat.season), stat.key);
  });
  // „vs liga medián X%, ±Y pp”: Y a kiírt értékek különbsége.
  const leagueLines = [...result.strengths, ...result.problems].filter(item => /vs liga medián/.test(item));
  assert.ok(leagueLines.length > 0);
  leagueLines.forEach(line => {
    const match = /(\d+\.\d)% vs liga medián (\d+\.\d)%, ([+-]\d+(?:\.\d)?) pp/.exec(line);
    if (!match) return;
    assert.equal(Number(match[3]), round1(Number(match[1]) - Number(match[2])), line);
  });
});
