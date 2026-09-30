import { describe, expect, test } from 'vitest';
import { createAnalogEngine } from './engine';
import { mixed50 } from './bench-circuit';

/**
 * Performance target (docs/PLAN.md): 60 frames per second with at least 10 internal steps per
 * frame for circuits up to 50 nodes, i.e. at least 600 steps per second of wall-clock time.
 */
describe('analog engine performance', () => {
  test('a 50-node mixed circuit runs at least 600 internal steps per second', () => {
    const netlist = mixed50();
    const nets = new Set(netlist.elements.flatMap((e) => e.pins));
    nets.delete(0);
    expect(nets.size).toBeGreaterThanOrEqual(50);
    const e = createAnalogEngine(netlist);
    // Warm up (JIT), then measure.
    e.advance(2e-3);
    const steps0 = e.stats.steps;
    const iters0 = e.stats.iterations;
    const start = performance.now();
    let frames = 0;
    while (performance.now() - start < 1000 && frames < 2000) {
      e.advance(1e-4);
      frames++;
    }
    const seconds = (performance.now() - start) / 1000;
    const steps = e.stats.steps - steps0;
    const rate = steps / seconds;
    console.log(
      `analog benchmark: ${nets.size} nets, ${e.size} unknowns, ${steps} steps in ${seconds.toFixed(2)} s = ${Math.round(rate)} steps/s ` +
        `(${((e.stats.iterations - iters0) / steps).toFixed(2)} Newton iterations per step, ${((1e6 * seconds) / steps).toFixed(1)} µs per step), ` +
        `simulated ${(e.time * 1e3).toFixed(2)} ms`,
    );
    expect(rate).toBeGreaterThanOrEqual(600);
    expect(e.stats.failures).toBe(0);
    expect(e.messages.filter((m) => m.level === 'error')).toEqual([]);
  });

  test('one frame of work is bounded: advance() stops at the work cap and says so', () => {
    const e = createAnalogEngine(mixed50());
    const before = e.stats.steps;
    e.advance(1 / 60);
    const steps = e.stats.steps - before;
    expect(e.lagging).toBe(true);
    expect(e.speed).toBeLessThan(1);
    // A 63-unknown circuit: at least the 10 steps per frame of the performance target, far below the step cap.
    expect(steps).toBeGreaterThanOrEqual(10);
    expect(steps).toBeLessThan(1000);
    expect(e.messages.some((m) => /slower than real time/.test(m.text))).toBe(true);
  });
});
