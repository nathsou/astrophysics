/**
 * Access policies as formulas (chapter 14), a small version of the idea behind Zelkova (Backes et al., FMCAD 2018):
 * a policy is a list of allow and deny statements; a request is allowed when some allow statement matches it and no
 * deny statement does (an explicit deny wins; anything not allowed is denied). A question about a policy, such as
 * "can anyone outside the office network write?", becomes a satisfiability query over symbolic requests.
 *
 * Simplifications: a request has a user, an action, a resource path, a source IP address and an MFA flag; users,
 * actions and path segments range over the names the policies and the question mention plus one "other" name;
 * paths are compared on their first two segments; wildcards only appear as a whole segment (`logs/*`).
 */
import { and, bvbin, bvnum, bvSort, eq, FALSE, not, or, TRUE, v, type Term } from '../logic/term';
import { checkSat } from '../smt/solver';
import { checkUnsatCertificate } from '../smt/check/certificate';

export class PolicyError extends Error {}

export type Cond =
  | { k: 'true' }
  | { k: 'not'; a: Cond }
  | { k: 'and' | 'or'; a: Cond; b: Cond }
  | { k: 'ip'; net: number; bits: number }
  | { k: 'mfa' }
  | { k: 'user' | 'action'; name: string }
  | { k: 'resource'; pattern: string[] };

export interface Statement {
  effect: 'allow' | 'deny';
  actions: string[] | '*';
  resource: string[];
  cond: Cond;
  line: number;
  text: string;
}

export interface Request {
  user: string;
  action: string;
  resource: string[];
  ip: number;
  mfa: boolean;
}

const OTHER = '…';

function parseCidr(s: string): { net: number; bits: number } {
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)(?:\/(\d+))?$/.exec(s);
  if (!m) throw new PolicyError(`“${s}” is not an IP address or range such as 10.0.0.0/8.`);
  const parts = m.slice(1, 5).map(Number);
  const bits = m[5] === undefined ? 32 : Number(m[5]);
  if (parts.some((p) => p > 255) || bits > 32) throw new PolicyError(`“${s}” is not a valid address range.`);
  const ip = ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return { net: (ip & mask) >>> 0, bits };
}
export const showIp = (ip: number) => [24, 16, 8, 0].map((s) => (ip >>> s) & 255).join('.');
const pathOf = (s: string) => s.split('/').filter(Boolean);

/** Conditions: `ip in 10.0.0.0/8`, `mfa`, `user == alice`, `action == write`, `resource in logs/*`, with ! && || ( ). */
export function parseCond(src: string): Cond {
  const toks = src.match(/\d+\.\d+\.\d+\.\d+(?:\/\d+)?|[A-Za-z_*][\w.*/-]*|==|!=|&&|\|\||[()!]/g) ?? [];
  const rest = src.replace(/\d+\.\d+\.\d+\.\d+(?:\/\d+)?|[A-Za-z_*][\w.*/-]*|==|!=|&&|\|\||[()!]|\s+/g, '');
  if (rest) throw new PolicyError(`Cannot read “${rest[0]}” in “${src.trim()}”.`);
  let p = 0;
  const peek = () => toks[p];
  const expect = (t: string) => {
    if (toks[p] !== t) throw new PolicyError(`Expected “${t}” in “${src.trim()}”.`);
    p++;
  };
  const orE = (): Cond => {
    let a = andE();
    while (peek() === '||') {
      p++;
      a = { k: 'or', a, b: andE() };
    }
    return a;
  };
  const andE = (): Cond => {
    let a = unary();
    while (peek() === '&&') {
      p++;
      a = { k: 'and', a, b: unary() };
    }
    return a;
  };
  const unary = (): Cond => {
    if (peek() === '!') {
      p++;
      return { k: 'not', a: unary() };
    }
    if (peek() === '(') {
      p++;
      const c = orE();
      expect(')');
      return c;
    }
    const t = toks[p++];
    if (t === 'mfa') return { k: 'mfa' };
    if (t === 'true') return { k: 'true' };
    if (t === 'ip') {
      expect('in');
      const r = toks[p++];
      if (!r) throw new PolicyError('Expected an address range after “ip in”.');
      return { k: 'ip', ...parseCidr(r) };
    }
    if (t === 'resource') {
      expect('in');
      const r = toks[p++];
      if (!r) throw new PolicyError('Expected a path after “resource in”.');
      return { k: 'resource', pattern: pathOf(r) };
    }
    if (t === 'user' || t === 'action') {
      const op = toks[p++];
      if (op !== '==' && op !== '!=') throw new PolicyError(`Write “${t} == name” or “${t} != name”.`);
      const name = toks[p++];
      if (!name || !/^[A-Za-z_]/.test(name)) throw new PolicyError(`Expected a name after “${t} ${op}”.`);
      const c: Cond = { k: t, name };
      return op === '==' ? c : { k: 'not', a: c };
    }
    throw new PolicyError(t ? `Unknown condition “${t}”. Use ip, mfa, user, action or resource.` : `“${src.trim()}” ends too early.`);
  };
  if (!toks.length) return { k: 'true' };
  const c = orE();
  if (p < toks.length) throw new PolicyError(`Unexpected “${toks[p]}” in “${src.trim()}”.`);
  return c;
}

