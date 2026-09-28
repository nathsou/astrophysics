// A tree editor for recursive functions. Node ids are paths ("r", "r.f", "r.g1"), so errors,
// evaluation traces and representing formulas can all point back into the editor.

import type { ReactNode } from 'react';
import type { RFSpec } from '../content/objects';
import type { RF } from '../engine/recursive/rf';
import { BASIC_TEX } from '../engine/recursive/rf';
import { Tex } from '../ui/Tex';

export function buildWithPaths(s: RFSpec, path = 'r'): RF {
  switch (s.k) {
    case 'zero':
    case 'succ':
      return { k: s.k, id: path };
    case 'proj':
      return { k: 'proj', id: path, n: s.n, i: s.i };
    case 'basic':
      return { k: 'basic', id: path, name: s.name };
    case 'comp':
      return { k: 'comp', id: path, f: buildWithPaths(s.f, `${path}.f`), gs: s.gs.map((g, i) => buildWithPaths(g, `${path}.g${i}`)) };
    case 'rec':
      return { k: 'rec', id: path, f: buildWithPaths(s.f, `${path}.f`), g: buildWithPaths(s.g, `${path}.g`) };
    case 'min':
      return { k: 'min', id: path, f: buildWithPaths(s.f, `${path}.f`) };
  }
  throw new Error('unknown function');
}

type Kind = Exclude<RFSpec['k'], 'basic'> | 'add' | 'mult' | 'chareq';

const KINDS: { k: Kind; label: string }[] = [
  { k: 'zero', label: 'zero' },
  { k: 'succ', label: 'succ' },
  { k: 'proj', label: 'projection Pⁿᵢ' },
  { k: 'add', label: 'add' },
  { k: 'mult', label: 'mult' },
  { k: 'chareq', label: 'χ=' },
  { k: 'comp', label: 'composition' },
  { k: 'min', label: 'minimization μ' },
  { k: 'rec', label: 'primitive recursion' },
];

function fresh(k: Kind): RFSpec {
  switch (k) {
    case 'zero':
    case 'succ':
      return { k };
    case 'proj':
      return { k: 'proj', n: 1, i: 0 };
    case 'add':
    case 'mult':
    case 'chareq':
      return { k: 'basic', name: k };
    case 'comp':
      return { k: 'comp', f: { k: 'succ' }, gs: [{ k: 'proj', n: 1, i: 0 }] };
    case 'min':
      return { k: 'min', f: { k: 'basic', name: 'chareq' } };
    case 'rec':
      return { k: 'rec', f: { k: 'proj', n: 1, i: 0 }, g: { k: 'comp', f: { k: 'succ' }, gs: [{ k: 'proj', n: 3, i: 2 }] } };
  }
}

const kindOf = (s: RFSpec): Kind => (s.k === 'basic' ? s.name : s.k);

export function specTex(s: RFSpec): string {
  switch (s.k) {
    case 'zero':
      return '\\mathrm{zero}';
    case 'succ':
      return '\\mathrm{succ}';
    case 'proj':
      return `P^{${s.n}}_{${s.i}}`;
    case 'basic':
      return BASIC_TEX[s.name];
    default:
      return '';
  }
}

export interface BuilderProps {
  spec: RFSpec;
  onChange: (s: RFSpec) => void;
  errors: Map<string, string>;
  /** Called when a node is hovered, with its path. */
  onHover?: (path: string | null) => void;
  path?: string;
  role?: ReactNode;
}

export function FunctionBuilder(props: BuilderProps) {
  return (
    <div className="fb" onMouseLeave={() => props.onHover?.(null)}>
      <NodeEditor {...props} path={props.path ?? 'r'} />
    </div>
  );
}

function NodeEditor({ spec, onChange, errors, onHover, path = 'r', role }: BuilderProps) {
  const err = errors.get(path);
  const k = kindOf(spec);
  const compound = spec.k === 'comp' || spec.k === 'min' || spec.k === 'rec';
  return (
    <div className={`fb-node ${compound ? 'compound' : 'leaf'} ${err ? 'has-error' : ''}`}>
      <div className="fb-line" data-n={path} onMouseEnter={() => onHover?.(path)}>
        {role && <span className="fb-role">{role}</span>}
        <label className="sr-only" htmlFor={`k-${path}`}>
          function
        </label>
        <select id={`k-${path}`} value={k} onChange={(e) => onChange(fresh(e.target.value as Kind))} className="fb-kind">
          {KINDS.map((x) => (
            <option key={x.k} value={x.k}>
              {x.label}
            </option>
          ))}
        </select>
        {spec.k === 'proj' && (
          <span className="fb-proj">
            <label>
              n
              <input type="number" min={1} max={5} value={spec.n} onChange={(e) => onChange({ ...spec, n: clamp(Number(e.target.value), 1, 5), i: Math.min(spec.i, clamp(Number(e.target.value), 1, 5) - 1) })} />
            </label>
            <label>
              i
              <input type="number" min={0} max={spec.n - 1} value={spec.i} onChange={(e) => onChange({ ...spec, i: clamp(Number(e.target.value), 0, spec.n - 1) })} />
            </label>
          </span>
        )}
        {!compound && <Tex tex={specTex(spec)} />}
        {err && (
          <span className="fb-error" role="alert">
            {err}
          </span>
        )}
      </div>
      {spec.k === 'comp' && (
        <div className="fb-children">
          <NodeEditor spec={spec.f} onChange={(f) => onChange({ ...spec, f })} errors={errors} onHover={onHover} path={`${path}.f`} role="outer f" />
          {spec.gs.map((g, i) => (
            <div key={i} className="fb-inner">
              <NodeEditor
                spec={g}
                onChange={(ng) => onChange({ ...spec, gs: spec.gs.map((x, j) => (j === i ? ng : x)) })}
                errors={errors}
                onHover={onHover}
                path={`${path}.g${i}`}
                role={`inner g${sub(i)}`}
              />
              {spec.gs.length > 1 && (
                <button className="icon-btn" aria-label={`remove g${i}`} onClick={() => onChange({ ...spec, gs: spec.gs.filter((_, j) => j !== i) })}>
                  ✕
                </button>
              )}
            </div>
          ))}
          <button className="chip-btn" onClick={() => onChange({ ...spec, gs: [...spec.gs, { k: 'proj', n: 1, i: 0 }] })}>
            + inner function
          </button>
        </div>
      )}
      {spec.k === 'min' && (
        <div className="fb-children">
          <NodeEditor spec={spec.f} onChange={(f) => onChange({ ...spec, f })} errors={errors} onHover={onHover} path={`${path}.f`} role="search in f(x, z⃗) = 0" />
        </div>
      )}
      {spec.k === 'rec' && (
        <div className="fb-children">
          <NodeEditor spec={spec.f} onChange={(f) => onChange({ ...spec, f })} errors={errors} onHover={onHover} path={`${path}.f`} role="base f" />
          <NodeEditor spec={spec.g} onChange={(g) => onChange({ ...spec, g })} errors={errors} onHover={onHover} path={`${path}.g`} role="step g" />
        </div>
      )}
    </div>
  );
}

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, Number.isFinite(x) ? x : a));
const sub = (i: number) => '₀₁₂₃₄₅₆₇₈₉'[i] ?? String(i);
