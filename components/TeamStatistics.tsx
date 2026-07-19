'use client';
import { authFetch } from '@/lib/api-fetch';

import { useState, useCallback } from 'react';
import type { PlayerStats, TeamGame, GameAggregate } from '@/lib/dashboard-types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { StatCard } from './ui/stat-card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Trophy, Target, TrendingUp, Users, Award, Activity, Download, Save, ClipboardList, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { toast } from 'sonner';
import { teamStatsToMd } from '@/lib/export-to-md';
import { CHART_COLORS, CHART_GRID, CHART_AXIS, RECHARTS_TOOLTIP_STYLE, RECHARTS_LEGEND_STYLE } from '@/lib/chart-theme';

type TeamStatisticsProps = {
  players: PlayerStats[];
  games: TeamGame[];
  gameStats: GameAggregate;
  teamName?: string;
  seasonId?: string;
  teamId?: string;
  seasonName?: string;
};

export function TeamStatistics({ players, games, gameStats, teamName, seasonId, teamId, seasonName }: TeamStatisticsProps) {
  const [manualText, setManualText] = useState('');
  const [savingManual, setSavingManual] = useState(false);

  const exportTeamMd = useCallback(() => {
    const md = teamStatsToMd(players, games, gameStats, teamName, seasonName);
    const filename = `csapat-${(teamName ?? 'statisztikak').replace(/\s+/g, '-')}-${seasonName ?? ''}.md`;
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    navigator.clipboard.writeText(md).catch(() => null);
    toast.success('MD exportálva – vágólapra másolva és letöltve');
  }, [players, games, gameStats, teamName, seasonName]);

  const saveManualReport = useCallback(async () => {
    if (!manualText.trim()) return;
    if (!seasonId || !teamId) {
      toast.error('Hiányzó szezon vagy csapat azonosító – nem menthető');
      return;
    }
    setSavingManual(true);
    try {
      const resp = await authFetch('/api/save-manual-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportTarget: 'team_season',
          seasonId,
          teamId,
          narrative: manualText.trim(),
        }),
      });
      const json = (await resp.json()) as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? 'Mentési hiba');
      toast.success('Elemzés elmentve');
      setManualText('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Mentési hiba');
    } finally {
      setSavingManual(false);
    }
  }, [manualText, seasonId, teamId]);

  if (players.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-secondary">Még nincsenek betöltött statisztikák.</p>
        <p className="text-muted text-sm mt-2">Töltsd be a meccsadatokat a kezdéshez.</p>
      </div>
    );
  }

  const totalGames = games.length;
  const wins = games.filter((g) => g.result === 'win').length;
  const losses = totalGames - wins;
  const winPercentage = totalGames > 0 ? ((wins / totalGames) * 100).toFixed(1) : '0.0';

  const avgTeamPoints = gameStats.avgPoints.toFixed(1);
  const avgTeamRebounds = gameStats.avgRebounds.toFixed(1);
  const avgTeamAssists = gameStats.avgAssists.toFixed(1);

  const topScorer = [...players].sort((a, b) => b.points / b.gamesPlayed - a.points / a.gamesPlayed)[0];
  const topRebounder = [...players].sort((a, b) => b.rebounds.total / b.gamesPlayed - a.rebounds.total / a.gamesPlayed)[0];
  const topAssister = [...players].sort((a, b) => b.assists / b.gamesPlayed - a.assists / a.gamesPlayed)[0];
  const topValuation = [...players].sort((a, b) => b.valuation - a.valuation)[0];

  const playerComparison = players
    .sort((a, b) => b.points - a.points)
    .slice(0, 6)
    .map((player) => ({
      name: player.name.split(' ').pop() || player.name,
      Pontok: player.points,
      Lepattanók: player.rebounds.total,
      Gólpasszok: player.assists,
      VAL: player.valuation,
    }));

  type PositionData = {
    position: string;
    points: number;
  };

  const positionData = players.reduce((acc: PositionData[], player) => {
    const existing = acc.find((item) => item.position === player.position);
    if (existing) {
      existing.points += player.points;
    } else {
      acc.push({ position: player.position, points: player.points });
    }
    return acc;
  }, [] as PositionData[]);

  const COLORS = [CHART_COLORS.positive, CHART_COLORS.cyan, CHART_COLORS.ai, CHART_COLORS.orange, CHART_COLORS.warning];

  const totalShooting = players.reduce(
    (acc, player) => {
      acc.close.made += player.shooting.close.made;
      acc.close.attempted += player.shooting.close.attempted;
      acc.mid.made += player.shooting.mid.made;
      acc.mid.attempted += player.shooting.mid.attempted;
      acc.three.made += player.shooting.three.made;
      acc.three.attempted += player.shooting.three.attempted;
      acc.freeThrow.made += player.shooting.freeThrow.made;
      acc.freeThrow.attempted += player.shooting.freeThrow.attempted;
      return acc;
    },
    { close: { made: 0, attempted: 0 }, mid: { made: 0, attempted: 0 }, three: { made: 0, attempted: 0 }, freeThrow: { made: 0, attempted: 0 } }
  );

  const shootingStats = [
    {
      category: 'Közeli',
      percentage: totalShooting.close.attempted > 0 ? ((totalShooting.close.made / totalShooting.close.attempted) * 100).toFixed(1) : 0,
      made: totalShooting.close.made,
      attempted: totalShooting.close.attempted,
    },
    {
      category: 'Középtávoli',
      percentage: totalShooting.mid.attempted > 0 ? ((totalShooting.mid.made / totalShooting.mid.attempted) * 100).toFixed(1) : 0,
      made: totalShooting.mid.made,
      attempted: totalShooting.mid.attempted,
    },
    {
      category: 'Hármas',
      percentage: totalShooting.three.attempted > 0 ? ((totalShooting.three.made / totalShooting.three.attempted) * 100).toFixed(1) : 0,
      made: totalShooting.three.made,
      attempted: totalShooting.three.attempted,
    },
    {
      category: 'Büntetők',
      percentage: totalShooting.freeThrow.attempted > 0 ? ((totalShooting.freeThrow.made / totalShooting.freeThrow.attempted) * 100).toFixed(1) : 0,
      made: totalShooting.freeThrow.made,
      attempted: totalShooting.freeThrow.attempted,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display uppercase tracking-wide text-primary mb-2 text-xl sm:text-2xl">
          Csapat Statisztikák
        </h2>
        <p className="text-secondary text-sm sm:text-base">{teamName || 'Csapat'} teljesítménye</p>
      </div>

      {/* Manuális csapatelemzés beillesztése */}
      <Card className="shadow-panel">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4 text-cyan" strokeWidth={1.6} />
              Manuális csapatelemzés beillesztése
            </CardTitle>
            <Button onClick={exportTeamMd} variant="outline" size="sm" className="text-cyan shrink-0">
              <Download className="w-4 h-4 mr-2" strokeWidth={1.6} />
              Export MD
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-secondary">
            Exportáld a statokat MD-be, add át Claude-nak, majd illeszd be az elemzés szövegét és mentsd el.
          </p>
          <Textarea
            placeholder="Illeszd be a Claude-csapatelemzés szövegét..."
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

      {/* KPI StatCard sor */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Győzelmi arány"
          value={`${winPercentage}%`}
          trend="neutral"
          trendValue={`${wins}Gy · ${losses}V`}
          icon={<Trophy className="h-5 w-5" strokeWidth={1.6} />}
          accentColor="green"
          animationDelay={0}
        />
        <StatCard
          label="Átlag pontok"
          value={avgTeamPoints}
          trendValue="pont/meccs"
          trend="neutral"
          icon={<Target className="h-5 w-5" strokeWidth={1.6} />}
          accentColor="cyan"
          animationDelay={60}
        />
        <StatCard
          label="Átlag lepattanók"
          value={avgTeamRebounds}
          trendValue="lep./meccs"
          trend="neutral"
          icon={<TrendingUp className="h-5 w-5" strokeWidth={1.6} />}
          accentColor="purple"
          animationDelay={120}
        />
        <StatCard
          label="Átlag gólpasszok"
          value={avgTeamAssists}
          trendValue="góp./meccs"
          trend="neutral"
          icon={<Users className="h-5 w-5" strokeWidth={1.6} />}
          accentColor="orange"
          animationDelay={180}
        />
      </div>

      {/* Csapat vezetők */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-display uppercase tracking-wide">
            <Award className="text-positive h-5 w-5" strokeWidth={1.6} />
            Csapat vezetők
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-3 sm:p-4 bg-surface-2 rounded-lg border border-border-subtle">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="text-positive h-4 w-4" strokeWidth={1.6} />
                <span className="text-secondary text-xs font-display uppercase tracking-wide">Legjobb pontszerző</span>
              </div>
              <div className="text-primary mb-1 text-sm">{topScorer.name}</div>
              <div className="text-positive font-mono tabular-nums text-sm">
                {(topScorer.points / topScorer.gamesPlayed).toFixed(1)} PPG
              </div>
            </div>

            <div className="p-3 sm:p-4 bg-surface-2 rounded-lg border border-border-subtle">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="text-cyan h-4 w-4" strokeWidth={1.6} />
                <span className="text-secondary text-xs font-display uppercase tracking-wide">Legtöbb lepattanó</span>
              </div>
              <div className="text-primary mb-1 text-sm">{topRebounder.name}</div>
              <div className="text-cyan font-mono tabular-nums text-sm">
                {(topRebounder.rebounds.total / topRebounder.gamesPlayed).toFixed(1)} RPG
              </div>
            </div>

            <div className="p-3 sm:p-4 bg-surface-2 rounded-lg border border-border-subtle">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="text-ai h-4 w-4" strokeWidth={1.6} />
                <span className="text-secondary text-xs font-display uppercase tracking-wide">Legtöbb gólpassz</span>
              </div>
              <div className="text-primary mb-1 text-sm">{topAssister.name}</div>
              <div className="text-ai font-mono tabular-nums text-sm">
                {(topAssister.assists / topAssister.gamesPlayed).toFixed(1)} APG
              </div>
            </div>

            <div className="p-3 sm:p-4 bg-surface-2 rounded-lg border border-border-subtle">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="text-orange h-4 w-4" strokeWidth={1.6} />
                <span className="text-secondary text-xs font-display uppercase tracking-wide">Legjobb VAL</span>
              </div>
              <div className="text-primary mb-1 text-sm">{topValuation.name}</div>
              <div className="text-orange font-mono tabular-nums text-sm">
                {topValuation.valuation.toFixed(1)} VAL
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        {/* Csapat dobási statisztikák */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg font-display uppercase tracking-wide">
              Csapat Dobási Statisztikák
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250} className="text-xs sm:text-sm">
              <BarChart data={shootingStats}>
                <CartesianGrid strokeDasharray={CHART_GRID.strokeDashed} stroke={CHART_GRID.stroke} />
                <XAxis dataKey="category" stroke={CHART_AXIS.stroke} fontSize={12} />
                <YAxis stroke={CHART_AXIS.stroke} fontSize={12} />
                <Tooltip
                  contentStyle={RECHARTS_TOOLTIP_STYLE}
                  labelStyle={{ color: CHART_COLORS.primary }}
                />
                <Legend wrapperStyle={RECHARTS_LEGEND_STYLE} />
                <Bar dataKey="percentage" fill={CHART_COLORS.positive} name="Százalék %" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
              {shootingStats.map((stat, index) => (
                <div key={index} className="text-center text-xs sm:text-sm p-2 bg-surface-2 rounded">
                  <div className="text-muted text-xs font-display uppercase tracking-wide">{stat.category}</div>
                  <div className="text-primary font-mono tabular-nums">
                    {stat.made}/{stat.attempted}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pontok eloszlása pozíciónként */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg font-display uppercase tracking-wide">
              Pontok eloszlása pozíciónként
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={positionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => name && percent ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
                  outerRadius={100}
                  fill={CHART_COLORS.ai}
                  dataKey="points"
                  nameKey="position"
                >
                  {positionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={RECHARTS_TOOLTIP_STYLE}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Játékosok összehasonlítása */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg font-display uppercase tracking-wide">
            Legjobb játékosok összehasonlítása
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300} className="text-xs sm:text-sm">
            <BarChart data={playerComparison}>
              <CartesianGrid strokeDasharray={CHART_GRID.strokeDashed} stroke={CHART_GRID.stroke} />
              <XAxis dataKey="name" stroke={CHART_AXIS.stroke} fontSize={10} angle={-45} textAnchor="end" height={80} />
              <YAxis stroke={CHART_AXIS.stroke} fontSize={12} />
              <Tooltip
                contentStyle={RECHARTS_TOOLTIP_STYLE}
                labelStyle={{ color: CHART_COLORS.primary }}
              />
              <Legend wrapperStyle={RECHARTS_LEGEND_STYLE} />
              <Bar dataKey="Pontok" fill={CHART_COLORS.positive} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Lepattanók" fill={CHART_COLORS.cyan} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Gólpasszok" fill={CHART_COLORS.ai} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Legutóbbi meccsek */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg font-display uppercase tracking-wide">
            Legutóbbi meccsek
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 sm:space-y-3">
            {games.map((game) => (
              <div
                key={game.id}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 bg-surface-2 rounded-lg hover:bg-surface-3 transition-colors gap-2"
              >
                <div className="flex-1 w-full sm:w-auto">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-primary text-sm sm:text-base">{game.opponent}</span>
                    <span className={game.homeAway === 'home' ? 'badge-positive' : 'badge-neutral'}>
                      {game.homeAway === 'home' ? 'Hazai' : 'Vendég'}
                    </span>
                  </div>
                  <div className="text-muted text-xs sm:text-sm">{new Date(game.date).toLocaleDateString('hu-HU')}</div>
                </div>
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="text-primary text-lg sm:text-xl font-mono tabular-nums font-semibold">
                    {game.ourScore} - {game.oppScore}
                  </div>
                  <span className={game.result === 'win' ? 'badge-positive' : 'badge-negative'}>
                    {game.result === 'win' ? 'Győzelem' : 'Vereség'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
