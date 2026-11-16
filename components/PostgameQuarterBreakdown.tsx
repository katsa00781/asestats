'use client';

import type { ColumnDef } from '@/components/ui/data-table';
import type { KosarstatQuarterBox, QuarterBoxLine, QuarterPeriod, QuarterPlayerLine, QuarterSide } from '@/lib/kosarstat-quarter-box';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { buildQuarterMatchupMetrics, quarterLinePossessions, quarterPlayerShooting, TOTAL_PERIOD_KEY } from '@/lib/kosarstat-quarter-box';
import { resolvePlayerNames } from '@/lib/player-name-match';
import { cn } from '@/lib/utils';
import { useMemo, useState } from 'react';

type PostgameQuarterBreakdownProps = {
  box: KosarstatQuarterBox;
  /** A saját csapat oldala a Kosarstat sorokban (`games.home_away`). */
  ownSide: QuarterSide;
  teamName: string;
  opponentName: string;
  /** A saját csapat box score nevei – a Kosarstat nevek ezekre fordulnak. */
  ownBoxNames: string[];
  /** A meccs végeredménye a saját csapat szemszögéből – a teljesség ellenőrzéséhez. */
  finalScore: { own: number; opponent: number } | null;
};

type OverviewRow = {
  key: string;
  label: string;
  ownPoints: number;
  oppPoints: number;
  diff: number;
  ownEfg: number | null;
  oppEfg: number | null;
  ownTurnoverRate: number | null;
  ownOrebPct: number | null;
  ownFtRate: number | null;
  possessions: number;
  ortg: number | null;
  drtg: number | null;
  net: number | null;
};

type CompareRow = { key: string; label: string; own: string; opp: string };

type PlayerRow = QuarterPlayerLine & { displayName: string };

