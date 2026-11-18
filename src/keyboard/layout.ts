import type { Lang } from '../i18n';

/**
 * iOS-like layouts. Pure data + geometry, no DOM:
 * used both by the timeline generator (what to press) and the renderer (where to draw).
 */
export type Page = 'letters' | 'symbols' | 'symbols2';

export type SpecialKey =
  | 'shift'
  | 'backspace'
  | 'to-letters'
  | 'to-symbols'
  | 'to-symbols2'
  | 'globe'
  | 'space'
  | 'return'
  | 'emoji';

/** A character key id is `c:<char>`, a special key id is its name. */
export type KeyId = SpecialKey | `c:${string}`;

export const charKey = (c: string): KeyId => `c:${c}`;

interface KeySpec {
  id: KeyId;
  /** Width in units (1 = a regular letter). */
  w: number;
}

const LETTER_ROWS: Record<Lang, string[]> = {
  ru: ['йцукенгшщзх', 'фывапролджэ', 'ячсмитьбю'],
  // Uzbek Latin: QWERTY plus the ʻ key for oʻ / gʻ (U+02BB).
  uz: ['qwertyuiop', 'asdfghjkl', 'zxcvbnmʻ'],
};

const CURRENCY: Record<Lang, string> = { ru: '₽', uz: '$' };

const chars = (s: string, w = 1): KeySpec[] => Array.from(s, (c) => ({ id: charKey(c), w }));

/** Key rows of a page (without the bottom row with the space bar). */
function pageRows(lang: Lang, page: Page): KeySpec[][] {
  switch (page) {
    case 'letters': {
      const [r1, r2, r3] = LETTER_ROWS[lang] as [string, string, string];
      return [
        chars(r1),
        chars(r2),
        [{ id: 'shift', w: 1.4 }, ...chars(r3), { id: 'backspace', w: 1.4 }],
      ];
    }
    case 'symbols':
      return [
        chars('1234567890'),
        chars(`-/:;()${CURRENCY[lang]}&@"`),
        [{ id: 'to-symbols2', w: 1.4 }, ...chars(".,?!'", 1.4), { id: 'backspace', w: 1.4 }],
      ];
    case 'symbols2':
      return [
        chars('[]{}#%^*+='),
        chars('_\\|~<>€£¥•'),
        [{ id: 'to-symbols', w: 1.4 }, ...chars(".,?!'", 1.4), { id: 'backspace', w: 1.4 }],
      ];
  }
}

/** Character rows of the letters page — used to pick a “neighbouring” key for typos. */
export function letterRows(lang: Lang): string[][] {
  return LETTER_ROWS[lang].map((r) => Array.from(r));
}

/** All characters available on a page. */
export function pageChars(lang: Lang, page: Page): Set<string> {
  const set = new Set<string>();
  for (const row of pageRows(lang, page)) {
    for (const k of row) if (k.id.startsWith('c:')) set.add(k.id.slice(2));
  }
  return set;
}

export interface KeyRect {
  id: KeyId;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * iOS 26 keyboard on a 430 pt wide screen (iPhone 14 Pro Max), measured from real screenshots.
 * All values are points; y is relative to the top of the keyboard panel.
 */
export const KB = {
  /** Panel height from its top edge to the bottom of the screen. */
  height: 346.7,
  /** Rounded top corners of the panel. */
  radius: 25,
  /** Prediction bar: text baseline centre and separators. */
  predictionY: 24.3,
  margin: 6.67,
  gap: 6.33,
  keyH: 44.67,
  rowPitch: 56,
  /** Top of the first key row. */
  firstRow: 51.7,
  keyRadius: 9,
  /** Shift / backspace / #+= next to shorter letter rows. */
  sideKeyW: 48.67,
  /** Bottom row: [123] [emoji] [space] [return]. */
  bottom: [
    { x: 6.67, w: 46.33 },
    { x: 59.33, w: 46.67 },
    { x: 112.33, w: 205 },
    { x: 323.67, w: 99.67 },
  ],
  /** 🌐 under the keys (centre, from the panel top) and its size; the 🎤 mirrors it on the right. */
  globe: { x: 42.3, y: 346.7 - 40.2, size: 26 },
  width: 430,
} as const;

/** Key rectangles relative to the keyboard panel's top-left corner. */
export function keyboardGeometry(lang: Lang, page: Page): KeyRect[] {
  const rows = pageRows(lang, page);
  const { margin: M, gap: G, keyH, width: W } = KB;
  const inner = W - 2 * M;
  const rowY = (i: number) => KB.firstRow + i * KB.rowPitch;
  const rects: KeyRect[] = [];

  // Pitch of a full row: the longest plain row fills the width (10 keys → 42.3 pt, 11 → 38.4 pt).
  const plain = (r: KeySpec[]) => r.every((k) => k.id.startsWith('c:'));
  const fullCount = Math.max(...rows.filter(plain).map((r) => r.length), 10);
  const pitch = (inner + G) / fullCount;
  const placeRow = (keys: KeySpec[], y: number, p: number, w: number, x0: number) => {
    keys.forEach((k, i) => rects.push({ id: k.id, x: x0 + i * p, y, w, h: keyH }));
  };

  rows.forEach((row, ri) => {
    const y = rowY(ri);
    if (plain(row)) {
      // Centred with the full-row pitch (the 9-key row of QWERTY is indented)
      const span = row.length * pitch - G;
      placeRow(row, y, pitch, pitch - G, (W - span) / 2);
      return;
    }
    // Third row: [side] keys [side]
    const [left, ...rest] = row;
    const right = rest.pop()!;
    const mid = rest;
    if (mid.length + 2 === fullCount) {
      // Russian: shift and backspace are as wide as letters
      placeRow(row, y, pitch, pitch - G, M);
      return;
    }
    rects.push({ id: left!.id, x: M, y, w: KB.sideKeyW, h: keyH });
    rects.push({ id: right.id, x: W - M - KB.sideKeyW, y, w: KB.sideKeyW, h: keyH });
    // Middle keys are centred on the screen: letters keep the row pitch (shrunk if they don't fit),
    // the 5 wide punctuation keys of the 123 pages share the span of 7 QWERTY letters.
    const maxSpan = W - 2 * (M + KB.sideKeyW + G);
    const isWide = mid.every((k) => k.w > 1);
    const span = isWide ? 7 * ((inner + G) / 10) - G : Math.min(mid.length * pitch - G, maxSpan);
    const p = (span + G) / mid.length;
    placeRow(mid, y, p, p - G, (W - span) / 2);
  });

  const y4 = rowY(3);
  const bottomIds: KeyId[] = [page === 'letters' ? 'to-symbols' : 'to-letters', 'emoji', 'space', 'return'];
  bottomIds.forEach((id, i) => rects.push({ id, x: KB.bottom[i]!.x, y: y4, w: KB.bottom[i]!.w, h: keyH }));

  const g = KB.globe;
  rects.push({ id: 'globe', x: g.x - g.size / 2, y: g.y - g.size / 2, w: g.size, h: g.size });
  return rects;
}
