/**
 * Appendix C describes the simulator and the toolchain. This file checks what it says against the code: every source
 * path it names exists, every constant it quotes is in the source (or is imported from it), the catalogue table
 * matches the catalogue, and the behaviours it describes (a resistor that burns, a flip-flop that goes metastable,
 * a bus with two drivers) happen when the engines are run.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fencedBlocks, firstCode, tableAfter } from '../f-dcl/fences';
import { PATHS, PIPELINES } from './widgets/pipelines';
import { allDefs, getDef, pinsOf } from '$lib/sim/netlist/catalog';
import { flatten } from '$lib/sim/netlist/flatten';
import type { Circuit, FlatNetlist, Params, Placed } from '$lib/sim/netlist/types';
import { createAnalogEngine, analogModelTypes, LED_COLOURS } from '$lib/sim/analog';
import { G_CLOSED, G_OPEN, GMIN, GMIN_JUNCTION, VT } from '$lib/sim/analog/device';
import { AMMETER_FLOOR, VOLTMETER_FLOOR } from '$lib/sim/analog/meter-floors';
import { createDigitalEngine, DEFAULT_MAX_EVENTS_PER_ADVANCE as DIGITAL_EVENTS } from '$lib/sim/digital';
import { digitalModelTypes, TICKS_PER_SECOND } from '$lib/sim/digital/model';
import { createSwitchEngine, DEFAULT_MAX_EVENTS_PER_ADVANCE as SWITCH_EVENTS } from '$lib/sim/switch';
import { ANALOG, TRANSISTOR_BUDGET } from '$lib/sim/expand/expand';
import { cellFor, cellTransistors } from '$lib/sim/expand/cells';
import { transistorsOf } from '$lib/sim/check/cost';
import { DIAL_SPEED, availability } from '$lib/bench/dial';
import { DRAFT_KEY, decodeShare, encodeShare } from '$lib/bench/share';
import { MAX_ANALYSER_CHANNELS, MAX_SCOPE_CHANNELS } from '$lib/bench/instruments/kinds';
import { MAX_SPEED, MIN_SPEED, defaultSpeed } from '$lib/bench/editor/sim';
import { PARTS } from '$lib/partsbin';
import { ALL_CODES } from '../f-dcl/widgets/diagnostics';
import ledDirect from './circuits/led-direct.json';
import metastable from './circuits/metastable.json';
import nandDial from './circuits/nand-dial.json';

const root = new URL('../../../', import.meta.url).pathname;
const md = readFileSync(new URL('./index.md', import.meta.url), 'utf8').replace(/\u202f/g, ' ');
const src = (path: string) => readFileSync(join(root, path), 'utf8');

/** The value of `const NAME = <number>` in a source file. */
function constant(path: string, name: string): number {
  const m = new RegExp(`\\b${name}\\s*(?::[^=]+)?=\\s*([-0-9.e_]+)`).exec(src(path));
  if (!m) throw new Error(`no constant ${name} in ${path}`);
  return Number(m[1]!.replace(/_/g, ''));
}

const circuit = (c: unknown) => c as Circuit;

/**
 * A circuit from a list of parts and the nets their pins are on: each pin gets a net label (or a ground symbol, for the
 * net `GND`) at its position, which connects it without a drawn wire.
 */
function build(parts: { id: string; type: string; pins: Record<string, string>; params?: Params }[]): Circuit {
  const components: Placed[] = [];
  parts.forEach((p, i) => {
    const x = 10;
    const y = 10 + 20 * i;
    components.push({ id: p.id, type: p.type, x, y, params: p.params });
    for (const pin of pinsOf(getDef(p.type)!, p.params ?? {})) {
      const net = p.pins[pin.name];
      if (net === undefined) continue;
      const at = { x: x + pin.x, y: y + pin.y };
      components.push(net === 'GND' ? { id: `${p.id}.${pin.name}.g`, type: 'ground', ...at } : { id: `${p.id}.${pin.name}.n`, type: 'label', ...at, params: { name: net } });
    }
  });
  return { version: 1, components, wires: [] };
}
const netOf = (flat: FlatNetlist, type: string, pin: number, nth = 0) => flat.elements.filter((e) => e.type === type)[nth]!.pins[pin]!;

