/**
 * Pinyin spelling: tone marks ⇄ tone numbers, and splitting syllables into initial + final.
 * Tone 5 is the neutral tone (no mark).
 */

export type Tone = 1 | 2 | 3 | 4 | 5;

const MARKED: Record<string, [string, Tone]> = {};
const VOWELS = 'aeiouü';
const TABLE: Record<string, string> = {
  a: 'āáǎà',
  e: 'ēéěè',
  i: 'īíǐì',
  o: 'ōóǒò',
  u: 'ūúǔù',
  ü: 'ǖǘǚǜ',
};
for (const [v, marks] of Object.entries(TABLE)) {
  [...marks].forEach((m, i) => {
    MARKED[m] = [v, (i + 1) as Tone];
    MARKED[m.toUpperCase()] = [v.toUpperCase(), (i + 1) as Tone];
  });
}

/** The tone of one syllable written with a mark (no mark = neutral). */
export function toneOf(syllable: string): Tone {
  for (const ch of syllable.normalize('NFC')) {
    const hit = MARKED[ch];
    if (hit) return hit[1];
  }
  return 5;
}

/** The syllable without its tone mark ("lǜ" → "lü"). */
export function bare(syllable: string): string {
  return [...syllable.normalize('NFC')].map((ch) => MARKED[ch]?.[0] ?? ch).join('');
}

/** Where the mark goes: a or e if present; o in "ou"; otherwise the last vowel. */
function markIndex(s: string): number {
  const lower = s.toLowerCase();
  for (const v of ['a', 'e']) {
    const i = lower.indexOf(v);
    if (i >= 0) return i;
  }
  const ou = lower.indexOf('ou');
  if (ou >= 0) return ou;
  for (let i = lower.length - 1; i >= 0; i--) if (VOWELS.includes(lower[i]!)) return i;
  return -1;
}

/** Put a tone mark on a bare syllable ("hao", 3 → "hǎo"). Accepts v or u: for ü. */
export function mark(syllable: string, tone: Tone): string {
  const s = syllable.replace(/u:|v/g, 'ü').replace(/U:|V/g, 'Ü');
  if (tone === 5) return s;
  const i = markIndex(s);
  if (i < 0) return s;
  const ch = s[i]!;
  const lower = ch.toLowerCase();
  const marked = TABLE[lower]?.[tone - 1];
  if (!marked) return s;
  return s.slice(0, i) + (ch === lower ? marked : marked.toUpperCase()) + s.slice(i + 1);
}

/** "ni3 hao3" or "ni3hao3" → "nǐ hǎo" / "nǐhǎo". Numbers 0 and 5 both mean neutral. */
export function numbersToMarks(text: string): string {
  return text.replace(/([a-zA-ZüÜ:]+)([0-5])/g, (_, syl: string, n: string) => mark(syl, (n === '0' ? 5 : Number(n)) as Tone));
}

/** "nǐ hǎo" → "ni3 hao3" (neutral syllables get 5). */
export function marksToNumbers(text: string): string {
  return text.replace(/[a-zA-ZāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüĀÁǍÀĒÉĚÈĪÍǏÌŌÓǑÒŪÚǓÙǕǗǙǛÜ]+/g, (syl) => {
    const t = toneOf(syl);
    return bare(syl).replace(/ü/g, 'v') + t;
  });
}

export const INITIALS = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w'] as const;

/** Split a bare syllable into initial and final ("zhuang" → ["zh", "uang"]). */
export function splitSyllable(syllable: string): { initial: string; final: string } {
  const s = bare(syllable).toLowerCase();
  for (const i of INITIALS) if (s.startsWith(i) && s.length > i.length) return { initial: i, final: s.slice(i.length) };
  return { initial: '', final: s };
}

/**
 * Compare a typed answer with the expected pinyin, syllable by syllable, ignoring spaces, case and
 * apostrophes. Learners may type tone numbers or marks. Reports which syllables have the right
 * sounds but the wrong tone, so feedback can say "right sounds, wrong tone".
 */
export function comparePinyin(typed: string, expected: string): { correct: boolean; soundsRight: boolean; tonesWrong: number[] } {
  const norm = (t: string) =>
    syllables(numbersToMarks(t.toLowerCase().replace(/['’]/g, ' ').replace(/u:|v/g, 'ü')));
  const a = norm(typed);
  const b = norm(expected);
  const flat = (xs: string[]) => xs.map(bare).join('');
  if (flat(a) !== flat(b) || a.length !== b.length) {
    // Typed without spaces: fall back to comparing the letters only.
    return { correct: false, soundsRight: flat(a) === flat(b), tonesWrong: [] };
  }
  const tonesWrong = a.flatMap((s, i) => (toneOf(s) === toneOf(b[i]!) ? [] : [i]));
  return { correct: tonesWrong.length === 0, soundsRight: true, tonesWrong };
}

/** Split written pinyin into syllables. Handles "nǐhǎo" and "xi'an" as well as spaced text. */
export function syllables(text: string): string[] {
  const out: string[] = [];
  for (const chunk of text.trim().split(/[\s'’]+/)) {
    if (!chunk) continue;
    out.push(...segment(chunk));
  }
  return out;
}

const FINALS = new Set(
  'a o e ai ei ao ou an en ang eng ong er i ia ie iao iu ian in iang ing iong u ua uo uai ui uan un uang ueng ü üe üan ün ue r n ng m'.split(' '),
);

/** Greedy longest-match split of an unspaced syllable run, preferring a valid parse. */
function segment(run: string): string[] {
  const b = bare(run).toLowerCase();
  const memo = new Map<number, number[] | null>();
  const go = (i: number): number[] | null => {
    if (i === b.length) return [];
    if (memo.has(i)) return memo.get(i)!;
    for (let len = Math.min(6, b.length - i); len >= 1; len--) {
      if (!isSyllable(b.slice(i, i + len))) continue;
      const rest = go(i + len);
      if (rest) {
        const res = [len, ...rest];
        memo.set(i, res);
        return res;
      }
    }
    memo.set(i, null);
    return null;
  };
  const lens = go(0);
  if (!lens) return [run];
  const out: string[] = [];
  let i = 0;
  const chars = [...run.normalize('NFC')];
  for (const len of lens) {
    out.push(chars.slice(i, i + len).join(''));
    i += len;
  }
  return out;
}

function isSyllable(s: string): boolean {
  if (s === 'r') return true; // erhua written as a separate syllable in some word lists
  const { initial, final } = splitSyllable(s);
  if (!final) return false;
  if (!initial) return FINALS.has(final) && !['i', 'u', 'ü', 'r', 'n', 'ng', 'm'].includes(final) ? true : ['er', 'm', 'n', 'ng'].includes(final);
  return FINALS.has(final) && final !== 'r';
}
