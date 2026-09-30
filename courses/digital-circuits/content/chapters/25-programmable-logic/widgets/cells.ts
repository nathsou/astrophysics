/**
 * Three ways a chip remembers its configuration, as small models with round, illustrative numbers.
 *
 *  - a **fuse**: a thin metal link (nichrome or titanium–tungsten) that a current pulse heats until it
 *    melts. One way: it can only be blown.
 *  - an **antifuse**: two conductors separated by a thin insulator that a high voltage punches through,
 *    leaving a permanent conducting filament. One way as well, and the opposite polarity: it starts open.
 *  - a **floating-gate cell** (EPROM, EEPROM, flash): a transistor whose threshold voltage is moved by
 *    charge trapped on an insulated gate. Charge is put there by a programming pulse and removed by
 *    ultraviolet light (EPROM) or by tunnelling (EEPROM and flash).
 *
 * The parameters are typical of the *order of magnitude* of real parts, not of any datasheet.
 */

// ── Fuse ──────────────────────────────────────────────────────────────────────────────────────

export interface FuseParams {
  /** Resistance of the intact link, Ω. */
  resistance: number;
  /** Thermal resistance from the link to the chip, K/W. */
  thermalResistance: number;
  /** Thermal time constant of the link, s. */
  tau: number;
  /** Ambient (chip) temperature, °C. */
  ambient: number;
  /** Temperature at which the link melts, °C (nichrome melts at about 1,400 °C). */
  melt: number;
}

export const FUSE: Readonly<FuseParams> = {
  resistance: 100,
  thermalResistance: 60000,
  tau: 2e-6,
  ambient: 25,
  melt: 1400,
};

export interface FuseSample {
  /** Time since the start of the pulse, s. */
  t: number;
  /** Link temperature, °C. */
  temperature: number;
  /** Current through the link, A (zero once it has blown). */
  current: number;
  blown: boolean;
}

/** The temperature the link would settle at with a steady current: T₀ + I²·R·Rth. */
export function steadyTemperature(current: number, p: FuseParams = FUSE): number {
  return p.ambient + current * current * p.resistance * p.thermalResistance;
}

/** The smallest steady current that eventually melts the link, A. */
export function blowingCurrent(p: FuseParams = FUSE): number {
  return Math.sqrt((p.melt - p.ambient) / (p.resistance * p.thermalResistance));
}

/** How long a steady current takes to melt the link, s, or Infinity if it never does. */
export function timeToBlow(current: number, p: FuseParams = FUSE): number {
  const rise = steadyTemperature(current, p) - p.ambient;
  const need = p.melt - p.ambient;
  if (rise <= need) return Infinity;
  return -p.tau * Math.log(1 - need / rise);
}

/**
 * A current pulse of the given height and width through an intact link, sampled every `dt`. The link
 * heats as dT/dt = (I²·R·Rth − (T − T₀)) / τ. When it reaches the melting point it opens: the current
 * drops to zero and the link cools. The run continues for `tail` seconds after the pulse.
 */
export function fusePulse(current: number, width: number, opts: { dt?: number; tail?: number; params?: FuseParams } = {}): FuseSample[] {
  const p = opts.params ?? FUSE;
  const dt = opts.dt ?? 5e-8;
  const tail = opts.tail ?? 3 * p.tau;
  const out: FuseSample[] = [];
  let T = p.ambient;
  let blown = false;
  const steps = Math.ceil((width + tail) / dt);
  for (let k = 0; k <= steps; k++) {
    const t = k * dt;
    out.push({ t, temperature: T, current: blown || t > width ? 0 : current, blown });
    const I = blown || t > width ? 0 : current;
    T += ((I * I * p.resistance * p.thermalResistance - (T - p.ambient)) / p.tau) * dt;
    if (!blown && T >= p.melt) {
      blown = true;
      T = p.melt;
    }
  }
  return out;
}

/** Does this pulse blow the link? */
export const blows = (current: number, width: number, p: FuseParams = FUSE): boolean => fusePulse(current, width, { params: p, tail: 0 }).some((s) => s.blown);

