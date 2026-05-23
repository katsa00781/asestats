'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { DataTable, type ColumnDef } from './ui/data-table';
import { supabase } from '@/lib/supabase';
import { Trophy, TrendingUp, TrendingDown } from 'lucide-react';

type StandingRow = {
  position: number;
  team: string;
  matches: number;
  winPct: number;
  points: number;
  wins: number;
  losses: number;
  scored: number;
  conceded: number;
  streak: string;
  home: string;
  away: string;
  last5: string;
};

type StandingData = {
  id: string;
  season_id?: string;
  matchday: number;
  date: string;
  data: StandingRow[];
};

type StandingsViewProps = {
  onRefresh?: number;
  selectedSeasonId?: string | null;
  selectedSeasonName?: string;
};

function positionBadgeClass(pos: number): string {
  if (pos <= 8)  return 'dt-badge dt-badge--win';
  if (pos <= 10) return 'dt-badge dt-badge--sf';
  return 'dt-badge dt-badge--neutral';
}

function StreakCell({ streak }: { streak: string }) {
  const isWin = streak.startsWith('GY');
  const isLoss = streak.startsWith('V');
  return (
    <span className={`dt-trend ${isWin ? 'dt-trend--up' : isLoss ? 'dt-trend--down' : 'dt-trend--flat'}`}>
      {isWin && <TrendingUp className="h-3.5 w-3.5" strokeWidth={2} />}
      {isLoss && <TrendingDown className="h-3.5 w-3.5" strokeWidth={2} />}
      {streak}
    </span>
  );
}

function DiffCell({ scored, conceded }: { scored: number; conceded: number }) {
  const diff = scored - conceded;
  const cls = diff > 0 ? 'dt-num--pos' : diff < 0 ? 'dt-num--neg' : 'dt-num--muted';
  return (
    <span className={`dt-num ${cls}`}>
      {diff > 0 ? '+' : ''}{diff}
    </span>
  );
}

const STANDINGS_COLUMNS: ColumnDef<StandingRow>[] = [
  {
    key: 'position',
    label: 'H.',
    sortable: true,
    width: 56,
    center: true,
    render: (r) => <span className={positionBadgeClass(r.position)}>{r.position}</span>,
  },
  {
    key: 'team',
    label: 'Csapat',
    sortable: true,
    render: (r) => <span className="font-medium text-primary">{r.team}</span>,
  },
  { key: 'matches', label: 'M',   numeric: true, sortable: true, width: 52 },
  {
    key: 'winPct',
    label: '%',
    numeric: true,
    sortable: true,
    width: 64,
    render: (r) => <span data-stat>{(r.winPct * 100).toFixed(0)}%</span>,
  },
  {
    key: 'points',
    label: 'PT',
    numeric: true,
    sortable: true,
    width: 56,
    render: (r) => <span data-stat className="dt-num--strong">{r.points}</span>,
  },
  {
    key: 'wins',
    label: 'GY',
    numeric: true,
    sortable: true,
    width: 56,
    render: (r) => <span data-stat className="dt-num--pos">{r.wins}</span>,
  },
  {
    key: 'losses',
    label: 'V',
    numeric: true,
    sortable: true,
    width: 56,
    render: (r) => <span data-stat className="dt-num--neg">{r.losses}</span>,
  },
  { key: 'scored',   label: 'DOB', numeric: true, sortable: true, width: 64 },
  { key: 'conceded', label: 'KAP', numeric: true, sortable: true, width: 64 },
  {
    key: 'diff',
    label: '+/-',
    numeric: true,
    sortable: true,
    sortAccessor: (r) => r.scored - r.conceded,
    width: 64,
    render: (r) => <DiffCell scored={r.scored} conceded={r.conceded} />,
  },
  {
    key: 'streak',
    label: 'SOR',
    sortable: false,
    width: 80,
    render: (r) => <StreakCell streak={r.streak} />,
  },
  { key: 'home',  label: 'HA',   sortable: false, width: 72, render: (r) => <span className="text-secondary text-xs">{r.home}</span> },
  { key: 'away',  label: 'VE',   sortable: false, width: 72, render: (r) => <span className="text-secondary text-xs">{r.away}</span> },
  { key: 'last5', label: 'UT.5', sortable: false, width: 72, render: (r) => <span className="text-secondary text-xs">{r.last5}</span> },
];

