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
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-secondary">
            <Calendar size={48} className="mx-auto mb-4 opacity-50" strokeWidth={1.5} />
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
        <h2 className="text-xl sm:text-2xl font-display uppercase tracking-wide text-primary mb-2">Meccsek</h2>
        <p className="text-sm sm:text-base text-secondary">Összesen {games.length} meccs</p>
      </div>

      {upcomingFixtures.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Következő mérkőzések</CardTitle>
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
                  className="rounded-md border border-border-active bg-surface-2/50 px-4 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium text-primary">
                      {fixture.homeTeamName} vs {fixture.awayTeamName}
                    </div>
                    <Badge className="badge-cyan">
                      {fixture.round ? `${fixture.round}. forduló` : 'Forduló n.a.'}
                    </Badge>
                  </div>
                  <div className="mt-1 text-secondary">{date}</div>
                  {fixture.status === 'postponed' && (
                    <div className="mt-1 text-xs text-warning">Halasztott mérkőzés</div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {games.length === 0 && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-secondary">
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
              className={`transition-colors ${
                isWin ? 'border-l-4 border-l-positive' : 'border-l-4 border-l-negative'
              } ${isDeleting ? 'opacity-50' : ''} ${isEditing ? 'ring-1 ring-cyan' : ''}`}
            >
              <CardContent className="p-4 sm:p-6">
                {isEditing && editForm ? (
                  // Szerkesztő mód
                  <div className="space-y-4">
                    <h3 className="font-display uppercase tracking-wide text-primary mb-4">Meccs szerkesztése</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Dátum */}
                      <div>
                        <label className="text-sm text-secondary mb-2 block">Dátum</label>
                        <Input
                          type="date"
                          value={editForm.date}
                          onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                        />
                      </div>

                      {/* Ellenfél */}
                      <div>
                        <label className="text-sm text-secondary mb-2 block">Ellenfél</label>
                        <Input
                          type="text"
                          value={editForm.opponent}
                          onChange={(e) => setEditForm({ ...editForm, opponent: e.target.value })}
                        />
                      </div>

                      {/* Hazai/Vendég */}
                      <div>
                        <label className="text-sm text-secondary mb-2 block">Helyszín</label>
                        <Select
                          value={editForm.homeAway}
                          onValueChange={(value: 'home' | 'away') => setEditForm({ ...editForm, homeAway: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="home">Hazai</SelectItem>
                            <SelectItem value="away">Vendég</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Eredmény */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-sm text-secondary mb-2 block">Saját</label>
                          <Input
                            type="number"
                            value={editForm.ourScore}
                            onChange={(e) => setEditForm({ ...editForm, ourScore: parseInt(e.target.value) || 0 })}
                          />
                        </div>
                        <div>
                          <label className="text-sm text-secondary mb-2 block">Ellenfél</label>
                          <Input
                            type="number"
                            value={editForm.oppScore}
                            onChange={(e) => setEditForm({ ...editForm, oppScore: parseInt(e.target.value) || 0 })}
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
                        className="border-border-subtle hover:bg-surface-2 text-secondary"
                      >
                        <X size={14} className="mr-2" strokeWidth={1.6} />
                        Mégse
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveEdit}
                      >
                        <Save size={14} className="mr-2" strokeWidth={1.6} />
                        Mentés
                      </Button>
                    </div>
                  </div>
                ) : (
                  // Normál megjelenítés
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1.5fr_auto] gap-4 sm:gap-6 items-start md:items-center">
                  {/* Dátum */}
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Calendar className="text-secondary shrink-0" size={18} strokeWidth={1.6} />
                    <div>
                      <div className="text-primary font-medium text-sm sm:text-base">{date}</div>
                      <div className="text-muted text-xs sm:text-sm">
                        {game.homeAway === 'home' ? 'Hazai' : 'Vendég'}
                      </div>
                    </div>
                  </div>

                  {/* Ellenfél */}
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Users className="text-secondary shrink-0" size={18} strokeWidth={1.6} />
                    <div>
                      <div className="text-primary font-medium text-sm sm:text-base">{game.opponent}</div>
                      <div className="text-muted text-xs sm:text-sm">Ellenfél</div>
                    </div>
                  </div>

                  {/* Eredmény */}
                  <div className="flex items-center gap-2 sm:gap-3">
                    {isWin ? (
                      <Trophy className="text-positive shrink-0" size={18} strokeWidth={1.6} />
                    ) : (
                      <TrendingDown className="text-negative shrink-0" size={18} strokeWidth={1.6} />
                    )}
                    <div>
                      <div className="text-primary font-bold font-mono tabular-nums text-lg sm:text-xl">
                        {game.ourScore} : {game.oppScore}
                      </div>
                      <div className="text-muted text-xs sm:text-sm">
                        {isWin ? 'Győzelem' : 'Vereség'} ({Math.abs(game.ourScore - game.oppScore)} pont)
                      </div>
                    </div>
                  </div>

                  {/* Státusz badge + Gombok egy konténerben */}
                  <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-start md:justify-end">
                    <Badge className={`text-xs sm:text-sm ${isWin ? 'badge-positive' : 'badge-negative'}`}>
                      {isWin ? '✓ Győzelem' : '✗ Vereség'}
                    </Badge>

                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewingGameId(game.id)}
                        className="border-border-subtle hover:bg-surface-2 text-xs sm:text-sm w-full sm:w-auto"
                      >
                        <Eye size={14} className="mr-1 sm:mr-2 shrink-0" strokeWidth={1.6} />
                        Részletek
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditGame(game)}
                        className="border-border-subtle hover:bg-surface-2 text-xs sm:text-sm w-full sm:w-auto"
                      >
                        <Edit size={14} className="mr-1 sm:mr-2 shrink-0" strokeWidth={1.6} />
                        Szerkesztés
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteGame(game.id, game.opponent, game.date)}
                        disabled={isDeleting}
                        className="text-xs sm:text-sm w-full sm:w-auto"
                      >
                        {isDeleting ? (
                          <>
                            <Loader2 className="mr-1 sm:mr-2 animate-spin shrink-0" size={14} />
                            Törlés...
                          </>
                        ) : (
                          <>
                            <Trash2 className="mr-1 sm:mr-2 shrink-0" size={14} strokeWidth={1.6} />
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
      <Card className="mt-4 sm:mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Összefoglaló</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="text-center p-2">
              <div className="text-2xl sm:text-3xl font-mono tabular-nums font-bold text-primary">{games.length}</div>
              <div className="text-secondary text-xs sm:text-sm">Összes meccs</div>
            </div>
            <div className="text-center p-2">
              <div className="text-2xl sm:text-3xl font-mono tabular-nums font-bold text-positive">
                {games.filter((g) => g.result === 'win').length}
              </div>
              <div className="text-secondary text-xs sm:text-sm">Győzelem</div>
            </div>
            <div className="text-center p-2">
              <div className="text-2xl sm:text-3xl font-mono tabular-nums font-bold text-negative">
                {games.filter((g) => g.result === 'loss').length}
              </div>
              <div className="text-secondary text-xs sm:text-sm">Vereség</div>
            </div>
            <div className="text-center p-2">
              <div className="text-2xl sm:text-3xl font-mono tabular-nums font-bold text-primary">
                {games.length > 0
                  ? ((games.filter((g) => g.result === 'win').length / games.length) * 100).toFixed(1)
                  : 0}
                %
              </div>
              <div className="text-secondary text-xs sm:text-sm">Győzelmi arány</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
