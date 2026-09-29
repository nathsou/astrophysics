// Recursive-descent / Pratt parser for the surface language.
//
// The notation table is extensible (`infixl:65 " + " => Nat.add`), so the
// parser works one command at a time: `nextCommand()` parses a single command
// and the caller may register new notations before asking for the next one.

import type { Command, SAlt, SArg, SBinder, SCtor, SInductive, SLevel, STerm, Span } from './ast.ts';
import { COMMAND_KEYWORDS, Lexer, type Token } from './lexer.ts';
import type { Notation } from '../core/env.ts';

export class ParseError extends Error {
  constructor(
    message: string,
    readonly span: Span,
  ) {
    super(message);
  }
}

const ARROW_PREC = 25;
const APP_PREC = 1024;

export class Parser {
  private lexer: Lexer;
  private pos = 0;
  private cache = new Map<number, Token>();
  private notations: Notation[] = [];
  private infix = new Map<string, Notation>();
  private prefix = new Map<string, Notation>();
  /** inside structure fields: `ident :` at the start of a line begins a new field */
  private fieldMode = false;
  /** stop terms at a top-level `|` */
  readonly errors: { message: string; span: Span }[] = [];

  constructor(
    readonly src: string,
    notations: Notation[] = [],
  ) {
    this.lexer = new Lexer(src);
    this.setNotations(notations);
  }

  setNotations(ns: Notation[]): void {
    this.notations = ns;
    this.infix.clear();
    this.prefix.clear();
    for (const n of ns) {
      if (n.kind === 'prefix') this.prefix.set(n.symbol, n);
      else this.infix.set(n.symbol, n);
    }
    this.lexer.setSymbols(ns.map((n) => n.symbol));
    this.cache.clear();
  }

  getNotations(): Notation[] {
    return this.notations;
  }

  // -------------------------------------------------------------------------
  // token stream

  private peek(): Token {
    let t = this.cache.get(this.pos);
    if (!t) {
      t = this.lexer.lexAt(this.pos);
      this.cache.set(this.pos, t);
    }
    // doc comments are only meaningful before commands
    if (t.kind === 'doc' && !this.allowDoc) {
      this.pos = t.to;
      return this.peek();
    }
    return t;
  }
  private allowDoc = false;

  private peekAt(n: number): Token {
    const saved = this.pos;
    let t = this.peek();
    for (let i = 0; i < n; i++) {
      this.pos = t.to;
      t = this.peek();
    }
    this.pos = saved;
    return t;
  }

  private next(): Token {
    const t = this.peek();
    this.pos = t.to;
    this.lastEnd = t.to;
    return t;
  }

  private is(text: string): boolean {
    const t = this.peek();
    return (t.kind === 'sym' || t.kind === 'kw') && t.text === text;
  }

  private accept(text: string): Token | undefined {
    if (this.is(text)) return this.next();
    return undefined;
  }

  private expect(text: string, what?: string): Token {
    if (this.is(text)) return this.next();
    const t = this.peek();
    throw new ParseError(`expected '${text}'${what ? ` ${what}` : ''}, found ${describe(t)}`, { from: t.from, to: Math.max(t.to, t.from + 1) });
  }

  private ident(what = 'identifier'): Token {
    const t = this.peek();
    if (t.kind !== 'ident') throw new ParseError(`expected ${what}, found ${describe(t)}`, { from: t.from, to: Math.max(t.to, t.from + 1) });
    return this.next();
  }

  private lastEnd = 0;
  private span(from: number): Span {
    return { from, to: Math.max(from, this.lastTokEnd()) };
  }
  private lastTokEnd(): number {
    return this.lastEnd;
  }

  private nextTracked(): Token {
    return this.next();
  }

  // -------------------------------------------------------------------------
  // commands

  atEnd(): boolean {
    this.allowDoc = true;
    const r = this.peek().kind === 'eof';
    this.allowDoc = false;
    return r;
  }

