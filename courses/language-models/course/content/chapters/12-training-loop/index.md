---
number: 12
title: The training loop
summary: Everything around the model that turns it into a trained one — how batches are drawn, how big they are, how the learning rate should move, how to watch a run and trust its numbers, how to save and resume it, and how fast it goes. Then we train char-GPT in the browser and move checkpoints between the browser and PyTorch.
duration: About 2½ hours, plus the training run
prerequisites: [transformer, probability]
builds:
  - Training loop with accumulation, schedule, clipping and evaluation
  - Throughput and model FLOPs utilisation
  - Checkpoints (IndexedDB) and safetensors export/import
  - char-GPT, trained in the browser
  - lmc train (PyTorch) — the loop CourseGPT uses
---

Every trainer in this course so far has had the same half-hidden loop: draw a batch, compute the loss, back-propagate, step the optimiser, repeat. The model got the attention; the loop did not. But most practical training failures are loop failures, not model failures. The learning rate is too high at the start, the evaluation is too noisy to trust, the run crashes and nothing was saved, or the data is being read in an order that quietly repeats itself. Andrej Karpathy’s *Recipe for Training Neural Networks* is the classic list of these hard-won lessons :cite[karpathy2019recipe].

This chapter takes the loop apart. Each piece gets an explanation, a measurement and, where it helps, an exercise. The pieces go back together as the course’s training loop, which exists in two forms: the browser’s `GptTrainer`, which drives the dashboard below, and the PyTorch `lmc train`, which will train CourseGPT in Chapter 14. With them we train **char-GPT**, the best character-level model of this course so far.

## The loop, in full

```ts
for (let step = 0; step < steps; step++) {
  optimiser.lr = schedule(step);                    // 1. how big a step to take now
  for (let micro = 0; micro < accum; micro++) {     // 2. gradient accumulation
    const { x, y } = sampleBatch(train);            // 3. which data
    model.loss(x, y).scale(1 / accum).backward();   //    forward and backward
  }
  const norm = clipGradNorm(params, 1.0);           // 4. guard against spikes, and record the norm
  optimiser.step();
  optimiser.zeroGrad();
  if (step % evalEvery === 0) log(evaluate(val));   // 5. measure honestly
  if (step % saveEvery === 0) save(checkpoint);     // 6. be able to stop and resume
}
```

The rest of the chapter goes through the numbered comments in turn.

## Which data: windows, epochs and batches

A language model’s training examples are **windows**: $T + 1$ consecutive tokens, giving $T$ inputs and the $T$ targets shifted by one. There are two common ways to choose them. **Random windows** start anywhere in the training text, independently for each batch. This is simple and what our trainers do, but some text is seen twice before other text is seen once. **Epochs** cut the text into non-overlapping windows and visit each exactly once per pass, in a fresh random order. Large training runs use the second approach, over pre-shuffled token files, and usually see most of their data only once.

::exercise{id="epoch-sampler"}

How much data does a run see? char-GPT’s run is 3,000 steps of 32 windows of 256 characters, which is 25 million characters. That is about **25 passes** over TinyShakespeare’s million training characters, so we should expect some overfitting. The dashboard’s “Training data” option makes the effect vivid: train on only the first 10,000 characters and watch the two curves separate within a few hundred steps.

**Batch size** is a trade-off (Appendix C). The gradient from a batch of $B$ windows is an average, so its noise falls like $1/\sqrt B$. Doubling the batch halves the variance of each step but costs twice as much. Past a **critical batch size**, which grows as training progresses and the loss falls, extra batch buys almost nothing :cite[mccandlish2018]. When the batch you want does not fit in memory, **gradient accumulation** processes it as several micro-batches: back-propagate each with its loss divided by the number of micro-batches, let the gradients add up, and step once. The result is exactly the large-batch gradient.

::exercise{id="grad-accumulation"}

## How big a step: learning-rate schedules

The learning rate is the most important hyperparameter, and a single fixed value is rarely best. Almost every modern run uses a **schedule**:

- **Warm-up.** Start near zero and rise linearly to the peak over the first few hundred steps. At the start, the weights are random, gradients are large and inconsistent, and Adam’s running estimates of gradient size (Chapter 13) are still unreliable, so a full-size step can throw the model somewhere it never recovers from. Warm-up was essential for post-norm Transformers, and it is still cheap insurance :cite[goyal2017].
- **Decay.** Later, lower the rate so the optimiser can settle into a minimum rather than bounce around it. Late in training, gradient noise sets a floor on the loss, and shrinking the step lowers that floor. The **cosine** schedule :cite[loshchilov2017] decays smoothly to a fraction of the peak and is the most common choice.
- **Warm-up–stable–decay** (WSD) holds the peak for most of the run and decays quickly at the end :cite[hu2024minicpm,hagele2024]. Its attraction is flexibility: decays can be branched off one long stable run at any point, giving a finished model at several budgets from one training run.

::schedule-designer

::exercise{id="lr-schedule"}

## Clipping and monitoring

