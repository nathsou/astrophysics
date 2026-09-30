/** Test fixtures: real designs through the real flow, cached (the flow is the expensive part). */
import { readFileSync } from 'node:fs';
import { check, elaborate } from '../../hdl';
import { lowerToNetlist } from '../../hdl/lower';
import type { RtlDesign } from '../../hdl/rtl';
import { getVFpga } from '../../pld/devices/vfpga';
import { logicLinkOf, buildIndex } from './crossmap';
import { runFpgaFlow } from './result';
import type { FpgaResult, VFpgaSize } from './types';

const cache = new Map<string, { design: RtlDesign; result: FpgaResult }>();

export function designSource(name: string): string {
  return readFileSync(new URL(`../../../../content/designs/${name}.dcl`, import.meta.url), 'utf8');
}

export function flowOf(name: string, top: string, device?: VFpgaSize, source?: string) {
  const key = `${name}/${top}/${device ?? 'auto'}`;
  let hit = cache.get(key);
  if (!hit) {
    const src = source ?? designSource(name);
    const r = check(src, { file: `${name}.dcl` });
    const design = elaborate(r.program, top);
    hit = { design, result: runFpgaFlow(design, { device }) };
    cache.set(key, hit);
  }
  const dev = getVFpga(hit.result.size);
  const lowered = lowerToNetlist(hit.design, undefined, { io: true });
  const link = logicLinkOf(lowered);
  return { ...hit, device: dev, link, lowered, index: buildIndex(hit.result, dev, link) };
}
