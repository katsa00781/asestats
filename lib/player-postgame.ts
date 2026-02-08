import type { PlayerGameStat, Position } from './postgame-report';

export type PlayerMinutesBucket = 'micro' | 'rotation' | 'heavy';
export type PlayerUsageTier = 'low' | 'balanced' | 'high';
export type PlayerImpactClass = 'mvp' | 'engine' | 'support' | 'struggling';

export type PlayerPostGameBreakdown = {
  playerId: string;
  name: string;
  position: Position;
  minutes: number;
  minutesBucket: PlayerMinutesBucket;
  roles: string[];
  usageShare: number;
  usageTier: PlayerUsageTier;
  usageLabel: string;
  val: number;
  valPer36: number;
  points: number;
  rebounds: number;
  assists: number;
  turnovers: number;
  stocks: number;
  fouls: number;
  tsPct: number;
  impactScore: number;
  impactClass: PlayerImpactClass;
  impactLabel: string;
  impactTags: string[];
  summaryLine: string;
  strengths: string[];
  issues: string[];
  focus: string[];
  llmContext: PlayerPostGameLLMContext;
};

export type PlayerPostGameLLMContext = {
  minutesBucket: PlayerMinutesBucket;
  usageTier: PlayerUsageTier;
  usageSharePct: number;
  tsPct: number;
  val: number;
  valPer36: number;
  points: number;
  rebounds: number;
  assists: number;
  turnovers: number;
  steals: number;
  blocks: number;
  fouls: number;
  impactLabel: string;
  impactTags: string[];
  strengths: string[];
  issues: string[];
  focus: string[];
};

export type PlayerPostGameReport = {
  players: PlayerPostGameBreakdown[];
  highlights: {
    mvp?: PlayerPostGameBreakdown;
    engines: PlayerPostGameBreakdown[];
    sparkPlugs: PlayerPostGameBreakdown[];
    struggling: PlayerPostGameBreakdown[];
  };
};

