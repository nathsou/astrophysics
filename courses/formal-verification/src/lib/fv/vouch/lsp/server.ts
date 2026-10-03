/**
 * The Vouch language server (docs/VOUCH.md, "Language server").
 *
 * A transport-agnostic JSON-RPC core: `handle(message)` takes a parsed LSP message and replies through
 * `send(message)`. The browser runs it in a Web Worker (./worker.ts) behind @codemirror/lsp-client; the command
 * line runs it over stdio (tools/vouch-cli), for VS Code, Neovim or Helix.
 *
 * Parse and type diagnostics are published on every change. Verification runs after a pause in typing, declaration
 * by declaration, and streams its results: diagnostics for violations, and the custom notification
 * `vouch/verdicts` (one badge and certificate per checked property) that drives the editor's gutter seals. A
 * result computed for an old version of the document is dropped.
 */
import type * as lsp from 'vscode-languageserver-protocol';
import { parse, type ParseResult } from '../syntax/parser';
import { check, type Checked, type FnInfo } from '../check/checker';
import type { Sym } from '../check/symbols';
import { showTy, type Ty } from '../check/types';
import { lineCol, offsetAt, KEYWORDS, type Span } from '../syntax/lexer';
import { locate, locateAll } from '../syntax/locate';
import { printExpr, printType } from '../syntax/printer';
import type * as A from '../syntax/ast';
import type { Diagnostic } from '../diagnostics';
import { verifyDocument, type DeclVerdicts, type VerifyOptions } from '../../verify/document';
import { badgeText, type Verdict } from '../../engines';

export interface Connection {
  send(message: unknown): void;
}

export interface ServerOptions {
  /** Run verification after edits (default true). */
  verify?: boolean;
  /** Milliseconds of quiet before verifying (default 450). */
  debounce?: number;
  /** Options for the engines (time budgets, extra verifiers). */
  verifyOptions?: Omit<VerifyOptions, 'signal' | 'onDecl'>;
}

interface Analysis {
  parse: ParseResult;
  checked: Checked;
  diagnostics: Diagnostic[];
}

interface Doc {
  uri: string;
  text: string;
  version: number;
  analysis?: Analysis;
  verdicts: DeclVerdicts[];
  verifiedVersion?: number;
  timer?: ReturnType<typeof setTimeout>;
  abort?: AbortController;
}

import { classify, encodeTokens, TOKEN_MODIFIERS, TOKEN_TYPES } from './tokens';
export { classify, encodeTokens, TOKEN_MODIFIERS, TOKEN_TYPES };

export class VouchLanguageServer {
  private docs = new Map<string, Doc>();
  private shutdown = false;
  readonly opts: Required<Pick<ServerOptions, 'verify' | 'debounce'>> & ServerOptions;

  constructor(
    private conn: Connection,
    opts: ServerOptions = {},
  ) {
    this.opts = { verify: true, debounce: 450, ...opts };
  }

  // ── JSON-RPC dispatch ──
  handle(msg: { id?: number | string; method?: string; params?: unknown }): void {
    if (!msg.method) return; // a response to a request we never send
    const reply = (result: unknown) => msg.id !== undefined && this.conn.send({ jsonrpc: '2.0', id: msg.id, result });
    const fail = (code: number, message: string) => msg.id !== undefined && this.conn.send({ jsonrpc: '2.0', id: msg.id, error: { code, message } });
    try {
      const p = msg.params as never;
      switch (msg.method) {
        case 'initialize':
          return reply(this.initialize());
        case 'initialized':
        case '$/setTrace':
        case '$/cancelRequest':
        case 'workspace/didChangeConfiguration':
          return;
        case 'shutdown':
          this.shutdown = true;
          return reply(null);
        case 'exit':
          return;
        case 'textDocument/didOpen':
          return this.didOpen(p);
        case 'textDocument/didChange':
          return this.didChange(p);
        case 'textDocument/didClose':
          return this.didClose(p);
        case 'textDocument/hover':
          return reply(this.hover(p));
        case 'textDocument/completion':
          return reply(this.completion(p));
        case 'textDocument/signatureHelp':
          return reply(this.signatureHelp(p));
        case 'textDocument/definition':
          return reply(this.definition(p));
        case 'textDocument/references':
          return reply(this.references(p));
        case 'textDocument/prepareRename':
          return reply(this.prepareRename(p));
        case 'textDocument/rename':
          return reply(this.rename(p));
        case 'textDocument/documentSymbol':
          return reply(this.documentSymbols(p));
        case 'textDocument/semanticTokens/full':
          return reply(this.semanticTokens(p));
        case 'textDocument/inlayHint':
          return reply(this.inlayHints(p));
        case 'textDocument/codeAction':
          return reply(this.codeActions(p));
        case 'vouch/verify':
          return void this.verifyNow((p as { textDocument: { uri: string } }).textDocument.uri).then(() => reply(this.docs.get((p as { textDocument: { uri: string } }).textDocument.uri)?.verdicts ?? []));
        case 'vouch/verdicts':
          return reply(this.docs.get((p as { textDocument: { uri: string } }).textDocument.uri)?.verdicts ?? []);
        default:
          if (msg.id !== undefined) fail(-32601, `Method not found: ${msg.method}`);
      }
    } catch (e) {
      fail(-32603, e instanceof Error ? e.message : String(e));
    }
  }

