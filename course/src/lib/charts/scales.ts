import { scaleLinear, scaleLog, type ScaleContinuousNumeric } from 'd3-scale';
import { format as d3format } from 'd3-format';

export interface AxisSpec {
  type?: 'linear' | 'log';
  domain: [number, number];
  label?: string;
  ticks?: number;
  format?: (v: number) => string;
  nice?: boolean;
}

export type Scale = ScaleContinuousNumeric<number, number>;

/** What a Plot passes to its `marks` snippet. */
export interface PlotCtx {
  sx: Scale;
  sy: Scale;
  width: number;
  height: number;
}

export function makeScale(spec: AxisSpec, range: [number, number]): Scale {
  const s = (spec.type === 'log' ? scaleLog() : scaleLinear()).domain(spec.domain).range(range) as Scale;
  if (spec.nice && spec.type !== 'log') s.nice(spec.ticks ?? 6);
  return s;
}

const si = d3format('~s');
const plain = d3format(',~r');

/** Tick values and labels; log axes label powers of ten only. */
export function ticksFor(spec: AxisSpec, scale: Scale): { value: number; label: string }[] {
  const fmt = spec.format ?? ((v: number) => (Math.abs(v) >= 10_000 ? si(v) : plain(Number(v.toPrecision(6)))));
  if (spec.type === 'log') {
    const [lo, hi] = scale.domain() as [number, number];
    const out: { value: number; label: string }[] = [];
    for (let k = Math.ceil(Math.log10(lo)); k <= Math.floor(Math.log10(hi)); k++) out.push({ value: 10 ** k, label: fmt(10 ** k) });
    return out;
  }
  return scale.ticks(spec.ticks ?? 6).map((v) => ({ value: v, label: fmt(v) }));
}
