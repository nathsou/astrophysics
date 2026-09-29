---
number: 22
title: Reasoning models
summary: A transformer does a fixed amount of computation per token. Letting it write intermediate steps — a chain of thought — gives it more. We train a small model to add six-digit numbers with and without a scratchpad, spend compute at test time by sampling many answers, and use reinforcement learning with a verifiable reward, GRPO, to improve it from its own attempts.
duration: About 1½ hours
prerequisites: [preference-learning, sampling]
builds:
  - A scratchpad format and its effect on accuracy
  - Majority voting and pass@k
  - GRPO from scratch
---

A transformer computes each token with the same fixed amount of work: one pass through its layers. CourseGPT has 8 layers; whatever it needs to work out before writing the next token must fit in those 8 steps of computation, however hard the question. People do not answer hard questions that way. We write down intermediate results, and each one makes the next step easy.

A language model can do the same, because everything it writes becomes part of its input. Asking it to show its working — a **chain of thought** — turns one hard prediction into many easy ones, and gives the model as many forward passes as it has tokens to write. Wei and colleagues found in 2022 that simply including worked examples with reasoning in the prompt raised a large model’s accuracy on grade-school maths problems from 18% to 57% :cite[wei2022cot]; Kojima and colleagues found that appending “Let’s think step by step” was nearly as good :cite[kojima2022]. The reasoning models of 2024 and 2025 are trained to produce long chains of thought before answering, and to use them well :cite[openai2024o1] :cite[deepseek2025r1].

This chapter studies the idea on a task small enough to train from scratch in minutes: adding two six-digit numbers.

## Addition, directly and on a scratchpad

The task is exact. The model reads `348105+920377=` and must write `1268482`. We train a 4-layer GPT of width 256 on random problems — there are $10^{12}$ of them, so it never sees a test problem during training — with the loss only on what follows the `=`, since the operands are random and cannot be predicted.

The difficulty is the order of the digits. The model must write the leading digit first, and whether it is a 1 depends on a carry that can ripple from the rightmost column through all the others. To write it correctly the model must, in effect, perform the whole addition within its 4 layers before writing anything.

The alternative is a **scratchpad** :cite[nye2021]: the model writes each column’s sum, from the right, with the carry it has just computed, and only then the answer.

```
348105+920377=5+7+0=12,0+7+1=8,1+3+0=4,8+0+0=8,4+2+0=6,3+9+0=12>1268482
```

Each step is now a small local computation: two digits from the problem, a carry from the previous step. The answer after `>` is a matter of copying the last digit of each step, in reverse.

::exercise{id="scratchpad"}

::carry-chain

We trained one model on each format, with the same architecture, optimiser, and 3,000 steps of 256 problems.

::reasoning-results{view="train"}

The scratchpad model learned faster and went further. After 250 steps it already answered 77% of held-out problems correctly, while the direct model had not got a single one right; after 3,000 steps the scratchpad model reached 97.4% and the direct model 85.8%. Each took about four and a half minutes to train. Both models have the same four layers; what differs is how many steps of computation they are allowed before committing to the answer.

The comparison is not free for the scratchpad. It writes about seven times as many tokens per answer, so it spends seven times as much computation at test time. That is the point: the scratchpad is a way of **spending more compute on the answer**, and the model can use the extra forward passes because each of them can build on what the previous ones wrote down. Lee and colleagues studied exactly this setting — small transformers trained on arithmetic — and found that the format of the data mattered more than the size of the model :cite[lee2024arith].

## Test-time compute: sampling many answers

A second way to spend more compute at test time needs no change to the model at all: sample several answers and combine them. If the model is right more often than it is wrong in any particular way, the most common answer among many samples is more likely to be right than any single one. This is **self-consistency** :cite[wang2023selfconsistency], or majority voting. With chain-of-thought reasoning it works particularly well, since different chains of reasoning that reach the same answer are evidence for it.

If we can check answers — run unit tests on code, verify a proof, compare an arithmetic result with a calculator — we can do better still: keep any correct sample. The fraction of problems solved by at least one of $k$ samples is **pass@k**, introduced to evaluate code models :cite[chen2021codex]. It is an upper bound on what any way of picking among the $k$ samples could achieve.

::exercise{id="majority-vote"}

::vote-simulator

Voting has a trap, visible in the simulator: it amplifies the model’s single most likely answer, right or wrong. When a model has a systematic misconception, more votes make it more confidently wrong.

::reasoning-results{view="vote"}

Voting did almost nothing for our trained models. Sampled at temperature 1, the direct model’s single answers were right 83% of the time, and the majority of 32 samples 83.5% — no better than greedy decoding (84%). Its mistakes are systematic: on the problems it gets wrong, it gets them wrong the same way every time, so more votes only confirm the error. pass@32 reached just 86%.

