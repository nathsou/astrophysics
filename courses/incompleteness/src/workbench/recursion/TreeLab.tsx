// Trees coded as numbers (section "Trees"): the code ⟨k, #t₁, …, #t_k, l⟩ of a tree the reader
// builds, its immediate subtrees, and the sequences hSubtreeSeq(t, n) of the proof that
// SubtreeSeq is primitive recursive.

import { useMemo } from 'react';
import { codeNumber, containsAllSubtrees, depth, distinctSubtrees, hSubtreeSeqLevels, sameTree, treeCode, treeCodeTex, treeCodeText, type Tree } from '../../engine/computability/trees';
import { formatMagnitude, magnitude } from '../../engine/numbers/nat';
import { Panel } from '../coding';
import { Tex } from '../../ui/Tex';
import { Prov } from '../../ui/Prov';
import { Ref } from '../../formal/FormalText';
import { fmtBig, useRemembered } from './common';

interface T {
  l: number;
  c: T[];
}

const toTree = (t: T): Tree => ({ label: BigInt(t.l), children: t.c.map(toTree) });
const count = (t: T): number => 1 + t.c.reduce((s, c) => s + count(c), 0);

const PRESETS: { label: string; t: T }[] = [
  { label: 'a single node', t: { l: 5, c: [] } },
  { label: 'the book’s example', t: { l: 1, c: [{ l: 2, c: [] }, { l: 3, c: [] }] } },
  { label: 'three levels', t: { l: 0, c: [{ l: 1, c: [{ l: 2, c: [] }, { l: 3, c: [] }] }, { l: 4, c: [] }] } },
  { label: 'a path', t: { l: 0, c: [{ l: 0, c: [{ l: 0, c: [] }] }] } },
];

const MAX_NODES = 8;
const MAX_DEPTH = 3;

function at(t: T, path: number[]): T {
  return path.reduce((n, i) => n.c[i], t);
}

function update(t: T, path: number[], f: (n: T) => T | null): T | null {
  if (path.length === 0) return f(t);
  const [i, ...rest] = path;
  const child = update(t.c[i], rest, f);
  const c = child === null ? t.c.filter((_, j) => j !== i) : t.c.map((x, j) => (j === i ? child : x));
  return { ...t, c };
}

const LETTERS = 'ABCDEFGHIJKLMNOP';

