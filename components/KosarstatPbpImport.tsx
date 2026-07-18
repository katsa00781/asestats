'use client';
import { authFetch } from '@/lib/api-fetch';

import { useEffect, useMemo, useRef, useState } from 'react';
import { DatabaseZap, Loader2, ShieldAlert, Square, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type KosarstatPbpImportProps = {
  selectedSeasonId: string | null;
  selectedSeasonName?: string;
  onImportComplete?: () => void;
};

type ImportStatus = 'idle' | 'running' | 'success' | 'error' | 'stopped';
type CleanupStatus = 'idle' | 'running' | 'success' | 'error';

type ImportApiResponse = {
  ok: boolean;
  started?: boolean;
  startedAt?: number;
  message?: string;
  durationMs?: number;
  stdout?: string;
  stderr?: string;
  error?: string;
};

type ImportStatusResponse = {
  ok: boolean;
  isRunning?: boolean;
  startedAt?: number | null;
  finishedAt?: number | null;
  durationMs?: number | null;
  exitCode?: number | null;
  lastError?: string | null;
  stoppedByUser?: boolean;
  stopMessage?: string | null;
  seasonId?: string | null;
  seasonCode?: string | null;
  lastOutputAt?: number | null;
  stdoutTail?: string;
  stderrTail?: string;
};

type CleanupApiResponse = {
  ok: boolean;
  remainingRawRows?: number;
  warning?: string;
  error?: string;
};

type StopImportApiResponse = {
  ok: boolean;
  stopped?: boolean;
  message?: string;
  error?: string;
};

export function KosarstatPbpImport({ selectedSeasonId, selectedSeasonName, onImportComplete }: KosarstatPbpImportProps) {
  const cleanupConfirmWord = 'TORLES';
  const [seasonCode, setSeasonCode] = useState('2526');
  const [roundFilter, setRoundFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [gameIdFilter, setGameIdFilter] = useState('');
  const [gameLimit, setGameLimit] = useState('0');
  const [startGameIndex, setStartGameIndex] = useState('1');
  const [headless, setHeadless] = useState(true);
  const [forceReimport, setForceReimport] = useState(false);
  const [cleanupConfirmInput, setCleanupConfirmInput] = useState('');

  const [status, setStatus] = useState<ImportStatus>('idle');
  const [stdout, setStdout] = useState('');
  const [stderr, setStderr] = useState('');
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastOutputAt, setLastOutputAt] = useState<number | null>(null);

  const [cleanupStatus, setCleanupStatus] = useState<CleanupStatus>('idle');
  const [cleanupError, setCleanupError] = useState<string | null>(null);
  const [cleanupInfo, setCleanupInfo] = useState<string | null>(null);
  const [isStopping, setIsStopping] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completionNotifiedRef = useRef(false);
  const statusRef = useRef<ImportStatus>('idle');
  const activeImportStartedAtRef = useRef<number | null>(null);

  const canRun = Boolean(selectedSeasonId && status !== 'running' && cleanupStatus !== 'running');
  const canStop = Boolean(status === 'running' && !isStopping);
  const isCleanupConfirmed = cleanupConfirmInput.trim().toUpperCase() === cleanupConfirmWord;
  const canCleanup = Boolean(
    selectedSeasonId && cleanupStatus !== 'running' && status !== 'running' && isCleanupConfirmed
  );

  const normalizedGameLimit = useMemo(() => {
    const value = Number.parseInt(gameLimit, 10);
    if (Number.isNaN(value) || value < 0) return 0;
    return value;
  }, [gameLimit]);

  const normalizedStartGameIndex = useMemo(() => {
    const value = Number.parseInt(startGameIndex, 10);
    if (Number.isNaN(value) || value < 1) return 1;
    return value;
  }, [startGameIndex]);

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const refreshImportStatus = async (): Promise<ImportStatusResponse | null> => {
    try {
      const response = await authFetch('/api/kosarstat-pbp-import?tail=20000', { cache: 'no-store' });
      if (!response.ok) return null;
      const data = (await response.json()) as ImportStatusResponse;
      if (!data.ok) return null;

      setStdout(data.stdoutTail || '');
      setStderr(data.stderrTail || '');
      setLastOutputAt(typeof data.lastOutputAt === 'number' ? data.lastOutputAt : null);

      if (data.isRunning) {
        if (statusRef.current !== 'running') {
          setStatus('running');
          statusRef.current = 'running';
          setError(null);
        }
        if (typeof data.startedAt === 'number') {
          activeImportStartedAtRef.current = data.startedAt;
        }
      }

      const currentStatus = statusRef.current;
      const shouldFinalize = !data.isRunning && currentStatus === 'running';

      if (shouldFinalize) {
        const activeStartedAt = activeImportStartedAtRef.current;
        if (activeStartedAt && typeof data.startedAt === 'number' && data.startedAt !== activeStartedAt) {
          return null;
        }

        if (typeof data.durationMs === 'number') {
          setDurationMs(data.durationMs);
        }

        if (data.stoppedByUser) {
          setError(null);
          setStatus('stopped');
          statusRef.current = 'stopped';
          setCleanupInfo(data.stopMessage || 'A Kosarstat import leallt.');
          activeImportStartedAtRef.current = null;
          stopPolling();
          return data;
        }

        if (data.lastError) {
          setError(data.lastError);
          setStatus('error');
          statusRef.current = 'error';
        } else if (typeof data.exitCode === 'number' && data.exitCode !== 0) {
          setError(`A Kosarstat import ${data.exitCode} koddal allt le.`);
          setStatus('error');
          statusRef.current = 'error';
        } else {
          setError(null);
          setStatus('success');
          statusRef.current = 'success';
          if (!completionNotifiedRef.current) {
            completionNotifiedRef.current = true;
            onImportComplete?.();
          }
        }

        activeImportStartedAtRef.current = null;
        stopPolling();
      }
      return data;
    } catch {
      // no-op
      return null;
    }
  };

  const startPolling = () => {
    stopPolling();
    void refreshImportStatus();
    pollingRef.current = setInterval(() => {
      void refreshImportStatus();
    }, 1500);
  };

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const data = await refreshImportStatus();
      if (cancelled) return;
      if (data?.isRunning) {
        startPolling();
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
      stopPolling();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleImport = async () => {
    if (!selectedSeasonId) {
      setError('Valassz szezont az import inditasa elott.');
      setStatus('error');
      return;
    }

    setStatus('running');
    statusRef.current = 'running';
    completionNotifiedRef.current = false;
    setError(null);
    setStdout('');
    setStderr('');
    setDurationMs(null);
    setLastOutputAt(Date.now());
    setCleanupInfo(null);
    activeImportStartedAtRef.current = null;

    let keepPolling = false;

    try {
      const response = await authFetch('/api/kosarstat-pbp-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonId: selectedSeasonId,
          seasonName: selectedSeasonName,
          seasonCode: seasonCode.trim() || undefined,
          rounds: roundFilter.trim() || undefined,
          dateFrom: dateFrom.trim() || undefined,
          dateTo: dateTo.trim() || undefined,
          gameIds: gameIdFilter.trim() || undefined,
          gameLimit: normalizedGameLimit,
          startGameIndex: normalizedStartGameIndex,
          forceReimport,
          headless,
        }),
      });

      const data = (await response.json()) as ImportApiResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Ismeretlen hiba tortent a Kosarstat import kozben.');
      }

      if (data.started) {
        setStatus('running');
        statusRef.current = 'running';
        setDurationMs(null);
        const startedAt = typeof data.startedAt === 'number' ? data.startedAt : Date.now();
        activeImportStartedAtRef.current = startedAt;
        setLastOutputAt(startedAt);
        keepPolling = true;
        startPolling();
      } else {
        setStatus('success');
        statusRef.current = 'success';
        setStdout(data.stdout || '');
        setStderr(data.stderr || '');
        setDurationMs(typeof data.durationMs === 'number' ? data.durationMs : null);
        setLastOutputAt(Date.now());
        onImportComplete?.();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ismeretlen hiba tortent a Kosarstat import kozben.';
      setError(message);
      setStatus('error');
      statusRef.current = 'error';
      activeImportStartedAtRef.current = null;
    } finally {
      if (!keepPolling) {
        stopPolling();
      }
      void refreshImportStatus();
    }
  };

  const handleCleanup = async () => {
    if (!selectedSeasonId) {
      setCleanupError('Valassz szezont a torleshez.');
      setCleanupStatus('error');
      return;
    }

    if (!isCleanupConfirmed) {
      setCleanupError(`A torleshez ird be pontosan: ${cleanupConfirmWord}`);
      setCleanupStatus('error');
      return;
    }

    setCleanupStatus('running');
    setCleanupError(null);
    setCleanupInfo(null);

    try {
      const response = await authFetch('/api/kosarstat-pbp-cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonId: selectedSeasonId,
          seasonCode: seasonCode.trim() || undefined,
        }),
      });

      const data = (await response.json()) as CleanupApiResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Ismeretlen hiba tortent a Kosarstat adatok torlesekor.');
      }

      setCleanupStatus('success');
      setCleanupConfirmInput('');
      setCleanupInfo(
        typeof data.remainingRawRows === 'number'
          ? `Torles kesz. Megmaradt nyers sorok az adott szurore: ${data.remainingRawRows}`
          : data.warning || 'Torles kesz.'
      );
      onImportComplete?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ismeretlen hiba tortent a Kosarstat adatok torlesekor.';
      setCleanupError(message);
      setCleanupStatus('error');
    }
  };

  const handleStopImport = async () => {
    if (!canStop) return;

    setIsStopping(true);
    setError(null);

    try {
      const response = await authFetch('/api/kosarstat-pbp-import', {
        method: 'DELETE',
      });

      const data = (await response.json()) as StopImportApiResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Nem sikerult leallitani a Kosarstat importot.');
      }

      setStatus('stopped');
      statusRef.current = 'stopped';
      setCleanupInfo(data.message || 'Import leallitasi kerelem elkuldve.');
      stopPolling();
      void refreshImportStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nem sikerult leallitani a Kosarstat importot.';
      setError(message);
    } finally {
      setIsStopping(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DatabaseZap className="text-orange" size={20} strokeWidth={1.6} />
          Kosarstat play-by-play / lineup import
        </CardTitle>
        <CardDescription>
          A Kosarstat szezon oldalrol osszegyujti a meccsazonositokat, majd beolvassa a meccs aloldalakat a
          `kosarstat_game_pages_raw` es `kosarstat_game_page_tables` tablaba.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!selectedSeasonId && (
          <div className="flex items-center gap-3 rounded-lg border border-warning/40 bg-warning/15 px-3 py-2 text-warning">
            <ShieldAlert size={18} strokeWidth={1.6} />
            <span className="text-sm">Az importhoz elobb valassz szezont!</span>
          </div>
        )}

        {selectedSeasonId && (
          <p className="text-xs text-muted">Aktiv szezon: {selectedSeasonName || 'ismeretlen nev'}</p>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <label className="text-sm text-secondary">Kosarstat season code</label>
            <Input
              value={seasonCode}
              onChange={event => setSeasonCode(event.target.value)}
              placeholder="pl. 2526"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-secondary">Game limit</label>
            <Input
              value={gameLimit}
              onChange={event => setGameLimit(event.target.value)}
              placeholder="0 = osszes"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-secondary">Kezdes meccs sorszam</label>
            <Input
              value={startGameIndex}
              onChange={event => setStartGameIndex(event.target.value)}
              placeholder="71"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-secondary">Forduló szűrő</label>
            <Input
              value={roundFilter}
              onChange={event => setRoundFilter(event.target.value)}
              placeholder="pl. 24 vagy 20-24 vagy 22,24"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-secondary">Kezdő dátum</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={event => setDateFrom(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-secondary">Vég dátum</label>
            <Input
              type="date"
              value={dateTo}
              onChange={event => setDateTo(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-secondary">Game ID szűrő</label>
            <Input
              value={gameIdFilter}
              onChange={event => setGameIdFilter(event.target.value)}
              placeholder="pl. 20260328102119 vagy vesszővel több"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-secondary">Bongeszo mod</label>
            <button
              type="button"
              onClick={() => setHeadless(prev => !prev)}
              className="w-full rounded-md border border-border-subtle bg-surface-2 px-3 py-2 text-left text-sm text-primary hover:bg-surface-3"
            >
              {headless ? 'Headless (gyorsabb)' : 'Lathato bongo (debug)'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-md border border-border-subtle bg-surface-1 px-3 py-2">
          <button
            type="button"
            onClick={() => setForceReimport(prev => !prev)}
            className="rounded-md border border-border-subtle bg-surface-2 px-3 py-1 text-xs text-primary hover:bg-surface-3"
          >
            {forceReimport ? 'Teljes missing-check: BE' : 'Teljes missing-check: KI'}
          </button>
          <span className="text-xs text-secondary">
            Soha nem ir felul meglevo adatot: csak hianyzo tablakat/DOM metadata mezoket potol. BE allasban minden mar importalt meccset is vegignez.
          </span>
        </div>

        <div className="rounded-md border border-border-subtle bg-surface-1 px-3 py-2 text-xs text-secondary">
          Tipp: fordulo szerinti gyors importhoz hasznald a &quot;Forduló szűrő&quot; mezőt. Formátum: 24, 20-24, vagy 22,24.
          Dátum alapú importhoz töltsd ki a &quot;Kezdő dátum&quot; és/vagy &quot;Vég dátum&quot; mezőt.
          Ha forduló vagy game ID szűrőt adsz meg, a rendszer automatikusan újraimportálja a kiválasztott meccseket.
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 rounded-lg border border-border-subtle bg-surface-1 p-3">
            <div className="text-xs uppercase tracking-wide text-secondary">Import vezerles</div>
            <Button onClick={handleImport} disabled={!canRun} className="w-full">
              {status === 'running' ? <Loader2 size={16} className="mr-2 animate-spin" /> : <DatabaseZap size={16} className="mr-2" strokeWidth={1.6} />}
              Kosarstat import inditasa
            </Button>
            <Button
              onClick={handleStopImport}
              disabled={!canStop}
              variant="secondary"
              className="w-full"
            >
              {isStopping ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Square size={16} className="mr-2" strokeWidth={1.6} />}
              Import leallitasa
            </Button>
          </div>

          <div className="space-y-2 rounded-lg border border-border-subtle bg-surface-1 p-3">
            <div className="text-xs uppercase tracking-wide text-secondary">Torles</div>
            <div className="text-xs text-warning">
              Torles megerositesehez ird be: <span className="font-semibold">{cleanupConfirmWord}</span>
            </div>
            <Input
              value={cleanupConfirmInput}
              onChange={event => setCleanupConfirmInput(event.target.value)}
              placeholder={cleanupConfirmWord}
            />
            <Button
              onClick={handleCleanup}
              disabled={!canCleanup}
              variant="destructive"
              className="w-full"
            >
              {cleanupStatus === 'running' ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Trash2 size={16} className="mr-2" strokeWidth={1.6} />}
              Kosarstat adatok torlese (aktualis szezon)
            </Button>
          </div>
        </div>

        {(status !== 'idle' || cleanupStatus !== 'idle') && (
          <div className="space-y-2 max-w-full overflow-hidden">
            {status !== 'idle' && (
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant={status === 'error' ? 'destructive' : status === 'running' ? 'secondary' : 'default'}>
                  {status === 'running'
                    ? 'Import folyamatban...'
                    : status === 'success'
                    ? 'Import sikeres'
                    : status === 'stopped'
                    ? 'Import leallitva'
                    : 'Import hiba'}
                </Badge>
                {status === 'running' && lastOutputAt && (
                  <span className="text-xs text-secondary break-all">
                    Utolso naplo frissites: {new Date(lastOutputAt).toLocaleTimeString('hu-HU')}
                  </span>
                )}
                {durationMs !== null && status === 'success' && (
                  <span className="text-sm text-secondary">Futasi ido: {(durationMs / 1000).toFixed(1)} mp</span>
                )}
              </div>
            )}
            {cleanupStatus !== 'idle' && (
              <Badge variant={cleanupStatus === 'error' ? 'destructive' : cleanupStatus === 'running' ? 'secondary' : 'default'}>
                {cleanupStatus === 'running' ? 'Torles folyamatban...' : cleanupStatus === 'success' ? 'Torles kesz' : 'Torles hiba'}
              </Badge>
            )}
            {error && <p className="text-sm text-negative wrap-break-word">{error}</p>}
            {cleanupError && <p className="text-sm text-negative wrap-break-word">{cleanupError}</p>}
            {cleanupInfo && <p className="text-sm text-primary wrap-break-word">{cleanupInfo}</p>}
          </div>
        )}

        {(stdout || stderr) && (
          <div className="grid gap-4 md:grid-cols-2 max-w-full overflow-hidden">
            {stdout && (
              <div className="min-w-0">
                <div className="text-xs text-secondary mb-2">Folyamat naplo</div>
                <Textarea
                  value={stdout}
                  readOnly
                  className="bg-surface-2 border-border-subtle text-primary font-mono text-xs h-72 resize-none overflow-y-auto whitespace-pre-wrap wrap-break-word"
                  style={{ minHeight: 160, maxHeight: 288, overflowY: 'auto' }}
                />
              </div>
            )}
            {stderr && (
              <div className="min-w-0">
                <div className="text-xs text-negative mb-2">Figyelmeztetesek / hibak</div>
                <Textarea
                  value={stderr}
                  readOnly
                  className="bg-negative/15 border-negative/40 text-negative font-mono text-xs h-72 resize-none overflow-y-auto whitespace-pre-wrap wrap-break-word"
                  style={{ minHeight: 160, maxHeight: 288, overflowY: 'auto' }}
                />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
