import type { PlayerStats } from './dashboard-types';
import type { ScoutingReport } from './pregame-scouting';
import type { PostGameReport, PostgameBoxScoreLine } from './postgame-report';
import type { KosarstatGameClutch } from './kosarstat-clutch-parse';
import type {
  TeamBoxLine,
  TeamExportAggregate,
  TeamExportPlayer,
  TeamSeasonExportInput,
} from './team-season-export';
import { trueShootingPct, effectiveFgPct } from './stat-formulas';
import {
  buildTeamSeasonExport,
  lineFga,
  lineFgm,
  lineUsage,
  MIN_SAMPLE_MINUTES,
  PHASE_LABELS,
} from './team-season-export';

function fmtPct(made: number, attempted: number): string {
  return attempted > 0 ? `${((made / attempted) * 100).toFixed(1)}%` : '-';
}

/**
 * Szezon / liga fejlécsor a riport MD-khez. A riportobjektum `season` mezője a
 * szezon azonosítója (UUID), ezért a megjelenítendő nevet a hívó adja át; a
 * webes hívó `league` értéke a szezon neve, ezt nem írjuk ki kétszer.
 */
function seasonLeagueLine(league: string, seasonId: string, seasonName?: string): string {
  const season = seasonName ?? seasonId;
  return league && league !== season
    ? `**Szezon:** ${season} | **Liga:** ${league}`
    : `**Szezon:** ${season}`;
}

function sign(v: number): string {
  return v >= 0 ? `+${v.toFixed(1)}` : `${v.toFixed(1)}`;
}

export type GameComparisonExport = {
  date: string;
  opponent: string;
  home_away: string;
  our_score: number;
  opp_score: number;
  result: string;
  season_name: string;
  team_name: string;
  close_made: number; close_attempted: number; close_percentage: number; close_points: number;
  mid_made: number; mid_attempted: number; mid_percentage: number; mid_points: number;
  three_made: number; three_attempted: number; three_percentage: number; three_points: number;
  free_throw_made: number; free_throw_attempted: number; free_throw_percentage: number; free_throw_points: number;
  total_points: number;
  offensive_rebounds: number; defensive_rebounds: number; total_rebounds: number;
  assists: number; steals: number; blocks: number; turnovers: number;
  fouls_committed: number; valuation: number;
  avg_close_attempted: number; avg_close_percentage: number; avg_close_points: number;
  avg_mid_attempted: number; avg_mid_percentage: number; avg_mid_points: number;
  avg_three_attempted: number; avg_three_percentage: number; avg_three_points: number;
  avg_free_throw_attempted: number; avg_free_throw_percentage: number; avg_free_throw_points: number;
  avg_total_points: number;
  close_points_diff?: number; mid_points_diff?: number; three_points_diff?: number;
  free_throw_points_diff?: number; total_points_diff?: number;
};

export type QuarterScoreExport = {
  quarter: string;
  ourScore: number;
  oppScore: number;
};

export type PlayerBreakdownExport = {
  playerId: string;
  name: string;
  position: string;
  isStarter?: boolean;
  impactLabel: string;
  summaryLine: string;
  val: number;
  valPer36: number;
  tsPct: number;
  usageShare: number;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  turnovers: number;
  stocks: number;
  strengths: string[];
  issues: string[];
  focus: string[];
  roles: string[];
};

export type GameExtraData = {
  quarterStats?: QuarterScoreExport[];
  teamShortName?: string;
  playerBreakdowns?: PlayerBreakdownExport[];
  playerTexts?: Record<string, string>;
  lineupInfo?: { starters: string[]; bench: string[] };
  clutchInfo?: KosarstatGameClutch;
};

export type PlayerGameStatExport = {
  player_name: string;
  player_number: number;
  player_position: string | null;
  minutes: number; points: number;
  close_made: number; close_attempted: number;
  mid_made: number; mid_attempted: number;
  three_made: number; three_attempted: number;
  free_throw_made: number; free_throw_attempted: number;
  offensive_rebounds: number; defensive_rebounds: number; total_rebounds: number;
  assists: number; steals: number; blocks: number; turnovers: number;
  fouls_committed: number; plus_minus: number; valuation: number;
};

