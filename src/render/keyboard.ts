import type { VideoStrings } from '../i18n';
import { KB, VARIANTS, type KeyId, type KeyRect } from '../keyboard/layout';
import type { KeyboardState } from '../keyboard/sim';
import type { TypingState } from '../timeline';
import { KB_H, SCREEN_W, kbTop, keyRects } from './scene';
import type { Ctx2D } from './types';

/**
 * iOS 26 keyboard, copied from screenshots of an iPhone 14 Pro Max: a panel with rounded top
 * corners, a prediction bar, flat keys (all the same colour), outline glyphs, 🌐 / 🎤 below.
 */
const LIGHT = {
  panel: '#d3d5db',
  key: '#ffffff',
  pressed: '#b8bcc4',
  popup: '#ffffff',
  pickerHi: '#d6d9df',
  label: '#000000',
  prediction: '#6c6c70',
  separator: 'rgba(0,0,0,0.16)',
  marker: '#8a8a8e',
  smileyInk: '#ffffff',
};

/** iOS dark keyboard (measured: panel #1f1f1f, keys #434343). */
const DARK: typeof LIGHT = {
  panel: '#1f1f1f',
  key: '#434343',
  pressed: '#5d5d5d',
  popup: '#525252',
  pickerHi: '#7a7a7a',
  label: '#ffffff',
  prediction: '#999999',
  separator: 'rgba(255,255,255,0.16)',
  marker: '#8c8c8c',
  smileyInk: '#434343',
};

/** Current palette; set at the start of every drawKeyboard call (rendering is synchronous). */
let C = LIGHT;

/** How long (s) the highlight / key popup stays after a press (measured: ~4 frames at 30 fps). */
const FLASH = 0.13;
/** Long press: the plain popup shows first, the variant picker appears after this, s. */
const PICKER_DELAY = 0.35;
/** After 🌐 the space bar shows the layout name for this long, s. */
const LAYOUT_NAME = 1.1;

/** Default prediction words per keyboard language (left, centre, right). */
const PREDICTIONS: Record<string, [string, string, string]> = {
  ru: ['Я', 'я', 'Ну'],
  uz: ['I', 'The', 'I’m'],
};
/** Language marker in the corner of the space bar (uz = the English (US) keyboard). */
const SPACE_MARKER: Record<string, string> = { ru: 'ру', uz: 'A' };
const LAYOUT_TITLE: Record<string, string> = { ru: 'Русская', uz: 'English (US)' };

/** A key being held for the variant picker: which key, what it will type, how far into the hold. */
export interface LongPressState {
  key: KeyId;
  inserted: string;
  /** Seconds since the finger went down. */
  elapsed: number;
  hold: number;
}

