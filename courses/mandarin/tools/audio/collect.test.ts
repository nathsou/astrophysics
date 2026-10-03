/**
 * Writes static/audio/texts.json (the list of clips to generate) when run with WRITE=1:
 *   WRITE=1 npx vitest run tools/audio/collect.test.ts
 * Otherwise just checks that collection works and matches the player's keys.
 */
import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { collect, clipKey } from './collect';
import { annotate } from '$lib/zh/annotate';

const root = join(__dirname, '../..');

describe('audio texts', () => {
  const texts = collect(root);
  it('covers words, lessons and widgets', () => {
    for (const k of ['你好', '妈妈骂马吗？', '谢谢', '马', '一本书']) expect(texts.has(clipKey(k)), k).toBe(true);
    expect(clipKey('长[zhǎng]大')).toBe('长大');
  });
  it('writes the clip list', () => {
    if (!process.env.WRITE) return;
    // The expected reading lets the generator check each clip (transcription and tone).
    const list = [...texts]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([text, tier]) => ({ text, tier, py: annotate(text).flatMap((t) => t.s?.map((s) => s.py) ?? []).join(' ') }));
    writeFileSync(join(root, 'static/audio/texts.json'), JSON.stringify(list, null, 0).replace(/\},\{/g, '},\n{') + '\n');
    const by = (t: string) => list.filter((x) => x.tier === t).length;
    console.log(`${list.length} clips: ${by('words')} words, ${by('lessons')} lesson texts, ${by('extras')} extras`);
  });
});
