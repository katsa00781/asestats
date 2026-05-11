# UI Context

## Theme

Sötét mód (dark-only). Az alkalmazás egésze a `dark` CSS osztállyal van ellátva a root `<div>`-en. Nincs light mode. A vizuális nyelv egy sötét, technikai munkakörnyezet: mélyfekete háttérszínek, rétegzett felületek, és visszafogott kék/szürke akcentszínek az interaktív elemeken. A design célja az adatok olvashatósága és az edzői felhasználók hatékonysága.

## Colors

A shadcn/ui New York stílus OKLCH alapú CSS változókat használ. A `.dark` osztály aktiválja a sötét téma változóit. Minden komponensnek ezeket a tokeneket kell használnia — ne legyen hardcoded hex vagy Tailwind szín az alkalmazás kódjában.

### Sötét téma tokenek (aktív a `.dark` osztály alatt)

| Szerepe | CSS változó | Tailwind megfelelő |
|---------|-------------|-------------------|
| Oldal háttér | `--background` | `bg-slate-950` (page wrapper) |
| Header háttér | `--card` / slate-900 | `bg-slate-900` |
| Kártya/panel háttér | `--card` | `bg-card` |
| Elsődleges szöveg | `--foreground` | `text-foreground` |
| Másodlagos szöveg | `--muted-foreground` | `text-muted-foreground` |
| Keret/elválasztó | `--border` | `border-border` |
| Input háttér | `--input` | `bg-input` |
| Elsődleges gomb | `--primary` | `bg-primary text-primary-foreground` |
| Destruktív/törlés | `--destructive` | `text-destructive` / `text-red-400` |
| Chart 1 (narancs) | `--chart-1` | `text-chart-1` |
| Chart 2 (teal) | `--chart-2` | `text-chart-2` |
| Chart 3 (kék-szürke) | `--chart-3` | `text-chart-3` |
| Chart 4 (sárga) | `--chart-4` | `text-chart-4` |
| Chart 5 (arany) | `--chart-5` | `text-chart-5` |

### Konkrét hardcoded Tailwind osztályok (csak layout szinteken)

Az oldal root wrapper: `min-h-screen bg-slate-950 dark`  
A header: `bg-slate-900 text-white`  
Gomb variáns (admin): `bg-slate-700 hover:bg-slate-600 text-slate-100 border border-slate-600`  
Szezon/csapat label szöveg: `text-slate-400`  
Törlés tab: `text-red-400`

## Typography

| Szerepe | Font | CSS változó |
|---------|------|-------------|
| UI szöveg | Geist Sans (Google Fonts) | `--font-geist-sans` / `var(--font-sans)` |
| Kód/mono | Geist Mono (Google Fonts) | `--font-geist-mono` / `var(--font-mono)` |

A fontok a `app/layout.tsx`-ben vannak betöltve Next.js `next/font/google`-lal. Az `antialiased` osztály mindig jelen van a `<body>`-n.

## Border Radius

A shadcn/ui `--radius: 0.625rem` alapértékkel dolgozik, ebből számítja a skálát:

| Kontextus | CSS változó | Tailwind osztály |
|-----------|-------------|------------------|
| Kis/inline UI elemek | `--radius-sm` | `rounded-sm` |
| Gombok, inputok | `--radius-md` | `rounded-md` |
| Kártyák, panelek | `--radius-lg` | `rounded-lg` |
| Modálok, overlays | `--radius-xl` | `rounded-xl` |

## Component Library

shadcn/ui New York stílus, Tailwind CSS 4 és Radix UI primitíveken alapulva.

- Komponensek helye: `components/ui/`
- Elérhető alapkomponensek: `button`, `card`, `input`, `label`, `select`, `tabs`, `textarea`, `tooltip`, `badge`
- Új komponens hozzáadása: `npx shadcn@latest add <component-name>` — **soha ne kézzel írj `components/ui/`-ba**
- Komponens variánsok: Class Variance Authority (`cva`) — a `button.tsx` mintáját követni
- Osztály kombinálás: `clsx` + `tailwind-merge` (`cn()` utility a `lib/utils.ts`-ben)

## Layout Patterns

- **Oldal wrapper**: `min-h-screen bg-slate-950 dark` — full-viewport sötét háttér
- **Header**: `bg-slate-900 text-white py-4 sm:py-6 shadow-lg` — rögzített tetején, árnyékkal elválasztva
- **Container**: `container mx-auto px-4` — centráló wrapper
- **Responsive flex header**: `flex flex-col gap-4 md:flex-row md:items-center md:justify-between` — mobil: oszlop, desktop: sor
- **Főtartalom**: `container mx-auto px-2 sm:px-4 py-4 sm:py-8` — kisebb padding mobilon
- **Tab navigáció**: horizontálisan scrollolható mobilon (`overflow-x-auto`), desktop-on wrapping grid; `min-w-max md:min-w-0 md:w-full`
- **Tab trigger**: `text-xs sm:text-sm flex-shrink-0 md:flex-1 min-w-[7rem] px-3 py-2 whitespace-nowrap`
- **Szűrő grid**: `grid gap-4 sm:grid-cols-2` — szezon + csapat választók egymás mellett
- **Kártyák**: shadcn/ui `Card` komponens, `rounded-lg border bg-card`
- **Modálok / Overlays**: centráló overlay `backdrop-blur` effekttel (shadcn konvenció)

## Icons

Lucide React. Csak stroke-alapú ikonok. Méretkonvenciók:
- Kis inline ikonok: `h-4 w-4`
- Gomb ikonok: `h-4 w-4` (gomb szöveg mellé, `gap-2`-vel)
- Header/hero ikonok: `h-6 w-6 sm:h-8 sm:w-8 md:h-10 md:w-10` (responsive)

Példa: `<Trophy className="h-6 w-6 sm:h-8 sm:w-8" />`, `<LogOut className="h-4 w-4" />`

## Charts

Két chart könyvtár él egymás mellett — egyik sem törli a másikat:

- **Chart.js + react-chartjs-2**: elsősorban shot chart és komplex vizualizáció (`PostgameShotScatterChart`, `PostgameZoneHeatmapChart`)
- **Recharts**: szezon trendek és összehasonlítók (`PlayerTrends`, `SeasonComparison`)

Chart komponensek mindig `'use client'` direktívával — soha nem Server Component.

## Toast Notifications

Sonner (`<Toaster />` a `layout.tsx`-ben). Használat: `import { toast } from 'sonner'` majd `toast.success(...)` / `toast.error(...)`.
