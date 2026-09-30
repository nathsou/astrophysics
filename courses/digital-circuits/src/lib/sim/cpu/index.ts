/**
 * The course's two CPUs as software: instruction-set specifications, assemblers, disassemblers,
 * reference interpreters (the engines behind turbo mode and the oracle for differential tests),
 * demo programs and random-program generators.
 *
 *  - `octet`: the 8-bit teaching CPU of Part V.
 *  - `rv32i`: the RISC-V base ISA of Chapter 31, on the same virtual board.
 *
 * Each has its own `compareStates` and `randomProgram`; import them from the namespace you need.
 */
export * as octet from './octet';
export * as rv32i from './rv32i';
export { VirtualBoard, lfsr8, lfsr32, compareOutputs, type BoardHooks, type BoardOutputs } from './common/board';
export { Prng } from './common/prng';
export { formatDiagnostics, type Diagnostic } from './common/asm';
