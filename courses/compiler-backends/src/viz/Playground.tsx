// The playground: every stage, every option, two panes side by side.

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { EXAMPLES } from '../examples';
import { lowerModule, runWasm } from '../compiler/wasm/wasm';
import { listingText, type Line } from '../compiler/listing';
import type { CompileResult, PipelineOptions } from '../compiler/pipeline';
import { Editor } from '../ui/Editor';
import { Logo } from '../ui/Logo';
import { NoteBar } from '../ui/CodeView';
import { Check, Menu, Select, Seg, Splitter } from '../ui/controls';
import { persist, persisted, Store } from '../ui/store';
import { useCompile, useDebounced } from '../ui/useCompile';
import { diffLines } from './diff';
import { diffBase, NATIVE_STAGES, RunPanel, stageLines, StageView, WASM_STAGES, safe, type StageId, type TargetSel } from './Pipeline';

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
  leftDiff: boolean;
  rightDiff: boolean;
}

const DEFAULTS: Settings = {
  target: 'rv64', opt: 2, regalloc: 'irc', coalesce: true, sched: 'pre', peephole: true, remat: true, framePointer: false,
  mExt: true, zba: false, zicond: false, maxRegs: 0, left: 'opt', right: 'asm', leftMode: 'text', rightMode: 'text',
  leftDiff: false, rightDiff: false,
};

/** The options in the options bar: what "reset" resets, and what the effect bar reports on. */
const OPTION_KEYS = ['regalloc', 'maxRegs', 'coalesce', 'remat', 'sched', 'peephole', 'framePointer', 'mExt', 'zba', 'zicond'] as const;
type OptionKey = (typeof OPTION_KEYS)[number] | 'opt';

const OPTION_LABELS: Record<OptionKey, string> = {
  opt: 'optimisation level', regalloc: 'allocator', maxRegs: 'register limit', coalesce: 'coalescing', remat: 'rematerialisation',
  sched: 'scheduling', peephole: 'peephole', framePointer: 'frame pointer', mExt: 'M extension', zba: 'Zba', zicond: 'Zicond',
};
const VALUE_LABELS: Record<string, string> = { irc: 'graph colouring', linear: 'linear scan', none: 'off', pre: 'pre-RA', post: 'post-RA' };
function describeChange(k: OptionKey, v: Settings[OptionKey]): string {
  const value = typeof v === 'boolean' ? (v ? 'on' : 'off') : k === 'opt' ? `-O${v}` : k === 'maxRegs' ? (v ? String(v) : 'all') : VALUE_LABELS[String(v)] ?? String(v);
  return `${OPTION_LABELS[k]} → ${value}`;
}

// Values a link may set; anything else in a URL is ignored.
const ALLOWED: Partial<Record<keyof Settings, readonly (string | number)[]>> = {
  target: ['rv64', 'aarch64', 'x86_64', 'wasm'], opt: [0, 1, 2], regalloc: ['irc', 'linear'], sched: ['none', 'pre', 'post'],
  leftMode: ['text', 'cfg'], rightMode: ['text', 'cfg'],
};

const toBase64 = (s: string) => {
  let bin = '';
  for (const b of new TextEncoder().encode(s)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromBase64 = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));

/**
 * Playground links: `#/playground?ex=fib&target=x86_64&right=ra` (chapters use these), or with `code=<base64url>`
 * for an arbitrary program. Every setting not named takes its default, so a link always shows the same thing.
 */
function readLink(hash: string): { src?: string; st: Settings } | null {
  const qi = hash.indexOf('?');
  if (qi < 0) return null;
  const q = new URLSearchParams(hash.slice(qi + 1));
  const st: Settings = { ...DEFAULTS };
  for (const k of Object.keys(DEFAULTS) as (keyof Settings)[]) {
    const raw = q.get(k);
    if (raw === null) continue;
    const d = DEFAULTS[k];
    const v = typeof d === 'number' ? Number(raw) : typeof d === 'boolean' ? raw === '1' || raw === 'true' : raw;
    if (typeof v === 'number' && !Number.isFinite(v)) continue;
    if (ALLOWED[k] && !ALLOWED[k]!.includes(v as string | number)) continue;
    (st as unknown as Record<string, unknown>)[k] = k === 'maxRegs' ? Math.max(0, Math.min(26, v as number)) : v;
  }
  let src: string | undefined;
  try {
    src = q.has('code') ? fromBase64(q.get('code')!) : EXAMPLES.find((e) => e.id === q.get('ex'))?.src;
  } catch { /* malformed link: keep the current source */ }
  return { src, st };
}

