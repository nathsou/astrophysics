// A JavaScript mirror of chapter 20's simply typed λ-calculus, for the typing lab:
// a parser for a readable surface syntax, the translation to de Bruijn indices,
// type inference with its derivation tree, and the course-language text of the term.
// (The chapter's `infer`, proved sound and complete, is the real checker; the lab
// shows the kernel checking its verdict on the generated term.)

export type Ty = { k: 'nat' } | { k: 'arrow'; a: Ty; b: Ty };

/** surface terms, with names */
export type Tm =
  | { k: 'var'; name: string }
  | { k: 'lit'; n: number }
  | { k: 'add'; a: Tm; b: Tm }
  | { k: 'lam'; x: string; ty: Ty; body: Tm }
  | { k: 'app'; f: Tm; a: Tm };

const NAT: Ty = { k: 'nat' };

export function showTy(t: Ty, prec = 0): string {
  if (t.k === 'nat') return 'nat';
  const s = `${showTy(t.a, 1)} → ${showTy(t.b, 0)}`;
  return prec > 0 ? `(${s})` : s;
}

export function tyEq(a: Ty, b: Ty): boolean {
  if (a.k === 'nat' || b.k === 'nat') return a.k === b.k;
  return tyEq(a.a, b.a) && tyEq(a.b, b.b);
}

// ---------------------------------------------------------------------------
// parsing:  fun (x : nat) => x + 1,   (fun (f : nat → nat) => f 2) (fun (y : nat) => y + y)

