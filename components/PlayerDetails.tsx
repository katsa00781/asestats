import { useState, useMemo, type ReactNode } from 'react';
import type { PlayerStats } from '@/lib/dashboard-types';

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
  Minus
} from "lucide-react";
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

function PlayerDetails( { player, onBack }: PlayerDetailProps) {
  const [lastNGames, setLastNGames] = useState<number | null>(null);

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
    green: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    'light-green': 'bg-emerald-400/15 text-emerald-200 border-emerald-400/30',
    grey: 'bg-slate-700/40 text-slate-200 border-slate-600/40',
    orange: 'bg-orange-500/20 text-orange-200 border-orange-500/40',
    red: 'bg-red-500/20 text-red-200 border-red-500/40',
  };

  const trendIconMap: Record<string, ReactNode> = {
    'arrow-up': <ArrowUp size={14} />,
    'trending-up': <TrendingUp size={14} />,
    minus: <Minus size={14} />,
    'arrow-down': <ArrowDown size={14} />,
    'alert-triangle': <AlertTriangle size={14} />,
  };

  if (!player) {
    return <div className="text-center py-8 text-slate-400">Válassz egy játékost a részletek megtekintéséhez</div>;
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
        <Button onClick={onBack} variant={"ghost"} className="mb-4 sm:mb-6 text-slate-400 hover:bg-slate-800 text-sm sm:text-base">
            <ArrowLeft size={18} className="mr-2" />
            Vissza a játékosokhoz
        </Button>

      {/* Utolsó N meccs szűrő */}
      <Card className="mb-4 sm:mb-6 bg-slate-900 border-slate-800">
        <CardHeader className="p-4 sm:p-6 pb-3">
          <CardTitle className="text-slate-50 flex items-center gap-2 text-base sm:text-lg">
            <Calendar size={20} />
            Mérkőzés szűrés
            {isFiltered && (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50 text-xs">
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
                className={lastNGames === 5 
                  ? "bg-emerald-600 hover:bg-emerald-700" 
                  : "border-slate-700 hover:bg-slate-800 text-slate-300"
                }
              >
                Utolsó 5
              </Button>
              <Button
                onClick={() => setQuickFilter(10)}
                variant={lastNGames === 10 ? "default" : "outline"}
                size="sm"
                className={lastNGames === 10 
                  ? "bg-emerald-600 hover:bg-emerald-700" 
                  : "border-slate-700 hover:bg-slate-800 text-slate-300"
                }
              >
                Utolsó 10
              </Button>
              <Button
                onClick={() => setQuickFilter(15)}
                variant={lastNGames === 15 ? "default" : "outline"}
                size="sm"
                className={lastNGames === 15 
                  ? "bg-emerald-600 hover:bg-emerald-700" 
                  : "border-slate-700 hover:bg-slate-800 text-slate-300"
                }
              >
                Utolsó 15
              </Button>
              {isFiltered && (
                <Button
                  onClick={clearFilters}
                  variant="outline"
                  size="sm"
                  className="border-slate-700 hover:bg-slate-800 text-slate-300"
                >
                  <X size={16} className="mr-1" />
                  Összes meccs
                </Button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Label htmlFor="customGames" className="text-slate-300 text-sm whitespace-nowrap">
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
                className="bg-slate-800 border-slate-700 text-slate-100 w-24"
              />
              <span className="text-slate-500 text-sm">meccs</span>
            </div>

            {isFiltered && (
              <p className="text-slate-400 text-sm">
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
      <Card className="mb-4 sm:mb-6 bg-linear-to-br from-slate-900 to-slate-800 border-slate-700">
        <CardHeader className="p-4 sm:p-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-linear-to-br from-emerald-500/30 to-cyan-500/30 flex items-center justify-center ring-4 ring-emerald-500/20 shrink-0">
              <User className="text-emerald-400" size={32} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                <CardTitle className="text-slate-50 text-xl sm:text-2xl truncate">{player.name}</CardTitle>
                <Badge variant="secondary" className="text-sm sm:text-lg bg-emerald-500/20 text-emerald-400 border-emerald-500/50 w-fit">
                  #{player.number}
                </Badge>
              </div>
              <p className="text-slate-400 text-sm sm:text-base">{getPositionLabel(player.position)}</p>
              {player.birthYear && (
                <div className="flex flex-wrap gap-2 sm:gap-3 mt-2 text-xs sm:text-sm text-slate-500">
                  <span>🎂 {2025 - player.birthYear} éves ({player.birthYear})</span>
                  {player.height && <span>📏 {player.height} cm</span>}
                  {player.weight && <span>⚖️ {player.weight} kg</span>}
                </div>
              )}
            </div>
            <div className="text-right shrink-0">
              <div className="text-slate-500 text-xs sm:text-sm">
                {isFiltered ? 'Átlag perc (szűrt)' : 'Átlagolt perc'}
              </div>
              <div className="text-slate-50 text-xl sm:text-2xl">{avgMinutes}</div>
              {isFiltered && (
                <div className="text-slate-600 text-xs mt-1">
                  Szezon: {(player.minutes / player.gamesPlayed).toFixed(1)}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
            <div className="text-center p-2 sm:p-4 bg-slate-800/70 rounded-lg">
              <StatInfoTooltip stat="points">
                <div className="text-slate-500 text-xs sm:text-sm mb-1">Pontok/Meccs</div>
              </StatInfoTooltip>
              <div className="text-emerald-400 text-lg sm:text-2xl">{avgPoints}</div>
              {isFiltered && (
                <div className="text-slate-600 text-xs mt-1">
                  Szezon: {(player.points / player.gamesPlayed).toFixed(1)}
                </div>
              )}
            </div>
            <div className="text-center p-2 sm:p-4 bg-slate-800/70 rounded-lg">
              <StatInfoTooltip stat="rebounds">
                <div className="text-slate-500 text-xs sm:text-sm mb-1">Lepattanók/Meccs</div>
              </StatInfoTooltip>
              <div className="text-cyan-400 text-lg sm:text-2xl">{avgRebounds}</div>
              {isFiltered && (
                <div className="text-slate-600 text-xs mt-1">
                  Szezon: {(player.rebounds.total / player.gamesPlayed).toFixed(1)}
                </div>
              )}
            </div>
            <div className="text-center p-2 sm:p-4 bg-slate-800/70 rounded-lg">
              <StatInfoTooltip stat="assists">
                <div className="text-slate-500 text-xs sm:text-sm mb-1">Gólpasszok/Meccs</div>
              </StatInfoTooltip>
              <div className="text-violet-400 text-lg sm:text-2xl">{avgAssists}</div>
              {isFiltered && (
                <div className="text-slate-600 text-xs mt-1">
                  Szezon: {(player.assists / player.gamesPlayed).toFixed(1)}
                </div>
              )}
            </div>
            <div className="text-center p-2 sm:p-4 bg-slate-800/70 rounded-lg">
              <StatInfoTooltip stat="steals">
                <div className="text-slate-500 text-xs sm:text-sm mb-1">Labdaszerzés/Meccs</div>
              </StatInfoTooltip>
              <div className="text-orange-400 text-lg sm:text-2xl">{avgSteals}</div>
              {isFiltered && (
                <div className="text-slate-600 text-xs mt-1">
                  Szezon: {(player.steals / player.gamesPlayed).toFixed(1)}
                </div>
              )}
            </div>
            <div className="text-center p-2 sm:p-4 bg-slate-800/70 rounded-lg">
              <StatInfoTooltip stat="blocks">
                <div className="text-slate-500 text-xs sm:text-sm mb-1">Blokkok/Meccs</div>
              </StatInfoTooltip>
              <div className="text-purple-400 text-lg sm:text-2xl">{avgBlocks}</div>
              {isFiltered && (
                <div className="text-slate-600 text-xs mt-1">
                  Szezon: {(player.blocks / player.gamesPlayed).toFixed(1)}
                </div>
              )}
            </div>
            <div className="text-center p-2 sm:p-4 bg-slate-800/70 rounded-lg">
              <StatInfoTooltip stat="valuation">
                <div className="text-slate-500 text-xs sm:text-sm mb-1">VAL/Meccs</div>
              </StatInfoTooltip>
              <div className="text-pink-400 text-lg sm:text-2xl">{avgValuation}</div>
              {isFiltered && (
                <div className="text-slate-600 text-xs mt-1">
                  Szezon: {player.valuation.toFixed(1)}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
        {/* Fejlett statisztikák (szezon átlagok) */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-slate-50 text-base sm:text-lg">
              <Activity className="text-emerald-400 shrink-0" size={18} />
              Fejlett Statisztikák {isFiltered ? '(Szűrt időszak)' : '(Szezon átlag)'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6">
            <div className="flex items-center justify-between p-2 sm:p-3 bg-slate-800/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Target className="text-emerald-400 shrink-0" size={16} />
                <StatInfoTooltip stat="ortg">
                  <span className="text-slate-400 text-xs sm:text-sm">Offensive Rating</span>
                </StatInfoTooltip>
              </div>
              <div className="text-right">
                <span className="text-emerald-400 text-base sm:text-lg">{avgORtg.toFixed(1)}</span>
                {isFiltered && (
                  <div className="text-slate-600 text-xs mt-1">
                    Szezon: {player.offensiveRating.toFixed(1)}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between p-2 sm:p-3 bg-slate-800/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Shield className="text-cyan-400 shrink-0" size={16} />
                <StatInfoTooltip stat="drtg">
                  <span className="text-slate-400 text-xs sm:text-sm">Defensive Rating</span>
                </StatInfoTooltip>
              </div>
              <div className="text-right">
                <span className="text-cyan-400 text-base sm:text-lg">{avgDRtg.toFixed(1)}</span>
                {isFiltered && (
                  <div className="text-slate-600 text-xs mt-1">
                    Szezon: {player.defensiveRating.toFixed(1)}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between p-2 sm:p-3 bg-slate-800/50 rounded-lg">
              <div className="flex items-center gap-2">
                <TrendingUp className="text-violet-400 shrink-0" size={16} />
                <StatInfoTooltip stat="ts">
                  <span className="text-slate-400 text-xs sm:text-sm">True Shooting %</span>
                </StatInfoTooltip>
              </div>
              <div className="text-right">
                <span className="text-violet-400 text-base sm:text-lg">{trueShootingPct.toFixed(1)}%</span>
                {isFiltered && (
                  <div className="text-slate-600 text-xs mt-1">
                    Szezon: {player.trueShootingPct.toFixed(1)}%
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between p-2 sm:p-3 bg-slate-800/50 rounded-lg">
              <div className="flex items-center gap-2">
                <TrendingDown className="text-orange-400 shrink-0" size={16} />
                <StatInfoTooltip stat="efg">
                  <span className="text-slate-400 text-xs sm:text-sm">Effective FG %</span>
                </StatInfoTooltip>
              </div>
              <div className="text-right">
                <span className="text-orange-400 text-base sm:text-lg">{effectiveFGPct.toFixed(1)}%</span>
                {isFiltered && (
                  <div className="text-slate-600 text-xs mt-1">
                    Szezon: {player.effectiveShootingPct.toFixed(1)}%
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Játékos profil radar */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-slate-50 text-base sm:text-lg">Játékos Profil</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="stat" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#64748b' }} />
                <Radar name="Játékos" dataKey="value" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Dobási statisztikák */}
      <Card className="mb-4 sm:mb-6 bg-slate-900 border-slate-800">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-slate-50 text-base sm:text-lg">Dobási Statisztikák</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="text-center p-3 sm:p-4 bg-slate-800/50 rounded-lg">
              <div className="text-slate-500 text-xs sm:text-sm mb-1 sm:mb-2">Közeli dobás</div>
              <div className="text-emerald-400 text-lg sm:text-2xl mb-1">{closeFGPct}%</div>
              <div className="text-slate-600 text-xs">
                {player.shooting?.close.made}/{player.shooting?.close.attempted}
              </div>
            </div>
            <div className="text-center p-3 sm:p-4 bg-slate-800/50 rounded-lg">
              <div className="text-slate-500 text-xs sm:text-sm mb-1 sm:mb-2">Középtávoli</div>
              <div className="text-cyan-400 text-lg sm:text-2xl mb-1">{midFGPct}%</div>
              <div className="text-slate-600 text-xs">
                {player.shooting?.mid.made}/{player.shooting?.mid.attempted}
              </div>
            </div>
            <div className="text-center p-3 sm:p-4 bg-slate-800/50 rounded-lg">
              <div className="text-slate-500 text-xs sm:text-sm mb-1 sm:mb-2">Hármasok</div>
              <div className="text-violet-400 text-lg sm:text-2xl mb-1">{threePct}%</div>
              <div className="text-slate-600 text-xs">
                {player.shooting?.three.made}/{player.shooting?.three.attempted}
              </div>
            </div>
            <div className="text-center p-3 sm:p-4 bg-slate-800/50 rounded-lg">
              <div className="text-slate-500 text-xs sm:text-sm mb-1 sm:mb-2">Büntetők</div>
              <div className="text-orange-400 text-lg sm:text-2xl mb-1">{ftPct}%</div>
              <div className="text-slate-600 text-xs">
                {player.shooting?.freeThrow.made}/{player.shooting?.freeThrow.attempted}
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={shootingData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="category" stroke="#94a3b8" tick={{ fontSize: 10 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#0f172a', 
                  border: '1px solid #475569', 
                  borderRadius: '8px',
                  color: '#f1f5f9'
                }}
                labelStyle={{ color: '#f1f5f9', fontWeight: 'bold' }}
                itemStyle={{ color: '#e2e8f0' }}
              />
              <Legend wrapperStyle={{ color: '#94a3b8' }} />
              <Bar dataKey="pct" fill="#10b981" name="Százalék %" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Egyéb statisztikák */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-slate-50 text-base sm:text-lg">További Statisztikák</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-3 sm:p-4 bg-slate-800/50 rounded-lg">
              <div className="text-slate-500 text-xs sm:text-sm mb-1">Támadó lepattanó</div>
              <div className="text-slate-50 text-lg sm:text-xl">{player.rebounds.offensive}</div>
            </div>
            <div className="p-3 sm:p-4 bg-slate-800/50 rounded-lg">
              <div className="text-slate-500 text-xs sm:text-sm mb-1">Védekező lepattanó</div>
              <div className="text-slate-50 text-lg sm:text-xl">{player.rebounds.defensive}</div>
            </div>
            <div className="p-3 sm:p-4 bg-slate-800/50 rounded-lg">
              <div className="text-slate-500 text-xs sm:text-sm mb-1">Labdaeladás</div>
              <div className="text-slate-50 text-lg sm:text-xl">{player.turnovers}</div>
            </div>
            <div className="p-3 sm:p-4 bg-slate-800/50 rounded-lg">
              <div className="text-slate-500 text-xs sm:text-sm mb-1">Blokkok</div>
              <div className="text-slate-50 text-lg sm:text-xl">{player.blocks}</div>
            </div>
            <div className="p-3 sm:p-4 bg-slate-800/50 rounded-lg">
              <div className="text-slate-500 text-xs sm:text-sm mb-1">Elkövetett faultok</div>
              <div className="text-slate-50 text-lg sm:text-xl">{player.foulsCommitted}</div>
            </div>
            <div className="p-3 sm:p-4 bg-slate-800/50 rounded-lg">
              <div className="text-slate-500 text-xs sm:text-sm mb-1">Kapott faultok</div>
              <div className="text-slate-50 text-lg sm:text-xl">{player.foulsDrawn}</div>
            </div>
            <div className="p-3 sm:p-4 bg-slate-800/50 rounded-lg">
              <div className="text-slate-500 text-xs sm:text-sm mb-1">Assist/TO arány</div>
              <div className="text-slate-50 text-lg sm:text-xl">
                {player.turnovers > 0 ? (player.assists / player.turnovers).toFixed(2) : player.assists.toFixed(1)}
              </div>
            </div>
            <div className="p-3 sm:p-4 bg-slate-800/50 rounded-lg">
              <div className="text-slate-500 text-xs sm:text-sm mb-1">Meccsek</div>
              <div className="text-slate-50 text-lg sm:text-xl">{player.gamesPlayed}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Meccsenkénti statisztikák */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-slate-50 text-base sm:text-lg">Meccsenkénti Statisztikák</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 sm:py-3 text-slate-400 font-medium sticky left-0 bg-slate-900 z-10">Dátum</th>
                  <th className="text-left py-2 sm:py-3 text-slate-400 font-medium">Ellenfél</th>
                  <th className="text-center py-2 sm:py-3 text-slate-400 font-medium">Perc</th>
                  <th className="text-center py-2 sm:py-3 text-slate-400 font-medium">Pont</th>
                  <th className="text-center py-2 sm:py-3 text-slate-400 font-medium hidden sm:table-cell">2P</th>
                  <th className="text-center py-2 sm:py-3 text-slate-400 font-medium hidden sm:table-cell">3P</th>
                  <th className="text-center py-2 sm:py-3 text-slate-400 font-medium hidden sm:table-cell">FT</th>
                  <th className="text-center py-2 sm:py-3 text-slate-400 font-medium">Lep</th>
                  <th className="text-center py-2 sm:py-3 text-slate-400 font-medium">Góp</th>
                  <th className="text-center py-2 sm:py-3 text-slate-400 font-medium hidden md:table-cell">Lab</th>
                  <th className="text-center py-2 sm:py-3 text-slate-400 font-medium hidden md:table-cell">Blk</th>
                  <th className="text-center py-2 sm:py-3 text-slate-400 font-medium hidden md:table-cell">TO</th>
                  <th className="text-center py-2 sm:py-3 text-slate-400 font-medium">VAL</th>
                  <th className="text-center py-2 sm:py-3 text-slate-400 font-medium hidden lg:table-cell">ORtg</th>
                  <th className="text-center py-2 sm:py-3 text-slate-400 font-medium hidden lg:table-cell">DRtg</th>
                  <th className="text-center py-2 sm:py-3 text-slate-400 font-medium hidden xl:table-cell">TS%</th>
                  <th className="text-center py-2 sm:py-3 text-slate-400 font-medium hidden xl:table-cell">eFG%</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                {filteredGames.map((game, idx) => {
                  const twoPointMade = game.shooting.close.made + game.shooting.mid.made;
                  const twoPointAttempted = game.shooting.close.attempted + game.shooting.mid.attempted;
                  const date = new Date(game.date).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' });
                  
                  return (
                    <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/50">
                      <td className="py-2 sm:py-3 text-slate-300 sticky left-0 bg-slate-900">{date}</td>
                      <td className="py-2 sm:py-3 text-slate-300">{game.opponent}</td>
                      <td className="text-center py-2 sm:py-3">{game.minutes}</td>
                      <td className="text-center py-2 sm:py-3 font-semibold text-emerald-400">{game.points}</td>
                      <td className="text-center py-2 sm:py-3 hidden sm:table-cell">
                        {twoPointMade}/{twoPointAttempted}
                      </td>
                      <td className="text-center py-2 sm:py-3 hidden sm:table-cell">
                        {game.shooting.three.made}/{game.shooting.three.attempted}
                      </td>
                      <td className="text-center py-2 sm:py-3 hidden sm:table-cell">
                        {game.shooting.freeThrow.made}/{game.shooting.freeThrow.attempted}
                      </td>
                      <td className="text-center py-2 sm:py-3">{game.rebounds.total}</td>
                      <td className="text-center py-2 sm:py-3">{game.assists}</td>
                      <td className="text-center py-2 sm:py-3 hidden md:table-cell">{game.steals}</td>
                      <td className="text-center py-2 sm:py-3 hidden md:table-cell">{game.blocks}</td>
                      <td className="text-center py-2 sm:py-3 hidden md:table-cell text-red-400">{game.turnovers}</td>
                      <td className="text-center py-2 sm:py-3 font-semibold text-cyan-400">{game.valuation}</td>
                      <td className="text-center py-2 sm:py-3 hidden lg:table-cell text-emerald-400">
                        {game.offensiveRating ? game.offensiveRating.toFixed(1) : '-'}
                      </td>
                      <td className="text-center py-2 sm:py-3 hidden lg:table-cell text-cyan-400">
                        {game.defensiveRating ? game.defensiveRating.toFixed(1) : '-'}
                      </td>
                      <td className="text-center py-2 sm:py-3 hidden xl:table-cell text-violet-400">
                        {game.trueShootingPct ? game.trueShootingPct.toFixed(1) + '%' : '-'}
                      </td>
                      <td className="text-center py-2 sm:py-3 hidden xl:table-cell text-orange-400">
                        {game.effectiveShootingPct ? game.effectiveShootingPct.toFixed(1) + '%' : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                {(() => {
                  // Számoljuk ki az ORtg, DRtg és VAL átlagát a SZŰRT meccsekből
                  const footerGamesWithORtg = filteredGames.filter(g => g.offensiveRating != null);
                  const footerGamesWithDRtg = filteredGames.filter(g => g.defensiveRating != null);
                  
                  const footerAvgORtg = footerGamesWithORtg.length > 0
                    ? footerGamesWithORtg.reduce((sum, g) => sum + (g.offensiveRating || 0), 0) / footerGamesWithORtg.length
                    : 0;
                  
                  const footerAvgDRtg = footerGamesWithDRtg.length > 0
                    ? footerGamesWithDRtg.reduce((sum, g) => sum + (g.defensiveRating || 0), 0) / footerGamesWithDRtg.length
                    : 0;

                  // VAL átlag számítása (mutató, nem összegzendő)
                  const avgVAL = gamesPlayed > 0
                    ? totalValuation / gamesPlayed
                    : 0;

                  return (
                    <tr className="border-t-2 border-slate-700 font-semibold">
                      <td className="py-3 text-slate-400 sticky left-0 bg-slate-900" colSpan={2}>
                        <div>{isFiltered ? 'Szűrt időszak' : 'Összesen'} ({gamesPlayed} meccs)</div>
                        <div className="text-xs font-normal text-slate-500 mt-1">{isFiltered ? 'Szűrt ' : 'Szezon '}átlag ↓</div>
                      </td>
                      <td className="text-center py-3 text-slate-300">{totalMinutes}</td>
                      <td className="text-center py-3 text-emerald-400">{totalPoints}</td>
                      <td className="text-center py-3 text-slate-300 hidden sm:table-cell">
                        {totalCloseMade + totalMidMade}/
                        {totalCloseAttempted + totalMidAttempted}
                      </td>
                      <td className="text-center py-3 text-slate-300 hidden sm:table-cell">
                        {totalThreeMade}/{totalThreeAttempted}
                      </td>
                      <td className="text-center py-3 text-slate-300 hidden sm:table-cell">
                        {totalFTMade}/{totalFTAttempted}
                      </td>
                      <td className="text-center py-3 text-slate-300">{totalRebounds}</td>
                      <td className="text-center py-3 text-slate-300">{totalAssists}</td>
                      <td className="text-center py-3 text-slate-300 hidden md:table-cell">{totalSteals}</td>
                      <td className="text-center py-3 text-slate-300 hidden md:table-cell">{totalBlocks}</td>
                      <td className="text-center py-3 text-red-400 hidden md:table-cell">{totalTurnovers}</td>
                      <td className="text-center py-3 text-cyan-400">
                        <div>{avgVAL.toFixed(1)}</div>
                        <div className="text-xs font-normal text-slate-500">átlag</div>
                      </td>
                      <td className="text-center py-3 text-emerald-400 hidden lg:table-cell">
                        <div>{footerAvgORtg.toFixed(1)}</div>
                        <div className="text-xs font-normal text-slate-500">átlag</div>
                      </td>
                      <td className="text-center py-3 text-cyan-400 hidden lg:table-cell">
                        <div>{footerAvgDRtg.toFixed(1)}</div>
                        <div className="text-xs font-normal text-slate-500">átlag</div>
                      </td>
                      <td className="text-center py-3 text-violet-400 hidden xl:table-cell">
                        <div>{trueShootingPct.toFixed(1)}%</div>
                        <div className="text-xs font-normal text-slate-500">átlag</div>
                      </td>
                      <td className="text-center py-3 text-orange-400 hidden xl:table-cell">
                        <div>{effectiveFGPct.toFixed(1)}%</div>
                        <div className="text-xs font-normal text-slate-500">átlag</div>
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

      <Card className="mt-6 bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-slate-50">Utolsó 5 meccs trendje</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-200">
          {trendReport ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={trendBadgeClasses[trendReport.badge.color] ?? 'bg-slate-700/40 text-slate-200 border-slate-600/40'}>
                  <span className="mr-1">{trendIconMap[trendReport.badge.icon] ?? <Minus size={14} />}</span>
                  {trendReport.badge.label}
                </Badge>
                <span className="text-xs text-slate-400">Súlyosság: {trendReport.badge.severity}</span>
              </div>
              <div>{trendReport.summary}</div>
              <div>{trendReport.stability}</div>
              <div>{trendReport.roleTrend}</div>
              <div>{trendReport.roleContext}</div>
              <div className="text-slate-300">{trendReport.takeaway}</div>
            </>
          ) : (
            <div className="text-slate-400">Nincs elérhető trend riport.</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export { PlayerDetails }
