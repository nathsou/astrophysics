/**
 * Questions the editor asks of an `Analysis`: what is under the cursor (hover), what can be typed here
 * (completions), where is it declared. Pure functions of the analysis and the text, so they are tested
 * without a browser.
 */
import { tokenize, KEYWORDS, TYPE_NAMES } from '../index';
import type { Analysis, Decl, ModuleInfo } from './analysis';

export interface Hover {
  from: number;
  to: number;
  /** The name as it would be declared: `reg value: bits<4> = 0`. */
  signature?: string;
  /** What kind of thing it is, in words: "register", "input port". */
  what?: string;
  doc?: string;
  /** What it costs in hardware: "4 flip-flops". */
  cost?: string;
  /** For an expression: the construct around the cursor, "4-bit adder: 3 XOR gates, …". */
  construct?: string;
}

const WHAT: Record<Decl['kind'], string> = {
  input: 'input port',
  output: 'output port',
  wire: 'wire (assigned once)',
  reg: 'register',
  mem: 'memory',
  inst: 'instance',
  const: 'constant',
  fn: 'function (inlined where used)',
  enum: 'enum',
  struct: 'struct',
  type: 'type alias',
  module: 'module',
  variant: 'enum variant',
};

/** The module whose text contains an offset. */
export function moduleAt(a: Analysis, offset: number, unfinished = false): ModuleInfo | undefined {
  const own = a.modules.filter((m) => !m.std);
  const hit = own.find((m) => offset >= m.start && offset <= m.end);
  // While typing, the module being written may not be closed yet: it is the last one before the cursor.
  if (!hit && unfinished) return own.filter((m) => m.start <= offset).sort((x, y) => y.start - x.start)[0];
  return hit;
}

function lookup(a: Analysis, name: string, scope: string | undefined): Decl | undefined {
  return a.decls.find((d) => d.name === name && d.module === scope && scope !== undefined) ?? a.decls.find((d) => d.name === name && d.module === undefined);
}

const numberInfo = (text: string): string | undefined => {
  const clean = text.replace(/_/g, '');
  try {
    const v = BigInt(clean);
    return `${v} = 0x${v.toString(16)} = 0b${v.toString(2)}`;
  } catch {
    return undefined;
  }
};

