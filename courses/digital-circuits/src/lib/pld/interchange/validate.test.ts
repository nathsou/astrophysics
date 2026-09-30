import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { check } from '../../hdl/check';
import { elaborate } from '../../hdl/elaborate';
import { YosysSim, toYosysJson, validateYosysJson, type YosysJson } from './index';

const golden = () => JSON.parse(readFileSync(new URL('./testdata/counter.json', import.meta.url), 'utf8')) as YosysJson;
const hierarchical = (): YosysJson => {
  const r = check('module Inc(a: bits<4>) -> (y: bits<4>) {\n  y = a + 1\n}\nmodule Top(clk: clock, x: bits<4>) -> (z: bits<4>) {\n  reg r: bits<4> = 3\n  inst i: Inc(a: r)\n  next r = i.y ^ x\n  z = r\n}');
  return toYosysJson(elaborate(r.program, 'Top'));
};

/** The problems the validator reports after `mutate` has damaged a copy of the file. */
function problems(json: YosysJson, mutate: (j: YosysJson) => void): string[] {
  const copy = structuredClone(json);
  mutate(copy);
  return validateYosysJson(copy);
}

describe('validateYosysJson', () => {
  it('accepts the golden file and a hierarchical design', () => {
    expect(validateYosysJson(golden())).toEqual([]);
    expect(validateYosysJson(hierarchical())).toEqual([]);
  });

  it('rejects things that are not netlists', () => {
    expect(validateYosysJson(null)).toEqual(['the file is not a JSON object']);
    expect(validateYosysJson([])).toEqual(['the file is not a JSON object']);
    expect(validateYosysJson({ creator: 'x' })).toEqual(['modules: missing or not an object']);
    expect(validateYosysJson({ modules: {} })).toEqual(['creator: missing or not a string']);
  });

  const cell = (j: YosysJson, type: string) => Object.values(j.modules.Counter!.cells).find((c) => c.type === type)!;

  it('checks ports', () => {
    expect(problems(golden(), (j) => ((j.modules.Counter!.ports.clk as { direction: string }).direction = 'sideways')).join('\n')).toMatch(/direction/);
    expect(problems(golden(), (j) => (j.modules.Counter!.ports.clk!.bits = [1] as never)).join('\n')).toMatch(/not a net number/);
    expect(problems(golden(), (j) => (j.modules.Counter!.ports.clk!.bits = ['2'] as never)).join('\n')).toMatch(/not a net number/);
    expect(problems(golden(), (j) => (j.modules.Counter!.ports.clk!.bits = 'nope' as never)).join('\n')).toMatch(/bits must be an array/);
  });

  it('checks cell parameters, ports and widths', () => {
    expect(problems(golden(), (j) => delete cell(j, '$add').parameters.Y_WIDTH).join('\n')).toMatch(/needs the parameter Y_WIDTH/);
    expect(problems(golden(), (j) => (cell(j, '$add').parameters.Y_WIDTH = '00000000000000000000000000000101')).join('\n')).toMatch(/4 bits, but the parameters of \$add say 5/);
    expect(problems(golden(), (j) => delete cell(j, '$mux').connections.S).join('\n')).toMatch(/needs the port S/);
    expect(problems(golden(), (j) => (cell(j, '$mux').port_directions.S = 'output')).join('\n')).toMatch(/S of \$mux is an input/);
    expect(problems(golden(), (j) => (cell(j, '$mux').connections.Z = [2])).join('\n')).toMatch(/no entry in port_directions|has no port Z/);
    expect(problems(golden(), (j) => (cell(j, '$dff').type = '$frobnicate')).join('\n')).toMatch(/not an internal cell type/);
    expect(validateYosysJson(JSON.parse(JSON.stringify(golden()).replace('$dff', '$frobnicate')), { allowUnknownInternal: true })).toEqual([]);
    expect(problems(golden(), (j) => (cell(j, '$dff').parameters.WIDTH = 1.5)).join('\n')).toMatch(/integer or a string|bits, but/);
  });

  it('checks the nets: one driver each, and every read net driven', () => {
    expect(problems(golden(), (j) => (cell(j, '$eq').connections.Y = [2])).join('\n')).toMatch(/net 2 has two drivers/);
    expect(problems(golden(), (j) => (cell(j, '$eq').connections.A = [90, 91, 92, 93])).join('\n')).toMatch(/nothing drives it/);
    expect(problems(golden(), (j) => (j.modules.Counter!.netnames.value!.bits = [97, 98, 99, 100])).join('\n')).toMatch(/is not driven by anything/);
    expect(problems(golden(), (j) => (j.modules.Counter!.netnames.value!.attributes.init = '00')).join('\n')).toMatch(/2 bits for a 4-bit wire/);
  });

  it('checks the hierarchy', () => {
    const h = hierarchical();
    const inst = (j: YosysJson) => Object.values(j.modules.Top!.cells).find((c) => c.type === 'Inc')!;
    expect(problems(h, (j) => (inst(j).type = 'Missing')).join('\n')).toMatch(/module Missing is not in the file/);
    expect(problems(h, (j) => (inst(j).connections.a = [2])).join('\n')).toMatch(/1 bits, but Inc.a has 4/);
    expect(problems(h, (j) => (inst(j).connections.nope = [2])).join('\n')).toMatch(/has no port nope/);
    expect(problems(h, (j) => delete j.modules.Top!.attributes.top).join('\n')).toMatch(/exactly one module must have the top attribute/);
    expect(problems(h, (j) => (j.modules.Inc!.cells.self = { ...inst(j), type: 'Inc' })).join('\n')).toMatch(/contains itself/);
  });
});

describe('the netlist simulator', () => {
  it('runs the golden counter', () => {
    const sim = new YosysSim(golden());
    sim.set('enable', 1);
    sim.set('clear', 0);
    expect(sim.get('count')).toBe(0n);
    sim.step(15);
    expect(sim.get('count')).toBe(15n);
    expect(sim.get('wrapped')).toBe(1n);
    sim.step();
    expect(sim.get('count')).toBe(0n);
    sim.set('clear', 1);
    sim.step(0);
    sim.set('enable', 0);
    expect(sim.get('wrapped')).toBe(0n);
  });

  it('starts a register at its init attribute and runs a hierarchy', () => {
    const sim = new YosysSim(hierarchical());
    expect(sim.get('z')).toBe(3n);
    sim.set('x', 0);
    sim.step();
    expect(sim.get('z')).toBe(4n);
    sim.set('x', 1);
    sim.step();
    expect(sim.get('z')).toBe(5n ^ 1n);
    sim.reset();
    expect(sim.get('z')).toBe(3n);
  });

  it('notices a damaged netlist (the comparison in yosys.test.ts is not vacuous)', () => {
    const j = golden();
    const eq = Object.values(j.modules.Counter!.cells).find((c) => c.type === '$eq')!;
    eq.type = '$ne';
    const sim = new YosysSim(j);
    sim.set('enable', 1);
    sim.set('clear', 0);
    sim.step(15);
    expect(sim.get('wrapped')).toBe(0n);
  });
});
