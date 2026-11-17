// Kosarstat lineup-oldal elemzése: játékosperc, percrács / eseménylista alapú rotáció,
// ötös-szakaszok (stint), párosok és hármasok, szezonos aggregálás. A SeasonComparison-ből
// kiszervezve (H34/F1b), viselkedésváltozás nélkül. Nem @core modul.
import type { KosarstatPlayerRotation, KosarstatRotationEvent } from '@/lib/kosarstat-substitutions';
import { endsOnCourt, groupRotationByPlayer, rotationFromMinuteCodes, validateRotation } from '@/lib/kosarstat-substitutions';
import { isScoringLineupStint } from '@/lib/postgame-lineup-export';
import {
  formatElapsedGameClock,
  formatSecondsAsMmSs,
  normalizeTeamKey,
  parseMmSsToSeconds,
  parseSignedNumber,
  roundValue,
} from '@/lib/season-comparison-helpers';

export type KosarstatLineupTableRow = {
  rows?: unknown;
  headers?: unknown;
  source_table_dom_id?: unknown;
  table_index?: unknown;
};

export type KosarstatPlayerMinuteStat = {
  player: string;
  minutesLabel: string;
  seconds: number;
  plusMinus: number | null;
  on40: number | null;
  teamPts: number | null;
  oppPts: number | null;
};

export type KosarstatSubEvent = KosarstatRotationEvent;

/** A játékos beállásai / lecserélései percre; `inferred…`: a percrácsból következtetett események. */
export type KosarstatRotationMinutes = {
  subInMinutes: number[];
  subOutMinutes: number[];
  inferredInMinutes: number[];
  inferredOutMinutes: number[];
  endsOnCourt: boolean;
};

export type KosarstatPlayerTimeline = KosarstatRotationMinutes & {
  player: string;
  minuteCodes: string[];
  minutesLabel: string;
  seconds: number;
  plusMinus: number | null;
};

export type KosarstatLineupStint = {
  players: string[];
  minutesLabel: string;
  seconds: number;
  teamPts: number;
  oppPts: number;
  plusMinus: number;
  on40: number | null;
};

export type KosarstatComboStat = {
  key: string;
  players: string[];
  stints: number;
  seconds: number;
  minutesLabel: string;
  plusMinus: number;
  netPer40: number;
  offPer40: number;
  defPer40: number;
  assists: null;
};

export type KosarstatTeamLineupAnalysis = {
  teamName: string;
  starters: string[];
  playerMinutes: KosarstatPlayerMinuteStat[];
  playerTimelines: KosarstatPlayerTimeline[];
  substitutions: KosarstatSubEvent[];
  /** A cserék forrása: az eseménylista (másodpercre pontos) vagy a percrács. */
  rotationSource: 'events' | 'grid';
  /** Játékosok, akiknél a beállások és a lecserélések nem párosíthatók. */
  rotationIssues: string[];
  stints: KosarstatLineupStint[];
  pairStats: KosarstatComboStat[];
  trioStats: KosarstatComboStat[];
};

export type KosarstatLineupAnalysis = {
  gameId: string;
  selectedTeam: KosarstatTeamLineupAnalysis | null;
  /** A `selectedTeam` oldala a lineup oldalon – a másik oldal az ellenfél. */
  selectedSide: 'home' | 'away' | null;
  homeTeam: KosarstatTeamLineupAnalysis | null;
  awayTeam: KosarstatTeamLineupAnalysis | null;
};

