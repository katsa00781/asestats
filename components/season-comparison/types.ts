// A SeasonComparison nézet-szintű típusai: narratíva-állapotok, riport-sorok,
// érkező játékos (Eurobasket import) adatai. Lib függvény ezeket nem használja.
import type { Position } from '@/lib/player-analysis';

export type PlayerNarrativeStatus = {
  status: 'idle' | 'loading' | 'success' | 'error';
  text?: string;
  error?: string;
  generatedAt?: string;
  generatedBy?: string;
};

export type TeamNarrativeStatus = {
  status: 'idle' | 'loading' | 'success' | 'error';
  text?: string;
  error?: string;
  generatedAt?: string;
  generatedBy?: string;
};

export type TeamTextReportRow = {
  narrative?: string | null;
  generated_at?: string | null;
  generated_by?: string | null;
};

export type GameTextReportRow = {
  narrative?: string | null;
  generated_at?: string | null;
  generated_by?: string | null;
};

export type IncomingPlayerInput = {
  name: string;
  position: Position;
  games: number;
  minutesPerGame: number;
  pointsPerGame: number;
  assistsPerGame: number;
  orebPerGame: number;
  drebPerGame: number;
  valuationPerGame: number;
  twoPct: number;
  twoAttemptedPerGame: number;
  threePct: number;
  threeAttemptedPerGame: number;
  ftPct: number;
  ftAttemptedPerGame: number;
  turnoversPerGame: number;
  stealsPerGame: number;
  blocksPerGame: number;
  foulsCommittedPerGame: number;
  foulsReceivedPerGame: number;
};

export type IncomingField = keyof IncomingPlayerInput | 'rebTotal';

export type IncomingEurobasketPayload = {
  name: string;
  position?: string;
  currentTeam?: string;
  currentCountry?: string;
  currentCountryFlagUrl?: string;
  previousTeam?: string;
  previousCountry?: string;
  previousCountryFlagUrl?: string;
  games: number;
  minutesPerGame: number;
  pointsPerGame: number;
  assistsPerGame: number;
  orebPerGame: number;
  drebPerGame: number;
  valuationPerGame: number;
  twoPct: number;
  twoAttemptedPerGame: number;
  threePct: number;
  threeAttemptedPerGame: number;
  ftPct: number;
  ftAttemptedPerGame: number;
  turnoversPerGame: number;
  stealsPerGame: number;
  blocksPerGame: number;
  foulsCommittedPerGame: number;
  foulsReceivedPerGame: number;
  sourceUrl: string;
  seasonYearUsed: number;
  usedFallbackSeason: boolean;
  gamesSampled: number;
};

export type IncomingEurobasketCandidate = {
  name: string;
  profileUrl: string;
  height?: string;
  position?: string;
  born?: string;
  nationality?: string;
  team?: string;
  currentTeam?: string;
  currentCountry?: string;
  currentCountryFlagUrl?: string;
  previousTeam?: string;
  previousCountry?: string;
  previousCountryFlagUrl?: string;
  flagUrl?: string;
  photoUrl?: string;
};
