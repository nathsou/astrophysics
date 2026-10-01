import { describe, expect, test } from 'vitest';
import { evaluateSelection } from '$lib/hep/analysis';
import { buildCutsProblem, buildFitProblem, checkCuts, checkFit, cutflowRows, cutsFromState, defaultCutState, evaluateCuts, optimumFor, parFor, runExerciseFit, type CutsSpecData, type FitSpecData } from './exercises';

const cutsSpec: CutsSpecData = {
  config: {
    seed: 7,
    signal: { events: 3000, yield: 60, vars: { m: { dist: 'normal', mean: 125, sigma: 2.5 }, iso: { dist: 'exponential', mean: 0.1 } } },
    background: { events: 30000, yield: 6000, vars: { m: { dist: 'exponential', mean: 35, offset: 100, max: 160 }, iso: { dist: 'exponential', mean: 0.4 } } },
  },
  variables: [
    { name: 'm', label: 'mass', unit: 'GeV', kind: 'window', lo: 100, hi: 160, step: 0.5 },
    { name: 'iso', label: 'isolation', kind: 'max', lo: 0, hi: 2, step: 0.02 },
  ],
  par: 'auto',
};

describe('cuts exercise logic', () => {
  const p = buildCutsProblem(cutsSpec);
  test('no cuts leaves everything; a cut at the slider limit is not a cut', () => {
    const st = defaultCutState(p.variables);
    expect(cutsFromState(p.variables, st)).toEqual([]);
    const all = evaluateCuts(p, st);
    expect(all.s).toBeCloseTo(60, 6);
    expect(all.b).toBeCloseTo(6000, 6);
    st.m = [120, 130];
    st.iso = [0, 0.3];
    expect(cutsFromState(p.variables, st).map((c) => `${c.column}${c.kind}`)).toEqual(['mmin', 'mmax', 'isomax']);
  });
  test('the cutflow is sequential and its last row is the full selection', () => {
    const st = defaultCutState(p.variables);
    st.m = [121, 129];
    st.iso = [0, 0.25];
    const rows = cutflowRows(p, st);
    expect(rows.map((r) => r.name)).toEqual(['no cuts', 'mass', 'isolation']);
    expect(rows[1]!.b).toBeLessThan(rows[0]!.b);
    expect(rows[2]!.b).toBeLessThan(rows[1]!.b);
    expect(rows[2]!.z).toBeCloseTo(evaluateCuts(p, st).z, 12);
  });
  test('the par is 90 % of an optimum that beats sensible hand cuts; too-tight cuts are rejected, good ones accepted', () => {
    const opt = optimumFor(p);
    const par = parFor(p);
    expect(par).toBeCloseTo(0.9 * opt.z, 10);
    console.log(`cuts exercise: no cuts ${evaluateSelection(p.sig, p.bkg, []).z.toFixed(2)}σ, optimum ${opt.z.toFixed(2)}σ, par ${par.toFixed(2)}σ`);
    expect(opt.z).toBeGreaterThan(2 * evaluateSelection(p.sig, p.bkg, []).z);
    const good = defaultCutState(p.variables);
    good.m = [opt.cuts.find((c) => c.column === 'm' && c.kind === 'min')!.value, opt.cuts.find((c) => c.column === 'm' && c.kind === 'max')!.value];
    good.iso = [0, opt.cuts.find((c) => c.column === 'iso')!.value];
    expect(checkCuts(p, good, par).ok).toBe(true);
    expect(checkCuts(p, defaultCutState(p.variables), par).ok).toBe(false);
    const tight = defaultCutState(p.variables);
    tight.m = [124.9, 125.1];
    tight.iso = [0, 0.001];
    const r = checkCuts(p, tight, par);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/too few|No signal|par/);
  });
});

const fitSpec: FitSpecData = {
  model: 'gauss+cheb2',
  data: { seed: 5, range: [100, 160], bins: 60, truth: { 'sig.yield': 400, 'sig.mean': 125, 'sig.sigma': 2, 'bkg.yield': 12000, 'bkg.c1': -0.45, 'bkg.c2': 0.12 }, xLabel: 'm [GeV]' },
  config: { backgrounds: ['flat', 'exp', 'cheb2'], parameter: 'sig.yield', minPValue: 0.01 },
  tolerance: 0.15,
  answer: 400,
};

describe('fit exercise logic', () => {
  const p = buildFitProblem(fitSpec);
  test('the data are reproducible from the seed and the choices come from the config', () => {
    const q = buildFitProblem(fitSpec);
    expect(Array.from(q.hist.counts)).toEqual(Array.from(p.hist.counts));
    expect(p.backgrounds).toEqual(['flat', 'exp', 'cheb2']);
    expect(p.signals).toEqual(['gauss']);
    expect(Math.abs(p.hist.integral() - 12400)).toBeLessThan(5 * Math.sqrt(12400));
  });
  test('the right background model passes and recovers the signal yield', () => {
    const { fit } = runExerciseFit(p, { signal: 'gauss', background: 'cheb2', range: [100, 160], method: 'nll' });
    console.log(`cheb2: sig.yield ${fit.params[0]!.toFixed(0)} ± ${fit.errors[0]!.toFixed(0)}, χ²/ndf ${fit.chi2.toFixed(1)}/${fit.ndf}, p = ${fit.pValue.toFixed(3)}`);
    expect(Math.abs(fit.params[0]! - 400)).toBeLessThan(4 * fit.errors[0]!);
    expect(checkFit(fitSpec, p, fit).ok).toBe(true);
  });
  test('a flat background does not describe the data: the fit is rejected (wrong answer or bad p-value)', () => {
    const flat = runExerciseFit(p, { signal: 'gauss', background: 'flat', range: [100, 160], method: 'nll' });
    console.log(`flat: sig.yield ${flat.fit.params[0]!.toFixed(0)}, χ²/ndf ${flat.fit.chi2.toFixed(1)}/${flat.fit.ndf}, p = ${flat.fit.pValue.toExponential(1)}`);
    expect(flat.fit.pValue).toBeLessThan(0.01);
    expect(checkFit(fitSpec, p, flat.fit).ok).toBe(false);
  });
  test('absolute tolerance, several parameters, and unknown parameters', () => {
    const { fit } = runExerciseFit(p, { signal: 'gauss', background: 'cheb2', range: [100, 160], method: 'nll' });
    expect(checkFit({ ...fitSpec, tolerance: { abs: 1 }, answer: { 'sig.mean': 125 } }, p, fit).ok).toBe(true);
    expect(checkFit({ ...fitSpec, tolerance: { abs: 0.001 }, answer: { 'sig.mean': 125 } }, p, fit).ok).toBe(false);
    expect(checkFit({ ...fitSpec, answer: { 'sig.nonsense': 1 } }, p, fit).message).toMatch(/no parameter/);
  });
  test('explicit counts are accepted', () => {
    const q = buildFitProblem({ model: 'gauss+exp', data: { range: [0, 4], counts: [1, 5, 9, 4] }, answer: 10 });
    expect(q.hist.integral()).toBe(19);
    expect(q.hist.nbins).toBe(4);
  });
});
