// The whole compiler, stage by stage. Each stage's output is snapshotted so
// the course can show (and diff) every intermediate form.

import { CompileError, type Program } from './frontend/ast';
import { parse } from './frontend/parser';
import { lowerProgram } from './frontend/lower';
import { cloneModule, type Module } from './ir/ir';
import { verifyModule } from './ir/verify';
import { runModule, type RunResult } from './ir/interp';
import { mem2reg, type Mem2RegTrace } from './opt/mem2reg';
import { combine, cse, dce } from './opt/combine';
import { simplifyCFG, type PassLog } from './opt/simplifycfg';
import { selectFunction, type SelTree } from './codegen/isel';
import { cloneMFunc, type MFunc } from './codegen/mir';
import { destroySSA, type DestroyTrace } from './codegen/ssadestroy';
import { scheduleFunction, type SchedResult } from './codegen/sched';
import { allocateRegisters, type RAAlgo, type RAResult } from './regalloc/allocate';
import { runPeepholes, type PeepholeLog } from './codegen/peephole';
import { computeLoopDepth } from './codegen/mcfg';
import { printGlobalsAsm, printMFunc } from './codegen/printmir';
import type { Line } from './listing';
import { makeTarget } from './target/registry';
import type { Target, TargetName, TargetOptions } from './target/target';
import { emitModule, type ObjectCode } from './emit/emit';
import { linkObjects, type LinkResult } from './obj/link';
import { runtimeObject } from './obj/runtime';
import { writeElfObject } from './obj/elf';
import { runExecutable, type EmuResult } from './sim/rv64';

export interface PipelineOptions extends TargetOptions {
  target: TargetName;
  opt: 0 | 1 | 2;
  regalloc: RAAlgo;
  coalesce: boolean;
  sched: 'none' | 'pre' | 'post';
  peephole: boolean;
  pruned: boolean;
  remat: boolean;
  /** stop after producing assembly (skip emission/link/run) */
  asmOnly?: boolean;
  run?: boolean;
}

export const DEFAULT_OPTIONS: PipelineOptions = {
  target: 'rv64', opt: 2, regalloc: 'irc', coalesce: true, sched: 'pre', peephole: true, pruned: true, remat: true,
  mExt: true, zba: false, zicond: false, framePointer: false, run: true,
};

export interface FuncStages {
  name: string;
  isel: MFunc;
  trees: SelTree[];
  ssaDestroyed: MFunc;
  destroy: DestroyTrace;
  scheduled?: MFunc;
  sched?: SchedResult;
  ra: RAResult;
  allocated: MFunc;
  framed: MFunc;
  peephole: PeepholeLog[];
  final: MFunc;
}

export interface CompileResult {
  ok: boolean;
  error?: { msg: string; line?: number; col?: number; stage: string };
  opts: PipelineOptions;
  target?: Target;
  ast?: Program;
  lowered?: Module;
  ssa?: Module;
  optimized?: Module;
  legalized?: Module;
  mem2reg: Record<string, Mem2RegTrace>;
  optLog: string[];
  legalizeLog: string[];
  funcs: FuncStages[];
  asm: Line[];
  obj?: ObjectCode;
  objBytes?: Uint8Array;
  link?: LinkResult;
  interp?: RunResult;
  emu?: EmuResult;
  timings: Record<string, number>;
}

