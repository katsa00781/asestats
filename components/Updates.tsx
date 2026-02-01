'use client';
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, TrendingUp, Users, Calendar, BarChart3, Trophy } from 'lucide-react';

type UpdateItem = {
  date: string;
  version: string;
  category: 'feature' | 'improvement' | 'fix';
  icon: React.ReactNode;
  title: string;
  description: string;
};

const updates: UpdateItem[] = [
  {
    date: '2026. február 1.',
    version: '1.5.0',
    category: 'feature',
    icon: <BarChart3 className="w-5 h-5" />,
    title: 'Elemzés modul: játékos, csapat, pregame, postgame',
    description:
      'Új Elemzés oldal determinisztikus scoutinggal: játékos- és csapatelemzés (percentilis alapú stílus, erősségek/korlátok), pregame fókuszpontok és postgame riport ellenfél-statokkal. Roster- és magasság-alapú insightok, HU címkékkel és glosszáriummal.',
  },
  {
    date: '2026. február 1.',
    version: '1.5.0',
    category: 'improvement',
    icon: <TrendingUp className="w-5 h-5" />,
    title: 'Finomhangolt statisztikai logika',
    description:
      'Frissített percentilis skálázás (P10–P90), új two_rate és 3P% mutatók, pontosabb stílusdetektálás és támadó/védekező fókuszok. Ellenfél-meccs összerendelés és adathiány jelzések javítva.',
  },
  {
    date: '2026. január 30.',
    version: '1.4.0',
    category: 'feature',
    icon: <BarChart3 className="w-5 h-5" />,
    title: 'Hunbasket csapatösszehasonlítás',
    description:
      'Új csapatösszehasonlító modul kizárólag a hunbasket.hu hivatalos statisztikái alapján. Szezonok és csapatok szűrése, fejlett mutatók (eFG%, AST/TO, dobások), radar- és trendgrafikonok, valamint egymás elleni mérleg segít a felkészülésben.',
  },
  {
    date: '2026. január 30.',
    version: '1.3.3',
    category: 'feature',
    icon: <TrendingUp className="w-5 h-5" />,
    title: 'Hunbasket forduló import + 0-0 védelem',
    description: 'Új forduló szűrő a Hunbasket importhoz: környezeti változóval vagy az Import fülön futtatható, és csak a megadott fordulók töltődnek le. A 0-0 eredményű meccsek automatikusan kimaradnak, az alkalmazás pedig naplózza az új folyamatot az Import → "Forduló alapú Hunbasket import" panelen.',
  },
  {
    date: '2026. január 26.',
    version: '1.3.2',
    category: 'feature',
    icon: <Users className="w-5 h-5" />,
    title: 'Játékos keret import és törlés',
    description: 'Új "Játékos Import" fül! Egyszerűen másold be a csapat játékosainak táblázatát (mezszám, név, születési év, poszt, magasság, súly), és az app automatikusan importálja őket a kiválasztott csapathoz és szezonhoz. Törlés funkció is elérhető a tévesen importált játékosok eltávolításához. A pozíciók egységesítve lettek numerikus formátumra (1-5) minden csapatnál.',
  },
  {
    date: '2026. január 26.',
    version: '1.3.1',
    category: 'improvement',
    icon: <Calendar className="w-5 h-5" />,
    title: 'Meccs adatok automatikus átvétele',
    description: 'Gyors meccs import után az adatok automatikusan átkerülnek a játékos statisztikák importálásához! Továbbá új "Létező meccs" kiválasztási lehetőség, ahol a korábban létrehozott meccseket választhatod ki ahelyett, hogy újra begépelnéd az adatokat. Forduló mező is hozzáadva.',
  },
  {
    date: '2026. január 26.',
    version: '1.3.0',
    category: 'feature',
    icon: <Calendar className="w-5 h-5" />,
    title: 'Gyors meccs import',
    description: 'Új egyszerűsített meccs importálási lehetőség! Egyszerűen másold be a meccs adatait (dátum, forduló, csapatok, eredmény) egy szöveges formátumban, és az app automatikusan feldolgozza őket előnézettel együtt.',
  },
  {
    date: '2026. január 26.',
    version: '1.2.2',
    category: 'improvement',
    icon: <Users className="w-5 h-5" />,
    title: 'Csapatok közötti posztonkénti összehasonlítás',
    description: 'Az "Összes csapat" opcióval most már össze tudod hasonlítani különböző csapatok azonos poszton játszó játékosait. Válaszd ki a szezont, a pozíciót és az "Összes csapat" lehetőséget!',
  },
  {
    date: '2026. január 26.',
    version: '1.2.1',
    category: 'fix',
    icon: <BarChart3 className="w-5 h-5" />,
    title: 'Fejlett statisztikák javítása az összehasonlításban',
    description: 'Javítva a fejlett statisztikák (OffRtg, DefRtg, TS%, eFG%) megjelenítése a játékosok összehasonlításánál. Most már helyesen jelennek meg az importált meccsenkénti átlagok minden játékosnál.',
  },
  {
    date: '2026. január 26.',
    version: '1.2.0',
    category: 'feature',
    icon: <Users className="w-5 h-5" />,
    title: 'Játékosok szezonok közötti összehasonlítása',
    description: 'Most már össze tudod hasonlítani ugyanazt a játékost különböző szezonokban! A játékosok összehasonlítása funkcióban válaszd ki ugyanazt a játékost több szezonból, és lásd az átlagok változását grafikonokon.',
  },
  {
    date: '2026. január 20.',
    version: '1.1.5',
    category: 'improvement',
    icon: <BarChart3 className="w-5 h-5" />,
    title: 'Továbbfejlesztett statisztikai nézetek',
    description: 'Új fejlett statisztikák (Offensive Rating, Defensive Rating, True Shooting %) kerültek hozzáadásra a játékosok összehasonlításához és részletes nézeteihez.',
  },
  {
    date: '2026. január 15.',
    version: '1.1.0',
    category: 'feature',
    icon: <Trophy className="w-5 h-5" />,
    title: 'Több csapat támogatása',
    description: 'Az alkalmazás mostantól több csapat statisztikáit is képes kezelni. Csapatszűrővel válthatsz a különböző csapatok között, és külön követheted mindegyik teljesítményét.',
  },
  {
    date: '2026. január 10.',
    version: '1.0.5',
    category: 'improvement',
    icon: <Calendar className="w-5 h-5" />,
    title: 'Szezonok közötti összehasonlítás',
    description: 'Szezonok közötti összehasonlító nézet hozzáadva, ahol az egész csapat teljesítményét elemezheted különböző szezonokban.',
  },
  {
    date: '2026. január 5.',
    version: '1.0.0',
    category: 'feature',
    icon: <Sparkles className="w-5 h-5" />,
    title: 'Első stabil verzió',
    description: 'Az ASE Stats első stabil verziója! Tartalmazza a játékosok részletes statisztikáit, meccsenkénti bontást, tabella kezelést, és JSON import funkciót.',
  },
];

