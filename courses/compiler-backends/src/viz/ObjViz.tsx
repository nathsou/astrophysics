// Chapters 19 & 20 widgets: ELF explorer, linker, emulator.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { parseElf, type ElfFile, type ElfRegion } from '../compiler/obj/elf';
import { runtimeObject } from '../compiler/obj/runtime';
import { RV64, STACK_TOP } from '../compiler/sim/rv64';
import { RV_ABI } from '../compiler/emit/rv64asm';
import { Figure } from '../ui/prose';
import { Seg, Stepper, useStepper } from '../ui/controls';
import { useCompile } from '../ui/useCompile';
import { exampleById } from '../examples';
import { hideTip, showTip } from '../ui/store';
import { asmTokens } from './asmtok';

const KIND_SW: Record<string, string> = {
  header: 'var(--blue)', phdr: 'var(--teal)', shdr: 'var(--violet)', code: 'var(--accent)', data: 'var(--green)', symbol: 'var(--amber)', reloc: 'var(--red)', string: 'var(--muted)',
};

function HexView({ elf, sel, onSel, highlight }: { elf: ElfFile; sel: ElfRegion | null; onSel: (r: ElfRegion | null) => void; highlight?: [number, number] }) {
  const bytes = elf.bytes;
  const regionAt = useMemo(() => {
    const m: (ElfRegion | undefined)[] = new Array(bytes.length);
    // smallest region wins
    const rs = [...elf.regions].sort((a, b) => (b.end - b.start) - (a.end - a.start));
    for (const r of rs) for (let i = r.start; i < r.end && i < bytes.length; i++) m[i] = r;
    return m;
  }, [elf, bytes.length]);
  const rows = [];
  for (let off = 0; off < bytes.length; off += 16) {
    const cells = [];
    let asc = '';
    for (let i = off; i < Math.min(off + 16, bytes.length); i++) {
      const r = regionAt[i];
      const inSel = sel && i >= sel.start && i < sel.end;
      const hl = highlight && i >= highlight[0] && i < highlight[1];
      cells.push(
        <span key={i} className={`hb ${i % 8 === 0 && i % 16 ? 'sep' : ''} ${r ? `rg-${r.kind}` : ''} ${inSel || hl ? 'sel' : ''}`} onMouseEnter={() => r && onSel(r)}>
          {bytes[i].toString(16).padStart(2, '0')}
        </span>,
      );
      asc += bytes[i] >= 32 && bytes[i] < 127 ? String.fromCharCode(bytes[i]) : '.';
    }
    rows.push(<div key={off} className="hrow"><span className="hoff">{off.toString(16).padStart(6, '0')}</span>{cells}<span className="hasc">{asc}</span></div>);
  }
  return <div className="hex" style={{ padding: '8px 10px' }}>{rows}</div>;
}