export const buildComboStats = (stints: KosarstatLineupStint[], comboSize: 2 | 3): KosarstatComboStat[] => {
  const aggregate = new Map<string, { players: string[]; stints: number; seconds: number; plusMinus: number; teamPts: number; oppPts: number }>();

  const combinations = (items: string[], size: number): string[][] => {
    const out: string[][] = [];
    const walk = (start: number, current: string[]) => {
      if (current.length === size) {
        out.push([...current]);
        return;
      }
      for (let i = start; i < items.length; i += 1) {
        current.push(items[i]);
        walk(i + 1, current);
        current.pop();
      }
    };
    walk(0, []);
    return out;
  };

  stints.forEach(stint => {
    if (stint.players.length < comboSize || !isScoringLineupStint(stint)) return;
    const combos = combinations(stint.players, comboSize);
    combos.forEach(players => {
      const key = [...players].sort().join(' | ');
      const existing = aggregate.get(key) || {
        players: [...players].sort(),
        stints: 0,
        seconds: 0,
        plusMinus: 0,
        teamPts: 0,
        oppPts: 0,
      };

      existing.stints += 1;
      existing.seconds += stint.seconds;
      existing.plusMinus += stint.plusMinus;
      existing.teamPts += stint.teamPts;
      existing.oppPts += stint.oppPts;
      aggregate.set(key, existing);
    });
  });

  return Array.from(aggregate.entries())
    .map(([key, value]) => {
      const per40Factor = value.seconds > 0 ? 2400 / value.seconds : 0;
      return {
        key,
        players: value.players,
        stints: value.stints,
        seconds: value.seconds,
        minutesLabel: formatSecondsAsMmSs(value.seconds),
        plusMinus: value.plusMinus,
        netPer40: (value.teamPts - value.oppPts) * per40Factor,
        offPer40: value.teamPts * per40Factor,
        defPer40: value.oppPts * per40Factor,
        assists: null,
      };
    })
    .sort((a, b) => b.netPer40 - a.netPer40 || b.seconds - a.seconds);
};

export const buildAggregatedKosarstatLineupTeamAnalysis = (
  teams: KosarstatTeamLineupAnalysis[],
  fallbackTeamName: string
): KosarstatTeamLineupAnalysis | null => {
  if (teams.length === 0) return null;

  const playerMinuteMap = new Map<string, {
    seconds: number;
    plusMinus: number | null;
    teamPts: number | null;
    oppPts: number | null;
  }>();

  teams.forEach(team => {
    team.playerMinutes.forEach(item => {
      const existing = playerMinuteMap.get(item.player) || {
        seconds: 0,
        plusMinus: 0,
        teamPts: 0,
        oppPts: 0,
      };
      existing.seconds += item.seconds || 0;
      existing.plusMinus = (existing.plusMinus ?? 0) + (item.plusMinus ?? 0);
      existing.teamPts = (existing.teamPts ?? 0) + (item.teamPts ?? 0);
      existing.oppPts = (existing.oppPts ?? 0) + (item.oppPts ?? 0);
      playerMinuteMap.set(item.player, existing);
    });
  });

  const aggregatedStintsMap = new Map<string, {
    players: string[];
    seconds: number;
    teamPts: number;
    oppPts: number;
    plusMinus: number;
  }>();
  const allStints: KosarstatLineupStint[] = [];

  teams.forEach(team => {
    team.stints.forEach(stint => {
      allStints.push(stint);
      const key = [...stint.players].sort((a, b) => a.localeCompare(b, 'hu')).join(' | ');
      const existing = aggregatedStintsMap.get(key) || {
        players: [...stint.players].sort((a, b) => a.localeCompare(b, 'hu')),
        seconds: 0,
        teamPts: 0,
        oppPts: 0,
        plusMinus: 0,
      };
      existing.seconds += stint.seconds || 0;
      existing.teamPts += stint.teamPts || 0;
      existing.oppPts += stint.oppPts || 0;
      existing.plusMinus += stint.plusMinus || 0;
      aggregatedStintsMap.set(key, existing);
    });
  });

  const playerMinutes = Array.from(playerMinuteMap.entries())
    .map(([player, value]) => ({
      player,
      minutesLabel: formatSecondsAsMmSs(value.seconds),
      seconds: value.seconds,
      plusMinus: value.plusMinus,
      on40: value.seconds > 0 && value.plusMinus !== null ? roundValue((value.plusMinus * 2400) / value.seconds, 1) : null,
      teamPts: value.teamPts,
      oppPts: value.oppPts,
    }))
    .sort((a, b) => b.seconds - a.seconds || a.player.localeCompare(b.player, 'hu'));

  const starters = playerMinutes.slice(0, 5).map(item => item.player);
  const stints = Array.from(aggregatedStintsMap.values())
    .map(item => ({
      players: item.players,
      minutesLabel: formatSecondsAsMmSs(item.seconds),
      seconds: item.seconds,
      teamPts: item.teamPts,
      oppPts: item.oppPts,
      plusMinus: item.plusMinus,
      on40: item.seconds > 0 ? roundValue((item.plusMinus * 2400) / item.seconds, 1) : null,
    }))
    .sort((a, b) => b.seconds - a.seconds || (Number(b.on40 ?? 0) - Number(a.on40 ?? 0)));

  return {
    teamName: fallbackTeamName || teams[0]?.teamName || '',
    starters,
    playerMinutes,
    playerTimelines: [],
    substitutions: [],
    rotationSource: 'grid',
    rotationIssues: [],
    stints,
    pairStats: buildComboStats(allStints, 2),
    trioStats: buildComboStats(allStints, 3),
  };
};

