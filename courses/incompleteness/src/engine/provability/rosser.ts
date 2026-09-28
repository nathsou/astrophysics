// Rosser's trick, in a toy model (section 5.4).
//
// Only two facts about T matter for the Rosser sentence R: the least code n of a T-derivation of R
// (if any) and the least code m of a T-derivation of ¬R (a refutation, if any). This module
// computes, from those two facts, what is true in ℕ and which part of the book's proof rules the
// situation out. It is an illustration of the case analysis, not a model of any particular T.

export interface RosserSituation {
  /** least code of a derivation of R, or null */
  proof: number | null;
  /** least code of a derivation of ¬R, or null */
  refutation: number | null;
}

export interface RosserAnalysis {
  consistent: boolean;
  /** 𝔑 ⊨ Prov(⌜R⌝) */
  prov: boolean;
  /** 𝔑 ⊨ RProv(⌜R⌝): a proof with no smaller refutation */
  rprov: boolean;
  /** whether R is true in ℕ, given that the fixed point R ↔ ¬RProv(⌜R⌝) is (Q is true in ℕ) */
  rTrue: boolean;
  /** which case of the proof applies, and its outcome */
  verdict: 'independent' | 'first-half' | 'second-half' | 'inconsistent';
}

export function analyseRosser(s: RosserSituation): RosserAnalysis {
  const prov = s.proof !== null;
  const rprov = s.proof !== null && (s.refutation === null || s.refutation > s.proof);
  const consistent = s.proof === null || s.refutation === null;
  const verdict = !consistent ? 'inconsistent' : s.proof !== null ? 'first-half' : s.refutation !== null ? 'second-half' : 'independent';
  return { consistent, prov, rprov, rTrue: !rprov, verdict };
}
