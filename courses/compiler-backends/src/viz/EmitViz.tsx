// Chapters 17 & 18 widgets: peephole diff, instruction encoding, machine code, relaxation.

import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { printMFunc } from '../compiler/codegen/printmir';
import { encodeRV, expandRV, parseRVAsm, disasmRV, assembleRV, RV_ENC } from '../compiler/emit/rv64asm';
import { rvItems } from '../compiler/emit/emit';
import type { EncField, ListingEntry } from '../compiler/emit/objcode';
import type { TargetName } from '../compiler/target/target';
import { Figure } from '../ui/prose';
import { Seg } from '../ui/controls';
import { CodeView } from '../ui/CodeView';
import { useCompile } from '../ui/useCompile';
import { exampleById } from '../examples';
import { entryLine } from './asmtok';
import { FnPicker, useExample } from './common';

export function PeepholeExplorer({ example = 'gcd', fn, target: t0 = 'rv64', caption }: { example?: string; fn?: string; target?: TargetName; caption?: ReactNode }) {
  const [target, setTarget] = useState<TargetName>(t0);
  const ctx = useExample(example, undefined, fn);
  const r = useCompile(exampleById(example).src, { target, run: false, asmOnly: true });
  const fs = r.funcs.find((f) => f.name === ctx.fn);
  if (!fs) return null;
  const afterIds = new Set(fs.final.blocks.flatMap((b) => b.instrs.map((m) => m.id)));
  const touched = new Set(fs.peephole.map((p) => p.instr));
  const beforeMark = (l: { key?: string }) => {
    const id = Number(l.key?.split(':').pop());
    if (!l.key?.startsWith('m:')) return undefined;
    if (!afterIds.has(id)) return 'removed';
    if (touched.has(id)) return 'changed';
    return undefined;
  };
  return (
    <Figure title="Peephole optimisation" caption={caption} controls={<><FnPicker ctx={ctx} /><Seg value={target} onChange={setTarget} options={[['rv64', 'RISC-V'], ['aarch64', 'AArch64'], ['x86_64', 'x86-64']]} /></>}>
      <div className="panes" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="pane"><div className="pane-head">before (after frame lowering)</div><CodeView lines={printMFunc(fs.framed, { post: true, comments: false })} target={target} maxHeight={440} notes mark={beforeMark} /></div>
        <div className="pane"><div className="pane-head">after</div><CodeView lines={printMFunc(fs.final, { post: true, comments: false })} target={target} maxHeight={440} notes mark={(l) => (touched.has(Number(l.key?.split(':').pop())) ? 'changed' : undefined)} /></div>
      </div>
      <div style={{ borderTop: '1px solid var(--rule)', padding: '6px 14px', fontFamily: 'var(--sans)', fontSize: 12.5, maxHeight: 160, overflow: 'auto' }}>
        {fs.peephole.length ? fs.peephole.map((p, i) => <div key={i}><span className="pill accent">{p.rule}</span> <span className="muted">{p.block}:</span> {p.msg}</div>) : <span className="muted">No rule fired in this function.</span>}
      </div>
    </Figure>
  );
}

// ------------------------------------------------------------------ bit fields

/** what a field holds, for colour-coding: the same four hues on every target */
export type FieldKind = 'op' | 'reg' | 'imm' | 'mod';
const KIND_LABEL: Record<FieldKind, string> = { op: 'opcode / function', reg: 'register', imm: 'immediate / offset', mod: 'modifier' };
export function fieldKind(name: string): FieldKind {
  const n = name.toLowerCase();
  if (/^(imm|shamt|disp|rel|hw$|sh$)/.test(n)) return 'imm';
  if (/^(rd|rs[12]|rn|rm|rt2?|modrm|sib)$/.test(n)) return 'reg';
  if (/^(rex|cond|option|s|n)$/.test(n)) return 'mod';
  return 'op';
}
/** a short label for a field too narrow for its name: "imm[12]" → "i12" */
const shortName = (name: string) => name.replace(/^imm\[(\d+)(?::(\d+))?\]$/, (_, a: string, b?: string) => (b ? `i${a}:${b}` : `i${a}`));

