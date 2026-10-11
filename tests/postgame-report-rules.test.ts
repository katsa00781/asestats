import {
  analyzePostGameReport,
  buildKosarstatPostgameContext,
  buildPostgameAutoFocus,
  buildTeamBenchmarks,
  composePostgameSummary,
  mergeKosarstatPostgameContext,
} from '../lib/postgame-report';
import { postgameReportToMd } from '../lib/export-to-md';
import {
  ASE_GAME,
  ASE_SEASON,
  BENCHMARKS,
  GAME_SHOTS,
  PLAYERS,
  POINT_SOURCES,
  SEASON,
  SEASON_SHOTS,
  SHOT_MAP,
  SOPRON_GAME,
  kosarstat,
  report,
  seasonOf,
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
  // A box score 3P 14/30, a dobástérkép 13/29: a hiányzó dobás egy bement hármas.
  assert.deepEqual(result.shotMap?.coverage, {
    shotMapAttempts: 63, boxAttempts: 64, missing: 1, missingDetail: '1 értékesített hárompontos',
  });
  const note = result.dataNotes.find(item => item.startsWith('Dobástérkép lefedettség'));
  assert.ok(note, result.dataNotes.join('\n'));
  assert.match(note, /63 dobás a box score 64 mezőnykísérletéből \(1 hiányzik\)/);
  assert.match(note, /57\.1%.*57\.8% \(37\/64\)/);
  assert.match(note, /a hiányzó dobás: 1 értékesített hárompontos \(3P a box score-ban 14\/30, a dobástérképen 13\/29/);
  // Zóna-besorolási eltérésnél (a térkép több kétpontost mutat) nincs állítás a hiányzó dobásról.
  const shifted = report({ gameShots: [...shots('rim', 26, 18), ...shots('paint', 4, 2), ...shots('mid', 5, 3), ...shots('three', 28, 13)], seasonShots: SEASON_SHOTS });
  assert.equal(shifted.shotMap?.coverage?.missing, 1);
  assert.equal(shifted.shotMap?.coverage?.missingDetail, undefined);

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
  // A „tartsd fenn” fókusz helyére a javítandó lép – mindkét oldalra.
  assert.ok(base.nextFocus.some(item => item.startsWith('OREB agresszivitás fenntartása')));
  assert.ok(!merged.nextFocus.some(item => item.startsWith('OREB agresszivitás fenntartása')));
  const focus = merged.nextFocus.filter(item => /második esélyek pontra váltása/i.test(item));
  assert.equal(focus.length, 1);
  assert.match(focus[0], /^Védőlepattanó zárás és második esélyek pontra váltása: boxout .*az ellenfél 9 támadólepattanóból 10 pontot szerzett.*10 támadólepattanóból 7 pont/);
});

test('A második esély diagnózisa: elsősorban védőlepattanó-gond, ha az ellenfél a liga felett lepattanózott', () => {
  const merged = mergeKosarstatPostgameContext(report(SHOT_MAP), kosarstat());
  const problem = merged.problems.find(item => item.startsWith('Támadólepattanó-fölény nem vált pontra'));
  assert.ok(problem);
  // Ellenfél: 9 támadólepattanóból 10 pont (1,11), OREB% 31,0% a liga medián felett; saját: 10-ből 7 (0,70).
  assert.match(problem, /második esélyből 7–10 pont\. Elsősorban védőlepattanó-gond: az ellenfél 9 támadólepattanóból 10 pontot szerzett \(1\.11 pont\/OREB\), OREB%-a 31\.0% a liga medián \(\d+\.\d%\) felett; a saját oldalon 10 támadólepattanóból 7 pont lett \(0\.70 pont\/OREB\)\./);

  // Ha az ellenfél a liga medián alatt lepattanózott, a saját befejezés a fő ok.
  const weakOpponent = { ...SOPRON_GAME, oreb: 4 };
  const base = analyzePostGameReport(ASE_GAME, weakOpponent, ASE_SEASON, BENCHMARKS, PLAYERS, undefined, SHOT_MAP);
  const context = kosarstat({ sources: { ...POINT_SOURCES, away: { ...POINT_SOURCES.away, secondChancePoints: 8 } } });
  const other = mergeKosarstatPostgameContext(base, context);
  const line = other.problems.find(item => item.startsWith('Támadólepattanó-fölény nem vált pontra'));
  assert.match(line ?? '', /Elsősorban a saját befejezésen múlt: a saját oldalon 10 támadólepattanóból 7 pont lett/);
  assert.ok(other.nextFocus.some(item => item.startsWith('Második esélyek pontra váltása:')));
});

