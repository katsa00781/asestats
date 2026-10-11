// Valós adat: Atomerőmű SE – Sopron KC 109–80 (2026-10-10, Kosarstat
// 20261010102163). Az eseménylista csere-sorai (mind az 58) és a lineup oldal
// percrácsa (table_7 – hazai, table_12 – vendég) változtatás nélkül.

export const EVENT_HEADERS = ["minutes","home_event","result","away_event","row","row_type","h_ev_form","a_ev_form","sub_form","res_form","home_player_filter","away_player_filter"];

/** `[óra, hazai esemény, vendég esemény, hazai névszűrő, vendég névszűrő]` – a többi oszlop a teszthez nem kell. */
const COMPACT_ROWS: Array<[string, string, string, string, string]> = [
  ["Q1 9:45", "", "Meszlényi R. fault (J. Chandler ellen)", "Jay Jay CHANDLER", "MESZLÉNYI Róbert"],
  ["Q1 9:45", "J. Chandler sikeres büntető 1 pont", "", "Jay Jay CHANDLER", ""],
  ["Q1 9:45", "J. Chandler sikeres büntető 1 pont", "", "Jay Jay CHANDLER", ""],
  ["Q1 6:31", "", "Csere: Meszlényi R. helyett Ruják A.", "", "MESZLÉNYI Róbert RUJÁK András"],
  ["Q1 4:28", "Csere: Y. Joseph helyett Eilingsfeld J.", "", "Yasiin JOSEPH EILINGSFELD János", ""],
  ["Q1 4:28", "Csere: Révész Á. helyett Halmai D.", "", "RÉVÉSZ Ádám HALMAI Dániel", ""],
  ["Q1 4:28", "", "Csere: T. Wertz helyett Hajdu P.", "", "Trey WERTZ HAJDU Péter"],
  ["Q1 2:36", "", "Csere: R. Ford III helyett T. Wertz", "", "Robert FORD III Trey WERTZ"],
  ["Q1 2:36", "Csere: J. Chandler helyett C. Daniels", "", "Jay Jay CHANDLER Clarence DANIELS", ""],
  ["Q1 2:36", "Csere: Benke S. helyett Géringer G.", "", "BENKE Szilárd GÉRINGER Gergő", ""],
  ["Q1 2:36", "Csere: K. Young helyett Krivacsevics M.", "", "Kalif YOUNG KRIVACSEVICS Markó", ""],
  ["Q1 1:12", "", "Csere: D. Proleta helyett Kelenföldi D.", "", "Domagoj PROLETA KELENFÖLDI Domonkos"],
  ["Q1 0:00", "", "Csere: Kucsera D. helyett Kovács B.", "", "KUCSERA Dániel KOVÁCS Benedek"],
  ["Q2 8:37", "Csere: Krivacsevics M. helyett Révész Á.", "", "KRIVACSEVICS Markó RÉVÉSZ Ádám", ""],
  ["Q2 8:37", "", "Csere: Ruják A. helyett R. Ford III", "", "RUJÁK András Robert FORD III"],
  ["Q2 8:37", "Csere: Géringer G. helyett Benke S.", "", "GÉRINGER Gergő BENKE Szilárd", ""],
  ["Q2 7:44", "", "Csere: T. Wertz helyett Meszlényi R.", "", "Trey WERTZ MESZLÉNYI Róbert"],
  ["Q2 7:44", "", "Csere: Kelenföldi D. helyett D. Proleta", "", "KELENFÖLDI Domonkos Domagoj PROLETA"],
  ["Q2 7:12", "", "Csere: Hajdu P. helyett Kucsera D.", "", "HAJDU Péter KUCSERA Dániel"],
  ["Q2 7:12", "Csere: C. Daniels helyett J. Chandler", "", "Clarence DANIELS Jay Jay CHANDLER", ""],
  ["Q2 6:26", "Csere: Halmai D. helyett Y. Joseph", "", "HALMAI Dániel Yasiin JOSEPH", ""],
  ["Q2 6:11", "", "Csere: Kovács B. helyett T. Wertz", "", "KOVÁCS Benedek Trey WERTZ"],
  ["Q2 6:04", "Csere: Eilingsfeld J. helyett K. Young", "", "EILINGSFELD János Kalif YOUNG", ""],
  ["Q2 4:26", "Csere: Révész Á. helyett Géringer G.", "", "RÉVÉSZ Ádám GÉRINGER Gergő", ""],
  ["Q2 3:42", "Csere: Y. Joseph helyett Halmai D.", "", "Yasiin JOSEPH HALMAI Dániel", ""],
  ["Q2 2:01", "", "Csere: R. Ford III helyett Ruják A.", "", "Robert FORD III RUJÁK András"],
  ["Q2 2:01", "Csere: J. Chandler helyett C. Daniels", "", "Jay Jay CHANDLER Clarence DANIELS", ""],
  ["Q2 0:00", "Csere: Géringer G. helyett J. Chandler", "", "GÉRINGER Gergő Jay Jay CHANDLER", ""],
  ["Q2 0:00", "Csere: C. Daniels helyett Y. Joseph", "", "Clarence DANIELS Yasiin JOSEPH", ""],
  ["Q2 0:00", "Csere: Halmai D. helyett Révész Á.", "", "HALMAI Dániel RÉVÉSZ Ádám", ""],
  ["Q2 0:00", "", "Csere: Meszlényi R. helyett Hajdu P.", "", "MESZLÉNYI Róbert HAJDU Péter"],
  ["Q3 8:32", "", "Csere: D. Proleta helyett Kelenföldi D.", "", "Domagoj PROLETA KELENFÖLDI Domonkos"],
  ["Q3 8:11", "", "Csere: Hajdu P. helyett Meszlényi R.", "", "HAJDU Péter MESZLÉNYI Róbert"],
  ["Q3 6:08", "Csere: Y. Joseph helyett Halmai D.", "", "Yasiin JOSEPH HALMAI Dániel", ""],
  ["Q3 6:08", "", "Csere: Ruják A. helyett R. Ford III", "", "RUJÁK András Robert FORD III"],
  ["Q3 4:57", "Csere: Révész Á. helyett Géringer G.", "", "RÉVÉSZ Ádám GÉRINGER Gergő", ""],
  ["Q3 4:57", "", "Csere: Kelenföldi D. helyett Kovács B.", "", "KELENFÖLDI Domonkos KOVÁCS Benedek"],
  ["Q3 3:55", "Csere: Benke S. helyett C. Daniels", "", "BENKE Szilárd Clarence DANIELS", ""],
  ["Q3 3:55", "", "Csere: T. Wertz helyett Ruják A.", "", "Trey WERTZ RUJÁK András"],
  ["Q3 2:18", "Csere: K. Young helyett Révész Á.", "", "Kalif YOUNG RÉVÉSZ Ádám", ""],
  ["Q3 2:18", "", "Csere: Kucsera D. helyett D. Proleta", "", "KUCSERA Dániel Domagoj PROLETA"],
  ["Q3 1:30", "Csere: Géringer G. helyett Eilingsfeld J.", "", "GÉRINGER Gergő EILINGSFELD János", ""],
  ["Q3 0:00", "Csere: J. Chandler helyett Y. Joseph", "", "Jay Jay CHANDLER Yasiin JOSEPH", ""],
  ["Q3 0:00", "Csere: Halmai D. helyett Benke S.", "", "HALMAI Dániel BENKE Szilárd", ""],
  ["Q3 0:00", "", "Csere: Meszlényi R. helyett T. Wertz", "", "MESZLÉNYI Róbert Trey WERTZ"],
  ["Q3 0:00", "", "Csere: D. Proleta helyett Kucsera D.", "", "Domagoj PROLETA KUCSERA Dániel"],
  ["Q4 9:42", "Csere: Révész Á. helyett K. Young", "", "RÉVÉSZ Ádám Kalif YOUNG", ""],
  ["Q4 6:44", "", "Csere: R. Ford III helyett Hajdu P.", "", "Robert FORD III HAJDU Péter"],
  ["Q4 6:11", "", "Csere: Kucsera D. helyett Kelenföldi D.", "", "KUCSERA Dániel KELENFÖLDI Domonkos"],
  ["Q4 5:53", "Csere: K. Young helyett Krivacsevics M.", "", "Kalif YOUNG KRIVACSEVICS Markó", ""],
  ["Q4 4:49", "Csere: Y. Joseph helyett J. Chandler", "", "Yasiin JOSEPH Jay Jay CHANDLER", ""],
  ["Q4 4:49", "Csere: C. Daniels helyett Géringer G.", "", "Clarence DANIELS GÉRINGER Gergő", ""],
  ["Q4 4:49", "Csere: Eilingsfeld J. helyett Révész Á.", "", "EILINGSFELD János RÉVÉSZ Ádám", ""],
  ["Q4 4:49", "Csere: Benke S. helyett Halmai D.", "", "BENKE Szilárd HALMAI Dániel", ""],
  ["Q4 4:49", "Csere: J. Chandler helyett Merkl B.", "", "Jay Jay CHANDLER MERKL Barna", ""],
  ["Q4 4:49", "Csere: Révész Á. helyett C. Daniels", "", "RÉVÉSZ Ádám Clarence DANIELS", ""],
  ["Q4 4:49", "", "Csere: Ruják A. helyett D. Proleta", "", "RUJÁK András Domagoj PROLETA"],
  ["Q4 4:16", "", "Csere: Kovács B. helyett Meszlényi R.", "", "KOVÁCS Benedek MESZLÉNYI Róbert"],
  ["Q4 2:35", "Csere: Krivacsevics M. helyett Révész Á.", "", "KRIVACSEVICS Markó RÉVÉSZ Ádám", ""],
  ["Q4 2:35", "", "Csere: T. Wertz helyett Keller B.", "", "Trey WERTZ KELLER Bendegúz"],
  ["Q4 0:49", "", "Csere: D. Proleta helyett Kucsera D.", "", "Domagoj PROLETA KUCSERA Dániel"],
];

