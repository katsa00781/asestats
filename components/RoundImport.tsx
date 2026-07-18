'use client';
import { authFetch } from '@/lib/api-fetch';

import { useState } from 'react';
import { PlayCircle, Loader2, ShieldAlert } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

export type RoundImportProps = {
  selectedSeasonId: string | null;
  selectedSeasonName?: string;
  onImportComplete?: () => void;
};

const DEFAULT_SEASON_SLUG = 'x2526';
const DEFAULT_LEAGUE_CODE = 'hun_ply';
const DEFAULT_SCHEDULE_URL = `https://hunbasket.hu/menetrend-teljes/ferfi/${DEFAULT_SEASON_SLUG}/${DEFAULT_LEAGUE_CODE}`;

type ImportStatus = 'idle' | 'running' | 'success' | 'error';

type ApiResponse = {
  ok: boolean;
  durationMs?: number;
  stdout?: string;
  stderr?: string;
  error?: string;
};

export function RoundImport({ selectedSeasonId, selectedSeasonName, onImportComplete }: RoundImportProps) {
  const [roundFilter, setRoundFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [seasonSlug, setSeasonSlug] = useState(DEFAULT_SEASON_SLUG);
  const [leagueCode, setLeagueCode] = useState(DEFAULT_LEAGUE_CODE);
  const [scheduleUrl, setScheduleUrl] = useState(DEFAULT_SCHEDULE_URL);
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [stdout, setStdout] = useState('');
  const [stderr, setStderr] = useState('');
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canRun = Boolean(selectedSeasonId && status !== 'running');

  const handleImport = async () => {
    if (!selectedSeasonId) {
      setError('Válassz szezont az import indítása előtt.');
      setStatus('error');
      return;
    }
    setStatus('running');
    setError(null);
    setStdout('');
    setStderr('');
    setDurationMs(null);

    try {
      const response = await authFetch('/api/hunbasket-round-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roundFilter: roundFilter.trim() || undefined,
          dateFrom: dateFrom.trim() || undefined,
          dateTo: dateTo.trim() || undefined,
          seasonId: selectedSeasonId,
          seasonName: selectedSeasonName,
          seasonSlug: seasonSlug.trim() || undefined,
          leagueCode: leagueCode.trim() || undefined,
          scheduleUrl: scheduleUrl.trim() || undefined,
        }),
      });

      const data = (await response.json()) as ApiResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Ismeretlen hiba történt az import során.');
      }

      setStatus('success');
      setStdout(data.stdout || '');
      setStderr(data.stderr || '');
      setDurationMs(typeof data.durationMs === 'number' ? data.durationMs : null);
      onImportComplete?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ismeretlen hiba történt az import során.';
      setError(message);
      setStatus('error');
    }
  };

  const renderStatus = () => {
    if (status === 'idle') return null;

    let variant: 'default' | 'secondary' | 'destructive' = 'default';
    let label = 'Sikeres import';

    if (status === 'running') {
      variant = 'secondary';
      label = 'Folyamatban...';
    } else if (status === 'error') {
      variant = 'destructive';
      label = 'Hiba történt';
    }

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Badge variant={variant}>{label}</Badge>
          {durationMs !== null && status === 'success' && (
            <span className="text-sm text-secondary">
              Futási idő: {(durationMs / 1000).toFixed(1)} mp
            </span>
          )}
        </div>
        {error && <p className="text-sm text-negative">{error}</p>}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PlayCircle className="text-positive" size={20} strokeWidth={1.6} />
          Forduló alapú Hunbasket import
        </CardTitle>
        <CardDescription>
          A művelet frissíti a menetrendet (következő meccsek), a tabellát és a fordulószűrt meccsstatisztikákat is.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!selectedSeasonId && (
          <div className="flex items-center gap-3 rounded-lg border border-warning/40 bg-warning/15 px-3 py-2 text-warning">
            <ShieldAlert size={18} strokeWidth={1.6} />
            <span className="text-sm">A forduló importálásához előbb válassz szezont!</span>
          </div>
        )}
        {selectedSeasonId && (
          <p className="text-xs text-muted">
            Aktív szezon: {selectedSeasonName || 'ismeretlen név'}
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-[2fr_1fr] md:items-end">
          <div className="space-y-2">
            <label className="text-sm text-secondary">Forduló szűrő</label>
            <Input
              value={roundFilter}
              onChange={event => setRoundFilter(event.target.value)}
              placeholder="opcionális: pl. 5 vagy 10-12,15 vagy Negyeddöntő"
            />
            <p className="text-xs text-muted">
              Opcionális. Több forduló: 5,7,9 • Tartomány: 10-12 • Playoff kör: Negyeddöntő, Elődöntő.
            </p>
          </div>
          <Button
            onClick={handleImport}
            disabled={!canRun}
            className="w-full md:w-auto"
          >
            {status === 'running' ? (
              <Loader2 size={16} className="mr-2 animate-spin" />
            ) : (
              <PlayCircle size={16} className="mr-2" strokeWidth={1.6} />
            )}
            Import indítása
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm text-secondary">Dátumtól</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={event => setDateFrom(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-secondary">Dátumig</label>
            <Input
              type="date"
              value={dateTo}
              onChange={event => setDateTo(event.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-muted -mt-2">
          Opcionális dátum szűrő — csak a megadott intervallumba eső meccseket importálja. Hasznos rájátszásnál, hogy ne importálja újra az összes korábbi meccset.
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm text-secondary">Season slug</label>
            <Input
              value={seasonSlug}
              onChange={event => setSeasonSlug(event.target.value)}
              placeholder="pl. x2526"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-secondary">League kód</label>
            <Input
              value={leagueCode}
              onChange={event => setLeagueCode(event.target.value)}
              placeholder="pl. hun_ply"
            />
          </div>
          <div className="space-y-2 md:col-span-3">
            <label className="text-sm text-secondary">Menetrend URL (tabella + eredmények forrás)</label>
            <Input
              value={scheduleUrl}
              onChange={event => setScheduleUrl(event.target.value)}
              placeholder="https://hunbasket.hu/menetrend-teljes/ferfi/x2526/hun_ply"
            />
          </div>
        </div>

        {renderStatus()}

        {(stdout || stderr) && (
          <div className="grid gap-4 md:grid-cols-2">
            {stdout && (
              <div>
                <div className="text-xs text-secondary mb-2">Folyamat napló</div>
                <Textarea
                  value={stdout}
                  readOnly
                  className="bg-surface-2 border-border-subtle text-primary font-mono text-xs"
                  style={{ minHeight: 160 }}
                />
              </div>
            )}
            {stderr && (
              <div>
                <div className="text-xs text-negative mb-2">Figyelmeztetések / hibák</div>
                <Textarea
                  value={stderr}
                  readOnly
                  className="bg-negative/15 border-negative/40 text-negative font-mono text-xs"
                  style={{ minHeight: 160 }}
                />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
