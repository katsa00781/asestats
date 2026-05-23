'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { StatCard } from './ui/stat-card';
import { DataTable, type ColumnDef } from './ui/data-table';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, FileText, Sparkles, Loader2, Download, Save, ClipboardList } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { gameStatsToMd } from '@/lib/export-to-md';
import type { PlayerBreakdownExport, QuarterScoreExport } from '@/lib/export-to-md';
import { GamePbpCharts } from './GamePbpCharts';
import { buildPlayerPostGameReport } from '@/lib/player-postgame';
import type { PlayerPostGameBreakdown } from '@/lib/player-postgame';
import type { PlayerGameStat as LibPlayerGameStat, Position } from '@/lib/postgame-report';

type GameComparison = {
  game_id: string;
  date: string;
  opponent: string;
  home_away: string;
  our_score: number;
  opp_score: number;
  result: string;
  season_name: string;
  team_name: string;
  team_short_name: string;

  close_made: number;
  close_attempted: number;
  close_percentage: number;
  close_points: number;

  mid_made: number;
  mid_attempted: number;
  mid_percentage: number;
  mid_points: number;

  three_made: number;
  three_attempted: number;
  three_percentage: number;
  three_points: number;

  free_throw_made: number;
  free_throw_attempted: number;
  free_throw_percentage: number;
  free_throw_points: number;

  total_points: number;
  offensive_rebounds: number;
  defensive_rebounds: number;
  total_rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls_committed: number;
  valuation: number;

  avg_close_attempted: number;
  avg_close_percentage: number;
  avg_close_points: number;
  avg_mid_attempted: number;
  avg_mid_percentage: number;
  avg_mid_points: number;
  avg_three_attempted: number;
  avg_three_percentage: number;
  avg_three_points: number;
  avg_free_throw_attempted: number;
  avg_free_throw_percentage: number;
  avg_free_throw_points: number;
  avg_total_points: number;

  close_points_diff: number;
  mid_points_diff: number;
  three_points_diff: number;
  free_throw_points_diff: number;
  total_points_diff: number;
  close_percentage_diff: number;
  mid_percentage_diff: number;
  three_percentage_diff: number;
  free_throw_percentage_diff: number;
};

type PlayerGameStat = {
  player_id: string;
  player_name: string;
  player_number: number;
  player_position: string | null;
  minutes: number;
  points: number;
  close_made: number;
  close_attempted: number;
  mid_made: number;
  mid_attempted: number;
  three_made: number;
  three_attempted: number;
  free_throw_made: number;
  free_throw_attempted: number;
  offensive_rebounds: number;
  defensive_rebounds: number;
  total_rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls_committed: number;
  plus_minus: number;
  valuation: number;
};

type GameDetailsProps = {
  gameId: string;
  onBack: () => void;
};

type PlayerGameStatsRow = {
  player_id: string;
  minutes: number | null;
  points: number | null;
  close_made: number | null;
  close_attempted: number | null;
  mid_made: number | null;
  mid_attempted: number | null;
  three_made: number | null;
  three_attempted: number | null;
  free_throw_made: number | null;
  free_throw_attempted: number | null;
  offensive_rebounds: number | null;
  defensive_rebounds: number | null;
  total_rebounds: number | null;
  assists: number | null;
  steals: number | null;
  blocks: number | null;
  turnovers: number | null;
  fouls_committed: number | null;
  plus_minus: number | null;
  valuation: number | null;
  players: { name: string; number: number; position: string | null } | { name: string; number: number; position: string | null }[];
};

type TextReport = {
  id: string;
  report_type: 'pregame' | 'postgame' | 'combined' | 'manual';
  narrative: string;
  generated_at: string;
};

type QuarterStatRow = {
  team_side: 'home' | 'away' | 'unknown';
  quarter: number;
  points: number | null;
};

