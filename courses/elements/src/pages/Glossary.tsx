// Heath's vocabulary in modern terms (written for this edition).

const TERMS: { term: string; modern: string; where?: string }[] = [
  { term: 'straight line', modern: 'A segment, usually; "produced" when extended. Euclid has no infinite lines, only segments that can be extended as far as needed (Postulate 2).', where: '1.post.2' },
  { term: 'equal (of figures)', modern: 'Equal in area, not congruent. "The parallelogram is equal to the triangle" compares areas. Congruence is expressed by listing equal sides and angles, or by "coincide".', where: '1.35' },
  { term: 'coincide', modern: 'Superposition: one figure placed on another covers it exactly. Common Notion 4 turns this into equality. Hilbert replaces the idea with the SAS axiom.', where: '1.cn.4' },
  { term: 'the rectangle AB, BC', modern: 'The rectangle with sides AB and BC, i.e. the product $AB \\cdot BC$. Euclid multiplies lengths only in this geometric way.', where: '2.1' },
  { term: 'the square on AB', modern: '$AB^2$, as a figure.', where: '1.46' },
  { term: 'gnomon', modern: 'The L-shaped figure left when a smaller parallelogram is removed from the corner of a larger one. In algebra: $(a+b)^2 - b^2$.', where: '2.def.2' },
  { term: 'complements', modern: 'In a parallelogram divided by lines through a point on its diagonal, the two parallelograms not on the diagonal. They are equal (I.43).', where: '1.43' },
  { term: 'to apply (a parallelogram) to a line', modern: 'To construct a parallelogram of given area with one side on the given line: dividing an area by a length. With defect or excess it solves quadratic equations (VI.28–29).', where: '1.44' },
  { term: 'measures', modern: 'Divides: "A measures B" means $A \\mid B$, i.e. $B$ is a whole multiple of $A$.', where: '7.def.3' },
  { term: 'part, parts', modern: '"A is a part of B": A divides B (A = B/n). "A is parts of B": A is a proper fraction m/n of B that is not a unit fraction.', where: '7.def.3' },
  { term: 'number', modern: 'A whole number of at least 2: "a multitude composed of units". The unit, 1, is not a number.', where: '7.def.2' },
  { term: 'prime to one another', modern: 'Coprime: $\\gcd(a, b) = 1$.', where: '7.def.12' },
  { term: 'plane number, solid number', modern: 'A product of two numbers (its "sides"), or of three.', where: '7.def.16' },
  { term: 'similar plane numbers', modern: 'Numbers $ab$ and $cd$ with $a : b = c : d$. Their ratio is a ratio of squares.', where: '7.def.21' },
  { term: 'perfect number', modern: 'A number equal to the sum of its proper divisors: 6, 28, 496…', where: '7.def.22' },
  { term: 'ratio', modern: 'A relation of size between two magnitudes of the same kind. Book V never says what a ratio is, only when two ratios are equal (Def. 5).', where: '5.def.3' },
  { term: 'the same ratio', modern: 'Eudoxus: $a : b = c : d$ iff for all whole $m, n$, $ma$ exceeds, equals or falls short of $nb$ exactly when $mc$ does the same with $nd$.', where: '5.def.5' },
  { term: 'duplicate ratio', modern: 'The square of a ratio: if $a : b = b : c$, then $a : c$ is the duplicate of $a : b$. Triplicate: the cube.', where: '5.def.9' },
  { term: 'alternately (alternando)', modern: 'From $a : b = c : d$ to $a : c = b : d$.', where: '5.16' },
  { term: 'inversely (invertendo)', modern: 'From $a : b = c : d$ to $b : a = d : c$.', where: '5.def.13' },
  { term: 'componendo, separando, convertendo', modern: 'From $a : b = c : d$: $(a+b) : b = (c+d) : d$; $(a-b) : b = (c-d) : d$; $a : (a-b) = c : (c-d)$.', where: '5.def.14' },
  { term: 'ex aequali', modern: 'Chaining equal ratios: from $a : b = d : e$ and $b : c = e : f$, conclude $a : c = d : f$.', where: '5.22' },
  { term: 'mean proportional', modern: 'The geometric mean: $x$ with $a : x = x : b$, i.e. $x = \\sqrt{ab}$.', where: '6.13' },
  { term: 'extreme and mean ratio', modern: 'The golden section: $AB$ cut at $C$ so that $AB : AC = AC : CB$. The ratio is $\\varphi = (1+\\sqrt5)/2$.', where: '6.def.3' },
  { term: 'commensurable', modern: 'Two magnitudes with a common measure, i.e. a rational ratio. "Commensurable in square": their squares are commensurable.', where: '10.def1.1' },
  { term: 'rational (Book X)', modern: 'Commensurable, in length or in square, with a fixed unit line. So $\\sqrt2$ is "rational" in Euclid’s sense (its square is 2), while $\\sqrt[4]2$ is not.', where: '10.def1.3' },
  { term: 'medial', modern: 'The side of a square equal to a rectangle with rational sides commensurable in square only: a length like $\\sqrt[4]{2}$.', where: '10.21' },
  { term: 'binomial, apotome', modern: 'A sum or difference of two rational lines commensurable in square only: $\\sqrt a \\pm \\sqrt b$ (with $\\sqrt{a/b}$ irrational).', where: '10.36' },
  { term: 'solid angle', modern: 'The corner of a polyhedron: several plane angles meeting at a point, not all in one plane.', where: '11.def.11' },
  { term: 'Q.E.D., Q.E.F.', modern: 'Quod erat demonstrandum (what was to be proved), quod erat faciendum (what was to be done). The Latin renderings of Euclid’s closing formulas for theorems and constructions.', where: '1.1' },
  { term: 'porism', modern: 'A corollary: something that falls out of a proof.', where: '2.4' },
];

import { mdToHtml } from '../ui/markdown-core';
import { Cite } from '../ui/Cite';

export default function Glossary() {
  return (
    <div className="page glossary">
      <h1>Glossary</h1>
      <p className="lede">Heath follows Euclid’s vocabulary closely. Here it is in modern terms.</p>
      <dl>
        {TERMS.map((t) => (
          <div key={t.term} className="gl-entry">
            <dt>
              {t.term} {t.where && <Cite id={t.where} />}
            </dt>
            <dd dangerouslySetInnerHTML={{ __html: mdToHtml(t.modern) }} />
          </div>
        ))}
      </dl>
    </div>
  );
}