/** One statement per line: `allow read,write on logs/* if ip in 10.0.0.0/8`; `#` starts a comment. */
export function parsePolicy(text: string): Statement[] {
  const out: Statement[] = [];
  text.split('\n').forEach((raw, i) => {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) return;
    const m = /^(allow|deny)\s+(\S+)\s+on\s+(\S+)(?:\s+if\s+(.+))?$/.exec(line);
    if (!m) throw new PolicyError(`Line ${i + 1}: write “allow ACTIONS on RESOURCE” or “deny ACTIONS on RESOURCE”, optionally followed by “if CONDITION”.`);
    const actions = m[2] === '*' ? '*' : m[2]!.split(',').filter(Boolean);
    try {
      out.push({ effect: m[1] as 'allow' | 'deny', actions, resource: pathOf(m[3]!), cond: m[4] ? parseCond(m[4]) : { k: 'true' }, line: i + 1, text: line });
    } catch (e) {
      throw new PolicyError(`Line ${i + 1}: ${(e as Error).message}`);
    }
  });
  return out;
}

// ── The universe of names, and the reference semantics ──

export interface Universe {
  users: string[];
  actions: string[];
  segments: string[];
}

export function universe(policies: Statement[][], questions: Cond[]): Universe {
  const users = new Set<string>();
  const actions = new Set<string>();
  const segments = new Set<string>();
  const cond = (c: Cond) => {
    if (c.k === 'user') users.add(c.name);
    if (c.k === 'action') actions.add(c.name);
    if (c.k === 'resource') c.pattern.forEach((s) => s !== '*' && segments.add(s));
    if (c.k === 'not') cond(c.a);
    if (c.k === 'and' || c.k === 'or') {
      cond(c.a);
      cond(c.b);
    }
  };
  for (const p of policies)
    for (const s of p) {
      if (s.actions !== '*') s.actions.forEach((a) => actions.add(a));
      s.resource.forEach((x) => x !== '*' && segments.add(x));
      cond(s.cond);
    }
  questions.forEach(cond);
  return { users: [...users, OTHER], actions: [...actions, OTHER], segments: [...segments, OTHER] };
}

const inCidr = (ip: number, net: number, bits: number) => bits === 0 || ip >>> (32 - bits) === net >>> (32 - bits);
const pathMatches = (pattern: string[], path: string[]) => {
  for (let i = 0; i < 2; i++) {
    const p = pattern[i];
    if (p === undefined) return path[i] === undefined || pattern.length === 0;
    if (p === '*') return true;
    if (p !== path[i]) return false;
  }
  return true;
};

export function holds(c: Cond, r: Request): boolean {
  switch (c.k) {
    case 'true': return true;
    case 'not': return !holds(c.a, r);
    case 'and': return holds(c.a, r) && holds(c.b, r);
    case 'or': return holds(c.a, r) || holds(c.b, r);
    case 'ip': return inCidr(r.ip, c.net, c.bits);
    case 'mfa': return r.mfa;
    case 'user': return r.user === c.name;
    case 'action': return r.action === c.name;
    case 'resource': return pathMatches(c.pattern, r.resource);
  }
}

const stmtMatches = (s: Statement, r: Request) => (s.actions === '*' || s.actions.includes(r.action)) && pathMatches(s.resource, r.resource) && holds(s.cond, r);

/** Which statements decide a request: the matching denies if any, else the matching allows. */
export function decide(p: Statement[], r: Request): { allowed: boolean; because: Statement[] } {
  const denies = p.filter((s) => s.effect === 'deny' && stmtMatches(s, r));
  if (denies.length) return { allowed: false, because: denies };
  const allows = p.filter((s) => s.effect === 'allow' && stmtMatches(s, r));
  return { allowed: allows.length > 0, because: allows };
}

// ── The encoding ──

