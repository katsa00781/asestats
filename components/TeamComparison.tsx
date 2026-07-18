'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatPercent as formatPercentShared } from '@/lib/stat-formulas';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import {
	ResponsiveContainer,
	LineChart,
	Line,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	RadarChart,
	PolarGrid,
	PolarAngleAxis,
	PolarRadiusAxis,
	Radar,
} from 'recharts';
import {
	Activity,
	ArrowLeft,
	BarChart2,
	RefreshCw,
	Shield,
	Target,
	TrendingUp,
} from 'lucide-react';

type TeamComparisonProps = {
	allSeasons: { id: string; name: string }[];
	allTeams: { id: string; name: string }[];
	currentSeasonId: string | null;
	currentTeamId: string | null;
	onBack: () => void;
};

type TeamSeasonSummary = {
	key: string;
	teamId: string;
	teamName: string;
	seasonId: string;
	seasonName: string;
	totalGames: number;
	wins: number;
	losses: number;
	avgPoints: number;
	avgOppPoints: number;
	pointDiff: number;
};

type TeamGameRow = {
	id: string;
	date: string;
	opponent: string;
	round?: number | null;
	season_id: string;
	our_team_id: string;
	our_score: number;
	opp_score: number;
	result: 'win' | 'loss';
};

type PlayerGameAggregateRow = {
	game_id: string;
	close_made: number | null;
	close_attempted: number | null;
	mid_made: number | null;
	mid_attempted: number | null;
	three_made: number | null;
	three_attempted: number | null;
	free_throw_made: number | null;
	free_throw_attempted: number | null;
	offensive_rebounds: number | null;
	defensive_rebounds: number | null;
	total_rebounds: number | null;
	assists: number | null;
	turnovers: number | null;
	steals: number | null;
	blocks: number | null;
	fouls_committed: number | null;
};

type ShootingProfile = {
	twoPA: number;
	twoPM: number;
	twoPct: number;
	threePA: number;
	threePM: number;
	threePct: number;
	ftAtt: number;
	ftMade: number;
	ftPct: number;
	totalFGA: number;
	threeShare: number;
	effectiveFg: number;
};

type TeamProfile = {
	key: string;
	teamId: string;
	teamName: string;
	seasonId: string;
	seasonName: string;
	games: TeamGameRow[];
	base: {
		avgPoints: number;
		avgOppPoints: number;
		pointDiff: number;
	};
	shooting: ShootingProfile;
	rebounds: {
		offensive: number;
		defensive: number;
		total: number;
	};
	playmaking: {
		assists: number;
		turnovers: number;
		astTo: number;
		steals: number;
		blocks: number;
	};
	fouls: {
		committed: number;
	};
	form: {
		lastFive: {
			games: TeamGameRow[];
			avgPoints: number;
			avgOppPoints: number;
			pointDiff: number;
		};
		trend: 'positive' | 'neutral' | 'negative';
	};
};

type TrendDatum = {
	label: string;
	[key: string]: number | string | null;
};

type RadarDatum = {
	metric: string;
	[key: string]: number | string;
};

type StrengthReportItem = {
	label: string;
	value: string;
	detail: string;
};

type HeadToHeadSummary = {
	games: TeamGameRow[];
	wins: number;
	losses: number;
	avgPoints: number;
	avgOppPoints: number;
	pointDiff: number;
};

const safeDivide = (value: number, divisor: number) => {
	if (!Number.isFinite(value) || !Number.isFinite(divisor) || divisor === 0) return 0;
	return value / divisor;
};

const formatNumber = (value: number, digits = 1) => {
	if (!Number.isFinite(value)) return '-';
	return value.toFixed(digits);
};

const formatPercent = (value: number) => formatPercentShared(value * 100);

const normalizeName = (value?: string | null) => (value || '').trim().toLowerCase();

