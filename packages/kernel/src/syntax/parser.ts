// Recursive-descent / Pratt parser for the surface language.
//
// The notation table is extensible (`infixl:65 " + " => Nat.add`), so the
// parser works one command at a time: `nextCommand()` parses a single command
// and the caller may register new notations before asking for the next one.

import type { Command, Location, RPat, RwRule, SAlt, SArg, SBinder, SCalcStep, SCtor, SimpArg, SInductive, SLevel, STerm, Span, TacAlt, Tactic } from './ast.ts';
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
  /**
   * Layout: inside a tactic block, a token that starts a new line at a column
   * ≤ the top of this stack ends the current tactic (and the terms inside it).
   * −1 suspends the rule (inside brackets).
   */
  private layout: number[] = [];
  /** identifiers that end a term inside a tactic (`at`, `generalizing`, …) */
  private stopIdents = new Set<string>();
  /** inside `calc`, a new line starting with `_` begins the next step */
  private calcDepth = 0;
  /** columns of the `|` of the alternatives being parsed (innermost last) */
  private altCols: number[] = [];

  /** may this `|` begin (or continue) a list of alternatives whose first `|` was `first`? */
  private altAllowed(first: Token | undefined): boolean {
    const t = this.peek();
    if (!(t.kind === 'sym' && t.text === '|')) return false;
    if (!t.nl) return true;
    if (first) return first.nl ? t.col === first.col : t.col > (this.altCols.length ? this.altCols[this.altCols.length - 1] : -1);
    // the first alternative on its own line: right of the enclosing alternative, or not left of the block
    if (this.altCols.length) return t.col > this.altCols[this.altCols.length - 1];
    const c = this.curLayout();
    return c < 0 || t.col >= c;
  }

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

  /** does the next token end the current tactic because of the layout rule? */
  private atLayoutEnd(t: Token = this.peek()): boolean {
    if (this.layout.length === 0) return false;
    const c = this.layout[this.layout.length - 1];
    if (c < 0) return false;
    return t.kind === 'eof' || (t.nl && t.col <= c);
  }

  /** inside brackets, the tactic stop words are ordinary identifiers again */
  private inBrackets<T>(f: () => T): T {
    const saved = this.stopIdents;
    this.stopIdents = new Set();
    try {
      return f();
    } finally {
      this.stopIdents = saved;
    }
  }

  private withLayout<T>(col: number, f: () => T): T {
    this.layout.push(col);
    try {
      return f();
    } finally {
      this.layout.pop();
    }
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
      let attrs: string[] | undefined;
      if (this.is('@[')) {
        this.next();
        attrs = [];
        do attrs.push(this.ident('an attribute name').text);
        while (this.accept(','));
        this.expect(']');
        this.allowDoc = true;
        while (this.peek().kind === 'doc') {
          doc = this.peek().text;
          this.pos = this.peek().to;
        }
        this.allowDoc = false;
      }
      const c = this.command();
      c.doc = doc;
      if (attrs) c.attrs = attrs;
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
      case 'instance': {
        const kwTok = this.nextTracked();
        let name: string | undefined;
        let nameSpan: Span = { from: kwTok.from, to: kwTok.to };
        if (this.peek().kind === 'ident') {
          const nm = this.next();
          name = nm.text;
          nameSpan = { from: nm.from, to: nm.to };
        }
        const binders = this.binders(false);
        this.expect(':');
        const type = this.term();
        this.expect(':=');
        const body = this.term();
        return { k: 'instance', name, nameSpan, binders, type, body, span: this.span(from) };
      }
      case 'class': {
        this.nextTracked();
        if (this.is('inductive')) {
          const ind = this.inductive();
          return { k: 'inductive', types: [ind], isClass: true, span: this.span(from) };
        }
        const st = this.structure(true) as Extract<Command, { k: 'structure' }>;
        st.isClass = true;
        st.span = this.span(from);
        return st;
      }
      case 'attribute': {
        this.nextTracked();
        this.expect('[');
        const attrs: string[] = [];
        do attrs.push(this.ident('an attribute name').text);
        while (this.accept(','));
        this.expect(']');
        const names: { name: string; span: Span }[] = [];
        while (this.peek().kind === 'ident' && !this.peek().nl) {
          const n = this.nextTracked();
          names.push({ name: n.text, span: { from: n.from, to: n.to } });
        }
        return { k: 'attribute', attrs, names, span: this.span(from) };
      }
      case '#test':
        this.nextTracked();
        return { k: 'test', term: this.term(), span: this.span(from) };
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
      const termination = this.terminationHints();
      return { k: 'def', kind, name, nameSpan, levelParams, binders, type, body: { k: 'equations', alts }, termination, span: this.span(from) };
    }
    this.expect(':=', type ? 'or equations after the type' : 'after the signature');
    const term = this.term();
    const termination = this.terminationHints();
    return { k: 'def', kind, name, nameSpan, levelParams, binders, type, body: { k: 'term', term }, termination, span: this.span(from) };
  }

  private terminationHints(): { by?: STerm; names?: { name: string; span: Span }[]; decreasing?: Tactic } | undefined {
    let r: { by?: STerm; names?: { name: string; span: Span }[]; decreasing?: Tactic } | undefined;
    if (this.accept('termination_by')) {
      // `termination_by x y => e` names the arguments matched by the equations
      let k = 0;
      while (this.peekAt(k).kind === 'ident' || (this.peekAt(k).kind === 'sym' && this.peekAt(k).text === '_')) k++;
      let names: { name: string; span: Span }[] | undefined;
      if (k > 0 && this.peekAt(k).kind === 'sym' && this.peekAt(k).text === '=>') {
        names = [];
        for (let i = 0; i < k; i++) {
          const t = this.next();
          names.push({ name: t.text, span: { from: t.from, to: t.to } });
        }
        this.next();
      }
      r = { by: this.term(), names };
    }
    if (this.is('decreasing_by')) {
      this.next();
      r = { ...r, decreasing: this.tacticBlock() };
    }
    return r;
  }

  private alts(): SAlt[] {
    const alts: SAlt[] = [];
    // alternatives on their own lines are aligned with the first one; a nested match ends at a
    // `|` to its left
    let first: Token | undefined;
    while (this.altAllowed(first)) {
      const bar = this.peek();
      first ??= bar;
      const from = this.next().from;
      // `| p₁ | p₂ => rhs` shares one right-hand side between several patterns
      const groups: STerm[][] = [];
      for (;;) {
        const pats: STerm[] = [this.term()];
        while (this.accept(',')) pats.push(this.term());
        groups.push(pats);
        if (!this.accept('|')) break;
      }
      this.expect('=>');
      this.altCols.push(bar.col);
      let rhs: STerm;
      try {
        rhs = this.term();
      } finally {
        this.altCols.pop();
      }
      for (const pats of groups) alts.push({ pats, rhs, span: this.span(from) });
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
    const deriving = this.derivingClause();
    return { name: nm.text, nameSpan: { from: nm.from, to: nm.to }, levelParams, binders, type, ctors, deriving, span: this.span(from) };
  }

  private derivingClause(): string[] | undefined {
    if (!this.accept('deriving')) return undefined;
    const names: string[] = [];
    do {
      const t = this.ident('a class name');
      names.push(t.text);
      this.lastEnd = t.to;
    } while (this.accept(','));
    return names;
  }

  private structure(isClass = false): Command {
    const from = isClass ? this.peek().from : this.nextTracked().from;
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
    const deriving = this.derivingClause();
    return { k: 'structure', name: nm.text, nameSpan: { from: nm.from, to: nm.to }, levelParams, binders, type, ctorName, fields, deriving, span: this.span(from) };
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
        if (!this.looksLikeBinderGroup(close)) {
          if (close !== ']') break;
          // an anonymous instance binder `[C α]`
          const from = this.next().from;
          const type = this.inBrackets(() => this.term());
          this.lastEnd = this.expect(']').to;
          out.push({ names: [{ name: 'inst✝', span: { from, to: from } }], type, binfo: 'inst', span: this.span(from) });
          continue;
        }
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
      if (t.kind === 'sym' && t.text === close && close !== ')' && close !== ']') return true;
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
      if (this.atLayoutEnd(t)) break;
      if (this.calcDepth > 0 && t.nl && t.kind === 'sym' && t.text === '_') break;
      if (this.fieldMode && t.nl && t.kind === 'ident' && this.peekAt(1).text === ':') break;
      if (t.kind === 'sym' && t.text === '▸') {
        if (prec > 75) break;
        this.next();
        const rhs = this.term(75);
        left = { k: 'subst', eq: left, term: rhs, span: this.span(from) };
        lastWasApp = false;
        continue;
      }
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
        const fn: STerm = { k: 'ident', name: n.target, explicit: false, root: true, span: { from: opTok.from, to: opTok.to } };
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
    if (this.atLayoutEnd(t)) return false;
    if (t.kind === 'ident' && this.stopIdents.has(t.text)) return false;
    if (this.calcDepth > 0 && t.nl && t.kind === 'sym' && t.text === '_') return false;
    if (t.kind === 'ident' || t.kind === 'num' || t.kind === 'dotIdent' || t.kind === 'hole') return true;
    if (t.kind === 'kw') return ['Prop', 'Type', 'Sort', 'sorry', 'fun', 'nomatch'].includes(t.text);
    if (t.kind === 'sym') {
      if (this.infix.has(t.text)) return false;
      if (this.prefix.has(t.text)) return true;
      if (t.text === '·') return !t.nl;
      if (t.text === '{') return this.isStructInstOrSubtype();
      return ['(', '⟨', '[', '_', '@', '*', '□', 'λ'].includes(t.text);
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
      // fun | pat => e | …   ⟶   fun x => match x with …
      if (this.is('|')) {
        const alts = this.alts();
        const n = alts[0].pats.length;
        const names = Array.from({ length: n }, (_, i) => `x✝${i + 1}`);
        const sp = this.span(from);
        return {
          k: 'lam',
          binders: names.map((name) => ({ names: [{ name, span: sp }], binfo: 'default' as const, span: sp })),
          body: { k: 'match', discrs: names.map((name) => ({ k: 'ident' as const, name, explicit: false, span: sp })), alts, span: sp },
          span: sp,
        };
      }
      // fun ⟨a, b⟩ x => e   ⟶   fun y x => match y with | ⟨a, b⟩ => e
      if (this.is('⟨') || (this.peek().kind === 'ident' && this.hasPatternBinderAhead())) {
        const pats: STerm[] = [];
        while (!this.is('=>') && !this.is('↦') && this.peek().kind !== 'eof') {
          if (this.is('⟨')) pats.push(this.atom());
          else if (this.peek().kind === 'ident' || this.is('_')) {
            const tk = this.next();
            pats.push(tk.text === '_' ? { k: 'hole', span: { from: tk.from, to: tk.to } } : { k: 'ident', name: tk.text, explicit: false, span: { from: tk.from, to: tk.to } });
          } else throw new ParseError(`expected a pattern, found ${describe(this.peek())}`, { from: this.peek().from, to: this.peek().to });
        }
        if (!this.accept('=>') && !this.accept('↦')) this.expect('=>');
        const body = this.term();
        const sp = this.span(from);
        const names = pats.map((p, i) => (p.k === 'ident' ? p.name : `x✝${i + 1}`));
        const matched = pats.map((p, i) => ({ p, name: names[i] })).filter((x) => x.p.k !== 'ident');
        return {
          k: 'lam',
          binders: names.map((name, i) => ({ names: [{ name, span: pats[i].span }], binfo: 'default' as const, span: pats[i].span })),
          body: matched.length === 0 ? body : { k: 'match', discrs: matched.map((m) => ({ k: 'ident' as const, name: m.name, explicit: false, span: sp })), alts: [{ pats: matched.map((m) => m.p), rhs: body, span: sp }], span: sp },
          span: sp,
        };
      }
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
    if (t.kind === 'kw' && (t.text === 'let' || t.text === 'have') && this.peekAt(1).kind === 'sym' && this.peekAt(1).text === '⟨') {
      // let ⟨x, hx⟩ := v; body   ⟶   match v with | ⟨x, hx⟩ => body
      this.next();
      const pat = this.atom();
      let type: STerm | undefined;
      if (this.accept(':')) type = this.term();
      this.expect(':=');
      let value = this.withLayout(t.col, () => this.term());
      if (type) value = { k: 'ascribe', term: value, type, span: value.span };
      if (!this.accept(';') && !this.accept('in') && !this.peek().nl) this.expect(';');
      const body = this.term();
      const sp = this.span(from);
      return { k: 'match', discrs: [value], alts: [{ pats: [pat], rhs: body, span: sp }], span: sp };
    }
    if (t.kind === 'kw' && t.text === 'let') {
      this.next();
      const nm = this.ident('a name');
      const binders = this.binders(false);
      let type: STerm | undefined;
      if (this.accept(':')) type = this.term();
      this.expect(':=');
      // the value ends at a new line that is not indented past the `let`
      const value = this.withLayout(t.col, () => this.term());
      if (!this.accept(';') && !this.accept('in') && !this.peek().nl) this.expect(';');
      const body = this.term();
      return { k: 'let', name: nm.text, nameSpan: { from: nm.from, to: nm.to }, binders, type, value, body, span: this.span(from) };
    }
    if (t.kind === 'kw' && t.text === 'show') {
      this.next();
      const type = this.term();
      if (this.is('by')) {
        const term = this.leading();
        return { k: 'show', type, term, span: this.span(from) };
      }
      if (!this.accept('from')) this.expect(':=');
      const term = this.term();
      return { k: 'show', type, term, span: this.span(from) };
    }
    if (t.kind === 'kw' && t.text === 'by') {
      this.next();
      const tac = this.tacticBlock();
      return { k: 'by', tac, span: this.span(from) };
    }
    if (t.kind === 'kw' && t.text === 'if') {
      this.next();
      let name: string | undefined;
      let nameSpan: Span | undefined;
      if (this.peek().kind === 'ident' && this.peekAt(1).text === ':') {
        const nm = this.next();
        name = nm.text;
        nameSpan = { from: nm.from, to: nm.to };
        this.next();
      }
      const cond = this.withLayout(-1, () => this.term());
      this.expect('then');
      const th = this.withLayout(-1, () => this.term());
      this.expect('else');
      const el = this.term();
      return { k: 'if', name, nameSpan, cond, then: th, else: el, span: this.span(from) };
    }
    if (t.kind === 'kw' && t.text === 'have') {
      this.next();
      let name = 'this';
      let nameSpan: Span = { from: t.from, to: t.to };
      if (this.peek().kind === 'ident') {
        const nm = this.next();
        name = nm.text;
        nameSpan = { from: nm.from, to: nm.to };
      }
      const binders = this.binders(false);
      let type: STerm | undefined;
      if (this.accept(':')) type = this.term();
      this.expect(':=');
      const value = this.withLayout(t.col, () => this.term());
      if (!this.accept(';') && !this.accept('in') && !this.peek().nl) this.expect(';');
      const body = this.term();
      return { k: 'have', name, nameSpan, binders, type, value, body, span: this.span(from) };
    }
    if (t.kind === 'kw' && t.text === 'calc') {
      this.next();
      return { k: 'calc', steps: this.calcSteps(), span: this.span(from) };
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
      const discrs: STerm[] = [];
      const discrNames: (string | undefined)[] = [];
      do {
        // `h : e` remembers the equation e = pattern in each alternative
        if (this.peek().kind === 'ident' && this.peekAt(1).text === ':') {
          discrNames.push(this.next().text);
          this.next();
        } else discrNames.push(undefined);
        discrs.push(this.term());
      } while (this.accept(','));
      this.expect('with');
      const alts = this.alts();
      if (alts.length === 0) throw new ParseError('expected at least one alternative `| pattern => term`', this.span(from));
      return { k: 'match', discrs, motive, alts, span: this.span(from), ...(discrNames.some((n) => n) ? { discrNames } : {}) };
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
      const fn: STerm = { k: 'ident', name: n.target, explicit: false, root: true, span: { from: opTok.from, to: opTok.to } };
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

  /** `{ x := …` (structure instance) or `{ x // …` / `{ x : α // …` (subtype) */
  private isStructInstOrSubtype(): boolean {
    const a = this.peekAt(1);
    const b = this.peekAt(2);
    if (a.kind === 'sym' && a.text === '}') return false;
    if (a.kind !== 'ident') return false;
    if (b.kind === 'sym' && (b.text === ':=' || b.text === '//')) return true;
    if (b.kind === 'sym' && b.text === ':') {
      // scan to the matching close brace for '//'
      let depth = 0;
      for (let i = 3; i < 200; i++) {
        const t = this.peekAt(i);
        if (t.kind === 'eof') return false;
        if (t.kind === 'sym' && (t.text === '(' || t.text === '{' || t.text === '[' || t.text === '⟨')) depth++;
        if (t.kind === 'sym' && (t.text === ')' || t.text === '}' || t.text === ']' || t.text === '⟩')) {
          if (depth === 0) return false;
          depth--;
        }
        if (depth === 0 && t.kind === 'sym' && t.text === '//') return true;
      }
    }
    return false;
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
          result = this.withLayout(-1, (): STerm => {
            const inner = this.inBrackets(() => this.term());
            if (this.is(',')) {
              // a tuple (a, b, c) = Prod.mk a (Prod.mk b c)
              const items = [inner];
              while (this.accept(',')) items.push(this.inBrackets(() => this.term()));
              this.lastEnd = this.expect(')').to;
              const sp = this.span(from);
              let r = items[items.length - 1];
              for (let i = items.length - 2; i >= 0; i--) r = { k: 'app', fn: { k: 'ident', name: 'Prod.mk', explicit: false, span: sp }, args: [{ arg: items[i] }, { arg: r }], span: sp };
              return { ...r, span: sp };
            }
            if (this.accept(':')) {
              const ty = this.inBrackets(() => this.term());
              this.lastEnd = this.expect(')').to;
              return { k: 'ascribe', term: inner, type: ty, span: this.span(from) };
            }
            this.lastEnd = this.expect(')', 'to close the parenthesis').to;
            // `(· + 1)` is `fun x => x + 1`
            const sp = this.span(from);
            const names: { name: string; span: Span }[] = [];
            const body = replaceCdots(inner, (span) => {
              const name = `x✝${names.length + 1}`;
              names.push({ name, span });
              return { k: 'ident', name, explicit: false, span };
            });
            if (names.length) return { k: 'lam', binders: [{ names, binfo: 'default', span: sp }], body, span: sp };
            return { k: 'paren', term: inner, span: sp };
          });
          break;
        }
        if (t.text === '⟨') {
          this.next();
          const args: STerm[] = [];
          this.withLayout(-1, () =>
            this.inBrackets(() => {
              if (!this.is('⟩')) {
                args.push(this.term());
                while (this.accept(',')) args.push(this.term());
              }
            }),
          );
          this.lastEnd = this.expect('⟩').to;
          result = { k: 'anon', args, span: this.span(from) };
          break;
        }
        if (t.text === '{' && this.isStructInstOrSubtype()) {
          this.next();
          result = this.withLayout(-1, (): STerm =>
            this.inBrackets((): STerm => {
              if (this.peekAt(1).kind === 'sym' && this.peekAt(1).text === ':=') {
                // structure instance  { x := 1, y := 2 }
                const fields: { name: string; nameSpan: Span; value: STerm }[] = [];
                do {
                  if (this.is('}')) break;
                  const id = this.ident();
                  this.expect(':=');
                  fields.push({ name: id.text, nameSpan: { from: id.from, to: id.to }, value: this.term() });
                } while (this.accept(','));
                this.lastEnd = this.expect('}').to;
                return { k: 'structInst', fields, span: this.span(from) };
              }
              // subtype  { x // p }  or  { x : α // p }
              const id = this.ident();
              let type: STerm | undefined;
              if (this.accept(':')) type = this.term();
              this.expect('//');
              const body = this.term();
              this.lastEnd = this.expect('}').to;
              const sp = this.span(from);
              const lam: STerm = { k: 'lam', binders: [{ names: [{ name: id.text, span: { from: id.from, to: id.to } }], type, binfo: 'default', span: { from: id.from, to: id.to } }], body, span: sp };
              return { k: 'app', fn: { k: 'ident', name: 'Subtype', explicit: false, span: sp }, args: [{ arg: lam }], span: sp };
            }),
          );
          break;
        }
        if (t.text === '[') {
          // list literal  [a, b, c]
          this.next();
          const elems: STerm[] = [];
          this.withLayout(-1, () =>
            this.inBrackets(() => {
              if (!this.is(']')) {
                elems.push(this.term());
                while (this.accept(',')) elems.push(this.term());
              }
            }),
          );
          const close = this.expect(']');
          this.lastEnd = close.to;
          const sp = this.span(from);
          let r: STerm = { k: 'ident', name: 'List.nil', explicit: false, span: { from: close.from, to: close.to } };
          for (let i = elems.length - 1; i >= 0; i--) {
            r = { k: 'app', fn: { k: 'ident', name: 'List.cons', explicit: false, span: sp }, args: [{ arg: elems[i] }, { arg: r }], span: { from: elems[i].span.from, to: sp.to } };
          }
          result = { ...r, span: sp };
          break;
        }
        if (t.text === '_') {
          this.nextTracked();
          result = { k: 'hole', span: { from: t.from, to: t.to } };
          break;
        }
        if (t.text === '·') {
          this.nextTracked();
          result = { k: 'ident', name: '·', explicit: false, span: { from: t.from, to: t.to } };
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
  // calc

  private calcSteps(): SCalcStep[] {
    const steps: SCalcStep[] = [];
    this.calcDepth++;
    try {
      for (;;) {
        const from = this.peek().from;
        const rel = this.term();
        this.expect(':=', 'after the calc step (write `_ = b := proof`)');
        const proof = this.term();
        steps.push({ rel, proof, span: this.span(from) });
        const t = this.peek();
        if (t.nl && t.kind === 'sym' && t.text === '_' && !this.atLayoutEnd(t)) continue;
        break;
      }
    } finally {
      this.calcDepth--;
    }
    return steps;
  }

  private hasPatternBinderAhead(): boolean {
    for (let i = 0; i < 64; i++) {
      const t = this.peekAt(i);
      if (t.kind === 'eof') return false;
      if (t.kind === 'sym' && (t.text === '=>' || t.text === '↦' || t.text === ':' || t.text === '(' || t.text === '{')) return false;
      if (t.kind === 'sym' && t.text === '⟨') return true;
    }
    return false;
  }

  // -------------------------------------------------------------------------
  // tactics

  private curLayout(): number {
    return this.layout.length ? this.layout[this.layout.length - 1] : -1;
  }

  /** a tactic sequence whose column is that of its first tactic */
  tacticBlock(): Tactic {
    const first = this.peek();
    if (first.kind === 'eof' || this.atLayoutEnd(first) || (first.kind === 'kw' && COMMAND_KEYWORDS.has(first.text) && first.nl)) {
      throw new ParseError('expected a tactic', { from: first.from, to: Math.max(first.to, first.from + 1) });
    }
    const col = first.col;
    const savedStop = this.stopIdents;
    this.stopIdents = new Set(['at', 'generalizing', 'using']);
    try {
      return this.withLayout(col, () => this.tacticSeqAt(col));
    } finally {
      this.stopIdents = savedStop;
    }
  }

  private tacticSeqAt(col: number): Tactic {
    const from = this.peek().from;
    const tacs: Tactic[] = [];
    for (;;) {
      tacs.push(this.tacticRecovering(col));
      if (this.accept(';')) {
        if (this.atLayoutEnd() || this.peek().kind === 'eof' || this.is(')')) break;
        continue;
      }
      const t = this.peek();
      if (t.kind !== 'eof' && t.nl && t.col === col && !(t.kind === 'kw' && COMMAND_KEYWORDS.has(t.text)) && !this.is('|')) continue;
      break;
    }
    return tacs.length === 1 ? tacs[0] : { k: 'seq', tacs, span: this.span(from) };
  }

  private tacticRecovering(col: number): Tactic {
    const start = this.peek();
    try {
      return this.tactic();
    } catch (e) {
      if (!(e instanceof ParseError)) throw e;
      this.errors.push({ message: e.message, span: e.span });
      // skip to the next tactic of this block
      if (this.pos <= start.from) this.next();
      for (;;) {
        const t = this.peek();
        if (t.kind === 'eof' || (t.nl && t.col <= col)) break;
        this.next();
      }
      return { k: 'error', span: { from: start.from, to: this.lastEnd } };
    }
  }

  private tactic(): Tactic {
    const from = this.peek().from;
    let t = this.tactic1();
    while (this.is('<;>')) {
      this.next();
      const rest = this.tactic1();
      t = { k: 'then', first: t, rest, span: this.span(from) };
    }
    return t;
  }

  private names(stop: (t: Token) => boolean = () => false): { name: string; span: Span }[] {
    const out: { name: string; span: Span }[] = [];
    for (;;) {
      const t = this.peek();
      if (this.atLayoutEnd(t) || stop(t)) break;
      if (t.kind === 'ident' || (t.kind === 'sym' && t.text === '_')) {
        this.next();
        out.push({ name: t.text, span: { from: t.from, to: t.to } });
        continue;
      }
      break;
    }
    return out;
  }

  private location(): Location {
    if (!(this.peek().kind === 'ident' && this.peek().text === 'at') || this.atLayoutEnd()) return { hyps: [], wildcard: false, goal: true };
    this.next();
    if (this.is('*')) {
      this.lastEnd = this.next().to;
      return { hyps: [], wildcard: true, goal: true };
    }
    const hyps = this.names();
    let goal = false;
    if (this.is('⊢')) {
      this.lastEnd = this.next().to;
      goal = true;
    }
    if (hyps.length === 0 && !goal) throw new ParseError('expected hypothesis names after `at`', this.span(this.peek().from));
    return { hyps, wildcard: false, goal };
  }

  private rpat(): RPat {
    const from = this.peek().from;
    const first = this.rpat1();
    if (!this.is('|')) return first;
    const pats = [first];
    while (this.accept('|')) pats.push(this.rpat1());
    return { k: 'alts', pats, span: this.span(from) };
  }

  private rpat1(): RPat {
    const t = this.peek();
    const sp = { from: t.from, to: t.to };
    if (t.kind === 'ident') {
      this.next();
      this.lastEnd = t.to;
      if (t.text === 'rfl') return { k: 'rfl', span: sp };
      return { k: 'var', name: t.text, span: sp };
    }
    if (this.is('_')) {
      this.lastEnd = this.next().to;
      return { k: 'wild', span: sp };
    }
    if (this.is('⟨')) {
      this.next();
      const pats: RPat[] = [];
      this.withLayout(-1, () => {
        if (!this.is('⟩')) {
          pats.push(this.rpat());
          while (this.accept(',')) pats.push(this.rpat());
        }
      });
      this.lastEnd = this.expect('⟩').to;
      return { k: 'tuple', pats, span: this.span(t.from) };
    }
    if (this.is('(')) {
      this.next();
      const p = this.withLayout(-1, (): RPat => {
        const inner = this.rpat();
        if (this.accept(':')) {
          const type = this.inBrackets(() => this.term());
          return { k: 'typed', pat: inner, type, span: this.span(t.from) };
        }
        return inner;
      });
      this.lastEnd = this.expect(')').to;
      return p;
    }
    throw new ParseError(`expected a pattern, found ${describe(t)}`, { from: t.from, to: Math.max(t.to, t.from + 1) });
  }

  private startsRPat(): boolean {
    const t = this.peek();
    if (this.atLayoutEnd(t)) return false;
    if (t.kind === 'ident') return !this.stopIdents.has(t.text);
    return this.is('_') || this.is('⟨') || this.is('(');
  }

  private tacAlts(): TacAlt[] {
    const alts: TacAlt[] = [];
    let first: Token | undefined;
    while (this.altAllowed(first)) {
      const bar = this.peek();
      first ??= bar;
      const from = this.next().from;
      const ct = this.peek();
      let ctor: string;
      if (ct.kind === 'ident' || ct.kind === 'dotIdent') ctor = this.next().text;
      else if (this.is('_')) {
        this.next();
        ctor = '_';
      } else if (this.is('@')) {
        this.next();
        ctor = this.ident('a constructor name').text;
      } else throw new ParseError(`expected a constructor name, found ${describe(ct)}`, { from: ct.from, to: Math.max(ct.to, ct.from + 1) });
      const names = this.names((t) => t.kind === 'sym' && t.text === '=>');
      this.expect('=>');
      this.altCols.push(bar.col);
      let tac: Tactic;
      try {
        tac = this.tacticBlock();
      } finally {
        this.altCols.pop();
      }
      alts.push({ ctor, names, tac, span: this.span(from) });
    }
    return alts;
  }

  private rwRules(): RwRule[] {
    this.expect('[');
    const rules: RwRule[] = [];
    this.withLayout(-1, () =>
      this.inBrackets(() => {
        if (!this.is(']')) {
          do {
            const rev = !!(this.accept('←') ?? this.accept('<-'));
            rules.push({ rev, term: this.term() });
          } while (this.accept(','));
        }
      }),
    );
    this.lastEnd = this.expect(']').to;
    return rules;
  }

  private simpArgs(): SimpArg[] {
    if (!this.is('[')) return [];
    this.next();
    const args: SimpArg[] = [];
    this.withLayout(-1, () =>
      this.inBrackets(() => {
        if (!this.is(']')) {
          do {
            if (this.is('*')) {
              this.next();
              args.push({ k: 'star' });
            } else if (this.is('-') && this.peekAt(1).kind === 'ident') {
              this.next();
              args.push({ k: 'erase', name: this.next().text });
            } else {
              const rev = !!(this.accept('←') ?? this.accept('<-'));
              args.push({ k: 'term', term: this.term(), rev });
            }
          } while (this.accept(','));
        }
      }),
    );
    this.lastEnd = this.expect(']').to;
    return args;
  }

  private commaTerms(): STerm[] {
    const ts = [this.term()];
    while (this.accept(',')) ts.push(this.term());
    return ts;
  }

  private tactic1(): Tactic {
    const t = this.peek();
    const from = t.from;
    const sp = () => this.span(from);
    if (t.kind === 'sym' && (t.text === '·' || t.text === '.')) {
      this.next();
      return { k: 'focus', tac: this.tacticBlock(), span: sp() };
    }
    if (t.kind === 'sym' && t.text === '(') {
      this.next();
      const inner = this.withLayout(-1, () => {
        const tacs: Tactic[] = [this.tactic()];
        while (this.accept(';')) tacs.push(this.tactic());
        return tacs;
      });
      this.lastEnd = this.expect(')').to;
      return inner.length === 1 ? inner[0] : { k: 'seq', tacs: inner, span: sp() };
    }
    if (t.kind === 'kw') {
      switch (t.text) {
        case 'sorry':
          this.lastEnd = this.next().to;
          return { k: 'atom', name: 'sorry', span: sp() };
        case 'show': {
          this.next();
          return { k: 'term', name: 'show', term: this.term(), span: sp() };
        }
        case 'calc': {
          this.next();
          const steps = this.calcSteps();
          return { k: 'calc', term: { k: 'calc', steps, span: sp() }, span: sp() };
        }
        case 'nomatch': {
          const term = this.leading();
          return { k: 'term', name: 'exact', term, span: sp() };
        }
        case 'have': {
          this.next();
          let name: string | undefined;
          let nameSpan: Span | undefined;
          let pat: RPat | undefined;
          if (this.is('⟨')) pat = this.rpat1();
          else if (this.peek().kind === 'ident') {
            const nm = this.next();
            name = nm.text;
            nameSpan = { from: nm.from, to: nm.to };
          }
          let type: STerm | undefined;
          let value: STerm | undefined;
          if (this.accept(':')) type = this.term();
          if (this.accept(':=')) value = this.term();
          if (!type && !value) throw new ParseError('expected `: type` or `:= proof` after have', sp());
          return { k: 'have', name, nameSpan, type, value, pat, span: sp() };
        }
        case 'exists': {
          this.next();
          return { k: 'exists', terms: this.commaTerms(), span: sp() };
        }
      }
      throw new ParseError(`expected a tactic, found ${describe(t)}`, { from: t.from, to: Math.max(t.to, t.from + 1) });
    }
    if (t.kind !== 'ident') throw new ParseError(`expected a tactic, found ${describe(t)}`, { from: t.from, to: Math.max(t.to, t.from + 1) });
    const name = t.text;
    this.next();
    this.lastEnd = t.to;
    switch (name) {
      case 'intro': {
        const pats: RPat[] = [];
        while (this.startsRPat()) pats.push(this.rpat1());
        return { k: 'intro', pats, span: sp() };
      }
      case 'intros':
        return { k: 'intros', names: this.names(), span: sp() };
      case 'rintro': {
        const pats: RPat[] = [];
        while (this.startsRPat()) pats.push(this.rpat1());
        if (pats.length === 0) throw new ParseError('rintro expects at least one pattern', sp());
        return { k: 'rintro', pats, span: sp() };
      }
      case 'exact':
      case 'apply':
      case 'refine':
      case 'specialize':
        return { k: 'term', name, term: this.term(), span: sp() };
      case 'change': {
        const term = this.term();
        return { k: 'term', name: 'change', term, loc: this.location(), span: sp() };
      }
      case 'exists':
      case 'use':
      case 'exists?':
        return { k: 'exists', terms: this.commaTerms(), span: sp() };
      case 'rfl':
      case 'constructor':
      case 'left':
      case 'right':
      case 'exfalso':
      case 'symm':
      case 'contradiction':
      case 'assumption':
      case 'trivial':
      case 'omega':
      case 'skip':
      case 'done':
      case 'admit':
      case 'split':
      case 'nofun':
      case 'rfl\'':
      case 'ac_rfl':
      case 'simp_arith_rfl':
        return { k: 'atom', name: name === 'admit' ? 'sorry' : name, span: sp() };
      case 'decide':
        return { k: 'decide', span: sp() };
      case 'cases': {
        let hname: string | undefined;
        if (this.peek().kind === 'ident' && this.peekAt(1).text === ':') {
          hname = this.next().text;
          this.next();
        }
        const target = this.term();
        let alts: TacAlt[] | undefined;
        if (this.accept('with')) alts = this.tacAlts();
        return { k: 'cases', target, hname, alts, span: sp() };
      }
      case 'induction': {
        const target = this.term();
        let generalizing: { name: string; span: Span }[] = [];
        if (this.peek().kind === 'ident' && this.peek().text === 'generalizing') {
          this.next();
          generalizing = this.names();
        }
        let alts: TacAlt[] | undefined;
        if (this.accept('with')) alts = this.tacAlts();
        return { k: 'induction', target, generalizing, alts, span: sp() };
      }
      case 'rcases': {
        const target = this.term();
        this.expect('with');
        return { k: 'rcases', target, pat: this.rpat(), span: sp() };
      }
      case 'obtain': {
        const pat = this.rpat();
        let type: STerm | undefined;
        let value: STerm | undefined;
        if (this.accept(':')) type = this.term();
        if (this.accept(':=')) value = this.term();
        return { k: 'obtain', pat, type, value, span: sp() };
      }
      case 'rw':
      case 'rewrite':
      case 'rwa': {
        const rules = this.rwRules();
        return { k: 'rw', rules, loc: this.location(), rfl: name !== 'rewrite', assumption: name === 'rwa', span: sp() };
      }
      case 'simp':
      case 'simp_all':
      case 'dsimp':
      case 'simp_arith': {
        let only = false;
        if (this.peek().kind === 'ident' && this.peek().text === 'only') {
          this.next();
          only = true;
        }
        const args = this.simpArgs();
        const loc = this.location();
        return { k: 'simp', only, args, loc, all: name === 'simp_all', arith: name === 'simp_arith', span: sp() };
      }
      case 'unfold': {
        const names = this.names();
        if (names.length === 0) throw new ParseError('unfold expects the names of definitions', sp());
        return { k: 'unfold', names, loc: this.location(), span: sp() };
      }
      case 'subst':
      case 'revert':
      case 'clear':
      case 'funext': {
        const names = this.names();
        if (names.length === 0 && name !== 'funext') throw new ParseError(`${name} expects names`, sp());
        return { k: 'names', name, names, span: sp() };
      }
      case 'injection': {
        const term = this.term();
        let names: { name: string; span: Span }[] = [];
        if (this.accept('with')) names = this.names();
        return { k: 'injection', term, names, span: sp() };
      }
      case 'by_cases': {
        let hname: string | undefined;
        if (this.peek().kind === 'ident' && this.peekAt(1).text === ':') {
          hname = this.next().text;
          this.next();
        }
        return { k: 'by_cases', name: hname, prop: this.term(), span: sp() };
      }
      case 'generalize': {
        let hname: string | undefined;
        if (this.peek().kind === 'ident' && this.peekAt(1).text === ':') {
          hname = this.next().text;
          this.next();
        }
        const term = this.term(51);
        this.expect('=');
        const v = this.ident('a variable name');
        this.lastEnd = v.to;
        return { k: 'generalize', name: hname, term, var: v.text, span: sp() };
      }
      case 'suffices': {
        let hname: string | undefined;
        if (this.peek().kind === 'ident' && this.peekAt(1).text === ':') {
          hname = this.next().text;
          this.next();
        }
        const type = this.term();
        if (this.accept('from')) return { k: 'suffices', name: hname, type, value: this.term(), span: sp() };
        if (this.is('by')) {
          this.next();
          return { k: 'suffices', name: hname, type, tac: this.tacticBlock(), span: sp() };
        }
        return { k: 'suffices', name: hname, type, span: sp() };
      }
      case 'case': {
        const tg = this.peek();
        if (tg.kind !== 'ident' && !this.is('_')) throw new ParseError('expected a case tag', { from: tg.from, to: tg.to });
        this.next();
        const names = this.names((x) => x.kind === 'sym' && x.text === '=>');
        this.expect('=>');
        return { k: 'case', tag: tg.text, tagSpan: { from: tg.from, to: tg.to }, names, tac: this.tacticBlock(), span: sp() };
      }
      case 'next': {
        const names = this.names((x) => x.kind === 'sym' && x.text === '=>');
        this.expect('=>');
        return { k: 'next', names, tac: this.tacticBlock(), span: sp() };
      }
      case 'all_goals':
      case 'any_goals':
      case 'try':
      case 'repeat':
      case 'focus':
        return { k: 'combinator', name, tac: this.tacticBlock(), span: sp() };
      case 'first': {
        const alts: Tactic[] = [];
        while (this.is('|') && !(this.peek().nl && this.peek().col < this.curLayout())) {
          this.next();
          alts.push(this.tacticBlock());
        }
        if (alts.length === 0) throw new ParseError('first expects alternatives `| tac`', sp());
        return { k: 'first', alts, span: sp() };
      }
    }
    throw new ParseError(`unknown tactic '${name}'`, { from: t.from, to: t.to });
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

/** replace the `·` placeholders of a term (not those inside nested parentheses, already handled) */
function replaceCdots(t: STerm, mk: (span: Span) => STerm): STerm {
  const go = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(go);
    if (x && typeof x === 'object') {
      const o = x as Record<string, unknown>;
      if (o.k === 'ident' && o.name === '·') return mk(o.span as Span);
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(o)) out[k] = k === 'span' ? v : go(v);
      return out;
    }
    return x;
  };
  return go(t) as STerm;
}
