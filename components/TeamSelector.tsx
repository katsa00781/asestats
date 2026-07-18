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
      // Először próbáljuk a standings táblából betölteni
      console.log('TeamSelector: Csapatok betöltése indul...');
      const { data: standingsData, error: standingsError } = await supabase
        .from('standings')
        .select('team_name')
        .order('team_name');

      console.log('TeamSelector: Standings lekérdezés eredménye:', { standingsData, standingsError });

      let teamsToLoad: Team[] = [];

      // Ha van standings adat, akkor onnan töltjük be a csapatokat
      if (!standingsError && standingsData && standingsData.length > 0) {
        const uniqueTeams = Array.from(new Set(standingsData.map(s => s.team_name)));
        console.log('TeamSelector: Egyedi csapatok:', uniqueTeams);
        
        for (const teamName of uniqueTeams) {
          const { data: existingTeam, error: teamError } = await supabase
            .from('teams')
            .select('id, name, short_name, is_primary')
            .eq('name', teamName)
            .single();

          console.log(`TeamSelector: "${teamName}" ellenőrzés:`, { existingTeam, teamError });

          if (existingTeam) {
            teamsToLoad.push(existingTeam);
          } else {
            const { data: newTeam, error: insertError } = await supabase
              .from('teams')
              .insert({
                name: teamName,
                short_name: teamName.split(' ')[0],
                is_primary: false
              })
              .select('id, name, short_name, is_primary')
              .single();
            
            console.log(`TeamSelector: "${teamName}" létrehozva:`, { newTeam, insertError });
            if (newTeam) teamsToLoad.push(newTeam);
          }
        }
      } else {
        // Ha nincs standings adat, akkor közvetlenül a teams táblából töltjük be
        console.log('TeamSelector: Standings üres/hiba, teams táblából töltés...');
        const { data: teamsData, error: teamsError } = await supabase
          .from('teams')
          .select('id, name, short_name, is_primary')
          .order('is_primary', { ascending: false })
          .order('name');

        console.log('TeamSelector: Teams lekérdezés eredménye:', { teamsData, teamsError });
        if (teamsError) throw teamsError;
        
        if (teamsData) {
          teamsToLoad = teamsData;
        }
      }

      console.log('TeamSelector: Betöltött csapatok:', teamsToLoad);
      const filteredTeams = teamsToLoad.filter(team => !shouldSkipTeam(team.name));

      if (filteredTeams.length !== teamsToLoad.length) {
        console.log('TeamSelector: \"ASE\" név kihagyva (Az Atomerőmű SE duplikációja).');
      }

      setTeams(filteredTeams);

      if (!selectedTeamId && filteredTeams.length > 0) {
        const primary = filteredTeams.find((t: Team) => t.is_primary) || filteredTeams[0];
        console.log('TeamSelector: Alapértelmezett csapat beállítva:', primary);
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
