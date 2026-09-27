// Text entry for formulas and terms, with a symbol palette and precise parse errors.

import { useId, useRef, useState } from 'react';
import type { ParseResult } from '../engine/syntax/parse';

const PALETTE = ['∀', '∃', '¬', '∧', '∨', '→', '↔', '⊥', '=', '≠', '<', '+', '×', '′', '(', ')'];

export interface FormulaInputProps {
  value: string;
  onChange: (s: string) => void;
  parsed: ParseResult<unknown>;
  label: string;
  examples?: { label: string; value: string }[];
  palette?: boolean;
  size?: 'normal' | 'compact';
}

export function FormulaInput({ value, onChange, parsed, label, examples, palette = true, size = 'normal' }: FormulaInputProps) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    // the object changed elsewhere (another mode, an example button)
    setLastValue(value);
    setDraft(value);
  }
  const commit = (s: string) => {
    setDraft(s);
    setLastValue(s);
    onChange(s);
  };
  const insert = (sym: string) => {
    const el = ref.current;
    if (!el) return;
    const a = el.selectionStart ?? draft.length;
    const b = el.selectionEnd ?? draft.length;
    const next = draft.slice(0, a) + sym + draft.slice(b);
    commit(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + sym.length, a + sym.length);
    });
  };
  const err = !parsed.ok ? parsed : null;
  return (
    <div className={`formula-input ${size}`}>
      <label htmlFor={id} className="fi-label">
        {label}
      </label>
      <div className="fi-row">
        <input
          ref={ref}
          id={id}
          className={`fi-field ${err ? 'invalid' : ''}`}
          value={draft}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={!!err}
          aria-describedby={err ? `${id}-err` : undefined}
          onChange={(e) => commit(e.target.value)}
        />
        {examples && (
          <select
            className="fi-examples"
            aria-label="Examples"
            value=""
            onChange={(e) => {
              if (e.target.value) commit(e.target.value);
            }}
          >
            <option value="">Examples…</option>
            {examples.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </select>
        )}
      </div>
      {palette && (
        <div className="fi-palette" role="toolbar" aria-label="Insert a symbol">
          {PALETTE.map((s) => (
            <button key={s} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(s)} aria-label={`insert ${s}`}>
              {s}
            </button>
          ))}
          <span className="fi-hint">ASCII works too: A x, E y, ~, &amp;, |, -&gt;, ', *</span>
        </div>
      )}
      {err && (
        <div className="fi-error" id={`${id}-err`} role="alert">
          <code className="fi-caret">
            {draft.slice(0, err.pos)}
            <mark>{draft.slice(err.pos, err.pos + 1) || ' '}</mark>
            {draft.slice(err.pos + 1)}
          </code>
          <span>{err.error}</span>
        </div>
      )}
    </div>
  );
}
