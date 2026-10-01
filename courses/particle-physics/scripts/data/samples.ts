/**
 * Precomputed samples for the Control Room and the `::pipeline` widget: each preset of `hep/pipeline` run once, offline, with the reference code (no hooks) and a
 * fixed seed, and written to `static/data/samples/<preset>.json` with its manifest (seed, events, code version, selection, approximations) and an `index.json`.
 *
 *     node --experimental-strip-types scripts/data/samples.ts [preset …] [--threads 4] [--scale 1]
 *
 * It uses the same `runBatch` as the live pipeline, so "Regenerate with my code" in the page is the same computation with the reader's hooks installed.
 * The run is split into jobs over worker threads; because every event has its own random streams (seed, index), the result does not depend on the thread count.
 * Wall-clock times in the files vary from run to run; every count is reproducible. `--scale 0.1` makes a small test set.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import {
  PIPELINE_VERSION, PRESET_NAMES, mergeBatch, prepare, presetConfig, runBatch, sampleXsec, describeSelection, windowFraction,
  type BatchResult, type PipelineConfig, type SampleManifest, type SamplePayload,
} from '../../src/lib/hep/pipeline/index.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const outDir = join(root, 'static', 'data', 'samples');

/** Events per preset (the sample the page shows at once) and the run seed. */
const PLAN: Record<string, { events: number; seed: number }> = {
  zmumu: { events: 20000, seed: 1 },
  'higgs-gamgam': { events: 40000, seed: 1 },
  'higgs-4l': { events: 20000, seed: 1 },
  ttbar: { events: 4000, seed: 1 },
  dijet: { events: 8000, seed: 1 },
  minbias: { events: 5000, seed: 1 },
  'ee-zpole': { events: 20000, seed: 1 },
};

const NOTES: Record<string, string[]> = {
  zmumu: ['Leading-order cross-section (no K-factor); pile-up 0.', 'The muon system covers about |η| < 1.1, so about one pair in ten is selected.'],
  'higgs-gamgam': [
    'Leading-order cross-sections (K = 1): gg → H is about 3.4 times smaller than the published value, which includes higher orders.',
    'Only the irreducible γγ continuum is included as background, in a generator-level mass window of 100–160 GeV; jets faking photons are not simulated.',
    'Histograms are scaled to 100 fb⁻¹; the points are Poisson-fluctuated pseudo-data from the simulation, not data.',
  ],
  'higgs-4l': [
    'Leading-order cross-sections (K = 1).',
    'The ZZ* continuum is a toy built for this course: q q̄ → ZZ* by t- and u-channel exchange with two off-shell Z bosons, no photon exchange, no gg → ZZ, no spin correlations between the decays (pipeline/zz.ts).',
    'Histograms are scaled to 100 fb⁻¹; the points are Poisson-fluctuated pseudo-data from the simulation, not data.',
  ],
  ttbar: ['Leading-order cross-section (K = 1; the higher-order factor is about 1.9).'],
  dijet: ['Four pT slices with their own weights (stratified generation); leading-order QCD, no K-factor.'],
  minbias: ['A toy minimum-bias model; the histograms count simulated events.'],
  'ee-zpole': ['Initial-state radiation on; luminosity 2 × 10³¹ cm⁻² s⁻¹ is an illustrative LEP-like value.'],
};

function codeHash(): string {
  const h = createHash('sha256');
  const walk = (d: string) => {
    for (const f of readdirSync(d).sort()) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|json)$/.test(f) && !/\.test\.ts$/.test(f)) {
        h.update(relative(root, p));
        h.update(readFileSync(p));
      }
    }
  };
  walk(join(root, 'src', 'lib', 'hep'));
  return h.digest('hex');
}

// ── worker thread: run jobs ──
if (!isMainThread) {
  const port = parentPort!;
  port.on('message', (m: { config: PipelineConfig; seed: number; start: number; n: number } | 'exit') => {
    if (m === 'exit') process.exit(0);
    const result = runBatch(m.config, m.n, m.seed, { start: m.start });
    port.postMessage({ start: m.start, n: m.n, result });
  });
  port.postMessage('ready');
} else {
  void main();
}

