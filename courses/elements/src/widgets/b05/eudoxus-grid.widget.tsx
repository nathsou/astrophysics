// ::eudoxus-grid{left="sqrt2" right="1.4142" size="20"}
//
// Eudoxus' definition of "same ratio" (V Def. 5) as a picture. For a ratio a : b, the cell (m, n)
// of the grid is coloured by comparing m·a with n·b: greater, equal or less. Two ratios are the
// same exactly when their grids agree in every cell, for every size of grid. The staircase that
// separates the "greater" cells from the rest is the set of fractions n/m below a/b: a Dedekind cut.

import { useId, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Widget } from '../shared/Widget';

type Cmp = -1 | 0 | 1;

interface Preset {
  id: string;
  label: string;
  a: number;
  b: number;
}

const PHI = (1 + Math.sqrt(5)) / 2;

const PRESETS: Preset[] = [
  { id: '3:2', label: '3 : 2', a: 3, b: 2 },
  { id: '6:4', label: '6 : 4', a: 6, b: 4 },
  { id: '2:1', label: '2 : 1', a: 2, b: 1 },
  { id: 'sqrt2', label: '√2 : 1 (diagonal : side)', a: Math.SQRT2, b: 1 },
  { id: '1.4142', label: '1.4142 : 1', a: 1.4142, b: 1 },
  { id: '99:70', label: '99 : 70', a: 99, b: 70 },
  { id: 'phi', label: 'φ : 1 (golden ratio)', a: PHI, b: 1 },
  { id: '13:8', label: '13 : 8', a: 13, b: 8 },
  { id: 'pi', label: 'π : 1', a: Math.PI, b: 1 },
  { id: '22:7', label: '22 : 7', a: 22, b: 7 },
  { id: '355:113', label: '355 : 113', a: 355, b: 113 },
];

const presetOf = (id: string | undefined, fallback: string) => PRESETS.find((p) => p.id === id) ?? PRESETS.find((p) => p.id === fallback)!;

function cmp(x: number, y: number): Cmp {
  if (Math.abs(x - y) <= 1e-12 * Math.max(1, Math.abs(x), Math.abs(y))) return 0;
  return x > y ? 1 : -1;
}

const WORD: Record<Cmp, string> = { 1: 'greater than', 0: 'equal to', [-1]: 'less than' } as Record<Cmp, string>;
const SIGN: Record<Cmp, string> = { 1: '>', 0: '=', [-1]: '<' } as Record<Cmp, string>;
const FILL: Record<Cmp, string> = { 1: 'var(--byrne-red)', 0: 'var(--byrne-yellow)', [-1]: 'var(--byrne-blue)' } as Record<Cmp, string>;
const OPACITY: Record<Cmp, number> = { 1: 0.78, 0: 1, [-1]: 0.3 } as Record<Cmp, number>;

const fmt = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(4));

/** The first (m, n) — least m, then least n — where the two ratios compare differently, up to m ≤ limit. */
function firstDifference(a: number, b: number, c: number, d: number, limit: number): [number, number] | null {
  const r1 = a / b;
  const r2 = c / d;
  for (let m = 1; m <= limit; m++) {
    // candidates for n: the integers near m·r1 and m·r2, where the comparisons can change
    const lo = Math.max(1, Math.floor(Math.min(m * r1, m * r2)) - 1);
    const hi = Math.ceil(Math.max(m * r1, m * r2)) + 1;
    for (let n = lo; n <= hi; n++) if (cmp(m * a, n * b) !== cmp(m * c, n * d)) return [m, n];
  }
  return null;
}

interface Side {
  a: number;
  b: number;
  preset: string;
}

