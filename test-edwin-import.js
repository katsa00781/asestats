const testData = `Atomerőmű SE
Közeli	Középtávoli	Távoli	Büntető	Lepattanó	Labda	Fault	GP	Blokk	VAL	Fejlett statisztika
#	Játékos	K.	P.	Idő	S	K	%	S	K	%	S	K	%	S	K	%	V	T	Ö	SZ	EL	SA	KI		SA	KA		O.RTG	D.RTG	TS%	ES%
3	
Hicks Tony Hollis
Hicks Tony Hollis
*	28	39	6	8	75	0	0	0	4	9	44.4	4	4	100	5	2	7	1	2	3	3	12	0	0	42	148.1	100.9	73.7	70.6
2	
Bluiett Trevon Nykee
Bluiett Trevon Nykee
*	23	35	4	5	80	0	0	0	5	10	50	0	0	0	2	1	3	1	1	3	3	1	0	0	24	133.4	103.4	76.7	76.7
7	
Eilingsfeld János
Eilingsfeld János
*	13	35	1	1	100	0	0	0	2	7	28.6	5	6	83.3	4	0	4	2	3	1	5	2	0	0	17	73.4	98.5	59.1	50
4	
Edosomwan Kinsley Nehizena
Edosomwan Kinsley Nehizena
*	13	21	5	5	100	0	0	0	0	0	0	3	6	50	4	1	5	1	1	4	4	2	0	0	21	136.9	119	81.3	100
12	
Halmai Dániel
Halmai Dániel
*	4	21	2	2	100	0	1	0	0	2	0	0	0	0	0	0	0	1	0	3	1	6	0	0	9	157.5	118.9	40	40
0	
Edwin Deon Javern
Edwin Deon Javern
4	22	1	3	33.3	1	2	50	0	0	0	0	1	0	0	0	0	0	2	3	1	1	0	0	0	68.9	104.5	40	40
10	
Révész Ádám
Révész Ádám
7	20	2	3	66.7	0	0	0	1	2	50	0	0	0	1	1	2	0	2	4	0	1	0	0	6	77.9	90.9	70	70
22	
Krivacevic Markó
Krivacevic Markó
2	4	1	1	100	0	0	0	0	0	0	0	0	0	1	0	1	0	0	2	0	0	0	0	3	200	123.9	100	100
13	
Géringer Gergő
Géringer Gergő
0	3	0	0	0	0	0	0	0	1	0	0	0	0	0	0	0	1	0	1	1	1	0	0	2	100	120	0	0
1	
Nagy Dániel
Nagy Dániel
0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
41	
Cohill Eric Edward
Cohill Eric Edward
0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
15	
Arnold Botond
Arnold Botond
0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0
94	200	22	28	78.6	1	3	33.3	12	31	38.7	12	17	70.6	17	5	22	7	11	24	18	26	0	0	124	125.3	116.0	67.6	66.1`;

const lines = testData.trim().split('\n').map(l => l.trim()).filter(l => l);

console.log('=== ADATSZERKEZET ELEMZÉSE ===\n');
console.log(`Összes sor: ${lines.length}\n`);

for (let i = 0; i < Math.min(50, lines.length); i++) {
  const line = lines[i];
  const tabParts = line.split('\t').filter(p => p.trim());
  console.log(`Sor ${i}: "${line.substring(0, 60)}..." TAB: ${tabParts.length}`);
  
  // Edwin adatainak keresése
  if (line.includes('Edwin')) {
    console.log(`  >>> EDWIN SOR: "${line}"`);
    console.log(`  >>> Tab részek:`, tabParts);
  }
}

console.log('\n=== EDWIN KÖRNYÉKE ===');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('Edwin') || lines[i] === '0') {
    console.log(`Sor ${i-2}: "${lines[i-2] || 'N/A'}"`);
    console.log(`Sor ${i-1}: "${lines[i-1] || 'N/A'}"`);
    console.log(`Sor ${i}: "${lines[i]}" <<< Edwin környéke`);
    console.log(`Sor ${i+1}: "${lines[i+1] || 'N/A'}"`);
    console.log(`Sor ${i+2}: "${lines[i+2] || 'N/A'}"`);
    
    // Ellenőrizzük a következő sort tab-okra
    if (lines[i+1]) {
      const nextTabParts = lines[i+1].split('\t').filter(p => p.trim());
      console.log(`  Következő sor TAB részek (${nextTabParts.length}):`, nextTabParts.slice(0, 10));
    }
    break;
  }
}
