export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C';

export type TeamSeasonStat = {
  teamId: string;
  teamName: string;
  league: string;
  season: string;
  games: number;
  pointsFor: number;
  pointsAgainst: number;
  fga2: number;
  fgm2: number;
  fga3: number;
  fgm3: number;
  fta: number;
  ftm: number;
  oreb: number;
  dreb: number;
  ast: number;
  tov: number;
  stl: number;
  blk: number;
  fouls: number;
  val: number;
};

export type PlayerSeasonStat = {
  playerId: string;
  name: string;
  position: Position;
  heightCm?: number;
  games: number;
  minutes: number;
  points: number;
  fga2: number;
  fgm2: number;
  fga3: number;
  fgm3: number;
  fta: number;
  ftm: number;
  oreb: number;
  dreb: number;
  ast: number;
  tov: number;
  stl: number;
  blk: number;
  val: number;
  roles: string[];
};

export type BenchmarkPercentiles = {
  P10: number;
  P25: number;
  P40: number;
  P50: number;
  P60: number;
  P75: number;
  P90: number;
};

export type TeamBenchmarks = Record<string, BenchmarkPercentiles>;

export type LeagueTeamBenchmarks = Record<
  string,
  Record<string, TeamBenchmarks>
>;

export type ScoutingReport = {
  opponentTeamId: string;
  opponentTeamName: string;
  league: string;
  season: string;
  winProbability: {
    ownPct: number;
    opponentPct: number;
    predictedWinner: 'own' | 'opponent' | 'even';
    confidence: 'Low' | 'Medium' | 'High';
  };
  positionComparison: PositionComparison[];
  profile: {
    tempo: string;
    offense: string[];
    defense: string[];
  };
  threats: string[];
  vulnerabilities: string[];
  keyPlayers: {
    primaryScorers: string[];
    primaryPlaymakers: string[];
    stretchThreats: string[];
    mismatchCandidates: string[];
  };
  focusPoints: string[];
  xFactorContext?: PreGameXFactorContext;
  summary: string;
};

export type PositionComparison = {
  position: Position;
  ownValPer36: number;
  oppValPer36: number;
  ownPointsPer36: number;
  oppPointsPer36: number;
  deltaValPer36: number;
};

type XFactorCandidate = {
  key: string;
  label: string;
  short: string;
};

type XFactorInsight = {
  primary: XFactorCandidate;
  secondary: XFactorCandidate;
};

export type PreGameXFactorContext = {
  primaryKey: string;
  secondaryKey?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  riskFlags?: string[];
};

const round = (value: number, digits = 2) => {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);


const quantile = (sorted: number[], percentile: number) => {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * percentile;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
};

const getStatValue = (team: NormalizedTeamStats, stat: string) => {
  switch (stat) {
    case 'pace':
      return team.pace;
    case 'assist_rate':
      return team.assistRate;
    case 'turnover_rate':
      return team.turnoverRate;
    case 'oreb_rate':
      return (team.oreb + team.dreb) > 0 ? team.oreb / (team.oreb + team.dreb) : 0;
    case 'two_rate':
      return team.twoRate;
    case 'three_rate':
      return team.threeRate;
    case 'three_pct':
      return team.threePct;
    case 'ft_rate':
      return team.ftRate;
    case 'efg':
      return team.efg;
    case 'val_per_game':
      return team.valPerGame;
    case 'stl_per_game':
      return team.games > 0 ? team.stl / team.games : 0;
    case 'blk_per_game':
      return team.games > 0 ? team.blk / team.games : 0;
    case 'fouls_per_game':
      return team.games > 0 ? team.fouls / team.games : 0;
    default:
      return 0;
  }
};

export type NormalizedTeamStats = TeamSeasonStat & {
  fga: number;
  fgm: number;
  pace: number; // per game
  assistRate: number;
  turnoverRate: number;
  orebRate: number;
  twoRate: number;
  threeRate: number;
  threePct: number;
  ftRate: number;
  efg: number;
  valPerGame: number;
};

