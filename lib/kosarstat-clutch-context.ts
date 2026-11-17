// Kosarstat clutch-tábla parser és szezonos aggregálás (csapat- és játékosszint),
// valamint a post-game PBP kontextus clutch része. A SeasonComparison-ből kiszervezve
// (H34/F1b), viselkedésváltozás nélkül. Nem @core modul.
import type { NormalizedNameProfile } from '@/lib/season-comparison-helpers';
import {
  formatSecondsAsMmSs,
  matchesNormalizedNameProfile,
  normalizeTeamKey,
  parseMmSsToSeconds,
  parseSignedNumber,
  roundValue,
} from '@/lib/season-comparison-helpers';

export type PostgamePbpContext = {
  clutch: {
    available: boolean;
    sampleSize: number;
    sampleLabel: string;
    ownPoints: number;
    oppPoints: number;
    diff: number;
    ownTurnovers: number;
    oppTurnovers: number;
    ortg: number | null;
    drtg: number | null;
    net: number | null;
    tovPct: number | null;
    rebPct: number | null;
    ftRate: number | null;
    assistToTurnover: number | null;
    topUsageClosers: Array<{ player: string; usageShare: number }>;
  };
  turnoverTypes: Array<{ type: string; count: number }>;
  ownTurnovers: number;
};

export type KosarstatClutchPlayerStat = {
  player: string;
  seconds: number;
  points: number;
  assists: number;
  turnovers: number;
  drb: number;
  orb: number;
  trb: number;
  ftMade: number;
  ftAtt: number;
  fgAtt: number;
  fga2: number;
  fga3: number;
  usageBase: number;
};

export type KosarstatClutchTeamTotals = {
  points: number;
  assists: number;
  turnovers: number;
  drb: number;
  orb: number;
  trb: number;
  ftMade: number;
  ftAtt: number;
  fgAtt: number;
  fga2: number;
  fga3: number;
  usageBase: number;
  seconds: number;
};

export type KosarstatClutchTeamSummary = {
  teamName: string;
  sampleSeconds: number;
  sampleLabel: string;
  totals: KosarstatClutchTeamTotals;
  possessions: number;
  ortg: number | null;
  tovPct: number | null;
  ftRate: number | null;
  players: KosarstatClutchPlayerStat[];
  topUsageClosers: Array<{ player: string; usageShare: number }>;
};

export type KosarstatParsedClutchGame = {
  ownTeam: KosarstatClutchTeamSummary;
  oppTeam: KosarstatClutchTeamSummary;
  clutch: PostgamePbpContext['clutch'];
};

export const normalizeKosarstatClutchHeader = (value: unknown) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\./g, '')
    .trim();

export const findKosarstatClutchHeaderIndex = (headers: string[], labels: string[]) => {
  const normalizedLabels = labels.map(label => normalizeKosarstatClutchHeader(label));
  return headers.findIndex(header => normalizedLabels.includes(normalizeKosarstatClutchHeader(header)));
};

export const parseKosarstatClutchBannerTeamName = (value: unknown) => {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.split('(')[0]?.trim() || text;
};

export const isKosarstatClutchPlayerStatsTable = (headers: string[]) => {
  const normalized = headers.map(header => normalizeKosarstatClutchHeader(header));
  return normalized.includes('jatekos') && normalized.includes('min') && normalized.includes('pts');
};

export const computeKosarstatClutchTopUsage = (players: KosarstatClutchPlayerStat[], totals: KosarstatClutchTeamTotals) => {
  return players
    .filter(player => player.seconds > 0)
    .map(player => ({
      player: player.player,
      usageShare: roundValue(
        totals.usageBase > 0
          ? player.usageBase / totals.usageBase
          : player.seconds / Math.max(1, totals.seconds),
        3
      ),
    }))
    .sort((a, b) => b.usageShare - a.usageShare)
    .slice(0, 3);
};

