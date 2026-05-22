'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { BarChart2 } from 'lucide-react';

type QuarterRow = {
  team_side: 'home' | 'away' | 'unknown';
  quarter: number;
  points: number | null;
};

type PlayerMinuteRow = {
  player_name: string;
  player_number: number;
  minutes: number;
  points: number;
};

type Props = {
  quarterStats: QuarterRow[];
  playerStats: PlayerMinuteRow[];
  ourSide: 'home' | 'away';
  teamShortName: string;
  opponent: string;
};

const QUARTER_LABELS: Record<number, string> = { 1: 'N1', 2: 'N2', 3: 'N3', 4: 'N4' };

export function GamePbpCharts({ quarterStats, playerStats, ourSide, teamShortName, opponent }: Props) {
  const oppSide = ourSide === 'home' ? 'away' : 'home';

  // --- Negyedenkénti bontás ---
  const allQuarters = [...new Set(quarterStats.map(r => r.quarter))].sort((a, b) => a - b);
  const quarterChartData = allQuarters.map(q => {
    const ourRow = quarterStats.find(r => r.quarter === q && r.team_side === ourSide);
    const oppRow = quarterStats.find(r => r.quarter === q && r.team_side === oppSide);
    const label = QUARTER_LABELS[q] ?? `N${q}`;
    return {
      quarter: label,
      ase: ourRow?.points ?? 0,
      opp: oppRow?.points ?? 0,
    };
  });

  // --- Játékos perctérkép ---
  const minuteData = [...playerStats]
    .filter(p => p.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);

  if (quarterChartData.length === 0 && minuteData.length === 0) return null;

  return (
    <div className="space-y-6">
      {quarterChartData.length > 0 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-50">
              <BarChart2 className="h-5 w-5 text-emerald-400" />
              Negyedenkénti Bontás
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={quarterChartData} barCategoryGap="30%" barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="quarter" tick={{ fill: '#94a3b8', fontSize: 13 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} width={28} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                  labelStyle={{ color: '#f1f5f9', fontWeight: 600 }}
                  itemStyle={{ color: '#94a3b8' }}
                />
                <Bar dataKey="ase" name={teamShortName} fill="#10b981" radius={[3, 3, 0, 0]}>
                  <LabelList dataKey="ase" position="top" style={{ fill: '#10b981', fontSize: 12, fontWeight: 600 }} />
                </Bar>
                <Bar dataKey="opp" name={opponent} fill="#475569" radius={[3, 3, 0, 0]}>
                  <LabelList dataKey="opp" position="top" style={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2 justify-center text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500" />
                {teamShortName}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-slate-600" />
                {opponent}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {minuteData.length > 0 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-50">
              <BarChart2 className="h-5 w-5 text-violet-400" />
              Játékos Percbontás
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(180, minuteData.length * 34)}>
              <BarChart
                data={minuteData}
                layout="vertical"
                margin={{ left: 8, right: 32, top: 4, bottom: 4 }}
                barCategoryGap="20%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 40]}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="player_name"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={110}
                  tickFormatter={(name: string, i: number) => `#${minuteData[i]?.player_number ?? ''} ${name}`}
                />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                  labelStyle={{ color: '#f1f5f9', fontWeight: 600 }}
                  itemStyle={{ color: '#94a3b8' }}
                  formatter={(value: number | undefined, name: string | undefined) =>
                    name === 'minutes' ? [`${value ?? 0} perc`, 'Játékidő'] : [`${value ?? 0} pont`, 'Pontok']
                  }
                />
                <Bar dataKey="minutes" name="minutes" radius={[0, 3, 3, 0]}>
                  {minuteData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.points >= 15 ? '#10b981' : entry.points >= 8 ? '#3b82f6' : '#475569'}
                    />
                  ))}
                  <LabelList
                    dataKey="minutes"
                    position="right"
                    style={{ fill: '#cbd5e1', fontSize: 11 }}
                    formatter={(v: boolean | string | number | null | undefined) => `${v ?? 0}'`}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2 justify-center text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500" />
                15+ pont
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-blue-500" />
                8–14 pont
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-slate-600" />
                0–7 pont
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
