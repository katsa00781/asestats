# Post-game elemzés – specifikáció a mobil átvételhez

- **Dátum:** 2026-09-26
- **Webes commit:** ez a commit (csak dokumentáció, webes kódváltozás nincs)
- **Típus:** funkcionális
- **Állapot a mobilban:** NYITOTT

## Mi változott

A webes kód nem változott. A jegyzet a webes **számított** post-game
elemzést írja le, hogy a mobil a meglévő `@core` modulokból fel tudja építeni.

A mobil ma a meccs részletein csak a **mentett AI szöveget** mutatja
(`game_text_reports`, `report_type = 'postgame'`). A web ezen felül élőben
kiszámol egy strukturált elemzést: döntő tényezők, kulcsmutatók a szezonhoz és
a ligamediánhoz mérve, dobásprofil, dobástérkép-kontextus, játékoskártyák,
erősségek, problémák és következő fókusz. Ez nem tárolt adat, minden
megnyitáskor a `@core/postgame-report` `analyzePostGameReport()` hívása állítja
elő.

A webes forrás helye: `components/SeasonComparison.tsx`, post-game nézet.
- Bemenetek összeállítása: `postgameReport` useMemo, kb. 9236–9500. sor.
- Benchmark: `postgameBenchmarks`, kb. 8980. sor.
- Dobástérkép-kontextus: `loadPostgameShotContext`, kb. 5374. sor.
- Megjelenítés: kb. 15800–17340. sor.

**A `@core` már szinkronban van.** A mobil `core/postgame-report.ts` és
`core/player-postgame.ts` csak a generált fejlécben tér el a webestől, ezért
`npm run sync:core` most nem kell.

## Hatás a mobil appra

- A build nem törik, mert a séma és a `@core` nem változott.
- Új nézet vagy szekció kell a meccs részletein. Javaslat: külön alroute
  (pl. `app/(tabs)/games/[id]/postgame.tsx`), amit a meccs részleteiről egy
  `NavRow` nyit. Az elemzés hosszú, és a liga-szintű szezonadatot is betölti.
  A végleges helyről a mobil repó döntsön.
- Új hálózati terhelés nincs, ha a liga szezonmezőnyét a már meglévő
  `useTeamSeasonData` cache adja (D-086).

---

## 1. A számítás: egyetlen `@core` hívás

```ts
import {
  analyzePostGameReport,
  buildTeamBenchmarks,
  type PlayerGameStat,
  type TeamGameStat,
  type TeamSeasonStat,
  type PostGameShotMapContext,
} from '@core/postgame-report';
import type { PreGameXFactorContext } from '@core/pregame-scouting';

const benchmarks = buildTeamBenchmarks(leagueTeams);          // TeamSeasonStat[]
const report = analyzePostGameReport(
  teamGame,          // TeamGameStat – saját box score összege
  opponentGame,      // TeamGameStat | null – ellenfél box score összege
  teamSeason,        // TeamSeasonStat – saját csapat a leagueTeams-ből
  benchmarks,
  players,           // PlayerGameStat[] – saját játékosok ezen a meccsen
  xFactorContext,    // opcionális, lásd 2.6
  shotMapContext,    // opcionális, lásd 2.5
);
```

`analyzePostGameReport` tiszta függvény, nem hív hálózatot és nem használ
Reactot. A `useMemo` elég hozzá.

## 2. Bemenetek

### 2.1 `leagueTeams` és `teamSeason`

A mobil `lib/team-season-stats.ts` `fetchTeamSeasonStats()` már a
`@core/team-analysis` `TeamSeasonStat[]` alakját adja, a `useTeamSeasonData`
cache-én keresztül. Ez a postgame `TeamSeasonStat` bővebb változata, és
strukturálisan kompatibilis vele, így közvetlenül átadható.

- `teamSeason` = `leagueTeams.find(t => t.teamId === selectedTeamId)`.
- **Invariáns:** a `teamSeason.league` és `teamSeason.season` értékének
  egyeznie kell a benchmark kulcsával. A `getBenchmarkThreshold` ezekkel keres,
  és kulcseltérésnél csendben `NaN`-t ad (nincs ligamedián). A mobil `LEAGUE`
  konstans (`'NB I/A'`) és a szezonnév ezt teljesíti, ha a `teamSeason`
  ugyanabból a tömbből jön, amiből a `buildTeamBenchmarks` fut.
