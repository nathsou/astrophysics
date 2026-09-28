import { figure } from '../../geometry/figure';
import { add, area, dist, mid, mul, sub } from '../../geometry/vec';

// AB is bisected at C. DB = CBED is the parallelogram on the half CB, and AD = ACD(T) the parallelogram
// applied to AB deficient by it. F is any point on the diameter DB: the parallelogram AF = AKFG is
// applied to AB deficient by FB = KBHF, which is similar to DB (VI.24). AF equals the gnomon LMN
// (the part of DB outside the parallelogram above F), so it is less than DB, that is, than AD.
export default figure({
  build(g) {
    const A = g.free('A', -2.4, -1);
    const B = g.free('B', 2.4, -1);
    const C = g.point('C', mid(A, B));
    const D = g.free('D', 0.5, 0.7);
    const u = sub(D, C);
    const E = g.point('E', add(B, u));
    const F = g.glider('F', [D, B], 0.4);
    const s = dist(D, F) / dist(D, B);
    const K = g.point('K', add(C, mul(sub(B, C), s)));
    const low = mul(u, 1 - s);
    const Gp = g.point('G', add(A, low));
    const H = g.point('H', add(B, low));
    const cl = add(C, low); // on CD, level with F
    const km = add(K, u); // on DE, above K
    const T = add(A, u); // the corner above A
    g.segment(A, B);
    g.segment(T, E);
    g.segment(A, T);
    g.segment(C, D);
    g.segment(B, E);
    g.segment(K, km);
    g.segment(Gp, H);
    g.segment(D, B, { dashed: true });
    const pAD = [A, C, D, T];
    const pDB = [C, B, E, D];
    const pAF = [A, K, F, Gp];
    const gnomon = [C, B, E, km, F, cl];
    g.polygon(pAF, { fill: true });
    g.polygon(gnomon, { fill: true, name: 'LMN' });
    g.polygon(pAD, { aux: true });
    g.polygon(pDB, { aux: true });
    g.polygon([C, K, F, cl], { aux: true });
    g.polygon([F, H, E, km], { aux: true });
    g.polygon([K, B, H, F], { aux: true });
    g.polygon([C, B, H, cl], { aux: true });
    g.polygon([K, B, E, km], { aux: true });
    g.polygon([A, C, cl, Gp], { aux: true });
    g.equal('▱CF = ▱FE (complements)', area([C, K, F, cl]), area([F, H, E, km]));
    g.equal('▱AF = gnomon LMN', area(pAF), area(gnomon));
    g.claim('▱AD ≥ ▱AF', area(pAD) >= area(pAF) - 1e-9);
    g.show('AK·KB : AC·CB', ((dist(A, K) * dist(K, B)) / (dist(A, C) * dist(C, B))).toFixed(3));
  },
});
