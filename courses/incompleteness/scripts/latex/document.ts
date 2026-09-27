// LaTeX text → structured blocks (src/content/schema.ts).
//
// The parser walks the upstream files the way the book's driver (ic.tex) does: chapter files
// import section files with \olimport, \iftag selects material by the book's tags, labels are
// qualified by \olfileid exactly as open-logic-referencing.sty does, and theorem-like
// environments are numbered per chapter as in open-logic-envs.sty (thm, ex, lem, prop, cor and
// defn share a counter; problems have their own).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import katex from 'katex';
import type { Block, Chapter, Diagnostic, DisplayRow, EnvKind, Inline, LabelTarget, ListItem, ProofTreeNode, Section, SourceLoc } from '../../src/content/schema.ts';
import type { ConfigState } from './macros.ts';
import { stripComments } from './macros.ts';
import { assembleDisplay } from '../../src/formal/display.ts';
import { accent, expandMath, expandTextInMath, readArgs, readBalanced, readToken, textSymbol, tokenText, type ExpandHooks } from './expand.ts';

type Repo = SourceLoc['repo'];

export interface ConvertContext {
  upstreamDir: string;
  config: ConfigState;
  diagnostics: Diagnostic[];
  used: ExpandHooks['used'];
  /** Labels found so far (pass 1) or all labels (pass 2). */
  labels: Map<string, LabelTarget>;
  /** Labels from the previous pass, used to resolve forward references. */
  knownLabels: Map<string, LabelTarget>;
}

const THEOREM_NAMES: Partial<Record<EnvKind, string>> = {
  defn: 'Definition', prop: 'Proposition', thm: 'Theorem', lem: 'Lemma', cor: 'Corollary',
  ex: 'Example', prob: 'Problem', rem: 'Remark', conv: 'Convention',
};
const SHARED_COUNTER = new Set<EnvKind>(['thm', 'ex', 'lem', 'prop', 'cor', 'defn']);
const MATH_ENVS = new Set(['align', 'align*', 'equation', 'equation*', 'multline', 'multline*', 'gather', 'gather*', 'displaymath', 'eqnarray', 'eqnarray*']);
const IGNORED = new Set([
  'noindent', 'medskip', 'bigskip', 'smallskip', 'clearpage', 'newpage', 'allowbreak', 'nobreak', 'relax',
  'OLEndChapterHook', 'protect', 'hfill', 'centering', 'sloppy', 'linebreak', 'pagebreak', 'vfill',
  'documentclass', 'problemsperchapter', 'allowdisplaybreaks', 'frontmatter', 'mainmatter', 'backmatter',
  'break', 'null', 'leavevmode', 'unskip', 'ignorespaces',
]);
/** Commands whose arguments are skipped (layout only). */
const IGNORED_WITH_ARG: Record<string, number> = { vspace: 1, hspace: 1, index: 1, label: 1, addcontentsline: 3, 'vspace*': 1 };

interface ChapterState {
  number: string;
  counters: { thm: number; prob: number; eq: number; section: number };
}

interface Frame {
  /** Where a bare \ollabel attaches. */
  onLabel: (key: string) => void;
}

export class FileParser {
  readonly src: string;
  private pos = 0;
  private end: number;
  private lineStarts: number[] = [0];
  private blocks: Block[] = [];
  private para: Inline[] = [];
  private paraStart = 0;
  private groupEm: number[] = [];
  private labelStack: Frame[] = [];
  private blockCounter = 0;
  fileId: [string, string, string] = ['udf', 'udf', 'udf'];
  sectionTitle: { c: Inline[]; text: string; start: number } | null = null;
  chapterTitle: string | null = null;
  readonly imports: { path?: string; name: string; star: boolean }[] = [];

  readonly ctx: ConvertContext;
  readonly repo: Repo;
  readonly file: string;
  readonly chapter: ChapterState;
  private sectionId: () => string;
  /** Called for \olimport in driver files. */
  private onImport?: (path: string | undefined, name: string) => void;

  constructor(
    ctx: ConvertContext,
    repo: Repo,
    file: string,
    chapter: ChapterState,
    sectionId: () => string,
    onImport?: (path: string | undefined, name: string) => void,
  ) {
    this.ctx = ctx;
    this.repo = repo;
    this.file = file;
    this.chapter = chapter;
    this.sectionId = sectionId;
    this.onImport = onImport;
    this.src = readFileSync(join(ctx.upstreamDir, repo, file), 'utf8');
    this.end = this.src.length;
    for (let i = 0; i < this.src.length; i++) if (this.src[i] === '\n') this.lineStarts.push(i + 1);
  }

  // ---------------------------------------------------------------- positions & diagnostics

