'use client';
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Users, Eye, CheckCircle, AlertCircle, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type ParsedPlayer = {
  number: number;
  name: string;
  birthYear: number;
  position: string;
  height: number;
  weight: number;
};

type PlayersImportProps = {
  onImportComplete: () => void;
  selectedSeasonId: string | null;
  selectedTeamId: string | null;
  selectedSeasonName?: string;
  selectedTeamName?: string;
  allSeasons: { id: string; name: string }[];
  allTeams: { id: string; name: string }[];
};

export function PlayersImport({ 
  onImportComplete, 
  selectedSeasonId, 
  selectedTeamId,
  selectedSeasonName,
  selectedTeamName,
  allSeasons,
  allTeams,
}: PlayersImportProps) {
  const [inputText, setInputText] = useState('');
  const [parsedPlayers, setParsedPlayers] = useState<ParsedPlayer[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [targetSeasonId, setTargetSeasonId] = useState<string | null>(selectedSeasonId);
  const [targetTeamId, setTargetTeamId] = useState<string | null>(selectedTeamId);

  useEffect(() => {
    setTargetSeasonId(selectedSeasonId ?? null);
  }, [selectedSeasonId]);

  useEffect(() => {
    setTargetTeamId(selectedTeamId ?? null);
  }, [selectedTeamId]);

  const resolvedSeasonName = targetSeasonId
    ? allSeasons.find(season => season.id === targetSeasonId)?.name
    : selectedSeasonName;
  const resolvedTeamName = targetTeamId
    ? allTeams.find(team => team.id === targetTeamId)?.name
    : selectedTeamName;

  const parsePlayersData = (text: string): ParsedPlayer[] => {
    const players: ParsedPlayer[] = [];
    const lines = text.trim().split('\n').map(l => l.trim()).filter(l => l);

    const normalizePositionInput = (rawPosition: string) => {
      const normalized = rawPosition?.toUpperCase().replace(/\s+/g, '') || '';
      const digits = normalized.match(/[1-5]/g) || [];
      if (digits.length > 0) {
        const unique = Array.from(new Set(digits));
        if (unique.length === 1) return unique[0];
        return `${unique[0]}-${unique[1]}`;
      }

      if (normalized.includes('PG')) return '1';
      if (normalized.includes('SG')) return '2';
      if (normalized.includes('SF')) return '3';
      if (normalized.includes('PF')) return '4';
      if (normalized === 'G' || normalized.includes('G/')) return '1-2';
      if (normalized === 'F' || normalized.includes('F/')) return '3-4';
      if (normalized.includes('C')) return '5';

      return rawPosition.trim();
    };

    for (const line of lines) {
      // Kihagyja a fejléc sort
      if (line.includes('Játékos') || line.includes('Születési év') || line.includes('Poszt')) {
        continue;
      }

      try {
        // Tab-elválasztott formátum
        const parts = line.split('\t').filter(p => p.trim());
        
        if (parts.length < 6) continue;

        // Parse mezszám
        const number = parseInt(parts[0]);
        if (isNaN(number)) continue;

        // Parse név - eltávolítja a "player avatar" szöveget és a képeket
        let name = parts[1]
          .replace(/player avatar/gi, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        // Nagybetűs vezetéknevek javítása (pl. "HUSZáR Balázs" -> "Huszár Balázs")
        // és ékezetes karakterek helyreállítása
        name = name.split(' ').map(word => {
          // Ha az egész szó csupa nagybetű (pl. "HUSZáR", "PALLAI"), akkor első betű nagybetű, többi kicsi
          if (word.length > 1 && word === word.toUpperCase()) {
            // toLowerCase() helyesen kezeli az ékezetes karaktereket is
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
          }
          // Egyébként hagyjuk eredeti formában (pl. "Tamás", "Balázs")
          return word;
        }).join(' ');

        // Parse születési év
        const birthYear = parseInt(parts[2]);
        if (isNaN(birthYear) || birthYear < 1900 || birthYear > 2020) continue;

        // Parse pozíció - egységesítjük 1-5 számozásra (1=PG, 5=C)
        const position = normalizePositionInput(parts[3].trim());
        if (!position) continue;

        // Parse magasság (pl. "193 cm" -> 193)
        const heightMatch = parts[4].match(/(\d+)\s*cm/);
        const height = heightMatch ? parseInt(heightMatch[1]) : 0;
        if (height === 0) continue;

        // Parse súly (pl. "86 kg" -> 86)
        const weightMatch = parts[5].match(/(\d+)\s*kg/);
        const weight = weightMatch ? parseInt(weightMatch[1]) : 0;
        if (weight === 0) continue;

        players.push({
          number,
          name,
          birthYear,
          position,
          height,
          weight,
        });
      } catch (error) {
        console.error('Hiba a sor feldolgozásakor:', line, error);
      }
    }

    return players;
  };

  const handlePreview = () => {
    const parsed = parsePlayersData(inputText);
    setParsedPlayers(parsed);
    setShowPreview(true);
    setMessage(null);
  };

  const handleImport = async () => {
    if (!targetSeasonId || !targetTeamId) {
      setMessage({
        type: 'error',
        text: 'Kérlek válassz szezont és csapatot!'
      });
      return;
    }

    if (parsedPlayers.length === 0) {
      setMessage({
        type: 'error',
        text: 'Nincs importálandó játékos!'
      });
      return;
    }

    setImporting(true);
    setMessage(null);

    try {
      let newPlayers = 0;
      let updatedPlayers = 0;
      let duplicateInOtherTeams = 0;
      let deactivatedPlayers = 0;

      const buildPlayerKey = (number?: number | null, name?: string | null) => {
        const normalizedName = name?.trim().toLowerCase();
        if (!normalizedName) return null;
        const normalizedNumber = typeof number === 'number' ? number : 'unknown';
        return `${normalizedName}::${normalizedNumber}`;
      };

      const normalizePlayerName = (value?: string | null) =>
        value
          ?.trim()
          .toLowerCase()
          .replace(/\s+/g, ' ') ?? '';

      const importedPlayerKeys = new Set<string>();
      const importedNameKeys = new Set<string>();

      parsedPlayers.forEach(player => {
        if (player.name) {
          importedNameKeys.add(player.name.trim().toLowerCase());
        }
        const key = buildPlayerKey(player.number, player.name);
        if (key) importedPlayerKeys.add(key);
      });

      for (const player of parsedPlayers) {
        // Csak a kiválasztott csapat rekordjait frissítjük, más csapat rekordjait nem mozgatjuk.
        const { data: allMatchingPlayers, error: matchingError } = await supabase
          .from('players')
          .select('id, team_id, name')
          .eq('number', player.number)
          .eq('season_id', targetSeasonId);

        if (matchingError) throw matchingError;

        const normalizedImportedName = normalizePlayerName(player.name);
        const nameMatchedPlayers = (allMatchingPlayers || []).filter(
          p => normalizePlayerName(p.name) === normalizedImportedName
        );

        const existingInCurrentTeam = nameMatchedPlayers.find(p => p.team_id === targetTeamId);
        const existingInOtherTeams = nameMatchedPlayers.filter(p => p.team_id !== targetTeamId);

        if (existingInCurrentTeam) {
          // Frissítjük a jelenlegi csapatban lévő rekordot
          const { error } = await supabase
            .from('players')
            .update({
              position: player.position,
              birth_year: player.birthYear,
              height: player.height,
              weight: player.weight,
              is_active: true,
            })
            .eq('id', existingInCurrentTeam.id);

          if (error) throw error;
          updatedPlayers++;
        } else {
          if (existingInOtherTeams.length > 0) {
            duplicateInOtherTeams += existingInOtherTeams.length;
          }

          // Nincs még ilyen játékos - új létrehozása
          const { error } = await supabase
            .from('players')
            .insert({
              number: player.number,
              name: player.name,
              position: player.position,
              birth_year: player.birthYear,
              height: player.height,
              weight: player.weight,
              season_id: targetSeasonId,
              team_id: targetTeamId,
              is_active: true,
            });

          if (error) throw error;
          newPlayers++;
        }
      }

      const { data: activePlayers, error: activePlayersError } = await supabase
        .from('players')
        .select('id, number, name')
        .eq('season_id', targetSeasonId)
        .eq('team_id', targetTeamId)
        .eq('is_active', true);

      if (activePlayersError) throw activePlayersError;

      const playersToDeactivate =
        activePlayers?.filter(player => {
          const key = buildPlayerKey(player.number, player.name);
          const normalizedName = player.name?.trim().toLowerCase() ?? '';
          const keepByKey = key ? importedPlayerKeys.has(key) : false;
          const keepByName = normalizedName ? importedNameKeys.has(normalizedName) : false;
          return !(keepByKey || keepByName);
        }) ?? [];

      const isLikelyFullRoster = parsedPlayers.length >= 8;

      if (isLikelyFullRoster && playersToDeactivate.length > 0) {
        const { error: deactivateError } = await supabase
          .from('players')
          .update({ is_active: false })
          .in(
            'id',
            playersToDeactivate.map(player => player.id)
          );

        if (deactivateError) throw deactivateError;
        deactivatedPlayers = playersToDeactivate.length;
      }

      const messageParts = [];
      if (newPlayers > 0) messageParts.push(`${newPlayers} új játékos`);
      if (updatedPlayers > 0) messageParts.push(`${updatedPlayers} frissítve`);
      if (duplicateInOtherTeams > 0) messageParts.push(`${duplicateInOtherTeams} egyező rekord más csapatban érintetlenül hagyva`);
      if (deactivatedPlayers > 0) messageParts.push(`${deactivatedPlayers} inaktiválva`);
      if (!isLikelyFullRoster) messageParts.push('inaktiválás kihagyva (részleges lista)');

      setMessage({
        type: 'success',
        text: `Sikeres importálás! ${messageParts.join(', ')}.`
      });
      setInputText('');
      setParsedPlayers([]);
      setShowPreview(false);
      onImportComplete();
    } catch (error) {
      console.error('Import error:', error);
      setMessage({
        type: 'error',
        text: 'Hiba az importálás során: ' + (error as Error).message
      });
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async () => {
    if (!targetSeasonId || !targetTeamId) {
      setMessage({
        type: 'error',
        text: 'Kérlek válassz szezont és csapatot!'
      });
      return;
    }

    if (parsedPlayers.length === 0) {
      setMessage({
        type: 'error',
        text: 'Nincs törölendő játékos!'
      });
      return;
    }

    setDeleting(true);
    setMessage(null);

    try {
      let deletedCount = 0;

      for (const player of parsedPlayers) {
        // Megkeressük a játékost
        const { data: existingPlayer } = await supabase
          .from('players')
          .select('id')
          .eq('number', player.number)
          .eq('season_id', targetSeasonId)
          .eq('team_id', targetTeamId)
          .single();

        if (existingPlayer) {
          // Töröljük a játékost
          const { error } = await supabase
            .from('players')
            .delete()
            .eq('id', existingPlayer.id);

          if (error) throw error;
          deletedCount++;
        }
      }

      setMessage({
        type: 'success',
        text: `Sikeresen törölve: ${deletedCount} játékos`
      });

      setInputText('');
      setParsedPlayers([]);
      setShowPreview(false);
      onImportComplete();
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Hiba a törlés során: ' + (error as Error).message
      });
    } finally {
      setDeleting(false);
    }
  };

  const positionLabels: Record<string, string> = {
    '1': 'Irányító',
    '2': 'Dobóhátvéd',
    '3': 'Kiscsatár',
    '4': 'Erőcsatár',
    '5': 'Center',
    '1-2': 'Irányító/Dobóhátvéd',
    '2-1': 'Dobóhátvéd/Irányító',
    '2-3': 'Dobóhátvéd/Kiscsatár',
    '3-2': 'Kiscsatár/Dobóhátvéd',
    '3-4': 'Kiscsatár/Erőcsatár',
    '4-3': 'Erőcsatár/Kiscsatár',
    '4-5': 'Erőcsatár/Center',
    '5-4': 'Center/Erőcsatár',
    // Régi formátum támogatása
    'G': 'Hátvéd',
    'F': 'Szélső',
    'C': 'Center',
  };

  return (
    <div className="space-y-6">
      {(!targetSeasonId || !targetTeamId) && (
        <Card className="border-orange-500/30 bg-orange-900/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-orange">
              <AlertCircle size={20} strokeWidth={1.6} />
              <span className="text-sm">
                Válassz szezont és csapatot a mentéshez!
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="text-positive" size={20} strokeWidth={1.6} />
            Játékosok Importálása
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-secondary block mb-2">Szezon (mentés célja)</label>
              <Select value={targetSeasonId ?? ''} onValueChange={(value) => setTargetSeasonId(value || null)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Válassz szezont..." className="truncate" />
                </SelectTrigger>
                <SelectContent>
                  {allSeasons.map(season => (
                    <SelectItem key={season.id} value={season.id}>
                      {season.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-secondary block mb-2">Csapat (mentés célja)</label>
              <Select value={targetTeamId ?? ''} onValueChange={(value) => setTargetTeamId(value || null)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Válassz csapatot..." className="truncate" />
                </SelectTrigger>
                <SelectContent>
                  {allTeams.map(team => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-secondary">
              Illeszd be a játékosok táblázatát
            </label>
            <Textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`#	Játékos	Születési év	Poszt	Magasság	Súly
0	player avatar DARTHARD Calvashawn Letre	2000	2	193 cm	86 kg
3	player avatar PALLAI Tamás Ottó	2001	2	195 cm	88 kg
4	player avatar BARNES Auston Willis	1991	3-4	202 cm	102 kg`}
              className="font-mono text-sm"
              style={{ minHeight: 200 }}
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handlePreview}
              disabled={!inputText.trim()}
              variant="secondary"
            >
              <Eye size={16} className="mr-2" strokeWidth={1.6} />
              Előnézet
            </Button>
            {showPreview && parsedPlayers.length > 0 && (
              <>
                <Button
                  onClick={handleImport}
                  disabled={importing || deleting}
                >
                  <CheckCircle size={16} className="mr-2" strokeWidth={1.6} />
                  {importing ? 'Importálás...' : `Import (${parsedPlayers.length} játékos)`}
                </Button>
                <Button
                  onClick={handleDelete}
                  disabled={importing || deleting}
                  variant="destructive"
                >
                  <Trash2 size={16} className="mr-2" strokeWidth={1.6} />
                  {deleting ? 'Törlés...' : `Törlés (${parsedPlayers.length} játékos)`}
                </Button>
              </>
            )}
          </div>

          {message && (
            <div className={`p-4 rounded-lg border ${
              message.type === 'success'
                ? 'bg-emerald-900/20 border-emerald-500/30 text-positive'
                : 'bg-red-900/20 border-red-500/30 text-negative'
            }`}>
              {message.text}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Előnézet */}
      {showPreview && (
        <Card>
          <CardHeader>
            <div className="space-y-2">
              <CardTitle className="text-lg">
                Előnézet - {parsedPlayers.length} játékos
              </CardTitle>
              {resolvedSeasonName && resolvedTeamName && (
                <div className="flex items-center gap-2 text-sm">
                  <Badge className="badge-cyan">
                    {resolvedSeasonName}
                  </Badge>
                  <Badge className="badge-positive">
                    {resolvedTeamName}
                  </Badge>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {parsedPlayers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border-subtle">
                      <th className="text-left text-secondary text-sm font-medium p-2">#</th>
                      <th className="text-left text-secondary text-sm font-medium p-2">Név</th>
                      <th className="text-left text-secondary text-sm font-medium p-2">Születési év</th>
                      <th className="text-left text-secondary text-sm font-medium p-2">Poszt</th>
                      <th className="text-left text-secondary text-sm font-medium p-2">Magasság</th>
                      <th className="text-left text-secondary text-sm font-medium p-2">Súly</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedPlayers.map((player, idx) => (
                      <tr key={idx} className="border-b border-border-subtle hover:bg-surface-2/50">
                        <td className="p-2 text-secondary">{player.number}</td>
                        <td className="p-2 text-primary font-medium">{player.name}</td>
                        <td className="p-2 text-secondary">{player.birthYear}</td>
                        <td className="p-2">
                          <Badge variant="secondary" className="text-xs">
                            {positionLabels[player.position] || player.position}
                          </Badge>
                        </td>
                        <td className="p-2 text-secondary">{player.height} cm</td>
                        <td className="p-2 text-secondary">{player.weight} kg</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="text-orange mx-auto mb-2" size={32} strokeWidth={1.5} />
                <p className="text-secondary">Nem sikerült játékosokat elemezni az adatokból.</p>
                <p className="text-muted text-sm mt-2">
                  Ellenőrizd, hogy a táblázat formátuma megfelelő-e (tab-elválasztott).
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
