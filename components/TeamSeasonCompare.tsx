'use client';

import type { CompareBasis, CompareMetric, CompareMetricGroup, GroupTally } from '@/lib/team-season-compare';
import type { ColumnDef } from '@/components/ui/data-table';
import { useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatCard } from '@/components/ui/stat-card';
import { TeamSeasonRoster } from '@/components/TeamSeasonRoster';
import { useTeamSeasonModel } from '@/hooks/useTeamSeasonModel';
import {
  GROUP_LABELS,
  SMALL_SAMPLE_GAMES,
  buildComparisonVerdict,
  buildTeamSeasonComparison,
  formatSigned,
  selectRegularSample,
} from '@/lib/team-season-compare';
import { buildRosterChange, buildRosterLines } from '@/lib/team-season-roster';

type TeamSeasonCompareProps = {
  allSeasons: { id: string; name: string }[];
  allTeams: { id: string; name: string }[];
  currentSeasonId: string | null;
  currentTeamId: string | null;
  onBack: () => void;
};

const GROUP_ORDER: CompareMetricGroup[] = ['result', 'attack', 'defense', 'play'];

const formatValue = (value: number | null, digits: number, unit: string) =>
  value === null || !Number.isFinite(value) ? '–' : `${value.toFixed(digits)}${unit}`;

const formatDelta = (metric: CompareMetric) =>
  metric.delta === null ? '–' : `${formatSigned(metric.delta, metric.digits)}${metric.unit === '%' ? ' pp' : ''}`;

const deltaTone = (winner: CompareMetric['winner']) =>
  winner === 'cur' ? 'text-positive' : winner === 'prev' ? 'text-negative' : 'text-secondary';

const trendOf = (winner: CompareMetric['winner']) => (winner === 'cur' ? 'up' : winner === 'prev' ? 'down' : 'neutral');

const tallyText = (tally: GroupTally) => `${tally.better} jobb · ${tally.worse} gyengébb · ${tally.even} azonos`;