- Ha a `teamSeason` nincs meg, vagy üres (`fga2 + fga3 + fta + tov === 0`),
  nincs elemzés, és az üres állapot jelenik meg.

### 2.2 `players`: saját box score → `PlayerGameStat[]`

A forrás a szezonspecifikus stat-tábla sorai `game_id = <meccs>` szűréssel
(`getSeasonStatsTable`). A mobil `useGameDetails` ezeket már letölti.

| `PlayerGameStat` | Forrás |
|---|---|
| `playerId` | `player_id` |
| `name` | szezon keret neve → `players.name` → `player_id` |
| `position` | a keret `position` mezője (`Position`), fallback `'PG'` |
| `isStarter` | `is_starter`, ha boolean, különben `undefined` |
| `minutes` | `minutes ?? 0` |
| `points` | `points ?? 0` |
| `fga2` / `fgm2` | `close_attempted + mid_attempted` / `close_made + mid_made` |
| `fga3` / `fgm3` | `three_attempted` / `three_made` |
| `fta` / `ftm` | `free_throw_attempted` / `free_throw_made` |
| `oreb` / `dreb` | `offensive_rebounds` / `defensive_rebounds` |
| `ast`, `tov`, `stl`, `blk` | `assists`, `turnovers`, `steals`, `blocks` |
| `val` | `valuation ?? 0` |
| `roles` | a keret `roles` mezője, vagy `[]` |

A `roles` a számítást nem befolyásolja, csak átmegy a kimenetbe. A web magyar
feliratot ad át, a mobil keret `roleKeys`-t tartalmaz, és mindkettő
elfogadott. A web a kezdőket a kosarstat lineup-elemzésből is kikövetkezteti,
ha nincs `is_starter`. Ezt a mobil v1 kihagyja (lásd 5.), a `sparkPlugs`
kiemelés ezért kezdő-adat nélkül üresebb lehet.

Ha a meccshez nincs saját játékossor, nincs elemzés, és a „Nincs elég adat a
post-game jelentéshez” szöveg jelenik meg.

### 2.3 `teamGame` és `opponentGame`: box score összege

A web a játékossorokat összegzi (`buildTeamGame`):

```ts
{
  teamId, teamName, league: LEAGUE, season: seasonName,
  pointsFor: Σ points, pointsAgainst: 0,
  fga2, fgm2, fga3, fgm3, fta, ftm, oreb, dreb, ast, tov, stl, blk, val: Σ …,
  fouls: 0,        // a web itt szándékosan 0-t ad (nincs benne a számításban)
}
```

Ezután:
- `teamGame.pointsAgainst` = ellenfél `pointsFor`, ha van ellenfél box score,
  különben `games.opp_score`.
- `teamGame.actualPointsFor` / `actualPointsAgainst` = `games.our_score` /
  `games.opp_score`. A `@core` ezekkel kalibrál, így a hivatalos eredmény
  számít, nem a box score összege.
- `teamGame.result` = `games.result`.
- Ha van `opponentGame`: `actualPointsFor = opp_score`,
  `actualPointsAgainst = our_score`, és a `result` a fordítottja.

**Az ellenfél box score megtalálása.** Az ellenfél meccsének a saját
perspektívájú `games` sora kell:
`season_id = <szezon>`, `our_team_id = games.opponent_team_id`,
`date = games.date`. A sor `id`-jával kell lekérni a stat-tábla sorait. A web
ugyanezt a `date::opponent_team_id` kulcsú térképpel oldja meg
(`hooks/useGameData.ts`, `opponentGameMap`). A mobil `TeamGame` már tartalmazza
az `opponentTeamId`-t. Ha nincs ilyen sor, az `opponentGame` értéke `null`.
Ekkor a `@core` a `dataNotes`-ba beírja: „Ellenfél statisztikák nem elérhetők,
a védekező értékelés korlátozott.”, és a védekező tényezők elmaradnak.

### 2.4 Benchmark

`buildTeamBenchmarks(leagueTeams)` a `@core/postgame-report`-ból. **Nem** a
`pregame-scouting` vagy `team-analysis` azonos nevű függvénye. Mindhárom
létezik, és a web is aliasszal különbözteti meg őket.

