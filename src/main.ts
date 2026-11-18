import './style.css';
import { renderVoiceRain } from './background';
import { UnsupportedError } from './encode/errors';
import { detectLang, isLang, UI_STRINGS, type Lang, type UiKey } from './i18n';
import { initials } from './render/chat';
import { CHAT_THEMES, type ChatTheme } from './render/chat';
import { canShareFile, shareOrDownload } from './share/share';
import { splitGraphemes } from './timeline/graphemes';
import { MAX_CHARS, MAX_CHARS_ANY } from './timeline/limits';
import type { Mode } from './timeline/types';

/**
 * The video module (renderer + Mediabunny + fonts) loads separately: the page opens instantly
 * and the module is fetched in the background — once the user starts typing or the browser is idle.
 */
let videoModule: Promise<typeof import('./video')> | null = null;
const loadVideoModule = () => {
  videoModule ??= import('./video').catch((err) => {
    videoModule = null;
    throw err;
  });
  return videoModule;
};
const prefetchVideo = () => {
  void loadVideoModule().catch(() => {});
  void import('./fonts').then((m) => m.loadFonts());
};

/** Everything the user set up is remembered on the phone. */
const KEY = {
  lang: 'pjt.lang',
  name: 'pjt.name',
  avatar: 'pjt.avatar',
  voice: 'pjt.voice',
  theme: 'pjt.theme',
  mode: 'pjt.mode',
  battery: 'pjt.battery',
};
const storage = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string | null) => {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
      /* private mode / quota — just don't remember */
    }
  },
};

let lang: Lang = detectLang(location.search, navigator.languages ?? [navigator.language], storage.get(KEY.lang));
let ui = UI_STRINGS[lang];

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const form = $<HTMLFormElement>('form');
const textEl = $<HTMLTextAreaElement>('text');
const modeEl = $<HTMLSelectElement>('mode');
const counterEl = $<HTMLSpanElement>('counter');
const limitHintEl = $<HTMLParagraphElement>('limit-hint');
const renderBtn = $<HTMLButtonElement>('render');
const nameEl = $<HTMLInputElement>('name');
const avatarInput = $<HTMLInputElement>('avatar-input');
const avatarImg = $<HTMLImageElement>('avatar-img');
const avatarInitials = $<HTMLSpanElement>('avatar-initials');
const avatarPlus = $<HTMLSpanElement>('avatar-plus');
const avatarRemove = $<HTMLButtonElement>('avatar-remove');
const voiceEl = $<HTMLInputElement>('voice');
const voiceValue = $<HTMLElement>('voice-value');
const voiceHint = $<HTMLParagraphElement>('voice-hint');

/** Translates the page in place: texts are marked with data-i18n. */
function applyLang(next: Lang) {
  lang = next;
  ui = UI_STRINGS[lang];
  document.documentElement.lang = lang;
  document.title = ui.metaTitle;
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    el.textContent = ui[el.dataset.i18n as UiKey];
  }
  for (const el of document.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]')) {
    el.placeholder = ui[el.dataset.i18nPlaceholder as UiKey];
  }
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n-aria]')) {
    el.setAttribute('aria-label', ui[el.dataset.i18nAria as UiKey]);
  }
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-lang]')) {
    b.setAttribute('aria-checked', String(b.dataset.lang === lang));
  }
}
applyLang(lang);

for (const b of document.querySelectorAll<HTMLButtonElement>('[data-lang]')) {
  b.addEventListener('click', () => {
    const next = b.dataset.lang;
    if (!isLang(next) || next === lang) return;
    storage.set(KEY.lang, next);
    applyLang(next);
    updateLimit();
    renderSheet();
  });
}

if ('requestIdleCallback' in window) requestIdleCallback(prefetchVideo, { timeout: 4000 });
else setTimeout(prefetchVideo, 2500);
renderVoiceRain($('voice-rain'));

// ——— Contact: name, photo, voice message length ———

let avatar: string | null = storage.get(KEY.avatar);
nameEl.value = storage.get(KEY.name) ?? '';

function updateAvatar() {
  const ini = initials(nameEl.value);
  avatarImg.hidden = !avatar;
  if (avatar) avatarImg.src = avatar;
  avatarInitials.hidden = !!avatar || !ini;
  avatarInitials.textContent = ini;
  avatarPlus.hidden = !!avatar || !!ini;
  avatarRemove.hidden = !avatar;
}
updateAvatar();

nameEl.addEventListener('input', () => {
  storage.set(KEY.name, nameEl.value);
  updateAvatar();
});

avatarInput.addEventListener('change', async () => {
  const file = avatarInput.files?.[0];
  avatarInput.value = '';
  if (!file) return;
  try {
    avatar = await squareThumb(file, 320);
    storage.set(KEY.avatar, avatar);
    updateAvatar();
  } catch (err) {
    console.error(err);
  }
});
avatarRemove.addEventListener('click', () => {
  avatar = null;
  storage.set(KEY.avatar, null);
  updateAvatar();
});

