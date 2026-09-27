// Chapter 8 widgets: constant materialisation and IR legalisation.

import { useMemo, useState, type ReactNode } from 'react';
import { Figure } from '../ui/prose';
import { Check, Seg } from '../ui/controls';
import { CodeView } from '../ui/CodeView';
import { rvMatInt } from '../compiler/target/riscv';
import { a64MatInt } from '../compiler/target/aarch64';
import { encodeRV } from '../compiler/emit/rv64asm';
import { encodeA64 } from '../compiler/emit/a64enc';
import { encodeX64 } from '../compiler/emit/x64enc';
import { R, type MInstr } from '../compiler/codegen/mir';
import { printFunc } from '../compiler/ir/print';
import { targetFor } from '../ui/explain';
import { useCompile } from '../ui/useCompile';
import { exampleById } from '../examples';

const s32 = (v: bigint) => BigInt.asIntN(32, v);
const s64 = (v: bigint) => BigInt.asIntN(64, v);
const hex = (v: bigint) => '0x' + BigInt.asUintN(64, v).toString(16).padStart(16, '0').replace(/(....)(?=.)/g, '$1_');
const wordHex = (w: number) => (w >>> 0).toString(16).padStart(8, '0');

function parseNum(s: string): bigint | undefined {
  try {
    const t = s.trim().replace(/_/g, '');
    if (!t) return undefined;
    const neg = t.startsWith('-');
    const v = BigInt(neg ? t.slice(1) : t);
    return s64(neg ? -v : v);
  } catch { return undefined; }
}