const round = (value: number, digits = 1) => {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const computePlayerUsage = (player: PlayerGameStat) => {
  const fga = player.fga2 + player.fga3;
  return fga + 0.44 * player.fta + player.tov;
};

const classifyMinutesBucket = (minutes: number): PlayerMinutesBucket => {
  if (minutes >= 26) return 'heavy';
  if (minutes >= 12) return 'rotation';
  return 'micro';
};

const classifyUsageTier = (usageShare: number): PlayerUsageTier => {
  if (usageShare >= 0.27) return 'high';
  if (usageShare >= 0.18) return 'balanced';
  return 'low';
};

const mapUsageLabel = (usageTier: PlayerUsageTier) => {
  switch (usageTier) {
    case 'high':
      return 'Magas usage';
    case 'balanced':
      return 'Kiegyensúlyozott usage';
    default:
      return 'Limitált usage';
  }
};

const mapImpactLabel = (impactClass: PlayerImpactClass) => {
  switch (impactClass) {
    case 'mvp':
      return 'Elsődleges motor';
    case 'engine':
      return 'Stabil alappillér';
    case 'support':
      return 'Rotációs hozzájárulás';
    default:
      return 'Limitált hatás';
  }
};

const getFouls = (player: PlayerGameStat) => {
  const candidate = (player as PlayerGameStat & { fouls?: number }).fouls;
  return typeof candidate === 'number' ? candidate : 0;
};

const buildStrengths = (player: PlayerGameStat, context: DerivedPlayerContext) => {
  const strengths: string[] = [];
  if (player.points >= 18 || context.tsPct >= 60) strengths.push('Stabil pontszerzés és dobáshatékonyság');
  if (context.usageTier === 'high' && context.tsPct >= 55) strengths.push('Magas usage mellett hatékony befejezések');
  if (player.ast >= 5 || context.assistShare >= 0.3) strengths.push('Playmaking és labdajáratás stabilizálása');
  if (context.reboundShare >= 0.24 || player.oreb >= 4) strengths.push('Lepattanó fölény, második esélyek');
  if (player.stl + player.blk >= 4) strengths.push('Védekezési playmaker (lopások/blokkok)');
  if (context.valPer36 >= 18) strengths.push('VAL/36 dominancia, meccsszintű impact');
  if (context.minutesBucket === 'micro' && context.valPer36 >= 16) strengths.push('Padlóról érkező szikra rövid idő alatt');
  return strengths;
};

const buildIssues = (player: PlayerGameStat, context: DerivedPlayerContext) => {
  const issues: string[] = [];
  if (context.tsPct <= 47 && context.usageTier !== 'low') issues.push('Dobáshatékonysági ingadozás a terheléshez képest');
  if (context.turnoverShare >= 0.25 || player.tov >= 4) issues.push('Labdavesztés-limitáció');
  if (getFouls(player) >= 4) issues.push('Fault-terhelés kontroll');
  if (context.minutesBucket === 'heavy' && context.valPer36 < 11) issues.push('Hosszú játékidő mellett alacsony VAL');
  return issues;
};

const focusMap: Record<string, string> = {
  'Dobáshatékonysági ingadozás a terheléshez képest': 'Dobásminőség és ritmus stabilizálása, több festékből érkező befejezés',
  'Labdavesztés-limitáció': 'Egyszerűsített döntéshozatal és első passz biztosítása',
  'Fault-terhelés kontroll': 'Védekezési pozíció, függőleges védekezés, kontaktus menedzsment',
  'Hosszú játékidő mellett alacsony VAL': 'Energia menedzsment, kevesebb erőltetett helyzet magas usage mellett',
};

const buildFocus = (issues: string[]) => {
  const mapped = issues.map(issue => focusMap[issue]).filter(Boolean);
  if (mapped.length === 0) return ['Fenntartandó energia és fegyelem'];
  return Array.from(new Set(mapped));
};

type DerivedPlayerContext = {
  minutesBucket: PlayerMinutesBucket;
  usageTier: PlayerUsageTier;
  usageShare: number;
  tsPct: number;
  valPer36: number;
  reboundShare: number;
  assistShare: number;
  turnoverShare: number;
};

const buildImpactTags = (player: PlayerGameStat, context: DerivedPlayerContext) => {
  const tags: string[] = [];
  if (player.points >= 16 || context.tsPct >= 58) tags.push('shotmaking');
  if (player.ast >= 5 || context.assistShare >= 0.3) tags.push('playmaking');
  if (player.oreb + player.dreb >= 8 || context.reboundShare >= 0.25) tags.push('rebounding');
  if (player.stl + player.blk >= 4) tags.push('defense');
  if (player.tov >= 4 || context.turnoverShare >= 0.25) tags.push('sloppy');
  if (getFouls(player) >= 4) tags.push('foul_trouble');
  if (context.minutesBucket === 'micro' && context.valPer36 >= 16) tags.push('spark');
  return tags;
};

const computeImpactScore = (player: PlayerGameStat, context: DerivedPlayerContext) => {
  const normalizedVal = clamp(context.valPer36 / 22, 0, 1);
  const normalizedTs = clamp((context.tsPct - 45) / 25, 0, 1);
  const normalizedUsage = clamp(context.usageShare / 0.34, 0, 1);
  const normalizedStocks = clamp((player.stl + player.blk) / 4, 0, 1);
  return round((normalizedVal * 0.45 + normalizedTs * 0.25 + normalizedUsage * 0.2 + normalizedStocks * 0.1) * 100, 1);
};

const classifyImpact = (score: number, minutesBucket: PlayerMinutesBucket): PlayerImpactClass => {
  if (minutesBucket !== 'micro' && score >= 75) return 'mvp';
  if (score >= 60) return 'engine';
  if (score >= 45) return 'support';
  return 'struggling';
};

const computeTrueShooting = (player: PlayerGameStat) => {
  const fga = player.fga2 + player.fga3;
  const denom = fga + 0.44 * player.fta;
  if (denom <= 0) return 0;
  return (player.points / (2 * denom)) * 100;
};

const buildSummaryLine = (player: PlayerGameStat, context: DerivedPlayerContext, usageShare: number) => {
  const rebounds = player.oreb + player.dreb;
  const parts = [
    `${round(player.minutes, 1)} perc`,
    `${player.points} pont`,
    `${rebounds} lep`,
    `${player.ast} ast`,
  ];
  return `${parts.join(' • ')} | TS ${round(context.tsPct, 1)}% • Usage ${(usageShare * 100).toFixed(1)}%`;
};

export const buildPlayerPostGameReport = (players: PlayerGameStat[]): PlayerPostGameReport => {
  const totals = players.reduce(
    (acc, player) => {
      const usage = computePlayerUsage(player);
      acc.usage += usage;
      acc.val += player.val;
      acc.rebounds += player.oreb + player.dreb;
      acc.assists += player.ast;
      acc.turnovers += player.tov;
      return acc;
    },
    { usage: 0, val: 0, rebounds: 0, assists: 0, turnovers: 0 }
  );

  const breakdowns: PlayerPostGameBreakdown[] = players.map(player => {
    const minutesBucket = classifyMinutesBucket(player.minutes);
    const usage = computePlayerUsage(player);
    const usageShare = totals.usage > 0 ? usage / totals.usage : 0;
    const usageTier = classifyUsageTier(usageShare);
    const tsPct = computeTrueShooting(player);
    const valPer36 = player.minutes > 0 ? (player.val / player.minutes) * 36 : player.val;
    const reboundShare = totals.rebounds > 0 ? (player.oreb + player.dreb) / totals.rebounds : 0;
    const assistShare = totals.assists > 0 ? player.ast / totals.assists : 0;
    const turnoverShare = totals.turnovers > 0 ? player.tov / totals.turnovers : 0;

    const context: DerivedPlayerContext = {
      minutesBucket,
      usageTier,
      usageShare,
      tsPct,
      valPer36,
      reboundShare,
      assistShare,
      turnoverShare,
    };

    const strengths = buildStrengths(player, context);
    const issues = buildIssues(player, context);
    const focus = buildFocus(issues);
    const impactTags = buildImpactTags(player, context);
    const impactScore = computeImpactScore(player, context);
    const impactClass = classifyImpact(impactScore, minutesBucket);
    const impactLabel = mapImpactLabel(impactClass);

    return {
      playerId: player.playerId,
      name: player.name,
      position: player.position,
      minutes: player.minutes,
      minutesBucket,
      roles: player.roles,
      usageShare,
      usageTier,
      usageLabel: mapUsageLabel(usageTier),
      val: player.val,
      valPer36: round(valPer36, 1),
      points: player.points,
      rebounds: player.oreb + player.dreb,
      assists: player.ast,
      turnovers: player.tov,
      stocks: player.stl + player.blk,
      fouls: getFouls(player),
      tsPct: round(tsPct, 1),
      impactScore,
      impactClass,
      impactLabel,
      impactTags,
      summaryLine: buildSummaryLine(player, context, usageShare),
      strengths,
      issues,
      focus,
      llmContext: {
        minutesBucket,
        usageTier,
        usageSharePct: round(usageShare * 100, 1),
        tsPct: round(tsPct, 1),
        val: player.val,
        valPer36: round(valPer36, 1),
        points: player.points,
        rebounds: player.oreb + player.dreb,
        assists: player.ast,
        turnovers: player.tov,
        steals: player.stl,
        blocks: player.blk,
        fouls: getFouls(player),
        impactLabel,
        impactTags,
        strengths,
        issues,
        focus,
      },
    };
  });

  const sortedBreakdowns = breakdowns.sort((a, b) => b.impactScore - a.impactScore);

  const claimed = new Set<string>();
  const mvp = sortedBreakdowns.find(player => player.impactClass === 'mvp');
  if (mvp) claimed.add(mvp.playerId);

  const engines = sortedBreakdowns
    .filter(player => player.impactClass === 'engine' && !claimed.has(player.playerId))
    .slice(0, 2);
  engines.forEach(player => claimed.add(player.playerId));

  const sparkPlugs = sortedBreakdowns
    .filter(player => player.minutesBucket !== 'heavy' && player.impactScore >= 60 && !claimed.has(player.playerId))
    .slice(0, 2);
  sparkPlugs.forEach(player => claimed.add(player.playerId));

  const struggling = sortedBreakdowns
    .filter(player => player.impactClass === 'struggling' && !claimed.has(player.playerId))
    .slice(0, 2);

  const highlights = {
    mvp,
    engines,
    sparkPlugs,
    struggling,
  };

  return {
    players: sortedBreakdowns,
    highlights,
  };
};
