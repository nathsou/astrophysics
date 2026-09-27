---
number: 11
title: The Transformer
summary: Attention moves information between positions; the Transformer adds computation at each position, residual connections and normalisation, and stacks the result. We assemble GPT's block piece by piece, measure what each piece is worth, count where the parameters go, and meet the model this course will scale up into CourseGPT.
duration: About 3 hours, including the lab
prerequisites: [attention, mlp-language-model]
builds:
  - Transformer block (pre-norm)
  - GPU LayerNorm, GELU, dropout and tied output layer
  - GPT model (browser and PyTorch, same weights)
  - The first model to beat Kneser–Ney decisively
---

Chapter 10’s attention-only model could look anywhere in its context, yet it scored worse than a bigram-sized MLP. Attention on its own only *moves* information around: every output is a weighted average of value vectors. There is no step at which a position *thinks* about what it has gathered, and a stack of such layers does not train well.

The **Transformer** :cite[vaswani2017] fixes this with three additions, arranged around one idea. The idea is a **residual stream**: a vector at every position that flows up through the network, which each layer reads from and adds to. The additions are:

1. An **MLP block** after each attention block: the same small two-layer network applied independently at every position, where the model does its per-position computation.
2. **Residual connections** around both blocks, $\mathbf x \leftarrow \mathbf x + f(\mathbf x)$, so that gradients have a direct path down through any number of layers.
3. **Layer normalisation** before each block, so that every block sees inputs of a predictable scale.

This chapter assembles GPT’s version of the block and measures what each piece contributes. It then counts the model’s parameters and compute, and ends with the model the rest of the course scales up.

## The block

Here is one block of GPT-2 and every model like it:

