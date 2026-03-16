'use client';

import { useState } from 'react';
import { Users, Loader2, ShieldAlert, WandSparkles } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export type RosterImportProps = {
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

export function RosterImport({ selectedSeasonId, selectedSeasonName, onImportComplete }: RosterImportProps) {
  const [teamFilter, setTeamFilter] = useState('');
  const [seasonSlug, setSeasonSlug] = useState('');
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [stdout, setStdout] = useState('');
  const [stderr, setStderr] = useState('');
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canRun = Boolean(selectedSeasonId && status !== 'running');

  const handleImport = async () => {
    if (!selectedSeasonId) {
      setError('Válassz szezont a keret frissítéséhez.');
      setStatus('error');
      return;
    }

    setStatus('running');
    setError(null);
    setStdout('');
    setStderr('');
    setDurationMs(null);

    const normalizedTeamFilter = normalizeTeamFilter(teamFilter);
    const payload = {
      seasonId: selectedSeasonId,
      seasonName: selectedSeasonName,
      seasonSlug: seasonSlug.trim() || undefined,
      teamFilter: normalizedTeamFilter,
    };

    try {
      const response = await fetch('/api/hunbasket-roster-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as ApiResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Ismeretlen hiba történt a keret frissítése közben.');
      }

      setStatus('success');
      setStdout(data.stdout || '');
      setStderr(data.stderr || '');
      setDurationMs(typeof data.durationMs === 'number' ? data.durationMs : null);
      onImportComplete?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ismeretlen hiba történt a keret frissítése közben.';
      setError(message);
      setStatus('error');
    }
  };

  const renderStatus = () => {
    if (status === 'idle') return null;

    let variant: 'default' | 'secondary' | 'destructive' = 'default';
    let label = 'Sikeres frissítés';

    if (status === 'running') {
      variant = 'secondary';
      label = 'Folyamatban...';
    }
    if (status === 'error') {
      variant = 'destructive';
      label = 'Hiba történt';
    }

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Badge variant={variant}>{label}</Badge>
          {durationMs !== null && status === 'success' && (
            <span className="text-sm text-slate-400">Futási idő: {(durationMs / 1000).toFixed(1)} mp</span>
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
          <Users className="text-emerald-400" size={20} />
          Hunbasket keret frissítés
        </CardTitle>
        <CardDescription className="text-slate-400">
          A tabella oldalról kiolvasott összes játékost szinkronban tartja a Supabase `players` táblájával (új játékos, frissített adatok, inaktivált rekordok).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!selectedSeasonId && (
          <div className="flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-900/20 px-3 py-2 text-amber-200">
            <ShieldAlert size={18} />
            <span className="text-sm">A keret frissítéséhez előbb válassz szezont!</span>
          </div>
        )}
        {selectedSeasonId && (
          <p className="text-xs text-slate-500">Aktív szezon: {selectedSeasonName || 'ismeretlen név'}</p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Csapat szűrő (opcionális)</label>
            <Textarea
              value={teamFilter}
              onChange={event => setTeamFilter(event.target.value)}
              placeholder="pl. Falco, ASE, Honvéd"
              className="bg-slate-800 border-slate-700 text-slate-100"
              style={{ minHeight: 88 }}
            />
            <p className="text-xs text-slate-500">
              Több csapatot vesszővel vagy új sorral választhatsz el. Ha üresen hagyod, minden csapat kerete frissül.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-300 flex items-center gap-2">
              Szezon slug (opcionális)
              <span className="inline-flex items-center gap-1 text-[11px] rounded bg-slate-800 px-2 py-0.5 text-slate-400">
                <WandSparkles size={12} /> pl. x2526
              </span>
            </label>
            <Input
              value={seasonSlug}
              onChange={event => setSeasonSlug(event.target.value)}
              placeholder="x2526"
              className="bg-slate-800 border-slate-700 text-slate-100"
            />
            <p className="text-xs text-slate-500">
              Ha üresen hagyod, a szerver `.env.local` értékét használjuk. A slug határozza meg, hogy melyik hunbasket szezon URL-ről induljon a scraper.
            </p>
          </div>
        </div>

        <Button
          onClick={handleImport}
          disabled={!canRun}
          className="bg-emerald-600 hover:bg-emerald-700 w-full md:w-auto"
        >
          {status === 'running' ? (
            <Loader2 size={16} className="mr-2 animate-spin" />
          ) : (
            <Users size={16} className="mr-2" />
          )}
          Keret frissítés indítása
        </Button>

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

const normalizeTeamFilter = (value: string) => {
  const tokens = value
    .split(/[\n,]/)
    .map(token => token.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (tokens.length === 0) return undefined;
  return tokens.join(', ');
};