export function ConstantMaterializer({ initial = '0x12345678', caption }: { initial?: string; caption?: ReactNode }) {
  const [txt, setTxt] = useState(initial);
  const v = parseNum(txt);
  const presets = ['42', '-1', '2047', '2048', '0x7fffffff', '0x12345678', '0x80000000', '1 << 40', '0x9E3779B97F4A7C15', '-4096', '0xFFFFFFFF00000000', '0x5555555555555555'];
  const rows = useMemo(() => {
    if (v === undefined) return undefined;
    // RISC-V
    const rv = rvMatInt(v);
    let x = 0n;
    const rvRows = rv.map((s, k) => {
      if (s.op === 'lui') x = s32(s.imm << 12n);
      else if (s.op === 'addiw') x = s32((k === 0 ? 0n : x) + s.imm);
      else if (s.op === 'addi') x = s64((k === 0 ? 0n : x) + s.imm);
      else x = s64(x << s.imm);
      const src = k === 0 ? 0 : 10;
      const e = encodeRV(s.op, 10, s.op === 'lui' ? 0 : src, 0, Number(s.imm));
      return { text: s.op === 'lui' ? `lui a0, 0x${s.imm.toString(16)}` : s.op === 'slli' ? `slli a0, a0, ${s.imm}` : `${s.op} a0, ${k === 0 ? 'zero' : 'a0'}, ${s.imm}`, value: x, bytes: wordHex(e.word) };
    });
    // AArch64
    const a = a64MatInt(v);
    let y = 0n;
    const t = targetFor('aarch64')!;
    const a64Rows = a.map((s, k) => {
      let mi: MInstr;
      if (s.op === 'orri') { y = BigInt.asUintN(64, s.imm); mi = { id: 0, op: 'orri', ops: [R.pd(0), R.p(32), R.imm(s.imm)] }; }
      else {
        const lane = (s.imm & 0xffffn) << BigInt(s.shift);
        const mask = 0xffffn << BigInt(s.shift);
        if (s.op === 'movz') y = lane;
        else if (s.op === 'movn') y = BigInt.asUintN(64, ~lane);
        else y = (y & ~mask) | lane;
        mi = { id: 0, op: s.op, ops: [k ? R.defuse(R.pd(0)) : R.pd(0), R.imm(s.imm), R.imm(s.shift)] };
      }
      const e = encodeA64(t, mi, () => '');
      const text = s.op === 'orri' ? `mov x0, #${hex(s.imm)}  // orr x0, xzr, #bitmask` : `${s.op} x0, #0x${s.imm.toString(16)}${s.shift ? `, lsl #${s.shift}` : ''}`;
      return { text, value: s64(y), bytes: wordHex(e.word) };
    });
    // x86-64
    const small = v >= -(1n << 31n) && v < 1n << 31n;
    const xm: MInstr = { id: 0, op: small ? 'movri' : 'movabs', ops: [R.pd(0), R.imm(v)] };
    const xe = encodeX64(xm, () => '');
    const x86Rows = [{ text: `${small ? 'mov' : 'movabs'} rax, ${v}`, value: v, bytes: xe.bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ') }];
    return { rv: rvRows, a64: a64Rows, x86: x86Rows };
  }, [v]);
  const Col = ({ title, rs, sub }: { title: string; rs: { text: string; value: bigint; bytes: string }[]; sub: string }) => (
    <div className="pane">
      <div className="pane-head">{title}<span className="spacer" /><span className="pill accent">{rs.length} instr · {rs.reduce((s, r) => s + r.bytes.replace(/ /g, '').length / 2, 0)} B</span></div>
      <table className="dtable">
        <thead><tr><th>instruction</th><th>register afterwards</th></tr></thead>
        <tbody>{rs.map((r, k) => <tr key={k}><td>{r.text}<div className="muted" style={{ fontSize: 10.5 }}>{r.bytes}</div></td><td>{hex(r.value)}</td></tr>)}</tbody>
      </table>
      <div className="muted sans" style={{ fontSize: 11.5, padding: '6px 10px' }}>{sub}</div>
    </div>
  );
  return (
    <Figure title="Materialising a 64-bit constant" caption={caption} controls={
      <>
        <input className="select mono" value={txt} onChange={(e) => setTxt(e.target.value)} style={{ width: 210 }} aria-label="constant" />
        {presets.map((p) => <button key={p} className="chip-btn" onClick={() => setTxt(p === '1 << 40' ? String(1n << 40n) : p)}>{p}</button>)}
      </>
    }>
      {v === undefined ? <div className="error-box">Not a number.</div> : rows && (
        <div className="panes" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          <Col title="RISC-V" rs={rows.rv} sub="12-bit addi, 20-bit lui; wider constants are built recursively with shifts." />
          <Col title="AArch64" rs={rows.a64} sub="16 bits per movz/movk, or one orr if it is a bitmask immediate." />
          <Col title="x86-64" rs={rows.x86} sub="imm32 is sign-extended; anything else needs the 10-byte movabs." />
        </div>
      )}
    </Figure>
  );
}

export function LegalizeExplorer({ example = 'max', fn, caption, zicond: z0 = false, mext: m0 = true }: { example?: string; fn?: string; caption?: ReactNode; zicond?: boolean; mext?: boolean }) {
  const [mExt, setM] = useState(m0);
  const [zicond, setZ] = useState(z0);
  const [ex, setEx] = useState(example);
  const r = useCompile(exampleById(ex).src, { target: 'rv64', mExt, zicond, run: false });
  const names = r.optimized?.funcs.map((f) => f.name) ?? [];
  const f = fn && names.includes(fn) ? fn : names[0];
  const before = r.optimized?.funcs.find((x) => x.name === f);
  const after = r.legalized?.funcs.find((x) => x.name === f);
  const fs = r.funcs.find((x) => x.name === f);
  return (
    <Figure title="Legalising for RISC-V" caption={caption} controls={
      <>
        <Seg value={ex} onChange={setEx} options={[['max', 'select'], ['collatz', 'div / rem'], ['pressure', 'multiply']]} />
        <Check checked={mExt} onChange={setM}>M extension</Check>
        <Check checked={zicond} onChange={setZ}>Zicond</Check>
      </>
    }>
      {r.error && <div className="error-box">{r.error.msg}</div>}
      <div className="panes" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <div className="pane"><div className="pane-head">optimised IR</div>{before && <CodeView lines={printFunc(before)} maxHeight={380} />}</div>
        <div className="pane"><div className="pane-head">legalised IR</div>{after && <CodeView lines={printFunc(after)} maxHeight={380} notes />}</div>
        <div className="pane"><div className="pane-head">selected RISC-V</div>{fs && <CodeView lines={fs.final.blocks.flatMap((b) => b.instrs).length ? printMFuncLite(fs.final) : []} target="rv64" maxHeight={380} notes />}</div>
      </div>
      <div className="stat-row">{r.legalizeLog.length ? r.legalizeLog.map((m, i) => <span key={i}>• {m}</span>) : <span>Nothing to legalise: every operation maps onto RISC-V instructions directly.</span>}</div>
    </Figure>
  );
}

import { printMFunc } from '../compiler/codegen/printmir';
function printMFuncLite(f: Parameters<typeof printMFunc>[0]) { return printMFunc(f, { post: true, comments: false }); }
