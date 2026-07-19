'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Team = {
  id: string;
  name: string;
  short_name: string;
  is_primary: boolean;
};

type TeamSelectorProps = {
  selectedTeamId: string | null;
  onTeamChange: (teamId: string) => void;
};

const shouldSkipTeam = (name?: string | null) => {
  if (!name) return false;
  return name.trim().toLowerCase() === 'ase';
};

export function TeamSelector({ selectedTeamId, onTeamChange }: TeamSelectorProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTeams = async () => {
    try {
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('id, name, short_name, is_primary')
        .order('is_primary', { ascending: false })
        .order('name');

      if (teamsError) throw teamsError;

      const filteredTeams = (teamsData ?? []).filter(team => !shouldSkipTeam(team.name));
      setTeams(filteredTeams);

      if (!selectedTeamId && filteredTeams.length > 0) {
        const primary = filteredTeams.find((t: Team) => t.is_primary) || filteredTeams[0];
        onTeamChange(primary.id);
      }
    } catch (error) {
      console.error('Csapatok betöltési hiba:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeams();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <div className="w-full md:w-64 h-10 bg-surface-2 animate-pulse rounded-md" />;
  }

  if (teams.length === 0) {
    return (
      <div className="w-full md:w-64 rounded-md border border-dashed border-border-subtle px-3 py-2 text-xs text-secondary">
        Nincs elérhető csapat.
      </div>
    );
  }

  return (
    <div className="w-full md:w-64">
      <Select value={selectedTeamId || undefined} onValueChange={onTeamChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Válassz csapatot" />
        </SelectTrigger>
        <SelectContent>
          {teams.map(team => (
            <SelectItem key={team.id} value={team.id}>
              {team.name}
              {team.is_primary && ' ⭐'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
