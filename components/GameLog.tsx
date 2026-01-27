'use client';
import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar, User } from 'lucide-react';
import { PlayerStats, GamePerformance } from '@/app/page';

type GameLogProps = {
  players: PlayerStats[];
};

type PlayerGameData = GamePerformance & {
  playerId: string;
  playerName: string;
  playerNumber: number;
};

export function GameLog({ players }: GameLogProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<string>('all');
  const [selectedGame, setSelectedGame] = useState<string>('all');

  // Összes meccs összegyűjtése dátum szerint csoportosítva
  const allGames = new Map<string, { date: string; opponent: string; players: PlayerGameData[] }>();
  
  players.forEach(player => {
    player.gameHistory.forEach(game => {
      const key = `${game.date}-${game.opponent}`;
      if (!allGames.has(key)) {
        allGames.set(key, { date: game.date, opponent: game.opponent, players: [] });
      }
      allGames.get(key)!.players.push({
        ...game,
        playerId: player.id,
        playerName: player.name,
        playerNumber: player.number,
      });
    });
  });

  // Meccsek listája dátum szerint rendezve
  const gamesList = Array.from(allGames.values()).sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Szűrés
  const filteredGames = selectedGame === 'all' 
    ? gamesList 
    : gamesList.filter(g => `${g.date}-${g.opponent}` === selectedGame);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <div className="flex-1">
          <label className="text-slate-400 text-sm mb-2 block">Játékos szűrő</label>
          <Select value={selectedPlayer} onValueChange={setSelectedPlayer}>
            <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-300">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="all" className="text-slate-300">Minden játékos</SelectItem>
              {players.map(player => (
                <SelectItem key={player.id} value={player.id} className="text-slate-300">
                  #{player.number} {player.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <label className="text-slate-400 text-sm mb-2 block">Meccs szűrő</label>
          <Select value={selectedGame} onValueChange={setSelectedGame}>
            <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-300">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="all" className="text-slate-300">Minden meccs</SelectItem>
              {gamesList.map((game, idx) => (
                <SelectItem 
                  key={idx} 
                  value={`${game.date}-${game.opponent}`}
                  className="text-slate-300"
                >
                  {new Date(game.date).toLocaleDateString('hu-HU')} - {game.opponent}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredGames.map((game, gameIdx) => {
        const date = new Date(game.date).toLocaleDateString('hu-HU', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });

        const playersToShow = selectedPlayer === 'all' 
          ? game.players 
          : game.players.filter(p => p.playerId === selectedPlayer);

        if (playersToShow.length === 0) return null;

        return (
          <Card key={gameIdx} className="bg-slate-900 border-slate-800">
            <CardHeader className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-2 text-slate-400">
                  <Calendar size={18} />
                  <span className="text-sm sm:text-base">{date}</span>
                </div>
                <Badge className="bg-emerald-600 text-white w-fit text-xs sm:text-sm">
                  vs {game.opponent}
                </Badge>
                <div className="text-slate-500 text-xs sm:text-sm">
                  {playersToShow.length} játékos
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-2 sm:py-3 text-slate-400 font-medium sticky left-0 bg-slate-900">Játékos</th>
                      <th className="text-center py-2 sm:py-3 text-slate-400 font-medium">Perc</th>
                      <th className="text-center py-2 sm:py-3 text-slate-400 font-medium">Pont</th>
                      <th className="text-center py-2 sm:py-3 text-slate-400 font-medium hidden sm:table-cell">FG</th>
                      <th className="text-center py-2 sm:py-3 text-slate-400 font-medium hidden sm:table-cell">3P</th>
                      <th className="text-center py-2 sm:py-3 text-slate-400 font-medium hidden sm:table-cell">FT</th>
                      <th className="text-center py-2 sm:py-3 text-slate-400 font-medium">Lep</th>
                      <th className="text-center py-2 sm:py-3 text-slate-400 font-medium">Góp</th>
                      <th className="text-center py-2 sm:py-3 text-slate-400 font-medium hidden md:table-cell">Lab</th>
                      <th className="text-center py-2 sm:py-3 text-slate-400 font-medium hidden md:table-cell">Blk</th>
                      <th className="text-center py-2 sm:py-3 text-slate-400 font-medium hidden md:table-cell">TO</th>
                      <th className="text-center py-2 sm:py-3 text-slate-400 font-medium">VAL</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-300">
                    {playersToShow
                      .sort((a, b) => b.points - a.points)
                      .map((playerGame, idx) => {
                        const totalFGMade = playerGame.shooting.close.made + playerGame.shooting.mid.made + playerGame.shooting.three.made;
                        const totalFGAttempted = playerGame.shooting.close.attempted + playerGame.shooting.mid.attempted + playerGame.shooting.three.attempted;

                        return (
                          <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/50">
                            <td className="py-2 sm:py-3 sticky left-0 bg-slate-900">
                              <div className="flex items-center gap-2">
                                <User size={14} className="text-slate-500 shrink-0" />
                                <span className="text-slate-300">#{playerGame.playerNumber}</span>
                                <span className="text-slate-400 truncate">{playerGame.playerName}</span>
                              </div>
                            </td>
                            <td className="text-center py-2 sm:py-3">{playerGame.minutes}</td>
                            <td className="text-center py-2 sm:py-3 font-semibold text-emerald-400">
                              {playerGame.points}
                            </td>
                            <td className="text-center py-2 sm:py-3 hidden sm:table-cell">
                              {totalFGMade}/{totalFGAttempted}
                            </td>
                            <td className="text-center py-2 sm:py-3 hidden sm:table-cell">
                              {playerGame.shooting.three.made}/{playerGame.shooting.three.attempted}
                            </td>
                            <td className="text-center py-2 sm:py-3 hidden sm:table-cell">
                              {playerGame.shooting.freeThrow.made}/{playerGame.shooting.freeThrow.attempted}
                            </td>
                            <td className="text-center py-2 sm:py-3">{playerGame.rebounds.total}</td>
                            <td className="text-center py-2 sm:py-3">{playerGame.assists}</td>
                            <td className="text-center py-2 sm:py-3 hidden md:table-cell">{playerGame.steals}</td>
                            <td className="text-center py-2 sm:py-3 hidden md:table-cell">{playerGame.blocks}</td>
                            <td className="text-center py-2 sm:py-3 text-red-400 hidden md:table-cell">
                              {playerGame.turnovers}
                            </td>
                            <td className="text-center py-2 sm:py-3 font-semibold text-cyan-400">
                              {playerGame.valuation}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {filteredGames.length === 0 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-8 text-center text-slate-400">
            Nincs megjeleníthető meccs
          </CardContent>
        </Card>
      )}
    </div>
  );
}
