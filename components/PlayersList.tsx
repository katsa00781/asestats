'use client';

import type { GamePerformance, PlayerStats, ShootingStats } from '@/lib/dashboard-types';
import { DataTable, type ColumnDef } from './ui/data-table';
import { Button } from './ui/button';
import { Users } from 'lucide-react';

type PlayersListProps = {
  players: PlayerStats[];
  onSelectPlayer: (id: string) => void;
  onCompare?: () => void;
};

type PlayerRow = PlayerStats & {
  ppg: number;
  rpg: number;
  apg: number;
  fgPct: number;
};

function calcFGPct(shooting?: ShootingStats): number {
  if (!shooting) return 0;
  const made = shooting.close.made + shooting.mid.made + shooting.three.made;
  const att = shooting.close.attempted + shooting.mid.attempted + shooting.three.attempted;
  return att > 0 ? (made / att) * 100 : 0;
}

const POSITION_LABELS: Record<string, string> = {
  '1': '1 (Irányító)',
  '2': '2 (Dobóhátvéd)',
  '3': '3 (Bedobó)',
  '4': '4 (Erőcsatár)',
  '5': '5 (Center)',
};

function getPositionLabel(position: string): string {
  const normalized = position?.toUpperCase().replace(/\s+/g, '') || '';
  const digits = normalized.match(/[1-5]/g) || [];
  let tokens: string[] = digits.length > 0 ? Array.from(new Set(digits)) : [];

  if (tokens.length === 0) {
    if (normalized.includes('PG')) tokens.push('1');
    if (normalized.includes('SG')) tokens.push('2');
    if (normalized.includes('SF')) tokens.push('3');
    if (normalized.includes('PF')) tokens.push('4');
    if (normalized === 'G' || normalized.includes('G/')) { tokens.push('1'); tokens.push('2'); }
    if (normalized === 'F' || normalized.includes('F/')) { tokens.push('3'); tokens.push('4'); }
    if (normalized.includes('C')) tokens.push('5');
    tokens = Array.from(new Set(tokens));
  }

  if (tokens.length === 1 && POSITION_LABELS[tokens[0]]) return POSITION_LABELS[tokens[0]];
  if (tokens.length >= 2 && POSITION_LABELS[tokens[0]] && POSITION_LABELS[tokens[1]]) {
    return `${POSITION_LABELS[tokens[0]].split(' ')[0]}-${POSITION_LABELS[tokens[1]].split(' ')[0]}`;
  }
  const parts = position.split('-');
  if (parts.length === 2 && POSITION_LABELS[parts[0]] && POSITION_LABELS[parts[1]]) {
    return `${POSITION_LABELS[parts[0]].split(' ')[0]}-${POSITION_LABELS[parts[1]].split(' ')[0]}`;
  }
  return position;
}

function playerInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function Sparkline({ history }: { history: GamePerformance[] }) {
  // A gameHistory dátum szerint csökkenő sorrendű, ezért az utolsó 5 meccs az
  // eleje; megfordítva balról jobbra időrendben rajzoljuk.
  const last5 = history.slice(0, 5).reverse();
  if (last5.length === 0) return <span className="text-muted text-xs">–</span>;
  const max = Math.max(...last5.map((g) => g.points), 1);
  const BAR_W = 7, GAP = 2, H = 20;
  const totalW = last5.length * (BAR_W + GAP) - GAP;
  return (
    <svg width={totalW} height={H} aria-hidden className="inline-block align-middle">
      {last5.map((g, i) => {
        const barH = Math.max(2, Math.round((g.points / max) * (H - 2)));
        return (
          <rect
            key={i}
            x={i * (BAR_W + GAP)}
            y={H - barH}
            width={BAR_W}
            height={barH}
            rx={1}
            fill="var(--accent-cyan)"
            opacity={0.4 + (i / last5.length) * 0.6}
          />
        );
      })}
    </svg>
  );
}

function buildPositionBadgeClass(position: string): string {
  const norm = position?.toUpperCase() || '';
  if (norm.includes('1') || norm.includes('PG')) return 'dt-badge dt-badge--pg';
  if (norm.includes('2') || norm.includes('SG')) return 'dt-badge dt-badge--sg';
  if (norm.includes('3') || norm.includes('SF')) return 'dt-badge dt-badge--sf';
  if (norm.includes('4') || norm.includes('PF')) return 'dt-badge dt-badge--pf';
  if (norm.includes('5') || norm.includes('C'))  return 'dt-badge dt-badge--c';
  return 'dt-badge dt-badge--neutral';
}