export const rotationMinutesOf = (rotation: KosarstatPlayerRotation): KosarstatRotationMinutes => {
  const minutes = (type: 'in' | 'out', inferredOnly: boolean) =>
    rotation.events.filter(event => event.type === type && (!inferredOnly || event.inferred)).map(event => event.minute);
  return {
    subInMinutes: minutes('in', false),
    subOutMinutes: minutes('out', false),
    inferredInMinutes: minutes('in', true),
    inferredOutMinutes: minutes('out', true),
    endsOnCourt: endsOnCourt(rotation),
  };
};

/**
 * A csapat csere-eseményei és azok ellenőrzése. Az elsődleges forrás az
 * eseménylista (`events`, másodpercre pontos, az azonos percben történt be- és
 * lecserélést is tartalmazza); ha nincs, vagy a nevei nem a lineup oldal
 * nevei, a percrácsból olvasott események maradnak.
 */
export const applyRotationSource = (
  team: KosarstatTeamLineupAnalysis,
  events: KosarstatRotationEvent[] | undefined
): KosarstatTeamLineupAnalysis => {
  const lineupPlayers = team.playerTimelines.map(row => row.player);
  const hasGrid = lineupPlayers.length > 0;
  const gridStarters = hasGrid ? team.starters : [];
  // A meccs végi állapot a percrács utolsó percéből – az eseményektől független ellenőrzés.
  const observedEnd = new Map(team.playerTimelines.map(row => {
    const lastCode = row.minuteCodes[row.minuteCodes.length - 1] ?? '0';
    return [row.player, lastCode === '1' || lastCode === '2'] as const;
  }));

  const fromGrid = (extraIssue?: string): KosarstatTeamLineupAnalysis => {
    const rotations = groupRotationByPlayer(team.substitutions, gridStarters, observedEnd);
    return {
      ...team,
      rotationSource: 'grid',
      rotationIssues: [...(extraIssue ? [extraIssue] : []), ...validateRotation(rotations).map(issue => issue.message)],
    };
  };
  if (!events || events.length === 0) return fromGrid();

  const unknown = Array.from(new Set(events.map(event => event.player))).filter(name => hasGrid && !lineupPlayers.includes(name));
  if (unknown.length > 0) {
    return fromGrid(`Az eseménylista cseréi nem párosíthatók a lineup oldal neveivel (${unknown.join(', ')}) – a cserék a percrácsból származnak.`);
  }

  const rotations = groupRotationByPlayer(events, gridStarters, observedEnd);
  const byPlayer = new Map(rotations.map(rotation => [rotation.player, rotation]));
  return {
    ...team,
    substitutions: events,
    playerTimelines: team.playerTimelines.map(row => ({
      ...row,
      ...rotationMinutesOf(byPlayer.get(row.player) ?? { player: row.player, isStarter: gridStarters.includes(row.player), events: [] }),
    })),
    rotationSource: 'events',
    rotationIssues: validateRotation(rotations).map(issue => issue.message),
  };
};

