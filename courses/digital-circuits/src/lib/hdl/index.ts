/**
 * DCL, the course's hardware description language (docs/HDL.md): the public API of the front end.
 *
 * ```ts
 * const { diagnostics, program } = check(source, { file: 'counter.dcl' });
 * const design = elaborate(program, 'Counter');       // word-level RTL, hierarchy kept
 * const sim = createRtlSim(design);                    // compiled to JavaScript
 * sim.set('enable', 1); sim.step(3); sim.get('count'); // 3
 * runTests(source);                                     // the file's `test` blocks
 * ```
 */
export { parse, type ParseResult } from './parser';
export { format, formatResult, type FormatResult } from './format';
export {
  check, setStdLoader, TypedProgram, type CheckOptions, type CheckResult, type ModuleSpec, type PortInfo,
  type TestPlan,
} from './check';
export { elaborate, elaborateSpec, ElaborationError } from './elaborate';
export { flattenRtl, printRtl, cellInputs, cellOutputs, type RtlCell, type RtlCellKind, type RtlDesign, type RtlModule, type RtlPort, type RtlSignal, type SigId } from './rtl';
export { createRtlSim, evalCell, type RtlSim, type RtlSimOptions } from './rtlsim';
export {
  runTests, renderTestResult, renderWaveform, type RunTestsOptions, type TestFailure, type TestResult,
  type TestRunResult, type Waveform,
} from './testbench';
export { loadStd, findStd, type StdFile } from './std/index';
export { tokenize, type HighlightKind, type HighlightToken } from './highlight';
export { lex, KEYWORDS, TYPE_NAMES, type Token, type Comment } from './lexer';
export { renderDiagnostic, renderDiagnostics, hasErrors, type Diagnostic, type Severity } from './diagnostics';
export { SourceFile, type Span } from './span';
export { typeToString, formatValue, type Type, type TExpr } from './tir';
export type * as Ast from './ast';
