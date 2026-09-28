// The pipeline explorer: edit a program, watch it flow through every stage.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { exampleById, EXAMPLES } from '../examples';
import { printModule } from '../compiler/ir/print';
import { printMFunc } from '../compiler/codegen/printmir';
import type { Line } from '../compiler/listing';
import type { CompileResult, FuncStages, PipelineOptions } from '../compiler/pipeline';
import type { MFunc } from '../compiler/codegen/mir';
import { lowerModule, runWasm } from '../compiler/wasm/wasm';
import { parseElf } from '../compiler/obj/elf';
import { CodeView } from '../ui/CodeView';
import { Editor } from '../ui/Editor';
import { Seg, Select } from '../ui/controls';
import { useCompile, useDebounced } from '../ui/useCompile';
import { GraphView } from './Graph';
import { irCFG, mirCFG } from './cfgdata';
import { listingLines } from './asmtok';

export type StageId = 'ir' | 'ssa' | 'opt' | 'legal' | 'isel' | 'destroy' | 'sched' | 'ra' | 'frame' | 'asm' | 'mc' | 'obj' | 'run' | 'wat' | 'wasmbin';
export type TargetSel = 'rv64' | 'aarch64' | 'x86_64' | 'wasm';

interface StageDef {
  id: StageId;
  label: string;
  hint: string;
  mir?: (f: FuncStages) => MFunc | undefined;
  post?: boolean;
  ir?: (r: CompileResult) => import('../compiler/ir/ir').Module | undefined;
}

export const NATIVE_STAGES: StageDef[] = [
  { id: 'ir', label: 'IR', hint: 'KIR straight out of the front end: every variable in a stack slot', ir: (r) => r.lowered },
  { id: 'ssa', label: 'SSA', hint: 'after mem2reg: stack slots promoted to SSA values and phis', ir: (r) => r.ssa },
  { id: 'opt', label: 'Optimised', hint: 'after folding, DCE, CFG simplification, CSE, if-conversion', ir: (r) => r.optimized },
  { id: 'legal', label: 'Legalised', hint: 'IR rewritten into operations the target can select', ir: (r) => r.legalized },
  { id: 'isel', label: 'ISel', hint: 'machine IR in SSA form: target instructions over virtual registers', mir: (f) => f.isel },
  { id: 'destroy', label: 'Out of SSA', hint: 'phis replaced by copies on incoming edges', mir: (f) => f.ssaDestroyed },
  { id: 'sched', label: 'Scheduled', hint: 'list-scheduled for an in-order dual-issue core', mir: (f) => f.scheduled },
  { id: 'ra', label: 'Allocated', hint: 'virtual registers mapped to physical ones; spill code inserted', mir: (f) => f.allocated, post: true },
  { id: 'frame', label: 'Frame', hint: 'prologue/epilogue inserted, stack slots resolved to sp offsets', mir: (f) => f.framed, post: true },
  { id: 'asm', label: 'Assembly', hint: 'after peephole optimisation: the final assembly' },
  { id: 'mc', label: 'Machine code', hint: 'encoded bytes, with pseudo-instructions expanded and relocations noted' },
  { id: 'obj', label: 'Object file', hint: 'the ELF relocatable object: sections, symbols, relocations' },
  { id: 'run', label: 'Run', hint: 'linked with the runtime and executed' },
];

export const WASM_STAGES: StageDef[] = [
  NATIVE_STAGES[0], NATIVE_STAGES[1], NATIVE_STAGES[2],
  { id: 'wat', label: 'WebAssembly', hint: 'structured control flow, stackified expressions (WAT text format)' },
  { id: 'wasmbin', label: 'Wasm binary', hint: 'the binary module, section by section' },
  { id: 'run', label: 'Run', hint: 'instantiated and executed by your browser’s Wasm engine' },
];

export function mirStageLines(r: CompileResult, get: (f: FuncStages) => MFunc | undefined, post: boolean): Line[] {
  const out: Line[] = [];
  r.funcs.forEach((fs, k) => {
    const f = get(fs);
    if (!f) return;
    if (k) out.push({ kind: 'blank', toks: [] });
    out.push(...printMFunc(f, { post }));
  });
  return out;
}