describe('paths named in the appendix', () => {
  const exists = (path: string): boolean => {
    if (!path.includes('*')) return existsSync(join(root, path));
    const dir = dirname(path);
    const re = new RegExp('^' + path.slice(dir.length + 1).replace(/[.]/g, '\\.').replace(/\*/g, '.*') + '$');
    return readdirSync(join(root, dir)).some((f) => re.test(f));
  };

  it('every path in the diagrams exists', () => {
    expect(PATHS.length).toBeGreaterThan(20);
    for (const p of PATHS) expect(exists(p), p).toBe(true);
  });

  it('every path in the text exists', () => {
    const paths = new Set<string>();
    for (const m of md.matchAll(/`((?:src|docs)\/[^`\s]+)`/g)) paths.add(m[1]!);
    expect(paths.size).toBeGreaterThan(20);
    for (const p of paths) expect(exists(p), p).toBe(true);
  });

  it('every file in the source map exists next to the first path of its row', () => {
    const rows = tableAfter(md, '## Where to look');
    expect(rows.length).toBeGreaterThanOrEqual(10);
    for (const [, where] of rows) {
      const tokens = [...where!.matchAll(/`([^`]+)`/g)].map((m) => m[1]!);
      const first = tokens[0]!;
      expect(first.startsWith('src/'), first).toBe(true);
      const base = first.endsWith('/') || first.includes('*') ? first.replace(/[^/]*\*.*$/, '') : dirname(first) + '/';
      for (const t of tokens) {
        const full = t.startsWith('src/') || t.startsWith('docs/') ? t : base + t;
        expect(exists(full), full).toBe(true);
      }
    }
  });

  it('the pipelines have the three lanes the text refers to', () => {
    expect(PIPELINES.map((p) => p.id)).toEqual(['simulator', 'toolchain', 'plds']);
    for (const id of ['simulator', 'toolchain', 'plds']) expect(md).toContain(`::pipeline-diagram{id="${id}"`);
  });
});

