// Corrections to the book's text, applied to the LaTeX source before conversion.
//
// The book is converted as it stands upstream; obvious slips (a wrong index, a misnamed
// function, a formula that does not say what the text means) are corrected here, silently in the
// rendered text. Each correction lives in errata/<chapter>.json as
//   { "repo": "OpenLogic", "file": "content/…/x.tex", "find": "…", "replace": "…", "why": "…" }
// and must match its file exactly once, so that an upstream change to the passage (for instance,
// the slip being fixed there) makes the conversion fail instead of silently mis-applying it.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Diagnostic } from '../../src/content/schema.ts';

export interface Erratum {
  repo: 'OpenLogic' | 'incompleteness-computability';
  file: string;
  find: string;
  replace: string;
  why: string;
}

export interface Errata {
  entries: (Erratum & { from: string; applied: number })[];
}

export function loadErrata(dir: string): Errata {
  const entries: Errata['entries'] = [];
  if (!existsSync(dir)) return { entries };
  for (const f of readdirSync(dir).sort()) {
    if (!f.endsWith('.json')) continue;
    const list = JSON.parse(readFileSync(join(dir, f), 'utf8')) as Erratum[];
    for (const e of list) entries.push({ ...e, from: f, applied: 0 });
  }
  return { entries };
}

/** Applies the errata for one file. Line counts are preserved when a replacement has as many
 *  line breaks as the text it replaces, so source locations stay exact. */
export function applyErrata(errata: Errata | undefined, repo: string, file: string, src: string, diagnostics: Diagnostic[]): string {
  if (!errata) return src;
  for (const e of errata.entries) {
    if (e.repo !== repo || e.file !== file) continue;
    const first = src.indexOf(e.find);
    if (first < 0) {
      diagnostics.push({ level: 'error', code: 'erratum-unmatched', message: `${e.from}: “${e.find.slice(0, 60)}” not found in ${repo}/${file} (was the passage changed upstream?)` });
      continue;
    }
    if (src.indexOf(e.find, first + 1) >= 0) {
      diagnostics.push({ level: 'error', code: 'erratum-ambiguous', message: `${e.from}: “${e.find.slice(0, 60)}” occurs more than once in ${repo}/${file}` });
      continue;
    }
    src = src.slice(0, first) + e.replace + src.slice(first + e.find.length);
    e.applied++;
  }
  return src;
}

/** Errata whose file was never converted (a typo in the path, or the file left the book). */
export function unusedErrata(errata: Errata, diagnostics: Diagnostic[]) {
  const seen = new Set<string>();
  for (const e of errata.entries) {
    const key = `${e.from}|${e.repo}|${e.file}|${e.find}`;
    if (e.applied === 0 && !seen.has(key)) {
      // Unmatched errors are already reported per file; this catches files that were never read.
      diagnostics.push({ level: 'error', code: 'erratum-unused', message: `${e.from}: correction for ${e.repo}/${e.file} was not applied` });
    }
    seen.add(key);
  }
}
