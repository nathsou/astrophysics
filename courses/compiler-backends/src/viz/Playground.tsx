// The playground: every stage, every option, two panes side by side.

import { useEffect, useMemo, useState } from 'react';
import { EXAMPLES, exampleById } from '../examples';
import { lowerModule, runWasm } from '../compiler/wasm/wasm';
import { listingText } from '../compiler/listing';
import type { PipelineOptions } from '../compiler/pipeline';
import { Editor } from '../ui/Editor';
import { Check, Select, Seg } from '../ui/controls';
import { persist, persisted } from '../ui/store';
import { ThemeToggle } from '../ui/ThemeToggle';
import { useCompile, useDebounced } from '../ui/useCompile';
import { NATIVE_STAGES, RunPanel, StageView, WASM_STAGES, safe, type StageId, type TargetSel } from './Pipeline';

interface Settings {
  target: TargetSel;
  opt: 0 | 1 | 2;
  regalloc: 'irc' | 'linear';
  coalesce: boolean;
  sched: 'none' | 'pre' | 'post';
  peephole: boolean;
  remat: boolean;
  framePointer: boolean;
  mExt: boolean;
  zba: boolean;
  zicond: boolean;
  maxRegs: number;
  left: StageId;
  right: StageId;
  leftMode: 'text' | 'cfg';
  rightMode: 'text' | 'cfg';
}

const DEFAULTS: Settings = {
  target: 'rv64', opt: 2, regalloc: 'irc', coalesce: true, sched: 'pre', peephole: true, remat: true, framePointer: false,
  mExt: true, zba: false, zicond: false, maxRegs: 0, left: 'opt', right: 'asm', leftMode: 'text', rightMode: 'text',
};

