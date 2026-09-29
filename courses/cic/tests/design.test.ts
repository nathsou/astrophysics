// Layout logic behind the course map and derivation trees (no DOM needed).
import { describe, expect, it } from 'vitest';
import { chapters } from '../src/content/chapters.ts';
import { edgeSegment, horizontal, mapEdges, mapNodes, nodeRadius, textBox, textWidth, vertical, type Box, type MapLayout } from '../src/viz/courseMapData.ts';
import { DEFAULT_OPEN_LEVELS, initialRevealDepth } from '../src/viz/derivationDepth.ts';

const overlap = (a: Box, b: Box, pad = 0) => a.x0 < b.x1 + pad && b.x0 < a.x1 + pad && a.y0 < b.y1 + pad && b.y0 < a.y1 + pad;

function circleHitsBox(c: { x: number; y: number; r: number }, b: Box, pad = 0) {
  const nx = Math.max(b.x0, Math.min(c.x, b.x1));
  const ny = Math.max(b.y0, Math.min(c.y, b.y1));
  return Math.hypot(nx - c.x, ny - c.y) < c.r + pad;
}

function labelBoxes(L: MapLayout) {
  const boxes: { what: string; box: Box }[] = [];
  for (const n of mapNodes) boxes.push({ what: `sub ${n.id}`, box: textBox(L.nodes[n.id].sub, n.sub, L.textSize) });
  for (const [a, b, label] of mapEdges) if (label) boxes.push({ what: `edge ${a}-${b}`, box: textBox(L.edgeLabels[`${a}-${b}`], label, L.textSize, 'italic') });
  return boxes;
}

describe('course map layouts', () => {
  it('links every calculus to an existing chapter', () => {
    for (const n of mapNodes) expect(chapters.some((c) => c.slug === n.ch), n.ch).toBe(true);
  });

  for (const L of [horizontal, vertical]) {
    describe(L.name, () => {
      it('places every node and every labelled edge', () => {
        for (const n of mapNodes) expect(L.nodes[n.id], n.id).toBeDefined();
        for (const [a, b, label] of mapEdges) if (label) expect(L.edgeLabels[`${a}-${b}`], `${a}-${b}`).toBeDefined();
      });

      it('makes every node large enough for its label', () => {
        for (const n of mapNodes) {
          const r = L.nodes[n.id].r;
          expect(r, n.id).toBeGreaterThanOrEqual(nodeRadius(n.label, L.labelSize));
          expect(textWidth(n.label, L.labelSize, 'bold'), n.id).toBeLessThan(2 * r - 8);
        }
      });

      it('keeps all text inside the view box', () => {
        for (const { what, box } of labelBoxes(L)) {
          expect(box.x0, what).toBeGreaterThanOrEqual(0);
          expect(box.x1, what).toBeLessThanOrEqual(L.width);
          expect(box.y0, what).toBeGreaterThanOrEqual(0);
          expect(box.y1, what).toBeLessThanOrEqual(L.height);
        }
        for (const n of mapNodes) {
          const p = L.nodes[n.id];
          expect(p.x - p.r, n.id).toBeGreaterThanOrEqual(0);
          expect(p.x + p.r, n.id).toBeLessThanOrEqual(L.width);
          expect(p.y + p.r, n.id).toBeLessThanOrEqual(L.height);
        }
      });

      it('never lets a label touch a node or another label', () => {
        const boxes = labelBoxes(L);
        for (const { what, box } of boxes) {
          for (const n of mapNodes) {
            // a node's own sub-label may sit close, but not inside the circle
            expect(circleHitsBox(L.nodes[n.id], box, 1), `${what} vs node ${n.id}`).toBe(false);
          }
        }
        for (let i = 0; i < boxes.length; i++)
          for (let j = i + 1; j < boxes.length; j++) expect(overlap(boxes[i].box, boxes[j].box, 2), `${boxes[i].what} vs ${boxes[j].what}`).toBe(false);
      });

      it('never lets an arrow cross a label', () => {
        const boxes = labelBoxes(L);
        for (const [a, b] of mapEdges) {
          const s = edgeSegment(L, a, b);
          for (let t = 0; t <= 1; t += 0.02) {
            const x = s.x1 + (s.x2 - s.x1) * t;
            const y = s.y1 + (s.y2 - s.y1) * t;
            for (const { what, box } of boxes) {
              const hit = x > box.x0 - 1 && x < box.x1 + 1 && y > box.y0 - 1 && y < box.y1 + 1;
              expect(hit, `edge ${a}-${b} crosses ${what}`).toBe(false);
            }
          }
        }
      });
    });
  }

  it('keeps text readable at the sizes each layout is shown at', () => {
    // horizontal: shown from an 800px container (see .coursemap in layout.css)
    expect((horizontal.textSize * 800) / horizontal.width).toBeGreaterThanOrEqual(11);
    // …and 1:1-ish (≥ 13px) in the 932px home column at 1280px
    expect((horizontal.textSize * 932) / horizontal.width).toBeGreaterThanOrEqual(13);
    // vertical: a 320px phone leaves a 288px container
    expect((vertical.textSize * 288) / vertical.width).toBeGreaterThanOrEqual(12);
  });
});

describe('derivation trees', () => {
  it('open step-by-step trees a few levels deep', () => {
    expect(initialRevealDepth(true, 10)).toBe(DEFAULT_OPEN_LEVELS);
    expect(DEFAULT_OPEN_LEVELS).toBeGreaterThanOrEqual(2);
  });
  it('do not over-open small trees (so "grow tree" is disabled when nothing is left)', () => {
    expect(initialRevealDepth(true, 1)).toBe(2);
    expect(initialRevealDepth(true, 0)).toBe(1);
  });
  it('open other trees completely', () => {
    expect(initialRevealDepth(false, 10)).toBe(Infinity);
    expect(initialRevealDepth(undefined, 3)).toBe(Infinity);
  });
});
