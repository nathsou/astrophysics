import { describe, expect, it } from 'vitest';
import { format } from '$lib/hdl';
import { STOPS, diagnose } from './widgets/tour';

describe('the diagnostics tour', () => {
  it('every broken program is rejected and every fixed program is accepted', () => {
    for (const s of STOPS) {
      expect(diagnose(s.broken, `${s.id}.dcl`).errors, `${s.id} broken`).toBeGreaterThan(0);
      const fixed = diagnose(s.fixed, `${s.id}.dcl`);
      expect(fixed.text, `${s.id} fixed`).toBe('');
    }
  });

  it('has unique ids and formatted code', () => {
    expect(new Set(STOPS.map((s) => s.id)).size).toBe(STOPS.length);
    for (const s of STOPS) for (const code of [s.broken, s.fixed]) expect(format(code).trim(), s.id).toBe(code.trim());
  });

  it('renders the hardware-flavoured messages the chapter quotes', () => {
    const w = diagnose(STOPS.find((s) => s.id === 'width')!.broken, 'width.dcl').text;
    expect(w).toContain('error: width mismatch');
    expect(w).toContain('bits<12>, expected bits<32>');
    expect(w).toContain('sext(imm, 32) or zext(imm, 32)');
    const l = diagnose(STOPS.find((s) => s.id === 'loop')!.broken, 'loop.dcl').text;
    expect(l).toContain('error: combinational loop');
    expect(l).toContain('q_i → q_n → q_i');
    const c = diagnose(STOPS.find((s) => s.id === 'clock')!.broken, 'clock.dcl').text;
    expect(c).toContain('clocks can only be passed through ports, so a gated clock is impossible to write');
  });
});
