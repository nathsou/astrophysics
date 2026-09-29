/**
 * The TAP controller's state diagram as data: node positions and edge paths for drawing, and the
 * transitions themselves (from `nextTapState`, so the picture cannot disagree with the model).
 */
import { TAP_STATES, nextTapState, type TapState } from '../pld/cpld/jtag';

export interface TapNode {
  state: TapState;
  x: number;
  y: number;
  /** Short label for the node. */
  label: string;
  column: 'top' | 'dr' | 'ir';
}

export const TAP_W = 720;
export const TAP_H = 700;
export const NODE_W = 116;
export const NODE_H = 34;

const X_DR = 215;
const X_IR = 505;
const Y0 = 40;
const DY = 72;
const row = (i: number) => Y0 + DY * i;

const at = (state: TapState, x: number, y: number, label: string, column: TapNode['column']): TapNode => ({ state, x, y, label, column });

export const TAP_NODES: TapNode[] = [
  at('Test-Logic-Reset', 360, row(0), 'Test-Logic-Reset', 'top'),
  at('Run-Test/Idle', 360, row(1), 'Run-Test/Idle', 'top'),
  at('Select-DR-Scan', X_DR, row(2), 'Select-DR-Scan', 'dr'),
  at('Capture-DR', X_DR, row(3), 'Capture-DR', 'dr'),
  at('Shift-DR', X_DR, row(4), 'Shift-DR', 'dr'),
  at('Exit1-DR', X_DR, row(5), 'Exit1-DR', 'dr'),
  at('Pause-DR', X_DR, row(6), 'Pause-DR', 'dr'),
  at('Exit2-DR', X_DR, row(7), 'Exit2-DR', 'dr'),
  at('Update-DR', X_DR, row(8), 'Update-DR', 'dr'),
  at('Select-IR-Scan', X_IR, row(2), 'Select-IR-Scan', 'ir'),
  at('Capture-IR', X_IR, row(3), 'Capture-IR', 'ir'),
  at('Shift-IR', X_IR, row(4), 'Shift-IR', 'ir'),
  at('Exit1-IR', X_IR, row(5), 'Exit1-IR', 'ir'),
  at('Pause-IR', X_IR, row(6), 'Pause-IR', 'ir'),
  at('Exit2-IR', X_IR, row(7), 'Exit2-IR', 'ir'),
  at('Update-IR', X_IR, row(8), 'Update-IR', 'ir'),
];

export const nodeOf = (s: TapState): TapNode => TAP_NODES.find((n) => n.state === s)!;

export interface TapEdge {
  from: TapState;
  to: TapState;
  tms: 0 | 1;
  /** SVG path from the border of one node to the border of the other. */
  d: string;
  /** Where the TMS label sits. */
  label: { x: number; y: number };
}

const hw = NODE_W / 2;
const hh = NODE_H / 2;

