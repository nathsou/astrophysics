/**
 * Octet written in DCL (`designs/octet.dcl`), and what it takes to run it: putting a program into the source,
 * and a harness that clocks the RTL simulation and reads its state back in the shape of the reference
 * interpreter's `OctetState`, so that the two can be compared instruction by instruction.
 */
import { check, createRtlSim, elaborate, type RtlDesign, type RtlSim } from '$lib/hdl';
import { OCTET_MEMORY, type OctetProgram, type OctetState } from '$lib/sim/cpu/octet';
import octetSource from '../designs/octet.dcl?raw';

export { octetSource };

/** The program is the last item of the source: everything from `const PROGRAM` on. */
const PROGRAM_AT = /^const PROGRAM:/m;

/** The 240 bytes of RAM as DCL source, sixteen to a line. */
export function programTable(image: ArrayLike<number>): string {
  const bytes = Array.from({ length: OCTET_MEMORY.ramSize }, (_, i) => (image[i] ?? 0) & 0xff);
  const rows: string[] = [];
  for (let i = 0; i < bytes.length; i += 16) rows.push('  ' + bytes.slice(i, i + 16).map((b) => '0x' + b.toString(16).padStart(2, '0')).join(', ') + ',');
  return `const PROGRAM: [bits<8>; 240] = [\n${rows.join('\n')}\n]\n`;
}

/** The design's source with a program as the initial contents of its RAM. */
export function withProgram(source: string, program: OctetProgram | ArrayLike<number>): string {
  const image = 'image' in program ? program.image : program;
  const at = source.search(PROGRAM_AT);
  if (at < 0) throw new Error('octet.dcl has no `const PROGRAM` to replace');
  return source.slice(0, at) + programTable(image);
}

let cached: RtlDesign | undefined;

/** The elaborated design with its own program (the one at the end of the file). */
export function octetDesign(): RtlDesign {
  cached ??= elaborate(check(octetSource, { file: 'octet.dcl' }).program, 'Octet');
  return cached;
}

/** Octet in DCL on the RTL simulator, with the board's inputs and a byte-for-byte view of its state. */
export class DclOctet {
  readonly sim: RtlSim;
  /** Clock edges since reset. */
  cycles = 0;
  /** Everything written to CONSOLE since reset. */
  console: number[] = [];

  constructor(design: RtlDesign = octetDesign()) {
    this.sim = createRtlSim(design);
  }

  /** Put a program in RAM and reset the CPU (the RAM keeps it, as the block RAM keeps its contents). */
  load(program: OctetProgram | ArrayLike<number>): void {
    const image = 'image' in program ? program.image : program;
    this.sim.reset();
    for (let a = 0; a < OCTET_MEMORY.ramSize; a++) this.sim.writeMem('ram', a, image[a] ?? 0);
    this.reset();
  }

  /** Press the reset button for one clock edge. */
  reset(): void {
    this.sim.set('rst', 1);
    this.sim.tick();
    this.sim.set('rst', 0);
    this.cycles = 0;
    this.console = [];
  }

  set switches(v: number) {
    this.sim.set('sw', v);
  }
  set buttons(v: number) {
    this.sim.set('btn', v);
  }

  /** One clock cycle. */
  cycle(): void {
    this.sim.tick();
    this.cycles++;
    if (this.sim.get('console_write')) this.console.push(this.sim.get('console'));
  }

  get stage(): number {
    return this.sim.get('stage');
  }

  /** The machine's state as the interpreter reports it. Devices the board lacks (matrix, PWM, DAC) are copied from `like`. */
  snapshot(steps: number, like: OctetState): OctetState {
    const g = (n: string) => this.sim.get(n);
    return {
      pc: g('pc'),
      sp: g('sp'),
      r: [0, 1, 2, 3].map((i) => g(`r[${i}]`)),
      flags: { z: !!g('z'), c: !!g('c'), n: !!g('n'), v: !!g('v') },
      halted: !!g('halted'),
      cycles: this.cycles,
      steps,
      ram: Array.from({ length: OCTET_MEMORY.ramSize }, (_, a) => Number(this.sim.readMem('ram', a))),
      lfsr: g('lfsr'),
      board: { ...like.board, leds: g('leds'), hex: g('hex'), console: [...this.console] },
    };
  }
}
