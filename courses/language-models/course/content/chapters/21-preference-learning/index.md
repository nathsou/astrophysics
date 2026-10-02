---
number: 21
title: Preference learning
summary: Supervised fine-tuning imitates examples, but often it is easier to say which of two answers is better than to write the best one. We learn from such comparisons — a Bradley–Terry reward model, best-of-n sampling, the RLHF objective and Direct Preference Optimisation — on the instruction-following CourseGPT of Chapter 20, and measure what each gains and what it costs.
duration: About 1½ hours
prerequisites: [fine-tuning]
builds:
  - A Bradley–Terry reward model
  - Best-of-n sampling
  - DPO from scratch
---

Supervised fine-tuning teaches a model to imitate. That works when we can write down good responses, and it has a ceiling: the model learns to be about as good as its examples, including their mistakes. For many tasks it is much easier to *judge* than to *write*. Few people can write a good poem to order, but most can say which of two poems they prefer; checking a summary against its source is easier than writing the summary.

**Preference learning** uses such judgements. Show people (or a model) two responses to the same prompt, record which one they prefer, and train the model to produce more responses like the preferred ones. This was the second stage of the recipe that turned GPT-3 into InstructGPT and then ChatGPT :cite[ouyang2022]: supervised fine-tuning, then **reinforcement learning from human feedback** (RLHF) :cite[christiano2017] :cite[stiennon2020].

## Our preferences

Real preferences are noisy, inconsistent and expensive. Ours are none of these, which lets us measure things that are usually unmeasurable. The Chapter 20 model follows instructions of the form “Write a story about Lucy that uses the words: gasped, lesson, candle.” We score a story by how many of the four constraints — the name and the three words — it satisfies, from 0 to 4. For 6,000 instructions not used in Chapter 20, the model wrote two stories each, at temperature 1; the story with the higher score is **chosen**, the other **rejected**, and ties are discarded.

The two stories scored the same for 2,329 of the 6,000 instructions, leaving 3,671 preference pairs. Most differ by one constraint — usually a story that used one required word against one that used two — so the signal is subtle: two stories that read equally well, one of which happens to contain the word “eager” and one that does not.

The methods of this chapter see only the pairs, never the score. Afterwards, we use the score to check what they have learned, and a second measure to check what they have given up: **fluency**, the bits per token of their stories under the original CourseGPT. A model that satisfies the constraints by writing “Lucy gasped lesson candle” scores 4 and reads terribly, and CourseGPT’s surprise measures that.

## A reward from comparisons

A comparison does not give a number. To turn comparisons into a reward, assume each response $y$ has a hidden reward $r(y)$, and that the probability of preferring $y_A$ to $y_B$ depends only on the difference:

