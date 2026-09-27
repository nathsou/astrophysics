/**
 * Byte-level byte-pair encoding (Chapter 3).
 *
 * Text is split into chunks by a pre-tokenisation regex, each chunk is turned into UTF-8 bytes
 * (ids 0–255), and learned merges combine adjacent ids into new tokens (ids 256, 257, …).
 * Because the base vocabulary is all 256 bytes, any string can be encoded and decoding is lossless.
 */
import { utf8Encode, utf8Decode } from '../text/unicode.ts';
import { Heap } from '../util/heap.ts';
import type { Tokeniser } from './char.ts';

/** GPT-2's pre-tokenisation pattern (Radford et al., 2019). */
export const GPT2_PATTERN = String.raw`'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+`;

/**
 * The course's pattern: GPT-2's, but with digits grouped in runs of at most three (as in GPT-4 and
 * Llama 3), so numbers are tokenised consistently.
 */
export const COURSE_PATTERN = String.raw`'(?:[sdmt]|ll|ve|re)| ?\p{L}+| ?\p{N}{1,3}| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+`;

export interface BpeSpec {
  pattern: string;
  /** Merge i creates token 256 + i from the pair merges[i]. */
  merges: [number, number][];
  /** Special tokens, e.g. {"<|endoftext|>": 256 + merges.length}. */
  special: Record<string, number>;
}

const PAIR = 1 << 20; // token ids stay below 2^20
const key = (a: number, b: number) => a * PAIR + b;

/** Split text into pre-tokenisation chunks. */
export function pretokenise(text: string, pattern: string): string[] {
  return text.match(new RegExp(pattern, 'gu')) ?? [];
}

/** Apply merges to one chunk's ids: repeatedly merge the lowest-ranked adjacent pair. */
export function applyMerges(ids: number[], ranks: Map<number, number>): number[] {
  let seq = ids;
  while (seq.length >= 2) {
    let best = Infinity;
    for (let i = 0; i + 1 < seq.length; i++) {
      const r = ranks.get(key(seq[i]!, seq[i + 1]!));
      if (r !== undefined && r < best) best = r;
    }
    if (best === Infinity) break;
    const pk = bestPair(ranks, best);
    const a = Math.floor(pk / PAIR), b = pk % PAIR;
    const out: number[] = [];
    for (let i = 0; i < seq.length; i++) {
      if (i + 1 < seq.length && seq[i] === a && seq[i + 1] === b) {
        out.push(256 + best);
        i++;
      } else out.push(seq[i]!);
    }
    seq = out;
  }
  return seq;
}

// rank → pair key lookup, cached per ranks map.
const inverse = new WeakMap<Map<number, number>, number[]>();
function bestPair(ranks: Map<number, number>, rank: number): number {
  let inv = inverse.get(ranks);
  if (!inv) {
    inv = [];
    for (const [k, r] of ranks) inv[r] = k;
    inverse.set(ranks, inv);
  }
  return inv[rank]!;
}

export class BpeTokeniser implements Tokeniser {
  readonly pattern: string;
  readonly merges: [number, number][];
  readonly special: Map<string, number>;
  private readonly ranks = new Map<number, number>();
  private readonly bytes: Uint8Array[] = [];
  private readonly cache = new Map<string, number[]>();
  private readonly regex: RegExp;
  private readonly specialRegex: RegExp | null;

  constructor(spec: BpeSpec) {
    this.pattern = spec.pattern;
    this.merges = spec.merges;
    this.special = new Map(Object.entries(spec.special));
    this.regex = new RegExp(spec.pattern, 'gu');
    const esc = [...this.special.keys()].map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    this.specialRegex = esc.length ? new RegExp(`(${esc.join('|')})`, 'u') : null;
    for (let b = 0; b < 256; b++) this.bytes.push(Uint8Array.of(b));
    spec.merges.forEach(([a, b], i) => {
      this.ranks.set(key(a, b), i);
      const x = this.bytes[a]!, y = this.bytes[b]!;
      const m = new Uint8Array(x.length + y.length);
      m.set(x);
      m.set(y, x.length);
      this.bytes.push(m);
    });
    for (const [s, id] of this.special) this.bytes[id] = utf8Encode(s);
  }

  static train(text: string, numMerges: number, opts: { pattern?: string; special?: string[] } = {}): BpeTokeniser {
    const trainer = new BpeTrainer(text, opts.pattern ?? COURSE_PATTERN);
    while (trainer.merges.length < numMerges && trainer.step()) {
      /* keep merging */
    }
    return trainer.tokeniser(opts.special ?? []);
  }

  get vocabSize(): number {
    return 256 + this.merges.length + this.special.size;
  }