const PLAYER_STATS_COLUMNS: ColumnDef<PlayerGameStat>[] = [
  {
    key: 'player',
    label: 'Játékos',
    sortable: false,
    render: (r) => (
      <div className="flex items-center gap-2">
        <span className="font-mono tabular-nums text-muted text-xs">#{r.player_number}</span>
        <span className="text-primary text-sm">{r.player_name}</span>
      </div>
    ),
  },
  {
    key: 'minutes',
    label: 'Perc',
    numeric: true,
    render: (r) => <span data-stat>{r.minutes}</span>,
  },
  {
    key: 'points',
    label: 'Pont',
    numeric: true,
    render: (r) => <span className="text-orange font-semibold" data-stat>{r.points}</span>,
  },
  {
    key: 'close',
    label: 'Közeli',
    center: true,
    sortable: false,
    render: (r) => <span className="dt-num dt-num--muted">{r.close_made}/{r.close_attempted}</span>,
  },
  {
    key: 'mid',
    label: 'Közép',
    center: true,
    sortable: false,
    render: (r) => <span className="dt-num dt-num--muted">{r.mid_made}/{r.mid_attempted}</span>,
  },
  {
    key: 'three',
    label: '3pt',
    center: true,
    sortable: false,
    render: (r) => <span className="dt-num dt-num--muted">{r.three_made}/{r.three_attempted}</span>,
  },
  {
    key: 'ft',
    label: 'FT',
    center: true,
    sortable: false,
    render: (r) => <span className="dt-num dt-num--muted">{r.free_throw_made}/{r.free_throw_attempted}</span>,
  },
  {
    key: 'total_rebounds',
    label: 'LP',
    numeric: true,
    render: (r) => <span data-stat>{r.total_rebounds}</span>,
  },
  {
    key: 'assists',
    label: 'GP',
    numeric: true,
    render: (r) => <span data-stat>{r.assists}</span>,
  },
  {
    key: 'steals',
    label: 'LS',
    numeric: true,
    render: (r) => <span data-stat>{r.steals}</span>,
  },
  {
    key: 'blocks',
    label: 'BD',
    numeric: true,
    render: (r) => <span data-stat>{r.blocks}</span>,
  },
  {
    key: 'turnovers',
    label: 'LV',
    numeric: true,
    render: (r) => <span className="text-negative" data-stat>{r.turnovers}</span>,
  },
  {
    key: 'fouls_committed',
    label: 'SZ',
    numeric: true,
    render: (r) => <span data-stat>{r.fouls_committed}</span>,
  },
  {
    key: 'plus_minus',
    label: '±',
    numeric: true,
    render: (r) => (
      <span className={r.plus_minus >= 0 ? 'text-positive' : 'text-negative'} data-stat>
        {r.plus_minus > 0 ? '+' : ''}{r.plus_minus}
      </span>
    ),
  },
  {
    key: 'valuation',
    label: 'ÉRT',
    numeric: true,
    render: (r) => <span className="text-cyan font-semibold" data-stat>{r.valuation}</span>,
  },
];

const mapPosition = (pos: string | null): Position => {
  if (pos === 'C') return 'C';
  if (pos === 'F') return 'SF';
  return 'PG';
};

const impactBadgeClass = (impactClass: PlayerPostGameBreakdown['impactClass']) => {
  switch (impactClass) {
    case 'mvp': return 'badge-orange';
    case 'engine': return 'badge-positive';
    case 'support': return 'badge-cyan';
    default: return 'badge-neutral';
  }
};

