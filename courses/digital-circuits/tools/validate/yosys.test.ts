import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Logger, Runner, ToolResult } from './common';
import { courseDesigns, main, parseParts, type YosysReport } from './yosys';
import {
  classifyNextpnrFailure,
  comparePorts,
  limitingFmax,
  parseNextpnrLog,
  parseNextpnrReport,
  parseYosysStat,
  summariseCells,
} from './yosys-report';

// Fixtures written from the formats of Yosys 0.3x-0.5x and nextpnr 0.4-0.7. They have not been compared with
// a real installation (none was available when they were written): a change in a tool's output shows up as
// the warning "no SB_ cells found" or as missing figures in the report, not as a wrong number.
const STAT_OLD = `
15. Printing statistics.

=== Counter ===

   Number of wires:                 24
   Number of wire bits:             48
   Number of public wires:           6
   Number of memories:               0
   Number of cells:                 20
     SB_CARRY                        3
     SB_DFF                          2
     SB_DFFESR                       2
     SB_LUT4                        13

`;
const STAT_NEW = `
=== Counter ===

        20 cells
         3   SB_CARRY
         2   SB_DFF
         2   SB_DFFESR
        13   SB_LUT4
`;
const STAT_HIERARCHY = `
=== Sub ===
   Number of cells:                  1
     SB_LUT4                         1

=== design hierarchy ===

   Number of cells:                  6
     SB_LUT4                         5
     SB_RAM40_4K                     1
`;
const NEXTPNR_LOG = `
Info: Device utilisation:
Info: 	         ICESTORM_LC:    27/ 5280     0%
Info: 	        ICESTORM_RAM:     1/   30     3%
Info: 	               SB_IO:     5/   96     5%

Info: Max frequency for clock 'clk$SB_IO_IN_$glb_clk': 187.30 MHz (PASS at 12.00 MHz)
Info: Max frequency for clock 'clk$SB_IO_IN_$glb_clk': 201.55 MHz (PASS at 12.00 MHz)
Info: Max frequency for clock 'slow$SB_IO_IN_$glb_clk': 250.00 MHz (PASS at 12.00 MHz)
`;
const NEXTPNR_REPORT = {
  utilization: { ICESTORM_LC: { available: 5280, used: 27 }, ICESTORM_RAM: { available: 30, used: 1 } },
  fmax: { 'clk$SB_IO_IN_$glb_clk': { achieved: 201.55, constraint: 12 }, 'slow$SB_IO_IN_$glb_clk': { achieved: 250, constraint: 12 } },
  critical_paths: [],
};

describe('Yosys statistics', () => {
  it('reads both layouts of the cell list', () => {
    const want = { SB_CARRY: 3, SB_DFF: 2, SB_DFFESR: 2, SB_LUT4: 13 };
    expect(parseYosysStat(STAT_OLD)).toEqual(want);
    expect(parseYosysStat(STAT_NEW)).toEqual(want);
  });

  it('takes the last report, the design hierarchy', () => {
    expect(parseYosysStat(STAT_HIERARCHY)).toEqual({ SB_LUT4: 5, SB_RAM40_4K: 1 });
  });

  it('summarises the cells', () => {
    expect(summariseCells(parseYosysStat(STAT_OLD))).toEqual({ luts: 13, carries: 3, flipFlops: 4, brams: 0, dsps: 0, cells: { SB_CARRY: 3, SB_DFF: 2, SB_DFFESR: 2, SB_LUT4: 13 } });
    expect(summariseCells({}).luts).toBe(0);
  });
});

