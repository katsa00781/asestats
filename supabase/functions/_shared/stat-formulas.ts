// GENERÁLT MÁSOLAT – forrás: asestats/lib/stat-formulas.ts (simpleValuation).
//
// A Supabase Edge Function Deno futásidőben fut, a Next.js `lib/`-et nem
// tudja közvetlenül importálni (más runtime, más modulfeloldás), ezért a
// `supabase/functions/_shared/` mappában él egy másolat – ugyanaz a minta,
// mint a mobil app `core/` tükrözése a webprojekt `lib/`-jéből.
//
// Ha a képlet változik a forrásban, ezt a fájlt kézzel kell frissíteni.

/**
 * FIBA valuation (egyszerűsített, fault-adatok nélkül):
 * PTS + REB + AST + STL + BLK − kihagyott mezőny − kihagyott büntető − TOV.
 */
export function simpleValuation(input: {
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  fgMade: number;
  fgAttempted: number;
  ftMade: number;
  ftAttempted: number;
  turnovers: number;
}): number {
  return (
    input.points +
    input.rebounds +
    input.assists +
    input.steals +
    input.blocks -
    (input.fgAttempted - input.fgMade) -
    (input.ftAttempted - input.ftMade) -
    input.turnovers
  );
}