  /** Parse the next command; on error, records it and skips to the next command. */
  nextCommand(): Command | undefined {
    this.allowDoc = true;
    let doc: string | undefined;
    let t = this.peek();
    while (t.kind === 'doc') {
      doc = t.text;
      this.pos = t.to;
      t = this.peek();
    }
    this.allowDoc = false;
    if (t.kind === 'eof') return undefined;
    const start = t.from;
    try {
      const c = this.command();
      c.doc = doc;
      return c;
    } catch (e) {
      if (e instanceof ParseError) {
        this.errors.push({ message: e.message, span: e.span });
        this.recover(start);
        return { k: 'error', span: { from: start, to: this.pos } };
      }
      throw e;
    }
  }

  private recover(start: number): void {
    // skip at least one token, then up to the next command keyword at column 0
    // (or any command keyword)
    if (this.pos <= start) this.next();
    for (;;) {
      const t = this.peek();
      if (t.kind === 'eof') return;
      if (t.kind === 'kw' && COMMAND_KEYWORDS.has(t.text) && (t.col === 0 || t.text.startsWith('#'))) return;
      if (t.kind === 'doc') return;
      this.next();
    }
  }

  private command(): Command {
    const t = this.peek();
    const from = t.from;
    const kw = t.kind === 'kw' ? t.text : '';
    switch (kw) {
      case 'noncomputable':
        this.next();
        return this.command();
      case 'def':
      case 'theorem':
      case 'lemma':
      case 'example':
      case 'abbrev':
      case 'opaque':
        return this.defCommand();
      case 'axiom': {
        this.nextTracked();
        const nm = this.ident('a name');
        const levelParams = this.optLevelParams();
        const binders = this.binders(false);
        this.expect(':');
        const type = this.term();
        return { k: 'axiom', name: nm.text, nameSpan: { from: nm.from, to: nm.to }, levelParams, binders, type, span: this.span(from) };
      }
      case 'inductive': {
        const ind = this.inductive();
        return { k: 'inductive', types: [ind], span: this.span(from) };
      }
      case 'mutual': {
        this.nextTracked();
        const types: SInductive[] = [];
        while (this.is('inductive')) types.push(this.inductive());
        this.expect('end', 'to close the mutual block');
        this.lastEnd = this.pos;
        return { k: 'inductive', types, span: this.span(from) };
      }
      case 'structure':
        return this.structure();
      case 'variable': {
        this.nextTracked();
        const binders = this.binders(true);
        if (binders.length === 0) throw new ParseError('expected binders after variable', this.span(from));
        return { k: 'variable', binders, span: this.span(from) };
      }
      case 'universe': {
        this.nextTracked();
        const names: string[] = [];
        while (this.peek().kind === 'ident' && !this.peek().nl) names.push(this.nextTracked().text);
        return { k: 'universe', names, span: this.span(from) };
      }
      case '#check':
        this.nextTracked();
        return { k: 'check', term: this.term(), span: this.span(from) };
      case '#reduce':
      case '#eval':
      case '#whnf':
        this.nextTracked();
        return { k: 'reduce', term: this.term(), mode: kw === '#whnf' ? 'whnf' : kw === '#eval' ? 'eval' : 'reduce', span: this.span(from) };
      case '#print': {
        this.nextTracked();
        let axioms = false;
        if (this.peek().kind === 'ident' && this.peek().text === 'axioms') {
          this.nextTracked();
          axioms = true;
        }
        const nm = this.ident('a name');
        this.lastEnd = nm.to;
        return { k: 'print', name: nm.text, axioms, span: this.span(from) };
      }
      case 'infixl':
      case 'infixr':
      case 'infix':
      case 'prefix': {
        this.nextTracked();
        this.expect(':');
        const pt = this.next();
        const prec = pt.text === 'max' ? APP_PREC : Number(pt.text);
        if (Number.isNaN(prec)) throw new ParseError('expected a precedence', { from: pt.from, to: pt.to });
        const st = this.next();
        if (st.kind !== 'str') throw new ParseError('expected a string literal with the symbol', { from: st.from, to: st.to });
        this.expect('=>');
        const target = this.ident('the name of the function the notation stands for');
        this.lastEnd = target.to;
        return { k: 'notation', kind: kw, prec, symbol: st.text.trim(), target: target.text, span: this.span(from) };
      }
      case 'open': {
        this.nextTracked();
        const names: string[] = [];
        while (this.peek().kind === 'ident' && !this.peek().nl) names.push(this.nextTracked().text);
        return { k: 'open', names, span: this.span(from) };
      }
      case 'namespace': {
        this.nextTracked();
        const nm = this.ident();
        this.lastEnd = nm.to;
        return { k: 'namespace', name: nm.text, span: this.span(from) };
      }
      case 'section': {
        this.nextTracked();
        let name: string | undefined;
        if (this.peek().kind === 'ident' && !this.peek().nl) name = this.nextTracked().text;
        return { k: 'section', name, span: this.span(from) };
      }
      case 'end': {
        this.nextTracked();
        let name: string | undefined;
        if (this.peek().kind === 'ident' && !this.peek().nl) name = this.nextTracked().text;
        return { k: 'end', name, span: this.span(from) };
      }
      case 'set_option': {
        this.nextTracked();
        const nm = this.ident('an option name');
        const v = this.nextTracked();
        return { k: 'setOption', name: nm.text, value: v.text, span: this.span(from) };
      }
      case 'init_quot':
        this.nextTracked();
        return { k: 'initQuot', span: this.span(from) };
    }
    throw new ParseError(`expected a command (def, theorem, inductive, #check, …), found ${describe(t)}`, { from: t.from, to: Math.max(t.to, t.from + 1) });
  }

