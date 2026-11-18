import type { VideoStrings } from '../i18n';
import { rr } from './keyboard';
import { SCREEN_H, SCREEN_W } from './scene';
import type { Ctx2D } from './types';

/**
 * Chat look: who we are replying to and which messenger it imitates.
 * Everything here is drawn in screen points (390×844), like the rest of the scene.
 *
 * - `telegram-dark`: current Telegram for iOS in the dark theme — floating glass pills instead of a
 *   header bar, starry wallpaper, round attach / mic buttons around the input field;
 * - `telegram`: classic light Telegram with the green doodle wallpaper;
 * - `imessage`: iMessage.
 */
export type ChatTheme = 'telegram-dark' | 'telegram' | 'imessage';
export const CHAT_THEMES: readonly ChatTheme[] = ['telegram-dark', 'telegram', 'imessage'];

export interface ChatLook {
  theme: ChatTheme;
  /** Contact name in the header. */
  name: string;
  /** Contact photo (already square). Without it, initials on a coloured circle. */
  avatar?: CanvasImageSource | null;
  /** Wall-clock time (epoch ms) at t = 0 of the video: the status bar clock runs from here. */
  startTime: number;
  /** When the voice message arrived, e.g. "14:29". */
  voiceClock: string;
  /** Battery level in the status bar, 1–100 %. */
  battery: number;
}

export const DEFAULT_LOOK: ChatLook = {
  theme: 'telegram-dark',
  name: 'Друг',
  startTime: Date.UTC(2026, 0, 1, 9, 41),
  voiceClock: '9:38',
  battery: 85,
};

/** “14:32” at video time `t` (local time of the device that renders). */
export function clockAt(look: ChatLook, t: number): string {
  const d = new Date(look.startTime + t * 1000);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export interface Palette {
  /** Dark UI: white status bar, dark keyboard. */
  dark: boolean;
  outBubble: string;
  outText: string;
  outMeta: string;
  inBubble: string;
  inText: string;
  inMeta: string;
  wave: string;
  accent: string;
  field: string;
  fieldBorder: string;
  fieldText: string;
  placeholder: string;
  panel: string | null;
  header: string;
  hairline: string;
  muted: string;
  fg: string;
}

export const PALETTES: Record<ChatTheme, Palette> = {
  imessage: {
    dark: false,
    outBubble: '#0b84fe',
    outText: '#ffffff',
    outMeta: '#8e8e93',
    inBubble: '#e9e9eb',
    inText: '#000000',
    inMeta: '#8e8e93',
    wave: '#7c7c80',
    accent: '#0b84fe',
    field: '#ffffff',
    fieldBorder: '#c7c7cc',
    fieldText: '#000000',
    placeholder: '#8e8e93',
    panel: null,
    header: 'rgba(247,247,247,0.97)',
    hairline: '#d1d1d6',
    muted: '#8e8e93',
    fg: '#000000',
  },
  telegram: {
    dark: false,
    outBubble: '#e2ffc8',
    outText: '#000000',
    outMeta: '#3eaa3c',
    inBubble: '#ffffff',
    inText: '#000000',
    inMeta: '#a0a7ae',
    wave: '#a9c3da',
    accent: '#3a8ee6',
    field: '#ffffff',
    fieldBorder: '#d6d6d6',
    fieldText: '#000000',
    placeholder: '#8e8e93',
    panel: '#f6f6f6',
    header: 'rgba(247,247,247,0.97)',
    hairline: '#c8c8cc',
    muted: '#8e8e93',
    fg: '#000000',
  },
  'telegram-dark': {
    dark: true,
    outBubble: '#5f80a2',
    outText: '#ffffff',
    outMeta: 'rgba(255,255,255,0.72)',
    inBubble: '#212a37',
    inText: '#ffffff',
    inMeta: '#7f8a99',
    wave: '#3f93f0',
    accent: '#3f93f0',
    field: 'rgba(38,42,50,0.92)',
    fieldBorder: 'rgba(255,255,255,0.10)',
    fieldText: '#ffffff',
    placeholder: '#8b919b',
    panel: null,
    header: 'rgba(36,40,47,0.9)',
    hairline: 'rgba(255,255,255,0.10)',
    muted: '#9298a2',
    fg: '#ffffff',
  },
};

/** Lowest point covered by the header (status bar + navigation), pt. */
export const HEADER_BOTTOM: Record<ChatTheme, number> = { imessage: 150, telegram: 102, 'telegram-dark': 100 };

export const isTelegram = (t: ChatTheme) => t !== 'imessage';

/** Telegram-dark input row: round attach button, glass field, round mic/send button (x ranges, pt). */
export const TG_DARK_FIELD = { x0: 58, x1: 334 };

// ——— Wallpapers ———

export function drawWallpaper(ctx: Ctx2D, look: ChatLook): void {
  if (look.theme === 'imessage') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  } else if (look.theme === 'telegram') {
    drawDoodles(ctx);
  } else {
    drawSpace(ctx);
  }
}

