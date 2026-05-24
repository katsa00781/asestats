import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Calendar, TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { GamePerformance } from '@/lib/dashboard-types';
import {
  CHART_COLORS,
  CHART_GRID,
  CHART_AXIS,
  RECHARTS_TOOLTIP_STYLE,
  RECHARTS_LEGEND_STYLE,
} from '@/lib/chart-theme';

type PlayerTrendsProps = {
  gameHistory: GamePerformance[];
};

export function PlayerTrends({ gameHistory }: PlayerTrendsProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Szűrt adatok dátum alapján
  const filteredGames = useMemo(() => {
    let filtered = [...gameHistory].reverse(); // Időrendben növekvő

    if (startDate) {
      filtered = filtered.filter(game => new Date(game.date) >= new Date(startDate));
    }
    if (endDate) {
      filtered = filtered.filter(game => new Date(game.date) <= new Date(endDate));
    }

    return filtered;
  }, [gameHistory, startDate, endDate]);

  // Diagram adatok előkészítése
  const chartData = filteredGames.map((game) => ({
    date: new Date(game.date).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' }),
    fullDate: game.date,
    opponent: game.opponent,
    points: game.points,
    rebounds: game.rebounds.total,
    assists: game.assists,
    steals: game.steals,
    blocks: game.blocks,
    turnovers: game.turnovers,
    valuation: game.valuation,
  }));

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
  };

  const labelFormatter = (label: string) => {
    const game = chartData.find(g => g.date === label);
    return game ? `${game.fullDate} vs ${game.opponent}` : label;
  };

  if (gameHistory.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-secondary">
            <TrendingUp size={48} className="mx-auto mb-4 opacity-40" strokeWidth={1.5} />
            <p>Még nincsenek meccs adatok ehhez a játékoshoz</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Szűrők */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display uppercase tracking-wide text-sm text-secondary">
            <Calendar size={16} strokeWidth={1.6} />
            Időszak szűrés
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px] space-y-1.5">
              <Label htmlFor="startDate" className="font-display text-xs uppercase tracking-widest text-secondary">
                Kezdő dátum
              </Label>
              <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="flex-1 min-w-[200px] space-y-1.5">
              <Label htmlFor="endDate" className="font-display text-xs uppercase tracking-widest text-secondary">
                Záró dátum
              </Label>
              <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <Button variant="outline" onClick={clearFilters}>
              Szűrők törlése
            </Button>
          </div>
          <div className="mt-4 text-secondary text-sm">
            {filteredGames.length} meccs megjelenítve ({gameHistory.length} összesen)
          </div>
        </CardContent>
      </Card>

      {/* Pontok trendje */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display uppercase tracking-wide text-sm text-primary">Pontok meccsenként</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray={CHART_GRID.strokeDashed} stroke={CHART_GRID.stroke} />
              <XAxis dataKey="date" stroke={CHART_AXIS.stroke} tick={{ fontSize: CHART_AXIS.fontSize, fontFamily: CHART_AXIS.fontFamily }} tickLine={false} axisLine={false} />
              <YAxis stroke={CHART_AXIS.stroke} tick={{ fontSize: CHART_AXIS.fontSize, fontFamily: CHART_AXIS.fontFamily }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={RECHARTS_TOOLTIP_STYLE} labelFormatter={labelFormatter} />
              <Line type="monotone" dataKey="points" stroke={CHART_COLORS.positive} strokeWidth={2.5} dot={{ fill: CHART_COLORS.positive, r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} name="Pontok" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Lepattanók és gólpasszok */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display uppercase tracking-wide text-sm text-primary">Lepattanók és gólpasszok</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray={CHART_GRID.strokeDashed} stroke={CHART_GRID.stroke} />
              <XAxis dataKey="date" stroke={CHART_AXIS.stroke} tick={{ fontSize: CHART_AXIS.fontSize, fontFamily: CHART_AXIS.fontFamily }} tickLine={false} axisLine={false} />
              <YAxis stroke={CHART_AXIS.stroke} tick={{ fontSize: CHART_AXIS.fontSize, fontFamily: CHART_AXIS.fontFamily }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={RECHARTS_TOOLTIP_STYLE} labelFormatter={labelFormatter} />
              <Legend wrapperStyle={RECHARTS_LEGEND_STYLE} />
              <Line type="monotone" dataKey="rebounds" stroke={CHART_COLORS.cyan} strokeWidth={2} dot={{ fill: CHART_COLORS.cyan, r: 3.5, strokeWidth: 0 }} activeDot={{ r: 5 }} name="Lepattanók" />
              <Line type="monotone" dataKey="assists" stroke={CHART_COLORS.orange} strokeWidth={2} dot={{ fill: CHART_COLORS.orange, r: 3.5, strokeWidth: 0 }} activeDot={{ r: 5 }} name="Gólpasszok" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Védekező teljesítmény */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display uppercase tracking-wide text-sm text-primary">Védekező teljesítmény</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray={CHART_GRID.strokeDashed} stroke={CHART_GRID.stroke} />
              <XAxis dataKey="date" stroke={CHART_AXIS.stroke} tick={{ fontSize: CHART_AXIS.fontSize, fontFamily: CHART_AXIS.fontFamily }} tickLine={false} axisLine={false} />
              <YAxis stroke={CHART_AXIS.stroke} tick={{ fontSize: CHART_AXIS.fontSize, fontFamily: CHART_AXIS.fontFamily }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={RECHARTS_TOOLTIP_STYLE} labelFormatter={labelFormatter} />
              <Legend wrapperStyle={RECHARTS_LEGEND_STYLE} />
              <Line type="monotone" dataKey="steals" stroke={CHART_COLORS.ai} strokeWidth={2} dot={{ fill: CHART_COLORS.ai, r: 3.5, strokeWidth: 0 }} activeDot={{ r: 5 }} name="Labdaszerzések" />
              <Line type="monotone" dataKey="blocks" stroke={CHART_COLORS.warning} strokeWidth={2} dot={{ fill: CHART_COLORS.warning, r: 3.5, strokeWidth: 0 }} activeDot={{ r: 5 }} name="Blokkok" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Hatékonyság (VAL) */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display uppercase tracking-wide text-sm text-primary">Hatékonyság (VAL)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray={CHART_GRID.strokeDashed} stroke={CHART_GRID.stroke} />
              <XAxis dataKey="date" stroke={CHART_AXIS.stroke} tick={{ fontSize: CHART_AXIS.fontSize, fontFamily: CHART_AXIS.fontFamily }} tickLine={false} axisLine={false} />
              <YAxis stroke={CHART_AXIS.stroke} tick={{ fontSize: CHART_AXIS.fontSize, fontFamily: CHART_AXIS.fontFamily }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={RECHARTS_TOOLTIP_STYLE} labelFormatter={labelFormatter} />
              <Line type="monotone" dataKey="valuation" stroke={CHART_COLORS.cyan} strokeWidth={2.5} dot={{ fill: CHART_COLORS.cyan, r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} name="VAL" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