/** Centre-crops the photo to a square and shrinks it: small enough for localStorage, sharp in the video. */
async function squareThumb(file: Blob, size: number): Promise<string> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  c.getContext('2d')!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  bmp.close();
  return c.toDataURL('image/jpeg', 0.86);
}

const savedVoice = Number(storage.get(KEY.voice));
if (savedVoice >= 3 && savedVoice <= 600) voiceEl.value = String(savedVoice);
function updateVoice() {
  const s = Number(voiceEl.value);
  voiceValue.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  voiceHint.hidden = s <= 60;
  voiceEl.style.setProperty('--fill', `${((s - 3) / (600 - 3)) * 100}%`);
}
voiceEl.addEventListener('input', () => {
  storage.set(KEY.voice, voiceEl.value);
  updateVoice();
});
updateVoice();

// ——— Look ———

// Battery: the user's own value if they moved the slider; otherwise the real level where the
// browser exposes it (Chrome / Android — Safari on iPhone does not), else 85 %.
const batteryEl = $<HTMLInputElement>('battery');
const batteryValue = $<HTMLElement>('battery-value');
function updateBattery() {
  batteryValue.textContent = `${batteryEl.value}%`;
  batteryEl.style.setProperty('--fill', `${((Number(batteryEl.value) - 1) / 99) * 100}%`);
}
const savedBattery = Number(storage.get(KEY.battery));
if (savedBattery >= 1 && savedBattery <= 100) batteryEl.value = String(savedBattery);
else {
  const nav = navigator as Navigator & { getBattery?: () => Promise<{ level: number }> };
  void nav.getBattery?.().then((b) => {
    batteryEl.value = String(Math.max(1, Math.round(b.level * 100)));
    updateBattery();
  }).catch(() => {});
}
batteryEl.addEventListener('input', () => {
  storage.set(KEY.battery, batteryEl.value);
  updateBattery();
});
updateBattery();

const themeInputs = [...document.querySelectorAll<HTMLInputElement>('input[name="theme"]')];
const savedTheme = storage.get(KEY.theme);
for (const r of themeInputs) {
  if (r.value === savedTheme && (CHAT_THEMES as readonly string[]).includes(savedTheme)) r.checked = true;
  r.addEventListener('change', () => storage.set(KEY.theme, r.value));
}
const currentTheme = () => (themeInputs.find((r) => r.checked)?.value ?? 'telegram-dark') as ChatTheme;

// ——— Reply text and limits ———

const savedMode = storage.get(KEY.mode);
if (savedMode && savedMode in MAX_CHARS) modeEl.value = savedMode;

let current: { blob: Blob; url: string } | null = null;
let rendering = false;
let overLimit = false;
let abort: AbortController | null = null;

/**
 * Limits count graphemes, not UTF-16 units. The global maximum is enforced by truncation;
 * the per-mode limit (grandpa) is only highlighted, so switching modes back doesn't lose text.
 */
function updateLimit() {
  let g = splitGraphemes(textEl.value);
  if (g.length > MAX_CHARS_ANY) {
    g = g.slice(0, MAX_CHARS_ANY);
    textEl.value = g.join('');
  }
  const limit = MAX_CHARS[modeEl.value as Mode];
  overLimit = g.length > limit;
  counterEl.textContent = `${g.length}/${limit}`;
  counterEl.classList.toggle('over', overLimit);
  limitHintEl.hidden = !overLimit;
  const tooLong = modeEl.value === 'breaks' ? ui.breaksTooLong : ui.grandpaTooLong;
  limitHintEl.textContent = overLimit ? tooLong.replace('{n}', String(limit)) : '';
  renderBtn.disabled = rendering || overLimit;
}
textEl.addEventListener('input', updateLimit);
textEl.addEventListener('focus', prefetchVideo, { once: true });
modeEl.addEventListener('change', () => {
  storage.set(KEY.mode, modeEl.value);
  updateLimit();
});
updateLimit();

// ——— Result sheet: rendering (progress + Cancel) → ready (video + Send) | error ———

const sheet = $<HTMLDialogElement>('sheet');
const sheetTitle = $<HTMLHeadingElement>('sheet-title');
const sheetCloseBtn = $<HTMLButtonElement>('sheet-close');
const sheetMedia = sheet.querySelector<HTMLElement>('.sheet-media')!;
const sheetProgress = $<HTMLElement>('sheet-progress');
const sheetPct = $<HTMLElement>('sheet-pct');
const sheetBar = $<HTMLElement>('sheet-bar');
const sheetNote = $<HTMLParagraphElement>('sheet-note');
const previewEl = $<HTMLVideoElement>('preview');
const shareBtn = $<HTMLButtonElement>('share');
const shareHint = $<HTMLParagraphElement>('share-hint');
const secondaryBtn = $<HTMLButtonElement>('sheet-secondary');

