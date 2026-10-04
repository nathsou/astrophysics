/**
 * The peephole court in a Web Worker: one rewrite, checked width by width, then the certificates of the proofs
 * (checking a certificate takes longer than finding the proof, so verdicts are posted first).
 */
import { certify, checkAt, circuitSize, parseRewrite, RewriteError, type WidthVerdict } from './peephole';

export type CourtRequest = { text: string; widths: number[]; timeout: number; certify?: boolean };
export type CourtEvent =
  | { kind: 'width'; verdict: Omit<WidthVerdict, 'proof'>; size: { lhs: number; rhs: number } }
  | { kind: 'certified'; width: number; ok: boolean }
  | { kind: 'error'; message: string }
  | { kind: 'done' };

const post = (e: CourtEvent) => postMessage(e);

addEventListener('message', (e: MessageEvent<CourtRequest>) => {
  const { text, widths, timeout, certify: wantCertificates = true } = e.data;
  let rw;
  try {
    rw = parseRewrite(text);
  } catch (err) {
    post({ kind: 'error', message: err instanceof RewriteError ? err.message : String(err) });
    post({ kind: 'done' });
    return;
  }
  const proved: WidthVerdict[] = [];
  for (const w of widths) {
    const v = checkAt(rw, w, { timeout, certify: false });
    const { proof, ...rest } = v;
    if (proof) proved.push(v);
    post({ kind: 'width', verdict: rest, size: { lhs: circuitSize(rw.lhs, w).gates, rhs: circuitSize(rw.rhs, w).gates } });
  }
  if (wantCertificates) for (const v of proved) post({ kind: 'certified', width: v.width, ok: certify(v) });
  post({ kind: 'done' });
});
