// The Kiln runtime library, written in RISC-V assembly and assembled by our
// own assembler. It provides the program entry point and the functions the
// compiler calls: print_int, putchar, and the libgcc-style helpers used when
// the M extension is disabled. System calls use the Linux RISC-V ABI
// (a7 = number, a0.. = args, ecall), so linked executables also run under
// qemu-riscv64 or on real RISC-V Linux.

import { assembleRV, parseRVAsm } from '../emit/rv64asm';
import { writeElfObject } from './elf';
import type { ObjectCode } from '../emit/objcode';

export const RUNTIME_ASM = `# Kiln runtime for RV64 Linux
    .text
    .globl _start
    .type _start, @function
_start:
    call main              # a0 = main()
    li a7, 93              # exit(a0)
    ecall

# putchar(c): write(1, &c, 1)
    .globl putchar
    .type putchar, @function
putchar:
    addi sp, sp, -16
    sd a0, 0(sp)
    li a0, 1               # fd = stdout
    mv a1, sp              # buf = &c (little-endian: low byte first)
    li a2, 1               # count
    li a7, 64              # SYS_write
    ecall
    li a0, 0
    addi sp, sp, 16
    ret

# print_int(x): decimal digits + newline, built backwards in a stack buffer
    .globl print_int
    .type print_int, @function
print_int:
    addi sp, sp, -48
    addi t0, sp, 40        # t0 = end of buffer
    li t1, 10
    sb t1, 0(t0)           # trailing newline
    mv t2, a0              # t2 = |x| (as unsigned, so INT64_MIN works)
    bgez a0, .Lpos
    neg t2, a0
.Lpos:
    li t3, 10
.Ldigit:
    remu t4, t2, t3
    divu t2, t2, t3
    addi t4, t4, 48        # '0' + digit
    addi t0, t0, -1
    sb t4, 0(t0)
    bnez t2, .Ldigit
    bgez a0, .Lwrite
    li t4, 45              # '-'
    addi t0, t0, -1
    sb t4, 0(t0)
.Lwrite:
    addi a2, sp, 41
    sub a2, a2, t0         # length
    mv a1, t0
    li a0, 1
    li a7, 64              # SYS_write
    ecall
    li a0, 0
    addi sp, sp, 48
    ret

# __muldi3(a, b): shift-and-add multiply, for RV64I without the M extension
    .globl __muldi3
    .type __muldi3, @function
__muldi3:
    mv t0, a0
    li a0, 0
.Lmul:
    andi t1, a1, 1
    beqz t1, .Lmulskip
    add a0, a0, t0
.Lmulskip:
    slli t0, t0, 1
    srli a1, a1, 1
    bnez a1, .Lmul
    ret

# __udivmoddi4-style restoring division: a0 = n, a1 = d -> a0 = q, a1 = r (unsigned)
    .type __kiln_udivmod, @function
__kiln_udivmod:
    li t0, 0               # quotient
    li t1, 0               # remainder
    li t2, 64
.Ludloop:
    slli t1, t1, 1
    srli t3, a0, 63
    or t1, t1, t3
    slli a0, a0, 1
    slli t0, t0, 1
    bltu t1, a1, .Ludskip
    sub t1, t1, a1
    ori t0, t0, 1
.Ludskip:
    addi t2, t2, -1
    bnez t2, .Ludloop
    mv a0, t0
    mv a1, t1
    ret

# __divdi3(a, b): signed division via unsigned division of magnitudes
    .globl __divdi3
    .type __divdi3, @function
__divdi3:
    addi sp, sp, -16
    sd ra, 8(sp)
    xor t5, a0, a1         # sign of the quotient
    sd t5, 0(sp)
    bgez a0, .Ld1
    neg a0, a0
.Ld1:
    bgez a1, .Ld2
    neg a1, a1
.Ld2:
    call __kiln_udivmod
    ld t5, 0(sp)
    bgez t5, .Ld3
    neg a0, a0
.Ld3:
    ld ra, 8(sp)
    addi sp, sp, 16
    ret

# __moddi3(a, b): signed remainder (sign follows the dividend)
    .globl __moddi3
    .type __moddi3, @function
__moddi3:
    addi sp, sp, -16
    sd ra, 8(sp)
    sd a0, 0(sp)
    bgez a0, .Lm1
    neg a0, a0
.Lm1:
    bgez a1, .Lm2
    neg a1, a1
.Lm2:
    call __kiln_udivmod
    mv a0, a1
    ld t5, 0(sp)
    bgez t5, .Lm3
    neg a0, a0
.Lm3:
    ld ra, 8(sp)
    addi sp, sp, 16
    ret
`;

let cached: { obj: ObjectCode; bytes: Uint8Array } | undefined;

export function runtimeObjectCode(): ObjectCode {
  if (!cached) {
    const obj = assembleRV(parseRVAsm(RUNTIME_ASM));
    cached = { obj, bytes: writeElfObject(obj, 'runtime.s') };
  }
  return cached.obj;
}

export function runtimeObject(): Uint8Array {
  runtimeObjectCode();
  return cached!.bytes;
}