function ObjSummary({ r }: { r: CompileResult }) {
  const elf = useMemo(() => (r.objBytes ? parseElf(r.objBytes) : undefined), [r.objBytes]);
  if (!elf) return <div className="output-box muted">No object file for this target.</div>;
  return (
    <div className="scroll-y" style={{ padding: '4px 0' }}>
      <table className="dtable">
        <thead><tr><th>#</th><th>section</th><th>type</th><th>flags</th><th>size</th></tr></thead>
        <tbody>{elf.sections.slice(1).map((s) => <tr key={s.index}><td>{s.index}</td><td>{s.name}</td><td>{s.typeName}</td><td>{`${s.flags & 2 ? 'A' : ''}${s.flags & 1 ? 'W' : ''}${s.flags & 4 ? 'X' : ''}`}</td><td>{s.size}</td></tr>)}</tbody>
      </table>
      <table className="dtable" style={{ marginTop: 10 }}>
        <thead><tr><th>symbol</th><th>bind</th><th>type</th><th>section</th><th>value</th><th>size</th></tr></thead>
        <tbody>{elf.symbols.slice(1).map((s) => <tr key={s.index}><td>{s.name}</td><td>{s.bind}</td><td>{s.type}</td><td>{s.section}</td><td>0x{s.value.toString(16)}</td><td>{s.size}</td></tr>)}</tbody>
      </table>
      <table className="dtable" style={{ marginTop: 10 }}>
        <thead><tr><th>relocation</th><th>offset</th><th>symbol</th><th>addend</th></tr></thead>
        <tbody>{elf.relocs.map((x, i) => <tr key={i}><td>{x.typeName}</td><td>{x.target}+0x{x.offset.toString(16)}</td><td>{x.symName}</td><td>{String(x.addend)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

export function RunPanel({ r, target, wasmOut }: { r: CompileResult; target: TargetSel; wasmOut?: { output: string; exitCode: bigint; error?: string } | null }) {
  const ref = r.interp;
  const actual = target === 'wasm' ? wasmOut : target === 'rv64' ? r.emu : undefined;
  const match = actual && ref && !actual.error && actual.output === ref.output;
  return (
    <div className="scroll-y" style={{ fontFamily: 'var(--sans)', fontSize: 13 }}>
      <div className="row" style={{ padding: '10px 14px 4px' }}>
        <b>{target === 'wasm' ? 'WebAssembly (your browser)' : target === 'rv64' ? 'RISC-V emulator' : 'Reference IR interpreter'}</b>
        {actual && (match ? <span className="badge ok">✓ matches the IR interpreter</span> : <span className="badge bad">✗ differs from the IR interpreter</span>)}
        {target === 'rv64' && r.emu && <span className="badge">{r.emu.steps.toLocaleString()} instructions executed</span>}
        {target === 'rv64' && r.emu && <span className="badge">max stack {r.emu.maxStackDepth} B</span>}
      </div>
      <div className="output-box" style={{ margin: '6px 14px', borderRadius: 8, border: '1px solid var(--rule)' }}>
        {(actual ?? ref)?.error ? <span className="t-err">{(actual ?? ref)!.error}{'\n'}</span> : null}
        {(actual ?? ref)?.output || <span className="muted">(no output)</span>}
        <span className="muted">{`\n[exit code ${(actual ?? ref)?.exitCode ?? '?'}]`}</span>
      </div>
      {target !== 'rv64' && target !== 'wasm' && (
        <p className="muted" style={{ padding: '0 14px', fontSize: 12.5 }}>
          The course executes RISC-V (in an emulator) and WebAssembly (natively in the browser). The {target === 'x86_64' ? 'x86-64' : 'AArch64'} backend’s output is validated offline: it is assembled with LLVM, linked, and run on real hardware or a CPU emulator against the same interpreter.
        </p>
      )}
      {ref?.warnings.length ? <p style={{ padding: '0 14px' }} className="badge warn">{ref.warnings[0]}</p> : null}
    </div>
  );
}

export interface PipelineProps {
  example?: string;
  src?: string;
  stage?: StageId;
  target?: TargetSel;
  opt?: 0 | 1 | 2;
  height?: number;
  stages?: StageId[];
  editable?: boolean;
  compactOptions?: boolean;
  options?: Partial<PipelineOptions>;
  children?: ReactNode;
}

export function PipelineExplorer({ example = 'fib', src: srcProp, stage: stage0 = 'asm', target: target0 = 'rv64', opt: opt0 = 2, height = 440, stages, editable = true, options }: PipelineProps) {
  const [src, setSrc] = useState(srcProp ?? exampleById(example).src);
  const dsrc = useDebounced(src, 220);
  const [target, setTarget] = useState<TargetSel>(target0);
  const [opt, setOpt] = useState<0 | 1 | 2>(opt0);
  const [stage, setStage] = useState<StageId>(stage0);
  const [mode, setMode] = useState<'text' | 'cfg'>('text');
  const [fnSel, setFnSel] = useState<string>('');
  const r = useCompile(dsrc, { ...options, target: target === 'wasm' ? 'rv64' : target, opt, run: target === 'rv64' || target === 'wasm', asmOnly: target === 'wasm' });
  const wasm = useMemo(() => (target === 'wasm' && r.optimized ? safe(() => lowerModule(r.optimized!)) : undefined), [target, r.optimized]);
  const [wasmOut, setWasmOut] = useState<{ output: string; exitCode: bigint; error?: string } | null>(null);
  useEffect(() => {
    if (!wasm || 'error' in wasm) { setWasmOut(null); return; }
    let live = true;
    runWasm(wasm.bytes).then((o) => live && setWasmOut(o));
    return () => { live = false; };
  }, [wasm]);

  const defs = (target === 'wasm' ? WASM_STAGES : NATIVE_STAGES).filter((s) => !stages || stages.includes(s.id));
  const def = defs.find((d) => d.id === stage) ?? defs[defs.length - 1];
  const fnNames = r.optimized?.funcs.map((f) => f.name) ?? [];
  const fn = fnNames.includes(fnSel) ? fnSel : fnNames[0];
  const canCFG = !!(def.ir || def.mir);

  const body = <StageView r={r} def={def} mode={mode} fn={fn} target={target} height={height} wasm={wasm} wasmOut={wasmOut} />;

  return (
    <div className="pipe" style={{ minHeight: height + 90 }}>
      <div className="pipe-left">
        <div className="pane-head">
          <span>Kiln source</span>
          <span className="spacer" />
          <Select value={EXAMPLES.find((e) => e.src === src)?.id ?? ''} options={[['', 'examples…'], ...EXAMPLES.map((e) => [e.id, e.title] as [string, string])]} onChange={(id) => id && setSrc(exampleById(id).src)} />
        </div>
        {editable ? <Editor value={src} onChange={setSrc} error={r.error?.line ? r.error : null} minHeight={height} /> : <pre className="code inv" style={{ margin: 0, padding: 12 }}>{src}</pre>}
        {r.error && <div className="error-box">{r.error.line ? `line ${r.error.line}: ` : ''}{r.error.msg}</div>}
      </div>
      <div className="pipe-right">
        <div className="figure-head" style={{ gap: 8 }}>
          <Seg value={target} onChange={setTarget} options={[['rv64', 'RISC-V'], ['aarch64', 'AArch64'], ['x86_64', 'x86-64'], ['wasm', 'Wasm']]} />
          <Seg value={opt} onChange={setOpt} options={[[0, '-O0'], [1, '-O1'], [2, '-O2']]} />
          {canCFG && <Seg value={mode} onChange={setMode} options={[['text', 'Text'], ['cfg', 'CFG']]} />}
          {canCFG && mode === 'cfg' && fnNames.length > 1 && <Select value={fn ?? ''} options={fnNames.map((n) => [n, `@${n}`] as [string, string])} onChange={setFnSel} />}
        </div>
        <div className="stage-tabs" role="tablist">
          {defs.map((d, k) => (
            <span key={d.id} style={{ display: 'contents' }}>
              {k > 0 && <span className="stage-arrow">›</span>}
              <button className={`stage-tab ${d.id === def.id ? 'on' : ''}`} onClick={() => setStage(d.id)} title={d.hint} role="tab" aria-selected={d.id === def.id}>
                <span className="n">{k + 1}</span>{d.label}
              </button>
            </span>
          ))}
        </div>
        <div className="muted sans" style={{ fontSize: 12, padding: '6px 12px', borderBottom: '1px solid var(--rule)' }}>{def.hint}</div>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{body}</div>
      </div>
    </div>
  );
}


export type WasmState = ReturnType<typeof lowerModule> | { error: string } | undefined;

export function StageView({ r, def, mode, fn, target, height, wasm, wasmOut }: { r: CompileResult; def: StageDef; mode: 'text' | 'cfg'; fn?: string; target: TargetSel; height: number; wasm: WasmState; wasmOut: { output: string; exitCode: bigint; error?: string } | null }) {
  const canCFG = !!(def.ir || def.mir);
  let body: ReactNode = null;
  if (!r.ok && r.error && (!def.ir || !def.ir(r))) {
    body = <div className="error-box">{r.error.stage}: {r.error.line ? `line ${r.error.line}: ` : ''}{r.error.msg}</div>;
  } else if (mode === 'cfg' && canCFG) {
    let g: ReturnType<typeof irCFG> | undefined;
    if (def.ir) { const m = def.ir(r); const f = m?.funcs.find((x) => x.name === fn); if (f) g = irCFG(f); }
    else { const fs = r.funcs.find((x) => x.name === fn); const mf = fs && def.mir!(fs); if (mf) g = mirCFG(mf, { post: def.post }); }
    body = g ? <GraphView nodes={g.nodes} edges={g.edges} target={target} maxHeight={height} /> : <div className="output-box muted">Not available.</div>;
  } else if (def.ir) {
    const m = def.ir(r);
    body = m ? <CodeView lines={printModule(m)} gutter="num" notes maxHeight={height} target={target} /> : null;
  } else if (def.mir) {
    body = r.funcs.length ? <CodeView lines={mirStageLines(r, def.mir, !!def.post)} notes maxHeight={height} target={target} empty={<div className="muted" style={{ padding: 12 }}>Stage disabled.</div>} /> : null;
  } else if (def.id === 'asm') {
    body = <CodeView lines={r.asm} notes maxHeight={height} target={target} />;
  } else if (def.id === 'mc') {
    body = r.obj ? <CodeView lines={listingLines(r.obj, target)} gutter="addr" bytes notes maxHeight={height} target={target} /> : null;
  } else if (def.id === 'obj') {
    body = <div style={{ maxHeight: height, overflow: 'auto' }}><ObjSummary r={r} /></div>;
  } else if (def.id === 'run') {
    body = <RunPanel r={r} target={target} wasmOut={wasmOut} />;
  } else if (def.id === 'wat') {
    body = wasm && !('error' in wasm) ? <CodeView lines={wasm.wat} notes maxHeight={height} target="wasm" /> : <div className="error-box">{wasm && 'error' in wasm ? wasm.error : ''}</div>;
  } else if (def.id === 'wasmbin') {
    body = wasm && !('error' in wasm) ? <WasmHex bytes={wasm.bytes} height={height} /> : null;
  }

  return <>{body}</>;
}

export function safe<T>(f: () => T): T | { error: string } {
  try { return f(); } catch (e) { return { error: (e as Error).message }; }
}

export function WasmHex({ bytes, height }: { bytes: Uint8Array; height?: number }) {
  const rows: string[] = [];
  for (let i = 0; i < bytes.length; i += 16) {
    rows.push(`${i.toString(16).padStart(6, '0')}  ${[...bytes.subarray(i, i + 16)].map((b) => b.toString(16).padStart(2, '0')).join(' ')}`);
  }
  const names: Record<number, string> = { 1: 'type', 2: 'import', 3: 'function', 5: 'memory', 6: 'global', 7: 'export', 10: 'code', 11: 'data' };
  const secs: { id: number; off: number; size: number }[] = [];
  for (let p = 8; p < bytes.length; ) {
    const id = bytes[p];
    let size = 0, shift = 0, q = p + 1;
    for (;;) { const b = bytes[q++]; size |= (b & 0x7f) << shift; shift += 7; if (!(b & 0x80)) break; }
    secs.push({ id, off: p, size });
    p = q + size;
  }
  return (
    <div style={{ maxHeight: height, overflow: 'auto' }}>
      <div className="row" style={{ padding: '8px 12px', gap: 6 }}>
        <span className="pill">magic \0asm</span><span className="pill">version 1</span>
        {secs.map((s) => <span key={s.off} className="pill accent">{names[s.id] ?? `#${s.id}`} · {s.size} B</span>)}
        <span className="badge">{bytes.length} bytes total</span>
      </div>
      <pre className="code inv" style={{ margin: 0, padding: '8px 14px' }}>{rows.join('\n')}</pre>
    </div>
  );
}
