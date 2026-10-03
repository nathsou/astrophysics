import { describe, it, expect } from 'vitest';
import { tutorSettings, withoutTutorKeys, restoreTutorSettings } from './providers';

describe('provider settings', () => {
  it('migrates the existing Anthropic key and custom model', () => {
    const value = tutorSettings({ apiKey: ' old-key ', model: 'custom-claude' });
    expect(value.provider).toBe('anthropic');
    expect(value.tutors.anthropic).toEqual({ apiKey: 'old-key', model: 'custom-claude' });
    expect(value.tutors.openai.apiKey).toBe('');
  });
  it('keeps each provider configuration separate and repairs malformed profiles', () => {
    const value = tutorSettings({ provider: 'openrouter', tutors: { openrouter: { apiKey: 'router-key', model: 'custom/model' }, openai: { apiKey: 123, model: ' ' } } });
    expect(value.tutors.openrouter).toEqual({ apiKey: 'router-key', model: 'custom/model' });
    expect(value.tutors.openai).toEqual({ apiKey: '', model: 'gpt-4.1-mini' });
    expect(tutorSettings({ provider: '__proto__' }).provider).toBe('anthropic');
  });
  it('removes every key from exports without changing local profiles', () => {
    const local = tutorSettings({ tutors: { anthropic: { apiKey: 'a' }, openai: { apiKey: 'b' }, openrouter: { apiKey: 'c' } } });
    expect(Object.values(withoutTutorKeys(local).tutors).map(p => p.apiKey)).toEqual(['', '', '']);
    expect(local.tutors.openai.apiKey).toBe('b');
  });
  it('never imports credentials from new or legacy backups', () => {
    const local = tutorSettings({ apiKey: 'local-key' });
    const restored = restoreTutorSettings({ provider: 'openai', tutors: { openai: { apiKey: 'foreign-key', model: 'custom' } } }, local);
    expect(restored.tutors.anthropic.apiKey).toBe('local-key');
    expect(restored.tutors.openai).toEqual({ apiKey: '', model: 'custom' });
    expect(restoreTutorSettings({ apiKey: 'foreign-key' }, local).tutors.anthropic.apiKey).toBe('local-key');
  });
});
