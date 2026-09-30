/**
 * The RV32I core on the board: the reference core (`content/designs/rv32i.dcl`) with the wrapper of
 * `designs/rv32-board.dcl` around it, and a program in the wrapper's instruction ROM.
 */
import rv32iSource from '../../../designs/rv32i.dcl?raw';
import wrapperSource from '../designs/rv32-board.dcl?raw';
import type { Rv32Program } from '$lib/sim/cpu/rv32i';

export { rv32iSource, wrapperSource };

/** The instruction ROM has one word per value of pc[7:2]: 64 words. */
export const RV32_ROM_WORDS = 64;

const ROM = /^\/\/\/ The program: [^\n]*\nfn program\(word: bits<6>\) -> bits<32> \{\n[\s\S]*?\n\}\n/m;

/** The words of an assembled program (little-endian, as the core reads them). */
export function programWords(program: Rv32Program | ArrayLike<number>): number[] {
  const image = 'image' in program ? program.image : program;
  const words: number[] = [];
  for (let a = 0; a < image.length; a += 4) words.push(((image[a]! | (image[a + 1]! << 8) | (image[a + 2]! << 16) | (image[a + 3]! << 24)) >>> 0));
  return words;
}

/** The wrapper with a program as its ROM (one `match` arm for every non-zero word). */
export function withRom(wrapper: string, words: number[]): string {
  if (words.length > RV32_ROM_WORDS) throw new Error(`the ROM holds ${RV32_ROM_WORDS} words, the program has ${words.length}`);
  const arms = words.map((w, i) => (w === 0 ? '' : `    ${i} => 0x${w.toString(16).padStart(8, '0')},\n`)).join('');
  const rom = `/// The program: one instruction per word, from address 0. A word that is not listed is 0, an illegal instruction.\nfn program(word: bits<6>) -> bits<32> {\n  match word {\n    _ => 0,\n${arms}  }\n}\n`;
  if (!ROM.test(wrapper)) throw new Error('rv32-board.dcl has no `fn program` to replace');
  return wrapper.replace(ROM, rom);
}

/** The core's source without its `top` (a design has one), then the wrapper, which is the design's top. */
export function rv32BoardSource(program: Rv32Program | ArrayLike<number>, registers: 'flip-flops' | 'block RAM' = 'flip-flops'): string {
  const plain = rv32iSource.replace('top module riscv32(', 'module riscv32(');
  const core = registers === 'block RAM' ? withBlockRamRegisters(plain) : plain;
  return `${core}\n${withRom(wrapperSource, programWords(program))}`;
}

/** The register file of the core, as the reference design writes it: 32 registers of flip-flops. */
const FLIP_FLOP_REGFILE = /^module RegFile\([\s\S]*?\n\}\n/m;

const BLOCK_RAM_REGFILE = `module RegFile(
  clk: clock,
  rs1_address: bits<5>,
  rs2_address: bits<5>,
  rd_address: bits<5>,
  rd_write: bit,
  rd_value: bits<32>,
) -> (rs1_value: bits<32>, rs2_value: bits<32>) {
  mem x: [bits<32>; 32] = [0; 32]
  x.write(rd_address, rd_value, rd_write && rd_address != 0)
  rs1_value = x.read(rs1_address)
  rs2_value = x.read(rs2_address)
}
`;

/**
 * The core with its register file in block RAM. A block RAM answers one cycle after it is given an address, so the
 * registers are read in the fetch cycle, from the instruction that is arriving, and are ready in the execute
 * cycle: the source's `ir[19:15]` and `ir[24:20]` become `instruction[19:15]` and `instruction[24:20]`.
 */
export function withBlockRamRegisters(core: string): string {
  const a = 'let rs1_address: bits<5> = ir[19:15]';
  const b = 'let rs2_address: bits<5> = ir[24:20]';
  if (!FLIP_FLOP_REGFILE.test(core) || !core.includes(a) || !core.includes(b)) throw new Error('rv32i.dcl is not in the shape that withBlockRamRegisters expects');
  return core.replace(FLIP_FLOP_REGFILE, BLOCK_RAM_REGFILE).replace(a, 'let rs1_address: bits<5> = instruction[19:15]').replace(b, 'let rs2_address: bits<5> = instruction[24:20]');
}