  initialize(): lsp.InitializeResult {
    return {
      capabilities: {
        textDocumentSync: { openClose: true, change: 1 /* full */ },
        hoverProvider: true,
        completionProvider: { triggerCharacters: ['.', ':'] },
        signatureHelpProvider: { triggerCharacters: ['(', ','] },
        definitionProvider: true,
        referencesProvider: true,
        renameProvider: { prepareProvider: true },
        documentSymbolProvider: true,
        semanticTokensProvider: { legend: { tokenTypes: [...TOKEN_TYPES], tokenModifiers: [...TOKEN_MODIFIERS] }, full: true },
        inlayHintProvider: true,
        codeActionProvider: { codeActionKinds: ['quickfix'] },
      },
      serverInfo: { name: 'vouch-language-server', version: '1.0.0' },
    };
  }

  // ── Documents ──
  didOpen(p: lsp.DidOpenTextDocumentParams): void {
    const d: Doc = { uri: p.textDocument.uri, text: p.textDocument.text, version: p.textDocument.version, verdicts: [] };
    this.docs.set(d.uri, d);
    this.analyse(d);
  }

  didChange(p: lsp.DidChangeTextDocumentParams): void {
    const d = this.docs.get(p.textDocument.uri);
    if (!d) return;
    for (const c of p.contentChanges) {
      if ('range' in c && c.range) {
        const start = offsetAt(d.text, c.range.start.line, c.range.start.character);
        const end = offsetAt(d.text, c.range.end.line, c.range.end.character);
        d.text = d.text.slice(0, start) + c.text + d.text.slice(end);
      } else d.text = c.text;
    }
    d.version = p.textDocument.version;
    this.analyse(d);
  }

  didClose(p: lsp.DidCloseTextDocumentParams): void {
    const d = this.docs.get(p.textDocument.uri);
    if (d?.timer) clearTimeout(d.timer);
    d?.abort?.abort();
    this.docs.delete(p.textDocument.uri);
  }

  /** The current analysis of a document (parse + type check), for tests and tools. */
  analysisOf(uri: string): Analysis | undefined {
    return this.docs.get(uri)?.analysis;
  }

  private analyse(d: Doc): void {
    const parsed = parse(d.text);
    const checked = check(parsed.program);
    d.analysis = { parse: parsed, checked, diagnostics: [...parsed.diagnostics, ...checked.diagnostics] };
    // Results from the previous version no longer apply.
    d.abort?.abort();
    d.verdicts = [];
    this.publish(d);
    if (this.opts.verify) {
      if (d.timer) clearTimeout(d.timer);
      d.timer = setTimeout(() => void this.verifyNow(d.uri), this.opts.debounce);
    }
  }

  async verifyNow(uri: string): Promise<void> {
    const d = this.docs.get(uri);
    if (!d?.analysis) return;
    d.abort?.abort();
    const abort = new AbortController();
    d.abort = abort;
    const version = d.version;
    const verdicts: DeclVerdicts[] = [];
    await verifyDocument(d.analysis.checked, {
      ...this.opts.verifyOptions,
      signal: abort.signal,
      onDecl: (dv) => {
        if (abort.signal.aborted || d.version !== version) return;
        verdicts.push(dv);
        d.verdicts = [...verdicts];
        this.publish(d);
      },
    });
    if (!abort.signal.aborted && d.version === version) {
      d.verifiedVersion = version;
      this.conn.send({ jsonrpc: '2.0', method: 'vouch/verificationDone', params: { uri, version } });
    }
  }

