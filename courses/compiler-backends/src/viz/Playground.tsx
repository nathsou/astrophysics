// The playground: every stage, every option, two panes side by side.
//
// Layout: one top bar (course link, program, target, optimisation level, the
// Options and Download menus, compile status, theme); below it the source
// editor with its output drawer, and two stage panes, each with the whole
// pipeline as a breadcrumb of stages. One hint line at the bottom explains
// whatever is under the mouse.

import { useEffect, useMemo, useState } from 'react';
import { EXAMPLES, exampleById } from '../examples';
import { lowerModule, runWasm } from '../compiler/wasm/wasm';
import { listingText } from '../compiler/listing';
import type { CompileResult, PipelineOptions } from '../compiler/pipeline';
import { Editor } from '../ui/Editor';
import { Check, Popover, Select, Seg } from '../ui/controls';
import { hintStore, persist, persisted, useStore } from '../ui/store';
import { ThemeToggle } from '../ui/ThemeToggle';
import { useCompile, useDebounced } from '../ui/useCompile';
import { NATIVE_STAGES, PHASE_LABEL, StageNav, StageView, WASM_STAGES, safe, type StageDef, type StageId, type TargetSel, type WasmState } from './Pipeline';

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
  outOpen: boolean;
}

const DEFAULTS: Settings = {
  target: 'rv64', opt: 2, regalloc: 'irc', coalesce: true, sched: 'pre', peephole: true, remat: true, framePointer: false,
  mExt: true, zba: false, zicond: false, maxRegs: 0, left: 'opt', right: 'asm', leftMode: 'text', rightMode: 'text', outOpen: true,
};

/** the settings the Options panel owns (and "reset" restores) */
const BACKEND_KEYS = ['regalloc', 'maxRegs', 'coalesce', 'remat', 'sched', 'peephole', 'framePointer', 'mExt', 'zba', 'zicond'] as const;
const RV_ONLY = new Set<string>(['mExt', 'zba', 'zicond']);

const TARGETS: [TargetSel, string][] = [['rv64', 'RISC-V'], ['aarch64', 'AArch64'], ['x86_64', 'x86-64'], ['wasm', 'Wasm']];
const TARGET_NAME: Record<TargetSel, string> = { rv64: 'RISC-V', aarch64: 'AArch64', x86_64: 'x86-64', wasm: 'Wasm' };

