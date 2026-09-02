# ASEStats Mobile – UI kontextus: Dark Command Center iOS-en

_Létrehozva: 2026-08-30 · Státusz: terv (S1)_

> **Egyetlen forrás:** `app/globals.css` `:root` blokkja (15–69. sor). Az itt szereplő minden hex érték onnan származik, szó szerint.
>
> ⚠️ **Ne használd forrásként:** a `context/ui-context.md` elavult (Geist fontokat, OKLCH változókat és `--radius: 0.625rem`-et ír le, a valóságtól eltérően). A `CLAUDE.md` is elavult két értéken – lásd az „Ismert dokumentációs eltérések" szakaszt a fájl végén.

---

## 1. Paletta – változatlanul átvitt

A színek nem változnak. Ez a termék identitása, és OLED kijelzőn a `#050B14` alap + cián accent kifejezetten jól mutat: a fekete-közeli pixelek kikapcsolnak, a cián világít.

### Surface skála

| Token | Hex | Mobil szerep |
|---|---|---|
| `--bg-base` | `#050B14` | Képernyő háttér, tab bar és nav bar alap |
| `--bg-surface-1` | `#0A1628` | Kártya, listasor alap |
| `--bg-surface-2` | `#0F1F3D` | **Nyomott (pressed) állapot**, sheet háttér, input |
| `--bg-surface-3` | `#162440` | Beágyazott elem, aktív szegmens |

### Accentek

| Token | Hex | Mobil szerep |
|---|---|---|
| `--accent-cyan` | `#00D4FF` | Primary, aktív tab, link, fókusz |
| `--accent-cyan-dim` | `#0096B8` | Gradiens alsó vég, bar-fill kezdet |
| `--accent-orange` | `#FF6B35` | CTA, kiemelt érték |
| `--accent-orange-dim` | `#B84A22` | Narancs gradiens vég |
| `--accent-ai` | `#7C3AED` | AI generált tartalom jelölése |
| `--accent-ai-dim` | `#5B21B6` | AI gradiens vég |

### Szöveg

| Token | Hex |
|---|---|
| `--text-primary` | `#E8F4FF` |
| `--text-secondary` | `#7A9ABB` |
| `--text-muted` | `#4A6D95` |

### Szemantikus

| Token | Hex | Szerep |
|---|---|---|
| `--positive` | `#10D98A` | Nyert, növekedés |
| `--negative` | `#FF4757` | Vesztett, csökkenés, élő jelzés |
| `--warning` | `#FFB627` | Figyelmeztetés, „Elavult" badge |

### Vonalak (solid, nem rgba)

| Token | Hex |
|---|---|
| `--border-subtle` | `#0F2040` |
| `--border-active` | `#1E3A5F` |
| `--border-strong` | `#2A4A75` |

### Glow-k (rgba)

| Token | Érték |
|---|---|
| `--glow-cyan` | `rgba(0, 212, 255, 0.15)` |
| `--glow-cyan-hot` | `rgba(0, 212, 255, 0.45)` |
| `--glow-orange` | `rgba(255, 107, 53, 0.15)` |
| `--glow-orange-hot` | `rgba(255, 107, 53, 0.45)` |
| `--glow-ai` | `rgba(124, 58, 237, 0.18)` |
| `--glow-positive` | `rgba(16, 217, 138, 0.18)` |
| `--glow-negative` | `rgba(255, 71, 87, 0.18)` |

---

## 2. Tipográfia

Három család, szigorú szereposztással – ugyanaz, mint a weben. `expo-font`-tal töltve, `latin` + `latin-ext` (a magyar ékezetekhez **kötelező** a `latin-ext`), 400/500/600/700 súlyok.

| Család | Szerep |
|---|---|
| **Barlow Condensed** | Címek, label-ek, badge-ek, gombfeliratok, tab-címkék. Label-eknél ALL CAPS + `0.12em` tracking. |
| **DM Sans** | Body szöveg, leírások, AI riportok folyó szövege. |
| **JetBrains Mono** | **Minden numerikus érték**, kötelező `fontVariant: ['tabular-nums']`. |