export const parseKosarstatClutchTeamTable = (teamName: string, table: { headers: string[]; rows: unknown[][] }): KosarstatClutchTeamSummary => {
  const idx = {
    player: findKosarstatClutchHeaderIndex(table.headers, ['Játékos']),
    min: findKosarstatClutchHeaderIndex(table.headers, ['MIN', 'Min']),
    pts: findKosarstatClutchHeaderIndex(table.headers, ['PTS']),
    ast: findKosarstatClutchHeaderIndex(table.headers, ['AST']),
    tov: findKosarstatClutchHeaderIndex(table.headers, ['TOV']),
    drb: findKosarstatClutchHeaderIndex(table.headers, ['DRB']),
    orb: findKosarstatClutchHeaderIndex(table.headers, ['ORB']),
    trb: findKosarstatClutchHeaderIndex(table.headers, ['TRB']),
    ftMade: findKosarstatClutchHeaderIndex(table.headers, ['FT made']),
    ftAtt: findKosarstatClutchHeaderIndex(table.headers, ['FT att.', 'FT att']),
    fgAtt: findKosarstatClutchHeaderIndex(table.headers, ['FG att.', 'FG att']),
    fga2: findKosarstatClutchHeaderIndex(table.headers, ['2P att.', '2P att']),
    fga3: findKosarstatClutchHeaderIndex(table.headers, ['3P att.', '3P att']),
  };

  const players: KosarstatClutchPlayerStat[] = [];

  table.rows.forEach(rawRow => {
    if (!Array.isArray(rawRow)) return;
    const offset = rawRow.length >= table.headers.length ? rawRow.length - table.headers.length : 0;
    const readCell = (index: number) => (index >= 0 ? rawRow[index + offset] : null);
    const player = String(readCell(idx.player) || '').trim();
    const minutesLabel = String(readCell(idx.min) || '').trim();
    const normalizedPlayer = normalizeKosarstatClutchHeader(player);
    if (!player || !minutesLabel || normalizedPlayer === 'jatekos' || normalizedPlayer.startsWith('ossz')) return;

    const seconds = parseMmSsToSeconds(minutesLabel);
    const points = parseSignedNumber(readCell(idx.pts)) ?? 0;
    const assists = parseSignedNumber(readCell(idx.ast)) ?? 0;
    const turnovers = parseSignedNumber(readCell(idx.tov)) ?? 0;
    const drb = parseSignedNumber(readCell(idx.drb)) ?? 0;
    const orb = parseSignedNumber(readCell(idx.orb)) ?? 0;
    const trb = parseSignedNumber(readCell(idx.trb)) ?? (drb + orb);
    const ftMade = parseSignedNumber(readCell(idx.ftMade)) ?? 0;
    const ftAtt = parseSignedNumber(readCell(idx.ftAtt)) ?? 0;
    const fgAtt = parseSignedNumber(readCell(idx.fgAtt)) ?? 0;
    const fga2 = parseSignedNumber(readCell(idx.fga2)) ?? 0;
    const fga3 = parseSignedNumber(readCell(idx.fga3)) ?? 0;
    const usageBase = fga2 + fga3 + 0.44 * ftAtt + turnovers;

    if (seconds <= 0 && usageBase <= 0 && points <= 0 && trb <= 0 && assists <= 0) return;

    players.push({
      player,
      seconds,
      points,
      assists,
      turnovers,
      drb,
      orb,
      trb,
      ftMade,
      ftAtt,
      fgAtt,
      fga2,
      fga3,
      usageBase,
    });
  });

  const totals = players.reduce<KosarstatClutchTeamTotals>(
    (acc, player) => ({
      points: acc.points + player.points,
      assists: acc.assists + player.assists,
      turnovers: acc.turnovers + player.turnovers,
      drb: acc.drb + player.drb,
      orb: acc.orb + player.orb,
      trb: acc.trb + player.trb,
      ftMade: acc.ftMade + player.ftMade,
      ftAtt: acc.ftAtt + player.ftAtt,
      fgAtt: acc.fgAtt + player.fgAtt,
      fga2: acc.fga2 + player.fga2,
      fga3: acc.fga3 + player.fga3,
      usageBase: acc.usageBase + player.usageBase,
      seconds: acc.seconds + player.seconds,
    }),
    { points: 0, assists: 0, turnovers: 0, drb: 0, orb: 0, trb: 0, ftMade: 0, ftAtt: 0, fgAtt: 0, fga2: 0, fga3: 0, usageBase: 0, seconds: 0 }
  );

  const sampleSeconds = Math.max(
    players.reduce((max, player) => Math.max(max, player.seconds), 0),
    Math.round(totals.seconds / 5)
  );
  const possessionsRaw = totals.fgAtt + 0.44 * totals.ftAtt + totals.turnovers - totals.orb;
  const possessions = possessionsRaw > 0 ? possessionsRaw : totals.fgAtt + 0.44 * totals.ftAtt + totals.turnovers;
  const ortg = possessions > 0 ? roundValue((totals.points / possessions) * 100, 1) : null;
  const tovPct = possessions > 0 ? roundValue((totals.turnovers / possessions) * 100, 1) : null;
  const ftRate = totals.fgAtt > 0 ? roundValue(totals.ftMade / totals.fgAtt, 3) : null;

  return {
    teamName,
    sampleSeconds,
    sampleLabel: formatSecondsAsMmSs(sampleSeconds),
    totals,
    possessions,
    ortg,
    tovPct,
    ftRate,
    players,
    topUsageClosers: computeKosarstatClutchTopUsage(players, totals),
  };
};