describe('nextpnr output', () => {
  it('reads the report JSON: the slowest clock limits', () => {
    const r = parseNextpnrReport(NEXTPNR_REPORT);
    expect(r.utilisation.ICESTORM_LC).toEqual({ used: 27, available: 5280 });
    expect(r.fmax).toEqual({ clk: { achievedMHz: 201.55, constraintMHz: 12 }, slow: { achievedMHz: 250, constraintMHz: 12 } });
    expect(limitingFmax(r)).toEqual({ clock: 'clk', achievedMHz: 201.55 });
  });

  it('reads the log, keeping the last frequency of a clock', () => {
    const r = parseNextpnrLog(NEXTPNR_LOG);
    expect(r.utilisation).toEqual({ ICESTORM_LC: { used: 27, available: 5280 }, ICESTORM_RAM: { used: 1, available: 30 }, SB_IO: { used: 5, available: 96 } });
    expect(r.fmax.clk).toEqual({ achievedMHz: 201.55, constraintMHz: 12 });
    expect(limitingFmax(r)?.clock).toBe('clk');
  });

  it('has no fmax without a clock', () => {
    expect(limitingFmax(parseNextpnrReport({ utilization: {}, fmax: {} }))).toBeNull();
    expect(limitingFmax(parseNextpnrLog(''))).toBeNull();
  });

  it('tells a design that does not fit from a failure', () => {
    const io = "Info: Packing IOs..\nERROR: Unable to place cell 'a[3]$sb_io', no BELs remaining to implement cell type 'SB_IO'\n";
    expect(classifyNextpnrFailure(io)).toEqual({ kind: 'io', message: "Unable to place cell 'a[3]$sb_io', no BELs remaining to implement cell type 'SB_IO'" });
    expect(classifyNextpnrFailure("ERROR: Unable to place cell 'x', no BELs remaining to implement cell type 'ICESTORM_LC'").kind).toBe('logic');
    expect(classifyNextpnrFailure("ERROR: Unable to place cell 'x', no BELs remaining to implement cell type 'ICESTORM_RAM'").kind).toBe('ram');
    expect(classifyNextpnrFailure('ERROR: Combinational loop detected').kind).toBe('other');
    expect(classifyNextpnrFailure('segmentation fault').message).toBe('segmentation fault');
  });
});

describe('ports', () => {
  const ours = { creator: 'x', modules: { T: { attributes: {}, cells: {}, netnames: {}, ports: { a: { direction: 'input' as const, bits: [2, 3] }, y: { direction: 'output' as const, bits: [4] } } } } };
  it('are compared by name, direction and width', () => {
    expect(comparePorts(ours, structuredClone(ours), 'T')).toEqual([]);
    const other = structuredClone(ours);
    other.modules.T.ports.a.bits = [2];
    delete (other.modules.T.ports as Record<string, unknown>).y;
    (other.modules.T.ports as Record<string, unknown>).z = { direction: 'output', bits: [9] };
    const p = comparePorts(ours, other, 'T').join('\n');
    expect(p).toMatch(/port a has 2 bits here and 1/);
    expect(p).toMatch(/port y is missing/);
    expect(p).toMatch(/extra port z/);
    expect(comparePorts(ours, {}, 'T')).toEqual(["Yosys's netlist has no module T"]);
  });
});

describe('parts', () => {
  it('parses device:package pairs', () => {
    expect(parseParts('up5k:sg48, hx8k:ct256')).toEqual([
      { device: 'up5k', package: 'sg48', id: 'up5k-sg48' },
      { device: 'hx8k', package: 'ct256', id: 'hx8k-ct256' },
    ]);
    expect(() => parseParts('up5k')).toThrow(/device:package/);
    expect(() => parseParts('xc7:fg')).toThrow(/bad part/);
  });
});

describe('the course designs', () => {
  const designs = courseDesigns();
  it('are found with their tops', () => {
    const byName = Object.fromEntries(designs.map((d) => [d.name, d]));
    expect(byName.counter).toMatchObject({ file: 'content/designs/counter.dcl', top: 'Counter' });
    expect(byName.traffic_light ?? byName['traffic-light']).toMatchObject({ top: 'TrafficLight' });
    expect(byName.alu).toMatchObject({ top: 'Alu' });
    expect(byName.regfile).toMatchObject({ top: 'RegFile' });
    expect(byName.rv32i).toMatchObject({ top: 'riscv32' });
    // The reference designs all export; a chapter's fragment of a design may not stand alone.
    for (const d of designs.filter((x) => x.file.startsWith('content/designs/'))) expect(d.problem, d.file).toBeUndefined();
  });

  it('say why a design cannot be exported', () => {
    for (const d of designs.filter((x) => x.problem)) expect(d.problem, d.file).toMatch(/top|does not check/);
  });

  it('complete a chapter design that uses the RV32I core with the core', () => {
    const board = designs.find((d) => d.name === 'rv32-board');
    if (!board) return; // Chapter 31's design is written by another agent.
    expect(board.problem).toBeUndefined();
    expect(board.top).toBe('Rv32Board');
    expect(board.source).toContain('module riscv32(');
    expect(board.source).not.toContain('top module riscv32(');
  });
});

// ------------------------------------------------------------------------------------------ the script

const collect = (): Logger & { lines: string[] } => {
  const lines: string[] = [];
  return { lines, log: (l) => void lines.push(l), error: (l) => void lines.push(l) };
};

