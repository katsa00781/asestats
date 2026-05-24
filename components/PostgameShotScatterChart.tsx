'use client';

import { useMemo } from 'react';
import {
  Chart as ChartJS,
  type ChartData,
  type ChartOptions,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  type Plugin,
} from 'chart.js';
import { Scatter } from 'react-chartjs-2';
import { CHART_COLORS, CHARTJS_TOOLTIP_STYLE } from '@/lib/chart-theme';

ChartJS.register(LinearScale, PointElement, Tooltip, Legend);

type ShotPoint = {
  x: number;
  y: number;
  result: string;
  player: string;
};

type PostgameShotScatterChartProps = {
  shots: ShotPoint[];
  showPoints: boolean;
  showHeatmap: boolean;
  heatmapContrast: 'soft' | 'normal' | 'sharp';
  heatmapMode: 'volume' | 'efficiency';
};

const COURT = {
  sideMin: 0,
  sideMax: 100,
  depthMin: 0,
  depthMax: 36,
  hoopSide: 50,
  hoopDepth: 6,
  backboardDepth: 4.8,
  keySideMin: 32,
  keySideMax: 68,
  keyDepth: 18,
  cornerSideMin: 14,
  cornerSideMax: 86,
  cornerDepth: 25,
  arcPeakDepth: 32,
};

const lerp = (start: number, end: number, t: number) => start + (end - start) * t;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const HEATMAP_PROFILE: Record<'soft' | 'normal' | 'sharp', {
  exponent: number;
  radiusFactor: number;
  threshold: number;
  alphaBase: number;
  alphaScale: number;
}> = {
  soft: {
    exponent: 0.95,
    radiusFactor: 0.92,
    threshold: 0.03,
    alphaBase: 0.04,
    alphaScale: 0.42,
  },
  normal: {
    exponent: 1.3,
    radiusFactor: 0.72,
    threshold: 0.08,
    alphaBase: 0.06,
    alphaScale: 0.72,
  },
  sharp: {
    exponent: 2.1,
    radiusFactor: 0.46,
    threshold: 0.16,
    alphaBase: 0.1,
    alphaScale: 0.98,
  },
};

const buildHeatColor = (ratio: number) => {
  const r = Math.max(0, Math.min(1, ratio));

  // Cold -> warm ramp: green (cold) -> yellow (medium) -> red (hot).
  if (r <= 0.32) {
    const t = r / 0.32;
    const red = Math.round(lerp(22, 250, t));
    const green = Math.round(lerp(163, 204, t));
    const blue = Math.round(lerp(74, 21, t));
    return { red, green, blue };
  }

  const t = (r - 0.32) / 0.68;
  const red = Math.round(lerp(250, 239, t));
  const green = Math.round(lerp(204, 68, t));
  const blue = Math.round(lerp(21, 68, t));
  return { red, green, blue };
};