  private optLevelParams(): string[] | undefined {
    if (!this.accept('.{')) return undefined;
    const names: string[] = [];
    do {
      names.push(this.ident('a universe name').text);
    } while (this.accept(','));
    this.lastEnd = this.expect('}').to;
    return names;
  }

  private defCommand(): Command {
    const kwTok = this.nextTracked();
    const from = kwTok.from;
    const kind = kwTok.text === 'lemma' ? 'theorem' : (kwTok.text as 'def' | 'theorem' | 'example' | 'abbrev' | 'opaque');
    let name = '_example';
    let nameSpan: Span = { from: kwTok.from, to: kwTok.to };
    let levelParams: string[] | undefined;
    if (kind !== 'example') {
      const nm = this.ident('a name');
      name = nm.text;
      nameSpan = { from: nm.from, to: nm.to };
      levelParams = this.optLevelParams();
    }
    const binders = this.binders(false);
    let type: STerm | undefined;
    if (this.accept(':')) type = this.term();
    if (this.is('|')) {
      const alts = this.alts();
      return { k: 'def', kind, name, nameSpan, levelParams, binders, type, body: { k: 'equations', alts }, span: this.span(from) };
    }
    this.expect(':=', type ? 'or equations after the type' : 'after the signature');
    const term = this.term();
    return { k: 'def', kind, name, nameSpan, levelParams, binders, type, body: { k: 'term', term }, span: this.span(from) };
  }

  private alts(): SAlt[] {
    const alts: SAlt[] = [];
    while (this.is('|')) {
      const from = this.next().from;
      const pats: STerm[] = [this.term()];
      while (this.accept(',')) pats.push(this.term());
      this.expect('=>');
      const rhs = this.term();
      alts.push({ pats, rhs, span: this.span(from) });
    }
    return alts;
  }

