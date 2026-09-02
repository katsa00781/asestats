# ASEStats Mobile – Termékdefiníció és scope

_Létrehozva: 2026-08-30 · Státusz: terv (S1), implementáció még nem indult_

---

## Mi ez

Az ASEStats iOS-first mobilalkalmazása **Expo / React Native** alapon. Nem a desktop dashboard lekicsinyítése, hanem külön termék ugyanarra az adatra: a csapat ott férjen hozzá a statisztikákhoz és az AI elemzésekhez, ahol nincs laptop – kispadon, lelátón, buszon, edzés közben.

A webes Next.js alkalmazás **változatlan marad**. A mobil nem váltja ki, hanem kiegészíti: az adatbevitel, az import, az adminisztráció és az AI riportok generálása továbbra is desktopon történik.

---

## Miért nem elég a reszponzív web

A jelenlegi mobilkezelés egyetlen 60 soros media query (`app/globals.css:1173`), ami a sidebart alsó navsávvá alakítja. A navigációs króm tehát megvan – **a termék tartalma viszont nincs mobilra tervezve**:

| Probléma | Hol |
|---|---|
| `white-space: nowrap` + `padding: 14px` minden cellán → a tábla mindig kilóg | `.dt-th` / `.dt-td` (`globals.css`) |
| `text-[2.5rem]` érték + `min-h-35` fix magasság, breakpoint nélkül → négy StatCard nem fér ki 390pt-on | `components/ui/stat-card.tsx` |
| Prefixeletlen `grid-cols-3` / `grid-cols-4` → 390px-en összeroppan | `SituationalAnalysis.tsx:191,248`, `TeamComparison.tsx:791`, `SeasonComparison.tsx:12531,12917` |
| 8 komponens renderel nyers `<table>`-t a DataTable-ön kívül, egységes görgetéskezelés nélkül | `PlayerComparison`, `GameDetails`, `TeamComparison`, … |
| Hover-only affordanciák (sor-sín, kártyaemelés, aláhúzás) → érintésen nincs megfelelőjük | DataTable, StatCard, sidebar tooltipek |
| `height: 100vh` (nem `dvh`) → mobil böngészőkróm levágja | `.sidebar` |
| Nincs `prefers-reduced-motion` kezelés 7 keyframe, ebből 3 végtelen animáció mellett | `globals.css` |

Ezek nem apró csiszolások: a **DataTable és a StatCard – vagyis a termék lényege – érdemi újratervezést igényel** érintésre. Ha úgyis újratervezzük, akkor natív platformon tehetjük, ahol a gesztusok, a görgetés és a tipográfia is a helyükre kerülnek.

---

## Scope: fogyasztói nézetek

A 12 web tabból 4 admin-only (`manage`, `playersimport`, `delete`, `import`). Ezek **nem kerülnek mobilra** – formnehéz, hosszú futású import- és adminfelületek, amiket úgyis gépnél végez a felhasználó, és mind admin-only `app/api/*` route-okra épülnek.

Marad **8 fogyasztói nézet**, ezek kerülnek át:

| Web tab | Komponens | Mobil sors |
|---|---|---|
| `overview` | `TeamStatistics` + `TeamComparison` | **Ma** tab |
| `players` | `PlayersList` / `PlayerDetails` / `PlayerComparison` | **Játékosok** tab (3 képernyő) |
| `games` | `GamesList` | **Meccsek** tab |
| `gamelog` | `GameLog` | **Meccsek** tab (szűrő/szegmens) |
| `standings` | `StandingsView` | **Tabella** tab |
| `comparison` | `SeasonComparison` (18 072 sor) | **Elemzés** tab – részhalmaz, lásd lentebb |
| `situational` | `SituationalAnalysis` | **Elemzés** tab → Szituációk |
| `updates` | `Updates` | Beállítás-sheet „Utolsó adatfrissítés" blokkja |

### Az „Elemzés" tab pontos határa

A `SeasonComparison.tsx` 18 072 sor, és a webes AI-munkafolyamat teljes felülete. Mobilra a **fogyasztói fele** kerül:

**Bekerül:**
- Legenerált AI riportok olvasása – pregame, postgame, csapat szezonelemzés, játékos szezonértékelés. Ezek közvetlen Supabase `SELECT`-tel érhetők el a `game_text_reports` / `team_text_reports` / `player_text_reports` táblákból, nincs szükség API route-ra.
- **Számított elemzések**, amiket a megosztott `lib/` mag mobilon is ki tud számolni: `pregame-scouting`, `team-analysis`, `situational-analysis`, `player-analysis` kimenetei. Ez a felhasználói döntés – ez használja ki igazán a tiszta magot.

