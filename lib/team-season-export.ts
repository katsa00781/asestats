import type { PlayerStats, TeamGame } from './dashboard-types';
import { computeUsgRate } from './player-postgame';

// A csapat szezon-export adatmodellje. Minden csapatszintű szám ugyanabból a
// meccshalmazból és a meccsenkénti box score sorokból számolódik, így a
// fejléc, az átlagok, a dobásbontás és a játékostábla egymással egyeztethető.
// (Korábban a pontátlag a meccsek végeredményéből, a többi mutató viszont a
// szezon view aktív játékosaiból jött – a kettő más meccshalmazt fedett.)

/** A szezonspecifikus player_game_stats sor exporthoz szükséges mezői. */
export type TeamExportStatRow = {
  game_id: string;
  player_id: string;
  minutes?: number | null;
  points?: number | null;
  close_made?: number | null;
  close_attempted?: number | null;
  mid_made?: number | null;
  mid_attempted?: number | null;
  three_made?: number | null;
  three_attempted?: number | null;
  free_throw_made?: number | null;
  free_throw_attempted?: number | null;
  offensive_rebounds?: number | null;
  defensive_rebounds?: number | null;
  total_rebounds?: number | null;
  assists?: number | null;
  steals?: number | null;
  blocks?: number | null;
  turnovers?: number | null;
  fouls_committed?: number | null;
  valuation?: number | null;
  players?: {
    name?: string | null;
    number?: number | null;
    position?: string | null;
    is_active?: boolean | null;
  } | null;
};

export type TeamBoxLine = {
  minutes: number;
  points: number;
  closeMade: number;
  closeAtt: number;
  midMade: number;
  midAtt: number;
  threeMade: number;
  threeAtt: number;
  ftMade: number;
  ftAtt: number;
  oreb: number;
  dreb: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
  val: number;
};

export type TeamExportPhase = 'regular' | 'playoff' | 'other';

export const PHASE_LABELS: Record<TeamExportPhase, string> = {
  regular: 'Alapszakasz',
  playoff: 'Rájátszás',
  other: 'Kupa / nem azonosított',
};

export type TeamExportGame = {
  id: string;
  date: string;
  opponent: string;
  homeAway: 'home' | 'away';
  ourScore: number;
  oppScore: number;
  result: 'win' | 'loss';
  phase: TeamExportPhase;
  phaseLabel: string;
  /** Az előző meccs óta eltelt teljes pihenőnapok száma (az első meccsnél null). */
  restDays: number | null;
  own: TeamBoxLine | null;
  opp: TeamBoxLine | null;
  possessions: number | null;
  ortg: number | null;
  drtg: number | null;
  net: number | null;
};

export type TeamExportAggregate = {
  games: number;
  wins: number;
  losses: number;
  /** Végeredményből, a halmaz minden meccsére. */
  pointsFor: number;
  pointsAgainst: number;
  /** Saját box score-ral fedett meccsek és azok összesítője. */
  boxGames: number;
  own: TeamBoxLine;
  /** Ellenfél box score-ral is fedett meccsek: saját és ellenfél összesítő ugyanarra a halmazra. */
  pairedGames: number;
  pairedOwn: TeamBoxLine;
  opp: TeamBoxLine;
  /** Birtoklás-alapú mutatók nevezője és számlálói (a box score-os meccsekre). */
  possessions: number;
  ratingPointsFor: number;
  ratingPointsAgainst: number;
};

export type TeamExportPlayer = {
  playerId: string;
  name: string;
  number: number | null;
  position: string | null;
  isActive: boolean | null;
  /** Meccsek, ahol pályára lépett (perc > 0). */
  gamesPlayed: number;
  /** Jegyzőkönyvben szerepelt, de nem lépett pályára. */
  dnpGames: number;
  /** Box score-os csapatmeccsek, ahol nem volt a jegyzőkönyvben. */
  missedGames: number;
  firstDate: string | null;
  lastDate: string | null;
  line: TeamBoxLine;
  /** Standard USG% (0–1) a pályára lépéses meccsek csapatadataihoz mérve. */
  usgRate: number;
  /** A percminta a küszöb alatt van: az arány- és per-36 mutatók nem értelmezhetők. */
  smallSample: boolean;
};