export function ElfExplorer({ example = 'sieve', which: w0 = 'obj', caption }: { example?: string; which?: 'obj' | 'exe' | 'runtime'; caption?: ReactNode }) {
  const [which, setWhich] = useState(w0);
  const r = useCompile(exampleById(example).src, { target: 'rv64', run: false });
  const bytes = which === 'obj' ? r.objBytes : which === 'exe' ? r.link?.exe : runtimeObject();
  const elf = useMemo(() => (bytes ? parseElf(bytes) : undefined), [bytes]);
  const [sel, setSel] = useState<ElfRegion | null>(null);
  const [pinned, setPinned] = useState<ElfRegion | null>(null);
  if (!elf) return null;
  const cur = pinned ?? sel ?? elf.regions[0];
  const reloc = cur?.kind === 'reloc' ? elf.relocs.find((x) => cur.label.includes(x.typeName) && cur.fields?.[0].value === '0x' + x.offset.toString(16)) : undefined;
  const target = reloc ? elf.sections.find((s) => s.name === reloc.target) : undefined;
  const hl: [number, number] | undefined = reloc && target ? [target.offset + reloc.offset, target.offset + reloc.offset + 4] : undefined;
  return (
    <Figure title="Inside an ELF file" caption={caption} controls={<Seg value={which} onChange={(v) => { setWhich(v); setPinned(null); setSel(null); }} options={[['obj', 'program.o'], ['runtime', 'runtime.o'], ['exe', 'a.out (linked)']]} />}>
      <div className="panes" style={{ gridTemplateColumns: 'minmax(0, 1.25fr) minmax(250px, 1fr)' }}>
        <div className="pane" style={{ maxHeight: 520, overflow: 'auto' }} onMouseLeave={() => setSel(null)} onClick={() => setPinned(sel)}>
          <HexView elf={elf} sel={cur} onSel={setSel} highlight={hl} />
        </div>
        <div className="pane" style={{ maxHeight: 520, overflow: 'auto' }}>
          <div className="pane-head">{cur?.label ?? ''}<span className="spacer" />{pinned && <button className="chip-btn" onClick={() => setPinned(null)}>unpin</button>}</div>
          {cur?.fields ? (
            <table className="dtable">
              <thead><tr><th>field</th><th>offset</th><th>value</th></tr></thead>
              <tbody>{cur.fields.map((f) => <tr key={f.name + f.off}><td>{f.name}</td><td>{f.off}</td><td>{f.value}{f.desc && <div className="muted sans" style={{ fontSize: 11 }}>{f.desc}</div>}</td></tr>)}</tbody>
            </table>
          ) : cur ? <p className="sans" style={{ fontSize: 13, padding: '0 12px' }}>{cur.kind === 'code' ? 'Machine code: the bytes of the functions, back to back.' : cur.kind === 'string' ? 'A string table: NUL-terminated names, referenced by offset from symbols and section headers.' : cur.kind === 'data' ? 'Initialised data.' : ''} {cur.end - cur.start} bytes at file offset {cur.start}.</p> : null}
          {reloc && <p className="sans" style={{ fontSize: 12.5, padding: '0 12px' }}>The highlighted 4 bytes in <b>{reloc.target}</b> are the instruction this relocation patches.</p>}
          <div className="pane-head" style={{ marginTop: 6 }}>regions (hover the bytes, click to pin)</div>
          <div className="region-list">
            {elf.regions.filter((x) => x.kind !== 'symbol' || x.start === elf.regions.find((y) => y.kind === 'symbol')?.start).map((x, i) => (
              <div key={i} className={`rg ${x === cur ? 'sel' : ''}`} onClick={() => setPinned(x)}>
                <span className="sw" style={{ background: KIND_SW[x.kind] }} />{x.label}<span className="muted" style={{ marginLeft: 'auto' }}>{x.end - x.start} B</span>
              </div>
            ))}
            {elf.regions.some((x) => x.kind === 'symbol') && <div className="muted" style={{ padding: '2px 10px', fontSize: 11 }}>…{elf.symbols.length} symbols, {elf.relocs.length} relocations (hover them in the hex view)</div>}
          </div>
        </div>
      </div>
      <div className="stat-row">{Object.entries(KIND_SW).map(([k, c]) => <span key={k}><span className="pill" style={{ background: `color-mix(in srgb, ${c} 18%, transparent)` }}>{k}</span></span>)}<span>{elf.bytes.length} bytes</span></div>
    </Figure>
  );
}

