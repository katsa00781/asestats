// app/layout.tsx
// Google Fonts betöltés — Barlow Condensed / DM Sans / JetBrains Mono
// Mindhárom font CSS változón keresztül kapcsolódik a globals.css-be.

import type { Metadata } from "next";
import { Barlow_Condensed, DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Barlow_Condensed({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const body = DM_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ASEStats — Command Center",
  description: "Magyar kosárlabda analitikai platform",
  themeColor: "#050B14",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="hu" className="dark">
      <body
        className={`${display.variable} ${body.variable} ${mono.variable} font-sans bg-base text-primary antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