function RatioInputs({ side, set, name, letters }: { side: Side; set: (s: Side) => void; name: string; letters: [string, string] }) {
  const id = useId();
  const num = (v: string, old: number) => {
    const x = Number(v);
    return Number.isFinite(x) && x > 0 ? x : old;
  };
  return (
    <fieldset className="eg-inputs">
      <legend>{name}</legend>
      <label htmlFor={`${id}-p`}>
        <span>preset</span>
        <select
          id={`${id}-p`}
          value={side.preset}
          onChange={(e) => {
            const p = PRESETS.find((q) => q.id === e.target.value);
            if (p) set({ a: p.a, b: p.b, preset: p.id });
          }}
        >
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
          <option value="custom">custom</option>
        </select>
      </label>
      <label htmlFor={`${id}-a`}>
        <i>{letters[0]}</i>
        <input id={`${id}-a`} type="number" min="0" step="any" value={side.a} onChange={(e) => set({ ...side, a: num(e.target.value, side.a), preset: 'custom' })} />
      </label>
      <label htmlFor={`${id}-b`}>
        <i>{letters[1]}</i>
        <input id={`${id}-b`} type="number" min="0" step="any" value={side.b} onChange={(e) => set({ ...side, b: num(e.target.value, side.b), preset: 'custom' })} />
      </label>
    </fieldset>
  );
}

function Grid({
  a,
  b,
  N,
  letters,
  diff,
  cursor,
  setCursor,
  title,
}: {
  a: number;
  b: number;
  N: number;
  letters: [string, string];
  diff: boolean[][];
  cursor: [number, number] | null;
  setCursor: (c: [number, number] | null) => void;
  title: string;
}) {
  const cell = 12;
  const pad = 26;
  const size = N * cell;
  const X = (m: number) => pad + (m - 1) * cell; // left edge of column m
  const Y = (n: number) => pad / 2 + size - n * cell; // top edge of row n (n grows upwards)
  const cells: ReactNode[] = [];
  let greater = 0;
  for (let m = 1; m <= N; m++)
    for (let n = 1; n <= N; n++) {
      const c = cmp(m * a, n * b);
      if (c > 0) greater++;
      cells.push(<rect key={`${m}-${n}`} x={X(m)} y={Y(n)} width={cell} height={cell} fill={FILL[c]} fillOpacity={OPACITY[c]} />);
      if (c === 0) cells.push(<circle key={`e${m}-${n}`} cx={X(m) + cell / 2} cy={Y(n) + cell / 2} r={2.2} fill="var(--ink)" />);
    }
  // the staircase: above column m lie the cells with n·b ≥ m·a; its height is the number of n with n·b < m·a
  let d = '';
  for (let m = 1; m <= N; m++) {
    let h = 0;
    while (h < N && cmp(m * a, (h + 1) * b) > 0) h++;
    const y = Y(h) + cell;
    d += m === 1 ? `M${X(1)},${y}` : `L${X(m)},${y}`;
    d += `L${X(m) + cell},${y}`;
  }
  const r = a / b;
  // the ray n = r·m through the lattice points, drawn at cell centres
  const cx = (m: number) => X(m) + cell / 2;
  const cy = (n: number) => Y(n) + cell / 2;
  const mEnd = Math.min(N, N / r);
  const onKey = (e: KeyboardEvent) => {
    const [m, n] = cursor ?? [1, 1];
    const moves: Record<string, [number, number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    const mv = moves[e.key];
    if (!mv) return;
    e.preventDefault();
    setCursor([Math.min(N, Math.max(1, m + mv[0])), Math.min(N, Math.max(1, n + mv[1]))]);
  };
  const ticks = [1, ...Array.from({ length: Math.floor(N / 5) }, (_, i) => (i + 1) * 5)];
  return (
    <figure className="eg-grid">
      <figcaption>
        {title}: <i>{letters[0]}</i> : <i>{letters[1]}</i> = {fmt(a)} : {fmt(b)} ≈ {r.toFixed(6)}
      </figcaption>
      <svg
        viewBox={`0 0 ${pad + size + 6} ${size + pad * 1.5}`}
        role="img"
        aria-label={`${title}: grid of ${N} by ${N} pairs (m, n); in ${greater} of them m·${letters[0]} is greater than n·${letters[1]}. Use the arrow keys to inspect a cell.`}
        tabIndex={0}
        onKeyDown={onKey}
        onFocus={() => !cursor && setCursor([1, 1])}
        onPointerLeave={() => setCursor(null)}
        onPointerMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const k = (pad + size + 6) / box.width;
          const px = (e.clientX - box.left) * k;
          const py = (e.clientY - box.top) * k;
          const m = Math.floor((px - pad) / cell) + 1;
          const n = Math.floor((pad / 2 + size - py) / cell) + 1;
          setCursor(m >= 1 && m <= N && n >= 1 && n <= N ? [m, n] : null);
        }}
      >
        {cells}
        {diff.flatMap((col, i) => col.map((x, j) => (x ? <rect key={`d${i}-${j}`} x={X(i + 1) + 1} y={Y(j + 1) + 1} width={cell - 2} height={cell - 2} fill="none" stroke="var(--ink)" strokeWidth={2} /> : null)))}
        <path d={d} fill="none" stroke="var(--ink)" strokeWidth={2.2} strokeLinejoin="round" />
        <line x1={cx(0)} y1={cy(0)} x2={cx(mEnd)} y2={cy(mEnd * r)} stroke="var(--ink)" strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
        {cursor && <rect x={X(cursor[0]) - 1} y={Y(cursor[1]) - 1} width={cell + 2} height={cell + 2} fill="none" stroke="var(--accent)" strokeWidth={2.5} />}
        {ticks.map((t) => (
          <g key={t} fontSize={9} fill="var(--muted)" fontFamily="var(--sans)">
            <text x={cx(t)} y={pad / 2 + size + 11} textAnchor="middle">
              {t}
            </text>
            <text x={pad - 4} y={cy(t) + 3} textAnchor="end">
              {t}
            </text>
          </g>
        ))}
        <text x={pad + size} y={pad / 2 + size + 22} textAnchor="end" fontSize={10} fill="var(--ink-2)" fontFamily="var(--serif)" fontStyle="italic">
          m →
        </text>
        <text x={2} y={pad / 2 + size + 22} fontSize={10} fill="var(--ink-2)" fontFamily="var(--serif)" fontStyle="italic">
          n ↑
        </text>
      </svg>
    </figure>
  );
}

