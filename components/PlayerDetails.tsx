import { useState, useMemo, useCallback, useEffect, type ReactNode } from 'react';
import type { PlayerStats } from '@/lib/dashboard-types';
import { supabase } from '@/lib/supabase';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { PlayerTrends } from "./PlayerTrends";
import { StatInfoTooltip } from "./StatInfoTooltip";
import {
  ArrowLeft,
  User,
  Activity,
  Target,
  Shield,
  TrendingUp,
  TrendingDown,
  Calendar,
  X,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Minus,
  Download,
  Save,
  ClipboardList,
  Loader2,
  FileText,
} from "lucide-react";
import { toast } from 'sonner';
import { playerSeasonToMd } from '@/lib/export-to-md';
import { buildPlayerTrendReport, type PlayerTrend } from '@/lib/player-analysis';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

type PlayerDetailProps = {
  player?: PlayerStats;
  onBack?: () => void;
};

type PlayerTextReport = {
  id: string;
  report_type: string;
  narrative: string;
  generated_at: string;
};

function PlayerDetails( { player, onBack }: PlayerDetailProps) {
  const [lastNGames, setLastNGames] = useState<number | null>(null);
  const [manualText, setManualText] = useState('');
  const [savingManual, setSavingManual] = useState(false);
  const [textReports, setTextReports] = useState<PlayerTextReport[]>([]);

  useEffect(() => {
    if (!player?.id || !player?.seasonId) return;
    supabase
      .from('player_text_reports' as never)
      .select('id, report_type, narrative, generated_at')
      .eq('player_id', player.id)
      .eq('season_id', player.seasonId)
      .order('generated_at', { ascending: false })
      .then(({ data }) => {
        if (data) setTextReports(data as unknown as PlayerTextReport[]);
      });
  }, [player?.id, player?.seasonId]);

  const exportPlayerMd = useCallback(() => {
    if (!player) return;
    const md = playerSeasonToMd(player);
    const filename = `jatekos-${player.name.replace(/\s+/g, '-')}-${player.seasonName ?? 'szezonelemzes'}.md`;
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    navigator.clipboard.writeText(md).catch(() => null);
    toast.success('MD exportálva – vágólapra másolva és letöltve');
  }, [player]);

  const saveManualReport = useCallback(async () => {
    if (!player || !manualText.trim()) return;
    if (!player.seasonId) {
      toast.error('Hiányzó szezon azonosító – nem menthető');
      return;
    }
    setSavingManual(true);
    try {
      const resp = await fetch('/api/save-manual-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportTarget: 'player_season',
          playerId: player.id,
          playerName: player.name,
          seasonId: player.seasonId,
          teamId: player.teamId ?? null,
          narrative: manualText.trim(),
        }),
      });
      const json = (await resp.json()) as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? 'Mentési hiba');
      toast.success('Elemzés elmentve');
      const newReport: PlayerTextReport = {
        id: Date.now().toString(),
        report_type: 'manual',
        narrative: manualText.trim(),
        generated_at: new Date().toISOString(),
      };
      setTextReports(prev => {
        const filtered = prev.filter(r => r.report_type !== 'manual');
        return [newReport, ...filtered];
      });
      setManualText('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Mentési hiba');
    } finally {
      setSavingManual(false);
    }
  }, [player, manualText]);

  // Szűrt meccsek az utolsó N meccs alapján
  const filteredGames = useMemo(() => {
    if (!player) return [];
    
    if (lastNGames === null || lastNGames <= 0) {
      return player.gameHistory; // Összes meccs
    }
    // Az első N meccset vegyük (már dátum szerint csökkenő sorrendben vannak)
    return player.gameHistory.slice(0, lastNGames);
  }, [player, lastNGames]);

  const computedTrend = useMemo<PlayerTrend | null>(() => {
    if (!player || player.gameHistory.length < 5) return null;
    const lastFive = player.gameHistory.slice(0, 5);
    const valValues = lastFive.map(game => game.valuation);
    const valAvg5 = valValues.reduce((sum, v) => sum + v, 0) / valValues.length;
    const valSeasonAvg = player.valuation;
    const valVariance = valValues.reduce((sum, v) => sum + Math.pow(v - valAvg5, 2), 0) / valValues.length;
    const valStd5 = Math.sqrt(valVariance);

    const usageFive = lastFive.map(game => {
      const fga = game.shooting.close.attempted + game.shooting.mid.attempted + game.shooting.three.attempted;
      const fta = game.shooting.freeThrow.attempted;
      return fga + 0.44 * fta + game.turnovers;
    });
    const usageAvg5 = usageFive.reduce((sum, v) => sum + v, 0) / usageFive.length;

    const totalFga = player.shooting.close.attempted + player.shooting.mid.attempted + player.shooting.three.attempted;
    const totalFta = player.shooting.freeThrow.attempted;
    const usageSeasonAvg = player.gamesPlayed > 0
      ? (totalFga + 0.44 * totalFta + player.turnovers) / player.gamesPlayed
      : 0;

    const minutesAvg5 = lastFive.reduce((sum, game) => sum + game.minutes, 0) / lastFive.length;

    const trendLabel = valAvg5 <= valSeasonAvg * 0.8
      ? 'Strongly Declining'
      : valAvg5 <= valSeasonAvg * 0.9
        ? 'Declining'
        : valAvg5 >= valSeasonAvg * 1.1
          ? 'Improving'
          : 'Stable';

    const consistencyLabel = valStd5 <= 2
      ? 'High'
      : valStd5 <= 4
        ? 'Medium'
        : 'Low';

    const roleTrendLabel = usageAvg5 >= usageSeasonAvg * 1.1
      ? 'Expanding'
      : usageAvg5 <= usageSeasonAvg * 0.9
        ? 'Shrinking'
        : 'Stable';

    return {
      name: player.name,
      position: (player.position as PlayerTrend['position']) ?? 'SG',
      roles: player.trend?.roles ?? [],
      VAL_avg_5: valAvg5,
      VAL_season_avg: valSeasonAvg,
      VAL_std_5: valStd5,
      usage_avg_5: usageAvg5,
      usage_season_avg: usageSeasonAvg,
      minutes_avg_5: minutesAvg5,
      trendLabel,
      consistencyLabel,
      roleTrendLabel,
      context: 'player-profile',
    };
  }, [player]);

  const trendReport = useMemo(() => {
    if (!player) return null;
    const sourceTrend = player.trend ?? computedTrend;
    if (!sourceTrend) return null;
    return buildPlayerTrendReport(sourceTrend);
  }, [computedTrend, player]);

  const trendBadgeClasses: Record<string, string> = {
    green: 'badge-positive',
    'light-green': 'badge-positive',
    grey: 'badge-neutral',
    orange: 'badge-warning',
    red: 'badge-negative',
  };

  const trendIconMap: Record<string, ReactNode> = {
    'arrow-up': <ArrowUp size={14} strokeWidth={1.6} />,
    'trending-up': <TrendingUp size={14} strokeWidth={1.6} />,
    minus: <Minus size={14} strokeWidth={1.6} />,
    'arrow-down': <ArrowDown size={14} strokeWidth={1.6} />,
    'alert-triangle': <AlertTriangle size={14} strokeWidth={1.6} />,
  };

  if (!player) {
    return <div className="text-center py-8 text-secondary">Válassz egy játékost a részletek megtekintéséhez</div>;
  }

  // Használjuk a szűrt meccseket a számításokhoz
  const gamesPlayed = filteredGames.length;
  const isFiltered = lastNGames !== null && lastNGames > 0 && lastNGames < player.gameHistory.length;

  // Összesítések a szűrt meccsekből
  const totalPoints = filteredGames.reduce((sum, g) => sum + g.points, 0);
  const totalRebounds = filteredGames.reduce((sum, g) => sum + g.rebounds.total, 0);
  const totalAssists = filteredGames.reduce((sum, g) => sum + g.assists, 0);
  const totalSteals = filteredGames.reduce((sum, g) => sum + g.steals, 0);
  const totalBlocks = filteredGames.reduce((sum, g) => sum + g.blocks, 0);
  const totalTurnovers = filteredGames.reduce((sum, g) => sum + g.turnovers, 0);
  const totalMinutes = filteredGames.reduce((sum, g) => sum + g.minutes, 0);
  const totalValuation = filteredGames.reduce((sum, g) => sum + g.valuation, 0);
  
  // Dobások összesítése
  const totalCloseMade = filteredGames.reduce((sum, g) => sum + g.shooting.close.made, 0);
  const totalCloseAttempted = filteredGames.reduce((sum, g) => sum + g.shooting.close.attempted, 0);
  const totalMidMade = filteredGames.reduce((sum, g) => sum + g.shooting.mid.made, 0);
  const totalMidAttempted = filteredGames.reduce((sum, g) => sum + g.shooting.mid.attempted, 0);
  const totalThreeMade = filteredGames.reduce((sum, g) => sum + g.shooting.three.made, 0);
  const totalThreeAttempted = filteredGames.reduce((sum, g) => sum + g.shooting.three.attempted, 0);
  const totalFTMade = filteredGames.reduce((sum, g) => sum + g.shooting.freeThrow.made, 0);
  const totalFTAttempted = filteredGames.reduce((sum, g) => sum + g.shooting.freeThrow.attempted, 0);

  // Fejlett statisztikák
  const gamesWithORtg = filteredGames.filter(g => g.offensiveRating != null);
  const gamesWithDRtg = filteredGames.filter(g => g.defensiveRating != null);
  const avgORtg = gamesWithORtg.length > 0
    ? gamesWithORtg.reduce((sum, g) => sum + (g.offensiveRating || 0), 0) / gamesWithORtg.length
    : 0;
  const avgDRtg = gamesWithDRtg.length > 0
    ? gamesWithDRtg.reduce((sum, g) => sum + (g.defensiveRating || 0), 0) / gamesWithDRtg.length
    : 0;
  
  // TS% és eFG% számítása a szűrt adatokból
  const totalFGMade = totalCloseMade + totalMidMade + totalThreeMade;
  const totalFGAttempted = totalCloseAttempted + totalMidAttempted + totalThreeAttempted;
  const tsAttempts = totalFGAttempted + (0.44 * totalFTAttempted);
  const trueShootingPct = tsAttempts > 0 ? ((totalPoints / (2 * tsAttempts)) * 100) : 0;
  const effectiveFGPct = totalFGAttempted > 0 
    ? ((totalFGMade + (0.5 * totalThreeMade)) / totalFGAttempted) * 100 
    : 0;

  // Pozíció megjelenítése emberi formában
  const getPositionLabel = (position: string): string => {
    const positionLabels: { [key: string]: string } = {
      '1': '1 (Irányító)',
      '2': '2 (Dobóhátvéd)',
      '3': '3 (Bedobó)',
      '4': '4 (Erőcsatár)',
      '5': '5 (Center)'
    };
    
    // Ha egyszerű szám (pl. "1", "2")
    if (position.length === 1 && positionLabels[position]) {
      return positionLabels[position];
    }
    
    // Ha összetett (pl. "1-2", "3-4")
    const parts = position.split('-');
    if (parts.length === 2 && positionLabels[parts[0]] && positionLabels[parts[1]]) {
      return `${positionLabels[parts[0]].split(' ')[0]}-${positionLabels[parts[1]].split(' ')[0]}`;
    }
    
    // Egyéb esetben visszaadjuk az eredetit
    return position;
  };

  const clearFilters = () => {
    setLastNGames(null);
  };

  const setQuickFilter = (n: number) => {
    setLastNGames(n);
  };

  const avgPoints = gamesPlayed > 0 ? (totalPoints / gamesPlayed).toFixed(1) : '0.0';
  const avgRebounds = gamesPlayed > 0 ? (totalRebounds / gamesPlayed).toFixed(1) : '0.0';
  const avgAssists = gamesPlayed > 0 ? (totalAssists / gamesPlayed).toFixed(1) : '0.0';
  const avgMinutes = gamesPlayed > 0 ? (totalMinutes / gamesPlayed).toFixed(1) : '0.0';
  const avgValuation = gamesPlayed > 0 ? (totalValuation / gamesPlayed).toFixed(1) : '0.0';
  
  // Dobási százalékok
  const closeFGPct = totalCloseAttempted > 0 
    ? ((totalCloseMade / totalCloseAttempted) * 100).toFixed(1) 
    : '0.0';
  const midFGPct = totalMidAttempted > 0 
    ? ((totalMidMade / totalMidAttempted) * 100).toFixed(1) 
    : '0.0';
  const threePct = totalThreeAttempted > 0 
    ? ((totalThreeMade / totalThreeAttempted) * 100).toFixed(1) 
    : '0.0';
  const ftPct = totalFTAttempted > 0 
    ? ((totalFTMade / totalFTAttempted) * 100).toFixed(1) 
    : '0.0';

  // Radar chart adatok
  const avgBlocks = gamesPlayed > 0 ? (totalBlocks / gamesPlayed).toFixed(1) : '0.0';
  const avgSteals = gamesPlayed > 0 ? (totalSteals / gamesPlayed).toFixed(1) : '0.0';
  
  const radarData = [
    { stat: 'Pontok', value: parseFloat(avgPoints) * 5, fullMark: 100 },
    { stat: 'Lepattanók', value: parseFloat(avgRebounds) * 10, fullMark: 100 },
    { stat: 'Gólpasszok', value: parseFloat(avgAssists) * 12, fullMark: 100 },
    { stat: 'Labdaszerzés', value: parseFloat(avgSteals) * 20, fullMark: 100 },
    { stat: 'Blokkok', value: parseFloat(avgBlocks) * 25, fullMark: 100 },
    { stat: 'VAL', value: parseFloat(avgValuation) > 30 ? 100 : (parseFloat(avgValuation) / 30) * 100, fullMark: 100 },
  ];

  // Dobási grafikonok
  const shootingData = [
    { category: 'Közeli', made: totalCloseMade, attempted: totalCloseAttempted, pct: parseFloat(closeFGPct) },
    { category: 'Középtávoli', made: totalMidMade, attempted: totalMidAttempted, pct: parseFloat(midFGPct) },
    { category: 'Hármas', made: totalThreeMade, attempted: totalThreeAttempted, pct: parseFloat(threePct) },
    { category: 'Büntetők', made: totalFTMade, attempted: totalFTAttempted, pct: parseFloat(ftPct) },
  ];
  return (
    <div>
        <div className="flex items-center justify-between gap-2 mb-4 sm:mb-6">
          <Button onClick={onBack} variant="ghost" className="text-secondary hover:bg-surface-2 text-sm sm:text-base">
            <ArrowLeft size={18} className="mr-2" strokeWidth={1.6} />
            Vissza a játékosokhoz
          </Button>
          <Button onClick={exportPlayerMd} variant="outline" size="sm" className="text-cyan shrink-0">
            <Download className="w-4 h-4 mr-2" strokeWidth={1.6} />
            Export MD
          </Button>
        </div>

      {/* Utolsó N meccs szűrő */}
      <Card className="mb-4 sm:mb-6">
        <CardHeader className="p-4 sm:p-6 pb-3">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Calendar size={20} strokeWidth={1.6} />
            Mérkőzés szűrés
            {isFiltered && (
              <Badge className="badge-positive text-xs">
                Utolsó {lastNGames} meccs
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => setQuickFilter(5)}
                variant={lastNGames === 5 ? "default" : "outline"}
                size="sm"
                className={lastNGames !== 5 ? "border-border-subtle hover:bg-surface-2 text-secondary" : ""}
              >
                Utolsó 5
              </Button>
              <Button
                onClick={() => setQuickFilter(10)}
                variant={lastNGames === 10 ? "default" : "outline"}
                size="sm"
                className={lastNGames !== 10 ? "border-border-subtle hover:bg-surface-2 text-secondary" : ""}
              >
                Utolsó 10
              </Button>
              <Button
                onClick={() => setQuickFilter(15)}
                variant={lastNGames === 15 ? "default" : "outline"}
                size="sm"
                className={lastNGames !== 15 ? "border-border-subtle hover:bg-surface-2 text-secondary" : ""}
              >
                Utolsó 15
              </Button>
              {isFiltered && (
                <Button
                  onClick={clearFilters}
                  variant="outline"
                  size="sm"
                  className="border-border-subtle hover:bg-surface-2 text-secondary"
                >
                  <X size={16} className="mr-1" strokeWidth={1.6} />
                  Összes meccs
                </Button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Label htmlFor="customGames" className="text-secondary text-sm whitespace-nowrap">
                Egyéni:
              </Label>
              <Input
                id="customGames"
                type="number"
                min="1"
                max={player.gamesPlayed}
                value={lastNGames || ''}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val) && val > 0) {
                    setLastNGames(val);
                  } else if (e.target.value === '') {
                    setLastNGames(null);
                  }
                }}
                placeholder={`1-${player.gamesPlayed}`}
                className="w-24"
              />
              <span className="text-muted text-sm">meccs</span>
            </div>

            {isFiltered && (
              <p className="text-secondary text-sm">
                {gamesPlayed === lastNGames
                  ? `Utolsó ${lastNGames} meccs statisztikái`
                  : `Csak ${gamesPlayed} meccs érhető el (kértél ${lastNGames}-t)`
                }
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Játékos fejléc */}
      <Card className="mb-4 sm:mb-6 shadow-panel">
        <CardHeader className="p-4 sm:p-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-linear-to-br from-cyan/20 to-ai/20 flex items-center justify-center ring-4 ring-cyan/10 shrink-0">
              <User className="text-cyan" size={32} strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                <CardTitle className="text-xl sm:text-2xl truncate">{player.name}</CardTitle>
                <Badge className="badge-positive text-sm sm:text-lg w-fit">
                  #{player.number}
                </Badge>
              </div>
              <p className="text-secondary text-sm sm:text-base">{getPositionLabel(player.position)}</p>
              {player.birthYear && (
                <div className="flex flex-wrap gap-2 sm:gap-3 mt-2 text-xs sm:text-sm text-muted">
                  <span>{2025 - player.birthYear} éves ({player.birthYear})</span>
                  {player.height && <span>{player.height} cm</span>}
                  {player.weight && <span>{player.weight} kg</span>}
                </div>
              )}
            </div>
            <div className="text-right shrink-0">
              <div className="text-muted text-xs sm:text-sm">
                {isFiltered ? 'Átlag perc (szűrt)' : 'Átlagolt perc'}
              </div>
              <div className="text-primary font-mono tabular-nums text-xl sm:text-2xl">{avgMinutes}</div>
              {isFiltered && (
                <div className="text-muted text-xs mt-1">
                  Szezon: {(player.minutes / player.gamesPlayed).toFixed(1)}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
            <div className="text-center p-2 sm:p-4 bg-surface-2 rounded-lg border border-border-subtle">
              <StatInfoTooltip stat="points">
                <div className="text-muted text-xs sm:text-sm mb-1">Pontok/Meccs</div>
              </StatInfoTooltip>
              <div className="text-positive font-mono tabular-nums text-lg sm:text-2xl">{avgPoints}</div>
              {isFiltered && (
                <div className="text-muted text-xs mt-1">
                  Szezon: {(player.points / player.gamesPlayed).toFixed(1)}
                </div>
              )}
            </div>
            <div className="text-center p-2 sm:p-4 bg-surface-2 rounded-lg border border-border-subtle">
              <StatInfoTooltip stat="rebounds">
                <div className="text-muted text-xs sm:text-sm mb-1">Lepattanók/Meccs</div>
              </StatInfoTooltip>
              <div className="text-cyan font-mono tabular-nums text-lg sm:text-2xl">{avgRebounds}</div>
              {isFiltered && (
                <div className="text-muted text-xs mt-1">
                  Szezon: {(player.rebounds.total / player.gamesPlayed).toFixed(1)}
                </div>
              )}
            </div>
            <div className="text-center p-2 sm:p-4 bg-surface-2 rounded-lg border border-border-subtle">
              <StatInfoTooltip stat="assists">
                <div className="text-muted text-xs sm:text-sm mb-1">Gólpasszok/Meccs</div>
              </StatInfoTooltip>
              <div className="text-ai font-mono tabular-nums text-lg sm:text-2xl">{avgAssists}</div>
              {isFiltered && (
                <div className="text-muted text-xs mt-1">
                  Szezon: {(player.assists / player.gamesPlayed).toFixed(1)}
                </div>
              )}
            </div>
            <div className="text-center p-2 sm:p-4 bg-surface-2 rounded-lg border border-border-subtle">
              <StatInfoTooltip stat="steals">
                <div className="text-muted text-xs sm:text-sm mb-1">Labdaszerzés/Meccs</div>
              </StatInfoTooltip>
              <div className="text-orange font-mono tabular-nums text-lg sm:text-2xl">{avgSteals}</div>
              {isFiltered && (
                <div className="text-muted text-xs mt-1">
                  Szezon: {(player.steals / player.gamesPlayed).toFixed(1)}
                </div>
              )}
            </div>
            <div className="text-center p-2 sm:p-4 bg-surface-2 rounded-lg border border-border-subtle">
              <StatInfoTooltip stat="blocks">
                <div className="text-muted text-xs sm:text-sm mb-1">Blokkok/Meccs</div>
              </StatInfoTooltip>
              <div className="text-ai font-mono tabular-nums text-lg sm:text-2xl">{avgBlocks}</div>
              {isFiltered && (
                <div className="text-muted text-xs mt-1">
                  Szezon: {(player.blocks / player.gamesPlayed).toFixed(1)}
                </div>
              )}
            </div>
            <div className="text-center p-2 sm:p-4 bg-surface-2 rounded-lg border border-border-subtle">
              <StatInfoTooltip stat="valuation">
                <div className="text-muted text-xs sm:text-sm mb-1">VAL/Meccs</div>
              </StatInfoTooltip>
              <div className="text-orange font-mono tabular-nums text-lg sm:text-2xl">{avgValuation}</div>
              {isFiltered && (
                <div className="text-muted text-xs mt-1">
                  Szezon: {player.valuation.toFixed(1)}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mentett / AI szöveges riportok */}
      {textReports.length > 0 && (
        <div className="space-y-4">
          {textReports.map((report) => {
            const typeLabel =
              report.report_type === 'season' ? 'Szezonértékelés (AI)' :
              report.report_type === 'manual' ? 'Manuális értékelés' :
              'Riport';
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

      {/* Manuális szezonértékelés beillesztése */}
      <Card className="shadow-panel">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4 text-cyan" strokeWidth={1.6} />
            Manuális szezonértékelés beillesztése
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-secondary">
            Exportáld a statokat MD-be, add át Claude-nak, majd illeszd be az elemzés szövegét és mentsd el.
          </p>
          <Textarea
            placeholder="Illeszd be a Claude-szezonértékelés szövegét..."
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
        {/* Fejlett statisztikák (szezon átlagok) */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Activity className="text-positive shrink-0" size={18} strokeWidth={1.6} />
              Fejlett Statisztikák {isFiltered ? '(Szűrt időszak)' : '(Szezon átlag)'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6">
            <div className="flex items-center justify-between p-2 sm:p-3 bg-surface-2 rounded-lg border border-border-subtle">
              <div className="flex items-center gap-2">
                <Target className="text-positive shrink-0" size={16} strokeWidth={1.6} />
                <StatInfoTooltip stat="ortg">
                  <span className="text-secondary text-xs sm:text-sm">Offensive Rating</span>
                </StatInfoTooltip>
              </div>
              <div className="text-right">
                <span className="text-positive font-mono tabular-nums sm:text-lg">{avgORtg.toFixed(1)}</span>
                {isFiltered && (
                  <div className="text-muted text-xs mt-1">
                    Szezon: {player.offensiveRating.toFixed(1)}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between p-2 sm:p-3 bg-surface-2 rounded-lg border border-border-subtle">
              <div className="flex items-center gap-2">
                <Shield className="text-cyan shrink-0" size={16} strokeWidth={1.6} />
                <StatInfoTooltip stat="drtg">
                  <span className="text-secondary text-xs sm:text-sm">Defensive Rating</span>
                </StatInfoTooltip>
              </div>
              <div className="text-right">
                <span className="text-cyan font-mono tabular-nums sm:text-lg">{avgDRtg.toFixed(1)}</span>
                {isFiltered && (
                  <div className="text-muted text-xs mt-1">
                    Szezon: {player.defensiveRating.toFixed(1)}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between p-2 sm:p-3 bg-surface-2 rounded-lg border border-border-subtle">
              <div className="flex items-center gap-2">
                <TrendingUp className="text-ai shrink-0" size={16} strokeWidth={1.6} />
                <StatInfoTooltip stat="ts">
                  <span className="text-secondary text-xs sm:text-sm">True Shooting %</span>
                </StatInfoTooltip>
              </div>
              <div className="text-right">
                <span className="text-ai font-mono tabular-nums sm:text-lg">{trueShootingPct.toFixed(1)}%</span>
                {isFiltered && (
                  <div className="text-muted text-xs mt-1">
                    Szezon: {player.trueShootingPct.toFixed(1)}%
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between p-2 sm:p-3 bg-surface-2 rounded-lg border border-border-subtle">
              <div className="flex items-center gap-2">
                <TrendingDown className="text-orange shrink-0" size={16} strokeWidth={1.6} />
                <StatInfoTooltip stat="efg">
                  <span className="text-secondary text-xs sm:text-sm">Effective FG %</span>
                </StatInfoTooltip>
              </div>
              <div className="text-right">
                <span className="text-orange font-mono tabular-nums sm:text-lg">{effectiveFGPct.toFixed(1)}%</span>
                {isFiltered && (
                  <div className="text-muted text-xs mt-1">
                    Szezon: {player.effectiveShootingPct.toFixed(1)}%
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Játékos profil radar */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Játékos Profil</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--border-subtle)" />
                <PolarAngleAxis dataKey="stat" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: 'var(--text-muted)' }} />
                <Radar name="Játékos" dataKey="value" stroke="var(--accent-cyan)" fill="var(--accent-cyan)" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Dobási statisztikák */}
      <Card className="mb-4 sm:mb-6">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">Dobási Statisztikák</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="text-center p-3 sm:p-4 bg-surface-2 rounded-lg border border-border-subtle">
              <div className="text-muted text-xs sm:text-sm mb-1 sm:mb-2">Közeli dobás</div>
              <div className="text-positive font-mono tabular-nums text-lg sm:text-2xl mb-1">{closeFGPct}%</div>
              <div className="text-muted text-xs">
                {player.shooting?.close.made}/{player.shooting?.close.attempted}
              </div>
            </div>
            <div className="text-center p-3 sm:p-4 bg-surface-2 rounded-lg border border-border-subtle">
              <div className="text-muted text-xs sm:text-sm mb-1 sm:mb-2">Középtávoli</div>
              <div className="text-cyan font-mono tabular-nums text-lg sm:text-2xl mb-1">{midFGPct}%</div>
              <div className="text-muted text-xs">
                {player.shooting?.mid.made}/{player.shooting?.mid.attempted}
              </div>
            </div>
            <div className="text-center p-3 sm:p-4 bg-surface-2 rounded-lg border border-border-subtle">
              <div className="text-muted text-xs sm:text-sm mb-1 sm:mb-2">Hármasok</div>
              <div className="text-ai font-mono tabular-nums text-lg sm:text-2xl mb-1">{threePct}%</div>
              <div className="text-muted text-xs">
                {player.shooting?.three.made}/{player.shooting?.three.attempted}
              </div>
            </div>
            <div className="text-center p-3 sm:p-4 bg-surface-2 rounded-lg border border-border-subtle">
              <div className="text-muted text-xs sm:text-sm mb-1 sm:mb-2">Büntetők</div>
              <div className="text-orange font-mono tabular-nums text-lg sm:text-2xl mb-1">{ftPct}%</div>
              <div className="text-muted text-xs">
                {player.shooting?.freeThrow.made}/{player.shooting?.freeThrow.attempted}
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={shootingData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis dataKey="category" stroke="var(--text-secondary)" tick={{ fontSize: 10 }} />
              <YAxis stroke="var(--text-secondary)" tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--bg-surface-2)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                }}
                labelStyle={{ color: 'var(--text-primary)', fontWeight: 'bold' }}
                itemStyle={{ color: 'var(--text-primary)' }}
              />
              <Legend wrapperStyle={{ color: 'var(--text-secondary)' }} />
              <Bar dataKey="pct" fill="var(--accent-cyan)" name="Százalék %" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Egyéb statisztikák */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">További Statisztikák</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-3 sm:p-4 bg-surface-2 rounded-lg border border-border-subtle">
              <div className="text-muted text-xs sm:text-sm mb-1">Támadó lepattanó</div>
              <div className="text-primary font-mono tabular-nums text-lg sm:text-xl">{player.rebounds.offensive}</div>
            </div>
            <div className="p-3 sm:p-4 bg-surface-2 rounded-lg border border-border-subtle">
              <div className="text-muted text-xs sm:text-sm mb-1">Védekező lepattanó</div>
              <div className="text-primary font-mono tabular-nums text-lg sm:text-xl">{player.rebounds.defensive}</div>
            </div>
            <div className="p-3 sm:p-4 bg-surface-2 rounded-lg border border-border-subtle">
              <div className="text-muted text-xs sm:text-sm mb-1">Labdaeladás</div>
              <div className="text-primary font-mono tabular-nums text-lg sm:text-xl">{player.turnovers}</div>
            </div>
            <div className="p-3 sm:p-4 bg-surface-2 rounded-lg border border-border-subtle">
              <div className="text-muted text-xs sm:text-sm mb-1">Blokkok</div>
              <div className="text-primary font-mono tabular-nums text-lg sm:text-xl">{player.blocks}</div>
            </div>
            <div className="p-3 sm:p-4 bg-surface-2 rounded-lg border border-border-subtle">
              <div className="text-muted text-xs sm:text-sm mb-1">Elkövetett faultok</div>
              <div className="text-primary font-mono tabular-nums text-lg sm:text-xl">{player.foulsCommitted}</div>
            </div>
            <div className="p-3 sm:p-4 bg-surface-2 rounded-lg border border-border-subtle">
              <div className="text-muted text-xs sm:text-sm mb-1">Kapott faultok</div>
              <div className="text-primary font-mono tabular-nums text-lg sm:text-xl">{player.foulsDrawn}</div>
            </div>
            <div className="p-3 sm:p-4 bg-surface-2 rounded-lg border border-border-subtle">
              <div className="text-muted text-xs sm:text-sm mb-1">Assist/TO arány</div>
              <div className="text-primary font-mono tabular-nums text-lg sm:text-xl">
                {player.turnovers > 0 ? (player.assists / player.turnovers).toFixed(2) : player.assists.toFixed(1)}
              </div>
            </div>
            <div className="p-3 sm:p-4 bg-surface-2 rounded-lg border border-border-subtle">
              <div className="text-muted text-xs sm:text-sm mb-1">Meccsek</div>
              <div className="text-primary font-mono tabular-nums text-lg sm:text-xl">{player.gamesPlayed}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Meccsenkénti statisztikák */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">Meccsenkénti Statisztikák</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="text-left py-2 sm:py-3 text-secondary font-medium sticky left-0 bg-surface-1 z-10">Dátum</th>
                  <th className="text-left py-2 sm:py-3 text-secondary font-medium">Ellenfél</th>
                  <th className="text-center py-2 sm:py-3 text-secondary font-medium">Perc</th>
                  <th className="text-center py-2 sm:py-3 text-secondary font-medium">Pont</th>
                  <th className="text-center py-2 sm:py-3 text-secondary font-medium hidden sm:table-cell">2P</th>
                  <th className="text-center py-2 sm:py-3 text-secondary font-medium hidden sm:table-cell">3P</th>
                  <th className="text-center py-2 sm:py-3 text-secondary font-medium hidden sm:table-cell">FT</th>
                  <th className="text-center py-2 sm:py-3 text-secondary font-medium">Lep</th>
                  <th className="text-center py-2 sm:py-3 text-secondary font-medium">Góp</th>
                  <th className="text-center py-2 sm:py-3 text-secondary font-medium hidden md:table-cell">Lab</th>
                  <th className="text-center py-2 sm:py-3 text-secondary font-medium hidden md:table-cell">Blk</th>
                  <th className="text-center py-2 sm:py-3 text-secondary font-medium hidden md:table-cell">TO</th>
                  <th className="text-center py-2 sm:py-3 text-secondary font-medium">VAL</th>
                  <th className="text-center py-2 sm:py-3 text-secondary font-medium hidden lg:table-cell">ORtg</th>
                  <th className="text-center py-2 sm:py-3 text-secondary font-medium hidden lg:table-cell">DRtg</th>
                  <th className="text-center py-2 sm:py-3 text-secondary font-medium hidden xl:table-cell">TS%</th>
                  <th className="text-center py-2 sm:py-3 text-secondary font-medium hidden xl:table-cell">eFG%</th>
                </tr>
              </thead>
              <tbody className="text-primary">
                {filteredGames.map((game, idx) => {
                  const twoPointMade = game.shooting.close.made + game.shooting.mid.made;
                  const twoPointAttempted = game.shooting.close.attempted + game.shooting.mid.attempted;
                  const date = new Date(game.date).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' });

                  return (
                    <tr key={idx} className="border-b border-border-subtle hover:bg-surface-2/50">
                      <td className="py-2 sm:py-3 text-primary sticky left-0 bg-surface-1">{date}</td>
                      <td className="py-2 sm:py-3 text-primary">{game.opponent}</td>
                      <td className="text-center py-2 sm:py-3 font-mono tabular-nums">{game.minutes}</td>
                      <td className="text-center py-2 sm:py-3 font-semibold font-mono tabular-nums text-positive">{game.points}</td>
                      <td className="text-center py-2 sm:py-3 font-mono tabular-nums hidden sm:table-cell">
                        {twoPointMade}/{twoPointAttempted}
                      </td>
                      <td className="text-center py-2 sm:py-3 font-mono tabular-nums hidden sm:table-cell">
                        {game.shooting.three.made}/{game.shooting.three.attempted}
                      </td>
                      <td className="text-center py-2 sm:py-3 font-mono tabular-nums hidden sm:table-cell">
                        {game.shooting.freeThrow.made}/{game.shooting.freeThrow.attempted}
                      </td>
                      <td className="text-center py-2 sm:py-3 font-mono tabular-nums">{game.rebounds.total}</td>
                      <td className="text-center py-2 sm:py-3 font-mono tabular-nums">{game.assists}</td>
                      <td className="text-center py-2 sm:py-3 font-mono tabular-nums hidden md:table-cell">{game.steals}</td>
                      <td className="text-center py-2 sm:py-3 font-mono tabular-nums hidden md:table-cell">{game.blocks}</td>
                      <td className="text-center py-2 sm:py-3 font-mono tabular-nums hidden md:table-cell text-negative">{game.turnovers}</td>
                      <td className="text-center py-2 sm:py-3 font-semibold font-mono tabular-nums text-cyan">{game.valuation}</td>
                      <td className="text-center py-2 sm:py-3 font-mono tabular-nums hidden lg:table-cell text-positive">
                        {game.offensiveRating ? game.offensiveRating.toFixed(1) : '-'}
                      </td>
                      <td className="text-center py-2 sm:py-3 font-mono tabular-nums hidden lg:table-cell text-cyan">
                        {game.defensiveRating ? game.defensiveRating.toFixed(1) : '-'}
                      </td>
                      <td className="text-center py-2 sm:py-3 font-mono tabular-nums hidden xl:table-cell text-ai">
                        {game.trueShootingPct ? game.trueShootingPct.toFixed(1) + '%' : '-'}
                      </td>
                      <td className="text-center py-2 sm:py-3 font-mono tabular-nums hidden xl:table-cell text-orange">
                        {game.effectiveShootingPct ? game.effectiveShootingPct.toFixed(1) + '%' : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                {(() => {
                  const footerGamesWithORtg = filteredGames.filter(g => g.offensiveRating != null);
                  const footerGamesWithDRtg = filteredGames.filter(g => g.defensiveRating != null);

                  const footerAvgORtg = footerGamesWithORtg.length > 0
                    ? footerGamesWithORtg.reduce((sum, g) => sum + (g.offensiveRating || 0), 0) / footerGamesWithORtg.length
                    : 0;

                  const footerAvgDRtg = footerGamesWithDRtg.length > 0
                    ? footerGamesWithDRtg.reduce((sum, g) => sum + (g.defensiveRating || 0), 0) / footerGamesWithDRtg.length
                    : 0;

                  const avgVAL = gamesPlayed > 0 ? totalValuation / gamesPlayed : 0;

                  return (
                    <tr className="border-t-2 border-border-active font-semibold">
                      <td className="py-3 text-secondary sticky left-0 bg-surface-1" colSpan={2}>
                        <div>{isFiltered ? 'Szűrt időszak' : 'Összesen'} ({gamesPlayed} meccs)</div>
                        <div className="text-xs font-normal text-muted mt-1">{isFiltered ? 'Szűrt ' : 'Szezon '}átlag ↓</div>
                      </td>
                      <td className="text-center py-3 font-mono tabular-nums text-primary">{totalMinutes}</td>
                      <td className="text-center py-3 font-mono tabular-nums text-positive">{totalPoints}</td>
                      <td className="text-center py-3 font-mono tabular-nums text-primary hidden sm:table-cell">
                        {totalCloseMade + totalMidMade}/
                        {totalCloseAttempted + totalMidAttempted}
                      </td>
                      <td className="text-center py-3 font-mono tabular-nums text-primary hidden sm:table-cell">
                        {totalThreeMade}/{totalThreeAttempted}
                      </td>
                      <td className="text-center py-3 font-mono tabular-nums text-primary hidden sm:table-cell">
                        {totalFTMade}/{totalFTAttempted}
                      </td>
                      <td className="text-center py-3 font-mono tabular-nums text-primary">{totalRebounds}</td>
                      <td className="text-center py-3 font-mono tabular-nums text-primary">{totalAssists}</td>
                      <td className="text-center py-3 font-mono tabular-nums text-primary hidden md:table-cell">{totalSteals}</td>
                      <td className="text-center py-3 font-mono tabular-nums text-primary hidden md:table-cell">{totalBlocks}</td>
                      <td className="text-center py-3 font-mono tabular-nums text-negative hidden md:table-cell">{totalTurnovers}</td>
                      <td className="text-center py-3 font-mono tabular-nums text-cyan">
                        <div>{avgVAL.toFixed(1)}</div>
                        <div className="text-xs font-normal text-muted">átlag</div>
                      </td>
                      <td className="text-center py-3 font-mono tabular-nums text-positive hidden lg:table-cell">
                        <div>{footerAvgORtg.toFixed(1)}</div>
                        <div className="text-xs font-normal text-muted">átlag</div>
                      </td>
                      <td className="text-center py-3 font-mono tabular-nums text-cyan hidden lg:table-cell">
                        <div>{footerAvgDRtg.toFixed(1)}</div>
                        <div className="text-xs font-normal text-muted">átlag</div>
                      </td>
                      <td className="text-center py-3 font-mono tabular-nums text-ai hidden xl:table-cell">
                        <div>{trueShootingPct.toFixed(1)}%</div>
                        <div className="text-xs font-normal text-muted">átlag</div>
                      </td>
                      <td className="text-center py-3 font-mono tabular-nums text-orange hidden xl:table-cell">
                        <div>{effectiveFGPct.toFixed(1)}%</div>
                        <div className="text-xs font-normal text-muted">átlag</div>
                      </td>
                    </tr>
                  );
                })()}
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Teljesítmény trendek */}
      <PlayerTrends gameHistory={player.gameHistory} />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Utolsó 5 meccs trendje</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-primary">
          {trendReport ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={trendBadgeClasses[trendReport.badge.color] ?? 'badge-neutral'}>
                  <span className="mr-1">{trendIconMap[trendReport.badge.icon] ?? <Minus size={14} strokeWidth={1.6} />}</span>
                  {trendReport.badge.label}
                </Badge>
                <span className="text-xs text-secondary">Súlyosság: {trendReport.badge.severity}</span>
              </div>
              <div>{trendReport.summary}</div>
              <div>{trendReport.stability}</div>
              <div>{trendReport.roleTrend}</div>
              <div>{trendReport.roleContext}</div>
              <div className="text-secondary">{trendReport.takeaway}</div>
            </>
          ) : (
            <div className="text-secondary">Nincs elérhető trend riport.</div>
          )}
        </CardContent>
      </Card>

    </div>
  )
}

export { PlayerDetails }