describe('the circuit model and the catalogue', () => {
  const byCategory: Record<string, string[]> = {};
  for (const d of allDefs()) (byCategory[d.category] ??= []).push(d.type);

  it('has 62 types', () => {
    expect(allDefs().length).toBe(62);
    expect(md).toContain('There are 62 types');
  });

  it('the catalogue table lists exactly the types of each category', () => {
    const names: Record<string, string> = {
      Wiring: 'wiring',
      Sources: 'source',
      Passive: 'passive',
      Switches: 'switch',
      Electromechanical: 'electromechanical',
      Semiconductors: 'semiconductor',
      Meters: 'meter',
      'Inputs and outputs': 'io',
      Gates: 'gate',
      Sequential: 'sequential',
      Blocks: 'block',
    };
    const rows = tableAfter(md, '### The catalog');
    expect(rows.length).toBe(Object.keys(names).length);
    for (const [name, types] of rows) {
      const listed = [...types!.matchAll(/`([^`]+)`/g)].map((m) => m[1]!).sort();
      expect(listed, name).toEqual([...byCategory[names[name!]!]!].sort());
    }
  });

  it('the digital engine has 41 models and the analog engine 36', () => {
    expect(digitalModelTypes().length).toBe(41);
    expect(analogModelTypes().length).toBe(36);
    expect(md).toContain('The digital engine has models for 41 types');
    expect(md).toContain('The analog engine has 36');
  });

  it('the analog engine has no model for the parts the text says it lacks', () => {
    const have = new Set(analogModelTypes());
    for (const t of ['tristate', 'seven-seg', 'hex-display', 'dff', 'mux', 'ram']) expect(have.has(t), t).toBe(false);
    for (const t of ['comparator', 'not', 'xnor', 'rail', 'potentiometer']) expect(have.has(t), t).toBe(true);
  });

  it('the switch-level engine leaves out a part it has no model for, with a warning', () => {
    const eng = createSwitchEngine(flatten(build([{ id: 'F', type: 'dff', pins: { D: 'A', CLK: 'A', Q: 'Q' } }])));
    eng.settle();
    expect(eng.messages.some((m) => /does not simulate "dff".*left out/.test(m.text))).toBe(true);
  });

  it('a circuit is JSON version 1, at most 32 subcircuits deep, with the geometry constants of the text', () => {
    expect(src('src/lib/sim/netlist/types.ts')).toMatch(/version: 1;/);
    expect(src('src/lib/sim/netlist/flatten.ts')).toMatch(/depth > 32/);
    expect(constant('src/lib/sim/netlist/types.ts', 'GRID_PX')).toBe(12);
  });
});

describe('the digital engine', () => {
  it('counts time in picoseconds, exactly up to 2^53', () => {
    expect(TICKS_PER_SECOND).toBe(1e12);
    expect(2 ** 53 / 1e12 / 3600).toBeCloseTo(2.5, 1);
  });

  it('has the defaults of the text', () => {
    const s = src('src/lib/sim/digital/engine.ts');
    expect(s).toMatch(/options\.delayModel \?\? 'inertial'/);
    expect(s).toMatch(/options\.seed \?\? 0x5eed/);
    expect(s).toMatch(/options\.powerUp \?\? 'random'/);
    expect(s).toMatch(/options\.maxDeltaCycles \?\? 10_000/);
    expect(s).toMatch(/nsToTicks\(1\)/);
  });

  it('flip-flop defaults: clkToQ 1, setup 0.5, hold 0.2, tau 1', () => {
    const s = src('src/lib/sim/digital/models/sequential.ts');
    expect(s).toMatch(/param\('tau', 1\)/);
    expect(s).toMatch(/param\('clkToQ', 1\)/);
    expect(s).toMatch(/param\('setup', 0\.5\)/);
    expect(s).toMatch(/param\('hold', 0\.2\)/);
    const rows = tableAfter(md, '### Flip-flops and metastability');
    expect(rows.map((r) => [firstCode(r[0]!), Number(r[1])])).toEqual([
      ['clkToQ', 1],
      ['setup', 0.5],
      ['hold', 0.2],
      ['tau', 1],
    ]);
  });

  it('two drivers that disagree give X and a contention message', () => {
    const flat = flatten(
      build([
        { id: 'K0', type: 'const', pins: { Y: 'N' }, params: { value: 0 } },
        { id: 'K1', type: 'const', pins: { Y: 'N' }, params: { value: 1 } },
        { id: 'L', type: 'indicator', pins: { A: 'N' } },
      ]),
    );
    const eng = createDigitalEngine(flat);
    eng.settle();
    expect(eng.logic(netOf(flat, 'indicator', 0))).toBe(2);
    expect(eng.messages.some((m) => /Contention on net/.test(m.text))).toBe(true);
  });

  it('a net nobody drives is Z, and a driver alone wins over a Z', () => {
    const flat = flatten(
      build([
        { id: 'T', type: 'toggle', pins: { Y: 'E' } },
        { id: 'K', type: 'const', pins: { Y: 'D' }, params: { value: 1 } },
        { id: 'B', type: 'tristate', pins: { A: 'D', EN: 'E', Y: 'N' } },
        { id: 'L', type: 'indicator', pins: { A: 'N' } },
      ]),
    );
    const eng = createDigitalEngine(flat);
    eng.settle();
    eng.advance(10e-9);
    const n = netOf(flat, 'indicator', 0);
    expect(eng.logic(n)).toBe(3);
    eng.setParam('T', 'on', true);
    eng.settle();
    eng.advance(10e-9);
    expect(eng.logic(n)).toBe(1);
  });

  it('a pulse shorter than the delay vanishes with inertial delay and passes with transport delay', () => {
    const run = (delayModel: 'inertial' | 'transport') => {
      const flat = flatten(
        build([
          { id: 'T', type: 'toggle', pins: { Y: 'A' } },
          { id: 'B', type: 'buffer', pins: { A: 'A', Y: 'Y' }, params: { delay: 5 } },
          { id: 'L', type: 'indicator', pins: { A: 'Y' } },
        ]),
      );
      const eng = createDigitalEngine(flat, { delayModel });
      eng.settle();
      const y = netOf(flat, 'indicator', 0);
      const rec = eng.watch([y]);
      eng.setParam('T', 'on', true);
      eng.advance(2e-9);
      eng.setParam('T', 'on', false);
      eng.advance(20e-9);
      const values = [...rec.values()[0]!];
      return values.includes(1);
    };
    expect(run('inertial')).toBe(false);
    expect(run('transport')).toBe(true);
  });

  it('a zero-delay loop is reported after the delta-cycle limit and its outputs go to X', () => {
    const flat = flatten(
      build([
        { id: 'I', type: 'not', pins: { A: 'N', Y: 'N' }, params: { delay: 0 } },
        { id: 'L', type: 'indicator', pins: { A: 'N' } },
      ]),
    );
    const eng = createDigitalEngine(flat);
    eng.settle();
    expect(eng.messages.some((m) => m.level === 'error')).toBe(true);
  });

  it('a flip-flop whose data changes inside its set-up window goes metastable, and the figure needs transport delay to show it', () => {
    const run = (delayModel: 'inertial' | 'transport') => {
      const eng = createDigitalEngine(flatten(circuit(metastable)), { delayModel });
      eng.settle();
      eng.advance(20e-6);
      return eng.messages.map((m) => m.text);
    };
    const msgs = run('transport');
    expect(msgs.some((t) => /set-up time violated. The data input changed 5(\.0+)? ns before the rising clock edge/.test(t))).toBe(true);
    expect(msgs.some((t) => /left the metastable state after .* Q settled to [01]/.test(t))).toBe(true);
    expect(run('inertial').some((t) => /time violated/.test(t))).toBe(false);
  });


  it('the models are the ones the text says: gates propagate unknowns only as far as they must', () => {
    const s = src('src/lib/sim/digital/logic.ts');
    expect(s).toMatch(/and4 = \(a: number, b: number\): number => \(a === 0 \|\| b === 0 \? 0/);
    expect(s).toMatch(/or4 = \(a: number, b: number\): number => \(a === 1 \|\| b === 1 \? 1/);
    expect(s).toMatch(/xor4 = \(a: number, b: number\): number => \(a > 1 \|\| b > 1 \? X/);
  });
});

describe('per-call event caps', () => {
  it('match the text: 100,000 digital and 10,000 switch-level events per advance()', () => {
    expect(DIGITAL_EVENTS).toBe(100_000);
    expect(SWITCH_EVENTS).toBe(10_000);
    expect(md).toContain('at most 100,000 and 10,000 events per call');
  });
});

describe('the switch-level engine', () => {
  it('the strength ranks are the ones in the table', () => {
    const eng = createSwitchEngine(flatten(build([{ id: 'M', type: 'nmos', pins: { G: 'A', D: 'A', S: 'A' } }])));
    expect(eng.levels).toMatchObject({ small: 1, normal: 2, large: 3, weak: 4, wire: 8, supply: 9 });
    expect(eng.levels.transistor).toEqual({ weak: 5, normal: 6, strong: 7 });
    const rows = tableAfter(md, '### Strengths');
    expect(rows.map((r) => r[1]).filter((c) => /^\d$/.test(c!))).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
  });

  it('a pull-up resistor loses to a transistor and settle mode defaults are as stated', () => {
    const s = src('src/lib/sim/switch/engine.ts');
    expect(s).toMatch(/Math\.max\(1000, 4 \* netlist\.netCount\)/);
    expect(s).toMatch(/options\.unitDelay \?\? options\.step \?\? 1e-9/);
    expect(s).toMatch(/options\.powerUp \?\? 'random'/);
  });
});

describe('the analog engine', () => {
  it('quotes its constants correctly', () => {
    const e = 'src/lib/sim/analog/engine.ts';
    expect(constant(e, 'RELTOL')).toBe(1e-6);
    expect(constant(e, 'VNTOL')).toBe(1e-8);
    expect(constant(e, 'ABSTOL')).toBe(1e-11);
    expect(constant(e, 'MAXITER')).toBe(40);
    expect(constant(e, 'MAXITER_SETTLE')).toBe(200);
    expect(constant(e, 'MAX_GROW')).toBe(4);
    expect(constant(e, 'H_MIN')).toBe(1e-15);
    expect(constant(e, 'DEFAULT_MAX_STEP')).toBe(1e-2);
    expect(constant(e, 'DEFAULT_FIXED_STEP')).toBe(1e-6);
    expect(constant(e, 'LTE_ABS_V')).toBe(1e-5);
    expect(constant(e, 'LTE_ABS_I')).toBe(1e-8);
    const s = src(e);
    expect(s).toMatch(/maxStepsPerAdvance \?\? 1000/);
    expect(s).toMatch(/maxWorkPerAdvance \?\? 5e7/);
    expect(s).toMatch(/gminCooldown = 100/);
    expect(s).toMatch(/for \(let g = 1e-2; g >= 1e-11; g \/= 10\)/);
    expect(s).toMatch(/this\.consistent/);
    expect(s).toMatch(/method === 'euler' \? 1e-4 : 5e-4/);
  });

  it('the minimum conductances and the thermal voltage', () => {
    expect(GMIN).toBe(1e-12);
    expect(GMIN_JUNCTION).toBe(1e-10);
    expect(G_CLOSED).toBe(100);
    expect(G_OPEN).toBe(1e-12);
    expect(1 / G_CLOSED).toBeCloseTo(0.01);
    expect(VT).toBe(0.025852);
    expect(AMMETER_FLOOR).toBe(1e-9);
    expect(VOLTMETER_FLOOR).toBe(1e-6);
    const rows = tableAfter(md, '### Minimum conductances');
    expect(rows.filter((r) => r[0]!.startsWith('`')).map((r) => firstCode(r[0]!))).toEqual(['GMIN', 'GMIN_JUNCTION']);
  });

  it('the text gives the LED colours of the model', () => {
    for (const [colour, { vf }] of Object.entries(LED_COLOURS)) {
      expect(md, colour).toContain(`${String(vf).replace('.', '.')} V (${colour})`);
    }
  });

  it('the gate, meter, relay, lamp and rating constants of the text are in the source', () => {
    const b = 'src/lib/sim/analog/models/';
    expect(constant(b + 'behavioural.ts', 'GATE_CIN')).toBe(5e-12);
    expect(constant(b + 'behavioural.ts', 'GATE_ROUT')).toBe(50);
    expect(constant(b + 'behavioural.ts', 'LOGIC_WIDTH')).toBe(0.1);
    expect(constant(b + 'switches.ts', 'RELAY_PULL_IN')).toBe(0.7);
    expect(constant(b + 'switches.ts', 'RELAY_DROP_OUT')).toBe(0.3);
    expect(constant(b + 'switches.ts', 'RELAY_PARALLEL_FACTOR')).toBe(100);
    expect(constant(b + 'passive.ts', 'RESISTOR_TAU')).toBe(0.5);
    expect(constant(b + 'passive.ts', 'RESISTOR_BURN')).toBe(2);
    expect(constant(b + 'passive.ts', 'CAP_ABUSE_TIME')).toBe(0.01);
    expect(constant(b + 'passive.ts', 'LAMP_T0')).toBe(0.1);
    expect(constant(b + 'semiconductors.ts', 'BURN_RATIO')).toBe(1.5);
    const passive = src(b + 'passive.ts');
    expect(passive).toMatch(/1\.1 \* rating/);
    expect(constant(b + 'passive.ts', 'LAMP_BURN_T')).toBe(1.45);
    const semi = src(b + 'semiconductors.ts');
    expect(semi).toMatch(/const tau = led \? 0\.02 : 0\.1/);
    expect(semi).toMatch(/BJT 50 ms/);
    const catalog = src('src/lib/sim/netlist/catalog/analog.ts');
    expect(catalog).toMatch(/rating\('power', 'Power rating', 0\.25, 'W'\)/);
    expect(catalog).toMatch(/rating\('maxCurrent', 'Maximum current', 0\.03, 'A'\)/);
    expect(catalog).toMatch(/key: 'resistance', label: 'Internal resistance', kind: 'number', default: 0\.2/);
  });

  it('a resistor at four times its rating burns after 0.35 s, and at ten times after 0.11 s', () => {
    const burnTime = (multiple: number) => {
      const c = build([
        { id: 'B', type: 'battery', pins: { '+': 'V', '-': 'GND' }, params: { voltage: 10, resistance: 0.001 } },
        { id: 'R', type: 'resistor', pins: { '1': 'V', '2': 'GND' }, params: { resistance: 100 / (multiple / 4), power: 0.25 } },
      ]);
      const eng = createAnalogEngine(flatten(c));
      eng.settle();
      const id = eng.netlist.elements.find((e) => e.type === 'resistor')!.id;
      for (let i = 0; i < 2000 && !eng.state(id).burned; i++) eng.advance(1e-3);
      return eng.time;
    };
    expect(burnTime(4)).toBeCloseTo(0.35, 1);
    expect(burnTime(10)).toBeCloseTo(0.11, 1);
    expect(md).toContain('after 0.35 s at 4× the rating, 0.11 s at 10×');
  });

  it('the LED across a battery burns out within a fraction of a second, and the engine says why', () => {
    const eng = createAnalogEngine(flatten(circuit(ledDirect)));
    eng.settle();
    expect(eng.state('D1').burned).toBeFalsy();
    eng.setParam('S1', 'closed', true);
    let peak = 0;
    for (let i = 0; i < 1000 && !eng.state('D1').burned; i++) {
      eng.advance(1e-3);
      peak = Math.max(peak, Math.abs(eng.current('D1', 0)));
    }
    expect(eng.state('D1').burned).toBe(true);
    expect(eng.time).toBeLessThan(0.2);
    expect(peak).toBeGreaterThan(1);
    expect(eng.messages.some((m) => /D1/.test(m.text))).toBe(true);
  });

  it('two ideal sources in parallel with different voltages give the error of the text', () => {
    const eng = createAnalogEngine(
      flatten(
        build([
          { id: 'G1', type: 'siggen', pins: { '+': 'V', '-': 'GND' }, params: { waveform: 'sine', amplitude: 0, offset: 5 } },
          { id: 'G2', type: 'siggen', pins: { '+': 'V', '-': 'GND' }, params: { waveform: 'sine', amplitude: 0, offset: 3 } },
        ]),
      ),
    );
    eng.settle();
    eng.advance(1e-3);
    expect(eng.messages.some((m) => m.level === 'error' && /connected in parallel/.test(m.text))).toBe(true);
    expect(src('src/lib/sim/analog/engine.ts')).toContain('Ideal voltage sources are connected in parallel (or in a loop) with different voltages');
  });

  it('the trapezoidal rule and fixed steps exist as options', () => {
    const flat = flatten(
      build([
        { id: 'B', type: 'battery', pins: { '+': 'V', '-': 'GND' }, params: { voltage: 5 } },
        { id: 'R', type: 'resistor', pins: { '1': 'V', '2': 'C' }, params: { resistance: 1000 } },
        { id: 'C', type: 'capacitor', pins: { '1': 'C', '2': 'GND' }, params: { capacitance: 1e-6 } },
      ]),
    );
    for (const opts of [{}, { method: 'trapezoidal' as const }, { fixedStep: true }]) {
      const eng = createAnalogEngine(flat, opts);
      eng.settle();
      while (eng.time < 5e-3) eng.advance(1e-3);
      const c = netOf(flat, 'capacitor', 0);
      expect(eng.voltage(c)).toBeGreaterThan(4.9);
    }
  });
});

describe('the abstraction dial', () => {
  it('has the budgets, speeds and parasitics of the text', () => {
    expect(TRANSISTOR_BUDGET).toEqual({ switch: 400, analog: 48 });
    expect(DIAL_SPEED).toEqual({ logic: undefined, switch: 4e-9, analog: 1e-9 });
    expect(ANALOG).toEqual({ k: 1e-4, gate: 2e-15, node: 10e-15, out: 50e-15 });
    const rows = tableAfter(md, '## The abstraction dial', 2);
    expect(rows.map((r) => r[0])).toEqual(['Transconductance *k*', 'Gate capacitance', 'Internal node', 'Output load']);
  });

  it('counts the transistors in the table', () => {
    const count = (type: Parameters<typeof cellFor>[0], n: number) => cellTransistors(cellFor(type, n));
    expect(count('not', 1)).toBe(2);
    expect(count('buffer', 1)).toBe(4);
    for (const n of [2, 3, 4]) {
      expect(count('nand', n)).toBe(2 * n);
      expect(count('nor', n)).toBe(2 * n);
      expect(count('and', n)).toBe(2 * n + 2);
      expect(count('or', n)).toBe(2 * n + 2);
    }
    expect(count('xor', 2)).toBe(12);
    expect(count('xnor', 2)).toBe(12);
    expect(count('tristate', 1)).toBe(8);
    expect(transistorsOf('xor', {})).toBe(8);
    expect(transistorsOf('xnor', {})).toBe(8);
    const rows = tableAfter(md, '## The abstraction dial', 1);
    const first = new Map(rows.map((r) => [r[0]!, r[1]!]));
    expect(first.get('NOT')).toBe('2');
    expect(first.get('Buffer')).toBe('4');
    expect(first.get('XOR, XNOR (2 inputs)')).toBe('12');
    expect(first.get('Tri-state buffer')).toBe('8');
  });

  it('offers all three levels for the NAND gate figure and refuses none of them', () => {
    const a = availability(circuit(nandDial), ['logic', 'switch', 'analog']);
    expect(a.logic.offered).toBe(true);
    expect(a.switch.offered).toBe(true);
    expect(a.analog.offered).toBe(true);
  });
});

describe('the bench', () => {
  it('has the limits of the text', () => {
    expect(MAX_SCOPE_CHANNELS).toBe(4);
    expect(MAX_ANALYSER_CHANNELS).toBe(16);
    expect(MIN_SPEED).toBe(1e-9);
    expect(MAX_SPEED).toBe(1e3);
    expect(DRAFT_KEY).toBe('dc-bench');
    expect(src('src/lib/bench/editor/history.ts')).toMatch(/limit = 200/);
    expect(src('src/lib/bench/instruments/Scope.svelte')).toMatch(/const COLS = 10;/);
  });

  it('the default speed follows the fastest clock, else 1 (analog) or 1e-6 (logic)', () => {
    const plain = build([{ id: 'R', type: 'resistor', pins: { '1': 'A', '2': 'B' } }]);
    expect(defaultSpeed(plain, 'analog')).toBe(1);
    expect(defaultSpeed(plain, 'digital')).toBe(1e-6);
    const clocked = build([{ id: 'C', type: 'clock', pins: { Y: 'A' }, params: { frequency: 10 } }]);
    expect(defaultSpeed(clocked, 'digital')).toBeCloseTo(0.05);
  });

  it('a share link is one format character and base64url text, and round-trips', async () => {
    const c = circuit(ledDirect);
    const z = await encodeShare(c);
    const j = await encodeShare(c, undefined, { compress: false });
    expect(z[0]).toBe('z');
    expect(j[0]).toBe('j');
    expect(/^[A-Za-z0-9_-]+$/.test(z.slice(1))).toBe(true);
    expect((await decodeShare(z)).circuit).toEqual(c);
    expect((await decodeShare(j)).circuit).toEqual(c);
    expect(z.length).toBeLessThan(j.length);
  });

  it('the figure options of the text are props of the circuit widget', () => {
    const widget = src('src/lib/bench/CircuitWidget.svelte');
    for (const p of ['mode', 'speed', 'current', 'traces', 'window', 'highlight', 'toolbar', 'dial', 'level', 'delayModel', 'seed']) {
      expect(widget, p).toMatch(new RegExp(`\\b${p}\\b`));
      expect(md, p).toContain('`' + p + '`');
    }
    expect(widget).toContain('Open on the bench');
  });
});

describe('the parts bin and the checkers', () => {
  it('has 40 parts, 32 with a reference, in six groups', () => {
    expect(PARTS.length).toBe(40);
    expect(PARTS.filter((p) => p.status === 'reference').length).toBe(32);
    expect(PARTS.filter((p) => p.status === 'planned').length).toBe(8);
    expect(new Set(PARTS.map((p) => p.group)).size).toBe(6);
    expect(md).toContain('The parts bin has 40 parts');
    expect(md).toContain('32 have a **reference implementation**');
    expect(md).toContain('the other 8 are planned');
  });

  it('the checker limits are in the source', () => {
    const comb = src('src/lib/sim/check/combinational.ts');
    expect(comb).toMatch(/maxInputs \?\? 24/);
    expect(comb).toMatch(/maxVectors \?\? 65536/);
    expect(comb).toMatch(/samples \?\? 3000/);
    const seq = src('src/lib/sim/check/sequential.ts');
    expect(seq).toMatch(/n <= 6/);
    expect(seq).toMatch(/spec\.budget \?\? 150_000/);
    expect(seq).toMatch(/spec\.cycles \?\? 300/);
    const rows = tableAfter(md, '### Checking a circuit');
    expect(rows.map((r) => r[0])).toEqual(['Combinational', 'Sequential', 'Waveform', 'Measurement', 'Scenario']);
    expect(rows[0]![2]).toContain('65,536');
    expect(rows[0]![2]).toContain('3,000');
    expect(rows[1]![2]).toContain('150,000');
  });
});

describe('the DCL toolchain and the programmable-logic flows', () => {
  it('has 57 diagnostics', () => {
    expect(ALL_CODES.length).toBe(57);
    expect(md).toContain('57 kinds of diagnostic');
  });

  it('the RTL simulator, the lowering and the flow have the properties of the text', () => {
    expect(src('src/lib/hdl/rtlsim.ts')).toContain('new Function');
    expect(src('src/lib/hdl/lower/index.ts')).toMatch(/c\.depth \* c\.width > 262144/);
    expect(md).toContain('262,144 bits');
    expect(src('src/lib/pld/fpga/synth.ts')).toMatch(/balancePasses \?\? 2/);
    expect(src('src/lib/pld/fpga/map.ts')).toMatch(/at most\s+\*?\*?k = 4 leaves|k = 4/);
    expect(src('src/lib/pld/twolevel/minimise.ts')).toMatch(/exactMaxVars \?\? 8/);
    expect(src('src/lib/pld/devices/vfpga-arch.ts')).toMatch(/LCS_PER_TILE = 8/);
    expect(src('src/lib/pld/cpld/jtag.ts')).toMatch(/16-state/);
  });

  it('there is no interchange netlist writer, and the text says so', () => {
    expect(existsSync(join(root, 'src/lib/pld/interchange'))).toBe(false);
    expect(readdirSync(join(root, 'src/lib/pld/fpga')).some((f) => /yosys|nextpnr|interchange/i.test(f))).toBe(false);
    expect(md).toContain('That export does not exist yet');
  });
});

describe('the appendix itself', () => {
  it('has the front matter and the sections of the brief', () => {
    expect(md).toMatch(/^---\nnumber: C\ntitle: The simulator and toolchain\n/);
    for (const h of ['## The circuit model', '## The digital engine', '## The switch-level engine', '## The analog engine', '## The abstraction dial', '## The bench', '## What the simulator does not model', '## Where to look'])
      expect(md).toContain(h);
  });

  it('its live circuits exist and its code blocks are the ones intended', () => {
    for (const name of ['led-direct', 'metastable', 'nand-dial']) expect(md).toContain(`::appendix-circuit{name="${name}"`);
    expect(fencedBlocks(md, 'text').length).toBe(1);
  });
});
