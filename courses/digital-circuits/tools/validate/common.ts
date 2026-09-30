/**
 * Shared pieces of the validation scripts (`npm run validate:gal`, `validate:yosys`, `validate:rv32i`). They
 * run outside CI, against tools that are not part of the course: each script looks its tool up, says
 * `skipped: <tool> not found — install … or set …` and exits 0 when it is missing, and exits 1 on a real
 * mismatch (see docs/AUTHORING.md, *Validation*).
 */
import { spawnSync } from 'node:child_process';
import { accessSync, constants, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ToolResult {
  /** The exit status, or null when the process could not start or was killed. */
  status: number | null;
  stdout: string;
  stderr: string;
  /** Why it could not run (no such file, timeout). */
  error?: string;
}

export interface RunOptions {
  cwd?: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
}

/** Runs a program; the scripts take one as a parameter so that tests can supply a fake. */
export type Runner = (command: string, args: string[], options?: RunOptions) => ToolResult;

export const realRunner: Runner = (command, args, options = {}) => {
  const r = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    encoding: 'utf8',
    timeout: options.timeoutMs ?? 30 * 60 * 1000,
    maxBuffer: 256 * 1024 * 1024,
  });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '', error: r.error?.message };
};

/** Where the scripts print. Tests collect the lines. */
export interface Logger {
  log(line: string): void;
  error(line: string): void;
}

export const consoleLogger: Logger = { log: (l) => console.log(l), error: (l) => console.error(l) };

const isExecutable = (file: string): boolean => {
  try {
    if (!statSync(file).isFile()) return false;
    accessSync(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

/** The first executable called `name` on PATH (also with `.exe` on Windows). */
export function which(name: string, env: NodeJS.ProcessEnv = process.env): string | undefined {
  const dirs = (env.PATH ?? '').split(path.delimiter).filter(Boolean);
  const exts = process.platform === 'win32' ? ['', '.exe', '.cmd', '.bat'] : [''];
  for (const dir of dirs) for (const ext of exts) if (isExecutable(path.join(dir, name + ext))) return path.join(dir, name + ext);
  return undefined;
}

/**
 * Finds a tool: the file (or PATH name) in the environment variable `envVar`, else the first of `names` on
 * PATH. An environment variable that names something missing is an error worth stating, not a silent skip.
 */
export function findTool(envVar: string, names: string[], env: NodeJS.ProcessEnv = process.env): { path?: string; problem?: string } {
  const given = env[envVar];
  if (given) {
    if (given.includes('/') || given.includes(path.sep)) return isExecutable(given) ? { path: given } : { problem: `${envVar}=${given} is not an executable file` };
    const w = which(given, env);
    return w ? { path: w } : { problem: `${envVar}=${given} is not on PATH` };
  }
  for (const n of names) {
    const w = which(n, env);
    if (w) return { path: w };
  }
  return {};
}

/** The one-line message of a skipped validation. */
export function skipMessage(tool: string, install: string, envHint: string): string {
  return `skipped: ${tool} not found — install ${install} or set ${envHint}`;
}

/** The first line at which two texts differ, for a failure message. */
export function firstDifference(ours: string, theirs: string, label = ['ours', 'theirs']): string | undefined {
  if (ours === theirs) return undefined;
  const a = ours.split('\n');
  const b = theirs.split('\n');
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) return `line ${i + 1}: ${label[0]} ${JSON.stringify(a[i] ?? '<end of file>')}, ${label[1]} ${JSON.stringify(b[i] ?? '<end of file>')}`;
  }
  return 'the texts differ';
}

/** The course's root directory (the folder of package.json). */
export const COURSE_ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** `a/b/c` relative to the course root, with forward slashes. */
export const relativeToCourse = (file: string): string => path.relative(COURSE_ROOT, file).split(path.sep).join('/');
