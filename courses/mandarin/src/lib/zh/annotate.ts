/**
 * Segment Chinese text into words and attach pinyin. Words come from the course dictionary by
 * longest match; each word keeps its dictionary (citation) reading, so neutral tones are right
 * (xièxie, dōngxi). The two tone changes that the standard spelling writes down are applied
 * from context: 不 before a fourth tone becomes bú; 一 becomes yí before a fourth tone and yì
 * before the others, but stays yī in counting, ordinals and dates. (The third-tone change in
 * 你好 is pronounced but, by convention, not written.)
 *
 * Content can force a reading by writing it after a character in brackets: 长[zhǎng]大.
 */
import { MAX_WORD, charReading, lookup } from './lexicon';
import { syllables, toneOf, type Tone } from './pinyin';

export interface Syllable {
  ch: string;
  py: string;
  tone: Tone;
}

export interface Token {
  /** The text of the token (one word, or a run of non-Chinese text). */
  t: string;
  /** Present for Chinese words: one entry per character. */
  s?: Syllable[];
  /** Dictionary key, when the word is in the dictionary. */
  w?: string;
}

const HAN = /\p{Script=Han}/u;
export const isHan = (ch: string) => HAN.test(ch);
export const hasHan = (text: string) => HAN.test(text);

const DIGITS = '零〇一二三四五六七八九十两';

interface Unit {
  ch: string;
  forced?: string;
}

function parse(text: string): (Unit | string)[] {
  const out: (Unit | string)[] = [];
  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!;
    if (isHan(ch)) {
      if (chars[i + 1] === '[') {
        const close = chars.indexOf(']', i + 2);
        if (close > 0) {
          out.push({ ch, forced: chars.slice(i + 2, close).join('') });
          i = close;
          continue;
        }
      }
      out.push({ ch });
    } else {
      const last = out[out.length - 1];
      if (typeof last === 'string') out[out.length - 1] = last + ch;
      else out.push(ch);
    }
  }
  return out;
}

export function annotate(text: string): Token[] {
  const units = parse(text);
  const tokens: Token[] = [];
  let i = 0;
  while (i < units.length) {
    const u = units[i]!;
    if (typeof u === 'string') {
      tokens.push({ t: u });
      i++;
      continue;
    }
    // Longest dictionary match over consecutive Chinese characters.
    let run = 0;
    while (i + run < units.length && typeof units[i + run] !== 'string' && run < MAX_WORD) run++;
    let len = run;
    let entry;
    for (; len > 1; len--) {
      const w = (units.slice(i, i + len) as Unit[]).map((x) => x.ch).join('');
      entry = lookup(w);
      if (entry?.p) break;
    }
    const group = units.slice(i, i + len) as Unit[];
    const word = group.map((x) => x.ch).join('');
    if (len === 1) entry = lookup(word);
    const fromWord = entry?.p ? syllables(entry.p) : [];
    const sy: Syllable[] = group.map((g, k) => {
      const py = g.forced ?? (fromWord.length === group.length ? fromWord[k]! : (charReading(g.ch) ?? '?'));
      return { ch: g.ch, py, tone: toneOf(py) };
    });
    tokens.push({ t: word, s: sy, ...(entry ? { w: word } : {}) });
    i += len;
  }
  applySandhi(tokens, units);
  return tokens;
}

/** The 一 and 不 tone changes, decided from the neighbouring syllables. */
function applySandhi(tokens: Token[], units: (Unit | string)[]): void {
  const flat: { s: Syllable; forced: boolean }[] = [];
  const breaks = new Set<number>();
  let ui = 0;
  for (const t of tokens) {
    if (!t.s) {
      breaks.add(flat.length);
      ui++;
      continue;
    }
    for (const s of t.s) {
      const u = units[ui++] as Unit;
      flat.push({ s, forced: u.forced !== undefined });
    }
  }
  const nextOf = (k: number) => (breaks.has(k + 1) ? undefined : flat[k + 1]?.s);
  const prevOf = (k: number) => (breaks.has(k) ? undefined : flat[k - 1]?.s);
  flat.forEach(({ s, forced }, k) => {
    if (forced) return;
    const next = nextOf(k);
    const prev = prevOf(k);
    if (s.ch === '不' && s.py === 'bù' && next?.tone === 4) set(s, 'bú');
    if (s.ch === '一' && s.py === 'yī') {
      if (!next) return;
      if (prev && DIGITS.includes(prev.ch)) return;
      if (prev?.ch === '第' || prev?.ch === '期') return;
      if ('零〇一二三四五六七八九十'.includes(next.ch)) return;
      if ('月号日'.includes(next.ch)) return;
      if (prev && prev.ch === next.ch) return set(s, 'yi');
      set(s, next.tone === 4 || (next.tone === 5 && next.ch === '个') ? 'yí' : 'yì');
    }
  });
}

function set(s: Syllable, py: string): void {
  s.py = py;
  s.tone = toneOf(py);
}

/** Pinyin for a whole text, words joined without spaces inside them. */
export function pinyinOf(text: string): string {
  return annotate(text)
    .map((t) => (t.s ? t.s.map((s) => s.py).join('') : t.t))
    .join(' ')
    .replace(/\s+([，。！？、,.!?])/g, '$1')
    .replace(/[，]/g, ',')
    .replace(/[。]/g, '.')
    .replace(/[！]/g, '!')
    .replace(/[？]/g, '?')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Remove reading overrides: 长[zhǎng]大 → 长大. */
export function plain(text: string): string {
  return text.replace(/(\p{Script=Han})\[[^\]]*\]/gu, '$1');
}
