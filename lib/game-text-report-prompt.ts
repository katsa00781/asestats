// Mérkőzés szöveges elemzés (AI): prompt, a modellnek átadott adatkivonat és a
// generált szöveg számainak visszaellenőrzése. Tiszta modul – az API hívás és
// a mentés a `app/api/generate-game-text-report/route.ts`-ben marad.

import type { ScoutingReport } from './pregame-scouting';
import type { PostGameReport } from './postgame-report';

export type GameTextReportStyle = 'fan' | 'balanced' | 'coach';

export type GameTextReportPayload = {
  gameId: string;
  opponentName?: string;
  reportType?: 'pregame' | 'postgame' | 'combined';
  stylePreset?: GameTextReportStyle;
  pregameReport: ScoutingReport;
  postgameReport: PostGameReport;
  generatedBy?: string | null;
};

export const SYSTEM_PROMPT = `Te egy magyar kosárlabda-szakértő elemző vagy.
Feladatod: szurkolóbarát, olvasmányos, mégis szakmailag pontos mérkőzésértékelést írni a kapott pre-game és post-game riport alapján.
Kritikus szabályok:
- Kizárólag a felhasználói üzenet JSON blokkjában szereplő adatokból dolgozhatsz. Ami nincs a JSON-ban, az számodra nem létezik.
- Nem számolhatsz új statisztikát, és nem találhatsz ki új tényt, eseményt, nevet vagy számot.
- Ha egy kért részhez nincs adat, ezt röviden jelezd, és ne pótold feltételezéssel.
- Tartsd a kért szerkezetet, de a megfogalmazás legyen természetes, narratív.
- Magyar szaknyelvet használj, angol zsargont kerüld.
- A hangnem legyen támogató és érthető: ne legyen bántó, ne hibáztass név szerint.
- Úgy fogalmazz, mintha meccs után egy szurkolói műsorban magyaráznád az összefüggéseket.
- Legyen emberi tónus, de maradjon adatvezérelt és szakmailag feszes.`;

/**
 * A `ScoutingReport` `profile` / `threats` / `vulnerabilities` / `keyPlayers`
 * mezői mind az ELLENFELET írják le (szezonadatokból). A kulcsnevek ezt
 * kimondják, hogy a modell ne a saját csapatra értse őket.
 */
const extractPregameContext = (report: ScoutingReport) => ({
  summary: report.summary,
  winProbability: report.winProbability,
  opponentProfile: report.profile,
  ownTeamProfile: report.ownTeamProfile ?? null,
  opponentThreats: report.threats,
  opponentVulnerabilities: report.vulnerabilities,
  opponentKeyPlayers: report.keyPlayers,
  focusPoints: report.focusPoints,
  xFactorContext: report.xFactorContext ?? null,
  riskFlags: report.riskFlags ?? [],
  injuryContext: report.injuryContext ?? null,
});

const extractPlayerContext = (report: PostGameReport) => {
  const pr = report.playerReport;
  if (!pr) return null;

  const slim = (p: { name: string; position: string; llmContext: Record<string, unknown> }) => ({
    name: p.name,
    position: p.position,
    ...p.llmContext,
  });

  return {
    mvp: pr.highlights.mvp ? slim(pr.highlights.mvp) : null,
    engines: pr.highlights.engines.map(slim),
    sparkPlugs: pr.highlights.sparkPlugs.map(slim),
    struggling: pr.highlights.struggling.map(slim),
    rotationAndHeavy: pr.players
      .filter(p => p.minutesBucket !== 'micro')
      .map(p => slim(p)),
  };
};

/**
 * Döntő tényezők iránnyal. A `tone` az irány egyetlen forrása – a modellnek
 * nem a címke szövegéből kell kitalálnia, kinek kedvez a tényező.
 */
const extractDecisiveFactors = (report: PostGameReport) => {
  // A riport a kliensből érkezik (és lehet régi, mentett objektum) – a
  // hiányzó mezőket itt, a rendszerhatáron kezeljük.
  const meta = Array.isArray(report.decisiveFactorMeta) ? report.decisiveFactorMeta : [];
  if (meta.length > 0) {
    return meta.map(item => ({
      label: item.label,
      axis: item.axis,
      type: item.type,
      tone: item.tone ?? null,
      source: item.source ?? null,
    }));
  }
  // Régi riportobjektum meta nélkül: az irány nem ismert.
  return [
    ...(report.decisiveFactors?.offense ?? []).map(label => ({ label, axis: 'offense' as const, type: null, tone: null, source: null })),
    ...(report.decisiveFactors?.defense ?? []).map(label => ({ label, axis: 'defense' as const, type: null, tone: null, source: null })),
  ];
};

