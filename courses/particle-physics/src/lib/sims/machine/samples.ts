/** Loading the toy trigger samples without blocking the page: one sample per task, memoised. */
import { CatalogueEvaluator, TOY_SAMPLES, generateToySamples, type Sample } from '$lib/hep/trigger';

export interface ToyModel { samples: Sample[]; evaluator: CatalogueEvaluator }

const cache = new Map<string, Promise<ToyModel>>();

/** Generate (once) the toy samples and the fast evaluator. `keys` restricts the samples; `onProgress` gets 0–1. */
export function loadToyModel(nPerSample = 1200, seed = 1, keys?: readonly string[], onProgress?: (f: number) => void): Promise<ToyModel> {
  const id = `${seed}:${nPerSample}:${keys?.join(',') ?? '*'}`;
  let p = cache.get(id);
  if (!p) {
    p = (async () => {
      const out: Sample[] = [];
      const wanted = TOY_SAMPLES.filter((t) => !keys || keys.includes(t.key));
      let done = 0;
      for (const t of wanted) {
        out.push(...generateToySamples({ seed, nPerSample, only: [t.key] }));
        done++;
        onProgress?.(done / (wanted.length + 1));
        await new Promise((r) => setTimeout(r, 0));
      }
      const evaluator = new CatalogueEvaluator(out);
      onProgress?.(1);
      return { samples: out, evaluator };
    })();
    cache.set(id, p);
  }
  return p;
}
