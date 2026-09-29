/**
 * Scenario checks for circuits that are not pure logic (an LED that must light, a pull-up that must hold a
 * line high): set some switches, let the circuit settle, and test what parts and nets look like.
 * Used by `debug` exercises whose faults are analogue: a reversed LED, a missing pull-up, no resistor.
 */
import type { Circuit, EngineKind, ParamValue } from '../netlist/types';
import type { SubResolver } from '../netlist/connect';
import type { Engine } from '../engine';
import { flatten, topLevelNets } from '../netlist/flatten';
import { createDigitalEngine } from '../digital';
import { createSwitchEngine } from '../switch';
import { createAnalogEngine } from '../analog';

/** What a scenario expects of a part or net. */
export type ScenarioExpect =
  | 'lit' // a part's brightness is above 0.1
  | 'unlit'
  | 'burned'
  | 'ok' // not burned
  | 'high' // a net reads logic 1
  | 'low'
  | [number, number]; // a net's voltage lies in this range (V)

export interface Scenario {
  name?: string;
  /** Parameters to set before looking: `S1: true` (the part's main control: on, pressed, closed, throw) or `"S1.closed": true`. */
  set?: Record<string, ParamValue>;
  /** Part ids (lit, unlit, burned, ok) and net names or pins `U1.Y` (high, low, or a voltage range). */
  expect: Record<string, ScenarioExpect>;
  /** Simulated seconds to let the circuit settle (default 0.05 s; 50 ns for logic). */
  settle?: number;
}

export interface ScenarioFailure {
  scenario: string;
  target: string;
  expected: string;
  got: string;
}

export interface ScenarioResult {
  pass: boolean;
  problems: string[];
  failures: ScenarioFailure[];
}

const MAIN_PARAM: Record<string, string> = { toggle: 'on', button: 'pressed', pushbutton: 'pressed', switch: 'closed', spdt: 'throw' };

const fmtExpect = (e: ScenarioExpect) => (Array.isArray(e) ? `${e[0]} V to ${e[1]} V` : e);

export function checkScenarios(circuit: Circuit, scenarios: Scenario[], options: { engine?: EngineKind; parts?: SubResolver; seed?: number } = {}): ScenarioResult {
  const problems: string[] = [];
  const failures: ScenarioFailure[] = [];
  let flat;
  let conn;
  try {
    flat = flatten(circuit, options.parts);
    conn = topLevelNets(circuit, options.parts);
  } catch (e) {
    return { pass: false, problems: [`The circuit cannot be simulated: ${e instanceof Error ? e.message : String(e)}`], failures };
  }
  const kind = options.engine ?? circuit.engine ?? 'digital';
  const make = kind === 'analog' ? createAnalogEngine : kind === 'switch' ? createSwitchEngine : createDigitalEngine;
  const netOf = (name: string): number | undefined => {
    const pin = /^(.+)\.(\w+)$/.exec(name);
    let n: number | undefined = pin ? conn.pinNet.get(name) : undefined;
    if (n === undefined) {
      const i = conn.netNames.indexOf(name);
      n = i >= 0 ? i : undefined;
    }
    return n === undefined ? undefined : (flat.alias?.[n] ?? n);
  };
  scenarios.forEach((sc, k) => {
    const label = sc.name ?? `scenario ${k + 1}`;
    // A fresh engine each time: scenarios do not depend on one another.
    const engine: Engine = make(flat, { seed: options.seed ?? 1 });
    for (const [key, value] of Object.entries(sc.set ?? {})) {
      const [id, param] = key.includes('.') ? (key.split('.') as [string, string]) : [key, undefined];
      const el = flat.elements.find((e) => e.id === id);
      if (!el) {
        problems.push(`${label}: there is no part ${id} to set.`);
        continue;
      }
      engine.setParam(id, param ?? MAIN_PARAM[el.type] ?? 'on', value);
    }
    engine.advance(sc.settle ?? (kind === 'digital' ? 50e-9 : 0.05));
    for (const [target, want] of Object.entries(sc.expect)) {
      const fail = (got: string) => failures.push({ scenario: label, target, expected: fmtExpect(want), got });
      if (want === 'lit' || want === 'unlit' || want === 'burned' || want === 'ok') {
        if (!flat.elements.some((e) => e.id === target)) {
          problems.push(`${label}: there is no part ${target}.`);
          continue;
        }
        const st = engine.state(target);
        const b = Number(st.brightness ?? (st.lit ? 1 : 0));
        if (want === 'lit' && !(b > 0.1)) fail(st.burned ? 'burned out' : 'dark');
        else if (want === 'unlit' && b > 0.1) fail('lit');
        else if (want === 'burned' && !st.burned) fail('not burned');
        else if (want === 'ok' && st.burned) fail('burned out');
        continue;
      }
      const n = netOf(target);
      if (n === undefined) {
        problems.push(`${label}: there is no net or pin called ${target}.`);
        continue;
      }
      const logic = engine.logic(n);
      const v = engine.voltage(n);
      if (want === 'high' && logic !== 1) fail(logic === 0 ? 'low' : logic === 2 ? 'unknown (X)' : 'floating');
      else if (want === 'low' && logic !== 0) fail(logic === 1 ? 'high' : logic === 2 ? 'unknown (X)' : 'floating');
      else if (Array.isArray(want) && !(v >= want[0] && v <= want[1])) fail(Number.isFinite(v) ? `${+v.toFixed(3)} V` : 'no voltage');
    }
  });
  return { pass: failures.length === 0 && problems.length === 0, problems, failures };
}
