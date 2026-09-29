---
number: 25
title: Evaluation
summary: How do we know a model is better? We build a small benchmark from TinyStories and score every model of the book on it; put error bars on the scores; check whether CourseGPT’s confidence means anything; contaminate a model on purpose to watch a score lie; and survey how frontier models are evaluated — benchmarks, human preferences and models judging models.
duration: About 1½ hours
prerequisites: [scaling-laws, preference-learning]
builds:
  - A likelihood-scored benchmark
  - Confidence intervals for scores
  - Calibration error
---

Every chapter of this book has measured something: bits per token, accuracy on held-out problems, how often a story uses the required words. Those measurements were easy to trust because we controlled everything — the data, the model, the test set, and what counted as right. Evaluating a general-purpose model is harder. There is no single number for “good at language”, the test sets are public and leak into training data, small differences are noise, and for most of what people ask assistants there is no right answer to compare with.

This chapter goes through the problems one at a time, on a benchmark small enough to build and run in minutes.

## A benchmark from stories

Our test is modelled on the Story Cloze Test :cite[mostafazadeh2016] and HellaSwag :cite[zellers2019]: given the start of a story, which of four candidates is the next sentence? One candidate is the true sentence; the other three are sentences from other stories. We built 1,000 items from TinyStories’ validation set, which none of our models trained on.

A language model does not answer multiple-choice questions; it assigns probabilities. The standard way to score it is to compute the log-probability of each candidate given the context and pick the highest. There is a choice to make: total log-probability favours short candidates (every extra token multiplies in another probability below 1), while the average per token removes that bias but can favour long, predictable candidates. Evaluation suites report both, and they can disagree.

::exercise{id="choice-score"}

::eval-results{view="benchmark"}

Accuracy follows validation loss almost perfectly. The smallest model, 2 layers of width 128, picks the right sentence 64% of the time; CourseGPT, 90.5%. The 10 × 640 model is the largest after CourseGPT, yet it scores below the 2 × 256 draft model, because Chapter 17 trained it on too few tokens for its size and its loss is worse: the benchmark measures what a model learned, not how big it is. Instruction tuning (Chapter 20) cost CourseGPT nothing here. And the scoring rule matters as much as the model: averaging per token instead of summing raises every model’s accuracy, by 6 points for CourseGPT and 19 for the smallest model: a total favours short candidates, and a short sentence from another story can outscore a longer true one. A score is always the score of a model *under a protocol*.

## How sure is a score?

A benchmark score is an estimate. The 1,000 items are a sample from all the items one could have written, and a different sample would give a different score. If each item is right with probability $p$, the number right is binomial, and the standard error of the accuracy is