  private range(text: string, span: Span): lsp.Range {
    return { start: lineCol(text, span.start), end: lineCol(text, Math.max(span.start, span.end)) };
  }

  private publish(d: Doc): void {
    const a = d.analysis!;
    const sev = { error: 1, warning: 2, info: 3, hint: 4 } as const;
    const diagnostics: lsp.Diagnostic[] = a.diagnostics.map((x) => ({
      range: this.range(d.text, x.span),
      severity: sev[x.severity],
      code: x.code,
      source: 'vouch',
      message: x.message,
    }));
    for (const dv of d.verdicts) {
      for (const v of dv.verdicts) {
        if (!v.span || v.status === 'verified') continue;
        const message =
          v.status === 'violated' ? `✗ ${v.subject}: ${v.message ?? 'violated'}`
          : v.badge.kind === 'tested' ? `◌ ${v.subject}: ${badgeText(v.badge)}. ${v.message ?? ''}`.trim()
          : `? ${v.subject}: ${v.message ?? badgeText(v.badge)}`;
        diagnostics.push({
          range: this.range(d.text, v.span),
          severity: v.status === 'violated' ? 1 : v.badge.kind === 'tested' ? 3 : 2,
          code: `verify/${v.status}`,
          source: `vouch ${v.engine}`,
          message,
        });
      }
    }
    this.conn.send({ jsonrpc: '2.0', method: 'textDocument/publishDiagnostics', params: { uri: d.uri, version: d.version, diagnostics } });
    this.conn.send({
      jsonrpc: '2.0',
      method: 'vouch/verdicts',
      params: { uri: d.uri, version: d.version, verdicts: d.verdicts.map((dv) => ({ ...dv, verdicts: dv.verdicts.map((v) => ({ ...v, range: v.span ? this.range(d.text, v.span) : undefined })) })) },
    });
  }

  private doc(p: { textDocument: { uri: string } }): Doc | undefined {
    return this.docs.get(p.textDocument.uri);
  }

  private offset(d: Doc, pos: lsp.Position): number {
    return offsetAt(d.text, pos.line, pos.character);
  }

  // ── Symbols at a position ──
  /** The symbol defined or used at an offset, with the span of the name there. */
  symbolAt(d: Doc, off: number): { sym: Sym; span: Span } | undefined {
    const c = d.analysis?.checked;
    if (!c) return undefined;
    // Uses.
    for (const [id, spans] of c.uses) for (const s of spans) if (s.start <= off && off <= s.end) return { sym: c.symbols[id - 1]!, span: s };
    // Definitions.
    for (const s of c.symbols) if (s.def.start <= off && off <= s.def.start + s.name.length) return { sym: s, span: { start: s.def.start, end: s.def.start + s.name.length } };
    return undefined;
  }

  // ── Hover ──
  hover(p: lsp.HoverParams): lsp.Hover | null {
    const d = this.doc(p);
    if (!d?.analysis) return null;
    const off = this.offset(d, p.position);
    const c = d.analysis.checked;
    const at = this.symbolAt(d, off);
    const parts: string[] = [];
    let span: Span | undefined;
    if (at) {
      span = at.span;
      parts.push('```vouch\n' + describeSym(at.sym, c) + '\n```');
      const info = at.sym.kind === 'fn' ? fnInfoOf(c, at.sym) : undefined;
      if (info) {
        const contract = [...info.decl.spec.requires.map((r) => `requires ${printExpr(r.value)}`), ...info.decl.spec.ensures.map((r) => `ensures ${printExpr(r.value)}`)];
        if (contract.length) parts.push('```vouch\n' + contract.join('\n') + '\n```');
      }
      if (at.sym.doc) parts.push(at.sym.doc);
      // The verdict for a function or a system.
      const dv = d.verdicts.find((x) => x.decl === at.sym.name);
      if (dv) parts.push(dv.verdicts.map((v) => `${v.status === 'violated' ? '✗' : v.status === 'verified' ? '✓' : '?'} **${v.subject}**: ${badgeText(v.badge)}`).join('  \n'));
    } else {
      const loc = locate(d.analysis.parse.program, off);
      if (loc?.kind === 'expr') {
        const t = c.types.get(loc.node);
        if (t) {
          span = loc.node.span;
          parts.push('```vouch\n' + `${printExpr(loc.node).slice(0, 120)}: ${showTy(t)}` + '\n```');
        }
      }
    }
    // Counterexample values: the value of the variable under the cursor in the last failing run.
    if (at && (at.sym.kind === 'local' || at.sym.kind === 'param' || at.sym.kind === 'result')) {
      for (const dv of d.verdicts)
        for (const v of dv.verdicts) {
          if (v.status !== 'violated' || !v.trace) continue;
          const last = [...v.trace.steps].reverse().find((s) => s.state.values.some((x) => x.name === at.sym.name));
          const val = last?.state.values.find((x) => x.name === at.sym.name);
          if (val) parts.push(`In the counterexample: \`${at.sym.name} = ${val.value}\``);
        }
    }
    if (!parts.length) return null;
    return { contents: { kind: 'markdown', value: parts.join('\n\n') }, range: span ? this.range(d.text, span) : undefined };
  }

