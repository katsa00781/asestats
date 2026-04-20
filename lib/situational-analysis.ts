export type GameRow = {
  id: string
  date: string
  opponent: string
  home_away: 'home' | 'away'
  our_score: number
  opp_score: number
  result: 'win' | 'loss'
  kosarstat_game_id: string | null
}

export type QuarterStatRow = {
  kosarstat_game_id: string
  team_side: 'home' | 'away'
  quarter: number
  points: number
  cumulative_points: number
}

export type TeamMetricRow = {
  kosarstat_game_id: string
  team_side: 'home' | 'away'
  poss: number
  ortg: number
  efg: number
  tov_pct: number
  orb_pct: number
  ftm_rate: number
}

export type QuarterData = {
  quarter: number
  label: string
  wins: number
  losses: number
  winRate: number
  avgScored: number
  avgAllowed: number
  avgMargin: number
}

export type SituationResult = {
  label: string
  wins: number
  losses: number
  total: number
  winRate: number
}

export type FormEntry = {
  gameIndex: number
  date: string
  opponent: string
  result: 'W' | 'L'
  ourScore: number
  oppScore: number
  margin: number
  rollingWinRate5: number | null
}

export type MetricsData = {
  avgOrtg: number
  avgEfg: number
  avgTovPct: number
  avgOrbPct: number
  avgFtmRate: number
  homeAvgOrtg: number
  awayAvgOrtg: number
  homeAvgEfg: number
  awayAvgEfg: number
}

