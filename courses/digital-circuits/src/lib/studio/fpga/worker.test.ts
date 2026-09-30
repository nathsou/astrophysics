import { describe, expect, it } from 'vitest';
import { check, elaborate } from '../../hdl';
import { FLOW_STAGES, flowProgress, type FlowMessage } from './types';
import { handle } from './worker';
import { designSource } from './fixture.test-util';

const designOf = (name: string, top: string) => elaborate(check(designSource(name), { file: `${name}.dcl` }).program, top);

describe('flow worker protocol', () => {
  it('answers a request with progress messages in stage order and then the result', () => {
    const msgs: FlowMessage[] = [];
    handle({ id: 7, design: designOf('counter', 'Counter'), device: 'S' }, (m) => msgs.push(m));
    expect(msgs.every((m) => m.id === 7)).toBe(true);
    expect(msgs.at(-1)!.type).toBe('result');
    const progress = msgs.filter((m): m is Extract<FlowMessage, { type: 'progress' }> => m.type === 'progress');
    const started = progress.filter((p) => p.phase === 'start').map((p) => p.stage);
    const ended = progress.filter((p) => p.phase === 'end').map((p) => p.stage);
    expect(ended).toEqual(started);
    const order = FLOW_STAGES.map((s) => s.name);
    let last = -1;
    for (const s of started) {
      const i = order.indexOf(s);
      expect(i, s).toBeGreaterThanOrEqual(0);
      expect(i).toBeGreaterThanOrEqual(last);
      last = i;
    }
    expect(started).toContain('placement');
    expect(started).toContain('routing');
    for (const p of progress.filter((x) => x.phase === 'end')) expect(p.ms).toBeGreaterThanOrEqual(0);
  });

  it('sends a result that structured-clones (plain data only)', () => {
    const msgs: FlowMessage[] = [];
    handle({ id: 1, design: designOf('traffic-light', 'TrafficLight'), device: 'S' }, (m) => msgs.push(m));
    const r = msgs.find((m) => m.type === 'result');
    expect(r).toBeDefined();
    const copy = structuredClone(r);
    expect((copy as { result: { size: string } }).result.size).toBe('S');
  });

  it('reports a design that does not fit as an error message with its stage, not a throw', () => {
    const msgs: FlowMessage[] = [];
    handle({ id: 3, design: designOf('alu', 'Alu'), device: 'S' }, (m) => msgs.push(m));
    const e = msgs.at(-1)!;
    expect(e.type).toBe('error');
    if (e.type === 'error') {
      expect(e.message).toMatch(/vFPGA-S/);
      expect(e.stage).toBe('packing');
    }
  });

  it('computes the progress bar from finished stages', () => {
    expect(flowProgress(new Set())).toBe(0);
    expect(flowProgress(new Set(FLOW_STAGES.map((s) => s.name)))).toBe(1);
    const half = flowProgress(new Set(['check', 'elaborate', 'front end', 'synthesis']), 'carry chains');
    expect(half).toBeGreaterThan(0.1);
    expect(half).toBeLessThan(0.5);
    expect(flowProgress(new Set(['check']), 'elaborate')).toBeGreaterThan(flowProgress(new Set(['check'])));
  });
});
