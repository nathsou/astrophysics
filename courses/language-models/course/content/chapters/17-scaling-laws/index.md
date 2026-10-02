---
number: 17
title: Scaling laws
summary: A language model's loss falls as a smooth power law in its size, its data and its compute, over many orders of magnitude. We meet the laws of Kaplan and Chinchilla, measure our own with sixteen small GPTs, use it to predict CourseGPT's loss before looking, and ask what the laws leave out — the cost of using a model, limited data, and abilities that loss does not show.
duration: About 2 hours
prerequisites: [scaling-up, optimisation]
builds:
  - An IsoFLOP sweep of 17 GPTs on TinyStories
  - A fitted scaling law L(N, D)
  - Compute-optimal and inference-aware model sizing
---

Chapter 14 spent two hours of GPU time on CourseGPT, and we chose its size by rule of thumb: 30 million parameters, a billion tokens. Was that a good use of the compute? A model twice as large trained on half the data costs the same. So would one half the size trained on twice the data. Which is better?

At the scale of frontier models the question is worth hundreds of millions of dollars, and nobody can afford to answer it by trying every option. What makes it answerable is one of the most useful empirical discoveries in deep learning: a language model’s loss is a **smooth, predictable function** of its size, its data and its compute, over many orders of magnitude. Measure a few small models, fit the curve, and you can predict what a model a thousand times larger will do. This chapter does exactly that, on TinyStories, and checks the prediction against CourseGPT.

## Power laws

In 2020, Kaplan and colleagues trained hundreds of Transformers, from a few thousand to 1.5 billion parameters, and plotted their loss :cite[kaplan2020]. On log–log axes, loss against model size was a straight line when data was not the limit; so was loss against dataset size when the model was not; and so was the best loss reachable with a given amount of compute. A straight line on log–log axes is a **power law**, $L \propto N^{-\alpha}$, the same shape as Zipf’s law in Chapter 1. The exponents were small, around 0.05 to 0.1: halving the loss’s reducible part takes a very large multiple of compute. Hestness and colleagues had seen similar power laws in translation, speech and image models a few years earlier :cite[hestness2017].

A power law cannot go on forever: loss cannot fall below the entropy of the text itself (Chapter 1), however large the model. Hoffmann and colleagues, fitting DeepMind’s **Chinchilla** models, wrote the loss with an irreducible part and one term each for the model and the data :cite[hoffmann2022]:

