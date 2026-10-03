/**
 * Microphone capture for the tone mirror. Collects mono samples while recording and reports
 * live pitch every chunk. Stops on its own after a pause or a maximum length.
 */
import { track, yin } from './pitch';

export interface Recording {
  samples: Float32Array;
  sampleRate: number;
  /** Pitch per 10 ms hop (Hz or null). */
  pitch: (number | null)[];
}

export class Recorder {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: ScriptProcessorNode | null = null;
  private chunks: Float32Array[] = [];
  private resolve: ((r: Recording) => void) | null = null;
  private heardVoice = false;
  private quietSince = 0;
  private started = 0;
  private generation = 0;

  constructor(
    private onLive: (hz: number | null, level: number) => void,
    private maxSeconds = 3,
  ) {}

  get active(): boolean {
    return this.node !== null;
  }

  async start(): Promise<Recording> {
    const id = ++this.generation;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    if (id !== this.generation) {
      stream.getTracks().forEach(t => t.stop());
      throw new DOMException('Recording cancelled', 'AbortError');
    }
    this.stream = stream;
    this.ctx = new AudioContext();
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.node = this.ctx.createScriptProcessor(1024, 1, 1);
    this.chunks = [];
    this.heardVoice = false;
    this.started = performance.now();
    this.quietSince = 0;
    const sr = this.ctx.sampleRate;
    const window = Math.round(sr * 0.04);
    let tail = new Float32Array(0);
    this.node.onaudioprocess = (e) => {
      const data = new Float32Array(e.inputBuffer.getChannelData(0));
      this.chunks.push(data);
      const joined = new Float32Array(tail.length + data.length);
      joined.set(tail);
      joined.set(data, tail.length);
      tail = joined.slice(-window);
      let energy = 0;
      for (const x of data) energy += x * x;
      const level = Math.sqrt(energy / data.length);
      const hz = joined.length >= window ? yin(joined.subarray(joined.length - window), { sampleRate: sr, minRms: 0.015 }) : null;
      this.onLive(hz, level);
      const now = performance.now();
      if (hz) {
        this.heardVoice = true;
        this.quietSince = 0;
      } else if (this.heardVoice) {
        this.quietSince ||= now;
        if (now - this.quietSince > 450) this.stop();
      }
      if (now - this.started > this.maxSeconds * 1000) this.stop();
    };
    src.connect(this.node);
    this.node.connect(this.ctx.destination);
    return new Promise((r) => (this.resolve = r));
  }

  stop(): void {
    this.generation++;
    if (!this.node || !this.ctx) return;
    const sr = this.ctx.sampleRate;
    this.node.disconnect();
    this.node.onaudioprocess = null;
    this.node = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx.close();
    this.ctx = null;
    const total = this.chunks.reduce((n, c) => n + c.length, 0);
    const samples = new Float32Array(total);
    let o = 0;
    for (const c of this.chunks) {
      samples.set(c, o);
      o += c.length;
    }
    // Downsample to ~16 kHz for a fast, accurate offline pitch track.
    const factor = Math.max(1, Math.floor(sr / 16000));
    const down = new Float32Array(Math.floor(total / factor));
    for (let i = 0; i < down.length; i++) down[i] = samples[i * factor]!;
    const rate = sr / factor;
    const pitch = track(down, { sampleRate: rate, hop: Math.round(rate * 0.01), minRms: 0.012 });
    this.resolve?.({ samples, sampleRate: sr, pitch });
    this.resolve = null;
  }
}

/** Play a recording back. */
export async function playRecording(r: Recording): Promise<void> {
  const ctx = new AudioContext();
  const buf = ctx.createBuffer(1, r.samples.length, r.sampleRate);
  buf.copyToChannel(new Float32Array(r.samples), 0);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  await new Promise<void>((res) => {
    src.onended = () => res();
    src.start();
  });
  void ctx.close();
}
