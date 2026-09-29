---
number: D
title: Statistics
summary: How to learn from data and say how sure you are — estimators and their bias and variance, standard errors, confidence intervals, the bootstrap, paired comparisons and hypothesis tests, fitting power laws, and the bias–variance trade-off in models. The tools behind every error bar in Part V.
duration: About 1 hour
---

Probability (Appendix C) starts from a known distribution and asks what data it will produce. Statistics goes the other way: from data to the distribution, or to some number describing it, with an honest account of how uncertain the answer is. Every measured widget in this course is a statistical claim — this model’s loss is 2.005 bits per token, that one’s accuracy is 97.4% — and each is only as meaningful as its uncertainty. Wasserman’s *All of Statistics* covers everything here and more, quickly :cite[wasserman2004].

## Estimators

An **estimator** is a rule that turns data into a guess of an unknown quantity. The average loss over validation tokens estimates the expected loss over all text of that kind; the fraction of benchmark items answered correctly estimates the accuracy on all such items. Because the data are random, the estimate is random too, and two properties describe how good it is:

- **Bias**: the difference between the estimator’s average value and the truth. The sample mean is unbiased. The sample variance with divisor $n$ is biased low, because the deviations are measured from the sample’s own mean, which is closer to the data than the true mean; dividing by $n - 1$ instead removes the bias.
- **Variance**: how much the estimate changes from one sample of data to another. Its square root is the **standard error**.

For an average of $n$ independent observations with standard deviation $\sigma$, the standard error is $\sigma/\sqrt n$ (Appendix C). For an accuracy $p$ measured on $n$ items it is $\sqrt{p(1-p)/n}$. The square root is the most important fact in empirical machine learning: to halve an error bar, you need four times as much data.

Observations are often not independent. Tokens in the same document are correlated — a model that misunderstands a story’s premise gets many of its tokens wrong — so the effective number of independent observations is smaller than the number of tokens, and error bars computed per token are too narrow. Grouping by document (computing each document’s loss, then the standard error across documents) gives more honest ones.

## Confidence intervals

A **95% confidence interval** is a range computed from the data by a procedure that, over many repetitions of the experiment, contains the true value 95% of the time. It is a statement about the procedure, not about this particular interval. The usual one, estimate ± 1.96 standard errors, relies on the central limit theorem, and is accurate when $n$ is large and the estimate is not close to a boundary. For accuracies near 0 or 1 with few items it is too narrow; the **Wilson interval** :cite[wilson1927], which solves for the range of $p$ consistent with the observation rather than plugging in the observed value, behaves much better.

::interval-coverage

## The bootstrap

For a mean, the formula is easy. For a median, a ratio, a difference in ranks or a fitted exponent, it is not. The **bootstrap** :cite[efron1979] replaces the formula with computation: treat the observed data as the population, draw a new sample of the same size from them *with replacement*, recompute the statistic, and repeat a few thousand times. The spread of the recomputed values estimates the statistic’s sampling distribution, and its 2.5th and 97.5th percentiles give a 95% interval. Chapter 25 used it for benchmark scores.

::bootstrap-demo

The bootstrap assumes the observations are independent draws. With correlated data, resample whole groups — documents rather than tokens, prompts rather than samples — which is the **cluster bootstrap**.

## Comparing two models

To decide whether model A is better than model B, measure both on the **same** items and analyse the per-item differences. Items vary in difficulty far more than models differ, and pairing cancels that variation: the standard error of the mean difference is typically much smaller than either model’s own. Chapter 25’s paired interval did exactly this.

A **hypothesis test** turns the comparison into a yes-or-no decision. Suppose the models were equally good (the **null hypothesis**); the **p-value** is the probability of a difference at least as large as the one observed. If it is below a threshold, conventionally 0.05, the difference is called **significant**. A p-value is not the probability that the models are equal, and “not significant” does not mean “no difference”: with few items, real differences are undetectable. Reporting an interval says more than a p-value, because it shows the size of the effect and the uncertainty together. Dror and colleagues surveyed which tests suit which natural-language-processing metrics :cite[dror2018].

Two common mistakes:

- **Multiple comparisons.** Compare twenty variants against a baseline at the 5% level and, even if none helps, you expect one to look significant. Either correct the threshold (Bonferroni: divide it by the number of comparisons) or confirm the winner on fresh data.
- **Seed variation.** A training run is itself random: initialisation, data order and dropout vary. The difference between two runs with different seeds is noise that no number of test items removes. Chapter 18 measured it for our models (0.008 bits per token), and Bouthillier and colleagues showed that ignoring it makes many published improvements indistinguishable from chance :cite[bouthillier2021].

## Fitting curves

Scaling laws (Chapter 17) are fitted curves. A power law $y = a x^{-b}$ is a straight line in logarithms, $\log y = \log a - b \log x$, so ordinary **least squares** on the logarithms estimates the exponent. Least squares is maximum likelihood (Appendix C) under Gaussian noise; on log scales, that means multiplicative noise, which suits losses measured with a relative error.

::power-law-fit

Two cautions. A law with an irreducible floor, $y = E + a x^{-b}$, is not linear in logarithms; it needs non-linear least squares, and the floor $E$ is often hard to pin down, which is why Chapter 17’s fits disagree about it. And fitted curves are most uncertain exactly where they are most interesting: beyond the data. An error of $\delta$ in an exponent becomes a factor of $100^\delta$ when predicting a hundred times further out. The bootstrap — refitting to resampled points — is the simplest way to see how much a prediction can be trusted.

## Bias and variance in models

The same two words describe models. Fit a model to a finite training set and its predictions on new data err for two reasons: **bias**, because the model family cannot represent the truth (a bigram model cannot track a character’s name through a story), and **variance**, because the fitted parameters depend on which training examples happened to be drawn. For squared error the decomposition is exact: expected error = bias² + variance + irreducible noise :cite[hastie2009]. Classically, bigger models have less bias and more variance, so there is a best size for a given amount of data, and overfitting is the variance winning (Chapter 2’s unsmoothed n-grams; Chapter 12’s train–validation gap).

Neural networks complicate this picture. Heavily over-parameterised networks trained to fit their training data perfectly often generalise well, and test error can fall again past the point where the model can interpolate the data — **double descent** :cite[belkin2019]. Language models mostly sidestep the question: trained for a single pass over more data than they can memorise, they are limited by bias rather than variance, which is why their loss keeps falling as they grow (Chapter 17).

## Further reading

- Larry Wasserman, *All of Statistics* :cite[wasserman2004].
- Trevor Hastie, Robert Tibshirani and Jerome Friedman, *The Elements of Statistical Learning* :cite[hastie2009].
- Bradley Efron, *Bootstrap Methods* :cite[efron1979].
- Xavier Bouthillier and colleagues, *Accounting for Variance in Machine Learning Benchmarks* :cite[bouthillier2021].