**Kimarad:**
- Riport **generálás** és kézi szerkesztés (`/api/generate-*`, `/api/save-manual-report`) – mind `requireAdmin`, mind mutáló.
- Eurobasket játékos-import (`/api/eurobasket-player-import`).
- A desktop-orientált, széles összehasonlító mátrixok.

---

## iOS információs architektúra

8 fogyasztói nézet → **5 tab**, mert az iOS tab bar konvenció 5 elemnél nem megy tovább.

```
┌─────────────────────────────────────────────┐
│  ASE          2025/2026 · ASE ▾        ⚙︎   │  ← nav bar + szűrő-pill
├─────────────────────────────────────────────┤
│                                             │
│                  tartalom                   │
│                                             │
├─────────────────────────────────────────────┤
│   Ma   Játékosok  Meccsek  Tabella  Elemzés │  ← tab bar
└─────────────────────────────────────────────┘
```

| Tab | Ikon (Lucide) | Tartalom | Stack mélység |
|---|---|---|---|
| **Ma** | `LayoutDashboard` | Következő meccs, csapat KPI-k, forma, utolsó eredmény | 1 |
| **Játékosok** | `Users` | Lista → részletek → összehasonlítás | 3 |
| **Meccsek** | `Calendar` | Következő/Lejátszott → meccs részletek → vizualizációk | 3 |
| **Tabella** | `Trophy` | Bajnoki tabella | 1 |
| **Elemzés** | `Sparkles` (AI tónus) | Riport-hub → riportolvasó / szituációk / scouting | 2 |

### Globális szűrő

A web fejlécében két külön select ül (`SeasonSelector`, `TeamSelector`). Mobilon ez **egyetlen nav bar pill** (`2025/2026 · ASE ▾`), ami bottom sheetet nyit.

Fontos eltérés: a választás **AsyncStorage-ban perzisztál**. A weben minden újratöltés az alapértelmezettre ugrik (`is_current` szezon, `is_primary` csapat) – mobilon, ahol az app naponta többször indul újra, ez bosszantó lenne.

### Navigáció

`expo-router`, file-based, tabonként saját stack. Ennek mellékhatásaként a mobil **deep-linkelhető** lesz (`asestats://meccsek/1234`), amit a webes state-alapú tab-váltás (`useState('overview')`, nincs router) sosem tudott.

---

## Funkcionális eltérések a webtől – tudatosan

| Eltérés | Indok |
|---|---|
| Szűrő perzisztál | Az app naponta többször indul; a web-viselkedés mobilon idegesítő |
| `allPlayersForComparison` lustán töltődik | A webes `useFilterData` mount-kor **minden** szezon összes statisztika-tábláját lapozva behúzza – mobilhálón elfogadhatatlan |
| Nincs riport-generálás | Admin-only API route; a mobil olvasó |
| Nincs import/admin | Lásd scope |
| `prefers-reduced-motion` tisztelve | A web nem kezeli; a mobil alapkövetelménybe beépítjük |
| Deep link | A web nem tudja; az expo-router ingyen adja |

---

## Sikerkritérium

Az első kiadás akkor kész, ha egy edző a lelátón, mobilhálón, egy kézzel:

1. megnézi, ki hogy játszik ma – **box score, fagyasztott névoszloppal**, vízszintes görgetéssel;
2. lehívja bármelyik játékos szezonátlagait és formatrendjét;
3. elolvassa a meccshez tartozó AI pregame vagy postgame riportot;
4. megnézi a tabellát és a következő ellenfelet.

Ez a négy út a `Ma`, `Meccsek`, `Játékosok` és `Elemzés` tabokat érinti – ezek élveznek prioritást az implementációs sorrendben.

---

## Kapcsolódó dokumentumok

- `context/mobile/mobile-architecture.md` – repo alak, megosztott mag, adatréteg
- `context/mobile/mobile-ui-context.md` – design token híd, komponens-specifikációk
- `context/mobile/mobile-design-prompts.md` – a 15 vizuális design prompt
- `BACKLOG.md` – „Mobil (iOS) – Expo alkalmazás" szekció
