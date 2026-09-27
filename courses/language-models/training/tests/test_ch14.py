"""Chapter 14's data pipeline and training-loop helpers (no GPU or dataset needed)."""

from types import SimpleNamespace

import pytest

from lmcourse.bpe import BpeTrainer
from lmcourse.tokens import EOT, stories
from lmcourse.train import PRESETS, flops_per_token, parse_overrides


def test_stories_drop_the_unterminated_tail_and_blank_entries():
    raw = f"One.\n{EOT}\n  Two  \n{EOT}\n\n{EOT}\nThree, cut off"
    assert stories(raw) == ["One.", "Two"]


def test_bpe_trains_on_a_list_of_documents():
    t = BpeTrainer(["aa b", "aa"])  # chunks: "aa", " b" and "aa" — none spans two documents
    counts = {bytes(w).decode(): f for w, f in zip(t.words, t.freq, strict=True)}
    assert counts == {"aa": 2, " b": 1}
    assert t.step() == ((97, 97), 2)


def test_overrides_convert_types():
    cfg = parse_overrides(PRESETS["coursegpt"], ["lr=1e-3", "layers=6", "compile=false", "name=x", "steps=2e3"])
    assert (cfg.lr, cfg.layers, cfg.compile, cfg.name, cfg.steps) == (1e-3, 6, False, "x", 2000)
    assert PRESETS["coursegpt"].layers == 8  # the preset itself is unchanged
    with pytest.raises(SystemExit):
        parse_overrides(PRESETS["coursegpt"], ["nope=1"])


def test_flops_per_token_counts_the_tied_output_layer_but_not_positions():
    cfg = SimpleNamespace(layers=8, width=512, context=512)
    params = 29_639_680  # CourseGPT
    expected = 6 * (params - 512 * 512) + 6 * 8 * 512 * 512
    assert flops_per_token(params, cfg) == expected
    assert abs(expected - 1.888e8) < 1e6