export const normalizeTeamStats = (raw: TeamSeasonStat): NormalizedTeamStats => {
  const games = raw.games || 1;
  const fga = raw.fga2 + raw.fga3;
  const fgm = raw.fgm2 + raw.fgm3;
  const pace = (fga + 0.44 * raw.fta + raw.tov) / games;
  const assistRate = fga > 0 ? raw.ast / fga : 0;
  const turnoverRate = pace > 0 ? (raw.tov / games) / pace : 0;
  const orebRate = (raw.oreb + raw.dreb) > 0 ? raw.oreb / (raw.oreb + raw.dreb) : 0;
  const twoRate = fga > 0 ? raw.fga2 / fga : 0;
  const threeRate = fga > 0 ? raw.fga3 / fga : 0;
  const threePct = raw.fga3 > 0 ? (raw.fgm3 / raw.fga3) * 100 : 0;
  const ftRate = fga > 0 ? raw.fta / fga : 0;
  const efg = fga > 0 ? ((fgm + 0.5 * raw.fgm3) / fga) * 100 : 0;
  const valPerGame = raw.val / games;

  return {
    ...raw,
    fga,
    fgm,
    pace: round(pace, 2),
    assistRate: round(assistRate, 3),
    turnoverRate: round(turnoverRate, 3),
    orebRate: round(orebRate, 3),
    twoRate: round(twoRate, 3),
    threeRate: round(threeRate, 3),
    threePct: round(threePct, 1),
    ftRate: round(ftRate, 3),
    efg: round(efg, 1),
    valPerGame: round(valPerGame, 1),
  };
};

const TEAM_STAT_KEYS = [
  'pace',
  'assist_rate',
  'turnover_rate',
  'oreb_rate',
  'two_rate',
  'three_rate',
  'three_pct',
  'ft_rate',
  'efg',
  'val_per_game',
  'stl_per_game',
  'blk_per_game',
  'fouls_per_game',
];

export const buildTeamBenchmarks = (teams: TeamSeasonStat[]): LeagueTeamBenchmarks => {
  const normalized = teams.map(normalizeTeamStats);
  const result: LeagueTeamBenchmarks = {};

  normalized.forEach(team => {
    if (!result[team.league]) result[team.league] = {};
    if (!result[team.league][team.season]) result[team.league][team.season] = {};
  });

  Object.keys(result).forEach(league => {
    Object.keys(result[league]).forEach(season => {
      const pool = normalized.filter(t => t.league === league && t.season === season);
      const statBenchmarks: TeamBenchmarks = {};
      TEAM_STAT_KEYS.forEach(stat => {
        const values = pool
          .map(team => getStatValue(team, stat))
          .filter(v => Number.isFinite(v))
          .sort((a, b) => a - b);
        statBenchmarks[stat] = {
          P10: round(quantile(values, 0.1), 3),
          P25: round(quantile(values, 0.25), 3),
          P40: round(quantile(values, 0.4), 3),
          P50: round(quantile(values, 0.5), 3),
          P60: round(quantile(values, 0.6), 3),
          P75: round(quantile(values, 0.75), 3),
          P90: round(quantile(values, 0.9), 3),
        };
      });
      result[league][season] = statBenchmarks;
    });
  });

  return result;
};

const getBenchmarkThreshold = (
  benchmarks: LeagueTeamBenchmarks,
  team: NormalizedTeamStats,
  stat: string,
  pct: keyof BenchmarkPercentiles
) => {
  return benchmarks[team.league]?.[team.season]?.[stat]?.[pct] ?? 0;
};

const getPercentileScore = (
  benchmarks: LeagueTeamBenchmarks,
  team: NormalizedTeamStats,
  stat: string
) => {
  const p10 = getBenchmarkThreshold(benchmarks, team, stat, 'P10');
  const p90 = getBenchmarkThreshold(benchmarks, team, stat, 'P90');
  const value = getStatValue(team, stat);
  if (!Number.isFinite(value) || !Number.isFinite(p10) || !Number.isFinite(p90) || p90 === p10) {
    return 50;
  }
  const score = ((value - p10) / (p90 - p10)) * 100;
  return clamp(score, 0, 100);
};

const scoreAbove = (benchmarks: LeagueTeamBenchmarks, team: NormalizedTeamStats, stat: string, score: number) =>
  getPercentileScore(benchmarks, team, stat) >= score;

const scoreBelow = (benchmarks: LeagueTeamBenchmarks, team: NormalizedTeamStats, stat: string, score: number) =>
  getPercentileScore(benchmarks, team, stat) <= score;

const getDominantAxis = (team: NormalizedTeamStats, benchmarks: LeagueTeamBenchmarks) => {
  const paceScore = getPercentileScore(benchmarks, team, 'pace');
  const twoRateScore = getPercentileScore(benchmarks, team, 'two_rate');
  const threeRateScore = getPercentileScore(benchmarks, team, 'three_rate');
  const ftRateScore = getPercentileScore(benchmarks, team, 'ft_rate');

  if (paceScore >= 70) return 'transition';
  if (threeRateScore >= 60) return 'periméter';
  if (twoRateScore >= 60 || ftRateScore >= 60) return 'festék';

  const maxScore = Math.max(paceScore, twoRateScore, threeRateScore);
  if (maxScore === paceScore) return 'transition';
  if (maxScore === threeRateScore) return 'periméter';
  return 'festék';
};

