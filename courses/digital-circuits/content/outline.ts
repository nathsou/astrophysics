/**
 * The course outline: single source of truth for navigation. A chapter becomes readable when a
 * matching `chapters/<nn>-<slug>/index.md` exists; until then it is listed as planned.
 */

export interface OutlineEntry {
  slug: string;
  number: string;
  title: string;
  summary: string;
  /** The flagship interactive, shown on the home page. */
  flagship?: string;
  /** Year of the chapter's key historical moment, for the home page's timeline. */
  year?: number;
  /** What happened that year. */
  event?: string;
  milestone: string;
}

export interface OutlinePart {
  id: string;
  title: string;
  blurb: string;
  chapters: OutlineEntry[];
}

export const COURSE_TITLE = 'Digital Circuits';
export const COURSE_SUBTITLE = 'From a battery and a switch to a CPU on a chip';

export const PARTS: OutlinePart[] = [
  {
    id: '0',
    title: 'Prologue',
    blurb: 'The layers between a keypress and the silicon, and how to use this course.',
    chapters: [
      { slug: 'press-a-key', number: '0', title: 'What happens when you press a key?', summary: 'A zoom from the keyboard to the silicon lattice, the digital abstraction, and a map of the course.', flagship: 'Keyboard-to-atoms zoom', milestone: 'M1' },
    ],
  },
  {
    id: 'I',
    title: 'Electricity, just enough',
    blurb: 'Charge, voltage and current; resistors, capacitors and relays — only as much physics as digital circuits need.',
    chapters: [
      { slug: 'charge-voltage-current', number: '1', title: 'Charge, voltage and current', summary: 'What flows in a wire, how fast, and where the water analogy breaks.', flagship: 'Electrons in a wire', year: 1800, event: 'Volta’s pile', milestone: 'M1' },
      { slug: 'ohms-law', number: '2', title: 'Resistance and Ohm’s law', summary: 'Ohm’s and Kirchhoff’s laws, dividers, power and ratings — and the magic smoke.', flagship: 'Voltage landscape', year: 1827, event: 'Ohm’s law', milestone: 'M1' },
      { slug: 'the-bench', number: '3', title: 'Interlude: the bench', summary: 'Multimeter, bench supply, oscilloscope, function generator and logic probe: the instruments of the rest of the course.', flagship: 'Bench tour', year: 1897, event: 'Braun’s cathode-ray tube', milestone: 'M1' },
      { slug: 'capacitors-and-time', number: '4', title: 'Capacitors and time', summary: 'RC charging, time constants, and why every wire makes logic slow.', flagship: 'RC lab', year: 1745, event: 'The Leyden jar', milestone: 'M1' },
      { slug: 'relays', number: '5', title: 'Electromagnets and relays', summary: 'Current makes magnetism, magnetism moves a switch, and a relay restores a fading telegraph signal.', flagship: 'Telegraph repeater', year: 1844, event: 'Morse’s telegraph', milestone: 'M1' },
    ],
  },
  {
    id: 'II',
    title: 'Switches that compute',
    blurb: 'From relays to transistors: switches that control other switches, and why gain makes digital possible.',
    chapters: [
      { slug: 'shannons-switches', number: '6', title: 'Shannon’s switches', summary: 'Series is AND, parallel is OR, the staircase light is XOR — and a relay adder.', flagship: 'Stibitz’s Model K', year: 1937, event: 'Shannon’s thesis', milestone: 'M0' },
      { slug: 'diodes-and-leds', number: '7', title: 'Semiconductors, diodes and LEDs', summary: 'Doping, the pn junction, LEDs and their colours, and why diode logic fades.', flagship: 'pn junction', year: 1940, event: 'Ohl’s pn junction', milestone: 'M2' },
      { slug: 'the-transistor', number: '8', title: 'The transistor', summary: 'BJTs and MOSFETs as switches and amplifiers; gain restores signals, which is why digital works.', flagship: 'Noise gauntlet', year: 1947, event: 'The point-contact transistor', milestone: 'M2' },
      { slug: 'cmos', number: '9', title: 'CMOS', summary: 'nMOS and pMOS, complementary gates, and a compiler from Boolean expressions to transistors.', flagship: 'Gate compiler', year: 1963, event: 'Wanlass’s CMOS', milestone: 'M2' },
      { slug: 'real-gates', number: '10', title: 'Real gates are analog', summary: 'Noise margins, fan-out, delay, power, open drain, tri-state and bus contention.', flagship: 'Transfer curve', year: 1974, event: 'Dennard scaling', milestone: 'M2' },
    ],
  },
  {
    id: 'III',
    title: 'Logic',
    blurb: 'Boolean algebra, simplification, the standard building blocks, arithmetic and timing.',
    chapters: [
      { slug: 'boolean-algebra', number: '11', title: 'Boolean algebra', summary: 'Laws, De Morgan, canonical forms and universal gates, from truth table to circuit.', flagship: 'Bubble pushing', year: 1854, event: 'Boole’s Laws of Thought', milestone: 'M3' },
      { slug: 'simplifying-logic', number: '12', title: 'Simplifying logic', summary: 'Karnaugh maps, don’t-cares, Quine–McCluskey and gate golf.', flagship: 'K-map playground', year: 1953, event: 'Karnaugh maps', milestone: 'M3' },
      { slug: 'building-blocks', number: '13', title: 'Building blocks', summary: 'Multiplexers, decoders, encoders, comparators and the 7-segment decoder; a mux is a lookup table.', flagship: '7-segment decoder', year: 1955, event: 'Nixie tubes', milestone: 'M3' },
      { slug: 'arithmetic', number: '14', title: 'Numbers and arithmetic', summary: 'Binary, two’s complement, adders from ripple carry to lookahead, and shifters.', flagship: 'Carry race', year: 1703, event: 'Leibniz’s binary arithmetic', milestone: 'M3' },
      { slug: 'timing', number: '15', title: 'Timing', summary: 'Propagation delay, critical paths, hazards and glitches.', flagship: 'Glitch hunt', milestone: 'M3' },
    ],
  },
  {
    id: 'IV',
    title: 'Memory and time',
    blurb: 'Feedback, latches, flip-flops and clocks; counters, state machines and memories.',
    chapters: [
      { slug: 'feedback', number: '16', title: 'Feedback', summary: 'Rings that oscillate, loops that remember, the SR latch and metastability.', flagship: 'Double well', year: 1918, event: 'The Eccles–Jordan flip-flop', milestone: 'M4' },
      { slug: 'the-clock', number: '17', title: 'The clock', summary: 'Latches and flip-flops, setup and hold, synchronous design and the 555.', flagship: 'Break the clock', year: 1971, event: 'The 555 timer', milestone: 'M4' },
      { slug: 'registers-and-counters', number: '18', title: 'Registers and counters', summary: 'Registers, counters that divide frequency, shift registers and LFSRs.', flagship: 'Hear the octaves', year: 1932, event: 'The scale-of-two counter', milestone: 'M4' },
      { slug: 'state-machines', number: '19', title: 'State machines', summary: 'Moore and Mealy machines, state encoding, and synthesis from a drawn diagram.', flagship: 'FSM designer', year: 1955, event: 'Mealy machines', milestone: 'M4' },
      { slug: 'memory', number: '20', title: 'Memory', summary: 'Register files, SRAM, DRAM and refresh, ROM, flash and core rope.', flagship: 'Leaking DRAM', year: 1966, event: 'Dennard’s DRAM cell', milestone: 'M4' },
    ],
  },
  {
    id: 'V',
    title: 'Build a computer',
    blurb: 'A datapath, a control unit and an instruction set, assembled from your own parts, then connected to the world.',
    chapters: [
      { slug: 'datapath', number: '21', title: 'The datapath', summary: 'The ALU, the register file and the bus: you are the control unit.', flagship: 'Be the control unit', year: 1945, event: 'Von Neumann’s First Draft', milestone: 'M5' },
      { slug: 'control', number: '22', title: 'Control', summary: 'Fetch, decode, execute; hardwired and microcoded control.', flagship: 'Microcode editor', year: 1951, event: 'Wilkes’s microprogramming', milestone: 'M5' },
      { slug: 'running-programs', number: '23', title: 'Running programs', summary: 'The Octet ISA, an assembler, and programs you watch run wire by wire.', flagship: 'Octet', year: 1971, event: 'The Intel 4004', milestone: 'M5' },
      { slug: 'talking-to-the-world', number: '24', title: 'Talking to the world', summary: 'Memory-mapped I/O, PWM, DACs and ADCs, and serial protocols.', flagship: 'SAR ADC', year: 1937, event: 'Pulse-code modulation', milestone: 'M5' },
    ],
  },
  {
    id: 'VI',
    title: 'Programmable logic',
    blurb: 'Chips you can rewire: PROMs, PALs, CPLDs and FPGAs, a hardware language, and the toolchain that maps a CPU onto a chip.',
    chapters: [
      { slug: 'programmable-logic', number: '25', title: 'Logic you can program', summary: 'ROMs as truth tables, PLAs, and the technologies that program a chip: fuses, antifuses, EPROM, flash and SRAM.', flagship: 'Blow a fuse', year: 1956, event: 'Chow’s PROM', milestone: 'M6' },
      { slug: 'pals-and-gals', number: '26', title: 'PALs and GALs', summary: 'Programmable AND, fixed OR, macrocells, fitting, and JEDEC files for a real GAL22V10.', flagship: 'GAL22V10', year: 1978, event: 'The PAL', milestone: 'M6' },
      { slug: 'cplds', number: '27', title: 'CPLDs', summary: 'Function blocks, interconnect matrices, product-term allocation, and JTAG.', flagship: 'vCPLD-32', year: 1984, event: 'Altera’s EP300', milestone: 'M6' },
      { slug: 'inside-an-fpga', number: '28', title: 'Inside an FPGA', summary: 'LUTs, logic cells, routing, configuration memory and hard blocks — configured by hand.', flagship: 'Configure by hand', year: 1985, event: 'The Xilinx XC2064', milestone: 'M7' },
      { slug: 'describing-hardware', number: '29', title: 'Describing hardware', summary: 'DCL, the course’s hardware language: types, registers, instances, state machines and tests.', flagship: 'Inference viewer', year: 1984, event: 'Verilog', milestone: 'M6' },
      { slug: 'netlist-to-bitstream', number: '30', title: 'From netlist to bitstream', summary: 'Synthesis, LUT mapping, placement, routing, timing and the bitstream, stage by stage.', flagship: 'Toolchain replay', year: 1983, event: 'Simulated annealing', milestone: 'M7' },
      { slug: 'cpus-on-a-chip', number: '31', title: 'CPUs on a chip', summary: 'Octet and an RV32I core, placed, routed and running on a virtual FPGA — and a real one.', flagship: 'Device Studio', year: 2015, event: 'Project IceStorm', milestone: 'M7' },
    ],
  },
  {
    id: 'E',
    title: 'Epilogue',
    blurb: 'From one breadboard to billions of transistors.',
    chapters: [
      { slug: 'breadboard-to-billions', number: '32', title: 'From breadboard to billions', summary: 'Integrated circuits, photolithography, Moore’s law, ASICs and what to build next.', flagship: 'Moore’s law', year: 1965, event: 'Moore’s law', milestone: 'M8' },
    ],
  },
];

