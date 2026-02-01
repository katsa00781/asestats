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
  opponent: {
    fga2: number;
    fgm2: number;
    fga3: number;
    fgm3: number;
    fta: number;
    ftm: number;
    oreb: number;
    dreb: number;
    tov: number;
  };
  roster: Array<{
    playerId: string;
    name: string;
    position: Position;
    minutes: number;
    usageProxy: number;
    heightCm?: number;
    roles: string[];
  }>;
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
  opp2Pct: number;
  opp3Pct: number;
  oppTurnoverRate: number;
  hasOpponentShooting: boolean;
  hasOpponentReb: boolean;
  hasOpponentTo: boolean;
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

export type TeamStyle = {
  offense: string[];
  defense: string[];
};

export type RosterFlags = {
  scorerDependency: boolean;
  lowPlaymakingDepth: boolean;
  weakReboundingPresence: boolean;
};

export type TeamAnalysis = {
  teamId: string;
  teamName: string;
  league: string;
  season: string;
  style: TeamStyle;
  strengths: string[];
  limitations: string[];
  rosterSummary: {
    positionMinutesShare: Record<Position, number>;
    roleCounts: Record<string, number>;
    top2UsageShare: number;
    flags: RosterFlags;
    avgHeightByPosition: Record<Position, number | null>;
    avgHeightOverall: number | null;
  };
  rosterInsights: string[];
  summary: string;
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
      return team.orebRate;
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
    case 'opp2_pct':
      return team.opp2Pct;
    case 'opp3_pct':
      return team.opp3Pct;
    case 'opp_to_rate':
      return team.oppTurnoverRate;
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

export const normalizeTeamStats = (raw: TeamSeasonStat): NormalizedTeamStats => {
  const games = raw.games || 1;
  const fga = raw.fga2 + raw.fga3;
  const fgm = raw.fgm2 + raw.fgm3;
  const hasOpponentShooting = raw.opponent.fga2 + raw.opponent.fga3 > 0;
  const hasOpponentReb = raw.opponent.dreb + raw.opponent.oreb > 0;
  const hasOpponentTo = raw.opponent.tov > 0;
  const pace = (fga + 0.44 * raw.fta + raw.tov) / games;
  const assistRate = fga > 0 ? raw.ast / fga : 0;
  const turnoverRate = pace > 0 ? (raw.tov / games) / pace : 0;
  const orebDenominator = raw.oreb + raw.opponent.dreb;
  const orebRate = orebDenominator > 0 ? raw.oreb / orebDenominator : 0;
  const twoRate = fga > 0 ? raw.fga2 / fga : 0;
  const threeRate = fga > 0 ? raw.fga3 / fga : 0;
  const threePct = raw.fga3 > 0 ? (raw.fgm3 / raw.fga3) * 100 : 0;
  const ftRate = fga > 0 ? raw.fta / fga : 0;
  const efg = fga > 0 ? ((fgm + 0.5 * raw.fgm3) / fga) * 100 : 0;
  const valPerGame = raw.val / games;
  const opp2Pct = raw.opponent.fga2 > 0 ? (raw.opponent.fgm2 / raw.opponent.fga2) * 100 : 0;
  const opp3Pct = raw.opponent.fga3 > 0 ? (raw.opponent.fgm3 / raw.opponent.fga3) * 100 : 0;
  const oppPace = (raw.opponent.fga2 + raw.opponent.fga3 + 0.44 * raw.opponent.fta + raw.opponent.tov) / games;
  const oppTurnoverRate = oppPace > 0 ? (raw.opponent.tov / games) / oppPace : 0;

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
    opp2Pct: round(opp2Pct, 1),
    opp3Pct: round(opp3Pct, 1),
    oppTurnoverRate: round(oppTurnoverRate, 3),
    hasOpponentShooting,
    hasOpponentReb,
    hasOpponentTo,
  };
};