export function StandingsView({ onRefresh, selectedSeasonId, selectedSeasonName }: StandingsViewProps) {
  const [standings, setStandings] = useState<StandingData[]>([]);
  const [selectedMatchday, setSelectedMatchday] = useState<string>('');
  const [currentStanding, setCurrentStanding] = useState<StandingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [usedFallback, setUsedFallback] = useState(false);

  const normalizeRows = (rows: StandingData[] | null | undefined): StandingData[] => {
    if (!Array.isArray(rows)) return [];
    return rows
      .map(row => ({ ...row, data: Array.isArray(row.data) ? row.data : [] }))
      .filter(row => row.data.length > 0);
  };

  const loadStandings = useCallback(async () => {
    setIsLoading(true);
    setUsedFallback(false);

    try {
      let data: StandingData[] | null = null;
      let error: Error | null = null;

      if (selectedSeasonId) {
        const seasonQuery = await supabase
          .from('standings')
          .select('*')
          .eq('season_id', selectedSeasonId)
          .order('matchday', { ascending: false });
        data = seasonQuery.data as StandingData[] | null;
        error = seasonQuery.error as Error | null;
      } else {
        const latestQuery = await supabase
          .from('standings')
          .select('*')
          .order('date', { ascending: false })
          .order('matchday', { ascending: false });
        data = latestQuery.data as StandingData[] | null;
        error = latestQuery.error as Error | null;
      }

      if (error) throw error;

      let normalized = normalizeRows(data);
      let fallbackUsed = false;

      if (normalized.length === 0 && selectedSeasonId) {
        const { data: legacyData, error: legacyError } = await supabase
          .from('standings')
          .select('*')
          .is('season_id', null)
          .order('date', { ascending: false })
          .order('matchday', { ascending: false });
        if (legacyError) throw legacyError;
        normalized = normalizeRows(legacyData as StandingData[] | null);
        fallbackUsed = normalized.length > 0;
      }

      if (normalized.length > 0) {
        setStandings(normalized);
        const latest = normalized[0];
        setSelectedMatchday(latest.matchday.toString());
        setCurrentStanding(latest.data);
        setUsedFallback(fallbackUsed);
      } else {
        setStandings([]);
        setSelectedMatchday('');
        setCurrentStanding([]);
        setUsedFallback(false);
      }
    } catch (error) {
      console.error('Tabella betöltési hiba:', error);
      setStandings([]);
      setSelectedMatchday('');
      setCurrentStanding([]);
      setUsedFallback(false);
    } finally {
      setIsLoading(false);
    }
  }, [selectedSeasonId]);

  useEffect(() => { loadStandings(); }, [loadStandings, onRefresh]);

  useEffect(() => {
    if (selectedMatchday) {
      const standing = standings.find(s => s.matchday.toString() === selectedMatchday);
      if (standing) setCurrentStanding(standing.data);
    }
  }, [selectedMatchday, standings]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-secondary">Betöltés...</p>
        </CardContent>
      </Card>
    );
  }

  if (standings.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-secondary">Nincs elérhető tabella adat.</p>
          <p className="text-center text-muted text-sm mt-2">
            {selectedSeasonId
              ? 'Importálj egy tabellát a kezdéshez.'
              : 'Válassz szezont, vagy importálj tabellát a Tabella fülön.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="flex items-center gap-2 font-display uppercase tracking-wide">
              <Trophy className="h-5 w-5 text-cyan" strokeWidth={1.6} />
              Bajnokság Tabella{selectedSeasonName ? ` – ${selectedSeasonName}` : ''}
            </CardTitle>
            <Select value={selectedMatchday} onValueChange={setSelectedMatchday}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue placeholder="Válassz fordulót" />
              </SelectTrigger>
              <SelectContent>
                {standings.map((s) => (
                  <SelectItem key={s.id} value={s.matchday.toString()}>
                    {s.matchday}. forduló ({new Date(s.date).toLocaleDateString('hu-HU')})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <DataTable<StandingRow>
            columns={STANDINGS_COLUMNS}
            rows={currentStanding}
            initialSort={{ key: 'position', dir: 'asc' }}
            getRowId={(r) => r.position}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs px-1">
            <div className="flex items-center gap-2">
              <span className="dt-badge dt-badge--win">8</span>
              <span className="text-secondary">1–8. helyezett (playoff)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="dt-badge dt-badge--sf">10</span>
              <span className="text-secondary">9–10. helyezett</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="dt-badge dt-badge--neutral">14</span>
              <span className="text-secondary">11–14. helyezett</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {usedFallback && (
        <Card>
          <CardContent className="py-3 text-sm text-warning">
            A kiválasztott szezonhoz nem volt közvetlen tabella, ezért legacy (szezon nélküli) snapshot került betöltésre.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
