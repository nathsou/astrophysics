// Section "Coding Computations": the four things every model of computation provides — indices,
// records of computations, a test that a record is correct (T), and the output (U) — made
// concrete in this edition's coding (records.ts).

import { useMemo, useState } from 'react';
import { Panel } from '../coding';
import { Prov } from '../../ui/Prov';
import { Tex } from '../../ui/Tex';
import { useStore } from '../../ui/store';
import { checkRecord, computationRecord, describeCodeSize, encodeRecord, flattenRecord, recordCodeSize, type RecordNode, type TResult } from '../../engine/computability/records';
import { FuelControl, IndexPicker, IndexSummary, indexStore, inputStore, parseNat, Big } from './shared';
import { CodingNote } from './IndexExplorer';

const RULE: Record<RecordNode['rule'], string> = { zero: 'zero', succ: 'succ', proj: 'P', comp: 'Comp', rec: 'Rec', min: 'μ' };
const SHOW = 400;

export function shortIndex(e: bigint) {
  const s = e.toString();
  return s.length <= 10 ? s : `${s.slice(0, 4)}…${s.slice(-3)}`;
}

function cloneWith(n: RecordNode, path: number[], value: bigint | null, depth = 0): RecordNode {
  const here = depth === path.length;
  return {
    ...n,
    value: here && value !== null ? value : n.value,
    children: n.children.map((c, i) => (i === path[depth] && !here ? cloneWith(c, path, value, depth + 1) : c)),
  };
}

const samePath = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);
const pathKey = (p: number[]) => p.join('.');

export function RecordTree({ root, check, selected, onSelect, limit = SHOW }: { root: RecordNode; check?: TResult; selected?: number[] | null; onSelect?: (p: number[]) => void; limit?: number }) {
  const flat = useMemo(() => flattenRecord(root), [root]);
  const status = useMemo(() => {
    const m = new Map<string, boolean>();
    check?.checks.forEach((c) => m.set(pathKey(c.path), c.ok));
    return m;
  }, [check]);
  const shown = flat.slice(0, limit);
  return (
    <>
      <ol className="ct-tree" aria-label="computation record, one call per line">
        {shown.map(({ node, depth, path }) => {
          const st = status.get(pathKey(path));
          const sel = selected && samePath(selected, path);
          return (
            <li key={pathKey(path) || 'root'} className={`${st === true ? 'ok' : st === false ? 'fail' : ''} ${sel ? 'sel' : ''}`}>
              <span className="ct-indent" style={{ width: `${Math.min(depth, 30) * 12}px` }} aria-hidden="true" />
              <span className="ct-mark" aria-label={st === true ? 'checked' : st === false ? 'fails' : 'not checked'}>
                {st === true ? '✓' : st === false ? '✗' : '·'}
              </span>
              <span className="ct-rule">{RULE[node.rule]}</span>
              {onSelect ? (
                <button className="ct-rowbtn" onClick={() => onSelect(path)} aria-pressed={!!sel} title="select this call to alter its recorded value">
                  #{shortIndex(node.e)}({node.args.join(', ')})
                </button>
              ) : (
                <span>
                  #{shortIndex(node.e)}({node.args.join(', ')})
                </span>
              )}
              <span>
                = <span className="ct-val">{node.value.toString()}</span>
              </span>
            </li>
          );
        })}
      </ol>
      {flat.length > shown.length && (
        <p className="wb-note">
          Showing the first {shown.length} of {flat.length.toLocaleString('en-US')} calls.
        </p>
      )}
    </>
  );
}

