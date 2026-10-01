import { afterEach, describe, expect, test } from 'vitest';
import { activeOverrides, setOverride } from '../hep/hooks.ts';
import { presetConfig, runBatch, type BatchResult, type PipelineConfig } from '../hep/pipeline/index.ts';
import { applyEntries } from './mineApply.ts';
import { RunPool, type PoolSnapshot, type WorkerLike } from './pool.ts';
import { createHost } from './worker.ts';
import { stageOfHook, type FromWorker, type ToWorker } from './protocol.ts';

afterEach(() => {
  for (const n of activeOverrides()) setOverride(n, undefined);
});

/** A worker that runs the host in this thread, answering asynchronously like a real one (every fake worker shares the module state, as it must be for tests of the protocol). */
function fakeWorker(log?: ToWorker[]): WorkerLike {
  let dead = false;
  const w: WorkerLike = {
    onmessage: null,
    onerror: null,
    terminate() {
      dead = true;
    },
    postMessage(m) {
      log?.push(m);
      setTimeout(() => {
        if (dead) return;
        host(m);
      }, 0);
    },
  };
  const host = createHost((m: FromWorker) => {
    if (!dead) setTimeout(() => !dead && w.onmessage?.({ data: m }), 0);
  });
  return w;
}

const strip = (r: BatchResult) => JSON.parse(JSON.stringify({ ...r, time: undefined, kept: undefined }));

function runPool(config: PipelineConfig, n: number, size: number, seed = 3): Promise<{ snap: PoolSnapshot; updates: PoolSnapshot[] }> {
  return new Promise((resolve) => {
    const updates: PoolSnapshot[] = [];
    const pool = new RunPool({
      makeWorker: () => fakeWorker(),
      size,
      getMine: () => ({}),
      updateMs: 20,
      jobMs: 5,
      onUpdate: (s) => {
        updates.push(s);
        if (s.finished && !s.running) {
          pool.dispose();
          resolve({ snap: s, updates });
        }
      },
    });
    pool.start(config, seed, n);
  });
}

describe('the run pool', () => {
  const c = presetConfig('zmumu');
  c.machine.pileupMean = 0;

  test('a pooled run gives the same histograms and counters as one batch, for any number of workers', async () => {
    const whole = runBatch(c, 40, 3);
    for (const size of [1, 3]) {
      const { snap } = await runPool(c, 40, size);
      expect(snap.events).toBe(40);
      const a = strip(whole), b = strip(snap.result!);
      expect(b.n).toBe(a.n);
      expect(b.samples[0].hist.map((h: { counts: number[] }) => h.counts)).toEqual(a.samples[0].hist.map((h: { counts: number[] }) => h.counts));
      expect(b.samples[0].selected).toBe(a.samples[0].selected);
      expect(b.samples[0].trigger.fired).toBe(a.samples[0].trigger.fired);
      expect(snap.xsec![0]).toBeGreaterThan(1000);
    }
  }, 120_000);

  test('partial results stream in while the run is in progress, and kept events and the hook status come through', async () => {
    const { updates, snap } = await runPool(c, 60, 2);
    expect(updates.length).toBeGreaterThan(2);
    const counts = updates.map((u) => u.events);
    expect(counts).toEqual([...counts].sort((a, b) => a - b));
    expect(updates.some((u) => u.events > 0 && u.events < 60)).toBe(true);
    expect(snap.mine).toEqual({ active: [], errors: {} });
    expect(snap.kept.length).toBeGreaterThan(0);
    expect(snap.kept.every((k) => k.event.reco && k.event.truth)).toBe(true);
    expect(snap.wallRate).toBeGreaterThan(0);
  }, 120_000);

  test('stop pauses the run, start continues it, reset forgets it and terminates the workers', async () => {
    const terminated: boolean[] = [];
    let latest!: PoolSnapshot;
    const pool = new RunPool({
      makeWorker: () => {
        const w = fakeWorker();
        const t = w.terminate.bind(w);
        w.terminate = () => { terminated.push(true); t(); };
        return w;
      },
      size: 2,
      getMine: () => ({}),
      updateMs: 10,
      jobMs: 5,
      onUpdate: (s) => (latest = s),
    });
    pool.start(c, 5, 10_000);
    await new Promise((r) => setTimeout(r, 600));
    pool.stop();
    await new Promise((r) => setTimeout(r, 300));
    const stopped = latest.events;
    expect(stopped).toBeGreaterThan(0);
    expect(latest.running).toBe(false);
    await new Promise((r) => setTimeout(r, 200));
    expect(latest.events).toBe(stopped); // nothing more arrives once the in-flight jobs are in
    pool.start(c, 5, 10_000);
    await new Promise((r) => setTimeout(r, 500));
    expect(latest.events).toBeGreaterThan(stopped);
    pool.reset();
    expect(latest.events).toBe(0);
    expect(latest.result).toBeNull();
    expect(terminated.length).toBe(2);
    pool.dispose();
  }, 120_000);

  test('a job that never answers terminates its worker and is reported', async () => {
    let latest!: PoolSnapshot;
    const pool = new RunPool({
      makeWorker: () => {
        const w = fakeWorker();
        const post = w.postMessage.bind(w);
        // answer init, never answer anything else
        w.postMessage = (m) => (m.type === 'init' ? post(m) : undefined);
        return w;
      },
      size: 1,
      getMine: () => ({}),
      updateMs: 10,
      jobTimeoutMs: 1200,
      onUpdate: (s) => (latest = s),
    });
    pool.start(c, 1, 100);
    await new Promise((r) => setTimeout(r, 2500));
    expect(latest.problems.join(' ')).toMatch(/infinite loop/);
    expect(latest.running).toBe(false);
    pool.dispose();
  }, 20_000);
});