export function GameDetails({ gameId, onBack }: GameDetailsProps) {
  const [gameComparison, setGameComparison] = useState<GameComparison | null>(null);
  const [playerStats, setPlayerStats] = useState<PlayerGameStat[]>([]);
  const [textReports, setTextReports] = useState<TextReport[]>([]);
  const [quarterStats, setQuarterStats] = useState<QuarterStatRow[]>([]);
  const [ourSide, setOurSide] = useState<'home' | 'away'>('home');
  const [loading, setLoading] = useState(true);
  const [playerBreakdowns, setPlayerBreakdowns] = useState<PlayerPostGameBreakdown[]>([]);
  const [playerTexts, setPlayerTexts] = useState<Record<string, string>>({});
  const [generatingPlayerTexts, setGeneratingPlayerTexts] = useState(false);
  const [manualText, setManualText] = useState('');
  const [savingManual, setSavingManual] = useState(false);

  const loadGameDetails = useCallback(async () => {
    setLoading(true);
    try {
      const { data: comparisonData, error: comparisonError } = await supabase
        .from('game_vs_season_comparison')
        .select('*')
        .eq('game_id', gameId)
        .single();

      if (comparisonError) throw comparisonError;
      setGameComparison(comparisonData);

      const { data: playersData, error: playersError } = await supabase
        .from('player_game_stats')
        .select(`
          player_id,
          minutes,
          points,
          close_made,
          close_attempted,
          mid_made,
          mid_attempted,
          three_made,
          three_attempted,
          free_throw_made,
          free_throw_attempted,
          offensive_rebounds,
          defensive_rebounds,
          total_rebounds,
          assists,
          steals,
          blocks,
          turnovers,
          fouls_committed,
          plus_minus,
          valuation,
          players!inner(
            name,
            number,
            position
          )
        `)
        .eq('game_id', gameId)
        .order('points', { ascending: false });

      if (playersError) throw playersError;

      const formattedPlayerStats: PlayerGameStat[] = (playersData || []).map(
        (stat: PlayerGameStatsRow) => {
          const playerInfo = Array.isArray(stat.players) ? stat.players[0] : stat.players;

          return {
            player_id: stat.player_id,
            player_name: playerInfo?.name ?? 'Ismeretlen játékos',
            player_number: playerInfo?.number ?? 0,
            player_position: playerInfo?.position ?? null,
            minutes: stat.minutes ?? 0,
            points: stat.points ?? 0,
            close_made: stat.close_made ?? 0,
            close_attempted: stat.close_attempted ?? 0,
            mid_made: stat.mid_made ?? 0,
            mid_attempted: stat.mid_attempted ?? 0,
            three_made: stat.three_made ?? 0,
            three_attempted: stat.three_attempted ?? 0,
            free_throw_made: stat.free_throw_made ?? 0,
            free_throw_attempted: stat.free_throw_attempted ?? 0,
            offensive_rebounds: stat.offensive_rebounds ?? 0,
            defensive_rebounds: stat.defensive_rebounds ?? 0,
            total_rebounds: stat.total_rebounds ?? 0,
            assists: stat.assists ?? 0,
            steals: stat.steals ?? 0,
            blocks: stat.blocks ?? 0,
            turnovers: stat.turnovers ?? 0,
            fouls_committed: stat.fouls_committed ?? 0,
            plus_minus: stat.plus_minus ?? 0,
            valuation: stat.valuation ?? 0,
          };
        }
      );

      setPlayerStats(formattedPlayerStats);

      const { data: reportsData } = await supabase
        .from('game_text_reports')
        .select('id, report_type, narrative, generated_at')
        .eq('game_id', gameId)
        .order('generated_at', { ascending: false });

      setTextReports((reportsData ?? []) as TextReport[]);

      const { data: playerReportsData } = await supabase
        .from('player_game_text_reports')
        .select('player_id, narrative, breakdown, generated_at')
        .eq('game_id', gameId);

      if (playerReportsData && playerReportsData.length > 0) {
        const texts: Record<string, string> = {};
        const breakdownsFromDb: PlayerPostGameBreakdown[] = [];
        for (const row of playerReportsData) {
          texts[row.player_id as string] = row.narrative as string;
          if (row.breakdown) {
            breakdownsFromDb.push(row.breakdown as unknown as PlayerPostGameBreakdown);
          }
        }
        setPlayerTexts(texts);
        if (breakdownsFromDb.length > 0) {
          const sorted = [...breakdownsFromDb].sort((a, b) => b.impactScore - a.impactScore);
          setPlayerBreakdowns(sorted);
        }
      }

      const { data: gameRow } = await supabase
        .from('games')
        .select('kosarstat_game_id, home_away, season_id')
        .eq('id', gameId)
        .single();

      if (gameRow?.kosarstat_game_id && gameRow?.season_id) {
        const { data: qData } = await supabase
          .from('kosarstat_game_quarter_stats' as never)
          .select('team_side, quarter, points')
          .eq('kosarstat_game_id', gameRow.kosarstat_game_id)
          .eq('season_id', gameRow.season_id)
          .order('quarter');

        setQuarterStats((qData ?? []) as QuarterStatRow[]);
        setOurSide(gameRow.home_away as 'home' | 'away');
      }
    } catch (error) {
      console.error('Hiba a meccs részletek betöltésekor:', error);
      toast.error('Nem sikerült betölteni a meccs részleteit');
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    loadGameDetails();
  }, [loadGameDetails]);

  const generatePlayerTexts = useCallback(async () => {
    if (!gameComparison || playerStats.length === 0) return;
    setGeneratingPlayerTexts(true);
    setPlayerTexts({});

    const libPlayers: (LibPlayerGameStat & { fouls: number })[] = playerStats
      .filter(p => p.minutes > 0)
      .map(p => ({
        playerId: p.player_id,
        name: p.player_name,
        position: mapPosition(p.player_position),
        minutes: p.minutes,
        points: p.points,
        fga2: p.close_attempted + p.mid_attempted,
        fgm2: p.close_made + p.mid_made,
        fga3: p.three_attempted,
        fgm3: p.three_made,
        fta: p.free_throw_attempted,
        ftm: p.free_throw_made,
        oreb: p.offensive_rebounds,
        dreb: p.defensive_rebounds,
        ast: p.assists,
        tov: p.turnovers,
        stl: p.steals,
        blk: p.blocks,
        val: p.valuation,
        fouls: p.fouls_committed,
        roles: [],
      }));

    const report = buildPlayerPostGameReport(libPlayers as LibPlayerGameStat[]);
    setPlayerBreakdowns(report.players);

    try {
      await Promise.all(
        report.players.map(async (breakdown) => {
          try {
            const resp = await fetch('/api/generate-player-postgame-text', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                gameId: gameComparison.game_id,
                playerId: breakdown.playerId,
                playerName: breakdown.name,
                teamName: gameComparison.team_name,
                opponentName: gameComparison.opponent,
                result: gameComparison.result as 'win' | 'loss',
                report: breakdown,
              }),
            });
            const json = (await resp.json()) as { ok: boolean; narrative?: string };
            if (json.ok && json.narrative) {
              setPlayerTexts(prev => ({ ...prev, [breakdown.playerId]: json.narrative! }));
            }
          } catch {
            // egyedi játékos hiba csendes kezelése
          }
        })
      );
    } catch (error) {
      console.error('Hiba a játékos értékelések generálásakor:', error);
      toast.error('Nem sikerült generálni a játékos értékeléseket');
    } finally {
      setGeneratingPlayerTexts(false);
    }
  }, [gameComparison, playerStats]);

  const exportGameMd = useCallback(() => {
    if (!gameComparison) return;

    const ourSideLocal = ourSide;
    const oppSide = ourSideLocal === 'home' ? 'away' : 'home';
    const allQuarters = [...new Set(quarterStats.map(r => r.quarter))].sort((a, b) => a - b);
    const quarterLabels: Record<number, string> = { 1: 'N1', 2: 'N2', 3: 'N3', 4: 'N4' };
    const quarterExport: QuarterScoreExport[] = allQuarters.map(q => {
      const ourRow = quarterStats.find(r => r.quarter === q && r.team_side === ourSideLocal);
      const oppRow = quarterStats.find(r => r.quarter === q && r.team_side === oppSide);
      return {
        quarter: quarterLabels[q] ?? `N${q}`,
        ourScore: ourRow?.points ?? 0,
        oppScore: oppRow?.points ?? 0,
      };
    });

    const breakdownExport: PlayerBreakdownExport[] = playerBreakdowns.map(b => ({
      playerId: b.playerId,
      name: b.name,
      position: b.position,
      impactLabel: b.impactLabel,
      summaryLine: b.summaryLine,
      val: b.val,
      valPer36: b.valPer36,
      tsPct: b.tsPct,
      usageShare: b.usageShare,
      minutes: b.minutes,
      points: b.points,
      rebounds: b.rebounds,
      assists: b.assists,
      turnovers: b.turnovers,
      stocks: b.stocks,
      strengths: b.strengths,
      issues: b.issues,
      focus: b.focus,
      roles: b.roles,
    }));

    const md = gameStatsToMd(gameComparison, playerStats, {
      quarterStats: quarterExport.length > 0 ? quarterExport : undefined,
      teamShortName: gameComparison.team_short_name,
      playerBreakdowns: breakdownExport.length > 0 ? breakdownExport : undefined,
      playerTexts: Object.keys(playerTexts).length > 0 ? playerTexts : undefined,
    });

    const filename = `meccs-${gameComparison.date}-${gameComparison.opponent.replace(/\s+/g, '-')}.md`;
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    navigator.clipboard.writeText(md).catch(() => null);
    toast.success('MD exportálva – vágólapra másolva és letöltve');
  }, [gameComparison, playerStats, quarterStats, ourSide, playerBreakdowns, playerTexts]);

  const saveManualReport = useCallback(async () => {
    if (!gameComparison || !manualText.trim()) return;
    setSavingManual(true);
    try {
      const resp = await fetch('/api/save-manual-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportTarget: 'game',
          gameId: gameComparison.game_id,
          narrative: manualText.trim(),
          opponentName: gameComparison.opponent,
        }),
      });
      const json = (await resp.json()) as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? 'Mentési hiba');
      toast.success('Elemzés elmentve');
      setTextReports(prev => {
        const filtered = prev.filter(r => r.report_type !== 'manual');
        return [...filtered, { id: Date.now().toString(), report_type: 'manual', narrative: manualText.trim(), generated_at: new Date().toISOString() }];
      });
      setManualText('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Mentési hiba');
    } finally {
      setSavingManual(false);
    }
  }, [gameComparison, manualText]);

  const renderDiffIndicator = (diff: number) => {
    if (diff > 0) {
      return (
        <span className="text-positive flex items-center gap-1">
          <TrendingUp className="w-4 h-4" strokeWidth={1.6} />
          +{diff.toFixed(1)}
        </span>
      );
    } else if (diff < 0) {
      return (
        <span className="text-negative flex items-center gap-1">
          <TrendingDown className="w-4 h-4" strokeWidth={1.6} />
          {diff.toFixed(1)}
        </span>
      );
    } else {
      return (
        <span className="text-muted flex items-center gap-1">
          <Minus className="w-4 h-4" strokeWidth={1.6} />
          0
        </span>
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan mx-auto" />
          <p className="mt-4 text-secondary">Betöltés...</p>
        </div>
      </div>
    );
  }

  if (!gameComparison) {
    return (
      <div className="text-center p-8">
        <p className="text-secondary">Nem található meccs adat</p>
        <Button onClick={onBack} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" strokeWidth={1.6} />
          Vissza
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Fejléc */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Button onClick={onBack} variant="outline" size="sm">
          <ArrowLeft className="w-4 h-4 mr-2" strokeWidth={1.6} />
          Vissza
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-display uppercase tracking-wide text-primary">
            {gameComparison.team_short_name} vs {gameComparison.opponent}
          </h2>
          <p className="text-secondary text-sm">
            {new Date(gameComparison.date).toLocaleDateString('hu-HU')} · {gameComparison.season_name}
          </p>
        </div>
        <Button onClick={exportGameMd} variant="outline" size="sm" className="text-cyan">
          <Download className="w-4 h-4 mr-2" strokeWidth={1.6} />
          Export MD
        </Button>
        <span className={`ml-auto sm:ml-0 font-mono tabular-nums ${gameComparison.result === 'win' ? 'badge-positive' : 'badge-negative'}`}>
          {gameComparison.our_score} – {gameComparison.opp_score}
        </span>
      </div>

      {/* Dobás Statisztikák */}
      <Card className="shadow-panel">
        <CardHeader>
          <CardTitle className="text-base sm:text-lg font-display uppercase tracking-wide">
            Dobás Statisztikák (Meccs vs Szezon Átlag)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="text-left p-2 text-secondary text-xs font-display uppercase tracking-wide">Típus</th>
                  <th className="text-center p-2 text-secondary text-xs font-display uppercase tracking-wide">Kísérletek</th>
                  <th className="text-center p-2 text-secondary text-xs font-display uppercase tracking-wide">Hatékonyság %</th>
                  <th className="text-center p-2 text-secondary text-xs font-display uppercase tracking-wide">Átlag %</th>
                  <th className="text-center p-2 text-secondary text-xs font-display uppercase tracking-wide">Pontérték</th>
                  <th className="text-center p-2 text-secondary text-xs font-display uppercase tracking-wide">Pontok</th>
                  <th className="text-center p-2 text-secondary text-xs font-display uppercase tracking-wide">Átlag Pontok</th>
                  <th className="text-center p-2 text-secondary text-xs font-display uppercase tracking-wide">Különbség</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border-subtle hover:bg-surface-2/50">
                  <td className="p-2 font-medium text-primary">Közeli</td>
                  <td className="text-center p-2 font-mono tabular-nums text-primary">{gameComparison.close_attempted}</td>
                  <td className="text-center p-2 font-mono tabular-nums text-primary">{gameComparison.close_percentage}%</td>
                  <td className="text-center p-2 font-mono tabular-nums text-muted">{gameComparison.avg_close_percentage}%</td>
                  <td className="text-center p-2 text-secondary">2</td>
                  <td className="text-center p-2 font-semibold font-mono tabular-nums text-primary">{gameComparison.close_points}</td>
                  <td className="text-center p-2 font-mono tabular-nums text-muted">{gameComparison.avg_close_points}</td>
                  <td className="text-center p-2">{renderDiffIndicator(gameComparison.close_points_diff)}</td>
                </tr>
                <tr className="border-b border-border-subtle hover:bg-surface-2/50">
                  <td className="p-2 font-medium text-primary">Középtávoli</td>
                  <td className="text-center p-2 font-mono tabular-nums text-primary">{gameComparison.mid_attempted}</td>
                  <td className="text-center p-2 font-mono tabular-nums text-primary">{gameComparison.mid_percentage}%</td>
                  <td className="text-center p-2 font-mono tabular-nums text-muted">{gameComparison.avg_mid_percentage}%</td>
                  <td className="text-center p-2 text-secondary">2</td>
                  <td className="text-center p-2 font-semibold font-mono tabular-nums text-primary">{gameComparison.mid_points}</td>
                  <td className="text-center p-2 font-mono tabular-nums text-muted">{gameComparison.avg_mid_points}</td>
                  <td className="text-center p-2">{renderDiffIndicator(gameComparison.mid_points_diff)}</td>
                </tr>
                <tr className="border-b border-border-subtle hover:bg-surface-2/50">
                  <td className="p-2 font-medium text-primary">3 pontos</td>
                  <td className="text-center p-2 font-mono tabular-nums text-primary">{gameComparison.three_attempted}</td>
                  <td className="text-center p-2 font-mono tabular-nums text-primary">{gameComparison.three_percentage}%</td>
                  <td className="text-center p-2 font-mono tabular-nums text-muted">{gameComparison.avg_three_percentage}%</td>
                  <td className="text-center p-2 text-secondary">3</td>
                  <td className="text-center p-2 font-semibold font-mono tabular-nums text-primary">{gameComparison.three_points}</td>
                  <td className="text-center p-2 font-mono tabular-nums text-muted">{gameComparison.avg_three_points}</td>
                  <td className="text-center p-2">{renderDiffIndicator(gameComparison.three_points_diff)}</td>
                </tr>
                <tr className="border-b border-border-subtle hover:bg-surface-2/50">
                  <td className="p-2 font-medium text-primary">Büntető</td>
                  <td className="text-center p-2 font-mono tabular-nums text-primary">{gameComparison.free_throw_attempted}</td>
                  <td className="text-center p-2 font-mono tabular-nums text-primary">{gameComparison.free_throw_percentage}%</td>
                  <td className="text-center p-2 font-mono tabular-nums text-muted">{gameComparison.avg_free_throw_percentage}%</td>
                  <td className="text-center p-2 text-secondary">1</td>
                  <td className="text-center p-2 font-semibold font-mono tabular-nums text-primary">{gameComparison.free_throw_points}</td>
                  <td className="text-center p-2 font-mono tabular-nums text-muted">{gameComparison.avg_free_throw_points}</td>
                  <td className="text-center p-2">{renderDiffIndicator(gameComparison.free_throw_points_diff)}</td>
                </tr>
                <tr className="bg-surface-2 font-bold">
                  <td className="p-2 text-primary" colSpan={5}>Összes pont</td>
                  <td className="text-center p-2 font-mono tabular-nums text-primary">{gameComparison.total_points}</td>
                  <td className="text-center p-2 font-mono tabular-nums text-muted">{gameComparison.avg_total_points}</td>
                  <td className="text-center p-2">{renderDiffIndicator(gameComparison.total_points_diff)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Fő csapat statisztikák – StatCard sor */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Lepattanó" value={gameComparison.total_rebounds}
          trendValue={`${gameComparison.offensive_rebounds}T · ${gameComparison.defensive_rebounds}V`}
          trend="neutral" accentColor="cyan" animationDelay={0} />
        <StatCard label="Gólpassz" value={gameComparison.assists}
          accentColor="orange" animationDelay={60} />
        <StatCard label="Labdaszerzés" value={gameComparison.steals}
          accentColor="green" animationDelay={120} />
        <StatCard label="Blokkolt dobás" value={gameComparison.blocks}
          accentColor="purple" animationDelay={180} />
        <StatCard label="Labdavesztés" value={gameComparison.turnovers}
          accentColor="orange" animationDelay={240} />
        <StatCard label="Szabálytalanság" value={gameComparison.fouls_committed}
          accentColor="orange" animationDelay={300} />
        <StatCard label="Értékelés (VAL)" value={gameComparison.valuation}
          accentColor="cyan" animationDelay={360} />
      </div>

      {/* Játékos statisztikák – DataTable */}
      <Card className="shadow-panel">
        <CardHeader>
          <CardTitle className="text-base sm:text-lg font-display uppercase tracking-wide">
            Játékos Teljesítmények
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 pb-1">
          <DataTable<PlayerGameStat>
            columns={PLAYER_STATS_COLUMNS}
            rows={playerStats}
            initialSort={{ key: 'points', dir: 'desc' }}
            getRowId={(r) => r.player_id}
          />
          <p className="text-xs text-muted px-4 py-2">
            LP = Lepattanó · GP = Gólpassz · LS = Labdaszerzés · BD = Blokkolt dobás · LV = Labdavesztés · SZ = Szabálytalanság · ± = Plusz-mínusz · ÉRT = Értékelés
          </p>
        </CardContent>
      </Card>

      {/* Játékos AI értékelések */}
      <Card className="shadow-panel">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-display uppercase tracking-wide">
              Játékos Értékelések
            </CardTitle>
            <Button
              onClick={generatePlayerTexts}
              disabled={generatingPlayerTexts || playerStats.length === 0}
              size="sm"
              className="bg-ai text-white hover:opacity-90"
            >
              {generatingPlayerTexts ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" strokeWidth={1.6} />
              )}
              {generatingPlayerTexts
                ? 'Generálás...'
                : Object.keys(playerTexts).length > 0
                  ? 'Újragenerálás'
                  : 'AI Értékelések'}
            </Button>
          </div>
        </CardHeader>
        {playerBreakdowns.length > 0 && (
          <CardContent className="space-y-4">
            {playerBreakdowns.map(breakdown => (
              <div key={breakdown.playerId} className="ai-marker border border-border-subtle rounded-lg p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-primary">{breakdown.name}</span>
                  <span className={impactBadgeClass(breakdown.impactClass)}>
                    {breakdown.impactLabel}
                  </span>
                  <span className="text-xs text-muted ml-auto hidden sm:block">{breakdown.summaryLine}</span>
                </div>
                <div className="text-xs text-muted sm:hidden">{breakdown.summaryLine}</div>
                {playerTexts[breakdown.playerId] ? (
                  <p className="text-sm text-secondary leading-relaxed whitespace-pre-wrap">
                    {playerTexts[breakdown.playerId]}
                  </p>
                ) : generatingPlayerTexts ? (
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Értékelés generálása...
                  </div>
                ) : null}
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      <GamePbpCharts
        quarterStats={quarterStats}
        playerStats={playerStats}
        ourSide={ourSide}
        teamShortName={gameComparison.team_short_name}
        opponent={gameComparison.opponent}
      />

      {/* Manuális elemzés beillesztése */}
      <Card className="shadow-panel">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4 text-cyan" strokeWidth={1.6} />
            Manuális elemzés beillesztése
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-secondary">
            Exportáld a statokat MD-be, add át Claude-nak, majd illeszd be az elemzés szövegét és mentsd el.
          </p>
          <Textarea
            placeholder="Illeszd be a Claude-elemzés szövegét..."
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            className="min-h-25"
          />
          <Button
            onClick={saveManualReport}
            disabled={!manualText.trim() || savingManual}
            size="sm"
          >
            {savingManual ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" strokeWidth={1.6} />
            )}
            {savingManual ? 'Mentés...' : 'Mentés'}
          </Button>
        </CardContent>
      </Card>

      {/* AI szöveges riportok */}
      {textReports.length > 0 && (
        <div className="space-y-4">
          {textReports.map((report) => {
            const typeLabel =
              report.report_type === 'pregame' ? 'Pregame scouting' :
              report.report_type === 'postgame' ? 'Postgame elemzés' :
              report.report_type === 'manual' ? 'Manuális elemzés' :
              'Összesített riport';
            const generatedAt = new Date(report.generated_at).toLocaleDateString('hu-HU', {
              year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
            });
            return (
              <Card key={report.id} className="shadow-panel ai-marker">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-4 w-4 text-ai" strokeWidth={1.6} />
                    {typeLabel}
                    <span className="ml-auto text-xs text-muted font-normal">{generatedAt}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-secondary whitespace-pre-wrap leading-relaxed">
                    {report.narrative}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
