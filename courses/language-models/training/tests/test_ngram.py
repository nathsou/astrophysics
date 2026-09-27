import math
import random

from lmcourse.ngram import NGramModel, NGramStats, Smoothing, cross_entropy_bits

rng = random.Random(3)
IDS = [min(4, int(rng.random() ** 2 * 5)) for _ in range(1500)]


def test_distributions_sum_to_one():
    stats = NGramStats(IDS, 5, 4)
    for s in [Smoothing("mle"), Smoothing("addk", k=0.3), Smoothing("interp", lam=0.7), Smoothing("kn", d=0.75)]:
        m = NGramModel(stats, 4, s)
        for ctx in [[], [0], [4, 4], [1, 2, 3], [3, 3, 3, 3]]:
            assert math.isclose(sum(m.prob(ctx, w) for w in range(5)), 1.0, rel_tol=1e-12)


def test_kneser_ney_bigram_by_hand():
    # a b a c a b: P(b|a) = 1.5/3 + (0.5·2/3)·P(b), with the unigram level itself KN-discounted.
    stats = NGramStats([0, 1, 0, 2, 0, 1], 3, 2)
    m = NGramModel(stats, 2, Smoothing("kn", d=0.5))
    # Unigram level (continuation counts a:2, b:1, c:1 over 4 types), discounted and mixed with uniform.
    p_uni = {w: max(c - 0.5, 0) / 4 + (0.5 * 3 / 4) / 3 for w, c in {0: 2, 1: 1, 2: 1}.items()}
    assert math.isclose(m.prob([0], 1), 1.5 / 3 + (0.5 * 2 / 3) * p_uni[1], rel_tol=1e-12)


def test_uniform_cross_entropy():
    stats = NGramStats([0, 1, 2, 3] * 10, 4, 1)
    m = NGramModel(stats, 1, Smoothing("mle"))
    assert math.isclose(cross_entropy_bits(m, [0, 1, 2, 3], 0), 2.0)
