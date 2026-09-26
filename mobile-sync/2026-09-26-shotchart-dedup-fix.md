# Dobásesemények deduplikálása, hiányzó ASE–Pécs dobástérkép pótolva

- **Dátum:** 2026-09-26
- **Webes commit:** ez a commit
- **Típus:** adattartalom
- **Állapot a mobilban:** NYITOTT

## Mi változott

- A Hunbasket `getShootchart` a 2026-09-26-i Atomerőmű SE – NKA Universitas
  Pécs meccsre (`hun_134749`) minden dobást 2–3-szor adott vissza (309 elem,
  125 egyedi). A `hunbasket_shot_events` UNIQUE kulcsa miatt a teljes insert
  elbukott, ezért a meccsnek 0 eseménye volt.
- Új helper: `scrape-utils.ts` `dedupeShotEvents()`. A `scrape-hunbasket.ts`
  és a `process-hunbasket-shotchart-events.ts` beszúrás előtt deduplikál.
- Adatjavítás: a 2026/27-es szezon `hunbasket_shot_events` sorai újraépítve a
  nyers adatból. A `hun_134749` meccsnek most 125 eseménye van (ASE: 73
  dobás). A többi 6 meccs eseményei azonos tartalommal, de **új `id`-val**
  jöttek létre (a szkript meccsenként töröl, majd beszúr).
- A `hunbasket_shotchart_raw.shotchart_data` és az `event_count` változatlan:
  a nyers sor továbbra is a teljes választ őrzi, duplikátumokkal együtt
  (`event_count = 309`).
- Séma, `@core` és API nem változott.

## Hatás a mobil appra

- A mobil post-game elemzés (`mobile-sync/2026-09-26-postgame-analysis-spec.md`,
  2.5 pont) ezen a meccsen mostantól kap dobástérkép-kontextust
  (`report.shotMap.available = true`).
- **Az `event_count` nem használható az események darabszámára.** Duplikált
  válasznál nagyobb, mint a `hunbasket_shot_events` sorainak száma. Ha a mobil
  ebből számol, a tényleges eseménysorokat kell számolnia.
- Ha a mobil gyorsítótáraz `hunbasket_shot_events.id`-t, a 2026/27-es azonosítók
  megváltoztak. A build nem törik.

## Teendő a mobil repóban

- [ ] Ellenőrizni, hogy a mobil nem az `hunbasket_shotchart_raw.event_count`
      mezőből számol dobásszámot.
- [ ] A 2026-09-26-i ASE–Pécs meccsen megjelenik a dobástérkép-szekció
      (73 kísérlet), amint a post-game nézet elkészül.

## Kézi lépések

Nincs. Az újraépítés (`HUNBASKET_SEASON_NAME=2026/2027 npm run
hunbasket:shotchart:assign`) 2026-09-26-án lefutott.
