/** Run a fitted 8-bit adder on the simulated device: the sum read back from S0–S7 and COUT. */
import type { CpldFit } from '$lib/pld/cpld';

export function simulateAdder(fit: CpldFit, a: number, b: number, cin: number): number {
  const inputs: Record<string, number> = { CIN: cin };
  for (let i = 0; i < 8; i++) {
    inputs[`A${i}`] = (a >> i) & 1;
    inputs[`B${i}`] = (b >> i) & 1;
  }
  const [r] = fit.simulate([{ inputs, clock: false }]);
  let sum = 0;
  for (let i = 0; i < 8; i++) sum |= r!.values[`S${i}`]! << i;
  return sum + (r!.values['COUT']! << 8);
}