function linkFor(src: string, st: Settings): string {
  const q = new URLSearchParams();
  const ex = EXAMPLES.find((e) => e.src === src);
  if (ex) q.set('ex', ex.id);
  else q.set('code', toBase64(src));
  for (const k of Object.keys(DEFAULTS) as (keyof Settings)[]) {
    if (st[k] !== DEFAULTS[k]) q.set(k, typeof st[k] === 'boolean' ? (st[k] ? '1' : '0') : String(st[k]));
  }
  return `${location.origin}${location.pathname}#/playground?${q}`;
}

// ------------------------------------------------------------ effect of options

interface Stats { instrs: number; moves: number; spills: number; text?: number; executed?: number }

const STATS: [keyof Stats, string, string][] = [
  ['instrs', 'instructions', 'Instructions in the final assembly'],
  ['moves', 'moves', 'Register-to-register copies left after allocation and peephole'],
  ['spills', 'spills & reloads', 'Stores to and loads from spill slots'],
  ['text', 'bytes of code', 'Size of the .text section'],
  ['executed', 'executed', 'Instructions the RISC-V emulator executed'],
];

function statsOf(r: CompileResult): Stats | null {
  if (!r.ok) return null;
  let instrs = 0, moves = 0, spills = 0;
  for (const l of r.asm) {
    if (l.kind !== 'instr') continue;
    instrs++;
    if (l.tag === 'spill' || l.tag === 'reload') spills++;
    const t = l.toks.filter((x) => x.t.trim() && x.c !== 'punct');
    if (t.length === 3 && /^(mv|mov|fmv)$/.test(t[0].t) && t[1].c === 'preg' && t[2].c === 'preg') moves++;
  }
  return { instrs, moves, spills, text: r.obj?.sections.find((s) => s.name === '.text')?.size, executed: r.emu?.steps };
}

function download(name: string, data: Uint8Array | string, type = 'application/octet-stream') {
  const blob = new Blob([typeof data === 'string' ? data : new Uint8Array(data)], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function OptGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="opt-group" role="group" aria-label={label}>
      <span className="opt-label">{label}</span>
      <div className="opt-row">{children}</div>
    </div>
  );
}

