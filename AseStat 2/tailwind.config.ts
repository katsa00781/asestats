// tailwind.config.ts
// Tailwind CSS 4 elsősorban CSS-first konfigurációt használ — a tokeneket
// és utility-ket az `app/globals.css` @theme blokkjában definiáljuk.
// Ez a fájl csak akkor szükséges, ha plugineket vagy content-scant
// szeretnél hozzáadni (pl. shadcn New York preset, tailwind-merge, stb.).
//
// Ha a projekt 100%-ban CSS-first módon konfigurálódik, ezt a fájlt
// el is hagyhatod — a postcss.config.js + globals.css elég.

import type { Config } from "tailwindcss";

const config: Config = {
  // Tailwind 4 alatt a darkMode default media-quary helyett class:
  darkMode: ["class"],

  content: [
    "./app/**/*.{ts,tsx,mdx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],

  // FONTOS: a színeket / fontokat NEM itt definiáljuk újra —
  // a globals.css @theme inline {...} blokkja a Single Source of Truth.
  // Tailwind 4 a @theme tokeneket automatikusan utility-vé konvertálja:
  //   bg-base, bg-surface-1, text-cyan, text-orange, border-subtle,
  //   shadow-glow-cyan, animate-fade-slide-up, font-display, font-mono, stb.

  theme: {
    extend: {
      // Itt csak akkor írj át, ha egy speciális komponens nem érhető el
      // CSS változóból (pl. egyedi screens, container query bp-k).
      screens: {
        "3xl": "1920px",
        "4xl": "2400px",
      },
    },
  },

  plugins: [
    // require("tailwindcss-animate"),  // tw-animate-css helyett opcionális
  ],
};

export default config;