describe('the reader’s saved code inside a worker', () => {
  test('applyEntries installs enabled entries, skips disabled ones and reports errors', () => {
    const res = applyEntries({
      'kinematics.pairMass': { code: 'export function pairMass(a, b) { return 42; }', enabled: true, exercise: 'ch2' },
      'reco.antiKt': { code: 'export function antiKt() { return { jets: [], constituents: [] }; }', enabled: false, exercise: 'ch18' },
      'trigger.l1Decision': { code: 'export const notIt = 1;', enabled: true, exercise: 'ch27' },
      'gen.unweight': { code: 'this is not typescript (', enabled: true, exercise: 'ch16' },
    });
    expect(res.active).toEqual(['kinematics.pairMass']);
    expect(Object.keys(res.errors).sort()).toEqual(['gen.unweight', 'trigger.l1Decision']);
    expect(res.errors['trigger.l1Decision']).toMatch(/does not export a function named l1Decision/);
  });

  test('saved code runs inside the pipeline: a pairMass solution changes the dimuon mass histogram', () => {
    const c = presetConfig('zmumu');
    c.machine.pileupMean = 0;
    const post: FromWorker[] = [];
    const host = createHost((m) => post.push(m));
    host({ type: 'init', mine: { 'kinematics.pairMass': { code: 'export function pairMass(a, b) { return 7; }', enabled: true, exercise: 'ch2' } } });
    expect(post[0]).toEqual({ type: 'ready', active: ['kinematics.pairMass'], errors: {} });
    host({ type: 'job', runId: 1, jobId: 1, config: c, seed: 1, start: 0, n: 40, keep: 0 });
    const r = post[1] as Extract<FromWorker, { type: 'result' }>;
    expect(r.type).toBe('result');
    // every dimuon mass is 7 GeV: below the histogram range, so none of the selected events is in range
    expect(r.result.samples[0]!.selected).toBeGreaterThan(0);
    expect(r.result.samples[0]!.hist[0]!.sum).toBe(0);
    expect(r.result.samples[0]!.hist[0]!.underflow).toBe(r.result.samples[0]!.selected);
  });

  test('hooks map to the stages that use them', () => {
    expect(stageOfHook('reco.antiKt')).toBe('reconstruction');
    expect(stageOfHook('gen.unweight')).toBe('generator');
    expect(stageOfHook('kinematics.pairMass')).toBe('analysis');
    expect(stageOfHook('trigger.l1Decision')).toBe('trigger');
    expect(stageOfHook('machine.luminosity')).toBe('machine');
    expect(stageOfHook('oscillations.probability')).toBeNull();
  });
});
