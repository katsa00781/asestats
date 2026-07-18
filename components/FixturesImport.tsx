'use client';
import { authFetch } from '@/lib/api-fetch';

import { useState } from 'react';
import { CalendarPlus, Loader2, ShieldAlert } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type FixturesImportProps = {
  selectedSeasonId: string | null;
  selectedSeasonName?: string;
  onImportComplete?: () => void;
};

type ImportStatus = 'idle' | 'running' | 'success' | 'error';

type ApiResponse = {
  ok: boolean;
  durationMs?: number;
  stdout?: string;
  stderr?: string;
  error?: string;
};

export function FixturesImport({ selectedSeasonId, selectedSeasonName, onImportComplete }: FixturesImportProps) {
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [stdout, setStdout] = useState('');
  const [stderr, setStderr] = useState('');
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seasonSlug, setSeasonSlug] = useState('x2526');
  const [scheduleUrl, setScheduleUrl] = useState('');

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
      const response = await authFetch('/api/hunbasket-fixtures-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonId: selectedSeasonId,
          seasonName: selectedSeasonName,
          seasonSlug: seasonSlug.trim() || undefined,
          scheduleUrl: scheduleUrl.trim() || undefined,
        }),
      });

      const data = (await response.json()) as ApiResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Ismeretlen hiba történt a menetrend import során.');
      }

      setStatus('success');
      setStdout(data.stdout || '');
      setStderr(data.stderr || '');
      setDurationMs(typeof data.durationMs === 'number' ? data.durationMs : null);
      onImportComplete?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ismeretlen hiba történt a menetrend import során.';
      setError(message);
      setStatus('error');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarPlus className="text-cyan" size={20} strokeWidth={1.6} />
          Menetrend import (következő meccsek)
        </CardTitle>
        <CardDescription>
          A Hunbasket teljes menetrendből beolvassa a lejátszott és a következő mérkőzéseket is a `league_fixtures` táblába.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!selectedSeasonId && (
          <div className="flex items-center gap-3 rounded-lg border border-warning/40 bg-warning/15 px-3 py-2 text-warning">
            <ShieldAlert size={18} strokeWidth={1.6} />
            <span className="text-sm">A menetrend importálásához előbb válassz szezont!</span>
          </div>
        )}

        {selectedSeasonId && (
          <p className="text-xs text-muted">
            Aktív szezon: {selectedSeasonName || 'ismeretlen név'}
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm text-secondary">Hunbasket season slug</label>
            <Input
              value={seasonSlug}
              onChange={event => setSeasonSlug(event.target.value)}
              placeholder="pl. x2526"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-secondary">Egyedi menetrend URL (opcionális)</label>
            <Input
              value={scheduleUrl}
              onChange={event => setScheduleUrl(event.target.value)}
              placeholder="https://hunbasket.hu/menetrend-teljes/..."
            />
          </div>
        </div>

        <Button
          onClick={handleImport}
          disabled={!canRun}
          className="w-full md:w-auto"
        >
          {status === 'running' ? (
            <Loader2 size={16} className="mr-2 animate-spin" />
          ) : (
            <CalendarPlus size={16} className="mr-2" strokeWidth={1.6} />
          )}
          Menetrend import indítása
        </Button>

        {status !== 'idle' && (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Badge variant={status === 'error' ? 'destructive' : status === 'running' ? 'secondary' : 'default'}>
                {status === 'running' ? 'Folyamatban...' : status === 'success' ? 'Sikeres import' : 'Hiba történt'}
              </Badge>
              {durationMs !== null && status === 'success' && (
                <span className="text-sm text-secondary">Futási idő: {(durationMs / 1000).toFixed(1)} mp</span>
              )}
            </div>
            {error && <p className="text-sm text-negative">{error}</p>}
          </div>
        )}

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
