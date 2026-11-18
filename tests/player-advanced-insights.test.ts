// H34/F2e: a Játékos nézet haladó blokkjai (`lib/player-advanced-insights.ts`) kézzel számolt,
// egyforma meccsekből álló mintán: szezon-arányok összegből, döntésminőség, stabilitás, szerepkör,
// dobásminőség a dobástérképből, lineup on/off a lefedettségi küszöbbel, verdiktek.
import type { PlayerStats } from '../lib/dashboard-types';
import type { KosarstatTeamLineupAnalysis } from '../lib/kosarstat-lineup-analysis';
import type { PlayerAnalysis } from '../lib/player-analysis';
import {
  IMPACT_MIN_COVERAGE,
  ROLE_MIN_GAMES_FOR_VERDICT,
  buildPlayerAdvancedInsights,
  type PlayerAdvancedInsightsInputs,
} from '../lib/player-advanced-insights';
import type { GamePlayerStatRow } from '../lib/season-comparison-helpers';
import type { ShotProfileSummary } from '../lib/shot-profile';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const PLAYER = { id: 'p1', name: 'TESZT Elek', teamId: 't1' } as unknown as PlayerStats;
// a haladó blokkok az elemzésből csak a pozíciót olvassák (pozíciós küszöbök)
const ANALYSIS_PG = { position: 'PG' } as unknown as PlayerAnalysis;

// Egy meccs: 10 FGA (közeli 2/4, közép 1/2, tripla 2/4), FT 4/5, 16 pont, 6 AST, 2 TO, 25 perc.
// Használat: 10 + 0,44·5 + 2 = 14,2; a csapattárs 42 → használati arány 25,3% (ball-handler).
const playerRow = (index: number, minutes = 25): GamePlayerStatRow => ({
  id: `r${index}`, player_id: 'p1', game_id: `g${index}`, minutes, points: 16,
  close_attempted: 4, close_made: 2, mid_attempted: 2, mid_made: 1, three_attempted: 4, three_made: 2,
  free_throw_attempted: 5, free_throw_made: 4, assists: 6, turnovers: 2, valuation: 18,
  games: { date: `2026-10-${String(1 + index * 4).padStart(2, '0')}`, opponent: `Ellenfél ${index}` },
  players: { name: 'TESZT Elek', team_id: 't1' } as GamePlayerStatRow['players'],
});
const mateRow = (index: number): GamePlayerStatRow => ({
  id: `m${index}`, player_id: 'p2', game_id: `g${index}`, close_attempted: 30, turnovers: 12,
  players: { name: 'TÁRS Tamás', team_id: 't1' } as GamePlayerStatRow['players'],
});

const inputs = (gameCount: number, overrides: Partial<PlayerAdvancedInsightsInputs> = {}): PlayerAdvancedInsightsInputs => {
  const rows = Array.from({ length: gameCount }, (_, index) => playerRow(index));
  return {
    selectedPlayer: PLAYER,
    analysis: ANALYSIS_PG,
    selectedPlayerRows: rows,
    games: [],
    playerGameStats: [...rows, ...rows.map((_, index) => mateRow(index))],
    opponentQualityByTeamKey: new Map(),
    playerSeasonShotSummary: null,
    leagueSeasonShotSummary: null,
    seasonKosarstatParsedClutchGames: [],
    seasonKosarstatLineupTeam: null,
    activeKosarstatTeamAnalysis: null,
    activeSeasonPlayers: [PLAYER],
    ...overrides,
  };
};

test('haladó blokkok: kiválasztott játékos vagy elemzés nélkül nincs', () => {
  assert.equal(buildPlayerAdvancedInsights(inputs(6, { selectedPlayer: null })), null);
  assert.equal(buildPlayerAdvancedInsights(inputs(6, { analysis: null })), null);
});

test('haladó blokkok: szezon-arányok összegből, döntésminőség, stabilitás és szerepkör egyforma meccseken', () => {
  const result = buildPlayerAdvancedInsights(inputs(6));
  assert.ok(result);
  // TS = 16 / (2·(10 + 0,44·5)) = 65,57%; PPP = 16 / 14,2; TO% = 2 / 14,2
  assert.deepEqual(result.season, { tsPct: 65.6, ppp: 1.127, tovPct: 14.1 });
  // 55 + 3·8 − 14,1·1,3 − 20·0,15 = 57,67 → stabil, a PG küszöbök (64 / 52) között
  assert.equal(result.decisionQuality.score, 57.7);
  assert.equal(result.decisionQuality.tier, 'stabil');
  assert.equal(result.blockVerdicts.decision.tone, 'neutral');
  // egyforma meccsek: nincs szórás → a stabilitás „good” (PG: ≤ 18)
  assert.equal(result.stability.volatility, 0);
  assert.equal(result.stability.rollingPoints, 2);
  assert.equal(result.blockVerdicts.stability.tone, 'good');
  // minden meccs ball-handler (25,3% ≥ 24%): a legjobb szerepkör-TS = szezon-TS → semleges
  assert.equal(result.roleEfficiency.ballHandlerSample, 6);
  assert.equal(result.roleEfficiency.ballHandlerTs, 65.6);
  assert.equal(result.blockVerdicts.role.tone, 'neutral');
  // 30+ perces meccs nincs: a terhelés-blokk nem ítél
  assert.equal(result.fatigueLoad.highLoadGames, 0);
  assert.equal(result.blockVerdicts.fatigue.tone, 'na');
  assert.equal(result.fatigueLoad.note, 'Nincs érdemi 30+ perces minta, ezért a terhelési blokk korlátozottan értelmezhető.');
  assert.equal(result.matchupSensitivity.available, false);
  assert.deepEqual(result.coachingFocus, []);
});

