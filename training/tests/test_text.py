import math
import random

from lmcourse.text import entropy, fit_power_law, utf8_encode, vocabulary_growth, words


def test_utf8_matches_builtin():
    rng = random.Random(0)
    for _ in range(200):
        cps = [rng.randrange(0x110000) for _ in range(20)]
        s = "".join(chr(c) for c in cps if not 0xD800 <= c <= 0xDFFF)
        assert utf8_encode(s) == s.encode("utf-8")


def test_words():
    assert words("To be, or not to be: that's the Question.") == [
        "to", "be", "or", "not", "to", "be", "that's", "the", "question",
    ]


def test_entropy():
    assert math.isclose(entropy([1, 1]), 1.0)
    assert math.isclose(entropy([1] * 8), 3.0)
    assert entropy([]) == 0.0
    assert entropy([5, 0]) == 0.0


def test_power_law():
    r = list(range(1, 101))
    fit = fit_power_law(r, [1000 / x**1.1 for x in r])
    assert math.isclose(fit.s, 1.1, rel_tol=1e-9)
    assert math.isclose(fit.C, 1000, rel_tol=1e-9)


def test_vocabulary_growth():
    assert vocabulary_growth(["a", "b", "a", "c"])[-1] == (4, 3)
