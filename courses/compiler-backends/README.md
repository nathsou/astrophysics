# SSA to Silicon

An interactive course on compiler backends, built around **kiln**: a real compiler backend, written in TypeScript, that runs in the browser. It takes a small SSA IR down to RISC-V, AArch64, x86-64 and WebAssembly machine code.

```bash
npm install
npm run dev        # the course, at http://localhost:5173
npm test           # 277 differential tests (IR interpreter vs emulator vs Wasm engine)
npm run build      # typecheck (TypeScript 7) + production build into dist/
```

## What is in it

- **23 chapters and 8 appendices** (`src/content`, MDX) covering:
  - the IR and lowering, CFGs, dominance, SSA construction, clean-up passes;
  - targets, instruction selection, legalization, calling conventions;
  - SSA destruction, liveness, graph colouring (iterated register coalescing), linear scan, spilling, stack frames;
  - scheduling, peephole optimisation, encoding, object files and relocations, linking;
  - WebAssembly.
- **More than 30 interactive widgets** (`src/viz`), most with step-by-step replay:
  - CFG and DFS stepper, Cooper–Harvey–Kennedy dominators, dominance frontiers;
  - mem2reg phi placement and renaming;
  - BURS tree tiling with its DP tables;
  - constant materialisation, the ABI explorer;
  - parallel-copy sequentialisation;
  - liveness fixpoint and live intervals;
  - IRC on the interference graph, linear scan, spill explorer;
  - frame layout and prologue stepping;
  - list scheduling with pipeline timelines;
  - peephole diffs;
  - an instruction encoder with bit-field diagrams, and branch relaxation;
  - an ELF hex explorer, the linker's relocation trace, and an RV64 emulator;
  - Wasm structured control flow, a 5-stage pipeline simulator.
- **A playground** (`#/playground`) exposing every stage and option: target, optimisation level, allocator, register count, scheduler, peepholes, ISA extensions. It can download `.s`, `.o`, a static RISC-V Linux `a.out`, or `.wasm`.
- **Hover everything.** Every IR and assembly token explains itself: opcode semantics, register roles, why the compiler emitted an instruction, and the source line it came from.

## The compiler (`src/compiler`, ~9k lines)

| stage | files |
|---|---|
| front end: Kiln → KIR | `frontend/parser.ts`, `frontend/lower.ts` |
| IR, printer, verifier, reference interpreter | `ir/` |
| DFS/RPO, dominators (CHK), frontiers, loops | `analysis/` |
| mem2reg, instcombine-style folding, DCE, SimplifyCFG, CSE, if-conversion | `opt/` |
| targets: registers, ABI, legalization, BURS grammars, frame lowering, peepholes | `target/riscv.ts`, `target/aarch64.ts`, `target/x86_64.ts` |
| instruction selection (tree tiling), machine IR, SSA destruction, liveness, scheduling | `codegen/` |
| iterated register coalescing, linear scan, spilling/rematerialisation | `regalloc/` |
| RISC-V assembler/encoder/disassembler, AArch64 and x86-64 encoders | `emit/` |
| ELF writer/reader, static linker, runtime library (RISC-V assembly) | `obj/` |
| RV64IM(+Zba, Zicond) emulator with Linux syscalls | `sim/rv64.ts` |
| WebAssembly backend (Beyond-Relooper structuring, stackification, binary) | `wasm/wasm.ts` |

## Validation against real toolchains

The `scripts/` directory checks kiln against external tools. Paths default to Homebrew locations; override them with `RISCV_BINUTILS`, `LLVM_BIN`, `LLD` and `UNICORN_PYTHON`.

```bash
npx tsx scripts/validate-rv64.ts             # .text identical to riscv64-elf-as; readelf-clean; GNU ld-linked runs
npx tsx scripts/validate-encoders.ts         # AArch64 / x86-64 bytes and relocations identical to llvm-mc
npx tsx scripts/validate-aarch64-native.ts   # Apple Silicon: run AArch64 output natively
npx tsx scripts/validate-emulated.ts x86_64  # run x86-64 (or aarch64) executables under Unicorn
```

The linked RISC-V executables use real Linux system calls, so they also run under `qemu-riscv64`.
