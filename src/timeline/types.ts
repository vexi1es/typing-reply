import type { Lang } from '../i18n';
import type { KeyboardState, Press } from '../keyboard/sim';
import type { KeyId } from '../keyboard/layout';

export type Mode = 'normal' | 'grandpa' | 'typos' | 'manicure' | 'breaks';

/** A pause where the right hand leaves the phone: a sip of coffee or a smoke. */
export interface Break {
  kind: 'coffee' | 'smoke';
  /** Start and end of the break, s. Nothing is typed in between. */
  t0: number;
  t1: number;
}

/**
 * `t` is seconds from the start of the video. Pauses are just gaps between events.
 * - focus: the finger taps the input field and the keyboard slides up;
 * - press: a key press (with its effect on the text); `hold` = how long the key was held before
 *   (a long press with the variant picker), the press time is the moment of release;
 * - hover: the finger hovers over a key without pressing (grandpa looking for a letter);
 * - send: the send button is pressed.
 */
export type TimelineEvent =
  | { t: number; type: 'focus'; kb: KeyboardState }
  | ({ t: number; type: 'press'; hold?: number } & Press)
  | { t: number; type: 'hover'; key: KeyId; kb: KeyboardState }
  | { t: number; type: 'send'; kb: KeyboardState };

export interface Timeline {
  events: TimelineEvent[];
  /** Total video duration, s. */
  duration: number;
  mode: Mode;
  /** Breaks (only in the `breaks` mode). */
  breaks: Break[];
  /** UI language of the phone in the video. */
  lang: Lang;
  /** Length of the voice message being answered (drawn in the chat). */
  voiceSeconds: number;
}

export interface TimelineOptions {
  text: string;
  mode: Mode;
  seed: number;
  lang: Lang;
  /** Voice message length. The video won’t be shorter (“length punishment”), but never longer than maxDuration. */
  voiceSeconds?: number;
  /** Maximum video length, s. */
  maxDuration?: number;
}