export function gameStatsToMd(
  game: GameComparisonExport,
  players: PlayerGameStatExport[],
  extra?: GameExtraData
): string {
  const homeAway = game.home_away === 'home' ? 'Hazai' : 'Vendég';
  const result = game.result === 'win' ? 'Győzelem' : 'Vereség';
  const date = new Date(game.date).toLocaleDateString('hu-HU');
  const n = (v: number | undefined) => (v ?? 0).toFixed(1);

  // Fejlett csapatmutatók számítása a meccs adataiból
  const fga2 = game.close_attempted + game.mid_attempted;
  const fgm2 = game.close_made + game.mid_made;
  const fga3 = game.three_attempted;
  const fgm3 = game.three_made;
  const fga = fga2 + fga3;
  const fgm = fgm2 + fgm3;
  const fta = game.free_throw_attempted;

  const efg = effectiveFgPct(fgm, fgm3, fga);
  const ts = trueShootingPct(game.total_points, fga, fta);
  const possEst = fga + 0.44 * fta + game.turnovers - game.offensive_rebounds;
  const toRate = possEst > 0 ? (game.turnovers / possEst) * 100 : 0;
  const assistRate = fgm > 0 ? (game.assists / fgm) * 100 : 0;
  const orebRate = game.total_rebounds > 0
    ? (game.offensive_rebounds / game.total_rebounds) * 100
    : 0;
  const ftRate = fga > 0 ? (fta / fga) * 100 : 0;

  // Szezonátlag számítása az avg_ mezőkből
  const avgFga2 = game.avg_close_attempted + game.avg_mid_attempted;
  const avgFgm2 = (game.avg_close_attempted * game.avg_close_percentage / 100)
    + (game.avg_mid_attempted * game.avg_mid_percentage / 100);
  const avgFga3 = game.avg_three_attempted;
  const avgFgm3 = game.avg_three_attempted * game.avg_three_percentage / 100;
  const avgFga = avgFga2 + avgFga3;
  const avgFgm = avgFgm2 + avgFgm3;
  const avgFta = game.avg_free_throw_attempted;
  const avgEfg = effectiveFgPct(avgFgm, avgFgm3, avgFga);
  const avgTs = trueShootingPct(game.avg_total_points, avgFga, avgFta);
  const avgFtRate = avgFga > 0 ? (avgFta / avgFga) * 100 : 0;

  const lines: string[] = [
    `# Meccs elemzés: ${game.team_name} vs ${game.opponent}`,
    ``,
    `**Dátum:** ${date} | **Szezon:** ${game.season_name} | **Helyszín:** ${homeAway}`,
    `**Eredmény:** ${result} ${game.our_score}–${game.opp_score}`,
    ``,
  ];

  // --- Negyedenkénti bontás ---
  if (extra?.quarterStats && extra.quarterStats.length > 0) {
    const qs = extra.quarterStats;
    const totalOur = qs.reduce((s, q) => s + q.ourScore, 0);
    const totalOpp = qs.reduce((s, q) => s + q.oppScore, 0);
    const teamLabel = extra.teamShortName ?? game.team_name;
    lines.push(`## Negyedenkénti bontás`, ``);
    lines.push(`| Negyed | ${teamLabel} | ${game.opponent} | Különbség |`);
    lines.push(`|--------|${'-'.repeat(teamLabel.length + 2)}|${'-'.repeat(game.opponent.length + 2)}|-----------|`);
    for (const q of qs) {
      const diff = q.ourScore - q.oppScore;
      const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
      lines.push(`| ${q.quarter} | ${q.ourScore} | ${q.oppScore} | ${diffStr} |`);
    }
    lines.push(`| **Összesen** | **${totalOur}** | **${totalOpp}** | **${totalOur - totalOpp > 0 ? '+' : ''}${totalOur - totalOpp}** |`);
    lines.push(``);
  }

  // --- Lineup / kezdő ötös ---
  const hasLineup = extra?.lineupInfo && extra.lineupInfo.starters.length > 0;
  const hasBreakdownLineup = extra?.playerBreakdowns && extra.playerBreakdowns.some(b => b.isStarter !== undefined);
  if (hasBreakdownLineup && extra?.playerBreakdowns) {
    const starters = extra.playerBreakdowns.filter(b => b.isStarter);
    const bench = extra.playerBreakdowns.filter(b => !b.isStarter);
    lines.push(`## Kezdő ötös és rotáció`, ``);
    lines.push(`| Játékos | Poz | Perc | Pont | Lep | Gp | VAL | Szerep |`);
    lines.push(`|---------|-----|------|------|-----|----|-----|--------|`);
    for (const b of starters) {
      lines.push(`| ${b.name} | ${b.position} | ${b.minutes} | ${b.points} | ${b.rebounds} | ${b.assists} | ${b.val.toFixed(1)} | Kezdő |`);
    }
    for (const b of bench) {
      lines.push(`| ${b.name} | ${b.position} | ${b.minutes} | ${b.points} | ${b.rebounds} | ${b.assists} | ${b.val.toFixed(1)} | Csere |`);
    }
    lines.push(``);
  } else if (hasLineup) {
    const { starters, bench } = extra!.lineupInfo!;
    lines.push(`## Kezdő ötös`, ``);
    lines.push(`**Kezdők:** ${starters.join(' · ')}`);
    if (bench.length > 0) lines.push(`**Csere:** ${bench.join(' · ')}`);
    lines.push(``);
  }

  // --- Fejlett csapatmutatók ---
  lines.push(
    `## Fejlett csapatmutatók`,
    ``,
    `| Mutató | Meccs | Szezon átl. | Delta |`,
    `|--------|-------|-------------|-------|`,
    `| eFG% | ${efg.toFixed(1)}% | ${avgEfg.toFixed(1)}% | ${sign(efg - avgEfg)}pp |`,
    `| TS% | ${ts.toFixed(1)}% | ${avgTs.toFixed(1)}% | ${sign(ts - avgTs)}pp |`,
    `| Assist% (ast/fgm) | ${assistRate.toFixed(1)}% | – | – |`,
    `| TO rate | ${toRate.toFixed(1)}% | – | – |`,
    `| OREB% (T-lep/össz. saját lep.) | ${orebRate.toFixed(1)}% | – | – |`,
    `| FT rate (fta/fga) | ${ftRate.toFixed(1)}% | ${avgFtRate.toFixed(1)}% | ${sign(ftRate - avgFtRate)}pp |`,
    ``
  );

  // --- Dobásstatisztikák ---
  lines.push(
    `## Csapatszintű dobásstatisztikák`,
    ``,
    `| Zóna | Kísérlet | Szerzett | % | Átl. kísérlet | Átl. % | Pontok | Átl. pontok | Δ pont |`,
    `|------|----------|----------|---|---------------|--------|--------|-------------|--------|`,
    `| Közeli | ${game.close_attempted} | ${game.close_made} | ${fmtPct(game.close_made, game.close_attempted)} | ${n(game.avg_close_attempted)} | ${n(game.avg_close_percentage)}% | ${game.close_points} | ${n(game.avg_close_points)} | ${game.close_points_diff !== undefined ? sign(game.close_points_diff) : '–'} |`,
    `| Középtáv | ${game.mid_attempted} | ${game.mid_made} | ${fmtPct(game.mid_made, game.mid_attempted)} | ${n(game.avg_mid_attempted)} | ${n(game.avg_mid_percentage)}% | ${game.mid_points} | ${n(game.avg_mid_points)} | ${game.mid_points_diff !== undefined ? sign(game.mid_points_diff) : '–'} |`,
    `| Hárompontos | ${game.three_attempted} | ${game.three_made} | ${fmtPct(game.three_made, game.three_attempted)} | ${n(game.avg_three_attempted)} | ${n(game.avg_three_percentage)}% | ${game.three_points} | ${n(game.avg_three_points)} | ${game.three_points_diff !== undefined ? sign(game.three_points_diff) : '–'} |`,
    `| Büntető | ${game.free_throw_attempted} | ${game.free_throw_made} | ${fmtPct(game.free_throw_made, game.free_throw_attempted)} | ${n(game.avg_free_throw_attempted)} | ${n(game.avg_free_throw_percentage)}% | ${game.free_throw_points} | ${n(game.avg_free_throw_points)} | ${game.free_throw_points_diff !== undefined ? sign(game.free_throw_points_diff) : '–'} |`,
    `| **Összesen** | **${fga + fta}** | **${fgm + game.free_throw_made}** | | | | **${game.total_points}** | **${n(game.avg_total_points)}** | ${game.total_points_diff !== undefined ? sign(game.total_points_diff) : '–'} |`,
    ``
  );

  // --- Egyéb csapatstatisztikák ---
  lines.push(
    `## Csapatszintű egyéb statisztikák`,
    ``,
    `| Statisztika | Meccs |`,
    `|-------------|-------|`,
    `| Lepattanó (T/V/Ö) | ${game.offensive_rebounds}/${game.defensive_rebounds}/${game.total_rebounds} |`,
    `| Gólpassz | ${game.assists} |`,
    `| Labdaszerzés | ${game.steals} |`,
    `| Blokkolt dobás | ${game.blocks} |`,
    `| Labdavesztés | ${game.turnovers} |`,
    `| Szabálytalanság | ${game.fouls_committed} |`,
    `| Valuation | ${game.valuation} |`,
    ``
  );

  // --- Clutch adatok ---
  if (extra?.clutchInfo && extra.clutchInfo.available) {
    const c = extra.clutchInfo;
    const diffStr = c.diff > 0 ? `+${c.diff}` : `${c.diff}`;
    const n = (v: number | null, suffix = '') => v !== null && Number.isFinite(v) ? `${v.toFixed(1)}${suffix}` : '–';
    const n2 = (v: number | null) => v !== null && Number.isFinite(v) ? v.toFixed(2) : '–';
    lines.push(`## Clutch helyzetek (±5 pont, utolsó 5 perc)`, ``);
    lines.push(`**Minta:** ${c.sampleLabel} | **Pontszám:** ${c.ownPoints}–${c.oppPoints} (${diffStr})`, ``);
    lines.push(`| Mutató | Érték |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Saját ORtg | ${n(c.ortg)} |`);
    lines.push(`| Ellenfél ORtg (DRtg) | ${n(c.drtg)} |`);
    lines.push(`| Net rating | ${c.net !== null ? (c.net >= 0 ? `+${c.net.toFixed(1)}` : `${c.net.toFixed(1)}`) : '–'} |`);
    lines.push(`| TOV% | ${n(c.tovPct, '%')} |`);
    lines.push(`| OREB% | ${n(c.rebPct, '%')} |`);
    lines.push(`| FT arány (ftm/fga) | ${n2(c.ftRate)} |`);
    lines.push(`| Assziszt/LV | ${n2(c.assistToTurnover)} |`);
    lines.push(`| Saját LV | ${c.ownTurnovers} |`);
    lines.push(`| Ellenfél LV | ${c.oppTurnovers} |`);
    if (c.topUsageClosers.length > 0) {
      const closers = c.topUsageClosers.map(p => `${p.player} (${(p.usageShare * 100).toFixed(0)}%)`).join(', ');
      lines.push(``, `**Top closers:** ${closers}`);
    }
    lines.push(``);
  }

  // --- Játékos alapstatisztikák ---
  lines.push(
    `## Játékos statisztikák (alapadatok)`,
    ``,
    `| # | Játékos | Poz | Perc | Pont | Közeli | Középtáv | 3P | Büntető | T-Lep | V-Lep | Lep | Gp | St | Bl | LV | Fault | +/- | VAL |`,
    `|---|---------|-----|------|------|--------|----------|----|---------|-------|-------|-----|----|----|----|----|-------|-----|-----|`
  );

  for (const p of players) {
    const pm = p.plus_minus >= 0 ? `+${p.plus_minus}` : `${p.plus_minus}`;
    lines.push(
      `| ${p.player_number} | ${p.player_name} | ${p.player_position ?? '-'} | ${p.minutes} | ${p.points} | ${p.close_made}/${p.close_attempted} | ${p.mid_made}/${p.mid_attempted} | ${p.three_made}/${p.three_attempted} | ${p.free_throw_made}/${p.free_throw_attempted} | ${p.offensive_rebounds} | ${p.defensive_rebounds} | ${p.total_rebounds} | ${p.assists} | ${p.steals} | ${p.blocks} | ${p.turnovers} | ${p.fouls_committed} | ${pm} | ${p.valuation} |`
    );
  }
  lines.push(``);

  // --- Játékos impact breakdown ---
  if (extra?.playerBreakdowns && extra.playerBreakdowns.length > 0) {
    lines.push(`## Játékos impact elemzés`, ``);
    lines.push(`| Játékos | Poz | Perc | Pont | Lep | Gp | St+Bl | LV | TS% | VAL | VAL/36 | Usage% | Hatás |`);
    lines.push(`|---------|-----|------|------|-----|----|-------|----|-----|-----|--------|--------|-------|`);
    for (const b of extra.playerBreakdowns) {
      const tsStr = b.tsPct > 0 ? `${b.tsPct.toFixed(1)}%` : '–';
      lines.push(
        `| ${b.name} | ${b.position} | ${b.minutes} | ${b.points} | ${b.rebounds} | ${b.assists} | ${b.stocks} | ${b.turnovers} | ${tsStr} | ${b.val.toFixed(1)} | ${b.valPer36.toFixed(1)} | ${(b.usageShare * 100).toFixed(1)}% | ${b.impactLabel} |`
      );
    }
    lines.push(``);

    for (const b of extra.playerBreakdowns) {
      if (b.strengths.length === 0 && b.issues.length === 0 && b.focus.length === 0) continue;
      lines.push(`### ${b.name} – ${b.impactLabel}`);
      lines.push(`*${b.summaryLine}*`);
      if (b.roles.length > 0) lines.push(`**Szerepek:** ${b.roles.join(', ')}`);
      if (b.strengths.length > 0) {
        lines.push(`**Erősségek:**`);
        for (const s of b.strengths) lines.push(`- ${s}`);
      }
      if (b.issues.length > 0) {
        lines.push(`**Problémák:**`);
        for (const i of b.issues) lines.push(`- ${i}`);
      }
      if (b.focus.length > 0) {
        lines.push(`**Fejlesztési fókusz:**`);
        for (const f of b.focus) lines.push(`- ${f}`);
      }
      lines.push(``);
    }
  }

  // --- Játékos AI értékelések ---
  if (extra?.playerTexts && Object.keys(extra.playerTexts).length > 0 && extra?.playerBreakdowns) {
    lines.push(`## Játékos AI értékelések`, ``);
    for (const b of extra.playerBreakdowns) {
      const text = extra.playerTexts[b.playerId];
      if (!text) continue;
      lines.push(`### ${b.name}`);
      lines.push(text);
      lines.push(``);
    }
  }

  return lines.join('\n');
}

