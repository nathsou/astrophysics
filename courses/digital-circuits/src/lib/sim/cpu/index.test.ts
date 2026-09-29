import { expect, test } from 'vitest';
import { octet, rv32i } from './index';

test('the barrel exposes both CPUs, each assembling and running a program', () => {
  const o = new octet.OctetMachine().load(octet.assembleOrThrow('LDI R0, 7\nST [HEX], R0\nHLT'));
  o.run();
  expect(o.board.hex).toBe(7);
  const r = new rv32i.Rv32Machine().load(rv32i.assembleOrThrow('li a0, 7\nsw a0, HEX(zero)\nebreak'));
  r.run();
  expect(r.board.hex).toBe(7);
  expect(octet.OCTET_PROGRAMS.map((p) => p.id)).toEqual(rv32i.RV32_PROGRAMS.map((p) => p.id));
  expect(typeof octet.randomProgram).toBe('function');
  expect(typeof rv32i.randomProgram).toBe('function');
  expect(typeof octet.compareStates).toBe('function');
  expect(typeof rv32i.compareStates).toBe('function');
});
