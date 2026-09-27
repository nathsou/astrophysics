/// <reference lib="webworker" />
/**
 * TypeScript language service for the in-browser editors (completions, hover types, diagnostics).
 * Library sources (@lm/core, @lm/test) are mounted into the virtual file system so learners get
 * real types for everything they import.
 */
import { createSystem, createVirtualTypeScriptEnvironment } from '@typescript/vfs';
import ts from 'typescript';
import * as Comlink from 'comlink';
import { createWorker } from '@valtown/codemirror-ts/worker';

const libs = import.meta.glob('/node_modules/typescript/lib/lib.*.d.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const core = import.meta.glob('../../../../packages/core/src/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const harness = import.meta.glob('./harness.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

Comlink.expose(
  createWorker(async () => {
    const fsMap = new Map<string, string>();
    for (const [p, src] of Object.entries(libs)) fsMap.set('/' + p.split('/').at(-1), src);
    for (const [p, src] of Object.entries(core)) {
      if (p.endsWith('.test.ts')) continue;
      fsMap.set('/lm/core/' + p.split('/packages/core/src/')[1], src);
    }
    fsMap.set('/lm/test.ts', Object.values(harness)[0] ?? '');
    const system = createSystem(fsMap);
    const options: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2022,
      lib: ['lib.es2024.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      strict: true,
      noEmit: true,
      allowImportingTsExtensions: true,
      types: [],
      paths: {
        '@lm/core': ['/lm/core/index.ts'],
        '@lm/core/*': ['/lm/core/*/index.ts'],
        '@lm/test': ['/lm/test.ts'],
      },
    };
    return createVirtualTypeScriptEnvironment(system, [], ts, options);
  }),
);
