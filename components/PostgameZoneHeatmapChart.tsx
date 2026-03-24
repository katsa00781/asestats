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

ChartJS.register(LinearScale, PointElement, Tooltip);

type ZoneHeatCell = {
  label: string;
  rateDelta: number;
  pctDelta: number;
  compositeDelta: number;
};

type PostgameZoneHeatmapChartProps = {
  cells: ZoneHeatCell[];
};

const rows = [
  { key: 'rateDelta', label: 'Volumen delta (pp)' },
  { key: 'pctDelta', label: 'FG% delta (pp)' },
] as const;

const colorFromDelta = (value: number) => {
  const clamped = Math.max(-10, Math.min(10, value));
  const alpha = 0.22 + (Math.abs(clamped) / 10) * 0.55;
  if (clamped >= 0) return `rgba(34, 197, 94, ${alpha.toFixed(3)})`;
  return `rgba(244, 63, 94, ${alpha.toFixed(3)})`;
};

export function PostgameZoneHeatmapChart({ cells }: PostgameZoneHeatmapChartProps) {
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
          borderColor: points.map(point => (point.value >= 0 ? 'rgba(34, 197, 94, 0.95)' : 'rgba(244, 63, 94, 0.95)')),
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
          color: '#94a3b8',
          callback(value) {
            const idx = Number(value) - 1;
            return cells[idx]?.label ?? '';
          },
          maxRotation: 0,
          autoSkip: false,
          font: {
            size: 10,
          },
        },
        grid: {
          color: 'rgba(71, 85, 105, 0.22)',
        },
      },
      y: {
        type: 'linear',
        min: 0.5,
        max: rows.length + 0.5,
        ticks: {
          color: '#94a3b8',
          stepSize: 1,
          callback(value) {
            const idx = Number(value) - 1;
            return rows[idx]?.label ?? '';
          },
          font: {
            size: 10,
          },
        },
        grid: {
          color: 'rgba(71, 85, 105, 0.22)',
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label(context) {
            const raw = context.raw as { value: number; zoneLabel: string; metricLabel: string };
            const sign = raw.value > 0 ? '+' : '';
            return `${raw.zoneLabel} • ${raw.metricLabel}: ${sign}${raw.value.toFixed(1)} pp`;
          },
        },
      },
    },
  }), [cells]);

  return <div className="h-62.5"><Bubble data={chartData} options={options} /></div>;
}
