/**
 * Parsers for what Yosys and nextpnr print, and the checks on their results, for `validate:yosys`. The
 * formats are those of Yosys 0.3x to 0.5x (`stat`) and nextpnr 0.4 to 0.7 (`--report` JSON, and the log).
 * They are separate from the script so that tests can run them on fixtures.
 */
import type { YosysJson } from '../../src/lib/pld/interchange/types';

export type CellCounts = Record<string, number>;

/**
 * The cells of the last `stat` report in a Yosys log. Two layouts exist: `SB_LUT4      13` (older) and
 * `13   SB_LUT4` (newer). Only cells of the iCE40 library (`SB_…`) are counted.
 */
export function parseYosysStat(log: string): CellCounts {
  const lines = log.split(/\r?\n/);
  // The report that ends the log: after the last "=== name ===" header (the design hierarchy totals, or the top).
  let start = 0;
  lines.forEach((l, i) => {
    if (/^\s*={3}\s.*\s={3}\s*$/.test(l)) start = i;
  });
  const out: CellCounts = {};
  for (const l of lines.slice(start)) {
    const m = /^\s*(SB_[A-Z0-9_]+)\s+(\d+)\s*$/.exec(l) ?? /^\s*(\d+)\s+(SB_[A-Z0-9_]+)\s*$/.exec(l);
    if (!m) continue;
    const [name, count] = /^\d/.test(m[1]!) ? [m[2]!, Number(m[1])] : [m[1]!, Number(m[2])];
    out[name] = (out[name] ?? 0) + count;
  }
  return out;
}

export interface YosysUtilisation {
  /** SB_LUT4 */
  luts: number;
  /** SB_CARRY */
  carries: number;
  /** Every SB_DFF variant. */
  flipFlops: number;
  /** SB_RAM40_4K */
  brams: number;
  /** SB_MAC16 */
  dsps: number;
  cells: CellCounts;
}

export function summariseCells(cells: CellCounts): YosysUtilisation {
  let ffs = 0;
  for (const [n, c] of Object.entries(cells)) if (/^SB_DFF/.test(n)) ffs += c;
  return { luts: cells.SB_LUT4 ?? 0, carries: cells.SB_CARRY ?? 0, flipFlops: ffs, brams: cells.SB_RAM40_4K ?? 0, dsps: cells.SB_MAC16 ?? 0, cells };
}

export interface ResourceUse {
  used: number;
  available: number;
}

export interface NextpnrResult {
  /** Per clock: the achieved maximum frequency and the constraint, in MHz. */
  fmax: Record<string, { achievedMHz: number; constraintMHz: number | null }>;
  utilisation: Record<string, ResourceUse>;
  /** The clock domains the design's timing paths mention (besides `<async>`), by clock name; may have no fmax. */
  domains: string[];
}

/** The clock's own name from nextpnr's net name (`clk$SB_IO_IN_$glb_clk` is `clk`). */
const clockName = (net: string) => net.replace(/\$.*$/, '') || net;

/** The `--report` JSON: `{ fmax: { <clock>: { achieved, constraint } }, utilization: { <type>: { available, used } } }`. */
export function parseNextpnrReport(json: unknown): NextpnrResult {
  const out: NextpnrResult = { fmax: {}, utilisation: {}, domains: [] };
  const r = json as { critical_paths?: { from?: string; to?: string }[]; fmax?: Record<string, { achieved?: number; constraint?: number }>; utilization?: Record<string, { available?: number; used?: number }> };
  for (const [clock, v] of Object.entries(r.fmax ?? {})) {
    if (typeof v.achieved !== 'number') continue;
    const name = clockName(clock);
    const previous = out.fmax[name];
    // Several nets of one clock domain: the slowest limits the design.
    if (!previous || v.achieved < previous.achievedMHz) out.fmax[name] = { achievedMHz: v.achieved, constraintMHz: typeof v.constraint === 'number' ? v.constraint : null };
  }
  const domains = new Set<string>();
  for (const p of r.critical_paths ?? []) for (const d of [p.from, p.to]) if (typeof d === 'string' && d !== '<async>') domains.add(clockName(d.replace(/^(posedge|negedge)\s+/, '')));
  out.domains = [...domains];
  for (const [type, v] of Object.entries(r.utilization ?? {})) if (typeof v.used === 'number' && typeof v.available === 'number') out.utilisation[type] = { used: v.used, available: v.available };
  return out;
}

