import { describe, expect, test } from 'vitest';
import {
  addEdge, addVertex, asciiName, buildDiagram, checkVertex, emptyDiagram, formatProcess, matchVertex, parseParticle, parseProcess, particleLabel, processSymbols,
  symbolOf, tryParseProcess, validateDiagram, VERTEX_RULES, vertexRule, removeVertex, reverseEdge, setEdgeParticle, diagramToJSON, diagramFromJSON,
} from './index.ts';

// Labels are "all incoming": an outgoing particle enters as its antiparticle.
const e = 11, mu = 13, nue = 12, numu = 14, gamma = 22, g = 21, Z = 23, Wp = 24, H = 25;

describe('process text', () => {
  test('parse and format', () => {
    expect(parseProcess('e+ e- > mu+ mu-')).toEqual({ initial: [-11, 11], final: [-13, 13] });
    expect(parseProcess('e+ e- → μ⁺ μ⁻')).toEqual({ initial: [-11, 11], final: [-13, 13] });
    expect(parseProcess('u d~ > e+ nu_e')).toEqual({ initial: [2, -1], final: [-11, 12] });
    expect(parseProcess('u ubar > g g')).toEqual({ initial: [2, -2], final: [21, 21] });
    expect(parseProcess('gamma, Z > W+ W-')).toEqual({ initial: [22, 23], final: [24, -24] });
    expect(parseProcess('mu- > e- nu_e~ nu_mu').final).toEqual([11, -12, 14]);
    expect(parseProcess('g g > H')).toEqual({ initial: [21, 21], final: [25] });
    expect(parseProcess('e+ e- > ν̄_e ν_e').final).toEqual([-12, 12]);
    expect(formatProcess(parseProcess('e+ e- > mu+ mu- gamma'))).toBe('e+ e- > mu+ mu- gamma');
    expect(formatProcess(parseProcess('u d~ > e+ nu_e'))).toBe('u anti-d~ > e+ nu_e'.replace('anti-d~', 'd~'));
    expect(processSymbols(parseProcess('e+ e- > mu+ mu-'))).toBe('e⁺ e⁻ → μ⁺ μ⁻');
  });
  test('errors are readable', () => {
    expect(tryParseProcess('e+ e- mu+ mu-')).toMatchObject({ ok: false });
    expect(tryParseProcess('e+ e- > foo')).toMatchObject({ ok: false, error: 'unknown particle "foo"' });
    expect(tryParseProcess('gamma~ gamma > e+ e-').ok).toBe(false);
    expect(tryParseProcess('> e+ e-').ok).toBe(false);
  });
  test('labels', () => {
    expect(particleLabel(-11)).toMatchObject({ base: 'e', sup: '+' });
    expect(particleLabel(-12)).toMatchObject({ base: 'ν', sub: 'e', bar: true });
    expect(particleLabel(-3)).toMatchObject({ base: 's', bar: true });
    expect(symbolOf(24)).toBe('W⁺');
    expect(symbolOf(-13)).toBe('μ⁺');
    expect(asciiName(-12)).toBe('nu_e~');
    expect(parseParticle(asciiName(-12))).toBe(-12);
    for (const p of [1, -1, 2, -2, 6, -6, 11, -11, 13, -13, 15, -15, 12, -12, 14, -14, 16, -16, 21, 22, 23, 24, -24, 25]) expect(parseParticle(asciiName(p))).toBe(p);
  });
});

describe('vertex table', () => {
  test('every rule has a coupling, an order, flavour and charge flags', () => {
    const ids = VERTEX_RULES.map((r) => r.id);
    for (const id of ['ffγ', 'qqg', 'ggg', 'gggg', 'ffZ', 'ffW', 'ffH', 'WWH', 'ZZH', 'HHH', 'HHHH', 'WWγ', 'WWZ', 'γγWW']) expect(ids).toContain(id);
    for (const r of VERTEX_RULES) {
      expect(r.coupling.length).toBeGreaterThan(0);
      expect(r.order.ew + r.order.s).toBe(r.legs - 2);
      expect(r.conservesCharge).toBe(true);
    }
    expect(vertexRule('ffW').conservesFlavour).toBe(false);
    expect(vertexRule('ffW').mixing).toBe('ckm');
    expect(vertexRule('ffγ').conservesFlavour).toBe(true);
    expect(vertexRule('ffH').massProportional).toBe(true);
    expect(vertexRule('qqg').alphaPower).toEqual({ alpha: 0, alphaS: 0.5 });
    expect(vertexRule('gggg').alphaPower).toEqual({ alpha: 0, alphaS: 1 });
    expect(vertexRule('ffγ').alphaPower).toEqual({ alpha: 0.5, alphaS: 0 });
  });
});