/** What the cursor is over. */
export function hoverAt(a: Analysis, offset: number): Hover | undefined {
  const tokens = tokenize(a.source);
  const i = tokens.findIndex((t) => offset >= t.from && offset <= t.to && (offset < t.to || tokens[tokens.indexOf(t) + 1]?.from !== t.to));
  const t = tokens[i];
  const text = t ? a.source.slice(t.from, t.to) : '';
  const scope = moduleAt(a, offset);
  const construct = () => {
    let best: Analysis['constructs'][number] | undefined;
    for (const c of a.constructs) {
      if (c.kind === 'const' || offset < c.from || offset > c.to) continue;
      if (!best || c.to - c.from < best.to - best.from) best = c;
    }
    return best;
  };
  if (!t) {
    const c = construct();
    return c ? { from: c.from, to: c.to, construct: c.text } : undefined;
  }
  if (t.kind === 'comment' || t.kind === 'doc') return undefined;
  if (t.kind === 'number') {
    const c = construct();
    const info = numberInfo(text);
    return info ? { from: t.from, to: t.to, signature: info, what: 'literal (its type comes from context)', construct: c?.kind === 'const' ? undefined : undefined } : undefined;
  }
  if (t.kind === 'identifier' || t.kind === 'type' || t.kind === 'function' || t.kind === 'module') {
    const prev = tokens[i - 1];
    const prev2 = tokens[i - 2];
    // `inst.port` and `Enum.Variant`.
    if (prev && a.source.slice(prev.from, prev.to) === '.' && prev2) {
      const owner = a.source.slice(prev2.from, prev2.to);
      const od = lookup(a, owner, scope?.name);
      if (od?.kind === 'inst') {
        const m = a.modules.find((x) => x.name === od.type);
        const p = m?.outputs.find((x) => x.name === text);
        if (p) return { from: t.from, to: t.to, signature: `${owner}.${p.name}: ${p.type}`, what: `output port of \`${m!.name}\``, doc: p.doc };
      }
      if (od?.kind === 'enum') {
        const v = a.decls.find((x) => x.kind === 'variant' && x.name === text && x.type === owner);
        if (v) return { from: t.from, to: t.to, signature: v.signature, what: WHAT.variant, doc: v.doc };
      }
      if (od?.kind === 'mem' && (text === 'read' || text === 'write')) {
        return { from: t.from, to: t.to, signature: text === 'read' ? `${owner}.read(address) -> ${od.type?.replace(/^\[|;.*$/g, '') ?? 'data'}` : `${owner}.write(address, data, enable)`, what: text === 'read' ? 'synchronous read port: the data arrives one cycle later' : 'synchronous write port' };
      }
    }
    const d = lookup(a, text, scope?.name) ?? (t.kind === 'module' ? a.decls.find((x) => x.kind === 'module' && x.name === text) : undefined);
    if (d) return { from: t.from, to: t.to, signature: d.signature, what: WHAT[d.kind], doc: d.doc ?? undefined, cost: d.cost };
    const m = a.modules.find((x) => x.name === text);
    if (m) return { from: t.from, to: t.to, signature: `module ${m.name}(${m.inputs.map((p) => `${p.name}: ${p.type}`).join(', ')})${m.outputs.length ? ` -> (${m.outputs.map((p) => `${p.name}: ${p.type}`).join(', ')})` : ''}`, what: m.std ? 'standard-library module' : 'module', doc: m.doc };
    if (TYPE_NAMES.has(text)) return { from: t.from, to: t.to, signature: text, what: 'type', doc: TYPE_DOC[text] };
    if (BUILTIN_DOC[text]) return { from: t.from, to: t.to, signature: BUILTIN_DOC[text]![0], what: 'built-in (costs no hardware unless noted)', doc: BUILTIN_DOC[text]![1] };
  }
  if (t.kind === 'keyword' && KEYWORD_DOC[text]) {
    const c = construct();
    return { from: t.from, to: t.to, signature: text, what: 'keyword', doc: KEYWORD_DOC[text], construct: c?.text };
  }
  const c = construct();
  if (c) return { from: c.from, to: c.to, construct: c.text };
  return undefined;
}

const TYPE_DOC: Record<string, string> = {
  bit: 'One wire: 0 or 1. The same type as `bits<1>`; conditions must be `bit`.',
  bits: 'An unsigned vector of N bits. Arithmetic wraps modulo 2ᴺ.',
  signed: 'A two’s-complement vector of N bits: signed comparison and arithmetic right shift.',
  clock: 'A clock wire. Allowed only on ports; it cannot be computed or compared.',
  int: 'A compile-time integer (generics, constants, loop variables). It costs no hardware.',
};

const BUILTIN_DOC: Record<string, [string, string]> = {
  concat: ['concat(a, b, …)', 'Joins values into one wider vector; the first argument is the most significant. Wiring only.'],
  repeat: ['repeat(x, n)', 'n copies of x side by side. Wiring only.'],
  zext: ['zext(x, N)', 'Zero-extends x to N bits. Wiring only.'],
  sext: ['sext(x, N)', 'Sign-extends x to N bits (copies the top bit). Wiring only.'],
  trunc: ['trunc(x, N)', 'Keeps the low N bits. Wiring only.'],
  reverse: ['reverse(x)', 'Reverses the order of the bits. Wiring only.'],
  any: ['any(x)', '1 when at least one bit of x is 1: an OR tree.'],
  all: ['all(x)', '1 when every bit of x is 1: an AND tree.'],
  count_ones: ['count_ones(x)', 'The number of 1 bits in x: a tree of half adders.'],
  signed: ['signed(x)', 'Reinterprets x as two’s-complement. Costs nothing.'],
  random: ['random(bits<N>)', 'A random value, in tests only.'],
};