const categoryColors = {
  feature: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
  improvement: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  fix: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
};

const categoryLabels = {
  feature: 'Új funkció',
  improvement: 'Fejlesztés',
  fix: 'Javítás',
};

export function Updates() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Sparkles className="text-emerald-400" size={28} />
        <h2 className="text-2xl font-bold text-slate-50">Frissítések és újdonságok</h2>
      </div>

      <Card className="bg-gradient-to-br from-emerald-900/20 to-blue-900/20 border-emerald-500/30">
        <CardHeader>
          <CardTitle className="text-slate-50 flex items-center gap-2">
            <TrendingUp className="text-emerald-400" size={20} />
            Mi újság az ASE Stats-ban?
          </CardTitle>
        </CardHeader>
        <CardContent className="text-slate-300 text-sm">
          Kövesd nyomon az alkalmazás fejlesztését! Itt találod a legfrissebb funkciókat, 
          fejlesztéseket és javításokat, amelyek jobbá teszik a statisztikai elemzést.
        </CardContent>
      </Card>

      <div className="space-y-4">
        {updates.map((update, index) => (
          <Card 
            key={index} 
            className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors"
          >
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Ikon és kategória */}
                <div className="flex items-start gap-3 sm:w-48 shrink-0">
                  <div className="p-3 rounded-lg bg-slate-800 text-emerald-400">
                    {update.icon}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Badge 
                      variant="outline" 
                      className={`w-fit text-xs ${categoryColors[update.category]}`}
                    >
                      {categoryLabels[update.category]}
                    </Badge>
                    <div className="text-xs text-slate-500">
                      {update.date}
                    </div>
                    <Badge variant="secondary" className="w-fit text-xs">
                      v{update.version}
                    </Badge>
                  </div>
                </div>

                {/* Tartalom */}
                <div className="flex-1 space-y-2">
                  <h3 className="text-lg font-semibold text-slate-50">
                    {update.title}
                  </h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    {update.description}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="p-6 text-center">
          <p className="text-slate-400 text-sm">
            További fejlesztések és újdonságok hamarosan! 🚀
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
