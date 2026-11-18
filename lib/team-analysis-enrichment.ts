// A csapatelemzés kiegészítése a Csapat nézethez: forma- (volatilitás), clutch-, dobástérkép-,
// lineup- (top / bottom ötös és páros, rotációs töréspont) és impact-profil (SOS-súlyozott net/40),
// bővített összefoglaló és akció-fókuszok, a szezonos Kosarstat lineup / clutch adatból.
// A SeasonComparison-ből kiszervezve (H34/F2d), viselkedésváltozás nélkül. Nem @core modul;
// a @core `lib/team-analysis.ts` változatlan.
import type { PlayerStats } from '@/lib/dashboard-types';
import type { PostgamePbpContext } from '@/lib/kosarstat-clutch-context';
import type { KosarstatTeamLineupAnalysis } from '@/lib/kosarstat-lineup-analysis';
import type { KosarstatPostgameContext } from '@/lib/postgame-report';
import {
  average,
  buildNormalizedNameProfile,
  matchesNormalizedNameProfile,
  normalizeTeamKey,
  roundValue,
} from '@/lib/season-comparison-helpers';
import type { ShotProfileSummary } from '@/lib/shot-profile';
import type { TeamAnalysis } from '@/lib/team-analysis';

/** A csapatforma-összesítő (Csapat nézet) itt használt mezői. */
export type TeamFormSummaryInput = {
  badgeLabel: string;
  marginAvg: number;
  seasonMargin: number;
  efgStd: number;
  tsStd: number;
  tovStdPct: number;
  volatilityIndex: number;
};

export type EnrichedTeamAnalysisInputs = {
  displayTeamAnalysis: TeamAnalysis | null;
  allPlayers: PlayerStats[];
  resolvedSeasonId: string;
  resolvedTeamId: string;
  /** Szezonos Kosarstat lineup-összesítés; ha nincs, a kiválasztott meccs lineupja a tartalék. */
  seasonKosarstatLineupTeam: KosarstatTeamLineupAnalysis | null;
  activeKosarstatTeamAnalysis: KosarstatTeamLineupAnalysis | null;
  seasonKosarstatLineupGames: number;
  /** Szezonos Kosarstat clutch; ha nincs, a kiválasztott meccs clutch-blokkja a tartalék. */
  seasonKosarstatClutch: PostgamePbpContext['clutch'] | null;
  seasonKosarstatClutchGames: number;
  kosarstatPostgameContext: Pick<KosarstatPostgameContext<PostgamePbpContext['clutch']>, 'clutch'>;
  teamFormSummary: TeamFormSummaryInput | null;
  teamSeasonShotSummary: ShotProfileSummary | null;
  teamLeagueRelativeZoneRows: Array<{ label: string; rateDelta: number; pctDelta: number }>;
  scheduleStrengthByTeamKey: Map<string, { combined: number }>;
};

