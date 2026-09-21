'use client';

import { authFetch } from '@/lib/api-fetch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeftRight, Loader2 } from 'lucide-react';
import { useRef, useState } from 'react';

type ImportStatus = 'idle' | 'running' | 'success' | 'error';

export function LeaguePlayerMovementsImport() {
  const [seasonCount, setSeasonCount] = useState('4');
  const [teamFilter, setTeamFilter] = useState('');
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [stdout, setStdout] = useState('');
  const [stderr, setStderr] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const running = useRef(false);

  const handleImport = async () => {
    if (running.current) return;
    running.current = true;
    setStatus('running');
    setError(null);
    setStdout('');
    setStderr('');
    setDurationMs(null);
    try {
      const response = await authFetch('/api/kosarstat-team-players-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seasonCount: Number(seasonCount), teamFilter }),
      });
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('Érvénytelen válasz érkezett az importálótól.');
      }
      const data = payload as Record<string, unknown>;
      // Sikertelen importnál is megmarad a részletes diagnosztika.
      setStdout(typeof data.stdout === 'string' ? data.stdout : '');
      setStderr(typeof data.stderr === 'string' ? data.stderr : '');
      setDurationMs(typeof data.durationMs === 'number' ? data.durationMs : null);
      if (!response.ok || data.ok !== true) {
        throw new Error(typeof data.error === 'string' ? data.error : 'A játékosmozgás-import sikertelen.');
      }
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'A játékosmozgás-import sikertelen.');
      setStatus('error');
    } finally {
      running.current = false;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowLeftRight className="h-5 w-5 text-cyan" strokeWidth={1.6} />
          Játékosmozgások importálása
        </CardTitle>
        <CardDescription>
          A Kosarstat csapattörténetének frissítése az utolsó 3–4 szezonra.
          Az itt választott időtáv érvényes, a felső szezonszűrőtől függetlenül.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="movement-team-filter">Csapatszűrő (opcionális)</Label>
            <Textarea id="movement-team-filter" value={teamFilter} onChange={event => setTeamFilter(event.target.value)}
              placeholder="pl. Atomerőmű, Falco, Honvéd" maxLength={500} disabled={status === 'running'} />
            <p className="text-xs text-secondary">Vesszővel vagy új sorral elválasztott névrészletek. Üresen minden nyomon követett csapat frissül.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="movement-season-count">Időtáv</Label>
            <Select value={seasonCount} onValueChange={setSeasonCount} disabled={status === 'running'}>
              <SelectTrigger id="movement-season-count"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Utolsó 3 szezon</SelectItem>
                <SelectItem value="4">Utolsó 4 szezon</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-secondary">A teljes bajnokság importja több percig tarthat. A napló a futás végén jelenik meg.</p>
          </div>
        </div>
        <Button onClick={handleImport} disabled={status === 'running'} className="gap-2">
          {status === 'running' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeftRight className="h-4 w-4" strokeWidth={1.6} />}
          Játékosmozgások frissítése
        </Button>
        <div aria-live="polite" className="space-y-2">
          {status !== 'idle' && <Badge className={status === 'error' ? 'badge-negative' : status === 'success' ? 'badge-positive' : 'badge-cyan'}>
            {status === 'running' ? 'Import folyamatban…' : status === 'success' ? 'Import kész' : 'Sikertelen import'}
          </Badge>}
          {durationMs !== null && <p className="text-sm text-secondary">Futási idő: <span className="font-mono tabular-nums">{(durationMs / 1000).toFixed(1)}</span> mp</p>}
          {error && <p role="alert" className="text-sm text-negative">{error}</p>}
        </div>
        {(stdout || stderr) && <div className="grid gap-4 md:grid-cols-2">
          {stdout && <div className="space-y-2"><Label htmlFor="movement-import-log">Folyamatnapló</Label>
            <Textarea id="movement-import-log" readOnly value={stdout} className="min-h-40 font-mono text-xs" /></div>}
          {stderr && <div className="space-y-2"><Label htmlFor="movement-import-errors">Figyelmeztetések / hibák</Label>
            <Textarea id="movement-import-errors" readOnly value={stderr} className="min-h-40 font-mono text-xs text-warning" /></div>}
        </div>}
      </CardContent>
    </Card>
  );
}