export function parseTm(src: string): Tm {
  const toks = src.match(/\d+|[A-Za-z_][\w']*|=>|->|→|λ|[()+:.]|\S/gu) ?? [];
  let i = 0;
  const peek = () => toks[i];
  const expect = (t: string) => {
    if (toks[i] !== t) throw new Error(`expected '${t}'${toks[i] ? `, found '${toks[i]}'` : ' at the end'}`);
    i++;
  };
  const ty = (): Ty => {
    const a = tyAtom();
    if (peek() === '→' || peek() === '->') {
      i++;
      return { k: 'arrow', a, b: ty() };
    }
    return a;
  };
  const tyAtom = (): Ty => {
    const t = toks[i++];
    if (t === 'nat' || t === 'Nat') return NAT;
    if (t === '(') {
      const r = ty();
      expect(')');
      return r;
    }
    throw new Error(`expected a type (nat, A → B), found '${t ?? 'the end'}'`);
  };
  const term = (): Tm => {
    if (peek() === 'fun' || peek() === 'λ') {
      i++;
      let x: string;
      let t: Ty;
      if (peek() === '(') {
        i++;
        x = ident();
        expect(':');
        t = ty();
        expect(')');
      } else {
        x = ident();
        expect(':');
        t = ty();
      }
      if (peek() === '=>' || peek() === '.') i++;
      else throw new Error(`expected '=>' after the binder of ${x}`);
      return { k: 'lam', x, ty: t, body: term() };
    }
    return sum();
  };
  const ident = (): string => {
    const t = toks[i++];
    if (!t || !/^[A-Za-z_]/.test(t) || t === 'fun') throw new Error(`expected a variable name, found '${t ?? 'the end'}'`);
    return t;
  };
  const sum = (): Tm => {
    let a = app();
    while (peek() === '+') {
      i++;
      a = { k: 'add', a, b: app() };
    }
    return a;
  };
  const startsAtom = (t: string | undefined) => t !== undefined && (t === '(' || /^\d+$/.test(t) || (/^[A-Za-z_]/.test(t) && t !== 'fun'));
  const app = (): Tm => {
    let f = atom();
    while (startsAtom(peek()) || peek() === 'fun' || peek() === 'λ') {
      // a trailing λ is an argument that extends to the end, as in Lean
      const a = peek() === 'fun' || peek() === 'λ' ? term() : atom();
      f = { k: 'app', f, a };
    }
    return f;
  };
  const atom = (): Tm => {
    const t = toks[i++];
    if (t === undefined) throw new Error('unexpected end of input');
    if (t === '(') {
      const r = term();
      expect(')');
      return r;
    }
    if (/^\d+$/.test(t)) return { k: 'lit', n: Number(t) };
    if (/^[A-Za-z_]/.test(t) && t !== 'fun') return { k: 'var', name: t };
    throw new Error(`unexpected '${t}'`);
  };
  const r = term();
  if (i < toks.length) throw new Error(`unexpected '${toks[i]}'`);
  return r;
}

// ---------------------------------------------------------------------------
// de Bruijn indices and the course-language text

/** the term as the course language writes a value of `Term` (free variables are an error) */
export function toCourse(t: Tm, ctx: string[] = []): string {
  switch (t.k) {
    case 'var': {
      const i = ctx.indexOf(t.name);
      if (i < 0) throw new Error(`unbound variable '${t.name}'`);
      return `(.var ${i})`;
    }
    case 'lit':
      return `(.lit ${t.n})`;
    case 'add':
      return `(.add ${toCourse(t.a, ctx)} ${toCourse(t.b, ctx)})`;
    case 'lam':
      return `(.lam ${tyCourse(t.ty)} ${toCourse(t.body, [t.x, ...ctx])})`;
    case 'app':
      return `(.app ${toCourse(t.f, ctx)} ${toCourse(t.a, ctx)})`;
  }
}

export function tyCourse(t: Ty): string {
  return t.k === 'nat' ? '.nat' : `(.arrow ${tyCourse(t.a)} ${tyCourse(t.b)})`;
}

/** the term with its binders erased and variables replaced by their indices: λ. #0 + 1 */
export function showDeBruijn(t: Tm, ctx: string[] = [], prec = 0): string {
  const par = (s: string, p: number) => (prec > p ? `(${s})` : s);
  switch (t.k) {
    case 'var': {
      const i = ctx.indexOf(t.name);
      return i < 0 ? `${t.name}?` : `#${i}`;
    }
    case 'lit':
      return String(t.n);
    case 'add':
      return par(`${showDeBruijn(t.a, ctx, 1)} + ${showDeBruijn(t.b, ctx, 2)}`, 1);
    case 'lam':
      return par(`λ ${showTy(t.ty, 1)}. ${showDeBruijn(t.body, [t.x, ...ctx], 0)}`, 0);
    case 'app':
      return par(`${showDeBruijn(t.f, ctx, 2)} ${showDeBruijn(t.a, ctx, 3)}`, 2);
  }
}

export function showTm(t: Tm, prec = 0): string {
  const par = (s: string, p: number) => (prec > p ? `(${s})` : s);
  switch (t.k) {
    case 'var':
      return t.name;
    case 'lit':
      return String(t.n);
    case 'add':
      return par(`${showTm(t.a, 1)} + ${showTm(t.b, 2)}`, 1);
    case 'lam':
      return par(`λ${t.x} : ${showTy(t.ty, 1)}. ${showTm(t.body, 0)}`, 0);
    case 'app':
      return par(`${showTm(t.f, 2)} ${showTm(t.a, 3)}`, 2);
  }
}

// ---------------------------------------------------------------------------
// inference, with the derivation

export interface Deriv {
  rule: 'var' | 'lit' | 'add' | 'lam' | 'app';
  ctx: { x: string; ty: Ty }[];
  term: Tm;
  ty: Ty;
  premises: Deriv[];
  /** for var: the de Bruijn index */
  index?: number;
}

export type InferResult = { ok: true; d: Deriv } | { ok: false; error: string; at: Tm };

export function infer(t: Tm, ctx: { x: string; ty: Ty }[] = []): InferResult {
  const fail = (error: string): InferResult => ({ ok: false, error, at: t });
  switch (t.k) {
    case 'var': {
      const i = ctx.findIndex((c) => c.x === t.name);
      if (i < 0) return fail(`the variable ${t.name} is not bound: lookup finds nothing`);
      return { ok: true, d: { rule: 'var', ctx, term: t, ty: ctx[i].ty, premises: [], index: i } };
    }
    case 'lit':
      return { ok: true, d: { rule: 'lit', ctx, term: t, ty: NAT, premises: [] } };
    case 'add': {
      const a = infer(t.a, ctx);
      if (!a.ok) return a;
      const b = infer(t.b, ctx);
      if (!b.ok) return b;
      if (a.d.ty.k !== 'nat') return fail(`+ needs numbers, but ${showTm(t.a, 2)} has type ${showTy(a.d.ty)}`);
      if (b.d.ty.k !== 'nat') return fail(`+ needs numbers, but ${showTm(t.b, 2)} has type ${showTy(b.d.ty)}`);
      return { ok: true, d: { rule: 'add', ctx, term: t, ty: NAT, premises: [a.d, b.d] } };
    }
    case 'lam': {
      const b = infer(t.body, [{ x: t.x, ty: t.ty }, ...ctx]);
      if (!b.ok) return b;
      return { ok: true, d: { rule: 'lam', ctx, term: t, ty: { k: 'arrow', a: t.ty, b: b.d.ty }, premises: [b.d] } };
    }
    case 'app': {
      const f = infer(t.f, ctx);
      if (!f.ok) return f;
      const a = infer(t.a, ctx);
      if (!a.ok) return a;
      if (f.d.ty.k !== 'arrow') return fail(`${showTm(t.f, 2)} is applied to an argument, but its type ${showTy(f.d.ty)} is not a function type`);
      if (!tyEq(f.d.ty.a, a.d.ty)) return fail(`${showTm(t.f, 2)} expects an argument of type ${showTy(f.d.ty.a)}, but ${showTm(t.a, 2)} has type ${showTy(a.d.ty)}`);
      return { ok: true, d: { rule: 'app', ctx, term: t, ty: f.d.ty.b, premises: [f.d, a.d] } };
    }
  }
}

// ---------------------------------------------------------------------------
// the derivation, as nested inference rules in TeX

const texTy = (t: Ty): string => showTy(t).replace(/→/g, '\\to ').replace(/nat/g, '\\mathsf{nat}');

function texTm(t: Tm, prec = 0): string {
  const par = (s: string, p: number) => (prec > p ? `(${s})` : s);
  switch (t.k) {
    case 'var':
      return `\\mathit{${t.name}}`;
    case 'lit':
      return String(t.n);
    case 'add':
      return par(`${texTm(t.a, 1)} + ${texTm(t.b, 2)}`, 1);
    case 'lam':
      return par(`\\lambda \\mathit{${t.x}} {:} ${texTy(t.ty)}.\\, ${texTm(t.body, 0)}`, 0);
    case 'app':
      return par(`${texTm(t.f, 2)}\\ ${texTm(t.a, 3)}`, 2);
  }
}

export function derivTex(d: Deriv): string {
  const ctx = d.ctx.length ? d.ctx.map((c) => `\\mathit{${c.x}} {:} ${texTy(c.ty)}`).join(', ') : '';
  const concl = `${ctx} \\vdash ${texTm(d.term)} : ${texTy(d.ty)}`;
  const prem = d.premises.map(derivTex).join(' \\qquad ');
  const label = `\\textsf{\\scriptsize ${d.rule}${d.index !== undefined ? ` (\\#${d.index})` : ''}}`;
  return `\\dfrac{${prem || '\\vphantom{x}'}}{${concl}}\\,${label}`;
}

/** the kernel-checked verdict on a closed term: a typing derivation from `infer_sound`, or a refutation by `decide` */
export function certificate(src: string): { code: string; typed: boolean } {
  const t = parseTm(src);
  const course = toCourse(t);
  const r = infer(t);
  if (r.ok) {
    return {
      typed: true,
      code: `#eval infer [] ${course}\n\nexample : HasType [] ${course} ${tyCourse(r.d.ty)} :=\n  infer_sound _ _ _ rfl`,
    };
  }
  return { typed: false, code: `#eval infer [] ${course}\n\nexample : ¬ ∃ T, HasType [] ${course} T := by\n  decide` };
}

/** the lab's example terms */
export const TYPING_PRESETS = [
  'fun (x : nat) => x + 1',
  '(fun (f : nat → nat) => f (f 1)) (fun (y : nat) => y + y)',
  'fun (f : nat → nat → nat) => fun (x : nat) => f x x',
  'fun (x : nat) => x x',
  '(fun (x : nat) => x) (fun (y : nat) => y)',
];