export const APPENDICES: OutlineEntry[] = [
  { slug: 'reference', number: 'A', title: 'Reference', summary: 'Schematic symbols, units and prefixes, the resistor colour code, number systems.', milestone: 'M1' },
  { slug: 'maths', number: 'B', title: 'Maths toolbox', summary: 'Exponentials, the RC equation, and systems of linear equations.', milestone: 'M1' },
  { slug: 'simulator', number: 'C', title: 'The simulator and toolchain', summary: 'What the engines model, and what they do not.', milestone: 'M8' },
  { slug: 'build-it-for-real', number: 'D', title: 'Build it for real', summary: 'Kit list, safety, breadboard basics and each chapter’s lab.', milestone: 'M8' },
  { slug: 'octet', number: 'E', title: 'Octet reference card', summary: 'ISA, encoding and memory map of the course CPU.', milestone: 'M5' },
  { slug: 'dcl', number: 'F', title: 'DCL reference', summary: 'Syntax, types, built-ins and standard library of the course’s hardware language.', milestone: 'M7' },
  { slug: 'datasheets', number: 'G', title: 'Virtual device datasheets', summary: 'vPROM, vPLA, GAL22V10, vCPLD-32, vFPGA and the virtual board.', milestone: 'M7' },
  { slug: 'glossary-timeline', number: 'H', title: 'Glossary, timeline and bibliography', summary: 'Every term, date and source in the course.', milestone: 'M8' },
];
