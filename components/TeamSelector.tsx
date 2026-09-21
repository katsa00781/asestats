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
  onTeamChange: (teamId: string | null) => void;
  allowAll?: boolean;
};

const shouldSkipTeam = (name?: string | null) => {
  if (!name) return false;
  return name.trim().toLowerCase() === 'ase';
};

export function TeamSelector({ selectedTeamId, onTeamChange, allowAll = false }: TeamSelectorProps) {
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

    } catch (error) {
      console.error('Csapatok betöltési hiba:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeams();
  }, []);

  useEffect(() => {
    // Az Igazolások liga-nézete engedi az üres csapatszűrőt. Más tabra
    // visszalépve a megszokott alapcsapatot választjuk ki.
    if (!allowAll && !selectedTeamId && teams.length > 0) {
      onTeamChange((teams.find(team => team.is_primary) || teams[0]).id);
    }
  }, [allowAll, selectedTeamId, teams, onTeamChange]);

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
      <Select value={selectedTeamId || (allowAll ? 'all' : undefined)} onValueChange={value => onTeamChange(value === 'all' ? null : value)}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Válassz csapatot" />
        </SelectTrigger>
        <SelectContent>
          {allowAll && <SelectItem value="all">Összes követett csapat</SelectItem>}
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