/** Light Telegram: green gradient with a faint doodle pattern. */
function drawDoodles(ctx: Ctx2D): void {
  const g = ctx.createLinearGradient(0, 0, SCREEN_W, SCREEN_H);
  g.addColorStop(0, '#dbe8b8');
  g.addColorStop(0.5, '#b9d5a0');
  g.addColorStop(1, '#93bf91');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  ctx.strokeStyle = 'rgba(40,80,30,0.12)';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  const rnd = rng(11);
  for (let y = 10; y < SCREEN_H; y += 46) {
    for (let x = (y / 46) % 2 ? 6 : 28; x < SCREEN_W; x += 44) {
      const px = x + rnd() * 10;
      const py = y + rnd() * 10;
      const kind = Math.floor(rnd() * 4);
      ctx.beginPath();
      if (kind === 0) ctx.arc(px, py, 5, 0, Math.PI * 2);
      else if (kind === 1) {
        ctx.moveTo(px - 6, py + 4);
        ctx.lineTo(px, py - 5);
        ctx.lineTo(px + 6, py + 4);
        ctx.closePath();
      } else if (kind === 2) {
        ctx.moveTo(px - 6, py);
        ctx.quadraticCurveTo(px - 3, py - 6, px, py);
        ctx.quadraticCurveTo(px + 3, py + 6, px + 6, py);
      } else {
        ctx.moveTo(px - 4, py - 4);
        ctx.lineTo(px + 4, py + 4);
        ctx.moveTo(px + 4, py - 4);
        ctx.lineTo(px - 4, py + 4);
      }
      ctx.stroke();
    }
  }
}