### 2.5 `shotMapContext` (opcionális, Hunbasket dobástérkép)

Csak akkor van, ha a meccsnek van Hunbasket shot chartja. Ha nincs, a
`report.shotMap.available` értéke `false`, és a szekció elrejtendő.

1. Nyers meccs keresése:
   ```ts
   supabase.from('hunbasket_shotchart_raw')
     .select('id, home_team_id, away_team_id, home_score, away_score')
     .eq('season_id', seasonId)
     .eq('game_date', game.date)
     .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
   ```
   Jelölt az a sor, ahol a pontszám bármelyik irányban egyezik
   (`home_score/away_score` = `our/opp` vagy `opp/our`), és ha ismert az
   `opponentTeamId`, mindkét csapat szerepel benne. Ha nincs jelölt, az első
   sor marad (a web is így tesz).
2. Meccs-dobások: `hunbasket_shot_events` a
   `player_id, x, y, is_successful, shot_side` mezőkkel,
   `raw_game_id = <raw.id>` és `team_id = <teamId>` szűréssel.
3. Szezon-dobások: ugyanez `season_id` + `team_id` szűréssel, `.order('id')`,
   **`fetchAllRows`-szal**, mert egy szezon könnyen 1000 sor fölött van.
4. Mapper, validálással a rendszerhatáron: a sor kimarad, ha az `x` vagy az `y`
   nem véges szám, vagy ha a `shot_side` nem `'home'` és nem `'away'`.
   Kimenet:
   `{ playerId, x: Number(x), y: Number(y), isSuccessful: Boolean(is_successful), shotSide }`.

Az eredmény `{ gameShots, seasonShots }`. Hiba esetén `undefined` legyen, ne
dobjon hibát: az elemzés dobástérkép nélkül is teljes.

### 2.6 `xFactorContext` (opcionális, pregame visszatükrözés)

A web átadja a pregame scouting `xFactorContext`-jét, de csak akkor, ha a
`pregameReport.opponentTeamName.toLowerCase() === game.opponent.toLowerCase()`.
Ebből lesz a `report.reflection.xFactor` / `.risk` („a várt X-faktor
bejött-e”). A mobil `useScoutingData(opponentId)` `analyzePreGameScouting`
kimenete tartalmazza, és ugyanazt a szezon-cache-t használja. **A v1-ben
elhagyható.** Ekkor a `reflection` két üres string, és a blokk nem jelenik meg.

## 3. Kimenet: `PostGameReport` → képernyőszekciók

A sorrend a webes nézetet követi. A zárójeles jelölés azt mutatja, mit
javaslok mobilon v1-ben:
- **(v1)**: bekerül.
- **(opcionális)**: bekerülhet.
- **(v2)**: később.

1. **Összegzés (v1).** `report.summary`: egy bekezdés, AI-színezés nélkül,
   mert ez szabályalapú szöveg, nem LLM. Alatta, ha nem üres,
   `reflection.xFactor` (warning szín) és `reflection.risk` (secondary szín).
   Utána `dataNotes.join(' ')` kis secondary szöveggel.

2. **Fejléc KPI-ok (v1).** Három `StatTile`:
   - Pontok: `metrics.pointsFor – metrics.pointsAgainst`, alatta
     „Különbség: ±margin” (`positive` ha ≥ 0, különben `negative`, 1
     tizedes).
   - Tempó: `metrics.pace.toFixed(1)`, felirat „Meccs-possessions becslés”.
   - Hatékonyság: `metrics.efg.toFixed(1) + '%'` (eFG%).

3. **Kulcsmutatók: meccs vs. szezon (v1).** `metrics.keyStats`, 6 sor, fix
   sorrendben: eFG%, 3P%, Assist%, TO rate, OREB%, FT rate. Minden sor
   tartalma: `label`, `game`, `season`, `delta`, és ha van, `leagueMedian`.
   - Minden érték **már százalékpont-skálán van** (×100 megtörtént, 1 tizedes).
     Nem kell újra szorozni.
   - A delta formátuma `+2.4 pp`. A színe mutatófüggő: a **TO rate**-nél a
     negatív delta a jó (zöld), a többinél a pozitív.
   - A mobil nyelvi szabálya (D-084) szerint a feliratok magyarítandók:
     Assist% → „Gólpassz%”, TO rate → „Eladott labda%”, FT rate →
     „Büntető-ráta”, a többi marad. A `key` mező stabil azonosító
     (`efg`, `three_pct`, `assist_rate`, `turnover_rate`, `oreb_rate`,
     `ft_rate`), erre érdemes a fordítást kötni.

