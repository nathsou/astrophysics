/**
 * Character-level vocabulary: one token per Unicode code point. Chapter 3 replaces it with
 * byte-level BPE, behind the same encode/decode interface.
 */
export interface Tokeniser {
  readonly vocabSize: number;
  encode(text: string): number[];
  decode(ids: ArrayLike<number>): string;
  /** Human-readable form of a single token (whitespace made visible). */
  show(id: number): string;
}

export class CharVocab implements Tokeniser {
  readonly chars: string[];
  private readonly index: Map<string, number>;

  constructor(chars: Iterable<string>) {
    this.chars = [...new Set(chars)].sort((a, b) => a.codePointAt(0)! - b.codePointAt(0)!);
    this.index = new Map(this.chars.map((c, i) => [c, i]));
  }

  static fromText(text: string): CharVocab {
    return new CharVocab(text);
  }

  get vocabSize(): number {
    return this.chars.length;
  }

  encode(text: string): number[] {
    const out: number[] = [];
    for (const ch of text) {
      const id = this.index.get(ch);
      if (id === undefined) throw new Error(`Character ${JSON.stringify(ch)} is not in the vocabulary`);
      out.push(id);
    }
    return out;
  }

  decode(ids: ArrayLike<number>): string {
    let s = '';
    for (let i = 0; i < ids.length; i++) s += this.chars[ids[i]!] ?? '�';
    return s;
  }

  show(id: number): string {
    const c = this.chars[id] ?? '?';
    return c === ' ' ? '␣' : c === '\n' ? '↵' : c === '\t' ? '⇥' : c;
  }
}

/** Word-level vocabulary built from a token list; rare words can be mapped to <unk>. */
export class WordVocab implements Tokeniser {
  readonly words: string[];
  private readonly index: Map<string, number>;
  static readonly UNK = '<unk>';

  constructor(words: string[], minCount = 1) {
    const counts = new Map<string, number>();
    for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
    const kept = [...counts].filter(([, c]) => c >= minCount).sort((a, b) => b[1] - a[1]).map(([w]) => w);
    this.words = [WordVocab.UNK, ...kept];
    this.index = new Map(this.words.map((w, i) => [w, i]));
  }

  get vocabSize(): number {
    return this.words.length;
  }

  encode(text: string | string[]): number[] {
    const ws = typeof text === 'string' ? text.split(/\s+/).filter(Boolean) : text;
    return ws.map((w) => this.index.get(w) ?? 0);
  }

  decode(ids: ArrayLike<number>): string {
    return Array.from(ids, (i) => this.words[i] ?? WordVocab.UNK).join(' ');
  }

  show(id: number): string {
    return this.words[id] ?? WordVocab.UNK;
  }
}