// ── Antifuse ──────────────────────────────────────────────────────────────────────────────────

export interface AntifuseParams {
  /** Breakdown voltage of the insulator, V. */
  breakdown: number;
  /** Resistance of the unprogrammed antifuse, Ω. */
  open: number;
  /** Resistance of the filament, Ω (a few hundred). */
  closed: number;
}

export const ANTIFUSE: Readonly<AntifuseParams> = { breakdown: 10, open: 1e9, closed: 300 };

export class Antifuse {
  programmed = false;
  constructor(readonly params: AntifuseParams = ANTIFUSE) {}

  /** Apply a programming voltage. Returns true if the insulator broke down (now or earlier). */
  apply(volts: number): boolean {
    if (Math.abs(volts) >= this.params.breakdown) this.programmed = true;
    return this.programmed;
  }

  get resistance(): number {
    return this.programmed ? this.params.closed : this.params.open;
  }

  /** What a sense circuit at the supply voltage sees: a conducting link is a 1 for a routing switch. */
  conducts(): boolean {
    return this.programmed;
  }
}

// ── Floating-gate cell ────────────────────────────────────────────────────────────────────────

export interface FloatingGateParams {
  /** Threshold voltage of the erased cell, V. */
  vtErased: number;
  /** Threshold shift when the floating gate is fully charged, V. */
  window: number;
  /** Gate voltage applied to read, V. */
  vRead: number;
  /** Programming: the fraction of the missing charge that one pulse adds. */
  pulseFraction: number;
  /** UV erase: time constant, minutes (about 5 min for a real part: 15–20 min leaves under 2 %). */
  uvTauMinutes: number;
  /** Tunnel erase: the fraction of charge one erase pulse removes. */
  tunnelFraction: number;
}

export const FLOATING_GATE: Readonly<FloatingGateParams> = {
  vtErased: 1,
  window: 6,
  vRead: 5,
  pulseFraction: 0.35,
  uvTauMinutes: 5,
  tunnelFraction: 0.9,
};

export class FloatingGateCell {
  /** Charge on the floating gate, 0 (erased) to 1 (full). */
  charge = 0;
  programPulses = 0;
  /** Erase-by-tunnelling operations so far (each one wears the oxide a little). */
  cycles = 0;
  constructor(readonly params: FloatingGateParams = FLOATING_GATE) {}

  /** Threshold voltage of the transistor as the control gate sees it. */
  get vt(): number {
    return this.params.vtErased + this.params.window * this.charge;
  }

  /** One programming pulse: hot electrons (EPROM) or tunnelling (EEPROM) add charge, with diminishing returns as the gate charges. */
  program(pulses = 1): void {
    for (let i = 0; i < pulses; i++) {
      this.charge += (1 - this.charge) * this.params.pulseFraction;
      this.programPulses++;
    }
  }

  /** Ultraviolet light gives the trapped electrons enough energy to leave: the charge decays exponentially. */
  uvErase(minutes: number): void {
    this.charge *= Math.exp(-minutes / this.params.uvTauMinutes);
  }

  /** One erase pulse of a flash or EEPROM cell: Fowler–Nordheim tunnelling pulls the electrons back out. */
  tunnelErase(pulses = 1): void {
    for (let i = 0; i < pulses; i++) this.charge *= 1 - this.params.tunnelFraction;
    this.cycles++;
  }

  /** Does the transistor conduct with the read voltage on its gate? Conducting reads as 1 (erased). */
  read(): 0 | 1 {
    return this.vt < this.params.vRead ? 1 : 0;
  }

  /** Read current in relative units (0 to 1): the transistor's on-current falls with the overdrive. */
  readCurrent(): number {
    const over = this.params.vRead - this.vt;
    return over <= 0 ? 0 : Math.min(1, over / (this.params.vRead - this.params.vtErased));
  }

  /** How many volts the read voltage is away from flipping the answer (positive when erased, negative when programmed). */
  get margin(): number {
    return this.params.vRead - this.vt;
  }
}
