export const GLYPH_WIDTH = 5;
export const GLYPH_HEIGHT = 7;
export const GLYPH_SPACING = 1;

// Each character is a 5x7 bitmap encoded as 7 numbers (one per row, 5 bits each)
export const PIXEL_FONT: Record<string, number[]> = {
  A: [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  B: [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
  C: [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
  D: [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
  E: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
  F: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
  G: [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01110],
  H: [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  I: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b11111],
  J: [0b00111, 0b00010, 0b00010, 0b00010, 0b00010, 0b10010, 0b01100],
  K: [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
  L: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
  M: [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001],
  N: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
  O: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  P: [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
  Q: [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101],
  R: [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
  S: [0b01110, 0b10001, 0b10000, 0b01110, 0b00001, 0b10001, 0b01110],
  T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  U: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  V: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
  W: [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b11011, 0b10001],
  X: [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
  Y: [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100],
  Z: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111],
  ' ': [0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000],
};

export function textToPattern(text: string, scale: number = 1): boolean[][] {
  const lines = text.toUpperCase().split('\n');
  const linePatterns: boolean[][][] = [];

  for (const line of lines) {
    const chars = line.split('');
    const lineWidth = chars.length * (GLYPH_WIDTH + GLYPH_SPACING) - GLYPH_SPACING;
    const pattern: boolean[][] = Array.from({ length: GLYPH_HEIGHT }, () =>
      Array(lineWidth).fill(false)
    );

    for (let ci = 0; ci < chars.length; ci++) {
      const glyph = PIXEL_FONT[chars[ci]] ?? PIXEL_FONT[' ']!;
      const xOff = ci * (GLYPH_WIDTH + GLYPH_SPACING);
      for (let row = 0; row < GLYPH_HEIGHT; row++) {
        for (let bit = 0; bit < GLYPH_WIDTH; bit++) {
          if (glyph[row] & (1 << (GLYPH_WIDTH - 1 - bit))) {
            pattern[row][xOff + bit] = true;
          }
        }
      }
    }
    linePatterns.push(pattern);
  }

  // Combine lines vertically with 2-row gap
  const totalHeight = linePatterns.reduce((sum, p) => sum + p.length, 0) + (linePatterns.length - 1) * 2;
  const maxWidth = Math.max(...linePatterns.map(p => p[0]?.length ?? 0));
  const combined: boolean[][] = Array.from({ length: totalHeight }, () =>
    Array(maxWidth).fill(false)
  );

  let yOff = 0;
  for (const lp of linePatterns) {
    const xOff = Math.floor((maxWidth - (lp[0]?.length ?? 0)) / 2);
    for (let row = 0; row < lp.length; row++) {
      for (let col = 0; col < lp[row].length; col++) {
        combined[yOff + row][xOff + col] = lp[row][col];
      }
    }
    yOff += lp.length + 2;
  }

  if (scale === 1) return combined;

  // Scale up
  const scaled: boolean[][] = Array.from({ length: combined.length * scale }, () =>
    Array(maxWidth * scale).fill(false)
  );
  for (let y = 0; y < combined.length; y++) {
    for (let x = 0; x < combined[y].length; x++) {
      if (combined[y][x]) {
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            scaled[y * scale + sy][x * scale + sx] = true;
          }
        }
      }
    }
  }
  return scaled;
}
