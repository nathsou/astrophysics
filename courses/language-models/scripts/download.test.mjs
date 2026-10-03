import { test } from 'node:test';
import assert from 'node:assert/strict';
import { downloadBytes } from './download.mjs';

const url = 'https://github.com/nathsou/courses/releases/download/coursegpt-v1/calculator.safetensors';
const quiet = { onRetry: () => {} };

test('a temporary GitHub 502 retries and downloads the complete bytes', async () => {
  let calls = 0;
  const delays = [];
  const result = await downloadBytes(url, {
    ...quiet,
    fetcher: async (_, options) => {
      assert.ok(options.signal instanceof AbortSignal);
      return ++calls === 1 ? new Response('Bad gateway', { status: 502 }) : new Response('weights');
    },
    wait: async delay => delays.push(delay),
  });
  assert.equal(new TextDecoder().decode(result), 'weights');
  assert.equal(calls, 2);
  assert.deepEqual(delays, [1000]);
});

test('transport and interrupted body errors retry with bounded backoff', async () => {
  let calls = 0;
  const delays = [];
  const result = await downloadBytes(url, {
    ...quiet,
    fetcher: async () => {
      calls++;
      if (calls === 1) throw new TypeError('fetch failed');
      if (calls === 2) return { ok: true, arrayBuffer: async () => { throw new Error('connection closed'); } };
      return new Response('complete');
    },
    wait: async delay => delays.push(delay),
  });
  assert.equal(new TextDecoder().decode(result), 'complete');
  assert.deepEqual(delays, [1000, 2000]);
});

test('missing or forbidden assets fail immediately', async () => {
  for (const status of [401, 403, 404]) {
    let calls = 0;
    await assert.rejects(downloadBytes(url, {
      ...quiet,
      fetcher: async () => { calls++; return new Response('', { status }); },
      wait: async () => assert.fail('Permanent errors must not retry'),
    }), new RegExp(`HTTP ${status}`));
    assert.equal(calls, 1);
  }
});

test('repeated transient errors fail after three attempts', async () => {
  for (const status of [408, 429, 503]) {
    let calls = 0;
    await assert.rejects(downloadBytes(url, {
      ...quiet,
      fetcher: async () => { calls++; return new Response('', { status }); },
      wait: async () => {},
    }), new RegExp(`HTTP ${status}`));
    assert.equal(calls, 3);
  }
});

test('a stalled request aborts rather than hanging the build', async () => {
  await assert.rejects(downloadBytes(url, {
    ...quiet,
    attempts: 1,
    timeoutMs: 5,
    fetcher: async (_, { signal }) => new Promise((_, reject) => {
      const keepAlive = setTimeout(() => assert.fail('Download timeout was not enforced'), 1000);
      signal.addEventListener('abort', () => { clearTimeout(keepAlive); reject(signal.reason); }, { once: true });
    }),
  }), { name: 'TimeoutError' });
});