interface FakeOptions {
  yosysStatus?: number;
  /** Rename an output port in Yosys's netlist. */
  breakPorts?: boolean;
  nextpnr?: (args: string[]) => ToolResult | undefined;
}

/** Stand-ins for yosys and nextpnr-ice40 that read and write the files the script names. */
function fakeTools(o: FakeOptions = {}): Runner & { calls: string[][] } {
  const calls: string[][] = [];
  const run = ((command: string, args: string[]): ToolResult => {
    calls.push(['tool', ...args]);
    if (args[0] === '-V') return { status: 0, stdout: 'Yosys 0.40 (git sha1 deadbeef, clang 15)\n', stderr: '' };
    if (args[0] === '--version') return { status: 0, stdout: 'nextpnr-ice40 -- Next Generation Place and Route (Version nextpnr-0.7)\n', stderr: '' };
    if (args[0] === '-p') {
      if (o.yosysStatus) return { status: o.yosysStatus, stdout: '', stderr: 'ERROR: Module `\\Foo` referenced in module `\\Bar` is not part of the design.\n' };
      const script = args[1]!;
      const input = /read_json (\S+);/.exec(script)![1]!;
      const output = /-json (\S+);/.exec(script)![1]!;
      const json = JSON.parse(readFileSync(input, 'utf8')) as { modules: Record<string, { ports: Record<string, unknown> }> };
      if (o.breakPorts) for (const m of Object.values(json.modules)) for (const p of Object.keys(m.ports)) if (p !== 'clk') { m.ports[`${p}_renamed`] = m.ports[p]; delete m.ports[p]; break; }
      writeFileSync(output, JSON.stringify(json));
      return { status: 0, stdout: `${STAT_NEW}\n`, stderr: '' };
    }
    const custom = o.nextpnr?.(args);
    if (custom) return custom;
    writeFileSync(args[args.indexOf('--report') + 1]!, JSON.stringify(NEXTPNR_REPORT));
    return { status: 0, stdout: '', stderr: '' };
  }) as Runner & { calls: string[][] };
  run.calls = calls;
  return run;
}

// Any executable file will do as a tool path; the fake runner never starts it.
const withTools = (extra: NodeJS.ProcessEnv = {}) => ({ PATH: '', YOSYS: process.execPath, NEXTPNR: process.execPath, ...extra });
const newOut = () => path.join(mkdtempSync(path.join(tmpdir(), 'validate-yosys-test-')), 'report.json');