/** Symbolic requests: user, action and two path segments as small bit-vectors (with "absent" for a missing segment), ip as 32 bits. */
class Encoder {
  readonly user = v('user', bvSort(8));
  readonly action = v('action', bvSort(8));
  readonly seg = [v('seg0', bvSort(8)), v('seg1', bvSort(8))];
  readonly ip = v('ip', bvSort(32));
  readonly mfa = v('mfa', { k: 'bool' });
  constructor(readonly u: Universe) {}
  /** seg values: 0..n−1 for the segment names, n for "absent". */
  get absent() {
    return this.u.segments.length;
  }
  wellFormed(): Term {
    const lt = (x: Term, n: number) => bvbin('bvult', x, bvnum(BigInt(n), 8));
    // The first segment is never absent; the second may be.
    return and(lt(this.user, this.u.users.length), lt(this.action, this.u.actions.length), lt(this.seg[0]!, this.u.segments.length), lt(this.seg[1]!, this.u.segments.length + 1));
  }
  is(x: Term, list: string[], name: string): Term {
    const i = list.indexOf(name);
    return i < 0 ? FALSE : eq(x, bvnum(BigInt(i), 8));
  }
  path(pattern: string[]): Term {
    if (!pattern.length) return TRUE;
    const conj: Term[] = [];
    for (let i = 0; i < 2; i++) {
      const p = pattern[i];
      if (p === undefined) {
        conj.push(eq(this.seg[i]!, bvnum(BigInt(this.absent), 8)));
        break;
      }
      if (p === '*') break;
      conj.push(this.is(this.seg[i]!, this.u.segments, p));
    }
    return and(...conj);
  }
  cond(c: Cond): Term {
    switch (c.k) {
      case 'true': return TRUE;
      case 'not': return not(this.cond(c.a));
      case 'and': return and(this.cond(c.a), this.cond(c.b));
      case 'or': return or(this.cond(c.a), this.cond(c.b));
      case 'mfa': return this.mfa;
      case 'user': return this.is(this.user, this.u.users, c.name);
      case 'action': return this.is(this.action, this.u.actions, c.name);
      case 'resource': return this.path(c.pattern);
      case 'ip': {
        if (c.bits === 0) return TRUE;
        const mask = BigInt((0xffffffff << (32 - c.bits)) >>> 0);
        return eq(bvbin('bvand', this.ip, bvnum(mask, 32)), bvnum(BigInt(c.net), 32));
      }
    }
  }
  statement(s: Statement): Term {
    const act = s.actions === '*' ? TRUE : or(...s.actions.map((a) => this.is(this.action, this.u.actions, a)));
    return and(act, this.path(s.resource), this.cond(s.cond));
  }
  allowed(p: Statement[]): Term {
    return and(or(...p.filter((s) => s.effect === 'allow').map((s) => this.statement(s))), not(or(...p.filter((s) => s.effect === 'deny').map((s) => this.statement(s)))));
  }
  decode(m: Map<string, unknown>): Request {
    const n = (k: string) => Number((m.get(k) as bigint | undefined) ?? 0n);
    const seg1 = n('seg1');
    return {
      user: this.u.users[n('user')] ?? OTHER,
      action: this.u.actions[n('action')] ?? OTHER,
      resource: [this.u.segments[n('seg0')] ?? OTHER, ...(seg1 === this.absent ? [] : [this.u.segments[seg1] ?? OTHER])],
      ip: n('ip'),
      mfa: m.get('mfa') === true,
    };
  }
}

export interface Answer {
  /** For "find": a request was found; for "compare": B allows less than A. */
  found: boolean;
  request?: Request;
  /** The example was re-checked by the reference semantics. */
  replayed?: boolean;
  certified?: boolean;
  status: 'sat' | 'unsat' | 'unknown';
  reason?: string;
}

function solve(enc: Encoder, f: Term, check: (r: Request) => boolean): Answer {
  const res = checkSat([enc.wellFormed(), f], { proof: true, timeout: 10000 });
  if (res.status === 'sat' && res.model) {
    const request = enc.decode(res.model.vars);
    const replayed = check(request);
    return replayed ? { found: true, request, replayed, status: 'sat' } : { found: false, status: 'unknown', reason: 'the example did not replay' };
  }
  if (res.status === 'unsat') return { found: false, status: 'unsat', certified: res.proof ? checkUnsatCertificate(res.proof).ok : false };
  return { found: false, status: 'unknown', reason: res.reason };
}

/** Is there a request the policy allows that satisfies the question? */
export function ask(policy: Statement[], question: Cond): Answer {
  const enc = new Encoder(universe([policy], [question]));
  return solve(enc, and(enc.allowed(policy), enc.cond(question)), (r) => decide(policy, r).allowed && holds(question, r));
}

/** Is there a request that A allows and B denies? (None means B allows everything A allows.) */
export function compare(a: Statement[], b: Statement[], within: Cond = { k: 'true' }): Answer {
  const enc = new Encoder(universe([a, b], [within]));
  return solve(enc, and(enc.allowed(a), not(enc.allowed(b)), enc.cond(within)), (r) => decide(a, r).allowed && !decide(b, r).allowed && holds(within, r));
}

export const OTHER_NAME = OTHER;
