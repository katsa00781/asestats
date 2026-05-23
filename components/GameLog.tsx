'use client';
import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Calendar, Search, X } from 'lucide-react';
import type { PlayerStats, GamePerformance } from '@/lib/dashboard-types';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';

type GameLogProps = {
  players: PlayerStats[];
};

type PlayerGameData = GamePerformance & {
  playerId: string;
  playerName: string;
  playerNumber: number;
};

const GAME_COLUMNS: ColumnDef<PlayerGameData>[] = [
  {
    key: 'player',
    label: 'Játékos',
    sortable: false,
    render: (row) => (
      <div className="flex items-center gap-2">
        <span className="font-mono tabular-nums text-muted text-xs">#{row.playerNumber}</span>
        <span className="text-primary text-sm">{row.playerName}</span>
      </div>
    ),
  },
  {
    key: 'minutes',
    label: 'Perc',
    numeric: true,
    render: (row) => <span data-stat>{row.minutes}</span>,
  },
  {
    key: 'points',
    label: 'Pont',
    numeric: true,
    render: (row) => <span className="text-orange font-semibold" data-stat>{row.points}</span>,
  },
  {
    key: 'fg',
    label: 'FG',
    center: true,
    sortable: false,
    render: (row) => {
      const made = row.shooting.close.made + row.shooting.mid.made + row.shooting.three.made;
      const att = row.shooting.close.attempted + row.shooting.mid.attempted + row.shooting.three.attempted;
      return <span className="dt-num dt-num--muted">{made}/{att}</span>;
    },
  },
  {
    key: 'three',
    label: '3P',
    center: true,
    sortable: false,
    render: (row) => (
      <span className="dt-num dt-num--muted">
        {row.shooting.three.made}/{row.shooting.three.attempted}
      </span>
    ),
  },
  {
    key: 'ft',
    label: 'FT',
    center: true,
    sortable: false,
    render: (row) => (
      <span className="dt-num dt-num--muted">
        {row.shooting.freeThrow.made}/{row.shooting.freeThrow.attempted}
      </span>
    ),
  },
  {
    key: 'rebounds',
    label: 'Lep',
    numeric: true,
    sortAccessor: (row) => row.rebounds.total,
    render: (row) => <span data-stat>{row.rebounds.total}</span>,
  },
  {
    key: 'assists',
    label: 'Góp',
    numeric: true,
    render: (row) => <span data-stat>{row.assists}</span>,
  },
  {
    key: 'steals',
    label: 'Lab',
    numeric: true,
    render: (row) => <span data-stat>{row.steals}</span>,
  },
  {
    key: 'blocks',
    label: 'Blk',
    numeric: true,
    render: (row) => <span data-stat>{row.blocks}</span>,
  },
  {
    key: 'turnovers',
    label: 'TO',
    numeric: true,
    render: (row) => <span className="text-negative" data-stat>{row.turnovers}</span>,
  },
  {
    key: 'valuation',
    label: 'VAL',
    numeric: true,
    render: (row) => <span className="text-cyan font-semibold" data-stat>{row.valuation}</span>,
  },
];

export function GameLog({ players }: GameLogProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<string>('all');
  const [opponentSearch, setOpponentSearch] = useState<string>('');

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

  const gamesList = Array.from(allGames.values()).sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const filteredGames = gamesList.filter(g => {
    if (opponentSearch.trim() && !g.opponent.toLowerCase().includes(opponentSearch.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <div className="flex-1">
          <label className="font-display uppercase text-secondary text-[0.7rem] tracking-[0.14em] mb-2 block">
            Játékos szűrő
          </label>
          <Select value={selectedPlayer} onValueChange={setSelectedPlayer}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Minden játékos</SelectItem>
              {players.map(player => (
                <SelectItem key={player.id} value={player.id}>
                  #{player.number} {player.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <label className="font-display uppercase text-secondary text-[0.7rem] tracking-[0.14em] mb-2 block">
            Ellenfél keresés
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" strokeWidth={1.6} />
            <Input
              value={opponentSearch}
              onChange={e => setOpponentSearch(e.target.value)}
              placeholder="Ellenfél neve..."
              className="pl-9 pr-9"
            />
            {opponentSearch && (
              <button
                onClick={() => setOpponentSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-secondary"
              >
                <X className="h-4 w-4" strokeWidth={1.6} />
              </button>
            )}
          </div>
        </div>
      </div>

      {filteredGames.map((game, gameIdx) => {
        const date = new Date(game.date).toLocaleDateString('hu-HU', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });

        const playersToShow = selectedPlayer === 'all'
          ? game.players
          : game.players.filter(p => p.playerId === selectedPlayer);

        if (playersToShow.length === 0) return null;

        return (
          <Card key={gameIdx} className="shadow-panel">
            <CardHeader className="p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-2 text-secondary">
                  <Calendar className="h-4 w-4" strokeWidth={1.6} />
                  <span className="font-display uppercase text-[0.75rem] tracking-widest">{date}</span>
                </div>
                <span className="badge-cyan w-fit">vs {game.opponent}</span>
                <span className="text-muted text-xs ml-auto">{playersToShow.length} játékos</span>
              </div>
            </CardHeader>
            <CardContent className="p-0 pb-1">
              <DataTable<PlayerGameData>
                columns={GAME_COLUMNS}
                rows={playersToShow}
                initialSort={{ key: 'points', dir: 'desc' }}
                getRowId={(r) => r.playerId}
              />
            </CardContent>
          </Card>
        );
      })}

      {filteredGames.length === 0 && (
        <Card className="shadow-panel">
          <CardContent className="p-8 text-center text-secondary">
            Nincs megjeleníthető meccs
          </CardContent>
        </Card>
      )}
    </div>
  );
}
