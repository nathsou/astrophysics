// ::irrationals
// A classifier for the lines of Book X. The reader types a length built from whole numbers,
// fractions, + − × ÷, powers and square roots (or picks an example); the widget simplifies it
// exactly and, when it is one of the canonical forms √a ± √b or √(√a ± √b) with a, b rational,
// reports Euclid's name for it, measured against the rational line ρ = 1.
import { useMemo, useState } from 'react';
import { Widget } from '../shared/Widget';
import { classify, parse, Unsupported, type Result } from './surds';

const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: 'Rational and medial',
    items: [
      ['rational', '3/2'],
      ['rational in square', '√2'],
      ['simplifies', '√8 + √2'],
      ['medial', '∜2'],
    ],
  },
  {
    title: 'By addition (X.36–41)',
    items: [
      ['binomial', '1 + √2'],
      ['first bimedial', '∜3 + ∜27'],
      ['second bimedial', '∜2 + √3/∜2'],
      ['major', '√((5+√5)/2) + √((5−√5)/2)'],
      ['rational + medial', '√(2 + √12)'],
      ['two medials', '√(√3 + √2)'],
    ],
  },
  {
    title: 'By subtraction (X.73–78)',
    items: [
      ['apotome', '3 − √5'],
      ['first apotome of a medial', '∜27 − ∜3'],
      ['second apotome of a medial', '√(√18 − √10)'],
      ['minor', '√((5+√5)/2) − √((5−√5)/2)'],
      ['with a rational area…', '√(√8 − 2)'],
      ['with a medial area…', '√(√3 − √2)'],
    ],
  },
  {
    title: 'Other',
    items: [
      ['denests', '√(3 + √5)'],
      ['outside the forms', '√2 + √3 + √5'],
    ],
  },
];

function run(src: string): { r?: Result; err?: string } {
  try {
    return { r: classify(parse(src)) };
  } catch (e) {
    if (e instanceof Unsupported) return { err: e.message };
    return { err: 'this expression could not be read' };
  }
}

const cite = (id: string) => {
  const [b, ...rest] = id.split('.');
  const R = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  const label = rest[0].startsWith('def') ? `${R[+b]} Deff. ${R[+rest[0].slice(3)]}.${rest[1]}` : `${R[+b]}.${rest[0]}`;
  return (
    <a href={`#/${id}`} className="cite">
      {label}
    </a>
  );
};

export default function Irrationals({ value = '∜3 + ∜27' }: Record<string, string>) {
  const [src, setSrc] = useState(value);
  const { r, err } = useMemo(() => run(src), [src]);
  return (
    <Widget
      title="Classify a line"
      note={
        <>
          Lengths are measured against the rational line ρ = 1. The classifier simplifies the expression exactly (√8 + √2 = 3√2) and undoes a nested root when it can (√(3 + √5) = √(5/2) + √(1/2)). It then
          names only the canonical forms: rational lines √a, medial lines ⁴√a, the binomials and apotomes √a ± √b, and the roots √(√a ± √b) of a binomial or an apotome, with a, b rational. Anything else
          is reported as outside these forms, not guessed.
        </>
      }
    >
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        <label style={{ flex: '1 1 320px', display: 'flex', gap: 8, alignItems: 'center' }}>
          x ={' '}
          <input
            type="text"
            value={src}
            onChange={(e) => setSrc(e.target.value)}
            spellCheck={false}
            aria-label="a length, for example √(√3 + √2)"
            style={{ flex: 1, font: 'inherit', fontSize: '1.05em', padding: '4px 8px' }}
          />
        </label>
      </div>
      <p className="note" style={{ margin: '4px 0 8px' }}>
        Type √ or sqrt, ∜ or root4, fractions, + − * / and ^ (for example 2^(1/4)).
      </p>
      {GROUPS.map((gr) => (
        <div key={gr.title} className="row" style={{ flexWrap: 'wrap', gap: 6, alignItems: 'baseline' }}>
          <span style={{ minWidth: 150, fontSize: '0.9em' }}>{gr.title}</span>
          {gr.items.map(([name, ex]) => (
            <button key={ex} type="button" onClick={() => setSrc(ex)} title={ex} aria-pressed={src === ex}>
              {name}
            </button>
          ))}
        </div>
      ))}
      <div style={{ marginTop: 12, padding: '10px 12px', border: '1px solid var(--rule-2)', borderRadius: 6 }}>
        {err ? (
          <p style={{ margin: 0 }}>
            <strong>Not classified:</strong> {err}.
          </p>
        ) : r ? (
          <>
            <p style={{ margin: 0, fontSize: '1.1em' }}>
              x = {r.form} ≈ {r.value.toFixed(6)}
            </p>
            <p style={{ margin: '6px 0' }}>
              <strong style={{ color: 'var(--byrne-red)' }}>{r.name}</strong>
              {r.ref && <> &nbsp;({cite(r.ref)}{r.order && (r.family === 'binomial' || r.family === 'apotome') ? <>, {cite(`10.def${r.family === 'binomial' ? 2 : 3}.${r.order}`)}</> : null})</>}
            </p>
            {r.terms && (
              <p style={{ margin: '6px 0' }}>
                {r.terms.of} = α {r.family === 'binomial' || r.family === 'additive' ? '+' : '−'} β with α = {r.terms.alpha} and β = {r.terms.beta}.
              </p>
            )}
            {r.parts && (
              <p style={{ margin: '6px 0' }}>
                Modern form: x = u {r.parts.plus ? '+' : '−'} v with u = {r.parts.u} and v = {r.parts.v}. The squares add up to the greater term of x², and 2uv is the lesser term.
              </p>
            )}
            {r.family === 'binomial' || r.family === 'apotome' ? (
              <p style={{ margin: '6px 0' }}>Modern form: √a {r.family === 'binomial' ? '+' : '−'} √b with a, b rational and a : b not a ratio of two squares.</p>
            ) : null}
            {r.family === 'medial' && <p style={{ margin: '6px 0' }}>Modern form: ⁴√a with a rational and not the square of a rational.</p>}
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {r.checks.map((c, i) => (
                <li key={i}>
                  <span style={{ color: c.ok ? 'var(--good, green)' : 'var(--bad, #b33)' }}>{c.ok ? '✓' : '✗'}</span> {c.label}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </Widget>
  );
}
