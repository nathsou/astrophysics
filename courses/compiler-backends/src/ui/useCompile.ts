import { useEffect, useMemo, useState } from 'react';
import { compile, type CompileResult, type PipelineOptions } from '../compiler/pipeline';

const cache = new Map<string, CompileResult>();

/** Compile with memoisation (widgets across a chapter often compile the same program). */
export function compileCached(src: string, opts: Partial<PipelineOptions> = {}): CompileResult {
  const key = JSON.stringify([src, opts]);
  let r = cache.get(key);
  if (!r) {
    r = compile(src, opts);
    cache.set(key, r);
    if (cache.size > 80) cache.delete(cache.keys().next().value!);
  }
  return r;
}

export function useCompile(src: string, opts: Partial<PipelineOptions> = {}): CompileResult {
  const key = JSON.stringify(opts);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => compileCached(src, opts), [src, key]);
}

export function useDebounced<T>(v: T, ms = 250): T {
  const [d, setD] = useState(v);
  useEffect(() => {
    const h = setTimeout(() => setD(v), ms);
    return () => clearTimeout(h);
  }, [v, ms]);
  return d;
}