### Mobil típusskála – ÚJ TOKENEK

A web `rem`-alapú skálája (`clamp(2rem, 4vw, 3rem)` h1, `2.5rem` stat érték) telefonon nem működik. Az alábbi pt-skála a mobil specifikuma:

| Token | pt | Font | Használat |
|---|---|---|---|
| `display-xl` | 34 | Barlow Condensed 600 | Meccs eredmény hero |
| `display-l` | 28 | Barlow Condensed 600 | Képernyőcím (nav bar large title) |
| `display-m` | 22 | Barlow Condensed 600 | Szekciócím |
| `display-s` | 17 | Barlow Condensed 600 | Kártyacím, gombfelirat |
| `stat-hero` | 40 | JetBrains Mono 600 | Eredmény, egyetlen kiemelt szám |
| `stat-l` | 28 | JetBrains Mono 600 | StatTile fő érték |
| `stat-m` | 20 | JetBrains Mono 500 | Táblázat kiemelt szám |
| `stat-s` | 15 | JetBrains Mono 400 | Táblázat cella, meta |
| `body` | 15 | DM Sans 400 | Folyó szöveg (iOS alapérték) |
| `caption` | 13 | DM Sans 400 | Kísérőszöveg, dátum |
| `label` | 11 | Barlow Condensed 600 | ALL CAPS, `0.12em` tracking |

Sorköz: címeknél `1.1`, body-nál `1.45`, AI riport olvasónál `1.6` (hosszú szöveg).

---

## 3. Spacing és sarok

**4pt rács:** `4 · 8 · 12 · 16 · 20 · 24 · 32`

- Képernyő vízszintes margó: **16pt**
- Kártyák közti függőleges rés: **12pt**
- Kártya belső padding: **16pt**
- Szekciók közti rés: **24pt**

**Radius – nincs új érték**, a meglévő skála: `2 / 4 / 6 / 10 / 14`.

| Elem | Radius |
|---|---|
| Badge, tag | 2 |
| Input, kis gomb | 4 |
| Gomb, szegmens | 6 |
| Listasor, kis kártya | 10 |
| Fő kártya, sheet | 14 |

> Az iOS-es „nagyon kerek" (18–22pt) érzet **tudatosan nincs** átvéve. A Dark Command Center szűk radiusai adják a telemetria-karaktert; ezt feladni annyi lenne, mint feladni az identitást.

---

## 4. Érintés – ÚJ TOKEN

`tap-min: 44pt` (Apple HIG minimum). Ez minden interaktív elemre kötelező, akkor is, ha a **vizuális** elem kisebb – ilyenkor `hitSlop`-pal kell kiterjeszteni.

A webes elemek, amik ezt sértik és mobilon nagyobbak lesznek:

| Web elem | Web méret | Mobil |
|---|---|---|
| `.dt-foot-btn` | `padding: 4px 10px` | 44pt magas |
| `.sb-toggle` | 28px | nincs mobilon |
| `.nav-item` (mobil sáv) | ~40pt magas | 49pt tab bar |

### Hover → nyomás

A web hover-affordanciái érintésen **nem léteznek**. Minden hover-állapotnak van `pressed` megfelelője:

| Web hover | Mobil `Pressable` pressed |
|---|---|
| DataTable sor: `surface-2` + `inset 2px 0 0 0 cyan` | Azonos: `surface-1 → surface-2` + 2pt bal cián sín |
| StatCard: `-translate-y-0.5` + glow | Nincs emelés; `surface-1 → surface-2` + a bal accent sín felerősödik |
| `.dt-player-name` aláhúzás | Nincs; a teljes sor a célpont |
| Sidebar tooltip | Nincs; a címke mindig látszik |

