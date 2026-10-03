import { describe, it, expect } from 'vitest';
import { teacherSystem, teacherHistory } from './teacher';
import type { TutorMessage } from './client';

describe('teacher context', () => {
  it('grounds answers in the active lesson, learner level and course map', () => {
    const prompt = teacherSystem({ mode: 'mandarin', level: 'beginner', path: '/learn/07-numbers/', lesson: 'Numbers', section: 'Zero to ten', source: '二 and 两 differ.', words: ['二', '两'], completed: ['Pinyin'] });
    expect(prompt).toContain('Converse in Mandarin');
    expect(prompt).toContain('Current section: Zero to ten');
    expect(prompt).toContain('二 and 两 differ.');
    expect(prompt).toContain('23. HSK 2');
    expect(prompt).toContain('not necessarily mastered');
    expect(prompt).toContain('numbered pinyin');
  });
  it('limits lesson data and handles pages without a lesson', () => {
    const context = { mode: 'course' as const, level: 'beginner', path: '/practice/', words: [], completed: [] };
    expect(teacherSystem(context)).toContain('No lesson open');
    expect(teacherSystem({ ...context, source: 'x'.repeat(20_000) })).not.toContain('x'.repeat(16_001));
  });
  it('keeps recent conversation exchanges and starts with the learner', () => {
    const turns: TutorMessage[] = Array.from({ length: 31 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'turn '+i }));
    const result = teacherHistory(turns);
    expect(result).toHaveLength(21);
    expect(result[0]!.role).toBe('user');
    expect(result.at(-1)!.content).toBe('turn 30');
    expect(teacherHistory(turns, 20).reduce((n, t) => n + t.content.length, 0)).toBeLessThanOrEqual(20);
  });
});
