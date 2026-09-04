# HOWTO – Élő mérkőzés-gyűjtő (`live-scan`)

Ez a funkció a mobil app "élő mérkőzés" nézetét szolgálja ki. Három új tábla
(`live_games`, `live_player_lines`, `live_quarter_scores`) + egy Supabase Edge
Function (`live-scan`), ami percenként lekérdezi az MKOSZ élő jegyzőkönyvét
és beírja az aktuális állást, negyedeket és box score-t.

**Egyik lépés sincs élesítve.** A migráció és az Edge Function elkészült, de
sem az SQL nem futott le a Supabase-ben, sem a függvény nincs deployolva –
ez a CLI-hez és a Supabase projekthez hozzáféréssel rendelkező embernek a
feladata (lásd lent).

---

## 1. Migráció futtatása

A `migrations/*.sql` a projekt konvenciója szerint **kézzel, a Supabase SQL
Editorban** fut, nem a kódbázisból (lásd `CLAUDE.md`).

1. Nyisd meg a Supabase Dashboardot → SQL Editor
2. Másold be a `migrations/add-live-match-tables.sql` teljes tartalmát
3. Futtasd le
4. Ellenőrzés: `select * from live_games limit 1;` nem ad hibát (üres eredmény oké)

## 2. Az Edge Function deploy-olása

Előfeltétel: `supabase` CLI telepítve (ez a gépen már megvan, `2.24.3`), és
be vagy jelentkezve a Supabase fiókkal (`supabase login`), a projekt pedig
linkelve.

```bash
cd asestats
supabase link --project-ref iipcpjczjjkwwifwzmut   # ha még nincs linkelve
supabase functions deploy live-scan --use-api
```

**`--use-api` kötelező, ha nem fut Docker.** A CLI alapból (`--use-docker`,
default `true`) lokális Docker konténerben bundle-öli a függvényt, és Docker
Desktop nélkül ezzel a hibával áll le:

```text
failed to inspect docker image: Cannot connect to the Docker daemon
```

A `--use-api` a Supabase Management API-val bundle-öli szerveroldalon –
nincs Docker-igény. (Alternatíva: `brew upgrade supabase` – az újabb CLI
alapból API-val bundle-öl.)

> **Státusz:** 2026-09-04-én deployolva `--use-api`-val a
> `iipcpjczjjkwwifwzmut` projektre. Újbóli deploy csak kódváltozáskor kell.

A függvény a `SUPABASE_URL` és `SUPABASE_SERVICE_ROLE_KEY` platform-injektált
secreteket használja – ezeket a Supabase automatikusan beteszi minden
deployolt Edge Functionbe, **külön `supabase secrets set` nem kell**.

**Fontos:** a deploy alapból bekapcsolt JWT-ellenőrzéssel megy
(`verify_jwt = true`). Ez szándékos – a hívónak (a lenti `pg_cron` jobnak)
érvényes service role Bearer tokent kell küldenie. Ha kézzel akarod tesztelni:

```bash
curl -i --request POST \
  'https://<project-ref>.supabase.co/functions/v1/live-scan' \
  --header 'Authorization: Bearer <SERVICE_ROLE_KEY>'
```

A válasz JSON-ban összegzi, mit talált (`liveMatchesFound`, `processed`,
`skipped` – ok-indoklással, `finalized`, `purged`).

## 3. Ütemezés – `pg_cron` + `pg_net`

Az alábbi SQL-t **a Supabase SQL Editorban** kell lefuttatni (ugyanúgy kézzel,
mint a migrációt). Előbb ellenőrizd, hogy a két extension engedélyezve
van-e: Dashboard → Database → Extensions → `pg_cron` és `pg_net` bekapcsolva.
**Ez ellenőrizendő, mielőtt bármi mást csinálnál** – ha nincs meg egyik sem,
a Supabase Pro csomagtól függően engedélyezhető a Dashboardról, vagy
`create extension if not exists pg_cron; create extension if not exists pg_net;`
paranccsal (superuser jogot igényelhet, a Dashboard extension-kapcsolója a
biztosabb út).