export const buildEnrichedTeamAnalysis = ({
  displayTeamAnalysis,
  allPlayers,
  resolvedSeasonId,
  resolvedTeamId,
  seasonKosarstatLineupTeam,
  activeKosarstatTeamAnalysis,
  seasonKosarstatLineupGames,
  seasonKosarstatClutch,
  seasonKosarstatClutchGames,
  kosarstatPostgameContext,
  teamFormSummary,
  teamSeasonShotSummary,
  teamLeagueRelativeZoneRows,
  scheduleStrengthByTeamKey,
}: EnrichedTeamAnalysisInputs): TeamAnalysis | null => {
  if (!displayTeamAnalysis) return null;

  const sampleLabel = (minutes: number): 'alacsony' | 'kozepes' | 'magas' => {
    if (minutes >= 20) return 'magas';
    if (minutes >= 10) return 'kozepes';
    return 'alacsony';
  };

  const activeSelectedTeamPlayerProfiles = allPlayers
    .filter(player => String(player.seasonId ?? '') === String(resolvedSeasonId))
    .filter(player => player.isActive !== false)
    .filter(player => String(player.teamId ?? '') === String(resolvedTeamId))
    .map(player => buildNormalizedNameProfile(player.name || ''))
    .filter(profile => Boolean(profile.key));

  const lineupSupportSource = seasonKosarstatLineupTeam ?? activeKosarstatTeamAnalysis;
  const stints = (lineupSupportSource?.stints ?? []).filter(stint => {
    if (activeSelectedTeamPlayerProfiles.length === 0) return true;
    return (stint.players ?? []).every(player => matchesNormalizedNameProfile(player, activeSelectedTeamPlayerProfiles));
  });
  const pairStats = (lineupSupportSource?.pairStats ?? []).filter(item => {
    if (activeSelectedTeamPlayerProfiles.length === 0) return true;
    return (item.players ?? []).every(player => matchesNormalizedNameProfile(player, activeSelectedTeamPlayerProfiles));
  });

  const validStints = stints
    .map(stint => ({
      ...stint,
      minutes: roundValue((stint.seconds || 0) / 60, 1),
      netPer40: Number.isFinite(Number(stint.on40)) ? Number(stint.on40) : null,
    }))
    .filter(stint => (stint.seconds || 0) >= 90 && stint.netPer40 !== null);

  const lineupRankingStints = validStints.filter(stint => (stint.seconds || 0) >= 180);

  const sortedStints = [...lineupRankingStints].sort((a, b) => Number(b.netPer40) - Number(a.netPer40));
  const topLineupRaw = sortedStints[0] ?? null;
  const bottomLineupRaw = sortedStints.length > 1 ? sortedStints[sortedStints.length - 1] : null;

  const validPairs = pairStats
    .map(item => ({
      ...item,
      minutes: roundValue((item.seconds || 0) / 60, 1),
    }))
    .filter(item => (item.seconds || 0) >= 90 && Number.isFinite(Number(item.netPer40)));

  const topPairRaw = [...validPairs].sort((a, b) => Number(b.netPer40) - Number(a.netPer40))[0] ?? null;
  const bottomPairRaw = [...validPairs].sort((a, b) => Number(a.netPer40) - Number(b.netPer40))[0] ?? null;

  let cumulativeSeconds = 0;
  let rotationBreakpoint: {
    minute: number | null;
    trigger: string;
    netDropPer40: number;
    confidence: 'alacsony' | 'kozepes' | 'magas';
  } | null = null;

  for (let i = 1; i < validStints.length; i += 1) {
    const prev = validStints[i - 1];
    const curr = validStints[i];
    cumulativeSeconds += prev.seconds || 0;
    if (prev.netPer40 === null || curr.netPer40 === null) continue;
    const drop = Number(prev.netPer40) - Number(curr.netPer40);
    if (drop < 8) continue;

    const prevPlayers = new Set(prev.players || []);
    const currPlayers = new Set(curr.players || []);
    const left = Array.from(prevPlayers).filter(player => !currPlayers.has(player));
    const entered = Array.from(currPlayers).filter(player => !prevPlayers.has(player));
    const trigger = entered.length > 0 || left.length > 0
      ? `be: ${entered.join(', ') || '-'} | ki: ${left.join(', ') || '-'}`
      : 'ötösváltás';
    const sampleMinutes = roundValue(((prev.seconds || 0) + (curr.seconds || 0)) / 60, 1);
    const confidence: 'alacsony' | 'kozepes' | 'magas' = sampleMinutes >= 14 ? 'magas' : sampleMinutes >= 8 ? 'kozepes' : 'alacsony';

    if (!rotationBreakpoint || drop > rotationBreakpoint.netDropPer40) {
      rotationBreakpoint = {
        minute: roundValue(cumulativeSeconds / 60, 1),
        trigger,
        netDropPer40: roundValue(drop, 1),
        confidence,
      };
    }
  }

  const clutch = seasonKosarstatClutch ?? kosarstatPostgameContext.clutch;

  const clutchProfile: NonNullable<TeamAnalysis['clutchProfile']> = {
    available: Boolean(clutch?.available),
    sampleSize: clutch?.sampleSize ?? 0,
    sampleLabel: clutch?.sampleLabel ?? null,
    ortg: clutch?.ortg ?? null,
    drtg: clutch?.drtg ?? null,
    net: clutch?.net ?? null,
    tovPct: clutch?.tovPct ?? null,
    rebPct: clutch?.rebPct ?? null,
    ftRate: clutch?.ftRate ?? null,
    topUsageClosers: clutch?.topUsageClosers ?? [],
    assistToTurnover: clutch?.assistToTurnover ?? null,
    notes: clutch?.available
      ? [
          `Kosarstat clutch stat blokkból számolva (${clutch.sampleLabel}${seasonKosarstatClutchGames > 0 ? `, ${seasonKosarstatClutchGames} meccs` : ''}).`,
          'Lezáró profil a clutch usage-share alapján.'
        ]
      : [
          'Nincs elegendő Kosarstat clutch minta a szezonprofilhoz.',
          teamFormSummary && Math.abs(teamFormSummary.marginAvg) >= 10
            ? 'Az utóbbi minta nagy különbségű meccseket jelez, ezért kevés a valódi végjáték-szituáció.'
            : 'Végjáték-protokollt proxy alapon érdemes kezelni (ATO, első passz, fault-management).'
        ],
  };

  const shotMapZones = teamSeasonShotSummary
    ? ([
        { key: 'rim', label: 'Gyűrű' },
        { key: 'paint', label: 'Festék' },
        { key: 'mid', label: 'Középtáv' },
        { key: 'corner3', label: 'Sarok tripla' },
        { key: 'aboveBreak3', label: 'Egyéb tripla' },
      ] as const).map(zone => {
        const total = Math.max(1, teamSeasonShotSummary.attempts);
        const zoneStats = teamSeasonShotSummary.zoneStats[zone.key];
        const relative = teamLeagueRelativeZoneRows.find(row => row.label === zone.label);
        return {
          key: zone.key,
          label: zone.label,
          rate: roundValue((zoneStats.attempts / total) * 100, 1),
          pct: roundValue(zoneStats.pct, 1),
          rateDeltaVsLeague: relative?.rateDelta ?? 0,
          pctDeltaVsLeague: relative?.pctDelta ?? 0,
          rateDeltaVsSeason: 0,
          pctDeltaVsSeason: 0,
        };
      })
    : [];

  const shotMapNotes = (() => {
    if (shotMapZones.length === 0) return ['Nincs szezon shot map adat.'];
    const notes: string[] = [];
    const bestEfficiency = [...shotMapZones].sort((a, b) => b.pctDeltaVsLeague - a.pctDeltaVsLeague)[0];
    const underusedPositive = shotMapZones.find(zone => zone.pctDeltaVsLeague >= 2 && zone.rate >= 6 && zone.rateDeltaVsLeague <= -1.5);
    const overusedWeak = shotMapZones.find(zone => zone.rate >= 6 && zone.rateDeltaVsLeague >= 1.5 && zone.pctDeltaVsLeague <= -2);

    if (bestEfficiency && bestEfficiency.pctDeltaVsLeague >= 2) {
      notes.push(`${bestEfficiency.label}: kiemelt hatékonysági zóna (${bestEfficiency.pctDeltaVsLeague >= 0 ? '+' : ''}${bestEfficiency.pctDeltaVsLeague.toFixed(1)} pp liga felett).`);
    }
    if (underusedPositive) {
      notes.push(`${underusedPositive.label}: jó minőségű, de alulhasznált zóna; volumen emelhető.`);
    }
    if (overusedWeak) {
      notes.push(`${overusedWeak.label}: a volumen magasabb, mint amit a hatékonyság indokol.`);
    }
    if (notes.length === 0) {
      notes.push('A shot profile kiegyensúlyozott, nincs extrém túlhúzott vagy alulhasznált zóna.');
    }
    return notes;
  })();

  const shotMapProfile: NonNullable<TeamAnalysis['shotMapProfile']> = {
    available: Boolean(teamSeasonShotSummary),
    zones: shotMapZones,
    offenseQualityIndex: teamSeasonShotSummary
      ? roundValue(
          teamSeasonShotSummary.zoneStats.rim.pct * 0.32
          + teamSeasonShotSummary.zoneStats.corner3.pct * 0.25
          + teamSeasonShotSummary.zoneStats.aboveBreak3.pct * 0.18
          - teamSeasonShotSummary.zoneStats.mid.pct * 0.12,
          1
        )
      : null,
    allowedQualityIndex: null,
    notes: shotMapNotes,
  };

  const formProfile: NonNullable<TeamAnalysis['formProfile']> = teamFormSummary
    ? {
        available: true,
        trendLabel: teamFormSummary.badgeLabel,
        volatilityIndex: teamFormSummary.volatilityIndex,
        volatilityLabel: teamFormSummary.volatilityIndex >= 80
          ? 'Extrém volatilis'
          : teamFormSummary.volatilityIndex >= 60
            ? 'Erősen ingadozó'
            : teamFormSummary.volatilityIndex >= 35
              ? 'Mérsékelten ingadozó'
              : 'Stabilabb profil',
        notes: [
          `${teamFormSummary.badgeLabel}: margin ${teamFormSummary.marginAvg >= 0 ? '+' : ''}${teamFormSummary.marginAvg.toFixed(1)} a szezon ${teamFormSummary.seasonMargin >= 0 ? '+' : ''}${teamFormSummary.seasonMargin.toFixed(1)} értékéhez képest.`,
          `Volatilitás ${teamFormSummary.volatilityIndex.toFixed(1)}/100, eFG szórás ${teamFormSummary.efgStd.toFixed(1)}, TS szórás ${teamFormSummary.tsStd.toFixed(1)}, TO szórás ${teamFormSummary.tovStdPct.toFixed(1)} pp.`,
        ],
      }
    : {
        available: false,
        trendLabel: 'Nincs formaadat',
        volatilityIndex: null,
        volatilityLabel: null,
        notes: ['Nincs elegendő forma minta.'],
      };

  const enrichedSummary = [
    displayTeamAnalysis.summary,
    formProfile.available && formProfile.volatilityLabel
      ? `Forma-kiegészítés: ${formProfile.trendLabel}, ${formProfile.volatilityLabel.toLowerCase()} profillal.`
      : null,
    !clutchProfile.available
      ? 'Clutch-kiegészítés: a végjáték minta alacsony, ezért a protokollok stabilizálása fontosabb, mint a visszaolvasott clutch számok.'
      : null,
    shotMapProfile.notes[0] ?? null,
  ].filter((item): item is string => Boolean(item)).join(' ');

  const avgNetPer40 = validStints.length > 0
    ? average(validStints.map(item => Number(item.netPer40 || 0)))
    : null;

  const selectedTeamKey = normalizeTeamKey(displayTeamAnalysis.teamName);
  const scheduleStrength = selectedTeamKey
    ? scheduleStrengthByTeamKey.get(selectedTeamKey) ?? null
    : null;
  const sosWeight = scheduleStrength !== null ? roundValue(1 + scheduleStrength.combined * 0.08, 3) : null;

  const impactProfile: NonNullable<TeamAnalysis['impactProfile']> = {
    available: validStints.length > 0,
    bestNetPer40: topLineupRaw?.netPer40 !== null && topLineupRaw?.netPer40 !== undefined ? roundValue(Number(topLineupRaw.netPer40), 1) : null,
    worstNetPer40: bottomLineupRaw?.netPer40 !== null && bottomLineupRaw?.netPer40 !== undefined ? roundValue(Number(bottomLineupRaw.netPer40), 1) : null,
    adjustedNetPer40: avgNetPer40 !== null
      ? roundValue(avgNetPer40 * (sosWeight ?? 1), 1)
      : null,
    sosWeight,
    garbageTimeFiltered: true,
    sampleMinutes: roundValue(validStints.reduce((sum, item) => sum + item.minutes, 0), 1),
    notes: [
      'Possession-normalizált net/40 alkalmazva.',
      'Egyszerű SOS súly beépítve (schedule-strength alapján).',
      'Alacsony játékidejű stintek kiszűrve.'
    ],
  };

  const actionableFocus = [
    rotationBreakpoint
      ? `Rotációs töréspont kezelése: ~${rotationBreakpoint.minute ?? 0}. perc, ${rotationBreakpoint.trigger} után -${rotationBreakpoint.netDropPer40} net/40.`
      : null,
    topPairRaw && bottomPairRaw
      ? `Páros menedzsment: ${topPairRaw.players.join(' + ')} (${roundValue(Number(topPairRaw.netPer40), 1)} net/40) priorizálása, ${bottomPairRaw.players.join(' + ')} limitálása.`
      : null,
    clutch?.available
      ? `Clutch fókusz: utolsó 5 percben TO kontroll (${clutch.ownTurnovers}-${clutch.oppTurnovers}) és első opciós spacing.`
      : 'Clutch minta alacsony: végjáték protokollok stabilizálása (ATO, első passz, fault-management).',
    formProfile.available && formProfile.volatilityIndex !== null && formProfile.volatilityIndex >= 60
      ? `Forma-stabilizálás: a magas volatilitás (${formProfile.volatilityIndex.toFixed(1)}/100) miatt kell egy biztosabb B-terv félpályán.`
      : null,
    shotMapNotes[1] ?? null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  return {
    ...displayTeamAnalysis,
    summary: enrichedSummary,
    formProfile,
    clutchProfile,
    shotMapProfile,
    lineupProfile: {
      available: validStints.length > 0,
      topLineup: topLineupRaw
        ? {
            players: topLineupRaw.players,
            minutes: topLineupRaw.minutes,
            netPer40: roundValue(Number(topLineupRaw.netPer40), 1),
            sampleLabel: sampleLabel(topLineupRaw.minutes),
          }
        : null,
      bottomLineup: bottomLineupRaw
        ? {
            players: bottomLineupRaw.players,
            minutes: bottomLineupRaw.minutes,
            netPer40: roundValue(Number(bottomLineupRaw.netPer40), 1),
            sampleLabel: sampleLabel(bottomLineupRaw.minutes),
          }
        : null,
      topPair: topPairRaw
        ? {
            players: topPairRaw.players,
            minutes: topPairRaw.minutes,
            netPer40: roundValue(Number(topPairRaw.netPer40), 1),
            sampleLabel: sampleLabel(topPairRaw.minutes),
          }
        : null,
      bottomPair: bottomPairRaw
        ? {
            players: bottomPairRaw.players,
            minutes: bottomPairRaw.minutes,
            netPer40: roundValue(Number(bottomPairRaw.netPer40), 1),
            sampleLabel: sampleLabel(bottomPairRaw.minutes),
          }
        : null,
      rotationBreakpoint,
      notes: validStints.length > 0
          ? [`Lineup alapú döntéstámogatás aktív (Kosarstat stints + pair stats${seasonKosarstatLineupGames > 0 ? `, ${seasonKosarstatLineupGames} meccs` : ''}).`]
        : ['Nincs elegendő lineup minta a döntéstámogatáshoz.'],
    },
    impactProfile,
    actionableFocus,
  };
};
