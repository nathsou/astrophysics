/**
 * A recorded JTAG programming session for the vCPLD-32: the whole sequence (reset, IDCODE, ISC_ENABLE,
 * ISC_ERASE, ISC_PROGRAM row by row, ISC_VERIFY, ISC_DISABLE, USERCODE) run on a `JtagHost` with a
 * per-TCK trace, ready to be stepped through by the TAP animation.
 */
import { CpldJtag, JtagHost, PROGRAM_CYCLES, type JtagCycle } from '../pld/cpld/jtag';
import { BIT_COUNT, ROW_COUNT, getRow } from '../pld/devices/vcpld32-arch';

export interface JtagMark {
  cycle: number;
  label: string;
  /** The configuration row being programmed, for ISC_PROGRAM marks. */
  row?: number;
}

export interface JtagSession {
  cycles: JtagCycle[];
  marks: JtagMark[];
  idcode: number;
  usercode: number;
  ok: boolean;
  mismatches: number;
  rowsProgrammed: number;
  /** The rows that were written, in order. */
  rows: number[];
  /** The mark in force at a cycle. */
  markAt(cycle: number): JtagMark | undefined;
  /** Index into `marks` of the mark in force at a cycle. */
  markIndexAt(cycle: number): number;
  /** Rows completely programmed by a cycle, and the row being shifted (or -1). */
  progress(cycle: number): { done: number; current: number };
}

export function programOverJtag(bits: ArrayLike<number>, opts: { skipBlank?: boolean } = {}): JtagSession {
  if (bits.length !== BIT_COUNT) throw new Error(`A vCPLD-32 has ${BIT_COUNT} configuration bits`);
  const skipBlank = opts.skipBlank ?? true;
  const tap = new CpldJtag();
  const host = new JtagHost(tap, { traceLimit: 500000 });
  host.mark('Reset the TAP: five cycles with TMS = 1, then to Run-Test/Idle');
  host.reset();
  host.mark('Read IDCODE: reset selects it, then 32 bits shift out of TDO');
  const idcode = host.readIdcode();
  host.mark('ISC_ENABLE: enter programming mode (all pins off, flip-flops frozen)');
  host.enableIsc();
  host.mark('ISC_ERASE: bulk erase, the device is busy for eight idle cycles');
  host.erase();
  host.mark('ISC_PROGRAM: load the instruction');
  host.loadInstruction('ISC_PROGRAM');
  const rows: number[] = [];
  const rowMarks: JtagMark[] = [];
  for (let row = 0; row < ROW_COUNT; row++) {
    const data = getRow(bits, row);
    if (skipBlank && !data.some((b) => b)) continue;
    host.mark(`ISC_PROGRAM: row ${row} (64 data bits, then its 8-bit address)`);
    rowMarks.push({ cycle: host.cycles, label: '', row });
    host.shiftDr(JtagHost.rowScan(row, data));
    host.idle(PROGRAM_CYCLES);
    rows.push(row);
  }
  host.mark('ISC_VERIFY: read every row back and compare');
  const verify = host.verify(bits);
  host.mark('Read the status bits of the instruction register');
  host.readStatus();
  host.mark('ISC_DISABLE: leave programming mode; the device restarts from its new configuration');
  host.disableIsc();
  host.mark('USERCODE: read the 32-bit user signature');
  const usercode = host.readUsercode();
  host.mark('Done');
  host.clock(1);
  host.clock(0);

  const marks: JtagMark[] = host.marks.map((m) => {
    const r = /row (\d+)/.exec(m.label);
    return { cycle: m.cycle, label: m.label, row: r && m.label.startsWith('ISC_PROGRAM: row') ? Number(r[1]) : undefined };
  });
  const cycles = host.trace.slice();
  const markIndexAt = (cycle: number): number => {
    let lo = 0;
    let hi = marks.length - 1;
    let ans = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (marks[mid]!.cycle <= cycle) {
        ans = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return ans;
  };
  const rowMarkList = marks.filter((m) => m.row !== undefined);
  return {
    cycles,
    marks,
    idcode,
    usercode,
    ok: verify.ok,
    mismatches: verify.mismatches.length,
    rowsProgrammed: rows.length,
    rows,
    markAt: (c) => marks[markIndexAt(c)],
    markIndexAt,
    progress(cycle) {
      // A row counts as done PROGRAM_CYCLES + 80 cycles after its mark; approximate by the next row's mark.
      let done = 0;
      let current = -1;
      for (let i = 0; i < rowMarkList.length; i++) {
        const m = rowMarkList[i]!;
        const next = rowMarkList[i + 1]?.cycle ?? marks.find((x) => x.label.startsWith('ISC_VERIFY'))?.cycle ?? Infinity;
        if (cycle >= next) done = i + 1;
        else if (cycle >= m.cycle) current = m.row!;
      }
      return { done, current };
    },
  };
}