type SheetState =
  | { kind: 'rendering'; progress: number }
  | { kind: 'ready' }
  | { kind: 'error'; unsupported: boolean; detail: string };
let sheetState: SheetState | null = null;

function renderSheet() {
  const st = sheetState;
  if (!st) return;
  const isRendering = st.kind === 'rendering';
  const isReady = st.kind === 'ready';

  sheetTitle.textContent = isRendering ? ui.renderingTitle : isReady ? ui.videoReady : ui.failed;
  sheetMedia.hidden = st.kind === 'error';
  sheetProgress.hidden = !isRendering;
  previewEl.hidden = !isReady;
  if (isRendering) setProgress(st.progress);

  // On failure the technical reason is shown too, so a screenshot is enough to find the cause.
  const note = isRendering
    ? ui.rendering
    : st.kind === 'error'
      ? [st.unsupported ? ui.unsupported : '', st.detail].filter(Boolean).join(NL + NL)
      : '';
  sheetNote.textContent = note;
  sheetNote.hidden = !note;

  shareBtn.hidden = shareHint.hidden = !isReady;
  if (isReady && current) {
    const canShare = canShareFile(current.blob);
    shareBtn.textContent = canShare ? ui.share : ui.download;
    shareHint.textContent = canShare ? ui.shareHint : ui.downloadHint;
  }
  secondaryBtn.textContent = isRendering ? ui.cancel : isReady ? ui.makeAnother : ui.close;
}

let lastPct = -1;
function setProgress(fraction: number) {
  const pct = Math.round(fraction * 100);
  if (pct === lastPct) return;
  lastPct = pct;
  sheetPct.textContent = `${pct}%`;
  sheetBar.style.width = `${pct}%`;
  sheetProgress.setAttribute('aria-valuenow', String(pct));
}

function openSheet(state: SheetState) {
  sheetState = state;
  lastPct = -1;
  renderSheet();
  document.documentElement.classList.add('modal-open');
  if (!sheet.open) sheet.showModal();
}

// Closing by any means (×, Cancel, Esc) aborts an in-progress render.
sheet.addEventListener('close', () => {
  abort?.abort();
  sheetState = null;
  previewEl.pause();
  document.documentElement.classList.remove('modal-open');
});
sheetCloseBtn.addEventListener('click', () => sheet.close());
secondaryBtn.addEventListener('click', () => {
  const makeAnother = sheetState?.kind === 'ready';
  sheet.close();
  if (makeAnother) textEl.focus();
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = textEl.value.trim();
  if (!text || overLimit || rendering) return;

  rendering = true;
  renderBtn.disabled = true;
  const controller = new AbortController();
  abort = controller;
  openSheet({ kind: 'rendering', progress: 0 });

  try {
    const { makeVideo } = await loadVideoModule();
    const { blob } = await makeVideo(
      {
        text,
        lang,
        mode: modeEl.value as Mode,
        theme: currentTheme(),
        name: nameEl.value.trim() || (lang === 'uz' ? 'Doʻst' : 'Друг'),
        avatar,
        voiceSeconds: Number(voiceEl.value),
        battery: Number(batteryEl.value),
      },
      setProgress,
      controller.signal,
    );

    if (current) URL.revokeObjectURL(current.url);
    current = { blob, url: URL.createObjectURL(blob) };
    previewEl.src = current.url;
    if (sheet.open) {
      sheetState = { kind: 'ready' };
      renderSheet();
      void previewEl.play().catch(() => {});
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    console.error(err);
    if (sheet.open) {
      sheetState = { kind: 'error', unsupported: err instanceof UnsupportedError, detail: describeError(err) };
      renderSheet();
    }
  } finally {
    if (abort === controller) abort = null;
    rendering = false;
    updateLimit();
  }
});

function describeError(err: unknown): string {
  const e = err as { name?: string; message?: string; stack?: string } | null;
  const head = e?.name || e?.message ? `${e.name ?? 'Error'}: ${e.message ?? ''}` : String(err);
  const where = e?.stack?.split(NL).find((l) => l.includes('.js'))?.trim() ?? '';
  const ios = navigator.userAgent.match(/OS [\d_]+|Version\/[\d.]+/g)?.join(' ') ?? '';
  return [head, where, ios].filter(Boolean).join(NL).slice(0, 400);
}
const NL = String.fromCharCode(10);

// Separate button: share must be called from a user gesture.
shareBtn.addEventListener('click', async () => {
  if (!current) return;
  await shareOrDownload(current.blob, 'reply.mp4');
});

// Offline: the service worker caches the whole app after the first visit (production build only).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(console.error));
}
