// Chapter 15 widgets: stack frame layout and prologue execution.

import { useState, type ReactNode } from 'react';
import type { MFunc, MInstr, MemOp, RegOp } from '../compiler/codegen/mir';
import type { TargetName } from '../compiler/target/target';
import { printMFunc } from '../compiler/codegen/printmir';
import { Figure } from '../ui/prose';
import { Seg, Stepper, useStepper } from '../ui/controls';
import { CodeView } from '../ui/CodeView';
import { useCompile } from '../ui/useCompile';
import { exampleById } from '../examples';
import { FnPicker, useExample } from './common';

interface PState { sp: number; fp?: number; mem: Map<number, string> }

/** Abstractly execute prologue instructions: addresses are relative to the CFA. */
function runPrologue(f: MFunc, upto: number): { st: PState; instrs: MInstr[] } {
  const t = f.target;
  const pro = f.blocks[0].instrs.filter((m) => m.tag === 'prologue');
  const st: PState = { sp: 0, mem: new Map() };
  if (t.name === 'x86_64') { st.sp = -8; st.mem.set(-8, 'return address'); }
  const rn = (o: RegOp) => (o.k === 'preg' ? t.regs[o.r].name : '?');
  for (const mi of pro.slice(0, upto)) {
    const o = mi.ops;
    const isSp = (x: unknown) => (x as RegOp)?.k === 'preg' && (x as RegOp & { r: number }).r === t.sp;
    const isFp = (x: unknown) => (x as RegOp)?.k === 'preg' && (x as RegOp & { r: number }).r === t.fp;
    switch (mi.op) {
      case 'addi':
        if (isSp(o[0])) st.sp += Number((o[2] as { v: bigint }).v);
        else if (isFp(o[0])) st.fp = st.sp + Number((o[2] as { v: bigint }).v);
        break;
      case 'subi': case 'subrsp': if (isSp(o[0])) st.sp -= Number((o[o.length - 1] as { v: bigint }).v); break;
      case 'sd': case 'str': { const m = o[1] as MemOp; st.mem.set(st.sp + m.disp, `saved ${rn(o[0] as RegOp)}`); break; }
      case 'stp': { const m = o[2] as MemOp; st.mem.set(st.sp + m.disp, `saved ${rn(o[0] as RegOp)}`); st.mem.set(st.sp + m.disp + 8, `saved ${rn(o[1] as RegOp)}`); break; }
      case 'push': st.sp -= 8; st.mem.set(st.sp, `saved ${rn(o[0] as RegOp)}`); break;
      case 'mov': if (isFp(o[0])) st.fp = st.sp; break;
    }
  }
  return { st, instrs: pro };
}

const KIND_COLOR: Record<string, string> = {
  ra: 'var(--violet)', fp: 'var(--violet)', 'callee-save': 'var(--teal)', local: 'var(--amber)', spill: 'var(--red)', outgoing: 'var(--blue)', 'incoming-arg': 'var(--green)',
};

