import type { PlayerStats, TeamGame, GameAggregate } from './dashboard-types';
import type { ScoutingReport } from './pregame-scouting';
import type { PostGameReport } from './postgame-report';

function fmtPct(made: number, attempted: number): string {
  return attempted > 0 ? `${((made / attempted) * 100).toFixed(1)}%` : '-';
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
  impactLabel: string;
  summaryLine: string;
  val: number;
  valPer36: number;
  tsPct: number;
  usageShare: number;
  minutes: number;
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

  const efg = fga > 0 ? ((fgm + 0.5 * fgm3) / fga) * 100 : 0;
  const ts = fga > 0 || fta > 0
    ? (game.total_points / (2 * (fga + 0.44 * fta))) * 100
    : 0;
  const tovDenom = fga + 0.44 * fta + game.turnovers;
  const toRate = tovDenom > 0 ? (game.turnovers / tovDenom) * 100 : 0;
  const assistRate = fgm > 0 ? (game.assists / fgm) * 100 : 0;
  const orebRate = game.total_rebounds > 0
    ? (game.offensive_rebounds / game.total_rebounds) * 100
    : 0;
  // Megjegyzés: helyes OREB% = oreb / (oreb + ellenfél_dreb), de az ellenfél dreb adat nem érhető el itt.
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
  const avgEfg = avgFga > 0 ? ((avgFgm + 0.5 * avgFgm3) / avgFga) * 100 : 0;
  const avgTs = avgFga > 0 || avgFta > 0
    ? (game.avg_total_points / (2 * (avgFga + 0.44 * avgFta))) * 100
    : 0;
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
    `| OREB% (saját lep.-on belül) | ${orebRate.toFixed(1)}% | – | – |`,
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
        `| ${b.name} | ${b.position} | ${b.minutes} | – | – | – | – | – | ${tsStr} | ${b.val.toFixed(1)} | ${b.valPer36.toFixed(1)} | ${(b.usageShare * 100).toFixed(1)}% | ${b.impactLabel} |`
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
    `| True Shooting % | ${(player.trueShootingPct * 100).toFixed(1)}% |`,
    `| Effective FG % | ${(player.effectiveShootingPct * 100).toFixed(1)}% |`,
    `| Offenzív index | ${player.offensiveRating.toFixed(1)} |`,
    `| Defenzív index | ${player.defensiveRating.toFixed(1)} |`,
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

export function teamStatsToMd(
  players: PlayerStats[],
  games: TeamGame[],
  gameStats: GameAggregate,
  teamName?: string,
  seasonName?: string
): string {
  const totalGames = games.length;
  const wins = games.filter(g => g.result === 'win').length;
  const losses = totalGames - wins;

  const lines: string[] = [
    `# Csapat szezonstatisztikák: ${teamName ?? 'Csapat'}`,
    ``,
    ...(seasonName ? [`**Szezon:** ${seasonName}`] : []),
    `**Meccsek:** ${totalGames} (${wins}W – ${losses}L)`,
    ``,
    `## Csapat átlagok (meccsenkénti)`,
    ``,
    `| Statisztika | Átlag/meccs |`,
    `|-------------|-------------|`,
    `| Pontok | ${gameStats.avgPoints.toFixed(1)} |`,
    `| Lepattanók | ${gameStats.avgRebounds.toFixed(1)} |`,
    `| Gólpasszok | ${gameStats.avgAssists.toFixed(1)} |`,
    `| Labdaszerzések | ${gameStats.avgSteals.toFixed(1)} |`,
    `| Blokkök | ${gameStats.avgBlocks.toFixed(1)} |`,
    `| Labdavesztések | ${gameStats.avgTurnovers.toFixed(1)} |`,
    `| Valuation | ${gameStats.avgValuation.toFixed(1)} |`,
    ``,
    `## Játékos szezon összesítés`,
    ``,
    `| # | Játékos | Poz | Meccs | P/meccs | Min/meccs | T-Lep/m | V-Lep/m | Lep/m | Gp/m | St/m | Bl/m | LV/m | VAL | TS% | EFG% |`,
    `|---|---------|-----|-------|---------|-----------|---------|---------|-------|------|------|------|------|-----|-----|------|`,
  ];

  const sorted = [...players].sort(
    (a, b) => b.points / Math.max(b.gamesPlayed, 1) - a.points / Math.max(a.gamesPlayed, 1)
  );

  for (const p of sorted) {
    const g = Math.max(p.gamesPlayed, 1);
    const pp = (n: number) => (n / g).toFixed(1);
    lines.push(
      `| ${p.number} | ${p.name} | ${p.position} | ${p.gamesPlayed} | ${pp(p.points)} | ${pp(p.minutes)} | ${pp(p.rebounds.offensive)} | ${pp(p.rebounds.defensive)} | ${pp(p.rebounds.total)} | ${pp(p.assists)} | ${pp(p.steals)} | ${pp(p.blocks)} | ${pp(p.turnovers)} | ${p.valuation.toFixed(1)} | ${(p.trueShootingPct * 100).toFixed(1)}% | ${(p.effectiveShootingPct * 100).toFixed(1)}% |`
    );
  }

  lines.push(``);
  lines.push(`## Meccseredmények (legutóbbi 20)`);
  lines.push(``);
  lines.push(`| Dátum | Ellenfél | H/V | Mi | Ők | Eredmény |`);
  lines.push(`|-------|----------|-----|----|----|---------|`);

  for (const g of games.slice(0, 20)) {
    const hv = g.homeAway === 'home' ? 'Hazai' : 'Vendég';
    const res = g.result === 'win' ? 'Győzelem' : 'Vereség';
    lines.push(`| ${g.date} | ${g.opponent} | ${hv} | ${g.ourScore} | ${g.oppScore} | ${res} |`);
  }

  return lines.join('\n');
}

export function pregameReportToMd(report: ScoutingReport): string {
  const lines: string[] = [
    `# Pregame scouting: ${report.ownTeamName} vs ${report.opponentTeamName}`,
    ``,
    `**Liga:** ${report.league} | **Szezon:** ${report.season}`,
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

export function postgameReportToMd(report: PostGameReport): string {
  const result = report.result === 'win' ? 'Győzelem' : 'Vereség';
  const margin = report.metrics.margin;
  const marginStr = margin > 0 ? `+${margin}` : `${margin}`;

  const lines: string[] = [
    `# Postgame elemzés: ${report.teamName} vs ${report.opponentName}`,
    ``,
    `**Szezon:** ${report.season} | **Liga:** ${report.league}`,
    `**Eredmény:** ${result} ${report.metrics.pointsFor}–${report.metrics.pointsAgainst} (különbség: ${marginStr})`,
    ``,
    `## Kulcs mutatók`,
    ``,
    `| Mutató | Meccs | Szezon átl. | Delta |`,
    `|--------|-------|-------------|-------|`,
    `| EFG% | ${report.metrics.efg.toFixed(1)}% | – | – |`,
    `| Tempó | ${report.metrics.pace.toFixed(1)} | – | – |`,
  ];

  for (const stat of report.metrics.keyStats) {
    const gameVal = stat.unit === 'pct' ? `${stat.game.toFixed(1)}%` : stat.game.toFixed(1);
    const seasonVal = stat.unit === 'pct' ? `${stat.season.toFixed(1)}%` : stat.season.toFixed(1);
    const delta = stat.delta >= 0 ? `+${stat.delta.toFixed(1)}${stat.unit === 'pct' ? '%' : ''}` : `${stat.delta.toFixed(1)}${stat.unit === 'pct' ? '%' : ''}`;
    lines.push(`| ${stat.label} | ${gameVal} | ${seasonVal} | ${delta} |`);
  }

  if (report.decisiveFactors.offense.length > 0 || report.decisiveFactors.defense.length > 0) {
    lines.push(``, `## Döntő tényezők`, ``);
    if (report.decisiveFactors.offense.length > 0) {
      lines.push(`**Támadás:**`);
      for (const f of report.decisiveFactors.offense) lines.push(`- ${f}`);
    }
    if (report.decisiveFactors.defense.length > 0) {
      lines.push(`**Védekezés:**`);
      for (const f of report.decisiveFactors.defense) lines.push(`- ${f}`);
    }
  }

  if (report.playerReport.players.length > 0) {
    lines.push(``, `## Játékos bontás`, ``);
    lines.push(`| Játékos | Poz | Perc | Pont | Lep | Gp | St+Bl | LV | TS% | VAL | Hatás |`);
    lines.push(`|---------|-----|------|------|-----|----|-------|-----|-----|-----|-------|`);
    for (const p of report.playerReport.players) {
      const ts = p.hasShotAttempts ? `${(p.tsPct * 100).toFixed(1)}%` : '-';
      lines.push(`| ${p.name} | ${p.position} | ${p.minutes} | ${p.points} | ${p.rebounds} | ${p.assists} | ${p.stocks} | ${p.turnovers} | ${ts} | ${p.val.toFixed(1)} | ${p.impactLabel} |`);
    }
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

  return lines.join('\n');
}
