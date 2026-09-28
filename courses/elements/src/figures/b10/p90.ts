import { figure } from '../../geometry/figure';
import { choose, drawFind3, apotomeOrder, rootText } from './apotome';
import { line, Rat, Surd } from './ring';

// A = 1. Numbers E, BC, CD, no two of them in the ratio of square numbers, and CB : BD not either
// (BD = BC − CD). E : BC = A² : FG² and BC : CD = FG² : GH²; K² = FG² − GH².
const TRIPLES: [number, number, number][] = [
  [2, 6, 1],
  [2, 5, 1],
  [2, 7, 3],
  [2, 10, 3],
  [2, 11, 4],
  [3, 10, 2],
];

export default figure({
  caption: 'A is the rational line (length 1). No two of the numbers E, BC, CD are in the ratio of square numbers, and neither are CB and BD. Then E : BC = A² : FG² and BC : CD = FG² : GH².',
  build(g) {
    const [e, bc, cd] = TRIPLES[choose(g, 'k', 'numbers E, BC, CD', TRIPLES.length) - 1];
    const bd = bc - cd;
    const fg2 = new Rat(bc, e);
    const gh2 = new Rat(cd, e);
    const k2 = fg2.sub(gh2);
    const [fg, gh, k] = [fg2, gh2, k2].map((x) => Math.sqrt(x.value));
    drawFind3(g, fg, gh, k, e, bc, cd);
    const [FG2, GH2, K2, A2] = [fg2, gh2, k2, new Rat(1)].map((x) => Surd.rat(x));
    g.show('E, BC, CD, BD', `${e}, ${bc}, ${cd}, ${bd}`);
    g.show('FH = FG − GH', `${rootText(fg2)} − ${rootText(gh2)}`);
    g.equal('A² : FG² = E : BC', 1 / fg2.value, e / bc);
    g.equal('FG² : GH² = BC : CD', fg2.value / gh2.value, bc / cd);
    g.claim('FG, GH are rational and commensurable in square only', line.commSqOnly(FG2, GH2));
    g.claim('neither FG nor GH is commensurable in length with A', !line.comm(FG2, A2) && !line.comm(GH2, A2));
    g.equal('FG² : K² = CB : BD', fg2.value / k2.value, bc / bd);
    g.claim('CB : BD is not a ratio of squares, so FG is incommensurable with K', !line.comm(FG2, K2));
    g.claim('FH is a sixth apotome', apotomeOrder(FG2, GH2) === 6);
  },
});