const STAT_KEYS = [
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
  'opp2_pct',
  'opp3_pct',
  'opp_to_rate',
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
      STAT_KEYS.forEach(stat => {
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

const detectTeamStyle = (team: NormalizedTeamStats, benchmarks: LeagueTeamBenchmarks): TeamStyle => {
  const offense: string[] = [];
  const defense: string[] = [];

  if (
    scoreAbove(benchmarks, team, 'pace', 75)
    && (scoreAbove(benchmarks, team, 'stl_per_game', 60)
      || (team.hasOpponentTo && scoreAbove(benchmarks, team, 'opp_to_rate', 60)))
  ) {
    offense.push('Gyorsindítás-orientált');
  }
  if (scoreBelow(benchmarks, team, 'pace', 40) && scoreAbove(benchmarks, team, 'assist_rate', 60)) {
    offense.push('Félpályás támadás');
  }
  if (scoreAbove(benchmarks, team, 'three_rate', 60) && scoreAbove(benchmarks, team, 'three_pct', 60)) {
    offense.push('Periméter-orientált');
  }
  if (scoreAbove(benchmarks, team, 'two_rate', 60) && scoreAbove(benchmarks, team, 'ft_rate', 60)) {
    offense.push('Festék-orientált');
  }

  if (team.hasOpponentTo && scoreAbove(benchmarks, team, 'stl_per_game', 60) && scoreAbove(benchmarks, team, 'opp_to_rate', 60)) {
    defense.push('Agresszív védekezés');
  }
  if (scoreBelow(benchmarks, team, 'fouls_per_game', 40) && scoreBelow(benchmarks, team, 'pace', 40)) {
    defense.push('Konzervatív védekezés');
  }
  if (team.hasOpponentShooting && scoreAbove(benchmarks, team, 'blk_per_game', 60) && scoreBelow(benchmarks, team, 'opp2_pct', 40)) {
    defense.push('Gyűrűvédő');
  }
  if (team.hasOpponentShooting && scoreBelow(benchmarks, team, 'opp3_pct', 40)) {
    defense.push('Periméter-fókuszú');
  }

  return { offense, defense };
};

const buildRosterSummary = (team: NormalizedTeamStats) => {
  const totalMinutes = team.roster.reduce((sum, p) => sum + p.minutes, 0) || 1;
  const positionMinutesShare: Record<Position, number> = {
    PG: 0,
    SG: 0,
    SF: 0,
    PF: 0,
    C: 0,
  };

  const heightTotals: Record<Position, { sum: number; count: number }> = {
    PG: { sum: 0, count: 0 },
    SG: { sum: 0, count: 0 },
    SF: { sum: 0, count: 0 },
    PF: { sum: 0, count: 0 },
    C: { sum: 0, count: 0 },
  };
  let heightSum = 0;
  let heightCount = 0;

  const roleCounts: Record<string, number> = {};
  team.roster.forEach(player => {
    positionMinutesShare[player.position] += player.minutes;
    if (player.heightCm && Number.isFinite(player.heightCm)) {
      heightTotals[player.position].sum += player.heightCm;
      heightTotals[player.position].count += 1;
      heightSum += player.heightCm;
      heightCount += 1;
    }
    player.roles.forEach(role => {
      roleCounts[role] = (roleCounts[role] ?? 0) + 1;
    });
  });

  (Object.keys(positionMinutesShare) as Position[]).forEach(pos => {
    positionMinutesShare[pos] = round((positionMinutesShare[pos] / totalMinutes) * 100, 1);
  });

  const sortedUsage = [...team.roster]
    .map(p => p.usageProxy)
    .filter(v => Number.isFinite(v))
    .sort((a, b) => b - a);
  const totalUsage = sortedUsage.reduce((sum, v) => sum + v, 0) || 1;
  const top2Usage = sortedUsage.slice(0, 2).reduce((sum, v) => sum + v, 0);
  const top2UsageShare = round(top2Usage / totalUsage, 3);

  const creatorRoles = ['Primary Ball Handler', 'Secondary Creator', 'Secondary Playmaker'];
  const creators = team.roster.filter(player => player.roles.some(role => creatorRoles.includes(role))).length;

  const bigShare = (positionMinutesShare.PF + positionMinutesShare.C) / 100;

  const flags: RosterFlags = {
    scorerDependency: top2UsageShare >= 0.55,
    lowPlaymakingDepth: creators < 2,
    weakReboundingPresence: bigShare < 0.35,
  };

  const avgHeightByPosition = (Object.keys(heightTotals) as Position[]).reduce(
    (acc, pos) => {
      const entry = heightTotals[pos];
      acc[pos] = entry.count > 0 ? round(entry.sum / entry.count, 1) : null;
      return acc;
    },
    {
      PG: null,
      SG: null,
      SF: null,
      PF: null,
      C: null,
    } as Record<Position, number | null>
  );

  const avgHeightOverall = heightCount > 0 ? round(heightSum / heightCount, 1) : null;

  return {
    positionMinutesShare,
    roleCounts,
    top2UsageShare,
    flags,
    avgHeightByPosition,
    avgHeightOverall,
  };
};

const buildRosterInsights = (roster: ReturnType<typeof buildRosterSummary>) => {
  const insights: string[] = [];

  const guardShare = roster.positionMinutesShare.PG + roster.positionMinutesShare.SG;
  const wingShare = roster.positionMinutesShare.SF;
  const bigShare = roster.positionMinutesShare.PF + roster.positionMinutesShare.C;

  if (bigShare >= 60) {
    insights.push('Erősen magas poszt-orientált (festékdomináns) struktúra.');
  }
  if (guardShare <= 20) {
    insights.push('Kevés guard perc, a periméter-kezdeményezés korlátozott lehet.');
  }
  if (wingShare <= 10) {
    insights.push('Alacsony wing jelenlét, perimétervédekezés sebezhető lehet.');
  }

  const creators = (roster.roleCounts['Primary Ball Handler'] || 0)
    + (roster.roleCounts['Secondary Creator'] || 0)
    + (roster.roleCounts['Secondary Playmaker'] || 0);
  if (creators <= 1) {
    insights.push('Kevés elsődleges/second playmaker, támadás könnyen beszűkülhet.');
  }

  const rollMen = roster.roleCounts['Roll Man'] || 0;
  const stretchBigs = (roster.roleCounts['Stretch 5'] || 0) + (roster.roleCounts['Stretch 4'] || 0);
  const rimProtectors = roster.roleCounts['Rim Protector'] || 0;

  if (rollMen >= 2) {
    insights.push('Erős pick-and-roll befejező mélység (Roll Man szerepkörök).');
  }
  if (stretchBigs >= 2) {
    insights.push('Több külső dobó magas, jobb spacing potenciál.');
  }
  if (rimProtectors >= 2) {
    insights.push('Festékvédekezésben több rim protector opció.');
  }

  const avgPG = roster.avgHeightByPosition.PG;
  const avgSG = roster.avgHeightByPosition.SG;
  const avgC = roster.avgHeightByPosition.C;

  if (avgPG && avgPG >= 190) {
    insights.push('Magas irányító rotáció (posztátlag alapján).');
  }
  if (avgSG && avgSG >= 193) {
    insights.push('Magas dobóhátvéd sor, periméteren méretelőny lehet.');
  }
  if (avgC && avgC <= 204) {
    insights.push('Relatíve alacsony center rotáció, magas poszton mismatch kockázat.');
  }

  return insights.slice(0, 4);
};

const strengthLabels: Record<string, string> = {
  pace: 'Magas tempó',
  assist_rate: 'Magas assziszt-arány',
  oreb_rate: 'Erős támadólepattanózás',
  two_rate: 'Magas 2P-arány',
  three_rate: 'Magas triplavolumen',
  three_pct: 'Magas 3P%',
  ft_rate: 'Sok büntető',
  efg: 'Hatékony dobás',
  val_per_game: 'Magas VAL',
  opp2_pct: 'Festékvédekezés',
  opp3_pct: 'Perimétervédekezés',
  opp_to_rate: 'Labdaszerzés/nyomás',
};

const limitationLabels: Record<string, string> = {
  pace: 'Alacsony tempó',
  assist_rate: 'Alacsony assziszt-arány',
  turnover_rate: 'Magas eladott labda arány',
  oreb_rate: 'Gyenge támadólepattanózás',
  two_rate: 'Alacsony 2P-arány',
  three_rate: 'Alacsony triplavolumen',
  three_pct: 'Alacsony 3P%',
  ft_rate: 'Kevés büntető',
  efg: 'Alacsony dobáshatékonyság',
  val_per_game: 'Alacsony VAL',
  opp2_pct: 'Festék sebezhető',
  opp3_pct: 'Periméter sebezhető',
};

const buildStrengths = (team: NormalizedTeamStats, benchmarks: LeagueTeamBenchmarks) => {
  return Object.keys(strengthLabels)
    .filter(stat => {
      if (stat === 'oreb_rate' && !team.hasOpponentReb) return false;
      if ((stat === 'opp2_pct' || stat === 'opp3_pct') && !team.hasOpponentShooting) return false;
      if (stat === 'opp_to_rate' && !team.hasOpponentTo) return false;
      return scoreAbove(benchmarks, team, stat, 60);
    })
    .map(stat => strengthLabels[stat])
    .slice(0, 4);
};

const buildLimitations = (team: NormalizedTeamStats, benchmarks: LeagueTeamBenchmarks) => {
  return Object.keys(limitationLabels)
    .filter(stat => {
      if (stat === 'oreb_rate' && !team.hasOpponentReb) return false;
      if ((stat === 'opp2_pct' || stat === 'opp3_pct') && !team.hasOpponentShooting) return false;
      if (stat === 'opp_to_rate' && !team.hasOpponentTo) return false;
      return scoreBelow(benchmarks, team, stat, 40);
    })
    .map(stat => limitationLabels[stat])
    .slice(0, 4);
};

const buildSummary = (
  team: NormalizedTeamStats,
  style: TeamStyle,
  roster: ReturnType<typeof buildRosterSummary>,
  rosterInsights: string[]
) => {
  const tempo = team.pace >= 70 ? 'magas tempójú' : team.pace <= 60 ? 'alacsony tempójú' : 'közepes tempójú';
  const offense = style.offense[0] ?? 'kiegyensúlyozott támadás';
  const defense = style.defense[0] ?? 'kiegyensúlyozott védekezés';

  const rosterNotes: string[] = [];
  if (roster.flags.scorerDependency) rosterNotes.push('magas a top2 usage koncentráció');
  if (roster.flags.lowPlaymakingDepth) rosterNotes.push('kevés a playmaking mélység');
  if (roster.flags.weakReboundingPresence) rosterNotes.push('korlátozott a magas posztok jelenléte');

  const rosterSentence = rosterNotes.length > 0
    ? `Roster szempontból ${rosterNotes.join(', ')}.`
    : 'Roster szempontból nincs kiugró kockázat.';

  const rosterInsightSentence = rosterInsights.length > 0
    ? ` ${rosterInsights.join(' ')}`
    : '';

  const defenseNote = team.hasOpponentShooting && team.hasOpponentTo
    ? ''
    : ' Opponent statisztikák hiányosak, védekezési profil korlátozott.';

  return `A csapat ${tempo}, ${offense} fókuszú támadást játszik. Védekezésben ${defense} karakterű. ${rosterSentence}${rosterInsightSentence}${defenseNote}`;
};

export const analyzeTeamSeason = (
  raw: TeamSeasonStat,
  benchmarks: LeagueTeamBenchmarks
): TeamAnalysis => {
  const normalized = normalizeTeamStats(raw);
  const style = detectTeamStyle(normalized, benchmarks);
  const rosterSummary = buildRosterSummary(normalized);
  const rosterInsights = buildRosterInsights(rosterSummary);
  const strengths = buildStrengths(normalized, benchmarks);
  const limitations = buildLimitations(normalized, benchmarks);

  return {
    teamId: raw.teamId,
    teamName: raw.teamName,
    league: raw.league,
    season: raw.season,
    style,
    strengths,
    limitations,
    rosterSummary,
    rosterInsights,
    summary: buildSummary(normalized, style, rosterSummary, rosterInsights),
  };
};
