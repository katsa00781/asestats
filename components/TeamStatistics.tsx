import type { PlayerStats, TeamGame, GameAggregate } from '@/lib/dashboard-types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Trophy, Target, TrendingUp, Users, Award, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

type TeamStatisticsProps = {
  players: PlayerStats[];
  games: TeamGame[];
  gameStats: GameAggregate;
  teamName?: string;
};

export function TeamStatistics({ players, games, gameStats, teamName }: TeamStatisticsProps) {
  // Ha nincsenek játékosok, jelenítünk meg egy üzenetet
  if (players.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Még nincsenek betöltött statisztikák.</p>
        <p className="text-slate-500 text-sm mt-2">Töltsd be a meccsadatokat a kezdéshez.</p>
      </div>
    );
  }

  const totalGames = games.length;
  const wins = games.filter((g) => g.result === 'win').length;
  const losses = totalGames - wins;
  const winPercentage = totalGames > 0 ? ((wins / totalGames) * 100).toFixed(1) : '0.0';

  // Csapat átlagok: A meccsenkénti összesített adatokból
  const avgTeamPoints = gameStats.avgPoints.toFixed(1);
  const avgTeamRebounds = gameStats.avgRebounds.toFixed(1);
  const avgTeamAssists = gameStats.avgAssists.toFixed(1);

  // Top játékosok
  const topScorer = [...players].sort((a, b) => b.points / b.gamesPlayed - a.points / a.gamesPlayed)[0];
  const topRebounder = [...players].sort((a, b) => b.rebounds.total / b.gamesPlayed - a.rebounds.total / a.gamesPlayed)[0];
  const topAssister = [...players].sort((a, b) => b.assists / b.gamesPlayed - a.assists / a.gamesPlayed)[0];
  const topValuation = [...players].sort((a, b) => b.valuation - a.valuation)[0];

  // Játékosok összehasonlítása
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

  // Pozíció szerinti pontok eloszlása
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

  const COLORS = ['#10b981', '#06b6d4', '#8b5cf6', '#f59e0b', '#ec4899'];

  // Dobási statisztikák összesítve
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
        <h2 className="text-slate-50 mb-2 text-xl sm:text-2xl">Csapat Statisztikák</h2>
        <p className="text-slate-400 text-sm sm:text-base">{teamName || 'Csapat'} teljesítménye</p>
      </div>

      {/* Összesítő kártyák */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-linear-to-br from-emerald-900/30 to-emerald-800/20 border-emerald-700/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm text-slate-400">Győzelmi arány</CardTitle>
            <Trophy className="text-emerald-400" size={16} />
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="text-slate-50 text-xl sm:text-2xl mb-1">{winPercentage}%</div>
            <p className="text-slate-500 text-xs sm:text-sm">
              {wins} győzelem - {losses} vereség
            </p>
          </CardContent>
        </Card>

        <Card className="bg-linear-to-br from-cyan-900/30 to-cyan-800/20 border-cyan-700/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm text-slate-400">Átlag pontok</CardTitle>
            <Target className="text-cyan-400" size={16} />
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="text-slate-50 text-xl sm:text-2xl mb-1">{avgTeamPoints}</div>
            <p className="text-slate-500 text-xs sm:text-sm">Pontok/Meccs</p>
          </CardContent>
        </Card>

        <Card className="bg-linear-to-br from-violet-900/30 to-violet-800/20 border-violet-700/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm text-slate-400">Átlag lepattanók</CardTitle>
            <TrendingUp className="text-violet-400" size={16} />
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="text-slate-50 text-xl sm:text-2xl mb-1">{avgTeamRebounds}</div>
            <p className="text-slate-500 text-xs sm:text-sm">Lepattanók/Meccs</p>
          </CardContent>
        </Card>

        <Card className="bg-linear-to-br from-orange-900/30 to-orange-800/20 border-orange-700/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm text-slate-400">Átlag gólpasszok</CardTitle>
            <Users className="text-orange-400" size={16} />
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="text-slate-50 text-xl sm:text-2xl mb-1">{avgTeamAssists}</div>
            <p className="text-slate-500 text-xs sm:text-sm">Gólpasszok/Meccs</p>
          </CardContent>
        </Card>
      </div>

      {/* Top játékosok */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-50 text-base sm:text-lg">
            <Award className="text-emerald-400" size={20} />
            Csapat vezetők
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-3 sm:p-4 bg-linear-to-br from-emerald-500/10 to-emerald-500/5 rounded-lg border border-emerald-500/30">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="text-emerald-400" size={16} />
                <span className="text-slate-400 text-xs sm:text-sm">Legjobb pontszerző</span>
              </div>
              <div className="text-slate-50 mb-1 text-sm sm:text-base">{topScorer.name}</div>
              <div className="text-emerald-400 text-sm sm:text-base">
                {(topScorer.points / topScorer.gamesPlayed).toFixed(1)} PPG
              </div>
            </div>

            <div className="p-3 sm:p-4 bg-linear-to-br from-cyan-500/10 to-cyan-500/5 rounded-lg border border-cyan-500/30">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="text-cyan-400" size={16} />
                <span className="text-slate-400 text-xs sm:text-sm">Legtöbb lepattanó</span>
              </div>
              <div className="text-slate-50 mb-1 text-sm sm:text-base">{topRebounder.name}</div>
              <div className="text-cyan-400 text-sm sm:text-base">
                {(topRebounder.rebounds.total / topRebounder.gamesPlayed).toFixed(1)} RPG
              </div>
            </div>

            <div className="p-3 sm:p-4 bg-linear-to-br from-violet-500/10 to-violet-500/5 rounded-lg border border-violet-500/30">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="text-violet-400" size={16} />
                <span className="text-slate-400 text-xs sm:text-sm">Legtöbb gólpassz</span>
              </div>
              <div className="text-slate-50 mb-1 text-sm sm:text-base">{topAssister.name}</div>
              <div className="text-violet-400 text-sm sm:text-base">
                {(topAssister.assists / topAssister.gamesPlayed).toFixed(1)} APG
              </div>
            </div>

            <div className="p-3 sm:p-4 bg-linear-to-br from-pink-500/10 to-pink-500/5 rounded-lg border border-pink-500/30">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="text-pink-400" size={16} />
                <span className="text-slate-400 text-xs sm:text-sm">Legjobb VAL</span>
              </div>
              <div className="text-slate-50 mb-1 text-sm sm:text-base">{topValuation.name}</div>
              <div className="text-pink-400 text-sm sm:text-base">{topValuation.valuation.toFixed(1)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        {/* Csapat dobási statisztikák */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-slate-50 text-base sm:text-lg">Csapat Dobási Statisztikák</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250} className="text-xs sm:text-sm">
              <BarChart data={shootingStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="category" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }}
                  labelStyle={{ color: '#e2e8f0' }}
                />
                <Legend wrapperStyle={{ color: '#94a3b8', fontSize: '12px' }} />
                <Bar dataKey="percentage" fill="#10b981" name="Százalék %" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
              {shootingStats.map((stat, index) => (
                <div key={index} className="text-center text-xs sm:text-sm p-2 bg-slate-800/50 rounded">
                  <div className="text-slate-500 text-xs">{stat.category}</div>
                  <div className="text-slate-300">
                    {stat.made}/{stat.attempted}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pontok eloszlása pozíciónként */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-slate-50 text-base sm:text-lg">Pontok eloszlása pozíciónként</CardTitle>
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
                  fill="#8884d8"
                  dataKey="points"
                  nameKey="position"
                >
                  {positionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Játékosok összehasonlítása */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-slate-50 text-base sm:text-lg">Legjobb játékosok összehasonlítása</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300} className="text-xs sm:text-sm">
            <BarChart data={playerComparison}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} angle={-45} textAnchor="end" height={80} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Legend wrapperStyle={{ color: '#94a3b8', fontSize: '12px' }} />
              <Bar dataKey="Pontok" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Lepattanók" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Gólpasszok" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Meccsek listája */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-slate-50 text-base sm:text-lg">Legutóbbi meccsek</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 sm:space-y-3">
            {games.map((game) => (
              <div
                key={game.id}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors gap-2"
              >
                <div className="flex-1 w-full sm:w-auto">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-slate-50 text-sm sm:text-base">{game.opponent}</span>
                    <Badge
                      variant={game.homeAway === 'home' ? 'default' : 'secondary'}
                      className={`text-xs ${
                        game.homeAway === 'home'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                          : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {game.homeAway === 'home' ? 'Hazai' : 'Vendég'}
                    </Badge>
                  </div>
                  <div className="text-slate-500 text-xs sm:text-sm">{new Date(game.date).toLocaleDateString('hu-HU')}</div>
                </div>
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="text-slate-50 text-lg sm:text-xl font-semibold">
                    {game.ourScore} - {game.oppScore}
                  </div>
                  <Badge
                    variant={game.result === 'win' ? 'default' : 'destructive'}
                    className={`text-xs ${
                      game.result === 'win'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-red-500/20 text-red-400 border-red-500/50'
                    }`}
                  >
                    {game.result === 'win' ? 'Győzelem' : 'Vereség'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
