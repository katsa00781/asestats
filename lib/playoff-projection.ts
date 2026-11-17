// Bajnoki előrejelzés és rájátszás-szimuláció: a projekció sor- és párharc-típusai,
// a győzelmi valószínűség bizonyossági címkéje és a best-of párharc kimenet-eloszlása.
// A SeasonComparison-ből kiszervezve (H34/F1c), viselkedésváltozás nélkül. Nem @core modul.
import { clamp01 } from '@/lib/season-comparison-helpers';

export type ProjectionRow = {
  team: string;
  currentWins: number;
  currentLosses: number;
  projectedWins: number;
  projectedLosses: number;
  expectedExtraWins: number;
  expectedFinalPoints: number;
  avgWinProbability: number;
  certaintyLabel: 'Magas' | 'Közepes' | 'Alacsony';
  certaintyScore: number;
};

export type PlayoffSeriesProjection = {
  seriesKey: string;
  round: 'Negyeddöntő' | 'Elődöntő' | 'Döntő' | 'Bronz' | '5-8 helyosztó elődöntő' | '5. helyért' | '7. helyért';
  homeSeed: number;
  awaySeed: number;
  homeTeam: string;
  awayTeam: string;
  homeWinProbability: number;
  awayWinProbability: number;
  winner: string;
  loser: string;
  mostLikelyScore: string;
  certaintyLabel: 'Magas' | 'Közepes' | 'Alacsony';
  manualOverride: boolean;
};

export type ProjectionUpcomingGame = {
  fixtureId: string;
  gameDate: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamKey: string;
  awayTeamKey: string;
  homeWinProbabilityModel: number;
  awayWinProbabilityModel: number;
  homeWinProbabilityApplied: number;
  awayWinProbabilityApplied: number;
  certaintyApplied: number;
  overrideWinnerSide: 'home' | 'away' | null;
};

export type PlayoffProjectionResult = {
  champion: string;
  runnerUp: string;
  third: string;
  fourth: string;
  finalRanking: Array<{ position: number; team: string; note?: string }>;
  series: PlayoffSeriesProjection[];
};

export const probabilityLabel = (value: number): 'Magas' | 'Közepes' | 'Alacsony' => {
  if (value >= 0.68 || value <= 0.32) return 'Magas';
  if (value >= 0.58 || value <= 0.42) return 'Közepes';
  return 'Alacsony';
};

export const bestOfSeriesOutcome = (gameProbabilities: number[], winsNeeded: number) => {
  const scoreProbabilities = new Map<string, number>();

  const walk = (gameIndex: number, homeWins: number, awayWins: number, probability: number) => {
    if (homeWins >= winsNeeded || awayWins >= winsNeeded || gameIndex >= gameProbabilities.length) {
      if (homeWins >= winsNeeded || awayWins >= winsNeeded) {
        const key = `${homeWins}-${awayWins}`;
        scoreProbabilities.set(key, (scoreProbabilities.get(key) || 0) + probability);
      }
      return;
    }

    const pHome = clamp01(gameProbabilities[gameIndex] ?? 0.5);
    walk(gameIndex + 1, homeWins + 1, awayWins, probability * pHome);
    walk(gameIndex + 1, homeWins, awayWins + 1, probability * (1 - pHome));
  };

  walk(0, 0, 0, 1);

  let homeSeriesWinProbability = 0;
  let mostLikelyHomeWinScore: string | null = null;
  let mostLikelyAwayWinScore: string | null = null;
  let mostLikelyHomeWinProbability = -1;
  let mostLikelyAwayWinProbability = -1;

  scoreProbabilities.forEach((probability, score) => {
    const [home, away] = score.split('-').map(value => Number(value));
    if (home > away) {
      homeSeriesWinProbability += probability;
      if (probability > mostLikelyHomeWinProbability) {
        mostLikelyHomeWinProbability = probability;
        mostLikelyHomeWinScore = score;
      }
    } else {
      if (probability > mostLikelyAwayWinProbability) {
        mostLikelyAwayWinProbability = probability;
        mostLikelyAwayWinScore = score;
      }
    }
  });

  return {
    homeSeriesWinProbability: clamp01(homeSeriesWinProbability),
    mostLikelyHomeWinScore,
    mostLikelyAwayWinScore,
  };
};