Nyomás-visszajelzés: **azonnali** (0ms be), elengedéskor 120ms `ease-snap` kifutás. Az iOS-en a lassú press-feedback döglöttnek érződik.

---

## 5. Glow RN-ben – rétegzés, nem shadow

Az RN `shadowColor`/`shadowRadius` nem tud megbízható színes glow-t (iOS-en korlátozott, Androidon `elevation`-re esik vissza, ami csak szürke). A glow-t **rétegzéssel** oldjuk meg – ez a `.badge-*` osztályok már bevált formulája a weben:

```
accent glow ≈
  háttér:  accent szín 14% opacitással
  border:  accent szín 30% opacitással (1pt)
  szöveg:  accent szín 100%
```

Az AI variáns erősebb: 16% háttér / 40% border / `#C4B5FD` szöveg.

Csak a **hero elemeknél** (Ma tab következő-meccs kártya, meccs eredmény) engedünk egy Skia `BlurMask` réteget valódi fényhatásért. Máshol nem – a teljesítmény és a konzisztencia is ellene szól.

### Badge variánsok

Ugyanaz a 7 variáns, mint a weben: `cyan`, `orange`, `ai`, `positive`, `negative`, `warning`, `neutral`. Barlow Condensed 600, ALL CAPS, 11pt, `0.12em` tracking, radius 2, padding `3×8`.

---

## 6. Két komponens, amit újra kell gondolni

### StatCard → **StatTile**

A webes StatCard fix `text-[2.5rem]` értéke és `min-h-35` (8.75rem) magassága breakpoint nélküli – négy darab egy sorban nem fér ki 390pt-on.

**Mobil StatTile:**
- **2 oszlopos rács**, 12pt réssel
- Magasság: `min-height 96pt`
- Érték: `stat-l` (28pt), JetBrains Mono 600, `tabular-nums`
- Címke: `label` (11pt), Barlow Condensed 600, ALL CAPS, `0.12em`, `--text-secondary`
- **Bal oldali 3pt accent sín megmarad** – ez a legjellegzetesebb vizuális jel
- Accent variánsok változatlanul: `cyan` / `orange` / `green` (`--positive`) / `purple` (`--accent-ai`)
- Trend pill: opcionális, `caption` méretben, a `--positive` / `--negative` / `--text-secondary` hármassal

### DataTable → **két külön minta**

A webes `.dt-th` / `.dt-td` `white-space: nowrap` + `padding: 14px` garantálja a vízszintes kilógást. Mobilon a tábla nem egy komponens, hanem kettő – a döntés az adat természetén múlik.

**(a) StackedRow – listákhoz**

Ahol az adat *entitáslista* (játékosok, meccsek, tabella): nincs vízszintes görgetés.

```
┌──────────────────────────────────────────┐
│ ▍ 12  Kovács Péter          14.2  6.1  3.4│
│      Bedobó hátvéd           PPG  RPG  APG│
└──────────────────────────────────────────┘
```

- Bal 2pt accent sín (aktív/kiemelt soron)
- Avatar vagy mezszám, 32pt
- Név: DM Sans 600, 15pt, `--text-primary`
- Meta sor: `caption`, `--text-muted`
- **Maximum 3 kulcsszám** jobbra igazítva, mono, alattuk `label` fejléc
- Sor magasság: min. 60pt
- Rendezés: a lista fölött **chip-sor** (`PPG · RPG · APG · Perc`), nem oszlopfejléc-koppintás

**(b) StatMatrix – box score-hoz**

Ahol az adat *valódi mátrix* (meccs box score, 15+ oszlop): a névoszlop **fagyasztott**, a statoszlopok vízszintesen görgethetők.

```
┌────────────┬─────────────────────────────
│ JÁTÉKOS    │ PER  PT  RB  AS  ST  BL  … →
├────────────┼─────────────────────────────
│ Kovács P.  │ 28:14  18   4   6   2   0
│ Nagy B.    │ 24:02  11   7   2   1   1
└────────────┴─────────────────────────────
```

