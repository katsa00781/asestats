'use client';

import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  buildSituationalData,
  type GameRow,
  type QuarterStatRow,
  type TeamMetricRow,
  type SituationResult,
  type SituationalData,
} from '@/lib/situational-analysis';

type Props = {
  selectedTeamId: string
  selectedSeasonId: string
  teamName?: string
}

const TOOLTIP_STYLE = {
  backgroundColor: '#1e293b',
  border: '1px solid #475569',
  borderRadius: '8px',
  color: '#f1f5f9',
  fontSize: '13px',
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`
}

function round1(v: number) {
  return Math.round(v * 10) / 10
}

function WinRateBar({ result }: { result: SituationResult }) {
  const wr = result.winRate
  const color = wr >= 0.6 ? '#22c55e' : wr >= 0.4 ? '#eab308' : '#ef4444'
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-400">
        <span>{result.label}</span>
        <span className="font-medium" style={{ color }}>
          {result.wins}-{result.losses} ({pct(wr)})
        </span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.round(wr * 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

function MetricCard({ label, value, unit = '' }: { label: string; value: number; unit?: string }) {
  return (
    <div className="bg-slate-800 rounded-lg p-3 text-center">
      <div className="text-lg font-bold text-slate-100">{round1(value)}{unit}</div>
      <div className="text-xs text-slate-400 mt-0.5">{label}</div>
    </div>
  )
}

function HomeAwayMetric({ label, home, away }: { label: string; home: number; away: number }) {
  const homeColor = home >= away ? '#22c55e' : '#ef4444'
  const awayColor = away >= home ? '#22c55e' : '#ef4444'
  return (
    <div className="bg-slate-800 rounded-lg p-3">
      <div className="text-xs text-slate-400 mb-2 text-center">{label}</div>
      <div className="flex justify-around">
        <div className="text-center">
          <div className="text-sm font-bold" style={{ color: homeColor }}>{round1(home)}</div>
          <div className="text-xs text-slate-500">Hazai</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-bold" style={{ color: awayColor }}>{round1(away)}</div>
          <div className="text-xs text-slate-500">Vendég</div>
        </div>
      </div>
    </div>
  )
}

export function SituationalAnalysis({ selectedTeamId, selectedSeasonId, teamName }: Props) {
  const [data, setData] = useState<SituationalData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedTeamId || !selectedSeasonId) return
    setLoading(true)
    setError(null)

    async function load() {
      try {
        const [gamesRes, quartersRes, metricsRes] = await Promise.all([
          supabase
            .from('games')
            .select('id, date, opponent, home_away, our_score, opp_score, result, kosarstat_game_id')
            .eq('season_id', selectedSeasonId)
            .eq('our_team_id', selectedTeamId),
          supabase
            .from('kosarstat_game_quarter_stats')
            .select('kosarstat_game_id, team_side, quarter, points, cumulative_points')
            .eq('season_id', selectedSeasonId),
          supabase
            .from('kosarstat_game_team_metrics')
            .select('kosarstat_game_id, team_side, poss, ortg, efg, tov_pct, orb_pct, ftm_rate')
            .eq('season_id', selectedSeasonId),
        ])

        if (gamesRes.error) throw gamesRes.error
        if (quartersRes.error) throw quartersRes.error
        if (metricsRes.error) throw metricsRes.error

        const result = buildSituationalData(
          (gamesRes.data ?? []) as GameRow[],
          (quartersRes.data ?? []) as QuarterStatRow[],
          (metricsRes.data ?? []) as TeamMetricRow[],
        )
        setData(result)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Hiba történt')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [selectedTeamId, selectedSeasonId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Loader2 className="animate-spin mr-2" size={20} />
        Betöltés...
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-16 text-red-400">
        <p>{error}</p>
      </div>
    )
  }

  if (!data) return null

  const { quarters, situations, form, metrics, gamesWithQuarterData, gamesWithMetricsData, totalGames } = data

  const quarterChartData = quarters.map(q => ({
    name: q.label,
    Szerzett: round1(q.avgScored),
    Kapott: round1(q.avgAllowed),
    Különbség: round1(q.avgMargin),
  }))

  const formChartData = form
    .filter(f => f.rollingWinRate5 !== null)
    .map(f => ({
      name: `${f.gameIndex}. (${f.opponent.slice(0, 6)})`,
      'Gördülő győz% (5)': Math.round((f.rollingWinRate5 ?? 0) * 100),
      result: f.result,
    }))

  const marginChartData = form.map(f => ({
    name: `${f.gameIndex}.`,
    fullName: f.opponent,
    Különbség: f.margin,
    result: f.result,
  }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-100">Szituációs Elemzés</h2>
        {teamName && <Badge variant="outline" className="border-slate-600 text-slate-300">{teamName}</Badge>}
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-2xl font-bold text-slate-100">{totalGames}</div>
          <div className="text-xs text-slate-400">Mérkőzés</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-2xl font-bold text-blue-400">{gamesWithQuarterData}</div>
          <div className="text-xs text-slate-400">Negyed adat</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-2xl font-bold text-purple-400">{gamesWithMetricsData}</div>
          <div className="text-xs text-slate-400">Metrika adat</div>
        </div>
      </div>

      <Tabs defaultValue="quarters" className="space-y-4">
        <TabsList className="bg-slate-800 border border-slate-700">
          <TabsTrigger value="quarters" className="data-[state=active]:bg-slate-700 text-slate-300">
            Negyedek
          </TabsTrigger>
          <TabsTrigger value="situations" className="data-[state=active]:bg-slate-700 text-slate-300">
            Játékhelyzetek
          </TabsTrigger>
          <TabsTrigger value="form" className="data-[state=active]:bg-slate-700 text-slate-300">
            Forma
          </TabsTrigger>
        </TabsList>

        {/* NEGYEDEK TAB */}
        <TabsContent value="quarters" className="space-y-4">
          {gamesWithQuarterData === 0 ? (
            <div className="text-center py-10 text-slate-500">Nincs negyed-szintű adat ehhez a szezonhoz.</div>
          ) : (
            <>
              <Card className="bg-slate-900 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-slate-200 text-sm">Átlagos pontok negyedenként</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={quarterChartData} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                      <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} domain={[0, 'auto']} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="Szerzett" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Kapott" fill="#ef4444" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-slate-200 text-sm">Negyed mérleg és különbség</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-3">
                    {quarters.map(q => {
                      const color = q.avgMargin > 0 ? '#22c55e' : q.avgMargin < 0 ? '#ef4444' : '#94a3b8'
                      return (
                        <div key={q.quarter} className="bg-slate-800 rounded-lg p-3 text-center space-y-1">
                          <div className="text-sm font-bold text-slate-200">{q.label}</div>
                          <div className="text-xs text-slate-400">{q.wins}Gy – {q.losses}V</div>
                          <div className="text-base font-semibold" style={{ color }}>
                            {q.avgMargin > 0 ? '+' : ''}{round1(q.avgMargin)}
                          </div>
                          <div className="text-xs text-slate-500">{round1(q.avgScored)} / {round1(q.avgAllowed)}</div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {gamesWithMetricsData > 0 && (
                <Card className="bg-slate-900 border-slate-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-slate-200 text-sm">Csapat metrikák ({gamesWithMetricsData} meccs)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <MetricCard label="Offenzív rating" value={metrics.avgOrtg} />
                      <MetricCard label="eFG%" value={metrics.avgEfg} unit="%" />
                      <MetricCard label="TOV%" value={metrics.avgTovPct} unit="%" />
                      <MetricCard label="OREB%" value={metrics.avgOrbPct} unit="%" />
                      <MetricCard label="FTM arány" value={metrics.avgFtmRate * 100} unit="%" />
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <HomeAwayMetric label="Offenzív rating" home={metrics.homeAvgOrtg} away={metrics.awayAvgOrtg} />
                      <HomeAwayMetric label="eFG%" home={metrics.homeAvgEfg} away={metrics.awayAvgEfg} />
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* JÁTÉKHELYZETEK TAB */}
        <TabsContent value="situations" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-200 text-sm">Hazai / Vendég</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <WinRateBar result={situations.home} />
                <WinRateBar result={situations.away} />
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-200 text-sm">Marzsok</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <WinRateBar result={situations.closeGames} />
                <WinRateBar result={situations.blowouts} />
              </CardContent>
            </Card>

            {gamesWithQuarterData > 0 && (
              <>
                <Card className="bg-slate-900 border-slate-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-slate-200 text-sm">Félidős állás</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <WinRateBar result={situations.leadingAtHalf} />
                    <WinRateBar result={situations.trailingAtHalf} />
                  </CardContent>
                </Card>

                <Card className="bg-slate-900 border-slate-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-slate-200 text-sm">1. negyed hatása</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <WinRateBar result={situations.wonQ1} />
                    <WinRateBar result={situations.lostQ1} />
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          <Card className="bg-slate-900 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-slate-200 text-sm">Összefoglalás</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.values(situations).map(s => (
                  <div key={s.label} className="flex items-center justify-between text-sm py-1 border-b border-slate-800 last:border-0">
                    <span className="text-slate-300">{s.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400 text-xs">{s.wins}-{s.losses}</span>
                      <Badge
                        variant="outline"
                        className="text-xs w-14 justify-center"
                        style={{
                          borderColor: s.winRate >= 0.6 ? '#22c55e' : s.winRate >= 0.4 ? '#eab308' : '#ef4444',
                          color: s.winRate >= 0.6 ? '#22c55e' : s.winRate >= 0.4 ? '#eab308' : '#ef4444',
                        }}
                      >
                        {pct(s.winRate)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FORMA TAB */}
        <TabsContent value="form" className="space-y-4">
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-slate-200 text-sm">Meccsenkénti különbség</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={marginChartData} barCategoryGap="15%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value, _name, props) => [
                      `${(value as number) > 0 ? '+' : ''}${value}`,
                      (props.payload as { fullName?: string })?.fullName ?? 'Különbség',
                    ]}
                  />
                  <Bar dataKey="Különbség" radius={[3, 3, 0, 0]}>
                    {marginChartData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.result === 'W' ? '#3b82f6' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {formChartData.length > 0 && (
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-200 text-sm">Gördülő győzési% (5 meccs)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={formChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                    <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v}%`, 'Győz%']} />
                    <Line
                      type="monotone"
                      dataKey="Gördülő győz% (5)"
                      stroke="#a78bfa"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#a78bfa' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card className="bg-slate-900 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-slate-200 text-sm">Meccs lista</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                {[...form].reverse().map(f => (
                  <div key={f.gameIndex} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-800 last:border-0">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="w-6 h-5 text-xs flex items-center justify-center p-0"
                        style={{
                          borderColor: f.result === 'W' ? '#3b82f6' : '#ef4444',
                          color: f.result === 'W' ? '#3b82f6' : '#ef4444',
                        }}
                      >
                        {f.result}
                      </Badge>
                      <span className="text-slate-300">{f.opponent}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400">{f.ourScore}–{f.oppScore}</span>
                      <span
                        className="w-10 text-right font-medium"
                        style={{ color: f.margin > 0 ? '#22c55e' : '#ef4444' }}
                      >
                        {f.margin > 0 ? '+' : ''}{f.margin}
                      </span>
                      <span className="text-slate-600 text-xs w-16 text-right">
                        {f.date.slice(0, 10)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
