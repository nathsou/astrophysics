/**
 * The chapter's ablation: the same small model with parts switched on one at a time. One trainer
 * runs whichever variant is selected; finished (or paused) runs are kept for comparison.
 */
import { GptTrainer, DEFAULT_TRAIN, type TrainConfig } from '$lib/train/gpt.svelte';

export type Variant = 'attention' | 'mlp' | 'full' | 'deep';

export const VARIANTS: Record<Variant, { label: string; model: Partial<TrainConfig['model']>; reference: number }> = {
  attention: { label: 'Attention only', model: { layers: 2, mlp: false, norm: false }, reference: 2.98 },
  mlp: { label: '+ MLP', model: { layers: 2, mlp: true, norm: false }, reference: 2.51 },
  full: { label: '+ LayerNorm (Transformer)', model: { layers: 2, mlp: true, norm: true }, reference: 2.22 },
  deep: { label: '4 layers', model: { layers: 4, mlp: true, norm: true }, reference: 2.19 },
};

class Ablation {
  variant = $state<Variant>('full');
  runs = $state.raw<Partial<Record<Variant, { step: number; val: number }[]>>>({});
  readonly trainer = new GptTrainer({ ...DEFAULT_TRAIN, model: { ...DEFAULT_TRAIN.model, ...VARIANTS.full.model } });

  /** Keep the current run's curve before switching away from it. */
  private save(): void {
    if (this.trainer.step > 0) this.runs = { ...this.runs, [this.variant]: this.trainer.history.map((h) => ({ step: h.step, val: h.val })) };
  }

  async select(v: Variant): Promise<void> {
    this.save();
    this.variant = v;
    await this.trainer.configure({ model: { ...DEFAULT_TRAIN.model, mlp: true, norm: true, ...VARIANTS[v].model } });
  }

  /** The curve to show for a variant: live for the current one, saved otherwise. */
  curve(v: Variant): { step: number; val: number }[] | undefined {
    return v === this.variant && this.trainer.step > 0 ? this.trainer.history : this.runs[v];
  }
}

export const ablation = new Ablation();