/** Dark Telegram “space” wallpaper: black, star dust, a few blurred dots and a teal planet. */
function drawSpace(ctx: Ctx2D): void {
  ctx.fillStyle = '#030406';
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  const rnd = rng(5);
  // Dust: many tiny dots, denser in a diagonal band like the Milky Way
  for (let i = 0; i < 900; i++) {
    const x = rnd() * SCREEN_W;
    const y = rnd() * SCREEN_H;
    const band = Math.exp(-(((y - x * 0.9 - 250) / 220) ** 2));
    if (rnd() > 0.35 + band * 0.65) continue;
    ctx.fillStyle = `rgba(255,255,255,${(0.12 + rnd() * 0.45).toFixed(2)})`;
    const r = rnd() < 0.92 ? 0.45 : 0.9;
    ctx.fillRect(x, y, r, r);
  }
  // Blurred out-of-focus specks
  for (let i = 0; i < 7; i++) {
    const x = rnd() * SCREEN_W;
    const y = 260 + rnd() * (SCREEN_H - 300);
    const r = 3 + rnd() * 3;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(220,225,230,0.55)');
    g.addColorStop(1, 'rgba(220,225,230,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Planet with a soft glow
  const px = SCREEN_W / 2;
  const py = 438;
  const glow = ctx.createRadialGradient(px, py, 8, px, py, 40);
  glow.addColorStop(0, 'rgba(120,200,190,0.35)');
  glow.addColorStop(1, 'rgba(120,200,190,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(px - 40, py - 40, 80, 80);
  const planet = ctx.createRadialGradient(px - 5, py - 6, 2, px, py, 17);
  planet.addColorStop(0, '#bdeee4');
  planet.addColorStop(0.6, '#79c3b5');
  planet.addColorStop(1, 'rgba(70,140,130,0.2)');
  ctx.fillStyle = planet;
  ctx.beginPath();
  ctx.arc(px, py, 17, 0, Math.PI * 2);
  ctx.fill();
}

function rng(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// ——— Header ———

/** Status bar + navigation with the contact's name and photo. */
export function drawHeader(ctx: Ctx2D, look: ChatLook, strings: VideoStrings, font: string, clock: string): void {
  const p = PALETTES[look.theme];
  if (look.theme === 'telegram-dark') {
    // Soft darkening under the status bar so the pills read on any wallpaper
    const g = ctx.createLinearGradient(0, 0, 0, 120);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SCREEN_W, 120);
    drawStatusBar(ctx, clock, look.battery, font, true);
    drawGlassHeader(ctx, look, strings, font);
    return;
  }

  const bottom = HEADER_BOTTOM[look.theme];
  ctx.fillStyle = p.header;
  ctx.fillRect(0, 0, SCREEN_W, bottom);
  ctx.fillStyle = p.hairline;
  ctx.fillRect(0, bottom - 0.5, SCREEN_W, 0.5);
  drawStatusBar(ctx, clock, look.battery, font, false);

  ctx.textBaseline = 'middle';
  if (look.theme === 'imessage') {
    drawChevron(ctx, 20, 92, p.accent, 3);
    drawAvatar(ctx, look, SCREEN_W / 2, 88, 27, font);
    ctx.font = `400 12px ${font}`;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    const name = ellipsize(ctx, look.name, 220);
    const nw = ctx.measureText(name).width;
    ctx.fillText(name, SCREEN_W / 2 - 4, 132);
    drawSmallChevron(ctx, SCREEN_W / 2 + nw / 2 + 2, 132, p.muted);
  } else {
    drawChevron(ctx, 16, 78, p.accent, 3);
    ctx.font = `400 17px ${font}`;
    ctx.fillStyle = p.accent;
    ctx.textAlign = 'left';
    ctx.fillText(strings.chats, 30, 78);
    ctx.textAlign = 'center';
    ctx.font = `600 16.5px ${font}`;
    ctx.fillStyle = '#000000';
    ctx.fillText(ellipsize(ctx, look.name, 190), SCREEN_W / 2, 69);
    ctx.font = `400 13px ${font}`;
    ctx.fillStyle = p.muted;
    ctx.fillText(strings.online, SCREEN_W / 2, 88);
    drawAvatar(ctx, look, SCREEN_W - 34, 78, 19, font);
  }
  ctx.textAlign = 'left';
}

/** New Telegram: back pill with the unread counter, name pill in the centre, round avatar. */
function drawGlassHeader(ctx: Ctx2D, look: ChatLook, strings: VideoStrings, font: string): void {
  const p = PALETTES['telegram-dark'];
  const y = 58;
  const h = 40;

  // Back pill: ‹ + white counter badge
  glassPill(ctx, 15, y, 68, h);
  drawChevron(ctx, 27, y + h / 2, '#ffffff', 2.6);
  const unread = '67';
  ctx.font = `500 13px ${font}`;
  const bw = Math.max(22, ctx.measureText(unread).width + 12);
  ctx.fillStyle = '#ffffff';
  rr(ctx, 41, y + h / 2 - 10, bw, 20, 10);
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(unread, 41 + bw / 2, y + h / 2 + 0.5);

  // Name pill
  ctx.font = `600 15px ${font}`;
  const name = ellipsize(ctx, look.name, 150);
  ctx.font = `400 12px ${font}`;
  const statusW = ctx.measureText(strings.lastSeen).width;
  ctx.font = `600 15px ${font}`;
  const pw = Math.min(170, Math.max(ctx.measureText(name).width, statusW) + 34);
  glassPill(ctx, SCREEN_W / 2 - pw / 2, y, pw, h);
  ctx.fillStyle = p.fg;
  ctx.fillText(name, SCREEN_W / 2, y + 13);
  ctx.font = `400 12px ${font}`;
  ctx.fillStyle = p.muted;
  ctx.fillText(strings.lastSeen, SCREEN_W / 2, y + 29);
  ctx.textAlign = 'left';

  // Avatar with a thin glass ring
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.arc(SCREEN_W - 35, y + h / 2, 21, 0, Math.PI * 2);
  ctx.fill();
  drawAvatar(ctx, look, SCREEN_W - 35, y + h / 2, 19, font);
}

function glassPill(ctx: Ctx2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = 'rgba(40,43,50,0.88)';
  rr(ctx, x, y, w, h, h / 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.roundRect(x + 0.4, y + 0.4, w - 0.8, h - 0.8, h / 2);
  ctx.stroke();
}

function drawStatusBar(ctx: Ctx2D, clock: string, battery: number, font: string, dark: boolean): void {
  const level = Math.min(100, Math.max(1, Math.round(battery)));
  const low = level <= 20;
  const fg = dark ? '#ffffff' : '#000000';
  ctx.fillStyle = fg;
  ctx.font = `600 17px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(clock, 70, 31);
  ctx.textAlign = 'left';

  // Dynamic Island
  ctx.fillStyle = '#000000';
  rr(ctx, SCREEN_W / 2 - 63, 11, 126, 37, 18.5);

  // Icons measured from an iOS 26 screenshot (iPhone, dual SIM). Dimmed parts = no signal / empty.
  const dim = dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.28)';

  // Dual-SIM signal: top row — 4 rising bars (SIM 1), bottom row — 4 dots (SIM 2); 3 of 4 active.
  const tops = [25.8, 24.6, 22.9, 21.3];
  for (let i = 0; i < 4; i++) {
    const cx = 267 + i * 6;
    ctx.fillStyle = i < 3 ? fg : dim;
    rr(ctx, cx - 1.65, tops[i]!, 3.3, 30 - tops[i]!, 1.65);
    ctx.beginPath();
    ctx.arc(cx, 33.9, 1.7, 0, Math.PI * 2);
    ctx.fill();
  }

  // Wi-Fi: two thick arcs and a filled wedge, all from one point at the bottom
  const wx = 303;
  const wy = 35.4;
  const a0 = -Math.PI * 0.75;
  const a1 = -Math.PI * 0.25;
  ctx.strokeStyle = fg;
  ctx.fillStyle = fg;
  ctx.lineCap = 'round';
  ctx.lineWidth = 2.4;
  for (const r of [12.2, 8]) {
    ctx.beginPath();
    ctx.arc(wx, wy, r, a0, a1);
    ctx.stroke();
  }
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(wx, wy - 0.6);
  ctx.arc(wx, wy - 0.6, 4.2, a0, a1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Battery with the percentage inside: filled part = level (red when low), the rest dimmed
  const bx = 321.3;
  const by = 21.7;
  const bw = 29.6;
  const bh = 14.6;
  ctx.fillStyle = dim;
  rr(ctx, bx, by, bw, bh, 4.6);
  ctx.save();
  ctx.beginPath();
  ctx.rect(bx, by, bw * (level / 100), bh);
  ctx.clip();
  ctx.fillStyle = low ? '#ff3b30' : fg;
  rr(ctx, bx, by, bw, bh, 4.6);
  ctx.restore();
  ctx.fillStyle = level === 100 ? fg : dim;
  ctx.beginPath();
  ctx.roundRect(bx + bw + 0.8, by + bh / 2 - 2.7, 2, 5.4, [0, 2, 2, 0]);
  ctx.fill();
  ctx.fillStyle = dark ? '#000000' : '#ffffff';
  ctx.font = `800 12.5px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(level), bx + bw / 2, by + bh / 2 + 0.6);
  ctx.textAlign = 'left';
}

/** Round photo, or initials on a gradient (Telegram colours depend on the name, iMessage is grey). */
export function drawAvatar(ctx: Ctx2D, look: ChatLook, cx: number, cy: number, r: number, font: string): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  if (look.avatar) {
    ctx.drawImage(look.avatar, cx - r, cy - r, r * 2, r * 2);
  } else {
    const [a, b] =
      look.theme === 'imessage' ? ['#a5abb8', '#858994'] : AVATAR_COLORS[hash(look.name) % AVATAR_COLORS.length]!;
    const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
    g.addColorStop(0, a);
    g.addColorStop(1, b);
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 ${Math.round(r * 0.8)}px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials(look.name), cx, cy + 1);
    ctx.textAlign = 'left';
  }
  ctx.restore();
}

const AVATAR_COLORS: [string, string][] = [
  ['#ff885e', '#ff516a'],
  ['#ffcd6a', '#ffa85c'],
  ['#82b1ff', '#665fff'],
  ['#a0de7e', '#54cb68'],
  ['#53edd6', '#28c9b7'],
  ['#72d5fd', '#2a9ef1'],
  ['#e0a2f3', '#d669ed'],
];

const hash = (s: string) => Array.from(s).reduce((h, c) => (h * 31 + c.codePointAt(0)!) >>> 0, 7);

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((w) => Array.from(w)[0]!.toLocaleUpperCase())
    .join('');
}