export function BitFields({ fields, bytes }: { fields: EncField[]; bytes?: boolean }) {
  const sorted = [...fields].sort((a, b) => b.hi - a.hi);
  const kinds = [...new Set(sorted.map((f) => fieldKind(f.name)))];
  return (
    <div className="bits-wrap">
      <div className="bits">
        {sorted.map((f, i) => {
          const n = f.hi - f.lo + 1;
          const bitsStr = bytes ? [] : f.value.toString(2).padStart(n, '0').slice(-n).split('');
          const k = fieldKind(f.name);
          const full = `${f.name} [${f.hi}:${f.lo}]${f.meaning ? ' = ' + f.meaning : ''} (${KIND_LABEL[k]})`;
          // a 1- or 2-bit field is too narrow for "imm[12]": it is widened to fit, and
          // in a narrow figure (container query) shows a short label instead
          const narrow = !bytes && n <= 2 && f.name.length > 3;
          return (
            <div key={i} className={`fld fk-${k}${narrow ? ' narrow' : ''}`} style={{ flex: `${n} 1 0`, ...(bytes ? {} : { '--n': n }) } as CSSProperties} title={full}>
              <div className="nm">{narrow ? <><span className="long">{f.name}</span><abbr className="short" title={f.name}>{shortName(f.name)}</abbr></> : f.name}</div>
              {bytes
                ? <div className="bv" style={{ fontSize: 11.5 }}>{Array.from({ length: n / 8 }, (_, k) => ((f.value >>> (8 * k)) & 0xff).toString(16).padStart(2, '0')).join(' ')}</div>
                : <div className="bv">{bitsStr.map((b, k) => <span key={k} className={b === '1' ? 'b1' : 'b0'}>{b}</span>)}</div>}
              <div className="mn">{f.meaning ?? (bytes ? '' : `0x${f.value.toString(16)}`)}</div>
              {!bytes && <div className="rg">{f.hi === f.lo ? f.hi : `${f.hi}:${f.lo}`}</div>}
            </div>
          );
        })}
      </div>
      <div className="bits-key" aria-hidden="true">{kinds.map((k) => <span key={k} className={`fk-${k}`}><i />{KIND_LABEL[k]}</span>)}</div>
    </div>
  );
}

const PRESETS = ['add a0, a1, a2', 'addi a0, a1, -42', 'sd ra, 8(sp)', 'ld s1, -16(s0)', 'beq a0, a1, -64', 'jal ra, 2048', 'lui a0, 0x12345', 'slli t0, t1, 3', 'mul a0, a0, a1', 'sh3add a0, a1, a2', 'li a0, 0x12345678', 'li a0, -1', 'mv a0, s1', 'ret', 'call print_int', 'seqz a0, a1', 'ecall'];

export function EncodingExplorer({ initial = 'addi a0, a1, -42', caption }: { initial?: string; caption?: ReactNode }) {
  const [txt, setTxt] = useState(initial);
  const result = useMemo(() => {
    try {
      const items = parseRVAsm(txt);
      const ins = items.find((i) => i.k === 'instr');
      if (!ins || ins.k !== 'instr') return { error: 'type one RISC-V instruction' };
      const i = ins.ins;
      // branch/jump with a numeric offset: encode directly
      const last = i.ops[i.ops.length - 1];
      if ((RV_ENC[i.op]?.f === 'B' || i.op === 'jal') && last?.k === 'imm') {
        const regs = i.ops.filter((o) => o.k === 'reg').map((o) => (o as { r: number }).r);
        const e = i.op === 'jal' ? encodeRV('jal', regs[0] ?? 1, 0, 0, Number(last.v)) : encodeRV(i.op, 0, regs[0], regs[1], Number(last.v));
        return { parts: [{ text: txt, ...e }] };
      }
      const reals = expandRV(i, () => '.Lpcrel_hi0');
      return {
        pseudo: reals.length > 1 || reals[0].op !== i.op,
        parts: reals.map((r) => ({ text: r.text, ...encodeRV(r.op, r.rd, r.rs1, r.rs2, r.imm), reloc: r.kind === 'call_auipc' || r.kind === 'pcrel_hi' || r.kind === 'pcrel_lo' })),
      };
    } catch (e) { return { error: (e as Error).message }; }
  }, [txt]);
  return (
    <Figure title="Encoding RISC-V instructions" caption={caption} controls={<input className="select mono" value={txt} onChange={(e) => setTxt(e.target.value)} style={{ width: 260 }} aria-label="instruction" />}>
      <div className="row" style={{ padding: '8px 12px', gap: 5, borderBottom: '1px solid var(--rule)' }}>{PRESETS.map((p) => <button key={p} className="chip-btn mono" style={{ fontSize: 11 }} onClick={() => setTxt(p)}>{p}</button>)}</div>
      <div style={{ padding: '4px 14px 12px' }}>
        {'error' in result ? <div className="error-box" style={{ margin: '8px 0' }}>{result.error}</div> : (
          <>
            {result.pseudo && <p className="sans" style={{ fontSize: 13, margin: '10px 0 0' }}><span className="badge warn">pseudo-instruction</span> the assembler expands <b className="mono">{txt}</b> into {result.parts.length} real instruction{result.parts.length > 1 ? 's' : ''}:</p>}
            {result.parts.map((p, k) => (
              <div key={k} style={{ marginTop: 10 }}>
                <div className="row sans" style={{ fontSize: 13 }}>
                  <b className="mono">{p.text}</b>
                  <span className="badge accent">{p.format}-type</span>
                  <span className="badge mono">0x{p.word.toString(16).padStart(8, '0')}</span>
                  <span className="badge mono">bytes (LE): {[0, 1, 2, 3].map((b) => ((p.word >>> (8 * b)) & 0xff).toString(16).padStart(2, '0')).join(' ')}</span>
                  <span className="muted mono" style={{ fontSize: 12 }}>disassembles as: {disasmRV(p.word)}</span>
                  {'reloc' in p && p.reloc && <span className="badge warn">immediate filled in by a relocation</span>}
                </div>
                <BitFields fields={p.fields} />
              </div>
            ))}
          </>
        )}
      </div>
    </Figure>
  );
}