type WasmOut = { output: string; exitCode: bigint; error?: string } | null;

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
  const [wasmOut, setWasmOut] = useState<WasmOut>(null);
  useEffect(() => {
    if (!wasm || 'error' in wasm) { setWasmOut(null); return; }
    let live = true;
    runWasm(wasm.bytes).then((o) => live && setWasmOut(o));
    return () => { live = false; };
  }, [wasm]);
  useEffect(() => () => hintStore.set(null), []);

  const defs = st.target === 'wasm' ? WASM_STAGES : NATIVE_STAGES;
  const fnNames = r.optimized?.funcs.map((f) => f.name) ?? r.lowered?.funcs.map((f) => f.name) ?? [];
  const fn = fnNames.includes(fnSel) ? fnSel : fnNames[0];
  const example = EXAMPLES.find((e) => e.src === src);
  const changed = BACKEND_KEYS.filter((k) => st[k] !== DEFAULTS[k] && (st.target === 'rv64' || !RV_ONLY.has(k))).length;
  const ms = Object.values(r.timings).reduce((a, b) => a + b, 0);

  const pane = (which: 'left' | 'right') => (
    <StagePane
      key={which}
      which={which}
      defs={defs}
      id={st[which]}
      mode={st[which === 'left' ? 'leftMode' : 'rightMode']}
      setId={(v) => set(which, v)}
      setMode={(v) => set(which === 'left' ? 'leftMode' : 'rightMode', v)}
      r={r} fn={fn} fnNames={fnNames} setFn={setFnSel} target={st.target} wasm={wasm} wasmOut={wasmOut}
    />
  );

  return (
    <div className="pg">
      <header className="pg-bar">
        <div className="pg-grp pg-home">
          <a href="#/" className="pg-btn" title="Back to the course">← Course</a>
          <span className="pg-title">Playground</span>
        </div>
        <div className="pg-grp pg-prog">
          <label className="pg-lbl" htmlFor="pg-prog">Program</label>
          <Select id="pg-prog" value={example?.id ?? ''} options={[...(example ? [] : [['', 'your program'] as [string, string]]), ...EXAMPLES.map((e) => [e.id, e.title] as [string, string])]} onChange={(id) => id && setSrc(exampleById(id).src)} />
        </div>
        <div className="pg-grp pg-tgt">
          <span className="pg-lbl" aria-hidden="true">Target</span>
          <Seg label="Target" value={st.target} onChange={(v) => set('target', v)} options={TARGETS} />
        </div>
        <div className="pg-grp pg-opt">
          <span className="pg-lbl" aria-hidden="true">Opt</span>
          <Seg label="Optimisation level" value={st.opt} onChange={(v) => set('opt', v)} options={[[0, '-O0'], [1, '-O1'], [2, '-O2']]} />
        </div>
        <span className="pg-spacer" />
        <div className="pg-grp pg-menus">
          <Popover id="pg-options" label="Options" badge={changed || undefined} title="Back-end options: register allocation, scheduling, code generation, ISA extensions">
            <OptionsPanel st={st} set={set} changed={changed} reset={() => setSt((s) => { const n = { ...s }; for (const k of BACKEND_KEYS) (n as Record<string, unknown>)[k] = DEFAULTS[k]; return n; })} />
          </Popover>
          <Popover id="pg-download" label="Download" title="Download the compiled program">
            {(close) => <DownloadMenu r={r} target={st.target} wasm={wasm} close={close} />}
          </Popover>
        </div>
        <div className="pg-grp pg-end">
          <span className={`pg-status ${r.error ? 'bad' : 'ok'}`} role="status" title={r.error ? r.error.msg : `compiled in ${ms.toFixed(1)} ms`} aria-label={r.error ? undefined : `compiled in ${ms.toFixed(0)} ms`}>
            <span className="dot" aria-hidden="true" />
            {r.error ? <>{r.error.stage} error{r.error.line ? ` · line ${r.error.line}` : ''}</> : <span className="pg-stxt">compiled <span className="pg-ms">· {ms.toFixed(0)} ms</span></span>}
          </span>
          <ThemeToggle className="pg-btn" />
        </div>
      </header>

      <div className="pg-main">
        <section className="pg-col pg-src" aria-label="Source">
          <div className="pg-head">
            <span className="pg-h">Kiln source</span>
            <span className="pg-sub">{example ? example.title : 'edited'}</span>
            <span className="pg-spacer" />
            {!example && <button type="button" className="mini-btn" onClick={() => setSrc(exampleById('collatz').src)} title="Replace the editor contents with the Collatz example">Reset</button>}
          </div>
          <div className="pg-editor">
            <Editor value={src} onChange={setSrc} error={r.error?.line ? r.error : null} minHeight={120} />
          </div>
          {r.error && <div className="error-box" role="alert">{r.error.stage}: {r.error.line ? `line ${r.error.line}: ` : ''}{r.error.msg}</div>}
          <OutputDrawer r={r} target={st.target} wasmOut={wasmOut} open={st.outOpen} toggle={() => set('outOpen', !st.outOpen)} />
        </section>
        {pane('left')}
        {pane('right')}
      </div>

      <HintBar />
    </div>
  );
}

// ------------------------------------------------------------------ stage pane

