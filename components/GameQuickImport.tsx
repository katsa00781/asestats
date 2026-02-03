'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, CheckCircle, AlertCircle, Eye } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type ParsedGameInfo = {
  date: string;
  time: string;
  round: number | null;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  isValid: boolean;
  errors: string[];
};

type TeamOption = {
  id: string;
  name: string;
  short_name?: string;
  is_primary?: boolean;
};

type GameQuickImportProps = {
  onImportComplete: (gameData?: {
    date: string;
    homeTeamName: string;
    awayTeamName: string;
    homeScore: number;
    awayScore: number;
    round: number | null;
  }) => void;
  selectedSeasonId: string | null;
};

export function GameQuickImport({ onImportComplete, selectedSeasonId }: GameQuickImportProps) {
  const [inputText, setInputText] = useState('');
  const [parsedData, setParsedData] = useState<ParsedGameInfo | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [homeTeamId, setHomeTeamId] = useState('');
  const [awayTeamId, setAwayTeamId] = useState('');
  const importLockRef = useRef(false);

  const normalizeName = (value: string) =>
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim();

  const buildAbbreviation = (value: string) =>
    value
      .split(/[\s-]+/)
      .filter(Boolean)
      .map(token => (token.length <= 2 ? token : token[0]))
      .join('');

  const findTeamIdForName = useCallback((teamName: string): string => {
    const normalizedTarget = normalizeName(teamName);
    if (!normalizedTarget) return '';
    const targetAbbr = buildAbbreviation(normalizedTarget);

    const exact = teams.find(team => normalizeName(team.name) === normalizedTarget);
    if (exact) return exact.id;

    const shortMatch = teams.find(team => team.short_name && normalizeName(team.short_name) === normalizedTarget);
    if (shortMatch) return shortMatch.id;

    const abbreviationMatch = teams.find(team => {
      const normalizedShort = team.short_name ? normalizeName(team.short_name) : '';
      const teamAbbr = buildAbbreviation(normalizeName(team.name));
      return (
        (targetAbbr && normalizedShort && targetAbbr === normalizedShort) ||
        (targetAbbr && teamAbbr && targetAbbr === teamAbbr)
      );
    });
    if (abbreviationMatch) return abbreviationMatch.id;

    const partial = teams.find(team => {
      const normalizedTeam = normalizeName(team.name);
      const normalizedShort = team.short_name ? normalizeName(team.short_name) : '';
      return (
        normalizedTeam.includes(normalizedTarget) ||
        normalizedTarget.includes(normalizedTeam) ||
        (normalizedShort && normalizedTarget.includes(normalizedShort)) ||
        (normalizedShort && normalizedShort.includes(normalizedTarget))
      );
    });
    if (partial) return partial.id;

    return '';
  }, [teams]);

  useEffect(() => {
    let isMounted = true;

    const fetchTeams = async () => {
      setTeamsLoading(true);
      try {
        const { data, error } = await supabase
          .from('teams')
          .select('id, name, short_name, is_primary')
          .order('is_primary', { ascending: false })
          .order('name');

        if (!isMounted) return;
        if (error) {
          console.error('Csapatok lekérdezési hiba:', error);
          setTeams([]);
          return;
        }

        setTeams(data || []);
      } finally {
        if (isMounted) {
          setTeamsLoading(false);
        }
      }
    };

    fetchTeams();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!parsedData?.isValid || teams.length === 0) {
      return;
    }

    setHomeTeamId(prev => prev || findTeamIdForName(parsedData.homeTeam));
    setAwayTeamId(prev => prev || findTeamIdForName(parsedData.awayTeam));
  }, [parsedData, teams, findTeamIdForName]);

  // Parse the input text
  const parseGameInfo = (text: string): ParsedGameInfo => {
    const errors: string[] = [];
    let date = '';
    let time = '';
    let round: number | null = null;
    let homeTeam = '';
    let awayTeam = '';
    let homeScore = 0;
    let awayScore = 0;

    try {
      const lines = text.trim().split('\n').map(line => line.trim()).filter(line => line);

      // 1. sor: Dátum és idő (pl. "2025. 10. 11 | 18:00")
      const dateTimeMatch = lines[0]?.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\s*\|\s*(\d{1,2}):(\d{2})/);
      if (dateTimeMatch) {
        const [, year, month, day, hour, minute] = dateTimeMatch;
        date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        time = `${hour.padStart(2, '0')}:${minute}`;
      } else {
        errors.push('Dátum és idő formátum nem megfelelő (várható: ÉÉÉÉ. HH. NN | ÓÓ:PP)');
      }

      // 2. sor: Forduló (pl. "3. forduló")
      const roundMatch = lines[1]?.match(/(\d+)\.\s*forduló/i);
      if (roundMatch) {
        round = parseInt(roundMatch[1]);
      }

      // Eredmény sor keresése (pl. "104 - 96")
      const scoreLineIndex = lines.findIndex(line => /^\d+\s*-\s*\d+$/.test(line));
      if (scoreLineIndex !== -1) {
        const scoreMatch = lines[scoreLineIndex].match(/(\d+)\s*-\s*(\d+)/);
        if (scoreMatch) {
          homeScore = parseInt(scoreMatch[1]);
          awayScore = parseInt(scoreMatch[2]);
        }

        // Előző sor: hazai csapat
        if (scoreLineIndex > 0) {
          homeTeam = lines[scoreLineIndex - 1]
            .replace(/first teams logo/i, '')
            .replace(/logo/i, '')
            .trim();
        }

        // Következő sor: vendég csapat
        if (scoreLineIndex < lines.length - 1) {
          awayTeam = lines[scoreLineIndex + 1]
            .replace(/second teams logo/i, '')
            .replace(/logo/i, '')
            .trim();
        }
      } else {
        errors.push('Eredmény nem található (várható formátum: "104 - 96")');
      }

      if (!homeTeam) errors.push('Hazai csapat neve nem található');
      if (!awayTeam) errors.push('Vendég csapat neve nem található');

    } catch (error) {
      errors.push('Általános parsing hiba: ' + (error as Error).message);
    }

    return {
      date,
      time,
      round,
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      isValid: errors.length === 0,
      errors,
    };
  };

  const handlePreview = () => {
    const parsed = parseGameInfo(inputText);
    setParsedData(parsed);
    setShowPreview(true);
    setMessage(null);

    if (parsed.isValid) {
      setHomeTeamId(findTeamIdForName(parsed.homeTeam));
      setAwayTeamId(findTeamIdForName(parsed.awayTeam));
    } else {
      setHomeTeamId('');
      setAwayTeamId('');
    }
  };

  const handleImport = async () => {
    if (!parsedData || !parsedData.isValid) return;

    if (!selectedSeasonId) {
      setMessage({ 
        type: 'error', 
        text: 'Kérlek válassz szezont a meccs importálásához!' 
      });
      return;
    }

    if (!homeTeamId || !awayTeamId) {
      setMessage({
        type: 'error',
        text: 'Nem sikerült mindkét csapatot a rendszerhez kötni. Ellenőrizd a csapatválasztót!'
      });
      return;
    }

    if (homeTeamId === awayTeamId) {
      setMessage({
        type: 'error',
        text: 'A hazai és a vendég csapat nem lehet ugyanaz.'
      });
      return;
    }

    if (importLockRef.current) {
      return;
    }

    importLockRef.current = true;
    setImporting(true);
    setMessage(null);

    try {
      const teamOperations = [
        { teamId: homeTeamId, isHome: true },
        { teamId: awayTeamId, isHome: false }
      ];

      for (const teamOp of teamOperations) {
        const ourTeamIsHome = teamOp.isHome;
        const opponentName = ourTeamIsHome ? parsedData.awayTeam : parsedData.homeTeam;
        const ourScore = ourTeamIsHome ? parsedData.homeScore : parsedData.awayScore;
        const oppScore = ourTeamIsHome ? parsedData.awayScore : parsedData.homeScore;
        const result = ourScore > oppScore ? 'win' : 'loss';

        const { data: duplicateGame, error: duplicateError } = await supabase
          .from('games')
          .select('id')
          .eq('season_id', selectedSeasonId)
          .eq('our_team_id', teamOp.teamId)
          .eq('date', parsedData.date)
          .eq('opponent', opponentName)
          .maybeSingle();

        if (duplicateError) throw duplicateError;

        const gameData = {
          date: parsedData.date,
          opponent: opponentName,
          home_away: ourTeamIsHome ? 'home' : 'away',
          our_score: ourScore,
          opp_score: oppScore,
          result,
          round: parsedData.round,
          season_id: selectedSeasonId,
          our_team_id: teamOp.teamId,
        };

        if (duplicateGame) {
          const { error: updateError } = await supabase
            .from('games')
            .update(gameData)
            .eq('id', duplicateGame.id);

          if (updateError) throw updateError;
        } else {
          const { error } = await supabase.from('games').insert([gameData]);
          if (error) throw error;
        }
      }

      setMessage({ type: 'success', text: 'A meccs mindkét csapathoz rögzítve/aktualizálva lett!' });

      setInputText('');
      setParsedData(null);
      setShowPreview(false);
      setHomeTeamId('');
      setAwayTeamId('');
      
      // Átadjuk a létrehozott meccs adatait
      onImportComplete({
        date: parsedData.date,
        homeTeamName: parsedData.homeTeam,
        awayTeamName: parsedData.awayTeam,
        homeScore: parsedData.homeScore,
        awayScore: parsedData.awayScore,
        round: parsedData.round,
      });
    } catch (error) {
      console.error('Import error:', error);
      setMessage({ 
        type: 'error', 
        text: 'Hiba az importálás során: ' + (error as Error).message 
      });
    } finally {
      importLockRef.current = false;
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {!selectedSeasonId && (
        <Card className="bg-orange-900/20 border-orange-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-orange-400">
              <AlertCircle size={20} />
              <span className="text-sm">
                Válassz szezont fent a gyors meccs importálásához!
              </span>
            </div>
          </CardContent>
        </Card>
      )}
      
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-slate-50 flex items-center gap-2">
            <Calendar className="text-emerald-400" size={20} />
            Gyors Meccs Import
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-slate-300">
              Illeszd be a meccs adatait
            </label>
            <Textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`2025. 10. 11 | 18:00

3. forduló

Kometa-KVGY Kaposvári KK
104 - 96
Endo Plus Service-Honvéd`}
              className="min-h-[200px] bg-slate-800 border-slate-700 text-slate-300 font-mono text-sm"
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handlePreview}
              disabled={!inputText.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Eye size={16} className="mr-2" />
              Előnézet
            </Button>
            {showPreview && parsedData?.isValid && (
              <Button
                onClick={handleImport}
                disabled={importing}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <CheckCircle size={16} className="mr-2" />
                {importing ? 'Importálás...' : 'Import'}
              </Button>
            )}
          </div>

          {message && (
            <div className={`p-4 rounded-lg ${
              message.type === 'success' 
                ? 'bg-emerald-900/20 border border-emerald-500/30 text-emerald-400' 
                : 'bg-red-900/20 border border-red-500/30 text-red-400'
            }`}>
              {message.text}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Előnézet */}
      {showPreview && parsedData && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-slate-50 text-lg">Előnézet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {parsedData.isValid ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="text-emerald-400" size={20} />
                  <span className="text-emerald-400 font-medium">Sikeres feldolgozás</span>
                </div>

                <div className="grid grid-cols-2 gap-4 p-4 bg-slate-800/50 rounded-lg">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Dátum</div>
                    <div className="text-slate-200">{parsedData.date}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Időpont</div>
                    <div className="text-slate-200">{parsedData.time}</div>
                  </div>
                  {parsedData.round && (
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Forduló</div>
                      <div className="text-slate-200">{parsedData.round}. forduló</div>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-slate-800/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <Badge variant="secondary" className="mb-2">Hazai</Badge>
                      <div className="text-slate-200 font-medium">{parsedData.homeTeam}</div>
                    </div>
                    <div className="px-4">
                      <div className="text-2xl font-bold text-slate-50">
                        {parsedData.homeScore} - {parsedData.awayScore}
                      </div>
                    </div>
                    <div className="flex-1 text-right">
                      <Badge variant="secondary" className="mb-2">Vendég</Badge>
                      <div className="text-slate-200 font-medium">{parsedData.awayTeam}</div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-800/40 rounded-lg space-y-4">
                  <div className="text-xs text-slate-500 uppercase tracking-wide">Csapat-hozzárendelés</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="text-sm text-slate-400">Hazai csapat a rendszerben</div>
                      {teamsLoading ? (
                        <div className="h-10 rounded-md bg-slate-800 animate-pulse" />
                      ) : (
                        <Select value={homeTeamId} onValueChange={setHomeTeamId}>
                          <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200">
                            <SelectValue placeholder="Válassz hazai csapatot..." />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
                            {teams.map(team => (
                              <SelectItem key={team.id} value={team.id}>
                                {team.name}{team.is_primary ? ' ⭐' : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <p className="text-xs text-slate-500">
                        Automatikusan próbáljuk felismerni a megadott hazai csapatot, de itt felülírhatod.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm text-slate-400">Vendég csapat a rendszerben</div>
                      {teamsLoading ? (
                        <div className="h-10 rounded-md bg-slate-800 animate-pulse" />
                      ) : (
                        <Select value={awayTeamId} onValueChange={setAwayTeamId}>
                          <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200">
                            <SelectValue placeholder="Válassz vendég csapatot..." />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
                            {teams.map(team => (
                              <SelectItem key={team.id} value={team.id}>
                                {team.name}{team.is_primary ? ' ⭐' : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <p className="text-xs text-slate-500">
                        Fontos, hogy a vendég csapat is a megfelelő sorba kerüljön a Supabase-ben.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-500">
                  💡 Ellenőrizd az adatokat importálás előtt!
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="text-red-400" size={20} />
                  <span className="text-red-400 font-medium">Hibák a feldolgozás során</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-red-300 text-sm">
                  {parsedData.errors.map((error, idx) => (
                    <li key={idx}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
