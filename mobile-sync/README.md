# mobile-sync – Web → mobil változásnapló

Minden olyan webes művelet, amely a mobil appot (`asestatmobile`) is érinti
(adatbázis, adattartalom, `@core` modul, funkcionális, auth/API vagy scraping
változás), ide kap egy `YYYY-MM-DD-<rovid-slug>.md` jegyzetet.

A kötelező sablon és a szabályok: `CLAUDE.md` → „Mobil app szinkron – kötelező követő jegyzet”.

Állapot: `NYITOTT` → átvezetés után `ÁTVEZETVE (YYYY-MM-DD, mobil commit <hash>)`.
A jegyzeteket nem töröljük.
