/**
 * Power of CMOS logic. Everything here is closed-form: dynamic power P = α·C·V²·f (each 0→1 transition
 * takes ½·C·V² from the supply; the other half is heat in the pull-up, and the 1→0 transition dumps the
 * charge to ground), plus leakage. Pure logic for the PowerCalculator and Dennard widgets.
 */

export interface Chip {
  /** Number of switching nodes (gates or transistors, whichever the capacitance below is per). */
  nodes: number;
  /** Capacitance of one node, farads (gate, junctions and its share of the wire). */
  cNode: number;
  /** Supply voltage, volts. */
  vdd: number;
  /** Clock frequency, hertz. */
  f: number;
  /** Activity factor α: the fraction of nodes that make a full 0→1→0 cycle per clock cycle. */
  alpha: number;
  /** Leakage current of one node's transistors when off, amperes. */
  leak: number;
}

/** Energy drawn from the supply to charge C to V and discharge it again: C·V² (half is dissipated at each edge). */
export const energyPerCycle = (c: number, vdd: number) => c * vdd * vdd;

export const dynamicPower = (p: Chip) => p.alpha * p.nodes * p.cNode * p.vdd * p.vdd * p.f;
export const staticPower = (p: Chip) => p.nodes * p.leak * p.vdd;
export const totalPower = (p: Chip) => dynamicPower(p) + staticPower(p);
/** Power at another frequency, other things equal. */
export const powerAt = (p: Chip, f: number, vdd = p.vdd) => totalPower({ ...p, f, vdd });

export const PRESETS: Record<'gate' | 'chip', { label: string; chip: Chip; note: string }> = {
  gate: {
    label: 'One HC gate and its wire',
    chip: { nodes: 1, cNode: 15e-12, vdd: 5, f: 1e6, alpha: 1, leak: 1e-9 },
    note: '15 pF is a gate output, a few centimetres of track and a few inputs. At 1 MHz it burns a third of a milliwatt.',
  },
  chip: {
    label: 'A billion-transistor chip',
    chip: { nodes: 1e9, cNode: 0.5e-15, vdd: 0.8, f: 3e9, alpha: 0.1, leak: 10e-9 },
    note: 'Half a femtofarad per transistor, one in ten switching per cycle, 0.8 V, 3 GHz.',
  },
};

/** Heat flux over a die of the given area (cm²), W/cm². */
export const heatFlux = (watts: number, areaCm2: number) => watts / areaCm2;

// ------------------------------------------------------------------------------------------------
// Dennard scaling.

export type Regime = 'dennard' | 'voltage-stuck' | 'clock-frozen';

/** One generation shrinks every linear dimension by 1/√2, so the area of a transistor halves (Moore's law). */
export const KAPPA = Math.SQRT2;

export interface Scaled {
  /** Everything relative to generation 0. */
  length: number;
  voltage: number;
  capacitance: number;
  frequency: number;
  /** Transistors per unit area. */
  density: number;
  /** Power of one transistor: C·V²·f. */
  perTransistor: number;
  /** Power per unit area: density × perTransistor. */
  powerDensity: number;
}

/**
 * The state after `gen` generations of scaling by κ = √2 under each regime:
 *  - dennard: dimensions, voltage and capacitance ÷ κ, clock × κ. Power per unit area stays put.
 *  - voltage-stuck: the same, but the voltage cannot fall (leakage), and the clock still rises.
 *  - clock-frozen: voltage stuck, clock held: the designers' choice since 2005.
 */
export function scale(gen: number, regime: Regime): Scaled {
  const k = KAPPA ** gen;
  const length = 1 / k;
  const capacitance = 1 / k; // C = εA/t: area falls as 1/κ², thickness as 1/κ
  const voltage = regime === 'dennard' ? 1 / k : 1;
  const frequency = regime === 'clock-frozen' ? 1 : k;
  const density = k * k;
  const perTransistor = capacitance * voltage * voltage * frequency;
  return { length, voltage, capacitance, frequency, density, perTransistor, powerDensity: density * perTransistor };
}

/** The 1974 starting point used to label the slider: 5 µm devices at 5 V and about 2 MHz. */
export const BASE = { length: 5e-6, voltage: 5, frequency: 2e6 };
