"""Chapter 3 lab: train a byte-level BPE tokeniser on TinyShakespeare."""

from __future__ import annotations

import json
import time

from . import data
from .bpe import BpeTrainer
from .paths import FIXTURES, TRAINING

SAMPLE = "ROMEO: But soft, what light through yonder window breaks? It is the east, and Juliet is the sun!"


def main(merges: int = 1024, write_fixture: bool = False) -> None:
    text = data.load_text("shakespeare")
    t0 = time.perf_counter()
    trainer = BpeTrainer(text)
    checkpoints = {}
    while len(trainer.merges) < merges and trainer.step():
        if len(trainer.merges) in (1, 10, 100, 256, 512, 1024, 2048, 4096):
            checkpoints[len(trainer.merges)] = trainer.total_tokens
    tok = trainer.tokeniser(["<|endoftext|>"])
    print(f"Trained {len(trainer.merges)} merges in {time.perf_counter() - t0:.1f}s (vocabulary {tok.vocab_size})")
    print(f"  bytes {trainer.total_bytes:,} → tokens {trainer.total_tokens:,}  ({trainer.total_bytes / trainer.total_tokens:.2f} bytes/token)")
    for k, v in checkpoints.items():
        print(f"    after {k:>5} merges: {v:>9,} tokens ({trainer.total_bytes / v:.2f} bytes/token)")
    print("  first merges:", " ".join(repr(tok.token_bytes(256 + i).decode("utf-8", "replace")) for i in range(12)))
    ids = tok.encode(SAMPLE)
    print(f"  sample → {len(ids)} tokens:", " | ".join(tok.token_bytes(i).decode("utf-8", "replace") for i in ids))
    out = TRAINING / "runs" / "ch03"
    out.mkdir(parents=True, exist_ok=True)
    tok.save(out / f"shakespeare-bpe-{len(trainer.merges)}.json")
    print(f"  saved {out / f'shakespeare-bpe-{len(trainer.merges)}.json'}")
    if write_fixture:
        import tiktoken

        gpt2 = tiktoken.get_encoding("gpt2")
        strings = [SAMPLE, "Hello world!", " SolidGoldMagikarp", "12345 + 678 = 13023", "naïve café — 日本語 🙂",
                   "    def f(x):\n        return x**2\n", "the  the   the", "I'm we'll they've", "\n\n\nEnd."]
        FIXTURES.mkdir(parents=True, exist_ok=True)
        (FIXTURES / "ch03_bpe.json").write_text(json.dumps({
            "merges": [list(p) for p in trainer.merges[:300]],
            "sample": SAMPLE,
            "sample_ids": ids,
            "gpt2": {s: gpt2.encode(s) for s in strings},
        }, ensure_ascii=False, indent=1) + "\n")
        print(f"wrote {FIXTURES / 'ch03_bpe.json'}")
