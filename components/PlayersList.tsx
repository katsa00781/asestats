import type { PlayerStats, ShootingStats } from '@/lib/dashboard-types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { User, TrendingUp, Activity, Users } from 'lucide-react';

type PlayersListProps = {
  players: PlayerStats[];
  onSelectPlayer: (id: string) => void;
  onCompare?: () => void;
};

export function PlayersList({ players, onSelectPlayer, onCompare }: PlayersListProps) {
  const calculateFGPct = (shooting?: ShootingStats) => {
    if (!shooting) return '0.0';
    const made = shooting.close.made + shooting.mid.made + shooting.three.made;
    const attempted = shooting.close.attempted + shooting.mid.attempted + shooting.three.attempted;
    return attempted > 0 ? ((made / attempted) * 100).toFixed(1) : '0.0';
  };

  // Pozíció megjelenítése emberi formában
  const getPositionLabel = (position: string): string => {
    const positionLabels: { [key: string]: string } = {
      '1': '1 (Irányító)',
      '2': '2 (Dobóhátvéd)',
      '3': '3 (Bedobó)',
      '4': '4 (Erőcsatár)',
      '5': '5 (Center)'
    };

    const normalizePositionTokens = (rawPosition: string): string[] => {
      const normalized = rawPosition?.toUpperCase().replace(/\s+/g, '') || '';
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

    const tokens = normalizePositionTokens(position);
    if (tokens.length === 1 && positionLabels[tokens[0]]) {
      return positionLabels[tokens[0]];
    }
    if (tokens.length >= 2 && positionLabels[tokens[0]] && positionLabels[tokens[1]]) {
      return `${positionLabels[tokens[0]].split(' ')[0]}-${positionLabels[tokens[1]].split(' ')[0]}`;
    }
    
    // Ha egyszerű szám (pl. "1", "2")
    if (position.length === 1 && positionLabels[position]) {
      return positionLabels[position];
    }
    
    // Ha összetett (pl. "1-2", "3-4")
    const parts = position.split('-');
    if (parts.length === 2 && positionLabels[parts[0]] && positionLabels[parts[1]]) {
      return `${positionLabels[parts[0]].split(' ')[0]}-${positionLabels[parts[1]].split(' ')[0]}`;
    }
    
    // Egyéb esetben visszaadjuk az eredetit
    return position;
  };

  if (players.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Még nincsenek betöltött játékosok.</p>
        <p className="text-slate-500 text-sm mt-2">Töltsd be a meccsadatokat a kezdéshez.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-3">
        <div>
          <h2 className="text-slate-50 mb-2 text-lg sm:text-xl">Játékosok Listája</h2>
          <p className="text-slate-400 text-sm sm:text-base">Kattints egy játékosra a részletes statisztikákért</p>
        </div>
        {onCompare && (
          <Button 
            onClick={onCompare}
            className="bg-emerald-600 hover:bg-emerald-700 w-fit text-sm sm:text-base"
          >
            <Users size={18} className="mr-2" />
            Összehasonlítás
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
        {players.map((player, index) => {
          const avgPoints = (player.points / player.gamesPlayed).toFixed(1);
          const avgRebounds = (player.rebounds.total / player.gamesPlayed).toFixed(1);
          const avgAssists = (player.assists / player.gamesPlayed).toFixed(1);
          const fgPct = calculateFGPct(player.shooting);

          return (
            <Card
              key={player.id || `player-${index}`}
              className="hover:shadow-lg hover:shadow-emerald-500/10 transition-all cursor-pointer bg-slate-900 border-slate-800 hover:border-emerald-500/50 group"
              onClick={() => onSelectPlayer(player.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-linear-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center ring-2 ring-emerald-500/30">
                      <User className="text-emerald-400" size={24} />
                    </div>
                    <div>
                      <CardTitle className="text-slate-50 text-base">{player.name}</CardTitle>
                      <p className="text-slate-500 text-sm">{getPositionLabel(player.position)}</p>
                      {player.birthYear && (
                        <p className="text-slate-600 text-xs">
                          {2025 - player.birthYear} éves • {player.height} cm • {player.weight} kg
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-slate-800 text-slate-300 border-slate-700">
                    #{player.number}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Átlag statisztikák */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                      <div className="text-slate-500 text-xs mb-1">PPG</div>
                      <div className="text-slate-50 text-lg">{avgPoints}</div>
                    </div>
                    <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                      <div className="text-slate-500 text-xs mb-1">RPG</div>
                      <div className="text-slate-50 text-lg">{avgRebounds}</div>
                    </div>
                    <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                      <div className="text-slate-500 text-xs mb-1">APG</div>
                      <div className="text-slate-50 text-lg">{avgAssists}</div>
                    </div>
                  </div>

                  {/* Fejlett statisztikák */}
                  <div className="space-y-2 pt-3 border-t border-slate-800">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Activity size={14} className="text-emerald-400" />
                        <span className="text-slate-500">FG%</span>
                      </div>
                      <span className="text-slate-300">{fgPct}%</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Ponthatékonyság</span>
                      <span className="text-emerald-400">{player.offensiveRating.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Véd. Index</span>
                      <span className="text-cyan-400">{player.defensiveRating.toFixed(1)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">TS%</span>
                      <span className="text-violet-400">{player.trueShootingPct.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">eFG%</span>
                      <span className="text-orange-400">{player.effectiveShootingPct.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">VAL</span>
                      <span className="text-pink-400">{player.valuation.toFixed(1)}</span>
                    </div>
                  </div>

                  <Button 
                    variant="outline" 
                    className="w-full mt-2 bg-slate-800/50 border-slate-700 hover:bg-emerald-500/10 hover:border-emerald-500/50 hover:text-emerald-400" 
                    size="sm"
                  >
                    <TrendingUp size={16} className="mr-2" />
                    Részletes adatok
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
