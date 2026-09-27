---
number: 9
title: Recurrent networks
summary: Networks with memory. A recurrent network applies the same cell at every position and carries a state forward, so its context has no fixed limit. We train one with backpropagation through time, see why its gradients vanish, fix that with the LSTM, and finally beat Kneser–Ney — then look inside at what the hidden units learned.
duration: About 3 hours, including the lab
prerequisites: [mlp-language-model, gpu-compute, automatic-differentiation]
builds:
  - Character-level RNN and LSTM
  - Backpropagation through time (truncated)
  - Fused LSTM kernel
  - Gradient clipping
  - AdamW on the GPU (explained in Chapter 13)
---

Chapter 7’s MLP left two problems unsolved. It reads a fixed window of $n$ characters, so anything earlier is invisible. And it has separate weights for every position in the window, so a pattern learned at one offset must be learned again at every other. Chapter 8 then showed that more compute alone does not fix this: a ten-times-bigger MLP overfits and still trails Kneser–Ney.

A **recurrent neural network** (RNN) solves both problems with one idea. Read the text one character at a time, keep a running **state** that summarises everything read so far, and update it with the *same* function at every step. The weights are shared across positions, so whatever the network learns at one position applies at all of them. And the state can, in principle, carry information from arbitrarily far back.

This chapter builds recurrent networks on the GPU backend from Chapter 8. It trains them in your browser, and ends with the first model in this course to beat Kneser–Ney’s 2.22 bits per character. Recurrent networks were the dominant language models from about 2010 to 2017, and their limitations are the best motivation for attention, the subject of Chapter 10.

## A network with a loop

The simplest recurrent network, due to Jeffrey Elman :cite[elman1990], updates a hidden state $\mathbf h_t \in \mathbb R^H$ from the previous state and the current input, and predicts the next character from the state:

