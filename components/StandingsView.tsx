'use client';
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { supabase } from '@/lib/supabase';
import { Trophy, TrendingUp, TrendingDown } from 'lucide-react';

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

type StandingData = {
  id: string;
  season_id?: string;
  matchday: number;
  date: string;
  data: StandingRow[];
};

type StandingsViewProps = {
  onRefresh?: number;
  selectedSeasonId?: string | null;
  selectedSeasonName?: string;
};

export function StandingsView({ onRefresh, selectedSeasonId, selectedSeasonName }: StandingsViewProps) {
  const [standings, setStandings] = useState<StandingData[]>([]);
  const [selectedMatchday, setSelectedMatchday] = useState<string>('');
  const [currentStanding, setCurrentStanding] = useState<StandingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadStandings = async () => {
    setIsLoading(true);

    if (!selectedSeasonId) {
      setStandings([]);
      setSelectedMatchday('');
      setCurrentStanding([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('standings')
        .select('*')
        .eq('season_id', selectedSeasonId)
        .order('matchday', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        setStandings(data);
        // Legfrissebb forduló kiválasztása
        const latest = data[0];
        setSelectedMatchday(latest.matchday.toString());
        setCurrentStanding(latest.data);
      }
    } catch (error) {
      console.error('Tabella betöltési hiba:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStandings();
  }, [onRefresh, selectedSeasonId]);

  useEffect(() => {
    if (selectedMatchday) {
      const standing = standings.find(s => s.matchday.toString() === selectedMatchday);
      if (standing) {
        setCurrentStanding(standing.data);
      }
    }
  }, [selectedMatchday, standings]);

  const getStreakIcon = (streak: string) => {
    if (streak.startsWith('GY')) {
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    } else if (streak.startsWith('V')) {
      return <TrendingDown className="h-4 w-4 text-red-600" />;
    }
    return null;
  };

  const getPositionColor = (position: number) => {
    if (position <= 8) return 'bg-green-100 text-green-800 border-green-300';
    if (position <= 10) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-slate-100 text-slate-800 border-slate-300';
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-slate-500">Betöltés...</p>
        </CardContent>
      </Card>
    );
  }

  if (standings.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-slate-400">Még nincs mentett tabella.</p>
          <p className="text-center text-slate-500 text-sm mt-2">
            {selectedSeasonId
              ? 'Importálj egy tabellát a kezdéshez.'
              : 'Előbb válassz szezont a tabella megjelenítéséhez.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Bajnokság Tabella{selectedSeasonName ? ` - ${selectedSeasonName}` : ''}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={selectedMatchday} onValueChange={setSelectedMatchday}>
                <SelectTrigger className="w-full sm:w-45 bg-slate-800 border-slate-700 text-slate-300">
                  <SelectValue placeholder="Válassz fordulót" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {standings.map((s) => (
                    <SelectItem key={s.id} value={s.matchday.toString()}>
                      {s.matchday}. forduló ({new Date(s.date).toLocaleDateString('hu-HU')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-300">
                    <th className="text-left p-2 sm:p-3 font-semibold sticky left-0 bg-slate-900 z-10">H.</th>
                    <th className="text-left p-2 sm:p-3 font-semibold sticky left-8 sm:left-12 bg-slate-900 z-10 min-w-37.5 sm:min-w-50">Csapat</th>
                    <th className="text-center p-2 sm:p-3 font-semibold">M</th>
                    <th className="text-center p-2 sm:p-3 font-semibold hidden sm:table-cell">%</th>
                    <th className="text-center p-2 sm:p-3 font-semibold">PT</th>
                    <th className="text-center p-2 sm:p-3 font-semibold">GY</th>
                    <th className="text-center p-2 sm:p-3 font-semibold">V</th>
                    <th className="text-center p-2 sm:p-3 font-semibold hidden md:table-cell">DOB</th>
                    <th className="text-center p-2 sm:p-3 font-semibold hidden md:table-cell">KAP</th>
                    <th className="text-center p-2 sm:p-3 font-semibold">+/-</th>
                    <th className="text-center p-2 sm:p-3 font-semibold hidden lg:table-cell">SOR</th>
                    <th className="text-center p-2 sm:p-3 font-semibold hidden lg:table-cell">HA</th>
                    <th className="text-center p-2 sm:p-3 font-semibold hidden lg:table-cell">VE</th>
                    <th className="text-center p-2 sm:p-3 font-semibold hidden xl:table-cell">UT.5</th>
                  </tr>
                </thead>
              <tbody>
                {currentStanding.map((row, idx) => {
                  const diff = row.scored - row.conceded;
                  return (
                    <tr 
                      key={idx} 
                      className={`border-b hover:bg-slate-200 ${
                        idx === 7 ? 'border-b-2 border-blue-300' : ''
                      }`}
                    >
                      <td className="p-2 sm:p-3 sticky left-0 bg-slate-900 hover:bg-slate-200 z-10">
                        <Badge 
                          variant="outline" 
                          className={`${getPositionColor(row.position)} font-bold text-[10px] sm:text-xs`}
                        >
                          {row.position}
                        </Badge>
                      </td>
                      <td className="p-2 sm:p-3 font-medium hover:text-slate-900 sticky left-8 sm:left-12 bg-slate-900 hover:bg-slate-200 z-10 text-xs sm:text-sm">{row.team}</td>
                      <td className="text-center p-2 sm:p-3 text-slate-600 hover:text-slate-900">{row.matches}</td>
                      <td className="text-center p-2 sm:p-3 text-slate-600 hover:text-slate-900 hidden sm:table-cell">
                        {(row.winPct * 100).toFixed(0)}%
                      </td>
                      <td className="text-center p-2 sm:p-3">
                        <span className="font-bold text-base sm:text-lg hover:text-slate-900">{row.points}</span>
                      </td>
                      <td className="text-center p-2 sm:p-3">
                        <span className="text-green-600 font-semibold">{row.wins}</span>
                      </td>
                      <td className="text-center p-2 sm:p-3">
                        <span className="text-red-600 font-semibold">{row.losses}</span>
                      </td>
                      <td className="text-center p-2 sm:p-3 text-slate-600 hidden md:table-cell">{row.scored}</td>
                      <td className="text-center p-2 sm:p-3 text-slate-600 hidden md:table-cell">{row.conceded}</td>
                      <td className="text-center p-2 sm:p-3">
                        <span 
                          className={`font-semibold text-xs sm:text-sm ${
                            diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-slate-600'
                          }`}
                        >
                          {diff > 0 ? '+' : ''}{diff}
                        </span>
                      </td>
                      <td className="text-center p-2 sm:p-3 hidden lg:table-cell">
                        <div className="flex items-center justify-center gap-1">
                          {getStreakIcon(row.streak)}
                          <span className="text-xs sm:text-sm font-medium">{row.streak}</span>
                        </div>
                      </td>
                      <td className="text-center p-2 sm:p-3 text-xs sm:text-sm text-slate-600 hidden lg:table-cell">{row.home}</td>
                      <td className="text-center p-2 sm:p-3 text-xs sm:text-sm text-slate-600 hidden lg:table-cell">{row.away}</td>
                      <td className="text-center p-2 sm:p-3 text-xs sm:text-sm text-slate-600 hidden xl:table-cell">{row.last5}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 text-xs sm:text-sm px-4 sm:px-0">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 sm:w-4 sm:h-4 bg-green-100 border border-green-300 rounded shrink-0"></div>
              <span className="text-slate-600">1-8. helyezettek (playoff)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 sm:w-4 sm:h-4 bg-yellow-100 border border-yellow-300 rounded shrink-0"></div>
              <span className="text-slate-600">9-10. helyezettek</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 sm:w-4 sm:h-4 bg-slate-100 border border-slate-300 rounded shrink-0"></div>
              <span className="text-slate-600">11-14. helyezettek</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