const extractPostgameContext = (report: PostGameReport) => {
  // Viszonyítási alap nélkül a `season` érték maga a meccs – ne kapjon a
  // modell 0-s deltát, amit ténynek olvashat.
  const comparable = report.baseline?.comparable ?? true;

  return {
    summary: report.summary,
    result: report.result,
    baseline: report.baseline ?? null,
    metrics: {
      pointsFor: report.metrics.pointsFor,
      pointsAgainst: report.metrics.pointsAgainst,
      margin: report.metrics.margin,
      possessions: report.metrics.pace,
      keyStats: (report.metrics.keyStats ?? []).map(stat => ({
        label: stat.label,
        unit: stat.unit,
        game: stat.game,
        reference: comparable ? stat.season : null,
        delta: comparable ? stat.delta : null,
      })),
      ratings: report.metrics.ratings ?? null,
      opponent: report.metrics.opponent ?? null,
      boxScore: report.metrics.boxScore ?? null,
      pointSources: report.metrics.pointSources ?? null,
    },
    context: report.context,
    decisiveFactors: extractDecisiveFactors(report),
    strengths: report.strengths,
    problems: report.problems,
    nextFocus: report.nextFocus,
    reflection: report.reflection,
    playerImpact: report.playerImpact,
    lineupInsights: report.lineupInsights ?? null,
    playerReport: extractPlayerContext(report),
    dataNotes: report.dataNotes ?? [],
  };
};

