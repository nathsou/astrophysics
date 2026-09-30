/**
 * The bench tour's physics: two small circuits and a multimeter that can be connected to any of their test
 * points. Every reading is produced by the analog engine on a netlist that includes the meter itself, so
 * the meter loads the circuit exactly as a real one would (a 10 MΩ voltmeter, a 0.1 Ω ammeter) and the
 * mistakes a beginner makes have their real consequences (a blown fuse, a nonsense resistance).
 *
 * Circuits (a battery, a power switch, then a column of parts down to ground):
 *  - "divider":  A ─ R1 6 kΩ ─ B ─ R2 3 kΩ ─ C ─ jumper J ─ G, on a 9 V battery. The jumper is closed; opening
 *    it is how you insert an ammeter.
 *  - "fault":    A ─ R1 470 Ω ─ P ─ R2 1 kΩ ─ Q ─ R3 470 Ω ─ R ─ LED ─ G. One resistor is open.
 */
import { createAnalogEngine } from '$lib/sim/analog';
import { formatReadout } from '$lib/bench/format';
import { netlist } from './flat';

export type Mode = 'V' | 'A' | 'R' | 'C';
export type Scenario = 'divider' | 'fault';
export type TP = 'A' | 'B' | 'C' | 'G' | 'P' | 'Q' | 'R';

export const BATTERY_VOLTS = 9;
/** The fuse of the current range (a Fluke 87V has a 440 mA fuse on its mA input and an 11 A one on its A input). */
export const FUSE_AMPS = 0.44;
/** Continuity beeps below this resistance. */
export const BEEP_OHMS = 50;

export interface Rig {
  scenario: Scenario;
  /** The power switch. */
  power: boolean;
  /** The jumper J in the divider (closed = a wire). */
  linkClosed: boolean;
  /** Which resistor is open in the fault circuit: 0, 1, 2 (R1..R3), or -1 for none (repaired). */
  fault: number;
}

export interface Meter {
  mode: Mode;
  red: TP;
  black: TP;
}

export type ReadingKind = 'ok' | 'open' | 'fuse' | 'live' | 'wrong';

export interface Reading {
  kind: ReadingKind;
  /** The displayed digits, e.g. "3.00 V", "OL". */
  text: string;
  /** The measured quantity in volts, amperes or ohms (NaN when there is none). */
  value: number;
  /** True when the reading (an A range across a source) blew the fuse. */
  blew: boolean;
  beep: boolean;
  /** An explanation of an odd reading. */
  note?: string;
}

/** Test points of a scenario, top to bottom. */
export function testPoints(s: Scenario): TP[] {
  return s === 'divider' ? ['A', 'B', 'C', 'G'] : ['A', 'P', 'Q', 'R', 'G'];
}

/** Parts of a scenario's column, top to bottom: id, kind, label, and the test points at each end. */
export interface PartSpec {
  id: string;
  kind: 'res' | 'led' | 'link';
  label: string;
  top: TP;
  bottom: TP;
}

export function parts(s: Scenario): PartSpec[] {
  return s === 'divider'
    ? [
        { id: 'R1', kind: 'res', label: 'R1', top: 'A', bottom: 'B' },
        { id: 'R2', kind: 'res', label: 'R2', top: 'B', bottom: 'C' },
        { id: 'J', kind: 'link', label: 'J', top: 'C', bottom: 'G' },
      ]
    : [
        { id: 'R1', kind: 'res', label: 'R1', top: 'A', bottom: 'P' },
        { id: 'R2', kind: 'res', label: 'R2', top: 'P', bottom: 'Q' },
        { id: 'R3', kind: 'res', label: 'R3', top: 'Q', bottom: 'R' },
        { id: 'D1', kind: 'led', label: 'LED', top: 'R', bottom: 'G' },
      ];
}

export const VALUES: Record<string, number> = { R1: 6000, R2: 3000, F1: 470, F2: 1000, F3: 470 };

/** Add the circuit's elements to a netlist builder. Test points are nets named 'tp<name>'; 'tpG' is ground. */
function build(rig: Rig) {
  const c = netlist();
  const tp = (t: TP) => (t === 'G' ? 'gnd' : `tp${t}`);
  c.add('B', 'battery', { '-': 'gnd', '+': 'bat' }, { voltage: BATTERY_VOLTS, resistance: 0.2 });
  c.add('S', 'switch', { '1': 'bat', '2': tp('A') }, { closed: rig.power });
  if (rig.scenario === 'divider') {
    c.add('R1', 'resistor', { '1': tp('A'), '2': tp('B') }, { resistance: VALUES.R1! });
    c.add('R2', 'resistor', { '1': tp('B'), '2': tp('C') }, { resistance: VALUES.R2! });
    c.add('J', 'switch', { '1': tp('C'), '2': 'gnd' }, { closed: rig.linkClosed });
  } else {
    const chain: [string, TP, TP, number][] = [
      ['R1', 'A', 'P', VALUES.F1!],
      ['R2', 'P', 'Q', VALUES.F2!],
      ['R3', 'Q', 'R', VALUES.F3!],
    ];
    chain.forEach(([id, a, b, r], i) => {
      if (rig.fault === i) c.add(id, 'switch', { '1': tp(a), '2': tp(b) }, { closed: false });
      else c.add(id, 'resistor', { '1': tp(a), '2': tp(b) }, { resistance: r });
    });
    c.add('D1', 'led', { A: tp('R'), K: 'gnd' }, { color: 'red' });
  }
  return { c, tp };
}

/** Is the LED (or lamp) of the circuit lit right now, with no meter attached? */
export function ledBrightness(rig: Rig): number {
  if (rig.scenario !== 'fault') return 0;
  const { c } = build(rig);
  const e = createAnalogEngine(c.build());
  return Number(e.state('D1').brightness ?? 0);
}

