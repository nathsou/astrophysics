// The proof-obligation grid: one cell per case of each induction (or cases) in a proof,
// green when the case is proved, amber when it is left as sorry, red when it fails.

import { For, Show, createSignal } from 'solid-js';
import { Playground } from '../Playground.tsx';
import type { CheckResult } from '../../app/kernel.ts';

interface Cell {
  name: string;
  status: 'ok' | 'sorry' | 'error';
}
interface Group {
  theorem: string;
  tactic: string;
  cells: Cell[];
}

/** find the `induction … with` / `cases … with` blocks and their alternatives in the source */
export function obligations(src: string, offset: number, r: CheckResult): Group[] {
  const lines = src.split('\n');
  const starts: number[] = [];
  let pos = 0;
  for (const l of lines) {
    starts.push(pos);
    pos += l.length + 1;
  }
  const indent = (l: string) => l.length - l.trimStart().length;
  const groups: Group[] = [];
  let theorem = '';
  for (let i = 0; i < lines.length; i++) {
    if (starts[i] < offset) continue;
    const th = /^\s*(?:theorem|lemma|def)\s+([^\s(:{]+)/.exec(lines[i]);
    if (th) theorem = th[1];
    const m = /\b(induction|cases)\b[^\n]*\bwith\s*$/.exec(lines[i]);
    if (!m) continue;
    const base = indent(lines[i]);
    const cells: Cell[] = [];
    let j = i + 1;
    while (j < lines.length) {
      const l = lines[j];
      if (l.trim() === '') {
        j++;
        continue;
      }
      if (indent(l) < base || (indent(l) === base && !l.trimStart().startsWith('|'))) break;
      const alt = /^\s*\|\s*([\w.']+)/.exec(l);
      if (alt && indent(l) === indent(lines[i + 1] ?? l)) {
        // the alternative runs until the next one at the same indentation
        let k = j + 1;
        while (k < lines.length && !(lines[k].trim() !== '' && indent(lines[k]) <= indent(l))) k++;
        const from = starts[j];
        const to = k < lines.length ? starts[k] : src.length;
        const text = src.slice(from, to);
        const err = r.messages.some((msg) => msg.severity === 'error' && msg.span.from >= from && msg.span.from < to);
        cells.push({ name: alt[1], status: err ? 'error' : /\bsorry\b/.test(text) ? 'sorry' : 'ok' });
        j = k;
        continue;
      }
      j++;
    }
    if (cells.length) groups.push({ theorem, tactic: m[1], cells });
  }
  return groups;
}

export function ObligationGrid(props: { code: string; setup?: string; title?: string; lens?: boolean }) {
  const [groups, setGroups] = createSignal<Group[]>([]);
  return (
    <div class="obligation-grid">
      <Playground code={props.code} setup={props.setup} title={props.title ?? 'Proof obligations'} lens={props.lens} onResult={(r, src, off) => setGroups(obligations(src, off, r))} />
      <div class="term-panel">
        <div class="label">cases to prove</div>
        <Show when={groups().length} fallback={<div class="muted small">No induction in this proof.</div>}>
          <For each={groups()}>
            {(g) => (
              <div class="og-group">
                <span class="mono og-theorem">{g.theorem}</span>
                <span class="muted small"> ({g.tactic})</span>
                <div class="og-cells">
                  <For each={g.cells}>
                    {(c) => (
                      <span class={`og-cell ${c.status}`} title={c.status === 'ok' ? 'proved' : c.status === 'sorry' ? 'left as sorry' : 'fails'}>
                        {c.status === 'ok' ? '✓' : c.status === 'sorry' ? '…' : '✗'} <span class="mono">{c.name}</span>
                      </span>
                    )}
                  </For>
                </div>
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}
