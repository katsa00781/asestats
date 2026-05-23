'use client';
import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, LogOut, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { PlayerDetails } from '@/components/PlayerDetails';
import { PlayersList } from '@/components/PlayersList';
import { TeamStatistics } from '@/components/TeamStatistics';
import { JsonImport } from '@/components/JsonImport';
import { GamesList } from '@/components/GamesList';
import { PlayersManagement } from '@/components/PlayersManagement';
import { StandingsImport } from '@/components/StandingsImport';
import { StandingsView } from '@/components/StandingsView';
import { PlayerComparison } from '@/components/PlayerComparison';
import { TeamComparison } from '@/components/TeamComparison';
import { GameLog } from '@/components/GameLog';
import { GameManagement } from '@/components/GameManagement';
import { LoginForm } from '@/components/LoginForm';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { SeasonSelector } from '@/components/SeasonSelector';
import { SeasonComparison } from '@/components/SeasonComparison';
import { TeamSelector } from '@/components/TeamSelector';
import { Updates } from '@/components/Updates';
import { GameQuickImport } from '@/components/GameQuickImport';
import { PlayersImport } from '@/components/PlayersImport';
import { RoundImport } from '@/components/RoundImport';
import { RosterImport } from '@/components/RosterImport';
import { FixturesImport } from '@/components/FixturesImport';
import { KosarstatPbpImport } from '@/components/KosarstatPbpImport';
import { SituationalAnalysis } from '@/components/SituationalAnalysis';
import { useFilterData } from '@/hooks/useFilterData';
import { useGameData } from '@/hooks/useGameData';
export type { ShootingStats, PlayerStats, GamePerformance, GamePlayer, TeamGame, GameAggregate, UpcomingFixture } from '@/lib/dashboard-types';

const TAB_TRIGGER_CLASS = 'flex-shrink-0 md:flex-1 min-w-[7rem] whitespace-nowrap';

type MobileGroup = 'stats' | 'games' | 'admin';

const MOBILE_GROUPS: { key: MobileGroup; label: string; tabs: string[]; adminOnly?: boolean }[] = [
  { key: 'stats', label: 'Statisztikák', tabs: ['overview', 'players', 'comparison', 'situational'] },
  { key: 'games', label: 'Meccsek', tabs: ['games', 'gamelog', 'standings', 'updates'] },
  { key: 'admin', label: 'Admin', tabs: ['manage', 'playersimport', 'delete', 'import'], adminOnly: true },
];

