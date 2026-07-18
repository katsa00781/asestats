import { useState, useEffect } from 'react';
import type { PlayerStats } from '@/lib/dashboard-types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { trueShootingPct, effectiveFgPct, simpleValuation } from '@/lib/stat-formulas';

type GameInputProps = {
  players: PlayerStats[];
  onGameAdded?: () => void;
};

type Season = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
};

type PlayerGameStats = {
  playerId: string;
  playerName: string;
  minutes: number;
  points: number;
  closeMade: number;
  closeAttempted: number;
  midMade: number;
  midAttempted: number;
  threeMade: number;
  threeAttempted: number;
  ftMade: number;
  ftAttempted: number;
  offensiveRebounds: number;
  defensiveRebounds: number;
  assists: number;
  steals: number;
  turnovers: number;
  foulsCommitted: number;
  blocks: number;
  plusMinus: number;
  // Fejlett statisztikák (automatikusan számolódnak)
  offensiveRating: number;
  defensiveRating: number;
  trueShootingPct: number;
  effectiveFGPct: number;
  valuation: number;
};

// Fejlett statisztikák számítása
const calculateAdvancedStats = (stats: PlayerGameStats) => {
  const totalFGMade = stats.closeMade + stats.midMade + stats.threeMade;
  const totalFGAttempted = stats.closeAttempted + stats.midAttempted + stats.threeAttempted;
  const totalRebounds = stats.offensiveRebounds + stats.defensiveRebounds;

  // TS% és eFG% – kanonikus képletek a lib/stat-formulas.ts-ből
  const tsValue = trueShootingPct(stats.points, totalFGAttempted, stats.ftAttempted);
  const efgValue = effectiveFgPct(totalFGMade, stats.threeMade, totalFGAttempted);

  // Offensive Rating - Javított képlet
  // Points Produced figyelembe veszi az asszisztokat és támadó lepattanókat
  const pointsProduced = stats.points + (0.5 * stats.assists) + stats.offensiveRebounds;
  const possessions = totalFGAttempted - stats.offensiveRebounds + stats.turnovers + (0.44 * stats.ftAttempted);
  const offensiveRating = possessions > 0 ? (pointsProduced / possessions) * 100 : 0;

  // Defensive Rating - Javított képlet (egyéni védekezési hatékonyság)
  // Védekezési hozzájárulás: lopások és blokkolt labdák vs elkövetett hibák
  const defensiveContribution = (stats.steals + stats.blocks) - (stats.turnovers * 0.5);
  const defensiveActions = stats.steals + stats.blocks + stats.defensiveRebounds;
  // Becslés: minél több a pozitív védekezési akció, annál jobb (alacsonyabb érték = jobb védelem)
  // Skála: 80-120, ahol 100 átlag, <100 jó védelem, >100 gyenge védelem
  const defensiveRating = defensiveActions > 0 
    ? Math.max(80, Math.min(120, 100 - (defensiveContribution * 2))) 
    : 100;

  const valuation = simpleValuation({
    points: stats.points,
    rebounds: totalRebounds,
    assists: stats.assists,
    steals: stats.steals,
    blocks: stats.blocks,
    fgMade: totalFGMade,
    fgAttempted: totalFGAttempted,
    ftMade: stats.ftMade,
    ftAttempted: stats.ftAttempted,
    turnovers: stats.turnovers,
  });

  return {
    offensiveRating: Math.round(offensiveRating * 10) / 10,
    defensiveRating: Math.round(defensiveRating * 10) / 10,
    trueShootingPct: Math.round(tsValue * 10) / 10,
    effectiveFGPct: Math.round(efgValue * 10) / 10,
    valuation,
  };
};

