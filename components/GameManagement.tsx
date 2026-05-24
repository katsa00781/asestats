'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Trash2, AlertTriangle } from 'lucide-react';

type Game = {
  id: string;
  date: string;
  opponent: string;
  our_score: number;
  opp_score: number;
  home_away: 'home' | 'away';
  season_id: string;
  season_name?: string;
  team_id: string;
  team_name?: string;
  stats_count?: number;
};

type Season = {
  id: string;
  name: string;
  is_current: boolean;
};

type Team = {
  id: string;
  name: string;
  is_primary: boolean;
};

export function GameManagement({ onDeleteComplete }: { onDeleteComplete?: () => void }) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [games, setGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Szezonok és csapatok betöltése
  useEffect(() => {
    async function loadData() {
      const [seasonsRes, teamsRes] = await Promise.all([
        supabase.from('seasons').select('*').order('start_date', { ascending: false }),
        supabase.from('teams').select('*').order('is_primary', { ascending: false }).order('name')
      ]);

      if (seasonsRes.data) {
        setSeasons(seasonsRes.data);
        const current = seasonsRes.data.find(s => s.is_current);
        if (current) setSelectedSeasonId(current.id);
      }

      if (teamsRes.data) {
        setTeams(teamsRes.data);
        const primary = teamsRes.data.find(t => t.is_primary);
        if (primary) setSelectedTeamId(primary.id);
      }
    }
    loadData();
  }, []);

  // Meccsek betöltése amikor változik a szezon vagy csapat
  useEffect(() => {
    async function fetchGames() {
      if (!selectedSeasonId || !selectedTeamId) return;
      
      setIsLoading(true);
      try {
        const { data: gamesData, error } = await supabase
          .from('games')
          .select(`
            id,
            date,
            opponent,
            our_score,
            opp_score,
            home_away,
            season_id,
            our_team_id
          `)
          .eq('season_id', selectedSeasonId)
          .eq('our_team_id', selectedTeamId)
          .order('date', { ascending: false });

        if (error) throw error;

        // Minden meccshez lekérjük a statisztikák számát
        const gamesWithStats = await Promise.all(
          (gamesData || []).map(async (game) => {
            const { count } = await supabase
              .from('player_game_stats')
              .select('id', { count: 'exact', head: true })
              .eq('game_id', game.id);

            return {
              ...game,
              team_id: game.our_team_id,
              team_name: teams.find(t => t.id === game.our_team_id)?.name,
              season_name: seasons.find(s => s.id === game.season_id)?.name,
              stats_count: count || 0,
            };
          })
        );

        setGames(gamesWithStats);
      } catch (error) {
        console.error('Hiba a meccsek betöltésekor:', error);
        toast.error('Nem sikerült betölteni a meccseket');
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchGames();
  }, [selectedSeasonId, selectedTeamId, teams, seasons, refreshTrigger]);

  async function handleDeleteGame(game: Game) {
    const confirmed = window.confirm(
      `Biztosan törlöd ezt a meccset?\n\n` +
      `Dátum: ${game.date}\n` +
      `Ellenfél: ${game.opponent}\n` +
      `Eredmény: ${game.our_score} - ${game.opp_score}\n` +
      `Statisztikák száma: ${game.stats_count}\n\n` +
      `Ez a művelet nem vonható vissza! A meccshez tartozó összes játékos statisztika is törlődik.`
    );

    if (!confirmed) return;

    setIsLoading(true);
    try {
      // Először töröljük a statisztikákat
      const { error: statsError } = await supabase
        .from('player_game_stats')
        .delete()
        .eq('game_id', game.id);

      if (statsError) throw statsError;

      // Majd a meccset
      const { error: gameError } = await supabase
        .from('games')
        .delete()
        .eq('id', game.id);

      if (gameError) throw gameError;

      toast.success(`Meccs törölve: ${game.opponent} (${game.date})`);
      
      // Újratöltjük a meccseket
      setRefreshTrigger(prev => prev + 1);
      
      if (onDeleteComplete) {
        onDeleteComplete();
      }
    } catch (error) {
      console.error('Hiba a meccs törlésekor:', error);
      toast.error('Nem sikerült törölni a meccset');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="text-negative" size={20} strokeWidth={1.6} />
            Meccsek Kezelése
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Szűrők */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-secondary">Szezon</label>
              <Select value={selectedSeasonId} onValueChange={setSelectedSeasonId}>
                <SelectTrigger>
                  <SelectValue placeholder="Válassz szezont..." />
                </SelectTrigger>
                <SelectContent>
                  {seasons.map(season => (
                    <SelectItem key={season.id} value={season.id}>
                      {season.name} {season.is_current && '(Jelenlegi)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-secondary">Csapat</label>
              <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Válassz csapatot..." />
                </SelectTrigger>
                <SelectContent>
                  {teams.map(team => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name} {team.is_primary && '⭐'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Meccsek listája */}
          {isLoading ? (
            <div className="text-center py-8 text-secondary">Betöltés...</div>
          ) : games.length === 0 ? (
            <div className="text-center py-8 text-secondary">
              Nincs találat a kiválasztott szezonhoz és csapathoz.
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-warning bg-amber-500/10 p-3 rounded-md">
                <AlertTriangle size={16} strokeWidth={1.6} />
                <span>A meccs törlése visszavonhatatlan! Minden statisztika is törlődik.</span>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {games.map(game => (
                  <div
                    key={game.id}
                    className="flex items-center justify-between p-4 bg-surface-2 rounded-lg hover:bg-surface-3 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-primary font-medium">{game.date}</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          game.home_away === 'home'
                            ? 'bg-cyan/20 text-cyan'
                            : 'bg-orange/20 text-orange'
                        }`}>
                          {game.home_away === 'home' ? 'Hazai' : 'Vendég'}
                        </span>
                      </div>
                      <div className="text-sm text-secondary">
                        <span className="font-semibold text-primary">
                          {game.our_score} - {game.opp_score}
                        </span>
                        {' vs '}
                        <span>{game.opponent}</span>
                      </div>
                      <div className="text-xs text-muted mt-1">
                        <span className="font-mono tabular-nums">{game.stats_count}</span> játékos statisztika
                      </div>
                    </div>
                    <Button
                      onClick={() => handleDeleteGame(game)}
                      disabled={isLoading}
                      variant="destructive"
                      size="sm"
                    >
                      <Trash2 size={16} strokeWidth={1.6} />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
