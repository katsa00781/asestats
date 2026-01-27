import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ArrowLeftRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';

type Season = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
};

type PlayerSeasonStats = {
  player_id: string;
  name: string;
  number: number;
  position: string;
  season_id: string;
  season_name: string;
  is_current: boolean;
  games_played: number;
  total_points: number;
  total_minutes: number;
  total_rebounds: number;
  total_assists: number;
  total_steals: number;
  total_blocks: number;
  total_turnovers: number;
  total_valuation: number;
  avg_valuation: number;
  // Dobások
  total_close_made: number;
  total_close_attempted: number;
  total_mid_made: number;
  total_mid_attempted: number;
  total_three_made: number;
  total_three_attempted: number;
  total_free_throw_made: number;
  total_free_throw_attempted: number;
  total_offensive_rebounds: number;
  total_defensive_rebounds: number;
};

type ComparisonData = {
  stat: string;
  label: string;
  season1: number;
  season2: number;
  diff: number;
  diffPercent: number;
};

export function SeasonComparison() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason1, setSelectedSeason1] = useState<string>('');
  const [selectedSeason2, setSelectedSeason2] = useState<string>('');
  const [selectedPlayer, setSelectedPlayer] = useState<string>('');
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [players, setPlayers] = useState<{ id: string; name: string; number: number; team_id: string }[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [stats1, setStats1] = useState<PlayerSeasonStats | null>(null);
  const [stats2, setStats2] = useState<PlayerSeasonStats | null>(null);
  const [loading, setLoading] = useState(false);

  // Szezonok betöltése
  useEffect(() => {
    async function fetchSeasons() {
      const { data, error } = await supabase
        .from('seasons')
        .select('*')
        .order('start_date', { ascending: false });

      if (data && !error) {
        setSeasons(data);
        // Alapértelmezett: jelenlegi szezon
        const current = data.find(s => s.is_current);
        if (current) {
          setSelectedSeason1(current.id);
          // Előző szezon
          const prevIndex = data.findIndex(s => s.id === current.id) + 1;
          if (prevIndex < data.length) {
            setSelectedSeason2(data[prevIndex].id);
          }
        }
      }
    }
    fetchSeasons();
  }, []);

  // Játékosok és csapatok betöltése
  useEffect(() => {
    async function fetchData() {
      // Csapatok betöltése
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('id, name')
        .order('is_primary', { ascending: false })
        .order('name');

      if (teamsData && !teamsError) {
        setTeams(teamsData);
      }

      // Játékosok betöltése
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('id, name, number, team_id')
        .order('number');

      if (playersData && !playersError) {
        setPlayers(playersData);
      }
    }
    fetchData();
  }, []);

  // Összehasonlítás betöltése
  async function loadComparison() {
    if (!selectedPlayer || !selectedSeason1 || !selectedSeason2) return;

    setLoading(true);
    try {
      // Season 1 stats
      const { data: data1 } = await supabase
        .from('player_season_stats_by_season')
        .select('*')
        .eq('player_id', selectedPlayer)
        .eq('season_id', selectedSeason1)
        .single();

      // Season 2 stats
      const { data: data2 } = await supabase
        .from('player_season_stats_by_season')
        .select('*')
        .eq('player_id', selectedPlayer)
        .eq('season_id', selectedSeason2)
        .single();

      setStats1(data1);
      setStats2(data2);
    } catch (error) {
      console.error('Error loading comparison:', error);
    } finally {
      setLoading(false);
    }
  }

  // Összehasonlítási adatok számítása
  const getComparisonData = (): ComparisonData[] => {
    if (!stats1 || !stats2) return [];

    const calculate = (label: string, stat: keyof PlayerSeasonStats, useAverage: boolean = true): ComparisonData => {
      // Ha már átlag (pl. avg_valuation), akkor nem osztunk games_played-del
      const val1 = useAverage ? (stats1[stat] as number) / (stats1.games_played || 1) : (stats1[stat] as number);
      const val2 = useAverage ? (stats2[stat] as number) / (stats2.games_played || 1) : (stats2[stat] as number);
      const diff = val1 - val2;
      const diffPercent = val2 !== 0 ? ((diff / val2) * 100) : 0;

      return {
        stat,
        label,
        season1: val1,
        season2: val2,
        diff,
        diffPercent,
      };
    };

    return [
      calculate('Pontok/Meccs', 'total_points'),
      calculate('Lepattanók/Meccs', 'total_rebounds'),
      calculate('Gólpasszok/Meccs', 'total_assists'),
      calculate('Labdaszerzés/Meccs', 'total_steals'),
      calculate('Blokkolt/Meccs', 'total_blocks'),
      calculate('Valuation/Meccs', 'avg_valuation', false), // avg_valuation már átlag, nem kell osztani
    ];
  };

  const comparisonData = getComparisonData();

  const getTrendIcon = (diff: number) => {
    if (diff > 0.5) return <TrendingUp className="text-emerald-400" size={16} />;
    if (diff < -0.5) return <TrendingDown className="text-red-400" size={16} />;
    return <Minus className="text-slate-400" size={16} />;
  };

  const getDiffColor = (diff: number) => {
    if (diff > 0.5) return 'text-emerald-400';
    if (diff < -0.5) return 'text-red-400';
    return 'text-slate-400';
  };

  return (
    <div className="space-y-6">
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-50">
            <ArrowLeftRight className="text-orange-400" size={20} />
            Szezon Összehasonlítás
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Csapat szűrő */}
          <div>
            <label className="text-sm text-slate-400 mb-2 block">Csapat</label>
            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger className="bg-slate-800 border-slate-700">
                <SelectValue placeholder="Válassz csapatot..." />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">
                  Összes csapat
                </SelectItem>
                {teams.map(team => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Játékos választó */}
          <div>
            <label className="text-sm text-slate-400 mb-2 block">Játékos</label>
            <Select value={selectedPlayer} onValueChange={setSelectedPlayer}>
              <SelectTrigger className="bg-slate-800 border-slate-700">
                <SelectValue placeholder="Válassz játékost..." />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {players
                  .filter(p => selectedTeam === 'all' || p.team_id === selectedTeam)
                  .map(player => (
                    <SelectItem key={player.id} value={player.id}>
                      #{player.number} - {player.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Szezonok választása */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-400 mb-2 block">1. Szezon</label>
              <Select value={selectedSeason1} onValueChange={setSelectedSeason1}>
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue placeholder="Válassz szezont..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {seasons.map(season => (
                    <SelectItem key={season.id} value={season.id}>
                      {season.name} {season.is_current && '(Jelenlegi)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-slate-400 mb-2 block">2. Szezon</label>
              <Select value={selectedSeason2} onValueChange={setSelectedSeason2}>
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue placeholder="Válassz szezont..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {seasons.map(season => (
                    <SelectItem key={season.id} value={season.id}>
                      {season.name} {season.is_current && '(Jelenlegi)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            onClick={loadComparison}
            disabled={!selectedPlayer || !selectedSeason1 || !selectedSeason2 || loading}
            className="w-full bg-orange-600 hover:bg-orange-700"
          >
            {loading ? 'Betöltés...' : 'Összehasonlítás'}
          </Button>
        </CardContent>
      </Card>

      {/* Összehasonlítási eredmények */}
      {stats1 && stats2 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-slate-50">
              {stats1.name} - Statisztikai Összehasonlítás
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Összefoglaló információk */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 bg-slate-800/50 rounded-lg">
                <div className="text-xs text-slate-400">Szezon</div>
                <div className="text-slate-200 font-semibold">{stats1.season_name}</div>
              </div>
              <div className="p-4 bg-slate-800/50 rounded-lg">
                <div className="text-xs text-slate-400">Meccsek</div>
                <div className="text-slate-200 font-semibold">{stats1.games_played}</div>
              </div>
              <div className="p-4 bg-slate-800/50 rounded-lg">
                <div className="text-xs text-slate-400">Szezon</div>
                <div className="text-slate-200 font-semibold">{stats2.season_name}</div>
              </div>
              <div className="p-4 bg-slate-800/50 rounded-lg">
                <div className="text-xs text-slate-400">Meccsek</div>
                <div className="text-slate-200 font-semibold">{stats2.games_played}</div>
              </div>
            </div>

            {/* Összehasonlító táblázat */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 text-slate-400 font-medium">Statisztika</th>
                    <th className="text-center py-3 text-slate-400 font-medium">{stats1.season_name}</th>
                    <th className="text-center py-3 text-slate-400 font-medium">{stats2.season_name}</th>
                    <th className="text-center py-3 text-slate-400 font-medium">Változás</th>
                    <th className="text-center py-3 text-slate-400 font-medium">%</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300">
                  {comparisonData.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/50">
                      <td className="py-3 text-slate-300">{item.label}</td>
                      <td className="text-center py-3 font-semibold">{item.season1.toFixed(1)}</td>
                      <td className="text-center py-3 font-semibold">{item.season2.toFixed(1)}</td>
                      <td className={`text-center py-3 font-semibold ${getDiffColor(item.diff)}`}>
                        <div className="flex items-center justify-center gap-1">
                          {getTrendIcon(item.diff)}
                          {item.diff > 0 ? '+' : ''}{item.diff.toFixed(1)}
                        </div>
                      </td>
                      <td className={`text-center py-3 font-semibold ${getDiffColor(item.diff)}`}>
                        {item.diffPercent > 0 ? '+' : ''}{item.diffPercent.toFixed(0)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
