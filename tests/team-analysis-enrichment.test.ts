// H34/F2d: a Csapat nézet elemzés-kiegészítése (`lib/team-analysis-enrichment.ts`): forma-,
// clutch-, dobástérkép-, lineup- és impact-profil, összefoglaló és akció-fókusz. A lineup-esetek
// a valós Atomerőmű SE – Sopron KC (2026-10-10) Kosarstat lineup-oldalával.
import type { PlayerStats } from '../lib/dashboard-types';
import type { PostgamePbpContext } from '../lib/kosarstat-clutch-context';
import { parseKosarstatLineupAnalysis } from '../lib/kosarstat-lineup-analysis';
import { buildEnrichedTeamAnalysis, type EnrichedTeamAnalysisInputs } from '../lib/team-analysis-enrichment';
import type { ShotProfileSummary } from '../lib/shot-profile';
import type { TeamAnalysis } from '../lib/team-analysis';
import { LINEUP_TABLES } from './fixtures/kosarstat-ase-sopron-lineup';
import assert from 'node:assert/strict';
import { test } from 'node:test';

// A kiegészítés a bemeneti elemzésből csak a csapatnevet és az összefoglalót olvassa.
const BASE_ANALYSIS = { teamName: 'Atomerőmű SE', summary: 'Alap.' } as unknown as TeamAnalysis;
const ASE_LINEUP = parseKosarstatLineupAnalysis(LINEUP_TABLES, 'g1', 'Atomerőmű SE', 'home')?.selectedTeam ?? null;

const inputs = (overrides: Partial<EnrichedTeamAnalysisInputs> = {}): EnrichedTeamAnalysisInputs => ({
  displayTeamAnalysis: BASE_ANALYSIS,
  allPlayers: [],
  resolvedSeasonId: 's1',
  resolvedTeamId: 'ase',
  seasonKosarstatLineupTeam: null,
  activeKosarstatTeamAnalysis: null,
  seasonKosarstatLineupGames: 0,
  seasonKosarstatClutch: null,
  seasonKosarstatClutchGames: 0,
  kosarstatPostgameContext: { clutch: null },
  teamFormSummary: null,
  teamSeasonShotSummary: null,
  teamLeagueRelativeZoneRows: [],
  scheduleStrengthByTeamKey: new Map(),
  ...overrides,
});

const CLUTCH_SAMPLE_NOTE = 'Clutch minta alacsony: végjáték protokollok stabilizálása (ATO, első passz, fault-management).';

test('csapat-kiegészítés: bemeneti elemzés nélkül nincs', () => {
  assert.equal(buildEnrichedTeamAnalysis(inputs({ displayTeamAnalysis: null })), null);
});

test('csapat-kiegészítés adat nélkül: minden profil „nem elérhető”, a jegyzetek a hiányt jelzik', () => {
  const result = buildEnrichedTeamAnalysis(inputs());
  assert.ok(result);
  assert.equal(result.teamName, 'Atomerőmű SE');
  assert.equal(result.formProfile?.available, false);
  assert.equal(result.clutchProfile?.available, false);
  assert.deepEqual(result.clutchProfile?.notes, [
    'Nincs elegendő Kosarstat clutch minta a szezonprofilhoz.',
    'Végjáték-protokollt proxy alapon érdemes kezelni (ATO, első passz, fault-management).',
  ]);
  assert.equal(result.shotMapProfile?.available, false);
  assert.deepEqual(result.shotMapProfile?.notes, ['Nincs szezon shot map adat.']);
  assert.equal(result.lineupProfile?.available, false);
  assert.deepEqual(result.lineupProfile?.notes, ['Nincs elegendő lineup minta a döntéstámogatáshoz.']);
  assert.equal(result.impactProfile?.available, false);
  assert.equal(result.impactProfile?.adjustedNetPer40, null);
  assert.equal(
    result.summary,
    'Alap. Clutch-kiegészítés: a végjáték minta alacsony, ezért a protokollok stabilizálása fontosabb, mint a visszaolvasott clutch számok. Nincs szezon shot map adat.'
  );
  assert.deepEqual(result.actionableFocus, [CLUTCH_SAMPLE_NOTE]);
});