export default function EudoxusGrid({ left, right, size }: Record<string, string>) {
  const pl = presetOf(left, 'sqrt2');
  const pr = presetOf(right, '1.4142');
  const [L, setL] = useState<Side>({ a: pl.a, b: pl.b, preset: pl.id });
  const [R, setR] = useState<Side>({ a: pr.a, b: pr.b, preset: pr.id });
  const [N, setN] = useState(() => Math.min(40, Math.max(6, Number(size) || 20)));
  const [cursor, setCursor] = useState<[number, number] | null>(null);
  const nId = useId();

  const diff = useMemo(() => Array.from({ length: N }, (_, i) => Array.from({ length: N }, (_, j) => cmp((i + 1) * L.a, (j + 1) * L.b) !== cmp((i + 1) * R.a, (j + 1) * R.b))), [L, R, N]);
  const count = diff.flat().filter(Boolean).length;
  const first = useMemo(() => firstDifference(L.a, L.b, R.a, R.b, 1_000_000), [L, R]);

  let verdict: string;
  if (!first) verdict = `The grids agree in every cell, and in every cell up to m = 1,000,000: the two ratios are the same (for these inputs, as far as floating point can tell).`;
  else {
    const [m, n] = first;
    const c1 = cmp(m * L.a, n * L.b);
    const c2 = cmp(m * R.a, n * R.b);
    const bigger = c1 > c2 ? 'left' : 'right';
    const where = count > 0 ? `They differ in ${count} of the ${N * N} cells shown (outlined).` : `They agree in all ${N * N} cells shown, but not beyond the grid.`;
    verdict = `${where} The first difference is at m = ${m}, n = ${n}: ${m}·a is ${WORD[c1]} ${n}·b, but ${m}·c is ${WORD[c2]} ${n}·d. So the ratios are not the same, and the ${bigger} ratio is the greater one (V Def. 7).`;
  }

  const inspect = cursor
    ? (() => {
        const [m, n] = cursor;
        const c1 = cmp(m * L.a, n * L.b);
        const c2 = cmp(m * R.a, n * R.b);
        return `m = ${m}, n = ${n}:  ${m}·a = ${fmt(m * L.a)} ${SIGN[c1]} ${n}·b = ${fmt(n * L.b)};   ${m}·c = ${fmt(m * R.a)} ${SIGN[c2]} ${n}·d = ${fmt(n * R.b)}.  ${c1 === c2 ? 'Alike.' : 'Not alike.'}`;
      })()
    : 'Point at a cell, or focus a grid and use the arrow keys, to compare the multiples.';

  return (
    <Widget
      title="Eudoxus' test for the same ratio"
      note={
        <>
          Cell (m, n) is <span style={{ color: 'var(--byrne-red)', fontWeight: 600 }}>red</span> if m·a &gt; n·b,{' '}
          <span style={{ background: 'var(--byrne-yellow)', color: '#1d1b17', padding: '0 3px', borderRadius: 3 }}>yellow with a dot</span> if they are equal, and{' '}
          <span style={{ color: 'var(--byrne-blue)', fontWeight: 600 }}>pale blue</span> if m·a &lt; n·b. The red cells are the fractions n/m below a/b; the
          staircase line is the boundary of that set, a Dedekind cut. The dashed line has slope a/b. Equal cells occur only when a : b is a ratio of whole numbers.
        </>
      }
    >
      <style>{CSS}</style>
      <div className="eg-controls">
        <RatioInputs side={L} set={setL} name="Left ratio a : b" letters={['a', 'b']} />
        <RatioInputs side={R} set={setR} name="Right ratio c : d" letters={['c', 'd']} />
        <label htmlFor={nId} className="eg-size">
          <span>grid size</span>
          <input id={nId} type="range" min={6} max={40} value={N} onChange={(e) => setN(Number(e.target.value))} />
          <output htmlFor={nId}>
            {N} × {N}
          </output>
        </label>
      </div>
      <div className="eg-pair">
        <Grid a={L.a} b={L.b} N={N} letters={['a', 'b']} diff={diff} cursor={cursor} setCursor={setCursor} title="Left" />
        <Grid a={R.a} b={R.b} N={N} letters={['c', 'd']} diff={diff} cursor={cursor} setCursor={setCursor} title="Right" />
      </div>
      <p className="eg-inspect" aria-live="polite">
        {inspect}
      </p>
      <p className={`eg-verdict ${first ? 'differ' : 'same'}`} aria-live="polite">
        {verdict}
      </p>
    </Widget>
  );
}