const BASE_INSTRUCTIONS = `Feladatod egy szurkolóbarát, jól olvasható szöveges mérkőzés-elemzés készítése a pre-game és post-game riportok alapján.

ADATHŰSÉG – ezek a szabályok minden más elvárást (terjedelem, számtartalom, stílus) felülírnak:
1. Egyetlen forrás: a lenti JSON. Minden szám, százalék, százalékpont-eltérés és név szó szerint szerepeljen benne. Ne számolj különbséget, összeget, arányt, átlagot vagy részesedést; ne kerekíts át. Eltérést (pp, pont) csak akkor írj le számmal, ha a "delta" mezőben vagy egy címke szövegében készen megtalálod. Egy tényező hatását ne becsüld meg számmal (pl. "ez 8–10 pontot jelent") – ilyen adat nincs.
2. Nincs adat → nincs állítás. Ha egy mező null, hiányzik, üres lista vagy "available": false, arról ne írj számot és ne vonj le következtetést. Ha a kötelező szerkezet egy blokkja erre épülne, egy rövid mondatban jelezd, hogy ehhez nem áll rendelkezésre adat – ne töltsd ki feltételezéssel.
3. Meccsesemények: ne írj le konkrét akciót, játékhelyzetet, időpontot, pontsorozatot, sérülést, játékvezetői döntést, időkérést vagy hangulatot. Negyedre és clutch szakaszra csak akkor hivatkozz, ha az a "strengths" / "problems" / "dataNotes" / "summary" szövegében szó szerint szerepel. Ne jellemezd a pályán látottakat (pl. "megállíthatatlan volt a gyűrű közelében", "aktívan részt vett a gyors játékban"), és ne írj feltételezett alternatívát (pl. "nélküle nagyobb lett volna a különbség") – csak azt mondd ki, amit a számok és a megadott címkék alátámasztanak.
4. Játékosok: csak a "postgame.playerReport"-ban szereplő saját játékosokról és az ott megadott statisztikáikról írj. Játékperc nincs megadva ("minutesBucket" csak kategória) – percet ne írj. Egyéni szezonátlag nincs az adatok között – játékost ne hasonlíts szezonátlaghoz. Az ellenfél játékosairól csak a "pregame.opponentKeyPlayers" tartalma használható (mérkőzés előtti, szezonadatokból); a mérkőzésen nyújtott egyéni teljesítményükről nincs adat.
5. Irány – kinek kedvez egy tényező: a "postgame.decisiveFactors" minden elemének "tone" mezője a mérvadó: "positive" = a saját csapatnak kedvező, "negative" = kedvezőtlen. Negatív tényezőt soha ne mutass erősségként, pozitívat gyengeségként. A címkékben a jelöletlen "A% vs B%" értékpár első tagja a saját csapaté, a második az ellenfélé; az ellenfél értékét máshol "ellenfél" felirat jelöli. Az "axis": "offense" a saját támadást és a két csapat párharcát írja le, az "axis": "defense" az ellenfél mért értékeit a liga mediánhoz viszonyítva. Ha a "tone" null, az irányról ne állíts semmit.
6. Viszonyítási alap: a "postgame.metrics.keyStats" minden értéke a SAJÁT csapaté (soha nem az ellenfélé); a "reference" és "delta" mezője a "postgame.baseline.label" szerinti alaphoz mér – ez szezonátlag VAGY (kis mintánál) liga medián. Mindig a "baseline.noun" szerint nevezd meg; ha "baseline.smallSample" igaz, egyszer említsd meg a kis mintát, és ne hívd szezonátlagnak. Ha a "baseline" null, "viszonyítási alapként" hivatkozz rá. Ha a "reference" null, nincs viszonyítási alap – ne hasonlíts.
7. Mutatók jelentése – ne cseréld fel őket:
   - eFG% (effektív mezőnyszázalék) NEM azonos a TS%-kal; a csapatszintű mutató az eFG%.
   - FTM rate = értékesített büntető / mezőnykísérlet. Ez NEM büntetőszázalék; a büntetőszázalék a "boxScore" "ftPct" mezője.
   - TO rate (Oliver) = labdaeladás-arány; alacsonyabb a jobb.
   - ORtg / DRtg = szerzett / kapott pont 100 birtoklásra; a DRtg-nél az alacsonyabb a jobb.
   - "metrics.opponent" és "metrics.boxScore.opponent": az ellenfél mért adatai ezen a mérkőzésen.
8. Box score ("postgame.metrics.boxScore"): mezőny- és büntetődobások (dobott / kísérlet / %), támadó-, védő- és összes lepattanó mindkét csapatra. Ha null, ne említsd.
9. Pontforrások ("postgame.metrics.pointSources"): az eseménylistából számított, NEM hivatalos adatok. "secondChancePoints" = második esélyből (támadólepattanó után) szerzett pont; "pointsOffTurnovers" = az ellenfél eladott labdája után szerzett pont; "quickFinishPoints" = labdaszerzés vagy védőlepattanó után "quickFinishSeconds" másodpercen belül szerzett pont. Az utóbbit "gyors befejezésnek" nevezd, ne hivatalos gyorsindítás-pontnak. A három kategória átfedhet: ne add össze őket, és ne számolj belőlük részarányt. Ha null, ne említsd.
10. Ok-okozat: a saját mutatóink visszaesését ne tulajdonítsd tényként az ellenfél védekezésének – ez legfeljebb lehetséges magyarázat ("állhat mögötte"), mert az ellenfél védekezési munkájáról nincs közvetlen mérés.
11. Javaslatok: az edzői és taktikai javaslatok a "nextFocus", "problems", "lineupInsights" és a játékosok "focus" elemeire épüljenek. Javaslatként fogalmazz, ne megtörtént tényként, és ne találj ki új célértéket.
12. Pregame adatok iránya: a "pregame" blokk a mérkőzés ELŐTTI, szezonadatokból készült várakozás – nem a mérkőzésen történtek leírása. Az "opponentProfile", "opponentThreats", "opponentVulnerabilities" és "opponentKeyPlayers" mind az ELLENFELET írják le: az "opponentThreats" az ellenfél erősségei (a saját csapatra leselkedő veszélyek), az "opponentVulnerabilities" az ellenfél támadható gyengeségei – NEM a saját csapat gyengeségei. A saját csapatot az "ownTeamProfile" írja le. A "winProbability" "ownPct" a saját csapat, "opponentPct" az ellenfél előzetes győzelmi esélye. Ne fordítsd meg ezek irányát.
13. X-faktor: a kijelölt X-faktorok teljesülését a "postgame.reflection" szövege dönti el – az ott szereplő ✓ / ↺ / ✗ jelölést változtatás nélkül vedd át, ne bíráld felül, és a magyarázatban csak az ott megadott indokot idézd (saját indoklást ne fűzz hozzá). Az ellenfél hárompontos teljesítményéről kizárólag a "metrics.opponent" mezőből vagy "ellenfél" feliratú címkéből tehetsz állítást; a saját csapat 3P%-a erre nem használható. Ha ilyen adat nincs, a periméter-védekezés "nem értékelhető a rendelkezésre álló adatokból".
14. Adatminőség: a "postgame.dataNotes" megjegyzései korlátozzák, miről lehet állítást tenni (pl. hiányzó ellenfél-statisztika, kihagyott pontforrás) – tartsd tiszteletben.
15. A saját csapat neve az "ownTeamName", az ellenfélé az "opponentName" mező – ezeket a neveket használd.
16. A kész szöveg az olvasónak szól: ne hivatkozz a JSON-ra, mezőnevekre ("tone", "reflection", "struggling", "null" stb.), az adatszerkezetre vagy ezekre a szabályokra. A hiányt természetes mondattal jelezd (pl. "ehhez nem áll rendelkezésre adat").

Egyéb szabályok:
- Ne vond kétségbe az algoritmus döntéseit.
- Ha bizonytalanság szerepel a pre-game elemzésben, azt kontextusként kezeld, nem hibaként.
- Az X-faktor kontextust csak egyszer említsd meg, ne duplikáld sem a pre-, sem a post-game blokkból.
- Narratív, leíró, olvasmányos hangnemben fogalmazz; minden blokk legyen legalább 2 összefüggő mondat (kivéve, ha a 2. szabály szerint nincs hozzá adat).
- A post-game értékelés során mindig köss össze adatot és következményt ("mert" szerkezet vagy ok-okozati fordulat) – a 10. szabály határain belül.
- Ha a "lineupInsights" "available" értéke igaz, legalább 2 mondatban értelmezd az ötös statokat és azok rotációs következményeit; csak a ténylegesen szereplő ötösöket és statjaikat idézd.
- A hangvétel legyen szurkolóbarát: közérthető, de ne leegyszerűsítő; kritikát is építő módon fogalmazz meg.
- Minden fő blokkban szerepeljen legalább egy konkrét szám a JSON-ból, ha a blokkhoz van adat. Inkább kevesebb szám, mint egyetlen kitalált.

Terminológiai egység:
- Magyar kosárlabda-szaknyelvet használj. Megengedett kivétel: a kötelező szerkezet alcímei és a mutatók bevett rövidítései (eFG%, TS%, VAL, VAL/36, ORtg, DRtg, OREB%, TO rate, FTM rate, FG, FT, 3P).
- TILOS kifejezések és kötelező magyarítások (teljes lista, szigorúan betartandó):
  pace → játéktempó | matchup → párosítás / egy az egy elleni párosítás | run → pontsorozat / roham | transition → átmeneti játék | spacing → területnyitás / tér kihasználás | help defense → besegítés / segédvédekezés | closeout → kirobbanás a dobóra | weakside crash → gyengeoldali betörés / gyenge oldali lepattanó-közelítés | drive → kosárra törés / festékbe lépés | kick-out pass → kiengedő passz / kick-out átadás | pick and roll → gát és gurulás | screen → gát / blokk | spot-up → helyzetből dobás / kiszabadult dobás | usage → terhelés / igénybevétel | paint touch → festék-érintés | putback → második esélyes befejezés | stock → szerzett labda (lopás+blokk) | impact → hatás / mérkőzésszintű hatás | engine → motor játékos | MVP → legértékesebb játékos
- Ha egy fogalomra nincs bevett fordítás, körülírd magyarul – ne hagyd angolul.

Kötelező szerkezet (alcímeket is írd ki):
1️⃣ Kiindulási kép – Pre-game kontextus (3–4 mondat)
2️⃣ A mérkőzés tényleges képe – Post-game valóság (legalább 3 mondat: végeredmény a "metrics" alapján, majd a kulcsmutatók eltérése a viszonyítási alaptól; ha van "boxScore" vagy "pointSources", ezekből is emelj ki egy-egy adatot)
3️⃣ Pre-game várakozás vs. realizáció – kezdj egy félkövér alcímmel (**3️⃣ Pre-game várakozás vs. realizáció**), majd minden kulcspontot két sorban írj le: az első sor legyen pl. "✓ **Teljesült**: fókusz", a második sor "  → rövid magyarázat". Használd a ✓ / ↺ / ✗ jelöléseket. Kulcspontként kizárólag a "pregame.focusPoints" elemeit és az X-faktorokat vedd sorra – újat ne vegyél fel. Csak olyan fókuszpontot minősíts, amelyhez a post-game adatokban van megfelelő mutató; a többinél ✓ / ↺ / ✗ jelölés NÉLKÜL, "Nem értékelhető: fókusz" formában írd, egy mondatos indokkal.
4️⃣ Mi döntötte el valójában a mérkőzést? – A "decisiveFactors" "type" és "tone" mezői alapján nevezd meg, hogy hatékonyság-, volumen- vagy kontroll-alapú faktor volt, és térj ki arra is, hogy a kulcsra kijelölt X-faktor miért nem (vagy hogyan) lett tényleges döntő tényező. Zárd le a bekezdést egy javaslattal a következő találkozóra (11. szabály).
4️⃣/b RiskFlags – csak akkor írd meg, ha a "pregame.riskFlags" nem üres (üres listánál a teljes blokkot hagyd ki): önálló bekezdésben, rendezetten sorold fel a bekövetkezett vs. elmaradt kockázatokat; ahol a post-game adat nem dönti el, írd: "nem eldönthető az adatokból".
5️⃣ Játékos-kiemelések – legalább 3, legfeljebb 5 játékost emelj ki, játékosonként 1–2 mondatban:
   - A legértékesebb játékost ("mvp") és a motor játékosokat ("engines") pozitívan emeld ki, mindig adj konkrét statisztikát (VAL, TS%, pont).
   - A "sparkPlugs" játékosoknál mutasd meg az arányos hatást: rövidebb szerep, de érzékelhető lendület.
   - A "struggling" játékosoknál fogalmazz építő kritikát, és zárj megoldási iránnyal a játékos "focus" mezője alapján.
   - Ne gépies felsorolás legyen, hanem olvaszd a játékosokat a narratívába.
   - A TS% és a VAL/36 a legfontosabb mutatók.
   - Ha nincs "mvp" / "engines" adat, a "rotationAndHeavy" lista alapján írj.
6️⃣ Tanulság és alkalmazhatóság – 2–3 mondatban fogalmazd meg, hogyan hasznosítható mindez a következő meccseken/edzéseken (11. szabály).

Plusz elvárások:
- Adj rövid indoklást arra, hogy melyik előzetes fókuszpont miért NEM vált döntővé – csak akkor, ha ezt adat támasztja alá.
- Emeld ki, ha valamely kockázati jelző nem materializálódott – ha az adatokból eldönthető.
- Lineup adatoknál ne abszolút ítéletet írj, hanem valószínűsíthető mintázatot és alkalmazható következő lépést.
- A záró tanulság mindig mutasson előre (edzésfókusz, rotáció, taktikai döntés), pozitív és érthető stílusban.
- Használj kötőszavakat, amelyek segítik a logikus átmenetet ("emiatt", "ezért", "mivel").
- Célzott számtartalom: a teljes szövegben nagyjából 6–12 konkrét szám szerepeljen – mind a JSON-ból.

Stíluselvárás:
- A szöveg legyen olyan, amit egy szurkoló is szívesen végigolvas.
- Kerüld a túl tömör, táblázatszagú mondatokat.
- Rövidebb bekezdésekben, tiszta logikával írd le az összefüggéseket.
- Alkalmazz világos ívet: mit mutatnak az adatok -> mi következik belőlük -> mit érdemes ebből továbbvinni.
- Váltogasd a mondathosszt (rövid + közepes), hogy ne legyen monoton a szöveg.
- Blokkonként 1-2 kulcsszámot emelj ki, és mindig tedd mellé a szakmai következményt.
- Amikor kritikát fogalmazol, megoldási iránnyal zárd a gondolatot.

Formátum és terjedelem:
- A felület egyszerű szövegként jeleníti meg a választ: ne írj főcímet, "#" jeles címsort, elválasztó vonalat ("---") vagy táblázatot. Az alcímeket pontosan a kötelező szerkezet szerinti formában, külön sorban írd ki.
- A számokat az adatokkal egyező értékkel, magyar tizedesvesszővel írd (pl. 52,6%).
- Terjedelem: 20–30 mondat, legfeljebb kb. 5500 karakter. A játékos-kiemelések szekció 4–8 mondat, ha van hozzá játékosadat.`;

