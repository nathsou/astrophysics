// Explorations: playgrounds that go beyond single propositions. Each is a widget, also embeddable
// in the modern texts.

import { Suspense } from 'react';
import { widgets } from '../widgets/registry';

export const EXPLORATIONS: { name: string; title: string; desc: string; props: string[] }[] = [
  { name: 'geometries', title: 'Three geometries', desc: 'The same triangle in the Euclidean plane, the hyperbolic plane and on the sphere. Compare angle sums and count parallels: Postulate 5 holds, fails one way, or fails the other way.', props: ['1.post.5', '1.29', '1.32'] },
  { name: 'anthyphairesis', title: 'Subtracting lengths', desc: 'Euclid’s algorithm on lengths instead of numbers. It stops for commensurable magnitudes and runs forever for the side and diagonal of a square: that is how incommensurability shows itself (X.2).', props: ['7.2', '10.2', '10.3'] },
  { name: 'eudoxus-grid', title: 'Eudoxus’ ratios', desc: 'Book V’s definition of equal ratios, drawn as a picture: two ratios are equal when their grids of equimultiples agree everywhere.', props: ['5.def.5'] },
  { name: 'euclid-algorithm', title: 'Euclid’s algorithm', desc: 'VII.1–2 on two numbers, step by step, in Euclid’s subtractive form and the modern division form.', props: ['7.1', '7.2'] },
  { name: 'exhaustion', title: 'Exhaustion', desc: 'Polygons with 4, 8, 16, … sides inside a circle. Each doubling removes more than half of what is left (XII.2 with X.1): the method behind Archimedes and the integral.', props: ['10.1', '12.2'] },
  { name: 'regular-solids', title: 'Why only five?', desc: 'Faces meeting at a vertex must leave a gap to fold into a corner. Try triangles, squares, pentagons and hexagons, then turn the five regular solids of Book XIII.', props: ['13.18', '11.21'] },
];

export default function Explore({ name }: { name?: string }) {
  const ex = EXPLORATIONS.find((e) => e.name === name);
  if (ex && widgets[ex.name]) {
    const W = widgets[ex.name];
    return (
      <div className="page explore-page wide">
        <div className="crumbs">
          <a href="#/explore">Explorations</a>
        </div>
        <h1>{ex.title}</h1>
        <p className="lede">{ex.desc}</p>
        <Suspense fallback={<p className="muted">Loading…</p>}>
          <W />
        </Suspense>
        <p className="muted">
          See also:{' '}
          {ex.props.map((p, i) => (
            <span key={p}>
              {i > 0 && ', '}
              <a href={`#/${p}`}>{p}</a>
            </span>
          ))}
        </p>
      </div>
    );
  }
  return (
    <div className="page">
      <h1>Explorations</h1>
      <p className="lede">Playgrounds that go beyond single propositions.</p>
      <div className="home-tools">
        {EXPLORATIONS.filter((e) => widgets[e.name]).map((e) => (
          <a key={e.name} className="tool-card" href={`#/explore/${e.name}`}>
            <span className="tool-title">{e.title}</span>
            <span className="tool-desc">{e.desc}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
