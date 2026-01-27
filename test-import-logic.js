// Szimuláljuk az import logikát

const lines = [
  'Atomerőmű SE',
  'Közeli\tKözéptávoli\tTávoli...',
  '#\tJátékos\tK.\tP.\t...',
  '3',
  'Hicks Tony Hollis',
  'Hicks Tony Hollis',
  '*\t28\t39\t6\t8\t75\t0\t0\t0\t4\t9\t44.4\t4\t4\t100\t5\t2\t7\t1\t2\t3\t3\t12\t0\t0\t42\t148.1\t100.9\t73.7\t70.6',
  '0',
  'Edwin Deon Javern',
  'Edwin Deon Javern',
  '4\t22\t1\t3\t33.3\t1\t2\t50\t0\t0\t0\t0\t1\t0\t0\t0\t0\t0\t2\t3\t1\t1\t0\t0\t0\t68.9\t104.5\t40\t40'
];

console.log('=== Hicks feldolgozása (i=6) ===');
let i = 6;
let tabParts = lines[i].split('\t').filter(p => p.trim());
console.log('TAB részek száma:', tabParts.length);

let playerNumber = -1; // -1 = még nem találtunk
let playerName = '';

// Az előző 4 sorban keressük
for (let j = Math.max(0, i - 4); j < i; j++) {
  const prevLine = lines[j].trim();
  console.log(`  Sor ${j}: "${prevLine}"`);
  
  if (/^\d{1,2}$/.test(prevLine) && playerNumber === -1) {
    const num = parseInt(prevLine);
    if (num >= 0 && num < 100) {
      playerNumber = num;
      console.log(`    -> Mezszám találat: ${num}`);
    }
  }
  
  if (prevLine && !/^\d+$/.test(prevLine) && prevLine !== '*' && prevLine.length > 2) {
    if (!playerName || prevLine !== playerName) {
      playerName = prevLine;
      console.log(`    -> Név találat: "${prevLine}"`);
    }
  }
}

console.log('Eredmény:', playerNumber, playerName);

console.log('\n=== Edwin feldolgozása (i=10) ===');
i = 10;
tabParts = lines[i].split('\t').filter(p => p.trim());
console.log('TAB részek száma:', tabParts.length);

playerNumber = -1;
playerName = '';

// Az előző 4 sorban keressük
for (let j = Math.max(0, i - 4); j < i; j++) {
  const prevLine = lines[j].trim();
  console.log(`  Sor ${j}: "${prevLine}"`);
  
  if (/^\d{1,2}$/.test(prevLine) && playerNumber === -1) {
    const num = parseInt(prevLine);
    if (num >= 0 && num < 100) {
      playerNumber = num;
      console.log(`    -> Mezszám találat: ${num}`);
    }
  }
  
  if (prevLine && !/^\d+$/.test(prevLine) && prevLine !== '*' && prevLine.length > 2) {
    if (!playerName || prevLine !== playerName) {
      playerName = prevLine;
      console.log(`    -> Név találat: "${prevLine}"`);
    }
  }
}

console.log('Eredmény:', playerNumber, playerName);