export type TeamExportOpponentSummary = {
  opponent: string;
  aggregate: TeamExportAggregate;
};

/** A `kosarstat_game_quarter_stats` sor exporthoz szükséges mezői. */
export type TeamExportQuarterRow = {
  kosarstat_game_id: string;
  team_side: string;
  quarter: number;
  points: number;
};

export type TeamExportQuarterLine = {
  label: string;
  games: number;
  pointsFor: number;
  pointsAgainst: number;
  won: number;
  tied: number;
  lost: number;
};

export type TeamExportQuarterProfile = {
  /** Meccsek, ahol a negyedek összege egyezik a végeredménnyel. */
  games: number;
  quarters: TeamExportQuarterLine[];
  halves: TeamExportQuarterLine[];
};

/** Egy ötös összesített pályán töltött ideje és pontjai (Kosarstat lineup adat). */
export type TeamExportLineupStint = {
  players: string[];
  seconds: number;
  teamPts: number;
  oppPts: number;
};

export type TeamExportLineupInput = {
  /** Ennyi meccs lineup-adata van összevonva. */
  games: number;
  stints: TeamExportLineupStint[];
};

export type TeamExportOnOff = {
  player: string;
  onSeconds: number;
  onFor: number;
  onAgainst: number;
  offSeconds: number;
  offFor: number;
  offAgainst: number;
};

export type TeamExportLineups = {
  games: number;
  totalSeconds: number;
  totalFor: number;
  totalAgainst: number;
  /** A legtöbbet együtt játszó ötösök, percek szerint csökkenően. */
  lineups: TeamExportLineupStint[];
  /** Játékosonkénti on/off, pályán töltött idő szerint csökkenően. */
  onOff: TeamExportOnOff[];
};

export type TeamExportLeagueRow = {
  teamId: string;
  teamName: string;
  /** A csapat alapszakasz-összesítője. */
  aggregate: TeamExportAggregate;
};

export type TeamSeasonExport = {
  quarterProfile: TeamExportQuarterProfile | null;
  lineups: TeamExportLineups | null;
  overall: TeamExportAggregate;
  home: TeamExportAggregate;
  away: TeamExportAggregate;
  byPhase: Array<{ phase: TeamExportPhase; aggregate: TeamExportAggregate }>;
  byOpponent: TeamExportOpponentSummary[];
  /** Időrendben (legrégebbi elöl). */
  games: TeamExportGame[];
  players: TeamExportPlayer[];
  dataNotes: string[];
};

export type TeamSeasonExportInput = {
  games: TeamGame[];
  /** A saját és az ellenfél-nézetű meccsek játékos-sorai (game_id alapján válogatva). */
  statRows: TeamExportStatRow[];
  /** Szezon view játékosok – a mezszám / pozíció / aktív flag forrása. */
  players: PlayerStats[];
  seasonName?: string;
  resolveTeamName?: (teamId: string) => string | undefined;
  /** Kosarstat negyedenkénti pontok a csapat linkelt meccseire (opcionális). */
  quarterRows?: TeamExportQuarterRow[];
  /** Szezonszintű Kosarstat ötös-adat (opcionális). */
  lineups?: TeamExportLineupInput;
};

/** Ennyi összperc alatt a játékos arány- és per-36 mutatói nem jelennek meg. */
export const MIN_SAMPLE_MINUTES = 100;

const REGULATION_TEAM_MINUTES = 200;
const OVERTIME_TEAM_MINUTES = 25;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Ennyi ötös kerül a lineup-táblába. */
const TOP_LINEUPS = 10;
/** Ekkora relatív eltérés fölött a két csapat birtoklásbecslése adathibára utal. */
const POSSESSION_GAP_LIMIT = 0.15;

