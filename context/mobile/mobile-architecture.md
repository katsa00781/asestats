# ASEStats Mobile – Architektúra

_Létrehozva: 2026-08-30 · Státusz: terv (S1)_

---

## Alapelv: a webes app nem sérülhet

A mobil bevezetése **nulla változtatást igényel** az `app/`, `components/`, `lib/`, `hooks/` mappákban. Ez nem udvariasság, hanem kockázatkezelés: a web az élő, használt rendszer, a mobil pedig zöldmezős. Minden architekturális döntést ez az invariáns vezérel.

---

## Repo alak: izolált `mobile/`, npm workspace nélkül

```
asestats/
├── app/  components/  lib/  hooks/  migrations/  scripts/   ← VÁLTOZATLAN
├── package.json                                             ← VÁLTOZATLAN
└── mobile/                                                  ← új, saját node_modules
    ├── app/                        # expo-router, file-based
    │   ├── _layout.tsx             # AuthProvider + fontok + SafeAreaProvider
    │   ├── login.tsx
    │   └── (tabs)/
    │       ├── _layout.tsx         # 5 tab definíció
    │       ├── index.tsx           # Ma
    │       ├── jatekosok/
    │       ├── meccsek/
    │       ├── tabella.tsx
    │       └── elemzes/
    ├── components/                 # RN komponensek (StatTile, StackedRow, StatMatrix…)
    ├── lib/
    │   ├── supabase.ts             # RN-specifikus kliens
    │   └── auth-context.tsx        # RN port
    ├── hooks/                      # useGameData / useFilterData port
    ├── theme/tokens.ts             # a Dark Command Center tokenek JS-ben
    ├── metro.config.js
    ├── tailwind.config.js          # NativeWind
    ├── tsconfig.json
    └── package.json
```

### Miért nem npm workspaces

A kézenfekvő lépés a `apps/web` + `apps/mobile` + `packages/core` átrendezés lenne. Ezt **elvetettük**:

- 30+ fájl mozgatása és minden `@/`-import átírása a működő webes appban – pont az az invariáns sérülne, amit védeni akarunk.
- Hoisting-ütközés: a web React 19-et használ, az Expo SDK a saját, pinnelt React verzióját várja. Egyetlen hoistolt `node_modules/react` mindkettőnek nem jó.
- A workspace root átalakítása a `package.json` scripteket, a CI-t (`.github/workflows/scrape.yml`) és a `tsx` scraping-szkriptek futtatását is érinti.

Az izolált forma **azonnal visszavonható** (`rm -rf mobile/`), és mivel a megosztandó mag bizonyítottan függőségmentes (lásd lentebb), a megosztás egyetlen Metro alias-szal megoldható.

**Promóciós út:** ha a megosztás később a UI-ra vagy a scraping-re is kiterjed, innen egy lépésben promotálható valódi workspace-re. Addig nem fizetjük meg az árát.

---

## A megosztott mag

### Bizonyíték: a `lib/` elemző modulok tiszták

Import-audit eredménye – ezek a modulok **nulla külső importot** tartalmaznak, csak egymást importálják:

| Modul | Sor | Külső import |
|---|---|---|
| `stat-formulas.ts` | 52 | — |
| `positions.ts` | 145 | — |
| `terminology.ts` | 376 | — |
| `style-vocabulary.ts` | 23 | — |
| `season-tables.ts` | 20 | — |
| `fetch-all-rows.ts` | 20 | — |
| `situational-analysis.ts` | 322 | — |
| `kosarstat-clutch-parse.ts` | 304 | — |
| `postgame-report.ts` | 1 877 | — |
| `dashboard-types.ts` | 126 | `./player-analysis` |
| `player-stat-mapping.ts` | 108 | `./dashboard-types`, `./stat-formulas` |
| `player-analysis.ts` | 1 603 | `./positions`, `./stat-formulas` |
| `player-postgame.ts` | 471 | `./postgame-report`, `./stat-formulas` |
| `pregame-scouting.ts` | 2 266 | `./positions`, `./style-vocabulary` |
| `team-analysis.ts` | 1 753 | `./player-analysis`, `./style-vocabulary` |

**Összesen ~9 500 sor** üzleti logika: se React, se Next, se DOM, se Supabase. Módosítás nélkül futtatható React Native alatt.

