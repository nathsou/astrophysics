/**
 * Everything the editor and the widgets know about a DCL source, computed in one pass and returned as plain
 * data, so that it can be built in a Web Worker (`../worker.ts`) or, where workers are unavailable, in
 * the page. The hover, completion and cross-probing code (`queries.ts`, `../lower/probe.ts`) only read it.
 */
import type { Circuit } from '../../sim/netlist/types';
import type { Diagnostic } from '../diagnostics';
import type { ModuleDecl, Item, ModuleItem, TypeExpr } from '../ast';
import {
  check, elaborate, loadStd, parse, renderDiagnostic, renderTestResult, renderWaveform, runTests, tokenize, typeToString,
  type RtlDesign, type Type, type TypedProgram, type Waveform,
} from '../index';
import type { ModuleSpec } from '../check';
import { constructs, type Construct } from '../lower/cost';
import { lowerToCircuit, LayoutError, type LayoutOptions } from '../lower/circuit';
import { lowerToNetlist } from '../lower/index';
import type { Lowered, LoweredStats, LowerOptions } from '../lower/types';

export type Kind = 'input' | 'output' | 'wire' | 'reg' | 'mem' | 'inst' | 'const' | 'fn' | 'enum' | 'struct' | 'type' | 'module' | 'variant';

export interface Decl {
  name: string;
  kind: Kind;
  /** The signature as it would be written: `count: bits<4>`, `reg value: bits<4> = 0`. */
  signature: string;
  /** The resolved type, for values. */
  type?: string;
  doc?: string;
  /** The name as written at the declaration. */
  from: number;
  to: number;
  /** The module it belongs to (undefined for top-level items). */
  module?: string;
  /** For an enum, its variants; for an instance, its module. */
  members?: string[];
  /** Constructs (see `constructs`) whose cost belongs to this declaration: a register's flip-flops. */
  cost?: string;
}

export interface ModuleInfo {
  name: string;
  doc?: string;
  /** The module's name as written at its declaration. */
  from: number;
  to: number;
  /** The whole module, header and body. */
  start: number;
  end: number;
  generics: string[];
  inputs: { name: string; type: string; doc?: string; clock: boolean }[];
  outputs: { name: string; type: string; doc?: string }[];
  /** The module is in the standard library, not in this file. */
  std: boolean;
  top: boolean;
}

export interface ConstructInfo {
  from: number;
  to: number;
  kind: string;
  title: string;
  text: string;
  module: string;
  line: number;
  /** Elements built for this construct, by catalog type. */
  counts: Record<string, number>;
  total: number;
  /** Elements it reuses from an earlier construct. */
  reused: number;
}

export interface TestOutcome {
  name: string;
  passed: boolean;
  skipped: boolean;
  cycles: number;
  /** The result as text, in the format of the compiler's diagnostics (with waveforms). */
  text: string;
  failures: { message: string; from: number; to: number; line: number; cycle: number; values: { name: string; value: string }[]; waveform?: Waveform }[];
}

export interface AnalyzeRequest {
  source: string;
  file?: string;
  /** The module to elaborate (default: the one marked `top`, else the last one without generics). */
  top?: string;
  /** Return the elaborated design (for the RTL simulator). */
  design?: boolean;
  /** Return a drawn circuit of the top module (undefined: no). */
  circuit?: (LowerOptions & LayoutOptions) | true;
  /** Also run the file's tests. */
  tests?: boolean;
}

