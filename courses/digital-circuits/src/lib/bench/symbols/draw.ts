/**
 * Geometry helpers for symbols (pixels, the component's own coordinates at rotation 0). Pure, so
 * the shapes that must meet pins exactly (gate input curves) can be tested.
 */
import { G } from '../geometry';

const f = (v: number) => String(Math.round(v * 100) / 100);

/** Points of a filled arrowhead with its tip at (x, y), pointing along (ux, uy). */
export function arrowHead(x: number, y: number, ux: number, uy: number, len = 5, half = 2.4): string {
  const l = Math.hypot(ux, uy) || 1;
  const [dx, dy] = [ux / l, uy / l];
  const bx = x - dx * len;
  const by = y - dy * len;
  return `${f(x)},${f(y)} ${f(bx - dy * half)},${f(by + dx * half)} ${f(bx + dy * half)},${f(by - dx * half)}`;
}

export interface GateShape {
  /** Outline of the body (filled). */
  body: string;
  /** Extra stroke (the XOR's second back curve). */
  extra?: string;
  /** Input stubs, in pin order, from the pin to the body. */
  inputs: string[];
  /** Output stub from the output pin to the body (or bubble). */
  output: string;
  /** Inversion bubble centre, if any. */
  bubble?: { cx: number; cy: number; r: number };
}

const BUBBLE = 3.5;

/**
 * ANSI distinctive-shape gates. Inputs every 2 grid units on x = 0, output at x = 6 units, level
 * with the middle input (catalog geometry). The body spans x = 12 … 56–62 px.
 */
export function gateShape(type: string, k: number): GateShape {
  const n = Math.max(1, Math.min(8, k));
  const yc = (n - 1) * G;
  const hh = Math.max(22, (n - 1) * G + 10);
  const top = yc - hh;
  const bottom = yc + hh;
  const outX = 6 * G;
  const ys = Array.from({ length: n }, (_, i) => 2 * i * G);
  const inverted = type === 'nand' || type === 'nor' || type === 'xnor';
  const base = type.replace(/^n(and|or)$/, '$1').replace('xnor', 'xor');

  let body: string;
  let extra: string | undefined;
  let tip: number;
  let inputs: string[];
  if (base === 'and') {
    const x0 = 12;
    const flat = 34;
    tip = flat + 22;
    body = `M${x0} ${f(top)} H${flat} A22 ${f(hh)} 0 0 1 ${flat} ${f(bottom)} H${x0} Z`;
    inputs = ys.map((y) => `M0 ${y} H${x0}`);
  } else {
    // OR and XOR: a concave back (quadratic, bulging 5 px), pointed front.
    const x0 = base === 'xor' ? 14 : 12;
    tip = x0 + 48;
    body = `M${x0} ${f(top)} Q${x0 + 28} ${f(top)} ${tip} ${f(yc)} Q${x0 + 28} ${f(bottom)} ${x0} ${f(bottom)} Q${x0 + 10} ${f(yc)} ${x0} ${f(top)} Z`;
    const back = base === 'xor' ? 8 : x0;
    if (base === 'xor') extra = `M${back} ${f(top)} Q${back + 10} ${f(yc)} ${back} ${f(bottom)}`;
    // x on the back curve at height y: x0 + 20 t (1 − t), with t linear in y.
    inputs = ys.map((y) => {
      const t = (y - top) / (bottom - top);
      return `M0 ${y} H${f(back + 20 * t * (1 - t))}`;
    });
  }
  const bubble = inverted ? { cx: tip + BUBBLE, cy: yc, r: BUBBLE } : undefined;
  const output = `M${outX} ${f(yc)} H${f(inverted ? tip + 2 * BUBBLE : tip)}`;
  return { body, extra, inputs, output, bubble };
}

/** Is a pin name active-low by the course's convention (a trailing lowercase n after a capital or digit: CLRn, OEn)? */
export const activeLow = (name: string): boolean => /[A-Z0-9]n$/.test(name);

/** Is a pin a clock input (drawn with the dynamic-input triangle)? */
export const isClock = (name: string): boolean => /^(CLK|CK|CLOCK)/i.test(name);