const emptyLine = (): TeamBoxLine => ({
  minutes: 0, points: 0,
  closeMade: 0, closeAtt: 0, midMade: 0, midAtt: 0, threeMade: 0, threeAtt: 0, ftMade: 0, ftAtt: 0,
  oreb: 0, dreb: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, val: 0,
});

const rowToLine = (row: TeamExportStatRow): TeamBoxLine => ({
  minutes: row.minutes ?? 0,
  points: row.points ?? 0,
  closeMade: row.close_made ?? 0,
  closeAtt: row.close_attempted ?? 0,
  midMade: row.mid_made ?? 0,
  midAtt: row.mid_attempted ?? 0,
  threeMade: row.three_made ?? 0,
  threeAtt: row.three_attempted ?? 0,
  ftMade: row.free_throw_made ?? 0,
  ftAtt: row.free_throw_attempted ?? 0,
  oreb: row.offensive_rebounds ?? 0,
  dreb: row.defensive_rebounds ?? 0,
  reb: row.total_rebounds ?? 0,
  ast: row.assists ?? 0,
  stl: row.steals ?? 0,
  blk: row.blocks ?? 0,
  tov: row.turnovers ?? 0,
  pf: row.fouls_committed ?? 0,
  val: row.valuation ?? 0,
});

const addInto = (target: TeamBoxLine, source: TeamBoxLine) => {
  (Object.keys(target) as Array<keyof TeamBoxLine>).forEach(key => {
    target[key] += source[key];
  });
};

export const lineFga = (line: TeamBoxLine) => line.closeAtt + line.midAtt + line.threeAtt;
export const lineFgm = (line: TeamBoxLine) => line.closeMade + line.midMade + line.threeMade;

/** Dobás-, büntető- és labdavesztés-terhelés: FGA + 0,44·FTA + LV (az Oliver TO rate és a USG% nevezője). */
export const lineUsage = (line: TeamBoxLine) => lineFga(line) + 0.44 * line.ftAtt + line.tov;

/** Egy csapat birtoklásbecslése: FGA + 0,44·FTA + LV − T-lep. */
const estimatePossessions = (line: TeamBoxLine) => Math.max(lineUsage(line) - line.oreb, 0);

/** A szezon neve („2025/2026”) alapján várható dátumablak: júl. 1. – jún. 30. */
const seasonWindowFromName = (seasonName?: string): { start: string; end: string } | null => {
  const match = seasonName?.match(/^(\d{4})\/(\d{4})$/);
  if (!match) return null;
  return { start: `${match[1]}-07-01`, end: `${match[2]}-06-30` };
};

const PLAYOFF_PATTERN = /döntő|helyért|rájátszás|playoff/i;

const isRegularSeasonLabel = (competitionPhase?: string | null) => /alapszakasz/i.test(competitionPhase ?? '');

/** A címkézett alapszakasz-meccsek vége: az utolsó dátum és a legnagyobb forduló. */
export type RegularSeasonBounds = { lastDate: string; maxRound: number };

/**
 * Versenyszakasz: elsődleges a Kosarstat `competition_phase` címkéje.
 *
 * Címke nélküli meccsnél a fordulószám alapszakaszra utal – kivéve, ha a
 * meccs az utolsó címkézett alapszakasz-meccs után van, és a fordulója nem
 * nagyobb az addigi legnagyobbnál: a helyosztók „5. helyért” szövegéből a
 * fordulószám 5 lesz, ezek rájátszás-meccsek. (A még nem linkelt, soron
 * következő forduló száma nagyobb, így alapszakasz marad.) Forduló nélkül
 * (pl. kupameccs) a szakasz nem azonosítható.
 */