export function RecordLab() {
  const text = useStore(indexStore);
  const xText = useStore(inputStore);
  const e = parseNat(text);
  const x = parseNat(xText, 4);
  const [fuel, setFuel] = useState(3000);
  const [sel, setSel] = useState<number[] | null>(null);
  const [alt, setAlt] = useState('');
  const run = useMemo(() => (e === null || x === null ? null : computationRecord(e, x, fuel)), [e, x, fuel]);
  const altValue = parseNat(alt, 30);
  const root = run?.kind === 'halted' ? run.root : null;
  const tampered = useMemo(() => (root && sel && altValue !== null ? cloneWith(root, sel, altValue) : root), [root, sel, altValue]);
  const check = useMemo(() => (tampered && e !== null && x !== null ? checkRecord(tampered, e, [x]) : null), [tampered, e, x]);
  const size = useMemo(() => (tampered ? recordCodeSize(tampered) : null), [tampered]);
  const s = useMemo(() => (tampered ? encodeRecord(tampered, 14) : null), [tampered]);
  const isTampered = !!(root && tampered !== root);
  const reset = () => {
    setSel(null);
    setAlt('');
  };

  return (
    <div className="workbench">
      <Panel n={1} title="A definition, coded by its index" prov={<Prov kind="computed" />}>
        <CodingNote />
        <IndexPicker
          value={text}
          onChange={(v) => {
            indexStore.set(v);
            reset();
          }}
        />
        {e !== null && <IndexSummary e={e} />}
        <div className="ct-controls">
          <label>
            input x ={' '}
            <input
              className={`ct-inline-input ${x === null ? 'invalid' : ''}`}
              value={xText}
              onChange={(ev) => {
                inputStore.set(ev.target.value);
                reset();
              }}
              inputMode="numeric"
              aria-label="input x"
            />
          </label>
          <FuelControl fuel={fuel} setFuel={setFuel} />
        </div>
        {x === null && <p className="fi-error">x must be a number below 10 000.</p>}
      </Panel>

      <Panel n={2} title="The record of the computation" prov={<Prov kind="computed" />}>
        {!run ? null : run.kind === 'notAFunction' ? (
          <p className="wb-note">
            There is nothing to record: e is not a one-place definition ({run.reason}). No number s satisfies <Tex tex="T(e, x, s)" />.
          </p>
        ) : run.kind === 'outOfFuel' ? (
          <p className="wb-note">
            No record within {fuel.toLocaleString('en-US')} calls. The computation may need more, or it may never end — in which case there is no record at all, and{' '}
            <Tex tex="\varphi_e(x)" /> is undefined.
          </p>
        ) : (
          <>
            <p className="wb-note">
              One line per function call, in the order the calls start; indented lines are the calls made by the line above them. Each line is a node{' '}
              <Tex tex="\langle e', \vec y, v, \ldots\rangle" />: which part of the definition was called (its index <Tex tex="e'" />), on which arguments, with which
              value. <b>Select a line</b> to alter its value and see the test fail.
            </p>
            <RecordTree root={tampered!} check={check ?? undefined} selected={sel} onSelect={(p) => { setSel(p); setAlt(''); }} />
            <p className="sans small">
              {run.nodes.toLocaleString('en-US')} call{run.nodes === 1 ? '' : 's'} recorded.
            </p>
          </>
        )}
      </Panel>

      {tampered && check && (
        <Panel n={3} title={<>The test: does s code a correct record? (T)</>} prov={<Prov kind="computed" />}>
          {sel && (
            <div className="ct-controls">
              <label>
                record a different value at the selected call:{' '}
                <input className={`ct-inline-input ${alt && altValue === null ? 'invalid' : ''}`} value={alt} onChange={(ev) => setAlt(ev.target.value)} inputMode="numeric" aria-label="altered value" placeholder="value" />
              </label>
              <button className="chip-btn" onClick={reset}>
                restore the true record
              </button>
            </div>
          )}
          <p aria-live="polite">
            <Tex tex={`T(e, ${x}, s)`} />:{' '}
            {check.holds ? <span className="ct-verdict yes">holds</span> : <span className="ct-verdict no">fails</span>}{' '}
            {isTampered && <span className="sans small muted">(on the altered record)</span>}
          </p>
          {check.failure ? (
            <p className="wb-note danger">
              At the call marked ✗: {check.failure.what}.
            </p>
          ) : (
            <p className="wb-note">
              Every one of the {check.checks.length.toLocaleString('en-US')} calls obeys the rule of its part of the definition — zero gives 0, succ adds one, a composition calls its
              inner functions and then the outer one on their values, a recursion calls its base and step functions in order, a search tests 0, 1, … and stops at the first
              0. Each check is local and looks only at numbers inside s. That is why <Tex tex="T" /> is decidable; the book asserts that, with care, it is even primitive
              recursive.
            </p>
          )}
        </Panel>
      )}

      {tampered && size !== null && (
        <Panel n={4} title="The code s and the output U(s)" prov={<Prov kind="computed" />}>
          <p className="wb-note">
            The whole record is one number, <Tex tex="s = J(e', J(\mathrm{seq}(\vec y), J(v, \mathrm{seq}(\text{children}))))" /> at every node, with{' '}
            <Tex tex="\mathrm{seq}() = 0" />, <Tex tex="\mathrm{seq}(a, \vec b) = 1 + J(a, \mathrm{seq}(\vec b))" /> (this edition’s coding).
          </p>
          <p>
            s ={' '}
            {s !== null ? (
              <Big n={s} />
            ) : (
              <span className="sans">
                a number with {describeCodeSize(size).text} — too large to write down here (each level of nesting roughly squares it). Checking it never requires writing it
                in decimal.
              </span>
            )}
          </p>
          <p>
            <Tex tex={`U(s) = K(L(L(s))) = ${tampered.value}`} /> <span className="sans small muted">— the value recorded at the root.</span>
          </p>
          {check && !check.holds && (
            <p className="wb-note">
              <Tex tex="U" /> is total: it reads a value off <em>any</em> s. It is only meaningful for an s with <Tex tex="T(e, x, s)" />, which this one is not.
            </p>
          )}
        </Panel>
      )}
    </div>
  );
}
