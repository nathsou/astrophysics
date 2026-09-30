import { describe, expect, it } from 'vitest';
import { getVFpga } from '../../pld/devices/vfpga';
import { FALLBACK } from '../../theme/signals';
import { buildChipModel } from './chipmodel';
import { hsl, moduleColour, render, type DrawOptions } from './draw';
import { FabricSim, boardPorts } from './fabric-sim';
import { bindBoard, emptyBoardInputs } from './board';
import { flowOf } from './fixture.test-util';
import { TILE, cellRect, dieGeom, fitRect, tileRect, zoomFor } from './geometry';
import { placeFrame } from './replay';
import { EMPTY_FPGA_PROBE } from './types';

/** A canvas context that records what is drawn. */
function recorder() {
  const calls: Record<string, number> = {};
  const texts: string[] = [];
  const ctx = new Proxy(
    {},
    {
      get(_t, name: string) {
        if (name === 'measureText') return () => ({ width: 10 });
        return (...args: unknown[]) => {
          calls[name] = (calls[name] ?? 0) + 1;
          if (name === 'fillText') texts.push(String(args[0]));
        };
      },
      set() {
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, calls, texts };
}

describe('canvas painter', () => {
  const f = flowOf('counter', 'Counter', 'S');
  const model = buildChipModel(f.device, f.result.bits, f.result, f.index);
  const g = dieGeom(f.device);
  const base = (over: Partial<DrawOptions> = {}): DrawOptions => ({
    model,
    view: { k: 0.3, tx: 0, ty: 0 },
    width: 800,
    height: 600,
    dpr: 1,
    sig: FALLBACK.dark,
    probe: EMPTY_FPGA_PROBE,
    hover: EMPTY_FPGA_PROBE,
    cursor: null,
    sim: null,
    layers: { wires: true, modules: true, critical: true },
    replay: null,
    congestion: null,
    node: null,
    editable: false,
    ...over,
  });

  it('paints the whole chip, a tile and a cell without failing, drawing more detail as it zooms', () => {
    const chip = recorder();
    render(chip.ctx, base({ view: fitRect({ x: 0, y: 0, w: g.width, h: g.height }, 800, 600) }));
    expect(chip.calls.fill).toBeGreaterThan(10);
    expect(chip.texts.some((t) => t.startsWith('LUT'))).toBe(false);

    const c0 = f.result.cells[0]!;
    const tile = recorder();
    render(tile.ctx, base({ view: fitRect(tileRect(g, c0.x, c0.y), 800, 600, 10) }));
    expect(tile.texts.some((t) => t === 'LUT4')).toBe(true);
    expect(tile.texts).toContain(`(${c0.x}, ${c0.y})`);

    const cell = recorder();
    render(cell.ctx, base({ view: fitRect(cellRect(g, c0.x, c0.y, c0.k), 800, 600, 10, 30) }));
    // The detailed drawing has the 16 stored bits and the multiplexer tree's select labels.
    expect(cell.texts.filter((t) => t === '0' || t === '1').length).toBeGreaterThanOrEqual(16);
    expect(cell.texts).toContain('D flip-flop');
    expect(cell.texts.some((t) => t.includes('LUT 0x'))).toBe(true);
    expect(cell.calls.fill).toBeGreaterThan(tile.calls.fill! / 4);
  });

  it('paints selections, hover, the cursor, the running board and the replays', () => {
    const c0 = f.result.cells[0]!;
    const probe = { ...EMPTY_FPGA_PROBE, cells: new Set([`${c0.x},${c0.y},${c0.k}`]), tiles: new Set([`${c0.x},${c0.y}`]), nets: new Set([0]) };
    const view = fitRect({ x: 0, y: 0, w: g.width, h: g.height }, 800, 600);
    const sim = new FabricSim(f.device, f.result.bits, { ports: f.result.ports, binding: bindBoard(boardPorts(f.design)), design: f.design, periodNs: 3 });
    sim.setInputs(emptyBoardInputs());
    sim.clock();
    const frame = placeFrame(f.result.place, 0.5);
    for (const o of [
      base({ view, probe, hover: probe, cursor: { x: c0.x, y: c0.y } }),
      base({ view, sim }),
      base({ view, replay: { frame, place: f.result.place, showLinks: true } }),
      base({ view, congestion: { tiles: new Map([[`${c0.x},${c0.y}`, 3]]), max: 3, nodes: f.result.nets[0]!.nodes } }),
      base({ view: { k: 1.2, tx: -200, ty: -200 }, node: f.result.nets[0]!.nodes[2]!, editable: true }),
    ]) {
      const r = recorder();
      expect(() => render(r.ctx, o)).not.toThrow();
      expect(Object.values(r.calls).reduce((a, b) => a + b, 0)).toBeGreaterThan(20);
    }
  });

  it('culls what is off screen: zoomed far in, only a few tiles are drawn', () => {
    const m = buildChipModel(getVFpga('M'), new Uint8Array(getVFpga('M').totalBits));
    const gm = dieGeom(m.device);
    const close = recorder();
    render(close.ctx, { ...base(), model: m, view: { k: zoomFor('tile', gm, 800, 600), tx: 0, ty: 0 } });
    const far = recorder();
    render(far.ctx, { ...base(), model: m, view: { k: zoomFor('chip', gm, 800, 600), tx: 0, ty: 0 } });
    // At tile zoom a screen shows one tile of a 16 × 14 die: far fewer shapes than the whole die at chip zoom.
    expect(close.calls.stroke ?? 0).toBeLessThan((far.calls.stroke ?? 0) / 4);
    expect(TILE).toBeGreaterThan(0);
  });

  it('converts hues to rgb and gives modules distinct colours', () => {
    expect(hsl(0, 100, 50)).toBe('rgb(255, 0, 0)');
    expect(hsl(120, 100, 50)).toBe('rgb(0, 255, 0)');
    expect(hsl(240, 100, 25)).toBe('rgb(0, 0, 128)');
    expect(new Set([0, 1, 2, 3, 4].map(moduleColour)).size).toBe(5);
  });
});
