import { VIDEO_STRINGS } from '../i18n';
import { stateAt, type Timeline } from '../timeline';
import { drawExhale } from './breaks';
import {
  DEFAULT_LOOK,
  HEADER_BOTTOM,
  PALETTES,
  clockAt,
  drawChecks,
  drawDatePill,
  drawHeader,
  drawVoiceBubble,
  drawStickerIcon,
  drawTgDarkInputButtons,
  drawWallpaper,
  isTelegram,
  TG_DARK_FIELD,
  type ChatLook,
} from './chat';
import { drawHands } from './hands';
import { drawKeyboard, rr } from './keyboard';
import { FIELD_MIN_H, FIELD_W, FIELD_X, SCREEN_H, SCREEN_W, SEND_R, fieldBottom, kbTop, sendCenter } from './scene';
import type { Ctx2D } from './types';

/**
 * DOM-free renderer: draws only into the 2D context it is given
 * (runs in the browser and in Node via @napi-rs/canvas).
 */
export type { Ctx2D } from './types';
export type { ChatLook, ChatTheme } from './chat';

export interface RenderOptions {
  width: number;
  height: number;
  fontFamily?: string;
  /** Contact name/photo and messenger look. */
  look?: ChatLook;
}

export const DEFAULT_FONT = 'Inter, system-ui, -apple-system, Roboto, "Apple Color Emoji", "Noto Color Emoji", sans-serif';

const TABLE = '#3a2f27';
const PHONE = '#111111';

const MSG_FONT = 17;
const LINE_H = 22;
const MAX_FIELD_LINES = 6;
const BUBBLE_MAX_W = SCREEN_W * 0.75;
const BUBBLE_PAD_X = 12;
const BUBBLE_PAD_Y = 7;

/**
 * Framing. Portrait frames show the whole phone (header with the contact included);
 * square-ish frames keep the original close-up on the keyboard.
 */
function framing(W: number, H: number): { S: number; ox: number; oy: number } {
  if (H / W > 1.3) {
    const S = Math.min((W * 0.9) / SCREEN_W, (H * 0.93) / SCREEN_H);
    return { S, ox: (W - SCREEN_W * S) / 2, oy: H * 0.955 - SCREEN_H * S };
  }
  const S = (W * 0.86) / SCREEN_W;
  return { S, ox: (W - SCREEN_W * S) / 2, oy: H * 0.955 - SCREEN_H * S };
}

