'use client';
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Users, X } from 'lucide-react';
import type { PlayerStats } from '@/lib/dashboard-types';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

type PlayerComparisonProps = {
  allPlayers: PlayerStats[];
  allSeasons: { id: string; name: string }[];
  allTeams: { id: string; name: string }[];
  currentSeasonId: string | null;
  currentTeamId: string | null;
  onBack: () => void;
};

export function PlayerComparison({ 
  allPlayers, 
  allSeasons, 
  allTeams,
  currentSeasonId,
  currentTeamId,
  onBack 
}: PlayerComparisonProps) {
  const [selectedPlayers, setSelectedPlayers] = useState<PlayerStats[]>([]);
  const [filterPosition, setFilterPosition] = useState<string>('all');
  const [filterSeasonId, setFilterSeasonId] = useState<string>(currentSeasonId || 'all');
  const [filterTeamId, setFilterTeamId] = useState<string>(currentTeamId || 'all');

  // Pozíciók listája: 1-5 számokkal
  const positions = ['all', '1', '2', '3', '4', '5'];
  const positionLabels: { [key: string]: string } = {
    'all': 'Összes',
    '1': '1 (Irányító)',
    '2': '2 (Dobóhátvéd)',
    '3': '3 (Bedobó)',
    '4': '4 (Erőcsatár)',
    '5': '5 (Center)'
  };

  const normalizePositionTokens = (position: string): string[] => {
    const normalized = position?.toUpperCase().replace(/\s+/g, '') || '';
    const digits = normalized.match(/[1-5]/g) || [];
    if (digits.length > 0) return Array.from(new Set(digits));

    const tokens: string[] = [];
    if (normalized.includes('PG')) tokens.push('1');
    if (normalized.includes('SG')) tokens.push('2');
    if (normalized.includes('SF')) tokens.push('3');
    if (normalized.includes('PF')) tokens.push('4');
    if (normalized === 'G' || normalized.includes('G/')) tokens.push('1', '2');
    if (normalized === 'F' || normalized.includes('F/')) tokens.push('3', '4');
    if (normalized.includes('C')) tokens.push('5');

    return Array.from(new Set(tokens));
  };

  // Pozíció megjelenítése emberi formában
  const getPositionLabel = (position: string): string => {
    const tokens = normalizePositionTokens(position);
    if (tokens.length === 1 && positionLabels[tokens[0]]) {
      return positionLabels[tokens[0]];
    }

    if (tokens.length >= 2 && positionLabels[tokens[0]] && positionLabels[tokens[1]]) {
      return `${positionLabels[tokens[0]].split(' ')[0]}-${positionLabels[tokens[1]].split(' ')[0]}`;
    }

    return position;
  };

  // Szűrés: pozíció, szezon, csapat
  const filteredPlayers = allPlayers.filter(p => {
    const positionTokens = normalizePositionTokens(p.position);
    // Pozíció szűrés
    if (filterPosition !== 'all' && !positionTokens.includes(filterPosition)) {
      return false;
    }
    
    // Szezon szűrés
    if (filterSeasonId !== 'all' && p.seasonId !== filterSeasonId) {
      return false;
    }
    
    // Csapat szűrés
    if (filterTeamId !== 'all' && p.teamId !== filterTeamId) {
      return false;
    }
    
    return true;
  });

  const handleSelectPlayer = (player: PlayerStats) => {
    // Egyedi azonosító: id + seasonId kombináció (ugyanaz a játékos különböző szezonokban különböző entitás)
    const playerKey = `${player.id}-${player.seasonId}`;
    const existingIndex = selectedPlayers.findIndex(p => 
      `${p.id}-${p.seasonId}` === playerKey
    );
    
    if (existingIndex !== -1) {
      setSelectedPlayers(selectedPlayers.filter((_, idx) => idx !== existingIndex));
    } else if (selectedPlayers.length < 3) {
      setSelectedPlayers([...selectedPlayers, player]);
    }
  };

  const isSelected = (player: PlayerStats) => {
    const playerKey = `${player.id}-${player.seasonId}`;
    return selectedPlayers.some(p => `${p.id}-${p.seasonId}` === playerKey);
  };

  const colors = ['#10b981', '#06b6d4', '#8b5cf6'];

  // Egyedi label generálása minden kiválasztott játékoshoz (név + szezon)
  const getPlayerLabel = (player: PlayerStats) => {
    return `${player.name} (${player.seasonName})`;
  };

  // Radar chart adat
  const radarData = [
    {
      stat: 'Pontok',
      ...selectedPlayers.reduce((acc, player) => ({
        ...acc,
        [getPlayerLabel(player)]: Math.min(100, (player.points / player.gamesPlayed / 30) * 100)
      }), {})
    },
    {
      stat: 'Lepattanók',
      ...selectedPlayers.reduce((acc, player) => ({
        ...acc,
        [getPlayerLabel(player)]: Math.min(100, ((player.rebounds.total / player.gamesPlayed) / 15) * 100)
      }), {})
    },
    {
      stat: 'Gólpasszok',
      ...selectedPlayers.reduce((acc, player) => ({
        ...acc,
        [getPlayerLabel(player)]: Math.min(100, (player.assists / player.gamesPlayed / 10) * 100)
      }), {})
    },
    {
      stat: 'Labdaszerzés',
      ...selectedPlayers.reduce((acc, player) => ({
        ...acc,
        [getPlayerLabel(player)]: Math.min(100, (player.steals / player.gamesPlayed / 5) * 100)
      }), {})
    },
    {
      stat: 'Blokkok',
      ...selectedPlayers.reduce((acc, player) => ({
        ...acc,
        [getPlayerLabel(player)]: Math.min(100, (player.blocks / player.gamesPlayed / 3) * 100)
      }), {})
    },
    {
      stat: 'Hatékonyság',
      ...selectedPlayers.reduce((acc, player) => ({
        ...acc,
        [getPlayerLabel(player)]: Math.min(100, (player.valuation / 20) * 100) // player.valuation már átlag
      }), {})
    },
  ];

  // Átlagok összehasonlítása
  const avgComparisonData = [
    {
      category: 'Pont/M',
      ...selectedPlayers.reduce((acc, player) => ({
        ...acc,
        [getPlayerLabel(player)]: parseFloat((player.points / player.gamesPlayed).toFixed(1))
      }), {})
    },
    {
      category: 'Lep/M',
      ...selectedPlayers.reduce((acc, player) => ({
        ...acc,
        [getPlayerLabel(player)]: parseFloat((player.rebounds.total / player.gamesPlayed).toFixed(1))
      }), {})
    },
    {
      category: 'Góp/M',
      ...selectedPlayers.reduce((acc, player) => ({
        ...acc,
        [getPlayerLabel(player)]: parseFloat((player.assists / player.gamesPlayed).toFixed(1))
      }), {})
    },
    {
      category: 'Lab/M',
      ...selectedPlayers.reduce((acc, player) => ({
        ...acc,
        [getPlayerLabel(player)]: parseFloat((player.steals / player.gamesPlayed).toFixed(1))
      }), {})
    },
  ];

  // Dobási százalékok
  const shootingComparisonData = [
    {
      category: 'Közeli',
      ...selectedPlayers.reduce((acc, player) => ({
        ...acc,
        [getPlayerLabel(player)]: player.shooting.close.attempted > 0 
          ? parseFloat(((player.shooting.close.made / player.shooting.close.attempted) * 100).toFixed(1))
          : 0
      }), {})
    },
    {
      category: 'Közép',
      ...selectedPlayers.reduce((acc, player) => ({
        ...acc,
        [getPlayerLabel(player)]: player.shooting.mid.attempted > 0 
          ? parseFloat(((player.shooting.mid.made / player.shooting.mid.attempted) * 100).toFixed(1))
          : 0
      }), {})
    },
    {
      category: 'Hármas',
      ...selectedPlayers.reduce((acc, player) => ({
        ...acc,
        [getPlayerLabel(player)]: player.shooting.three.attempted > 0 
          ? parseFloat(((player.shooting.three.made / player.shooting.three.attempted) * 100).toFixed(1))
          : 0
      }), {})
    },
    {
      category: 'Büntető',
      ...selectedPlayers.reduce((acc, player) => ({
        ...acc,
        [getPlayerLabel(player)]: player.shooting.freeThrow.attempted > 0 
          ? parseFloat(((player.shooting.freeThrow.made / player.shooting.freeThrow.attempted) * 100).toFixed(1))
          : 0
      }), {})
    },
  ];

  // Fejlett statisztikák
  const advancedStatsData = [
    {
      category: 'OffRtg',
      ...selectedPlayers.reduce((acc, player) => ({
        ...acc,
        [getPlayerLabel(player)]: parseFloat((player.offensiveRating || 0).toFixed(1))
      }), {})
    },
    {
      category: 'DefRtg',
      ...selectedPlayers.reduce((acc, player) => ({
        ...acc,
        [getPlayerLabel(player)]: parseFloat((player.defensiveRating || 0).toFixed(1))
      }), {})
    },
    {
      category: 'TS%',
      ...selectedPlayers.reduce((acc, player) => ({
        ...acc,
        [getPlayerLabel(player)]: parseFloat((player.trueShootingPct || 0).toFixed(1))
      }), {})
    },
    {
      category: 'eFG%',
      ...selectedPlayers.reduce((acc, player) => ({
        ...acc,
        [getPlayerLabel(player)]: parseFloat((player.effectiveShootingPct || 0).toFixed(1))
      }), {})
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <Button onClick={onBack} variant="ghost" className="text-slate-400 hover:bg-slate-800 w-fit text-sm sm:text-base">
          <ArrowLeft size={18} className="mr-2" />
          Vissza
        </Button>
        <div className="flex items-center gap-2">
          <Users className="text-emerald-400 shrink-0" size={20} />
          <h2 className="text-lg sm:text-xl text-slate-50">
            Játékosok összehasonlítása ({selectedPlayers.length}/3)
          </h2>
        </div>
      </div>

      {/* Szűrők */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="p-4">
          <CardTitle className="text-slate-50 text-base">Szűrők</CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Szezon szűrő */}
            <div className="space-y-2">
              <label className="text-sm text-slate-300">Szezon</label>
              <select
                value={filterSeasonId}
                onChange={(e) => setFilterSeasonId(e.target.value)}
                className="w-full h-10 px-3 bg-slate-800 border border-slate-700 text-slate-300 rounded-md placeholder:text-slate-400"
              >
                <option value="all" className="text-slate-300">Összes szezon</option>
                {allSeasons.map(season => (
                  <option key={season.id} value={season.id} className="text-slate-300">{season.name}</option>
                ))}
              </select>
            </div>

            {/* Csapat szűrő */}
            <div className="space-y-2">
              <label className="text-sm text-slate-300">Csapat</label>
              <select
                value={filterTeamId}
                onChange={(e) => setFilterTeamId(e.target.value)}
                className="w-full h-10 px-3 bg-slate-800 border border-slate-700 text-slate-300 rounded-md placeholder:text-slate-400"
              >
                <option value="all" className="text-slate-300">Összes csapat</option>
                {allTeams.map(team => (
                  <option key={team.id} value={team.id} className="text-slate-300">{team.name}</option>
                ))}
              </select>
            </div>

            {/* Pozíció szűrő */}
            <div className="space-y-2">
              <label className="text-sm text-slate-300">Pozíció</label>
              <select
                value={filterPosition}
                onChange={(e) => setFilterPosition(e.target.value)}
                className="w-full h-10 px-3 bg-slate-800 border border-slate-700 text-slate-300 rounded-md placeholder:text-slate-400"
              >
                {positions.map(pos => (
                  <option key={pos} value={pos} className="text-slate-300">{positionLabels[pos]}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-sm text-slate-400">
            💡 Tipp: Válaszd ki az &quot;Összes csapat&quot; opciót a szezonnal és pozícióval együtt, hogy különböző csapatok ugyanazon poszton játszó játékosait hasonlítsd össze!
          </p>
        </CardContent>
      </Card>

      {/* Kiválasztott játékosok */}
      {selectedPlayers.length > 0 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-slate-50 text-base sm:text-lg">Kiválasztott játékosok</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {selectedPlayers.map((player, idx) => (
                <Badge
                  key={`${player.id}-${player.number}-${idx}`}
                  className="text-xs sm:text-sm px-3 sm:px-4 py-2 flex flex-col items-start gap-1"
                  style={{ backgroundColor: colors[idx] + '40', color: colors[idx], borderColor: colors[idx] }}
                >
                  <div className="flex items-center gap-2 w-full">
                    <span className="font-bold">#{player.number} {player.name}</span>
                    <X
                      size={14}
                      className="cursor-pointer hover:opacity-70 ml-auto"
                      onClick={() => handleSelectPlayer(player)}
                    />
                  </div>
                  <div className="text-[10px] sm:text-xs opacity-80">
                    {player.seasonName} • {player.teamName}
                  </div>
                  <div className="text-[10px] sm:text-xs opacity-80">
                    {player.position}
                    {player.birthYear && player.height && player.weight && (
                      <> • {2025 - player.birthYear} év • {player.height}cm • {player.weight}kg</>
                    )}
                  </div>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Összehasonlító grafikonok */}
      {selectedPlayers.length >= 2 && (
        <div className="space-y-4 sm:space-y-6">
          {/* Radar chart */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-slate-50 text-base sm:text-lg">Összehasonlító Profil</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#334155" />
                  <PolarAngleAxis dataKey="stat" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#64748b' }} />
                  {selectedPlayers.map((player, idx) => (
                    <Radar
                      key={`${player.id}-${player.seasonId}-${idx}`}
                      name={getPlayerLabel(player)}
                      dataKey={getPlayerLabel(player)}
                      stroke={colors[idx]}
                      fill={colors[idx]}
                      fillOpacity={0.3}
                    />
                  ))}
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Átlagok összehasonlítása */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-slate-50 text-base sm:text-lg">Meccsenként átlagok</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={avgComparisonData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="category" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      color: '#f1f5f9'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  {selectedPlayers.map((player, idx) => (
                    <Bar key={`${player.id}-${player.seasonId}-${idx}`} dataKey={getPlayerLabel(player)} fill={colors[idx]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Dobási százalékok */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-slate-50 text-base sm:text-lg">Dobási hatékonyság (%)</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={shootingComparisonData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="category" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      color: '#f1f5f9'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  {selectedPlayers.map((player, idx) => (
                    <Bar key={`${player.id}-${player.seasonId}-${idx}`} dataKey={getPlayerLabel(player)} fill={colors[idx]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Fejlett statisztikák */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-slate-50 text-base sm:text-lg">Fejlett statisztikák</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={advancedStatsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="category" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      color: '#f1f5f9'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  {selectedPlayers.map((player, idx) => (
                    <Bar key={`${player.id}-${player.seasonId}-${idx}`} dataKey={getPlayerLabel(player)} fill={colors[idx]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Összehasonlító táblázat */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-slate-50 text-base sm:text-lg">Részletes összehasonlítás</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-2 sm:py-3 text-slate-400 font-medium">Statisztika</th>
                    {selectedPlayers.map((player, idx) => (
                      <th key={`${player.id}-${player.number}-${idx}`} className="text-center py-2 sm:py-3 font-medium" style={{ color: colors[idx] }}>
                        #{player.number} {player.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-slate-300">
                  <tr className="border-b border-slate-800">
                    <td className="py-2 sm:py-3 text-slate-400">Poszt</td>
                    {selectedPlayers.map((player, idx) => (
                      <td key={`${player.id}-${idx}`} className="text-center py-2 sm:py-3">{getPositionLabel(player.position)}</td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-800 bg-slate-800/30">
                    <td className="py-2 sm:py-3 text-slate-400">Kor</td>
                    {selectedPlayers.map((player, idx) => (
                      <td key={`${player.id}-${idx}`} className="text-center py-2 sm:py-3">
                        {player.birthYear ? `${2025 - player.birthYear} év` : '-'}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-800 bg-slate-800/30">
                    <td className="py-2 sm:py-3 text-slate-400">Magasság</td>
                    {selectedPlayers.map((player, idx) => (
                      <td key={`${player.id}-${idx}`} className="text-center py-2 sm:py-3">
                        {player.height ? `${player.height} cm` : '-'}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-800 bg-slate-800/30">
                    <td className="py-2 sm:py-3 text-slate-400">Súly</td>
                    {selectedPlayers.map((player, idx) => (
                      <td key={`${player.id}-${idx}`} className="text-center py-2 sm:py-3">
                        {player.weight ? `${player.weight} kg` : '-'}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 sm:py-3 text-slate-400">Meccsek</td>
                    {selectedPlayers.map((player, idx) => (
                      <td key={`${player.id}-${idx}`} className="text-center py-2 sm:py-3">{player.gamesPlayed}</td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 sm:py-3 text-slate-400">Pont/Meccs</td>
                    {selectedPlayers.map((player, idx) => (
                      <td key={`${player.id}-${idx}`} className="text-center py-2 sm:py-3">{(player.points / player.gamesPlayed).toFixed(1)}</td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 sm:py-3 text-slate-400">Lepattanó/Meccs</td>
                    {selectedPlayers.map((player, idx) => (
                      <td key={`${player.id}-${idx}`} className="text-center py-2 sm:py-3">{(player.rebounds.total / player.gamesPlayed).toFixed(1)}</td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 sm:py-3 text-slate-400">Gólpassz/Meccs</td>
                    {selectedPlayers.map((player, idx) => (
                      <td key={`${player.id}-${idx}`} className="text-center py-2 sm:py-3">{(player.assists / player.gamesPlayed).toFixed(1)}</td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 sm:py-3 text-slate-400">Labdaszerzés/Meccs</td>
                    {selectedPlayers.map((player, idx) => (
                      <td key={`${player.id}-${idx}`} className="text-center py-2 sm:py-3">{(player.steals / player.gamesPlayed).toFixed(1)}</td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 sm:py-3 text-slate-400">Blokk/Meccs</td>
                    {selectedPlayers.map((player, idx) => (
                      <td key={`${player.id}-${idx}`} className="text-center py-2 sm:py-3">{(player.blocks / player.gamesPlayed).toFixed(1)}</td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 sm:py-3 text-slate-400">Valuation/Meccs</td>
                    {selectedPlayers.map((player, idx) => (
                      <td key={`${player.id}-${idx}`} className="text-center py-2 sm:py-3">{player.valuation.toFixed(1)}</td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 sm:py-3 text-slate-400">Offensive Rating</td>
                    {selectedPlayers.map((player, idx) => {
                      const gamesWithORtg = player.gameHistory.filter(g => g.offensiveRating != null);
                      const avgORtg = gamesWithORtg.length > 0
                        ? gamesWithORtg.reduce((sum, g) => sum + (g.offensiveRating || 0), 0) / gamesWithORtg.length
                        : 0;
                      return (
                        <td key={`${player.id}-${idx}`} className="text-center py-2 sm:py-3">{avgORtg.toFixed(1)}</td>
                      );
                    })}
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 sm:py-3 text-slate-400">Defensive Rating</td>
                    {selectedPlayers.map((player, idx) => {
                      const gamesWithDRtg = player.gameHistory.filter(g => g.defensiveRating != null);
                      const avgDRtg = gamesWithDRtg.length > 0
                        ? gamesWithDRtg.reduce((sum, g) => sum + (g.defensiveRating || 0), 0) / gamesWithDRtg.length
                        : 0;
                      return (
                        <td key={`${player.id}-${idx}`} className="text-center py-2 sm:py-3">{avgDRtg.toFixed(1)}</td>
                      );
                    })}
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 sm:py-3 text-slate-400">True Shooting %</td>
                    {selectedPlayers.map((player, idx) => (
                      <td key={`${player.id}-${idx}`} className="text-center py-2 sm:py-3">{player.trueShootingPct.toFixed(1)}%</td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 sm:py-3 text-slate-400">Effective FG %</td>
                    {selectedPlayers.map((player, idx) => (
                      <td key={`${player.id}-${idx}`} className="text-center py-2 sm:py-3">{player.effectiveShootingPct.toFixed(1)}%</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Játékosok listája */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-slate-50 text-base sm:text-lg">Válassz játékosokat (max. 3)</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {/* Poszt szerinti szűrő */}
          <div className="flex flex-wrap gap-2 mb-4 sm:mb-6">
            {positions.map(pos => (
              <Button
                key={pos}
                size="sm"
                variant={filterPosition === pos ? "default" : "outline"}
                onClick={() => setFilterPosition(pos)}
                className="text-xs sm:text-sm"
              >
                {positionLabels[pos]}
              </Button>
            ))}
          </div>

          {/* Játékosok grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {filteredPlayers.map((player, index) => (
              <div
                key={`${player.id}-${player.number}-${index}`}
                onClick={() => handleSelectPlayer(player)}
                className={`p-3 sm:p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  isSelected(player)
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                } ${selectedPlayers.length >= 3 && !isSelected(player) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs sm:text-sm">
                      #{player.number}
                    </Badge>
                    <span className="text-slate-50 font-medium text-sm sm:text-base">{player.name}</span>
                  </div>
                  {isSelected(player) && (
                    <Badge className="bg-emerald-500 text-xs">✓</Badge>
                  )}
                </div>
                <div className="text-xs text-slate-400 mb-1">
                  {player.seasonName} • {player.teamName}
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                  <span>{getPositionLabel(player.position)}</span>
                  <span>•</span>
                  <span>{(player.points / player.gamesPlayed).toFixed(1)} ppg</span>
                  <span>•</span>
                  <span>{(player.rebounds.total / player.gamesPlayed).toFixed(1)} rpg</span>
                  <span>•</span>
                  <span>{(player.assists / player.gamesPlayed).toFixed(1)} apg</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
