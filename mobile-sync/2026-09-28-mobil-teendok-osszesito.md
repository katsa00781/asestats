# Mobil teendők – 2026-09-28 összesítő (web H12)

A mai webes változások (post-game riportgenerátor hibalista H12 + Kosarstat
adatjavítás) mobil oldali átvezetése egy helyen, végrehajtási sorrendben.
A részletek és indoklás a felsorolt jegyzetekben vannak; ez a fájl a
munkalista. A jegyzetek állapotát egyenként kell `ÁTVEZETVE`-re állítani.

**Érintett jegyzetek (mind NYITOTT):**

| # | Jegyzet | Típus | Mobil kódváltozás |
|---|---------|-------|-------------------|
| 1 | `2026-09-28-postgame-reference-logic.md` | @core | igen (bemenet + nézet) |
| 2 | `2026-09-28-postgame-decisive-factors.md` | @core | igen (nézet) |
| 3 | `2026-09-28-postgame-metric-definitions.md` | @core | igen (bemenet + címke) |
| 4 | `2026-09-28-postgame-usg-rate.md` | @core | csak ellenőrzés / felirat |
| 5 | `2026-09-28-postgame-data-validation.md` | @core | nem kötelező |
| 6 | `2026-09-28-postgame-texts-empty-blocks.md` | @core | kicsi (nézet) |
| 7 | `2026-09-28-kosarstat-reimport-mirror-links.md` | adat | nem, csak ellenőrzés |
| 8 | `2026-09-28-kosarstat-ase-pecs-metadata.md` | adat | nem, csak ellenőrzés |

A mostani mobil build egyik változástól sem törik – minden új mező opcionális
vagy csak olvasandó. Webes commitok: `157b2b1` … `6cc80b2` (pusholva).

---

## 1. `@core` frissítés

- [ ] `npm run sync:core` – érintett tükrözött modulok: `postgame-report`,
      `player-postgame`. (Az új `lib/player-name-match.ts` nem `@core`, lásd 5.)
- [ ] `tsc` a mobil repóban – új kötelező mező a `PostgameBaseline`-ban
      (`comparable`); ha a mobil saját objektumot épít ilyen típussal, bővíteni kell.

## 2. Bemenet: `lib/postgame-data.ts` (jegyzet 1 + 3)

A `@core` két új, opcionális `TeamSeasonStat` mezőt vár. Nélkülük a mobil
OREB% referenciája és a tempó/ratingek eltérnek a webtől. A mobil
`team-season-stats.ts` az `opponent` blokkot már kitölti, így elég a
leképezés, mielőtt a `leagueTeams` a `buildTeamBenchmarks`-ba és a
`teamSeason` az `analyzePostGameReport`-ba kerül:

```ts
const withOpponentTotals = (team: TeamSeasonStat) => {
  const o = team.opponent;
  const oppPossessions = o.fga2 + o.fga3 + 0.44 * o.fta + o.tov - o.oreb;
  return {
    ...team,
    oppDreb: o.dreb > 0 ? o.dreb : undefined,
    oppPossessions: oppPossessions > 0 ? oppPossessions : undefined,
  };
};
```

- [ ] A benchmark-medence **minden** csapatára (különben a liga medián vegyes
      definícióból számol), és a kiválasztott `teamSeason`-ra is.
- [ ] Ellenőrzés az ASE–Pécs meccsen (2026/27): liga OREB medián **26,3%**,
      birtoklás **75,5**, ASE DRtg = Pécs ORtg = **102,0**.

## 3. Nézet: `lib/postgame-view.ts`

- [ ] **Döntő tényezők előjele** (jegyzet 2): `buildDecisiveGroups`-ban
      `negative: factor.tone ? factor.tone === 'negative' : isNegativeDecisiveLabel(factor.label, factor.axis)`.
      Az új címkéknél a szövegalapú becslés téved (pl. „Ellenfél hatékonyan
      dobott (…)” pozitívnak látszana). A regex csak régi riportra marad.
- [ ] **Címkék** (jegyzet 3): `SHOT_PROFILE_LABELS` kulcsa `'FT arány'` →
      `'FTM arány'`. A `KEY_STAT_LABELS.ft_rate` felirata legyen pl.
      „Büntetőpont-ráta (FTM/FGA)” – a mutató mostantól FTM/FGA, nem FTA/FGA.
      A `turnover_rate` az Oliver-féle TO rate (felirat maradhat).
- [ ] **Referencia nélküli kis minta** (jegyzet 1): `baseline.comparable === false`
      esetén a kulcsmutatóknál ne legyen referencia- és deltasor (különben 0-s
      delta jelenik meg).
- [ ] **Védekezés** (jegyzet 6): ha a mobil saját védekezési mondatot ír a
      `context.defenseEfficiencyDelta`-ból, használja a
      `context.defense` számait (ellenfél eFG vs liga medián).
- [ ] **Adatminőség**: a `dataNotes` már megjelenik (`notes`); új tartalma:
      dobástérkép–box score eltérés (pl. „73 dobás … 76 mezőnykísérlet”).
      Ellenőrizni, hogy hosszabb szövegnél is olvasható.

## 4. Játékosbontás – USG% (jegyzet 4)

- [ ] A `usageShare` mostantól standard, perc-normalizált USG% (átlag ~20%,
      összeg ≠ 100%). Ha a mobil a Usage%-ot „csapatrészesedésként”
      magyarázza, a felirat/tooltip frissítendő („USG%, perc-normalizált”).
- [ ] Saját usage-küszöb esetén a `@core/player-postgame` `USG_LOW_MAX`
      (0,15) / `USG_HIGH_MIN` (0,25) használata.
- [ ] Ha van mobil játékostrend saját usage-számítással: `computeUsgRate`.
- A clutch `topUsageClosers` (`clutch-view.ts`) **nem** érintett.

## 5. Opcionális / csak ha a mobil használja

- Kosarstat lineup-elemzés, névillesztés, meccsbeli pozíció (jegyzet 5):
  a mobil jelenleg nem használ lineup-adatot, és a pozíció a keretből jön –
  teendő nincs. Ha lineup nézet készül: `lib/player-name-match.ts` felvétele
  a `@core` modulok közé (webes CLAUDE.md lista bővítése), lineup-rangsor
  ≥ 5 perces mintából, pozíció a meccsbeli Kosarstat slotból.
- Clutch / trend üres állapot (jegyzet 6): a `clutch-view.ts` már kezeli a
  `available === false` esetet; saját trend esetén legalább 3 meccs.

## 6. Adat-ellenőrzés (jegyzet 7 + 8, kódváltozás nélkül)

- [ ] 2026/27-ben mind a 14 `games` sor Kosarstat-linkelt (korábban 8):
      a Honvéd–Kecskemét, Szombathely–Fót, Kaposvár–Szeged meccsek post-game
      nézete mindkét csapat szemszögéből betölti a Kosarstat blokkot.
- [ ] Az ASE–Pécs meccs post-game / clutch nézete betölt.

## Lezárás

- [ ] Mobil build + eszközös próba az ASE–Pécs és a Szolnok–OSE meccsen
      (a H12 hibalista két referencia-meccse).
- [ ] A 8 jegyzet `Állapot` sora: `ÁTVEZETVE (YYYY-MM-DD, mobil commit <hash>)`.