const courtPlugin: Plugin<'scatter'> = {
  id: 'postgame-court-layer',
  beforeDraw(chart) {
    const { ctx, chartArea, scales } = chart;
    const xScale = scales.x;
    const yScale = scales.y;
    if (!xScale || !yScale || !chartArea) return;

    const toX = (side: number) => xScale.getPixelForValue(side);
    const toY = (depth: number) => yScale.getPixelForValue(depth);

    ctx.save();

    ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.fillRect(chartArea.left, chartArea.top, chartArea.right - chartArea.left, chartArea.bottom - chartArea.top);

    ctx.fillStyle = 'rgba(217, 119, 6, 0.06)';
    ctx.fillRect(toX(COURT.sideMin), toY(COURT.depthMax), toX(COURT.sideMax) - toX(COURT.sideMin), toY(COURT.depthMin) - toY(COURT.depthMax));

    ctx.strokeStyle = 'rgba(226, 232, 240, 0.75)';
    ctx.lineWidth = 2.1;
    ctx.beginPath();
    ctx.moveTo(toX(COURT.sideMin), toY(COURT.depthMin));
    ctx.lineTo(toX(COURT.sideMax), toY(COURT.depthMin));
    ctx.stroke();

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(toX(COURT.sideMin), toY(COURT.depthMin));
    ctx.lineTo(toX(COURT.sideMin), toY(COURT.depthMax));
    ctx.moveTo(toX(COURT.sideMax), toY(COURT.depthMin));
    ctx.lineTo(toX(COURT.sideMax), toY(COURT.depthMax));
    ctx.stroke();

    ctx.fillStyle = 'rgba(14, 165, 233, 0.08)';
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.65)';
    ctx.lineWidth = 1.2;
    const keyLeft = toX(COURT.keySideMin);
    const keyRight = toX(COURT.keySideMax);
    const keyTop = toY(COURT.keyDepth);
    const baseline = toY(COURT.depthMin);
    ctx.beginPath();
    ctx.rect(keyLeft, keyTop, keyRight - keyLeft, baseline - keyTop);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(96, 165, 250, 0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(toX(COURT.cornerSideMin), toY(COURT.depthMin));
    ctx.lineTo(toX(COURT.cornerSideMin), toY(COURT.cornerDepth));
    ctx.moveTo(toX(COURT.cornerSideMax), toY(COURT.depthMin));
    ctx.lineTo(toX(COURT.cornerSideMax), toY(COURT.cornerDepth));

    let first = true;
    for (let side = COURT.cornerSideMin; side <= COURT.cornerSideMax; side += 1.1) {
      const sideNorm = Math.abs(side - 50) / (50 - COURT.cornerSideMin);
      const depth = COURT.cornerDepth + (COURT.arcPeakDepth - COURT.cornerDepth) * (1 - sideNorm * sideNorm);
      if (first) {
        ctx.moveTo(toX(side), toY(depth));
        first = false;
      } else {
        ctx.lineTo(toX(side), toY(depth));
      }
    }
    ctx.stroke();

    const hoopX = toX(COURT.hoopSide);
    const hoopY = toY(COURT.hoopDepth);
    const backboardY = toY(COURT.backboardDepth);

    ctx.fillStyle = 'rgba(248, 250, 252, 0.12)';
    ctx.beginPath();
    ctx.ellipse(hoopX, hoopY, 10, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(248, 250, 252, 0.95)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(hoopX, hoopY, 6, 6, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(toX(44), backboardY);
    ctx.lineTo(toX(56), backboardY);
    ctx.stroke();

    ctx.restore();
  },
};

export function PostgameShotScatterChart({ shots, showPoints, showHeatmap, heatmapContrast, heatmapMode }: PostgameShotScatterChartProps) {
  const heatmapProfile = HEATMAP_PROFILE[heatmapContrast];
  const chartRenderKey = `${heatmapContrast}-${heatmapMode}-${showHeatmap ? 'heat-on' : 'heat-off'}-${showPoints ? 'pts-on' : 'pts-off'}`;

  const halfCourtShots = useMemo(
    () => shots.filter(shot => shot.x >= COURT.depthMin && shot.x <= COURT.depthMax && shot.y >= COURT.sideMin && shot.y <= COURT.sideMax),
    [shots]
  );

  const heatCells = useMemo(() => {
    const sideBins = 10;
    const depthBins = 8;
    const sideRange = COURT.sideMax - COURT.sideMin;
    const depthRange = COURT.depthMax - COURT.depthMin;
    const sideStep = sideRange / sideBins;
    const depthStep = depthRange / depthBins;

    const cells = Array.from({ length: depthBins }, (_, depthIndex) =>
      Array.from({ length: sideBins }, (_, sideIndex) => ({
        sideIndex,
        depthIndex,
        attempts: 0,
        made: 0,
      }))
    );

    halfCourtShots.forEach(shot => {
      const sideIndex = Math.min(sideBins - 1, Math.max(0, Math.floor(((shot.y - COURT.sideMin) / sideRange) * sideBins)));
      const depthIndex = Math.min(depthBins - 1, Math.max(0, Math.floor(((shot.x - COURT.depthMin) / depthRange) * depthBins)));
      cells[depthIndex][sideIndex].attempts += 1;
      if (shot.result === 'Bement') cells[depthIndex][sideIndex].made += 1;
    });

    return {
      sideStep,
      depthStep,
      cells: cells.flat(),
      maxAttempts: Math.max(...cells.flat().map(cell => cell.attempts), 0),
    };
  }, [halfCourtShots]);

  const heatmapPlugin = useMemo<Plugin<'scatter'>>(() => ({
    id: 'postgame-heatmap-layer',
    beforeDatasetsDraw(chart) {
      if (!showHeatmap) return;

      const { ctx, scales } = chart;
      const xScale = scales.x;
      const yScale = scales.y;
      if (!xScale || !yScale || heatCells.maxAttempts <= 0) return;

      const toX = (side: number) => xScale.getPixelForValue(side);
      const toY = (depth: number) => yScale.getPixelForValue(depth);

      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      heatCells.cells.forEach(cell => {
        if (cell.attempts <= 0) return;

        const sideStart = COURT.sideMin + cell.sideIndex * heatCells.sideStep;
        const sideEnd = sideStart + heatCells.sideStep;
        const depthStart = COURT.depthMin + cell.depthIndex * heatCells.depthStep;
        const depthEnd = depthStart + heatCells.depthStep;
        const centerSide = (sideStart + sideEnd) / 2;
        const centerDepth = (depthStart + depthEnd) / 2;
        const volumeRatio = heatCells.maxAttempts > 0 ? cell.attempts / heatCells.maxAttempts : 0;
        const fgPct = cell.attempts > 0 ? cell.made / cell.attempts : 0;
        const efficiencyRatio = clamp((fgPct - 0.25) / 0.5, 0, 1);
        const activityWeight = clamp(cell.attempts / 6, 0.45, 1);
        const rawRatio = heatmapMode === 'efficiency'
          ? efficiencyRatio * activityWeight
          : volumeRatio;
        const boostedRatio = Math.pow(rawRatio, heatmapProfile.exponent);
        const threshold = heatmapMode === 'efficiency'
          ? Math.max(heatmapProfile.threshold, 0.1)
          : heatmapProfile.threshold;
        if (boostedRatio < threshold) return;
        if (heatmapMode === 'efficiency' && cell.attempts < 3) return;

        const { red, green, blue } = buildHeatColor(boostedRatio);
        const maxPxRadius = Math.max(
          (toX(sideEnd) - toX(sideStart)) * heatmapProfile.radiusFactor,
          (toY(depthStart) - toY(depthEnd)) * heatmapProfile.radiusFactor
        );

        const gradient = ctx.createRadialGradient(
          toX(centerSide),
          toY(centerDepth),
          0,
          toX(centerSide),
          toY(centerDepth),
          maxPxRadius
        );

        const centerAlpha = heatmapProfile.alphaBase + boostedRatio * heatmapProfile.alphaScale;
        const midAlpha = centerAlpha * 0.56;
        gradient.addColorStop(0, `rgba(${red}, ${green}, ${blue}, ${centerAlpha.toFixed(3)})`);
        gradient.addColorStop(0.58, `rgba(${red}, ${green}, ${blue}, ${midAlpha.toFixed(3)})`);
        gradient.addColorStop(1, `rgba(${red}, ${green}, ${blue}, 0)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(toX(centerSide), toY(centerDepth), maxPxRadius, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    },
  }), [heatCells, showHeatmap, heatmapProfile, heatmapMode]);

  const chartData = useMemo<ChartData<'scatter'>>(() => {
    const made = halfCourtShots.filter(shot => shot.result === 'Bement');
    const missed = halfCourtShots.filter(shot => shot.result !== 'Bement');

    return {
      datasets: [
        {
          label: 'Bement',
          data: showPoints ? made.map(shot => ({ x: shot.y, y: shot.x, player: shot.player })) : [],
          backgroundColor: `${CHART_COLORS.positive}EB`,
          borderColor: '#050B14',
          borderWidth: 1,
          pointRadius: 5,
          pointHoverRadius: 7,
        },
        {
          label: 'Kimaradt',
          data: showPoints ? missed.map(shot => ({ x: shot.y, y: shot.x, player: shot.player })) : [],
          backgroundColor: `${CHART_COLORS.negative}EB`,
          borderColor: '#050B14',
          borderWidth: 1,
          pointRadius: 5,
          pointHoverRadius: 7,
        },
      ],
    };
  }, [halfCourtShots, showPoints]);

  const options = useMemo<ChartOptions<'scatter'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 400,
    },
    scales: {
      x: {
        type: 'linear',
        min: COURT.sideMin,
        max: COURT.sideMax,
        display: false,
        grid: {
          display: false,
        },
      },
      y: {
        type: 'linear',
        min: COURT.depthMax,
        max: COURT.depthMin,
        display: false,
        grid: {
          display: false,
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: showPoints,
        ...CHARTJS_TOOLTIP_STYLE,
        callbacks: {
          label(context) {
            const raw = context.raw as { x: number; y: number; player?: string };
            return `${raw.player ?? 'Ismeretlen'} • ${context.dataset.label} • x:${raw.y.toFixed(1)} y:${raw.x.toFixed(1)}`;
          },
        },
      },
    },
  }), [showPoints]);

  return (
    <div className="h-130 rounded-lg border border-border-active bg-base/40">
      <Scatter key={chartRenderKey} data={chartData} options={options} plugins={[courtPlugin, heatmapPlugin]} />
    </div>
  );
}