export const parseKosarstatClutchGame = (
  tables: Array<{ headers: string[]; rows: unknown[][]; sourceTableDomId: string | null }>,
  metadata: { homeTeamName?: string | null; awayTeamName?: string | null },
  ownSide: 'home' | 'away',
  selectedTeamName?: string
): KosarstatParsedClutchGame | null => {
  const parsedTeams = tables
    .map((table, index, allTables) => {
      if (!isKosarstatClutchPlayerStatsTable(table.headers)) return null;
      const bannerTable = index > 0 ? allTables[index - 1] : null;
      const firstBannerRow = bannerTable && Array.isArray(bannerTable.rows[0]) ? bannerTable.rows[0] : null;
      const teamName = parseKosarstatClutchBannerTeamName(firstBannerRow?.[0]);
      if (!teamName) return null;
      return parseKosarstatClutchTeamTable(teamName, table);
    })
    .filter((item): item is KosarstatClutchTeamSummary => Boolean(item));

  if (parsedTeams.length < 2) return null;

  const ownNameCandidates = [
    selectedTeamName,
    ownSide === 'home' ? metadata.homeTeamName : metadata.awayTeamName,
  ]
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .map(normalizeTeamKey);
  const oppNameCandidates = [ownSide === 'home' ? metadata.awayTeamName : metadata.homeTeamName]
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .map(normalizeTeamKey);

  const matchTeam = (candidates: KosarstatClutchTeamSummary[], needles: string[]) =>
    candidates.find(team => {
      const teamKey = normalizeTeamKey(team.teamName);
      return needles.some(needle => teamKey.includes(needle) || needle.includes(teamKey));
    }) || null;

  const ownTeam = matchTeam(parsedTeams, ownNameCandidates)
    || (ownSide === 'home' ? parsedTeams[0] : parsedTeams[1])
    || null;
  const oppTeam = matchTeam(parsedTeams.filter(team => team !== ownTeam), oppNameCandidates)
    || parsedTeams.find(team => team !== ownTeam)
    || null;

  if (!ownTeam || !oppTeam) return null;

  const rebPct = ownTeam.totals.orb + oppTeam.totals.drb > 0
    ? roundValue((ownTeam.totals.orb / (ownTeam.totals.orb + oppTeam.totals.drb)) * 100, 1)
    : null;
  const assistToTurnover = ownTeam.totals.turnovers > 0
    ? roundValue(ownTeam.totals.assists / ownTeam.totals.turnovers, 2)
    : null;
  const sampleSeconds = Math.max(ownTeam.sampleSeconds, oppTeam.sampleSeconds);

  return {
    ownTeam,
    oppTeam,
    clutch: {
      available: sampleSeconds >= 60,
      sampleSize: sampleSeconds,
      sampleLabel: formatSecondsAsMmSs(sampleSeconds),
      ownPoints: ownTeam.totals.points,
      oppPoints: oppTeam.totals.points,
      diff: ownTeam.totals.points - oppTeam.totals.points,
      ownTurnovers: ownTeam.totals.turnovers,
      oppTurnovers: oppTeam.totals.turnovers,
      ortg: ownTeam.ortg,
      drtg: oppTeam.ortg,
      net: ownTeam.ortg !== null && oppTeam.ortg !== null ? roundValue(ownTeam.ortg - oppTeam.ortg, 1) : null,
      tovPct: ownTeam.tovPct,
      rebPct,
      ftRate: ownTeam.ftRate,
      assistToTurnover,
      topUsageClosers: ownTeam.topUsageClosers,
    },
  };
};

