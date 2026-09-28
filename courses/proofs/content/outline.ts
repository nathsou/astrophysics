/**
 * The course outline: single source of truth for navigation. A chapter becomes readable when a
 * matching `chapters/<nn>-<slug>/index.md` exists; until then it is listed as planned.
 */

export interface OutlineEntry {
  slug: string;
  number: string;
  title: string;
  summary: string;
  /** The theorem the chapter is built around (shown on the home page's timeline). */
  theorem?: string;
  /** Year (negative for BC) of the theorem, for the timeline. */
  year?: number;
  milestone: string;
}

export interface OutlinePart {
  id: string;
  title: string;
  blurb: string;
  chapters: OutlineEntry[];
}

export const COURSE_TITLE = 'Proofcraft';
export const COURSE_SUBTITLE = 'Learning to prove, one great theorem at a time';

export const PARTS: OutlinePart[] = [
  {
    id: '0',
    title: 'Prologue',
    blurb: 'What a proof is, and how this course teaches you to find one.',
    chapters: [
      { slug: 'what-is-a-proof', number: '0', title: 'What is a proof?', summary: 'Pythagoras’ theorem four ways, the difference between being convinced and knowing, and how the course works.', theorem: 'Pythagoras’ theorem', year: -300, milestone: 'M1' },
    ],
  },
  {
    id: 'I',
    title: 'Logic, the grammar of proof',
    blurb: 'Statements, connectives and quantifiers: the rules every proof must follow — and two of the oldest proofs we have.',
    chapters: [
      { slug: 'truth-and-consequence', number: '1', title: 'Truth and consequence', summary: 'Connectives, truth tables, what “implies” really means, and why one connective is enough.', theorem: 'NAND is functionally complete', year: 1913, milestone: 'M1' },
      { slug: 'for-all-there-exists', number: '2', title: 'For all, there exists', summary: 'Quantifiers as a game between you and a sceptic; negation; why the order of quantifiers matters.', theorem: 'ℚ is dense in ℝ', year: 1872, milestone: 'M1' },
      { slug: 'root-two', number: '3', title: 'The irrationality of √2', summary: 'Proof by contradiction, the Pythagorean crisis, and a proof you can watch.', theorem: '√2 is irrational', year: -400, milestone: 'M1' },
      { slug: 'infinitely-many-primes', number: '4', title: 'Infinitely many primes', summary: 'Euclid’s proof, the myth that it is by contradiction, and five more proofs of the same fact.', theorem: 'There are infinitely many primes', year: -300, milestone: 'M1' },
    ],
  },
  {
    id: 'II',
    title: 'Induction',
    blurb: 'Proving infinitely many statements at once — and the well-ordering that makes it work.',
    chapters: [
      { slug: 'induction', number: '5', title: 'Climbing the ladder', summary: 'Mathematical induction, strengthening the hypothesis, tromino tilings, the Tower of Hanoi, and a horse of a different colour.', theorem: 'Deficient boards can be tiled by trominoes', year: 1954, milestone: 'M2' },
      { slug: 'unique-factorisation', number: '6', title: 'Unique factorisation', summary: 'Strong induction, Euclid’s algorithm, Bézout’s identity, and a world where factorisation is not unique.', theorem: 'The fundamental theorem of arithmetic', year: 1801, milestone: 'M2' },
      { slug: 'fermats-descent', number: '7', title: 'Fermat’s descent', summary: 'All Pythagorean triples, rational points on a circle, and the only proof Fermat left us.', theorem: 'No right triangle has square area', year: 1659, milestone: 'M2' },
    ],
  },
  {
    id: 'III',
    title: 'Arithmetic’s gems',
    blurb: 'Three theorems about primes that took the greatest mathematicians decades — with proofs that fit on a page.',
    chapters: [
      { slug: 'fermats-little-theorem', number: '8', title: 'Fermat’s little theorem', summary: 'Counting necklaces, Euler’s proof, liars and Carmichael numbers, and the arithmetic behind RSA.', theorem: 'aᵖ ≡ a (mod p)', year: 1640, milestone: 'M2' },
      { slug: 'two-squares', number: '9', title: 'Sums of two squares', summary: 'Which primes are sums of two squares? Fermat’s claim, Euler’s struggle and Zagier’s one-sentence proof.', theorem: 'Fermat’s two-squares theorem', year: 1990, milestone: 'M2' },
      { slug: 'quadratic-reciprocity', number: '10', title: 'Quadratic reciprocity', summary: 'Gauss’s “golden theorem”, proved by counting lattice points.', theorem: 'The law of quadratic reciprocity', year: 1796, milestone: 'M2' },
    ],
  },
  {
    id: 'IV',
    title: 'Infinity and self-reference',
    blurb: 'Diagonal arguments: from the sizes of infinity to the limits of proof itself.',
    chapters: [
      { slug: 'sizes-of-infinity', number: '11', title: 'Sizes of infinity', summary: 'Hilbert’s hotel, counting the rationals, Cantor’s diagonal argument and his theorem on power sets.', theorem: 'ℝ is uncountable', year: 1891, milestone: 'M3' },
      { slug: 'limits-of-proof', number: '12', title: 'The limits of proof', summary: 'Russell’s paradox, the halting problem and Gödel’s incompleteness theorem — one idea, three times.', theorem: 'Gödel’s incompleteness theorem', year: 1931, milestone: 'M3' },
    ],
  },
  {
    id: 'V',
    title: 'Calculus made rigorous',
    blurb: 'Two centuries of calculus without proofs, and the ε–δ revolution that finally gave it some.',
    chapters: [
      { slug: 'epsilon-delta', number: '13', title: 'The ε–δ revolution', summary: 'Berkeley’s ghosts, Cauchy and Weierstrass; limits as a game; why 0.999… = 1.', theorem: 'The limit of a sum is the sum of the limits', year: 1861, milestone: 'M3' },
      { slug: 'completeness', number: '14', title: 'Completeness', summary: 'What the real numbers have that the rationals lack, and Bolzano’s proof of the intermediate value theorem.', theorem: 'The intermediate value theorem', year: 1817, milestone: 'M3' },
      { slug: 'fundamental-theorem', number: '15', title: 'The fundamental theorem of calculus', summary: 'A chain of theorems from the extreme value theorem through Rolle and the mean value theorem to the FTC.', theorem: 'The fundamental theorem of calculus', year: 1823, milestone: 'M3' },
      { slug: 'infinite-series', number: '16', title: 'Infinite series', summary: 'Oresme’s harmonic series, Euler’s audacious solution of the Basel problem, and a proof that holds up.', theorem: '1 + 1/4 + 1/9 + ⋯ = π²/6', year: 1734, milestone: 'M3' },
      { slug: 'e-and-pi', number: '17', title: 'e and π are irrational', summary: 'Fourier’s proof for e, Niven’s one-page proof for π, and Liouville’s explicit transcendental numbers.', theorem: 'π is irrational', year: 1761, milestone: 'M3' },
      { slug: 'monsters', number: '18', title: 'Monsters', summary: 'A continuous function with no derivative anywhere, and other counterexamples that reshaped analysis.', theorem: 'A continuous, nowhere-differentiable function', year: 1872, milestone: 'M3' },
    ],
  },
  {
    id: 'VI',
    title: 'Combinatorial gems',
    blurb: 'Pigeonholes, invariants and Euler’s formula: proofs by clever counting.',
    chapters: [
      { slug: 'pigeonholes', number: '19', title: 'Pigeonholes', summary: 'Dirichlet’s principle, rational approximation, monotone subsequences and a party of six.', theorem: 'Dirichlet’s approximation theorem', year: 1842, milestone: 'M4' },
      { slug: 'invariants', number: '20', title: 'Invariants', summary: 'The bridges of Königsberg, the 15-puzzle, the MU puzzle and Conway’s soldiers.', theorem: 'The bridges of Königsberg', year: 1736, milestone: 'M4' },
      { slug: 'five-colours', number: '21', title: 'Euler’s formula and five colours', summary: 'V − E + F = 2, Lakatos’s monsters, Kempe’s flawed proof and Heawood’s rescue.', theorem: 'The five-colour theorem', year: 1890, milestone: 'M4' },
    ],
  },
  {
    id: 'E',
    title: 'Epilogue',
    blurb: 'What you have learned, and where proofs are going.',
    chapters: [
      { slug: 'how-to-find-proofs', number: '22', title: 'How to find proofs', summary: 'Pólya’s heuristics, an atlas of the techniques in this course, and machines that prove.', milestone: 'M4' },
    ],
  },
];

export const APPENDICES: OutlineEntry[] = [
  { slug: 'notation', number: 'A', title: 'Logic and set notation', summary: 'The symbols used in the course, with how to read them aloud.', milestone: 'M1' },
  { slug: 'step-checker', number: 'B', title: 'The step checker', summary: 'What the in-browser checker can prove, what it can only test, and how to type maths.', milestone: 'M1' },
  { slug: 'reference', number: 'C', title: 'Glossary, timeline and bibliography', summary: 'Every term, date and source in the course.', milestone: 'M1' },
];
