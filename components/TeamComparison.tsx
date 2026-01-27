'use client';
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

type TeamStats = {
  teamId: string;
  teamName: string;
  seasonId: string;
  seasonName: string;
  totalGames: number;
  wins: number;
  losses: number;
  winPercentage: number;
  avgPoints: number;
  avgOppPoints: number;
  avgRebounds: number;
  avgAssists: number;
  avgSteals: number;
  avgBlocks: number;
  avgTurnovers: number;
  avgValuation: number;
};

type TeamComparisonProps = {
  allSeasons: { id: string; name: string }[];
  allTeams: { id: string; name: string }[];
  currentSeasonId: string | null;
  currentTeamId: string | null;
  onBack: () => void;
};

export function TeamComparison({ 
  allSeasons, 
  allTeams,
  currentSeasonId,
  currentTeamId,
  onBack 
}: TeamComparisonProps) {
  const [selectedTeams, setSelectedTeams] = useState<TeamStats[]>([]);
  const [availableTeams, setAvailableTeams] = useState<TeamStats[]>([]);
  const [filterSeasonId, setFilterSeasonId] = useState<string>(currentSeasonId || 'all');
  const [loading, setLoading] = useState(false);

  // Csapatok statisztikáinak betöltése
  useEffect(() => {
    loadTeamStats();
  }, [filterSeasonId]);

  const loadTeamStats = async () => {
    setLoading(true);
    try {
      // Lekérdezzük a meccseket
      let gamesQuery = supabase
        .from('games')
        .select('*')
        .order('date', { ascending: false });

      if (filterSeasonId !== 'all') {
        gamesQuery = gamesQuery.eq('season_id', filterSeasonId);
      }

      const { data: games, error: gamesError } = await gamesQuery;
      if (gamesError) throw gamesError;

      // Lekérdezzük a player_game_stats-t CSAK a lekérdezett meccsekhez
      const gameIds = games?.map(g => g.id) || [];
      
      const { data: allStats, error: statsError } = await supabase
        .from('player_game_stats')
        .select('game_id, points, total_rebounds, assists, steals, blocks, turnovers, valuation')
        .in('game_id', gameIds);

      if (statsError) throw statsError;

      // Csoportosítás csapat + szezon szerint
      const teamStatsMap = new Map<string, TeamStats>();

      games?.forEach(game => {
        const key = `${game.our_team_id}_${game.season_id}`;
        
        if (!teamStatsMap.has(key)) {
          const team = allTeams.find(t => t.id === game.our_team_id);
          const season = allSeasons.find(s => s.id === game.season_id);
          
          teamStatsMap.set(key, {
            teamId: game.our_team_id,
            teamName: team?.name || 'Ismeretlen csapat',
            seasonId: game.season_id,
            seasonName: season?.name || 'Ismeretlen szezon',
            totalGames: 0,
            wins: 0,
            losses: 0,
            winPercentage: 0,
            avgPoints: 0,
            avgOppPoints: 0,
            avgRebounds: 0,
            avgAssists: 0,
            avgSteals: 0,
            avgBlocks: 0,
            avgTurnovers: 0,
            avgValuation: 0,
          });
        }

        const teamStats = teamStatsMap.get(key)!;
        teamStats.totalGames++;
        
        if (game.result === 'win') {
          teamStats.wins++;
        } else {
          teamStats.losses++;
        }

        teamStats.avgPoints += game.our_score;
        teamStats.avgOppPoints += game.opp_score;

        // Összesítjük a játékos statisztikákat ehhez a meccshez
        const gameStats = allStats?.filter(s => s.game_id === game.id) || [];
        gameStats.forEach(stat => {
          teamStats.avgRebounds += stat.total_rebounds || 0;
          teamStats.avgAssists += stat.assists || 0;
          teamStats.avgSteals += stat.steals || 0;
          teamStats.avgBlocks += stat.blocks || 0;
          teamStats.avgTurnovers += stat.turnovers || 0;
          teamStats.avgValuation += stat.valuation || 0;
        });
      });

      // Átlagok számítása
      const teams = Array.from(teamStatsMap.values()).map(team => {
        if (team.totalGames > 0) {
          team.winPercentage = (team.wins / team.totalGames) * 100;
          team.avgPoints = team.avgPoints / team.totalGames;
          team.avgOppPoints = team.avgOppPoints / team.totalGames;
          team.avgRebounds = team.avgRebounds / team.totalGames;
          team.avgAssists = team.avgAssists / team.totalGames;
          team.avgSteals = team.avgSteals / team.totalGames;
          team.avgBlocks = team.avgBlocks / team.totalGames;
          team.avgTurnovers = team.avgTurnovers / team.totalGames;
          team.avgValuation = team.avgValuation / team.totalGames;
        }
        return team;
      });

      setAvailableTeams(teams);
    } catch (error) {
      console.error('Error loading team stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTeam = (team: TeamStats) => {
    if (selectedTeams.length < 4 && !selectedTeams.find(t => t.teamId === team.teamId && t.seasonId === team.seasonId)) {
      setSelectedTeams([...selectedTeams, team]);
    }
  };

  const handleRemoveTeam = (team: TeamStats) => {
    setSelectedTeams(selectedTeams.filter(t => !(t.teamId === team.teamId && t.seasonId === team.seasonId)));
  };

  // Normalizálás radar chart-hoz (0-100 skálára)
  const normalizeValue = (value: number, max: number): number => {
    return max > 0 ? (value / max) * 100 : 0;
  };

  const getRadarData = () => {
    if (selectedTeams.length === 0) return [];

    const maxWinPct = Math.max(...selectedTeams.map(t => t.winPercentage), 100);
    const maxPoints = Math.max(...selectedTeams.map(t => t.avgPoints));
    const maxRebounds = Math.max(...selectedTeams.map(t => t.avgRebounds));
    const maxAssists = Math.max(...selectedTeams.map(t => t.avgAssists));
    const maxValuation = Math.max(...selectedTeams.map(t => t.avgValuation));

    const categories = [
      { name: 'Győzelem%', key: 'winPercentage', max: maxWinPct },
      { name: 'Pontok', key: 'avgPoints', max: maxPoints },
      { name: 'Lepattanók', key: 'avgRebounds', max: maxRebounds },
      { name: 'Gólpasszok', key: 'avgAssists', max: maxAssists },
      { name: 'Értékelés', key: 'avgValuation', max: maxValuation },
    ];

    return categories.map(cat => {
      const entry: any = { category: cat.name };
      selectedTeams.forEach((team, idx) => {
        entry[`team${idx}`] = normalizeValue((team as any)[cat.key], cat.max);
      });
      return entry;
    });
  };

  const getBarData = () => {
    return selectedTeams.map(team => ({
      name: team.teamName,
      'Győz.%': parseFloat(team.winPercentage.toFixed(1)),
      'Pontok': parseFloat(team.avgPoints.toFixed(1)),
      'Lepattanók': parseFloat(team.avgRebounds.toFixed(1)),
      'Gólpasszok': parseFloat(team.avgAssists.toFixed(1)),
    }));
  };

  const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-slate-50 mb-2 text-xl sm:text-2xl">Csapatok Összehasonlítása</h2>
          <p className="text-slate-400 text-sm">Válassz maximum 4 csapatot az összehasonlításhoz</p>
        </div>
        <Button onClick={onBack} variant="outline" size="sm" className="gap-2">
          <ArrowLeft size={16} />
          Vissza
        </Button>
      </div>

      {/* Szűrők */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            {/* Szezon szűrő */}
            <div className="flex flex-col gap-2 flex-1 min-w-[200px]">
              <label className="text-slate-400 text-sm">Szezon</label>
              <select
                value={filterSeasonId}
                onChange={(e) => setFilterSeasonId(e.target.value)}
                className="bg-slate-700 text-slate-100 border border-slate-600 rounded px-3 py-2 text-sm"
              >
                <option value="all">Minden szezon</option>
                {allSeasons.map(season => (
                  <option key={season.id} value={season.id}>{season.name}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Kiválasztott csapatok */}
      {selectedTeams.length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-slate-100 text-lg">Kiválasztott csapatok ({selectedTeams.length}/4)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {selectedTeams.map((team, idx) => (
                <Badge 
                  key={`${team.teamId}_${team.seasonId}`}
                  className="px-3 py-1.5 text-sm gap-2"
                  style={{ backgroundColor: colors[idx] }}
                >
                  {team.teamName} - {team.seasonName}
                  <button onClick={() => handleRemoveTeam(team)}>
                    <X size={14} />
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Összehasonlító grafikonok */}
      {selectedTeams.length >= 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Radar Chart */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-slate-100">Átfogó összehasonlítás</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={getRadarData()}>
                  <PolarGrid stroke="#475569" />
                  <PolarAngleAxis dataKey="category" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#94a3b8' }} />
                  {selectedTeams.map((_, idx) => (
                    <Radar
                      key={idx}
                      name={selectedTeams[idx].teamName}
                      dataKey={`team${idx}`}
                      stroke={colors[idx]}
                      fill={colors[idx]}
                      fillOpacity={0.3}
                    />
                  ))}
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Bar Chart */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-slate-100">Főbb mutatók</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={getBarData()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#94a3b8' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                    labelStyle={{ color: '#f1f5f9' }}
                  />
                  <Legend />
                  <Bar dataKey="Győz.%" fill="#10b981" />
                  <Bar dataKey="Pontok" fill="#3b82f6" />
                  <Bar dataKey="Lepattanók" fill="#f59e0b" />
                  <Bar dataKey="Gólpasszok" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Részletes statisztikák táblázat */}
      {selectedTeams.length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-slate-100">Részletes statisztikák</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-2 text-slate-400 font-medium">Csapat</th>
                    <th className="text-center py-3 px-2 text-slate-400 font-medium">Meccsek</th>
                    <th className="text-center py-3 px-2 text-slate-400 font-medium">Győz.</th>
                    <th className="text-center py-3 px-2 text-slate-400 font-medium">Veres.</th>
                    <th className="text-center py-3 px-2 text-slate-400 font-medium">Győz.%</th>
                    <th className="text-center py-3 px-2 text-slate-400 font-medium">Átl. Pont</th>
                    <th className="text-center py-3 px-2 text-slate-400 font-medium">Átl. Kap.Pont</th>
                    <th className="text-center py-3 px-2 text-slate-400 font-medium">Lep.</th>
                    <th className="text-center py-3 px-2 text-slate-400 font-medium">Gólp.</th>
                    <th className="text-center py-3 px-2 text-slate-400 font-medium">Lop.</th>
                    <th className="text-center py-3 px-2 text-slate-400 font-medium">Block</th>
                    <th className="text-center py-3 px-2 text-slate-400 font-medium">Ért.</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTeams.map((team, idx) => (
                    <tr key={`${team.teamId}_${team.seasonId}`} className="border-b border-slate-700/50">
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: colors[idx] }}
                          />
                          <div>
                            <div className="text-slate-100 font-medium">{team.teamName}</div>
                            <div className="text-slate-500 text-xs">{team.seasonName}</div>
                          </div>
                        </div>
                      </td>
                      <td className="text-center py-3 px-2 text-slate-300">{team.totalGames}</td>
                      <td className="text-center py-3 px-2 text-emerald-400">{team.wins}</td>
                      <td className="text-center py-3 px-2 text-red-400">{team.losses}</td>
                      <td className="text-center py-3 px-2 text-slate-100 font-medium">{team.winPercentage.toFixed(1)}%</td>
                      <td className="text-center py-3 px-2 text-slate-300">{team.avgPoints.toFixed(1)}</td>
                      <td className="text-center py-3 px-2 text-slate-300">{team.avgOppPoints.toFixed(1)}</td>
                      <td className="text-center py-3 px-2 text-slate-300">{team.avgRebounds.toFixed(1)}</td>
                      <td className="text-center py-3 px-2 text-slate-300">{team.avgAssists.toFixed(1)}</td>
                      <td className="text-center py-3 px-2 text-slate-300">{team.avgSteals.toFixed(1)}</td>
                      <td className="text-center py-3 px-2 text-slate-300">{team.avgBlocks.toFixed(1)}</td>
                      <td className="text-center py-3 px-2 text-slate-100 font-medium">{team.avgValuation.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Elérhető csapatok */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-slate-100">Csapatok listája</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-slate-400 text-center py-8">Betöltés...</p>
          ) : availableTeams.length === 0 ? (
            <p className="text-slate-400 text-center py-8">Nincsenek elérhető csapatok.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {availableTeams.map(team => {
                const isSelected = selectedTeams.some(t => t.teamId === team.teamId && t.seasonId === team.seasonId);
                return (
                  <button
                    key={`${team.teamId}_${team.seasonId}`}
                    onClick={() => handleSelectTeam(team)}
                    disabled={isSelected || selectedTeams.length >= 4}
                    className={`text-left p-4 rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-slate-700/50 border-slate-600 opacity-50 cursor-not-allowed'
                        : 'bg-slate-700/30 border-slate-600 hover:bg-slate-700/50 hover:border-slate-500'
                    }`}
                  >
                    <div className="text-slate-100 font-medium mb-1">{team.teamName}</div>
                    <div className="text-slate-400 text-xs mb-2">{team.seasonName}</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="text-slate-500">
                        <span className="text-slate-400">{team.totalGames}</span> meccs
                      </div>
                      <div className="text-slate-500">
                        <span className="text-emerald-400">{team.winPercentage.toFixed(0)}%</span> győz.
                      </div>
                      <div className="text-slate-500">
                        <span className="text-slate-400">{team.avgPoints.toFixed(1)}</span> pont
                      </div>
                      <div className="text-slate-500">
                        <span className="text-slate-400">{team.avgValuation.toFixed(0)}</span> VAL
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