describe('validate:yosys', () => {
  const some = courseDesigns().filter((d) => ['counter', 'alu'].includes(d.name));

  it('skips, saying what to install and what to set, when Yosys is missing', async () => {
    const log = collect();
    expect(await main({ env: { PATH: '' }, log, run: fakeTools() })).toBe(0);
    expect(log.lines).toHaveLength(1);
    expect(log.lines[0]).toMatch(/^skipped: yosys not found — install .* or set YOSYS=/);
  });

  it('runs Yosys and nextpnr on each design and writes the report', async () => {
    const log = collect();
    const run = fakeTools();
    const out = newOut();
    expect(await main({ env: withTools(), log, run, designs: some, args: ['--out', out] })).toBe(0);
    const report = JSON.parse(readFileSync(out, 'utf8')) as YosysReport;
    expect(report.tools.yosys).toBe('Yosys 0.40 (git sha1 deadbeef, clang 15)');
    expect(report.tools.nextpnr).toMatch(/nextpnr-0\.7/);
    expect(report.parameters).toEqual({ targetMHz: 12, seed: 1, parts: ['up5k-sg48', 'hx8k-ct256'] });
    expect(report.designs.map((d) => [d.design, d.top, d.status])).toEqual([['alu', 'Alu', 'ok'], ['counter', 'Counter', 'ok']]);
    const counter = report.designs[1]!;
    expect(counter.yosys).toMatchObject({ luts: 13, carries: 3, flipFlops: 4, brams: 0 });
    expect(counter.netlist!.modules).toBe(1);
    expect(counter.parts!['up5k-sg48']).toEqual({
      status: 'ok', fmaxMHz: 201.55, clock: 'clk', targetMHz: 12,
      utilisation: { ICESTORM_LC: { used: 27, available: 5280 }, ICESTORM_RAM: { used: 1, available: 30 } },
    });
    // The command lines.
    const synth = run.calls.find((c) => c[1] === '-p' && c[2]!.includes('counter'))!;
    expect(synth[2]).toMatch(/^read_json \S+counter\.json; synth_ice40 -top Counter -json \S+counter\.synth\.json; stat$/);
    const pnr = run.calls.find((c) => c.includes('--up5k') && c.join(' ').includes('counter.synth'))!;
    expect(pnr.join(' ')).toMatch(/--up5k --package sg48 --json \S+counter\.synth\.json --freq 12 --seed 1 --report \S+ --log \S+/);
    expect(log.lines.at(-1)).toMatch(/^validate:yosys: 2 of 2 designs went through; report in /);
  });

  it('takes parts, frequency, seed and designs from the arguments', async () => {
    const run = fakeTools();
    const out = newOut();
    expect(await main({ env: withTools({ ICE40_FREQ: '50' }), log: collect(), run, designs: some, args: ['--out', out, '--parts', 'hx1k:tq144', '--only', 'counter', '--seed=7'] })).toBe(0);
    const report = JSON.parse(readFileSync(out, 'utf8')) as YosysReport;
    expect(report.parameters).toEqual({ targetMHz: 50, seed: 7, parts: ['hx1k-tq144'] });
    expect(report.designs.map((d) => d.design)).toEqual(['counter']);
    expect(run.calls.some((c) => c.includes('--hx1k') && c.includes('tq144') && c.includes('--freq') && c.includes('50') && c.includes('7'))).toBe(true);
  });

  it('runs Yosys alone, and says so, when nextpnr is missing', async () => {
    const log = collect();
    const out = newOut();
    expect(await main({ env: withTools({ NEXTPNR: undefined, PATH: '' }), log, run: fakeTools(), designs: some, args: ['--out', out] })).toBe(0);
    expect(log.lines.some((l) => /^skipped: nextpnr-ice40 not found — install .* or set NEXTPNR=/.test(l))).toBe(true);
    const report = JSON.parse(readFileSync(out, 'utf8')) as YosysReport;
    expect(report.tools.nextpnr).toBeNull();
    expect(report.designs[0]!.parts!['up5k-sg48']!.status).toBe('skipped');
    expect(report.designs[0]!.yosys!.luts).toBe(13);
  });

  it('records a design that does not fit a part, without failing', async () => {
    const log = collect();
    const out = newOut();
    const run = fakeTools({ nextpnr: (args) => (args.includes('--up5k') ? { status: 1, stdout: '', stderr: "ERROR: Unable to place cell 'q[1]$sb_io', no BELs remaining to implement cell type 'SB_IO'\n" } : undefined) });
    expect(await main({ env: withTools(), log, run, designs: some, args: ['--out', out] })).toBe(0);
    const report = JSON.parse(readFileSync(out, 'utf8')) as YosysReport;
    expect(report.designs[0]!.status).toBe('ok');
    expect(report.designs[0]!.parts!['up5k-sg48']).toMatchObject({ status: 'does-not-fit' });
    expect(report.designs[0]!.parts!['hx8k-ct256']).toMatchObject({ status: 'ok' });
  });

  it('exits 1 when nextpnr fails for another reason', async () => {
    const run = fakeTools({ nextpnr: () => ({ status: 1, stdout: '', stderr: 'ERROR: Combinational loop detected\n' }) });
    const log = collect();
    expect(await main({ env: withTools(), log, run, designs: some, args: ['--out', newOut()] })).toBe(1);
    expect(log.lines.join('\n')).toMatch(/FAIL .*nextpnr failed on up5k-sg48: Combinational loop detected/);
  });

  it('exits 1 when Yosys rejects the netlist', async () => {
    const log = collect();
    expect(await main({ env: withTools(), log, run: fakeTools({ yosysStatus: 1 }), designs: some, args: ['--out', newOut()] })).toBe(1);
    expect(log.lines.join('\n')).toMatch(/Yosys rejected the netlist: ERROR: Module/);
    expect(log.lines.at(-1)).toMatch(/2 FAILED/);
  });

  it('exits 1 when Yosys changes the ports', async () => {
    const log = collect();
    expect(await main({ env: withTools(), log, run: fakeTools({ breakPorts: true }), designs: some, args: ['--out', newOut()] })).toBe(1);
    expect(log.lines.join('\n')).toMatch(/Yosys changed the ports: .*_renamed/);
  });

  it('exits 2 on bad arguments and 1 on a tool variable that names nothing', async () => {
    const log = collect();
    expect(await main({ env: withTools(), log, args: ['--parts', 'nonsense'] })).toBe(2);
    expect(await main({ env: withTools(), log, args: ['stray'] })).toBe(2);
    expect(await main({ env: { PATH: '', YOSYS: '/no/such/yosys' }, log })).toBe(1);
  });
});
