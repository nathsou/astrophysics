/// <reference lib="webworker" />
/** The detector designer's simulations off the page's thread: the measurements and one particle shot into the design. */
import { gunEventFor, buildConfig, measure, type DesignParams, type Measurements } from './designer.ts';
import type { FullEvent } from '../../hep/event/index.ts';
import { installHooks } from './hooksWorker.ts';

export interface DesignerRequest {
  id: number;
  design: DesignParams;
  gun: { pdg: number; pt: number; eta: number; phi: number; seed: number };
  mine: Record<string, string>;
}
export type DesignerResponse = { id: number; meas: Measurements; event: FullEvent; errors: Record<string, string> } | { id: number; error: string };

self.onmessage = (e: MessageEvent<DesignerRequest>) => {
  const m = e.data;
  try {
    const errors = installHooks(['reco.circleFit'], m.mine);
    const meas = measure(m.design);
    const event = gunEventFor(buildConfig(m.design), m.gun.pdg, m.gun.pt, m.gun.eta, m.gun.phi, m.gun.seed);
    (self as unknown as Worker).postMessage({ id: m.id, meas, event, errors } satisfies DesignerResponse);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id: m.id, error: err instanceof Error ? err.message : String(err) } satisfies DesignerResponse);
  }
};
