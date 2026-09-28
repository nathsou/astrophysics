// An illustration (not a model) of how the elements of a non-standard model of PA are ordered:
// the standard numbers 0, 1, 2, …, then blocks, each ordered like the integers, and the blocks
// themselves ordered densely without endpoints, like the rationals. The buttons follow the
// book's proofs: x ⊕ x lies in a higher block, the "half" of x in a lower one, and the
// "average" of x and y in a block between them.

import { useState } from 'react';
import { Prov } from '../../ui/Prov';
import { Panel } from '../coding';
import './sem.css';

type Frac = [bigint, bigint];

const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? (a < 0n ? -a : a) : gcd(b, a % b));
const norm = ([p, q]: Frac): Frac => {
  const g = gcd(p, q);
  return [p / g, q / g];
};
const lt = (a: Frac, b: Frac) => a[0] * b[1] < b[0] * a[1];
const avg = (a: Frac, b: Frac): Frac => norm([a[0] * b[1] + b[0] * a[1], 2n * a[1] * b[1]]);
const show = ([p, q]: Frac) => (q === 1n ? (p === 1n ? 'a' : `${p}a`) : `${p === 1n ? '' : p}a/${q}`);

export function NonstandardOrder() {
  const [blocks, setBlocks] = useState<Frac[]>([[1n, 1n]]);
  const [sel, setSel] = useState(0);
  const [last, setLast] = useState('Start: one non-standard element a, in its block [a].');
  const sorted = blocks;
  const cur = sorted[Math.min(sel, sorted.length - 1)];
  const add = (f: Frac, why: string) => {
    const nb = [...blocks.filter((b) => !(b[0] === f[0] && b[1] === f[1])), f].sort((a, b) => (lt(a, b) ? -1 : 1));
    if (nb.length > 9) {
      setLast('That is enough blocks for a picture: there are infinitely many, and between any two there are more.');
      return;
    }
    setBlocks(nb);
    setSel(nb.findIndex((b) => b[0] === f[0] && b[1] === f[1]));
    setLast(why);
  };
  const next = sorted[sel + 1];
  const W = 150;
  const stdW = 190;
  const width = stdW + sorted.length * W + 50;
  const y = 50;
  return (
    <Panel title={<>How a non-standard model of PA is ordered</>} prov={<span className="sem-illustration">Illustration — not a model</span>}>
      <p className="wb-note">
        The picture shows only the <em>order</em> ≺ of the elements. The labels 2a, a/2, 3a/2 name elements by the book’s constructions (a ⊕ a; an element whose double is a, possibly plus one; an “average”). ⊕ and ⊗ are not drawn: by Tennenbaum’s theorem no non-standard model of PA is computable (domain ℕ, computable ′, + and ×, decidable &lt;).
      </p>
      <div className="sem-ns" role="img" aria-label={`The standard numbers, then ${sorted.length} block${sorted.length === 1 ? '' : 's'}: ${sorted.map((b) => `[${show(b)}]`).join(', ')}, each ordered like the integers.`}>
        <svg width={width} height={96} viewBox={`0 0 ${width} 96`}>
          <line className="axis" x1={8} y1={y} x2={width - 8} y2={y} />
          <g className="std">
            {Array.from({ length: 6 }, (_, i) => (
              <g key={i}>
                <line className="tick" x1={20 + i * 26} y1={y - 8} x2={20 + i * 26} y2={y + 8} />
                <text x={20 + i * 26} y={y + 24} textAnchor="middle">
                  {i}
                </text>
              </g>
            ))}
            <text x={20 + 6 * 26} y={y + 4} textAnchor="middle">
              …
            </text>
            <text className="cap" x={20} y={16}>
              standard part (like ℕ)
            </text>
          </g>
          {sorted.map((b, i) => {
            const x0 = stdW + i * W;
            return (
              <g key={show(b)} className={`block ${i === sel ? 'sel' : ''}`} onClick={() => setSel(i)} style={{ cursor: 'pointer' }}>
                <rect x={x0} y={y - 16} width={W - 22} height={32} rx={8} />
                <text x={x0 + 6} y={y + 4}>
                  …
                </text>
                {[-1, 0, 1].map((k) => (
                  <g key={k}>
                    <line className="tick" x1={x0 + 64 + k * 34} y1={y - 7} x2={x0 + 64 + k * 34} y2={y + 7} />
                    <text className="cap" x={x0 + 64 + k * 34} y={y - 22} textAnchor="middle">
                      {k === 0 ? show(b) : k < 0 ? `*${show(b)}` : `${show(b)}*`}
                    </text>
                  </g>
                ))}
                <text x={x0 + W - 36} y={y + 4}>
                  …
                </text>
                <text x={x0 + (W - 22) / 2} y={y + 32} textAnchor="middle">
                  [{show(b)}]
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="seg" role="group" aria-label="Blocks">
        {sorted.map((b, i) => (
          <button key={show(b)} className="chip-btn" aria-pressed={i === sel} onClick={() => setSel(i)}>
            [{show(b)}]
          </button>
        ))}
      </div>
      <div className="seg">
        <button className="chip-btn" onClick={() => add(norm([cur[0] * 2n, cur[1]]), `x ⊕ x for x = ${show(cur)} is not in [${show(cur)}] and lies above it (the book: x ≺ x ⊕ y and x ⊕ y ∉ [x] for non-standard x, y). So there is no largest block.`)}>
          double: [{show(cur)} ⊕ {show(cur)}]
        </button>
        <button className="chip-btn" onClick={() => add(norm([cur[0], cur[1] * 2n]), `PA proves every x is y ⊕ y or (y ⊕ y)′. For x = ${show(cur)}, y is non-standard and lies in a lower block. So there is no least non-standard block.`)}>
          halve: a block below [{show(cur)}]
        </button>
        <button className="chip-btn" disabled={!next} onClick={() => next && add(avg(cur, next), `The “average” z of ${show(cur)} and ${show(next)} (x ⊕ y = z ⊕ z or (z ⊕ z)′) lies strictly between their blocks. So the blocks are densely ordered.`)}>
          average with the next block{next ? `: [${show(avg(cur, next))}]` : ''}
        </button>
      </div>
      <p className="wb-note" aria-live="polite">
        {last}
      </p>
      <p className="wb-note">
        <Prov kind="theorem" /> The facts behind each button are proved in the book’s section on models of PA; the picture only arranges them. Every block has infinitely many elements in both directions, and there are infinitely many blocks — any finite picture leaves out almost everything.
      </p>
    </Panel>
  );
}