const buildStrengthReport = (team: TeamProfile, opponent?: TeamProfile): StrengthReportItem[] => {
	const efgDiff = opponent ? team.shooting.effectiveFg - opponent.shooting.effectiveFg : 0;
	const astToDiff = opponent ? team.playmaking.astTo - opponent.playmaking.astTo : 0;
	const reboundDiff = opponent ? team.rebounds.total - opponent.rebounds.total : 0;
	const defenseDiff = opponent ? team.base.avgOppPoints - opponent.base.avgOppPoints : 0;

	return [
		{
			label: 'Pontkülönbség',
			value: `${formatNumber(team.base.pointDiff)} PPG`,
			detail: team.base.pointDiff >= 0 ? 'Stabil plusz mutató a meccsek végén.' : 'Negatív pontkülönbség javítandó.',
		},
		{
			label: 'Dobóhatékonyság',
			value: formatPercent(team.shooting.effectiveFg),
			detail: efgDiff >= 0 ? 'Jobb eFG%, mint az ellenfélé.' : 'Az ellenfél pontosabban dolgozik.',
		},
		{
			label: 'AST/TO arány',
			value: formatNumber(team.playmaking.astTo),
			detail: astToDiff >= 0 ? 'Rendezett támadás és labdajáratás.' : 'Az ellenfél kevesebbet ad el.',
		},
		{
			label: 'Lepattanók',
			value: `${formatNumber(team.rebounds.total)} RPG`,
			detail: reboundDiff >= 0 ? 'Pattanó dominancia.' : 'Az ellenfél több második esélyhez jut.',
		},
		{
			label: 'Kapott pontok',
			value: `${formatNumber(team.base.avgOppPoints)} PPG`,
			detail: defenseDiff <= 0 ? 'Fegyelmezett védekezés.' : 'Az ellenfél szorosabban tartja az ellenfeleket.',
		},
	];
};

const calculateHeadToHead = (teamA: TeamProfile, teamB: TeamProfile): HeadToHeadSummary | null => {
	const opponentName = normalizeName(teamB.teamName);
	const games = teamA.games.filter((game) => normalizeName(game.opponent) === opponentName);
	if (!games.length) return null;

	const wins = games.filter((game) => game.result === 'win').length;
	const losses = games.length - wins;
	const avgPoints = safeDivide(
		games.reduce((acc, game) => acc + game.our_score, 0),
		games.length,
	);
	const avgOppPoints = safeDivide(
		games.reduce((acc, game) => acc + game.opp_score, 0),
		games.length,
	);
	const pointDiff = avgPoints - avgOppPoints;

	return {
		games,
		wins,
		losses,
		avgPoints,
		avgOppPoints,
		pointDiff,
	};
};

const buildTrendDataset = (teamA?: TeamProfile, teamB?: TeamProfile): TrendDatum[] => {
	const total = Math.max(teamA?.games.length || 0, teamB?.games.length || 0);
	if (!total) return [];

	const entries: TrendDatum[] = [];
	for (let index = 0; index < total; index += 1) {
		const aGame = teamA?.games[index];
		const bGame = teamB?.games[index];
		const rawRound = aGame?.round ?? bGame?.round;
		const label = rawRound != null ? `${rawRound}` : `#${index + 1}`;
		const entry: TrendDatum = { label };
		if (teamA) entry[teamA.key] = aGame ? aGame.our_score - aGame.opp_score : null;
		if (teamB) entry[teamB.key] = bGame ? bGame.our_score - bGame.opp_score : null;
		entries.push(entry);
	}
	return entries;
};

const buildRadarDataset = (profiles: TeamProfile[]): RadarDatum[] => {
	if (!profiles.length) return [];

	const metrics = [
		{
			key: 'attack',
			label: 'Támadó hatékonyság',
			getter: (team: TeamProfile) => team.base.avgPoints,
		},
		{
			key: 'defense',
			label: 'Védekezés (kevesebb jobb)',
			getter: (team: TeamProfile) => Math.max(0, 120 - team.base.avgOppPoints),
		},
		{
			key: 'shooting',
			label: 'Dobóhatékonyság',
			getter: (team: TeamProfile) => team.shooting.effectiveFg * 100,
		},
		{
			key: 'playmaking',
			label: 'AST/TO',
			getter: (team: TeamProfile) => team.playmaking.astTo * 20,
		},
		{
			key: 'rebounding',
			label: 'Lepattanók',
			getter: (team: TeamProfile) => team.rebounds.total * 3,
		},
		{
			key: 'pressure',
			label: 'Labdaszerzés',
			getter: (team: TeamProfile) => (team.playmaking.steals + team.playmaking.blocks) * 5,
		},
	];

	return metrics.map((metric) => {
		const entry: RadarDatum = { metric: metric.label };
		profiles.forEach((team) => {
			entry[team.key] = Number(metric.getter(team).toFixed(2));
		});
		return entry;
	});
};