> Megjegyzés: a `situational-analysis.ts` egy naiv DOM-grepen fals pozitívot ad, mert a 260. sorban van egy `window` nevű **lokális változó** (`const windowWins = window.filter(...)`). Nem `globalThis.window`.

### Mi NEM megosztott

| Modul | Miért nem |
|---|---|
| `lib/supabase.ts` | Böngésző-kliens; RN-ben AsyncStorage adapter és URL polyfill kell |
| `lib/auth-context.tsx` | React context DOM-feltételezésekkel; RN port készül, azonos szerződéssel |
| `lib/api-fetch.ts`, `lib/api-auth.ts` | Az API route-ok admin-only mutálók, a mobil nem hívja őket |
| `lib/chart-theme.ts` | Recharts/Chart.js-specifikus; a Skia rétegnek saját megfelelője lesz |
| `lib/export-to-md.ts` | Fájlletöltés böngésző-szemantikával |
| `lib/supabase-admin.ts`, `lib/run-script.ts`, `lib/ai-client.ts` | Szerveroldali |
| `components/*` (31 583 sor) | Teljes RN újraírás |

### Konfiguráció

```js
// mobile/metro.config.js
const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')
const path = require('path')

const projectRoot = __dirname
const repoRoot = path.resolve(projectRoot, '..')

const config = getDefaultConfig(projectRoot)

// A gyökér lib/ mappát figyelni kell, különben Metro nem látja a változásait
config.watchFolders = [path.resolve(repoRoot, 'lib')]

// A @core alias a megosztott elemző magra mutat
config.resolver.extraNodeModules = {
  '@core': path.resolve(repoRoot, 'lib'),
}

// A mobil SAJÁT node_modules-ából oldjon fel - ne a gyökérből
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')]

module.exports = withNativeWind(config, { input: './global.css' })
```

```json
// mobile/tsconfig.json (részlet)
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./*"],
      "@core/*": ["../lib/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", "../lib/**/*.ts"]
}
```

Használat:

```ts
import { trueShootingPct, effectiveFgPct } from '@core/stat-formulas'
import type { PlayerStats, TeamGame } from '@core/dashboard-types'
import { getSeasonStatsTable } from '@core/season-tables'
```

> **Az S3 sprint első feladata füstteszt erre.** Egy `@core/stat-formulas` import futtatása a szimulátorban, mielőtt bármi másra építenénk. Ha a Metro alias nem működik, a fallback az npm workspace-re promotálás – jobb ezt az első órában tudni, mint a tizedik képernyőnél.

---

## Adatréteg

### Közvetlen Supabase, API réteg nélkül

A mobil ugyanúgy anon kulccsal + user session-nel beszél a Supabase-hez, mint a web. **Nincs köztes API**, mert nincs rá szükség:

- Minden fogyasztói adat kliensoldali `SELECT` (`games`, `players`, `standings`, `league_fixtures`, `player_season_stats_by_season`, a szezon-specifikus stat táblák).
- Az AI riportok is: a webes komponensek közvetlen `supabase.from('game_text_reports')` / `team_text_reports` / `player_text_reports` hívásokkal olvasnak, nem API route-on. RLS: SELECT minden bejelentkezettnek.
- Mind a 14 `app/api/*` route `requireAdmin`-t futtat és mutáló – a fogyasztói scope-on kívül.

### RN Supabase kliens

```ts
// mobile/lib/supabase.ts
import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,   // RN-ben nincs URL-alapú session
    },
  }
)
```

Környezeti változók: `mobile/.env.local`, `EXPO_PUBLIC_` prefixszel (az Expo ezt inlineolja a bundle-be, ahogy a Next a `NEXT_PUBLIC_`-ot). A `SUPABASE_SERVICE_ROLE_KEY` **soha nem kerülhet a mobil bundle-be**.

### Hook-portok

A lekérdezés-logika 1:1 átvehető a `hooks/useGameData.ts` és `hooks/useFilterData.ts` fájlokból – csak a kliens-példány cserélődik. Két szabály viszont változatlanul él:

