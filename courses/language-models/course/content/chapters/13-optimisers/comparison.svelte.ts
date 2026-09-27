/**
 * The chapter's experiment: the quick character model (Chapter 11) trained for 1,500 steps with
 * each optimiser, each at a learning rate tuned for it. One trainer runs the selected optimiser;
 * finished runs are kept for comparison.
 */
import { GptTrainer, DEFAULT_TRAIN, type TrainConfig } from '$lib/train/gpt.svelte';

export type OptName = 'sgd' | 'adam' | 'adamw' | 'muon';

const BASE: TrainConfig = { ...DEFAULT_TRAIN, steps: 1500, evalEvery: 250 };

export const OPTIMISERS: Record<OptName, { label: string; cfg: Partial<TrainConfig>; reference: number }> = {
  sgd: { label: 'SGD + momentum', cfg: { optimiser: 'sgd', lr: 0.3 }, reference: 2.7 },
  adam: { label: 'Adam', cfg: { optimiser: 'adam', lr: 3e-3 }, reference: 2.35 },
  adamw: { label: 'AdamW', cfg: { optimiser: 'adamw', lr: 3e-3 }, reference: 2.36 },
  muon: { label: 'Muon + AdamW', cfg: { optimiser: 'muon', lr: 3e-3, muonLr: 0.02 }, reference: 2.23 },
};

class Comparison {
  choice = $state<OptName>('adamw');
  runs = $state.raw<Partial<Record<OptName, { step: number; val: number }[]>>>({});
  readonly trainer = new GptTrainer({ ...BASE, ...OPTIMISERS.adamw.cfg });

  private save(): void {
    if (this.trainer.step > 0) this.runs = { ...this.runs, [this.choice]: this.trainer.history.map((h) => ({ step: h.step, val: h.val })) };
  }

  async select(o: OptName): Promise<void> {
    this.save();
    this.choice = o;
    await this.trainer.configure({ ...BASE, optimiser: 'adamw', muonLr: undefined, ...OPTIMISERS[o].cfg });
  }

  curve(o: OptName): { step: number; val: number }[] | undefined {
    return o === this.choice && this.trainer.step > 0 ? this.trainer.history : this.runs[o];
  }
}

export const comparison = new Comparison();
