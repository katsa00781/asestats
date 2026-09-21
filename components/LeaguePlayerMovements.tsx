'use client';

import type { ColumnDef } from '@/components/ui/data-table';
import type { PlayerMovement } from '@/lib/player-movements';
import { groupPlayerMovements, movementSummary, playerProfileUrl } from '@/lib/player-movements';
import { usePlayerMovements } from '@/hooks/usePlayerMovements';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { StatCard } from '@/components/ui/stat-card';
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, RotateCcw, HelpCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { useMemo } from 'react';

interface LeaguePlayerMovementsProps {
  seasonId: string | null;
  teamId: string | null;
  seasonName?: string;
  teamName?: string;
}

function movementLabel(row: PlayerMovement) {
  if (row.movement_type === 'domestic_transfer') return 'Hazai csapatváltás';
  if (row.movement_type === 'return') return 'Visszatérés';
  return row.direction === 'arrival' ? 'Ismeretlen eredet' : 'Ismeretlen cél';
}

function MovementTable({ rows, direction }: { rows: PlayerMovement[]; direction: 'arrival' | 'departure' }) {
  const columns: ColumnDef<PlayerMovement>[] = [
    { key: 'display_name', label: 'Játékos', render: row => {
      const href = playerProfileUrl(row.profile_url);
      return <div>
        {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-cyan hover:underline">
          {row.display_name}<ExternalLink className="h-3.5 w-3.5" aria-label="Kosarstat profil, új lapon" />
        </a> : <span>{row.display_name}</span>}
        {row.position && <div className="text-xs text-secondary">{row.position}</div>}
      </div>;
    } },
    { key: 'movement_type', label: 'Besorolás', sortAccessor: movementLabel, render: row => <Badge
      className={row.movement_type === 'domestic_transfer' ? 'badge-positive' : row.movement_type === 'return' ? 'badge-ai' : 'badge-neutral'}>
      {movementLabel(row)}
    </Badge> },
    { key: 'counterpart', label: direction === 'arrival' ? 'Honnan' : 'Hová', sortAccessor: row => row.counterpart_team_names.join(', '), render: row =>
      row.counterpart_team_names.length ? row.counterpart_team_names.join(', ') : row.movement_type === 'return'
        ? <span><span className="font-mono tabular-nums">{row.gap_seasons}</span> szezon kihagyása a követett csapatoknál</span>
        : <span className="text-secondary">Nincs adat a követett csapatoknál</span>,
    },
    { key: 'season_name', label: 'Célszezon', render: row => <span className="font-mono tabular-nums">{row.season_name}</span> },
  ];
  return <section className="min-w-0 space-y-3">
    <h3 className="flex items-center gap-2 font-display uppercase">
      {direction === 'arrival' ? <ArrowDownLeft className="h-5 w-5 text-cyan" strokeWidth={1.6} /> : <ArrowUpRight className="h-5 w-5 text-orange" strokeWidth={1.6} />}
      {direction === 'arrival' ? 'Érkezők' : 'Távozók'}
      <span className="font-mono tabular-nums text-secondary">({rows.length})</span>
    </h3>
    {rows.length ? <DataTable columns={columns} rows={rows} getRowId={row => row.id} initialSort={{ key: 'display_name', dir: 'asc' }} />
      : <p className="rounded-lg border bg-surface-1 p-4 text-sm text-secondary">Nincs ilyen mozgás a választott szezonváltásban.</p>}
  </section>;
}

export function LeaguePlayerMovements({ seasonId, teamId, seasonName, teamName }: LeaguePlayerMovementsProps) {
  const { rows, loading, error, reload } = usePlayerMovements(seasonId, teamId);
  const summary = useMemo(() => movementSummary(rows), [rows]);
  const groups = useMemo(() => groupPlayerMovements(rows), [rows]);

  if (!seasonId) return <Card><CardHeader><CardTitle>Igazolások</CardTitle>
    <CardDescription>Válassz szezont a játékosmozgások megtekintéséhez.</CardDescription></CardHeader></Card>;

  return <div className="space-y-6">
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2"><ArrowLeftRight className="h-5 w-5 text-cyan" strokeWidth={1.6} />Igazolások</CardTitle>
          <Button variant="outline" onClick={reload} disabled={loading} className="gap-2"><RefreshCw className="h-4 w-4" />Frissítés</Button>
        </div>
        <CardDescription>{teamId ? teamName || 'Kiválasztott csapat' : 'Teljes követett bajnokság'} · <span className="font-mono tabular-nums">{seasonName}</span></CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-secondary">
        <p>Az előző szezon és a kiválasztott célszezon kerete közötti változások.
          A lista a jelenlegi élvonal nyomon követett csapataira terjed ki.</p>
        <p>Az ismeretlen eredet vagy cél jelenthet külföldi klubot, alsóbb osztályt vagy adathiányt;
          külföldi igazolást nem bizonyít. A visszatérés a követett csapatok közé értendő.
          A szezonon belüli átigazolások sorrendje nem állapítható meg.</p>
      </CardContent>
    </Card>

    {loading ? <div role="status" aria-label="Igazolások betöltése" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {[0, 1, 2, 3, 4].map(i => <div key={i} className="skeleton-shimmer h-36 rounded-lg" />)}
    </div> : error ? <Card><CardContent className="space-y-3 pt-6">
      <p role="alert" className="text-negative">{error}</p><Button variant="outline" onClick={reload}>Újrapróbálás</Button>
    </CardContent></Card> : <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Érkezők" value={summary.arrivals} icon={<ArrowDownLeft className="h-5 w-5" />} />
        <StatCard label="Hazai csapatból érkezett" value={summary.domestic} accentColor="green" icon={<ArrowLeftRight className="h-5 w-5" />} />
        <StatCard label="Visszatért kihagyás után" value={summary.returns} accentColor="purple" icon={<RotateCcw className="h-5 w-5" />} />
        <StatCard label="Távozók" value={summary.departures} accentColor="orange" icon={<ArrowUpRight className="h-5 w-5" />} />
        <StatCard label="Ismeretlen célba távozott" value={summary.unknownDepartures} accentColor="orange" icon={<HelpCircle className="h-5 w-5 text-negative" />} />
      </div>
      {!rows.length && <Card><CardContent className="pt-6 text-sm text-secondary">
        Nincs összehasonlítható játékosmozgás ehhez a szűréshez. Két egymást követő szezon teljes keretadata szükséges;
        az első importált szezon csak viszonyítási alap. Importált adatok mellett a nulla változatlan keretet is jelenthet.
      </CardContent></Card>}
      {groups.map(group => <div key={group.teamId} className="space-y-4">
        <h2>{group.teamName}</h2>
        <div className="grid gap-6 2xl:grid-cols-2">
          <MovementTable rows={group.arrivals} direction="arrival" />
          <MovementTable rows={group.departures} direction="departure" />
        </div>
      </div>)}
    </>}
  </div>;
}
