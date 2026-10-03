/**
 * One Vouch language server per page, in a Web Worker, shared by every editor on the page through
 * @codemirror/lsp-client. Editors subscribe to the server's `vouch/verdicts` notifications for their document.
 */
import type { LSPClient, Transport } from '@codemirror/lsp-client';
import type { Verdict } from '$lib/fv/engines';
import type { DeclVerdicts } from '$lib/fv/verify/document';

export interface LspRange {
  start: { line: number; character: number };
  end: { line: number; character: number };
}

export type RangedVerdict = Verdict & { range?: LspRange };

export interface VerdictsPayload {
  uri: string;
  version: number;
  verdicts: (Omit<DeclVerdicts, 'verdicts'> & { verdicts: RangedVerdict[] })[];
}

export interface VouchClient {
  client: LSPClient;
  /** Listen for verdicts on one document; returns an unsubscribe function. */
  onVerdicts(uri: string, f: (p: VerdictsPayload) => void): () => void;
  /** Listen for the end of a verification run. */
  onDone(uri: string, f: () => void): () => void;
  /** The latest verdicts for a document. */
  latest(uri: string): VerdictsPayload | undefined;
}

let shared: Promise<VouchClient> | undefined;

export function vouchClient(): Promise<VouchClient> {
  shared ??= create();
  return shared;
}

async function create(): Promise<VouchClient> {
  const { LSPClient, languageServerExtensions } = await import('@codemirror/lsp-client');
  const worker = new Worker(new URL('../../fv/vouch/lsp/worker.ts', import.meta.url), { type: 'module', name: 'vouch-language-server' });
  let handlers: ((m: string) => void)[] = [];
  worker.onmessage = (e: MessageEvent<string>) => {
    for (const h of handlers) h(e.data);
  };
  const transport: Transport = {
    send: (m) => worker.postMessage(m),
    subscribe: (h) => handlers.push(h),
    unsubscribe: (h) => (handlers = handlers.filter((x) => x !== h)),
  };
  const listeners = new Map<string, Set<(p: VerdictsPayload) => void>>();
  const doneListeners = new Map<string, Set<() => void>>();
  const latest = new Map<string, VerdictsPayload>();
  const client = new LSPClient({
    extensions: languageServerExtensions(),
    timeout: 15_000,
    notificationHandlers: {
      'vouch/verdicts': (_c, params: VerdictsPayload) => {
        latest.set(params.uri, params);
        for (const f of listeners.get(params.uri) ?? []) f(params);
        return true;
      },
      'vouch/verificationDone': (_c, params: { uri: string }) => {
        for (const f of doneListeners.get(params.uri) ?? []) f();
        return true;
      },
    },
  }).connect(transport);
  await client.initializing;
  const sub = <T>(map: Map<string, Set<T>>, uri: string, f: T) => {
    if (!map.has(uri)) map.set(uri, new Set());
    map.get(uri)!.add(f);
    return () => void map.get(uri)?.delete(f);
  };
  return {
    client,
    onVerdicts: (uri, f) => sub(listeners, uri, f),
    onDone: (uri, f) => sub(doneListeners, uri, f),
    latest: (uri) => latest.get(uri),
  };
}

let counter = 0;
/** A fresh document URI for an editor (each editor owns its own document). */
export function freshUri(name = 'scratch'): string {
  return `file:///course/${name.replace(/[^\w-]/g, '-')}-${++counter}.vouch`;
}
