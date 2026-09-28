// LaTeX text → structured blocks (src/content/schema.ts).
//
// The parser walks the upstream files the way the book's driver (ic.tex) does: chapter files
// import section files with \olimport, \iftag selects material by the book's tags, labels are
// qualified by \olfileid exactly as open-logic-referencing.sty does, and theorem-like
// environments are numbered per chapter as in open-logic-envs.sty (thm, ex, lem, prop, cor and
// defn share a counter; problems have their own).

import { existsSync, readFileSync } from 'node:fs';
import { applyErrata, type Errata } from './errata.ts';
import { join } from 'node:path';
import katex from 'katex';
import type { Block, Chapter, Diagnostic, DisplayRow, EnvKind, Inline, LabelTarget, ListItem, ProofTreeNode, Section, SourceLoc } from '../../src/content/schema.ts';
import type { ConfigState } from './macros.ts';
import { applyOverrides, readConfig, stripComments } from './macros.ts';
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
  /** \\olsection is switched off (\\let\\olsection\\nosection): section files add to the current section. */
  olsectionSuppressed?: boolean;
  /** Environments switched off by the book (\\let\\intro\\comment in the appendices). */
  suppressedEnvs: Set<string>;
  /** Corrections applied to the source before conversion (scripts/latex/errata.ts). */
  errata?: Errata;
}

export interface BookHandler {
  receive(blocks: Block[]): void;
  chapter(title: Inline[], label: string | undefined, loc: SourceLoc): void;
  section(title: Inline[], loc: SourceLoc): void;
  importFile(path: string | undefined, name: string, noSection: boolean): void;
  input(file: string): void;
  part(name: string): void;
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
  private skipProb = false;
  private ycommaFirst = false;
  /** Set when this file is walked as part of the book structure (ic.tex, chapter drivers). */
  book?: BookHandler;

  readonly ctx: ConvertContext;
  readonly repo: Repo;
  readonly file: string;
  /** The numbering state of the current chapter (for the driver file, whichever chapter is open). */
  private chapterState: () => ChapterState;
  get chapter(): ChapterState {
    return this.chapterState();
  }
  private sectionId: () => string;
  /** Called for \olimport in driver files. */
  private onImport?: (path: string | undefined, name: string) => void;