:::equation{#block caption="A pre-norm Transformer block. The first line lets positions communicate; the second computes within each position."}
$$
\begin{aligned}
\mathbf x &\leftarrow \mathbf x + \operatorname{MHA}\big(\term{ln}{\operatorname{LN}_1(\mathbf x)}\big) \\
\mathbf x &\leftarrow \mathbf x + \term{W2}{W_2}\, \term{gelu}{\operatorname{GELU}}\big(\term{W1}{W_1}\, \operatorname{LN}_2(\mathbf x)\big)
\end{aligned}
$$
:::

```terms
ln:
  label: "$\\operatorname{LN}(\\mathbf x)$ — layer normalisation"
  what: Standardise each position’s vector to zero mean and unit variance across its $C$ features, then scale and shift by learned $\\gamma, \\beta$ (Chapter 7).
  why: The residual stream is a running sum and its scale drifts from layer to layer. Normalising each branch’s *input* means every branch sees inputs of the same scale, whatever the depth.
W1:
  label: "$W_1$ — the MLP’s expansion"
  what: A $C \\times 4C$ matrix, the same at every position. It maps each position’s vector into a four-times-wider hidden layer.
  why: The hidden layer is where features are computed. Geva and colleagues read its columns as *keys* that detect patterns in the input, and $W_2$’s rows as the *values* those patterns write into the stream.
gelu:
  label: "GELU — the non-linearity"
  what: "$\\tfrac12 x\\,(1 + \\tanh(\\sqrt{2/\\pi}\\,(x + 0.044715x^3)))$, a smooth version of ReLU (Appendix G)."
W2:
  label: "$W_2$ — the MLP’s projection back"
  what: A $4C \\times C$ matrix that maps the hidden layer back to the width of the stream, where it is added in.
  effect: It is initialised small (scaled by $1/\\sqrt{2L}$ in GPT-2), so every block starts close to the identity function and the untrained stack is well behaved.
```

::block-diagram

The two lines divide the work. **Attention** is the only operation in which positions exchange information: it is how “the name three lines up” reaches the current position. The **MLP** is applied to each position independently, with the same weights everywhere. It is where the information gathered by attention is combined and transformed — for instance, “the previous two characters are `th`, so a vowel or `e` is likely”. A deep Transformer alternates the two: gather, think, gather, think.

## Residual connections

The additions, $\mathbf x + f(\mathbf x)$, matter more than they look. Kaiming He and colleagues introduced them for image networks with over a hundred layers :cite[he2016]. There are two ways to see why they work.

**Gradients.** The derivative of $\mathbf x + f(\mathbf x)$ is $I + \partial f / \partial \mathbf x$. However small the branch’s Jacobian, the identity carries the gradient through unchanged. A stack of $L$ blocks therefore has a clean path from the loss to the embeddings. Compare Chapter 9, where a product of Jacobians made gradients vanish. The LSTM’s cell used the same trick — an additive update — for the same reason.

**The residual stream.** Unrolled, the output of a pre-norm Transformer is simply a sum:

:::equation{#stream caption="The residual stream: embeddings plus everything every block has written."}
$$
\mathbf x_L \;=\; \underbrace{\mathbf x_0}_{\text{embeddings}} \;+\; \sum_{\ell=1}^{L} \Big( \underbrace{\operatorname{MHA}_\ell(\cdot)}_{\text{attention writes}} + \underbrace{\operatorname{MLP}_\ell(\cdot)}_{\text{MLP writes}} \Big)
$$
:::

Every block reads the current stream through its LayerNorm and *writes* its result back by addition. Elhage and colleagues made this view the foundation of Transformer interpretability :cite[elhage2021]. It explains why the logit lens (Chapter 26) works — you can read predictions off the stream at any depth — and why deep Transformers can be trained at all.

## Where to normalise

The original Transformer applied LayerNorm *after* each addition: $\mathbf x \leftarrow \operatorname{LN}(\mathbf x + f(\mathbf x))$. This is **post-norm**. It works, but every gradient then passes through $2L$ normalisations, and deep post-norm models need a careful learning-rate warm-up to train at all. GPT-2 moved the normalisation to the start of each branch and added one final LayerNorm before the output layer. This **pre-norm** layout leaves the stream itself untouched. Xiong and colleagues showed that it keeps gradients well scaled at initialisation, and that it can train with little or no warm-up :cite[xiong2020]. Almost every model since uses it. (Chapter 18 meets RMSNorm, a cheaper normalisation that most current models use.)

## Positions

Attention is blind to order (Chapter 10), so position must be added to the input. There are three main approaches:

- **Learned position embeddings** (GPT-2 and our models): a table of $T$ vectors, one per position, added to the token embeddings. Simple and effective, but the model cannot handle sequences longer than $T$.
- **Sinusoidal encodings** (the original Transformer): fixed vectors of sines and cosines at geometrically spaced frequencies. The encodings of two positions have a dot product that depends only on how far apart they are, which makes relative position easy to compute.
- **Rotary position embeddings** (RoPE, used by Llama and most current models): rotate queries and keys by an angle proportional to their position, so that attention scores depend on relative position directly. Chapter 18 builds them.

::positional-encoding

::exercise{id="sinusoidal"}

## GPT, assembled

The complete model:

1. **Embed.** $\mathbf x_0 = E[\text{token}] + P[\text{position}]$ for each of the $T$ positions: $(B, T, C)$.
2. **Transform.** $L$ blocks as above.
3. **Read out.** A final LayerNorm, then logits $= \operatorname{LN}(\mathbf x_L)\, E^\top$: a score for every token in the vocabulary, at every position.

The output layer reuses the embedding matrix $E$. This is **weight tying** :cite[press2017]: the same vector represents a token when it is read and when it is predicted. It saves $V \times C$ parameters and tends to help small models. GPT-2 uses it, and so do our models.

Two details of GPT-2’s initialisation are worth copying. All weights start as $\mathcal N(0, 0.02^2)$. The two matrices that write into the residual stream, attention’s output projection and $W_2$, start $\sqrt{2L}$ times smaller. With $2L$ writes adding up, this keeps the stream’s scale roughly constant with depth at initialisation.

::exercise{id="transformer-block"}

:::note
**On the GPU.** The library’s `Gpt` class (`@lm/core/gpu`) is this model. It needed four more operations. **LayerNorm** is one fused kernel per direction, with one workgroup per row: two tree reductions for mean and variance on the way forward, and the Appendix B formula on the way back. **GELU** needs forward and backward kernels. **Dropout** is a stateless hash of (seed, element), so the backward pass regenerates the mask instead of storing it. And **x·Eᵀ** is our matmul kernel’s `transB` flag again, for the tied output layer. The library’s tests check a whole block with a tied output layer against the CPU tensor library, gradient by gradient.
:::

## What each piece is worth

Now measure. Train the same small model (width 128, 4 heads, context 128) with parts switched on one at a time:

::ablation

On an Apple M4 Pro, 3,000 steps give:

| Model | Parameters | Validation bits/char |
|---|---|---|
| Attention only (2 layers, GPT-2 initialisation) | 156 k | 2.98 |
| + MLP blocks | 419 k | 2.51 |
| + LayerNorm — a Transformer | 419 k | 2.22 |
| Transformer, 4 layers | 813 k | 2.19 |
| *for comparison:* Kneser–Ney · LSTM (Chapter 9) · MLP (Chapter 8) | | 2.22 · 2.24 · 2.43 |

Each addition is worth a lot. Without normalisation the MLP’s benefit is only partly realised. With it, a two-layer Transformer of 419,000 parameters matches Kneser–Ney and the LSTM after about a minute and a half of training. The PyTorch lab trains the identical model — same parameter count, same initialisation — to 2.23 bits, which confirms the browser implementation.

A bigger Transformer — six layers, width 384, context 256 and dropout 0.2, the configuration of Karpathy’s nanoGPT Shakespeare example :cite[karpathy2023gpt], with 10.7 million parameters — shows what happens next. In the lab, its validation loss reaches **2.15 bits per character** after 2,000 of its 5,000 steps: the best score in this course so far, and clearly below Kneser–Ney’s 2.22. Then it gets worse. By step 5,000 the training loss is down to 1.3 bits, but validation has risen to about 2.35. The model has started to memorise the play text. With only a million characters of Shakespeare, the dataset is now the limit, not the model. Chapter 12 trains with evaluation and checkpoints, so the best point can be kept, and Chapter 14 moves to a dataset a thousand times larger, where the Transformer’s advantages really show.

## Counting parameters and compute

Nearly all of a Transformer’s parameters are in its blocks. Attention has four $C \times C$ matrices and the MLP two $C \times 4C$ ones, so a block holds $12C^2$ weights. With $L$ blocks the total is $12LC^2$, plus $VC$ for the embedding table. Training costs about $6N$ floating-point operations per token for a model with $N$ non-embedding parameters: two for the multiply–add of each weight in the forward pass, and four in the backward pass, which computes gradients for both the activations and the weights. Chapter 17 builds scaling laws on this formula.

::param-counter

::exercise{id="param-count"}

The small models in this chapter are embedding-heavy: with $C = 128$, the blocks are small. At GPT-2’s size the blocks dominate, and at GPT-3’s the embeddings are a rounding error.

:::history{year=2017 title="Attention is all you need" people="Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit, Llion Jones, Aidan Gomez, Łukasz Kaiser and Illia Polosukhin"}
The Transformer was introduced at Google in 2017 as a translation model :cite[vaswani2017]. It had an *encoder*, which read the source sentence with unmasked self-attention, and a *decoder*, which wrote the translation with causal self-attention plus cross-attention to the encoder. It beat the best recurrent systems while training in a fraction of the time, because every position of a sentence was processed in parallel.

Within eighteen months the two halves had gone separate ways. OpenAI’s **GPT** (2018) kept only the decoder and pre-trained it as a language model on books :cite[radford2018]. Google’s **BERT** kept only the encoder and pre-trained it by filling in masked words :cite[devlin2019]. GPT-2 (2019) moved LayerNorm to the start of each block and scaled the decoder to 1.5 billion parameters :cite[radford2019]. GPT-3 (2020) scaled it to 175 billion :cite[brown2020]. Nearly every large language model since has been a decoder-only Transformer in the GPT-2 mould, with the refinements of Chapter 18.
:::

:::breakit
- In the lab, switch to post-norm (move `ln1` and `ln2` after the additions in `model.py`) and train with `--layers 8` and no warm-up. What happens? Add a 500-step warm-up: does it recover?
- Initialise the residual projections at the normal scale (drop the $1/\sqrt{2L}$) and train 8 layers. How does the initial loss compare with $\ln 65$?
- Untie the output layer (a separate $C \times V$ matrix) in the lab. Does the small model get better or worse?
:::

## Lab: the course’s GPT in PyTorch

```bash
cd training
uv run lmc ch11                                        # the browser's 2-layer model (≈ 2.23 bits/char, 40 s)
uv run lmc ch11 --no-mlp --no-norm                     # the ablations
uv run lmc ch11 --layers 6 --width 384 --heads 6 --context 256 --dropout 0.2 --steps 5000 --lr 1e-3   # ≈ 20 min; overfits (see above)
```

`lmcourse/model.py` is the model that Chapters 12–16 build on. It has the same parameters, with the same names, as the browser’s `Gpt`: `tok`, `pos`, `h0.attn.q`, `h0.mlp.fc`, `lnf.g`, and so on. `state_for_browser()` exports a trained model under those names. Chapter 16 loads a PyTorch-trained CourseGPT into the browser this way, and the tests check that both implementations compute the same logits.

:::exercises
1. **MLP width.** Train the browser-sized model with MLP ratios 1, 2, 4 and 8 (lab: `GPTConfig(mlp_ratio=…)`). Plot validation loss against the number of parameters. Is 4 a sweet spot?
2. **Where does the compute go?** For our 2-layer model at context 128, what fraction of training FLOPs is in the attention scores ($6LTC$ per token) and what fraction in the weights ($6N$)? At what context length are they equal?
3. **Sinusoidal versus learned.** Replace the learned position table with your sinusoidal encodings (fixed, not trained) in the lab model. Compare validation loss. Then evaluate both at a context longer than they were trained on.
4. **Logit lens preview.** In the lab, apply the final LayerNorm and the tied output layer to the residual stream *after each block* and compute the loss at each depth. How much does each block improve the prediction?
:::

:::challenge
1. **Parallel blocks.** GPT-J and PaLM compute attention and MLP from the same LayerNorm in parallel: $\mathbf x \leftarrow \mathbf x + \operatorname{MHA}(\operatorname{LN}(\mathbf x)) + \operatorname{MLP}(\operatorname{LN}(\mathbf x))$. Implement it, train it, and compare speed and loss.
2. **An encoder–decoder.** Build the original Transformer for a toy task — reversing strings of digits — with an unmasked encoder, a masked decoder, and cross-attention between them.
3. **Depth versus width.** At a fixed parameter budget of about 800,000, compare 2 layers of width 180, 4 of width 128 and 8 of width 90. Which wins after 3,000 steps? After 10,000?
:::

## Check your understanding

```quiz
q: "What does the MLP block do that attention cannot?"
options:
  - text: "Non-linear computation within each position: attention's output is a weighted average of value vectors, which are linear in the input."
    correct: true
    why: The attention weights come from a softmax, but what is averaged is linear; the MLP adds per-position features.
  - text: It lets positions exchange information.
    why: That is attention's job; the MLP acts on each position separately, with shared weights.
  - text: It normalises the residual stream.
    why: That is LayerNorm.
```

```quiz
q: "Why do residual connections make deep networks trainable?"
options:
  - text: "The Jacobian of x + f(x) is I + ∂f/∂x, so the gradient passes through each block unattenuated, whatever f does."
    correct: true
    why: The same principle as the LSTM's additive cell update.
  - text: They halve the number of parameters.
    why: They add none.
  - text: They normalise the activations.
    why: Normalisation is a separate component.
```

```quiz
q: "A model has L = 12 blocks of width C = 768. Roughly how many parameters are in its blocks?"
options:
  - text: "12 · 12 · 768² ≈ 85 million."
    correct: true
    why: 12C² per block (4C² in attention, 8C² in the MLP), times 12 blocks. GPT-2 small adds 39M of embeddings for its 124M total.
  - text: "12 · 768² ≈ 7 million."
    why: That is one block's worth, not twelve.
  - text: "768 · 50,257 ≈ 39 million."
    why: That is the token embedding table.
```

## Further reading

- Ashish Vaswani and colleagues, *Attention Is All You Need* :cite[vaswani2017].
- Andrej Karpathy, *Let’s build GPT* and nanoGPT :cite[karpathy2023gpt]. The same model built live, in PyTorch.
- Nelson Elhage and colleagues, *A Mathematical Framework for Transformer Circuits* :cite[elhage2021]. The residual-stream view.
- Mary Phuong and Marcus Hutter, *Formal Algorithms for Transformers* :cite[phuong2022]. Every variant in precise pseudocode.
- Mor Geva and colleagues, *Transformer Feed-Forward Layers Are Key-Value Memories* :cite[geva2021].