export const parseKosarstatTeamLineupAnalysis = (
  teamName: string,
  teamTables: Array<{ headers: string[]; rows: unknown[][]; sourceTableDomId: string | null }>
): KosarstatTeamLineupAnalysis => {
  const isInvalidPlayerLabel = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return true;
    if (/^\d+$/.test(trimmed)) return true;
    if (/^(?:j[aá]t[eé]kos|player)$/i.test(trimmed)) return true;
    return false;
  };

  const isLikelyMinuteGridTable = (table: { headers: string[]; rows: unknown[][] }) => {
    const row = table.rows.find(item => Array.isArray(item)) as unknown[] | undefined;
    if (!row || row.length < 8) return false;
    const cells = row.map(cell => String(cell ?? '').trim());
    const hasPlayerAndMinute = cells.includes('Játékos') && cells.includes('Perc');
    const numericMinuteMarkers = cells.filter(cell => /^\d{1,2}$/.test(cell) && Number(cell) >= 1 && Number(cell) <= 40);
    return hasPlayerAndMinute && numericMinuteMarkers.length >= 10;
  };

  const getMinuteColumnIndexes = (table: { headers: string[]; rows: unknown[][] }) => {
    const fromHeaders = table.headers
      .map((header, index) => ({ header, index }))
      .filter(item => /^\d{1,2}$/.test(item.header) && Number(item.header) >= 1 && Number(item.header) <= 40)
      .sort((a, b) => Number(a.header) - Number(b.header));

    if (fromHeaders.length > 0) {
      return fromHeaders;
    }

    const headerLikeRow = table.rows.find(item => {
      if (!Array.isArray(item)) return false;
      const cells = item.map(cell => String(cell ?? '').trim());
      return cells.includes('Játékos') && cells.includes('Perc') && cells.some(cell => /^\d{1,2}$/.test(cell));
    }) as unknown[] | undefined;

    if (!headerLikeRow) return [] as Array<{ header: string; index: number }>;

    const cells = headerLikeRow.map(cell => String(cell ?? '').trim());
    const hasLeadingOrder = /^\d+$/.test(cells[0] || '') && cells.includes('Játékos') && cells.includes('Perc');
    const headerBaseOffset = hasLeadingOrder ? 1 : 0;

    return cells
      .map((cell, index) => ({ header: cell, index: index - headerBaseOffset }))
      .filter(item => item.index >= 0 && /^\d{1,2}$/.test(item.header) && Number(item.header) >= 1 && Number(item.header) <= 40)
      .sort((a, b) => Number(a.header) - Number(b.header));
  };

  const playerSummaryCandidates = teamTables.filter(table => table.headers.includes('Játékos') && table.headers.includes('Min') && table.headers.includes('On40'));
  const minuteGrid =
    teamTables.find(table => table.sourceTableDomId === 'table_7' || table.sourceTableDomId === 'table_12') ||
    teamTables.find(table => table.headers.includes('Perc') && table.headers.includes('1') && table.headers.includes('40')) ||
    teamTables.find(table => isLikelyMinuteGridTable(table));
  const fiveMan = teamTables.find(table => table.headers.includes('PG') && table.headers.includes('SG') && table.headers.includes('SF') && table.headers.includes('PF') && table.headers.includes('C') && table.headers.some(h => h.includes('On +/-')));

  const parsePlayerSummaryTable = (table: { headers: string[]; rows: unknown[][] }) => {
    const list: KosarstatPlayerMinuteStat[] = [];
    const idx = {
      player: table.headers.indexOf('Játékos'),
      min: table.headers.indexOf('Min'),
      teamPts: table.headers.indexOf('Team PTS'),
      oppPts: table.headers.indexOf('Opp. PTS'),
      pm: table.headers.indexOf('+/-'),
      on40: table.headers.findIndex(h => h.toLowerCase() === 'on40' || h.toLowerCase() === 'on 40'),
    };

    table.rows.forEach(rawRow => {
      if (!Array.isArray(rawRow)) return;
      const player = String(rawRow[idx.player] || '').trim();
      const minutesLabel = String(rawRow[idx.min] || '').trim();
      if (!minutesLabel || player === 'Játékos' || isInvalidPlayerLabel(player)) return;

      list.push({
        player,
        minutesLabel,
        seconds: parseMmSsToSeconds(minutesLabel),
        plusMinus: parseSignedNumber(rawRow[idx.pm]),
        on40: parseSignedNumber(rawRow[idx.on40]),
        teamPts: parseSignedNumber(rawRow[idx.teamPts]),
        oppPts: parseSignedNumber(rawRow[idx.oppPts]),
      });
    });

    return list.sort((a, b) => b.seconds - a.seconds);
  };

  const playerMinutes: KosarstatPlayerMinuteStat[] = [];

  const stints: KosarstatLineupStint[] = [];
  if (fiveMan) {
    const idx = {
      pg: fiveMan.headers.indexOf('PG'),
      sg: fiveMan.headers.indexOf('SG'),
      sf: fiveMan.headers.indexOf('SF'),
      pf: fiveMan.headers.indexOf('PF'),
      c: fiveMan.headers.indexOf('C'),
      min: fiveMan.headers.indexOf('Min'),
      teamPts: fiveMan.headers.indexOf('Team PTS'),
      oppPts: fiveMan.headers.indexOf('Opp. PTS'),
      pm: fiveMan.headers.findIndex(h => h.includes('On +/-')),
      on40: fiveMan.headers.findIndex(h => h.includes('On 40')),
    };

    fiveMan.rows.forEach(rawRow => {
      if (!Array.isArray(rawRow)) return;
      const players = [rawRow[idx.pg], rawRow[idx.sg], rawRow[idx.sf], rawRow[idx.pf], rawRow[idx.c]]
        .map(cell => (typeof cell === 'string' ? cell.trim() : ''))
        .filter(Boolean);
      const minutesLabel = typeof rawRow[idx.min] === 'string' ? String(rawRow[idx.min]).trim() : '';
      if (players.length !== 5 || !minutesLabel || minutesLabel === 'Min') return;
      const seconds = parseMmSsToSeconds(minutesLabel);
      const teamPts = parseSignedNumber(rawRow[idx.teamPts]) ?? 0;
      const oppPts = parseSignedNumber(rawRow[idx.oppPts]) ?? 0;
      // A 0:00 idejű sor is kell, ha van pontja (csere közben dobott büntető) –
      // nélküle az ötösök pontösszege elmarad a végeredménytől.
      if (!isScoringLineupStint({ seconds, teamPts, oppPts })) return;
      const plusMinus = parseSignedNumber(rawRow[idx.pm]) ?? teamPts - oppPts;

      stints.push({
        players,
        minutesLabel,
        seconds,
        teamPts,
        oppPts,
        plusMinus,
        on40: parseSignedNumber(rawRow[idx.on40]),
      });
    });
  }

  let starters = stints[0]?.players || [];

  const substitutions: KosarstatSubEvent[] = [];
  const playerTimelines: KosarstatPlayerTimeline[] = [];
  if (minuteGrid) {
    const minuteColumnIndexes = getMinuteColumnIndexes(minuteGrid);

    const startersFromGrid: string[] = [];

    minuteGrid.rows.forEach(rawRow => {
      if (!Array.isArray(rawRow)) return;

      const row = rawRow.map(cell => String(cell ?? '').trim());
      if (row.length < 4) return;

      const hasLeadingOrder = /^\d+$/.test(row[0] || '') && /^\d{1,2}:\d{2}$/.test(row[2] || '');
      const baseOffset = hasLeadingOrder ? 1 : 0;

      const player = (row[0 + baseOffset] || '').trim();
      if (player === 'Játékos' || player.includes('Pályán töltött') || isInvalidPlayerLabel(player)) return;

      const minuteCodes = minuteColumnIndexes.map(({ index, header }) => ({
        minute: Number(header),
        code: (row[index + baseOffset] || '').trim(),
      }));

      const rowMinutesLabel = (row[1 + baseOffset] || '').trim();
      const parsedRowSeconds = parseMmSsToSeconds(rowMinutesLabel);
      const rowPlusMinus = parseSignedNumber(row[2 + baseOffset]);
      const derivedSecondsFromCodes = minuteCodes.reduce((acc, item) => {
        const code = item.code;
        if (code === '1') return acc + 60;
        if (code === '2' || code === '3') return acc + 30;
        return acc;
      }, 0);
      const timelineSeconds = parsedRowSeconds > 0 ? parsedRowSeconds : derivedSecondsFromCodes;
      const timelineMinutesLabel = parsedRowSeconds > 0
        ? rowMinutesLabel
        : formatSecondsAsMmSs(timelineSeconds);

      // A rács percenként egy kódot ad: ha valaki egy percen belül be is áll
      // és le is megy, a hiányzó eseményt az állapotból következtetjük.
      const lastMinute = minuteCodes.reduce((max, item) => Math.max(max, item.minute), 0);
      const codesByMinute = Array.from({ length: lastMinute }, (_, index) =>
        minuteCodes.find(item => item.minute === index + 1)?.code ?? ''
      );
      const rotation = rotationFromMinuteCodes(player, codesByMinute);
      if (rotation.isStarter) startersFromGrid.push(player);

      playerTimelines.push({
        player,
        minuteCodes: minuteCodes.map(item => item.code || '0'),
        minutesLabel: timelineMinutesLabel,
        seconds: timelineSeconds,
        plusMinus: rowPlusMinus,
        ...rotationMinutesOf(rotation),
      });
      substitutions.push(...rotation.events);
    });

    if (startersFromGrid.length >= 5) {
      starters = startersFromGrid.slice(0, 5);
    }
  } else if (stints.length > 1) {
    let elapsedSeconds = 0;

    for (let index = 0; index < stints.length - 1; index += 1) {
      const current = stints[index];
      const next = stints[index + 1];
      elapsedSeconds += current.seconds;

      const nextSet = new Set(next.players);
      const currentSet = new Set(current.players);

      const outPlayers = current.players.filter(player => !nextSet.has(player));
      const inPlayers = next.players.filter(player => !currentSet.has(player));

      const minute = Math.min(40, Math.max(1, Math.floor(elapsedSeconds / 60) + 1));
      const clockLabel = formatElapsedGameClock(elapsedSeconds);

      outPlayers.forEach(player => {
        substitutions.push({
          gameSecond: elapsedSeconds,
          minute,
          clockLabel,
          type: 'out',
          player,
        });
      });

      inPlayers.forEach(player => {
        substitutions.push({
          gameSecond: elapsedSeconds,
          minute,
          clockLabel,
          type: 'in',
          player,
        });
      });
    }
  }

  const referencePlayers = new Set<string>();
  starters.forEach(player => {
    if (player) referencePlayers.add(player);
  });
  stints.forEach(stint => {
    stint.players.forEach(player => {
      if (player) referencePlayers.add(player);
    });
  });
  playerTimelines.forEach(row => {
    if (row.player) referencePlayers.add(row.player);
  });

  if (playerSummaryCandidates.length > 0) {
    const scoredSummaries = playerSummaryCandidates
      .map(table => {
        const parsed = parsePlayerSummaryTable(table);
        const names = new Set(parsed.map(item => item.player));
        let overlap = 0;
        referencePlayers.forEach(name => {
          if (names.has(name)) overlap += 1;
        });
        return { parsed, overlap };
      })
      .sort((a, b) => b.overlap - a.overlap || b.parsed.length - a.parsed.length);

    const best = scoredSummaries[0];
    if (best && (best.overlap > 0 || referencePlayers.size === 0)) {
      playerMinutes.push(...best.parsed);
    }
  }

  if (starters.length < 5 && playerMinutes.length > 0) {
    starters = playerMinutes.slice(0, 5).map(item => item.player);
  }

  if (starters.length < 5 && playerTimelines.length > 0) {
    starters = playerTimelines.slice(0, 5).map(item => item.player);
  }

  const minuteStatByPlayer = new Map(playerMinutes.map(item => [item.player, item]));
  playerTimelines.forEach(row => {
    const minuteStat = minuteStatByPlayer.get(row.player);
    if (!minuteStat) return;
    row.minutesLabel = minuteStat.minutesLabel;
    row.seconds = minuteStat.seconds;
    row.plusMinus = minuteStat.plusMinus;
  });

  if (playerMinutes.length === 0 && playerTimelines.length > 0) {
    playerTimelines.forEach(row => {
      playerMinutes.push({
        player: row.player,
        minutesLabel: row.minutesLabel,
        seconds: row.seconds,
        plusMinus: row.plusMinus,
        on40: null,
        teamPts: null,
        oppPts: null,
      });
    });
    playerMinutes.sort((a, b) => b.seconds - a.seconds || a.player.localeCompare(b.player, 'hu'));
  }

  playerTimelines.sort((a, b) => b.seconds - a.seconds || a.player.localeCompare(b.player, 'hu'));

  // Stabil rendezés csak idő szerint: azonos percben a játékos saját sorrendje (be → le vagy le → be) megmarad.
  substitutions.sort((a, b) => a.gameSecond - b.gameSecond);

  return {
    teamName,
    starters,
    playerMinutes,
    playerTimelines,
    substitutions,
    rotationSource: 'grid',
    rotationIssues: [],
    stints,
    pairStats: buildComboStats(stints, 2),
    trioStats: buildComboStats(stints, 3),
  };
};

