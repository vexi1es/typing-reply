import { KB, keyboardGeometry, type KeyId, type KeyRect } from '../keyboard/layout';
import type { KeyboardState } from '../keyboard/sim';

/**
 * The whole scene is drawn in iPhone 14 Pro Max screen points (430×932 pt), as in iOS.
 * Conversion to frame pixels is a single ctx.scale in renderFrame.
 */
export const SCREEN_W = 430;
export const SCREEN_H = 932;
/** Keyboard panel height (prediction bar + keys + the strip with 🌐 / 🎤). */
export const KB_H = KB.height;
/** Bottom inset for the home indicator when the keyboard is hidden. */
export const HOME_INDICATOR = 34;

/** Input field of the iMessage / light Telegram looks (the dark Telegram row is in chat.ts). */
export const FIELD_X = 10;
export const FIELD_W = SCREEN_W - FIELD_X * 2;
export const FIELD_MIN_H = 39.3;
export const SEND_R = 15;
/** Send / mic button centre x — the same spot in every look, so the hands aim the same way. */
export const SEND_X = 402;

/** Keyboard top; slide 0 = open, 1 = slid away. */
export const kbTop = (slide = 0) => SCREEN_H - KB_H + slide * KB_H;

/** Bottom of the input field (it grows upwards): 8 pt above the keyboard, or above the home bar. */
export const fieldBottom = (slide = 0) => Math.min(kbTop(slide) - 8.3, SCREEN_H - 28.4);

export const sendCenter = (slide = 0) => ({ x: SEND_X, y: fieldBottom(slide) - FIELD_MIN_H / 2 });

const geomCache = new Map<string, KeyRect[]>();

/** Key rectangles in screen coordinates. */
export function keyRects(kb: KeyboardState, slide = 0): KeyRect[] {
  const k = `${kb.lang}:${kb.page}`;
  let rects = geomCache.get(k);
  if (!rects) {
    rects = keyboardGeometry(kb.lang, kb.page);
    geomCache.set(k, rects);
  }
  const dy = kbTop(slide);
  return rects.map((r) => ({ ...r, y: r.y + dy }));
}

export function keyCenter(kb: KeyboardState, key: KeyId | 'send'): { x: number; y: number } {
  if (key === 'send') return sendCenter();
  const r = keyRects(kb).find((r) => r.id === key);
  if (!r) return { x: SCREEN_W / 2, y: kbTop() + KB_H / 2 };
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}
