/**
 * Signal colouring rules for wires and pins. Colours come from CSS custom properties (the design
 * tokens --sig-*, --volt-*), so the same rules work in both themes; this module only decides which
 * token, and how much of it.
 */
import type { Circuit, Logic } from '../sim/netlist/types';

/** Attribute value for a logic level: CSS selects the colour and dash pattern from it. */
export function logicAttr(l: Logic | number): '0' | '1' | 'x' | 'z' {
  return l === 0 ? '0' : l === 1 ? '1' : l === 3 ? 'z' : 'x';
}

/** Largest source voltage in a circuit (for the voltage colour scale); 5 V if none is found. */
export function voltageRange(circuit: Circuit): number {
  const m = maxSource(circuit);
  return m > 0 ? m : 5;
}

function maxSource(circuit: Circuit): number {
  let m = 0;
  for (const c of circuit.components) {
    const p = c.params ?? {};
    const num = (k: string, d: number) => Math.abs(Number(p[k] ?? d));
    switch (c.type) {
      case 'battery':
        m = Math.max(m, num('voltage', 9));
        break;
      case 'supply':
      case 'rail':
        m = Math.max(m, num('voltage', 5));
        break;
      case 'siggen':
        m = Math.max(m, num('offset', 2.5) + num('amplitude', 2.5));
        break;
      case 'comparator':
        m = Math.max(m, num('high', 5));
        break;
      case 'relay':
        m = Math.max(m, num('coilVoltage', 5));
        break;
    }
  }
  for (const sub of Object.values(circuit.subcircuits ?? {})) m = Math.max(m, maxSource(sub));
  return m;
}

/**
 * CSS colour for a voltage on a diverging scale: --volt-neg at −range, --volt-zero at 0 V,
 * --volt-pos at +range. Quantised to 5 % steps so the DOM is only touched when the colour changes
 * visibly. NaN (unknown) gives the Z colour.
 */
export function voltageColour(v: number, range: number): string {
  if (!Number.isFinite(v)) return 'var(--_z)';
  const t = Math.max(-1, Math.min(1, v / (range || 1)));
  const pct = Math.round(Math.abs(t) * 20) * 5;
  if (pct === 0) return 'var(--_v0)';
  if (pct === 100) return t > 0 ? 'var(--_vp)' : 'var(--_vn)';
  return `color-mix(in oklab, ${t > 0 ? 'var(--_vp)' : 'var(--_vn)'} ${pct}%, var(--_v0))`;
}