  constructor(
    ctx: ConvertContext,
    repo: Repo,
    file: string,
    chapter: ChapterState | (() => ChapterState),
    sectionId: () => string,
    onImport?: (path: string | undefined, name: string) => void,
  ) {
    this.ctx = ctx;
    this.repo = repo;
    this.file = file;
    this.chapterState = typeof chapter === 'function' ? chapter : () => chapter;
    this.sectionId = sectionId;
    this.onImport = onImport;
    this.src = applyErrata(ctx.errata, repo, file, readFileSync(join(ctx.upstreamDir, repo, file), 'utf8'), ctx.diagnostics);
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
        if (stopAtItem && this.iftagHoldsItems()) return;
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
        this.pushToken(t.token, tokenText(this.ctx.config, t.token, t.caps, t.article, t.plural));
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
    // Brace groups opened by \text-like commands contain text, where $…$ is nested mathematics.
    const kinds: boolean[] = [];
    for (let j = start; j < this.end; j++) {
      const c = this.src[j];
      if (c === '\\') {
        const m = /^\\(text|mbox|textrm|textit|textbf|emph|hbox)\s*\{/.exec(this.src.slice(j, j + 12));
        if (m) {
          kinds.push(true);
          depth++;
          j += m[0].length - 1;
          continue;
        }
        j++;
        continue;
      }
      if (c === '{') {
        kinds.push(false);
        depth++;
      } else if (c === '}') {
        kinds.pop();
        depth--;
      } else if (c === '$' && kinds[kinds.length - 1] === true) {
        // nested mathematics inside \text{…}: skip to its closing $
        const k = this.src.indexOf('$', j + 1);
        if (k > 0) j = k;
      } else if (c === '$') {
        // TeX ends math mode at a $ even inside a group (and complains); so do we.
        if (depth !== 0) this.diag('warning', 'unbalanced-math', 'a $ inside an unclosed brace group (upstream typo?)', j);
        return j;
      }
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
    if (this.book && this.bookCommand(name, at)) return;
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
      case 'olphoto': {
        this.group();
        this.group();
        this.diag('info', 'photo-omitted', 'photograph omitted (photos are not part of this edition)', at);
        return;
      }
      case 'olfileid': {
        this.opt();
        this.fileId = [this.group(), this.group(), this.group()];
        return;
      }
      case 'olsection': {
        if (this.src[this.pos] === '*') this.pos++;
        this.opt();
        const r = this.groupRange()!;
        if (this.ctx.olsectionSuppressed) return;
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
        this.pushToken(token, v);
        return;
      }
      case 'item':
      case 'tagitem':
        this.diag('error', 'item-outside-list', `\\${name} outside a list`, at);
        return;
      case 'indcase': {
        // \indcase*!{A}{complex}{case text}: defines \indfrm, \indcomplex and typesets the case.
        const star = this.src[this.pos] === '*';
        if (star) this.pos++;
        const bang = this.src[this.pos] === '!';
        if (bang) this.pos++;
        const a = this.group();
        const b = this.group();
        const body = this.groupRange()!;
        for (const [nm, v] of [['indfrm', a], ['indfrmp', a], ['indcomplex', b]] as const) {
          this.ctx.config.macros.set(nm, { name: nm, args: [], body: v, origin: 'upstream', from: `\\indcase at ${this.file}:${this.line(at)}` });
        }
        const lead = star ? `${a}` : `${a} \\ident ${b}`;
        const tex = expandMath(lead, this.hooks()).replace(/\s+/g, ' ').trim();
        this.pushInline({ t: 'math', tex, src: lead });
        this.pushText(star ? ' is atomic: ' : ': ');
        if (bang) this.pushText('exercise.');
        else this.splice(body.start, body.end);
        return;
      }
      case 'DeclareDocumentMacro':
      case 'DeclareDocumentCommand':
      case 'NewDocumentCommand':
      case 'RenewDocumentCommand':
      case 'DeclareRobustCommand':
      case 'newcommand':
      case 'renewcommand':
      case 'providecommand': {
        // A local definition: register it, as LaTeX would.
        if (this.src[this.pos] === '*') this.pos++;
        this.skipWs();
        if (this.src[this.pos] === '{') this.group();
        else this.readCsName();
        if (name.endsWith('DocumentCommand')) this.group();
        else if (!name.endsWith('Macro')) {
          this.opt();
          this.opt();
        }
        this.group();
        readConfig(this.ctx.config, this.src.slice(at, this.pos), `${this.file}:${this.line(at)}`);
        applyOverrides(this.ctx.config);
        return;
      }
      case 'section':
      case 'subsection':
      case 'subsubsection': {
        if (this.src[this.pos] === '*') this.pos++;
        this.opt();
        const r = this.groupRange()!;
        if (name === 'section' && this.sectionTitle === null && this.blocks.length === 0 && this.para.length === 0) {
          // some section files use \\section instead of \\olsection
          if (this.ctx.olsectionSuppressed) return;
          const c = this.parseInlineRange(r.start, r.end);
          this.sectionTitle = { c, text: plain(c), start: at };
          return;
        }
        this.flush();
        this.blocks.push({ t: 'heading', id: this.nextId('h'), level: name === 'section' ? 3 : 4, c: this.parseInlineRange(r.start, r.end), loc: this.loc(at, this.pos) });
        return;
      }
      case 'tagprob': {
        const def = this.opt();
        const tags = this.group();
        this.skipProb = !(this.tagOn(def ?? 'tagTrue') && this.tagOn(tags));
        return;
      }
      case 'tagendprob':
        this.skipProb = false;
        return;
      case 'startycommalist':
        this.ycommaFirst = true;
        return;
      case 'ycomma':
        if (!this.ycommaFirst) this.pushText(', ');
        this.ycommaFirst = false;
        return;
      case 'article':
      case 'Article': {
        const t = this.ctx.config.tokens.get(this.group().trim());
        const art = t?.an ? 'an' : 'a';
        this.pushText(name === 'Article' ? art[0].toUpperCase() + art.slice(1) : art);
        return;
      }
      case 'citeyearpar':
        this.opt();
        this.opt();
        this.pushInline({ t: 'cite', keys: this.group().split(',').map((k) => k.trim()) });
        return;
      case 'quad':
      case 'qquad':
        this.pushText('\u2003');
        return;
      case 'AxiomC':
      case 'Axiom': {
        // bussproofs outside a prooftree environment: up to \DisplayProof
        const close = this.src.indexOf('\\DisplayProof', at);
        const endAt = close < 0 || close > this.end ? this.end : close;
        this.flush();
        for (const root of this.prooftree(at, endAt, at)) this.blocks.push({ t: 'prooftree', id: this.nextId('tree'), root, loc: this.loc(at, endAt) });
        this.pos = close < 0 ? this.end : Math.min(this.end, close + '\\DisplayProof'.length);
        return;
      }
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

  /** A terminology token; its text may itself contain mathematics (e.g. “$\\lambd$-definable”). */
  private pushToken(token: string, v: string) {
    if (!/[$\\]/.test(v)) {
      this.pushInline({ t: 'term', token, v });
      return;
    }
    for (const part of v.split(/(\$[^$]*\$)/)) {
      if (!part) continue;
      if (part.startsWith('$')) {
        const src = part.slice(1, -1);
        this.pushInline({ t: 'math', tex: expandMath(src, this.hooks()).replace(/\s+/g, ' ').trim(), src });
      } else this.pushText(part);
    }
  }

  private pushRefList(keys: string[]) {
    keys.forEach((key, k) => {
      if (k > 0) this.pushText(k === keys.length - 1 ? (keys.length > 2 ? ', and ' : ' and ') : ', ');
      this.pushInline({ t: 'ref', key });
    });
  }

  /** Structural commands of the book's driver files. Returns true if handled. */
  private bookCommand(name: string, at: number): boolean {
    const book = this.book!;
    const hand = () => book.receive(this.drain());
    switch (name) {
      case 'chapter': {
        const star = this.src[this.pos] === '*';
        if (star) this.pos++;
        this.opt();
        const r = this.groupRange()!;
        const title = this.parseInlineRange(r.start, r.end);
        let label: string | undefined;
        const save = this.pos;
        this.skipWs();
        if (this.src.startsWith('\\label', this.pos)) {
          this.pos += 6;
          label = this.group();
        } else this.pos = save;
        hand();
        book.chapter(title, label, this.loc(at, this.pos));
        return true;
      }
      case 'section':
      case 'olsection': {
        const star = this.src[this.pos] === '*';
        if (star) this.pos++;
        this.opt();
        const r = this.groupRange()!;
        if (this.ctx.olsectionSuppressed) return true;
        const title = this.parseInlineRange(r.start, r.end);
        hand();
        book.section(title, this.loc(at, this.pos));
        return true;
      }
      case 'olimport': {
        const star = this.src[this.pos] === '*';
        if (star) this.pos++;
        const path = this.opt();
        const file = this.group();
        const trailing = this.opt();
        hand();
        book.importFile(path, file, !!trailing && trailing.includes('nosection'));
        return true;
      }
      case 'input': {
        const file = this.group();
        hand();
        book.input(file);
        return true;
      }
      case 'appendix':
      case 'mainmatter':
      case 'frontmatter':
        hand();
        book.part(name);
        return true;
      case 'backmatter':
        hand();
        this.pos = this.end;
        return true;
      case 'let': {
        const a = this.readLetName();
        const b = this.readLetName();
        if (a === 'olsection') this.ctx.olsectionSuppressed = b === 'nosection';
        if (b === 'comment' && a !== 'endintro') this.ctx.suppressedEnvs.add(a);
        return true;
      }
      case 'def': {
        const nm = this.readLetName();
        while (this.src[this.pos] === '#' && /\d/.test(this.src[this.pos + 1])) this.pos += 2;
        const body = this.group();
        if (nm === 'olsection' && body.trim() === '') this.ctx.olsectionSuppressed = true;
        return true;
      }
      case 'label':
        this.group();
        return true;
      case 'OLPfrontmatter':
      case 'stopproblems':
      case 'photocredits':
        return true;
      case 'preto':
        this.readLetName();
        this.group();
        return true;
    }
    return false;
  }

  private readLetName(): string {
    this.skipWs();
    if (this.src[this.pos] !== '\\') return '';
    return this.readCsName();
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
    if (env === 'editorial' || env === 'comment' || this.ctx.suppressedEnvs.has(env) || (env === 'prob' && this.skipProb)) {
      const close = this.findEnd(env);
      this.diag('info', 'editorial-omitted', `${env} note omitted (not printed in the book)`, at);
      this.pos = close.end;
      return;
    }
    if (env === 'document') return;
    if (env === 'prooftree') {
      const close = this.findEnd(env);
      this.flush();
      for (const root of this.prooftree(this.pos, close.start, at)) this.blocks.push({ t: 'prooftree', id: this.nextId('tree'), root, loc: this.loc(at, close.end) });
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
    // \begin{probtag}{tags} is a problem whose tags the book's style ignores; skip the tag list.
    if (env === 'probtag') this.group();
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
    this.collectItems(close.start, items, at);
    this.pos = close.end;
    this.blocks.push({ t: 'list', id: this.nextId('l'), ordered, items, loc: this.loc(at, this.pos) });
  }

  /** Does \\iftag at the current position select a branch that starts with an item? */
  private iftagHoldsItems(): { tags: string; yes: { start: number; end: number }; no: { start: number; end: number } } | null {
    if (!this.src.startsWith('\\iftag', this.pos) || /[a-zA-Z]/.test(this.src[this.pos + 6])) return null;
    const save = this.pos;
    this.pos += 6;
    const tags = this.group();
    const yes = this.groupRange();
    const no = this.groupRange();
    this.pos = save;
    if (!yes || !no) return null;
    const on = this.tagOn(tags);
    const text = (r: { start: number; end: number }) => this.src.slice(r.start, r.end).replace(/%[^\n]*/g, '').trim();
    const isItems = (b: string) => b.startsWith('\\item') || b.startsWith('\\tagitem');
    const body = text(on ? yes : no);
    const other = text(on ? no : yes);
    // An empty branch is item-level only if the other branch holds items; otherwise it is an
    // inline \iftag inside an item's text (as in the list of connectives in fol.syn.fol).
    return isItems(body) || (body === '' && isItems(other)) ? { tags, yes, no } : null;
  }

  private collectItems(endPos: number, items: ListItem[], at: number) {
    while (this.pos < endPos) {
      this.skipWs();
      if (this.pos >= endPos) break;
      let content: { start: number; end: number } | null = null;
      let marker: Inline[] | undefined;
      const tagged = this.iftagHoldsItems();
      if (tagged) {
        this.pos += 6;
        this.group();
        this.groupRange();
        this.groupRange();
        const after = this.pos;
        const chosen = this.tagOn(tagged.tags) ? tagged.yes : tagged.no;
        this.pos = chosen.start;
        this.collectItems(chosen.end, items, at);
        this.pos = after;
        continue;
      }
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
        // Material before the first \\item (should not happen).
        const junk = this.parseBlocks(endPos, undefined, true);
        if (junk.length) this.diag('warning', 'list-junk', 'content before first \\item', at);
        if (this.iftagHoldsItems() === null && !this.src.startsWith('\\item', this.pos) && !this.src.startsWith('\\tagitem', this.pos)) break;
        continue;
      }
      const item: ListItem = { id: '', c: [] };
      const itemNumber = items.length + 1;
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
  }

  /** bussproofs: a stack machine over \AxiomC, \UnaryInfC, \BinaryInfC, … */
  private prooftree(start: number, end: number, at: number): ProofTreeNode[] {
    const stack: ProofTreeNode[] = [];
    const forest: ProofTreeNode[] = [];
    let right: Inline[] | undefined;
    let left: Inline[] | undefined;
    let line: ProofTreeNode['line'] = 'single';
    const save = this.pos;
    this.pos = start;
    const arity: Record<string, number> = { QuinaryInfC: 5, DeduceC: 1, Axiom: 0, AxiomC: 0, UnaryInf: 1, UnaryInfC: 1, BinaryInf: 2, BinaryInfC: 2, TrinaryInf: 3, TrinaryInfC: 3, QuaternaryInf: 4, QuaternaryInfC: 4 };
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
      else if (name === 'DisplayProof') {
        if (stack.length === 1) forest.push(stack.pop()!);
        continue;
      }
      else if (name === 'insertBetweenHyps' || name === 'hspace' || name === 'vspace') this.group();
      else if (name === 'hskip' || name === 'kern') this.pos += /^\s*-?[\d.]+\s*[a-z]{2}/.exec(this.src.slice(this.pos))?.[0].length ?? 0;
      else if (['footnotesize', 'small', 'scriptsize', 'normalsize', 'bottomAlignProof', 'centerAlignProof', 'topAlignProof', 'alwaysNoLine', 'alwaysSingleLine'].includes(name)) continue;
      else if (name === 'RightSubproofLabel' || name === 'LeftSubproofLabel') this.group();
      else if (name === 'def' || name === 'let') {
        this.readLetName();
        if (name === 'let') this.readLetName();
        else this.group();
      } else this.diag('error', 'prooftree', `\\${name} is not supported inside prooftree`, cmdAt);
    }
    this.pos = save;
    if (stack.length === 1) forest.push(stack.pop()!);
    if (stack.length !== 0) this.diag('error', 'prooftree', `prooftree leaves ${stack.length} trees on the stack`, at);
    return forest;
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

  /** Hands over the blocks accumulated at top level (book mode). */
  drain(): Block[] {
    this.flush();
    const b = this.blocks;
    this.blocks = [];
    return b;
  }

  /** Walks [start, end) at top level, keeping blocks for drain() (book mode). */
  walk(start: number, end: number) {
    this.pos = start;
    this.end = end;
    this.blocks = [];
    this.para = [];
    this.run(undefined, false);
    this.flush();
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
    defish: 'defish', reading: 'reading',
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
          return texToPlain(x.tex);
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

const TEX_PLAIN: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', eta: 'η', theta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π',
  rho: 'ρ', sigma: 'σ', tau: 'τ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω', Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  forall: '∀', exists: '∃', lnot: '¬', neg: '¬', land: '∧', wedge: '∧', lor: '∨', vee: '∨', to: '→', rightarrow: '→', leftrightarrow: '↔', Rightarrow: '⇒', bot: '⊥', top: '⊤',
  vDash: '⊨', models: '⊨', vdash: '⊢', nvdash: '⊬', nvDash: '⊭', leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠', in: '∈', notin: '∉', subseteq: '⊆', subset: '⊂', cup: '∪', cap: '∩', emptyset: '∅',
  times: '×', cdot: '·', circ: '∘', langle: '⟨', rangle: '⟩', ulcorner: '⌜', urcorner: '⌝', ldots: '…', dots: '…', cdots: '⋯', infty: '∞', mid: '|', setminus: '∖', dotminus: '∸', equiv: '≡', frown: '⌢',
};

/** A plain-text rendering of simple TeX, for titles and the table of contents. */
export function texToPlain(tex: string): string {
  return tex
    .replace(/\\([{}|])/g, '$1\u0000')
    .replace(/\\([a-zA-Z]+)/g, (m, n: string) => TEX_PLAIN[n] ?? '')
    .replace(/\\[,;:!]/g, ' ')
    .replace(/([{}])(?!\u0000)/g, '')
    .replace(/\u0000/g, '')
    .replace(/[_^]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Splits an aligned environment into rows at top-level `\\`. */
export function splitRows(s: string): string[] {
  const rows: string[] = [];
  let depth = 0;
  let envDepth = 0;
  // Optional-argument brackets of macros (\lexists[u][ … ]): a \\ inside one is a line break
  // within that argument, not a new row (as in the multline for Inf(X) in 8.12). A bracket counts
  // as an argument bracket when it follows a control word or another argument's closing bracket,
  // so literal brackets such as [0, 1) are unaffected.
  let bracket = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '[' && /(\\[a-zA-Z]+\*?|\])\s*$/.test(s.slice(Math.max(0, i - 40), i))) {
      bracket++;
      continue;
    }
    if (c === ']' && bracket > 0) {
      bracket--;
      continue;
    }
    if (c === '\\') {
      if (s.startsWith('\\begin{', i)) envDepth++;
      else if (s.startsWith('\\end{', i)) envDepth--;
      else if (s[i + 1] === '\\' && depth === 0 && envDepth === 0 && bracket === 0) {
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

const slug = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

/**
 * Walks the book's driver ic.tex from \\frontmatter to \\backmatter, as LaTeX does: chapters come
 * from chapter driver files (\\olchapter) or from \\chapter in ic.tex; sections from section files;
 * \\let\\olsection\\nosection and \\def\\olsection#1{} merge a file into the current section.
 */
export class BookWalker implements BookHandler {
  readonly chapters: Chapter[] = [];
  private ctx: ConvertContext;
  private cur: { chapter: Chapter; state: ChapterState } | null = null;
  private curSection: Section | null = null;
  private n = 0;
  private letter = 0;
  private matter: 'front' | 'main' | 'appendix' = 'front';
  private dirs: { repo: Repo; dir: string }[] = [];

  constructor(ctx: ConvertContext) {
    this.ctx = ctx;
  }

  run() {
    const front = this.freshState('');
    // Text written directly in the driver (e.g. the Theories section of appendix B) is numbered
    // in whichever chapter is open at that point.
    const root = new FileParser(this.ctx, 'incompleteness-computability', 'ic.tex', () => this.cur?.state ?? front, () => this.sectionId());
    root.book = this;
    const start = root.src.indexOf('\\frontmatter');
    const end = root.src.indexOf('\\backmatter');
    this.dirs.push({ repo: 'incompleteness-computability', dir: '' });
    root.walk(start, end < 0 ? root.src.length : end);
    this.receive(root.drain());
    this.endChapter();
    return this.chapters;
  }

  private freshState(number: string): ChapterState {
    return { number, counters: { thm: 0, prob: 0, eq: 0, section: 0 } };
  }

  private sectionId(): string {
    return this.curSection?.id ?? (this.cur ? `${this.cur.chapter.id}.text` : 'udf');
  }

  private nextNumber(): string {
    if (this.matter === 'front') return '';
    if (this.matter === 'appendix') return String.fromCharCode(65 + this.letter++);
    return String(++this.n);
  }

  private startChapter(id: string, title: string, loc: SourceLoc) {
    this.endChapter();
    const number = this.nextNumber();
    const chapter: Chapter = { id, number, title, loc, sections: [] };
    this.cur = { chapter, state: this.freshState(number) };
    this.curSection = null;
    this.chapters.push(chapter);
  }

  private endChapter() {
    if (!this.cur) return;
    const { chapter, state } = this.cur;
    if (this.pendingLabel) {
      this.ctx.labels.set(this.pendingLabel, { kind: 'chapter', text: chapter.number ? `Chapter ${chapter.number}` : chapter.title, sectionId: chapter.sections[0]?.id ?? chapter.id, blockId: chapter.id });
      this.pendingLabel = null;
    }
    const file = `include/summary-${chapter.number}.tex`;
    if (chapter.number && existsSync(join(this.ctx.upstreamDir, 'incompleteness-computability', file))) {
      const p = new FileParser(this.ctx, 'incompleteness-computability', file, state, () => `${chapter.id}.summary`);
      p.fileId = ['ic', chapter.id.replace(/^[^.]*\./, ''), 'sum'];
      chapter.summary = p.parseAll();
    }
    this.cur = null;
    this.curSection = null;
  }

  private newSection(id: string, title: Inline[], loc: SourceLoc, labelKey?: string) {
    if (!this.cur) throw new Error(`section ${id} outside a chapter`);
    const { chapter, state } = this.cur;
    const number = chapter.number ? `${chapter.number}.${++state.counters.section}` : '';
    let unique = id;
    for (let k = 2; this.chapters.some((c) => c.sections.some((s) => s.id === unique)); k++) unique = `${id}-${k}`;
    const sec: Section = { id: unique, number, title, titleText: plain(title), loc, blocks: [] };
    chapter.sections.push(sec);
    this.curSection = sec;
    if (labelKey) this.ctx.labels.set(labelKey, { kind: 'section', text: number ? `Section ${number}` : plain(title), sectionId: unique, blockId: unique });
    return sec;
  }

  receive(blocks: Block[]) {
    if (!blocks.length || !this.cur) return;
    if (!this.curSection) {
      const ch = this.cur.chapter;
      this.newSection(`${ch.id}.text`, [{ t: 'text', v: ch.title }], ch.loc);
    }
    this.curSection!.blocks.push(...blocks);
  }

  private pendingLabel: string | null = null;

  chapter(title: Inline[], label: string | undefined, loc: SourceLoc) {
    const t = plain(title);
    const id = label ? `ic.${label.replace(/:chap$/, '')}` : `ic.${slug(t)}`;
    this.startChapter(id, t, loc);
    this.pendingLabel = label ?? null;
  }

  section(title: Inline[], loc: SourceLoc) {
    const ch = this.cur?.chapter;
    this.newSection(`${ch?.id ?? 'ic'}.${slug(plain(title))}`, title, loc);
  }

  part(name: string) {
    if (name === 'mainmatter') this.matter = 'main';
    else if (name === 'appendix') this.matter = 'appendix';
  }

  input(file: string) {
    const f = file.endsWith('.tex') ? file : `${file}.tex`;
    this.walkDriver('incompleteness-computability', f);
  }

  private walkDriver(repo: Repo, file: string, chapterFromDriver?: { id: string; title: string }) {
    const p = new FileParser(this.ctx, repo, file, this.cur?.state ?? this.freshState(''), () => this.sectionId());
    if (chapterFromDriver) this.startChapter(chapterFromDriver.id, chapterFromDriver.title, p.loc(0, p.src.length));
    // The parser needs the current chapter's counters; rebind after a chapter starts.
    const parser = chapterFromDriver ? new FileParser(this.ctx, repo, file, this.cur!.state, () => this.sectionId()) : p;
    parser.book = this;
    this.dirs.push({ repo, dir: file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : '' });
    // Chapter state for files that start chapters themselves (\\chapter inside): counters are looked up lazily.
    parser.walk(0, parser.src.length);
    this.receive(parser.drain());
    this.dirs.pop();
  }

  importFile(path: string | undefined, name: string, noSection: boolean) {
    const here = this.dirs[this.dirs.length - 1];
    let repo: Repo = 'OpenLogic';
    let file: string;
    if (path === 'include') {
      repo = 'incompleteness-computability';
      file = `include/${name}.tex`;
    } else if (path !== undefined) file = `content/${path}/${name}.tex`;
    else {
      repo = here.repo;
      file = `${here.dir}/${name}.tex`;
    }
    if (!existsSync(join(this.ctx.upstreamDir, repo, file))) {
      this.ctx.diagnostics.push({ level: 'error', code: 'missing-file', message: `${repo}/${file} is not vendored` });
      return;
    }
    const src = readFileSync(join(this.ctx.upstreamDir, repo, file), 'utf8');
    const drv = /\\olchapter(?:\[[^\]]*\])?\{([^}]*)\}\{([^}]*)\}\{/.exec(stripComments(src));
    if (drv) {
      const titleMatch = /\\olchapter(?:\[[^\]]*\])?\{[^}]*\}\{[^}]*\}\{((?:[^{}]|\{[^{}]*\})*)\}/.exec(stripComments(src));
      this.walkDriver(repo, file, { id: `${drv[1]}.${drv[2]}`, title: titleMatch ? titleMatch[1] : name });
      const ch = this.cur!.chapter;
      // Parse the title properly (it may contain mathematics).
      ch.title = ch.title.replace(/\$\\Th\{(\w+)\}\$/g, '$1');
      this.ctx.labels.set(`${drv[1]}:${drv[2]}::chap`, { kind: 'chapter', text: `Chapter ${ch.number}`, sectionId: ch.sections[0]?.id ?? ch.id, blockId: ch.id });
      this.endChapter();
      return;
    }
    const idMatch = /\\olfileid(?:\[[^\]]*\])?\{([^}]*)\}\{([^}]*)\}\{([^}]*)\}/.exec(src);
    const merge = (noSection || this.ctx.olsectionSuppressed) && this.curSection;
    if (!idMatch && !merge) {
      this.ctx.diagnostics.push({ level: 'error', code: 'no-fileid', message: `${file} has no \\olfileid` });
      return;
    }
    if (!this.cur) throw new Error(`${file} imported outside a chapter`);
    let sectionId: string;
    if (merge) sectionId = this.curSection!.id;
    else sectionId = `${idMatch![1]}.${idMatch![2]}.${idMatch![3]}`;
    const p = new FileParser(this.ctx, repo, file, this.cur.state, () => sectionId);
    if (!merge) {
      // Create the section first so its number is right; fill the title after parsing.
      const sec = this.newSection(sectionId, [{ t: 'text', v: name }], p.loc(0, p.src.length), `${idMatch![1]}:${idMatch![2]}:${idMatch![3]}:sec`);
      sectionId = sec.id;
      const blocks = p.parseAll();
      if (p.sectionTitle) {
        sec.title = p.sectionTitle.c;
        sec.titleText = p.sectionTitle.text;
      }
      sec.blocks.push(...blocks);
    } else {
      const blocks = noSection || this.ctx.olsectionSuppressed ? p.parseAll() : p.parseAll();
      this.curSection!.blocks.push(...blocks);
    }
  }
}

export function convertBook(ctx: ConvertContext): Chapter[] {
  return new BookWalker(ctx).run();
}
