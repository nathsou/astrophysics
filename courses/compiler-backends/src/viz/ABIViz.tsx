// Chapter 9 widgets: where arguments go under each calling convention, and call lowering in MIR.

import { useState, type ReactNode } from 'react';
import { Figure } from '../ui/prose';
import { Seg } from '../ui/controls';
import { CodeView } from '../ui/CodeView';
import { printMFunc } from '../compiler/codegen/printmir';
import type { TargetName } from '../compiler/target/target';
import { useCompile } from '../ui/useCompile';
import { exampleById } from '../examples';
import { FnPicker, useExample } from './common';

const ABIS = [
  { name: 'RISC-V LP64', regs: ['a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'], ret: 'a0 (a1 for 128-bit)', stack: (k: number) => `sp + ${8 * k}`, saved: 's0–s11', temps: 'ra, t0–t6, a0–a7', align: '16', notes: 'No red zone. Stack arguments start right at sp in the caller.' },
  { name: 'AAPCS64', regs: ['x0', 'x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7'], ret: 'x0 (x8 = address for large results)', stack: (k: number) => `sp + ${8 * k}`, saved: 'x19–x28, x29 (fp)', temps: 'x0–x18, x30 (lr)', align: '16', notes: 'Apple’s variant packs stack arguments by natural size and passes variadic arguments on the stack.' },
  { name: 'System V x86-64', regs: ['rdi', 'rsi', 'rdx', 'rcx', 'r8', 'r9'], ret: 'rax (rdx:rax for 128-bit)', stack: (k: number) => `rsp + ${8 + 8 * k} (after the return address)`, saved: 'rbx, rbp, r12–r15', temps: 'rax, rcx, rdx, rsi, rdi, r8–r11', align: '16 at the call', notes: '128-byte red zone below rsp that leaf functions may use without adjusting rsp.' },
  { name: 'Windows x64', regs: ['rcx', 'rdx', 'r8', 'r9'], ret: 'rax', stack: (k: number) => `rsp + ${8 + 32 + 8 * k} (after 32-byte shadow space)`, saved: 'rbx, rbp, rdi, rsi, r12–r15, xmm6–15', temps: 'rax, rcx, rdx, r8–r11', align: '16 at the call', notes: 'The caller always reserves 32 bytes of "home" space for the four register arguments. No red zone.' },
];

export function ABIExplorer({ caption }: { caption?: ReactNode }) {
  const [n, setN] = useState(10);
  return (
    <Figure title="Where do the arguments go?" caption={caption} controls={<span className="row">arguments: <input type="range" className="range" min={1} max={14} value={n} onChange={(e) => setN(Number(e.target.value))} /> <b className="mono">{n}</b></span>}>
      <div style={{ overflowX: 'auto' }}>
        <table className="dtable">
          <thead><tr><th>arg</th>{ABIS.map((a) => <th key={a.name}>{a.name}</th>)}</tr></thead>
          <tbody>
            {Array.from({ length: n }, (_, k) => (
              <tr key={k}>
                <td>#{k}</td>
                {ABIS.map((a) => {
                  const inReg = k < a.regs.length;
                  return <td key={a.name}>{inReg ? <span className="set-chip preg">{a.regs[k]}</span> : <span className="set-chip">[{a.stack(k - a.regs.length)}]</span>}</td>;
                })}
              </tr>
            ))}
            <tr><td className="sans">return</td>{ABIS.map((a) => <td key={a.name}>{a.ret}</td>)}</tr>
            <tr><td className="sans">callee-saved</td>{ABIS.map((a) => <td key={a.name}>{a.saved}</td>)}</tr>
            <tr><td className="sans">caller-saved</td>{ABIS.map((a) => <td key={a.name}>{a.temps}</td>)}</tr>
            <tr><td className="sans">stack align</td>{ABIS.map((a) => <td key={a.name}>{a.align}</td>)}</tr>
            <tr><td className="sans">quirks</td>{ABIS.map((a) => <td key={a.name} className="sans" style={{ fontSize: 11.5 }}>{a.notes}</td>)}</tr>
          </tbody>
        </table>
      </div>
    </Figure>
  );
}

export function CallLowering({ example = 'fib', fn, target: t0 = 'rv64', caption }: { example?: string; fn?: string; target?: TargetName; caption?: ReactNode }) {
  const [target, setTarget] = useState<TargetName>(t0);
  const ctx = useExample(example, undefined, fn);
  const r = useCompile(exampleById(example).src, { target, run: false, asmOnly: true });
  const fs = r.funcs.find((f) => f.name === ctx.fn);
  const mark = (l: { tag?: string; toks: { t: string }[] }) => (l.tag === 'abi' ? 'focus' : l.toks.some((t) => ['call', 'bl'].includes(t.t)) ? 'current' : undefined);
  return (
    <Figure title="Calls in machine IR" caption={caption} controls={<><FnPicker ctx={ctx} /><Seg value={target} onChange={setTarget} options={[['rv64', 'RISC-V'], ['aarch64', 'AArch64'], ['x86_64', 'x86-64']]} /></>}>
      <div className="panes" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="pane"><div className="pane-head">after instruction selection (virtual registers)</div>{fs && <CodeView lines={printMFunc(fs.isel)} target={target} maxHeight={440} notes mark={mark} />}</div>
        <div className="pane"><div className="pane-head">after register allocation</div>{fs && <CodeView lines={printMFunc(fs.allocated, { post: true })} target={target} maxHeight={440} notes mark={mark} />}</div>
      </div>
      <div className="stat-row"><span><span className="pill teal">teal</span> copies into/out of ABI registers</span><span><span className="pill accent">green</span> the call, with its implicit uses and clobbers</span></div>
    </Figure>
  );
}
