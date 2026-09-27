// Chapter 6 widgets: register files and a three-target comparison.

import { useState, type ReactNode } from 'react';
import { Figure } from '../ui/prose';
import { Seg } from '../ui/controls';
import { CodeView } from '../ui/CodeView';
import { showTip, hideTip } from '../ui/store';
import { targetFor } from '../ui/explain';
import { printMFunc } from '../compiler/codegen/printmir';
import type { TargetName } from '../compiler/target/target';
import { useCompile } from '../ui/useCompile';
import { exampleById } from '../examples';
import { FnPicker, useExample } from './common';

const TARGETS: [TargetName, string][] = [['rv64', 'RISC-V'], ['aarch64', 'AArch64'], ['x86_64', 'x86-64']];

export function RegisterFile({ target: t0 = 'rv64', caption }: { target?: TargetName; caption?: ReactNode }) {
  const [target, setTarget] = useState<TargetName>(t0);
  const t = targetFor(target)!;
  const regs = t.regs.map((r, i) => ({ r, i })).filter(({ r }) => !['nzcv', 'rflags'].includes(r.name));
  return (
    <Figure title="Register file and conventions" caption={caption} controls={<Seg value={target} onChange={setTarget} options={TARGETS} />}>
      <div className="regfile">
        {regs.map(({ r, i }) => (
          <div
            key={i}
            className={`rg ${!r.allocatable ? 'special' : r.calleeSaved ? 'callee' : 'caller'}`}
            onMouseEnter={(e) => showTip(e.currentTarget, { info: { kind: 'reg', target, reg: i } })}
            onMouseLeave={hideTip}
          >
            <span className="nm">{r.name}</span>
            {r.arch !== r.name && <span className="ar">{r.arch}</span>}
          </div>
        ))}
      </div>
      <div className="stat-row">
        <span><span className="pill" style={{ borderLeft: '3px solid var(--amber)' }}>caller-saved</span> clobbered by calls</span>
        <span><span className="pill" style={{ borderLeft: '3px solid var(--teal)' }}>callee-saved</span> preserved across calls</span>
        <span><span className="pill" style={{ borderLeft: '3px solid var(--violet)' }}>reserved</span> sp, zero, fp, ...</span>
        <span>allocatable: <b>{t.allocOrder.length}</b></span>
        <span>arguments in registers: <b>{t.argRegs.map((r) => t.regs[r].name).join(', ')}</b></span>
      </div>
    </Figure>
  );
}

export function TargetCompare({ example = 'sort', fn, caption, stage = 'final' }: { example?: string; fn?: string; caption?: ReactNode; stage?: 'isel' | 'final' }) {
  const src = exampleById(example).src;
  const ctx = useExample(example, undefined, fn);
  const rs = {
    rv64: useCompile(src, { target: 'rv64', run: false }),
    aarch64: useCompile(src, { target: 'aarch64', run: false }),
    x86_64: useCompile(src, { target: 'x86_64', run: false }),
  };
  return (
    <Figure title="One function, three instruction sets" caption={caption} controls={<FnPicker ctx={ctx} />}>
      <div className="panes" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        {TARGETS.map(([t, label]) => {
          const r = rs[t];
          const fs = r.funcs.find((f) => f.name === ctx.fn);
          const mf = fs && (stage === 'isel' ? fs.isel : fs.final);
          const n = mf ? mf.blocks.reduce((s, b) => s + b.instrs.length, 0) : 0;
          const sym = r.obj?.symbols.find((s) => s.name === ctx.fn);
          return (
            <div className="pane" key={t}>
              <div className="pane-head">{label}<span className="spacer" /><span className="pill">{n} instrs</span>{sym && <span className="pill accent">{sym.size} bytes</span>}</div>
              {mf && <CodeView lines={printMFunc(mf, { post: stage === 'final', comments: false })} target={t} maxHeight={480} notes />}
            </div>
          );
        })}
      </div>
    </Figure>
  );
}
