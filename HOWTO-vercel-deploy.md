# HOWTO – Vercel deploy

Ez a leírás a projekt Vercelre telepítését és a telepítés közben előjövő
tipikus hibákat fedi.

---

## 1. A `npm error ENOENT ... mkdir '/home/sbx_user…'` hiba

```
npm error code ENOENT
npm error syscall mkdir
npm error path /home/sbx_user1051
npm error enoent Invalid response body while trying to fetch
  https://registry.npmjs.org/tsx: ENOENT: no such file or directory,
  mkdir '/home/sbx_user1051'
npm error Log files were not written due to an error writing to the
  directory: /home/sbx_user1051/.npm/_logs
```

**Ez nem a kódbázis hibája.** Az npm a `$HOME` alá (`~/.npm`) akarja tenni a
csomag-cache-t és a logot, a Vercel build-sandbox `$HOME`-ja
(`/home/sbx_user…`) viszont nem létezik vagy nem írható. Emiatt már az első
csomag letöltése is elhasal – a `tsx` csak véletlenül az első a sorban, nem ő
a hibás.

**Repó oldali javítás (már bent van):** a `vercel.json` felülírja az install
parancsot, és a `/tmp`-be tereli a cache-t (a `/tmp` a build sandboxban mindig
írható):

```json
{
  "installCommand": "npm install --cache /tmp/.npm --prefer-offline --no-audit --no-fund",
  "buildCommand": "NEXT_TELEMETRY_DISABLED=1 next build"
}
```

A `NEXT_TELEMETRY_DISABLED=1` ugyanezt a problémát előzi meg a build lépésben:
a Next telemetria szintén a home könyvtárba írna.

**Ha a `vercel.json` ellenére is jön a hiba**, a Vercel projekt beállításaiban
kell nézelődni:

1. **Settings → Environment Variables** – ha van itt saját `HOME`,
   `NPM_CONFIG_CACHE` vagy `npm_config_cache` változó, töröld. Egy rosszul
   megadott érték pontosan ezt a hibát okozza.
2. **Settings → Build & Deployment → Install Command** – ha itt van kézzel
   beírt override, az erősebb a `vercel.json`-nál. Vagy ürítsd ki (hogy a
   `vercel.json` érvényesüljön), vagy írd bele ugyanazt a parancsot.
3. **Deployments → … → Redeploy** – vedd ki a *Use existing build cache*
   pipát. Egy korábbi, sérült cache-réteg is visszahozhatja a hibát.
4. **Settings → Build & Deployment → Node.js Version** – legyen 22.x
   (a Next 16 miatt minimum 20.x; a GitHub Actions scrape workflow is Node 22).

---

## 2. Kötelező környezeti változók a Vercelen

A `.env.local.example` a forrás. A Vercel **Settings → Environment
Variables** alatt legalább ezek kellenek (Production + Preview):

| Változó | Megjegyzés |
|---------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | publikus |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publikus |
| `SUPABASE_SERVICE_ROLE_KEY` | **titkos**, csak szerver |
| `OPENAI_API_KEY` *vagy* `ANTHROPIC_API_KEY` | AI riportokhoz; Claude esetén `AI_PROVIDER=claude` is |

A `NEXT_PUBLIC_*` változók beépülnek a kliens bundle-be, ezért hiányuk nem
futásidejű hiba, hanem **hibás build** – a bejelentkezés néma 500-zal hasal el.

---

## 3. Ami Vercelen nem fog működni

- **A 4 spawn-alapú import route** (`hunbasket-fixtures-import`,
  `hunbasket-roster-import`, `hunbasket-round-import`,
  `kosarstat-team-players-import`) a `lib/run-script.ts`-en keresztül `npx tsx`
  gyerekfolyamatot indít, az pedig Playwright böngészőt nyit. Serverless
  függvényben ez nem megy (nincs `npx`, nincs böngésző-binary, nincs elég
  futásidő). Ezek az importok a **GitHub Actions** (`.github/workflows/scrape.yml`)
  vagy lokális CLI útvonalon futnak – lásd `HOWTO-auto-import.md`.
- A `maxDuration = 300` deklarációkat a csomagod (Hobby/Pro) felülről
  korlátozhatja; a hosszú riportgenerálás timeoutolhat.

A `playwright` a `dependencies` között van, pedig az app kódja sehol nem
importálja (csak a gyökérszintű `scrape-*.ts` CLI szkriptek). Ez így is
működik – a Vercel a `devDependencies`-t is telepíti a buildhez, tehát az
áthelyezés nem gyorsítaná a telepítést, csak a besorolás lenne pontosabb.
Külön döntés kérdése, most nincs megcsinálva.
