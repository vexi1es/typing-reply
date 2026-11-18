import { describe, expect, it } from 'vitest';
import { detectLang } from '../i18n';
import { KeyboardSim } from '../keyboard/sim';
import { generateTimeline, MAX_CHARS, splitGraphemes, stateAt, TAIL, type Mode, type TimelineOptions } from '.';

const gen = (o: Partial<TimelineOptions> & { text: string }) =>
  generateTimeline({ mode: 'normal', seed: 1, lang: 'uz', ...o });

const presses = (o: Parameters<typeof gen>[0]) =>
  gen(o).events.flatMap((e) => (e.type === 'press' ? [e.key] : []));

/** Expected result: the text clipped to the mode’s limit. */
const clip = (text: string, mode: Mode = 'normal') => splitGraphemes(text).slice(0, MAX_CHARS[mode]).join('');

const finalText = (o: Parameters<typeof gen>[0]) => {
  const tl = gen(o);
  return stateAt(tl, tl.duration).graphemes.join('');
};

describe('splitGraphemes', () => {
  it('keeps emoji and Cyrillic intact', () => {
    expect(splitGraphemes('Ок 👍🏽 👨‍👩‍👧')).toEqual(['О', 'к', ' ', '👍🏽', ' ', '👨‍👩‍👧']);
  });
});

describe('generateTimeline', () => {
  it('is deterministic for a given seed', () => {
    expect(gen({ text: 'привет', seed: 42 })).toEqual(gen({ text: 'привет', seed: 42 }));
  });

  it('different seeds give different timing', () => {
    expect(gen({ text: 'привет', seed: 1 }).duration).not.toEqual(gen({ text: 'привет', seed: 2 }).duration);
  });

  it('events are sorted by time', () => {
    for (const mode of ['normal', 'grandpa', 'typos', 'manicure', 'breaks'] as Mode[]) {
      const tl = gen({ text: 'ну что, как дела? Всё ок 👍', mode, seed: 7, lang: 'ru' });
      for (let i = 1; i < tl.events.length; i++) {
        expect(tl.events[i]!.t).toBeGreaterThanOrEqual(tl.events[i - 1]!.t);
      }
    }
  });

  it('always ends with exactly the input text — in every mode and for any seed', () => {
    const text = 'Привет! Call me at 5:30, ок? Ёлки 😅';
    for (const mode of ['normal', 'grandpa', 'typos', 'manicure', 'breaks'] as Mode[]) {
      for (let seed = 0; seed < 50; seed++) {
        expect(finalText({ text, mode, seed, lang: 'ru' })).toBe(clip(text, mode));
      }
    }
  });

  it('breaks mode: at least one break, nothing is typed during a break', () => {
    for (const text of ['ok', 'Sorry, give me a sec, then I will reply', 'a '.repeat(60)]) {
      for (let seed = 0; seed < 20; seed++) {
        const tl = gen({ text, mode: 'breaks', seed });
        expect(tl.breaks.length).toBeGreaterThanOrEqual(1);
        for (const b of tl.breaks) {
          expect(b.t1 - b.t0).toBeGreaterThan(4);
          expect(tl.events.some((e) => e.t >= b.t0 && e.t <= b.t1)).toBe(false);
        }
      }
    }
    expect(gen({ text: 'ok', mode: 'normal' }).breaks).toEqual([]);
  });

  it('collapses whitespace', () => {
    expect(finalText({ text: '  a \n\n b  ' })).toBe('a b');
  });

  it('grandpa is slower than normal and hovers over keys', () => {
    const text = 'это очень длинное сообщение';
    const n = gen({ text, lang: 'ru', seed: 3 });
    const g = gen({ text, lang: 'ru', seed: 3, mode: 'grandpa' });
    expect(g.duration).toBeGreaterThan(n.duration * 2);
    expect(g.events.some((e) => e.type === 'hover')).toBe(true);
  });

  it('typos mode makes typos and erases them', () => {
    const tl = gen({ text: 'the quick brown fox jumps over the lazy dog', mode: 'typos', seed: 5 });
    expect(tl.events.some((e) => e.type === 'press' && e.key === 'backspace')).toBe(true);
  });

  it('length punishment: the video is no shorter than the voice message', () => {
    const tl = gen({ text: 'ок', voiceSeconds: 30 });
    expect(tl.duration).toBeCloseTo(30);
    expect(tl.voiceSeconds).toBe(30);
    const send = tl.events.at(-1)!;
    expect(send.type).toBe('send');
    expect(tl.duration - send.t).toBeCloseTo(TAIL);
  });

  it('clips the text to the mode limit (in graphemes)', () => {
    expect([...finalText({ text: '😅'.repeat(200) })].length).toBe(MAX_CHARS.normal);
    expect([...finalText({ text: '😅'.repeat(200), mode: 'grandpa' })].length).toBe(MAX_CHARS.grandpa);
  });

  it('grandpa at the char limit usually fits into 60 s without speeding up', () => {
    for (const text of ['Слушай, напиши текстом, ладно?', 'НЕ БУДУ СЛУШАТЬ ГОЛОСОВОЕ, ПИШИ', "Hey, just text me, ok? Thanks"]) {
      const d = Array.from({ length: 100 }, (_, seed) =>
        gen({ text: clip(text, 'grandpa'), mode: 'grandpa', seed, lang: 'ru', maxDuration: Infinity }).duration,
      ).sort((a, b) => a - b);
      expect(d[89]).toBeLessThan(60); // p90; rare outliers get slightly compressed by the cap
    }
  });

  it('length never exceeds the cap', () => {
    const tl = gen({ text: 'a'.repeat(150), mode: 'typos', maxDuration: 20 });
    expect(tl.duration).toBeCloseTo(20);
  });
});