**Gradient clipping** rescales the whole gradient whenever its norm exceeds a threshold (Chapter 9). In a healthy Transformer run the norm usually sits below the threshold, and clipping acts only on rare spikes. Such spikes typically come from an unusual batch or a numerical hiccup, and one unclipped spike can undo hours of training. The norm is also one of the best **diagnostics** you have. In the dashboard it starts high, falls quickly, and then drifts slowly. A norm that climbs steadily, or a loss that jumps and doesn’t come back, signals trouble — usually a learning rate that is too high.

Other things worth watching, which we met in Chapter 7: the ratio of each update to the size of the weights (about $10^{-3}$ per step is healthy) and the statistics of activations (saturation, dead units). Large runs log dozens of such quantities at every step.

## Measuring honestly

The training loss is the moving average of the losses on the batches just trained on, so it is optimistic and noisy. The **validation loss** is the model’s loss on text it has never trained on, and it is the number that matters. Two questions remain: how often to measure it, and how much validation text is enough.

The per-token losses of a language model are wildly variable. Most characters are easy, and a few are nearly impossible to predict. The standard error of a loss estimated from $K$ tokens is $\sigma / \sqrt K$ (Appendix C), and $\sigma$ is large:

::eval-noise

For char-GPT, $\sigma$ is about 2.4 bits per character, so an estimate from 10,000 tokens has a standard error of 0.024 bits: uncertain in the second decimal place. Our trainers evaluate on the entire validation split — 111,000 characters — so the numbers quoted in this course are accurate to about ±0.01 bits. Differences between models smaller than that are noise. Chapter 25 returns to this for benchmarks, where the stakes and the temptations are higher.

**Overfitting** shows up as the two curves parting: training loss keeps falling while validation loss flattens and then rises. The remedies are the ones you have met: stop at the best validation checkpoint (**early stopping**), **regularise** (dropout, which char-GPT uses at 0.1, and weight decay, Chapter 13), or — best of all — **more data**, which is what Chapter 14 does.

## How fast: throughput and utilisation

Two numbers describe a training run’s speed. **Throughput** is tokens processed per second. **Model FLOPs utilisation** (MFU) :cite[chowdhery2022] is the arithmetic the model needs per token (about $6N$ plus the attention term, Chapter 11) multiplied by the throughput, as a fraction of what the hardware could do. Well-tuned large runs on data-centre GPUs achieve 40–60% MFU.

The dashboard reports utilisation against the fastest matmul our backend achieves on your GPU (Chapter 8), rather than the vendor’s peak figure. On an M4 Pro, char-GPT runs at about 53,000 tokens per second, or **about 37%** of that yardstick; the smaller quick model manages less. Those figures are honest, and modest. Our models are tiny, so each kernel has too little work to fill the GPU. A training step is hundreds of separate kernels, many of them memory-bound (LayerNorm, GELU, softmax, the residual additions). And our matmul is a third as fast as the vendor’s. Chapter 14 does better with PyTorch on the RTX 4060 Ti, using larger models, fused kernels and bfloat16.

## Stopping and resuming: checkpoints

A **checkpoint** must contain everything needed to continue as if nothing had happened:

- the **weights**;
- the **optimiser state** — Adam’s two moment estimates per parameter, which are twice the size of the weights (Chapter 13) — and its step count;
- the **step number**, so that the schedule continues from the right place;
- the **random-number state** and data position, if the continuation should be exactly reproducible;
- the **configuration** and the training history.

The dashboard saves checkpoints in the browser’s IndexedDB and can restore any of them. Its **Download** button writes the weights as a **safetensors** file, and its **Load** button reads one back. Safetensors is a deliberately simple format: an 8-byte length, a JSON header listing each tensor’s name, type, shape and byte range, then the raw bytes. PyTorch’s default `torch.save` uses Python’s *pickle*, which can execute arbitrary code when loaded, so loading a stranger’s pickle is a security risk. Loading safetensors is not.

::exercise{id="safetensors"}

The browser and PyTorch models use the same parameter names (Chapter 11), so a checkpoint can travel either way. Download char-GPT from the dashboard and load it in PyTorch with `safetensors.torch.load_file`. Or train in PyTorch with `lmc train --export` and load the file into the dashboard.

## Training char-GPT

Everything together. Choose **char-GPT**: 4 layers, width 192, 6 heads, context 256, dropout 0.1 and 3,000 steps — about 8 minutes on an M4 Pro. Press *Train*, save a checkpoint now and then, and sample along the way to watch the text improve:

::training-dashboard

On an M4 Pro this takes about 8 minutes and reaches **2.16 bits per character** on the validation split. PyTorch trains the identical model to 2.14 bits (lab below), and Chapter 11’s big 10.7-million-parameter model managed only 2.15 at its best before it overfitted — with six times fewer parameters, char-GPT does as well. The curves show the gap between training (about 1.85) and validation opening steadily, which is the same data limit as before.