export const buildAggregatedKosarstatClutchContext = (
  games: KosarstatParsedClutchGame[],
  activePlayerProfiles: NormalizedNameProfile[] = []
): PostgamePbpContext['clutch'] | null => {
  if (games.length === 0) return null;

  const ownTotals = games.reduce<KosarstatClutchTeamTotals>(
    (acc, game) => ({
      points: acc.points + game.ownTeam.totals.points,
      assists: acc.assists + game.ownTeam.totals.assists,
      turnovers: acc.turnovers + game.ownTeam.totals.turnovers,
      drb: acc.drb + game.ownTeam.totals.drb,
      orb: acc.orb + game.ownTeam.totals.orb,
      trb: acc.trb + game.ownTeam.totals.trb,
      ftMade: acc.ftMade + game.ownTeam.totals.ftMade,
      ftAtt: acc.ftAtt + game.ownTeam.totals.ftAtt,
      fgAtt: acc.fgAtt + game.ownTeam.totals.fgAtt,
      fga2: acc.fga2 + game.ownTeam.totals.fga2,
      fga3: acc.fga3 + game.ownTeam.totals.fga3,
      usageBase: acc.usageBase + game.ownTeam.totals.usageBase,
      seconds: acc.seconds + game.ownTeam.totals.seconds,
    }),
    { points: 0, assists: 0, turnovers: 0, drb: 0, orb: 0, trb: 0, ftMade: 0, ftAtt: 0, fgAtt: 0, fga2: 0, fga3: 0, usageBase: 0, seconds: 0 }
  );
  const oppTotals = games.reduce<KosarstatClutchTeamTotals>(
    (acc, game) => ({
      points: acc.points + game.oppTeam.totals.points,
      assists: acc.assists + game.oppTeam.totals.assists,
      turnovers: acc.turnovers + game.oppTeam.totals.turnovers,
      drb: acc.drb + game.oppTeam.totals.drb,
      orb: acc.orb + game.oppTeam.totals.orb,
      trb: acc.trb + game.oppTeam.totals.trb,
      ftMade: acc.ftMade + game.oppTeam.totals.ftMade,
      ftAtt: acc.ftAtt + game.oppTeam.totals.ftAtt,
      fgAtt: acc.fgAtt + game.oppTeam.totals.fgAtt,
      fga2: acc.fga2 + game.oppTeam.totals.fga2,
      fga3: acc.fga3 + game.oppTeam.totals.fga3,
      usageBase: acc.usageBase + game.oppTeam.totals.usageBase,
      seconds: acc.seconds + game.oppTeam.totals.seconds,
    }),
    { points: 0, assists: 0, turnovers: 0, drb: 0, orb: 0, trb: 0, ftMade: 0, ftAtt: 0, fgAtt: 0, fga2: 0, fga3: 0, usageBase: 0, seconds: 0 }
  );

  const ownPossessionsRaw = ownTotals.fgAtt + 0.44 * ownTotals.ftAtt + ownTotals.turnovers - ownTotals.orb;
  const oppPossessionsRaw = oppTotals.fgAtt + 0.44 * oppTotals.ftAtt + oppTotals.turnovers - oppTotals.orb;
  const ownPossessions = ownPossessionsRaw > 0 ? ownPossessionsRaw : ownTotals.fgAtt + 0.44 * ownTotals.ftAtt + ownTotals.turnovers;
  const oppPossessions = oppPossessionsRaw > 0 ? oppPossessionsRaw : oppTotals.fgAtt + 0.44 * oppTotals.ftAtt + oppTotals.turnovers;
  const sampleSeconds = games.reduce((sum, game) => sum + game.clutch.sampleSize, 0);
  const usageByPlayer = new Map<string, { usageBase: number; seconds: number }>();

  games.forEach(game => {
    game.ownTeam.players.forEach(player => {
      const existing = usageByPlayer.get(player.player) || { usageBase: 0, seconds: 0 };
      existing.usageBase += player.usageBase;
      existing.seconds += player.seconds;
      usageByPlayer.set(player.player, existing);
    });
  });

  const topUsageClosers = Array.from(usageByPlayer.entries())
    .filter(([player]) => activePlayerProfiles.length === 0 || matchesNormalizedNameProfile(player, activePlayerProfiles))
    .map(([player, value]) => ({
      player,
      usageShare: roundValue(
        ownTotals.usageBase > 0
          ? value.usageBase / ownTotals.usageBase
          : value.seconds / Math.max(1, ownTotals.seconds),
        3
      ),
    }))
    .sort((a, b) => b.usageShare - a.usageShare)
    .slice(0, 3);

  const ortg = ownPossessions > 0 ? roundValue((ownTotals.points / ownPossessions) * 100, 1) : null;
  const drtg = oppPossessions > 0 ? roundValue((oppTotals.points / oppPossessions) * 100, 1) : null;
  const rebPct = ownTotals.orb + oppTotals.drb > 0
    ? roundValue((ownTotals.orb / (ownTotals.orb + oppTotals.drb)) * 100, 1)
    : null;
  const ftRate = ownTotals.fgAtt > 0 ? roundValue(ownTotals.ftMade / ownTotals.fgAtt, 3) : null;
  const assistToTurnover = ownTotals.turnovers > 0 ? roundValue(ownTotals.assists / ownTotals.turnovers, 2) : null;
  const tovPct = ownPossessions > 0 ? roundValue((ownTotals.turnovers / ownPossessions) * 100, 1) : null;

  return {
    available: sampleSeconds >= 60,
    sampleSize: sampleSeconds,
    sampleLabel: formatSecondsAsMmSs(sampleSeconds),
    ownPoints: ownTotals.points,
    oppPoints: oppTotals.points,
    diff: ownTotals.points - oppTotals.points,
    ownTurnovers: ownTotals.turnovers,
    oppTurnovers: oppTotals.turnovers,
    ortg,
    drtg,
    net: ortg !== null && drtg !== null ? roundValue(ortg - drtg, 1) : null,
    tovPct,
    rebPct,
    ftRate,
    assistToTurnover,
    topUsageClosers,
  };
};

