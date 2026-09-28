// The book's official definitions (sections "Examples of Primitive Recursive Functions",
// "Primitive Recursive Relations", "Bounded Minimization", "Primes"): each definition as a tree
// that unfolds down to zero, succ and projections, evaluated by the engine with its call tree,
// and a table of values compared with what the function is meant to compute.

import { useMemo, useState } from 'react';
import { evaluate } from '../../engine/recursive/rf';
import { recursions, size, stage } from '../../engine/computability/primrec';
import { Panel } from '../coding';
import { Tex } from '../../ui/Tex';
import { NotAProof, Prov } from '../../ui/Prov';
import { CallTreeView, DefTree, fmtBig, FuelControl, NumField, parseNats, useRemembered } from './common';
import { ENTRIES, type Entry, type Group } from './entries';

export function LibraryExplorer({ groups, initial }: { groups: Group[]; initial?: string }) {
  const entries = ENTRIES.filter((e) => groups.includes(e.group));
  const [name, setName] = useRemembered<string>(`lib.${groups.join('+')}`, initial ?? entries[0].name);
  const entry = entries.find((e) => e.name === name) ?? entries[0];
  return (
    <div className="workbench">
      <Panel n={1} title="The official definition" prov={<Prov kind="book">equations from the text</Prov>}>
        <div className="rc-presets" role="group" aria-label="Choose a function or relation">
          {entries.map((e) => (
            <button key={e.name} className="chip-btn" aria-pressed={e.name === entry.name} onClick={() => setName(e.name)}>
              <Tex tex={e.tex} />
            </button>
          ))}
        </div>
        <div className="rc-eqs">
          <Tex tex={entry.eq} />
        </div>
        <Definition entry={entry} />
      </Panel>
      <Evaluation key={entry.name} entry={entry} />
      <ValueTable key={`t-${entry.name}`} entry={entry} />
    </div>
  );
}

function Definition({ entry }: { entry: Entry }) {
  const f = useMemo(() => entry.build(), [entry]);
  const st = stage(f);
  return (
    <>
      <p className="wb-note">
        Made official with zero, succ, projections, composition and primitive recursion only. Unfolded completely, the definition has {size(f).toLocaleString('en-US')} nodes and{' '}
        {recursions(f)} primitive recursion{recursions(f) === 1 ? '' : 's'}
        {st !== null && <>; it appears at stage {st}</>}. Named parts (like <Tex tex="\mathrm{add}" /> inside <Tex tex="\mathrm{mult}" />) are folded: unfold them to see what
        they stand for.
      </p>
      <DefTree f={f} label={`Definition of ${entry.name}`} />
    </>
  );
}

function Evaluation({ entry }: { entry: Entry }) {
  const [args, setArgs] = useState(entry.args);
  const [fuel, setFuel] = useState(1_000_000);
  const f = useMemo(() => entry.build(), [entry]);
  const xs = useMemo(() => parseNats(args, entry.arity, entry.max), [args, entry]);
  const r = useMemo(() => (typeof xs === 'string' ? null : evaluate(f, xs, { fuel, maxTraceDepth: 7 })), [f, xs, fuel]);
  const want = typeof xs === 'string' ? null : entry.spec(xs);
  return (
    <Panel n={2} title="Evaluating it" prov={<Prov kind="computed" />}>
      <div className="rc-row">
        <NumField id={`le-${entry.name}`} label="arguments" value={args} onChange={setArgs} width={100} hint={`${entry.arity} natural numbers, at most ${entry.max}`} />
        {typeof xs === 'string' && <span className="rc-err">{xs}</span>}
      </div>
      {r && typeof xs !== 'string' && (
        <div aria-live="polite">
          {r.status === 'ok' ? (
            <p className="wb-result">
              <Tex tex={`${entry.tex}(${xs.join(', ')}) = ${r.value}`} />{' '}
              <span className="small muted sans">
                after {r.calls.toLocaleString('en-US')} function calls ·{' '}
                {r.value === want ? <span className="rc-ok">as intended</span> : <span className="rc-bad">intended value {String(want)}</span>}
              </span>
            </p>
          ) : (
            <p className="wb-note">
              No answer within {fuel.toLocaleString('en-US')} function calls. The function is primitive recursive, so a value exists; computing it by the official definition
              takes longer than this budget.
            </p>
          )}
          <FuelControl value={fuel} onChange={setFuel} options={[10_000, 1_000_000, 3_000_000]} />
          <details className="call-tree-wrap">
            <summary className="sans small">the calls, level by level (the first 7 levels are recorded)</summary>
            <CallTreeView root={r.root} open={1} />
          </details>
        </div>
      )}
    </Panel>
  );
}

