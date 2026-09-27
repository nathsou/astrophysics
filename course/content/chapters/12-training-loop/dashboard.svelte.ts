/** The chapter's training run: one trainer shared by the dashboard, the noise study and the samples. */
import { GptTrainer, DEFAULT_TRAIN, type TrainConfig } from '$lib/train/gpt.svelte';

export type Preset = 'quick' | 'chargpt';

export const PRESETS: Record<Preset, { label: string; cfg: TrainConfig; minutes: string }> = {
  quick: { label: 'Quick (Chapter 11’s model)', cfg: { ...DEFAULT_TRAIN }, minutes: '1–2 minutes' },
  chargpt: {
    label: 'char-GPT',
    cfg: {
      ...DEFAULT_TRAIN,
      model: { T: 256, C: 192, layers: 4, heads: 6, dropout: 0.1 },
      batch: 32,
      steps: 3000,
      lr: 2e-3,
      warmup: 200,
      evalEvery: 500,
    },
    minutes: 'about 8 minutes',
  },
};

export const run = new GptTrainer(PRESETS.quick.cfg);