/** Ennél kevesebb clutch meccsből nincs clutch-verdikt és szerep-következtetés, csak „kevés adat”. */
export const CLUTCH_MIN_GAMES_FOR_VERDICT = 3;

export const buildAggregatedKosarstatPlayerClutchContext = (
  games: KosarstatParsedClutchGame[],
  playerProfiles: NormalizedNameProfile[]
) => {
  const matchedGames = games
    .map(game => {
      const matchedPlayer = game.ownTeam.players.find(player => matchesNormalizedNameProfile(player.player, playerProfiles)) || null;
      return matchedPlayer ? { game, player: matchedPlayer } : null;
    })
    .filter((item): item is { game: KosarstatParsedClutchGame; player: KosarstatClutchPlayerStat } => Boolean(item));

  if (matchedGames.length === 0) {
    return {
      available: true,
      games: 0,
      sampleSeconds: 0,
      sampleLabel: '00:00',
      confidence: 'alacsony' as const,
      usagePct: null as number | null,
      tsPct: null as number | null,
      tovPct: null as number | null,
      astTo: null as number | null,
      ppp: null as number | null,
      sampleWarning: 'Nincs Kosarstat clutch minta ehhez a játékoshoz.' as string | null,
      roleNote: null as string | null,
    };
  }

  const totals = matchedGames.reduce(
    (acc, item) => ({
      points: acc.points + item.player.points,
      assists: acc.assists + item.player.assists,
      turnovers: acc.turnovers + item.player.turnovers,
      ftAtt: acc.ftAtt + item.player.ftAtt,
      fgAtt: acc.fgAtt + item.player.fgAtt,
      usageBase: acc.usageBase + item.player.usageBase,
      seconds: acc.seconds + item.player.seconds,
      teamUsageBase: acc.teamUsageBase + item.game.ownTeam.totals.usageBase,
    }),
    { points: 0, assists: 0, turnovers: 0, ftAtt: 0, fgAtt: 0, usageBase: 0, seconds: 0, teamUsageBase: 0 }
  );

  const tsDen = 2 * (totals.fgAtt + 0.44 * totals.ftAtt);
  const usagePct = totals.teamUsageBase > 0 ? roundValue((totals.usageBase / totals.teamUsageBase) * 100, 1) : null;
  const tsPct = tsDen > 0 ? roundValue((totals.points / tsDen) * 100, 1) : null;
  const tovPct = totals.usageBase > 0 ? roundValue((totals.turnovers / totals.usageBase) * 100, 1) : null;
  const astTo = totals.turnovers > 0 ? roundValue(totals.assists / totals.turnovers, 2) : (totals.assists > 0 ? roundValue(totals.assists, 2) : null);
  const ppp = totals.usageBase > 0 ? roundValue(totals.points / totals.usageBase, 3) : null;

  return {
    available: true,
    games: matchedGames.length,
    sampleSeconds: totals.seconds,
    sampleLabel: formatSecondsAsMmSs(totals.seconds),
    confidence: matchedGames.length >= 8 ? 'magas' as const : matchedGames.length >= 4 ? 'kozepes' as const : 'alacsony' as const,
    usagePct,
    tsPct,
    tovPct,
    astTo,
    ppp,
    sampleWarning: matchedGames.length < CLUTCH_MIN_GAMES_FOR_VERDICT
      ? `Kevés adat: ${matchedGames.length} clutch meccs – szerep- és hatékonysági következtetés csak legalább ${CLUTCH_MIN_GAMES_FOR_VERDICT} meccstől.`
      : matchedGames.length < 10 ? 'Korlátozott Kosarstat clutch minta: az értelmezés inkább irányadó, mint végleges.' : null,
    roleNote: (() => {
      // 1–2 meccsből (pár clutch-birtoklás) nem vonunk le szerepet.
      if (usagePct === null || matchedGames.length < CLUTCH_MIN_GAMES_FOR_VERDICT) return null;
      if (usagePct < 15) return 'Clutch szerepben inkább befejező opció, nem elsődleges labdás vagy izolációs lezáró.';
      if (usagePct >= 24) return 'Clutch szerepben érdemi labdás terhelést is kap.';
      return 'Clutch szerepe vegyes: részben befejező, részben kapcsolódó labdás feladatokkal.';
    })(),
  };
};

export const buildPostgamePbpContextFromKosarstatClutch = (
  tables: Array<{ headers: string[]; rows: unknown[][]; sourceTableDomId: string | null }>,
  metadata: { homeTeamName?: string | null; awayTeamName?: string | null },
  ownSide: 'home' | 'away',
  selectedTeamName?: string
): PostgamePbpContext | null => {
  const parsedGame = parseKosarstatClutchGame(tables, metadata, ownSide, selectedTeamName);
  if (!parsedGame) return null;

  return {
    clutch: {
      ...parsedGame.clutch,
    },
    turnoverTypes: [],
    ownTurnovers: parsedGame.ownTeam.totals.turnovers,
  };
};
