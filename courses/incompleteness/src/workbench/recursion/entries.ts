// The functions and relations the workbenches of the chapter offer, with the book's equations
// and their intended meanings (used only to compare with what the official definition computes).

import { R, type RF } from '../../engine/recursive/rf';
import * as Lib from '../../engine/computability/library';

export type Group = 'functions' | 'relations' | 'bounded' | 'primes';

export interface Entry {
  name: string;
  /** display name */
  tex: string;
  group: Group;
  arity: number;
  build: () => RF;
  spec: (args: bigint[]) => bigint;
  /** the book's equations or definition */
  eq: string;
  /** largest argument offered (the official definitions are slow) */
  max: bigint;
  /** default arguments */
  args: string;
}

const b = (c: boolean) => (c ? 1n : 0n);
const P = R.proj;

const fromLib = (name: string, group: Group, eq: string, max: bigint, args: string): Entry => {
  const e = Lib.LIBRARY.find((x) => x.name === name)!;
  return { name, tex: e.tex, group, arity: e.arity, build: e.build, spec: e.spec, eq, max, args };
};

/** R(x, z) ⟺ z + z = x */
export const halfRel = () => R.def('R', 'R', R.comp(Lib.chiEq(), [R.comp(Lib.add(), [P(2, 1), P(2, 1)]), P(2, 0)]));
/** R(x, z) ⟺ x ≤ z + z */
export const halfUpRel = () => R.def('R', 'R', R.comp(Lib.chiLeq(), [P(2, 0), R.comp(Lib.add(), [P(2, 1), P(2, 1)])]));
/** R(x, z) ⟺ x < z · z */
export const sqrtRel = () => R.def('R', 'R', R.comp(Lib.chiLt(), [P(2, 0), R.comp(Lib.mult(), [P(2, 1), P(2, 1)])]));
/** R(x, z) ⟺ z ≤ x */
export const belowRel = () => R.def('R', 'R', R.comp(Lib.chiLeq(), [P(2, 1), P(2, 0)]));
/** R(x, z) ⟺ z ∣ x ∧ 1 < z  (z is a proper divisor greater than 1) */
export const divRel = () =>
  R.def('R', 'R', Lib.charAnd(R.comp(Lib.divides(), [P(2, 1), P(2, 0)]), R.comp(Lib.chiLt(), [Lib.constN(1, 2), P(2, 1)])));

function leastBelow(y: bigint, p: (z: bigint) => boolean): bigint {
  for (let z = 0n; z < y; z++) if (p(z)) return z;
  return y;
}