:::equation{#rnn caption="The Elman recurrent network: the same weights at every step."}
$$
\begin{aligned}
\mathbf h_t &= \tanh\big(\, \term{ex}{\mathbf e_{x_t}}\, W + \mathbf b + \term{hprev}{\mathbf h_{t-1}}\, \term{U}{U} \,\big) \\
P(x_{t+1} \mid x_{\le t}) &= \operatorname{softmax}\big(\mathbf h_t\, W_y + \mathbf b_y\big)
\end{aligned}
$$
:::

```terms
ex:
  label: "$\\mathbf e_{x_t}$ — the embedding of the current character"
  what: A learned vector for character $x_t$, exactly as in Chapter 7.
hprev:
  label: "$\\mathbf h_{t-1}$ — the previous state"
  what: A vector of $H$ numbers summarising everything the network has read before step $t$. It starts at zero.
  why: This is the network’s only memory. Anything it needs to remember must be written into this vector and survive every later update.
U:
  label: "$U$ — the recurrent weights"
  what: An $H \\times H$ matrix, applied at every step, that decides how the old state feeds into the new one.
  why: Because the same $U$ is used at every step, what the network learns about sequences applies at every position — the weight sharing the MLP lacked.
  effect: Its scale controls whether information (and gradient) grows or fades as it passes through many steps; see the gradient widget below.
```

Compare this with the MLP. Its parameters no longer depend on the context length: the same $W$, $U$ and $W_y$ serve for the tenth character and the ten-thousandth. And each step costs the same, however long the text so far. The price is that the computation is **sequential**: $\mathbf h_t$ cannot be computed before $\mathbf h_{t-1}$. Keep that in mind; it is the reason Transformers replaced recurrent networks (Chapter 10).

::rnn-unroll

To train the network we **unroll** it: write out the computation for a sequence of length $T$ as an ordinary feed-forward graph with $T$ copies of the cell, all sharing the same weights. Backpropagation on the unrolled graph is called **backpropagation through time** (BPTT) :cite[werbos1990,rumelhart1986]. It needs nothing new. Chapter 6’s autograd already accumulates the gradient of a weight used several times, so the shared weights simply receive the sum of the gradients from every step.

::exercise{id="rnn-forward"}

## Truncated BPTT and stateful training

Backpropagating through a whole play is impossible: memory grows with the number of steps unrolled. The standard compromise is **truncated BPTT**. Cut the text into chunks of $T$ characters, 64 in our trainer, and backpropagate only within a chunk. The state is still carried *forward* from one chunk to the next, so the network sees an unbroken text. But the carried state is **detached** from the graph, so gradients stop at chunk boundaries.

To keep the GPU busy, the batch is $B$ parallel **streams**. The training text is split into $B$ equal parts, and batch row $b$ always continues where it left off in part $b$. Each step processes the next $T$ characters of every stream, starting from the states the previous step left behind. Evaluation works the same way over the whole validation split, so the model is always judged with a warm state, as it would be used.

## Vanishing and exploding gradients

Truncation limits how far back gradients can go, but a deeper problem limits it long before that. By the chain rule, the gradient flowing from step $T$ back to step $t$ passes through every step in between, and each step multiplies it by that step’s Jacobian:

:::equation{#bptt caption="Gradients through time are products of per-step Jacobians."}
$$
\frac{\partial \mathbf h_T}{\partial \mathbf h_t} \;=\; \prod_{s = t+1}^{T} \frac{\partial \mathbf h_s}{\partial \mathbf h_{s-1}} \;=\; \prod_{s=t+1}^{T} U^\top \operatorname{diag}\!\big(\term{tp}{1 - \mathbf h_s^2}\big)
$$
:::

```terms
tp:
  label: "$1 - \\mathbf h_s^2$ — the slope of tanh at each unit"
  what: The derivative of tanh, evaluated at step $s$. It is 1 when a unit is near zero and close to 0 when the unit is saturated near ±1.
  why: Every saturated unit shrinks the gradient passing through it, at every step.
```

A product of $T - t$ matrices behaves like a power. Roughly, if the recurrent Jacobians shrink vectors, the gradient decays exponentially with distance ($\rho^{T-t}$ for a spectral radius $\rho < 1$). If they stretch vectors, it grows exponentially. Sepp Hochreiter identified the problem in his 1991 thesis :cite[hochreiter1991], and Bengio, Simard and Frasconi analysed it in 1994 :cite[bengio1994]. The consequence is that a vanilla RNN learns short-range patterns easily and long-range ones barely at all: the training signal from 50 steps back is drowned out by that from the last few.

::gradient-flow

::exercise{id="gradient-reach"}

**Exploding** gradients have a cheap fix: **gradient clipping** :cite[pascanu2013]. If the norm of the whole gradient exceeds a threshold, rescale it to that threshold before the update, keeping its direction. Our trainer clips at 1. The library does it without reading the norm back to the CPU: one kernel computes the norm, and another scales every gradient by $\min(1, \text{max} / \lVert \mathbf g \rVert)$. **Vanishing** gradients need a different architecture.

## Long short-term memory

The **LSTM** of Hochreiter and Schmidhuber :cite[hochreiter1997], with the forget gate added by Gers, Schmidhuber and Cummins :cite[gers2000], adds a second state, the **cell** $\mathbf c_t$. The cell is updated *additively*, and **gates** — learned, per-unit numbers between 0 and 1 — decide what to write, what to keep and what to show:

:::equation{#lstm caption="The LSTM cell (with forget gate). σ is the logistic sigmoid; ⊙ multiplies element-wise."}
$$
\begin{aligned}
\big[\,\mathbf z_i \,;\, \mathbf z_f \,;\, \mathbf z_o \,;\, \mathbf z_g\,\big] &= \mathbf e_{x_t} W + \mathbf b + \mathbf h_{t-1} U \\
\term{ig}{\mathbf i_t} = \sigma(\mathbf z_i), \quad \term{fg}{\mathbf f_t} = \sigma(\mathbf z_f), \quad \term{og}{\mathbf o_t} &= \sigma(\mathbf z_o), \quad \mathbf g_t = \tanh(\mathbf z_g) \\
\term{cc}{\mathbf c_t} &= \mathbf f_t \odot \mathbf c_{t-1} + \mathbf i_t \odot \mathbf g_t \\
\mathbf h_t &= \mathbf o_t \odot \tanh(\mathbf c_t)
\end{aligned}
$$
:::

```terms
ig:
  label: "$\\mathbf i_t$ — the input gate"
  what: How much of the candidate $\\mathbf g_t$ to write into each cell unit at this step.
fg:
  label: "$\\mathbf f_t$ — the forget gate"
  what: How much of each cell unit’s old value to keep. 1 keeps it all, 0 erases it.
  why: When $\\mathbf f_t \\approx 1$, the cell’s gradient passes back through a step multiplied only by $\\mathbf f_t$ — no weight matrix, no squashing — so it can survive hundreds of steps.
  effect: Initialising its bias to +1 (so the gate starts mostly open) is a well-known trick that helps LSTMs learn long dependencies early.
og:
  label: "$\\mathbf o_t$ — the output gate"
  what: How much of each (squashed) cell unit to expose as the hidden state, which drives predictions and the next step’s gates.
cc:
  label: "$\\mathbf c_t$ — the cell state"
  what: The LSTM’s long-term memory. Updated by adding to it and scaling it, never by multiplying it with a weight matrix.
  why: The additive update is the whole trick. Hochreiter and Schmidhuber called it the constant error carousel.
```

Along the cell, $\partial \mathbf c_t / \partial \mathbf c_{t-1} = \operatorname{diag}(\mathbf f_t)$: the gradient is multiplied only by the forget gate. When the network learns to hold a gate near 1, information and gradient flow across many steps almost undiminished. The green curve in the gradient widget shows the effect. Christopher Olah’s illustrated explanation is the classic companion to these equations :cite[olah2015lstm].

The **gated recurrent unit** (GRU) of Cho and colleagues :cite[cho2014] is a simpler cousin, with two gates and no separate cell: $\mathbf h_t = (1 - \mathbf u_t) \odot \mathbf h_{t-1} + \mathbf u_t \odot \tilde{\mathbf h}_t$. It keeps the essential ingredient — an additive, gated path through time. Large comparisons found LSTMs and GRUs roughly equal, with the LSTM’s forget-gate bias doing much of the work :cite[jozefowicz2015].

::exercise{id="lstm-cell"}

:::note
**A fused LSTM kernel.** Written out with ordinary operations, one LSTM step is a dozen element-wise kernels: four activations, three products, two additions, a tanh and the slicing between them. Each reads and writes memory, and on the GPU each costs a dispatch. The library’s `lstmCell` (in `@lm/core/gpu`) does the whole step in one kernel, with one thread per (row, unit). Its backward pass is another single kernel, which *recomputes* the gates from the pre-activations instead of storing them. This is the fusion idea from Chapter 8, and exactly what NVIDIA’s cuDNN does for recurrent networks. The library’s tests check it against the unfused version, gradient by gradient.
:::

## Training a character-level RNN

Now train one. The trainer below runs on your GPU. Each step processes 64 streams of 64 characters, clips the gradient, and updates the weights with **Adam**, an adaptive optimiser that Chapter 13 derives. (Plain SGD also works, but with Adam these networks train several times faster, and Chapter 7 already used it in the lab.)

::rnn-trainer

With 256 hidden units and 2,000 steps, which take a minute or two, the vanilla RNN reaches about **2.32 bits per character**. It is well ahead of the MLP (2.43), with a third of the parameters, but not quite at Kneser–Ney. The LSTM reaches about **2.24**, level with Kneser–Ney. The PyTorch lab below gets the same numbers from `torch.nn.RNN` and `torch.nn.LSTM`, which is a useful check that our GPU backend is right. And with two layers of 512 units and longer training, the lab’s LSTM goes clearly below: **2.10 bits per character**. It is also clearly overfitting — its training loss ends near 1.5 bits — so at this size, the million characters of TinyShakespeare, not the architecture, are the limit.

| Model | Parameters | Validation bits/char |
|---|---|---|
| Kneser–Ney, n = 6 (Chapter 2) | — (counts) | 2.22 |
| MLP, h = 1024, GPU (Chapter 8) | 266 k | 2.43 |
| Vanilla RNN, H = 256, 2,000 steps (this page) | 164 k | ≈ 2.32 |
| LSTM, H = 256, 2,000 steps (this page) | 559 k | ≈ 2.24 |
| LSTM, 2 × 512, dropout 0.25, 10,000 steps (lab) | 4.3 M | ≈ 2.10 |

:::note
**A surprise from the implementation.** The first version of this trainer used a single table of $V \times G$ input weights (one row per character) instead of an embedding followed by a matrix, $\mathbf e_{x_t} W$. The two can represent exactly the same functions, since the product of the embedding table and $W$ *is* a $V \times G$ table. Yet the single table trained far worse: 2.62 bits against 2.23, in both our backend and PyTorch. Splitting a matrix into a product of two changes how gradient descent moves through the same space of functions, and here it helped a great deal. Arora, Cohen and Hazan analysed this effect, *implicit acceleration by overparameterisation* :cite[arora2018]. It is a reminder that in deep learning, how a model is parameterised matters as much as what it can represent.
:::

## What the network learned

The trained network’s hidden units are directly observable. Run it over some validation text and colour each character by one unit’s activation. Most units respond to a mixture of things, but some are strikingly interpretable. Karpathy, Johnson and Fei-Fei found LSTM cells that track the position in a line, whether the text is inside quotation marks, and the nesting depth of brackets in code :cite[karpathy2016]. Nobody designed those units. They emerged because tracking these things helps predict the next character.

::hidden-states

These are early glimpses of **interpretability**, the study of what trained networks compute internally, which Chapter 26 takes up properly with Transformers.

:::history{year=2010 title="Recurrent language models" people="Tomáš Mikolov; Ilya Sutskever; Alex Graves; Andrej Karpathy"}
Recurrent networks for language modelling date back to Elman’s 1990 experiments on tiny artificial grammars :cite[elman1990]. They became practical two decades later. In 2010, Tomáš Mikolov’s RNN language model beat heavily tuned n-gram models on speech-recognition benchmarks, especially when the two were combined :cite[mikolov2010]. In 2011, Sutskever, Martens and Hinton trained character-level networks on Wikipedia and generated surprisingly fluent text :cite[sutskever2011]. Alex Graves’s 2013 paper generated text and even handwriting with deep LSTMs :cite[graves2013].

In 2014, **sequence-to-sequence** models used one LSTM to read a sentence and another to write its translation, and in 2016 they became Google Translate’s production system :cite[sutskever2014]. Andrej Karpathy’s 2015 essay *The Unreasonable Effectiveness of Recurrent Neural Networks*, with its char-rnn code and fake Shakespeare, Wikipedia, LaTeX and Linux source, introduced a generation of engineers to neural text generation :cite[karpathy2015]. This chapter is a direct descendant.
:::

## Why recurrence gave way to attention

Recurrent networks work, and gated ones work well. But they have two limits that no gating fixes.

- **The state is a bottleneck.** Everything the network knows about the past must fit in $H$ numbers, rewritten at every step. To use a detail from 500 characters back, the network must have decided to keep it at the time, and kept it through 500 updates, without knowing whether it would ever be needed.
- **Training is sequential.** $\mathbf h_t$ depends on $\mathbf h_{t-1}$, so the $T$ steps of a chunk must run one after the other. The trainer above launches hundreds of tiny GPU kernels per step, one step at a time. The GPU is mostly waiting, and more hardware would not make it faster. An LSTM training step does about 6 GFLOPs in about 20 ms: roughly 300 GFLOP/s, a sixth of what the same GPU reached on one large matrix multiplication in Chapter 8.

**Attention** (Chapter 10) removes both limits. Every position looks directly at every earlier position, instead of through a chain of state updates. All positions are computed in parallel, as a few large matrix multiplications. The Transformer (Chapter 11) is built from attention alone.

Recurrence has since made a comeback in a different form. Linear recurrent models and **state-space models** such as Mamba :cite[gu2023] keep a fixed-size state for fast inference, but choose their recurrence so that training can be computed in parallel. Chapter 18 returns to them.

:::breakit
- In the lab, train the vanilla RNN with a learning rate ten times higher (`--cell rnn --lr 3e-2`). Then remove the call to `clip_grad_norm_` in `lmcourse/ch09.py` and try again. What does clipping save you from?
- In the gradient widget, find settings where the tanh RNN’s gradient explodes. Why is it much harder to make it explode than the linear RNN’s?
- In the lab, initialise the LSTM’s forget-gate biases to +1, then to −2 (PyTorch stores the four gates’ biases in the order input, forget, cell, output). How does early training change?
:::

## Lab: recurrent networks in PyTorch

```bash
cd training
uv run lmc ch09                        # LSTM, 1 × 256, as in the browser (about 20 s on an M4 Pro)
uv run lmc ch09 --cell rnn             # vanilla RNN
uv run lmc ch09 --cell gru             # GRU
uv run lmc ch09 --layers 2 --hidden 512 --dropout 0.25 --steps 10000 --lr 2e-3   # the 2.10-bit model
```

The lab uses `torch.nn.LSTM`, which on NVIDIA GPUs calls cuDNN’s fused kernels, the industrial-strength version of our `lstmCell`. It trains statefully with truncated BPTT, like the browser version, and evaluates on the whole validation split. The big configuration takes about 8 minutes on an M4 Pro, and a few minutes on the RTX 4060 Ti.

:::exercises
1. **GRU.** Implement a GRU cell with the CPU tensor library and train it on a small slice of the text. Compare it with your LSTM cell at the same number of parameters.
2. **Longer chunks.** Retrain with $T = 16$ and $T = 256$ (lab: `--bptt`). Does a longer truncation window help? What does it cost per step?
3. **Temperature and repetition.** Sample from the trained LSTM at temperatures 0.3, 0.8 and 1.3. At low temperature, recurrent networks often fall into loops (“the the the”). Why does a deterministic system with a finite state fall into cycles?
4. **Warm-up for evaluation.** Evaluate with the state reset to zero at the start of every 64-character chunk instead of carrying it. How much worse is the score, and what does that say about how much context the model actually uses?
:::

:::challenge
1. **A GPU GRU kernel.** Write a fused GRU cell (forward and backward WGSL kernels) in the style of `lstmCell`, test it against your CPU version, and add it to the trainer.
2. **Long-range test.** Construct a synthetic task that needs memory over $k$ steps — copy a character seen $k$ steps earlier — and find, for the vanilla RNN and the LSTM, the largest $k$ each can learn.
3. **Deeper.** Stack two LSTM layers in the browser trainer. Where does the second layer’s input come from, and what must change in the state carried between chunks?
:::

## Check your understanding

```quiz
q: "Why can a recurrent network, unlike the MLP of Chapter 7, use context of any length with a fixed number of parameters?"
options:
  - text: "It applies the same weights at every step and carries a state forward, so nothing depends on the length of the text."
    correct: true
    why: The cost is sequential computation and a fixed-size state that must summarise everything.
  - text: It stores the whole text in its hidden state.
    why: The state has a fixed size, H numbers; it can only summarise.
  - text: Its parameters grow with the sequence length, but slowly.
    why: They don't grow at all.
```

```quiz
q: "In a vanilla RNN, why does the gradient from a loss at step T to the state at step t typically vanish?"
options:
  - text: "It is a product of T − t Jacobians, each involving U and the tanh slopes; if they shrink vectors, the product shrinks exponentially."
    correct: true
    why: Exploding is the same effect in the other direction; clipping fixes that one but not vanishing.
  - text: Because truncated BPTT sets it to zero.
    why: Truncation cuts gradients at chunk boundaries, but they vanish within a chunk too.
  - text: Because the softmax saturates.
    why: The output layer is the same at every step; the problem is the path through the recurrence.
```

```quiz
q: "What is the key property of the LSTM's cell update c_t = f_t ⊙ c_{t−1} + i_t ⊙ g_t?"
options:
  - text: "The cell is updated additively, so its gradient back through one step is just multiplied by the forget gate, which can stay near 1."
    correct: true
    why: No weight matrix and no squashing on that path — the constant error carousel.
  - text: It uses fewer parameters than a vanilla RNN.
    why: It uses about four times as many (four gates' worth of weights).
  - text: It removes the need for backpropagation through time.
    why: It is still trained with BPTT; it just lets gradients survive it.
```

## Further reading

- Andrej Karpathy, *The Unreasonable Effectiveness of Recurrent Neural Networks* :cite[karpathy2015], and Karpathy, Johnson and Fei-Fei, *Visualizing and Understanding Recurrent Networks* :cite[karpathy2016].
- Christopher Olah, *Understanding LSTM Networks* :cite[olah2015lstm].
- Razvan Pascanu, Tomas Mikolov and Yoshua Bengio, *On the difficulty of training recurrent neural networks* :cite[pascanu2013].
- Sepp Hochreiter and Jürgen Schmidhuber, *Long Short-Term Memory* :cite[hochreiter1997].
