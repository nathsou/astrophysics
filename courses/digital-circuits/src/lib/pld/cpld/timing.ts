/**
 * vCPLD-32 timing. A CPLD's delays do not depend on where the fitter put the logic: every signal
 * passes through the same global interconnect matrix, AND array and macrocell, so the delay of a
 * path depends only on its type. This is the property that made CPLDs the parts of choice for
 * glue logic and state machines with tight, guaranteed timing, and the opposite of an FPGA, where
 * routing delay varies from net to net and timing can be known only after place and route.
 *
 * The constants are those of a "-7" part in the XC9500 / MAX 7000 class, rounded. Times in
 * nanoseconds.
 */

/** Pin to pin through combinational logic: input buffer, matrix, AND array, OR, XOR, output buffer. */
export const T_PD = 7.5;
/** Input pin setup before the global clock edge, for a registered output. */
export const T_SU = 4.5;
/** Hold time of an input pin after the clock edge. */
export const T_H = 0;
/** Global clock edge to output pin. */
export const T_CO = 4.5;
/** Extra delay when the macrocell's OR gate collects terms borrowed through the allocator. */
export const T_PTA = 1.0;
/** Re-entry through the matrix from a combinational macrocell to another one (buried path): the pin buffers are not on this path. */
export const T_FB = 5.0;
/** Register to register inside the device: clock to Q, matrix, AND, OR, setup. */
export const T_REG2REG = 8.0;

export type PathKind =
  | 'pin-to-pin' // input pin → combinational output pin
  | 'setup' // input pin → register (setup to clock)
  | 'clock-to-out'; // clock → registered output pin

export interface TimingConstants {
  tPD: number;
  tSU: number;
  tH: number;
  tCO: number;
  tPTA: number;
  tFB: number;
  tReg2Reg: number;
}

export const TIMING: TimingConstants = { tPD: T_PD, tSU: T_SU, tH: T_H, tCO: T_CO, tPTA: T_PTA, tFB: T_FB, tReg2Reg: T_REG2REG };

export interface OutputTiming {
  /** 'comb' or 'reg' macrocell. */
  kind: 'comb' | 'reg';
  /** Combinational outputs: worst input pin to output pin delay, including any comb-macrocell feedback chain. */
  tpd?: number;
  /** Registered outputs: worst input pin setup time before the clock. */
  tsu?: number;
  /** Registered outputs: clock to pin. */
  tco?: number;
  /** Register-to-register period through this register's input logic. */
  tReg2Reg?: number;
  /** Levels of combinational macrocells in series ahead of this one (0 = fed by pins and registers only). */
  combDepth: number;
  /** True if the output is part of a combinational feedback loop (no meaningful delay). */
  loop: boolean;
  /** True if the delays include the borrowed-terms penalty. */
  borrowPenalty: boolean;
}

export interface TimingSummary {
  constants: TimingConstants;
  /** Worst pin-to-pin delay over all combinational outputs (0 if there are none). */
  worstTpd: number;
  /** Worst setup time over all registered outputs. */
  worstTsu: number;
  /** Clock to output (all registered outputs; the same unless a borrow penalty applies). */
  worstTco: number;
  /** Maximum clock frequency for register-to-register paths, in MHz (Infinity if no registers). */
  fmaxMHz: number;
  /** One sentence describing why timing does not depend on placement. */
  statement: string;
}

export const TIMING_STATEMENT =
  `Timing is independent of placement: every path crosses the interconnect matrix, one AND array and one macrocell, ` +
  `so pin-to-pin delay is tPD = ${T_PD} ns, setup tSU = ${T_SU} ns, clock-to-output tCO = ${T_CO} ns, whatever the fitter chose. ` +
  `The only variations are +${T_PTA} ns where a macrocell collects borrowed product terms, and +${T_FB} ns for each combinational macrocell a signal passes through on the way.`;