test('haladó blokkok: kis mintán a szerepkör, a clutch és a lineup verdikt nélkül marad', () => {
  const result = buildPlayerAdvancedInsights(inputs(ROLE_MIN_GAMES_FOR_VERDICT - 1));
  assert.ok(result);
  assert.equal(result.blockVerdicts.role.tone, 'na');
  assert.equal(result.blockVerdicts.role.text, `Kevés adat: egyik szerepkör-csoportban sincs legalább ${ROLE_MIN_GAMES_FOR_VERDICT} meccs – verdikt nélkül.`);
  assert.equal(result.blockVerdicts.clutch.tone, 'na');
  assert.equal(result.blockVerdicts.clutch.text, 'Kevés adat: 0 clutch meccs – verdikt legalább 3 meccstől.');
  assert.equal(result.blockVerdicts.impact.tone, 'na');
  assert.equal(result.blockVerdicts.impact.text, 'Verdikt nélkül: a lineup-adat a játszott percek 0%-át fedi (legalább 80% kell).');
});

test('haladó blokkok: dobásminőség a dobástérkép és a liga zóna-%-a alapján', () => {
  const zones = (rimAttempts: number, rimPct: number) => ({
    rim: { attempts: rimAttempts, made: Math.round((rimAttempts * rimPct) / 100), pct: rimPct },
    paint: { attempts: 0, made: 0, pct: 0 },
    mid: { attempts: 0, made: 0, pct: 0 },
    corner3: { attempts: 0, made: 0, pct: 0 },
    aboveBreak3: { attempts: 0, made: 0, pct: 0 },
  });
  const player: ShotProfileSummary = { attempts: 10, made: 7, fgPct: 70, zoneStats: zones(10, 70) };
  const league: ShotProfileSummary = { attempts: 1000, made: 600, fgPct: 60, zoneStats: zones(1000, 60) };
  const result = buildPlayerAdvancedInsights(inputs(6, { playerSeasonShotSummary: player, leagueSeasonShotSummary: league }));
  const shot = result?.shotQualityVsMaking;
  assert.ok(shot?.available);
  // várt: 10·0,6·2 = 12 pont / 20 → 60%; tényleges: 14 / 20 → 70%
  assert.equal(shot.expectedEfg, 60);
  assert.equal(shot.actualEfg, 70);
  assert.equal(shot.valueAdd, 10);
  assert.equal(shot.interpretation, 'jobb mint varhato');
  assert.match(shot.note ?? '', /elit befejező profilra/);
  assert.deepEqual(shot.zoneAdds[0], { label: 'Gyűrű', delta: 20 });
  // a térkép 10 kísérlete a box score 60-ához mérve
  assert.deepEqual(shot.coverage, { mapAttempts: 10, mapMade: 7, boxAttempts: 60, boxMade: 30, pct: 17 });
  assert.equal(result?.blockVerdicts.shot.tone, 'good');
});

test('haladó blokkok: lineup on/off – verdikt csak a játszott percek legalább 80%-os lefedettségénél', () => {
  const lineup = (onSeconds: number) => ({
    teamName: 'Teszt', starters: [], playerMinutes: [], playerTimelines: [], substitutions: [],
    rotationSource: 'events', rotationIssues: [],
    stints: [
      { players: ['TESZT Elek', 'A', 'B', 'C', 'D'], minutesLabel: '', seconds: onSeconds, teamPts: 0, oppPts: 0, plusMinus: 0, on40: 10 },
      { players: ['E', 'A', 'B', 'C', 'D'], minutesLabel: '', seconds: 600, teamPts: 0, oppPts: 0, plusMinus: 0, on40: -10 },
    ],
    pairStats: [],
    trioStats: [],
  } satisfies KosarstatTeamLineupAnalysis);

  // 6 meccs × 2 perc = 12 játszott perc; a lineupban 12 perc pályán → 100%
  const rows = Array.from({ length: 6 }, (_, index) => playerRow(index, 2));
  const covered = buildPlayerAdvancedInsights(inputs(6, { selectedPlayerRows: rows, seasonKosarstatLineupTeam: lineup(720) }));
  assert.equal(covered?.plusMinusContext.coveragePct, 100);
  assert.equal(covered?.plusMinusContext.delta, 20);
  assert.equal(covered?.blockVerdicts.impact.tone, 'good');

  // 6 perc pályán a 12-ből → 50% < 80%: nincs verdikt
  const partial = buildPlayerAdvancedInsights(inputs(6, { selectedPlayerRows: rows, seasonKosarstatLineupTeam: lineup(360) }));
  assert.equal(partial?.plusMinusContext.coveragePct, 50);
  assert.ok(50 < IMPACT_MIN_COVERAGE * 100);
  assert.equal(partial?.blockVerdicts.impact.tone, 'na');
});