export const classifyPhase = (
  competitionPhase?: string | null,
  round?: number | null,
  context?: { date: string; regularSeason: RegularSeasonBounds | null }
): { phase: TeamExportPhase; label: string } => {
  const label = competitionPhase?.trim();
  if (label) {
    if (isRegularSeasonLabel(label)) return { phase: 'regular', label: PHASE_LABELS.regular };
    if (PLAYOFF_PATTERN.test(label)) return { phase: 'playoff', label };
    return { phase: 'other', label };
  }
  if (typeof round !== 'number') return { phase: 'other', label: PHASE_LABELS.other };

  const bounds = context?.regularSeason;
  if (bounds && context.date > bounds.lastDate && round <= bounds.maxRound) {
    return { phase: 'playoff', label: `${PHASE_LABELS.playoff} (dátum alapján)` };
  }
  return { phase: 'regular', label: `${PHASE_LABELS.regular} (${round}. forduló alapján)` };
};

const emptyAggregate = (): TeamExportAggregate => ({
  games: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0,
  boxGames: 0, own: emptyLine(),
  pairedGames: 0, pairedOwn: emptyLine(), opp: emptyLine(),
  possessions: 0, ratingPointsFor: 0, ratingPointsAgainst: 0,
});

const aggregateGames = (games: TeamExportGame[]): TeamExportAggregate => {
  const agg = emptyAggregate();
  games.forEach(game => {
    agg.games += 1;
    if (game.result === 'win') agg.wins += 1;
    else agg.losses += 1;
    agg.pointsFor += game.ourScore;
    agg.pointsAgainst += game.oppScore;
    if (game.own) {
      agg.boxGames += 1;
      addInto(agg.own, game.own);
      if (game.opp) {
        agg.pairedGames += 1;
        addInto(agg.pairedOwn, game.own);
        addInto(agg.opp, game.opp);
      }
    }
    if (game.possessions !== null) {
      agg.possessions += game.possessions;
      agg.ratingPointsFor += game.ourScore;
      agg.ratingPointsAgainst += game.oppScore;
    }
  });
  return agg;
};

const dayDiff = (from: string, to: string) =>
  Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / DAY_MS);