export default function Home() {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [showTeamComparison, setShowTeamComparison] = useState(false);
  const [standingsRefresh, setStandingsRefresh] = useState(0);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [mobileGroup, setMobileGroup] = useState<MobileGroup>('stats');

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const group = MOBILE_GROUPS.find(g => g.tabs.includes(tab));
    if (group) setMobileGroup(group.key);
  };

  const isMobileVisible = (tabValue: string) =>
    MOBILE_GROUPS.find(g => g.key === mobileGroup)?.tabs.includes(tabValue) ?? false;
  const [lastImportedGame, setLastImportedGame] = useState<{
    date: string;
    homeTeamName: string;
    awayTeamName: string;
    homeScore: number;
    awayScore: number;
    round: number | null;
  } | null>(null);

  const { allSeasons, allTeams, allPlayersForComparison, filterLoading, filterError } = useFilterData();
  const { players, games, gameStats, playerGameStats, upcomingFixtures, loadData, loading: dataLoading, error: dataError } = useGameData(
    selectedSeasonId,
    selectedTeamId,
    allTeams,
    allSeasons,
  );

  const playersBySeason = useMemo(() => {
    if (!selectedSeasonId) return players;
    return players.filter(player =>
      String(player.seasonId ?? '') === String(selectedSeasonId) &&
      (!selectedTeamId || String(player.teamId ?? '') === String(selectedTeamId))
    );
  }, [players, selectedSeasonId, selectedTeamId]);

  const selectedPlayer = selectedPlayerId
    ? playersBySeason.find(player => player.id === selectedPlayerId) || null
    : null;

  const handleGameImport = (gameData?: {
    date: string;
    homeTeamName: string;
    awayTeamName: string;
    homeScore: number;
    awayScore: number;
    round: number | null;
  }) => {
    if (gameData) {
      setLastImportedGame(gameData);
    }
    loadData();
  };

  const { user, loading, isAdmin, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-base dark flex items-center justify-center">
        <div className="text-primary text-xl font-display tracking-wider uppercase">Betöltés...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  return (
    <div className="min-h-screen bg-base dark">
      <header className="bg-surface-1 border-b border-border-subtle py-4 sm:py-6 shadow-panel">
        <div className="container mx-auto px-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h1 className="text-center md:text-left text-2xl sm:text-3xl md:text-4xl font-display font-semibold tracking-tight flex items-center gap-2 sm:gap-3">
              <Trophy className="h-6 w-6 sm:h-8 sm:w-8 md:h-10 md:w-10 text-cyan" strokeWidth={1.5} />
              ASE Statisztika Kezelő
            </h1>
            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut()}
              className="flex items-center justify-center gap-2 w-full md:w-auto"
            >
              <LogOut className="h-4 w-4" />
              Kijelentkezés
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
        <div className="mb-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="w-full">
              <label className="uppercase-label mb-2 block">Szezon</label>
              <SeasonSelector
                selectedSeasonId={selectedSeasonId}
                onSeasonChange={setSelectedSeasonId}
              />
            </div>
            <div className="w-full">
              <label className="uppercase-label mb-2 block">Csapat</label>
              <TeamSelector
                selectedTeamId={selectedTeamId}
                onTeamChange={setSelectedTeamId}
              />
            </div>
          </div>
        </div>

        {filterError && (
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-border-subtle bg-surface-1 px-4 py-3 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0 text-negative" />
            <span className="text-negative">{filterError}</span>
            <button onClick={() => window.location.reload()} className="ml-auto flex items-center gap-1 text-xs text-secondary hover:text-primary">
              <RefreshCw className="h-3 w-3" />
              Újratöltés
            </button>
          </div>
        )}
        {dataError && (
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-border-subtle bg-surface-1 px-4 py-3 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0 text-negative" />
            <span className="text-negative">{dataError}</span>
            <button onClick={loadData} className="ml-auto flex items-center gap-1 text-xs text-secondary hover:text-primary">
              <RefreshCw className="h-3 w-3" />
              Újrapróbálás
            </button>
          </div>
        )}
        {(filterLoading || dataLoading) && (
          <div className="mb-4 flex items-center gap-2 text-sm text-secondary">
            <Loader2 className="h-4 w-4 animate-spin" />
            Adatok betöltése...
          </div>
        )}

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4 sm:space-y-6">
          <div className="-mx-2 sm:mx-0">
            {/* Mobil csoportválasztó */}
            <div className="md:hidden flex gap-2 mb-2 px-1">
              {MOBILE_GROUPS.filter(g => !g.adminOnly || isAdmin).map(group => (
                <button
                  key={group.key}
                  onClick={() => setMobileGroup(group.key)}
                  className={cn(
                    'flex-1 px-3 py-1.5 rounded-sm font-display font-semibold text-[0.7rem] uppercase tracking-widest transition-all border',
                    mobileGroup === group.key
                      ? 'bg-surface-3 border-border-active text-cyan shadow-glow-cyan'
                      : 'bg-transparent border-border-subtle text-secondary hover:text-primary hover:border-border-active'
                  )}
                >
                  {group.label}
                </button>
              ))}
            </div>
            <div className="overflow-x-auto pb-2">
              <TabsList className="min-w-max md:min-w-0 md:w-full flex-nowrap md:flex-wrap h-auto gap-2 p-1 justify-start">
                <TabsTrigger value="overview" className={cn(TAB_TRIGGER_CLASS, !isMobileVisible('overview') && 'hidden md:flex')}>Áttekintés</TabsTrigger>
                <TabsTrigger value="players" className={cn(TAB_TRIGGER_CLASS, !isMobileVisible('players') && 'hidden md:flex')}>Játékosok</TabsTrigger>
                <TabsTrigger value="comparison" className={cn(TAB_TRIGGER_CLASS, !isMobileVisible('comparison') && 'hidden md:flex')}>Elemzések</TabsTrigger>
                <TabsTrigger value="standings" className={cn(TAB_TRIGGER_CLASS, !isMobileVisible('standings') && 'hidden md:flex')}>Tabella</TabsTrigger>
                <TabsTrigger value="games" className={cn(TAB_TRIGGER_CLASS, !isMobileVisible('games') && 'hidden md:flex')}>Meccsek</TabsTrigger>
                <TabsTrigger value="gamelog" className={cn(TAB_TRIGGER_CLASS, !isMobileVisible('gamelog') && 'hidden md:flex')}>Meccs Log</TabsTrigger>
                <TabsTrigger value="situational" className={cn(TAB_TRIGGER_CLASS, !isMobileVisible('situational') && 'hidden md:flex')}>Szituációk</TabsTrigger>
                <TabsTrigger value="updates" className={cn(TAB_TRIGGER_CLASS, !isMobileVisible('updates') && 'hidden md:flex')}>Frissítések</TabsTrigger>
                {isAdmin && <TabsTrigger value="manage" className={cn(TAB_TRIGGER_CLASS, !isMobileVisible('manage') && 'hidden md:flex')}>Kezelés</TabsTrigger>}
                {isAdmin && <TabsTrigger value="playersimport" className={cn(TAB_TRIGGER_CLASS, !isMobileVisible('playersimport') && 'hidden md:flex')}>Játékos Import</TabsTrigger>}
                {isAdmin && <TabsTrigger value="delete" className={cn(TAB_TRIGGER_CLASS, 'text-negative', !isMobileVisible('delete') && 'hidden md:flex')}>Törlés</TabsTrigger>}
                {isAdmin && <TabsTrigger value="import" className={cn(TAB_TRIGGER_CLASS, !isMobileVisible('import') && 'hidden md:flex')}>Import</TabsTrigger>}
              </TabsList>
            </div>
          </div>

          <TabsContent value="overview">
            {showTeamComparison ? (
              <TeamComparison
                allSeasons={allSeasons}
                allTeams={allTeams}
                currentSeasonId={selectedSeasonId}
                currentTeamId={selectedTeamId}
                onBack={() => setShowTeamComparison(false)}
              />
            ) : (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button
                    onClick={() => setShowTeamComparison(true)}
                    variant="secondary"
                    size="sm"
                    className="gap-2"
                  >
                    Csapatok összehasonlítása
                  </Button>
                </div>
                <TeamStatistics
                  players={playersBySeason}
                  games={games}
                  gameStats={gameStats}
                  teamName={allTeams.find(t => t.id === selectedTeamId)?.name}
                  seasonId={selectedSeasonId ?? undefined}
                  teamId={selectedTeamId ?? undefined}
                  seasonName={allSeasons.find(s => s.id === selectedSeasonId)?.name}
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="players">
            {showComparison ? (
              <PlayerComparison
                allPlayers={allPlayersForComparison}
                allSeasons={allSeasons}
                allTeams={allTeams}
                currentSeasonId={selectedSeasonId}
                currentTeamId={selectedTeamId}
                onBack={() => setShowComparison(false)}
              />
            ) : selectedPlayer ? (
              <PlayerDetails
                player={selectedPlayer}
                onBack={() => setSelectedPlayerId(null)}
              />
            ) : (
              <PlayersList
                players={playersBySeason}
                onSelectPlayer={setSelectedPlayerId}
                onCompare={() => setShowComparison(true)}
              />
            )}
          </TabsContent>

          <TabsContent value="comparison">
            <SeasonComparison
              allPlayers={allPlayersForComparison}
              allSeasons={allSeasons}
              allTeams={allTeams}
              currentSeasonId={selectedSeasonId}
              currentTeamId={selectedTeamId}
              games={games}
              playerGameStats={playerGameStats}
            />
          </TabsContent>

          <TabsContent value="standings">
            <div className="space-y-6">
              <StandingsView
                onRefresh={standingsRefresh}
                selectedSeasonId={selectedSeasonId}
                selectedSeasonName={allSeasons.find(s => s.id === selectedSeasonId)?.name}
              />
              <StandingsImport
                onImportComplete={() => setStandingsRefresh(prev => prev + 1)}
                selectedSeasonId={selectedSeasonId}
                selectedSeasonName={allSeasons.find(s => s.id === selectedSeasonId)?.name}
              />
            </div>
          </TabsContent>

          <TabsContent value="games">
            <GamesList
              games={games}
              upcomingFixtures={upcomingFixtures}
              onGameDeleted={loadData}
            />
          </TabsContent>

          <TabsContent value="gamelog">
            <GameLog players={playersBySeason} />
          </TabsContent>

          <TabsContent value="updates">
            <Updates />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="manage">
              <PlayersManagement onPlayersChanged={loadData} />
            </TabsContent>
          )}

          <TabsContent value="situational">
            {selectedTeamId && selectedSeasonId && (
              <SituationalAnalysis
                selectedTeamId={selectedTeamId}
                selectedSeasonId={selectedSeasonId}
                teamName={allTeams.find(t => t.id === selectedTeamId)?.name}
              />
            )}
          </TabsContent>

          {isAdmin && (
            <TabsContent value="playersimport">
              <PlayersImport
                onImportComplete={loadData}
                selectedSeasonId={selectedSeasonId}
                selectedTeamId={selectedTeamId}
                selectedSeasonName={allSeasons.find(s => s.id === selectedSeasonId)?.name}
                selectedTeamName={allTeams.find(t => t.id === selectedTeamId)?.name}
                allSeasons={allSeasons}
                allTeams={allTeams}
              />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="delete">
              <GameManagement onDeleteComplete={loadData} />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="import">
              <div className="space-y-6">
                <KosarstatPbpImport
                  onImportComplete={loadData}
                  selectedSeasonId={selectedSeasonId}
                  selectedSeasonName={allSeasons.find(s => s.id === selectedSeasonId)?.name}
                />
                <FixturesImport
                  onImportComplete={loadData}
                  selectedSeasonId={selectedSeasonId}
                  selectedSeasonName={allSeasons.find(s => s.id === selectedSeasonId)?.name}
                />
                <RosterImport
                  onImportComplete={loadData}
                  selectedSeasonId={selectedSeasonId}
                  selectedSeasonName={allSeasons.find(s => s.id === selectedSeasonId)?.name}
                />
                <RoundImport
                  onImportComplete={loadData}
                  selectedSeasonId={selectedSeasonId}
                  selectedSeasonName={allSeasons.find(s => s.id === selectedSeasonId)?.name}
                />
                <GameQuickImport
                  onImportComplete={handleGameImport}
                  selectedSeasonId={selectedSeasonId}
                />
                <JsonImport
                  onImportComplete={loadData}
                  lastImportedGame={lastImportedGame}
                  selectedSeasonId={selectedSeasonId}
                />
              </div>
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}