- **`lib/fetch-all-rows.ts` lapozó** – a PostgREST 1000 soros csendes csonkolása mobilon is fenyeget.
- **`getSeasonStatsTable(seasonName)`** – a `player_game_stats` UNION view-t kerülni kell; a szezon-specifikus tábla a helyes út. A függvény dob, ha a szezon nincs a mappingben – ez mobilon is kezelendő hibaág.

### Lusta betöltés – eltérés a webtől

A webes `useFilterData` mount-kor **minden szezon összes statisztika-tábláját** behúzza lapozva (`ALL_SEASON_STATS_TABLES` végigjárása), hogy az `allPlayersForComparison` tömb kész legyen. Ez desktopon elfogadható, mobilhálón nem.

Mobil stratégia:

| Adat | Mikor töltődik |
|---|---|
| `seasons`, `teams` | App induláskor (kicsi, kell a szűrőhöz) |
| Aktuális szezon+csapat `games`, `players`, `player_season_stats_by_season` | A szűrő beállása után |
| `league_fixtures` (következő 12) | A `Ms` és `Meccsek` tabbal együtt |
| Meccsenkénti box score | Csak a meccs megnyitásakor |
| `allPlayersForComparison` (cross-season) | **Csak** a Játékos-összehasonlítás képernyő nyitásakor |
| PBP / shot chart | Csak a vizualizációs fül megnyitásakor |

---

## Auth

Ugyanaz a szerződés, mint a weben (`lib/auth-context.tsx`):

- `signIn` → `supabase.auth.signInWithPassword`
- `signOut` → `supabase.auth.signOut`
- session követés → `onAuthStateChange`
- `isAdmin` → `user?.user_metadata?.role === 'admin'`

A session AsyncStorage-ban perzisztál, tehát az app nem kér újra bejelentkezést minden indításkor. Az `expo-router` root layoutja őrzi az útvonalakat: session nélkül `login.tsx`, egyébként `(tabs)`.

Az `isAdmin` a mobilon **kizárólag kozmetikai** lehet – mivel a mobil semmit sem ír, nincs is mit mögé rejteni. Ha később mégis lenne írás, az a szerveroldali `requireAdmin` + RLS felelőssége marad, nem a kliensé.

---

## Offline és cache

Az első kiadás **nem offline-first**. Ami viszont kötelező:

- **Session perzisztálás** – ne kelljen újra belépni (AsyncStorage, fent).
- **Szűrő perzisztálás** – az utolsó szezon/csapat választás AsyncStorage-ban.
- **Hálózati hibaállapot** – minden képernyőn értelmes üzenet + újrapróbálás gomb, nem néma üres lista. A webes minta (`app/page.tsx:150-169` inline hibapanel `Újratöltés` gombbal + Sonner toast) átvehető.
- **Offline sáv** – a nav bar alatt megjelenő diszkrét figyelmeztetés, ha nincs kapcsolat.

Valódi offline cache (a legutóbbi meccs és a keret elérhetősége hálózat nélkül) későbbi backlog-tétel.

---

## Új függőségek

Az S3 sprint előtt pontos verziókkal újra jóváhagyandók:

| Csomag | Mire |
|---|---|
| `expo`, `expo-router`, `expo-font`, `expo-constants` | Váz, navigáció, fontok |
| `nativewind` (v4) + `tailwindcss` | Styling – a token-híd hordozója |
| `react-native-safe-area-context` | Safe area insetek |
| `@react-native-async-storage/async-storage` | Session + szűrő perzisztálás |
| `react-native-url-polyfill` | Supabase kliens RN-ben |
| `@supabase/supabase-js` | Adatréteg (azonos major a webbel) |
| `victory-native` (XL) + `@shopify/react-native-skia` | Chartok |
| `react-native-reanimated`, `react-native-gesture-handler` | A victory-native XL függőségei + animációk |
| `lucide-react-native` | Ikonok (a webes `lucide-react` RN párja) |

---

## Verifikáció

| Szint | Parancs / módszer |
|---|---|
| A web nem sérült | Gyökérben `npx tsc --noEmit` + `npm run build` + `git status` tiszta az `app/`, `components/`, `lib/`, `hooks/` alatt |
| A mobil típushelyes | `cd mobile && npx tsc --noEmit` |
| A megosztott mag működik | `@core/stat-formulas` import füstteszt a szimulátorban (S3 első feladat) |
| Futtatás | `cd mobile && npx expo start --ios` |
