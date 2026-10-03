export const PROVIDERS = {
  anthropic: { name: 'Anthropic', host: 'api.anthropic.com', model: 'claude-opus-5-5', placeholder: 'sk-ant-…' },
  openai: { name: 'OpenAI', host: 'api.openai.com', model: 'gpt-4.1-mini', placeholder: 'sk-…' },
  openrouter: { name: 'OpenRouter', host: 'openrouter.ai', model: 'openai/gpt-4.1-mini', placeholder: 'sk-or-…' },
} as const;
export type Provider = keyof typeof PROVIDERS;
export interface TutorConfig { apiKey: string; model: string }
export interface TutorSettings { provider: Provider; tutors: Record<Provider, TutorConfig> }
export function isProvider(value: unknown): value is Provider {
  return typeof value === 'string' && Object.hasOwn(PROVIDERS, value);
}

/** Migrate older Anthropic-only settings and validate profiles from storage/backups. */
export function tutorSettings(value: unknown): TutorSettings {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const profiles = raw.tutors && typeof raw.tutors === 'object' ? raw.tutors as Record<string, unknown> : {};
  const tutors = {} as Record<Provider, TutorConfig>;
  for (const provider of Object.keys(PROVIDERS) as Provider[]) {
    const saved = profiles[provider];
    const profile = saved && typeof saved === 'object' ? saved as Record<string, unknown> : provider === 'anthropic' ? raw : {};
    tutors[provider] = {
      apiKey: typeof profile.apiKey === 'string' ? profile.apiKey.trim() : '',
      model: typeof profile.model === 'string' && profile.model.trim() ? profile.model.trim() : PROVIDERS[provider].model,
    };
  }
  return { provider: isProvider(raw.provider) ? raw.provider : 'anthropic', tutors };
}

/** Backups contain model preferences, never credentials. */
export function withoutTutorKeys(value: TutorSettings): TutorSettings {
  const safe = tutorSettings(value);
  for (const config of Object.values(safe.tutors)) config.apiKey = '';
  return safe;
}

/** Restoring a backup keeps this device's keys, including when the backup contains keys. */
export function restoreTutorSettings(backup: unknown, current: TutorSettings): TutorSettings {
  const restored = withoutTutorKeys(tutorSettings(backup));
  for (const provider of Object.keys(PROVIDERS) as Provider[]) restored.tutors[provider].apiKey = current.tutors[provider].apiKey;
  return restored;
}