export function TreeLab() {
  const [st, setSt] = useRemembered<{ t: T; sel: number[] }>('tree', { t: PRESETS[1].t, sel: [] });
  const sel = (() => {
    try {
      at(st.t, st.sel);
      return st.sel;
    } catch {
      return [];
    }
  })();
  const node = at(st.t, sel) ?? st.t;
  const tree = useMemo(() => toTree(st.t), [st.t]);
  const code = useMemo(() => codeNumber(tree, 1 << 14), [tree]);
  const mag = useMemo(() => magnitude(treeCode(tree)), [tree]);
  const distinct = useMemo(() => distinctSubtrees(tree), [tree]);
  const d = depth(tree);
  const levels = useMemo(() => hSubtreeSeqLevels(tree, d + 2), [tree, d]);
  const letter = (s: Tree) => LETTERS[distinct.findIndex((u) => sameTree(u, s))] ?? '?';
  const set = (t: T | null, s = sel) => t && setSt({ t, sel: s });
  const canAdd = count(st.t) < MAX_NODES && sel.length < MAX_DEPTH;
  return (
    <div className="workbench">
      <Panel n={1} title="A tree and its code" prov={<Prov kind="computed" />}>
        <div className="rc-presets" role="group" aria-label="Example trees">
          {PRESETS.map((p) => (
            <button key={p.label} className="chip-btn" onClick={() => setSt({ t: p.t, sel: [] })}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="rc-tree-draw" role="group" aria-label="The tree: choose a node to edit">
          <Draw t={st.t} path={[]} sel={sel} onSel={(p) => setSt({ ...st, sel: p })} />
        </div>
        <div className="rc-row" role="group" aria-label="Edit the selected node">
          <span className="fi-label">selected node</span>
          <button className="chip-btn" onClick={() => set(update(st.t, sel, (n) => ({ ...n, l: Math.max(0, n.l - 1) })))} aria-label="decrease label" disabled={node.l === 0}>
            label −
          </button>
          <span className="rc-mono">l = {node.l}</span>
          <button className="chip-btn" onClick={() => set(update(st.t, sel, (n) => ({ ...n, l: Math.min(9, n.l + 1) })))} aria-label="increase label" disabled={node.l === 9}>
            label +
          </button>
          <button className="chip-btn" disabled={!canAdd} onClick={() => set(update(st.t, sel, (n) => ({ ...n, c: [...n.c, { l: 0, c: [] }] })))}>
            add a child
          </button>
          <button className="chip-btn" disabled={sel.length === 0} onClick={() => set(update(st.t, sel, () => null), sel.slice(0, -1))}>
            remove it
          </button>
        </div>
        <p className="small sans muted">
          At most {MAX_NODES} nodes, depth {MAX_DEPTH}, labels 0–9: the codes are enormous even so.
        </p>
        <div className="rc-math">
          <Tex tex={`\\#t = ${treeCodeTex(tree)}`} />
        </div>
        <p className="wb-note" aria-live="polite">
          {code !== null ? (
            <>
              As a number: <span className="rc-mono">{fmtBig(code, 60)}</span>
            </>
          ) : (
            <>As a number, <Tex tex="\#t" /> has {formatMagnitude(mag)}: the codes of the subtrees sit in the exponents.</>
          )}
        </p>
      </Panel>
      <Panel n={2} title={<>Collecting the subtrees: <Tex tex="\mathrm{hSubtreeSeq}(t, n)" /></>} prov={<Prov kind="computed" />}>
        <p className="wb-note">
          The proof of <Ref k="cmp:rec:tre:prop:subtreeseq" /> starts from <Tex tex="\langle t\rangle" /> and repeatedly appends the immediate subtrees of <em>everything</em> collected so
          far. Letters stand for the distinct subtrees:
        </p>
        <ul className="rc-legend" aria-label="Subtrees">
          {distinct.map((s, i) => (
            <li key={i}>
              <b>{LETTERS[i]}</b> = <span className="rc-mono">{treeCodeText(s)}</span>
            </li>
          ))}
        </ul>
        <div className="rc-scroll">
          <table className="rc-table">
            <thead>
              <tr>
                <th scope="col" className="num">
                  n
                </th>
                <th scope="col">
                  <Tex tex="\mathrm{hSubtreeSeq}(t, n)" />
                </th>
                <th scope="col" className="num">
                  length
                </th>
                <th scope="col">all subtrees?</th>
              </tr>
            </thead>
            <tbody>
              {levels.map((lv, n) => (
                <tr key={n}>
                  <td className="num">{n}</td>
                  <td className="wrap">
                    <div className="rc-chiplist">
                      {lv.seq.slice(0, 48).map((s, i) => {
                        const prevLen = n === 0 ? 0 : levels[n - 1].seq.length;
                        const seenBefore = lv.seq.slice(0, i).some((u) => sameTree(u, s));
                        return (
                          <span key={i} className={`rc-chip ${seenBefore ? 'repeat' : ''} ${i >= prevLen ? 'new' : ''}`}>
                            {letter(s)}
                          </span>
                        );
                      })}
                      {lv.seq.length > 48 && <span className="rc-hint">… {lv.seq.length - 48} more</span>}
                    </div>
                  </td>
                  <td className="num">{lv.seq.length}</td>
                  <td>{containsAllSubtrees(tree, lv.seq) ? <span className="rc-ok">yes</span> : <span className="muted small">not yet</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="wb-note">
          Outlined in blue: what step <Tex tex="n" /> appended; dashed: a subtree already in the sequence. Every subtree is present once <Tex tex="n" /> reaches the depth of{' '}
          <Tex tex="t" /> (here {d}). The proof simply takes <Tex tex="n = t" />, the code itself, which is always at least the depth — a crude bound, but one that primitive
          recursion can use. The repetitions keep multiplying; the book’s exercise asks for a version without them.
        </p>
      </Panel>
    </div>
  );
}

function Draw({ t, path, sel, onSel }: { t: T; path: number[]; sel: number[]; onSel: (p: number[]) => void }) {
  const selected = path.length === sel.length && path.every((x, i) => x === sel[i]);
  return (
    <div className="rc-t">
      <button className={`rc-t-node ${selected ? 'selected' : ''}`} aria-pressed={selected} onClick={() => onSel(path)} aria-label={`node labelled ${t.l}${path.length === 0 ? ' (root)' : ''}`}>
        {t.l}
      </button>
      {t.c.length > 0 && (
        <div className={`rc-t-kids ${t.c.length === 1 ? 'single' : ''}`}>
          {t.c.map((c, i) => (
            <Draw key={i} t={c} path={[...path, i]} sel={sel} onSel={onSel} />
          ))}
        </div>
      )}
    </div>
  );
}

