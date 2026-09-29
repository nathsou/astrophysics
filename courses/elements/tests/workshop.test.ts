import { describe, expect, it } from 'vitest';
import { check, run, TOOLS } from '../src/workshop/engine';
import { LEVELS, toolsBefore } from '../src/workshop/levels';

describe('workshop levels', () => {
  for (const level of LEVELS) {
    it(`${level.id}: Euclid's solution passes on random configurations`, () => {
      run(level.givens, level.reference);
      const r = check(level, level.reference);
      expect(r.trials).toBeGreaterThan(15);
      expect(r.met.map((m, i) => (m < 0 ? level.requirements[i].text : null)).filter(Boolean)).toEqual([]);
    });
    it(`${level.id}: the solution only uses tools unlocked earlier`, () => {
      const allowed = toolsBefore(level.id);
      for (const s of level.reference) if (s.op === 'tool') expect(allowed.has(s.tool), `${s.tool} in ${level.id}`).toBe(true);
    });
  }
  it('a tool unlocked by a level is a real tool', () => {
    for (const l of LEVELS) if (l.unlocks) expect(TOOLS[l.unlocks]).toBeTruthy();
  });
  it('an eyeballed point fails the check', () => {
    const level = LEVELS[0];
    // a point placed "on" the first circle where C happens to be now: right here, wrong elsewhere
    const steps = [{ op: 'circle' as const, c: 0, p: 1 }, { op: 'on' as const, o: 2, t: Math.PI / 3 }];
    const r = check(level, steps);
    expect(r.met[0]).toBe(-1);
    expect(r.coincidental).toEqual([0]);
  });
});
