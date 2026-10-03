/**
 * The `vouch` command line.
 *
 *   npm run vouch -- check file.vouch      parse and type-check; print diagnostics
 *   npm run vouch -- verify file.vouch     run the engines; print each verdict with its badge and certificate
 *   npm run vouch -- lsp --stdio           the language server, for VS Code, Neovim, Helix (docs/VOUCH.md)
 */
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { parse } from '../../src/lib/fv/vouch/syntax/parser.ts';
import { check } from '../../src/lib/fv/vouch/check/checker.ts';
import { lineCol } from '../../src/lib/fv/vouch/syntax/lexer.ts';
import { verifyDocument } from '../../src/lib/fv/verify/document.ts';
import { badgeText } from '../../src/lib/fv/engines.ts';
import { VouchLanguageServer } from '../../src/lib/fv/vouch/lsp/server.ts';
import { MessageReader, frame } from '../../src/lib/fv/vouch/lsp/stdio.ts';

const [cmd, ...rest] = process.argv.slice(2);

function load(file: string) {
  const text = readFileSync(file, 'utf8');
  const p = parse(text);
  const c = check(p.program);
  const diags = [...p.diagnostics, ...c.diagnostics];
  for (const d of diags) {
    const { line, character } = lineCol(text, d.span.start);
    console.log(`${file}:${line + 1}:${character + 1}: ${d.severity} [${d.code}] ${d.message}`);
  }
  return { text, checked: c, errors: diags.filter((d) => d.severity === 'error').length };
}

async function main() {
  switch (cmd) {
    case 'check': {
      let errors = 0;
      for (const f of rest) errors += load(f).errors;
      process.exitCode = errors ? 1 : 0;
      return;
    }
    case 'verify': {
      let failed = false;
      for (const f of rest) {
        const { text, checked, errors } = load(f);
        if (errors) {
          failed = true;
          continue;
        }
        for (const dv of await verifyDocument(checked)) {
          for (const v of dv.verdicts) {
            const where = v.span ? `:${lineCol(text, v.span.start).line + 1}` : '';
            const mark = v.status === 'verified' ? '✓' : v.status === 'violated' ? '✗' : '?';
            console.log(`${mark} ${f}${where} ${dv.decl}: ${v.subject} — ${badgeText(v.badge)}${v.certificate.checked ? ` (certificate checked by ${v.certificate.checker})` : ''}`);
            if (v.message) console.log(`    ${v.message}`);
            if (v.trace) for (const [i, s] of v.trace.steps.entries()) console.log(`    ${i === v.trace.loopsTo ? '↻ ' : '  '}${s.label ?? 'start'}: ${s.state.values.map((x) => `${x.name} = ${x.value}`).join(', ')}`);
            if (v.status === 'violated') failed = true;
          }
        }
      }
      process.exitCode = failed ? 1 : 0;
      return;
    }
    case 'lsp': {
      const server = new VouchLanguageServer({ send: (m) => process.stdout.write(frame(m)) });
      const reader = new MessageReader((m) => {
        server.handle(m as never);
        if ((m as { method?: string }).method === 'exit') process.exit(0);
      });
      process.stdin.on('data', (chunk: Buffer) => reader.push(new Uint8Array(chunk)));
      return;
    }
    default:
      console.log('Usage: vouch check|verify <file.vouch>…  |  vouch lsp --stdio');
      process.exitCode = 2;
  }
}

void main();
