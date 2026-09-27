---
number: 7
title: An MLP language model
summary: The first neural language model — Bengio’s multilayer perceptron with learned embeddings — trained in your browser. Along the way, the practical craft that makes networks train at all — initialisation, activation statistics, normalisation, and reading a model’s internals.
duration: About 3½ hours, including the lab
prerequisites: [learning-as-optimisation, automatic-differentiation, linear-algebra]
builds:
  - Embedding layer
  - MLP language model
  - Scaled initialisation
  - Layer normalisation
  - Training diagnostics
---

Chapter 2 ended at a wall. An n-gram model treats every context as an unrelated key in a table: having learned what follows *the cat sat on the*, it knows nothing about *the dog sat on the*. And each extra symbol of context multiplies the number of keys by the vocabulary size. In 2003, Yoshua Bengio and colleagues proposed a way through :cite[bengio2003]. Represent each token as a learned **vector**, so that similar tokens get similar vectors. Then compute the prediction with a neural network, so that similar contexts automatically get similar predictions.

This chapter builds that model — a **multilayer perceptron** (MLP) language model — and trains it on Shakespeare in your browser with the library from Chapters 4–6. The model is simple. What it teaches is not. Most of this chapter is about the craft of getting a neural network to train: why initial weights must be scaled just so, how to tell from its internals whether a network is healthy, and why normalisation layers exist. Every model from here to CourseGPT relies on these ideas.

## Embeddings: tokens as vectors

Give every token $x$ in the vocabulary a vector of $d$ learned numbers, its **embedding**. Stack them into a matrix $C$ of shape $(V, d)$; looking up a token is reading a row:

:::equation{#embedding caption="An embedding is a learned row of a V × d matrix, one per token."}
$$
\mathbf e_x \;=\; \term{Cx}{C[x]} \;\in\; \mathbb{R}^{\term{dd}{d}}
$$
:::

```terms
Cx:
  label: "$C[x]$ — the embedding of token $x$"
  what: Row $x$ of the embedding matrix $C$. It starts random and is learned by gradient descent, like every other parameter.
  why: Nothing tells the model which tokens are alike. It discovers useful similarities because tokens that behave alike get pushed towards similar vectors by the same gradients.
  effect: Two tokens with nearby embeddings produce similar predictions wherever they appear — exactly the generalisation an n-gram table lacks.
dd:
  label: "$d$ — embedding dimension"
  what: The length of each embedding vector (16 in our browser model; 384 in CourseGPT; several thousand in frontier models).
  effect: Too small and distinct tokens are forced together; too large and the embedding table dominates the parameter count for little benefit.
```

This is a **distributed representation**. Each token is a pattern of activity across many shared dimensions, not a single dedicated slot. The idea goes back to Geoffrey Hinton’s work in the 1980s :cite[hinton1986]. It became famous in 2013, when word2vec’s embeddings turned out to support arithmetic like *king − man + woman ≈ queen* :cite[mikolov2013]. In the model below, the embedding lookup is the operation you met in Chapter 5’s neural bigram, where $W$ was effectively a $V \times V$ embedding table with $d = V$.

## Bengio’s MLP

The model takes the previous $n$ tokens, looks up their embeddings, concatenates them into one vector, passes it through a hidden layer with a non-linearity, and produces logits over the vocabulary:

:::equation{#mlp caption="The MLP language model (Bengio et al., 2003, without their direct connections)."}
$$
\begin{aligned}
\mathbf e &= \big[\, C[x_{t-n}] \,;\, \ldots \,;\, C[x_{t-1}] \,\big] \in \mathbb R^{n d} \\
\term{hh}{\mathbf h} &= \tanh\!\big(\mathbf e\, W_1 + \mathbf b_1\big) \in \mathbb R^{\term{hdim}{h}} \\
\mathbf z &= \mathbf h\, W_2 + \mathbf b_2 \in \mathbb R^{V}, \qquad P(x_t \mid x_{<t}) = \softmax(\mathbf z)
\end{aligned}
$$
:::

```terms
hh:
  label: "$\\mathbf h$ — the hidden layer"
  what: A vector of $h$ features computed from the whole context. Each unit is a weighted sum of all context embeddings passed through tanh.
  why: The non-linearity is essential. Without it the model is a composition of linear maps — itself just one linear map — and could not represent interactions such as “`q` followed by a vowel”.
  effect: More hidden units mean more features, more parameters and more computation per prediction.
hdim:
  label: "$h$ — hidden width"
  what: The number of hidden units (128 in the browser model, 512 in the PyTorch lab).
```

The parameters are $C$, $W_1$, $\mathbf b_1$, $W_2$ and $\mathbf b_2$: about 26,000 of them for the browser model ($V = 65$, $n = 8$, $d = 16$, $h = 128$). A 6-gram Kneser–Ney model of the same text stores several hundred thousand counts. More importantly, the MLP’s size grows only *linearly* with the context length $n$, through $W_1$, not exponentially.

::exercise{id="mlp-forward"}

## Training it

Here is the model, training with SGD on TinyShakespeare. It keeps running in the background while you read on, and the widgets further down show its internals as it learns.

::mlp-trainer

With the default settings it takes around 10,000 steps — under a minute on a laptop — to get below 3 bits per character. That is far better than the bigram model, but still well behind Chapter 2’s Kneser–Ney 6-gram at 2.22. We will come back to why. First, two things to notice from the very start of training:

- The **initial loss** is almost exactly $\ln 65 \approx 4.17$ nats: the model starts out predicting every character as equally likely. That is no accident; it is a design choice.
- Switch *Initialisation* to *Naïve N(0, 1)* and the initial loss jumps to somewhere around 20–30 nats, training is slow and erratic, and it may never recover. A network’s starting point matters.

## Initialisation

Why does the naïve initialisation fail? Consider one linear layer, $y = \sum_{i=1}^{n_{\text{in}}} w_i x_i$, with independent zero-mean inputs and weights. The variance of a sum of independent terms is the sum of their variances:

:::equation{#init caption="Why weights are scaled by 1/√fan_in: it keeps activations at a constant scale."}
$$
\operatorname{Var}(y) \;=\; \term{nin}{n_{\text{in}}}\, \operatorname{Var}(w)\, \operatorname{Var}(x)
\quad\Longrightarrow\quad
\operatorname{std}(w) = \frac{\term{gain}{g}}{\sqrt{n_{\text{in}}}}
$$
:::

```terms
nin:
  label: "$n_{\\text{in}}$ — fan-in"
  what: The number of inputs feeding each unit — for $W_1$, that is $n \cdot d = 128$.
  why: Each input contributes its own variance to the sum, so the output variance grows linearly with the fan-in.
  effect: With $\operatorname{std}(w) = 1$ and 128 inputs, pre-activations have a standard deviation of about 11 — deep in tanh’s flat tails, where gradients vanish.
gain:
  label: "$g$ — gain"
  what: A correction factor for the non-linearity that follows.
  why: tanh squashes its input, and ReLU zeroes half of it, so the variance shrinks at each layer; a gain slightly above 1 compensates.
  effect: "$g = 1$ is Xavier/Glorot initialisation; $5/3$ is the standard choice for tanh; $\\sqrt 2$ is Kaiming/He initialisation for ReLU. Too small and signals fade to zero with depth; too large and they explode or saturate."
  param: { key: init.gain, min: 0.25, max: 4, step: 0.01, value: 1.6667, log: true }
```

Scaling each layer’s weights by $g/\sqrt{n_{\text{in}}}$ keeps the scale of activations — and, by the same argument run backwards, of gradients — roughly constant from layer to layer. The effect is dramatic in a deep network. Push random inputs through eight layers and change the gain:

::init-explorer

With gain 0.5 the activations shrink by a constant factor at every layer. By layer 8 there is essentially no signal left, and the gradients reaching the first layer are negligible. With gain 3, tanh units saturate at ±1 and gradients vanish for a different reason: $\tanh'(x) \approx 0$ in the tails. The standard gains keep the distributions steady. With *none (linear)* you can check the variance argument exactly: gain 1 keeps the standard deviation at 1 through every layer.

For the output layer there is a second consideration. We want the initial logits close to zero, so that the initial predictions are nearly uniform and the initial loss is $\ln V$. A confidently wrong initial model wastes the first thousand steps unlearning its random opinions — the “hockey stick” at the start of a badly initialised loss curve. So the course model scales $W_2$ down by an extra factor of 10.

::exercise{id="init"}

:::history{year=2010 title="Initialisation, the unsung hero of deep learning" people="Xavier Glorot, Yoshua Bengio; Kaiming He and colleagues"}
Until the late 2000s, deep networks were widely believed to be almost impossible to train from random initialisation. Much effort went into layer-by-layer “pre-training” to find a good starting point. In 2010, Xavier Glorot and Yoshua Bengio analysed how activations and gradients propagate through deep networks and derived the variance-preserving scale now called *Xavier initialisation* :cite[glorot2010]. In 2015 Kaiming He and colleagues extended the argument to ReLU networks, whose units discard half of their input, and trained very deep networks from scratch :cite[he2015]. Careful initialisation, together with normalisation layers and residual connections (Chapter 11), is a large part of why depth stopped being an obstacle.
:::

## Looking inside the network

Loss curves tell you *whether* training is working, not *why not*. The quickest way to diagnose a network is to look at the distributions inside it, as the model trains. Here are the hidden layer of the model above and the relative size of each parameter’s updates:

::mlp-activations

Three habits worth forming:

1. **Check the initial loss** against $\ln V$. If it is much higher, the output layer is too confident.
2. **Check activation histograms.** For tanh, a large fraction of units stuck near ±1 means the pre-activations are too large and gradients are vanishing. Switch to *Naïve* and watch the histogram pile up at the edges. For ReLU, units that are zero for every input are **dead**: they get no gradient and never recover.
3. **Check the update-to-parameter ratio** — how much each step changes each parameter relative to its size. Around $10^{-3}$ is a healthy rule of thumb. Much smaller and that layer is barely learning; much larger and it is being thrashed around. A learning rate that is right for one layer can be wrong for another, which is part of the motivation for adaptive optimisers such as Adam (Chapter 13).

:::breakit
1. Set *Non-linearity* to *none*. The model becomes a purely linear function of its embeddings — effectively a factorised bigram-style model over the whole context. How close does it get to the tanh model, and why can it never catch up?
2. Set the learning rate to 2 with the default model. What do the activation histogram and the update ratios show just before the loss diverges?
3. Use ReLU with the naïve initialisation. What fraction of units are dead after a few hundred steps? Why don’t they come back?
:::

## Normalisation

Careful initialisation sets good statistics at the start, but training moves the weights, and the statistics drift. **Normalisation layers** re-standardise activations on every forward pass. The first to succeed widely was **batch normalisation** :cite[ioffe2015], which normalises each unit across the examples in a batch. It works well for images, but it makes each example’s output depend on the rest of its batch, and it is awkward for sequences. Language models use **layer normalisation** :cite[ba2016], which normalises across the *features of each example* instead:

:::equation{#layernorm caption="Layer normalisation: standardise each example’s feature vector, then rescale."}
$$
\operatorname{LN}(\mathbf x) \;=\; \frac{\mathbf x - \mu}{\sqrt{\sigma^2 + \epsilon}} \odot \term{gam}{\boldsymbol\gamma} + \boldsymbol\beta,
\qquad \mu = \frac{1}{h}\sum_j x_j, \quad \sigma^2 = \frac{1}{h}\sum_j (x_j - \mu)^2
$$
:::

```terms
gam:
  label: "$\\boldsymbol\\gamma, \\boldsymbol\\beta$ — learned scale and shift"
  what: One pair of parameters per feature, initialised to 1 and 0.
  why: Standardising every feature to mean 0 and variance 1 might remove information the network needs, so the layer can learn to undo it where useful.
  effect: Without them, LayerNorm would force every hidden vector onto the same sphere. With them, the network chooses the scale it wants, but the normalisation keeps that choice stable as the weights change.
```

Turn on LayerNorm in the trainer and try the naïve initialisation again. The pre-activation histogram stays standardised whatever the weights’ scale, and training recovers. Every block of the Transformer (Chapter 11) contains LayerNorm, or its cheaper cousin RMSNorm (Chapter 18).

::exercise{id="layer-norm"}

## What the embeddings learn

Each character’s embedding is a 16-dimensional vector. To see them, we project onto the two directions along which they vary most, using **principal component analysis** (PCA; see Appendix A). At step 0 the layout is random. As the model trains, structure appears. Hover a character to see its nearest neighbours in the full 16-dimensional space.

::mlp-embeddings

After a few thousand steps you will typically see vowels cluster together, capital letters separate from lower-case ones, and punctuation and whitespace form their own group — all learned purely from predicting the next character. Nobody told the model what a vowel is. Characters that can be substituted for each other in similar contexts end up nearby, because they receive similar gradients. This is the property Bengio wanted: whatever the model learns about one context transfers to contexts that use similar characters.

::exercise{id="pca"}

## How good is it — and what limits it?

::mlp-sampler

The browser model, trained for a minute, reaches around 2.9 bits per character. The PyTorch lab trains a larger version: context 8, embeddings of 24, two hidden layers of 512 units, and the Adam optimiser from Chapter 13. It reaches about **2.28 bits per character** on the full validation split, close to Kneser–Ney’s 2.22, but not better. Adding dropout, the regulariser from Chapter 12, does not help, and neither does a longer context: with $n = 16$ the MLP gets *worse*.

That last result points at the MLP’s structural problem:

- **Every position has its own weights.** The part of $W_1$ that reads the character three steps back is entirely separate from the part that reads the character two steps back. A pattern learned at one offset (say, “the letters of a common word”) has to be relearned at every other offset. Doubling the context doubles those parameters and the data needed to train them.
- **The context is a fixed window.** Nothing beyond $n$ characters can influence the prediction, however useful it would be.

Both problems have the same fix: *share* weights across positions. A recurrent network (Chapter 9) applies the same cell at every step and carries a running state forward, so its context has no fixed limit. Attention (Chapter 10) lets every position look back at any earlier position with the same learned query. Combined in the Transformer (Chapter 11), these ideas take us well below Kneser–Ney. But the MLP’s ingredients — embeddings, scaled initialisation, non-linearities, normalisation and cross-entropy — survive intact inside every one of those models.

:::history{year=2003 title="A neural probabilistic language model" people="Yoshua Bengio, Réjean Ducharme, Pascal Vincent and Christian Jauvin"}
Bengio and colleagues’ paper :cite[bengio2003] introduced almost every component of this chapter: learned word embeddings (“distributed feature vectors”), a neural network over the concatenated context, and a softmax output trained by maximum likelihood. It also named the enemy — the *curse of dimensionality* — which is why n-grams cannot generalise to unseen contexts. On their word-level corpora the model beat the best smoothed n-gram models, especially when the two were combined. It was expensive: the softmax over a vocabulary of about 18,000 words dominated the cost, and training on their largest corpus, of around 14 million words, took weeks of computation on a cluster of CPUs. For a decade, n-gram models remained the practical choice. Only with GPUs (Chapter 8), recurrent networks and cheaper output layers did neural language models take over, around 2010–2013.
:::

## Lab: the MLP in PyTorch

```bash
cd training
uv run lmc ch07                                  # SGD, as in the browser (one hidden layer)
uv run lmc ch07 --optimizer adamw --layers 2     # the stronger version quoted above
uv run lmc ch07 --context 16 --optimizer adamw --layers 2   # does more context help?
```

Each run takes a minute or two on a laptop CPU and reports bits per character on the full validation split, next to Kneser–Ney’s 2.22.

:::exercises
1. **Direct connections.** Bengio’s original model also had a linear path from the embeddings straight to the logits ($\mathbf z = \mathbf h W_2 + \mathbf e W_3 + \mathbf b_2$). Add it. Does it train faster early on? Why might it?
2. **Embedding size.** Train with $d = 2$ and plot the embeddings directly, without PCA. What can two dimensions capture?
3. **Temperature.** In the sampler, compare temperature 0.3 and 1.5 at the same model step. Explain what each does to the softmax, and why low temperatures lead to repetition.
4. **A learning-rate schedule.** Add a “decay” button that multiplies the learning rate by 0.1, and use it once the loss flattens. How much lower does validation loss go?
:::

:::challenge
1. **Batch normalisation.** Implement BatchNorm (with running statistics for evaluation) and compare it with LayerNorm in the trainer. What goes wrong at batch size 1? What happens if you evaluate with batch statistics instead of the running averages?
2. **Word-level MLP.** Train the MLP on Chapter 2’s word-level data (with `<unk>` for rare words). Compare its perplexity with Kneser–Ney *on words*, where Bengio originally showed its advantage.
3. **Mixture with Kneser–Ney.** Interpolate the MLP’s probabilities with Chapter 2’s Kneser–Ney model, $\lambda P_{\text{MLP}} + (1 - \lambda) P_{\text{KN}}$, and tune $\lambda$ on the validation split. The two models make different mistakes — how far below 2.22 bits can the mixture go?
:::

## Check your understanding

```quiz
q: "Why does the naïve initialisation (all weights ~ N(0, 1)) give an initial loss of 20–30 nats instead of ln 65 ≈ 4.2?"
options:
  - text: "The logits are huge and random, so the model is confidently wrong: it assigns tiny probability to most correct answers."
    correct: true
    why: "With 128 inputs of unit scale and unit-variance weights, pre-activations and logits have standard deviations of order 10, far from the near-zero logits that give uniform predictions."
  - text: The softmax overflows.
    why: The library’s softmax is stable (Chapter 4). The loss is large but finite.
  - text: The embeddings are not trained yet.
    why: They are random in both initialisations; the difference is the weight scale.
```

```quiz
q: "A layer has 1,024 inputs and is followed by a ReLU. What standard deviation should its weights have under Kaiming initialisation?"
options:
  - text: "√2 / √1024 ≈ 0.044"
    correct: true
    why: "gain / √fan_in with gain √2 for ReLU."
  - text: "1 / 1024"
    why: That scales by the fan-in itself rather than its square root, shrinking the signal at every layer.
  - text: "1"
    why: The pre-activations would then have a standard deviation of about 32.
```

```quiz
q: "Why does increasing the MLP’s context from 8 to 16 characters make it worse, when a longer context contains strictly more information?"
options:
  - text: "The first layer has separate weights for every position, so the model has more parameters to learn from the same data and cannot reuse what it learns at one offset at another."
    correct: true
    why: The information is there, but the architecture is inefficient at using it — the motivation for recurrence and attention.
  - text: Characters more than 8 steps back carry no information.
    why: They carry plenty — Shannon’s subjects used up to 100 characters of context.
  - text: The softmax becomes unstable with longer inputs.
    why: The output layer is unchanged by the context length.
```

## Further reading

- Yoshua Bengio et al., *A Neural Probabilistic Language Model* :cite[bengio2003]. Surprisingly readable, and prophetic.
- Andrej Karpathy, *Neural Networks: Zero to Hero*, the “makemore” lectures :cite[karpathy2022zero]. A hands-on build of this model, including the activation diagnostics above.
- Xavier Glorot and Yoshua Bengio, *Understanding the difficulty of training deep feedforward neural networks* :cite[glorot2010].
