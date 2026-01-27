'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type GameComparison = {
  game_id: string;
  date: string;
  opponent: string;
  home_away: string;
  our_score: number;
  opp_score: number;
  result: string;
  season_name: string;
  team_name: string;
  team_short_name: string;
  
  // Meccs statisztikák
  close_made: number;
  close_attempted: number;
  close_percentage: number;
  close_points: number;
  
  mid_made: number;
  mid_attempted: number;
  mid_percentage: number;
  mid_points: number;
  
  three_made: number;
  three_attempted: number;
  three_percentage: number;
  three_points: number;
  
  free_throw_made: number;
  free_throw_attempted: number;
  free_throw_percentage: number;
  free_throw_points: number;
  
  total_points: number;
  offensive_rebounds: number;
  defensive_rebounds: number;
  total_rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls_committed: number;
  valuation: number;
  
  // Szezon átlagok
  avg_close_attempted: number;
  avg_close_percentage: number;
  avg_close_points: number;
  avg_mid_attempted: number;
  avg_mid_percentage: number;
  avg_mid_points: number;
  avg_three_attempted: number;
  avg_three_percentage: number;
  avg_three_points: number;
  avg_free_throw_attempted: number;
  avg_free_throw_percentage: number;
  avg_free_throw_points: number;
  avg_total_points: number;
  
  // Különbségek
  close_points_diff: number;
  mid_points_diff: number;
  three_points_diff: number;
  free_throw_points_diff: number;
  total_points_diff: number;
  close_percentage_diff: number;
  mid_percentage_diff: number;
  three_percentage_diff: number;
  free_throw_percentage_diff: number;
};

type PlayerGameStat = {
  player_id: string;
  player_name: string;
  player_number: number;
  minutes: number;
  points: number;
  close_made: number;
  close_attempted: number;
  mid_made: number;
  mid_attempted: number;
  three_made: number;
  three_attempted: number;
  free_throw_made: number;
  free_throw_attempted: number;
  offensive_rebounds: number;
  defensive_rebounds: number;
  total_rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls_committed: number;
  plus_minus: number;
  valuation: number;
};

type GameDetailsProps = {
  gameId: string;
  onBack: () => void;
};