export function renderFrame(ctx: Ctx2D, tl: Timeline, t: number, opts: RenderOptions): void {
  const { width: W, height: H } = opts;
  const font = opts.fontFamily ?? DEFAULT_FONT;
  const look = opts.look ?? DEFAULT_LOOK;
  const C = PALETTES[look.theme];
  const tg = isTelegram(look.theme);
  const tgDark = look.theme === 'telegram-dark';
  const strings = VIDEO_STRINGS[tl.lang];
  const s = stateAt(tl, t);
  const { S, ox, oy } = framing(W, H);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = TABLE;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(S, S);

  // Body and screen
  ctx.fillStyle = PHONE;
  rr(ctx, -13, -13, SCREEN_W + 26, SCREEN_H + 26, 58);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, SCREEN_W, SCREEN_H, 46);
  ctx.clip();
  drawWallpaper(ctx, look);

  // After sending, the keyboard slides down
  const slide = s.sentAt === null ? 0 : easeOut(clamp01((t - s.sentAt - 0.25) / 0.35));
  ctx.font = `${MSG_FONT}px ${font}`;

  // Input field (grows upwards, shows the last lines)
  const typing = s.sentAt === null ? s.graphemes : [];
  // Dark Telegram: the field sits between round 📎 and 🎤/send buttons; the send button is at the
  // same spot as in the other looks (hands aim at sendCenter).
  const fx0 = tgDark ? TG_DARK_FIELD.x0 : FIELD_X;
  const fx1 = tgDark ? TG_DARK_FIELD.x1 : FIELD_X + FIELD_W;
  const fieldTextW = tgDark ? fx1 - fx0 - 24 - 16 : FIELD_W - 24 - SEND_R * 2;
  const allLines = typing.length ? wrap(ctx, typing, fieldTextW) : [];
  const lines = allLines.slice(-MAX_FIELD_LINES);
  const fieldH = Math.max(FIELD_MIN_H, lines.length * LINE_H + 14);
  const fBottom = fieldBottom(slide);
  const fTop = fBottom - fieldH;
  if (C.panel) {
    // Telegram: grey input panel under the field, down to the keyboard / bottom edge
    ctx.fillStyle = C.panel;
    ctx.fillRect(0, fTop - 8, SCREEN_W, Math.min(kbTop(slide), SCREEN_H) - fTop + 8);
    ctx.fillStyle = C.hairline;
    ctx.fillRect(0, fTop - 8, SCREEN_W, 0.5);
  }
  if (tgDark) {
    // Bottom shade so the glass controls read over the wallpaper when the keyboard is gone
    const g = ctx.createLinearGradient(0, fTop - 30, 0, SCREEN_H);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = g;
    ctx.fillRect(0, fTop - 30, SCREEN_W, SCREEN_H - fTop + 30);
  }
  ctx.fillStyle = C.fieldBorder;
  rr(ctx, fx0 - 1, fTop - 1, fx1 - fx0 + 2, fieldH + 2, 19);
  ctx.fillStyle = C.field;
  rr(ctx, fx0, fTop, fx1 - fx0, fieldH, 18);
  if (tgDark) {
    drawTgDarkInputButtons(ctx, fBottom - FIELD_MIN_H / 2, sendCenter(slide).x, typing.length > 0);
    drawStickerIcon(ctx, fx1 - 18, fBottom - FIELD_MIN_H / 2);
  }

  ctx.textBaseline = 'middle';
  const textX = fx0 + 12;
  const lineY = (i: number) => fTop + 7 + LINE_H * i + LINE_H / 2;
  if (lines.length) {
    ctx.fillStyle = C.fieldText;
    lines.forEach((l, i) => ctx.fillText(l, textX, lineY(i)));
  } else {
    ctx.fillStyle = C.placeholder;
    ctx.fillText(tg ? strings.placeholder : 'iMessage', textX + 4, lineY(0));
  }

  // Caret: solid while typing, blinks during pauses
  const sinceKey = s.lastPress ? t - s.lastPress.t : Infinity;
  if (s.sentAt === null && (sinceKey < 0.5 || Math.floor(t * 1.8) % 2 === 0)) {
    const last = lines[lines.length - 1] ?? '';
    const cx = textX + (last ? ctx.measureText(last).width + 1 : 2);
    const cy = lineY(Math.max(0, lines.length - 1));
    ctx.fillStyle = C.accent;
    ctx.fillRect(cx, cy - 11, 2, 22);
  }

  // Send button
  if (typing.length) {
    const sc = sendCenter(slide);
    if (!tgDark) {
      ctx.fillStyle = C.accent;
      ctx.beginPath();
      ctx.arc(sc.x, sc.y, SEND_R, 0, Math.PI * 2);
      ctx.fill();
    }
    drawArrowUp(ctx, sc.x, sc.y);
  }

  // Chat: laid out bottom-up from the input field
  let y = fTop - (C.panel ? 18 : 12);
  if (s.sentAt !== null) {
    const sentClock = clockAt(look, s.sentAt);
    ctx.font = `${MSG_FONT}px ${font}`;
    const bl = wrap(ctx, s.graphemes, BUBBLE_MAX_W - BUBBLE_PAD_X * 2);
    const widths = bl.map((l) => ctx.measureText(l).width);
    let bw = Math.max(...widths) + BUBBLE_PAD_X * 2;
    let bh = bl.length * LINE_H + BUBBLE_PAD_Y * 2;

    if (tg) {
      // Time + ✓✓ inside the bubble: on the last line if it fits, otherwise on its own line.
      ctx.font = `400 11px ${font}`;
      const metaW = ctx.measureText(sentClock).width + 20;
      const lastW = widths[widths.length - 1]! + BUBBLE_PAD_X * 2 + metaW + 4;
      if (lastW <= BUBBLE_MAX_W) bw = Math.max(bw, lastW);
      else bh += 14;
    } else {
      ctx.font = `600 11px ${font}`;
      ctx.fillStyle = C.muted;
      ctx.textAlign = 'right';
      ctx.fillText(strings.delivered, SCREEN_W - 32, y - 6);
      ctx.textAlign = 'left';
      drawChecks(ctx, SCREEN_W - 27, y - 6, C.muted);
      y -= 18;
    }

    const bx = SCREEN_W - (tg ? 8 : 10) - bw;
    y -= bh;
    ctx.fillStyle = C.outBubble;
    rr(ctx, bx, y, bw, bh, 18);
    if (tgDark) {
      // tail at the bottom-right corner
      const r = bx + bw;
      const b = y + bh;
      ctx.beginPath();
      ctx.moveTo(r - 10, b - 14);
      ctx.quadraticCurveTo(r - 6, b - 2, r + 4, b);
      ctx.quadraticCurveTo(r - 8, b + 0.5, r - 18, b - 4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.font = `${MSG_FONT}px ${font}`;
    ctx.fillStyle = C.outText;
    bl.forEach((l, i) => ctx.fillText(l, bx + BUBBLE_PAD_X, y + BUBBLE_PAD_Y + LINE_H * i + LINE_H / 2));
    if (tg) {
      ctx.font = `400 11px ${font}`;
      ctx.fillStyle = C.outMeta;
      ctx.textAlign = 'right';
      ctx.fillText(sentClock, bx + bw - 26, y + bh - 11);
      ctx.textAlign = 'left';
      drawChecks(ctx, bx + bw - 22, y + bh - 11, C.outMeta);
    }
    y -= 10;
  }
  const voiceTop = drawVoiceBubble(ctx, look, y, tl.voiceSeconds, font);
  if (voiceTop - 34 > HEADER_BOTTOM[look.theme]) drawDatePill(ctx, look, strings, voiceTop - 10, font);

  // Header on top of the chat (messages scroll under it, like in a real messenger)
  drawHeader(ctx, look, strings, font, clockAt(look, t));

  // Keyboard
  if (slide < 1) drawKeyboard(ctx, s, t, slide, strings, font, C.dark);

  ctx.restore(); // drop the screen clip

  drawHands(ctx, tl, t, S);
  drawExhale(ctx, tl, t, (H - oy) / S);
  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}

function drawArrowUp(ctx: Ctx2D, x: number, y: number): void {
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y + 7);
  ctx.lineTo(x, y - 7);
  ctx.moveTo(x - 6, y - 1);
  ctx.lineTo(x, y - 7);
  ctx.lineTo(x + 6, y - 1);
  ctx.stroke();
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (p: number) => 1 - (1 - p) ** 3;

const wrapCache = new Map<string, string[]>();

/** Grapheme-aware wrapping that prefers breaking at spaces. Cached: text only changes on key presses. */
function wrap(ctx: Ctx2D, graphemes: string[], maxWidth: number): string[] {
  const key = `${ctx.font}|${maxWidth}|${graphemes.join('')}`;
  const hit = wrapCache.get(key);
  if (hit) return hit;

  const lines: string[] = [];
  let line: string[] = [];
  for (const g of graphemes) {
    line.push(g);
    if (line.length > 1 && ctx.measureText(line.join('')).width > maxWidth) {
      const lastSpace = line.lastIndexOf(' ');
      const cut = lastSpace > 0 ? lastSpace + 1 : line.length - 1;
      lines.push(line.slice(0, cut).join('').trimEnd());
      line = line.slice(cut);
    }
  }
  if (line.length) lines.push(line.join(''));

  if (wrapCache.size > 256) wrapCache.clear();
  wrapCache.set(key, lines);
  return lines;
}
