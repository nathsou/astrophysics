/**
 * `hep/diagrams`: Feynman diagrams as data. A graph model with typed lines, the Standard Model vertex rules, validation with
 * reasons, coupling orders, crossing, tree-level (and small one-loop) enumeration, and isomorphism for comparing a drawn
 * diagram with an answer key. Pure TypeScript: no DOM, no randomness. See README.md in this directory.
 */
export type { Force, LineKind, DiagramNode, DiagramEdge, Diagram, Process, EnumerateOptions, LoopOptions, DiagramOrder, Issue, IssueCode } from './types.ts';
export {
  isFermion, isQuarkId, isLeptonId, isNeutrinoId, generation, isSelfConjugate, lineKind,
  particleLabel, symbolOf, asciiName, parseParticle, parseProcess, tryParseProcess, formatProcess, processSymbols,
  type ParticleLabel,
} from './process.ts';
export {
  VERTEX_RULES, vertexRule, matchVertex, checkVertex, couplingStrength,
  type VertexRule, type MatchContext, type VertexCheck, type VertexReason, type FermionPattern,
} from './rules.ts';
export {
  emptyDiagram, buildDiagram, addVertex, addEdge, removeEdge, removeVertex, setEdgeParticle, reverseEdge, normalizeEdge,
  legNode, nodeById, isLeg, incidentEdges, endLabel, vertexLabels, components, loopCount,
  validateDiagram, type ValidationResult, type VertexReport, type ValidateOptions,
  diagramOrder, vertexRules, estimateRate, rankDiagrams, orderLabel, amplitudeOrderLabel,
  crossing, crossProcess, diagramToJSON, diagramFromJSON, channels, describeDiagram, type Channel,
} from './model.ts';
export { canonicalForm, sameDiagram, findDiagram, dedupe, automorphismCount, symmetryFactor, identicalParticleFactor, type CanonicalOptions } from './canonical.ts';
export {
  enumerateTreeDiagrams, countTreeDiagrams, enumerateOneLoopDiagrams, countOneLoopDiagrams,
  LOOP_INDUCED, loopInducedEntry, loopInducedDiagrams, type LoopInducedEntry,
} from './enumerate.ts';
export { matchAnswerKey, type KeyMatch } from './key.ts';
