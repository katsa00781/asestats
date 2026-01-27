import { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Users, Trash2, Loader2, AlertTriangle, Edit2, Check, X, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type Player = {
  id: string;
  name: string;
  number: number;
  position: string;
  season_id: string;
  season_name?: string;
  team_id: string;
  team_name?: string;
};

type Team = {
  id: string;
  name: string;
};

type PlayersManagementProps = {
  onPlayersChanged?: () => void;
};

export function PlayersManagement({ onPlayersChanged }: PlayersManagementProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingPlayerId, setDeletingPlayerId] = useState<string | null>(null);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editedName, setEditedName] = useState('');
  const [editedNumber, setEditedNumber] = useState(0);
  const [editedTeamId, setEditedTeamId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('all');

  const loadTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setTeams(data || []);
    } catch (error) {
      console.error('Hiba a csapatok betöltésekor:', error);
    }
  };

  const loadPlayers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('players')
        .select(`
          id,
          name,
          number,
          position,
          season_id,
          team_id,
          birth_year,
          height,
          weight,
          seasons!inner(name),
          teams!inner(name)
        `)
        .order('number', { ascending: true });

      if (error) throw error;

      // Formázzuk az adatokat
      const formattedPlayers = (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        number: p.number,
        position: p.position,
        season_id: p.season_id,
        team_id: p.team_id,
        season_name: p.seasons?.name || '',
        team_name: p.teams?.name || ''
      }));

      // Szűrjük ki az érvénytelen játékosokat
      const validPlayers = formattedPlayers.filter((p: Player) => {
        const isNameOnlyNumbers = /^\d+$/.test(p.name);
        const isNumberTooHigh = p.number > 99;
        return !isNameOnlyNumbers && !isNumberTooHigh;
      });

      setPlayers(validPlayers);
    } catch (error) {
      console.error('Hiba a játékosok betöltésekor:', error);
      toast.error('Nem sikerült betölteni a játékosokat');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeams();
    loadPlayers();
  }, []);

  const handleDeletePlayer = async (player: Player) => {
    // Ellenőrizzük, van-e másik rekord ugyanezzel a névvel és mezszámmal
    const duplicates = players.filter(p => 
      p.id !== player.id && 
      p.name.toLowerCase().trim() === player.name.toLowerCase().trim() && 
      p.number === player.number
    );

    console.log('Törlés - Duplikátumok keresése:', {
      player: { id: player.id, name: player.name, number: player.number },
      duplicatesFound: duplicates.length,
      duplicates: duplicates.map(d => ({ id: d.id, name: d.name, number: d.number, team: d.team_name }))
    });

    if (duplicates.length > 0) {
      // Van duplikátum - felajánljuk az egyesítést
      const targetPlayer = duplicates[0];
      const confirmed = window.confirm(
        `⚠️ Találtam másik játékost ugyanezzel a névvel és mezszámmal:\n\n` +
        `Törölni kívánt: ${player.name} (#${player.number}) - ${player.team_name} (${player.season_name})\n` +
        `Megtartandó: ${targetPlayer.name} (#${targetPlayer.number}) - ${targetPlayer.team_name} (${targetPlayer.season_name})\n\n` +
        `Áthelyezzem a törlendő játékos összes statisztikáját a megtartandó játékoshoz, ` +
        `és utána töröljem a rekordot?\n\n` +
        `(Ha "Mégse"-t választasz, akkor semmilyen törlés nem történik.)`
      );

      if (!confirmed) return;

      setDeletingPlayerId(player.id);

      try {
        console.log('Statisztikák áthelyezése:', player.id, '->', targetPlayer.id);
        
        // 1. Ellenőrizzük hány statisztika van
        const { data: statsToMove, error: statsCheckError } = await supabase
          .from('player_game_stats')
          .select('id')
          .eq('player_id', player.id);

        if (statsCheckError) throw statsCheckError;
        const originalStatsCount = statsToMove?.length || 0;
        console.log(`Áthelyezendő statisztikák száma: ${originalStatsCount}`);

        // 2. Áthelyezzük a statisztikákat
        if (originalStatsCount > 0) {
          const { error: updateError } = await supabase
            .from('player_game_stats')
            .update({ player_id: targetPlayer.id })
            .eq('player_id', player.id);

          if (updateError) throw updateError;
          console.log('Statisztikák áthelyezve');

          // 3. BIZTONSÁGI ELLENŐRZÉS: Tényleg áthelyeződtek?
          const { data: remainingStats, error: remainingError } = await supabase
            .from('player_game_stats')
            .select('id')
            .eq('player_id', player.id);

          if (remainingError) throw remainingError;

          if (remainingStats && remainingStats.length > 0) {
            throw new Error(`HIBA: ${remainingStats.length} statisztika még mindig a régi játékosnál van! Törlés megszakítva.`);
          }

          // 4. Ellenőrizzük hogy megérkeztek a célhoz
          const { data: targetStats, error: targetError } = await supabase
            .from('player_game_stats')
            .select('id')
            .eq('player_id', targetPlayer.id);

          if (targetError) throw targetError;

          console.log(`Cél játékosnál lévő statisztikák: ${targetStats?.length || 0} (várható: legalább ${originalStatsCount})`);
        }

        // 5. Most már biztonságosan törölhetjük a játékos rekordot
        const { error: playerError } = await supabase
          .from('players')
          .delete()
          .eq('id', player.id);

        if (playerError) throw playerError;
        console.log('Játékos rekord törölve');

        // 6. Várunk egy kicsit hogy a Supabase cache frissüljön
        await new Promise(resolve => setTimeout(resolve, 500));

        // 7. Ellenőrizzük hogy tényleg törlődött-e (maybeSingle használatával)
        const { data: checkDeleted, error: checkError } = await supabase
          .from('players')
          .select('id, name')
          .eq('id', player.id)
          .maybeSingle();

        if (checkError) {
          console.error('Ellenőrzési hiba:', checkError);
        }

        if (checkDeleted) {
          console.log('FIGYELEM: A játékos még mindig létezik az adatbázisban!', checkDeleted);
          throw new Error('A törlés nem sikerült - a rekord még létezik!');
        }

        console.log('Törlés ellenőrzése: Sikeres');

        toast.success(
          `${player.name} sikeresen ${originalStatsCount > 0 ? 'egyesítve és ' : ''}törölve!` +
          (originalStatsCount > 0 ? `\n${originalStatsCount} statisztika megmaradt és átkerült a másik rekordhoz.` : '')
        );

        // 8. Újratöltjük a listát
        console.log('Lista újratöltése...');
        await loadPlayers();

        // NE hívjuk meg az onPlayersChanged()-et, mert az újratölti az egész főoldalt
        // és visszahozza a játékost az ASE csapatba a VIEW-ból
        // if (onPlayersChanged) {
        //   onPlayersChanged();
        // }
      } catch (error) {
        console.error('Hiba az egyesítés során:', error);
        toast.error('Hiba történt az egyesítés során!');
      } finally {
        setDeletingPlayerId(null);
      }
    } else {
      // Nincs duplikátum - normál törlés
      const confirmed = window.confirm(
        `⚠️ Biztosan törölni szeretnéd ${player.name} (#${player.number}) játékost?\n\n` +
        `Csapat: ${player.team_name}\n` +
        `Szezon: ${player.season_name}\n\n` +
        `Ez törli az összes meccs statisztikáját is, ami ehhez a játékoshoz tartozik!\n\n` +
        `Ez a művelet NEM visszavonható!`
      );

      if (!confirmed) return;

      setDeletingPlayerId(player.id);

      try {
        // Először töröljük a player_game_stats rekordokat
        const { error: statsError } = await supabase
          .from('player_game_stats')
          .delete()
          .eq('player_id', player.id);

        if (statsError) throw statsError;

        // Aztán a players rekordot
        const { error: playerError } = await supabase
          .from('players')
          .delete()
          .eq('id', player.id);

        if (playerError) throw playerError;

        toast.success(`${player.name} sikeresen törölve!`);

        await loadPlayers();

        // NE hívjuk meg az onPlayersChanged()-et normál törlésnél sem
        // if (onPlayersChanged) {
        //   onPlayersChanged();
        // }
      } catch (error) {
        console.error('Hiba a játékos törlésekor:', error);
        toast.error('Hiba történt a játékos törlésekor!');
      } finally {
        setDeletingPlayerId(null);
      }
    }
  };

  const startEditingPlayer = (player: Player) => {
    setEditingPlayerId(player.id);
    setEditedName(player.name);
    setEditedNumber(player.number);
    setEditedTeamId(player.team_id);
  };

  const cancelEditing = () => {
    setEditingPlayerId(null);
    setEditedName('');
    setEditedNumber(0);
    setEditedTeamId('');
  };

  const savePlayerEdits = async (playerId: string) => {
    if (!editedName.trim()) {
      toast.error('A név nem lehet üres!');
      return;
    }

    if (editedNumber < 0 || editedNumber > 99) {
      toast.error('A mezszám 0 és 99 között kell legyen!');
      return;
    }

    if (!editedTeamId) {
      toast.error('Válassz csapatot!');
      return;
    }

    try {
      // Ellenőrizzük, hogy van-e már ilyen mezszámú játékos a célcsapatban/szezonban
      const currentPlayer = players.find(p => p.id === playerId);
      if (!currentPlayer) return;

      const { data: existingPlayer, error: checkError } = await supabase
        .from('players')
        .select('id, name, number, team_id')
        .eq('number', editedNumber)
        .eq('team_id', editedTeamId)
        .eq('season_id', currentPlayer.season_id)
        .neq('id', playerId)
        .maybeSingle();

      if (checkError) {
        console.error('Ellenőrzési hiba:', checkError);
        throw checkError;
      }

      // Ha van ilyen játékos az új csapatnál
      if (existingPlayer) {
        // Ha a név is egyezik -> egyesítés
        if (existingPlayer.name.toLowerCase().trim() === editedName.toLowerCase().trim()) {
          const confirmed = window.confirm(
            `🔄 Van már ilyen játékos az új csapatnál. Egyesítem őket:\n\n` +
            `Jelenlegi (MEGTARTVA): ${currentPlayer.name} (#${currentPlayer.number}) - ${currentPlayer.team_name}\n` +
            `Duplikátum (TÖRLÉSRE): ${existingPlayer.name} (#${existingPlayer.number}) - ${teams.find(t => t.id === editedTeamId)?.name}\n\n` +
            `A duplikátum összes statisztikája átkerül a jelenlegi játékoshoz,\n` +
            `majd a csapata megváltozik és a duplikátum törlődik.\n\n` +
            `Folytatod?`
          );

          if (!confirmed) return;

          // Egyesítés logika - FORDÍTVA!
          console.log('Egyesítés (FORDÍTOTT):', existingPlayer.id, '->', playerId);

          // 1. A DUPLIKÁTUM statisztikáit áthelyezzük a JELENLEGI játékoshoz
          const { data: statsToMove, error: statsCheckError } = await supabase
            .from('player_game_stats')
            .select('id')
            .eq('player_id', existingPlayer.id);

          if (statsCheckError) throw statsCheckError;
          const statsCount = statsToMove?.length || 0;
          console.log(`Áthelyezendő statisztikák (duplikátumról): ${statsCount}`);

          // 2. Áthelyezés
          if (statsCount > 0) {
            const { error: updateError } = await supabase
              .from('player_game_stats')
              .update({ player_id: playerId })
              .eq('player_id', existingPlayer.id);

            if (updateError) throw updateError;

            // Ellenőrzés
            const { data: remainingStats } = await supabase
              .from('player_game_stats')
              .select('id')
              .eq('player_id', existingPlayer.id);

            if (remainingStats && remainingStats.length > 0) {
              throw new Error(`HIBA: ${remainingStats.length} statisztika még a duplikátumnál van!`);
            }
          }

          // 3. Most már módosíthatjuk a jelenlegi játékos csapatát (nincs ütközés, mert töröljük a duplikátumot)
          const { error: updateTeamError } = await supabase
            .from('players')
            .update({ 
              name: editedName.trim(),
              number: editedNumber,
              team_id: editedTeamId
            })
            .eq('id', playerId);

          if (updateTeamError) throw updateTeamError;
          console.log('Jelenlegi játékos csapata módosítva');

          // 4. Töröljük a duplikátumot
          const { error: deleteError } = await supabase
            .from('players')
            .delete()
            .eq('id', existingPlayer.id);

          if (deleteError) throw deleteError;
          console.log('Duplikátum törölve');

          toast.success(
            `Játékos sikeresen áthelyezve az új csapathoz!` +
            (statsCount > 0 ? `\n${statsCount} statisztika átvéve a duplikátumtól.` : '')
          );

          await loadPlayers();
          cancelEditing();
          return;
        } else {
          // Más névvel, csak a mezszám egyezik
          toast.error(
            `A #${editedNumber} mezszám már foglalt ennél a csapatnál!\n` +
            `Jelenlegi tulajdonos: ${existingPlayer.name}`
          );
          return;
        }
      }

      // Nincs ütközés - egyszerű mentés
      const { data, error } = await supabase
        .from('players')
        .update({ 
          name: editedName.trim(),
          number: editedNumber,
          team_id: editedTeamId
        })
        .eq('id', playerId)
        .select();

      if (error) {
        console.error('Supabase hiba:', error);
        throw error;
      }

      toast.success('Játékos sikeresen módosítva!');

      await loadPlayers();
      cancelEditing();

      // NE hívjuk meg az onPlayersChanged()-et
    } catch (error) {
      console.error('Hiba a módosításkor:', error);
      const errorMessage = (error as any)?.message || 'Ismeretlen hiba';
      toast.error('Hiba történt a módosításkor: ' + errorMessage);
    }
  };

  // Szűrés keresés és csapat szerint
  const filteredPlayers = players.filter(player => {
    const matchesSearch = searchQuery === '' || 
      player.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      player.number.toString().includes(searchQuery);
    
    const matchesTeam = selectedTeamFilter === 'all' || player.team_id === selectedTeamFilter;
    
    return matchesSearch && matchesTeam;
  });

  const cleanupInvalidPlayers = async () => {
    const confirmed = window.confirm(
      '⚠️ Ez törli az összes érvénytelen játékost az adatbázisból:\n\n' +
      '- Játékosok, akiknek a neve csak számokból áll (pl. "250")\n' +
      '- Játékosok, akiknek a mezo száma nagyobb mint 99\n\n' +
      'Folytatod?'
    );

    if (!confirmed) return;

    setLoading(true);

    try {
      // Lekérdezzük az összes játékost
      const { data: allPlayers, error: fetchError } = await supabase
        .from('players')
        .select('*');

      if (fetchError) throw fetchError;

      // Szűrjük ki az érvénytelen játékosokat
      const invalidPlayers = (allPlayers || []).filter((p: Player) => {
        const isNameOnlyNumbers = /^\d+$/.test(p.name);
        const isNumberTooHigh = p.number > 99;
        return isNameOnlyNumbers || isNumberTooHigh;
      });

      if (invalidPlayers.length === 0) {
        toast.info('Nincsenek érvénytelen játékosok az adatbázisban');
        setLoading(false);
        return;
      }

      console.log(`Törlésre kerülő játékosok:`, invalidPlayers);

      // Töröljük őket egyesével
      for (const player of invalidPlayers) {
        // Először a statisztikák
        await supabase
          .from('player_game_stats')
          .delete()
          .eq('player_id', player.id);

        // Aztán a játékos
        await supabase
          .from('players')
          .delete()
          .eq('id', player.id);
      }

      toast.success(`${invalidPlayers.length} érvénytelen játékos törölve!`);

      // Frissítjük a listát
      await loadPlayers();

      if (onPlayersChanged) {
        onPlayersChanged();
      }
    } catch (error) {
      console.error('Hiba a cleanup során:', error);
      toast.error('Hiba történt a cleanup során!');
    } finally {
      setLoading(false);
    }
  };

  const positionLabels: Record<string, string> = {
    '1': '1 - Irányító',
    '2': '2 - Dobóhátvéd',
    '3': '3 - Kiscsatár',
    '4': '4 - Erőcsatár',
    '5': '5 - Center',
    '1-2': '1-2 - Irányító/Dobóhátvéd',
    '2-3': '2-3 - Dobóhátvéd/Kiscsatár',
    '3-4': '3-4 - Kiscsatár/Erőcsatár',
    '4-5': '4-5 - Erőcsatár/Center',
    '5-4': '5-4 - Center/Erőcsatár',
  };

  // Automatikus betöltés komponens létrehozásakor
  // (már az useEffect-ben van)

  if (loading && players.length === 0) {
    return (
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="py-12">
          <div className="text-center text-slate-400">
            <Loader2 size={48} className="mx-auto mb-4 opacity-50 animate-spin" />
            <p>Játékosok betöltése...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-50 mb-2 flex items-center gap-2">
          <Users size={28} />
          Játékosok kezelése
        </h2>
        <p className="text-slate-400">Összesen {filteredPlayers.length} játékos {searchQuery || selectedTeamFilter !== 'all' ? `(${players.length} közül)` : ''}</p>
      </div>

      {/* Keresés és szűrés */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Keresés név vagy mezszám szerint..."
            className="pl-10 bg-slate-800 border-slate-700 text-slate-100"
          />
        </div>
        <select
          value={selectedTeamFilter}
          onChange={(e) => setSelectedTeamFilter(e.target.value)}
          className="h-10 px-3 bg-slate-800 border border-slate-700 text-slate-300 rounded-md"
        >
          <option value="all">Összes csapat</option>
          {teams.map(team => (
            <option key={team.id} value={team.id}>{team.name}</option>
          ))}
        </select>
      </div>

      {filteredPlayers.length === 0 ? (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="py-12">
            <div className="text-center text-slate-400">
              <Users size={48} className="mx-auto mb-4 opacity-50" />
              <p>{searchQuery || selectedTeamFilter !== 'all' ? 'Nincs találat a keresésre' : 'Még nincsenek játékosok az adatbázisban'}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Figyelmeztetés */}
          <Card className="bg-amber-900/20 border-amber-700/50">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="text-amber-400 mt-0.5" size={20} />
                <div className="text-amber-300 text-sm">
                  <strong>Figyelem!</strong> A játékos törlése az összes hozzá tartozó meccs statisztikát is törli.
                  Ez a művelet nem visszavonható!
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Játékosok lista */}
          <div className="grid gap-3">
            {filteredPlayers.map((player) => {
              const isDeleting = deletingPlayerId === player.id;
              const isEditing = editingPlayerId === player.id;

              return (
                <Card
                  key={player.id}
                  className={`bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors ${
                    isDeleting ? 'opacity-50' : ''
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1">
                        {/* Mezo szám - szerkeszthető */}
                        {isEditing ? (
                          <Input
                            type="number"
                            value={editedNumber}
                            onChange={(e) => setEditedNumber(parseInt(e.target.value) || 0)}
                            className="w-20 bg-slate-800 border-slate-700 text-slate-100 text-center font-bold"
                            min={0}
                            max={99}
                          />
                        ) : (
                          <div className="flex items-center justify-center w-12 h-12 bg-slate-800 rounded-lg shrink-0">
                            <span className="text-slate-50 font-bold text-lg">#{player.number}</span>
                          </div>
                        )}

                        {/* Név, csapat, szezon - szerkeszthető */}
                        {isEditing ? (
                          <div className="flex-1 space-y-2">
                            <Input
                              value={editedName}
                              onChange={(e) => setEditedName(e.target.value)}
                              className="bg-slate-800 border-slate-700 text-slate-100"
                              placeholder="Játékos neve"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  savePlayerEdits(player.id);
                                } else if (e.key === 'Escape') {
                                  cancelEditing();
                                }
                              }}
                            />
                            <select
                              value={editedTeamId}
                              onChange={(e) => setEditedTeamId(e.target.value)}
                              className="w-full h-10 px-3 bg-slate-800 border border-slate-700 text-slate-300 rounded-md"
                            >
                              {teams.map(team => (
                                <option key={team.id} value={team.id}>{team.name}</option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <div className="flex-1">
                            <div className="text-slate-50 font-medium">{player.name}</div>
                            <div className="flex items-center gap-2 mt-1 text-slate-400 text-sm">
                              <Badge variant="outline" className="border-slate-700 text-slate-300">
                                {positionLabels[player.position] || player.position}
                              </Badge>
                              <span>•</span>
                              <span>{player.team_name}</span>
                              <span>•</span>
                              <span>{player.season_name}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Gombok */}
                      <div className="flex items-center gap-2">
                        {isEditing ? (
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => savePlayerEdits(player.id)}
                              className="bg-emerald-600 hover:bg-emerald-700"
                            >
                              <Check className="mr-2" size={16} />
                              Mentés
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={cancelEditing}
                              className="border-slate-700 text-slate-300 hover:bg-slate-800"
                            >
                              <X className="mr-2" size={16} />
                              Mégse
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => startEditingPlayer(player)}
                              disabled={isDeleting}
                              className="border-slate-700 text-slate-300 hover:bg-slate-800"
                            >
                              <Edit2 className="mr-2" size={16} />
                              Szerkesztés
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeletePlayer(player)}
                              disabled={isDeleting}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              {isDeleting ? (
                                <>
                                  <Loader2 className="mr-2 animate-spin" size={16} />
                                  Törlés...
                                </>
                              ) : (
                                <>
                                  <Trash2 className="mr-2" size={16} />
                                  Törlés
                                </>
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          onClick={cleanupInvalidPlayers}
          disabled={loading}
          className="border-amber-700 text-amber-300 hover:bg-amber-900/20"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 animate-spin" size={16} />
              Feldolgozás...
            </>
          ) : (
            <>
              <AlertTriangle className="mr-2" size={16} />
              Érvénytelen játékosok törlése
            </>
          )}
        </Button>

        <Button
          variant="outline"
          onClick={loadPlayers}
          disabled={loading}
          className="border-slate-700 text-slate-300 hover:bg-slate-800"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 animate-spin" size={16} />
              Frissítés...
            </>
          ) : (
            'Frissítés'
          )}
        </Button>
      </div>
    </div>
  );
}