export function buildTeamSeasonExport(input: TeamSeasonExportInput): TeamSeasonExport {
  const dataNotes: string[] = [];
  const sortedGames = [...input.games].sort((a, b) => a.date.localeCompare(b.date));

  // A szezon dátumablakán kívüli meccs hibás szezon-hozzárendelés (rossz
  // slug/szezon párossal futtatott import) – nem keverjük a szezon számaiba.
  const window = seasonWindowFromName(input.seasonName);
  const inSeason = window
    ? sortedGames.filter(game => game.date >= window.start && game.date <= window.end)
    : sortedGames;
  const excluded = sortedGames.length - inSeason.length;
  if (window && excluded > 0) {
    const outside = sortedGames.filter(game => game.date < window.start || game.date > window.end);
    dataNotes.push(
      `${excluded} meccs dátuma (${outside[0].date} – ${outside[outside.length - 1].date}) a(z) ${input.seasonName} szezonon kívül esik: ` +
        `hibás szezon-hozzárendelés az adatbázisban. Ezek a meccsek és a hozzájuk tartozó játékos-sorok az exportból kimaradtak.`
    );
  }

  const rowsByGame = new Map<string, TeamExportStatRow[]>();
  input.statRows.forEach(row => {
    const list = rowsByGame.get(row.game_id);
    if (list) list.push(row);
    else rowsByGame.set(row.game_id, [row]);
  });

  const teamLine = (gameId?: string): TeamBoxLine | null => {
    const rows = gameId ? rowsByGame.get(gameId) : undefined;
    if (!rows || rows.length === 0) return null;
    const line = emptyLine();
    rows.forEach(row => addInto(line, rowToLine(row)));
    return line;
  };

  const regularSeason = inSeason
    .filter(game => isRegularSeasonLabel(game.competitionPhase))
    .reduce<RegularSeasonBounds | null>((bounds, game) => ({
      lastDate: bounds && bounds.lastDate > game.date ? bounds.lastDate : game.date,
      maxRound: Math.max(bounds?.maxRound ?? 0, game.round ?? 0),
    }), null);

  // Egy box score csak akkor használható, ha a játékos-sorok pontösszege
  // egyezik a végeredménnyel – a duplán importált vagy csonka jegyzőkönyv
  // minden ráépülő mutatót torzítana.
  const invalidOwn: string[] = [];
  const invalidOpp: string[] = [];
  const invalidBoxGameIds = new Set<string>();

  const games: TeamExportGame[] = inSeason.map((game, index) => {
    const rawOwn = teamLine(game.id);
    const rawOpp = teamLine(game.opponentGameId);
    const own = rawOwn && rawOwn.points === game.ourScore ? rawOwn : null;
    const opp = rawOpp && rawOpp.points === game.oppScore ? rawOpp : null;
    if (rawOwn && !own) {
      invalidOwn.push(`${game.date} (${rawOwn.points} vs ${game.ourScore})`);
      invalidBoxGameIds.add(game.id);
    }
    if (rawOpp && !opp) {
      invalidOpp.push(`${game.date} (${rawOpp.points} vs ${game.oppScore})`);
      invalidBoxGameIds.add(game.id);
    }
    // A birtoklás a két csapat becslésének átlaga (ez a tempó és mindkét
    // rating közös nevezője); ellenfél box score nélkül csak a saját becslés.
    const possessions = own
      ? opp
        ? (estimatePossessions(own) + estimatePossessions(opp)) / 2
        : estimatePossessions(own)
      : null;
    const hasRating = possessions !== null && possessions > 0;
    const ortg = hasRating ? (game.ourScore / possessions) * 100 : null;
    const drtg = hasRating ? (game.oppScore / possessions) * 100 : null;
    const { phase, label } = classifyPhase(game.competitionPhase, game.round, { date: game.date, regularSeason });
    const canonicalOpponent = game.opponentTeamId ? input.resolveTeamName?.(game.opponentTeamId) : undefined;
    return {
      id: game.id,
      date: game.date,
      opponent: canonicalOpponent ?? game.opponent,
      homeAway: game.homeAway,
      ourScore: game.ourScore,
      oppScore: game.oppScore,
      result: game.result,
      phase,
      phaseLabel: label,
      restDays: index > 0 ? Math.max(dayDiff(inSeason[index - 1].date, game.date) - 1, 0) : null,
      own,
      opp,
      possessions: hasRating ? possessions : null,
      ortg,
      drtg,
      net: ortg !== null && drtg !== null ? ortg - drtg : null,
    };
  });

  // --- Adatminőség: lefedettség és a box score ↔ végeredmény egyezése ---
  if (invalidOwn.length > 0) {
    dataNotes.push(
      `${invalidOwn.length} meccsen a saját játékos-sorok pontösszege eltér a végeredménytől (${invalidOwn.join(', ')}): ` +
        `hibás box score, a box score-alapú mutatókból kimaradt.`
    );
  }
  if (invalidOpp.length > 0) {
    dataNotes.push(
      `${invalidOpp.length} meccsen az ellenfél játékos-sorainak pontösszege eltér a végeredménytől (${invalidOpp.join(', ')}): ` +
        `hibás (pl. duplán importált) ellenfél box score, az ellenfél-mutatókból kimaradt; a birtoklás ott csak a saját becslés.`
    );
  }
  const withoutBox = games.filter(game => !game.own && !invalidBoxGameIds.has(game.id));
  if (withoutBox.length > 0) {
    dataNotes.push(
      `${withoutBox.length} meccshez nincs saját box score (${withoutBox.map(game => game.date).join(', ')}): ` +
        `ezek a végeredménnyel szerepelnek, a box score-alapú mutatókban nem.`
    );
  }
  const withoutOpp = games.filter(game => game.own && !game.opp && !invalidBoxGameIds.has(game.id));
  if (withoutOpp.length > 0) {
    dataNotes.push(
      `${withoutOpp.length} meccshez nincs ellenfél box score (${withoutOpp.map(game => game.date).join(', ')}): ` +
        `az ellenfél-mutatók és az OREB% ezek nélkül számolódnak, a birtoklás ott csak a saját becslés.`
    );
  }
  const minuteMismatch = games.filter(game => {
    if (!game.own) return false;
    const extra = game.own.minutes - REGULATION_TEAM_MINUTES;
    return extra < 0 || extra % OVERTIME_TEAM_MINUTES !== 0;
  });
  if (minuteMismatch.length > 0) {
    dataNotes.push(
      `${minuteMismatch.length} meccsen a csapat összperce nem 200 (+25 hosszabbításonként): ` +
        minuteMismatch.map(game => `${game.date} (${game.own?.minutes})`).join(', ') + ' – hiányos box score lehet.'
    );
  }
  const possessionGap = games.filter(game => {
    if (!game.own || !game.opp) return false;
    const ownPoss = estimatePossessions(game.own);
    const oppPoss = estimatePossessions(game.opp);
    return Math.abs(ownPoss - oppPoss) / Math.max(ownPoss, oppPoss, 1) > POSSESSION_GAP_LIMIT;
  });
  if (possessionGap.length > 0) {
    dataNotes.push(
      `${possessionGap.length} meccsen a két csapat birtoklásbecslése ${Math.round(POSSESSION_GAP_LIMIT * 100)}%-nál jobban eltér ` +
        `(${possessionGap.map(game => game.date).join(', ')}): hiányos dobás- vagy labdavesztés-adat lehet, az ORtg / DRtg ott bizonytalan.`
    );
  }

  // --- Játékosok: a meccs-sorokból, nem a szezon view-ból (az inaktívak is) ---
  const rosterMeta = new Map(input.players.map(player => [player.id, player]));
  const boxGames = games.filter(game => game.own);
  type PlayerAcc = {
    name: string;
    number: number | null;
    position: string | null;
    isActive: boolean | null;
    gamesPlayed: number;
    dnpGames: number;
    rowGames: number;
    firstDate: string | null;
    lastDate: string | null;
    line: TeamBoxLine;
    teamUsage: number;
    teamMinutes: number;
  };
  const accByPlayer = new Map<string, PlayerAcc>();

  boxGames.forEach(game => {
    const teamUsage = game.own ? lineUsage(game.own) : 0;
    const teamMinutes = game.own?.minutes ?? 0;
    (rowsByGame.get(game.id) ?? []).forEach(row => {
      const meta = rosterMeta.get(row.player_id);
      const acc = accByPlayer.get(row.player_id) ?? {
        name: meta?.name ?? row.players?.name ?? 'Ismeretlen játékos',
        number: meta?.number ?? row.players?.number ?? null,
        position: meta?.position ?? row.players?.position ?? null,
        isActive: meta?.isActive ?? row.players?.is_active ?? null,
        gamesPlayed: 0, dnpGames: 0, rowGames: 0, firstDate: null, lastDate: null,
        line: emptyLine(), teamUsage: 0, teamMinutes: 0,
      };
      const line = rowToLine(row);
      acc.rowGames += 1;
      if (line.minutes > 0) {
        acc.gamesPlayed += 1;
        acc.teamUsage += teamUsage;
        acc.teamMinutes += teamMinutes;
        acc.firstDate = acc.firstDate ?? game.date;
        acc.lastDate = game.date;
      } else {
        acc.dnpGames += 1;
      }
      addInto(acc.line, line);
      accByPlayer.set(row.player_id, acc);
    });
  });

  const players: TeamExportPlayer[] = Array.from(accByPlayer.entries())
    .map(([playerId, acc]) => ({
      playerId,
      name: acc.name,
      number: acc.number,
      position: acc.position,
      isActive: acc.isActive,
      gamesPlayed: acc.gamesPlayed,
      dnpGames: acc.dnpGames,
      missedGames: boxGames.length - acc.rowGames,
      firstDate: acc.firstDate,
      lastDate: acc.lastDate,
      line: acc.line,
      usgRate: computeUsgRate(
        { usage: lineUsage(acc.line), minutes: acc.line.minutes },
        { usage: acc.teamUsage, minutes: acc.teamMinutes }
      ),
      smallSample: acc.line.minutes < MIN_SAMPLE_MINUTES,
    }))
    .filter(player => player.gamesPlayed > 0)
    .sort((a, b) => b.line.minutes - a.line.minutes);

  const phaseOrder: TeamExportPhase[] = ['regular', 'playoff', 'other'];
  const byPhase = phaseOrder
    .map(phase => ({ phase, aggregate: aggregateGames(games.filter(game => game.phase === phase)) }))
    .filter(item => item.aggregate.games > 0);

  const opponents = Array.from(new Set(games.map(game => game.opponent)));
  const byOpponent = opponents
    .map(opponent => ({ opponent, aggregate: aggregateGames(games.filter(game => game.opponent === opponent)) }))
    .sort((a, b) => b.aggregate.games - a.aggregate.games || a.opponent.localeCompare(b.opponent, 'hu'));

  const quarterProfile = buildQuarterProfile(inSeason, input.quarterRows ?? [], dataNotes);
  const lineups = buildLineups(input.lineups);

  return {
    quarterProfile,
    lineups,
    overall: aggregateGames(games),
    home: aggregateGames(games.filter(game => game.homeAway === 'home')),
    away: aggregateGames(games.filter(game => game.homeAway === 'away')),
    byPhase,
    byOpponent,
    games,
    players,
    dataNotes,
  };
}

