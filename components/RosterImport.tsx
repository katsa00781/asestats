'use client';
import { authFetch } from '@/lib/api-fetch';

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
      const response = await authFetch('/api/hunbasket-roster-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as ApiResponse;

      // A script kimenetét hiba esetén is megjelenítjük – enélkül csak a
      // generikus "1 kóddal állt le" üzenet látszik, a tényleges ok nem.
      setStdout(data.stdout || '');
      setStderr(data.stderr || '');

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Ismeretlen hiba történt a keret frissítése közben.');
      }

      setStatus('success');
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
            <span className="text-sm text-secondary">Futási idő: {(durationMs / 1000).toFixed(1)} mp</span>
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
          <Users className="text-positive" size={20} strokeWidth={1.6} />
          Hunbasket keret frissítés
        </CardTitle>
        <CardDescription>
          A tabella oldalról kiolvasott összes játékost szinkronban tartja a Supabase `players` táblájával (új játékos, frissített adatok, inaktivált rekordok).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!selectedSeasonId && (
          <div className="flex items-center gap-3 rounded-lg border border-warning/40 bg-warning/15 px-3 py-2 text-warning">
            <ShieldAlert size={18} strokeWidth={1.6} />
            <span className="text-sm">A keret frissítéséhez előbb válassz szezont!</span>
          </div>
        )}
        {selectedSeasonId && (
          <p className="text-xs text-muted">Aktív szezon: {selectedSeasonName || 'ismeretlen név'}</p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm text-secondary">Csapat szűrő (opcionális)</label>
            <Textarea
              value={teamFilter}
              onChange={event => setTeamFilter(event.target.value)}
              placeholder="pl. Falco, ASE, Honvéd"
              style={{ minHeight: 88 }}
            />
            <p className="text-xs text-muted">
              Több csapatot vesszővel vagy új sorral választhatsz el. Ha üresen hagyod, minden csapat kerete frissül.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-secondary flex items-center gap-2">
              Szezon slug (opcionális)
              <span className="inline-flex items-center gap-1 text-[11px] rounded bg-surface-2 px-2 py-0.5 text-secondary">
                <WandSparkles size={12} /> pl. x2526
              </span>
            </label>
            <Input
              value={seasonSlug}
              onChange={event => setSeasonSlug(event.target.value)}
              placeholder="x2526"
            />
            <p className="text-xs text-muted">
              Ha üresen hagyod, a szerver `.env.local` értékét használjuk. A slug határozza meg, hogy melyik hunbasket szezon URL-ről induljon a scraper.
            </p>
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
            <Users size={16} className="mr-2" strokeWidth={1.6} />
          )}
          Keret frissítés indítása
        </Button>

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

const normalizeTeamFilter = (value: string) => {
  const tokens = value
    .split(/[\n,]/)
    .map(token => token.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (tokens.length === 0) return undefined;
  return tokens.join(', ');
};