export function playerSeasonToMd(player: PlayerStats): string {
  const g = Math.max(player.gamesPlayed, 1);
  const pp = (n: number) => (n / g).toFixed(1);
  const s = player.shooting;

  const lines: string[] = [
    `# Játékos szezonértékelés: ${player.name}`,
    ``,
    `**Pozíció:** ${player.position} | **Szám:** #${player.number}`,
    ...(player.seasonName ? [`**Szezon:** ${player.seasonName}`] : []),
    ...(player.teamName ? [`**Csapat:** ${player.teamName}`] : []),
    `**Lejátszott meccsek:** ${player.gamesPlayed}`,
    ``,
    `## Szezon összesítés`,
    ``,
    `| Statisztika | Összes | Átlag/meccs |`,
    `|-------------|--------|-------------|`,
    `| Perc | ${player.minutes} | ${pp(player.minutes)} |`,
    `| Pontok | ${player.points} | ${pp(player.points)} |`,
    `| T-Lepattanó | ${player.rebounds.offensive} | ${pp(player.rebounds.offensive)} |`,
    `| V-Lepattanó | ${player.rebounds.defensive} | ${pp(player.rebounds.defensive)} |`,
    `| Össz. Lepattanó | ${player.rebounds.total} | ${pp(player.rebounds.total)} |`,
    `| Gólpassz | ${player.assists} | ${pp(player.assists)} |`,
    `| Labdaszerzés | ${player.steals} | ${pp(player.steals)} |`,
    `| Blokkolt dobás | ${player.blocks} | ${pp(player.blocks)} |`,
    `| Labdavesztés | ${player.turnovers} | ${pp(player.turnovers)} |`,
    `| Faultok | ${player.foulsCommitted} | ${pp(player.foulsCommitted)} |`,
    `| Valuation | ${player.valuation.toFixed(1)} | ${pp(player.valuation)} |`,
    ``,
    `## Dobásprofil`,
    ``,
    `| Zóna | Kísérlet | Szerzett | % |`,
    `|------|----------|----------|---|`,
    `| Közeli | ${s.close.attempted} | ${s.close.made} | ${fmtPct(s.close.made, s.close.attempted)} |`,
    `| Középtáv | ${s.mid.attempted} | ${s.mid.made} | ${fmtPct(s.mid.made, s.mid.attempted)} |`,
    `| Hárompontos | ${s.three.attempted} | ${s.three.made} | ${fmtPct(s.three.made, s.three.attempted)} |`,
    `| Büntető | ${s.freeThrow.attempted} | ${s.freeThrow.made} | ${fmtPct(s.freeThrow.made, s.freeThrow.attempted)} |`,
    ``,
    `## Fejlett mutatók`,
    ``,
    `| Mutató | Érték |`,
    `|--------|-------|`,
    `| True Shooting % | ${player.trueShootingPct.toFixed(1)}% |`,
    `| Effective FG % | ${player.effectiveShootingPct.toFixed(1)}% |`,
    `| VAL/36 perc | ${(player.valuation / Math.max(player.minutes, 1) * 36).toFixed(1)} |`,
    `| Offenzív index (pont/kísérlet, nem NBA OrtG) | ${player.offensiveRating.toFixed(2)} |`,
    `| Defenzív index (akció/meccs, nem NBA DrtG) | ${player.defensiveRating.toFixed(1)} |`,
    ``,
    `## Per-36 perces mutatók`,
    ``,
    `| Statisztika | /36 perc |`,
    `|-------------|----------|`,
    `| Pontok/36 | ${(player.points / Math.max(player.minutes, 1) * 36).toFixed(1)} |`,
    `| Lepattanó/36 | ${(player.rebounds.total / Math.max(player.minutes, 1) * 36).toFixed(1)} |`,
    `| Gólpassz/36 | ${(player.assists / Math.max(player.minutes, 1) * 36).toFixed(1)} |`,
    `| Labdaszerzés/36 | ${(player.steals / Math.max(player.minutes, 1) * 36).toFixed(1)} |`,
    `| Blokkolt dobás/36 | ${(player.blocks / Math.max(player.minutes, 1) * 36).toFixed(1)} |`,
    `| Labdavesztés/36 | ${(player.turnovers / Math.max(player.minutes, 1) * 36).toFixed(1)} |`,
    `| VAL/36 | ${(player.valuation / Math.max(player.minutes, 1) * 36).toFixed(1)} |`,
    ``,
    `## Utolsó meccsek (max. 10)`,
    ``,
    `| Dátum | Ellenfél | Perc | Pont | Közeli | Középtáv | 3P | Büntető | Lep | Gp | St | Bl | LV | VAL |`,
    `|-------|----------|------|------|--------|----------|----|---------|-----|----|----|----|----|----|`,
  ];

  for (const game of player.gameHistory.slice(0, 10)) {
    const gs = game.shooting;
    lines.push(
      `| ${game.date} | ${game.opponent} | ${game.minutes} | ${game.points} | ${gs.close.made}/${gs.close.attempted} | ${gs.mid.made}/${gs.mid.attempted} | ${gs.three.made}/${gs.three.attempted} | ${gs.freeThrow.made}/${gs.freeThrow.attempted} | ${game.rebounds.total} | ${game.assists} | ${game.steals} | ${game.blocks} | ${game.turnovers} | ${game.valuation} |`
    );
  }

  return lines.join('\n');
}

type TeamRateSet = {
  efg: number;
  ts: number;
  threeRate: number;
  ftmRate: number;
  ftaRate: number;
  toRate: number;
  assistRate: number;
};