The samples have the right shape — speaker names in capitals, verse lines, archaic words and punctuation — and phrases that are almost Shakespearean. The sense wanders, because a character-level model with 256 characters of context and a million characters of training text cannot learn much meaning. Chapter 14 gives CourseGPT a tokeniser, a far larger corpus and a GPU run of hours rather than minutes.

:::breakit
- Set the training data to 10,000 characters and train the quick model. At what step does validation loss start rising? Sample from the model: what is it doing?
- In the PyTorch lab, set `warmup=0` and `lr=1e-2` in the `chargpt` preset. What happens in the first hundred steps?
- Evaluate on only 500 validation tokens (edit `evaluate()` in `lmcourse/train.py`) and compare two runs with different seeds. Is the “better” one really better?
:::

## Lab: `lmc train`

```bash
cd training
uv run lmc train --preset chargpt              # char-GPT (a few minutes on an M4 Pro, less on the RTX 4060 Ti)
uv run lmc train --preset chargpt --resume     # continue after an interruption
uv run lmc train --preset chargpt --export     # runs/chargpt/model.safetensors — load it in the dashboard
uv run lmc train --preset chargpt-big          # Chapter 11's 6 × 384 model, with checkpoints
```

`lmcourse/train.py` is the loop from this chapter in PyTorch, about 150 lines long. It adds one thing the browser cannot yet do: **bfloat16 autocast** on NVIDIA GPUs, which runs the matrix multiplications in 16-bit precision on tensor cores. Chapter 14 explains it and uses the same script, with a different dataset and a tokeniser, to train CourseGPT. It writes a JSON-lines log (`runs/<name>/log.jsonl`) with the loss, learning rate, gradient norm, throughput and TFLOP/s every 100 steps.

:::exercises
1. **Batch size and learning rate.** Train the quick model with batch 8, 32 and 128 for the same number of *tokens*, scaling the learning rate with the batch. Which is fastest in wall-clock time? Which reaches the lowest loss?
2. **WSD.** Implement the warm-up–stable–decay schedule in `lmcourse/train.py` and compare it with cosine at the same budget. Then branch two decays from one stable run, at 50% and 100% of the budget.
3. **Early stopping.** Add a rule to the browser trainer that keeps the checkpoint with the best validation loss, and stops when it hasn’t improved for three evaluations. Try it on the 100,000-character subset.
4. **Throughput.** Measure tokens per second for the quick model at batch sizes 8 to 128 in the dashboard. Where does throughput stop improving, and why?
:::

:::challenge
1. **Exact resumption.** Make browser checkpoints fully reproducible: save the data sampler’s state and the dropout seed so that a resumed run matches an uninterrupted one bit for bit. Test it.
2. **Mixed precision in the browser.** Where WebGPU offers `shader-f16`, store activations in half precision in the forward pass, keep a float32 master copy of the weights, and add loss scaling. How much faster is a step? How much worse the loss?
3. **Data loading off the main thread.** Move batch construction into a web worker with a queue of ready batches, so the GPU never waits for JavaScript. Measure the change in utilisation.
:::

## Check your understanding

```quiz
q: "You want a batch of 256 windows but only 64 fit in memory. How do you get exactly the same gradient?"
options:
  - text: "Run 4 micro-batches of 64, back-propagating each with its loss divided by 4, and step once after all four."
    correct: true
    why: Gradients accumulate by addition; dividing by 4 turns the sum of four means into the mean over 256.
  - text: Run 4 steps of 64 with a learning rate 4 times smaller.
    why: That takes four different steps, each from a different point; it is not the same as one step with the averaged gradient.
  - text: Use a batch of 64 with a learning rate 4 times larger.
    why: The gradient would be four times noisier; the expected step is similar, but it is not the same gradient.
```

```quiz
q: "Why warm the learning rate up at the start of training?"
options:
  - text: "Early gradients are large and inconsistent, and Adam's statistics are unreliable, so full-size steps can destabilise the untrained model."
    correct: true
    why: A few hundred steps of warm-up are cheap insurance, and were essential for post-norm Transformers.
  - text: Because the loss is lowest at the start.
    why: It is highest at the start.
  - text: To save computation.
    why: Warm-up costs the same per step.
```

```quiz
q: "Per-token losses have a standard deviation of 2 bits. Roughly how many validation tokens do you need for a standard error of 0.01 bits?"
options:
  - text: "About 40,000: σ/√K = 0.01 gives K = (2/0.01)²."
    correct: true
    why: Standard error falls only as the square root of the sample size.
  - text: About 200.
    why: That gives a standard error of about 0.14 bits.
  - text: About 4 million.
    why: That would give 0.001 bits.
```

## Further reading

- Andrej Karpathy, *A Recipe for Training Neural Networks* :cite[karpathy2019recipe].
- Sam McCandlish and colleagues, *An Empirical Model of Large-Batch Training* :cite[mccandlish2018]. The critical batch size.
- Alexander Hägele and colleagues, *Scaling Laws and Compute-Optimal Training Beyond Fixed Training Durations* :cite[hagele2024]. Warm-up–stable–decay, analysed.
- The PaLM paper’s appendix on model FLOPs utilisation :cite[chowdhery2022].
