// A SeasonComparison és a belőle kiszervezett lib-modulok közös, tiszta segédei:
// Kosarstat cellaértékek (előjeles szám, MM:SS), játékidő-formázás, név-kulcs és
// névprofil-illesztés, kerekítés, 0–1 / százalék-korlát, valamint a játékos-meccs
// statisztika sor típusa (`GamePlayerStatRow`). Nem @core modul (a mobil nem tükrözi).
import { playerNamesMatch } from '@/lib/player-name-match';

export const parseSignedNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(',', '.').replace(/^\+/, '');
  if (!/^[-+]?\d+(?:\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

export const parseMmSsToSeconds = (value: unknown) => {
  if (typeof value !== 'string') return 0;
  const text = value.trim();
  const match = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return 0;
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return 0;
  return minutes * 60 + seconds;
};

export const formatSecondsAsMmSs = (seconds: number) => {
  const safe = Math.max(0, Math.round(seconds));
  const mm = Math.floor(safe / 60);
  const ss = safe % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
};

export const formatElapsedGameClock = (elapsedSeconds: number) => {
  const totalSeconds = Math.max(0, Math.round(elapsedSeconds));
  const periodLengthSeconds = 10 * 60;
  const maxRegulationSeconds = 40 * 60;
  const bounded = Math.min(totalSeconds, maxRegulationSeconds);

  const period = Math.min(4, Math.floor(bounded / periodLengthSeconds) + 1);
  const periodStart = (period - 1) * periodLengthSeconds;
  const inPeriodElapsed = Math.max(0, bounded - periodStart);
  const remainingInPeriod = Math.max(0, periodLengthSeconds - inPeriodElapsed);

  return `Q${period} ${formatSecondsAsMmSs(remainingInPeriod)}`;
};

export const normalizeTeamKey = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export type NormalizedNameProfile = {
  key: string;
  tokens: string[];
  /** Az eredeti név – a vezetéknév-felismeréshez (nagybetűs tokenek) kell. */
  raw: string;
};

export const buildNormalizedNameProfile = (value: string): NormalizedNameProfile => {
  const key = normalizeTeamKey(value);
  const tokens = key.split(' ').filter(Boolean);
  return { key, tokens, raw: value };
};

/** Box score ↔ Kosarstat névpárosítás a közös, vezetéknév-alapú illesztővel. */
export const matchesNormalizedNameProfile = (candidate: string, profiles: NormalizedNameProfile[]) =>
  profiles.some(profile => playerNamesMatch(candidate, profile.raw));

export const roundValue = (value: number, digits = 1) => {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
};

export type GamePlayerStatRow = {
  id: string;
  player_id: string;
  game_id: string;
  is_starter?: boolean | null;
  points?: number | null;
  minutes?: number | null;
  close_made?: number | null;
  close_attempted?: number | null;
  mid_made?: number | null;
  mid_attempted?: number | null;
  three_made?: number | null;
  three_attempted?: number | null;
  free_throw_made?: number | null;
  free_throw_attempted?: number | null;
  offensive_rebounds?: number | null;
  defensive_rebounds?: number | null;
  total_rebounds?: number | null;
  assists?: number | null;
  steals?: number | null;
  turnovers?: number | null;
  blocks?: number | null;
  valuation?: number | null;
  fouls_committed?: number | null;
  fouls_drawn?: number | null;
  blocks_suffered?: number | null;
  blocks_given?: number | null;
  plus_minus?: number | null;
  created_at?: string | null;
  offensive_rating?: number | null;
  defensive_rating?: number | null;
  true_shooting_percentage?: number | null;
  effective_field_goal_percentage?: number | null;
  games?: {
    date?: string | null;
    opponent?: string | null;
    season_id?: string | null;
  } | null;
  players?: {
    name?: string | null;
    position?: string | null;
    team_id?: string | null;
  } | null;
  teams?: {
    name?: string | null;
  } | null;
};

export const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export const clampPercent = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