// ——— Messages ———

/** Date pill above the first message. */
export function drawDatePill(ctx: Ctx2D, look: ChatLook, strings: VideoStrings, bottom: number, font: string): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (look.theme === 'imessage') {
    ctx.font = `600 11px ${font}`;
    const a = strings.today;
    const b = ` ${look.voiceClock}`;
    const aw = ctx.measureText(a).width;
    ctx.font = `400 11px ${font}`;
    const bw = ctx.measureText(b).width;
    const x0 = SCREEN_W / 2 - (aw + bw) / 2;
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTES.imessage.muted;
    ctx.font = `600 11px ${font}`;
    ctx.fillText(a, x0, bottom - 7);
    ctx.font = `400 11px ${font}`;
    ctx.fillText(b, x0 + aw, bottom - 7);
  } else {
    ctx.font = `600 13px ${font}`;
    const w = ctx.measureText(strings.today).width + 18;
    ctx.fillStyle = look.theme === 'telegram' ? 'rgba(70,100,60,0.35)' : 'rgba(40,43,50,0.75)';
    rr(ctx, SCREEN_W / 2 - w / 2, bottom - 22, w, 22, 11);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(strings.today, SCREEN_W / 2, bottom - 11);
  }
  ctx.textAlign = 'left';
}

/** The other person's voice message. Returns its top edge. */
export function drawVoiceBubble(ctx: Ctx2D, look: ChatLook, bottom: number, seconds: number, font: string): number {
  const p = PALETTES[look.theme];
  if (look.theme === 'imessage') {
    const w = 230;
    const h = 44;
    const x = 10;
    const y = bottom - h;
    ctx.fillStyle = p.inBubble;
    rr(ctx, x, y, w, h, 18);
    ctx.fillStyle = p.inText;
    triangle(ctx, x + 16, y + 22, 14);
    ctx.fillStyle = p.wave;
    for (let i = 0; i < 30; i++) {
      const bh = 4 + 20 * waveAmp(i, seconds);
      ctx.fillRect(x + 40 + i * 4.6, y + h / 2 - bh / 2, 2.4, bh);
    }
    ctx.fillStyle = p.inText;
    ctx.font = `13px ${font}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(formatDuration(seconds), x + w - 38, y + h / 2);
    return y;
  }

  const dark = look.theme === 'telegram-dark';
  const w = dark ? 254 : 262;
  const h = dark ? 64 : 60;
  const x = 8;
  const y = bottom - h;
  ctx.fillStyle = p.inBubble;
  rr(ctx, x, y, w, h, 18);
  if (dark) drawTail(ctx, x, y + h, p.inBubble);

  // Blue circle with ▶
  const cx = x + (dark ? 30 : 32);
  ctx.fillStyle = p.accent;
  ctx.beginPath();
  ctx.arc(cx, y + h / 2, dark ? 21 : 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  triangle(ctx, cx - 6, y + h / 2, 16);

  const wx = x + 62;
  if (dark) {
    // New Telegram: mostly a dotted line, a few bars where there was sound
    const n = 40;
    for (let i = 0; i < n; i++) {
      const a = waveAmp(i, seconds);
      const bh = a > 0.55 ? 4 + 13 * a : 1.6;
      ctx.fillStyle = p.wave;
      rr(ctx, wx + i * 3.6, y + 27 - bh, 1.8, bh, 0.9);
    }
    // “→A” transcription button
    ctx.fillStyle = 'rgba(63,147,240,0.16)';
    rr(ctx, x + w - 34, y + 8, 26, 26, 8);
    ctx.fillStyle = p.accent;
    ctx.font = `600 12px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('→A', x + w - 21, y + 21.5);
    ctx.textAlign = 'left';
  } else {
    ctx.fillStyle = p.wave;
    for (let i = 0; i < 34; i++) {
      const bh = 3 + 15 * waveAmp(i, seconds);
      rr(ctx, wx + 2 + i * 4.4, y + 25 - bh, 2.4, bh, 1.2);
    }
  }
  ctx.font = `400 12px ${font}`;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = p.inMeta;
  const dur = formatDuration(seconds);
  ctx.fillText(dur, wx, y + 44);
  ctx.fillStyle = p.accent;
  ctx.beginPath();
  ctx.arc(wx + ctx.measureText(dur).width + 6, y + 44, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.inMeta;
  ctx.font = `400 11px ${font}`;
  ctx.textAlign = 'right';
  ctx.fillText(look.voiceClock, x + w - 11, y + h - 11);
  ctx.textAlign = 'left';
  return y;
}

/** Small bubble tail at the bottom-left corner (Telegram). */
function drawTail(ctx: Ctx2D, x: number, bottom: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + 10, bottom - 14);
  ctx.quadraticCurveTo(x + 6, bottom - 2, x - 4, bottom);
  ctx.quadraticCurveTo(x + 8, bottom + 0.5, x + 18, bottom - 4);
  ctx.closePath();
  ctx.fill();
}

