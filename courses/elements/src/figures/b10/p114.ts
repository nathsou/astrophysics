import { figure } from '../../geometry/figure';
import { rat } from './apotome';
import { binomialPreset } from './kinds';
import { Lines } from './lib';
import { line, Surd } from './ring';

// AB = AF − FB an apotome, CD = CE + ED a binomial with CE : ED = AF : FB: AF = λ√X, FB = λ√Y,
// CE = μ√X, ED = μ√Y. G is the side of AB·CD. H = 2 is rational; KL = H²/CD is the apotome
// KM − ML of X.112.
export default figure({
  caption: 'AB = λ(√X − √Y) and CD = μ(√X + √Y) have terms in the same ratio (λ, μ rational). Their rectangle is λμ(X − Y), a rational area, so its side G is rational. H = 2 is the rational line of the proof.',
  build(g) {
    const k = Math.round(g.param('order', 1, { min: 1, max: 6, label: 'order' }));
    const lam = g.param('λ', 1, { min: 0.5, max: 2, step: 0.25, label: 'λ = AF : √X' });
    const mu = g.param('μ', 0.5, { min: 0.25, max: 1.5, step: 0.25, label: 'μ = CE : √X' });
    const { X, Y } = binomialPreset(k);
    const x = Math.sqrt(X.value);
    const y = Math.sqrt(Y.value);
    const d = X.sub(Y).value;
    const h = 2;
    const [af, fb, ce, ed] = [lam * x, lam * y, mu * x, mu * y];
    const ab = af - fb;
    const cdl = ce + ed;
    const G2 = rat(lam).mul(rat(mu)).mul(X.sub(Y));
    const gl = Math.sqrt(G2.value);
    const km = (h * h * x) / (mu * d);
    const ml = (h * h * y) / (mu * d);
    const kl = km - ml;
    const L = Lines.fit(g, Math.max(af, cdl, km, gl), 8);
    L.row(['A', 'B', 'F'], [ab, fb], 0, 5);
    L.row(['C', 'E', 'D'], [ce, ed], 0, 4);
    L.mag('G', gl, 0, 3);
    L.mag('H', h, 0, 2);
    L.row(['K', 'L', 'M'], [kl, ml], 0, 0.8);
    g.show('AB, CD', `${lam}(${Surd.root(X)} − ${Surd.root(Y)}), ${mu}(${Surd.root(X)} + ${Surd.root(Y)})`);
    g.show('AB · CD = G²', G2.toString());
    g.equal('CE : ED = AF : FB', ce / ed, af / fb);
    g.equal('CD · KL = H²', cdl * kl, h * h);
    g.equal('KM : ML = CE : ED (X.112)', km / ml, ce / ed);
    g.equal('AB : KL = AF : KM (V.19)', ab / kl, af / km);
    g.equal('G² = AB · CD', gl * gl, ab * cdl);
    g.claim('AB and CD are irrational', !line.rational(Surd.rat(X).add(Surd.rat(Y)).sub(Surd.root(X.mul(Y)).scale(2))) && !line.rational(Surd.rat(X).add(Surd.rat(Y)).add(Surd.root(X.mul(Y)).scale(2))));
    g.claim('G² = λμ(X − Y) is rational, so G is rational', line.rational(Surd.rat(G2)));
  },
});
