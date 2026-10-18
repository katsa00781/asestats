// H19 – a harmadik hibalista szabályai a valós ASE–Honvéd 112–81 adatokon.
import {
  analyzePostGameReport,
  buildKosarstatPostgameContext,
  buildPostgameAutoFocus,
  mergeKosarstatPostgameContext,
  parsePostgameSummary,
} from '../lib/postgame-report';
import { postgameReportToMd } from '../lib/export-to-md';
import { ASE_GAME, ASE_SEASON, BENCHMARKS, HONVED_GAME, PLAYERS, SEASON_SHOTS, report } from './fixtures/postgame-ase-honved';
import { SEASON, seasonOf, shots } from './fixtures/postgame-ase-sopron';
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
  // Magas triplaarány, átlagos gyűrű-arány (37,3% vs szezon 34,3%): a saját FTM rate nem probléma.
  assert.ok(!result.problems.some(item => item.includes('FTM rate a liga alatt') || item.startsWith('Alacsony FTM rate')), result.problems.join('\n'));
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

test('Dobástérkép 3P-besorolás: a térkép 14/31 vs box 18/36 – legalább 2 hármas (2 jó) kétpontosként, adatminőségi sor és MD-figyelmeztetés', () => {
  const result = report();
  assert.equal(result.shotMap?.coverage?.misclassifiedThrees, 2);
  assert.equal(result.shotMap?.coverage?.misclassifiedThreesMade, 2);
  const note = result.dataNotes.find(item => item.startsWith('Dobástérkép 3P-besorolás:'));
  assert.ok(note, result.dataNotes.join('\n'));
  assert.match(note, /legalább 2 hárompontos kísérlet \(ebből 2 értékesített\) kétpontosként/);
  assert.match(note, /3P a box score-ban 18\/36, a dobástérképen 14\/31; 2P a box score-ban 20\/42, a dobástérképen 22\/44/);
  // A valódi összevetés megmarad a riportban (a webes kártyák ezt mutatják).
  assert.ok(result.shotMap?.comparison);
  const md = postgameReportToMd(result, SEASON);
  assert.match(md, /> \*\*3P-besorolási eltérés:\*\* legalább 2 hárompontos kísérlet \(ebből 2 értékesített\)/);
});

test('Dobástérkép 3P-besorolás: torz zónáknál nincs középtáv / tripla / dobáshely-mix állítás, a valódi összevetés megmarad', () => {
  // Sok középtáv a térképen: a box score-ral egyező térképnél ez „túl magas középtávoli arány” problémát ad.
  const midHeavy = [...shots('rim', 30, 20), ...shots('paint', 10, 5), ...shots('mid', 20, 14), ...shots('three', 25, 11)];
  const shotMap = { gameShots: midHeavy, seasonShots: SEASON_SHOTS };
  const matchingBox = { ...ASE_GAME, fga2: 60, fgm2: 39, fga3: 25, fgm3: 11 };
  const control = analyzePostGameReport(matchingBox, HONVED_GAME, ASE_SEASON, BENCHMARKS, PLAYERS, undefined, shotMap);
  assert.equal(control.shotMap?.coverage?.misclassifiedThrees, undefined);
  assert.ok(control.problems.some(item => item.startsWith('Dobástérkép: túl magas középtávoli arány')), control.problems.join('\n'));

  // A box score szerint 11-gyel több hármas és 18-cal kevesebb kétpontos volt: a térkép torz.
  const distorted = analyzePostGameReport(ASE_GAME, HONVED_GAME, ASE_SEASON, BENCHMARKS, PLAYERS, undefined, shotMap);
  assert.equal(distorted.shotMap?.coverage?.misclassifiedThrees, 11);
  assert.ok(!distorted.problems.some(item => item.startsWith('Dobástérkép:')), distorted.problems.join('\n'));
  assert.ok(!distorted.strengths.some(item => item.startsWith('Dobásszelekció') || item.startsWith('Dobástérkép:')));
  // A riport a valódi zóna-összevetést őrzi; csak a szabályok nem ítélnek belőle.
  assert.ok((distorted.shotMap?.comparison?.midRateDelta ?? 0) >= 6);
});

