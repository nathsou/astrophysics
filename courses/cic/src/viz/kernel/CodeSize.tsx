// How big is the trusted code? Line counts of the course's own implementation.

import { For } from 'solid-js';

const files = import.meta.glob('@kernel/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const role = (path: string): { trusted: boolean; what: string } => {
  if (path.includes('/core/level')) return { trusted: true, what: 'universe levels and their comparison' };
  if (path.includes('/core/expr')) return { trusted: true, what: 'terms, substitution, de Bruijn indices' };
  if (path.includes('/core/env')) return { trusted: true, what: 'environment and local contexts' };
  if (path.includes('/core/typechecker')) return { trusted: true, what: 'type inference, whnf, definitional equality' };
  if (path.includes('/core/inductive')) return { trusted: true, what: 'inductive types: checks and recursors' };
  if (path.includes('/core/calculus')) return { trusted: true, what: 'which calculus is active' };
  if (path.includes('/core/pretty')) return { trusted: false, what: 'pretty printer' };
  if (path.includes('/core/steps')) return { trusted: false, what: 'small-step reducer (visualisation)' };
  if (path.includes('/core/rules')) return { trusted: false, what: 'rule descriptions' };
  if (path.includes('/syntax/')) return { trusted: false, what: 'lexer and parser' };
  if (path.includes('/elab/meta')) return { trusted: false, what: 'metavariables and unification' };
  if (path.includes('/elab/match')) return { trusted: false, what: 'pattern-matching compiler' };
  if (path.includes('/elab/')) return { trusted: false, what: 'elaborator' };
  if (path.includes('frontend')) return { trusted: false, what: 'command processing' };
  if (path.includes('/untyped/')) return { trusted: false, what: 'untyped λ-calculus (Part I)' };
  if (path.includes('/logic/')) return { trusted: false, what: 'natural deduction (Chapter 4)' };
  return { trusted: false, what: '' };
};

export function CodeSize() {
  const rows = Object.entries(files)
    .map(([p, src]) => ({ path: p.replace(/^.*?kernel\/src\//, 'packages/kernel/src/'), lines: src.split('\n').filter((l) => l.trim() && !l.trim().startsWith('//')).length, ...role(p) }))
    .filter((r) => r.what)
    .sort((a, b) => Number(b.trusted) - Number(a.trusted) || b.lines - a.lines);
  const total = (t: boolean) => rows.filter((r) => r.trusted === t).reduce((a, r) => a + r.lines, 0);
  return (
    <div class="widget wide">
      <div class="widget-head">
        <span class="widget-title">The course implementation</span>
        <span class="badge ok">trusted: {total(true)} lines</span>
        <span class="badge">untrusted: {total(false)} lines</span>
      </div>
      <table class="pos-table sans" style={{ margin: 0 }}>
        <tbody>
          <For each={rows}>
            {(r) => (
              <tr>
                <td>
                  <span class={`badge ${r.trusted ? 'ok' : ''}`}>{r.trusted ? 'kernel' : 'frontend'}</span>
                </td>
                <td class="mono" style={{ 'font-size': '0.78rem' }}>
                  {r.path}
                </td>
                <td>{r.what}</td>
                <td style={{ 'text-align': 'right', 'font-variant-numeric': 'tabular-nums' }}>{r.lines}</td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
      <div class="widget-foot">Non-blank, non-comment lines of TypeScript. Only the kernel has to be correct for the checker to be sound.</div>
    </div>
  );
}
