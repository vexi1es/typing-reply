export type Lang = 'ru' | 'uz';
/** Order matters: when looking up a layout for a “foreign” character, languages are tried in this order. */
export const LANGS: readonly Lang[] = ['ru', 'uz'];

export const isLang = (x: unknown): x is Lang => typeof x === 'string' && (LANGS as readonly string[]).includes(x);

/** Language names in their own language — for the switcher. */
export const LANG_NAMES: Record<Lang, string> = { ru: 'Русский', uz: 'Oʻzbekcha' };

/**
 * Site language. Priority: `?lang=xx` in the URL → saved choice →
 * the browser’s primary language (if supported) → Russian.
 */
export function detectLang(search: string, languages: readonly string[], stored?: string | null): Lang {
  const forced = new URLSearchParams(search).get('lang');
  if (isLang(forced)) return forced;
  if (isLang(stored)) return stored;
  const primary = languages[0]?.toLowerCase().split('-')[0] ?? '';
  return isLang(primary) ? primary : 'ru';
}

/** Strings drawn inside the video. */
export interface VideoStrings {
  /** Input field placeholder in Telegram. */
  placeholder: string;
  delivered: string;
  /** Label on the “back to letters” key. */
  lettersKey: string;
  spaceKey: string;
  returnKey: string;
  /** Date pill above the messages. */
  today: string;
  /** Telegram header: status under the name. */
  online: string;
  /** Dark Telegram header: “last seen just now”. */
  lastSeen: string;
  /** Telegram header: back button. */
  chats: string;
}

export const VIDEO_STRINGS: Record<Lang, VideoStrings> = {
  ru: {
    placeholder: 'Сообщение',
    delivered: 'Доставлено',
    lettersKey: 'АБВ',
    spaceKey: 'Пробел',
    returnKey: 'Ввод',
    today: 'Сегодня',
    online: 'в сети',
    lastSeen: 'был(а) только что',
    chats: 'Чаты',
  },
  uz: {
    placeholder: 'Xabar',
    delivered: 'Yetkazildi',
    lettersKey: 'ABC',
    spaceKey: 'Boʻsh joy',
    returnKey: 'Qaytish',
    today: 'Bugun',
    online: 'onlayn',
    lastSeen: 'hozirgina tarmoqda edi',
    chats: 'Chatlar',
  },
};

export { UI_STRINGS, type UiKey } from './ui';
