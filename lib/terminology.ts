export type TerminologyEntry = {
  term: string;
  definition: string;
  coverage?: string[];
  conditions?: string[];
  metrics?: string[];
  notes?: string[];
};

export type TerminologySection = {
  id: string;
  title: string;
  entries: TerminologyEntry[];
};

export const terminologySections: TerminologySection[] = [
  {
    id: 'spatial-offense',
    title: 'Térbeli / támadási orientációk',
    entries: [
      {
        term: 'Periméter',
        definition:
          'A hárompontos vonalon kívüli dobásokhoz és az ezekhez kapcsolódó labdakezelési, döntéshozatali szituációkhoz kötődő támadó és védekező tevékenységek összessége.',
        coverage: ['3PA, 3P%', '3PA / FGA', 'Guard + Wing usage', 'Engedett 3PA, engedett 3P%'],
        notes: ['A periméter funkcionális fogalom, nem geometriai terület.'],
      },
      {
        term: 'Festék',
        definition:
          'A gyűrűhöz közeli befejezésekre, posztjátékra és belső penetrációkra épülő támadási fókusz.',
        conditions: ['2P arány ≥ ligaátlag', 'Pontok ≥ 55%-a 2P-ből'],
      },
      {
        term: 'Periméter-orientált támadás',
        definition:
          'A scoring elsődlegesen hárompontos dobásokból és periméter-döntésekből származik.',
      },
      {
        term: 'Festék-orientált támadás',
        definition:
          'A támadás elsődlegesen a kosár körül generál előnyt, a periméter kiegészítő szerepet tölt be.',
      },
    ],
  },
  {
    id: 'tempo-dynamics',
    title: 'Tempó és támadásdinamika',
    entries: [
      {
        term: 'Magas tempó',
        definition:
          'A támadások gyors lefolyásúak, kevés másodperces döntéshozatallal.',
        metrics: ['Possessions / game', 'Early offense arány'],
      },
      {
        term: 'Alacsony tempó',
        definition: 'Tudatosan lassított támadások, set play dominancia.',
      },
      {
        term: 'Variancia-alapú támadás',
        definition:
          'Magas triplavolumenre épülő játék, amely nagy kilengéseket eredményezhet mérkőzésről mérkőzésre.',
      },
    ],
  },
  {
    id: 'efficiency',
    title: 'Hatékonysági fogalmak',
    entries: [
      {
        term: 'Dobáshatékonyság',
        definition: 'A dobások értékéhez viszonyított sikeresség.',
        metrics: ['FG%', 'eFG%', 'TS% (ha elérhető)'],
      },
      {
        term: 'Gyenge periméter-hatékonyság',
        definition:
          'A hárompontos dobások hatékonysága a ligaátlag alatt marad, különösen nyomás alatt.',
      },
      {
        term: 'Tudatos spacing',
        definition:
          'Alacsonyabb triplavolumen, de magas 3P%, ami szelektált dobásminőséget jelez.',
      },
    ],
  },
  {
    id: 'roles',
    title: 'Roster és szerepkörök (Role-alapú elemzés)',
    entries: [
      {
        term: 'Offensive Hub',
        definition: 'A támadás elsődleges szervezője, magas usage és assziszt arány.',
      },
      {
        term: 'Scoring Wing',
        definition: 'Periméterről és betörésekből is pontszerző wing játékos.',
      },
      {
        term: 'Primary Ball Handler',
        definition: 'A támadások első számú labdahozója.',
      },
      {
        term: 'Secondary Playmaker',
        definition: 'Nem elsődleges irányító, de rendszeresen hoz döntéseket periméteren.',
      },
      {
        term: 'Floor Spacer',
        definition: 'A pálya széthúzásáért felelős játékos, magas 3P% vagy gravity.',
      },
      {
        term: '3&D Wing',
        definition: 'Periméter-védekezésben és triplázásban is értéket hozó wing.',
      },
      {
        term: 'Defensive Guard',
        definition: 'Elsődlegesen védekezési szerepkörű guard, labdanyomás és closeout fókusz.',
      },
      {
        term: 'Rim Protector',
        definition: 'A gyűrű körüli védekezésért felelős játékos, blokkokkal és festékvédelemmel.',
      },
    ],
  },
  {
    id: 'defense-profiles',
    title: 'Védekezési profilok',
    entries: [
      {
        term: 'Kiegyensúlyozott védekezés',
        definition: 'Nincs kiemelkedő gyenge pont sem periméteren, sem a festékben.',
      },
      {
        term: 'Periméter-sérülékeny védekezés',
        definition: 'Az ellenfél hatékonyan vagy nagy volumenben dob kintről.',
      },
      {
        term: 'Festék-sérülékeny védekezés',
        definition: 'Magas 2P hatékonyság vagy ponttermelés engedése a gyűrű közelében.',
      },
    ],
  },
  {
    id: 'usage',
    title: 'Usage és eloszlás',
    entries: [
      {
        term: 'Usage koncentráció',
        definition: 'A támadó terhelés eloszlása a játékosok között.',
      },
      {
        term: 'Magas usage koncentráció',
        definition: 'A támadás 1–2 játékostól erősen függ.',
      },
      {
        term: 'Kiegyensúlyozott usage',
        definition: 'A scoring több forrásból érkezik, nincs túlterhelt első opció.',
      },
    ],
  },
  {
    id: 'pregame-postgame',
    title: 'Pre-game / Post-game fogalmak',
    entries: [
      {
        term: 'Fő veszély',
        definition: 'Az ellenfél azon játékeleme, amely meccsdöntő futást okozhat.',
      },
      {
        term: 'Sebezhetőség',
        definition: 'Statisztikailag azonosítható gyenge pont, amely célzott game plan-nel támadható.',
      },
      {
        term: 'Mismatch',
        definition: 'Poszt-, méret- vagy szerepkörbeli előny, amely egyéni támadással kihasználható.',
      },
    ],
  },
  {
    id: 'notes',
    title: 'Elemzési megjegyzés',
    entries: [
      {
        term: 'Szótár célja',
        definition:
          'Egységes nyelvezetet biztosít az app teljes kimenetében, csökkenti a szubjektív megfogalmazást, és lehetővé teszi a későbbi automatizált report-generálást.',
        notes: ['Verziózás és liga-specifikus finomítás javasolt.'],
      },
    ],
  },
];