export function GameInput({ players, onGameAdded }: GameInputProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [gameDate, setGameDate] = useState('');
  const [opponent, setOpponent] = useState('');
  const [homeAway, setHomeAway] = useState<'home' | 'away'>('home');
  const [teamScore, setTeamScore] = useState('');
  const [opponentScore, setOpponentScore] = useState('');
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');

  // Szezonok betöltése
  useEffect(() => {
    async function fetchSeasons() {
      try {
        const { data, error } = await supabase
          .from('seasons')
          .select('*')
          .order('start_date', { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
          setSeasons(data);
          const currentSeason = data.find(s => s.is_current);
          if (currentSeason) {
            setSelectedSeasonId(currentSeason.id);
          } else {
            setSelectedSeasonId(data[0].id);
          }
        }
      } catch (error) {
        console.error('Hiba a szezonok betöltésekor:', error);
      }
    }
    fetchSeasons();
  }, []);

  const [playerStats, setPlayerStats] = useState<PlayerGameStats[]>(
    players.map((p) => ({
      playerId: p.id,
      playerName: p.name,
      points: 0,
      minutes: 0,
      closeMade: 0,
      closeAttempted: 0,
      midMade: 0,
      midAttempted: 0,
      threeMade: 0,
      threeAttempted: 0,
      ftMade: 0,
      ftAttempted: 0,
      offensiveRebounds: 0,
      defensiveRebounds: 0,
      assists: 0,
      steals: 0,
      turnovers: 0,
      foulsCommitted: 0,
      blocks: 0,
      plusMinus: 0,
      offensiveRating: 0,
      defensiveRating: 0,
      trueShootingPct: 0,
      effectiveFGPct: 0,
      valuation: 0,
    }))
  );

  const updatePlayerStat = (playerId: string, field: keyof PlayerGameStats, value: number) => {
    setPlayerStats((prev) =>
      prev.map((ps) => (ps.playerId === playerId ? { ...ps, [field]: value } : ps))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validáció
    if (!gameDate || !opponent || !teamScore || !opponentScore) {
      toast.error('Kérlek töltsd ki az összes mezőt!');
      return;
    }

    if (!selectedSeasonId) {
      toast.error('Kérlek válassz szezont!');
      return;
    }

    setIsLoading(true);

    try {
      const ourScore = parseInt(teamScore);
      const oppScore = parseInt(opponentScore);
      const result = ourScore > oppScore ? 'win' : 'loss';

      // 1. Meccs beszúrása a kiválasztott szezonba
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .insert({
          date: gameDate,
          opponent: opponent,
          home_away: homeAway,
          our_score: ourScore,
          opp_score: oppScore,
          result: result,
          season_id: selectedSeasonId,
        })
        .select()
        .single();

      if (gameError) throw gameError;

      // 2. Játékos statisztikák beszúrása
      const statsToInsert = playerStats
        .filter(ps => ps.minutes > 0) // Csak azok, akik játszottak
        .map((ps) => {
          // Számítsuk ki a fejlett statisztikákat
          const advanced = calculateAdvancedStats(ps);
          
          return {
            game_id: gameData.id,
            player_id: ps.playerId,
            minutes: ps.minutes,
            points: ps.points,
            close_made: ps.closeMade,
            close_attempted: ps.closeAttempted,
            mid_made: ps.midMade,
            mid_attempted: ps.midAttempted,
            three_made: ps.threeMade,
            three_attempted: ps.threeAttempted,
            free_throw_made: ps.ftMade,
            free_throw_attempted: ps.ftAttempted,
            offensive_rebounds: ps.offensiveRebounds,
            defensive_rebounds: ps.defensiveRebounds,
            total_rebounds: ps.offensiveRebounds + ps.defensiveRebounds,
            assists: ps.assists,
            steals: ps.steals,
            blocks: ps.blocks,
            turnovers: ps.turnovers,
            fouls_committed: ps.foulsCommitted,
            plus_minus: ps.plusMinus,
            valuation: advanced.valuation,
            offensive_rating: advanced.offensiveRating,
            defensive_rating: advanced.defensiveRating,
            true_shooting_percentage: advanced.trueShootingPct,
            effective_field_goal_percentage: advanced.effectiveFGPct,
          };
        });

      if (statsToInsert.length > 0) {
        const { error: statsError } = await supabase
          .from('player_game_stats')
          .insert(statsToInsert);

        if (statsError) throw statsError;
      }

      toast.success(`Meccs sikeresen rögzítve! ${result === 'win' ? '🏆 Győzelem!' : 'Vereség'}`);

      // Form reset
      setGameDate('');
      setOpponent('');
      setTeamScore('');
      setOpponentScore('');
      setPlayerStats(
        players.map((p) => ({
          playerId: p.id,
          playerName: p.name,
          points: 0,
          minutes: 0,
          closeMade: 0,
          closeAttempted: 0,
          midMade: 0,
          midAttempted: 0,
          threeMade: 0,
          threeAttempted: 0,
          ftMade: 0,
          ftAttempted: 0,
          offensiveRebounds: 0,
          defensiveRebounds: 0,
          assists: 0,
          steals: 0,
          turnovers: 0,
          foulsCommitted: 0,
          blocks: 0,
          plusMinus: 0,
          offensiveRating: 0,
          defensiveRating: 0,
          trueShootingPct: 0,
          effectiveFGPct: 0,
          valuation: 0,
        }))
      );

      // Callback hívás az újratöltéshez
      if (onGameAdded) {
        onGameAdded();
      }
    } catch (error) {
      console.error('Hiba a meccs mentésekor:', error);
      toast.error('Hiba történt a mentés során!');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-slate-50 mb-2">Új Meccs Rögzítése</h2>
        <p className="text-slate-400">Add meg a meccs és játékosok részletes statisztikáit</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Meccs információk */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-slate-50">Meccs információk</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Első sor: Szezon, Dátum, Ellenfél */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="season" className="text-slate-300">
                  Szezon *
                </Label>
                <Select value={selectedSeasonId} onValueChange={setSelectedSeasonId}>
                  <SelectTrigger className="bg-slate-800 border-slate-700">
                    <SelectValue placeholder="Válassz szezont..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {seasons.map(season => (
                      <SelectItem 
                        key={season.id} 
                        value={season.id}
                        className="text-slate-200 focus:bg-slate-700"
                      >
                        {season.name} {season.is_current && '(Jelenlegi)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date" className="text-slate-300">
                  Dátum
                </Label>
                <Input
                  id="date"
                  type="date"
                  value={gameDate}
                  onChange={(e) => setGameDate(e.target.value)}
                  required
                  className="bg-slate-800 border-slate-700 text-slate-100"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="opponent" className="text-slate-300">
                  Ellenfél
                </Label>
                <Input
                  id="opponent"
                  type="text"
                  placeholder="pl. PVSK-VEOLIA"
                  value={opponent}
                  onChange={(e) => setOpponent(e.target.value)}
                  required
                  className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-600"
                />
              </div>
            </div>

            {/* Második sor: Helyszín, Pontok */}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="homeAway" className="text-slate-300">
                  Helyszín
                </Label>
                <Select value={homeAway} onValueChange={(value: 'home' | 'away') => setHomeAway(value)}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="home">Hazai</SelectItem>
                    <SelectItem value="away">Idegenbeli</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="teamScore" className="text-slate-300">
                  Paksi SE pont
                </Label>
                <Input
                  id="teamScore"
                  type="number"
                  min="0"
                  placeholder="81"
                  value={teamScore}
                  onChange={(e) => setTeamScore(e.target.value)}
                  required
                  className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-600"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="opponentScore" className="text-slate-300">
                  Ellenfél pont
                </Label>
                <Input
                  id="opponentScore"
                  type="number"
                  min="0"
                  placeholder="78"
                  value={opponentScore}
                  onChange={(e) => setOpponentScore(e.target.value)}
                  required
                  className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-600"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Játékos statisztikák */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-slate-50">Játékos statisztikák</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {players.map((player) => {
              const stats = playerStats.find((ps) => ps.playerId === player.id);
              if (!stats) return null;

              return (
                <div key={player.id} className="p-4 bg-slate-800/50 rounded-lg space-y-4 border border-slate-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-slate-50">{player.name}</div>
                      <div className="text-slate-500 text-sm">
                        #{player.number} - {player.position}
                      </div>
                    </div>
                  </div>

                  {/* Alap statisztikák */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-400">Pontok</Label>
                      <Input
                        type="number"
                        min="0"
                        value={stats.points}
                        onChange={(e) => updatePlayerStat(player.id, 'points', Number(e.target.value))}
                        className="bg-slate-800 border-slate-700 text-slate-100 h-9"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-slate-400">Percek</Label>
                      <Input
                        type="number"
                        min="0"
                        value={stats.minutes}
                        onChange={(e) => updatePlayerStat(player.id, 'minutes', Number(e.target.value))}
                        className="bg-slate-800 border-slate-700 text-slate-100 h-9"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-slate-400">Gólpasszok</Label>
                      <Input
                        type="number"
                        min="0"
                        value={stats.assists}
                        onChange={(e) => updatePlayerStat(player.id, 'assists', Number(e.target.value))}
                        className="bg-slate-800 border-slate-700 text-slate-100 h-9"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-slate-400">Labdaszerzés</Label>
                      <Input
                        type="number"
                        min="0"
                        value={stats.steals}
                        onChange={(e) => updatePlayerStat(player.id, 'steals', Number(e.target.value))}
                        className="bg-slate-800 border-slate-700 text-slate-100 h-9"
                      />
                    </div>
                  </div>

                  {/* Dobás statisztikák */}
                  <div>
                    <Label className="text-sm text-slate-300 mb-2 block">Dobási statisztikák</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="space-y-2 p-2 bg-slate-900/50 rounded">
                        <Label className="text-xs text-emerald-400">Közeli</Label>
                        <div className="flex gap-1">
                          <Input
                            type="number"
                            min="0"
                            placeholder="S"
                            value={stats.closeMade}
                            onChange={(e) => updatePlayerStat(player.id, 'closeMade', Number(e.target.value))}
                            className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm"
                          />
                          <Input
                            type="number"
                            min="0"
                            placeholder="K"
                            value={stats.closeAttempted}
                            onChange={(e) => updatePlayerStat(player.id, 'closeAttempted', Number(e.target.value))}
                            className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm"
                          />
                        </div>
                      </div>

                      <div className="space-y-2 p-2 bg-slate-900/50 rounded">
                        <Label className="text-xs text-cyan-400">Középtávoli</Label>
                        <div className="flex gap-1">
                          <Input
                            type="number"
                            min="0"
                            placeholder="S"
                            value={stats.midMade}
                            onChange={(e) => updatePlayerStat(player.id, 'midMade', Number(e.target.value))}
                            className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm"
                          />
                          <Input
                            type="number"
                            min="0"
                            placeholder="K"
                            value={stats.midAttempted}
                            onChange={(e) => updatePlayerStat(player.id, 'midAttempted', Number(e.target.value))}
                            className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm"
                          />
                        </div>
                      </div>

                      <div className="space-y-2 p-2 bg-slate-900/50 rounded">
                        <Label className="text-xs text-violet-400">Hármas</Label>
                        <div className="flex gap-1">
                          <Input
                            type="number"
                            min="0"
                            placeholder="S"
                            value={stats.threeMade}
                            onChange={(e) => updatePlayerStat(player.id, 'threeMade', Number(e.target.value))}
                            className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm"
                          />
                          <Input
                            type="number"
                            min="0"
                            placeholder="K"
                            value={stats.threeAttempted}
                            onChange={(e) => updatePlayerStat(player.id, 'threeAttempted', Number(e.target.value))}
                            className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm"
                          />
                        </div>
                      </div>

                      <div className="space-y-2 p-2 bg-slate-900/50 rounded">
                        <Label className="text-xs text-orange-400">Büntetők</Label>
                        <div className="flex gap-1">
                          <Input
                            type="number"
                            min="0"
                            placeholder="S"
                            value={stats.ftMade}
                            onChange={(e) => updatePlayerStat(player.id, 'ftMade', Number(e.target.value))}
                            className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm"
                          />
                          <Input
                            type="number"
                            min="0"
                            placeholder="K"
                            value={stats.ftAttempted}
                            onChange={(e) => updatePlayerStat(player.id, 'ftAttempted', Number(e.target.value))}
                            className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* További statisztikák */}
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-400">Támd. lep.</Label>
                      <Input
                        type="number"
                        min="0"
                        value={stats.offensiveRebounds}
                        onChange={(e) => updatePlayerStat(player.id, 'offensiveRebounds', Number(e.target.value))}
                        className="bg-slate-800 border-slate-700 text-slate-100 h-9"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-slate-400">Véd. lep.</Label>
                      <Input
                        type="number"
                        min="0"
                        value={stats.defensiveRebounds}
                        onChange={(e) => updatePlayerStat(player.id, 'defensiveRebounds', Number(e.target.value))}
                        className="bg-slate-800 border-slate-700 text-slate-100 h-9"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-slate-400">Labdaelad.</Label>
                      <Input
                        type="number"
                        min="0"
                        value={stats.turnovers}
                        onChange={(e) => updatePlayerStat(player.id, 'turnovers', Number(e.target.value))}
                        className="bg-slate-800 border-slate-700 text-slate-100 h-9"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-slate-400">Blokkok</Label>
                      <Input
                        type="number"
                        min="0"
                        value={stats.blocks}
                        onChange={(e) => updatePlayerStat(player.id, 'blocks', Number(e.target.value))}
                        className="bg-slate-800 border-slate-700 text-slate-100 h-9"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-slate-400">Faultok (S)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={stats.foulsCommitted}
                        onChange={(e) => updatePlayerStat(player.id, 'foulsCommitted', Number(e.target.value))}
                        className="bg-slate-800 border-slate-700 text-slate-100 h-9"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-slate-400">+/-</Label>
                      <Input
                        type="number"
                        value={stats.plusMinus}
                        onChange={(e) => updatePlayerStat(player.id, 'plusMinus', Number(e.target.value))}
                        className="bg-slate-800 border-slate-700 text-slate-100 h-9"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button
            type="submit"
            disabled={isLoading}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 animate-spin" size={20} />
                Mentés...
              </>
            ) : (
              <>
                <Save className="mr-2" size={20} />
                Statisztikák mentése
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