const pct = (value: number | null) => (value === null ? '–' : `${value.toFixed(1)}%`);
const rating = (value: number | null) => (value === null ? '–' : value.toFixed(1));
const signed = (value: number, digits = 0) => `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;
const madeAtt = (made: number, att: number) => `${made}/${att}`;
const diffClass = (value: number | null) =>
  value === null || value === 0 ? 'text-secondary' : value > 0 ? 'text-positive' : 'text-negative';

const toOverviewRow = (period: QuarterPeriod, ownSide: QuarterSide, oppSide: QuarterSide): OverviewRow => {
  const own = period.team[ownSide];
  const opp = period.team[oppSide];
  const metrics = buildQuarterMatchupMetrics(own, opp);
  return {
    key: period.key,
    label: period.label,
    ownPoints: own.points,
    oppPoints: opp.points,
    diff: own.points - opp.points,
    ownEfg: metrics.own.efg,
    oppEfg: metrics.opp.efg,
    ownTurnoverRate: metrics.own.turnoverRate,
    ownOrebPct: metrics.own.orebPct,
    ownFtRate: metrics.own.ftRate,
    possessions: metrics.possessions,
    ortg: metrics.own.rating,
    drtg: metrics.opp.rating,
    net: metrics.net,
  };
};

const buildCompareRows = (own: QuarterBoxLine, opp: QuarterBoxLine): CompareRow[] => {
  const metrics = buildQuarterMatchupMetrics(own, opp);
  const shooting = (made: number, att: number, value: number | null) => `${madeAtt(made, att)} (${pct(value)})`;
  return [
    { key: 'pts', label: 'Pont', own: String(own.points), opp: String(opp.points) },
    {
      key: 'fg',
      label: 'Mezőny (FGM/FGA)',
      own: shooting(metrics.own.fgm, metrics.own.fga, metrics.own.fgPct),
      opp: shooting(metrics.opp.fgm, metrics.opp.fga, metrics.opp.fgPct),
    },
    { key: '2p', label: '2P', own: shooting(own.fgm2, own.fga2, metrics.own.twoPct), opp: shooting(opp.fgm2, opp.fga2, metrics.opp.twoPct) },
    { key: '3p', label: '3P', own: shooting(own.fgm3, own.fga3, metrics.own.threePct), opp: shooting(opp.fgm3, opp.fga3, metrics.opp.threePct) },
    { key: 'ft', label: 'Büntető', own: shooting(own.ftm, own.fta, metrics.own.ftPct), opp: shooting(opp.ftm, opp.fta, metrics.opp.ftPct) },
    { key: 'efg', label: 'eFG%', own: pct(metrics.own.efg), opp: pct(metrics.opp.efg) },
    { key: 'ts', label: 'TS%', own: pct(metrics.own.ts), opp: pct(metrics.opp.ts) },
    { key: 'ftr', label: 'FT-mutató (FTM/FGA)', own: pct(metrics.own.ftRate), opp: pct(metrics.opp.ftRate) },
    { key: 'oreb', label: 'Támadólepattanó', own: String(own.oreb), opp: String(opp.oreb) },
    { key: 'dreb', label: 'Védőlepattanó', own: String(own.dreb), opp: String(opp.dreb) },
    { key: 'orebpct', label: 'OREB%', own: pct(metrics.own.orebPct), opp: pct(metrics.opp.orebPct) },
    { key: 'ast', label: 'Gólpassz', own: String(own.ast), opp: String(opp.ast) },
    { key: 'tov', label: 'Eladott labda', own: String(own.tov), opp: String(opp.tov) },
    { key: 'tovrate', label: 'TO rate (Oliver)', own: pct(metrics.own.turnoverRate), opp: pct(metrics.opp.turnoverRate) },
    { key: 'stl', label: 'Labdaszerzés', own: String(own.stl), opp: String(opp.stl) },
    { key: 'blk', label: 'Blokk', own: String(own.blk), opp: String(opp.blk) },
    { key: 'pf', label: 'Fault', own: String(own.pf), opp: String(opp.pf) },
    {
      key: 'poss',
      label: 'Birtoklás (becslés)',
      own: quarterLinePossessions(own).toFixed(1),
      opp: quarterLinePossessions(opp).toFixed(1),
    },
    { key: 'rtg', label: 'Pont / 100 birtoklás', own: rating(metrics.own.rating), opp: rating(metrics.opp.rating) },
  ];
};

/**
 * Negyedenkénti bontás a post-game jelentésben: a Kosarstat eseménylistájából
 * számolt csapat- és játékos-box score periódusonként. Felül a negyedek egymás
 * mellett, alatta a kiválasztott periódus csapat-összevetése és játékostáblája.
 */
export function PostgameQuarterBreakdown({
  box,
  ownSide,
  teamName,
  opponentName,
  ownBoxNames,
  finalScore,
}: PostgameQuarterBreakdownProps) {
  const oppSide: QuarterSide = ownSide === 'home' ? 'away' : 'home';
  const [selectedKey, setSelectedKey] = useState<string>(TOTAL_PERIOD_KEY);
  const [playerSide, setPlayerSide] = useState<'own' | 'opp'>('own');

  const allPeriods = useMemo(() => [...box.periods, box.total], [box]);
  // Másik meccsre váltáskor a korábbi periódus hiányozhat (pl. hosszabbítás).
  const selected = allPeriods.find(period => period.key === selectedKey) ?? box.total;

  const overviewRows = useMemo(
    () => allPeriods.map(period => toOverviewRow(period, ownSide, oppSide)),
    [allPeriods, ownSide, oppSide]
  );

  const ownNameMap = useMemo(() => {
    const kosarstatNames = box.total.players[ownSide].map(line => line.player);
    return resolvePlayerNames(kosarstatNames, ownBoxNames).matched;
  }, [box, ownSide, ownBoxNames]);

  const playerRows = useMemo<PlayerRow[]>(() => {
    const lines = selected.players[playerSide === 'own' ? ownSide : oppSide];
    return lines.map(line => ({
      ...line,
      displayName: playerSide === 'own' ? ownNameMap.get(line.player) ?? line.player : line.player,
    }));
  }, [selected, playerSide, ownSide, oppSide, ownNameMap]);

  const compareRows = useMemo(
    () => buildCompareRows(selected.team[ownSide], selected.team[oppSide]),
    [selected, ownSide, oppSide]
  );

  const eventOwn = box.total.team[ownSide].points;
  const eventOpp = box.total.team[oppSide].points;
  const incomplete = finalScore !== null && (eventOwn !== finalScore.own || eventOpp !== finalScore.opponent);

  const overviewColumns: ColumnDef<OverviewRow>[] = [
    {
      key: 'label',
      label: 'Periódus',
      sortable: false,
      render: row => (
        <span className={cn('font-display uppercase tracking-wide', row.key === TOTAL_PERIOD_KEY ? 'text-cyan' : 'text-primary')}>
          {row.label}
        </span>
      ),
    },
    { key: 'score', label: 'Pont', numeric: true, sortable: false, render: row => `${row.ownPoints}–${row.oppPoints}` },
    {
      key: 'diff',
      label: 'Különbség',
      numeric: true,
      sortable: false,
      render: row => <span className={diffClass(row.diff)}>{signed(row.diff)}</span>,
    },
    { key: 'efg', label: 'eFG% (saját / ell.)', numeric: true, sortable: false, render: row => `${pct(row.ownEfg)} / ${pct(row.oppEfg)}` },
    { key: 'tov', label: 'TO rate', numeric: true, sortable: false, render: row => pct(row.ownTurnoverRate) },
    { key: 'oreb', label: 'OREB%', numeric: true, sortable: false, render: row => pct(row.ownOrebPct) },
    { key: 'ftr', label: 'FTM/FGA', numeric: true, sortable: false, render: row => pct(row.ownFtRate) },
    { key: 'poss', label: 'Birtoklás', numeric: true, sortable: false, render: row => row.possessions.toFixed(1) },
    { key: 'ortg', label: 'ORtg', numeric: true, sortable: false, render: row => rating(row.ortg) },
    { key: 'drtg', label: 'DRtg', numeric: true, sortable: false, render: row => rating(row.drtg) },
    {
      key: 'net',
      label: 'Net',
      numeric: true,
      sortable: false,
      render: row => <span className={diffClass(row.net)}>{row.net === null ? '–' : signed(row.net, 1)}</span>,
    },
  ];

  const compareColumns: ColumnDef<CompareRow>[] = [
    { key: 'label', label: 'Mutató', sortable: false },
    { key: 'own', label: teamName, numeric: true, sortable: false },
    { key: 'opp', label: opponentName, numeric: true, sortable: false },
  ];

  const playerColumns: ColumnDef<PlayerRow>[] = [
    { key: 'displayName', label: 'Játékos' },
    { key: 'points', label: 'Pont', numeric: true },
    {
      key: 'fg2',
      label: '2P',
      numeric: true,
      sortAccessor: row => row.fgm2,
      render: row => madeAtt(row.fgm2, row.fga2),
    },
    {
      key: 'fg3',
      label: '3P',
      numeric: true,
      sortAccessor: row => row.fgm3,
      render: row => madeAtt(row.fgm3, row.fga3),
    },
    {
      key: 'ft',
      label: 'Büntető',
      numeric: true,
      sortAccessor: row => row.ftm,
      render: row => madeAtt(row.ftm, row.fta),
    },
    {
      key: 'efg',
      label: 'eFG%',
      numeric: true,
      sortAccessor: row => quarterPlayerShooting(row).efg ?? -1,
      render: row => pct(quarterPlayerShooting(row).efg),
    },
    { key: 'oreb', label: 'T-lep', numeric: true },
    { key: 'dreb', label: 'V-lep', numeric: true },
    { key: 'ast', label: 'Gólp.', numeric: true },
    { key: 'tov', label: 'LV', numeric: true },
    { key: 'stl', label: 'LSZ', numeric: true },
    { key: 'blk', label: 'Blokk', numeric: true },
    { key: 'pf', label: 'Fault', numeric: true },
  ];

  const selectorButton = (key: string, label: string) => (
    <Button
      key={key}
      variant="outline"
      size="sm"
      aria-pressed={selected.key === key}
      className={cn(
        'h-7 px-3 font-display uppercase tracking-wide',
        selected.key === key
          ? 'border-cyan/60 bg-cyan/15 text-cyan hover:bg-cyan/20'
          : 'border-border-subtle text-secondary hover:bg-surface-2'
      )}
      onClick={() => setSelectedKey(key)}
    >
      {label}
    </Button>
  );

  return (
    <div className="animate-fade-slide-up rounded-lg border border-border-subtle bg-surface-1/80 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-display text-sm uppercase tracking-widest text-primary">Negyedenkénti bontás</h4>
        <div className="text-xs text-secondary">Kosarstat eseménylistából számolva</div>
      </div>

      {incomplete && finalScore && (
        <div className="rounded-md border border-warning/40 bg-warning/10 p-2 text-xs text-warning">
          Az eseménylista pontösszege ({eventOwn}–{eventOpp}) eltér a végeredménytől ({finalScore.own}–{finalScore.opponent}):
          a negyedenkénti bontás hiányos lehet.
        </div>
      )}

      <div className="space-y-2">
        <div className="text-xs text-secondary">Periódusok egymás mellett ({teamName} szemszögéből)</div>
        <DataTable columns={overviewColumns} rows={overviewRows} getRowId={row => row.key} activeRowId={selected.key} />
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Periódus kiválasztása">
        {allPeriods.map(period => selectorButton(period.key, period.label))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="space-y-2">
          <div className="text-xs text-secondary">Csapat-összevetés – {selected.label}</div>
          <DataTable columns={compareColumns} rows={compareRows} getRowId={row => row.key} />
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-secondary">Játékosok – {selected.label}</div>
            <div className="flex gap-1" role="group" aria-label="Csapat kiválasztása">
              {([
                { key: 'own', label: teamName },
                { key: 'opp', label: opponentName },
              ] as const).map(option => (
                <Button
                  key={option.key}
                  variant="outline"
                  size="sm"
                  aria-pressed={playerSide === option.key}
                  className={cn(
                    'h-6 px-2 text-xs',
                    playerSide === option.key
                      ? 'border-cyan/60 bg-cyan/15 text-cyan hover:bg-cyan/20'
                      : 'border-border-subtle text-secondary hover:bg-surface-2'
                  )}
                  onClick={() => setPlayerSide(option.key)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
          {playerRows.length > 0 ? (
            <DataTable
              columns={playerColumns}
              rows={playerRows}
              getRowId={row => row.player}
              initialSort={{ key: 'points', dir: 'desc' }}
            />
          ) : (
            <div className="text-xs text-muted">Ebben a periódusban nincs játékoshoz köthető esemény.</div>
          )}
        </div>
      </div>

      <div className="text-xs text-muted">
        Csak a periódusban eseménnyel szereplő játékosok jelennek meg. A csapatsor a csapat-lepattanókat és a csapathoz írt
        labdaeladásokat is tartalmazza, ezért több lehet a játékosok összegénél. Birtoklás: a két csapat becslésének átlaga
        (FGA + 0,44·FTA + LV − T-lep); TO rate: LV / (FGA + 0,44·FTA + LV).
      </div>
    </div>
  );
}
