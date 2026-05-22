'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, FileText, Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { GamePbpCharts } from './GamePbpCharts';
import { buildPlayerPostGameReport } from '@/lib/player-postgame';
import type { PlayerPostGameBreakdown } from '@/lib/player-postgame';
import type { PlayerGameStat as LibPlayerGameStat, Position } from '@/lib/postgame-report';

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
  player_position: string | null;
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

type PlayerGameStatsRow = {
  player_id: string;
  minutes: number | null;
  points: number | null;
  close_made: number | null;
  close_attempted: number | null;
  mid_made: number | null;
  mid_attempted: number | null;
  three_made: number | null;
  three_attempted: number | null;
  free_throw_made: number | null;
  free_throw_attempted: number | null;
  offensive_rebounds: number | null;
  defensive_rebounds: number | null;
  total_rebounds: number | null;
  assists: number | null;
  steals: number | null;
  blocks: number | null;
  turnovers: number | null;
  fouls_committed: number | null;
  plus_minus: number | null;
  valuation: number | null;
  players: { name: string; number: number; position: string | null } | { name: string; number: number; position: string | null }[];
};

type TextReport = {
  id: string;
  report_type: 'pregame' | 'postgame' | 'combined';
  narrative: string;
  generated_at: string;
};

type QuarterStatRow = {
  team_side: 'home' | 'away' | 'unknown';
  quarter: number;
  points: number | null;
};

const mapPosition = (pos: string | null): Position => {
  if (pos === 'C') return 'C';
  if (pos === 'F') return 'SF';
  return 'PG';
};

const impactBadgeClass = (impactClass: PlayerPostGameBreakdown['impactClass']) => {
  switch (impactClass) {
    case 'mvp': return 'bg-amber-600 hover:bg-amber-700 text-white';
    case 'engine': return 'bg-emerald-700 hover:bg-emerald-800 text-white';
    case 'support': return 'bg-blue-700 hover:bg-blue-800 text-white';
    default: return 'bg-slate-600 hover:bg-slate-700 text-white';
  }
};

