/**
 * The Canvas 2D fallback of the voltage landscape, for browsers without WebGL 2 (and for readers who ask for
 * it): the same scene, seen through an orthographic camera, drawn with the painter's algorithm (every
 * triangle and ball sorted from far to near and filled flat).
 */
import { BALL_RADIUS, type Scene } from './landscape';
import { project, viewProjection, type Camera, type Vec3 } from './mat4';

export interface Colours2D {
  ball: string;
  /** Light direction (unit vector, world space). */
  light: Vec3;
}

type Item = { depth: number; draw: () => void };

const shade = (n: Vec3, light: Vec3) => 0.5 + 0.62 * Math.max(0, n[0] * light[0] + n[1] * light[1] + n[2] * light[2]);

function rgba(c: [number, number, number], a: number, k = 1): string {
  return `rgba(${Math.min(255, Math.round(c[0] * 255 * k))},${Math.min(255, Math.round(c[1] * 255 * k))},${Math.min(255, Math.round(c[2] * 255 * k))},${a})`;
}

/** Draw the scene into a canvas of width × height CSS pixels (the context is already scaled by the pixel ratio). */
export function draw2D(ctx: CanvasRenderingContext2D, width: number, height: number, scene: Scene, balls: Vec3[], camera: Camera, colours: Colours2D): void {
  ctx.clearRect(0, 0, width, height);
  const mvp = viewProjection({ ...camera, ortho: true }, width / height);
  const items: Item[] = [];

  // Grid and ruler first.
  const L = scene.lines;
  ctx.lineWidth = 1;
  for (let i = 0; i < L.pos.length; i += 6) {
    const a = project([L.pos[i]!, L.pos[i + 1]!, L.pos[i + 2]!], mvp, width, height);
    const b = project([L.pos[i + 3]!, L.pos[i + 4]!, L.pos[i + 5]!], mvp, width, height);
    if (!a.visible || !b.visible) continue;
    const c = L.col.slice((i / 3) * 4, (i / 3) * 4 + 4);
    // The accent edges of the lift are drawn with the glass, on top.
    ctx.strokeStyle = rgba([c[0]!, c[1]!, c[2]!], c[3]!);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // Triangles of a mesh, with their flat colour.
  const addMesh = (m: Scene['opaque'], glass: boolean) => {
    for (let t = 0; t < m.pos.length / 9; t++) {
      const v = [0, 1, 2].map((k) => {
        const o = t * 9 + k * 3;
        return project([m.pos[o]!, m.pos[o + 1]!, m.pos[o + 2]!], mvp, width, height);
      });
      if (v.some((p) => !p.visible)) continue;
      const cn = t * 12;
      const col: [number, number, number] = [0, 1, 2].reduce<[number, number, number]>(
        (acc, k) => [acc[0] + m.col[cn + k * 4]! / 3, acc[1] + m.col[cn + k * 4 + 1]! / 3, acc[2] + m.col[cn + k * 4 + 2]! / 3],
        [0, 0, 0],
      );
      const alpha = m.col[cn + 3]!;
      const nrm: Vec3 = [m.nrm[t * 9]!, m.nrm[t * 9 + 1]!, m.nrm[t * 9 + 2]!];
      const fill = rgba(col, alpha, shade(nrm, colours.light));
      const depth = (v[0]!.depth + v[1]!.depth + v[2]!.depth) / 3 + (glass ? -1 : 0);
      items.push({
        depth,
        draw: () => {
          ctx.fillStyle = fill;
          ctx.strokeStyle = glass ? 'transparent' : fill;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(v[0]!.x, v[0]!.y);
          ctx.lineTo(v[1]!.x, v[1]!.y);
          ctx.lineTo(v[2]!.x, v[2]!.y);
          ctx.closePath();
          ctx.fill();
          if (!glass) ctx.stroke();
        },
      });
    }
  };
  addMesh(scene.opaque, false);

  // Balls, sorted with the triangles.
  const r = (BALL_RADIUS * height) / (camera.distance * Math.tan(camera.fov / 2)) / 2;
  for (const b of balls) {
    const p = project(b, mvp, width, height);
    if (!p.visible) continue;
    items.push({
      depth: p.depth - 0.002,
      draw: () => {
        const g = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.4, r * 0.1, p.x, p.y, r * 1.1);
        g.addColorStop(0, 'rgba(255,255,255,0.85)');
        g.addColorStop(0.35, colours.ball);
        g.addColorStop(1, colours.ball);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      },
    });
  }

  items.sort((a, b) => b.depth - a.depth);
  for (const it of items) it.draw();

  // The glass of the lift over everything.
  items.length = 0;
  addMesh(scene.glass, true);
  items.sort((a, b) => b.depth - a.depth);
  for (const it of items) it.draw();
}