const emptyQuarterLine = (label: string): TeamExportQuarterLine => ({
  label, games: 0, pointsFor: 0, pointsAgainst: 0, won: 0, tied: 0, lost: 0,
});

const addPeriod = (line: TeamExportQuarterLine, pointsFor: number, pointsAgainst: number) => {
  line.games += 1;
  line.pointsFor += pointsFor;
  line.pointsAgainst += pointsAgainst;
  if (pointsFor > pointsAgainst) line.won += 1;
  else if (pointsFor < pointsAgainst) line.lost += 1;
  else line.tied += 1;
};

/**
 * Szezonszintű negyedprofil a Kosarstat negyedenkénti pontjaiból. Csak azok a
 * meccsek számítanak, ahol a negyedek összege mindkét oldalon egyezik a
 * végeredménnyel; a hosszabbítások egy sorba vonódnak.
 */
function buildQuarterProfile(
  games: TeamGame[],
  quarterRows: TeamExportQuarterRow[],
  dataNotes: string[]
): TeamExportQuarterProfile | null {
  if (quarterRows.length === 0) return null;

  const rowsByGame = new Map<string, TeamExportQuarterRow[]>();
  quarterRows.forEach(row => {
    const key = String(row.kosarstat_game_id);
    const list = rowsByGame.get(key);
    if (list) list.push(row);
    else rowsByGame.set(key, [row]);
  });

  const quarters = [1, 2, 3, 4].map(q => emptyQuarterLine(`${q}. negyed`));
  const overtime = emptyQuarterLine('Hosszabbítás');
  const halves = [emptyQuarterLine('1. félidő'), emptyQuarterLine('2. félidő')];
  const mismatched: string[] = [];
  let covered = 0;

  games.forEach(game => {
    const rows = game.kosarstatGameId ? rowsByGame.get(String(game.kosarstatGameId)) : undefined;
    if (!rows || rows.length === 0) return;
    const ownSide = game.homeAway;
    const byQuarter = new Map<number, { own: number; opp: number }>();
    rows.forEach(row => {
      const entry = byQuarter.get(row.quarter) ?? { own: 0, opp: 0 };
      if (row.team_side === ownSide) entry.own += row.points;
      else entry.opp += row.points;
      byQuarter.set(row.quarter, entry);
    });
    const periods = Array.from(byQuarter.entries()).sort((a, b) => a[0] - b[0]);
    const ownTotal = periods.reduce((sum, [, value]) => sum + value.own, 0);
    const oppTotal = periods.reduce((sum, [, value]) => sum + value.opp, 0);
    if (ownTotal !== game.ourScore || oppTotal !== game.oppScore) {
      mismatched.push(game.date);
      return;
    }

    covered += 1;
    let otFor = 0;
    let otAgainst = 0;
    let hasOvertime = false;
    periods.forEach(([quarter, value]) => {
      if (quarter >= 1 && quarter <= 4) addPeriod(quarters[quarter - 1], value.own, value.opp);
      else {
        hasOvertime = true;
        otFor += value.own;
        otAgainst += value.opp;
      }
    });
    if (hasOvertime) addPeriod(overtime, otFor, otAgainst);
    const half = (from: number, to: number) => {
      const first = byQuarter.get(from) ?? { own: 0, opp: 0 };
      const second = byQuarter.get(to) ?? { own: 0, opp: 0 };
      return { own: first.own + second.own, opp: first.opp + second.opp };
    };
    const firstHalf = half(1, 2);
    const secondHalf = half(3, 4);
    addPeriod(halves[0], firstHalf.own, firstHalf.opp);
    addPeriod(halves[1], secondHalf.own, secondHalf.opp);
  });

  if (mismatched.length > 0) {
    dataNotes.push(
      `${mismatched.length} meccsen a Kosarstat negyedenkénti pontjainak összege eltér a végeredménytől ` +
        `(${mismatched.join(', ')}): a negyedprofilból kimaradt.`
    );
  }
  if (covered === 0) return null;

  return {
    games: covered,
    quarters: overtime.games > 0 ? [...quarters, overtime] : quarters,
    halves,
  };
}