/** Hand-routed paths. Keys: `from|tms`. */
function route(from: TapNode, to: TapNode, tms: 0 | 1): { d: string; label: { x: number; y: number } } {
  const key = `${from.state}|${tms}`;
  const f = from;
  const t = to;
  const down = (a: TapNode, b: TapNode) => ({ d: `M${a.x} ${a.y + hh} L${b.x} ${b.y - hh}`, label: { x: a.x + 10, y: (a.y + b.y) / 2 } });
  switch (key) {
    // Self loops.
    case 'Test-Logic-Reset|1':
      return { d: `M${f.x - 20} ${f.y - hh} C${f.x - 30} ${f.y - hh - 34} ${f.x + 30} ${f.y - hh - 34} ${f.x + 20} ${f.y - hh}`, label: { x: f.x, y: f.y - hh - 30 } };
    case 'Run-Test/Idle|0':
      return { d: `M${f.x - hw} ${f.y - 8} C${f.x - hw - 46} ${f.y - 30} ${f.x - hw - 46} ${f.y + 30} ${f.x - hw} ${f.y + 8}`, label: { x: f.x - hw - 38, y: f.y + 4 } };
    case 'Shift-DR|0':
    case 'Pause-DR|0':
      return { d: `M${f.x - hw} ${f.y - 8} C${f.x - hw - 46} ${f.y - 30} ${f.x - hw - 46} ${f.y + 30} ${f.x - hw} ${f.y + 8}`, label: { x: f.x - hw - 38, y: f.y + 4 } };
    case 'Shift-IR|0':
    case 'Pause-IR|0':
      return { d: `M${f.x + hw} ${f.y - 8} C${f.x + hw + 46} ${f.y - 30} ${f.x + hw + 46} ${f.y + 30} ${f.x + hw} ${f.y + 8}`, label: { x: f.x + hw + 38, y: f.y + 4 } };
    // The trunk: TLR → RTI → Select-DR.
    case 'Test-Logic-Reset|0':
      return down(f, t);
    case 'Run-Test/Idle|1':
      return { d: `M${f.x - 40} ${f.y + hh - 2} L${t.x + 50} ${t.y - hh}`, label: { x: (f.x + t.x) / 2 - 2, y: (f.y + t.y) / 2 + 6 } };
    case 'Select-DR-Scan|0':
    case 'Capture-DR|0':
    case 'Exit1-DR|0':
    case 'Pause-DR|1':
    case 'Exit2-DR|1':
    case 'Select-IR-Scan|0':
    case 'Capture-IR|0':
    case 'Exit1-IR|0':
    case 'Pause-IR|1':
    case 'Exit2-IR|1':
    case 'Shift-DR|1':
    case 'Shift-IR|1':
      return down(f, t);
    case 'Select-DR-Scan|1':
      return { d: `M${f.x + hw} ${f.y} L${t.x - hw} ${t.y}`, label: { x: (f.x + t.x) / 2, y: f.y - 6 } };
    case 'Select-IR-Scan|1':
      return { d: `M${f.x} ${f.y - hh} C${f.x} ${f.y - 90} ${t.x + 130} ${t.y + 10} ${t.x + hw - 6} ${t.y + hh - 4}`, label: { x: (f.x + t.x) / 2 + 60, y: f.y - 54 } };
    // Skipping a row: bulge away from the column.
    case 'Capture-DR|1':
      return { d: `M${f.x - hw} ${f.y + 6} C${f.x - hw - 92} ${f.y + 40} ${f.x - hw - 92} ${t.y - 40} ${t.x - hw} ${t.y - 6}`, label: { x: f.x - hw - 72, y: (f.y + t.y) / 2 } };
    case 'Capture-IR|1':
      return { d: `M${f.x + hw} ${f.y + 6} C${f.x + hw + 92} ${f.y + 40} ${f.x + hw + 92} ${t.y - 40} ${t.x + hw} ${t.y - 6}`, label: { x: f.x + hw + 72, y: (f.y + t.y) / 2 } };
    case 'Exit1-DR|1':
      return { d: `M${f.x - hw} ${f.y + 6} C${f.x - hw - 92} ${f.y + 60} ${f.x - hw - 92} ${t.y - 60} ${t.x - hw} ${t.y - 6}`, label: { x: f.x - hw - 72, y: (f.y + t.y) / 2 } };
    case 'Exit1-IR|1':
      return { d: `M${f.x + hw} ${f.y + 6} C${f.x + hw + 92} ${f.y + 60} ${f.x + hw + 92} ${t.y - 60} ${t.x + hw} ${t.y - 6}`, label: { x: f.x + hw + 72, y: (f.y + t.y) / 2 } };
    // Exit2 back to Shift: up the inside of the column.
    case 'Exit2-DR|0':
      return { d: `M${f.x + hw} ${f.y - 6} C${f.x + hw + 56} ${f.y - 60} ${f.x + hw + 56} ${t.y + 60} ${t.x + hw} ${t.y + 6}`, label: { x: f.x + hw + 44, y: (f.y + t.y) / 2 } };
    case 'Exit2-IR|0':
      return { d: `M${f.x - hw} ${f.y - 6} C${f.x - hw - 56} ${f.y - 60} ${f.x - hw - 56} ${t.y + 60} ${t.x - hw} ${t.y + 6}`, label: { x: f.x - hw - 44, y: (f.y + t.y) / 2 } };
    // Update states return to Run-Test/Idle and Select-DR-Scan.
    case 'Update-DR|0':
      return { d: `M${f.x - hw} ${f.y + 4} C${f.x - 200} ${f.y + 40} ${f.x - 200} ${t.y + 60} ${t.x - hw} ${t.y + 6}`, label: { x: f.x - 152, y: (f.y + t.y) / 2 } };
    case 'Update-DR|1':
      return { d: `M${f.x - 40} ${f.y - hh} C${f.x - 150} ${f.y - 150} ${f.x - 150} ${t.y + 150} ${t.x - 40} ${t.y + hh}`, label: { x: f.x - 112, y: (f.y + t.y) / 2 + 60 } };
    case 'Update-IR|0':
      return { d: `M${f.x + hw} ${f.y + 4} C${f.x + 200} ${f.y + 60} ${f.x + 220} ${t.y + 20} ${t.x + hw} ${t.y + 6}`, label: { x: f.x + 152, y: (f.y + t.y) / 2 } };
    case 'Update-IR|1':
      return { d: `M${f.x - hw} ${f.y - 4} C${f.x - 150} ${f.y - 60} ${t.x + 160} ${t.y + 180} ${t.x + hw} ${t.y + 6}`, label: { x: (f.x + t.x) / 2 + 64, y: (f.y + t.y) / 2 + 60 } };
  }
  return { d: `M${f.x} ${f.y} L${t.x} ${t.y}`, label: { x: (f.x + t.x) / 2, y: (f.y + t.y) / 2 } };
}

export const TAP_EDGES: TapEdge[] = TAP_STATES.flatMap((s) =>
  ([0, 1] as const).map((tms) => {
    const to = nextTapState(s, tms);
    const r = route(nodeOf(s), nodeOf(to), tms);
    return { from: s, to, tms, d: r.d, label: r.label };
  }),
);

export const edgeFor = (from: TapState, tms: number): TapEdge => TAP_EDGES.find((e) => e.from === from && e.tms === (tms ? 1 : 0))!;
