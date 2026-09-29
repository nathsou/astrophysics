import { figure } from '../../geometry/figure';
import { rat } from './apotome';
import { binomialOrder, binomialPreset, ORDINAL } from './kinds';
import { Lines } from './lib';
import { line, Surd } from './ring';

// A rational, BD = BC − CD an apotome with annex DC. BD·KH = A² and BC·G = A², KE = G, and F is
// placed so that KH : HE = HF : FE. Then KH = KF + FH with KF : FH = BC : CD: the conjugate
// binomial. On the line: K, E, F, H in that order.
export default figure({
  caption: 'Choose the order of the apotome BD (whole BC, annex CD) and the rational line A. KH is the breadth of A² applied to BD; it is the binomial KF + FH, with KF : FH = BC : CD.',
  build(g) {
    const k = Math.round(g.param('order', 1, { min: 1, max: 6, label: 'order of BD' }));
    const a = g.param('A', 1.5, { min: 1, max: 2.5, step: 0.25, label: 'A' });
    const { X, Y } = binomialPreset(k);
    const a2 = rat(a).mul(rat(a));
    const bc = Math.sqrt(X.value);
    const cd = Math.sqrt(Y.value);
    const bd = bc - cd;
    const d = X.sub(Y);
    const kh = a2.value / bd;
    const gg = a2.value / bc;
    const kf = (a2.value * bc) / d.value;
    const fh = (a2.value * cd) / d.value;
    const L = Lines.fit(g, Math.max(bc, kh, a), 9);
    L.mag('A', a, 0, 4);
    L.row(['B', 'D', 'C'], [bd, cd], 0, 3);
    L.mag('G', gg, 0, 2);
    L.row(['K', 'E', 'F', 'H'], [gg, kf - gg, fh], 0, 0.6);
    const KF2 = Surd.rat(a2.mul(a2).mul(X).div(d.mul(d)));
    const FH2 = Surd.rat(a2.mul(a2).mul(Y).div(d.mul(d)));
    g.show('BD = BC − CD', `${Surd.root(X)} − ${Surd.root(Y)}`);
    g.show('KH = KF + FH', `${Surd.root(KF2.rational!)} + ${Surd.root(FH2.rational!)}`);
    g.equal('BD · KH = A²', bd * kh, a2.value);
    g.equal('BC · G = A², and KE = G', bc * gg, a2.value);
    g.equal('KH : HE = BC : CD (convertendo)', kh / (kh - gg), bc / cd);
    g.equal('KF : FH = BC : CD', kf / fh, bc / cd);
    g.equal('KF + FH = KH', kf + fh, kh);
    g.claim('KF, FH commensurable in length with BC, CD', line.comm(KF2, Surd.rat(X)) && line.comm(FH2, Surd.rat(Y)));
    g.claim(`BD is a ${ORDINAL[k]} apotome`, binomialOrder(Surd.rat(X), Surd.rat(Y)) === k);
    g.claim(`KH is a ${ORDINAL[k]} binomial`, binomialOrder(KF2, FH2) === k);
  },
});
