/**
 * Speaking Chinese text. Clips generated ahead of time (scripts/generate-audio.ts) are listed in
 * static/audio/manifest.json and played when present; anything else falls back to the browser's
 * own Chinese voice, if it has one.
 */
import { base } from '$app/paths';
import { browser } from '$app/environment';
import { plain } from '$lib/zh/annotate';
import { settings } from '$lib/state/settings.svelte';

type Manifest = Record<string, string>;

/** The text a clip is keyed by: overrides stripped, whitespace trimmed. */
export const clipKey = (text: string) => plain(text).replace(/\s+/g, '').trim();

class Speech {
  /** The text currently being spoken, for highlighting play buttons. */
  playing: string | null = $state(null);
  /** False once we know the browser has no Chinese voice and no clip exists. */
  voiceMissing = $state(false);
  private manifest: Promise<Manifest> | null = null;
  private audio: HTMLAudioElement | null = null;
  private token = 0;

  private loadManifest(): Promise<Manifest> {
    this.manifest ??= fetch(`${base}/audio/manifest.json`)
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}));
    return this.manifest;
  }

  /** Warm the manifest so the first click plays immediately. */
  prepare(): void {
    if (browser) void this.loadManifest();
  }

  async has(text: string): Promise<boolean> {
    return clipKey(text) in (await this.loadManifest());
  }

  stop(): void {
    this.token++;
    this.audio?.pause();
    if (browser && 'speechSynthesis' in window) speechSynthesis.cancel();
    this.playing = null;
  }

  /** Speak `text`; resolves when it finishes (or is interrupted). */
  async say(text: string, opts: { rate?: number } = {}): Promise<void> {
    if (!browser) return;
    this.stop();
    const token = this.token;
    const rate = (opts.rate ?? 1) * settings.data.rate;
    this.playing = text;
    const file = (await this.loadManifest())[clipKey(text)];
    if (token !== this.token) return;
    try {
      if (file) await this.playFile(`${base}/audio/${file}`, rate, token);
      else await this.synthesise(plain(text), rate, token);
    } finally {
      if (token === this.token) this.playing = null;
    }
  }

  private playFile(src: string, rate: number, token: number): Promise<void> {
    return new Promise((resolve) => {
      const a = new Audio(src);
      a.playbackRate = rate;
      a.preservesPitch = true;
      this.audio = a;
      a.onended = a.onerror = a.onpause = () => resolve();
      a.play().catch(() => resolve());
      if (token !== this.token) a.pause();
    });
  }

  private voice(): SpeechSynthesisVoice | undefined {
    const voices = speechSynthesis.getVoices();
    const zh = voices.filter((v) => /^zh[-_](CN|Hans)/i.test(v.lang) || v.lang === 'zh');
    return zh.find((v) => /natural|neural|premium|enhanced/i.test(v.name)) ?? zh.find((v) => v.localService) ?? zh[0] ?? voices.find((v) => v.lang.startsWith('zh'));
  }

  private async synthesise(text: string, rate: number, token: number): Promise<void> {
    if (!('speechSynthesis' in window)) {
      this.voiceMissing = true;
      return;
    }
    if (!speechSynthesis.getVoices().length) {
      await new Promise<void>((r) => {
        speechSynthesis.addEventListener('voiceschanged', () => r(), { once: true });
        setTimeout(r, 800);
      });
    }
    if (token !== this.token) return;
    const voice = this.voice();
    if (!voice) this.voiceMissing = true;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    if (voice) u.voice = voice;
    u.rate = 0.9 * rate;
    await new Promise<void>((resolve) => {
      u.onend = u.onerror = () => resolve();
      speechSynthesis.speak(u);
    });
  }
}

export const speech = new Speech();
