// Static-but-clickable diagrams.

import type { ReactNode } from 'react';
import { Figure } from '../ui/prose';

type Node = { t: 'data' | 'pass'; label: string; sub?: string; slug?: string };

const ROWS: Node[][] = [
  [
    { t: 'data', label: 'Kiln source', sub: 'text', slug: 'ir' },
    { t: 'pass', label: 'parse + lower', sub: 'front end', slug: 'ir' },
    { t: 'data', label: 'KIR', sub: 'allocas, loads, stores', slug: 'ir' },
    { t: 'pass', label: 'mem2reg', sub: 'dominance frontiers', slug: 'ssa' },
    { t: 'data', label: 'KIR in SSA', sub: 'phis', slug: 'ssa' },
    { t: 'pass', label: 'optimise', sub: 'fold, DCE, CSE', slug: 'optimize' },
  ],
  [
    { t: 'pass', label: 'legalise', sub: 'types, ops, libcalls', slug: 'legalization' },
    { t: 'pass', label: 'select', sub: 'tree tiling + ABI', slug: 'isel' },
    { t: 'data', label: 'MIR (SSA)', sub: 'target ops, vregs', slug: 'isel' },
    { t: 'pass', label: 'out of SSA', sub: 'parallel copies', slug: 'ssa-destruction' },
    { t: 'pass', label: 'schedule', sub: 'list scheduling', slug: 'scheduling' },
  ],
  [
    { t: 'pass', label: 'liveness', sub: 'dataflow', slug: 'liveness' },
    { t: 'pass', label: 'allocate', sub: 'IRC / linear scan', slug: 'regalloc' },
    { t: 'data', label: 'MIR', sub: 'physical registers', slug: 'spilling' },
    { t: 'pass', label: 'frame lowering', sub: 'prologue, epilogue', slug: 'frames' },
    { t: 'pass', label: 'peephole', sub: 'local rewrites', slug: 'peephole' },
  ],
  [
    { t: 'pass', label: 'encode', sub: 'expand pseudos, relax', slug: 'encoding' },
    { t: 'data', label: 'bytes + relocations', sub: '', slug: 'encoding' },
    { t: 'pass', label: 'write ELF', sub: 'sections, symbols', slug: 'objects' },
    { t: 'data', label: 'program.o', sub: '+ runtime.o', slug: 'objects' },
    { t: 'pass', label: 'link', sub: 'resolve, relocate', slug: 'linking' },
    { t: 'data', label: 'a.out', sub: 'runs in the emulator', slug: 'linking' },
  ],
];

export function PipelineDiagram({ caption }: { caption?: ReactNode }) {
  return (
    <Figure caption={caption}>
      <div style={{ padding: '18px 18px 8px', display: 'flex', flexDirection: 'column', gap: 12, fontFamily: 'var(--sans)' }}>
        {ROWS.map((row, r) => (
          <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {r > 0 && <span style={{ color: 'var(--muted)', fontSize: 16, marginRight: 2 }}>↳</span>}
            {row.map((n, i) => (
              <span key={i} style={{ display: 'contents' }}>
                {i > 0 && <span style={{ color: 'var(--muted)' }}>→</span>}
                <a href={n.slug ? `#/ch/${n.slug}` : undefined} style={{
                  textDecoration: 'none', color: 'var(--ink)', padding: n.t === 'data' ? '6px 11px' : '6px 11px', borderRadius: n.t === 'data' ? 999 : 8,
                  background: n.t === 'data' ? 'var(--accent-soft)' : 'var(--panel)', border: `1px solid ${n.t === 'data' ? 'color-mix(in srgb, var(--accent) 35%, transparent)' : 'var(--rule-2)'}`,
                  display: 'inline-flex', flexDirection: 'column', lineHeight: 1.2, fontSize: 13, fontWeight: n.t === 'data' ? 600 : 500,
                }}>
                  {n.label}
                  {n.sub && <small style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 400, fontFamily: n.t === 'data' ? 'var(--mono)' : 'var(--sans)' }}>{n.sub}</small>}
                </a>
              </span>
            ))}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
          <span><span style={{ display: 'inline-block', width: 22, height: 12, borderRadius: 999, background: 'var(--accent-soft)', verticalAlign: 'middle', marginRight: 5 }} />representation</span>
          <span><span style={{ display: 'inline-block', width: 22, height: 12, borderRadius: 3, border: '1px solid var(--rule-2)', verticalAlign: 'middle', marginRight: 5 }} />pass</span>
        </div>
      </div>
    </Figure>
  );
}