const KEYWORD_DOC: Record<string, string> = {
  module: 'A circuit with input ports and output ports.',
  top: 'Marks the module bound to the virtual board.',
  fn: 'A pure combinational function, inlined wherever it is used.',
  struct: 'A record: the fields are laid side by side, the first one most significant.',
  enum: 'A set of named states. The compiler chooses their encoding (binary, `@onehot` or `@gray`).',
  type: 'A name for a type.',
  const: 'A compile-time constant.',
  let: 'A named wire, assigned once. It is not a variable: every `let` exists at the same time.',
  reg: 'A register: flip-flops that hold a value between clock edges. Its `init` is the value at power-up.',
  mem: 'A memory with synchronous reads: the data arrives one cycle later, like block RAM.',
  next: 'The value a register takes at the next clock edge. Every register needs exactly one.',
  inst: 'Places a copy of another module and connects its inputs.',
  for: 'Unrolled at compile time: it makes one copy of its body for each value of the counter.',
  in: 'Introduces the range of a `for`.',
  if: 'A 2-way multiplexer: `if c { a } else { b }`. `else` is mandatory.',
  else: 'The other arm of an `if`.',
  match: 'A parallel multiplexer: the arm whose pattern matches is selected; arms must cover every value.',
  on: 'Chooses the clock of a register: `reg x: bit = 0 on other_clk`.',
  test: 'A test bench: the only place where code runs in order. Simulation only.',
  sim: 'Creates a simulated instance of a module in a test.',
  step: 'Pulses the clock of the simulated instances.',
  expect: 'Checks a condition in a test.',
  print: 'Writes to the console in a test.',
};

// ------------------------------------------------------------------------------------ completions

export interface Completion {
  label: string;
  type: 'keyword' | 'variable' | 'function' | 'class' | 'property' | 'constant' | 'type' | 'enum' | 'namespace' | 'text';
  detail?: string;
  info?: string;
  /** Text to insert instead of the label. */
  apply?: string;
  boost?: number;
}

export interface CompletionResult {
  from: number;
  options: Completion[];
}

const MODULE_KEYWORDS = ['let', 'const', 'reg', 'mem', 'next', 'inst', 'for'];
const TOP_KEYWORDS = ['module', 'top module', 'fn', 'struct', 'enum', 'type', 'const', 'test'];
const TEST_KEYWORDS = ['let', 'step', 'expect', 'print', 'for'];
const EXPR_KEYWORDS = ['if', 'else', 'match'];

/** Which block the offset is in: a module body, a test body, or the top level. */
function blockAt(text: string, pos: number): 'module' | 'test' | 'top' {
  // Walk the text with brace depth, remembering what opened each brace.
  const stack: string[] = [];
  const toks = tokenize(text);
  let last = '';
  let lastKw = '';
  for (const t of toks) {
    if (t.from >= pos) break;
    const s = text.slice(t.from, t.to);
    if (t.kind === 'keyword' && ['module', 'test', 'fn', 'struct', 'enum', 'if', 'match', 'else'].includes(s)) lastKw = s;
    if (s === '{') {
      stack.push(lastKw === 'module' || lastKw === 'test' || lastKw === 'fn' || lastKw === 'struct' || lastKw === 'enum' ? lastKw : (stack[stack.length - 1] ?? 'other'));
      if (lastKw === 'module' || lastKw === 'test' || lastKw === 'fn' || lastKw === 'struct' || lastKw === 'enum') lastKw = '';
    } else if (s === '}') stack.pop();
    last = s;
  }
  void last;
  const inner = stack[stack.length - 1];
  return inner === 'module' ? 'module' : inner === 'test' ? 'test' : stack.includes('module') ? 'module' : stack.includes('test') ? 'test' : 'top';
}

