# Játékosmozgások

A dashboard **Igazolások** menüpontja a kiválasztott célszezon keretét az
előző szezonéval hasonlítja össze. A csapatszűrő ezen a lapon az **Összes
követett csapat** lehetőséget is kínálja. Minden bejelentkezett felhasználó
olvashatja; az Import tabon csak admin indíthat frissítést.

## Élesítés

1. Új adatbázisban először az `migrations/add-league-player-movements-tables.sql`
   futtatandó a **Supabase SQL Editorban**. A jelenlegi projektben a három
   alaptábla már létezik és fel van töltve.
2. Teljes bajnokság-import: `npm run kosarstat:team-players`. A jelenlegi
   adatbázisban 2026-09-21-én sikeres volt: **14 csapat, 473 játékos,
   847 játékos–csapat–szezon sor**, 2023/24–2026/27.
3. Futtasd a **Supabase SQL Editorban** a teljes
   `migrations/add-league-player-movements-view.sql` fájlt. Ez egy
   `security_invoker` nézetet hoz létre, bejelentkezett olvasási joggal.
   A fájl végén ellenőrző összesítés van. A fejlesztői SQL-teszt kizárólag
   a SELECT-et futtatja, **nem telepíti a view-t**.
4. A weben nyisd meg az Igazolások menüpontot, válaszd a 2026/2027-es
   szezont és az Atomerőmű SE-t. Az első import alapján **4 érkező,
   9 távozó** várható; Yasiin Joseph Albáról érkezik, Jay Jay Chandler
   egy kihagyott szezon után tér vissza. Ezek a forrás frissülésével változhatnak.

## Forrás és import

A tényadat a Kosarstat szezonos csapatoldaláról származik:
`https://kosarstat.hu/teams/team/boxstats/?team=<ID>&season=<kód>`.
A csapatarchívum első/utolsó éve **nem folytonos csapattagság**, ezért abból
nem töltünk ki köztes szezonokat. Egyedi játékosprofilokat nem járunk be.

A követett klubok a legújabb, már megkezdett adatbázisbeli szezon
`league_fixtures` menetrendjéből jönnek; ezt előbb importálni kell.
A kosarstat csapatlista saját név-aliasait használjuk, kétértelmű egyezésnél
az import megáll. A `kosarstat_team_map` kézi bejegyzése elsőbbséget élvez.
DEAC: `team=119`; OSE: `team=155`. Új klub nem keletkezik automatikusan.

A teljes forrásellenőrzés megelőzi az írást. Az import upsertel, nem töröl
korábbi tagságot; forrásoldali utólagos visszavonás/javítás külön ellenőrzést
igényel. Adatbázishiba esetén a három upsert nem tranzakciós: a hiba elhárítása
után a teljes import újrafuttatandó. Teljes liga-besoroláshoz minden csapatot
importálni kell; egy részleges, szűrt első import nem teljes bajnokság.

```bash
# Teljes frissítés (alapértelmezett: utolsó négy megkezdett szezon)
npm run kosarstat:team-players

# Írás nélküli ellenőrzés
KOSARSTAT_MOVEMENT_DRY_RUN=1 npm run kosarstat:team-players

# Egy csapat, három szezon
KOSARSTAT_TEAM_FILTER=Atomerőmű KOSARSTAT_MOVEMENT_SEASON_COUNT=3 npm run kosarstat:team-players
```

Az U23 jelölésből nem következtetünk hazai/légiós státuszra; ilyenkor a
státusz NULL. Születési évet a szezonos életkorból nem számolunk. A legújabb
szezon kerete a még pályára nem lépett játékosokat is tartalmazhatja.

## Értelmezés

- Mindkét irány a **célszezonhoz** tartozik: 2026/27 alatt a 2025/26 → 2026/27
  váltás érkezői és távozói látszanak.
- Az első importált szezon viszonyítási alap; előző keret nélkül nincs
  megbízható érkezéslista. Hiányzó következő szezonból nem számolunk távozást.
- A hazai váltás másik **követett** klubot jelent. A visszatérés a követett
  csapatok közé értendő, nem feltétlenül ugyanahhoz a klubhoz.
- Az ismeretlen cél/eredet lehet külföld, alsóbb osztály vagy adathiány.
  Konkrét külföldi klubot/országot nem állítunk.
- Több csapat/szezon esetén minden ismert ellenoldali klub megjelenik;
  a szezonon belüli mozgás sorrendje nem állapítható meg.
- Új cron-feladat nincs; az automatikus ütemezés külön döntés.

## Ellenőrzések

```bash
node --import tsx --test tests/kosarstat-movement-source.test.ts tests/player-movements.test.ts
# psql és DATABASE_URL / SUPABASE_DB_URL szükséges; csak READ ONLY tranzakció
node --test tests/league-player-movements.test.mjs
npm run lint
npx tsc --noEmit
npm run build
```

A böngészős ellenőrzéshez a view SELECT valódi eredményét használtuk
helyettesített HTTP-válaszként; az éles view/RLS végső ellenőrzése a kézi
migráció után végezhető el.
