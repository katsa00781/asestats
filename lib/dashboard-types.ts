import type { PlayerTrend } from '@/lib/player-analysis';

export type ShootingStats = {
  close: { made: number; attempted: number };
  mid: { made: number; attempted: number };
  three: { made: number; attempted: number };
  freeThrow: { made: number; attempted: number };
};

export type PlayerStats = {
  id: string;
  name: string;
  number: number;
  position: string;
  isActive?: boolean;
  seasonId?: string;
  seasonName?: string;
  teamId?: string;
  teamName?: string;
  birthYear?: number;
  height?: number;
  weight?: number;
  gamesPlayed: number;
  points: number;
  minutes: number;
  shooting: ShootingStats;
  rebounds: { offensive: number; defensive: number; total: number };
  assists: number;
  steals: number;
  turnovers: number;
  foulsCommitted: number;
  foulsDrawn: number;
  blocks: number;
  valuation: number;
  offensiveRating: number;
  defensiveRating: number;
  trueShootingPct: number;
  effectiveShootingPct: number;
  gameHistory: GamePerformance[];
  trend?: PlayerTrend;
};

export type GamePerformance = {
  date: string;
  opponent: string;
  points: number;
  minutes: number;
  shooting: ShootingStats;
  rebounds: { offensive: number; defensive: number; total: number };
  assists: number;
  steals: number;
  turnovers: number;
  blocks: number;
  valuation: number;
  offensiveRating?: number;
  defensiveRating?: number;
  trueShootingPct?: number;
  effectiveShootingPct?: number;
};

export type GamePlayer = {
  number: number;
  name: string;
  position: string;
  minutes: number;
  points: number;
  shooting: ShootingStats;
  rebounds: {
    defensive: number;
    offensive: number;
    total: number;
  };
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  plusMinus: number;
  valuation: number;
  advanced: {
    offensiveRating: number;
    defensiveRating: number;
    trueShootingPercentage: number;
    effectiveFieldGoalPercentage: number;
  };
};

export type TeamGame = {
  id: string;
  date: string;
  opponent: string;
  homeAway: 'home' | 'away';
  ourScore: number;
  oppScore: number;
  result: 'win' | 'loss';
  kosarstatGameId?: string | null;
  players: GamePlayer[];
  opponentGameId?: string;
};

export type GameAggregate = {
  totalGames: number;
  avgPoints: number;
  avgRebounds: number;
  avgAssists: number;
  avgSteals: number;
  avgBlocks: number;
  avgTurnovers: number;
  avgValuation: number;
};

export type UpcomingFixture = {
  id: string;
  gameDate: string;
  round: number | null;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  status: 'scheduled' | 'played' | 'postponed' | 'cancelled';
  homeScore: number | null;
  awayScore: number | null;
};