:::equation{#standard-error caption="The standard error of an accuracy p measured on n independent items."}
$$
\mathrm{SE} \;=\; \sqrt{\frac{p\,(1-p)}{n}}
$$
:::

At $p = 0.7$ and $n = 1{,}000$ that is 1.4 points, so a 95% interval is about ±2.8 points. Halving it needs four times the items. Appendix D derives this and the alternatives: the **bootstrap** :cite[efron1979], which resamples the items with replacement and recomputes the score many times, needs no formula and works for any statistic, and **paired** comparisons, which compare two models on the same items and cancel out the variation due to which items happen to be hard. Miller’s guide to error bars for language-model evaluations makes the case that most published comparisons should report them :cite[miller2024].

::exercise{id="intervals"}

::benchmark-noise

A leaderboard that ranks models by differences of one or two points on a few hundred items is ranking noise. The fix is cheap — report intervals, use paired comparisons, use more items — and still unusual.

## Calibration

A model’s probabilities carry more information than its choices. A model is **calibrated** if, among the predictions it makes with 70% confidence, 70% are right. Plotting accuracy against confidence gives a **reliability diagram**, and the weighted average gap between the two is the **expected calibration error** (ECE). Guo and colleagues found that modern image classifiers were badly overconfident :cite[guo2017]. Pre-trained language models, by contrast, are usually well calibrated on next-token prediction, because the training loss — cross-entropy — is minimised by exactly calibrated probabilities. Kadavath and colleagues found large models also well calibrated on multiple-choice questions, and able to estimate whether they knew an answer; RLHF made the calibration worse :cite[kadavath2022].

::exercise{id="ece"}

::eval-results{view="calibration"}

CourseGPT is well calibrated. When its most likely next token has probability around 0.5, that token is right 53% of the time; when it has probability above 0.9, it is right 97% of the time; the expected calibration error over 262,000 validation tokens is 0.016. Where it errs, it is very slightly overconfident. That is what training on cross-entropy produces: the loss is minimised only by probabilities that match frequencies.

The benchmark choice is another matter. Turning the four candidates’ total log-probabilities into a distribution (a softmax over the four) gives CourseGPT an average confidence of 98% in its pick, for an accuracy of 90.5%: an ECE of 0.08. Nothing trained those numbers to be probabilities of being right. A sentence’s probability multiplies many token probabilities, so small per-token preferences compound into near-certainty. Calibration is a property of a model *and* a way of reading it, and only the next-token reading was trained.

## Contamination

Benchmarks are published on the internet, and language models are trained on the internet. If test items are in the training data, a model can score well by remembering them. This is **contamination**, and it is hard to rule out: training sets are enormous and often secret, and items can appear rephrased, translated or with their answers discussed on a forum :cite[sainz2023]. To see what it does, we contaminated CourseGPT on purpose: we continued its training for a few steps on the 1,000 test stories, as if they had leaked into its data, and scored it on those items and on 1,000 fresh ones built the same way.

::eval-results{view="contamination"}

Sixty steps — about one pass over the leaked stories — raised CourseGPT’s score on the test items from 90.5% to 94.7%, while its score on fresh items did not move (88.4% before, 88.0% after). A four-point gain that is pure memorisation, from a model that saw the test set once among a billion tokens of training; the model did not become any better at stories. (The two item sets started two points apart by chance, within the ±2-point noise of 1,000 items.)

Defences exist but none is complete: search the training data for overlapping n-grams, keep test sets private, write new questions after the model’s training cut-off, and compare the score on a benchmark with the score on a freshly written copy of it.

## Evaluating assistants

Our benchmark has exact answers, as do the most-cited benchmarks for frontier models: MMLU’s 14,000 exam questions in 57 subjects :cite[hendrycks2021], mathematics problems with numerical answers, programming problems with unit tests, and software-engineering tasks checked by a repository’s tests :cite[jimenez2024]. Each saturates within a few years, as models approach the ceiling set by the benchmark’s own errors, and is replaced by a harder one. HELM argued for measuring many things at once — accuracy, calibration, robustness, bias, efficiency — rather than a single number :cite[liang2022helm].

Most of what people ask an assistant has no single right answer. Before language models, text generation was scored by overlap with reference texts — BLEU for translation :cite[papineni2002] — which rewards the reference’s wording rather than quality. Two approaches replaced it:

- **Human preferences.** Show people two anonymous answers to their own question and ask which is better. Chatbot Arena collected millions of such votes and ranks models by fitting the Bradley–Terry model of Chapter 21 to them :cite[chiang2024arena]. It measures what people prefer, which is not always what is correct: longer, more confident, better-formatted answers win votes.
- **LLM judges.** Ask a strong model to grade answers or compare pairs. Zheng and colleagues found that GPT-4’s judgements agreed with human experts about as often as experts agreed with each other, and documented its biases: towards the first answer shown, towards longer answers, and towards its own :cite[zheng2023judge]. Controlling for length changed rankings noticeably :cite[dubois2024].

Every one of these measures can be optimised against, and Chapter 21’s Goodhart’s law applies to all of them: a model tuned to win a leaderboard learns what the leaderboard rewards.

:::history{year=2016 title="The Story Cloze Test" people="Nasrin Mostafazadeh, Nathanael Chambers, Xiaodong He, Devi Parikh, Dhruv Batra, Lucy Vanderwende, Pushmeet Kohli and James Allen"}
Mostafazadeh and colleagues collected 50,000 five-sentence everyday stories written by crowd workers, and for the test set asked other workers to write a right and a wrong ending for each four-sentence start :cite[mostafazadeh2016]. Humans scored 100%, the best systems of 2016 about 60%. Within a year, a system reached 72% by looking only at the endings — the wrong ones, written to be wrong, had a recognisable style. HellaSwag (2019) answered this with **adversarial filtering**: wrong endings were generated by a language model and kept only if a classifier found them hard to tell from the real ones :cite[zellers2019]. It was hard for models of 2019 and was essentially solved by GPT-4 four years later — the life cycle of a benchmark.
:::

:::breakit
- Replace the three distractors with sentences from the *same* story. How much harder does the benchmark become, and which models suffer most?
- Score the benchmark on only 100 items. Do the models still come out in the same order?
- Evaluate the instruction-tuned model with the instruction format of Chapter 20 wrapped around the context. Does the score change?
:::

## Lab: evaluation in PyTorch

```sh
uv run lmc ch25 benchmark     # every model on the 1,000 items, with bootstrap intervals (about 5 minutes)
uv run lmc ch25 calibration   # CourseGPT's next-token reliability diagram
uv run lmc ch25 contaminate   # train on the test stories, then score again
```

`option_logprobs` in `lmcourse/ch25.py` runs the four candidates as one batch, with the context repeated, and sums the log-probabilities of each candidate’s tokens; `bootstrap` resamples the per-item results.

:::exercises
1. **Harder distractors.** Generate the distractors with CourseGPT itself (sample a next sentence) and keep only those it scores above the true sentence’s. How low can you push its accuracy, and how does the 2 × 256 model do on the result?
2. **Scaling curve.** Plot accuracy against validation bits per token for the models of the book. Is the relationship smooth?
3. **Temperature scaling.** Find the temperature that minimises the benchmark choice ECE on half the items, and check it on the other half.
4. **Detection.** For the contaminated model, compare the loss on the test stories with the loss on fresh stories. How small can the contamination be and still be detectable this way?
:::

:::challenge
1. **A judge.** Use a larger open model as a judge of pairs of CourseGPT stories for the same prompt. Measure its position bias by swapping the order of every pair.
2. **An arena for the book.** Collect your own preferences between stories from the draft model, CourseGPT and the instruction-tuned model, and fit Bradley–Terry ratings with confidence intervals.
3. **Error bars everywhere.** Go back through the measured widgets of Chapters 17–22 and estimate which differences would survive a second seed.
:::

## Check your understanding

```quiz
q: "A model scores 62% on 400 items. Roughly what is its 95% interval?"
options:
  - text: "About ±4.8 points: 1.96 × √(0.62 × 0.38 / 400) ≈ 0.048"
    correct: true
    why: The standard error is about 2.4 points.
  - text: "About ±0.5 points"
    why: That would need about 40,000 items.
  - text: "It has no uncertainty: every item was scored"
    why: The items are a sample of the questions one could ask; another sample would give another score.
```

```quiz
q: "Why are pre-trained language models usually well calibrated on next-token prediction?"
options:
  - text: "Cross-entropy is a proper scoring rule: it is minimised by predicting the true probabilities."
    correct: true
    why: Training directly rewards calibrated probabilities.
  - text: Because they are small.
    why: Large models are well calibrated too; fine-tuning with RLHF is what tends to break it.
  - text: Because softmax outputs always sum to 1.
    why: Any distribution sums to 1; calibration is about whether its values match frequencies.
```

```quiz
q: "A model scores much higher on a benchmark's public test set than on a newly written set of similar questions. What is the most likely explanation?"
options:
  - text: "Contamination: the public items, or close copies, were in its training data."
    correct: true
    why: A real ability would transfer to new items of the same kind.
  - text: The new questions are harder by chance.
    why: That is possible for a small set, and is why the comparison needs error bars; but a large gap points to contamination.
  - text: The model is overconfident.
    why: Calibration does not change which answer the model picks.
```

## Further reading

- Dan Hendrycks and colleagues, *Measuring Massive Multitask Language Understanding* :cite[hendrycks2021].
- Lianmin Zheng and colleagues, *Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena* :cite[zheng2023judge].
- Evan Miller, *Adding Error Bars to Evals* :cite[miller2024].
- Percy Liang and colleagues, *Holistic Evaluation of Language Models* :cite[liang2022helm].
