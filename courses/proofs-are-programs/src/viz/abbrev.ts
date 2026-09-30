// Lean-style Unicode input: type \lam then space to get λ.
export const ABBREVIATIONS: Record<string, string> = {
  l: 'λ', lam: 'λ', lambda: 'λ', fun: 'λ', 'λ': 'λ',
  P: 'Π', Pi: 'Π', S: 'Σ', Sigma: 'Σ',
  all: '∀', forall: '∀', A: '∀', ex: '∃', exists: '∃', E: '∃',
  to: '→', r: '→', '->': '→', imp: '→', l_: '←', '<-': '←', mapsto: '↦',
  and: '∧', '/\\': '∧', or: '∨', '\\/': '∨', not: '¬', neg: '¬', iff: '↔', '<->': '↔',
  ne: '≠', '=n': '≠', le: '≤', ge: '≥', x: '×', times: '×', comp: '∘', o: '∘',
  '<': '⟨', '>': '⟩', langle: '⟨', rangle: '⟩', box: '□', star: '⋆',
  top: '⊤', bot: '⊥', vdash: '⊢', '|-': '⊢', equiv: '≡', '==': '≡', sub: '⊆', in: '∈',
  a: 'α', alpha: 'α', b: 'β', beta: 'β', g: 'γ', gamma: 'γ', G: 'Γ', Gamma: 'Γ', d: 'δ', delta: 'δ', D: 'Δ', Delta: 'Δ',
  e: 'ε', epsilon: 'ε', z: 'ζ', zeta: 'ζ', eta: 'η', th: 'θ', theta: 'θ', i: 'ι', iota: 'ι', k: 'κ', kappa: 'κ',
  mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', s: 'σ', sigma: 'σ', t: 'τ', tau: 'τ', phi: 'φ', f: 'φ', chi: 'χ', psi: 'ψ', w: 'ω', omega: 'ω', O: 'Ω', Omega: 'Ω',
  N: 'ℕ', Nat: 'ℕ', Z: 'ℤ', Q: 'ℚ', R: 'ℝ',
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  _0: '₀', _1: '₁', _2: '₂', _3: '₃', _4: '₄', _5: '₅', _6: '₆', _7: '₇', _8: '₈', _9: '₉',
  '^1': '¹', '^2': '²', dag: '✝', circ: '∘', '.': '·', cdot: '·', inf: '∞', '|': '∣',
};
