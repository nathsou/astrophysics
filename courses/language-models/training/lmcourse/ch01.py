"""Chapter 1 lab: corpus statistics for TinyShakespeare."""

from __future__ import annotations

import json

from . import data
from .paths import FIXTURES
from .text import entropy, fit_power_law, ranked, vocabulary_growth, words


def stats() -> dict:
    text = data.load_text("shakespeare")
    ws = words(text)
    chars = ranked(text)
    word_ranks = ranked(ws)
    body = [(r + 1, c) for r, (_, c) in enumerate(word_ranks) if c >= 3]
    zipf = fit_power_law([r for r, _ in body], [c for _, c in body])
    growth = [(n, v) for n, v in vocabulary_growth(ws, 80) if n >= 2000]
    heaps = fit_power_law([n for n, _ in growth], [v for _, v in growth])
    return {
        "characters": len(text),
        "distinct_characters": len(chars),
        "char_entropy_bits": entropy(c for _, c in chars),
        "words": len(ws),
        "distinct_words": len(word_ranks),
        "hapax_legomena": sum(1 for _, c in word_ranks if c == 1),
        "word_entropy_bits": entropy(c for _, c in word_ranks),
        "top_words": [w for w, _ in word_ranks[:10]],
        "zipf": {"s": zipf.s, "C": zipf.C, "r2": zipf.r2},
        "heaps": {"K": heaps.C, "beta": -heaps.s},
    }


def main(write_fixture: bool = False) -> None:
    s = stats()
    print("TinyShakespeare")
    print(f"  characters        {s['characters']:>12,}   ({s['distinct_characters']} distinct)")
    print(f"  char entropy      {s['char_entropy_bits']:>12.4f}   bits/char (unigram)")
    print(f"  words             {s['words']:>12,}   ({s['distinct_words']:,} distinct, {s['hapax_legomena']:,} hapax)")
    print(f"  word entropy      {s['word_entropy_bits']:>12.4f}   bits/word (unigram)")
    print(f"  top words         {' '.join(s['top_words'])}")
    print(f"  Zipf fit          s = {s['zipf']['s']:.4f}, C = {s['zipf']['C']:,.1f}, R² = {s['zipf']['r2']:.4f}")
    print(f"  Heaps fit         K = {s['heaps']['K']:.3f}, β = {s['heaps']['beta']:.4f}")
    if write_fixture:
        FIXTURES.mkdir(parents=True, exist_ok=True)
        out = FIXTURES / "ch01_shakespeare_stats.json"
        out.write_text(json.dumps(s, indent=2) + "\n")
        print(f"\nwrote {out.relative_to(FIXTURES.parent.parent)}")
