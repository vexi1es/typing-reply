import { encodeMp4 } from './encode/encode';
import { loadFonts } from './fonts';
import type { Lang } from './i18n';
import type { ChatTheme } from './render/chat';
import { generateTimeline, type Mode } from './timeline';
import { VIDEO } from './videoConfig';

/**
 * Everything heavy for the video (timeline, renderer, Mediabunny) lives in this module.
 * main.ts imports it dynamically, keeping the initial page load light.
 */
export interface VideoParams {
  text: string;
  lang: Lang;
  mode: Mode;
  theme: ChatTheme;
  name: string;
  /** Contact photo as a data: URL (already cropped to a square). */
  avatar: string | null;
  voiceSeconds: number;
  /** Battery level for the status bar, %. */
  battery: number;
}

export async function makeVideo(
  p: VideoParams,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<{ blob: Blob; duration: number }> {
  const timeline = generateTimeline({
    text: p.text,
    lang: p.lang,
    mode: p.mode,
    voiceSeconds: p.voiceSeconds,
    seed: (Math.random() * 2 ** 32) >>> 0,
  });
  await loadFonts();
  const avatar = p.avatar ? await createImageBitmap(await (await fetch(p.avatar)).blob()) : null;

  // Real time: the video ends right now (the status bar clock runs during the video, so it may
  // tick over a minute); the voice message arrived a couple of minutes before typing started.
  const startTime = Date.now() - timeline.duration * 1000;
  const ago = new Date(startTime - (1 + Math.ceil(p.voiceSeconds / 60)) * 60_000);
  const look = { theme: p.theme, name: p.name, avatar, startTime, voiceClock: hhmm(ago), battery: p.battery };

  try {
    const blob = await encodeMp4(timeline, { ...VIDEO, look, onProgress, signal });
    return { blob, duration: timeline.duration };
  } finally {
    avatar?.close();
  }
}

const hhmm = (d: Date) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
