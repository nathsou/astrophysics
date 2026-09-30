/**
 * Drives the RTL simulator for a widget: the values of the inputs, the outputs and registers after every
 * change, the clock cycle, and a history of what was done so that another simulator (the gates) can replay it.
 */
import { createRtlSim, type RtlDesign, type RtlSim } from '$lib/hdl';

export interface PortView {
  name: string;
  width: number;
  clock: boolean;
  /** The DCL type as written in the design, for labels. */
  type?: string;
}

export type Op = { op: 'set'; name: string; value: bigint } | { op: 'tick' } | { op: 'reset' };

const MAX_HISTORY = 20000;

export class RtlDriver {
  inputs: PortView[] = $state.raw([]);
  outputs: PortView[] = $state.raw([]);
  registers: PortView[] = $state.raw([]);
  /** Current values of inputs, outputs and registers by name. */
  values: Record<string, bigint> = $state.raw({});
  cycle = $state(0);
  /** The simulator could not be created (for example, no `new Function` and a design the interpreter cannot run). */
  error = $state('');
  private sim: RtlSim | undefined;
  /** Everything done since the last reset, oldest first (capped). */
  history: Op[] = [];
  private inputValues = new Map<string, bigint>();

  /** A simulator exists (reactive). */
  ready = $state(false);

  /** (Re)creates the simulator for a design; inputs of the same name and width keep their values. */
  load(design: RtlDesign): void {
    try {
      const sim = createRtlSim(design);
      const mod = sim.module;
      const inputs = mod.inputs.map((p) => ({ name: p.name, width: p.width, clock: p.clock }));
      const outputs = mod.outputs.map((p) => ({ name: p.name, width: p.width, clock: false }));
      const top = design.modules[design.top];
      const registers: PortView[] = [];
      if (top) {
        for (const c of top.cells) {
          if (c.kind !== 'reg') continue;
          const s = top.signals[c.y];
          if (s?.name && !registers.some((r) => r.name === s.name)) registers.push({ name: s.name, width: s.width, clock: false });
        }
      }
      const old = this.inputValues;
      this.inputValues = new Map();
      this.sim = sim;
      for (const p of inputs) {
        if (p.clock) continue;
        const v = old.get(p.name);
        const keep = v !== undefined && v < 1n << BigInt(p.width) ? v : 0n;
        this.inputValues.set(p.name, keep);
        sim.set(p.name, keep);
      }
      this.inputs = inputs;
      this.outputs = outputs;
      this.registers = registers;
      this.history = [];
      for (const [name, value] of this.inputValues) if (value !== 0n) this.history.push({ op: 'set', name, value });
      this.cycle = 0;
      this.error = '';
      this.ready = true;
      this.refresh();
    } catch (e) {
      this.sim = undefined;
      this.ready = false;
      this.error = e instanceof Error ? e.message : String(e);
    }
  }

  private push(op: Op): void {
    this.history.push(op);
    if (this.history.length > MAX_HISTORY) this.history.splice(0, this.history.length - MAX_HISTORY / 2);
  }

  private refresh(): void {
    const sim = this.sim;
    if (!sim) return;
    const v: Record<string, bigint> = {};
    for (const p of this.inputs) if (!p.clock) v[p.name] = this.inputValues.get(p.name) ?? 0n;
    for (const p of this.outputs) v[p.name] = sim.getBig(p.name);
    for (const r of this.registers) v[r.name] = sim.peek(r.name);
    this.values = v;
    this.cycle = sim.cycle;
  }

  set(name: string, value: bigint | number): void {
    const p = this.inputs.find((x) => x.name === name);
    if (!p || p.clock || !this.sim) return;
    const v = BigInt(value) & ((1n << BigInt(p.width)) - 1n);
    this.inputValues.set(name, v);
    this.sim.set(name, v);
    this.push({ op: 'set', name, value: v });
    this.refresh();
  }

  tick(): void {
    if (!this.sim) return;
    this.sim.step(1);
    this.push({ op: 'tick' });
    this.refresh();
  }

  /** Back to power-up (inputs keep their values). */
  reset(): void {
    if (!this.sim) return;
    this.sim.reset();
    this.history = [];
    for (const [name, value] of this.inputValues) if (value !== 0n) this.history.push({ op: 'set', name, value });
    this.refresh();
  }
}

/** A value as hexadecimal with the digits its width needs: `0x0f`. */
export function hex(v: bigint, width: number): string {
  return `0x${v.toString(16).padStart(Math.max(1, Math.ceil(width / 4)), '0')}`;
}

export function bin(v: bigint, width: number): string {
  return v.toString(2).padStart(width, '0');
}
