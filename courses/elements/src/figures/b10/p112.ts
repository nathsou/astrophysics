import { figure } from '../../geometry/figure';
import { rat } from './apotome';
import { binomialOrder, binomialPreset, ORDINAL } from './kinds';
import { Lines } from './lib';
import { line, Surd } from './ring';

// A rational, BC = BD + DC a binomial (DC the greater term). BC·EF = A² and BD·G = A², EH = G,
// and K is placed so that HF : FE = FK : KE. Then EF = FK − KE with FK : KE = CD : DB: the
// "conjugate" apotome. On the line: K, E, F, H in that order.
export default figure({
  caption: 'Choose the order of the binomial BC (the greater term DC) and the rational line A. EF is the breadth of A² applied to BC; it is the apotome FK − KE, with FK : KE = CD : DB.',
  build(g) {
    const k = Math.round(g.param('order', 1, { min: 1, max: 6, label: 'order of BC' }));
    const a = g.param('A', 2, { min: 1, max: 3, step: 0.25, label: 'A' });
    const { X, Y } = binomialPreset(k);
    const a2 = rat(a).mul(rat(a));
    const dc = Math.sqrt(X.value);
    const bd = Math.sqrt(Y.value);
    const d = X.sub(Y);
    const ef = a2.value / (dc + bd);
    const gg = a2.value / bd;
    const fk = (a2.value * dc) / d.value;
    const ke = (a2.value * bd) / d.value;
    const L = Lines.fit(g, Math.max(dc + bd, ke + gg, a), 9);
    L.mag('A', a, 0, 4);
    L.row(['B', 'D', 'C'], [bd, dc], 0, 3);
    L.mag('G', gg, 0, 2);
    L.row(['K', 'E', 'F', 'H'], [ke, ef, gg - ef], 0, 0.6);
    const FK2 = Surd.rat(a2.mul(a2).mul(X).div(d.mul(d)));
    const KE2 = Surd.rat(a2.mul(a2).mul(Y).div(d.mul(d)));
    g.show('BC = DC + BD', `${Surd.root(X)} + ${Surd.root(Y)}`);
    g.show('EF = FK − KE', `${Surd.root(FK2.rational!)} − ${Surd.root(KE2.rational!)}`);
    g.equal('BC · EF = A²', (dc + bd) * ef, a2.value);
    g.equal('BD · G = A², and EH = G', bd * gg, a2.value);
    g.equal('HF : FE = CD : DB', (gg - ef) / ef, dc / bd);
    g.equal('FK : KE = CD : DB', fk / ke, dc / bd);
    g.equal('FK − KE = EF', fk - ke, ef);
    g.claim('FK, KE commensurable in length with CD, DB (ratio A²/(CD² − DB²))', line.comm(FK2, Surd.rat(X)) && line.comm(KE2, Surd.rat(Y)));
    g.claim(`BC is a ${ORDINAL[k]} binomial`, binomialOrder(Surd.rat(X), Surd.rat(Y)) === k);
    g.claim(`EF is a ${ORDINAL[k]} apotome`, binomialOrder(FK2, KE2) === k);
  },
});