export function PlayersList({ players, onSelectPlayer, onCompare }: PlayersListProps) {
  if (players.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-secondary">Még nincsenek betöltött játékosok.</p>
        <p className="text-muted text-sm mt-2">Töltsd be a meccsadatokat a kezdéshez.</p>
      </div>
    );
  }

  const rows: PlayerRow[] = players.map((p) => ({
    ...p,
    ppg: p.gamesPlayed > 0 ? p.points / p.gamesPlayed : 0,
    rpg: p.gamesPlayed > 0 ? p.rebounds.total / p.gamesPlayed : 0,
    apg: p.gamesPlayed > 0 ? p.assists / p.gamesPlayed : 0,
    fgPct: calcFGPct(p.shooting),
  }));

  const columns: ColumnDef<PlayerRow>[] = [
    {
      key: 'number',
      label: '#',
      width: 48,
      sortable: false,
      render: (r) => <span className="dt-num dt-num--muted">#{r.number}</span>,
    },
    {
      key: 'name',
      label: 'Név',
      sortable: true,
      render: (r) => (
        <span className="dt-player">
          <span className="dt-player-avatar">{playerInitials(r.name)}</span>
          <span>
            <button className="dt-player-name" onClick={() => onSelectPlayer(r.id)}>
              {r.name}
            </button>
            <span className="dt-player-meta">{getPositionLabel(r.position)}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'position',
      label: 'Poz.',
      sortable: false,
      center: true,
      width: 60,
      render: (r) => <span className={buildPositionBadgeClass(r.position)}>{r.position}</span>,
    },
    {
      key: 'gamesPlayed',
      label: 'M',
      numeric: true,
      sortable: true,
      width: 52,
    },
    {
      key: 'ppg',
      label: 'PPG',
      numeric: true,
      sortable: true,
      sortAccessor: (r) => r.ppg,
      render: (r) => <span data-stat>{r.ppg.toFixed(1)}</span>,
    },
    {
      key: 'rpg',
      label: 'RPG',
      numeric: true,
      sortable: true,
      sortAccessor: (r) => r.rpg,
      render: (r) => <span data-stat>{r.rpg.toFixed(1)}</span>,
    },
    {
      key: 'apg',
      label: 'APG',
      numeric: true,
      sortable: true,
      sortAccessor: (r) => r.apg,
      render: (r) => <span data-stat>{r.apg.toFixed(1)}</span>,
    },
    {
      key: 'fgPct',
      label: 'FG%',
      numeric: true,
      sortable: true,
      sortAccessor: (r) => r.fgPct,
      render: (r) => <span data-stat>{r.fgPct.toFixed(1)}</span>,
    },
    {
      key: 'trueShootingPct',
      label: 'TS%',
      numeric: true,
      sortable: true,
      render: (r) => <span data-stat>{r.trueShootingPct.toFixed(1)}</span>,
    },
    {
      key: 'effectiveShootingPct',
      label: 'eFG%',
      numeric: true,
      sortable: true,
      render: (r) => <span data-stat>{r.effectiveShootingPct.toFixed(1)}</span>,
    },
    {
      key: 'offensiveRating',
      label: 'Pont hat.',
      numeric: true,
      sortable: true,
      render: (r) => <span data-stat className="text-orange">{r.offensiveRating.toFixed(2)}</span>,
    },
    {
      key: 'defensiveRating',
      label: 'Véd. idx',
      numeric: true,
      sortable: true,
      render: (r) => <span data-stat className="text-cyan">{r.defensiveRating.toFixed(1)}</span>,
    },
    {
      key: 'valuation',
      label: 'VAL',
      numeric: true,
      sortable: true,
      render: (r) => <span data-stat className="text-ai">{r.valuation.toFixed(1)}</span>,
    },
    {
      key: 'forma',
      label: 'Forma',
      sortable: false,
      center: true,
      width: 56,
      render: (r) => <Sparkline history={r.gameHistory} />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display uppercase tracking-wide text-primary text-lg sm:text-xl">
            Játékosok Listája
          </h2>
          <p className="text-secondary text-sm mt-1">
            Kattints egy játékosra a részletes statisztikákért
          </p>
        </div>
        {onCompare && (
          <Button onClick={onCompare} variant="secondary" className="w-fit">
            <Users className="h-4 w-4 mr-2" strokeWidth={1.6} />
            Összehasonlítás
          </Button>
        )}
      </div>
      <DataTable<PlayerRow>
        columns={columns}
        rows={rows}
        initialSort={{ key: 'valuation', dir: 'desc' }}
        getRowId={(r) => r.id}
      />
    </div>
  );
}