test('Pontforrás-különbség ≥ 10 pont: döntő tényező és erősség (labdaeladásból, gyors befejezés)', () => {
  // A valós eseménylistából: labdaeladásból 32–16, gyors befejezésből 19–4, második esélyből 7–10.
  const sources = {
    home: { points: 109, secondChancePoints: 7, pointsOffTurnovers: 32, quickFinishPoints: 19 },
    away: { points: 80, secondChancePoints: 10, pointsOffTurnovers: 16, quickFinishPoints: 4 },
    quickFinishSeconds: 6,
  };
  const base = report(SHOT_MAP);
  const merged = mergeKosarstatPostgameContext(base, kosarstat({ sources }));
  assert.deepEqual(merged.decisiveFactors.offense.slice(0, 2), [
    'Labdaeladásból szerzett pont: 32–16 (+16)',
    'Gyors befejezésből szerzett pont (≤ 6 mp): 19–4 (+15)',
  ]);
  const meta = merged.decisiveFactorMeta.slice(0, 2);
  assert.deepEqual(meta.map(item => [item.type, item.axis, item.tone, item.source]), [
    ['Kontroll', 'offense', 'positive', 'opponent'],
    ['Hatékonyság', 'offense', 'positive', 'opponent'],
  ]);
  // A második esély −3 pontja a küszöb alatt van.
  assert.ok(!merged.decisiveFactors.offense.some(item => item.startsWith('Második esélyből')));
  assert.equal(merged.decisiveFactorMeta.length, base.decisiveFactorMeta.length + 2);
  assert.equal(merged.strengths[0], 'Pontforrás-fölény: labdaeladásból 32–16 (+16), gyors befejezésből 19–4 (+15) pont.');
  // Az összefoglaló „Kulcsmomentumok” sora már ezekkel indul.
  assert.match(merged.summary, /Kulcsmomentumok: Labdaeladásból szerzett pont: 32–16 \(\+16\); Gyors befejezésből/);

  // Hátránynál a tényező negatív, és a problémák közé kerül.
  const reversed = mergeKosarstatPostgameContext(base, kosarstat({
    sources: { ...sources, home: { ...sources.home, pointsOffTurnovers: 6 } },
  }));
  const factor = reversed.decisiveFactorMeta.find(item => item.label.startsWith('Labdaeladásból'));
  assert.equal(factor?.label, 'Labdaeladásból szerzett pont: 6–16 (-10)');
  assert.equal(factor?.tone, 'negative');
  assert.ok(reversed.problems.includes('Pontforrás-hátrány: labdaeladásból 6–16 (-10) pont.'));
  // Érvénytelen eseménylistánál (pontösszeg ≠ végeredmény) nincs pontforrás-tényező.
  const broken = mergeKosarstatPostgameContext(base, kosarstat({ sources: { ...sources, home: { ...sources.home, points: 100 } } }));
  assert.ok(!broken.decisiveFactors.offense.some(item => item.startsWith('Labdaeladásból')));
});