export function TeamSeasonCompare({ allSeasons, allTeams, currentSeasonId, currentTeamId, onBack }: TeamSeasonCompareProps) {
  const [teamOverride, setTeamOverride] = useState<string | null>(null);
  const [curSeasonOverride, setCurSeasonOverride] = useState<string | null>(null);
  const [prevSeasonOverride, setPrevSeasonOverride] = useState<string | null>(null);
  const [basis, setBasis] = useState<CompareBasis>('firstN');

  const teamId = teamOverride ?? currentTeamId ?? allTeams[0]?.id ?? null;
  const curSeasonId = curSeasonOverride ?? currentSeasonId ?? allSeasons[0]?.id ?? null;
  // A szezonlista a legújabbtól halad: az „előző” az aktuális utáni elem.
  const curIndex = allSeasons.findIndex(season => season.id === curSeasonId);
  const prevSeasonId = prevSeasonOverride ?? (curIndex >= 0 ? allSeasons[curIndex + 1]?.id ?? null : null);

  const curSeason = allSeasons.find(season => season.id === curSeasonId) ?? null;
  const prevSeason = allSeasons.find(season => season.id === prevSeasonId) ?? null;
  const teamName = allTeams.find(team => team.id === teamId)?.name ?? 'Ismeretlen csapat';

  const cur = useTeamSeasonModel(teamId, curSeason);
  const prev = useTeamSeasonModel(teamId, prevSeason);
  const sameSeason = Boolean(curSeasonId) && curSeasonId === prevSeasonId;

  const view = useMemo(() => {
    if (!cur.model || !prev.model || sameSeason) return null;
    const curSample = selectRegularSample(cur.model, null);
    if (curSample.games.length === 0) return { curSample, prevSample: null, comparison: null };
    const prevSample = selectRegularSample(prev.model, basis === 'firstN' ? curSample.games.length : null);
    if (prevSample.games.length === 0) return { curSample, prevSample, comparison: null };
    return { curSample, prevSample, comparison: buildTeamSeasonComparison(prevSample, curSample) };
  }, [cur.model, prev.model, basis, sameSeason]);

  const comparison = view?.comparison ?? null;
  const verdict = useMemo(() => (comparison ? buildComparisonVerdict(comparison) : []), [comparison]);
  const roster = useMemo(() => {
    if (!view?.prevSample || !comparison) return null;
    const idsOf = (games: { id: string }[]) => new Set(games.map(game => game.id));
    return buildRosterChange(
      buildRosterLines(prev.statRows, idsOf(view.prevSample.games)),
      buildRosterLines(cur.statRows, idsOf(view.curSample.games)),
    );
  }, [view, comparison, prev.statRows, cur.statRows]);
  const metric = (key: string) => comparison?.metrics.find(item => item.key === key) ?? null;
  const dataNotes = [
    ...(cur.model?.dataNotes ?? []).map(note => `${curSeason?.name}: ${note}`),
    ...(prev.model?.dataNotes ?? []).map(note => `${prevSeason?.name}: ${note}`),
  ];

  const columns: ColumnDef<CompareMetric>[] = [
    { key: 'label', label: 'Mutató', sortable: false, render: row => <span className="text-primary">{row.label}</span> },
    {
      key: 'prev', label: prevSeason?.name ?? 'Előző', numeric: true, sortable: false,
      render: row => formatValue(row.prev, row.digits, row.unit),
    },
    {
      key: 'cur', label: curSeason?.name ?? 'Aktuális', numeric: true, sortable: false,
      render: row => formatValue(row.cur, row.digits, row.unit),
    },
    {
      key: 'delta', label: 'Különbség', numeric: true, sortable: false,
      render: row => <span className={deltaTone(row.winner)}>{formatDelta(row)}</span>,
    },
    {
      key: 'winner', label: 'Jobb', center: true, sortable: false,
      render: row =>
        row.winner === 'cur' ? <Badge className="badge-cyan">Idei</Badge>
        : row.winner === 'prev' ? <Badge className="badge-orange">Tavalyi</Badge>
        : row.winner === 'even' ? <Badge className="badge-neutral">Azonos</Badge>
        : <span className="text-muted">–</span>,
    },
  ];

  const margin = metric('margin');
  const net = metric('net');
  const winPct = metric('winPct');
  const ppg = metric('ppg');
  const loading = cur.loading || prev.loading;
  const error = cur.error ?? prev.error;
  const smallSample = Boolean(view?.curSample) && (view?.curSample.games.length ?? 0) < SMALL_SAMPLE_GAMES;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm text-cyan uppercase tracking-wide">Ugyanaz a csapat, két szezon</p>
          <h2 className="text-2xl font-display uppercase tracking-wide text-primary">Idei és tavalyi csapat</h2>
          <p className="text-sm text-secondary">
            Az alapszakasz egyező meccsszámú mintáját hasonlítjuk össze, hogy lásd, mi változott és melyik csapat jobb.
          </p>
        </div>
        <Button variant="ghost" className="gap-2 self-start text-secondary hover:bg-surface-2" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Vissza
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Összehasonlítás beállításai</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-1 text-xs uppercase text-secondary">
              Csapat
              <Select value={teamId ?? undefined} onValueChange={value => setTeamOverride(value)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Csapat" /></SelectTrigger>
                <SelectContent>
                  {allTeams.map(team => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            <label className="space-y-1 text-xs uppercase text-secondary">
              Aktuális szezon
              <Select value={curSeasonId ?? undefined} onValueChange={value => setCurSeasonOverride(value)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Szezon" /></SelectTrigger>
                <SelectContent>
                  {allSeasons.map(season => <SelectItem key={season.id} value={season.id}>{season.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            <label className="space-y-1 text-xs uppercase text-secondary">
              Összevetett szezon
              <Select value={prevSeasonId ?? undefined} onValueChange={value => setPrevSeasonOverride(value)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Szezon" /></SelectTrigger>
                <SelectContent>
                  {allSeasons.map(season => <SelectItem key={season.id} value={season.id}>{season.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={basis === 'firstN' ? 'default' : 'outline'}
              className={basis === 'firstN' ? '' : 'border-border-subtle text-secondary hover:bg-surface-2'}
              onClick={() => setBasis('firstN')}
            >
              Egyező meccsszám (első N)
            </Button>
            <Button
              size="sm"
              variant={basis === 'fullRegular' ? 'default' : 'outline'}
              className={basis === 'fullRegular' ? '' : 'border-border-subtle text-secondary hover:bg-surface-2'}
              onClick={() => setBasis('fullRegular')}
            >
              Teljes alapszakasz
            </Button>
            <span className="text-xs text-muted">A rájátszás és a nem azonosítható meccsek kimaradnak.</span>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded border border-negative/40 bg-negative/10 px-4 py-3 text-sm text-negative">{error}</div>
      )}
      {sameSeason && (
        <div className="rounded border border-dashed border-border-subtle bg-surface-1/40 px-6 py-8 text-center text-secondary">
          Válassz két különböző szezont.
        </div>
      )}
      {!sameSeason && !prevSeason && (
        <div className="rounded border border-dashed border-border-subtle bg-surface-1/40 px-6 py-8 text-center text-secondary">
          Nincs korábbi szezon, amellyel összehasonlíthatnánk.
        </div>
      )}
      {loading && !error && <p className="text-sm text-cyan">Betöltés...</p>}

      {view && !comparison && !loading && (
        <div className="rounded border border-dashed border-border-subtle bg-surface-1/40 px-6 py-8 text-center text-secondary">
          {view.curSample.games.length === 0
            ? `${teamName} ${curSeason?.name} szezonjában még nincs alapszakasz-meccs.`
            : `${teamName} ${prevSeason?.name} szezonjában nincs alapszakasz-meccs az összevetéshez.`}
        </div>
      )}

      {view && comparison && view.prevSample && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm text-secondary">
            <span className="text-primary">{teamName}</span>
            <span>
              {curSeason?.name}: {view.curSample.games.length} alapszakasz-meccs ↔ {prevSeason?.name}:{' '}
              {basis === 'firstN' ? `első ${view.prevSample.games.length}` : 'teljes alapszakasz'}
              {' '}({view.prevSample.regularTotal} meccsből)
            </span>
            {smallSample && (
              <Badge className="badge-warning gap-1">
                <AlertCircle className="h-3 w-3" /> Kis minta
              </Badge>
            )}
            {basis === 'firstN' && view.prevSample.games.length < view.curSample.games.length && (
              <Badge className="badge-warning">A tavalyi szezonban kevesebb meccs van</Badge>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {margin && (
              <StatCard
                label="Pontkülönbség / meccs"
                value={formatSigned(margin.cur)}
                trend={trendOf(margin.winner)}
                trendValue={formatSigned(margin.delta)}
                accentColor="cyan"
              />
            )}
            {net && net.cur !== null && (
              <StatCard
                label="Net rating"
                value={formatSigned(net.cur)}
                trend={trendOf(net.winner)}
                trendValue={formatSigned(net.delta)}
                accentColor="green"
                animationDelay={60}
              />
            )}
            {winPct && (
              <StatCard
                label="Mérleg"
                value={`${view.curSample.aggregate.wins}–${view.curSample.aggregate.losses}`}
                trend={trendOf(winPct.winner)}
                trendValue={`${formatSigned(winPct.delta, 0)} pp`}
                accentColor="orange"
                animationDelay={120}
              />
            )}
            {ppg && (
              <StatCard
                label="Szerzett pont / meccs"
                value={formatValue(ppg.cur, ppg.digits, '')}
                trend={trendOf(ppg.winner)}
                trendValue={formatSigned(ppg.delta)}
                accentColor="cyan"
                animationDelay={180}
              />
            )}
          </div>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg">Melyik csapat jobb?</CardTitle>
              {comparison.overall && (
                <Badge className={comparison.overall === 'cur' ? 'badge-positive' : comparison.overall === 'prev' ? 'badge-negative' : 'badge-neutral'}>
                  {comparison.overall === 'cur' ? 'Idén jobb' : comparison.overall === 'prev' ? 'Tavaly jobb volt' : 'Azonos szint'}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <ul className="space-y-1 text-primary">
                {verdict.map(line => <li key={line}>{line}</li>)}
              </ul>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {GROUP_ORDER.map(group => (
                  <div key={group} className="rounded-lg border border-border-subtle bg-surface-2/40 p-3">
                    <p className="font-display text-xs uppercase tracking-widest text-secondary">{GROUP_LABELS[group]}</p>
                    <p className="mt-1 text-xs text-primary">{tallyText(comparison.byGroup[group])}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {roster && (
            <TeamSeasonRoster
              roster={roster}
              prevSeasonName={prevSeason?.name ?? 'Előző'}
              curSeasonName={curSeason?.name ?? 'Aktuális'}
            />
          )}

          {GROUP_ORDER.map(group => (
            <Card key={group}>
              <CardHeader>
                <CardTitle className="text-lg">{GROUP_LABELS[group]}</CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={columns}
                  rows={comparison.metrics.filter(item => item.group === group)}
                  getRowId={row => row.key}
                />
              </CardContent>
            </Card>
          ))}

          {dataNotes.length > 0 && (
            <details className="rounded-lg border border-border-subtle bg-surface-1/40 p-4 text-sm text-secondary">
              <summary className="cursor-pointer text-primary">Adatminőségi megjegyzések ({dataNotes.length})</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 wrap-break-word">
                {dataNotes.map(note => <li key={note}>{note}</li>)}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}
