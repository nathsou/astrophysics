"""Chapter 22: the arithmetic formats and answer extraction."""

import random

from lmcourse.ch22 import answer, render


def test_formats():
    assert render(348105, 920377, "direct") == ("348105+920377=", "1268482\n")
    _, c = render(348105, 920377, "scratchpad")
    assert c == "5+7+0=12,0+7+1=8,1+3+0=4,8+0+0=8,4+2+0=6,3+9+0=12>1268482\n"
    assert answer(c) == 1268482


def test_scratchpad_answers_are_always_right():
    rng = random.Random(0)
    for _ in range(200):
        a, b = rng.randrange(10**6), rng.randrange(10**6)
        assert answer(render(a, b, "scratchpad")[1]) == a + b


def test_answer_rejects_malformed_output():
    assert answer("12a4\n") is None
    assert answer("1+2+0=3,>\n") is None
