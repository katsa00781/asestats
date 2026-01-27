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
import { GamePerformance } from '@/app/page';

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

  if (gameHistory.length === 0) {
    return (
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="py-12">
          <div className="text-center text-slate-400">
            <TrendingUp size={48} className="mx-auto mb-4 opacity-50" />
            <p>Még nincsenek meccs adatok ehhez a játékoshoz</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Szűrők */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-slate-50 flex items-center gap-2">
            <Calendar size={20} />
            Időszak szűrés
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px] space-y-2">
              <Label htmlFor="startDate" className="text-slate-300">
                Kezdő dátum
              </Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-800 border-slate-700 text-slate-100"
              />
            </div>

            <div className="flex-1 min-w-[200px] space-y-2">
              <Label htmlFor="endDate" className="text-slate-300">
                Záró dátum
              </Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-800 border-slate-700 text-slate-100"
              />
            </div>

            <Button
              variant="outline"
              onClick={clearFilters}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Szűrők törlése
            </Button>
          </div>

          <div className="mt-4 text-slate-400 text-sm">
            {filteredGames.length} meccs megjelenítve ({gameHistory.length} összesen)
          </div>
        </CardContent>
      </Card>

      {/* Pontok trendje */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-slate-50">Pontok meccsenként</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="date"
                stroke="#94a3b8"
                style={{ fontSize: '12px' }}
              />
              <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#f1f5f9',
                }}
                labelFormatter={(label) => {
                  const game = chartData.find(g => g.date === label);
                  return game ? `${game.fullDate} vs ${game.opponent}` : label;
                }}
              />
              <Line
                type="monotone"
                dataKey="points"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ fill: '#10b981', r: 5 }}
                name="Pontok"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Lepattanók és gólpasszok */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-slate-50">Lepattanók és gólpasszok</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="date"
                stroke="#94a3b8"
                style={{ fontSize: '12px' }}
              />
              <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#f1f5f9',
                }}
                labelFormatter={(label) => {
                  const game = chartData.find(g => g.date === label);
                  return game ? `${game.fullDate} vs ${game.opponent}` : label;
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="rebounds"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 4 }}
                name="Lepattanók"
              />
              <Line
                type="monotone"
                dataKey="assists"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ fill: '#f59e0b', r: 4 }}
                name="Gólpasszok"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Védekező teljesítmény */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-slate-50">Védekező teljesítmény</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="date"
                stroke="#94a3b8"
                style={{ fontSize: '12px' }}
              />
              <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#f1f5f9',
                }}
                labelFormatter={(label) => {
                  const game = chartData.find(g => g.date === label);
                  return game ? `${game.fullDate} vs ${game.opponent}` : label;
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="steals"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ fill: '#8b5cf6', r: 4 }}
                name="Labdaszerzések"
              />
              <Line
                type="monotone"
                dataKey="blocks"
                stroke="#ec4899"
                strokeWidth={2}
                dot={{ fill: '#ec4899', r: 4 }}
                name="Blokkok"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Hatékonyság (VAL) */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-slate-50">Hatékonyság (VAL)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="date"
                stroke="#94a3b8"
                style={{ fontSize: '12px' }}
              />
              <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#f1f5f9',
                }}
                labelFormatter={(label) => {
                  const game = chartData.find(g => g.date === label);
                  return game ? `${game.fullDate} vs ${game.opponent}` : label;
                }}
              />
              <Line
                type="monotone"
                dataKey="valuation"
                stroke="#06b6d4"
                strokeWidth={3}
                dot={{ fill: '#06b6d4', r: 5 }}
                name="VAL"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
