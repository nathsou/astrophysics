import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { flatten } from '$lib/sim/netlist/flatten';
import { createDigitalEngine } from '$lib/sim/digital';
import type { Circuit } from '$lib/sim/netlist/types';
import { PATTERNS, nextSaturating, simulate } from './widgets/predictor';

/**
 * Figure 32.4: the two-bit branch predictor as gates and two flip-flops. The circuit must be the saturating counter of
 * the widget's model for every (state, outcome), and its GUESS and WRONG lamps must say what the text says.
 */
const dir = fileURLToPath(new URL('./circuits/', import.meta.url));
const load = (name: string): Circuit => JSON.parse(readFileSync(dir + name + '.json', 'utf8')) as Circuit;

function bench() {
  const e = createDigitalEngine(flatten(load('predictor')));
  e.advance(50e-9);
  const lit = (id: string) => !!e.state(id).lit;
  return {
    e,
    lit,
    /** 0–3: GUESS is the top bit, the green lamp the bottom bit. */
    state: () => (lit('GUESS') ? 2 : 0) + (lit('STATE0') ? 1 : 0),
    outcome(taken: boolean) {
      e.setParam('T', 'on', taken);
      e.advance(20e-9);
    },
    clock() {
      e.setParam('CLK', 'pressed', true);
      e.advance(20e-9);
      e.setParam('CLK', 'pressed', false);
      e.advance(20e-9);
    },
  };
}

describe('the circuit loads and runs without messages', () => {
  test('predictor', () => {
    const b = bench();
    b.e.advance(1e-6);
    expect(b.e.messages.filter((m) => m.level !== 'info')).toEqual([]);
  });
});

describe('Figure 32.4: the two-bit predictor', () => {
  test('it powers up in state 0, strongly not taken: GUESS is dark', () => {
    const b = bench();
    expect(b.state()).toBe(0);
    expect(b.lit('GUESS')).toBe(false);
    expect(b.lit('WRONG')).toBe(false);
  });

  test('WRONG is lit exactly when the outcome differs from the guess', () => {
    const b = bench();
    b.outcome(true);
    expect(b.lit('WRONG')).toBe(true);
    b.outcome(false);
    expect(b.lit('WRONG')).toBe(false);
  });

  test('nothing changes until the clock edge', () => {
    const b = bench();
    b.outcome(true);
    expect(b.state()).toBe(0);
    b.clock();
    expect(b.state()).toBe(1);
  });

  test.each([0, 1, 2, 3])('from state %i, both outcomes go where a saturating counter goes', (from) => {
    for (const taken of [true, false]) {
      const b = bench();
      // walk up to the state with "taken" branches (and check each step on the way)
      b.outcome(true);
      for (let s = 0; s < from; s++) {
        expect(b.state()).toBe(s);
        b.clock();
      }
      expect(b.state()).toBe(from);
      b.outcome(taken);
      b.clock();
      expect(b.state(), `${from} ${taken}`).toBe(nextSaturating(from, taken));
    }
  });

  test('the loop of Figure 32.5: it misses the exit of each loop and nothing else once it has warmed up', () => {
    const b = bench();
    const outcomes = PATTERNS.find((p) => p.id === 'loop8')!.outcomes;
    let wrong = 0;
    for (const t of outcomes) {
      b.outcome(t);
      if (b.lit('WRONG')) wrong++;
      b.clock();
    }
    expect(wrong).toBe(simulate('two-bit', outcomes).misses);
    expect(wrong).toBe(outcomes.length / 8 + 2);
  });

  test('a single not-taken branch does not change its mind: from strongly taken, one N still guesses taken', () => {
    const b = bench();
    b.outcome(true);
    b.clock();
    b.clock();
    b.clock();
    expect(b.state()).toBe(3);
    b.outcome(false);
    b.clock();
    expect(b.state()).toBe(2);
    expect(b.lit('GUESS')).toBe(true);
  });
});