const buildTeamStyle = (team: NormalizedTeamStats, benchmarks: LeagueTeamBenchmarks) => {
  const offense: string[] = [];
  const defense: string[] = [];

  if (scoreAbove(benchmarks, team, 'pace', 75)) offense.push('Gyorsindítás-orientált');
  if (scoreBelow(benchmarks, team, 'pace', 40) && scoreAbove(benchmarks, team, 'assist_rate', 60)) {
    offense.push('Félpályás támadás');
  }
  if (scoreAbove(benchmarks, team, 'three_rate', 60) && scoreAbove(benchmarks, team, 'three_pct', 60)) {
    offense.push('Periméter-orientált');
  }
  if (scoreAbove(benchmarks, team, 'two_rate', 60) && scoreAbove(benchmarks, team, 'ft_rate', 60)) {
    offense.push('Festék-orientált');
  }

  if (scoreAbove(benchmarks, team, 'stl_per_game', 60)) defense.push('Labdanyomás');
  if (scoreAbove(benchmarks, team, 'blk_per_game', 60)) defense.push('Festékvédelem');
  if (scoreBelow(benchmarks, team, 'fouls_per_game', 40)) defense.push('Kevés faultos védekezés');

  return { offense, defense };
};

const computePlayerUsage = (player: PlayerSeasonStat) => {
  const fga = player.fga2 + player.fga3;
  return fga + 0.44 * player.fta + player.tov;
};

const computeUsageConcentration = (players: PlayerSeasonStat[]) => {
  const usage = players.map(computePlayerUsage).filter(v => Number.isFinite(v)).sort((a, b) => b - a);
  const total = usage.reduce((sum, v) => sum + v, 0) || 1;
  const top2 = usage.slice(0, 2).reduce((sum, v) => sum + v, 0);
  return round(top2 / total, 3);
};

const buildPositionComparison = (ownPlayers: PlayerSeasonStat[], opponentPlayers: PlayerSeasonStat[]) => {
  const positions: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];

  const aggregate = (players: PlayerSeasonStat[], position: Position) => {
    return players
      .filter(player => player.position === position)
      .reduce(
        (acc, player) => {
          acc.games += player.games || 0;
          acc.minutes += player.minutes || 0;
          acc.val += player.val || 0;
          acc.points += player.points || 0;
          return acc;
        },
        { games: 0, minutes: 0, val: 0, points: 0 }
      );
  };

  return positions.map(position => {
    const own = aggregate(ownPlayers, position);
    const opp = aggregate(opponentPlayers, position);

    const ownValPer36 = own.minutes > 0
      ? (own.val / own.minutes) * 36
      : own.games > 0
        ? own.val / own.games
        : 0;
    const oppValPer36 = opp.minutes > 0
      ? (opp.val / opp.minutes) * 36
      : opp.games > 0
        ? opp.val / opp.games
        : 0;
    const ownPointsPer36 = own.minutes > 0
      ? (own.points / own.minutes) * 36
      : own.games > 0
        ? own.points / own.games
        : 0;
    const oppPointsPer36 = opp.minutes > 0
      ? (opp.points / opp.minutes) * 36
      : opp.games > 0
        ? opp.points / opp.games
        : 0;

    return {
      position,
      ownValPer36: round(ownValPer36, 1),
      oppValPer36: round(oppValPer36, 1),
      ownPointsPer36: round(ownPointsPer36, 1),
      oppPointsPer36: round(oppPointsPer36, 1),
      deltaValPer36: round(ownValPer36 - oppValPer36, 1),
    };
  });
};