const getStyleInstructions = (style: GameTextReportStyle) => {
  if (style === 'fan') {
    return `
Stílusprofil: SZURKOLÓBARÁT
- Közérthető, lendületes nyelv, erős átvezetésekkel.
- Minden bekezdésben legyen legalább 1 konkrét adat (ha van hozzá a JSON-ban), de a hangsúly a magyarázaton legyen.
- Kerüld a túl technikai felsorolásokat, inkább azt magyarázd el, mit jelentenek a számok.`;
  }
  if (style === 'coach') {
    return `
Stílusprofil: EDZŐI
- Tömörebb, szakmaibb és döntéstámogató nyelv.
- Minden fő blokkban legalább 2 konkrét adat vagy delta szerepeljen, ha a JSON-ban van ennyi a blokkhoz.
- A javaslatok legyenek végrehajthatóak (rotáció, párosítás, tempókontroll, lepattanófeladatok).`;
  }
  return `
Stílusprofil: KIEGYENSÚLYOZOTT
- Adatvezérelt, de olvasmányos hangnem.
- Blokkonként 1-2 kulcsszám + egyértelmű következmény.
- A szöveg legyen szakmailag feszes, mégis szurkoló számára követhető.`;
};

/** Alacsony hőmérséklet: az adathűség fontosabb a változatos megfogalmazásnál. */
export const resolveTemperature = (style: GameTextReportStyle) => {
  if (style === 'fan') return 0.3;
  if (style === 'coach') return 0.2;
  return 0.25;
};