:::equation{#bradley-terry caption="The Bradley–Terry model: the probability of a preference is the logistic function of the difference in rewards."}
$$
P(y_A \succ y_B) \;=\; \sigma\big(\term{r}{r(y_A)} - r(y_B)\big) \;=\; \frac{1}{1 + e^{-(r(y_A) - r(y_B))}}
$$
:::

```terms
r:
  label: "$r(y)$ — the reward"
  what: A score for each response. Only differences matter, so adding the same constant to every reward changes nothing.
  effect: A difference of 0 means a coin toss; a difference of 2 means the better response wins 88% of the time; a difference of 5, 99%.
```

Bradley and Terry proposed the model in 1952 for ranking from paired comparisons :cite[bradley1952], and chess’s Elo ratings are the same idea. Fitting it means maximising the likelihood of the observed preferences: minimising $-\log\sigma(r(y_\text{chosen}) - r(y_\text{rejected}))$, averaged over the comparisons.

::exercise{id="bradley-terry"}

::bradley-terry

A **reward model** is a network trained with this loss. Ours is CourseGPT itself — the fine-tuned model of Chapter 20, instruction and story as input — with its output head replaced by a single linear layer that reads the final hidden state at the last token and outputs one number. Starting from a language model means the reward model already understands stories; it only has to learn what makes one better.

::preference-results{view="reward"}

Trained for four passes over the 3,271 training pairs, the reward model ranked 94% of 400 held-out pairs correctly. Our first attempt, one pass at a smaller learning rate, stalled at 55% — barely better than a coin — which is a reminder that a reward model has a real job to do: to score a pair, it must notice which of the instruction’s words appear in each story, a comparison across hundreds of tokens that nothing in its pre-training asked for.

## Best-of-n

The simplest way to use a reward model needs no further training: sample $n$ responses, score each, and return the best. **Best-of-n** (or rejection sampling) is surprisingly strong, and a useful yardstick for the methods that follow. Its cost is at test time — $n$ times the generation — and its effect on the model’s distribution is bounded: choosing the best of $n$ samples moves the distribution by at most $\log n - (n-1)/n$ nats of KL divergence from the original.

:::question
**Predict the selection bias.** Compare selection from 1, 4 and 16 sampled responses. The best reward score cannot decrease when candidates are added, but the quality judged by a person need not improve: selection can exploit errors in the reward model.
:::

::preference-results{view="bestofn"}

Best-of-n with the reward model works: choosing the highest-scoring of 16 stories met all four constraints 20% of the time, against 3% for a single story. Choosing by the true score would have given 30.5%. The reward model is right about 94% of pairs, but the story it ranks first among 16 is often one it overrates.

The gap between the two curves is the reward model’s imperfection, and it widens with $n$. The more candidates we let the reward model choose from, the more likely it is to find one it scores too highly: a candidate that exploits its mistakes. This is **Goodhart’s law** — when a measure becomes a target, it ceases to be a good measure — and Gao and colleagues measured it for reward models: as optimisation against a learned reward increases, the true reward first rises, then falls :cite[gao2023overopt].

## RLHF

Best-of-n improves outputs without changing the model. To change the model, we maximise the reward the model expects to earn, while keeping it close to the SFT model it started from:

:::equation{#rlhf caption="The RLHF objective: reward, minus a penalty for moving away from the reference model."}
$$
\max_{\pi}\;\; \mathbb E_{x,\; y \sim \pi(\cdot \mid x)}\big[\,r(x, y)\,\big] \;-\; \term{beta}{\beta}\; \mathrm{KL}\big(\pi(\cdot \mid x)\,\big\|\,\term{ref}{\pi_\text{ref}}(\cdot \mid x)\big)
$$
:::

```terms
beta:
  label: "$\\beta$ — the KL coefficient"
  what: How much a nat of divergence from the reference costs, in units of reward.
  effect: Small β lets the model move far to chase reward — including into the reward model’s mistakes. Large β keeps it close to the reference.
ref:
  label: "$\\pi_\\text{ref}$ — the reference model"
  what: The SFT model, frozen. The penalty keeps the policy fluent and stops it from drifting into text the reward model has never seen and scores unreliably.
```

The penalty is what keeps the model honest. Without it, the policy would find whatever the reward model scores highest, fluent or not — in our setting, lists of the required words.

Maximising an expectation over the model’s own samples needs reinforcement learning: sample responses, score them, and push up the log-probability of those that scored well. This is the **policy gradient**, which Chapter 22 derives and uses. InstructGPT used PPO :cite[schulman2017], a policy-gradient method that limits how far each update can move the model. It works, but it is a delicate machine: four models in memory (the policy, the reference, the reward model and a value model that estimates expected reward), sampling inside the training loop, and many hyperparameters.

## DPO: the reward model was inside the policy all along

Rafailov and colleagues noticed that the RLHF objective can be solved exactly :cite[rafailov2023]. For a fixed prompt, the distribution that maximises it is the reference distribution reweighted by the exponentiated reward:

:::equation{#rlhf-optimum caption="The optimum of the RLHF objective, where Z(x) normalises the probabilities."}
$$
\pi^*(y \mid x) \;=\; \frac{1}{Z(x)}\; \pi_\text{ref}(y \mid x)\; e^{\,r(x, y)/\beta}
$$
:::

::kl-optimum

Solve it for the reward: $r(x, y) = \beta \log \frac{\pi^*(y \mid x)}{\pi_\text{ref}(y \mid x)} + \beta \log Z(x)$. Every policy defines a reward in this way — its **implicit reward** — and the troublesome $Z(x)$ is the same for both responses to a prompt, so it cancels in the Bradley–Terry difference. Substituting the implicit reward into the reward model’s loss gives a loss on the policy directly:

:::equation{#dpo caption="The DPO loss: the Bradley–Terry loss, with the policy's implicit reward in place of a reward model."}
$$
\mathcal L_\text{DPO} \;=\; -\log \sigma\!\left(\beta \log \frac{\pi_\theta(y_c \mid x)}{\pi_\text{ref}(y_c \mid x)} \;-\; \beta \log \frac{\pi_\theta(y_r \mid x)}{\pi_\text{ref}(y_r \mid x)}\right)
$$
:::

No reward model, no sampling during training, no reinforcement learning: DPO is supervised learning on the preference pairs, with two forward passes per response (policy and reference). It pushes up the chosen response and down the rejected one, relative to the reference, and it pushes hardest on pairs the policy currently gets wrong.

::exercise{id="dpo-loss"}

## Measured: DPO against SFT

We trained DPO from the Chapter 20 model for 400 steps of 16 pairs, with a learning rate of $5 \times 10^{-6}$, at $\beta = 0.1$ and $\beta = 0.5$, then had each model write stories for 200 held-out instructions at temperature 0.7.

::preference-results{view="dpo"}

DPO worked far better than we expected. The Chapter 20 model met all four constraints in 8.5% of its stories; after 400 steps of DPO at $\beta = 0.1$, in 44.5% — five times as often — and the average number of constraints met rose from 2.2 to 3.3 out of 4. At $\beta = 0.5$, which holds the policy closer to the reference, the gains were about half as large (24.5%). Remember that DPO never saw the scoring rule, only which of two stories was preferred.

It was not free. Fluency, measured by the original CourseGPT, went from 1.08 bits per token to 1.25 at $\beta = 0.5$ and 1.54 at $\beta = 0.1$. Part of that is inevitable — the required words are rare by design, and a story that uses them is more surprising to a model of ordinary stories — but part is the policy drifting: the $\beta = 0.1$ samples bend their plots to fit the words (“Tom walked close to the light, and it could see him”). The trade-off between reward and divergence from the reference, controlled by $\beta$, is exactly the one the widget above illustrated.

## Feedback from AI

Human preference data is slow and expensive to collect, and people disagree. **RLAIF** — reinforcement learning from AI feedback — asks a model instead. In Anthropic’s **Constitutional AI**, a model critiques and revises its own responses according to a short list of written principles, and a model compares pairs of responses against those principles to produce preference labels :cite[bai2022constitutional]. Our scoring function is an extreme case: a perfectly reliable judge of a very narrow preference. Real judges are neither.

:::history{year=2017 title="Learning from human preferences" people="Paul Christiano, Jan Leike, Tom Brown, Miljan Martic, Shane Legg and Dario Amodei"}
Christiano and colleagues set out to train agents on tasks with no easily written reward. In one experiment, a simulated robot learned to do a backflip from about 900 comparisons of pairs of short video clips, each a second or two long, judged by a person in under an hour :cite[christiano2017]. The method — fit a reward model to comparisons, then optimise against it with reinforcement learning — was applied to summarisation in 2020 :cite[stiennon2020], and to following instructions in general in InstructGPT, whose 1.3-billion-parameter model was preferred by labellers over the 175-billion-parameter GPT-3 :cite[ouyang2022]. ChatGPT, released in November 2022, was trained the same way.
:::

:::breakit
- Set $\beta = 0.01$ in DPO. What happens to fluency, and what do the stories look like?
- Train the reward model on pairs whose labels are flipped at random 30% of the time. How much does its accuracy suffer, and does best-of-n still help?
- Run best-of-64 with the reward model. Is it better than best-of-16 by the true score?
- Replace the Bradley–Terry loss with a regression onto the true scores (0–4). Is the reward model better? What does that say about the information in a comparison?
:::

## Lab: preference learning in PyTorch

```sh
uv run lmc ch21 pairs     # two stories per instruction from the Chapter 20 model (about 15 minutes)
uv run lmc ch21 reward    # the Bradley–Terry reward model
uv run lmc ch21 bestofn   # best-of-n with the reward model and with the true score
uv run lmc ch21 dpo       # DPO at β = 0.1 and 0.5
```

`dpo` in `lmcourse/ch21.py` computes the summed log-probability of each response’s tokens (the instruction’s are masked out, as in Chapter 20) under the policy and, without gradients, under the frozen reference, then applies the loss above.

:::exercises
1. **Reward model size.** Train the reward model from the 2-layer draft model of Chapter 16 instead. How much accuracy does it lose, and how does best-of-n change?
2. **Length bias.** Longer stories have more chances to use the words. Measure the length of chosen and rejected stories, and of stories before and after DPO. Has DPO learned to write longer?
3. **Iterated DPO.** Sample new pairs from the DPO model, label them, and train again. Does a second round help?
4. **IPO.** Replace $-\log\sigma(\cdot)$ with the squared loss $(\text{margin} - 1/(2\beta))^2$ of identity preference optimisation, which does not push the margin to infinity. Compare fluency.
:::

:::challenge
1. **PPO.** Implement RLHF with PPO against the reward model, with a KL penalty. Compare the reward–KL trade-off with DPO’s at matched KL.
2. **A learned judge.** Replace the exact score with judgements from a larger open model asked which of two stories better follows the instruction. How often does it agree with the exact score?
3. **Overoptimisation.** Train reward models on 500, 2,000 and 6,000 pairs and plot the true score of best-of-n against $\log n - (n-1)/n$ for each, reproducing Gao and colleagues’ curves.
:::

## Check your understanding

```quiz
q: "Under the Bradley–Terry model, response A has reward 3 and B has reward 1. What is P(A ≻ B)?"
options:
  - text: "σ(2) ≈ 0.88"
    correct: true
    why: Only the difference matters, and σ(2) = 1/(1 + e⁻²).
  - text: 0.75, since A has three quarters of the total reward
    why: Bradley–Terry uses the difference of rewards, not their ratio.
  - text: 1, since A has the higher reward
    why: The model allows the worse response to be preferred sometimes.
```

```quiz
q: "Why does best-of-n with a learned reward model fall further behind best-of-n with the true score as n grows?"
options:
  - text: "The more candidates there are, the more likely one of them exploits the reward model's errors and is picked for them."
    correct: true
    why: Optimising harder against an imperfect measure finds its flaws — Goodhart's law.
  - text: The reward model gets less accurate on longer lists.
    why: It scores each candidate independently.
  - text: Sampling more stories lowers their quality.
    why: The samples are the same; only which one is picked differs.
```

```quiz
q: "What does DPO need that RLHF with PPO does not?"
options:
  - text: "Nothing more: it needs less — no separate reward model and no sampling during training."
    correct: true
    why: DPO trains the policy directly on the preference pairs, with the reference model for the log-ratios.
  - text: A value model
    why: PPO uses a value model; DPO does not.
  - text: Human-written responses for every prompt
    why: DPO uses pairs of responses and a preference between them, as RLHF does.
```

## Further reading

- Long Ouyang and colleagues, *Training language models to follow instructions with human feedback* :cite[ouyang2022].
- Rafael Rafailov and colleagues, *Direct Preference Optimization* :cite[rafailov2023].
- Leo Gao and colleagues, *Scaling Laws for Reward Model Overoptimization* :cite[gao2023overopt].
- Yuntao Bai and colleagues, *Constitutional AI* :cite[bai2022constitutional].