/** The same from nextpnr's log (older versions, or when `--report` is missing). */
export function parseNextpnrLog(log: string): NextpnrResult {
  const out: NextpnrResult = { fmax: {}, utilisation: {}, domains: [] };
  for (const l of log.split(/\r?\n/)) {
    const u = /^Info:\s+([A-Z][A-Z0-9_]*):\s+(\d+)\s*\/\s*(\d+)\s+\d+%\s*$/.exec(l);
    if (u) {
      out.utilisation[u[1]!] = { used: Number(u[2]), available: Number(u[3]) };
      continue;
    }
    const f = /^Info: Max frequency for clock\s+'([^']+)':\s+([\d.]+) MHz(?: \((?:PASS|FAIL) at ([\d.]+) MHz\))?/.exec(l);
    if (f) {
      const name = clockName(f[1]!);
      const achieved = Number(f[2]);
      // The last report of a clock is the final one (nextpnr prints one after placement and one after routing).
      out.fmax[name] = { achievedMHz: achieved, constraintMHz: f[3] === undefined ? null : Number(f[3]) };
    }
  }
  return out;
}

/** The slowest clock: the design's fmax, or null when it has no clock. */
export function limitingFmax(r: NextpnrResult): { clock: string; achievedMHz: number } | null {
  let best: { clock: string; achievedMHz: number } | null = null;
  for (const [clock, v] of Object.entries(r.fmax)) if (!best || v.achievedMHz < best.achievedMHz) best = { clock, achievedMHz: v.achievedMHz };
  return best;
}

export type NextpnrFailure = { kind: 'io' | 'logic' | 'ram' | 'dsp' | 'other'; message: string };

const KIND_OF_RESOURCE: Record<string, NextpnrFailure['kind']> = { SB_IO: 'io', ICESTORM_LC: 'logic', ICESTORM_RAM: 'ram', ICESTORM_DSP: 'dsp' };

/**
 * Why nextpnr stopped. A design that needs more of some resource than the part has (most often pads, for a
 * design with wide ports) does not fit the part: that says nothing about the netlist. Anything else is a failure.
 *
 * nextpnr 0.11 (the current one) stops with `Unable to find a placement location for cell 'b[31]$sb_io'` after a
 * utilisation table that shows `SB_IO: 101/ 39 258%`; older versions said `no BELs remaining to implement cell
 * type 'SB_IO'`. The message alone can name a cell of any type, so the table decides as well: a resource used
 * beyond what the part has is the reason, whatever the message says.
 */
export function classifyNextpnrFailure(output: string): NextpnrFailure {
  const errors = output.split(/\r?\n/).filter((l) => /^ERROR:|^Error:/.test(l));
  const message = errors[0]?.replace(/^(ERROR|Error):\s*/, '') ?? output.trim().split('\n').pop() ?? 'nextpnr failed';
  const no = /no BELs remaining to implement cell type '(\w+)'/.exec(output);
  if (no) return { kind: KIND_OF_RESOURCE[no[1]!] ?? 'other', message };
  // A pad cell that cannot be placed (its name ends in `$sb_io`, as Yosys names the SB_IO it inserts for a port).
  if (/Unable to find a placement location for cell '[^']*\$sb_io'/i.test(output) || /too many (IO|I\/O)|not enough (IO|pads)|Unable to place .*SB_IO/i.test(output)) return { kind: 'io', message };
  for (const [type, u] of Object.entries(parseNextpnrLog(output).utilisation)) if (u.used > u.available && KIND_OF_RESOURCE[type]) return { kind: KIND_OF_RESOURCE[type]!, message };
  return { kind: 'other', message };
}

/** Problems with the ports of the netlist Yosys wrote, compared with the one the course wrote. */
export function comparePorts(ours: YosysJson, theirs: unknown, top: string): string[] {
  const a = ours.modules[top]?.ports;
  const t = (theirs as YosysJson | undefined)?.modules?.[top]?.ports;
  if (!a) return [`the course's netlist has no module ${top}`];
  if (!t) return [`Yosys's netlist has no module ${top}`];
  const problems: string[] = [];
  for (const [name, p] of Object.entries(a)) {
    const q = t[name];
    if (!q) problems.push(`port ${name} is missing from Yosys's netlist`);
    else {
      if (q.direction !== p.direction) problems.push(`port ${name} is an ${p.direction} here and an ${q.direction} in Yosys's netlist`);
      if (q.bits.length !== p.bits.length) problems.push(`port ${name} has ${p.bits.length} bits here and ${q.bits.length} in Yosys's netlist`);
    }
  }
  for (const name of Object.keys(t)) if (!(name in a)) problems.push(`Yosys's netlist has an extra port ${name}`);
  return problems;
}
