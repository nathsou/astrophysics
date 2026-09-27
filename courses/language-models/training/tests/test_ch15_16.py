"""Chapters 15 and 16: decoding rules, the repetition metric and fake quantisation (CPU only)."""

import math

import pytest

torch = pytest.importorskip("torch")

from lmcourse.ch15 import metrics
from lmcourse.ch16 import fake_quantise
from lmcourse.sampling import Sampler, min_p, prepare, top_k, top_p

P = torch.tensor([[0.5, 0.2, 0.15, 0.1, 0.05]], dtype=torch.float64)
Z = P.log()


def kept(z: torch.Tensor) -> list[int]:
    return torch.isfinite(z[0]).nonzero().flatten().tolist()


def test_truncation_rules():
    assert kept(top_k(Z, 2)) == [0, 1]
    assert kept(top_p(Z, 0.6)) == [0, 1]
    assert kept(top_p(Z, 0.49)) == [0]
    assert kept(min_p(Z, 0.3)) == [0, 1, 2]


def test_temperature_before_truncation():
    assert kept(prepare(Z, torch.zeros(1, 1, dtype=torch.long), Sampler(temperature=2, top_p=0.6))) == [0, 1, 2]


def test_repetition_metric():
    # 4-grams of [1, 2, 3, 4, 1, 2, 3, 4]: five, of which (1, 2, 3, 4) repeats once.
    m = metrics([[1, 2, 3, 4, 1, 2, 3, 4]], [-1.0])
    assert m["repetition"] == pytest.approx(1 / 5)
    assert m["distinct4"] == pytest.approx(4 / 5)
    assert m["logp"] == -1.0


def test_fake_quantise_error_bound_and_groups():
    torch.manual_seed(0)
    w = torch.randn(64, 8)
    q8 = fake_quantise(w, 8, None, dim=0)
    # Per column: error at most half a step, step = max|column| / 127.
    step = w.abs().amax(0) / 127
    assert ((q8 - w).abs() <= step / 2 + 1e-7).all()
    q4 = fake_quantise(w, 4, 16, dim=0)
    assert len(torch.unique(q4[:16, 0])) <= 15
    assert (q4 - w).abs().mean() > (q8 - w).abs().mean()
    assert math.isclose(fake_quantise(torch.zeros(4, 4), 4, None, 0).abs().sum().item(), 0)