/** Keep the selected stage tab visible when the strip scrolls horizontally. */
const scrollIntoView = (el: HTMLElement | null) => el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export function Playground() {
  const [src, setSrc] = useState<string>(() => readLink(location.hash)?.src ?? persisted('pg.src', EXAMPLES.find((e) => e.id === 'collatz')!.src));
  const [st, setSt] = useState<Settings>(() => readLink(location.hash)?.st ?? { ...DEFAULTS, ...persisted<Partial<Settings>>('pg.settings', {}) });
  const [fnSel, setFnSel] = useState('');
  const [active, setActive] = useState<'left' | 'right'>('right');
  const [split, setSplit] = useState(() => persisted('pg.split', 33));
  const [paneSplit, setPaneSplit] = useState(() => persisted('pg.paneSplit', 50));
  const [shared, setShared] = useState(false);
  const notes = useMemo(() => new Store<Line | null>(null), []);
  useEffect(() => persist('pg.src', src), [src]);
  useEffect(() => persist('pg.settings', st), [st]);
  useEffect(() => persist('pg.split', split), [split]);
  useEffect(() => persist('pg.paneSplit', paneSplit), [paneSplit]);

  // A link has been applied once it is in state; drop it from the address bar so reloading keeps later edits.
  useEffect(() => {
    const apply = () => {
      const link = readLink(location.hash);
      if (!link) return;
      if (link.src !== undefined) setSrc(link.src);
      setSt(link.st);
      history.replaceState(null, '', '#/playground');
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setSt((s) => ({ ...s, [k]: v }));
  const dsrc = useDebounced(src, 250);
  const opts: Partial<PipelineOptions> = {
    target: st.target === 'wasm' ? 'rv64' : st.target, opt: st.opt, regalloc: st.regalloc, coalesce: st.coalesce, sched: st.sched,
    peephole: st.peephole, remat: st.remat, framePointer: st.framePointer, mExt: st.mExt, zba: st.zba, zicond: st.zicond,
    maxRegs: st.maxRegs || undefined, run: true, asmOnly: st.target === 'wasm',
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

  // What the last option change did: compare against the result just before it.
  const stats = useMemo(() => statsOf(r), [r]);
  const [base, setBase] = useState<{ stats: Stats; what: string } | null>(null);
  useEffect(() => setBase(null), [dsrc, st.target]);
  const setOption = <K extends OptionKey>(k: K, v: Settings[K]) => {
    if (stats && st[k] !== v) setBase({ stats, what: describeChange(k, v) });
    set(k, v);
  };
  const changed = OPTION_KEYS.filter((k) => st[k] !== DEFAULTS[k]).length;
  const resetOptions = () => {
    if (stats) setBase({ stats, what: 'resetting the options' });
    setSt((s) => ({ ...s, ...Object.fromEntries(OPTION_KEYS.map((k) => [k, DEFAULTS[k]])) }));
  };

  const defs = st.target === 'wasm' ? WASM_STAGES : NATIVE_STAGES;
  const fnNames = r.optimized?.funcs.map((f) => f.name) ?? [];
  const fn = fnNames.includes(fnSel) ? fnSel : fnNames[0];
  const defOf = (which: 'left' | 'right') => defs.find((d) => d.id === st[which]) ?? defs[which === 'left' ? 0 : defs.length - 1];

  const pane = (which: 'left' | 'right') => {
    const def = defOf(which);
    const mode = st[which === 'left' ? 'leftMode' : 'rightMode'];
    const diffKey = which === 'left' ? 'leftDiff' : 'rightDiff';
    const canCFG = !!(def.ir || def.mir);
    const textMode = mode === 'text' || !canCFG;
    const prev = textMode ? diffBase(defs, def, r, st.target) : undefined;
    const diff = prev && st[diffKey] ? diffLines(stageLines(r, prev, st.target, wasm) ?? [], stageLines(r, def, st.target, wasm) ?? []) : null;
    return (
      <div className={`pane ${active === which ? 'active' : ''}`} onPointerDown={() => setActive(which)} aria-label={`${which} pane`}>
        <div className="pane-head pg-pane-head">
          <span className="stage-name"><span className="n">{defs.indexOf(def) + 1}</span>{def.label}</span>
          {canCFG && <Seg value={mode} onChange={(v) => set(which === 'left' ? 'leftMode' : 'rightMode', v)} options={[['text', 'text'], ['cfg', 'CFG']]} />}
          {canCFG && mode === 'cfg' && fnNames.length > 1 && <Select value={fn ?? ''} title="Function to draw" options={fnNames.map((n) => [n, `@${n}`] as [string, string])} onChange={setFnSel} />}
          {prev && (
            <Check checked={st[diffKey]} onChange={(v) => set(diffKey, v)} title={`Mark what changed since ${prev.label}: added lines in green, removed lines struck through`}>
              diff vs {prev.label}
            </Check>
          )}
          {diff && <span className="diff-count"><span className="add">+{diff.added}</span> <span className="del">−{diff.removed}</span></span>}
          <span className="hint" title={def.hint}>{def.hint}</span>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          <StageView r={r} def={def} mode={mode} fn={fn} target={st.target} height={4000} wasm={wasm} wasmOut={wasmOut} lines={diff?.lines} noteStore={notes} />
        </div>
      </div>
    );
  };

  const share = async () => {
    const url = linkFor(src, st);
    try {
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 1800);
    } catch {
      window.prompt('Copy this link:', url);
    }
  };

  const native = st.target !== 'wasm';
  const ms = Object.values(r.timings).reduce((a, b) => a + b, 0).toFixed(0);
  return (
    <div className="playground" style={{ '--pg-split': `${split}%` } as CSSProperties}>
      <div className="pg-left">
        <div className="pg-toolbar">
          <a href="#/" className="chip-btn" style={{ textDecoration: 'none' }} title="Back to the course"><Logo size={16} />← course</a>
          <Select className="grow-select" title="Load an example program" value={EXAMPLES.find((e) => e.src === src)?.id ?? ''} options={[['', 'load an example…'], ...EXAMPLES.map((e) => [e.id, e.title] as [string, string])]} onChange={(id) => id && setSrc(EXAMPLES.find((e) => e.id === id)!.src)} />
          {r.error
            ? <span className="badge bad" title={r.error.msg}>✗ {r.error.stage} error</span>
            : <span className="badge ok" title={`compiled in ${ms} ms`}>✓ {ms} ms</span>}
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <Editor value={src} onChange={setSrc} error={r.error?.line ? r.error : null} minHeight={300} />
        </div>
        {r.error && <div className="error-box">{r.error.stage}: {r.error.line ? `line ${r.error.line}: ` : ''}{r.error.msg}</div>}
        <div style={{ borderTop: '1px solid var(--rule)', maxHeight: '32vh', overflow: 'auto' }}>
          <RunPanel r={r} target={st.target} wasmOut={wasmOut} />
        </div>
      </div>
      <Splitter label="Resize the editor" onDrag={(f) => setSplit(clamp(f * 100, 18, 60))} />
      <div className="pg-right">
        <div className="pg-toolbar">
          <Seg value={st.target} onChange={(v) => set('target', v)} options={[['rv64', 'RISC-V'], ['aarch64', 'AArch64'], ['x86_64', 'x86-64'], ['wasm', 'Wasm']]} title="Target" />
          {st.target === 'rv64' && (
            <span className="ext" role="group" aria-label="RISC-V extensions">
              <span className="label">ext</span>
              <Check checked={st.mExt} onChange={(v) => setOption('mExt', v)} title="M: integer multiply and divide">M</Check>
              <Check checked={st.zba} onChange={(v) => setOption('zba', v)} title="Zba: address generation (sh1add, sh2add, …)">Zba</Check>
              <Check checked={st.zicond} onChange={(v) => setOption('zicond', v)} title="Zicond: conditional zero (czero.eqz, czero.nez)">Zicond</Check>
            </span>
          )}
          <Seg value={st.opt} onChange={(v) => setOption('opt', v)} options={[[0, '-O0'], [1, '-O1'], [2, '-O2']]} title="Optimisation level" />
          <span className="grow" />
          <button className={`chip-btn ${shared ? 'done' : ''}`} onClick={share} title="Copy a link to this program with these settings">{shared ? '✓ copied' : 'Share'}</button>
          <Menu label="⤓ Download" title="Download the compiler’s output">
            {native && <button onClick={() => download('program.s', listingText(r.asm) + '\n', 'text/plain')}><b>Assembly</b><span>program.s</span></button>}
            {native && r.objBytes && <button onClick={() => download('program.o', r.objBytes!)}><b>Object file</b><span>program.o · ELF relocatable</span></button>}
            {st.target === 'rv64' && r.link && <button onClick={() => download('a.out', r.link!.exe)}><b>Executable</b><span>a.out · static RISC-V Linux, runs under qemu-riscv64</span></button>}
            {st.target === 'wasm' && wasm && !('error' in wasm) && <button onClick={() => download('program.wasm', wasm.bytes)}><b>WebAssembly module</b><span>program.wasm</span></button>}
            {st.target === 'wasm' && wasm && !('error' in wasm) && <button onClick={() => download('program.wat', listingText(wasm.wat) + '\n', 'text/plain')}><b>WebAssembly text</b><span>program.wat</span></button>}
            <button onClick={() => download('program.kiln', src, 'text/plain')}><b>Source</b><span>program.kiln</span></button>
          </Menu>
        </div>
        {native && (
          <div className="pg-options">
            <OptGroup label="Register allocation">
              <Seg value={st.regalloc} onChange={(v) => setOption('regalloc', v)} options={[['irc', 'graph colouring'], ['linear', 'linear scan']]} />
              <label className="row" title="Allocatable registers (all = the whole register file)">
                registers
                <input type="range" className="range" min={0} max={26} value={st.maxRegs} onChange={(e) => setOption('maxRegs', Number(e.target.value))} />
                <b className="mono reg-count">{st.maxRegs || 'all'}</b>
              </label>
              <Check checked={st.coalesce} onChange={(v) => setOption('coalesce', v)} title="Merge copy-related values so the copy disappears">coalesce</Check>
              <Check checked={st.remat} onChange={(v) => setOption('remat', v)} title="Recompute cheap values instead of spilling them">remat</Check>
            </OptGroup>
            <OptGroup label="Scheduling">
              <Seg value={st.sched} onChange={(v) => setOption('sched', v)} options={[['none', 'off'], ['pre', 'pre-RA'], ['post', 'post-RA']]} />
            </OptGroup>
            <OptGroup label="Clean-up & frame">
              <Check checked={st.peephole} onChange={(v) => setOption('peephole', v)}>peephole</Check>
              <Check checked={st.framePointer} onChange={(v) => setOption('framePointer', v)}>frame pointer</Check>
            </OptGroup>
          </div>
        )}
        {native && (
          <div className="pg-stats" aria-live="polite">
            <span className="opt-label">Result</span>
            {stats && STATS.map(([k, label, title]) => {
              const v = stats[k];
              if (v === undefined) return null;
              const was = base?.stats[k];
              const d = was !== undefined ? v - was : 0;
              return (
                <span key={k} className="stat" title={title}>
                  <b>{v.toLocaleString()}</b> {label}
                  {d !== 0 && <span className={`delta ${d < 0 ? 'better' : 'worse'}`}>{d > 0 ? '+' : '−'}{Math.abs(d).toLocaleString()}</span>}
                </span>
              );
            })}
            <span className="since">
              {base ? <>vs. before <b>{base.what}</b> <button className="link-btn" onClick={() => setBase(null)}>clear</button></> : 'change an option to see what it does'}
              {changed > 0 && <> · <button className="link-btn" onClick={resetOptions} title="Restore the default options">reset {changed} option{changed > 1 ? 's' : ''}</button></>}
            </span>
          </div>
        )}
        <div className="stage-strip">
          <Seg value={active} onChange={setActive} options={[['left', 'L'], ['right', 'R']]} title="The pane a stage opens in: left or right (clicking a pane also selects it)" />
          <div className="stage-tabs" role="tablist" aria-label="Pipeline stages">
            {defs.map((d, k) => {
              const inLeft = defOf('left').id === d.id, inRight = defOf('right').id === d.id;
              const on = active === 'left' ? inLeft : inRight;
              return (
                <span key={d.id} style={{ display: 'contents' }}>
                  {k > 0 && <span className="stage-arrow">›</span>}
                  <button ref={on ? scrollIntoView : undefined} className={`stage-tab ${on ? 'on' : ''}`} onClick={() => set(active, d.id)} title={d.hint} role="tab" aria-selected={on}>
                    <span className="n">{k + 1}</span>{d.label}
                    {inLeft && <span className="where" title="in the left pane">L</span>}
                    {inRight && <span className="where" title="in the right pane">R</span>}
                  </button>
                </span>
              );
            })}
          </div>
        </div>
        <div className="pg-panes" style={{ '--pane-split': `${paneSplit}%` } as CSSProperties}>
          {pane('left')}
          <Splitter label="Resize the panes" onDrag={(f) => setPaneSplit(clamp(f * 100, 20, 80))} />
          {pane('right')}
        </div>
        <NoteBar store={notes} />
      </div>
    </div>
  );
}