describe('matching and explanations', () => {
  test('allowed vertices', () => {
    expect(matchVertex([e, -e, gamma])!.id).toBe('ffγ');
    expect(matchVertex([2, -2, g])!.id).toBe('qqg');
    expect(matchVertex([nue, -nue, Z])!.id).toBe('ffZ');
    expect(matchVertex([nue, -e, -Wp])!.id).toBe('ffW'); // ν_e → e⁻ W⁺
    expect(matchVertex([e, -nue, Wp])!.id).toBe('ffW'); // e⁻ → ν_e W⁻
    expect(matchVertex([6, -6, H])!.id).toBe('ffH');
    expect(matchVertex([g, g, g])!.id).toBe('ggg');
    expect(matchVertex([Wp, -Wp, gamma])!.id).toBe('WWγ');
    expect(matchVertex([Z, Z, H])!.id).toBe('ZZH');
    expect(matchVertex([H, H, H, H])!.id).toBe('HHHH');
    expect(matchVertex([gamma, gamma, Wp, -Wp])!.id).toBe('γγWW');
    expect(matchVertex([2, -1, -Wp])!.id).toBe('ffW'); // u → d W⁺: u (2) in, d out (-1), W⁺ out: W label -24
  });
  test('forbidden: charge and arrows', () => {
    const c = checkVertex([e, e, gamma]);
    expect(c.ok).toBe(false);
    expect(c.reasons.map((r) => r.code)).toEqual(['charge', 'arrows']);
    expect(c.reasons[0]!.message).toMatch(/charge is not conserved/i);
    expect(checkVertex([e, -mu, gamma]).reasons.some((r) => r.code === 'lepton-flavour' || r.code === 'flavour-change')).toBe(true);
  });
  test('forbidden: photon and neutrino', () => {
    const c = checkVertex([nue, -nue, gamma]);
    expect(c.ok).toBe(false);
    expect(c.reasons[0]!.code).toBe('photon-neutral');
    expect(c.reasons[0]!.message).toBe('A photon cannot couple to a neutrino: neutrinos have no electric charge.');
  });
  test('forbidden: gluon and electron, Higgs and neutrino, flavour change, lepton generation, quark-lepton', () => {
    expect(checkVertex([e, -e, g]).reasons[0]!.code).toBe('gluon-lepton');
    expect(checkVertex([nue, -nue, H]).reasons[0]!.code).toBe('higgs-mass');
    expect(checkVertex([2, -4, Z]).reasons[0]!.code).toBe('flavour-change'); // no flavour-changing neutral currents
    expect(checkVertex([2, -3, g]).reasons[0]!.code).toBe('charge');
    const gen = checkVertex([nue, -mu, -Wp]); // ν_e → μ⁻ W⁺: charge fine, generation wrong
    expect(gen.ok).toBe(false);
    expect(gen.reasons[0]!.code).toBe('lepton-flavour');
    const ql = checkVertex([2, -e, Wp]); // u → e W: nonsense
    expect(ql.ok).toBe(false);
    const ql2 = checkVertex([1, -nue, -Wp]);
    expect(ql2.reasons.some((r) => r.code === 'baryon')).toBe(true);
    expect(checkVertex([gamma, gamma, gamma]).reasons[0]!.code).toBe('neutral-bosons');
    expect(checkVertex([gamma, Z, Z]).reasons[0]!.code).toBe('neutral-bosons');
    expect(checkVertex([g, g, gamma]).reasons[0]!.code).toBe('colour');
    expect(checkVertex([gamma, gamma, H]).ok).toBe(false);
    expect(checkVertex([e, -e]).reasons[0]!.code).toBe('degree');
  });
  test('generation mixing and Yukawa notes', () => {
    const c = checkVertex([4, -1, -Wp]); // c → d W⁺, Cabibbo suppressed
    expect(c.ok).toBe(true);
    expect(c.notes[0]!.code).toBe('generation');
    expect(matchVertex([4, -1, -Wp], { ckm: 'diagonal' })).toBeNull();
    expect(matchVertex([4, -1, -Wp], { ckm: 'auto', external: [false, true, true] })).toBeNull();
    expect(matchVertex([4, -1, -Wp], { ckm: 'auto', external: [true, true, true] })).not.toBeNull();
    const y = checkVertex([e, -e, H]);
    expect(y.ok).toBe(true);
    expect(y.notes[0]!.code).toBe('yukawa-small');
    expect(matchVertex([e, -e, H], { minYukawaMass: 0.01 })).toBeNull();
    expect(matchVertex([mu, -numu], { forces: [] })).toBeNull();
  });
  test('forces switch vertices off', () => {
    expect(matchVertex([e, -e, gamma], { forces: ['weak'] })).toBeNull();
    expect(matchVertex([e, -e, gamma], { forces: ['qed'] })).not.toBeNull();
    expect(matchVertex([e, -e, Z], { forces: ['qed'] })).toBeNull();
    expect(matchVertex([Wp, -Wp, gamma], { forces: ['weak'] })).toBeNull();
    expect(matchVertex([gamma, Z, Wp, -Wp], { forces: ['qed'] })).toBeNull();
    expect(matchVertex([gamma, Z, Wp, -Wp], { forces: ['qed', 'weak'] })).not.toBeNull();
    expect(matchVertex([mu, -numu, -e, nue], { forces: ['fermi'] })!.id).toBe('fermi');
    expect(matchVertex([mu, -numu, -e, nue])).toBeNull();
  });
});

