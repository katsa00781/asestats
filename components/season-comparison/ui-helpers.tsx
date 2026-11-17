// A SeasonComparison szekciók közös megjelenítési segédei: tónus- és mintabiztonság-osztályok,
// küszöb-tooltip, az érkező játékos kártya alapértékei.
import type { PlayerAnalysis } from '@/lib/player-analysis';
import type { IncomingPlayerInput } from '@/components/season-comparison/types';
import { Tooltip as UiTooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export const getInsightToneClass = (tone: 'good' | 'neutral' | 'risk' | 'na') => {
  if (tone === 'good') return 'text-positive';
  if (tone === 'risk') return 'text-negative';
  if (tone === 'neutral') return 'text-warning';
  return 'text-secondary';
};

export const getSampleConfidenceBadgeClass = (confidence: 'alacsony' | 'kozepes' | 'magas') => {
  if (confidence === 'magas') return 'bg-positive/15 text-positive border border-positive/30';
  if (confidence === 'kozepes') return 'bg-warning/15 text-warning border border-warning/30';
  return 'bg-surface-2 text-primary border border-border-subtle';
};

export const normalizeSampleConfidence = (confidence: string | undefined): 'alacsony' | 'kozepes' | 'magas' => {
  if (confidence === 'magas' || confidence === 'kozepes' || confidence === 'alacsony') return confidence;
  return 'alacsony';
};

export const formatSampleConfidenceLabel = (confidence: 'alacsony' | 'kozepes' | 'magas') => {
  if (confidence === 'magas') return 'Minta: magas';
  if (confidence === 'kozepes') return 'Minta: közepes';
  return 'Minta: alacsony';
};

export const getConfidenceTone = (confidence: PlayerAnalysis['confidence']) => {
  switch (confidence) {
    case 'Magas':
      return 'text-positive';
    case 'Közepes':
      return 'text-warning';
    default:
      return 'text-negative';
  }
};

export const DEFAULT_INCOMING_PLAYER: IncomingPlayerInput = {
  name: '',
  position: 'SG',
  games: 0,
  minutesPerGame: 0,
  pointsPerGame: 0,
  assistsPerGame: 0,
  orebPerGame: 0,
  drebPerGame: 0,
  valuationPerGame: 0,
  twoPct: 0,
  twoAttemptedPerGame: 0,
  threePct: 0,
  threeAttemptedPerGame: 0,
  ftPct: 0,
  ftAttemptedPerGame: 0,
  turnoversPerGame: 0,
  stealsPerGame: 0,
  blocksPerGame: 0,
  foulsCommittedPerGame: 0,
  foulsReceivedPerGame: 0,
};

export const INCOMING_PLAYER_PLACEHOLDER = '/player-placeholder.svg';

export const isUnavailableIncomingPhoto = (photoUrl?: string) => {
  if (!photoUrl) return true;
  return /Not_Available\.jpg|images\/logom1\.jpg/i.test(photoUrl);
};

// Az „i” ikonos küszöb-magyarázat a játékos haladó blokkjainak fejlécében.
export function ThresholdTooltip({ content }: { content: string }) {
  return (
    <UiTooltip>
      <TooltipTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-border-subtle text-[10px] text-secondary hover:bg-surface-2"
          aria-label="Küszöb információ"
        >
          i
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs whitespace-pre-line break-words text-xs leading-relaxed">
        {content}
      </TooltipContent>
    </UiTooltip>
  );
}
