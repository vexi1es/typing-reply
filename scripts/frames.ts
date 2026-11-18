/**
 * Renders individual frames to PNG via @napi-rs/canvas (Skia) for quick visual checks
 * without a browser. Same renderFrame as in the browser.
 *
 *   npm run frames -- "Привет, как дела?" ru normal 0.5,2,end telegram "Азиз" [avatar.jpg]
 *   → out/frames/<theme>-<t>.png
 */
import { GlobalFonts, createCanvas, loadImage } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { renderFrame, type ChatTheme } from '../src/render/renderFrame';
import { generateTimeline, type Mode } from '../src/timeline';
import type { Lang } from '../src/i18n';
import { VIDEO } from '../src/videoConfig';

const require = createRequire(import.meta.url);
for (const f of ['latin-400', 'latin-600', 'cyrillic-400', 'cyrillic-600', 'latin-ext-400', 'latin-ext-600']) {
  GlobalFonts.registerFromPath(require.resolve(`@fontsource/inter/files/inter-${f}-normal.woff2`), 'Inter');
}

const [
  text = 'Слушай, не могу сейчас слушать, напиши текстом 🙏',
  lang = 'ru',
  mode = 'normal',
  times = '0.5,3,end',
  theme = 'telegram',
  name = 'Азиз Каримов',
  avatarPath,
  voice = '83',
] = process.argv.slice(2);
const tl = generateTimeline({ text, lang: lang as Lang, mode: mode as Mode, seed: 1, voiceSeconds: Number(voice) });
console.log(`duration ${tl.duration.toFixed(2)}s, events ${tl.events.length}`);

const avatar = avatarPath ? await loadImage(avatarPath) : null;
const { width, height } = VIDEO;
const canvas = createCanvas(width, height);
const ctx = canvas.getContext('2d');
mkdirSync('out/frames', { recursive: true });

for (const raw of times.split(',')) {
  const t = raw === 'end' ? tl.duration - 0.01 : Number(raw);
  renderFrame(ctx as unknown as CanvasRenderingContext2D, tl, t, {
    width,
    height,
    look: {
      theme: theme as ChatTheme,
      name,
      avatar: avatar as unknown as CanvasImageSource,
      startTime: new Date(2026, 10, 18, 14, 31, 40).getTime(),
      voiceClock: '14:29',
      battery: Number(process.env.BATTERY ?? 85),
    },
  });
  const file = `out/frames/${theme}-${t.toFixed(2)}.png`;
  writeFileSync(file, canvas.toBuffer('image/png'));
  console.log(file);
}