export type SituationalData = {
  quarters: QuarterData[]
  situations: {
    home: SituationResult
    away: SituationResult
    closeGames: SituationResult
    blowouts: SituationResult
    leadingAtHalf: SituationResult
    trailingAtHalf: SituationResult
    wonQ1: SituationResult
    lostQ1: SituationResult
  }
  form: FormEntry[]
  metrics: MetricsData
  gamesWithQuarterData: number
  gamesWithMetricsData: number
  totalGames: number
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

function sitResult(label: string, wins: number, total: number): SituationResult {
  const losses = total - wins
  return { label, wins, losses, total, winRate: total > 0 ? wins / total : 0 }
}

export function buildSituationalData(
  games: GameRow[],
  quarterStats: QuarterStatRow[],
  teamMetrics: TeamMetricRow[]
): SituationalData {
  const totalGames = games.length

  // Index quarter stats and metrics by kosarstat_game_id
  const quartersByGame = new Map<string, QuarterStatRow[]>()
  for (const row of quarterStats) {
    const arr = quartersByGame.get(row.kosarstat_game_id) ?? []
    arr.push(row)
    quartersByGame.set(row.kosarstat_game_id, arr)
  }

  const metricsByGame = new Map<string, TeamMetricRow[]>()
  for (const row of teamMetrics) {
    const arr = metricsByGame.get(row.kosarstat_game_id) ?? []
    arr.push(row)
    metricsByGame.set(row.kosarstat_game_id, arr)
  }

  // Per-quarter accumulators [q1..q4]
  type QuarterAcc = { scored: number[]; allowed: number[]; wins: number; losses: number }
  const qAccs: QuarterAcc[] = [1, 2, 3, 4].map(() => ({ scored: [], allowed: [], wins: 0, losses: 0 }))

  // Situation counters
  let homeWins = 0, homeTotal = 0
  let awayWins = 0, awayTotal = 0
  let closeWins = 0, closeTotal = 0
  let blowoutWins = 0, blowoutTotal = 0
  let leadHalfWins = 0, leadHalfTotal = 0
  let trailHalfWins = 0, trailHalfTotal = 0
  let wonQ1Wins = 0, wonQ1Total = 0
  let lostQ1Wins = 0, lostQ1Total = 0

  let gamesWithQuarterData = 0
  let gamesWithMetricsData = 0

  // Metrics accumulators
  const ortgAll: number[] = []
  const efgAll: number[] = []
  const tovAll: number[] = []
  const orbAll: number[] = []
  const ftmAll: number[] = []
  const ortgHome: number[] = []
  const ortgAway: number[] = []
  const efgHome: number[] = []
  const efgAway: number[] = []

  // Form entries (sorted by date ascending)
  const sortedGames = [...games].sort((a, b) => a.date.localeCompare(b.date))

  const formEntries: FormEntry[] = []

  for (let i = 0; i < sortedGames.length; i++) {
    const game = sortedGames[i]
    const isWin = game.result === 'win'
    const margin = game.our_score - game.opp_score

    // Home / Away
    if (game.home_away === 'home') {
      homeTotal++
      if (isWin) homeWins++
    } else {
      awayTotal++
      if (isWin) awayWins++
    }

    // Close / Blowout
    const absMargin = Math.abs(margin)
    if (absMargin <= 5) {
      closeTotal++
      if (isWin) closeWins++
    }
    if (absMargin >= 15) {
      blowoutTotal++
      if (isWin) blowoutWins++
    }

    // Quarter data
    const kid = game.kosarstat_game_id
    if (kid) {
      const rows = quartersByGame.get(kid)
      if (rows && rows.length > 0) {
        gamesWithQuarterData++

        const ownSide = game.home_away
        const oppSide = ownSide === 'home' ? 'away' : 'home'

        for (let q = 1; q <= 4; q++) {
          const ownRow = rows.find(r => r.team_side === ownSide && r.quarter === q)
          const oppRow = rows.find(r => r.team_side === oppSide && r.quarter === q)
          if (ownRow && oppRow) {
            const acc = qAccs[q - 1]
            acc.scored.push(ownRow.points)
            acc.allowed.push(oppRow.points)
            if (ownRow.points > oppRow.points) acc.wins++
            else if (ownRow.points < oppRow.points) acc.losses++
          }
        }

        // Leading at half: sum of Q1+Q2 cumulative
        const ownQ2 = rows.find(r => r.team_side === ownSide && r.quarter === 2)
        const oppQ2 = rows.find(r => r.team_side === oppSide && r.quarter === 2)
        if (ownQ2 && oppQ2) {
          if (ownQ2.cumulative_points > oppQ2.cumulative_points) {
            leadHalfTotal++
            if (isWin) leadHalfWins++
          } else if (ownQ2.cumulative_points < oppQ2.cumulative_points) {
            trailHalfTotal++
            if (isWin) trailHalfWins++
          }
        }

        // Won Q1
        const ownQ1 = rows.find(r => r.team_side === ownSide && r.quarter === 1)
        const oppQ1 = rows.find(r => r.team_side === oppSide && r.quarter === 1)
        if (ownQ1 && oppQ1) {
          if (ownQ1.points > oppQ1.points) {
            wonQ1Total++
            if (isWin) wonQ1Wins++
          } else if (ownQ1.points < oppQ1.points) {
            lostQ1Total++
            if (isWin) lostQ1Wins++
          }
        }
      }

      // Metrics
      const mrows = metricsByGame.get(kid)
      if (mrows && mrows.length > 0) {
        gamesWithMetricsData++
        const ownSide = game.home_away
        const ownM = mrows.find(r => r.team_side === ownSide)
        if (ownM) {
          if (ownM.ortg > 0) {
            ortgAll.push(ownM.ortg)
            if (game.home_away === 'home') { ortgHome.push(ownM.ortg); efgHome.push(ownM.efg) }
            else { ortgAway.push(ownM.ortg); efgAway.push(ownM.efg) }
          }
          if (ownM.efg > 0) efgAll.push(ownM.efg)
          if (ownM.tov_pct > 0) tovAll.push(ownM.tov_pct)
          if (ownM.orb_pct > 0) orbAll.push(ownM.orb_pct)
          if (ownM.ftm_rate > 0) ftmAll.push(ownM.ftm_rate)
        }
      }
    }

    // Rolling 5-game win rate
    const start = Math.max(0, i - 4)
    const window = sortedGames.slice(start, i + 1)
    const windowWins = window.filter(g => g.result === 'win').length
    const rollingWinRate5 = i >= 4 ? windowWins / 5 : null

    formEntries.push({
      gameIndex: i + 1,
      date: game.date,
      opponent: game.opponent,
      result: isWin ? 'W' : 'L',
      ourScore: game.our_score,
      oppScore: game.opp_score,
      margin,
      rollingWinRate5,
    })
  }

  const quarters: QuarterData[] = qAccs.map((acc, idx) => {
    const q = idx + 1
    const count = acc.scored.length
    const wins = acc.wins
    const losses = acc.losses
    return {
      quarter: q,
      label: `N${q}`,
      wins,
      losses,
      winRate: wins + losses > 0 ? wins / (wins + losses) : 0,
      avgScored: avg(acc.scored),
      avgAllowed: avg(acc.allowed),
      avgMargin: avg(acc.scored) - avg(acc.allowed),
    }
  })

  const metrics: MetricsData = {
    avgOrtg: avg(ortgAll),
    avgEfg: avg(efgAll),
    avgTovPct: avg(tovAll),
    avgOrbPct: avg(orbAll),
    avgFtmRate: avg(ftmAll),
    homeAvgOrtg: avg(ortgHome),
    awayAvgOrtg: avg(ortgAway),
    homeAvgEfg: avg(efgHome),
    awayAvgEfg: avg(efgAway),
  }

  return {
    quarters,
    situations: {
      home: sitResult('Hazai', homeWins, homeTotal),
      away: sitResult('Vendég', awayWins, awayTotal),
      closeGames: sitResult('Szoros (≤5p)', closeWins, closeTotal),
      blowouts: sitResult('Gálameccs (≥15p)', blowoutWins, blowoutTotal),
      leadingAtHalf: sitResult('Félidőben vezet', leadHalfWins, leadHalfTotal),
      trailingAtHalf: sitResult('Félidős hátrány', trailHalfWins, trailHalfTotal),
      wonQ1: sitResult('N1-et megnyerte', wonQ1Wins, wonQ1Total),
      lostQ1: sitResult('N1-et elvesztette', lostQ1Wins, lostQ1Total),
    },
    form: formEntries,
    metrics,
    gamesWithQuarterData,
    gamesWithMetricsData,
    totalGames,
  }
}