/** A modellnek átadott adatkivonat – a visszaellenőrzés is ebből dolgozik. */
export const buildGameTextReportContext = (payload: GameTextReportPayload) => ({
  ownTeamName: payload.postgameReport.teamName || payload.pregameReport.ownTeamName,
  opponentName: payload.opponentName ?? payload.pregameReport.opponentTeamName ?? payload.postgameReport.opponentName,
  stylePreset: payload.stylePreset ?? 'balanced',
  pregame: extractPregameContext(payload.pregameReport),
  postgame: extractPostgameContext(payload.postgameReport),
});

export const buildGameTextReportPrompt = (payload: GameTextReportPayload) => {
  const style = payload.stylePreset ?? 'balanced';
  const context = buildGameTextReportContext(payload);
  const prompt = `${BASE_INSTRUCTIONS}${getStyleInstructions(style)}\n\n### KONKRÉT ADATOK JSON FORMÁBAN\n${JSON.stringify(context, null, 2)}`;
  return { prompt, context };
};

const NUMBER_PATTERN = /\d+(?:[.,]\d+)?/g;
/** Számbillentyű-emoji (pl. 1️⃣) – a szerkezet alcímei, nem adatok. */
const KEYCAP_PATTERN = /\d️?⃣/g;
/** Ennél kisebb egész számot nem ellenőrzünk (pl. „3 pontos”, „2 mondat”). */
const MIN_CHECKED_INTEGER = 10;

