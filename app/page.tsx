'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { AppSidebar } from '@/components/AppSidebar';
import { AppTopbar } from '@/components/AppTopbar';
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

export default function Home() {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [showTeamComparison, setShowTeamComparison] = useState(false);
  const [standingsRefresh, setStandingsRefresh] = useState(0);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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

  useEffect(() => {
    if (filterError) toast.error(filterError);
  }, [filterError]);

  useEffect(() => {
    if (dataError) toast.error(dataError);
  }, [dataError]);

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
    <div className={cn('app-shell dark bg-base', sidebarCollapsed && 'is-collapsed')}>
      <AppSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isAdmin={isAdmin}
        userEmail={user.email ?? ''}
        onCollapsedChange={setSidebarCollapsed}
        navMeta={{ players: playersBySeason.length, games: games.length }}
      />
      <main className="px-4 sm:px-8 lg:px-9 py-6 sm:py-7 pb-24 md:pb-7">
        <AppTopbar
          activeTab={activeTab}
          userEmail={user.email ?? ''}
          isAdmin={isAdmin}
          onSignOut={() => signOut()}
        />

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
          players.length === 0 ? (
            <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3 stagger">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton-shimmer h-20 rounded-lg" style={{ ['--i' as unknown as string]: i }} />
              ))}
            </div>
          ) : (
            <div className="mb-4 flex items-center gap-2 text-sm text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" />
              Adatok frissítése...
            </div>
          )
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
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
              {isAdmin && (
                <StandingsImport
                  onImportComplete={() => setStandingsRefresh(prev => prev + 1)}
                  selectedSeasonId={selectedSeasonId}
                  selectedSeasonName={allSeasons.find(s => s.id === selectedSeasonId)?.name}
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="games">
            <GamesList
              games={games}
              upcomingFixtures={upcomingFixtures}
              onGameDeleted={loadData}
              isAdmin={isAdmin}
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
