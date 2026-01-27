'use client';
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
  selectedTeamId: string | null;
};

export function GameQuickImport({ onImportComplete, selectedSeasonId, selectedTeamId }: GameQuickImportProps) {
  const [inputText, setInputText] = useState('');
  const [parsedData, setParsedData] = useState<ParsedGameInfo | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
  };

  const handleImport = async () => {
    if (!parsedData || !parsedData.isValid) return;
    
    if (!selectedSeasonId || !selectedTeamId) {
      setMessage({ 
        type: 'error', 
        text: 'Kérlek válassz szezont és csapatot a meccs importálásához!' 
      });
      return;
    }

    setImporting(true);
    setMessage(null);

    try {
      // Lekérjük a csapat nevét, hogy eldöntsük, melyik a mi csapatunk
      const { data: teamData } = await supabase
        .from('teams')
        .select('name')
        .eq('id', selectedTeamId)
        .single();
      
      const ourTeamName = teamData?.name || '';
      
      // Eldöntjük, hogy a hazai vagy a vendég csapat vagyunk-e
      const ourTeamIsHome = parsedData.homeTeam.includes(ourTeamName) || 
                           ourTeamName.includes(parsedData.homeTeam);
      
      const gameData = {
        date: parsedData.date,
        opponent: ourTeamIsHome ? parsedData.awayTeam : parsedData.homeTeam,
        home_away: ourTeamIsHome ? 'home' : 'away',
        our_score: ourTeamIsHome ? parsedData.homeScore : parsedData.awayScore,
        opp_score: ourTeamIsHome ? parsedData.awayScore : parsedData.homeScore,
        result: (ourTeamIsHome ? parsedData.homeScore : parsedData.awayScore) > 
                (ourTeamIsHome ? parsedData.awayScore : parsedData.homeScore) ? 'win' : 'loss',
        round: parsedData.round,
        season_id: selectedSeasonId,
        our_team_id: selectedTeamId,
      };

      const { error } = await supabase.from('games').insert([gameData]);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Meccs sikeresen importálva!' });
      setInputText('');
      setParsedData(null);
      setShowPreview(false);
      
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
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {(!selectedSeasonId || !selectedTeamId) && (
        <Card className="bg-orange-900/20 border-orange-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-orange-400">
              <AlertCircle size={20} />
              <span className="text-sm">
                Válassz szezont és csapatot fent a gyors meccs importáláshoz!
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