function ValueTable({ entry }: { entry: Entry }) {
  const f = useMemo(() => entry.build(), [entry]);
  const table = useMemo(() => {
    const run = (xs: bigint[]) => {
      const r = evaluate(f, xs, { fuel: 400_000, maxTraceDepth: -1 });
      return { v: r.status === 'ok' ? r.value : undefined, want: entry.spec(xs) };
    };
    if (entry.arity === 1) {
      const n = Number(entry.max < 12n ? entry.max : 12n);
      return { kind: 1 as const, cells: Array.from({ length: n + 1 }, (_, x) => run([BigInt(x)])) };
    }
    if (entry.arity === 2) {
      const n = Number(entry.max < 5n ? entry.max : 5n);
      return { kind: 2 as const, n, cells: Array.from({ length: n + 1 }, (_, x) => Array.from({ length: n + 1 }, (_, y) => run([BigInt(x), BigInt(y)]))) };
    }
    const triples: bigint[][] = [
      [0n, 4n, 9n],
      [1n, 4n, 9n],
      [2n, 4n, 9n],
      [0n, 7n, 2n],
      [5n, 7n, 2n],
    ];
    return { kind: 3 as const, rows: triples.map((t) => ({ t, ...run(t) })) };
  }, [f, entry]);
  const isRel = entry.group !== 'functions' && entry.name !== 'cond' && entry.name !== 'cases' && entry.name !== 'min-half';
  const all =
    table.kind === 1 ? table.cells : table.kind === 2 ? table.cells.flat() : table.rows;
  const agree = all.every((c) => c.v === c.want);
  const cls = (c: { v?: bigint; want: bigint }) => (c.v !== c.want ? 'wrong' : isRel ? (c.v === 1n ? 'one' : 'zero') : '');
  const show = (c: { v?: bigint; want: bigint }) => (c.v === undefined ? '?' : fmtBig(c.v, 8));
  return (
    <Panel n={3} title="A table of values" prov={<Prov kind="computed" />}>
      <p className="wb-note">
        Computed with the official definition{isRel ? <> (1 = holds, 0 = does not hold)</> : null}, and compared with what the function is meant to be:{' '}
        {agree ? <span className="rc-ok">all {all.length} values agree</span> : <span className="rc-bad">some values differ or were not computed within the budget</span>}.
      </p>
      <div className="rc-scroll">
        {table.kind === 1 && (
          <table className="rc-table rc-grid">
            <tbody>
              <tr>
                <th scope="row">x</th>
                {table.cells.map((_, x) => (
                  <th key={x} scope="col">
                    {x}
                  </th>
                ))}
              </tr>
              <tr>
                <th scope="row">
                  <Tex tex={`${entry.tex}(x)`} />
                </th>
                {table.cells.map((c, x) => (
                  <td key={x} className={cls(c)}>
                    {show(c)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        )}
        {table.kind === 2 && (
          <table className="rc-table rc-grid">
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">x down, y across</span>
                  <Tex tex="x \backslash y" />
                </th>
                {table.cells[0].map((_, y) => (
                  <th key={y} scope="col">
                    {y}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.cells.map((row, x) => (
                <tr key={x}>
                  <th scope="row">{x}</th>
                  {row.map((c, y) => (
                    <td key={y} className={cls(c)}>
                      {show(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {table.kind === 3 && (
          <table className="rc-table">
            <tbody>
              {table.rows.map((r) => (
                <tr key={r.t.join(',')}>
                  <td>
                    <Tex tex={`${entry.tex}(${r.t.join(', ')})`} />
                  </td>
                  <td className="num">{show(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <NotAProof>
        Agreement on a table is evidence that the definition was written down correctly, not a proof that it computes the intended function everywhere; that is the
        argument given in the text.
      </NotAProof>
    </Panel>
  );
}
