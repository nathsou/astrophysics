/**
 * `if` chain against `match`: the same choice among N inputs written both ways, compiled by the real DCL
 * compiler and lowered to gates, so the figure counts what the compiler builds rather than what a formula
 * predicts (widgets/IfVsMatch.svelte).
 */
import { check, elaborate, format } from '$lib/hdl';
import { lowerToNetlist, type LoweredStats } from '$lib/hdl/lower';

export type Style = 'if' | 'match';

export const WIDTH = 8;
/** The sizes offered: a selector of 1 to 4 bits chooses among 2, 4, 8 or 16 inputs. */
export const SELECTOR_BITS = [1, 2, 3, 4] as const;

/** DCL for "pick one of 2^k inputs by a k-bit `sel`", every value of `sel` written out. */
export function pickSource(style: Style, k: number, width = WIDTH): string {
  const arms = 2 ** k;
  const head = `module Pick(sel: bits<${k}>, x: [bits<${width}>; ${arms}]) -> (y: bits<${width}>) {\n`;
  if (style === 'if') {
    const chain = Array.from({ length: arms - 1 }, (_, i) => `if sel == ${i} { x[${i}] }`).join(' else ');
    return format(`${head}  y = ${chain} else { x[${arms - 1}] }\n}\n`);
  }
  const cases = Array.from({ length: arms }, (_, i) => `    ${i} => x[${i}],\n`).join('');
  return format(`${head}  y = match sel {\n${cases}  }\n}\n`);
}

export interface Measure {
  style: Style;
  arms: number;
  /** Multiplexer blocks and gates the compiler built. */
  muxes: number;
  gates: number;
  /** Two-input gate equivalents (a multiplexer counts 3). */
  gateEquivalents: number;
  /** Longest path in gates. */
  depth: number;
}

export function measure(style: Style, k: number): Measure {
  const arms = 2 ** k;
  const source = pickSource(style, k);
  const { program, diagnostics } = check(source, { file: `pick-${style}.dcl` });
  const errors = diagnostics.filter((d) => d.severity === 'error');
  if (errors.length) throw new Error(`pick-${style}: ${errors[0]!.message}`);
  const stats: LoweredStats = lowerToNetlist(elaborate(program, 'Pick'), 'Pick').stats;
  return {
    style,
    arms,
    muxes: stats.byType.mux ?? 0,
    gates: stats.gates - (stats.byType.mux ?? 0),
    gateEquivalents: stats.gateEquivalents,
    depth: stats.depth,
  };
}