The under-trained direct model shows the other side. A single sample at temperature 1 was right only 46% of the time; the majority of 32 samples recovered 70%, the accuracy of greedy decoding, because a majority of samples approximates the model’s most likely answer. But at least one of 32 samples was right for 79% of problems. The right answer is often in the model’s distribution, just not at the top of it. That gap between voting and pass@k is what a verifier — or training on verified answers — can exploit.

Snell and colleagues studied how best to spend a fixed test-time budget — more samples, longer reasoning, search guided by a verifier — and found that for questions within a model’s reach, optimally spent test-time compute can substitute for a model 14 times larger :cite[snell2024]. Learned verifiers that score each step of a solution, **process reward models**, made the search more effective still :cite[lightman2023].

## Learning from verifiable rewards

pass@k is much higher than accuracy: the model can often find the right answer, just not reliably. That suggests a way to improve it using only its own outputs. Sample several answers, check which are right, and adjust the model to make the right ones more likely. No human labels and no reward model are needed — only a way to check answers, a **verifiable reward**.

This is reinforcement learning, and the tool is the **policy gradient** that Chapter 21 mentioned for RLHF. The model is the **policy**; a sampled answer $y$ to a prompt $x$ earns a reward $r(x, y)$; and the gradient of the expected reward is

:::equation{#policy-gradient caption="The policy gradient (REINFORCE): raise the log-probability of answers in proportion to how much better than expected they did."}
$$
\nabla_\theta\, \mathbb E_{y \sim \pi_\theta}\big[r(x, y)\big] \;=\; \mathbb E_{y \sim \pi_\theta}\Big[\, \big(\term{r}{r(x, y)} - \term{b}{b(x)}\big)\; \nabla_\theta \log \pi_\theta(y \mid x) \,\Big]
$$
:::

```terms
r:
  label: "$r(x, y)$ — the reward"
  what: Here 1 if the answer is correct and 0 otherwise.
b:
  label: "$b(x)$ — the baseline"
  what: Any quantity that does not depend on the sampled answer. It leaves the expected gradient unchanged but reduces its variance, so the updates are less noisy.
  effect: With a good baseline, answers better than expected are pushed up and worse ones pushed down; without one, every correct answer is pushed up by the same amount, whether it was easy or hard.
```

Williams derived this estimator, REINFORCE, in 1992 :cite[williams1992]. PPO, used for RLHF in Chapter 21, learns the baseline with a second network, a value model as large as the policy. **GRPO** (Group Relative Policy Optimisation) :cite[shao2024] does without it: it samples a group of answers to each prompt and uses the group itself as the baseline. Each answer’s **advantage** is its reward minus the group’s mean reward, divided by the group’s standard deviation.

::exercise{id="group-advantage"}

A group that is all right or all wrong has zero advantages and teaches nothing: GRPO learns from problems at the edge of the model’s ability, where some attempts succeed and some fail. As in RLHF, a KL penalty keeps the policy close to where it started. DeepSeek trained R1 with GRPO on mathematics and programming problems with checkable answers, and reported that long chains of thought, including checking and backtracking, emerged from this reward alone :cite[deepseek2025r1].

## Measured: GRPO on addition

We took a direct-answer model trained for only 750 steps, which gets some problems right and many wrong, and ran GRPO: 900 steps, each sampling 8 answers at temperature 1 for each of 32 new problems, with a reward of 1 for a correct answer, a KL penalty of $\beta = 0.02$ and a learning rate of $2 \times 10^{-5}$.

::reasoning-results{view="grpo"}

GRPO did what its reward asked, and little else. A single sample at temperature 1 was right 50% of the time before training and 63% after: the model learned to put more of its probability on answers that check out. Greedy accuracy rose only from 72.5% to 75.6%, and pass@8 — whether *any* of eight samples is right — from 77.4% to 78.4%. Reinforcement learning sharpened the distribution towards the answers the model could already find; it barely extended the set of problems it could solve. Yue and colleagues found the same in large reasoning models: trained with verifiable rewards, they beat their base models at pass@1, but for large $k$ the base models’ pass@k was as high or higher :cite[yue2025]. Where RL has produced new abilities — longer, self-correcting chains of thought — it has worked on models large enough to have the pieces already, and with a format, like the scratchpad, that gives extra computation somewhere to go.

The method is also fragile. At learning rates of $10^{-4}$ and above, our model’s accuracy fell instead of rising, and at $3 \times 10^{-4}$ it collapsed to almost zero within a hundred steps: once no sample in a group is right, every advantage is zero and nothing pulls the model back.

:::history{year=2025 title="DeepSeek-R1" people="DeepSeek-AI"}
In September 2024 OpenAI released o1, a model trained with reinforcement learning to reason at length before answering, and reported that its accuracy kept improving with both more training compute and more thinking time :cite[openai2024o1]. It did not say how. In January 2025 DeepSeek published R1 with its weights and a description of its training :cite[deepseek2025r1]. Its precursor, R1-Zero, had been trained with GRPO directly from the base model, with a reward only for correct final answers and the right format. Over training its answers grew from hundreds to thousands of tokens, and it began, unprompted, to re-examine its own steps — the paper quotes it writing “Wait, wait. Wait. That’s an aha moment I can flag here.” The simplicity of the recipe prompted a wave of replications, many on small models and single GPUs.
:::

:::breakit
- Train the scratchpad model with the steps written from the *left* (most significant column first). Does it still help?
- Remove the carry from each step (`5+7=12` rather than `5+7+0=12`). The model now has to find the carry in the previous step. How much does accuracy fall?
- Run GRPO without the KL penalty ($\beta = 0$). Does accuracy on the test set change? What happens to the model’s diversity (pass@8)?
- Run GRPO with a group of 2. How often is a group all right or all wrong, and how much slower is learning?
:::

## Lab: reasoning in PyTorch

```sh
uv run lmc ch22 train    # direct, scratchpad, and an under-trained direct model (about 10 minutes)
uv run lmc ch22 vote     # majority voting and pass@k with up to 32 samples
uv run lmc ch22 grpo     # GRPO on the under-trained model (about 15 minutes)
```

`grpo` in `lmcourse/ch22.py` is about 40 lines. The one subtlety is recomputing log-probabilities: the answers are sampled without gradients, then the whole batch of prompts and answers is run forward again with gradients, and the per-token loss $-A \log \pi$ plus the KL penalty is averaged over answer tokens only.

:::exercises
1. **Length generalisation.** Test both models on 7-digit problems (padding with zeros is not allowed). Which generalises, and why?
2. **Self-consistency with a scratchpad.** Voting on the scratchpad model compares final answers from different chains. How often do chains that disagree on some step still agree on the answer?
3. **Best-of-n with a verifier.** Train a small classifier to predict whether a scratchpad is correct from its text alone, and use it to choose among 8 samples. How close does it get to pass@8?
4. **GRPO on the scratchpad.** Start GRPO from a scratchpad model trained for 300 steps. Does the reward teach the model to reason more accurately, or only to get the final digits right?
:::

:::challenge
1. **Emergent length.** Give the model a scratchpad format it was never trained on (say, a few extra `,` tokens allowed before the answer), reward only correct answers, and see whether GRPO learns to use the extra tokens.
2. **Multiplication.** Repeat the chapter for 3-digit × 3-digit multiplication. Design a scratchpad; how much bigger does the direct model need to be to match it?
3. **Process rewards.** Reward each correct step of the scratchpad instead of only the final answer. Does learning speed up?
:::

## Check your understanding

```quiz
q: "Why does a scratchpad help a transformer add long numbers?"
options:
  - text: "Each token gets its own forward pass, so writing intermediate carries spreads the computation over many passes, each of them simple."
    correct: true
    why: The fixed depth per token limits what can be computed before the first answer digit; written steps lift the limit.
  - text: The scratchpad tokens are easier to predict, lowering the average loss.
    why: The average loss is not what we measure; exact accuracy of the answer is.
  - text: The model sees more training data.
    why: Both models see the same problems; the scratchpad only changes what is written.
```

```quiz
q: "A model answers a question correctly 30% of the time, and gives one particular wrong answer 45% of the time. What does majority voting over many samples do?"
options:
  - text: "It converges on the wrong answer: voting picks the single most likely answer."
    correct: true
    why: Voting amplifies whatever answer is most probable, right or wrong.
  - text: It converges on the right answer, since errors cancel out.
    why: Errors cancel only when they are spread over many different wrong answers.
  - text: Its accuracy stays at 30%.
    why: Voting changes the accuracy; here it drives it towards 0.
```

```quiz
q: "In GRPO, what is the advantage of every answer in a group where all 8 answers are correct?"
options:
  - text: "Zero: each reward equals the group mean, so the group gives no learning signal."
    correct: true
    why: GRPO learns only from groups with a mix of successes and failures.
  - text: Positive, since every answer was right.
    why: The advantage compares each answer with the group, not with zero.
  - text: Undefined, because the standard deviation is zero.
    why: The ε in the denominator keeps it defined; the numerator is zero.
```

## Further reading

- Jason Wei and colleagues, *Chain-of-Thought Prompting Elicits Reasoning in Large Language Models* :cite[wei2022cot].
- Xuezhi Wang and colleagues, *Self-Consistency Improves Chain of Thought Reasoning* :cite[wang2023selfconsistency].
- Zhihong Shao and colleagues, *DeepSeekMath* (where GRPO was introduced) :cite[shao2024].
- DeepSeek-AI, *DeepSeek-R1* :cite[deepseek2025r1].
- Charlie Snell and colleagues, *Scaling LLM Test-Time Compute Optimally* :cite[snell2024].
