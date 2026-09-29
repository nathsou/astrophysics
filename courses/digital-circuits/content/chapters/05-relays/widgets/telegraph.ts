/**
 * Helpers for the telegraph-repeater figure: how a long line becomes a resistance, and the key
 * presses of a Morse message as a schedule the figure plays into the simulated key.
 */

/** Resistance of a telegraph line per kilometre: 4 mm iron wire is about 8 Ω/km (ρ_iron ≈ 1·10⁻⁷ Ω·m, area 12.6 mm²). */
export const OHMS_PER_KM = 8;

export const lineResistance = (km: number): number => km * OHMS_PER_KM;

export const MORSE: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--',
  N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
};

export interface KeyEvent {
  /** Seconds from the start of the message. */
  t: number;
  /** true: key pressed; false: released. */
  down: boolean;
}

/**
 * Key events for a message. Standard timing in units of one dot: dot 1, dash 3, gap inside a letter 1,
 * between letters 3, between words 7. `unit` is the dot length in seconds.
 */
export function morseSchedule(text: string, unit = 0.12): { events: KeyEvent[]; duration: number } {
  const events: KeyEvent[] = [];
  let t = 0;
  const words = text.toUpperCase().split(/\s+/).filter(Boolean);
  words.forEach((word, wi) => {
    if (wi > 0) t += 7 * unit;
    [...word].forEach((ch, ci) => {
      const code = MORSE[ch];
      if (!code) return;
      if (ci > 0) t += 3 * unit;
      [...code].forEach((sym, si) => {
        if (si > 0) t += unit;
        events.push({ t, down: true });
        t += (sym === '.' ? 1 : 3) * unit;
        events.push({ t, down: false });
      });
    });
  });
  return { events, duration: t };
}

/** Is the key down at time `t`? */
export function keyDownAt(events: readonly KeyEvent[], t: number): boolean {
  let down = false;
  for (const e of events) {
    if (e.t > t) break;
    down = e.down;
  }
  return down;
}