export function GameDetails({ gameId, onBack }: GameDetailsProps) {
  const [gameComparison, setGameComparison] = useState<GameComparison | null>(null);
  const [playerStats, setPlayerStats] = useState<PlayerGameStat[]>([]);
  const [textReports, setTextReports] = useState<TextReport[]>([]);
  const [quarterStats, setQuarterStats] = useState<QuarterStatRow[]>([]);
  const [ourSide, setOurSide] = useState<'home' | 'away'>('home');
  const [loading, setLoading] = useState(true);
  const [playerBreakdowns, setPlayerBreakdowns] = useState<PlayerPostGameBreakdown[]>([]);
  const [playerTexts, setPlayerTexts] = useState<Record<string, string>>({});
  const [generatingPlayerTexts, setGeneratingPlayerTexts] = useState(false);

  const loadGameDetails = useCallback(async () => {
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
            number,
            position
          )
        `)
        .eq('game_id', gameId)
        .order('points', { ascending: false });

      if (playersError) throw playersError;

      const formattedPlayerStats: PlayerGameStat[] = (playersData || []).map(
        (stat: PlayerGameStatsRow) => {
          const playerInfo = Array.isArray(stat.players) ? stat.players[0] : stat.players;

          return {
            player_id: stat.player_id,
            player_name: playerInfo?.name ?? 'Ismeretlen játékos',
            player_number: playerInfo?.number ?? 0,
            player_position: playerInfo?.position ?? null,
            minutes: stat.minutes ?? 0,
            points: stat.points ?? 0,
            close_made: stat.close_made ?? 0,
            close_attempted: stat.close_attempted ?? 0,
            mid_made: stat.mid_made ?? 0,
            mid_attempted: stat.mid_attempted ?? 0,
            three_made: stat.three_made ?? 0,
            three_attempted: stat.three_attempted ?? 0,
            free_throw_made: stat.free_throw_made ?? 0,
            free_throw_attempted: stat.free_throw_attempted ?? 0,
            offensive_rebounds: stat.offensive_rebounds ?? 0,
            defensive_rebounds: stat.defensive_rebounds ?? 0,
            total_rebounds: stat.total_rebounds ?? 0,
            assists: stat.assists ?? 0,
            steals: stat.steals ?? 0,
            blocks: stat.blocks ?? 0,
            turnovers: stat.turnovers ?? 0,
            fouls_committed: stat.fouls_committed ?? 0,
            plus_minus: stat.plus_minus ?? 0,
            valuation: stat.valuation ?? 0,
          };
        }
      );

      setPlayerStats(formattedPlayerStats);

      // AI riportok betöltése
      const { data: reportsData } = await supabase
        .from('game_text_reports')
        .select('id, report_type, narrative, generated_at')
        .eq('game_id', gameId)
        .order('generated_at', { ascending: false });

      setTextReports((reportsData ?? []) as TextReport[]);

      // Per-játékos AI értékelések betöltése
      const { data: playerReportsData } = await supabase
        .from('player_game_text_reports')
        .select('player_id, narrative, breakdown, generated_at')
        .eq('game_id', gameId);

      if (playerReportsData && playerReportsData.length > 0) {
        const texts: Record<string, string> = {};
        const breakdownsFromDb: PlayerPostGameBreakdown[] = [];
        for (const row of playerReportsData) {
          texts[row.player_id as string] = row.narrative as string;
          if (row.breakdown) {
            breakdownsFromDb.push(row.breakdown as unknown as PlayerPostGameBreakdown);
          }
        }
        setPlayerTexts(texts);
        if (breakdownsFromDb.length > 0) {
          const sorted = [...breakdownsFromDb].sort((a, b) => b.impactScore - a.impactScore);
          setPlayerBreakdowns(sorted);
        }
      }

      // Kosarstat negyedenkénti adatok
      const { data: gameRow } = await supabase
        .from('games')
        .select('kosarstat_game_id, home_away, season_id')
        .eq('id', gameId)
        .single();

      if (gameRow?.kosarstat_game_id && gameRow?.season_id) {
        const { data: qData } = await supabase
          .from('kosarstat_game_quarter_stats' as never)
          .select('team_side, quarter, points')
          .eq('kosarstat_game_id', gameRow.kosarstat_game_id)
          .eq('season_id', gameRow.season_id)
          .order('quarter');

        setQuarterStats((qData ?? []) as QuarterStatRow[]);
        setOurSide(gameRow.home_away as 'home' | 'away');
      }
    } catch (error) {
      console.error('Hiba a meccs részletek betöltésekor:', error);
      toast.error('Nem sikerült betölteni a meccs részleteit');
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    loadGameDetails();
  }, [loadGameDetails]);

  const generatePlayerTexts = useCallback(async () => {
    if (!gameComparison || playerStats.length === 0) return;
    setGeneratingPlayerTexts(true);
    setPlayerTexts({});

    const libPlayers: (LibPlayerGameStat & { fouls: number })[] = playerStats
      .filter(p => p.minutes > 0)
      .map(p => ({
        playerId: p.player_id,
        name: p.player_name,
        position: mapPosition(p.player_position),
        minutes: p.minutes,
        points: p.points,
        fga2: p.close_attempted + p.mid_attempted,
        fgm2: p.close_made + p.mid_made,
        fga3: p.three_attempted,
        fgm3: p.three_made,
        fta: p.free_throw_attempted,
        ftm: p.free_throw_made,
        oreb: p.offensive_rebounds,
        dreb: p.defensive_rebounds,
        ast: p.assists,
        tov: p.turnovers,
        stl: p.steals,
        blk: p.blocks,
        val: p.valuation,
        fouls: p.fouls_committed,
        roles: [],
      }));

    const report = buildPlayerPostGameReport(libPlayers as LibPlayerGameStat[]);
    setPlayerBreakdowns(report.players);

    try {
      await Promise.all(
        report.players.map(async (breakdown) => {
          try {
            const resp = await fetch('/api/generate-player-postgame-text', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                gameId: gameComparison.game_id,
                playerId: breakdown.playerId,
                playerName: breakdown.name,
                teamName: gameComparison.team_name,
                opponentName: gameComparison.opponent,
                result: gameComparison.result as 'win' | 'loss',
                report: breakdown,
              }),
            });
            const json = (await resp.json()) as { ok: boolean; narrative?: string };
            if (json.ok && json.narrative) {
              setPlayerTexts(prev => ({ ...prev, [breakdown.playerId]: json.narrative! }));
            }
          } catch {
            // egyedi játékos hiba csendes kezelése
          }
        })
      );
    } catch (error) {
      console.error('Hiba a játékos értékelések generálásakor:', error);
      toast.error('Nem sikerült generálni a játékos értékeléseket');
    } finally {
      setGeneratingPlayerTexts(false);
    }
  }, [gameComparison, playerStats]);

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

      {/* Játékos AI értékelések */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-slate-50">Játékos Értékelések</CardTitle>
            <Button
              onClick={generatePlayerTexts}
              disabled={generatingPlayerTexts || playerStats.length === 0}
              size="sm"
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {generatingPlayerTexts ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              {generatingPlayerTexts
                ? 'Generálás...'
                : Object.keys(playerTexts).length > 0
                  ? 'Újragenerálás'
                  : 'AI Értékelések'}
            </Button>
          </div>
        </CardHeader>
        {playerBreakdowns.length > 0 && (
          <CardContent className="space-y-4">
            {playerBreakdowns.map(breakdown => (
              <div key={breakdown.playerId} className="border border-slate-700 rounded-lg p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-100">{breakdown.name}</span>
                  <Badge className={impactBadgeClass(breakdown.impactClass)}>
                    {breakdown.impactLabel}
                  </Badge>
                  <span className="text-xs text-slate-500 ml-auto hidden sm:block">{breakdown.summaryLine}</span>
                </div>
                <div className="text-xs text-slate-500 sm:hidden">{breakdown.summaryLine}</div>
                {playerTexts[breakdown.playerId] ? (
                  <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {playerTexts[breakdown.playerId]}
                  </p>
                ) : generatingPlayerTexts ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Értékelés generálása...
                  </div>
                ) : null}
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      <GamePbpCharts
        quarterStats={quarterStats}
        playerStats={playerStats}
        ourSide={ourSide}
        teamShortName={gameComparison.team_short_name}
        opponent={gameComparison.opponent}
      />

      {textReports.length > 0 && (
        <div className="space-y-4">
          {textReports.map((report) => {
            const typeLabel =
              report.report_type === 'pregame' ? 'Pregame scouting' :
              report.report_type === 'postgame' ? 'Postgame elemzés' :
              'Összesített riport';
            const generatedAt = new Date(report.generated_at).toLocaleDateString('hu-HU', {
              year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
            });
            return (
              <Card key={report.id} className="bg-slate-900 border-slate-700">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base text-slate-200">
                    <FileText className="h-4 w-4 text-violet-400" />
                    {typeLabel}
                    <span className="ml-auto text-xs text-slate-500 font-normal">{generatedAt}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {report.narrative}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