function download(name: string, data: Uint8Array | string, type = 'application/octet-stream') {
  const blob = new Blob([typeof data === 'string' ? data : new Uint8Array(data)], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Playground() {
  const [src, setSrc] = useState<string>(() => persisted('pg.src', exampleById('collatz').src));
  const [st, setSt] = useState<Settings>(() => ({ ...DEFAULTS, ...persisted<Partial<Settings>>('pg.settings', {}) }));
  const [fnSel, setFnSel] = useState('');
  useEffect(() => persist('pg.src', src), [src]);
  useEffect(() => persist('pg.settings', st), [st]);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setSt((s) => ({ ...s, [k]: v }));
  const dsrc = useDebounced(src, 250);
  const opts: Partial<PipelineOptions> = {
    target: st.target === 'wasm' ? 'rv64' : st.target, opt: st.opt, regalloc: st.regalloc, coalesce: st.coalesce, sched: st.sched,
    peephole: st.peephole, remat: st.remat, framePointer: st.framePointer, mExt: st.mExt, zba: st.zba, zicond: st.zicond,
    maxRegs: st.maxRegs || undefined, run: st.target === 'rv64' || st.target === 'wasm', asmOnly: st.target === 'wasm',
  };
  const r = useCompile(dsrc, opts);
  const wasm = useMemo(() => (st.target === 'wasm' && r.optimized ? safe(() => lowerModule(r.optimized!)) : undefined), [st.target, r.optimized]);
  const [wasmOut, setWasmOut] = useState<{ output: string; exitCode: bigint; error?: string } | null>(null);
  useEffect(() => {
    if (!wasm || 'error' in wasm) { setWasmOut(null); return; }
    let live = true;
    runWasm(wasm.bytes).then((o) => live && setWasmOut(o));
    return () => { live = false; };
  }, [wasm]);
  const defs = st.target === 'wasm' ? WASM_STAGES : NATIVE_STAGES;
  const fnNames = r.optimized?.funcs.map((f) => f.name) ?? [];
  const fn = fnNames.includes(fnSel) ? fnSel : fnNames[0];
  const pane = (which: 'left' | 'right') => {
    const id = st[which];
    const def = defs.find((d) => d.id === id) ?? defs[which === 'left' ? 0 : defs.length - 1];
    const mode = st[which === 'left' ? 'leftMode' : 'rightMode'];
    const canCFG = !!(def.ir || def.mir);
    return (
      <div className="pane" style={{ minHeight: 0 }}>
        <div className="pane-head" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 12.5 }}>
          <Select value={def.id} options={defs.map((d, k) => [d.id, `${k + 1}. ${d.label}`] as [StageId, string])} onChange={(v) => set(which, v)} />
          {canCFG && <Seg value={mode} onChange={(v) => set(which === 'left' ? 'leftMode' : 'rightMode', v)} options={[['text', 'text'], ['cfg', 'CFG']]} />}
          <span className="spacer" />
          <span className="muted" style={{ fontWeight: 400 }}>{def.hint}</span>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          <StageView r={r} def={def} mode={mode} fn={fn} target={st.target} height={4000} wasm={wasm} wasmOut={wasmOut} />
        </div>
      </div>
    );
  };
  const native = st.target !== 'wasm';
  return (
    <div className="playground">
      <div className="pg-left">
        <div className="pg-toolbar">
          <a href="#/" className="chip-btn" title="back to the course">← course</a>
          <ThemeToggle />
          <span className="label">source</span>
          <Select value={EXAMPLES.find((e) => e.src === src)?.id ?? ''} options={[['', 'load an example…'], ...EXAMPLES.map((e) => [e.id, e.title] as [string, string])]} onChange={(id) => id && setSrc(exampleById(id).src)} />
          <span className="grow" />
          {r.ok && <span className={`badge ${r.error ? 'bad' : 'ok'}`}>compiled in {Object.values(r.timings).reduce((a, b) => a + b, 0).toFixed(0)} ms</span>}
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <Editor value={src} onChange={setSrc} error={r.error?.line ? r.error : null} minHeight={300} />
        </div>
        {r.error && <div className="error-box">{r.error.stage}: {r.error.line ? `line ${r.error.line}: ` : ''}{r.error.msg}</div>}
        <div style={{ borderTop: '1px solid var(--rule)', maxHeight: '32vh', overflow: 'auto' }}>
          <RunPanel r={r} target={st.target} wasmOut={wasmOut} />
        </div>
      </div>
      <div className="pg-right">
        <div className="pg-toolbar">
          <span className="label">target</span>
          <Seg value={st.target} onChange={(v) => set('target', v)} options={[['rv64', 'RISC-V'], ['aarch64', 'AArch64'], ['x86_64', 'x86-64'], ['wasm', 'Wasm']]} />
          <Seg value={st.opt} onChange={(v) => set('opt', v)} options={[[0, '-O0'], [1, '-O1'], [2, '-O2']]} />
          {fnNames.length > 1 && <><span className="label">CFG of</span><Select value={fn ?? ''} options={fnNames.map((n) => [n, `@${n}`] as [string, string])} onChange={setFnSel} /></>}
          <span className="grow" />
          {native && <button className="chip-btn" onClick={() => download('program.s', listingText(r.asm) + '\n', 'text/plain')}>⤓ .s</button>}
          {native && r.objBytes && <button className="chip-btn" onClick={() => download('program.o', r.objBytes!)}>⤓ .o</button>}
          {st.target === 'rv64' && r.link && <button className="chip-btn" onClick={() => download('a.out', r.link!.exe)} title="static RISC-V Linux executable; runs under qemu-riscv64">⤓ a.out</button>}
          {st.target === 'wasm' && wasm && !('error' in wasm) && <button className="chip-btn" onClick={() => download('program.wasm', wasm.bytes)}>⤓ .wasm</button>}
        </div>
        {native && (
          <div className="pg-toolbar" style={{ background: 'var(--panel)' }}>
            <span className="label">allocator</span>
            <Seg value={st.regalloc} onChange={(v) => set('regalloc', v)} options={[['irc', 'graph colouring'], ['linear', 'linear scan']]} />
            <span className="row">registers <input type="range" className="range" min={0} max={26} value={st.maxRegs} onChange={(e) => set('maxRegs', Number(e.target.value))} /><b className="mono">{st.maxRegs || 'all'}</b></span>
            <Check checked={st.coalesce} onChange={(v) => set('coalesce', v)}>coalesce</Check>
            <Check checked={st.remat} onChange={(v) => set('remat', v)}>remat</Check>
            <span className="label">sched</span>
            <Seg value={st.sched} onChange={(v) => set('sched', v)} options={[['none', 'off'], ['pre', 'pre-RA'], ['post', 'post-RA']]} />
            <Check checked={st.peephole} onChange={(v) => set('peephole', v)}>peephole</Check>
            <Check checked={st.framePointer} onChange={(v) => set('framePointer', v)}>frame pointer</Check>
            {st.target === 'rv64' && <>
              <span className="label">ext</span>
              <Check checked={st.mExt} onChange={(v) => set('mExt', v)}>M</Check>
              <Check checked={st.zba} onChange={(v) => set('zba', v)}>Zba</Check>
              <Check checked={st.zicond} onChange={(v) => set('zicond', v)}>Zicond</Check>
            </>}
            <button className="chip-btn" onClick={() => setSt((s) => ({ ...DEFAULTS, left: s.left, right: s.right, target: s.target }))}>reset options</button>
          </div>
        )}
        <div className="panes" style={{ gridTemplateColumns: '1fr 1fr', flex: 1, minHeight: 0 }}>
          {pane('left')}
          {pane('right')}
        </div>
      </div>
    </div>
  );
}