const waveAmp = (i: number, seconds: number) => Math.abs(Math.sin(i * 1.7 + seconds * 0.37) * Math.sin(i * 0.53 + 1));

function triangle(ctx: Ctx2D, x: number, cy: number, size: number): void {
  ctx.beginPath();
  ctx.moveTo(x, cy - size / 2);
  ctx.lineTo(x + size, cy);
  ctx.lineTo(x, cy + size / 2);
  ctx.closePath();
  ctx.fill();
}

/** ✓✓ drawn as vectors — many fonts lack check marks. */
export function drawChecks(ctx: Ctx2D, x: number, y: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (const dx of [0, 5]) {
    ctx.moveTo(x + dx, y);
    ctx.lineTo(x + dx + 3, y + 3);
    ctx.lineTo(x + dx + 9, y - 4);
  }
  ctx.stroke();
}

// ——— Telegram-dark input row ———

/** Round glass buttons around the field: 📎 on the left, 🎤 on the right (replaced by Send while typing). */
export function drawTgDarkInputButtons(ctx: Ctx2D, cy: number, sendX: number, typing: boolean): void {
  const p = PALETTES['telegram-dark'];
  // Attach
  glassCircle(ctx, 30, cy, 19);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  // paperclip: two nested rounded strokes, tilted
  ctx.save();
  ctx.translate(30, cy);
  ctx.rotate(Math.PI / 4);
  ctx.beginPath();
  ctx.moveTo(-3, 6);
  ctx.lineTo(-3, -5);
  ctx.arc(0, -5, 3, Math.PI, 0);
  ctx.lineTo(3, 7);
  ctx.arc(-1, 7, 4, 0, Math.PI);
  ctx.lineTo(-5, -6);
  ctx.stroke();
  ctx.restore();

  if (typing) {
    ctx.fillStyle = p.accent;
    ctx.beginPath();
    ctx.arc(sendX, cy, 19, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  glassCircle(ctx, sendX, cy, 19);
  // Mic
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(sendX - 3.5, cy - 9, 7, 12, 3.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(sendX, cy - 1, 7, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.moveTo(sendX, cy + 6);
  ctx.lineTo(sendX, cy + 9);
  ctx.stroke();
}

/** Sticker icon inside the field (circle with a peeled corner). */
export function drawStickerIcon(ctx: Ctx2D, x: number, y: number): void {
  ctx.strokeStyle = '#8b919b';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(x, y, 8, -0.1 * Math.PI, 1.6 * Math.PI);
  ctx.quadraticCurveTo(x + 1, y - 1, x + 8, y - 2.5);
  ctx.stroke();
}

function glassCircle(ctx: Ctx2D, x: number, y: number, r: number): void {
  ctx.fillStyle = 'rgba(40,43,50,0.92)';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
}

// ——— Small helpers ———

function drawChevron(ctx: Ctx2D, x: number, y: number, color: string, width: number): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x + 7, y - 10);
  ctx.lineTo(x - 2, y);
  ctx.lineTo(x + 7, y + 10);
  ctx.stroke();
}

function drawSmallChevron(ctx: Ctx2D, x: number, y: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y - 4);
  ctx.lineTo(x + 3.5, y);
  ctx.lineTo(x, y + 4);
  ctx.stroke();
}

/** Cuts text to fit `maxW` with an ellipsis. */
export function ellipsize(ctx: Ctx2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  const g = Array.from(text);
  while (g.length > 1 && ctx.measureText(g.join('') + '…').width > maxW) g.pop();
  return g.join('').trimEnd() + '…';
}

export const formatDuration = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;
