// Choosing a structure, showing its interpretations as tables, and editing a small one.

import { useId } from 'react';
import { constName, fnName, predName } from '../../engine/syntax/language';
import { showElem, showTuple, tupleKey, tuples, type Structure } from '../../engine/semantics/structure';
import { STRUCTURE_PRESETS } from '../../engine/semantics/examples';
import { SEARCH_STRUCTURES } from '../../engine/semantics/infinite';
import {
  CUSTOM_ORDER, CUSTOM_SYMBOLS, DEFAULT_CUSTOM, MAX_CUSTOM, defaultValue, resizeCustom, resolve, type CustomSpec, type CustomSymbol, type Resolved, type StructureChoice,
} from './model';
import './sem.css';

export type PickerScope = 'all' | 'arith' | 'finite' | 'pure';

interface Option {
  value: string;
  label: string;
  choice: StructureChoice;
}

function options(scope: PickerScope, current: StructureChoice): Option[] {
  const out: Option[] = [];
  const add = (label: string, choice: StructureChoice) => out.push({ value: JSON.stringify(choice.kind === 'mod' ? { kind: 'mod', mode: choice.mode } : choice.kind === 'custom' ? { kind: 'custom' } : choice.kind === 'pure' ? { kind: 'pure' } : choice), label, choice });
  if (scope !== 'pure') {
    for (const p of STRUCTURE_PRESETS) {
      if (scope === 'arith' && !['Z5', 'N4', 'cycle'].includes(p.id)) continue;
      if (p.id === 'Z5' || p.id === 'N4') continue;
      add(p.label, { kind: 'preset', id: p.id });
    }
    add('ℤₙ: arithmetic mod n (successor wraps around)', current.kind === 'mod' && current.mode === 'wrap' ? current : { kind: 'mod', n: 5, mode: 'wrap' });
    add('ℕ cut off at n − 1 (successor saturates)', current.kind === 'mod' && current.mode === 'saturate' ? current : { kind: 'mod', n: 5, mode: 'saturate' });
  }
  if (scope !== 'arith') add('A bare domain {0, …, n − 1} (no symbols)', current.kind === 'pure' ? current : { kind: 'pure', n: 3 });
  if (scope !== 'pure') add('Your own finite structure (edit the tables)', current.kind === 'custom' ? current : { kind: 'custom', spec: DEFAULT_CUSTOM });
  if (scope === 'all' || scope === 'arith') for (const S of SEARCH_STRUCTURES) add(`${S.name}: ${S.domainText} (infinite, searched)`, { kind: 'search', id: S.id });
  return out;
}

const keyOf = (c: StructureChoice) => JSON.stringify(c.kind === 'mod' ? { kind: 'mod', mode: c.mode } : c.kind === 'custom' ? { kind: 'custom' } : c.kind === 'pure' ? { kind: 'pure' } : c);

export function StructurePicker({ value, onChange, scope = 'all', label = 'Structure' }: { value: StructureChoice; onChange: (c: StructureChoice) => void; scope?: PickerScope; label?: string }) {
  const id = useId();
  const opts = options(scope, value);
  const cur = keyOf(value);
  return (
    <div className="sem-picker">
      <label className="fi-label" htmlFor={id}>
        {label}
      </label>
      <div className="sem-picker-row">
        <select id={id} className="fi-examples sem-select" value={cur} onChange={(e) => onChange(opts.find((o) => o.value === e.target.value)!.choice)}>
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {(value.kind === 'mod' || value.kind === 'pure') && (
          <label className="sem-inline">
            n =
            <input
              type="number"
              min={1}
              max={value.kind === 'mod' ? 12 : 8}
              value={value.n}
              onChange={(e) => {
                const n = Math.max(1, Math.min(value.kind === 'mod' ? 12 : 8, Number(e.target.value) || 1));
                onChange({ ...value, n });
              }}
            />
          </label>
        )}
      </div>
      {value.kind === 'custom' && <CustomEditor spec={value.spec} onChange={(spec) => onChange({ kind: 'custom', spec })} />}
    </div>
  );
}

// ------------------------------------------------------------------ viewing a structure

