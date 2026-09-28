# Post-game riport: döntő tényezők – párharc-forrás, explicit előjel, védekezés liga-mediánhoz

- **Dátum:** 2026-09-28
- **Webes commit:** ez a commit
- **Típus:** @core | funkcionális
- **Állapot a mobilban:** ÁTVEZETVE (2026-09-28, mobil commit 3a1eea4, @core szinkron fa4ef72; az eszközös próba nyitott)

## Mi változott
- `lib/postgame-report.ts` `buildDecisiveFactors` újraírva:
  - **Elsődleges forrás a meccs-párharc** (saját vs. ellenfél ugyanazon a
    meccsen): eFG (±5 pp), TO rate (±4 pp), OREB% (±10 pp), FT rate (±10 pp).
    Pl. `Lepattanó-fölény (OREB% 37.5% vs 6.9%, +30.6 pp)`.
  - **Másodlagos** a referencia-delta (liga medián / szezonátlag), a
    referencia nevével: `3P% a ligamedián felett (+6.5 pp)`. Azonos témában a
    párharc-sor nyer. `baseline.comparable === false` esetén kimarad.
  - **Védekezés**: az ellenfél meccsértéke a **liga mediánhoz** mérve (eFG
    ±3, 3P% +3 / +6 / −5 pp, OREB% ±6, TO rate ±5 pp). A korábbi „Tripla-
    volumen kockázat kontroll alatt” (35–42% között pozitívként) megszűnt:
    helyette `Periméter-kockázat (ellenfél 3P 9/24, 37.5% vs liga medián 32.1%)`
    negatív, illetve `Periméter kontroll (…)` pozitív.
  - `decisiveFactorMeta[]` új opcionális mezői: `tone: 'positive' | 'negative'`
    és `source: 'opponent' | 'reference'`. A régi címkeszövegek
    (`Periméterdobás hatékonyabb`, `Második esély dominancia`, `Lepattanózás
    gyenge` …) megszűntek.
- Webes (nem `@core`): `SeasonComparison.tsx` a `tone`-t használja (színezés,
  „<ellenfél> erősség” csak negatív védekezési faktorra, pozitívra
  „<csapat> védekezési kontroll”; védekezési faktorhoz nem mutat saját
  kulcsmutató-deltát).

## Hatás a mobil appra
- A build nem törik (a mezők opcionálisak).
- A mobil `lib/postgame-view.ts` `isNegativeDecisiveLabel` a szövegből
  becsül előjelet – az új címkéknél ez több helyen téved (pl. „Lepattanó-
  hátrány (…, -13.7 pp)” jó, de „Kevesebb kiharcolt büntető …” vagy
  „Ellenfél hatékonyan dobott (…)” nem ismert minta → pozitívként jelenne meg).

## Teendő a mobil repóban
- [x] `npm run sync:core`
- [x] `lib/postgame-view.ts` `buildDecisiveGroups`: `negative: factor.tone
      ? factor.tone === 'negative' : isNegativeDecisiveLabel(...)` (a regex
      csak régi, mentett riportra maradjon fallback)

## Kézi lépések
nincs
