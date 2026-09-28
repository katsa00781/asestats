# Post-game riport: standard, perc-normalizált USG%

- **Dátum:** 2026-09-28
- **Webes commit:** ez a commit
- **Típus:** @core | funkcionális
- **Állapot a mobilban:** NYITOTT

## Mi változott
- `lib/player-postgame.ts` (felhasználói döntés, 2026-09-28):
  - `PlayerPostGameBreakdown.usageShare` és `llmContext.usageSharePct`
    jelentése: **standard USG%** (0–1), nem csapatrészesedés.
    `USG = (FGA + 0,44·FTA + LV) · (csapatperc / 5) / (perc · csapat-usage)`,
    átlag ~20%, az értékek összege nem 100%. Felső korlát 60%.
  - Új exportok: `computeUsgRate()`, `computeUsageRates()`, `USG_LOW_MAX`
    (0,15), `USG_HIGH_MIN` (0,25).
  - `usageTier`: `low` ≤ 15%, `high` ≥ 25% (korábban a keretmérettől függő
    részesedés-küszöb). Az Impact score usage-komponense 10–35% USG között
    skálázódik → az impact score és a címkék eltolódnak (pl. Benke:
    „Hatékony szerepjátékos” → „Elsődleges motor”, Daniels 11,8% → 22,5%).
- `lib/postgame-report.ts` `analyzePlayerImpact`: ugyanezt a USG%-ot
  használja (alacsony ≤ 15%, magas ≥ 25%) a „pozitív hatás / limitált hatás”
  listákhoz.
- Webes (nem `@core`): `SeasonComparison.tsx` játékostrend is `computeUsgRate`;
  `lib/export-to-md.ts` képlet-lábjegyzet.

## Hatás a mobil appra
- A build nem törik (mezőnevek változatlanok).
- Ahol a mobil a `usageShare`-t „csapatrészesedésként” magyarázza vagy a
  régi (~10%-os) skálához mért küszöbbel színez, ott a számok most ~2×
  nagyobbak. A clutch `topUsageClosers` (`clutch-view.ts`) **nem** érintett
  – az a clutch-blokk saját részesedése.

## Teendő a mobil repóban
- [ ] `npm run sync:core`
- [ ] Post-game játékosbontás: a Usage% felirat / magyarázat „USG%
      (perc-normalizált)”; saját usage-küszöb esetén `USG_LOW_MAX` /
      `USG_HIGH_MIN` használata
- [ ] Ha a mobil játékostrend saját usage-részesedést számol:
      `computeUsgRate` (`@core/player-postgame`)

## Kézi lépések
nincs