const roundTo = (value: number, decimals: number) => {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
};

/**
 * A generált szöveg azon számai, amelyek nem vezethetők vissza a modellnek
 * átadott adatokra. Egy szám akkor igazolt, ha az adatkivonat valamely száma
 * – a szövegbeli tizedesjegyekre kerekítve, vagy 0–1 közötti arány esetén
 * százalékra váltva – megegyezik vele. Tizedes számot mindig, egész számot
 * `MIN_CHECKED_INTEGER`-től ellenőrzünk. Heurisztika: figyelmeztetésre való,
 * nem bizonyítja a szöveg helyességét.
 */
export const findUngroundedNumbers = (narrative: string, context: unknown): string[] => {
  const sourceNumbers = (JSON.stringify(context).match(NUMBER_PATTERN) ?? [])
    .map(token => Number(token.replace(',', '.')))
    .filter(Number.isFinite);

  const ungrounded: string[] = [];
  const seen = new Set<string>();
  for (const token of narrative.replace(KEYCAP_PATTERN, ' ').match(NUMBER_PATTERN) ?? []) {
    if (seen.has(token)) continue;
    seen.add(token);

    const decimals = token.includes('.') || token.includes(',') ? token.split(/[.,]/)[1].length : 0;
    const value = Number(token.replace(',', '.'));
    if (!Number.isFinite(value)) continue;
    if (decimals === 0 && value < MIN_CHECKED_INTEGER) continue;

    const grounded = sourceNumbers.some(source =>
      roundTo(source, decimals) === value ||
      (source > 0 && source < 1 && roundTo(source * 100, decimals) === value)
    );
    if (!grounded) ungrounded.push(token);
  }
  return ungrounded;
};
