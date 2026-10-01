import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileMarkdown } from '../../../tools/markdown/compile.ts';

/** The widgets are registered in src/lib/widgets/display.ts and usable from Markdown by their kebab-case names. */
describe('Markdown directives', () => {
  const file = path.resolve(import.meta.dirname, '../../../content/chapters/07-building-a-detector/index.md');
  const md = (line: string) => `---\nnumber: 7\ntitle: Test\n---\n\n${line}\n`;
  const cases: [string, string][] = [
    ['::event-display-widget{sample="zmumu" n="7.1" caption="A Z boson decaying to two muons."}', 'EventDisplayWidget'],
    ['::event-display-widget{sample="weν" views="3d,lego"}', 'EventDisplayWidget'],
    ['::truth-reco-compare{sample="h4e" n="7.3"}', 'TruthRecoCompare'],
    ['::particle-legend{kinds="muon,electron,photon"}', 'ParticleLegend'],
    ['::particle-gun-3d{n="7.2"}', 'ParticleGun3d'],
    ['::event-display{}', 'EventDisplay'],
  ];
  for (const [line, name] of cases) {
    it(`${line.split('{')[0]} resolves to ${name}`, async () => {
      const out = await compileMarkdown(md(line), file);
      expect(out.code).toContain(`W.${name}`);
    });
  }
});
