/**
 * Highlighting of ```dcl code blocks at build time, with the DCL compiler's own lexer (HDL.md, *Highlighting*).
 *
 * The lexer is TypeScript that the course shares with the browser bundle. Node runs this compiler with
 * type stripping only, which cannot load `src/lib/hdl/span.ts` (a class with parameter properties), so the
 * few files involved are transpiled with TypeScript's own transpiler into a temporary directory and imported
 * from there. Loaded on first use, so chapters without DCL pay nothing.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '../../src/lib/hdl');
const FILES = ['span.ts', 'lexer.ts', 'highlight.ts', 'editor/highlightHtml.ts'];

let loaded: Promise<(code: string) => string> | undefined;

/** `highlightDclHtml` from src/lib/hdl/editor/highlightHtml.ts, loaded through the transpiler. */
export function dclHighlighter(): Promise<(code: string) => string> {
  loaded ??= (async () => {
    const outputs = FILES.map((f) => {
      const text = readFileSync(path.join(root, f), 'utf8');
      const js = ts.transpileModule(text, {
        fileName: f,
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: false },
      }).outputText.replace(/(from\s+['"][^'"]+)\.ts(['"])/g, '$1.mjs$2');
      return { f, js };
    });
    const dir = path.join(tmpdir(), `dcl-highlight-${createHash('sha1').update(outputs.map((o) => o.js).join('\0')).digest('hex').slice(0, 12)}`);
    for (const o of outputs) {
      const file = path.join(dir, o.f.replace(/\.ts$/, '.mjs'));
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, o.js);
    }
    const mod = (await import(pathToFileURL(path.join(dir, 'editor/highlightHtml.mjs')).href)) as { highlightDclHtml: (code: string) => string };
    return mod.highlightDclHtml;
  })();
  return loaded;
}
