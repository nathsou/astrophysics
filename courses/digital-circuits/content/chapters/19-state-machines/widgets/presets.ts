/**
 * The machines of the chapter, ready to load into the FSM designer.
 *
 * Each one is an ordinary `Fsm`, so the same objects feed the tests, the exercises and the text's numbers.
 */
import type { Fsm } from './fsm';

export const TRAFFIC_LIGHT: Fsm = {
  title: 'Traffic light',
  kind: 'moore',
  inputs: ['tick'],
  outputs: ['red', 'amber', 'green'],
  states: [
    { name: 'Red', out: '100' },
    { name: 'RedAmber', out: '110' },
    { name: 'Green', out: '001' },
    { name: 'Amber', out: '010' },
  ],
  transitions: [
    { from: 'Red', to: 'RedAmber', when: '1' },
    { from: 'RedAmber', to: 'Green', when: '1' },
    { from: 'Green', to: 'Amber', when: '1' },
    { from: 'Amber', to: 'Red', when: '1' },
  ],
};

/** A 15 p vending machine that takes 5 p and 10 p coins (a Mealy machine: it dispenses on the coin that completes the price). */
export const VENDING: Fsm = {
  title: 'Vending machine',
  kind: 'mealy',
  inputs: ['five', 'ten'],
  outputs: ['dispense'],
  states: [
    { name: 'Empty', out: '0' },
    { name: 'Has5', out: '0' },
    { name: 'Has10', out: '0' },
  ],
  transitions: [
    { from: 'Empty', to: 'Has5', when: '10', out: '0' },
    { from: 'Empty', to: 'Has10', when: '01', out: '0' },
    { from: 'Has5', to: 'Has10', when: '10', out: '0' },
    { from: 'Has5', to: 'Empty', when: '01', out: '1' },
    { from: 'Has10', to: 'Empty', when: '10', out: '1' },
    { from: 'Has10', to: 'Empty', when: '01', out: '1' },
  ],
};

/** Recognises the bit pattern 1011 in a stream, with overlaps allowed (a Mealy machine). */
export const DETECTOR: Fsm = {
  title: 'Sequence detector 1011',
  kind: 'mealy',
  inputs: ['x'],
  outputs: ['found'],
  states: [
    { name: 'Idle', out: '0' },
    { name: 'Got1', out: '0' },
    { name: 'Got10', out: '0' },
    { name: 'Got101', out: '0' },
  ],
  transitions: [
    { from: 'Idle', to: 'Got1', when: '1', out: '0' },
    { from: 'Idle', to: 'Idle', when: '0', out: '0' },
    { from: 'Got1', to: 'Got1', when: '1', out: '0' },
    { from: 'Got1', to: 'Got10', when: '0', out: '0' },
    { from: 'Got10', to: 'Got101', when: '1', out: '0' },
    { from: 'Got10', to: 'Idle', when: '0', out: '0' },
    { from: 'Got101', to: 'Got1', when: '1', out: '1' },
    { from: 'Got101', to: 'Got10', when: '0', out: '0' },
  ],
};

/** A door lock with a two-bit keypad: the digits 2, 0, 3 in a row open it for one cycle. */
export const LOCK: Fsm = {
  title: 'Combination lock',
  kind: 'moore',
  inputs: ['hi', 'lo'],
  outputs: ['open'],
  states: [
    { name: 'Locked', out: '0' },
    { name: 'Two', out: '0' },
    { name: 'TwoZero', out: '0' },
    { name: 'Open', out: '1' },
  ],
  transitions: [
    { from: 'Locked', to: 'Two', when: '10' },
    { from: 'Two', to: 'TwoZero', when: '00' },
    { from: 'Two', to: 'Locked', when: '01' },
    { from: 'Two', to: 'Locked', when: '1-' },
    { from: 'TwoZero', to: 'Open', when: '11' },
    { from: 'TwoZero', to: 'Locked', when: '0-' },
    { from: 'TwoZero', to: 'Locked', when: '10' },
    { from: 'Open', to: 'Locked', when: '--' },
  ],
};

/** The control half of a UART receiver: the bit counter (a datapath) tells it when the eighth bit has arrived. */
export const UART_RX: Fsm = {
  title: 'UART receiver (control)',
  kind: 'moore',
  inputs: ['rx', 'last'],
  outputs: ['busy', 'shift', 'valid'],
  states: [
    { name: 'Idle', out: '000' },
    { name: 'Start', out: '100' },
    { name: 'Data', out: '110' },
    { name: 'Stop', out: '101' },
  ],
  transitions: [
    { from: 'Idle', to: 'Start', when: '0-' },
    { from: 'Start', to: 'Data', when: '0-' },
    { from: 'Start', to: 'Idle', when: '1-' },
    { from: 'Data', to: 'Stop', when: '-1' },
    { from: 'Stop', to: 'Idle', when: '--' },
  ],
};

export interface Preset {
  id: string;
  label: string;
  fsm: Fsm;
  /** What the machine is for and what to try. */
  note: string;
}

export const PRESETS: Preset[] = [
  { id: 'traffic', label: 'Traffic light', fsm: TRAFFIC_LIGHT, note: 'Four states in a ring, one input: the tick of a slow clock. Hold tick on and clock it: red, red and amber, green, amber. Then try the three encodings.' },
  { id: 'vending', label: 'Vending machine', fsm: VENDING, note: 'A 15 p machine that takes 5 p and 10 p coins. A Mealy machine: it dispenses in the same cycle as the coin that completes the price. Press Convert to Moore and see how many states that costs.' },
  { id: 'detector', label: 'Sequence 1011', fsm: DETECTOR, note: 'Finds 1011 in a stream of bits, overlaps allowed (1011011 contains two). Feed it bits with the x switch and watch found.' },
  { id: 'lock', label: 'Combination lock', fsm: LOCK, note: 'Enter the digits 2, 0, 3 on a two-bit keypad (hi, lo). A wrong digit sends you back to the start. Only Open lights the output, for one cycle.' },
  { id: 'uart', label: 'UART receiver', fsm: UART_RX, note: 'A preview of Chapter 24. The machine knows only which phase it is in; a separate bit counter tells it, through last, when the eighth data bit has arrived.' },
];

export const presetById = (id: string): Preset => PRESETS.find((p) => p.id === id) ?? PRESETS[0]!;

/** A blank machine for the reader to draw. */
export const BLANK: Fsm = {
  title: 'My machine',
  kind: 'moore',
  inputs: ['go'],
  outputs: ['lamp'],
  states: [
    { name: 'Off', out: '0' },
    { name: 'On', out: '1' },
  ],
  transitions: [
    { from: 'Off', to: 'On', when: '1' },
    { from: 'On', to: 'Off', when: '1' },
  ],
};

/** The turnstile of Figure 19.1 (and of the first exercise): a coin unlocks it, a push locks it again. */
export const TURNSTILE: Fsm = {
  title: 'Turnstile',
  kind: 'moore',
  inputs: ['coin', 'push'],
  outputs: ['unlocked'],
  states: [
    { name: 'Locked', out: '0' },
    { name: 'Unlocked', out: '1' },
  ],
  transitions: [
    { from: 'Locked', to: 'Unlocked', when: '1-' },
    { from: 'Unlocked', to: 'Locked', when: '01' },
  ],
};