const identifyKeyPlayers = (players: PlayerSeasonStat[], teamUsageShare: number) => {
  const usageValues = players.map(computePlayerUsage).filter(v => Number.isFinite(v));
  const mean = usageValues.reduce((sum, v) => sum + v, 0) / (usageValues.length || 1);
  const variance = usageValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (usageValues.length || 1);
  const sd = Math.sqrt(variance);

  const primaryScorers: Array<{ name: string; score: number }> = [];
  const primaryPlaymakers: Array<{ name: string; score: number }> = [];
  const stretchThreats: Array<{ name: string; score: number }> = [];
  const mismatchCandidates: Array<{ name: string; score: number }> = [];

  const heightByPos = players.reduce((acc, player) => {
    if (player.heightCm && Number.isFinite(player.heightCm)) {
      acc[player.position] = acc[player.position] || { sum: 0, count: 0 };
      acc[player.position].sum += player.heightCm;
      acc[player.position].count += 1;
    }
    return acc;
  }, {} as Record<Position, { sum: number; count: number }>);

  const avgHeight = (pos: Position) => {
    const entry = heightByPos[pos];
    return entry && entry.count > 0 ? entry.sum / entry.count : null;
  };

  players.forEach(player => {
    const threePct = player.fga3 > 0 ? (player.fgm3 / player.fga3) * 100 : 0;
    const astTo = player.tov > 0 ? player.ast / player.tov : player.ast;
    const usage = computePlayerUsage(player);
    const posAvgHeight = avgHeight(player.position);

    if (usage > mean + sd) primaryScorers.push({ name: player.name, score: usage + player.val * 1.2 });
    if (player.ast >= 3 && astTo >= 1.6) {
      primaryPlaymakers.push({ name: player.name, score: player.ast * 1.6 + astTo * 2 });
    }
    if (player.fga3 >= 2 && threePct >= 38) {
      stretchThreats.push({ name: player.name, score: player.fga3 * 2 + threePct });
    }
    if (usage >= mean && player.val >= 10) {
      mismatchCandidates.push({ name: player.name, score: player.val + usage * 0.4 });
    }
    if (posAvgHeight && player.heightCm && player.heightCm >= posAvgHeight + 5) {
      mismatchCandidates.push({ name: `${player.name} (magassági előny)`, score: player.val + 8 });
    }
  });

  if (teamUsageShare >= 0.55 && primaryScorers.length === 0) {
    const topUsage = players.sort((a, b) => computePlayerUsage(b) - computePlayerUsage(a))[0];
    if (topUsage) primaryScorers.push({ name: topUsage.name, score: computePlayerUsage(topUsage) });
  }

  const pickTop = (items: Array<{ name: string; score: number }>) => {
    const unique = new Map<string, number>();
    items.forEach(item => {
      const current = unique.get(item.name) ?? -Infinity;
      if (item.score > current) unique.set(item.name, item.score);
    });
    return Array.from(unique.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name)
      .filter(Boolean);
  };

  return {
    primaryScorers: pickTop(primaryScorers),
    primaryPlaymakers: pickTop(primaryPlaymakers),
    stretchThreats: pickTop(stretchThreats),
    mismatchCandidates: pickTop(mismatchCandidates),
  };
};

const buildThreats = (team: NormalizedTeamStats, benchmarks: LeagueTeamBenchmarks, usageShare: number) => {
  const threats: string[] = [];
  if (scoreAbove(benchmarks, team, 'three_rate', 60)) {
    threats.push('Magas tripla-volumen → scoring variancia, run veszély');
  }
  if (scoreAbove(benchmarks, team, 'three_pct', 60)) {
    threats.push('Erős 3P-hatékonyság → gyors pontfutás kockázat');
  }
  if (scoreAbove(benchmarks, team, 'assist_rate', 60)) {
    threats.push('Szervezett labdajáratás → rotációs bontás veszély');
  }
  if (scoreAbove(benchmarks, team, 'efg', 60)) {
    threats.push('Hatékony dobás → félpályás megállítás nehezebb');
  }
  if (scoreAbove(benchmarks, team, 'two_rate', 60) && scoreAbove(benchmarks, team, 'ft_rate', 60)) {
    threats.push('Festékdomináns támadás → faultterhelés és belső nyomás');
  }
  if (scoreAbove(benchmarks, team, 'oreb_rate', 60)) {
    threats.push('Erős támadólepattanózás → második esély pontok veszélye');
  }
  if (usageShare >= 0.55) threats.push('Kulcsjátékos dominancia → fókuszált elfojtás szükséges');
  return threats;
};

const buildVulnerabilities = (team: NormalizedTeamStats, benchmarks: LeagueTeamBenchmarks) => {
  const vulnerabilities: string[] = [];
  if (scoreAbove(benchmarks, team, 'turnover_rate', 60)) vulnerabilities.push('Magas labdaeladás arány');
  if (scoreBelow(benchmarks, team, 'assist_rate', 40)) vulnerabilities.push('Alacsony assziszt-arány');
  if (scoreBelow(benchmarks, team, 'efg', 40)) vulnerabilities.push('Alacsony dobáshatékonyság');
  if (scoreBelow(benchmarks, team, 'ft_rate', 40)) vulnerabilities.push('Kevés büntető');
  if (scoreBelow(benchmarks, team, 'three_pct', 40)) vulnerabilities.push('Gyenge periméter-hatékonyság');
  if (scoreBelow(benchmarks, team, 'oreb_rate', 40)) vulnerabilities.push('Gyenge támadólepattanózás');
  return vulnerabilities;
};

