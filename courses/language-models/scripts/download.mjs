import { setTimeout as waitFor } from 'node:timers/promises';

class HttpError extends Error {
  constructor(status) {
    super(`HTTP ${status}`);
    this.retryable = status === 408 || status === 429 || status >= 500;
  }
}

/** Retry temporary release-server or transport failures, including interrupted response bodies. */
export async function downloadBytes(url, {
  fetcher = fetch,
  wait = waitFor,
  attempts = 3,
  timeoutMs = 120_000,
  onRetry = (error, attempt, delay) => console.warn(`weights: ${error.message}; retry ${attempt}/${attempts - 1} in ${delay}ms`),
} = {}) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetcher(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!response.ok) {
        await response.body?.cancel().catch(() => {});
        throw new HttpError(response.status);
      }
      return new Uint8Array(await response.arrayBuffer());
    } catch (error) {
      if (attempt === attempts || (error instanceof HttpError && !error.retryable)) throw error;
      const delay = 1000 * 2 ** (attempt - 1);
      onRetry(error, attempt, delay);
      await wait(delay);
    }
  }
}