function teamRates(line: TeamBoxLine): TeamRateSet {
  const fga = lineFga(line);
  const fgm = lineFgm(line);
  const usage = lineUsage(line);
  return {
    efg: effectiveFgPct(fgm, line.threeMade, fga),
    ts: trueShootingPct(line.points, fga, line.ftAtt),
    threeRate: fga > 0 ? (line.threeAtt / fga) * 100 : 0,
    ftmRate: fga > 0 ? (line.ftMade / fga) * 100 : 0,
    ftaRate: fga > 0 ? (line.ftAtt / fga) * 100 : 0,
    toRate: usage > 0 ? (line.tov / usage) * 100 : 0,
    assistRate: fgm > 0 ? (line.ast / fgm) * 100 : 0,
  };
}

/** OREB%: saját T-lep / (saját T-lep + a másik csapat V-lepattanója). */
function orebPct(line: TeamBoxLine, other: TeamBoxLine): number {
  const chances = line.oreb + other.dreb;
  return chances > 0 ? (line.oreb / chances) * 100 : 0;
}

function aggregateRatings(agg: TeamExportAggregate) {
  const hasRating = agg.possessions > 0 && agg.boxGames > 0;
  const ortg = hasRating ? (agg.ratingPointsFor / agg.possessions) * 100 : null;
  const drtg = hasRating ? (agg.ratingPointsAgainst / agg.possessions) * 100 : null;
  return {
    pace: hasRating ? agg.possessions / agg.boxGames : null,
    ortg,
    drtg,
    net: ortg !== null && drtg !== null ? ortg - drtg : null,
  };
}