/** What the meter shows with its probes where they are. */
export function measure(rig: Rig, meter: Meter, fuseBlown: boolean): Reading {
  const { c, tp } = build(rig);
  const red = tp(meter.red);
  const black = tp(meter.black);
  const none: Reading = { kind: 'ok', text: '', value: NaN, blew: false, beep: false };
  const dash = (r: Partial<Reading>): Reading => ({ ...none, ...r });

  if (meter.mode === 'V') {
    c.add('M', 'voltmeter', { '-': black, '+': red });
    const e = createAnalogEngine(c.build());
    const v = Number(e.state('M').value);
    const v0 = Math.abs(v) < 0.0005 ? 0 : v;
    return dash({ value: v0, text: formatReadout(v0, 'V', 3) });
  }

  if (meter.mode === 'A') {
    if (fuseBlown) {
      // The fuse is an open circuit: the meter passes no current and reads zero.
      return dash({ kind: 'fuse', value: 0, text: '0.000 A', note: 'The fuse is blown: this range is now an open circuit.' });
    }
    c.add('M', 'ammeter', { '+': red, '-': black });
    const e = createAnalogEngine(c.build());
    const i = Number(e.state('M').value);
    if (Math.abs(i) > FUSE_AMPS) {
      return dash({
        kind: 'fuse',
        value: i,
        blew: true,
        text: 'FUSE',
        note: `The current range is a short circuit (0.1 Ω): ${formatReadout(Math.abs(i), 'A', 3)} tried to flow, and the ${FUSE_AMPS * 1000} mA fuse blew.`,
      });
    }
    const i0 = Math.abs(i) < 5e-8 ? 0 : i;
    return dash({ value: i0, text: formatReadout(i0, 'A', 3) });
  }

  // Ohms and continuity: the meter sources its own small test current (1 V behind 1 kΩ).
  if (rig.power) {
    return dash({
      kind: 'live',
      text: 'ERR',
      note: 'Resistance only works on a circuit with the power off. The battery’s current swamps the meter’s tiny test current (and a real meter can be damaged).',
    });
  }
  if (red === black) return dash({ value: 0, text: formatReadout(0, 'Ω', 3), beep: meter.mode === 'C' });
  c.add('M', 'battery', { '-': black, '+': red }, { voltage: 1, resistance: 1000 });
  const e = createAnalogEngine(c.build());
  const st = e.state('M');
  const vp = Number(st.value);
  const i = Number(st.current);
  if (!(i > 1e-9)) return dash({ kind: 'open', value: Infinity, text: 'OL', note: 'Over limit: no path between the probes (an open circuit).' });
  const r = vp / i;
  return dash({ value: r, text: formatReadout(r, 'Ω', 3), beep: meter.mode === 'C' && r < BEEP_OHMS });
}

// ---------------------------------------------------------------------------------------------
// Tasks: what the reader has to do in each step, checked against the log of readings.

export interface Sample {
  mode: Mode;
  scenario: Scenario;
  power: boolean;
  linkClosed: boolean;
  a: TP;
  b: TP;
  reading: Reading;
  /** The fuse blown by this very measurement. */
  blew: boolean;
}

const pair = (s: Sample, x: TP, y: TP) => (s.a === x && s.b === y) || (s.a === y && s.b === x);

export interface Task {
  id: string;
  text: string;
  done: (log: Sample[]) => boolean;
}

export const STEP_TASKS: Task[][] = [
  [
    { id: 'vr2', text: 'Measure the voltage across R2 (probes on B and C).', done: (l) => l.some((s) => s.mode === 'V' && s.power && s.scenario === 'divider' && pair(s, 'B', 'C')) },
    { id: 'vr1', text: 'Measure the voltage across R1 (A and B).', done: (l) => l.some((s) => s.mode === 'V' && s.power && s.scenario === 'divider' && pair(s, 'A', 'B')) },
    { id: 'vbat', text: 'Measure the battery voltage (A and G).', done: (l) => l.some((s) => s.mode === 'V' && s.power && s.scenario === 'divider' && pair(s, 'A', 'G')) },
  ],
  [
    {
      id: 'series',
      text: 'Open the jumper J, set the meter to A and put the probes on C and G: the meter is now in series.',
      done: (l) => l.some((s) => s.mode === 'A' && s.power && !s.linkClosed && !s.blew && pair(s, 'C', 'G') && s.reading.kind === 'ok'),
    },
    {
      id: 'shorted',
      text: 'Now the classic mistake: A range with the probes across the battery (A and G).',
      done: (l) => l.some((s) => s.blew),
    },
  ],
  [
    { id: 'r2', text: 'Switch the power off and measure R2 (B and C).', done: (l) => l.some((s) => s.mode === 'R' && !s.power && s.scenario === 'divider' && pair(s, 'B', 'C') && s.reading.kind === 'ok') },
    { id: 'cont', text: 'Use the continuity range on the jumper J (C and G): a wire should beep.', done: (l) => l.some((s) => s.mode === 'C' && !s.power && s.linkClosed && pair(s, 'C', 'G') && s.reading.beep) },
    { id: 'live', text: 'Try the Ω range with the power on, once, to see what a live circuit does to it.', done: (l) => l.some((s) => (s.mode === 'R' || s.mode === 'C') && s.power && s.reading.kind === 'live') },
  ],
  [],
];

export function taskStatus(step: number, log: Sample[]): { task: Task; done: boolean }[] {
  return (STEP_TASKS[step] ?? []).map((task) => ({ task, done: task.done(log) }));
}

/** Which resistor is open: a deterministic sequence, so a "new fault" button cycles through them. */
export function nextFault(previous: number): number {
  return (previous + 2) % 3;
}
