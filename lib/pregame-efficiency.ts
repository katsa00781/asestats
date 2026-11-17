// Pre-game hatékonysági modell: a csapat szezonos meccsátlagából számolt baseline
// (birtoklás, dobásmix, eFG, PPP, várható pont) és a what-if bemenetekből számolt
// projekció. A SeasonComparison-ből kiszervezve (H34/F1c), viselkedésváltozás nélkül.
// Nem @core modul.
import type { TeamSeasonStat as PregameTeamSeasonStat } from '@/lib/pregame-scouting';
import { clampPercent, roundValue } from '@/lib/season-comparison-helpers';

export type PregameEfficiencyBaseline = {
  teamId: string;
  teamName: string;
  games: number;
  actualPointsPerGame: number;
  possessions: number;
  fga: number;
  twoPA: number;
  threePA: number;
  fta: number;
  tov: number;
  oreb: number;
  twoPct: number;
  threePct: number;
  ftPct: number;
  threeSharePct: number;
  ftRatePct: number;
  tovRatePct: number;
  orebBonusPct: number;
  efg: number;
  ppp: number;
  expectedPoints: number;
};

export type PregameEfficiencyInputs = {
  ownPossessions: number;
  ownThreeSharePct: number;
  ownFtRatePct: number;
  ownTovRatePct: number;
  ownOrebBonusPct: number;
  ownTwoPct: number;
  ownThreePct: number;
  ownFtPct: number;
  opponentPossessions: number;
  opponentThreeSharePct: number;
  opponentFtRatePct: number;
  opponentTovRatePct: number;
  opponentOrebBonusPct: number;
  opponentTwoPct: number;
  opponentThreePct: number;
  opponentFtPct: number;
};

export const buildPregameEfficiencyBaseline = (team: PregameTeamSeasonStat): PregameEfficiencyBaseline => {
  const games = Math.max(team.games || 1, 1);
  const twoPA = (team.fga2 || 0) / games;
  const threePA = (team.fga3 || 0) / games;
  const fta = (team.fta || 0) / games;
  const tov = (team.tov || 0) / games;
  const oreb = (team.oreb || 0) / games;
  const fga = twoPA + threePA;
  const possessions = Math.max(fga + 0.44 * fta + tov - oreb, 0.1);
  const twoPct = team.fga2 > 0 ? ((team.fgm2 || 0) / team.fga2) * 100 : 0;
  const threePct = team.fga3 > 0 ? ((team.fgm3 || 0) / team.fga3) * 100 : 0;
  const ftPct = team.fta > 0 ? ((team.ftm || 0) / team.fta) * 100 : 0;
  const threeSharePct = fga > 0 ? (threePA / fga) * 100 : 0;
  const ftRatePct = fga > 0 ? (fta / fga) * 100 : 0;
  const tovRatePct = possessions > 0 ? (tov / possessions) * 100 : 0;
  const orebBonusPct = possessions > 0 ? (oreb / possessions) * 100 : 0;
  const made2 = twoPA * (twoPct / 100);
  const made3 = threePA * (threePct / 100);
  const expectedPoints = made2 * 2 + made3 * 3 + fta * (ftPct / 100);
  const efg = fga > 0 ? ((made2 + 1.5 * made3) / fga) * 100 : 0;
  const ppp = possessions > 0 ? expectedPoints / possessions : 0;

  return {
    teamId: team.teamId,
    teamName: team.teamName,
    games,
    actualPointsPerGame: (team.pointsFor || 0) / games,
    possessions: roundValue(possessions, 1),
    fga: roundValue(fga, 1),
    twoPA: roundValue(twoPA, 1),
    threePA: roundValue(threePA, 1),
    fta: roundValue(fta, 1),
    tov: roundValue(tov, 1),
    oreb: roundValue(oreb, 1),
    twoPct: roundValue(twoPct, 1),
    threePct: roundValue(threePct, 1),
    ftPct: roundValue(ftPct, 1),
    threeSharePct: roundValue(threeSharePct, 1),
    ftRatePct: roundValue(ftRatePct, 1),
    tovRatePct: roundValue(tovRatePct, 1),
    orebBonusPct: roundValue(orebBonusPct, 1),
    efg: roundValue(efg, 1),
    ppp: roundValue(ppp, 3),
    expectedPoints: roundValue(expectedPoints, 1),
  };
};

export const projectPregameEfficiency = (
  baseline: PregameEfficiencyBaseline,
  inputs: {
    possessions: number;
    threeSharePct: number;
    ftRatePct: number;
    tovRatePct: number;
    orebBonusPct: number;
    twoPct: number;
    threePct: number;
    ftPct: number;
  }
) => {
  const possessions = Math.max(inputs.possessions, 1);
  const threeSharePct = clampPercent(inputs.threeSharePct, 10, 70);
  const ftRatePct = clampPercent(inputs.ftRatePct, 5, 80);
  const tovRatePct = clampPercent(inputs.tovRatePct, 5, 30);
  const orebBonusPct = clampPercent(inputs.orebBonusPct, 0, 20);
  const twoPct = clampPercent(inputs.twoPct);
  const threePct = clampPercent(inputs.threePct);
  const ftPct = clampPercent(inputs.ftPct);
  const ftRate = ftRatePct / 100;
  const tov = possessions * (tovRatePct / 100);
  const oreb = possessions * (orebBonusPct / 100);
  const fga = Math.max((possessions - tov + oreb) / (1 + 0.44 * ftRate), 0);
  const threePA = fga * (threeSharePct / 100);
  const twoPA = Math.max(fga - threePA, 0);
  const fta = fga * ftRate;
  const made2 = twoPA * (twoPct / 100);
  const made3 = threePA * (threePct / 100);
  const expectedPoints = made2 * 2 + made3 * 3 + fta * (ftPct / 100);
  const totalFga = twoPA + threePA;
  const efg = totalFga > 0 ? ((made2 + 1.5 * made3) / totalFga) * 100 : 0;
  const ppp = possessions > 0 ? expectedPoints / possessions : 0;

  return {
    possessions: roundValue(possessions, 1),
    fga: roundValue(fga, 1),
    twoPA: roundValue(twoPA, 1),
    threePA: roundValue(threePA, 1),
    fta: roundValue(fta, 1),
    tov: roundValue(tov, 1),
    oreb: roundValue(oreb, 1),
    threeSharePct: roundValue(threeSharePct, 1),
    ftRatePct: roundValue(ftRatePct, 1),
    tovRatePct: roundValue(tovRatePct, 1),
    orebBonusPct: roundValue(orebBonusPct, 1),
    twoPct: roundValue(twoPct, 1),
    threePct: roundValue(threePct, 1),
    ftPct: roundValue(ftPct, 1),
    expectedPoints: roundValue(expectedPoints, 1),
    efg: roundValue(efg, 1),
    ppp: roundValue(ppp, 3),
    deltaPoints: roundValue(expectedPoints - baseline.expectedPoints, 1),
    deltaEfg: roundValue(efg - baseline.efg, 1),
  };
};
