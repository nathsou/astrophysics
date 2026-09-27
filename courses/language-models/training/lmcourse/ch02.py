"""Chapter 2 lab: n-gram models on TinyShakespeare (character level)."""

from __future__ import annotations

import json
import math
import time

from . import data
from .ngram import NGramModel, NGramStats, Smoothing, cross_entropy_bits
from .paths import FIXTURES

EVAL = 8000
START = 8  # same evaluation window as the browser widget
SMOOTHINGS = {
    "mle": Smoothing("mle"),
    "addk": Smoothing("addk", k=0.1),
    "interp": Smoothing("interp", lam=0.8),
    "kn": Smoothing("kn", d=0.75),
}


def char_ids() -> tuple[list[str], list[int], list[int]]:
    text = data.load_text("shakespeare")
    chars = sorted(set(text))
    index = {c: i for i, c in enumerate(chars)}
    ids = [index[c] for c in text]
    split = int(len(ids) * 0.9)
    return chars, ids[:split], ids[split:]


def main(max_order: int = 6, write_fixture: bool = False) -> None:
    chars, train, val = char_ids()
    t0 = time.perf_counter()
    stats = NGramStats(train, len(chars), max_order)
    print(f"Counted 1…{max_order}-grams of {len(train):,} characters in {time.perf_counter() - t0:.1f}s")
    tr, va = train[: EVAL + START], val[: EVAL + START]
    results: dict[str, list[dict[str, float]]] = {}
    print(f"\nCross-entropy in bits/char (train / validation), {EVAL:,} characters each")
    print("  n  " + "".join(f"{name:>18}" for name in SMOOTHINGS))
    for n in range(1, max_order + 1):
        row = []
        for name, s in SMOOTHINGS.items():
            m = NGramModel(stats, n, s)
            r = {"train": cross_entropy_bits(m, tr, START), "val": cross_entropy_bits(m, va, START)}
            results.setdefault(name, []).append(r)
            row.append(f"{r['train']:>8.3f} / {r['val']:<7.3f}")
        print(f"  {n}  " + "".join(f"{x:>18}" for x in row))
    if write_fixture:
        FIXTURES.mkdir(parents=True, exist_ok=True)
        out = FIXTURES / "ch02_ngram_bits.json"
        # JSON has no Infinity: write null for an infinite cross-entropy.
        clean = {k: [{s: (None if math.isinf(v) else v) for s, v in r.items()} for r in rows] for k, rows in results.items()}
        out.write_text(json.dumps({"eval": EVAL, "start": START, "results": clean}, indent=2, allow_nan=False) + "\n")
        print(f"\nwrote {out}")