const buildFocusPoints = (
  opponent: NormalizedTeamStats,
  ownTeam: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks,
  xFactors?: XFactorInsight
) => {
  const focus: string[] = [];

  if (scoreAbove(benchmarks, opponent, 'three_rate', 60)) {
    focus.push('Periméter-védekezés kiemelt, contest a triplákon');
  }
  if (scoreAbove(benchmarks, opponent, 'three_pct', 60)) {
    focus.push('Closeout fegyelem, ne engedj tiszta triplát');
  }
  if (scoreAbove(benchmarks, opponent, 'ft_rate', 60)) {
    focus.push('Foul-limitáció, betörések védése');
  }
  if (scoreAbove(benchmarks, opponent, 'two_rate', 60)) {
    focus.push('Festékzárás, help rotációk gyorsítása');
  }
  if (scoreAbove(benchmarks, opponent, 'assist_rate', 60)) {
    focus.push('Labdajáratás bontása, passzsávok zárása');
  }
  if (scoreAbove(benchmarks, opponent, 'turnover_rate', 60)) {
    focus.push('Nyomás alatt labdaeladás kényszerítése');
  }

  if (scoreAbove(benchmarks, ownTeam, 'pace', 60) && scoreBelow(benchmarks, opponent, 'pace', 40)) {
    focus.push('Gyorsabb tempó erőltetése');
  }
  if (scoreAbove(benchmarks, ownTeam, 'assist_rate', 60) && scoreBelow(benchmarks, opponent, 'assist_rate', 40)) {
    focus.push('Labdajáratásból előny építése');
  }

  if (scoreBelow(benchmarks, opponent, 'three_pct', 40) && scoreAbove(benchmarks, ownTeam, 'three_rate', 60)) {
    focus.push('Külső dobóterhelés növelése (opp gyenge periméter-hatékonyság)');
  }
  if (scoreBelow(benchmarks, opponent, 'turnover_rate', 40) && scoreAbove(benchmarks, ownTeam, 'turnover_rate', 60)) {
    focus.push('Labdabiztonság kiemelt, az ellenfél védekezése nem kényszerít TO-t');
  }
  if (scoreAbove(benchmarks, opponent, 'turnover_rate', 60) && scoreAbove(benchmarks, ownTeam, 'stl_per_game', 60)) {
    focus.push('Labdaszerzés maximalizálása, agresszív nyomás engedhető');
  }
  if (scoreBelow(benchmarks, opponent, 'two_rate', 40) && scoreAbove(benchmarks, ownTeam, 'two_rate', 60)) {
    focus.push('Festékelőny erőltetése (opp alacsony 2P-fókusz)');
  }

  if (scoreAbove(benchmarks, opponent, 'stl_per_game', 60) && scoreAbove(benchmarks, ownTeam, 'turnover_rate', 50)) {
    focus.push('Labdabiztonság vs labdanyomás, egyszerűsített döntések, press break');
  }
  if (scoreAbove(benchmarks, ownTeam, 'oreb_rate', 60) && scoreBelow(benchmarks, opponent, 'oreb_rate', 40)) {
    focus.push('OREB agresszivitás növelése, második esélyek kihasználása');
  }

  if (xFactors && !focus.some(item => item.startsWith('Ha '))) {
    focus.push(`Ha ${xFactors.primary.short} nem működik → ${xFactors.secondary.short}`);
  }

  const uniqueFocus = Array.from(new Set(focus));
  return uniqueFocus.slice(0, 5);
};

const buildRiskNotes = (
  opponent: NormalizedTeamStats,
  ownTeam: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks
) => {
  const riskFlags: string[] = [];

  if (scoreAbove(benchmarks, opponent, 'ft_rate', 65)) {
    riskFlags.push('FT-rate volumen kockázat (fault + vonal)');
  }
  if (scoreAbove(benchmarks, opponent, 'oreb_rate', 65)) {
    riskFlags.push('OREB volumen kockázat (második esélyek)');
  }
  if (scoreAbove(benchmarks, opponent, 'stl_per_game', 60) && scoreAbove(benchmarks, ownTeam, 'turnover_rate', 50)) {
    riskFlags.push('Labdabiztonsági kockázat (nyomás alatti TO)');
  }

  return {
    note: riskFlags.length > 0 ? `Kockázati jelzők: ${riskFlags.join(', ')}.` : '',
    flags: riskFlags,
  };
};

const buildTempoControlNote = (
  opponent: NormalizedTeamStats,
  ownTeam: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks
) => {
  const dominantAxis = getDominantAxis(opponent, benchmarks);
  if (dominantAxis !== 'transition') return '';

  const opponentPaceScore = getPercentileScore(benchmarks, opponent, 'pace');
  if (opponentPaceScore < 65) return '';

  const ownPaceScore = getPercentileScore(benchmarks, ownTeam, 'pace');
  return ownPaceScore <= 45
    ? 'Kontrollált tempó kockázat: transition-orientált ellenfél, futások megfékezése kulcs.'
    : 'Tempó-run kontroll: futások kezelése és defensive balance kiemelt feladat.';
};

