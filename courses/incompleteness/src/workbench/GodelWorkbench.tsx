// The formula / symbols / codes / number workbench.

import { useMemo, useState } from 'react';
import { godel } from '../engine/coding/godel';
import { analyze } from '../engine/syntax/analysis';
import type { Node } from '../engine/syntax/ast';
import { useParsedFormula, useParsedTerm } from '../content/objects';
import { FormulaInput } from '../ui/FormulaInput';
import { FormulaView } from '../ui/FormulaView';
import { SyntaxTree } from '../ui/SyntaxTree';
import { Prov } from '../ui/Prov';
import { Tex } from '../ui/Tex';
import { FORMULA_EXAMPLES } from '../ui/examples';
import { CodeTable, Decoder, EncodeStepper, GodelNumberView, Panel, SymbolStrip } from './coding';

export function GodelWorkbench({ kind = 'formula', decoder = true }: { kind?: 'formula' | 'term'; decoder?: boolean }) {
  const [ftext, fset, fparsed] = useParsedFormula();
  const [ttext, tset, tparsed] = useParsedTerm();
  const text = kind === 'formula' ? ftext : ttext;
  const set = kind === 'formula' ? fset : tset;
  const parsed = kind === 'formula' ? fparsed : tparsed;
  const node: Node | null = parsed.ok ? parsed.value : null;
  const enc = useMemo(() => (node ? godel(node) : null), [node]);
  const coded = enc?.expanded ?? null;
  const analysis = useMemo(() => (coded ? analyze(coded) : null), [coded]);
  const origAnalysis = useMemo(() => (node ? analyze(node) : null), [node]);
  const [showTree, setShowTree] = useState(false);

  return (
    <div className="workbench">
      <FormulaInput value={text} onChange={set} parsed={parsed} label={kind === 'formula' ? 'Your formula' : 'Your term'} examples={kind === 'formula' ? FORMULA_EXAMPLES : TERM_EXAMPLES} />
      {node && enc && analysis && origAnalysis && coded && (
        <>
          <Panel n={1} title={kind === 'formula' ? 'The formula' : 'The term'} prov={<Prov kind="computed" />}>
            <div className="wb-formula">
              <FormulaView node={node} analysis={origAnalysis} />
            </div>
            <button className="chip-btn" aria-pressed={showTree} onClick={() => setShowTree((s) => !s)}>
              {showTree ? 'hide' : 'show'} syntax tree
            </button>
            {showTree && <SyntaxTree node={coded} analysis={analysis} />}
          </Panel>
          <Panel n={2} title="Its official symbols" prov={<span className="muted small sans">{enc.items.length} entries</span>}>
            {enc.expansions.length > 0 && (
              <p className="wb-note">
                <b>First, the abbreviations are expanded.</b> In this book {enc.expansions.map((e) => e.note).join('; ')}. What is coded is
                <span className="wb-expanded">
                  <FormulaView node={coded} analysis={analysis} />
                </span>
              </p>
            )}
            <p className="wb-note">
              Official notation is prefix notation with parentheses and commas: <Tex tex="=(t_1, t_2)" /> rather than <Tex tex="t_1 = t_2" />, <Tex tex="{}'(t)" /> rather than{' '}
              <Tex tex="t'" />. Hover a symbol to find where it comes from.
            </p>
            <SymbolStrip enc={enc} analysis={analysis} />
          </Panel>
          <Panel n={3} title="Each symbol’s code" prov={<Prov kind="computed" />}>
            <CodeTable enc={enc} analysis={analysis} />
          </Panel>
          <Panel n={4} title="The Gödel number" prov={<Prov kind="computed" />}>
            <p className="wb-note">
              The Gödel number is the code of the sequence of symbol codes: <Tex tex="\#s_0\cdots s_{n-1}\# = \langle c_{s_0}, \ldots, c_{s_{n-1}}\rangle = p_0^{c_{s_0}+1}\cdots p_{n-1}^{c_{s_{n-1}}+1}" />. It is
              kept in exact symbolic form; its digits are computed only on request.
            </p>
            <GodelNumberView enc={enc} />
            <EncodeStepper enc={enc} analysis={analysis} />
          </Panel>
          {decoder && (
            <Panel n={5} title="And back: decoding" prov={<Prov kind="computed" />}>
              <p className="wb-note">
                Every step of encoding can be undone by a computation: factor the number, read each exponent minus one as a symbol code, and parse the symbols. A number that
                fails at any stage is not the Gödel number of anything.
              </p>
              <Decoder onUseNumber={() => enc.number} />
            </Panel>
          )}
        </>
      )}
    </div>
  );
}

const TERM_EXAMPLES = [
  { label: 'a variable: v₅', value: 'x_0' },
  { label: 'the numeral 3̄ = 0′′′', value: '3' },
  { label: '(x + 1)′', value: "(x + 1)'" },
  { label: '(y × 2) + z', value: '(y × 2) + z' },
];