export function teamStatsToMd(input: TeamSeasonExportInput & { teamName?: string }): string {
  const model = buildTeamSeasonExport(input);
  const { overall } = model;
  const hasOpp = overall.pairedGames > 0;

  const per = (value: number, count: number) => (count > 0 ? (value / count).toFixed(1) : '–');
  const pct = (value: number, available = true) => (available ? `${value.toFixed(1)}%` : '–');
  const num = (value: number | null) => (value !== null ? value.toFixed(1) : '–');
  const signed = (value: number | null) => (value !== null ? sign(value) : '–');
  const record = (agg: TeamExportAggregate) => `${agg.wins}W – ${agg.losses}L`;

  const own = teamRates(overall.own);
  const opp = teamRates(overall.opp);
  const ratings = aggregateRatings(overall);

  const lines: string[] = [
    `# Csapat szezonstatisztikák: ${input.teamName ?? 'Csapat'}`,
    ``,
    ...(input.seasonName ? [`**Szezon:** ${input.seasonName}`] : []),
    `**Meccsek:** ${overall.games} (${record(overall)}) | **Hazai:** ${record(model.home)} | **Vendég:** ${record(model.away)}`,
    `**Box score lefedettség:** saját ${overall.boxGames}/${overall.games} meccs · ellenfél ${overall.pairedGames}/${overall.games} meccs`,
    `**Versenyszakasz:** ${model.byPhase.map(item => `${PHASE_LABELS[item.phase]} ${item.aggregate.games} (${record(item.aggregate)})`).join(' · ') || '–'}`,
    ``,
  ];

  if (model.dataNotes.length > 0) {
    lines.push(`## Adatminőség`, ``);
    for (const note of model.dataNotes) lines.push(`- ${note}`);
    lines.push(``);
  }

  lines.push(
    `## Csapat átlagok (meccsenkénti)`,
    ``,
    `| Statisztika | Saját | Ellenfél |`,
    `|-------------|-------|----------|`,
    `| Pontok (végeredmény) | ${per(overall.pointsFor, overall.games)} | ${per(overall.pointsAgainst, overall.games)} |`,
    `| Lepattanók | ${per(overall.own.reb, overall.boxGames)} | ${per(overall.opp.reb, overall.pairedGames)} |`,
    `| Támadólepattanók | ${per(overall.own.oreb, overall.boxGames)} | ${per(overall.opp.oreb, overall.pairedGames)} |`,
    `| Védőlepattanók | ${per(overall.own.dreb, overall.boxGames)} | ${per(overall.opp.dreb, overall.pairedGames)} |`,
    `| Gólpasszok | ${per(overall.own.ast, overall.boxGames)} | ${per(overall.opp.ast, overall.pairedGames)} |`,
    `| Labdaszerzések | ${per(overall.own.stl, overall.boxGames)} | ${per(overall.opp.stl, overall.pairedGames)} |`,
    `| Blokkok | ${per(overall.own.blk, overall.boxGames)} | ${per(overall.opp.blk, overall.pairedGames)} |`,
    `| Labdavesztések | ${per(overall.own.tov, overall.boxGames)} | ${per(overall.opp.tov, overall.pairedGames)} |`,
    `| Szabálytalanságok | ${per(overall.own.pf, overall.boxGames)} | ${per(overall.opp.pf, overall.pairedGames)} |`,
    `| Valuation | ${per(overall.own.val, overall.boxGames)} | ${per(overall.opp.val, overall.pairedGames)} |`,
    ``,
    `*A pontok a végeredményből (${overall.games} meccs), a többi sor a box score-ból: saját ${overall.boxGames}, ellenfél ${overall.pairedGames} meccs átlaga.*`,
    ``,
    `## Fejlett csapatmutatók (szezon összesített)`,
    ``,
    `| Mutató | Saját | Ellenfél |`,
    `|--------|-------|----------|`,
    `| eFG% | ${pct(own.efg, overall.boxGames > 0)} | ${pct(opp.efg, hasOpp)} |`,
    `| TS% | ${pct(own.ts, overall.boxGames > 0)} | ${pct(opp.ts, hasOpp)} |`,
    `| 3P arány (3PA/FGA) | ${pct(own.threeRate, overall.boxGames > 0)} | ${pct(opp.threeRate, hasOpp)} |`,
    `| FTM rate (FTM/FGA) | ${pct(own.ftmRate, overall.boxGames > 0)} | ${pct(opp.ftmRate, hasOpp)} |`,
    `| FTA rate (FTA/FGA) | ${pct(own.ftaRate, overall.boxGames > 0)} | ${pct(opp.ftaRate, hasOpp)} |`,
    `| TO rate (Oliver) | ${pct(own.toRate, overall.boxGames > 0)} | ${pct(opp.toRate, hasOpp)} |`,
    `| OREB% | ${pct(orebPct(overall.pairedOwn, overall.opp), hasOpp)} | ${pct(orebPct(overall.opp, overall.pairedOwn), hasOpp)} |`,
    `| Assist arány (AST/FGM) | ${pct(own.assistRate, overall.boxGames > 0)} | ${pct(opp.assistRate, hasOpp)} |`,
    `| Birtoklás / meccs (tempó) | ${num(ratings.pace)} | ${num(ratings.pace)} |`,
    `| ORtg (pont / 100 birtoklás) | ${num(ratings.ortg)} | ${num(ratings.drtg)} |`,
    `| Net rating | ${signed(ratings.net)} | ${ratings.net !== null ? sign(-ratings.net) : '–'} |`,
    ``,
    `*Az ellenfél ORtg-je a saját DRtg (alacsonyabb a jobb). Birtoklás = a két csapat (FGA + 0,44·FTA + LV − T-lep) becslésének átlaga; ellenfél box score nélkül csak a saját becslés. TO rate (Oliver) = LV / (FGA + 0,44·FTA + LV). FTM rate = értékesített büntető / FGA – a postgame riport ugyanezt használja; az FTA rate = büntetőkísérlet / FGA ettől eltérő mutató. OREB% = T-lep / (T-lep + a másik csapat V-lepattanója), csak az ellenfél box score-ral fedett meccsekből.*`,
    ``,
    `## Dobásbontás (szezon összesített)`,
    ``,
    `| Zóna | Kísérlet | Szerzett | % | Pont | Ellenfél kísérlet | Ellenfél szerzett | Ellenfél % |`,
    `|------|----------|----------|---|------|-------------------|-------------------|------------|`,
    `| Közeli | ${overall.own.closeAtt} | ${overall.own.closeMade} | ${fmtPct(overall.own.closeMade, overall.own.closeAtt)} | ${overall.own.closeMade * 2} | ${overall.opp.closeAtt} | ${overall.opp.closeMade} | ${fmtPct(overall.opp.closeMade, overall.opp.closeAtt)} |`,
    `| Középtáv | ${overall.own.midAtt} | ${overall.own.midMade} | ${fmtPct(overall.own.midMade, overall.own.midAtt)} | ${overall.own.midMade * 2} | ${overall.opp.midAtt} | ${overall.opp.midMade} | ${fmtPct(overall.opp.midMade, overall.opp.midAtt)} |`,
    `| Hárompontos | ${overall.own.threeAtt} | ${overall.own.threeMade} | ${fmtPct(overall.own.threeMade, overall.own.threeAtt)} | ${overall.own.threeMade * 3} | ${overall.opp.threeAtt} | ${overall.opp.threeMade} | ${fmtPct(overall.opp.threeMade, overall.opp.threeAtt)} |`,
    `| Büntető | ${overall.own.ftAtt} | ${overall.own.ftMade} | ${fmtPct(overall.own.ftMade, overall.own.ftAtt)} | ${overall.own.ftMade} | ${overall.opp.ftAtt} | ${overall.opp.ftMade} | ${fmtPct(overall.opp.ftMade, overall.opp.ftAtt)} |`,
    `| **Összesen** | | | | **${overall.own.closeMade * 2 + overall.own.midMade * 2 + overall.own.threeMade * 3 + overall.own.ftMade}** | | | |`,
    ``,
    `*A saját dobásbontás ${overall.boxGames}, az ellenfélé ${overall.pairedGames} meccs összege; a saját pontösszeg a box score-os meccsek végeredményével (${overall.ratingPointsFor} pont) vethető össze.*`,
    ``,
    `## Bontások`,
    ``,
    `| Bontás | Meccs | Mérleg | Pont | Kapott | Tempó | ORtg | DRtg | Net | eFG% | Ellenfél eFG% | TO rate | Ellenfél TO rate |`,
    `|--------|-------|--------|------|--------|-------|------|------|-----|------|---------------|---------|------------------|`,
  );

  const splitRow = (label: string, agg: TeamExportAggregate) => {
    const r = aggregateRatings(agg);
    const o = teamRates(agg.own);
    const d = teamRates(agg.opp);
    return `| ${label} | ${agg.games} | ${record(agg)} | ${per(agg.pointsFor, agg.games)} | ${per(agg.pointsAgainst, agg.games)} | ${num(r.pace)} | ${num(r.ortg)} | ${num(r.drtg)} | ${signed(r.net)} | ${pct(o.efg, agg.boxGames > 0)} | ${pct(d.efg, agg.pairedGames > 0)} | ${pct(o.toRate, agg.boxGames > 0)} | ${pct(d.toRate, agg.pairedGames > 0)} |`;
  };
  lines.push(splitRow('Összes', overall), splitRow('Hazai', model.home), splitRow('Vendég', model.away));
  for (const item of model.byPhase) lines.push(splitRow(PHASE_LABELS[item.phase], item.aggregate));
  lines.push(``);

  // --- Játékosok ---
  const teamCourtMinutes = overall.own.minutes / 5;
  const sortedPlayers = [...model.players].sort((a, b) => {
    if (a.smallSample !== b.smallSample) return a.smallSample ? 1 : -1;
    return b.line.points / b.gamesPlayed - a.line.points / a.gamesPlayed;
  });
  const playerLabel = (p: TeamExportPlayer) =>
    `${p.name}${p.isActive === false ? ' (inaktív)' : ''}${p.smallSample ? ' *' : ''}`;

  lines.push(
    `## Játékos szezon összesítés`,
    ``,
    `| # | Játékos | Poz | Meccs | Perc/m | P/m | T-Lep/m | V-Lep/m | Lep/m | Gp/m | St/m | Bl/m | LV/m | VAL/m | TS% | eFG% | USG% | P/36 | Lep/36 | Gp/36 | VAL/36 |`,
    `|---|---------|-----|-------|--------|-----|---------|---------|-------|------|------|------|------|-------|-----|------|------|------|--------|-------|--------|`,
  );
  for (const p of sortedPlayers) {
    const l = p.line;
    const pg = (value: number) => (value / p.gamesPlayed).toFixed(1);
    const fga = lineFga(l);
    const rated = !p.smallSample;
    const per36 = (value: number) => (rated && l.minutes > 0 ? ((value / l.minutes) * 36).toFixed(1) : '–');
    lines.push(
      `| ${p.number ?? '-'} | ${playerLabel(p)} | ${p.position ?? '-'} | ${p.gamesPlayed} | ${pg(l.minutes)} | ${pg(l.points)} | ${pg(l.oreb)} | ${pg(l.dreb)} | ${pg(l.reb)} | ${pg(l.ast)} | ${pg(l.stl)} | ${pg(l.blk)} | ${pg(l.tov)} | ${pg(l.val)} | ${pct(trueShootingPct(l.points, fga, l.ftAtt), rated)} | ${pct(effectiveFgPct(lineFgm(l), l.threeMade, fga), rated)} | ${pct(p.usgRate * 100, rated)} | ${per36(l.points)} | ${per36(l.reb)} | ${per36(l.ast)} | ${per36(l.val)} |`
    );
  }
  lines.push(
    ``,
    `*A tábla a csapat meccs-soraiból számol, ezért az inaktív (távozott) játékosokat is tartalmazza – összegei a csapat dobásbontásával egyeznek. A „*” jelű játékosok összperce ${MIN_SAMPLE_MINUTES} alatt van: az arány- és per-36 mutatóik kis minta miatt nem szerepelnek. USG% = (FGA + 0,44·FTA + LV) · (csapatperc / 5) / (perc · csapat FGA + 0,44·FTA + LV), a pályára lépéses meccsekre; átlag ~20%.*`,
    ``,
    `## Elérhetőség és játékidő`,
    ``,
    `| Játékos | Pályára lépett | Keretben, nem játszott | Nem volt keretben | Első meccs | Utolsó meccs | Összperc | Játékidő-részesedés |`,
    `|---------|----------------|------------------------|-------------------|------------|--------------|----------|---------------------|`,
  );
  for (const p of [...model.players].sort((a, b) => b.line.minutes - a.line.minutes)) {
    lines.push(
      `| ${playerLabel(p)} | ${p.gamesPlayed}/${overall.boxGames} | ${p.dnpGames} | ${p.missedGames} | ${p.firstDate ?? '–'} | ${p.lastDate ?? '–'} | ${p.line.minutes} | ${pct(teamCourtMinutes > 0 ? (p.line.minutes / teamCourtMinutes) * 100 : 0, teamCourtMinutes > 0)} |`
    );
  }
  lines.push(
    ``,
    `*Játékidő-részesedés = a játékos perce / a csapat összes játékideje (csapatperc / 5). A „nem volt keretben” a jegyzőkönyvből hiányzó meccsek száma – sérülés, eltiltás és a szezon közbeni érkezés / távozás is ide esik; az okot az adat nem tartalmazza.*`,
    ``,
    `## Meccsenkénti tábla (${model.games.length} meccs, időrendben)`,
    ``,
    `| Dátum | Szakasz | Ellenfél | H/V | Pihenőnap | Eredmény | Birt. | ORtg | DRtg | Net | eFG% | Ellenfél eFG% | LV | Ellenfél LV | Büntető | Ellenfél büntető | T-lep | Ellenfél T-lep |`,
    `|-------|---------|----------|-----|-----------|----------|-------|------|------|-----|------|---------------|----|-------------|---------|------------------|-------|----------------|`,
  );
  for (const g of model.games) {
    const hv = g.homeAway === 'home' ? 'Hazai' : 'Vendég';
    const res = `${g.result === 'win' ? 'Gy' : 'V'} ${g.ourScore}–${g.oppScore}`;
    const cell = (line: TeamBoxLine | null, render: (l: TeamBoxLine) => string) => (line ? render(line) : '–');
    lines.push(
      `| ${g.date} | ${g.phaseLabel} | ${g.opponent} | ${hv} | ${g.restDays ?? '–'} | ${res} | ${num(g.possessions)} | ${num(g.ortg)} | ${num(g.drtg)} | ${signed(g.net)} | ${cell(g.own, l => pct(teamRates(l).efg))} | ${cell(g.opp, l => pct(teamRates(l).efg))} | ${cell(g.own, l => `${l.tov}`)} | ${cell(g.opp, l => `${l.tov}`)} | ${cell(g.own, l => `${l.ftMade}/${l.ftAtt}`)} | ${cell(g.opp, l => `${l.ftMade}/${l.ftAtt}`)} | ${cell(g.own, l => `${l.oreb}`)} | ${cell(g.opp, l => `${l.oreb}`)} |`
    );
  }
  lines.push(
    ``,
    `*Pihenőnap = az előző meccs óta eltelt teljes napok száma (egymást követő napokon 0). A szakasz a Kosarstat versenyszakasz-címkéje; Kosarstat-link nélkül a fordulószámból következtetett alapszakasz, forduló nélkül „${PHASE_LABELS.other}”.*`,
    ``,
    `## Ellenfelenkénti összesítés`,
    ``,
    `| Ellenfél | Meccs | Mérleg | Pont | Kapott | Net |`,
    `|----------|-------|--------|------|--------|-----|`,
  );
  for (const item of model.byOpponent) {
    const agg = item.aggregate;
    lines.push(
      `| ${item.opponent} | ${agg.games} | ${record(agg)} | ${per(agg.pointsFor, agg.games)} | ${per(agg.pointsAgainst, agg.games)} | ${signed(aggregateRatings(agg).net)} |`
    );
  }
  lines.push(
    ``,
    `## Ebben az exportban nem elérhető adat`,
    ``,
    `- Lineup és on/off: nincs ötös-szintű (csere-) adat a szezon exportban.`,
    `- Negyedprofil: negyedenkénti bontás csak meccsenként, a Kosarstat blokkban érhető el.`,
    `- Liga-összehasonlító tábla: a többi csapat azonos mutatói nincsenek ebben az exportban.`,
  );

  return lines.join('\n');
}