:::equation{#scaling-law caption="The Chinchilla form of the scaling law: an irreducible loss, plus terms that shrink as the model grows and as the data grows."}
$$
L(N, D) \;=\; \term{E}{E} \;+\; \frac{\term{A}{A}}{N^{\term{alpha}{\alpha}}} \;+\; \frac{B}{D^{\beta}}
$$
:::

```terms
E:
  label: "$E$ — the irreducible loss"
  what: The loss of a perfect model — the entropy of the text itself (Chapter 1). No amount of scale goes below it.
A:
  label: "$A/N^\\alpha$ — the cost of a finite model"
  what: How much worse a model with N parameters is than an infinitely large one trained on the same data. A and α are fitted.
  effect: Doubling N divides this term by 2^α — by about 20% for α ≈ 0.34.
alpha:
  label: "$\\alpha, \\beta$ — the exponents"
  what: How fast each term shrinks. β plays the same role for the data term B/D^β, where D is the number of training tokens.
  why: The ratio of the exponents decides how a compute budget should be split between model size and data.
```

## Spending a compute budget

Training costs about $C \approx 6ND$ floating-point operations (Chapter 11). With $C$ fixed, choosing $N$ fixes $D = C / 6N$, and the loss becomes a function of one variable: too small a model is limited by its size, too large a model by its data. Minimising it gives the **compute-optimal** split:

:::equation{#optimal caption="The compute-optimal model size and data for a budget C, from the scaling law."}
$$
N_{\text{opt}} = G \left(\frac{C}{6}\right)^{\frac{\beta}{\alpha + \beta}}, \qquad D_{\text{opt}} = \frac{1}{G} \left(\frac{C}{6}\right)^{\frac{\alpha}{\alpha + \beta}}, \qquad G = \left(\frac{\alpha A}{\beta B}\right)^{\frac{1}{\alpha + \beta}}
$$
:::

When the two exponents are equal, $N$ and $D$ grow alike, each as $\sqrt C$: double the budget, and both grow by 41%.

::scaling-law-playground

:::question
**Trade parameters for data.** At fixed compute C ≈ 6ND, doubling the parameter count halves the available training tokens. Use the allocation figure to compare those two choices. More parameters alone do not guarantee a lower loss.
:::

The two famous laws disagree here. Kaplan and colleagues concluded that model size should grow much faster than data, $N_{\text{opt}} \propto C^{0.73}$, and the models of that era — GPT-3 with 175 billion parameters and 300 billion tokens — were built accordingly. Hoffmann and colleagues found the exponents nearly equal, and a ratio of about **20 tokens per parameter**. They tested it directly: Chinchilla, with 70 billion parameters and 1.4 trillion tokens, outperformed their own 280-billion-parameter Gopher trained with the same compute.

The difference has since been traced to details of method. Kaplan’s runs used one learning-rate schedule for all training lengths, so shorter runs were cut off before their learning rate decayed, which penalised small-data configurations; they also counted parameters without the embeddings, which matters at small scale :cite[pearce2024,porian2024]. Chinchilla’s own paper contains a similar puzzle, which you can see in the widget above: its fitted law $L(N, D)$ implies about 50 to 120 tokens per parameter, not the 20 that its other two methods gave. Besiroglu and colleagues re-extracted the data from the paper’s figures and found the fit itself had gone wrong; refitted, the law has β close to α and gives about 20 tokens per parameter at every scale :cite[besiroglu2024]. Scaling laws are measurements, and they are only as good as the experiments behind them. In our sweep, every run has a cosine schedule that ends exactly when the run does.

## Measuring our own

Chinchilla’s most direct method is the **IsoFLOP** experiment: pick a few compute budgets; at each, train models of several sizes, each for as many tokens as the budget allows; and plot final loss against size. Each budget gives a U-shaped curve, and its minimum is that budget’s compute-optimal model.

We ran the experiment on TinyStories with CourseGPT’s recipe (Muon, context 512), for seven shapes from 2 layers of width 128 to 10 × 640, and three budgets from $10^{15}$ to $6.25 \times 10^{15}$ FLOPs — the largest about a thirtieth of CourseGPT’s run. The 17 runs took under an hour on the RTX 4060 Ti. Or rather, the *second* 17 runs did: the first sweep went wrong, instructively.

::iso-flop-measured

:::question
**Locate the minimum.** On an isoflop curve, identify the undertrained large-model side and the capacity-limited small-model side. Read the minimum from the figure, then explain why neither endpoint uses the budget well.
:::

Each budget has a clear minimum: 4.2 million parameters at $10^{15}$ FLOPs, 7.2 million at $2.5 \times 10^{15}$ and 12.7 million at $6.25 \times 10^{15}$, trained on 9, 8 and 6 tokens per parameter. The optimal size grows as $C^{0.60}$, between Chinchilla’s 0.5 and Kaplan’s 0.73. And the optimal ratio is well below Chinchilla’s 20. That is not a contradiction: the ratio depends on the data (TinyStories is far more predictable than web text), on the optimiser (Muon extracts more from each token), on counting embedding parameters, which are a third of our smallest models, and on scale, since our budgets are a million times smaller than Chinchilla’s.

Switch the widget to the first sweep. It used 8,192 tokens per optimiser step, a quarter of the batch, to keep each run cheap, with the same learning rate. The effect was not uniform. Runs with many optimiser steps — the small models — were worse by up to 0.33 bits per token — probably because Muon’s step size does not shrink with the batch, so four times as many steps, each on a noisier gradient, meant four times as much noisy movement (a smaller learning rate would likely have compensated; we did not tune it). But the largest model at each budget was *better* with the small batch: with the large one it had only a few hundred steps to learn in. The small batch therefore favoured large models, and the minima moved to larger models (7.9, 14.7 and 31 million parameters, at 3 to 1 tokens per parameter), and the optimal size grew as $C^{0.75}$: almost exactly Kaplan’s exponent. That is the mechanism later papers identified for Kaplan’s result :cite[porian2024]. Hyperparameters that are not right for every size bias the whole scaling law. We found it only because the first law made a bad prediction, which is what the next section is about.

## A law for TinyStories, and a prediction

Fitting $L(N, D)$ to all seventeen final losses at once — by minimising the Huber loss of $\log L$, as Hoffmann and colleagues did — gives our own scaling law:

:::equation{#our-law caption="Our scaling law for CourseGPT’s architecture on TinyStories, in bits per token (N counts all parameters)."}
$$
L(N, D) \;\approx\; 1.69 \;+\; \frac{5.2 \times 10^{4}}{N^{0.77}} \;+\; \frac{1.3 \times 10^{5}}{D^{0.73}}
$$
:::

The exponents are about twice Chinchilla’s: on TinyStories, loss falls much faster with scale than on web text, as you would expect of such a regular corpus. They are also close to each other, which is why the optimal model size grows roughly like $\sqrt C$. Choose “Ours” in the first widget to explore it.

Now the test. CourseGPT used 30 times the compute of the largest sweep budget, with 35 tokens per parameter, far from anything in the sweep. What does the law, which has never seen a run like it, predict for its loss?

::compute-frontier

The law predicts 1.81 bits per token. CourseGPT measured 1.65. The prediction is in the right region — far better than the first sweep’s law, which predicted 2.17 — but it is pessimistic, and the reason is visible in the fit: its irreducible loss, 1.69, is already above what CourseGPT achieved. None of the sweep’s runs came near the regime of many tokens per parameter where the irreducible term dominates, so the fit could not pin it down, and a 30-fold extrapolation magnifies such errors. Chinchilla’s fits used budgets spanning three orders of magnitude; ours span less than one. The lesson is the one practitioners draw: scaling laws predict well within and just beyond the range they were fitted on, and the recipe must be right at every scale.

This kind of prediction is how large training runs are planned. OpenAI reported that GPT-4’s final loss was predicted from models trained with up to 10,000 times less compute, before the big run began :cite[openai2023].

## Beyond compute-optimal

A compute-optimal model is the cheapest way to *train* to a given loss. But a model is trained once and then used, perhaps for trillions of tokens, and every generated token costs about $2N$ FLOPs (Chapter 16). A smaller model trained for longer reaches the same loss with more training compute, but it is cheaper for every token served ever after. Accounting for inference moves the optimum towards smaller models and many more tokens :cite[sardana2024].

::inference-cost

:::question
**Check the target.** As a target loss approaches the fitted irreducible floor, the required data grows sharply. Use the curve to compare a modest improvement with a target near that floor. A target below the floor has no finite solution in this fitted model.
:::

Modern open models go far beyond the Chinchilla ratio for this reason. Llama 3’s 8-billion-parameter model was trained on 15 trillion tokens :cite[dubey2024], nearly 1,900 per parameter. CourseGPT, at 35 tokens per parameter, was trained on four to six times more tokens per parameter than our sweep says is compute-optimal — and for a model meant to run in a browser, that is the right trade.

The other limit is **data**. TinyStories has 536 million tokens, so the larger budgets of a sweep, or a much larger CourseGPT, would repeat it several times. Muennighoff and colleagues found that repeating data for up to about four epochs is almost as good as fresh data, but that returns fall quickly beyond that :cite[muennighoff2023]. Frontier training is now as often limited by the supply of good text as by compute.

## What the loss does not tell you

Scaling laws predict the loss, the average surprise per token. They do not directly predict what a model can *do*. Wei and colleagues catalogued **emergent abilities**: tasks, like multi-step arithmetic, on which performance stays near chance as models grow and then rises sharply past some scale :cite[wei2022emergent]. Schaeffer and colleagues showed that many such jumps are produced by the metric: exact-match accuracy on a multi-digit answer is zero until every digit is right, so a smooth improvement in per-token loss can look like a sudden leap :cite[schaeffer2023]. Measured with a continuous metric, most “emergent” abilities improve smoothly. Chapter 25 returns to evaluation.

Scaling laws also assume that the recipe scales. We used one learning rate for every size, and at larger scales the best learning rate changes with width. The **μP** parameterisation rescales initialisation and learning rates with width so that the best hyperparameters found on a small model transfer to a large one :cite[yang2022mup], which makes a sweep like ours much more trustworthy at scale.

:::history{year=2020 title="Scaling laws" people="Joel Hestness and colleagues (Baidu, 2017); Jared Kaplan, Sam McCandlish and colleagues (OpenAI, 2020); Jordan Hoffmann and colleagues (DeepMind, 2022)"}
In 2017, a team at Baidu Research measured how the error of translation, speech, image and language models fell with the size of their training sets, and found power laws in every domain :cite[hestness2017]. The result drew little attention outside a few labs. In January 2020, Kaplan and colleagues at OpenAI published a far more systematic study for Transformer language models :cite[kaplan2020], and it became the plan for GPT-3, released four months later: a model ten times larger than any before it, trained because the curves said it would work.

Two years later, DeepMind’s Chinchilla paper :cite[hoffmann2022] showed that the industry had been building models too large and training them on too little data. Within a year, most new models were trained on far more tokens per parameter. Today’s labs run their own sweeps, and scaling laws have been measured for data mixtures, for fine-tuning, for mixture-of-experts models (Chapter 19) and for inference-time computation (Chapter 22).
:::

:::breakit
- Refit our law without the irreducible term ($E = 0$). How do the other parameters change, and what does the new law predict for CourseGPT?
- Drop the smallest budget from the fit. How much does the predicted optimal size at $10^{17}$ FLOPs move? What does that say about extrapolating from three budgets?
- Count parameters without the embeddings (`non_embedding` in the data) and redo the IsoFLOP fits. Does the optimal tokens-per-parameter ratio change?
:::

## Lab: a scaling sweep

```sh
uv run lmc ch17 sweep       # 17 runs at three budgets (under an hour on an RTX 4060 Ti)
uv run lmc ch17 fit         # IsoFLOP minima, N_opt ∝ C^a, L(N, D), and the CourseGPT prediction
uv run lmc ch17 summary
```

`lmcourse/ch17.py` computes every run’s step count from its budget and FLOPs per token, trains it with `train.main` and a warm-up and cosine schedule sized to the run, then fits the laws. Adding a budget or a shape is one line.

:::exercises
1. **A fourth budget.** Add a budget of $1.6 \times 10^{16}$ FLOPs with the four largest shapes (about 45 minutes). Does the optimal size follow the power law fitted to the first three?
2. **Kaplan’s mistake.** Rerun the $2.5 \times 10^{15}$ budget with every run using the schedule of the longest run (a cosine over 32,000 steps, stopped early). How do the IsoFLOP minimum and the tokens-per-parameter ratio move?
3. **Width against depth.** At one budget, train models with the same parameter count but different shapes (4 × 384 against 8 × 256). Kaplan found shape mattered little. Do we?
4. **Bits per byte.** Our law is in bits per token of CourseGPT’s tokeniser. Convert it to bits per byte, and explain why comparing laws across tokenisers requires it.
:::

:::challenge
1. **The data wall.** Train the 3 × 192 model for 4, 8 and 16 epochs of a 50-million-token subset of TinyStories, and compare with the same number of fresh tokens. Where do repeated epochs stop helping?
2. **μP.** Implement μP’s rules for our GPT (initialisation scaled by width, per-layer learning rates) and show that the best learning rate at width 128 is still best at width 512.
3. **A scaling law for sampling.** Using Chapter 15’s metrics, measure how the gap between greedy and sampled text changes with model size across the sweep’s models.
:::

## Check your understanding

```quiz
q: "With a fixed compute budget C ≈ 6ND, what goes wrong with a model that is much too large?"
options:
  - text: "It can only be trained on few tokens, so the data term B/D^β dominates its loss."
    correct: true
    why: At fixed compute, more parameters means fewer tokens.
  - text: It overfits because it memorises the training set.
    why: A compute-starved large model sees each token at most once; the problem is too little data, not memorisation.
  - text: Its loss falls below the irreducible term E.
    why: No model can beat the entropy of the text.
```

```quiz
q: "If α = β in L(N, D) = E + A/N^α + B/D^β, how should N and D grow when the budget is multiplied by 4?"
options:
  - text: "Both double."
    correct: true
    why: N_opt ∝ C^(β/(α+β)) = C^0.5, and likewise D.
  - text: N grows 4 times and D stays the same.
    why: That ignores the data term entirely.
  - text: Both grow 4 times.
    why: Then compute would grow 16 times, since C ∝ ND.
```

```quiz
q: "Why are models like Llama 3 8B trained on far more than 20 tokens per parameter?"
options:
  - text: "Once inference is counted, a smaller model trained longer is cheaper overall for the same loss."
    correct: true
    why: Every generated token costs about 2N FLOPs, for the whole life of the model.
  - text: The Chinchilla law was shown to be wrong.
    why: It describes training cost; the choice changes when inference cost is added.
  - text: Larger datasets are cheaper than larger models to train.
    why: Training compute is about 6ND either way.
```

```quiz
q: "Why might an ability appear to emerge suddenly at some model size while the loss improves smoothly?"
options:
  - text: "An all-or-nothing metric, like exact match on a multi-digit answer, stays at zero until every part is right, hiding gradual progress."
    correct: true
    why: With a continuous metric, the same improvement usually looks smooth.
  - text: Large models use a different architecture.
    why: The models in these studies share their architecture across sizes.
  - text: Loss stops being a power law at large scale.
    why: The loss curves stay smooth; the metric is what jumps.
```

## Further reading

- Jared Kaplan and colleagues, *Scaling Laws for Neural Language Models* :cite[kaplan2020].
- Jordan Hoffmann and colleagues, *Training Compute-Optimal Large Language Models* :cite[hoffmann2022], and the replication by Tamay Besiroglu and colleagues :cite[besiroglu2024].
- Tim Pearce and Jinyeop Song, *Reconciling Kaplan and Chinchilla Scaling Laws* :cite[pearce2024].
- Nikhil Sardana and colleagues, *Beyond Chinchilla-Optimal* :cite[sardana2024].
- Rylan Schaeffer, Brando Miranda and Sanmi Koyejo, *Are Emergent Abilities of Large Language Models a Mirage?* :cite[schaeffer2023].