export function StructureView({ r, compact = false }: { r: Resolved; compact?: boolean }) {
  if (r.kind === 'error')
    return (
      <div className="sem-errors" role="alert">
        <b>Not a structure:</b>
        <ul>
          {r.errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      </div>
    );
  if (r.kind === 'search')
    return (
      <div className="sem-structure">
        <p className="wb-note">
          <b>
            {r.S.name}, with domain {r.S.domainText}.
          </b>{' '}
          {r.S.description}
        </p>
        <p className="wb-note">
          The domain is infinite. Terms and quantifier-free formulas are computed exactly; a quantifier is <em>searched</em> through the first elements of {r.S.domainText}
          {r.S.exactBounded ? ' (bounded quantifiers ∀x (x < t → …) and ∃x (x < t ∧ …) exactly)' : ''}. A witness for ∃ or a counterexample to ∀ settles it; otherwise the answer is “unknown”.
        </p>
      </div>
    );
  return <FiniteTables M={r.M} compact={compact} />;
}

export function FiniteTables({ M, compact = false }: { M: Structure; compact?: boolean }) {
  const D = M.domain;
  return (
    <div className="sem-structure">
      <p className="sem-domain">
        <span className="sem-k">|{M.name}|</span> = {'{'}
        {D.map((d, i) => (
          <span key={i} className="sem-elem">
            {showElem(d)}
            {i < D.length - 1 ? ', ' : ''}
          </span>
        ))}
        {'}'}
      </p>
      {M.description && !compact && <p className="wb-note">{M.description}</p>}
      <div className="sem-tables">
        {[...M.constants].map(([c, e]) => (
          <div key={`c${c}`} className="sem-table-box">
            <span className="sem-k">
              {constName(c)}
              <sup>{M.name}</sup>
            </span>{' '}
            = <span className="sem-elem">{showElem(e)}</span>
          </div>
        ))}
        {[...M.functions.values()].map((f) => (
          <div key={`f${f.arity}/${f.index}`} className="sem-table-box">
            <div className="sem-table-title">
              {f.arity === 1 && f.index === 0 ? 'successor ′' : fnName(f.arity, f.index)}
              <sup>{M.name}</sup>
            </div>
            <div className="sem-scroll">
              {f.arity === 1 ? (
                <table className="sem-table">
                  <tbody>
                    <tr>
                      <th scope="row">x</th>
                      {D.map((d, i) => (
                        <td key={i}>{showElem(d)}</td>
                      ))}
                    </tr>
                    <tr>
                      <th scope="row">{f.index === 0 ? 'x′' : `${fnName(1, f.index)}(x)`}</th>
                      {D.map((d, i) => (
                        <td key={i} className="sem-val">
                          {showElem(f.table.get(tupleKey([d]))!)}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              ) : f.arity === 2 ? (
                <table className="sem-table">
                  <thead>
                    <tr>
                      <th scope="col">{fnName(2, f.index)}</th>
                      {D.map((d, i) => (
                        <th key={i} scope="col">
                          {showElem(d)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {D.map((a, i) => (
                      <tr key={i}>
                        <th scope="row">{showElem(a)}</th>
                        {D.map((b, j) => (
                          <td key={j} className="sem-val">
                            {showElem(f.table.get(tupleKey([a, b]))!)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="small">{tuples(D, f.arity).map((t) => `${showTuple(t)} ↦ ${showElem(f.table.get(tupleKey(t))!)}`).join(', ')}</p>
              )}
            </div>
          </div>
        ))}
        {[...M.relations.values()].map((r) => (
          <div key={`r${r.arity}/${r.index}`} className="sem-table-box">
            <div className="sem-table-title">
              {predName(r.arity, r.index)}
              <sup>{M.name}</sup>
            </div>
            <div className="sem-scroll">
              {r.arity === 2 ? (
                <table className="sem-table" aria-label={`${predName(2, r.index)}: a check mark in row x, column y means ⟨x, y⟩ is in the relation`}>
                  <thead>
                    <tr>
                      <th scope="col" title="row x, column y">
                        x \ y
                      </th>
                      {D.map((d, i) => (
                        <th key={i} scope="col">
                          {showElem(d)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {D.map((a, i) => (
                      <tr key={i}>
                        <th scope="row">{showElem(a)}</th>
                        {D.map((b, j) => {
                          const on = r.tuples.has(tupleKey([a, b]));
                          return (
                            <td key={j} className={on ? 'sem-on' : 'sem-off'} aria-label={on ? 'in' : 'not in'}>
                              {on ? '✓' : '·'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="sem-set">
                  {'{'}
                  {tuples(D, r.arity)
                    .filter((t) => r.tuples.has(tupleKey(t)))
                    .map(showTuple)
                    .join(', ')}
                  {'}'}
                </p>
              )}
            </div>
          </div>
        ))}
        {M.constants.size + M.functions.size + M.relations.size === 0 && <p className="wb-note">No non-logical symbols are interpreted: only = and the logical symbols can be used.</p>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ editing a small structure

function CustomEditor({ spec, onChange }: { spec: CustomSpec; onChange: (s: CustomSpec) => void }) {
  const n = spec.n;
  const D = Array.from({ length: n }, (_, i) => i);
  const set = (k: CustomSymbol, v: CustomSpec['on'][CustomSymbol]) => onChange({ ...spec, on: { ...spec.on, [k]: v } });
  const toggle = (k: CustomSymbol, on: boolean) => {
    const next = { ...spec.on };
    if (on) next[k] = defaultValue(k, n);
    else delete next[k];
    onChange({ ...spec, on: next });
  };
  const r = resolve({ kind: 'custom', spec });
  return (
    <fieldset className="sem-editor">
      <legend className="sem-k">Your structure</legend>
      <label className="sem-inline">
        domain {'{'}0, …, n − 1{'}'} with n =
        <input type="number" min={1} max={MAX_CUSTOM} value={n} onChange={(e) => onChange(resizeCustom(spec, Math.max(1, Math.min(MAX_CUSTOM, Number(e.target.value) || 1))))} />
      </label>
      <div className="sem-symbols" role="group" aria-label="Symbols to interpret">
        {CUSTOM_ORDER.map((k) => (
          <label key={k} className="sem-check">
            <input type="checkbox" checked={spec.on[k] !== undefined} onChange={(e) => toggle(k, e.target.checked)} />
            {CUSTOM_SYMBOLS[k].label}
          </label>
        ))}
      </div>
      <div className="sem-tables">
        {CUSTOM_ORDER.filter((k) => spec.on[k] !== undefined).map((k) => {
          const d = CUSTOM_SYMBOLS[k];
          const v = spec.on[k]!;
          const sel = (val: number, onSel: (x: number) => void, label: string) => (
            <select aria-label={label} value={val} onChange={(e) => onSel(Number(e.target.value))}>
              {D.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          );
          return (
            <div key={k} className="sem-table-box">
              <div className="sem-table-title">{k === 'succ' ? 'successor ′' : d.label}</div>
              <div className="sem-scroll">
                {d.kind === 'const' ? (
                  sel(v as number, (x) => set(k, x), `value of ${d.label}`)
                ) : d.kind === 'fn' && d.arity === 1 ? (
                  <table className="sem-table">
                    <tbody>
                      <tr>
                        <th scope="row">x</th>
                        {D.map((x) => (
                          <td key={x}>{x}</td>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row">{k === 'succ' ? 'x′' : 'f(x)'}</th>
                        {D.map((x) => (
                          <td key={x}>{sel((v as number[])[x], (y) => set(k, (v as number[]).map((z, i) => (i === x ? y : z))), `${d.label} of ${x}`)}</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                ) : d.kind === 'fn' ? (
                  <table className="sem-table">
                    <thead>
                      <tr>
                        <th scope="col">{d.label}</th>
                        {D.map((x) => (
                          <th key={x} scope="col">
                            {x}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {D.map((x) => (
                        <tr key={x}>
                          <th scope="row">{x}</th>
                          {D.map((y) => (
                            <td key={y}>{sel((v as number[][])[x][y], (z) => set(k, (v as number[][]).map((row, i) => row.map((w, j) => (i === x && j === y ? z : w)))), `${x} ${d.label} ${y}`)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : d.arity === 1 ? (
                  <div className="sem-symbols">
                    {D.map((x) => (
                      <label key={x} className="sem-check">
                        <input type="checkbox" checked={(v as boolean[])[x]} onChange={(e) => set(k, (v as boolean[]).map((b, i) => (i === x ? e.target.checked : b)))} />
                        {x}
                      </label>
                    ))}
                  </div>
                ) : (
                  <table className="sem-table">
                    <thead>
                      <tr>
                        <th scope="col">x \ y</th>
                        {D.map((x) => (
                          <th key={x} scope="col">
                            {x}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {D.map((x) => (
                        <tr key={x}>
                          <th scope="row">{x}</th>
                          {D.map((y) => (
                            <td key={y}>
                              <input
                                type="checkbox"
                                aria-label={`⟨${x}, ${y}⟩ ∈ ${d.label}`}
                                checked={(v as boolean[][])[x][y]}
                                onChange={(e) => set(k, (v as boolean[][]).map((row, i) => row.map((b, j) => (i === x && j === y ? e.target.checked : b))))}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {r.kind === 'error' && <StructureView r={r} />}
    </fieldset>
  );
}
