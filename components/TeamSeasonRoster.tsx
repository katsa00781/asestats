'use client';

import type { ColumnDef } from '@/components/ui/data-table';
import type { RosterChange, RosterLine, RosterStayer } from '@/lib/team-season-roster';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { formatSigned } from '@/lib/team-season-compare';

type TeamSeasonRosterProps = {
  roster: RosterChange;
  prevSeasonName: string;
  curSeasonName: string;
};

const perGame = (value: number, games: number) => (games > 0 ? value / games : 0);
const formatPct = (value: number | null) => (value === null ? '–' : `${value.toFixed(0)}%`);

const nameColumn = <T extends { name: string }>(): ColumnDef<T> => ({
  key: 'name', label: 'Játékos', sortable: false, render: row => <span className="text-primary">{row.name}</span>,
});

const lineColumns = (): ColumnDef<RosterLine>[] => [
  nameColumn<RosterLine>(),
  { key: 'games', label: 'Meccs', numeric: true, sortable: false, render: row => row.games },
  { key: 'min', label: 'Perc / meccs', numeric: true, sortable: false, render: row => perGame(row.minutes, row.games).toFixed(1) },
  { key: 'pts', label: 'Pont / meccs', numeric: true, sortable: false, render: row => perGame(row.points, row.games).toFixed(1) },
];

export function TeamSeasonRoster({ roster, prevSeasonName, curSeasonName }: TeamSeasonRosterProps) {
  const stayerColumns: ColumnDef<RosterStayer>[] = [
    nameColumn<RosterStayer>(),
    {
      key: 'prevMin', label: `Perc ${prevSeasonName}`, numeric: true, sortable: false,
      render: row => perGame(row.prev.minutes, row.prev.games).toFixed(1),
    },
    {
      key: 'curMin', label: `Perc ${curSeasonName}`, numeric: true, sortable: false,
      render: row => perGame(row.cur.minutes, row.cur.games).toFixed(1),
    },
    {
      key: 'prevPts', label: `Pont ${prevSeasonName}`, numeric: true, sortable: false,
      render: row => perGame(row.prev.points, row.prev.games).toFixed(1),
    },
    {
      key: 'curPts', label: `Pont ${curSeasonName}`, numeric: true, sortable: false,
      render: row => perGame(row.cur.points, row.cur.games).toFixed(1),
    },
    {
      key: 'delta', label: 'Pont változás', numeric: true, sortable: false,
      render: row => {
        const delta = perGame(row.cur.points, row.cur.games) - perGame(row.prev.points, row.prev.games);
        return <span className={delta > 0 ? 'text-positive' : delta < 0 ? 'text-negative' : 'text-secondary'}>{formatSigned(delta)}</span>;
      },
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Keretváltozás</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-border-subtle bg-surface-2/40 p-3">
            <p className="font-display text-xs uppercase tracking-widest text-secondary">Maradók</p>
            <p className="font-mono text-lg tabular-nums text-primary">{roster.stayed.length}</p>
          </div>
          <div className="rounded-lg border border-border-subtle bg-surface-2/40 p-3">
            <p className="font-display text-xs uppercase tracking-widest text-secondary">Érkezők</p>
            <p className="font-mono text-lg tabular-nums text-primary">{roster.arrived.length}</p>
          </div>
          <div className="rounded-lg border border-border-subtle bg-surface-2/40 p-3">
            <p className="font-display text-xs uppercase tracking-widest text-secondary">Távozók</p>
            <p className="font-mono text-lg tabular-nums text-primary">{roster.left.length}</p>
          </div>
        </div>

        <ul className="space-y-1 text-primary">
          <li>
            {curSeasonName}: {roster.curPlayers} játékos lépett pályára a vizsgált meccseken, {prevSeasonName}: {roster.prevPlayers}.
          </li>
          {roster.continuityMinutesPct !== null && (
            <li>Az idei percek {formatPct(roster.continuityMinutesPct)}-át olyan játékosok játsszák, akik tavaly is szerepeltek.</li>
          )}
          {roster.leftPointsPct !== null && (
            <li>A tavalyi pontok {formatPct(roster.leftPointsPct)}-át a távozók szerezték.</li>
          )}
          {roster.arrivedPointsPct !== null && (
            <li>Az idei pontok {formatPct(roster.arrivedPointsPct)}-át az érkezők szerzik.</li>
          )}
        </ul>

        {roster.stayed.length > 0 && (
          <div className="space-y-2">
            <p className="font-display text-xs uppercase tracking-widest text-secondary">Maradók (mindkét mintában szerepeltek)</p>
            <DataTable columns={stayerColumns} rows={roster.stayed} getRowId={row => row.key} />
          </div>
        )}
        {roster.arrived.length > 0 && (
          <div className="space-y-2">
            <p className="font-display text-xs uppercase tracking-widest text-secondary">Érkezők ({curSeasonName})</p>
            <DataTable columns={lineColumns()} rows={roster.arrived} getRowId={row => row.key} />
          </div>
        )}
        {roster.left.length > 0 && (
          <div className="space-y-2">
            <p className="font-display text-xs uppercase tracking-widest text-secondary">Távozók ({prevSeasonName})</p>
            <DataTable columns={lineColumns()} rows={roster.left} getRowId={row => row.key} />
          </div>
        )}

        <p className="text-xs text-muted">
          A játékos-sorok a vizsgált meccsekből jönnek (perc &gt; 0), név szerint párosítva. Aki tavaly csak a vizsgált
          meccseken kívül lépett pályára (pl. később érkezett vagy sérülésből tért vissza), itt érkezőként szerepel.
        </p>
      </CardContent>
    </Card>
  );
}