  private inductive(): SInductive {
    const from = this.expect('inductive').from;
    const nm = this.ident('the name of the inductive type');
    const levelParams = this.optLevelParams();
    const binders = this.binders(false);
    let type: STerm | undefined;
    if (this.accept(':')) type = this.term();
    this.accept('where');
    const ctors: SCtor[] = [];
    for (;;) {
      this.allowDoc = true;
      let doc: string | undefined;
      while (this.peek().kind === 'doc') {
        doc = this.peek().text;
        this.pos = this.peek().to;
      }
      this.allowDoc = false;
      if (!this.is('|')) break;
      this.next();
      const cn = this.ident('a constructor name');
      const cb = this.binders(false);
      let ct: STerm | undefined;
      if (this.accept(':')) ct = this.term();
      else this.lastEnd = Math.max(this.lastEnd, cn.to);
      ctors.push({ name: cn.text, nameSpan: { from: cn.from, to: cn.to }, binders: cb, type: ct, doc });
    }
    this.lastEnd = Math.max(this.lastEnd, nm.to);
    return { name: nm.text, nameSpan: { from: nm.from, to: nm.to }, levelParams, binders, type, ctors, span: this.span(from) };
  }

  private structure(): Command {
    const from = this.nextTracked().from;
    const nm = this.ident('the name of the structure');
    const levelParams = this.optLevelParams();
    const binders = this.binders(false);
    let type: STerm | undefined;
    if (this.accept(':')) type = this.term();
    this.expect('where');
    let ctorName: string | undefined;
    if (this.peek().kind === 'ident' && this.peekAt(1).text === '::') {
      ctorName = this.next().text;
      this.next();
    }
    const fields: SBinder[] = [];
    const saved = this.fieldMode;
    this.fieldMode = true;
    try {
      for (;;) {
        const t = this.peek();
        if (t.kind === 'sym' && (t.text === '(' || t.text === '{')) {
          fields.push(...this.binders(false));
          continue;
        }
        if (t.kind !== 'ident') break;
        const bf = t.from;
        const names: { name: string; span: Span }[] = [];
        while (this.peek().kind === 'ident') {
          const n = this.next();
          names.push({ name: n.text, span: { from: n.from, to: n.to } });
        }
        this.expect(':', 'after the field name');
        const ty = this.term();
        fields.push({ names, type: ty, binfo: 'default', span: this.span(bf) });
      }
    } finally {
      this.fieldMode = saved;
    }
    return { k: 'structure', name: nm.text, nameSpan: { from: nm.from, to: nm.to }, levelParams, binders, type, ctorName, fields, span: this.span(from) };
  }

  // -------------------------------------------------------------------------
  // binders

  /**
   * Parse binder groups: `x`, `_`, `(x y : A)`, `{x : A}`, `⦃x : A⦄`, `[inst : C]`.
   * When `allowBare` is false, bare identifiers are not accepted (as in def signatures).
   */
  private binders(allowBare: boolean): SBinder[] {
    const out: SBinder[] = [];
    for (;;) {
      const t = this.peek();
      if (t.kind === 'sym' && (t.text === '(' || t.text === '{' || t.text === '⦃' || t.text === '[')) {
        // a parenthesised group must look like `( ident+ :`
        const close = t.text === '(' ? ')' : t.text === '{' ? '}' : t.text === '⦃' ? '⦄' : ']';
        const binfo = t.text === '(' ? 'default' : t.text === '{' ? 'implicit' : t.text === '⦃' ? 'strictImplicit' : 'inst';
        if (!this.looksLikeBinderGroup(close)) break;
        const from = this.next().from;
        const names: { name: string; span: Span }[] = [];
        while (this.peek().kind === 'ident' || this.is('_')) {
          const n = this.next();
          names.push({ name: n.text, span: { from: n.from, to: n.to } });
        }
        let type: STerm | undefined;
        if (this.accept(':')) type = this.term();
        this.lastEnd = this.expect(close).to;
        out.push({ names, type, binfo, span: this.span(from) });
        continue;
      }
      if (allowBare && (t.kind === 'ident' || (t.kind === 'sym' && t.text === '_'))) {
        this.nextTracked();
        out.push({ names: [{ name: t.text, span: { from: t.from, to: t.to } }], binfo: 'default', span: { from: t.from, to: t.to } });
        continue;
      }
      break;
    }
    return out;
  }

