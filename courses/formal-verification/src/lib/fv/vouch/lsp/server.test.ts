import { describe, expect, it } from 'vitest';
import { VouchLanguageServer } from './server';
import { MessageReader, frame } from './stdio';

type Msg = { id?: number; method?: string; params?: any; result?: any; error?: any };

function setup(text: string, verify = false) {
  const sent: Msg[] = [];
  const server = new VouchLanguageServer({ send: (m) => sent.push(m as Msg) }, { verify, debounce: 0 });
  let id = 0;
  const request = (method: string, params: unknown) => {
    const myId = ++id;
    server.handle({ id: myId, method, params });
    return sent.find((m) => m.id === myId)!;
  };
  request('initialize', { capabilities: {} });
  server.handle({ method: 'textDocument/didOpen', params: { textDocument: { uri: 'file:///a.vouch', languageId: 'vouch', version: 1, text } } });
  return { server, sent, request, uri: 'file:///a.vouch' };
}
const pos = (text: string, needle: string, after = 0) => {
  const i = text.indexOf(needle) + after;
  const before = text.slice(0, i).split('\n');
  return { line: before.length - 1, character: before.at(-1)!.length };
};

const SRC = `fn twice(x: int) -> (r: int)
  requires x >= 0
  ensures r == 2 * x
{
  let y = x + x
  r = y
}

fn caller() -> int {
  let z = twice(3)
  return z
}
`;

describe('Vouch language server', () => {
  it('advertises its capabilities', () => {
    const { request } = setup(SRC);
    const caps = request('initialize', {}).result.capabilities;
    for (const k of ['hoverProvider', 'completionProvider', 'definitionProvider', 'referencesProvider', 'renameProvider', 'semanticTokensProvider', 'inlayHintProvider', 'codeActionProvider', 'signatureHelpProvider', 'documentSymbolProvider']) expect(caps[k]).toBeTruthy();
  });
  it('publishes diagnostics on open and on change', () => {
    const { server, sent, uri } = setup(SRC);
    const first = sent.filter((m) => m.method === 'textDocument/publishDiagnostics').at(-1)!;
    expect(first.params.diagnostics).toEqual([]);
    server.handle({ method: 'textDocument/didChange', params: { textDocument: { uri, version: 2 }, contentChanges: [{ text: SRC.replace('let z = twice(3)', 'let z = twise(3)') }] } });
    const d = sent.filter((m) => m.method === 'textDocument/publishDiagnostics').at(-1)!;
    expect(d.params.diagnostics[0].message).toMatch(/Did you mean “twice”/);
    expect(d.params.version).toBe(2);
  });
  it('hovers show types, signatures and contracts', () => {
    const { request, uri } = setup(SRC);
    const h = request('textDocument/hover', { textDocument: { uri }, position: pos(SRC, 'twice(3)', 1) }).result;
    expect(h.contents.value).toContain('fn twice(x: int) -> (r: int)');
    expect(h.contents.value).toContain('requires x >= 0');
    const h2 = request('textDocument/hover', { textDocument: { uri }, position: pos(SRC, 'let y', 4) }).result;
    expect(h2.contents.value).toContain('let y: int');
  });
  it('goes to definitions, finds references and renames', () => {
    const { request, uri } = setup(SRC);
    const def = request('textDocument/definition', { textDocument: { uri }, position: pos(SRC, 'r = y', 4) }).result;
    expect(def.range.start).toEqual(pos(SRC, 'y = x + x'));
    const refs = request('textDocument/references', { textDocument: { uri }, position: pos(SRC, 'x: int', 0), context: { includeDeclaration: true } }).result;
    expect(refs).toHaveLength(5);
    const edit = request('textDocument/rename', { textDocument: { uri }, position: pos(SRC, 'x: int', 0), newName: 'n' }).result;
    expect(edit.changes[uri]).toHaveLength(5);
  });
  it('completes names in scope, fields and snippets', () => {
    const { request, uri } = setup(SRC);
    const items = request('textDocument/completion', { textDocument: { uri }, position: pos(SRC, 'return z', 7) }).result.items.map((i: { label: string }) => i.label);
    expect(items).toContain('z');
    expect(items).toContain('twice');
    expect(items).toContain('while … invariant');
  });
  it('gives signature help inside a call', () => {
    const { request, uri } = setup(SRC);
    const s = request('textDocument/signatureHelp', { textDocument: { uri }, position: pos(SRC, 'twice(3', 6) }).result;
    expect(s.signatures[0].label).toBe('twice(x: int) -> int');
  });
  it('lists document symbols, semantic tokens and inlay hints', () => {
    const { request, uri } = setup(SRC);
    expect(request('textDocument/documentSymbol', { textDocument: { uri } }).result.map((s: { name: string }) => s.name)).toEqual(['twice', 'caller']);
    const toks = request('textDocument/semanticTokens/full', { textDocument: { uri } }).result.data;
    expect(toks.length % 5).toBe(0);
    expect(toks.length).toBeGreaterThan(40);
    const hints = request('textDocument/inlayHint', { textDocument: { uri }, range: { start: { line: 0, character: 0 }, end: { line: 20, character: 0 } } }).result;
    expect(hints.map((h: { label: string }) => h.label)).toContain(': int');
  });
  it('offers quick fixes', () => {
    const src = 'fn f(count: int) -> int {\n  return cont\n}\n';
    const { request, sent, uri } = setup(src);
    const diag = sent.filter((m) => m.method === 'textDocument/publishDiagnostics').at(-1)!.params.diagnostics[0];
    const actions = request('textDocument/codeAction', { textDocument: { uri }, range: diag.range, context: { diagnostics: [diag] } }).result;
    expect(actions[0].title).toBe('Change to “count”');
  });
  it('streams verification results as they arrive and drops stale ones', async () => {
    const src = `system S {
  var x: 0..4 = 0
  action inc when x < 3 { x = x + 1 }
  invariant small: x < 3
}
`;
    const { server, sent, uri } = setup(src, true);
    await server.verifyNow(uri);
    const v = sent.filter((m) => m.method === 'vouch/verdicts').at(-1)!.params.verdicts;
    expect(v[0].verdicts[0].status).toBe('violated');
    const diags = sent.filter((m) => m.method === 'textDocument/publishDiagnostics').at(-1)!.params.diagnostics;
    expect(diags.some((d: { message: string }) => d.message.startsWith('✗ invariant small'))).toBe(true);
  });
});

describe('stdio framing', () => {
  it('splits a byte stream into messages, however it is chunked', () => {
    const got: unknown[] = [];
    const reader = new MessageReader((m) => got.push(m));
    const bytes = new TextEncoder().encode(frame({ a: 'é' }) + frame({ b: 2 }));
    for (let i = 0; i < bytes.length; i += 7) reader.push(bytes.slice(i, i + 7));
    expect(got).toEqual([{ a: 'é' }, { b: 2 }]);
  });
});
