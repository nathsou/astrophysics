// Quine's informal version of diagonalisation, next to the arithmetical one.

import { useState } from 'react';

export function QuineDiagonal() {
  const [phrase, setPhrase] = useState('yields a falsehood when preceded by its own quotation');
  const diag = `‘${phrase}’ ${phrase}`;
  return (
    <div className="quine">
      <label className="fi-label" htmlFor="quine-in">
        An expression with a gap for its subject
      </label>
      <input id="quine-in" className="fi-field" value={phrase} onChange={(e) => setPhrase(e.target.value)} />
      <div className="quine-row">
        <span className="quine-tag">its quotation</span>
        <span className="quine-q">‘{phrase}’</span>
      </div>
      <div className="quine-row">
        <span className="quine-tag">its diagonalisation</span>
        <span>
          <span className="quine-q">‘{phrase}’</span> <span className="quine-p">{phrase}</span>
        </span>
      </div>
      <p className="muted small sans">
        The diagonalisation has {diag.length} characters. If the expression is “yields a falsehood when preceded by its own quotation”, the diagonalisation says of{' '}
        <em>itself</em> that it yields a falsehood: it is the liar, built without any word for “this sentence”.
      </p>
      <table className="quine-map sans small">
        <tbody>
          <tr>
            <th scope="row">expression with a gap</th>
            <td>
              a formula <i>E</i>(<i>x</i>)
            </td>
          </tr>
          <tr>
            <th scope="row">its quotation</th>
            <td>
              the numeral ⌜<i>E</i>(<i>x</i>)⌝ of its Gödel number
            </td>
          </tr>
          <tr>
            <th scope="row">preceding by the quotation</th>
            <td>
              substituting the numeral for <i>x</i>
            </td>
          </tr>
          <tr>
            <th scope="row">“yields … when preceded by its own quotation”</th>
            <td>
              <i>B</i>(diag(<i>x</i>)), written ∃<i>y</i> (D<sub>diag</sub>(<i>x</i>, <i>y</i>) ∧ <i>B</i>(<i>y</i>))
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