export function FrameExplorer({ example = 'sort', fn, target: t0 = 'rv64', caption, maxRegs, framePointer }: { example?: string; fn?: string; target?: TargetName; caption?: ReactNode; maxRegs?: number; framePointer?: boolean }) {
  const [target, setTarget] = useState<TargetName>(t0);
  const ctx = useExample(example, undefined, fn);
  const r = useCompile(exampleById(example).src, { target, run: false, asmOnly: true, maxRegs, framePointer });
  const fs = r.funcs.find((f) => f.name === ctx.fn);
  const f = fs?.framed;
  const nPro = f ? f.blocks[0].instrs.filter((m) => m.tag === 'prologue').length : 0;
  const s = useStepper(nPro + 1, { interval: 800, initial: nPro });
  if (!f || !fs) return null;
  const { st, instrs } = runPrologue(f, s.i);
  const fr = f.frame;
  const size = fr.size;
  // rows of 8 bytes from CFA+16 down to CFA-size
  const rows: { off: number; label: string; kind?: string }[] = [];
  const hi = Math.max(8, ...fr.objects.filter((o) => o.kind === 'incoming-arg').map((o) => (o.cfaOffset ?? 0) + 8));
  for (let a = hi - 8; a >= -size; a -= 8) {
    const obj = fr.objects.find((o) => o.cfaOffset !== undefined && a >= o.cfaOffset && a < o.cfaOffset + Math.max(8, o.size));
    rows.push({ off: a, label: obj ? obj.name : a >= 0 ? "caller's frame" : 'padding (alignment)', kind: obj?.kind });
  }
  const pro = new Set(instrs.map((m) => m.id));
  const lines = printMFunc(f, { post: true, comments: false });
  const curId = instrs[s.i - 1]?.id;
  return (
    <Figure title="Stack frame layout" caption={caption} controls={<><FnPicker ctx={ctx} /><Seg value={target} onChange={setTarget} options={[['rv64', 'RISC-V'], ['aarch64', 'AArch64'], ['x86_64', 'x86-64']]} /></>}>
      <div className="panes" style={{ gridTemplateColumns: 'minmax(260px, 0.9fr) 1.2fr' }}>
        <div className="pane" style={{ padding: '10px 12px', overflow: 'auto', maxHeight: 520 }}>
          <div className="muted sans" style={{ fontSize: 11.5, marginBottom: 6 }}>higher addresses ↑ · the stack grows down ↓</div>
          <div className="frame-stack">
            {rows.map((row) => {
              const filled = st.mem.get(row.off);
              const isSp = row.off === st.sp;
              const isFp = st.fp !== undefined && row.off === st.fp;
              return (
                <div key={row.off} className="frame-slot" style={{ background: row.off >= st.sp ? undefined : 'color-mix(in srgb, var(--ink) 4%, transparent)', opacity: row.off >= st.sp || s.i === nPro ? 1 : 0.45, borderTop: row.off === -8 ? '2px solid var(--ink-2)' : undefined }}>
                  <span className="off">{row.off === 0 ? 'CFA' : `CFA${row.off}`}{s.i === nPro && row.off >= -size ? <div style={{ fontSize: 10 }}>sp+{row.off + size}</div> : null}</span>
                  <span className="obj">
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: row.kind ? KIND_COLOR[row.kind] : 'var(--rule-2)', flexShrink: 0 }} />
                    <span style={{ color: row.kind ? undefined : 'var(--muted)' }}>{row.label}</span>
                    {filled && <span className="pill green">{filled}</span>}
                    {isSp && <span className="pill accent">← sp</span>}
                    {isFp && <span className="pill violet">← fp</span>}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="row" style={{ marginTop: 10, fontFamily: 'var(--sans)', fontSize: 12 }}>
            <span className="badge accent">frame {size} bytes</span>
            <span className="badge">{f.isLeaf ? 'leaf function' : 'makes calls'}</span>
            {fr.savedRegs.length > 0 && <span className="badge">saves {fr.savedRegs.map((x) => f.target.regs[x].name).join(', ')}</span>}
          </div>
        </div>
        <div className="pane">
          <CodeView lines={lines} target={target} maxHeight={520} notes mark={(l) => {
            const id = Number(l.key?.split(':').pop());
            if (id === curId) return 'current';
            if (pro.has(id)) return 'focus';
            return l.tag === 'epilogue' ? 'focus' : undefined;
          }} />
        </div>
      </div>
      <div className="step-desc">
        {s.i === 0 ? <>Before the prologue runs: sp is at the CFA{target === 'x86_64' ? ' minus the 8-byte return address pushed by call' : ''}, and nothing is saved yet.</>
          : <>After <b className="mono">{instrs[s.i - 1] ? lines.find((l) => l.key === `m:${f.name}:${curId}`)?.toks.map((x) => x.t).join('') : ''}</b>: {instrs[s.i - 1]?.note}</>}
      </div>
      <Stepper s={s} label={<span className="badge">prologue</span>} />
    </Figure>
  );
}
