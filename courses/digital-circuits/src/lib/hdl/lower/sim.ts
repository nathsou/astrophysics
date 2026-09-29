/**
 * Driving a lowered netlist on the digital engine like the RTL simulator: set inputs, pulse clocks, read
 * ports. It works on the netlist of `lowerToNetlist` and on the one flattened from `lowerToCircuit`, because
 * both keep the ids of the port elements (`in/…` toggles and `out/…` indicators).
 *
 * The clock is a manual `toggle`: `tick()` lets everything settle, raises it, lets the registers update and
 * lowers it again, so inputs never change near a clock edge and no flip-flop goes metastable.
 */
import { createDigitalEngine, type DigitalEngine, type DigitalEngineOptions } from '../../sim/digital';
import type { FlatNetlist, Logic } from '../../sim/netlist/types';
import type { Lowered } from './types';

export interface GateSim {
  readonly engine: DigitalEngine;
  readonly lowered: Lowered;
  /** Sets an input port (all bits). */
  set(port: string, value: number | bigint): void;
  /** The value of a port, or `undefined` while a bit is X or Z. */
  get(port: string): bigint | undefined;
  /** The logic value of each bit of a port, least significant first. */
  bits(port: string): Logic[];
  /** One rising edge (and the falling edge after it) of a clock port, or of every clock when omitted. */
  tick(clock?: string): void;
  step(n?: number): void;
  /** Power-up state: registers at their initial values, memories reloaded, inputs kept. */
  reset(): void;
  /** Lets pending changes settle (done by `tick`, and by `get` after a `set`). */
  settle(): void;
}

/** Writes the initial contents of the memories into an engine. Call it after creating or resetting it. */
export function applyMemoryInit(engine: DigitalEngine, lowered: Lowered): void {
  for (const m of lowered.memories) {
    for (const ram of m.rams) {
      const mask = (1n << BigInt(ram.bits)) - 1n;
      m.init.forEach((word, k) => {
        const v = (word >> BigInt(ram.bitLo)) & mask;
        if (v !== 0n) engine.writeMemory(ram.id, k, Number(v));
      });
    }
  }
}

export function createGateSim(lowered: Lowered, netlist: FlatNetlist = lowered.netlist, options: DigitalEngineOptions = {}): GateSim {
  const engine = createDigitalEngine(netlist, options);
  const index = new Map(netlist.elements.map((e) => [e.id, e]));
  const port = (name: string) => {
    const p = lowered.ports.find((x) => x.name === name);
    if (!p) throw new Error(`no port ${name}`);
    return p;
  };
  const values = new Map<string, bigint>();
  const settleTime = lowered.stats.settleNs * 1e-9;
  let dirty = false;
  const settle = () => {
    engine.advance(settleTime);
    dirty = false;
  };
  const setBits = (p: ReturnType<typeof port>, value: bigint) => {
    p.elements.forEach((id, i) => engine.setParam(id, 'on', ((value >> BigInt(i)) & 1n) === 1n));
    values.set(p.name, value);
    dirty = true;
  };
  for (const p of lowered.ports) if (p.dir === 'in') values.set(p.name, 0n);
  applyMemoryInit(engine, lowered);
  settle();
  const sim: GateSim = {
    engine,
    lowered,
    set(name, value) {
      const p = port(name);
      if (p.dir !== 'in') throw new Error(`${name} is not an input`);
      if (p.clock) throw new Error(`${name} is a clock: use tick()`);
      setBits(p, BigInt(value) & ((1n << BigInt(p.width)) - 1n));
    },
    bits(name) {
      if (dirty) settle();
      const p = port(name);
      return p.elements.map((id, i) => {
        const el = index.get(id);
        // Inputs read back their toggle's output pin, outputs the net an indicator watches.
        return engine.logic(el ? el.pins[0]! : p.nets[i]!);
      });
    },
    get(name) {
      const b = sim.bits(name);
      let v = 0n;
      for (let i = 0; i < b.length; i++) {
        if (b[i]! > 1) return undefined;
        if (b[i] === 1) v |= 1n << BigInt(i);
      }
      return v;
    },
    tick(clock) {
      const clocks = lowered.ports.filter((p) => p.dir === 'in' && p.clock && (clock === undefined || p.name === clock));
      if (clock !== undefined && clocks.length === 0) throw new Error(`no clock ${clock}`);
      settle();
      for (const p of clocks) setBits(p, 1n);
      settle();
      for (const p of clocks) setBits(p, 0n);
      settle();
    },
    step(n = 1) {
      for (let i = 0; i < n; i++) sim.tick();
    },
    reset() {
      engine.reset();
      applyMemoryInit(engine, lowered);
      // Keep the inputs as they are on the toggles (a schematic may have flipped them).
      for (const p of lowered.ports) {
        if (p.dir !== 'in') continue;
        let v = 0n;
        p.elements.forEach((id, i) => {
          if (!p.clock && index.get(id)?.params.on === true) v |= 1n << BigInt(i);
        });
        setBits(p, v);
      }
      settle();
    },
    settle,
  };
  return sim;
}
