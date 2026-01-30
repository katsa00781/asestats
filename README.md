This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Hunbasket importálás

A `scrape-hunbasket.ts` szkript teljes szezonokat importál Supabase-be. Az alábbi környezeti változók segítik a testreszabást:

- `HUNBASKET_ROUND_FILTER`: vesszővel és/vagy tartománnyal megadható fordulólista (pl. `5` vagy `3-5,12`). Csak ezek a fordulók kerülnek feldolgozásra.
- `HUNBASKET_TEAM_FILTER`: továbbra is támogatott név alapú szűrő részleges importhoz.
- Az import automatikusan kihagy minden olyan mérkőzést, amelynek eredménye 0-0 maradt a Hunbasket felületén.

Fejlesztés közben elérhető az **Import** fülön egy új „Forduló alapú Hunbasket import” kártya, amely a `/api/hunbasket-round-import` végpontot hívja meg. A használat menete:

1. Válassz szezont a fejlécben, így a szkript ehhez a Supabase szezonhoz fog kapcsolódni.
2. Írd be a kívánt fordulókat (pl. `9` vagy `10-12,15`).
3. Kattints az „Import indítása” gombra – a felület mutatja a futás naplóját és a hibákat is.

Szerveroldalon ugyanaz a Playwright-alapú szkript fut le, így minden extra adat (statisztika táblák, játékos hozzárendelések) ugyanúgy bekerül, mint a teljes szezonos futtatásnál, csak gyorsabban.
