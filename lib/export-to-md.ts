import type { PlayerStats, TeamGame, GameAggregate } from './dashboard-types';

function fmtPct(made: number, attempted: number): string {
  return attempted > 0 ? `${((made / attempted) * 100).toFixed(1)}%` : '-';
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

export function gameStatsToMd(game: GameComparisonExport, players: PlayerGameStatExport[]): string {
  const homeAway = game.home_away === 'home' ? 'Hazai' : 'Vendég';
  const result = game.result === 'win' ? 'Győzelem' : 'Vereség';
  const date = new Date(game.date).toLocaleDateString('hu-HU');
  const n = (v: number | undefined) => (v ?? 0).toFixed(1);

  const lines: string[] = [
    `# Meccs elemzés: ${game.team_name} vs ${game.opponent}`,
    ``,
    `**Dátum:** ${date} | **Szezon:** ${game.season_name} | **Helyszín:** ${homeAway}`,
    `**Eredmény:** ${result} ${game.our_score}–${game.opp_score}`,
    ``,
    `## Csapatszintű dobásstatisztikák`,
    ``,
    `| Zóna | Kísérlet | Szerzett | % | Szezon átl. kísérlet | Szezon átl. % | Pontok | Átl. pontok |`,
    `|------|----------|----------|---|----------------------|---------------|--------|-------------|`,
    `| Közeli | ${game.close_attempted} | ${game.close_made} | ${fmtPct(game.close_made, game.close_attempted)} | ${n(game.avg_close_attempted)} | ${n(game.avg_close_percentage)}% | ${game.close_points} | ${n(game.avg_close_points)} |`,
    `| Középtáv | ${game.mid_attempted} | ${game.mid_made} | ${fmtPct(game.mid_made, game.mid_attempted)} | ${n(game.avg_mid_attempted)} | ${n(game.avg_mid_percentage)}% | ${game.mid_points} | ${n(game.avg_mid_points)} |`,
    `| Hárompontos | ${game.three_attempted} | ${game.three_made} | ${fmtPct(game.three_made, game.three_attempted)} | ${n(game.avg_three_attempted)} | ${n(game.avg_three_percentage)}% | ${game.three_points} | ${n(game.avg_three_points)} |`,
    `| Büntető | ${game.free_throw_attempted} | ${game.free_throw_made} | ${fmtPct(game.free_throw_made, game.free_throw_attempted)} | ${n(game.avg_free_throw_attempted)} | ${n(game.avg_free_throw_percentage)}% | ${game.free_throw_points} | ${n(game.avg_free_throw_points)} |`,
    `| **Összesen** | | | | | | **${game.total_points}** | **${n(game.avg_total_points)}** |`,
    ``,
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
    ``,
    `## Játékos statisztikák`,
    ``,
    `| # | Játékos | Poz | Perc | Pont | Közeli | Középtáv | 3P | Büntető | T-Lep | V-Lep | Lep | Gp | St | Bl | LV | Fault | +/- | VAL |`,
    `|---|---------|-----|------|------|--------|----------|----|---------|-------|-------|-----|----|----|----|----|-------|-----|-----|`,
  ];

  for (const p of players) {
    const pm = p.plus_minus >= 0 ? `+${p.plus_minus}` : `${p.plus_minus}`;
    lines.push(
      `| ${p.player_number} | ${p.player_name} | ${p.player_position ?? '-'} | ${p.minutes} | ${p.points} | ${p.close_made}/${p.close_attempted} | ${p.mid_made}/${p.mid_attempted} | ${p.three_made}/${p.three_attempted} | ${p.free_throw_made}/${p.free_throw_attempted} | ${p.offensive_rebounds} | ${p.defensive_rebounds} | ${p.total_rebounds} | ${p.assists} | ${p.steals} | ${p.blocks} | ${p.turnovers} | ${p.fouls_committed} | ${pm} | ${p.valuation} |`
    );
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