export interface Analysis {
  source: string;
  file: string;
  /** Diagnostics of this file (those of standard-library files are dropped). */
  diagnostics: Diagnostic[];
  /** Rendered like the compiler prints them (`renderDiagnostic`), aligned with `diagnostics`. */
  rendered: string[];
  ok: boolean;
  modules: ModuleInfo[];
  decls: Decl[];
  constructs: ConstructInfo[];
  /** Modules that can be simulated on their own (no generics). */
  tops: string[];
  top?: string;
  /** Why there is no `design` (a syntax error, a type error, an elaboration failure). */
  designError?: string;
  design?: RtlDesign;
  stats?: LoweredStats;
  lowered?: Lowered;
  circuit?: Circuit;
  layout?: { width: number; height: number; columns: number[] };
  circuitError?: string;
  testOutcomes?: TestOutcome[];
  timings: Record<string, number>;
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

const slice = (src: string, s: { start: number; end: number }) => src.slice(s.start, s.end);
const typeText = (src: string, t: TypeExpr) => slice(src, t.span);

function moduleInfo(src: string, m: ModuleDecl, std: boolean, top: boolean): ModuleInfo {
  const clockType = (t: TypeExpr) => t.kind === 'named' && t.name.name === 'clock';
  return {
    name: m.name.name,
    doc: m.doc,
    from: m.name.span.start,
    to: m.name.span.end,
    start: m.span.start,
    end: m.span.end,
    generics: m.generics.map((g) => `${g.name.name}: ${typeText(src, g.type)}`),
    inputs: m.inputs.map((p) => ({ name: p.name.name, type: typeText(src, p.type), doc: p.doc, clock: clockType(p.type) })),
    outputs: m.outputs.map((p) => ({ name: p.name.name, type: typeText(src, p.type), doc: p.doc })),
    std,
    top,
  };
}

function moduleSignature(info: ModuleInfo): string {
  const g = info.generics.length ? `<${info.generics.join(', ')}>` : '';
  const ins = info.inputs.map((p) => `${p.name}: ${p.type}`).join(', ');
  const outs = info.outputs.map((p) => `${p.name}: ${p.type}`).join(', ');
  return `module ${info.name}${g}(${ins})${info.outputs.length ? ` -> (${outs})` : ''}`;
}

/** Declarations (with resolved types where the checker has them) of every name in a file. */
function collectDecls(src: string, program: TypedProgram | undefined, items: Item[], modules: Map<string, ModuleInfo>): Decl[] {
  const out: Decl[] = [];
  const specOf = (name: string): ModuleSpec | undefined => {
    if (!program) return undefined;
    const direct = program.specs.get(name);
    if (direct) return direct;
    for (const s of program.specs.values()) if (s.name === name) return s;
    return undefined;
  };
  const tstr = (t: Type | undefined, fallback: string) => (t && t.k !== 'error' && t.k !== 'lit' && t.k !== 'int' ? typeToString(t) : fallback);

  const walk = (module: ModuleDecl, list: ModuleItem[], spec: ModuleSpec | undefined) => {
    const scope = module.name.name;
    for (const i of list) {
      switch (i.kind) {
        case 'let': {
          const t = tstr(spec?.lets.get(i.name.name)?.type, i.type ? typeText(src, i.type) : '?');
          out.push({ name: i.name.name, kind: 'wire', signature: `let ${i.name.name}: ${t}`, type: t, doc: i.doc, from: i.name.span.start, to: i.name.span.end, module: scope });
          break;
        }
        case 'const': {
          const t = i.type ? typeText(src, i.type) : '';
          out.push({ name: i.name.name, kind: 'const', signature: `const ${i.name.name}${t ? `: ${t}` : ''} = ${slice(src, i.value.span)}`, type: t || undefined, doc: i.doc, from: i.name.span.start, to: i.name.span.end, module: scope });
          break;
        }
        case 'reg': {
          const t = tstr(spec?.regs.get(i.name.name)?.type, typeText(src, i.type));
          out.push({ name: i.name.name, kind: 'reg', signature: `reg ${i.name.name}: ${t} = ${slice(src, i.init.span)}`, type: t, doc: i.doc, from: i.name.span.start, to: i.name.span.end, module: scope });
          break;
        }
        case 'mem': {
          const m = spec?.mems.get(i.name.name);
          const t = m ? `[${tstr(m.elem, '?')}; ${m.depth}]` : typeText(src, i.type);
          out.push({ name: i.name.name, kind: 'mem', signature: `mem ${i.name.name}: ${t}`, type: t, doc: i.doc, from: i.name.span.start, to: i.name.span.end, module: scope });
          break;
        }
        case 'inst': {
          const info = modules.get(i.module.name);
          const outs = info ? info.outputs.map((p) => p.name) : [];
          out.push({
            name: i.name.name, kind: 'inst', signature: `inst ${i.name.name}: ${i.module.name}${i.generics.length ? `<${i.generics.map((g) => slice(src, g.span)).join(', ')}>` : ''}`,
            type: i.module.name, doc: i.doc, from: i.name.span.start, to: i.name.span.end, module: scope, members: outs,
          });
          break;
        }
        case 'for':
          walk(module, i.body, spec);
          break;
        default:
          break;
      }
    }
  };

  for (const item of items) {
    switch (item.kind) {
      case 'module': {
        const info = modules.get(item.name.name)!;
        const spec = specOf(item.name.name);
        out.push({ name: info.name, kind: 'module', signature: moduleSignature(info), doc: item.doc, from: item.name.span.start, to: item.name.span.end, members: info.outputs.map((p) => p.name) });
        for (const p of item.inputs) {
          const t = tstr(spec?.inputs.find((x) => x.name === p.name.name)?.type, typeText(src, p.type));
          out.push({ name: p.name.name, kind: 'input', signature: `${p.name.name}: ${t}`, type: t, doc: p.doc, from: p.name.span.start, to: p.name.span.end, module: item.name.name });
        }
        for (const p of item.outputs) {
          const t = tstr(spec?.outputs.find((x) => x.name === p.name.name)?.type, typeText(src, p.type));
          out.push({ name: p.name.name, kind: 'output', signature: `${p.name.name}: ${t}`, type: t, doc: p.doc, from: p.name.span.start, to: p.name.span.end, module: item.name.name });
        }
        walk(item, item.body, spec);
        break;
      }
      case 'fn':
        out.push({
          name: item.name.name, kind: 'fn', doc: item.doc, from: item.name.span.start, to: item.name.span.end,
          signature: `fn ${item.name.name}(${item.params.map((p) => `${p.name.name}: ${typeText(src, p.type)}`).join(', ')}) -> ${typeText(src, item.ret)}`,
        });
        break;
      case 'struct':
        out.push({
          name: item.name.name, kind: 'struct', doc: item.doc, from: item.name.span.start, to: item.name.span.end,
          signature: `struct ${item.name.name} { ${item.fields.map((f) => `${f.name.name}: ${typeText(src, f.type)}`).join(', ')} }`,
          members: item.fields.map((f) => f.name.name),
        });
        break;
      case 'enum':
        out.push({
          name: item.name.name, kind: 'enum', doc: item.doc, from: item.name.span.start, to: item.name.span.end,
          signature: `${item.encoding === 'binary' ? '' : `@${item.encoding} `}enum ${item.name.name} { ${item.variants.map((v) => v.name).join(', ')} }`,
          members: item.variants.map((v) => v.name),
        });
        item.variants.forEach((v, k) =>
          out.push({ name: v.name, kind: 'variant', signature: `${item.name.name}.${v.name}`, type: item.name.name, doc: `Variant ${k} of \`${item.name.name}\`.`, from: v.span.start, to: v.span.end, module: undefined }),
        );
        break;
      case 'type':
        out.push({ name: item.name.name, kind: 'type', doc: item.doc, from: item.name.span.start, to: item.name.span.end, signature: `type ${item.name.name} = ${typeText(src, item.type)}` });
        break;
      case 'const':
        out.push({ name: item.name.name, kind: 'const', doc: item.doc, from: item.name.span.start, to: item.name.span.end, signature: `const ${item.name.name}${item.type ? `: ${typeText(src, item.type)}` : ''} = ${slice(src, item.value.span)}` });
        break;
      default:
        break;
    }
  }
  return out;
}

/**
 * A copy of the source that parses: the lines with syntax errors are blanked (so offsets stay the same) and
 * the braces are closed at the end. Used only to find the declarations of a source that is being typed.
 */
export function heal(source: string, file = 'input.dcl'): string {
  let text = source;
  for (let attempt = 0; attempt < 4; attempt++) {
    const errors = parse(text, file).diagnostics.filter((d) => d.severity === 'error');
    if (!errors.length) return text;
    const lines = text.split('\n');
    // Blank the lines of the first errors; an error at the end of the file means a missing brace.
    const bad = new Set(errors.slice(0, 3).map((d) => d.span.line - 1));
    for (const l of bad) if (l < lines.length && !/^\s*$/.test(lines[l]!)) lines[l] = lines[l]!.replace(/[^\r]/g, ' ');
    text = lines.join('\n');
    let depth = 0;
    for (const t of tokenize(text)) {
      const c = text.slice(t.from, t.to);
      if (t.kind === 'punctuation' && c === '{') depth++;
      else if (t.kind === 'punctuation' && c === '}') depth--;
    }
    if (depth > 0) text += `\n${'}\n'.repeat(depth)}`;
  }
  return text;
}

/** The elaborated design of the module `top`, or why there is none. */
function elaborateTop(program: TypedProgram, top: string): { design?: RtlDesign; error?: string } {
  try {
    return { design: elaborate(program, top) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** Analyses a source. Never throws: internal failures become `designError` or empty results. */
export function analyze(req: AnalyzeRequest): Analysis {
  const t0 = now();
  const file = req.file ?? 'input.dcl';
  const source = req.source;
  const timings: Record<string, number> = {};
  const result: Analysis = { source, file, diagnostics: [], rendered: [], ok: false, modules: [], decls: [], constructs: [], tops: [], timings };

  let program: TypedProgram | undefined;
  let diagnostics: Diagnostic[] = [];
  try {
    const r = check(source, { file });
    program = r.program;
    diagnostics = r.diagnostics;
  } catch (e) {
    // The parser recovers from syntax errors; anything else is a bug worth showing rather than swallowing.
    const parsed = parse(source, file);
    diagnostics = [...parsed.diagnostics, { severity: 'error', code: 'internal', message: `internal error: ${e instanceof Error ? e.message : String(e)}`, span: { file, start: 0, end: 0, line: 1, col: 1 } }];
  }
  timings.check = now() - t0;
  const mine = diagnostics.filter((d) => d.span.file === file || d.span.file === 'input.dcl');
  result.diagnostics = mine;
  const srcFile = program?.source;
  result.rendered = mine.map((d) => {
    try {
      return srcFile ? renderDiagnostic(srcFile, d) : `${d.severity}: ${d.message}`;
    } catch {
      return `${d.severity}: ${d.message}`;
    }
  });
  result.ok = !mine.some((d) => d.severity === 'error');

  // Modules: this file's, then the standard library's (for completions of `inst x: Fifo(`). While the
  // reader is typing the source does not parse and the parser drops the module being written, so the
  // declarations come from a healed copy (same offsets) when the real one has syntax errors.
  const parsed = parse(source, file);
  const items = parsed.diagnostics.some((d) => d.severity === 'error') ? parse(heal(source, file), file).program.items : parsed.program.items;
  const modules = new Map<string, ModuleInfo>();
  const declared = items.filter((i): i is ModuleDecl => i.kind === 'module');
  const topName = declared.find((m) => m.top)?.name.name;
  for (const m of declared) modules.set(m.name.name, moduleInfo(source, m, false, m.top));
  for (const f of loadStd()) {
    const p = parse(f.source, f.file);
    for (const i of p.program.items) if (i.kind === 'module' && !modules.has(i.name.name)) modules.set(i.name.name, moduleInfo(f.source, i, true, false));
  }
  result.modules = [...modules.values()];
  result.decls = collectDecls(source, program, items, modules);
  result.tops = declared.filter((m) => m.generics.length === 0).map((m) => m.name.name);
  result.top = req.top ?? topName ?? result.tops[result.tops.length - 1];

  if (!program || !result.ok) {
    result.designError = mine.find((d) => d.severity === 'error')?.message ?? 'the source has errors';
    if (req.tests && program) result.testOutcomes = [];
    timings.total = now() - t0;
    return result;
  }

  // Elaborate and lower every module without generics: the costs shown on hover, and the design to simulate.
  const t1 = now();
  const infos: ConstructInfo[] = [];
  let budget = 30000;
  const seen = new Set<string>();
  const order = result.top ? [result.top, ...result.tops.filter((t) => t !== result.top)] : result.tops;
  for (const name of order) {
    if (!result.tops.includes(name) && name !== result.top) continue;
    const { design, error } = elaborateTop(program, name);
    if (!design) {
      if (name === result.top) result.designError = error;
      continue;
    }
    if (name === result.top && req.design) result.design = design;
    if (budget <= 0 && name !== result.top) continue;
    try {
      let lowered: Lowered | undefined;
      if (name === result.top && req.circuit) {
        const opts = req.circuit === true ? {} : req.circuit;
        try {
          const lc = lowerToCircuit(design, name, opts);
          lowered = lc.lowered;
          result.lowered = lc.lowered;
          result.circuit = lc.circuit;
          result.layout = { width: lc.width, height: lc.height, columns: lc.columns };
        } catch (e) {
          result.circuitError = e instanceof Error ? e.message : String(e);
          if (!(e instanceof LayoutError)) throw e;
          // Too big to draw: keep the costs, not the netlist (which can be large).
          lowered = lowerToNetlist(design, name, opts);
        }
      } else lowered = lowerToNetlist(design, name);
      if (name === result.top) result.stats = lowered.stats;
      budget -= lowered.stats.elements;
      for (const c of constructs(lowered) as Construct[]) {
        const key = `${c.from}:${c.to}:${c.kind}`;
        if (seen.has(key)) continue;
        seen.add(key);
        infos.push({ from: c.from, to: c.to, kind: c.kind, title: c.title, text: c.text, module: name, line: c.line, counts: c.counts, total: c.total, reused: c.reused });
      }
    } catch (e) {
      if (name === result.top) result.designError = e instanceof Error ? e.message : String(e);
    }
  }
  result.constructs = infos;
  timings.lower = now() - t1;

  // A register's flip-flops belong to its declaration.
  for (const d of result.decls) {
    if (d.kind !== 'reg' && d.kind !== 'mem') continue;
    const c = infos.find((x) => (x.kind === 'reg' || x.kind === 'mem') && x.from < d.to && x.to > d.from);
    if (c) d.cost = c.text;
  }

  if (req.tests) {
    const t2 = now();
    result.testOutcomes = runTestsPlain(source, file);
    timings.tests = now() - t2;
  }
  timings.total = now() - t0;
  return result;
}

/** Runs the tests of a source and returns plain data (with each result rendered like the compiler prints it). */
export function runTestsPlain(source: string, file = 'input.dcl'): TestOutcome[] {
  const r = runTests(source, { file });
  return r.results.map((t) => ({
    name: t.name,
    passed: t.passed,
    skipped: t.skipped,
    cycles: t.cycles,
    text: renderTestResult(r.source, t),
    failures: t.failures.map((f) => ({
      message: f.message, from: f.span.start, to: f.span.end, line: f.span.line, cycle: f.cycle, values: f.values, waveform: f.waveform,
    })),
  }));
}

export { renderWaveform };
