// The symbol codes of Definition 3.1, as a table to explore, with the relations Fn and Pred.

import { useMemo, useState } from 'react';
import { describeSym, LOGICAL, officialTex, symbolCode, symbolFromCodeSeq, symTex, type Sym } from '../engine/syntax/language';
import { decodeSeq } from '../engine/numbers/nat';
import { Tex } from '../ui/Tex';
import { Prov } from '../ui/Prov';
import { inspect } from '../ui/store';
import { codePowersTex, codeSeqTex, Panel } from './coding';

const GROUPS: { title: string; note: string; syms: Sym[] }[] = [
  { title: 'Logical symbols', note: '⟨0, k⟩ for the k-th logical symbol', syms: LOGICAL.map((name) => ({ k: 'logical', name })) },
  { title: 'Variables', note: '⟨1, i⟩ for vᵢ', syms: [0, 1, 2, 3, 4, 5, 6].map((index) => ({ k: 'var', index })) },
  { title: 'Constant symbols', note: '⟨2, i⟩ for cᵢ', syms: [0, 1, 2].map((index) => ({ k: 'const', index })) },
  { title: 'Function symbols', note: '⟨3, n, i⟩ for fⁿᵢ', syms: [{ k: 'fn', arity: 1, index: 0 }, { k: 'fn', arity: 2, index: 0 }, { k: 'fn', arity: 2, index: 1 }, { k: 'fn', arity: 2, index: 10 }] },
  { title: 'Predicate symbols', note: '⟨4, n, i⟩ for Pⁿᵢ', syms: [{ k: 'pred', arity: 2, index: 0 }, { k: 'pred', arity: 1, index: 10 }, { k: 'pred', arity: 3, index: 11 }] },
];

function entry(s: Sym) {
  const code = symbolCode(s);
  return {
    key: `symtab:${codeSeqTex(s)}`,
    kicker: 'Symbol code',
    title: <Tex tex={symTex(s)} />,
    body: (
      <>
        <p>{describeSym(s).replace(/^./, (c) => c.toUpperCase())}. Officially <Tex tex={officialTex(s)} />.</p>
        <p>
          <Tex tex={`\\mathrm{c}_{${symTex(s)}} = ${codeSeqTex(s)} = ${codePowersTex(s)} = ${code}`} />
        </p>
        <p className="muted">
          The first component says what kind of symbol it is; the others say which one. So the kind, the arity and the index can be read back off the code — by a primitive
          recursive computation.
        </p>
      </>
    ),
  };
}

export function SymbolTable() {
  return (
    <div className="workbench">
      <Panel n={1} title="The symbol codes" prov={<Prov kind="computed" />}>
        {GROUPS.map((g) => (
          <div key={g.title} className="symtab-group">
            <div className="symtab-head">
              <b>{g.title}</b> <span className="muted">— {g.note}</span>
            </div>
            <div className="symtab-row">
              {g.syms.map((s, i) => (
                <button key={i} className="symtab-cell" onMouseEnter={() => inspect(entry(s))} onFocus={() => inspect(entry(s))} onClick={() => inspect(entry(s), true)}>
                  <span className="symtab-sym">
                    <Tex tex={symTex(s)} />
                  </span>
                  <span className="symtab-seq">
                    <Tex tex={codeSeqTex(s)} />
                  </span>
                  <span className="symtab-code">{symbolCode(s).toLocaleString('en-US')}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        <p className="muted small sans">
          In the language of arithmetic, this edition takes 0 = c₀, ′ = f¹₀, + = f²₀, × = f²₁ and &lt; = P²₀ (the book leaves this choice open). f and P, Q stand for other
          function and predicate symbols.
        </p>
      </Panel>
      <Panel n={2} title="Reading a code back" prov={<Prov kind="computed" />}>
        <CodeReader />
      </Panel>
    </div>
  );
}

function CodeReader() {
  const [text, setText] = useState('720');
  const result = useMemo(() => {
    if (!/^\d+$/.test(text.trim())) return { error: 'Enter a natural number.' };
    const n = BigInt(text.trim());
    if (n.toString().length > 40) return { error: 'That is larger than any symbol code shown here.' };
    // The book lets ⟨⟩ be 0; every non-empty sequence code is even, so 1 codes nothing.
    if (n === 1n) return { error: '1 is not the code of a sequence: the book lets ⟨⟩ be 0, and every non-empty sequence code is divisible by 2.' };
    const d = decodeSeq(n);
    if (!d.ok) return { error: d.reason, steps: d.steps };
    const s = symbolFromCodeSeq(d.items);
    return { items: d.items, sym: 'error' in s ? null : s, why: 'error' in s ? s.error : null };
  }, [text]);
  const n = /^\d+$/.test(text.trim()) ? BigInt(text.trim()) : null;
  const sym = 'sym' in result ? result.sym : null;
  const fnArity = sym && sym.k === 'fn' ? sym.arity : null;
  const predArity = sym && sym.k === 'pred' ? sym.arity : sym && sym.k === 'logical' && sym.name === '=' ? 2 : null;
  return (
    <div className="code-reader">
      <label className="fi-label" htmlFor="code-in">
        A number
      </label>
      <div className="fi-row">
        <input id="code-in" className="fi-field mono" value={text} onChange={(e) => setText(e.target.value)} inputMode="numeric" />
        {['720', '13122', '3888', '1080', '7', '12'].map((x) => (
          <button key={x} className="chip-btn" onClick={() => setText(x)}>
            {x}
          </button>
        ))}
      </div>
      {'error' in result && result.error ? (
        <p className="fi-error">{result.error}</p>
      ) : 'items' in result ? (
        <div className="code-reader-out">
          <p>
            <Tex tex={`${n} = \\langle ${result.items!.join(', ')} \\rangle`} />{' '}
            {sym ? (
              <>
                is the code of <Tex tex={symTex(sym)} /> — {describeSym(sym)}.
              </>
            ) : (
              <>is a sequence code, but not a symbol code: {result.why}</>
            )}
          </p>
          <p className="muted sans small">
            The relations of the proposition after the definition: <Tex tex={`\\mathrm{Fn}(${n}, n)`} /> holds {fnArity ? <>exactly for n = {fnArity}</> : 'for no n'}; <Tex tex={`\\mathrm{Pred}(${n}, n)`} /> holds{' '}
            {predArity ? <>exactly for n = {predArity}</> : 'for no n'}.
          </p>
        </div>
      ) : null}
    </div>
  );
}
