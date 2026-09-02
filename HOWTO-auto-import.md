# HOWTO – Automatikus hétvégi adatimport (GitHub Actions)

Az ütemezett import a `.github/workflows/scrape.yml` workflow, amely szombat/vasárnap
22:00 UTC-kor (és kézzel, `workflow_dispatch`-csel) futtatja a CLI scrape szkripteket:

1. `npm run hunbasket:fixtures` – menetrend
2. `npm run hunbasket:standings` – tabella
3. `npm run hunbasket:import` – box score
4. `npm run kosarstat:pbp` – play-by-play

Ha bármelyik lépés `exit code 1`-gyel áll le, a teljes run **error** lesz.

---

## 1. A hibaüzenet a warningtól független

```
Node.js 20 is deprecated. ... forced to run on Node.js 24
```

Ez **csak figyelmeztetés**, nem ez okozza a bukást. A `actions/checkout` és
`actions/setup-node` régi major verzióját használjuk, a GitHub átmenetileg
Node 24-en futtatja őket. A run ettől még sikeres lehet. (Javítása: lásd 5. pont.)

A tényleges hiba mindig egy konkrét lépésben van – **először azt kell megnézni,
melyik lépés bukott el.**

### Hol nézd meg

GitHub → **Actions** fül → *Adatimport (Hunbasket + Kosarstat)* → a piros run →
kattints a `scrape` jobra → nyisd ki azt a lépést, ahol a piros ✗ van.

---

## 2. Kötelező secretek

A `scrape.yml` job a **`production` environmentet** használja (`environment: production`),
ezért a secretek **kétféleképp** adhatók meg:

- **Environment secret** a `production` environment alatt:
  **Settings → Environments → production → Environment secrets** (a jelenlegi setup)
- vagy **Repository secret**:
  **Settings → Secrets and variables → Actions → Secrets → New repository secret**

> Ha a secretek egy environment alatt vannak, a jobnak **kötelező** deklarálnia
> az `environment:`-et – enélkül a `${{ secrets.* }}` üres. Fordítva: environment
> protection rule-ok (kötelező review, wait timer, branch-korlát) **blokkolhatják
> az ütemezett futást**, ezért a `production` environmenten ne legyen ilyen szabály,
> vagy tedd a secreteket repo szintre.

| Név | Honnan | Megjegyzés |
|-----|--------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Settings → API → Project URL | pl. `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Settings → API → `service_role` secret | **titkos**, teljes jogú kulcs |

Ha ezek közül **bármelyik hiányzik vagy elgépelt**, a szkriptek már az első
Supabase-hívás előtt leállnak ezzel:

```
Hiányzó Supabase env változók (.env.local: NEXT_PUBLIC_SUPABASE_URL + kulcs).
```

(Forrás: `scrape-utils.ts` → `createScriptClient()`.)

> A `.env.local` a fejlesztői gépen van; a GitHub Actions runner **nem látja**,
> csak a repo secreteket. Attól, hogy lokálban megy az import, a CI-ban még
> hiányozhat a secret.

### Ellenőrzés elgépelés ellen

- A secret neve pontosan `NEXT_PUBLIC_SUPABASE_URL` (nem `SUPABASE_URL`).
- Az érték elején/végén **ne legyen szóköz vagy idézőjel**.
- A `service_role` kulcs a hosszú JWT, ami `eyJ...` – NEM az anon kulcs.
- Secret értékét nem lehet visszaolvasni; ha kétség van, **hozd létre újra**
  (Update / új secret ugyanazzal a névvel).

---

## 3. Opcionális repo variables (szezon)

**Settings → Secrets and variables → Actions → Variables → New repository variable**

| Név | Default (ha nincs beállítva) | Mikor kell átírni |
|-----|------------------------------|-------------------|
| `HUNBASKET_SEASON_SLUG` | `x2526` | Új szezonnál, pl. `x2627` |
| `HUNBASKET_SEASON_NAME` | `2025/2026` | Új szezonnál, pl. `2026/2027` |
| `KOSARSTAT_SEASON_CODE` | `2526` | Új szezonnál, pl. `2627` |
| `KOSARSTAT_SEASON_NAME` | `2025/2026` | Új szezonnál, pl. `2026/2027` |

> **FONTOS – szezonváltás:** ha a `HUNBASKET_SEASON_NAME` értéket új szezonra
> állítod, **előbb létre kell hozni a `seasons` táblában a megfelelő sort**
> (`name`, `start_date`, `end_date`) + a szezonspecifikus stat-táblát és a
> `lib/season-tables.ts` bővítést – lásd `HOWTO-uj-szezon.md`.
> Különben a fixtures import ezzel bukik:
> ```
> Season not found: 2026/2027
> ```
> Ez tipikus „minden hétvégén error" tünet, ha nemrég váltottunk szezont, de a
> DB előkészítés kimaradt.

A `KOSARSTAT_SEASON_NAME`-et a workflow jelenleg **nem adja át** – ha kell,
a `scrape.yml` `env:` blokkját bővíteni kell (lásd 5. pont).

---

## 4. Gyakori hibaokok lépésenként

| Tünet a logban | Ok | Megoldás |
|----------------|-----|----------|
| `Hiányzó Supabase env változók` | hiányzó/rossz secret | 2. pont |
| `Season not found: <név>` | a `seasons` sor nincs meg | `HOWTO-uj-szezon.md` |
| `a beolvasott dátumok kívül esnek a szezon tartományán` | rossz `SEASON_SLUG` ↔ `SEASON_NAME` párosítás | 3. pont – a slug és a név ugyanarra a szezonra mutasson |
| `Feloldatlan csapat: ...` | új klubnév a hunbasket oldalon | `scrape-utils.ts` `TEAM_NAME_ALIASES` bővítése |
| `Timeout` / `net::ERR_` | hunbasket.hu vagy kosarstat.hu lassú/elérhetetlen | újrafuttatás (`Re-run failed jobs`) |
| `relation "player_game_stats_2026_2027" does not exist` | új szezon migráció kimaradt | `HOWTO-uj-szezon.md` |
| Supabase `project is paused` | free tier projekt inaktivitás miatt szüneteltetve | Supabase dashboard → Restore project |

**Újrafuttatás:** a piros run oldalán jobbra fent **Re-run jobs → Re-run failed jobs**.
Az importok idempotensek (upsert), a dupla futás nem termel duplikátumot.

---

## 5. Karbantartás a workflow-n

Kész (2026-09-02):

- [x] **Node deprecation warning megszüntetése** – `actions/checkout@v5`,
  `actions/setup-node@v5`, `node-version: 22`.
- [x] **Preflight secret-ellenőrzés lépés** a setup-node után (`Env ellenőrzés`):
  érték nélkül, csak a hosszt kiírva jelzi, ha hiányzik a secret – így a log
  azonnal megmondja az okot, a scrape lépések futása előtt.

Még hátra (külön döntés):

- [ ] **`continue-on-error: true`** a nem kritikus lépéseken (pl. kosarstat), hogy
  egy forrás kiesése ne buktassa az egész importot.
- [ ] **Hiba-értesítés** (pl. GitHub Issue nyitása vagy e-mail) a job végére, ha
  elbukott.
- [ ] **Szezon-előkészítés 2026/2027** – `seasons` sor + stat-tábla migráció +
  `lib/season-tables.ts` + repo variable-ök (`HOWTO-uj-szezon.md`).
