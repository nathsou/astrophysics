import { base } from '$app/paths';

const cache = new Map<string, Promise<string>>();

export const CORPORA = {
  shakespeare: { file: 'tinyshakespeare.txt', title: 'TinyShakespeare', note: '≈1.1 MB of Shakespeare’s plays, compiled by Andrej Karpathy for char-rnn (2015).' },
} as const;

export type CorpusName = keyof typeof CORPORA;

/** Fetch a bundled corpus (cached per page load). */
export function loadCorpus(name: CorpusName): Promise<string> {
  let p = cache.get(name);
  if (!p) {
    p = fetch(`${base}/data/${CORPORA[name].file}`).then((r) => {
      if (!r.ok) throw new Error(`Failed to load ${name}: ${r.status}`);
      return r.text();
    });
    cache.set(name, p);
  }
  return p;
}
