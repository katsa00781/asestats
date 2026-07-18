import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Season = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
};

type SeasonSelectorProps = {
  selectedSeasonId: string | null;
  onSeasonChange: (seasonId: string) => void;
};

export function SeasonSelector({ selectedSeasonId, onSeasonChange }: SeasonSelectorProps) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // Szezonok betöltése
  useEffect(() => {
    async function fetchSeasons() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('seasons')
          .select('*')
          .order('start_date', { ascending: false });

        if (error) {
          console.error('Error fetching seasons:', error);
          return;
        }

        if (data && data.length > 0) {
          setSeasons(data);
        }
      } catch (error) {
        console.error('Error fetching seasons:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchSeasons();
  }, []);

  // Automatikus kiválasztás, ha még nincs szezon kiválasztva
  useEffect(() => {
    if (!loading && seasons.length > 0 && !selectedSeasonId && !initialized) {
      const currentSeason = seasons.find(s => s.is_current);
      if (currentSeason) {
        onSeasonChange(currentSeason.id);
      } else {
        onSeasonChange(seasons[0].id);
      }
      setInitialized(true);
    }
  }, [loading, seasons, selectedSeasonId, initialized, onSeasonChange]);

  if (loading) {
    return (
      <div className="w-full md:w-64 h-10 bg-surface-2 animate-pulse rounded-md" />
    );
  }

  return (
    <div className="w-full md:w-64">
      <Select value={selectedSeasonId || undefined} onValueChange={onSeasonChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Válassz szezont..." />
        </SelectTrigger>
        <SelectContent>
          {seasons.map(season => (
            <SelectItem
              key={season.id}
              value={season.id}
            >
              {season.name} {season.is_current && '(Jelenlegi)'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
