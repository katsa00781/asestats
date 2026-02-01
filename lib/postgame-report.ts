export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C';

export type TeamGameStat = {
  teamId: string;
  teamName: string;
  league: string;
  season: string;
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

export type PlayerGameStat = {
  playerId: string;
  name: string;
  position: Position;
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

export type PostGameReport = {
  teamId: string;
  teamName: string;
  opponentName: string;
  league: string;
  season: string;
  result: 'win' | 'loss';
  context: {
    paceDelta: 'Higher' | 'Lower' | 'Similar';
    offenseEfficiencyDelta: 'Higher' | 'Lower' | 'Similar';
    defenseEfficiencyDelta: 'Higher' | 'Lower' | 'Similar';
  };
  dataNotes: string[];
  decisiveFactors: {
    offense: string[];
    defense: string[];
  };
  playerImpact: {
    positive: string[];
    negative: string[];
    overperformers: string[];
    underperformers: string[];
  };
  strengths: string[];
  problems: string[];
  nextFocus: string[];
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

export type NormalizedTeamStats = TeamSeasonStat & {
  fga: number;
  fgm: number;
  pace: number;
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

export type NormalizedGameStats = TeamGameStat & {
  fga: number;
  fgm: number;
  pace: number;
  assistRate: number;
  turnoverRate: number;
  orebRate: number;
  twoRate: number;
  threeRate: number;
  threePct: number;
  ftRate: number;
  efg: number;
};

const normalizeTeamSeason = (raw: TeamSeasonStat): NormalizedTeamStats => {
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

const normalizeTeamGame = (raw: TeamGameStat, opponent: TeamGameStat): NormalizedGameStats => {
  const fga = raw.fga2 + raw.fga3;
  const fgm = raw.fgm2 + raw.fgm3;
  const pace = fga + 0.44 * raw.fta + raw.tov;
  const assistRate = fga > 0 ? raw.ast / fga : 0;
  const turnoverRate = pace > 0 ? raw.tov / pace : 0;
  const orebRate = (raw.oreb + opponent.dreb) > 0 ? raw.oreb / (raw.oreb + opponent.dreb) : 0;
  const twoRate = fga > 0 ? raw.fga2 / fga : 0;
  const threeRate = fga > 0 ? raw.fga3 / fga : 0;
  const threePct = raw.fga3 > 0 ? (raw.fgm3 / raw.fga3) * 100 : 0;
  const ftRate = fga > 0 ? raw.fta / fga : 0;
  const efg = fga > 0 ? ((fgm + 0.5 * raw.fgm3) / fga) * 100 : 0;

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
];

export const buildTeamBenchmarks = (teams: TeamSeasonStat[]): LeagueTeamBenchmarks => {
  const normalized = teams.map(normalizeTeamSeason);
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
          .map(team => getTeamStatValue(team, stat))
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

const getTeamStatValue = (team: NormalizedTeamStats, stat: string) => {
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
    default:
      return 0;
  }
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
  stat: string,
  value: number
) => {
  const p10 = getBenchmarkThreshold(benchmarks, team, stat, 'P10');
  const p90 = getBenchmarkThreshold(benchmarks, team, stat, 'P90');
  if (!Number.isFinite(value) || !Number.isFinite(p10) || !Number.isFinite(p90) || p90 === p10) {
    return 50;
  }
  const score = ((value - p10) / (p90 - p10)) * 100;
  return clamp(score, 0, 100);
};

const scoreAbove = (
  benchmarks: LeagueTeamBenchmarks,
  team: NormalizedTeamStats,
  stat: string,
  value: number,
  score: number
) => getPercentileScore(benchmarks, team, stat, value) >= score;

const scoreBelow = (
  benchmarks: LeagueTeamBenchmarks,
  team: NormalizedTeamStats,
  stat: string,
  value: number,
  score: number
) => getPercentileScore(benchmarks, team, stat, value) <= score;

const classifyDelta = (delta: number, threshold: number) => {
  if (delta >= threshold) return 'Higher';
  if (delta <= -threshold) return 'Lower';
  return 'Similar';
};

const buildDecisiveFactors = (
  game: NormalizedGameStats,
  opponent: NormalizedGameStats | null,
  season: NormalizedTeamStats
) => {
  const offense: string[] = [];
  const defense: string[] = [];

  if (game.threePct - season.threePct >= 4) offense.push('Periméterdobás hatékonyabb a szezonátlagnál');
  if (game.twoRate - season.twoRate >= 0.06) offense.push('Festékfókusz erősebb a szezonátlagnál');

  if (game.ftRate - season.ftRate >= 0.05) offense.push('Aggresszív támadás (magas FT rate)');
  if (game.assistRate - season.assistRate >= 0.05) offense.push('Jobb labdajáratás');
  if (game.turnoverRate - season.turnoverRate >= 0.05) offense.push('Támadás szétesett (magas TO rate)');

  if (opponent) {
    const oppEfg = opponent.efg;
    if (oppEfg <= season.efg - 3) defense.push('Ellenfél dobáshatékonyság limitált');
    if (opponent.fga3 > 0 && (opponent.fgm3 / opponent.fga3) * 100 >= 38) {
      defense.push('Perimétervédekezési probléma');
    }
    if (opponent.orebRate - season.orebRate >= 0.08) defense.push('Lepattanózás gyenge');
  }

  return { offense, defense };
};

const computePlayerUsage = (player: PlayerGameStat) => {
  const fga = player.fga2 + player.fga3;
  return fga + 0.44 * player.fta + player.tov;
};

const analyzePlayerImpact = (players: PlayerGameStat[]) => {
  const positive: string[] = [];
  const negative: string[] = [];
  const overperformers: string[] = [];
  const underperformers: string[] = [];

  players.forEach(player => {
    const usage = computePlayerUsage(player);
    if (usage >= 10 && player.val <= 5) negative.push(player.name);
    if (usage <= 6 && player.val >= 10) positive.push(player.name);

    if (player.val >= 15) overperformers.push(player.name);
    if (player.val <= 4) underperformers.push(player.name);
  });

  return {
    positive: positive.slice(0, 3),
    negative: negative.slice(0, 3),
    overperformers: overperformers.slice(0, 3),
    underperformers: underperformers.slice(0, 3),
  };
};

const buildStrengths = (
  game: NormalizedGameStats,
  season: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks
) => {
  const strengths: string[] = [];
  if (game.efg - season.efg >= 3) strengths.push('Dobáshatékonyság a szezonátlag felett');
  if (game.assistRate - season.assistRate >= 0.05) strengths.push('Labdajáratás javult');
  if (game.orebRate - season.orebRate >= 0.05) strengths.push('Támadólepattanózás erős');
  if (game.threePct - season.threePct >= 4) strengths.push('Erős 3P-hatékonyság');
  if (game.twoRate - season.twoRate >= 0.06) strengths.push('Festékből több befejezés');

  if (scoreAbove(benchmarks, season, 'efg', game.efg, 60)
    && !strengths.includes('Dobáshatékonyság a szezonátlag felett')) {
    strengths.push('Dobáshatékonyság a liga felett');
  }
  if (scoreAbove(benchmarks, season, 'assist_rate', game.assistRate, 60)) {
    strengths.push('Labdajáratás a liga felett');
  }
  if (scoreAbove(benchmarks, season, 'three_pct', game.threePct, 60)) {
    strengths.push('Periméter-hatékonyság a liga felett');
  }

  return strengths.slice(0, 3);
};

const buildProblems = (
  game: NormalizedGameStats,
  season: NormalizedTeamStats,
  benchmarks: LeagueTeamBenchmarks
) => {
  const problems: string[] = [];
  if (game.turnoverRate - season.turnoverRate >= 0.05) problems.push('Sok labdaeladás');
  if (game.efg - season.efg <= -3) problems.push('Dobáshatékonyság visszaesett');
  if (game.assistRate - season.assistRate <= -0.05) problems.push('Labdajáratás akadozott');
  if (game.threePct - season.threePct <= -4) problems.push('Gyenge 3P-hatékonyság');
  if (game.twoRate - season.twoRate <= -0.06) problems.push('Festékbefejezések visszaestek');

  if (scoreAbove(benchmarks, season, 'turnover_rate', game.turnoverRate, 60)) {
    problems.push('TO arány a liga felett');
  }
  if (scoreBelow(benchmarks, season, 'efg', game.efg, 40)) {
    problems.push('Dobáshatékonyság a liga alatt');
  }
  if (scoreBelow(benchmarks, season, 'three_pct', game.threePct, 40)) {
    problems.push('Periméter-hatékonyság a liga alatt');
  }

  return problems.slice(0, 3);
};

const buildNextFocus = (problems: string[], strengths: string[]) => {
  const focus: string[] = [];
  if (problems.includes('Sok labdaeladás')) focus.push('TO-k csökkentése, egyszerűsített döntések');
  if (problems.includes('Dobáshatékonyság visszaesett')) focus.push('Dobásminőség javítása, festékből érkező pontok');
  if (problems.includes('Labdajáratás akadozott')) focus.push('Spacing és passzsávok javítása');
  if (problems.includes('Gyenge 3P-hatékonyság')) focus.push('3P dobásminőség, extra pass');
  if (problems.includes('Festékbefejezések visszaestek')) focus.push('Festékből befejezések tisztítása');
  if (strengths.includes('Támadólepattanózás erős')) focus.push('OREB agresszivitás fenntartása');
  return focus.slice(0, 2);
};

const buildSummary = (
  teamName: string,
  opponentName: string,
  result: 'win' | 'loss',
  context: PostGameReport['context'],
  decisive: PostGameReport['decisiveFactors'],
  playerImpact: PostGameReport['playerImpact'],
  nextFocus: string[],
  dataNotes: string[]
) => {
  const tempoText = context.paceDelta === 'Higher'
    ? 'gyorsabb'
    : context.paceDelta === 'Lower'
      ? 'lassabb'
      : 'szezonátlagos';

  const offenseText = context.offenseEfficiencyDelta === 'Higher'
    ? 'hatékonyabb támadást játszott'
    : context.offenseEfficiencyDelta === 'Lower'
      ? 'hatékonyságban visszaesett'
      : 'átlagos hatékonyságot hozott';

  const defenseText = context.defenseEfficiencyDelta === 'Higher'
    ? 'védekezésben jobb hatékonyságot mutatott'
    : context.defenseEfficiencyDelta === 'Lower'
      ? 'védekezésben romlott a hatékonyság'
      : 'védekezésben átlagos volt';

  const decisiveText = [...decisive.offense, ...decisive.defense].slice(0, 2).join('; ');
  const impactText = playerImpact.positive.length > 0
    ? `Pozitív impact: ${playerImpact.positive.join(', ')}.`
    : '';

  const focusText = nextFocus.length > 0 ? `Következő fókusz: ${nextFocus.join(' • ')}.` : '';

  const noteText = dataNotes.length > 0 ? `Megjegyzés: ${dataNotes.join(' ')}.` : '';
  return `${teamName} ${result === 'win' ? 'megnyerte' : 'elveszítette'} a mérkőzést ${opponentName} ellen. Tempó: ${tempoText}, a csapat ${offenseText}, és ${defenseText}. ${decisiveText ? `Döntő faktorok: ${decisiveText}.` : ''} ${impactText} ${focusText} ${noteText}`.trim();
};

export const analyzePostGameReport = (
  teamGame: TeamGameStat,
  opponentGame: TeamGameStat | null,
  teamSeason: TeamSeasonStat,
  leagueBenchmarks: LeagueTeamBenchmarks,
  players: PlayerGameStat[]
): PostGameReport => {
  const opponentFallback: TeamGameStat = opponentGame || {
    teamId: 'opponent',
    teamName: 'Ellenfél',
    league: teamGame.league,
    season: teamGame.season,
    pointsFor: teamGame.pointsAgainst,
    pointsAgainst: teamGame.pointsFor,
    fga2: 0,
    fgm2: 0,
    fga3: 0,
    fgm3: 0,
    fta: 0,
    ftm: 0,
    oreb: 0,
    dreb: 0,
    ast: 0,
    tov: 0,
    stl: 0,
    blk: 0,
    fouls: 0,
    val: 0,
  };

  const game = normalizeTeamGame(teamGame, opponentFallback);
  const opponent = opponentGame ? normalizeTeamGame(opponentFallback, teamGame) : null;
  const season = normalizeTeamSeason(teamSeason);

  const paceDelta = classifyDelta(game.pace - season.pace, 2.5);
  const offenseDelta = classifyDelta(game.efg - season.efg, 2.5);
  const defenseDelta = opponent
    ? classifyDelta(season.efg - opponent.efg, 2.5)
    : 'Similar';

  const decisive = buildDecisiveFactors(game, opponent, season);
  const playerImpact = analyzePlayerImpact(players);
  const strengths = buildStrengths(game, season, leagueBenchmarks);
  const problems = buildProblems(game, season, leagueBenchmarks);
  const nextFocus = buildNextFocus(problems, strengths);

  const result: 'win' | 'loss' = teamGame.pointsFor >= teamGame.pointsAgainst ? 'win' : 'loss';

  const dataNotes = opponent ? [] : ['Ellenfél statisztikák nem elérhetők, a védekező értékelés korlátozott.'];

  return {
    teamId: teamGame.teamId,
    teamName: teamGame.teamName,
    opponentName: opponentGame?.teamName || opponentFallback.teamName,
    league: teamGame.league,
    season: teamGame.season,
    result,
    context: {
      paceDelta,
      offenseEfficiencyDelta: offenseDelta,
      defenseEfficiencyDelta: defenseDelta,
    },
    dataNotes,
    decisiveFactors: decisive,
    playerImpact,
    strengths,
    problems,
    nextFocus,
    summary: buildSummary(
      teamGame.teamName,
      opponentGame?.teamName || opponentFallback.teamName,
      result,
      {
        paceDelta,
        offenseEfficiencyDelta: offenseDelta,
        defenseEfficiencyDelta: defenseDelta,
      },
      decisive,
      playerImpact,
      nextFocus,
      dataNotes
    ),
  };
};
