export interface GolPattern {
  name: string;
  tag: string;
  cells: boolean[][];
}

function parse(s: string): boolean[][] {
  return s.trim().split('\n').map(row => [...row].map(c => c === 'O'));
}

export const GOL_PATTERNS: GolPattern[] = [
  {
    name: 'Gosper Glider Gun',
    tag: '→ infinite',
    cells: parse(
      '........................O...........\n' +
      '......................O.O...........\n' +
      '............OO......OO............OO\n' +
      '...........O...O....OO............OO\n' +
      'OO........O.....O...OO..............\n' +
      'OO........O...O.OO....O.O...........\n' +
      '..........O.....O.......O...........\n' +
      '...........O...O....................\n' +
      '............OO......................'
    ),
  },
  {
    name: 'Pulsar',
    tag: 'period 3',
    cells: parse(
      '..OOO...OOO..\n' +
      '.............\n' +
      'O....O.O....O\n' +
      'O....O.O....O\n' +
      'O....O.O....O\n' +
      '..OOO...OOO..\n' +
      '.............\n' +
      '..OOO...OOO..\n' +
      'O....O.O....O\n' +
      'O....O.O....O\n' +
      'O....O.O....O\n' +
      '.............\n' +
      '..OOO...OOO..'
    ),
  },
  {
    name: 'LWSS Spaceship',
    tag: '→ travels',
    cells: parse(
      '.O..O\n' +
      'O....\n' +
      'O...O\n' +
      'OOOO.'
    ),
  },
  {
    name: 'R-Pentomino',
    tag: 'chaotic',
    cells: parse(
      '.OO\n' +
      'OO.\n' +
      '.O.'
    ),
  },
];
