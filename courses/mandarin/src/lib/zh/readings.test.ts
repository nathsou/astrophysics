import { describe, expect, it } from 'vitest';
import { charsFor, knownSyllables } from './readings';

describe('readings', () => {
  it('finds common characters for a syllable and tone', () => {
    expect(charsFor('ma', 1)).toContain('妈');
    expect(charsFor('hao', 3)[0]).toBe('好');
    expect(charsFor('shi', 4)[0]).toBe('是');
  });
  it('knows which syllables exist', () => {
    const s = knownSyllables();
    expect(s.has('zhong')).toBe(true);
    expect(s.has('lü')).toBe(true);
    expect(s.has('bou')).toBe(false);
  });
});
