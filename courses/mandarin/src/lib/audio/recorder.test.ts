import { afterEach, it, expect, vi } from 'vitest';
import { Recorder } from './recorder';
afterEach(() => vi.unstubAllGlobals());

it('releases a microphone granted after a recording was cancelled', async () => {
  let grant!: (stream: MediaStream) => void;
  const stop = vi.fn();
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => new Promise<MediaStream>(resolve => grant = resolve) } });
  const recorder = new Recorder(() => {});
  const pending = recorder.start();
  recorder.stop();
  grant({ getTracks: () => [{ stop }] } as unknown as MediaStream);
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  expect(stop).toHaveBeenCalledOnce();
  expect(recorder.active).toBe(false);
});
