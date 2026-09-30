/**
 * A handful of square-wave oscillators for "hear the octaves". Created only when the reader presses a button
 * (browsers refuse sound before a gesture), quiet, and stopped when the figure leaves the screen.
 */
export class Tones {
  private ctx: AudioContext | undefined;
  private osc: OscillatorNode[] = [];
  private gains: GainNode[] = [];
  private master: GainNode | undefined;

  /** True where the browser can make sound. */
  static supported(): boolean {
    return typeof window !== 'undefined' && (typeof AudioContext !== 'undefined' || 'webkitAudioContext' in window);
  }

  get running(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /** Start the oscillators at these frequencies (Hz), all silent until `enable` is called. */
  async start(freqs: number[]): Promise<void> {
    if (!Tones.supported()) return;
    this.stop();
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor();
    await ctx.resume();
    const master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    this.ctx = ctx;
    this.master = master;
    freqs.forEach((f) => {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0;
      o.connect(g);
      g.connect(master);
      o.start();
      this.osc.push(o);
      this.gains.push(g);
    });
  }

  /** Turn one voice on or off (a short ramp, so there is no click). */
  enable(i: number, on: boolean): void {
    const g = this.gains[i];
    if (!g || !this.ctx) return;
    g.gain.cancelScheduledValues(this.ctx.currentTime);
    g.gain.setTargetAtTime(on ? 0.06 : 0, this.ctx.currentTime, 0.01);
  }

  stop(): void {
    for (const o of this.osc) {
      try {
        o.stop();
      } catch {
        /* already stopped */
      }
    }
    this.osc = [];
    this.gains = [];
    void this.ctx?.close();
    this.ctx = undefined;
    this.master = undefined;
  }
}
