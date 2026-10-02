---
number: 29
title: Epilogue
summary: From 30 million parameters to the frontier. What we built, what changes with scale and what does not, what this book left out, and where to go next.
duration: About 30 minutes
prerequisites: [what-is-a-language-model]
builds:
  - A sense of scale
---

The book began with counting characters. Chapter 1 measured the entropy of English letters; Chapter 2 predicted the next character from the last few, and measured how surprised the prediction was. Everything since has been a better answer to that same question — what comes next, and how sure are we? — and a better way of paying for the answer.

## What we built

In **Part I** text became numbers: bytes, characters, and the tokens of byte-pair encoding, with cross-entropy as the measure of a model. **Part II** built the machinery of learning from nothing — tensors, gradient descent, automatic differentiation, a neural language model after Bengio and colleagues :cite[bengio2003], and GPU kernels to run it. **Part III** met sequences: recurrent networks that compress the past into a state, and attention, which looks the past up instead, assembled into the Transformer :cite[vaswani2017]. **Part IV** trained a real one. CourseGPT has 8 layers, 29.6 million parameters and a vocabulary of 8,192 tokens; it read 1.05 billion tokens of children’s stories in about two hours on a consumer GPU, reaching 1.647 bits per token, and then ran in your browser on kernels you wrote, with a KV cache, 8-bit weights and speculative decoding.

**Part V** took the ideas behind today’s large models and tested each one at our scale. Scaling laws predicted our models’ loss from their size and data, and missed where our small experiments were noisy. Llama’s architectural changes each helped a little or not at all — except rotary positions. Mixtures of experts bought a clear gain for the same compute per token. Fine-tuning taught CourseGPT an instruction format, and DPO, from nothing but pairs of better and worse stories, made it follow the instructions five times as often — at a measurable cost in fluency. A scratchpad taught a tiny model to add; sampling more answers and reinforcement learning with a verifiable reward mostly sharpened what it already knew; and a calculator let another add numbers longer than any it had seen. We evaluated our models with error bars and watched a leaked test set inflate a score; looked inside CourseGPT with lenses, probes and a sparse autoencoder, and found an induction head whose findings it ignores; and planted a backdoor in it with 160 poisoned examples — one that ordinary training then mostly washed out.

## What changes with scale

::scale-ladder

:::question
**Estimate before running.** Training time in days is approximately 6 × parameters × tokens ÷ (peak FLOPs per second × utilisation × 86,400). In the calculator, halve utilisation and predict the change: the run takes twice as long. Treat the result as a budget estimate, not a promise of measured throughput.
:::

Frontier models are 10,000 times larger than CourseGPT and train on 10,000 times more tokens: roughly 10⁸ times the compute. Almost everything in this book carries across that gap unchanged. The loss is the same cross-entropy, the architecture is the same stack of attention and MLP blocks, with Chapter 18’s refinements, and the optimisers, the schedules, the KV cache and the sampling methods are the ones we wrote. What changes is what the models can do. At our scale, a model learns grammar, names that persist through a story, and simple cause and effect; at 10⁸ times the compute, the same objective yields models that write working programs, explain their reasoning, and pass professional examinations. That is the observation that has driven the field since GPT-2 :cite[radford2019], and the reason Sutton’s “bitter lesson” — that general methods which scale with compute win over hand-built knowledge — has been quoted so often :cite[sutton2019].

Some things do change qualitatively. **Data** becomes the central problem: finding, filtering and deduplicating tens of trillions of tokens of text worth learning from, and deciding their mixture :cite[penedo2024]. **Engineering** becomes most of the work: Chapter 27’s parallelism, and the reliability of thousands of GPUs. **Post-training** grows from a small fine-tuning step into a large programme of its own — instruction data, preferences, and reinforcement learning on problems with checkable answers (Chapters 20–22). And **evaluation** and **safety** become harder, because the models are more capable than the tests (Chapters 25 and 28).

## What this book left out

A book has to stop somewhere. Some of what we did not cover:

- **Other architectures.** State-space models such as Mamba :cite[gu2023mamba] replace attention with a recurrence that can be computed in parallel during training, returning, in a new form, to Chapter 9’s compressed state; hybrids mix them with attention layers. Diffusion language models generate all positions at once and refine them.
- **Long context.** Extending a model from thousands to millions of tokens of context: position interpolation, efficient attention and the training data needed to use long context well.
- **Distillation.** Training a small model to imitate a large one’s full output distribution rather than one-hot targets :cite[hinton2015], which is how many of the best small models are made.
- **Multilinguality and code**, which change tokenisers, data and evaluation; and the societal questions — copyright, labour, energy, and the concentration of power — that no technical chapter can settle.

## Open questions

Much of what makes these models work is understood only empirically. Why does next-token prediction on text produce such general abilities? How far will scaling data, parameters and reasoning at test time continue to pay off, and what happens when the supply of human text runs out? Can we understand what a large model is doing well enough to trust it with consequential decisions — or verify that it is doing what we intended? Can the learning be made far more efficient: children learn language from fewer than a hundred million words, a tenth of what CourseGPT read, and end up knowing far more?

These are research questions, open to anyone who can train and measure a model. You can.

## Where to go next

- **Build larger.** The labs in this book run on one GPU. Train a model on a general web corpus such as FineWeb-Edu :cite[penedo2024] at the Chinchilla-optimal size for your budget (Chapter 17), and evaluate it with Chapter 25’s methods.
- **Read the papers.** Appendix J lists every paper cited in the book, with a timeline. The technical reports of open models — Llama, DeepSeek, OLMo, Qwen — describe the whole pipeline in detail.
- **Take part.** Open-source projects in training (nanoGPT and its descendants), inference (llama.cpp, vLLM) and interpretability welcome contributions, and many of this book’s challenges are small research projects.

Thank you for reading, and for building. The best way to understand a language model is still the one this book took: make one.

## Check your understanding

```quiz
q: "Roughly how much more training compute did Llama 3.1 405B use than CourseGPT?"
options:
  - text: "About 10⁸ times: 6 × 405 × 10⁹ × 15.6 × 10¹² ≈ 3.8 × 10²⁵ FLOPs, against about 1.9 × 10¹⁷."
    correct: true
    why: 6ND for each model; the ratio is about 2 × 10⁸.
  - text: About 10,000 times, like the ratio of parameters.
    why: The number of tokens grew by a similar factor, so compute grew by the product.
  - text: About 100 times.
    why: That would be a model of roughly CourseGPT's size trained on a hundred times more data.
```