  private looksLikeBinderGroup(close: string): boolean {
    // ( x y z : …    or   { x y }  / ⦃ x ⦄
    let i = 1;
    let sawName = false;
    for (;;) {
      const t = this.peekAt(i);
      if (t.kind === 'ident' || (t.kind === 'sym' && t.text === '_')) {
        sawName = true;
        i++;
        continue;
      }
      if (!sawName) return false;
      if (t.kind === 'sym' && t.text === ':') return true;
      if (t.kind === 'sym' && t.text === close && close !== ')') return true;
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // terms

  term(prec = 0): STerm {
    const from = this.peek().from;
    let left = this.leading();
    let lastWasApp = false;
    for (;;) {
      const t = this.peek();
      if (this.fieldMode && t.nl && t.kind === 'ident' && this.peekAt(1).text === ':') break;
      if (t.kind === 'sym' && (t.text === '→' || t.text === '->')) {
        if (prec > ARROW_PREC) break;
        this.next();
        const cod = this.term(ARROW_PREC);
        left = { k: 'arrow', dom: left, cod, span: this.span(from) };
        lastWasApp = false;
        continue;
      }
      if ((t.kind === 'sym' || t.kind === 'ident') && this.infix.has(t.text) && !(t.kind === 'ident')) {
        const n = this.infix.get(t.text)!;
        if (n.prec < prec) break;
        const opTok = this.next();
        const rp = n.kind === 'infixr' ? n.prec : n.prec + 1;
        const rhs = this.term(rp);
        const fn: STerm = { k: 'ident', name: n.target, explicit: false, span: { from: opTok.from, to: opTok.to } };
        left = { k: 'app', fn, args: [{ arg: left }, { arg: rhs }], span: this.span(from) };
        lastWasApp = false;
        continue;
      }
      if (prec <= APP_PREC && this.startsArg()) {
        const args: SArg[] = [];
        while (this.startsArg()) {
          if (this.fieldMode && this.peek().nl && this.peek().kind === 'ident' && this.peekAt(1).text === ':') break;
          args.push(this.argument());
        }
        if (args.length === 0) break;
        if (lastWasApp && left.k === 'app') left = { k: 'app', fn: left.fn, args: [...left.args, ...args], span: this.span(from) };
        else left = { k: 'app', fn: left, args, span: this.span(from) };
        lastWasApp = true;
        continue;
      }
      break;
    }
    return left;
  }

  private startsArg(): boolean {
    const t = this.peek();
    if (t.kind === 'eof') return false;
    if (t.kind === 'ident' || t.kind === 'num' || t.kind === 'dotIdent' || t.kind === 'hole') return true;
    if (t.kind === 'kw') return ['Prop', 'Type', 'Sort', 'sorry', 'fun', 'nomatch'].includes(t.text);
    if (t.kind === 'sym') {
      if (this.infix.has(t.text)) return false;
      if (this.prefix.has(t.text)) return true;
      return ['(', '⟨', '_', '@', '*', '□', 'λ'].includes(t.text);
    }
    return false;
  }

  private argument(): SArg {
    // named argument (x := e)
    if (this.is('(') && this.peekAt(1).kind === 'ident' && this.peekAt(2).text === ':=') {
      this.next();
      const nm = this.next().text;
      this.next();
      const arg = this.term();
      this.lastEnd = this.expect(')').to;
      return { named: nm, arg };
    }
    const t = this.peek();
    if ((t.kind === 'kw' && t.text === 'fun') || (t.kind === 'sym' && t.text === 'λ')) return { arg: this.leading() };
    if (t.kind === 'kw' && (t.text === 'Type' || t.text === 'Sort')) {
      // as an argument, `Type` does not take a level
      const tok = this.nextTracked();
      if (t.text === 'Sort') throw new ParseError('write (Sort u) in parentheses when used as an argument', { from: tok.from, to: tok.to });
      return { arg: { k: 'sort', sort: 'Type', span: { from: tok.from, to: tok.to } } };
    }
    return { arg: this.atom() };
  }

  private leading(): STerm {
    const t = this.peek();
    const from = t.from;
    if ((t.kind === 'kw' && t.text === 'fun') || (t.kind === 'sym' && t.text === 'λ')) {
      this.next();
      const binders = this.binders(true);
      if (binders.length === 0) throw new ParseError('expected binders after λ', { from: t.from, to: t.to });
      if (this.accept(':')) {
        const ty = this.term();
        for (const b of binders) if (!b.type) b.type = ty;
      }
      if (!this.accept('=>') && !this.accept('↦')) this.expect('=>');
      const body = this.term();
      return { k: 'lam', binders, body, span: this.span(from) };
    }
    if (t.kind === 'sym' && (t.text === '∀' || t.text === 'Π')) {
      this.next();
      const binders = this.quantBinders();
      this.expect(',');
      const body = this.term();
      return { k: 'pi', binders, body, style: t.text === '∀' ? 'forall' : 'pi', span: this.span(from) };
    }
    if (t.kind === 'sym' && t.text === '∃') {
      this.next();
      const binders = this.quantBinders();
      this.expect(',');
      const body = this.term();
      return { k: 'exists', binders, body, span: this.span(from) };
    }
    if (t.kind === 'kw' && t.text === 'let') {
      this.next();
      const nm = this.ident('a name');
      const binders = this.binders(false);
      let type: STerm | undefined;
      if (this.accept(':')) type = this.term();
      this.expect(':=');
      const value = this.term();
      if (!this.accept(';') && !this.accept('in') && !this.peek().nl) this.expect(';');
      const body = this.term();
      return { k: 'let', name: nm.text, nameSpan: { from: nm.from, to: nm.to }, binders, type, value, body, span: this.span(from) };
    }
    if (t.kind === 'kw' && t.text === 'show') {
      this.next();
      const type = this.term();
      if (!this.accept('from')) this.expect(':=');
      const term = this.term();
      return { k: 'show', type, term, span: this.span(from) };
    }
    if (t.kind === 'kw' && t.text === 'nomatch') {
      this.next();
      const discrs = [this.term()];
      while (this.accept(',')) discrs.push(this.term());
      return { k: 'match', discrs, alts: [], span: this.span(from) };
    }
    if (t.kind === 'kw' && t.text === 'match') {
      this.next();
      let motive: STerm | undefined;
      if (this.is('(') && this.peekAt(1).text === 'motive' && this.peekAt(2).text === ':=') {
        this.next();
        this.next();
        this.next();
        motive = this.term();
        this.expect(')');
      }
      const discrs = [this.term()];
      while (this.accept(',')) discrs.push(this.term());
      this.expect('with');
      const alts = this.alts();
      if (alts.length === 0) throw new ParseError('expected at least one alternative `| pattern => term`', this.span(from));
      return { k: 'match', discrs, motive, alts, span: this.span(from) };
    }
    if (t.kind === 'kw' && (t.text === 'Type' || t.text === 'Sort')) {
      this.nextTracked();
      let level: SLevel | undefined;
      if (this.startsLevel()) level = this.levelAtom();
      if (t.text === 'Sort' && !level) throw new ParseError('Sort expects a universe level', { from: t.from, to: t.to });
      return { k: 'sort', sort: t.text as 'Type' | 'Sort', level, span: this.span(from) };
    }
    if (t.kind === 'sym' && this.prefix.has(t.text)) {
      const n = this.prefix.get(t.text)!;
      const opTok = this.next();
      const arg = this.term(n.prec === APP_PREC ? APP_PREC : n.prec);
      const fn: STerm = { k: 'ident', name: n.target, explicit: false, span: { from: opTok.from, to: opTok.to } };
      return { k: 'app', fn, args: [{ arg }], span: this.span(from) };
    }
    // dependent arrow  (x : A) → B
    if (t.kind === 'sym' && (t.text === '(' || t.text === '{' || t.text === '⦃' || t.text === '[')) {
      const saved = this.pos;
      const savedErrs = this.errors.length;
      try {
        const binders = this.binders(false);
        if (binders.length > 0 && binders.every((b) => b.type) && (this.is('→') || this.is('->'))) {
          this.next();
          const body = this.term(ARROW_PREC);
          return { k: 'pi', binders, body, style: 'arrow', span: this.span(from) };
        }
      } catch (e) {
        if (!(e instanceof ParseError)) throw e;
      }
      this.pos = saved;
      this.errors.length = savedErrs;
    }
    return this.atom();
  }

  private quantBinders(): SBinder[] {
    const t = this.peek();
    if (t.kind === 'ident' || (t.kind === 'sym' && t.text === '_')) {
      // ∀ x y : A, …   or   ∀ x y, …
      const from = t.from;
      const names: { name: string; span: Span }[] = [];
      while (this.peek().kind === 'ident' || this.is('_')) {
        const n = this.next();
        names.push({ name: n.text, span: { from: n.from, to: n.to } });
      }
      let type: STerm | undefined;
      if (this.accept(':')) type = this.term();
      const bs: SBinder[] = [{ names, type, binfo: 'default', span: this.span(from) }];
      return bs;
    }
    const bs = this.binders(true);
    if (bs.length === 0) throw new ParseError('expected binders', { from: t.from, to: t.to });
    return bs;
  }

  private atom(): STerm {
    const t = this.peek();
    const from = t.from;
    let result: STerm;
    switch (t.kind) {
      case 'ident': {
        this.nextTracked();
        let levels: SLevel[] | undefined;
        if (this.is('.{') && this.peek().from === t.to) {
          this.next();
          levels = [];
          do levels.push(this.level());
          while (this.accept(','));
          this.lastEnd = this.expect('}').to;
        }
        result = { k: 'ident', name: t.text, levels, explicit: false, span: this.span(from) };
        break;
      }
      case 'dotIdent':
        this.nextTracked();
        result = { k: 'dotIdent', name: t.text, span: { from: t.from, to: t.to } };
        break;
      case 'num':
        this.nextTracked();
        result = { k: 'num', value: Number(t.text), span: { from: t.from, to: t.to } };
        break;
      case 'hole':
        this.nextTracked();
        result = { k: 'synthHole', name: t.text, span: { from: t.from, to: t.to } };
        break;
      case 'kw':
        if (t.text === 'Prop') {
          this.nextTracked();
          result = { k: 'sort', sort: 'Prop', span: { from: t.from, to: t.to } };
          break;
        }
        if (t.text === 'sorry') {
          this.nextTracked();
          result = { k: 'sorry', span: { from: t.from, to: t.to } };
          break;
        }
        if (t.text === 'Type' || t.text === 'Sort' || t.text === 'fun' || t.text === 'let' || t.text === 'match' || t.text === 'show' || t.text === 'nomatch') {
          result = this.leading();
          break;
        }
        throw new ParseError(`unexpected keyword '${t.text}'`, { from: t.from, to: t.to });
      case 'sym':
        if (t.text === '(') {
          this.next();
          if (this.is(')')) throw new ParseError('empty parentheses', { from, to: this.peek().to });
          const inner = this.term();
          if (this.accept(':')) {
            const ty = this.term();
            this.lastEnd = this.expect(')').to;
            result = { k: 'ascribe', term: inner, type: ty, span: this.span(from) };
            break;
          }
          this.lastEnd = this.expect(')', 'to close the parenthesis').to;
          result = { k: 'paren', term: inner, span: this.span(from) };
          break;
        }
        if (t.text === '⟨') {
          this.next();
          const args: STerm[] = [];
          if (!this.is('⟩')) {
            args.push(this.term());
            while (this.accept(',')) args.push(this.term());
          }
          this.lastEnd = this.expect('⟩').to;
          result = { k: 'anon', args, span: this.span(from) };
          break;
        }
        if (t.text === '_') {
          this.nextTracked();
          result = { k: 'hole', span: { from: t.from, to: t.to } };
          break;
        }
        if (t.text === '@') {
          this.next();
          const id = this.ident();
          this.lastEnd = id.to;
          let levels: SLevel[] | undefined;
          if (this.is('.{') && this.peek().from === id.to) {
            this.next();
            levels = [];
            do levels.push(this.level());
            while (this.accept(','));
            this.lastEnd = this.expect('}').to;
          }
          result = { k: 'ident', name: id.text, levels, explicit: true, span: this.span(from) };
          break;
        }
        if (t.text === '*') {
          this.nextTracked();
          result = { k: 'sort', sort: 'star', span: { from: t.from, to: t.to } };
          break;
        }
        if (t.text === '□') {
          this.nextTracked();
          result = { k: 'sort', sort: 'box', span: { from: t.from, to: t.to } };
          break;
        }
        if (t.text === 'λ' || t.text === '∀' || t.text === 'Π' || t.text === '∃' || this.prefix.has(t.text)) {
          result = this.leading();
          break;
        }
        throw new ParseError(`unexpected ${describe(t)}`, { from: t.from, to: Math.max(t.to, t.from + 1) });
      default:
        throw new ParseError(`unexpected ${describe(t)}`, { from: t.from, to: Math.max(t.to, t.from + 1) });
    }
    // postfix projection: (e).field  — only directly adjacent
    for (;;) {
      const p = this.peek();
      if (p.kind === 'sym' && p.text === '.' && p.from === this.lastEnd) {
        const f = this.peekAt(1);
        if ((f.kind === 'ident' || f.kind === 'num') && f.from === p.to) {
          this.next();
          this.nextTracked();
          result = { k: 'proj', term: result, field: f.text, fieldSpan: { from: f.from, to: f.to }, span: this.span(from) };
          continue;
        }
      }
      if (p.kind === 'dotIdent' && p.from === this.lastEnd) {
        this.nextTracked();
        result = { k: 'proj', term: result, field: p.text, fieldSpan: { from: p.from + 1, to: p.to }, span: this.span(from) };
        continue;
      }
      break;
    }
    return result;
  }

  // -------------------------------------------------------------------------
  // universe levels

  private startsLevel(): boolean {
    const t = this.peek();
    if (t.nl) return false;
    return t.kind === 'num' || (t.kind === 'ident' && t.text !== 'max' && t.text !== 'imax' ? /^[a-zα-ω]/.test(t.text) && t.text.length <= 3 : false) || (t.kind === 'sym' && (t.text === '_' || t.text === '('));
  }

  private levelAtom(): SLevel {
    const t = this.peek();
    if (t.kind === 'num') {
      this.nextTracked();
      return { k: 'num', n: Number(t.text) };
    }
    if (t.kind === 'sym' && t.text === '_') {
      this.nextTracked();
      return { k: 'hole' };
    }
    if (t.kind === 'sym' && t.text === '(') {
      this.next();
      const l = this.level();
      this.lastEnd = this.expect(')').to;
      return l;
    }
    if (t.kind === 'ident') {
      this.nextTracked();
      return { k: 'param', name: t.text };
    }
    throw new ParseError('expected a universe level', { from: t.from, to: t.to });
  }

  private level(): SLevel {
    const t = this.peek();
    let l: SLevel;
    if (t.kind === 'ident' && (t.text === 'max' || t.text === 'imax')) {
      this.next();
      const args: SLevel[] = [];
      while (this.peek().kind === 'num' || this.peek().kind === 'ident' || this.is('(') || this.is('_')) args.push(this.levelAtom());
      if (args.length < 2) throw new ParseError(`${t.text} expects at least two levels`, { from: t.from, to: t.to });
      l = { k: t.text as 'max' | 'imax', args };
    } else l = this.levelAtom();
    while (this.peek().kind === 'sym' && this.peek().text === '+') {
      this.next();
      const n = this.next();
      if (n.kind !== 'num') throw new ParseError('expected a number after + in a universe level', { from: n.from, to: n.to });
      this.lastEnd = n.to;
      l = { k: 'succ', l, n: Number(n.text) };
    }
    return l;
  }
}

function describe(t: Token): string {
  if (t.kind === 'eof') return 'end of input';
  return `'${t.text}'`;
}
