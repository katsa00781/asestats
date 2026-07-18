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
import { CHART_COLORS, CHART_GRID, CHART_AXIS, RECHARTS_TOOLTIP_STYLE } from '@/lib/chart-theme';

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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <BarChart2 className="h-5 w-5 text-positive" />
              Negyedenkénti Bontás
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={quarterChartData} barCategoryGap="30%" barGap={4}>
                <CartesianGrid strokeDasharray={CHART_GRID.strokeDashed} stroke={CHART_GRID.stroke} vertical={false} />
                <XAxis dataKey="quarter" tick={{ fill: CHART_AXIS.stroke, fontSize: 13, fontFamily: CHART_AXIS.fontFamily }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: CHART_AXIS.stroke, fontSize: 12, fontFamily: CHART_AXIS.fontFamily }} axisLine={false} tickLine={false} width={28} />
                <Tooltip contentStyle={RECHARTS_TOOLTIP_STYLE} />
                <Bar dataKey="ase" name={teamShortName} fill={CHART_COLORS.positive} radius={[3, 3, 0, 0]}>
                  <LabelList dataKey="ase" position="top" style={{ fill: CHART_COLORS.positive, fontSize: 12, fontWeight: 600 }} />
                </Bar>
                <Bar dataKey="opp" name={opponent} fill={CHART_COLORS.muted} radius={[3, 3, 0, 0]}>
                  <LabelList dataKey="opp" position="top" style={{ fill: CHART_COLORS.secondary, fontSize: 12, fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2 justify-center text-xs text-secondary">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-positive" />
                {teamShortName}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-muted" />
                {opponent}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {minuteData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <BarChart2 className="h-5 w-5 text-ai" />
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
                <CartesianGrid strokeDasharray={CHART_GRID.strokeDashed} stroke={CHART_GRID.stroke} horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 40]}
                  tick={{ fill: CHART_AXIS.stroke, fontSize: 11, fontFamily: CHART_AXIS.fontFamily }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="player_name"
                  tick={{ fill: CHART_AXIS.stroke, fontSize: 12, fontFamily: CHART_AXIS.fontFamily }}
                  axisLine={false}
                  tickLine={false}
                  width={110}
                  tickFormatter={(name: string, i: number) => `#${minuteData[i]?.player_number ?? ''} ${name}`}
                />
                <Tooltip
                  contentStyle={RECHARTS_TOOLTIP_STYLE}
                  formatter={(value: number | undefined, name: string | undefined) =>
                    name === 'minutes' ? [`${value ?? 0} perc`, 'Játékidő'] : [`${value ?? 0} pont`, 'Pontok']
                  }
                />
                <Bar dataKey="minutes" name="minutes" radius={[0, 3, 3, 0]}>
                  {minuteData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.points >= 15 ? CHART_COLORS.positive : entry.points >= 8 ? CHART_COLORS.cyan : CHART_COLORS.muted}
                    />
                  ))}
                  <LabelList
                    dataKey="minutes"
                    position="right"
                    style={{ fill: CHART_COLORS.primary, fontSize: 11 }}
                    formatter={(v: boolean | string | number | null | undefined) => `${v ?? 0}'`}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2 justify-center text-xs text-secondary">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-positive" />
                15+ pont
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-cyan" />
                8–14 pont
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-muted" />
                0–7 pont
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
