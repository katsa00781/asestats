'use client';

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
      const response = await fetch('/api/hunbasket-round-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roundFilter: roundFilter.trim() || undefined,
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
            <span className="text-sm text-slate-400">
              Futási idő: {(durationMs / 1000).toFixed(1)} mp
            </span>
          )}
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    );
  };

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader>
        <CardTitle className="text-slate-50 flex items-center gap-2">
          <PlayCircle className="text-emerald-400" size={20} />
          Forduló alapú Hunbasket import
        </CardTitle>
        <CardDescription className="text-slate-400">
          A művelet frissíti a menetrendet (következő meccsek), a tabellát és a fordulószűrt meccsstatisztikákat is.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!selectedSeasonId && (
          <div className="flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-900/20 px-3 py-2 text-amber-200">
            <ShieldAlert size={18} />
            <span className="text-sm">A forduló importálásához előbb válassz szezont!</span>
          </div>
        )}
        {selectedSeasonId && (
          <p className="text-xs text-slate-500">
            Aktív szezon: {selectedSeasonName || 'ismeretlen név'}
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-[2fr_1fr] md:items-end">
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Forduló szűrő</label>
            <Input
              value={roundFilter}
              onChange={event => setRoundFilter(event.target.value)}
              placeholder="opcionális: pl. 5 vagy 10-12,15 vagy Negyeddöntő"
              className="bg-slate-800 border-slate-700 text-slate-100"
            />
            <p className="text-xs text-slate-500">
              Opcionális. Több forduló: 5,7,9 • Tartomány: 10-12 • Playoff kör: Negyeddöntő, Elődöntő.
            </p>
          </div>
          <Button
            onClick={handleImport}
            disabled={!canRun}
            className="bg-emerald-600 hover:bg-emerald-700 w-full md:w-auto"
          >
            {status === 'running' ? (
              <Loader2 size={16} className="mr-2 animate-spin" />
            ) : (
              <PlayCircle size={16} className="mr-2" />
            )}
            Import indítása
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Season slug</label>
            <Input
              value={seasonSlug}
              onChange={event => setSeasonSlug(event.target.value)}
              placeholder="pl. x2526"
              className="bg-slate-800 border-slate-700 text-slate-100"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-300">League kód</label>
            <Input
              value={leagueCode}
              onChange={event => setLeagueCode(event.target.value)}
              placeholder="pl. hun_ply"
              className="bg-slate-800 border-slate-700 text-slate-100"
            />
          </div>
          <div className="space-y-2 md:col-span-3">
            <label className="text-sm text-slate-300">Menetrend URL (tabella + eredmények forrás)</label>
            <Input
              value={scheduleUrl}
              onChange={event => setScheduleUrl(event.target.value)}
              placeholder="https://hunbasket.hu/menetrend-teljes/ferfi/x2526/hun_ply"
              className="bg-slate-800 border-slate-700 text-slate-100"
            />
          </div>
        </div>

        {renderStatus()}

        {(stdout || stderr) && (
          <div className="grid gap-4 md:grid-cols-2">
            {stdout && (
              <div>
                <div className="text-xs text-slate-400 mb-2">Folyamat napló</div>
                <Textarea
                  value={stdout}
                  readOnly
                  className="bg-slate-950/60 border-slate-800 text-slate-300 font-mono text-xs"
                  style={{ minHeight: 160 }}
                />
              </div>
            )}
            {stderr && (
              <div>
                <div className="text-xs text-red-400 mb-2">Figyelmeztetések / hibák</div>
                <Textarea
                  value={stderr}
                  readOnly
                  className="bg-red-950/30 border-red-500/30 text-red-200 font-mono text-xs"
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