- Fagyasztott oszlop szélessége: 108pt, `--bg-surface-1` háttér, jobb oldalán `--border-active` 1pt vonal
- A görgethető rész `--bg-base` háttéren
- Cellák: `stat-s` (15pt) mono, `tabular-nums`, jobbra igazítva
- Fejléc: `label` (11pt), `--text-muted`
- **Görgetés-jelzés kötelező**: a fagyasztott oszlop jobb szélén finom gradiens árnyék, amíg van jobbra tartalom

---

## 7. Mozgás

A webes animációk átvitele, iOS-időzítéssel:

| Web | Mobil megfelelő | Időzítés |
|---|---|---|
| `.animate-fade-slide-up` | Lista- és kártyabelépés | 300ms, `ease-snap` |
| `.animate-count-up` | StatTile érték első megjelenése | 600ms (a webes 1.2s mobilon lassú) |
| `.stagger > *` 60ms | Listaelemek | 40ms lépés, **max 8 elemig** |
| `.animate-pulse-glow` | Élő jelzés, AI betöltés | 1.8s ∞ |
| `.skeleton-shimmer` | Betöltés | 1.6s ∞ |

Easing: `--ease-snap` = `cubic-bezier(.2, .8, .2, 1)`, `--ease-glide` = `cubic-bezier(.4, 0, .2, 1)`.

### Akadálymentesítés – kötelező

A web **sehol nem kezeli** a `prefers-reduced-motion`-t, 7 keyframe és 3 végtelen animáció mellett. A mobil igen:

```ts
AccessibilityInfo.isReduceMotionEnabled()
```

Bekapcsolt állapotban: nincs belépő animáció, nincs stagger, nincs pulzálás – a tartalom azonnal, végállapotban jelenik meg. A `.live-dot` pulzálás statikus pontra vált.

Továbbá: Dynamic Type támogatás legalább a body és caption szinteken; a mono statértékek fix méretűek maradnak, mert a táblázatos igazítás különben eltörik.

---

## 8. Safe area és rendszer-króm

- `react-native-safe-area-context`, minden képernyő `SafeAreaView`-ban vagy `useSafeAreaInsets()`-szel
- Nav bar: 44pt + felső inset
- Tab bar: 49pt + alsó inset (iPhone home indicator)
- Görgethető tartalom alsó padding: tab bar magasság + 16pt
- Státuszsáv: `light-content` (sötét témán)
- A `--bg-base` (`#050B14`) a rendszer-króm alatt is folytatódik

---

## 9. Ismert dokumentációs eltérések

Ezek **nem javítandók ebben a scope-ban**, de tudni kell róluk, mert félrevihetik a munkát:

| Fájl | Állítás | Valóság (`app/globals.css`) |
|---|---|---|
| `context/ui-context.md` | Geist Sans / Geist Mono | Barlow Condensed / DM Sans / JetBrains Mono |
| `context/ui-context.md` | OKLCH shadcn változók, `.dark` kapcsoló | Kézzel írt hex tokenek, dark-only |
| `context/ui-context.md` | `--radius: 0.625rem` | `--radius: var(--radius-md)` = 6px |
| `context/ui-context.md` | `container mx-auto` + `bg-slate-900` header | `.app-shell` grid + AppSidebar/AppTopbar |
| `CLAUDE.md` | `--text-secondary` = `#5A7A99` | **`#7A9ABB`** |
| `CLAUDE.md` | `--text-muted` = `#2D4A6B` | **`#4A6D95`** |
| `CLAUDE.md` | `tailwind.config.ts` `3xl`/`4xl` breakpointokkal | A fájl **nem létezik** a repóban |

A `CLAUDE.md` két szín-eltérése szándékos design döntés maradványa – a BACKLOG rögzíti, hogy a világosabb értékek olvashatósági okból maradtak. A doksi nem lett utána frissítve.