/** `inst name: Module(` or `sim Module(`: the module whose connections are being written, and those already written. */
function connectionContext(before: string): { module: string; given: Set<string> } | undefined {
  // Find the last unmatched '('.
  let depth = 0;
  for (let i = before.length - 1; i >= 0; i--) {
    const c = before[i];
    if (c === ')' || c === ']') depth++;
    else if (c === '(' || c === '[') {
      if (depth === 0) {
        if (c === '[') return undefined;
        const head = before.slice(0, i);
        const m = /(?:\binst\s+[A-Za-z_][A-Za-z0-9_]*\s*:\s*|\bsim\s+)([A-Za-z_][A-Za-z0-9_]*)\s*(?:<[^<>()]*>)?\s*$/.exec(head);
        if (!m) return undefined;
        const inside = before.slice(i + 1);
        const given = new Set([...inside.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:/g)].map((x) => x[1]!));
        return { module: m[1]!, given };
      }
      depth--;
    }
  }
  return undefined;
}

export function completionsAt(a: Analysis, text: string, pos: number): CompletionResult | undefined {
  const before = text.slice(0, pos);
  const word = /[A-Za-z_][A-Za-z0-9_]*$/.exec(before)?.[0] ?? '';
  const from = pos - word.length;
  const head = before.slice(0, from);
  const block = blockAt(text, pos);
  const scope = moduleAt(a, pos, block === 'module');
  const opt = (label: string, type: Completion['type'], extra: Partial<Completion> = {}): Completion => ({ label, type, ...extra });

  // Members after a dot.
  const dot = /([A-Za-z_][A-Za-z0-9_]*)\s*\.\s*$/.exec(head);
  if (dot) {
    const owner = dot[1]!;
    const d = lookup(a, owner, scope?.name);
    if (d?.kind === 'inst') {
      const m = a.modules.find((x) => x.name === d.type);
      return { from, options: (m?.outputs ?? []).map((p) => opt(p.name, 'property', { detail: p.type, info: p.doc })) };
    }
    if (d?.kind === 'enum') return { from, options: (d.members ?? []).map((v) => opt(v, 'enum', { detail: owner })) };
    if (d?.kind === 'mem') return { from, options: [opt('read', 'function', { detail: '(address) -> data', apply: 'read(' }), opt('write', 'function', { detail: '(address, data, enable)', apply: 'write(' })] };
    // A simulated instance in a test: `let c = sim Counter(…)`.
    const sim = new RegExp(`let\\s+${owner}\\s*=\\s*sim\\s+([A-Za-z_][A-Za-z0-9_]*)`).exec(text);
    if (sim) {
      const m = a.modules.find((x) => x.name === sim[1]);
      return { from, options: [...(m?.inputs.filter((p) => !p.clock) ?? []).map((p) => opt(p.name, 'property', { detail: `${p.type} (input)` })), ...(m?.outputs ?? []).map((p) => opt(p.name, 'property', { detail: `${p.type} (output)` }))] };
    }
    return undefined;
  }

  // Connections of an instance: `inst x: Module(` … `port: value`.
  const conn = connectionContext(head);
  if (conn && /(?:[(,]\s*)$/.test(head.trimEnd() + (head.endsWith(' ') || head.endsWith('\n') ? ' ' : '')) && !/:\s*[^,]*$/.test(head.slice(head.lastIndexOf('(') + 1).replace(/[^,:]*\([^)]*\)/g, ''))) {
    const m = a.modules.find((x) => x.name === conn.module);
    if (m) {
      return {
        from,
        options: m.inputs.filter((p) => !conn.given.has(p.name)).map((p) => opt(p.name, 'property', { detail: p.type, info: p.doc, apply: `${p.name}: `, boost: 5 })),
      };
    }
  }

  // Module names after `inst x:` and `sim`.
  if (/\binst\s+[A-Za-z_][A-Za-z0-9_]*\s*:\s*$|\bsim\s+$/.test(head)) {
    return { from, options: a.modules.map((m) => opt(m.name, 'class', { detail: m.std ? 'standard library' : 'module', info: m.doc, boost: m.std ? 0 : 3 })) };
  }

  // After `:` or `->`: a type.
  if (/(?::|->)\s*$/.test(head) && block !== 'test') {
    return {
      from,
      options: [
        opt('bit', 'type', { detail: 'one wire' }),
        opt('bits', 'type', { detail: 'bits<N>', apply: 'bits<' }),
        opt('signed', 'type', { detail: 'signed<N>', apply: 'signed<' }),
        opt('clock', 'type'),
        ...a.decls.filter((d) => d.module === undefined && (d.kind === 'struct' || d.kind === 'enum' || d.kind === 'type')).map((d) => opt(d.name, 'class', { detail: d.kind })),
      ],
    };
  }

  // Statement starts.
  const lineStart = /(^|\n)[ \t]*$/.test(head);
  const options: Completion[] = [];
  if (lineStart) {
    const kws = block === 'module' ? MODULE_KEYWORDS : block === 'test' ? TEST_KEYWORDS : TOP_KEYWORDS;
    for (const k of kws) options.push(opt(k, 'keyword', { boost: 10, info: KEYWORD_DOC[k.replace('top module', 'top')] }));
    if (block === 'module') for (const d of a.decls.filter((x) => x.module === scope?.name && x.kind === 'output')) options.push(opt(d.name, 'variable', { detail: `${d.type} (output: assign with =)`, boost: 8, apply: `${d.name} = ` }));
    if (block === 'test') for (const m of a.modules.filter((x) => !x.std)) options.push(opt(`let x = sim ${m.name}(`, 'text', { detail: 'simulate', apply: `let x = sim ${m.name}(` }));
  }
  // Names in scope and built-ins.
  for (const d of a.decls) {
    if (d.module !== undefined && d.module !== scope?.name) continue;
    if (d.kind === 'module' || d.kind === 'variant') continue;
    if (d.kind === 'output' && block === 'module' && !lineStart) continue;
    const type: Completion['type'] = d.kind === 'fn' ? 'function' : d.kind === 'const' ? 'constant' : d.kind === 'enum' || d.kind === 'struct' || d.kind === 'type' ? 'class' : 'variable';
    options.push(opt(d.name, type, { detail: d.type ?? d.kind, info: d.doc, apply: d.kind === 'fn' ? `${d.name}(` : undefined }));
  }
  if (block !== 'top') {
    for (const [name, [sig]] of Object.entries(BUILTIN_DOC)) options.push(opt(name, 'function', { detail: sig, apply: `${name}(` }));
    for (const k of EXPR_KEYWORDS) options.push(opt(k, 'keyword'));
  }
  if (!word && !lineStart && !/[=(,+\-*&|^<>!~{[]\s*$/.test(head)) return undefined;
  const seen = new Set<string>();
  return { from, options: options.filter((o) => (seen.has(o.label) ? false : (seen.add(o.label), true))) };
}

// ------------------------------------------------------------------------------------ definitions

/** Where the name under the cursor is declared. */
export function definitionAt(a: Analysis, offset: number): { from: number; to: number } | undefined {
  const t = tokenize(a.source).find((x) => offset >= x.from && offset <= x.to && ['identifier', 'type', 'function', 'module'].includes(x.kind));
  if (!t) return undefined;
  const name = a.source.slice(t.from, t.to);
  const d = lookup(a, name, moduleAt(a, offset)?.name) ?? a.decls.find((x) => x.name === name);
  if (!d || (offset >= d.from && offset <= d.to)) return undefined;
  return { from: d.from, to: d.to };
}

export { KEYWORDS };
