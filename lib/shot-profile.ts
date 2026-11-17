// Dobástérkép-segédek: a Hunbasket dobás-esemény sor típusa, pontokká alakítás,
// zónánkénti dobásprofil (kísérlet / találat / %) és a lefedett meccsek száma.
// A SeasonComparison-ből kiszervezve (H34/F1d), viselkedésváltozás nélkül. Nem @core modul.
import { classifyShotZone } from '@/lib/postgame-report';
import { roundValue } from '@/lib/season-comparison-helpers';

export type ShotEventRow = {
  raw_game_id?: string | null;
  team_id?: string | null;
  player_id: string | null;
  x: number | null;
  y: number | null;
  is_successful: boolean | null;
  shot_side: 'home' | 'away' | null;
};

export type ShotZoneKey = 'rim' | 'paint' | 'mid' | 'corner3' | 'aboveBreak3';

export type ShotPoint = {
  playerId: string | null;
  x: number;
  y: number;
  isSuccessful: boolean;
  shotSide: 'home' | 'away';
};

export type ShotZoneStats = {
  attempts: number;
  made: number;
  pct: number;
};

export type ShotProfileSummary = {
  attempts: number;
  made: number;
  fgPct: number;
  zoneStats: Record<ShotZoneKey, ShotZoneStats>;
  /** Lefedett meccsek száma (különböző `raw_game_id`) – a pregame lefedettség-ellenőrzéshez. */
  games?: number;
};

export const toShotPoints = (rows: ShotEventRow[]): ShotPoint[] => {
  return rows
    .map(row => {
      if (!Number.isFinite(row.x) || !Number.isFinite(row.y)) return null;
      if (row.shot_side !== 'home' && row.shot_side !== 'away') return null;
      return {
        playerId: row.player_id,
        x: Number(row.x),
        y: Number(row.y),
        isSuccessful: Boolean(row.is_successful),
        shotSide: row.shot_side,
      };
    })
    .filter((item): item is ShotPoint => Boolean(item));
};

/**
 * A dobásprofil kiegészítése a lefedett meccsek számával (különböző
 * `raw_game_id`); a pregame lefedettség-ellenőrzés ebből veti össze a box
 * score meccsszámával. Ha a sorokban nincs `raw_game_id`, a profil változatlan.
 */
export const withShotGames = (summary: ShotProfileSummary, rows: ShotEventRow[]): ShotProfileSummary => {
  const gameIds = new Set(rows.map(row => row.raw_game_id).filter((id): id is string => Boolean(id)));
  return gameIds.size > 0 ? { ...summary, games: gameIds.size } : summary;
};

export const buildShotProfileSummary = (points: ShotPoint[]): ShotProfileSummary => {
  const zoneStats: Record<ShotZoneKey, ShotZoneStats> = {
    rim: { attempts: 0, made: 0, pct: 0 },
    paint: { attempts: 0, made: 0, pct: 0 },
    mid: { attempts: 0, made: 0, pct: 0 },
    corner3: { attempts: 0, made: 0, pct: 0 },
    aboveBreak3: { attempts: 0, made: 0, pct: 0 },
  };

  let attempts = 0;
  let made = 0;

  points.forEach(point => {
    attempts += 1;
    const zone = classifyShotZone(point);
    zoneStats[zone].attempts += 1;
    if (point.isSuccessful) {
      made += 1;
      zoneStats[zone].made += 1;
    }
  });

  (Object.keys(zoneStats) as ShotZoneKey[]).forEach(zone => {
    const attemptsInZone = zoneStats[zone].attempts;
    zoneStats[zone].pct = attemptsInZone > 0 ? roundValue((zoneStats[zone].made / attemptsInZone) * 100, 1) : 0;
  });

  return {
    attempts,
    made,
    fgPct: attempts > 0 ? roundValue((made / attempts) * 100, 1) : 0,
    zoneStats,
  };
};