/** Ötös-rangsor és játékosonkénti on/off a szezonszintű lineup-adatból. */
function buildLineups(input?: TeamExportLineupInput): TeamExportLineups | null {
  const stints = (input?.stints ?? []).filter(stint => stint.seconds > 0 && stint.players.length > 0);
  if (!input || stints.length === 0) return null;

  const total = stints.reduce(
    (acc, stint) => ({
      seconds: acc.seconds + stint.seconds,
      teamPts: acc.teamPts + stint.teamPts,
      oppPts: acc.oppPts + stint.oppPts,
    }),
    { seconds: 0, teamPts: 0, oppPts: 0 }
  );

  const onByPlayer = new Map<string, { seconds: number; teamPts: number; oppPts: number }>();
  stints.forEach(stint => {
    stint.players.forEach(player => {
      const entry = onByPlayer.get(player) ?? { seconds: 0, teamPts: 0, oppPts: 0 };
      entry.seconds += stint.seconds;
      entry.teamPts += stint.teamPts;
      entry.oppPts += stint.oppPts;
      onByPlayer.set(player, entry);
    });
  });

  const onOff: TeamExportOnOff[] = Array.from(onByPlayer.entries())
    .map(([player, on]) => ({
      player,
      onSeconds: on.seconds,
      onFor: on.teamPts,
      onAgainst: on.oppPts,
      offSeconds: total.seconds - on.seconds,
      offFor: total.teamPts - on.teamPts,
      offAgainst: total.oppPts - on.oppPts,
    }))
    .sort((a, b) => b.onSeconds - a.onSeconds);

  return {
    games: input.games,
    totalSeconds: total.seconds,
    totalFor: total.teamPts,
    totalAgainst: total.oppPts,
    lineups: [...stints].sort((a, b) => b.seconds - a.seconds).slice(0, TOP_LINEUPS),
    onOff,
  };
}

/**
 * Liga-összehasonlítás: minden csapat alapszakasz-összesítője ugyanazzal a
 * számítással, mint a saját csapaté. Az alapszakasz nélküli csapat kimarad.
 */
export function buildLeagueComparison(input: {
  teams: Array<{ teamId: string; teamName: string; games: TeamGame[] }>;
  statRows: TeamExportStatRow[];
  seasonName?: string;
}): TeamExportLeagueRow[] {
  return input.teams
    .map(team => {
      const model = buildTeamSeasonExport({
        games: team.games,
        statRows: input.statRows,
        players: [],
        seasonName: input.seasonName,
      });
      const regular = model.byPhase.find(item => item.phase === 'regular');
      return regular ? { teamId: team.teamId, teamName: team.teamName, aggregate: regular.aggregate } : null;
    })
    .filter((row): row is TeamExportLeagueRow => row !== null);
}