const TEAM_COLORS = ['var(--positive)', 'var(--accent-ai)'];

export function TeamComparison({ allSeasons, allTeams, currentSeasonId, currentTeamId, onBack }: TeamComparisonProps) {
	const [filterSeasonId, setFilterSeasonId] = useState<string>(currentSeasonId || 'all');
	const [teamSummaries, setTeamSummaries] = useState<TeamSeasonSummary[]>([]);
	const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
	const [teamProfiles, setTeamProfiles] = useState<Record<string, TeamProfile>>({});
	const [listLoading, setListLoading] = useState(false);
	const [profilesLoading, setProfilesLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const loadTeams = async () => {
			setListLoading(true);
			setError(null);
			try {
				let query = supabase
					.from('games')
					.select('id, date, round, opponent, season_id, our_team_id, our_score, opp_score, result')
					.order('date', { ascending: true });

				if (filterSeasonId !== 'all') {
					query = query.eq('season_id', filterSeasonId);
				}

				const { data, error: queryError } = await query;
				if (queryError) throw queryError;

				const grouped = new Map<string, TeamSeasonSummary>();
				const gameRows = (data || []) as TeamGameRow[];

				gameRows.forEach((game) => {
					const key = `${game.our_team_id}_${game.season_id}`;
					if (!grouped.has(key)) {
						const teamName = allTeams.find((team) => team.id === game.our_team_id)?.name || 'Ismeretlen csapat';
						const seasonName = allSeasons.find((season) => season.id === game.season_id)?.name || 'Ismeretlen szezon';
						grouped.set(key, {
							key,
							teamId: game.our_team_id,
							teamName,
							seasonId: game.season_id,
							seasonName,
							totalGames: 0,
							wins: 0,
							losses: 0,
							avgPoints: 0,
							avgOppPoints: 0,
							pointDiff: 0,
						});
					}

					const summary = grouped.get(key)!;
					summary.totalGames += 1;
					summary.wins += game.result === 'win' ? 1 : 0;
					summary.losses += game.result === 'loss' ? 1 : 0;
					summary.avgPoints += game.our_score;
					summary.avgOppPoints += game.opp_score;
				});

				const summaries = Array.from(grouped.values()).map((summary) => {
					if (!summary.totalGames) return summary;
					const avgPoints = summary.avgPoints / summary.totalGames;
					const avgOppPoints = summary.avgOppPoints / summary.totalGames;
					return {
						...summary,
						avgPoints,
						avgOppPoints,
						pointDiff: avgPoints - avgOppPoints,
					};
				});

				setTeamSummaries(summaries);

				if (!selectedKeys.length && currentTeamId) {
					const initial = summaries.find((summary) => summary.teamId === currentTeamId);
					if (initial) {
						setSelectedKeys([initial.key]);
					}
				}
			} catch (loadError) {
				console.error('TeamComparison: game summary load failed', loadError);
				setError('Nem sikerült betölteni a Hunbasket adatokat.');
			} finally {
				setListLoading(false);
			}
		};

		loadTeams();
	}, [filterSeasonId, allSeasons, allTeams, currentTeamId, selectedKeys.length]);

	useEffect(() => {
		const loadProfiles = async () => {
			const missingKeys = selectedKeys.filter((key) => !teamProfiles[key]);
			if (!missingKeys.length) return;
			setProfilesLoading(true);
			try {
				const loadedProfiles = await Promise.all(
					missingKeys.map(async (key) => {
						const summary = teamSummaries.find((item) => item.key === key);
						if (!summary) return null;

						const { data: games, error: gamesError } = await supabase
							.from('games')
							.select('id, date, round, opponent, season_id, our_team_id, our_score, opp_score, result')
							.eq('our_team_id', summary.teamId)
							.eq('season_id', summary.seasonId)
							.order('date', { ascending: true });

						if (gamesError) throw gamesError;
						const gameRows: TeamGameRow[] = (games || []) as TeamGameRow[];
						if (!gameRows.length) return null;

						const gameIds = gameRows.map((game) => game.id);
						let totals = {
							twoMade: 0,
							twoAtt: 0,
							threeMade: 0,
							threeAtt: 0,
							ftMade: 0,
							ftAtt: 0,
							offReb: 0,
							defReb: 0,
							totReb: 0,
							assists: 0,
							turnovers: 0,
							steals: 0,
							blocks: 0,
							fouls: 0,
						};

						if (gameIds.length) {
							const { data: stats, error: statsError } = await supabase
								.from('player_game_stats')
								.select(`
									game_id,
									close_made,
									close_attempted,
									mid_made,
									mid_attempted,
									three_made,
									three_attempted,
									free_throw_made,
									free_throw_attempted,
									offensive_rebounds,
									defensive_rebounds,
									total_rebounds,
									assists,
									turnovers,
									steals,
									blocks,
									fouls_committed,
									players!inner(team_id)
								`)
								.eq('players.team_id', summary.teamId)
								.in('game_id', gameIds);

							if (statsError) throw statsError;

							const playerGameStats = (stats || []) as PlayerGameAggregateRow[];
							totals = playerGameStats.reduce((acc, row) => {
								const twoMade = (row.close_made ?? 0) + (row.mid_made ?? 0);
								const twoAtt = (row.close_attempted ?? 0) + (row.mid_attempted ?? 0);
								acc.twoMade += twoMade;
								acc.twoAtt += twoAtt;
								acc.threeMade += row.three_made ?? 0;
								acc.threeAtt += row.three_attempted ?? 0;
								acc.ftMade += row.free_throw_made ?? 0;
								acc.ftAtt += row.free_throw_attempted ?? 0;
								acc.offReb += row.offensive_rebounds ?? 0;
								acc.defReb += row.defensive_rebounds ?? 0;
								acc.totReb += row.total_rebounds ?? 0;
								acc.assists += row.assists ?? 0;
								acc.turnovers += row.turnovers ?? 0;
								acc.steals += row.steals ?? 0;
								acc.blocks += row.blocks ?? 0;
								acc.fouls += row.fouls_committed ?? 0;
								return acc;
							}, totals);
						}

						const gamesPlayed = gameRows.length;
						const totalFGA = totals.twoAtt + totals.threeAtt;

						const shooting: ShootingProfile = {
							twoPA: safeDivide(totals.twoAtt, gamesPlayed),
							twoPM: safeDivide(totals.twoMade, gamesPlayed),
							twoPct: safeDivide(totals.twoMade, totals.twoAtt),
							threePA: safeDivide(totals.threeAtt, gamesPlayed),
							threePM: safeDivide(totals.threeMade, gamesPlayed),
							threePct: safeDivide(totals.threeMade, totals.threeAtt),
							ftAtt: safeDivide(totals.ftAtt, gamesPlayed),
							ftMade: safeDivide(totals.ftMade, gamesPlayed),
							ftPct: safeDivide(totals.ftMade, totals.ftAtt),
							totalFGA: safeDivide(totalFGA, gamesPlayed),
							threeShare: safeDivide(totals.threeAtt, totalFGA),
							effectiveFg: safeDivide(totals.twoMade + 1.5 * totals.threeMade, totalFGA),
						};

						const lastFiveGames = gameRows.slice(-5);
						const lastFive = {
							games: lastFiveGames,
							avgPoints: safeDivide(
								lastFiveGames.reduce((acc, game) => acc + game.our_score, 0),
								lastFiveGames.length || 1,
							),
							avgOppPoints: safeDivide(
								lastFiveGames.reduce((acc, game) => acc + game.opp_score, 0),
								lastFiveGames.length || 1,
							),
							pointDiff: safeDivide(
								lastFiveGames.reduce((acc, game) => acc + (game.our_score - game.opp_score), 0),
								lastFiveGames.length || 1,
							),
						};

						const base = {
							avgPoints: safeDivide(
								gameRows.reduce((acc, game) => acc + game.our_score, 0),
								gamesPlayed,
							),
							avgOppPoints: safeDivide(
								gameRows.reduce((acc, game) => acc + game.opp_score, 0),
								gamesPlayed,
							),
							pointDiff: safeDivide(
								gameRows.reduce((acc, game) => acc + (game.our_score - game.opp_score), 0),
								gamesPlayed,
							),
						};

						const trendDelta = lastFive.pointDiff - base.pointDiff;
						const trend: 'positive' | 'neutral' | 'negative' = trendDelta > 1 ? 'positive' : trendDelta < -1 ? 'negative' : 'neutral';

						const profile: TeamProfile = {
							key: summary.key,
							teamId: summary.teamId,
							teamName: summary.teamName,
							seasonId: summary.seasonId,
							seasonName: summary.seasonName,
							games: gameRows,
							base,
							shooting,
							rebounds: {
								offensive: safeDivide(totals.offReb, gamesPlayed),
								defensive: safeDivide(totals.defReb, gamesPlayed),
								total: safeDivide(totals.totReb, gamesPlayed),
							},
							playmaking: {
								assists: safeDivide(totals.assists, gamesPlayed),
								turnovers: safeDivide(totals.turnovers, gamesPlayed),
								astTo: safeDivide(totals.assists, totals.turnovers),
								steals: safeDivide(totals.steals, gamesPlayed),
								blocks: safeDivide(totals.blocks, gamesPlayed),
							},
							fouls: {
								committed: safeDivide(totals.fouls, gamesPlayed),
							},
							form: {
								lastFive,
								trend,
							},
						};

						return profile;
					}),
				);

				setTeamProfiles((prev) => {
					const next = { ...prev };
					loadedProfiles.forEach((profile) => {
						if (profile) next[profile.key] = profile;
					});
					return next;
				});
			} catch (profileError) {
				console.error('TeamComparison: profile load failed', profileError);
				setError('Nem sikerült betölteni az összehasonlítást.');
			} finally {
				setProfilesLoading(false);
			}
		};

		loadProfiles();
	}, [selectedKeys, teamProfiles, teamSummaries]);

	const selectedProfiles = selectedKeys.map((key) => teamProfiles[key]).filter(Boolean) as TeamProfile[];
	const [teamA, teamB] = selectedProfiles;

	const headToHead = useMemo(() => {
		if (teamA && teamB) return calculateHeadToHead(teamA, teamB);
		return null;
	}, [teamA, teamB]);

	const trendDataset = useMemo(() => buildTrendDataset(teamA, teamB), [teamA, teamB]);
	const radarDataset = useMemo(() => buildRadarDataset(selectedProfiles), [selectedProfiles]);

	const handleSelectTeam = (summary: TeamSeasonSummary) => {
		setSelectedKeys((prev) => {
			if (prev.includes(summary.key)) {
				return prev.filter((key) => key !== summary.key);
			}
			if (prev.length >= 2) {
				return [prev[1], summary.key];
			}
			return [...prev, summary.key];
		});
	};

	const renderMetricRow = (label: string, fn: (team: TeamProfile) => string) => (
		<tr key={label} className="border-b border-border-subtle">
			<td className="py-2 text-sm text-secondary">{label}</td>
			{selectedProfiles.map((team) => (
				<td key={`${team.key}-${label}`} className="py-2 text-right text-sm font-mono tabular-nums text-primary">
					{fn(team)}
				</td>
			))}
		</tr>
	);

	const strengthReports = useMemo(() => {
		if (teamA && teamB) {
			return {
				[teamA.key]: buildStrengthReport(teamA, teamB),
				[teamB.key]: buildStrengthReport(teamB, teamA),
			};
		}
		if (teamA) {
			return { [teamA.key]: buildStrengthReport(teamA) };
		}
		if (teamB) {
			return { [teamB.key]: buildStrengthReport(teamB) };
		}
		return {};
	}, [teamA, teamB]);

	const resetSelection = () => {
		setSelectedKeys([]);
		setTeamProfiles({});
	};

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
				<div>
					<p className="text-sm text-positive uppercase tracking-wide">Hunbasket hivatalos statisztikák</p>
					<h2 className="text-2xl font-display uppercase tracking-wide text-primary">Csapatok összehasonlítása</h2>
					<p className="text-sm text-secondary">Válassz ki két csapatot és vizsgáld meg a formát, fejlett mutatókat és egymás elleni teljesítményt.</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button variant="ghost" className="gap-2 text-secondary hover:bg-surface-2" onClick={onBack}>
						<ArrowLeft className="h-4 w-4" />
						Vissza
					</Button>
					<Button
						variant="outline"
						className="gap-2 border-border-subtle text-secondary hover:bg-surface-2"
						onClick={resetSelection}
						disabled={!selectedKeys.length}
					>
						<RefreshCw className="h-4 w-4" />
						Kijelölések törlése
					</Button>
				</div>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="text-lg">Szűrők</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
					<div className="flex flex-col gap-2 text-sm text-secondary">
						<span>Válaszd ki a szezont, amelyből a Hunbasket adatokat használjuk.</span>
						<span className="text-xs text-muted">Minden mutató hivatalos jegyzőkönyvből készül.</span>
					</div>
					<Select value={filterSeasonId} onValueChange={(value) => setFilterSeasonId(value)}>
						<SelectTrigger className="w-full lg:w-64">
							<SelectValue placeholder="Szezon kiválasztása" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">Mindegyik szezon</SelectItem>
							{allSeasons.map((season) => (
								<SelectItem key={season.id} value={season.id}>
									{season.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</CardContent>
			</Card>

			{error && (
				<div className="rounded border border-negative/40 bg-negative/10 px-4 py-3 text-sm text-negative">
					{error}
				</div>
			)}

			<Card>
				<CardHeader>
					<CardTitle className="text-lg">Csapat szezonszintű listája</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex items-center justify-between text-sm text-secondary">
						<span>Válassz ki maximum két csapatot az összehasonlításhoz.</span>
						{listLoading && <span className="text-positive">Betöltés...</span>}
					</div>
					<div className="overflow-auto rounded-lg border border-border-subtle">
						<table className="min-w-full text-sm">
							<thead className="bg-surface-2 text-secondary">
								<tr>
									<th className="px-4 py-2 text-left font-medium">Csapat</th>
									<th className="px-4 py-2 text-left font-medium">Szezon</th>
									<th className="px-4 py-2 text-center font-medium">Mérleg</th>
									<th className="px-4 py-2 text-center font-medium">Átlag pont</th>
									<th className="px-4 py-2 text-center font-medium">Pont diff.</th>
									<th className="px-4 py-2 text-right font-medium">Művelet</th>
								</tr>
							</thead>
							<tbody>
								{teamSummaries.map((summary) => {
									const selected = selectedKeys.includes(summary.key);
									return (
										<tr key={summary.key} className="border-b border-border-subtle/60">
											<td className="px-4 py-3 text-primary">{summary.teamName}</td>
											<td className="px-4 py-3 text-secondary">{summary.seasonName}</td>
											<td className="px-4 py-3 text-center font-mono tabular-nums text-primary">
												{summary.wins}-{summary.losses}
											</td>
											<td className="px-4 py-3 text-center font-mono tabular-nums text-primary">{formatNumber(summary.avgPoints)}</td>
											<td className="px-4 py-3 text-center font-mono tabular-nums">
												<span className={summary.pointDiff >= 0 ? 'text-positive' : 'text-negative'}>
													{formatNumber(summary.pointDiff)}
												</span>
											</td>
											<td className="px-4 py-3">
												<Button
													size="sm"
													variant={selected ? 'default' : 'outline'}
													className={selected ? '' : 'border-border-subtle text-secondary hover:bg-surface-2'}
													onClick={() => handleSelectTeam(summary)}
													disabled={selectedKeys.length >= 2 && !selected}
												>
													{selected ? 'Kijelölve' : 'Hozzáadás'}
												</Button>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
					{!teamSummaries.length && !listLoading && (
						<p className="text-center text-sm text-muted">Nincs Hunbasket adat a választott szezonból.</p>
					)}
				</CardContent>
			</Card>

			{!selectedProfiles.length && (
				<div className="rounded border border-dashed border-border-subtle bg-surface-1/40 px-6 py-8 text-center text-secondary">
					Válassz ki legalább egy csapatot a részletes összehasonlításhoz.
				</div>
			)}

			{selectedProfiles.length > 0 && (
				<div className="grid gap-4 lg:grid-cols-2">
					{selectedProfiles.map((team, index) => (
						<Card key={team.key}>
							<CardHeader className="flex flex-row items-center justify-between">
								<div>
									<CardTitle className="text-lg">{team.teamName}</CardTitle>
									<p className="text-sm text-secondary">{team.seasonName}</p>
								</div>
								<Badge className={team.form.trend === 'positive' ? 'badge-positive' : team.form.trend === 'negative' ? 'badge-negative' : 'badge-neutral'}>
									{team.form.trend === 'positive' && 'Formában'}
									{team.form.trend === 'neutral' && 'Stabil forma'}
									{team.form.trend === 'negative' && 'Hullámzó forma'}
								</Badge>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid grid-cols-3 gap-3 text-center text-sm">
									<div className="rounded-lg border border-border-subtle bg-surface-2/40 p-3">
										<p className="text-xs uppercase text-secondary">Pontok</p>
										<p className="text-lg font-mono tabular-nums text-primary">{formatNumber(team.base.avgPoints)}</p>
									</div>
									<div className="rounded-lg border border-border-subtle bg-surface-2/40 p-3">
										<p className="text-xs uppercase text-secondary">Kapott</p>
										<p className="text-lg font-mono tabular-nums text-primary">{formatNumber(team.base.avgOppPoints)}</p>
									</div>
									<div className="rounded-lg border border-border-subtle bg-surface-2/40 p-3">
										<p className="text-xs uppercase text-secondary">Pont diff.</p>
										<p className={`text-lg font-mono tabular-nums ${team.base.pointDiff >= 0 ? 'text-positive' : 'text-negative'}`}>
											{formatNumber(team.base.pointDiff)}
										</p>
									</div>
								</div>
								<div className="rounded-lg border border-border-subtle bg-surface-2/40 p-4 text-sm text-primary">
									<p className="text-xs text-secondary">Utolsó 5 meccs</p>
									<div className="mt-2 flex flex-wrap gap-2">
										{team.form.lastFive.games.map((game) => (
											<span key={game.id} className={`rounded-full px-3 py-1 text-xs font-mono tabular-nums ${game.result === 'win' ? 'bg-positive/15 text-positive' : 'bg-negative/15 text-negative'}`}>
												{game.result === 'win' ? 'W' : 'L'} {game.our_score}-{game.opp_score}
											</span>
										))}
										{!team.form.lastFive.games.length && <span className="text-muted">Nincs adat</span>}
									</div>
								</div>
								{strengthReports[team.key] && (
									<div className="grid gap-2">
										{strengthReports[team.key].map((item) => (
											<div key={`${team.key}-${item.label}`} className="rounded-lg border border-border-subtle bg-surface-2/30 p-3 text-sm">
												<div className="flex items-center justify-between text-primary">
													<span>{item.label}</span>
													<strong className="font-mono tabular-nums">{item.value}</strong>
												</div>
												<p className="text-xs text-secondary">{item.detail}</p>
											</div>
										))}
									</div>
								)}
								{index === 0 && profilesLoading && (
									<p className="text-xs text-muted">Statisztikák betöltése...</p>
								)}
							</CardContent>
						</Card>
					))}
				</div>
			)}

			{selectedProfiles.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<BarChart2 className="h-4 w-4 text-positive" /> Fejlett mutatók
						</CardTitle>
					</CardHeader>
					<CardContent className="overflow-x-auto">
						<table className="min-w-full text-sm">
							<tbody>
								{renderMetricRow('Átlag pont', (team) => `${formatNumber(team.base.avgPoints)} PPG`)}
								{renderMetricRow('Kapott pont', (team) => `${formatNumber(team.base.avgOppPoints)} PPG`)}
								{renderMetricRow('Pont különbség', (team) => `${formatNumber(team.base.pointDiff)} PPG`)}
								{renderMetricRow('2P%', (team) => formatPercent(team.shooting.twoPct))}
								{renderMetricRow('3P%', (team) => formatPercent(team.shooting.threePct))}
								{renderMetricRow('eFG%', (team) => formatPercent(team.shooting.effectiveFg))}
								{renderMetricRow('3 pontos arány', (team) => formatPercent(team.shooting.threeShare))}
								{renderMetricRow('Gólpassz', (team) => formatNumber(team.playmaking.assists))}
								{renderMetricRow('Eladott labda', (team) => formatNumber(team.playmaking.turnovers))}
								{renderMetricRow('AST/TO', (team) => formatNumber(team.playmaking.astTo))}
								{renderMetricRow('Összes lepattanó', (team) => formatNumber(team.rebounds.total))}
								{renderMetricRow('Szerzett labda', (team) => formatNumber(team.playmaking.steals))}
								{renderMetricRow('Fault', (team) => formatNumber(team.fouls.committed))}
							</tbody>
						</table>
					</CardContent>
				</Card>
			)}

			{radarDataset.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Target className="h-4 w-4 text-cyan" /> Profil erősségek
						</CardTitle>
					</CardHeader>
					<CardContent className="h-80">
						<ResponsiveContainer>
							<RadarChart data={radarDataset} outerRadius={120}>
								<PolarGrid stroke="var(--border-subtle)" />
								<PolarAngleAxis dataKey="metric" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
								<PolarRadiusAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
								{selectedProfiles.map((team, index) => (
									<Radar
										key={team.key}
										name={`${team.teamName} ${team.seasonName}`}
										dataKey={team.key}
										stroke={TEAM_COLORS[index] || 'var(--accent-cyan)'}
										fill={TEAM_COLORS[index] || 'var(--accent-cyan)'}
										fillOpacity={0.3}
									/>
								))}
								<Legend wrapperStyle={{ color: 'var(--text-secondary)' }} />
							</RadarChart>
						</ResponsiveContainer>
					</CardContent>
				</Card>
			)}

			{trendDataset.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<TrendingUp className="h-4 w-4 text-positive" /> Forma trend (pontkülönbség)
						</CardTitle>
					</CardHeader>
					<CardContent className="h-80">
						<ResponsiveContainer>
							<LineChart data={trendDataset} margin={{ left: 12, right: 12 }}>
								<CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
								<XAxis dataKey="label" stroke="var(--text-secondary)" fontSize={12} />
								<YAxis stroke="var(--text-secondary)" fontSize={12} />
								<Tooltip
									contentStyle={{ backgroundColor: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}
									labelStyle={{ color: 'var(--text-primary)' }}
								/>
								<Legend wrapperStyle={{ color: 'var(--text-secondary)' }} />
								{selectedProfiles.map((team, index) => (
									<Line
										key={team.key}
										type="monotone"
										dataKey={team.key}
										name={`${team.teamName} ${team.seasonName}`}
										stroke={TEAM_COLORS[index] || 'var(--accent-cyan)'}
										strokeWidth={2}
										dot={false}
									/>
								))}
							</LineChart>
						</ResponsiveContainer>
					</CardContent>
				</Card>
			)}

			{teamA && teamB && headToHead && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Shield className="h-4 w-4 text-warning" /> Egymás elleni mérleg
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="flex flex-wrap gap-6 text-sm text-primary">
							<div>
								<p className="text-xs uppercase text-muted">Győzelem / Vereség</p>
								<p className="text-lg font-mono tabular-nums text-primary">
									{headToHead.wins}-{headToHead.losses}
								</p>
							</div>
							<div>
								<p className="text-xs uppercase text-muted">Átlag pont</p>
								<p className="text-lg font-mono tabular-nums text-primary">{formatNumber(headToHead.avgPoints)}</p>
							</div>
							<div>
								<p className="text-xs uppercase text-muted">Kapott pont</p>
								<p className="text-lg font-mono tabular-nums text-primary">{formatNumber(headToHead.avgOppPoints)}</p>
							</div>
							<div>
								<p className="text-xs uppercase text-muted">Pont diff.</p>
								<p className={`text-lg font-mono tabular-nums ${headToHead.pointDiff >= 0 ? 'text-positive' : 'text-negative'}`}>
									{formatNumber(headToHead.pointDiff)}
								</p>
							</div>
						</div>
						<div className="space-y-2">
							{headToHead.games.map((game) => (
								<div
									key={game.id}
									className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-surface-2/30 p-3 text-sm text-primary md:flex-row md:items-center md:justify-between"
								>
									<div>
										<p className="text-primary">{teamA.teamName} vs {game.opponent}</p>
										<p className="text-xs text-muted">
											{game.round ? `${game.round} • ` : ''}
											{new Date(game.date).toLocaleDateString('hu-HU')}
										</p>
									</div>
									<div className="flex items-center gap-3">
										<span className="text-lg font-semibold font-mono tabular-nums text-primary">
											{game.our_score} - {game.opp_score}
										</span>
										<Badge className={game.result === 'win' ? 'badge-positive' : 'badge-negative'}>
											{game.result === 'win' ? 'Győzelem' : 'Vereség'}
										</Badge>
									</div>
								</div>
							))}
							{!headToHead.games.length && (
								<p className="text-sm text-muted">Nincs egymás elleni hivatalos mérkőzés.</p>
							)}
						</div>
					</CardContent>
				</Card>
			)}

			{selectedProfiles.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Activity className="h-4 w-4 text-orange" /> Kontextus & megjegyzések
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-2 text-sm text-secondary">
						<p>Minden szám hivatalos hunbasket.hu jegyzőkönyvből érkezik, így kizárólag validált meccsekre támaszkodunk.</p>
						<p>Az AST/TO, eFG% és rebound mutatók segítenek megérteni a játék stílusát. Használd a radar- és trendgrafikonokat a taktikai felkészüléshez.</p>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