export function LinkerExplorer({ example = 'sieve', caption }: { example?: string; caption?: ReactNode }) {
  const r = useCompile(exampleById(example).src, { target: 'rv64', run: false });
  const L = r.link;
  const s = useStepper(L?.relocs.length ?? 0, { interval: 1200 });
  if (!L) return r.error ? <Figure title="Linking"><div className="error-box">{r.error.msg}</div></Figure> : null;
  const rel = L.relocs[s.i];
  const hex = (n: number) => '0x' + n.toString(16);
  return (
    <Figure title="The linker at work" caption={caption}>
      <div className="panes" style={{ gridTemplateColumns: '1fr 1.2fr' }}>
        <div className="pane" style={{ padding: 10, maxHeight: 480, overflow: 'auto' }}>
          <div className="pane-head" style={{ margin: '-10px -10px 8px' }}>address map</div>
          {L.image.sections.map((sec) => (
            <div key={sec.name} style={{ border: '1px solid var(--rule-2)', borderRadius: 8, marginBottom: 8, overflow: 'hidden', fontFamily: 'var(--sans)', fontSize: 12.5 }}>
              <div style={{ padding: '4px 8px', background: 'var(--bg-2)', display: 'flex', gap: 8 }}><b>{sec.name}</b><span className="mono muted">{hex(sec.addr)}</span><span className="muted" style={{ marginLeft: 'auto' }}>{sec.size} B</span></div>
              {L.placements.filter((p) => p.out === sec.name).map((p) => (
                <div key={p.file} style={{ padding: '3px 8px', borderTop: '1px solid var(--rule)' }}>
                  <span className="mono">{hex(p.addr)}</span> <b>{p.file}</b> <span className="muted">{p.size} B</span>
                  <div style={{ paddingLeft: 12 }}>
                    {L.symbols.filter((y) => y.file === p.file && y.section === sec.name && !y.name.startsWith('.L')).map((y) => (
                      <span key={y.name} className={`set-chip ${y.global ? 'preg' : ''}`} title={y.global ? 'global' : 'local'}>{y.name} @{hex(y.addr)}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
          <div className="sans muted" style={{ fontSize: 12 }}>entry point: <b className="mono">_start @{hex(L.entry)}</b></div>
        </div>
        <div className="pane" style={{ maxHeight: 480, overflow: 'auto' }}>
          <div className="pane-head">relocations</div>
          <table className="dtable">
            <thead><tr><th>#</th><th>type</th><th>symbol</th><th>P</th><th>S</th><th>value</th></tr></thead>
            <tbody>{L.relocs.map((x, i) => (
              <tr key={i} className={i === s.i ? 'cur' : ''} onClick={() => s.set(i)} style={{ cursor: 'pointer' }}>
                <td>{i + 1}</td><td>{x.type.replace('R_RISCV_', '')}</td><td>{x.sym}</td><td>{hex(x.P)}</td><td>{hex(x.S)}</td><td>{x.value}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
      {rel && (
        <div className="step-desc">
          <b>{rel.type}</b> against <b>{rel.sym}</b> in {rel.file}: P (place) = {hex(rel.P)}, S (symbol) = {hex(rel.S)}, A = {String(rel.A)}; value = {rel.formula} = <b>{rel.value}</b>. {rel.explain}.
          <div className="mono" style={{ marginTop: 6, fontSize: 12.5 }}>
            <div>before: <span className="muted">{rel.before.toString(16).padStart(8, '0')}</span>  {rel.beforeText}</div>
            <div>after:&nbsp; <span style={{ color: 'var(--accent)' }}>{rel.after.toString(16).padStart(8, '0')}</span>  {rel.afterText}</div>
          </div>
        </div>
      )}
      <Stepper s={s} />
    </Figure>
  );
}

export function EmulatorView({ example = 'fib', caption, src: srcProp }: { example?: string; caption?: ReactNode; src?: string }) {
  const r = useCompile(srcProp ?? exampleById(example).src, { target: 'rv64', opt: 2 });
  const exe = r.link?.exe;
  const emu = useRef<RV64 | null>(null);
  const [tick, setTick] = useState(0);
  const [prevRegs, setPrev] = useState<bigint[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const reset = () => { if (exe) { emu.current = new RV64(exe); setPrev([...emu.current.x]); setErr(null); setTick((t) => t + 1); } };
  useEffect(reset, [exe]); // eslint-disable-line react-hooks/exhaustive-deps
  const step = (n: number) => {
    const m = emu.current;
    if (!m || m.exited) return;
    setPrev([...m.x]);
    try { for (let i = 0; i < n && !m.exited; i++) m.step(); } catch (e) { setErr((e as Error).message); }
    setTick((t) => t + 1);
  };
  const stepOver = () => {
    const m = emu.current;
    if (!m || m.exited) return;
    const w = m.view.getUint32(m.pc, true);
    const isCall = (w & 0x7f) === 0x17 && ((w >>> 7) & 31) === 1; // auipc ra: start of a call
    if (!isCall) return step(1);
    const ret = m.pc + 8;
    setPrev([...m.x]);
    try { let n = 0; while (!m.exited && m.pc !== ret && n++ < 5_000_000) m.step(); } catch (e) { setErr((e as Error).message); }
    setTick((t) => t + 1);
  };
  const m = emu.current;
  void tick;
  if (!m) return r.error ? <Figure title="Running the program"><div className="error-box">{r.error.msg}</div></Figure> : null;
  const around: number[] = [];
  for (let a = m.pc - 16; a <= m.pc + 28; a += 4) if (a >= m.textLo && a < m.textHi) around.push(a);
  const sp = Number(BigInt.asUintN(64, m.x[2]));
  const stackRows: [number, bigint][] = [];
  for (let a = sp; a < Math.min(STACK_TOP, sp + 64); a += 8) stackRows.push([a, m.view.getBigInt64(a, true)]);
  return (
    <Figure title="Running the linked executable on an RV64 emulator" caption={caption} controls={
      <>
        <button className="chip-btn" onClick={() => step(1)}>step</button>
        <button className="chip-btn" onClick={stepOver} title="run until the call returns">step over call</button>
        <button className="chip-btn" onClick={() => step(100)}>+100</button>
        <button className="chip-btn primary" onClick={() => step(20_000_000)}>run to exit</button>
        <button className="chip-btn" onClick={reset}>reset</button>
      </>
    }>
      <div className="panes" style={{ gridTemplateColumns: '1.1fr 1fr 0.8fr' }}>
        <div className="pane">
          <div className="pane-head">pc = 0x{m.pc.toString(16)} <span className="muted" style={{ textTransform: 'none' }}>({m.symbolize(m.pc)})</span></div>
          <div className="code" style={{ padding: '6px 0' }}>
            {around.map((a) => (
              <div key={a} className={`ln ${a === m.pc ? 'm-current' : ''}`}>
                <span className="addr">{a.toString(16)}</span>
                <span className="txt">{asmTokens(m.disasm(a), 'rv64').map((t, i) => <span key={i} className={t.c ? `t-${t.c}` : undefined}>{t.t}</span>)}</span>
                <span className="muted" style={{ fontSize: 10.5, fontFamily: 'var(--sans)' }}>{m.profile.get(a) ? `×${m.profile.get(a)}` : ''}</span>
              </div>
            ))}
          </div>
          <div className="pane-head">output</div>
          <div className="output-box" style={{ maxHeight: 120, overflow: 'auto' }}>{m.output || <span className="muted">(nothing yet)</span>}{m.exited ? <span className="muted">{`\n[exited with code ${m.exitCode}]`}</span> : null}{err && <span className="t-err">{`\n${err}`}</span>}</div>
        </div>
        <div className="pane">
          <div className="pane-head">registers <span className="spacer" /><span className="muted" style={{ textTransform: 'none' }}>{m.steps.toLocaleString()} steps</span></div>
          <div className="regfile" style={{ gridTemplateColumns: 'repeat(2, 1fr)', padding: 8, gap: 3 }}>
            {m.x.map((v, i) => (
              <div key={i} className={`rg ${prevRegs[i] !== undefined && prevRegs[i] !== v ? 'changed' : ''}`} style={{ padding: '1px 6px' }}
                onMouseEnter={(e) => showTip(e.currentTarget, { info: { kind: 'reg', target: 'rv64', reg: i } })} onMouseLeave={hideTip}>
                <span className="nm" style={{ minWidth: 30 }}>{RV_ABI[i]}</span>
                <span className="mono" style={{ fontSize: 11 }}>{i === 2 || i === 1 || (v > 0x10000n && v < BigInt(STACK_TOP) + 16n) ? '0x' + BigInt.asUintN(64, v).toString(16) : v.toString()}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="pane">
          <div className="pane-head">stack (from sp up)</div>
          <table className="dtable">
            <tbody>{stackRows.map(([a, v]) => <tr key={a} className={m.lastWrite && m.lastWrite.addr >= a && m.lastWrite.addr < a + 8 ? 'changed' : ''}><td className="muted">sp+{a - sp}</td><td>{v > 0x10000n && v < 0x20000n ? `0x${v.toString(16)} (${m.symbolize(Number(v))})` : v.toString()}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </Figure>
  );
}

export { Stepper };