const buildMatchupRealizationNote = (
  positionComparison: PositionComparison[],
  profile: ReturnType<typeof buildTeamStyle>
) => {
  const perimeterDelta = positionComparison
    .filter(item => ['PG', 'SG', 'SF'].includes(item.position))
    .reduce((sum, item) => sum + item.deltaValPer36, 0);
  const frontcourtDelta = positionComparison
    .filter(item => ['PF', 'C'].includes(item.position))
    .reduce((sum, item) => sum + item.deltaValPer36, 0);

  const notes: string[] = [];
  if (perimeterDelta >= 3 && profile.defense.includes('Labdanyomás')) {
    notes.push('Periméter előny csak stabil labdabiztonsággal és spacinggel realizálható (ellenfél labdanyomás).');
  }
  if (frontcourtDelta >= 3 && (profile.defense.includes('Festékvédelem') || profile.defense.includes('Kevés faultos védekezés'))) {
    notes.push('Frontcourt előny kihasználása spacinget és faultkikényszerítést igényel (festékvédelem).');
  }

  return notes.join(' ');
};

const buildXFactors = (
  opponent: NormalizedTeamStats,
  ownTeam: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks,
  threats: string[],
  vulnerabilities: string[]
): XFactorInsight => {
  const candidates: XFactorCandidate[] = [];

  const hasPerimeterThreat = threats.some(item => item.includes('tripla') || item.includes('3P'));
  const hasTurnoverWeakness = vulnerabilities.some(item => item.toLowerCase().includes('labdaeladás'));
  const hasReboundWeakness = vulnerabilities.some(item => item.toLowerCase().includes('lepattanó'));
  const tempoScore = getPercentileScore(benchmarks, opponent, 'pace');

  if (hasPerimeterThreat) {
    candidates.push({ key: 'perimeter', label: 'periméter kontrollja és tripla-variancia kezelése', short: 'periméter kontroll' });
  }
  if (hasTurnoverWeakness) {
    candidates.push({ key: 'turnover', label: 'labdaszerzések és extra támadások menedzselése', short: 'labdaszerzés / extra támadások' });
  }
  if (hasReboundWeakness) {
    candidates.push({ key: 'rebound', label: 'második esélyek és lepattanó kontroll', short: 'lepattanó kontroll' });
  }
  if (tempoScore >= 70) {
    candidates.push({ key: 'tempo', label: 'transition-run kontroll és visszarendeződés', short: 'tempó kontroll' });
  }

  const defaultCandidate = { key: 'paint', label: 'festék kontrollja és faultterhelés menedzselése', short: 'festék kontroll' };
  if (!candidates.some(item => item.key === defaultCandidate.key)) {
    candidates.push(defaultCandidate);
  }

  const primary = candidates[0];
  const secondary = candidates.find(item => item.key !== primary.key) || defaultCandidate;

  return { primary, secondary };
};