export function drawKeyboard(
  ctx: Ctx2D,
  s: TypingState,
  t: number,
  slide: number,
  strings: VideoStrings,
  font: string,
  dark = false,
  longPress: LongPressState | null = null,
): void {
  C = dark ? DARK : LIGHT;
  const top = kbTop(slide);
  ctx.fillStyle = C.panel;
  ctx.beginPath();
  ctx.roundRect(0, top, SCREEN_W, KB_H + KB.radius, [KB.radius, KB.radius, 0, 0]);
  ctx.fill();

  drawPredictions(ctx, s, top, font);

  const flash = s.lastPress && t - s.lastPress.t < FLASH && !s.lastPress.longPress ? s.lastPress : null;
  const rects = keyRects(s.kb, slide);
  let popup: KeyRect | null = null;
  let held: KeyRect | null = null;
  const showLayoutName = s.layoutSwitchAt !== null && t - s.layoutSwitchAt < LAYOUT_NAME;

  for (const r of rects) {
    const isChar = r.id.startsWith('c:');
    const pressed = flash?.key === r.id || longPress?.key === r.id;
    if (flash?.key === r.id && isChar) popup = r;
    if (longPress?.key === r.id) held = r;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;

    if (r.id === 'globe') {
      drawGlobe(ctx, cx, cy, KB.globe.size / 2);
      drawMic(ctx, SCREEN_W - cx, cy);
      continue;
    }

    ctx.fillStyle = pressed ? C.pressed : C.key;
    rr(ctx, r.x, r.y, r.w, r.h, KB.keyRadius);

    switch (r.id) {
      case 'shift':
        drawShift(ctx, cx, cy, s.kb.shift, s.kb.capsLock);
        continue;
      case 'backspace':
        drawBackspace(ctx, cx, cy);
        continue;
      case 'emoji':
        drawSmiley(ctx, cx, cy, 9.4);
        continue;
      case 'return':
        drawReturn(ctx, cx, cy);
        continue;
      case 'space': {
        if (showLayoutName) {
          ctx.fillStyle = C.label;
          ctx.font = `16px ${font}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(LAYOUT_TITLE[s.kb.lang] ?? '', cx, cy);
          continue;
        }
        ctx.fillStyle = C.marker;
        ctx.font = `500 10.5px ${font}`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(SPACE_MARKER[s.kb.lang] ?? '', r.x + r.w - 6, r.y + r.h - 6);
        continue;
      }
    }

    ctx.fillStyle = C.label;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = keyLabel(r.id, s.kb, strings);
    ctx.font = isChar ? `24px ${font}` : `${label.length > 2 && label.startsWith('#') ? 15 : 18}px ${font}`;
    ctx.fillText(label, cx, cy + (isChar ? -1 : 0));
  }

  if (popup && flash) drawPopup(ctx, popup, flash.inserted ?? '', font);
  if (held && longPress) {
    const base = held.id.slice(2);
    const upper = s.kb.shift && s.kb.page === 'letters';
    if (longPress.elapsed < PICKER_DELAY) drawPopup(ctx, held, upper ? base.toLocaleUpperCase() : base, font);
    else drawPicker(ctx, held, base, longPress, upper, font);
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/** Three suggestions; while a word is being typed it shows up in quotes on the left, as on iOS. */
function drawPredictions(ctx: Ctx2D, s: TypingState, top: number, font: string): void {
  const defaults = PREDICTIONS[s.kb.lang] ?? ['', '', ''];
  const text = s.sentAt === null ? s.graphemes.join('') : '';
  const word = /[^\s.,!?;:]+$/u.exec(text)?.[0] ?? '';
  const slots = [word ? `«${word}»` : defaults[0], defaults[1], defaults[2]];
  const third = SCREEN_W / 3;
  const y = top + KB.predictionY;

  ctx.fillStyle = C.separator;
  for (const i of [1, 2]) ctx.fillRect(third * i - 0.5, y - 11.5, 1, 23);

  ctx.fillStyle = C.prediction;
  ctx.font = `17px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  slots.forEach((w, i) => {
    let label = w;
    while (label.length > 2 && ctx.measureText(label).width > third - 16) label = label.slice(1);
    if (label !== w) label = `«…${label.replace(/^«/, '')}`;
    ctx.fillText(label, third * i + third / 2, y);
  });
}

function keyLabel(id: KeyId, kb: KeyboardState, strings: VideoStrings): string {
  if (id.startsWith('c:')) {
    const c = id.slice(2);
    if (c === '"') return '”'; // iOS draws typographic quotes on the keys
    if (c === "'") return '’';
    return kb.shift && kb.page === 'letters' ? c.toLocaleUpperCase() : c;
  }
  if (id === 'to-letters') return strings.lettersKey;
  if (id === 'to-symbols') return '123';
  if (id === 'to-symbols2') return '#+=';
  return '';
}

/**
 * iOS 26 key popup (measured): a separate rounded box 51×59 pt standing 3 pt above the key,
 * centred on it, with the typed character.
 */
const POPUP = { w: 51, h: 59, gap: 3.3, radius: 13 };

function drawPopup(ctx: Ctx2D, r: KeyRect, ch: string, font: string): void {
  const x = Math.min(SCREEN_W - 3 - POPUP.w, Math.max(3, r.x + r.w / 2 - POPUP.w / 2));
  const y = r.y - POPUP.gap - POPUP.h;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  rr(ctx, x, y + 1, POPUP.w, POPUP.h, POPUP.radius);
  ctx.fillStyle = C.popup;
  rr(ctx, x, y, POPUP.w, POPUP.h, POPUP.radius);
  ctx.fillStyle = C.label;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `30px ${font}`;
  ctx.fillText(ch, x + POPUP.w / 2, y + POPUP.h / 2);
}

/**
 * Long-press variant picker: a strip of variants above the key; the highlight slides from the
 * key's own letter to the chosen variant just before release.
 */
function drawPicker(
  ctx: Ctx2D,
  r: KeyRect,
  base: string,
  lp: LongPressState,
  upper: boolean,
  font: string,
): void {
  const items = VARIANTS[base] ?? [base];
  const target = Math.max(0, items.indexOf(lp.inserted.toLocaleLowerCase()));
  const cell = 34;
  const h = 46;
  const w = items.length * cell + 8;
  // Opens to the right of the key when there is room, otherwise to the left
  let x = r.x + r.w / 2 - cell / 2 - 4;
  if (x + w > SCREEN_W - 3) x = r.x + r.w / 2 + cell / 2 + 4 - w;
  x = Math.max(3, x);
  const y = r.y - POPUP.gap - h;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  rr(ctx, x, y + 1, w, h, 14);
  ctx.fillStyle = C.popup;
  rr(ctx, x, y, w, h, 14);
  // The finger slides to the variant in the second half of the picker time
  const span = lp.hold - PICKER_DELAY;
  const k = Math.min(1, Math.max(0, (lp.elapsed - PICKER_DELAY - span * 0.4) / (span * 0.4)));
  const own = Math.max(0, items.indexOf(base));
  const hi = Math.round(own + (target - own) * k);
  ctx.fillStyle = C.pickerHi;
  rr(ctx, x + 4 + hi * cell, y + 4, cell, h - 8, 10);
  ctx.fillStyle = C.label;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `24px ${font}`;
  items.forEach((c, i) => ctx.fillText(upper ? c.toLocaleUpperCase() : c, x + 4 + i * cell + cell / 2, y + h / 2));
}

/** ⇧ — outline when off, filled when on, filled with a bar under it for Caps Lock. */
function drawShift(ctx: Ctx2D, x: number, y: number, on: boolean, locked: boolean): void {
  const dy = locked ? -2 : 0;
  ctx.beginPath();
  ctx.moveTo(x, y - 8.3 + dy);
  ctx.lineTo(x + 9.8, y + 1.2 + dy);
  ctx.lineTo(x + 4.8, y + 1.2 + dy);
  ctx.lineTo(x + 4.8, y + 8.3 + dy);
  ctx.lineTo(x - 4.8, y + 8.3 + dy);
  ctx.lineTo(x - 4.8, y + 1.2 + dy);
  ctx.lineTo(x - 9.8, y + 1.2 + dy);
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1.7;
  ctx.strokeStyle = C.label;
  ctx.fillStyle = C.label;
  if (on) ctx.fill();
  ctx.stroke();
  if (locked) rr(ctx, x - 4.8, y + 9.5, 9.6, 2, 1);
}

/** ⌫ — pentagon with a cross. */
function drawBackspace(ctx: Ctx2D, x: number, y: number): void {
  ctx.strokeStyle = C.label;
  ctx.lineWidth = 1.7;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 10, y);
  ctx.lineTo(x - 4, y - 7.8);
  ctx.lineTo(x + 8, y - 7.8);
  ctx.quadraticCurveTo(x + 10, y - 7.8, x + 10, y - 5.8);
  ctx.lineTo(x + 10, y + 5.8);
  ctx.quadraticCurveTo(x + 10, y + 7.8, x + 8, y + 7.8);
  ctx.lineTo(x - 4, y + 7.8);
  ctx.closePath();
  ctx.moveTo(x - 0.5, y - 3.5);
  ctx.lineTo(x + 6.5, y + 3.5);
  ctx.moveTo(x + 6.5, y - 3.5);
  ctx.lineTo(x - 0.5, y + 3.5);
  ctx.stroke();
}

/** ↵ on the return key. */
function drawReturn(ctx: Ctx2D, x: number, y: number): void {
  ctx.strokeStyle = C.label;
  ctx.lineWidth = 1.7;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + 9.5, y - 8);
  ctx.lineTo(x + 9.5, y + 0.5);
  ctx.quadraticCurveTo(x + 9.5, y + 2.5, x + 7.5, y + 2.5);
  ctx.lineTo(x - 9.5, y + 2.5);
  ctx.moveTo(x - 4, y - 3);
  ctx.lineTo(x - 9.5, y + 2.5);
  ctx.lineTo(x - 4, y + 8);
  ctx.stroke();
}

/** Filled smiley with an open grin (the emoji key). */
function drawSmiley(ctx: Ctx2D, x: number, y: number, r: number): void {
  ctx.fillStyle = C.label;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.smileyInk;
  for (const dx of [-3.2, 3.2]) {
    ctx.beginPath();
    ctx.ellipse(x + dx, y - 2.8, 1.2, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(x - 5.4, y + 1.2);
  ctx.quadraticCurveTo(x, y + 2.2, x + 5.4, y + 1.2);
  ctx.quadraticCurveTo(x + 4.6, y + 6.4, x, y + 6.4);
  ctx.quadraticCurveTo(x - 4.6, y + 6.4, x - 5.4, y + 1.2);
  ctx.fill();
}

/** Outline globe of the keyboard switcher. */
function drawGlobe(ctx: Ctx2D, x: number, y: number, r: number): void {
  ctx.strokeStyle = C.label;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.45, r, 0, 0, Math.PI * 2);
  ctx.moveTo(x, y - r);
  ctx.lineTo(x, y + r);
  for (const k of [-0.5, 0, 0.5]) {
    ctx.moveTo(x - r, y + r * k);
    ctx.lineTo(x + r, y + r * k);
  }
  ctx.stroke();
  ctx.restore();
}

/** Outline microphone (dictation) with its stand. */
function drawMic(ctx: Ctx2D, x: number, y: number): void {
  ctx.strokeStyle = C.label;
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.roundRect(x - 4.3, y - 13.5, 8.6, 17, 4.3);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y - 3, 8.3, 0.05 * Math.PI, 0.95 * Math.PI);
  ctx.moveTo(x, y + 5.3);
  ctx.lineTo(x, y + 12);
  ctx.moveTo(x - 6, y + 13.5);
  ctx.lineTo(x + 6, y + 13.5);
  ctx.stroke();
}

export function rr(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}