describe('keyboard', () => {
  it('auto-capitalisation: ⇧ is on at the start and after the end of a sentence', () => {
    expect(presses({ text: 'Hi' })).toEqual(['c:h', 'c:i']);
    // a lowercase start turns the automatic ⇧ off
    expect(presses({ text: 'hi' })).toEqual(['shift', 'c:h', 'c:i']);
    expect(presses({ text: 'Ok. Da', lang: 'uz' })).toEqual([
      'c:o', 'c:k', 'to-symbols', 'c:.', 'space', 'c:d', 'c:a',
    ]);
  });

  it('uppercase letter in the middle goes through shift', () => {
    expect(presses({ text: 'Ok Hi' })).toEqual(['c:o', 'c:k', 'space', 'shift', 'c:h', 'c:i']);
  });

  it('ALL CAPS uses Caps Lock (double tap ⇧) and turns it off with a single tap', () => {
    expect(presses({ text: 'НЕТ, да', lang: 'ru' })).toEqual([
      'shift', 'c:н', 'c:е', 'c:т', 'to-symbols', 'c:,', 'space', 'shift', 'c:д', 'c:а',
    ]);
  });

  it('a single capital does not use Caps Lock', () => {
    expect(presses({ text: 'Ок', lang: 'ru' })).toEqual(['c:о', 'c:к']);
  });

  it('another language goes through 🌐', () => {
    expect(presses({ text: 'Да', lang: 'uz' })).toEqual(['globe', 'c:д', 'c:а']);
    expect(presses({ text: 'Да', lang: 'ru' })).toEqual(['c:д', 'c:а']);
  });

  it('digits and punctuation use 123 without switching layout, back to letters after a space', () => {
    expect(presses({ text: 'В 5, ок', lang: 'ru' })).toEqual([
      'c:в', 'space', 'to-symbols', 'c:5', 'c:,', 'space', 'c:о', 'c:к',
    ]);
  });

  it('ё is typed from the е key, emoji from the emoji key', () => {
    expect(presses({ text: 'Ё😅', lang: 'ru' })).toEqual(['c:е', 'emoji']);
    // a long press: the release comes after the hold
    const press = gen({ text: 'Ё', lang: 'ru' }).events.find((e) => e.type === 'press');
    expect(press).toMatchObject({ key: 'c:е', longPress: true, hold: 0.6 });
  });
});

describe('languages', () => {
  it('detectLang: supported browser language, else ru; ?lang overrides', () => {
    expect(detectLang('', ['ru-RU', 'en'])).toBe('ru');
    expect(detectLang('', ['uz-UZ'])).toBe('uz');
    expect(detectLang('', ['de-DE', 'uz'])).toBe('ru');
    expect(detectLang('', [])).toBe('ru');
    expect(detectLang('?lang=uz', ['ru'])).toBe('uz');
    // the saved choice beats the browser but loses to ?lang
    expect(detectLang('', ['ru'], 'uz')).toBe('uz');
    expect(detectLang('?lang=ru', ['ru'], 'uz')).toBe('ru');
  });

  it('enabled layouts: site language + those needed for the text', () => {
    const langs = (text: string, site: Parameters<typeof KeyboardSim.langsFor>[1]) =>
      KeyboardSim.langsFor(splitGraphemes(text), site);
    expect(langs('ok', 'ru')).toEqual(['ru', 'uz']);
    expect(langs('привет', 'uz')).toEqual(['uz', 'ru']);
    expect(langs('mañana', 'uz')).toEqual(['uz']); // ñ via long press on n
  });

  it('Uzbek oʻ / gʻ use the apostrophe of the English keyboard; ş ç ö are long presses', () => {
    expect(presses({ text: 'Oʻ', lang: 'uz' })).toEqual(['c:o', 'to-symbols', "c:'"]);
    expect(presses({ text: 'Gʼ', lang: 'uz' })).toEqual(['c:g', 'to-symbols', "c:'"]);
    expect(presses({ text: 'Işş', lang: 'uz' })).toEqual(['c:i', 'c:s', 'c:s']);
  });

  it('Uzbek Cyrillic letters use long press on the Russian layout', () => {
    expect(presses({ text: 'Ўқ', lang: 'ru' })).toEqual(['c:у', 'c:к']);
  });

  it('final text is exact in every language and mode', () => {
    const texts = {
      uz: 'Salom! Ertaga soat 5 da koʻrishamiz, gʻalaba 👍 привет',
      ru: 'Ок, see you в 5:30 €, ўзбек тили «да»',
    } as const;
    for (const [lang, text] of Object.entries(texts)) {
      for (const mode of ['normal', 'grandpa', 'typos', 'manicure', 'breaks'] as Mode[]) {
        for (let seed = 0; seed < 20; seed++) {
          expect(finalText({ text, mode, seed, lang: lang as keyof typeof texts })).toBe(clip(text, mode));
        }
      }
    }
  });
});

describe('stateAt', () => {
  const tl = gen({ text: 'абв', lang: 'ru' });

  it('empty before typing starts, keyboard in the site language', () => {
    const s = stateAt(tl, 0);
    expect(s.graphemes).toEqual([]);
    expect(s.kb).toEqual({ lang: 'ru', page: 'letters', shift: true, capsLock: false });
    expect(s.sentAt).toBeNull();
    expect(s.focusAt).toBeNull();
    expect(stateAt(tl, 1).focusAt).not.toBeNull();
  });

  it('full text and sent at the end', () => {
    const s = stateAt(tl, tl.duration);
    expect(s.graphemes.join('')).toBe('абв');
    expect(s.sentAt).not.toBeNull();
  });
});