export const ENTRIES: Entry[] = [
  fromLib('id', 'functions', '\\mathrm{id}(x) = P^1_0(x)', 50n, '7'),
  fromLib('const_3', 'functions', '\\mathrm{const}_3(x) = \\mathrm{succ}(\\mathrm{succ}(\\mathrm{succ}(\\mathrm{zero}(x))))', 50n, '7'),
  fromLib('add', 'functions', '\\mathrm{add}(x, 0) = x, \\quad \\mathrm{add}(x, y+1) = \\mathrm{succ}(\\mathrm{add}(x, y))', 40n, '2, 3'),
  fromLib('mult', 'functions', '\\mathrm{mult}(x, 0) = 0, \\quad \\mathrm{mult}(x, y+1) = \\mathrm{add}(\\mathrm{mult}(x, y), x)', 20n, '2, 3'),
  fromLib('exp', 'functions', '\\mathrm{exp}(x, 0) = \\mathrm{succ}(\\mathrm{zero}(x)), \\quad \\mathrm{exp}(x, y+1) = g(x, y, \\mathrm{exp}(x, y)) \\text{ with } g(x, y, z) = \\mathrm{mult}(P^3_0(x, y, z), P^3_2(x, y, z))', 6n, '2, 5'),
  fromLib('pred', 'functions', "\\mathrm{pred}'(x, 0) = \\mathrm{zero}(x), \\ \\mathrm{pred}'(x, y+1) = P^3_1(x, y, \\mathrm{pred}'(x, y)); \\ \\mathrm{pred}(y) = \\mathrm{pred}'(\\mathrm{zero}(y), P^1_0(y))", 40n, '5'),
  fromLib('fac', 'functions', 'h(x, 0) = \\mathrm{const}_1(x), \\ h(x, y+1) = g(x, y, h(x, y)) \\text{ with } g(x, y, z) = \\mathrm{mult}(P^3_2(x, y, z), \\mathrm{succ}(P^3_1(x, y, z))); \\ \\mathrm{fac}(y) = h(P^1_0(y), P^1_0(y))', 7n, '4'),
  fromLib('tsub', 'functions', 'x \\dot- 0 = x, \\quad x \\dot- (y + 1) = \\mathrm{pred}(x \\dot- y)', 30n, '7, 3'),
  fromLib('dist', 'functions', '|x - y| = (x \\dot- y) + (y \\dot- x)', 20n, '3, 8'),
  fromLib('max', 'functions', '\\max(x, y) = x + (y \\dot- x)', 20n, '3, 8'),
  fromLib('IsZero', 'relations', '\\chi_{\\mathrm{IsZero}}(0) = 1, \\quad \\chi_{\\mathrm{IsZero}}(x + 1) = 0 \\quad(\\text{officially with a dummy parameter, like pred})', 40n, '0'),
  fromLib('chi_eq', 'relations', 'x = y \\iff \\mathrm{IsZero}(|x - y|)', 12n, '3, 3'),
  fromLib('chi_leq', 'relations', 'x \\le y \\iff \\mathrm{IsZero}(x \\dot- y)', 12n, '3, 5'),
  fromLib('chi_lt', 'relations', 'x < y \\iff x + 1 \\le y', 12n, '3, 5'),
  fromLib('cond', 'relations', '\\mathrm{cond}(0, y, z) = y, \\quad \\mathrm{cond}(x + 1, y, z) = z', 20n, '0, 4, 9'),
  {
    name: 'cases',
    tex: 'f',
    group: 'relations',
    arity: 1,
    build: () => {
      const lt3 = R.comp(Lib.chiLt(), [P(1, 0), Lib.constN(3)]);
      return Lib.byCases(
        [
          { rel: Lib.isZero(), fn: Lib.constN(10) },
          { rel: lt3, fn: R.comp(Lib.add(), [P(1, 0), P(1, 0)]) },
        ],
        Lib.id(),
        { name: 'f', tex: 'f' },
      );
    },
    spec: ([x]) => (x === 0n ? 10n : x < 3n ? x + x : x),
    eq: 'f(x) = \\begin{cases} 10 & \\text{if } x = 0 \\\\ x + x & \\text{if } x < 3 \\text{ and not } x = 0 \\\\ x & \\text{otherwise} \\end{cases} = \\mathrm{cond}(\\chi_{\\lnot(x = 0)}, 10, \\mathrm{cond}(\\chi_{\\lnot(x < 3)}, x + x, x))',
    max: 12n,
    args: '2',
  },
  {
    name: 'exists-half',
    tex: '\\chi_{(\\exists z < y)\\,z + z = x}',
    group: 'bounded',
    arity: 2,
    build: () => Lib.bexists(halfRel(), { name: '∃z<y (z+z = x)', tex: '\\chi_{(\\exists z < y)\\,z + z = x}' }),
    spec: ([x, y]) => b(leastBelow(y, (z) => z + z === x) < y),
    eq: '\\chi_P(x, 0) = 0, \\quad \\chi_P(x, y + 1) = \\max(\\chi_P(x, y), \\chi_R(x, y)) \\quad\\text{where } R(x, z) \\iff z + z = x',
    max: 10n,
    args: '6, 4',
  },
  {
    name: 'forall-below',
    tex: '\\chi_{(\\forall z < y)\\,z \\le x}',
    group: 'bounded',
    arity: 2,
    build: () => Lib.bforall(belowRel(), { name: '∀z<y (z ≤ x)', tex: '\\chi_{(\\forall z < y)\\,z \\le x}' }),
    spec: ([x, y]) => b(y <= x + 1n),
    eq: '\\chi_P(x, 0) = 1, \\quad \\chi_P(x, y + 1) = \\min(\\chi_P(x, y), \\chi_R(x, y)) \\quad\\text{where } R(x, z) \\iff z \\le x',
    max: 10n,
    args: '3, 5',
  },
  {
    name: 'min-half',
    tex: '(\\min z < y)\\,x \\le z + z',
    group: 'bounded',
    arity: 2,
    build: () => Lib.bmin(halfUpRel(), { name: 'min z<y (x ≤ z+z)', tex: '(\\min z < y)\\,(x \\le z + z)' }),
    spec: ([x, y]) => leastBelow(y, (z) => x <= z + z),
    eq: 'm_R(x, 0) = 0, \\quad m_R(x, y+1) = \\begin{cases} m_R(x, y) & \\text{if } m_R(x, y) \\ne y \\\\ y & \\text{if } m_R(x, y) = y \\text{ and } R(x, y) \\\\ y + 1 & \\text{otherwise} \\end{cases}',
    max: 10n,
    args: '7, 6',
  },
  fromLib('divides', 'primes', 'x \\mid y \\iff (\\exists z \\le y)\\,(x \\cdot z) = y', 10n, '3, 6'),
  fromLib('Prime', 'primes', '\\mathrm{Prime}(x) \\iff x \\ge 2 \\land (\\forall y \\le x)\\,(y \\mid x \\rightarrow y = 1 \\lor y = x)', 13n, '7'),
  {
    name: 'nextPrime',
    tex: '\\mathrm{nextPrime}',
    group: 'primes',
    arity: 1,
    build: nextPrimeDef,
    spec: ([x]) => nextPrime(x),
    eq: '\\mathrm{nextPrime}(x) = (\\min y \\le x! + 1)\\,(y > x \\land \\mathrm{Prime}(y)) = (\\min y < x! + 2)\\,(x < y \\land \\mathrm{Prime}(y))',
    max: 3n,
    args: '3',
  },
];

export function isPrime(x: bigint): boolean {
  if (x < 2n) return false;
  for (let d = 2n; d * d <= x; d++) if (x % d === 0n) return false;
  return true;
}

export function nextPrime(x: bigint): bigint {
  let y = x + 1n;
  while (!isPrime(y)) y++;
  return y;
}

/** nextPrime(x) = m_R(x, x! + 2) with R(x, y) ⟺ x < y ∧ Prime(y), from the official definitions. */
export function nextPrimeDef(): RF {
  const r = Lib.charAnd(Lib.chiLt(), R.comp(Lib.prime(), [P(2, 1)]));
  const m = Lib.bmin(r, { name: 'm_R', tex: 'm_R' });
  const bound = R.comp(R.succ(), [R.comp(R.succ(), [Lib.fac()])]);
  return R.def('nextPrime', '\\mathrm{nextPrime}', R.comp(m, [P(1, 0), bound]));
}
