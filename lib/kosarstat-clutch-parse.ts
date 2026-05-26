// Kosarstat clutch game data parsing utilities

type KosarstatClutchPlayerStat = {
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

type KosarstatClutchTeamTotals = {
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

type KosarstatClutchTeamSummary = {
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

export type KosarstatGameClutch = {
  available: boolean;
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

const roundValue = (value: number, digits = 1): number => {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
};

const normalizeTeamKey = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const parseSignedNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(',', '.').replace(/^\+/, '');
  if (!/^[-+]?\d+(?:\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseMmSsToSeconds = (value: unknown): number => {
  if (typeof value !== 'string') return 0;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return 0;
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return 0;
  return minutes * 60 + seconds;
};

const formatSecondsAsMmSs = (seconds: number): string => {
  const safe = Math.max(0, Math.round(seconds));
  const mm = Math.floor(safe / 60);
  const ss = safe % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
};

const normalizeClutchHeader = (value: unknown): string =>
  String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\./g, '')
    .trim();

const findClutchHeaderIndex = (headers: string[], labels: string[]): number => {
  const normalizedLabels = labels.map(normalizeClutchHeader);
  return headers.findIndex(header => normalizedLabels.includes(normalizeClutchHeader(header)));
};

const isClutchPlayerStatsTable = (headers: string[]): boolean => {
  const normalized = headers.map(normalizeClutchHeader);
  return normalized.includes('jatekos') && normalized.includes('min') && normalized.includes('pts');
};

const computeTopUsageClosers = (
  players: KosarstatClutchPlayerStat[],
  totals: KosarstatClutchTeamTotals
): Array<{ player: string; usageShare: number }> =>
  players
    .filter(p => p.seconds > 0)
    .map(p => ({
      player: p.player,
      usageShare: roundValue(
        totals.usageBase > 0
          ? p.usageBase / totals.usageBase
          : p.seconds / Math.max(1, totals.seconds),
        3
      ),
    }))
    .sort((a, b) => b.usageShare - a.usageShare)
    .slice(0, 3);

const parseClutchTeamTable = (
  teamName: string,
  table: { headers: string[]; rows: unknown[][] }
): KosarstatClutchTeamSummary => {
  const idx = {
    player: findClutchHeaderIndex(table.headers, ['Játékos']),
    min: findClutchHeaderIndex(table.headers, ['MIN', 'Min']),
    pts: findClutchHeaderIndex(table.headers, ['PTS']),
    ast: findClutchHeaderIndex(table.headers, ['AST']),
    tov: findClutchHeaderIndex(table.headers, ['TOV']),
    drb: findClutchHeaderIndex(table.headers, ['DRB']),
    orb: findClutchHeaderIndex(table.headers, ['ORB']),
    trb: findClutchHeaderIndex(table.headers, ['TRB']),
    ftMade: findClutchHeaderIndex(table.headers, ['FT made']),
    ftAtt: findClutchHeaderIndex(table.headers, ['FT att.', 'FT att']),
    fgAtt: findClutchHeaderIndex(table.headers, ['FG att.', 'FG att']),
    fga2: findClutchHeaderIndex(table.headers, ['2P att.', '2P att']),
    fga3: findClutchHeaderIndex(table.headers, ['3P att.', '3P att']),
  };

  const players: KosarstatClutchPlayerStat[] = [];

  table.rows.forEach(rawRow => {
    if (!Array.isArray(rawRow)) return;
    const offset = rawRow.length >= table.headers.length ? rawRow.length - table.headers.length : 0;
    const readCell = (index: number) => (index >= 0 ? rawRow[index + offset] : null);
    const player = String(readCell(idx.player) || '').trim();
    const minutesLabel = String(readCell(idx.min) || '').trim();
    const normalizedPlayer = normalizeClutchHeader(player);
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

    players.push({ player, seconds, points, assists, turnovers, drb, orb, trb, ftMade, ftAtt, fgAtt, fga2, fga3, usageBase });
  });

  const totals = players.reduce<KosarstatClutchTeamTotals>(
    (acc, p) => ({
      points: acc.points + p.points,
      assists: acc.assists + p.assists,
      turnovers: acc.turnovers + p.turnovers,
      drb: acc.drb + p.drb,
      orb: acc.orb + p.orb,
      trb: acc.trb + p.trb,
      ftMade: acc.ftMade + p.ftMade,
      ftAtt: acc.ftAtt + p.ftAtt,
      fgAtt: acc.fgAtt + p.fgAtt,
      fga2: acc.fga2 + p.fga2,
      fga3: acc.fga3 + p.fga3,
      usageBase: acc.usageBase + p.usageBase,
      seconds: acc.seconds + p.seconds,
    }),
    { points: 0, assists: 0, turnovers: 0, drb: 0, orb: 0, trb: 0, ftMade: 0, ftAtt: 0, fgAtt: 0, fga2: 0, fga3: 0, usageBase: 0, seconds: 0 }
  );

  const sampleSeconds = Math.max(
    players.reduce((max, p) => Math.max(max, p.seconds), 0),
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
    topUsageClosers: computeTopUsageClosers(players, totals),
  };
};

export function parseGameClutch(
  tables: Array<{ headers: string[]; rows: unknown[][]; sourceTableDomId: string | null }>,
  metadata: { homeTeamName?: string | null; awayTeamName?: string | null },
  ownSide: 'home' | 'away',
  selectedTeamName?: string
): KosarstatGameClutch | null {
  const parsedTeams = tables
    .map((table, index, allTables) => {
      if (!isClutchPlayerStatsTable(table.headers)) return null;
      const bannerTable = index > 0 ? allTables[index - 1] : null;
      const firstBannerRow = bannerTable && Array.isArray(bannerTable.rows[0]) ? bannerTable.rows[0] : null;
      const teamName = String(firstBannerRow?.[0] || '').trim().split('(')[0]?.trim() || '';
      if (!teamName) return null;
      return parseClutchTeamTable(teamName, table);
    })
    .filter((item): item is KosarstatClutchTeamSummary => Boolean(item));

  if (parsedTeams.length < 2) return null;

  const ownNameCandidates = [selectedTeamName, ownSide === 'home' ? metadata.homeTeamName : metadata.awayTeamName]
    .map(v => String(v || '').trim())
    .filter(Boolean)
    .map(normalizeTeamKey);

  const matchTeam = (candidates: KosarstatClutchTeamSummary[], needles: string[]) =>
    candidates.find(team => {
      const teamKey = normalizeTeamKey(team.teamName);
      return needles.some(needle => teamKey.includes(needle) || needle.includes(teamKey));
    }) ?? null;

  const ownTeam = matchTeam(parsedTeams, ownNameCandidates)
    ?? (ownSide === 'home' ? parsedTeams[0] : parsedTeams[1])
    ?? null;
  const oppTeam = parsedTeams.find(team => team !== ownTeam) ?? null;

  if (!ownTeam || !oppTeam) return null;

  const rebPct =
    ownTeam.totals.orb + oppTeam.totals.drb > 0
      ? roundValue((ownTeam.totals.orb / (ownTeam.totals.orb + oppTeam.totals.drb)) * 100, 1)
      : null;
  const assistToTurnover =
    ownTeam.totals.turnovers > 0
      ? roundValue(ownTeam.totals.assists / ownTeam.totals.turnovers, 2)
      : null;
  const sampleSeconds = Math.max(ownTeam.sampleSeconds, oppTeam.sampleSeconds);

  return {
    available: sampleSeconds >= 60,
    sampleLabel: formatSecondsAsMmSs(sampleSeconds),
    ownPoints: ownTeam.totals.points,
    oppPoints: oppTeam.totals.points,
    diff: ownTeam.totals.points - oppTeam.totals.points,
    ownTurnovers: ownTeam.totals.turnovers,
    oppTurnovers: oppTeam.totals.turnovers,
    ortg: ownTeam.ortg,
    drtg: oppTeam.ortg,
    net:
      ownTeam.ortg !== null && oppTeam.ortg !== null
        ? roundValue(ownTeam.ortg - oppTeam.ortg, 1)
        : null,
    tovPct: ownTeam.tovPct,
    rebPct,
    ftRate: ownTeam.ftRate,
    assistToTurnover,
    topUsageClosers: ownTeam.topUsageClosers,
  };
}
