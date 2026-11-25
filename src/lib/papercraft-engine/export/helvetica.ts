/**
 * Helvetica, the font every PDF reader has built in, so a PDF can carry text without a font file. The widths are the standard
 * Helvetica metrics (thousandths of the font size) for the printable ASCII characters; a few Latin-1 letters share the width of
 * their base letter. Text is encoded as WinAnsi (Latin-1 for the characters used here), so å, ä and ö work.
 */

// Characters 32 to 126.
const REGULAR = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

const BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

const LATIN1_AS: Record<string, string> = {
  å: 'a', ä: 'a', à: 'a', á: 'a', â: 'a', ã: 'a',
  Å: 'A', Ä: 'A', À: 'A', Á: 'A', Â: 'A', Ã: 'A',
  ö: 'o', ó: 'o', ò: 'o', ô: 'o', õ: 'o',
  Ö: 'O', Ó: 'O', Ò: 'O', Ô: 'O', Õ: 'O',
  é: 'e', è: 'e', ê: 'e', ë: 'e',
  É: 'E', È: 'E', Ê: 'E', Ë: 'E',
  ü: 'u', ú: 'u', ù: 'u', û: 'u',
  Ü: 'U', Ú: 'U', Ù: 'U', Û: 'U',
  í: 'i', ì: 'i', î: 'i', ï: 'i',
  ç: 'c', ñ: 'n',
};

/** Width of one character in thousandths of the font size. */
function charWidth(ch: string, bold: boolean): number {
  const table = bold ? BOLD : REGULAR;
  const base = LATIN1_AS[ch] ?? ch;
  const code = base.charCodeAt(0);
  if (code >= 32 && code <= 126) return table[code - 32];
  if (ch === '²') return 333;
  if (ch === '×') return 584;
  if (ch === '°') return 400;
  if (ch === '·') return 278;
  return 556;
}

/** Width in millimetres of `text` set at `sizeMm` (the height of the font's em square). */
export function textWidthMm(text: string, sizeMm: number, bold = false): number {
  let w = 0;
  for (const ch of text) w += charWidth(ch, bold);
  return (w / 1000) * sizeMm;
}

/** Breaks `text` into lines no wider than `maxWidthMm`. A word wider than a line gets a line of its own. */
export function wrapText(text: string, maxWidthMm: number, sizeMm: number, bold = false): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && textWidthMm(next, sizeMm, bold) > maxWidthMm) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** The characters of `text` as WinAnsi codes (anything that has none becomes "?"). */
export function toWinAnsi(text: string): number[] {
  const out: number[] = [];
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code === 0x2013 || code === 0x2014) out.push(0x2d); // dashes
    else if (code === 0x2018 || code === 0x2019) out.push(0x27);
    else if (code === 0x201c || code === 0x201d) out.push(0x22);
    else if (code === 0xa0) out.push(0x20);
    else out.push(code >= 32 && code <= 255 ? code : 0x3f);
  }
  return out;
}
