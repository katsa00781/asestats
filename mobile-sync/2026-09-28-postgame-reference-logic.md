# Post-game riport: referencialogika – OREB% definíció, sávos célérték, referencia nélküli kis minta

- **Dátum:** 2026-09-28
- **Webes commit:** ez a commit
- **Típus:** @core | funkcionális
- **Állapot a mobilban:** ÁTVEZETVE (2026-09-28, mobil commit 3a1eea4, @core szinkron fa4ef72; az eszközös próba nyitott)

## Mi változott
- `lib/postgame-report.ts`:
  - `TeamSeasonStat` új opcionális mezője: `oppDreb?: number` (az ellenfelek
    szezonos védő lepattanói). Megadva a szezon- és a liga-benchmark OREB%
    ugyanazzal a képlettel számol, mint a meccsérték:
    `T-lep / (T-lep + ellenfél V-lep)`. Hiányában marad a régi, saját
    lepattanós közelítés (`T-lep / (T-lep + saját V-lep)`) – ez volt a „vegyes
    szezonforrás” hiba oka (pl. Szolnok: szezon OREB 35,7% vs. meccsdefiníció).
  - `PostgameBaseline` új kötelező mezője: `comparable: boolean`. Kis mintánál
    (< 3 meccs) liga benchmark nélkül `false`, a címke „Nincs referencia (kis
    minta)”. Ilyenkor a ratingek `ref*` mezői `null`-ok, az összefoglaló és az
    interpretáció nem hivatkozik szezonra / referenciára.
  - `nextFocus` célértéke sávos: legfeljebb `GOAL_MAX_STEP_PP` lépés a
    jelenlegi értékből (FT rate 8, TO rate 3, eFG 4, 3P% 5, Assist 6, OREB 5
    pp). Ha a korlát vág: `FT-rate 23.7% → 31.7% (referencia 42.1%)`.
- Webes (nem `@core`): `SeasonComparison.tsx` átadja az `oppDreb`-et, és
  `comparable === false` esetén nem mutat szezon-sort / 0-s deltát;
  `lib/export-to-md.ts` ilyenkor „–” a referencia- és deltaoszlopban.

## Hatás a mobil appra
- A mostani mobil build nem törik (az `oppDreb` opcionális; a `comparable`
  mező új, csak olvasni kell).
- `oppDreb` nélkül a mobil OREB% referenciája és liga-mediánja továbbra is a
  régi definíciót követi, tehát eltér a webtől (web: liga medián 26,3%,
  régi: 28,5% a 2026/27-es adaton).
- Ha a mobil a `keyStats[].season` / `delta` értéket mindig kiírja,
  `baseline.comparable === false` esetén 0-s deltát mutatna.

## Teendő a mobil repóban
- [x] `npm run sync:core`
- [x] `lib/team-season-stats.ts` / `lib/postgame-data.ts`: a `TeamSeasonStat`
      bemenet kapja meg az `oppDreb`-et (az ellenfelek szezonos V-lep összege,
      meccsenként a másik csapat sorainak `defensive_rebounds` összegéből) –
      a benchmark-medencében minden csapatnál
- [x] Post-game kulcsmutatók: `baseline.comparable === false` esetén a
      referencia és a delta rejtése

## Kézi lépések
nincs