const buildSummary = (
  opponent: NormalizedTeamStats,
  profile: ReturnType<typeof buildTeamStyle>,
  threats: string[],
  vulnerabilities: string[],
  benchmarks: LeagueTeamBenchmarks,
  winProbability: ScoutingReport['winProbability'],
  positionComparison: PositionComparison[],
  xFactors: XFactorInsight,
  riskNoteText: string,
  matchupRealizationNote: string,
  tempoControlNote: string
) => {
  const tempo = opponent.pace >= 70 ? 'gyors tempójú' : opponent.pace <= 60 ? 'lassú tempójú' : 'közepes tempójú';
  const offense = profile.offense.length > 0 ? profile.offense.join(', ') : 'kiegyensúlyozott';
  const defense = profile.defense.length > 0 ? profile.defense.join(', ') : 'kiegyensúlyozott';
  const dominantAxis = getDominantAxis(opponent, benchmarks);
  const axisLabel = dominantAxis === 'transition'
    ? 'transition'
    : dominantAxis === 'periméter'
      ? 'periméter'
      : 'festék';
  const axisText = `Domináns tengely: ${axisLabel}.`;

  const threatText = threats.length > 0
    ? `Fő támadó veszélyek: ${threats.join(', ')}.`
    : 'Nincs kiemelt támadó veszély.';
  const vulnText = vulnerabilities.length > 0
    ? `Sebezhetőségek: ${vulnerabilities.join(', ')}.`
    : 'Nincs kiemelt sebezhetőség.';

  const perimeterDelta = positionComparison
    .filter(item => ['PG', 'SG', 'SF'].includes(item.position))
    .reduce((sum, item) => sum + item.deltaValPer36, 0);
  const frontcourtDelta = positionComparison
    .filter(item => ['PF', 'C'].includes(item.position))
    .reduce((sum, item) => sum + item.deltaValPer36, 0);
  const posSummary = perimeterDelta >= 3 && frontcourtDelta <= -1
    ? 'Periméteren saját előny (PG–SG–SF), az ellenfél előnye inkább a frontcourtban jelentkezik.'
    : frontcourtDelta >= 3 && perimeterDelta <= -1
      ? 'Frontcourt előny (PF–C), periméteren óvatos matchup szükséges.'
      : 'Pozíciós előnyök elosztottak, matchup-alapú döntés javasolt.';

  const probabilityNote = `A statisztikai esély (${winProbability.ownPct}% / ${winProbability.opponentPct}%) nem jelent biztos kimenetet; taktikai kockázatok döntőek.`;

  const varianceNote = scoreAbove(benchmarks, opponent, 'three_rate', 60)
    ? 'Magas tripla-volumen miatt a variancia nagyobb, run-ok gyorsan dönthetnek.'
    : '';

  const xFactorText = `Elsődleges X-faktor: ${xFactors.primary.label}. Másodlagos: ${xFactors.secondary.label}.`;
  const tempoNote = tempoControlNote ? ` ${tempoControlNote}` : '';
  const riskNote = riskNoteText ? ` ${riskNoteText}` : '';
  const matchupNote = matchupRealizationNote ? ` ${matchupRealizationNote}` : '';

  return `Az ellenfél ${tempo}, ${offense} támadást játszik, védekezésben ${defense} jellegű. ${axisText} ${threatText} ${vulnText} ${posSummary} ${probabilityNote} ${varianceNote} ${xFactorText}${tempoNote}${riskNote}${matchupNote}`.trim();
};

const computeTeamRating = (team: NormalizedTeamStats, benchmarks: LeagueTeamBenchmarks) => {
  const metrics = [
    { stat: 'efg', weight: 1.4, invert: false },
    { stat: 'turnover_rate', weight: 1.2, invert: true },
    { stat: 'assist_rate', weight: 1.0, invert: false },
    { stat: 'oreb_rate', weight: 0.6, invert: false },
    { stat: 'ft_rate', weight: 0.6, invert: false },
    { stat: 'three_pct', weight: 0.8, invert: false },
    { stat: 'val_per_game', weight: 1.4, invert: false },
    { stat: 'stl_per_game', weight: 0.5, invert: false },
    { stat: 'blk_per_game', weight: 0.4, invert: false },
    { stat: 'fouls_per_game', weight: 0.4, invert: true },
  ];

  const totalWeight = metrics.reduce((sum, metric) => sum + metric.weight, 0) || 1;
  const weightedScore = metrics.reduce((sum, metric) => {
    const percentile = getPercentileScore(benchmarks, team, metric.stat);
    const score = metric.invert ? 100 - percentile : percentile;
    return sum + score * metric.weight;
  }, 0);

  return weightedScore / totalWeight;
};

const computeWinProbability = (
  ownTeam: NormalizedTeamStats,
  opponentTeam: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks
) => {
  const ownRating = computeTeamRating(ownTeam, benchmarks);
  const opponentRating = computeTeamRating(opponentTeam, benchmarks);
  const diff = ownRating - opponentRating;

  const ownThreeRateScore = getPercentileScore(benchmarks, ownTeam, 'three_rate');
  const oppThreeRateScore = getPercentileScore(benchmarks, opponentTeam, 'three_rate');
  const volatilityFactor = ownThreeRateScore >= 70 || oppThreeRateScore >= 70 ? 0.9 : 1;

  const adjustedDiff = diff * volatilityFactor;
  const probability = 1 / (1 + Math.exp(-adjustedDiff / 18));
  const ownPct = clamp(probability, 0.08, 0.92) * 100;
  const opponentPct = 100 - ownPct;
  const absDiff = Math.abs(adjustedDiff);

  let confidence: 'Low' | 'Medium' | 'High' = absDiff >= 16
    ? 'High'
    : absDiff >= 8
      ? 'Medium'
      : 'Low';

  const minGames = Math.min(ownTeam.games || 0, opponentTeam.games || 0);
  if (minGames < 10 && confidence === 'High') {
    confidence = 'Medium';
  }
  if (volatilityFactor < 1 && confidence === 'High') {
    confidence = 'Medium';
  }

  const predictedWinner: 'own' | 'opponent' | 'even' = absDiff < 2
    ? 'even'
    : diff > 0
      ? 'own'
      : 'opponent';

  return {
    ownPct: round(ownPct, 1),
    opponentPct: round(opponentPct, 1),
    predictedWinner,
    confidence,
  };
};