4. **Hatékonyság-összevetés chart (opcionális).** `charts.efficiency` ugyanaz a
   6 mutató `game / season / league?` oszloppárral. Webes forma: csoportos
   oszlopdiagram. Mobilon a 3. pont soraiba épített mini sáv (`bar-track`)
   elég.

5. **Dobásprofil (v1).** `charts.shotProfile`, 3 sor: 2P arány, 3P arány,
   FT arány. `game` vs. `season`, mind %-ban. Ez a dobások megoszlása, nem
   hatékonyság, ezért a sáv semleges cián (mint a roles-view leíró
   metrikáinál).

6. **Dobástérkép-kontextus (v1, csak ha `shotMap.available &&
   shotMap.comparison`).**
   - Cím: „Kísérletek: `team.attempts` • FG%: `team.fgPct`%”.
   - Négy arány, deltával szemben a szezonnal:
     - Gyűrű arány: `rimRate` / `rimRateDelta`.
     - Középtáv arány: `midRate` / `midRateDelta`.
     - Tripla arány: `threeRate` / `threeRateDelta`.
     - Sarok tripla arány: `corner3Rate` / `corner3RateDelta`.
   - Három hatékonyság:
     - Gyűrű FG%: `rimPct` (`rimPctDelta`).
     - Tripla FG%: `threePct` (`threePctDelta`).
     - Shot quality index: `shotQualityIndex.toFixed(2)`
       (`shotQualityDelta`, előjellel).
   - Delta színe (webes `shotDeltaTone`): ha `|Δ| < 0.2` vagy nem véges →
     secondary; pozitív → positive; negatív → negative. A web ezt mind a hét
     értékre egységesen alkalmazza, a középtáv-arányra is.
   - Zónatábla: `shotMap.team.zones` és `shotMap.season.zones`. Öt zóna:
     `rim` Gyűrű, `paint` Festék, `mid` Középtáv, `corner3` Sarok tripla,
     `aboveBreak3` Íven kívüli tripla. Zónánként `attempts / made / pct`. A
     zónaarány `attempts / team.attempts`.
   - Ha a `gameShots` 24-nél kevesebb, a szekció alá ez kerüljön:
     „Alacsony mintaszám (N dobás), a zónák trendje óvatosan értelmezendő.”
   - A webes szórásdiagram és hőtérkép (félpálya, x/y 0–100) mobilon **v2**.
     Skia rajzolást igényel, és a v1 értékét a számok adják.

7. **Döntő tényezők (v1).** Forrás: `report.decisiveFactorMeta`, elemenként
   `{ label, annotated, type, axis }`.
   - Csoportosítás `axis + type` szerint. Csoportcím:
     `${axis === 'offense' ? 'Támadás' : 'Védekezés'} – ${type}`, ahol a
     `type` értéke `'Hatékonyság' | 'Volumen' | 'Kontroll'`.
   - Jelölés: támadás → orange, védekezés → cián. A web emojit használ
     (⚡/🛡️), mobilon Lucide ikon kell (`Zap` / `Shield`).
   - Tételenként a `label` jelenik meg. A tónust (▲ zöld / ▼ piros) a web
     szövegből következteti ki (`isNegativeDecisiveLabel`,
     `SeasonComparison.tsx` kb. 1644. sor). Ezt 1:1-ben át kell venni a mobil
     `lib/`-be, mert nem `@core`:
     ```ts
     const isNegativeDecisiveLabel = (label: string, axis: 'offense' | 'defense') => {
       const lower = label.toLowerCase();
       const neg = /-\d+(?:[.,]\d+)?\s*pp/.test(lower);
       const pos = /\+\d+(?:[.,]\d+)?\s*pp/.test(lower);
       if (axis === 'defense') {
         if (/limit[aá]lt|kontroll|megfog|zavar/.test(lower)) return false;
         if (/probl[eé]ma|gyenge|romlott|engedett|visszaesett|hi[aá]ny/.test(lower)) return true;
         return neg && !pos;
       }
       if (/hi[aá]ny|gyenge|vissza|akadozott|sz[eé]tesett|alacsony|probl[eé]ma/.test(lower)) return true;
       return neg && !pos;
     };
     ```
   - Üres állapot: „Nincs kiemelt faktor.”
   - A webes interaktív „kiválasztott faktor részletei” és az „ellenfél-hatás
     faktoronként” chart mobilon **v2**.

