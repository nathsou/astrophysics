/**
 * Choosing and driving the simulation on the bench: which engine a circuit wants, how fast to run it,
 * and a stepper that advances an engine within a time budget so a circuit that is too fast for the
 * browser (a ring oscillator at a nanosecond per gate) slows down instead of freezing the page.
 */
import type { Engine } from '../../sim/engine';
import type { Circuit, EngineKind } from '../../sim/netlist/types';
import { getDef } from '../../sim/netlist/catalog';

const ANALOG_CATEGORIES = new Set(['source', 'passive', 'semiconductor', 'electromechanical', 'meter']);

/**
 * The engine a circuit should start on, from the parts it uses: analog for circuits with sources,
 * passives, semiconductors or meters; digital for gates, flip-flops, blocks and logic I/O; and
 * digital when a part cannot run in the analog engine at all (a tri-state buffer, a flip-flop).
 */
export function suggestEngine(circuit: Circuit): EngineKind {
  const defs = circuit.components.map((c) => getDef(c.type)).filter((d) => d !== undefined);
  if (!defs.length) return 'analog';
  if (defs.some((d) => !d.engines.includes('analog') && d.engines.includes('digital'))) return 'digital';
  if (defs.some((d) => ANALOG_CATEGORIES.has(d.category))) return 'analog';
  if (defs.some((d) => d.category === 'gate' || d.category === 'io' || d.category === 'sequential' || d.category === 'block')) return 'digital';
  return 'analog';
}

/** Parts that the engine cannot simulate: "R1 (Resistor)". Empty when the circuit will run. */
export function engineProblems(circuit: Circuit, kind: EngineKind): string[] {
  const out: string[] = [];
  for (const c of circuit.components) {
    const def = getDef(c.type);
    if (def && !def.engines.includes(kind)) out.push(`${c.id} (${def.name})`);
  }
  return out;
}

/** The engine in use for a circuit: its own choice if it has one, else the suggestion. */
export const engineOf = (circuit: Circuit): EngineKind => circuit.engine ?? suggestEngine(circuit);

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/**
 * A speed (simulated seconds per real second) at which the circuit's own time scale is visible:
 * an oscillating source is slowed so that a period takes about two seconds; logic without a clock
 * runs at a microsecond per second (gate delays are nanoseconds); everything else in real time.
 */
export function defaultSpeed(circuit: Circuit, kind: EngineKind = engineOf(circuit)): number {
  let shortest = Infinity;
  for (const c of circuit.components) {
    if (c.type === 'siggen' || c.type === 'clock') {
      const f = Math.max(1e-3, num(c.params?.frequency, c.type === 'clock' ? 1 : 1000));
      shortest = Math.min(shortest, 1 / f);
    }
  }
  if (Number.isFinite(shortest)) return clampSpeed(shortest / 2);
  return kind === 'analog' ? 1 : 1e-6;
}

export const MIN_SPEED = 1e-9;
export const MAX_SPEED = 1e3;
export const clampSpeed = (s: number): number => Math.max(MIN_SPEED, Math.min(MAX_SPEED, s));

/** Speeds on a 1–2–5 ladder, as an integer index (thirds of a decade) and back. */
const LADDER = [1, 2, 5];
export const speedAt = (index: number): number => LADDER[((index % 3) + 3) % 3]! * 10 ** Math.floor(index / 3);
export function speedIndex(speed: number): number {
  const decade = Math.floor(Math.log10(speed));
  let best = decade * 3;
  let bestD = Infinity;
  for (let i = decade * 3; i <= decade * 3 + 3; i++) {
    const d = Math.abs(Math.log(speedAt(i)) - Math.log(speed));
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}
export const SPEED_MIN_INDEX = speedIndex(MIN_SPEED);
export const SPEED_MAX_INDEX = speedIndex(MAX_SPEED);

/** Round a number to the nearest step of the 1–2–5 ladder. */
export const snapSpeed = (speed: number): number => speedAt(speedIndex(clampSpeed(speed)));

/**
 * Advances an engine by a requested amount of simulated time, in chunks sized from measured cost so
 * that one call takes at most about `budgetMs` of real time. When the engine cannot keep up, `lagging`
 * is set and the rest of the requested time is dropped (the simulation runs slower than asked).
 */
export class Stepper {
  /** Simulated seconds the engine advanced in the last call, and how much was asked. */
  advanced = 0;
  asked = 0;
  lagging = false;
  private chunk = 1e-6;

  constructor(
    private readonly budgetMs = 10,
    private readonly clock: () => number = () => performance.now(),
  ) {}

  advance(engine: Pick<Engine, 'advance'>, dt: number): void {
    this.asked = dt;
    this.advanced = 0;
    this.lagging = false;
    if (!(dt > 0)) return;
    const start = this.clock();
    let remaining = dt;
    while (remaining > dt * 1e-12) {
      const spent = this.clock() - start;
      if (spent >= this.budgetMs) {
        this.lagging = true;
        break;
      }
      const step = Math.min(remaining, this.chunk);
      const t0 = this.clock();
      engine.advance(step);
      const took = this.clock() - t0;
      remaining -= step;
      this.advanced += step;
      // Aim for chunks that take a quarter of the budget.
      if (took < this.budgetMs * 0.1) this.chunk = Math.min(this.chunk * 2, 1e9);
      else if (took > this.budgetMs * 0.4) this.chunk = Math.max(this.chunk / 2, 1e-13);
    }
  }
}