test('Erősségek átfedés nélkül: egy eFG-sor, a félidős trend nem ismétli a negyedet', () => {
  const quarter = (side: 'home' | 'away', q: number, points: number) => ({ team_side: side, team_name: side, quarter: q, points, cumulative_points: null });
  const quarters = (home: number[], away: number[]) => [
    ...home.map((points, index) => quarter('home', index + 1, points)),
    ...away.map((points, index) => quarter('away', index + 1, points)),
  ];
  const context = (home: number[], away: number[]) => buildKosarstatPostgameContext({
    ownSide: 'home', quarterStats: quarters(home, away),
    teamMetrics: [
      { team_side: 'home', efg: 68.75, orb_pct: 30 }, { team_side: 'away', efg: 54.46, orb_pct: 30 },
    ],
  });

  // A meccs: +5 / +10 / +13 / +1 – a második félidő (+14) nem jobb az elsőnél (+15).
  const game = context([32, 29, 23, 25], [27, 19, 10, 24]);
  assert.ok(game.strengths.includes('Negyed-szintű trend: a Q3 szakaszt +13 ponttal nyertük.'));
  assert.ok(!game.strengths.some(item => item.startsWith('Második félidős trend')), game.strengths.join('\n'));
  // Fordítás a szünet után: −6 / −4, majd +7 / +8 – a félidős sor új információ.
  const turnaround = context([15, 16, 25, 26], [21, 20, 18, 18]);
  assert.ok(turnaround.strengths.includes('Második félidős trend: Q3-Q4 összesítésben +15 pontot nyertünk (első félidő: -10).'));
  // Egyetlen negyed adja a második félidőt (Q3 +12, Q4 0): a negyed-sor elég.
  const single = context([20, 20, 30, 20], [22, 22, 18, 20]);
  assert.ok(!single.strengths.some(item => item.startsWith('Második félidős trend')));

  const merged = mergeKosarstatPostgameContext(report(SHOT_MAP), game);
  assert.equal(merged.strengths.filter(item => /eFG|Dobáshatékonyság/.test(item)).length, 1);
  assert.ok(merged.strengths.includes('Dobáshatékonyság a szezonátlag felett (+10.2 százalékpont; az ellenfélhez mérve +14.3 pp)'));
});

test('„A liga felett” csak érdemi (≥ 2 pp) eltérésnél, számokkal', () => {
  // A liga Assist%-a 86,0% körül szór. A szezon a meccsel azonos, így a
  // szezon-delta sorok nem szorítják ki a liga-sort (az erősségek 3 elemre vágnak).
  const teams = [0.85, 0.855, 0.86, 0.862, 0.87, 0.9].map((rate, index) => seasonOf(`t${index}`, { fgm2: 20, fgm3: 8, ast: 28 * rate }));
  const benchmarks = buildTeamBenchmarks([ASE_SEASON, ...teams]);
  const gameWith = (ast: number) => {
    const season = seasonOf('ase', {
      pointsFor: 109, pointsAgainst: 80, fga2: 34, fgm2: 23, fga3: 30, fgm3: 14, fta: 25, ftm: 21,
      oreb: 10, dreb: 20, ast, tov: 10, oppDreb: 16, oppPossessions: 76,
    });
    return analyzePostGameReport({ ...ASE_GAME, ast }, SOPRON_GAME, season, benchmarks, PLAYERS);
  };

  // +0,5 pp a liga medián felett: a percentilis szerint „felette” volna, de zaj.
  const noise = gameWith(32);
  const assist = noise.metrics.keyStats.find(stat => stat.key === 'assist_rate');
  assert.equal(assist?.game, 86.5);
  assert.equal(assist?.leagueMedian, 86);
  assert.ok(!noise.strengths.some(item => item.startsWith('Labdajáratás a liga felett')), noise.strengths.join('\n'));
  // A sor a zaj-szűrő nélkül megjelent volna: a többi liga-sor ott van.
  assert.ok(noise.strengths.some(item => item.startsWith('Dobáshatékonyság a liga felett (eFG 68.8% vs liga medián')), noise.strengths.join('\n'));

  // Érdemi különbségnél a sor a számokat is kiírja.
  const clear = gameWith(36);
  assert.ok(
    clear.strengths.includes('Labdajáratás a liga felett (Assist% 97.3% vs liga medián 86.0%, +11.3 pp)'),
    clear.strengths.join('\n')
  );
});

