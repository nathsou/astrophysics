/**
 * Every code block of the chapter that carries `from="path"` is an excerpt of that file, line for line (a line that is only
 * `…` or `// …` stands for lines left out). Every `asm` block is solvable (its solution passes every test and its start
 * does not) and its solution also runs on Octet in DCL. The diff of the challenge is applied to octet.dcl and works.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { describe, expect, test } from 'vitest';
import { checkAsm, type AsmInput } from '$lib/components/exercise/asm/run';
import { check, createRtlSim, elaborate } from '$lib/hdl';
import { OctetMachine, assembleOrThrow } from '$lib/sim/cpu/octet';
import { octetSource, withProgram } from './widgets/octet-dcl';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const md = readFileSync(new URL('./index.md', import.meta.url), 'utf8');

interface Block {
  lang: string;
  meta: string;
  code: string;
  line: number;
}
const blocks: Block[] = [];
for (const m of md.matchAll(/^```(\w+)([^\n]*)\n([\s\S]*?)\n```$/gm)) blocks.push({ lang: m[1]!, meta: m[2]!.trim(), code: m[3]!, line: md.slice(0, m.index).split('\n').length });

const from = (b: Block) => /from="([^"]+)"/.exec(b.meta)?.[1];

describe('excerpts', () => {
  const excerpts = blocks.filter((b) => from(b));
  test('the chapter quotes real code', () => {
    expect(excerpts.length).toBeGreaterThanOrEqual(10);
    expect(new Set(excerpts.map(from)).size).toBeGreaterThanOrEqual(5);
  });
  for (const b of excerpts) {
    test(`line ${b.line}: is in ${from(b)}`, () => {
      const path = existsSync(root + from(b)!) ? root + from(b)! : fileURLToPath(new URL(from(b)!, import.meta.url));
      const file = readFileSync(path, 'utf8');
      const parts = b.code.split(/\n\s*(?:\/\/ )?…\s*\n/);
      for (const part of parts) expect(file.includes(part), `not in the file:\n${part}`).toBe(true);
    });
  }
});

describe('the asm exercises', () => {
  const asm = blocks.filter((b) => b.lang === 'asm').map((b) => YAML.parse(b.code) as AsmInput);
  test('there are two, for the board', () => expect(asm.map((a) => a.id)).toEqual(['chip/echo', 'chip/nibble-sum']));
  for (const a of asm) {
    test(`${a.id}: the solution passes every test, the start does not`, () => {
      const r = checkAsm(a, a.solution!);
      expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      expect(r.results.filter((x) => !x.pass).map((x) => [x.name, x.failures])).toEqual([]);
      expect(checkAsm(a, a.start!).pass).toBe(false);
      expect(a.tests.length).toBeGreaterThanOrEqual(4);
      expect((a.hints ?? []).length).toBeGreaterThanOrEqual(2);
    });

    test(`${a.id}: the solution runs the same on Octet in DCL, instruction by instruction, for every test's switches and buttons`, () => {
      const program = assembleOrThrow(a.solution!, a.id);
      for (const t of a.tests) {
        const dcl = octetFor(program);
        const ref = new OctetMachine();
        ref.load(program);
        ref.board.switches = t.setup?.switches ?? 0;
        ref.board.buttons = t.setup?.buttons ?? 0;
        dcl.set('sw', t.setup?.switches ?? 0);
        dcl.set('btn', t.setup?.buttons ?? 0);
        for (let i = 0; i < 60; i++) {
          const cycles = ref.step();
          for (let k = 0; k < cycles; k++) dcl.tick();
          expect(dcl.get('led'), `${t.name}, instruction ${i}`).toBe(ref.board.leds);
          expect(Number(dcl.peek('hex')), `${t.name}, instruction ${i}`).toBe(ref.board.hex);
        }
      }
    });
  }
});

function octetFor(program: ReturnType<typeof assembleOrThrow>) {
  const src = withProgram(octetSource, program);
  return createRtlSim(elaborate(check(src, { file: 'octet.dcl' }).program, 'Octet'));
}

describe('the challenge: DEC Rd', () => {
  /** The diff block of the chapter applied to octet.dcl: hunks are separated by `...`; each hunk's old lines (context and `-`) are replaced by its new ones (context and `+`). */
  function patched(): string {
    const diff = blocks.find((b) => b.lang === 'diff')!.code.split('\n');
    const hunks: string[][] = [[]];
    for (const l of diff) l === '...' ? hunks.push([]) : hunks[hunks.length - 1]!.push(l);
    let src = octetSource;
    for (const h of hunks) {
      const old = h.filter((l) => !l.startsWith('+')).map((l) => l.slice(1)).join('\n');
      const now = h.filter((l) => !l.startsWith('-')).map((l) => l.slice(1)).join('\n');
      expect(src.split(old).length - 1, `the hunk must match once: ${old}`).toBe(1);
      src = src.replace(old, () => now);
    }
    return src;
  }

  test('the patched design compiles and DEC subtracts one, with the flags of SUB Rd, 1, for all four registers', () => {
    const src = patched();
    const r = check(src, { file: 'octet.dcl' });
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    for (const [byte, reg] of [[0x01, 0], [0x05, 1], [0x09, 2], [0x0d, 3]] as const) {
      for (const value of [0, 1, 2, 0x7f, 0x80, 0xff, 0x55]) {
        const program = assembleOrThrow(`LDI R${reg}, ${value}\n.byte ${byte}\nHLT\n`);
        const sim = createRtlSim(elaborate(check(withProgram(src, program), { file: 'octet.dcl' }).program, 'Octet'));
        for (let i = 0; i < 5 + 5 + 4; i++) sim.tick();
        const want = (value - 1) & 0xff;
        expect(sim.get(`r[${reg}]`), `DEC R${reg} of ${value}`).toBe(want);
        expect([sim.get('z'), sim.get('c'), sim.get('n'), sim.get('v')]).toEqual([+(want === 0), +(value < 1), want >> 7, +(value === 0x80)]);
        expect(sim.get('halted')).toBe(1);
      }
    }
  });

  test('the other bytes of opcode 0 still halt, and Octet still passes a lockstep run', () => {
    const src = patched();
    for (const byte of [0x00, 0x02, 0x03, 0x04, 0x08, 0x0f]) {
      const sim = createRtlSim(elaborate(check(withProgram(src, assembleOrThrow(`LDI R0, 9\n.byte ${byte}\nLDI R1, 7\nHLT\n`))).program, 'Octet'));
      for (let i = 0; i < 30; i++) sim.tick();
      expect(sim.get('r[1]'), `byte ${byte}`).toBe(0);
      expect(sim.get('halted')).toBe(1);
    }
  });
});