describe('validating a drawn diagram', () => {
  const p = parseProcess('e+ e- > mu+ mu-');
  test('an empty diagram is incomplete but not wrong', () => {
    const v = validateDiagram(emptyDiagram(p.initial, p.final));
    expect(v.ok).toBe(true);
    expect(v.complete).toBe(false);
    expect(v.issues.filter((i) => i.code === 'leg-open')).toHaveLength(4);
  });
  test('the textbook diagram is valid, with order α²', () => {
    const d = buildDiagram(p, [['v0', 'in0', 11], ['in1', 'v0', 11], ['v0', 'v1', 22], ['out0', 'v1', 13], ['v1', 'out1', 13]]);
    // in0 is e⁺ (written -11): the line leaves the vertex towards the leg.
    const v = validateDiagram(d);
    expect(v.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(v.valid).toBe(true);
    expect(v.order).toMatchObject({ ew: 2, s: 0, alpha: 2, loops: 0 });
    expect(v.vertices.map((x) => x.rule!.id)).toEqual(['ffγ', 'ffγ']);
  });
  test('wrong particle on a leg, wrong arrow, forbidden vertex', () => {
    let d = buildDiagram(p, [['in0', 'v0', 11], ['in1', 'v0', 11], ['v0', 'v1', 23], ['out0', 'v1', 13], ['v1', 'out1', 13]]);
    // e⁺ drawn as an e⁻ arriving from the left: the leg's line is wrong and the vertex has two arrows in.
    let v = validateDiagram(d);
    expect(v.valid).toBe(false);
    expect(v.issues.some((i) => i.code === 'charge' && /arrows/.test((i.more ?? []).join(' ')))).toBe(true);
    expect(v.issues.find((i) => i.code === 'leg-particle')!.message).toMatch(/wrong way/);
    d = buildDiagram(p, [['in0', 'v0', 12], ['in1', 'v0', 11], ['v0', 'v1', 23], ['out0', 'v1', 13], ['v1', 'out1', 13]]);
    expect(validateDiagram(d).issues.find((i) => i.code === 'leg-particle')!.message).toMatch(/carries ν_e/);
    // A vertex with a photon and a neutrino.
    d = buildDiagram(p, [['v0', 'in0', 11], ['in1', 'v0', 11], ['v0', 'v1', 22], ['out0', 'v1', 13], ['v1', 'out1', 13]]);
    const e1 = d.edges.find((x) => x.pdg === 13 && x.from === d.nodes.find((n) => n.kind === 'vertex' && n.id !== d.nodes.find((q) => q.kind === 'vertex')!.id)!.id);
    void e1;
    const dn = setEdgeParticle(d, d.edges[0]!.id, 12);
    v = validateDiagram(dn);
    expect(v.ok).toBe(false);
    expect(v.issues.find((i) => i.severity === 'error' && i.node !== undefined)!.message).toBeTruthy();
  });
  test('particle passing straight through, open vertex, disconnected pieces', () => {
    let d = emptyDiagram(p.initial, p.final);
    d = addEdge(d, 0, 1, -11).diagram;
    expect(validateDiagram(d).issues.some((i) => i.code === 'leg-through')).toBe(true);
    d = emptyDiagram(p.initial, p.final);
    const a = addVertex(d);
    d = addEdge(a.diagram, 0, a.id, -11).diagram;
    const v = validateDiagram(d);
    expect(v.issues.some((i) => i.code === 'degree' && i.severity === 'todo')).toBe(true);
    expect(v.ok).toBe(true);
    expect(v.complete).toBe(false);
  });
  test('editing helpers are pure', () => {
    const d0 = emptyDiagram(p.initial, p.final);
    const a = addVertex(d0);
    expect(d0.nodes).toHaveLength(4);
    expect(a.diagram.nodes).toHaveLength(5);
    const b = addEdge(a.diagram, a.id, 0, 11);
    expect(reverseEdge(b.diagram, b.id).edges[0]).toMatchObject({ from: 0, to: a.id });
    expect(removeVertex(b.diagram, a.id).edges).toHaveLength(0);
    const round = diagramFromJSON(diagramToJSON(b.diagram));
    expect(round).toEqual({ ...b.diagram, label: undefined });
  });
});
