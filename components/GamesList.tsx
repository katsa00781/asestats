import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Calendar, Users, Trophy, TrendingDown, Trash2, Loader2, Edit, Save, X, Eye } from 'lucide-react';
import type { TeamGame, UpcomingFixture } from '@/lib/dashboard-types';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { GameDetails } from './GameDetails';

type GamesListProps = {
  games: TeamGame[];
  upcomingFixtures?: UpcomingFixture[];
  onGameDeleted?: () => void;
};

export function GamesList({ games, upcomingFixtures = [], onGameDeleted }: GamesListProps) {
  const [deletingGameId, setDeletingGameId] = useState<string | null>(null);
  const [editingGameId, setEditingGameId] = useState<string | null>(null);
  const [viewingGameId, setViewingGameId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    date: string;
    opponent: string;
    homeAway: 'home' | 'away';
    ourScore: number;
    oppScore: number;
  } | null>(null);

  const handleDeleteGame = async (gameId: string, opponent: string, date: string) => {
    const confirmed = window.confirm(
      `Biztosan törölni szeretnéd a(z) ${opponent} elleni meccset (${new Date(date).toLocaleDateString('hu-HU')})?`
    );

    if (!confirmed) return;

    setDeletingGameId(gameId);

    try {
      // Először töröljük a player_game_stats rekordokat
      const { error: statsError } = await supabase
        .from('player_game_stats')
        .delete()
        .eq('game_id', gameId);

      if (statsError) throw statsError;

      // Aztán a games rekordot
      const { error: gameError } = await supabase
        .from('games')
        .delete()
        .eq('id', gameId);

      if (gameError) throw gameError;

      toast.success('Meccs sikeresen törölve!');

      if (onGameDeleted) {
        onGameDeleted();
      }
    } catch (error) {
      console.error('Hiba a meccs törlésekor:', error);
      toast.error('Hiba történt a meccs törlésekor!');
    } finally {
      setDeletingGameId(null);
    }
  };

  const handleEditGame = (game: TeamGame) => {
    setEditingGameId(game.id);
    setEditForm({
      date: game.date,
      opponent: game.opponent,
      homeAway: game.homeAway,
      ourScore: game.ourScore,
      oppScore: game.oppScore,
    });
  };

  const handleCancelEdit = () => {
    setEditingGameId(null);
    setEditForm(null);
  };

  const handleSaveEdit = async () => {
    if (!editingGameId || !editForm) return;

    try {
      const result = editForm.ourScore > editForm.oppScore ? 'win' : 'loss';

      const { error } = await supabase
        .from('games')
        .update({
          date: editForm.date,
          opponent: editForm.opponent,
          home_away: editForm.homeAway,
          our_score: editForm.ourScore,
          opp_score: editForm.oppScore,
          result: result,
        })
        .eq('id', editingGameId);

      if (error) throw error;

      toast.success('Meccs sikeresen frissítve!');
      setEditingGameId(null);
      setEditForm(null);

      if (onGameDeleted) {
        onGameDeleted(); // Frissítjük az adatokat
      }
    } catch (error) {
      console.error('Hiba a meccs frissítésekor:', error);
      toast.error('Hiba történt a meccs frissítésekor!');
    }
  };

  if (games.length === 0 && upcomingFixtures.length === 0) {
    return (
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="py-12">
          <div className="text-center text-slate-400">
            <Calendar size={48} className="mx-auto mb-4 opacity-50" />
            <p>Még nincsenek meccsek az adatbázisban</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Ha egy meccset nézünk részletesen, akkor azt jelenítjük meg
  if (viewingGameId) {
    return <GameDetails gameId={viewingGameId} onBack={() => setViewingGameId(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-50 mb-2">Meccsek</h2>
        <p className="text-sm sm:text-base text-slate-400">Összesen {games.length} meccs</p>
      </div>

      {upcomingFixtures.length > 0 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-slate-50 text-lg">Következő mérkőzések</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingFixtures.map(fixture => {
              const date = fixture.gameDate
                ? new Date(fixture.gameDate).toLocaleDateString('hu-HU', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : 'Ismeretlen dátum';

              return (
                <div
                  key={fixture.id}
                  className="rounded-md border border-cyan-700/40 bg-cyan-950/20 px-4 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium text-slate-100">
                      {fixture.homeTeamName} vs {fixture.awayTeamName}
                    </div>
                    <Badge variant="secondary" className="bg-slate-800 text-cyan-200">
                      {fixture.round ? `${fixture.round}. forduló` : 'Forduló n.a.'}
                    </Badge>
                  </div>
                  <div className="mt-1 text-slate-300">{date}</div>
                  {fixture.status === 'postponed' && (
                    <div className="mt-1 text-xs text-amber-300">Halasztott mérkőzés</div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {games.length === 0 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="py-8">
            <div className="text-center text-slate-400">
              Nincs még lejátszott meccs a kiválasztott szűrőre.
            </div>
          </CardContent>
        </Card>
      )}

      {games.length > 0 && <div className="grid gap-3 sm:gap-4">
        {games.map((game) => {
          const isWin = game.result === 'win';
          const date = new Date(game.date).toLocaleDateString('hu-HU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
          const isDeleting = deletingGameId === game.id;
          const isEditing = editingGameId === game.id;

          return (
            <Card
              key={game.id}
              className={`bg-slate-900 border-slate-800 transition-colors ${
                isWin ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-red-500'
              } ${isDeleting ? 'opacity-50' : ''} ${isEditing ? 'border-2 border-emerald-500' : 'hover:border-slate-700'}`}
            >
              <CardContent className="p-4 sm:p-6">
                {isEditing && editForm ? (
                  // Szerkesztő mód
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-50 mb-4">Meccs szerkesztése</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Dátum */}
                      <div>
                        <label className="text-sm text-slate-400 mb-2 block">Dátum</label>
                        <Input
                          type="date"
                          value={editForm.date}
                          onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                          className="bg-slate-800 border-slate-700"
                        />
                      </div>

                      {/* Ellenfél */}
                      <div>
                        <label className="text-sm text-slate-400 mb-2 block">Ellenfél</label>
                        <Input
                          type="text"
                          value={editForm.opponent}
                          onChange={(e) => setEditForm({ ...editForm, opponent: e.target.value })}
                          className="bg-slate-800 border-slate-700"
                        />
                      </div>

                      {/* Hazai/Vendég */}
                      <div>
                        <label className="text-sm text-slate-400 mb-2 block">Helyszín</label>
                        <Select
                          value={editForm.homeAway}
                          onValueChange={(value: 'home' | 'away') => setEditForm({ ...editForm, homeAway: value })}
                        >
                          <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-300">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-700">
                            <SelectItem value="home">🏠 Hazai</SelectItem>
                            <SelectItem value="away">✈️ Vendég</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Eredmény */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-sm text-slate-400 mb-2 block">Saját</label>
                          <Input
                            type="number"
                            value={editForm.ourScore}
                            onChange={(e) => setEditForm({ ...editForm, ourScore: parseInt(e.target.value) || 0 })}
                            className="bg-slate-800 border-slate-700"
                          />
                        </div>
                        <div>
                          <label className="text-sm text-slate-400 mb-2 block">Ellenfél</label>
                          <Input
                            type="number"
                            value={editForm.oppScore}
                            onChange={(e) => setEditForm({ ...editForm, oppScore: parseInt(e.target.value) || 0 })}
                            className="bg-slate-800 border-slate-700"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Gombok */}
                    <div className="flex gap-2 justify-end pt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancelEdit}
                        className="border-slate-700 hover:bg-slate-800"
                      >
                        <X size={14} className="mr-2" />
                        Mégse
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveEdit}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        <Save size={14} className="mr-2" />
                        Mentés
                      </Button>
                    </div>
                  </div>
                ) : (
                  // Normál megjelenítés
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1.5fr_auto] gap-4 sm:gap-6 items-start md:items-center">
                  {/* Dátum */}
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Calendar className="text-slate-400 shrink-0" size={18} />
                    <div>
                      <div className="text-slate-300 font-medium text-sm sm:text-base">{date}</div>
                      <div className="text-slate-500 text-xs sm:text-sm">
                        {game.homeAway === 'home' ? '🏠 Hazai' : '✈️ Vendég'}
                      </div>
                    </div>
                  </div>

                  {/* Ellenfél */}
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Users className="text-slate-400 shrink-0" size={18} />
                    <div>
                      <div className="text-slate-300 font-medium text-sm sm:text-base">{game.opponent}</div>
                      <div className="text-slate-500 text-xs sm:text-sm">Ellenfél</div>
                    </div>
                  </div>

                  {/* Eredmény */}
                  <div className="flex items-center gap-2 sm:gap-3">
                    {isWin ? (
                      <Trophy className="text-emerald-400 shrink-0" size={18} />
                    ) : (
                      <TrendingDown className="text-red-400 shrink-0" size={18} />
                    )}
                    <div>
                      <div className="text-slate-50 font-bold text-lg sm:text-xl">
                        {game.ourScore} : {game.oppScore}
                      </div>
                      <div className="text-slate-500 text-xs sm:text-sm">
                        {isWin ? 'Győzelem' : 'Vereség'} ({Math.abs(game.ourScore - game.oppScore)} pont)
                      </div>
                    </div>
                  </div>

                  {/* Státusz badge + Gombok egy konténerben */}
                  <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-start md:justify-end">
                    <Badge
                      className={`text-xs sm:text-sm ${
                        isWin
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-red-600 hover:bg-red-700 text-white'
                      }`}
                    >
                      {isWin ? '✓ Győzelem' : '✗ Vereség'}
                    </Badge>

                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewingGameId(game.id)}
                        className="border-slate-700 hover:bg-slate-800 text-xs sm:text-sm w-full sm:w-auto"
                      >
                        <Eye size={14} className="mr-1 sm:mr-2 shrink-0" />
                        Részletek
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditGame(game)}
                        className="border-slate-700 hover:bg-slate-800 text-xs sm:text-sm w-full sm:w-auto"
                      >
                        <Edit size={14} className="mr-1 sm:mr-2 shrink-0" />
                        Szerkesztés
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteGame(game.id, game.opponent, game.date)}
                        disabled={isDeleting}
                        className="bg-red-600 hover:bg-red-700 text-xs sm:text-sm w-full sm:w-auto"
                      >
                        {isDeleting ? (
                          <>
                            <Loader2 className="mr-1 sm:mr-2 animate-spin shrink-0" size={14} />
                            Törlés...
                          </>
                        ) : (
                          <>
                            <Trash2 className="mr-1 sm:mr-2 shrink-0" size={14} />
                            Törlés
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
            }

      {/* Összefoglaló  */}
      <Card className="bg-slate-900 border-slate-800 mt-4 sm:mt-6">
        <CardHeader>
          <CardTitle className="text-slate-50 text-base sm:text-lg">Összefoglaló</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="text-center p-2">
              <div className="text-2xl sm:text-3xl font-bold text-slate-50">{games.length}</div>
              <div className="text-slate-400 text-xs sm:text-sm">Összes meccs</div>
            </div>
            <div className="text-center p-2">
              <div className="text-2xl sm:text-3xl font-bold text-emerald-400">
                {games.filter((g) => g.result === 'win').length}
              </div>
              <div className="text-slate-400 text-xs sm:text-sm">Győzelem</div>
            </div>
            <div className="text-center p-2">
              <div className="text-2xl sm:text-3xl font-bold text-red-400">
                {games.filter((g) => g.result === 'loss').length}
              </div>
              <div className="text-slate-400 text-xs sm:text-sm">Vereség</div>
            </div>
            <div className="text-center p-2">
              <div className="text-2xl sm:text-3xl font-bold text-slate-50">
                {games.length > 0
                  ? ((games.filter((g) => g.result === 'win').length / games.length) * 100).toFixed(1)
                  : 0}
                %
              </div>
              <div className="text-slate-400 text-xs sm:text-sm">Győzelmi arány</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
