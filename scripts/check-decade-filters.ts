import {
  generateDecadeWindows,
  isPlayerInWindow,
  filterAthletes,
  matchesGeo,
} from '../src/goat/decadeFilters';

const windows = generateDecadeWindows();
console.log('fenêtres', windows.length, windows[0].label, '…', windows.at(-1)?.label);

const cases: Array<[string, number, number, number, number, boolean]> = [
  ['chevauchement partiel', 1988, 2002, 1995, 2005, true],
  ['avant la fenêtre', 1950, 1960, 1995, 2005, false],
  ['après la fenêtre', 2010, 2020, 1995, 2005, false],
  ['borne exacte', 2005, 2012, 1995, 2005, true],
  ['carrière d’un an', 1999, 1999, 1995, 2005, true],
];

let ok = true;
for (const [label, cs, ce, ws, we, expected] of cases) {
  const got = isPlayerInWindow({ careerStart: cs, careerEnd: ce }, ws, we);
  if (got !== expected) ok = false;
  console.log(got === expected ? '✓' : '✗', label, got);
}

const players = [
  { name: 'A', careerStart: 1950, careerEnd: 1965, countryCode: 'FR' },
  { name: 'B', careerStart: 1990, careerEnd: 2005, countryCode: 'BR' },
  { name: 'C', careerStart: 1998, careerEnd: 2012, countryCode: 'FR' },
];

console.log('1950-1960', filterAthletes(players, { window: windows.find((w) => w.id === '1950-1960')!, scope: 'monde' }).map((p) => p.name));
console.log('1995-2005 mondial', filterAthletes(players, { window: windows.find((w) => w.id === '1995-2005')!, scope: 'monde' }).map((p) => p.name));
console.log('1995-2005 national FR', filterAthletes(players, { window: windows.find((w) => w.id === '1995-2005')!, scope: 'national' }).map((p) => p.name));
console.log('geo monde', matchesGeo({ countryCode: 'BR' }, { scope: 'monde' }));
console.log('geo FR sur BR', matchesGeo({ countryCode: 'BR' }, { scope: 'national' }));
console.log('geo FR sur fr', matchesGeo({ countryCode: 'fr' }, { scope: 'national' }));
console.log(ok ? 'TOUT OK' : 'ÉCHEC');
