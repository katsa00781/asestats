'use client';

import { useMemo } from 'react';
import {
  Chart as ChartJS,
  type ChartData,
  type ChartOptions,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Bubble } from 'react-chartjs-2';
import { CHART_COLORS, CHARTJS_AXIS_TICK_COLOR, CHARTJS_GRID_COLOR, CHARTJS_TOOLTIP_STYLE } from '@/lib/chart-theme';

ChartJS.register(LinearScale, PointElement, Tooltip);

type ZoneHeatCell = {
  label: string;
  rateDelta: number;
  pctDelta: number;
  compositeDelta: number;
};

type PostgameZoneHeatmapChartProps = {
  cells: ZoneHeatCell[];
  interpretation?: 'relative' | 'absolute';
  perspectiveLabel?: string;
  opponentLabel?: string;
};

const rows = [
  { key: 'rateDelta', label: 'Volumen delta (pp)' },
  { key: 'pctDelta', label: 'FG% delta (pp)' },
] as const;

const hexToRgb = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
};

const colorFromDelta = (value: number) => {
  const clamped = Math.max(-10, Math.min(10, value));
  const alpha = 0.22 + (Math.abs(clamped) / 10) * 0.55;
  if (clamped >= 0) return `rgba(${hexToRgb(CHART_COLORS.positive)}, ${alpha.toFixed(3)})`;
  return `rgba(${hexToRgb(CHART_COLORS.negative)}, ${alpha.toFixed(3)})`;
};

export function PostgameZoneHeatmapChart({
  cells,
  interpretation = 'absolute',
  perspectiveLabel,
  opponentLabel,
}: PostgameZoneHeatmapChartProps) {
  const chartData = useMemo<ChartData<'bubble'>>(() => {
    const points = cells.flatMap((cell, xIndex) => {
      return rows.map((row, rowIndex) => {
        const value = row.key === 'rateDelta' ? cell.rateDelta : cell.pctDelta;
        return {
          x: xIndex + 1,
          y: rowIndex + 1,
          r: 20,
          value,
          zoneLabel: cell.label,
          metricLabel: row.label,
        };
      });
    });

    return {
      datasets: [
        {
          label: 'Zóna delta',
          data: points,
          backgroundColor: points.map(point => colorFromDelta(point.value)),
          borderColor: points.map(point => (point.value >= 0 ? `${CHART_COLORS.positive}F2` : `${CHART_COLORS.negative}F2`)),
          borderWidth: 1.2,
          hoverBorderWidth: 2,
        },
      ],
    };
  }, [cells]);

  const options = useMemo<ChartOptions<'bubble'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: 'linear',
        min: 0.5,
        max: cells.length + 0.5,
        ticks: {
          color: CHARTJS_AXIS_TICK_COLOR,
          callback(value) {
            const idx = Number(value) - 1;
            return cells[idx]?.label ?? '';
          },
          maxRotation: 0,
          autoSkip: false,
          font: { size: 10 },
        },
        grid: { color: CHARTJS_GRID_COLOR },
      },
      y: {
        type: 'linear',
        min: 0.5,
        max: rows.length + 0.5,
        ticks: {
          color: CHARTJS_AXIS_TICK_COLOR,
          stepSize: 1,
          callback(value) {
            const idx = Number(value) - 1;
            return rows[idx]?.label ?? '';
          },
          font: { size: 10 },
        },
        grid: { color: CHARTJS_GRID_COLOR },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        ...CHARTJS_TOOLTIP_STYLE,
        callbacks: {
          label(context) {
            const raw = context.raw as { value: number; zoneLabel: string; metricLabel: string };
            const sign = raw.value > 0 ? '+' : '';
            return `${raw.zoneLabel} • ${raw.metricLabel}: ${sign}${raw.value.toFixed(1)} pp`;
          },
          afterLabel(context) {
            if (interpretation !== 'relative') return undefined;
            const own = perspectiveLabel ?? 'Saját oldal';
            const opp = opponentLabel ?? 'ellenfél oldal';
            const raw = context.raw as { value: number };
            const direction = raw.value >= 0
              ? `pozitív: ${own} relatív zónaelőny`
              : `negatív: ${opp} relatív zónaelőny`;
            return [
              `Mutató: ${own} liga-delta - ${opp} liga-delta`,
              direction,
            ];
          },
        },
      },
    },
  }), [cells, interpretation, perspectiveLabel, opponentLabel]);

  return <div className="h-62.5"><Bubble data={chartData} options={options} /></div>;
}
