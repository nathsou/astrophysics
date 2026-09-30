/**
 * The whole stack (Figure 32.6): every layer of the course, from a battery to a chip, with the chapters that built it
 * and the number of transistors in one typical instance, counted with the course's own cost model
 * (`transistorsOf` in `src/lib/sim/check/cost.ts`, the numbers of gate golf).
 */
import { transistorsOf } from '$lib/sim/check/cost';
import { OCTET_LOGIC_TRANSISTORS, OCTET_TRANSISTORS } from './scaling';

export interface Layer {
  id: string;
  name: string;
  /** What the reader made at this level. */
  made: string;
  /** What the layer rests on and offers the next one, in one sentence. */
  idea: string;
  /** Slugs of the chapters (in `content/outline.ts`) that built it. */
  chapters: string[];
  /** Transistors in the example, if it has a count. */
  transistors?: number;
  /** What the example is. */
  example?: string;
}

const T = (type: string, params: Record<string, unknown> = {}) => transistorsOf(type, params);

export const LAYERS: Layer[] = [
  {
    id: 'battery',
    name: 'Battery',
    made: 'A lit lamp, a divider, an RC circuit',
    idea: 'A voltage pushes a current through a resistance; capacitors make everything take time.',
    chapters: ['charge-voltage-current', 'ohms-law', 'capacitors-and-time'],
  },
  {
    id: 'switch',
    name: 'Switch',
    made: 'A relay adder',
    idea: 'A switch that another circuit controls turns wiring into logic, and gain restores a fading signal.',
    chapters: ['relays', 'shannons-switches'],
    transistors: 1,
    example: 'a transistor used as a switch',
  },
  {
    id: 'transistor',
    name: 'Transistor',
    made: 'An inverter from an nMOS and a pMOS',
    idea: 'Two complementary switches make a gate that draws power only when it changes.',
    chapters: ['diodes-and-leds', 'the-transistor', 'cmos'],
    transistors: 2,
    example: 'a CMOS inverter',
  },
  {
    id: 'gate',
    name: 'Gate',
    made: 'A NAND, and every function from NANDs',
    idea: 'Boolean algebra says which gates make any function, and Karnaugh maps how few.',
    chapters: ['real-gates', 'boolean-algebra', 'simplifying-logic'],
    transistors: T('nand'),
    example: 'a NAND gate',
  },
  {
    id: 'adder',
    name: 'Adder',
    made: 'A carry-lookahead adder',
    idea: 'Multiplexers, decoders and adders: blocks that compute, and delays that limit how fast.',
    chapters: ['building-blocks', 'arithmetic', 'timing'],
    transistors: T('adder', { bits: 1 }),
    example: 'one bit of an adder (a full adder)',
  },
  {
    id: 'register',
    name: 'Register',
    made: 'Latches, flip-flops, counters, a traffic-light FSM',
    idea: 'Feedback remembers; a clock makes a whole circuit change together.',
    chapters: ['feedback', 'the-clock', 'registers-and-counters', 'state-machines'],
    transistors: T('register', { bits: 8 }),
    example: 'an 8-bit register',
  },
  {
    id: 'datapath',
    name: 'Datapath',
    made: 'An ALU, a register file and a bus you drove by hand',
    idea: 'Registers, an adder and a shared bus, with control lines that say what moves each cycle.',
    chapters: ['memory', 'datapath'],
    transistors: OCTET_LOGIC_TRANSISTORS,
    example: 'Octet’s datapath and control, without its RAM',
  },
  {
    id: 'cpu',
    name: 'CPU',
    made: 'Octet, running programs and talking to the world',
    idea: 'A state machine that fetches, decodes and executes bytes: hardware that runs software.',
    chapters: ['control', 'running-programs', 'talking-to-the-world'],
    transistors: OCTET_TRANSISTORS,
    example: 'Octet with its 256 bytes of RAM',
  },
  {
    id: 'hdl',
    name: 'Hardware language',
    made: 'The same circuits as text, in DCL',
    idea: 'Code that describes a circuit instead of steps, which a tool can check, simulate and synthesise.',
    chapters: ['describing-hardware'],
  },
  {
    id: 'fpga',
    name: 'FPGA',
    made: 'Octet and an RV32I core, placed, routed and running',
    idea: 'A chip made once and rewired by memory bits; the toolchain turns a netlist into a bitstream.',
    chapters: ['programmable-logic', 'pals-and-gals', 'cplds', 'inside-an-fpga', 'netlist-to-bitstream', 'cpus-on-a-chip'],
  },
  {
    id: 'chip',
    name: 'Chip',
    made: 'A design on its way to silicon',
    idea: 'Light, masks and a few hundred process steps copy a design onto a wafer, billions of transistors at a time.',
    chapters: ['breadboard-to-billions'],
    transistors: 134_000_000_000,
    example: 'the Apple M2 Ultra',
  },
];

/** log10 of a transistor count, or undefined. */
export const magnitude = (l: Layer) => (l.transistors === undefined ? undefined : Math.log10(l.transistors));