test('csapat-kiegészítés: formaprofil a volatilitási sávokkal, forma-stabilizálási fókusz 60 felett', () => {
  const result = buildEnrichedTeamAnalysis(inputs({
    teamFormSummary: {
      badgeLabel: 'Javuló forma', marginAvg: 8.4, seasonMargin: 3.1, efgStd: 4.2, tsStd: 3.9, tovStdPct: 2.5, volatilityIndex: 65,
    },
  }));
  assert.ok(result);
  assert.equal(result.formProfile?.volatilityLabel, 'Erősen ingadozó');
  assert.deepEqual(result.formProfile?.notes, [
    'Javuló forma: margin +8.4 a szezon +3.1 értékéhez képest.',
    'Volatilitás 65.0/100, eFG szórás 4.2, TS szórás 3.9, TO szórás 2.5 pp.',
  ]);
  assert.match(result.summary, /Forma-kiegészítés: Javuló forma, erősen ingadozó profillal\./);
  assert.ok(result.actionableFocus?.includes('Forma-stabilizálás: a magas volatilitás (65.0/100) miatt kell egy biztosabb B-terv félpályán.'));
});

test('csapat-kiegészítés: clutch a szezonos blokkból, ennek hiányában a meccs clutch-blokkjából', () => {
  const clutch = {
    available: true, sampleSize: 900, sampleLabel: '15:00', ownPoints: 30, oppPoints: 25, diff: 5,
    ownTurnovers: 3, oppTurnovers: 5, ortg: 112, drtg: 98, net: 14, tovPct: 10, rebPct: 52, ftRate: 30,
    assistToTurnover: 1.5, topUsageClosers: [{ player: 'BENKE Szilárd', usageShare: 31 }],
  } satisfies PostgamePbpContext['clutch'];

  const seasonal = buildEnrichedTeamAnalysis(inputs({ seasonKosarstatClutch: clutch, seasonKosarstatClutchGames: 6 }));
  assert.equal(seasonal?.clutchProfile?.net, 14);
  assert.deepEqual(seasonal?.clutchProfile?.notes, [
    'Kosarstat clutch stat blokkból számolva (15:00, 6 meccs).',
    'Lezáró profil a clutch usage-share alapján.',
  ]);
  assert.ok(seasonal?.actionableFocus?.includes('Clutch fókusz: utolsó 5 percben TO kontroll (3-5) és első opciós spacing.'));

  const fromGame = buildEnrichedTeamAnalysis(inputs({ kosarstatPostgameContext: { clutch } }));
  assert.equal(fromGame?.clutchProfile?.available, true);
  assert.equal(fromGame?.clutchProfile?.notes[0], 'Kosarstat clutch stat blokkból számolva (15:00).');
});

test('csapat-kiegészítés: dobástérkép-profil, minőségindex és zóna-jegyzetek a liga-eltérésből', () => {
  const zone = (attempts: number, pct: number) => ({ attempts, made: Math.round((attempts * pct) / 100), pct });
  const summary: ShotProfileSummary = {
    attempts: 100,
    made: 45,
    fgPct: 45,
    zoneStats: { rim: zone(30, 60), paint: zone(20, 40), mid: zone(10, 35), corner3: zone(15, 40), aboveBreak3: zone(25, 32) },
  };
  const result = buildEnrichedTeamAnalysis(inputs({
    teamSeasonShotSummary: summary,
    teamLeagueRelativeZoneRows: [
      { label: 'Gyűrű', rateDelta: -2, pctDelta: 5 },
      { label: 'Középtáv', rateDelta: 3, pctDelta: -4 },
    ],
  }));
  const profile = result?.shotMapProfile;
  assert.ok(profile);
  assert.equal(profile.available, true);
  // 60·0,32 + 40·0,25 + 32·0,18 − 35·0,12 = 30,76
  assert.equal(profile.offenseQualityIndex, 30.8);
  assert.deepEqual(profile.zones[0], {
    key: 'rim', label: 'Gyűrű', rate: 30, pct: 60, rateDeltaVsLeague: -2, pctDeltaVsLeague: 5, rateDeltaVsSeason: 0, pctDeltaVsSeason: 0,
  });
  assert.deepEqual(profile.notes, [
    'Gyűrű: kiemelt hatékonysági zóna (+5.0 pp liga felett).',
    'Gyűrű: jó minőségű, de alulhasznált zóna; volumen emelhető.',
    'Középtáv: a volumen magasabb, mint amit a hatékonyság indokol.',
  ]);
  // az összefoglalóba az első, a fókuszba a második jegyzet kerül
  assert.match(result?.summary ?? '', /Gyűrű: kiemelt hatékonysági zóna/);
  assert.ok(result?.actionableFocus?.includes('Gyűrű: jó minőségű, de alulhasznált zóna; volumen emelhető.'));
});

