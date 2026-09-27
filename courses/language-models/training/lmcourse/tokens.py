"""Chapter 14 — CourseGPT's data pipeline: train a BPE tokeniser on TinyStories, then encode the whole
corpus into flat binary files of token ids that the training loop reads through a memory map.

    uv run lmc data tinystories          # download (≈2.2 GB)
    uv run lmc tokenise                  # tokeniser.json, train.bin, val.bin in data/tinystories/

The token stream is  EOT story₁ EOT story₂ EOT …  so every story is preceded by `<|endoftext|>`.
At generation time we start from a lone EOT, and the model begins a fresh story.

Ids are stored as uint16 (the vocabulary has 8,192 entries), half the size of int32, so the
≈500 M training tokens take ≈1 GB and fit comfortably in the page cache.
"""

from __future__ import annotations

import json
import os
import time
from collections.abc import Iterator
from multiprocessing import Pool
from pathlib import Path

import numpy as np

from . import bpe, data
from .paths import DATA

EOT = "<|endoftext|>"
OUT = DATA / "tinystories"


def stories(text: str) -> list[str]:
    """Split raw TinyStories text into stories. Text after the last EOT is dropped: the published
    training file stops in the middle of a story."""
    parts = text.split(EOT)
    return [s.strip() for s in parts[:-1] if s.strip()]


def train_tokeniser(vocab: int = 8192, sample_mb: int = 100) -> bpe.BpeTokeniser:
    """Train byte-level BPE on the first `sample_mb` megabytes of the training split. The vocabulary
    is the 256 bytes, vocab − 257 merges and one special token, so it has exactly `vocab` entries."""
    with open(data.path("tinystories"), encoding="utf-8") as f:
        sample = stories(f.read(sample_mb * 1_000_000))
    t0 = time.time()
    trainer = bpe.BpeTrainer(sample)
    print(f"  {len(sample):,} stories, {len(trainer.words):,} distinct chunks ({time.time() - t0:.0f} s)")
    merges = vocab - 256 - 1
    curve = [[0, 1.0]]
    while len(trainer.merges) < merges and trainer.step():
        if len(trainer.merges) % 64 == 0:
            curve.append([len(trainer.merges), trainer.total_bytes / trainer.total_tokens])
        if len(trainer.merges) % 1000 == 0:
            print(f"  {len(trainer.merges):,} merges, {trainer.total_bytes / trainer.total_tokens:.2f} bytes/token")
    (OUT / "merge_curve.json").write_text(json.dumps(curve))
    return trainer.tokeniser([EOT])


_tok: bpe.BpeTokeniser | None = None


def _init(path: str) -> None:
    global _tok
    _tok = bpe.BpeTokeniser.load(Path(path))


def _encode(block: list[str]) -> np.ndarray:
    assert _tok is not None
    eot = _tok.special[EOT]
    out: list[int] = []
    for s in block:
        out.append(eot)
        out.extend(_tok.encode(s))
    return np.array(out, dtype=np.uint16)


def _blocks(items: list[str], size: int) -> Iterator[list[str]]:
    for i in range(0, len(items), size):
        yield items[i : i + size]


def encode_file(src: Path, dest: Path, tok_path: Path, workers: int) -> int:
    """Encode every story in `src` into `dest` (uint16), in parallel, preserving order."""
    text = src.read_text(encoding="utf-8")
    items = stories(text)
    del text
    n = 0
    t0 = time.time()
    tmp = dest.with_name(dest.name + ".part")
    with Pool(workers, initializer=_init, initargs=(str(tok_path),)) as pool, open(tmp, "wb") as f:
        for i, ids in enumerate(pool.imap(_encode, _blocks(items, 2000), chunksize=4)):
            ids.tofile(f)
            n += len(ids)
            if i % 100 == 0:
                done = min(len(items), (i + 1) * 2000)
                print(f"\r  {dest.name}: {done:,}/{len(items):,} stories, {n:,} tokens", end="", flush=True)
    tmp.rename(dest)
    print(f"\r  {dest.name}: {len(items):,} stories, {n:,} tokens in {time.time() - t0:.0f} s")
    return n


def main(vocab: int = 8192, sample_mb: int = 100, force: bool = False) -> None:
    data.download("tinystories")
    OUT.mkdir(parents=True, exist_ok=True)
    tok_path = OUT / "tokeniser.json"
    if force or not tok_path.exists():
        print(f"Training a {vocab:,}-token BPE tokeniser on {sample_mb} MB of TinyStories")
        train_tokeniser(vocab, sample_mb).save(tok_path)
    tok = bpe.BpeTokeniser.load(tok_path)
    workers = os.cpu_count() or 4
    stats: dict[str, dict] = {}
    for split, filename in (("val", "TinyStoriesV2-GPT4-valid.txt"), ("train", "TinyStoriesV2-GPT4-train.txt")):
        dest = OUT / f"{split}.bin"
        src = DATA / filename
        if force or not dest.exists():
            print(f"Encoding {filename} with {workers} processes")
            encode_file(src, dest, tok_path, workers)
        tokens = dest.stat().st_size // 2
        # Bytes of story text (UTF-8), not of the file: the EOT markers and blank lines are not text.
        text_bytes = sum(len(s.encode("utf-8")) for s in stories(src.read_text(encoding="utf-8")))
        stats[split] = {"tokens": tokens, "bytes": text_bytes, "bytes_per_token": text_bytes / tokens}
    (OUT / "meta.json").write_text(json.dumps({"vocab": tok.vocab_size, "eot": tok.special[EOT], **stats}, indent=2))
    for split, s in stats.items():
        print(f"{split}: {s['tokens']:,} tokens, {s['bytes_per_token']:.2f} bytes/token")


def load(split: str) -> np.memmap:
    """The token ids of a split, memory-mapped (nothing is read until it is indexed)."""
    return np.memmap(OUT / f"{split}.bin", dtype=np.uint16, mode="r")


def tokeniser() -> bpe.BpeTokeniser:
    return bpe.BpeTokeniser.load(OUT / "tokeniser.json")