export const analyzePreGameScouting = (
  opponentTeam: TeamSeasonStat,
  opponentPlayers: PlayerSeasonStat[],
  ownTeam: TeamSeasonStat,
  leagueBenchmarks: LeagueTeamBenchmarks,
  ownPlayers: PlayerSeasonStat[] = []
): ScoutingReport => {
  const normalizedOpponent = normalizeTeamStats(opponentTeam);
  const normalizedOwn = normalizeTeamStats(ownTeam);

  const profile = buildTeamStyle(normalizedOpponent, leagueBenchmarks);
  const usageShare = computeUsageConcentration(opponentPlayers);
  const keyPlayers = identifyKeyPlayers(opponentPlayers, usageShare);

  const ownHeightByPos = ownPlayers.reduce((acc, player) => {
    if (player.heightCm && Number.isFinite(player.heightCm)) {
      acc[player.position] = acc[player.position] || { sum: 0, count: 0 };
      acc[player.position].sum += player.heightCm;
      acc[player.position].count += 1;
    }
    return acc;
  }, {} as Record<Position, { sum: number; count: number }>);

  const opponentHeightByPos = opponentPlayers.reduce((acc, player) => {
    if (player.heightCm && Number.isFinite(player.heightCm)) {
      acc[player.position] = acc[player.position] || { sum: 0, count: 0 };
      acc[player.position].sum += player.heightCm;
      acc[player.position].count += 1;
    }
    return acc;
  }, {} as Record<Position, { sum: number; count: number }>);

  const avgHeight = (map: Record<Position, { sum: number; count: number }>, pos: Position) => {
    const entry = map[pos];
    return entry && entry.count > 0 ? entry.sum / entry.count : null;
  };

  const heightMismatchNotes: string[] = [];
  (['PG', 'SG', 'SF', 'PF', 'C'] as Position[]).forEach(pos => {
    const ownAvg = avgHeight(ownHeightByPos, pos);
    const oppAvg = avgHeight(opponentHeightByPos, pos);
    if (ownAvg && oppAvg && oppAvg - ownAvg >= 4) {
      heightMismatchNotes.push(`Magassági hátrány a ${pos} poszton (≈${round(oppAvg - ownAvg, 1)} cm).`);
    }
  });
  const threats = buildThreats(normalizedOpponent, leagueBenchmarks, usageShare);
  const vulnerabilities = buildVulnerabilities(normalizedOpponent, leagueBenchmarks);
  const positionComparison = buildPositionComparison(ownPlayers, opponentPlayers);
  const winProbability = computeWinProbability(normalizedOwn, normalizedOpponent, leagueBenchmarks);
  const xFactors = buildXFactors(normalizedOpponent, normalizedOwn, leagueBenchmarks, threats, vulnerabilities);
  const riskNotes = buildRiskNotes(normalizedOpponent, normalizedOwn, leagueBenchmarks);
  const tempoControlNote = buildTempoControlNote(normalizedOpponent, normalizedOwn, leagueBenchmarks);
  const matchupRealizationNote = buildMatchupRealizationNote(positionComparison, profile);
  const focusPoints = buildFocusPoints(normalizedOpponent, normalizedOwn, leagueBenchmarks, xFactors);
  const xFactorContext: PreGameXFactorContext = {
    primaryKey: xFactors.primary.key,
    primaryLabel: xFactors.primary.label,
    secondaryKey: xFactors.secondary?.key,
    secondaryLabel: xFactors.secondary?.label,
    riskFlags: riskNotes.flags,
  };

  return {
    opponentTeamId: opponentTeam.teamId,
    opponentTeamName: opponentTeam.teamName,
    league: opponentTeam.league,
    season: opponentTeam.season,
    winProbability,
    positionComparison,
    profile: {
      tempo: normalizedOpponent.pace >= 70 ? 'Magas' : normalizedOpponent.pace <= 60 ? 'Alacsony' : 'Közepes',
      offense: profile.offense,
      defense: profile.defense,
    },
    threats,
    vulnerabilities,
    keyPlayers: {
      ...keyPlayers,
      mismatchCandidates: [...keyPlayers.mismatchCandidates, ...heightMismatchNotes].slice(0, 4),
    },
    focusPoints,
    xFactorContext,
    summary: buildSummary(
      normalizedOpponent,
      profile,
      threats,
      vulnerabilities,
      leagueBenchmarks,
      winProbability,
      positionComparison,
      xFactors,
      riskNotes.note,
      matchupRealizationNote,
      tempoControlNote
    ),
  };
};