  line(pos: number): number {
    let lo = 0;
    let hi = this.lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.lineStarts[mid] <= pos) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  }

  loc(start: number, end: number): SourceLoc {
    return { repo: this.repo, file: this.file, line: this.line(start), endLine: this.line(Math.max(start, end - 1)) };
  }

  diag(level: Diagnostic['level'], code: string, message: string, at = this.pos) {
    this.ctx.diagnostics.push({ level, code, message, loc: this.loc(at, at + 1) });
  }

  private nextId(prefix: string): string {
    return `${this.sectionId()}/${prefix}${++this.blockCounter}`;
  }

  qualify = (opt: (string | undefined)[], label: string): string => {
    const [a, b, c] = opt;
    const [p, ch, s] = this.fileId;
    if (a === undefined) return `${p}:${ch}:${s}:${label}`;
    if (b === undefined) return `${p}:${ch}:${a}:${label}`;
    if (c === undefined) return `${p}:${a}:${b}:${label}`;
    return `${a}:${b}:${c}:${label}`;
  };

  refText = (key: string): string => {
    const t = this.ctx.knownLabels.get(key) ?? this.ctx.labels.get(key);
    return t ? t.text : '??';
  };

  private hooks(onLabel?: (key: string) => void): ExpandHooks {
    return {
      config: this.ctx.config,
      used: this.ctx.used,
      refText: this.refText,
      qualify: this.qualify,
      onLabel,
      warn: (code, message) => this.diag('warning', code, message),
    };
  }

  private addLabel(key: string, target: Omit<LabelTarget, 'sectionId'>) {
    if (this.ctx.labels.has(key)) this.diag('warning', 'duplicate-label', `label ${key} defined twice`);
    this.ctx.labels.set(key, { ...target, sectionId: this.sectionId() });
  }

  // ---------------------------------------------------------------- reading primitives

  private peek(k = 0) {
    return this.src[this.pos + k];
  }

  private skipWs() {
    while (this.pos < this.end) {
      const c = this.src[this.pos];
      if (c === '%') this.skipComment();
      else if (/\s/.test(c)) this.pos++;
      else break;
    }
  }

  /** Skips a comment, and — as TeX does — the newline and leading spaces of the next line. */
  private skipComment() {
    while (this.pos < this.end && this.src[this.pos] !== '\n') this.pos++;
    this.pos++;
    while (this.pos < this.end && (this.src[this.pos] === ' ' || this.src[this.pos] === '\t')) this.pos++;
  }

  private readCsName(): string {
    // at a backslash
    let j = this.pos + 1;
    if (/[a-zA-Z@]/.test(this.src[j])) while (j < this.end && /[a-zA-Z@]/.test(this.src[j])) j++;
    else j++;
    const name = this.src.slice(this.pos + 1, j);
    this.pos = j;
    if (name === 'vspace' && this.src[this.pos] === '*') this.pos++;
    return name;
  }

  /** Reads a `{…}` group and returns its range (content only). */
  private groupRange(): { start: number; end: number } | null {
    this.skipWs();
    if (this.src[this.pos] !== '{') return null;
    let depth = 0;
    const open = this.pos;
    for (let j = this.pos; j < this.end; j++) {
      const c = this.src[j];
      if (c === '\\') {
        j++;
        continue;
      }
      if (c === '%') {
        while (j < this.end && this.src[j] !== '\n') j++;
        continue;
      }
      if (c === '{') depth++;
      else if (c === '}' && --depth === 0) {
        this.pos = j + 1;
        return { start: open + 1, end: j };
      }
    }
    throw new Error(`${this.file}:${this.line(open)}: unbalanced group`);
  }

  private group(): string {
    const r = this.groupRange();
    return r ? stripComments(this.src.slice(r.start, r.end)) : '';
  }

  private optRange(): { start: number; end: number } | null {
    const save = this.pos;
    while (this.pos < this.end && /[ \t]/.test(this.src[this.pos])) this.pos++;
    if (this.src[this.pos] !== '[') {
      this.pos = save;
      return null;
    }
    let depth = 0;
    for (let j = this.pos + 1; j < this.end; j++) {
      const c = this.src[j];
      if (c === '\\') {
        j++;
        continue;
      }
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === ']' && depth === 0) {
        const r = { start: this.pos + 1, end: j };
        this.pos = j + 1;
        return r;
      }
    }
    throw new Error(`${this.file}:${this.line(this.pos)}: unbalanced [`);
  }

  private opt(): string | undefined {
    const r = this.optRange();
    return r ? stripComments(this.src.slice(r.start, r.end)) : undefined;
  }

  // ---------------------------------------------------------------- paragraphs

  private pushText(v: string) {
    if (this.para.length === 0) {
      if (!v.trim()) return;
      this.paraStart = this.pos;
      v = v.replace(/^\s+/, '');
    }
    const last = this.para[this.para.length - 1];
    if (last && last.t === 'text') last.v += v;
    else this.para.push({ t: 'text', v });
  }

  private pushInline(x: Inline) {
    if (this.para.length === 0) this.paraStart = this.pos;
    this.para.push(x);
  }

  private flush() {
    // Trim trailing whitespace; drop empty paragraphs.
    while (this.para.length) {
      const last = this.para[this.para.length - 1];
      if (last.t === 'text') {
        last.v = last.v.replace(/\s+$/, '');
        if (!last.v) {
          this.para.pop();
          continue;
        }
      }
      break;
    }
    if (this.para.length) {
      this.blocks.push({ t: 'p', id: this.nextId('p'), c: this.para, loc: this.loc(this.paraStart, this.pos) });
    }
    this.para = [];
    this.groupEm = [];
  }

  // ---------------------------------------------------------------- main loop

  /**
   * Parses [pos, end) into blocks, stopping at `\end{stopEnv}` (consumed), or at `\item` /
   * `\tagitem` when `stopAtItem` is set (not consumed).
   */
  parseBlocks(end: number, stopEnv?: string, stopAtItem = false): Block[] {
    const savedBlocks = this.blocks;
    const savedPara = this.para;
    const savedEnd = this.end;
    this.blocks = [];
    this.para = [];
    this.end = end;
    try {
      this.run(stopEnv, stopAtItem);
      this.flush();
      return this.blocks;
    } finally {
      this.blocks = savedBlocks;
      this.para = savedPara;
      this.end = savedEnd;
    }
  }

  /** Parses a range of the source into inline content (for titles and arguments). */
  parseInlineRange(start: number, end: number): Inline[] {
    const save = this.pos;
    this.pos = start;
    const blocks = this.parseBlocks(end);
    this.pos = Math.max(save, end + 1);
    const out: Inline[] = [];
    for (const b of blocks) {
      if (b.t === 'p') {
        if (out.length) out.push({ t: 'text', v: ' ' });
        out.push(...b.c);
      } else if (b.t === 'display') {
        for (const r of b.rows) out.push({ t: 'math', tex: r.tex, src: b.src });
      }
    }
    return out;
  }

  private run(stopEnv: string | undefined, stopAtItem: boolean) {
    while (this.pos < this.end) {
      const c = this.src[this.pos];
      if (c === '%') {
        this.skipComment();
        continue;
      }
      if (c === '\n') {
        // blank line?
        let j = this.pos + 1;
        while (j < this.end && (this.src[j] === ' ' || this.src[j] === '\t')) j++;
        if (this.src[j] === '\n') {
          this.flush();
          this.pos = j + 1;
          while (this.pos < this.end && /\s/.test(this.src[this.pos])) this.pos++;
        } else {
          this.pushText(' ');
          this.pos = j;
        }
        continue;
      }
      if (c === '\\') {
        const at = this.pos;
        // \[ … \] display, \( … \) inline
        if (this.peek(1) === '[') {
          this.pos += 2;
          const close = this.src.indexOf('\\]', this.pos);
          this.display('displaymath', this.pos, close, at);
          this.pos = close + 2;
          continue;
        }
        if (this.peek(1) === '(') {
          this.pos += 2;
          const close = this.src.indexOf('\\)', this.pos);
          this.inlineMath(this.pos, close);
          this.pos = close + 2;
          continue;
        }
        if (stopAtItem && (this.src.startsWith('\\item', this.pos) || this.src.startsWith('\\tagitem', this.pos)) && !/[a-zA-Z]/.test(this.src[this.pos + (this.src.startsWith('\\item', this.pos) ? 5 : 8)])) return;
        const name = this.readCsName();
        if (name === 'end') {
          const env = this.group();
          if (env === stopEnv) return;
          if (env === 'document') continue;
          this.diag('error', 'unexpected-end', `unexpected \\end{${env}}`, at);
          continue;
        }
        this.command(name, at);
        continue;
      }
      if (c === '$') {
        if (this.peek(1) === '$') {
          const close = this.src.indexOf('$$', this.pos + 2);
          const at = this.pos;
          this.display('displaymath', this.pos + 2, close, at);
          this.pos = close + 2;
          continue;
        }
        const start = this.pos + 1;
        const close = this.findMathClose(start);
        this.inlineMath(start, close);
        this.pos = close + 1;
        continue;
      }
      if (c === '{') {
        this.pos++;
        this.groupEm.push(-1);
        continue;
      }
      if (c === '}') {
        this.pos++;
        const em = this.groupEm.pop();
        if (em !== undefined && em >= 0) {
          const inner = this.para.splice(em);
          this.para.push({ t: 'em', c: inner });
        }
        continue;
      }
      if (c === '!' && this.peek(1) === '!') {
        const t = readToken(this.src, this.pos);
        this.pos = t.end;
        this.pushInline({ t: 'term', token: t.token, v: tokenText(this.ctx.config, t.token, t.caps, t.article, t.plural) });
        continue;
      }
      if (c === '!' && this.src.startsWith('!{}', this.pos)) {
        this.pushText('!');
        this.pos += 3;
        continue;
      }
      if (c === '`' && this.peek(1) === '`') {
        this.pushText('“');
        this.pos += 2;
        continue;
      }
      if (c === "'" && this.peek(1) === "'") {
        this.pushText('”');
        this.pos += 2;
        continue;
      }
      if (c === '`') {
        this.pushText('‘');
        this.pos++;
        continue;
      }
      if (c === "'") {
        this.pushText('’');
        this.pos++;
        continue;
      }
      if (c === '-' && this.peek(1) === '-') {
        if (this.peek(2) === '-') {
          this.pushText('—');
          this.pos += 3;
        } else {
          this.pushText('–');
          this.pos += 2;
        }
        continue;
      }
      if (c === '~') {
        this.pushText(' ');
        this.pos++;
        continue;
      }
      if (c === '\t') {
        this.pushText(' ');
        this.pos++;
        continue;
      }
      // Plain text run.
      let j = this.pos + 1;
      while (j < this.end && !/[\\%${}!`'~\n\t-]/.test(this.src[j])) j++;
      this.pushText(this.src.slice(this.pos, j).replace(/ {2,}/g, ' '));
      this.pos = j;
    }
    if (stopEnv) this.diag('error', 'unterminated-env', `missing \\end{${stopEnv}}`);
  }

  private findMathClose(start: number): number {
    let depth = 0;
    for (let j = start; j < this.end; j++) {
      const c = this.src[j];
      if (c === '\\') {
        j++;
        continue;
      }
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '$' && depth <= 0) return j;
    }
    throw new Error(`${this.file}:${this.line(start)}: unterminated $`);
  }

  // ---------------------------------------------------------------- mathematics

  private inlineMath(start: number, end: number) {
    const src = stripComments(this.src.slice(start, end)).trim();
    let tex: string;
    try {
      tex = expandMath(src, this.hooks()).replace(/\s+/g, ' ').trim();
    } catch (e) {
      this.diag('error', 'expand-failed', String(e), start);
      this.pushInline({ t: 'unsupported', name: 'math', raw: src });
      return;
    }
    const error = this.katexCheck(tex, false, start);
    this.pushInline(error ? { t: 'math', tex, src, error } : { t: 'math', tex, src });
  }

  private katexCheck(tex: string, display: boolean, at: number): string | undefined {
    try {
      katex.renderToString(tex, { displayMode: display, throwOnError: true, strict: false });
      return undefined;
    } catch (e) {
      const message = (e as Error).message;
      const undefinedCs = /Undefined control sequence: (\\[a-zA-Z@]+)/.exec(message);
      if (undefinedCs) this.diag('error', 'unsupported-macro', `${undefinedCs[1]} is neither an Open Logic macro nor known to KaTeX`, at);
      else this.diag('error', 'katex-error', message, at);
      return message;
    }
  }

  /**
   * A display environment. Rows are split so that each can carry its own label and number;
   * \intertext splits the display into several blocks with a paragraph between them.
   */
  private display(env: string, start: number, end: number, at: number) {
    this.flush();
    const raw = this.src.slice(start, end);
    const numbered = !env.endsWith('*') && env !== 'displaymath';
    const kind = env.replace('*', '');
    // Split at \intertext{…} (top level).
    const segments: { rows: string; inter?: { start: number; end: number } }[] = [];
    let segStart = 0;
    const re = /\\intertext\s*\{/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw))) {
      const g = readBalanced(raw, m.index + m[0].length - 1);
      segments.push({ rows: raw.slice(segStart, m.index), inter: { start: start + m.index + m[0].length, end: start + g.end - 1 } });
      segStart = g.end;
      re.lastIndex = g.end;
    }
    segments.push({ rows: raw.slice(segStart) });

    const multline = kind === 'multline';
    for (const seg of segments) {
      const rowsSrc = splitRows(stripComments(seg.rows));
      const rows: DisplayRow[] = [];
      rowsSrc.forEach((rowSrc, idx) => {
        let label: string | undefined;
        let tag: string | undefined;
        let notag = false;
        let body = rowSrc.replace(/\\(notag|nonumber)\b/g, () => {
          notag = true;
          return '';
        });
        body = body.replace(/\\tag\s*\{((?:[^{}]|\{[^{}]*\})*)\}/, (_, t: string) => {
          tag = t;
          return '';
        });
        let tex: string;
        try {
          tex = expandMath(body, this.hooks((key) => (label = key))).replace(/\s+/g, ' ').trim();
        } catch (e) {
          this.diag('error', 'expand-failed', String(e), at);
          tex = '\\text{(conversion failed)}';
        }
        if (tag !== undefined) tag = expandTextInMath(tag, this.hooks(), 0);
        const lastOfMultline = multline && idx === rowsSrc.length - 1;
        if (tag === undefined && numbered && !notag && (!multline || lastOfMultline)) {
          tag = `${this.chapter.number}.${++this.chapter.counters.eq}`;
        }
        if (!tex && !tag) return;
        const row: DisplayRow = { tex };
        if (tag !== undefined) row.tag = tag;
        if (label) {
          row.label = label;
          this.addLabel(label, { kind: 'equation', text: tag !== undefined ? `(${tag})` : '??', blockId: '' });
        }
        rows.push(row);
      });
      if (rows.length) {
        const id = this.nextId('d');
        for (const r of rows) if (r.label) this.ctx.labels.get(r.label)!.blockId = id;
        const outEnv = kind === 'multline' ? 'gather' : kind === 'displaymath' || kind === 'equation' ? 'equation' : kind === 'eqnarray' ? 'align' : kind;
        if (kind === 'multline') this.diag('info', 'multline', 'multline is typeset as gather (KaTeX has no multline)', at);
        const assembled = assembleDisplay(outEnv, rows);
        const error = this.katexCheck(assembled, true, at);
        const block: Block = { t: 'display', id, env: outEnv, rows, src: stripComments(seg.rows).trim(), loc: this.loc(at, end) };
        if (error) block.error = error;
        this.blocks.push(block);
      }
      if (seg.inter) {
        const c = this.parseInlineRange(seg.inter.start, seg.inter.end);
        this.blocks.push({ t: 'p', id: this.nextId('p'), c, loc: this.loc(seg.inter.start, seg.inter.end) });
      }
    }
  }

  // ---------------------------------------------------------------- commands

  private command(name: string, at: number) {
    const cfg = this.ctx.config;
    if (name === 'begin') {
      const env = this.group();
      this.environment(env, at);
      return;
    }
    if (name === 'par') {
      this.flush();
      return;
    }
    if (IGNORED.has(name)) {
      if (name === 'documentclass') {
        this.opt();
        this.group();
      }
      return;
    }
    if (IGNORED_WITH_ARG[name] !== undefined) {
      this.opt();
      for (let k = 0; k < IGNORED_WITH_ARG[name]; k++) this.group();
      return;
    }
    switch (name) {
      case 'olfileid': {
        this.opt();
        this.fileId = [this.group(), this.group(), this.group()];
        return;
      }
      case 'olsection': {
        const r = this.groupRange()!;
        const c = this.parseInlineRange(r.start, r.end);
        this.sectionTitle = { c, text: plain(c), start: at };
        return;
      }
      case 'olchapter': {
        this.opt();
        const p = this.group();
        const ch = this.group();
        this.fileId = [p, ch, 'udf'];
        const r = this.groupRange()!;
        this.chapterTitle = plain(this.parseInlineRange(r.start, r.end));
        return;
      }
      case 'olimport': {
        const star = this.src[this.pos] === '*';
        if (star) this.pos++;
        const path = this.opt();
        const file = this.group();
        this.imports.push({ path, name: file, star });
        this.onImport?.(path, file);
        return;
      }
      case 'iftag': {
        const tags = this.group();
        const yes = this.groupRange()!;
        const no = this.groupRange()!;
        const chosen = this.tagOn(tags) ? yes : no;
        this.splice(chosen.start, chosen.end);
        return;
      }
      case 'ollabel': {
        const key = this.qualify([], this.group());
        const frame = this.labelStack[this.labelStack.length - 1];
        if (frame) frame.onLabel(key);
        else this.diag('warning', 'orphan-label', `\\ollabel{${key}} outside any numbered element`, at);
        return;
      }
      case 'olref':
      case 'Olref': {
        const o = [this.opt(), undefined as string | undefined, undefined as string | undefined];
        if (o[0] !== undefined) o[1] = this.opt();
        if (o[1] !== undefined) o[2] = this.opt();
        const key = this.qualify(o, this.group());
        this.pushInline({ t: 'ref', key });
        return;
      }
      case 'text':
      case 'mbox': {
        const r = this.groupRange()!;
        this.splice(r.start, r.end);
        return;
      }
      case 'emph':
      case 'textit':
      case 'textbf':
      case 'textsc':
      case 'textsf':
      case 'texttt': {
        const r = this.groupRange()!;
        const c = this.parseInlineRange(r.start, r.end);
        this.pushInline(name === 'textbf' ? { t: 'strong', c } : name === 'emph' || name === 'textit' ? { t: 'em', c } : { t: 'em', c });
        return;
      }
      case 'em':
      case 'itshape':
      case 'it': {
        if (this.groupEm.length) this.groupEm[this.groupEm.length - 1] = this.para.length;
        return;
      }
      case 'footnote': {
        const r = this.groupRange()!;
        const save = this.pos;
        this.pos = r.start;
        const c = this.parseBlocks(r.end);
        this.pos = save;
        this.pushInline({ t: 'footnote', c });
        return;
      }
      case 'cite':
      case 'citet':
      case 'citep':
      case 'citealt':
      case 'citeauthor':
      case 'citeyear': {
        this.opt();
        this.opt();
        this.pushInline({ t: 'cite', keys: this.group().split(',').map((k) => k.trim()) });
        return;
      }
      case 'href': {
        const href = this.group();
        const r = this.groupRange()!;
        this.pushInline({ t: 'link', href, c: this.parseInlineRange(r.start, r.end) });
        return;
      }
      case 'url': {
        const href = this.group();
        this.pushInline({ t: 'link', href, c: [{ t: 'text', v: href }] });
        return;
      }
      case 'texorpdfstring': {
        const r = this.groupRange()!;
        this.group();
        this.splice(r.start, r.end);
        return;
      }
      case 'cref':
      case 'Cref': {
        const keys = this.group().split(',').map((k) => k.trim()).filter(Boolean);
        this.pushRefList(keys);
        return;
      }
      case 'tagrefs': {
        // \tagrefs{tag/{key},tag/{key},…}: the references whose tag is set.
        const spec = this.group();
        const keys: string[] = [];
        for (const m of spec.matchAll(/([A-Za-z]+)\/\{([^}]*)\}/g)) if (this.tagOn(m[1])) keys.push(m[2]);
        this.pushRefList(keys);
        return;
      }
      case 'usetoken':
      case 'printtoken': {
        const form = this.group();
        const token = this.group();
        const t = cfg.tokens.get(token);
        const v = t ? (form === 's' ? t.s : form === 'p' ? t.p : form === 'S' ? t.S : t.P) : token;
        this.pushInline({ t: 'term', token, v });
        return;
      }
      case 'item':
      case 'tagitem':
        this.diag('error', 'item-outside-list', `\\${name} outside a list`, at);
        return;
    }
    // Single-character commands.
    if (name.length === 1 && !/[a-zA-Z]/.test(name)) {
      const lit: Record<string, string> = { ' ': ' ', ',': ' ', '@': '', '/': '', '-': '', '%': '%', '&': '&', '#': '#', $: '$', _: '_', '{': '{', '}': '}', '\\': ' ', '\n': ' ', ';': ' ', ':': ' ', '!': '' };
      if (lit[name] !== undefined) {
        this.pushText(lit[name]);
        return;
      }
      const r = this.readAccentArg();
      const composed = accent(name, r);
      if (composed) {
        this.pushText(composed);
        return;
      }
    }
    if (name.length === 1 && 'uvHck'.includes(name) && (this.src[this.pos] === '{' || this.src[this.pos] === ' ')) {
      const composed = accent(name, this.readAccentArg());
      if (composed) {
        this.pushText(composed);
        return;
      }
    }
    const sym = textSymbol(name);
    if (sym !== undefined) {
      if (this.src.startsWith('{}', this.pos)) this.pos += 2;
      this.pushText(sym);
      return;
    }
    // Open Logic macros used in running text (e.g. \Th{Q} outside $…$) are typeset as mathematics.
    const def = cfg.macros.get(name);
    if (def) {
      const r = readArgs(this.src.slice(0, this.end), this.pos, def.args);
      const raw = this.src.slice(at, r.end);
      this.pos = r.end;
      const tex = expandMath(raw, this.hooks()).trim();
      const error = this.katexCheck(tex, false, at);
      this.pushInline(error ? { t: 'math', tex, src: raw, error } : { t: 'math', tex, src: raw });
      return;
    }
    this.diag('error', 'unsupported-command', `\\${name} is not handled by the converter`, at);
    this.pushInline({ t: 'unsupported', name, raw: `\\${name}` });
  }

  private pushRefList(keys: string[]) {
    keys.forEach((key, k) => {
      if (k > 0) this.pushText(k === keys.length - 1 ? (keys.length > 2 ? ', and ' : ' and ') : ', ');
      this.pushInline({ t: 'ref', key });
    });
  }

  private readAccentArg(): string {
    if (this.src[this.pos] === '{') return this.group();
    if (this.src[this.pos] === '\\') {
      const n = this.readCsName();
      return n === 'i' ? 'ı' : n;
    }
    return this.src[this.pos++];
  }

  tagOn(tags: string): boolean {
    return tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .some((t) => {
        const v = this.ctx.config.tags.get(t);
        if (v === undefined) this.diag('warning', 'unknown-tag', `tag ${t} is not set by the book configuration`);
        return v === true;
      });
  }

  /** Parses a sub-range in the current paragraph context (used by \iftag). */
  private splice(start: number, end: number) {
    const save = this.pos;
    const saveEnd = this.end;
    this.pos = start;
    this.end = end;
    this.run(undefined, false);
    this.pos = save;
    this.end = saveEnd;
  }

  // ---------------------------------------------------------------- environments

  private environment(env: string, at: number) {
    if (MATH_ENVS.has(env)) {
      const close = this.findEnd(env);
      this.display(env, this.pos, close.start, at);
      this.pos = close.end;
      return;
    }
    if (env === 'editorial' || env === 'comment') {
      const close = this.findEnd(env);
      this.diag('info', 'editorial-omitted', `${env} note omitted (not printed in the book)`, at);
      this.pos = close.end;
      return;
    }
    if (env === 'document') return;
    if (env === 'prooftree') {
      const close = this.findEnd(env);
      this.flush();
      const root = this.prooftree(this.pos, close.start, at);
      if (root) this.blocks.push({ t: 'prooftree', id: this.nextId('tree'), root, loc: this.loc(at, close.end) });
      this.pos = close.end;
      return;
    }
    if (env === 'tabular' || env === 'array') {
      this.group();
      const close = this.findEnd(env);
      this.flush();
      const rows = splitRows(this.src.slice(this.pos, close.start)).map((row) => {
        const cells: Inline[][] = [];
        // Split the row at top-level & and parse each cell as text.
        const rowStart = this.src.indexOf(row, this.pos);
        let depth = 0;
        let cellStart = 0;
        for (let k = 0; k <= row.length; k++) {
          const ch = row[k];
          if (ch === '\\') {
            k++;
            continue;
          }
          if (ch === '{') depth++;
          else if (ch === '}') depth--;
          if ((ch === '&' && depth === 0) || k === row.length) {
            cells.push(this.parseInlineRange(rowStart + cellStart, rowStart + k));
            cellStart = k + 1;
          }
        }
        return cells;
      });
      this.blocks.push({ t: 'table', id: this.nextId('table'), rows, loc: this.loc(at, close.end) });
      this.pos = close.end;
      return;
    }
    if (env === 'tagblock') {
      const tags = this.group();
      const close = this.findEnd(env);
      if (this.tagOn(tags)) this.splice(this.pos, close.start);
      this.pos = close.end;
      return;
    }
    if (env === 'enumerate' || env === 'itemize' || env === 'tagenumerate' || env === 'description') {
      if (env === 'tagenumerate') this.group();
      this.opt();
      this.list(env, at);
      return;
    }
    const kind = envKind(env);
    if (!kind) {
      const close = this.findEnd(env);
      this.diag('error', 'unsupported-env', `environment ${env} is not handled by the converter`, at);
      this.flush();
      this.blocks.push({ t: 'p', id: this.nextId('p'), c: [{ t: 'unsupported', name: env, raw: this.src.slice(at, close.end) }], loc: this.loc(at, close.end) });
      this.pos = close.end;
      return;
    }
    this.flush();
    const titleRange = this.optRange();
    const title = titleRange ? this.parseInlineRange(titleRange.start, titleRange.end) : undefined;
    let number: string | undefined;
    const name = THEOREM_NAMES[kind];
    if (name && kind !== 'rem' && kind !== 'conv') {
      if (SHARED_COUNTER.has(kind)) number = `${this.chapter.number}.${++this.chapter.counters.thm}`;
      else if (kind === 'prob') number = `${this.chapter.number}.${++this.chapter.counters.prob}`;
    }
    const block: Extract<Block, { t: 'env' }> = { t: 'env', id: '', kind, c: [], loc: this.loc(at, at) };
    if (number) block.number = number;
    if (title) block.title = title;
    if (kind === 'proof' && title) {
      const ref = findRef(title);
      if (ref) block.proves = ref;
    }
    const id = this.nextId(kind);
    block.id = id;
    this.labelStack.push({
      onLabel: (key) => {
        block.label = key;
        block.id = `${this.sectionId()}/${key.split(':').slice(3).join(':')}`;
        this.addLabel(key, { kind, text: name ? `${name} ${number ?? ''}`.trim() : kind, blockId: block.id });
      },
    });
    block.c = this.parseBlocks(this.src.length, env);
    this.labelStack.pop();
    block.loc = this.loc(at, this.pos);
    this.blocks.push(block);
  }

  private list(env: string, at: number) {
    this.flush();
    const ordered = env !== 'itemize';
    const items: ListItem[] = [];
    const close = this.findEnd(env);
    const endPos = close.start;
    // Skip to the first item.
    this.skipWs();
    let index = 0;
    while (this.pos < endPos) {
      this.skipWs();
      if (this.pos >= endPos) break;
      let content: { start: number; end: number } | null = null;
      let marker: Inline[] | undefined;
      if (this.src.startsWith('\\tagitem', this.pos)) {
        this.pos += 8;
        const tag = this.group();
        const yes = this.groupRange()!;
        const no = this.groupRange()!;
        const chosen = this.tagOn(tag) ? yes : no;
        if (chosen.end <= chosen.start || !this.src.slice(chosen.start, chosen.end).trim()) continue;
        content = chosen;
      } else if (this.src.startsWith('\\item', this.pos)) {
        this.pos += 5;
        const m = this.optRange();
        if (m) marker = this.parseInlineRange(m.start, m.end);
      } else {
        // Material before the first \item (should not happen).
        const junk = this.parseBlocks(endPos, undefined, true);
        if (junk.length) this.diag('warning', 'list-junk', 'content before first \\item', at);
        continue;
      }
      const item: ListItem = { id: '', c: [] };
      index++;
      const itemNumber = index;
      item.id = this.nextId('i');
      if (marker) item.marker = marker;
      this.labelStack.push({
        onLabel: (key) => {
          item.label = key;
          this.addLabel(key, { kind: 'item', text: `(${itemNumber})`, blockId: item.id });
        },
      });
      if (content) {
        const save = this.pos;
        this.pos = content.start;
        item.c = this.parseBlocks(content.end);
        this.pos = save;
      } else {
        item.c = this.parseBlocks(endPos, undefined, true);
      }
      this.labelStack.pop();
      items.push(item);
    }
    this.pos = close.end;
    this.blocks.push({ t: 'list', id: this.nextId('l'), ordered, items, loc: this.loc(at, this.pos) });
  }

  /** bussproofs: a stack machine over \AxiomC, \UnaryInfC, \BinaryInfC, … */
  private prooftree(start: number, end: number, at: number): ProofTreeNode | null {
    const stack: ProofTreeNode[] = [];
    let right: Inline[] | undefined;
    let left: Inline[] | undefined;
    let line: ProofTreeNode['line'] = 'single';
    const save = this.pos;
    this.pos = start;
    const arity: Record<string, number> = { DeduceC: 1, Axiom: 0, AxiomC: 0, UnaryInf: 1, UnaryInfC: 1, BinaryInf: 2, BinaryInfC: 2, TrinaryInf: 3, TrinaryInfC: 3, QuaternaryInf: 4, QuaternaryInfC: 4 };
    while (this.pos < end) {
      this.skipWs();
      if (this.pos >= end) break;
      if (this.src[this.pos] !== '\\') {
        this.diag('error', 'prooftree', `unexpected text in prooftree`, this.pos);
        this.pos++;
        continue;
      }
      const cmdAt = this.pos;
      const name = this.readCsName();
      if (name in arity) {
        let c: Inline[];
        if (name.endsWith('C')) {
          const r = this.groupRange()!;
          c = this.parseInlineRange(r.start, r.end);
        } else {
          // \Axiom$…\fCenter…$ form: the content is one piece of mathematics.
          this.skipWs();
          const close = this.findMathClose(this.pos + 1);
          c = this.parseInlineRange(this.pos, close + 1);
          this.pos = close + 1;
        }
        const n = arity[name];
        if (stack.length < n) {
          this.diag('error', 'prooftree', `\\${name} needs ${n} premises`, cmdAt);
          break;
        }
        const node: ProofTreeNode = { c, line: n === 0 ? 'none' : name === 'DeduceC' ? 'dots' : line, premises: stack.splice(stack.length - n, n) };
        if (right) node.right = right;
        if (left) node.left = left;
        right = left = undefined;
        line = 'single';
        stack.push(node);
      } else if (name === 'RightLabel' || name === 'LeftLabel') {
        const r = this.groupRange()!;
        const c = this.parseInlineRange(r.start, r.end);
        if (name === 'RightLabel') right = c;
        else left = c;
      } else if (name === 'DischargeRule') {
        const r = this.groupRange()!;
        right = this.parseInlineRange(r.start, r.end);
        const n = this.groupRange()!;
        left = this.parseInlineRange(n.start, n.end);
      } else if (name === 'noLine') line = 'none';
      else if (name === 'singleLine') line = 'single';
      else if (name === 'doubleLine') line = 'double';
      else if (name === 'dashedLine') line = 'dashed';
      else if (name === 'DisplayProof') continue;
      else this.diag('error', 'prooftree', `\\${name} is not supported inside prooftree`, cmdAt);
    }
    this.pos = save;
    if (stack.length !== 1) {
      this.diag('error', 'prooftree', `prooftree leaves ${stack.length} trees on the stack`, at);
      return stack[stack.length - 1] ?? null;
    }
    return stack[0];
  }

  /** Finds the matching \end{env} (respecting nesting); returns its range. */
  private findEnd(env: string): { start: number; end: number } {
    const begin = `\\begin{${env}}`;
    const endTag = `\\end{${env}}`;
    let depth = 1;
    let j = this.pos;
    while (j < this.src.length) {
      const b = this.src.indexOf(begin, j);
      const e = this.src.indexOf(endTag, j);
      if (e < 0) break;
      if (b >= 0 && b < e) {
        depth++;
        j = b + begin.length;
      } else {
        depth--;
        if (depth === 0) return { start: e, end: e + endTag.length };
        j = e + endTag.length;
      }
    }
    throw new Error(`${this.file}:${this.line(this.pos)}: missing \\end{${env}}`);
  }

  /** Parses the whole file (or the rest of it) into blocks. */
  parseAll(): Block[] {
    this.pos = 0;
    return this.parseBlocks(this.src.length);
  }
}

function envKind(env: string): EnvKind | null {
  const map: Record<string, EnvKind> = {
    defn: 'defn', prop: 'prop', thm: 'thm', lem: 'lem', cor: 'cor', ex: 'ex', prob: 'prob', probtag: 'prob',
    proof: 'proof', explain: 'explain', digress: 'digress', intro: 'intro', history: 'history',
    quote: 'quote', quotation: 'quote', center: 'center', rem: 'rem', conv: 'conv',
  };
  return map[env] ?? null;
}

function findRef(c: Inline[]): string | undefined {
  for (const x of c) {
    if (x.t === 'ref') return x.key;
    if ('c' in x && Array.isArray(x.c)) {
      const r = findRef(x.c as Inline[]);
      if (r) return r;
    }
  }
  return undefined;
}

export function plain(c: Inline[]): string {
  return c
    .map((x) => {
      switch (x.t) {
        case 'text':
        case 'term':
          return x.v;
        case 'math':
          return x.tex.replace(/\\[a-zA-Z]+/g, '').replace(/[{}]/g, '').trim();
        case 'em':
        case 'strong':
        case 'quote':
        case 'link':
          return plain(x.c);
        default:
          return '';
      }
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Splits an aligned environment into rows at top-level `\\`. */
export function splitRows(s: string): string[] {
  const rows: string[] = [];
  let depth = 0;
  let envDepth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\') {
      if (s.startsWith('\\begin{', i)) envDepth++;
      else if (s.startsWith('\\end{', i)) envDepth--;
      else if (s[i + 1] === '\\' && depth === 0 && envDepth === 0) {
        rows.push(s.slice(start, i));
        i++;
        // optional [len] after \\
        let j = i + 1;
        while (s[j] === ' ') j++;
        if (s[j] === '[') {
          const close = s.indexOf(']', j);
          i = close;
        }
        start = i + 1;
        continue;
      }
      i++;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') depth--;
  }
  rows.push(s.slice(start));
  return rows.map((r) => r.trim()).filter((r, idx, all) => r !== '' || idx < all.length - 1);
}

export type { ChapterState };
export { assembleDisplay };

// ---------------------------------------------------------------- book structure

export interface ChapterPlan {
  /** Path of the chapter driver relative to upstream/OpenLogic/content, e.g. incompleteness/arithmetization-syntax. */
  path: string;
  number: string;
}

/** Reads ic.tex and returns the chapter numbering of the main matter. */
export function readBookPlan(upstreamDir: string): ChapterPlan[] {
  const src = stripComments(readFileSync(join(upstreamDir, 'incompleteness-computability', 'ic.tex'), 'utf8'));
  const main = src.slice(src.indexOf('\\mainmatter'));
  const plan: ChapterPlan[] = [];
  let n = 0;
  let appendix = false;
  let letter = 0;
  const re = /\\(olimport\*?\s*\[([^\]]*)\]\s*\{([^}]*)\}|chapter\s*\{|appendix\b|input\s*\{include\/ic-derivations\})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(main))) {
    if (m[1].startsWith('appendix')) {
      appendix = true;
      continue;
    }
    const num = () => (appendix ? String.fromCharCode(65 + letter++) : String(++n));
    if (m[1].startsWith('chapter') || m[1].startsWith('input')) {
      num();
      continue;
    }
    const path = m[2];
    const name = m[3];
    // A chapter import is one whose file name is the last component of its path.
    if (path.split('/').pop() === name) plan.push({ path, number: num() });
  }
  return plan;
}

export function convertChapter(ctx: ConvertContext, plan: ChapterPlan): Chapter {
  const chapter: ChapterState = { number: plan.number, counters: { thm: 0, prob: 0, eq: 0, section: 0 } };
  const dir = `content/${plan.path}`;
  const name = plan.path.split('/').pop()!;
  const sections: Section[] = [];
  let currentSection = 'udf';
  const driver = new FileParser(ctx, 'OpenLogic', `${dir}/${name}.tex`, chapter, () => currentSection, (_path, file) => {
    const p = new FileParser(ctx, 'OpenLogic', `${dir}/${file}.tex`, chapter, () => currentSection);
    // Read \olfileid first so that ids and labels are right from the start.
    const idMatch = /\\olfileid(?:\[[^\]]*\])?\{([^}]*)\}\{([^}]*)\}\{([^}]*)\}/.exec(p.src);
    if (!idMatch) {
      ctx.diagnostics.push({ level: 'error', code: 'no-fileid', message: `${file}.tex has no \\olfileid` });
      return;
    }
    currentSection = `${idMatch[1]}.${idMatch[2]}.${idMatch[3]}`;
    const number = `${plan.number}.${++chapter.counters.section}`;
    const blocks = p.parseAll();
    const title = p.sectionTitle ?? { c: [{ t: 'text', v: file } as Inline], text: file, start: 0 };
    const key = `${idMatch[1]}:${idMatch[2]}:${idMatch[3]}:sec`;
    ctx.labels.set(key, { kind: 'section', text: `Section ${number}`, sectionId: currentSection, blockId: currentSection });
    sections.push({ id: currentSection, number, title: title.c, titleText: title.text, loc: p.loc(0, p.src.length), blocks });
  });
  driver.parseAll();
  const id = `${driver.fileId[0]}.${driver.fileId[1]}`;
  ctx.labels.set(`${driver.fileId[0]}:${driver.fileId[1]}::chap`, { kind: 'chapter', text: `Chapter ${plan.number}`, sectionId: sections[0]?.id ?? id, blockId: id });
  const result: Chapter = { id, number: plan.number, title: driver.chapterTitle ?? name, loc: driver.loc(0, driver.src.length), sections };
  // The book's end-of-chapter summary.
  try {
    const summary = new FileParser(ctx, 'incompleteness-computability', `include/summary-${plan.number}.tex`, chapter, () => `${id}.summary`);
    summary.fileId = [driver.fileId[0], driver.fileId[1], 'sum'];
    result.summary = summary.parseAll();
  } catch {
    // no summary for this chapter
  }
  return result;
}