8. **Játékos hatás (v1).** `playerImpact.positive` és
   `playerImpact.negative`, vesszővel összefűzve. Üres esetben „–”. A web a
   `overperformers` és `underperformers` listát a nézetben nem írja ki.

9. **Játékos post-game elemzés (v1).** Forrás: `report.playerReport`.
   - Három kiemelt kártya:
     - „Meccs motor”: `highlights.mvp`, positive keret. Üres állapot: „Nincs
       kiemelt motor ezen a meccsen.”
     - „Stabil alappillérek”: `highlights.engines[0]`, cián keret. Üres
       állapot: „Nincs stabil másodlagos motor.”
     - „Padlóról érkező szikra”: `highlights.sparkPlugs[0]`, warning keret.
       Üres állapot: „Nem volt kiugró spark plug.”
     - Kártyánként: `name`, `summaryLine`, `impactLabel`.
   - Játékoslista: `playerReport.players`, a `@core` sorrendjében
     (`impactScore` szerint csökkenő).
     - Sor: `name`, `summaryLine`, két badge (`impactLabel`, `usageLabel`), és
       mono számok: „TS `tsPct.toFixed(1)`%” (ha `!hasShotAttempts`, akkor
       „–”), „VAL `val`”, „VAL/36 `valPer36.toFixed(1)`”.
     - Kinyitva három oszlop, mobilon egymás alatt:
       - Erősségek: `strengths`. Üres állapot: „Nincs kiemelt erősség.”
       - Limitációk: `issues`. Üres állapot: „Stabil végrehajtás.”
       - Fókusz: `focus`. Üres állapot: „Fenntartandó teljesítmény.”
   - **Mentett játékos-szöveg (csak olvasás).** A web az LLM értékelést a
     `player_game_text_reports` táblába menti, `UNIQUE (game_id, player_id)`,
     oszlopok: `narrative`, `breakdown jsonb`, `generated_at`. A mobil egy
     lekérdezéssel olvassa:
     `.from('player_game_text_reports').select('player_id, narrative, generated_at').eq('game_id', gameId)`.
     Ha az adott játékoshoz van sor, a kinyitott sorban `ai-marker` blokkban
     jelenik meg „Mentve: <dátum>” címkével. A webes `GameDetails.tsx` ezt
     bejelentkezett felhasználóként olvassa, tehát az RLS engedi.
     **Generálás gomb nincs a mobilon**, mert az admin API route, és a mobil
     scope-on kívül esik.
   - A webes Usage–TS% buborékdiagram és az „utolsó 8 meccs trend” mobilon
     **v2**.

10. **Erősségek / Problémák / Következő fókusz (v1).** `report.strengths`,
    `report.problems`, `report.nextFocus`, egyszerű pontlisták
    (`PointList`). Üres állapotok:
    - Erősségek: „Nincs kiemelt erősség.”
    - Problémák: „Nincs kiemelt probléma.”
    - Következő fókusz: „Nincs kiemelt fókuszpont.”

11. **Mentett AI szöveg (már kész).** A meglévő `game_text_reports` postgame
    riport kártya változatlanul marad. Ha az elemzés külön alroute-ra kerül,
    ott is megjelenhet a végén.

## 4. Formázási és nyelvi szabályok

- A `@core` postgame-szövegei (`summary`, `strengths`, `problems`,
  `nextFocus`, a döntő tényezők, `playerReport` mondatai) tartalmaznak `→` és
  `≈` jelet (a `postgame-report.ts`-ben 11 helyen). A mobil betűkészletekben
  ezek nincsenek meg, ezért **minden átvett szöveg menjen át a
  `plainText`-en** (D-064).
- Minden szám JetBrains Mono, `tabular-nums`. A százalékok 1 tizedessel és
  `%` jellel, a deltaértékek előjellel és `pp` egységgel jelennek meg.