  /** Encode one pre-tokenised chunk (cached). */
  encodeChunk(chunk: string): number[] {
    let ids = this.cache.get(chunk);
    if (!ids) {
      ids = applyMerges(Array.from(utf8Encode(chunk)), this.ranks);
      if (this.cache.size < 200_000) this.cache.set(chunk, ids);
    }
    return ids;
  }

  /**
   * Encode text. Special-token strings are only turned into special tokens when `allowSpecial` is
   * true — otherwise a user typing "<|endoftext|>" gets ordinary text tokens, not a control signal.
   */
  encode(text: string, opts: { allowSpecial?: boolean } = {}): number[] {
    const out: number[] = [];
    const pieces = opts.allowSpecial && this.specialRegex ? text.split(this.specialRegex) : [text];
    for (const piece of pieces) {
      const sp = opts.allowSpecial ? this.special.get(piece) : undefined;
      if (sp !== undefined) {
        out.push(sp);
        continue;
      }
      for (const m of piece.matchAll(this.regex)) out.push(...this.encodeChunk(m[0]));
    }
    return out;
  }

  /** Split text into [chunk, token ids] pairs — useful for visualisation. */
  encodeChunks(text: string): { chunk: string; ids: number[] }[] {
    return pretokenise(text, this.pattern).map((chunk) => ({ chunk, ids: this.encodeChunk(chunk) }));
  }

  tokenBytes(id: number): Uint8Array {
    return this.bytes[id] ?? new Uint8Array();
  }

  decode(ids: ArrayLike<number>): string {
    let n = 0;
    for (let i = 0; i < ids.length; i++) n += this.tokenBytes(ids[i]!).length;
    const buf = new Uint8Array(n);
    let o = 0;
    for (let i = 0; i < ids.length; i++) {
      const b = this.tokenBytes(ids[i]!);
      buf.set(b, o);
      o += b.length;
    }
    return utf8Decode(buf);
  }

  /** Readable form of one token: whitespace made visible, incomplete UTF-8 shown as hex bytes. */
  show(id: number): string {
    const b = this.tokenBytes(id);
    const s = new TextDecoder('utf-8', { fatal: false }).decode(b);
    const readable = s.includes('�') ? [...b].map((x) => `\\x${x.toString(16).toUpperCase().padStart(2, '0')}`).join('') : s;
    return readable.replace(/ /g, '␣').replace(/\n/g, '↵').replace(/\t/g, '⇥');
  }

  /** The two tokens a merged token was built from (undefined for bytes and specials). */
  parts(id: number): [number, number] | undefined {
    return id >= 256 && id < 256 + this.merges.length ? this.merges[id - 256] : undefined;
  }

  toJSON(): BpeSpec {
    return { pattern: this.pattern, merges: this.merges, special: Object.fromEntries(this.special) };
  }
}

interface Word {
  ids: number[];
  count: number;
}

export interface MergeStep {
  pair: [number, number];
  id: number;
  /** How many times the pair occurred — the reduction in total token count from this merge. */
  count: number;
}

/**
 * Incremental BPE trainer. Keeps pair counts, an index from pair to the words containing it, and a
 * lazy max-heap, so each merge only touches the words it changes.
 *
 * Tie-breaking (identical in the Python version): highest count, then smallest first id, then
 * smallest second id.
 */
export class BpeTrainer {
  readonly pattern: string;
  readonly merges: [number, number][] = [];
  readonly steps: MergeStep[] = [];
  private readonly words: Word[] = [];
  private readonly counts = new Map<number, number>();
  private readonly where = new Map<number, Set<number>>();
  private readonly heap = new Heap<[number, number, number]>((x, y) => x[0] > y[0] || (x[0] === y[0] && (x[1] < y[1] || (x[1] === y[1] && x[2] < y[2]))));
  /** Total tokens in the training text under the current merges. */
  totalTokens = 0;
  readonly totalBytes: number;

  constructor(text: string, pattern: string = COURSE_PATTERN) {
    this.pattern = pattern;
    const chunks = new Map<string, number>();
    for (const c of pretokenise(text, pattern)) chunks.set(c, (chunks.get(c) ?? 0) + 1);
    for (const [c, count] of chunks) this.words.push({ ids: Array.from(utf8Encode(c)), count });
    this.words.forEach((w, wi) => {
      this.totalTokens += w.ids.length * w.count;
      this.addPairs(w, wi, null);
    });
    this.totalBytes = this.totalTokens;
    for (const [k, c] of this.counts) this.heap.push([c, Math.floor(k / PAIR), k % PAIR]);
  }