export function GameDetails({ gameId, onBack }: GameDetailsProps) {
  const [gameComparison, setGameComparison] = useState<GameComparison | null>(null);
  const [playerStats, setPlayerStats] = useState<PlayerGameStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGameDetails();
  }, [gameId]);

  const loadGameDetails = async () => {
    setLoading(true);
    try {
      // Meccs összehasonlító adatok
      const { data: comparisonData, error: comparisonError } = await supabase
        .from('game_vs_season_comparison')
        .select('*')
        .eq('game_id', gameId)
        .single();

      if (comparisonError) throw comparisonError;
      setGameComparison(comparisonData);

      // Játékos statisztikák
      const { data: playersData, error: playersError } = await supabase
        .from('player_game_stats')
        .select(`
          player_id,
          minutes,
          points,
          close_made,
          close_attempted,
          mid_made,
          mid_attempted,
          three_made,
          three_attempted,
          free_throw_made,
          free_throw_attempted,
          offensive_rebounds,
          defensive_rebounds,
          total_rebounds,
          assists,
          steals,
          blocks,
          turnovers,
          fouls_committed,
          plus_minus,
          valuation,
          players!inner(
            name,
            number
          )
        `)
        .eq('game_id', gameId)
        .order('points', { ascending: false });

      if (playersError) throw playersError;

      const formattedPlayerStats: PlayerGameStat[] = playersData.map((stat: any) => ({
        player_id: stat.player_id,
        player_name: stat.players.name,
        player_number: stat.players.number,
        minutes: stat.minutes,
        points: stat.points,
        close_made: stat.close_made,
        close_attempted: stat.close_attempted,
        mid_made: stat.mid_made,
        mid_attempted: stat.mid_attempted,
        three_made: stat.three_made,
        three_attempted: stat.three_attempted,
        free_throw_made: stat.free_throw_made,
        free_throw_attempted: stat.free_throw_attempted,
        offensive_rebounds: stat.offensive_rebounds,
        defensive_rebounds: stat.defensive_rebounds,
        total_rebounds: stat.total_rebounds,
        assists: stat.assists,
        steals: stat.steals,
        blocks: stat.blocks,
        turnovers: stat.turnovers,
        fouls_committed: stat.fouls_committed,
        plus_minus: stat.plus_minus,
        valuation: stat.valuation,
      }));

      setPlayerStats(formattedPlayerStats);
    } catch (error) {
      console.error('Hiba a meccs részletek betöltésekor:', error);
      toast.error('Nem sikerült betölteni a meccs részleteit');
    } finally {
      setLoading(false);
    }
  };

  const renderDiffIndicator = (diff: number) => {
    if (diff > 0) {
      return (
        <span className="text-emerald-400 flex items-center gap-1">
          <TrendingUp className="w-4 h-4" />
          +{diff.toFixed(1)}
        </span>
      );
    } else if (diff < 0) {
      return (
        <span className="text-red-400 flex items-center gap-1">
          <TrendingDown className="w-4 h-4" />
          {diff.toFixed(1)}
        </span>
      );
    } else {
      return (
        <span className="text-slate-500 flex items-center gap-1">
          <Minus className="w-4 h-4" />
          0
        </span>
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto"></div>
          <p className="mt-4 text-slate-400">Betöltés...</p>
        </div>
      </div>
    );
  }

  if (!gameComparison) {
    return (
      <div className="text-center p-8">
        <p className="text-slate-400">Nem található meccs adat</p>
        <Button onClick={onBack} className="mt-4 bg-emerald-600 hover:bg-emerald-700">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Vissza
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Button onClick={onBack} variant="outline" size="sm" className="border-slate-700 hover:bg-slate-800">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Vissza
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-slate-50">
            {gameComparison.team_short_name} vs {gameComparison.opponent}
          </h2>
          <p className="text-slate-400">
            {new Date(gameComparison.date).toLocaleDateString('hu-HU')} • {gameComparison.season_name}
          </p>
        </div>
        <Badge 
          className={`ml-auto ${gameComparison.result === 'win' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'} text-white`}
        >
          {gameComparison.our_score} - {gameComparison.opp_score}
        </Badge>
      </div>

      {/* Csapat dobás statisztikák vs átlag */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-slate-50">Dobás Statisztikák (Meccs vs Szezon Átlag)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left p-2 text-slate-300">Típus</th>
                  <th className="text-center p-2 text-slate-300">Kísérletek</th>
                  <th className="text-center p-2 text-slate-300">Hatékonyság %</th>
                  <th className="text-center p-2 text-slate-300">Átlag %</th>
                  <th className="text-center p-2 text-slate-300">Pontérték</th>
                  <th className="text-center p-2 text-slate-300">Pontok</th>
                  <th className="text-center p-2 text-slate-300">Átlag Pontok</th>
                  <th className="text-center p-2 text-slate-300">Különbség</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-700 hover:bg-slate-800/50">
                  <td className="p-2 font-medium text-slate-200">Közeli</td>
                  <td className="text-center p-2 text-slate-300">{gameComparison.close_attempted}</td>
                  <td className="text-center p-2 text-slate-300">{gameComparison.close_percentage}%</td>
                  <td className="text-center p-2 text-slate-500">{gameComparison.avg_close_percentage}%</td>
                  <td className="text-center p-2 text-slate-300">2</td>
                  <td className="text-center p-2 font-semibold text-slate-50">{gameComparison.close_points}</td>
                  <td className="text-center p-2 text-slate-500">{gameComparison.avg_close_points}</td>
                  <td className="text-center p-2">{renderDiffIndicator(gameComparison.close_points_diff)}</td>
                </tr>
                <tr className="border-b border-slate-700 hover:bg-slate-800/50">
                  <td className="p-2 font-medium text-slate-200">Középtávoli</td>
                  <td className="text-center p-2 text-slate-300">{gameComparison.mid_attempted}</td>
                  <td className="text-center p-2 text-slate-300">{gameComparison.mid_percentage}%</td>
                  <td className="text-center p-2 text-slate-500">{gameComparison.avg_mid_percentage}%</td>
                  <td className="text-center p-2 text-slate-300">2</td>
                  <td className="text-center p-2 font-semibold text-slate-50">{gameComparison.mid_points}</td>
                  <td className="text-center p-2 text-slate-500">{gameComparison.avg_mid_points}</td>
                  <td className="text-center p-2">{renderDiffIndicator(gameComparison.mid_points_diff)}</td>
                </tr>
                <tr className="border-b border-slate-700 hover:bg-slate-800/50">
                  <td className="p-2 font-medium text-slate-200">3 pontos</td>
                  <td className="text-center p-2 text-slate-300">{gameComparison.three_attempted}</td>
                  <td className="text-center p-2 text-slate-300">{gameComparison.three_percentage}%</td>
                  <td className="text-center p-2 text-slate-500">{gameComparison.avg_three_percentage}%</td>
                  <td className="text-center p-2 text-slate-300">3</td>
                  <td className="text-center p-2 font-semibold text-slate-50">{gameComparison.three_points}</td>
                  <td className="text-center p-2 text-slate-500">{gameComparison.avg_three_points}</td>
                  <td className="text-center p-2">{renderDiffIndicator(gameComparison.three_points_diff)}</td>
                </tr>
                <tr className="border-b border-slate-700 hover:bg-slate-800/50">
                  <td className="p-2 font-medium text-slate-200">Büntető</td>
                  <td className="text-center p-2 text-slate-300">{gameComparison.free_throw_attempted}</td>
                  <td className="text-center p-2 text-slate-300">{gameComparison.free_throw_percentage}%</td>
                  <td className="text-center p-2 text-slate-500">{gameComparison.avg_free_throw_percentage}%</td>
                  <td className="text-center p-2 text-slate-300">1</td>
                  <td className="text-center p-2 font-semibold text-slate-50">{gameComparison.free_throw_points}</td>
                  <td className="text-center p-2 text-slate-500">{gameComparison.avg_free_throw_points}</td>
                  <td className="text-center p-2">{renderDiffIndicator(gameComparison.free_throw_points_diff)}</td>
                </tr>
                <tr className="bg-slate-800/80 font-bold">
                  <td className="p-2 text-slate-100" colSpan={5}>Összes pont</td>
                  <td className="text-center p-2 text-slate-50">{gameComparison.total_points}</td>
                  <td className="text-center p-2 text-slate-400">{gameComparison.avg_total_points}</td>
                  <td className="text-center p-2">{renderDiffIndicator(gameComparison.total_points_diff)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Egyéb csapat statisztikák */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-slate-50">Egyéb Csapat Statisztikák</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-slate-800/50 rounded border border-slate-700">
              <div className="text-2xl font-bold text-slate-50">{gameComparison.total_rebounds}</div>
              <div className="text-sm text-slate-400">Lepattanó</div>
              <div className="text-xs text-slate-500">
                ({gameComparison.offensive_rebounds} TLP / {gameComparison.defensive_rebounds} VLP)
              </div>
            </div>
            <div className="text-center p-4 bg-slate-800/50 rounded border border-slate-700">
              <div className="text-2xl font-bold text-slate-50">{gameComparison.assists}</div>
              <div className="text-sm text-slate-400">Gólpassz</div>
            </div>
            <div className="text-center p-4 bg-slate-800/50 rounded border border-slate-700">
              <div className="text-2xl font-bold text-slate-50">{gameComparison.steals}</div>
              <div className="text-sm text-slate-400">Labdaszerzés</div>
            </div>
            <div className="text-center p-4 bg-slate-800/50 rounded border border-slate-700">
              <div className="text-2xl font-bold text-slate-50">{gameComparison.blocks}</div>
              <div className="text-sm text-slate-400">Blokkolt dobás</div>
            </div>
            <div className="text-center p-4 bg-slate-800/50 rounded border border-slate-700">
              <div className="text-2xl font-bold text-slate-50">{gameComparison.turnovers}</div>
              <div className="text-sm text-slate-400">Labdavesztés</div>
            </div>
            <div className="text-center p-4 bg-slate-800/50 rounded border border-slate-700">
              <div className="text-2xl font-bold text-slate-50">{gameComparison.fouls_committed}</div>
              <div className="text-sm text-slate-400">Szabálytalanság</div>
            </div>
            <div className="text-center p-4 bg-slate-800/50 rounded border border-slate-700">
              <div className="text-2xl font-bold text-slate-50">{gameComparison.valuation}</div>
              <div className="text-sm text-slate-400">Értékelés</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Játékos statisztikák */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-slate-50">Játékos Teljesítmények</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left p-2 text-slate-300">Játékos</th>
                  <th className="text-center p-2 text-slate-300">Perc</th>
                  <th className="text-center p-2 text-slate-300">Pont</th>
                  <th className="text-center p-2 text-slate-300">Közeli</th>
                  <th className="text-center p-2 text-slate-300">Közép</th>
                  <th className="text-center p-2 text-slate-300">3pt</th>
                  <th className="text-center p-2 text-slate-300">Büntető</th>
                  <th className="text-center p-2 text-slate-300">LP</th>
                  <th className="text-center p-2 text-slate-300">GP</th>
                  <th className="text-center p-2 text-slate-300">LS</th>
                  <th className="text-center p-2 text-slate-300">BD</th>
                  <th className="text-center p-2 text-slate-300">LV</th>
                  <th className="text-center p-2 text-slate-300">SZ</th>
                  <th className="text-center p-2 text-slate-300">±</th>
                  <th className="text-center p-2 text-slate-300">ÉRT</th>
                </tr>
              </thead>
              <tbody>
                {playerStats.map((player) => (
                  <tr key={player.player_id} className="border-b border-slate-700 hover:bg-slate-800/50">
                    <td className="p-2 font-medium text-slate-200">
                      #{player.player_number} {player.player_name}
                    </td>
                    <td className="text-center p-2 text-slate-300">{player.minutes}</td>
                    <td className="text-center p-2 font-semibold text-emerald-400">{player.points}</td>
                    <td className="text-center p-2 text-xs text-slate-400">
                      {player.close_made}/{player.close_attempted}
                    </td>
                    <td className="text-center p-2 text-xs text-slate-400">
                      {player.mid_made}/{player.mid_attempted}
                    </td>
                    <td className="text-center p-2 text-xs text-slate-400">
                      {player.three_made}/{player.three_attempted}
                    </td>
                    <td className="text-center p-2 text-xs text-slate-400">
                      {player.free_throw_made}/{player.free_throw_attempted}
                    </td>
                    <td className="text-center p-2 text-slate-300">{player.total_rebounds}</td>
                    <td className="text-center p-2 text-slate-300">{player.assists}</td>
                    <td className="text-center p-2 text-slate-300">{player.steals}</td>
                    <td className="text-center p-2 text-slate-300">{player.blocks}</td>
                    <td className="text-center p-2 text-slate-300">{player.turnovers}</td>
                    <td className="text-center p-2 text-slate-300">{player.fouls_committed}</td>
                    <td className={`text-center p-2 font-medium ${player.plus_minus >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {player.plus_minus > 0 ? '+' : ''}{player.plus_minus}
                    </td>
                    <td className="text-center p-2 font-semibold text-slate-50">{player.valuation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            LP = Lepattanó, GP = Gólpassz, LS = Labdaszerzés, BD = Blokkolt dobás, 
            LV = Labdavesztés, SZ = Szabálytalanság, ± = Plusz-mínusz, ÉRT = Értékelés
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