test('Védekezés: a verdikt a DRtg-t és a kikényszerített TO-t is nézi, a negatív tényező a problémák közt is szerepel', () => {
  const result = report(SHOT_MAP);
  const defense = result.context.defense;
  assert.ok(defense);
  // Ellenfél eFG 54,5% a liga medián körül, de a kikényszerített TO rate 22,4% jóval a medián felett.
  assert.equal(defense.opponentTurnoverRate, 22.4);
  assert.ok((defense.leagueTurnoverRate ?? 0) < 19.4);
  assert.equal(defense.drtg, 106.2);
  assert.equal(result.context.defenseEfficiencyDelta, 'Higher');
  assert.match(result.summary, /védekezésben a liga szintjénél jobb volt \(DRtg 106\.2 vs liga medián \d+\.\d; ellenfél eFG 54\.5% vs liga medián \d+\.\d%, [+-]\d+\.\d pp; kikényszerített TO rate 22\.4% vs liga medián \d+\.\d%, \+\d+\.\d pp\)/);

  // A periméter-kockázat döntő tényező és fókusz – és a Problémák között is ott van.
  assert.ok(result.decisiveFactors.defense.some(item => item.startsWith('Periméter-kockázat')));
  assert.ok(result.problems.some(item => item.startsWith('Védekezés: Periméter-kockázat (ellenfél 3P 9/23')), result.problems.join('\n'));
  // A védekezési sor nem indít saját támadó-fókuszt (pl. „Periméter fegyelem”).
  assert.ok(!result.nextFocus.some(item => item.startsWith('Periméter fegyelem')));
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
    label === 'Elsődleges motor' ? 3
      : label.startsWith('Stabil alappillér') ? 2
        : label.startsWith('Rotációs hozzájárulás') ? 1 : 0;
  for (const player of players) {
    // A „Hatékony szerepjátékos” szerepet jelöl, nem rangot (vezető vagy rotációs osztály).
    if (player.impactLabel === 'Hatékony szerepjátékos') {
      assert.ok(player.impactClass === 'mvp' || player.impactClass === 'support', player.name);
      continue;
    }
    assert.equal(labelRank(player.impactLabel), classRank[player.impactClass], `${player.name}: ${player.impactLabel}`);
  }
});

test('Címke és kiemelés nem mond ellent: Young hatékony szerepjátékos, nem „Limitált hatás”', () => {
  const result = report(SHOT_MAP);
  const young = result.playerReport.players.find(player => player.name === 'YOUNG Kalif Karl');
  assert.ok(young);
  // 25 perc, VAL 19 (VAL/36 27,4), TS 58%, usage 14,6% – az Impact score 38 alatt marad.
  assert.ok(young.impactScore < 38, String(young.impactScore));
  assert.equal(young.impactLabel, 'Hatékony szerepjátékos');
  assert.equal(young.impactClass, 'support');
  assert.ok(result.playerImpact.overperformers.includes('YOUNG Kalif Karl'));
  assert.ok(!result.playerReport.highlights.struggling.some(player => player.name === 'YOUNG Kalif Karl'));

  // Aki a játékostáblában „Limitált hatás”, az nem lehet „Kiugró teljesítmény”:
  // 20 perc, VAL 12 (VAL/36 21,6), TS 46%, magas usage → a kiemelés-szabály
  // átengedné, az Impact osztály viszont `struggling`.
  const players = PLAYERS.map(player => player.name === 'GÉRINGER Gergő'
    ? { ...player, minutes: 20, points: 10, fga2: 10, fgm2: 4, fga3: 0, fgm3: 0, fta: 2, ftm: 2, tov: 1, stl: 0, blk: 0, val: 12 }
    : player);
  const crafted = analyzePostGameReport(ASE_GAME, SOPRON_GAME, ASE_SEASON, BENCHMARKS, players);
  const geringer = crafted.playerReport.players.find(player => player.name === 'GÉRINGER Gergő');
  assert.equal(geringer?.impactClass, 'struggling');
  assert.ok(!crafted.playerImpact.overperformers.includes('GÉRINGER Gergő'), crafted.playerImpact.overperformers.join(', '));
  const classByName = new Map(crafted.playerReport.players.map(player => [player.name, player.impactClass]));
  for (const name of crafted.playerImpact.overperformers) assert.notEqual(classByName.get(name), 'struggling', name);
});

