// The figures: one module per proposition in src/figures/b<book>/p<n>.ts, loaded on demand.
import type { FigureDef } from '../geometry/figure';

const loaders = import.meta.glob('../figures/b*/p[0-9]*.ts', { import: 'default' }) as Record<string, () => Promise<FigureDef>>;

export const figurePath = (id: string) => {
  const [b, n] = id.split('.');
  return `../figures/b${b.padStart(2, '0')}/p${n.padStart(2, '0')}.ts`;
};
export const hasFigure = (id: string) => figurePath(id) in loaders;
export async function loadFigure(id: string): Promise<FigureDef | undefined> {
  const l = loaders[figurePath(id)];
  return l ? await l() : undefined;
}
