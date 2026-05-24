'use client';
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';

type StandingRow = {
  position: number;
  team: string;
  matches: number;
  winPct: number;
  points: number;
  wins: number;
  losses: number;
  scored: number;
  conceded: number;
  streak: string;
  home: string;
  away: string;
  last5: string;
};

type StandingsImportProps = {
  onImportComplete?: () => void;
  selectedSeasonId?: string | null;
  selectedSeasonName?: string;
};

export function StandingsImport({ onImportComplete, selectedSeasonId, selectedSeasonName }: StandingsImportProps) {
  const [textData, setTextData] = useState('');
  const [matchday, setMatchday] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isImporting, setIsImporting] = useState(false);

  const parseStandingsData = (text: string): StandingRow[] => {
    const lines = text.trim().split('\n');
    const standings: StandingRow[] = [];

    for (const line of lines) {
      // Tabulátorral elválasztott oszlopok
      const parts = line.split('\t').map(p => p.trim());
      
      if (parts.length < 12) continue; // Minimum 12 oszlop kell
      
      // Ellenőrizzük, hogy számmal kezdődik-e (helyezés)
      const position = parseInt(parts[0].replace('.', ''));
      if (isNaN(position)) continue;

      // Csapat név tisztítása (emoji eltávolítása)
      const team = parts[1].replace(/^\s*[^\w\s-]+\s*/, '').trim();
      
      const matches = parseInt(parts[2]) || 0;
      const winPct = parseFloat(parts[3]) || 0;
      const points = parseInt(parts[4]) || 0;
      const wins = parseInt(parts[5]) || 0;
      const losses = parseInt(parts[6]) || 0;
      const scored = parseInt(parts[7]) || 0;
      const conceded = parseInt(parts[8]) || 0;
      const streak = parts[9] || '';
      const home = parts[10] || '';
      const away = parts[11] || '';
      const last5 = parts[12] || '';

      standings.push({
        position,
        team,
        matches,
        winPct,
        points,
        wins,
        losses,
        scored,
        conceded,
        streak,
        home,
        away,
        last5,
      });
    }

    return standings;
  };

  const handleImport = async () => {
    if (!selectedSeasonId) {
      toast.error('Válassz szezont a tabella importálásához!');
      return;
    }

    if (!textData.trim()) {
      toast.error('Nincs beillesztett adat!');
      return;
    }

    if (!matchday.trim()) {
      toast.error('Add meg a fordulószámot!');
      return;
    }

    setIsImporting(true);

    try {
      const standings = parseStandingsData(textData);

      if (standings.length === 0) {
        toast.error('Nem sikerült feldolgozni az adatokat. Ellenőrizd a formátumot!');
        setIsImporting(false);
        return;
      }

      // Ellenőrizzük, hogy létezik-e már ilyen forduló
      const { data: existing } = await supabase
        .from('standings')
        .select('id')
        .eq('season_id', selectedSeasonId)
        .eq('matchday', parseInt(matchday))
        .single();

      if (existing) {
        // Frissítjük a meglévő rekordot
        const { error: updateError } = await supabase
          .from('standings')
          .update({
            date,
            data: standings,
            updated_at: new Date().toISOString(),
          })
          .eq('season_id', selectedSeasonId)
          .eq('matchday', parseInt(matchday));

        if (updateError) throw updateError;
        toast.success(`${matchday}. forduló állása frissítve!`);
      } else {
        // Új rekord beszúrása
        const { error: insertError } = await supabase
          .from('standings')
          .insert({
            season_id: selectedSeasonId,
            matchday: parseInt(matchday),
            date,
            data: standings,
          });

        if (insertError) throw insertError;
        toast.success(`${matchday}. forduló állása mentve!`);
      }

      // Tisztítás
      setTextData('');
      setMatchday('');
      
      if (onImportComplete) {
        onImportComplete();
      }
    } catch (error) {
      console.error('Import hiba:', error);
      toast.error('Hiba történt az importálás során!');
    } finally {
      setIsImporting(false);
    }
  };

  const previewStandings = textData.trim() ? parseStandingsData(textData) : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Upload className="h-4 w-4 sm:h-5 sm:w-5" />
            Tabella Importálás
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted">
            Aktív szezon: {selectedSeasonName || 'nincs kiválasztva'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="matchday">Forduló</Label>
              <Input
                id="matchday"
                type="number"
                placeholder="pl. 8"
                value={matchday}
                onChange={(e) => setMatchday(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Dátum</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="standings-data">Tabella Adatok</Label>
            <Textarea
              id="standings-data"
              placeholder="Illeszd be ide a tabellát..."
              value={textData}
              onChange={(e) => setTextData(e.target.value)}
              rows={10}
              className="font-mono text-xs sm:text-sm"
            />
            <p className="text-xs text-muted">
              Másold ki a teljes tabellát (fejléccel együtt) és illeszd be ide.
            </p>
          </div>

          <Button
            onClick={handleImport}
            disabled={isImporting || !selectedSeasonId || !textData.trim() || !matchday.trim()}
            className="w-full"
          >
            {isImporting ? 'Importálás...' : 'Importálás'}
          </Button>
          {!matchday.trim() && textData.trim() && (
            <p className="text-sm text-warning">
              Add meg a fordulószámot az importáláshoz!
            </p>
          )}
        </CardContent>
      </Card>

      {previewStandings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Előnézet ({previewStandings.length} csapat)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 sm:p-2">H.</th>
                    <th className="text-left p-2 sm:p-2 min-w-30">Csapat</th>
                    <th className="text-center p-2 sm:p-2">M</th>
                    <th className="text-center p-2 sm:p-2 hidden sm:table-cell">%</th>
                    <th className="text-center p-2 sm:p-2">PT</th>
                    <th className="text-center p-2 sm:p-2">GY</th>
                    <th className="text-center p-2 sm:p-2">V</th>
                    <th className="text-center p-2 sm:p-2 hidden md:table-cell">DOB</th>
                    <th className="text-center p-2 sm:p-2 hidden md:table-cell">KAP</th>
                    <th className="text-center p-2 sm:p-2">+/-</th>
                    <th className="text-center p-2 sm:p-2 hidden lg:table-cell">SOR</th>
                  </tr>
                </thead>
                <tbody>
                  {previewStandings.map((row, idx) => (
                    <tr key={idx} className="border-b border-border-subtle hover:bg-surface-2/50">
                      <td className="p-2 font-semibold text-xs sm:text-sm text-primary">{row.position}</td>
                      <td className="p-2 text-xs sm:text-sm text-primary">{row.team}</td>
                      <td className="text-center p-2 text-secondary">{row.matches}</td>
                      <td className="text-center p-2 hidden sm:table-cell text-secondary">{(row.winPct * 100).toFixed(0)}%</td>
                      <td className="text-center p-2 font-semibold text-primary">{row.points}</td>
                      <td className="text-center p-2 text-positive">{row.wins}</td>
                      <td className="text-center p-2 text-negative">{row.losses}</td>
                      <td className="text-center p-2 hidden md:table-cell text-secondary">{row.scored}</td>
                      <td className="text-center p-2 hidden md:table-cell text-secondary">{row.conceded}</td>
                      <td className="text-center p-2">
                        <span className={row.scored - row.conceded > 0 ? 'text-positive' : 'text-negative'}>
                          {row.scored - row.conceded > 0 ? '+' : ''}{row.scored - row.conceded}
                        </span>
                      </td>
                      <td className="text-center p-2 hidden lg:table-cell text-secondary">{row.streak}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