  private addPairs(w: Word, wi: number, touched: Set<number> | null, sign = 1): void {
    for (let i = 0; i + 1 < w.ids.length; i++) {
      const k = key(w.ids[i]!, w.ids[i + 1]!);
      const c = (this.counts.get(k) ?? 0) + sign * w.count;
      if (c === 0) this.counts.delete(k);
      else this.counts.set(k, c);
      if (sign > 0) {
        let s = this.where.get(k);
        if (!s) this.where.set(k, (s = new Set()));
        s.add(wi);
      }
      touched?.add(k);
    }
  }

  /** The pair that would be merged next, without merging it. */
  peek(): { pair: [number, number]; count: number } | null {
    for (;;) {
      const top = this.heap.pop();
      if (!top) return null;
      const [c, a, b] = top;
      if (this.counts.get(key(a, b)) === c) {
        this.heap.push(top);
        return { pair: [a, b], count: c };
      }
      // stale entry: discard
    }
  }

  /** Perform one merge; returns null when no adjacent pair is left to merge. */
  step(): MergeStep | null {
    const next = this.peek();
    if (!next) return null;
    this.heap.pop();
    const [a, b] = next.pair;
    const k = key(a, b);
    const id = 256 + this.merges.length;
    const touched = new Set<number>();
    for (const wi of this.where.get(k) ?? []) {
      const w = this.words[wi]!;
      let has = false;
      for (let i = 0; i + 1 < w.ids.length; i++) if (w.ids[i] === a && w.ids[i + 1] === b) has = true;
      if (!has) continue;
      this.addPairs(w, wi, touched, -1);
      const merged: number[] = [];
      for (let i = 0; i < w.ids.length; i++) {
        if (i + 1 < w.ids.length && w.ids[i] === a && w.ids[i + 1] === b) {
          merged.push(id);
          i++;
        } else merged.push(w.ids[i]!);
      }
      this.totalTokens -= (w.ids.length - merged.length) * w.count;
      w.ids = merged;
      this.addPairs(w, wi, touched, 1);
    }
    this.where.delete(k);
    for (const t of touched) {
      const c = this.counts.get(t);
      if (c) this.heap.push([c, Math.floor(t / PAIR), t % PAIR]);
    }
    this.merges.push([a, b]);
    const s = { pair: [a, b] as [number, number], id, count: next.count };
    this.steps.push(s);
    return s;
  }

  tokeniser(special: string[] = []): BpeTokeniser {
    const base = 256 + this.merges.length;
    return new BpeTokeniser({ pattern: this.pattern, merges: [...this.merges], special: Object.fromEntries(special.map((s, i) => [s, base + i])) });
  }
}

/** GPT-2's byte ↔ printable-unicode mapping used in its vocab files. */
export function gpt2ByteEncoder(): Map<number, string> {
  const bs: number[] = [];
  for (let b = 33; b <= 126; b++) bs.push(b);
  for (let b = 161; b <= 172; b++) bs.push(b);
  for (let b = 174; b <= 255; b++) bs.push(b);
  const cs = [...bs];
  let n = 0;
  for (let b = 0; b < 256; b++) {
    if (!bs.includes(b)) {
      bs.push(b);
      cs.push(256 + n++);
    }
  }
  return new Map(bs.map((b, i) => [b, String.fromCodePoint(cs[i]!)]));
}

/**
 * Build GPT-2's tokeniser from its published files (vocab.bpe, encoder.json). Returns our tokeniser
 * plus a table from our token ids to GPT-2's ids (they number tokens differently).
 */
export function loadGpt2(vocabBpe: string, encoderJson: Record<string, number>): { tokeniser: BpeTokeniser; gpt2Id: Int32Array } {
  const enc = gpt2ByteEncoder();
  const ours = new Map<string, number>();
  for (const [b, ch] of enc) ours.set(ch, b);
  const merges: [number, number][] = [];
  const lines = vocabBpe.split('\n').filter((l) => l && !l.startsWith('#version'));
  for (const line of lines) {
    const [x, y] = line.split(' ') as [string, string];
    merges.push([ours.get(x)!, ours.get(y)!]);
    ours.set(x + y, 255 + merges.length);
  }
  const eot = 256 + merges.length;
  const tokeniser = new BpeTokeniser({ pattern: GPT2_PATTERN, merges, special: { '<|endoftext|>': eot } });
  const gpt2Id = new Int32Array(tokeniser.vocabSize).fill(-1);
  for (const [s, id] of ours) gpt2Id[id] = encoderJson[s] ?? -1;
  gpt2Id[eot] = encoderJson['<|endoftext|>'] ?? 50256;
  return { tokeniser, gpt2Id };
}