export function pregameReportToMd(report: ScoutingReport, seasonName?: string): string {
  const lines: string[] = [
    `# Pregame scouting: ${report.ownTeamName} vs ${report.opponentTeamName}`,
    ``,
    seasonLeagueLine(report.league, report.season, seasonName),
    ``,
    `## Győzelmi valószínűség`,
    ``,
    `| Csapat | Esély |`,
    `|--------|-------|`,
    `| ${report.ownTeamName} | ${report.winProbability.ownPct.toFixed(1)}% |`,
    `| ${report.opponentTeamName} | ${report.winProbability.opponentPct.toFixed(1)}% |`,
    ``,
    `**Jósolt győztes:** ${
      report.winProbability.predictedWinner === 'own' ? report.ownTeamName :
      report.winProbability.predictedWinner === 'opponent' ? report.opponentTeamName : 'Egyenlő'
    } | **Bizonyosság:** ${report.winProbability.confidence}`,
  ];

  if (report.positionComparison.length > 0) {
    lines.push(``, `## Pozíció összehasonlítás (VAL/36)`, ``);
    lines.push(`| Poz | ${report.ownTeamName} | ${report.opponentTeamName} | Delta |`);
    lines.push(`|-----|---|---|-------|`);
    for (const pos of report.positionComparison) {
      const sign = pos.deltaValPer36 >= 0 ? '+' : '';
      const flag = pos.matchupFlag === 'critical_disadvantage' ? ' (!!)' : pos.matchupFlag === 'clear_advantage' ? ' (+)' : '';
      lines.push(`| ${pos.position} | ${pos.ownValPer36.toFixed(1)} | ${pos.oppValPer36.toFixed(1)} | ${sign}${pos.deltaValPer36.toFixed(1)}${flag} |`);
    }
  }

  if (report.teamStats) {
    const ts = report.teamStats;
    lines.push(``, `## Csapatszintű statisztikák összehasonlítás`, ``);
    lines.push(`| Mutató | ${report.ownTeamName} | ${report.opponentTeamName} |`);
    lines.push(`|--------|---|---|`);
    lines.push(`| Tempó (possz./meccs) | ${ts.own.pace.toFixed(1)} | ${ts.opponent.pace.toFixed(1)} |`);
    lines.push(`| eFG% | ${ts.own.efg.toFixed(1)}% | ${ts.opponent.efg.toFixed(1)}% |`);
    lines.push(`| 3P arány | ${ts.own.threeRate.toFixed(1)}% | ${ts.opponent.threeRate.toFixed(1)}% |`);
    lines.push(`| 3P% | ${ts.own.threePct.toFixed(1)}% | ${ts.opponent.threePct.toFixed(1)}% |`);
    lines.push(`| TO rate | ${ts.own.turnoverRate.toFixed(1)}% | ${ts.opponent.turnoverRate.toFixed(1)}% |`);
    lines.push(`| FT arány | ${ts.own.ftRate.toFixed(1)}% | ${ts.opponent.ftRate.toFixed(1)}% |`);
    lines.push(`| OREB% | ${ts.own.orebRate.toFixed(1)}% | ${ts.opponent.orebRate.toFixed(1)}% |`);
    lines.push(`| Assziszt arány | ${ts.own.assistRate.toFixed(1)}% | ${ts.opponent.assistRate.toFixed(1)}% |`);
  }

  if (report.ownTeamProfile) {
    lines.push(``, `## Saját csapat profil`, ``);
    lines.push(`**Tempó:** ${report.ownTeamProfile.tempo}`);
    if (report.ownTeamProfile.offense.length > 0) lines.push(`**Támadás:** ${report.ownTeamProfile.offense.join(', ')}`);
    if (report.ownTeamProfile.defense.length > 0) lines.push(`**Védekezés:** ${report.ownTeamProfile.defense.join(', ')}`);
  }

  lines.push(``, `## Ellenfél profil`, ``);
  lines.push(`**Tempó:** ${report.profile.tempo}`);
  if (report.profile.offense.length > 0) lines.push(`**Támadás:** ${report.profile.offense.join(', ')}`);
  if (report.profile.defense.length > 0) lines.push(`**Védekezés:** ${report.profile.defense.join(', ')}`);

  if (report.threats.length > 0) {
    lines.push(``, `## Ellenfél veszélyek`, ``);
    for (const t of report.threats) lines.push(`- ${t}`);
  }

  if (report.vulnerabilities.length > 0) {
    lines.push(``, `## Ellenfél gyenge pontok`, ``);
    for (const v of report.vulnerabilities) lines.push(`- ${v}`);
  }

  if (report.focusPoints.length > 0) {
    lines.push(``, `## Fókuszpontok`, ``);
    for (const fp of report.focusPoints) lines.push(`- ${fp}`);
  }

  if (report.riskScenarios && report.riskScenarios.length > 0) {
    lines.push(``, `## Kockázati forgatókönyvek`, ``);
    lines.push(`| Forgatókönyv | Trigger | Azonnali válasz | Saját swing |`);
    lines.push(`|---|---|---|---|`);
    for (const s of report.riskScenarios) {
      const swing = s.estimatedOwnSwingPct >= 0 ? `+${s.estimatedOwnSwingPct.toFixed(1)}%` : `${s.estimatedOwnSwingPct.toFixed(1)}%`;
      lines.push(`| ${s.title} | ${s.trigger} | ${s.instantResponse} | ${swing} |`);
    }
  }

  if (report.advancedPlayers) {
    if (report.advancedPlayers.own.length > 0) {
      lines.push(``, `## Saját kulcsjátékosok`, ``);
      lines.push(`| Játékos | Poz | Perc/meccs | PER* | WS* | VAL/36 | Pont/36 |`);
      lines.push(`|---------|-----|------------|------|-----|--------|---------|`);
      for (const p of report.advancedPlayers.own) {
        lines.push(`| ${p.name} | ${p.position} | ${p.minutesPerGame.toFixed(1)} | ${p.proxyPer.toFixed(1)} | ${p.proxyWinShare.toFixed(2)} | ${p.valPer36.toFixed(1)} | ${p.pointsPer36.toFixed(1)} |`);
      }
    }
    if (report.advancedPlayers.opponent.length > 0) {
      lines.push(``, `## Ellenfél kulcsjátékosok`, ``);
      lines.push(`| Játékos | Poz | Perc/meccs | PER* | WS* | VAL/36 | Pont/36 |`);
      lines.push(`|---------|-----|------------|------|-----|--------|---------|`);
      for (const p of report.advancedPlayers.opponent) {
        lines.push(`| ${p.name} | ${p.position} | ${p.minutesPerGame.toFixed(1)} | ${p.proxyPer.toFixed(1)} | ${p.proxyWinShare.toFixed(2)} | ${p.valPer36.toFixed(1)} | ${p.pointsPer36.toFixed(1)} |`);
      }
    }
  }

  if (report.shotProfileContext) {
    const { ownZones, opponentZones } = report.shotProfileContext;
    if (ownZones.length > 0 || opponentZones.length > 0) {
      lines.push(``, `## Dobástérkép összehasonlítás`, ``);
      lines.push(`| Zóna | Saját arány | Saját % | Δ ligától | Ellenfél arány | Ellenfél % | Δ ligától |`);
      lines.push(`|------|------------|---------|-----------|----------------|------------|-----------|`);
      const allLabels = Array.from(new Set([...ownZones.map(z => z.label), ...opponentZones.map(z => z.label)]));
      for (const label of allLabels) {
        const own = ownZones.find(z => z.label === label);
        const opp = opponentZones.find(z => z.label === label);
        const ownRateStr = own ? `${own.rate.toFixed(1)}%` : '–';
        const ownPctStr = own ? `${own.pct.toFixed(1)}%` : '–';
        const ownDeltaStr = own ? `${own.rateDeltaVsLeague >= 0 ? '+' : ''}${own.rateDeltaVsLeague.toFixed(1)}pp` : '–';
        const oppRateStr = opp ? `${opp.rate.toFixed(1)}%` : '–';
        const oppPctStr = opp ? `${opp.pct.toFixed(1)}%` : '–';
        const oppDeltaStr = opp ? `${opp.rateDeltaVsLeague >= 0 ? '+' : ''}${opp.rateDeltaVsLeague.toFixed(1)}pp` : '–';
        lines.push(`| ${label} | ${ownRateStr} | ${ownPctStr} | ${ownDeltaStr} | ${oppRateStr} | ${oppPctStr} | ${oppDeltaStr} |`);
      }
      if (report.shotProfileContext.clashZones.length > 0) {
        lines.push(``, `**Zónaütközés:** ${report.shotProfileContext.clashZones.join(', ')}`);
      }
      if (report.shotProfileContext.notes.length > 0) {
        lines.push(``);
        for (const note of report.shotProfileContext.notes) lines.push(`- ${note}`);
      }
    }
  }

  if (report.scenarioOutcomes && report.scenarioOutcomes.length > 0) {
    lines.push(``, `## Forgatókönyv valószínűségek`, ``);
    lines.push(`| Forgatókönyv | ${report.ownTeamName} | ${report.opponentTeamName} | Delta (alaptól) |`);
    lines.push(`|---|---|---|---|`);
    for (const s of report.scenarioOutcomes) {
      const deltaStr = s.deltaVsBase >= 0 ? `+${s.deltaVsBase.toFixed(1)}%` : `${s.deltaVsBase.toFixed(1)}%`;
      lines.push(`| ${s.label} | ${s.ownPct.toFixed(1)}% | ${s.opponentPct.toFixed(1)}% | ${deltaStr} |`);
    }
  }

  if (report.summary) {
    lines.push(``, `## Összefoglalás`, ``);
    lines.push(report.summary);
  }

  return lines.join('\n');
}