test('csapat-kiegészítés Kosarstat lineuppal: top / bottom ötös (≥3 perc), rotációs töréspont, SOS-súly', () => {
  const result = buildEnrichedTeamAnalysis(inputs({
    seasonKosarstatLineupTeam: ASE_LINEUP,
    seasonKosarstatLineupGames: 1,
    scheduleStrengthByTeamKey: new Map([['atomeromu se', { combined: 1 }]]),
  }));
  const lineup = result?.lineupProfile;
  assert.ok(lineup);
  assert.equal(lineup.available, true);
  assert.deepEqual(lineup.topLineup, {
    players: ['Yasiin JOSEPH', 'Jay Jay CHANDLER', 'BENKE Szilárd', 'RÉVÉSZ Ádám', 'Kalif YOUNG'],
    minutes: 11, netPer40: 43.5, sampleLabel: 'kozepes',
  });
  assert.deepEqual(lineup.bottomLineup?.netPer40, -50.3);
  assert.equal(lineup.bottomLineup?.sampleLabel, 'alacsony');
  // a két egymást követő ötös között a legnagyobb (+139,5 → −142,9) net/40 esés
  assert.deepEqual(lineup.rotationBreakpoint, {
    minute: 24.1, trigger: 'be: KRIVACSEVICS Markó | ki: RÉVÉSZ Ádám', netDropPer40: 282.4, confidence: 'alacsony',
  });
  assert.deepEqual(lineup.notes, ['Lineup alapú döntéstámogatás aktív (Kosarstat stints + pair stats, 1 meccs).']);

  const impact = result?.impactProfile;
  assert.equal(impact?.sosWeight, 1.08);
  assert.equal(impact?.bestNetPer40, 43.5);
  assert.equal(impact?.worstNetPer40, -50.3);
  assert.equal(impact?.sampleMinutes, 33.3);
  assert.equal(result?.actionableFocus?.[0], 'Rotációs töréspont kezelése: ~24.1. perc, be: KRIVACSEVICS Markó | ki: RÉVÉSZ Ádám után -282.4 net/40.');
});

test('csapat-kiegészítés: a lineup-minta a csapat aktív szezonkeretére szűkül', () => {
  assert.ok(ASE_LINEUP);
  const names = Array.from(new Set(ASE_LINEUP.stints.flatMap(stint => stint.players))).filter(name => name !== 'MERKL Barna');
  const allPlayers = names.map((name, index) => ({
    id: `p${index}`, name, seasonId: 's1', teamId: 'ase', isActive: true,
  }) as unknown as PlayerStats);
  const result = buildEnrichedTeamAnalysis(inputs({ seasonKosarstatLineupTeam: ASE_LINEUP, allPlayers }));
  const lineup = result?.lineupProfile;
  assert.ok(lineup?.topPair && lineup.bottomPair);
  // a keretben nem szereplő játékos ötösei és párosai kiesnek
  assert.ok(!lineup.topPair.players.includes('MERKL Barna'));
  assert.ok(!lineup.bottomPair.players.includes('MERKL Barna'));
  assert.ok(!(lineup.rotationBreakpoint?.trigger ?? '').includes('MERKL'));
});
