/**
 * The pipelines of Appendix C as data: what each stage is, and the source file that implements it (every path is
 * checked by a test, so a diagram cannot point at a file that has moved).
 */
export type Kind = 'data' | 'stage' | 'engine';

export interface Step {
  label: string;
  note: string;
  /** Path of the implementing file (or directory), relative to the course package, e.g. `src/lib/sim/netlist/connect.ts`. */
  path?: string;
  kind: Kind;
}

export interface Lane {
  title: string;
  /** A step, or several alternatives that receive the same input (drawn as a column). */
  steps: (Step | Step[])[];
}

export interface Pipeline {
  id: 'simulator' | 'toolchain' | 'plds';
  title: string;
  caption: string;
  lanes: Lane[];
}

const data = (label: string, note: string, path?: string): Step => ({ label, note, path, kind: 'data' });
const stage = (label: string, note: string, path?: string): Step => ({ label, note, path, kind: 'stage' });
const engine = (label: string, note: string, path?: string): Step => ({ label, note, path, kind: 'engine' });

export const PIPELINES: Pipeline[] = [
  {
    id: 'simulator',
    title: 'From a drawing to a waveform',
    caption: 'What the bench does with a circuit. Dashed boxes are data, coloured boxes are code. The three engines share one interface (engine.ts), so the bench, the instruments and every live figure work with whichever one runs.',
    lanes: [
      {
        title: 'The circuit',
        steps: [
          data('Circuit', 'placed parts and wires on a grid, subcircuits and parts; the JSON of every figure', 'src/lib/sim/netlist/types.ts'),
          stage('connect', 'wires and pins to nets: T-junctions, labels, ground, rails', 'src/lib/sim/netlist/connect.ts'),
          stage('flatten', 'subcircuits inlined, ports merged, hierarchical ids', 'src/lib/sim/netlist/flatten.ts'),
          data('FlatNetlist', 'elements with pins on numbered nets', 'src/lib/sim/netlist/types.ts'),
          [
            engine('Digital engine', 'events, 0 1 X Z, delays, setup and hold', 'src/lib/sim/digital/engine.ts'),
            engine('Switch-level engine', 'transistors as switches, strengths, charge', 'src/lib/sim/switch/engine.ts'),
            engine('Analog engine', 'nodal analysis, Newton–Raphson, adaptive steps', 'src/lib/sim/analog/engine.ts'),
          ],
          stage('Engine interface', 'advance, settle, logic, voltage, current, state, setParam, watch', 'src/lib/sim/engine.ts'),
          stage('Bench and figures', 'schematic, instruments, timing diagrams, exercises', 'src/lib/bench/engines.ts'),
        ],
      },
      {
        title: 'The abstraction dial',
        steps: [
          data('Circuit of gates', 'the figure as drawn', 'src/lib/sim/netlist/types.ts'),
          stage('expand', 'each gate becomes its CMOS transistors; at analog level, with capacitances', 'src/lib/sim/expand/expand.ts'),
          data('Circuit of transistors', 'drawn inside dashed outlines where the gates were', 'src/lib/sim/expand/expand.ts'),
          stage('connect, flatten', 'as above', 'src/lib/sim/netlist/flatten.ts'),
          [engine('Switch-level engine', 'one stage per unit delay', 'src/lib/sim/switch/engine.ts'), engine('Analog engine', 'nanosecond steps', 'src/lib/sim/analog/engine.ts')],
        ],
      },
      {
        title: 'Checking a reader’s circuit',
        steps: [
          data('Reader’s circuit', 'ports named as the part’s pins', 'src/lib/partsbin/verify.ts'),
          stage('Bench harness', 'finds toggles and indicators, sets inputs, settles, reads outputs', 'src/lib/sim/check/circuit.ts'),
          [
            stage('Combinational checker', 'every input row, or corners and random rows', 'src/lib/sim/check/combinational.ts'),
            stage('Sequential checker', 'lock-step with a reference, then product-machine search', 'src/lib/sim/check/sequential.ts'),
          ],
          data('Verdict', 'pass, counterexample, gate and transistor cost', 'src/lib/sim/check/cost.ts'),
        ],
      },
    ],
  },
  {
    id: 'toolchain',
    title: 'From DCL to gates and to a chip',
    caption: 'The DCL front end and what it feeds. One word-level RTL (every cell tagged with its source span and hierarchical path) is the input of the RTL simulator, of the lowering to gates, and of the FPGA flow.',
    lanes: [
      {
        title: 'The front end',
        steps: [
          data('Source', 'text of a .dcl file, and the standard library', 'src/lib/hdl/std'),
          stage('Lexer', 'tokens, comments, where statements end', 'src/lib/hdl/lexer.ts'),
          stage('Parser', 'syntax tree, with error recovery', 'src/lib/hdl/parser.ts'),
          stage('Checker', 'names, types and widths, per module specialisation; unrolls loops, inlines functions', 'src/lib/hdl/check.ts'),
          stage('Elaboration', 'typed expressions to RTL cells', 'src/lib/hdl/elaborate.ts'),
          data('Word-level RTL', 'signals, cells and instances; plain data', 'src/lib/hdl/rtl.ts'),
        ],
      },
      {
        title: 'What consumes the RTL',
        steps: [
          data('RTL', 'the same cells for all three', 'src/lib/hdl/rtl.ts'),
          [
            stage('RTL simulator', 'JavaScript generated for the design; two-phase register update', 'src/lib/hdl/rtlsim.ts'),
            stage('Lowering to gates', 'adders, muxes, shifters, flip-flops, RAM blocks: the course’s own netlist', 'src/lib/hdl/lower/index.ts'),
            stage('FPGA front end', 'RTL to an and-inverter graph, registers and RAMs kept apart', 'src/lib/pld/fpga/fromrtl.ts'),
          ],
        ],
      },
      {
        title: 'What uses those',
        steps: [
          [
            stage('Test runner', 'test blocks on the RTL simulator, with waveforms of failures', 'src/lib/hdl/testbench.ts'),
            engine('Digital engine, bench, dial', 'the lowered netlist runs like any drawn circuit', 'src/lib/sim/digital/engine.ts'),
            stage('FPGA flow', 'map, pack, place, route, time, bitstream (next figure)', 'src/lib/pld/fpga/flow.ts'),
          ],
        ],
      },
    ],
  },
  {
    id: 'plds',
    title: 'Programming the virtual devices',
    caption: 'How a design becomes fuses, configuration bits or a bitstream, and how the configured device is simulated from those bits alone. PROM, PLA, GAL and CPLD take equations or truth tables (not DCL); the FPGA flow takes DCL or a gate netlist.',
    lanes: [
      {
        title: 'PROM, PLA and GAL22V10',
        steps: [
          data('Truth table or equations', 'with # @pragma lines in the Studio', 'src/lib/studio/source.ts'),
          stage('Parse and minimise', 'Quine–McCluskey for few variables, Espresso beyond; both output polarities', 'src/lib/pld/twolevel/minimise.ts'),
          [
            stage('PROM', 'a word per address: blow the fuses of the ones', 'src/lib/pld/devices/prom.ts'),
            stage('PLA', 'multi-output terms shared across outputs', 'src/lib/pld/devices/pla.ts'),
            stage('GAL fitter', 'pins, macrocells, product-term limits, then fuses', 'src/lib/pld/devices/gal22v10-fit.ts'),
          ],
          data('Fuse map', 'JSON for the PROM and PLA; JEDEC file for the GAL', 'src/lib/pld/devices/gal22v10-jedec.ts'),
          engine('Simulation from the fuses', 'the device model reads only the fuses', 'src/lib/pld/devices/gal22v10.ts'),
        ],
      },
      {
        title: 'vCPLD-32',
        steps: [
          data('Equations', 'names are pin levels; feedback allowed', 'src/lib/pld/cpld/fit.ts'),
          stage('Minimise', 'both polarities, and a T flip-flop form for registers', 'src/lib/pld/twolevel/minimise.ts'),
          stage('Partition', 'greedy, then Kernighan–Lin: at most 24 signals a block', 'src/lib/pld/cpld/partition.ts'),
          stage('Allocate terms', 'borrow from neighbours with least total borrowing', 'src/lib/pld/cpld/allocator.ts'),
          data('Configuration bits', '9,024 bits: interconnect, arrays, macrocells', 'src/lib/pld/devices/vcpld32-arch.ts'),
          stage('JTAG programming', 'erase, program 141 rows, verify, restart', 'src/lib/pld/cpld/jtag.ts'),
          engine('Simulation from the bits', 'instant-on, non-volatile', 'src/lib/pld/devices/vcpld32.ts'),
        ],
      },
      {
        title: 'vFPGA-S, M and L',
        steps: [
          data('RTL or gate netlist', 'from DCL, or from a bench circuit', 'src/lib/pld/fpga/frontend.ts'),
          stage('Synthesis', 'structural hashing, constant propagation, balancing of the AIG', 'src/lib/pld/fpga/synth.ts'),
          stage('Carry chains and LUT mapping', 'cut enumeration to 4-input LUTs, depth first, then area', 'src/lib/pld/fpga/map.ts'),
          stage('Packing', 'cells into tiles that share a clock, enable and reset', 'src/lib/pld/fpga/pack.ts'),
          stage('Placement', 'simulated annealing: wirelength and timing', 'src/lib/pld/fpga/place.ts'),
          stage('Routing', 'PathFinder: negotiated congestion on the routing graph', 'src/lib/pld/fpga/route.ts'),
          stage('Static timing', 'the published delay model; critical path and fmax', 'src/lib/pld/fpga/sta.ts'),
          data('Bitstream', 'frames of bits, with CRC-32s', 'src/lib/pld/fpga/bitgen.ts'),
          stage('Decode', 'bits back to a netlist of LUTs, flip-flops, carries and multiplexers', 'src/lib/pld/fpga/decode.ts'),
          engine('Fabric simulation', 'the digital engine, on the board', 'src/lib/studio/fpga/fabric-sim.ts'),
        ],
      },
    ],
  },
];

/** Every path the diagrams mention. */
export const PATHS: string[] = [...new Set(PIPELINES.flatMap((p) => p.lanes.flatMap((l) => l.steps.flat().flatMap((s) => (s.path ? [s.path] : [])))))];