export function compile(source: string, o: Partial<PipelineOptions> = {}): CompileResult {
  const opts: PipelineOptions = { ...DEFAULT_OPTIONS, ...o };
  const res: CompileResult = { ok: false, opts, mem2reg: {}, optLog: [], legalizeLog: [], funcs: [], asm: [], timings: {} };
  let stage = 'parse';
  const time = <T>(name: string, f: () => T): T => {
    stage = name;
    const t0 = performance.now();
    const r = f();
    res.timings[name] = performance.now() - t0;
    return r;
  };
  try {
    res.ast = time('parse', () => parse(source));
    const lowered = time('lower', () => lowerProgram(res.ast!, source));
    verifyModule(lowered, false);
    res.lowered = cloneModule(lowered);

    // ---- SSA construction
    const m = lowered;
    if (opts.opt >= 1) {
      time('mem2reg', () => {
        for (const f of m.funcs) res.mem2reg[f.name] = mem2reg(f, { pruned: opts.pruned });
      });
      verifyModule(m);
    }
    res.ssa = cloneModule(m);

    // ---- mid-level clean-up
    if (opts.opt >= 1) {
      time('optimize', () => {
        const log: PassLog = { msgs: [] };
        for (const f of m.funcs) {
          for (let round = 0; round < 6; round++) {
            let ch = combine(f, log);
            ch = dce(f, log) || ch;
            ch = simplifyCFG(f, { ifConvert: opts.opt >= 2 }, log) || ch;
            if (opts.opt >= 2) ch = cse(f, log) || ch;
            if (!ch) break;
          }
        }
        res.optLog = log.msgs;
      });
      verifyModule(m);
    }
    res.optimized = cloneModule(m);
    if (opts.run !== false) res.interp = time('interpret', () => runModule(res.optimized!));

    // ---- target
    const t = makeTarget(opts.target, opts);
    res.target = t;
    time('legalize', () => {
      const log = { msgs: [] as string[] };
      for (const f of m.funcs) t.legalize(m, f, log);
      res.legalizeLog = log.msgs;
    });
    verifyModule(m, opts.opt >= 1);
    res.legalized = cloneModule(m);

    // ---- per-function machine pipeline
    for (const f of m.funcs) {
      const { mf, trees } = time('isel', () => selectFunction(f, t));
      computeLoopDepth(mf);
      const isel = cloneMFunc(mf);
      const destroy = time('ssa-destroy', () => destroySSA(mf, t));
      const ssaDestroyed = cloneMFunc(mf);
      let sched: SchedResult | undefined, scheduled: MFunc | undefined;
      if (opts.sched === 'pre') {
        sched = time('schedule', () => scheduleFunction(mf, t, 'pre'));
        scheduled = cloneMFunc(mf);
      }
      const ra = time('regalloc', () => allocateRegisters(mf, t, opts.regalloc, { coalesce: opts.coalesce, remat: opts.remat }));
      const allocated = cloneMFunc(mf);
      time('frame', () => { t.expandPostRA(mf); t.lowerFrame(mf); });
      const framed = cloneMFunc(mf);
      if (opts.sched === 'post') {
        sched = time('schedule', () => scheduleFunction(mf, t, 'post'));
        scheduled = cloneMFunc(mf);
      }
      const peephole = opts.peephole ? time('peephole', () => runPeepholes(mf, t)) : [];
      if (!opts.peephole) {
        // still drop jumps to the fall-through block: every assembler-level backend does this
        const jt = t.peepholes.find((p) => p.name === 'jump-to-next');
        if (jt) runPeepholesSubset(mf, t, jt.name);
      }
      res.funcs.push({ name: f.name, isel, trees, ssaDestroyed, destroy, scheduled, sched, ra, allocated, framed, peephole, final: mf });
    }
    res.asm = time('asm', () => {
      const out: Line[] = [];
      res.funcs.forEach((fs, k) => {
        if (k) out.push({ kind: 'blank', toks: [] });
        out.push(...printMFunc(fs.final, { asm: true, post: true }));
      });
      const g = printGlobalsAsm(m, t);
      if (g.length) out.push({ kind: 'blank', toks: [] }, ...g);
      return out;
    });
    if (!opts.asmOnly) {
      res.obj = time('emit', () => emitModule(t, res.funcs.map((x) => x.final), m));
      if (res.obj) {
        res.objBytes = time('elf', () => writeElfObject(res.obj!));
        if (t.name === 'rv64') {
          res.link = time('link', () => linkObjects([{ name: 'program.o', bytes: res.objBytes! }, { name: 'runtime.o', bytes: runtimeObject() }]));
          if (opts.run !== false) res.emu = time('run', () => runExecutable(res.link!.exe));
        }
      }
    }
    res.ok = true;
  } catch (e) {
    if (e instanceof CompileError) res.error = { msg: e.message.replace(/^\d+:\d+: /, ''), line: e.pos.line, col: e.pos.col, stage: e.stage };
    else res.error = { msg: (e as Error).message, stage };
    if (!(e instanceof CompileError) && (globalThis as { process?: { env?: Record<string, string> } }).process?.env?.KILN_DEBUG) console.error(e);
  }
  return res;
}

function runPeepholesSubset(f: MFunc, t: Target, name: string) {
  runPeepholes(f, t, new Set([name]));
}
