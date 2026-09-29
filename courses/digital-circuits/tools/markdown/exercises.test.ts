/** The exercise fixture compiles: every circuit and program block becomes its component with the spec intact. */
import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { compileMarkdown } from './compile';

const file = path.resolve(import.meta.dirname, 'fixtures/exercises.md');

describe('exercise blocks compile', () => {
  test('the fixture', async () => {
    const { code } = await compileMarkdown(readFileSync(file, 'utf8'), file);
    for (const tag of ['B.Build', 'B.Debug', 'B.Golf', 'B.Measure', 'B.Asm']) expect(code).toContain(`<${tag}`);
    // Circuits, tests and code are passed through as data, not rendered as Markdown.
    expect(code).toContain('&quot;type&quot;:&quot;xor&quot;'.replace(/&quot;/g, '"'));
    expect(code).toContain('"tests"');
    expect(code).toContain('LD   R0, [x]');
    // Markdown fields are rendered.
    expect(code).toContain('<strong>A</strong>');
  });
  test('a circuit given as a file path is inlined, and a missing file is an error', async () => {
    const block = (start: string) => `---\nnumber: 99\ntitle: t\n---\n\n\`\`\`debug\nid: x\nspec: { truthTable: { inputs: [A], outputs: [Y], rows: ["0 1", "1 0"] } }\nstart: ${start}\n\`\`\`\n`;
    const ok = await compileMarkdown(block('06-shannons-switches/circuits/staircase.json'), file);
    expect(ok.code).toContain('"components"');
    expect(ok.code).not.toContain('staircase.json');
    await expect(compileMarkdown(block('06-shannons-switches/circuits/nope.json'), file)).rejects.toThrow(/does not exist/);
  });
});
