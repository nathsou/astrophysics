/**
 * The interchange netlist through the real Yosys, when one is installed (`yowasp-yosys` or `yosys` on PATH, or
 * `YOSYS`); otherwise these tests are skipped. A design with registers that have power-up values and an initialised
 * memory is written with `toYosysJson`, taken through Yosys down to gates (`synth`, with the memories turned into
 * flip-flops and every flip-flop into a plain `$_DFF_P_`), and the `write_json` that comes back is run in `YosysSim` next
 * to the RTL simulator on the same inputs. So Yosys's reading of the JSON (widths, bit order, `init` attributes,
 * `$mem_v2` parameters and `INIT`) has to agree with the RTL's: a netlist that Yosys reads differently gives
 * different outputs here, or an optimised-away design that the test notices as constant outputs.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { check } from '../../hdl/check';
import { elaborate } from '../../hdl/elaborate';
import { createRtlSim } from '../../hdl/rtlsim';
import { YosysSim, toYosysJson, type YosysJson } from './index';

function findYosys(): string | undefined {
  for (const candidate of [process.env.YOSYS, 'yowasp-yosys', 'yosys']) {
    if (!candidate) continue;
    const r = spawnSync(candidate, ['-V'], { encoding: 'utf8' });
    if (r.status === 0 && /Yosys/.test(r.stdout)) return candidate;
  }
  return undefined;
}

const yosys = findYosys();

/** Runs Yosys in a scratch folder (the WebAssembly build sees only its working directory) and returns the files it wrote. */
function runYosys(json: YosysJson, top: string, script: string): { dir: string; read: (file: string) => string; done: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'yosys-real-'));
  writeFileSync(path.join(dir, 'in.json'), JSON.stringify(json));
  const r = spawnSync(yosys!, ['-q', '-l', 'yosys.log', '-p', `read_json in.json; hierarchy -top ${top}; ${script}`], { cwd: dir, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`Yosys failed: ${r.stdout}${r.stderr}${(() => { try { return readFileSync(path.join(dir, 'yosys.log'), 'utf8').slice(-2000); } catch { return ''; } })()}`);
  return { dir, read: (f) => readFileSync(path.join(dir, f), 'utf8'), done: () => rmSync(dir, { recursive: true, force: true }) };
}

function rng(seed: number) {
  let s = seed >>> 0;
  const next = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0);
  return { int: (n: number) => next() % n };
}

const SOURCE = `module Probe(clk: clock, we: bit, addr: bits<3>, data: bits<8>, advance: bit) -> (rom_q: bits<8>, ram_q: bits<8>, ticks: bits<6>, sum: bits<8>) {
  // A ROM and a RAM, both with contents at power-up (the depth, 6, is not a power of two).
  mem rom: [bits<8>; 6] = [0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc]
  mem ram: [bits<8>; 6] = [7, 6, 5, 4, 3, 2]
  reg ticks_r: bits<6> = 37
  reg total: bits<8> = 0xa5
  rom_q = rom.read(addr)
  ram_q = ram.read(addr)
  ram.write(addr, data, we)
  next ticks_r = if advance { ticks_r + 1 } else { ticks_r }
  next total = total + rom.read(addr) + zext(ticks_r, 8)
  ticks = ticks_r
  sum = total
}`;

describe.skipIf(!yosys)('real Yosys on a design with a register init and initialised memories', () => {
  const r = check(SOURCE, { file: 'probe.dcl' });
  const design = elaborate(r.program, 'Probe');
  const json = toYosysJson(design);

  it('reads the netlist and keeps the ports (read_json, then write_json)', () => {
    const run = runYosys(json, 'Probe', 'proc; opt; write_json out.json');
    try {
      const out = JSON.parse(run.read('out.json')) as YosysJson;
      const ports = (j: YosysJson) => Object.entries(j.modules.Probe!.ports).map(([n, p]) => `${p.direction} ${n}[${p.bits.length}]`);
      expect(ports(out)).toEqual(ports(json));
    } finally {
      run.done();
    }
  });

  it('synthesised to gates, it computes what the RTL simulator computes (memory contents, init values and all)', () => {
    const run = runYosys(json, 'Probe', 'synth -top Probe -flatten -noabc; dfflegalize -cell $_DFF_P_ 01; opt_clean; write_json gates.json');
    try {
      const gates = JSON.parse(run.read('gates.json')) as YosysJson;
      const types = new Set(Object.values(gates.modules.Probe!.cells).map((c) => c.type));
      expect(types.has('$_DFF_P_')).toBe(true);
      expect([...types].every((t) => /^\$_/.test(t) || t === '$scopeinfo')).toBe(true);
      const rtl = createRtlSim(design);
      const net = new YosysSim(gates, 'Probe');
      const again = new YosysSim(json); // the course's own reading of the same JSON
      const rnd = rng(3);
      const seen = { rom: new Set<bigint>(), ram: new Set<bigint>(), ticks: new Set<bigint>() };
      for (let cycle = 0; cycle < 300; cycle++) {
        const inputs = { we: BigInt(rnd.int(3) === 0 ? 1 : 0), addr: BigInt(rnd.int(8)), data: BigInt(rnd.int(256)), advance: BigInt(rnd.int(2)) };
        for (const [name, v] of Object.entries(inputs)) {
          rtl.signal(name).set(v);
          net.set(name, v);
          again.set(name, v);
        }
        for (const out of ['rom_q', 'ram_q', 'ticks', 'sum']) {
          const want = rtl.signal(out).getBig();
          expect(net.get(out), `cycle ${cycle}: ${out} in Yosys's netlist`).toBe(want);
          expect(again.get(out), `cycle ${cycle}: ${out} in YosysSim`).toBe(want);
        }
        seen.rom.add(rtl.signal('rom_q').getBig());
        seen.ram.add(rtl.signal('ram_q').getBig());
        seen.ticks.add(rtl.signal('ticks').getBig());
        rtl.step();
        net.step();
        again.step();
      }
      // Not vacuous: the ROM's words came out (after the first, zero, read), and the counter started at 37.
      expect(seen.rom.has(0x34n) && seen.rom.has(0xbcn)).toBe(true);
      expect(seen.ram.has(7n) || seen.ram.has(6n) || seen.ram.has(5n)).toBe(true);
      expect(seen.ticks.has(37n)).toBe(true);
    } finally {
      run.done();
    }
  });

  it('synth_ice40 keeps the state: flip-flops and a memory (block RAM or logic) remain', () => {
    const run = runYosys(json, 'Probe', 'synth_ice40 -top Probe -json out.json');
    try {
      const out = JSON.parse(run.read('out.json')) as YosysJson;
      const types = Object.values(out.modules.Probe!.cells).map((c) => c.type);
      expect(types.filter((t) => /^SB_DFF/.test(t)).length).toBeGreaterThan(0);
      expect(types.filter((t) => t === 'SB_LUT4').length).toBeGreaterThan(0);
    } finally {
      run.done();
    }
  });
});