  // ── Completion ──
  completion(p: lsp.CompletionParams): lsp.CompletionList {
    const d = this.doc(p);
    const items: lsp.CompletionItem[] = [];
    if (!d?.analysis) return { isIncomplete: false, items };
    const off = this.offset(d, p.position);
    const c = d.analysis.checked;
    const before = d.text.slice(Math.max(0, off - 200), off);
    // Fields after a dot.
    const dot = /([A-Za-z_][\w']*)\.\w*$/.exec(before);
    if (dot) {
      const scope = scopeAt(c, off);
      const s = scope?.lookup(dot[1]!) ?? c.globals.lookup(dot[1]!);
      const fields = s ? fieldsOf(s.ty, c) : [];
      if (s?.kind === 'type' && s.ty.k === 'enum') for (const v of s.ty.variants) items.push({ label: v.name, kind: 20 });
      for (const f of fields) items.push({ label: f.name, kind: 5, detail: showTy(f.ty) });
      return { isIncomplete: false, items };
    }
    const scope = scopeAt(c, off) ?? c.globals;
    for (const s of scope.visible()) {
      if (s.def.start > off && (s.kind === 'local' || s.kind === 'bound')) continue;
      items.push({ label: s.name, kind: completionKind(s), detail: describeSym(s, c) });
    }
    for (const kw of KEYWORDS) items.push({ label: kw, kind: 14 });
    for (const b of ['len', 'multiset', 'set', 'min', 'max', 'abs', 'reversed', 'old']) items.push({ label: b, kind: 3, detail: 'built-in' });
    items.push(
      { label: 'while … invariant', kind: 15, insertTextFormat: 2, insertText: 'while ${1:cond}\n  invariant ${2:true}\n  decreases ${3:measure}\n{\n  $0\n}', detail: 'loop with an invariant and a termination measure' },
      { label: 'fn … requires … ensures', kind: 15, insertTextFormat: 2, insertText: 'fn ${1:name}(${2:x: int}) -> (${3:r}: ${4:int})\n  requires ${5:true}\n  ensures ${6:true}\n{\n  $0\n}', detail: 'function with a contract' },
      { label: 'system', kind: 15, insertTextFormat: 2, insertText: 'system ${1:Name} {\n  var ${2:x}: ${3:0..4} = ${4:0}\n\n  action ${5:step} when ${6:true} {\n    $0\n  }\n\n  invariant ${7:safe}: ${8:true}\n}', detail: 'a state machine' },
      { label: 'forall', kind: 15, insertTextFormat: 2, insertText: 'forall ${1:i} :: ${2:0 <= i < n} ==> ${3:true}', detail: 'quantifier' },
    );
    return { isIncomplete: false, items };
  }

  // ── Signature help ──
  signatureHelp(p: lsp.SignatureHelpParams): lsp.SignatureHelp | null {
    const d = this.doc(p);
    if (!d?.analysis) return null;
    const off = this.offset(d, p.position);
    // Walk back to the unmatched '(' and the name before it.
    let depth = 0;
    let commas = 0;
    let i = off - 1;
    for (; i >= 0; i--) {
      const ch = d.text[i];
      if (ch === ')' || ch === ']') depth++;
      else if (ch === '(' || ch === '[') {
        if (depth === 0) break;
        depth--;
      } else if (ch === ',' && depth === 0) commas++;
      else if (ch === '\n' && depth === 0 && i < off - 400) return null;
    }
    if (i < 0) return null;
    const m = /([A-Za-z_][\w']*)\s*$/.exec(d.text.slice(Math.max(0, i - 60), i));
    if (!m) return null;
    const s = d.analysis.checked.globals.lookup(m[1]!) ?? scopeAt(d.analysis.checked, off)?.lookup(m[1]!);
    if (!s || s.kind !== 'fn') return null;
    const info = fnInfoOf(d.analysis.checked, s);
    if (!info) return null;
    const params = info.params.map((x) => `${x.inout ? 'inout ' : ''}${x.name}: ${showTy(x.ty)}`);
    const label = `${s.name}(${params.join(', ')})${info.result ? ` -> ${showTy(info.result.ty)}` : ''}`;
    const req = info.decl.spec.requires.map((r) => `requires ${printExpr(r.value)}`).join('\n');
    return { signatures: [{ label, parameters: params.map((x) => ({ label: x })), documentation: req ? { kind: 'markdown', value: '```vouch\n' + req + '\n```' } : undefined }], activeSignature: 0, activeParameter: commas };
  }

  // ── Navigation ──
  definition(p: lsp.DefinitionParams): lsp.Location | null {
    const d = this.doc(p);
    if (!d) return null;
    const at = this.symbolAt(d, this.offset(d, p.position));
    if (!at || at.sym.kind === 'builtin') return null;
    return { uri: d.uri, range: this.range(d.text, { start: at.sym.def.start, end: at.sym.def.start + at.sym.name.length }) };
  }

  references(p: lsp.ReferenceParams): lsp.Location[] {
    const d = this.doc(p);
    if (!d?.analysis) return [];
    const at = this.symbolAt(d, this.offset(d, p.position));
    if (!at) return [];
    const spans = [...(p.context?.includeDeclaration ? [{ start: at.sym.def.start, end: at.sym.def.start + at.sym.name.length }] : []), ...(d.analysis.checked.uses.get(at.sym.id) ?? [])];
    return spans.map((s) => ({ uri: d.uri, range: this.range(d.text, s) }));
  }

  prepareRename(p: lsp.PrepareRenameParams): lsp.Range | null {
    const d = this.doc(p);
    if (!d) return null;
    const at = this.symbolAt(d, this.offset(d, p.position));
    if (!at || at.sym.kind === 'builtin') return null;
    return this.range(d.text, at.span);
  }

  rename(p: lsp.RenameParams): lsp.WorkspaceEdit | null {
    const d = this.doc(p);
    if (!d?.analysis) return null;
    if (!/^[A-Za-z_][\w']*$/.test(p.newName) || KEYWORDS.has(p.newName)) throw new Error(`“${p.newName}” is not a valid name.`);
    const at = this.symbolAt(d, this.offset(d, p.position));
    if (!at) return null;
    const spans = [{ start: at.sym.def.start, end: at.sym.def.start + at.sym.name.length }, ...(d.analysis.checked.uses.get(at.sym.id) ?? [])];
    // A use span may cover more than the name (e.g. a struct literal); edit only the name itself.
    const edits = spans
      .map((s) => {
        const i = d.text.indexOf(at.sym.name, s.start);
        return i >= 0 && i <= s.end ? { start: i, end: i + at.sym.name.length } : undefined;
      })
      .filter((s): s is Span => !!s);
    const unique = [...new Map(edits.map((s) => [s.start, s])).values()];
    return { changes: { [d.uri]: unique.map((s) => ({ range: this.range(d.text, s), newText: p.newName })) } };
  }

  documentSymbols(p: lsp.DocumentSymbolParams): lsp.DocumentSymbol[] {
    const d = this.doc(p);
    if (!d?.analysis) return [];
    const r = (s: Span) => this.range(d.text, s);
    const member = (m: A.Decl | A.Member): lsp.DocumentSymbol | undefined => {
      const mk = (name: string, kind: number, sel: Span, children?: lsp.DocumentSymbol[]): lsp.DocumentSymbol => ({ name, kind: kind as lsp.SymbolKind, range: r(m.span), selectionRange: r(sel), children });
      switch (m.k) {
        case 'fn':
          return mk(m.name, m.flavour === 'lemma' ? 24 : 12, m.nameSpan);
        case 'const':
          return mk(m.name, 14, m.nameSpan);
        case 'enum':
          return mk(m.name, 10, m.nameSpan);
        case 'struct':
        case 'class':
          return mk(m.name, 23, m.nameSpan);
        case 'type':
          return mk(m.names.map((n) => n.name).join(', '), 26, m.names[0]!.span);
        case 'system':
        case 'world':
        case 'problem':
          return mk(m.name, 2, m.nameSpan, m.members.map(member).filter((x): x is lsp.DocumentSymbol => !!x));
        case 'var':
          return mk(m.name, 13, m.nameSpan);
        case 'action':
          return mk(m.name, 6, m.nameSpan);
        case 'process':
          return mk(m.name, 5, m.nameSpan);
        case 'invariant':
        case 'property':
        case 'fact':
        case 'check':
        case 'run':
        case 'constraint':
          return mk(`${m.k} ${m.name ?? ''}`.trim(), 7, m.nameSpan ?? m.span);
        default:
          return undefined;
      }
    };
    return d.analysis.parse.program.decls.map(member).filter((x): x is lsp.DocumentSymbol => !!x);
  }

  // ── Semantic tokens: the editor's highlighting ──
  semanticTokens(p: lsp.SemanticTokensParams): lsp.SemanticTokens {
    const d = this.doc(p);
    if (!d) return { data: [] };
    return { data: encodeTokens(d.text, classify(d.text, d.analysis?.checked)) };
  }

  // ── Inlay hints: inferred types of `let` and `var` ──
  inlayHints(p: lsp.InlayHintParams): lsp.InlayHint[] {
    const d = this.doc(p);
    if (!d?.analysis) return [];
    const c = d.analysis.checked;
    const out: lsp.InlayHint[] = [];
    const start = this.offset(d, p.range.start);
    const end = this.offset(d, p.range.end);
    for (const [node, sym] of c.refs) {
      const st = node as A.Stmt;
      if (st.k !== 'let' || st.type || sym.ty.k === 'error') continue;
      if (st.nameSpan.end < start || st.nameSpan.end > end) continue;
      out.push({ position: lineCol(d.text, st.nameSpan.end), label: `: ${showTy(sym.ty)}`, kind: 1, paddingLeft: false });
    }
    return out;
  }

  // ── Code actions ──
  codeActions(p: lsp.CodeActionParams): lsp.CodeAction[] {
    const d = this.doc(p);
    if (!d?.analysis) return [];
    const out: lsp.CodeAction[] = [];
    for (const diagItem of p.context.diagnostics) {
      if (diagItem.source !== 'vouch') continue;
      const code = String(diagItem.code ?? '');
      const at = this.offset(d, diagItem.range.start);
      if (code === 'name/unknown' || code === 'type/unknown') {
        const m = /Did you mean “([^”]+)”/.exec(diagItem.message);
        if (m) out.push({ title: `Change to “${m[1]}”`, kind: 'quickfix', diagnostics: [diagItem], edit: { changes: { [d.uri]: [{ range: diagItem.range, newText: m[1]! }] } } });
      }
      if (code === 'stmt/immutable' && /declared with `let`/.test(diagItem.message)) {
        const sym = this.symbolAt(d, at)?.sym;
        if (sym) {
          const letAt = d.text.lastIndexOf('let', sym.def.start);
          if (letAt >= 0) out.push({ title: `Declare “${sym.name}” with var`, kind: 'quickfix', diagnostics: [diagItem], edit: { changes: { [d.uri]: [{ range: this.range(d.text, { start: letAt, end: letAt + 3 }), newText: 'var' }] } } });
        }
      }
    }
    // A loop without a termination measure: suggest one.
    const off = this.offset(d, p.range.start);
    for (const loc of locateAll(d.analysis.parse.program, off)) {
      if (loc.kind === 'stmt' && loc.node.k === 'while' && !loc.node.spec.decreases) {
        const guess = guessMeasure(loc.node.cond);
        if (guess) {
          const pos = loc.node.cond.span.end;
          out.push({ title: `Add “decreases ${guess}”`, kind: 'quickfix', edit: { changes: { [d.uri]: [{ range: this.range(d.text, { start: pos, end: pos }), newText: `\n    decreases ${guess}` }] } } });
        }
      }
    }
    return out;
  }
}

// ── Helpers ──
function fnInfoOf(c: Checked, s: Sym): FnInfo | undefined {
  for (const f of c.fns.values()) if (f.sym === s) return f;
  return undefined;
}

function scopeAt(c: Checked, off: number) {
  let best: { span: Span; scope: Checked['globals'] } | undefined;
  for (const s of c.scopes) if (s.span.start <= off && off <= s.span.end && (!best || s.span.end - s.span.start < best.span.end - best.span.start)) best = s;
  return best?.scope;
}

function fieldsOf(t: Ty, c: Checked): { name: string; ty: Ty }[] {
  if (t.k === 'struct') return t.fields;
  if (t.k === 'ref') {
    const cls = c.globals.lookup(t.cls)?.ty;
    return cls?.k === 'struct' ? cls.fields : [];
  }
  return [];
}

function completionKind(s: Sym): lsp.CompletionItemKind {
  const k: Record<string, number> = { local: 6, param: 6, result: 6, bound: 6, statevar: 10, const: 21, fn: 3, type: 7, variant: 20, process: 9, action: 2, rel: 10, container: 9, field: 5, label: 13, builtin: 3 };
  return (k[s.kind] ?? 1) as lsp.CompletionItemKind;
}

export function describeSym(s: Sym, c: Checked): string {
  switch (s.kind) {
    case 'fn': {
      const info = fnInfoOf(c, s);
      if (!info) return s.name;
      const d = info.decl;
      const head = d.flavour === 'pure' ? 'pure fn' : d.flavour === 'pred' ? 'pred' : d.flavour === 'lemma' ? 'lemma' : 'fn';
      return `${head} ${s.name}(${info.params.map((p) => `${p.inout ? 'inout ' : ''}${p.name}: ${showTy(p.ty)}`).join(', ')})${info.result && d.flavour !== 'pred' ? ` -> ${info.result.name !== 'result' ? `(${info.result.name}: ${showTy(info.result.ty)})` : showTy(info.result.ty)}` : ''}`;
    }
    case 'type':
      return `type ${s.name}${s.ty.k === 'atom' ? '' : ` = ${showTy(s.ty)}`}`;
    case 'variant':
      return `${s.name}: ${showTy(s.ty)}`;
    case 'process':
      return `process ${s.name}`;
    case 'action':
      return `action ${s.name}`;
    case 'container':
      return `${(s.decl as A.ContainerDecl | undefined)?.k ?? 'system'} ${s.name}`;
    case 'statevar':
      return `${s.ghost ? 'ghost ' : ''}var ${s.name}: ${showTy(s.ty)}  // state`;
    case 'const':
      return `const ${s.name}: ${showTy(s.ty)}${s.value !== undefined ? ` = ${String(s.value)}` : ''}`;
    case 'param':
      return `${s.inout ? 'inout ' : ''}${s.ghost ? 'ghost ' : ''}${s.name}: ${showTy(s.ty)}  // parameter`;
    case 'result':
      return `${s.name}: ${showTy(s.ty)}  // result`;
    case 'bound':
      return `${s.name}: ${showTy(s.ty)}  // bound variable`;
    case 'rel':
      return `rel ${s.name}: ${showTy(s.ty)}`;
    default:
      return `${s.ghost ? 'ghost ' : ''}${s.mutable ? 'var' : 'let'} ${s.name}: ${showTy(s.ty)}`;
  }
}

function guessMeasure(cond: A.Expr): string | undefined {
  if (cond.k === 'binary' && (cond.op === '<' || cond.op === '<=')) return `${printExpr(cond.right)} - ${printExpr(cond.left)}`;
  if (cond.k === 'binary' && (cond.op === '>' || cond.op === '>=')) return `${printExpr(cond.left)} - ${printExpr(cond.right)}`;
  if (cond.k === 'binary' && cond.op === '!=') return `${printExpr(cond.left)}`;
  if (cond.k === 'binary' && cond.op === '&&') return guessMeasure(cond.left);
  return undefined;
}

export { printType };
export type { Verdict };