// Fejléc-sorok (negyed, oszlopcímek, kezdő ötös): `row_type` 1 / 2 / 4 – nem játékesemények.
const HEADER_ROWS: string[][] = [["","1. negyed","","","0.1","1","","","","","",""],["Idő","ATOMERŐMŰ SE","Ered.","SOPRON KC","0.2","2","","","","","",""],["","Yasiin JOSEPH | Jay Jay CHANDLER | BENKE SzilárdRÉVÉSZ Ádám | Kalif YOUNG","","Robert FORD III | Trey WERTZ | MESZLÉNYI RóbertKUCSERA Dániel | Domagoj PROLETA","0.9","4","","","","","",""]];

export const EVENT_ROWS: string[][] = [
  ...HEADER_ROWS,
  ...COMPACT_ROWS.map(([minutes, home, away, homeFilter, awayFilter], index) => [
    minutes, home, "", away, `${index + 1}.0`, "3", "0", "0", home.startsWith("Csere") || away.startsWith("Csere") ? "1" : "0", "0", homeFilter, awayFilter,
  ]),
];

/** `[játékos, a 40 perc kódjai]` – 1 = végig pályán, 2 = beállt, 3 = lejött, 0 = padon. */
export const HOME_GRID: Array<[string, string]> = [
  ["BENKE Szilárd", "1111111300021111111111111130002111130000"],
  ["Kalif YOUNG", "1111111300000211111111111113002111300000"],
  ["HALMAI Dániel", "0000021111111300211130021111113000021111"],
  ["Jay Jay CHANDLER", "1111111300002111130021111111113000030000"],
  ["Clarence DANIELS", "0000000211113000021130000021111111131111"],
  ["RÉVÉSZ Ádám", "1111130000021113000021111302113000030211"],
  ["Yasiin JOSEPH", "1111130000000211300021130000002111130000"],
  ["GÉRINGER Gergő", "0000000211130002111130000211300000021111"],
  ["EILINGSFELD János", "0000021111111300000000000000211111130000"],
  ["KRIVACSEVICS Markó", "0000000211130000000000000000000000211300"],
  ["MERKL Barna", "0000000000000000000000000000000000021111"],
];

/** `[játékos, a 40 perc kódjai]` – 1 = végig pályán, 2 = beállt, 3 = lejött, 0 = padon. */
export const AWAY_GRID: Array<[string, string]> = [
  ["Trey WERTZ", "1111130211113211111111111130002111111300"],
  ["KUCSERA Dániel", "1111111111302111111111111113002113000002"],
  ["Domagoj PROLETA", "1111111130002111111113000002113000021113"],
  ["MESZLÉNYI Róbert", "1113000000002111111132111111113000021111"],
  ["Robert FORD III", "1111111300021111130000021111111113000000"],
  ["RUJÁK András", "0002111111130000021111130021111111130000"],
  ["HAJDU Péter", "0000021111113000000023000000000002111111"],
  ["KOVÁCS Benedek", "0000000000211300000000000211111111130000"],
  ["KELENFÖLDI Domonkos", "0000000021113000000002111300000002111111"],
  ["KELLER Bendegúz", "0000000000000000000000000000000000000211"],
];