export const parseKosarstatLineupAnalysis = (
  tablesData: KosarstatLineupTableRow[],
  gameId: string,
  selectedTeamName: string | null,
  preferredSide?: 'home' | 'away'
): KosarstatLineupAnalysis | null => {
  const tables = tablesData
    .map(table => ({
      headers: Array.isArray(table.headers) ? (table.headers as unknown[]).map(item => (typeof item === 'string' ? item.trim() : '')).filter(Boolean) : [],
      rows: Array.isArray(table.rows) ? (table.rows as unknown[]) : [],
      sourceTableDomId: typeof table.source_table_dom_id === 'string' ? table.source_table_dom_id.trim() || null : null,
    }))
    .map(table => ({
      headers: table.headers,
      rows: table.rows.filter(Array.isArray) as unknown[][],
      sourceTableDomId: table.sourceTableDomId,
    }));

  type Bucket = { teamName: string; tables: Array<{ headers: string[]; rows: unknown[][]; sourceTableDomId: string | null }> };
  const buckets: Bucket[] = [];
  let currentBucket: Bucket | null = null;

  tables.forEach(table => {
    const firstCell = Array.isArray(table.rows[0]) ? String(table.rows[0][0] || '').trim() : '';
    if (firstCell && firstCell.includes('Mérleg:')) {
      const teamName = firstCell.split('(')[0].trim();
      currentBucket = { teamName, tables: [] };
      buckets.push(currentBucket);
      return;
    }

    if (currentBucket) {
      currentBucket.tables.push(table);
    }
  });

  const parsedTeams = buckets
    .map(bucket => parseKosarstatTeamLineupAnalysis(bucket.teamName, bucket.tables))
    .filter(team => team.playerMinutes.length > 0 || team.playerTimelines.length > 0 || team.stints.length > 0);
  if (parsedTeams.length === 0) return null;

  const selectedKey = selectedTeamName ? normalizeTeamKey(selectedTeamName) : '';
  const sideSelectedTeam = preferredSide === 'home'
    ? parsedTeams[0] || null
    : preferredSide === 'away'
      ? parsedTeams[1] || null
      : null;
  const nameSelectedTeam = selectedKey
    ? parsedTeams.find(team => normalizeTeamKey(team.teamName).includes(selectedKey) || selectedKey.includes(normalizeTeamKey(team.teamName))) || null
    : null;
  const selectedTeam = nameSelectedTeam || sideSelectedTeam || parsedTeams[0] || null;

  return {
    gameId,
    selectedTeam,
    selectedSide: selectedTeam === null ? null : selectedTeam === parsedTeams[1] ? 'away' : 'home',
    homeTeam: parsedTeams[0] || null,
    awayTeam: parsedTeams[1] || null,
  };
};