```sql
-- A <project-ref> és <service-role-key> helyére a saját projekt adatai kellenek.
-- A service role kulcsot NE commitold be sehova – csak ide, a Supabase saját
-- SQL Editorába írd be egyszer.
select cron.schedule(
  'live-scan-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/live-scan',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <service-role-key>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

A függvény saját maga dönti el, hogy van-e teendő (ha nincs `is_current`
szezon vagy nincs élő mérkőzés az `/elo` oldalon, gyorsan visszatér) – ezért
biztonságos a percenkénti ütemezés akkor is, ha épp nincs meccs.

Leállítás: `select cron.unschedule('live-scan-every-minute');`

### Miért nem GitHub Actions vagy Vercel cron

- GitHub Actions cron minimum ~5 perces felbontású és nem megbízható időzítésű
  – élő meccshez túl ritka és túl bizonytalan.
- Vercel cron a hobby csomagban napi 1-2 futásra korlátozott, Pro csomag
  kellene a percenkéntihez, és az még mindig külön infra a meglévő Supabase
  mellett.
- A `pg_cron` a meglévő Supabase projektben fut, nincs új szolgáltatás.

---

## 4. Amit a forrásból SZIGORÚAN, a saját kódjukból megerősítve tudunk

A `supabase/functions/live-scan/index.ts` fejléc-kommentje és a kódban lévő
inline kommentek részletezik, de összefoglalva – a `netcasting*.webpont.com`
kliens saját `js/1.n6.js` fájljából (`filmCode2Text.hun`, `alkodok`,
`addEvent()` switch, `getTimeStrFromGT()`):

- **Állás**: `i.hp` / `i.vp` – közvetlen mező, nem kell számolni.
- **Esemény-kódok** (a `f` tömb `"2"` mezője): 1000=sikeres dobás,
  1001=sikertelen dobás, 1002=védőlepattanó, 1003=támadólepattanó,
  1004=szerzett labda, 1005=eladott labda, 1007=fault, 1008=gólpassz,
  1009=blokk, 1020=technikai fault.
- **Dobás-altípus és pontérték** (a `"6"` mező, `alkodok` térkép):
  1=közeli(2), 2=középtávoli(2), 3=hárompontos(3), 4=büntető(1), 5=zsákolás(2).
- **Csapatoldal**: a `"1"` mező (`"1"` = hazai, minden más = vendég).
- **Játékoskód**: a `"3"` mező, feloldható a `players.home`/`players.away`
  roster-tömbre (`Jatekos` kód → `nev`, `mez`).
- **Negyed + óra**: `getTimeStrFromGT(gt)` alapján, ahol `gt` az utolsó
  esemény `"gt"` mezője (eltelt másodperc a meccsben): `negyed = ceil(gt/600)`,
  `óra = gt % 600` másodpercből MM:SS, **NÖVEKVŐ** (nem visszaszámláló).
- **Vége jelzés**: a top-szintű `jr` mező `2`, ha a meccs véget ért (a
  kliens saját `endGame = true` logikája ezt nézi).

## 5. Amit ÉLŐ MECCSEN kell validálni (2026-09-25 után)

Ezek nem feltételezések, hanem konkrét, még nyitott kérdések – a fenti pontok
mind a JS forrásból be vannak bizonyítva, de egy 2021-es archív (befejezett)
meccsen lettek leellenőrizve, nem egy ténylegesen futó meccsen élőben:

1. **A `/elo` oldal jelenlegi HTML-szerkezete** – a "Élő mérkőzések" /
   "Befejezett mérkőzések" szövegjelölők és a `class="live-game"` linkek
   formátuma öt éve nem változott a kapott mintákon, de ez nem garancia.
   Ha a `parseLiveMatchLinks()` üres listát ad futó meccs mellett, ez az
   első ellenőrzendő pont.
2. **Az óra valós viselkedése** – a `getTimeStrFromGT()` képlet a forrás
   SAJÁT függvénye, de nem láttuk működés közben. Ha a mobil UI-n az óra
   nyilvánvalóan rossz (pl. visszafelé számol, vagy negyedhatáron ugrik),
   a `formatClock()`/`period` számítást kell újragondolni.
3. **Percek (`minutes`)** – v1-ben mindig 0. A csereesemény (kód `1011`,
   `data[3]`=kimenő, `data[4]`=bejövő játékoskód) párosításából
   kiszámítható lenne, de ez külön feladat.
4. **Félidő** – nincs azonosított explicit "félidő" jelző a forrásban, a
   `status` v1-ben csak `'live'`/`'final'` lehet ténylegesen (a `'halftime'`
   és `'scheduled'` érték a sémában megvan, de a gyűjtő nem írja).
5. **Csapatnév-egyezés** – ha a `findTeamByName()` nem talál egyezést (a
   forrás névalakja eltér a `teams` tábla nevétől), a meccs hangosan
   kimarad (`console.warn` + a válasz `skipped` tömbje) – ellenőrizd az
   Edge Function logját az első élő futásnál.
6. **Rate limit / etikett** – percenkénti kérés a hunbasket.hu-ra és a
   netcasting szerverre. Ha ez problémát okozna (429, IP-tiltás), a
   `pg_cron` ütemezés ritkítható (`*/2 * * * *`).

## 6. Fejlesztői teszt migráció nélkül is

A mobil app (`asestatmobile`) oldala kézzel feltöltött sorokkal tesztelhető,
amíg a fentiek nincsenek élesítve:

```sql
insert into live_games (season_id, home_team_id, away_team_id, home_team_name,
  away_team_name, home_score, away_score, period, clock, status, source_code)
values (
  (select id from seasons where is_current = true limit 1),
  (select id from teams where is_primary = true limit 1),
  (select id from teams where is_primary = false limit 1),
  'Teszt Hazai', 'Teszt Vendég', 42, 38, 3, '05:12', 'live', 'teszt_1'
);
```