const CSS = `
.eg-controls { display: flex; flex-wrap: wrap; gap: 10px 18px; align-items: flex-end; margin-bottom: 8px; }
.eg-inputs { border: 1px solid var(--rule); border-radius: 8px; padding: 6px 10px 8px; margin: 0; display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; }
.eg-inputs legend { font-size: 12px; color: var(--muted); padding: 0 4px; }
.eg-inputs label { margin: 0; }
.eg-inputs span, .eg-size span { color: var(--ink-2); }
.eg-inputs i { font-family: var(--serif); font-size: 16px; }
.eg-inputs input { width: 9.5em; }
.eg-inputs input, .eg-inputs select { font: inherit; padding: 3px 6px; border: 1px solid var(--rule-2); border-radius: 6px; background: var(--panel); color: var(--ink); }
.eg-inputs input:focus-visible, .eg-inputs select:focus-visible, .eg-grid svg:focus-visible, .eg-size input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.eg-size output { font-variant-numeric: tabular-nums; min-width: 4.5em; }
.eg-pair { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
.eg-grid { margin: 0; }
.eg-grid figcaption { font-size: 13px; color: var(--ink-2); margin-bottom: 2px; font-variant-numeric: tabular-nums; }
.eg-grid svg { border-radius: 4px; max-width: 360px; }
.eg-inspect { font-size: 13px; font-variant-numeric: tabular-nums; color: var(--ink-2); min-height: 2.6em; margin: 6px 0 2px; }
.eg-verdict { font-size: 14px; margin: 4px 0; padding: 6px 10px; border-radius: 6px; background: var(--paper-2); border-left: 3px solid var(--rule-2); }
.eg-verdict.same { border-left-color: var(--ok); }
.eg-verdict.differ { border-left-color: var(--byrne-red); }
`;