test('Az Összefoglalás ugyanabból az objektumból készül, mint a fő szekciók', () => {
  const context = kosarstat();
  const base = report(SHOT_MAP);
  const merged = mergeKosarstatPostgameContext(base, context);
  const focus = buildPostgameAutoFocus(merged, context);
  assert.equal(focus.length, 3);

  // A fókuszblokk a megjelenített listát hozza, nem az összefűzés előttit.
  const focusBlock = merged.summary.split('**Következő fókusz**')[1] ?? '';
  assert.deepEqual(focusBlock.trim().split('\n'), focus.map(item => `• ${item}`));
  assert.notEqual(merged.summary, base.summary);
  // Adatminőségi megjegyzés nincs az összefoglalóban (külön szakasz).
  assert.doesNotMatch(merged.summary, /Megjegyzés:|Dobástérkép lefedettség|Kosarstat negyedek/);
  assert.ok(merged.dataNotes.some(item => item.startsWith('Dobástérkép lefedettség')));

  // Az MD „Összefoglalás” és „Következő fókusz” szakasza ugyanazt a listát írja ki.
  const md = postgameReportToMd(merged, SEASON, undefined, { focus });
  const summary = md.split('## Összefoglalás')[1] ?? '';
  for (const item of focus) assert.ok(summary.includes(`• ${item}`), item);
  assert.equal(composePostgameSummary(merged, focus), merged.summary);
  // Régi riportobjektum (részek nélkül): a tárolt szöveg marad.
  assert.equal(composePostgameSummary({ ...merged, summaryParts: undefined, summary: 'régi' }), 'régi');
});

test('Az ellenfél-profil nem állítja, hogy egyik mutató sem esett a referencia alá, ha van elmaradás', () => {
  // OREB% 42,1% és TO rate 9,9% a szezonban: a meccs 38,5% (−3,6 pp), ill. 11,8% (+1,9 pp).
  const season = seasonOf('ase', {
    pointsFor: 98, pointsAgainst: 80, fga2: 40, fgm2: 24, fga3: 24, fgm3: 9, fta: 22, ftm: 18,
    oreb: 12.5, dreb: 22, ast: 20, tov: 8.1, oppDreb: 17.2, oppPossessions: 76,
  });
  const result = analyzePostGameReport(ASE_GAME, SOPRON_GAME, season, BENCHMARKS, PLAYERS);
  assert.doesNotMatch(result.summary, /sem esett a szezonátlag alá/);
  assert.match(result.summary, /érdemi visszaesés egyik fő saját támadómutatóban sem volt; kisebb elmaradás a szezonátlagtól:/);
  assert.match(result.summary, /TO rate 11\.8% vs szezonátlag 9\.9% \(\+1\.9 pp\)/);
  assert.match(result.summary, /OREB% 38\.5% vs szezonátlag 42\.1% \(-3\.6 pp\)/);

  // Ha minden fő mutató a referencia szintjén vagy felette van, azt mondja ki.
  const strong = seasonOf('ase', {
    pointsFor: 90, pointsAgainst: 80, fga2: 40, fgm2: 20, fga3: 24, fgm3: 7, fta: 22, ftm: 12,
    oreb: 9, dreb: 22, ast: 14, tov: 14, oppDreb: 22, oppPossessions: 76,
  });
  const clean = analyzePostGameReport(ASE_GAME, SOPRON_GAME, strong, BENCHMARKS, PLAYERS);
  assert.match(clean.summary, /minden fő saját támadómutatónk a szezonátlag szintjén vagy felette volt/);
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
