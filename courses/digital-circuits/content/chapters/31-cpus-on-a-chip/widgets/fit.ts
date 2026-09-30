/**
 * Fitting a session reliably. `FpgaSession.fit` asks the analysis worker to check the source, and a newer request with the
 * same key (the editor's own analysis of the same text, which may start a moment later) supersedes it: `fit` then
 * returns without a result and the status stays `running`. Wait for the editor's first analysis, and go again if the
 * fit was superseded.
 */
import type { FpgaSession } from '$lib/studio/fpga/session.svelte';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fitReliably(session: FpgaSession, tries = 4): Promise<void> {
  for (let i = 0; i < 30 && !session.analysis; i++) await sleep(100);
  for (let t = 0; t < tries; t++) {
    const source = session.source;
    await session.fit();
    if (session.status !== 'running' || session.source !== source) return;
    // Superseded: nothing ran, and nothing will report. Start again from idle.
    session.status = 'idle';
    await sleep(200);
  }
}