async function runPreset(name: string, events: number, seed: number, threads: number): Promise<void> {
  const config = presetConfig(name);
  const t0 = performance.now();
  prepare(config);
  const xsec = config.generator.samples.map((s) => sampleXsec(s, config.machine.sqrtS));
  const chunk = 50;
  let next = 0;
  let total: BatchResult | null = null;
  await new Promise<void>((resolve, reject) => {
    let done = 0, active = threads;
    const workers: Worker[] = [];
    const feed = (w: Worker) => {
      if (next >= events) {
        w.postMessage('exit');
        if (--active === 0) resolve();
        return;
      }
      const n = Math.min(chunk, events - next);
      w.postMessage({ config, seed, start: next, n });
      next += n;
    };
    for (let i = 0; i < threads; i++) {
      const w = new Worker(new URL(import.meta.url), { execArgv: ['--experimental-strip-types'], workerData: {} });
      workers.push(w);
      w.on('message', (m: 'ready' | { start: number; n: number; result: BatchResult }) => {
        if (m === 'ready') return feed(w);
        if (total === null) total = m.result;
        else mergeBatch(total, m.result);
        done += m.n;
        if (done % 2000 < chunk) process.stdout.write(`\r${name}: ${done}/${events}`);
        feed(w);
      });
      w.on('error', reject);
    }
  });
  const result = total as unknown as BatchResult;
  result.kept = [];
  const seconds = (performance.now() - t0) / 1000;
  const eventsPerSample: Record<string, number> = {};
  result.samples.forEach((s) => (eventsPerSample[s.name] = s.n));
  const manifest: SampleManifest = {
    preset: name,
    description: `${config.name}: ${events} simulated events through machine, generator, detector, reconstruction, trigger and analysis, with the reference code.`,
    seed, events, eventsPerSample, pipelineVersion: PIPELINE_VERSION, script: 'scripts/data/samples.ts', made: new Date().toISOString().slice(0, 10), codeSha256: codeHash(),
    selection: describeSelection(config), hooks: [],
    normalisation: config.analysis.lumiFb === null ? 'Unscaled: histograms count simulated events.' : `Cross-sections at leading order times K-factors (K = ${config.generator.kFactor}), scaled to ${config.analysis.lumiFb} fb⁻¹.`,
    seconds: Math.round(seconds), threads, notes: NOTES[name] ?? [],
  };
  const payload: SamplePayload = { manifest, config, xsec, result };
  const text = JSON.stringify(payload);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, `${name}.json`), text);
  console.log(`\r${name}: ${events} events in ${seconds.toFixed(0)} s, ${(text.length / 1024).toFixed(0)} kB`);
  void windowFraction;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const opt = (k: string, d: number) => { const i = args.indexOf(k); return i >= 0 ? Number(args[i + 1]) : d; };
  const threads = opt('--threads', 4);
  const scale = opt('--scale', 1);
  const names = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1]!.startsWith('--')));
  const todo = names.length ? names : PRESET_NAMES;
  for (const name of todo) {
    const p = PLAN[name];
    if (!p) throw new Error(`no plan for preset ${name}`);
    await runPreset(name, Math.max(50, Math.round(p.events * scale)), p.seed, threads);
  }
  // the index of every file in the directory
  const index = readdirSync(outDir).filter((f) => f.endsWith('.json') && f !== 'index.json').sort().map((f) => {
    const buf = readFileSync(join(outDir, f));
    const m = (JSON.parse(buf.toString()) as SamplePayload).manifest;
    return { file: f, preset: m.preset, bytes: buf.length, sha256: createHash('sha256').update(buf).digest('hex'), events: m.events, seed: m.seed, made: m.made, pipelineVersion: m.pipelineVersion, codeSha256: m.codeSha256 };
  });
  writeFileSync(join(outDir, 'index.json'), JSON.stringify({ about: 'Precomputed pipeline samples made by scripts/data/samples.ts with the reference code; each file holds its own manifest.', files: index }, null, 1));
  console.log(`total ${(index.reduce((s, f) => s + f.bytes, 0) / 1024).toFixed(0)} kB in ${index.length} files`);
}