export function postgameReportToMd(report: PostGameReport, seasonName?: string): string {
  const result = report.result === 'win' ? 'Győzelem' : 'Vereség';
  const margin = report.metrics.margin;
  const marginStr = margin > 0 ? `+${margin}` : `${margin}`;
  const baselineLabel = report.baseline?.label ?? 'Szezon átl.';
  const ratings = report.metrics.ratings ?? null;
  const signed1 = (v: number, suffix = '') => `${v >= 0 ? '+' : ''}${v.toFixed(1)}${suffix}`;
  const refCell = (v: number | null | undefined) => (v !== null && v !== undefined ? v.toFixed(1) : '–');
  const deltaCell = (game: number, ref: number | null | undefined) =>
    ref !== null && ref !== undefined ? signed1(game - ref) : '–';

  const lines: string[] = [
    `# Postgame elemzés: ${report.teamName} vs ${report.opponentName}`,
    ``,
    seasonLeagueLine(report.league, report.season, seasonName),
    `**Eredmény:** ${result} ${report.metrics.pointsFor}–${report.metrics.pointsAgainst} (különbség: ${marginStr})`,
    `**Referencia:** ${baselineLabel}`,
  ];

  if (report.baseline?.smallSample) {
    lines.push(
      ``,
      `> **Kis minta:** a csapatnak ${report.baseline.seasonGames} meccse van a szezonban, a szezonátlag még nem értelmezhető viszonyítási alap.` +
        (report.baseline.kind === 'league'
          ? ' A deltaoszlop és a célértékek a liga mediánjához mérnek.'
          : ' Liga benchmark sem érhető el, ezért a deltaoszlop tájékoztató jellegű.')
    );
  }

  lines.push(
    ``,
    `## Kulcs mutatók`,
    ``,
    `| Mutató | Meccs | ${baselineLabel} | Delta |`,
    `|--------|-------|-------------|-------|`,
    `| Birtoklás (tempó) | ${report.metrics.pace.toFixed(1)} | ${refCell(ratings?.refPossessions)} | ${deltaCell(report.metrics.pace, ratings?.refPossessions)} |`,
  );

  // Viszonyítási alap nélkül a referencia maga a meccs – nem írunk 0-s deltát.
  const comparable = report.baseline?.comparable ?? true;
  for (const stat of report.metrics.keyStats) {
    const gameVal = stat.unit === 'pct' ? `${stat.game.toFixed(1)}%` : stat.game.toFixed(1);
    const seasonVal = !comparable ? '–' : stat.unit === 'pct' ? `${stat.season.toFixed(1)}%` : stat.season.toFixed(1);
    const delta = comparable ? signed1(stat.delta, stat.unit === 'pct' ? ' pp' : '') : '–';
    lines.push(`| ${stat.label} | ${gameVal} | ${seasonVal} | ${delta} |`);
  }

  if (ratings) {
    lines.push(
      `| ORtg | ${ratings.ortg.toFixed(1)} | ${refCell(ratings.refOrtg)} | ${deltaCell(ratings.ortg, ratings.refOrtg)} |`,
      `| DRtg (alacsonyabb a jobb) | ${ratings.drtg.toFixed(1)} | ${refCell(ratings.refDrtg)} | ${deltaCell(ratings.drtg, ratings.refDrtg)} |`,
      `| Net rating | ${signed1(ratings.net)} | ${ratings.refNet !== null ? signed1(ratings.refNet) : '–'} | ${deltaCell(ratings.net, ratings.refNet)} |`,
    );
  }

  lines.push(
    ``,
    `*Birtoklás = a két csapat (FGA + 0,44·FTA + LV − T-lep) becslésének átlaga – ez a tempó és mindkét rating közös nevezője, így a DRtg megegyezik az ellenfél ORtg-jével. TO rate (Oliver) = LV / (FGA + 0,44·FTA + LV); a Kosarstat TO% (LV / birtoklás) ettől eltér, és csak a Kosarstat blokkban szerepel. FTM rate = értékesített büntető / FGA – a liga medián is erre vonatkozik. ORtg / DRtg = szerzett / kapott pont 100 közös birtoklásra.*`
  );

  const opp = report.metrics.opponent;
  if (opp) {
    lines.push(
      ``,
      `## Ellenfél dobás és kontroll`,
      ``,
      `| Mutató | ${report.opponentName} |`,
      `|--------|-------|`,
      `| eFG% | ${opp.efg.toFixed(1)}% |`,
      `| 3P (dobott/kísérlet) | ${opp.fgm3}/${opp.fga3} (${opp.fga3 > 0 ? `${opp.threePct.toFixed(1)}%` : '–'}) |`,
      `| FTM rate (FTM/FGA) | ${opp.ftRate.toFixed(1)}% |`,
      `| OREB% | ${opp.orebRate.toFixed(1)}% |`,
      `| TO rate (Oliver) | ${opp.turnoverRate.toFixed(1)}% |`,
    );
  }

  const box = report.metrics.boxScore;
  if (box) {
    const shots = (made: number, att: number, pct: number) => (att > 0 ? `${made}/${att} (${pct.toFixed(1)}%)` : '–');
    const oppCell = (cell: (line: PostgameBoxScoreLine) => string) => (box.opponent ? cell(box.opponent) : '–');
    lines.push(
      ``,
      `## Box score alapmutatók`,
      ``,
      `| Mutató | ${report.teamName} | ${report.opponentName} |`,
      `|--------|-------|-------|`,
      `| FG (dobott/kísérlet) | ${shots(box.own.fgm, box.own.fga, box.own.fgPct)} | ${oppCell(o => shots(o.fgm, o.fga, o.fgPct))} |`,
      `| FT (dobott/kísérlet) | ${shots(box.own.ftm, box.own.fta, box.own.ftPct)} | ${oppCell(o => shots(o.ftm, o.fta, o.ftPct))} |`,
      `| Lepattanó (össz.) | ${box.own.reb} | ${oppCell(o => `${o.reb}`)} |`,
      `| Támadólepattanó | ${box.own.oreb} | ${oppCell(o => `${o.oreb}`)} |`,
      `| Védőlepattanó | ${box.own.dreb} | ${oppCell(o => `${o.dreb}`)} |`,
    );
  }

  const sources = report.metrics.pointSources;
  if (sources) {
    lines.push(
      ``,
      `## Pontforrások`,
      ``,
      `| Mutató | ${report.teamName} | ${report.opponentName} |`,
      `|--------|-------|-------|`,
      `| Második esélyből szerzett pont | ${sources.own.secondChancePoints} | ${sources.opponent.secondChancePoints} |`,
      `| Labdaeladásból szerzett pont | ${sources.own.pointsOffTurnovers} | ${sources.opponent.pointsOffTurnovers} |`,
      `| Gyors befejezés (≤ ${sources.quickFinishSeconds} mp) | ${sources.own.quickFinishPoints} | ${sources.opponent.quickFinishPoints} |`,
      ``,
      `*Számított, nem hivatalos adat: a Kosarstat eseménylistájából birtoklás-követéssel (az eseményekből összeadott pontszám egyezik a végeredménnyel). Második esély = támadólepattanó utáni pont ugyanabban a birtoklásban; labdaeladásból = az ellenfél eladott labdáját követő birtoklás pontjai; gyors befejezés = labdaszerzés vagy védőlepattanó után ${sources.quickFinishSeconds} mp-en belül szerzett pont – ez nem a jegyzőkönyvi fast break pont, hanem időalapú közelítés. A három kategória átfedhet.*`
    );
  } else if (box) {
    lines.push(
      ``,
      `*Nem elérhető adat: második esélyből, labdaeladásból és gyors befejezésből szerzett pont – ehhez a meccshez nincs (teljes) Kosarstat eseménylista, a riport nem becsüli őket.*`
    );
  }

  if (report.decisiveFactors.offense.length > 0 || report.decisiveFactors.defense.length > 0) {
    // Az irány explicit jelölése: a címke szövegéből ne kelljen kikövetkeztetni.
    const toneByLabel = new Map(report.decisiveFactorMeta.map(item => [item.label, item.tone]));
    const withTone = (label: string) => {
      const tone = toneByLabel.get(label);
      return tone ? `${tone === 'positive' ? '(+)' : '(−)'} ${label}` : label;
    };
    lines.push(``, `## Döntő tényezők`, ``);
    if (report.decisiveFactors.offense.length > 0) {
      lines.push(`**Támadás:**`);
      for (const f of report.decisiveFactors.offense) lines.push(`- ${withTone(f)}`);
    }
    if (report.decisiveFactors.defense.length > 0) {
      lines.push(`**Védekezés:**`);
      for (const f of report.decisiveFactors.defense) lines.push(`- ${withTone(f)}`);
    }
    lines.push(``, `*(+) a saját csapatnak kedvező, (−) kedvezőtlen tényező. Jelöletlen értékpárnál a „vs” előtti érték a saját csapaté; az ellenfél értékét „ellenfél” felirat jelöli.*`);
  }

  if (report.playerReport.players.length > 0) {
    lines.push(``, `## Játékos bontás`, ``);
    lines.push(`| Játékos | Poz | Perc | Pont | Lep | Gp | St+Bl | LV | TS% | VAL | VAL/36 | Usage% | Impact | Hatás |`);
    lines.push(`|---------|-----|------|------|-----|----|-------|-----|-----|-----|--------|--------|--------|-------|`);
    for (const p of report.playerReport.players) {
      const ts = p.hasShotAttempts ? `${p.tsPct.toFixed(1)}%` : '-';
      lines.push(`| ${p.name} | ${p.position} | ${p.minutes} | ${p.points} | ${p.rebounds} | ${p.assists} | ${p.stocks} | ${p.turnovers} | ${ts} | ${p.val.toFixed(1)} | ${p.valPer36.toFixed(1)} | ${(p.usageShare * 100).toFixed(1)}% | ${p.impactScore.toFixed(1)} | ${p.impactLabel} |`);
    }
    lines.push(
      ``,
      `*Sorrend és címke az Impact score alapján (VAL/36 45%, TS% 25%, usage 20%, St+Bl 10%), nem a nyers VAL szerint. A meccs legjobbjától legfeljebb 10%-kal elmaradó játékosok ugyanazt a vezető címkét kapják. Usage% = standard USG% = (FGA + 0,44·FTA + LV) · (csapatperc / 5) / (perc · csapat FGA + 0,44·FTA + LV); átlag ~20%, alacsony ≤ 15%, magas ≥ 25%.*`
    );
  }

  if (report.strengths.length > 0) {
    lines.push(``, `## Erősségek`, ``);
    for (const s of report.strengths) lines.push(`- ${s}`);
  }

  if (report.problems.length > 0) {
    lines.push(``, `## Problémák`, ``);
    for (const p of report.problems) lines.push(`- ${p}`);
  }

  if (report.nextFocus.length > 0) {
    lines.push(``, `## Következő fókusz`, ``);
    for (const f of report.nextFocus) lines.push(`- ${f}`);
  }

  const { playerImpact } = report;
  const hasImpact = playerImpact.overperformers.length > 0 || playerImpact.underperformers.length > 0 ||
    playerImpact.positive.length > 0 || playerImpact.negative.length > 0;
  if (hasImpact) {
    lines.push(``, `## Játékos kiemelések`, ``);
    if (playerImpact.overperformers.length > 0)
      lines.push(`**Kiugró teljesítmény:** ${playerImpact.overperformers.join(', ')}`);
    if (playerImpact.positive.length > 0)
      lines.push(`**Pozitív hatás (alacsony usage):** ${playerImpact.positive.join(', ')}`);
    if (playerImpact.underperformers.length > 0)
      lines.push(`**Gyenge meccs:** ${playerImpact.underperformers.join(', ')}`);
    if (playerImpact.negative.length > 0)
      lines.push(`**Limitált hatás (magas usage):** ${playerImpact.negative.join(', ')}`);
  }

  // Adatminőség: ellenfél-adat, dobástérkép–box score eltérés, névillesztés,
  // Kosarstat import-állapot. (A Kosarstat-kiegészítés utólag fűzi hozzá a
  // saját megjegyzéseit, ezért nem mind szerepel az összefoglalóban.)
  if (report.dataNotes.length > 0) {
    lines.push(``, `## Adatminőség és megjegyzések`, ``);
    for (const note of report.dataNotes) lines.push(`- ${note}`);
  }

  if (report.reflection.xFactor || report.reflection.risk) {
    lines.push(``, `## Reflexió`, ``);
    if (report.reflection.xFactor) lines.push(report.reflection.xFactor);
    if (report.reflection.risk) lines.push(report.reflection.risk);
  }

  if (report.summary) {
    lines.push(``, `## Összefoglalás`, ``);
    lines.push(report.summary);
  }

  return lines.join('\n');
}
