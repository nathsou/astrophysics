import type { Circuit, EngineKind } from '../sim/netlist/types';
import type { CombOptions, CombSpec, SeqSpec } from '../sim/check';

export type PartStatus = 'reference' | 'planned';

export interface PartPin {
  name: string;
  dir: 'in' | 'out';
}

/** How a part is checked. */
export type PartCheck = { kind: 'comb'; spec: CombSpec; options?: CombOptions } | { kind: 'seq'; spec: SeqSpec };

export type PartGroup = 'Transistors and gates' | 'Building blocks' | 'Arithmetic' | 'Memory and time' | 'The computer' | 'Talking to the world';

export interface PartSpec {
  /** Stable id: `part:<id>` in circuits. */
  id: string;
  name: string;
  /** The chapter that adds it to the bin. */
  chapter: number;
  group: PartGroup;
  pins: PartPin[];
  description: string;
  status: PartStatus;
  /** What the checker compares against (absent for planned parts). */
  check?: PartCheck;
  /** The reference implementation, as a subcircuit with ports (absent for planned parts). Built on first use. */
  reference?: () => Circuit;
  /**
   * The digital stand-in used when this part is placed inside another circuit, for parts whose reference
   * is transistor-level (analog or switch-level): a single behavioural gate with the same pins.
   */
  behaviour?: () => Circuit;
  /** The engine the reference runs on (default digital). */
  engine?: EngineKind;
  /** Reader-built versions of this part can stand in for the reference inside other circuits (false for transistor-level parts). */
  substitutable: boolean;
}
