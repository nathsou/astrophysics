/**
 * Boundary scan on a board with two vCPLD-32s and eight nets between them, driven through the course's real JTAG
 * code (`CpldJtag`, `JtagHost`, `JtagBoard` in src/lib/pld/cpld/jtag.ts).
 *
 * The interconnect test never touches the chips' logic. With EXTEST, chip U1's boundary cells drive a pattern onto
 * pins 0–7; with SAMPLE, chip U2's boundary cells capture what arrived on pins 16–23. A net that does not deliver
 * what was sent is broken: a walking one and a walking zero show every net high and low.
 */
import { CpldJtag, JtagBoard, JtagHost, type NetFault } from '$lib/pld/cpld/jtag';
import type { Level } from '$lib/pld/devices/vcpld32-arch';
import { IDCODE_VALUE } from '$lib/pld/cpld/jtag';

export const NETS = 8;
export const SEND_PIN0 = 0;
export const RECV_PIN0 = 16;

export type Fault = 'ok' | NetFault;
export const FAULTS: readonly Fault[] = ['ok', 'open', 'stuck0', 'stuck1'];
export const FAULT_TEXT: Record<Fault, string> = { ok: 'good', open: 'open (broken joint)', stuck0: 'stuck low (shorted to ground)', stuck1: 'stuck high (shorted to supply)' };

export interface ScanStep {
  /** What U1 drove onto nets 0–7. */
  sent: Level[];
  /** What U2 captured from the same nets. */
  seen: Level[];
  label: string;
}

export type Verdict = 'ok' | 'always 0' | 'always 1' | 'wrong';

export interface ScanResult {
  steps: ScanStep[];
  verdicts: Verdict[];
  /** Nets that failed. */
  bad: number[];
  /** TCK cycles spent on both chips' test access ports. */
  cycles: number;
  idcodes: [number, number];
}

export function runInterconnectTest(faults: Partial<Record<number, Fault>> = {}): ScanResult {
  const u1 = new CpldJtag();
  const u2 = new CpldJtag();
  const board = new JtagBoard();
  for (let k = 0; k < NETS; k++) {
    const f = faults[k];
    board.connect(`N${k}`, { chip: u1, pin: SEND_PIN0 + k }, { chip: u2, pin: RECV_PIN0 + k }, f && f !== 'ok' ? f : undefined);
  }
  const h1 = new JtagHost(u1, { trace: false });
  const h2 = new JtagHost(u2, { trace: false });
  const idcodes: [number, number] = [h1.readIdcode(), h2.readIdcode()];
  const steps: ScanStep[] = [];
  for (const idle of [0, 1] as const) {
    for (let k = 0; k < NETS; k++) {
      const drive: (Level | undefined)[] = new Array<Level | undefined>(32).fill(undefined);
      const sent: Level[] = [];
      for (let j = 0; j < NETS; j++) {
        const v = (j === k ? 1 - idle : idle) as Level;
        drive[SEND_PIN0 + j] = v;
        sent.push(v);
      }
      h1.extest(drive);
      const cells = h2.sample();
      steps.push({ sent, seen: Array.from({ length: NETS }, (_, j) => cells.input[RECV_PIN0 + j]!), label: idle === 0 ? `walking 1, net ${k}` : `walking 0, net ${k}` });
    }
  }
  const verdicts: Verdict[] = Array.from({ length: NETS }, (_, j) => {
    const wrong = steps.filter((s) => s.seen[j] !== s.sent[j]);
    if (wrong.length === 0) return 'ok';
    const seen = new Set(steps.map((s) => s.seen[j]));
    if (seen.size === 1) return seen.has(0) ? 'always 0' : 'always 1';
    return 'wrong';
  });
  return { steps, verdicts, bad: verdicts.flatMap((v, j) => (v === 'ok' ? [] : [j])), cycles: h1.cycles + h2.cycles, idcodes };
}

export const idcodeHex = (v: number): string => v.toString(16).toUpperCase().padStart(8, '0');
export { IDCODE_VALUE };