- A számok a `lib/format` helpereivel formázandók (`formatDecimal`,
  `formatSigned`), ne kézzel.
- A `report.summary`, `strengths` és a többi szöveg szabályalapú, **nem AI
  tartalom**. Nem kap `ai-marker`-t vagy lila jelölést. Az AI jelölés csak a
  mentett LLM-szövegeké (9. és 11. pont).

## 5. Tudatosan kihagyva a mobil v1-ből

> **Frissítés (2026-09-26):** a Kosarstat-kiegészítés (első pont) azóta a
> `@core`-ban van, és bekerülhet a mobil v1-be. Lásd:
> `2026-09-26-postgame-kosarstat-core.md`.

Ezek a webes kiegészítések a `SeasonComparison.tsx` komponensben élnek, nem a
`@core`-ban. Mobilon csak duplikált logikával lennének meg:

- **Kosarstat-kiegészítés.** A web negyed-trendből (legjobb/legrosszabb
  negyed ±6, második félidő ±8), kosarstat eFG/TO%/ORB% különbségből,
  clutch-ból és TO-típusokból további sorokat fűz a `strengths`, `problems`,
  `nextFocus` és `dataNotes` listákhoz (`mergeUnique`, kis- és nagybetűre
  érzéketlen dedup). Ezek adatai (negyedek, four factors, clutch) a mobil meccs
  részletein **már saját panelen látszanak**, ezért a v1-ben nem hiányoznak.
- **Lineup-elemzés** (`lineupInsights`, ötösök, párosok, rotációs timeline).
  Ez a kosarstat nyers PBP webes parszolásából jön.
- „Kosarstat only” kapcsoló, Markdown export, LLM generálás.

Ha ezek kellenek mobilon, a helyes út: a webes logikát előbb a `@core`-ba
kell kiszervezni (pl. `buildKosarstatPostgameContext()` a
`lib/postgame-report.ts`-ben), és utána jöhet a `sync:core`. Ez **külön webes
döntés és feladat**, ne a mobilban implementáld újra.

## 6. Elfogadási ellenőrzés

- 2025/2026, ASE: egy kosarstat-importos és egy import nélküli meccs. A
  `summary`, a 6 kulcsmutató `game/season/delta` értéke és a döntő tényezők
  listája egyezik a web Szezon összehasonlítás → Post-game nézetével. A
  kosarstat-eredetű plusz sorok várhatóan hiányoznak (5. pont).
- Olyan meccs, ahol nincs ellenfél box score: megjelenik a `dataNotes`
  figyelmeztetés, és nincs védekezési csoport.
- Olyan meccs, ahol nincs Hunbasket shot chart: a 6. szekció nem jelenik meg,
  és nincs hiba.
- `→`/`≈` nem jelenik meg üres négyzetként.
- iOS és Android `npx expo export` hiba nélkül lefut.

## Teendő a mobil repóban

- [ ] Helydöntés: alroute (`games/[id]/postgame`) vagy szekció a meccs
      részletein. Rögzítsd döntésként a `docs/feature-tasks.md`-ben.
- [ ] `hooks/usePostgameAnalysis.ts`:
  - saját és ellenfél box score (ellenfél `games` sor a 2.3 szerint);
  - `useTeamSeasonData` a liga-mezőnyhöz;
  - opcionális shot-context (2.5) és `player_game_text_reports`.
  - A számítás `useMemo`-ban fusson, a cache kulcsa `gameId`.
- [ ] `lib/postgame-view.ts` (tiszta modul, a `roles-view` mintájára):
  - magyar feliratok;
  - delta-tónus (TO rate fordítva);
  - `isNegativeDecisiveLabel`;
  - döntő-tényező csoportosítás;
  - `plainText`;
  - formázott sorok.
- [ ] UI szekciók a 3. pont (v1) szerint, meglévő komponensekkel:
  `StatTile`, `SplitMetricRow`, `MeterList`, `PointList`, `GlowCard`,
  `StackedRow`.
- [ ] Üres és hibaállapotok: nincs saját box score, nincs szezonadat, nincs
      ellenfél, nincs shot chart.
- [ ] Ellenőrzés a 6. pont szerint.

## Kézi lépések

Nincs. Nincs migráció, újraimport vagy `sync:core`.
