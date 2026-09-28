/**
 * Settings for the optional LLM tutor. The learner's own Anthropic API key is kept in this
 * browser's localStorage and sent only to api.anthropic.com.
 */
import { browser } from '$app/environment';

const KEY = 'proofcraft:tutor';

interface Stored {
  apiKey: string;
  model: string;
}

export const DEFAULT_MODEL = 'claude-opus-5';

class TutorSettings {
  apiKey = $state('');
  model = $state(DEFAULT_MODEL);
  open = $state(false);
  private loaded = false;

  load(): void {
    if (this.loaded || !browser) return;
    this.loaded = true;
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Stored>;
      this.apiKey = s.apiKey ?? '';
      this.model = s.model || DEFAULT_MODEL;
    } catch {
      /* no stored settings */
    }
  }

  save(apiKey: string, model: string): void {
    this.apiKey = apiKey.trim();
    this.model = model || DEFAULT_MODEL;
    try {
      if (this.apiKey) localStorage.setItem(KEY, JSON.stringify({ apiKey: this.apiKey, model: this.model }));
      else localStorage.removeItem(KEY);
    } catch {
      /* storage unavailable: the key lasts for this page only */
    }
  }

  get enabled(): boolean {
    return this.apiKey.length > 0;
  }
}

export const tutorSettings = new TutorSettings();