function StagePane({ which, defs, id, mode, setId, setMode, r, fn, fnNames, setFn, target, wasm, wasmOut }: {
  which: 'left' | 'right'; defs: StageDef[]; id: StageId; mode: 'text' | 'cfg'; setId: (v: StageId) => void; setMode: (v: 'text' | 'cfg') => void;
  r: CompileResult; fn?: string; fnNames: string[]; setFn: (f: string) => void; target: TargetSel; wasm: WasmState; wasmOut: WasmOut;
}) {
  const k = defs.findIndex((d) => d.id === id);
  const def = k >= 0 ? defs[k] : defs[which === 'left' ? 0 : defs.length - 1];
  const idx = defs.indexOf(def);
  const canCFG = !!(def.ir || def.mir);
  const [more, setMore] = useState(false);
  const step = (d: number) => setId(defs[Math.max(0, Math.min(defs.length - 1, idx + d))].id);
  return (
    <section className="pg-col pg-pane" aria-label={`${which === 'left' ? 'Left' : 'Right'} pane: ${def.label}`}>
      <div className="pg-nav">
        <button type="button" className="nav-step" onClick={() => step(-1)} disabled={idx === 0} aria-label="Previous stage" title="Previous stage">‹</button>
        <StageNav defs={defs} value={def.id} onChange={setId} label={`${which === 'left' ? 'Left' : 'Right'} pane stage`} phases />
        <button type="button" className="nav-step" onClick={() => step(1)} disabled={idx === defs.length - 1} aria-label="Next stage" title="Next stage">›</button>
      </div>
      <div className="pg-cap">
        <button type="button" className={`pg-cap-text ${more ? 'open' : ''}`} onClick={() => setMore((m) => !m)} aria-expanded={more} title={def.hint}>
          <span className="pg-phase">{PHASE_LABEL[def.phase]}</span><b>{idx + 1}. {def.label}</b> <span>{def.hint}</span>
        </button>
        {canCFG && <Seg label="View" value={mode} onChange={setMode} options={[['text', 'Text'], ['cfg', 'CFG']]} />}
        {canCFG && mode === 'cfg' && fnNames.length > 1 && <Select label="Function" value={fn ?? ''} options={fnNames.map((n) => [n, `@${n}`] as [string, string])} onChange={setFn} />}
      </div>
      <div className="pg-body">
        <StageView r={r} def={def} mode={mode} fn={fn} target={target} height={100000} wasm={wasm} wasmOut={wasmOut} hints />
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ options

function OptionsPanel({ st, set, changed, reset }: { st: Settings; set: <K extends keyof Settings>(k: K, v: Settings[K]) => void; changed: number; reset: () => void }) {
  const native = st.target !== 'wasm';
  const rv = st.target === 'rv64';
  return (
    <div className="opt-panel" role="group" aria-label="Back-end options">
      {!native && <p className="opt-note">WebAssembly leaves register allocation and scheduling to the engine: these options apply to the native targets.</p>}
      <fieldset className="opt-sec" disabled={!native}>
        <legend>Register allocation</legend>
        <div className="opt-row"><span className="opt-k">Allocator</span><Seg label="Register allocator" value={st.regalloc} onChange={(v) => set('regalloc', v)} options={[['irc', 'graph colouring'], ['linear', 'linear scan']]} disabled={!native} /></div>
        <div className="opt-row">
          <label className="opt-k" htmlFor="pg-regs">Registers</label>
          <input id="pg-regs" type="range" className="range" min={0} max={26} value={st.maxRegs} onChange={(e) => set('maxRegs', Number(e.target.value))} aria-valuetext={st.maxRegs ? `${st.maxRegs} registers` : 'all registers'} />
          <b className="mono opt-val">{st.maxRegs || 'all'}</b>
        </div>
        <div className="opt-row checks">
          <Check checked={st.coalesce} onChange={(v) => set('coalesce', v)} title="merge copy-related values into one register">Coalesce copies</Check>
          <Check checked={st.remat} onChange={(v) => set('remat', v)} title="recompute constants instead of reloading them from the stack">Rematerialise</Check>
        </div>
      </fieldset>
      <fieldset className="opt-sec" disabled={!native}>
        <legend>Scheduling &amp; code generation</legend>
        <div className="opt-row"><span className="opt-k">Scheduler</span><Seg label="Instruction scheduler" value={st.sched} onChange={(v) => set('sched', v)} options={[['none', 'off'], ['pre', 'pre-RA'], ['post', 'post-RA']]} disabled={!native} /></div>
        <div className="opt-row checks">
          <Check checked={st.peephole} onChange={(v) => set('peephole', v)}>Peephole</Check>
          <Check checked={st.framePointer} onChange={(v) => set('framePointer', v)}>Frame pointer</Check>
        </div>
      </fieldset>
      <fieldset className="opt-sec" disabled={!rv}>
        <legend>RISC-V extensions{!rv && <span className="opt-na"> · RISC-V only</span>}</legend>
        <div className="opt-row checks">
          <Check checked={st.mExt} onChange={(v) => set('mExt', v)} title="hardware multiply/divide">M</Check>
          <Check checked={st.zba} onChange={(v) => set('zba', v)} title="address generation: sh1add/sh2add/sh3add">Zba</Check>
          <Check checked={st.zicond} onChange={(v) => set('zicond', v)} title="conditional zero: czero.eqz/czero.nez">Zicond</Check>
        </div>
      </fieldset>
      <div className="opt-foot">
        <span className="muted">{changed ? `${changed} changed from defaults` : 'All at defaults'}</span>
        <button type="button" className="pg-btn" onClick={reset} disabled={!changed}>Reset to defaults</button>
      </div>
    </div>
  );
}

function DownloadMenu({ r, target, wasm, close }: { r: CompileResult; target: TargetSel; wasm: WasmState; close: () => void }) {
  const native = target !== 'wasm';
  const items: { label: string; file: string; note: string; ok: boolean; go: () => void }[] = native ? [
    { label: 'Assembly', file: 'program.s', note: `${TARGET_NAME[target]} assembly listing`, ok: r.asm.length > 0, go: () => download('program.s', listingText(r.asm) + '\n', 'text/plain') },
    { label: 'Object file', file: 'program.o', note: 'ELF relocatable object', ok: !!r.objBytes, go: () => download('program.o', r.objBytes!) },
    ...(target === 'rv64' ? [{ label: 'Executable', file: 'a.out', note: 'static RISC-V Linux binary; runs under qemu-riscv64', ok: !!r.link, go: () => download('a.out', r.link!.exe) }] : []),
  ] : [
    { label: 'WebAssembly module', file: 'program.wasm', note: 'binary module; exports main', ok: !!wasm && !('error' in wasm), go: () => wasm && !('error' in wasm) && download('program.wasm', wasm.bytes) },
  ];
  return (
    <div className="dl-menu" role="group" aria-label="Downloads">
      {items.map((it) => (
        <button key={it.file} type="button" className="dl-item" disabled={!it.ok} onClick={() => { it.go(); close(); }}>
          <span className="dl-file">{it.file}</span>
          <span className="dl-note">{it.label} · {it.ok ? it.note : 'not available (fix the errors first)'}</span>
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ output

function OutputDrawer({ r, target, wasmOut, open, toggle }: { r: CompileResult; target: TargetSel; wasmOut: WasmOut; open: boolean; toggle: () => void }) {
  const ref = r.interp;
  const actual = target === 'wasm' ? wasmOut : target === 'rv64' ? r.emu : undefined;
  const shown = actual ?? ref;
  const match = actual && ref && !actual.error && actual.output === ref.output;
  const runner = target === 'wasm' ? 'Your browser’s Wasm engine' : target === 'rv64' ? 'RISC-V emulator' : 'IR interpreter';
  return (
    <div className={`pg-out ${open ? 'open' : ''}`}>
      <button type="button" className="pg-out-head" onClick={toggle} aria-expanded={open} aria-controls="pg-out-body">
        <span className="caret" aria-hidden="true">{open ? '▾' : '▸'}</span>
        <span className="pg-h">Output</span>
        <span className="pg-sub">{runner}</span>
        <span className="pg-spacer" />
        {shown && <span className={`stat ${shown.error ? 'bad' : ''}`}>exit {String(shown.exitCode ?? '?')}</span>}
        {actual && (match ? <span className="stat ok" title="matches the reference IR interpreter">✓ matches IR</span> : <span className="stat bad" title="differs from the reference IR interpreter">✗ differs from IR</span>)}
      </button>
      {open && (
        <div className="pg-out-body" id="pg-out-body">
          {target === 'rv64' && r.emu && (
            <div className="pg-out-stats">
              <span><b>{r.emu.steps.toLocaleString()}</b> instructions</span>
              <span>max stack <b>{r.emu.maxStackDepth} B</b></span>
            </div>
          )}
          <pre className="pg-out-text">
            {shown?.error ? <span className="t-err">{shown.error}{'\n'}</span> : null}
            {shown?.output || <span className="muted">(no output)</span>}
          </pre>
          {target !== 'rv64' && target !== 'wasm' && (
            <p className="pg-out-note">Output from the reference IR interpreter. The {TARGET_NAME[target]} code is validated offline: assembled with LLVM, linked, and run on real hardware or a CPU emulator against the same interpreter.</p>
          )}
          {ref?.warnings.length ? <p className="pg-out-note warn">{ref.warnings[0]}</p> : null}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ hint line

function HintBar() {
  const h = useStore(hintStore);
  return (
    <footer className="pg-hint" aria-live="off">
      {h ? <><span className="why">{h.why ?? 'info'}</span><span className="txt">{h.text}</span></> : <span className="muted txt">Hover an instruction to see why it is there, an operand for details, or an AST node to see its source span.</span>}
    </footer>
  );
}