test('Mi döntötte el: a pontkülönbség volumen- és hatékonyság-bontása pontosan kiadja a +31-et', () => {
  const result = report();
  const breakdown = result.metrics.marginBreakdown;
  assert.ok(breakdown);
  assert.equal(breakdown.ownChances, 87.2);
  assert.equal(breakdown.opponentChances, 69.6);
  assert.equal(breakdown.ownPointsPerChance, 1.28);
  assert.equal(breakdown.opponentPointsPerChance, 1.16);
  assert.equal(breakdown.volume, 20.6);
  assert.equal(breakdown.efficiency, 10.4);
  assert.equal(round1(breakdown.volume + breakdown.efficiency), result.metrics.margin);
  assert.match(result.summary, /• Mi döntötte el \(becslés\): volumen \+20\.6 pont \(87\.2 vs 69\.6 pontot hozó befejezés; OREB% 42\.5% vs 13\.8%, labdavesztés 11–11\); hatékonyság \+10\.4 pont \(1\.28 vs 1\.16 pont \/ befejezés\)\. Elsősorban a volumen döntött\./);

  const md = postgameReportToMd(result, SEASON);
  assert.match(md, /## Mi döntötte el\? \(becslés\)/);
  assert.match(md, /\| Pontot hozó befejezés \(FGA \+ 0,44·FTA\) \| 87\.2 \| 69\.6 \| volumen \+20[.,]6 pont \|/);
});

test('Mi döntötte el: vereségnél negatív komponensek, összegük a pontkülönbség', () => {
  // A Honvéd szemszöge: ugyanaz a meccs, fordított előjelekkel.
  const result = analyzePostGameReport(HONVED_GAME, ASE_GAME, ASE_SEASON, BENCHMARKS, []);
  const breakdown = result.metrics.marginBreakdown;
  assert.ok(breakdown);
  assert.ok(breakdown.volume < 0 && breakdown.efficiency < 0, JSON.stringify(breakdown));
  assert.equal(round1(breakdown.volume + breakdown.efficiency), -31);
});

const round1 = (value: number) => Math.round(value * 10) / 10;

test('Büntetők: magas triplaarány mellett is probléma, ha a gyűrű-arány a szezon felett van (sok gyűrűtámadás, kevés büntető)', () => {
  // Gyűrű 40/75 = 53,3% a szezon 34,3%-ával szemben.
  const rimHeavy = [...shots('rim', 40, 22), ...shots('paint', 4, 2), ...shots('three', 31, 14)];
  const result = report({ gameShots: rimHeavy, seasonShots: SEASON_SHOTS });
  assert.ok(result.problems.some(item => item.startsWith('FTM rate a liga alatt')), result.problems.join('\n'));
});

test('Ellenfél profil: az 1 pp alatti romlás is kisebb elmaradás, nem „szintjén vagy felette”', () => {
  // A TO rate 1 pp-nél kevesebbet romlik: a Kulcs mutatók ▼-et ad, a profil sem hallgathatja el.
  const season = seasonOf('ase', {
    pointsFor: 105, pointsAgainst: 84, fga2: 38, fgm2: 22, fga3: 30, fgm3: 12, fta: 22, ftm: 15,
    oreb: 12, dreb: 24, ast: 24, tov: 9.5, oppDreb: 22, oppPossessions: 76,
  });
  const result = analyzePostGameReport(ASE_GAME, HONVED_GAME, season, BENCHMARKS, PLAYERS);
  const toStat = result.metrics.keyStats.find(stat => stat.key === 'turnover_rate');
  assert.ok(toStat && toStat.delta > 0 && toStat.delta < 1, JSON.stringify(toStat));
  assert.doesNotMatch(result.summary, /szintjén vagy felette volt/);
  assert.match(result.summary, /kisebb elmaradás a szezonátlagtól: .*TO rate \d+\.\d% vs szezonátlag \d+\.\d% \(\+0\.\d pp\)/);
});

test('Erősségek: a második esély pontforrás-fölénye és az ORB%-különbség egy sor', () => {
  const context = buildKosarstatPostgameContext({
    ownSide: 'home',
    teamName: 'Atomerőmű SE',
    quarterStats: [],
    teamMetrics: [
      { team_side: 'home', team_name: 'Atomerőmű SE', poss: 81.2, ortg: 137.9, efg: 60.3, tov_pct: 13.5, orb_pct: 42.5, ftm_rate: 0.231 },
      { team_side: 'away', team_name: 'Endo Plus Service-Honvéd', poss: 76.6, ortg: 105.8, efg: 52.5, tov_pct: 14.4, orb_pct: 13.8, ftm_rate: 0.322 },
    ],
    pointSources: {
      home: { points: 112, secondChancePoints: 17, pointsOffTurnovers: 14, quickFinishPoints: 12 },
      away: { points: 81, secondChancePoints: 2, pointsOffTurnovers: 12, quickFinishPoints: 9 },
      quickFinishSeconds: 6,
    },
    expectedPoints: { own: 112, opponent: 81 },
  });
  const merged = mergeKosarstatPostgameContext(report(), context);
  const pointLine = merged.strengths.find(item => item.startsWith('Pontforrás-fölény'));
  assert.ok(pointLine, merged.strengths.join('\n'));
  assert.match(pointLine, /második esélyből 17–2 \(\+15\) pont; a második esély forrása: .*ORB% különbség \+28\.7 pp/);
  assert.ok(!merged.strengths.some(item => item.startsWith('Második esély: ORB%')), merged.strengths.join('\n'));
  assert.ok(!merged.strengths.some(item => item.startsWith('Támadólepattanózás erős')), merged.strengths.join('\n'));
});

test('On/off ellentmondás: pozitív címke, de pályán ≥ 25 ponttal rosszabb – figyelmeztetés a címke mellett', () => {
  const base = report();
  const halmai = base.playerReport.players.find(player => player.name === 'HALMAI Dániel');
  assert.equal(halmai?.impactLabel, 'Stabil alappillér (padról)');
  const merged = mergeKosarstatPostgameContext(base, buildKosarstatPostgameContext(null), {
    onOff: [
      { player: 'HALMAI Dániel', onSeconds: 1200, onDiff: -1, offDiff: 32 },
      { player: 'GÉRINGER Gergő', onSeconds: 960, onDiff: 0, offDiff: 31 },
      // Nincs ellentmondás: pályán is erős.
      { player: 'CHANDLER III. John Watson', onSeconds: 1020, onDiff: 20, offDiff: 11 },
      // Rövid minta és nem pozitív címke: nem jelez.
      { player: 'NAGY Dániel', onSeconds: 180, onDiff: -5, offDiff: 36 },
      { player: 'BENKE Szilárd', onSeconds: 1440, onDiff: -2, offDiff: 33 },
    ],
  });
  const warnings = merged.lineupSummary?.onOffWarnings ?? [];
  assert.equal(warnings.length, 2, warnings.join('\n'));
  assert.equal(warnings[0], 'HALMAI Dániel („Stabil alappillér (padról)”, „Pozitív hatás”): pályán -1 (20:00), nélküle +32');
  assert.match(warnings[1], /^GÉRINGER Gergő \(„Stabil alappillér \(padról\)”\): pályán 0 \(16:00\), nélküle \+31$/);
  // A címke nem változik, a figyelmeztetés az összefoglaló játékos-szakaszában van.
  assert.equal(merged.playerReport.players.find(player => player.name === 'HALMAI Dániel')?.impactLabel, 'Stabil alappillér (padról)');
  assert.match(merged.summary, /• On\/off ellentmondás \(Kosarstat lineup\): HALMAI Dániel/);
});

test('Kezdő ötös vs többi perc: a sor az összefoglaló meccs-szakaszába kerül', () => {
  const line = '• Kezdő ötös vs többi perc (Kosarstat lineup): a kezdő ötös 8:30 alatt 30–10 (+20, Net/40 +94.1); a többi perc 31:30 alatt 82–71 (+11, Net/40 +14.0).';
  const merged = mergeKosarstatPostgameContext(report(), buildKosarstatPostgameContext(null), { starterSplit: line });
  const sections = parsePostgameSummary(merged.summary);
  const overview = sections.find(section => section.key === 'overview');
  assert.ok(overview, merged.summary);
  assert.ok(merged.summary.includes(line));
  assert.ok(merged.summary.indexOf(line) < merged.summary.indexOf('**Játékos kiemelések**'));
});