function FieldsFor({ e, target }: { e: ListingEntry; target: string }) {
  if (!e.fields) return null;
  if (target === 'x86_64') return <BitFields fields={e.fields} bytes />;
  return <BitFields fields={e.fields} />;
}

export function MachineCodeCompare({ example = 'gcd', fn, caption }: { example?: string; fn?: string; caption?: ReactNode }) {
  const ctx = useExample(example, undefined, fn);
  const src = exampleById(example).src;
  const rs = { rv64: useCompile(src, { target: 'rv64', run: false }), aarch64: useCompile(src, { target: 'aarch64', run: false }), x86_64: useCompile(src, { target: 'x86_64', run: false }) };
  const [sel, setSel] = useState<{ t: string; i: number } | null>(null);
  const cols: [TargetName, string][] = [['rv64', 'RISC-V'], ['aarch64', 'AArch64'], ['x86_64', 'x86-64']];
  const selected = sel && rs[sel.t as TargetName].obj?.listing.filter((e) => e.fn === ctx.fn && !e.label)[sel.i];
  return (
    <Figure title="Machine code, three ways — click an instruction" caption={caption} controls={<FnPicker ctx={ctx} />}>
      <div className="panes" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        {cols.map(([t, label]) => {
          const entries = rs[t].obj?.listing.filter((e) => e.fn === ctx.fn) ?? [];
          const instrs = entries.filter((e) => !e.label);
          const bytes = instrs.reduce((s, e) => s + e.bytes.length, 0);
          const lines = entries.map((e) => entryLine(e, t));
          return (
            <div className="pane" key={t}>
              <div className="pane-head">{label}<span className="spacer" /><span className="pill">{instrs.length} instrs</span><span className="pill accent">{bytes} B</span></div>
              <CodeView lines={lines} bytes target={t} maxHeight={420} className="mc3" style={{ flex: 1 }} onLineClick={(i) => { const k = entries.slice(0, i + 1).filter((e) => !e.label).length - 1; if (!entries[i].label) setSel({ t, i: k }); }}
                mark={(_, i) => (sel?.t === t && !entries[i].label && entries.slice(0, i + 1).filter((e) => !e.label).length - 1 === sel.i ? 'current' : undefined)} />
            </div>
          );
        })}
      </div>
      <div style={{ padding: '4px 14px 10px', borderTop: '1px solid var(--rule)', minHeight: 60 }}>
        {selected ? <><div className="sans" style={{ fontSize: 13, marginTop: 8 }}><b className="mono">{selected.text}</b> <span className="muted">— {selected.format}</span></div><FieldsFor e={selected} target={sel!.t} /></> : <p className="muted sans" style={{ fontSize: 13 }}>RISC-V and AArch64 use fixed 4-byte instructions; x86-64 instructions are 1 to 15 bytes long. Click any instruction to see its fields.</p>}
      </div>
    </Figure>
  );
}

export function BranchRelaxation({ example = 'collatz', fn = 'main', caption }: { example?: string; fn?: string; caption?: ReactNode }) {
  const [range, setRange] = useState(4096);
  const r = useCompile(exampleById(example).src, { target: 'rv64', run: false, asmOnly: true });
  const res = useMemo(() => {
    if (!r.target || !r.optimized) return undefined;
    const funcs = r.funcs.filter((f) => f.name === fn).map((f) => f.final);
    try { return assembleRV(rvItems(r.target, funcs, { ...r.optimized, globals: [] } as never), { branchRange: range }); } catch (e) { return { error: (e as Error).message }; }
  }, [r, fn, range]);
  if (!res) return null;
  return (
    <Figure title="Branch relaxation" caption={caption} controls={<span className="row">pretend B-type branches reach ±<input type="range" className="range" min={16} max={4096} step={4} value={range} onChange={(e) => setRange(Number(e.target.value))} /><b className="mono">{range}</b> bytes</span>}>
      {'error' in res ? <div className="error-box">{res.error}</div> : (
        <>
          <CodeView lines={res.listing.filter((e) => e.section === '.text').map((e) => entryLine(e, 'rv64'))} gutter="addr" bytes target="rv64" maxHeight={380} notes mark={(l) => (l.note?.startsWith('relaxed') ? 'changed' : undefined)} />
          <div className="stat-row">{res.relaxations.length ? res.relaxations.map((x, i) => <span key={i} className="pill red">{x.what}</span>) : <span>All conditional branches reach their targets: no relaxation needed.</span>}</div>
        </>
      )}
    </Figure>
  );
}
