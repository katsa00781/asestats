import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type StatInfo = {
  name: string;
  description: string;
  formula?: string;
  interpretation: string;
};

const statDescriptions: Record<string, StatInfo> = {
  points: {
    name: 'Pontok',
    description: 'A játékos által szerzett összes pont.',
    interpretation: 'Minél magasabb, annál jobb pontszerző.',
  },
  minutes: {
    name: 'Percek',
    description: 'A játékos által a pályán töltött idő.',
    interpretation: 'Mutatja a játékidőt és a fontosságot a csapatban.',
  },
  rebounds: {
    name: 'Lepattanók',
    description: 'Támadó és védekező lepattanók összege.',
    interpretation: 'Mutatja a palánk alatti dominanciát. Center játékosoknál 8+ jó értéknek számít.',
  },
  assists: {
    name: 'Gólpasszok',
    description: 'Olyan passz, ami közvetlenül pontszerzéshez vezet.',
    interpretation: 'Mutatja a játéktervezés képességét. Irányítóknál 4+ kiváló.',
  },
  steals: {
    name: 'Labdaszerzések',
    description: 'Az ellenfél labdájának megszerzése csel, pattanás vagy rossz passz miatt.',
    interpretation: 'Védekezési aktivitást mutat. 1+ per meccs jó értéknek számít.',
  },
  blocks: {
    name: 'Blokkolt dobások',
    description: 'Ellenfél dobásának megakadályozása.',
    interpretation: 'Palánk alatti védekezést mutat. Centerek esetén 1+ per meccs kiváló.',
  },
  turnovers: {
    name: 'Labdavesztések',
    description: 'A labda elvesztése az ellenfél javára.',
    interpretation: 'Alacsonyabb érték jobb. Assist/TO arány 2:1 felett jó.',
  },
  valuation: {
    name: 'Hatékonysági mutató (VAL)',
    description: 'Összetett mutató: (Pontok + Lepattanók + Gólpasszok + Labdaszerzések + Blokkolt) - (Kihagyott dobások + Labdavesztések + Hibák)',
    interpretation: '15+ kiváló, 10-15 jó, 5-10 átlagos, 5 alatt gyenge.',
  },
  'fg%': {
    name: 'Mezőnydobás %',
    description: 'A bedobott mezőnydobások aránya az összes kísérlethez képest.',
    formula: 'FG% = (Bedobott / Kísérlet) × 100',
    interpretation: '50%+ kiváló, 45-50% jó, 40-45% átlagos.',
  },
  '3p%': {
    name: 'Hármasdobás %',
    description: 'A bedobott hárompontosok aránya.',
    formula: '3P% = (Bedobott hárompontosok / Kísérlet) × 100',
    interpretation: '40%+ kiváló, 35-40% jó, 30-35% átlagos.',
  },
  'ft%': {
    name: 'Büntetődobás %',
    description: 'A bedobott büntetők aránya.',
    formula: 'FT% = (Bedobott büntetők / Kísérlet) × 100',
    interpretation: '85%+ kiváló, 75-85% jó, 70-75% átlagos.',
  },
  'ts%': {
    name: 'True Shooting Percentage (TS%)',
    description: 'A játékos összes pontszerzési hatékonyságát méri, figyelembe véve a mezőnydobásokat, triplákat és büntetőket.',
    formula: 'TS% = Pontok / (2 × (Mezőnydobás-kísérlet + 0.44 × Büntetők)) × 100',
    interpretation: '60%+ kiváló, 55-60% jó, 50-55% átlagos. Minél magasabb, annál hatékonyabb a pontszerzés. A legfontosabb dobóhatékonysági mutató.',
  },
  'efg%': {
    name: 'Effective Field Goal Percentage (eFG%)',
    description: 'A mezőnydobások hatékonyságát mutatja, úgy hogy a triplákat 1,5-szeres értéken számolja, mert azok 3 pontot érnek.',
    formula: 'eFG% = (Bedobott mezőnydobások + 0.5 × Triplák) / Mezőnydobás-kísérletek × 100',
    interpretation: '55%+ kiváló, 50-55% jó, 45-50% átlagos. Jobb mutató mint a sima FG%, mert figyelembe veszi a triplák nagyobb pontértékét.',
  },
  ortg: {
    name: 'Offensive Rating (ORtg)',
    description: 'A játékos 100 támadásra vetített ponttermelését mutatja. Megmutatja, mennyire hatékony a támadójáték.',
    formula: 'ORtg = (Szerzett pontok / Támadások száma) × 100',
    interpretation: '115+ kiváló, 110-115 nagyon jó, 105-110 jó, 100-105 átlagos, 100 alatt gyenge. Az NBA átlag körülbelül 110.',
  },
  drtg: {
    name: 'Defensive Rating (DRtg)',
    description: 'A játékos 100 támadásra engedett pontjait mutatja. Megmutatja, mennyire hatékony a védekezés.',
    formula: 'DRtg = (Kapott pontok / Védekezések száma) × 100',
    interpretation: '105 alatt kiváló, 105-108 nagyon jó, 108-112 jó, 112-115 átlagos, 115+ gyenge. Alacsonyabb érték jobb.',
  },
};

interface StatInfoTooltipProps {
  stat: string;
  children: React.ReactNode;
}

export function StatInfoTooltip({ stat, children }: StatInfoTooltipProps) {
  const info = statDescriptions[stat.toLowerCase()];

  if (!info) {
    return <>{children}</>;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 cursor-help">
            {children}
            <Info className="h-3 w-3 text-slate-400 hover:text-slate-300 transition-colors" />
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs sm:max-w-sm md:max-w-md p-3" side="top">
          <div className="space-y-2">
            <div className="font-semibold text-orange-400">{info.name}</div>
            <p className="text-xs text-slate-300">{info.description}</p>
            {info.formula && (
              <div className="text-xs bg-slate-900 p-2 rounded font-mono text-orange-300">
                {info.formula}
              </div>
            )}
            <div className="text-xs text-slate-400 border-t border-slate-700 pt-2">
              <span className="font-semibold text-slate-300">Értelmezés: </span>
              {info.interpretation}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
