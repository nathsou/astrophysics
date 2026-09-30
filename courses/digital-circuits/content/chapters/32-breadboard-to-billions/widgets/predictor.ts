/**
 * Branch predictors, the state machines of Chapter 19 at work in a CPU. A branch outcome is `true` when the branch is
 * taken. A predictor guesses before the outcome is known and learns after it.
 *
 * - `static`: always guess "taken".
 * - `one-bit`: one flip-flop remembering the last outcome.
 * - `two-bit`: the saturating counter of the live circuit of Figure 32.4. States 0–3; the guess is the top bit (states
 *   2 and 3 guess taken); a taken branch counts up and a not-taken one counts down, both stopping at the ends.
 *   The next-state equations, with s = (s1, s0) and t the outcome, are s1′ = MAJ(s1, s0, t) and s0′ = MAJ(s1, ¬s0, t).
 */

export type Kind = 'static' | 'one-bit' | 'two-bit';
export const KINDS: Kind[] = ['static', 'one-bit', 'two-bit'];

export const NAMES: Record<Kind, string> = { static: 'Always taken', 'one-bit': 'One bit', 'two-bit': 'Two-bit counter' };

const maj = (a: number, b: number, c: number) => (a & b) | (a & c) | (b & c);

/** The next state of the two-bit counter by the equations of the circuit. */
export function nextTwoBit(state: number, taken: boolean): number {
  const s1 = (state >> 1) & 1;
  const s0 = state & 1;
  const t = taken ? 1 : 0;
  return (maj(s1, s0, t) << 1) | maj(s1, s0 ^ 1, t);
}

/** The same state machine written the way Chapter 19 draws it: a saturating counter. */
export const nextSaturating = (state: number, taken: boolean) => (taken ? Math.min(3, state + 1) : Math.max(0, state - 1));

export interface Run {
  kind: Kind;
  /** The guess before each branch. */
  guesses: boolean[];
  /** Whether each guess was right. */
  hits: boolean[];
  /** The state before each branch (two-bit: 0–3; one-bit: 0 or 1; static: 0). */
  states: number[];
  misses: number;
}

/** Runs a predictor over a sequence of outcomes. All predictors power up "not taken", like the circuit's flip-flops. */
export function simulate(kind: Kind, outcomes: boolean[]): Run {
  let state = 0;
  const guesses: boolean[] = [];
  const hits: boolean[] = [];
  const states: number[] = [];
  let misses = 0;
  for (const taken of outcomes) {
    states.push(state);
    const guess = kind === 'static' ? true : kind === 'one-bit' ? state === 1 : state >= 2;
    guesses.push(guess);
    hits.push(guess === taken);
    if (guess !== taken) misses++;
    if (kind === 'one-bit') state = taken ? 1 : 0;
    else if (kind === 'two-bit') state = nextTwoBit(state, taken);
  }
  return { kind, guesses, hits, states, misses };
}

/** Deterministic pseudo-random bits (a 32-bit xorshift), so that a figure and its test see the same "random" branch. */
export function randomBits(n: number, pTaken: number, seed = 12345): boolean[] {
  let x = seed >>> 0 || 1;
  const out: boolean[] = [];
  for (let i = 0; i < n; i++) {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    out.push(x / 2 ** 32 < pTaken);
  }
  return out;
}

export interface Pattern {
  id: string;
  label: string;
  what: string;
  outcomes: boolean[];
}

/** The loop that goes round `n` times per entry: the branch at its foot is taken `n − 1` times and then falls through. */
export const loop = (n: number, entries: number): boolean[] => Array.from({ length: n * entries }, (_, i) => i % n !== n - 1);

export const LENGTH = 48;

export const PATTERNS: Pattern[] = [
  { id: 'loop8', label: 'Loop of 8', what: 'The branch at the end of a loop that runs 8 times, entered again and again: taken seven times, then not taken.', outcomes: loop(8, LENGTH / 8) },
  { id: 'loop3', label: 'Loop of 3', what: 'A short loop, 3 times round: taken, taken, not taken.', outcomes: loop(3, LENGTH / 3) },
  { id: 'alt', label: 'Alternating', what: 'An if that is true every other time (for instance, testing whether a counter is even).', outcomes: Array.from({ length: LENGTH }, (_, i) => i % 2 === 0) },
  { id: 'biased', label: '90 % taken', what: 'An error check that almost always passes, with a seeded pseudo-random 10 % of exceptions.', outcomes: randomBits(LENGTH, 0.9) },
  { id: 'rare', label: '10 % taken', what: 'A branch that jumps to rarely used code, taken about one time in ten (a seeded pseudo-random 10 %).', outcomes: randomBits(LENGTH, 0.1, 21) },
  { id: 'coin', label: 'A coin toss', what: 'A branch on unpredictable data, as in a sort of random numbers: a seeded pseudo-random 50 %.', outcomes: randomBits(LENGTH, 0.5, 7) },
];

/**
 * Cycles per instruction of a pipeline that guesses: 1 plus the penalty of every wrong guess, when a fraction
 * `branchFraction` of the instructions are branches and a wrong guess empties `penalty` stages.
 */
export const cpi = (missRate: number, penalty: number, branchFraction = 0.2) => 1 + branchFraction * missRate * penalty;
